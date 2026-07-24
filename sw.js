/* Service Worker - Bariq PWA */
const CACHE = 'bariq-v152';
let _badgeCount = 0;
const STATIC_URLS = [
  '/',
  '/categories',
  '/categories.html',
  '/product',
  '/product.html',
  '/Cart',
  '/Cart.html',
  '/account',
  '/account.html',
  '/login',
  '/login.html',
  '/offers',
  '/offers.html',
  '/checkout',
  '/checkout.html',
  '/affiliate',
  '/affiliate.html',
  '/policy',
  '/policy.html',
  '/assets/logo.png',
  '/assets/icon.png',
  '/assets/icon-96.png',
  '/assets/cairo-arabic.woff2',
  '/assets/cairo-latin.woff2',
  '/style/style.css',
  '/java/auth-reset.js',
  '/java/main.min.js',
  '/java/Products.min.js',
  '/java/Cart.min.js',
  '/java/supabase.min.js',
  '/java/footer-pages.min.js',
  '/java/notifications.min.js',
  '/java/push-welcome.js',
  '/translations/translation.min.js',
  '/translations/ar.json',
  '/translations/en.json',
  '/mobile-nav-bar/main-navbar.min.js',
  '/mobile-nav-bar/navbar.html',
  '/mobile-nav-bar/styles.css',
  '/assets/home/1.webp',
  '/assets/home/2.webp',
  '/assets/categories/Acrylic/Born in.webp',
  '/assets/categories/Acrylic/Box.webp',
  '/assets/categories/Acrylic/censer.webp',
  '/assets/categories/Acrylic/Stand.webp',
  '/assets/categories/Acrylic/Tables.webp',
  '/assets/categories/Acrylic/Trays.webp',
  '/assets/categories/Forex/models.webp',
  '/assets/categories/Forex/rotations.webp',
  '/assets/categories/Forex/stands.webp',
  '/assets/categories/Forex/tables.webp',
  '/assets/categories/leather/born-in.webp',
  '/assets/categories/leather/boxes.webp',
  '/assets/categories/leather/tables.webp',
  '/assets/categories/leather/trays.webp',
  '/assets/categories/Occasions/Eid.webp',
  '/assets/categories/Occasions/Graduation.webp',
  '/assets/categories/Occasions/Hajj.webp',
  "/assets/categories/Occasions/Haq Al-Laila.webp",
  "/assets/categories/Occasions/Mother's Day.webp",
  '/assets/categories/Occasions/National Day.webp',
  '/assets/categories/paper/Bags.webp',
  '/assets/categories/paper/Cups.webp',
  '/assets/categories/paper/Stickers.webp',
  '/assets/categories/paper/Tissues.webp',
  '/assets/categories/Ramadan/acrylic.webp',
  '/assets/categories/Ramadan/forex.webp',
  '/assets/categories/Ramadan/leather.webp',
  '/assets/categories/Ramadan/wood.webp',
  '/assets/categories/Sticker/born-in.webp',
  '/assets/categories/Sticker/empty.webp',
  '/assets/categories/Sticker/full.webp',
  '/assets/categories/Sticker/occasions.webp',
  '/assets/categories/wood/benches.webp',
  '/assets/categories/wood/cabinets.webp',
  '/assets/categories/wood/chairs.webp',
  '/assets/categories/wood/tables.webp'
];

const PUSH_DB = 'bariq-push-inbox';
const PUSH_STORE = 'notifications';

function openPushDb() {
  return new Promise(function(resolve, reject) {
    const req = indexedDB.open(PUSH_DB, 1);
    req.onupgradeneeded = function() {
      const db = req.result;
      if (!db.objectStoreNames.contains(PUSH_STORE)) db.createObjectStore(PUSH_STORE, { keyPath: 'id' });
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
  });
}

async function savePushInboxItem(item) {
  try {
    const db = await openPushDb();
    await new Promise(function(resolve, reject) {
      const tx = db.transaction(PUSH_STORE, 'readwrite');
      tx.objectStore(PUSH_STORE).put(item);
      tx.oncomplete = resolve;
      tx.onerror = function() { reject(tx.error); };
    });
    db.close();
  } catch(e) {}
}

async function clearPushInbox() {
  try {
    const db = await openPushDb();
    await new Promise(function(resolve, reject) {
      const tx = db.transaction(PUSH_STORE, 'readwrite');
      tx.objectStore(PUSH_STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = function() { reject(tx.error); };
    });
    db.close();
  } catch(e) {}
}

async function closeVisibleNotifications() {
  try {
    const notifications = await self.registration.getNotifications();
    notifications.forEach(notification => notification.close());
  } catch(e) {}
}

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.allSettled(STATIC_URLS.map(function(url) {
        return fetch(new Request(url, { cache: 'reload' })).then(function(res) {
          if (res.ok && !res.redirected && res.type !== 'opaqueredirect') return c.put(url, res.clone());
        }).catch(() => {});
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(pages) {
        pages.forEach(function(client) {
          try { client.navigate(client.url); } catch(e) {}
        });
      });
    })
  );
});

