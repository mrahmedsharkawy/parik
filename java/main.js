// ??????? ???????
document.addEventListener("DOMContentLoaded", () => {

  // ????? ????? ???????? (404) ????????
  document.querySelectorAll('img').forEach(function(img) {
    img.addEventListener('error', function() {
      this.setAttribute('data-broken', '1');
    }, { once: true });
  });
  // ?????? ????? ??????? ?????? ?? JS
  const imgObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (!node.querySelectorAll) return;
        node.querySelectorAll('img').forEach(function(img) {
          img.addEventListener('error', function() {
            this.setAttribute('data-broken', '1');
          }, { once: true });
        });
      });
    });
  });
  imgObserver.observe(document.body, { childList: true, subtree: true });
  const lang = localStorage.getItem("lang") || "ar";
  const currency = localStorage.getItem("currency") || "????";
  const elements = document.querySelectorAll("[data-i18n]");

  // ??? ????? ?????? ???????? ??? ?????
  document.documentElement.dir = (lang === "ar" ? "rtl" : "ltr");
  document.documentElement.lang = lang;

  fetch("translations/" + lang + ".json")
    .then(res => res.json())
    .then(data => {
      elements.forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (data[lang] && data[lang][key]) {
          el.innerHTML = data[lang][key];
        } else if (data["ar"] && data["ar"][key] && document.documentElement.dir === "rtl") {
          el.innerHTML = data["ar"][key];
        } else if (data["en"] && data["en"][key] && document.documentElement.dir === "ltr") {
          el.innerHTML = data["en"][key];
        }
      });

      // ????? ????? ?????? ???????? ??? ????? ??? ??? ???? ???? title ???? data-i18n
      const pageTitle = document.querySelector('title[data-i18n]');
      if (pageTitle) {
        const key = pageTitle.getAttribute('data-i18n');
        // ?????? ??????? ?????? ???? ?????? ??? (?? ???? ??? "???? ??????")
        if (data[lang] && data[lang][key]) {
          pageTitle.textContent = data[lang][key];
        } else if (data["ar"] && data["ar"][key] && document.documentElement.dir === "rtl") {
          pageTitle.textContent = data["ar"][key];
        } else if (data["en"] && data["en"][key] && document.documentElement.dir === "ltr") {
          pageTitle.textContent = data["en"][key];
        }
      }
    });

  const langSelect = document.getElementById("language");
  if (langSelect) {
    langSelect.value = lang;
    langSelect.addEventListener("change", () => {
      localStorage.setItem("lang", langSelect.value);
      // ??? ????? ?????? ??? ????? ?????
      document.documentElement.dir = (langSelect.value === "ar" ? "rtl" : "ltr");
      document.documentElement.lang = langSelect.value;
      location.reload();
    });
  }

  const currencySelect = document.getElementById("currency");
  if (currencySelect) {
    currencySelect.value = currency;
    currencySelect.addEventListener("change", () => {
      localStorage.setItem("currency", currencySelect.value);
    });
  }

  // ????? ??????? ??????? ??????? ???????
  handleResponsive();
});


// ????? ?? ??????? ??? ??????? ?????? ???? ????? ???
function handleResponsive() {
  const width = window.innerWidth;
  const headerContent = document.querySelector(".header-content");
  const children = headerContent ? headerContent.children : [];

  for (let i = 0; i < children.length; i++) {
    if (!children[i].classList.contains("search-container")) {
      children[i].style.display = width < 1020 ? "none" : "flex";
    }
  }
}


window.addEventListener("resize", handleResponsive);

/* ================================================================
   ??? ???????? ???? ??????? ??? ?????? ??? ??????? (????? ?????)
================================================================ */
(function() {
  // ??? ??????? ?? ?????? ???????? (????? ??? ??????)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const SCROLL_KEY = 'x2_scroll_positions';

  function getPositions() {
    try { return JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}'); } catch(e) { return {}; }
  }

  function saveCurrentPosition() {
    try {
      const pos = getPositions();
      pos[location.href] = window.scrollY;
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify(pos));
    } catch(e) {}
  }

  function restorePosition() {
    try {
      const pos = getPositions();
      const y = pos[location.href];
      if (y > 0) {
        // ????? ???? ??????? ?????? ??? ??????
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: y, behavior: 'auto' });
          });
        });
      }
    } catch(e) {}
  }

  // حفظ الموضع بعد توقف التمرير بـ 500ms (تقليل الضغط على sessionStorage)
  let scrollTimer;
  window.addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(saveCurrentPosition, 500);
  }, { passive: true });

  // حفظ الموضع عند مغادرة الصفحة
  window.addEventListener('pagehide', saveCurrentPosition);
  window.addEventListener('beforeunload', saveCurrentPosition);

  // ??????? ?????? ??? ?????? ????? (swipe back / ?? ??????)
  window.addEventListener('pageshow', function(e) {
    // e.persisted = true ??? ???? ?? bfcache (??? ???????)
    if (e.persisted) {
      restorePosition();
    }
  });

  // ??????? ?????? ??? popstate (SPA navigation)
  window.addEventListener('popstate', function() {
    setTimeout(restorePosition, 100);
  });
})();

