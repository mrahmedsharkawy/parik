import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SITE = "https://bariqgifts.com";
const PRODUCT_BASE = path.join(ROOT, "product");
const SEO_DIR = path.join(ROOT, "seo");

const PRODUCT_SELECT = [
  "id",
  "name_ar",
  "name_en",
  "description_ar",
  "description_en",
  "category_id",
  "subcategory_id",
  "price",
  "old_price",
  "stock",
  "image",
  "gallery",
  "rating",
  "featured",
  "active",
  "sort_order",
  "created_at",
  "updated_ta",
].join(",");

const STATIC_PAGES = [
  "/",
  "/offers",
  "/monthly-offers",
  "/categories",
  "/about-bariq",
  "/policy",
];

const LANDING_PAGES = [
  {
    path: "/gifts",
    title: "هدايا في الإمارات | بريق للهدايا والإبداع",
    h1: "هدايا مخصصة وتجهيز مناسبات في الإمارات",
    summary: "تصفح هدايا بريق في الإمارات حسب المناسبة أو الخامة، مع روابط مباشرة لصفحات المنتجات والفئات المتاحة.",
    description: "هدايا مخصصة وتجهيز مناسبات في الإمارات من بريق: مواليد، تخرج، رمضان، اليوم الوطني، أكريليك، فوركس، خشب، جلد، ورق واستيكر.",
    image: "/assets/home/banners/hero-1.webp",
    links: [
      ["/gifts/newborn-gifts-uae", "هدايا مواليد"],
      ["/gifts/national-day-gifts-uae", "هدايا اليوم الوطني"],
      ["/gifts/acrylic-gifts-uae", "هدايا أكريليك"],
      ["/gifts/forex-gifts-uae", "هدايا فوركس"],
      ["/gifts/leather-gifts-uae", "هدايا جلد"],
      ["/gifts/paper-gifts-uae", "هدايا ورق"],
    ],
    keywords: ["هدايا", "هدايا مخصصة", "هدايا الإمارات", "بريق للهدايا"],
  },
  {
    path: "/custom-gifts",
    title: "هدايا مخصصة في الإمارات | بريق",
    h1: "هدايا مخصصة حسب الاسم أو التصميم",
    summary: "يمكنك تصفح منتجات قابلة للتخصيص حسب الخامة والمناسبة، ثم تأكيد تفاصيل التصميم والبروفة قبل التنفيذ.",
    description: "هدايا مخصصة في الإمارات من بريق: أسماء، شعارات وتصاميم حسب المنتج والخامة، مع روابط لفئات الأكريليك والفوركس والخشب والجلد والورق.",
    image: "/assets/categories/Acrylic/Stand.webp",
    links: [["/gifts/acrylic-gifts-uae", "أكريليك"], ["/gifts/forex-gifts-uae", "فوركس"], ["/gifts/wood-gifts-uae", "خشب"], ["/gifts/leather-gifts-uae", "جلد"]],
    keywords: ["هدايا مخصصة", "تخصيص هدايا", "طباعة اسم", "شعار"],
  },
  {
    path: "/corporate-gifts",
    title: "هدايا شركات وهدايا دعائية | بريق الإمارات",
    h1: "هدايا شركات وهدايا دعائية في الإمارات",
    summary: "اختيارات مناسبة للشركات والفعاليات والموظفين حسب المنتج والكمية ونوع التخصيص المطلوب.",
    description: "هدايا شركات وهدايا دعائية من بريق في الإمارات تشمل خيارات قابلة للتخصيص للشعارات والفعاليات والموظفين حسب المنتج والكمية.",
    image: "/assets/categories/Forex/stands.webp",
    links: [["/custom-gifts", "تخصيص حسب الشعار"], ["/events", "تجهيز فعاليات"], ["/categories", "كل المنتجات"]],
    keywords: ["هدايا شركات", "هدايا دعائية", "براندنق", "لوجو"],
  },
  {
    path: "/events",
    title: "تجهيز مناسبات وحفلات وفعاليات | بريق",
    h1: "تجهيز مناسبات وحفلات وفعاليات",
    summary: "روابط منظمة لمنتجات وتجهيزات يمكن استخدامها في المناسبات والفعاليات حسب الفئات الفعلية في الموقع.",
    description: "تجهيز مناسبات وفعاليات من بريق: استانـدات، طاولات، مجسمات، لوحات، هدايا وتوزيعات مرتبطة بالفئات الفعلية في الموقع.",
    image: "/assets/categories/Occasions/Graduation.webp",
    links: [["/gifts/newborn-gifts-uae", "مواليد"], ["/graduation", "تخرج"], ["/gifts/forex-gifts-uae", "فوركس للفعاليات"]],
    keywords: ["تجهيز مناسبات", "فعاليات", "حفلات", "توزيعات"],
  },
  {
    path: "/gifts/newborn-gifts-uae",
    legacy: "/newborn",
    title: "هدايا مواليد وتجهيز استقبال مولود في الإمارات | بريق",
    h1: "هدايا مواليد وتجهيز استقبال مولود",
    summary: "صفحة تجمع منتجات المواليد الصالحة للفهرسة من بريق وروابط الفئات المرتبطة بها.",
    description: "هدايا مواليد وتجهيز استقبال مولود في الإمارات من بريق، تشمل أطقم مواليد أكريليك وجلد وخيارات مناسبة حسب المنتجات المتاحة.",
    image: "/assets/categories/Occasions/born-in.webp",
    productMatch: ["مواليد", "مولود", "استقبال"],
    links: [["/categories?category=Occasions&subcategory=Born-in", "منتجات مواليد"], ["/categories?category=Acrylic&subcategory=Born+in", "مواليد أكريليك"]],
    keywords: ["مواليد", "هدايا مواليد", "أطقم مواليد", "استقبال مولود"],
  },
  {
    path: "/gifts/national-day-gifts-uae",
    legacy: "/national-day",
    title: "هدايا اليوم الوطني الإماراتي | بريق",
    h1: "هدايا ومنتجات اليوم الوطني",
    summary: "منتجات مناسبة لليوم الوطني والفعاليات الوطنية حسب المتاح في قسم المناسبات.",
    description: "هدايا ومنتجات اليوم الوطني الإماراتي من بريق، مع روابط مباشرة لقسم المناسبات ومنتجات قابلة للتخصيص حسب المتاح.",
    image: "/assets/categories/Occasions/National Day.webp",
    productMatch: ["وطني", "اليوم الوطني", "امارات"],
    links: [["/categories?category=Occasions&subcategory=National+Day", "منتجات اليوم الوطني"], ["/corporate-gifts", "طلبات الشركات"]],
    keywords: ["اليوم الوطني", "هدايا اليوم الوطني", "هدايا الإمارات"],
  },
  {
    path: "/gifts/acrylic-gifts-uae",
    legacy: "/acrylic",
    title: "هدايا ومنتجات أكريليك مخصصة | بريق",
    h1: "منتجات أكريليك وهدايا مخصصة",
    summary: "الأكريليك مناسب لمنتجات مثل البوكس، الطاولات، الصواني، المباخر والاستاندات حسب المتاح في الموقع.",
    description: "منتجات أكريليك وهدايا مخصصة من بريق في الإمارات: بوكس، طاولات، صواني، مباخر واستاندات مع روابط مباشرة للفئات الفرعية.",
    image: "/assets/categories/Acrylic/Box.webp",
    productMatch: ["اكريلك", "أكريليك", "acrylic"],
    links: [["/categories?category=Acrylic", "منتجات الأكريليك"], ["/categories?category=Acrylic&subcategory=Box", "بوكس أكريليك"]],
    keywords: ["أكريليك", "اكريلك", "هدايا أكريليك", "بوكس أكريليك"],
  },
  {
    path: "/gifts/forex-gifts-uae",
    legacy: "/forex",
    title: "منتجات فوركس واستاندات مخصصة | بريق",
    h1: "منتجات فوركس وتجهيزات مناسبات",
    summary: "الفوركس يستخدم في منتجات وتجهيزات مثل الاستاندات والمجسمات والطاولات للفعاليات والمناسبات.",
    description: "منتجات فوركس من بريق للفعاليات والمناسبات: طاولات، استاندات، مجسمات ودوران حسب الأقسام المتاحة.",
    image: "/assets/categories/Forex/stands.webp",
    productMatch: ["فوركس", "forex", "foam"],
    links: [["/categories?category=Forex", "منتجات فوركس"], ["/categories?category=Forex&subcategory=stands", "استاندات فوركس"]],
    keywords: ["فوركس", "forex", "استاند فوركس", "تجهيز فعاليات"],
  },
  {
    path: "/gifts/wood-gifts-uae",
    legacy: "/wood",
    title: "هدايا ومنتجات خشب مخصصة | بريق",
    h1: "منتجات خشب مخصصة للمناسبات",
    summary: "قسم الخشب يضم روابط لمنتجات مثل الطاولات والكراسي والمجسمات حسب المتاح في موقع بريق.",
    description: "منتجات خشبية وهدايا خشب مخصصة من بريق مثل الطاولات والكراسي والمجسمات والمنتجات المرتبطة بالمناسبات.",
    image: "/assets/categories/wood/tables.webp",
    productMatch: ["خشب", "wood"],
    links: [["/categories?category=wood", "منتجات الخشب"], ["/categories?category=wood&subcategory=tables", "طاولات خشب"]],
    keywords: ["خشب", "هدايا خشب", "طاولات خشب"],
  },
  {
    path: "/gifts/leather-gifts-uae",
    legacy: "/leather",
    title: "هدايا ومنتجات جلد مخصصة | بريق",
    h1: "منتجات جلد مخصصة",
    summary: "منتجات الجلد في بريق تشمل روابط للبوكسات والصواني والطاولات ومنتجات مواليد حسب المتاح في الفئات.",
    description: "منتجات جلد مخصصة من بريق تشمل بوكسات، صواني، طاولات ومنتجات مواليد حسب الفئات المتاحة في الموقع.",
    image: "/assets/categories/leather/boxes.webp",
    productMatch: ["جلد", "leather"],
    links: [["/categories?category=leather", "منتجات الجلد"], ["/categories?category=leather&subcategory=born-in", "جلد مواليد"]],
    keywords: ["جلد", "هدايا جلد", "بوكس جلد"],
  },
  {
    path: "/gifts/paper-gifts-uae",
    title: "هدايا ومنتجات ورق مخصصة | بريق",
    h1: "منتجات ورق وبوكسات ورقية",
    summary: "روابط لمنتجات الورق والبوكسات الورقية حسب الفئات والمنتجات المتاحة داخل الموقع.",
    description: "منتجات ورق وبوكسات ورقية من بريق للهدايا والمناسبات، مع روابط مباشرة لقسم الورق والفئات الفرعية المتاحة.",
    image: "/assets/categories/Paper/Paper box.webp",
    productMatch: ["ورق", "paper", "بوكس ورق"],
    links: [["/categories?category=Paper", "منتجات الورق"], ["/categories?category=Paper&subcategory=Paper+box", "بوكس ورق"]],
    keywords: ["ورق", "بوكس ورق", "هدايا ورقية"],
  },
  {
    path: "/gifts/sticker-gifts-uae",
    legacy: "/stickers",
    title: "استيكر مخصص للمناسبات | بريق",
    h1: "استيكر مخصص للمناسبات",
    summary: "روابط منتجات الاستيكر المتاحة في بريق، بما يشمل المواليد والمناسبات والأنواع الكاملة أو الفارغة.",
    description: "استيكرات ومنتجات استيكر مخصصة من بريق للمناسبات والمواليد والمنتجات الكاملة أو الفارغة حسب الفئات المتاحة.",
    image: "/assets/categories/Sticker/occasions.webp",
    productMatch: ["استيكر", "ستيكر", "sticker"],
    links: [["/categories?category=Sticker", "منتجات الاستيكر"], ["/categories?category=Sticker&subcategory=born-in", "استيكر مواليد"]],
    keywords: ["استيكر", "ستيكر", "استيكر مخصص"],
  },
  {
    path: "/gifts/ramadan-gifts-uae",
    legacy: "/ramadan",
    title: "هدايا رمضان ومنتجات رمضانية | بريق",
    h1: "هدايا رمضان ومنتجات رمضانية",
    summary: "روابط منظمة لمنتجات رمضان المتاحة في بريق من الخشب والأكريليك والفوركس والجلد.",
    description: "تصفح منتجات رمضان من بريق حسب الخامة: خشب، أكريليك، فوركس وجلد، مع روابط مباشرة للأقسام المتاحة.",
    image: "/assets/categories/Ramadan/acrylic.webp",
    productMatch: ["رمضان", "ramadan"],
    links: [["/categories?category=Ramadan", "كل منتجات رمضان"], ["/categories?category=Ramadan&subcategory=wood", "رمضان خشب"]],
    keywords: ["رمضان", "هدايا رمضان", "منتجات رمضانية"],
  },
  {
    path: "/graduation",
    title: "هدايا تخرج وتجهيزات حفلات التخرج | بريق",
    h1: "هدايا تخرج وتجهيزات حفلات التخرج",
    summary: "اختيارات تخرج يمكن تصفحها من قسم المناسبات، مع منتجات قابلة للتخصيص حسب الاسم أو التصميم المتاح.",
    description: "هدايا تخرج وتجهيزات حفلات التخرج من بريق في الإمارات، مع روابط لمنتجات المناسبات القابلة للتخصيص حسب المتاح.",
    image: "/assets/categories/Occasions/Graduation.webp",
    productMatch: ["تخرج", "graduation"],
    links: [["/categories?category=Occasions&subcategory=Graduation", "منتجات التخرج"], ["/events", "تجهيز المناسبات"]],
    keywords: ["تخرج", "هدايا تخرج", "حفلات تخرج"],
  },
];

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value) {
  if (value == null) return "";
  if (typeof value === "object") return value.ar || value.en || value.name_ar || value.name_en || "";
  return String(value);
}

