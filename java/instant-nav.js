(function () {
  if (window.__x2InstantNavInit) return;
  window.__x2InstantNavInit = true;

  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && (conn.saveData || /2g/.test(String(conn.effectiveType || "")))) return;

  var queued = [];
  var inFlight = 0;
  var maxInFlight = 1;
  var seen = new Set();
  var maxSeen = 20;

  function normalizePath(href) {
    try {
      var url = new URL(href, location.href);
      if (url.origin !== location.origin) return "";
      if (!/^https?:$/.test(url.protocol)) return "";
      if (url.hash && (url.pathname === location.pathname)) return "";
      var path = url.pathname || "/";
      if (/\.(pdf|zip|rar|7z|docx?|xlsx?)$/i.test(path)) return "";
      if (/^\/admin(\/|$)/i.test(path)) return "";
      if (path === "/index.html") path = "/";
      if (path.length > 1) path = path.replace(/\/+$/, "");
      var safeTopLevel = /^\/(|categories|offers|Cart|account|checkout|affiliate|policy|product|login)$/i.test(path);
      var safeProductDetail = /^\/product\/\d+(?:\/)?$/i.test(path);
      if (!safeTopLevel && !safeProductDetail) return "";
      return path + (url.search || "");
    } catch (e) {
      return "";
    }
  }

  function addPrefetchLink(path) {
    try {
      if (document.head.querySelector('link[rel="prefetch"][href="' + path + '"]')) return;
      var link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "document";
      link.href = path;
      document.head.appendChild(link);
    } catch (e) {}
  }

  function doWarm(path) {
    addPrefetchLink(path);
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "WARM_ROUTES", urls: [path] });
      }
    } catch (e) {}
    return Promise.resolve();
  }

  function pumpQueue() {
    if (!queued.length || inFlight >= maxInFlight) return;
    var next = queued.shift();
    inFlight++;
    Promise.resolve(doWarm(next)).finally(function () {
      inFlight--;
      pumpQueue();
    });
  }

  function queueWarm(href) {
    var path = normalizePath(href);
    if (!path) return;
    if (seen.has(path)) return;
    if (seen.size >= maxSeen) return;
    seen.add(path);
    queued.push(path);
    pumpQueue();
  }

  function onIntent(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var anchor = target.closest("a[href]");
    if (!anchor || !anchor.href) return;
    queueWarm(anchor.href);
  }

  document.addEventListener("pointerover", onIntent, { passive: true, capture: true });
  document.addEventListener("pointerdown", onIntent, { passive: true, capture: true });
  document.addEventListener("touchstart", onIntent, { passive: true, capture: true });
  document.addEventListener("focusin", onIntent, { passive: true, capture: true });

})();