// ???? ????? 
document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("textSearch");
  const searchIcon = document.querySelector(".icon.search");
  const imageInput = document.getElementById("imageSearchInput");
  const resultsBox = document.getElementById("searchResults");

  // ===== Dropdown ??? ???? ????? =====
  const searchContainer = searchInput ? searchInput.closest('.search-container') : null;
  let dropdownBox = null;
  if (searchContainer) {
    searchContainer.style.position = 'relative';
    dropdownBox = document.createElement('div');
    dropdownBox.id = 'searchDropdown';
    dropdownBox.style.cssText = [
      'position:absolute',
      'top:calc(100% + 6px)',
      'right:0',
      'left:0',
      'z-index:99999',
      'background:#fff',
      'border-radius:14px',
      'box-shadow:0 8px 32px rgba(0,0,0,.15)',
      'max-height:70vh',
      'overflow-y:auto',
      'display:none',
      'direction:rtl',
      'min-width:260px',
    ].join(';');
    searchContainer.appendChild(dropdownBox);
  }

  function showDropdown(content) {
    if (dropdownBox) {
      dropdownBox.innerHTML = content || '';
      dropdownBox.style.display = content ? 'block' : 'none';
    } else if (resultsBox) {
      resultsBox.innerHTML = content || '';
    }
  }
  function clearDropdown() {
    if (dropdownBox) { dropdownBox.innerHTML = ''; dropdownBox.style.display = 'none'; }
    if (resultsBox) resultsBox.innerHTML = '';
  }

  let _productsCache = null;
  async function getProducts() {
    if (_productsCache && _productsCache.length > 0) return _productsCache;
    try {
      const SS_KEY = 'x2_prods_ss_v2';
      const cached = sessionStorage.getItem(SS_KEY);
      if (cached) {
        const obj = JSON.parse(cached);
        if (Date.now()-obj.ts < 60000 && Array.isArray(obj.data) && obj.data.length > 0) {
          _productsCache = obj.data;
          return _productsCache;
        }
      }
      // ?????: Supabase (?????? ???????)
      if (window.Supabase && window.Supabase.Products) {
        try {
          const sbProds = await window.Supabase.Products.getAll(500);
          if (Array.isArray(sbProds) && sbProds.length > 0) {
            _productsCache = sbProds.map(function(p){
              const imgs = [];
              if (p.image) imgs.push(p.image);
              if (Array.isArray(p.gallery)) p.gallery.forEach(function(g){ if(g && g!==p.image) imgs.push(g); });
              return {
                id: p.id,
                name: { ar: p.name_ar||'', en: p.name_en||p.name_ar||'' },
                desc: p.description_ar||'', img: imgs,
                price: p.price, oldPrice: p.old_price
              };
            });
            try { sessionStorage.setItem(SS_KEY, JSON.stringify({ts:Date.now(),data:_productsCache})); } catch(e2) {}
            return _productsCache;
          }
        } catch(e) {}
      }
      // fallback: Products.json
      const r = await fetch('java/Products.json');
      _productsCache = await r.json();
      return _productsCache;
    } catch(e) { return []; }
  }
  function getOrders() {
    try { return JSON.parse(localStorage.getItem('x2_orders')||'[]'); } catch(e) { return []; }
  }

  // ???? ????? ?????
  async function performTextSearch() {
    const keyword = searchInput.value.trim().toLowerCase();
    clearDropdown();
    if (!keyword) return;

    const [products, orders] = await Promise.all([getProducts(), getOrders()]);

    const prodResults = products.filter(p => {
      const name = (typeof p.name==='object'?(p.name.ar||p.name.en):(p.name||'')).toLowerCase();
      const desc = (typeof p.desc==='object'?(p.desc.ar||p.desc.en):(p.desc||'')).toLowerCase();
      return name.includes(keyword)||desc.includes(keyword);
    }).slice(0,8);

    const orderResults = orders.filter(o=>
      String(o.id||'').toLowerCase().includes(keyword)||
      (o.items||[]).some(i=>(i.title||'').toLowerCase().includes(keyword))
    ).slice(0,3);

    if (!prodResults.length && !orderResults.length) {
      showDropdown(`<p style="color:#888;padding:14px;text-align:center;font-size:.84rem">?? ???? ????? ?? "${searchInput.value.trim()}"</p>`);
      return;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:8px;';

    if (prodResults.length) {
      const t=document.createElement('div');
      t.style.cssText='font-size:.72rem;font-weight:700;color:#aaa;padding:4px 8px 6px;text-transform:uppercase;letter-spacing:.04em;';
      t.textContent='?? ??????';
      wrap.appendChild(t);
      prodResults.forEach(p=>{
        const name=typeof p.name==='object'?(p.name.ar||p.name.en):(p.name||'????');
        const img=(Array.isArray(p.img)?p.img[0]:p.img)||'assets/logo.png';
        const link=p.id?`product.html?id=${encodeURIComponent(p.id)}`:'#';
        const a=document.createElement('a');
        a.href=link;
        a.style.cssText='display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;text-decoration:none;color:inherit;transition:background .12s;';
        a.onmouseenter=()=>a.style.background='#f7f8fc';
        a.onmouseleave=()=>a.style.background='';
        a.innerHTML=`<img src="${img}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px;flex-shrink:0;background:#f0f0f0" onerror="this.src='assets/logo.png'"><span style="font-size:.84rem;font-weight:600;color:#111;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span><span style="font-size:.78rem;font-weight:700;color:#D4AF37;white-space:nowrap">${p.price?p.price+' ?.?':''}</span>`;
        wrap.appendChild(a);
      });
    }

    if (orderResults.length) {
      const sep=document.createElement('div');
      sep.style.cssText='border-top:1px solid #f0f0f0;margin:6px 0;';
      wrap.appendChild(sep);
      const t2=document.createElement('div');
      t2.style.cssText='font-size:.72rem;font-weight:700;color:#aaa;padding:4px 8px 6px;text-transform:uppercase;letter-spacing:.04em;';
      t2.textContent='?? ?????';
      wrap.appendChild(t2);
      orderResults.forEach(o=>{
        const a=document.createElement('a');
        a.href='account.html';
        a.style.cssText='display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;text-decoration:none;color:inherit;transition:background .12s;';
        a.onmouseenter=()=>a.style.background='#f7f8fc';
        a.onmouseleave=()=>a.style.background='';
        const fi=(o.items||[])[0]||{};
        a.innerHTML=`<span style="font-size:1.2rem;flex-shrink:0">??</span><span style="font-size:.84rem;font-weight:600;color:#111;flex:1">??? ${o.id||''}</span><span style="font-size:.78rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px">${fi.title||''}</span>`;
        wrap.appendChild(a);
      });
    }

    const cb=document.createElement('div');
    cb.style.cssText='text-align:center;padding:6px 0 2px;border-top:1px solid #f5f5f5;margin-top:6px;';
    cb.innerHTML=`<button onclick="window._clearSearch&&window._clearSearch()" style="border:none;background:none;color:#bbb;font-size:.72rem;cursor:pointer;padding:4px 10px;">????? ?</button>`;
    wrap.appendChild(cb);

    if (dropdownBox) {
      dropdownBox.innerHTML = '';
      dropdownBox.appendChild(wrap);
      dropdownBox.style.display = 'block';
    } else if (resultsBox) {
      resultsBox.innerHTML = '';
      resultsBox.appendChild(wrap);
    }
  }

  window._clearSearch = clearDropdown;
  window.performTextSearch = performTextSearch;

  // ????? ?? ??? ??? (live search)
  let _liveTimer = null;
  if (searchInput) {
  searchInput.addEventListener("input", function () {
    clearTimeout(_liveTimer);
    if (!searchInput.value.trim()) { clearDropdown(); return; }
    _liveTimer = setTimeout(performTextSearch, 220);
  });

  // ????? ??? ????? ??? Enter
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); clearTimeout(_liveTimer); performTextSearch(); }
    if (e.key === "Escape") { clearDropdown(); searchInput.value = ''; }
  });
  } // end if searchInput

  // ????? ??????? ??? ????? ???? ??????
  document.addEventListener("click", function(e) {
    const target = e.target;
    const inSearch = searchInput && searchInput.contains(target);
    const inDropdown = dropdownBox && dropdownBox.contains(target);
    const inResults = resultsBox && resultsBox.contains(target);
    if (!inSearch && !inDropdown && !inResults) {
      clearDropdown();
    }
  });

  // ===== ??? ??????? =====
  function getDominantHue(imgSrc) {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 16, 16);
        const d = ctx.getImageData(0, 0, 16, 16).data;
        let r=0,g=0,b=0,count=0;
        for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];count++;}
        resolve({r:r/count,g:g/count,b:b/count});
      };
      img.onerror = () => resolve(null);
      img.src = imgSrc;
    });
  }

  function colorDiff(a, b) {
    if (!a || !b) return 999;
    return Math.sqrt((a.r-b.r)**2+(a.g-b.g)**2+(a.b-b.b)**2);
  }

  imageInput.addEventListener("change", async function () {
    if (!imageInput.files.length) return;
    const file = imageInput.files[0];

    resultsBox.innerHTML = `<div style="background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.10);padding:14px;margin-top:4px;text-align:center;color:#555;font-size:.84rem;">
      ?? ???? ????? ???????�<br><small style="color:#aaa">??? ????? ??????? ????? ?? ???? ????????</small>
    </div>`;

    // ????? ?????? ????????
    const uploadedSrc = await new Promise(res => {
      const fr = new FileReader();
      fr.onload = e => res(e.target.result);
      fr.readAsDataURL(file);
    });
    const uploadedColor = await getDominantHue(uploadedSrc);

    const products = await getProducts();
    // ????? ??? ??? 30 ???? ??????
    const pool = products.slice(0, 30);
    const scored = await Promise.all(pool.map(async p => {
      const imgSrc = (Array.isArray(p.img) ? p.img[0] : p.img) || '';
      const col = await getDominantHue(imgSrc);
      return { p, diff: colorDiff(uploadedColor, col) };
    }));
    scored.sort((a,b) => a.diff - b.diff);
    const top = scored.slice(0,6);

    const wrap = document.createElement('div');
    wrap.style.cssText='background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.10);padding:10px;margin-top:4px;';
    const title = document.createElement('div');
    title.style.cssText='font-size:.75rem;font-weight:700;color:#888;padding:4px 6px 8px;';
    title.textContent='?? ???? ???????? ??????';
    wrap.appendChild(title);

    top.forEach(({p}) => {
      const name = typeof p.name==='object'?(p.name.ar||p.name.en):(p.name||'????');
      const img  = (Array.isArray(p.img)?p.img[0]:p.img)||'assets/logo.png';
      const link = p.id?`product.html?id=${encodeURIComponent(p.id)}`:'#';
      const a = document.createElement('a');
      a.href = link;
      a.style.cssText='display:flex;align-items:center;gap:10px;padding:7px 6px;border-radius:8px;text-decoration:none;color:inherit;';
      a.onmouseenter=()=>a.style.background='#f7f8fc';
      a.onmouseleave=()=>a.style.background='';
      a.innerHTML=`<img src="${img}" alt="" style="width:38px;height:38px;object-fit:cover;border-radius:7px;flex-shrink:0;background:#f0f0f0" onerror="this.src='assets/logo.png'"><span style="font-size:.84rem;font-weight:600;color:#111;flex:1">${name}</span><span style="font-size:.78rem;font-weight:700;color:#152546;white-space:nowrap">${p.price?p.price+' ?.?':''}</span>`;
      wrap.appendChild(a);
    });

    const cb=document.createElement('div');
    cb.style.cssText='text-align:center;padding-top:8px;';
    cb.innerHTML=`<button onclick="window._clearSearch&&window._clearSearch()" style="border:none;background:none;color:#aaa;font-size:.74rem;cursor:pointer">????? ?</button>`;
    wrap.appendChild(cb);
    if (dropdownBox) {
      dropdownBox.innerHTML = '';
      dropdownBox.appendChild(wrap);
      dropdownBox.style.display = 'block';
    } else if (resultsBox) {
      resultsBox.innerHTML='';
      resultsBox.appendChild(wrap);
    }
    imageInput.value='';
  });
});


