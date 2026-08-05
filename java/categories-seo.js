(function () {
  if (!/\/categories(?:\.html)?$/i.test(location.pathname)) return;

  function currentLang() {
    return (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar';
  }

  function ensureMeta(selector, attr, value) {
    var el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, value);
      document.head.appendChild(el);
    }
    return el;
  }

  function setMeta(selector, attr, value, content) {
    ensureMeta(selector, attr, value).setAttribute('content', content);
  }

  function cleanTitle(raw) {
    return String(raw || '')
      .replace(/\s*-\s*Bariq\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function slugToLabel(value) {
    return decodeURIComponent(String(value || ''))
      .replace(/[\-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function textFromMatchedLink(matcher) {
    var links = Array.prototype.slice.call(document.querySelectorAll('.category-item > a, .subcategories a, .categories a'));
    var match = links.find(matcher);
    if (!match) return '';
    var richSpan = match.querySelector('span[data-i18n-ar], span[data-i18n-en], span[data-i18n]');
    var raw = richSpan ? richSpan.textContent : match.textContent;
    return cleanTitle(String(raw || '').replace(/[\u{1F300}-\u{1FAFF}›]+/gu, ' '));
  }

  function updateCategorySeo() {
    var lang = currentLang();
    var params = new URLSearchParams(location.search);
    var category = params.get('category') || '';
    var subcategory = params.get('subcategory') || '';
    var titleEl = document.getElementById('selected-category-title');
    var visibleTitle = cleanTitle((titleEl && titleEl.textContent) || '');
    var isAll = !category || category.toLowerCase() === 'all';
    var categoryTitle = isAll ? '' : textFromMatchedLink(function (link) {
      return (link.getAttribute('href') || '').indexOf('/categories/' + category) >= 0;
    }) || slugToLabel(category);
    var subcategoryTitle = !subcategory ? '' : textFromMatchedLink(function (link) {
      var href = link.getAttribute('href') || '';
      return href.indexOf('subcategory=' + encodeURIComponent(subcategory)) >= 0 || href.indexOf('subcategory=' + subcategory) >= 0;
    }) || slugToLabel(subcategory);
    var pageTitle = subcategoryTitle || categoryTitle || visibleTitle || (lang === 'en' ? 'All Categories' : 'جميع الفئات');
    var desc;
    var canonicalUrl;

    if (subcategory) {
      desc = lang === 'en'
        ? 'Explore ' + pageTitle + ' personalized gifts from Bariq Gifts in the UAE with elegant designs, custom occasion giveaways, and fast shipping.'
        : 'اكتشف منتجات ' + pageTitle + ' من بريق للهدايا في الإمارات مع هدايا مخصصة، توزيعات مناسبات، تصاميم راقية وشحن سريع.';
      canonicalUrl = 'https://bariqgifts.com/categories/' + encodeURIComponent(category) + '?subcategory=' + encodeURIComponent(subcategory);
    } else if (isAll) {
      desc = lang === 'en'
        ? 'Browse all Bariq Gifts categories in the UAE, including acrylic, wood, leather, paper, Ramadan, stickers, and personalized occasion gifts.'
        : 'تصفح جميع فئات بريق للهدايا في الإمارات، بما يشمل الأكريليك، الخشب، الجلد، الورق، رمضان، الاستيكر والهدايا المخصصة للمناسبات.';
      canonicalUrl = 'https://bariqgifts.com/categories';
    } else {
      desc = lang === 'en'
        ? 'Shop ' + pageTitle + ' from Bariq Gifts in the UAE with personalized gifts, elegant occasion giveaways, and fast shipping.'
        : 'تسوق ' + pageTitle + ' من بريق للهدايا في الإمارات مع هدايا مخصصة، توزيعات مناسبات، خامات متنوعة وشحن سريع.';
      canonicalUrl = 'https://bariqgifts.com/categories/' + encodeURIComponent(category);
    }

    document.title = pageTitle + ' - Bariq';

    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    setMeta('meta[name="description"]', 'name', 'description', desc);
    setMeta('meta[property="og:title"]', 'property', 'og:title', pageTitle + ' - Bariq');
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMeta('meta[property="og:image"]', 'property', 'og:image', 'https://bariqgifts.com/assets/logo.png?v=logo-stroke-20260729');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', pageTitle + ' - Bariq');
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', desc);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', 'https://bariqgifts.com/assets/logo.png?v=logo-stroke-20260729');
  }

  var scheduled = 0;
  function scheduleUpdate() {
    if (scheduled) clearTimeout(scheduled);
    scheduled = setTimeout(updateCategorySeo, 60);
  }

  document.addEventListener('DOMContentLoaded', scheduleUpdate);
  window.addEventListener('popstate', scheduleUpdate);

  var titleNode = document.querySelector('head > title');
  if (titleNode && 'MutationObserver' in window) {
    new MutationObserver(scheduleUpdate).observe(titleNode, { childList: true, subtree: true, characterData: true });
  }

  var titleTarget = document.getElementById('selected-category-title');
  if (titleTarget && 'MutationObserver' in window) {
    new MutationObserver(scheduleUpdate).observe(titleTarget, { childList: true, subtree: true, characterData: true });
  }

  ['pushState', 'replaceState'].forEach(function (method) {
    var original = history[method];
    if (typeof original !== 'function') return;
    history[method] = function () {
      var result = original.apply(this, arguments);
      scheduleUpdate();
      return result;
    };
  });

  scheduleUpdate();

  var bootAttempts = 0;
  var bootTimer = setInterval(function () {
    scheduleUpdate();
    bootAttempts += 1;
    if (bootAttempts >= 10) clearInterval(bootTimer);
  }, 500);
})();