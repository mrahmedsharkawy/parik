(function() {
  'use strict';

  let allCategories = [];
  let allProducts = [];
  let activeMainSlug = null;
  let activeSubSlug = null;
  let categoryProductsRequestSeq = 0;
  const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar';
  const t = {
    all: lang === 'en' ? 'All' : 'الكل',
    allCategories: lang === 'en' ? 'All Categories' : 'جميع الفئات',
    back: lang === 'en' ? '← Back to Categories' : '← العودة للفئات',
    loadError: lang === 'en' ? 'Could not load categories' : 'تعذّر تحميل الفئات'
  };
  function catName(cat) {
    return (cat && cat.name && (cat.name[lang] || cat.name.ar || cat.name.en)) || '';
  }

  function categoryKey(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
  }

  function rowSlug(row) {
    return String(row && (row.category_slug || row.slug || row.name_en || row.name_ar || row.id) || '').trim();
  }

  function mergeCategoryLists(base, extra) {
    const out = Array.isArray(base) ? base.map(cat => ({ ...cat, subcategories: Array.isArray(cat.subcategories) ? cat.subcategories.slice() : [] })) : [];
    const findCat = cat => out.find(existing => {
      const vals = [existing.categorySlug, existing.name && existing.name.ar, existing.name && existing.name.en].map(categoryKey);
      return [cat.categorySlug, cat.name && cat.name.ar, cat.name && cat.name.en].map(categoryKey).some(v => v && vals.includes(v));
    });
    (Array.isArray(extra) ? extra : []).forEach(cat => {
      const existing = findCat(cat);
      if (!existing) { out.push(cat); return; }
      const subs = existing.subcategories || [];
      Object.assign(existing, { ...cat, subcategories: subs });
      const seen = new Set(subs.map(s => categoryKey(s.categorySlug || (s.name && (s.name.ar || s.name.en)))));
      (cat.subcategories || []).forEach(sub => {
        const key = categoryKey(sub.categorySlug || (sub.name && (sub.name.ar || sub.name.en)));
        if (key && !seen.has(key)) { subs.push(sub); seen.add(key); }
      });
    });
    return out.sort((a,b) => (a.order || 999) - (b.order || 999));
  }

  async function loadSupabaseCategories(base) {
    if (!window.Supabase || !window.Supabase.Categories || !window.Supabase.Subcategories) return base || [];
    const rows = await window.Supabase.Categories.getAll().catch(() => []);
    if (!Array.isArray(rows) || !rows.length) return base || [];
    const subRows = await window.Supabase.Subcategories.getAll().catch(() => []);
    const grouped = new Map();
    (Array.isArray(subRows) ? subRows : []).forEach(sub => {
      const categoryId = String(sub.category_id || '');
      if (!categoryId) return;
      if (!grouped.has(categoryId)) grouped.set(categoryId, []);
      grouped.get(categoryId).push(sub);
    });
    const live = rows.map((row, index) => {
      const slug = rowSlug(row);
      return {
        id: row.id,
        name: { ar: row.name_ar || row.name_en || slug, en: row.name_en || row.name_ar || slug },
        categorySlug: slug,
        image: row.image || '',
        url: `/categories/${slug}`,
        order: Number(row.sort_order || row.order || index + 1),
        subcategories: (grouped.get(String(row.id)) || []).map(sub => {
          const subSlug = rowSlug(sub);
          return { id: sub.id, name: { ar: sub.name_ar || sub.name_en || subSlug, en: sub.name_en || sub.name_ar || subSlug }, categorySlug: subSlug, image: sub.image || '', url: `/categories/${slug}/${subSlug}` };
        })
      };
    });
    return mergeCategoryLists(base || [], live);
  }

  // تحميل البيانات
  function mapSbProduct(p) {
    const imgs = [];
    if (p.image) imgs.push(p.image);
    if (Array.isArray(p.gallery)) p.gallery.forEach(g => g && g !== p.image && imgs.push(g));
    return {
      id: p.id,
      name: {ar: p.name_ar || '', en: p.name_en || p.name_ar || ''},
      desc: p.description_ar || '',
      img: imgs.length ? imgs : undefined,
      category: Array.isArray(p.categories) ? p.categories : (p.categories ? [p.categories] : []),
      subcategory: p.subcategory || '',
      price: p.price,
      oldPrice: p.old_price || undefined,
      stock: p.stock || undefined,
      rating: p.rating || undefined,
      ratingCount: p.ratingCount || undefined,
      timerEnd: p.timer_end || undefined,
      featured: p.featured || false
    };
  }

  function applyCurrentRoute() {
    const params = new URLSearchParams(location.search);
    const parts = location.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const pathCat = parts[0] === 'categories' ? parts[1] : '';
    const pathSub = parts[0] === 'categories' ? parts.slice(2).join('/') : '';
    const cat = params.get('category') || pathCat;
    const sub = params.get('subcategory') || pathSub;
    if (cat) selectMainCategory(cat, false);
    else showAllSubcategories();
    if (sub) selectSubcategory(sub);
  }

  function renderCategoryShell(cats) {
    allCategories = cats;
    buildSidebar();
    buildMobileTabs();
    applyCurrentRoute();
    document.documentElement.classList.remove('x2-categories-booting');
  }

  async function initPage() {
    let cats = [], prods = [];
    let adminCats = [];
    try {
      const cached = JSON.parse(localStorage.getItem('x2_categories_cache') || 'null');
      if (cached && Array.isArray(cached.data) && cached.data.length) renderCategoryShell(cached.data);
    } catch(e) {}
    try {
      const saved = JSON.parse(localStorage.getItem('admin_categories') || 'null');
      if (Array.isArray(saved) && saved.length) adminCats = saved;
    } catch(e) {}
    try { cats = await fetch('java/Categories.json', {cache:'force-cache'}).then(r=>r.json()); } catch(e) {}
    cats = mergeCategoryLists(cats, adminCats);
    if (cats.length) try { localStorage.setItem('x2_categories_cache', JSON.stringify({ts:Date.now(), data:cats})); } catch(e) {}
    if (cats.length) renderCategoryShell(cats);
    cats = await loadSupabaseCategories(cats);
    if (cats.length) renderCategoryShell(cats);

    const hasSupabaseProducts = !!(window.Supabase && window.Supabase.Products);
    // جلب المنتجات من Supabase أولاً
    if (hasSupabaseProducts) {
      try {
        const sb = await window.Supabase.Products.getAll(1000);
        if (Array.isArray(sb)) prods = sb.map(mapSbProduct);
      } catch(e) {}
    }
    // fallback: Products.json فقط لو Supabase غير متاح
    if (!hasSupabaseProducts && !prods.length) {
      try { prods = await fetch('/java/Products.json', {cache:'force-cache'}).then(r=>r.json()); } catch(e) {}
    }

    allProducts = prods;
    renderCategoryShell(cats);
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (document.documentElement.classList.contains('occasions-category-page')) {
      function removeOccasionsLegacyBlocks() {
        document.querySelectorAll('.filters-scroll-container').forEach(filters => {
          const filtersBar = filters.closest('.footer-info-bar') || filters;
          filtersBar.remove();
        });
        document.querySelectorAll('main.main > footer.site-footer, main.main > .footer-info-bar').forEach(el => {
          if (el.querySelector('.filter-dropdown, .filters-scroll-container')) el.remove();
        });
        document.querySelectorAll('main.main > #category-products, body > .page #category-products').forEach(el => {
          if (!el.closest('#catProductsSection')) el.remove();
        });
        const productsSection = document.getElementById('catProductsSection');
        const productsBox = productsSection && productsSection.querySelector('#category-products');
        if (productsSection && productsBox && !productsBox.children.length && !activeSubSlug) productsSection.style.display = 'none';
      }
      removeOccasionsLegacyBlocks();
      const filters = document.querySelector('.filters-scroll-container');
      if (filters) {
        const filtersBar = filters.closest('.footer-info-bar');
        if (filtersBar) filtersBar.style.display = 'none';
        else filters.style.display = 'none';
      }
      document.querySelectorAll('body > .page #category-products, main > #category-products').forEach(el => {
        if (!el.closest('#catProductsSection')) el.style.display = 'none';
      });
      document.querySelectorAll('main.main > footer.site-footer, main.main > .footer-info-bar').forEach(el => {
        el.style.display = 'none';
      });
      new MutationObserver(removeOccasionsLegacyBlocks).observe(document.body, { childList: true, subtree: true });
    }
    initPage().catch(() => {
      document.getElementById('catSubGrid').innerHTML = `<p style="color:#aaa;padding:20px">${t.loadError}</p>`;
      document.documentElement.classList.remove('x2-categories-booting');
    });
  });

  // بناء الشريط الجانبي
  function buildSidebar() {
    const sb = document.getElementById('catSidebar');
    const title = sb.querySelector('.cat-sidebar-title');
    sb.innerHTML = '';
    sb.appendChild(title);

    // عنصر "الكل"
    const allItem = makeItem({name:{ar:'جميع الفئات',en:'All Categories'}, categorySlug:'all', image:''}, true);
    allItem.dataset.slug = 'all';
    allItem.addEventListener('click', () => { selectMainCategory('all', true); });
    sb.appendChild(allItem);

    allCategories.forEach(cat => {
      const item = makeItem(cat);
      item.dataset.slug = cat.categorySlug;
      item.addEventListener('click', () => selectMainCategory(cat.categorySlug, true));
      sb.appendChild(item);
    });
  }

  function makeItem(cat, isAll=false) {
    const a = document.createElement('div');
    a.className = 'cat-sidebar-item';
    const name = catName(cat);
    const subs = cat.subcategories ? cat.subcategories.length : '';
    a.innerHTML = isAll
      ? `<span style="font-size:1.2rem">💯</span><span>${name}</span>`
      : `<img src="${cat.image||''}" alt="${name}">${name}${subs?`<span class="cat-count">${subs}</span>`:''}`;
    return a;
  }

  // بناء تبويبات الموبايل
  function buildMobileTabs() {
    const wrap = document.getElementById('catMobileTabs');
    wrap.innerHTML = '';
    const allTab = document.createElement('div');
    allTab.className = 'cat-mobile-tab active';
    allTab.dataset.slug = 'all';
    allTab.innerHTML = `💯 ${t.all}`;
    allTab.addEventListener('click', () => selectMainCategory('all', false));
    wrap.appendChild(allTab);

    allCategories.forEach(cat => {
      const tab = document.createElement('div');
      tab.className = 'cat-mobile-tab';
      tab.dataset.slug = cat.categorySlug;
      const name = catName(cat);
      tab.innerHTML = `${cat.image?`<img src="${cat.image}" alt="">`:''}${name}`;
      tab.addEventListener('click', () => selectMainCategory(cat.categorySlug, false));
      wrap.appendChild(tab);
    });
  }

  function centerMobileTab(tabEl) {
    const wrap = document.getElementById('catMobileTabs');
    if (!wrap || !tabEl) return;
    const target = tabEl.offsetLeft - (wrap.clientWidth - tabEl.offsetWidth) / 2;
    wrap.scrollTo({ left: target, behavior: 'smooth' });
  }

  // اختيار فئة رئيسية
  function selectMainCategory(slug, scroll) {
    activeMainSlug = slug;
    activeSubSlug = null;

    // تحديث active في الشريط
    document.querySelectorAll('.cat-sidebar-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.cat-mobile-tab').forEach(el => el.classList.remove('active'));
    const sideEl = document.querySelector(`.cat-sidebar-item[data-slug="${slug}"]`);
    if (sideEl) sideEl.classList.add('active');
    const tabEl = document.querySelector(`.cat-mobile-tab[data-slug="${slug}"]`);
    if (tabEl) { tabEl.classList.add('active'); centerMobileTab(tabEl); }

    if (slug === 'all') {
      showAllSubcategories();
    } else {
      const cat = allCategories.find(c => c.categorySlug === slug);
      if (!cat) return;
      const name = catName(cat);
      document.getElementById('catMainTitle').textContent = name;
      document.getElementById('catBreadcrumb').innerHTML = `<a data-cat-all-link>${t.all}</a> › <span>${name}</span>`;
      document.getElementById('catBackBtn').style.display = 'flex';
      renderSubcategories(cat.subcategories || [], slug);
    }

    if (scroll) window.scrollTo({top:0,behavior:'smooth'});
    updateUrl(slug, null);
  }

  // عرض كل الفئات الفرعية من كل الفئات
  function showAllSubcategories() {
    activeMainSlug = 'all';
    activeSubSlug = null;
    document.querySelectorAll('.cat-sidebar-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.cat-mobile-tab').forEach(el => el.classList.remove('active'));
    const allSide = document.querySelector('.cat-sidebar-item[data-slug="all"]');
    if (allSide) allSide.classList.add('active');
    const allTab = document.querySelector('.cat-mobile-tab[data-slug="all"]');
    if (allTab) allTab.classList.add('active');

    document.getElementById('catMainTitle').textContent = `🛍 ${t.allCategories}`;
    document.getElementById('catBreadcrumb').innerHTML = `<span>${t.all}</span>`;
    document.getElementById('catBackBtn').style.display = 'none';
    hideProducts();

    // عرض كل الفئات الرئيسية كبطاقات كبيرة
    const grid = document.getElementById('catSubGrid');
    grid.innerHTML = '';
    // 2 في الصف على الموبايل، صف واحد على الكمبيوتر
    if (window.innerWidth <= 900) {
      grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else {
      // صف واحد يمتد بعدد الفئات
      grid.style.gridTemplateColumns = `repeat(${allCategories.length}, minmax(0, 1fr))`;
    }
    allCategories.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'cat-sub-card';
      const name = catName(cat);
      card.innerHTML = `
        <img class="cat-sub-img" src="${cat.image||''}" alt="${name}">
        <div class="cat-sub-name">${name}</div>`;
      card.addEventListener('click', () => selectMainCategory(cat.categorySlug, true));
      grid.appendChild(card);
    });
  }

  // رسم الفئات الفرعية
  function renderSubcategories(subs, parentSlug) {
    const grid = document.getElementById('catSubGrid');
    grid.innerHTML = '';
    hideProducts();
    document.querySelectorAll('.cat-sub-card').forEach(c=>c.classList.remove('active'));

    // تحديد عدد الأعمدة على الموبايل حسب عدد الفئات الفرعية
    const isMobile = window.innerWidth <= 900;
    if (isMobile) {
      const count = subs.length;
      if (count <= 4) {
        // صف واحد بعدد الأعمدة = عدد العناصر (بحد أقصى 4)
        grid.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
      } else if (count <= 6) {
        // صفّان: 3 في كل صف
        grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
      } else {
        grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
      }
    } else {
      grid.style.gridTemplateColumns = '';
    }

    subs.forEach(sub => {
      const card = document.createElement('div');
      card.className = 'cat-sub-card';
      card.dataset.slug = sub.categorySlug;
      const name = catName(sub);
      card.innerHTML = `
        <img class="cat-sub-img" src="${sub.image||''}" alt="${name}">
        <div class="cat-sub-name">${name}</div>`;
      card.addEventListener('click', () => selectSubcategory(sub.categorySlug, name, parentSlug));
      grid.appendChild(card);
    });
  }

  // اختيار فئة فرعية وعرض منتجاتها
  function selectSubcategory(subSlug, subName, parentSlug) {
    activeSubSlug = subSlug;
    const subMeta = findSubcategoryMeta(subSlug, subName, parentSlug);
    if (!subName) subName = subMeta ? catName(subMeta) : subSlug;

    document.querySelectorAll('.cat-sub-card').forEach(c=>c.classList.remove('active'));
    const card = document.querySelector(`.cat-sub-card[data-slug="${subSlug}"]`);
    if (card) card.classList.add('active');

    const filtered = filterProducts(subSlug, subName);
    showProducts(filtered, subName);
    loadSupabaseProductsForSubcategory(subMeta, subName);
    updateUrl(activeMainSlug, subSlug);
  }

  async function loadSupabaseProductsForSubcategory(subMeta, title) {
    if (!subMeta || !subMeta.id || !window.Supabase || !window.Supabase.Products || typeof window.Supabase.Products.getByCategoryPage !== 'function') return;
    const seq = ++categoryProductsRequestSeq;
    try {
      const result = await window.Supabase.Products.getByCategoryPage({
        subcategoryId: subMeta.id,
        page: 1,
        pageSize: 60,
        sort: localStorage.getItem('x2_store_product_sort') === 'newest' ? 'created_at.desc' : 'sort_order.asc'
      });
      if (seq !== categoryProductsRequestSeq) return;
      const rows = result && Array.isArray(result.data) ? result.data : [];
      if (rows.length) showProducts(rows.map(mapSbProduct), title);
    } catch(e) {}
  }

  // تصفية المنتجات
  function findSubcategoryMeta(slug, name, parentSlug) {
    const norm = v => String(v||'').toLowerCase().trim();
    const ids = [slug, name].map(norm).filter(Boolean);
    const cats = parentSlug ? allCategories.filter(c => c.categorySlug === parentSlug) : allCategories;
    for (const cat of cats) {
      const found = (cat.subcategories || []).find(sub => {
        const vals = [sub.categorySlug, sub.name && sub.name.ar, sub.name && sub.name.en].map(norm);
        return vals.some(v => ids.includes(v));
      });
      if (found) return found;
    }
    return null;
  }

  function filterProducts(slug, name) {
    const norm = v => String(v||'').toLowerCase().trim();
    const subMeta = findSubcategoryMeta(slug, name, activeMainSlug);
    const targets = [slug, name, subMeta && subMeta.categorySlug, subMeta && subMeta.name && subMeta.name.ar, subMeta && subMeta.name && subMeta.name.en]
      .map(norm)
      .filter(Boolean);
    return allProducts.filter(p => {
      const fields = [p.category, p.subCategory, p.subcategory, p.categorySlug, p.subcategorySlug];
      return fields.some(f => {
        if (!f) return false;
        if (Array.isArray(f)) return f.some(v => typeof v === 'object'
          ? targets.includes(norm(v.ar)) || targets.includes(norm(v.en))
          : targets.includes(norm(v)));
        if (typeof f==='object') return targets.includes(norm(f.ar)) || targets.includes(norm(f.en));
        return targets.includes(norm(f));
      });
    });
  }

  function sortProductsForStore(list) {
    const value = p => {
      const raw = p && (p.created_at || p.createdAt || p.updated_at || p.updatedAt || p.date || p.timerEnd || '');
      const time = raw ? new Date(raw).getTime() : 0;
      if (!isNaN(time) && time > 0) return time;
      const id = Number(p && (p.id || p.productId || 0));
      return Number.isFinite(id) ? id : 0;
    };
    const daily = p => {
      const today = new Date(), dayKey = today.getFullYear() * 1e4 + (today.getMonth()+1) * 100 + today.getDate();
      const key = String(p && (p.id || p.productId || (p.name && (p.name.ar || p.name.en)) || p.name || ''));
      let hash = dayKey;
      for (let i=0; i<key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
      return hash;
    };
    const copy = Array.isArray(list) ? list.slice() : [];
    const mode = localStorage.getItem('x2_store_product_sort') || 'daily_random';
    if (mode === 'newest') return copy.sort((a,b) => value(b) - value(a));
    if (mode === 'oldest') return copy.sort((a,b) => value(a) - value(b));
    if (mode === 'price_asc') return copy.sort((a,b) => (parseFloat(a.price)||0) - (parseFloat(b.price)||0));
    if (mode === 'price_desc') return copy.sort((a,b) => (parseFloat(b.price)||0) - (parseFloat(a.price)||0));
    if (mode === 'discount') return copy.sort((a,b) => ((parseFloat(b.oldPrice)-parseFloat(b.price))/(parseFloat(b.oldPrice)||1)) - ((parseFloat(a.oldPrice)-parseFloat(a.price))/(parseFloat(a.oldPrice)||1)));
    if (mode === 'rating') return copy.sort((a,b) => (parseFloat(b.rating)||0) - (parseFloat(a.rating)||0));
    if (mode === 'name_az') return copy.sort((a,b) => String(a.name?.ar || a.name?.en || a.name || '').localeCompare(String(b.name?.ar || b.name?.en || b.name || ''), 'ar'));
    return copy.sort((a,b) => daily(b) - daily(a));
  }

  // عرض المنتجات
  function showProducts(products, title) {
    const sec = document.getElementById('catProductsSection');
    const container = document.getElementById('category-products');
    sec.style.display = '';
    document.getElementById('catProductsTitle').textContent = '🛍 ' + title;
    document.getElementById('catProductsCount').textContent = lang === 'en' ? `${products.length} Products` : products.length + ' منتج';
    container.innerHTML = '';

    if (!products.length) {
      container.innerHTML = `<p style="color:#aaa;padding:20px;text-align:center">${lang === 'en' ? 'No products in this category yet' : 'لا توجد منتجات لهذه الفئة حالياً'}</p>`;
      return;
    }

    // استخدم createProductCard لو متاحة (module)، وإلا ارسم مباشرة
    function renderCard(p) {
      if (typeof window.createProductCard === 'function') return window.createProductCard(p);
      // fallback: كارت مطابق لكارت الرئيسية عند الهاتف
      const name = (typeof p.name==='object'?(p.name[lang]||p.name.ar||p.name.en):(p.name||(lang === 'en' ? 'Product' : 'منتج')));
      const img  = (Array.isArray(p.img)?p.img[0]:p.img)||'assets/logo.png';
      const langParam = (localStorage.getItem('lang') || document.documentElement.lang) === 'en' ? '?lang=en' : '';
      const link = p.id ? `product.html?id=${encodeURIComponent(p.id)}${langParam ? '&lang=en' : ''}` : '#';
      const price = parseFloat(p.price)||0;
      const oldPrice = parseFloat(p.oldPrice)||0;
      const sym = {AED:'د.إ',USD:'$',SAR:'ر.س',EGP:'ج.م'}[localStorage.getItem('currency')||'AED']||'د.إ';
      const disc = oldPrice>price ? Math.round((oldPrice-price)/oldPrice*100) : 0;
      const save = disc ? (oldPrice-price).toFixed(2) : '';
      const money = v => lang === 'en' ? `${sym} ${v}` : `${v} ${sym}`;
      const sales = (() => {
        const id = String(p.id || p.productId || name || '');
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 10;
        return (2.1 + hash / 10).toFixed(1) + 'k+';
      })();
      const timerHtml = '<span class="timer-h">05</span><span class="timer-sep timer-sep-hm">:</span><span class="timer-m">59</span><span class="timer-sep timer-sep-ms">:</span><span class="timer-s">59</span>';

      const card = document.createElement('div');
      card.className = 'product-card';
      card.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
      card.style.cssText = 'position:relative;cursor:pointer;width:100%;margin:0;break-inside:avoid;';
      card.innerHTML = `
        <a href="${link}" style="display:block;text-decoration:none;color:inherit">
          <img class="product-img" src="${img}" alt="${name}" width="750" height="750" loading="lazy" decoding="async">
          ${disc?`<span class="offer-badge">${lang === 'en' ? disc + '% OFF' : 'خصم ' + disc + '%'}</span>`:''}
          <div class="product-content">
            <div class="product-name">${name}</div>
            <div class="product-rating-container"><div class="stars-container"><div class="stars-empty">★★★★★</div><div class="stars-filled" style="width:100%">★★★★★</div></div></div>
            ${disc?`<div class="product-timer-save-box"><span class="product-save-text"><span class="save-arrow">&#8595;</span> ${lang === 'en' ? 'Extra ' + money(save) + ' off' : 'خصم إضافي ' + money(save)}</span><span class="product-timer">${timerHtml}</span></div>`:''}
            <div class="product-price-row"><span class="product-price${disc?' product-price-discount':''}">${money(price.toFixed(2))}</span><span class="product-fire">🔥</span><span class="product-sales">${lang === 'en' ? 'sold ' + sales : 'تم بيع ' + sales}</span></div>
            ${disc?`<div class="product-old-price-striked">${money(oldPrice.toFixed(2))}</div>`:''}
          </div>
        </a>
        <button class="product-cart-btn" type="button" title="${lang === 'en' ? 'Add to cart' : 'إضافة للسلة'}" aria-label="${lang === 'en' ? 'Add to cart' : 'إضافة للسلة'}"><span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="cart-svg-icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 1C1.44772 1 1 1.44772 1 2C1 2.55228 1.44772 3 2 3H3.21922L6.78345 17.2569C5.73276 17.7236 5 18.7762 5 20C5 21.6569 6.34315 23 8 23C9.65685 23 11 21.6569 11 20C11 19.6494 10.9398 19.3128 10.8293 19H15.1707C15.0602 19.3128 15 19.6494 15 20C15 21.6569 16.3431 23 18 23C19.6569 23 21 21.6569 21 20C21 18.3431 19.6569 17 18 17H8.78078L8.28078 15H18C20.0642 15 21.3019 13.6959 21.9887 12.2559C22.6599 10.8487 22.8935 9.16692 22.975 7.94368C23.0884 6.24014 21.6803 5 20.1211 5H5.78078L5.15951 2.51493C4.93692 1.62459 4.13696 1 3.21922 1H2ZM18 13H7.78078L6.28078 7H20.1211C20.6742 7 21.0063 7.40675 20.9794 7.81078C20.9034 8.9522 20.6906 10.3318 20.1836 11.3949C19.6922 12.4251 19.0201 13 18 13ZM18 20.9938C17.4511 20.9938 17.0062 20.5489 17.0062 20C17.0062 19.4511 17.4511 19.0062 18 19.0062C18.5489 19.0062 18.9938 19.4511 18.9938 20C18.9938 20.5489 18.5489 20.9938 18 20.9938ZM7.00617 20C7.00617 20.5489 7.45112 20.9938 8 20.9938C8.54888 20.9938 8.99383 20.5489 8.99383 20C8.99383 19.4511 8.54888 19.0062 8 19.0062C7.45112 19.0062 7.00617 19.4511 7.00617 20Z" fill="currentColor"></path></svg></span></button>`;
      const cartBtn = card.querySelector('.product-cart-btn');
      cartBtn && cartBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        try {
          const item = { id: String(p.id || p.productId || ''), title: name, img: img, priceCurrent: price, priceOld: oldPrice, qty: 1 };
          const cart = JSON.parse(localStorage.getItem('x2_cart') || '[]');
          const ix = cart.findIndex(it => String(it.id) === String(item.id));
          ix > -1 ? cart[ix].qty = (Number(cart[ix].qty) || 1) + 1 : cart.unshift(item);
          localStorage.setItem('x2_cart', JSON.stringify(cart));
          localStorage.setItem('x2_cart_ts', String(Date.now()));
          window.dispatchEvent(new CustomEvent('cart:updated', { detail: { product: item } }));
        } catch(e) {}
      });
      return card;
    }

    function createProductsRow() {
      const nextRow = document.createElement('div');
      const mobileMasonry = window.matchMedia && window.matchMedia('(max-width: 899px)').matches;
      nextRow.className = mobileMasonry ? 'products-row products-masonry' : 'products-row';
      if (mobileMasonry) nextRow.innerHTML = '<div class="products-column"></div><div class="products-column"></div>';
      return nextRow;
    }

    const row = createProductsRow();
    const orderedProducts = (window.sortProductsForStore || sortProductsForStore)(products);
    const FIRST_CHUNK = 24;
    const NEXT_CHUNK = 24;
    let shown = 0;
    let activeRow = row;
    let activeRenderer = renderCard;
    if (container._x2LazyProductsCleanup) container._x2LazyProductsCleanup();
    function appendChunk(targetRow, renderer) {
      const fragment = document.createDocumentFragment();
      const columns = Array.from(targetRow.querySelectorAll(':scope > .products-column'));
      const next = Math.min(shown + (shown ? NEXT_CHUNK : FIRST_CHUNK), orderedProducts.length);
      for (; shown < next; shown++) {
        const card = renderer(orderedProducts[shown]);
        if (!card) continue;
        if (columns.length) columns[shown % columns.length].appendChild(card);
        else fragment.appendChild(card);
      }
      if (!columns.length) targetRow.appendChild(fragment);
    }
    appendChunk(row, renderCard);
    container.appendChild(row);
    let loadingMoreProducts = false;
    let productsUserScrolled = false;
    let productsCanLoadMore = false;
    let lastLoadScrollY = -1;
    let lastLoadAt = 0;
    let loadMoreObserver = null;
    const loadMoreSentinel = document.createElement('div');
    loadMoreSentinel.className = 'cat-products-load-sentinel';
    loadMoreSentinel.setAttribute('aria-hidden', 'true');
    loadMoreSentinel.style.cssText = 'height:1px;width:100%;clear:both;';
    function isNearProductsEnd() {
      const rect = container.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset || 0;
      return rect.bottom <= window.innerHeight + 700 || window.innerHeight + scrollY >= document.documentElement.scrollHeight - 700;
    }
    function observeLoadMoreSentinel() {
      if (shown >= orderedProducts.length) {
        if (loadMoreObserver) loadMoreObserver.disconnect();
        loadMoreSentinel.remove();
        return;
      }
      if (!loadMoreSentinel.parentNode) container.appendChild(loadMoreSentinel);
      if (!('IntersectionObserver' in window)) return;
      if (loadMoreObserver) loadMoreObserver.disconnect();
      loadMoreObserver = new IntersectionObserver(entries => {
        if (entries[0] && entries[0].isIntersecting && productsUserScrolled && productsCanLoadMore) loadMoreProducts(true);
      }, { root: null, rootMargin: '0px 0px 700px 0px', threshold: 0 });
      loadMoreObserver.observe(loadMoreSentinel);
    }
    function loadMoreProducts(force) {
      if (loadingMoreProducts || shown >= orderedProducts.length) return;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      if (scrollY > 80) {
        productsUserScrolled = true;
        productsCanLoadMore = true;
      }
      if (!productsUserScrolled || !productsCanLoadMore) return;
      const now = Date.now();
      if (lastLoadAt && now - lastLoadAt < 900) return;
      if (lastLoadScrollY >= 0 && Math.abs(scrollY - lastLoadScrollY) < 160) return;
      if (!isNearProductsEnd()) return;
      lastLoadScrollY = scrollY;
      lastLoadAt = now;
      productsCanLoadMore = false;
      loadingMoreProducts = true;
      requestAnimationFrame(() => {
        appendChunk(activeRow, activeRenderer);
        lastLoadScrollY = window.scrollY || window.pageYOffset || 0;
        loadingMoreProducts = false;
        observeLoadMoreSentinel();
        if (shown >= orderedProducts.length) window.removeEventListener('scroll', loadMoreProducts);
      });
    }
    window.addEventListener('scroll', loadMoreProducts, { passive: true });
    observeLoadMoreSentinel();
    container._x2LazyProductsCleanup = () => {
      window.removeEventListener('scroll', loadMoreProducts);
      if (loadMoreObserver) loadMoreObserver.disconnect();
      loadMoreSentinel.remove();
    };

    // حاول استخدام createProductCard لو اتحمل لاحقاً
    if (typeof window.createProductCard !== 'function') {
      const waitFor = setInterval(() => {
        if (typeof window.createProductCard === 'function') {
          clearInterval(waitFor);
          container.innerHTML = '';
          const row2 = createProductsRow();
          shown = 0;
          activeRow = row2;
          activeRenderer = window.createProductCard;
          appendChunk(row2, window.createProductCard);
          container.appendChild(row2);
          observeLoadMoreSentinel();
        }
      }, 300);
      setTimeout(() => clearInterval(waitFor), 5000);
    }
  }

  function hideProducts() {
    const container = document.getElementById('category-products');
    if (container && container._x2LazyProductsCleanup) {
      container._x2LazyProductsCleanup();
      container._x2LazyProductsCleanup = null;
    }
    document.getElementById('catProductsSection').style.display = 'none';
    if (container) container.innerHTML = '';
  }

  document.addEventListener('error', function(event) {
    const img = event.target;
    if (!img || !img.tagName || img.tagName !== 'IMG') return;
    if (img.classList.contains('product-img') || img.classList.contains('cat-sub-img')) {
      img.src = '/assets/logo.png';
      return;
    }
    if (img.closest && img.closest('.cat-sidebar-item')) img.style.display = 'none';
  }, true);

  document.addEventListener('click', function(event) {
    const allLink = event.target.closest('[data-cat-all-link]');
    if (!allLink) return;
    event.preventDefault();
    selectMainCategory('all', true);
  });

  function updateUrl(cat, sub) {
    const params = new URLSearchParams();
    if (cat && cat !== 'all') params.set('category', cat);
    if (sub) params.set('subcategory', sub);
    const q = params.toString();
    history.replaceState({}, '', q ? '?' + q : location.pathname);
  }

  window.showAllSubcategories = showAllSubcategories;
})();
