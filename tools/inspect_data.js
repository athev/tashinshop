const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dir = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\ShopeeData\\Đơn hoàn hủy\\Order.return_refund_cancel.20261001_20261023';

const files = fs.readdirSync(dir);
console.log('Files found:', files);

files.forEach(file => {
  if (!file.match(/\.(xlsx|xls)$/i)) return;
  const filePath = path.join(dir, file);
  console.log('\n======================================================');
  console.log('FILE:', file);
  const workbook = XLSX.readFile(filePath);
  console.log('Sheet names:', workbook.SheetNames);
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`--- Sheet: ${sheetName} ---`);
    console.log(`Total rows: ${data.length}`);
    if (data.length > 0) {
      console.log('Header row (Row 0):', JSON.stringify(data[0]));
      if (data.length > 1) {
        console.log('Sample row 1:', JSON.stringify(data[1]));
      }
      if (data.length > 2) {
        console.log('Sample row 2:', JSON.stringify(data[2]));
      }
    }
  });
});
