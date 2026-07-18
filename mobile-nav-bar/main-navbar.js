// ...existing code...
document.addEventListener('DOMContentLoaded', async () => {
  if (document.querySelector('.mobile-nav')) return;

  // حساب base path اعتماداً على مكان تحميل السكربت
  const scriptEl = document.currentScript || Array.from(document.scripts).find(s => s.src && s.src.includes('main-navbar.js'));
  const scriptBase = scriptEl ? scriptEl.src.replace(/\/[^\/]*$/, '/') : './mobile-nav-bar/';
  const base = scriptBase.endsWith('/') ? scriptBase : scriptBase + '/';
  
  console.debug('Mobile nav base path:', base); // إضافة للتشخيص

  // تحميل CSS (مع تحقّق بسيط لخطأ التحميل)
  const cssHref = base + 'styles.css';
  if (!Array.from(document.styleSheets).some(s => s.href && s.href.endsWith('styles.css'))) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    link.onload = () => console.debug('mobile-nav styles loaded:', cssHref);
    link.onerror = () => console.warn('failed to load mobile-nav styles:', cssHref);
    document.head.appendChild(link);
  }

  // جلب partial وحقنه
  try {
    const res = await fetch(base + 'navbar.html', { cache: 'no-store' });
    if (!res.ok) throw new Error('navbar not found: ' + res.status);
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const nav = doc.querySelector('.mobile-nav') || doc.querySelector('nav');
    if (!nav) throw new Error('no .mobile-nav element found in navbar.html');

    // إصلاح المسارات النسبية داخل partial (مثلاً icons/foo.svg)
    nav.querySelectorAll('[src], [data-src]').forEach(el => {
      // التعامل مع src وdata-src
      ['src', 'data-src'].forEach(attr => {
        if (!el.hasAttribute(attr)) return;
        
        let src = el.getAttribute(attr) || '';
        if (!src) return;
        // لا نغيّر المسارات المطلقة أو data: أو التي تبدأ بجذر الموقع
        if (/^(https?:|\/|data:)/.test(src)) return;

        // نظّف أي بادئات زائدة مثل "./" أو "../" أو "mobile-nav-bar/"
        let clean = src.replace(/^(\.\/|\.\.\/)+/, '');
        clean = clean.replace(/^\/?mobile-nav-bar\//, '');

        // الآن نلصق base مع المسار النظيف (سيعطي base + 'icons/...' أو base + 'path/...')
        const newSrc = base + clean.replace(/^\/+/, '');
        console.debug(`Fixed ${attr} path:`, src, '=>', newSrc); // إضافة للتشخيص
        el.setAttribute(attr, newSrc);
      });
    });

    // إصلاح مسارات الصور في خاصية style
    nav.querySelectorAll('[style*="background"], [style*="url("]').forEach(el => {
      const style = el.getAttribute('style') || '';
      if (!style) return;
      
      // البحث عن مسارات URL في خاصية style
      const newStyle = style.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, url) => {
        if (/^(https?:|\/|data:)/.test(url)) return match;
        
        let clean = url.replace(/^(\.\/|\.\.\/)+/, '');
        clean = clean.replace(/^\/?mobile-nav-bar\//, '');
        const newUrl = base + clean.replace(/^\/+/, '');
        console.debug('Fixed background URL:', url, '=>', newUrl); // إضافة للتشخيص
        return `url('${newUrl}')`;
      });
      
      if (style !== newStyle) {
        el.setAttribute('style', newStyle);
      }
    });

    // إصلاح روابط href (لا نغيّر روابط التنقّل الرئيسية)
    nav.querySelectorAll('[href]').forEach(el => {
      const href = el.getAttribute('href') || '';
      if (href && !/^(https?:|\/|#)/.test(href) && !el.classList.contains('nav-link')) {
        let clean = href.replace(/^(\.\/|\.\.\/)+/, '');
        clean = clean.replace(/^\/?mobile-nav-bar\//, '');
        const newHref = base + clean.replace(/^\/+/, '');
        console.debug('Fixed href:', href, '=>', newHref); // إضافة للتشخيص
        el.setAttribute('href', newHref);
      }
    });

    // التعامل مع أيقونات SVG المضمنة مباشرة في use
    nav.querySelectorAll('use[*|href]').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.endsWith('href')) {
          const href = attr.value;
          if (href && !href.startsWith('#') && !/^(https?:|\/|data:)/.test(href)) {
            let clean = href.replace(/^(\.\/|\.\.\/)+/, '');
            clean = clean.replace(/^\/?mobile-nav-bar\//, '');
            const newHref = base + clean.replace(/^\/+/, '');
            console.debug('Fixed SVG use href:', href, '=>', newHref); // إضافة للتشخيص
            el.setAttribute(attr.name, newHref);
          }
        }
      });
    });

    document.body.appendChild(nav);

    // تفعيل الرابط النشط وتحديث عداد السلة وعداد الحساب إن وُجدا
    const path = location.pathname.split('/').pop() || 'index.html';
    nav.querySelectorAll('a').forEach(a => {
      const h = a.getAttribute('href') || '';
      if (h.endsWith(path) || (location.hash && h === location.hash)) a.classList.add('active');
    });
    
    // تحديث عداد السلة
    const cartEl = nav.querySelector('.cart-badge');
    if (cartEl) {
      const count = window.__cartCount != null ? window.__cartCount : (() => {
        try {
          const raw = localStorage.getItem('x2_cart');
          return raw ? JSON.parse(raw).reduce((s, it) => s + (Number(it.qty) || 1), 0) : 0;
        } catch(e) { return 0; }
      })();
      cartEl.setAttribute('data-count', count > 0 ? String(count) : '');
    }

    // إطلاق حدث mobile-nav:ready حتى يتمكن main.js من التحديث
    window.dispatchEvent(new CustomEvent('mobile-nav:ready'));
    
    // تحديث عداد الحساب عند التحميل
    const accountEl = nav.querySelector('.account-badge');
    if (accountEl) {
      const initCount = window.__accountCount != null ? String(window.__accountCount) : '0';
      accountEl.setAttribute('data-count', initCount);
      // تحديث العداد في الوقت الفعلي عند مسح/قراءة الإشعارات
      window.addEventListener('x2:notif-updated', function(e) {
        const c = e.detail && e.detail.count > 0 ? String(e.detail.count) : '0';
        document.querySelectorAll('.account-badge').forEach(el => el.setAttribute('data-count', c));
      });
    }
  } catch (err) {
    console.warn('mobile-nav loader error:', err);
  }
});
// ...existing code...