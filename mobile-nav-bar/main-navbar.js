async function initMobileNav() {
  const isMobileViewport = window.matchMedia('(max-width: 899px)').matches || window.innerWidth <= 899 || document.documentElement.clientWidth <= 899;
  if (!isMobileViewport) return;
  if (document.querySelector('.mobile-nav')) return;

  const scriptEl = document.currentScript || Array.from(document.scripts).find(s => s.src && /\/mobile-nav-bar\/main-navbar(?:\.min)?\.js(?:\?|$)/.test(s.src));
  const scriptBase = scriptEl ? scriptEl.src.replace(/\/[^\/]*$/, '/') : '/mobile-nav-bar/';
  const base = scriptBase.endsWith('/') ? scriptBase : scriptBase + '/';

  // تحميل CSS
  const cssHref = base + 'styles.css';
  if (!Array.from(document.styleSheets).some(s => s.href && s.href.includes('/mobile-nav-bar/styles.css'))) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    link.onerror = () => console.warn('mobile-nav: failed to load styles');
    document.head.appendChild(link);
  }

  try {
    // Cache navbar HTML في sessionStorage لتجنب fetch في كل صفحة (يُقلّل الوميض)
    const CACHE_KEY = 'mnav_v4';
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
      const fallback = { 'الرئيسية':'Home', 'المناسبات':'Occasions', 'عروض':'Deals', 'حسابي':'My Account', 'السلة':'Cart' };
      try {
        const trRes = await fetch('/translations/en.json');
        const tr = trRes.ok ? await trRes.json() : fallback;
        nav.querySelectorAll('[data-i18n]').forEach(el => {
          const key = el.getAttribute('data-i18n');
          el.textContent = tr[key] || fallback[key] || el.textContent;
        });
        nav.setAttribute('aria-label', tr['التنقل أسفل الشاشة'] || 'Bottom navigation');
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

    // إصلاح المسارات النسبية (src / data-src)
    nav.querySelectorAll('[src],[data-src]').forEach(el => {
      ['src','data-src'].forEach(attr => {
        if (!el.hasAttribute(attr)) return;
        let src = el.getAttribute(attr) || '';
        if (!src || /^(https?:|\/|data:)/.test(src)) return;
        let clean = src.replace(/^(\.\/|\.\.\/)+/,'').replace(/^\/?mobile-nav-bar\//,'');
        el.setAttribute(attr, base + clean.replace(/^\/+/,''));
      });
    });

    // إصلاح مسارات background url()
    nav.querySelectorAll('[style*="url("]').forEach(el => {
      const style = el.getAttribute('style') || '';
      const fixed = style.replace(/url\(['"]?([^'")]+)['"]?\)/g, (m, url) => {
        if (/^(https?:|\/|data:)/.test(url)) return m;
        let clean = url.replace(/^(\.\/|\.\.\/)+/,'').replace(/^\/?mobile-nav-bar\//,'');
        return `url('${base + clean.replace(/^\/+/,'')}')`;
      });
      if (fixed !== style) el.setAttribute('style', fixed);
    });

    // إصلاح SVG use href
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

    // ── تفعيل الرابط النشط ──────────────────────────────────────────
    // يدعم Vercel clean URLs (/offers) وكذلك روابط عادية (/offers.html)
    const rawSeg = location.pathname.split('/').pop() || 'index';
    const curPage = rawSeg.replace(/\.html$/,'') || 'index';
    nav.querySelectorAll('a').forEach(a => {
      const h = (a.getAttribute('href') || '').replace(/\.html$/,'');
      const hPage = h.split('/').pop() || 'index';
      if (hPage === curPage) a.classList.add('active');
    });

    // ── عداد السلة ──────────────────────────────────────────────────
    const cartEl = nav.querySelector('.cart-badge');
    if (cartEl) {
      const count = window.__cartCount != null ? window.__cartCount : (() => {
        try {
          const raw = localStorage.getItem('x2_cart');
          return raw ? JSON.parse(raw).reduce((s,it) => s + (Number(it.qty)||1), 0) : 0;
        } catch(e) { return 0; }
      })();
      cartEl.setAttribute('data-count', count > 0 ? String(count) : '');
    }

    window.dispatchEvent(new CustomEvent('mobile-nav:ready'));

    // ── عداد الحساب ─────────────────────────────────────────────────
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

(function initFastInternalNavigation() {
  const seen = new Set();
  const corePages = ['/', '/index.html', '/categories', '/categories.html', '/offers', '/offers.html', '/Cart', '/Cart.html', '/account', '/account.html', '/login', '/login.html', '/checkout', '/checkout.html', '/affiliate', '/affiliate.html', '/policy', '/policy?page=contact', '/policy?page=returns', '/policy?page=shipping-info', '/policy?page=work-with-Bariq'];

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
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1200 });
    else setTimeout(run, 700);
  }, { once: true });
})();