self.addEventListener('fetch', function(e) {
  const url = e.request.url;
  if (url.includes('supabase.co') || url.includes('/rest/') || url.includes('/auth/') || url.includes('/storage/')) return;
  if (e.request.method !== 'GET') return;

  function refreshCache(cache, request, cacheKey) {
    const fetchRequest = cacheKey ? new Request(cacheKey, { cache: 'reload' }) : new Request(request, { cache: 'reload' });
    return fetch(fetchRequest).then(function(res) {
      if (res.ok && !res.redirected && res.type !== 'opaqueredirect') {
        cache.put(cacheKey || request, res.clone()).catch(() => {});
        return res;
      }
      if (cacheKey && !/\.html$/.test(cacheKey)) {
        const htmlKey = cacheKey === '/' ? '/index.html' : (cacheKey === '/Cart' ? '/Cart.html' : cacheKey + '.html');
        return fetch(new Request(htmlKey, { cache: 'reload' })).then(function(htmlRes) {
          if (htmlRes.ok && !htmlRes.redirected && htmlRes.type !== 'opaqueredirect') {
            cache.put(cacheKey, htmlRes.clone()).catch(() => {});
            return htmlRes;
          }
          throw new Error('redirected or missing response skipped');
        });
      }
      throw new Error('redirected or missing response skipped');
      return res;
    });
  }

  function htmlCachePath(path) {
    if (path === '/' || path === '' || path === '/index.html') return '/';
    if (path === '/Cart' || path === '/Cart.html') return '/Cart';
    if (path === '/product' || path === '/product.html' || /^\/product\//.test(path)) return '/product';
    if (/\.html$/.test(path)) return path.replace(/\.html$/, '');
    return path;
  }

  const isHtml = e.request.destination === 'document'
    || url.endsWith('.html')
    || /\/(categories|product|Cart|account|login|offers|checkout|affiliate|policy|admin)$/.test(new URL(url).pathname)
    || new URL(url).pathname === '/';
  const isAsset = url.includes('/style/') || url.includes('/java/') || url.includes('/translations/') || url.includes('/mobile-nav-bar/');
  const path = new URL(url).pathname.replace(/\/index\.html$/, '/') || '/';
  const htmlCacheKey = htmlCachePath(path);

  const isAuthPage = path === '/login' || path === '/login.html';

  // Auth pages must be fresh so signup/login fixes cannot be stuck behind old HTML.
  if (isHtml && isAuthPage) {
    e.respondWith(
      caches.open(CACHE).then(function(cache) {
        return refreshCache(cache, e.request, htmlCacheKey).catch(function() {
          return cache.match(htmlCacheKey).then(function(cached) {
            return cached || caches.match('/index.html') || new Response('Offline', {status: 503});
          });
        });
      })
    );
    return;
  }

  // HTML: cache-first for instant navigation, then refresh in the background.
  if (isHtml) {
    e.respondWith(
      caches.open(CACHE).then(function(cache) {
        return cache.match(htmlCacheKey).then(function(cached) {
          const fresh = refreshCache(cache, e.request, htmlCacheKey).catch(function() {
            return cached || caches.match('/index.html') || new Response('Offline', {status: 503});
          });
          return cached || fresh;
        });
      })
    );
    return;
  }

  // CSS/JS/translations: cache-first for fast mobile rendering, refresh in background.
  if (isAsset) {
    e.respondWith(
      caches.open(CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          const fresh = refreshCache(cache, e.request).catch(function() {
            return cached || new Response('', {status: 503});
          });
          return cached || fresh;
        });
      })
    );
    return;
  }

  // Images/fonts: cache-first (immutable)
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(res) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone).catch(() => {})).catch(() => {});
        return res;
      }).catch(function() {
        return caches.match('/index.html') || new Response('Offline', {status: 503});
      });
    })
  );
});

/* ===================== Push Notifications ===================== */
function hasBrokenNotificationText(value) {
  return /^\s*[\?\s\uFFFD\.]+\s*$/.test(String(value || ''));
}

function isMostlyBrokenNotificationText(value) {
  const text = String(value || '');
  if (!text) return false;
  const brokenCount = (text.match(/[\?\uFFFD]/g) || []).length;
  const letterCount = (text.match(/[A-Za-z\u0600-\u06FF]/g) || []).length;
  return brokenCount >= 3 && brokenCount > letterCount;
}

