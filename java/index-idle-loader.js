(function () {
  if (window.__x2IndexIdleLoaderBooted) return;
  window.__x2IndexIdleLoaderBooted = true;

  var scripts = [
    '/java/visitor-location-sync.js?v=visitor-location-sync-20260803',
    '/java/sw-refresh.js?v=sw-refresh-gtm-preview-20260805',
    '/java/instant-nav.js?v=instant-nav-20260728e',
    '/java/footer-pages.min.js?v=footer-pages-20260723',
    '/java/push-welcome.js?v=push-welcome-20260806-hardened',
    '/java/notifications.js?v=notifications-20260806-hardened',
    '/java/abandoned-cart.js?v=abandoned-cart-20260730a',
    '/java/index-campaign-popup.js?v=coupon-popup-20260804'
  ];

  function loadScript(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.body.appendChild(script);
  }

  function boot() {
    if (boot.done) return;
    boot.done = true;
    for (var i = 0; i < scripts.length; i++) loadScript(scripts[i]);
  }

  function scheduleBoot() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(boot, { timeout: 1800 });
    } else {
      setTimeout(boot, 1400);
    }
  }

  // First interaction: load helpers immediately after user intent.
  function onInteract() {
    boot();
    window.removeEventListener('pointerdown', onInteract, true);
    window.removeEventListener('touchstart', onInteract, true);
    window.removeEventListener('keydown', onInteract, true);
    window.removeEventListener('scroll', onInteract, true);
  }

  window.addEventListener('pointerdown', onInteract, { capture: true, passive: true });
  window.addEventListener('touchstart', onInteract, { capture: true, passive: true });
  window.addEventListener('keydown', onInteract, { capture: true, passive: true });
  window.addEventListener('scroll', onInteract, { capture: true, passive: true });

  if (document.readyState === 'complete') {
    scheduleBoot();
  } else {
    window.addEventListener('load', scheduleBoot, { once: true });
  }
})();
