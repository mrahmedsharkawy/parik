let products = [];
let categories = []; // إضافة متغير عام للفئات
let sideMenu;
let subDisplay;

// <<< إضافة هذا الـ stub لمنع ReferenceError إذا لم يكن معرفًا >>> 
if (typeof window.setPageTitleI18n !== 'function') {
  window.setPageTitleI18n = function(titleAr, titleEn){
    try {
      const lang = document.documentElement.lang || document.documentElement.getAttribute('lang') || 'ar';
      const title = (lang === 'en' ? (titleEn || titleAr) : (titleAr || titleEn)) || document.title;
      document.title = title;
      const el = document.getElementById('selected-category-title');
      if (el) el.textContent = title;
    } catch(e) {}
  };
}

// تخزين مؤقت عام للإطارات المستخرجة سابقًا لتحسين الأداء
if (!window._videoPosterCache) window._videoPosterCache = new Map();


// أضف هذه الدالة بعد تعريف المتغيرات وقبل دالة fetchProducts
export async function fetchCategories() {
  const paths = [
    'java/Categories.json',
    '/java/Categories.json',
    location.origin + '/java/Categories.json'
  ];
  for (const path of paths) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (res.ok) {
        categories = await res.json();
        return categories;
      }
    } catch (_) {}
  }
  throw new Error('Categories.json not found!');
}

// أضف هذه الدالة بعد دالة fetchCategories
let _productsCache = null;
export async function fetchProducts() {
  if (_productsCache) return _productsCache;
  const paths = [
    'java/Products.json',
    '/java/Products.json',
    location.origin + '/java/Products.json'
  ];
  for (const path of paths) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (res.ok) {
        _productsCache = await res.json();
        return _productsCache;
      }
    } catch (e) {
      // نكمل التجربة على المسارات الأخرى
    }
  }
  // لا شيء نجح
  throw new Error('Products.json not found!');
}
// ...existing code...

function getCategoryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  let category = params.get('category');
  if (category) return category;
  const path = window.location.pathname;
  const match = path.match(/\/categories\/([^\/?]+)/);
  if (match) return match[1];
  return null;
}

function normalizeAssetUrl(u) {
  try {
    // التعامل مع القيم غير المحددة أو الفارغة
    if (u === null || u === undefined || u === '') return '';
    
    // تحويل المدخل إلى نص
    const url = String(u);
    
    // إذا كان الرابط مطلقًا (http/https) أو يبدأ بـ // (بروتوكول نسبي)، أعده كما هو
    if (/^(https?:)?\/\//i.test(url)) return url;
    
    // تعامل مع روابط البيانات (data URLs)
    if (url.startsWith('data:')) return url;
    
    // فصل پارامترات الاستعلام والقطع (fragment) عن المسار
    let [path, query] = url.split('?');
    const fragmentIndex = (query || '').indexOf('#');
    let fragment = '';
    
    if (fragmentIndex !== -1) {
      fragment = (query || '').substring(fragmentIndex);
      query = (query || '').substring(0, fragmentIndex);
    }
    
    // تنظيف المسار من العلامات غير المرغوبة
    path = path.trim()
      .replace(/^\.\//, '')     // إزالة ./ من البداية
      .replace(/^\/+/, '')      // إزالة الشرطات المتكررة في البداية
      .replace(/\/+$/, '');     // إزالة الشرطات في النهاية
    
    // تقسيم المسار وترميز كل جزء بشكل آمن
    const parts = path.split('/').map(seg => {
      try {
        // محاولة فك الترميز أولاً لتجنب الترميز المزدوج
        const decoded = decodeURIComponent(seg);
        return encodeURIComponent(decoded);
      } catch (e) {
        // إذا فشل فك الترميز، قم بالترميز مباشرة
        return encodeURIComponent(seg);
      }
    });
    
    // إعادة بناء الرابط مع شرطة مائلة في البداية
    let result = '/' + parts.join('/');
    
    // إضافة پارامترات الاستعلام والقطع إذا وجدت
    if (query) result += '?' + query;
    if (fragment) result += fragment;
    
    return result;
  } catch (error) {
    console.warn('خطأ في تنسيق الرابط:', error, u);
    return u;  // في حالة حدوث أي خطأ، أعد الرابط الأصلي
  }
}


// ... نفس الكود الحالي لإنشاء كارت المنتج ...
export function createProductCard(prod) {
  // تسجيل عالمي للاستخدام خارج الموديول
  if (!window.createProductCard) window.createProductCard = createProductCard;
  const card = document.createElement("div");
  card.className = "product-card";
  card.style.position = "relative";
  card.style.cursor = "pointer";

card.addEventListener("click", () => {
    // تسجيل مشاهدة المنتج
    try {
      const HIST_KEY = 'x2_history';
      const img  = Array.isArray(prod.img) ? prod.img[0] : (prod.img || '');
      const name = typeof prod.name==='object' ? (prod.name.ar||prod.name.en) : (prod.name||'');
      const entry = { id: prod.id, name, img: img.startsWith('data:') ? '' : img, price: prod.price, oldPrice: prod.oldPrice };
      let hist = JSON.parse(localStorage.getItem(HIST_KEY)||'[]');
      hist = hist.filter(h => String(h.id) !== String(prod.id)); // ازالة التكرار
      hist.unshift(entry);
      if (hist.length > 20) hist = hist.slice(0, 20);
      localStorage.setItem(HIST_KEY, JSON.stringify(hist));
    } catch(e) {}
    window.location.href = `product.html?id=${prod.id}`;
});

  const lang = document.documentElement.lang || document.documentElement.getAttribute('lang') || 'ar';

  
  // دالة جلب الترجمة
  function getTranslated(val) {
    if (typeof val === "object" && val !== null) {
      return val[lang] || val["ar"] || val["en"] || "";
    }
    return val || "";
  }

  // دالة جلب رمز العملة
  const getCurrencySymbol = (currency) => {
    const symbols = {
      'USD': { ar: '$', en: '$' },
      'EUR': { ar: '€', en: '€' },
      'AED': { ar: 'د.إ', en: 'AED' },
      'SAR': { ar: 'ر.س', en: 'SAR' },
      'EGP': { ar: 'ج.م', en: 'EGP' },
      'JOD': { ar: 'د.أ', en: 'JOD' },
      'KWD': { ar: 'د.ك', en: 'KWD' },
      'GBP': { ar: '£', en: '£' }
    };
    const defaultSymbols = { ar: 'د.إ', en: '$' };
    if (symbols[currency]) return symbols[currency][lang] || symbols[currency].en;
    return defaultSymbols[lang] || defaultSymbols.ar;
  };
  const savedCurrency = localStorage.getItem("currency") || (lang === "en" ? "USD" : "AED");
  const productCurrency = prod.currency || savedCurrency;
  const currencySymbol = getCurrencySymbol(productCurrency);

// شارة العرض (تلقائي للمنتجات التي عليها خصم)
if (
  prod.oldPrice && prod.price &&
  !isNaN(parseFloat(prod.oldPrice)) &&
  !isNaN(parseFloat(prod.price)) &&
  parseFloat(prod.oldPrice) > parseFloat(prod.price)
) {
  const discountPercent = Math.round(
    ((parseFloat(prod.oldPrice) - parseFloat(prod.price)) / parseFloat(prod.oldPrice)) * 100
  );
  const offerBadge = document.createElement("span");
  offerBadge.className = "offer-badge";
  offerBadge.textContent = lang === "ar"
    ? `خصم ${discountPercent}%`
    : `${discountPercent}% OFF`;
  card.appendChild(offerBadge);
}


// ...existing code...
// صورة أو فيديو المنتج
// دعم img/images كنص أو مصفوفة، و video/videos كذلك، مع اكتشاف الفيديو تلقائياً حسب الامتداد
const _toArr = (v) => Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
const _isVideoSrc = (s) => /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(String(s || ''));
const _allMedia = [..._toArr(prod.images), ..._toArr(prod.img), ..._toArr(prod.image)];
const prodVideos = [..._toArr(prod.videos), ..._toArr(prod.video), ..._allMedia.filter(_isVideoSrc)];
const prodImages = _allMedia.filter(s => !_isVideoSrc(s));
const firstImage = prodImages[0] || '';
const firstVideo = prodVideos[0] || '';
if (firstVideo) {
  // إنشاء حاوية الفيديو والتحكم بالعناصر المتداخلة
  const videoContainer = document.createElement("div");
  videoContainer.className = "product-video-container";
  videoContainer.style.position = "relative";
  videoContainer.style.overflow = "hidden";
  videoContainer.style.height = "230px";
  videoContainer.style.width = "100%";
  videoContainer.style.borderRadius = "8px 8px 0 0";
  videoContainer.style.background = "transparent";

  const video = document.createElement("video");
  // نؤخر تحميل الفيديو الفعلي ونخزن المصدر في data-src
  video.dataset.src = firstVideo || '';
  video.className = "product-video";
  video.playsInline = true;
  video.loop = true;
  video.muted = true;
  video.autoplay = false;
  video.preload = "metadata"; // لا تحمل البايت الكامل قبل الحاجة
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.objectFit = "cover";
  video.style.display = "block";
  video.style.background = "transparent";

(function setupVideoDirectly() {
  // تحميل الفيديو فورًا بدلاً من استخدام poster
  if (!video.dataset.src) return;

  // تعيين مصدر الفيديو مباشرة
  video.src = video.dataset.src;
  video.preload = "auto"; // تحميل الفيديو كاملاً وفورًا
  video.muted = true;  // صامت افتراضياً
  video.loop = true;
  video.playsInline = true;
  video.style.display = "block";
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.objectFit = "cover";
  
  // تأكد من عدم تشغيل الفيديو تلقائيًا لكن حمله
  video.autoplay = false;
  
  // إخفاء عنصر posterImg أو إزالته تمامًا
  const oldPoster = videoContainer.querySelector('.video-poster-img');
  if (oldPoster) {
    oldPoster.parentNode.removeChild(oldPoster);
  }
  
  // إزالة الخلفية من الحاوية
  videoContainer.style.backgroundImage = "none";
  
  // إضافة حدث canplay للتأكد من أن الفيديو جاهز
  video.addEventListener('canplay', function onCanPlay() {
    // الفيديو جاهز للتشغيل، لكن لا يتم تشغيله حتى hover
    video.removeEventListener('canplay', onCanPlay);
  });
  
  // معالجة أي أخطاء في تحميل الفيديو
  video.addEventListener('error', function() {
    console.error('فشل تحميل الفيديو:', video.dataset.src);
  });
})();

  // عناصر التحكم وأحداث hover كما في الكود الحالي (تعمل بنفس الطريقة)
  const videoControls = document.createElement("div");
  videoControls.className = "video-controls";
  videoControls.style.position = "absolute";
  videoControls.style.bottom = "10px";
  videoControls.style.right = "10px";
  videoControls.style.display = "flex";
  videoControls.style.gap = "8px";
  videoControls.style.opacity = "0";
  videoControls.style.transition = "opacity 0.3s";
  videoControls.style.zIndex = "2";

  const soundBtn = document.createElement("button");
  soundBtn.className = "video-control-btn sound-btn";
  soundBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M5,9 L1,9 L1,15 L5,15 L11,22 L11,2 L5,9 Z"/></svg>';
  soundBtn.style.cssText = `width:30px;height:30px;border-radius:50%;border:none;background:rgba(0,0,0,0.5);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;`;

  const fullscreenBtn = document.createElement("button");
  fullscreenBtn.className = "video-control-btn fullscreen-btn";
  fullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3,3 L9,3 L9,5 L5,5 L5,9 L3,9 Z"/></svg>';
  fullscreenBtn.style.cssText = soundBtn.style.cssText;

  const playIcon = document.createElement("div");
  playIcon.className = "play-icon";
  playIcon.innerHTML = '<svg viewBox="0 0 24 24" width="36" height="36"><path fill="currentColor" d="M8,5 L8,19 L19,12 Z"/></svg>';
  playIcon.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:50px;height:50px;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0.8;transition:opacity 0.3s;z-index:2;`;

  const videoOverlay = document.createElement("div");
  videoOverlay.className = "video-overlay";
  videoOverlay.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.03);z-index:1;cursor:pointer;transition:background 0.2s;`;

  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "video-loading";
  loadingIndicator.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:30px;height:30px;border:3px solid rgba(255,255,255,0.3);border-top:3px solid #fff;border-radius:50%;animation:spin 1s linear infinite;display:none;z-index:2;`;

// hover -> تحميل + تشغيل
videoContainer.addEventListener('mouseenter', function() {
  videoControls.style.opacity = "1";
  
  // إخفاء posterImg عند مرور المؤشر
  const posterImg = videoContainer.querySelector('.video-poster-img');
  if (posterImg) posterImg.style.opacity = "0";
  
  // تأكد من تحميل مصدر الفيديو إذا لم يكن محملاً
  if (!video.src && video.dataset.src) {
    video.src = video.dataset.src;
    loadingIndicator.style.display = "block";
    video.addEventListener('canplay', function onCanPlay() {
      loadingIndicator.style.display = "none";
      video.removeEventListener('canplay', onCanPlay);
    }, { once: true });
  }
  
  try {
    if (video.paused) {
      const p = video.play();
      if (p && typeof p.then === 'function') {
        // حفظ Promise لاستخدامه لاحقاً عند المغادرة
        video._playPromise = p;
        p.catch(() => {}); // تجاهل أخطاء التشغيل (مثل autoplay policy)
      }
    }
  } catch (e) {}
  
  setTimeout(() => { 
    playIcon.style.opacity = video.paused ? "0.8" : "0"; 
  }, 60);
});

// leave -> إيقاف
videoContainer.addEventListener('mouseleave', function() {
  videoControls.style.opacity = "0";
  
  // إعادة إظهار posterImg عند مغادرة المؤشر
  const posterImg = videoContainer.querySelector('.video-poster-img');
  if (posterImg) posterImg.style.opacity = "1";
  
  try {
    if (!video.paused) {
      const p = video._playPromise;
      if (p && typeof p.then === 'function') {
        // انتظر اكتمال وعد التشغيل قبل الإيقاف
        p.then(() => { 
          try { video.pause(); } catch(e) {}
        }).catch(() => { 
          try { video.pause(); } catch(e) {} 
        });
      } else {
        video.pause();
      }
    }
  } catch (e) {}
  
  playIcon.style.opacity = "0.8";
});
// ...existing code...

  videoOverlay.addEventListener('click', function() {
    if (video.paused) {
      if (!video.src && video.dataset.src) video.src = video.dataset.src;
      video.play().catch(()=>{});
      playIcon.style.opacity = "0";
    } else {
      video.pause();
      playIcon.style.opacity = "0.8";
    }
  });


  soundBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    video.muted = !video.muted;
    soundBtn.style.opacity = video.muted ? "0.6" : "1";
  });


  fullscreenBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (video.requestFullscreen) video.requestFullscreen();
    else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
    else if (video.msRequestFullscreen) video.msRequestFullscreen();
  });


  video.addEventListener('loadstart', () => loadingIndicator.style.display = "block");
  video.addEventListener('canplay', () => loadingIndicator.style.display = "none");
  video.addEventListener('play', () => playIcon.style.opacity = "0");
  video.addEventListener('pause', () => playIcon.style.opacity = "0.8");

  // append العناصر
  videoContainer.appendChild(video);
  videoContainer.appendChild(videoOverlay);
  videoContainer.appendChild(playIcon);
  videoContainer.appendChild(videoControls);
  videoControls.appendChild(soundBtn);
  videoControls.appendChild(fullscreenBtn);
  videoContainer.appendChild(loadingIndicator);
  card.appendChild(videoContainer);

  // تسجيل للمشتركات المشتركة (إن وُجدت)
  try {
    if (typeof lazyVideoObserver !== 'undefined' && lazyVideoObserver && lazyVideoObserver.observe) {
      lazyVideoObserver.observe(videoContainer);
    }
    if (typeof playPauseObserver !== 'undefined' && playPauseObserver && playPauseObserver.observe) {
      playPauseObserver.observe(videoContainer);
    }
  } catch (e) {}
} else {
  const img = document.createElement("img");
  img.src = normalizeAssetUrl(firstImage);
  img.alt = getTranslated(prod.name);
  img.className = "product-img";
  img.style.height = "230px";
  img.style.objectFit = "cover";
  card.appendChild(img);
}
//



  const content = document.createElement("div");
  content.className = "product-content";

