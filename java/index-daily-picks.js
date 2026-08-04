(function(){
  const grid = document.getElementById('dailyPicksGrid');
  if (!grid) return;
  grid.addEventListener('error', function(ev){var img=ev.target;if(img&&img.matches&&img.matches('[data-daily-pick-img]'))img.src='/assets/logo.png'}, true);

  let dragStartX = 0;
  let dragStartY = 0;
  let dragMode = null;
  let suppressClickUntil = 0;
  const dailyPicksById = {};

  function pauseAutoScroll() {}

  function startAutoScroll() {
    // Auto-scroll intentionally disabled: strip should move by user drag only.
  }

  function resetDrag() {
    dragMode = null;
    grid.classList.remove('is-dragging');
  }

  grid.addEventListener('touchstart', function(e) {
    pauseAutoScroll(2600);
    if (!e.touches || e.touches.length !== 1) return;
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
    dragMode = null;
  }, { passive: true });

  grid.addEventListener('touchmove', function(e) {
    if (!e.touches || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartX;
    const dy = e.touches[0].clientY - dragStartY;

    if (!dragMode && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      dragMode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (dragMode === 'x') grid.classList.add('is-dragging');
    }

    if (dragMode === 'y') return;

    if (dragMode === 'x') {
      suppressClickUntil = Date.now() + 500;
    }
  }, { passive: true });

  grid.addEventListener('touchend', function(e) { resetDrag(e); pauseAutoScroll(1400); }, { passive: true });
  grid.addEventListener('touchcancel', function(e) { resetDrag(e); pauseAutoScroll(1400); }, { passive: true });
  grid.addEventListener('pointerdown', function(){ pauseAutoScroll(2600); }, { passive: true });
  grid.addEventListener('wheel', function(){ pauseAutoScroll(1800); }, { passive: true });

  let lastDailyNavHref = '';
  let lastDailyNavAt = 0;
  grid.addEventListener('click', function(e) {
    const addButton = e.target.closest && e.target.closest('.dp-add-cart');
    if (addButton && grid.contains(addButton)) {
      e.preventDefault();
      e.stopPropagation();
      const card = addButton.closest('.dp-card[data-product-id]');
      const product = card && dailyPicksById[String(card.getAttribute('data-product-id'))];
      try {
        const cart = JSON.parse(localStorage.getItem('x2_cart') || '[]');
        const productId = String(product?.id || product?.productId || card?.getAttribute('data-product-id') || '');
        if (!productId) return;
        const productImage = Array.isArray(product?.img) ? product.img[0] : product?.img || card?.querySelector('.dp-img')?.currentSrc || card?.querySelector('.dp-img')?.src || 'assets/logo.png';
        const productTitle = product?.name?.ar || product?.name?.en || card?.querySelector('.dp-img')?.alt || '';
        const productPrice = parseFloat(product?.price ?? addButton.getAttribute('data-price')) || 0;
        const productOldPrice = parseFloat(product?.oldPrice ?? addButton.getAttribute('data-old-price')) || 0;
        const existing = cart.find(item => String(item.id) === productId);
        if (existing) existing.qty = (Number(existing.qty) || 1) + 1;
        else cart.unshift({ id: productId, title: productTitle, img: productImage, priceCurrent: productPrice, priceOld: productOldPrice, qty: 1 });
        localStorage.setItem('x2_cart', JSON.stringify(cart));
        localStorage.setItem('x2_cart_ts', String(Date.now()));
        const count = cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
        document.querySelectorAll('.cart-count, #checkout-count').forEach(el => { el.textContent = count; el.style.display = count ? 'flex' : 'none'; });
        document.querySelectorAll('.cart-badge').forEach(el => el.setAttribute('data-count', count ? String(count) : '0'));
        window.dispatchEvent(new CustomEvent('x2:cart-updated', { detail: { count } }));
        addButton.classList.add('is-added');
        setTimeout(() => addButton.classList.remove('is-added'), 700);
      } catch(err) {}
      return;
    }
    const link = e.target.closest && e.target.closest('a[href*="product.html?id="],a[href*="/product/"]');
    if (!link || !grid.contains(link)) return;
    if (Date.now() < suppressClickUntil) {
      e.preventDefault();
      return;
    }
    const href = link.href;
    const now = Date.now();
    e.preventDefault();
    if (href === lastDailyNavHref && now - lastDailyNavAt < 1500) return;
    lastDailyNavHref = href;
    lastDailyNavAt = now;
    try {
      const y = window.scrollY || window.pageYOffset || 0;
      const pageKey = (function(url){ try { var u = new URL(url || location.href, location.href); var path = u.pathname.replace(/\/index\.html$/i, '/').replace(/\/+$/, ''); if (!path) path = '/'; return path + (u.search || ''); } catch(err) { return String(url || location.href || ''); } })(location.href);
      const card = link.closest && link.closest('.dp-card[data-product-id],.product-card[data-product-id]');
      const rect = card && card.getBoundingClientRect ? card.getBoundingClientRect() : null;
      const productId = card && card.getAttribute('data-product-id');
      const product = productId && dailyPicksById[String(productId)];
      const imgEl = card && card.querySelector && card.querySelector('img');
      const fastImg = imgEl && (imgEl.currentSrc || imgEl.src) || (product && (Array.isArray(product.img) ? product.img[0] : product.img));
      const positions = JSON.parse(sessionStorage.getItem('x2_scroll_positions') || '{}');
      positions[pageKey] = y;
      sessionStorage.setItem('x2_scroll_positions', JSON.stringify(positions));
      const productReturnPositions = JSON.parse(sessionStorage.getItem('x2_product_return_positions') || '{}');
      productReturnPositions[pageKey] = y;
      sessionStorage.setItem('x2_product_return_positions', JSON.stringify(productReturnPositions));
      sessionStorage.setItem('x2_return_to_scroll_url', pageKey);
      if (productId) {
        sessionStorage.setItem('x2_product_return_target', JSON.stringify({
          url: pageKey,
          section: 'daily-picks',
          productId: productId,
          offset: Math.max(8, Math.round(rect ? rect.top : 8))
        }));
      }
      if (productId || product) {
        sessionStorage.setItem('x2_quick_product', JSON.stringify({
          id: product && (product.id || product.productId) || productId,
          name: product && product.name || (imgEl && imgEl.alt) || '',
          category: product && product.category,
          img: fastImg,
          rawImg: product && (Array.isArray(product.img) ? product.img[0] : product.img) || fastImg,
          price: product && product.price,
          oldPrice: product && product.oldPrice,
          rating: product && product.rating,
          ratingCount: product && product.ratingCount,
          stock: product && product.stock,
          timerEnd: product && product.timerEnd,
          currency: product && product.currency
        }));
      }
    } catch(e) {}
    window.location.assign(href);
  }, true);

  function renderStars(r) {
    r = parseFloat(r) || 0;
    const full = Math.floor(r), half = r % 1 >= 0.5 ? 1 : 0, empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  }

  function optimizeSupabaseImageUrl(src, width, height) {
    try {
      if (!src || !/\/storage\/v1\/object\/public\/products\//.test(String(src)) || /\/storage\/v1\/render\/image\//.test(String(src))) return src;
      const url = new URL(src, location.origin);
      url.pathname = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
      url.searchParams.set('width', String(width || 180));
      url.searchParams.set('height', String(height || width || 180));
      url.searchParams.set('resize', 'cover');
      url.searchParams.set('quality', '70');
      return url.href;
    } catch(e) {
      return src;
    }
  }

  function renderCard(p, idx) {
    const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar';
    const rawName = p?.name;
    const name = (rawName && typeof rawName === 'object' ? (rawName[lang] || rawName.ar || rawName.en) : rawName || (lang === 'en' ? 'Product' : 'منتج')).toString();
    const img  = optimizeSupabaseImageUrl((Array.isArray(p.img) ? p.img[0] : p.img) || 'assets/logo.png', 180, 180);
    const langParam = lang === 'en' ? '?lang=en' : '';
    const link = p.id ? `product.html?id=${encodeURIComponent(p.id)}${langParam ? '&lang=en' : ''}` : 'product.html';
    const pr = parseFloat(p.price), old = parseFloat(p.oldPrice);
    const disc = (old > pr && pr > 0) ? Math.round(((old - pr) / old) * 100) : 0;
    const isPriority = idx < 4;
    const imgLoad = isPriority ? 'eager' : 'lazy';
    const imgPriority = isPriority ? ' fetchpriority="high"' : '';
    const money = lang === 'en' ? `AED ${pr.toFixed(2)}` : `${pr.toFixed(2)} د.إ`;
    const oldMoney = lang === 'en' ? `AED ${old.toFixed(2)}` : `${old.toFixed(2)} د.إ`;
    return `
      <article class="dp-card" data-product-id="${p.id || p.productId || ''}">
        <a class="dp-product-link" href="${link}" aria-label="${name}">
          <div class="dp-media">
          <img class="dp-img" src="${img}" alt="${name}" width="180" height="180" loading="${imgLoad}"${imgPriority} decoding="async" data-daily-pick-img>
          </div>
          <div class="dp-pricing">
            ${disc > 0 ? `<span class="dp-badge">-${disc}%</span>` : ''}
            <div class="dp-price-wrap"><strong class="dp-price">${money}</strong>${disc > 0 ? `<del class="dp-old-price">${oldMoney}</del>` : ''}</div>
          </div>
        </a>
        <button class="dp-add-cart" type="button" data-price="${Number.isFinite(pr) ? pr : 0}" data-old-price="${Number.isFinite(old) ? old : 0}" aria-label="${lang === 'en' ? 'Add to cart' : 'أضف للسلة'}"><span>+</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2 11h10l2-7H7M9 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2m8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/></svg></button>
      </article>`;
  }

  async function loadDailyPicks() {
    try {
      // جلب المنتجات من Supabase أولاً حتى لا تظهر منتجات محذوفة من كاش قديم.
      let products = null;
      const newestValue = p => {
        const raw = p && (p.created_at || p.createdAt || p.updated_at || p.updatedAt || p.date || p.timerEnd || '');
        const time = raw ? new Date(raw).getTime() : 0;
        if (!isNaN(time) && time > 0) return time;
        const id = Number(p && (p.id || p.productId || 0));
        return Number.isFinite(id) ? id : 0;
      };
      const newestFirst = list => (Array.isArray(list) ? list.slice() : []).sort((a,b) => newestValue(b) - newestValue(a));
      const sortLang = (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar';
      const dailyRandomValue = p => {
        const today = new Date(), dayKey = today.getFullYear() * 1e4 + (today.getMonth()+1) * 100 + today.getDate();
        const key = String(p && (p.id || p.productId || (p.name && (p.name.ar || p.name.en)) || p.name || ''));
        let hash = dayKey;
        for (let i=0; i<key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
        return hash;
      };
      const storeSort = list => {
        const copy = Array.isArray(list) ? list.slice() : [];
        const mode = localStorage.getItem('x2_store_product_sort') || 'daily_random';
        if (mode === 'newest') return newestFirst(copy);
        if (mode === 'oldest') return copy.sort((a,b) => newestValue(a) - newestValue(b));
        if (mode === 'price_asc') return copy.sort((a,b) => (parseFloat(a.price)||0) - (parseFloat(b.price)||0));
        if (mode === 'price_desc') return copy.sort((a,b) => (parseFloat(b.price)||0) - (parseFloat(a.price)||0));
        if (mode === 'discount') return copy.sort((a,b) => ((parseFloat(b.oldPrice)-parseFloat(b.price))/(parseFloat(b.oldPrice)||1)) - ((parseFloat(a.oldPrice)-parseFloat(a.price))/(parseFloat(a.oldPrice)||1)));
        if (mode === 'rating') return copy.sort((a,b) => (parseFloat(b.rating)||0) - (parseFloat(a.rating)||0));
        if (mode === 'name_az') return copy.sort((a,b) => String(a.name?.ar || a.name?.en || a.name || '').localeCompare(String(b.name?.ar || b.name?.en || b.name || ''), sortLang));
        return copy.sort((a,b) => dailyRandomValue(b) - dailyRandomValue(a));
      };
      const hasSupabaseProducts = await new Promise(resolve => {
        if (window.Supabase && window.Supabase.Products) return resolve(true);
        const started = Date.now();
        const timer = setInterval(() => {
          if (window.Supabase && window.Supabase.Products) { clearInterval(timer); resolve(true); }
          else if (Date.now() - started > 1800) { clearInterval(timer); resolve(false); }
        }, 80);
      });
      const settingsPromise = window.Supabase && window.Supabase.Settings ? window.Supabase.Settings.get().catch(function(){ return null; }) : Promise.resolve(null);

      if (hasSupabaseProducts) {
        try {
          const sb = await window.Supabase.Products.getAll(100000);
          if (Array.isArray(sb)) {
            products = sb.map(p => {
              const imgs = [];
              if (p.image) imgs.push(p.image);
              if (Array.isArray(p.gallery)) p.gallery.forEach(g => { if(g && g !== p.image) imgs.push(g); });
              return { id: p.id, name: { ar: p.name_ar||'', en: p.name_en||'' }, img: imgs, price: p.price, oldPrice: p.old_price, rating: p.rating, date: p.created_at || p.updated_at || '', created_at: p.created_at || '', updated_at: p.updated_at || '' };
            });
          }
        } catch(e) {}
      } else {
        try {
          const snapshot = await fetch('/java/Products.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []);
          if (Array.isArray(snapshot) && snapshot.length) products = snapshot;
        } catch(e) {}
      }

      // إعدادات المتجر من Supabase: الترتيب + اختيارات اليوم
      let dailyPickList = [];
      try {
        if (window.Supabase && window.Supabase.Settings) {
          const settingsResult = await settingsPromise;
          const settings = Array.isArray(settingsResult) ? settingsResult[0] : settingsResult;
          if (settings && settings.product_sort) localStorage.setItem('x2_store_product_sort', settings.product_sort);
          if (settings && Array.isArray(settings.daily_picks)) {
            dailyPickList = settings.daily_picks.map(String);
            localStorage.setItem('x2_daily_picks', JSON.stringify(dailyPickList));
          }
        }
      } catch(e) {}

      products = storeSort(products || []);

      // اختيارات اليوم من الأدمن
      if (!dailyPickList.length) {
        try { dailyPickList = JSON.parse(localStorage.getItem('x2_daily_picks') || '[]').map(String); } catch(e) { dailyPickList = []; }
      }
      let dailyIds = new Set(dailyPickList);

      if (dailyIds.size <= 0) {
        grid.innerHTML = '';
        try { localStorage.removeItem('x2_dp_cache'); } catch(e) {}
        return;
      }

      const byId = {};
      products.forEach(p => { byId[String(p.id)] = p; });
      const chosen = dailyPickList.map(id => byId[String(id)]).filter(Boolean);

      if (!chosen.length) { grid.innerHTML = ''; return; }
      Object.keys(dailyPicksById).forEach(id => { delete dailyPicksById[id]; });
      chosen.forEach(p => { dailyPicksById[String(p.id || p.productId || '')] = p; });
      grid.innerHTML = chosen.map(renderCard).join('');
      startAutoScroll();
      try { localStorage.setItem('x2_dp_cache', JSON.stringify({ chosen, ts: Date.now() })); } catch(e) {}
    } catch(e) {
      if (!grid.children.length) grid.innerHTML = '';
    }
  }

  // عرض الكاش فوراً (بدون تأخير) فقط لو يوجد اختيار محفوظ من الأدمن.
  (function showCacheNow() {
    try {
      const savedDailyPicks = JSON.parse(localStorage.getItem('x2_daily_picks') || '[]');
      if (!Array.isArray(savedDailyPicks) || !savedDailyPicks.length) {
        localStorage.removeItem('x2_dp_cache');
        return;
      }
      const dpCache = localStorage.getItem('x2_dp_cache');
      if (dpCache) {
        const { chosen, ts } = JSON.parse(dpCache);
        if (Date.now() - ts < 10 * 60 * 1000 && Array.isArray(chosen) && chosen.some(p => savedDailyPicks.map(String).includes(String(p && p.id)))) {
          Object.keys(dailyPicksById).forEach(id => { delete dailyPicksById[id]; });
          chosen.forEach(p => { dailyPicksById[String(p.id || p.productId || '')] = p; });
          grid.innerHTML = chosen.map(renderCard).join('');
          startAutoScroll();
        }
      }
    } catch(e) {}
  })();

  // تحميل البيانات الجديدة فوراً؛ الكاش أعلاه يظهر أولاً إن كان متاحاً.
  loadDailyPicks();
})();
