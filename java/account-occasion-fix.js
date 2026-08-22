(function(){
  'use strict';

  function restore(){
    try{
      if(typeof window.BariqRestoreUserSession==='function') return window.BariqRestoreUserSession();
    }catch(e){}
    return localStorage.getItem('x2_token')||'';
  }

  const MONTHS={'يناير':1,'فبراير':2,'مارس':3,'أبريل':4,'ابريل':4,'مايو':5,'يونيو':6,'يوليو':7,'أغسطس':8,'اغسطس':8,'سبتمبر':9,'أكتوبر':10,'اكتوبر':10,'نوفمبر':11,'ديسمبر':12};

  function todayDubai(){
    var p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),o={};
    p.forEach(x=>{if(x.type!=='literal')o[x.type]=Number(x.value)});
    return o;
  }

  function fixDays(){
    var now=todayDubai(), base=Date.UTC(now.year,now.month-1,now.day);
    document.querySelectorAll('.occ-item').forEach(function(item){
      var meta=item.querySelector('.occ-item-meta'),badge=item.querySelector('.occ-days');
      if(!meta||!badge)return;
      var m=(meta.textContent||'').match(/(\d{1,2})\s+(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)(?:\s+(\d{4}))?/);
      if(!m)return;
      var d=Number(m[1]),mo=MONTHS[m[2]],y=m[3]?Number(m[3]):now.year,target=Date.UTC(y,mo-1,d);
      if(!m[3]&&target<base)target=Date.UTC(y+1,mo-1,d);
      var days=Math.max(0,Math.round((target-base)/86400000));
      badge.textContent=days===0?'اليوم':('باقي '+days+' يوم');
    });
  }

  async function pushUI(){
    var box=document.getElementById('occasionPushNotice');
    if(!box)return;
    try{
      var ok=false;
      if(typeof window.getPushStatus==='function') ok=(await window.getPushStatus())==='subscribed';
      else if('serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window&&Notification.permission==='granted'){
        var reg=await navigator.serviceWorker.ready; ok=!!(await reg.pushManager.getSubscription());
      }
      box.style.display=ok?'none':'';
    }catch(e){}
  }

  document.addEventListener('click',async function(e){
    var b=e.target&&e.target.closest&&e.target.closest('[data-occ-enable-push]');
    if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    restore();
    try{
      if(typeof window.subscribeToPush==='function')await window.subscribeToPush();
      await pushUI();
    }catch(err){}
  },true);

  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('[data-occ-refresh],[data-occ-save],[data-occ-edit],[data-occ-delete]')) restore();
  },true);

  function run(){restore();fixDays();pushUI()}
  var mo=new MutationObserver(function(){clearTimeout(mo.t);mo.t=setTimeout(run,80)});
  function start(){run();mo.observe(document.body,{childList:true,subtree:true});setTimeout(run,500);setTimeout(run,1500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();