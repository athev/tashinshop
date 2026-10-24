/* ==========================================================
   api/index.js — Vercel Serverless Function kết nối Upstash Redis / Vercel KV
   Hỗ trợ lưu trữ đám mây cho toàn bộ ứng dụng Theo dõi Hàng Hoàn & Doanh số Shopee
   ========================================================== */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// Giao tiếp với Redis REST API qua native fetch (Zero dependency)
async function redis(command, ...args) {
  if (!REST_URL || !REST_TOKEN) return null;
  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command, ...args]),
    cache: 'no-store',
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Upstash error (${res.status}): ${errText}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

const DEFAULT_CONFIG = { pins: { admin: '1234', owner: '5678' } };
const DEFAULT_SETTINGS = { returnDays: 3, followDays: 3, shopName: 'Shop Khánh Phong', owner: '' };
const OWNER_FIELDS = ['received', 'inspection', 'inspectionNote', 'evidence', 'ownerNote'];
const ROLE_NAME = { admin: 'Admin', owner: 'Chủ shop' };

const p2 = (n) => String(n).padStart(2, '0');
const nowStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

// Đọc dữ liệu từ Redis
async function getRedisJson(key, def) {
  try {
    const raw = await redis('GET', key);
    if (!raw) return def;
    return typeof raw === 'object' ? raw : JSON.parse(raw);
  } catch (e) {
    console.error('getRedisJson error for key', key, e.message);
    return def;
  }
}

// Ghi dữ liệu vào Redis
async function setRedisJson(key, val) {
  return await redis('SET', key, JSON.stringify(val));
}

// Khởi tạo state mặc định (có nạp dữ liệu hạt giống ban đầu)
function getInitialSeed() {
  const st = { cases: {}, imports: [], settings: { ...DEFAULT_SETTINGS }, dataAsOf: null, rev: 1 };
  try {
    const seedPath = path.join(process.cwd(), 'HangHoanApp', 'js', 'seed_data.js');
    if (fs.existsSync(seedPath)) {
      const sandbox = { window: {} };
      vm.runInNewContext(fs.readFileSync(seedPath, 'utf8'), sandbox);
      if (sandbox.window.SEED_STATE) Object.assign(st, sandbox.window.SEED_STATE);
    }
  } catch (e) {
    console.error('Seed load error', e.message);
  }
  return st;
}

// Helper trả về JSON response
function sendJson(res, code, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(code).send(JSON.stringify(obj));
}

// Đọc body của request
async function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