// ...existing code...
// ???? ???? ?????? ???? ??? ????? ??????/main  (????: ???? ?????? ??? ?????? ????? ???????? ??? ????? ???????)
document.addEventListener("DOMContentLoaded", function () {
  const header = document.querySelector('.main-header');
  const categoriesBar = document.querySelector('.categories');
  const mainEl = document.querySelector('main');
  if (header) {
    header.style.position = 'fixed';
    header.style.top = '0';
    header.style.left = '0';
    header.style.right = '0';
    header.style.width = '100vw';
    header.style.zIndex = '99999';
  }
  if (!categoriesBar || !mainEl) return;

  // ???? ?????? ?? ?????? ??????? ?? ??????? (??? ???? ????)
  categoriesBar.style.position = 'static';
  categoriesBar.style.transform = 'translateY(0)';
  categoriesBar.style.transition = 'transform 0.28s ease, opacity 0.28s ease';
  categoriesBar.style.opacity = '1';

  // helpers
  function setFixedStyles() {
    const headerH = header ? header.offsetHeight : 0;
    const mainRect = mainEl.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    categoriesBar.style.position = 'fixed';
    categoriesBar.style.top = headerH + 'px';
    categoriesBar.style.zIndex = '99997';
    categoriesBar.style.background = '#ffffff';
    if (isMobile) {
      categoriesBar.style.left = '0';
      categoriesBar.style.width = '100%';
    } else {
      categoriesBar.style.width = getComputedStyle(mainEl).width;
      categoriesBar.style.left = (mainRect.left + window.scrollX) + 'px';
    }
  }
  function unsetFixedStyles() {
    categoriesBar.style.position = 'static';
    categoriesBar.style.left = '';
    categoriesBar.style.width = '';
    categoriesBar.style.top = '';
    categoriesBar.style.zIndex = '';
  }

  // ???? ?????? � ????? ???? ??? ????? ???? ?? ?????? (?? ?????? ????? ??????)
  let barTopOffset = categoriesBar.getBoundingClientRect().top + window.pageYOffset;
  function updateBarTopOffset() {
    barTopOffset = categoriesBar.getBoundingClientRect().top + window.pageYOffset;
  }
  // ??? ??????? ??????? ??? ??????? (??? ?????? ?????? ??? ???? ????? ????? ????)
  if (mainEl) {
    const headerH = header ? header.offsetHeight : 0;
    mainEl.style.marginTop = (headerH) + 'px';
  }

  // ???? ???????? ??? ????? ???????? ????? ?????? ?????? ????? ?????? barTopOffset
  let lastScroll = window.pageYOffset || document.documentElement.scrollTop;
  let isFixed = false;
  let isVisible = true;

  function onScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    // ?? ??????? ???? ???????
    if (scrollTop + (header ? header.offsetHeight : 0) >= barTopOffset) {
      if (!isFixed) {
        isFixed = true;
        setFixedStyles();
      }
      // ?????/????? ??? ???????
      if (scrollTop > lastScroll) {
        // ????? ????? -> ??????
        if (isVisible) {
          categoriesBar.style.transform = 'translateY(-100%)';
          categoriesBar.style.opacity = '0';
          isVisible = false;
        }
      } else {
        // ????? ????? -> ????
        if (!isVisible) {
          categoriesBar.style.transform = 'translateY(0)';
          categoriesBar.style.opacity = '1';
          isVisible = true;
        }
      }
    } else {
      // ??? ?????? ?????: ???? ?????? ??????? ??????
      if (isFixed) {
        isFixed = false;
        unsetFixedStyles();
        categoriesBar.style.transform = 'translateY(0)';
        categoriesBar.style.opacity = '1';
        isVisible = true;
        // ????? ???? ???? ??? ????? ??????? ?? ??? ??? layout
        updateBarTopOffset();
      }
    }
    lastScroll = scrollTop <= 0 ? 0 : scrollTop;
  }

  // ??? ????? ??? ??????? ??? ???? ????? ???????
  function onResize() {
    // ??? ????? ????? ????? ???????
    if (isFixed) setFixedStyles();
    // ????? ???? ???? ?????? ?? ?????? ??????? (????? ?????? ?????? ??? ????? ??? fixed)
    // ????? ???? ????? ???? ?????? ????? ?????? ????? ?????? ?? ?????? ?? ???
    if (!isFixed) updateBarTopOffset();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  // ????? ???? ??? ????? ???? ??????? ???????? ???????
  setTimeout(() => {
    updateBarTopOffset();
    onResize();
    onScroll();
  }, 120);
});

