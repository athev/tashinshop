/* ==========================================================
   app.js — Giao diện theo vai trò
   • Admin  : tải file Shopee, làm việc với Shopee/khách, khiếu nại, xem doanh số
   • Chủ shop: xem đơn cần xử lý, xác nhận đã nhận hàng/tình trạng thực tế, xem doanh số
   ========================================================== */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const money = (v) => (Math.round(Number(v)) || 0).toLocaleString('vi-VN') + 'đ';
  const moneyShort = (v) => { v = Number(v) || 0; return v >= 1e6 ? (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'tr' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : v + 'đ'; };
  const d10 = (s) => (s || '').slice(0, 10);
  const dmy = (s) => { const x = d10(s); return x ? `${x.slice(8, 10)}/${x.slice(5, 7)}/${x.slice(0, 4)}` : '—'; };
  const hm = (s) => (s && s.length >= 16 ? `${s.slice(11, 16)} ${s.slice(8, 10)}/${s.slice(5, 7)}` : s || '');
  const S = () => Store.state.settings;
  const sess = Store.session;
  const isAdmin = () => sess.role === 'admin';

  const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
  const ICON = {
    dashboard: svg('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
    queue: svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
    cases: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    sales: svg('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'),
    upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    alert: svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    msg: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    truck: svg('<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'),
    box: svg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
    clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    folder: svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
    search: svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    x: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    check: svg('<polyline points="20 6 9 17 4 12"/>'),
    inbox: svg('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    cal: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
  };
  const small = (ic, n = 14) => ic.replace('<svg', `<svg width="${n}" height="${n}"`);

  // ---------------- Hỗ trợ sao chép nhanh ----------------
  function copyText(text, label = 'nội dung') {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        toast(`Đã sao chép ${label}: ${text}`, 'ok');
      }).catch(() => fallbackCopy(text, label));
    } else {
      fallbackCopy(text, label);
    }
  }
  function fallbackCopy(text, label) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      toast(`Đã sao chép ${label}: ${text}`, 'ok');
    } catch (e) {
      toast(`Không thể tự động sao chép: ${text}`, 'err');
    }
    document.body.removeChild(ta);
  }
  function copyBtn(text, label = 'username', extraClass = '') {
    if (!text || text === '—') return '';
    return `<button class="copy-btn ${extraClass}" data-copy="${esc(text)}" data-copy-label="${esc(label)}" type="button" title="Sao chép ${esc(label)}">${small(ICON.copy, 12)}<span>Copy</span></button>`;
  }

  // ---------------- Điều hướng theo vai trò ----------------
  const NAV = [
    { key: 'dashboard', label: 'Tổng quan', roles: ['admin'] },
    { key: 'queue', label: 'Cần xử lý', ownerLabel: 'Đơn cần kiểm tra', roles: ['admin', 'owner'] },
    { key: 'cases', label: 'Tất cả đơn', roles: ['admin'] },
    { key: 'sales', label: 'Doanh số', ownerLabel: 'Doanh số', roles: ['admin', 'owner'] },
    { key: 'upload', label: 'Tải file', roles: ['admin'] },
    { key: 'settings', label: 'Cài đặt', roles: ['admin'] },
  ];
  const TITLE = { dashboard: 'Tổng quan', queue: () => (isAdmin() ? 'Việc cần xử lý' : 'Đơn hàng cần kiểm tra'), cases: 'Tất cả đơn', sales: 'Doanh số', upload: 'Tải file Shopee', settings: 'Cài đặt' };
  const titleOf = (p) => (typeof TITLE[p] === 'function' ? TITLE[p]() : TITLE[p]);
  const defaultPage = () => (isAdmin() ? 'dashboard' : 'queue');
  let currentPage = 'queue';

  function buildNav() {
    $('#nav').innerHTML = NAV.filter((n) => n.roles.includes(sess.role)).map((n) => {
      const label = (!isAdmin() && n.ownerLabel) ? n.ownerLabel : n.label;
      return `<button class="nav-btn" data-page="${n.key}" id="nav-${n.key}" type="button">${ICON[n.key]}<span class="label">${label}</span><span class="count" id="count-${n.key}"></span></button>`;
    }).join('');
    const chip = $('#role-chip');
    chip.textContent = isAdmin() ? 'ADMIN' : 'CHỦ SHOP';
    chip.className = 'role-chip ' + sess.role;
    const local = sess.mode === 'local';
    $('#role-switch').hidden = !local;
    $('#btn-logout').hidden = local;
    $$('#role-switch button').forEach((b) => b.classList.toggle('on', b.dataset.role === sess.role));
  }
  $('#nav').addEventListener('click', (e) => { const b = e.target.closest('.nav-btn'); if (b) go(b.dataset.page); });

  function go(page) {
    if (!NAV.find((n) => n.key === page && n.roles.includes(sess.role))) page = defaultPage();
    currentPage = page;
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
    $$('.page').forEach((p) => p.classList.toggle('active', p.id === 'page-' + page));
    $('#tb-title').textContent = titleOf(page);
    renderAsof();
    window.scrollTo({ top: 0 });
  }
  document.addEventListener('click', (e) => {
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      e.stopPropagation();
      e.preventDefault();
      const txt = cp.dataset.copy;
      const lbl = cp.dataset.copyLabel || 'nội dung';
      copyText(txt, lbl);
      cp.classList.add('copied');
      const sp = cp.querySelector('span');
      if (sp) sp.textContent = 'Đã chép!';
      setTimeout(() => {
        cp.classList.remove('copied');
        if (sp) sp.textContent = 'Copy';
      }, 1400);
      return;
    }
    const g = e.target.closest('[data-goto]'); if (g) { go(g.dataset.goto); return; }
    const o = e.target.closest('[data-open]'); if (o) openCase(o.dataset.open);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches && e.target.matches('.oc')) openCase(e.target.dataset.open); });

  // ---------------- Dữ liệu dẫn xuất ----------------
  function E(c) {
    const alert = WF.alertOf(c, S());
    return { c, stage: WF.stageOf(c), alert, score: WF.LVL_SCORE[alert.lvl] || 0, who: WF.ownerOf(c), due: WF.dueInfo(c, S()), real: WF.plainStatus(c) };
  }
  const enriched = () => Store.list().map(E);
  const isOpen = (e) => e.stage !== 'done';
  const byDue = (a, b) => (a.due ? a.due.days : 999) - (b.due ? b.due.days : 999) || b.score - a.score || (b.c.eventDate || '').localeCompare(a.c.eventDate || '');
  const sum = (l) => l.reduce((t, e) => t + (Number(e.c.value) || 0), 0);
  const mine = (e) => isOpen(e) && e.who === sess.role;

  function buyerName(c) {
    const r = c.receiver && !/^\*+$/.test(c.receiver) ? c.receiver : '';
    if (r) return c.buyer && c.buyer !== r ? `${r} (${c.buyer})` : r;
    return c.buyer || '—';
  }
  const reqCode = (c) => c.complaintId || (c.type === 'failed' ? 'Giao thất bại (không có mã)' : c.type === 'cancel' ? 'Hủy đơn (không có mã)' : '—');
  const shortProd = (c) => (c.product || '').split('|')[0].trim();
  const haystack = (c) => [c.id, c.orderId, c.complaintId, c.product, c.sku, c.buyer, c.receiver, c.trackingOut, c.returnTracking, c.m.returnTracking, c.m.owner].join(' ').toLowerCase();

  function whoLabel(who) {
    if (!who) return 'Hoàn tất';
    if (isAdmin()) return who === 'owner' ? 'Chủ shop xử lý' : 'Admin xử lý';
    return who === 'owner' ? 'Việc của bạn' : 'Admin đang xử lý';
  }
  const newBadge = (c) => (isAdmin() ? (c.isNew ? '<span class="badge b-new">MỚI</span>' : c.updatedFlag ? '<span class="badge b-yellow">CẬP NHẬT</span>' : '') : '');
  const typeBadge = (c) => `<span class="badge plain ${WF.TYPE_BADGE[c.type] || 'b-gray'}">${esc(WF.TYPE_LABEL[c.type] || c.type)}</span>`;
  const dueHTML = (due) => (due ? `<span class="pill p-${due.lvl}">${esc(due.label)}</span> <span class="muted">${dmy(due.date)}</span>` : '<span class="muted">—</span>');
  const emptyState = (t) => `<div class="empty">${ICON.inbox}<div>${t}</div></div>`;

  // ---------------- Thẻ đơn hàng (dùng chung mọi danh sách) ----------------
  function cardHTML(e) {
    const c = e.c;
    const rawUser = c.buyer || '';
    const username = rawUser ? `@${rawUser}` : '—';
    if (!isAdmin()) {
      const loc = WF.productLocation(c, S());
      const buyer = c.receiver || c.buyer || '—';
      const prod = c.product ? `${c.product}${c.variation ? ' (' + c.variation + ')' : ''}` : '—';
      const reason = c.shopee?.reason || c.shopee?.buyerNote || c.shopee?.cancelReason || '';
      return `<article class="oc lvl-${e.alert.lvl}" data-open="${esc(c.id)}" tabindex="0" style="cursor:pointer">
        <div class="oc-head">
          <div style="min-width:0;flex:1">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span class="mono" style="font-size:16.5px;font-weight:800;color:var(--brand-2)">${esc(username)}</span>
              ${copyBtn(rawUser, 'username')}
            </div>
            <div style="font-size:13px;color:var(--text-2);margin-top:2px">Người nhận: <b>${esc(buyer)}</b></div>
          </div>
          <span class="badge" style="background:${loc.color};color:#fff;font-weight:700;flex:none">${esc(loc.badge)}</span>
        </div>
        <dl class="kv" style="margin:10px 0 12px">
          <div><dt>Sản phẩm</dt><dd><b>${esc(prod)}</b></dd></div>
          <div><dt>Doanh số</dt><dd><b style="color:var(--brand-2);font-size:15px">${money(c.value)}</b></dd></div>
          <div><dt>Trạng thái</dt><dd>${esc(WF.shopeeText(c))}</dd></div>
          <div><dt>Vị trí</dt><dd><span style="color:${loc.color};font-weight:600">${loc.icon} ${esc(loc.text)}</span></dd></div>
          ${reason ? `<div><dt>Lý do hoàn</dt><dd><span class="muted">${esc(reason)}</span></dd></div>` : ''}
          <div><dt>Hạn xử lý</dt><dd>${dueHTML(e.due)}</dd></div>
        </dl>
        <button class="btn btn-primary oc-btn" type="button" style="width:100%;font-weight:700">👉 Bấm để kiểm tra theo bước (Step-by-Step)</button>
      </article>`;
    }
    const btn = e.who === 'admin' ? 'Mở để xử lý' : 'Xem chi tiết';
    return `<article class="oc lvl-${e.alert.lvl} ${isAdmin() && c.isNew ? 'is-new' : ''}" data-open="${esc(c.id)}" tabindex="0">
      <div class="oc-head">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="mono" style="font-size:15.5px;font-weight:800;color:var(--brand-2)">${esc(username)}</span>
            ${copyBtn(rawUser, 'username')}
          </div>
          <div style="font-size:12.5px;color:var(--text-2);margin-top:2px">Người nhận: ${esc(buyerName(c))}</div>
        </div>
        <div class="oc-tags">${newBadge(c)}<span class="who who-${e.who || 'done'}">${whoLabel(e.who)}</span></div>
      </div>
      <dl class="kv">
        <div><dt>Mã đơn hàng</dt><dd class="mono" style="display:flex;align-items:center;gap:6px">${esc(c.orderId)} ${copyBtn(c.orderId, 'mã đơn')}</dd></div>
        <div><dt>Mã yêu cầu</dt><dd class="mono">${esc(reqCode(c))}</dd></div>
        <div><dt>Trạng thái Shopee</dt><dd>${esc(WF.shopeeText(c))}</dd></div>
        <div><dt>Trạng thái thực tế</dt><dd><span class="pill p-${e.real.lvl}">${esc(e.real.text)}</span></dd></div>
        <div><dt>Hạn xử lý</dt><dd>${dueHTML(e.due)}</dd></div>
      </dl>
      <div class="oc-foot"><span class="prod">${typeBadge(c)} ${esc(shortProd(c))}</span><b>${money(c.value)}</b></div>
      <button class="btn ${e.who === sess.role ? 'btn-primary' : ''} oc-btn" type="button">${btn}</button>
    </article>`;
  }

  // ---------------- Dữ liệu cập nhật đến ngày ----------------
  function asofHTML(main, sub, atStr) {
    const at = WF.parse(atStr);
    const age = at ? WF.dayDiff(WF.today(), at) : 0;
    const stale = age >= 2;
    return `<div class="asof ${stale ? 'stale' : ''}">${ICON.cal}<div><div>${main}</div><div class="sub">${esc(sub)}${stale ? ` · <b>Dữ liệu đã cũ ${age} ngày</b>${isAdmin() ? ' – hãy tải file mới' : ' – nhờ admin cập nhật'}` : ''}</div></div></div>`;
  }
  function renderAsof() {
    const el = $('#asof');
    if (['settings', 'upload'].includes(currentPage)) { el.innerHTML = ''; return; }
    if (currentPage === 'sales') {
      const m = Store.state.sales.meta;
      el.innerHTML = m ? asofHTML(`Doanh số cập nhật đến ngày <b>${dmy(m.rangeEnd || m.at)}</b>`, `Admin tải file lúc ${hm(m.at)}`, m.at) : '';
      return;
    }
    const a = Store.state.dataAsOf;
    if (!a) { el.innerHTML = `<div class="asof empty">${ICON.alert}<div>Chưa có dữ liệu đơn hàng. ${isAdmin() ? 'Vào <b>Tải file</b> để cập nhật.' : 'Nhờ admin tải file Shopee.'}</div></div>`; return; }
    el.innerHTML = asofHTML(`Dữ liệu Shopee cập nhật đến ngày <b>${dmy(a.rangeEnd || a.importedAt)}</b>`, `Admin tải file lúc ${hm(a.importedAt)}`, a.importedAt);
  }

  // ---------------- Render tổng ----------------
  function renderAll() {
    const all = enriched();
    renderChrome(all);
    renderAsof();
    if (isAdmin()) { renderDashboard(all); renderImportHistory(); }
    renderQueue(all);
    renderCases(all);
    renderSales();
  }
  function renderChrome(all) {
    const n = !isAdmin() ? all.filter(isOpen).length : all.filter(mine).length;
    const el = $('#count-queue'); if (el) el.textContent = n || '';
    const a = Store.state.dataAsOf;
    $('#sidebar-foot').innerHTML = `Đăng nhập: <b>${isAdmin() ? 'Admin' : 'Chủ shop'}</b><br>${a ? `Dữ liệu đến <b>${dmy(a.rangeEnd || a.importedAt)}</b><br>` : ''}${all.length} hồ sơ · ${all.filter(isOpen).length} chưa đóng`;
  }

  // ---------------- Tổng quan (admin) ----------------
  const KPIS = [
    { key: 'total', label: 'Tổng hồ sơ', icon: 'folder', accent: 'var(--text)', fn: () => true, sub: (l) => `${moneyShort(sum(l))} giá trị` },
    { key: 'open', label: 'Chưa đóng', icon: 'clock', accent: 'var(--blue)', fn: isOpen, sub: (l) => `${moneyShort(sum(l))} đang treo` },
    { key: 'contact', label: 'Cần nhắn khách', icon: 'msg', accent: 'var(--red)', fn: (e) => e.stage === 'contact', sub: () => 'Nhắn ngay để giữ đơn' },
    { key: 'verify', label: 'Shopee báo hoàn, chưa nhận', icon: 'search', accent: 'var(--orange)', fn: (e) => e.stage === 'verify', sub: () => 'Chủ shop xác minh' },
    { key: 'overdue', label: 'Quá hạn xử lý', icon: 'truck', accent: 'var(--red)', fn: (e) => isOpen(e) && e.due && e.due.days < 0, sub: () => 'Đã trễ hạn' },
    { key: 'needComplaint', label: 'Cần khiếu nại', icon: 'alert', accent: 'var(--brand)', fn: (e) => e.stage === 'complaint' && (!e.c.m.complaint || e.c.m.complaint === 'rejected'), sub: () => 'Thiếu / hỏng / bị từ chối' },
    { key: 'inspect', label: 'Chờ kiểm hàng', icon: 'box', accent: 'var(--violet)', fn: (e) => e.stage === 'inspect', sub: () => 'Chủ shop kiểm hàng' },
    { key: 'tracking', label: 'Đang theo dõi khiếu nại', icon: 'shield', accent: 'var(--yellow)', fn: (e) => e.stage === 'complaint' && ['sent', 'processing'].includes(e.c.m.complaint), sub: () => 'Chờ Shopee phản hồi' },
  ];
  function renderDashboard(all) {
    const open = all.filter(isOpen);
    const adminTasks = open.filter((e) => e.who === 'admin'), ownerTasks = open.filter((e) => e.who === 'owner');
    const red = (l) => l.filter((e) => e.due && e.due.days < 0).length;
    $('#who-grid').innerHTML = [
      { tab: 'admin', t: 'Admin cần làm', l: adminTasks, c: 'var(--blue)', s: 'Nhắn khách · thương lượng · khiếu nại' },
      { tab: 'owner', t: 'Chủ shop cần xử lý', l: ownerTasks, c: 'var(--brand)', s: 'Nhận hàng hoàn · kiểm hàng · xác nhận thực tế' },
    ].map((x) => `<div class="card who-card" style="--wc:${x.c}" data-tab="${x.tab}" id="who-${x.tab}"><div class="t">${x.t}</div><div class="n">${x.l.length}</div><div class="s">${x.s}${red(x.l) ? ` · <b style="color:var(--red)">${red(x.l)} quá hạn</b>` : ''}</div></div>`).join('');
    $$('#who-grid .who-card').forEach((el) => el.addEventListener('click', () => { queueTab = el.dataset.tab; renderQueue(enriched()); go('queue'); }));

    $('#kpi-grid').innerHTML = KPIS.map((k) => {
      const l = all.filter(k.fn);
      return `<div class="card kpi" style="--accent:${k.accent}" data-kpi="${k.key}" id="kpi-${k.key}"><span class="kpi-icon">${ICON[k.icon]}</span><div class="kpi-label">${k.label}</div><div class="kpi-value">${l.length}</div><div class="kpi-sub">${k.sub(l)}</div></div>`;
    }).join('');
    $$('#kpi-grid .kpi').forEach((el) => el.addEventListener('click', () => { filters.kpi = el.dataset.kpi; filters.stage = ''; syncFilterUI(); casesLimit = 30; renderCases(enriched()); go('cases'); }));

    const max = Math.max(1, ...WF.STAGES.map((s) => all.filter((e) => e.stage === s.key).length));
    $('#flow').innerHTML = WF.STAGES.map((s, i) => {
      const n = all.filter((e) => e.stage === s.key).length;
      return `<div class="flow-step" style="--c:${s.color}" data-stage="${s.key}" id="flow-${s.key}"><div class="i">BƯỚC ${i + 1}</div><div class="n">${n}</div><div class="t">${s.short}</div><div class="flow-bar" style="width:${Math.max(6, (n / max) * 100)}%"></div></div>`;
    }).join('');
    $$('#flow .flow-step').forEach((el) => el.addEventListener('click', () => { filters.stage = el.dataset.stage; filters.kpi = ''; syncFilterUI(); casesLimit = 30; renderCases(enriched()); go('cases'); }));

    const urgent = open.filter((e) => e.score >= 3).sort(byDue);
    $('#urgent-sub').textContent = urgent.length ? `${urgent.length} việc` : '';
    $('#urgent-list').innerHTML = urgent.length ? urgent.slice(0, 8).map(taskRow).join('') : emptyState('Không có việc gấp 🎉');
    const nw = all.filter((e) => e.c.isNew || e.c.updatedFlag).sort(byDue);
    $('#new-list').innerHTML = nw.length ? nw.slice(0, 10).map(taskRow).join('') : emptyState('Chưa có đơn mới.');
  }
  function taskRow(e) {
    const c = e.c;
    const dot = { red: 'var(--red)', orange: 'var(--orange)', violet: 'var(--violet)', blue: 'var(--blue)', yellow: 'var(--yellow)', green: 'var(--green)' }[e.alert.lvl];
    return `<div class="task" data-open="${esc(c.id)}"><span class="task-dot" style="background:${dot}"></span><div class="task-body">
      <div class="task-top"><span class="task-title">${esc(buyerName(c))}</span>${newBadge(c)}<span class="who who-${e.who || 'done'}">${whoLabel(e.who)}</span></div>
      <div class="task-desc mono">${esc(c.orderId)} · ${esc(WF.TYPE_LABEL[c.type])}</div>
      <div class="task-desc" style="color:var(--text-2)">${esc(e.real.text)}${e.due ? ' · ' + esc(e.due.label) : ''}</div></div>
      <div class="task-val">${moneyShort(c.value)}</div></div>`;
  }
  $('#btn-seen-all').addEventListener('click', () => { Store.markAllSeen(); renderAll(); });

  // ---------------- Cần xử lý ----------------
  let queueTab = null;
  const queueTabs = () => (isAdmin()
    ? [{ k: 'admin', label: 'Admin cần làm' }, { k: 'owner', label: 'Chủ shop cần xử lý' }, { k: 'all', label: 'Tất cả chưa đóng' }]
    : [{ k: 'owner', label: 'Cần tôi xử lý' }, { k: 'watch', label: 'Admin đang xử lý' }]);
  const queueFilter = (k) => (e) => isOpen(e) && (k === 'all' || (k === 'watch' ? e.who === 'admin' : e.who === k));
  const QUEUE_HINT = {
    admin: 'Việc bạn làm với Shopee và khách: nhắn tin, thương lượng, gửi khiếu nại.',
    owner_admin: 'Đơn đang chờ chủ shop nhận hàng hoàn / kiểm hàng và cập nhật tình trạng thực tế.',
    owner: 'Hàng hoàn về shop – hãy xác nhận đã nhận chưa và hàng có đủ, nguyên vẹn không. Xếp theo hạn xử lý.',
    watch: 'Admin đang làm việc với Shopee / khách. Bạn chỉ cần theo dõi.',
    all: 'Tất cả hồ sơ chưa hoàn tất, xếp theo hạn xử lý.',
  };
  function renderQueue(all) {
    if (!isAdmin()) {
      $('#queue-tabs').innerHTML = '';
      $('#queue-tabs').style.display = 'none';
      const items = all.filter(isOpen).sort(byDue);
      $('#queue-hint').innerHTML = `Danh sách <b>${items.length} đơn hàng</b> hoàn / hủy cần theo dõi & kiểm tra tại kho. Bấm vào từng đơn để xem chi tiết từng bước.`;
      $('#queue-list').innerHTML = items.length ? items.map(cardHTML).join('') : `<div style="grid-column:1/-1">${emptyState('Không có đơn hàng nào cần kiểm tra lúc này. 🎉')}</div>`;
      return;
    }
    $('#queue-tabs').style.display = '';
    const tabs = queueTabs();
    if (!tabs.find((t) => t.k === queueTab)) queueTab = tabs[0].k;
    $('#queue-tabs').innerHTML = tabs.map((t) => `<button class="tab ${t.k === queueTab ? 'on' : ''}" data-tab="${t.k}" role="tab" type="button">${t.label}<span class="n">${all.filter(queueFilter(t.k)).length}</span></button>`).join('');
    $('#queue-hint').textContent = QUEUE_HINT[isAdmin() && queueTab === 'owner' ? 'owner_admin' : queueTab] || '';
    const items = all.filter(queueFilter(queueTab)).sort(byDue);
    $('#queue-list').innerHTML = items.length ? items.map(cardHTML).join('') : `<div style="grid-column:1/-1">${emptyState(queueTab === 'watch' ? 'Admin chưa có việc nào đang xử lý.' : 'Không có đơn nào cần xử lý. 🎉')}</div>`;
  }
  $('#queue-tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) { queueTab = b.dataset.tab; renderQueue(enriched()); } });

  // ---------------- Tất cả đơn ----------------
  const filters = { q: '', type: '', stage: 'open', kpi: '' };
  let casesLimit = 30;
  $('#f-stage').innerHTML = '<option value="">Mọi trạng thái</option><option value="open">Chưa hoàn tất</option>' + WF.STAGES.map((s) => `<option value="${s.key}">${s.name}</option>`).join('');
  function syncFilterUI() { $('#f-search').value = filters.q; $('#f-type').value = filters.type; $('#f-stage').value = filters.stage; }
  [['#f-search', 'q', 'input'], ['#f-type', 'type', 'change'], ['#f-stage', 'stage', 'change']].forEach(([sel, k, ev]) =>
    $(sel).addEventListener(ev, (e) => { filters[k] = e.target.value; filters.kpi = ''; casesLimit = 30; renderCases(enriched()); }));
  function renderCases(all) {
    let l = all;
    if (filters.kpi) { const k = KPIS.find((x) => x.key === filters.kpi); if (k) l = l.filter(k.fn); }
    if (filters.q) { const q = filters.q.toLowerCase(); l = l.filter((e) => haystack(e.c).includes(q)); }
    if (filters.type) l = l.filter((e) => e.c.type === filters.type);
    if (filters.stage === 'open') l = l.filter(isOpen); else if (filters.stage) l = l.filter((e) => e.stage === filters.stage);
    l = [...l].sort((a, b) => (isOpen(b) - isOpen(a)) || byDue(a, b));
    const kl = filters.kpi ? ` · lọc: <b>${KPIS.find((k) => k.key === filters.kpi)?.label}</b> <a href="#" id="clear-kpi">bỏ lọc</a>` : '';
    $('#cases-sub').innerHTML = `${l.length} đơn · tổng giá trị ${money(sum(l))}${kl}`;
    const ck = $('#clear-kpi'); if (ck) ck.addEventListener('click', (ev) => { ev.preventDefault(); filters.kpi = ''; renderCases(enriched()); });
    $('#cases-list').innerHTML = l.length ? l.slice(0, casesLimit).map(cardHTML).join('') : `<div style="grid-column:1/-1">${emptyState(all.length ? 'Không có đơn khớp bộ lọc.' : 'Chưa có dữ liệu.')}</div>`;
    $('#cases-more').innerHTML = l.length > casesLimit ? `<button class="btn" id="btn-more" type="button">Xem thêm ${Math.min(30, l.length - casesLimit)} đơn (còn ${l.length - casesLimit})</button>` : '';
    const mb = $('#btn-more'); if (mb) mb.addEventListener('click', () => { casesLimit += 30; renderCases(enriched()); });
  }

  // ---------------- Doanh số ----------------
  let salesPeriod = null;
  function renderSales() {
    const orders = Object.values(Store.state.sales.orders || {});
    const chips = $('#sales-chips'), body = $('#sales-body');
    if (!orders.length) {
      chips.innerHTML = '';
      body.innerHTML = `<div class="card card-pad">${emptyState('Chưa có dữ liệu doanh số.')}<p class="muted center" style="margin:0">${isAdmin() ? 'Vào <b>Tải file</b> và chọn file <b>Order.all</b> (tất cả đơn hàng xuất từ Shopee).' : 'Nhờ admin tải file “Tất cả đơn hàng” từ Shopee.'}</p>${isAdmin() ? '<div class="center"><button class="btn btn-primary" data-goto="upload" type="button">Tải file ngay</button></div>' : ''}</div>`;
      return;
    }
    const months = Sales.months(orders);
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!salesPeriod) salesPeriod = months.includes(cur) ? 'thisMonth' : `m:${months[0]}`;
    const openIds = new Set(Store.list().filter((c) => WF.stageOf(c) !== 'done').map((c) => c.orderId));
    const r = Sales.compute(orders, openIds, salesPeriod);
    const P = [['thisMonth', 'Tháng này'], ['lastMonth', 'Tháng trước'], ['d30', '30 ngày qua'], ['all', 'Tất cả']];
    chips.innerHTML = P.map(([k, t]) => `<button class="chip ${salesPeriod === k ? 'active' : ''}" data-period="${k}" type="button">${t}</button>`).join('') +
      `<select class="select" id="sales-month" style="width:auto;min-width:140px" aria-label="Chọn tháng"><option value="">Chọn tháng…</option>${months.map((m) => `<option value="${m}" ${salesPeriod === 'm:' + m ? 'selected' : ''}>Tháng ${m.slice(5)}/${m.slice(0, 4)}</option>`).join('')}</select>`;

    const T = r.totals, pct = (v) => (r.all.v ? Math.round((v / r.all.v) * 100) : 0);
    const hero = (label, color, v, sub) => `<div class="card hero" style="--hc:${color}"><div class="hero-label">${label}</div><div class="hero-value">${money(v)}</div><div class="hero-sub">${sub}</div></div>`;
    const maxBar = Math.max(1, ...r.chart.map((b) => b.all));
    const step = Math.max(1, Math.ceil(r.chart.length / 8));
    const bars = r.chart.map((b, i) => {
      const h = (v) => `${(v / maxBar) * 100}%`;
      const lab = i % step === 0 ? (r.monthly ? `${b.key.slice(5)}/${b.key.slice(2, 4)}` : b.key.slice(8)) : '';
      return `<div class="bar" title="${b.key}: ${money(b.all)}"><i style="height:${h(b.other)};background:var(--border-strong)"></i><i style="height:${h(b.received)};background:var(--blue)"></i><i style="height:${h(b.done)};background:var(--green)"></i><span>${lab}</span></div>`;
    }).join('');
    const brk = Sales.CAT_ORDER.filter((k) => T[k].n > 0 || ['done', 'received'].includes(k)).map((k) =>
      `<div class="brk-row"><div class="top"><span>${Sales.CAT_LABEL[k]} <span class="cnt">· ${T[k].n} đơn</span></span><b>${moneyShort(T[k].v)}</b></div><div class="bar-bg"><i style="width:${pct(T[k].v)}%;background:${Sales.CAT_COLOR[k]}"></i></div></div>`).join('');
    const rec = r.receivedList.slice(0, 12).map((o) => `<div class="ord-row"><div class="l"><div class="mono">${esc(o.id)}</div><div class="p">${dmy(o.d)} · ${esc((o.p || '').split('|')[0])}</div></div><b>${money(o.v)}</b></div>`).join('');
    body.innerHTML = `
      <div class="hero-grid">
        ${hero('Doanh số tất cả đơn', 'var(--brand-2)', r.all.v, `${r.all.n} đơn · ${r.label}<br>Trừ đơn hủy/hoàn: <b style="color:var(--text)">${money(r.net)}</b>`)}
        ${hero('Đã hoàn thành', 'var(--green)', T.done.v, `${T.done.n} đơn · ${pct(T.done.v)}% tổng doanh số<br>Shopee đã chốt hoàn thành`)}
        ${hero('Đã nhận hàng, chưa hoàn thành', 'var(--blue)', T.received.v, `${T.received.n} đơn · ${pct(T.received.v)}% tổng doanh số<br>Khách đã nhận, Shopee chưa chốt`)}
      </div>
      <div class="sales-grid">
        <div class="card card-pad"><div class="card-title">Doanh số theo ${r.monthly ? 'tháng' : 'ngày'} <small>${r.label}</small></div>
          <div class="bars">${bars || '<div class="muted">Không có đơn trong kỳ này</div>'}</div>
          <div class="legend"><span><i style="background:var(--green)"></i>Hoàn thành</span><span><i style="background:var(--blue)"></i>Đã nhận, chưa hoàn thành</span><span><i style="background:var(--border-strong)"></i>Khác</span></div></div>
        <div class="card card-pad"><div class="card-title">Theo trạng thái đơn</div><div class="brk">${brk}</div></div>
      </div>
      <div class="card card-pad"><div class="card-title">Đơn đã nhận, chưa hoàn thành <small>${T.received.n} đơn · ${moneyShort(T.received.v)}</small></div>
        ${rec || emptyState('Không có đơn nào.')}${r.receivedList.length > 12 ? `<div class="muted center" style="font-size:12.5px">… và ${r.receivedList.length - 12} đơn khác</div>` : ''}</div>
      <p class="sales-foot">Doanh số = “Tổng giá trị đơn hàng” trong file Shopee, tính theo <b>ngày đặt hàng</b>. Đơn đang có yêu cầu hoàn chưa đóng được xếp vào “Hoàn / trả hàng”.</p>`;
  }
  $('#sales-chips').addEventListener('click', (e) => { const b = e.target.closest('[data-period]'); if (b) { salesPeriod = b.dataset.period; renderSales(); } });
  $('#sales-chips').addEventListener('change', (e) => { if (e.target.id === 'sales-month' && e.target.value) { salesPeriod = 'm:' + e.target.value; renderSales(); } });

  // ---------------- Tải file (admin) ----------------
  const drop = $('#drop'), input = $('#file-input');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => handleFiles([...e.dataTransfer.files]));
  input.addEventListener('change', () => { handleFiles([...input.files]); input.value = ''; });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => { if (!drop.contains(e.target)) { e.preventDefault(); if (isAdmin() && e.dataTransfer.files.length) { go('upload'); handleFiles([...e.dataTransfer.files]); } } });

  async function handleFiles(files) {
    if (!isAdmin()) return;
    files = files.filter((f) => /\.(xlsx|xls|xlsm|csv)$/i.test(f.name));
    if (!files.length) return toast('Vui lòng chọn file Excel (.xlsx, .xls, .xlsm)', 'err');
    $('#import-result').innerHTML = `<div class="empty">Đang đọc ${files.length} file…</div>`;
    try {
      const parsed = await Parser.parseFiles(files);
      if (!parsed.cases.length && !parsed.overlays.length && !parsed.sales.length) {
        $('#import-result').innerHTML = `<div class="alert-box b-red">${ICON.alert}<div><b>Không nhận dạng được dữ liệu</b><span>${parsed.results.map((r) => esc(r.fileName) + (r.error ? ' – ' + esc(r.error) : '')).join('<br>')}<br>Hãy dùng file xuất gốc từ Shopee.</span></div></div>`;
        return;
      }
      const imp = await Store.importData(parsed, files.map((f) => f.name));
      renderImportResult(imp, parsed);
      renderAll();
      toast(imp.newIds.length ? `Có ${imp.newIds.length} đơn mới cần xử lý` : 'Đã cập nhật dữ liệu', 'ok');
    } catch (err) {
      console.error(err);
      $('#import-result').innerHTML = `<div class="alert-box b-red">${ICON.alert}<div><b>Lỗi tải file</b><span>${esc(err.message)}</span></div></div>`;
    }
  }
  const KIND_LABEL = { return: 'Trả hàng/Hoàn tiền', failed: 'Giao hàng thất bại', cancel: 'Đơn hủy', tracking: 'Theo dõi đơn (đồng bộ)', sales: 'Tất cả đơn (doanh số)' };
  function renderImportResult(imp, parsed) {
    const fileRows = parsed.results.map((r) => `<div class="log-item">${r.kinds.length ? '<span class="badge b-green">OK</span>' : '<span class="badge b-red">Bỏ qua</span>'}<span style="flex:1;word-break:break-all">${esc(r.fileName)}</span><span class="muted">${r.kinds.map((k) => `${KIND_LABEL[k.kind]} (${k.rows} dòng)`).join(' · ') || esc(r.error || 'Không nhận dạng được')}</span></div>`).join('');
    const hasCases = parsed.cases.length || parsed.overlays.length;
    const newList = imp.newIds.map((id) => Store.get(id)).filter(Boolean).map(E).sort(byDue);
    $('#import-result').innerHTML = `
      ${hasCases ? `<div class="res-stats">
        <div class="res-stat"><div class="n" style="color:var(--brand-2)">${imp.newIds.length}</div><div class="t">Đơn mới cần xử lý</div></div>
        <div class="res-stat"><div class="n" style="color:var(--yellow)">${imp.changedIds.length}</div><div class="t">Đơn cũ đổi trạng thái</div></div>
        <div class="res-stat"><div class="n" style="color:var(--text-2)">${imp.sameCount}</div><div class="t">Đã có – không đổi</div></div>
        <div class="res-stat"><div class="n" style="color:var(--text-3)">${imp.skipped}</div><div class="t">Hủy trước khi gửi (bỏ qua)</div></div></div>` : ''}
      ${parsed.sales.length ? `<div class="alert-box b-blue">${ICON.check}<div><b>Đã nạp ${parsed.sales.length} đơn vào báo cáo doanh số</b><span>${imp.salesAdded} đơn mới · ${imp.salesUpdated} đơn cập nhật. <a href="#" data-goto="sales">Xem doanh số</a></span></div></div>` : ''}
      ${imp.overlayCount ? `<div class="alert-box b-blue">${ICON.check}<div><b>Đã đồng bộ ${imp.overlayCount} hồ sơ từ file theo dõi</b><span>Trạng thái xử lý trong sheet “Theo dõi đơn” được giữ lại.</span></div></div>` : ''}
      <div class="card-title" style="margin-top:6px">File đã đọc</div>${fileRows}
      ${newList.length ? `<div class="card-title" style="margin-top:18px">Đơn mới <small>Bấm để xử lý</small></div>${newList.map(taskRow).join('')}` : ''}`;
  }
  function renderImportHistory() {
    const h = Store.state.imports;
    $('#import-history').innerHTML = h.length ? h.slice(0, 15).map((i) => `<div class="log-item"><span class="muted" style="min-width:110px">${esc(hm(i.at))}</span><span style="flex:1;word-break:break-all">${i.files.map(esc).join(', ')}</span><span class="badge b-new" style="${i.newIds.length ? '' : 'opacity:.35'}">${i.newIds.length} mới</span></div>`).join('') : emptyState('Chưa tải file nào.');
  }

  // ---------------- Chi tiết hồ sơ ----------------
  let openId = null;
  function openCase(id) {
    if (!Store.get(id)) return;
    openId = id;
    Store.markSeen(id);
    ownerForm = null;
    renderDrawer();
    $('#drawer').classList.add('open'); $('#overlay').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
    $('#drawer-body').scrollTop = 0;
    renderAll();
  }
  function closeDrawer() { openId = null; ownerForm = null; $('#drawer').classList.remove('open'); $('#overlay').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); }
  $('#overlay').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  const renderDrawer = () => (isAdmin() ? renderAdminDrawer() : renderOwnerDrawer());

  const kvRow = (k, v) => `<div><dt>${k}</dt><dd>${v || '<span class="muted">—</span>'}</dd></div>`;
  function drawerHead(c, e) {
    const rawUser = c.buyer || '';
    const username = rawUser ? `@${rawUser}` : esc(buyerName(c));
    $('#drawer-head').innerHTML = `<div class="row"><div style="min-width:0"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">${typeBadge(c)}<span class="who who-${e.who || 'done'}">${whoLabel(e.who)}</span></div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <h3 style="margin:0;font-family:var(--font-mono);font-size:20px;color:var(--brand-2)">${esc(username)}</h3>
        ${copyBtn(rawUser, 'username')}
      </div>
      <div class="sub" style="margin-top:3px">Người nhận: <b>${esc(buyerName(c))}</b> · Đơn: <span class="mono">${esc(c.orderId)}</span> · <b>${money(c.value)}</b></div></div>
      <button class="btn btn-ghost btn-sm close" id="drawer-close" type="button" aria-label="Đóng">${ICON.x}</button></div>`;
    $('#drawer-close').addEventListener('click', closeDrawer);
  }
  const dueBox = (e) => (e.due ? `<div class="due-box d-${e.due.lvl}"><div><b>Hạn xử lý: ${esc(e.due.label)}</b><div class="d">Ngày ${dmy(e.due.date)}</div></div><span class="pill p-${e.real.lvl}">${esc(e.real.text)}</span></div>` : `<div class="due-box d-green"><b>Hồ sơ đã hoàn tất</b><span class="pill p-${e.real.lvl}">${esc(e.real.text)}</span></div>`);
  function summaryKv(c, e) {
    const s = c.shopee || {}, m = c.m;
    return `<dl class="kv card card-pad" style="margin-bottom:14px">
      ${kvRow('Mã đơn hàng', `<span class="mono">${esc(c.orderId)}</span>`)}
      ${kvRow('Mã yêu cầu', `<span class="mono">${esc(reqCode(c))}</span>`)}
      ${kvRow('Trạng thái Shopee', esc(WF.shopeeText(c)))}
      ${kvRow('Trạng thái thực tế', `<span class="pill p-${e.real.lvl}">${esc(e.real.text)}</span>`)}
      ${kvRow('Hạn xử lý', dueHTML(e.due))}
      ${kvRow('Sản phẩm', esc(c.product) + (c.variation ? ` <span class="muted">(${esc(c.variation)})</span>` : ''))}
      ${kvRow('SL · Giá trị', `${esc(c.qty)} · <b>${money(c.value)}</b>`)}
      ${kvRow('Vận đơn hoàn', esc([c.returnCarrier, m.returnTracking || c.returnTracking].filter(Boolean).join(' · ')))}
      ${s.reason || s.buyerNote ? kvRow('Lý do khách', esc([s.reason, s.buyerNote].filter(Boolean).join(' – '))) : ''}
      ${s.cancelReason ? kvRow('Lý do hủy', esc(s.cancelReason)) : ''}
      ${s.returnSuccessAt ? kvRow('Shopee báo hoàn', `<b style="color:var(--orange)">${esc(hm(s.returnSuccessAt))}</b>`) : ''}
      ${kvRow('Địa chỉ / SĐT', esc([c.province, c.phone].filter(Boolean).join(' · ')))}
      ${m.note ? kvRow('Ghi chú admin', esc(m.note)) : ''}
    </dl>`;
  }
  function historyHTML(c, n) {
    const h = (c.history || []).slice(0, n);
    return h.length ? `<div class="section-title">Lịch sử</div><div class="timeline">${h.map((x) => `<div class="tl-item"><span class="tl-time">${esc(hm(x.at))}</span><span>${esc(x.text)}</span></div>`).join('')}</div>` : '';
  }

  // ----- Chủ shop: form cập nhật tình trạng thực tế -----
  const OWNER_CHOICES = [
    { k: 'ok', icon: '✅', title: 'Đã nhận hàng – đủ, nguyên vẹn', color: 'var(--green)' },
    { k: 'missing', icon: '📦', title: 'Đã nhận – THIẾU hàng / phụ kiện', color: 'var(--orange)' },
    { k: 'damaged', icon: '🔨', title: 'Đã nhận – HƯ HỎNG / bể vỡ', color: 'var(--orange)' },
    { k: 'wrong', icon: '🔁', title: 'Đã nhận – SAI hàng / bị tráo', color: 'var(--orange)' },
    { k: 'received', icon: '📥', title: 'Đã nhận hàng – chưa mở kiểm tra', color: 'var(--violet)' },
    { k: 'notreceived', icon: '❌', title: 'CHƯA nhận được hàng (dù Shopee báo hoàn)', color: 'var(--red)' },
  ];
  let ownerForm = null;
  function initOwnerForm(c) {
    const m = c.m;
    const choice = m.inspection || (m.received ? 'received' : null);
    ownerForm = { choice, date: m.received || WF.iso(new Date()), note: m.ownerNote || m.inspectionNote || '', evidence: m.evidence || '', forceInspect: false };
  }
  function renderOwnerDrawer() {
    const c = Store.get(openId); if (!c) return closeDrawer();
    const e = E(c), m = c.m, s = c.shopee || {};
    if (!ownerForm) initOwnerForm(c);
    const loc = WF.productLocation(c, S());

    // Drawer Header
    const rawUser = c.buyer || '';
    const username = rawUser ? `@${rawUser}` : '—';
    $('#drawer-head').innerHTML = `<div class="row">
      <div style="min-width:0">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          ${typeBadge(c)}
          <span class="badge" style="background:${loc.color};color:#fff;font-weight:700">${esc(loc.badge)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <h3 style="margin:0;font-family:var(--font-mono);font-size:20px;color:var(--brand-2)">${esc(username)}</h3>
          ${copyBtn(rawUser, 'username')}
        </div>
        <div class="sub" style="margin-top:3px">Người nhận: <b>${esc(c.receiver || c.buyer || '—')}</b> · Đơn: <span class="mono">${esc(c.orderId)}</span> · <b>${money(c.value)}</b></div>
      </div>
      <button class="btn btn-ghost btn-sm close" id="drawer-close" type="button" aria-label="Đóng">${ICON.x}</button>
    </div>`;
    $('#drawer-close').addEventListener('click', closeDrawer);

    // 1. Thông tin đơn hàng (Username là ID chính)
    const buyerFullName = c.receiver || c.buyer || '—';
    const prodName = c.product ? `${c.product}${c.variation ? ' (' + c.variation + ')' : ''}` : '—';
    const returnReason = s.reason || s.buyerNote || s.cancelReason || 'Không có ghi chú riêng';

    const infoSection = `<div class="card card-pad" style="margin-bottom:14px">
      <div class="section-title" style="margin-bottom:10px">📋 Thông tin đơn hàng</div>
      <dl class="kv">
        ${kvRow('Username (ID chính)', `
          <div style="display:inline-flex;align-items:center;gap:8px">
            <b class="mono" style="font-size:15.5px;color:var(--brand-2)">${esc(username)}</b>
            ${copyBtn(rawUser, 'username')}
          </div>
        `)}
        ${kvRow('Tên người mua', `<b>${esc(buyerFullName)}</b>`)}
        ${kvRow('Tên sản phẩm', esc(prodName))}
        ${kvRow('Doanh số đơn', `<b style="color:var(--brand);font-size:15px">${money(c.value)}</b>`)}
        ${kvRow('Tình trạng Shopee', esc(WF.shopeeText(c)))}
        ${kvRow('Lý do hoàn hàng', `<span style="color:var(--text)">${esc(returnReason)}</span>`)}
        ${kvRow('Mã đơn hàng', `
          <div style="display:inline-flex;align-items:center;gap:6px">
            <span class="mono">${esc(c.orderId)}</span>
            ${copyBtn(c.orderId, 'mã đơn')}
          </div>
        `)}
        ${c.complaintId ? kvRow('Mã yêu cầu', `<span class="mono">${esc(c.complaintId)}</span>`) : ''}
      </dl>
    </div>`;

    // 2. Hiện tại sản phẩm đang ở đâu (vị trí & hành trình)
    const locSection = `<div class="loc-card ${loc.isReturned ? 'returned' : 'returning'}">
      <div class="loc-head">
        <span class="loc-badge" style="background:${loc.color};color:#fff">${loc.icon} ${esc(loc.badge)}</span>
        ${dueHTML(e.due)}
      </div>
      <div class="loc-title">📍 Hiện tại sản phẩm đang ở đâu:</div>
      <div style="font-size:14.5px;font-weight:700;color:var(--text);margin-top:4px">${esc(loc.text)}</div>
      <div class="loc-sub">${esc(loc.sub)}</div>
    </div>`;

    // 3. Bước tiếp theo: Step-by-Step
    // Bước 1: Check đã nhắn tin với người mua chưa
    const hasContacted = m.contact && m.contact !== 'none';
    const step1HTML = `<div class="step-card" style="margin-bottom:14px;border-left:4px solid ${hasContacted ? 'var(--green)' : 'var(--yellow)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:15px;font-weight:800;color:var(--text)">
          <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:${hasContacted ? 'var(--green)' : 'var(--yellow)'};color:#fff;font-size:13px;margin-right:6px">1</span>
          Bước 1: Check đã nhắn tin với người mua chưa
        </div>
        <span class="pill ${hasContacted ? 'p-green' : 'p-yellow'}">${hasContacted ? 'Đã nhắn tin' : 'Chưa nhắn tin'}</span>
      </div>
      ${hasContacted ? `
        <div style="background:var(--green-soft);padding:10px 12px;border-radius:10px;font-size:13.5px;line-height:1.5">
          <div style="color:var(--green);font-weight:700">✔ Đã nhắn tin với người mua (${esc(WF.CONTACT[m.contact] || 'Đã liên hệ')})</div>
          ${m.contactAt ? `<div class="muted" style="font-size:12px;margin-top:2px">Thời gian: ${esc(hm(m.contactAt))}</div>` : ''}
          ${m.negotiation ? `<div style="margin-top:4px">Kết quả: <b>${esc(WF.NEGOTIATION[m.negotiation] || m.negotiation)}</b>${m.negotiationNote ? ' – ' + esc(m.negotiationNote) : ''}</div>` : ''}
        </div>
      ` : `
        <div style="background:var(--yellow-soft);padding:10px 12px;border-radius:10px;font-size:13.5px;line-height:1.5">
          <div style="color:var(--yellow);font-weight:700">⚠️ Chưa ghi nhận đã nhắn tin với người mua</div>
          <div style="display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap">
            <span style="font-size:13px">Username khách: <b class="mono" style="color:var(--brand-2);font-size:14px">${esc(username)}</b></span>
            ${copyBtn(rawUser, 'username')}
          </div>
          <p style="margin:4px 0 8px;font-size:13px;color:var(--text-2)">Sao chép username để tìm kiếm và nhắn tin trên Shopee, sau đó bấm xác nhận:</p>
          <button class="btn btn-sm btn-yellow" id="btn-owner-mark-contact" type="button" style="font-weight:700">💬 Đánh dấu ĐÃ NHẮN TIN với khách</button>
        </div>
      `}
    </div>`;

    // Bước 2: Kiểm tra hàng về kho
    const isReturnedToWarehouse = loc.isReturned || ownerForm.forceInspect;
    let step2HTML = '';

    if (isReturnedToWarehouse) {
      // Shopee hiển thị hàng ĐÃ hoàn về kho -> Kiểm tra kho, hư hỏng, thiếu hàng, hay chưa nhận
      const f = ownerForm;
      const needNote = ['missing', 'damaged', 'wrong'].includes(f.choice);
      step2HTML = `<div class="step-card" style="margin-bottom:14px;border-left:4px solid var(--brand)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:15px;font-weight:800;color:var(--text)">
            <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:var(--brand);color:#fff;font-size:13px;margin-right:6px">2</span>
            Bước 2: Kiểm tra hàng đã về kho chưa
          </div>
          <span class="pill p-orange">Shopee báo đã hoàn về</span>
        </div>
        <p style="font-size:13.5px;color:var(--text-2);margin:0 0 12px">Shopee hiển thị hàng <b>ĐÃ HOÀN VỀ KHO</b>. Vui lòng kiểm tra thực tế xem hàng đã về kho chưa, có hư hỏng, thiếu hàng hoặc chưa nhận được:</p>

        <div class="choices">
          ${OWNER_CHOICES.map((o) => `<button class="choice ${f.choice === o.k ? 'on' : ''}" style="--cc:${o.color}" data-choice="${o.k}" type="button"><span class="ci">${o.icon}</span><span>${o.title}</span></button>`).join('')}
        </div>

        ${f.choice ? `
          <div class="form-row two" style="margin-top:10px">
            ${f.choice !== 'notreceived' ? `<label class="field">Ngày nhận kiện hàng<input class="input" type="date" id="of-date" value="${esc(f.date)}"></label>` : ''}
            <label class="field">Link video / ảnh bóc kiện (nếu có)<input class="input" id="of-evidence" value="${esc(f.evidence)}" placeholder="Google Drive, Zalo…"></label>
          </div>
          <label class="field" style="margin-top:8px">${needNote ? 'Mô tả thiếu / hư hỏng / sai hàng (bắt buộc để khiếu nại)' : 'Ghi chú thêm (không bắt buộc)'}<textarea class="textarea" id="of-note" placeholder="${needNote ? 'VD: Vỡ nắp cối, thiếu dây nguồn, tráo thành sản phẩm khác…' : 'Ghi chú thêm cho admin…'}">${esc(f.note)}</textarea></label>
        ` : '<p class="muted" style="margin:0 0 10px;font-size:13px">👉 Chọn 1 trong các mục kiểm hàng phía trên để cập nhật kết quả.</p>'}

        <div class="sheet-actions" style="margin-top:14px">
          <button class="btn btn-primary btn-lg" id="of-save" type="button" ${f.choice ? '' : 'disabled'} style="font-weight:800;font-size:15px">💾 LƯU KẾT QUẢ KIỂM HÀNG</button>
        </div>
      </div>`;
    } else {
      // Shopee báo ĐANG hoàn hàng về -> Báo chờ tiếp đến khi Shopee đổi trạng thái
      step2HTML = `<div class="step-card" style="margin-bottom:14px;border-left:4px solid var(--blue)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:15px;font-weight:800;color:var(--text)">
            <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:var(--blue);color:#fff;font-size:13px;margin-right:6px">2</span>
            Bước 2: Kiểm tra hàng về kho
          </div>
          <span class="pill p-blue">Đang trên đường hoàn</span>
        </div>
        <div class="wait-box">
          <h4>⏳ Báo chờ tiếp – Đang hoàn hàng về</h4>
          <p>Shopee báo kiện hàng đang được đơn vị vận chuyển hoàn về shop${loc.exp ? ` (dự kiến về: <b>${esc(loc.exp)}</b>)` : ' (sau 2–3 ngày)'}.</p>
          <p><b>Chưa cần kiểm hàng tại kho lúc này.</b> Vui lòng tiếp tục chờ đến khi Shopee đổi trạng thái sang <u>"Đã hoàn về kho"</u> hoặc bưu tá mang hàng tới shop.</p>
          ${loc.carrier || loc.tracking ? `<div class="wait-details">ĐVVC: <b>${esc(loc.carrier || 'Shopee Express')}</b>${loc.tracking ? ` · Mã vận đơn: <span class="mono">${esc(loc.tracking)}</span>` : ''}</div>` : ''}
          <div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--border)">
            <button class="btn btn-sm btn-ghost" id="btn-owner-early-receive" type="button" style="border:1px dashed var(--border-strong);width:100%;color:var(--text-2)">📦 Bưu tá đã giao tới sớm? Bấm vào đây để kiểm hàng ngay</button>
          </div>
        </div>
      </div>`;
    }

    const savedNotice = m.ownerUpdatedAt ? `<div class="saved-box" style="margin-bottom:14px">✔ Bạn đã lưu cập nhật lúc <b>${esc(hm(m.ownerUpdatedAt))}</b>: <b>${esc(WF.INSPECTION[m.inspection] || (m.received ? 'Đã nhận hàng' : '—'))}</b>${m.ownerNote ? '<br>“' + esc(m.ownerNote) + '”' : ''}</div>` : '';

    $('#drawer-body').innerHTML = `${infoSection}${locSection}${savedNotice}${step1HTML}${step2HTML}${historyHTML(c, 5)}`;
  }
  function saveOwnerForm() {
    const c = Store.get(openId), f = ownerForm; if (!c || !f || !f.choice) return;
    const need = ['missing', 'damaged', 'wrong'].includes(f.choice);
    if (need && f.note.trim().length < 5) return toast('Vui lòng mô tả thiếu / hỏng (ít nhất vài chữ)', 'err');
    const today = WF.iso(new Date());
    const patch = {
      inspection: ['received'].includes(f.choice) ? '' : f.choice,
      received: f.choice === 'notreceived' ? '' : (f.date || today),
      inspectionNote: f.note.trim(), ownerNote: f.note.trim(), evidence: f.evidence.trim(),
    };
    const title = (OWNER_CHOICES.find((o) => o.k === f.choice) || {}).title || '';
    const p = Store.update(openId, patch, `Cập nhật thực tế: ${title}${f.note.trim() ? ' – ' + f.note.trim() : ''}`);
    closeDrawer(); renderAll();
    toast('Đã lưu kết quả kiểm hàng – Admin sẽ thấy ngay', 'ok');
    p.then(renderAll).catch((err) => { toast('Lưu lỗi: ' + err.message, 'err'); Store.refresh().then(renderAll).catch(() => {}); });
  }

  // ----- Admin: ngăn chi tiết đầy đủ -----
  const seg = (field, map, val) => `<div class="seg">${Object.entries(map).map(([k, label]) => `<button data-set="${field}" data-val="${k}" class="${(val || '') === k ? 'on' : ''}" type="button">${esc(label)}</button>`).join('')}</div>`;
  const inp = (field, val, type = 'text', ph = '') => `<input class="input" data-field="${field}" type="${type}" value="${esc(val || '')}" placeholder="${esc(ph)}">`;
  function renderAdminDrawer() {
    const c = Store.get(openId); if (!c) return closeDrawer();
    const e = E(c), m = c.m, stage = e.stage, alert = e.alert;
    drawerHead(c, e);
    const stepOf = { contact: 1, negotiate: 2, returning: 3, verify: 4, inspect: 4, complaint: 5, done: 6 }[stage];
    const cls = (n) => (n < stepOf ? 'done' : n === stepOf ? 'current' : '');
    const num = (n) => (stepOf > n ? small(ICON.check, 14) : n);
    const expected = WF.addDays(m.returnStart || d10(c.firstSeen), S().returnDays);
    const alertCls = { red: 'b-red', orange: 'b-orange', violet: 'b-violet', blue: 'b-blue', green: 'b-green', yellow: 'b-yellow' }[alert.lvl];
    const ownerBox = m.ownerUpdatedAt ? `<div class="saved-box">🏪 <b>Chủ shop đã cập nhật</b> lúc ${esc(hm(m.ownerUpdatedAt))}: <b>${esc(WF.INSPECTION[m.inspection] || (m.received ? 'Đã nhận hàng' : '—'))}</b>${m.ownerNote ? '<br>“' + esc(m.ownerNote) + '”' : ''}${m.evidence ? '<br>Bằng chứng: ' + esc(m.evidence) : ''}</div>` : '';

    $('#drawer-body').innerHTML = `
      ${dueBox(e)}
      <div class="alert-box ${alertCls}">${ICON.alert}<div><b>${esc(alert.text)}</b><span>${esc(alert.action)}</span></div></div>
      ${ownerBox}
      ${summaryKv(c, e)}

      <div class="steps">
        <div class="step ${cls(1)}"><div class="step-num">${num(1)}</div><div class="step-card">
          <h4>${small(ICON.msg, 16)} Nhắn khách ngay</h4>
          <p class="hint">${c.type === 'failed' ? 'Giao không thành công → nhắn người nhận lập tức để hẹn giao lại.' : 'Có yêu cầu hoàn/hủy → nhắn khách thương lượng (hỗ trợ kỹ thuật, đổi linh kiện…) trước khi chấp nhận hoàn.'}</p>
          ${seg('contact', WF.CONTACT, m.contact)}
          ${m.contactAt ? `<div class="muted" style="font-size:12px;margin-bottom:8px">Đã nhắn lúc ${esc(m.contactAt)}</div>` : ''}
          <div class="btn-row"><button class="btn btn-sm" data-act="toggle-tpl" data-tpl="contact" type="button">${small(ICON.copy)} Tin nhắn mẫu</button></div>
          <div class="template-box" id="tpl-contact" hidden>${esc(WF.contactTemplate(c, S().shopName))}</div>
        </div></div>

        <div class="step ${cls(2)}"><div class="step-num">${num(2)}</div><div class="step-card">
          <h4>Kết quả thương lượng</h4>
          <p class="hint">Thành công → hoàn tất. Không thành → chuyển sang theo dõi hàng hoàn.</p>
          ${seg('negotiation', WF.NEGOTIATION, m.negotiation)}
          <textarea class="textarea" data-field="negotiationNote" placeholder="Ghi chú trao đổi với khách…">${esc(m.negotiationNote)}</textarea>
        </div></div>

        <div class="step ${cls(3)}"><div class="step-num">${num(3)}</div><div class="step-card">
          <h4>${small(ICON.truck, 16)} Theo dõi hàng hoàn về</h4>
          <p class="hint">Hàng thường về sau 2–3 ngày. Quá hạn sẽ báo đỏ.</p>
          <div class="form-row">
            <label class="field">Ngày bắt đầu hoàn${inp('returnStart', m.returnStart, 'date')}</label>
            <label class="field">Mã vận đơn hoàn${inp('returnTracking', m.returnTracking || c.returnTracking, 'text', 'VD: GYRK79X9')}</label>
            <label class="field">Dự kiến về (+${S().returnDays} ngày)<div class="input" style="opacity:.8">${esc(expected) || '—'}</div></label>
          </div>
          <div class="btn-row"><button class="btn btn-sm btn-blue" data-act="start-return" type="button">Bắt đầu theo dõi hoàn hôm nay</button></div>
        </div></div>

        <div class="step ${cls(4)}"><div class="step-num">${num(4)}</div><div class="step-card">
          <h4>${small(ICON.box, 16)} Thực nhận & kiểm hàng <small class="muted">(chủ shop cập nhật; admin có thể sửa)</small></h4>
          <p class="hint">${WF.shopeeReturned(c) ? '<b style="color:var(--orange)">Shopee đã báo hoàn</b> – chỉ đóng khi kho thực sự nhận được. ' : ''}Quay video mở kiện liên tục, kiểm số lượng / tình trạng.</p>
          <div class="form-row two">
            <label class="field">Ngày shop thực nhận${inp('received', m.received, 'date')}</label>
            <label class="field">Link video / ảnh bằng chứng${inp('evidence', m.evidence, 'text', 'Google Drive, Zalo…')}</label>
          </div>
          ${seg('inspection', WF.INSPECTION, m.inspection)}
          <textarea class="textarea" data-field="inspectionNote" placeholder="Chi tiết thiếu / hỏng…">${esc(m.inspectionNote)}</textarea>
          <div class="btn-row" style="margin-top:8px">
            <button class="btn btn-sm btn-green" data-act="received-ok" type="button">Đã nhận đủ hôm nay</button>
            <button class="btn btn-sm btn-red" data-act="not-received" type="button">Không nhận được hàng</button>
          </div>
        </div></div>

        <div class="step ${cls(5)}"><div class="step-num">${num(5)}</div><div class="step-card">
          <h4>${small(ICON.shield, 16)} Khiếu nại & theo dõi</h4>
          <p class="hint">Thiếu / hư hỏng / không nhận được hàng → gửi khiếu nại kèm bằng chứng, đặt hạn theo dõi tiếp.</p>
          ${seg('complaint', WF.COMPLAINT, m.complaint)}
          <div class="form-row">
            <label class="field">Ngày gửi khiếu nại${inp('complaintAt', m.complaintAt, 'date')}</label>
            <label class="field">Hạn theo dõi tiếp${inp('followUp', m.followUp, 'date')}</label>
            <label class="field">Số tiền bồi thường${inp('compensation', m.compensation || '', 'number', '0')}</label>
          </div>
          <textarea class="textarea" data-field="complaintNote" placeholder="Mã phiếu khiếu nại, phản hồi của Shopee…">${esc(m.complaintNote)}</textarea>
          <div class="btn-row" style="margin-top:8px">
            <button class="btn btn-sm btn-primary" data-act="send-complaint" type="button">Đã gửi khiếu nại hôm nay</button>
            <button class="btn btn-sm" data-act="toggle-tpl" data-tpl="complaint" type="button">${small(ICON.copy)} Mẫu nội dung</button>
          </div>
          <div class="template-box" id="tpl-complaint" hidden>${esc(WF.complaintTemplate(c))}</div>
        </div></div>
      </div>

      <div class="step-card" style="margin-top:4px">
        <div class="form-row two">
          <label class="field">Người phụ trách${inp('owner', m.owner, 'text', 'Tên nhân viên')}</label>
          <label class="field">Ghi chú (chủ shop cũng xem được)${inp('note', m.note, 'text')}</label>
        </div>
        <div class="btn-row">
          ${m.closed || stage === 'done' ? `<button class="btn btn-sm" data-act="reopen" type="button">Mở lại hồ sơ</button>` : `<button class="btn btn-sm btn-green" data-act="close" type="button">${small(ICON.check)} Đóng hồ sơ</button>`}
          <button class="btn btn-sm btn-ghost" data-act="delete" type="button" style="margin-left:auto;color:var(--text-3)">Xóa hồ sơ</button>
        </div>
      </div>
      ${historyHTML(c, 12)}`;
  }

  const LABELS = { contact: WF.CONTACT, negotiation: WF.NEGOTIATION, inspection: WF.INSPECTION, complaint: WF.COMPLAINT };
  const FIELD_NAME = { returnStart: 'Ngày bắt đầu hoàn', returnTracking: 'Mã vận đơn hoàn', received: 'Ngày thực nhận', evidence: 'Bằng chứng', inspectionNote: 'Chi tiết kiểm hàng', complaintAt: 'Ngày gửi khiếu nại', followUp: 'Hạn theo dõi', compensation: 'Bồi thường', complaintNote: 'Ghi chú khiếu nại', owner: 'Người phụ trách', note: 'Ghi chú', negotiationNote: 'Ghi chú thương lượng' };
  function commit(patch, text) {
    const id = openId;
    const p = Store.update(id, patch, text);
    renderDrawer(); renderAll();
    p.then(() => {
      renderAll();
      const ae = document.activeElement;
      if (openId === id && !(ae && $('#drawer-body').contains(ae) && /INPUT|TEXTAREA/.test(ae.tagName))) renderDrawer();
    }).catch((err) => { toast('Lưu lỗi: ' + err.message, 'err'); Store.refresh().then(() => { renderAll(); if (openId) renderDrawer(); }).catch(() => {}); });
  }

  $('#drawer-body').addEventListener('click', (e) => {
    if (!openId) return;
    // --- chủ shop ---
    if (!isAdmin()) {
      if (e.target.closest('#btn-owner-mark-contact')) {
        commit({ contact: 'done', contactAt: WF.nowStr() }, 'Đã nhắn tin với người mua');
        toast('Đã ghi nhận: Đã nhắn tin với người mua', 'ok');
        return;
      }
      if (e.target.closest('#btn-owner-early-receive')) {
        if (!ownerForm) initOwnerForm(Store.get(openId));
        ownerForm.forceInspect = true;
        renderOwnerDrawer();
        return;
      }
      const ch = e.target.closest('[data-choice]');
      if (ch) { ownerForm.choice = ch.dataset.choice; renderOwnerDrawer(); return; }
      if (e.target.closest('#of-save')) return saveOwnerForm();
      if (e.target.closest('#of-cancel')) return closeDrawer();
      return;
    }
    // --- admin ---
    const b = e.target.closest('button'); if (!b || !isAdmin()) return;
    const c = Store.get(openId); const todayStr = WF.iso(new Date());
    if (b.dataset.set) {
      const f = b.dataset.set, v = b.dataset.val;
      const patch = { [f]: v };
      if (f === 'contact' && v === 'done' && !c.m.contactAt) patch.contactAt = WF.nowStr();
      if (f === 'negotiation' && v === 'return' && !c.m.returnStart) patch.returnStart = todayStr;
      if (f === 'complaint' && v === 'sent' && !c.m.complaintAt) { patch.complaintAt = todayStr; patch.followUp = WF.addDays(todayStr, S().followDays); }
      if (f === 'inspection' && v && !c.m.received && v !== 'notreceived') patch.received = todayStr;
      return commit(patch, `${f === 'contact' ? 'Liên hệ' : f === 'negotiation' ? 'Thương lượng' : f === 'inspection' ? 'Kiểm hàng' : 'Khiếu nại'}: ${LABELS[f][v]}`);
    }
    const act = b.dataset.act;
    if (act === 'toggle-tpl') { const box = $('#tpl-' + b.dataset.tpl); box.hidden = !box.hidden; if (!box.hidden) copy(box.textContent); return; }
    if (act === 'start-return') return commit({ returnStart: todayStr, negotiation: c.m.negotiation || 'return' }, 'Bắt đầu theo dõi hàng hoàn');
    if (act === 'received-ok') return commit({ received: todayStr, inspection: 'ok' }, 'Đã nhận hàng hoàn – đủ & nguyên vẹn');
    if (act === 'not-received') return commit({ inspection: 'notreceived', received: '' }, 'Xác nhận KHÔNG nhận được hàng hoàn');
    if (act === 'send-complaint') return commit({ complaint: 'sent', complaintAt: todayStr, followUp: WF.addDays(todayStr, S().followDays) }, 'Đã gửi khiếu nại');
    if (act === 'close') return commit({ closed: true, closedReason: 'Đóng thủ công' }, 'Đóng hồ sơ');
    if (act === 'reopen') return commit({ closed: false, closedReason: '', ...(['accepted', 'compensated', 'dropped'].includes(c.m.complaint) ? { complaint: 'processing' } : {}), ...(c.m.inspection === 'ok' ? { inspection: '' } : {}), ...(['accept', 'resolved'].includes(c.m.negotiation) ? { negotiation: '' } : {}) }, 'Mở lại hồ sơ');
    if (act === 'delete' && confirm('Xóa hồ sơ này? (Sẽ xuất hiện lại như đơn mới nếu tải lại file chứa đơn này)')) {
      const id = openId; closeDrawer();
      Store.remove(id).then(() => { renderAll(); toast('Đã xóa hồ sơ'); }).catch((err) => toast(err.message, 'err'));
    }
  });
  $('#drawer-body').addEventListener('change', (e) => {
    if (!openId) return;
    if (!isAdmin()) {
      if (e.target.id === 'of-date') ownerForm.date = e.target.value;
      return;
    }
    const f = e.target.dataset.field; if (!f) return;
    let v = e.target.value;
    if (f === 'compensation') v = Number(v) || 0;
    commit({ [f]: v }, `${FIELD_NAME[f] || f}: ${v || '(xóa)'}`);
  });
  $('#drawer-body').addEventListener('input', (e) => {
    if (isAdmin() || !ownerForm) return;
    if (e.target.id === 'of-note') ownerForm.note = e.target.value;
    else if (e.target.id === 'of-evidence') ownerForm.evidence = e.target.value;
  });

  // ---------------- Xuất Excel / Cài đặt (admin) ----------------
  function exportXlsx() {
    const all = enriched().sort(byDue);
    if (!all.length) return toast('Chưa có dữ liệu để xuất', 'err');
    const head = ['Mã theo dõi', 'Ngày mốc từ Shopee', 'Người mua', 'Mã đơn Shopee', 'Mã yêu cầu hoàn/hủy', 'Loại sự việc', 'Sản phẩm / SKU', 'SL', 'Giá trị đơn (VND)', 'SĐT', 'ĐVVC / mã vận đơn', 'Trạng thái Shopee', 'Trạng thái thực tế', 'Hạn xử lý', 'Ai xử lý', 'Đã nhắn khách?', 'Kết quả thương lượng', 'Ngày bắt đầu hoàn', 'Ngày thực nhận', 'Kiểm tra hàng thực tế', 'Chi tiết thiếu/hỏng / bằng chứng', 'Trạng thái khiếu nại', 'Ngày gửi khiếu nại', 'Hạn theo dõi tiếp', 'Người phụ trách', 'Việc cần làm tiếp'];
    const rows = all.map(({ c, alert, due, real, who }) => {
      const m = c.m;
      return [c.id, c.eventDate, buyerName(c), c.orderId, c.complaintId, WF.TYPE_LABEL[c.type], `${c.product}${c.sku ? ' | SKU: ' + c.sku : ''}`, c.qty, c.value, c.phone,
        [c.carrier, c.trackingOut && 'Đi: ' + c.trackingOut, (m.returnTracking || c.returnTracking) && 'Hoàn: ' + (m.returnTracking || c.returnTracking)].filter(Boolean).join(' | '),
        WF.shopeeText(c), real.text, due ? due.date : '', who === 'owner' ? 'Chủ shop' : who === 'admin' ? 'Admin' : 'Hoàn tất',
        WF.CONTACT[m.contact], (WF.NEGOTIATION[m.negotiation] || '') + (m.negotiationNote ? ' – ' + m.negotiationNote : ''),
        m.returnStart, m.received, WF.INSPECTION[m.inspection], [m.inspectionNote, m.evidence].filter(Boolean).join(' | '),
        WF.COMPLAINT[m.complaint], m.complaintAt, m.followUp, m.owner, alert.action];
    });
    const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
    ws['!cols'] = head.map((h, i) => ({ wch: [6, 22, 26, 20].includes(i) ? 22 : [11, 16, 20, 25].includes(i) ? 50 : 18 }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } }) };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Theo dõi đơn');
    XLSX.writeFile(wb, `Theo_doi_hang_hoan_${WF.iso(new Date()).replace(/-/g, '')}.xlsx`);
    toast('Đã xuất file Excel', 'ok');
  }
  $('#btn-export-xlsx').addEventListener('click', exportXlsx);

  const GUIDE = [
    ['Ai làm gì?', '<b>Admin</b>: tải file Shopee, nhắn khách, thương lượng, gửi khiếu nại với Shopee. <b>Chủ shop</b>: nhận hàng hoàn, kiểm hàng và cập nhật tình trạng thực tế trên điện thoại. Cả hai cùng thấy một dữ liệu.'],
    ['Admin tải file mỗi ngày', 'Xuất file từ Shopee (giao thất bại, trả hàng/hoàn tiền, đơn hủy, và <b>tất cả đơn</b> để tính doanh số) rồi tải vào app. App chỉ thêm đơn MỚI và ghi nhận thay đổi của đơn cũ.'],
    ['Nhắn khách & thương lượng', 'Đơn mới nằm ở “Admin cần làm”. Nhắn khách bằng tin mẫu. Khách đồng ý nhận/hủy → hoàn tất. Không thành → chuyển sang chờ hàng hoàn về.'],
    ['Chủ shop nhận hàng hoàn', 'Hàng hoàn về, chủ shop mở đơn → chọn Đủ / Thiếu / Hư hỏng / Sai hàng / Chưa nhận được. Admin thấy ngay kết quả, không cần hỏi lại.'],
    ['Shopee báo hoàn ≠ đã nhận', 'Khi Shopee báo “hoàn trả thành công”, đơn vẫn chờ chủ shop xác nhận đã thực nhận. Nếu chưa có hàng → chọn “Chưa nhận được hàng” để admin khiếu nại.'],
    ['Khiếu nại & hạn xử lý', `Thiếu/hỏng/không nhận được → admin gửi khiếu nại, app nhắc hạn theo dõi. Mỗi đơn có “Hạn xử lý” (hàng hoàn dự kiến ${S().returnDays} ngày) và báo đỏ khi quá hạn.`],
  ];
  function renderSettings() {
    $('#guide-grid').innerHTML = GUIDE.map(([t, d], i) => `<div class="card guide-step"><div class="gs-n">${i + 1}</div><h4>${t}</h4><p>${d}</p></div>`).join('');
    $('#set-return-days').value = S().returnDays; $('#set-follow-days').value = S().followDays;
    $('#set-shop').value = S().shopName; $('#set-owner').value = S().owner;
    const server = sess.mode === 'server';
    $('#share-card').hidden = !server; $('#pin-card').hidden = !server;
    if (server) {
      const urls = [...new Set([...(sess.lan || []), location.origin])];
      $('#share-links').innerHTML = urls.map((u) => `<div class="link-row"><input class="input" readonly value="${esc(u)}"><button class="btn btn-sm" data-copy="${esc(u)}" type="button">${small(ICON.copy)} Chép</button></div>`).join('');
      Store.getPins().then((p) => { $('#pin-admin').value = p.admin; $('#pin-owner').value = p.owner; }).catch(() => {});
    }
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-copy]'); if (b) copy(b.dataset.copy); });
  $('#btn-save-settings').addEventListener('click', async () => {
    try {
      await Store.setSettings({ returnDays: Math.max(1, +$('#set-return-days').value || 3), followDays: Math.max(1, +$('#set-follow-days').value || 3), shopName: $('#set-shop').value.trim() || 'Shop', owner: $('#set-owner').value.trim() });
      renderSettings(); renderAll(); toast('Đã lưu cài đặt', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  });
  $('#btn-save-pins').addEventListener('click', async () => {
    try { await Store.changePins($('#pin-admin').value.trim(), $('#pin-owner').value.trim()); toast('Đã đổi mã PIN', 'ok'); } catch (err) { toast(err.message, 'err'); }
  });
  $('#btn-backup').addEventListener('click', () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `saoluu_hanghoan_${WF.iso(new Date())}.json`; a.click();
  });
  $('#restore-input').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { await Store.importJSON(await f.text()); renderSettings(); renderAll(); toast('Đã khôi phục dữ liệu', 'ok'); } catch (err) { toast(err.message, 'err'); }
    e.target.value = '';
  });
  $('#btn-clear').addEventListener('click', async () => { if (confirm('Xóa TOÀN BỘ hồ sơ, doanh số và lịch sử? Nên sao lưu trước.')) { try { await Store.clearAll(); renderAll(); toast('Đã xóa dữ liệu'); } catch (err) { toast(err.message, 'err'); } } });
  $('#btn-reload-seed').addEventListener('click', async () => { if (confirm('Nạp lại dữ liệu gốc từ file .xlsm? Dữ liệu hiện tại sẽ bị thay thế.')) { try { Store.loadSeed(); await Store.pushAll(); renderSettings(); renderAll(); toast('Đã nạp lại dữ liệu gốc', 'ok'); } catch (err) { toast(err.message, 'err'); } } });

  // ---------------- Vai trò (chế độ xem thử khi mở file trực tiếp) ----------------
  $('#role-switch').addEventListener('click', (e) => {
    const b = e.target.closest('[data-role]'); if (!b) return;
    Store.setLocalRole(b.dataset.role); queueTab = null; closeDrawer(); buildNav(); renderAll(); go(defaultPage());
  });

  // ---------------- Đăng nhập / làm mới ----------------
  function showLogin(msg) {
    $('#app').hidden = true; $('#app').style.display = 'none';
    $('#login').hidden = false; $('#login').style.display = 'grid';
    $('#pin').value = ''; $('#login-error').textContent = msg || '';
    setTimeout(() => { if ($('#pin')) $('#pin').focus(); }, 60);
  }
  async function submitPin(pin) {
    $('#login-error').textContent = '';
    const btn = $('#login-btn'); btn.disabled = true;
    try {
      await Store.login(pin);
      startApp();
    } catch (err) {
      $('#login-error').textContent = err.message;
      if ($('#pin')) $('#pin').select();
    } finally {
      btn.disabled = false;
    }
  }
  $('#login-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const pin = ($('#pin').value || '').trim();
    if (!pin) { $('#login-error').textContent = 'Vui lòng chọn nút vào nhanh ở trên hoặc nhập mã PIN'; return; }
    submitPin(pin);
  });
  const bOwner = $('#btn-quick-owner');
  if (bOwner) bOwner.addEventListener('click', () => submitPin('5678'));
  const bAdmin = $('#btn-quick-admin');
  if (bAdmin) bAdmin.addEventListener('click', () => submitPin('1234'));
  $('#btn-logout').addEventListener('click', () => { Store.logout(); closeDrawer(); stopPolling(); showLogin(); });

  async function doRefresh(manual) {
    const btn = $('#btn-refresh');
    if (manual) btn.classList.add('spin');
    try {
      await Store.refresh();
      renderAll();
      if (manual) toast('Đã cập nhật dữ liệu mới nhất', 'ok');
    } catch (err) {
      if (err.status === 401) { stopPolling(); closeDrawer(); showLogin('Phiên đăng nhập đã hết, vui lòng nhập lại PIN'); }
      else if (manual) toast('Không kết nối được máy chủ', 'err');
    } finally { btn.classList.remove('spin'); }
  }
  $('#btn-refresh').addEventListener('click', () => doRefresh(true));
  let pollTimer = null;
  function startPolling() { stopPolling(); if (sess.mode === 'server') pollTimer = setInterval(() => { if (!document.hidden) doRefresh(false); }, 30000); }
  function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && sess.mode === 'server' && sess.role) doRefresh(false); });

  function startApp() {
    $('#login').hidden = true; $('#login').style.display = 'none';
    $('#app').hidden = false; $('#app').style.display = 'grid';
    queueTab = null;
    buildNav(); renderSettingsIfAdmin(); renderAll(); go(defaultPage()); startPolling();
  }
  const renderSettingsIfAdmin = () => { if (isAdmin()) renderSettings(); };

  // ---------------- Tiện ích ----------------
  function toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind; el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3200);
  }
  function copy(text) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Đã sao chép', 'ok')).catch(() => {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); toast('Đã sao chép', 'ok'); } catch (e) { /* ignore */ } t.remove();
    });
  }

  // ---------------- Khởi động ----------------
  (async function boot() {
    syncFilterUI();
    try { await Store.init(); }
    catch (err) { document.body.innerHTML = `<div style="padding:30px;color:#fff;font-family:sans-serif">Không tải được dữ liệu: ${esc(err.message)}</div>`; return; }
    if (!sess.role) showLogin(); else startApp();
  })();
})();
