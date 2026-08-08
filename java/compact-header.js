(function(){
  function initCompact(){
    var update=function(){
      var y=Math.max(
        window.scrollY||0,
        window.pageYOffset||0,
        document.documentElement.scrollTop||0,
        document.body.scrollTop||0,
        (document.scrollingElement||{}).scrollTop||0,
        (document.querySelector('.page')||{}).scrollTop||0
      );
      document.body.classList.toggle('mobile-header-compact',y>50);
    };
    [window,document,document.documentElement,document.body,document.scrollingElement,document.querySelector('.page'),document.querySelector('main')].forEach(function(el){
      if(el)el.addEventListener('scroll',update,{passive:true,capture:true});
    });
    var sentinel=document.getElementById('hdrSentinel');
    if(sentinel&&'IntersectionObserver'in window){
      new IntersectionObserver(function(e){
        document.body.classList.toggle('mobile-header-compact',!e[0].isIntersecting);
      },{rootMargin:'-54px 0px 0px 0px'}).observe(sentinel);
    }
    setInterval(update,150);
    update();
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initCompact);
  } else {
    initCompact();
  }
})();
