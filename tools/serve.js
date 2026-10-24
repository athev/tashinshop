/* ==========================================================
   Máy chủ dùng chung cho app Theo dõi Hàng Hoàn (Admin + Chủ shop)
   Chạy:  node serve.js     (hoặc bấm Chay_HangHoanApp.bat)
   - Lưu dữ liệu ở ../HangHoanData (ngoài thư mục web, không bị tải về)
   - Đăng nhập bằng mã PIN: admin (sửa mọi thứ) / chủ shop (cập nhật tình trạng thực tế)
   - Chỉ phục vụ thư mục ../HangHoanApp
   ========================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3838;
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'HangHoanApp');
const DATA = path.join(ROOT, 'HangHoanData');
fs.mkdirSync(DATA, { recursive: true });

// ---------- Lưu trữ JSON ----------
const read = (n, def) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, n), 'utf8')); } catch (e) { return def; } };
const write = (n, obj) => {
  const p = path.join(DATA, n);
  try {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('Lỗi ghi file ' + n + ':', err.message);
  }
};

let config = read('config.json', null);
if (!config) { config = { pins: { admin: '1234', owner: '5678' } }; write('config.json', config); }

let state = read('state.json', null);
if (!state) {
  state = { cases: {}, imports: [], settings: { returnDays: 3, followDays: 3, shopName: 'Shop Khánh Phong', owner: '' }, dataAsOf: null, rev: 1 };
  try { // lần đầu: nạp dữ liệu khởi tạo từ file .xlsm
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(APP, 'js', 'seed_data.js'), 'utf8'), sandbox);
    if (sandbox.window.SEED_STATE) state = { ...state, ...sandbox.window.SEED_STATE, rev: 1 };
  } catch (e) { /* không có seed */ }
  write('state.json', state);
}
let sales = read('sales.json', { orders: {}, meta: null });
let tokens = read('tokens.json', {});

const p2 = (n) => String(n).padStart(2, '0');
const nowStr = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const ROLE_NAME = { admin: 'Admin', owner: 'Chủ shop' };
const OWNER_FIELDS = ['received', 'inspection', 'inspectionNote', 'evidence', 'ownerNote'];

