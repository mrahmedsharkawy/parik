// يعمل فقط إن وُجدت عناصر صفحة السلة
(function () {
  if (window.X2CartInitialized) return;
  // قبل: const listRoot = document.querySelector('.cart-right .cart-items-list');
  // استخدم fallback لو ما في .cart-right
  let listRoot = document.querySelector('.cart-right .cart-items-list');
  if (!listRoot) listRoot = document.querySelector('.cart-items-list');
  if (!listRoot) return; // ليست صفحة السلة -> إيقاف السكربت
  window.X2CartInitialized = true;

  const STORAGE_KEY = 'x2_cart';

  // CSS.escape fallback
  function cssEsc(s) {
    try { return (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/"/g, '\\"'); }
    catch { return String(s).replace(/"/g, '\\"'); }
  }

  // عملة
/* ==== Currency helpers (ضع هذا القسم في أعلى الملف مرة واحدة) ==== */
function currencySymbolFor(code) {
  const map = { AED: 'د.إ', USD: '$', EUR: '€', SAR: 'ر.س', EGP: 'ج.م', KWD: 'د.ك', JOD: 'د.أ', GBP: '£' };
  return map[code] || code;
}
function getSelectedCurrency() {
  const sel = document.getElementById('currency');
  return sel ? sel.value : (localStorage.getItem('currency') || 'AED');
}
function parseCurrency(text) {
  if (!text && text !== 0) return 0;
  // حاول قراءة dataset.amount أولاً (نقطة عشرية ثابتة)، وإلا قم بتنظيف النص وإزالة أي رموز غير رقمية
  if (typeof text === 'number') return Number(text) || 0;
  const s = String(text).trim();
  // رقم بصيغة 1234.56 أو 1,234.56 أو موجود في dataset
  const ds = s.match(/-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/);
  if (!ds) return 0;
  return Number(ds[0].replace(/,/g, '').replace(/,/g, '.').replace(/[^\d.\-]/g, '')) || 0;
}
function formatCurrency(value) {
  const code = getSelectedCurrency();
  const symbol = currencySymbolFor(code);
  const n = Number(value) || 0;
  // استخدم Intl إن أردت تنسيق محليّ حسب العملة (لكن نظهر الرمز من الخريطة لأفضل توافق RTL)
  try {
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    return formatted + ' ' + symbol;
  } catch (e) {
    return n.toFixed(2) + ' ' + symbol;
  }
}
// عرض عالمي يسهل إعادة الاستخدام من وحدات أخرى
window.currencySymbolFor = currencySymbolFor;
window.getSelectedCurrency = getSelectedCurrency;
window.parseCurrency = parseCurrency;
window.formatCurrency = formatCurrency;

// مفاتيح ودمج
  function makeKey(p) {
    if (p?.id) return String(p.id);
    const title = (p?.title || '').trim().toLowerCase();
    const meta = (p?.meta || '').trim().toLowerCase();
    const price = Number(p?.priceCurrent || 0).toFixed(2);
    const img = p?.img || '';
    return `${title}|${meta}|${price}|${img}`;
  }
  function dedupe(items) {
    const map = new Map();
    for (const it of (items || [])) {
      const key = makeKey(it);
      if (!map.has(key)) map.set(key, { ...it, qty: Number(it.qty || 1) });
      else map.get(key).qty += Number(it.qty || 1);
    }
    return Array.from(map.values());
  }

  // تخزين
  function readCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return dedupe(Array.isArray(arr) ? arr : []);
    } catch { return []; }
  }
  function writeCart(items) {
    const clean = dedupe(items || []);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    updateCartCountBadge(clean);
    try { window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: clean } })); } catch {}
    return clean;
  }

  // عرض
function renderList(items) {
  // إزالة كل البطاقات القديمة (كلا الصنفين)
  listRoot.querySelectorAll('.product-card-cart, .product-card').forEach(n => n.remove());
  items.forEach(addCard);
  toggleEmptyState();
  updateSummary();
}

