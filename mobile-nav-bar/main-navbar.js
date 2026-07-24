async function initMobileNav() {
  const isMobileViewport = window.matchMedia('(max-width: 899px)').matches || window.innerWidth <= 899 || document.documentElement.clientWidth <= 899;
  if (!isMobileViewport) return;
  if (document.querySelector('.mobile-nav')) return;

  try {
    const currentUrl = new URL(location.href);
    if (currentUrl.searchParams.has('__nav_reload')) {
      currentUrl.searchParams.delete('__nav_reload');
      history.replaceState(history.state, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
    }
  } catch(e) {}

  const scriptEl = document.currentScript || Array.from(document.scripts).find(s => s.src && /\/mobile-nav-bar\/main-navbar(?:\.min)?\.js(?:\?|$)/.test(s.src));
  const scriptBase = scriptEl ? scriptEl.src.replace(/\/[^\/]*$/, '/') : '/mobile-nav-bar/';
  const base = scriptBase.endsWith('/') ? scriptBase : scriptBase + '/';

  // ????? CSS
  const cssHref = base + 'styles.css?v=apple-liquid-20260724aa';
  if (!Array.from(document.styleSheets).some(s => s.href && s.href.includes('/mobile-nav-bar/styles.css'))) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    link.onerror = () => console.warn('mobile-nav: failed to load styles');
    document.head.appendChild(link);
  }

  try {
    // Cache navbar HTML ?? sessionStorage ????? fetch ?? ?? ???? (?????? ??????)
    const CACHE_KEY = 'mnav_v6';
    let text = sessionStorage.getItem(CACHE_KEY);
    if (!text) {
      const res = await fetch(base + 'navbar.html');
      if (!res.ok) throw new Error('navbar ' + res.status);
      text = await res.text();
      try { sessionStorage.setItem(CACHE_KEY, text); } catch(e) {}
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const nav = doc.querySelector('.mobile-nav') || doc.querySelector('nav');
    if (!nav) throw new Error('no .mobile-nav in navbar.html');

    const currentLang = localStorage.getItem('lang') || document.documentElement.lang || 'ar';
    const withLang = href => currentLang === 'en' ? href + (href.includes('?') ? '&' : '?') + 'lang=en' : href;
    const fixedLinks = { home: '/', categories: '/categories', offers: '/offers', account: '/account', cart: '/Cart' };
    nav.querySelectorAll('a[data-key]').forEach(a => {
      const key = a.getAttribute('data-key');
      if (fixedLinks[key]) a.setAttribute('href', withLang(fixedLinks[key]));
      a.addEventListener('click', () => { if (currentLang === 'en') localStorage.setItem('lang', 'en'); }, { passive: true });
    });

    if (currentLang === 'en') {
      const fallback = { '????????':'Home', '?????????':'Occasions', '????':'Deals', '?????':'My Account', '?????':'Cart' };
      try {
        const trRes = await fetch('/translations/en.json');
        const tr = trRes.ok ? await trRes.json() : fallback;
        nav.querySelectorAll('[data-i18n]').forEach(el => {
          const key = el.getAttribute('data-i18n');
          el.textContent = tr[key] || fallback[key] || el.textContent;
        });
        nav.setAttribute('aria-label', tr['?????? ???? ??????'] || 'Bottom navigation');
        nav.querySelectorAll('[aria-label]').forEach(el => {
          const key = el.getAttribute('aria-label');
          if (tr[key]) el.setAttribute('aria-label', tr[key]);
        });
      } catch(e) {
        nav.querySelectorAll('[data-i18n]').forEach(el => {
          const key = el.getAttribute('data-i18n');
          if (fallback[key]) el.textContent = fallback[key];
        });
        nav.setAttribute('aria-label', 'Bottom navigation');
      }
    }

    // ????? ???????? ??????? (src / data-src)
    nav.querySelectorAll('[src],[data-src]').forEach(el => {
      ['src','data-src'].forEach(attr => {
        if (!el.hasAttribute(attr)) return;
        let src = el.getAttribute(attr) || '';
        if (!src || /^(https?:|\/|data:)/.test(src)) return;
        let clean = src.replace(/^(\.\/|\.\.\/)+/,'').replace(/^\/?mobile-nav-bar\//,'');
        el.setAttribute(attr, base + clean.replace(/^\/+/,''));
      });
    });

    // ????? ?????? background url()
    nav.querySelectorAll('[style*="url("]').forEach(el => {
      const style = el.getAttribute('style') || '';
      const fixed = style.replace(/url\(['"]?([^'")]+)['"]?\)/g, (m, url) => {
        if (/^(https?:|\/|data:)/.test(url)) return m;
        let clean = url.replace(/^(\.\/|\.\.\/)+/,'').replace(/^\/?mobile-nav-bar\//,'');
        return `url('${base + clean.replace(/^\/+/,'')}')`;
      });
      if (fixed !== style) el.setAttribute('style', fixed);
    });

    // ????? SVG use href
    nav.querySelectorAll('use').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (!attr.name.endsWith('href')) return;
        const href = attr.value;
        if (href && !href.startsWith('#') && !/^(https?:|\/|data:)/.test(href)) {
          let clean = href.replace(/^(\.\/|\.\.\/)+/,'').replace(/^\/?mobile-nav-bar\//,'');
          el.setAttribute(attr.name, base + clean.replace(/^\/+/,''));
        }
      });
    });

    document.body.appendChild(nav);

    // -- ????? ?????? ??? ????? ????? ??????? ??? ????? ????? -----
    let lastY = window.scrollY || window.pageYOffset || 0;
    let compact = false;
    const DELTA = 7;
    const TOP_RESET = 18;

    const setCompact = (next) => {
      if (compact === next) return;
      compact = next;
      if (compact) nav.classList.add('is-compact');
      else nav.classList.remove('is-compact');
    };

    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      if (y <= TOP_RESET) {
        setCompact(false);
        lastY = y;
        return;
      }

      const diff = y - lastY;
      if (Math.abs(diff) < DELTA) return;

      if (diff > 0) setCompact(true);   // scrolling down: compact
      else setCompact(false);           // scrolling up: restore

      lastY = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });

    let rafId = 0;
    const watchScroll = () => {
      onScroll();
      rafId = window.requestAnimationFrame(watchScroll);
    };
    rafId = window.requestAnimationFrame(watchScroll);

    window.addEventListener('pagehide', () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    }, { once: true });

    onScroll();

    // -- ????? ?????? ????? ------------------------------------------
    // ???? Vercel clean URLs (/offers) ????? ????? ????? (/offers.html)
    const rawSeg = location.pathname.split('/').pop() || 'index';
    const curPage = rawSeg.replace(/\.html$/,'') || 'index';
    nav.querySelectorAll('a').forEach(a => {
      const h = (a.getAttribute('href') || '').replace(/\.html$/,'');
      const hPage = h.split('/').pop() || 'index';
      if (hPage === curPage) a.classList.add('active');
    });

    // -- ????? ????? ????? ????? ??? ???????? ?????? ----------------
    const navList = nav.querySelector('ul');
    const navLinks = Array.from(nav.querySelectorAll('a[data-key]'));
    if (navList && navLinks.length) {
      const liquidPill = document.createElement('div');
      liquidPill.className = 'nav-liquid-pill';
      liquidPill.setAttribute('aria-hidden', 'true');
      navList.insertBefore(liquidPill, navList.firstChild);

      let activeLink = nav.querySelector('a.active') || navLinks[0];
      let dragState = null;
      let suppressPillClick = false;

      const getClientX = (event) => {
        if (event.touches && event.touches[0]) return event.touches[0].clientX;
        if (event.changedTouches && event.changedTouches[0]) return event.changedTouches[0].clientX;
        return event.clientX;
      };

      const setActiveLink = (nextLink) => {
        if (!nextLink) return;
        activeLink = nextLink;
        navLinks.forEach((link) => link.classList.toggle('active', link === activeLink));
      };

      const isSamePageLink = (link) => {
        const targetUrl = new URL(link.href, location.href);
        const normalizePath = (path) => {
          const normalized = path.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '').replace(/\/$/, '') || '/';
          return normalized.toLowerCase();
        };
        return targetUrl.origin === location.origin && normalizePath(targetUrl.pathname) === normalizePath(location.pathname);
      };

      const reloadSamePage = () => {
        const url = new URL(location.href);
        url.searchParams.set('__nav_reload', String(Date.now()));
        location.assign(url.href);
      };

      const getMetrics = (link) => {
        const pillWidth = liquidPill.offsetWidth || parseFloat(getComputedStyle(liquidPill).width) || 0;
        const item = link.closest('li') || link;
        return {
          centerX: item.offsetLeft + item.offsetWidth / 2,
          width: pillWidth
        };
      };

      const movePillToLink = (link, animate = true) => {
        const metrics = getMetrics(link);
        liquidPill.style.transition = animate ? 'transform .42s cubic-bezier(.18,1.34,.34,1), border-radius .34s ease, opacity .26s ease, box-shadow .26s ease' : 'none';
        liquidPill.style.left = '0px';
        liquidPill.style.transform = `translate3d(${metrics.centerX - metrics.width / 2}px, -50%, 0)`;
      };

      nav.__updateLiquidPillPosition = (animate = false) => {
        if (dragState) return;
        movePillToLink(activeLink, animate);
      };

      const findNearestLink = (clientX) => {
        let nearest = activeLink;
        let minDist = Infinity;
        navLinks.forEach((link) => {
          const rect = link.getBoundingClientRect();
          const center = rect.left + rect.width / 2;
          const dist = Math.abs(clientX - center);
          if (dist < minDist) {
            minDist = dist;
            nearest = link;
          }
        });
        return nearest;
      };

      const clampPillX = (x) => {
        const max = Math.max(0, navList.clientWidth - liquidPill.offsetWidth);
        return Math.min(Math.max(0, x), max);
      };

      const onPointerMove = (event) => {
        if (!dragState) return;
        const clientX = getClientX(event);
        const clientY = event.touches && event.touches[0] ? event.touches[0].clientY : event.clientY;
        const dx = clientX - dragState.startX;
        const dy = clientY != null ? clientY - dragState.startY : 0;

        if (!dragState.locked) {
          if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
            endDrag(event, true);
            return;
          }
          if (Math.abs(dx) < 4) return;
          dragState.locked = true;
        }

        const nextX = clampPillX(dragState.startTranslateX + dx);
  dragState.lastX = clientX;
        liquidPill.style.transition = 'none';
        const pull = Math.min(Math.abs(dx) / 220, 0.12);
        const squeezeX = dx > 0 ? 1 - pull : 1 + pull;
        const squeezeY = 1 + pull * 0.7;
        liquidPill.style.transform = `translate3d(${nextX}px, -50%, 0) scale(${squeezeX}, ${squeezeY})`;
        dragState.moved = dragState.moved || Math.abs(dx) > 6;
        if (dragState.moved && event.cancelable) event.preventDefault();
      };

      const endDrag = (event, cancelled = false) => {
        if (!dragState) return;
        const dropX = dragState.lastX || getClientX(event) || dragState.startX;
        const nearest = cancelled ? activeLink : findNearestLink(dropX);
        liquidPill.classList.remove('is-dragging');
        setActiveLink(nearest);
        movePillToLink(nearest, true);
        const didMove = !!dragState.moved;
        dragState = null;
        if (didMove) {
          suppressPillClick = true;
          window.setTimeout(() => { suppressPillClick = false; }, 180);
        }
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', endDrag);
        document.removeEventListener('pointercancel', endDrag);
        document.removeEventListener('mousemove', onPointerMove);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onPointerMove);
        document.removeEventListener('touchend', endDrag);
        document.removeEventListener('touchcancel', endDrag);
        if (didMove && !cancelled) {
          // ??? ????? ??? ???????? ????? ??? ?????
          window.setTimeout(() => nearest.click(), 90);
        }
      };

      const startDrag = (event) => {
        const clientX = getClientX(event);
        const clientY = event.touches && event.touches[0] ? event.touches[0].clientY : event.clientY;
        const transform = liquidPill.style.transform || '';
        const match = transform.match(/translate3d\(([-\d.]+)px/);
        dragState = {
          startX: clientX,
          startY: clientY || 0,
          lastX: clientX,
          startTranslateX: match ? Number(match[1]) : 0,
          locked: false,
          moved: false
        };
        liquidPill.classList.add('is-dragging');
        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', endDrag, { passive: true });
        document.addEventListener('pointercancel', endDrag, { passive: true });
        document.addEventListener('mousemove', onPointerMove, { passive: false });
        document.addEventListener('mouseup', endDrag, { passive: true });
        document.addEventListener('touchmove', onPointerMove, { passive: false });
        document.addEventListener('touchend', endDrag, { passive: true });
        document.addEventListener('touchcancel', endDrag, { passive: true });
      };

      liquidPill.addEventListener('pointerdown', startDrag);
      liquidPill.addEventListener('touchstart', startDrag, { passive: false });
      liquidPill.addEventListener('mousedown', startDrag);
      liquidPill.addEventListener('click', (event) => {
        if (suppressPillClick) return;
        event.preventDefault();
        if (activeLink && isSamePageLink(activeLink)) reloadSamePage();
        else activeLink?.click();
      });

      navLinks.forEach((link) => {
        link.addEventListener('pointerdown', (event) => {
          if (link !== activeLink) return;
          startDrag(event);
        });
        link.addEventListener('touchstart', (event) => {
          if (link !== activeLink) return;
          startDrag(event);
        }, { passive: false });
        link.addEventListener('mousedown', (event) => {
          if (link !== activeLink) return;
          startDrag(event);
        });
        link.addEventListener('click', (event) => {
          if (isSamePageLink(link)) {
            event.preventDefault();
            reloadSamePage();
            return;
          }
          setActiveLink(link);
          movePillToLink(link, true);
        });
      });

      movePillToLink(activeLink, false);
      window.addEventListener('resize', () => movePillToLink(activeLink, false), { passive: true });
    }

    // -- ???? ????? --------------------------------------------------
    const cartEl = nav.querySelector('.cart-badge');
    if (cartEl) {
      const readCartCount = () => {
        try {
          const raw = localStorage.getItem('x2_cart');
          return raw ? JSON.parse(raw).reduce((s,it) => s + (Number(it.qty)||1), 0) : 0;
        } catch(e) { return 0; }
      };
      const updateCartBadge = () => {
        const count = window.__cartCount != null ? window.__cartCount : readCartCount();
        cartEl.setAttribute('data-count', count > 0 ? String(count) : '');
      };
      updateCartBadge();
      window.addEventListener('cart:updated', updateCartBadge);
      window.addEventListener('cart:persisted', updateCartBadge);
      window.addEventListener('storage', (event) => {
        if (event.key === 'x2_cart') updateCartBadge();
      });
    }

    window.dispatchEvent(new CustomEvent('mobile-nav:ready'));

    // -- ???? ?????? ---------------------------------------------
    const accountEl = nav.querySelector('.account-badge');
    if (accountEl) {
      const initCount = window.__accountCount != null ? String(window.__accountCount) : '0';
      accountEl.setAttribute('data-count', initCount);
      window.addEventListener('x2:notif-updated', e => {
        const c = e.detail && e.detail.count > 0 ? String(e.detail.count) : '0';
        document.querySelectorAll('.account-badge').forEach(el => el.setAttribute('data-count', c));
      });
    }
  } catch (err) {
    console.warn('mobile-nav loader error:', err);
  }
}

