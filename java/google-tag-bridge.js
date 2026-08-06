(function () {
  function normalizeId(value) {
    var id = String(value || localStorage.getItem('x2_ga_id') || '').trim();
    return /^(G|AW)-[A-Z0-9]+$/i.test(id) ? id : '';
  }

  function injectTag(id) {
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

  function boot() {
    var storedId = normalizeId();
    if (storedId) {
      localStorage.setItem('x2_ga_id', storedId);
      injectTag(storedId);
      return;
    }

    if (!window.Supabase || !window.Supabase.Settings || !window.Supabase.Settings.get) return;
    window.Supabase.Settings.get().then(function (settings) {
      var id = normalizeId(settings && settings.google_analytics);
      if (!id) return;
      localStorage.setItem('x2_ga_id', id);
      injectTag(id);
    }).catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
