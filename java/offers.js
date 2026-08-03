(function () {
  'use strict';

  const PRODUCTS_URL = '/java/Products.json';
  const CART_KEY     = 'x2_cart';
  const OFFERS_CACHE_KEY = 'x2_offers_deals_cache_v1';
  let allDeals  = [];
  let sortKey   = 'discount';
  const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar';
  const tr = {
    product: lang === 'en' ? 'Product' : 'منتج',
    save: lang === 'en' ? 'Save' : 'وفّر',
    addToCart: lang === 'en' ? '🛒 Add to Cart' : '🛒 أضف للسلة',
    added: lang === 'en' ? '✅ Added' : '✅ تمت الإضافة',
    noResults: lang === 'en' ? 'No results' : 'لا توجد نتائج',
    noDeals: lang === 'en' ? 'No deals right now' : 'لا توجد عروض حالياً',
    tryAnother: lang === 'en' ? 'Try another search term' : 'جرّب كلمة بحث أخرى',
    soon: lang === 'en' ? 'New deals will be added soon' : 'سنضيف عروضاً قريباً'
  };
  function getName(product) {
    const raw = product?.name;
    return (raw && typeof raw === 'object' ? (raw[lang] || raw.ar || raw.en) : raw || tr.product).toString();
  }
  if (lang === 'en') {
    const title = document.querySelector('.fsh-title');
    if (title) title.innerHTML = '<span class="fire-big">🔥</span> Exclusive <span class="gold">Flash</span> Deals <span class="fire-big">🔥</span>';
    const sectionTitle = document.querySelector('.offers-section-title h2');
    if (sectionTitle) sectionTitle.textContent = '🔥 All discounted products';
  }

  /* ---- helpers ---- */
  function getPriceValue(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }
  function pad(n) { return String(Math.floor(n)).padStart(2,'0'); }
  function getCurrSym() {
    const code = localStorage.getItem('currency') || 'AED';
    return {AED:'د.إ',USD:'$',EUR:'€',SAR:'ر.س',EGP:'ج.م',KWD:'د.ك',JOD:'د.أ',GBP:'£'}[code] || code;
  }

  /* ---- countdown: يعيد ضبط نفسه كل 24 ساعة تبدأ من منتصف الليل ---- */
  function initCountdown() {
    function tick() {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const diff = end - now;
      document.getElementById('cd-h').textContent = pad(diff / 3600000);
      document.getElementById('cd-m').textContent = pad((diff % 3600000) / 60000);
      document.getElementById('cd-s').textContent = pad((diff % 60000) / 1000);
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---- خريطة منتجات العروض (بتتملى عند التحميل) ---- */
  const offersMap = {};

  /* ---- cart ---- */
  function getCart()     { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e) { return []; } }
  function saveCart(c)   { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch(e) {} }
  function updateCartBadge() {
    const count = getCart().reduce((s,it) => s + (Number(it.qty)||1), 0);
    const el = document.getElementById('checkout-count');
    if (el) { el.textContent = count > 0 ? count : ''; el.style.display = count > 0 ? 'flex' : 'none'; }
    window.__cartCount = count;
    window.dispatchEvent(new CustomEvent('cart:updated', {detail:{count}}));
  }

  function addToCart(product) {
    if (!product || !product.id) return;
    const cart = getCart();
    const img  = Array.isArray(product.img) ? product.img[0] : (product.img || 'assets/logo.png');
    const name = getName(product);
    const idx  = cart.findIndex(i => String(i.id) === String(product.id));
    if (idx > -1) { cart[idx].qty = (Number(cart[idx].qty)||1) + 1; }
    else { cart.push({ id: product.id, title: name, price: getPriceValue(product.price), img, qty: 1 }); }
    saveCart(cart);
    updateCartBadge();
  }

  window.__addOfferById = function(id, btn) {
    const product = offersMap[String(id)];
    if (!product) return;
    addToCart(product);
    if (btn) {
      btn.classList.add('added');
      btn.textContent = tr.added;
      setTimeout(() => {
        btn.classList.remove('added');
        btn.textContent = tr.addToCart;
      }, 1400);
    }
  };

  /* ---- render one card ---- */
  function renderCard(p) {
    /* حفظ المنتج في الخريطة عشان الزر يقدر يجيبه بالـ ID */
    offersMap[String(p.id)] = p;

    const name     = getName(p);
    const price    = getPriceValue(p.price);
    const oldPrice = getPriceValue(p.oldPrice);
    const discount = oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
    const saved    = (oldPrice - price).toFixed(2);
    const img      = Array.isArray(p.img) ? p.img[0] : (p.img || 'assets/logo.png');
    const langParam = (localStorage.getItem('lang') || document.documentElement.lang) === 'en' ? '?lang=en' : '';
    const link     = p.id ? `product.html?id=${encodeURIComponent(p.id)}${langParam ? '&lang=en' : ''}` : 'product.html';
    const sym      = getCurrSym();

    return `
      <div class="product-card offers-card-item">
        <a href="${link}" style="text-decoration:none;display:contents;">
          <span class="offer-badge">-${discount}%</span>
          <img class="product-img" src="${img}" alt="${name}" loading="lazy">
          <div class="product-content" style="padding:6px 8px 10px;">
            <div class="product-name">${name}</div>
            <div class="product-price-row">
              <span class="product-price product-price-discount">${price.toFixed(2)} ${sym}</span>
            </div>
            <span class="product-old-price-striked">${oldPrice.toFixed(2)} ${sym}</span>
            <div class="product-timer-save-box" style="margin-top:4px;">
              <span class="product-save-text">${tr.save} ${saved} ${sym}</span>
            </div>
          </div>
        </a>
        <button
          class="offer-add-cart-btn"
          data-offer-id="${p.id}"
        >${tr.addToCart}</button>
      </div>`;
  }

  document.addEventListener('error', function(event) {
    const img = event.target;
    if (img && img.classList && img.classList.contains('product-img')) img.src = '/assets/logo.png';
  }, true);

  document.addEventListener('click', function(event) {
    const btn = event.target.closest('[data-offer-id]');
    if (!btn) return;
    event.preventDefault();
    window.__addOfferById(btn.dataset.offerId, btn);
  });

  /* ---- sort ---- */
  window.setSort = function(key, btn) {
    sortKey = key;
    document.querySelectorAll('.offers-sort-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderGrid();
  };

  function newestValue(p) {
    const raw = p && (p.created_at || p.createdAt || p.updated_at || p.updatedAt || p.date || p.timerEnd || '');
    const time = raw ? new Date(raw).getTime() : 0;
    if (!isNaN(time) && time > 0) return time;
    const id = Number(p && (p.id || p.productId || 0));
    return Number.isFinite(id) ? id : 0;
  }

  function sortNewestFirst(arr) {
    return [...arr].sort((a,b) => newestValue(b) - newestValue(a));
  }

  function dailyRandomValue(p) {
    const today = new Date(), dayKey = today.getFullYear() * 1e4 + (today.getMonth()+1) * 100 + today.getDate();
    const key = String(p && (p.id || p.productId || (p.name && (p.name.ar || p.name.en)) || p.name || ''));
    let hash = dayKey;
    for (let i=0; i<key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return hash;
  }

  function sortByStoreMode(arr) {
    const copy = [...arr];
    const mode = localStorage.getItem('x2_store_product_sort') || 'daily_random';
    if (mode === 'newest') return sortNewestFirst(copy);
    if (mode === 'oldest') return copy.sort((a,b) => newestValue(a) - newestValue(b));
    if (mode === 'price_asc') return copy.sort((a,b) => a.price - b.price);
    if (mode === 'price_desc') return copy.sort((a,b) => b.price - a.price);
    if (mode === 'discount') return copy.sort((a,b) => {
      const da = a.oldPrice > a.price ? (a.oldPrice - a.price) / a.oldPrice : 0;
      const db = b.oldPrice > b.price ? (b.oldPrice - b.price) / b.oldPrice : 0;
      return db - da;
    });
    if (mode === 'rating') return copy.sort((a,b) => (parseFloat(b.rating)||0) - (parseFloat(a.rating)||0));
    if (mode === 'name_az') return copy.sort((a,b) => getName(a).localeCompare(getName(b), lang === 'en' ? 'en' : 'ar'));
    return copy.sort((a,b) => dailyRandomValue(b) - dailyRandomValue(a));
  }

  function sortDeals(arr) {
    const copy = [...arr];
    if (sortKey === 'discount') {
      copy.sort((a,b) => {
        const da = a.oldPrice > a.price ? (a.oldPrice - a.price) / a.oldPrice : 0;
        const db = b.oldPrice > b.price ? (b.oldPrice - b.price) / b.oldPrice : 0;
        return db - da;
      });
    } else if (sortKey === 'price_asc')  { copy.sort((a,b) => a.price - b.price); }
    else if (sortKey === 'price_desc') { copy.sort((a,b) => b.price - a.price); }
    else if (sortKey === 'saving')     { copy.sort((a,b) => (b.oldPrice-b.price) - (a.oldPrice-a.price)); }
    else { return sortByStoreMode(copy); }
    return copy;
  }

  /* ---- search filter ---- */
  let searchQ = '';
  document.getElementById('searchInput')?.addEventListener('input', function() {
    searchQ = this.value.trim().toLowerCase();
    renderGrid();
  });

  function renderGrid() {
    const grid = document.getElementById('offersGrid');
    let deals = sortDeals(allDeals);
    if (searchQ) {
      deals = deals.filter(p => {
        const name = getName(p).toLowerCase();
        return name.includes(searchQ);
      });
    }
    if (!deals.length) {
      grid.innerHTML = `
        <div class="offers-state">
          <div class="state-icon">🎁</div>
          <h3>${searchQ ? tr.noResults : tr.noDeals}</h3>
          <p>${searchQ ? tr.tryAnother : tr.soon}</p>
        </div>`;
      return;
    }
    grid.innerHTML = deals.map(renderCard).join('');
  }

  function applyDeals(products) {
    let featuredIds = new Set();
    try { featuredIds = new Set(JSON.parse(localStorage.getItem('x2_featured_ids') || '[]')); } catch(e) {}

    const mapped = (Array.isArray(products) ? products : []).map(p => ({
      ...p,
      price:    getPriceValue(p.price),
      oldPrice: getPriceValue(p.oldPrice)
    }));
    const featured   = featuredIds.size ? mapped.filter(p => featuredIds.has(String(p.id))) : [];
    const discounted = mapped.filter(p => p.oldPrice > p.price && p.price > 0 && !featuredIds.has(String(p.id)));
    allDeals = featured.length ? [...featured, ...discounted] : discounted;

    document.getElementById('dealsCount').textContent = allDeals.length;
    if (allDeals.filter(p => p.oldPrice > p.price).length) {
      const maxDisc = Math.max(...allDeals.filter(p => p.oldPrice > p.price).map(p => Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)));
      document.getElementById('maxDiscountPill').textContent = lang === 'en' ? `Up to ${maxDisc}% OFF` : `حتى ${maxDisc}% خصم`;
    }
    renderGrid();
  }

  function readCachedDeals() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(OFFERS_CACHE_KEY) || localStorage.getItem(OFFERS_CACHE_KEY) || 'null');
      return cached && Array.isArray(cached.products) && cached.products.length ? cached.products : null;
    } catch(e) {}
    return null;
  }

  function showCachedDeals() {
    const cachedProducts = readCachedDeals();
    if (cachedProducts) applyDeals(cachedProducts);
  }

  function saveDealsCache(products) {
    try {
      if (!Array.isArray(products) || !products.length) return;
      const payload = JSON.stringify({ ts: Date.now(), products: products.slice(0, 300) });
      sessionStorage.setItem(OFFERS_CACHE_KEY, payload);
      localStorage.setItem(OFFERS_CACHE_KEY, payload);
    } catch(e) {}
  }

  function waitForSupabaseProducts() {
    if (window.Supabase && window.Supabase.Products) return Promise.resolve(true);
    return new Promise(resolve => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.Supabase && window.Supabase.Products) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started > 1800) { clearInterval(timer); resolve(false); }
      }, 80);
    });
  }

  /* ---- load products ---- */
  async function loadDeals() {
    const grid = document.getElementById('offersGrid');
    try {
      let products = null;
      showCachedDeals();
      const settingsPromise = (async function() { try {
        if (window.Supabase && window.Supabase.Settings) {
          const settings = await window.Supabase.Settings.get();
          if (settings && settings.product_sort) localStorage.setItem('x2_store_product_sort', settings.product_sort);
        }
      } catch(e) {} })();
      // قراءة المنتجات من Supabase أولاً حتى لا تظهر منتجات محذوفة من كاش محلي.
      const hasSupabaseProducts = await waitForSupabaseProducts();
      if (hasSupabaseProducts) {
        try {
          const sb = await window.Supabase.Products.getAll(100000);
          if (Array.isArray(sb)) {
            products = sb.map(p => {
              const imgs = [];
              if (p.image) imgs.push(p.image);
              if (Array.isArray(p.gallery)) p.gallery.forEach(g => { if(g && g !== p.image) imgs.push(g); });
              return {
                id: p.id,
                name: { ar: p.name_ar || '', en: p.name_en || p.name_ar || '' },
                img: imgs,
                price: p.price,
                oldPrice: p.old_price,
                category: Array.isArray(p.categories) ? p.categories : [],
                date: p.created_at || p.updated_at || '',
                created_at: p.created_at || '',
                updated_at: p.updated_at || '',
                rating: p.rating
              };
            });
          }
        } catch(e) {}
      }

      if (!products && hasSupabaseProducts) {
        products = readCachedDeals();
        if (!products && allDeals.length) return;
      }

      // Products.json fallback فقط لو Supabase غير متاح
      if (!hasSupabaseProducts && !products) {
        const res = await fetch(PRODUCTS_URL, { cache: 'no-store' });
        products = await res.json();
      }

      if (Array.isArray(products)) {
        applyDeals(products);
        saveDealsCache(products);
      }
      settingsPromise.then(function(){ if (sortKey !== 'discount') renderGrid(); }).catch(function(){});
    } catch (e) {
      grid.innerHTML = `
        <div class="offers-state">
          <div class="state-icon">⚠️</div>
          <h3>${lang === 'en' ? 'Could not load deals' : 'تعذّر تحميل العروض'}</h3>
          <p>${lang === 'en' ? 'Check your connection and try again' : 'تحقق من اتصالك وأعد المحاولة'}</p>
        </div>`;
    }
  }

  /* ---- init ---- */
  initCountdown();
  updateCartBadge();
  // انتظر تحميل supabase.js قبل جلب المنتجات
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDeals);
  } else {
    setTimeout(loadDeals, 100); // أعطِ supabase.js وقت للتحميل
  }
})();
