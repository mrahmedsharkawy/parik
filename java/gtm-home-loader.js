(function (w, d, s, l, i) {
  function isTagDebugSession() {
    try {
      var qs = new URLSearchParams(w.location.search || '');
      if (qs.has('gtm_debug') || qs.has('gtm_preview') || qs.has('gtm_auth') || qs.has('gtm_cookies_win')) return true;
      var ref = String(d.referrer || '');
      return /tagassistant\.google\.com|googletagmanager\.com/i.test(ref);
    } catch (e) {
      return false;
    }
  }

  function boot() {
    if (w.__x2GtmBooted) return;
    w.__x2GtmBooted = true;

    w[l] = w[l] || [];
    w[l].push({
      'gtm.start': new Date().getTime(),
      event: 'gtm.js'
    });

    var src = 'https://www.googletagmanager.com/gtm.js?id=' + i + (l !== 'dataLayer' ? '&l=' + l : '');
    if (d.querySelector('script[src*="googletagmanager.com/gtm.js?id=' + i + '"]')) return;

    var firstScript = d.getElementsByTagName(s)[0];
    var tag = d.createElement(s);
    tag.async = true;
    tag.src = src;
    firstScript.parentNode.insertBefore(tag, firstScript);
  }

  function once() {
    boot();
    for (var idx = 0; idx < events.length; idx++) {
      w.removeEventListener(events[idx], once, opts);
    }
  }

  var events = ['pointerdown', 'touchstart', 'scroll', 'keydown'];
  var opts = { passive: true, capture: true };

  for (var j = 0; j < events.length; j++) {
    w.addEventListener(events[j], once, opts);
  }

  if (isTagDebugSession()) {
    boot();
    return;
  }

  if (d.readyState === 'complete' || d.readyState === 'interactive') {
    boot();
  } else {
    d.addEventListener('DOMContentLoaded', function () {
      boot();
    }, { once: true });
  }

  w.addEventListener('load', function () {
    boot();
  }, { once: true });
})(window, document, 'script', 'dataLayer', 'GTM-PR8J7RM7');