// ????? ??????? ???????? ??????? ???????? ?? ??? ?????? ??? ?????? ??????
document.addEventListener("DOMContentLoaded", () => {
  const dropdowns = document.querySelectorAll(".dropdown-content");
  const isMobileNow = () => window.matchMedia('(max-width: 992px)').matches || 'ontouchstart' in window;
  const isRTL = document.documentElement.dir === 'rtl';

  function showDropdown(dropdown) {
    dropdown.classList.add('show');
    dropdown.style.display = "block";
    requestAnimationFrame(() => {
      dropdown.style.opacity = "1";
      dropdown.style.transform = isMobileNow()
        ? 'translateX(0)'
        : 'translateY(0) scale(1)';
    });
  }

  function hideDropdown(dropdown) {
    dropdown.classList.remove('show');
    dropdown.style.opacity = "0";
    dropdown.style.transform = isMobileNow()
      ? (isRTL ? 'translateX(-100%)' : 'translateX(100%)')
      : 'translateY(15px) scale(0.98)';
    setTimeout(() => {
      if (!dropdown.classList.contains('show')) dropdown.style.display = "none";
    }, 120);
  }

  function closeAllDropdowns(exceptDropdown) {
    dropdowns.forEach(d => { if (d !== exceptDropdown) hideDropdown(d); });
  }
  
  dropdowns.forEach(dropdown => {
    // ????? ????? ???? ??????? ????????
    dropdown.style.transition = "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    dropdown.style.transform = isMobileNow()
      ? (isRTL ? 'translateX(-100%)' : 'translateX(100%)')
      : 'translateY(15px) scale(0.98)';
    dropdown.style.opacity = "0";
    dropdown.style.display = "none";
    
    // ???? ?? ??? ??????? ???? ???? ???? ?????? ??????
    if (isMobileNow()) {
      dropdown.style.position = "fixed";
      dropdown.style.top = "0";
      dropdown.style.bottom = "0";
      dropdown.style.width = "min(82vw, 320px)";
      dropdown.style.minWidth = "0";
      dropdown.style.maxWidth = "320px";
      dropdown.style.zIndex = "2000";
      dropdown.style.left = isRTL ? "0" : "auto";
      dropdown.style.right = isRTL ? "auto" : "0";
    } else {
      dropdown.style.position = "absolute";
      dropdown.style.top = "130%"; // ?????? ??? ??????
      dropdown.style.left = "0"; // ?????? ?? ?????? ?????? (???? ?????? ???? ???????)
      dropdown.style.zIndex = "1000"; // ???? ?????? ??? ??????? ??????
      dropdown.style.width = "max-content"; // ??? ????? ???????
      dropdown.style.minWidth = "100%"; // ?? ??? ?? ??? ?????? ??????
      
      // ????? ?????? ??????? ??? ????? ?????
      if (document.documentElement.dir === "rtl") {
        dropdown.style.left = "auto";
        dropdown.style.right = "0";
      }
    }
    
    const parent = dropdown.closest(".dropdown");
    if (parent) {
      // ???? ?? ?? ?????? ?????? ?? position: relative
      parent.style.position = "relative";
    }
    
    const trigger = parent ? parent.querySelector(".dropbtn") : null;
    
    if (trigger) {
      // ????? ???? ??? ????? ???????
      let hideTimer;
      let isMouseOverDropdown = false;
      
      trigger.addEventListener("mouseenter", () => {
        if (isMobileNow()) return;
        clearTimeout(hideTimer);
        showDropdown(dropdown);
      });

      // ??? ??????: ???/????? ??????? (tap) ??? hover.
      trigger.addEventListener('click', (e) => {
        if (!isMobileNow()) return;
        e.preventDefault();
        e.stopPropagation();
        const opened = dropdown.classList.contains('show') || dropdown.style.display === 'block';
        closeAllDropdowns(dropdown);
        if (!opened) showDropdown(dropdown);
        else hideDropdown(dropdown);
      });
      
      dropdown.addEventListener("mouseenter", () => {
        if (isMobileNow()) return;
        clearTimeout(hideTimer);
        isMouseOverDropdown = true;
      });
      
      dropdown.addEventListener("mouseleave", () => {
        if (isMobileNow()) return;
        isMouseOverDropdown = false;
        hideTimer = setTimeout(() => {
          if (!isMouseOverDropdown) {
            hideDropdown(dropdown);
          }
        }, 100); // ????? ??? ??????? ??? ??? 800 ???? ?????
      });
      
      parent.addEventListener("mouseleave", () => {
        if (isMobileNow()) return;
        hideTimer = setTimeout(() => {
          if (!isMouseOverDropdown) {
            hideDropdown(dropdown);
          }
        }, 100); // ????? ??? ??????? ??? ??? 800 ???? ?????
      });
    }
  });

  // ????? ??????? ??? ????? ?????? ?? ??????.
  document.addEventListener('click', (e) => {
    if (!isMobileNow()) return;
    if (!e.target.closest('.dropdown')) closeAllDropdowns();
  });
});



// ????? ?? ?????? ?????? ?? ??? ???? ?????? ?????? ?? ??????
document.addEventListener("DOMContentLoaded", () => {
  // ????? ?? ?????? ??????
  const scrollBtn = document.createElement('button');
  scrollBtn.id = 'scroll-btn';
  
  // ??????? ??? ????? ????
  scrollBtn.innerHTML = '&#x2191;'; // ??? ????? Unicode
  
  scrollBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(21, 37, 70, 1), rgb(21, 37, 70));
    color: white;
    border: none;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    cursor: pointer;
    opacity: 0;
    transform: scale(0.8) translateY(20px);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px; /* ????? ??? ???? ????? */
    font-weight: bold;
  `;
  document.body.appendChild(scrollBtn);
  
  // ????? ???? ??? ??????? ???????? ???????? media query
  const mobileStyle = document.createElement('style');
  mobileStyle.textContent = `
    @media (max-width: 768px) {
      #scroll-btn {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(mobileStyle);
  
  // ????? ????? ???? ?? ???????? ???????
  const isRTL = document.documentElement.dir === 'rtl';
  if (isRTL) {
    scrollBtn.style.right = 'auto';
    scrollBtn.style.left = '20px';
  }
  
  // ?????/????? ???? ??? ??????? (???? ????? ?????)
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // ????? ???? ??? ??? ??????? ?????? ?????
    if (scrollTop > 300) {
      scrollBtn.style.opacity = '1';
      scrollBtn.style.transform = 'scale(1) translateY(0)';
    } else {
      scrollBtn.style.opacity = '0';
      scrollBtn.style.transform = 'scale(0.8) translateY(20px)';
    }
  });
  
  // ???? ??? ?????? ??? ?????
  scrollBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
  
  // ????? ??? ????? ?????? ??? ????
  scrollBtn.addEventListener('mouseenter', () => {
    scrollBtn.style.transform = 'scale(1.1) translateY(-5px)';
    scrollBtn.style.boxShadow = '0 5px 15px rgba(0,123,255,0.4)';
  });
  
  scrollBtn.addEventListener('mouseleave', () => {
    scrollBtn.style.transform = 'scale(1) translateY(0)';
    scrollBtn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  });
});

