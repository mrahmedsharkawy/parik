function changeLang(lang) {
  fetch(`/translations/${lang}.json`)
    .then(res => res.json())
    .then(data => {
      // ترجمة النصوص data-i18n
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (data[key]) el.textContent = data[key];
      });
      // ترجمة placeholder
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (data[key]) el.placeholder = data[key];
      });
      // ترجمة title
      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (data[key]) el.title = data[key];
      });
      applyAttributeTranslations(lang, data);
      applyCategoryNames(lang);
      applyTextNodeTranslations(lang, data);
      if (lang === 'en' && data[document.title]) document.title = data[document.title];
      localStorage.setItem('lang', lang);
      document.documentElement.lang = lang;
      document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
    });
}

function applyAttributeTranslations(lang, data) {
  if (lang !== 'en') return;
  ['placeholder', 'title', 'aria-label'].forEach(attr => {
    document.querySelectorAll('[' + attr + ']').forEach(el => {
      const key = (el.getAttribute(attr) || '').replace(/\s+/g, ' ').trim();
      if (key && data[key]) el.setAttribute(attr, data[key]);
    });
  });
}

function applyTextNodeTranslations(lang, data) {
  if (lang !== 'en') return;
  const skip = new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','SELECT','OPTION']);
  const translate = root => {
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || skip.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        const key = node.nodeValue.replace(/\s+/g, ' ').trim();
        return key && data[key] ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const raw = node.nodeValue;
      const key = raw.replace(/\s+/g, ' ').trim();
      node.nodeValue = raw.replace(key, data[key]);
    });
  };
  translate(document.body);
  let runs = 0;
  const timer = setInterval(() => {
    applyAttributeTranslations(lang, data);
    translate(document.body);
    if (++runs > 8) clearInterval(timer);
  }, 350);
}

// يطبّق أسماء الفئات المخزّنة في السمات data-i18n-ar / data-i18n-en
function applyCategoryNames(lang) {
  document.querySelectorAll('[data-i18n-ar], [data-i18n-en]').forEach(el => {
    const ar = el.getAttribute('data-i18n-ar');
    const en = el.getAttribute('data-i18n-en');
    const val = lang === 'en' ? (en || ar) : (ar || en);
    if (val) el.textContent = val;
  });
}
// إتاحة الدالة عالمياً كي يستدعيها كود الفئات بعد رسمها
window.applyCategoryNames = applyCategoryNames;

// عند تحميل الصفحة، حمّل اللغة المحفوظة
window.addEventListener('DOMContentLoaded', () => {
  const urlLang = new URLSearchParams(location.search).get('lang');
  const storedLang = localStorage.getItem('lang');
  const savedLang = storedLang === 'ar' && urlLang === 'en'
    ? 'ar'
    : ((urlLang === 'en' || urlLang === 'ar') ? urlLang : (storedLang || 'ar'));
  localStorage.setItem('lang', savedLang);
  changeLang(savedLang);
  const sel = document.querySelector('select');
  if (sel) sel.value = savedLang;

  if (savedLang === 'en') {
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:|wa:|javascript:)/i.test(href)) return;
      try {
        const url = new URL(href, location.origin);
        if (url.origin !== location.origin) return;
        url.searchParams.set('lang', 'en');
        a.setAttribute('href', url.pathname + url.search + url.hash);
      } catch(e) {}
    }, true);
  }
});

