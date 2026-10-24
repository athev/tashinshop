/* ==========================================================
   store.js — Kho dữ liệu dùng chung
   - Chế độ SERVER (mở qua http://…): đăng nhập PIN, dữ liệu lưu trên máy chủ,
     admin & chủ shop cùng thấy một dữ liệu.
   - Chế độ LOCAL (mở file trực tiếp): lưu localStorage, tự chọn vai trò.
   ========================================================== */
(function (global) {
  'use strict';
  const KEY = 'kp_hanghoan_v2', OLD_KEY = 'kp_hanghoan_v1';
  const DEFAULT_SETTINGS = { returnDays: 3, followDays: 3, shopName: 'Shop Khánh Phong', owner: '' };
  const OWNER_FIELDS = ['received', 'inspection', 'inspectionNote', 'evidence', 'ownerNote'];

  const state = { cases: {}, imports: [], settings: { ...DEFAULT_SETTINGS }, dataAsOf: null, sales: { orders: {}, meta: null } };
  const session = { mode: 'local', role: null, token: localStorage.getItem('kp_token') || '', lan: [] };

  // ---------------- API ----------------
  async function api(method, url, body) {
    const r = await fetch(url, {
      method, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: 'Bearer ' + session.token } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && url !== '/api/login') {
      session.token = ''; session.role = null; localStorage.removeItem('kp_token');
      const e = new Error('Phiên đăng nhập đã hết'); e.status = 401; throw e;
    }
    if (!r.ok) { const e = new Error(j.error || 'Lỗi ' + r.status); e.status = r.status; throw e; }
    return j;
  }

  function replaceState(st, sales) {
    state.cases = st.cases || {};
    state.imports = st.imports || [];
    state.settings = { ...DEFAULT_SETTINGS, ...(st.settings || {}) };
    state.dataAsOf = st.dataAsOf || null;
    state.sales = sales && sales.orders ? { orders: sales.orders, meta: sales.meta || null } : { orders: {}, meta: null };
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function loadLocal() {
    try {
      const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
      if (raw) { const d = JSON.parse(raw); replaceState(d, d.sales); return; }
    } catch (e) { console.error('Load failed', e); }
    loadSeed(true);
  }
  function loadSeed(silent) {
    if (!global.SEED_STATE) return;
    replaceState(clone(global.SEED_STATE), null);
    if (session.mode === 'local') saveLocal();
    else if (!silent) pushAll();
  }
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); } }

  async function init() {
    session.mode = 'local';
    if (location.protocol !== 'file:') {
      try { const r = await fetch('/api/ping', { cache: 'no-store' }); const j = await r.json(); if (j && j.ok) { session.mode = 'server'; session.lan = j.lan || []; } } catch (e) { /* local */ }
    }
    if (session.mode === 'local') {
      loadLocal();
      session.role = localStorage.getItem('kp_role') || 'admin';
      return session;
    }
    if (session.token) { try { await refresh(); } catch (e) { if (e.status !== 401) throw e; } }
    return session;
  }
  async function login(pin) {
    const j = await api('POST', '/api/login', { pin });
    session.token = j.token; session.role = j.role;
    localStorage.setItem('kp_token', j.token);
    await refresh();
    return j.role;
  }
  async function refresh() {
    if (session.mode !== 'server') return;
    const j = await api('GET', '/api/state');
    session.role = j.role;
    replaceState(j.state, j.sales);
  }
  function logout() {
    if (session.mode === 'server') api('POST', '/api/logout').catch(() => {});
    session.token = ''; session.role = null; localStorage.removeItem('kp_token');
  }
  function setLocalRole(r) { session.role = r; localStorage.setItem('kp_role', r); }

  // ---------------- Đẩy dữ liệu (admin) ----------------
  async function pushState() {
    if (session.mode === 'local') return saveLocal();
    await api('PUT', '/api/state', { cases: state.cases, imports: state.imports, settings: state.settings, dataAsOf: state.dataAsOf });
  }
  async function pushSales() {
    if (session.mode === 'local') return saveLocal();
    await api('PUT', '/api/sales', { orders: state.sales.orders, meta: state.sales.meta });
  }
  async function pushAll() { await pushState(); await pushSales(); }

  const list = () => Object.values(state.cases);
  const get = (id) => state.cases[id];

  function log(c, text, by) {
    c.history = c.history || [];
    c.history.unshift({ at: WF.nowStr(), text, by: by || session.role || '' });
    if (c.history.length > 80) c.history.length = 80;
  }

  // Các trường Shopee cần theo dõi thay đổi giữa các lần tải
  const WATCH = {
    refundStatus: 'Trạng thái hoàn tiền', returnStatus: 'Trạng thái trả hàng', returnSuccessAt: 'Thời gian hoàn thành công',
    orderStatus: 'Trạng thái đơn', complaintStatus: 'Trạng thái khiếu nại', complaintRejectedAt: 'Ngày từ chối khiếu nại',
    complaintAcceptedAt: 'Ngày chấp nhận khiếu nại', compensatedAt: 'Ngày bồi thường', complaintReason: 'Lý do khiếu nại',
  };

  /** Lấy khoảng ngày dữ liệu từ tên file Shopee (…20261001_20261023…) */
  function rangeFromNames(names) {
    let from = '', to = '';
    for (const n of names) {
      const m = String(n).match(/(\d{4})(\d{2})(\d{2})_(\d{4})(\d{2})(\d{2})/);
      if (!m) continue;
      const a = `${m[1]}-${m[2]}-${m[3]}`, b = `${m[4]}-${m[5]}-${m[6]}`;
      if (!from || a < from) from = a;
      if (!to || b > to) to = b;
    }
    return { from, to };
  }

  /** Gộp dữ liệu từ parser vào kho (chạy trên bản dữ liệu mới nhất, đồng bộ) */
  function mergeLocal(parsed, fileNames) {
    const now = WF.nowStr();
    const newIds = [], changedIds = [], sameIds = [], reopenIds = [];
    for (const inc of parsed.cases) {
      const ex = state.cases[inc.id];
      if (!ex) {
        const c = { ...inc, m: WF.defaultManual(), firstSeen: now, lastSeen: now, isNew: true, history: [] };
        if (state.settings.owner) c.m.owner = state.settings.owner;
        WF.applyShopeeDefaults(c, true, state.settings);
        log(c, `Phát hiện mới từ file: ${fileNames.join(', ')}`, 'admin');
        state.cases[c.id] = c;
        newIds.push(c.id);
        continue;
      }
      const changes = [];
      for (const [k, label] of Object.entries(WATCH)) {
        const a = (ex.shopee || {})[k] || '', b = (inc.shopee || {})[k] || '';
        if (b && a !== b) changes.push(`${label}: ${a || '(trống)'} → ${b}`);
      }
      if (inc.returnTracking && inc.returnTracking !== ex.returnTracking) changes.push(`Mã vận đơn hoàn: ${inc.returnTracking}`);
      for (const [k, v] of Object.entries(inc)) {
        if (k === 'shopee' || k === 'id') continue;
        if (v !== '' && v != null && v !== 0) ex[k] = v;
      }
      ex.shopee = { ...(ex.shopee || {}) };
      for (const [k, v] of Object.entries(inc.shopee || {})) if (v !== '' && v != null && v !== 0) ex.shopee[k] = v;
      ex.lastSeen = now;
      const before = WF.stageOf(ex);
      WF.applyShopeeDefaults(ex, false, state.settings);
      if (changes.length) {
        log(ex, 'Shopee cập nhật – ' + changes.join(' · '), 'admin');
        ex.updatedFlag = now;
        if (ex.m.closed && changes.some((t) => /khiếu nại|từ chối/i.test(t))) { ex.m.closed = false; log(ex, 'Tự mở lại hồ sơ do có cập nhật khiếu nại', 'admin'); reopenIds.push(ex.id); }
        changedIds.push(ex.id);
      } else sameIds.push(ex.id);
      if (before !== WF.stageOf(ex) && !changes.length) changedIds.push(ex.id);
    }
    let overlayCount = 0;
    for (const o of parsed.overlays) {
      let c = state.cases[o.id];
      if (!c && o.raw && o.raw.orderId) {
        const type = /giao/i.test(o.raw.typeText) ? 'failed' : /hủy/i.test(o.raw.typeText) ? 'cancel' : 'return';
        c = state.cases[o.id] = {
          id: o.id, type, orderId: o.raw.orderId, complaintId: '', eventDate: o.raw.eventDate, product: o.raw.product,
          qty: o.raw.qty, value: o.raw.value, buyer: o.raw.buyer, carrier: o.raw.carrier, shopee: {},
          m: WF.defaultManual(), firstSeen: now, lastSeen: now, isNew: false, history: [], sources: ['tracking'],
        };
      }
      if (!c) continue;
      WF.applyOverlay(c, o);
      if (newIds.includes(c.id)) c.isNew = false;
      log(c, 'Đồng bộ trạng thái xử lý từ file theo dõi (.xlsm)', 'admin');
      overlayCount++;
    }
    const realNew = newIds.filter((id) => state.cases[id] && state.cases[id].isNew);

    // Doanh số (file tất cả đơn)
    let salesAdded = 0, salesUpdated = 0;
    if (parsed.sales && parsed.sales.length) {
      for (const o of parsed.sales) { if (state.sales.orders[o.id]) salesUpdated++; else salesAdded++; state.sales.orders[o.id] = o; }
      const ds = Object.values(state.sales.orders).map((o) => (o.d || '').slice(0, 10)).filter(Boolean).sort();
      const rg = rangeFromNames(fileNames);
      state.sales.meta = { at: now, files: fileNames, rangeStart: ds[0] || rg.from, rangeEnd: rg.to || ds[ds.length - 1] || '', count: Object.keys(state.sales.orders).length };
    }

    // Tự động bắc cầu: Nếu có đơn hoàn từ tháng trước phát sinh trong file hoàn/hủy mà chưa có trong Order.all, tự nạp vào kho doanh số
    for (const c of parsed.cases) {
      if (c.orderId && !state.sales.orders[c.orderId]) {
        state.sales.orders[c.orderId] = {
          id: c.orderId,
          d: c.orderDate || c.eventDate || now,
          s: c.type === 'cancel' ? 'Đã hủy' : (c.shopee?.refundStatus || 'Trả hàng/Hoàn tiền'),
          v: c.value || 0,
          q: c.qty || 1,
          done: '',
          dl: c.eventDate || '',
          rf: c.shopee?.refundStatus || 'Yêu cầu trả hàng',
          cr: c.shopee?.cancelReason || '',
          p: c.product || '',
          b: c.buyer || c.receiver || '',
        };
      }
    }

    if (parsed.cases.length || parsed.overlays.length) {
      const rg = rangeFromNames(fileNames);
      const prev = state.dataAsOf || {};
      state.dataAsOf = {
        importedAt: now, rangeStart: rg.from || prev.rangeStart || '', rangeEnd: rg.to || now.slice(0, 10),
        files: fileNames,
      };
    }
    const imp = {
      at: now, files: fileNames, newIds: realNew, changedIds: [...new Set(changedIds)], sameCount: sameIds.length,
      overlayCount, skipped: parsed.skipped.length, reopenIds, salesAdded, salesUpdated,
    };
    state.imports.unshift(imp);
    if (state.imports.length > 50) state.imports.length = 50;
    return imp;
  }
  /** Admin tải file: lấy dữ liệu mới nhất → gộp → đẩy lên máy chủ */
  async function importData(parsed, fileNames) {
    if (session.mode === 'server') await refresh();
    const imp = mergeLocal(parsed, fileNames);
    await pushState();
    if (parsed.sales && parsed.sales.length) await pushSales();
    return imp;
  }

  // ---------------- Cập nhật 1 hồ sơ (admin & chủ shop) ----------------
  function update(id, patch, logText) {
    const c = state.cases[id];
    if (!c) return Promise.resolve();
    if (session.role === 'owner') { patch = Object.fromEntries(Object.entries(patch).filter(([k]) => OWNER_FIELDS.includes(k))); }
    const before = WF.stageOf(c);
    Object.assign(c.m, patch);
    const after = WF.stageOf(c);
    const logs = [];
    if (logText) logs.push(logText);
    if (before !== after) logs.push(`Chuyển giai đoạn: ${WF.STAGE_MAP[before].name} → ${WF.STAGE_MAP[after].name}`);
    if (session.mode === 'local') {
      const now = WF.nowStr();
      if (session.role === 'owner') { c.m.ownerUpdatedAt = now; c.updatedFlag = now; }
      [...logs].reverse().forEach((t) => log(c, `[${session.role === 'owner' ? 'Chủ shop' : 'Admin'}] ${t}`));
      saveLocal();
      return Promise.resolve();
    }
    return api('PATCH', '/api/case/' + encodeURIComponent(id), { patch, logs }).then((j) => { state.cases[id] = j.case; });
  }
  function markSeen(id) {
    const c = state.cases[id];
    if (!c || session.role !== 'admin' || !(c.isNew || c.updatedFlag)) return;
    c.isNew = false; c.updatedFlag = '';
    if (session.mode === 'local') saveLocal(); else api('POST', '/api/seen', { ids: [id] }).catch(() => {});
  }
  function markAllSeen() {
    list().forEach((c) => { c.isNew = false; c.updatedFlag = ''; });
    if (session.mode === 'local') saveLocal(); else api('POST', '/api/seen', { all: true }).catch(() => {});
  }
  async function remove(id) {
    delete state.cases[id];
    if (session.mode === 'local') saveLocal(); else await api('DELETE', '/api/case/' + encodeURIComponent(id));
  }
  async function clearAll() {
    state.cases = {}; state.imports = []; state.dataAsOf = null; state.sales = { orders: {}, meta: null };
    await pushAll();
  }
  async function setSettings(s) {
    state.settings = { ...state.settings, ...s };
    if (session.mode === 'local') saveLocal(); else await api('PUT', '/api/settings', { settings: state.settings });
  }
  async function changePins(admin, owner) { return api('PUT', '/api/pins', { admin, owner }); }
  async function getPins() { return (await api('GET', '/api/pins')).pins; }
  function exportJSON() { return JSON.stringify(state, null, 1); }
  async function importJSON(text) {
    const d = JSON.parse(text);
    if (!d || typeof d.cases !== 'object') throw new Error('File sao lưu không hợp lệ');
    replaceState(d, d.sales);
    await pushAll();
  }

  global.Store = {
    state, session, init, login, logout, refresh, setLocalRole, list, get, importData, update, markSeen, markAllSeen,
    remove, clearAll, setSettings, changePins, getPins, exportJSON, importJSON, loadSeed, pushAll, rangeFromNames,
  };
})(window);