// ...existing code...
function persistFromDOM() {
  const selector = '.product-card-cart, .product-card';
  const cards = Array.from(listRoot.querySelectorAll(selector));
  const items = cards.map(card => {
    const cb = card.querySelector('.card-checkbox input[type="checkbox"]');
    const img = card.querySelector('.image img')?.src || '';
    const priceCur = Number(card.dataset.priceCurrent ?? parseCurrency(card.querySelector('.price-current, .current-price')?.textContent || '0')) || 0;
    const priceOld = Number(card.dataset.priceOld ?? parseCurrency(card.querySelector('.old-price')?.textContent || '0')) || 0;
    const inpt = card.querySelector('.qty-dropdown input[type="number"], input[type="number"]');
    const valEl = card.querySelector('.qty-dropdown .qty-value, .qty-value');
    const qty = inpt ? Number(inpt.value || 1) : valEl ? Number(valEl.textContent || card.dataset.qty || 1) : Number(card.dataset.qty || 1);
    return {
      id: card.dataset.itemId || '',
      title: card.querySelector('.title')?.textContent?.trim() || '',
      meta: card.querySelector('.meta')?.textContent?.trim() || '',
      img,
      priceCurrent: priceCur,
      priceOld: priceOld,
      qty: Math.max(1, Number(qty || 1)),
      selected: !!(cb && cb.checked)
    };
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch(e){ console.error(e); }
  try { window.dispatchEvent(new CustomEvent('cart:persisted',{detail:{items}})); } catch(e){}
  return items;
}


function updateSummary() {
  const selector = '.product-card-cart, .product-card';
  const cards = (typeof listRoot !== 'undefined' && listRoot) ? listRoot.querySelectorAll(selector) : document.querySelectorAll(selector);

  let actualTotal = 0; // السعر بعد الخصم
  let oldTotal = 0;    // السعر قبل الخصم (subtotal)
  let totalQty = 0;    // إجمالي الكمية

  cards.forEach(card => {
    const cb = card.querySelector('.card-checkbox input[type="checkbox"]');
    if (cb && !cb.checked) return; // تجاهل إن لم تُحدد

    const cur = Number(window.parseCurrency(card.dataset.priceCurrent ?? card.querySelector('.price-current, .current-price')?.textContent ?? '0')) || 0;
    const oldCandidate = Number(window.parseCurrency(card.dataset.priceOld ?? card.querySelector('.old-price')?.textContent ?? '0')) || 0;
    const originalPrice = Math.max(cur, oldCandidate); // استخدم الأعلى كـ subtotal

    const inpt = card.querySelector('.qty-dropdown input[type="number"], input[type="number"]');
    const valEl = card.querySelector('.qty-dropdown .qty-value, .qty-value');
    let qty = 1;
    if (inpt) qty = Math.max(1, Number(inpt.value || 1));
    else if (valEl) qty = Math.max(1, Number(String(valEl.textContent).replace(/[^\d]/g, '') || card.dataset.qty || 1));
    else qty = Math.max(1, Number(card.dataset.qty || 1));

    actualTotal += cur * qty;
    oldTotal += originalPrice * qty;
    totalQty += qty;
    card.dataset.lineTotal = (cur * qty).toFixed(2);
  });

  const discount = Math.max(0, oldTotal - actualTotal);
  const shipping = 0;

  const subtotalEl = document.querySelector('.order-summary .subtotal, .subtotal');
  const discountEl = document.querySelector('.order-summary .discount, .discount');
  const shippingEl = document.querySelector('.order-summary .shipping, .shipping');
  const totalEl = document.querySelector('.order-summary .summary-total, .summary-total');

  if (subtotalEl) {
    subtotalEl.dataset.amount = oldTotal.toFixed(2);
    subtotalEl.textContent = window.formatCurrency(oldTotal);
  }

  if (discountEl) {
    discountEl.dataset.amount = discount.toFixed(2);
    if (discount > 0) {
      discountEl.style.display = '';
      discountEl.textContent = '-' + window.formatCurrency(discount);
    } else {
      discountEl.style.display = 'none';
    }
  }

  if (shippingEl) {
    shippingEl.dataset.amount = shipping.toFixed(2);
    shippingEl.textContent = (shipping === 0 ? (document.documentElement.lang === 'ar' ? 'يتم تحديده لاحقاً' : 'TBD') : window.formatCurrency(shipping));
  }

  if (totalEl) {
    // ===== خصم كوبون الكاش باك =====
    let couponDiscount = 0;
    const couponDiscountLine  = document.getElementById('couponDiscountLine');
    const couponDiscountAmtEl = document.getElementById('couponDiscountAmount');
    try {
      const applied = JSON.parse(sessionStorage.getItem('x2_coupon_applied') || 'null');
      if (applied && applied.code && applied.amount) {
        const stored = JSON.parse(localStorage.getItem('x2_coupon_code') || 'null');
        if (stored && stored.code === applied.code && !stored.used) {
          couponDiscount = Math.min(parseFloat(applied.amount) || 0, actualTotal);
          if (couponDiscountLine) couponDiscountLine.style.display = '';
          if (couponDiscountAmtEl) couponDiscountAmtEl.textContent = '-' + window.formatCurrency(couponDiscount);
        } else {
          sessionStorage.removeItem('x2_coupon_applied');
          if (couponDiscountLine) couponDiscountLine.style.display = 'none';
        }
      } else {
        if (couponDiscountLine) couponDiscountLine.style.display = 'none';
      }
    } catch(e) {
      if (couponDiscountLine) couponDiscountLine.style.display = 'none';
    }
    const grandTotal = Math.max(0, actualTotal + shipping - couponDiscount);
    totalEl.dataset.amount = grandTotal.toFixed(2);
    totalEl.textContent = window.formatCurrency(grandTotal);
  }

  const checkoutCount = document.getElementById('checkout-count');
  if (checkoutCount) {
    checkoutCount.dataset.count = String(totalQty);
    checkoutCount.textContent = totalQty;
  }

  try { window.dispatchEvent(new CustomEvent('cart:summary-updated', { detail: { oldTotal, actualTotal, totalQty, discount } })); } catch(e) {}
}

try { window.updateSummary = updateSummary; } catch(e) {}

// مسح أي تطبيق قديم من localStorage عند كل تحميل (الكوبون يُطبَّق يدوياً فقط)
try { localStorage.removeItem('x2_coupon_applied'); } catch(e) {}

// ===== تطبيق كوبون الكاش باك (يدوياً فقط) =====
function applyCoupon() {
  const input = document.getElementById('couponCodeInput');
  const msgEl = document.getElementById('couponMsg');
  if (!input || !msgEl) return;
  const code = (input.value || '').trim().toUpperCase();
  const show = (txt, ok) => {
    msgEl.textContent = txt;
    msgEl.style.display = 'block';
    msgEl.style.background = ok ? '#e8f5e9' : '#fce4ec';
    msgEl.style.color       = ok ? '#2e7d32' : '#c62828';
  };
  if (!code) { show('❌ أدخل كود الخصم أولاً', false); return; }
  try {
    const stored = JSON.parse(localStorage.getItem('x2_coupon_code') || 'null');
    if (!stored)              { show('❌ الكود غير صحيح', false); return; }
    if (stored.used)          { show('❌ هذا الكود تم استخدامه مسبقاً', false); return; }
    if (stored.code !== code) { show('❌ الكود غير صحيح', false); return; }
    // حفظ في sessionStorage فقط (يُمسح عند إغلاق التبويب)
    sessionStorage.setItem('x2_coupon_applied', JSON.stringify({ code: stored.code, amount: stored.amount }));
    const sym = typeof window.currencySymbolFor === 'function' ? window.currencySymbolFor(window.getSelectedCurrency()) : 'د.إ';
    show(`✅ تم تطبيق خصم ${parseFloat(stored.amount).toFixed(2)} ${sym}!`, true);
    input.disabled = true;
    const btn = input.nextElementSibling;
    if (btn) { btn.disabled = true; btn.textContent = '✔ مطبّق'; }
    if (typeof updateSummary === 'function') updateSummary();
  } catch(e) { show('❌ حدث خطأ، حاول مرة أخرى', false); }
}
window.applyCoupon = applyCoupon;

function addCard(p) {
  const cur = Number(p.priceCurrent || p.price || p.priceSale || 0);
  const old = Number(p.priceOld ?? p.priceOriginal ?? p.priceCurrent ?? p.price ?? 0);
  const key = makeKey(p);
  const discountPercent = old > cur ? Math.round((old - cur) / old * 100) : 0;

  // إن كانت البطاقة موجودة دمج الكمية فقط
  const exists = listRoot.querySelector(`.product-card[data-key="${cssEsc(key)}"]`)
    || (p.id ? listRoot.querySelector(`.product-card[data-item-id="${cssEsc(p.id)}"]`) : null);
  if (exists) {
    const input = exists.querySelector('input[type="number"]');
    if (input) {
      input.value = Math.max(1, Number(input.value || 1) + Number(p.qty || 1));
    } else {
      const valEl = exists.querySelector('.qty-value');
      if (valEl) valEl.textContent = Math.max(1, Number(valEl.textContent || 1) + Number(p.qty || 1));
    }
    
    // تحديث الوصف إذا كان موجوداً
    if (p.description) {
      let descEl = exists.querySelector('.description');
      if (!descEl) {
        descEl = document.createElement('div');
        descEl.className = 'description';
        const titleEl = exists.querySelector('.title');
        if (titleEl && titleEl.parentNode) {
          titleEl.parentNode.insertBefore(descEl, titleEl.nextSibling);
        }
      }
      if (descEl) descEl.textContent = p.description;
    }
    
    return;
  }

  const card = document.createElement('div');
  card.className = 'product-card product-card-cart';
  card.dataset.key = key;
  if (p.id) card.dataset.itemId = String(p.id);
  card.dataset.priceCurrent = cur.toFixed(2);
  card.dataset.priceOld = old.toFixed(2);

  // إضافة CSS للوصف والرسائل التشجيعية
  if (!document.getElementById('cart-item-styles')) {
    const style = document.createElement('style');
    style.id = 'cart-item-styles';
    style.textContent = `
      .description {
        font-size: 11px;
        color: #555;
        margin: 5px 0;
        line-height: 1.4;
        margin-bottom: -1px;
      }
      .urgency-text {
        font-size: 10px;
        color: #d32f2f;
        margin-top: 5px;
        margin-bottom: -5px;
      }
      .hurry-text {
        font-size: 11px;
        color: #d32f2f;
        font-weight: bold;
        margin-bottom: -5px;
      }
    `;
    document.head.appendChild(style);
  }

  // تحديث HTML ليتضمن وصف المنتج والرسائل التشجيعية بدون إطار خارجي
  card.innerHTML = `
    <button type="button" class="remove-btn" aria-label="إزالة المنتج">🗑️</button>
    <div class="card-checkbox">
      <input type="checkbox" checked>
    </div>
    <div class="qty-container">
      <div class="qty-dropdown">
        <span>الكمية</span>
        <span class="qty-value">${Number(p.qty || 1)}</span>
        <span class="dropdown-icon">▼</span>
      </div>
    </div>
    <div class="image">
      ${p.id ? `<a href="product.html?id=${encodeURIComponent(p.id)}" style="display:block;width:100%;height:100%">` : ''}
      <img src="${p.img || 'assets/logo.png'}" alt="${(p.title||'').replace(/"/g,'&quot;')}" onerror="this.src='assets/logo.png'" loading="lazy">
      ${p.id ? `</a>` : ''}
    </div>
    <div class="details">
      <div class="title">${p.title || ''}</div>
      <div class="description">${p.description || ''}</div>
      <div class="meta">${p.meta || ''}</div>
      <div class="urgency-text">⏱️ ينتهي العرض قريبا</div>
      <div class="hurry-text">سارع بالشراء قبل نفاد الكمية!</div>
      <div class="discount-info">
        <span>عروض كبيرة</span>
        <span class="dot">•</span>
        <span class="since">انخفض ${discountPercent}% منذ إضافته</span>
      </div>
      <div class="price-container">
        <span class="current-price">${formatCurrency(cur)}</span>
        <span class="old-price">${formatCurrency(old)}</span>
        <span class="discount-badge">-${discountPercent}%</span>
      </div>
    </div>
  `;

  // تحديث الأحداث
  card.querySelector('.card-checkbox input')?.addEventListener('change', (e) => {
    card.classList.toggle('selected', e.target.checked);
    updateSelectedCount();
  });

  card.querySelector('.remove-btn')?.addEventListener('click', () => {
    removeCard(card);
  });

  // استمع للنقر لفتح/إغلاق منسدل الكمية (toggle)
  card.querySelector('.qty-dropdown')?.addEventListener('click', (e) => {
    e.stopPropagation();
    showQtyDropdown(card, e.currentTarget);
  });

  listRoot.insertBefore(card, listRoot.firstElementChild || null);
}

function closeQtyDropdowns() {
  // إزالة كل القوائم وإعادة ضبط السهم لكل .qty-dropdown
  document.querySelectorAll('.qty-options').forEach(n => n.remove());
  document.querySelectorAll('.qty-dropdown').forEach(d => {
    d.classList.remove('open');
    const icon = d.querySelector('.dropdown-icon');
    if (icon) {
      icon.style.transform = ''; // إرجاع السهم للحالة المغلقة
      icon.style.transition = '';
    }
  });
}

function showQtyDropdown(card, target) {
  // أضف CSS لتأثير دوران السهم إذا لم يُضاف
  if (!document.getElementById('qty-dropdown-arrow-style')) {
    const s = document.createElement('style');
    s.id = 'qty-dropdown-arrow-style';
    s.textContent = `
      .qty-dropdown .dropdown-icon { display:inline-block; transition: transform .18s ease; transform-origin: center; }
      .qty-options { box-sizing: border-box; max-height: 240px; overflow:auto; background:white; border:1px solid rgba(0,0,0,.08); border-radius:4px; }
    `;
    document.head.appendChild(s);
  }

  const ownerKey = card.dataset.key || card.dataset.itemId || String(Math.random());
  const existing = document.querySelector(`.qty-options[data-owner="${ownerKey}"]`);
  if (existing) {
    // toggle close
    existing.remove();
    target.classList.remove('open');
    const icon = target.querySelector('.dropdown-icon');
    if (icon) icon.style.transform = '';
    return;
  }

  // اغلق أي قوائم مفتوحة سابقة
  closeQtyDropdowns();

  const curValEl = card.querySelector('.qty-value');
  const cur = Math.max(1, parseInt(curValEl ? curValEl.textContent : card.dataset.qty) || 1);

  // انشاء القائمة داخل body مع position:fixed (نفتح دوماً لتحت)
  const dropdown = document.createElement('div');
  dropdown.className = 'qty-options';
  dropdown.dataset.owner = ownerKey;
  dropdown.setAttribute('role', 'listbox');
  dropdown.style.position = 'fixed';
  dropdown.style.zIndex = 99999;
  dropdown.style.visibility = 'hidden';
  dropdown.style.maxHeight = '240px';
  dropdown.style.overflow = 'auto';
  dropdown.style.background = 'white';

  for (let i = 1; i <= 10; i++) {
    const opt = document.createElement('div');
    opt.className = 'qty-option' + (i === cur ? ' selected' : '');
    opt.dataset.value = String(i);
    opt.innerHTML = `<span class="label">${i}</span><span class="check">${i === cur ? '✓' : ''}</span>`;
    dropdown.appendChild(opt);
  }

  document.body.appendChild(dropdown);

  // تموضع: فتح دائماً لتحت (قد يتجاوز النافذة إذا المساحة قليلة حسب طلبك)
  const tgtRect = target.getBoundingClientRect();
  const ddRect = dropdown.getBoundingClientRect();
  const margin = 8;
  const leftRaw = (document.dir === 'rtl' || getComputedStyle(card).direction === 'rtl') ? (tgtRect.right - Math.max(ddRect.width, tgtRect.width)) : tgtRect.left;
  const left = Math.max(margin, Math.min(leftRaw, window.innerWidth - Math.max(ddRect.width, tgtRect.width) - margin));
  const top = Math.min(window.innerHeight - 8, tgtRect.bottom + 6); // fixed viewport coords

  dropdown.style.left = Math.round(left) + 'px';
  dropdown.style.top = Math.round(top) + 'px';
  dropdown.style.minWidth = Math.max(80, tgtRect.width) + 'px';
  dropdown.style.visibility = 'visible';

  // تدوير السهم: عند الفتح يدور للسهم المفتوح، عند الغلق يعود
  const icon = target.querySelector('.dropdown-icon');
  if (icon) {
    icon.style.transition = 'transform .18s ease';
    icon.style.transform = 'rotate(180deg)'; // السهم يدل على أن المنسدل مفتوح
  }
  target.classList.add('open');

  // اختيار قيمة
  dropdown.addEventListener('click', (ev) => {
    const opt = ev.target.closest('.qty-option');
    if (!opt) return;
    const v = Math.max(1, parseInt(opt.dataset.value) || 1);
    const valEl = card.querySelector('.qty-value');
    if (valEl) valEl.textContent = v;

    dropdown.querySelectorAll('.qty-option').forEach(o => {
      o.classList.toggle('selected', o === opt);
      const c = o.querySelector('.check'); if (c) c.textContent = (o === opt ? '✓' : '');
    });

    if (typeof updateCardQuantity === 'function') updateCardQuantity(card, v);
    else { card.dataset.qty = v; if (typeof updateSummary === 'function') updateSummary(); if (typeof persistFromDOM === 'function') persistFromDOM(); }

    // اغلاق واعادة السهم لوضعه
    closeQtyDropdowns();
  });

  // اغلاق عند النقر خارج
  const onDocClick = (ev) => {
    if (!dropdown.contains(ev.target) && !target.contains(ev.target)) {
      closeQtyDropdowns();
      document.removeEventListener('click', onDocClick);
    }
  };
  setTimeout(() => document.addEventListener('click', onDocClick), 0);
}


// تحديث الكمية وإجراء الحسابات اللازمة
function updateCardQuantity(card, qty) {
  // تخزين الكمية الجديدة
  card.dataset.qty = qty;
  
  // تحديث الملخص والتخزين
  updateSummary();
  persistFromDOM();
}

// تحديث عدد العناصر المحددة
function updateSelectedCount() {
  const selectedItems = document.querySelectorAll('.product-card-cart .card-checkbox input:checked').length;
  const totalItems = document.querySelectorAll('.product-card-cart').length;
  
  const countDisplay = document.querySelector('.selection-count');
  if (countDisplay) {
    countDisplay.textContent = `تحديد (${selectedItems})`;
  }
  
  // تحديث حالة "تحديد الكل"
  const selectAllCheckbox = document.querySelector('.select-all-checkbox input');
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = selectedItems === totalItems && totalItems > 0;
  }
}

  function removeCard(card) {
    card.remove();
    updateSummary();
    persistFromDOM();
    toggleEmptyState();
  }

  function changeQty(card, delta) {
    const input = card.querySelector('input[type="number"]');
    if (!input) return;
    input.value = Math.max(1, Number(input.value || 1) + delta);
    updateSummary();
    persistFromDOM();
  }

  // حالة السلة الفارغة: لا نلمس #category-products مطلقاً
  function toggleEmptyState() {
    const hasItems = listRoot.querySelector('.product-card') != null;
    const emptyWrap = document.querySelector('.empty-cart-wrap');
    if (emptyWrap) emptyWrap.style.display = hasItems ? 'none' : '';
  }


// ...existing code...  
  function persistFromDOM() {
    const cards = Array.from(listRoot.querySelectorAll('.product-card'));
    const items = cards.map(card => ({
      id: card.dataset.itemId || '',
      title: card.querySelector('.title')?.textContent?.trim() || '',
      meta: card.querySelector('.meta')?.textContent?.trim() || '',
      img: card.querySelector('.image img')?.src || '',
      priceCurrent: Number(card.dataset.priceCurrent || parseCurrency(card.querySelector('.price-current')?.textContent || '0')) || 0,
      priceOld: Number(card.dataset.priceOld || parseCurrency(card.querySelector('.old-price')?.textContent || '0')) || 0,
      qty: Number(card.querySelector('input[type="number"]')?.value || 1)
    }));
    writeCart(items);
  }

  function updateCartCountBadge(items) {
    try {
      const arr = Array.isArray(items) ? items : readCart();
      const count = arr.reduce((s, it) => s + (Number(it.qty) || 1), 0);
      const els = [document.getElementById('checkout-count'), document.querySelector('.cart-count')];
      els.forEach(el => { if (el) { el.dataset.count = String(count); el.textContent = count; } });
    } catch {}
  }

  // API عام: addProduct
  function addProductAPI(product) {
    // دمج مع الحالة الحالية
    const current = readCart();
    const key = makeKey(product);
    const ix = current.findIndex(it => makeKey(it) === key);
    if (ix >= 0) current[ix].qty += Number(product.qty || 1);
    else current.unshift({ ...product, qty: Number(product.qty || 1) });
    const saved = writeCart(current);
    // تحديث العرض
    renderList(saved);
  }

  // لا نكسر addProduct الموجود مسبقاً في صفحات أخرى
  if (!window.addProduct) window.addProduct = addProductAPI;

  // تهيئة الصفحة
  function init() {
    // ضبط sticky top كمتغير CSS فقط (بدون تعديل تصميمك)
    try {
      const header = document.getElementById('mainHeader') || document.querySelector('.main-header') || document.querySelector('header');
      const freeBar = document.querySelector('.free-shipping-bar');
      const top = (header?.offsetHeight || 0) + (freeBar?.offsetHeight || 0) + 10;
      document.documentElement.style.setProperty('--cart-sticky-top', top + 'px');
    } catch {}

    // رندر من التخزين
    renderList(readCart());

    // تحديد كل المنتجات تلقائياً عند فتح السلة
    function autoSelectAll() {
      const allCbs = listRoot.querySelectorAll('.card-checkbox input[type="checkbox"]');
      allCbs.forEach(cb => {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      // تحديث checkbox "تحديد الكل"
      const selAllCb = document.getElementById('selectAllCheckbox') || document.querySelector('.select-all-checkbox input');
      if (selAllCb) selAllCb.checked = true;
      updateSummary();
    }
    // تشغيل بعد الرندر بإطار واحد
    requestAnimationFrame(autoSelectAll);

    // جلب صور المنتجات من Products.json وتعبئة الصور المفقودة في السلة
    (async function fillMissingCartImages() {
      try {
        const res = await fetch('java/Products.json');
        if (!res.ok) return;
        const products = await res.json();
        // بناء خريطة id → img
        const imgMap = {};
        (Array.isArray(products) ? products : []).forEach(p => {
          if (!p.id) return;
          const rawImg = Array.isArray(p.img) ? p.img[0] : p.img;
          if (rawImg && typeof rawImg === 'string') imgMap[String(p.id)] = rawImg;
        });
        if (!Object.keys(imgMap).length) return;
        // تحديث الصور الفارغة أو الـ logo fallback في كروت السلة
        listRoot.querySelectorAll('.product-card').forEach(card => {
          const itemId = card.dataset.itemId || card.dataset.key?.split('|')[0] || '';
          if (!itemId) return;
          const imgEl = card.querySelector('.image img');
          if (!imgEl) return;
          const currentSrc = imgEl.getAttribute('src') || '';
          // استبدل فقط لو الصورة فارغة أو هي اللوجو الافتراضي
          if (!currentSrc || currentSrc.includes('logo.png') || currentSrc === '') {
            const newSrc = imgMap[String(itemId)];
            if (newSrc) {
              imgEl.src = newSrc;
              imgEl.onerror = function() { this.src = 'assets/logo.png'; };
            }
          }
        });
      } catch(e) {}
    })();

    // استجابة لتغيير العملة
    const curSel = document.getElementById('currency');
    if (curSel && !curSel._boundCart) {
      curSel.addEventListener('change', () => { updateSummary(); });
      curSel._boundCart = true;
    }

    // تفاعل زر تأكيد الطلب
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn && !checkoutBtn._bound) {
      checkoutBtn.addEventListener('click', (e) => {
        const total = parseCurrency(document.querySelector('.summary-total')?.dataset.amount || '0');
        if (total <= 0) { e.preventDefault(); checkoutBtn.classList.add('shake'); setTimeout(() => checkoutBtn.classList.remove('shake'), 600); }
      });
      checkoutBtn._bound = true;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();


(function () {
    const MOBILE_BREAK = 992;

    function moveOrderSummary() {
      const container = document.querySelector('.cart-layout-container');
      const cartLeft = document.querySelector('.cart-left');
      const cartRight = document.querySelector('.cart-right');
      const cartItems = document.querySelector('.cart-items-list');
      if (!container || !cartLeft || !cartRight || !cartItems) return;

      if (window.innerWidth <= MOBILE_BREAK) {
        // place cart-left inside cart-right, right after cart-items-list
        if (cartLeft.parentElement !== cartRight) {
          cartRight.insertBefore(cartLeft, cartItems.nextSibling);
        } else {
          // ensure it's immediately after cart-items-list
          if (cartItems.nextElementSibling !== cartLeft) {
            cartRight.insertBefore(cartLeft, cartItems.nextSibling);
          }
        }
      } else {
        // move it back to original position (before cart-right)
        if (cartLeft.parentElement !== container) {
          container.insertBefore(cartLeft, cartRight);
        }
      }
    }

    // run on load and on changes (debounced resize)
    window.addEventListener('load', moveOrderSummary);
    let rTimer;
    window.addEventListener('resize', function () {
      clearTimeout(rTimer);
      rTimer = setTimeout(moveOrderSummary, 120);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(moveOrderSummary, 150);
    });
    // in case content loads later
    document.addEventListener('DOMContentLoaded', moveOrderSummary);
})();



/* استبدل/أضف هذا IIFE مرة واحدة (يدير زر الدفع الرئيسي وزر PayPal إن وُجد) */
(function(){
  if (window.X2CheckoutStateInited) return;
  window.X2CheckoutStateInited = true;

  const WHATSAPP_PHONE = '+971554423151';
  const PAYPAL_URL = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YOUR_BUTTON_ID'; // غيّره لرابط PayPal الخاص بك
  const USE_PAYPAL = false;

  function parseNumber(text){
    if(!text) return 0;
    const cleaned = String(text).replace(/[^\d.,-]/g,'').replace(/,/g,'.').trim();
    const n = parseFloat(cleaned);
    return isNaN(n)? 0 : n;
  }

  function getSelectedQuantity(){
    let total = 0;
    const cards = document.querySelectorAll('.product-card-cart');
    if(!cards.length) return 0;
    let anyCheckbox = false;
    cards.forEach(c => { if (c.querySelector('.card-checkbox input[type="checkbox"]')) anyCheckbox = true; });
    cards.forEach(card => {
      const cb = card.querySelector('.card-checkbox input[type="checkbox"]');
      if(anyCheckbox && cb && !cb.checked) return;
      const valEl = card.querySelector('.qty-dropdown .qty-value');
      const input = card.querySelector('.qty-dropdown input[type="number"]');
      const ds = card.dataset.qty;
      const qty = input ? Number(input.value||1) : valEl ? Number(valEl.textContent||1) : ds ? Number(ds||1) : 1;
      total += Math.max(1, Number(qty||1));
    });
    return total;
  }

  function readSummaryValue(){
    const totalEl = document.querySelector('.order-summary .summary-total, .summary-total');
    const subtotalEl = document.querySelector('.order-summary .subtotal, .subtotal');
    let v = 0;
    if(totalEl){
      v = totalEl.dataset?.amount ? parseNumber(totalEl.dataset.amount) : parseNumber(totalEl.textContent);
    } else if(subtotalEl){
      v = subtotalEl.dataset?.amount ? parseNumber(subtotalEl.dataset.amount) : parseNumber(subtotalEl.textContent);
    }
    return v || 0;
  }

  function readJson(key, fallback){
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (e) {
      return fallback;
    }
  }

  function normalizeWhatsAppPhone(phone){
    return String(phone || '').replace(/\D/g, '');
  }

  function getSelectedItemsForOrder(){
    const cards = Array.from(document.querySelectorAll('.product-card-cart'));
    const selectedCards = cards.filter(card => {
      const cb = card.querySelector('.card-checkbox input[type="checkbox"]');
      return cb ? cb.checked : true;
    });
    const used = selectedCards.length ? selectedCards : cards;

    return used.map(card => {
      const qtyInput = card.querySelector('.qty-dropdown input[type="number"]');
      const qtyValue = card.querySelector('.qty-dropdown .qty-value');
      const qty = Math.max(1, Number(qtyInput?.value || qtyValue?.textContent || card.dataset.qty || 1));
      const dsPrice = parseNumber(card.dataset.priceCurrent || '0');
      const domPrice = parseNumber(card.querySelector('.current-price, .price-current')?.textContent || '0');
      const unit = dsPrice > 0 ? dsPrice : domPrice;
      const productId = String(card.dataset.itemId || '').trim();
      const imgSrc = String(card.querySelector('.image img')?.src || '').trim();
      const productUrl = productId ? new URL(`product.html?id=${encodeURIComponent(productId)}`, window.location.href).href : '';
      return {
        title: (card.querySelector('.title')?.textContent || 'منتج').trim(),
        qty,
        unit,
        line: unit * qty,
        image: imgSrc,
        productUrl
      };
    });
  }

  function getCustomerDetails(){
    const profile = readJson('x2_profile', {});
    const orders = readJson('x2_orders', []);
    const lastOrder = Array.isArray(orders) && orders.length ? orders[0] : null;
    const shipping = lastOrder?.shipping || {};

    return {
      name: (profile.name || shipping.name || '').trim(),
      phone: (profile.phone || shipping.phone || '').trim(),
      email: (profile.email || '').trim(),
      city: (shipping.city || '').trim(),
      address: (shipping.address || '').trim()
    };
  }

  function buildWhatsAppMessage(options){
    const opts = options || {};
    const includeProductLinks = opts.includeProductLinks !== false;
    const includeImages = opts.includeImages !== false;
    const maxItems = Math.max(1, Number(opts.maxItems || 50));
    const items = getSelectedItemsForOrder();
    const customer = getCustomerDetails();
    const subtotal = parseNumber(document.querySelector('.subtotal')?.dataset.amount || document.querySelector('.subtotal')?.textContent || '0');
    const discount = parseNumber(document.querySelector('.discount')?.dataset.amount || document.querySelector('.discount')?.textContent || '0');
    const total = parseNumber(document.querySelector('.summary-total')?.dataset.amount || document.querySelector('.summary-total')?.textContent || '0');
    const curr = typeof window.getSelectedCurrency === 'function' ? window.getSelectedCurrency() : (localStorage.getItem('currency') || 'AED');
    const sym = typeof window.currencySymbolFor === 'function' ? window.currencySymbolFor(curr) : curr;

    const slicedItems = items.slice(0, maxItems);
    const itemsText = slicedItems.length
      ? slicedItems.map((it, idx) => [
          `${idx + 1}) ${it.title}`,
          `   الكمية: ${it.qty}`,
          `   سعر الوحدة: ${it.unit.toFixed(2)} ${sym}`,
          `   الإجمالي: ${it.line.toFixed(2)} ${sym}`,
          includeProductLinks && it.productUrl ? `   رابط المنتج: ${it.productUrl}` : '',
          includeImages && it.image ? `   صورة المنتج: ${it.image}` : ''
        ].filter(Boolean).join('\n')).join('\n\n')
      : 'لا توجد منتجات في السلة';

    const lines = [
      'طلب جديد من الموقع',
      '',
      `التاريخ: ${new Date().toLocaleString('ar')}`,
      '',
      'بيانات العميل:',
      `الاسم: ${customer.name || 'غير متوفر'}`,
      `الهاتف: ${customer.phone || 'غير متوفر'}`,
      `البريد: ${customer.email || 'غير متوفر'}`,
      `المدينة: ${customer.city || 'غير متوفر'}`,
      `العنوان: ${customer.address || 'غير متوفر'}`,
      '',
      'محتويات السلة:',
      itemsText,
      items.length > slicedItems.length ? `\n... وتم اختصار ${items.length - slicedItems.length} منتج بسبب طول الرسالة` : '',
      '',
      `الإجمالي قبل الخصم: ${subtotal.toFixed(2)} ${sym}`,
      `الخصم: ${discount.toFixed(2)} ${sym}`,
      (() => {
        try {
          const applied = JSON.parse(localStorage.getItem('x2_coupon_applied') || 'null');
          const stored  = JSON.parse(localStorage.getItem('x2_coupon_code')    || 'null');
          if (applied && applied.code && stored && stored.code === applied.code && !stored.used) {
            return `خصم الكوبون (${applied.code}): -${parseFloat(applied.amount).toFixed(2)} ${sym}`;
          }
        } catch(e) {}
        return '';
      })(),
      `الإجمالي النهائي: ${total.toFixed(2)} ${sym}`
    ].filter(l => l !== null && l !== undefined);

    return lines.join('\n');
  }

  function openWhatsAppOrder(){
    const items = getSelectedItemsForOrder();
    if (!items.length) return;
    const phone = normalizeWhatsAppPhone(WHATSAPP_PHONE);
    if (!phone) return;

    // تقليل طول الرسالة تدريجياً لتجنب فشل فتح روابط واتساب الطويلة.
    const variants = [
      buildWhatsAppMessage({ includeProductLinks:true, includeImages:true, maxItems:50 }),
      buildWhatsAppMessage({ includeProductLinks:true, includeImages:false, maxItems:25 }),
      buildWhatsAppMessage({ includeProductLinks:true, includeImages:false, maxItems:10 }),
      buildWhatsAppMessage({ includeProductLinks:false, includeImages:false, maxItems:10 })
    ];
    let finalText = variants.find(v => v.length <= 2500) || variants[variants.length - 1].slice(0, 2400);

    const msg = encodeURIComponent(finalText);
    const url = `https://wa.me/${phone}?text=${msg}`;
    window.open(url, '_blank', 'noopener');

    // إضافة الطلب مع الكاش باك "معلّق" — يُضاف للرصيد بعد تأكيد التسليم
    try {
      const CB_KEY = 'x2_cashback';
      const lastNum = parseInt(localStorage.getItem('x2_order_counter') || '999', 10);
      const nextNum = lastNum + 1;
      localStorage.setItem('x2_order_counter', String(nextNum));
      const orderId = '#' + nextNum;
      const orderItems = items.slice(0,2).map(i => i.title || i.name || 'منتج').join(' · ');
      const summaryTotal = readSummaryValue();
      const calcTotal = items.reduce((s,i) => s + ((i.unit || parseFloat(i.price||i.priceCurrent||0)) * (Number(i.qty)||1)), 0);
      const totalAmt = (summaryTotal > 0 ? summaryTotal : calcTotal).toFixed(2);
      const expiresAt = new Date(Date.now() + 30*24*60*60*1000).toISOString();
      // حفظ الطلب في x2_orders مع الـ id لكل منتج
      const orders = JSON.parse(localStorage.getItem('x2_orders') || '[]');
      orders.unshift({
        id: orderId,
        date: new Date().toISOString(),
        cashback: 5,
        cashbackStatus: 'pending', // يُضاف للرصيد فقط بعد تأكيد التسليم
        cashbackExpiresAt: expiresAt,
        items: items.map(i => {
          const rawImg = i.image || i.img || '';
          const pid = i.productId || (i.productUrl ? (() => { try { return new URL(i.productUrl).searchParams.get('id') || ''; } catch(e) { return ''; } })() : '');
          return { id: pid, title: i.title || i.name || 'منتج', qty: i.qty, img: rawImg && !rawImg.startsWith('data:') ? rawImg : '' };
        }),
        total: totalAmt,
        status: 'processing'
      });
      localStorage.setItem('x2_orders', JSON.stringify(orders));
      // رفع الطلب لـ Supabase (غير متزامن - لا يوقف العملية)
      if (window.Supabase) {
        const profile = (() => { try { return JSON.parse(localStorage.getItem('x2_profile')||'{}'); } catch(e){ return {}; } })();
        const newOrder = orders[0];
        window.Supabase.Orders.insert({
          ...newOrder,
          customerName:  profile.name  || '',
          customerPhone: profile.phone || '',
          customerEmail: profile.email || '',
          address:       profile.address_full || null
        }).catch(() => {});
        // إشعار للأدمن
        window.Supabase.Notifications.insert({
          type: 'order_new', icon: '📦',
          title: `طلب جديد ${orderId}`,
          msg: `${profile.name||'عميل'} - ${totalAmt} د.إ`,
          orderId
        }).catch(() => {});
      }
    } catch(e) {}

    // ===== استهلاك كوبون الخصم وتصفير الكاش باك =====
    try {
      // تحقق من sessionStorage (التطبيق اليدوي) أو localStorage (للتوافق)
      const applied = JSON.parse(sessionStorage.getItem('x2_coupon_applied') || localStorage.getItem('x2_coupon_applied') || 'null');
      if (applied && applied.code) {
        // تحديد الكوبون كمستخدم
        let storedCoupon = JSON.parse(localStorage.getItem('x2_coupon_code') || 'null');
        if (storedCoupon && storedCoupon.code === applied.code) {
          storedCoupon.used = true;
          localStorage.setItem('x2_coupon_code', JSON.stringify(storedCoupon));
        }
        // تصفير الكاش باك كاملاً (الرصيد + التاريخ)
        let cbReset = JSON.parse(localStorage.getItem('x2_cashback') || '{"balance":0,"history":[]}');
        cbReset.balance = 0;
        cbReset.history = []; // مسح التاريخ ليبدأ من جديد
        localStorage.setItem('x2_cashback', JSON.stringify(cbReset));
        // وسّم الطلبات القديمة بـ "claimed" حتى لا تُحتسب مجدداً
        try {
          const ords = JSON.parse(localStorage.getItem('x2_orders') || '[]');
          ords.forEach(o => {
            if (parseFloat(o.cashback) > 0 && o.cashbackStatus !== 'pending') {
              o.cashbackStatus = 'claimed';
            }
          });
          localStorage.setItem('x2_orders', JSON.stringify(ords));
        } catch(e2) {}
        // مسح حالة التطبيق
        sessionStorage.removeItem('x2_coupon_applied');
        localStorage.removeItem('x2_coupon_applied');
        setTimeout(() => { try { if (typeof updateSummary === 'function') updateSummary(); } catch(e){} }, 300);
      }
    } catch(e) {}

    // ===== مسح السلة بعد إرسال الطلب =====
    try {
      localStorage.setItem('x2_cart', '[]');
      // تحديث عداد السلة في الناف بار
      document.querySelectorAll('.cart-badge').forEach(el => el.setAttribute('data-count', ''));
      window.__cartCount = 0;
      try { window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: [] } })); } catch(e) {}
      // إظهار رسالة نجاح وتوجيه للحساب
      setTimeout(() => {
        if (typeof renderList === 'function') renderList([]);
        if (typeof toggleEmptyState === 'function') toggleEmptyState();
        if (typeof updateSummary === 'function') updateSummary();
        // إظهار رسالة نجاح
        const banner = document.createElement('div');
        banner.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#152546;color:#D4AF37;padding:14px 24px;border-radius:12px;font-size:0.9rem;font-weight:700;z-index:99999;box-shadow:0 6px 24px rgba(0,0,0,0.25);text-align:center;direction:rtl;max-width:90vw';
        banner.innerHTML = '✅ تم إرسال طلبك عبر واتساب!<br><span style="font-size:0.78rem;opacity:0.85">الطلب محفوظ في حسابك — قسم طلباتي</span>';
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 4000);
      }, 200);
    } catch(e) {}
  }

  // تحديث زر تأكيد الطلب عبر واتساب
  function setCheckoutState(enabled){
    const mainBtn = document.getElementById('checkoutBtn') || document.querySelector('.checkout-btn');
    const paypalBtn = document.getElementById('paypalBtn') || document.querySelector('.paypal-btn');

    const qty = getSelectedQuantity();

    if(mainBtn){
      if(enabled){
        mainBtn.textContent = qty > 0 ? `تأكيد الطلب عبر واتساب (${qty} قطعة)` : 'تأكيد الطلب عبر واتساب';
        mainBtn.classList.remove('disabled');
        mainBtn.removeAttribute('aria-disabled');
        mainBtn.disabled = false;
        mainBtn.dataset.enabled = '1';
        mainBtn.onclick = (e) => { e.preventDefault(); openWhatsAppOrder(); };
      } else {
        mainBtn.textContent = 'السلة فارغة';
        mainBtn.classList.add('disabled');
        mainBtn.setAttribute('aria-disabled','true');
        mainBtn.disabled = true;
        mainBtn.dataset.enabled = '0';
        mainBtn.onclick = (e) => { e.preventDefault(); (document.querySelector('.cart-left')||document.querySelector('#main'))?.scrollIntoView({behavior:'smooth', block:'center'}); };
      }
    }

    // زر PayPal: نظهره فقط إذا USE_PAYPAL true
    if(paypalBtn){
      if(USE_PAYPAL && enabled){
        // ضع نص PayPal مع الكمية وإظهار الرابط الفعلي
        if(paypalBtn.tagName === 'A'){
          paypalBtn.href = PAYPAL_URL;
          paypalBtn.textContent = qty > 0 ? `ادفع عبر PayPal (${qty} قطعة)` : 'ادفع عبر PayPal';
          paypalBtn.classList.remove('disabled');
          paypalBtn.removeAttribute('aria-disabled');
        } else {
          // زر عنصر button: نوجه عند الضغط
          paypalBtn.textContent = qty > 0 ? `ادفع عبر PayPal (${qty} قطعة)` : 'ادفع عبر PayPal';
          paypalBtn.classList.remove('disabled');
          paypalBtn.removeAttribute('aria-disabled');
          paypalBtn.onclick = () => { window.location.href = PAYPAL_URL; };
        }
        // إظهار الزر إن كان مخفياً
        paypalBtn.style.display = '';
      } else {
        // إخفاء أو تعطيل زر PayPal عندما لا يكون مفعلاً
        paypalBtn.style.display = 'none';
        if(paypalBtn.tagName === 'A') { paypalBtn.href = '#'; }
        else { paypalBtn.onclick = (e)=> e.preventDefault(); }
      }
    }
  }

  function evaluateCheckout(){
    setCheckoutState(getSelectedQuantity() > 0);
  }

  function observeAndBind(){
    evaluateCheckout();
    const summaryTarget = document.querySelector('.order-summary .summary-total, .summary-total') || document.querySelector('.order-summary .subtotal, .subtotal');
    if(summaryTarget){
      const mo = new MutationObserver(()=> evaluateCheckout());
      mo.observe(summaryTarget, { childList:true, characterData:true, subtree:true });
    }
    const cartList = document.querySelector('.cart-items-list') || document.querySelector('.cart-right .cart-items-list');
    if(cartList){
      const mo2 = new MutationObserver(()=> setTimeout(evaluateCheckout, 20));
      mo2.observe(cartList, { childList:true, subtree:true, attributes:true, attributeFilter:['data-qty'] });
      cartList.addEventListener('input', (e)=> { if(e.target.matches('.qty-dropdown input[type="number"], .qty-select')) setTimeout(evaluateCheckout,0); }, {passive:true});
      cartList.addEventListener('change', (e)=> { if(e.target.matches('.card-checkbox input[type="checkbox"], .qty-dropdown input[type="number"], .qty-select, .qty-dropdown .qty-value')) setTimeout(evaluateCheckout,0); });
    }
    window.addEventListener('load', evaluateCheckout);
    document.addEventListener('DOMContentLoaded', evaluateCheckout);
  }

  observeAndBind();
})();



