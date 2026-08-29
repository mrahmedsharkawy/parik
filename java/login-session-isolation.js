(function(){
'use strict';
if(window.__bariqLoginSessionR1) return;
window.__bariqLoginSessionR1=true;

var PROJECT_REF='knleehjjejfeobcmpwnw';
var AUTH_KEY='sb-'+PROJECT_REF+'-auth-token';

function clearOldAuth(){
  try{
    localStorage.removeItem('x2_token');
    localStorage.removeItem('x2_refresh_token');
    localStorage.removeItem('x2_token_expires_at');
    localStorage.removeItem('x2_refresh_token');
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('supabase.auth.token');
    var keys=[];
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i)||'';
      if(/^sb-.*-auth-token$/.test(k)) keys.push(k);
    }
    keys.forEach(function(k){localStorage.removeItem(k);});
  }catch(_){}
}
function saveSession(data){
  if(!data||!data.access_token) return data;
  var obj={
    access_token:data.access_token,
    refresh_token:data.refresh_token||'',
    token_type:data.token_type||'bearer',
    expires_in:Number(data.expires_in||3600),
    expires_at:Number(data.expires_at||0)||Math.floor(Date.now()/1000)+Number(data.expires_in||3600),
    user:data.user||null
  };
  try{
    localStorage.setItem('x2_token',obj.access_token);
    if(obj.refresh_token) localStorage.setItem('x2_refresh_token',obj.refresh_token);
    localStorage.setItem(AUTH_KEY,JSON.stringify(obj));
    localStorage.setItem('x2_logged','1');
  }catch(_){}
  return data;
}
function patchAuth(){
  if(!window.Supabase||!window.Supabase.Auth) return false;

  ['signIn','signUp'].forEach(function(name){
    var current=window.Supabase.Auth[name];
    if(typeof current!=='function'||current.__bariqSessionSaved) return;
    var wrapped=async function(){
      var data=await current.apply(this,arguments);
      saveSession(data);
      return data;
    };
    wrapped.__bariqSessionSaved=true;
    window.Supabase.Auth[name]=wrapped;
  });
  return true;
}
function patchLogin(){
  if(typeof window.doLogin!=='function'||window.doLogin.__bariqClearOldAuth) return false;
  var old=window.doLogin;
  var fn=async function(){
    // يمنع نهائياً استعمال JWT الحساب السابق عند الدخول بحساب جديد.
    clearOldAuth();
    patchAuth();
    return await old.apply(this,arguments);
  };
  fn.__bariqClearOldAuth=true;
  window.doLogin=fn;
  return true;
}
function boot(){
  patchAuth();
  patchLogin();
  var n=0,t=setInterval(function(){
    n++;
    patchAuth();
    patchLogin();
    if(n>80) clearInterval(t);
  },100);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