document.addEventListener('DOMContentLoaded', initMobileNav);
window.addEventListener('resize', initMobileNav, { passive: true });
window.addEventListener('orientationchange', initMobileNav, { passive: true });

(function initMobileNavViewportOffset() {
  function updateOffset() {
    const vv = window.visualViewport;
    const offset = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    document.documentElement.style.setProperty('--nav-browser-bottom', offset + 'px');
  }

  updateOffset();
  window.addEventListener('resize', updateOffset, { passive: true });
  window.addEventListener('orientationchange', updateOffset, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateOffset, { passive: true });
    window.visualViewport.addEventListener('scroll', updateOffset, { passive: true });
  }
  document.addEventListener('DOMContentLoaded', updateOffset, { once: true });
  window.addEventListener('load', updateOffset, { once: true });
})();

(function initMobileNavCompactWatcher() {
  let intervalId = 0;
  let lastY = window.scrollY || window.pageYOffset || 0;
  let compact = false;
  const DELTA = 7;
  const TOP_RESET = 18;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function applyCompactStyles(nav, isCompact) {
    const isSmall = window.innerWidth <= 420;
    const normalBottom = cssVar('--nav-bottom-normal') || '8px';
    const compactBottom = cssVar('--nav-bottom-compact') || '6px';
    const normal = isSmall
      ? { left: '12px', right: '12px', bottom: normalBottom, height: '55px', radius: '31px', ulPadding: '3px 7px', ulGap: '5px', itemMin: '46px', icon: '23px' }
      : { left: '16px', right: '16px', bottom: normalBottom, height: '58px', radius: '35px', ulPadding: '3px 9px', ulGap: '7px', itemMin: '46px', icon: '25px' };
    const mini = isSmall
      ? { left: '58px', right: '58px', bottom: compactBottom, height: '44px', radius: '26px', ulPadding: '1px 7px', ulGap: '4px', itemMin: '31px', icon: '21px' }
      : { left: '64px', right: '64px', bottom: compactBottom, height: '44px', radius: '26px', ulPadding: '1px 7px', ulGap: '4px', itemMin: '31px', icon: '21px' };
    const activeSet = isCompact ? mini : normal;

    nav.style.left = activeSet.left;
    nav.style.right = activeSet.right;
    nav.style.bottom = activeSet.bottom;
    nav.style.height = activeSet.height;
    nav.style.borderRadius = activeSet.radius;
    nav.style.transformOrigin = 'center bottom';
    nav.style.transform = 'translateY(0)';

    const list = nav.querySelector('ul');
    if (list) {
      list.style.padding = activeSet.ulPadding;
      list.style.gap = activeSet.ulGap;
    }

    nav.querySelectorAll('a, button').forEach((item) => {
      item.style.minHeight = activeSet.itemMin;
      item.style.borderRadius = isCompact ? '20px' : '26px';
    });

    nav.querySelectorAll('svg.icon, img.icon, img.nav-icon').forEach((icon) => {
      icon.style.width = activeSet.icon;
      icon.style.height = activeSet.icon;
    });
  }

  function updateCompact() {
    const nav = document.querySelector('.mobile-nav');
    if (!nav) return;

    const y = window.scrollY || window.pageYOffset || 0;
    let nextCompact = compact;

    if (y <= TOP_RESET) {
      nextCompact = false;
    } else {
      const diff = y - lastY;
      if (Math.abs(diff) >= DELTA) nextCompact = diff > 0;
    }

    if (nextCompact !== compact) {
      compact = nextCompact;
      if (compact) nav.classList.add('is-compact');
      else nav.classList.remove('is-compact');
    }

    applyCompactStyles(nav, compact);
    if (typeof nav.__updateLiquidPillPosition === 'function') {
      nav.__updateLiquidPillPosition(false);
      window.requestAnimationFrame(() => nav.__updateLiquidPillPosition(false));
      window.setTimeout(() => nav.__updateLiquidPillPosition(false), 60);
      window.setTimeout(() => nav.__updateLiquidPillPosition(false), 140);
      window.setTimeout(() => nav.__updateLiquidPillPosition(false), 240);
    }

    lastY = y;
  }

  function start() {
    if (intervalId) return;
    lastY = window.scrollY || window.pageYOffset || 0;
    intervalId = window.setInterval(updateCompact, 120);
    updateCompact();
  }

  document.addEventListener('DOMContentLoaded', start, { once: true });
  window.addEventListener('load', start, { once: true });
  window.addEventListener('mobile-nav:ready', start);
  window.addEventListener('pagehide', () => {
    if (!intervalId) return;
    window.clearInterval(intervalId);
    intervalId = 0;
  }, { once: true });
})();

