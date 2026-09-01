(function () {
  var SUPABASE_URL = 'https://knleehjjejfeobcmpwnw.supabase.co';
  var SUPABASE_ANON = 'sb_publishable_VPSO9nbXg5eVNMj03KpgdA_VSOuMDHw';

  function normalizeGoogleId(value) {
    var id = String(value || localStorage.getItem('x2_ga_id') || '').trim();
    return /^(G|AW)-[A-Z0-9]+$/i.test(id) ? id : '';
  }

  function normalizeMetaId(value) {
    var id = String(value || localStorage.getItem('x2_fb_pixel_id') || '').trim();
    return /^\d+$/.test(id) ? id : '';
  }

  function injectGoogleTag(id) {
    try {
      if (!id) return;
      if (window.__x2GaInjected === id) return;
      window.__x2GaInjected = id;
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () {
        window.dataLayer.push(arguments);
      };
      if (!document.querySelector('script[src="https://www.googletagmanager.com/gtag/js?id=' + id + '"]')) {
        var script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
        (document.head || document.documentElement).appendChild(script);
      }
      window.gtag('js', new Date());
      window.gtag('config', id);
    } catch (e) {}
  }

  function injectMetaPixel(id) {
    try {
      if (!id) return;
      if (window.__x2FbInjected === id) return;
      window.__x2FbInjected = id;
      if (!window.fbq) {
        window.fbq = function () {
          if (window.fbq.callMethod) return window.fbq.callMethod.apply(window.fbq, arguments);
          window.fbq.queue.push(arguments);
        };
        window.fbq.queue = [];
        window.fbq.loaded = true;
        window.fbq.version = '2.0';
      }
      if (!document.querySelector('script[src*="connect.facebook.net/en_US/fbevents.js"]')) {
        var script = document.createElement('script');
        script.async = true;
        script.src = 'https://connect.facebook.net/en_US/fbevents.js';
        (document.head || document.documentElement).appendChild(script);
      }
      window.fbq('init', id);
      window.fbq('track', 'PageView');
      if (!document.getElementById('meta-pixel-noscript-' + id)) {
        var img = document.createElement('img');
        img.id = 'meta-pixel-noscript-' + id;
        img.src = 'https://www.facebook.com/tr?id=' + encodeURIComponent(id) + '&ev=PageView&noscript=1';
        img.alt = '';
        img.width = 1;
        img.height = 1;
        img.style.cssText = 'display:none';
        (document.body || document.documentElement).appendChild(img);
      }
    } catch (e) {}
  }

  function boot() {
    var googleId = normalizeGoogleId();
    if (googleId) {
      localStorage.setItem('x2_ga_id', googleId);
      injectGoogleTag(googleId);
    }

    var metaId = normalizeMetaId();
    if (metaId) {
      localStorage.setItem('x2_fb_pixel_id', metaId);
      injectMetaPixel(metaId);
    }

    if (googleId || metaId) return;

    var fetchSettings = null;
    if (window.Supabase && window.Supabase.Settings && window.Supabase.Settings.get) {
      fetchSettings = window.Supabase.Settings.get();
    } else {
      fetchSettings = fetch(SUPABASE_URL + '/rest/v1/settings?select=google_analytics,fb_pixel&limit=1', {
        cache: 'no-store',
        headers: {
          apikey: SUPABASE_ANON,
          
          Accept: 'application/json'
        }
      }).then(function (response) {
        return response.ok ? response.json() : [];
      }).then(function (rows) {
        return rows && rows[0] ? rows[0] : {};
      });
    }

    Promise.resolve(fetchSettings).then(function (settings) {
      var nextGoogleId = normalizeGoogleId(settings && settings.google_analytics);
      if (nextGoogleId) {
        localStorage.setItem('x2_ga_id', nextGoogleId);
        injectGoogleTag(nextGoogleId);
      }
      var nextMetaId = normalizeMetaId(settings && settings.fb_pixel);
      if (nextMetaId) {
        localStorage.setItem('x2_fb_pixel_id', nextMetaId);
        injectMetaPixel(nextMetaId);
      }
    }).catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
