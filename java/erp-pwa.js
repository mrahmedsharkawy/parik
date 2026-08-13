(function () {
  "use strict";

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js?v=erp", { updateViaCache: "none" }).catch(function () {});
  });
})();
