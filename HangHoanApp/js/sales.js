/* ==========================================================
   sales.js — Báo cáo doanh số từ file "Tất cả đơn" (Order.all)
   - Tất cả đơn
   - Đã hoàn thành (Shopee ghi "Hoàn thành")
   - Đã nhận hàng nhưng chưa hoàn thành (khách đã nhận, Shopee chưa chốt hoàn thành)
   Tính theo ngày đặt hàng.
   ========================================================== */
(function (global) {
  'use strict';

  const CAT_LABEL = {
    done: 'Đã hoàn thành',
    received: 'Đã nhận hàng, chưa hoàn thành',
    shipping: 'Đang giao',
    pending: 'Chờ xử lý / chưa thanh toán',
    refund: 'Hoàn / trả hàng',
    cancel: 'Đã hủy',
    other: 'Khác',
  };
  const CAT_COLOR = {
    done: 'var(--green)', received: 'var(--blue)', shipping: 'var(--violet)', pending: 'var(--yellow)',
    refund: 'var(--orange)', cancel: 'var(--red)', other: 'var(--text-3)',
  };
  const CAT_ORDER = ['done', 'received', 'shipping', 'pending', 'refund', 'cancel', 'other'];

  /** Phân loại 1 đơn theo trạng thái Shopee (+ hồ sơ hoàn đang mở nếu có) */
  function categorize(o, openIds) {
    const s = (o.s || '').toLowerCase();
    let cat;
    if (/hủy/.test(s)) cat = 'cancel';
    // Đơn người mua đã nhận được hàng (Shopee có ghi chú kèm "...Người mua vẫn có thể gửi yêu cầu Trả hàng/Hoàn tiền tới ngày...")
    else if (/người mua xác nhận đã nhận được hàng|đã nhận được hàng|đã giao|giao thành công|đã nhận/.test(s)) cat = 'received';
    else if (/hoàn thành/.test(s)) cat = 'done';
    else if (o.rf && !/đã hủy|người mua đã hủy/i.test(o.rf)) cat = 'refund';
    else if (/trả hàng|hoàn tiền|hoàn trả/.test(s)) cat = 'refund';
    else if (/đang giao|vận chuyển|đang vận/.test(s)) cat = 'shipping';
    else if (/chờ|chưa|xử lý|đóng gói/.test(s)) cat = 'pending';
    else cat = 'other';
    if (openIds && openIds.has(o.id) && ['done', 'received', 'shipping'].includes(cat)) cat = 'refund';
    return cat;
  }

  const p2 = (n) => String(n).padStart(2, '0');
  const isoDay = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

  /** Danh sách các tháng có dữ liệu (mới → cũ) */
  function months(orders) {
    return [...new Set(orders.map((o) => (o.d || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  }

  /**
   * period: 'thisMonth' | 'lastMonth' | 'd30' | 'all' | 'm:YYYY-MM'
   * Trả về tổng theo từng nhóm, biểu đồ, danh sách đơn đã nhận chưa hoàn thành.
   */
  function compute(orders, openIds, period, now) {
    now = now || new Date();
    const cur = `${now.getFullYear()}-${p2(now.getMonth() + 1)}`;
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = `${lm.getFullYear()}-${p2(lm.getMonth() + 1)}`;
    const d30 = new Date(now); d30.setDate(d30.getDate() - 29);
    const from30 = isoDay(d30);

    let pred, label;
    if (period === 'thisMonth') { pred = (o) => (o.d || '').slice(0, 7) === cur; label = `Tháng ${cur.slice(5)}/${cur.slice(0, 4)}`; }
    else if (period === 'lastMonth') { pred = (o) => (o.d || '').slice(0, 7) === last; label = `Tháng ${last.slice(5)}/${last.slice(0, 4)}`; }
    else if (period === 'd30') { pred = (o) => (o.d || '').slice(0, 10) >= from30; label = '30 ngày qua'; }
    else if (period && period.startsWith('m:')) { const m = period.slice(2); pred = (o) => (o.d || '').slice(0, 7) === m; label = `Tháng ${m.slice(5)}/${m.slice(0, 4)}`; }
    else { pred = () => true; label = 'Tất cả thời gian'; }

    const list = orders.filter(pred);
    const totals = {};
    CAT_ORDER.forEach((k) => { totals[k] = { n: 0, v: 0 }; });
    const all = { n: 0, v: 0 };
    const buckets = new Map();
    const monthly = period === 'all';
    const receivedList = [];

    for (const o of list) {
      const cat = categorize(o, openIds);
      const v = Number(o.v) || 0;
      totals[cat].n++; totals[cat].v += v;
      all.n++; all.v += v;
      const key = monthly ? (o.d || '').slice(0, 7) : (o.d || '').slice(0, 10);
      if (key) {
        if (!buckets.has(key)) buckets.set(key, { key, all: 0, done: 0, received: 0, other: 0 });
        const b = buckets.get(key);
        b.all += v;
        if (cat === 'done') b.done += v; else if (cat === 'received') b.received += v; else b.other += v;
      }
      if (cat === 'received') receivedList.push(o);
    }
    receivedList.sort((a, b) => (b.d || '').localeCompare(a.d || ''));
    const net = all.v - totals.cancel.v - totals.refund.v;
    const chart = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
    return { label, all, totals, net, chart, monthly, receivedList, count: list.length };
  }

  global.Sales = { compute, categorize, months, CAT_LABEL, CAT_COLOR, CAT_ORDER };
})(window);
