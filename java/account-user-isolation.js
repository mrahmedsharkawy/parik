(function(){
'use strict';
if (window.__bariqUserIsolationR1) return;
window.__bariqUserIsolationR1 = true;

var PROJECT_REF = 'knleehjjejfeobcmpwnw';
var SB_AUTH_KEY = 'sb-' + PROJECT_REF + '-auth-token';

function parseJwt(token){
  try{
    var p=String(token||'').split('.')[1];
    if(!p) return null;
    p=p.replace(/-/g,'+').replace(/_/g,'/');
    p+='='.repeat((4-p.length%4)%4);
    return JSON.parse(atob(p));
  }catch(_){ return null; }
}
function usable(token){
  var j=parseJwt(token);
  return !!j && (!j.exp || j.exp*1000 > Date.now()+30000);
}
function profile(){
  try{ return JSON.parse(localStorage.getItem('x2_profile')||'{}') || {}; }
  catch(_){ return {}; }
}
function clearUserAuth(){
  try{
    localStorage.removeItem('x2_token');
    localStorage.removeItem('x2_refresh_token');
    localStorage.removeItem('x2_token_expires_at');
    localStorage.removeItem('x2_refresh_token');
    localStorage.removeItem('x2_logged');
    localStorage.removeItem(SB_AUTH_KEY);
    localStorage.removeItem('supabase.auth.token');
    var keys=[];
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i)||'';
      if(/^sb-.*-auth-token$/.test(k)) keys.push(k);
    }
    keys.forEach(function(k){localStorage.removeItem(k);});
  }catch(_){}
}
async function ensureToken(){
  var t='';
  try{
    if(typeof window.BariqEnsureUserSession==='function'){
      t=String(await window.BariqEnsureUserSession()||'').trim();
    }
  }catch(_){}
  if(!usable(t)){
    try{ t=String(localStorage.getItem('x2_token')||'').trim(); }catch(_){}
  }
  if(!usable(t)) return '';

  var claims=parseJwt(t)||{};
  var p=profile();
  var pEmail=String(p.email||'').trim().toLowerCase();
  var jwtEmail=String(claims.email||'').trim().toLowerCase();

  // أهم حماية: لو البروفايل لحساب والتوكن لحساب آخر لا نسمح بأي قراءة/تعديل.
  if(pEmail && jwtEmail && pEmail!==jwtEmail){
    console.error('[BARIQ_AUTH] account/token mismatch blocked', {profile:pEmail, token:jwtEmail});
    clearUserAuth();
    return '';
  }
  return t;
}
function userIdFromToken(token){
  var j=parseJwt(token);
  return j && j.sub ? String(j.sub) : '';
}
function addUserFilter(path,uid){
  var s=String(path||'');
  if(!/^customer_occasions(?:\?|$)/.test(s)) return s;
  if(/(?:^|[?&])user_id=/.test(s)) return s;
  return s + (s.indexOf('?')>=0?'&':'?') + 'user_id=eq.' + encodeURIComponent(uid);
}
function patchSbFetch(){
  if(typeof window.sbFetch!=='function') return false;
  if(window.sbFetch.__bariqOccasionIsolation) return true;

  var original=window.sbFetch;

  async function wrapped(path,opts){
    var isOcc=/^customer_occasions(?:\?|$)/.test(String(path||''));
    if(!isOcc) return original(path,opts);

    var token=await ensureToken();
    var uid=userIdFromToken(token);
    if(!uid) throw new Error('سجل الدخول بالحساب الصحيح أولاً لحفظ وعرض مناسباتك.');

    opts=Object.assign({},opts||{});
    var method=String(opts.method||'GET').toUpperCase();
    var scopedPath=addUserFilter(path,uid);

    if(method==='POST'){
      var body=opts.body;
      try{
        var obj=typeof body==='string'?JSON.parse(body):(body||{});
        if(Array.isArray(obj)){
          obj=obj.map(function(row){return Object.assign({},row,{user_id:uid});});
        }else{
          obj=Object.assign({},obj,{user_id:uid});
        }
        opts.body=JSON.stringify(obj);
      }catch(_){
        throw new Error('تعذر ربط المناسبة بالحساب الحالي.');
      }
    }

    // PATCH / DELETE أيضاً مقيدان صراحة بنفس user_id.
    return original(scopedPath,opts);
  }

  wrapped.__bariqOccasionIsolation=true;
  wrapped.__original=original;
  window.sbFetch=wrapped;
  console.log('[BARIQ_OCC] per-user isolation active');
  return true;
}

function patchLogout(){
  if(typeof window.doLogout!=='function' || window.doLogout.__bariqSafeLogout) return false;
  var old=window.doLogout;
  var fn=function(){
    clearUserAuth();
    try{
      localStorage.removeItem('x2_profile');
      localStorage.removeItem('x2_orders');
      localStorage.removeItem('x2_cashback');
      localStorage.removeItem('x2_coupon_applied');
      localStorage.removeItem('x2_coupon_code');
    }catch(_){}
    return old.apply(this,arguments);
  };
  fn.__bariqSafeLogout=true;
  window.doLogout=fn;
  return true;
}

function boot(){
  patchSbFetch();
  patchLogout();

  var tries=0;
  var timer=setInterval(function(){
    tries++;
    patchSbFetch();
    patchLogout();
    if(tries>80) clearInterval(timer);
  },100);

  ensureToken().then(function(t){
    if(!t){
      var s=document.getElementById('occasionStatus');
      if(s) s.textContent='سجل الدخول بالحساب الصحيح لعرض مناسباتك.';
    }
  });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

window.addEventListener('pageshow',function(){
  patchSbFetch();
  ensureToken();
});
})();