// ??? ????? ????? ??????   ?????? - ????? ?????? ?? ?? ??? ???
(function() {
  function setupSubcategories(subcategoriesDisplay) {
    if (!subcategoriesDisplay || subcategoriesDisplay._subSetup) return;
    subcategoriesDisplay._subSetup = true;

    const activeSubId = localStorage.getItem('activeSubcategoryId');

    function activateSubcategory(element) {
      document.querySelectorAll('#subcategories-display .subcategory-circle').forEach(el => {
        el.classList.remove('active');
      });
      element.classList.add('active');

      const subcatId = element.getAttribute('data-id') ||
                        element.querySelector('.subcategory-label')?.textContent.trim();
      if (subcatId) {
        localStorage.setItem('activeSubcategoryId', subcatId);
      }
    }

    subcategoriesDisplay.addEventListener('click', function(e) {
      const subcatElement = e.target.closest('.subcategory-circle');
      if (subcatElement) activateSubcategory(subcatElement);
    });

    if (activeSubId) {
      const subcategories = subcategoriesDisplay.querySelectorAll('.subcategory-circle');
      for (const subcategory of subcategories) {
        const subcatId = subcategory.getAttribute('data-id') ||
                         subcategory.querySelector('.subcategory-label')?.textContent.trim();
        if (subcatId === activeSubId) {
          activateSubcategory(subcategory);
          break;
        }
      }
    }
  }

  // ?????? ?????
  const immediateContainer = document.getElementById('subcategories-display');
  if (immediateContainer) {
    setupSubcategories(immediateContainer);
    return;
  }

  // ????? ?????? ??????? ??? ?????? ??????
  const mo = new MutationObserver((records, observer) => {
    const found = document.getElementById('subcategories-display');
    if (found) {
      setupSubcategories(found);
      observer.disconnect();
    }
  });
  mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
})();


// ??? ????? ????? ?????? ??????? ????? ?????? - ????? ?????? ?? ?? ??? ???
document.addEventListener("DOMContentLoaded", function() {
  // ????? ???? ????? ??????
  const filterToggles = document.querySelectorAll('.filter-toggle');
  
  // ????? ????? ????? ??? ??
  filterToggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
      // ???? ??? ??? ??? ??? ???? ?? ?????? ???? ???? active ?????
      const isActive = this.classList.contains('active');
      
      // ????? ???? active ?? ???? ???????
      filterToggles.forEach(btn => {
        btn.classList.remove('active');
      });
      
      // ??? ?? ??? ????? ?? ???? ??? ???? active
      if (!isActive) {
        this.classList.add('active');
      }
    });
  });
});