const name = document.createElement("div");
name.className = "product-name";
name.textContent = getTranslated(prod.name);
content.appendChild(name);

// المخزون
if (prod.stock && parseInt(prod.stock) < 50) {
  const stock = document.createElement("div");
  stock.className = "product-stock";
  stock.textContent = lang === "en"
    ? `Stay ${prod.stock} only`
    : `يتبقي ${prod.stock} فقط `;
  content.appendChild(stock);
}

// التقييم
if (prod.rating) {
  const ratingContainer = document.createElement("div");
  ratingContainer.className = "product-rating-container";
  ratingContainer.style.display = "flex";
  ratingContainer.style.alignItems = "center";
  ratingContainer.style.gap = "4px";

  const starsContainer = document.createElement("div");
  starsContainer.className = "stars-container";

  const emptyStars = document.createElement("div");
  emptyStars.className = "stars-empty";
  emptyStars.innerHTML = "★★★★★";

  const filledStars = document.createElement("div");
  filledStars.className = "stars-filled";
  filledStars.style.width = `${Math.min(prod.rating / 5 * 100, 100)}%`;
  filledStars.innerHTML = "★★★★★";
  if (lang === "ar") {
    filledStars.style.right = "0";
    filledStars.style.left = "auto";
  } else {
    filledStars.style.left = "0";
    filledStars.style.right = "auto";
  }

  starsContainer.appendChild(emptyStars);
  starsContainer.appendChild(filledStars);

  ratingContainer.appendChild(starsContainer);

  if (prod.ratingCount) {
    const ratingCount = document.createElement("span");
    ratingCount.className = "rating-count";
    ratingCount.textContent = prod.ratingCount;
    ratingCount.style.fontSize = "0.95em";
    ratingCount.style.color = "#777";
    ratingCount.style.marginLeft = "4px";
    ratingContainer.appendChild(ratingCount);
  }

  content.appendChild(ratingContainer);
}

// تعريف متغير السعر مسبقًا (مهم جدًا)
const price = document.createElement("span");
price.className = "product-price";

// إذا كان المنتج عليه خصم أضف كلاس لون خاص
if (
  prod.oldPrice && prod.price &&
  !isNaN(parseFloat(prod.oldPrice)) &&
  !isNaN(parseFloat(prod.price)) &&
  parseFloat(prod.oldPrice) > parseFloat(prod.price)
) {
  price.classList.add("product-price-discount");
}

price.textContent = `${prod.price || ""} ${currencySymbol}`;

// بوكس التوفير والعداد قبل السعر مباشرة
if (
  prod.timerEnd &&
  prod.oldPrice && prod.price &&
  !isNaN(parseFloat(prod.oldPrice)) &&
  !isNaN(parseFloat(prod.price)) &&
  parseFloat(prod.oldPrice) > parseFloat(prod.price)
) {
  const timerSaveBox = document.createElement("div");
  timerSaveBox.className = "product-timer-save-box";

  const saveText = document.createElement("span");
  saveText.className = "product-save-text";
  const arrow = `<span class="save-arrow">&#8595;</span>`;

  const discount = (parseFloat(prod.oldPrice) - parseFloat(prod.price)).toFixed(2);

  saveText.innerHTML = lang === "ar"
    ? `${arrow} خصم ${discount} ${currencySymbol} إضافي`
    : `${arrow} Save ${discount} ${currencySymbol} extra`;

  const timer = document.createElement("span");
  timer.className = "product-timer";
  timerSaveBox.appendChild(saveText);
  timerSaveBox.appendChild(timer);
  content.appendChild(timerSaveBox);

  // --- FIX: Declare interval in parent scope ---
  let interval;
  // تفعيل العداد بناءً على تاريخ الانتهاء
  function updateTimer() {
    const end = new Date(prod.timerEnd).getTime();
    const now = Date.now();
    let totalSeconds = Math.max(0, Math.floor((end - now) / 1000));
    if (totalSeconds > 0) {
      const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const s = String(totalSeconds % 60).padStart(2, "0");
      timer.textContent = `${h}:${m}:${s}`;
    } else {
      timer.textContent = "00:00:00";
      timerSaveBox.style.display = "none";
      const offerBadge = card.querySelector('.offer-badge');
      if (offerBadge) offerBadge.style.display = "none";
      price.textContent = `${prod.oldPrice} ${currencySymbol}`;
      const oldPriceStriked = card.querySelector('.product-old-price-striked');
      if (oldPriceStriked) oldPriceStriked.style.display = "none";
      clearInterval(interval);
    }
  }
  updateTimer();
  interval = setInterval(updateTimer, 1000);
}

// السعر + المبيعات في نفس السطر
const priceRow = document.createElement("div");
priceRow.className = "product-price-row";
priceRow.style.display = "flex"; 
priceRow.style.alignItems = "center";
priceRow.style.gap = "4px"; // مسافة صغيرة بين العناصر
priceRow.style.flexWrap = "nowrap"; // منع التفاف العناصر

priceRow.appendChild(price);

const fire = document.createElement("span");
fire.className = "product-fire";
fire.textContent = "🔥";
fire.style.margin = "0 0px"; // تقليل هوامش أيقونة النار
priceRow.appendChild(fire);

// إضافة عدد مبيعات وهمي مختصر (يظهر دائماً)
const sales = document.createElement("span");
sales.className = "product-sales";
sales.style.whiteSpace = "nowrap"; // منع انقسام النص

// دالة لإنشاء رقم مبيعات وهمي ثابت مع تنوع بين المنتجات
function generateCompactSales(productId) {
  // استخدام معرف المنتج لإنشاء رقم أساسي (ثابت لكل منتج)
  const baseId = typeof productId === 'string' 
    ? productId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) 
    : (productId || 0);
  
  // إنشاء قاعدة متنوعة للأرقام الوهمية
  const baseRange = [1.5, 2.3, 3.7, 4.2, 5.6, 6.8, 2.8, 3.2, 4.9, 5.2];
  
  // اختيار قيمة من المصفوفة بناءً على معرف المنتج
  const baseIndex = baseId % baseRange.length;
  const baseValue = baseRange[baseIndex];
  
  // إضافة تنوع بسيط بناءً على اليوم (زيادة أو نقصان بحد أقصى 0.3)
  const today = new Date();
  const dayOfMonth = today.getDate();
  const variation = ((dayOfMonth % 10) / 10) * 0.3; // قيمة بين 0 و 0.3
  
  // إما زيادة أو نقصان حسب اليوم
  const finalValue = dayOfMonth % 2 === 0
    ? baseValue + variation
    : baseValue - variation;
  
  // تنسيق الرقم لعرض رقم عشري واحد
  return finalValue.toFixed(1) + 'k+';
}

// إنشاء رقم المبيعات باستخدام معرف المنتج للثبات
const salesNumber = generateCompactSales(prod.id || prod.productId);
sales.textContent = lang === "en"
  ? `sold ${salesNumber}`
  : `تم بيع ${salesNumber}`;
priceRow.appendChild(sales);

content.appendChild(priceRow);

// أضف السعر المشطوب هنا فقط للمنتجات التي عليها خصم (مرة واحدة فقط)
if (
  prod.oldPrice && prod.price &&
  !isNaN(parseFloat(prod.oldPrice)) &&
  !isNaN(parseFloat(prod.price)) &&
  parseFloat(prod.oldPrice) > parseFloat(prod.price)
) {
  const oldPriceStriked = document.createElement("div");
  oldPriceStriked.className = "product-old-price-striked";
  oldPriceStriked.textContent = `${prod.oldPrice} ${currencySymbol}`;
  content.appendChild(oldPriceStriked);
}

// باقي صفوف الفلاتر والمعلومات
const filterRow = document.createElement("div");
filterRow.className = "product-filter-row";
filterRow.style.display = "flex";
filterRow.style.alignItems = "center";
filterRow.style.gap = "0px";
filterRow.style.margin = "0px 0";

if (prod.save) {
  const save = document.createElement("span");
  save.className = "product-save";
  save.textContent = prod.save;
  filterRow.appendChild(save);
}
content.appendChild(filterRow);

// معلومات إضافية (يمكنك إضافة المزيد حسب الحاجة)
const infoRow = document.createElement("div");
infoRow.className = "product-info-row";
infoRow.style.display = "flex";
infoRow.style.flexDirection = "column";
infoRow.style.alignItems = "flex-start";
content.appendChild(infoRow);

