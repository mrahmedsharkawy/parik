(function(){
  var VAPID_PUBLIC_KEY='BPojY-23BXbIfa1IRkkQD3vAELjTn3nltgFBrlEIjZ3aEbphXAQvFY2E5B2R_mfikZLhGPo0lBeCedB8qoP5-SE';
  function urlBase64ToUint8Array(base64String){
    var base64=(base64String+'='.repeat((4-base64String.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');
    var raw=window.atob(base64);
    return Uint8Array.from([].map.call(raw,function(c){return c.charCodeAt(0);}));
  }
  async function saveSubscriptionToSupabase(sub){
    var anon='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E';
    try{
      var profile={};
      try{profile=JSON.parse(localStorage.getItem('x2_profile')||'{}');}catch(e){}
      var p256dh=sub.getKey('p256dh'),auth=sub.getKey('auth');
      var email=(profile.email||profile.authEmail||'').trim().toLowerCase();
      await fetch('https://knleehjjejfeobcmpwnw.supabase.co/rest/v1/push_subscriptions',{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+anon,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({endpoint:sub.endpoint,p256dh:p256dh?btoa(String.fromCharCode.apply(null,new Uint8Array(p256dh))):'',auth:auth?btoa(String.fromCharCode.apply(null,new Uint8Array(auth))):'',user_phone:profile.phone||'',user_email:email,created_at:(new Date).toISOString()})});
    }catch(e){}
  }
  async function activatePushFromWelcome(btn){
    if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){
      btn.innerHTML='غير مدعوم على هذا الجهاز';
      return false;
    }
    if(Notification.permission==='denied'){
      btn.disabled=false;
      btn.innerHTML='افتح إعدادات الهاتف واسمح بالإشعارات';
      alert('الإشعارات مقفولة من إعدادات الهاتف. افتح إعدادات الهاتف، ثم التطبيقات، ثم Bariq، وفعّل الإشعارات وبعدها ارجع واضغط الزر مرة أخرى.');
      return false;
    }
    try{
      btn.disabled=true;
      btn.innerHTML='⏳ جارٍ التفعيل...';
      var permission=await Notification.requestPermission();
      if(permission!=='granted'){
        btn.disabled=false;
        btn.innerHTML=permission==='denied'?'افتح إعدادات الهاتف واسمح بالإشعارات':'🔕 تفعيل الإشعارات';
        if(permission==='denied')alert('تم رفض إذن الإشعارات. فعّله من إعدادات الهاتف للتطبيق ثم حاول مرة أخرى.');
        return false;
      }
      var reg=await navigator.serviceWorker.getRegistration('/');
      if(!reg)reg=await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      var sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
      saveSubscriptionToSupabase(sub);
      btn.disabled=false;
      btn.style.background='#27ae60';
      btn.style.color='#fff';
      btn.innerHTML='🔔 مفعل ✓';
      localStorage.setItem('x2_push_welcome_seen','1');
      return true;
    }catch(e){
      console.warn('Push activation failed:',e);
      btn.disabled=false;
      btn.innerHTML='تعذر التفعيل - حاول مرة أخرى';
      return false;
    }
  }
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
    document.body.insertAdjacentHTML('beforeend','<div id="pushWelcomeModal" style="display:none;position:fixed;inset:0;z-index:100000;background:rgba(21,37,70,.54);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:18px"><div style="width:min(360px,100%);background:#fff;border-radius:18px;box-shadow:0 18px 60px rgba(21,37,70,.28);overflow:hidden;text-align:center;direction:rtl"><div style="background:linear-gradient(135deg,#152546,#24447d);padding:18px 18px 16px;color:#fff"><div style="width:54px;height:54px;border-radius:50%;margin:0 auto 10px;background:rgba(212,175,55,.18);border:1.5px solid rgba(212,175,55,.45);display:flex;align-items:center;justify-content:center;font-size:1.65rem">🔔</div><div style="font-size:1.05rem;font-weight:900;margin-bottom:4px">فعّل إشعارات Bariq</div><div style="font-size:.78rem;line-height:1.7;color:rgba(255,255,255,.78)">كن على علم دائم بالعروض والخصومات التي تصل إلى 70%</div></div><div style="padding:16px 18px 18px"><div style="display:grid;gap:8px;text-align:right;margin-bottom:14px;color:#152546;font-size:.84rem;font-weight:700"><div>🚚 تنبيهات الشحن وحالة الطلبات</div><div>🤑 تحديثات الكاش باك والمكافآت</div><div>🎁 عروض وخصومات حصرية فور نزولها</div></div><button id="push-welcome-subscribe-btn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 14px;min-height:42px;border:none;border-radius:12px;background:#D4AF37;color:#152546;font-size:.9rem;font-weight:900;cursor:pointer">🔕 تفعيل الإشعارات</button><button type="button" onclick="dismissPushWelcome()" style="margin-top:9px;width:100%;border:none;background:none;color:#9aa3b2;font-size:.8rem;font-weight:700;cursor:pointer;padding:8px">لاحقًا</button></div></div></div>');
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
  document.addEventListener('click',function(e){
    var btn=e.target&&e.target.closest&&e.target.closest('#push-welcome-subscribe-btn');
    var modal=document.getElementById('pushWelcomeModal');
    if(btn&&modal&&modal.style.display!=='none'){
      e.preventDefault();
      activatePushFromWelcome(btn).then(function(ok){if(ok)setTimeout(window.dismissPushWelcome,500);});
    }
  });
  function initPushWelcome(){
    window.maybeShowPushWelcome();
  }
  if(document.body)initPushWelcome();
  else document.addEventListener('DOMContentLoaded',initPushWelcome,{once:true});
})();