// ...existing code...
(function cartCentralManager(){
  // منع تكرار التهيئة التي قد تسبّب حلقات/تأخير
  if (window.__x2_cartCentralBound) return;
  window.__x2_cartCentralBound = true;

  const STORAGE_KEY = 'x2_cart';
  // لا نترك fallback إلى document (ممكن يسبب مراقبة ضخمة وتعليق الصفحة)
  const listRoot = document.querySelector('.cart-items-list') || document.querySelector('.cart-right .cart-items-list');
  if (!listRoot) {
    console.warn('cartCentralManager: cart list not found — aborting');
    return;
  }

  function parseNum(s){
    if (!s && s !== 0) return 0;
    const str = String(s).trim();
    const m = str.match(/-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/);
    if (!m) return 0;
    return Number(m[0].replace(/,/g,'').replace(/,/g,'.')) || 0;
  }

  function allCardSelector() { return '.product-card-cart, .product-card'; }
  function allCardBoxes(root = listRoot) { return Array.from((root || document).querySelectorAll(`${allCardSelector()} .card-checkbox input[type="checkbox"]`)); }
  function allCards(root = listRoot) { return Array.from((root || document).querySelectorAll(allCardSelector())); }

// ...existing code...
function updateSummary() {
  const selector = '.product-card-cart, .product-card';
  const cards = (typeof listRoot !== 'undefined' && listRoot) ? listRoot.querySelectorAll(selector) : document.querySelectorAll(selector);

  let actualTotal = 0; // السعر بعد الخصم
  let oldTotal = 0;    // السعر قبل الخصم (subtotal)
  let totalQty = 0;    // إجمالي الكمية

  cards.forEach(card => {
    const cb = card.querySelector('.card-checkbox input[type="checkbox"]');
    if (cb && !cb.checked) return; // تجاهل إن لم تُحدد

    const cur = Number(window.parseCurrency(card.dataset.priceCurrent ?? card.querySelector('.price-current, .current-price')?.textContent ?? '0')) || 0;
    const oldCandidate = Number(window.parseCurrency(card.dataset.priceOld ?? card.querySelector('.old-price')?.textContent ?? '0')) || 0;
    const originalPrice = Math.max(cur, oldCandidate); // استخدم الأعلى كـ subtotal

    // قراءة الكمية (input أو .qty-value أو dataset)
    const inpt = card.querySelector('.qty-dropdown input[type="number"], input[type="number"]');
    const valEl = card.querySelector('.qty-dropdown .qty-value, .qty-value');
    let qty = 1;
    if (inpt) qty = Math.max(1, Number(inpt.value || 1));
    else if (valEl) qty = Math.max(1, Number(String(valEl.textContent).replace(/[^\d]/g, '') || card.dataset.qty || 1));
    else qty = Math.max(1, Number(card.dataset.qty || 1));

    actualTotal += cur * qty;
    oldTotal += originalPrice * qty;
    totalQty += qty;
    card.dataset.lineTotal = (cur * qty).toFixed(2);

    // تحديث واجهة البطاقة (عرض السعر القديم والبادج فقط عند وجود تخفيض)
    const hasDiscount = oldCandidate > cur;
    const oldEl = card.querySelector('.old-price');
    const badge = card.querySelector('.discount-badge');
    if (oldEl) {
      if (hasDiscount) {
        oldEl.style.display = '';
        oldEl.textContent = window.formatCurrency(oldCandidate);
      } else {
        oldEl.style.display = 'none';
      }
    }
    if (badge) badge.style.display = hasDiscount ? '' : 'none';
  });

  // لا نجعل الخصم سالباً
  const discount = Math.max(0, oldTotal - actualTotal);
  const shipping = 0;

  const subtotalEl = document.querySelector('.order-summary .subtotal, .subtotal');
  const discountEl = document.querySelector('.order-summary .discount, .discount');
  const shippingEl = document.querySelector('.order-summary .shipping, .shipping');
  const totalEl = document.querySelector('.order-summary .summary-total, .summary-total');

  if (subtotalEl) {
    subtotalEl.dataset.amount = oldTotal.toFixed(2);
    subtotalEl.textContent = window.formatCurrency(oldTotal);
  }

  if (discountEl) {
    discountEl.dataset.amount = discount.toFixed(2);
    if (discount > 0) {
      discountEl.style.display = '';
      discountEl.textContent = '-' + window.formatCurrency(discount);
    } else {
      discountEl.style.display = 'none';
    }
  }

  if (shippingEl) {
    shippingEl.dataset.amount = shipping.toFixed(2);
    shippingEl.textContent = (shipping === 0 ? (document.documentElement.lang === 'ar' ? 'يتم تحديده لاحقاً' : 'TBD') : window.formatCurrency(shipping));
  }

  if (totalEl) {
    const grandTotal = actualTotal + shipping;
    totalEl.dataset.amount = grandTotal.toFixed(2);
    totalEl.textContent = window.formatCurrency(grandTotal);
  }

  const checkoutCount = document.getElementById('checkout-count');
  if (checkoutCount) {
    checkoutCount.dataset.count = String(totalQty);
    checkoutCount.textContent = totalQty;
  }

  try { window.dispatchEvent(new CustomEvent('cart:summary-updated', { detail: { oldTotal, actualTotal, totalQty, discount } })); } catch(e) {}
}
// ...existing code...

  function safePersist(){
    if (typeof window.persistFromDOM === 'function') {
      try { return window.persistFromDOM(); } catch(e) {}
    }
    const cards = allCards();
    const items = cards.map(card=>{
      const cb = card.querySelector('.card-checkbox input[type="checkbox"]');
      const imgEl = card.querySelector('.image img');
      const imgSrc = imgEl?.src || imgEl?.currentSrc || imgEl?.getAttribute('data-src') || '';
      return {
        id: card.dataset.itemId || '',
        title: card.querySelector('.title')?.textContent?.trim() || '',
        meta: card.querySelector('.meta')?.textContent?.trim() || '',
        img: imgSrc,
        priceCurrent: Number(card.dataset.priceCurrent || parseNum(card.querySelector('.price-current')?.textContent || 0)) || 0,
        priceOld: Number(card.dataset.priceOld || parseNum(card.querySelector('.old-price')?.textContent || 0)) || 0,
        qty: Number(card.querySelector('.qty-dropdown input[type="number"]')?.value || card.querySelector('.qty-dropdown .qty-value')?.textContent || card.dataset.qty || 1),
        selected: !!(cb && cb.checked)
      };
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch(e){ console.error(e); }
    try { window.dispatchEvent(new CustomEvent('cart:persisted',{detail:{items}})); } catch(e){}
    return items;
  }

// ...existing code...
  function safeUpdateSelectedCount(){
    // حساب الحالة الحقيقية من مربعات الاختيار في القائمة
    const boxes = allCardBoxes();
    const selected = boxes.filter(cb => !!cb.checked).length;
    const total = allCards().length;

    // عناصر الواجهة: نص "تحديد (N)" وعداد منفصل إن وُجد
    document.querySelectorAll('.selection-count').forEach(el => {
      try { el.textContent = `تحديد (${selected})`; } catch(e) {}
    });
    const disp = document.getElementById('selectedItemsCount');
    if (disp) disp.textContent = String(selected);

    // مزامنة أي input فعلي لزر "تحديد الكل"
    const selInputs = Array.from(document.querySelectorAll('#selectAllCheckbox, .select-all-checkbox input[type="checkbox"], .select-all input[type="checkbox"]'));
    selInputs.forEach(i => { try { i.checked = (selected > 0 && selected === total && total > 0); } catch(e){} });

    // مزامنة أي غلاف غير مدخلي (custom wrapper) بواسطة aria-checked / كلاس checked
    document.querySelectorAll('.select-all, .select-all-checkbox').forEach(w => {
      // إذا يوجد input داخل الغلاف فاترك تحديثه عبر selInputs أعلاه
      if (w.querySelector && w.querySelector('input[type="checkbox"]')) return;
      try {
        if (selected > 0 && selected === total && total > 0) {
          w.classList.add('checked'); w.setAttribute('aria-checked','true');
        } else {
          w.classList.remove('checked'); w.setAttribute('aria-checked','false');
        }
      } catch(e){}
    });

    // زر الحذف
    const delBtn = document.getElementById('deleteSelectedBtn');
    if (delBtn) delBtn.disabled = selected === 0;
  }



function handleSelectAllToggle(checked) {
  const checkboxes = Array.from(listRoot.querySelectorAll('.card-checkbox input[type="checkbox"]'));
  checkboxes.forEach(cb => {
    cb.checked = checked;
    const card = cb.closest('.product-card-cart, .product-card');
    if (card) card.classList.toggle('selected', checked);
  });

  // تحديث الملخص والأسعار
  safeUpdateSelectedCount();
  safeUpdateSummary();
  safePersist();
}


  // إضافة هذه الدالة لتجنّب ReferenceError عند إلغاء التحديد
  function safeUpdateSummary(){
    // حاول استدعاء الدالة العامة أولاً إن وُجدت
    if (typeof window.updateSummary === 'function') {
      try { window.updateSummary(); return; } catch(e) { /* fallthrough */ }
    }
    // ثم حاول استدعاء التعريف المحلي إن كان موجودًا
    try { if (typeof updateSummary === 'function') { updateSummary(); return; } } catch(e) {}
    // لا شيء آخر — إن لم توجد دوال سابقة فلا نفعل شيئًا
  }


  function restoreSelections(){
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e){ saved = []; }
    if (!Array.isArray(saved) || saved.length===0) return;
    const cards = allCards();
    cards.forEach(card=>{
      let matched = null;
      const id = card.dataset.itemId || '';
      if (id) matched = saved.find(it=>String(it.id) === String(id));
      if (!matched) {
        const title = card.querySelector('.title')?.textContent?.trim()||'';
        const price = Number(card.dataset.priceCurrent||0);
        matched = saved.find(it => (it.title||'') === title && Number(it.priceCurrent||0) === price);
      }
      const cb = card.querySelector('.card-checkbox input[type="checkbox"]');
      if (cb) {
        cb.checked = !!(matched ? matched.selected : true);
        card.classList.toggle('selected', cb.checked);
      }
      if (matched && matched.img) {
        const imgEl = card.querySelector('.image img');
        if (imgEl && (!imgEl.src || imgEl.src.trim() === '')) {
          imgEl.src = matched.img;
          if (!imgEl.getAttribute('data-src')) imgEl.setAttribute('data-src', matched.img);
        }
      }
    });
    safeUpdateSelectedCount(); safeUpdateSummary();
  }




  function handleDeleteSelected(){
    const boxes = Array.from(listRoot.querySelectorAll(`${allCardSelector()} .card-checkbox input:checked`));
    if (!boxes.length) return;
    boxes.forEach(cb=>{
      const card = cb.closest('.product-card-cart, .product-card');
      if (!card) return;
      if (typeof window.removeCard === 'function') {
        try { window.removeCard(card); return; } catch(e){ /* fallback to remove */ }
      }
      card.remove();
    });
    safePersist(); safeUpdateSelectedCount(); safeUpdateSummary();
    const selAll = document.getElementById('selectAllCheckbox'); if (selAll) selAll.checked = false;
  }


  // delegated listeners
  document.addEventListener('change', function(e){
    if (e.target.matches('#selectAllCheckbox') || e.target.matches('.select-all-checkbox input[type="checkbox"]')) {
      handleSelectAllToggle(!!e.target.checked);
      return;
    }
    if (e.target.matches('.card-checkbox input[type="checkbox"]')) {
      const card = e.target.closest('.product-card-cart, .product-card');
      if (card) card.classList.toggle('selected', e.target.checked);
      safeUpdateSelectedCount(); safeUpdateSummary(); safePersist();
      return;
    }
    if (e.target.matches('.qty-dropdown input[type="number"], .qty-dropdown .qty-value')) {
      safeUpdateSummary(); safePersist();
      return;
    }
  }, false);

  
  document.addEventListener('click', function(e){
    if (e.target.closest && e.target.closest('#deleteSelectedBtn')) {
      e.preventDefault(); handleDeleteSelected(); return;
    }
  }, true);

  // init + restore
  document.addEventListener('DOMContentLoaded', function(){ restoreSelections(); safeUpdateSelectedCount(); safeUpdateSummary(); });
  window.addEventListener('load', function(){ restoreSelections(); safeUpdateSelectedCount(); safeUpdateSummary(); });

  // observe list changes with debounce to avoid tight loops
  try {
    let obsTimer = null;
    const mo = new MutationObserver((mutations) => {
      if (obsTimer) clearTimeout(obsTimer);
      obsTimer = setTimeout(() => {
        try { safeUpdateSelectedCount(); safeUpdateSummary(); } catch(e){ console.error('cart observer error', e); }
      }, 120);
    });
    // قيّد المراقبة على listRoot فقط (لا تراقب document كامل)
    mo.observe(listRoot, { childList:true, subtree:true, attributes:true, attributeFilter:['data-qty','data-key','data-item-id'] });
    window.addEventListener('beforeunload', ()=> { try { mo.disconnect(); } catch(e){} });
  } catch(e){ console.error(e); }

  
console.log('cartCentralManager initialized (safe)');
})();


