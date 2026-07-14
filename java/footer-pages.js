// خريطة slug <-> اسم الصفحة عربي وإنجليزي
var footerPageSlugs = window.footerPageSlugs || (window.footerPageSlugs = {
  "about-Bariq": { ar: "معلومات عن Bariq", en: "About Bariq" },
  "about": { ar: "نبذة عن Bariq", en: "About" },
  "shop-like-pro": { ar: "تسوق مثل المحترفين", en: "Shop Like Pro" },
  "affiliate-commission": { ar: "التابع والمكافآت: اكسب عمولة", en: "Affiliate & Commission" },
  "contact": { ar: "تواصل معنا", en: "Contact Us" },
  "media-outlets": { ar: "المنافذ الإعلامية", en: "Media Outlets" },
  "tree-planting": { ar: "برنامج زراعة الأشجار في Bariq", en: "Tree Planting Program" },
  "customer-service": { ar: "خدمة العملاء", en: "Customer Service" },
  "returns": { ar: "سياسة الإرجاع والاسترداد", en: "Returns Policy" },
  "intellectual-property": { ar: "سياسة الملكية الفكرية", en: "Intellectual Property" },
  "shipping-info": { ar: "معلومات الشحن", en: "Shipping Info" },
  "report-abuse": { ar: "الإبلاغ عن النشاط المشبوه", en: "Report Abuse" },
  "help": { ar: "المساعدة", en: "Help" },
  "support-faq": { ar: "مركز الدعم والأسئلة الشائعة", en: "Support & FAQ" },
  "security-center": { ar: "مركز الأمان", en: "Security Center" },
  "buyer-protection": { ar: "حماية المشتري في Bariq", en: "Buyer Protection" },
  "work-with-Bariq": { ar: "اعمل مع Bariq", en: "Work With Bariq" }
});


// دالة عرض صفحة السياسة حسب الـ slug
async function renderPolicyPage(slug) {
  if (!slug) return;
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  let pageName = (footerPageSlugs[slug] && footerPageSlugs[slug][lang]) || slug;
  let contentDiv = document.getElementById('footer-page-content');
  let main = document.body.querySelector('main');
  if (!contentDiv) {
    contentDiv = document.createElement('div');
    contentDiv.id = 'footer-page-content';
    main.appendChild(contentDiv);
  }
  // تحميل بيانات الصفحات من JSON
  let pages;
  try {
    const dir = location.pathname
      .replace(/\/policy\/[^\/.]+$/, '/')
      .replace(/\/policy\.html$/, '/')
      .replace(/\/[^\/]*$/, '/');
    const candidates = [
      dir + 'java/footer-pages.json',
      './java/footer-pages.json',
      '/java/footer-pages.json'
    ];
    let found = false;
    let lastError = '';
    for (const jsonPath of candidates) {
      try {
        const res = await fetch(jsonPath, { cache: 'no-store' });
        if (res.ok) {
          pages = await res.json();
          found = true;
          break;
        } else {
          lastError = `fetch(${jsonPath}) => ${res.status}`;
        }
      } catch (err) {
        lastError = err.message;
      }
    }
    if (!found) throw new Error('json not found: ' + lastError);
  } catch (e) {
    contentDiv.innerHTML = `<div style="color:red;text-align:center">تعذر تحميل بيانات الصفحات.<br>${e.message}</div>`;
    return;
  }

  // عرض المحتوى حسب نوع الصفحة
  if (slug === "about") {
    let html = "";
    if (pages["نبذة عن Bariq:العنوان"])
      html += `<h2>${pages["نبذة عن Bariq:العنوان"]}</h2>`;
    if (pages["نبذة عن Bariq:النص"])
      html += `<p>${pages["نبذة عن Bariq:النص"]}</p>`;
    // ... أضف باقي الحقول حسب الحاجة ...
    contentDiv.innerHTML = html;
    return;
  }

  // الصفحات الأخرى
  let jsonKey = footerPageSlugs[slug] ? footerPageSlugs[slug].ar : pageName;
  if (pages[jsonKey]) {
    contentDiv.innerHTML = `<div>${pages[jsonKey]}</div>`;
  } else {
    contentDiv.innerHTML = `<div style="color:red;text-align:center">صفحة غير موجودة</div>`;
  }
}

