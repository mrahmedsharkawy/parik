function changeLang(lang) {
  fetch(`translations/${lang}.json`)
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
      applyCategoryNames(lang);
      localStorage.setItem('lang', lang);
      document.documentElement.lang = lang;
      document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
    });
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
  const savedLang = localStorage.getItem('lang') || 'ar';
  changeLang(savedLang);
  const sel = document.querySelector('select');
  if (sel) sel.value = savedLang;
});

