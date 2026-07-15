/* Service Worker - بريق PWA */
const CACHE = 'bariq-v1';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/assets/logo.png',
  '/style/style.css',
  '/translations/translation.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.addAll(OFFLINE_URLS).catch(function(){});
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
  // تجاهل طلبات Supabase وغيرها من الـ APIs
  if (e.request.url.includes('supabase.co') || e.request.url.includes('/rest/') || e.request.url.includes('/auth/')) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || caches.match('/index.html');
      });
    })
  );
});
