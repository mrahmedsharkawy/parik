(function(){
'use strict';
if(window.__bariqSessionBridgeR6)return;
window.__bariqSessionBridgeR6=true;

var SUPABASE_URL='https://knleehjjejfeobcmpwnw.supabase.co';
var ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlIiwicmVmIjoia25sZWhqampIamZlb2JjbXB3bnciLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4NDAyOTU3MCwiZXhwIjoyMDk5NjA1NTcwfQ.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E';
var AUTH_KEY='sb-knleehjjejfeobcmpwnw-auth-token';
var refreshing=null;

function parseJwt(t){
  try{
    var p=String(t||'').split('.')[1];
    if(!p)return null;
    p=p.replace(/-/g,'+').replace(/_/g,'/');
    p+='='.repeat((4-p.length%4)%4);
    return JSON.parse(atob(p));
  }catch(_){return null}
}
function usable(t,skew){
  var j=parseJwt(t);
  return !!j && (!j.exp || (j.exp*1000)>Date.now()+(skew||30000));
}
function extract(raw){
  try{
    var o=typeof raw==='string'?JSON.parse(raw):raw;
    if(!o)return{};
    var s=o.currentSession||o.session||(o.data&&o.data.session)||o;
    return {
      access_token:String(s.access_token||'').trim(),
      refresh_token:String(s.refresh_token||'').trim(),
      expires_in:Number(s.expires_in||0),
      expires_at:Number(s.expires_at||0),
      user:s.user||null
    };
  }catch(_){return{}}
}
function findStored(){
  var keys=[AUTH_KEY,'supabase.auth.token'];
  for(var i=0;i<keys.length;i++){
    var raw=localStorage.getItem(keys[i]);
    if(raw){
      var s=extract(raw);
      if(s.access_token||s.refresh_token)return {key:keys[i],session:s};
    }
  }
  for(var n=0;n<localStorage.length;n++){
    var k=localStorage.key(n)||'';
    if(!/^sb-.*-auth-token$/.test(k))continue;
    var ss=extract(localStorage.getItem(k));
    if(ss.access_token||ss.refresh_token)return {key:k,session:ss};
  }
  return null;
}
function save(data,key){
  if(!data||!data.access_token)return'';
  var obj={
    access_token:data.access_token,
    refresh_token:data.refresh_token||'',
    token_type:data.token_type||'bearer',
    expires_in:Number(data.expires_in||3600),
    expires_at:Number(data.expires_at||0)||Math.floor(Date.now()/1000)+Number(data.expires_in||3600),
    user:data.user||null
  };
  try{
    localStorage.setItem(AUTH_KEY,JSON.stringify(obj));
    if(key&&key!==AUTH_KEY)localStorage.setItem(key,JSON.stringify(obj));
    localStorage.setItem('x2_token',obj.access_token);
    if(obj.refresh_token)localStorage.setItem('x2_refresh_token',obj.refresh_token);
    localStorage.setItem('x2_logged','1');
    localStorage.setItem('x2_auth_updated_at',String(Date.now()));
  }catch(_){}
  try{window.dispatchEvent(new CustomEvent('bariq:session-restored',{detail:{ok:true}}))}catch(_){}
  return obj.access_token;
}
function restoreSync(){
  try{
    var x=String(localStorage.getItem('x2_token')||'').trim();
    if(usable(x))return x;
  }catch(_){}
  var f=findStored();
  if(f&&usable(f.session.access_token)){
    try{
      localStorage.setItem('x2_token',f.session.access_token);
      if(f.session.refresh_token)localStorage.setItem('x2_refresh_token',f.session.refresh_token);
      localStorage.setItem('x2_logged','1');
    }catch(_){}
    return f.session.access_token;
  }
  return'';
}
async function refresh(){
  if(refreshing)return refreshing;
  refreshing=(async function(){
    var f=findStored();
    var rt=(f&&f.session&&f.session.refresh_token)||String(localStorage.getItem('x2_refresh_token')||'').trim();
    if(!rt)return'';
    try{
      var r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{
        method:'POST',
        headers:{apikey:ANON,'Content-Type':'application/json'},
        body:JSON.stringify({refresh_token:rt}),
        cache:'no-store'
      });
      if(!r.ok){
        console.warn('[BARIQ_AUTH] refresh failed',r.status);
        return'';
      }
      return save(await r.json(),f&&f.key);
    }catch(e){
      console.warn('[BARIQ_AUTH] refresh network error',e);
      return'';
    }finally{
      setTimeout(function(){refreshing=null},100);
    }
  })();
  return refreshing;
}
async function ensure(){
  var t=restoreSync();
  if(t)return t;
  return await refresh();
}

window.BariqRestoreUserSession=restoreSync;
window.BariqRefreshUserSession=refresh;
window.BariqEnsureUserSession=ensure;
window.BariqSessionReady=ensure();

/* مهم: getStoredAuthToken في supabase.js كان يحذف توكن المستخدم المنتهي.
   نخليه يرجع التوكن المجدد بدل ما يعتبر المستخدم خرج. */
var oldGet=window.getStoredAuthToken;
window.getStoredAuthToken=function(){
  var t=restoreSync();
  if(t)return t;
  try{
    if(typeof oldGet==='function'){
      var x=oldGet();
      if(usable(x))return x;
    }
  }catch(_){}
  return'';
};

/* إصلاح sbFetch للمستخدم: عند 401/403 يجدد الجلسة ثم يعيد الطلب مرة واحدة */
function patchSbFetch(){
  if(typeof window.sbFetch!=='function'||window.sbFetch.__bariqUserRefreshPatch)return false;
  var original=window.sbFetch;
  async function wrapped(path,opts){
    opts=opts||{};
    if(!opts.forceAnon){
      var token=restoreSync();
      if(!token)token=await ensure();
      if(opts.requireAuth&&!token)throw new Error('جلسة المستخدم تحتاج تحديث. افتح الحساب مرة أخرى.');
    }
    try{
      return await original(path,opts);
    }catch(e){
      var msg=String(e&&e.message||e||'');
      if(!opts.__bariqUserRetried && /SB\s+(401|403)|401|403/.test(msg)){
        var nt=await refresh();
        if(nt){
          var next=Object.assign({},opts,{__bariqUserRetried:true});
          return await original(path,next);
        }
      }
      throw e;
    }
  }
  wrapped.__bariqUserRefreshPatch=true;
  wrapped.__original=original;
  window.sbFetch=wrapped;
  return true;
}
patchSbFetch();
var tries=0,pt=setInterval(function(){
  tries++;
  if(patchSbFetch()||tries>50)clearInterval(pt);
},100);

function wake(){ensure().then(function(t){
  if(t){
    patchSbFetch();
    try{window.dispatchEvent(new CustomEvent('bariq:user-session-ready'))}catch(_){}
  }
})}
window.addEventListener('pageshow',wake);
window.addEventListener('focus',wake);
document.addEventListener('visibilitychange',function(){if(!document.hidden)wake()});
setInterval(function(){
  try{
    var t=localStorage.getItem('x2_token')||'';
    if(!usable(t,5*60*1000))wake();
  }catch(_){}
},120000);
})();