// مراقبة تغيّر الـ URL وتشغيل العرض عند كل تغيير
if (
  location.pathname.endsWith('policy.html') ||
  location.pathname.match(/\/policy\/([^\/.]+)$/)
) {
  // دالة تعرض الصفحة حسب الـ slug
  async function showPolicyPage() {
    let params = new URLSearchParams(window.location.search);
    let slug = params.get('page');
    if (!slug) {
      const match = location.pathname.match(/\/policy\/([^\/.]+)$/);
      if (match) slug = match[1];
    }
    if (!slug) return;

    const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
    let pageName = (footerPageSlugs[slug] && footerPageSlugs[slug][lang]) || slug;
    let pageTitle = document.getElementById('page-title');
    let h2 = document.getElementById('selected-category-title');
    let contentDiv = document.getElementById('footer-page-content');
    let main = document.body.querySelector('main');
    if (!contentDiv) {
      contentDiv = document.createElement('div');
      contentDiv.id = 'footer-page-content';
      contentDiv.style.marginTop = '0';
      contentDiv.style.marginBottom = '0';
      contentDiv.style.marginLeft = 'auto';
      contentDiv.style.marginRight = 'auto';
      contentDiv.style.maxWidth = '900px';
      contentDiv.style.background = '#fff';
      contentDiv.style.borderRadius = '12px';
      contentDiv.style.boxShadow = '0 2px 12px #0001';
      contentDiv.style.padding = '32px 18px';
      main.appendChild(contentDiv);
    }
    let titleToShow = pageName && pageName !== 'جميع الفئات' ? pageName : (lang === 'en' ? 'Policy' : 'بوليس');
    if (pageTitle) {
      pageTitle.textContent = titleToShow;
      pageTitle.setAttribute('data-i18n', titleToShow);
    }
    document.title = titleToShow;
    if (h2) {
      h2.textContent = '';
      h2.style.display = 'none';
    }

    // جلب الجيسون بشكل صحيح (مسار ديناميكي بالنسبة لمجلد الموقع)
    let pages;
    try {
      const dir = location.pathname
        .replace(/\/policy\/[^\/.]+$/, '/')
        .replace(/\/policy\.html$/, '/')
        .replace(/\/[^\/]*$/, '/');
      const candidates = [
        dir + 'java/footer-pages.json',
        './java/footer-pages.json',
        '/java/footer-pages.json'
      ];
      let found = false;
      let lastError = '';
      for (const jsonPath of candidates) {
        try {
          const res = await fetch(jsonPath, { cache: 'no-store' });
          if (res.ok) {
            pages = await res.json();
            found = true;
            break;
          } else {
            lastError = `fetch(${jsonPath}) => ${res.status}`;
          }
        } catch (err) {
          lastError = err.message;
        }
      }
      if (!found) throw new Error('json not found: ' + lastError);
    } catch (e) {
      contentDiv.innerHTML = `<div style="color:red;text-align:center">تعذر تحميل بيانات الصفحات.<br>${e.message}</div>`;
      return;
    }

    // ===== About page: ابنِ المحتوى أولاً ثم ارجع =====
    if (slug === "about") {
      let html = "";
      if (pages["نبذة عن Bariq:العنوان"])
        html += `<h2 class="about-x2-title" data-i18n="نبذة عن Bariq:العنوان">${pages["نبذة عن Bariq:العنوان"]}</h2>`;
      if (pages["نبذة عن Bariq:النص"])
        html += `<p class="about-x2-text" data-i18n="نبذة عن Bariq:النص">${pages["نبذة عن Bariq:النص"]}</p>`;
      if (pages["نبذة عن Bariq:العنوان2"])
        html += `<h2 class="about-x2-title" data-i18n="نبذة عن Bariq:العنوان2">${pages["نبذة عن Bariq:العنوان2"]}</h2>`;
      if (pages["نبذة عن Bariq:النص2"])
        html += `<p class="about-x2-text" data-i18n="نبذة عن Bariq:النص2">${pages["نبذة عن Bariq:النص2"]}</p>`;
      if (pages["نبذة عن Bariq:العنوان3"])
        html += `<h2 class="about-x2-title" data-i18n="نبذة عن Bariq:العنوان3">${pages["نبذة عن Bariq:العنوان3"]}</h2>`;
      if (pages["نبذة عن Bariq:النص3"])
        html += `<p class="about-x2-text" data-i18n="نبذة عن Bariq:النص3">${pages["نبذة عن Bariq:النص3"]}</p>`;
      if (pages["نبذة عن Bariq:العنوان4"])
        html += `<h2 class="about-x2-title" data-i18n="نبذة عن Bariq:العنوان4">${pages["نبذة عن Bariq:العنوان4"]}</h2>`;
      if (Array.isArray(pages["نبذة عن Bariq:قائمة"])) {
        html += `<ul class="about-x2-list">`;
        pages["نبذة عن Bariq:قائمة"].forEach(item => {
          html += `<li data-i18n="نبذة عن Bariq:قائمة">${item}</li>`;
        });
        html += `</ul>`;
      }
      if (pages["نبذة عن Bariq:العنوان5"])
        html += `<h2 class="about-x2-title" data-i18n="نبذة عن Bariq:العنوان5">${pages["نبذة عن Bariq:العنوان5"]}</h2>`;
      if (Array.isArray(pages["نبذة عن Bariq:القيم"])) {
        html += `<div class="about-x2-values">`;
        pages["نبذة عن Bariq:القيم"].forEach(val => {
          html += `<div class="about-x2-value"><img src="${val["صورة"]}" alt="${val["عنوان"]}"><div class="about-x2-value-title" data-i18n="نبذة عن Bariq:القيم">${val["عنوان"]}</div><div data-i18n="نبذة عن Bariq:القيم">${val["وصف"]}</div></div>`;
        });
        html += `</div>`;
      }

      if (html.trim()) {
        contentDiv.innerHTML = html;
      } else {
        showFooterPageNotFound(contentDiv, pageName);
      }
      return;
    }

    // ====== الصفحات الأخرى: ابحث بالمفتاح العام ثم اعرض =====
    let jsonKey = footerPageSlugs[slug] ? footerPageSlugs[slug].ar : pageName;
    if (pages[jsonKey]) {
      contentDiv.innerHTML = `<div data-i18n="footer-page-content">${pages[jsonKey]}</div>`;
    } else {
      showFooterPageNotFound(contentDiv, pageName);
    }
  }

// ...existing code...

// ...existing code...

// أول تحميل
document.addEventListener('DOMContentLoaded', showPolicyPage);

// عند تغيير الرابط (زر الرجوع/التقدم)
window.addEventListener('popstate', showPolicyPage);

// مراقبة تغيّر الـ search (query string)
let lastSearch = location.search;
setInterval(() => {
  if (location.search !== lastSearch) {
    lastSearch = location.search;
    showPolicyPage();
  }
}, 200);}

