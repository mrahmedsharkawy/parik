(function(){
  function isInstalledMobileApp(){
    var mobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    var standalone=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true||document.referrer.indexOf('android-app://')===0;
    return mobile&&standalone;
  }
  function canShowPushWelcome(){
    try{
      return localStorage.getItem('x2_logged')==='1'&&isInstalledMobileApp()&&'Notification'in window&&Notification.permission!=='granted'&&sessionStorage.getItem('x2_push_welcome_dismissed')!=='1';
    }catch(e){return false;}
  }
  function ensurePushWelcomeModal(){
    if(document.getElementById('pushWelcomeModal'))return;
    document.body.insertAdjacentHTML('beforeend','<div id="pushWelcomeModal" style="display:none;position:fixed;inset:0;z-index:100000;background:rgba(21,37,70,.54);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:18px"><div style="width:min(360px,100%);background:#fff;border-radius:18px;box-shadow:0 18px 60px rgba(21,37,70,.28);overflow:hidden;text-align:center;direction:rtl"><div style="background:linear-gradient(135deg,#152546,#24447d);padding:18px 18px 16px;color:#fff"><div style="width:54px;height:54px;border-radius:50%;margin:0 auto 10px;background:rgba(212,175,55,.18);border:1.5px solid rgba(212,175,55,.45);display:flex;align-items:center;justify-content:center;font-size:1.65rem">🔔</div><div style="font-size:1.05rem;font-weight:900;margin-bottom:4px">فعّل إشعارات Bariq</div><div style="font-size:.78rem;line-height:1.7;color:rgba(255,255,255,.78)">كن على علم دائم بالعروض والخصومات التي تصل إلى 70%</div></div><div style="padding:16px 18px 18px"><div style="display:grid;gap:8px;text-align:right;margin-bottom:14px;color:#152546;font-size:.84rem;font-weight:700"><div>🚚 تنبيهات الشحن وحالة الطلبات</div><div>🤑 تحديثات الكاش باك والمكافآت</div><div>🎁 عروض وخصومات حصرية فور نزولها</div></div><button id="push-subscribe-btn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 14px;min-height:42px;border:none;border-radius:12px;background:#D4AF37;color:#152546;font-size:.9rem;font-weight:900;cursor:pointer">🔕 تفعيل الإشعارات</button><button type="button" onclick="dismissPushWelcome()" style="margin-top:9px;width:100%;border:none;background:none;color:#9aa3b2;font-size:.8rem;font-weight:700;cursor:pointer;padding:8px">لاحقًا</button></div></div></div>');
  }
  window.dismissPushWelcome=function(){
    try{
      if('Notification'in window&&Notification.permission==='granted')localStorage.setItem('x2_push_welcome_seen','1');
      else sessionStorage.setItem('x2_push_welcome_dismissed','1');
    }catch(e){}
    var modal=document.getElementById('pushWelcomeModal');
    if(modal)modal.style.display='none';
  };
  window.maybeShowPushWelcome=function(){
    try{
      if(!canShowPushWelcome())return;
      localStorage.removeItem('x2_push_welcome_seen');
      ensurePushWelcomeModal();
      var modal=document.getElementById('pushWelcomeModal');
      if(modal)setTimeout(function(){modal.style.display='flex';},700);
    }catch(e){}
  };
  document.addEventListener('pointerdown',function(e){
    var btn=e.target&&e.target.closest&&e.target.closest('#push-subscribe-btn');
    var modal=document.getElementById('pushWelcomeModal');
    if(btn&&modal&&modal.style.display!=='none')setTimeout(function(){window.dismissPushWelcome();},220);
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',window.maybeShowPushWelcome,{once:true});
  else window.maybeShowPushWelcome();
})();