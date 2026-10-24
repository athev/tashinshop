// Headless test: load app modules with a fake window and run against real Shopee files
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');

const mem = {};
const ctx = { window: {}, XLSX, console, localStorage: { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; } } };
ctx.window = ctx; vm.createContext(ctx);
const app = path.join(__dirname, '..', 'HangHoanApp', 'js');
['workflow.js', 'parser.js', 'store.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(app, f), 'utf8'), ctx, { filename: f }));

const fakeFile = (p) => ({ name: path.basename(p), arrayBuffer: async () => { const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } });
const rawDir = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\ShopeeData\\Đơn hoàn hủy\\Order.return_refund_cancel.20261001_20261023';
const xlsm = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\Shopee_Bao_Cao_Theo_Doi_Hang_Hoan_Da_Cap_Nhat.xlsm';
const out = [];
const summary = (label) => {
  const all = ctx.Store.list();
  const counts = {};
  all.forEach((c) => { const s = ctx.WF.stageOf(c); counts[s] = (counts[s] || 0) + 1; });
  out.push(`\n## ${label}: ${all.length} cases`, JSON.stringify(counts));
  all.forEach((c) => { const a = ctx.WF.alertOf(c, ctx.Store.state.settings); out.push(`${c.id.padEnd(20)} ${c.type.padEnd(7)} ${ctx.WF.stageOf(c).padEnd(10)} ${a.text} | new=${c.isNew} | ${JSON.stringify(c.m).slice(0, 160)}`); });
};
(async () => {
  // 1) raw files
  const files = fs.readdirSync(rawDir).map((f) => fakeFile(path.join(rawDir, f)));
  let parsed = await ctx.Parser.parseFiles(files);
  out.push('kinds: ' + JSON.stringify(parsed.results.map((r) => [r.fileName, r.kinds, r.error])));
  out.push('skipped: ' + parsed.skipped.length);
  let imp = ctx.Store.merge(parsed, files.map((f) => f.name));
  out.push('import1: ' + JSON.stringify({ new: imp.newIds.length, changed: imp.changedIds.length, same: imp.sameCount }));
  summary('After raw');
  // 2) re-import same → no new
  parsed = await ctx.Parser.parseFiles(files);
  imp = ctx.Store.merge(parsed, ['again']);
  out.push('import2 (same files): ' + JSON.stringify({ new: imp.newIds.length, changed: imp.changedIds.length, same: imp.sameCount }));
  // 3) fresh store with xlsm
  ctx.Store.clearAll();
  parsed = await ctx.Parser.parseFiles([fakeFile(xlsm)]);
  out.push('xlsm kinds: ' + JSON.stringify(parsed.results.map((r) => r.kinds)));
  imp = ctx.Store.merge(parsed, ['xlsm']);
  out.push('import xlsm: ' + JSON.stringify({ new: imp.newIds.length, overlay: imp.overlayCount }));
  summary('After xlsm');
  fs.writeFileSync(process.argv[2], out.join('\n'), 'utf8');
})().catch((e) => { fs.writeFileSync(process.argv[2], 'ERR ' + e.stack, 'utf8'); });
