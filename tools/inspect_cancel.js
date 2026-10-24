const XLSX = require('xlsx');
const fs = require('fs');
const f = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\ShopeeData\\Đơn hoàn hủy\\Order.return_refund_cancel.20261001_20261023\\Order.cancelled.20261001_20261023_part_1_of_1.xlsx';
const rows = XLSX.utils.sheet_to_json(XLSX.readFile(f).Sheets['orders'], { header: 1, defval: '' });
const h = rows[0];
const ix = n => h.indexOf(n);
const out = rows.slice(1).map(r => [r[0], r[ix('Lý do hủy')].replace('lí do là: ', ''), 'VD=' + r[ix('Mã vận đơn')], 'gửi=' + r[ix('Ngày gửi hàng')], 'giao=' + r[ix('Thời gian giao hàng')], 'dk=' + r[ix('Ngày giao hàng dự kiến')]].join(' | '));
fs.writeFileSync(process.argv[2], out.join('\n'), 'utf8');
