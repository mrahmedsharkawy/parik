/* Service Worker - بريق PWA */
const CACHE = 'bariq-v3';
const STATIC_URLS = [
  '/',
  '/index.html',
  '/categories.html',
  '/product.html',
  '/Cart.html',
  '/account.html',
  '/login.html',
  '/assets/logo.png',
  '/assets/icon w.png',
  '/style/style.css',
  '/java/main.js',
  '/java/Products.js',
  '/java/Cart.js',
  '/java/supabase.js',
  '/translations/translation.js',
  '/mobile-nav-bar/main-navbar.js',
  '/mobile-nav-bar/navbar.html',
  '/mobile-nav-bar/styles.css'
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

  if (e.request.destination === 'document' || url.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(function() {
        return caches.match(e.request).then(r => r || caches.match('/index.html'));
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        fetch(e.request).then(function(fresh) {
          caches.open(CACHE).then(c => c.put(e.request, fresh));
        }).catch(() => {});
        return cached;
      }
      return fetch(e.request).then(function(res) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('/index.html'));
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
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
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

/* Badge count sync */
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SET_BADGE') {
    if ('setAppBadge' in self.registration) {
      self.registration.setAppBadge(e.data.count || 0).catch(() => {});
    }
  }
  if (e.data && e.data.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in self.registration) {
      self.registration.clearAppBadge().catch(() => {});
    }
  }
});

const STATIC_URLS = [
  '/',
  '/index.html',
  '/categories.html',
  '/product.html',
  '/Cart.html',
  '/account.html',
  '/login.html',
  '/assets/logo.png',
  '/assets/icon w.png',
  '/style/style.css',
  '/java/main.js',
  '/java/Products.js',
  '/java/Cart.js',
  '/java/supabase.js',
  '/translations/translation.js',
  '/mobile-nav-bar/main-navbar.js',
  '/mobile-nav-bar/navbar.html',
  '/mobile-nav-bar/styles.css'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      // تخزين مؤقت للملفات الثابتة (CSS/JS/HTML)
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
  // تجاهل طلبات API (Supabase)
  if (url.includes('supabase.co') || url.includes('/rest/') || url.includes('/auth/') || url.includes('/storage/')) return;
  if (e.request.method !== 'GET') return;

  // استراتيجية Network First للـ HTML (دائماً أحدث نسخة)
  if (e.request.destination === 'document' || url.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        // حدّث الكاش بالنسخة الجديدة
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(function() {
        // Offline: أعطِ النسخة المخزّنة
        return caches.match(e.request).then(r => r || caches.match('/index.html'));
      })
    );
    return;
  }

  // استراتيجية Cache First للـ CSS/JS/الصور (أسرع تحميل)
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        // حدّث الكاش في الخلفية (stale-while-revalidate)
        fetch(e.request).then(function(fresh) {
          caches.open(CACHE).then(c => c.put(e.request, fresh));
        }).catch(() => {});
        return cached;
      }
      return fetch(e.request).then(function(res) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
