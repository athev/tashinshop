const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dir = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\ShopeeData\\Đơn hoàn hủy\\Order.return_refund_cancel.20261001_20261023';

const cancelledFile = path.join(dir, 'Order.cancelled.20261001_20261023_part_1_of_1.xlsx');
const failedFile = path.join(dir, 'Order.failed_delivery.20261001_20261023_part_1_of_1.xlsx');
const returnFile = path.join(dir, 'Order.return_refund.20261001_20261023_part_1_of_1.xls');

const cancelledRows = XLSX.utils.sheet_to_json(XLSX.readFile(cancelledFile).Sheets['orders']);
const failedRows = XLSX.utils.sheet_to_json(XLSX.readFile(failedFile).Sheets['orders']);
const returnRows = XLSX.utils.sheet_to_json(XLSX.readFile(returnFile).Sheets['Sheet1']);

console.log('Cancelled count:', cancelledRows.length);
console.log('Failed delivery count:', failedRows.length);
console.log('Return/refund count:', returnRows.length);

const cancelledOrderIds = new Set(cancelledRows.map(r => r['Mã đơn hàng']));
const failedOrderIds = new Set(failedRows.map(r => r['Mã đơn hàng']));
const returnOrderIds = new Set(returnRows.map(r => r['Mã đơn hàng']));

console.log('Overlap cancelled & failed delivery:', [...failedOrderIds].filter(id => cancelledOrderIds.has(id)).length);
console.log('Overlap return & cancelled:', [...returnOrderIds].filter(id => cancelledOrderIds.has(id)).length);

// Breakdown of cancelled by category
const cancelGroups = {
  'Giao thất bại (Hoàn trả)': 0,
  'Khách hủy trước giao': 0,
  'Hệ thống hủy': 0
};
let cancelPreDeliveryVal = 0;
let cancelFailedDeliveryVal = 0;

cancelledRows.forEach(r => {
  const reason = r['Lý do hủy'] || '';
  const val = parseFloat(r['Tổng giá trị đơn hàng (VND)'] || 0);
  if (reason.includes('Giao hàng thất bại')) {
    cancelGroups['Giao thất bại (Hoàn trả)']++;
    cancelFailedDeliveryVal += val;
  } else if (reason.includes('Hủy bởi người mua')) {
    cancelGroups['Khách hủy trước giao']++;
    cancelPreDeliveryVal += val;
  } else {
    cancelGroups['Hệ thống hủy']++;
  }
});
console.log('Cancel groups:', cancelGroups);
console.log('Cancel pre-delivery value:', cancelPreDeliveryVal);
console.log('Cancel failed delivery value:', cancelFailedDeliveryVal);

console.log('\n--- Return rows summary ---');
returnRows.forEach((r, i) => {
  console.log(`[${i+1}] Đơn: ${r['Mã đơn hàng']} | Khách: ${r['Người Mua']} | SP: ${r['SKU sản phẩm']} - ${r['Tên sản phẩm']?.substring(0, 30)}... | Tiền hoàn: ${r['Tổng số tiền Hoàn trả']} | Lý do: ${r['Lí do Trả hàng/Hoàn tiền']} | Trạng thái: ${r['Trạng thái Trả hàng/Hoàn tiền']} | Buyer Note: ${r['Ghi chú của Người mua khi trả hàng']}`);
});

console.log('\n--- Failed delivery rows summary ---');
failedRows.forEach((r, i) => {
  console.log(`[${i+1}] Đơn: ${r['Mã đơn hàng']} | Khách: ${r['Người Mua']} (${r['Tỉnh/Thành phố']}) | SP: ${r['SKU sản phẩm']} | Tiền: ${r['Tổng giá trị đơn hàng (VND)']} | Vận chuyển: ${r['Đơn Vị Vận Chuyển']}`);
});
