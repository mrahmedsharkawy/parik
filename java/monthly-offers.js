(function () {
  const grid = document.getElementById('monthlyGrid');
  const countEl = document.getElementById('monthlyCount');
  const maxEl = document.getElementById('monthlyMaxDiscount');
  const search = document.getElementById('monthlySearch');
  let deals = [];
  const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar';
  function tr(ar, en) { return lang === 'en' ? en : ar; }

  function price(value) { const n = parseFloat(value); return Number.isFinite(n) ? n : 0; }
  function nameOf(product) {
    const raw = product && product.name;
    return (raw && typeof raw === 'object' ? (raw[lang] || raw.ar || raw.en) : raw || tr('منتج', 'Product')).toString();
  }
  function discountOf(product) {
    const oldPrice = price(product.oldPrice);
    const current = price(product.price);
    return oldPrice > current && current > 0 ? Math.round(((oldPrice - current) / oldPrice) * 100) : 0;
  }
  function imageOf(product) { return Array.isArray(product.img) ? product.img[0] : (product.img || '/assets/logo.png'); }
  function currency() { return { AED: 'د.إ', USD: '$', EUR: '€', SAR: 'ر.س', EGP: 'ج.م', KWD: 'د.ك', JOD: 'د.أ', GBP: '£' }[localStorage.getItem('currency') || 'AED'] || 'AED'; }
  function normalizeSupabaseProduct(product) {
    const images = [];
    if (product.image) images.push(product.image);
    if (Array.isArray(product.gallery)) product.gallery.forEach(function (item) { if (item && item !== product.image) images.push(item); });
    return {
      id: product.id,
      name: { ar: product.name_ar || '', en: product.name_en || product.name_ar || '' },
      img: images,
      price: product.price,
      oldPrice: product.old_price,
      category: Array.isArray(product.categories) ? product.categories : [],
      created_at: product.created_at || '',
      updated_at: product.updated_at || ''
    };
  }
  function waitForSupabaseProducts() {
    return new Promise(function (resolve) {
      if (window.Supabase && window.Supabase.Products) return resolve(true);
      const started = Date.now();
      const timer = setInterval(function () {
        if (window.Supabase && window.Supabase.Products) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started > 2200) { clearInterval(timer); resolve(false); }
      }, 80);
    });
  }
  function wireImageFallbacks() {
    grid.querySelectorAll('.monthly-img').forEach(function (img) {
      img.addEventListener('error', function () {
        this.src = '/assets/logo.png';
      }, { once: true });
    });
  }

  function render(list) {
    if (!list.length) {
      grid.innerHTML = '<div class="monthly-empty">' + tr('لا توجد منتجات بخصومات عالية حالياً', 'No highly discounted products right now') + '</div>';
      return;
    }
    const sym = currency();
    grid.innerHTML = list.map(product => {
      const d = discountOf(product);
      const oldPrice = price(product.oldPrice);
      const current = price(product.price);
      const saved = Math.max(0, oldPrice - current).toFixed(2);
      const link = product.id ? '/product.html?id=' + encodeURIComponent(product.id) : '/product.html';
      return `
        <article class="monthly-card">
          <a href="${link}" aria-label="${nameOf(product).replace(/"/g, '&quot;')}">
            <span class="monthly-badge">-${d}%</span>
            <img class="monthly-img" src="${imageOf(product)}" alt="${nameOf(product).replace(/"/g, '&quot;')}" loading="lazy">
            <div class="monthly-body">
              <div class="monthly-name">${nameOf(product)}</div>
              <div class="monthly-price-row">
                <span class="monthly-price">${current.toFixed(2)} ${sym}</span>
                <span class="monthly-old">${oldPrice.toFixed(2)} ${sym}</span>
              </div>
              <span class="monthly-save">${tr('وفّر', 'Save')} ${saved} ${sym}</span>
            </div>
          </a>
        </article>`;
    }).join('');
    wireImageFallbacks();
  }

  function apply(products) {
    deals = (Array.isArray(products) ? products : [])
      .map(product => ({ ...product, price: price(product.price), oldPrice: price(product.oldPrice) }))
      .filter(product => discountOf(product) > 0)
      .sort((a, b) => discountOf(b) - discountOf(a))
      .slice(0, 50);
    const max = deals.length ? Math.max(...deals.map(discountOf)) : 0;
    countEl.textContent = deals.length + ' ' + (deals.length === 1 ? tr('منتج', 'Product') : tr('منتج', 'Products'));
    maxEl.textContent = tr('حتى', 'Up to') + ' ' + max + '% ' + tr('خصم', 'OFF');
    render(deals);
  }

  search.addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    render(q ? deals.filter(product => nameOf(product).toLowerCase().includes(q)) : deals);
  });

  async function loadMonthlyOffers() {
    try {
      let products = [];
      const hasSupabaseProducts = await waitForSupabaseProducts();
      if (hasSupabaseProducts) {
        const currentProducts = await window.Supabase.Products.getAll(1000);
        products = Array.isArray(currentProducts) ? currentProducts.map(normalizeSupabaseProduct) : [];
      } else {
        const response = await fetch('/java/Products.json', { cache: 'no-store' });
        products = response.ok ? await response.json() : [];
      }
      apply(products);
    } catch (e) {
      countEl.textContent = '0 ' + tr('منتج', 'Products');
      maxEl.textContent = tr('حتى', 'Up to') + ' 0% ' + tr('خصم', 'OFF');
      grid.innerHTML = '<div class="monthly-empty">' + tr('تعذر تحميل عروض الشهر الآن', 'Unable to load monthly deals right now') + '</div>';
    }
  }
  loadMonthlyOffers();
})();
