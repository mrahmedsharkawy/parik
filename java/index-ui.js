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
  fetch('/java/Products.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():[]}).then(function(list){
    var el=document.getElementById('homeFlashProductCount');
    if(el)el.textContent=Array.isArray(list)?list.length:0;
  }).catch(function(){var el=document.getElementById('homeFlashProductCount');if(el)el.textContent='24'});
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
  const siteThemeColor = '#152546';
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const appleStatusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (themeMeta) themeMeta.setAttribute('content', siteThemeColor);
  if (appleStatusMeta) appleStatusMeta.setAttribute('content', 'black-translucent');
})();