// بيانات وهمية للمستخدم (في نظام حقيقي: من السيرفر)
function getAffiliateData() {
  // جلب من localStorage أو بيانات افتراضية
  let affId = localStorage.getItem('x2-aff-id') || 'ref' + Math.floor(Math.random() * 100000);
  localStorage.setItem('x2-aff-id', affId);

  // بيانات افتراضية
  let data = {
    affId: affId,
    totalEarnings: 1250,
    pendingEarnings: 250,
    sales: 17,
    transactions: [
      { date: '٢٣ إبريل ٢٠٢٤', amount: 80, status: 'مكتمل' },
      { date: '٢٢ إبريل ٢٠٢٤', amount: 50, status: 'مكتمل' },
      { date: '٢١ إبريل ٢٠٢٤', amount: 120, status: 'معلق' }
    ]
  };
  // حفظ آخر القيم في localStorage (محاكاة)
  localStorage.setItem('x2-aff-total', data.totalEarnings);
  localStorage.setItem('x2-aff-pending', data.pendingEarnings);
  localStorage.setItem('x2-aff-sales', data.sales);
  localStorage.setItem('x2-aff-transactions', JSON.stringify(data.transactions));
  return data;
}

// عرض البيانات في الصفحة
function renderAffiliateDashboard() {
  const data = getAffiliateData();
  // تحقق من وجود العناصر قبل التعيين لتجنب الخطأ
  const affLink = document.getElementById('affiliate-link');
  const totalEarnings = document.getElementById('total-earnings');
  const pendingEarnings = document.getElementById('pending-earnings');
  const salesCount = document.getElementById('affiliate-sales-count');
  const tbody = document.getElementById('transactions-table');

  if (affLink) affLink.value = window.location.origin + '/?ref=' + data.affId;
  if (totalEarnings) totalEarnings.textContent = data.totalEarnings.toLocaleString('ar-EG') + ' د.إ';
  if (pendingEarnings) pendingEarnings.textContent = data.pendingEarnings.toLocaleString('ar-EG') + ' د.إ';
  if (salesCount) salesCount.textContent = data.sales;

  // المعاملات
  if (tbody) {
    tbody.innerHTML = '';
    data.transactions.forEach(tr => {
      let statusColor = tr.status === 'مكتمل' ? '#e0f7e9' : '#ffe6b0';
      let statusTextColor = tr.status === 'مكتمل' ? '#1a7f37' : '#b26c00';
      tbody.innerHTML += `<tr>
        <td style="padding:6px;">${tr.date}</td>
        <td style="padding:6px;">${tr.amount.toLocaleString('ar-EG')} د.إ</td>
        <td style="padding:6px;"><span style="background:${statusColor};color:${statusTextColor};padding:4px 12px;border-radius:6px;">${tr.status}</span></td>
      </tr>`;
    });
  }
}

