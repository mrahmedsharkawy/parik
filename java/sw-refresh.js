(function () {
  if (!('serviceWorker' in navigator)) return;

  function requestActivation(reg) {
    if (!reg) return;
    function skipWaitingWhenInstalled(worker) {
      if (!worker) return;
      worker.addEventListener('statechange', function () {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
        }
      });
    }
    if (reg.waiting) {
      try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
    }
    skipWaitingWhenInstalled(reg.installing);
    reg.addEventListener('updatefound', function () {
      skipWaitingWhenInstalled(reg.installing);
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

  // The service worker uses skipWaiting + clients.claim, so a forced reload here
  // would blank the page mid-navigation (breaks iOS swipe-back).
  navigator.serviceWorker.register('/sw.js?v=317', { updateViaCache: 'none' }).then(function (reg) {
    requestActivation(reg);
    sendPushLanguage(reg);
    reg.update().catch(function () {});
  }).catch(function () {});
  window.addEventListener('bariq:languagechange', function () { sendPushLanguage(); });
})();
