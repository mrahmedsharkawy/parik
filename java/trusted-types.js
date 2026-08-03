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
