(function () {
  'use strict';

  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E';
  var API = 'https://knleehjjejfeobcmpwnw.supabase.co/rest/v1/abandoned_carts';
  var REMINDER_DELAY_MINUTES = 45;
  var DEBOUNCE_MS = 1200;
  var MIN_SYNC_GAP_MS = 4 * 60 * 1000;
  var syncTimer = 0;
  var lastSyncKey = '';
  var lastSyncAt = 0;

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function readCart() {
    var cart = readJson('x2_cart', []);
    return Array.isArray(cart) ? cart.filter(Boolean) : [];
  }

  function getLang() {
    return (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar';
  }

  function getCurrency() {
    try {
      return localStorage.getItem('currency') || (typeof window.getSelectedCurrency === 'function' ? window.getSelectedCurrency() : '') || 'AED';
    } catch (e) {
      return 'AED';
    }
  }

  function normalizePhone(value) {
    var digits = String(value || '').replace(/\D/g, '');
    if (digits.indexOf('00971') === 0) digits = digits.slice(2);
    if (digits.indexOf('971') === 0) digits = digits.slice(3);
    if (digits.indexOf('0') === 0) digits = digits.slice(1);
    digits = digits.slice(0, 9);
    return digits ? '+971' + digits : '';
  }

  function pickName(item) {
    var value = item && (item.name || item.title || item.productName || item.nameAr || item.arName);
    if (value && typeof value === 'object') value = value[getLang()] || value.ar || value.en || '';
    return String(value || '').trim().slice(0, 120);
  }

  function pickImage(item) {
    var value = item && (item.img || item.image || item.photo || item.thumbnail || item.cover || item.imageUrl);
    if (Array.isArray(value)) value = value[0];
    return String(value || '').trim().slice(0, 600);
  }

  function itemQty(item) {
    return Math.max(1, Number(item && (item.qty || item.quantity || item.count)) || 1);
  }

  function itemPrice(item) {
    var raw = item && (item.priceValue || item.price || item.salePrice || item.finalPrice || 0);
    if (typeof raw === 'string') raw = raw.replace(/[^\d.\-]/g, '');
    return Math.max(0, Number(raw) || 0);
  }

  function cartSummary(items) {
    var count = items.reduce(function (sum, item) { return sum + itemQty(item); }, 0);
    var total = items.reduce(function (sum, item) { return sum + itemQty(item) * itemPrice(item); }, 0);
    var first = items[0] || {};
    var hash = items.map(function (item) {
      return [item.id || item.productId || item.sku || pickName(item), itemQty(item), itemPrice(item)].join(':');
    }).join('|');
    return {
      count: count,
      total: Math.round(total * 100) / 100,
      firstName: pickName(first),
      firstImage: pickImage(first),
      hash: hash
    };
  }

  async function getCurrentSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return null;
    if (Notification.permission !== 'granted') return null;
    try {
      var reg = await navigator.serviceWorker.ready;
      return reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
    } catch (e) {
      return null;
    }
  }

  function headers() {
    return {
      apikey: ANON_KEY,
      Authorization: 'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    };
  }

  async function clearAbandonedCart(sub) {
    if (!sub || !sub.endpoint) return;
    try {
      await fetch(API + '?endpoint=eq.' + encodeURIComponent(sub.endpoint), {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          status: 'cleared',
          updated_at: new Date().toISOString()
        })
      });
      lastSyncKey = '';
    } catch (e) {}
  }

  async function upsertAbandonedCart(sub, items) {
    if (!sub || !sub.endpoint || !items.length) return;
    var summary = cartSummary(items);
    if (!summary.count) return clearAbandonedCart(sub);

    var now = Date.now();
    var syncKey = sub.endpoint + '|' + summary.hash + '|' + summary.count;
    if (syncKey === lastSyncKey && now - lastSyncAt < MIN_SYNC_GAP_MS) return;

    var profile = readJson('x2_profile', {});
    var scheduled = new Date(now + REMINDER_DELAY_MINUTES * 60 * 1000).toISOString();
    var payload = {
      endpoint: sub.endpoint,
      user_phone: normalizePhone(profile.phone || ''),
      user_email: String(profile.email || profile.authEmail || '').trim().toLowerCase(),
      user_lang: getLang(),
      cart_count: summary.count,
      cart_total: summary.total,
      cart_currency: getCurrency(),
      first_product_name: summary.firstName,
      first_product_image: summary.firstImage,
      cart_hash: summary.hash,
      status: 'pending',
      scheduled_at: scheduled,
      last_cart_at: new Date(now).toISOString(),
      notified_at: null,
      send_attempts: 0,
      last_error: '',
      updated_at: new Date(now).toISOString()
    };

    try {
      await fetch(API + '?on_conflict=endpoint', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload)
      });
      lastSyncKey = syncKey;
      lastSyncAt = now;
    } catch (e) {}
  }

  async function syncAbandonedCart() {
    var items = readCart();
    var sub = await getCurrentSubscription();
    if (!sub) return;
    if (!items.length) return clearAbandonedCart(sub);
    return upsertAbandonedCart(sub, items);
  }

  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      syncTimer = 0;
      syncAbandonedCart();
    }, DEBOUNCE_MS);
  }

  function patchLocalStorage() {
    try {
      var originalSetItem = localStorage.setItem;
      var originalRemoveItem = localStorage.removeItem;
      if (!localStorage.__x2AbandonedCartPatched) {
        Object.defineProperty(localStorage, '__x2AbandonedCartPatched', { value: true, configurable: false });
        localStorage.setItem = function (key, value) {
          var result = originalSetItem.apply(this, arguments);
          if (key === 'x2_cart') scheduleSync();
          return result;
        };
        localStorage.removeItem = function (key) {
          var result = originalRemoveItem.apply(this, arguments);
          if (key === 'x2_cart') scheduleSync();
          return result;
        };
      }
    } catch (e) {}
  }

  window.addEventListener('cart:updated', scheduleSync);
  window.addEventListener('cart:persisted', scheduleSync);
  window.addEventListener('storage', function (event) {
    if (event.key === 'x2_cart' || event.key === 'x2_profile' || event.key === 'lang') scheduleSync();
  });
  window.addEventListener('pageshow', scheduleSync);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' || document.visibilityState === 'visible') scheduleSync();
  });

  patchLocalStorage();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
  else scheduleSync();
})();
