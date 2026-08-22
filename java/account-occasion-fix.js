(function(){
'use strict';
if(window.__bariqOccasionFixR7)return;
window.__bariqOccasionFixR7=true;

async function ensure(){
  try{
    if(typeof window.BariqEnsureUserSession==='function')return await window.BariqEnsureUserSession();
  }catch(_){}
  return String(localStorage.getItem('x2_token')||'').trim();
}
async function reloadOccasions(){
  var token=await ensure();
  var status=document.getElementById('occasionStatus');
  if(!token){
    if(status)status.textContent='تعذر تحديث الجلسة. افتح تسجيل الدخول مرة واحدة.';
    return false;
  }
  if(status&&/سجل الدخول|تسجيل الدخول|login/i.test(status.textContent||'')){
    status.textContent='جاري تحميل مناسباتك...';
  }
  try{
    if(typeof window.loadCustomerOccasions==='function'){
      await window.loadCustomerOccasions();
      return true;
    }
  }catch(e){
    console.warn('[BARIQ_OCC] loadCustomerOccasions failed',e);
  }
  var b=document.querySelector('[data-occ-refresh]');
  if(b&&!b.__bariqOccReloading){
    b.__bariqOccReloading=true;
    try{b.click()}catch(_){}
    setTimeout(function(){b.__bariqOccReloading=false},1000);
  }
  return true;
}
document.addEventListener('click',async function(e){
  var t=e.target&&e.target.closest&&e.target.closest('[data-occ-refresh],[data-occ-save],[data-occ-edit],[data-occ-delete],[data-occ-enable-push]');
  if(!t)return;
  var token=await ensure();
  if(!token)return;
  if(t.matches('[data-occ-enable-push]')){
    try{
      if(typeof window.ensureBariqPush==='function')await window.ensureBariqPush(false);
      else if(typeof window.subscribeToPush==='function')await window.subscribeToPush();
    }catch(_){}
  }
  setTimeout(reloadOccasions,80);
},true);

window.addEventListener('bariq:session-restored',function(){setTimeout(reloadOccasions,100)});
window.addEventListener('bariq:user-session-ready',function(){setTimeout(reloadOccasions,100)});
window.addEventListener('pageshow',function(){setTimeout(reloadOccasions,250)});

function start(){ensure().then(function(t){if(t)setTimeout(reloadOccasions,150)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();