(function initFastInternalNavigation() {
  const seen = new Set();
  const corePages = ['/', '/index.html', '/categories', '/categories.html', '/offers', '/offers.html', '/Cart', '/Cart.html', '/account', '/account.html'];

  function canPrefetch() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !conn || (!conn.saveData && !/2g/i.test(conn.effectiveType || ''));
  }

  function normalizeUrl(href) {
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return '';
      if (url.hash && url.pathname === location.pathname && url.search === location.search) return '';
      if (/\.(webp|png|jpe?g|gif|svg|pdf|zip|cdr)$/i.test(url.pathname)) return '';
      return url.pathname + url.search;
    } catch(e) {
      return '';
    }
  }

  function prefetch(href) {
    if (!canPrefetch()) return;
    const url = normalizeUrl(href);
    if (!url || seen.has(url)) return;
    seen.add(url);
    try {
      fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'force-cache', priority: 'low' }).catch(() => {});
    } catch(e) {}
  }

  function prefetchLink(event) {
    const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (link) prefetch(link.href);
  }

  document.addEventListener('pointerover', prefetchLink, { passive: true });
  document.addEventListener('touchstart', prefetchLink, { passive: true });
  window.addEventListener('load', function() {
    const run = () => corePages.forEach(prefetch);
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2500 });
    else setTimeout(run, 1200);
  }, { once: true });
})();