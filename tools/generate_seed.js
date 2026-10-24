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
const xlsm = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\Shopee_Bao_Cao_Theo_Doi_Hang_Hoan_Da_Cap_Nhat.xlsm';

(async () => {
  const parsed = await ctx.Parser.parseFiles([fakeFile(xlsm)]);
  // New Store API
  const imp = ctx.Store.importData ? await ctx.Store.importData(parsed, ['Shopee_Bao_Cao_Theo_Doi_Hang_Hoan_Da_Cap_Nhat.xlsm']) : ctx.Store.merge(parsed, ['Shopee_Bao_Cao_Theo_Doi_Hang_Hoan_Da_Cap_Nhat.xlsm']);
  const state = ctx.Store.state;
  Object.values(state.cases).forEach((c) => { c.isNew = false; });
  state.dataAsOf = {
    importedAt: '2026-10-23 19:58',
    rangeStart: '2026-10-01',
    rangeEnd: '2026-10-23',
    files: ['Shopee_Bao_Cao_Theo_Doi_Hang_Hoan_Da_Cap_Nhat.xlsm']
  };
  const content = `/* Dữ liệu khởi tạo từ file Shopee_Bao_Cao_Theo_Doi_Hang_Hoan_Da_Cap_Nhat.xlsm */\nwindow.SEED_STATE = ${JSON.stringify(state, null, 2)};\n`;
  fs.writeFileSync(path.join(app, 'seed_data.js'), content, 'utf8');
  console.log('Seed data generated successfully with', Object.keys(state.cases).length, 'cases');
})();
