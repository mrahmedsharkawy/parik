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

document.addEventListener('DOMContentLoaded', function () {
  var searchButton = document.querySelector('[data-offers-search-focus]');
  if (searchButton) {
    searchButton.addEventListener('click', function () {
      var searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.focus();
    });
  }

  document.addEventListener('click', function (event) {
    var sortButton = event.target.closest('[data-sort]');
    if (!sortButton || !sortButton.classList.contains('offers-sort-btn')) return;
    if (typeof window.setSort !== 'function') return;
    event.preventDefault();
    window.setSort(sortButton.dataset.sort, sortButton);
  });
});
