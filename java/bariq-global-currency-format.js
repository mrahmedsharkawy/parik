(function () {
  function normalizeTextNode(node) {
    if (!node || !node.nodeValue || node.nodeValue.indexOf('AED') === -1) return;

    var s = node.nodeValue;

    /* AED 1270 / AED 1,270.00 -> 1270 د.ا / 1,270.00 د.ا */
    s = s.replace(/\bAED\s*([0-9][0-9,]*(?:\.[0-9]+)?)/g, '$1 د.ا');

    /* 1270 AED -> 1270 د.ا */
    s = s.replace(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*\bAED\b/g, '$1 د.ا');

    /* Any remaining visible AED labels */
    s = s.replace(/\bAED\b/g, 'د.ا');

    node.nodeValue = s;
  }

  function normalizeRoot(root) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      normalizeTextNode(root);
      return;
    }

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) normalizeTextNode(walker.currentNode);
  }

  function start() {
    normalizeRoot(document.body);

    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'characterData') normalizeTextNode(m.target);
        m.addedNodes.forEach(normalizeRoot);
      });
    }).observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
