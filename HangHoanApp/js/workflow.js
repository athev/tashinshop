/* ==========================================================
   workflow.js — Quy trình xử lý đơn hoàn / giao thất bại
   1. Nhắn khách ngay  → 2. Thương lượng
   → 3. Theo dõi hàng hoàn về (2–3 ngày)
   → 4. Shopee báo hoàn: xác minh đã nhận thực tế chưa
   → 5. Kiểm hàng (đủ / thiếu / hư hỏng / sai)
   → 6. Khiếu nại & theo dõi tiếp → 7. Hoàn tất
   ========================================================== */
(function (global) {
  'use strict';

  const STAGES = [
    { key: 'contact',   name: 'Cần nhắn khách',          short: 'Nhắn khách',   color: 'var(--red)',    desc: 'Giao thất bại / yêu cầu hoàn mới – nhắn ngay để thương lượng.' },
    { key: 'negotiate', name: 'Đang thương lượng',       short: 'Thương lượng', color: 'var(--yellow)', desc: 'Đã nhắn, chờ khách phản hồi / chốt phương án.' },
    { key: 'returning', name: 'Đang hoàn về',            short: 'Đang hoàn',    color: 'var(--blue)',   desc: 'Thương lượng không thành – theo dõi hàng hoàn (2–3 ngày).' },
    { key: 'verify',    name: 'Shopee báo hoàn – chưa nhận', short: 'Xác minh nhận', color: 'var(--orange)', desc: 'App báo đã hoàn nhưng shop chưa xác nhận nhận hàng thực tế.' },
    { key: 'inspect',   name: 'Chờ kiểm hàng',           short: 'Kiểm hàng',    color: 'var(--violet)', desc: 'Đã nhận kiện – quay video mở hàng, kiểm đủ/thiếu/hỏng.' },
    { key: 'complaint', name: 'Khiếu nại',               short: 'Khiếu nại',    color: 'var(--brand)',  desc: 'Thiếu / hư hỏng / không nhận được hàng – gửi & theo dõi khiếu nại.' },
    { key: 'done',      name: 'Hoàn tất',                short: 'Hoàn tất',     color: 'var(--green)',  desc: 'Đã xử lý xong, đóng hồ sơ.' },
  ];
  const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s]));

  const TYPE_LABEL = { return: 'Yêu cầu hoàn hàng', failed: 'Giao hàng thất bại', cancel: 'Hủy sau khi gửi hàng' };
  const TYPE_BADGE = { return: 'b-violet', failed: 'b-orange', cancel: 'b-blue' };

  const CONTACT = { '': 'Chưa nhắn', done: 'Đã nhắn khách', skip: 'Không cần liên hệ' };
  const NEGOTIATION = {
    '': 'Chưa có kết quả',
    accept: 'Khách đồng ý nhận hàng / giao lại',
    resolved: 'Khách hủy yêu cầu hoàn – giữ hàng',
    return: 'Không thành – hàng hoàn về shop',
    noreply: 'Khách không phản hồi',
  };
  const INSPECTION = {
    '': 'Chưa kiểm tra',
    ok: 'Đủ hàng – nguyên vẹn',
    missing: 'Thiếu hàng / thiếu phụ kiện',
    damaged: 'Hư hỏng / bể vỡ',
    wrong: 'Sai hàng / bị tráo',
    notreceived: 'Không nhận được hàng',
  };
  const BAD_INSPECTION = ['missing', 'damaged', 'wrong', 'notreceived'];
  const COMPLAINT = {
    '': 'Chưa khiếu nại',
    sent: 'Đã gửi khiếu nại',
    processing: 'Shopee đang xử lý',
    rejected: 'Bị từ chối',
    accepted: 'Được chấp nhận',
    compensated: 'Đã nhận bồi thường',
    dropped: 'Không theo đuổi nữa',
  };

  const defaultManual = () => ({
    contact: '', contactAt: '',
    negotiation: '', negotiationNote: '',
    returnStart: '', returnTracking: '',
    received: '',
    inspection: '', inspectionNote: '', evidence: '',
    complaint: '', complaintAt: '', followUp: '', compensation: 0, complaintNote: '',
    owner: '', note: '',
    ownerNote: '', ownerUpdatedAt: '',
    closed: false, closedReason: '',
  });

  // ---------------- Date helpers ----------------
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parse = (s) => {
    if (!s) return null;
    let t = String(s).trim().replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) t += 'T00:00'; // ngày thuần → giờ địa phương (tránh lệch múi giờ)
    const d = new Date(t);
    return isNaN(d) ? null : d;
  };
  const dayDiff = (a, b) => Math.round((startOf(a) - startOf(b)) / 86400000);
  const startOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (s, n) => { const d = parse(s); if (!d) return ''; d.setDate(d.getDate() + n); return iso(d); };
  const p2 = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const nowStr = () => { const d = new Date(); return `${iso(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };

  /** Shopee đã báo hàng hoàn về shop thành công? */
  function shopeeReturned(c) {
    const s = c.shopee || {};
    if (s.returnSuccessAt) return true;
    if (/hoàn trả thành công|đã trả hàng/i.test(s.returnStatus || '')) return true;
    return false;
  }
  function shopeeReturnDate(c) {
    const s = c.shopee || {};
    return s.returnSuccessAt || '';
  }

  /** Suy ra trạng thái xử lý ban đầu từ dữ liệu Shopee (chỉ điền vào ô còn trống) */
  function applyShopeeDefaults(c, isCreate, settings) {
    const m = c.m, s = c.shopee || {};
    const set = (k, v) => { if (v === '' || v == null) return; if (isCreate || m[k] === '' || m[k] == null || m[k] === 0) m[k] = v; };

    if (/người mua đã hủy|yêu cầu.*đã hủy|đã hủy yêu cầu/i.test(s.refundStatus || '')) {
      m.closed = true;
      m.closedReason = 'Yêu cầu của Người mua đã hủy';
      m.negotiation = 'resolved';
      if (!m.contact) m.contact = 'skip';
    }
    if (shopeeReturned(c)) {
      set('negotiation', 'return');
      if (!m.contact) set('contact', 'skip');
    } else if (c.returnTracking && c.type === 'return') {
      set('negotiation', 'return');
      set('returnStart', (c.firstSeen || nowStr()).slice(0, 10));
    }
    if (c.type === 'failed' && /đã hủy/i.test(s.orderStatus || '') && !shopeeReturned(c)) {
      // Shopee đã tự hủy do giao thất bại → hàng đang trên đường hoàn về
      set('negotiation', 'return');
      set('returnStart', (c.firstSeen || nowStr()).slice(0, 10));
    }
    if (c.type === 'cancel' && /người mua/i.test(s.cancelReason || '')) {
      // Khách hủy khi hàng đã đi: không thương lượng được nữa → theo dõi hoàn
      set('contact', 'skip'); set('negotiation', 'return');
      set('returnStart', (c.eventDate || '').slice(0, 10));
    }

    // Người bán đã khiếu nại trên Shopee (file hoàn trả)
    if (s.complaintReason) {
      const r = s.complaintReason.toLowerCase();
      set('inspection', /bể|vỡ|hư|hỏng|móp/.test(r) ? 'damaged' : /thiếu/.test(r) ? 'missing' : /sai|tráo|khác/.test(r) ? 'wrong' : /không nhận|chưa nhận|mất/.test(r) ? 'notreceived' : 'damaged');
      set('received', (s.returnSuccessAt || '').slice(0, 10));
      set('complaint', 'sent');
      set('inspectionNote', [s.complaintReason, s.sellerNote].filter(Boolean).join(' – '));
    }
    if (/từ chối/i.test(s.refundStatus || '')) { if (isCreate || ['', 'sent', 'processing'].includes(m.complaint)) m.complaint = 'rejected'; }

    // File giao thất bại có cột khiếu nại
    if (s.compensatedAt) { if (isCreate || ['', 'sent', 'processing', 'accepted'].includes(m.complaint)) { m.complaint = 'compensated'; } set('compensation', s.compensation > 1000 ? s.compensation : 0); }
    else if (s.complaintRejectedAt) { if (isCreate || ['', 'sent', 'processing'].includes(m.complaint)) m.complaint = 'rejected'; }
    else if (s.complaintAcceptedAt) { if (isCreate || ['', 'sent', 'processing'].includes(m.complaint)) m.complaint = 'accepted'; }
    else if (s.complaintSentAt || s.complaintStatus) { set('complaint', 'sent'); set('complaintAt', (s.complaintSentAt || '').slice(0, 10)); }
    if (m.complaint && !m.inspection && c.type !== 'return') set('inspection', 'notreceived');
  }

  /** Ánh xạ dữ liệu đã nhập tay trong sheet "Theo dõi đơn" (.xlsm) */
  function applyOverlay(c, o) {
    const m = c.m;
    const t = (s) => (s || '').toLowerCase();
    const ct = t(o.contactText);
    if (ct) m.contact = /^đã nhắn|đã liên hệ|đã gọi/.test(ct) ? 'done' : /không cần|đã ghi nhận/.test(ct) ? 'skip' : '';
    const nt = t(o.negotiationText);
    if (/nhận lại|giao lại|đồng ý nhận/.test(nt)) m.negotiation = 'accept';
    else if (/hủy yêu cầu/.test(nt)) m.negotiation = 'resolved';
    else if (/tiếp tục hoàn|hoàn về|không đồng ý|hoàn tiền/.test(nt)) m.negotiation = 'return';
    else if (/không phản hồi/.test(nt)) m.negotiation = 'noreply';
    if (/đang hoàn/.test(t(o.shipText))) m.negotiation = m.negotiation || 'return';
    if (o.returnStart) m.returnStart = o.returnStart.slice(0, 10);
    if (o.received) m.received = o.received.slice(0, 10);
    const it = t(o.inspectionText);
    if (it && !/chưa kiểm/.test(it)) m.inspection = /hư|hỏng|bể|vỡ/.test(it) ? 'damaged' : /thiếu/.test(it) ? 'missing' : /sai/.test(it) ? 'wrong' : /không nhận|chưa nhận/.test(it) ? 'notreceived' : /đủ|nguyên/.test(it) ? 'ok' : m.inspection;
    if (o.inspectionNote && !m.inspectionNote) m.inspectionNote = o.inspectionNote;
    const cp = t(o.complaintText);
    if (/từ chối/.test(cp)) m.complaint = 'rejected';
    else if (/bồi thường|hoàn tất/.test(cp)) m.complaint = 'compensated';
    else if (/chấp nhận/.test(cp)) m.complaint = 'accepted';
    else if (/đang xử lý/.test(cp)) m.complaint = 'processing';
    else if (/đã gửi/.test(cp)) m.complaint = 'sent';
    if (o.complaintAt) m.complaintAt = o.complaintAt.slice(0, 10);
    if (o.followUp) m.followUp = o.followUp.slice(0, 10);
    if (o.owner) m.owner = o.owner;
    const ov = t(o.overallText);
    if (/hoàn tất|đã đóng/.test(ov)) { m.closed = true; m.closedReason = m.closedReason || 'Đóng theo file theo dõi'; }
    else if (/nhắn khách/.test(ov)) {
      if (!/người mua đã hủy|yêu cầu.*đã hủy|đã hủy yêu cầu/i.test(c.shopee?.refundStatus || '')) {
        m.contact = ''; m.negotiation = ''; m.closed = false;
      }
    }
  }

  /** Giai đoạn hiện tại của hồ sơ */
  function stageOf(c) {
    const m = c.m, s = c.shopee || {};
    if (m.closed) return 'done';
    // Người mua đã hủy yêu cầu hoàn tiền / khiếu nại -> Đơn hoàn tất, không cần đưa vào danh sách theo dõi
    if (/người mua đã hủy|yêu cầu.*đã hủy|đã hủy yêu cầu/i.test(s.refundStatus || '')) return 'done';
    if (['accepted', 'compensated', 'dropped'].includes(m.complaint)) return 'done';
    if (['sent', 'processing', 'rejected'].includes(m.complaint)) return 'complaint';
    if (BAD_INSPECTION.includes(m.inspection)) return 'complaint';
    if (m.received) return m.inspection === 'ok' ? 'done' : 'inspect';
    if (m.negotiation === 'accept' || m.negotiation === 'resolved') return 'done';
    if (shopeeReturned(c)) return 'verify';
    if (m.negotiation === 'return' || m.returnStart) return 'returning';
    if (!m.contact) return 'contact';
    return 'negotiate';
  }

  /** Cảnh báo + việc cần làm tiếp */
  function alertOf(c, settings) {
    const st = stageOf(c), m = c.m;
    const T = today();
    const rd = settings.returnDays, fd = settings.followDays;
    switch (st) {
      case 'contact':
        return { lvl: 'red', text: 'NHẮN KHÁCH NGAY', action: c.type === 'failed' ? 'Nhắn người nhận qua Shopee chat để hẹn giao lại / xác nhận địa chỉ.' : 'Nhắn khách hỏi rõ lý do, đề nghị video/ảnh, thương lượng hỗ trợ thay vì hoàn.' };
      case 'negotiate': {
        const d = parse(m.contactAt);
        const late = d && dayDiff(T, d) >= 1;
        return late
          ? { lvl: 'orange', text: 'NHẮC LẠI KHÁCH', action: `Đã nhắn ${dayDiff(T, d)} ngày chưa chốt – nhắn/gọi lại, nếu không được thì chuyển theo dõi hoàn.` }
          : { lvl: 'blue', text: 'CHỜ KHÁCH PHẢN HỒI', action: 'Chờ khách phản hồi; cập nhật kết quả thương lượng.' };
      }
      case 'returning': {
        const start = m.returnStart || (c.firstSeen || '').slice(0, 10);
        const exp = addDays(start, rd);
        const left = exp ? dayDiff(parse(exp), T) : null;
        if (left !== null && left < 0) return { lvl: 'red', text: 'QUÁ HẠN HÀNG HOÀN', action: `Quá hạn dự kiến ${-left} ngày (${exp}) – tra mã vận đơn, liên hệ ĐVVC/Shopee.`, due: exp };
        return { lvl: 'blue', text: left === 0 ? 'HÀNG HOÀN VỀ HÔM NAY' : `ĐANG HOÀN · còn ${left ?? '?'} ngày`, action: `Dự kiến về ${exp || '—'}. Khi nhận kiện: quay video mở hàng & kiểm tra.`, due: exp };
      }
      case 'verify': {
        const d = parse(shopeeReturnDate(c));
        const days = d ? dayDiff(T, d) : null;
        if (days !== null && days > rd) return { lvl: 'red', text: 'BÁO HOÀN NHƯNG CHƯA NHẬN', action: `Shopee báo hoàn ${days} ngày trước mà kho chưa xác nhận – kiểm tra kho; nếu không có hàng → khiếu nại "không nhận được hàng".` };
        return { lvl: 'orange', text: 'SHOPEE BÁO HOÀN – XÁC MINH', action: 'Đối chiếu kho: đã thực nhận kiện chưa? Không đóng hồ sơ chỉ dựa trên trạng thái app.' };
      }
      case 'inspect':
        return { lvl: 'orange', text: 'CHỜ KIỂM HÀNG HOÀN', action: 'Quay video mở kiện, kiểm số lượng / tình trạng / mã hàng, ghi kết quả.' };
      case 'complaint': {
        if (!m.complaint) return { lvl: 'red', text: 'CẦN GỬI KHIẾU NẠI', action: `Hàng: ${INSPECTION[m.inspection]}. Chuẩn bị video/ảnh, gửi khiếu nại Shopee ngay.` };
        if (m.complaint === 'rejected') return { lvl: 'red', text: 'KHIẾU NẠI BỊ TỪ CHỐI', action: 'Rà soát lý do từ chối, bổ sung bằng chứng, khiếu nại lại / liên hệ CSKH Shopee nếu còn hạn.' };
        const fu = m.followUp || addDays(m.complaintAt, fd);
        if (fu && dayDiff(parse(fu), T) <= 0) return { lvl: 'orange', text: 'ĐẾN HẠN THEO DÕI KHIẾU NẠI', action: `Hạn theo dõi ${fu} – kiểm tra kết quả khiếu nại trên Shopee.`, due: fu };
        return { lvl: 'violet', text: 'ĐANG THEO DÕI KHIẾU NẠI', action: `Theo dõi kết quả. Hạn kiểm tra tiếp: ${fu || '—'}.`, due: fu };
      }
      default:
        return { lvl: 'green', text: 'HOÀN TẤT', action: m.closedReason || 'Đã xử lý xong.' };
    }
  }
  const LVL_SCORE = { red: 4, orange: 3, violet: 2, blue: 1, yellow: 1, green: 0 };
  const LVL_BADGE = { red: 'b-red', orange: 'b-orange', violet: 'b-violet', blue: 'b-blue', yellow: 'b-yellow', green: 'b-green' };

  // ---------------- Mẫu tin nhắn ----------------
  const short = (s, n = 60) => (s && s.length > n ? s.slice(0, n).trim() + '…' : s || '');
  function contactTemplate(c, shop) {
    const name = c.receiver && !/\*{3,}/.test(c.receiver) ? c.receiver : 'anh/chị';
    if (c.type === 'failed') {
      return `Chào ${name}, ${shop} xin phép làm phiền ạ.\n\nĐơn hàng ${c.orderId} (${short(c.product)}) bên vận chuyển báo giao chưa thành công. Anh/chị vui lòng cho shop xin thời gian và địa chỉ thuận tiện để shop báo bưu tá giao lại ngay nhé.\n\nSản phẩm đã được shop kiểm tra kỹ trước khi gửi, nếu anh/chị cần tư vấn thêm shop luôn sẵn sàng hỗ trợ ạ. Cảm ơn anh/chị!`;
    }
    if (c.type === 'cancel') {
      return `Chào ${name}, ${shop} thấy đơn ${c.orderId} (${short(c.product)}) vừa được hủy trong khi hàng đã gửi đi.\n\nNếu anh/chị vẫn có nhu cầu, shop có thể hỗ trợ giữ đơn / giao lại với ưu đãi. Anh/chị phản hồi giúp shop nhé. Cảm ơn anh/chị!`;
    }
    const reason = c.shopee?.reason ? ` với lý do "${c.shopee.reason}"` : '';
    return `Chào ${name}, ${shop} đã nhận được yêu cầu trả hàng cho đơn ${c.orderId}${reason}. Shop rất tiếc vì trải nghiệm chưa tốt ạ.\n\nAnh/chị gửi giúp shop video/ảnh tình trạng sản phẩm để kỹ thuật kiểm tra và hướng dẫn khắc phục ngay. Trường hợp lỗi từ nhà sản xuất, shop sẽ hỗ trợ đổi linh kiện / bảo hành nhanh nhất để anh/chị không mất thời gian gửi trả.\n\nCảm ơn anh/chị đã tin tưởng shop!`;
  }
  function complaintTemplate(c) {
    const m = c.m;
    const trk = m.returnTracking || c.returnTracking || c.trackingOut || '—';
    if (m.inspection === 'notreceived') {
      return `Kính gửi Shopee,\n\nĐơn hàng ${c.orderId} – mã vận đơn ${trk} – hệ thống hiển thị đã hoàn trả thành công${c.shopee?.returnSuccessAt ? ' lúc ' + c.shopee.returnSuccessAt : ''}, tuy nhiên đến nay shop CHƯA nhận được kiện hàng hoàn.\n\nSản phẩm: ${c.product} (SL: ${c.qty}).\nGiá trị: ${Number(c.value || 0).toLocaleString('vi-VN')}đ.\n\nShop đề nghị Shopee kiểm tra hành trình và hỗ trợ bồi thường. Shop đính kèm ảnh chụp tra cứu hành trình / xác nhận kho.\n\nTrân trọng.`;
    }
    return `Kính gửi Shopee,\n\nĐơn hàng ${c.orderId} – mã vận đơn hoàn ${trk}. Shop nhận hàng hoàn ngày ${m.received || '—'} trong tình trạng: ${INSPECTION[m.inspection] || '—'}.\n\nChi tiết: ${m.inspectionNote || '(mô tả thiếu/hỏng)'}\nSản phẩm: ${c.product} (SL gửi: ${c.qty}).\n\nShop đính kèm video mở kiện liên tục từ lúc nhận và hình ảnh tem vận đơn, tình trạng sản phẩm. Đề nghị Shopee xem xét và hỗ trợ bồi thường cho shop.\n\nTrân trọng.`;
  }

  // ---------------- Phân vai: ai xử lý bước này? ----------------
  // Admin: làm việc với Shopee & khách (nhắn tin, khiếu nại). Chủ shop: nhận hàng hoàn & cập nhật tình trạng thực tế.
  const WHO = { contact: 'admin', negotiate: 'admin', returning: 'owner', verify: 'owner', inspect: 'owner', complaint: 'admin', done: '' };
  const ownerOf = (c) => WHO[stageOf(c)] || '';

  /** Trạng thái Shopee hiển thị (đọc từ file xuất) */
  function shopeeText(c) {
    const s = c.shopee || {}, parts = [];
    const add = (v) => { if (v && !parts.includes(v)) parts.push(v); };
    if (c.type === 'return') { add(s.refundStatus); add(s.returnStatus); }
    else { add(s.orderStatus); add(s.cancelReason); add(s.returnStatus); add(s.refundStatus); }
    return parts.join(' · ') || '—';
  }

  /** Trạng thái thực tế (do shop/admin xác nhận) bằng ngôn ngữ đơn giản */
  function plainStatus(c) {
    const st = stageOf(c), m = c.m;
    switch (st) {
      case 'contact': return { text: 'Chưa liên hệ khách', lvl: 'red' };
      case 'negotiate': return { text: 'Đang thương lượng với khách', lvl: 'yellow' };
      case 'returning': return { text: 'Đang chờ hàng hoàn về shop', lvl: 'blue' };
      case 'verify': return { text: 'Shopee báo hoàn – shop chưa xác nhận nhận', lvl: 'orange' };
      case 'inspect': return { text: 'Đã nhận hàng – chờ kiểm tra', lvl: 'violet' };
      case 'complaint':
        if (!m.complaint) return { text: m.inspection === 'notreceived' ? 'Không nhận được hàng – chờ khiếu nại' : 'Hàng có vấn đề – chờ khiếu nại', lvl: 'red' };
        if (m.complaint === 'rejected') return { text: 'Khiếu nại bị từ chối', lvl: 'red' };
        return { text: 'Đang theo dõi khiếu nại', lvl: 'violet' };
      default:
        if (/người mua đã hủy|yêu cầu.*đã hủy|đã hủy yêu cầu/i.test((c.shopee || {}).refundStatus || '')) return { text: 'Người mua đã hủy yêu cầu hoàn – Hoàn tất', lvl: 'green' };
        if (m.inspection === 'ok') return { text: 'Đã nhận đủ hàng – hoàn tất', lvl: 'green' };
        if (['accepted', 'compensated'].includes(m.complaint)) return { text: 'Khiếu nại thành công – hoàn tất', lvl: 'green' };
        return { text: 'Hoàn tất', lvl: 'green' };
    }
  }

  /** Hạn xử lý của bước hiện tại (YYYY-MM-DD) */
  function dueDate(c, settings) {
    const st = stageOf(c), m = c.m, rd = settings.returnDays, fd = settings.followDays;
    const d10 = (s) => (s || '').slice(0, 10);
    switch (st) {
      case 'contact': return addDays(d10(c.eventDate) || iso(today()), 1);
      case 'negotiate': return addDays(d10(m.contactAt) || iso(today()), 1);
      case 'returning': return addDays(d10(m.returnStart) || d10(c.firstSeen) || iso(today()), rd);
      case 'verify': return addDays(d10(shopeeReturnDate(c)) || d10(c.firstSeen) || iso(today()), rd);
      case 'inspect': return addDays(d10(m.received) || iso(today()), 1);
      case 'complaint':
        if (m.complaint) return m.followUp || addDays(d10(m.complaintAt), fd);
        return addDays(d10(m.received) || d10(shopeeReturnDate(c)) || iso(today()), 3);
      default: return '';
    }
  }
  function dueInfo(c, settings) {
    const date = dueDate(c, settings);
    if (!date) return null;
    const days = dayDiff(parse(date), today());
    let label, lvl;
    if (days < 0) { label = `Quá hạn ${-days} ngày`; lvl = 'red'; }
    else if (days === 0) { label = 'Hôm nay'; lvl = 'orange'; }
    else if (days === 1) { label = 'Ngày mai'; lvl = 'yellow'; }
    else { label = `Còn ${days} ngày`; lvl = 'blue'; }
    return { date, days, label, lvl };
  }

  /** Hiện tại sản phẩm đang ở đâu */
  function productLocation(c, settings) {
    const s = c.shopee || {}, m = c.m || {};
    const returned = shopeeReturned(c);
    const tracking = m.returnTracking || c.returnTracking || '';
    const carrier = c.returnCarrier || c.carrier || '';
    const rd = (settings && settings.returnDays) || 3;

    if (m.received) {
      return {
        status: 'at_shop',
        badge: 'ĐÃ VỀ KHO SHOP',
        color: 'var(--green)',
        icon: '📦',
        text: `Kho shop đã nhận hàng thực tế ngày ${m.received}`,
        sub: m.inspection ? `Tình trạng kiểm hàng: ${INSPECTION[m.inspection] || m.inspection}` : 'Đã nhận kiện hàng tại kho',
        isReturned: true,
      };
    }
    if (returned) {
      return {
        status: 'shopee_returned',
        badge: 'SHOPEE BÁO: ĐÃ VỀ KHO',
        color: 'var(--orange)',
        icon: '📍',
        text: `Shopee hiển thị: Giao hoàn trả thành công${s.returnSuccessAt ? ' lúc ' + s.returnSuccessAt : ''}`,
        sub: 'Shop cần kiểm tra thực tế xem kho đã nhận được kiện hàng chưa',
        isReturned: true,
        carrier, tracking,
      };
    }
    if (m.returnStart || m.negotiation === 'return' || /trả hàng/i.test(s.returnStatus || '')) {
      const exp = addDays(m.returnStart || (c.firstSeen || '').slice(0, 10), rd);
      return {
        status: 'returning',
        badge: 'ĐANG HOÀN VỀ SHOP',
        color: 'var(--blue)',
        icon: '🚚',
        text: `Shopee báo: Đang vận chuyển hoàn về shop (Dự kiến về: ${exp || 'sau 2–3 ngày'})`,
        sub: [carrier, tracking && ('Mã vận đơn hoàn: ' + tracking)].filter(Boolean).join(' · ') || 'Đang chờ đơn vị vận chuyển giao lại',
        isReturned: false,
        exp, carrier, tracking,
      };
    }
    if (/người mua đã hủy|yêu cầu.*đã hủy|đã hủy yêu cầu/i.test(s.refundStatus || '')) {
      return {
        status: 'cancelled_by_buyer',
        badge: 'KHÁCH ĐÃ HỦY YÊU CẦU',
        color: 'var(--green)',
        icon: '✔',
        text: 'Người mua đã hủy yêu cầu hoàn trả – Không phát sinh hoàn hàng',
        sub: 'Khách giữ lại sản phẩm để sử dụng, giao dịch hoàn tất bình thường',
        isReturned: false,
      };
    }
    if (c.type === 'failed') {
      return {
        status: 'failed_pending',
        badge: 'GIAO THẤT BẠI',
        color: 'var(--yellow)',
        icon: '⚠️',
        text: 'Bưu cục giao không thành công, đang giữ kiện hàng',
        sub: 'Chờ khách hẹn giao lại hoặc bưu cục chuyển hoàn về shop',
        isReturned: false,
        carrier: c.carrier, tracking: c.trackingOut,
      };
    }
    return {
      status: 'pending',
      badge: 'CHỜ XỬ LÝ',
      color: 'var(--text-3)',
      icon: '⏳',
      text: 'Khách yêu cầu hoàn hủy, hàng đang ở phía người mua',
      sub: s.reason || 'Chưa chuyển sang bước hoàn hàng',
      isReturned: false,
    };
  }

  global.WF = {
    STAGES, STAGE_MAP, TYPE_LABEL, TYPE_BADGE, CONTACT, NEGOTIATION, INSPECTION, BAD_INSPECTION, COMPLAINT,
    LVL_SCORE, LVL_BADGE,
    defaultManual, applyShopeeDefaults, applyOverlay, stageOf, alertOf, shopeeReturned,
    contactTemplate, complaintTemplate,
    ownerOf, shopeeText, plainStatus, dueDate, dueInfo, productLocation,
    addDays, nowStr, iso, parse, dayDiff, today,
  };
})(window);
