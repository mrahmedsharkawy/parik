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
  if (document.querySelector('script[data-x2-tracking-bridge="1"]')) return;
  var script = document.createElement('script');
  script.src = '/java/google-tag-bridge.js?v=20260806b';
  script.defer = true;
  script.setAttribute('data-x2-tracking-bridge', '1');
  (document.head || document.documentElement).appendChild(script);
})();