function compact(value) {
  return text(value).replace(/\s+/g, " ").trim();
}

function numberValue(value) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function slugify(value, fallback = "product") {
  const base = compact(value)
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 90);
  return base || fallback;
}

function encodePathSegment(segment) {
  return encodeURIComponent(segment).replace(/%2F/gi, "-");
}

function absoluteUrl(url) {
  const raw = compact(url);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return "https:" + raw;
  return SITE + "/" + raw.replace(/^\/+/, "");
}

function firstImage(product) {
  const gallery = Array.isArray(product.gallery)
    ? product.gallery
    : typeof product.gallery === "string"
      ? product.gallery.split(/[,\n]/)
      : [];
  return absoluteUrl([product.image, ...gallery].find(Boolean) || "");
}

function allImages(product) {
  const gallery = Array.isArray(product.gallery)
    ? product.gallery
    : typeof product.gallery === "string"
      ? product.gallery.split(/[,\n]/)
      : [];
  return [...new Set([product.image, ...gallery].map(absoluteUrl).filter((url) => /\.(avif|webp|png|jpe?g|gif)(\?|#|$)/i.test(url)))].slice(0, 8);
}

function allVideos(product) {
  const gallery = Array.isArray(product.gallery)
    ? product.gallery
    : typeof product.gallery === "string"
      ? product.gallery.split(/[,\n]/)
      : [];
  return [...new Set(gallery.map(absoluteUrl).filter((url) => /\.(mp4|webm|mov)(\?|#|$)/i.test(url)))].slice(0, 4);
}

function productName(product) {
  return compact(product.name_ar) || compact(product.name_en) || `منتج ${product.id}`;
}

function productDescription(product, categoryName) {
  const real = compact(product.description_ar) || compact(product.description_en);
  if (real) return real.slice(0, 260);
  return `${productName(product)} من بريق للهدايا في الإمارات${categoryName ? ` ضمن فئة ${categoryName}` : ""}.`;
}

function productPath(product) {
  return `/product/${encodePathSegment(product.id)}/${encodePathSegment(slugify(productName(product), `product-${product.id}`))}`;
}

function noindexReasons(product) {
  const reasons = [];
  const name = productName(product);
  const normalized = name.replace(/\s+/g, " ").trim().toLowerCase();
  const img = firstImage(product);
  const price = numberValue(product.price);
  if (!product.id) reasons.push("missing_id");
  if (product.active === false) reasons.push("inactive");
  if (!name || name.length < 3) reasons.push("missing_name");
  if (/^(منتج|منتج جديد|جديد|تست|test|new product)$/i.test(normalized)) reasons.push("placeholder_name");
  if (/(^|\s)(تيست|تست|test)(\s|$)/i.test(normalized) || /^جديد(\s+جديد|\s+فيديو)?/i.test(normalized)) reasons.push("placeholder_name");
  if (/^منتج\s+\d+/i.test(normalized) || (normalized.match(/منتج/g) || []).length >= 2) reasons.push("placeholder_name");
  if (/^(\d)\1{3,}$/.test(normalized) || /\d{6,}/.test(normalized)) reasons.push("placeholder_numeric_name");
  if (!img || /assets\/logo|logo\.png|placeholder/i.test(img)) reasons.push("missing_or_placeholder_image");
  if (price <= 0) reasons.push("missing_price");
  return reasons;
}

async function readSupabaseConfig() {
  const local = await fs.readFile(path.join(ROOT, "java", "supabase.js"), "utf8");
  const url =
    process.env.BARIQ_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    (local.match(/SUPABASE_URL\s*=\s*"([^"]+)"/) || [])[1];
  const anon =
    process.env.BARIQ_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    (local.match(/SUPABASE_ANON\s*=\s*"([^"]+)"/s) || [])[1];
  if (!url || !anon) throw new Error("Missing Supabase URL or anon key.");
  return { url, anon };
}

async function sbGet(config, table, params = "") {
  const endpoint = `${config.url}/rest/v1/${table}${params ? `?${params}` : ""}`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: config.anon,
      Authorization: `Bearer ${config.anon}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase ${table} failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function getPaged(config, table, params, pageSize = 500, maxRows = 5000) {
  const rows = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const batch = await sbGet(config, table, `${params}&limit=${pageSize}&offset=${offset}`);
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function mapById(rows) {
  const map = new Map();
  for (const row of rows || []) map.set(String(row.id), row);
  return map;
}

function categoryLabel(product, categories, subcategories) {
  const sub = subcategories.get(String(product.subcategory_id || ""));
  const cat = categories.get(String(product.category_id || ""));
  return compact(sub?.name_ar) || compact(cat?.name_ar) || compact(sub?.name_en) || compact(cat?.name_en) || "";
}

function replaceMeta(html, selector, tag) {
  const re = new RegExp(`<meta\\s+${selector}[^>]*>`, "i");
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `  ${tag}\n</head>`);
}

function setHead(html, product, categories, subcategories) {
  const category = categoryLabel(product, categories, subcategories);
  const name = productName(product);
  const description = productDescription(product, category);
  const canonical = SITE + productPath(product);
  const image = firstImage(product) || `${SITE}/assets/logo.png`;
  const price = numberValue(product.price);
  const oldPrice = numberValue(product.old_price);
  const reasons = noindexReasons(product);
  const availability = Number(product.stock) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonical}#product`,
    name,
    description,
    image: allImages(product).length ? allImages(product) : [image],
    sku: String(product.id),
    brand: { "@type": "Brand", name: "Bariq Gifts" },
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "AED",
      price: price.toFixed(2),
      availability,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Bariq Gifts" },
    },
  };
  const videos = allVideos(product);
  if (videos.length) {
    jsonLd.video = videos.map((contentUrl, index) => ({
      "@type": "VideoObject",
      name: `${name} ${index + 1}`,
      description,
      thumbnailUrl: image,
      contentUrl,
      uploadDate: compact(product.updated_at || product.created_at || new Date().toISOString()),
    }));
  }
  if (oldPrice > price && price > 0) jsonLd.offers.highPrice = oldPrice.toFixed(2);
  const inject = [
    `<meta property="product:price:amount" content="${esc(price.toFixed(2))}">`,
    `<meta property="product:price:currency" content="AED">`,
    `<link rel="image_src" href="${esc(image)}">`,
    `<script type="application/ld+json" id="seo-product-jsonld">${JSON.stringify(jsonLd)}</script>`,
  ].join("\n  ");

  let out = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${esc(name)} | بريق للهدايا</title>`)
    .replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${esc(canonical)}">`);
  out = replaceMeta(out, `name=["']description["']`, `<meta name="description" content="${esc(description)}">`);
  out = replaceMeta(out, `name=["']robots["']`, `<meta name="robots" content="${reasons.length ? "noindex, follow" : "index, follow"}">`);
  out = replaceMeta(out, `property=["']og:title["']`, `<meta property="og:title" content="${esc(name)}">`);
  out = replaceMeta(out, `property=["']og:description["']`, `<meta property="og:description" content="${esc(description)}">`);
  out = replaceMeta(out, `property=["']og:image["']`, `<meta property="og:image" content="${esc(image)}">`);
  out = replaceMeta(out, `property=["']og:url["']`, `<meta property="og:url" content="${esc(canonical)}">`);
  out = replaceMeta(out, `property=["']og:type["']`, `<meta property="og:type" content="product">`);
  out = replaceMeta(out, `name=["']twitter:title["']`, `<meta name="twitter:title" content="${esc(name)}">`);
  out = replaceMeta(out, `name=["']twitter:description["']`, `<meta name="twitter:description" content="${esc(description)}">`);
  out = replaceMeta(out, `name=["']twitter:image["']`, `<meta name="twitter:image" content="${esc(image)}">`);
  return out.replace("</head>", `  ${inject}\n</head>`);
}

function xmlUrl(loc, lastmod, extras = "") {
  return `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${esc(lastmod)}</lastmod>${extras}\n  </url>`;
}

function landingProducts(landing, productIndex) {
  const needles = (landing.productMatch || landing.keywords || []).map((item) => compact(item).toLowerCase()).filter(Boolean);
  return productIndex
    .filter((product) => product.indexable)
    .filter((product) => {
      if (!needles.length) return true;
      const haystack = `${product.name} ${product.category}`.toLowerCase();
      return needles.some((needle) => haystack.includes(needle));
    })
    .slice(0, 8);
}

function productCard(product) {
  return `<article class="card product-card">
    <a href="${esc(product.url.replace(SITE, ""))}">
      <img src="${esc(product.image)}" alt="${esc(product.name)}" width="360" height="360" loading="lazy">
      <h3>${esc(product.name)}</h3>
      <p>${esc(product.price ? `AED ${product.price}` : "السعر حسب المنتج")}</p>
    </a>
  </article>`;
}

function landingHtml(landing, products = []) {
  const canonical = SITE + landing.path;
  const image = absoluteUrl(landing.image);
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: landing.h1, item: canonical },
    ],
  };
  const itemList = products.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: landing.h1,
        itemListElement: products.map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: product.url,
          name: product.name,
        })),
      }
    : null;
  const schemas = [breadcrumb, itemList].filter(Boolean).map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`).join("");
  const links = landing.links.map(([href, label]) => `<a href="${esc(href)}">${esc(label)}</a>`).join("");
  const productCards = products.map(productCard).join("");
  const productSection = productCards
    ? `<section class="section"><h2>منتجات مرتبطة</h2><div class="grid products-grid">${productCards}</div></section>`
    : `<section class="section"><h2>منتجات مرتبطة</h2><p>يتم تحديث المنتجات المرتبطة بهذه الفئة من بيانات المتجر الفعلية عند توفر منتجات صالحة للفهرسة.</p></section>`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(landing.title)}</title>
  <meta name="description" content="${esc(landing.description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(landing.title)}">
  <meta property="og:description" content="${esc(landing.description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${esc(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(landing.title)}">
  <meta name="twitter:description" content="${esc(landing.description)}">
  <meta name="twitter:image" content="${esc(image)}">
  <link rel="stylesheet" href="/seo-landing.css">
  ${schemas}
</head>
<body>
  <div class="seo-page">
    <header class="seo-header">
      <nav class="seo-nav">
        <a class="seo-brand" href="/"><img src="/assets/logo.png" alt="بريق" width="44" height="44">بريق</a>
        <div class="seo-links"><a href="/gifts">الهدايا</a><a href="/categories">الفئات</a><a href="/about-bariq">عن بريق</a></div>
      </nav>
    </header>
    <main class="seo-main">
      <div class="crumbs"><a href="/">الرئيسية</a> / ${esc(landing.h1)}</div>
      <section class="hero">
        <div>
          <h1>${esc(landing.h1)}</h1>
          <p>${esc(landing.summary)}</p>
          <div class="actions">${links}</div>
        </div>
        <img class="hero-img" src="${esc(landing.image)}" alt="${esc(landing.h1)} من بريق" width="640" height="480">
      </section>
      ${productSection}
      <section class="section faq">
        <h2>معلومات مفيدة</h2>
        <details open><summary>هل المنتجات يتم تحديثها؟</summary><p>نعم، صفحات الفهرسة تتولد من بيانات المنتجات والفئات الفعلية أثناء البناء.</p></details>
        <details><summary>هل يمكن تخصيص المنتج؟</summary><p>التخصيص يعتمد على نوع المنتج والخامة والتصميم المطلوب، ويتم تأكيد التفاصيل مع العميل قبل التنفيذ.</p></details>
      </section>
    </main>
  </div>
</body>
</html>`;
}