function extractOrderIdFromNotification(text, tag) {
  const match = String(text || '').match(/#?\s*([A-Z]*-?\d{3,})/i) || String(tag || '').match(/(?:cb|ord)-([A-Z]*-?\d{3,})/i);
  return match ? match[1] : '';
}

function normalizePushNotificationData(data) {
  data = data || {};
  const raw = `${data.title || ''} ${data.body || ''}`;
  const tag = data.tag || data.id || '';
  const orderId = data.orderId || data.order_id || extractOrderIdFromNotification(raw, tag);
  const isCashback = data.type === 'cashback' || /cashback|cash\s*back|كاش|cb-|n-cb/i.test(raw + ' ' + tag) || /\?\.\?/.test(raw);
  const isBroken = isMostlyBrokenNotificationText(raw) || hasBrokenNotificationText(data.title) || hasBrokenNotificationText(data.body);
  if (!isBroken && !isCashback) return data;

  if (isCashback) {
    const amountMatch = raw.match(/(\d+(?:\.\d+)?)/);
    const amount = parseFloat(data.amount || data.cashback || (amountMatch && amountMatch[1]) || 5) || 5;
    return Object.assign({}, data, {
      type: 'cashback',
      iconText: '🤑',
      emoji: '🤑',
      title: '🤑 كاش باك بانتظارك',
      body: `حصلت على ${amount.toFixed(amount % 1 ? 2 : 0)} د.إ كاش باك${orderId ? ` من طلبك رقم ${orderId}` : ''}. سيتم تفعيله بعد اعتماد الطلب.`,
      orderId
    });
  }

  if (orderId) {
    return Object.assign({}, data, {
      type: 'order_status',
      iconText: '🔄',
      emoji: '🔄',
      title: '🔄 طلبك قيد المعالجة',
      body: `جارٍ تجهيز طلبك رقم ${orderId}`,
      orderId
    });
  }

  return Object.assign({}, data, { title: data.title || 'بريق', body: data.body || '' });
}

self.addEventListener('push', function(e) {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {
    data = { title: '\u0628\u0631\u064a\u0642', body: e.data ? e.data.text() : '' };
  }
  data = normalizePushNotificationData(data);
  const title   = data.title || '\u0628\u0631\u064a\u0642';
  const options = {
    body:    data.body   || '',
    icon:    data.icon   || '/assets/icon.png',
    badge:   '/assets/icon.png',
    image:   data.image  || undefined,
    data:    { url: data.url || '/' },
    dir:     'rtl',
    lang:    'ar',
    vibrate: [200, 100, 200],
    tag:     data.tag    || 'bariq-notif',
    renotify: true,
    actions: data.actions || []
  };
  e.waitUntil(
    (async () => {
      // نضمن ظهور الإشعار بالعنوان/الإيموجي الصحيح دائماً حتى لو فشلت
      // خطوات إضافية (حفظ IndexedDB أو تحديث الشارة) — أي خطأ هناك كان
      // يمنع الوصول لـ showNotification فيظهر إشعار المتصفح الافتراضي
      // الإنجليزي بدل رسالتنا العربية.
      try {
        const inboxItem = {
          id: data.id || ('push-' + Date.now()),
          type: data.type || 'push',
          icon: data.iconText || data.emoji || '🔔',
          title: title,
          msg: data.body || '',
          date: data.date || (new Date()).toISOString(),
          read: false,
          orderId: data.orderId || data.order_id || '',
          url: data.url || '/'
        };
        await savePushInboxItem(inboxItem);
        try {
          const pages = await clients.matchAll({ type: 'window', includeUncontrolled: true });
          pages.forEach(client => client.postMessage({ type: 'X2_PUSH_NOTIFICATION', notification: inboxItem }));
        } catch(e2) {}
        // Update the app badge count before showing the notification.
        _badgeCount++;
        if ('setAppBadge' in self.registration) {
          await self.registration.setAppBadge(_badgeCount).catch(() => {});
        }
      } catch(err) {
        // تجاهل أي خطأ هنا — الأهم إظهار الإشعار نفسه بالمحتوى الصحيح
      }
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  // Clear the badge count when the notification is opened.
  _badgeCount = 0;
  if ('clearAppBadge' in self.registration) {
    self.registration.clearAppBadge().catch(() => {});
  }
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (const client of list) {
        if ('focus' in client) { client.navigate(url); return client.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

/* Badge count sync from the page */
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (e.data && e.data.type === 'SET_BADGE') {
    _badgeCount = e.data.count || 0;
    if ('setAppBadge' in self.registration) {
      self.registration.setAppBadge(_badgeCount).catch(() => {});
    }
  }
  if (e.data && e.data.type === 'CLEAR_BADGE') {
    _badgeCount = 0;
    if ('clearAppBadge' in self.registration) {
      self.registration.clearAppBadge().catch(() => {});
    }
    e.waitUntil(closeVisibleNotifications());
  }
  if (e.data && e.data.type === 'CLEAR_PUSH_INBOX') {
    e.waitUntil(Promise.all([clearPushInbox(), closeVisibleNotifications()]));
  }
});
