const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dir = 'C:\\Users\\VI DUONG\\ZCOM\\KhanhPhong\\ShopeeData\\Đơn hoàn hủy\\Order.return_refund_cancel.20261001_20261023';

const files = fs.readdirSync(dir).filter(f => f.match(/\.(xlsx|xls)$/i));

files.forEach(file => {
  const filePath = path.join(dir, file);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  console.log('=================================================================');
  console.log(`FILE: ${file}`);
  console.log(`Rows count: ${rows.length}`);
  if (rows.length > 0) {
    console.log('Columns:', Object.keys(rows[0]));
    
    // Inspect specific columns like status, reasons, amounts
    if (file.includes('cancelled')) {
      const reasons = {};
      let totalValue = 0;
      rows.forEach(r => {
        const reason = r['Lý do hủy'] || r['Lý do huỷ'] || r['Lí do hủy'] || r['Trạng thái đơn hàng'] || 'Unknown';
        reasons[reason] = (reasons[reason] || 0) + 1;
        const val = parseFloat(r['Tổng giá trị đơn hàng (VND)'] || r['Tổng giá trị'] || r['Tổng số tiền Người mua thanh toán'] || 0);
        if (!isNaN(val)) totalValue += val;
      });
      console.log('Cancellation reasons / columns breakdown:', reasons);
      console.log('Sample row cancel details:', {
        orderId: rows[0]['Mã đơn hàng'],
        orderDate: rows[0]['Ngày đặt hàng'],
        cancelReason: rows[0]['Lý do hủy'] || rows[0]['Lí do'],
        cancelledBy: rows[0]['Hủy bởi'] || rows[0]['Người hủy'],
        status: rows[0]['Trạng Thái Đơn Hàng'],
        product: rows[0]['Tên sản phẩm'],
        sku: rows[0]['SKU sản phẩm'],
        total: rows[0]['Tổng giá trị đơn hàng (VND)'],
      });
    }

    if (file.includes('failed_delivery')) {
      let totalValue = 0;
      const statuses = {};
      const carriers = {};
      rows.forEach(r => {
        const st = r['Trạng thái trả hàng'] || r['Trạng Thái Đơn Hàng'];
        statuses[st] = (statuses[st] || 0) + 1;
        const carrier = r['Đơn Vị Vận Chuyển'] || 'Unknown';
        carriers[carrier] = (carriers[carrier] || 0) + 1;
        const val = parseFloat(r['Tổng giá trị đơn hàng (VND)'] || 0);
        if (!isNaN(val)) totalValue += val;
      });
      console.log('Failed delivery statuses:', statuses);
      console.log('Carriers:', carriers);
      console.log('Total order value:', totalValue);
      console.log('Sample row:', {
        orderId: rows[0]['Mã đơn hàng'],
        orderDate: rows[0]['Ngày đặt hàng'],
        status: rows[0]['Trạng Thái Đơn Hàng'],
        returnStatus: rows[0]['Trạng thái trả hàng'],
        carrier: rows[0]['Đơn Vị Vận Chuyển'],
        product: rows[0]['Tên sản phẩm'],
        sku: rows[0]['SKU sản phẩm'],
        price: rows[0]['Giá gốc'],
        total: rows[0]['Tổng giá trị đơn hàng (VND)'],
        province: rows[0]['Tỉnh/Thành phố']
      });
    }

    if (file.includes('return_refund')) {
      const reasons = {};
      const statuses = {};
      let totalRefund = 0;
      rows.forEach(r => {
        const reason = r['Lí do Trả hàng/Hoàn tiền'];
        reasons[reason] = (reasons[reason] || 0) + 1;
        const st = r['Trạng thái Trả hàng/Hoàn tiền'];
        statuses[st] = (statuses[st] || 0) + 1;
        const ref = parseFloat(r['Tổng số tiền Hoàn trả'] || 0);
        if (!isNaN(ref)) totalRefund += ref;
      });
      console.log('Return/refund reasons:', reasons);
      console.log('Return/refund statuses:', statuses);
      console.log('Total refund requested/processed:', totalRefund);
      console.log('Sample row:', {
        orderId: rows[0]['Mã đơn hàng'],
        returnId: rows[0]['Mã số khiếu nại'],
        buyer: rows[0]['Người Mua'],
        sku: rows[0]['SKU sản phẩm'],
        product: rows[0]['Tên sản phẩm'],
        reason: rows[0]['Lí do Trả hàng/Hoàn tiền'],
        buyerNote: rows[0]['Ghi chú của Người mua khi trả hàng'],
        sellerNote: rows[0]['Ghi chú của Người bán'],
        status: rows[0]['Trạng thái Trả hàng/Hoàn tiền'],
        returnDeliverStatus: rows[0]['Trạng thái trả hàng'],
        refundAmount: rows[0]['Tổng số tiền Hoàn trả'],
        revenue: rows[0]['Doanh thu'],
        shippingFeeReturn: rows[0]['Phí vận chuyển chiều hoàn trả']
      });
    }
  }
});
