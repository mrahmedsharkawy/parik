(function(){
  try {
    var params = new URLSearchParams(location.search);
    var queryLang = params.get('lang');
    var storedLang = localStorage.getItem('lang');
    var lang = (queryLang === 'en' || queryLang === 'ar') ? queryLang : (storedLang === 'en' ? 'en' : 'ar');
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (lang === 'en') document.documentElement.classList.add('x2-i18n-pending');
    setTimeout(function(){ document.documentElement.classList.remove('x2-i18n-pending'); }, 1600);
  } catch(e) {}
})();

(function(w,d,s,l,i){
  w[l]=w[l]||[];
  w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
  var firstScript=d.getElementsByTagName(s)[0];
  var tag=d.createElement(s);
  var dataLayer=l!='dataLayer'?'&l='+l:'';
  tag.async=true;
  tag.src='https://www.googletagmanager.com/gtm.js?id='+i+dataLayer;
  firstScript.parentNode.insertBefore(tag,firstScript);
})(window,document,'script','dataLayer','GTM-PR8J7RM7');

(function(){
  document.documentElement.classList.add('account-auth-pending');
  function revealAccount(){
    document.documentElement.classList.remove('account-auth-pending');
  }
  window.addEventListener('pageshow', revealAccount);
  document.addEventListener('DOMContentLoaded', revealAccount, { once: true });
  setTimeout(revealAccount, 1200);
  try {
    if (localStorage.getItem('x2_logged') !== '1') {
      location.replace('login.html?next=account');
    }
  } catch(e) {
    location.replace('login.html?next=account');
  }
})();

(function(){
  var viewport=document.querySelector('meta[name="viewport"]');
  if(!viewport||!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))return;
  var base=viewport.content;
  document.addEventListener('focusin',function(e){
    if(['INPUT','SELECT','TEXTAREA'].indexOf(e.target.tagName)>=0)
      viewport.content=base.replace(/,?\s*maximum-scale=[^,]*/i,'')+', maximum-scale=1';
  });
  document.addEventListener('focusout',function(){
    setTimeout(function(){viewport.content=base;},300);
  });
})();

document.addEventListener('DOMContentLoaded', function(){
  var searchButton = document.querySelector('[data-account-search]');
  if (searchButton) {
    searchButton.addEventListener('click', function(){
      if (typeof window.performTextSearch === 'function') window.performTextSearch();
    });
  }
});

(function(){
  function isFormControl(element) {
    return element && /^(INPUT|SELECT|TEXTAREA)$/i.test(element.tagName);
  }

  function getScrollableAncestor(element) {
    for (var node = element; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      var style = getComputedStyle(node);
      var canScrollY = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2;
      if (canScrollY) return node;
    }
    return null;
  }

  document.addEventListener('wheel', function(event){
    if (!event.deltaY || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (isFormControl(event.target)) return;
    var scroller = getScrollableAncestor(event.target);
    if (scroller) {
      var canScrollInner = event.deltaY > 0
        ? scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 2
        : scroller.scrollTop > 2;
      if (canScrollInner) return;
    }

    var maxScroll = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight;
    if (maxScroll <= 0) return;
    var next = Math.max(0, Math.min(maxScroll, window.scrollY + event.deltaY));
    if (next === window.scrollY) return;
    event.preventDefault();
    window.scrollTo(0, next);
  }, { passive: false });
})();
