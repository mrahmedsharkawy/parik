(function () {
  if (!('serviceWorker' in navigator)) return;

  var REFRESH_KEY = 'sw-v160-global-refresh';
  var refreshed = false;

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

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshed) return;
    refreshed = true;
    if (markRefreshed()) return;
    location.reload();
  });

  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function (reg) {
    requestActivation(reg);
    reg.update().catch(function () {});
  }).catch(function () {});
})();
