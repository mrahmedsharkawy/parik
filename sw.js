/* Service Worker - بريق PWA */
const CACHE = 'bariq-v2';
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