async function writeLandingPage(landing, products) {
  const target = landing.path === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, landing.path.replace(/^\//, ""), "index.html");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, landingHtml(landing, products), "utf8");

  if (landing.legacy) {
    const legacyTarget = path.join(ROOT, `${landing.legacy.replace(/^\//, "")}.html`);
    await fs.writeFile(legacyTarget, landingHtml({ ...landing, path: landing.legacy }, products), "utf8");
  } else if (!landing.path.startsWith("/gifts/") && landing.path !== "/gifts") {
    const flatTarget = path.join(ROOT, `${landing.path.replace(/^\//, "")}.html`);
    await fs.writeFile(flatTarget, landingHtml(landing, products), "utf8");
  }
}

async function removePreviousGenerated() {
  try {
    const report = JSON.parse(await fs.readFile(path.join(SEO_DIR, "build-report.json"), "utf8"));
    for (const file of report.generatedProductFiles || []) {
      const resolved = path.resolve(ROOT, file);
      if (resolved.startsWith(path.resolve(PRODUCT_BASE))) await fs.rm(resolved, { force: true });
    }
  } catch {}
}

async function main() {
  const startedAt = new Date().toISOString();
  const config = await readSupabaseConfig();
  const [products, categoriesRows, subcategoryRows] = await Promise.all([
    getPaged(config, "products", `select=${encodeURIComponent(PRODUCT_SELECT)}&active=eq.true&order=sort_order.asc`, 500, 5000),
    sbGet(config, "categories", "select=*&active=eq.true&order=sort_order.asc"),
    sbGet(config, "subcategories", "select=*&active=eq.true&order=sort_order.asc"),
  ]);
  const categories = mapById(categoriesRows);
  const subcategories = mapById(subcategoryRows);
  const template = await fs.readFile(path.join(ROOT, "product.html"), "utf8");
  await fs.mkdir(PRODUCT_BASE, { recursive: true });
  await fs.mkdir(SEO_DIR, { recursive: true });
  await removePreviousGenerated();

  const generatedProductFiles = [];
  const noindexProducts = [];
  const productIndex = [];
  const sitemap = [];
  const imageSitemap = [];
  const videoSitemap = [];
  const today = startedAt.slice(0, 10);

  for (const page of STATIC_PAGES) sitemap.push(xmlUrl(SITE + page, today));

  for (const cat of categoriesRows) {
    const catSlug = encodePathSegment(slugify(cat.slug || cat.category_slug || cat.name_en || cat.name_ar, `category-${cat.id}`));
    sitemap.push(xmlUrl(`${SITE}/categories/${catSlug}`, compact(cat.updated_at || cat.created_at || today).slice(0, 10) || today));
  }

  for (const product of products) {
    const reasons = noindexReasons(product);
    const relPath = productPath(product).replace(/^\//, "");
    const outDir = path.join(ROOT, relPath);
    const outFile = path.join(outDir, "index.html");
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(outFile, setHead(template, product, categories, subcategories), "utf8");
    generatedProductFiles.push(path.relative(ROOT, outFile).replace(/\\/g, "/"));
    const url = SITE + productPath(product);
    const lastmod = compact(product.updated_at || product.updated_ta || product.created_at || today).slice(0, 10) || today;
    if (reasons.length) {
      noindexProducts.push({ id: product.id, name: productName(product), url, reasons });
    } else {
      sitemap.push(xmlUrl(url, lastmod, "\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>"));
      const images = allImages(product);
      if (images.length) {
        imageSitemap.push(xmlUrl(url, lastmod, images.map((img) => `\n    <image:image><image:loc>${esc(img)}</image:loc><image:title>${esc(productName(product))}</image:title></image:image>`).join("")));
      }
      const videos = allVideos(product);
      if (videos.length) {
        const thumbnail = firstImage(product) || `${SITE}/assets/logo.png`;
        const description = productDescription(product, categoryLabel(product, categories, subcategories));
        videoSitemap.push(xmlUrl(url, lastmod, videos.map((video) => `\n    <video:video><video:thumbnail_loc>${esc(thumbnail)}</video:thumbnail_loc><video:title>${esc(productName(product))}</video:title><video:description>${esc(description)}</video:description><video:content_loc>${esc(video)}</video:content_loc></video:video>`).join("")));
      }
    }
    productIndex.push({
      id: product.id,
      name: productName(product),
      url,
      indexable: !reasons.length,
      noindex_reasons: reasons,
      category: categoryLabel(product, categories, subcategories),
      price: numberValue(product.price),
      currency: "AED",
      image: firstImage(product),
      updated_at: product.updated_at || product.updated_ta || product.created_at || null,
    });
  }

  const generatedLandingPages = [];
  for (const landing of LANDING_PAGES) {
    const relatedProducts = landingProducts(landing, productIndex);
    await writeLandingPage(landing, relatedProducts);
    generatedLandingPages.push(landing.path);
    sitemap.push(xmlUrl(SITE + landing.path, today, "\n    <changefreq>weekly</changefreq>\n    <priority>0.75</priority>"));
    const landingImages = [absoluteUrl(landing.image), ...relatedProducts.map((product) => product.image)].filter(Boolean);
    if (landingImages.length) {
      imageSitemap.push(xmlUrl(
        SITE + landing.path,
        today,
        [...new Set(landingImages)].slice(0, 12).map((img) => `\n    <image:image><image:loc>${esc(img)}</image:loc><image:title>${esc(landing.h1)}</image:title></image:image>`).join("")
      ));
    }
    if (landing.legacy) {
      generatedLandingPages.push(landing.legacy);
      sitemap.push(xmlUrl(SITE + landing.legacy, today, "\n    <changefreq>monthly</changefreq>\n    <priority>0.55</priority>"));
    }
  }

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.join("\n")}\n</urlset>\n`;
  const imageXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${imageSitemap.join("\n")}\n</urlset>\n`;
  const videoXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${videoSitemap.join("\n")}\n</urlset>\n`;
  await fs.writeFile(path.join(ROOT, "sitemap.xml"), sitemapXml, "utf8");
  await fs.writeFile(path.join(ROOT, "image-sitemap.xml"), imageXml, "utf8");
  await fs.writeFile(path.join(ROOT, "video-sitemap.xml"), videoXml, "utf8");
  await fs.writeFile(path.join(SEO_DIR, "product-index.json"), JSON.stringify(productIndex, null, 2), "utf8");
  await fs.writeFile(path.join(SEO_DIR, "noindex-products.json"), JSON.stringify(noindexProducts, null, 2), "utf8");
  await fs.writeFile(path.join(SEO_DIR, "entity-index.json"), JSON.stringify({
    site: SITE,
    brand: "بريق للهدايا",
    legal_name: "Bariq Gifts",
    description: "متجر هدايا مخصصة للمناسبات في الإمارات: تخرج، قرقيعان، يوم الأم، اليوم الوطني، أكريليك، خشب، جلد وورق، مع تصميم وتنفيذ حسب الطلب.",
    phone: "+971554423151",
    email: "bariq.gifts@gmail.com",
    area_served: ["United Arab Emirates", "Ras Al Khaimah", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Fujairah", "Abu Dhabi"],
    address_region: "Ras Al Khaimah, UAE",
    social_profiles: ["https://www.instagram.com/bariq.gifts/", "https://www.facebook.com/bariq.gifts"],
    indexes: {
      products: `${SITE}/seo/product-index.json`,
      sitemap: `${SITE}/sitemap.xml`,
      image_sitemap: `${SITE}/image-sitemap.xml`,
      video_sitemap: `${SITE}/video-sitemap.xml`,
    },
    seo_landing_pages: generatedLandingPages.map((page) => SITE + page),
    generated_at: startedAt,
  }, null, 2), "utf8");
  await fs.writeFile(path.join(ROOT, "llms.txt"), [
    "# Bariq Gifts",
    "",
    "Bariq Gifts (بريق للهدايا) is a UAE gift store and workshop based in Ras Al Khaimah.",
    "The store provides customized gifts for occasions including graduation, newborn celebrations, Mother's Day, UAE National Day, Ramadan, acrylic gifts, wood gifts, leather gifts, paper products, and other listed website categories.",
    "Orders can be placed through the website or official social channels, then confirmed with the customer including proof/design details before production when needed.",
    "",
    "Contact:",
    "- Phone/WhatsApp: +971554423151",
    "- Email: bariq.gifts@gmail.com",
    "- Instagram: https://www.instagram.com/bariq.gifts/",
    "- Facebook: https://www.facebook.com/bariq.gifts",
    "",
    "Service area:",
    "- Current delivery/service coverage: all United Arab Emirates regions.",
    "- Visit/pickup is available in Ras Al Khaimah.",
    "- Gulf delivery is planned but should not be treated as currently available until published on the website.",
    "",
    "Machine-readable indexes:",
    `- Product index: ${SITE}/seo/product-index.json`,
    `- Entity index: ${SITE}/seo/entity-index.json`,
    `- XML sitemap: ${SITE}/sitemap.xml`,
    `- Image sitemap: ${SITE}/image-sitemap.xml`,
    `- Video sitemap: ${SITE}/video-sitemap.xml`,
    "",
    "Indexing note:",
    "Product pages are generated from live Supabase catalog data during build. Placeholder or incomplete products are marked noindex instead of being removed.",
    "",
  ].join("\n"), "utf8");

  const report = {
    generated_at: startedAt,
    products_loaded: products.length,
    categories_loaded: categoriesRows.length,
    subcategories_loaded: subcategoryRows.length,
    generated_product_pages: generatedProductFiles.length,
    sitemap_urls: sitemap.length,
    image_sitemap_urls: imageSitemap.length,
    video_sitemap_urls: videoSitemap.length,
    noindex_count: noindexProducts.length,
    generated_landing_pages: generatedLandingPages.length,
    generatedLandingPages,
    generatedProductFiles,
  };
  await fs.writeFile(path.join(SEO_DIR, "build-report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
