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

document.addEventListener('DOMContentLoaded', function () {
  document.addEventListener('click', function (event) {
    var mobileSearch = event.target.closest('[data-login-mobile-search]');
    if (mobileSearch) {
      var search = document.getElementById('loginMobileSearch');
      if (search) search.focus();
      return;
    }

    var tab = event.target.closest('[data-auth-tab]');
    if (tab && typeof window.switchTab === 'function') {
      window.switchTab(tab.dataset.authTab);
      return;
    }

    var toggle = event.target.closest('[data-toggle-pass]');
    if (toggle && typeof window.togglePass === 'function') {
      window.togglePass(toggle.dataset.togglePass, toggle);
      return;
    }

    if (event.target.closest('[data-show-forgot]') && typeof window.showForgot === 'function') {
      event.preventDefault();
      window.showForgot();
      return;
    }

    if (event.target.closest('[data-do-login]') && typeof window.doLogin === 'function') {
      window.doLogin();
      return;
    }

    var social = event.target.closest('[data-social-provider]');
    if (social && typeof window.socialLogin === 'function') {
      window.socialLogin(social.dataset.socialProvider, social.dataset.socialMode || 'login');
      return;
    }

    if (event.target.closest('[data-do-register]') && typeof window.doRegister === 'function') {
      window.doRegister();
      return;
    }

    if (event.target.closest('[data-go-account]')) {
      window.location.href = 'account.html';
      return;
    }

    if (event.target.closest('[data-complete-google-profile]') && typeof window.completeGoogleProfile === 'function') {
      window.completeGoogleProfile();
    }
  });

  var strengthInput = document.querySelector('[data-strength-input]');
  if (strengthInput) {
    strengthInput.addEventListener('input', function () {
      if (typeof window.checkStrength === 'function') window.checkStrength(this.value);
    });
  }
});
