(function() {
  const ORDERS_KEY = 'x2_orders';
  const PROFILE_KEY = 'x2_profile';
  const PRODUCTS_URL = '/java/Products.json';
  let currentStatus = 'all';
  let currentSearch = '';
  let currentPage   = 1;
  const PAGE_SIZE   = 10;
  let isRenderingOrders = false;
  let offersLoaded = false;
  const INVOICE_MARK = '\n[BARIQ_INVOICE]';
  const INVOICE_DEFAULT_NOTE = 'برجاء إرسال إيصال الدفع في واتساب بعد التحويل.';
  const BANK_INFO = {
    beneficiary: 'AHMED SHARKAWI GHANDOUR SHEHATA SHARKAWI',
    bank: 'ADIB',
    iban: 'AE100500000000028859428',
    account: '28859428',
    swift: 'ABDIAEADXXX',
    currency: 'AED',
    whatsapp: '971554423151'
  };
  const ACC_EN = (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en';
  const accText = (ar, en) => ACC_EN ? en : ar;
  const accDate = value => new Date(value).toLocaleDateString(ACC_EN ? 'en-US' : 'ar-AE', { year:'numeric', month:'short', day:'numeric' });
  function applyAccountPlaceholders() {
    const placeholders = {
      'pf-name': ['أدخل اسمك', 'Enter your name'],
      'pf-address': ['أدخل عنوانك', 'Enter your address'],
      'pf-password': ['أدخل كلمة السر', 'Enter your password'],
      'pf-new-password': ['أدخل كلمة السر الجديدة', 'Enter your new password'],
      'pf-confirm-password': ['أعد كتابة كلمة السر الجديدة', 'Re-enter your new password'],
      'scInput': ['اكتب سؤالك هنا...', 'Type your question here...'],
      'addr-city': ['دبي', 'Dubai'],
      'addr-area': ['الخليج التجاري', 'Business Bay'],
      'addr-street': ['شارع الشيخ زايد', 'Sheikh Zayed Road'],
      'addr-building': ['برج المارينا، شقة 504', 'Marina Tower, Apartment 504'],
      'addr-notes': ['بالقرب من سبينيس...', 'Near Spinneys...']
    };
    Object.entries(placeholders).forEach(([id, pair]) => {
      const el = document.getElementById(id);
      if (el) el.placeholder = accText(pair[0], pair[1]);
    });
    document.querySelectorAll('#addr-country option[data-en]').forEach(option => {
      if (!option.dataset.ar) option.dataset.ar = option.textContent;
      option.textContent = ACC_EN ? option.dataset.en : option.dataset.ar;
    });
  }

  function getCurrSym() {
    const code = localStorage.getItem('currency') || 'AED';
    if (ACC_EN) {
      const enMap = { AED:'AED', USD:'$', EUR:'€', SAR:'SAR', EGP:'EGP', KWD:'KWD', JOD:'JOD', GBP:'£' };
      return enMap[code] || code;
    }
    const map = { AED:'د.إ', USD:'$', EUR:'€', SAR:'ر.س', EGP:'ج.م', KWD:'د.ك', JOD:'د.أ', GBP:'£' };
    return map[code] || code;
  }

  function fmt(n) { return (parseFloat(n)||0).toFixed(2) + ' ' + getCurrSym(); }

  function normalizeUaePhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('00971')) digits = digits.slice(2);
    if (digits.startsWith('971')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
    digits = digits.slice(0, 9);
    return digits ? '+971' + digits : '';
  }

  function formatUaePhoneInput(value) {
    const phone = normalizeUaePhone(value);
    return phone ? phone.replace('+971', '+971 ') : '+971 ';
  }

  function enforceUaePhoneInput(input) {
    if (!input) return;
    input.value = formatUaePhoneInput(input.value);
  }

  function getOrders() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch(e) { return []; }
  }

  function isValidText(str) {
    if (!str) return false;
    return !/^[\?\uFFFD]+([\s\?\uFFFD]*[\?\uFFFD]+)*$/.test(str);
  }

  function customerToProfile(customer, current) {
    current = current || {};
    if (!customer) return current;
    const addressText = typeof customer.address === 'string'
      ? customer.address
      : [customer.city, customer.area, customer.street, customer.building].filter(Boolean).join(' ').trim();
    const dbName = customer.full_name || customer.name || '';
    return {
      ...current,
      name: (isValidText(dbName) ? dbName : '') || current.name || '',
      email: String(customer.email || current.email || '').trim().toLowerCase(),
      phone: normalizeUaePhone(customer.phone || current.phone || ''),
      address: addressText || customer.city || current.address || '',
      city: customer.city || current.city || ''
    };
  }

  function orderToProfile(order, current) {
    current = current || {};
    if (!order) return current;
    return {
      ...current,
      name: current.name || order.customer_name || '',
      email: String(current.email || order.customer_email || '').trim().toLowerCase(),
      phone: normalizeUaePhone(current.phone || order.customer_phone || ''),
      address: current.address || ''
    };
  }

  async function findLatestOrderProfile(profile) {
    if (!window.sbFetch) return null;
    const email = String(profile.email || '').trim().toLowerCase();
    if (!email) return null;
    try {
      const rows = await window.sbFetch('orders?customer_email=eq.' + encodeURIComponent(email) + '&order=created_at.desc&limit=1');
      return rows && rows[0] ? rows[0] : null;
    } catch(e) { return null; }
  }

  async function findCustomerProfile(profile) {
    const ready = await waitForSupabaseLib();
    if (!ready || !window.sbFetch) return null;
    if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) return null;
    const email = String(profile.email || '').trim().toLowerCase();
    const phone = normalizeUaePhone(profile.phone || '');
    const queries = [];
    if (email) queries.push('customers?email=eq.' + encodeURIComponent(email) + '&limit=1');
    else if (phone) queries.push('customers?phone=eq.' + encodeURIComponent(phone) + '&limit=1');
    for (const query of queries) {
      try {
        const rows = await window.sbFetch(query);
        if (rows && rows[0]) return rows[0];
      } catch(e) {}
    }
    return null;
  }

  async function hydrateProfileFromSupabase() {
    try {
      const current = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      const customer = await findCustomerProfile(current);
      const latestOrder = await findLatestOrderProfile(current);
      if (!customer && !latestOrder) return current;
      const merged = customerToProfile(customer, orderToProfile(latestOrder, current));
      localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
      if (merged.phone && window.Supabase?.Customers?.upsert && getStoredAuthToken()) {
        window.Supabase.Customers.upsert({ name: merged.name, email: merged.email, phone: merged.phone, city: merged.address, address: merged.address }).catch(()=>{});
      }
      loadProfile();
      return merged;
    } catch(e) { return null; }
  }

  /* مزامنة حالة الطلبات والكاش باك من Supabase (المصدر الحقيقي لحالة الطلب التي يحدّثها الأدمن) */
  function waitForSupabaseLib(timeout) {
    timeout = timeout || 5000;
    return new Promise(resolve => {
      if (window.Supabase) { resolve(true); return; }
      const start = Date.now();
      const check = setInterval(() => {
        if (window.Supabase) { clearInterval(check); resolve(true); }
        else if (Date.now() - start > timeout) { clearInterval(check); resolve(false); }
      }, 100);
    });
  }

  async function saveCustomerProfileToSupabase(profile, oldProfile) {
    const ready = await waitForSupabaseLib();
    if (!ready || !window.sbFetch || !profile) return false;
    const email = String(profile.email || oldProfile?.email || '').trim().toLowerCase();
    const phone = normalizeUaePhone(profile.phone || oldProfile?.phone || '');
    if (!email && !phone) return false;
    const payload = {
      full_name: profile.name || '',
      email,
      city: profile.address || '',
      address: profile.address || '',
      active: true
    };
    if (phone) payload.phone = phone;
    try {
      let existing = [];
      if (email) existing = await window.sbFetch('customers?email=eq.' + encodeURIComponent(email) + '&select=id&limit=1');
      if ((!existing || !existing[0]) && phone) existing = await window.sbFetch('customers?phone=eq.' + encodeURIComponent(phone) + '&select=id&limit=1');
      if (existing && existing[0]) await window.sbFetch('customers?id=eq.' + encodeURIComponent(existing[0].id), { method: 'PATCH', body: JSON.stringify(payload) });
      else await window.sbFetch('customers', { method: 'POST', body: JSON.stringify(payload) });
      return true;
    } catch(e) { return false; }
  }

  async function syncOrdersFromSupabase() {
    try {
      const ready = await waitForSupabaseLib();
      if (!ready || !window.Supabase) { return; }
      const profile = (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}'); } catch(e) { return {}; } })();
      const normalizedPhone = normalizeUaePhone(profile.phone);
      if (!normalizedPhone) { return; }
      if (profile.phone !== normalizedPhone) {
        profile.phone = normalizedPhone;
        try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch(e) {}
      }
      const remote = await window.Supabase.Orders.getByPhone(normalizedPhone);
      // remote === null/undefined يعني فشل الاتصال - لا تلمس البيانات المحلية
      if (!remote) { return; }

      let local = getOrders();
      let changed = false;
      const cashbackToAdd = [];
      const remoteIds = new Set(remote.map(r => String(r.order_number)));
      const CASHBACK_EXPIRE_MS = 30 * 24 * 60 * 60 * 1000;
      const cashbackExpiresAt = (order, remoteOrder) => {
        const raw = (remoteOrder && remoteOrder.cashback_expires_at) || order.cashbackAvailableAt || order.cashbackExpiresAt || '';
        if (raw) {
          const t = new Date(raw).getTime();
          if (!isNaN(t)) return t;
        }
        const deliveredBase = (remoteOrder && (remoteOrder.updated_at || remoteOrder.created_at)) || order.updatedAt || order.date || new Date().toISOString();
        const base = new Date(deliveredBase).getTime();
        return (isNaN(base) ? Date.now() : base) + CASHBACK_EXPIRE_MS;
      };
      const cashbackIsEarned = (order, remoteOrder) => {
        return (remoteOrder && remoteOrder.status || order.status) === 'delivered';
      };

      function hasCashbackCredit(orderId) {
        try {
          const cb = JSON.parse(localStorage.getItem('x2_cashback') || '{"history":[]}');
          return Array.isArray(cb.history) && cb.history.some(h => String(h.orderId || '') === String(orderId));
        } catch(e) { return false; }
      }

      function pushCashbackNotification(orderId, amount) {
        const formatted = (parseFloat(amount) || 5).toFixed((parseFloat(amount) || 5) % 1 ? 2 : 0);
        const notif = {
          id: 'n-cb-earned-' + orderId + '-' + Date.now(),
          type: 'cashback',
          icon: '🤑',
          title: '🤑 تم إضافة كاش باك',
          msg: `تم إضافة ${formatted} د.إ كاش باك في حسابك من طلبك رقم ${orderId}.`,
          cashbackStatus: 'earned',
          amount: parseFloat(amount) || 5,
          orderId,
          date: new Date().toISOString(),
          read: false,
          url: '/account?section=credit'
        };
        if (window.x2Notifications && typeof window.x2Notifications.add === 'function') {
          window.x2Notifications.add(notif);
          return;
        }
        try {
          const notifs = JSON.parse(localStorage.getItem('x2_notifications') || '[]');
          notifs.unshift(notif);
          localStorage.setItem('x2_notifications', JSON.stringify(notifs.slice(0, 60)));
          window.dispatchEvent(new Event('x2:notif-updated'));
        } catch(e) {}
      }

      function remoteOrderToLocal(r) {
        const parsedInvoice = getInvoiceFromNotes(r.notes || '');
        return {
          id: String(r.order_number || r.id || ''),
          date: r.created_at || r.updated_at || new Date().toISOString(),
          items: Array.isArray(r.items) ? r.items : [],
          total: parseFloat(r.total) || 0,
          status: r.status || 'processing',
          cashback: parseFloat(r.cashback) || 5,
          cashbackStatus: r.cashback_status || 'pending',
          cashbackAvailableAt: r.cashback_expires_at || '',
          cashbackExpiresAt: r.cashback_expires_at || '',
          notes: r.notes || '',
          invoice: parsedInvoice,
          shipping: r.address || {},
          _synced: true
        };
      }

      remote.forEach(r => {
        // مطابقة برقم الطلب (order_number) مع مقارنة نصية مرنة
        const idx = local.findIndex(o => String(o.id) === String(r.order_number));
        if (idx === -1) {
          const newLocalOrder = remoteOrderToLocal(r);
          local.unshift(newLocalOrder);
          if (cashbackIsEarned(newLocalOrder, r) && !hasCashbackCredit(newLocalOrder.id)) {
            newLocalOrder.cashbackStatus = 'earned';
            if (!newLocalOrder.cashbackExpiresAt) {
              const exp = new Date(cashbackExpiresAt(newLocalOrder, r)).toISOString();
              newLocalOrder.cashbackAvailableAt = exp;
              newLocalOrder.cashbackExpiresAt = exp;
            }
            cashbackToAdd.push({ orderId: newLocalOrder.id, amount: parseFloat(newLocalOrder.cashback || r.cashback || 5) });
          }
          changed = true;
          return;
        }
        const lo = local[idx];
        if (r.status && lo.status !== r.status) {
          lo.status = r.status;
          changed = true;
        }
        if (r.notes && lo.notes !== r.notes) {
          lo.notes = r.notes;
          lo.invoice = getInvoiceFromNotes(r.notes);
          changed = true;
        }
        if (r.cashback_expires_at && lo.cashbackAvailableAt !== r.cashback_expires_at) {
          lo.cashbackAvailableAt = r.cashback_expires_at;
          lo.cashbackExpiresAt = r.cashback_expires_at;
          changed = true;
        }
        if ((r.cashback_status || '').toLowerCase() === 'claimed' && lo.cashbackStatus !== 'claimed') {
          lo.cashbackStatus = 'claimed';
          changed = true;
        }
        // إضافة الكاش باك مرة واحدة فور التسليم، مع انتهاء صلاحية بعد 30 يوم إذا لم يستخدمه العميل
        if (lo.cashbackStatus !== 'claimed' && cashbackIsEarned(lo, r) && (lo.cashbackStatus !== 'earned' || !hasCashbackCredit(lo.id))) {
          lo.cashbackStatus = 'earned';
          if (!lo.cashbackExpiresAt) {
            const exp = new Date(cashbackExpiresAt(lo, r)).toISOString();
            lo.cashbackAvailableAt = exp;
            lo.cashbackExpiresAt = exp;
          }
          if (!hasCashbackCredit(lo.id)) cashbackToAdd.push({ orderId: lo.id, amount: parseFloat(lo.cashback || r.cashback || 5) });
          changed = true;
        }
      });

      // حذف الطلبات المحلية التي حذفها الأدمن من قاعدة البيانات
      // (فقط الطلبات التي وصلت فعلاً لـ Supabase مسبقاً - لا نحذف طلباً جديداً لم يُرفع بعد)
      const beforeCount = local.length;
      local = local.filter(o => o._synced !== true || remoteIds.has(String(o.id)));
      if (local.length !== beforeCount) changed = true;

      if (changed) {
        localStorage.setItem(ORDERS_KEY, JSON.stringify(local));
        if (window.x2Notifications && typeof window.x2Notifications.refresh === 'function') window.x2Notifications.refresh();
      }

      if (cashbackToAdd.length) {
        try {
          const CB_KEY = 'x2_cashback';
          const cb = JSON.parse(localStorage.getItem(CB_KEY) || '{"balance":0,"history":[]}');
          cb.history = cb.history || [];
          cashbackToAdd.forEach(c => {
            cb.balance = (parseFloat(cb.balance) || 0) + (c.amount || 5);
            cb.history.push({
              date: new Date().toLocaleDateString('ar-AE', { year:'numeric', month:'short', day:'numeric' }),
              amount: c.amount,
              orderId: c.orderId,
              note: 'كاش باك طلب ' + c.orderId
            });
            pushCashbackNotification(c.orderId, c.amount || 5);
          });
          localStorage.setItem(CB_KEY, JSON.stringify(cb));
        } catch(e2) {}
      }
    } catch(e) { }
  }

  function getStatusLabel(s) {
    const isEn = (localStorage.getItem('lang') || document.documentElement.lang) === 'en';
    const ar = { pending:'قيد الانتظار', processing:'قيد المعالجة', confirmed:'مؤكد', manufacturing:'في مرحلة التصنيع', ready:'طلبك جاهز', shipped:'تم الشحن', delivered:'تم التوصيل', cancelled:'ملغى', returned:'مرتجع' };
    const en = { pending:'Pending', processing:'Processing', confirmed:'Confirmed', manufacturing:'In Manufacturing', ready:'Ready for Pickup', shipped:'Shipped', delivered:'Delivered', cancelled:'Cancelled', returned:'Returned' };
    return (isEn ? en[s] : ar[s]) || (isEn ? 'Processing' : 'قيد المعالجة');
  }

  function getStatusClass(s) {
    return 'status-' + (s || 'processing');
  }

  function assignStatus(order) {
    if (order.status) return order.status;
    const d = new Date(order.date);
    const diff = (Date.now() - d.getTime()) / 1000 / 60 / 60;
    if (diff < 24) return 'processing';
    if (diff < 72) return 'shipped';
    return 'delivered';
  }

  const WA_PHONE = '971554423151';
  let _prodsCache = null;
  function waitForProductsApi() {
    if (window.Supabase && window.Supabase.Products) return Promise.resolve(true);
    return new Promise(resolve => {
      let tries = 0;
      const timer = setInterval(() => {
        tries++;
        if ((window.Supabase && window.Supabase.Products) || tries >= 20) {
          clearInterval(timer);
          resolve(!!(window.Supabase && window.Supabase.Products));
        }
      }, 100);
    });
  }
  function addProductsToMap(arr, map) {
    (arr || []).forEach(raw => {
      const p = typeof normalizeProduct === 'function' ? normalizeProduct(raw) : raw;
      if (p.id) map[String(p.id)] = p;
      const names = typeof p.name === 'object' ? [p.name.ar, p.name.en] : [p.name];
      names.filter(Boolean).forEach(nm => { map['__n__' + String(nm).trim().toLowerCase()] = p; });
    });
  }
  async function getProductsMap() {
    if (_prodsCache) return _prodsCache;
    try {
      const SS_KEY = 'x2_prods_ss';
      const cached = sessionStorage.getItem(SS_KEY);
      _prodsCache = {};
      if (cached) { const obj = JSON.parse(cached); if (Date.now()-obj.ts < 300000) { addProductsToMap(obj.data, _prodsCache); return _prodsCache; } }
      let arr = [];
      await waitForProductsApi();
      if (window.Supabase && window.Supabase.Products) arr = await window.Supabase.Products.getAll(800) || [];
      if (!arr.length) arr = await (await fetch('/java/Products.json')).json();
      try { sessionStorage.setItem(SS_KEY, JSON.stringify({ts:Date.now(),data:arr})); } catch(e2) {}
      addProductsToMap(arr, _prodsCache);
    } catch(e) { _prodsCache = {}; }
    return _prodsCache;
  }

  function getInvoiceFromNotes(notes) {
    const raw = String(notes || '');
    const idx = raw.indexOf(INVOICE_MARK);
    if (idx === -1) return null;
    try { return JSON.parse(raw.slice(idx + INVOICE_MARK.length).trim()); } catch(e) { return null; }
  }
  function getOrderInvoice(order) {
    return order && (order.invoice || getInvoiceFromNotes(order.notes));
  }
  function invoiceEarnedBadge(order) {
    const earned = order && order.status === 'delivered';
    return earned ? '<span style="background:#e7f7ee;color:#137744;border-radius:999px;padding:4px 8px;font-size:.72rem;font-weight:900">تم الاستحقاق ✓</span>' : '';
  }
  function invoiceMoney(value) {
    return (Math.round((Number(value)||0)*100)/100).toLocaleString('en-US') + ' ' + BANK_INFO.currency;
  }
  function invoiceRemaining(inv) {
    if (!inv) return 0;
    if (inv.remaining != null) return Math.max(0, Number(inv.remaining) || 0);
    return Math.max(0, (Number(inv.total) || 0) - (Number(inv.due) || 0));
  }
  function invoiceDueForOrder(order, inv) {
    return Number(inv && inv.due) || 0;
  }
  function invoiceRemainingForOrder(order, inv) {
    return order && order.status === 'delivered' ? 0 : invoiceRemaining(inv);
  }
  function invoiceProductImage(order) {
    const item = order && Array.isArray(order.items) && order.items[0] || {};
    return item.img || item.image || item.photo || item.thumbnail || item.cover || order.product_image || order.image || '/assets/logo.png';
  }
  function invoiceCopyText(inv) {
    return [
      `رقم الطلب: ${inv.orderNumber}`,
      `إجمالي الطلب: ${invoiceMoney(inv.total)}`,
      `المبلغ المطلوب: ${invoiceMoney(inv.due)}`,
      `المتبقي بعد التسليم: ${invoiceMoney(invoiceRemaining(inv))}`,
      `نوع الدفع: ${inv.typeLabel || ''}`,
      `اسم المصرف: ${BANK_INFO.bank}`,
      `اسم صاحب الحساب: ${BANK_INFO.beneficiary}`,
      `رقم الحساب: ${BANK_INFO.account}`,
      `رقم الآيبان: ${BANK_INFO.iban}`,
      `السويفت: ${BANK_INFO.swift}`,
      `العملة: ${BANK_INFO.currency}`,
      `سبب التحويل: Order ${inv.orderNumber}`,
      INVOICE_DEFAULT_NOTE
    ].join('\n');
  }
  function invoiceFileName(inv) {
    return 'bariq-invoice-' + String((inv && inv.orderNumber) || 'order').replace(/[^\w-]+/g, '-') + '.html';
  }
  async function invoiceLogoSrc() {
    try {
      const res = await fetch('/assets/logo.png', { cache: 'force-cache' });
      const blob = await res.blob();
      return await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve('https://bariqgifts.com/assets/logo.png');
        reader.readAsDataURL(blob);
      });
    } catch(e) { return 'https://bariqgifts.com/assets/logo.png'; }
  }
  function invoiceStandaloneHtml(inv, order, logoSrc) {
    const items = (order.items || []).map(i => `<tr><td>${escapeHtml(i.title || i.name || 'منتج')}</td><td>${Number(i.qty)||1}</td></tr>`).join('') || '<tr><td>تفاصيل الطلب</td><td>1</td></tr>';
    const bankRows = [
      ['اسم المصرف', BANK_INFO.bank],
      ['اسم صاحب الحساب', BANK_INFO.beneficiary],
      ['رقم الحساب', BANK_INFO.account],
      ['رقم الآيبان', BANK_INFO.iban],
      ['السويفت', BANK_INFO.swift],
      ['العملة', BANK_INFO.currency],
      ['سبب التحويل', 'Order ' + inv.orderNumber]
    ].map(([label, value]) => `<div class="bank-row"><span>${escapeHtml(label)}</span><b dir="ltr">${escapeHtml(value)}</b></div>`).join('');
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>فاتورة طلب ${escapeHtml(inv.orderNumber)}</title><style>body{margin:0;background:#f5f7fb;color:#152546;font-family:Tahoma,Arial,sans-serif}.page{max-width:760px;margin:24px auto;padding:16px}.invoice{background:#fff;border:1px solid #e5e9f2;border-radius:18px;overflow:hidden;box-shadow:0 14px 38px rgba(21,37,70,.12)}.head{background:linear-gradient(135deg,#fff,#fbf4dc);padding:22px;display:flex;gap:14px;align-items:center;border-bottom:1px solid #ece4c7}.logo{width:74px;height:74px;object-fit:contain;background:#fff;border:1px solid #eee;border-radius:14px}.title{font-size:1.3rem;font-weight:900;margin-bottom:6px}.muted{color:#7a8296;font-size:.9rem}.body{padding:22px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.sum{background:#f8f9fc;border:1px solid #e7eaf2;border-radius:12px;padding:12px}.sum span{display:block;color:#7a8296;font-size:.78rem;margin-bottom:5px}.sum b{font-size:1.05rem}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border-bottom:1px solid #edf0f6;padding:10px;text-align:right}.note{background:#fff8e1;border:1px solid #f1d27a;color:#6b5200;border-radius:12px;padding:12px;font-weight:800;margin:14px 0}.bank{display:grid;gap:9px;background:#f8f9fc;border:1px solid #e7eaf2;border-radius:14px;padding:12px}.bank-row{display:flex;justify-content:space-between;gap:14px;background:#fff;border:1px solid #edf0f6;border-radius:10px;padding:10px}.bank-row span{color:#7a8296}.footer{padding:14px 22px;color:#8b93a4;font-size:.82rem;border-top:1px solid #edf0f6}@media(max-width:640px){.summary{grid-template-columns:1fr}.head{align-items:flex-start}.page{padding:8px;margin:8px auto}}</style>
</head><body><div class="page"><section class="invoice"><div class="head"><img class="logo" src="${escapeHtml(logoSrc || 'https://bariqgifts.com/assets/logo.png')}" alt="Bariq"><div><div class="title">فاتورة طلب ${escapeHtml(inv.orderNumber)}</div><div class="muted">${escapeHtml(inv.customer || '')}${inv.phone ? ' · ' + escapeHtml(inv.phone) : ''}</div></div></div><div class="body"><div class="summary"><div class="sum"><span>إجمالي الطلب</span><b>${invoiceMoney(inv.total)}</b></div><div class="sum"><span>العربون / المطلوب الآن</span><b>${invoiceMoney(inv.due)}</b></div><div class="sum"><span>المتبقي بعد التسليم</span><b>${invoiceMoney(invoiceRemaining(inv))}</b></div></div><table><thead><tr><th>المنتج</th><th>الكمية</th></tr></thead><tbody>${items}</tbody></table><div>نوع الدفع: <b>${escapeHtml(inv.typeLabel || '')}</b></div><div class="note">${escapeHtml(inv.note || INVOICE_DEFAULT_NOTE)}</div><h3>بيانات التحويل</h3><div class="bank">${bankRows}</div></div><div class="footer">Bariq Gifts - هذه الفاتورة محفوظة كملف مستقل ويمكن فتحها مباشرة في المتصفح.</div></section></div></body></html>`;
  }
  async function downloadInvoiceHtml(inv, order) {
    const blob = new Blob([invoiceStandaloneHtml(inv, order, await invoiceLogoSrc())], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = invoiceFileName(inv);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.downloadInvoiceFile = async function(orderId) {
    const order = getOrders().find(o => String(o.id) === String(orderId));
    const inv = getOrderInvoice(order);
    if (!order || !inv) return;
    await downloadInvoiceHtml(inv, order);
  };
  function copyTextValue(value, label) {
    const text = String(value || '');
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => alert('تم نسخ ' + label)).catch(() => alert(text));
  }
  document.addEventListener('click', function(event) {
    const target = event.target.closest && event.target.closest('[data-invoice-copy-field],[data-invoice-copy-payment],[data-invoice-send-proof],[data-notif-open-orders],[data-rv-submit],[data-rv-delete]');
    if (!target) return;
    if (target.dataset.invoiceCopyField !== undefined) copyInvoiceField(target.dataset.invoiceCopyField || '', target.dataset.invoiceCopyLabel || 'البيان');
    else if (target.dataset.invoiceCopyPayment) copyInvoicePayment(target.dataset.invoiceCopyPayment);
    else if (target.dataset.invoiceSendProof) sendInvoiceProof(target.dataset.invoiceSendProof);
    else if (target.dataset.notifOpenOrders !== undefined) showSection('orders');
    else if (target.dataset.rvSubmit) submitPurchaseReview(Number(target.dataset.rvSubmit));
    else if (target.dataset.rvDeletePid !== undefined) deleteMyReview(target.dataset.rvDeletePid, Number(target.dataset.rvDeleteIndex));
  });
  document.addEventListener('error', function(event) {
    const img = event.target;
    if (!img || !img.dataset) return;
    if (img.dataset.fallbackLogo !== undefined && img.src.indexOf('/assets/logo.png') === -1) img.src = '/assets/logo.png';
    if (img.dataset.fallbackHide !== undefined) img.style.display = 'none';
  }, true);
  window.copyInvoiceField = function(value, label) { copyTextValue(value, label || 'البيان'); };
  window.copyInvoicePayment = function(orderId) {
    const order = getOrders().find(o => String(o.id) === String(orderId));
    const inv = getOrderInvoice(order);
    if (!inv) return;
    navigator.clipboard.writeText(invoiceCopyText(inv)).then(() => alert('تم نسخ بيانات التحويل')).catch(() => alert(invoiceCopyText(inv)));
  };
  window.sendInvoiceProof = function(orderId) {
    const order = getOrders().find(o => String(o.id) === String(orderId));
    const inv = getOrderInvoice(order);
    if (!inv) return;
    const text = `مرحباً، أرسلت إيصال الدفع في واتساب\nرقم الطلب: ${inv.orderNumber}\nالمبلغ: ${invoiceMoney(inv.due)}\nالاسم: ${inv.customer || ''}`;
    window.open('https://wa.me/' + BANK_INFO.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  };
  function renderAccountInvoices() {
    const box = document.getElementById('accountInvoicesList');
    if (!box) return;
    const invoices = getOrders().map(order => ({ order, invoice: getOrderInvoice(order) })).filter(x => x.invoice);
    if (!invoices.length) {
      box.innerHTML = `<div style="color:#8b93a4;font-size:.82rem;text-align:center;padding:12px">${accText('لا توجد فواتير محفوظة حتى الآن.', 'No saved invoices yet.')}</div>`;
      return;
    }
    const params = new URLSearchParams(location.search);
    const focus = params.get('order') || params.get('invoice');
    box.innerHTML = invoices.map(({ order, invoice }) => {
      const active = focus && String(invoice.orderNumber) === String(focus);
      const items = (order.items || []).map(i => `${i.title || i.name || 'منتج'} × ${Number(i.qty)||1}`).join('، ');
      const safeOrder = String(invoice.orderNumber || order.id || '').replace(/[^\w-]/g,'');
      const dueNow = invoiceDueForOrder(order, invoice);
      const remainingNow = invoiceRemainingForOrder(order, invoice);
      const earned = order && order.status === 'delivered';
      const productImage = invoiceProductImage(order);
      const bankRows = [
        [accText('اسم المصرف', 'Bank name'), BANK_INFO.bank],
        [accText('اسم صاحب الحساب', 'Account holder'), BANK_INFO.beneficiary],
        [accText('رقم الحساب', 'Account number'), BANK_INFO.account],
        [accText('رقم الآيبان', 'IBAN'), BANK_INFO.iban],
        [accText('السويفت', 'SWIFT'), BANK_INFO.swift],
        [accText('العملة', 'Currency'), BANK_INFO.currency]
      ];
      return `<details id="invoice-${safeOrder}" ${active ? 'open' : ''} style="background:#fff;border:${active?'2px solid #d4af37':'1px solid #e4e8f0'};border-radius:14px;overflow:hidden;box-shadow:0 8px 22px rgba(21,37,70,.08)">
        <summary style="list-style:none;cursor:pointer;padding:14px;background:linear-gradient(135deg,#fff,#fbf7ea);display:flex;align-items:center;gap:12px">
          <img src="${productImage}" alt="${items || 'Product'}" data-fallback-logo style="width:54px;height:54px;object-fit:cover;border-radius:10px;background:#fff;border:1px solid #eee">
          <div style="flex:1;min-width:0">
            <div style="font-weight:950;color:#152546;font-size:.98rem">${accText('فاتورة طلب', 'Invoice for order')} ${invoice.orderNumber}</div>
            <div style="font-size:.74rem;color:#8b93a4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${invoice.customer || ''} ${invoice.phone ? ' · ' + invoice.phone : ''}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;font-size:.72rem;font-weight:900">
              <span style="background:#eef3fb;color:#152546;border-radius:999px;padding:4px 8px">${accText('الإجمالي', 'Total')} ${invoiceMoney(invoice.total)}</span>
              <span style="background:#fff4cc;color:#8A6500;border-radius:999px;padding:4px 8px">${accText('العربون', 'Deposit')} ${invoiceMoney(dueNow)}</span>
              ${invoiceEarnedBadge(order)}
            </div>
          </div>
          <span style="color:#8b93a4;font-size:1.2rem">⌄</span>
        </summary>
        <div style="padding:14px;font-size:.84rem;color:#30384a;line-height:1.9">
          ${items ? `<div>🛒 ${items}</div>` : ''}
          <div>${accText('إجمالي الطلب:', 'Order total:')} <b>${invoiceMoney(invoice.total)}</b></div>
          <div>${accText('العربون / المطلوب الآن:', 'Deposit / due now:')} <b style="color:#8A6500">${invoiceMoney(dueNow)}</b> <span style="color:#8b93a4">(${invoice.typeLabel || ''})</span></div>
          <div>${accText('المتبقي بعد التسليم:', 'Remaining after delivery:')} <b>${invoiceMoney(remainingNow)}</b></div>
          <div style="background:#fff8e1;border:1px solid #f1d27a;color:#6b5200;border-radius:10px;padding:9px 10px;margin:9px 0;font-weight:800">${invoice.note || INVOICE_DEFAULT_NOTE}</div>
          <div style="margin-top:10px;background:#f8f9fc;border:1px solid #e7eaf2;border-radius:12px;padding:10px;display:${earned?'none':'grid'};gap:8px">
            ${bankRows.map(([label, value]) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid #edf0f6;border-radius:9px;padding:8px 9px"><span style="color:#7a8296">${label}</span><b dir="ltr" style="color:#152546;text-align:left;word-break:break-word">${value}</b><button data-invoice-copy-field="${escapeHtml(String(value))}" data-invoice-copy-label="${escapeHtml(label)}" style="border:none;background:#152546;color:#fff;border-radius:7px;padding:6px 9px;font-size:.72rem;font-weight:800;cursor:pointer;flex:0 0 auto">${accText('نسخ', 'Copy')}</button></div>`).join('')}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid #edf0f6;border-radius:9px;padding:8px 9px"><span style="color:#7a8296">${accText('سبب التحويل', 'Transfer reason')}</span><b dir="ltr" style="color:#152546">Order ${invoice.orderNumber}</b><button data-invoice-copy-field="Order ${escapeHtml(String(invoice.orderNumber))}" data-invoice-copy-label="${escapeHtml(accText('سبب التحويل', 'Transfer reason'))}" style="border:none;background:#152546;color:#fff;border-radius:7px;padding:6px 9px;font-size:.72rem;font-weight:800;cursor:pointer">${accText('نسخ', 'Copy')}</button></div>
          </div>
          <div style="display:${earned?'none':'flex'};gap:8px;flex-wrap:wrap;margin-top:12px">
            <button data-invoice-copy-payment="${escapeHtml(String(order.id))}" style="border:none;background:#152546;color:#fff;border-radius:9px;padding:8px 12px;font-size:.78rem;font-weight:800;cursor:pointer">${accText('نسخ بيانات التحويل', 'Copy transfer details')}</button>
            <button data-invoice-send-proof="${escapeHtml(String(order.id))}" style="border:none;background:#25D366;color:#fff;border-radius:9px;padding:8px 12px;font-size:.78rem;font-weight:800;cursor:pointer">${accText('إرسال إثبات الدفع واتساب', 'Send payment proof on WhatsApp')}</button>
          </div>
        </div>
      </details>`;
    }).join('');
  }
  window.refreshAccountInvoices = function() {
    syncOrdersFromSupabase().then(() => { renderAccountInvoices(); renderOrders(); });
  };

  function getFilteredOrders() {
    const orders = getOrders();
    return orders.filter(o => {
      const status = assignStatus(o);
      const matchStatus = currentStatus === 'all' || status === currentStatus;
      const q = currentSearch.toLowerCase();
      const matchSearch = !q || (o.id||'').toLowerCase().includes(q) ||
        (o.items||[]).some(i => (i.title||'').toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }

  async function renderOrders() {
    if (isRenderingOrders) return;
    isRenderingOrders = true;
    const list = document.getElementById('orders-list');
    const pgEl = document.getElementById('orders-pagination');
    const filtered = getFilteredOrders();

    if (!filtered.length) {
      list.innerHTML = `
        <div class="acc-empty">
          <div class="acc-empty-icon">📦</div>
          <div class="acc-empty-title">${accText('ليس لديك أي طلبات', 'You do not have any orders')}</div>
          <div class="acc-empty-sub">${accText('لا يمكنك العثور على طلبك؟', 'Can not find your order?')}</div>
          <div class="acc-empty-actions">
            <a href="/" class="acc-empty-btn"><span class="ico">🛍</span> <span>${accText('تسوق الآن', 'Shop Now')}</span></a>
          </div>
        </div>`;
      if (pgEl) pgEl.style.display = 'none';
      isRenderingOrders = false;
      return;
    }

    const pMap = await getProductsMap();
    const visibleCount = filtered.length;
    const pageItems = filtered;

    list.innerHTML = pageItems.map(order => {
      const status = assignStatus(order);
      const item = (order.items||[])[0] || {};
      const itemCount = (order.items||[]).length;
      const date = accDate(order.date);
      const oid = order.id || '';
      const prod = pMap[String(item.id||'')] || pMap['__n__'+(item.title||'').trim().toLowerCase()];
      const imgSrc = (item.img && !item.img.startsWith('data:') ? item.img : '') ||
                     (prod ? (Array.isArray(prod.img)?prod.img[0]:prod.img)||'' : '') ||
                     'assets/logo.png';
      const resolvedId = item.id || prod?.id || '';
      const prodLink = resolvedId ? `product.html?id=${encodeURIComponent(resolvedId)}` : '';
      const prodName = prod && typeof prod.name === 'object'
        ? (prod.name[ACC_EN ? 'en' : 'ar'] || prod.name.ar || prod.name.en || '')
        : (prod && prod.name ? String(prod.name) : '');
      const itemTitle = prodName || item.title || accText('منتج','Product');
      const displayTotal = parseFloat(order.total) > 0 ? fmt(order.total) : '—';
      const profile = (() => { try { return JSON.parse(localStorage.getItem('x2_profile')||'{}'); } catch(e) { return {}; } })();
      const nm = profile.name||'—'; const ph = profile.phone||'—';
      const waT = encodeURIComponent(ACC_EN ? `📦 Track order\nOrder number: ${oid}\nStatus: ${getStatusLabel(status)}\nName: ${nm}\nPhone: ${ph}\nPlease update me on my order 🙏` : `📦 تتبع طلب\nرقم الطلب: ${oid}\nالحالة: ${getStatusLabel(status)}\nالاسم: ${nm}\nالهاتف: ${ph}\nأرجو التحديث على طلبي 🙏`);
      const waR = encodeURIComponent(ACC_EN ? `↩️ Return request\nOrder number: ${oid}\nProduct: ${itemTitle||'—'}\nName: ${nm}\nPhone: ${ph}\nPlease help me with the return 🙏` : `↩️ طلب إرجاع\nرقم الطلب: ${oid}\nالمنتج: ${itemTitle||'—'}\nالاسم: ${nm}\nالهاتف: ${ph}\nأرجو مساعدتي في الإرجاع 🙏`);
      return `
        <div class="acc-order-card">
          ${prodLink
            ? `<a href="${prodLink}"><img src="${imgSrc}" alt="${item.title||''}" data-fallback-logo loading="lazy" style="cursor:pointer"></a>`
            : `<img src="${imgSrc}" alt="${item.title||''}" data-fallback-logo loading="lazy">`}
          <div class="acc-order-info">
            <div class="acc-order-name">${prodLink?`<a href="${prodLink}" style="color:#111;text-decoration:none;font-weight:600">${itemTitle}</a>`:itemTitle}${itemCount>1?` <span style="color:#aaa;font-size:0.75rem">+${itemCount-1} ${accText('منتج آخر','more item')}</span>`:''}</div>
            <div class="acc-order-id">${accText('رقم الطلب:', 'Order number:')} ${oid||'—'}</div>
            <div class="acc-order-meta">
              <span class="acc-order-status ${getStatusClass(status)}">${getStatusLabel(status)}</span>
              <span class="acc-order-price">${displayTotal}</span>
              <span class="acc-order-date">${date}</span>
            </div>
          </div>
          <div class="acc-order-actions">
            <a class="acc-order-btn" href="https://wa.me/${WA_PHONE}?text=${waT}" target="_blank" rel="noopener" style="text-decoration:none">📦 <span>${accText('تتبع','Track')}</span></a>
            <a class="acc-order-btn" href="https://wa.me/${WA_PHONE}?text=${waR}" target="_blank" rel="noopener" style="color:#e57373;text-decoration:none">↩️ <span>${accText('إرجاع','Return')}</span></a>
          </div>
        </div>`;
    }).join('');

    // Show all matching orders immediately; customers should not need to reach the page bottom to load older orders.
    if (pgEl) {
      pgEl.style.display = 'none';
      pgEl.innerHTML = '';
    }
    isRenderingOrders = false;
  }

  window.goToOrderPage = function(page) {
    const totalPages = Math.ceil(getFilteredOrders().length / PAGE_SIZE);
    currentPage = Math.max(1, Math.min(page, totalPages || 1));
    renderOrders();
    document.getElementById('orders-list')?.scrollIntoView({behavior:'smooth',block:'start'});
  };

  function maybeLoadMoreOrders() {
    const section = document.getElementById('section-orders');
    if (!section || section.style.display === 'none' || isRenderingOrders) return;
    const filtered = getFilteredOrders();
    if (currentPage * PAGE_SIZE >= filtered.length) return;
    const bottomGap = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
    if (bottomGap < 260) {
      currentPage += 1;
      renderOrders();
    }
  }
  window.addEventListener('scroll', maybeLoadMoreOrders, { passive: true });

  // tab filter
  window.filterByStatus = function(status, el) {
    currentStatus = status;
    currentPage = 1;
    document.querySelectorAll('.acc-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    renderOrders();
  };

  // search
  window.filterOrders = function() {
    currentSearch = document.getElementById('order-search').value;
    currentPage = 1;
    renderOrders();
  };

  // toggle sub-menu للطلبات
  window.toggleOrdersSub = function() {
    const sub = document.getElementById('orders-sub-menu');
    const arrow = document.getElementById('orders-sub-arrow');
    if (!sub) return;
    const isOpen = sub.style.display !== 'none';
    sub.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
  };

  // section navigation
  window.showSection = function(section, filter) {
    // hide all
    document.querySelectorAll('[id^="section-"]').forEach(el => el.style.display = 'none');

    // update sidebar active
    document.querySelectorAll('.acc-nav-item').forEach(el => el.classList.remove('active'));

    // update quick nav
    document.querySelectorAll('.aqn-btn').forEach(el => el.classList.remove('active'));
    const qmap = { orders:'aqn-orders', profile:'aqn-profile', coupons:'aqn-coupons', notifications:'aqn-notif' };
    if (qmap[section]) { const qel = document.getElementById(qmap[section]); if (qel) qel.classList.add('active'); }

    if (section === 'address') section = 'settings';
    const sections = ['orders','profile','notifications','offers','support','payment','invoices','settings','history','credit','reviews'];
    if (sections.includes(section)) {
      document.getElementById('section-' + section).style.display = '';
    } else {
      document.getElementById('section-generic').style.display = '';
      document.getElementById('generic-title').textContent =
        { coupons: accText('العروض والخصومات', 'Offers & Discounts'), credit: accText('كاش باك', 'Cashback'),
          history: accText('المفضلة', 'Wishlist'), settings: accText('عنواني', 'My Address'),
          payment: accText('طرق الدفع', 'Payment Methods'), security: accText('أمن الحساب', 'Account Security') }[section] || accText('قريباً', 'Coming Soon');
    }

    if (section === 'reviews') renderReviews();
    if (section === 'invoices') renderAccountInvoices();

    if (section === 'support' && !window._scInited) {
      window._scInited = true;
      setTimeout(initSupportChat, 100);
    }

    if (section === 'coupons') {
      document.getElementById('section-generic').style.display = 'none';
      document.getElementById('section-offers').style.display = '';
      renderOffers();
    }

    if (filter) filterByStatus(filter, null);
    renderOrders();
    // scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.matchMedia('(max-width: 768px)').matches) {
      const sidebar = document.getElementById('accSidebar');
      if (sidebar) sidebar.classList.remove('mobile-open');
    }
  };

  // منتجات في اهتمامك
  function renderHistory() {
    const grid = document.getElementById('historyGrid');
    if (!grid) return;
    try {
      const wishlist = JSON.parse(localStorage.getItem('x2_wishlist') || '[]');
      const history = JSON.parse(localStorage.getItem('x2_history') || '[]');
      let hist = wishlist.concat(history.filter(p => !wishlist.some(w => String(w.id) === String(p.id))));
      if (!hist.length) {
        grid.innerHTML = '<div class="hist-empty">♡ لم تضف أي منتجات للمفضلة بعد<br><small style="color:#ccc">اضغط علامة القلب في صفحة المنتج لتظهر هنا</small></div>';
        return;
      }
      const sym = {AED:'د.إ',USD:'$',SAR:'ر.س',EGP:'ج.م'}[localStorage.getItem('currency')||'AED']||'د.إ';
      grid.innerHTML = hist.map(p => `
        <a class="hist-card" href="product.html?id=${encodeURIComponent(p.id)}">
          <img class="hist-img" src="${p.img||'assets/logo.png'}" alt="${p.name}" data-fallback-logo loading="lazy">
          <div class="hist-info">
            <div class="hist-name">${p.name||'منتج'}</div>
            ${p.price ? `<div class="hist-price">${parseFloat(p.price).toFixed(2)} ${sym}</div>` : ''}
          </div>
        </a>`).join('');
    } catch(e) {
      grid.innerHTML = '<div class="hist-empty">⚠️ تعذّر تحميل التاريخ</div>';
    }
  }

  window.clearHistory = function() {
    localStorage.removeItem('x2_wishlist');
    localStorage.removeItem('x2_history');
    renderHistory();
  };

  // تحديث renderHistory عند فتح القسم
  const _origShowSection = window.showSection;
  window.showSection = function(section, filter) {
    _origShowSection && _origShowSection(section, filter);
    if (section === 'history') renderHistory();
  };

  // profile
  // كاش باك
  const CASHBACK_KEY = 'x2_cashback';

  function getCashback() {
    try {
      const raw = localStorage.getItem(CASHBACK_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      // لو JSON object {balance, history} أو رقم مباشر
      return typeof parsed === 'number' ? parsed : (parseFloat(parsed.balance) || 0);
    } catch(e) { return 0; }
  }

  function renderCashback() {
    const balEl = document.getElementById('cbBalance');
    const hist  = document.getElementById('cbHistory');
    const sym   = accText('د.إ', 'AED');
    const creditText = {
      'رصيد كاش باك': 'Cashback Balance',
      'د.إ': 'AED',
      'تحصل على': 'You get',
      'مع كل طلب': 'with every order',
      'سجل الطلبات': 'Order History',
      'كوبون خصم جاهز!': 'Discount Coupon Ready!',
      'استخدم الكود في السلة': 'Use the code in cart',
      'نسخ': 'Copy',
      'يُستخدم مرة واحدة فقط · الخصم يُطبَّق في السلة': 'One-time use only · Discount applies in cart',
      'اجمع 5 د.إ كاش باك واحصل على كوبون خصم': 'Collect 5 AED cashback and get a discount coupon'
    };
    document.querySelectorAll('#section-credit [data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n') || '';
      if (creditText[key]) el.textContent = accText(key, creditText[key]);
    });

    const orders = (() => { try { return JSON.parse(localStorage.getItem('x2_orders')||'[]'); } catch(e) { return []; } })();

    // حساب الرصيد الحقيقي من الطلبات (فقط غير المنتهية)
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const cashbackExpiresAt = o => {
      const raw = o.cashbackAvailableAt || o.cashbackExpiresAt || '';
      if (raw) {
        const t = new Date(raw).getTime();
        if (!isNaN(t)) return t;
      }
      const base = new Date(o.updatedAt || o.date || new Date().toISOString()).getTime();
      return (isNaN(base) ? now : base) + THIRTY_DAYS;
    };

    // فلترة الطلبات حسب حالة الكاش باك
    // earned = تم التسليم وأُضيف للرصيد
    // pending = لم يُسلَّم بعد
    // claimed = استُخدم في كوبون
    // (الطلبات القديمة بدون cashbackStatus: نحكم من status)
    const getEffectiveStatus = o => {
      if (o.cashbackStatus === 'claimed') return 'claimed';
      if (o.status !== 'delivered') return 'pending';
      if (cashbackExpiresAt(o) <= now) return 'expired';
      if (o.cashbackStatus === 'earned' || !o.cashbackStatus || o.cashbackStatus === 'pending') return 'earned';
      return 'pending';
    };

    // مساعدة: احسب مبلغ الكاش باك للطلب (القديم قد لا يملك الحقل)
    const getCbAmount = o => {
      const v = parseFloat(o.cashback);
      if (v > 0) return v;
      // الطلبات القديمة المستحقة بدون حقل cashback → تُعامل كـ 5 د.إ
      if (getEffectiveStatus(o) === 'earned') return 5;
      return 0;
    };
    const getOrderCashbackKey = o => String(o && (o.id || o.orderNumber || o.order_number || o.srcId || '') || '').trim();
    const uniqueCashbackOrders = list => {
      const seen = new Set();
      const out = [];
      (Array.isArray(list) ? list : []).forEach(o => {
        const key = getOrderCashbackKey(o);
        if (key && seen.has(key)) return;
        if (key) seen.add(key);
        out.push(o);
      });
      return out;
    };

    const reconcileUsedCashbackCoupon = list => {
      let storedCoupon = null;
      try { storedCoupon = JSON.parse(localStorage.getItem('x2_coupon_code') || 'null'); } catch(e) {}
      if (!storedCoupon || !storedCoupon.used || !storedCoupon.code) return false;
      const migrationKey = 'x2_cashback_claim_migration_' + String(storedCoupon.code).toUpperCase();
      try { if (localStorage.getItem(migrationKey) === '1') return false; } catch(e) {}

      const generatedAt = storedCoupon.generated ? new Date(storedCoupon.generated).getTime() : 0;
      let changed = false;
      (Array.isArray(list) ? list : []).forEach(o => {
        const expiresAt = cashbackExpiresAt(o);
        const orderTime = new Date(o.updatedAt || o.date || new Date().toISOString()).getTime();
        const existedWhenCouponWasMade = !generatedAt || isNaN(orderTime) || orderTime <= generatedAt;
        if (o.status === 'delivered' && expiresAt > now && existedWhenCouponWasMade && o.cashbackStatus !== 'claimed') {
          o.cashbackStatus = 'claimed';
          changed = true;
        }
      });
      if (changed) {
        try { localStorage.setItem('x2_orders', JSON.stringify(orders)); } catch(e) {}
      }
      try { localStorage.setItem(migrationKey, '1'); } catch(e) {}
      return changed;
    };

    let uniqueOrders = uniqueCashbackOrders(orders);
    if (reconcileUsedCashbackCoupon(uniqueOrders)) uniqueOrders = uniqueCashbackOrders(orders);
    const validOrders   = uniqueOrders.filter(o => {
      if (getCbAmount(o) <= 0) return false;
      if (getEffectiveStatus(o) !== 'earned') return false;
      return true;
    });

    // الرصيد = فقط الطلبات المسلّمة التي مر عليها 30 يوم ولم تُستخدم
    const ordersBalance = validOrders.reduce((s,o) => s + getCbAmount(o), 0);
    const displayBalance = ordersBalance;

    try {
      const storedCashback = JSON.parse(localStorage.getItem(CASHBACK_KEY) || '{}');
      if (!storedCashback || typeof storedCashback !== 'object' || parseFloat(storedCashback.balance) !== displayBalance) {
        localStorage.setItem(CASHBACK_KEY, JSON.stringify(Object.assign({}, storedCashback || {}, { balance: displayBalance, history: Array.isArray(storedCashback && storedCashback.history) ? storedCashback.history : [] })));
      }
    } catch(e) {}

    if (balEl) balEl.textContent = displayBalance.toFixed(2) + ' ' + sym;

    // عرض سجل الطلبات (valid أولاً ثم expired)
    if (hist) {
      const allCb = uniqueOrders.filter(o => getCbAmount(o) > 0 || getEffectiveStatus(o) === 'earned');
      if (!allCb.length) {
        hist.innerHTML = `<p style="color:#aaa;text-align:center;font-size:.8rem">${accText('لم تضع أي طلب بعد', 'You have not placed any orders yet')}</p>`;
      } else {
        hist.innerHTML = allCb.slice(0,10).map(o => {
          const d = new Date(o.date).toLocaleDateString(ACC_EN ? 'en-US' : 'ar-AE',{year:'numeric',month:'short',day:'numeric'});
          const cbStatus = getEffectiveStatus(o);
          const expiresAt = cashbackExpiresAt(o);
          const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (24*60*60*1000)));

          let statusBadge, amtColor, bgColor, opacity = 1;
          if (cbStatus === 'claimed') {
            statusBadge = `<span style="font-size:.68rem;color:#fff;background:#888;padding:1px 7px;border-radius:999px">${accText('تم الاستحقاق ✓', 'Claimed ✓')}</span>`;
            amtColor = '#bbb'; bgColor = '#f5f5f5'; opacity = 0.6;
          } else if (cbStatus === 'pending') {
            statusBadge = `<span style="font-size:.68rem;color:#e65100;background:#fff3e0;padding:1px 7px;border-radius:999px">⏳ ${accText('استحقاق بعد التسليم', 'Earns after delivery')}</span>`;
            amtColor = '#e65100'; bgColor = '#fffbf5';
          } else if (cbStatus === 'waiting') {
            statusBadge = `<span style="font-size:.68rem;color:#e65100;background:#fff3e0;padding:1px 7px;border-radius:999px">⏳ ${accText('استحقاق بعد التسليم', 'Earns after delivery')}</span>`;
            amtColor = '#e65100'; bgColor = '#fffbf5';
          } else if (cbStatus === 'expired') {
            statusBadge = `<span style="font-size:.68rem;color:#c62828;background:#fce4ec;padding:1px 7px;border-radius:999px">${accText('انتهت الصلاحية', 'Expired')}</span>`;
            amtColor = '#bbb'; bgColor = '#fafafa'; opacity = 0.55;
          } else if (cbStatus === 'earned') {
            statusBadge = `<span style="font-size:.68rem;color:#2e7d32;background:#e8f5e9;padding:1px 7px;border-radius:999px">${ACC_EN ? `Expires in ${daysLeft} days` : `ينتهي خلال ${daysLeft} يوم`}</span>`;
            amtColor = '#2e7d32'; bgColor = '#f8f9fc';
          } else {
            statusBadge = `<span style="font-size:.68rem;color:#9aa3b2">${accText('قيد المراجعة', 'Pending')}</span>`;
            amtColor = '#e65100'; bgColor = '#fffbf5';
          }

          const cbAmt = getCbAmount(o);
          const prefix = cbStatus === 'earned' ? '+' : '';
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:${bgColor};border-radius:8px;margin-bottom:7px;font-size:.8rem;opacity:${opacity}">
            <div>
              <div style="font-weight:700;color:#111">${accText('طلب', 'Order')} ${o.id||''}</div>
              <div style="color:#9aa3b2;font-size:.7rem;margin-top:2px">${d} · ${statusBadge}</div>
            </div>
            <span style="font-size:.84rem;font-weight:800;color:${amtColor};background:${bgColor === '#f8f9fc' ? '#e8f5e9' : bgColor};padding:3px 10px;border-radius:999px">${prefix}${cbAmt.toFixed(2)} ${sym}</span>
          </div>`;
        }).join('');
      }
    }

    // ===== كوبون الخصم =====
    const COUPON_MIN = 5;
    const couponSection  = document.getElementById('cbCouponSection');
    const progressSection = document.getElementById('cbProgressSection');
    const couponCodeEl   = document.getElementById('cbCouponCode');
    const couponSubEl    = document.getElementById('cbCouponSubText');
    const progressFill   = document.getElementById('cbProgressFill');
    const progressLabel  = document.getElementById('cbProgressLabel');

    if (displayBalance >= COUPON_MIN) {
      let storedCoupon = null;
      try { storedCoupon = JSON.parse(localStorage.getItem('x2_coupon_code') || 'null'); } catch(e) {}
      if (!storedCoupon || storedCoupon.used) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = 'CB-';
        for (let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
        storedCoupon = { code, amount: displayBalance, used: false, generated: new Date().toISOString() };
        localStorage.setItem('x2_coupon_code', JSON.stringify(storedCoupon));
      } else {
        storedCoupon.amount = displayBalance;
        localStorage.setItem('x2_coupon_code', JSON.stringify(storedCoupon));
      }
      if (couponSection)   couponSection.style.display   = 'block';
      if (progressSection) progressSection.style.display  = 'none';
      if (couponCodeEl)    couponCodeEl.textContent = storedCoupon.code;
      if (couponSubEl)     couponSubEl.textContent  = ACC_EN ? `Your balance is ${displayBalance.toFixed(2)} ${sym} - use the code in cart` : `رصيدك ${displayBalance.toFixed(2)} ${sym} — استخدم الكود في السلة`;
    } else {
      if (couponSection)   couponSection.style.display   = 'none';
      if (progressSection) progressSection.style.display  = 'block';
      const pct = Math.min(100, (displayBalance/COUPON_MIN)*100);
      if (progressFill)  progressFill.style.width   = pct + '%';
      if (progressLabel) progressLabel.textContent   = `${displayBalance.toFixed(2)} / ${COUPON_MIN} ${sym}`;
    }
  }

  window.copyCouponCode = function() {
    try {
      const c = JSON.parse(localStorage.getItem('x2_coupon_code')||'null');
      if (!c || !c.code) return;
      const btn = document.querySelector('.coupon-copy-btn');
      const done = () => { if (btn) { btn.textContent = accText('✅ تم النسخ', '✅ Copied'); setTimeout(() => btn.textContent = accText('📋 نسخ', '📋 Copy'), 2200); } };
      if (navigator.clipboard) navigator.clipboard.writeText(c.code).then(done).catch(() => { const t=document.createElement('textarea');t.value=c.code;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);done(); });
      else { const t=document.createElement('textarea');t.value=c.code;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);done(); }
    } catch(e) {}
  };

  // تحديث showSection لعرض الكاش باك
  const _origShow2 = window.showSection;
  window.showSection = function(section, filter) {
    _origShow2 && _origShow2(section, filter);
    if (section === 'credit') renderCashback();
    if (section === 'notifications') renderNotifications();
  };

  // ===== عرض الإشعارات =====
  function hasBrokenNotificationText(value) {
    return /^\s*[\?\s\uFFFD\.]+\s*$/.test(String(value || ''));
  }

  function isMostlyBrokenNotificationText(value) {
    const text = String(value || '');
    if (!text) return false;
    const brokenCount = (text.match(/[\?\uFFFD]/g) || []).length;
    const letterCount = (text.match(/[A-Za-z\u0600-\u06FF]/g) || []).length;
    return brokenCount >= 3 && brokenCount > letterCount;
  }

  function hasMojibakeText(value) {
    const text = String(value || '');
    return /(?:\u00d8|\u00d9|\u00d0|\u00d1|\u00c3|\u00c2|\u00f0\u0178|\u00e2|\u0153|\u2122)/.test(text);
  }

  const WINDOWS_1252_BYTES = {};
  [
    [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
    [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E],
    [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
    [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F]
  ].forEach(pair => { WINDOWS_1252_BYTES[String.fromCharCode(pair[0])] = pair[1]; });

  function mojibakeBytes(text) {
    const bytes = new Uint8Array(text.length);
    for (let j = 0; j < text.length; j++) {
      const ch = text[j];
      bytes[j] = Object.prototype.hasOwnProperty.call(WINDOWS_1252_BYTES, ch) ? WINDOWS_1252_BYTES[ch] : (text.charCodeAt(j) & 255);
    }
    return bytes;
  }

  function repairMojibakeText(value) {
    let text = String(value || '');
    if (!text) return text;
    for (let i = 0; i < 4; i++) {
      if (!hasMojibakeText(text)) break;
      try {
        const bytes = mojibakeBytes(text);
        let fixed = '';
        if (typeof TextDecoder !== 'undefined') {
          fixed = new TextDecoder('utf-8').decode(bytes);
        } else {
          fixed = decodeURIComponent(escape(text));
        }
        if (!fixed || fixed === text) break;
        text = fixed;
      } catch(e) {
        try {
          const fixed2 = decodeURIComponent(escape(text));
          if (!fixed2 || fixed2 === text) break;
          text = fixed2;
        } catch(e2) {
          break;
        }
      }
    }
    return text;
  }

  function getLocalOrderStatus(orderId) {
    if (!orderId) return '';
    try {
      const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
      const order = orders.find(o => String(o.id || o.order_number || '') === String(orderId));
      return order ? (order.status || 'processing') : '';
    } catch(e) { return ''; }
  }

  function getLocalOrderCashback(orderId) {
    if (!orderId) return 0;
    try {
      const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
      const order = orders.find(o => String(o.id || o.order_number || '') === String(orderId));
      return order ? (parseFloat(order.cashback) || 0) : 0;
    } catch(e) { return 0; }
  }

  function normalizeCashbackNotification(n) {
    n = n || {};
    n.title = repairMojibakeText(n.title || '');
    n.msg = repairMojibakeText(n.msg || n.body || '');
    n.icon = repairMojibakeText(n.icon || '');
    const rawText = `${n.title || ''} ${n.msg || n.body || ''}`;
    let orderId = n.orderId || n.order_id || '';
    if (!orderId) {
      const match = rawText.match(/#?\s*([A-Z]*-?\d{3,})/i);
      if (match) orderId = match[1];
    }
    const amountMatch = rawText.match(/(\d+(?:\.\d+)?)/);
    const amount = parseFloat(n.amount || n.cashback || getLocalOrderCashback(orderId) || (amountMatch && amountMatch[1]) || 5) || 5;
    const orderText = orderId ? (ACC_EN ? ` from order #${String(orderId).replace(/^#/, '')}` : ` من طلبك رقم ${orderId}`) : '';
    const isEarned = n.cashbackStatus === 'earned' || n.status === 'earned' || /^n-cb-earned-/.test(String(n.id || '')) || /تم\s+إضافة|تم\s+اضافة|في حسابك/.test(rawText);
    if (isEarned) {
      return {
        ...n,
        type: 'cashback',
        cashbackStatus: 'earned',
        icon: '🤑',
        title: ACC_EN ? '🤑 Cashback Added' : '🤑 تم إضافة كاش باك',
        msg: ACC_EN ? `${amount.toFixed(amount % 1 ? 2 : 0)} AED cashback was added to your account${orderText}.` : `تم إضافة ${amount.toFixed(amount % 1 ? 2 : 0)} د.إ كاش باك في حسابك${orderText}.`,
        orderId
      };
    }
    return {
      ...n,
      type: 'cashback',
      icon: '🤑',
      title: ACC_EN ? '🤑 Cashback Pending' : '🤑 كاش باك بانتظارك',
      msg: ACC_EN ? `You earned ${amount.toFixed(amount % 1 ? 2 : 0)} AED cashback${orderText}. It will activate after the order is approved.` : `حصلت على ${amount.toFixed(amount % 1 ? 2 : 0)} د.إ كاش باك${orderText}. سيتم تفعيله بعد اعتماد الطلب.`,
      orderId
    };
  }

  function normalizeOrderNotification(n) {
    n = n || {};
    n.title = repairMojibakeText(n.title || '');
    n.msg = repairMojibakeText(n.msg || n.body || '');
    n.icon = repairMojibakeText(n.icon || '');
    if (n.type === 'cashback') return normalizeCashbackNotification(n);
    const rawText = `${n.title || ''} ${n.msg || n.body || ''}`.toLowerCase();
    const inferredStatus =
      (/delivered|تم التوصيل|وصل بنجاح/.test(rawText) ? 'delivered' :
      /shipped|تم شحن|في الطريق/.test(rawText) ? 'shipped' :
      /ready|جاهز/.test(rawText) ? 'ready' :
      /manufactur|تصنيع|يصن/.test(rawText) ? 'manufacturing' :
      /confirm|تأكيد|مؤكد/.test(rawText) ? 'confirmed' :
      /cancel|إلغاء|الغاء|ملغ/.test(rawText) ? 'cancelled' :
      /return|إرجاع|ارجاع|مرتجع/.test(rawText) ? 'returned' :
      /pending|مراجعة|انتظار/.test(rawText) ? 'pending' :
      /processing|معالجة|تجهيز/.test(rawText) ? 'processing' : '');
    let orderId = n.orderId || n.order_id || '';
    if (!orderId) {
      const match = rawText.match(/#?\s*(\d{3,})/);
      if (match) orderId = match[1];
    }
    const localStatus = getLocalOrderStatus(orderId);
    const isBrokenOrderText = isMostlyBrokenNotificationText(rawText) || hasBrokenNotificationText(n.icon) || hasBrokenNotificationText(n.title);
    const status = n.status || n.orderStatus || inferredStatus || localStatus || ((n.type === 'order_status' || n.type === 'order_new' || (orderId && isBrokenOrderText)) ? 'processing' : '');
    const isOrder = n.type === 'order_status' || n.type === 'order_new' || orderId || status;
    if (!isOrder) return n;
    const orderText = orderId ? (ACC_EN ? ` #${String(orderId).replace(/^#/, '')}` : ` رقم ${orderId}`) : '';
    const map = {
      pending:       { icon: '⏳', title: accText('طلبك قيد المراجعة', 'Order Under Review'),       msg: ACC_EN ? `Your order${orderText} is being reviewed` : `طلبك${orderText} يُراجَع الآن` },
      processing:    { icon: '🔄', title: accText('طلبك قيد المعالجة', 'Order Processing'),         msg: ACC_EN ? `Your order${orderText} is being prepared` : `جارٍ تجهيز طلبك${orderText}` },
      confirmed:     { icon: '✅', title: accText('تم تأكيد طلبك', 'Order Confirmed'),              msg: ACC_EN ? `Your order${orderText} has been confirmed and will be prepared soon 🎉` : `طلبك${orderText} تم تأكيده وسيُجهَّز قريباً 🎉` },
      manufacturing: { icon: '🔨', title: accText('طلبك في مرحلة التصنيع', 'Order in Production'), msg: ACC_EN ? `Your order${orderText} is being carefully made ✨` : `طلبك${orderText} يُصنَّع الآن بعناية ✨` },
      ready:         { icon: '🎁', title: accText('طلبك جاهز للاستلام', 'Order Ready for Pickup'),  msg: ACC_EN ? `Your order${orderText} is ready and waiting for you 🎉` : `طلبك${orderText} جاهز وبانتظارك 🎉` },
      shipped:       { icon: '🚚', title: accText('تم شحن طلبك', 'Order Shipped'),                 msg: ACC_EN ? `Your order${orderText} is on the way` : `طلبك${orderText} في الطريق إليك` },
      delivered:     { icon: '✅', title: accText('تم توصيل طلبك', 'Order Delivered'),             msg: ACC_EN ? `Your order${orderText} was delivered successfully 🎉` : `طلبك${orderText} وصل بنجاح 🎉` },
      cancelled:     { icon: '❌', title: accText('تم إلغاء طلبك', 'Order Cancelled'),             msg: ACC_EN ? `Your order${orderText} was cancelled` : `طلبك${orderText} تم إلغاؤه` },
      returned:      { icon: '↩️', title: accText('تمت عملية الإرجاع', 'Return Processed'),        msg: ACC_EN ? `Your order${orderText} return has been processed` : `تمت معالجة إرجاع طلبك${orderText}` }
    };
    const ar = map[status] || null;
    if (!ar) return { ...n, icon: n.icon || '🔔' };
    // نستخدم أيقونة الحالة الرسمية دائماً بدل محاولة قراءة أيقونة واردة من
    // الإشعار، لأن أي تشويه ترميز (Mojibake) في حقل الأيقونة القديم لا يُكتشف
    // بواسطة hasBrokenNotificationText الضيقة، فيظهر رمز غريب (مثل علم دولة)
    // بدل الأيقونة الصحيحة رغم أن باقي النص عربي سليم.
    const icon = ar.icon;
    return { ...n, type: 'order_status', status, icon, title: icon + ' ' + ar.title, msg: ar.msg, orderId };
  }

  function renderNotifications() {
    const listEl   = document.getElementById('notifList');
    const countEl  = document.getElementById('notifUnreadCount');
    const markBtn  = document.getElementById('notifMarkAllBtn');
    const aqnBadge = document.getElementById('aqnNotifBadge');
    if (!listEl) return;

    const notifs = (window.x2Notifications ? window.x2Notifications.getAll() : []).map(normalizeOrderNotification);
    const unread = notifs.filter(n => !n.read).length;

    if (countEl) { countEl.textContent = unread > 0 ? (ACC_EN ? `${unread} New` : `${unread} جديد`) : ''; countEl.style.display = unread > 0 ? 'inline' : 'none'; }
    if (markBtn) markBtn.style.display = unread > 0 ? 'inline' : 'none';

    // تحديث badge الزر السريع
    if (aqnBadge) { aqnBadge.textContent = unread > 0 ? String(unread) : ''; aqnBadge.style.display = unread > 0 ? 'inline' : 'none'; }

    // تحديد كمقروء تلقائياً عند الفتح
    if (window.x2Notifications) window.x2Notifications.markAllRead();

    if (!notifs.length) {
      listEl.innerHTML = `<div class="notif-empty">🔔<br>${accText('لا توجد إشعارات حتى الآن', 'No notifications yet')}<br><small style="color:#ccc">${accText('ستظهر هنا تحديثات طلباتك والعروض', 'Your order updates and offers will appear here')}</small></div>`;
      return;
    }

    listEl.innerHTML = notifs.map((n, idx) => {
      const date = n.date ? new Date(n.date).toLocaleDateString(ACC_EN ? 'en-US' : 'ar-AE',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
      return `<div class="notif-item${n.read?'':' unread'}" ${n.orderId ? 'data-notif-open-orders' : ''}  >
        <span class="notif-icon">${n.icon||'🔔'}</span>
        <div class="notif-body">
          <div class="notif-title">${n.title||''}</div>
          <div class="notif-msg">${n.msg||''}</div>
          <div class="notif-date">${date}</div>
        </div>
        ${!n.read?'<span class="notif-dot"></span>':''}
      </div>`;
    }).join('');
  }

  window.markAllNotifsRead = function() {
    markCurrentOrdersSeen();
    if (window.x2Notifications) window.x2Notifications.markAllRead();
    renderNotifications();
    const b = document.getElementById('aqnNotifBadge');
    if (b) { b.textContent = ''; b.style.display = 'none'; }
    if (typeof clearBadge === 'function') clearBadge();
    else if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(()=>{});
    closeDisplayedPushNotifications().catch(()=>{});
  };

  async function clearPushInboxStore() {
    if (!('indexedDB' in window)) return;
    try {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('bariq-push-inbox', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('notifications', 'readwrite');
        tx.objectStore('notifications').clear();
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch(e) {}
  }

  async function closeDisplayedPushNotifications() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise(resolve => setTimeout(() => resolve(null), 1200))
      ]);
      if (!reg) return;
      if (reg.getNotifications) {
        const notifications = await reg.getNotifications();
        notifications.forEach(notification => notification.close());
      }
    } catch(e) {}
  }

  function markCurrentOrdersSeen() {
    try {
      const seen = JSON.parse(localStorage.getItem('x2_notif_seen') || '{}');
      const orders = JSON.parse(localStorage.getItem('x2_orders') || '[]');
      orders.forEach(order => {
        const oid = order.id || '';
        if (!oid) return;
        const status = order.status || 'processing';
        seen['ord-' + oid] = status;
        if (order.cashback) seen['cb-' + oid] = 1;
        order.seen = true;
        order.notif_seen = true;
        order.read = true;
      });
      localStorage.setItem('x2_notif_seen', JSON.stringify(seen));
      localStorage.setItem('x2_orders', JSON.stringify(orders));
    } catch(e) {}
  }

  window.clearAllNotifs = async function() {
    markCurrentOrdersSeen();
    try {
      localStorage.setItem('x2_notifications', '[]');
      localStorage.removeItem('x2_notif_clear_until');
    } catch(e) {}
    await clearPushInboxStore();
    closeDisplayedPushNotifications().catch(()=>{});
    renderNotifications();
    const b = document.getElementById('aqnNotifBadge');
    if (b) { b.textContent = ''; b.style.display = 'none'; }
    // تحديث badge التنقل السفلي
    window.__accountCount = '';
    document.querySelectorAll('.account-badge').forEach(el => el.setAttribute('data-count', '0'));
    if (typeof clearBadge === 'function') clearBadge();
    else if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(()=>{});
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        if (reg.active) {
          reg.active.postMessage({ type: 'CLEAR_BADGE' });
          reg.active.postMessage({ type: 'CLEAR_PUSH_INBOX' });
        }
      }).catch(()=>{});
    }
    window.dispatchEvent(new Event('x2:notif-updated'));
  };

  try { localStorage.removeItem('x2_notif_clear_until'); } catch(e) {}

  // تحديث badge الزر السريع عند التحميل
  function mergeNotificationItem(item) {
    if (item && item.notification && typeof item.notification === 'object') {
      item = { ...item.notification, ...item };
    }
    if (item && item.payload && typeof item.payload === 'object') {
      item = { ...item.payload, ...item };
    }
    if (item && item.data && typeof item.data === 'object') {
      item = { ...item.data, ...item };
    }
    if (!item || (!item.title && !item.msg)) return false;
    item = normalizeOrderNotification(item);
    const notifs = window.x2Notifications ? window.x2Notifications.getAll() : (() => { try { return JSON.parse(localStorage.getItem('x2_notifications') || '[]'); } catch(e) { return []; } })();
    const id = item.id || ('push-' + Date.now());
    if (notifs.some(n => n.id === id)) return false;
    notifs.unshift({ id, type: item.type || 'push', icon: item.icon || '🔔', title: item.title || 'إشعار جديد', msg: item.msg || item.body || '', date: item.date || new Date().toISOString(), read: item.read === true ? true : false, orderId: item.orderId || item.order_id || '', url: item.url || '' });
    try { localStorage.setItem('x2_notifications', JSON.stringify(notifs.slice(0, 60))); } catch(e) {}
    if (typeof updateAqnBadge === 'function') updateAqnBadge();
    if (document.getElementById('section-notifications')?.style.display !== 'none') renderNotifications();
    return true;
  }

  async function importPushInbox() {
    if (!('indexedDB' in window)) return;
    try {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('bariq-push-inbox', 1);
        req.onupgradeneeded = function() {
          const db = req.result;
          if (!db.objectStoreNames.contains('notifications')) db.createObjectStore('notifications', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const items = await new Promise((resolve, reject) => {
        const tx = db.transaction('notifications', 'readonly');
        const req = tx.objectStore('notifications').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      db.close();
      if (items.length) {
        let changed = false;
        items.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0)).forEach(item => { if (mergeNotificationItem(item)) changed = true; });
        if (changed && window.x2Notifications) window.dispatchEvent(new Event('x2:notif-updated'));
      }
    } catch(e) {}
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'X2_PUSH_NOTIFICATION') mergeNotificationItem(e.data.notification);
    });
  }

  function updateAqnBadge() {
    const count = window.x2Notifications ? window.x2Notifications.getCount() : 0;
    const b = document.getElementById('aqnNotifBadge');
    if (b) { b.textContent = count > 0 ? String(count) : ''; b.style.display = count > 0 ? 'inline' : 'none'; }
  }
  setTimeout(updateAqnBadge, 500);
  importPushInbox().then(updateAqnBadge);
  window.addEventListener('x2:notif-updated', updateAqnBadge);

  function getJwtEmail() {
    try {
      const token = localStorage.getItem('x2_token') || '';
      const payload = token.split('.')[1];
      if (!payload) return '';
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      return String(JSON.parse(atob(normalized)).email || '').trim().toLowerCase();
    } catch(e) { return ''; }
  }

  async function syncProfileToUserSync(profile, oldProfile) {
    if (!window.sbFetch || !profile) return false;
    const authEmail = getJwtEmail();
    const rowEmail = String(authEmail || oldProfile?.email || profile.email || '').trim().toLowerCase();
    if (!rowEmail) return false;
    const data = {
      name: profile.name || '',
      email: rowEmail,
      phone: normalizeUaePhone(profile.phone || ''),
      address: profile.address || '',
      address_full: profile.address_full || null,
      ts: Date.now()
    };
    try {
      const existing = await window.sbFetch('user_sync?user_email=eq.' + encodeURIComponent(rowEmail) + '&data_type=eq.profile&select=id&limit=1');
      const body = { user_email: rowEmail, data_type: 'profile', data, updated_at: new Date().toISOString() };
      if (existing && existing[0]) {
        return await window.sbFetch('user_sync?id=eq.' + existing[0].id, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(body) });
      }
      return await window.sbFetch('user_sync', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(body) });
    } catch(e) { return false; }
  }

  window.saveAddress = function() {
    const addr = {
      country:  document.getElementById('addr-country').value,
      city:     document.getElementById('addr-city').value.trim(),
      area:     document.getElementById('addr-area').value.trim(),
      street:   document.getElementById('addr-street').value.trim(),
      building: document.getElementById('addr-building').value.trim(),
      zip:      document.getElementById('addr-zip').value.trim(),
      notes:    document.getElementById('addr-notes').value.trim()
    };
    try {
      const p = JSON.parse(localStorage.getItem('x2_profile') || '{}');
      p.address_full = addr;
      localStorage.setItem('x2_profile', JSON.stringify(p));
      syncProfileToUserSync(p, p).catch(()=>{});
    } catch(e) {}
    alert('✅ تم حفظ العنوان');
  };

  window.saveProfile = function() {
    const oldProfile = (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch(e) { return {}; } })();
    const accountEmail = String(getJwtEmail() || oldProfile.email || document.getElementById('pf-email').value || '').trim().toLowerCase();
    const phone = normalizeUaePhone(document.getElementById('pf-phone').value);
    if (!phone) {
      alert('⚠️ أدخل رقم هاتف إماراتي صحيح بعد +971');
      enforceUaePhoneInput(document.getElementById('pf-phone'));
      return;
    }
    const p = {
      ...oldProfile,
      name: document.getElementById('pf-name').value.trim(),
      email: accountEmail,
      address: document.getElementById('pf-address').value.trim(),
      phone,
      password: document.getElementById('pf-password').value
    };
    document.getElementById('pf-email').value = accountEmail;
    document.getElementById('pf-phone').value = formatUaePhoneInput(phone);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch(e) {}
    saveCustomerProfileToSupabase(p, oldProfile).catch(()=>{});
    syncProfileToUserSync(p, oldProfile).catch(()=>{});
    syncOrdersFromSupabase().then(() => renderOrders());
    if (p.name) {
      document.getElementById('profile-name').textContent = p.name;
      document.getElementById('avatar-letter').textContent = p.name.charAt(0);
    }
    updateSidebarProfile(p);
    alert('✅ تم حفظ التغييرات');
  };

  window.changePassword = function() {
    const newPassword = document.getElementById('pf-new-password').value;
    const confirmPassword = document.getElementById('pf-confirm-password').value;
    const profile = getProfile();

    if (!newPassword || !confirmPassword) {
      alert('⚠️ من فضلك املأ كل حقول تغيير كلمة السر');
      return;
    }
    if (newPassword.length < 6) {
      alert('⚠️ كلمة السر الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('❌ كلمة السر الجديدة وتأكيدها غير متطابقين');
      return;
    }

    const updated = { ...profile, password: newPassword };
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(updated)); } catch(e) {}
    const passwordField = document.getElementById('pf-password');
    if (passwordField) passwordField.value = newPassword;
    document.getElementById('pf-new-password').value = '';
    document.getElementById('pf-confirm-password').value = '';
    alert('✅ تم تغيير كلمة السر بنجاح');
  };

  window.togglePasswordField = function(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input || !button) return;
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    button.textContent = hidden ? 'إخفاء' : 'إظهار';
  };

  function updateSidebarProfile(p) {
    const profile = p || getProfile();
    const name = (profile.name || 'حسابي').trim();
    const email = (profile.email || 'مرحباً بك').trim();
    const avatar = name ? name.charAt(0) : 'م';
    const nameEl = document.getElementById('sidebar-name');
    const emailEl = document.getElementById('sidebar-email');
    const avatarEl = document.getElementById('sidebar-avatar');
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email || 'مرحباً بك';
    if (avatarEl) avatarEl.textContent = avatar;
  }

  function getPriceValue(value) {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  }

  // توحيد بيانات المنتج من Supabase أو Products.json
  function normalizeProduct(p) {
    return {
      id:       p.id,
      name:     { ar: p.name_ar || (p.name && p.name.ar) || p.name || 'منتج',
                  en: p.name_en || (p.name && p.name.en) || '' },
      price:    getPriceValue(p.price),
      oldPrice: getPriceValue(p.old_price || p.oldPrice),
      img:      p.image || p.img || 'assets/logo.png',
      date:     p.created_at || p.createdAt || p.updated_at || p.updatedAt || p.date || '',
      rating:   p.rating || 5
    };
  }

  function newestProductValue(p) {
    const raw = p && (p.created_at || p.createdAt || p.updated_at || p.updatedAt || p.date || '');
    const time = raw ? new Date(raw).getTime() : 0;
    if (!isNaN(time) && time > 0) return time;
    const id = Number(p && (p.id || p.productId || 0));
    return Number.isFinite(id) ? id : 0;
  }

  function dailyProductValue(p) {
    const today = new Date(), dayKey = today.getFullYear() * 1e4 + (today.getMonth()+1) * 100 + today.getDate();
    const key = String(p && (p.id || p.productId || (p.name && (p.name.ar || p.name.en)) || p.name || ''));
    let hash = dayKey;
    for (let i=0; i<key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return hash;
  }

  function sortAccountProducts(products) {
    const copy = (products || []).slice();
    const mode = localStorage.getItem('x2_store_product_sort') || 'daily_random';
    if (mode === 'newest') return copy.sort((a,b) => newestProductValue(b) - newestProductValue(a));
    if (mode === 'oldest') return copy.sort((a,b) => newestProductValue(a) - newestProductValue(b));
    if (mode === 'price_asc') return copy.sort((a,b) => (a.price||0) - (b.price||0));
    if (mode === 'price_desc') return copy.sort((a,b) => (b.price||0) - (a.price||0));
    if (mode === 'discount') return copy.sort((a,b) => ((b.oldPrice-b.price)/(b.oldPrice||1)) - ((a.oldPrice-a.price)/(a.oldPrice||1)));
    if (mode === 'rating') return copy.sort((a,b) => (parseFloat(b.rating)||0) - (parseFloat(a.rating)||0));
    return copy.sort((a,b) => dailyProductValue(b) - dailyProductValue(a));
  }

  function getDiscountedProducts(products) {
    return sortAccountProducts((products || [])
      .map(normalizeProduct)
      .filter(p => p.oldPrice > p.price && p.price > 0));
  }

  function renderOfferCard(product) {
    const name = (product?.name?.[ACC_EN ? 'en' : 'ar'] || product?.name?.ar || product?.name?.en || product?.name || accText('منتج', 'Product')).toString();
    const price = getPriceValue(product.price);
    const oldPrice = getPriceValue(product.oldPrice);
    const discount = oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
    const img = Array.isArray(product.img) ? product.img[0] : product.img || 'assets/logo.png';
    const link = product.id ? `product.html?id=${encodeURIComponent(product.id)}` : 'product.html';
    const savedAmt = (oldPrice - price).toFixed(2);
    return `
      <a class="product-card" href="${link}" style="text-decoration:none;">
        <span class="offer-badge">-${discount}%</span>
        <img class="product-img" src="${img}" alt="${name}" data-fallback-logo>
        <div class="product-content" style="padding:6px 8px 8px;">
          <div class="product-name">${name}</div>
          <div class="product-price-row">
            <span class="product-price product-price-discount">${price.toFixed(2)} ${accText('د.إ', 'AED')}</span>
          </div>
          <span class="product-old-price-striked">${oldPrice.toFixed(2)} ${accText('د.إ', 'AED')}</span>
          <div class="product-timer-save-box" style="margin-top:4px;">
            <span class="product-save-text">${accText('وفّر', 'Save')} ${savedAmt} ${accText('د.إ', 'AED')}</span>
          </div>
        </div>
      </a>`;
  }

  async function renderOffers() {
    const list = document.getElementById('offers-list');
    const count = document.getElementById('offers-count');
    if (!list || !count) return;

    list.textContent = '';

    try {
      try {
        if (window.Supabase && window.Supabase.Settings) {
          const settings = await window.Supabase.Settings.get();
          if (settings && settings.product_sort) localStorage.setItem('x2_store_product_sort', settings.product_sort);
        }
      } catch(e) {}
      let products = [];

      // جلب من Supabase أولاً (المصدر الحقيقي للمنتجات)
      if (window.Supabase && window.Supabase.Products) {
        products = await window.Supabase.Products.getAll(800) || [];
      }

      // fallback على Products.json لو Supabase غير متاح
      if (!products.length) {
        const res = await fetch(PRODUCTS_URL, { cache: 'no-store' });
        products = await res.json();
      }

      const discounted = getDiscountedProducts(products);
      offersLoaded = true;
      count.textContent = ACC_EN ? `${discounted.length} Offers` : `${discounted.length} عرض`;

      if (!discounted.length) {
        list.innerHTML = `
          <div class="acc-empty" style="padding:24px 12px; margin:0;">
            <div class="acc-empty-icon" style="font-size:2rem;">🎁</div>
            <div class="acc-empty-title">${accText('لا توجد عروض حالياً', 'No offers right now')}</div>
            <div class="acc-empty-sub">${accText('سنضيف هنا كل المنتجات التي عليها خصم فور توفرها', 'Discounted products will appear here when available')}</div>
          </div>`;
        return;
      }
      list.innerHTML = discounted.map(renderOfferCard).join('');
    } catch (error) {
      count.textContent = ACC_EN ? '0 Offers' : '0 عرض';
      list.innerHTML = `
        <div class="acc-empty" style="padding:24px 12px; margin:0;">
          <div class="acc-empty-icon" style="font-size:2rem;">⚠️</div>
          <div class="acc-empty-title">${accText('تعذر تحميل العروض', 'Could not load offers')}</div>
          <div class="acc-empty-sub">${accText('أعد المحاولة لاحقاً', 'Please try again later')}</div>
        </div>`;
    }
  }

  // ===== Self-Service Chat =====
  const SC_ANSWERS = {
    'تتبع طلبي': accText('لتتبع طلبك، اذهب لقسم **طلباتي** من القائمة، ستجد آخر حالة لكل طلب مع رقمه وتاريخ التوصيل المتوقع. 📦\n\nإذا مضى أكثر من 7 أيام ولم يصلك، تواصل معنا على واتساب مباشرة.', 'To track your order, open **My Orders** from the menu. You will see the latest status, order number, and expected delivery date. 📦\n\nIf more than 7 days have passed, contact us directly on WhatsApp.'),
    'كيف أرجع منتج': accText('يمكنك الإرجاع خلال **10 أيام** من تاريخ الاستلام بشرط أن يكون المنتج بحالته الأصلية.\n\n**خطوات الإرجاع:**\n1️⃣ راسلنا على واتساب برقم طلبك\n2️⃣ أرسل صور للمنتج\n3️⃣ سنحدد موعد الاستلام\n\nالإرجاع مجاني 🎉', 'You can return an item within **10 days** of delivery if it is still in its original condition.\n\n**Return steps:**\n1️⃣ Message us on WhatsApp with your order number\n2️⃣ Send photos of the product\n3️⃣ We will arrange the pickup time\n\nReturns are free 🎉'),
    'طرق الدفع': accText('نقبل طرق دفع متعددة:\n\n💳 فيزا / ماستركارد / أمريكان إكسبريس\n📱 Apple Pay / Google Pay\n🏦 تحويل بنكي\n💵 الدفع عند الاستلام (مناطق محددة)\n\nجميع المعاملات مشفرة وآمنة 100% 🔒', 'We accept several payment methods:\n\n💳 Visa / Mastercard / American Express\n📱 Apple Pay / Google Pay\n🏦 Bank transfer\n💵 Cash on delivery in selected areas\n\nAll transactions are encrypted and 100% secure 🔒'),
    'موعد التوصيل': accText('مواعيد التوصيل:\n\n📍 **داخل الإمارات:** 2-7 أيام عمل\n🌍 **السعودية والخليج:** 3-10 أيام\n✈️ **دول أخرى:** 7-14 يوم\n\nستصلك رسالة نصية عند خروج الشحنة مع رابط التتبع 📲', 'Delivery times:\n\n📍 **UAE:** 2-7 business days\n🌍 **Saudi Arabia and Gulf:** 3-10 days\n✈️ **Other countries:** 7-14 days\n\nYou will receive an SMS with the tracking link when the shipment leaves 📲'),
    'هل يوجد خصومات': accText('نعم! لدينا عروض دائمة:\n\n🔥 عروض يومية في صفحة **العروض**\n🎁 كوبون ترحيبي للمشتركين الجدد\n📧 اشترك في النشرة البريدية للحصول على خصم 10%\n⭐ عملاء VIP يحصلون على خصم دائم 15%', 'Yes. We always have offers:\n\n🔥 Daily deals on the **Offers** page\n🎁 Welcome coupon for new subscribers\n📧 Subscribe to the newsletter for 10% off\n⭐ VIP customers get a permanent 15% discount'),
    'هل يوجد تغليف هدايا': accText('نعم، نوفر تغليف هدايا أنيق لمعظم المنتجات 🎀\n\nيمكنك طلب التغليف في ملاحظات الطلب، أو مراسلتنا على واتساب بعد الطلب مباشرة برقم الطلب. سنؤكد لك توفر التغليف قبل التجهيز.', 'Yes, elegant gift wrapping is available for most products 🎀\n\nRequest it in the order notes, or message us on WhatsApp after ordering with your order number. We will confirm availability before preparation.'),
    'كيف أغير عنوان التوصيل': accText('يمكنك تغيير عنوان التوصيل قبل خروج الطلب للشحن.\n\nافتح واتساب وأرسل لنا:\n1️⃣ رقم الطلب\n2️⃣ العنوان الجديد كامل\n3️⃣ رقم الهاتف للتواصل\n\nإذا خرج الطلب بالفعل، سنحاول التنسيق مع شركة الشحن حسب الإمكانية 📍', 'You can change the delivery address before the order ships.\n\nOpen WhatsApp and send us:\n1️⃣ Order number\n2️⃣ Full new address\n3️⃣ Contact phone number\n\nIf the order has already shipped, we will coordinate with the carrier where possible 📍'),
    'تحدث مع موظف': accText('سأوصلك بفريق الدعم الآن! 👋\n\nوقت العمل: **السبت - الخميس 9ص - 7م**\n\nاضغط على الزر أدناه للتواصل المباشر:', 'I will connect you with our support team now. 👋\n\nWorking hours: **Saturday - Thursday, 9 AM - 7 PM**\n\nTap the button below to contact us directly:')
  };

  const SC_FALLBACK = accText('شكراً لسؤالك! للإجابة الدقيقة على استفسارك، اضغط على **"تحدث مع موظف"** أو تواصل معنا عبر واتساب وسيرد عليك فريقنا خلال دقائق. 😊', 'Thanks for your question. For the most accurate help, choose **"Real Agent"** or contact us on WhatsApp and our team will reply within minutes. 😊');
  const SC_WELCOME = accText('مرحباً بك! 👋 أنا Ahmed مساعد، كيف يمكنني مساعدتك اليوم؟\n\nاختر من الأسئلة الشائعة أدناه أو اكتب سؤالك مباشرة.', 'Welcome! 👋 I am Ahmed Assistant. How can I help you today?\n\nChoose one of the common questions below or type your question directly.');

  function normalizeSupportQuestion(value) {
    return String(value || '').replace(/[؟?!.،,]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function getSupportAnswer(question) {
    const q = normalizeSupportQuestion(question);
    const key = Object.keys(SC_ANSWERS).find(k => {
      const normalizedKey = normalizeSupportQuestion(k);
      return q === normalizedKey || q.includes(normalizedKey) || normalizedKey.includes(q);
    });
    return key ? SC_ANSWERS[key] : SC_FALLBACK;
  }

  function initSupportChat() {
    const msgs = document.getElementById('scMessages');
    if (!msgs || msgs.children.length) return;
    addBotMessage(SC_WELCOME, false);
  }

  function addBotMessage(text, animate=true) {
    const msgs = document.getElementById('scMessages');
    if (!msgs) return;

    if (animate) {
      // typing indicator
      const typing = document.createElement('div');
      typing.className = 'sc-msg bot';
      typing.id = 'scTyping';
      typing.innerHTML = `<div class="sc-avatar">🤖</div><div class="sc-bubble" style="padding:0"><div class="sc-typing"><span></span><span></span><span></span></div></div>`;
      msgs.appendChild(typing);
      msgs.scrollTop = msgs.scrollHeight;

      setTimeout(() => {
        typing.remove();
        renderBotBubble(text, msgs);
      }, 900 + Math.min(text.length * 18, 1400));
    } else {
      renderBotBubble(text, msgs);
    }
  }

  function renderBotBubble(text, msgs) {
    const now = new Date().toLocaleTimeString(ACC_EN ? 'en-US' : 'ar', {hour:'2-digit', minute:'2-digit'});
    const div = document.createElement('div');
    div.className = 'sc-msg bot';
    // تحويل **bold** وأسطر جديدة
    const html = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    div.innerHTML = `<div class="sc-avatar">🤖</div><div><div class="sc-bubble">${html}</div><div class="sc-time">${now}</div></div>`;
    msgs.appendChild(div);

    // إذا كان رد "تحدث مع موظف" → أضف زر واتساب
    if (text.includes('اضغط على الزر أدناه') || text.includes('Tap the button below')) {
      const waBtn = document.createElement('div');
      waBtn.style.cssText = 'padding:4px 0 0 36px;';
      waBtn.innerHTML = `<a href="https://wa.me/971554423151?text=%D9%85\u0631\u062d\u0628\u0627\u060c%20\u0623\u062d\u062a\u0627\u062c%20\u0645\u0633\u0627\u0639\u062f\u0629" target="_blank" style="display:inline-flex;align-items:center;gap:7px;background:#25D366;color:#fff;border-radius:20px;padding:8px 16px;font-size:0.78rem;font-weight:700;text-decoration:none;">💬 ${accText('فتح واتساب', 'Open WhatsApp')}</a>`;
      msgs.appendChild(waBtn);
    }

    msgs.scrollTop = msgs.scrollHeight;
  }

  function addUserMessage(text) {
    const msgs = document.getElementById('scMessages');
    if (!msgs) return;
    const now = new Date().toLocaleTimeString(ACC_EN ? 'en-US' : 'ar', {hour:'2-digit', minute:'2-digit'});
    const div = document.createElement('div');
    div.className = 'sc-msg user';
    div.innerHTML = `<div><div class="sc-bubble">${text}</div><div class="sc-time" style="text-align:left">${now}</div></div><div class="sc-avatar">👤</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  window.askSupport = function(q) {
    addUserMessage(q);
    addBotMessage(getSupportAnswer(q));
  };

  window.sendSupportMsg = function() {
    const inp = document.getElementById('scInput');
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    addUserMessage(text);
    addBotMessage(getSupportAnswer(text));
  };

  window.clearSupportChat = function() {
    const msgs = document.getElementById('scMessages');
    if (msgs) { msgs.innerHTML = ''; window._scInited = false; }
    initSupportChat();
  };

  window.showLogoutModal = function() {
    const m = document.getElementById('logoutModal');
    if (m) { m.style.display = 'flex'; }
  };
  window.hideLogoutModal = function() {
    const m = document.getElementById('logoutModal');
    if (m) { m.style.display = 'none'; }
  };
  window.doLogout = function() {
    const keysToRemove = ['x2_profile','x2_token','x2_orders','x2_cart','x2_cashback','x2_orders_synced','x2_logged','x2_coupon_applied','x2_coupon_code','x2_order_counter'];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
    window.location.href = 'login.html?logout=1';
  };

  // load profile
  window.logoutAccount = window.showLogoutModal;

  function loadProfile() {
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      const normalizedPhone = normalizeUaePhone(p.phone);
      if (normalizedPhone && p.phone !== normalizedPhone) {
        p.phone = normalizedPhone;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      }
      if (p.name) {
        document.getElementById('pf-name').value = p.name;
        document.getElementById('profile-name').textContent = p.name;
        document.getElementById('avatar-letter').textContent = p.name.charAt(0);
      }
      if (p.email) {
        const emailInput = document.getElementById('pf-email');
        emailInput.value = p.email;
        emailInput.readOnly = true;
        emailInput.style.background = '#f7f8fb';
        document.getElementById('profile-email').textContent = p.email;
      }
      if (p.address) document.getElementById('pf-address').value = p.address;
      // تحميل العنوان الكامل
      if (p.address_full) {
        const a = p.address_full;
        if (a.country)  { const el=document.getElementById('addr-country');  if(el) el.value=a.country; }
        if (a.city)     { const el=document.getElementById('addr-city');     if(el) el.value=a.city; }
        if (a.area)     { const el=document.getElementById('addr-area');     if(el) el.value=a.area; }
        if (a.street)   { const el=document.getElementById('addr-street');   if(el) el.value=a.street; }
        if (a.building) { const el=document.getElementById('addr-building'); if(el) el.value=a.building; }
        if (a.zip)      { const el=document.getElementById('addr-zip');      if(el) el.value=a.zip; }
        if (a.notes)    { const el=document.getElementById('addr-notes');    if(el) el.value=a.notes; }
      }
      document.getElementById('pf-phone').value = formatUaePhoneInput(p.phone);
      if (p.password) document.getElementById('pf-password').value = p.password;
      updateSidebarProfile(p);
    } catch(e) {}
  document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('accSidebar');
    const btn = document.querySelector('.acc-mobile-menu-btn');
    if (!sidebar || !btn) return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && !btn.contains(e.target)) {
      sidebar.classList.remove('mobile-open');
    }
  });

  document.getElementById('accSidebar')?.addEventListener('click', function(e) {
    e.stopPropagation();
  });
  }

  // ===== تقييماتي =====
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function readReviewPhoto(input) {
    return new Promise(resolve => {
      const file = input && input.files && input.files[0];
      if (!file) return resolve('');
      if (!file.type || !file.type.startsWith('image/') || file.size > 900 * 1024) {
        alert(accText('اختر صورة أقل من 900 كيلوبايت', 'Choose an image smaller than 900 KB'));
        return resolve('');
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  async function renderReviews() {
    const listEl  = document.getElementById('myReviewsList');
    const countEl = document.getElementById('myReviewsCount');
    if (!listEl) return;

    let localReviews = [];
    let publishedReviews = [];
    try {
      const stored = JSON.parse(localStorage.getItem('admin_reviews') || '{}');
      Object.entries(stored).forEach(([pid, rvs]) => {
        (rvs||[]).forEach(rv => localReviews.push({ ...rv, pid, source: 'local' }));
      });
    } catch(e) {}

    // جلب أسماء المنتجات من cache أو Products.json
    let pMap = {};
    try {
      pMap = await getProductsMap();
    } catch(e) {}

    const productName = (item, prod) => {
      if (prod && typeof prod.name === 'object') return prod.name[ACC_EN ? 'en' : 'ar'] || prod.name.ar || prod.name.en || item.title || accText('منتج','Product');
      if (prod && prod.name) return String(prod.name);
      return item.title || accText('منتج','Product');
    };
    const productImage = (item, prod) => {
      const prodImg = prod && prod.img ? (Array.isArray(prod.img) ? prod.img[0] : prod.img) : '';
      return (item.img && !String(item.img).startsWith('data:') ? item.img : '') || prodImg || 'assets/logo.png';
    };

    try {
      const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      const reviewName = String(profile.name || '').trim();
      if (reviewName && window.sbFetch) {
        const rows = await window.sbFetch('reviews?name=eq.' + encodeURIComponent(reviewName) + '&order=date.desc&limit=200');
        publishedReviews = (Array.isArray(rows) ? rows : []).map(row => ({
          id: row.id,
          pid: String(row.product_id || ''),
          name: row.name || reviewName,
          rating: row.rating,
          text: row.text || '',
          date: row.date || row.created_at || '',
          source: 'published'
        }));
      }
    } catch(e) { publishedReviews = []; }

    const localKeys = new Set(localReviews.map(rv => [String(rv.pid||''), String(rv.text||''), String(rv.date||'').slice(0, 19)].join('|')));
    publishedReviews = publishedReviews.filter(rv => !localKeys.has([String(rv.pid||''), String(rv.text||''), String(rv.date||'').slice(0, 19)].join('|')));
    localReviews.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    publishedReviews.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const allReviews = localReviews.concat(publishedReviews).sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    if (countEl) countEl.textContent = allReviews.length + ' ' + accText('تقييم', 'Reviews');

    const reviewedPairs = new Set(allReviews.map(review => String(review.pid || review.product_id || '') + '|' + String(review.orderId || '')));
    const deliveredItems = [];
    getOrders().filter(order => assignStatus(order) === 'delivered').forEach(order => {
      (order.items || []).forEach((item, itemIndex) => {
        const prod = pMap[String(item.id || item.productId || item.product_id || '')] || pMap['__n__' + String(item.title || '').trim().toLowerCase()];
        const pid = String(item.id || item.productId || item.product_id || prod?.id || 'order-' + (order.id || '') + '-' + itemIndex);
        if (reviewedPairs.has(pid + '|' + String(order.id || ''))) return;
        deliveredItems.push({ orderId: order.id || '', pid, item, prod });
      });
    });

    const stars = n => '★'.repeat(Math.max(0,Math.min(5,n||5))) + '☆'.repeat(5-Math.max(0,Math.min(5,n||5)));

    const pendingHtml = deliveredItems.length ? `
      <div class="my-rv-section-label">${accText('منتجات تم تسليمها - قيّم مشترياتك', 'Delivered products - review your purchases')}</div>
      ${deliveredItems.map((entry, idx) => {
        const pname = productName(entry.item, entry.prod);
        const pimg = productImage(entry.item, entry.prod);
        const link = entry.prod?.id || entry.item.id ? `product.html?id=${encodeURIComponent(entry.prod?.id || entry.item.id)}` : '#';
        return `<div class="my-rv-form-card" data-rv-pid="${escapeHtml(entry.pid)}">
          <a href="${link}" class="my-rv-form-head">
            <img src="${escapeHtml(pimg)}" alt="" loading="lazy" data-fallback-logo>
            <span><span class="my-rv-form-title">${escapeHtml(pname)}</span><span class="my-rv-form-sub">${accText('طلب رقم', 'Order')} ${escapeHtml(entry.orderId || '—')}</span></span>
          </a>
          <div class="my-rv-rate" data-review-stars="${idx}">${[1,2,3,4,5].map(n => `<span class="on" data-v="${n}">★</span>`).join('')}</div>
          <textarea class="my-rv-comment" id="rvComment-${idx}" placeholder="${accText('اكتب تعليقك عن المنتج...', 'Write your comment about the product...')}"></textarea>
          <div class="my-rv-form-actions">
            <label class="my-rv-photo">📷 ${accText('إضافة صورة', 'Add Photo')}<input type="file" id="rvPhoto-${idx}" accept="image/*"></label>
            <button class="my-rv-submit" data-rv-submit="${idx}">${accText('إرسال التقييم', 'Submit Review')}</button>
          </div>
        </div>`;
      }).join('')}` : '';

    window.__pendingPurchaseReviews = deliveredItems;

    const publishedHtml = publishedReviews.length ? `<div class="my-rv-section-label">${accText('تعليقاتك المنشورة', 'Your published comments')}</div>` + publishedReviews.map(rv => {
      const prod  = pMap[String(rv.pid)];
      const pname = prod ? (prod.title||prod.name?.[ACC_EN ? 'en' : 'ar']||prod.name?.ar||prod.name?.en||prod.name||`${accText('منتج','Product')} #${rv.pid}`) : `${accText('منتج','Product')} #${rv.pid}`;
      const pimg  = prod && prod.img && !String(Array.isArray(prod.img)?prod.img[0]:prod.img).startsWith('data:')
        ? (Array.isArray(prod.img)?prod.img[0]:prod.img) : '';
      const date  = rv.date ? new Date(rv.date).toLocaleDateString(ACC_EN ? 'en-US' : 'ar-AE',{year:'numeric',month:'short',day:'numeric'}) : '';
      const link  = rv.pid ? `product.html?id=${encodeURIComponent(rv.pid)}` : '#';
      return `<div class="my-rv-card">
        <a href="${link}" class="my-rv-product">
          ${pimg ? `<img src="${escapeHtml(pimg)}" alt="" loading="lazy" data-fallback-hide>` : '<span style="font-size:1.8rem;flex-shrink:0">📦</span>'}
          <span class="my-rv-pname">${escapeHtml(pname)}</span>
        </a>
        <div class="my-rv-stars">${stars(rv.rating)}</div>
        <div class="my-rv-text">${escapeHtml(rv.text||'')}</div>
        <div class="my-rv-footer">
          <span class="my-rv-date">${date}</span>
          <span class="my-rv-date">${accText('منشور', 'Published')}</span>
        </div>
      </div>`;
    }).join('') : '';

    const reviewsHtml = localReviews.length ? `<div class="my-rv-section-label">${accText('تقييماتك المحفوظة', 'Your saved reviews')}</div>` + localReviews.map((rv, idx) => {
      const prod  = pMap[String(rv.pid)];
      const pname = prod ? (prod.title||prod.name?.[ACC_EN ? 'en' : 'ar']||prod.name?.ar||prod.name?.en||prod.name||`${accText('منتج','Product')} #${rv.pid}`) : `${accText('منتج','Product')} #${rv.pid}`;
      const pimg  = prod && prod.img && !String(Array.isArray(prod.img)?prod.img[0]:prod.img).startsWith('data:')
        ? (Array.isArray(prod.img)?prod.img[0]:prod.img) : '';
      const date  = rv.date ? new Date(rv.date).toLocaleDateString(ACC_EN ? 'en-US' : 'ar-AE',{year:'numeric',month:'short',day:'numeric'}) : '';
      const link  = rv.pid ? `product.html?id=${encodeURIComponent(rv.pid)}` : '#';
      return `<div class="my-rv-card">
        <a href="${link}" class="my-rv-product">
          ${pimg ? `<img src="${escapeHtml(pimg)}" alt="" loading="lazy" data-fallback-hide>` : '<span style="font-size:1.8rem;flex-shrink:0">📦</span>'}
          <span class="my-rv-pname">${escapeHtml(pname)}</span>
        </a>
        <div class="my-rv-stars">${stars(rv.rating)}</div>
        <div class="my-rv-text">${escapeHtml(rv.text||'')}</div>
        ${rv.image ? `<img class="my-rv-review-img" src="${escapeHtml(rv.image)}" alt="">` : ''}
        <div class="my-rv-footer">
          <span class="my-rv-date">${date}</span>
          <button class="my-rv-del" data-rv-delete-pid="${escapeHtml(rv.pid)}" data-rv-delete-index="${idx}">🗑 ${accText('حذف', 'Delete')}</button>
        </div>
      </div>`;
    }).join('') : '';

    if (!pendingHtml && !publishedHtml && !reviewsHtml) {
      listEl.innerHTML = `<div class="acc-empty" style="padding:40px 12px">
        <div class="acc-empty-icon">⭐</div>
        <div class="acc-empty-title">${accText('لم تكتب أي تقييم بعد', 'You have not written any reviews yet')}</div>
        <div class="acc-empty-sub">${accText('ستظهر هنا المنتجات التي تم تسليمها لتقييم مشترياتك', 'Delivered products will appear here so you can review your purchases')}</div>
        <div class="acc-empty-actions"><a href="/" class="acc-empty-btn"><span class="ico">🛍</span> <span>${accText('تسوق الآن', 'Shop Now')}</span></a></div>
      </div>`;
      return;
    }

    listEl.innerHTML = pendingHtml + publishedHtml + reviewsHtml;
    listEl.querySelectorAll('[data-review-stars]').forEach(starsBox => {
      let selected = 5;
      starsBox.addEventListener('click', event => {
        const star = event.target.closest('[data-v]');
        if (!star) return;
        selected = Number(star.dataset.v) || 5;
        starsBox.dataset.rating = String(selected);
        starsBox.querySelectorAll('[data-v]').forEach(el => el.classList.toggle('on', Number(el.dataset.v) <= selected));
      });
      starsBox.dataset.rating = String(selected);
    });
  }

  window.submitPurchaseReview = async function(idx) {
    const entry = (window.__pendingPurchaseReviews || [])[idx];
    if (!entry) return;
    const textEl = document.getElementById('rvComment-' + idx);
    const photoEl = document.getElementById('rvPhoto-' + idx);
    const starsBox = document.querySelector(`[data-review-stars="${idx}"]`);
    const text = (textEl?.value || '').trim();
    if (!text) { alert(accText('اكتب تعليقك أولاً', 'Write your comment first')); return; }
    const rating = Number(starsBox?.dataset.rating || 5) || 5;
    const image = await readReviewPhoto(photoEl);
    const profile = (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch(e) { return {}; } })();
    const review = { name: profile.name || accText('زائر', 'Guest'), rating, text, image, date: new Date().toISOString(), orderId: entry.orderId || '' };
    try {
      const stored = JSON.parse(localStorage.getItem('admin_reviews') || '{}');
      const key = String(entry.pid);
      stored[key] = stored[key] || [];
      stored[key].unshift(review);
      localStorage.setItem('admin_reviews', JSON.stringify(stored));
    } catch(e) { alert(accText('تعذر حفظ التقييم على هذا الجهاز', 'Could not save the review on this device')); return; }
    try {
      if (window.sbFetch && /^\d+$/.test(String(entry.pid))) {
        await window.sbFetch('reviews', { method:'POST', prefer:'return=minimal', body: JSON.stringify({ product_id:String(entry.pid), name:review.name, rating, text }) });
      }
    } catch(e) {}
    renderReviews();
  };

  window.deleteMyReview = function(pid, idx) {
    if (!confirm('هل تريد حذف هذا التقييم؟')) return;
    try {
      const stored = JSON.parse(localStorage.getItem('admin_reviews') || '{}');
      const flat = [];
      Object.entries(stored).forEach(([p,arr]) => (arr||[]).forEach(r => flat.push({...r,pid:p})));
      flat.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
      const t = flat[idx];
      if (!t) return;
      stored[t.pid] = (stored[t.pid]||[]).filter(r => !(r.date===t.date && r.text===t.text));
      if (!stored[t.pid].length) delete stored[t.pid];
      localStorage.setItem('admin_reviews', JSON.stringify(stored));
      renderReviews();
    } catch(e) {}
  };

  // init
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration('/sw.js').then(reg => { if (reg) reg.update(); }).catch(()=>{});
  }
  document.documentElement.classList.remove('account-auth-pending');
  applyAccountPlaceholders();
  renderOrders();
  loadProfile();
  const profilePhoneInput = document.getElementById('pf-phone');
  if (profilePhoneInput) {
    profilePhoneInput.addEventListener('focus', function(){ enforceUaePhoneInput(profilePhoneInput); });
    profilePhoneInput.addEventListener('input', function(){ enforceUaePhoneInput(profilePhoneInput); });
    enforceUaePhoneInput(profilePhoneInput);
  }
  // مزامنة بيانات العميل أولاً ثم الطلبات المرتبطة برقم الهاتف الصحيح
  hydrateProfileFromSupabase().then(() => syncOrdersFromSupabase()).then(() => renderOrders());

  // إعادة المزامنة عند العودة لتبويب الحساب (يعكس حذف/تحديث الأدمن فوراً)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      syncOrdersFromSupabase().then(() => renderOrders());
    }
  });

  // فتح قسم مباشر لو جاي من رابط خارجي
  (function() {
    const params = new URLSearchParams(location.search);
    let goto = localStorage.getItem('x2_goto_section') || params.get('section');
    if (goto === 'payment' && params.get('invoice')) goto = 'invoices';
    if (goto) {
      localStorage.removeItem('x2_goto_section');
      setTimeout(() => {
        if (typeof showSection === 'function') showSection(goto);
        if (goto === 'profile' && params.get('complete') === '1') {
          const note = document.getElementById('profile-complete-note');
          if (note) note.style.display = 'block';
          const phone = document.getElementById('pf-phone');
          if (phone) phone.focus();
        }
      }, 100);
    }
  })();

  // إصلاح أيقونة كاش باك
  document.querySelectorAll('.acc-nav-item').forEach(el => {
    if (el.textContent.includes('كاش باك')) {
      const ico = el.querySelector('.ico');
      if (ico) ico.textContent = '🤑';
    }
  });

  // مزامنة قوائم اللغة والعملة في الـ sidebar
  (function syncSidebarSelects() {
    const sLang = document.getElementById('sidebar-lang');
    const sCurr = document.getElementById('sidebar-curr');
    if (sLang) sLang.value = localStorage.getItem('lang')     || document.documentElement.lang || 'ar';
    if (sCurr) sCurr.value = localStorage.getItem('currency') || 'AED';
  })();

  window.changeSidebarLang = function(val) {
    const main = document.getElementById('language');
    if (main) { main.value = val; main.dispatchEvent(new Event('change')); }
    else {
      localStorage.setItem('lang', val);
      const url = new URL(location.href);
      if (val === 'en') url.searchParams.set('lang', 'en');
      else url.searchParams.delete('lang');
      location.href = url.pathname + url.search + url.hash;
    }
  };
  window.changeSidebarCurr = function(val) {
    const main = document.getElementById('currency');
    if (main) { main.value = val; main.dispatchEvent(new Event('change')); }
    else { localStorage.setItem('currency', val); location.reload(); }
  };

  (function repairSearchDropdownText() {
    function repairNodeText(node) {
      const before = node.nodeValue || '';
      let after = before
        .replace(/\?\? \?\?\?\?\? \?\?/g, 'لا توجد نتائج عن')
        .replace(/\?\? \?\?\?\?\?\?/g, 'المنتجات')
        .replace(/\?\? \?\?\?\?\?/g, 'الطلبات')
        .replace(/\?\? \?\?\?\? \?\?\?\?\? \?\?\?\?\?\?\?.*$/g, 'جاري تحليل الصورة...')
        .replace(/\?\?\? \?\?\?\?\? \?\?\?\?\?\?\? \?\?\?\?\? \?\? \?\?\?\? \?\?\?\?\?\?\?\?/g, 'نبحث عن المنتجات الأقرب من حيث الألوان')
        .replace(/\?\? \?\?\?\? \?\?\?\?\?\?\?\? \?\?\?\?\?\?/g, 'منتجات مشابهة للصورة')
        .replace(/\?\?\?\?\? \?/g, 'مسح البحث')
        .replace(/\?\.\?/g, 'د.إ')
        .replace(/^\?\?\?\s+/g, 'طلب ')
        .replace(/^\?\?$/g, '📦')
        .replace(/^\?\?\?\?$/g, 'منتج');
      if (after !== before) node.nodeValue = after;
    }

    function repairDropdown(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(repairNodeText);
    }

    function observe() {
      const dropdown = document.getElementById('searchDropdown') || document.getElementById('searchResults');
      if (!dropdown) { setTimeout(observe, 100); return; }
      repairDropdown(dropdown);
      new MutationObserver(() => repairDropdown(dropdown)).observe(dropdown, { childList: true, subtree: true, characterData: true });
    }

    observe();
  })();

  (function repairExternalNotificationText() {
    if (!('ServiceWorkerRegistration' in window) || !ServiceWorkerRegistration.prototype.showNotification) return;
    const originalShowNotification = ServiceWorkerRegistration.prototype.showNotification;
    if (originalShowNotification.__bariqTextRepair) return;

    function extractOrderId(text, tag) {
      const match = String(text || '').match(/#?\s*([A-Z]*-?\d{3,})/i) || String(tag || '').match(/(?:cb|ord)-([A-Z]*-?\d{3,})/i);
      return match ? match[1] : '';
    }

    function normalizeNotificationPayload(title, options) {
      options = options || {};
      const raw = `${title || ''} ${options.body || ''}`;
      const tag = options.tag || '';
      const orderId = extractOrderId(raw, tag);
      const isCashback = /cashback|cash\s*back|كاش|cb-|n-cb/i.test(raw + ' ' + tag) || /\?\.\?/.test(raw);
      const isBroken = isMostlyBrokenNotificationText(raw) || hasBrokenNotificationText(title) || hasBrokenNotificationText(options.body);
      if (!isBroken && !isCashback) return { title, options };

      if (isCashback) {
        const amountMatch = raw.match(/(\d+(?:\.\d+)?)/);
        const amount = parseFloat(getLocalOrderCashback(orderId) || (amountMatch && amountMatch[1]) || 5) || 5;
        const isEarned = /تم\s+إضافة|تم\s+اضافة|في حسابك|earned|n-cb-earned/i.test(raw + ' ' + tag);
        if (isEarned) {
          return {
            title: '🤑 تم إضافة كاش باك',
            options: { ...options, body: `تم إضافة ${amount.toFixed(amount % 1 ? 2 : 0)} د.إ كاش باك في حسابك${orderId ? ` من طلبك رقم ${orderId}` : ''}.` }
          };
        }
        return {
          title: '🤑 كاش باك بانتظارك',
          options: { ...options, body: `حصلت على ${amount.toFixed(amount % 1 ? 2 : 0)} د.إ كاش باك${orderId ? ` من طلبك رقم ${orderId}` : ''}. سيتم تفعيله بعد اعتماد الطلب.` }
        };
      }

      if (orderId) {
        const status = getLocalOrderStatus(orderId) || 'processing';
        const map = {
          pending:       { icon: '⏳', title: 'طلبك قيد المراجعة',     body: `طلبك رقم ${orderId} يُراجَع الآن` },
          processing:    { icon: '🔄', title: 'طلبك قيد المعالجة',     body: `جارٍ تجهيز طلبك رقم ${orderId}` },
          confirmed:     { icon: '✅', title: 'تم تأكيد طلبك',          body: `طلبك رقم ${orderId} تم تأكيده وسيُجهَّز قريباً 🎉` },
          manufacturing: { icon: '🔨', title: 'طلبك في مرحلة التصنيع', body: `طلبك رقم ${orderId} يُصنَّع الآن بعناية ✨` },
          ready:         { icon: '🎁', title: 'طلبك جاهز للاستلام',    body: `طلبك رقم ${orderId} جاهز وبانتظارك 🎉` },
          shipped:       { icon: '🚚', title: 'تم شحن طلبك',           body: `طلبك رقم ${orderId} في الطريق إليك` },
          delivered:     { icon: '✅', title: 'تم توصيل طلبك',         body: `طلبك رقم ${orderId} وصل بنجاح 🎉` },
          cancelled:     { icon: '❌', title: 'تم إلغاء طلبك',         body: `طلبك رقم ${orderId} تم إلغاؤه` },
          returned:      { icon: '↩️', title: 'تمت عملية الإرجاع',      body: `تمت معالجة إرجاع طلبك رقم ${orderId}` }
        };
        const item = map[status] || map.processing;
        return { title: item.icon + ' ' + item.title, options: { ...options, body: item.body } };
      }

      return { title: title || 'بريق', options };
    }

    function repairedShowNotification(title, options) {
      const fixed = normalizeNotificationPayload(title, options);
      return originalShowNotification.call(this, fixed.title, fixed.options);
    }
    repairedShowNotification.__bariqTextRepair = true;
    ServiceWorkerRegistration.prototype.showNotification = repairedShowNotification;
  })();
})();
