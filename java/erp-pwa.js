(function () {
  "use strict";

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js?v=413-no-visible-push-duplicate", { updateViaCache: "none" }).catch(function () {});
  });
})();
