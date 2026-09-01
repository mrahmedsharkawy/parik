(function(){
'use strict';
if(window.__bariqPushRuntimeV5)return;
window.__bariqPushRuntimeV5=true;

var VAPID_PUBLIC_KEY='BMr4ZWTwS2DgL12mxYFjLM9rmnljnJpY_tsFtWtKxgS2d_z36lcg3sLfIQfOFbX1Tw0ITNG3pB4hJeGI-YEZFHE';
var VAPID_VERSION='vapid-BMr4-20260822-r5';
var SERVICE_WORKER_URL='/sw.js?v=412-push-user-binding';
var SUPABASE_URL='https://knleehjjejfeobcmpwnw.supabase.co';
var SUPABASE_ANON_KEY='sb_publishable_VPSO9nbXg5eVNMj03KpgdA_VSOuMDHw';
var MARKER='bariq_push_vapid_version';

function toKey(v){var p=v+'='.repeat((4-v.length%4)%4),b=atob(p.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([].map.call(b,function(c){return c.charCodeAt(0)}));}
function phone(v){var d=String(v||'').replace(/\D/g,'');if(d.indexOf('00971')===0)d=d.slice(2);if(d.indexOf('971')===0)d=d.slice(3);if(d.indexOf('0')===0)d=d.slice(1);d=d.slice(0,9);return d?'+971'+d:'';}
function profile(){try{return JSON.parse(localStorage.getItem('x2_profile')||'{}')}catch(_){return{}}}
function lang(){return (localStorage.getItem('lang')||document.documentElement.lang||'ar')==='en'?'en':'ar'}
function extractToken(raw){try{var o=typeof raw==='string'?JSON.parse(raw):raw;return String((o&&o.access_token)||(o&&o.currentSession&&o.currentSession.access_token)||(o&&o.session&&o.session.access_token)||(o&&o.data&&o.data.session&&o.data.session.access_token)||'').trim()}catch(_){return''}}
function tokenUsable(t){try{if(!t||t.split('.').length!==3)return false;var p=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');p+='='.repeat((4-p.length%4)%4);var j=JSON.parse(atob(p));return !j.exp||(j.exp*1000)>Date.now()+30000}catch(_){return false}}
function currentUserToken(){
 try{
  var d=String(localStorage.getItem('x2_token')||'').trim();if(tokenUsable(d))return d;
  var keys=['sb-knleehjjejfeobcmpwnw-auth-token','supabase.auth.token'];
  for(var i=0;i<keys.length;i++){var t=extractToken(localStorage.getItem(keys[i]));if(tokenUsable(t))return t;}
  for(var n=0;n<localStorage.length;n++){var k=localStorage.key(n)||'';if(/^sb-.*-auth-token$/.test(k)){var z=extractToken(localStorage.getItem(k));if(tokenUsable(z))return z;}}
 }catch(_){}
 return '';
}
async function bestToken(){
 try{if(typeof window.BariqEnsureUserSession==='function'){var t=await window.BariqEnsureUserSession();if(tokenUsable(t))return t;}}catch(_){}
 return currentUserToken();
}
async function save(sub){
 var p256dh=sub.getKey('p256dh'),auth=sub.getKey('auth');if(!p256dh||!auth)return false;
 var p=profile(),token=await bestToken();
 var r=await fetch(SUPABASE_URL+'/functions/v1/push-register',{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,...(token ? { Authorization: "Bearer " + token } : {}),'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,p256dh:btoa(String.fromCharCode.apply(null,new Uint8Array(p256dh))),auth:btoa(String.fromCharCode.apply(null,new Uint8Array(auth))),user_phone:phone(p.phone||''),user_email:String(p.email||p.authEmail||'').trim().toLowerCase(),user_lang:lang(),vapid_public_key:VAPID_PUBLIC_KEY})});
 var txt=await r.text();console.log('[BARIQ_PUSH] register',r.status,txt);if(!r.ok)return false;localStorage.setItem(MARKER,VAPID_VERSION);return true;
}
async function ensure(force){
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)||Notification.permission!=='granted')return null;
 var reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
 if(force&&sub){await sub.unsubscribe().catch(function(){});sub=null;}
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toKey(VAPID_PUBLIC_KEY)});
 try{await save(sub)}catch(e){console.warn('[BARIQ_PUSH] register retry later',e)}
 return sub;
}
async function subscribeToPush(){if(Notification.permission==='default')await Notification.requestPermission();return ensure(false)}
async function getPushStatus(){if(!('serviceWorker'in navigator)||!('PushManager'in window))return'unsupported';if(Notification.permission==='denied')return'denied';if(Notification.permission!=='granted')return'unsubscribed';var reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();return sub?'subscribed':'unsubscribed'}
async function unsubscribeFromPush(){var reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();localStorage.removeItem(MARKER)}
window.subscribeToPush=subscribeToPush;window.getPushStatus=getPushStatus;window.unsubscribeFromPush=unsubscribeFromPush;window.ensureBariqPush=ensure;
(async function(){if('serviceWorker'in navigator){await navigator.serviceWorker.register(SERVICE_WORKER_URL,{updateViaCache:'none'});await navigator.serviceWorker.ready;}if(Notification.permission==='granted')await ensure(false).catch(console.error);})();
window.addEventListener('bariq:session-restored',function(){if(Notification.permission==='granted')ensure(false).catch(function(){})});
window.addEventListener('pageshow',function(){if(Notification.permission==='granted')ensure(false).catch(function(){})});
})();