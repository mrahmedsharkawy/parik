(function(){
  var promptSets = {
    ar: ['ابحث بالاسم', 'ابحث بالصورة', 'ابحث بالمناسبة', 'ابحث حسب الهدية'],
    en: ['Search by name', 'Search by image', 'Search by occasion', 'Search by gift']
  };
  function currentPrompts(){
    var lang = (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar';
    return promptSets[lang];
  }
  var index = 0;
  var charIndex = 0;
  var deleting = false;
  var timer = null;
  function typeSearchPrompt() {
    var input = document.getElementById('textSearch');
    if (!input) return;
    if (input.value) {
      timer = setTimeout(typeSearchPrompt, 500);
      return;
    }
    var prompts = currentPrompts();
    if (index >= prompts.length) index = 0;
    var text = prompts[index];
    input.placeholder = text.slice(0, charIndex);
    if (!deleting && charIndex < text.length) {
      charIndex += 1;
      timer = setTimeout(typeSearchPrompt, 95);
      return;
    }
    if (!deleting) {
      deleting = true;
      timer = setTimeout(typeSearchPrompt, 1200);
      return;
    }
    if (charIndex > 0) {
      charIndex -= 1;
      timer = setTimeout(typeSearchPrompt, 45);
      return;
    }
    deleting = false;
    index = (index + 1) % prompts.length;
    timer = setTimeout(typeSearchPrompt, 180);
  }
  window.addEventListener('bariq:languagechange', function(){
    clearTimeout(timer);
    index = 0;
    charIndex = 0;
    deleting = false;
    typeSearchPrompt();
  });
  document.addEventListener('DOMContentLoaded', function(){
    clearTimeout(timer);
    typeSearchPrompt();
  });
})();

(function(){
  function pad(n){return String(Math.max(0,Math.floor(n))).padStart(2,'0')}
  function updateTimer(){
    var el=document.getElementById('homeFlashOfferTimer');
    var hoursEl=document.getElementById('homeFlashHours');
    var minutesEl=document.getElementById('homeFlashMinutes');
    var secondsEl=document.getElementById('homeFlashSeconds');
    if(!el&&!hoursEl&&!minutesEl&&!secondsEl)return;
    var now=new Date(),end=new Date(now);end.setHours(23,59,59,999);
    var total=Math.max(0,Math.floor((end-now)/1000));
    var h=pad(total/3600),m=pad(total%3600/60),s=pad(total%60);
    if(el)el.textContent=h+':'+m+':'+s;
    if(hoursEl)hoursEl.textContent=h;
    if(minutesEl)minutesEl.textContent=m;
    if(secondsEl)secondsEl.textContent=s;
  }
  updateTimer();setInterval(updateTimer,1000);
  function priceValue(v){var n=parseFloat(v);return isFinite(n)?n:0}
  function offerCount(products){
    var list=Array.isArray(products)?products:[];
    var featuredIds=new Set();
    try{featuredIds=new Set(JSON.parse(localStorage.getItem('x2_featured_ids')||'[]').map(String))}catch(e){}
    var featured=0,discounted=0;
    list.forEach(function(p){
      var id=String(p&&p.id||'');
      var price=priceValue(p&&p.price);
      var oldPrice=priceValue(p&&(p.oldPrice!=null?p.oldPrice:p.old_price));
      if(featuredIds.has(id)) featured++;
      else if(oldPrice>price&&price>0) discounted++;
    });
    return featured+discounted;
  }
  function readOffersCache(){try{var c=JSON.parse(sessionStorage.getItem('x2_offers_deals_cache_v1')||localStorage.getItem('x2_offers_deals_cache_v1')||'null');return c&&Array.isArray(c.products)?c.products:null}catch(e){return null}}
  function setOfferCount(n){var el=document.getElementById('homeFlashProductCount');if(el)el.textContent=String(Math.max(0,n||0))}
  function waitForSupabaseProducts(){if(window.Supabase&&window.Supabase.Products)return Promise.resolve(true);return new Promise(function(resolve){var started=Date.now(),timer=setInterval(function(){if(window.Supabase&&window.Supabase.Products){clearInterval(timer);resolve(true)}else if(Date.now()-started>1800){clearInterval(timer);resolve(false)}},80)})}
  (async function(){
    var cached=readOffersCache();
    if(cached) setOfferCount(offerCount(cached));
    try{
      var hasSupabase=await waitForSupabaseProducts();
      if(hasSupabase){
        var sb=await window.Supabase.Products.getAll(100000);
        if(Array.isArray(sb)){setOfferCount(offerCount(sb));return}
      }
      var r=await fetch('/java/Products.json',{cache:'no-store'}),list=r.ok?await r.json():[];
      setOfferCount(offerCount(list));
    }catch(e){if(!cached)setOfferCount(0)}
  })();
})();

(function(){
  let touchStartX = 0;
  let touchStartY = 0;
  let suppressCardClickUntil = 0;
  let touchStartedOnCard = false;
  let touchMoved = false;
  const cardSelector = '.product-card, .dp-card';
  function isCardTarget(target) {
    return !!(target && target.closest && target.closest(cardSelector));
  }

  document.addEventListener('touchstart', function(e) {
    if (!e.touches || e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
    touchStartedOnCard = isCardTarget(e.target);
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', function(e) {
    if (!e.touches || e.touches.length !== 1 || !touchStartedOnCard) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      touchMoved = true;
      suppressCardClickUntil = Date.now() + 800;
    }
  }, { passive: true, capture: true });

  document.addEventListener('touchend', function(e) {
    if (!touchStartedOnCard) return;
    const touch = e.changedTouches && e.changedTouches[0];
    const dx = touch ? touch.clientX - touchStartX : 0;
    const dy = touch ? touch.clientY - touchStartY : 0;
    if (touchMoved || Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      suppressCardClickUntil = Date.now() + 800;
    }
    touchStartedOnCard = false;
    touchMoved = false;
  }, { passive: true, capture: true });

  document.addEventListener('touchcancel', function() {
    touchStartedOnCard = false;
    touchMoved = false;
    suppressCardClickUntil = Date.now() + 800;
  }, { passive: true, capture: true });

  document.addEventListener('click', function(e) {
    if (Date.now() < suppressCardClickUntil) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
})();

(function(){
  function homeCategoryLabel(link) {
    const span = link && link.querySelector && link.querySelector('span');
    const href = link && link.getAttribute('href') || '';
    const label = (span && span.textContent || link && link.textContent || '').replace(/[💯🎉💎📄🖼️🪵👜🏷️🌙]/g, '').trim();
    if (/categories\.html/i.test(href)) return 'الكل';
    const slugMatch = href.match(/\/categories\/([^\/?#]+)/i);
    return slugMatch ? decodeURIComponent(slugMatch[1]) : label;
  }

  document.addEventListener('click', function(e) {
    const link = e.target && e.target.closest && e.target.closest('main .categories a');
    if (!link || !document.getElementById('home-category-products')) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    const label = link.getAttribute('data-category-slug') || homeCategoryLabel(link);
    window.__x2PendingHomeCategoryLabel = label;
    window.dispatchEvent(new CustomEvent('x2:home-category-select', { detail: { label: label } }));
  }, true);

  const siteThemeColor = '#152546';
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const appleStatusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (themeMeta) themeMeta.setAttribute('content', siteThemeColor);
  if (appleStatusMeta) appleStatusMeta.setAttribute('content', 'black-translucent');
})();