card.appendChild(content);

  // زر السلة
  const cartBtn = document.createElement("button");
  cartBtn.className = "product-cart-btn";
  cartBtn.title = "إضافة للسلة";
  cartBtn.type = "button";
  cartBtn.innerHTML = `
    <span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="cart-svg-icon">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M2 1C1.44772 1 1 1.44772 1 2C1 2.55228 1.44772 3 2 3H3.21922L6.78345 17.2569C5.73276 17.7236 5 18.7762 5 20C5 21.6569 6.34315 23 8 23C9.65685 23 11 21.6569 11 20C11 19.6494 10.9398 19.3128 10.8293 19H15.1707C15.0602 19.3128 15 19.6494 15 20C15 21.6569 16.3431 23 18 23C19.6569 23 21 21.6569 21 20C21 18.3431 19.6569 17 18 17H8.78078L8.28078 15H18C20.0642 15 21.3019 13.6959 21.9887 12.2559C22.6599 10.8487 22.8935 9.16692 22.975 7.94368C23.0884 6.24014 21.6803 5 20.1211 5H5.78078L5.15951 2.51493C4.93692 1.62459 4.13696 1 3.21922 1H2ZM18 13H7.78078L6.28078 7H20.1211C20.6742 7 21.0063 7.40675 20.9794 7.81078C20.9034 8.9522 20.6906 10.3318 20.1836 11.3949C19.6922 12.4251 19.0201 13 18 13ZM18 20.9938C17.4511 20.9938 17.0062 20.5489 17.0062 20C17.0062 19.4511 17.4511 19.0062 18 19.0062C18.5489 19.0062 18.9938 19.4511 18.9938 20C18.9938 20.5489 18.5489 20.9938 18 20.9938ZM7.00617 20C7.00617 20.5489 7.45112 20.9938 8 20.9938C8.54888 20.9938 8.99383 20.5489 8.99383 20C8.99383 19.4511 8.54888 19.0062 8 19.0062C7.45112 19.0062 7.00617 19.4511 7.00617 20Z" fill="currentColor"/>
      </svg>
    </span>
  `;
// ...existing code...
  cartBtn.addEventListener('click', function (ev) {
    ev.preventDefault();
    ev.stopPropagation();

    // لا نخزن صور base64 الضخمة في السلة — تسبب QuotaExceededError
    const rawImg = firstImage || prod.img || prod.image || '';
    const safeImg = rawImg.startsWith('data:') ? 'assets/logo.png' : rawImg;

    const payload = {
      id: String(prod.id || prod.productId || ''),
      title: (typeof prod.name === 'object' ? (prod.name.ar || prod.name.en) : (prod.name || prod.title)) || '',
      meta: prod.variant || prod.meta || '',
      img: safeImg,
      priceCurrent: (typeof getNumericValue === 'function')
        ? getNumericValue(prod.price || prod.priceCurrent || 0)
        : parseFloat(String(prod.price || 0).replace(/[^\d.-]/g, '')) || 0,
      priceOld: (typeof getNumericValue === 'function')
        ? getNumericValue(prod.oldPrice || prod.priceOld || 0)
        : parseFloat(String(prod.oldPrice || 0).replace(/[^\d.-]/g, '')) || 0,
      qty: 1
    };

    // استخدم addProduct إن وُجد (Cart.html)، وإلا اكتب مباشرة في localStorage
    if (typeof window.addProduct === 'function') {
      try { window.addProduct(payload); } catch (err) { console.warn('addProduct error', err); }
    } else {
      try {
        const raw = localStorage.getItem('x2_cart') || '[]';
        const cart = JSON.parse(raw);
        const ix = cart.findIndex(it => String(it.id) === String(payload.id));
        if (ix !== -1) {
          cart[ix].qty = (Number(cart[ix].qty) || 1) + 1;
        } else {
          cart.unshift(payload);
        }
        localStorage.setItem('x2_cart', JSON.stringify(cart));

        // تحديث عداد السلة
        const count = cart.reduce((s, it) => s + (Number(it.qty) || 1), 0);
        const badge = document.getElementById('checkout-count');
        if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
        document.querySelectorAll('.cart-count').forEach(el => {
          el.textContent = count;
          el.style.display = count > 0 ? 'flex' : 'none';
        });
      } catch (err) { console.warn('cart write error:', err); }
    }

    // إطلاق حدث عام
    try { window.dispatchEvent(new CustomEvent('cart:updated', { detail: { product: payload } })); } catch(e){}

    // تغذية راجعة بصرية على الزر
    const origBg = cartBtn.style.background;
    cartBtn.style.background = '#D4AF37';
    const pathEl = cartBtn.querySelector('path');
    if (pathEl) pathEl.style.fill = '#fff';
    setTimeout(() => {
      cartBtn.style.background = origBg;
      if (pathEl) pathEl.style.fill = '';
    }, 900);
  });
// ...existing code...
  // دعم اتجاه زر السلة حسب اتجاه الكارت
  let cardDir = card.getAttribute('dir') || card.style.direction;
  if (!cardDir) {
    let parent = card.parentElement;
    while (parent && !cardDir) {
      cardDir = parent.getAttribute('dir') || parent.style.direction;
      parent = parent.parentElement;
    }
  }
  if (!cardDir) {
    cardDir = document.documentElement.dir || 'rtl';
  }
  cartBtn.style.left = '';
  cartBtn.style.right = '';
  cartBtn.style.insetInlineStart = '';
  cartBtn.style.insetInlineEnd = '';
  if (cardDir === 'rtl') {
    cartBtn.style.left = '10px';
  } else {
    cartBtn.style.right = '10px';
  }

  card.appendChild(cartBtn);

  return card;
}



