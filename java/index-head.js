(function(){
  if (!window.trustedTypes || window.trustedTypes.defaultPolicy) return;
  try {
    window.trustedTypes.createPolicy('default', {
      createHTML: function(value) { return String(value); },
      createScript: function(value) { return String(value); },
      createScriptURL: function(value) { return String(value); }
    });
  } catch (e) {}
})();

(function(){try{function pageKey(url){try{var u=new URL(url||location.href,location.href);u.searchParams.delete('__nav_reload');u.searchParams.delete('__home_top');var path=u.pathname.replace(/\/index\.html$/i,'/').replace(/\/+$/,'');if(!path)path='/';return path+(u.search||'')}catch(e){return'/'}}function isHomeUrl(){try{var p=location.pathname.replace(/\/index\.html$/i,'/').replace(/\/+$/,'');return !p||p==='/'}catch(e){return false}}function navType(){try{var n=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];return n&&n.type||''}catch(e){return''}}var key=pageKey(location.href),returning=sessionStorage.getItem('x2_return_to_scroll_url')===key;if(returning)return;var params=new URLSearchParams(location.search),explicit=sessionStorage.getItem('x2_home_nav_reload_top')==='1'||params.has('__nav_reload')||params.has('__home_top'),freshHome=isHomeUrl()&&(navType()==='reload'||navType()==='navigate'||document.referrer&&new URL(document.referrer,location.href).origin===location.origin);if(!explicit&&!freshHome)return;sessionStorage.removeItem('x2_home_nav_reload_top');sessionStorage.removeItem('x2_return_to_scroll_url');sessionStorage.removeItem('x2_product_return_target');if(params.has('__nav_reload')||params.has('__home_top')){params.delete('__nav_reload');params.delete('__home_top');history.replaceState(history.state,'',location.pathname+(params.toString()?('?'+params.toString()):'')+location.hash)}function removeMapValue(name){try{var map=JSON.parse(sessionStorage.getItem(name)||'{}');delete map[key];sessionStorage.setItem(name,JSON.stringify(map))}catch(e){}}removeMapValue('x2_scroll_positions');removeMapValue('x2_product_return_positions');removeMapValue('scrollPositions');if('scrollRestoration'in history)history.scrollRestoration='manual';var keepTop=true,pinUntil=Date.now()+1800;function top(){if(!keepTop)return;try{window.scrollTo(0,0);if(document.scrollingElement)document.scrollingElement.scrollTop=0;document.documentElement.scrollTop=0;if(document.body)document.body.scrollTop=0}catch(e){}}function cancel(){keepTop=false}['touchstart','touchmove','pointerdown','pointermove','wheel','keydown'].forEach(function(evt){window.addEventListener(evt,cancel,{once:true,passive:true,capture:true})});function pin(){top();if(keepTop&&Date.now()<pinUntil)requestAnimationFrame(pin)}pin();document.addEventListener('DOMContentLoaded',top,{once:true});window.addEventListener('pageshow',top,{once:true});window.addEventListener('load',top,{once:true});[120,260,520,900,1300,1700].forEach(function(ms){setTimeout(top,ms)})}catch(e){}})();

