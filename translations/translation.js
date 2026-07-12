function changeLang(lang) {
  fetch(`translations/${lang}.json`)
    .then(res => res.json())
    .then(data => {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (data[key]) {
          el.textContent = data[key];
        }
      });
      // الفئات: الاسم يأتي مباشرة من Categories.json (المصدر الوحيد)
      // ولا تُستبدل من ملفات الترجمة، فقط نبدّل بين العربي والإنجليزي حسب اللغة
      applyCategoryNames(lang);
      localStorage.setItem('lang', lang);
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
  document.querySelector('select').value = savedLang;
});

