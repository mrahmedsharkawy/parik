(function () {
  if (window.__x2InstantNavInit) return;
  window.__x2InstantNavInit = true;

  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && (conn.saveData || /2g/.test(String(conn.effectiveType || "")))) return;

  var ROUTES = [
    "/",
    "/categories",
    "/offers",
    "/Cart",
    "/account",
    "/checkout",
    "/affiliate",
    "/policy"
  ];

  var queued = [];
  var inFlight = 0;
  var maxInFlight = 2;
  var seen = new Set();
  var maxSeen = 60;

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
    return fetch(path, {
      method: "GET",
      credentials: "include",
      cache: "force-cache"
    }).catch(function () {});
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

  function warmVisibleLinks() {
    var anchors = document.querySelectorAll("a[href]");
    var count = 0;
    for (var i = 0; i < anchors.length && count < 16; i++) {
      var a = anchors[i];
      if (!a || !a.href) continue;
      if (a.closest && a.closest(".mobile-nav, .site-footer, .header-content, .acc-nav-grid")) {
        queueWarm(a.href);
        count++;
      }
    }
  }

  function bootWarmup() {
    for (var i = 0; i < ROUTES.length; i++) queueWarm(ROUTES[i]);
    warmVisibleLinks();
  }

  function onIntent(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var anchor = target.closest("a[href]");
    if (!anchor || !anchor.href) return;
    queueWarm(anchor.href);
  }

  document.addEventListener("pointerover", onIntent, { passive: true, capture: true });
  document.addEventListener("touchstart", onIntent, { passive: true, capture: true });
  document.addEventListener("focusin", onIntent, { passive: true, capture: true });

  if ("requestIdleCallback" in window) {
    requestIdleCallback(function () { bootWarmup(); }, { timeout: 2000 });
  } else {
    setTimeout(bootWarmup, 900);
  }
})();