// ??? ????? ????? ?????? ?????? ????????
(function() {
  // ????? ????? ??????? ???????
  document.addEventListener('DOMContentLoaded', function() {
    // ??????? ???? ?????
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    let isRefreshing = false;
    const pullThreshold = 70;
    
    // ????? ???? ????? ??????? (???? ??)
    const refreshIndicator = document.createElement('div');
    refreshIndicator.className = 'pull-refresh-indicator';
    refreshIndicator.innerHTML = `
      <div class="refresh-spinner"></div>
    `;
    
    // ????? ????????? CSS
    const styles = document.createElement('style');
    styles.textContent = `
      .pull-refresh-indicator {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background-color: #ffffff;
        height: 70px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: translateY(-100%);
        transition: transform 0.25s ease;
        z-index: 99999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        pointer-events: none;
      }
      
      .refresh-spinner {
        width: 28px;
        height: 28px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3498db;
        border-radius: 50%;
      }
      
      .refresh-spinner.rotating {
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    
    // ????? ????????? ??????? ?????? ?????? ????
    document.head.appendChild(styles);
    if (document.body) {
      document.body.insertBefore(refreshIndicator, document.body.firstChild);
    } else {
      window.addEventListener('load', function() {
        document.body.insertBefore(refreshIndicator, document.body.firstChild);
      });
    }
    
    // ????? ????? ?????
    document.addEventListener('touchstart', function(e) {
      if (window.scrollY <= 5 && !isRefreshing) {
        startY = e.touches[0].clientY;
        currentY = startY;
        isPulling = true;
      }
    }, { passive: true });
    
    document.addEventListener('touchmove', function(e) {
      if (!isPulling || isRefreshing) return;
      currentY = e.touches[0].clientY;
      const pullDistance = currentY - startY;
      if (pullDistance > 5) {
        // ??? ?????? ????????? ??? ??? ??? ????? ?????? ??????? (???? ????? [Intervention])
        if (e.cancelable) e.preventDefault();
        const resistance = 0.4;
        const movement = Math.min(pullThreshold * 1.5, pullDistance * resistance);
        refreshIndicator.style.transform = `translateY(${movement}px)`;
      }
    }, { passive: false });
    
    document.addEventListener('touchend', function() {
      if (!isPulling || isRefreshing) return;
      isPulling = false;
      const pullDistance = currentY - startY;
      const movement = pullDistance * 0.4;
      if (movement > pullThreshold) {
        doRefresh();
      } else {
        refreshIndicator.style.transform = 'translateY(-100%)';
      }
    }, { passive: true });
    
    // ????? ????? ??????? (????? ??? ?????? ??? ???? ??)
    function doRefresh() {
      isRefreshing = true;
      const refreshSpinner = refreshIndicator.querySelector('.refresh-spinner');
      if (refreshSpinner) refreshSpinner.classList.add('rotating');
      refreshIndicator.style.transform = 'translateY(0)';
      
      // ?????? ??? ??????? ?????? ??????? ???????? ??? ??????
      setTimeout(function() {
        // ???? ????? ????? ?? ????? ????? ???????? ???
        try { shuffleProducts(); } catch(e){}
        
        // ??? ??????? ?????? ?????? ??? ?????? ???????
        if (refreshSpinner) refreshSpinner.classList.remove('rotating');
        setTimeout(function() {
          refreshIndicator.style.transform = 'translateY(-100%)';
          setTimeout(function() { isRefreshing = false; }, 300);
        }, 600);
      }, 900);
    }
    
    // ????? ????? ????? ???????? (??? ????)
    function shuffleProducts() {
      try {
        const productsContainer = 
          document.querySelector('.products-grid') || 
          document.querySelector('.products-row') || 
          document.querySelector('.products-container') ||
          document.querySelector('.product-list') ||
          document.querySelector('[data-products]');
        
        if (!productsContainer || !productsContainer.children || productsContainer.children.length === 0) return;
        
        productsContainer.style.transition = 'opacity 0.25s';
        productsContainer.style.opacity = '0.6';
        
        setTimeout(function() {
          const products = Array.from(productsContainer.children);
          for (let i = products.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [products[i], products[j]] = [products[j], products[i]];
          }
          const fragment = document.createDocumentFragment();
          products.forEach((product, index) => {
            const cloned = product.cloneNode(true);
            cloned.style.opacity = '0';
            cloned.style.transform = 'translateY(10px)';
            cloned.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            fragment.appendChild(cloned);
            setTimeout(() => { cloned.style.opacity = '1'; cloned.style.transform = 'translateY(0)'; }, index * 20);
          });
          while (productsContainer.firstChild) productsContainer.removeChild(productsContainer.firstChild);
          productsContainer.appendChild(fragment);
          setTimeout(() => { productsContainer.style.opacity = '1'; }, 60);
        }, 220);
      } catch (error) {
        console.error('??? ??? ????? ????? ????? ????????:', error);
      }
    }
  });
})();


// ?????: ????? ?????? ?????? ?????? /categories/* ??? categories.html?category=slug
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('click', function(e) {
      try {
        const el = e.target.closest && (
          e.target.closest('a') ||
          e.target.closest('[data-href]') ||
          e.target.closest('[data-url]') ||
          e.target.closest('[role="link"]')
        );
        if (!el) return;

        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        if (el.hasAttribute('data-no-force')) return;
        const forceAlways = el.hasAttribute('data-force');

        const isAnchor = el.tagName && el.tagName.toLowerCase() === 'a';
        let hrefAttr = isAnchor ? el.getAttribute('href') : (el.getAttribute('data-href') || el.getAttribute('data-url') || el.dataset.href || el.dataset.url);
        if (!hrefAttr) return;
        if (hrefAttr.startsWith('#')) return;
        if (isAnchor && el.target === '_blank') return;

        // ???? ??? URL ?????
        let linkUrl;
        try {
          linkUrl = new URL(hrefAttr, location.href);
        } catch (err) {
          return;
        }

        // ????? ???: /categories/women  => /categories.html?category=women
        const pathname = linkUrl.pathname.replace(/\/+$/, ''); // ???? ???? ?????
        if (pathname === '/categories' || pathname.startsWith('/categories/')) {
          // ??? ??? ?????? ?????? ???? ??? categories.html ?? query ??? ??????
          if (!/\/categories\.html$/i.test(pathname)) {
            const parts = pathname.split('/').filter(Boolean); // ["categories","women"]
            const slug = (parts[1]) ? parts[1] : '';
            const newUrl = new URL('/categories.html', location.origin);
            if (slug) newUrl.searchParams.set('category', slug);
            // ????? ?? hash ?? ????
            if (linkUrl.hash) newUrl.hash = linkUrl.hash;
            linkUrl = newUrl;
            hrefAttr = linkUrl.href;
          }
        }

        // ???? ??? ?????
        if (linkUrl.origin !== location.origin) return;

        const targetHref = linkUrl.href;
        const beforeHref = location.href;
        const beforeTitle = document.title;
        const beforeBodyLen = document.body ? document.body.innerHTML.length : 0;

        setTimeout(function() {
          try {
            const current = location.href;

            if (forceAlways) {
              if (current !== targetHref) {
                window.location.assign(targetHref);
                return;
              }
              const afterTitle = document.title;
              const afterLen = document.body ? document.body.innerHTML.length : 0;
              if (afterTitle === beforeTitle && Math.abs(afterLen - beforeBodyLen) < 50) {
                window.location.assign(targetHref);
              }
              return;
            }

            if (current !== targetHref) {
              window.location.assign(targetHref);
              return;
            }

            const afterTitle = document.title;
            const afterLen = document.body ? document.body.innerHTML.length : 0;
            if (current === targetHref && afterTitle === beforeTitle && Math.abs(afterLen - beforeBodyLen) < 50) {
              window.location.assign(targetHref);
            }
          } catch (err2) {
            console.error('link-forcer timeout error', err2);
          }
        }, 200);
      } catch (err) {
        console.error('link-forcer error', err);
      }
    }, true);
  });
})();




// ????? ???? ?????? ??????? ???????? ???????? ?? ??????

(function(){
  const intervalTime = 4500;
  let timer;
  const banner = document.querySelector('.promo-banner');
  if(!banner) return;
  const slides = banner.querySelectorAll('.banner-slide');
  const dots = banner.querySelectorAll('.dot');
  let idx = 0;
  function show(i){
    slides.forEach(s=> s.classList.toggle('active', +s.dataset.index===i));
    dots.forEach(d=> d.classList.toggle('active', +d.dataset.to===i));
    idx = i;
  }
  function next(){
    show((idx+1) % slides.length);
  }
  function start(){
    stop();
    timer = setInterval(next, intervalTime);
  }
  function stop(){ if(timer) clearInterval(timer); }
  // dots click
  dots.forEach(d => d.addEventListener('click', e => { show(+d.dataset.to); start(); }));
  // pause on hover
  banner.addEventListener('mouseenter', stop);
  banner.addEventListener('mouseleave', start);
  // init
  show(0);
  start();
})();

/* ============================================================
   ???? ????? - ???? ??? ???? ???????
   ============================================================ */
(function() {
  function updateCartBadge() {
    try {
      const raw = localStorage.getItem('x2_cart');
      const count = raw ? JSON.parse(raw).reduce((s, it) => s + (Number(it.qty) || 1), 0) : 0;

      // ???? ?????????
      document.querySelectorAll('#checkout-count, .cart-count').forEach(function(el) {
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
      });

      // ?????? ??? ??? - window.__cartCount ????? ?? main-navbar.js
      window.__cartCount = count;

      // ????? .cart-badge ??????? ?? ??? ????? ??? ??????
      document.querySelectorAll('.cart-badge').forEach(function(el) {
        el.setAttribute('data-count', count > 0 ? String(count) : '');
      });
    } catch(e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCartBadge);
  } else {
    updateCartBadge();
  }

  window.addEventListener('cart:updated', updateCartBadge);
  window.addEventListener('mobile-nav:ready', updateCartBadge);
  window.addEventListener('storage', function(e) {
    if (e.key === 'x2_cart') updateCartBadge();
  });

  window.updateCartBadge = updateCartBadge;
})();

/* ============================================================
   ???? ?????? - ???? ??? ???? ???????
   ============================================================ */
(function() {
  const PROFILE_KEY = 'x2_profile';
  const LOGGED_KEY  = 'x2_logged';

  function isLoggedIn() {
    return localStorage.getItem(LOGGED_KEY) === '1';
  }

  function getProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch(e) { return {}; }
  }

  function logout() {
    localStorage.removeItem(LOGGED_KEY);
    localStorage.removeItem(PROFILE_KEY);
    window.location.href = 'login.html';
  }
  window.x2Logout = logout;

  /* تحديث زر "الحساب" في الديسكتوب */
  function updateAccountNav() {
    // ابحث عن كل dropdowns التي تحتوي على زر الحساب
    document.querySelectorAll('.dropdown').forEach(function(dd) {
      const btn = dd.querySelector('.dropbtn');
      if (!btn) return;
      const btnText = btn.textContent || '';
      // تحقق من أن هذا زر الحساب (بالعربي أو الإنجليزي أو النص المشوّه)
      const isAccountBtn = btnText.includes('الحساب') || btnText.includes('Account') || btn.querySelector('[data-i18n="الحساب"]');
      if (!isAccountBtn) return;

      const menu = dd.querySelector('.dropdown-content');
      if (!menu) return;

      if (isLoggedIn()) {
        const p = getProfile();
        const name = p.name || 'المستخدم';
        const initial = name.charAt(0).toUpperCase();
        const firstName = name.split(' ')[0];
        btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px">
          <span style="width:26px;height:26px;border-radius:50%;background:#D4AF37;color:#152546;font-size:13px;font-weight:800;display:inline-flex;align-items:center;justify-content:center">${initial}</span>
          <span style="font-size:14px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${firstName}</span>
        </span>`;
        menu.innerHTML = `
          <div class="account-drawer-head">
            <div class="account-drawer-avatar">${initial}</div>
            <div class="account-drawer-meta">
              <strong>${name}</strong>
              <span>مرحباً بك</span>
            </div>
          </div>
          <a href="account.html">👤 حسابي</a>
          <a href="account.html">📦 طلباتي</a>
          <a href="checkout.html">🛒 إتمام طلب</a>
          <a href="#" onclick="if(window.x2Auth&&window.x2Auth.logout)window.x2Auth.logout();else{localStorage.removeItem('x2_logged');localStorage.removeItem('x2_profile');window.location.href='login.html?logout=1';}return false;" style="color:#e53935">🚪 تسجيل الخروج</a>`;
      } else {
        btn.innerHTML = `🗣 <span>الحساب</span>`;
        menu.innerHTML = `
          <div class="account-drawer-head">
            <div class="account-drawer-avatar">👤</div>
            <div class="account-drawer-meta">
              <strong>زائر</strong>
              <span>سجّل دخولك للوصول لحسابك</span>
            </div>
          </div>
          <a href="login.html">🔐 تسجيل الدخول</a>
          <a href="login.html?tab=register">✨ إنشاء حساب</a>`;
      }
    });

    /* منع الوصول لـ account.html من الموبايل بدون تسجيل دخول */
    document.querySelectorAll('a[href*="account.html"], a[href*="account"]').forEach(function(a) {
      if (a.closest('.mobile-nav') || a.closest('.acc-nav-item')) {
        if (!isLoggedIn()) {
          a.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'login.html';
          }, { once: true });
        }
      }
    });
  }

  /* ????? ????? ???? account.html ??? ?? ??? ?????? */
  if (window.location.pathname.includes('account.html') && !isLoggedIn()) {
    window.location.replace('login.html');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAccountNav);
  } else {
    updateAccountNav();
  }

  /* ????? ??? ????? ???????? ??? ??? */
  window.addEventListener('mobile-nav:ready', updateAccountNav);

  /* ????? ????? */
  window.x2Auth = { isLoggedIn, getProfile, logout };
})();

