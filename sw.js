/* Service Worker - بريق PWA */
const CACHE = 'bariq-v15';
let _badgeCount = 0;
const STATIC_URLS = [
  '/',
  '/categories',
  '/product',
  '/Cart',
  '/account',
  '/login',
  '/offers',
  '/checkout',
  '/assets/logo.webp',
  '/assets/icon w.webp',
  '/assets/cairo-arabic.woff2',
  '/assets/cairo-latin.woff2',
  '/style/style.css',
  '/java/main.min.js',
  '/java/Products.min.js',
  '/java/Cart.min.js',
  '/java/supabase.min.js',
  '/java/footer-pages.min.js',
  '/java/notifications.min.js',
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

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.allSettled(STATIC_URLS.map(url => c.add(url).catch(() => {})));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  const url = e.request.url;
  if (url.includes('supabase.co') || url.includes('/rest/') || url.includes('/auth/') || url.includes('/storage/')) return;
  if (e.request.method !== 'GET') return;

  function refreshCache(cache, request) {
    return fetch(new Request(request, { cache: 'reload' })).then(function(res) {
      if (res.ok) cache.put(request, res.clone());
      return res;
    });
  }

  const isHtml = e.request.destination === 'document'
    || url.endsWith('.html')
    || /\/(categories|product|Cart|account|login|offers|checkout|affiliate|policy|admin)$/.test(new URL(url).pathname)
    || new URL(url).pathname === '/';
  const isAsset = url.includes('/style/') || url.includes('/java/') || url.includes('/translations/') || url.includes('/mobile-nav-bar/');

  // HTML: cache-first for instant page transitions, with background refresh after deploys.
  if (isHtml) {
    e.respondWith(
      caches.open(CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          const fresh = refreshCache(cache, e.request).catch(function() {
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
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(function() {
        return caches.match('/index.html') || new Response('Offline', {status: 503});
      });
    })
  );
});

/* ===================== Push Notifications ===================== */
self.addEventListener('push', function(e) {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {
    data = { title: 'بريق', body: e.data ? e.data.text() : '' };
  }
  const title   = data.title || 'بريق 🛍️';
  const options = {
    body:    data.body   || '',
    icon:    data.icon   || '/assets/icon w.png',
    badge:   '/assets/icon b.png',
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
      // زيادة العداد وتحديث أيقونة التطبيق
      _badgeCount++;
      if ('setAppBadge' in self.registration) {
        await self.registration.setAppBadge(_badgeCount).catch(() => {});
      }
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  // تصفير العداد عند الضغط على الإشعار
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

/* Badge count sync من الصفحة */
self.addEventListener('message', function(e) {
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
  }
});
