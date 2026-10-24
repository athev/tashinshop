const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dir = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\ShopeeData\\Đơn hoàn hủy\\Order.return_refund_cancel.20261001_20261023';

const cancelledFile = path.join(dir, 'Order.cancelled.20261001_20261023_part_1_of_1.xlsx');
const failedFile = path.join(dir, 'Order.failed_delivery.20261001_20261023_part_1_of_1.xlsx');
const returnFile = path.join(dir, 'Order.return_refund.20261001_20261023_part_1_of_1.xls');

const cancelledWb = XLSX.readFile(cancelledFile);
const failedWb = XLSX.readFile(failedFile);
const returnWb = XLSX.readFile(returnFile);

const cancelledRows = XLSX.utils.sheet_to_json(cancelledWb.Sheets[cancelledWb.SheetNames[0]]);
const failedRows = XLSX.utils.sheet_to_json(failedWb.Sheets[failedWb.SheetNames[0]]);
const returnRows = XLSX.utils.sheet_to_json(returnWb.Sheets[returnWb.SheetNames[0]]);

const dataset = {
  metadata: {
    sourcePeriod: '01/10/2026 - 23/10/2026',
    generatedAt: new Date().toISOString(),
    cancelledCount: cancelledRows.length,
    failedDeliveryCount: failedRows.length,
    returnRefundCount: returnRows.length
  },
  cancelledOrders: cancelledRows,
  failedDeliveryOrders: failedRows,
  returnRefundCases: returnRows
};

const outDir = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\ShopeeData\\dashboard';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'shopee_data.json'), JSON.stringify(dataset, null, 2), 'utf-8');
console.log('Saved shopee_data.json successfully!');
console.log('Cancelled:', cancelledRows.length, 'Failed:', failedRows.length, 'Return:', returnRows.length);