/* ============================================================
   ???? ????????? - ???? ??? ???? ???????
   ============================================================ */
(function() {
  const NOTIF_KEY = 'x2_notifications';
  const SEEN_KEY  = 'x2_notif_seen';

  function getNotifications() {
    try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch(e) { return []; }
  }
  function saveNotifications(arr) {
    try { localStorage.setItem(NOTIF_KEY, JSON.stringify(arr.slice(0, 60))); } catch(e) {}
  }
  function getUnreadCount() {
    return getNotifications().filter(function(n){ return !n.read; }).length;
  }

  function updateNotifBadge() {
    var count = getUnreadCount();
    window.__accountCount = count > 0 ? String(count) : '';
    document.querySelectorAll('.account-badge').forEach(function(el) {
      el.setAttribute('data-count', count > 0 ? String(count) : '0');
    });
    try { window.dispatchEvent(new CustomEvent('x2:notif-updated', { detail: { count: count } })); } catch(e) {}
  }

  var STATUS_LABELS = {
    pending:'??? ????????', processing:'??? ????????', confirmed:'????',
    shipped:'?? ?????', delivered:'?? ???????', cancelled:'????', returned:'?????'
  };
  var STATUS_ICONS = {
    pending:'?', processing:'??', confirmed:'?',
    shipped:'??', delivered:'??', cancelled:'?', returned:'??'
  };

  function assignStatus(order) {
    if (order.status) return order.status;
    var diff = (Date.now() - new Date(order.date).getTime()) / 3600000;
    if (diff < 24) return 'processing';
    if (diff < 72) return 'shipped';
    return 'delivered';
  }

  function makeId() {
    return 'n-' + Date.now() + '-' + Math.random().toString(36).slice(2,7);
  }

  function checkOrderNotifications() {
    var orders = [];
    try { orders = JSON.parse(localStorage.getItem('x2_orders') || '[]'); } catch(e) {}
    if (!orders.length) { updateNotifBadge(); return; }

    var seen = {};
    try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch(e) {}

    var notifs = getNotifications();
    var changed = false;

    orders.forEach(function(order) {
      var oid = order.id || '';
      var currentStatus = assignStatus(order);
      var lastStatus = seen['ord-' + oid];

      if (!lastStatus) {
        // ??? ???? � ????? ??? ???
        seen['ord-' + oid] = currentStatus;
        if (!notifs.some(function(n){ return n.orderId === oid && n.type === 'order_new'; })) {
          notifs.unshift({
            id: makeId(), type: 'order_new', icon: '??',
            title: '?? ?????? ????',
            msg: '???? ' + oid + ' ??? ???????? � ?????? ??? ?????',
            date: order.date || new Date().toISOString(),
            read: false, orderId: oid
          });
          changed = true;
        }
      } else if (lastStatus !== currentStatus) {
        // ????? ??????
        seen['ord-' + oid] = currentStatus;
        notifs.unshift({
          id: makeId(), type: 'order_update',
          icon: STATUS_ICONS[currentStatus] || '??',
          title: '????? ??? ????',
          msg: '???? ' + oid + ' � ' + (STATUS_LABELS[currentStatus] || currentStatus),
          date: new Date().toISOString(),
          read: false, orderId: oid
        });
        changed = true;
      }

      // ??? ???
      if (order.cashback && !seen['cb-' + oid]) {
        seen['cb-' + oid] = 1;
        notifs.unshift({
          id: 'n-cb-' + oid, type: 'cashback', icon: '??',
          title: '??? ??? ????!',
          msg: '???? ??? ' + order.cashback + ' ?.? ??? ??? ?? ???? ' + oid,
          date: order.date || new Date().toISOString(),
          read: false, orderId: oid
        });
        changed = true;
      }
    });

    if (changed) {
      saveNotifications(notifs);
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch(e) {}
    }
    updateNotifBadge();
  }

  // ??? ?????? ??? ?????? ??? ?????? ?????
  async function checkDiscountNotifications() {
    try {
      var orders = JSON.parse(localStorage.getItem('x2_orders') || '[]');
      if (!orders.length) return;

      var seen = {};
      try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch(e) {}

      var orderedIds = new Set();
      orders.forEach(function(o) {
        (o.items || []).forEach(function(item) {
          if (item.id) orderedIds.add(String(item.id));
        });
      });
      if (!orderedIds.size) return;

      var res = await fetch('java/Products.json');
      if (!res.ok) return;
      var products = await res.json();
      var notifs = getNotifications();
      var changed = false;

      products.forEach(function(p) {
        var pid = String(p.id || '');
        if (!orderedIds.has(pid)) return;
        var price = parseFloat(p.price) || 0;
        var oldPrice = parseFloat(p.oldPrice) || 0;
        if (oldPrice <= price || price <= 0) return;
        var discKey = 'disc-' + pid + '-' + Math.round(price);
        if (seen[discKey]) return;
        seen[discKey] = 1;
        var pname = typeof p.name === 'object' ? (p.name.ar || p.name.en || '????') : (p.name || '????');
        var pct = Math.round((oldPrice - price) / oldPrice * 100);
        notifs.unshift({
          id: 'n-disc-' + pid + '-' + Date.now(),
          type: 'discount', icon: '???',
          title: '??? ??? ???? ?????!',
          msg: pname + ' ???? ???? ' + pct + '%',
          date: new Date().toISOString(),
          read: false, productId: pid
        });
        changed = true;
      });

      if (changed) {
        saveNotifications(notifs);
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch(e) {}
        updateNotifBadge();
      }
    } catch(e) {}
  }

  function init() {
    checkOrderNotifications();
    setTimeout(checkDiscountNotifications, 5000); // ??? ????? ??? ??? ???????
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('mobile-nav:ready', updateNotifBadge);
  window.addEventListener('storage', function(e) {
    if (e.key === 'x2_orders' || e.key === 'x2_notifications') checkOrderNotifications();
  });
  window.addEventListener('x2:order-placed', checkOrderNotifications);

  window.x2Notifications = {
    getAll:       getNotifications,
    getUnread:    function(){ return getNotifications().filter(function(n){ return !n.read; }); },
    getCount:     getUnreadCount,
    markAllRead:  function(){
      var notifs = getNotifications();
      notifs.forEach(function(n){ n.read = true; });
      saveNotifications(notifs);
      updateNotifBadge();
    },
    markRead: function(id) {
      var notifs = getNotifications();
      var n = notifs.find(function(n){ return n.id === id; });
      if (n) { n.read = true; saveNotifications(notifs); updateNotifBadge(); }
    },
    add: function(notif) {
      var notifs = getNotifications();
      notifs.unshift(Object.assign({ id: makeId(), date: new Date().toISOString(), read: false }, notif));
      saveNotifications(notifs);
      updateNotifBadge();
    },
    refresh: function(){ checkOrderNotifications(); setTimeout(checkDiscountNotifications, 500); }
  };
})();

/* ============================================================
   ????? ?????? ?????? (?????????? ?? ??????)
   ============================================================ */
(function() {
  try {
    const LS_VISITORS = 'x2_visitors';
    const SESSION_KEY = 'x2_visit_logged';
    if (sessionStorage.getItem(SESSION_KEY)) return; // ???? ??? ????? ???
    sessionStorage.setItem(SESSION_KEY, '1');

    const entry = {
      date:    new Date().toISOString(),
      page:    location.pathname.split('/').pop() || 'index.html',
      city:    '', country: '', ip: ''
    };

    // ??? ??????? ????? ???? ?????? ??? IP
    const visitors = JSON.parse(localStorage.getItem(LS_VISITORS) || '[]');
    visitors.unshift(entry);
    localStorage.setItem(LS_VISITORS, JSON.stringify(visitors.slice(0, 500)));

    // ??? ?? Supabase (?????? ???? ?? ??????)
    function saveVisitorToSupabase(data) {
      if (!window.Supabase) return;
      fetch(window.SUPABASE_URL ? window.SUPABASE_URL + '/rest/v1/visitors' : 'https://knleehjjejfeobcmpwnw.supabase.co/rest/v1/visitors', {
        method: 'POST',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E',
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ page: data.page, city: data.city || '', country: data.country || '', ip: data.ip || '' })
      }).catch(function(){});
    }
    saveVisitorToSupabase(entry);

    // ?????? ?????? ??? ??????? ?????? - ???? ????? ??????
    const ipServices = [
      { url: 'https://ipapi.co/json/', parse: d => ({ city: d.city, country: d.country_name, ip: d.ip }) },
      { url: 'https://ip.seeip.org/geoip', parse: d => ({ city: d.city, country: d.country, ip: d.ip }) },
      { url: 'https://ipwho.is/', parse: d => ({ city: d.city, country: d.country, ip: d.ip }) }
    ];

    (async function tryGeoIP() {
      for (const svc of ipServices) {
        try {
          const ctrl = new AbortController();
          setTimeout(() => ctrl.abort(), 4000);
          const r = await fetch(svc.url, { signal: ctrl.signal });
          if (!r.ok) continue;
          const d = await r.json();
          const geo = svc.parse(d);
          if (geo.country || geo.city) {
            entry.city    = geo.city    || '';
            entry.country = geo.country || '';
            entry.ip      = geo.ip      || '';
            const v = JSON.parse(localStorage.getItem(LS_VISITORS) || '[]');
            if (v[0] && v[0].date === entry.date) { v[0] = entry; localStorage.setItem(LS_VISITORS, JSON.stringify(v)); }
            // ????? Supabase ???????
            saveVisitorToSupabase(entry);
            break;
          }
        } catch(e) {}
      }
    })();
  } catch(e) {}
})();

/* ============================================================
   ????? ????? ???????? ????? ?? ?????????
   ============================================================ */
(function() {
  function applySocialLinks() {
    try {
      var s = JSON.parse(localStorage.getItem('x2_settings') || '{}');
      var map = {
        'Instagram':  s.instagram,
        'Facebook':   s.facebook,
        'TikTok':     s.tiktok,
        'Snapchat':   s.snapchat,
        'YouTube':    s.youtube,
        'Twitter':    s.twitter,
        'Pinterest':  s.pinterest,
        'WhatsApp':   s.wa ? ('https://wa.me/' + String(s.wa).replace(/\D/g,'')) : null
      };
      document.querySelectorAll('.footer-social-icons a[aria-label]').forEach(function(a) {
        var label = a.getAttribute('aria-label');
        var url = map[label];
        if (url) {
          a.href = url;
          a.style.opacity = '1';
          a.style.pointerEvents = '';
        } else if (url === null || url === '') {
          a.style.opacity = '0.35';
          a.style.pointerEvents = 'none';
        }
      });
    } catch(e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySocialLinks);
  } else {
    applySocialLinks();
  }

  window.applySocialLinks = applySocialLinks;
})();
