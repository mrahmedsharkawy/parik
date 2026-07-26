(function () {
  if (!('serviceWorker' in navigator)) return;

  var REFRESH_KEY = 'sw-v186-global-refresh';
  var refreshed = false;

  function clearOldCaches() {
    if (!('caches' in window)) return;
    caches.keys().then(function (keys) {
      keys.forEach(function (key) {
        if (key !== 'bariq-v198') caches.delete(key).catch(function () {});
      });
    }).catch(function () {});
  }

  function markRefreshed() {
    try {
      if (sessionStorage.getItem(REFRESH_KEY) === '1') return true;
      sessionStorage.setItem(REFRESH_KEY, '1');
    } catch (e) {}
    return false;
  }

  function requestActivation(reg) {
    if (!reg) return;
    if (reg.waiting) {
      try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
    }
    if (reg.installing) {
      reg.installing.addEventListener('statechange', function () {
        if (reg.installing && reg.installing.state === 'installed' && navigator.serviceWorker.controller) {
          try { reg.installing.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
        }
      });
    }
    reg.addEventListener('updatefound', function () {
      if (!reg.installing) return;
      reg.installing.addEventListener('statechange', function () {
        if (reg.installing && reg.installing.state === 'installed' && navigator.serviceWorker.controller) {
          try { reg.installing.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
        }
      });
    });
  }

  function getCurrentPushLanguage() {
    return (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar';
  }

  function sendPushLanguage(reg) {
    try {
      var msg = { type: 'SET_PUSH_LANG', lang: getCurrentPushLanguage() };
      if (reg && reg.active) reg.active.postMessage(msg);
      if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage(msg);
      navigator.serviceWorker.ready.then(function (readyReg) {
        if (readyReg && readyReg.active) readyReg.active.postMessage(msg);
      }).catch(function () {});
    } catch (e) {}
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshed) return;
    refreshed = true;
    if (markRefreshed()) return;
    location.reload();
  });

  navigator.serviceWorker.register('/sw.js?v=186', { updateViaCache: 'none' }).then(function (reg) {
    clearOldCaches();
    requestActivation(reg);
    sendPushLanguage(reg);
    reg.update().catch(function () {});
  }).catch(function () {});
  window.addEventListener('bariq:languagechange', function () { sendPushLanguage(); });
})();
