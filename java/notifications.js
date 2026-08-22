(function(){
'use strict';
if(window.__bariqPushRuntimeV4)return;
window.__bariqPushRuntimeV4=true;

var VAPID_PUBLIC_KEY='BMr4ZWTwS2DgL12mxYFjLM9rmnljnJpY_tsFtWtKxgS2d_z36lcg3sLfIQfOFbX1Tw0ITNG3pB4hJeGI-YEZFHE';
var VAPID_VERSION='vapid-BMr4-20260822-r4';
var SERVICE_WORKER_URL='/sw.js?v=412-push-user-binding';
var SUPABASE_URL='https://knleehjjejfeobcmpwnw.supabase.co';
var SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlIiwicmVmIjoia25sZWhqampIamZlb2JjbXB3bnciLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4NDAyOTU3MCwiZXhwIjoyMDk5NjA1NTcwfQ.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E';
var MARKER='bariq_push_vapid_version';

function toKey(v){var p=v+'='.repeat((4-v.length%4)%4),b=atob(p.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([].map.call(b,function(c){return c.charCodeAt(0)}));}
function phone(v){var d=String(v||'').replace(/\D/g,'');if(d.indexOf('00971')===0)d=d.slice(2);if(d.indexOf('971')===0)d=d.slice(3);if(d.indexOf('0')===0)d=d.slice(1);d=d.slice(0,9);return d?'+971'+d:'';}
function profile(){try{return JSON.parse(localStorage.getItem('x2_profile')||'{}')}catch(_){return{}}}
function lang(){return (localStorage.getItem('lang')||document.documentElement.lang||'ar')==='en'?'en':'ar'}
function extractToken(raw){try{var o=typeof raw==='string'?JSON.parse(raw):raw;return String((o&&o.access_token)||(o&&o.currentSession&&o.currentSession.access_token)||(o&&o.session&&o.session.access_token)||(o&&o.data&&o.data.session&&o.data.session.access_token)||'').trim()}catch(_){return''}}
function currentUserToken(){
 try{
  var d=String(localStorage.getItem('x2_token')||'').trim(); if(d&&d.split('.').length===3)return d;
  var keys=['sb-knleehjjejfeobcmpwnw-auth-token','supabase.auth.token'];
  for(var i=0;i<keys.length;i++){var t=extractToken(localStorage.getItem(keys[i]));if(t&&t.split('.').length===3)return t;}
  for(var n=0;n<localStorage.length;n++){var k=localStorage.key(n)||'';if(/^sb-.*-auth-token$/.test(k)){var z=extractToken(localStorage.getItem(k));if(z&&z.split('.').length===3)return z;}}
 }catch(_){}
 return '';
}
async function save(sub){
 var p256dh=sub.getKey('p256dh'),auth=sub.getKey('auth');if(!p256dh||!auth)return false;
 var p=profile(),token=currentUserToken()||SUPABASE_ANON_KEY;
 var r=await fetch(SUPABASE_URL+'/functions/v1/push-register',{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,p256dh:btoa(String.fromCharCode.apply(null,new Uint8Array(p256dh))),auth:btoa(String.fromCharCode.apply(null,new Uint8Array(auth))),user_phone:phone(p.phone||''),user_email:String(p.email||p.authEmail||'').trim().toLowerCase(),user_lang:lang(),vapid_public_key:VAPID_PUBLIC_KEY})});
 var txt=await r.text();console.log('[BARIQ_PUSH] register',r.status,txt);if(!r.ok)return false;localStorage.setItem(MARKER,VAPID_VERSION);return true;
}
async function ensure(force){
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)||Notification.permission!=='granted')return null;
 var reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription(),markerOk=localStorage.getItem(MARKER)===VAPID_VERSION;
 if((force||!markerOk)&&sub){await sub.unsubscribe().catch(function(){});sub=null;}
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toKey(VAPID_PUBLIC_KEY)});
 if(!(await save(sub))){await sub.unsubscribe().catch(function(){});return null;}return sub;
}
async function subscribeToPush(){if(Notification.permission==='default')await Notification.requestPermission();return ensure(true)}
async function getPushStatus(){if(!('serviceWorker'in navigator)||!('PushManager'in window))return'unsupported';if(Notification.permission==='denied')return'denied';if(Notification.permission!=='granted')return'unsubscribed';var reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();return sub&&localStorage.getItem(MARKER)===VAPID_VERSION?'subscribed':'stale'}
async function unsubscribeFromPush(){var reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();localStorage.removeItem(MARKER)}
window.subscribeToPush=subscribeToPush;window.getPushStatus=getPushStatus;window.unsubscribeFromPush=unsubscribeFromPush;window.ensureBariqPush=ensure;
(async function(){if('serviceWorker'in navigator){await navigator.serviceWorker.register(SERVICE_WORKER_URL,{updateViaCache:'none'});await navigator.serviceWorker.ready;}if(Notification.permission==='granted')await ensure(false).catch(console.error);})();
})();