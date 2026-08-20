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
  "/about-bariq",
  "/gifts",
  "/custom-gifts",
  "/corporate-gifts",
  "/events",
  "/newborn",
  "/graduation",
  "/national-day",
  "/ramadan",
  "/acrylic",
  "/forex",
  "/wood",
  "/leather",
  "/stickers",
  "/offers",
  "/monthly-offers",
  "/categories",
  "/policy",
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

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.join("\n")}\n</urlset>\n`;
  const imageXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${imageSitemap.join("\n")}\n</urlset>\n`;
  await fs.writeFile(path.join(ROOT, "sitemap.xml"), sitemapXml, "utf8");
  await fs.writeFile(path.join(ROOT, "image-sitemap.xml"), imageXml, "utf8");
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
    },
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
    noindex_count: noindexProducts.length,
    generatedProductFiles,
  };
  await fs.writeFile(path.join(SEO_DIR, "build-report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