(function(){try{var p=new URLSearchParams(location.search),u=p.get('lang'),s=localStorage.getItem('lang'),l=(u==='en'||u==='ar')?u:(s==='en'?'en':'ar'),r=(function(){try{var x=new URL(location.href),path=x.pathname.replace(/\/index\.html$/i,'/').replace(/\/+$/,'');if(!path)path='/';return sessionStorage.getItem('x2_return_to_scroll_url')===path+(x.search||'')}catch(e){return sessionStorage.getItem('x2_return_to_scroll_url')===location.href}})();localStorage.setItem('lang',l);document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';document.documentElement.classList.add('x2-home-booting');if(l==='en'&&!r)document.documentElement.classList.add('x2-i18n-pending');setTimeout(function(){document.documentElement.classList.remove('x2-i18n-pending')},1600);setTimeout(function(){document.documentElement.classList.remove('x2-home-booting')},3200)}catch(e){}})();

(function(){
  function pageKey(url){
    try {
      var u = new URL(url || location.href, location.href);
      var path = u.pathname.replace(/\/index\.html$/i, '/').replace(/\/+$/, '');
      if (!path) path = '/';
      return path + (u.search || '');
    } catch (e) {
      return String(url || location.href || '');
    }
  }
  function readMap(key){
    try { return JSON.parse(sessionStorage.getItem(key) || '{}'); } catch (e) { return {}; }
  }
  function restoreScroll(y){
    try {
      window.scrollTo(0, y);
      window.scrollTo({ top: y, behavior: 'auto' });
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = y;
        document.scrollingElement.scrollTo && document.scrollingElement.scrollTo(0, y);
      }
      document.documentElement.scrollTop = y;
      document.body && (document.body.scrollTop = y);
    } catch(e) {}
  }
  function reveal(){
    try {
      var key = pageKey(location.href);
      var productPositions = readMap('x2_product_return_positions');
      var positions = productPositions[key] ? productPositions : readMap('x2_scroll_positions');
      var y = Number(positions[key] || 0);
      if (!(y > 0)) return;
      var style = document.createElement('style');
      style.textContent = 'html.x2-restoring-scroll,html.x2-restoring-scroll body{scroll-behavior:auto!important}';
      document.head.appendChild(style);
      document.documentElement.classList.add('x2-restoring-scroll');
      var attempts = 0;
      function attempt(){
        attempts += 1;
        restoreScroll(y);
        if (attempts < 10 && Math.abs((window.scrollY || window.pageYOffset || 0) - y) > 2) {
          setTimeout(attempt, 120 * attempts);
        } else {
          document.documentElement.classList.remove('x2-restoring-scroll');
        }
      }
      attempt();
      setTimeout(attempt, 180);
      setTimeout(function(){ restoreScroll(y); document.documentElement.classList.remove('x2-restoring-scroll'); }, 900);
    } catch(e) {}
  }
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (sessionStorage.getItem('x2_return_to_scroll_url') !== pageKey(location.href)) return;
    reveal();
    document.addEventListener('DOMContentLoaded', reveal);
    window.addEventListener('pageshow', reveal);
    window.addEventListener('popstate', reveal);
    window.addEventListener('load', reveal);
    document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible') reveal(); });
    setTimeout(reveal, 700);
  } catch(e) {}
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

(function(){
  if (!window.fetch || window.__x2IpapiFetchGuard) return;
  window.__x2IpapiFetchGuard = true;
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : input && input.url;
    if (url && /https:\/\/ipapi\.co\/json\/?/i.test(String(url))) {
      return Promise.resolve(new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    return nativeFetch(input, init);
  };
})();

(function(){
  function appendJsonLd(data, id){
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    if (id) script.id = id;
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }
  appendJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'بريق للهدايا والإبداع',
    alternateName: ['بريق', 'Bariq', 'Bariq Gifts'],
    url: 'https://bariqgifts.com',
    logo: { '@type': 'ImageObject', url: 'https://bariqgifts.com/assets/logo.png', width: 512, height: 512 },
    sameAs: [],
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer support' }
  }, 'home-organization-jsonld');
  appendJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'بريق للهدايا',
    alternateName: ['بريق', 'Bariq', 'Bariq Gifts'],
    url: 'https://bariqgifts.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://bariqgifts.com/categories?q={search_term_string}',
      'query-input': 'required name=search_term_string'
    }
  }, 'home-website-jsonld');
})();

document.addEventListener('DOMContentLoaded', function(){
  var searchButton = document.querySelector('[data-home-search]');
  if (searchButton) {
    searchButton.addEventListener('click', function(){
      if (typeof window.performTextSearch === 'function') window.performTextSearch();
    });
  }
});
