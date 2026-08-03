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

(function () {
  try {
    var raw = localStorage.getItem('x2_cart');
    var items = raw ? JSON.parse(raw) : [];
    document.documentElement.classList.add(Array.isArray(items) && items.length ? 'x2-cart-has-items' : 'x2-cart-empty');
  } catch (e) {
    document.documentElement.classList.add('x2-cart-empty');
  }
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

function checkLoginBanner() {
  var banner = document.getElementById('cart-login-banner');
  if (!banner) return;
  try {
    var profile = JSON.parse(localStorage.getItem('x2_profile') || '{}');
    var loggedIn = !!(profile.phone || profile.email || profile.name);
    banner.style.display = loggedIn ? 'none' : 'block';
  } catch (e) {
    banner.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var searchButton = document.querySelector('[data-cart-search]');
  if (searchButton) {
    searchButton.addEventListener('click', function () {
      if (typeof window.performTextSearch === 'function') window.performTextSearch();
    });
  }

  var couponInput = document.getElementById('couponCodeInput');
  if (couponInput) {
    couponInput.addEventListener('focus', function () { this.style.borderColor = '#D4AF37'; });
    couponInput.addEventListener('blur', function () { this.style.borderColor = '#ddd'; });
  }

  var couponButton = document.querySelector('[data-apply-coupon]');
  if (couponButton) {
    couponButton.addEventListener('click', function () {
      if (typeof window.applyCoupon === 'function') window.applyCoupon();
    });
  }

  var creditLink = document.querySelector('[data-cart-credit-link]');
  if (creditLink) {
    creditLink.addEventListener('click', function () {
      localStorage.setItem('x2_goto_section', 'credit');
    });
  }

  checkLoginBanner();
});
