(function(){
  function activate(link) {
    if (!link || link.dataset.loadedStylesheet === '1') return;
    link.dataset.loadedStylesheet = '1';
    link.rel = 'stylesheet';
    link.removeAttribute('as');
  }

  function activateAll() {
    var links = document.querySelectorAll('link[rel="preload"][as="style"][data-load-stylesheet]');
    for (var i = 0; i < links.length; i++) activate(links[i]);
  }

  activateAll();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activateAll, { once: true });
})();
