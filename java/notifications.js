/* ============================================================
   Bariq – Web Push Notifications
   ضع VAPID Public Key الخاص بك أدناه
   لإنشاء مفاتيح جديدة: npx web-push generate-vapid-keys
   ============================================================ */

const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

// ========== تحويل المفتاح لـ Uint8Array ==========
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ========== طلب الإذن والاشتراك ==========
async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    // طلب إذن الإشعارات
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    // الاشتراك
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // حفظ الاشتراك في Supabase
    await saveSubscriptionToSupabase(sub);
    // تحديث badge
    updateBadge();
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
    await fetch(URL, {
      method: 'POST',
      headers: {
        'apikey': ANON,
        'Authorization': 'Bearer ' + ANON,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        endpoint:    sub.endpoint,
        p256dh:      btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
        auth:        btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
        user_phone:  profile.phone || '',
        user_email:  profile.email || '',
        created_at:  new Date().toISOString()
      })
    });
  } catch(e) {
    // حفظ محلياً كـ fallback
    const subs = JSON.parse(localStorage.getItem('push_subscriptions') || '[]');
    subs.push({ endpoint: sub.endpoint, sub: sub.toJSON(), date: new Date().toISOString() });
    localStorage.setItem('push_subscriptions', JSON.stringify(subs));
  }
}

// ========== إلغاء الاشتراك ==========
async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) { await sub.unsubscribe(); }
  clearBadge();
}

// ========== Badge API ==========
function updateBadge(count) {
  if ('setAppBadge' in navigator) {
    if (count && count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }
  // إرسال للـ Service Worker أيضاً
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: count > 0 ? 'SET_BADGE' : 'CLEAR_BADGE',
      count: count || 0
    });
  }
}

function clearBadge() { updateBadge(0); }

// ========== التحقق من حالة الاشتراك ==========
async function getPushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  const permission = Notification.permission;
  if (permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'subscribed' : 'unsubscribed';
}

// ========== عرض زر الاشتراك ==========
async function initPushButton() {
  const btn = document.getElementById('push-subscribe-btn');
  if (!btn) return;

  const status = await getPushStatus();
  if (status === 'unsupported') { btn.style.display = 'none'; return; }

  if (status === 'subscribed') {
    btn.innerHTML = '🔔 الإشعارات مفعّلة';
    btn.style.background = '#27ae60';
    btn.onclick = async () => {
      await unsubscribeFromPush();
      btn.innerHTML = '🔕 تفعيل الإشعارات';
      btn.style.background = '';
    };
  } else {
    btn.innerHTML = '🔕 تفعيل الإشعارات';
    btn.onclick = async () => {
      btn.disabled = true;
      btn.innerHTML = '⏳ جارٍ التفعيل...';
      const sub = await subscribeToPush();
      if (sub) {
        btn.innerHTML = '🔔 الإشعارات مفعّلة';
        btn.style.background = '#27ae60';
      } else {
        btn.innerHTML = '🔕 تفعيل الإشعارات';
        btn.disabled = false;
      }
    };
  }
  btn.style.display = 'inline-flex';
}

// ========== مزامنة Badge مع عدد الطلبات الجديدة ==========
function syncBadgeWithOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem('x2_orders') || '[]');
    const unseen = orders.filter(o => !o.seen).length;
    if (unseen > 0) updateBadge(unseen);
    else clearBadge();
  } catch(e) {}
}

// تشغيل عند تحميل الصفحة
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPushButton);
} else {
  initPushButton();
}
syncBadgeWithOrders();
