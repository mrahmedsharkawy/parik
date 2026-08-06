(function () {
  try {
    var params = new URLSearchParams(location.search);
    var queryLang = params.get('lang');
    var storedLang = localStorage.getItem('lang');
    var lang = (queryLang === 'en' || queryLang === 'ar') ? queryLang : (storedLang === 'en' ? 'en' : 'ar');
    var returning = (function () {
      try {
        var url = new URL(location.href);
        var path = url.pathname.replace(/\/index\.html$/i, '/').replace(/\/+$/, '');
        if (!path) path = '/';
        return sessionStorage.getItem('x2_return_to_scroll_url') === path + (url.search || '');
      } catch (e) {
        return sessionStorage.getItem('x2_return_to_scroll_url') === location.href;
      }
    })();
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.classList.add('x2-categories-booting');
    if (lang === 'en' && !returning) document.documentElement.classList.add('x2-i18n-pending');
    setTimeout(function () { document.documentElement.classList.remove('x2-i18n-pending'); }, 1600);
    setTimeout(function () { document.documentElement.classList.remove('x2-categories-booting'); }, 3200);
  } catch (e) {}
})();

(function () {
  function pageKey(url) {
    try {
      var parsed = new URL(url || location.href, location.href);
      var path = parsed.pathname.replace(/\/index\.html$/i, '/').replace(/\/+$/, '');
      if (!path) path = '/';
      return path + (parsed.search || '');
    } catch (e) {
      return String(url || location.href || '');
    }
  }
  function readMap(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || '{}'); } catch (e) { return {}; }
  }
  function restoreScroll(y) {
    try {
      window.scrollTo(0, y);
      window.scrollTo({ top: y, behavior: 'auto' });
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = y;
        if (document.scrollingElement.scrollTo) document.scrollingElement.scrollTo(0, y);
      }
      document.documentElement.scrollTop = y;
      if (document.body) document.body.scrollTop = y;
    } catch (e) {}
  }
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    var key = pageKey(location.href);
    if (sessionStorage.getItem('x2_return_to_scroll_url') !== key) return;
    var productPositions = readMap('x2_product_return_positions');
    var positions = productPositions[key] ? productPositions : readMap('x2_scroll_positions');
    var y = Number(positions[key] || 0);
    if (!(y > 0)) return;
    var style = document.createElement('style');
    style.textContent = 'html.x2-restoring-scroll,html.x2-restoring-scroll body{scroll-behavior:auto!important}';
    document.head.appendChild(style);
    document.documentElement.classList.add('x2-restoring-scroll');
    function reveal() {
      restoreScroll(y);
      requestAnimationFrame(function () { restoreScroll(y); });
      setTimeout(function () {
        restoreScroll(y);
        document.documentElement.classList.remove('x2-restoring-scroll');
      }, 900);
    }
    restoreScroll(y);
    document.addEventListener('DOMContentLoaded', reveal, { once: true });
    window.addEventListener('pageshow', reveal, { once: true });
    setTimeout(reveal, 700);
  } catch (e) {}
})();

(function () {
  var params = new URLSearchParams(location.search);
  var pathParts = location.pathname.split('/').filter(Boolean).map(function (part) { return decodeURIComponent(part || ''); });
  var categoryValue = params.get('category') || pathParts[1] || '';
  if (/^Occasions$/i.test(categoryValue) || /مناسب/i.test(categoryValue)) {
    window.__bariqOccasionsPage = true;
    document.documentElement.classList.add('occasions-category-page');
  }
})();

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

document.addEventListener('DOMContentLoaded', function () {
  var searchButton = document.querySelector('[data-categories-search]');
  if (searchButton) {
    searchButton.addEventListener('click', function () {
      if (typeof window.performTextSearch === 'function') window.performTextSearch();
    });
  }
  var backButton = document.querySelector('[data-cat-back-root]');
  if (backButton) {
    backButton.addEventListener('click', function () {
      if (typeof window.showAllSubcategories === 'function') window.showAllSubcategories();
    });
  }
});