document.addEventListener('DOMContentLoaded', async function() {
  // تعريف المتغيرات
  const titleEl = document.getElementById('selected-category-title');
  const productsContainer = document.getElementById('category-products');
  sideMenu = document.querySelector('.dropdown-content.categories-menu');
  subDisplay = document.getElementById('subcategories-display');
  const categoriesContainer = document.querySelector('.categories');
  const filtersScroll = document.querySelector('.filters-scroll-container');

// أضف هذا الكود في بداية الملف
let isNavigating = false; // متغير عالمي لتتبع حالة التنقل

// استبدل وظيفة التمرير للأعلى بهذه النسخة المحسنة
function efficientScrollToTop(immediate = false) {
  // استخدام سلوك فوري إذا كان مطلوباً، وإلا استخدم تمرير سلس
  const behavior = immediate ? 'auto' : 'smooth';
  window.scrollTo({
    top: 0,
    behavior: behavior
  });
}

// استبدل معالج popstate بهذه النسخة
window.addEventListener('popstate', function(event) {
  isNavigating = true;
  const categoryFromUrl = getCategoryFromUrl() || 'all';
  
  // لا تضف overlay أو مؤشر تحميل عند الرجوع للخلف
  
  // تحميل المنتجات
  loadProductsForCategory(categoryFromUrl, categoriesData);
  
  // استرجاع موضع التمرير مباشرة بدون تمرير للأعلى أولاً
  try {
    let scrollPositions = JSON.parse(sessionStorage.getItem('categoryScrollPositions') || '{}');
    let lastScroll = scrollPositions[categoryFromUrl];
    
    if (lastScroll !== undefined) {
      // تأخير قصير لضمان تحميل المحتوى قبل التمرير
      setTimeout(() => {
        window.scrollTo({
          top: Number(lastScroll),
          behavior: 'auto' // استخدام سلوك فوري لتجنب التمرير المرئي
        });
        isNavigating = false;
      }, 200);
    } else {
      // لا نتمرر للأعلى عند الرجوع إذا لم يكن هناك موضع محفوظ
      isNavigating = false;
    }
  } catch (err) {
    console.warn('خطأ في استرجاع موضع التمرير:', err);
    isNavigating = false;
  }
});

  // 1. دالة لإنشاء قائمة الفئات الرئيسية في الهيدر - يجب تعريفها أولاً
  function renderMainCategoriesMenu(categoriesData) {
    if (!sideMenu) return;
    sideMenu.innerHTML = '';

    // إضافة زر جميع الفئات في الهيدر مع دعم الترجمة
    const allLabel = document.documentElement.dir === 'rtl' ? 'جميع الفئات' : 'All Categories';
    const allCategoriesDiv = document.createElement('div');
    allCategoriesDiv.className = 'category-item all-categories-header';
    allCategoriesDiv.innerHTML = `
      <a href="/categories.html">
        💯 <span data-i18n="all-categories">${allLabel}</span>
        <span class="arrow">›</span>
      </a>
    `;
    sideMenu.appendChild(allCategoriesDiv);

    categoriesData.sort((a, b) => (a.order || 999) - (b.order || 999)).forEach(category => {
      if (!category.name) return; // تخطي الفئات الفارغة

      const categoryItem = document.createElement('div');
      categoryItem.className = 'category-item';

      // اختيار الترجمة حسب اتجاه الصفحة
      const catName = document.documentElement.dir === 'rtl'
        ? (category.name.ar || category.name.en)
        : (category.name.en || category.name.ar);

      categoryItem.innerHTML = `
        <a href="${category.url || `/categories/${category.categorySlug}`}">
          ${getCategoryIcon(category.categorySlug)} 
          <span data-i18n-ar="${category.name.ar || category.name.en}" data-i18n-en="${category.name.en || category.name.ar}">${catName}</span>
          <span class="arrow">›</span>
        </a>
        ${category.subcategories && category.subcategories.length > 0 ? `
        <div class="flyout category-flyout">
          <ul class="subcategories">
            ${renderSubcategoriesMenu(category.subcategories, category.categorySlug)}
          </ul>
        </div>` : ''}
      `;
      
      sideMenu.appendChild(categoryItem);
    });
  }

  // 2. دالة لإنشاء الفئات الفرعية في القائمة
  function renderSubcategoriesMenu(subcategories, parentSlug) {
    if (!subcategories || subcategories.length === 0) return '';
    return subcategories.map(sub => {
      if (!sub.name) return '';
      // اختيار الترجمة حسب اتجاه الصفحة
      const subName = document.documentElement.dir === 'rtl'
        ? (sub.name.ar || sub.name.en)
        : (sub.name.en || sub.name.ar);
      // عدل الرابط ليكون دائماً من نوع categories.html?category=parentSlug&subcategory=subSlug
      const subUrl = `categories.html?category=${encodeURIComponent(parentSlug)}&subcategory=${encodeURIComponent(sub.categorySlug || subName)}`;
      return `
        <li>
          <a href="${subUrl}">
            <img src="${normalizeAssetUrl(sub.image) || ''}">
            <span data-i18n-ar="${sub.name.ar || sub.name.en}" data-i18n-en="${sub.name.en || sub.name.ar}">${subName}</span>
          </a>
        </li>
      `;
    }).join('');
  }

  
  // 3. دالة مساعدة للحصول على أيقونة مناسبة للفئة
  function getCategoryIcon(slug) {
    const icons = {
      'Occasions': '🎉',
      'Acrylic': '💎',
      'paper': '📄',
      'Forex': '🖼️',
      'wood': '🪵',
      'leather': '👜',
      'sticker': '🏷️',
      'Ramadan': '🌙',
    };
    
    return icons[slug] || '🔸';
  }

  // 4. دالة لإنشاء شريط الفئات الأفقي
  function renderHorizontalCategories(categoriesData) {
    if (!categoriesContainer) return;

    // زر "الكل" يعرض جميع المنتجات
    categoriesContainer.innerHTML = `
      <div><a href="/categories.html" data-category-slug="all">💯 <span data-i18n="الكل">${document.documentElement.dir === 'rtl' ? 'الكل' : 'All'}</span></a></div>
    `;

    categoriesData.sort((a, b) => (a.order || 999) - (b.order || 999)).forEach(category => {
      if (!category.name) return;
      const categoryDiv = document.createElement('div');
      const catName = document.documentElement.dir === 'rtl'
        ? (category.name.ar || category.name.en)
        : (category.name.en || category.name.ar);
      categoryDiv.innerHTML = `
        <a href="${category.url || `/categories/${category.categorySlug}`}" data-category-slug="${category.categorySlug}">
          ${getCategoryIcon(category.categorySlug)} 
          <span data-i18n-ar="${category.name.ar || category.name.en}" data-i18n-en="${category.name.en || category.name.ar}">${catName}</span>
        </a>
      `;
      categoriesContainer.appendChild(categoryDiv);
    });

    // تفعيل زر "الكل" ليعرض جميع المنتجات بدون تصفية (يدعم All/الكل/جميع الفئات)
    const allBtn = categoriesContainer.querySelector('a[data-category-slug="all"]');
    if (allBtn) {
      allBtn.addEventListener('click', function(e) {
        e.preventDefault();
        // غيّر الرابط بدون ريفرش
        const url = `categories.html?category=all`;
        window.history.pushState({category: 'all'}, '', url);
        // عرض جميع المنتجات
        loadProductsForCategory('all', window.categoriesData);
        // تحديث العنوان
        const allLabelAr = 'جميع الفئات';
        const allLabelEn = 'All Categories';
        const titleEl = document.getElementById('selected-category-title');
        if (titleEl) titleEl.textContent = allLabelAr;
        setPageTitleI18n(allLabelAr, allLabelEn);
      });
    }

    // تفعيل زر "جميع الفئات" في الشريط الجانبي (الهيدر) ليعرض جميع المنتجات أيضاً
    const allCategoriesHeader = document.querySelector('.all-categories-header > a');
    if (allCategoriesHeader) {
      allCategoriesHeader.addEventListener('click', function(e) {
        e.preventDefault();
        const allLabelAr = 'جميع الفئات';
        const allLabelEn = 'All Categories';
        if (titleEl) titleEl.textContent = allLabelAr;
        setPageTitleI18n(allLabelAr, allLabelEn);
        // غيّر الرابط بدون ريفرش
        const url = `categories.html?category=all`;
        window.history.pushState({category: 'all'}, '', url);
        loadProductsForCategory('all', window.categoriesData);
        showSubCategories(allLabelAr, 'all-categories', window.categoriesData);
      });
    }
  }


// ...existing code...
function renderProductsGrid(list, productsContainer, direction = null) {
  if (!productsContainer) return;

  // استخدم الترتيب المرسل كما هو (لا نعرض الفيديو أولاً)
  const sortedList = Array.isArray(list) ? list.slice() : [];

  // بناء DOM مؤقت
  const tempContainer = document.createElement('div');
  const rowDiv = document.createElement("div");
  rowDiv.className = "products-row";
  // inline styles removed — layout controlled by CSS column-count
  tempContainer.appendChild(rowDiv);

  // مؤشر تحميل مؤقت
  const loadingIndicator = document.createElement('div');
  loadingIndicator.id = 'grid-loading-indicator';
  loadingIndicator.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border:4px solid #f3f3f3;border-top:4px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;';
  productsContainer.classList.add('changing');
  productsContainer.style.minHeight = '200px';
  productsContainer.style.position = 'relative';
  productsContainer.appendChild(loadingIndicator);

  // chunking للأداء
  const FIRST_CHUNK = Math.min(120, sortedList.length);
  const NEXT_CHUNK = 60;
  let i = 0;

  function appendChunk() {
    const fragment = document.createDocumentFragment();
    const chunkSize = (i === 0) ? FIRST_CHUNK : NEXT_CHUNK;

    for (let k = 0; k < chunkSize && i < sortedList.length; k++, i++) {
      const prod = sortedList[i];
      const card = createProductCard(prod);
      fragment.appendChild(card);
    }
    rowDiv.appendChild(fragment);

    if (i < sortedList.length) {
      requestAnimationFrame(appendChunk);
    } else {
      // استبدال المحتوى القديم بالمحتوى الجديد
      productsContainer.innerHTML = '';
      productsContainer.appendChild(rowDiv);
      productsContainer.classList.remove('changing');

      // إزالة أي loaders مؤقتة إذا وُجدت
      const loader = document.getElementById('temp-popstate-loader') || document.getElementById('grid-loading-indicator');
      if (loader) loader.remove();
    }
  }

  appendChunk();
}


 // موحد: تعريف واحد لـ renderBatch (يستخدم DocumentFragment)
function renderBatch(items, container, clearContainer, direction = null) {
  if (clearContainer) {
    container.innerHTML = "";
    const rowDiv = document.createElement("div");
    rowDiv.className = "products-row";
    if (direction === 'next') rowDiv.classList.add('from-right');
    else if (direction === 'prev') rowDiv.classList.add('from-left');
    // inline styles removed — layout controlled by CSS column-count
    container.appendChild(rowDiv);
  }
  
  const rowDiv = container.querySelector('.products-row');
  const fragment = document.createDocumentFragment();
  items.forEach((prod, index) => {
    const card = createProductCard(prod);
    card.style.setProperty('--product-index', index);
    fragment.appendChild(card);
  });
  rowDiv.appendChild(fragment);
}


  // 6. دالة عرض الفئات الدائرية (subcategories)
  function showSubCategories(categoryName, i18n, categoriesData) {
    if (!subDisplay) return;
    subDisplay.innerHTML = '';

    // البحث في بيانات الفئات المحملة من Categories.json
    const categoryObj = categoriesData.find(c =>
      (c.name.ar === categoryName) ||
      (c.name.en === categoryName) ||
      (c.categorySlug === categoryName)
    );

    // إذا وجدت الفئة وبها فئات فرعية
    if (categoryObj && categoryObj.subcategories && categoryObj.subcategories.length > 0) {
      categoryObj.subcategories.forEach(sub => {
        if (!sub.name) return;

        const wrap = document.createElement('div');
        wrap.className = 'subcategory-circle';

        if (sub.image) {
          const img = document.createElement('img');
          img.src = normalizeAssetUrl(sub.image);
          img.alt = sub.name.ar || sub.name.en || '';
          wrap.appendChild(img);
        }

        const subName = document.documentElement.dir === 'rtl'
          ? (sub.name.ar || sub.name.en)
          : (sub.name.en || sub.name.ar);

        const label = document.createElement('span');
        label.className = 'subcategory-label';
        label.textContent = subName;
        wrap.appendChild(label);

        wrap.addEventListener('click', ev => {
          ev.preventDefault();
          // تصفية المنتجات حسب الفئة الفرعية بشكل شامل (يدعم الترجمة والمقارنة بين العربي والانجليزي)
          const filtered = products.filter(p => {
            const subNameAr = sub.name.ar || "";
            const subNameEn = sub.name.en || "";
            // ...existing matchField logic...
function matchField(val) {
  if (!val) return false;

  // افحص المصفوفة أولاً
  if (Array.isArray(val)) {
    return val.includes(subNameAr) || val.includes(subNameEn);
  }

  // ثم افحص الـ Object
  if (typeof val === "object") {
    return (
      val.ar === subNameAr ||
      val.en === subNameEn ||
      val.ar === subNameEn ||
      val.en === subNameAr
    );
  }

  // ثم النص العادي
  return val === subNameAr || val === subNameEn;
}            const matchSlug = p.subcategorySlug === sub.categorySlug;
            return (
              matchField(p.subCategory) ||
              matchField(p.category) ||
              matchField(p.mainCategory) ||
              matchSlug
            );
          });

          // حتى الفئات الفرعية الفارغة يجب أن تظهر رسالة "لا توجد منتجات لهذه الفئة الفرعية."
          if (productsContainer) {
            const lang = document.documentElement.lang || document.documentElement.getAttribute('lang') || 'ar';
            if (filtered.length === 0) {
              productsContainer.innerHTML = lang === "en"
                ? "<p style='color:gray;'>No products for this subcategory.</p>"
                : "<p style='color:gray;'>لا توجد منتجات لهذه الفئة الفرعية.</p>";
            } else {
              renderProductsGrid(filtered, productsContainer);
            }
          }

          if (titleEl) titleEl.textContent = subName;
          document.title = subName;
        });

        subDisplay.appendChild(wrap);
      });

      // إذا لم توجد فئات فرعية أو كلها فارغة، أضف رسالة افتراضية
      if (categoryObj.subcategories.length === 0) {
        const lang = document.documentElement.lang || document.documentElement.getAttribute('lang') || 'ar';
        subDisplay.innerHTML = lang === "en"
          ? "<p style='color:gray;'>No subcategories available.</p>"
          : "<p style='color:gray;'>لا توجد فئات فرعية.</p>";
      }

      return;
    }

    // الطريقة القديمة للبحث في سيدبار القائمة إذا لم يتم العثور على الفئة في البيانات الجديدة
    if (!sideMenu) return;
    const items = Array.from(sideMenu.querySelectorAll('.category-item'));
    const matched = items.find(item => {
      const a = item.querySelector(':scope > a');
      if (!a) return false;
      const s = a.querySelector('span[data-i18n]') || a.querySelector('span');
      if (!s) return false;
      if (i18n && s.getAttribute('data-i18n') === i18n) return true;
      return s.textContent.trim() === categoryName;
    });
    if (!matched) return;
    const subLinks = matched.querySelectorAll('.flyout .subcategories a');
    if (subLinks.length === 0) return;
    subLinks.forEach(sub => {
      const wrap = document.createElement('div');
      wrap.className = 'subcategory-circle';
      const imgEl = sub.querySelector('img');
      if (imgEl) {
        const img = document.createElement('img');
        img.src = imgEl.src;
        img.alt = imgEl.alt || '';
        wrap.appendChild(img);
      }
      let subName = '';
      if (nameEl) {
        subName = nameEl.textContent.trim();
        const label = document.createElement('span');
        label.className = 'subcategory-label';
        label.textContent = subName;
        wrap.appendChild(label);
      }
      wrap.addEventListener('click', ev => {
        ev.preventDefault();
        // تصفية المنتجات حسب الفئة الفرعية بشكل شامل
        const filtered = products.filter(
          p =>
            (typeof p.subCategory === 'string' && p.subCategory === subName) ||
            (Array.isArray(p.subCategory) && p.subCategory.includes(subName)) ||
            (typeof p.category === 'string' && p.category === subName) ||
            (Array.isArray(p.category) && p.category.includes(subName)) ||
            (typeof p.mainCategory === 'string' && p.mainCategory === subName) ||
            (Array.isArray(p.mainCategory) && p.mainCategory.includes(subName))
        );
        if (productsContainer) {
          if (filtered.length === 0) {
            productsContainer.innerHTML = "<p style='color:gray;'>لا توجد منتجات لهذه الفئة الفرعية.</p>";
          } else {
            renderProductsGrid(filtered, productsContainer);
          }
        }
        if (titleEl) titleEl.textContent = subName;
        document.title = subName;
      });
      subDisplay.appendChild(wrap);
    });
  }

  // 7. دالة تحميل المنتجات حسب الفئة
  function loadProductsForCategory(categorySlug, categoriesData) {
    fetchProducts().then(data => {
      products = data;
      console.log(`تم تحميل ${products.length} منتج`); // تشخيص
      console.log(`البحث عن الفئة: ${categorySlug}`); // تشخيص
      
      let filteredProducts;
      if (
        !categorySlug ||
        categorySlug.toLowerCase() === "all" ||
        categorySlug === "الكل" ||
        categorySlug === "جميع الفئات"
      ) {
        filteredProducts = products;
      } else {
        // البحث عن الفئة في Categories.json للحصول على معلومات إضافية
        const categoryObj = categories.find(c => 
          c.categorySlug === categorySlug || 
          (c.name && c.name.ar === categorySlug) || 
          (c.name && c.name.en === categorySlug)
        );
        
        console.log('معلومات الفئة:', categoryObj); // تشخيص
        
        // استخدام جميع أشكال المعرفات المحتملة للفئة
        let categoryIdentifiers = [categorySlug];
        if (categoryObj) {
          if (categoryObj.name && categoryObj.name.ar) categoryIdentifiers.push(categoryObj.name.ar);
          if (categoryObj.name && categoryObj.name.en) categoryIdentifiers.push(categoryObj.name.en);
          if (categoryObj.id) categoryIdentifiers.push(categoryObj.id.toString());
        }
        
        // توسيع نطاق البحث في المنتجات باستخدام جميع المعرفات المحتملة
        // دالة تجمع كل قيم فئات المنتج (تدعم النص، المصفوفة، والكائن متعدد اللغات)
        const collectCategoryValues = (p) => {
          const out = [];
          const push = (v) => {
            if (v === null || v === undefined) return;
            if (Array.isArray(v)) { v.forEach(push); return; }
            if (typeof v === 'object') {
              if (v.ar) out.push(String(v.ar).toLowerCase().trim());
              if (v.en) out.push(String(v.en).toLowerCase().trim());
              return;
            }
            out.push(String(v).toLowerCase().trim());
          };
          push(p.category);
          push(p.categorySlug);
          push(p.mainCategory);
          push(p.maincategory);
          push(p.mainCategorySlug);
          push(p.categoryName);
          push(p.categoryId);
          push(p.subCategory);
          push(p.subcategory);
          push(p.subcategorySlug);
          push(p.subCategorySlug);
          return out;
        };

        filteredProducts = products.filter(p => {
          const productCats = collectCategoryValues(p);
          return categoryIdentifiers.some(id => {
            const normalizedId = id.toString().toLowerCase().trim();
            return productCats.includes(normalizedId);
          });
        });
        
        console.log(`تم العثور على ${filteredProducts.length} منتج للفئة ${categorySlug}`); // تشخيص
        
        // إذا لم نجد منتجات، جرب البحث بطريقة أكثر مرونة
        if (filteredProducts.length === 0) {
          console.log('جاري البحث بطريقة أكثر مرنة...'); // تشخيص
          filteredProducts = products.filter(p => {
            const productCats = collectCategoryValues(p);
            return categoryIdentifiers.some(id => {
              const normalizedId = id.toString().toLowerCase().trim();
              // بحث جزئي (يحتوي على)
              return productCats.some(pc => pc.includes(normalizedId) || normalizedId.includes(pc));
            });
          });
          
          console.log(`تم العثور على ${filteredProducts.length} منتج بالبحث المرن`); // تشخيص
        }
      }

      // تحديث العنوان من الفئات المحملة من الملف
      if (titleEl) {
        const categoryObj = categoriesData.find(c => c.categorySlug === categorySlug);
        if (categoryObj) {
          // دعم اتجاه الصفحة في العنوان
          titleEl.textContent = document.documentElement.dir === 'rtl'
            ? (categoryObj.name.ar || categoryObj.name.en)
            : (categoryObj.name.en || categoryObj.name.ar);
          document.title = titleEl.textContent;
               } else {
          // طريقة احتياطية إذا لم تجد في البيانات الجديدة
          const lang = document.documentElement.lang || document.documentElement.getAttribute('lang') || 'ar';
          const categoryElement = document.querySelector(`.categories a[href*="${categorySlug}"]`);
          let catNameAr = categorySlug || "جميع الفئات";
          let catNameEn = categorySlug || "All Categories";
          if (categoryElement) {
            const span = categoryElement.querySelector('span[data-i18n]');
            if (span) {
              catNameAr = span.textContent.trim();
              catNameEn = span.getAttribute('data-i18n') || catNameAr;
            } else {
              catNameAr = categoryElement.textContent.trim();
              catNameEn = catNameAr;
            }
          }
          const catName = lang === 'en' ? catNameEn : catNameAr;
          titleEl.textContent = catName;
          document.title = catName;
        }
      }

      // عرض المنتجات
      if (productsContainer) {
        renderProductsGrid(filteredProducts, productsContainer);
      }

      // بداية البحث في بيانات الفئات المحملة
      const categoryObj = categoriesData.find(c => c.categorySlug === categorySlug);
      if (categoryObj) {
        showSubCategories(categoryObj.name.ar || categoryObj.name.en, null, categoriesData);
      } else {
        // الطريقة القديمة للبحث عن الفئات الفرعية
        const categoryElements = document.querySelectorAll('.categories > div a');
        for (const elem of categoryElements) {
          if (elem.getAttribute('href').includes(categorySlug)) {
            const span = elem.querySelector('span[data-i18n]');
            const catName = span ? span.textContent.trim() : elem.textContent.trim();
            const i18n = span ? span.getAttribute('data-i18n') : '';
            showSubCategories(catName, i18n, categoriesData);
            break;
          }
        }
      }
    });
  }

  
// 8. تفعيل أزرار الفئات في القائمة الجانبية (الميني)
function activateCategoryMenuItems() {
  if (!sideMenu) return;
  console.log('تفعيل أحداث النقر للقائمة الجانبية', sideMenu);

  // تفعيل النقر على الفئات الرئيسية في القائمة الجانبية
  const categoryItems = sideMenu.querySelectorAll('.category-item > a');
  console.log('عدد روابط الفئات:', categoryItems.length);

  categoryItems.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      window.scrollTo(0, 0);

      const span = link.querySelector('span[data-i18n]');
      const catName = span ? span.textContent.trim() : link.textContent.trim();
      const i18n = span ? span.getAttribute('data-i18n') : '';

      // استخراج slug من الرابط
      const href = link.getAttribute('href') || '';
      const slugMatch = href.match(/\/categories\/([^\/\?]+)/);
      const categorySlug = slugMatch ? slugMatch[1] : catName;

      console.log('تم النقر على فئة في القائمة:', catName, categorySlug);

      // حفظ موضع التمرير للصفحة الحالية قبل التنقل
      try {
        const scrollPositions = JSON.parse(sessionStorage.getItem('scrollPositions') || '{}');
        scrollPositions[window.location.href] = window.scrollY;
        sessionStorage.setItem('scrollPositions', JSON.stringify(scrollPositions));
      } catch (e) {
        console.warn('تعذر حفظ موضع التمرير', e);
      }

      // التمرير إلى أعلى الصفحة فوراً قبل أي شيء آخر
     window.scrollTo({top: 0, behavior: 'auto'}); // استخدام 'auto' المدعوم بدلاً من 'instant'

      // غيّر الرابط بدون ريفرش
      const url = `categories.html?category=${encodeURIComponent(categorySlug)}`;
      window.history.pushState({category: categorySlug, scrollToTop: true}, '', url);

      

      // تحميل المنتجات وعرض الفئات الفرعية
      loadProductsForCategory(categorySlug, window.categoriesData);
      showSubCategories(catName, i18n, window.categoriesData);
    });
  });

  // تفعيل النقر على زر جميع الفئات في الهيدر
  const allCategoriesHeader = sideMenu.querySelector('.all-categories-header > a');
  if (allCategoriesHeader) {
    allCategoriesHeader.addEventListener('click', function(e) {
      e.preventDefault();
      // استخدام لغة الصفحة الحالية لتحديد النص المناسب
      const lang = document.documentElement.lang || document.documentElement.getAttribute('lang') || 'ar';
      const allLabel = lang === 'en' ? 'All Categories' : 'جميع الفئات';

      if (titleEl) {
        titleEl.textContent = allLabel;
      }
      document.title = allLabel;

      // غيّر الرابط بدون ريفرش
      const url = `categories.html?category=all`;
      window.history.pushState({category: 'all'}, '', url);

      // تحميل جميع المنتجات
      loadProductsForCategory('all', window.categoriesData);

      // عرض جميع الفئات الفرعية مع دعم متعدد اللغات
      showSubCategories(allLabel, 'all-categories', window.categoriesData);
    });
  }

