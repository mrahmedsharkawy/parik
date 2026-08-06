(function(){
  if (!window.trustedTypes || window.trustedTypes.defaultPolicy) return;
  try {
    window.trustedTypes.createPolicy('default', {
      createHTML: function(value) { return String(value); },
      createScript: function(value) { return String(value); },
      createScriptURL: function(value) { return String(value); }
    });
  } catch (e) {}
})();

(function () {
  var KEYS = ['gtm_debug', 'gtm_preview', 'gtm_auth', 'gtm_cookies_win'];
  var STORE_KEY = 'x2_gtm_preview_qs';

  function stripPreviewParamsFromCurrentUrl() {
    try {
      var url = new URL(location.href);
      var changed = false;
      KEYS.forEach(function (key) {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          changed = true;
        }
      });
      if (changed) history.replaceState(history.state, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch (e) {}
  }

  function readPreviewParams() {
    try {
      var params = new URLSearchParams(location.search);
      var out = new URLSearchParams();
      KEYS.forEach(function (key) {
        if (params.has(key)) out.set(key, params.get(key));
      });
      if (out.get('gtm_auth') === 'testauth') {
        try { sessionStorage.removeItem(STORE_KEY); } catch (e) {}
        stripPreviewParamsFromCurrentUrl();
        return '';
      }
      return out.toString();
    } catch (e) {
      return '';
    }
  }

  function getActivePreviewQuery() {
    var live = readPreviewParams();
    if (live) {
      try { sessionStorage.setItem(STORE_KEY, live); } catch (e) {}
      return live;
    }
    try {
      var stored = sessionStorage.getItem(STORE_KEY) || '';
      if (stored.indexOf('gtm_auth=testauth') >= 0) return '';
      return stored;
    } catch (e) {
      return '';
    }
  }

  function mergePreviewParamsIntoUrl(rawHref, previewQuery) {
    if (!previewQuery || !rawHref) return rawHref;
    try {
      var url = new URL(rawHref, location.href);
      if (url.origin !== location.origin) return rawHref;
      if (!/^https?:$/.test(url.protocol)) return rawHref;
      var preview = new URLSearchParams(previewQuery);
      preview.forEach(function (value, key) {
        if (!url.searchParams.has(key)) url.searchParams.set(key, value);
      });
      return url.pathname + url.search + url.hash;
    } catch (e) {
      return rawHref;
    }
  }

  var previewQuery = getActivePreviewQuery();
  if (!previewQuery) return;

  document.addEventListener('click', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor) return;
    var href = anchor.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    var updated = mergePreviewParamsIntoUrl(href, previewQuery);
    if (updated && updated !== href) anchor.setAttribute('href', updated);
  }, true);
})();

(function () {
  if (document.querySelector('script[data-x2-tracking-bridge="1"]')) return;
  var script = document.createElement('script');
  script.src = '/java/google-tag-bridge.js?v=20260806b';
  script.defer = true;
  script.setAttribute('data-x2-tracking-bridge', '1');
  (document.head || document.documentElement).appendChild(script);
})();
