const VAPID_PUBLIC_KEY = "BMr4ZWTwS2DgL12mxYFjLM9rmnljnJpY_tsFtWtKxgS2d_z36lcg3sLfIQfOFbX1Tw0ITNG3pB4hJeGI-YEZFHE";
const VAPID_VERSION = "vapid-BMr4-20260822-r2";
const SERVICE_WORKER_URL = "/sw.js?v=409-push-register";
const SUPABASE_URL = "https://knleehjjejfeobcmpwnw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E";

const MARKER = "bariq_push_vapid_version";

function toKey(v){
  const p=v+"=".repeat((4-v.length%4)%4);
  const b=atob(p.replace(/-/g,"+").replace(/_/g,"/"));
  return Uint8Array.from([...b].map(c=>c.charCodeAt(0)));
}

function phone(v){
  let d=String(v||"").replace(/\D/g,"");
  if(d.startsWith("00971"))d=d.slice(2);
  if(d.startsWith("971"))d=d.slice(3);
  if(d.startsWith("0"))d=d.slice(1);
  d=d.slice(0,9);
  return d?"+971"+d:"";
}

function profile(){
  try{return JSON.parse(localStorage.getItem("x2_profile")||"{}")}catch(_){return{}}
}

function lang(){return (localStorage.getItem("lang")||document.documentElement.lang||"ar")==="en"?"en":"ar"}

async function save(sub){
  const p256dh=sub.getKey("p256dh"), auth=sub.getKey("auth");
  if(!p256dh||!auth) return false;
  const p=profile();
  const r=await fetch(SUPABASE_URL+"/functions/v1/push-register",{
    method:"POST",
    headers:{
      apikey:SUPABASE_ANON_KEY,
      Authorization:"Bearer "+SUPABASE_ANON_KEY,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      endpoint:sub.endpoint,
      p256dh:btoa(String.fromCharCode(...new Uint8Array(p256dh))),
      auth:btoa(String.fromCharCode(...new Uint8Array(auth))),
      user_phone:phone(p.phone||""),
      user_email:String(p.email||p.authEmail||"").trim().toLowerCase(),
      user_lang:lang(),
      vapid_public_key:VAPID_PUBLIC_KEY
    })
  });
  const t=await r.text();
  console.log("[BARIQ_PUSH] register",r.status,t);
  if(!r.ok)return false;
  localStorage.setItem(MARKER,VAPID_VERSION);
  return true;
}

async function ensure(force=false){
  if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window))return null;
  if(Notification.permission!=="granted")return null;
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  const markerOk=localStorage.getItem(MARKER)===VAPID_VERSION;
  if((force||!markerOk)&&sub){
    await sub.unsubscribe().catch(()=>{});
    sub=null;
  }
  if(!sub){
    sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toKey(VAPID_PUBLIC_KEY)});
  }
  if(!(await save(sub))){
    await sub.unsubscribe().catch(()=>{});
    return null;
  }
  return sub;
}

async function subscribeToPush(){
  if(Notification.permission==="default")await Notification.requestPermission();
  return ensure(true);
}

async function getPushStatus(){
  if(!("serviceWorker"in navigator)||!("PushManager"in window))return"unsupported";
  if(Notification.permission==="denied")return"denied";
  if(Notification.permission!=="granted")return"unsubscribed";
  const reg=await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.getSubscription();
  return sub&&localStorage.getItem(MARKER)===VAPID_VERSION?"subscribed":"stale";
}

async function unsubscribeFromPush(){
  const reg=await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.getSubscription();
  if(sub)await sub.unsubscribe();
  localStorage.removeItem(MARKER);
}

async function initPushButton(){
  const buttons=document.querySelectorAll("#push-subscribe-btn");
  if(!buttons.length)return;
  async function draw(){
    const s=await getPushStatus();
    buttons.forEach(b=>{b.textContent=s==="subscribed"?"🔔 الإشعارات مفعلة":"🔔 تفعيل الإشعارات"});
  }
  buttons.forEach(b=>b.onclick=async()=>{
    const s=await getPushStatus();
    if(s==="subscribed")await unsubscribeFromPush(); else await subscribeToPush();
    await draw();
  });
  await draw();
}

(async()=>{
  if("serviceWorker"in navigator){
    await navigator.serviceWorker.register(SERVICE_WORKER_URL,{updateViaCache:"none"});
    await navigator.serviceWorker.ready;
  }
  if(Notification.permission==="granted")await ensure(false).catch(console.error);
  await initPushButton();
})();