// تفعيل النقر على الفئات الفرعية في القائمة الجانبية
const subcategoryLinks = sideMenu.querySelectorAll('.subcategories a');
console.log('عدد روابط الفئات الفرعية:', subcategoryLinks.length);

const subcategoriesLists = sideMenu.querySelectorAll('.subcategories');
subcategoriesLists.forEach(ul => {
  ul.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (!link) return;
    e.preventDefault();
    window.scrollTo(0, 0);

    // استخراج معلومات الفئة الفرعية
    const href = link.getAttribute('href') || '';
    const urlParams = new URLSearchParams(href.split('?')[1] || '');
    const parentSlug = urlParams.get('category');
    const subSlug = urlParams.get('subcategory');
    const span = link.querySelector('span');
    const subName = span ? span.textContent.trim() : link.textContent.trim();

    // تغيير الرابط مع إضافة علامة واضحة للتمييز
    const url = `categories.html?category=${encodeURIComponent(parentSlug || '')}&subcategory=${encodeURIComponent(subSlug || '')}`;
    window.history.pushState({
      category: parentSlug,
      subcategory: subSlug,
      forceScrollTop: true,
      timestamp: Date.now()
    }, '', url);

    // لا تعيد تحميل المنتجات هنا! استخدم products المحملة مسبقاً
    // فلترة المنتجات بدعم متعدد اللغات وslug واسم الفئة الفرعية بالإنجليزي والعربي
    const norm = v => (typeof v === 'string' ? v.toLowerCase().trim() : v);
    const subNameNorm = norm(subName);
    const subSlugNorm = norm(subSlug);

    let subNameAr = subName, subNameEn = subName;
    if (span && span.hasAttribute('data-i18n')) {
      subNameAr = span.getAttribute('data-i18n');
      subNameEn = span.textContent.trim();
      if (document.documentElement.lang === 'en') {
        [subNameAr, subNameEn] = [subNameEn, subNameAr];
      }
    }

    const subNameArNorm = norm(subNameAr);
    const subNameEnNorm = norm(subNameEn);

    function matchValue(val) {
      if (!val) return false;
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        return (
          (val.ar && (norm(val.ar) === subNameNorm || norm(val.ar) === subSlugNorm || norm(val.ar) === subNameArNorm || norm(val.ar) === subNameEnNorm)) ||
          (val.en && (norm(val.en) === subNameNorm || norm(val.en) === subSlugNorm || norm(val.en) === subNameArNorm || norm(val.en) === subNameEnNorm))
        );
      }
      if (Array.isArray(val)) {
        return val.some(item => matchValue(item));
      }
      return (
        norm(val) === subNameNorm ||
        norm(val) === subSlugNorm ||
        norm(val) === subNameArNorm ||
        norm(val) === subNameEnNorm
      );
    }

    const filtered = products.filter(p =>
      matchValue(p.subCategory) ||
      matchValue(p.subcategory) ||
      matchValue(p.category) ||
      matchValue(p.mainCategory) ||
      (p.subcategorySlug && norm(p.subcategorySlug) === subSlugNorm) ||
      (p.subCategorySlug && norm(p.subCategorySlug) === subSlugNorm)
    );

    if (productsContainer) {
      const lang = document.documentElement.lang || document.documentElement.getAttribute('lang') || 'ar';
      if (filtered.length === 0) {
        productsContainer.innerHTML = lang === "en"
          ? "<p style='color:gray;'>No products for this subcategory.</p>"
          : "<p style='color:gray;'>لا توجد منتجات لهذه الفئة الفرعية.</p>";
      } else {
        renderProductsGrid(filtered, productsContainer);
      }
    }

    if (titleEl) {
      titleEl.textContent = subName;
      document.title = subName;
    }

    setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 100);
  });
});
}


  // 9. الآن بدء التنفيذ بعد تعريف الدوال
  try {
    // تحميل الفئات أولاً
    const categoriesData = await fetchCategories();
    window.categoriesData = categoriesData; // تخزينها عالمياً للاستخدام في الدوال
    
    // عرض الفئات في الواجهة
    renderMainCategoriesMenu(categoriesData);
    renderHorizontalCategories(categoriesData);
    activateCategoryMenuItems();

    // تطبيق لغة الفئات بعد رسمها (الأسماء مصدرها Categories.json فقط)
    try {
      const currentLang = localStorage.getItem('lang')
        || document.documentElement.lang
        || (document.documentElement.dir === 'rtl' ? 'ar' : 'en');
      if (typeof window.applyCategoryNames === 'function') {
        window.applyCategoryNames(currentLang);
      }
    } catch (e) {}

    
// تعديل معالج النقر على الفئات الرئيسية في الشريط الأفقي
if (categoriesContainer) {
  categoriesContainer.querySelectorAll('div').forEach(function(div, index) {
    const link = div.querySelector('a');
    if (!link) return;
    
    div.style.cursor = 'pointer';
    div.addEventListener('click', function(e) {
      e.preventDefault();
      
      // تحديد الفئة الحالية والفئة المستهدفة
      const currentCategoryId = new URLSearchParams(window.location.search).get('category') || 'all';
      const allCategories = Array.from(categoriesContainer.querySelectorAll('div'));
      const currentIndex = allCategories.findIndex(d => {
        const a = d.querySelector('a');
        if (!a) return false;
        const href = a.getAttribute('href') || '';
        const slugMatch = href.match(/\/categories\/([^\/\?]+)/);
        const catSlug = slugMatch ? slugMatch[1] : '';
        return catSlug === currentCategoryId;
      });
      
      // استخراج معلومات الفئة المستهدفة
      const span = link.querySelector('span[data-i18n]');
      let catName = document.documentElement.dir === 'rtl'
        ? (span ? span.textContent.trim() : link.textContent.trim())
        : (span ? span.textContent.trim() : link.textContent.trim());
      let i18n = span ? span.getAttribute('data-i18n') : '';
      
      const href = link.getAttribute('href') || '';
      const slugMatch = href.match(/\/categories\/([^\/\?]+)/);
      const categorySlug = slugMatch ? slugMatch[1] : catName;
      
      // تحديد اتجاه الانتقال (للأمام أو للخلف)
      const targetIndex = index;
      const direction = targetIndex > currentIndex ? 'next' : 'prev';
      
      // حفظ موضع التمرير
      try {
        let scrollPositions = JSON.parse(sessionStorage.getItem('categoryScrollPositions') || '{}');
        scrollPositions[currentCategoryId] = window.scrollY;
        sessionStorage.setItem('categoryScrollPositions', JSON.stringify(scrollPositions));
      } catch (err) {
        console.warn('تعذر حفظ موضع التمرير', err);
      }
      
      // التحقق مما إذا كانت هذه زيارة متكررة للفئة
      let scrollPositions = JSON.parse(sessionStorage.getItem('categoryScrollPositions') || '{}');
      const savedPosition = scrollPositions[categorySlug];
      const isRepeatedVisit = savedPosition !== undefined;
      
      // إضافة مؤشر بصري على الفئة النشطة
categoriesContainer.querySelectorAll('div a').forEach(a => a.classList.remove('active-category'));
const categoryLink = div.querySelector('a');
if (categoryLink) {
  categoryLink.classList.add('active-category');
}
      
      // غيّر الرابط مع إضافة علامة تمييز
      const url = `categories.html?category=${encodeURIComponent(categorySlug)}`;
      window.history.pushState({
        category: categorySlug,
        direction: direction,
        forceScrollTop: !isRepeatedVisit,
        isRepeatedVisit: isRepeatedVisit,
        timestamp: Date.now()
      }, '', url);
      
      // تحميل المنتجات وعرض الفئات الفرعية مع تحديد اتجاه الظهور
      loadProductsForCategory(categorySlug, categoriesData, direction);
      showSubCategories(catName, i18n, categoriesData);
      
      // استرجاع موضع التمرير للفئة السابقة إذا كانت زيارة متكررة
      if (isRepeatedVisit) {
        setTimeout(() => {
          window.scrollTo({
            top: savedPosition,
            behavior: 'auto'
          });
        }, 100);
      } else {
        // إذا كانت زيارة جديدة، تمرير للأعلى بشكل سلس
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    });
  });
}


    // عند تحميل الصفحة: جلب المنتجات حسب الفئة في الرابط
    const categoryFromUrl = getCategoryFromUrl();
    loadProductsForCategory(categoryFromUrl, categoriesData);
    
  } catch (error) {
    console.error('خطأ في تحميل البيانات:', error);
    // في حالة حدوث خطأ في تحميل الفئات، اعمل fallback آمن
    const categoryFromUrl = getCategoryFromUrl();
    try {
      // جلب المنتجات (انتظر النتيجة لتفادي حالات السباق)
      products = await fetchProducts();
    } catch (fetchErr) {
      console.error('تعذر جلب Products.json:', fetchErr);
      products = []; // احتياطي إذا فشل الجلب
    }
    // تأكد من تمرير مصفوفة فئات (فارغة) حتى لا يكسر الكود الذي يتوقع categoriesData
    const fallbackCategories = [];
    window.categoriesData = fallbackCategories;
    loadProductsForCategory(categoryFromUrl, fallbackCategories);
  }

  
  // 10. إضافة وظائف الواجهة الإضافية
  // شريط الفلتر (Dropdown)
  const filterDropdowns = document.querySelectorAll('.filter-dropdown');
  filterDropdowns.forEach(function(filterDropdown) {
    const filterToggle = filterDropdown.querySelector('.filter-toggle');
    if (filterToggle) {
      filterToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        filterDropdowns.forEach(d => {
          if (d !== filterDropdown) d.classList.remove('open');
        });
        filterDropdown.classList.toggle('open');
      });
    }
  });
  document.addEventListener('click', function(e) {
    filterDropdowns.forEach(function(filterDropdown) {
      if (!filterDropdown.contains(e.target)) {
        filterDropdown.classList.remove('open');
        const options = filterDropdown.querySelector('.filter-options');
        if (options) options.style.display = '';
      }
    });
  });



  // 11. شريط الفئات قابل للسحب
  if (categoriesContainer) {
    let isDownCategories = false;
    let startXCategories;
    let scrollLeftCategories;
    categoriesContainer.addEventListener('mousedown', (e) => {
      isDownCategories = true;
      categoriesContainer.classList.add('active');
      startXCategories = e.pageX - categoriesContainer.offsetLeft;
      scrollLeftCategories = categoriesContainer.scrollLeft;
      e.preventDefault();
      categoriesContainer.querySelectorAll('a').forEach(a => a.style.pointerEvents = 'none');
    });
    categoriesContainer.addEventListener('mouseleave', () => {
      isDownCategories = false;
      categoriesContainer.classList.remove('active');
      categoriesContainer.querySelectorAll('a').forEach(a => a.style.pointerEvents = '');
    });
    categoriesContainer.addEventListener('mouseup', () => {
      isDownCategories = false;
      categoriesContainer.classList.remove('active');
      categoriesContainer.querySelectorAll('a').forEach(a => a.style.pointerEvents = '');
    });
    categoriesContainer.addEventListener('mousemove', (e) => {
      if (!isDownCategories) return;
      e.preventDefault();
      const x = e.pageX - categoriesContainer.offsetLeft;
      const walk = (x - startXCategories);
      categoriesContainer.scrollLeft = scrollLeftCategories - walk;
    });
  }


  // 12. شريط الفلتر قابل للسحب
  if (filtersScroll) {
    let isDownFilters = false;
    let startXFilters;
    let scrollLeftFilters;
    filtersScroll.addEventListener('mousedown', (e) => {
      isDownFilters = true;
      filtersScroll.classList.add('active');
      startXFilters = e.pageX - filtersScroll.offsetLeft;
      scrollLeftFilters = filtersScroll.scrollLeft;
    });
    filtersScroll.addEventListener('mouseleave', () => {
      isDownFilters = false;
      filtersScroll.classList.remove('active');
    });
    filtersScroll.addEventListener('mouseup', () => {
      isDownFilters = false;
      filtersScroll.classList.remove('active');
    });
    filtersScroll.addEventListener('mousemove', (e) => {
      if (!isDownFilters) return;
      e.preventDefault();
      const x = e.pageX - filtersScroll.offsetLeft;
      const walk = (x - startXFilters);
      filtersScroll.scrollLeft = scrollLeftFilters - walk;
    });
  }

  
