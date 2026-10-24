const XLSX = require('xlsx');
const fs = require('fs');
const out = [];
const log = (...a) => out.push(a.join(' '));
const wb = XLSX.readFile('C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\Shopee_Bao_Cao_Theo_Doi_Hang_Hoan_Da_Cap_Nhat.xlsm');
log('Sheets:', JSON.stringify(wb.SheetNames));
wb.SheetNames.forEach(n => {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
  log(`\n=== ${n} (${rows.length} rows) ref=${wb.Sheets[n]['!ref']}`);
  const limit = /nguồn/i.test(n) ? 3 : 15;
  rows.slice(0, limit).forEach((r, i) => log(i, JSON.stringify(r).slice(0, 2500)));
});
fs.writeFileSync(process.argv[2], out.join('\n'), 'utf8');
