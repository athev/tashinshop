const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\ShopeeData\\dashboard\\shopee_data.json', 'utf-8'));

const { cancelledOrders, failedDeliveryOrders, returnRefundCases } = data;

console.log('Total cancelled rows:', cancelledOrders.length);
console.log('Total failed delivery rows:', failedDeliveryOrders.length);
console.log('Total return refund cases:', returnRefundCases.length);

// Unique order IDs across all
const allOrderIds = new Set();
cancelledOrders.forEach(o => allOrderIds.add(o['Mã đơn hàng']));
failedDeliveryOrders.forEach(o => allOrderIds.add(o['Mã đơn hàng']));
returnRefundCases.forEach(o => allOrderIds.add(o['Mã đơn hàng']));
console.log('Total unique affected orders:', allOrderIds.size);

// Financial calculations
let totalCancelledVal = 0;
let totalFailedVal = 0;
let totalPreDeliveryCancelVal = 0;
let totalSystemCancelVal = 0;

cancelledOrders.forEach(o => {
  const v = parseFloat(o['Tổng giá trị đơn hàng (VND)'] || 0);
  totalCancelledVal += v;
  const reason = o['Lý do hủy'] || '';
  if (reason.includes('Giao hàng thất bại')) {
    totalFailedVal += v;
  } else if (reason.includes('Hủy bởi người mua')) {
    totalPreDeliveryCancelVal += v;
  } else {
    totalSystemCancelVal += v;
  }
});

let totalRefundRequested = 0;
let totalRefundSuccess = 0;
let totalShopDeduction = 0;

returnRefundCases.forEach(r => {
  const req = parseFloat(r['Tổng số tiền Hoàn trả'] || 0);
  totalRefundRequested += req;
  const st = r['Trạng thái Trả hàng/Hoàn tiền'] || '';
  if (st.includes('Đã hoàn tiền')) {
    totalRefundSuccess += req;
  }
  const rev = parseFloat(r['Doanh thu'] || 0);
  const shipRet = parseFloat(r['Phí vận chuyển chiều hoàn trả'] || 0);
  if (rev < 0) totalShopDeduction += Math.abs(rev);
  if (shipRet < 0) totalShopDeduction += Math.abs(shipRet);
});

console.log('--- Financial Stats ---');
console.log('Total Cancelled Value:', totalCancelledVal.toLocaleString('vi-VN'), 'VND');
console.log('Pre-delivery Cancel Value:', totalPreDeliveryCancelVal.toLocaleString('vi-VN'), 'VND');
console.log('Failed Delivery (Boom hàng) Value:', totalFailedVal.toLocaleString('vi-VN'), 'VND');
console.log('System Cancel Value:', totalSystemCancelVal.toLocaleString('vi-VN'), 'VND');
console.log('Total Refund Requested in Return cases:', totalRefundRequested.toLocaleString('vi-VN'), 'VND');
console.log('Actual Refunded to Buyer:', totalRefundSuccess.toLocaleString('vi-VN'), 'VND');
console.log('Direct shipping/revenue loss recorded:', totalShopDeduction.toLocaleString('vi-VN'), 'VND');

// Top products
const productStats = {};
cancelledOrders.forEach(o => {
  const sku = o['SKU sản phẩm'] || 'N/A';
  const name = o['Tên sản phẩm'] || 'Chưa đặt tên';
  const reason = o['Lý do hủy'] || '';
  const isFailed = reason.includes('Giao hàng thất bại');
  const val = parseFloat(o['Tổng giá trị đơn hàng (VND)'] || 0);
  
  if (!productStats[sku]) {
    productStats[sku] = { sku, name, totalOrders: 0, failedOrders: 0, preCancelOrders: 0, totalVal: 0 };
  }
  productStats[sku].totalOrders++;
  productStats[sku].totalVal += val;
  if (isFailed) productStats[sku].failedOrders++;
  else productStats[sku].preCancelOrders++;
});

console.log('\n--- Top 5 Impacted SKUs ---');
Object.values(productStats).sort((a,b) => b.totalVal - a.totalVal).slice(0, 5).forEach(p => {
  console.log(`${p.sku} | ${p.name.substring(0, 40)} | Tổng đơn: ${p.totalOrders} (Giao thất bại: ${p.failedOrders}, Huỷ trước: ${p.preCancelOrders}) | Giá trị: ${p.totalVal.toLocaleString('vi-VN')} đ`);
});