// تفعيل الفلترة عند تغيير أي فلتر
if (filtersScroll) {
  filtersScroll.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
    input.addEventListener('change', function() {
      applyFilters();
    });
  });
}

  // إضافة زر إعادة ضبط الفلاتر
  const resetFiltersBtn = document.querySelector('.reset-filters');
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', function() {
      // إلغاء تحديد جميع خيارات الفلتر
      filtersScroll.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked').forEach(input => {
        input.checked = false;
      });
      // تطبيق الفلاتر (سيعرض جميع المنتجات)
      applyFilters();
    });
  }

  // دالة تطبيق الفلاتر المنفصلة للتنظيم وإعادة الاستخدام
  function applyFilters() {
    // إضافة معرفات للفلاتر إذا لم تكن موجودة
    filtersScroll.querySelectorAll('.filter-dropdown').forEach(dropdown => {
      const filterToggle = dropdown.querySelector('.filter-toggle');
      if (!filterToggle) return;

      if (!filterToggle.hasAttribute('data-filter-id')) {
        // تحديد نوع الفلتر بناءً على النص
        const filterText = filterToggle.textContent.trim();
        let filterId = '';
        
        // تعيين معرف ثابت للفلتر بناءً على المحتوى
        if (filterText.includes('فلتر بالسعر') || filterText.includes('Price')) {
          filterId = 'price';
        } else if (filterText.includes('الأحدث') || filterText.includes('Newest')) {
          filterId = 'newest';
        } else if (filterText.includes('التقييم') || filterText.includes('Rating')) {
          filterId = 'rating';
        } else if (filterText.includes('اللون') || filterText.includes('Color')) {
          filterId = 'color';
        } else if (filterText.includes('الحجم') || filterText.includes('Size')) {
          filterId = 'size';
        } else if (filterText.includes('العلامة التجارية') || filterText.includes('Brand')) {
          filterId = 'brand';
        } else if (filterText.includes('التصنيف') || filterText.includes('Category')) {
          filterId = 'category';
        } else if (filterText.includes('المخزون') || filterText.includes('Stock')) {
          filterId = 'stock';
        } else if (filterText.includes('المراجعات') || filterText.includes('Reviews')) {
          filterId = 'reviews';
        } else if (filterText.includes('تاريخ الإضافة') || filterText.includes('Date')) {
          filterId = 'date';
        } else {
          // إذا لم نتعرف على الفلتر، نستخدم نصه مع إزالة الرموز التعبيرية والمسافات
          filterId = filterText.replace(/[\u{1F300}-\u{1F6FF}]/gu, '').trim().toLowerCase().replace(/\s+/g, '-');
        }
        
        filterToggle.setAttribute('data-filter-id', filterId);
      }
    });

    // اجمع القيم المختارة من كل فلتر باستخدام المعرفات
    const filters = {};
    filtersScroll.querySelectorAll('.filter-dropdown').forEach(dropdown => {
      const filterToggle = dropdown.querySelector('.filter-toggle');
      if (!filterToggle) return;
      
      // استخدام المعرف بدلاً من النص
      const filterId = filterToggle.getAttribute('data-filter-id');
      if (!filterId) return;
      
      const checkedInputs = dropdown.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked');
      if (checkedInputs.length > 0) {
        filters[filterId] = Array.from(checkedInputs).map(input => input.value);
      }
    });
    
    console.log('تطبيق الفلاتر:', filters); // للتشخيص
    
    // فلترة المنتجات بناءً على القيم المختارة
    let filtered = products.slice();
    
    // فلتر السعر
    if (filters.price && filters.price.length > 0) {
      filtered = filterByPrice(filtered, filters.price);
    }
    
    // فلتر الترتيب (الأحدث/الأقدم)
    if (filters.newest && filters.newest.length > 0) {
      filtered = sortProducts(filtered, filters.newest[0]);
    }
    
    // فلتر التقييم
    if (filters.rating && filters.rating.length > 0) {
      filtered = filterByRating(filtered, filters.rating);
    }
    
    // فلتر اللون
    if (filters.color && filters.color.length > 0) {
      filtered = filterByAttribute(filtered, 'color', filters.color);
    }
    
    // فلتر الحجم
    if (filters.size && filters.size.length > 0) {
      filtered = filterByAttribute(filtered, 'size', filters.size);
    }
    
    // فلتر العلامة التجارية
    if (filters.brand && filters.brand.length > 0) {
      filtered = filterByAttribute(filtered, 'brand', filters.brand);
    }
    
    // فلتر التصنيف (الفئة)
    if (filters.category && filters.category.length > 0) {
      filtered = filterByCategory(filtered, filters.category);
    }
    
    // فلتر المخزون
    if (filters.stock && filters.stock.length > 0) {
      filtered = filterByStock(filtered, filters.stock);
    }
    
    // فلتر المراجعات
    if (filters.reviews && filters.reviews.length > 0) {
      filtered = filterByReviews(filtered, filters.reviews);
    }
    
    // فلتر تاريخ الإضافة
    if (filters.date && filters.date.length > 0) {
      filtered = filterByDate(filtered, filters.date);
    }
    
    // عرض المنتجات المفلترة
    const productsContainer = document.getElementById('category-products');
    renderProductsGrid(filtered, productsContainer);
    
    // تحديث عداد المنتجات إذا وجد
    const productCounter = document.getElementById('product-count');
    if (productCounter) {
      const lang = document.documentElement.lang || document.documentElement.getAttribute('lang') || 'ar';
      const countText = lang === 'en' 
        ? `${filtered.length} Products` 
        : `${filtered.length} منتج`;
      productCounter.textContent = countText;
    }
  }

  // دوال الفلترة المتخصصة
  // 1. فلتر السعر
  function filterByPrice(products, priceFilters) {
    return products.filter(prod => {
      const price = getNumericValue(prod.price);
      
      return priceFilters.some(range => {
        // تعامل مع "1000+"
        if (range.includes('+')) {
          const min = getNumericValue(range);
          return price >= min;
        }
        
        // تعامل مع "100-500"
        if (range.includes('-')) {
          const [min, max] = range.split('-').map(getNumericValue);
          return price >= min && price <= max;
        }
        
        return false;
      });
    });
  }

  // 2. فلتر الترتيب
  function sortProducts(products, sortType) {
    const sorted = [...products];
    
    console.log('ترتيب المنتجات حسب:', sortType); // للتشخيص
    
    switch (sortType) {
      case 'latest':
        return sorted.sort((a, b) => {
          if (!a.date && !b.date) return (b.id || 0) - (a.id || 0);
          if (!a.date) return 1; // ضع المنتجات بدون تاريخ في النهاية
          if (!b.date) return -1;
          
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          
          if (isNaN(dateA) || isNaN(dateB)) {
            return (b.id || 0) - (a.id || 0);
          }
          
          return dateB - dateA;
        });
        
      case 'oldest':
        return sorted.sort((a, b) => {
          if (!a.date && !b.date) return (a.id || 0) - (b.id || 0);
          if (!a.date) return 1;
          if (!b.date) return -1;
          
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          
          if (isNaN(dateA) || isNaN(dateB)) {
            return (a.id || 0) - (b.id || 0);
          }
          
          return dateA - dateB;
        });
        
      case 'most-popular':
        return sorted.sort((a, b) => getNumericValue(b.views) - getNumericValue(a.views));
        
      case 'best-seller':
        return sorted.sort((a, b) => getNumericValue(b.sales) - getNumericValue(a.sales));
        
      case 'top-rated':
        return sorted.sort((a, b) => getNumericValue(b.rating) - getNumericValue(a.rating));
        
      case 'price-low-high':
        return sorted.sort((a, b) => getNumericValue(a.price) - getNumericValue(b.price));
        
      case 'price-high-low':
        return sorted.sort((a, b) => getNumericValue(b.price) - getNumericValue(a.price));
        
      default:
        return sorted;
    }
  }

  // 3. فلتر التقييم
  function filterByRating(products, ratingFilters) {
    return products.filter(prod => {
      const rating = Math.floor(getNumericValue(prod.rating));
      
      return ratingFilters.some(val => {
        const minRating = getNumericValue(val);
        return rating >= minRating;
      });
    });
  }

  // 4. فلتر حسب سمة (اللون، الحجم، العلامة التجارية)
  function filterByAttribute(products, attribute, filterValues) {
    return products.filter(prod => {
      if (!prod[attribute]) return false;
      
      const attributeValue = prod[attribute];
      const normalizedFilterValues = filterValues.map(v => String(v).toLowerCase().trim());
      
      // إذا كانت القيمة مصفوفة
      if (Array.isArray(attributeValue)) {
        const normalizedValues = attributeValue.map(v => String(v).toLowerCase().trim());
        return normalizedValues.some(val => 
          normalizedFilterValues.some(filterVal => 
            val.includes(filterVal) || filterVal.includes(val)
          )
        );
      }
      
      // إذا كانت القيمة كائن متعدد اللغات
      if (typeof attributeValue === 'object' && attributeValue !== null) {
        const lang = document.documentElement.lang || document.documentElement.getAttribute('lang') || 'ar';
        const localizedValue = String(attributeValue[lang] || attributeValue.ar || attributeValue.en || '').toLowerCase().trim();
        
        return normalizedFilterValues.some(filterVal => 
          localizedValue.includes(filterVal) || filterVal.includes(localizedValue)
        );
      }
      
      // إذا كانت القيمة نص بسيط
      const normalizedValue = String(attributeValue).toLowerCase().trim();
      return normalizedFilterValues.some(filterVal => 
        normalizedValue.includes(filterVal) || filterVal.includes(normalizedValue)
      );
    });
  }

  // 5. فلتر الفئة
  function filterByCategory(products, categoryFilters) {
    return products.filter(prod => {
      const normalizedCategoryFilters = categoryFilters.map(c => String(c).toLowerCase().trim());
      
      // جمع كل الحقول المحتملة للفئة
      const categoryFields = [
        prod.category && typeof prod.category === 'string' ? prod.category.toLowerCase().trim() : '',
        prod.mainCategory && typeof prod.mainCategory === 'string' ? prod.mainCategory.toLowerCase().trim() : '',
        prod.categoryName && typeof prod.categoryName === 'string' ? prod.categoryName.toLowerCase().trim() : '',
        prod.categorySlug ? prod.categorySlug.toLowerCase().trim() : '',
        prod.mainCategorySlug ? prod.mainCategorySlug.toLowerCase().trim() : ''
      ].filter(Boolean); // إزالة القيم الفارغة
      
      // التعامل مع القيم متعددة اللغات
      if (prod.category && typeof prod.category === 'object' && prod.category !== null) {
        if (prod.category.ar) categoryFields.push(prod.category.ar.toLowerCase().trim());
        if (prod.category.en) categoryFields.push(prod.category.en.toLowerCase().trim());
      }
      
      if (prod.mainCategory && typeof prod.mainCategory === 'object' && prod.mainCategory !== null) {
        if (prod.mainCategory.ar) categoryFields.push(prod.mainCategory.ar.toLowerCase().trim());
        if (prod.mainCategory.en) categoryFields.push(prod.mainCategory.en.toLowerCase().trim());
      }
      
      return categoryFields.some(field => 
        normalizedCategoryFilters.some(filterCat => 
          field.includes(filterCat) || filterCat.includes(field)
        )
      );
    });
  }

  // 6. فلتر المخزون
  function filterByStock(products, stockFilters) {
    return products.filter(prod => {
      const stock = getNumericValue(prod.stock);
      
      if (stockFilters.includes('in')) return stock > 0;
      if (stockFilters.includes('out')) return stock === 0;
      
      return true;
    });
  }

  // 7. فلتر المراجعات
  function filterByReviews(products, reviewFilters) {
    return products.filter(prod => {
      const ratingCount = getNumericValue(prod.ratingCount || prod.reviewCount || 0);
      
      if (reviewFilters.includes('with')) return ratingCount > 0;
      if (reviewFilters.includes('none')) return ratingCount === 0;
      
      return true;
    });
  }

  // 8. فلتر تاريخ الإضافة
  function filterByDate(products, dateFilters) {
    const now = Date.now();
    
    return products.filter(prod => {
      if (!prod.date) return false;
      
      try {
        // محاولة تحويل التاريخ إلى timestamp
        let prodDate;
        if (typeof prod.date === 'string') {
          prodDate = new Date(prod.date).getTime();
        } else if (typeof prod.date === 'number') {
          prodDate = prod.date;
        } else {
          return false;
        }
        
        if (isNaN(prodDate)) return false;
        
        return dateFilters.some(filter => {
          if (filter === '24h') return (now - prodDate) <= 24 * 60 * 60 * 1000;
          if (filter === 'week') return (now - prodDate) <= 7 * 24 * 60 * 60 * 1000;
          if (filter === 'month') return (now - prodDate) <= 30 * 24 * 60 * 60 * 1000;
          if (filter === 'year') return (now - prodDate) <= 365 * 24 * 60 * 60 * 1000;
          return true;
        });
      } catch (e) {
        console.error('خطأ في معالجة التاريخ:', e, prod.date);
        return false;
      }
    });
  }

  // 1. استخراج قيمة رقمية
  function getNumericValue(value) {
    if (value === null || value === undefined) return 0;
    
    if (typeof value === 'number') return value;
    
    if (typeof value === 'string') {
      // تجريد النص من أي شيء غير الأرقام والنقطة العشرية
      const cleanValue = value.replace(/[^\d.-]/g, '');
      return parseFloat(cleanValue) || 0;
    }
    
    if (typeof value === 'object' && value !== null) {
      // محاولة الحصول على قيمة من كائن متعدد اللغات
      const lang = document.documentElement.lang || document.documentElement.getAttribute('lang') || 'ar';
      const localizedValue = String(value[lang] || value.ar || value.en || '');
      const cleanValue = localizedValue.replace(/[^\d.-]/g, '');
      return parseFloat(cleanValue) || 0;
    }
    
    return 0;
  }