// ---------- Tiện ích HTTP ----------
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const readBody = (req) => new Promise((ok, no) => {
  let n = 0; const ch = [];
  req.on('data', (d) => { n += d.length; if (n > 80e6) { no(new Error('Dữ liệu quá lớn')); req.destroy(); } else ch.push(d); });
  req.on('end', () => { try { ok(ch.length ? JSON.parse(Buffer.concat(ch).toString('utf8')) : {}); } catch (e) { no(new Error('JSON không hợp lệ')); } });
  req.on('error', no);
});
const lanUrls = () => Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${PORT}`);

// ---------- Xác thực ----------
const fails = {};
function auth(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  const e = tokens[t];
  return e && e.exp > Date.now() ? { ...e, token: t } : null;
}
const needAdmin = (me, res) => { if (me.role !== 'admin') { json(res, 403, { error: 'Chỉ admin được thực hiện' }); return false; } return true; };

async function api(req, res, p) {
  if (p === '/api/ping') return json(res, 200, { ok: true, lan: lanUrls() });

  if (p === '/api/login' && req.method === 'POST') {
    const ip = req.socket.remoteAddress;
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    const f = fails[ip] || { n: 0, until: 0 };
    if (!isLocal && f.until > Date.now()) return json(res, 429, { error: 'Nhập sai nhiều lần, thử lại sau 30 giây' });
    const { pin } = await readBody(req);
    const role = pin && pin === config.pins.admin ? 'admin' : pin && pin === config.pins.owner ? 'owner' : null;
    if (!role) {
      if (!isLocal) {
        f.n++; if (f.n >= 10) { f.until = Date.now() + 30000; f.n = 0; }
        fails[ip] = f;
      }
      return json(res, 401, { error: 'Mã PIN không đúng (mặc định: admin 1234, chủ shop 5678)' });
    }
    fails[ip] = { n: 0, until: 0 };
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    for (const [t, d] of Object.entries(tokens)) { if (!d || d.exp < now) delete tokens[t]; }
    tokens[token] = { role, exp: now + 30 * 86400e3 };
    write('tokens.json', tokens);
    return json(res, 200, { token, role });
  }

  const me = auth(req);
  if (!me) return json(res, 401, { error: 'Chưa đăng nhập' });

  if (p === '/api/logout' && req.method === 'POST') { delete tokens[me.token]; write('tokens.json', tokens); return json(res, 200, { ok: true }); }
  if (p === '/api/state' && req.method === 'GET') return json(res, 200, { role: me.role, state, sales });

  if (p === '/api/state' && req.method === 'PUT') {
    if (!needAdmin(me, res)) return;
    const b = await readBody(req);
    if (!b.cases || typeof b.cases !== 'object') return json(res, 400, { error: 'Dữ liệu không hợp lệ' });
    state = { cases: b.cases, imports: b.imports || [], settings: { ...state.settings, ...(b.settings || {}) }, dataAsOf: b.dataAsOf || null, rev: (state.rev || 0) + 1 };
    write('state.json', state);
    return json(res, 200, { ok: true, rev: state.rev });
  }
  if (p === '/api/sales' && req.method === 'PUT') {
    if (!needAdmin(me, res)) return;
    const b = await readBody(req);
    sales = { orders: b.orders || {}, meta: b.meta || null };
    write('sales.json', sales);
    return json(res, 200, { ok: true });
  }
  if (p === '/api/settings' && req.method === 'PUT') {
    if (!needAdmin(me, res)) return;
    const b = await readBody(req);
    state.settings = { ...state.settings, ...(b.settings || {}) };
    write('state.json', state);
    return json(res, 200, { ok: true });
  }
  if (p === '/api/pins' && req.method === 'PUT') {
    if (!needAdmin(me, res)) return;
    const { admin, owner } = await readBody(req);
    const ok = (s) => /^\d{4,8}$/.test(String(s || ''));
    if (!ok(admin) || !ok(owner)) return json(res, 400, { error: 'PIN gồm 4–8 chữ số' });
    if (admin === owner) return json(res, 400, { error: 'PIN admin và chủ shop phải khác nhau' });
    config.pins = { admin: String(admin), owner: String(owner) };
    write('config.json', config);
    tokens = { [me.token]: tokens[me.token] }; // đăng xuất các thiết bị khác
    write('tokens.json', tokens);
    return json(res, 200, { ok: true });
  }
  if (p === '/api/pins' && req.method === 'GET') {
    if (!needAdmin(me, res)) return;
    return json(res, 200, { pins: config.pins });
  }
  if (p === '/api/seen' && req.method === 'POST') {
    if (!needAdmin(me, res)) return;
    const { ids, all } = await readBody(req);
    Object.values(state.cases).forEach((c) => { if (all || (ids || []).includes(c.id)) { c.isNew = false; c.updatedFlag = ''; } });
    write('state.json', state);
    return json(res, 200, { ok: true });
  }

  const m = p.match(/^\/api\/case\/(.+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const c = state.cases[id];
    if (!c) return json(res, 404, { error: 'Không tìm thấy hồ sơ' });
    if (req.method === 'DELETE') {
      if (!needAdmin(me, res)) return;
      delete state.cases[id]; write('state.json', state);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'PATCH') {
      const { patch = {}, logs = [] } = await readBody(req);
      c.m = c.m || {};
      for (const [k, v] of Object.entries(patch)) {
        if (me.role === 'owner' && !OWNER_FIELDS.includes(k)) continue;
        c.m[k] = v;
      }
      const now = nowStr();
      if (me.role === 'owner') { c.m.ownerUpdatedAt = now; c.updatedFlag = now; }
      c.history = c.history || [];
      for (const t of [...logs].reverse()) c.history.unshift({ at: now, text: `[${ROLE_NAME[me.role]}] ${t}`, by: me.role });
      if (c.history.length > 80) c.history.length = 80;
      state.rev = (state.rev || 0) + 1;
      write('state.json', state);
      return json(res, 200, { case: c });
    }
  }
  return json(res, 404, { error: 'Không tìm thấy API' });
}

// ---------- File tĩnh (chỉ thư mục HangHoanApp) ----------
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
};
function serveStatic(req, res, p) {
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(APP, p));
  if (!file.startsWith(APP + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': `${MIME[ext] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.startsWith('/api/')) return await api(req, res, p);
    serveStatic(req, res, p);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: e.message });
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log('\n=== Theo dõi Hàng Hoàn Shopee – Khánh Phong ===');
  console.log(`Trên máy này:         http://localhost:${PORT}/`);
  lanUrls().forEach((u) => console.log(`Điện thoại (cùng wifi): ${u}/`));
  console.log(`PIN hiện tại: admin ${config.pins.admin} · chủ shop ${config.pins.owner}  (đổi trong Cài đặt)`);
  console.log(`Dữ liệu lưu tại:      ${DATA}\n`);
});