// إظهار نموذج تسجيل الدخول/التسجيل وإخفاء لوحة التحكم
function showAuthForm() {
  document.querySelector('.affiliate-dashboard-ar').style.display = 'none';
  document.getElementById('affiliate-auth').style.display = '';
  // إزالة حالة تسجيل الدخول من localStorage
  localStorage.removeItem('x2-aff-logged-in');
}

// إظهار لوحة التحكم وإخفاء نموذج الدخول
function showDashboard() {
  // تحقق من وجود العنصر قبل محاولة تغيير style لتجنب الخطأ
  var dash = document.querySelector('.affiliate-dashboard-ar');
  var auth = document.getElementById('affiliate-auth');
  if (dash) dash.style.display = '';
  if (auth) auth.style.display = 'none';
  // حفظ حالة تسجيل الدخول
  localStorage.setItem('x2-aff-logged-in', 'true');
}


// زر تسجيل الخروج
document.addEventListener('DOMContentLoaded', function () {
  renderAffiliateDashboard();

  // إظهار نموذج تسجيل الدخول فقط عند البداية
  showLoginOnly();

  // زر تسجيل الخروج
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = function () {
      // حذف بيانات المستخدم
      localStorage.removeItem('x2-aff-id');
      localStorage.removeItem('x2-aff-total');
      localStorage.removeItem('x2-aff-pending');
      localStorage.removeItem('x2-aff-sales');
      localStorage.removeItem('x2-aff-transactions');
      localStorage.removeItem('x2-aff-logged-in'); // إزالة حالة تسجيل الدخول
      // إظهار نموذج تسجيل الدخول/التسجيل
      showLoginOnly();
    };
  }

  // زر سحب الأرباح
  var withdrawBtn = document.getElementById('withdraw-btn');
  if (withdrawBtn) {
    withdrawBtn.onclick = function () {
      let pending = parseFloat(localStorage.getItem('x2-aff-pending') || '0');
      if (pending > 0) {
        alert('تم إرسال طلب سحب الأرباح (' + pending + ' د.إ). سيتم التواصل معك قريباً.');
        localStorage.setItem('x2-aff-pending', '0');
        renderAffiliateDashboard();
      } else {
        alert('لا توجد أرباح معلقة للسحب حالياً.');
      }
    };
  }

  // ====== نموذج تسجيل الدخول فقط ======
  function showLoginOnly() {
    // إظهار نموذج الدخول وإخفاء نموذج التسجيل
    var dash = document.querySelector('.affiliate-dashboard-ar');
    if (dash) dash.style.display = 'none';
    var auth = document.getElementById('affiliate-auth');
    if (auth) auth.style.display = 'block';
    var loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.style.display = 'flex';
    var registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.style.display = 'none';

    // زر "تسجيل حساب جديد" أسفل نموذج الدخول
    if (loginForm && !document.getElementById('show-register-btn')) {
      let btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'show-register-btn';
      btn.textContent = 'تسجيل حساب جديد';
      btn.className = 'affiliate-auth-btn affiliate-auth-btn-register';
      btn.style.marginTop = '10px';
      loginForm.appendChild(btn);
      btn.onclick = function () {
        showRegisterOnly();
      };
    }
    // زر "نسيت كلمة المرور؟" أسفل نموذج الدخول
    if (loginForm && !document.getElementById('reset-pass-btn')) {
      let resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.id = 'reset-pass-btn';
      resetBtn.textContent = 'نسيت كلمة المرور؟';
      resetBtn.className = 'affiliate-auth-btn';
      resetBtn.style.marginTop = '8px';
      loginForm.appendChild(resetBtn);
      resetBtn.onclick = function () {
        showResetPassModal();
      };
    }
  }

  // ====== نموذج التسجيل فقط ======
  function showRegisterOnly() {
    document.getElementById('affiliate-auth').style.display = 'block';
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'flex';

    // زر "لديك حساب؟ تسجيل الدخول"
    if (!document.getElementById('show-login-btn')) {
      let btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'show-login-btn';
      btn.textContent = 'لديك حساب؟ تسجيل الدخول';
      btn.className = 'affiliate-auth-btn';
      btn.style.marginTop = '10px';
      document.getElementById('register-form').appendChild(btn);
      btn.onclick = function () {
        showLoginOnly();
      };
    }
  }

  // ====== نافذة إعادة تعيين كلمة السر ======
  function showResetPassModal() {
    const modal = document.getElementById('reset-pass-modal');
    if (!modal) return;
    modal.style.display = 'block';

    // زر الإغلاق
    const closeBtn = modal.querySelector('#close-reset-modal');
    if (closeBtn) {
      closeBtn.onclick = function() {
        modal.style.display = 'none';
        modal.querySelector('#reset-pass-msg').textContent = '';
        modal.querySelector('#reset-pass-form').reset();
        Array.from(modal.querySelectorAll('input')).forEach(inp => inp.style.borderColor = '#ddd');
      };
    }

    // ربط onsubmit دائماً (حتى لو تم فتح النافذة أكثر من مرة)
    const form = modal.querySelector('#reset-pass-form');
    if (form) {
      form.onsubmit = function(e) {
        e.preventDefault();
        e.stopPropagation();
        let email = modal.querySelector('#reset-email');
        let username = modal.querySelector('#reset-username');
        let oldPassword = modal.querySelector('#reset-oldpass');
        let newPassword = modal.querySelector('#reset-newpass');
        let msgDiv = modal.querySelector('#reset-pass-msg');
        let hasError = false;

        [email, username, oldPassword, newPassword].forEach(inp => inp.oninput = null);

        let storedEmail = localStorage.getItem('x2-aff-email');
        let storedPass = localStorage.getItem('x2-aff-pass');
        let storedName = localStorage.getItem('x2-aff-name');
        let storedOldPasswords = JSON.parse(localStorage.getItem('x2-aff-old-passwords') || '[]');
        let activated = localStorage.getItem('x2-aff-activated');
        let allPasswords = [storedPass].concat(storedOldPasswords || []);

        if (storedEmail !== email.value.trim()) {
          email.style.borderColor = 'red';
          msgDiv.textContent = 'البريد الإلكتروني غير صحيح أو غير مسجل. تأكد من صحة البريد.';
          hasError = true;
        } else if (activated !== 'true' && activated !== null) {
          email.style.borderColor = 'red';
          msgDiv.textContent = 'يجب تفعيل البريد الإلكتروني أولاً (تسجيل الدخول مرة واحدة على الأقل).';
          hasError = true;
        } else if (storedName && storedName !== username.value.trim()) {
          username.style.borderColor = 'red';
          msgDiv.textContent = 'اسم المستخدم غير صحيح. تأكد من صحة الاسم.';
          hasError = true;
        } else if (!allPasswords.includes(oldPassword.value.trim())) {
          oldPassword.style.borderColor = 'red';
          msgDiv.textContent = 'كلمة السر القديمة غير صحيحة أو لم تُستخدم من قبل. تأكد من صحة كلمة السر.';
          hasError = true;
        } else if (allPasswords.includes(newPassword.value.trim())) {
          newPassword.style.borderColor = 'red';
          msgDiv.textContent = 'كلمة السر الجديدة تم استخدامها من قبل، اختر كلمة مختلفة.';
          hasError = true;
        }

        if (hasError) {
          msgDiv.style.color = "red";
          if (email.style.borderColor === 'red') {
            email.oninput = function() {
              if (localStorage.getItem('x2-aff-email') === email.value.trim()) {
                email.style.borderColor = '#ddd';
                if (
                  username.style.borderColor !== 'red' &&
                  oldPassword.style.borderColor !== 'red' &&
                  newPassword.style.borderColor !== 'red'
                ) msgDiv.textContent = '';
                email.oninput = null;
              }
            };
          }
          if (username.style.borderColor === 'red') {
            username.oninput = function() {
              if (localStorage.getItem('x2-aff-name') === username.value.trim()) {
                username.style.borderColor = '#ddd';
                if (
                  email.style.borderColor !== 'red' &&
                  oldPassword.style.borderColor !== 'red' &&
                  newPassword.style.borderColor !== 'red'
                ) msgDiv.textContent = '';
                username.oninput = null;
              }
            };
          }
          if (oldPassword.style.borderColor === 'red') {
            oldPassword.oninput = function() {
              let allPasswordsNow = [localStorage.getItem('x2-aff-pass')].concat(JSON.parse(localStorage.getItem('x2-aff-old-passwords') || '[]'));
              if (allPasswordsNow.includes(oldPassword.value.trim())) {
                oldPassword.style.borderColor = '#ddd';
                if (
                  email.style.borderColor !== 'red' &&
                  username.style.borderColor !== 'red' &&
                  newPassword.style.borderColor !== 'red'
                ) msgDiv.textContent = '';
                oldPassword.oninput = null;
              }
            };
          }
          if (newPassword.style.borderColor === 'red') {
            newPassword.oninput = function() {
              let allPasswordsNow = [localStorage.getItem('x2-aff-pass')].concat(JSON.parse(localStorage.getItem('x2-aff-old-passwords') || '[]'));
              if (!allPasswordsNow.includes(newPassword.value.trim())) {
                newPassword.style.borderColor = '#ddd';
                if (
                  email.style.borderColor !== 'red' &&
                  username.style.borderColor !== 'red' &&
                  oldPassword.style.borderColor !== 'red'
                ) msgDiv.textContent = '';
                newPassword.oninput = null;
              }
            };
          }
          return false;
        }

        msgDiv.style.color = "#D4AF37";
        storedOldPasswords.unshift(storedPass);
        storedOldPasswords = storedOldPasswords.slice(0, 5);
        localStorage.setItem('x2-aff-pass', newPassword.value.trim());
        localStorage.setItem('x2-aff-old-passwords', JSON.stringify(storedOldPasswords));
        msgDiv.textContent = 'تم تغيير كلمة السر بنجاح. يمكنك الآن تسجيل الدخول بكلمة السر الجديدة.';
        [email, username, oldPassword, newPassword].forEach(inp => {
          inp.style.borderColor = '#ddd';
          inp._errorListener = false;
        });
        return false;
      };
    }
  }

  // معالجة تسجيل الدخول
  var loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.onsubmit = function(e) {
      e.preventDefault();
      let email = document.getElementById('login-email').value.trim();
      let pass = document.getElementById('login-pass').value.trim();
      let storedEmail = localStorage.getItem('x2-aff-email');
      let storedPass = localStorage.getItem('x2-aff-pass');
      let storedName = localStorage.getItem('x2-aff-name');
      let activated = localStorage.getItem('x2-aff-activated');

      // تحقق من وجود المستخدم أولاً
      if (storedEmail !== email) {
        alert('البريد الإلكتروني غير صحيح أو غير مسجل. تأكد من صحة البريد.');
        return;
      }
      // إذا لم يكن هناك قيمة تفعيل، اعتبره مفعل (للمستخدمين القدامى)
      if (activated === null) {
        activated = 'true';
        localStorage.setItem('x2-aff-activated', 'true');
      }
      if (activated !== 'true') {
        alert('يجب تفعيل البريد الإلكتروني أولاً (تسجيل الدخول مرة واحدة على الأقل).');
        return;
      }
      // تحقق من كلمة المرور
      if (storedPass === pass) {
        localStorage.setItem('x2-aff-logged-in', 'true'); // تسجيل الدخول فعلياً
        showDashboard();
        renderAffiliateDashboard();
      } else {
        alert('كلمة المرور غير صحيحة. تأكد من صحة كلمة المرور أو استخدم استعادة كلمة المرور.');
      }
    };
  }

  // معالجة إنشاء حساب جديد
  var registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.onsubmit = function(e) {
      e.preventDefault();
      let email = document.getElementById('reg-email').value.trim();
      let pass = document.getElementById('reg-pass').value.trim();
      let name = document.getElementById('reg-name').value.trim();
      if (!email || !pass || !name) return;
      if (localStorage.getItem('x2-aff-email') === email) {
        alert('لديك حساب بالفعل بهذا البريد الإلكتروني. يمكنك تسجيل الدخول أو إعادة تعيين كلمة المرور.');
        return;
      }
      localStorage.setItem('x2-aff-email', email);
      localStorage.setItem('x2-aff-pass', pass);
      localStorage.setItem('x2-aff-name', name);
      localStorage.setItem('x2-aff-activated', 'true');
      let affId = encodeURIComponent(name.replace(/\s+/g, '').toLowerCase()) + Math.floor(Math.random()*1000);
      localStorage.setItem('x2-aff-id', affId);
      localStorage.setItem('x2-aff-total', '0');
      localStorage.setItem('x2-aff-pending', '0');
      localStorage.setItem('x2-aff-sales', '0');
      localStorage.setItem('x2-aff-transactions', '[]');
      showDashboard();
      renderAffiliateDashboard();
    };
  }

  // عند تحميل الصفحة: تحقق من حالة تسجيل الدخول الفعلي
  let affEmail = localStorage.getItem('x2-aff-email');
  let affPass = localStorage.getItem('x2-aff-pass');
  let isLoggedIn = localStorage.getItem('x2-aff-logged-in') === 'true';
  if (!affEmail || !affPass || !isLoggedIn) {
    showLoginOnly();
  } else {
    showDashboard();
  }
});


// إصلاح شامل: جميع روابط الفوتر تعمل كروابط HTML عادية فقط
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.footer-info-bar a[data-i18n], footer a[data-i18n], .site-footer a[data-i18n]').forEach(link => {
    // اضبط href الصحيح فقط
    const pageName = link.getAttribute('data-i18n') || link.textContent.trim();
    const slug = Object.keys(footerPageSlugs).find(
      key => footerPageSlugs[key].ar === pageName || footerPageSlugs[key].en === pageName
    );
    if (slug) {
      link.setAttribute('href', 'policy.html?page=' + encodeURIComponent(slug));
    }
    // أزل أي مستمعات click قديمة نهائياً
    link.onclick = null;
    link.removeEventListener && link.removeEventListener('click', link._oldClickHandler || (()=>{}));
  });
});