// 2. إضافة أزرار إلغاء لكل فلتر
if (filtersScroll) {
  filtersScroll.querySelectorAll('.filter-dropdown').forEach(dropdown => {
    // تجنب إضافة أزرار متكررة
    if (dropdown.querySelector('.clear-filter-btn')) return;
    
    const filterOptions = dropdown.querySelector('.filter-options');
    if (!filterOptions) return;
    
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-filter-btn';
    clearButton.textContent = document.documentElement.dir === 'rtl' ? 'مسح الفلتر' : 'Clear filter';
    clearButton.addEventListener('click', function(e) {
      e.stopPropagation();
      // إلغاء تحديد جميع خيارات هذا الفلتر
      dropdown.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked').forEach(input => {
        input.checked = false;
      });
      // تطبيق الفلاتر
      applyFilters();
      // إغلاق القائمة
      dropdown.classList.remove('open');
    });
    
    filterOptions.appendChild(clearButton);
  });
}

  // 13. إضافة CSS لتحسين القائمة المصغرة
  const style = document.createElement('style');
  style.textContent = `
    .category-item {
      position: relative;
    }
    .category-item:hover .category-flyout {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    .category-flyout {
      top: 0;
      right: 100%;
      min-width: 220px;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      border-radius: 4px;
      padding: 10px;
      display: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s;
      z-index: 1000;
    }
    
    /* إضافة CSS لمؤشر التحميل */
    body.loading::after {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255,255,255,0.5);
      z-index: 9999;
      pointer-events: none;
    }
    
    body.loading::before {
      content: '';
      position: fixed;
      top: 50%;
      left: 50%;
      width: 30px;
      height: 30px;
      margin: -15px 0 0 -15px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3498db;
      border-radius: 50%;
      z-index: 10000;
      animation: spin 1s linear infinite;
      pointer-events: none;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
});



// ...existing code...
(function() {
  if (window._swipeCategoryInit) return;
  window._swipeCategoryInit = true;

  function initSwipeCategory() {
    const THRESHOLD = 60;
    let startX = 0, startY = 0, isTracking = false, moved = false, touchStartEl = null;
    let activePointerId = null;

    const IGNORE = [
      '.categories',
      '.filters-scroll-container',
      '.filter-dropdown',
      '.subcategory-circle',
      '.subcategory',
      '.category-flyout',
      '.daily-picks-grid',
      '.dp-card'
    ];

    function shouldIgnore(el) {
      if (!el) return false;
      const node = (el.nodeType === 3 && el.parentElement) ? el.parentElement : el;
      try { return IGNORE.some(sel => node.closest && node.closest(sel)); }
      catch (e) { return false; }
    }

    function categoriesList() {
      const bar = document.querySelector('.categories');
      if (!bar) return [];
      return Array.from(bar.querySelectorAll('div a, a[data-category-slug], a[href*="categories"]'));
    }

    function getCurrentIndex(list) {
      if (!list || !list.length) return -1;
      const activeIdx = list.findIndex(a => a.classList.contains('active') || a.classList.contains('active-category'));
      if (activeIdx !== -1) return activeIdx;
      const cur = new URLSearchParams(window.location.search).get('category') || '';
      const found = list.findIndex(a => {
        const href = a.getAttribute('href') || '';
        const m = href.match(/\/categories\/([^\/\?]+)/);
        const slug = m ? m[1] : (a.getAttribute('data-category-slug') || '');
        return slug === cur;
      });
      return found !== -1 ? found : 0;
    }

    function activateIndex(idx) {
      const list = categoriesList();
      if (!list.length) return;
      idx = Math.max(0, Math.min(list.length - 1, idx));
      const el = list[idx];
      if (!el) return;
      console.log('activateIndex ->', idx, el.getAttribute('data-category-slug') || el.href);
      el.click();
      try { localStorage.setItem('activeCategoryIndex', String(idx)); } catch(e) {}
      const bar = document.querySelector('.categories');
      if (bar && el.closest('div')) {
        const parent = el.closest('div');
        const center = bar.offsetWidth / 2;
        const target = parent.offsetLeft + parent.offsetWidth / 2 - center;
        bar.scrollTo({ left: target, behavior: 'smooth' });
      }
    }

    // normalize event helpers
    function getPointFromTouchEvent(ev) {
      if (ev.touches && ev.touches.length) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY, cancelable: ev.cancelable };
      if (ev.changedTouches && ev.changedTouches.length) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY, cancelable: ev.cancelable };
      if (typeof ev.clientX === 'number') return { x: ev.clientX, y: ev.clientY, cancelable: ev.cancelable !== false };
      return null;
    }

    // touch handlers
    function onStart(ev, source) {
      const p = getPointFromTouchEvent(ev);
      if (!p) return;
      touchStartEl = ev.target || ev.srcElement;
      if (shouldIgnore(touchStartEl)) { isTracking = false; moved = false; return; }
      startX = p.x; startY = p.y; isTracking = true; moved = false;
      // debug -> temporary use console.log
      console.log('swipe:start', source, startX, startY, touchStartEl && touchStartEl.className);
    }

     function onMove(ev, source) {
      if (!isTracking) return;
      const p = getPointFromTouchEvent(ev);
      if (!p) return;
      if (shouldIgnore(touchStartEl)) return;
      const dx = p.x - startX, dy = p.y - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        moved = true;
        // تنها استدعاء preventDefault لو كان الحدث الأصلي قابل للإلغاء ولديه الدالة preventDefault
        if (p.cancelable && typeof ev.preventDefault === 'function') {
          try { ev.preventDefault(); } catch(e) {}
        }
        console.log('swipe:move horiz', dx);
      } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
        isTracking = false;
        moved = false;
        console.log('swipe:move vertical - stop tracking');
      }
    }

    function onEnd(ev, source) {
      console.log('swipe:end', source, 'moved=', moved, 'isTracking=', isTracking);
      if (!moved || !isTracking) { isTracking = false; touchStartEl = null; return; }
      const p = getPointFromTouchEvent(ev);
      if (!p) { isTracking = false; touchStartEl = null; return; }
      const dx = p.x - startX;
      isTracking = false; touchStartEl = null;
      if (Math.abs(dx) < THRESHOLD) { console.log('swipe:too-short', dx); return; }
      const list = categoriesList(); if (!list.length) return;
      const cur = getCurrentIndex(list);
      if (dx < 0) activateIndex(cur - 1);
      else activateIndex(cur + 1);
    }

    // attach listeners
    document.addEventListener('touchstart', function(ev){ onStart(ev, 'touch'); }, { passive: true });
    document.addEventListener('touchmove', function(ev){ onMove(ev, 'touch'); }, { passive: false });
    document.addEventListener('touchend', function(ev){ onEnd(ev, 'touch'); }, { passive: true });

    document.addEventListener('pointerdown', function(ev){
      if (ev.pointerType && ev.pointerType !== 'touch') return;
      activePointerId = ev.pointerId;
      onStart({ clientX: ev.clientX, clientY: ev.clientY, target: ev.target, cancelable: true }, 'pointer');
    }, { passive: true });

    document.addEventListener('pointermove', function(ev){
      if (activePointerId !== null && ev.pointerId !== activePointerId) return;
      if (ev.pointerType && ev.pointerType !== 'touch') return;
      onMove({ clientX: ev.clientX, clientY: ev.clientY, cancelable: true }, 'pointer');
    }, { passive: false });

    document.addEventListener('pointerup', function(ev){
      if (activePointerId !== null && ev.pointerId !== activePointerId) return;
      if (ev.pointerType && ev.pointerType !== 'touch') return;
      activePointerId = null;
      onEnd({ clientX: ev.clientX, clientY: ev.clientY, changedTouches: [{ clientX: ev.clientX, clientY: ev.clientY }], cancelable: true }, 'pointer');
    }, { passive: true });

    try {
      if (!document.getElementById('_swipeCategoryTouchStyle')) {
        const s = document.createElement('style');
        s.id = '_swipeCategoryTouchStyle';
        s.textContent = `
          html, body { touch-action: pan-y; }
          .categories, .filters-scroll-container, .filter-dropdown, .subcategory-circle, .subcategory { touch-action: pan-x; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
        `;
        document.head.appendChild(s);
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSwipeCategory);
  else initSwipeCategory();
})();


 // ===== صفحة تفاصيل المنتج =====
(function initProductDetailPage() {
  if (!document.getElementById('mainImage')) return;

  const params = new URLSearchParams(window.location.search);
  const productId = Number(params.get('id'));
  if (!productId) return;

  const lang = document.documentElement.lang || document.documentElement.getAttribute('lang') || 'ar';

  function getT(val) {
    if (!val) return '';
    if (typeof val === 'object') return val[lang] || val.ar || val.en || '';
    return String(val);
  }

  function getCurrSym(currency) {
    const s = { USD:{ar:'$',en:'$'}, EUR:{ar:'€',en:'€'}, AED:{ar:'د.إ',en:'AED'},
      SAR:{ar:'ر.س',en:'SAR'}, EGP:{ar:'ج.م',en:'EGP'}, JOD:{ar:'د.أ',en:'JOD'},
      KWD:{ar:'د.ك',en:'KWD'}, GBP:{ar:'£',en:'£'} };
    return (s[currency] && (s[currency][lang] || s[currency].en)) || (lang==='en'?'$':'د.إ');
  }

  function renderStars(r) {
    r = parseFloat(r) || 0;
    return '★'.repeat(Math.floor(r)) + (r%1>=0.5?'½':'') + '☆'.repeat(5 - Math.ceil(r));
  }

  function startTimer(timerEnd, el) {
    const wrap = document.getElementById('timer-box') || el.parentElement;
    if (!timerEnd) { if (wrap) wrap.style.display='none'; return; }
    const end = new Date(timerEnd).getTime();
    function tick() {
      const d = end - Date.now();
      if (d <= 0) { el.textContent = '00:00:00'; return; }
      el.textContent = [Math.floor(d/3600000), Math.floor((d%3600000)/60000), Math.floor((d%60000)/1000)]
        .map(n=>String(n).padStart(2,'0')).join(':');
    }
    tick(); setInterval(tick, 1000);
  }

  fetch('java/Products.json')
    .then(r => r.json())
    .then(all => {
      const p = all.find(x => x.id === productId);
      if (!p) {
        const pp = document.querySelector('.product-page');
        if (pp) pp.innerHTML = '<p style="padding:40px;color:#888;">المنتج غير موجود</p>';
        return;
      }

      const sym = getCurrSym(p.currency || localStorage.getItem('currency') || (lang==='en'?'USD':'AED'));

      /* ---- الوسائط: صور + فيديوهات ---- */
      const _arr = v => Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
      const _isVideo = s => /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(String(s || ''));
      // كل المصادر المكتوبة في img/images/image (قد تحتوي صوراً وفيديوهات)
      let allSources = _arr(p.images);
      if (!allSources.length) allSources = _arr(p.img);
      if (!allSources.length) allSources = _arr(p.image);
      const explicitVideos = _arr(p.videos).length ? _arr(p.videos) : _arr(p.video);
      // الصور فقط (لاستخدامها في السلة)
      const imgs = allSources.filter(s => !_isVideo(s));
      // قائمة موحدة: نحافظ على ترتيب المصادر ونصنّف كل عنصر، ثم الفيديوهات الصريحة
      const media = [
        ...allSources.map(src => ({ type: _isVideo(src) ? 'video' : 'image', src })),
        ...explicitVideos.map(src => ({ type: 'video', src }))
      ];

      const mainImg = document.getElementById('mainImage');
      const mainWrap = mainImg ? mainImg.parentElement : null;

      // إنشاء عنصر فيديو رئيسي (مخفي) داخل نفس حاوية العرض
      let mainVid = null;
      if (mainWrap) {
        mainVid = document.createElement('video');
        mainVid.id = 'mainVideo';
        mainVid.controls = true;
        mainVid.playsInline = true;
        mainVid.style.width = '100%';
        mainVid.style.height = '100%';
        mainVid.style.objectFit = 'cover';
        mainVid.style.display = 'none';
        mainWrap.appendChild(mainVid);
      }

      // عرض عنصر (صورة أو فيديو) في العارض الرئيسي
      function showMedia(item) {
        if (!item) return;
        if (item.type === 'video') {
          if (mainImg) mainImg.style.display = 'none';
          if (mainVid) { mainVid.src = item.src; mainVid.style.display = 'block'; }
        } else {
          if (mainVid) { try { mainVid.pause(); } catch(e) {} mainVid.style.display = 'none'; }
          if (mainImg) { mainImg.src = item.src; mainImg.style.display = 'block'; mainImg.alt = getT(p.name); }
        }
      }

      // عرض أول عنصر افتراضياً
      if (media[0]) showMedia(media[0]);

      const thumbs = document.getElementById('thumbs');
      if (thumbs) {
        thumbs.innerHTML = '';
        media.forEach((item, i) => {
          let thumb;
          if (item.type === 'video') {
            // مصغّرة فيديو مع أيقونة تشغيل
            thumb = document.createElement('div');
            thumb.className = 'thumb-video';
            const v = document.createElement('video');
            v.src = item.src;
            v.muted = true;
            v.preload = 'metadata';
            v.playsInline = true;
            v.style.width = '100%';
            v.style.height = '100%';
            v.style.objectFit = 'cover';
            const play = document.createElement('span');
            play.textContent = '▶';
            play.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:15px;text-shadow:0 1px 3px rgba(0,0,0,.6);pointer-events:none;';
            thumb.appendChild(v);
            thumb.appendChild(play);
          } else {
            thumb = document.createElement('img');
            thumb.src = item.src;
            thumb.alt = '';
          }
          if (i === 0) thumb.classList.add('active');
          thumb.addEventListener('click', () => {
            showMedia(item);
            thumbs.querySelectorAll('.active').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
          });
          thumbs.appendChild(thumb);
        });
      }

      /* ---- النصوص ---- */
      const set = (id, val) => { const el=document.getElementById(id); if (el) el.textContent=val; };

      set('category', getT(p.category));
      set('name', getT(p.name));
      document.title = getT(p.name) + ' - X2 Shopping';

      const starsEl = document.getElementById('stars');
      if (starsEl) starsEl.innerHTML =
        `<span style="color:#f59e0b;letter-spacing:1px">${renderStars(p.rating)}</span> <b>${p.rating||''}</b>`;
      set('ratingCount', p.ratingCount ? `(${p.ratingCount} ${lang==='en'?'reviews':'تقييم'})` : '');

      // نفس دالة الكروت لتوليد رقم مبيعات مختصر
      function generateCompactSales(productId) {
        const baseId = typeof productId === 'string'
          ? productId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
          : (productId || 0);
        const baseRange = [1.5, 2.3, 3.7, 4.2, 5.6, 6.8, 2.8, 3.2, 4.9, 5.2];
        const baseValue = baseRange[baseId % baseRange.length];
        const day = new Date().getDate();
        const variation = ((day % 10) / 10) * 0.3;
        const final = day % 2 === 0 ? baseValue + variation : baseValue - variation;
        return final.toFixed(1) + 'k+';
      }
      const compactSales = generateCompactSales(p.id || p.productId);
      set('sales', lang==='en' ? `sold ${compactSales}` : `تم بيع ${compactSales}`);

      /* ---- السعر ---- */
      const hasDisc = p.oldPrice && parseFloat(p.oldPrice) > parseFloat(p.price);
      set('price', p.price != null ? `${p.price} ${sym}` : '');
      const oldEl = document.getElementById('oldPrice');
      if (oldEl) { oldEl.textContent = hasDisc ? `${p.oldPrice} ${sym}` : ''; oldEl.style.display = hasDisc?'':'none'; }
      const discEl = document.getElementById('discount');
      if (discEl) {
        if (hasDisc) {
          const pct = Math.round((1 - parseFloat(p.price)/parseFloat(p.oldPrice))*100);
          discEl.textContent = `${pct}% ${lang==='en'?'OFF':'خصم'}`;
          discEl.style.display = '';
        } else discEl.style.display = 'none';
      }

      /* ---- المخزون والعداد ---- */
      set('stock', p.stock || '');
      const timerEl = document.getElementById('timer');
      if (timerEl) startTimer(p.timerEnd, timerEl);

      /* ---- الوصف ---- */
      set('desc', getT(p.desc));

      /* ---- الكمية ---- */
      const qty = document.getElementById('qty');
      document.getElementById('minus')?.addEventListener('click', () => { if(qty&&parseInt(qty.value)>1) qty.value=parseInt(qty.value)-1; });
      document.getElementById('plus')?.addEventListener('click', () => { if(qty) qty.value=parseInt(qty.value||1)+1; });

      /* ---- الأزرار ---- */
      const payload = () => ({ id:p.id, title:getT(p.name), img:imgs[0]||'',
        priceCurrent:parseFloat(p.price)||0, priceOld:parseFloat(p.oldPrice)||0, qty:parseInt(qty?.value)||1 });

      // دالة إضافة للسلة - تستخدم window.addProduct إن وُجد أو localStorage مباشرة
      function addToCart() {
        const item = payload();
        if (typeof window.addProduct === 'function') {
          window.addProduct(item);
        } else {
          // حفظ مباشر في localStorage بنفس مفتاح السلة
          try {
            const CART_KEY = 'x2_cart';
            const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
            const idx = cart.findIndex(i => String(i.id) === String(item.id));
            if (idx >= 0) cart[idx].qty += item.qty;
            else cart.unshift(item);
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
          } catch(e) {}
        }
      }

      document.querySelector('.product-page button.buy')?.addEventListener('click', () => {
        addToCart();
        window.location.href = 'Cart.html';
      });

      const cartBtn = document.querySelector('.product-page button.cart');
      if (cartBtn) cartBtn.addEventListener('click', () => {
        addToCart();
        const sp = cartBtn.querySelector('span') || cartBtn;
        const orig = sp.textContent;
        sp.textContent = lang==='en'?'✓ Added!':'✓ أضيف!';
        setTimeout(() => { sp.textContent = orig; }, 2000);
      });

      // زر واتساب - يفتح محادثة مع نص جاهز + بيانات العميل
      const waBtn = document.getElementById('whatsappOrderBtn');
      if (waBtn) {
        const readJson = (key, fallback) => {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed ?? fallback;
          } catch (e) {
            return fallback;
          }
        };

        const profile = readJson('x2_profile', {});
        const orders = readJson('x2_orders', []);
        const lastOrder = Array.isArray(orders) && orders.length ? orders[0] : null;
        const shipping = lastOrder?.shipping || {};
        const qtyVal = Math.max(1, Number(document.getElementById('qty')?.value || 1));

        const customerName = String(profile.name || shipping.name || '').trim() || 'غير متوفر';
        const customerPhone = String(profile.phone || shipping.phone || '').trim() || 'غير متوفر';
        const customerEmail = String(profile.email || '').trim() || 'غير متوفر';
        const customerCity = String(shipping.city || '').trim() || 'غير متوفر';
        const customerAddress = String(shipping.address || '').trim() || 'غير متوفر';

        const productUrl = window.location.href;
        const waMsg = encodeURIComponent([
          'مرحباً، أريد تخصيص طلب لهذا المنتج:',
          `🛍 المنتج: ${getT(p.name)}`,
          `🔢 الكمية: ${qtyVal}`,
          `💰 السعر: ${p.price != null ? p.price + ' ' + sym : 'غير متوفر'}`,
          `🔗 رابط المنتج: ${productUrl}`,
          '',
          'بيانات العميل:',
          `الاسم: ${customerName}`,
          `الهاتف: ${customerPhone}`,
          `البريد: ${customerEmail}`,
          `المدينة: ${customerCity}`,
          `العنوان: ${customerAddress}`
        ].join('\n'));
        waBtn.href = `https://wa.me/+971554423151?text=${waMsg}`;
      }

      /* ---- منتجات مشابهة ---- */
      const relEl = document.getElementById('relatedProducts');
      if (relEl) {
        const cat = getT(p.category);
        const rel = all.filter(x => x.id!==productId && getT(x.category)===cat).slice(0,6);
        if (rel.length && typeof createProductCard==='function') {
          const row = document.createElement('div');
          row.className = 'products-row';
          // inline styles removed — layout controlled by CSS column-count
          rel.forEach(x => row.appendChild(createProductCard(x)));
          relEl.appendChild(row);
        }
      }
    })
    .catch(e => console.error('خطأ تحميل المنتج:', e));
})();


