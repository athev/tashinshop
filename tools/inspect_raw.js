const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const dir = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\ShopeeData\\Đơn hoàn hủy\\Order.return_refund_cancel.20261001_20261023';
const out = [];
fs.readdirSync(dir).forEach(file => {
  const wb = XLSX.readFile(path.join(dir, file));
  wb.SheetNames.forEach(n => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
    out.push(`\n=== ${file} / ${n} (${rows.length} rows)`);
    rows.slice(0, 3).forEach((r, i) => out.push(i + ' ' + JSON.stringify(r)));
    // unique values of status-like columns
    const h = rows[0] || [];
    h.forEach((col, ci) => {
      if (/Trạng|Lí do|Lý do|Phương án/i.test(col)) {
        const set = new Set(rows.slice(1).map(r => r[ci]));
        out.push(`  [${ci}] ${col}: ${JSON.stringify([...set])}`);
      }
    });
  });
});
fs.writeFileSync(process.argv[2], out.join('\n'), 'utf8');
