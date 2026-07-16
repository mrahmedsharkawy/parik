/* ============================================================
   Bariq – Web Push Notifications
   ============================================================ */

const VAPID_PUBLIC_KEY = 'BPojY-23BXbIfa1IRkkQD3vAELjTn3nltgFBrlEIjZ3aEbphXAQvFY2E5B2R_mfikZLhGPo0lBeCedB8qoP5-SE';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ========== تسجيل Service Worker ==========
async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch(e) { return null; }
}

// ========== الاشتراك ==========
async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    await saveSubscriptionToSupabase(sub);
    updateBadge(0);
    return sub;
  } catch(err) {
    console.warn('Push subscription failed:', err);
    return null;
  }
}

// ========== حفظ الاشتراك في Supabase ==========
async function saveSubscriptionToSupabase(sub) {
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E';
  const URL  = 'https://knleehjjejfeobcmpwnw.supabase.co/rest/v1/push_subscriptions';
  try {
    const profile = (() => { try { return JSON.parse(localStorage.getItem('x2_profile')||'{}'); }catch(e){return{};} })();
    const p256dh = sub.getKey('p256dh');
    const auth   = sub.getKey('auth');
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'apikey': ANON,
        'Authorization': 'Bearer ' + ANON,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        endpoint:   sub.endpoint,
        p256dh:     p256dh ? btoa(String.fromCharCode(...new Uint8Array(p256dh))) : '',
        auth:       auth   ? btoa(String.fromCharCode(...new Uint8Array(auth)))   : '',
        user_phone: profile.phone || '',
        user_email: profile.email || '',
        created_at: new Date().toISOString()
      })
    });
    return res.ok;
  } catch(e) {
    console.warn('Failed to save subscription:', e);
    return false;
  }
}

// ========== إلغاء الاشتراك ==========
async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  clearBadge();
}

// ========== Badge API ==========
function updateBadge(count) {
  if ('setAppBadge' in navigator) {
    count > 0 ? navigator.setAppBadge(count).catch(()=>{}) : navigator.clearAppBadge().catch(()=>{});
  }
}
function clearBadge() { updateBadge(0); }

// ========== حالة الاشتراك ==========
async function getPushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'subscribed' : 'unsubscribed';
}

// ========== زر الاشتراك ==========
async function initPushButton() {
  const btn = document.getElementById('push-subscribe-btn');
  if (!btn) return;
  const status = await getPushStatus();
  if (status === 'unsupported') { btn.style.display='none'; return; }
  if (status === 'subscribed') {
    btn.innerHTML = '🔔 الإشعارات مفعّلة';
    btn.style.cssText += ';background:#27ae60;color:#fff';
    btn.onclick = async () => {
      await unsubscribeFromPush();
      btn.innerHTML = '🔕 تفعيل الإشعارات';
      btn.style.background = '';
    };
  } else {
    btn.innerHTML = '🔕 تفعيل الإشعارات';
    btn.onclick = async () => {
      btn.disabled = true; btn.innerHTML = '⏳...';
      const sub = await subscribeToPush();
      if (sub) { btn.innerHTML='🔔 مفعّل ✅'; btn.style.cssText+=';background:#27ae60;color:#fff'; }
      else { btn.innerHTML='🔕 تفعيل الإشعارات'; btn.disabled=false; }
    };
  }
  btn.style.display = 'inline-flex';
}

// ========== تشغيل ==========
(async () => {
  await registerSW();
  initPushButton();
  // badge مع عدد الطلبات الجديدة
  try {
    const orders = JSON.parse(localStorage.getItem('x2_orders')||'[]');
    const unseen = orders.filter(o => !o.seen).length;
    if (unseen > 0) updateBadge(unseen);
  } catch(e) {}
})();