// Main Vercel Serverless Handler
module.exports = async function handler(req, res) {
  // CORS nếu cần
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Chuẩn hóa đường dẫn pathname (loại bỏ query)
  const fullUrl = req.url || '';
  const pathname = fullUrl.split('?')[0].replace(/^\/api/, '') || '/';

  // 1. Kiểm tra trạng thái kết nối Cloud Database
  if (pathname === '/ping' || pathname === '') {
    if (!REST_URL || !REST_TOKEN) {
      return sendJson(res, 200, {
        ok: false,
        cloud: false,
        message: 'Chưa cấu hình Upstash Redis trên Vercel. Ứng dụng đang chạy chế độ Offline/Local.',
      });
    }
    try {
      await redis('PING');
      return sendJson(res, 200, { ok: true, cloud: true, message: 'Đã kết nối Database Upstash Redis đám mây.' });
    } catch (e) {
      return sendJson(res, 200, { ok: false, cloud: false, error: e.message });
    }
  }

  // Nếu chưa cấu hình DB, báo lỗi yêu cầu cấu hình
  if (!REST_URL || !REST_TOKEN) {
    return sendJson(res, 503, {
      error: 'Chưa liên kết Upstash Redis / Vercel KV trên Vercel. Vui lòng thêm biến UPSTASH_REDIS_REST_URL và UPSTASH_REDIS_REST_TOKEN.',
    });
  }

  // Tải cấu hình và phiên
  let config = await getRedisJson('kp:config', null);
  if (!config || !config.pins) {
    config = DEFAULT_CONFIG;
    await setRedisJson('kp:config', config);
  }

  let tokens = await getRedisJson('kp:tokens', {});

  // 2. Đăng nhập
  if (pathname === '/login' && req.method === 'POST') {
    const { pin } = await getBody(req);
    const role = (pin && String(pin) === String(config.pins.admin)) ? 'admin'
      : (pin && String(pin) === String(config.pins.owner)) ? 'owner' : null;

    if (!role) {
      return sendJson(res, 401, { error: 'Mã PIN không đúng (mặc định: admin 1234, chủ shop 5678)' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    // Dọn dẹp token hết hạn
    for (const [t, d] of Object.entries(tokens)) {
      if (!d || d.exp < now) delete tokens[t];
    }
    tokens[token] = { role, exp: now + 30 * 86400e3 };
    await setRedisJson('kp:tokens', tokens);

    return sendJson(res, 200, { token, role });
  }

  // 3. Xác thực Bearer Token
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const sessionUser = tokens[token];

  if (!sessionUser || sessionUser.exp < Date.now()) {
    return sendJson(res, 401, { error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' });
  }
  const me = { ...sessionUser, token };

  const needAdmin = () => {
    if (me.role !== 'admin') {
      sendJson(res, 403, { error: 'Chỉ Admin mới có quyền thực hiện thao tác này' });
      return false;
    }
    return true;
  };

  // 4. Đăng xuất
  if (pathname === '/logout' && req.method === 'POST') {
    delete tokens[me.token];
    await setRedisJson('kp:tokens', tokens);
    return sendJson(res, 200, { ok: true });
  }

  // 5. Tải toàn bộ State & Sales
  if (pathname === '/state' && req.method === 'GET') {
    let state = await getRedisJson('kp:state', null);
    if (!state || !state.cases) {
      state = getInitialSeed();
      await setRedisJson('kp:state', state);
    }
    const sales = await getRedisJson('kp:sales', { orders: {}, meta: null });
    return sendJson(res, 200, { role: me.role, state, sales });
  }

  // 6. Cập nhật State (Admin)
  if (pathname === '/state' && req.method === 'PUT') {
    if (!needAdmin()) return;
    const b = await getBody(req);
    if (!b.cases || typeof b.cases !== 'object') return sendJson(res, 400, { error: 'Dữ liệu không hợp lệ' });

    let state = await getRedisJson('kp:state', getInitialSeed());
    state = {
      cases: b.cases,
      imports: b.imports || [],
      settings: { ...state.settings, ...(b.settings || {}) },
      dataAsOf: b.dataAsOf || null,
      rev: (state.rev || 0) + 1,
    };
    await setRedisJson('kp:state', state);
    return sendJson(res, 200, { ok: true, rev: state.rev });
  }

  // 7. Cập nhật Doanh số Sales (Admin)
  if (pathname === '/sales' && req.method === 'PUT') {
    if (!needAdmin()) return;
    const b = await getBody(req);
    const sales = { orders: b.orders || {}, meta: b.meta || null };
    await setRedisJson('kp:sales', sales);
    return sendJson(res, 200, { ok: true });
  }

  // 8. Cập nhật Cài đặt Settings (Admin)
  if (pathname === '/settings' && req.method === 'PUT') {
    if (!needAdmin()) return;
    const b = await getBody(req);
    let state = await getRedisJson('kp:state', getInitialSeed());
    state.settings = { ...state.settings, ...(b.settings || {}) };
    await setRedisJson('kp:state', state);
    return sendJson(res, 200, { ok: true });
  }

  // 9. Quản lý PIN (Admin)
  if (pathname === '/pins' && req.method === 'GET') {
    if (!needAdmin()) return;
    return sendJson(res, 200, { pins: config.pins });
  }

  if (pathname === '/pins' && req.method === 'PUT') {
    if (!needAdmin()) return;
    const { admin, owner } = await getBody(req);
    const ok = (s) => /^\d{4,8}$/.test(String(s || ''));
    if (!ok(admin) || !ok(owner)) return sendJson(res, 400, { error: 'Mã PIN gồm 4–8 chữ số' });
    if (admin === owner) return sendJson(res, 400, { error: 'Mã PIN Admin và Chủ shop phải khác nhau' });

    config.pins = { admin: String(admin), owner: String(owner) };
    await setRedisJson('kp:config', config);

    // Đăng xuất các thiết bị khác ngoại trừ thiết bị đang thực hiện
    tokens = { [me.token]: tokens[me.token] };
    await setRedisJson('kp:tokens', tokens);

    return sendJson(res, 200, { ok: true });
  }

  // 10. Đánh dấu đã xem (Admin)
  if (pathname === '/seen' && req.method === 'POST') {
    if (!needAdmin()) return;
    const { ids, all } = await getBody(req);
    let state = await getRedisJson('kp:state', getInitialSeed());
    Object.values(state.cases || {}).forEach((c) => {
      if (all || (ids || []).includes(c.id)) {
        c.isNew = false;
        c.updatedFlag = '';
      }
    });
    await setRedisJson('kp:state', state);
    return sendJson(res, 200, { ok: true });
  }

  // 11. Thao tác trên từng hồ sơ đơn hàng (/case/:id)
  const caseMatch = pathname.match(/^\/case\/(.+)$/);
  if (caseMatch) {
    const id = decodeURIComponent(caseMatch[1]);
    let state = await getRedisJson('kp:state', getInitialSeed());
    const c = (state.cases || {})[id];
    if (!c) return sendJson(res, 404, { error: 'Không tìm thấy hồ sơ' });

    if (req.method === 'DELETE') {
      if (!needAdmin()) return;
      delete state.cases[id];
      await setRedisJson('kp:state', state);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'PATCH') {
      const { patch = {}, logs = [] } = await getBody(req);
      c.m = c.m || {};
      for (const [k, v] of Object.entries(patch)) {
        if (me.role === 'owner' && !OWNER_FIELDS.includes(k)) continue;
        c.m[k] = v;
      }
      const now = nowStr();
      if (me.role === 'owner') {
        c.m.ownerUpdatedAt = now;
        c.updatedFlag = now;
      }
      c.history = c.history || [];
      for (const t of [...logs].reverse()) {
        c.history.unshift({ at: now, text: `[${ROLE_NAME[me.role]}] ${t}`, by: me.role });
      }
      if (c.history.length > 80) c.history.length = 80;
      state.rev = (state.rev || 0) + 1;
      await setRedisJson('kp:state', state);
      return sendJson(res, 200, { case: c });
    }
  }

  return sendJson(res, 404, { error: 'Không tìm thấy API' });
};
