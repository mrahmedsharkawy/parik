(function () {
  try {
    var params = new URLSearchParams(location.search);
    var queryLang = params.get('lang');
    var storedLang = localStorage.getItem('lang');
    var lang = (queryLang === 'en' || queryLang === 'ar') ? queryLang : (storedLang === 'en' ? 'en' : 'ar');
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (lang === 'en') document.documentElement.classList.add('x2-i18n-pending');
    setTimeout(function () {
      document.documentElement.classList.remove('x2-i18n-pending');
    }, 1600);
  } catch (e) {}
})();

(function (w, d, s, l, i) {
  w[l] = w[l] || [];
  w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var firstScript = d.getElementsByTagName(s)[0];
  var tag = d.createElement(s);
  var dataLayer = l !== 'dataLayer' ? '&l=' + l : '';
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dataLayer;
  firstScript.parentNode.insertBefore(tag, firstScript);
})(window, document, 'script', 'dataLayer', 'GTM-PR8J7RM7');

(function () {
  var viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport || !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return;
  var base = viewport.content;
  document.addEventListener('focusin', function (event) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].indexOf(event.target.tagName) >= 0) {
      viewport.content = base.replace(/,?\s*maximum-scale=[^,]*/i, '') + ', maximum-scale=1';
    }
  });
  document.addEventListener('focusout', function () {
    setTimeout(function () { viewport.content = base; }, 300);
  });
})();

(function () {
  var data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: '',
    offers: { '@type': 'Offer', priceCurrency: 'AED' }
  };
  var script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'product-jsonld';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
})();

document.addEventListener('DOMContentLoaded', function () {
  var searchButton = document.querySelector('[data-product-search]');
  if (!searchButton) return;
  searchButton.addEventListener('click', function () {
    if (typeof window.performTextSearch === 'function') window.performTextSearch();
  });
});

(function () {
  function hasScrollableAncestor(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      var style = window.getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) return true;
      el = el.parentElement;
    }
    return false;
  }

  document.addEventListener('wheel', function (event) {
    if (!document.body || !document.body.classList.contains('product-page-body')) return;
    if (event.ctrlKey || event.shiftKey) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    var target = event.target && event.target.closest ? event.target : null;
    if (!target) return;
    if (target.closest('input,textarea,select,.rv-modal-bg,.mh-cats-strip,#thumbs')) return;
    if (hasScrollableAncestor(target)) return;
    var before = window.scrollY || document.documentElement.scrollTop || 0;
    window.scrollBy({ top: event.deltaY, left: 0, behavior: 'auto' });
    if ((window.scrollY || document.documentElement.scrollTop || 0) !== before) event.preventDefault();
  }, { passive: false, capture: true });
})();
