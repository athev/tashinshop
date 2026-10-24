/* ==========================================================
   parser.js — Đọc file Excel xuất từ Shopee & file theo dõi .xlsm
   Hỗ trợ:
   - Order.return_refund.*.xls(x)     → Yêu cầu trả hàng/hoàn tiền (HT-)
   - Order.failed_delivery.*.xlsx     → Giao hàng thất bại (GH-)
   - Order.cancelled.*.xlsx           → Đơn hủy (chỉ lấy đơn đã giao cho ĐVVC)
   - Shopee_Bao_Cao_Theo_Doi_Hang_Hoan*.xlsm → sheet "Nguồn - ..." + "Theo dõi đơn"
   ========================================================== */
(function (global) {
  'use strict';

  const norm = (s) => String(s == null ? '' : s).normalize('NFC').replace(/\s+/g, ' ').trim();

  /** Excel serial / Date / "YYYY-MM-DD HH:mm" → "YYYY-MM-DD HH:mm" ('' nếu không hợp lệ) */
  function toDT(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return fmt(v);
    if (typeof v === 'number') {
      if (v < 20000 || v > 80000) return ''; // không phải serial ngày hợp lệ (vd "70")
      const ms = Math.round((v - 25569) * 86400 * 1000);
      const d = new Date(ms);
      return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
    }
    const s = norm(v);
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (m) return `${m[1]}-${p2(m[2])}-${p2(m[3])} ${p2(m[4] || 0)}:${p2(m[5] || 0)}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) return `${m[3]}-${p2(m[2])}-${p2(m[1])} ${p2(m[4] || 0)}:${p2(m[5] || 0)}`;
    if (/^\d+(\.\d+)?$/.test(s)) return toDT(parseFloat(s));
    return '';
  }
  const p2 = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

  const num = (v) => {
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v || '').replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  };
  /** Ô trạng thái dạng chữ: bỏ giá trị toàn số (dữ liệu rác như "70") */
  const txt = (v) => { const s = norm(v); return /^-?\d+(\.\d+)?$/.test(s) ? '' : s; };
  const str = (v) => norm(v);

  /** Đọc sheet → { headers, rows: [getter] } — header trùng tên được đánh số _2, _3 */
  /** Đọc sheet → { headers, rows: [getter] } — hỗ trợ tìm theo cả tên gốc lẫn chữ thường */
  function readSheet(ws) {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
    if (!aoa.length) return { headers: [], idx: {}, rows: [] };
    const headers = aoa[0].map(norm);
    const idx = {};
    headers.forEach((h, i) => {
      if (!h) return;
      let key = h, k = 2;
      while (key in idx) key = `${h}_${k++}`;
      idx[key] = i;
      const lower = key.toLowerCase();
      if (!(lower in idx)) idx[lower] = i;
    });
    const rows = aoa.slice(1)
      .filter((r) => r.some((c) => c !== '' && c != null))
      .map((r) => (name) => {
        if (name in idx) return r[idx[name]];
        const lower = name.toLowerCase();
        if (lower in idx) return r[idx[lower]];
        return '';
      });
    return { headers, idx, rows };
  }

  function detect(headers) {
    const H = new Set(headers.map((h) => norm(h).toLowerCase()));
    if (H.has('mã theo dõi') && H.has('loại sự việc')) return 'tracking';
    if (H.has('mã số khiếu nại') && H.has('mã đơn hàng')) return 'return';
    if (H.has('mã đơn hàng') && H.has('trạng thái trả hàng') && H.has('mã vận đơn')) return 'failed';
    // Đơn doanh số: có mã đơn, trạng thái đơn và cột giá trị
    if (H.has('mã đơn hàng') && (H.has('trạng thái đơn hàng') || H.has('trạng thái đơn')) && (H.has('tổng giá trị đơn hàng (vnd)') || H.has('tổng giá trị đơn hàng') || H.has('tổng số tiền người mua thanh toán'))) return 'sales';
    if (H.has('lý do hủy') && H.has('mã đơn hàng')) return 'cancel';
    return null;
  }

  /** File 'cancel'/'failed' thực chất là file tất cả đơn (Order.all) nếu tên file khớp hoặc có trạng thái khác "Đã hủy" */
  function isSalesSheet(sh, fileName) {
    if (/order\.all|all[_\-. ]?orders?|tat[_ ]?ca|toan[_ ]?bo/i.test(fileName)) return true;
    return sh.rows.some((g) => { const s = txt(g('Trạng Thái Đơn Hàng')); return s && !/^đã hủy$/i.test(s); });
  }

  /** Gom các dòng sản phẩm thành 1 dòng / đơn hàng (phục vụ báo cáo doanh số) */
  function salesFromRows(rows) {
    const map = new Map();
    for (const g of rows) {
      const id = str(g('Mã đơn hàng'));
      if (!id) continue;
      const v = num(g('Tổng giá trị đơn hàng (VND)')) || num(g('Tổng giá trị đơn hàng'));
      const paid = num(g('Tổng số tiền Người mua thanh toán')) || num(g('Tổng số tiền người mua thanh toán'));
      const o = map.get(id);
      if (!o) {
        map.set(id, {
          id, d: toDT(g('Ngày đặt hàng')), s: txt(g('Trạng Thái Đơn Hàng')) || txt(g('Trạng thái đơn hàng')),
          v: v || paid, q: num(g('Số lượng')) || 1,
          done: toDT(g('Thời gian hoàn thành đơn hàng')), dl: toDT(g('Thời gian giao hàng')),
          rf: txt(g('Trạng thái Trả hàng/Hoàn tiền')) || txt(g('Trạng thái Trả hàng / Hoàn tiền')),
          cr: txt(g('Lý do hủy')).replace(/\s+lí do là:\s*/i, ' – '),
          p: str(g('Tên sản phẩm')), b: str(g('Người Mua')) || str(g('Tên Người nhận')) || str(g('Người nhận')),
        });
      } else {
        o.v = Math.max(o.v, v || paid);
        o.q += num(g('Số lượng')) || 1;
        o.done = o.done || toDT(g('Thời gian hoàn thành đơn hàng'));
        o.dl = o.dl || toDT(g('Thời gian giao hàng'));
        const p2 = str(g('Tên sản phẩm'));
        if (p2 && !o.p.includes(p2)) o.p += ' + ' + p2;
      }
    }
    return [...map.values()];
  }

  // ---------------- Mappers ----------------
  function fromReturn(g) {
    const complaintId = str(g('Mã số khiếu nại'));
    const orderId = str(g('Mã đơn hàng'));
    if (!complaintId && !orderId) return null;
    return {
      id: 'HT-' + (complaintId || orderId),
      type: 'return',
      orderId, complaintId,
      eventDate: toDT(g('Thời gian khiếu nại')),
      orderDate: toDT(g('Ngày đặt hàng')),
      buyer: str(g('Người Mua')),
      receiver: '',
      phone: str(g('Số điện thoại')),
      address: str(g('Địa chỉ nhận hàng')),
      province: str(g('Tỉnh/Thành phố')),
      product: str(g('Tên sản phẩm')),
      sku: str(g('SKU sản phẩm')),
      variation: str(g('Phân loại hàng')),
      skuVar: str(g('SKU phân loại')),
      qty: num(g('Số lượng Hoàn')) || 1,
      value: num(g('Tổng số tiền Hoàn trả')) || num(g('Đơn Giá')),
      payment: str(g('Phương thức thanh toán')),
      carrier: str(g('Đơn vị vận chuyển giao hàng')),
      trackingOut: str(g('Mã vận đơn giao hàng')),
      returnCarrier: str(g('Đơn vị vận chuyển trả hàng')),
      returnTracking: str(g('Mã vận đơn trả hàng')),
      shopee: {
        refundStatus: txt(g('Trạng thái Trả hàng/Hoàn tiền')),
        returnStatus: txt(g('Trạng thái trả hàng_2')) || '',
        returnSuccessAt: toDT(g('Thời gian hoàn trả hàng thành công')),
        refundAt: toDT(g('Thời gian hoàn tiền')),
        solution: txt(g('Phương án')),
        reason: txt(g('Lí do Trả hàng/Hoàn tiền')),
        buyerNote: str(g('Ghi chú của Người mua khi trả hàng')),
        complaintReason: txt(g('Lí Do Khiếu Nại')),
        sellerNote: str(g('Ghi chú của Người bán')),
        compensation: num(g('Số tiền đền bù')),
        adjustReason: txt(g('Lý do điều chỉnh bởi Shopee')),
        respondBy: toDT(g('Người Bán cần phản hồi trước')),
        complaintStatus: txt(g('Trạng thái xử lý khiếu nại')),
        returnFee: num(g('Phí vận chuyển chiều hoàn trả')),
      },
    };
  }

  function fromFailed(g) {
    const orderId = str(g('Mã đơn hàng'));
    if (!orderId) return null;
    return {
      id: 'GH-' + orderId,
      type: 'failed',
      orderId, complaintId: '',
      eventDate: toDT(g('Thời gian giao hàng')) || toDT(g('Ngày gửi hàng')) || toDT(g('Ngày đặt hàng')),
      orderDate: toDT(g('Ngày đặt hàng')),
      buyer: str(g('Người Mua')),
      receiver: str(g('Tên Người nhận')),
      phone: str(g('Số điện thoại')),
      address: str(g('Địa chỉ nhận hàng')),
      province: str(g('Tỉnh/Thành phố')),
      product: str(g('Tên sản phẩm')),
      sku: str(g('SKU sản phẩm')),
      variation: txt(g('Tên phân loại hàng')),
      skuVar: str(g('SKU phân loại hàng')),
      qty: num(g('Số lượng')) || 1,
      value: num(g('Tổng giá trị đơn hàng (VND)')) || num(g('Tổng số tiền Người mua thanh toán')),
      payment: str(g('Phương thức thanh toán')),
      carrier: str(g('Đơn Vị Vận Chuyển')),
      trackingOut: str(g('Mã vận đơn')),
      returnCarrier: '',
      returnTracking: '',
      shopee: {
        orderStatus: txt(g('Trạng Thái Đơn Hàng')),
        returnStatus: txt(g('Trạng thái trả hàng')),
        refundStatus: txt(g('Trạng thái Trả hàng/Hoàn tiền')),
        cancelReason: txt(g('Lý do hủy')),
        complaintStatus: txt(g('Trạng thái xử lý khiếu nại')),
        complaintSentAt: toDT(g('Ngày gửi yêu cầu khiếu nại')),
        complaintAcceptedAt: toDT(g('Ngày chấp nhận khiếu nại')),
        compensatedAt: toDT(g('Ngày hoàn tất bồi thường')),
        complaintRejectedAt: toDT(g('Ngày từ chối khiếu nại')),
        compensation: num(g('Số tiền bồi thường')),
        note: txt(g('Ghi chú')),
      },
    };
  }

  /** Đơn hủy: chỉ tạo hồ sơ khi đơn đã bàn giao cho ĐVVC (có "Thời gian giao hàng") */
  function fromCancel(g) {
    const reason = norm(g('Lý do hủy')).replace(/\s+lí do là:\s*/i, ' – ');
    const shippedAt = toDT(g('Thời gian giao hàng'));
    const base = fromFailed(g);
    if (!base) return null;
    base.shopee.cancelReason = reason;
    if (/giao hàng thất bại/i.test(reason)) {
      base.shopee.returnStatus = base.shopee.returnStatus || '';
      return base; // GH- (gộp với file giao thất bại nếu có)
    }
    if (!shippedAt) return { skip: true, orderId: base.orderId, reason };
    base.id = 'HH-' + base.orderId;
    base.type = 'cancel';
    return base;
  }

  /** Sheet "Theo dõi đơn" của file .xlsm → dữ liệu xử lý thủ công đã nhập trước đó */
  function fromTracking(g) {
    const id = str(g('Mã theo dõi'));
    if (!id) return null;
    return {
      id,
      contactText: str(g('Đã nhắn khách?')),
      negotiationText: str(g('Kết quả thương lượng')),
      shipText: str(g('Trạng thái vận chuyển / hoàn')),
      returnStart: toDT(g('Ngày bắt đầu hoàn')),
      received: toDT(g('Ngày thực nhận')),
      inspectionText: str(g('Kiểm tra hàng thực tế')),
      inspectionNote: str(g('Chi tiết thiếu/hỏng / bằng chứng')),
      complaintText: str(g('Trạng thái khiếu nại')),
      complaintAt: toDT(g('Ngày gửi khiếu nại')),
      followUp: toDT(g('Hạn theo dõi tiếp')),
      owner: txt(g('Người phụ trách')),
      overallText: str(g('Trạng thái tổng')),
      raw: {
        orderId: str(g('Mã đơn Shopee')),
        typeText: str(g('Loại sự việc')),
        eventDate: toDT(g('Ngày mốc từ Shopee')),
        product: str(g('Sản phẩm / SKU')),
        qty: num(g('SL gửi')),
        value: num(g('Giá trị đơn (VND)')),
        buyer: str(g('Khách hàng / link chat')),
        carrier: str(g('ĐVVC / mã vận đơn')),
      },
    };
  }

  /** Gộp 2 bản ghi cùng mã: giá trị không rỗng của b bổ sung vào a; sản phẩm khác nhau được nối */
  function combine(a, b) {
    const out = { ...a, shopee: { ...a.shopee } };
    for (const k of Object.keys(b)) {
      if (k === 'shopee') continue;
      if (k === 'product' && a.product && b.product && a.product !== b.product && !a.product.includes(b.product)) {
        out.product = a.product + ' + ' + b.product;
        out.sku = [a.sku, b.sku].filter(Boolean).join(', ');
        continue;
      }
      if ((out[k] === '' || out[k] == null || out[k] === 0) && b[k] !== '' && b[k] != null) out[k] = b[k];
    }
    for (const [k, v] of Object.entries(b.shopee || {})) {
      if ((out.shopee[k] === '' || out.shopee[k] == null || out.shopee[k] === 0) && v !== '' && v != null) out.shopee[k] = v;
    }
    // ưu tiên loại "failed" (file giao thất bại có dữ liệu hoàn đầy đủ hơn)
    if (b.type === 'failed' && a.type !== 'failed') out.type = 'failed';
    return out;
  }

  /** Đọc 1 file → { fileName, kinds:[], cases:[], overlays:[], skipped:[], sales:[] } */
  async function parseFile(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    const res = { fileName: file.name, kinds: [], cases: [], overlays: [], skipped: [], sales: [] };
    for (const name of wb.SheetNames) {
      const sh = readSheet(wb.Sheets[name]);
      let kind = detect(sh.headers);
      if (!kind) continue;
      if ((kind === 'cancel' || kind === 'failed') && isSalesSheet(sh, file.name)) kind = 'sales';
      if (kind === 'sales' && !isSalesSheet(sh, file.name)) kind = 'cancel';
      res.kinds.push({ sheet: name, kind, rows: sh.rows.length });
      if (kind === 'sales') { res.sales.push(...salesFromRows(sh.rows)); continue; }
      for (const g of sh.rows) {
        if (kind === 'tracking') { const o = fromTracking(g); if (o) res.overlays.push(o); continue; }
        const c = kind === 'return' ? fromReturn(g) : kind === 'failed' ? fromFailed(g) : fromCancel(g);
        if (!c) continue;
        if (c.skip) { res.skipped.push(c); continue; }
        c.sources = [kind];
        res.cases.push(c);
      }
    }
    return res;
  }

  /** Đọc nhiều file, gộp trùng mã trong cùng lô */
  async function parseFiles(files) {
    const results = [];
    for (const f of files) {
      try { results.push(await parseFile(f)); }
      catch (e) { results.push({ fileName: f.name, error: e.message || String(e), kinds: [], cases: [], overlays: [], skipped: [], sales: [] }); }
    }
    const map = new Map();
    const overlays = [];
    const skipped = [];
    const sales = new Map();
    for (const r of results) {
      for (const c of r.cases) {
        if (map.has(c.id)) {
          const prev = map.get(c.id);
          const merged = combine(prev, c);
          merged.sources = [...new Set([...(prev.sources || []), ...(c.sources || [])])];
          map.set(c.id, merged);
        } else map.set(c.id, c);
      }
      overlays.push(...r.overlays);
      skipped.push(...r.skipped);
      (r.sales || []).forEach((o) => sales.set(o.id, o));
    }
    // Trong cùng 1 file, đơn giao thất bại nhiều sản phẩm → nhiều dòng cùng mã; combine đã nối tên SP
    return { results, cases: [...map.values()], overlays, skipped, sales: [...sales.values()] };
  }

  global.Parser = { parseFiles, toDT, norm };
})(window);
