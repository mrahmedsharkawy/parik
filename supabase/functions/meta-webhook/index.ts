// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { canonicalEnginePayload, channelDecision } from "../_shared/channel_adapter.ts";

function envKey(jsonName: string, ...fallbackNames: string[]) {
  const raw = String(Deno.env.get(jsonName) || "").trim();
  if (raw) {
    try {
      const value = String(JSON.parse(raw)?.default || "").trim();
      if (value) return value;
    } catch { /* use the legacy environment variable below */ }
  }
  for (const name of fallbackNames) {
    const value = String(Deno.env.get(name) || "").trim();
    if (value) return value;
  }
  return "";
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://knleehjjejfeobcmpwnw.supabase.co";
const SERVICE_KEY = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY");
const PUBLISHABLE_KEY = envKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const VERIFY_TOKEN = String(Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "");
const APP_SECRET = String(Deno.env.get("META_APP_SECRET") || "");
const ACCESS_TOKEN = String(Deno.env.get("META_WHATSAPP_ACCESS_TOKEN") || "");
const PAGE_ACCESS_TOKEN = String(Deno.env.get("META_PAGE_ACCESS_TOKEN") || "");
const FACEBOOK_PAGE_ID = String(Deno.env.get("META_FACEBOOK_PAGE_ID") || "1244089342118259");
const DEFAULT_PHONE_ID = String(Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID") || "");
const BUSINESS_WABA_ID = String(Deno.env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID") || "883000091411891");
const GRAPH_VERSION = String(Deno.env.get("META_GRAPH_VERSION") || "v26.0");
const BOT_TIMEOUT_MS = 7000;
let subscriptionReady = false;
let pageSubscriptionReady = false;

async function ensureWabaSubscription() {
  if (subscriptionReady || !BUSINESS_WABA_ID || !ACCESS_TOKEN) return;
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${BUSINESS_WABA_ID}/subscribed_apps`, {
    method: "POST",
    headers: { authorization: `Bearer ${ACCESS_TOKEN}`, "content-type": "application/json" },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.success !== true) throw new Error(`WABA subscription failed: ${res.status} ${JSON.stringify(payload)}`);
  subscriptionReady = true;
  console.log("business WABA subscription ready");
}

async function ensurePageSubscription() {
  if (pageSubscriptionReady || !FACEBOOK_PAGE_ID || !PAGE_ACCESS_TOKEN) return;
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${FACEBOOK_PAGE_ID}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", "messages");
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${PAGE_ACCESS_TOKEN}`, "content-type": "application/json" },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.success !== true) throw new Error(`Page subscription failed: ${res.status} ${JSON.stringify(payload)}`);
  pageSubscriptionReady = true;
  console.log("facebook page subscription ready");
}

function normalizeArabic(value: unknown) {
  return String(value || "").toLowerCase()
    .replace(/[إأآٱ]/g, "ا").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[\u064B-\u065F\u0670ـ]/g, "")
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function correctCommonTypos(value: string) {
  return value
    .replace(/(^|\s)(?:تخلاج|تخرح|تخرخ|تخريج)(?=\s|$)/g, "$1تخرج")
    .replace(/(^|\s)(?:هداياا|هدايه)(?=\s|$)/g, "$1هدايا")
    .replace(/(^|\s)(?:موالبدد|موالبد|موالبيد|مواليدد|مولدد|مولودد)(?=\s|$)/g, "$1مواليد");
}

const OCCASION_RULES: Array<[RegExp, string]> = [
  [/اليوم\s*الوطني|يوم\s*وطني|national\s*day/, "اليوم الوطني"],
  [/يوم\s*العلم|flag\s*day/, "يوم العلم"],
  [/حق\s*الليله|حق\s*الليلة|حق\s*ليله|haq\s*al[-\s]*laila/, "حق الليلة"],
  [/يوم\s*الام|عيد\s*الام|mother'?s?\s*day/, "يوم الأم"],
  [/عيد\s*الفطر|الفطر/, "عيد الفطر"], [/عيد\s*الاضحي|الاضحي/, "عيد الأضحى"],
  [/ميلاد/, "عيد ميلاد"], [/خطوب[هة]|خطبه/, "خطوبة"],
  [/زواج|جواز|عرس|فرح/, "زواج"], [/تخرج|جامع[هة]/, "تخرج"],
  [/ترقي[هة]/, "ترقية"], [/مولود|مواليد|بيبي|استقبال\s*مولود/, "مولود جديد"],
  [/فالنتين|رومانسي/, "رومانسي"], [/رمضان|فطار|افطار/, "رمضان"],
  [/حج/, "الحج"], [/شكر|تقدير/, "شكر وتقدير"], [/اعتذار|سوري/, "اعتذار"],
  [/تهنئه|مبروك/, "تهنئة"], [/افتتاح|مشروع\s*جديد/, "افتتاح"],
  [/سفر|وداع|هديه\s*سفر/, "سفر/وداع"], [/انجاز|نجاح/, "إنجاز"], [/عيد/, "عيد"],
];

function occasionFromText(text: string) {
  return OCCASION_RULES.find(([pattern]) => pattern.test(text))?.[1] || "";
}

async function activeProducts() {
  if (productCache.rows.length && Date.now() - productCache.at < 300000) return productCache.rows;
  const query = new URLSearchParams({ select: PRODUCT_SELECT, active: "eq.true", limit: "500" });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?${query}`, { headers: serviceHeaders() });
  const rows = res.ok ? await res.json().catch(() => []) : [];
  productCache = { at: Date.now(), rows: Array.isArray(rows) ? rows : [] };
  return productCache.rows;
}

async function activeTaxonomy() {
  if (Date.now() - taxonomyCache.at < 300000 && (taxonomyCache.categories.length || taxonomyCache.subcategories.length)) return taxonomyCache;
  const headers = serviceHeaders();
  const [categoryRes, subcategoryRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/categories?active=eq.true&limit=500`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/subcategories?active=eq.true&limit=500`, { headers }),
  ]);
  const categories = categoryRes.ok ? await categoryRes.json().catch(() => []) : [];
  const subcategories = subcategoryRes.ok ? await subcategoryRes.json().catch(() => []) : [];
  taxonomyCache = {
    at: Date.now(),
    categories: Array.isArray(categories) ? categories : [],
    subcategories: Array.isArray(subcategories) ? subcategories : [],
  };
  return taxonomyCache;
}

function productName(product: any) {
  return String(product?.name_ar || product?.name_en || product?.name || "منتج").trim();
}

function taxonomyDocument(row: any) {
  return [row?.name_ar, row?.name_en, row?.name, row?.slug, row?.title_ar, row?.title_en, row?.description_ar, row?.description_en]
    .filter(Boolean).join(" ");
}

function productDocument(product: any, taxonomy: { categories: any[]; subcategories: any[] } = taxonomyCache) {
  const category = (taxonomy.categories || []).find((row: any) => String(row?.id) === String(product?.category_id || product?.categoryId || ""));
  const subcategory = (taxonomy.subcategories || []).find((row: any) => String(row?.id) === String(product?.subcategory_id || product?.subcategoryId || ""));
  return normalizeArabic([
    productName(product), product?.description_ar, product?.description_en,
    product?.categories, taxonomyDocument(category), taxonomyDocument(subcategory),
  ].filter(Boolean).join(" "));
}

async function recommendProducts(text: string, entities: any = {}) {
  // Only the current message may select an occasion. Never reuse a previous
  // occasion to filter a fresh category/general message.
  const occasion = occasionFromText(text) || (entities?.explicit_occasion ? String(entities?.occasion_label || entities?.occasion || "") : "");
  const occasionTerms: Record<string, string[]> = {
    "تخرج": ["تخرج", "graduation", "graduate"], "عيد ميلاد": ["ميلاد", "birthday"],
    "زواج": ["زواج", "عرس", "فرح", "wedding"], "خطوبة": ["خطوبه", "engagement"],
    "مولود جديد": ["مولود", "بيبي", "baby", "newborn"], "رمضان": ["رمضان", "ramadan"],
    "عيد": ["عيد", "eid"], "عيد الفطر": ["فطر", "eid", "fitr"],
    "عيد الأضحى": ["اضحي", "eid", "adha"], "اليوم الوطني": ["اليوم الوطني", "national day"],
    "يوم العلم": ["يوم العلم", "flag day"], "يوم الأم": ["يوم الام", "mother"],
  };
  const genericStop = new Set(["عندكم", "اريد", "عايز", "هدايا", "هديه", "هدية", "منتجات", "مناسبه", "المناسبه"]);
  const terms = normalizeArabic(text).split(" ").filter((x) => x.length > 2 && !genericStop.has(x));
  const extra = [...new Set([
    ...(occasionTerms[occasion] || []),
    ...normalizeArabic(occasion).split(" ").filter(Boolean),
    ...normalizeArabic(text).split(" ").filter((x) => x.length > 2 && !genericStop.has(x)),
  ])];
  const budget = Number(entities?.budget || 0);
  const [products, taxonomy] = await Promise.all([activeProducts(), activeTaxonomy()]);
  return products.map((product: any) => {
    const doc = productDocument(product, taxonomy);
    const price = Number(product?.price || 0);
    // The catalogue contains made-to-order gifts whose stock is stored as 0.
    // Active is the storefront source of truth; only a negative stock value is a hard exclusion.
    if (Number(product?.stock ?? 1) < 0 || (budget > 0 && (!price || price > budget))) return { ...product, _score: -1 };
    let score = 0;
    terms.forEach((term) => { if (doc.includes(term)) score += 2; });
    extra.forEach((term) => { if (doc.includes(normalizeArabic(term))) score += 8; });
    // Featured only ranks an already matching product; it must never make an
    // unrelated product eligible for another occasion/category.
    if (score > 0 && product?.featured) score += 1;
    return { ...product, _score: score };
  }).filter((product: any) => product._score > 0)
    .sort((a: any, b: any) => b._score - a._score || Number(a.price || 0) - Number(b.price || 0))
    .slice(0, 4);
}

function productList(products: any[]) {
  if (!products.length) return "";
  return products.map((product, index) => {
    const price = Number(product?.price || 0);
    const link = `https://bariqgifts.com/product.html?id=${encodeURIComponent(product.id)}`;
    return `${index + 1}. ${productName(product)}${price ? ` — ${price.toFixed(2)} AED` : ""}\n${link}`;
  }).join("\n\n");
}

function priceIntent(text: string) {
  return /سعر|بكم|بكام|كم\s*سعر|كام\s*سعر|price/.test(normalizeArabic(text));
}

async function matchPricedProduct(text: string) {
  const stop = new Set(["سعر", "بكم", "بكام", "كام", "كم", "ايه", "شو", "هذا", "هاذا", "المنتج"]);
  const terms = normalizeArabic(text).split(" ").filter((term) => term.length > 1 && !stop.has(term));
  if (!terms.length) return null;
  const ranked = (await activeProducts()).map((product: any) => {
    const name = normalizeArabic(productName(product));
    const score = terms.reduce((sum, term) => sum + (name.includes(term) ? 10 : productDocument(product).includes(term) ? 2 : 0), 0);
    return { product, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return ranked[0]?.product || null;
}

function recentPricedProduct(recent: any[]) {
  for (const item of [...recent].reverse()) {
    const product = Array.isArray(item?.meta?.products) ? item.meta.products[0] : null;
    if (product && Number(product.price) > 0) return product;
  }
  return null;
}

function checkoutIntent(text: string) {
  const n = normalizeArabic(text);
  return /(?:اعمل|سوي|سو|جهز|ثبت|اكد|كمل|تمم|خلص).*(?:الطلب|طلب)|(?:الطلب|طلب).*(?:تمام|ثبت|اكد|كمل|اعمل|سوي|جهز)/.test(n);
}

function contactFromText(text: string) {
  const clean = String(text || "").trim().replace(/\s+/g, " ");
  const separated = clean.match(/^(.+?)\s*(?:[-–—|،,])\s*(.+)$/);
  if (separated) return { name: separated[1].replace(/^(?:الاسم|اسمي)\s*:?\s*/i, "").trim(), address: separated[2].replace(/^(?:العنوان|عنواني)\s*:?\s*/i, "").trim() };
  const labeled = clean.match(/(?:الاسم|اسمي)\s*:?\s*(.+?)\s+(?:العنوان|عنواني)\s*:?\s*(.+)$/i);
  return labeled ? { name: labeled[1].trim(), address: labeled[2].trim() } : null;
}

function cartSummary(cart: any[]) {
  const lines = cart.map((item, index) => `${index + 1}) ${item.name} — ${item.qty} × ${Number(item.unitPrice).toFixed(2)} = ${(Number(item.qty) * Number(item.unitPrice)).toFixed(2)} درهم`);
  const total = cart.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice), 0);
  lines.push(`الإجمالي: ${total.toFixed(2)} درهم`);
  return lines.join("\n");
}

function multiItemPairs(text: string) {
  const normalized = String(text || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[،,]+/g, " و ")
    .replace(/و(?=(?:ابغي|أبغي|ابي|أبي|ابا|أبا|اريد|أريد|عطني|هات|ضيف|زود)\s*\d)/gi, " و ")
    .replace(/\s+/g, " ").trim();
  const chunks = normalized.split(/\s+و\s+/).map((x) => x.trim()).filter(Boolean);
  const pairs: Array<{ qty: number; name: string }> = [];
  for (const raw of chunks) {
    const clean = raw.replace(/^(?:ابغي|أبغي|ابي|أبي|ابا|أبا|اريد|أريد|عطني|اعطني|أعطني|هات(?:\s*لي)?|خد|خذ|محتاج)\s*/i, "").trim();
    const match = clean.match(/^(\d+(?:\.\d+)?)\s*(?:حبه|حبة|حبات|قطعه|قطعة|قطع|وحده|وحدة|pcs?)?\s*(.+)$/i);
    if (!match) continue;
    const qty = Number(match[1]);
    const name = String(match[2] || "").replace(/\s+(?:بكم|بكام|كم|احسبهم|تحسبهم).*$/i, "").trim();
    if (qty > 0 && name) pairs.push({ qty, name });
  }
  return pairs.length >= 2 ? pairs.slice(0, 12) : [];
}

async function multiItemQuote(text: string, existingCart: any[] = []) {
  const pairs = multiItemPairs(text);
  if (!pairs.length) return null;
  const rows: any[] = [];
  const missing: string[] = [];
  for (const pair of pairs) {
    const product = await matchPricedProduct(pair.name);
    const price = Number(product?.price || 0);
    if (!product || !price) { missing.push(pair.name); continue; }
    rows.push({ qty: pair.qty, name: productName(product), unitPrice: price, subtotal: pair.qty * price, product_id: product.id || null });
  }
  if (missing.length) {
    return {
      reply: `فاهم الأصناف والكميات، بس ناقصني سعر: ${missing.join("، ")}. اكتب الاسم والمقاس زي قاعدة المعرفة وأنا أحسبهم كلهم.`,
      cart: existingCart,
      action: "multi_item_needs_price",
    };
  }
  const cart = [...existingCart];
  rows.forEach((row) => {
    const found = cart.find((item: any) => String(item.product_id || "") === String(row.product_id || "") && Number(item.unitPrice) === row.unitPrice);
    if (found) found.qty = Number(found.qty || 0) + row.qty;
    else cart.push({ name: row.name, qty: row.qty, unitPrice: row.unitPrice, product_id: row.product_id });
  });
  const lines = rows.map((row) => `• ${row.qty} ${row.name} × ${row.unitPrice.toFixed(2)} درهم = ${row.subtotal.toFixed(2)} درهم`);
  lines.push("", `💰 الإجمالي: ${rows.reduce((sum, row) => sum + row.subtotal, 0).toFixed(2)} درهم`, "", "إذا تبا تثبتهم كطلب قل «ثبت الطلب»، وإذا تبا تضيف منتج ثاني قولي.");
  return { reply: lines.join("\n"), cart, action: "multi_item_calc" };
}

function response(body: string, status = 200, contentType = "text/plain") {
  return new Response(body, {
    status,
    headers: { "content-type": `${contentType}; charset=utf-8`, "cache-control": "no-store" },
  });
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validSignature(rawBody: string, signatureHeader: string) {
  if (!APP_SECRET || !signatureHeader.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return constantTimeEqual(signatureHeader.slice(7).toLowerCase(), bytesToHex(new Uint8Array(digest)));
}

function serviceHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    "content-type": "application/json",
    ...extra,
  };
}

async function getConversation(sessionId: string, phone: string, channel = "whatsapp") {
  const query = new URLSearchParams({
    select: "id,phone,state,current_topic,waiting_for,updated_at",
    session_id: `eq.${sessionId}`,
    limit: "1",
  });
  let res = await fetch(`${SUPABASE_URL}/rest/v1/bot_conversations?${query}`, {
    headers: serviceHeaders(),
  });
  let rows = res.ok ? await res.json() : [];
  if (rows[0]) return rows[0];
  res = await fetch(`${SUPABASE_URL}/rest/v1/bot_conversations`, {
    method: "POST",
    headers: serviceHeaders({ prefer: "return=representation" }),
    body: JSON.stringify({ session_id: sessionId, phone, state: { channel } }),
  });
  rows = res.ok ? await res.json() : [];
  if (!rows[0]) throw new Error(`conversation create failed: ${res.status}`);
  return rows[0];
}

async function insertIncoming(conversationId: string, messageId: string, text: string, metadata: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bot_messages`, {
    method: "POST",
    headers: serviceHeaders({ prefer: "return=representation" }),
    body: JSON.stringify({
      conversation_id: conversationId,
      role: "user",
      message: text,
      external_message_id: messageId,
      metadata,
    }),
  });
  if (res.status === 409) return false;
  if (!res.ok) throw new Error(`incoming message insert failed: ${res.status}`);
  return true;
}

async function replyAlreadySent(conversationId: string, messageId: string) {
  const query = new URLSearchParams({
    select: "id",
    conversation_id: `eq.${conversationId}`,
    role: "eq.assistant",
    "metadata->>reply_to_message_id": `eq.${messageId}`,
    limit: "1",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bot_messages?${query}`, { headers: serviceHeaders() });
  const rows = res.ok ? await res.json().catch(() => []) : [];
  return Boolean(rows[0]);
}

async function recentMessages(conversationId: string) {
  const query = new URLSearchParams({
    select: "role,message,metadata,created_at",
    conversation_id: `eq.${conversationId}`,
    order: "created_at.desc",
    limit: "12",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bot_messages?${query}`, { headers: serviceHeaders() });
  const rows = res.ok ? await res.json() : [];
  return rows.reverse().map((row: any) => ({ role: row.role, text: row.message, meta: row.metadata || {} }));
}

function orderReference(value: string) {
  const western = String(value || "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return western.match(/^\s*#?\s*(\d{3,10})\s*$/)?.[1] || "";
}

function statusLabel(value: unknown) {
  const labels: Record<string, string> = {
    new: "جديد", pending: "جديد", confirmed: "تم تأكيد الطلب ✅",
    processing: "جاري تجهيز الطلب ⏳", manufacturing: "قيد التصنيع 🛠️",
    shipped: "تم شحن الطلب 🚚", delivered: "تم توصيل الطلب 🎉",
    cancelled: "تم إلغاء الطلب ❌", refunded: "تم استرجاع المبلغ",
  };
  const key = String(value || "").trim().toLowerCase();
  return labels[key] || String(value || "قيد المعالجة");
}

function normalizedUaePhone(value: unknown) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `971${digits.slice(1)}`;
  else if (digits.startsWith("5") && digits.length === 9) digits = `971${digits}`;
  return digits;
}

async function orderReply(ref: string, senderPhone: string) {
  const select = "id,order_number,customer_phone,total,status,created_at";
  for (const value of [`#${ref}`, ref]) {
    const query = new URLSearchParams({ select, order_number: `eq.${value}`, limit: "1" });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?${query}`, { headers: serviceHeaders() });
    const rows = res.ok ? await res.json().catch(() => []) : [];
    if (rows[0]) {
      const order = rows[0];
      const ownerPhone = normalizedUaePhone(order.customer_phone);
      if (!ownerPhone || ownerPhone !== normalizedUaePhone(senderPhone)) {
        return { reply: "لقيت رقم الطلب، لكن حفاظًا على خصوصيتك لازم تراسلنا من رقم الهاتف المسجّل في الطلب، أو تطلب التحويل لموظف.", order: null };
      }
      const total = order.total != null ? `\n💰 إجمالي الطلب: ${Number(order.total).toFixed(2)} AED` : "";
      const date = order.created_at ? `\n📅 تاريخ الطلب: ${new Date(order.created_at).toLocaleDateString("ar-EG")}` : "";
      return { reply: `📦 حالة طلبك ${order.order_number || `#${ref}`}:\n${statusLabel(order.status)}${total}${date}`, order };
    }
  }
  return { reply: `رقم الطلب #${ref} مش موجود عندنا. اتأكد من الرقم وابعتُه مرة تانية.`, order: null };
}

async function askBot(text: string, conversation: any, recent: any[], imageUrl = "", channel = "whatsapp") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BOT_TIMEOUT_MS);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/bot-llm`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${PUBLISHABLE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(canonicalEnginePayload(text, recent, {
        ...(conversation.state || {}),
        current_topic: conversation.current_topic || "",
        waiting_for: conversation.waiting_for || "",
        current_state: conversation.state || {},
        sender_phone: channel === "whatsapp" ? conversation.state?.sender_phone || conversation.phone || "" : "",
        channel,
      }, imageUrl)),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  if (!res.ok) throw new Error(`bot-llm failed: ${res.status}`);
  return await res.json();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) binary += String.fromCharCode(...bytes.subarray(i, i + size));
  return btoa(binary);
}

async function whatsappImageData(mediaId: string) {
  if (!mediaId || !ACCESS_TOKEN) return "";
  const info = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(mediaId)}`, {
    headers: { authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!info.ok) throw new Error(`WhatsApp media info failed: ${info.status}`);
  const metadata = await info.json();
  if (!metadata?.url) return "";
  const media = await fetch(metadata.url, { headers: { authorization: `Bearer ${ACCESS_TOKEN}` } });
  if (!media.ok) throw new Error(`WhatsApp media download failed: ${media.status}`);
  const bytes = new Uint8Array(await media.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) throw new Error("WhatsApp image is too large");
  const type = media.headers.get("content-type") || metadata?.mime_type || "image/jpeg";
  return `data:${type};base64,${bytesToBase64(bytes)}`;
}

async function socialImageData(url: string) {
  if (!url) return "";
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  if (!(host === "facebook.com" || host.endsWith(".facebook.com") || host.endsWith(".fbcdn.net") || host.endsWith(".cdninstagram.com"))) {
    throw new Error("Untrusted social image host");
  }
  const media = await fetch(parsed);
  if (!media.ok) throw new Error(`Social image download failed: ${media.status}`);
  const bytes = new Uint8Array(await media.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) throw new Error("Social image is too large");
  const type = media.headers.get("content-type") || "image/jpeg";
  return `data:${type};base64,${bytesToBase64(bytes)}`;
}

async function saveUnanswered(text: string, conversationId: string, context: any) {
  const normalizedText = correctCommonTypos(normalizeArabic(text));
  if (!normalizedText) return;
  const query = new URLSearchParams({ select: "id,count", normalized_text: `eq.${normalizedText}`, limit: "1" });
  const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/bot_unanswered?${query}`, { headers: serviceHeaders() });
  const existing = existingRes.ok ? (await existingRes.json().catch(() => []))[0] : null;
  const now = new Date().toISOString();
  if (existing?.id) {
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/bot_unanswered?id=eq.${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      headers: serviceHeaders(),
      body: JSON.stringify({ count: Number(existing.count || 0) + 1, conversation_id: conversationId, context, status: "open", last_seen_at: now }),
    });
    if (!updateRes.ok) throw new Error(`unanswered update failed: ${updateRes.status} ${await updateRes.text()}`);
    return;
  }
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/bot_unanswered`, {
    method: "POST",
    headers: serviceHeaders({ prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({ text, normalized_text: normalizedText, count: 1, conversation_id: conversationId, context, status: "open", last_seen_at: now }),
  });
  if (!insertRes.ok) throw new Error(`unanswered insert failed: ${insertRes.status} ${await insertRes.text()}`);
}

async function knowledgeFallback(text: string, context: any) {
  const occasion = occasionFromText(text);
  const probes = occasion
    ? [occasion, text]
    : [text];
  let best: any = null;
  for (const probe of probes) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bot_knowledge_search`, {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify({ p_message: probe, p_context: { ...(context || {}), occasion }, p_limit: occasion ? 80 : 5 }),
    });
    if (!res.ok) continue;
    const rows = await res.json().catch(() => []);
    const answered = Array.isArray(rows) ? rows.filter((row: any) => String(row?.answer || "").trim()) : [];
    const specific = occasion
      ? answered.find((row: any) => {
        const document = normalizeArabic(JSON.stringify({
          question: row?.question,
          category: row?.category,
          keywords: row?.keywords,
          action_value: row?.action_value,
          answer: row?.answer,
        }));
        const normalizedOccasion = normalizeArabic(occasion);
        if (normalizedOccasion === "سفر وداع") return /سفر|وداع/.test(document);
        return document.includes(normalizedOccasion);
      })
      : null;
    const hit = specific || answered[0] || null;
    if (specific) return {
      action: "answer",
      action_name: specific.action_name || "NONE",
      knowledge_id: specific.id || null,
      entities: { ...(context || {}), occasion },
      reply: String(specific.answer || "").trim(),
      confidence: 0.99,
      confidence_label: "high",
    };
    if (hit && (!best || Number(hit.score || 0) > Number(best.score || 0))) best = hit;
  }
  if (!best || Number(best.score || 0) < 18) return null;
  return {
    action: "answer",
    action_name: best.action_name || "NONE",
    knowledge_id: best.id || null,
    entities: context || {},
    reply: String(best.answer || "").trim(),
    confidence: Math.min(0.99, Math.max(0.6, Number(best.score || 0) / 55)),
    confidence_label: "high",
  };
}

async function sendWhatsApp(phoneId: string, to: string, text: string) {
  if (!ACCESS_TOKEN) throw new Error("META_WHATSAPP_ACCESS_TOKEN is missing");
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${ACCESS_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text } }),
    });
    if (res.ok) return await res.json();
    lastError = `${res.status} ${await res.text()}`;
    if (res.status < 500 && res.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 400 : 1200));
  }
  throw new Error(`WhatsApp send failed: ${lastError}`);
}

async function sendMetaMessage(channel: "messenger" | "instagram", accountId: string, to: string, text: string) {
  if (!PAGE_ACCESS_TOKEN) throw new Error("META_PAGE_ACCESS_TOKEN is missing");
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const graphHost = channel === "instagram" ? "graph.instagram.com" : "graph.facebook.com";
    const res = await fetch(`https://${graphHost}/${GRAPH_VERSION}/${encodeURIComponent(accountId)}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${PAGE_ACCESS_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({
        recipient: { id: to },
        ...(channel === "messenger" ? { messaging_type: "RESPONSE" } : {}),
        message: { text },
      }),
    });
    if (res.ok) return await res.json();
    lastError = `${res.status} ${await res.text()}`;
    if (res.status < 500 && res.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 400 : 1200));
  }
  throw new Error(`${channel} send failed: ${lastError}`);
}

async function saveAssistant(conversationId: string, incomingMessageId: string, text: string, result: any, sendResult: any, channel = "whatsapp") {
  await fetch(`${SUPABASE_URL}/rest/v1/bot_messages`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      conversation_id: conversationId,
      role: "assistant",
      message: text,
      intent: result?.entities?.topic || null,
      knowledge_id: result?.knowledge_id || null,
      action: result?.action || null,
      metadata: { channel, reply_to_message_id: incomingMessageId, meta_message_id: sendResult?.messages?.[0]?.id || sendResult?.message_id || null, products: result?.products || [] },
    }),
  });
}

async function saveConversationState(conversation: any, result: any, reply: string, channel = "whatsapp") {
  const entities = result?.entities || {};
  let waitingFor = Object.prototype.hasOwnProperty.call(entities, "waiting_for")
    ? String(entities.waiting_for || "")
    : String(conversation?.waiting_for || "");
  if (result?.action === "order_track" && !entities?.order_number) waitingFor = "order_number";
  else if (result?.action === "order_track" && entities?.order_number) waitingFor = "";
  else if (/شو المناسبه|ايه المناسبه|ما هي المناسبه/.test(normalizeArabic(reply))) waitingFor = "gift_occasion";
  else if (entities?.occasion && waitingFor === "gift_occasion") waitingFor = "";
  const state = { ...(conversation?.state || {}), ...entities, waiting_for: waitingFor, channel };
  await fetch(`${SUPABASE_URL}/rest/v1/bot_conversations?id=eq.${encodeURIComponent(conversation.id)}`, {
    method: "PATCH",
    headers: serviceHeaders(),
    body: JSON.stringify({ state, current_topic: entities?.topic || conversation?.current_topic || null, waiting_for: waitingFor || null, updated_at: new Date().toISOString() }),
  });
}

async function processWebhook(payload: any) {
  for (const entry of payload?.entry || []) {
    const socialChannel = payload?.object === "instagram" ? "instagram" : "messenger";
    const socialChanges = (entry?.messaging || [])
      .filter((event: any) => {
        const image = event?.message?.attachments?.find((item: any) => item?.type === "image" && item?.payload?.url);
        return event?.message?.mid && (event?.message?.text || image) && !event?.message?.is_echo && event?.sender?.id;
      })
      .map((event: any) => {
        const image = event?.message?.attachments?.find((item: any) => item?.type === "image" && item?.payload?.url);
        return ({
        value: {
          __channel: socialChannel,
          metadata: { phone_number_id: String(entry?.id || event?.recipient?.id || "") },
          messages: [{
            id: String(event.message.mid),
            from: String(event.sender.id),
            type: image ? "image" : "text",
            text: { body: String(event.message.text) },
            image: image ? { url: String(image.payload.url), caption: String(event.message.text || "") } : undefined,
            timestamp: String(event.timestamp || ""),
          }],
        },
      });
      });
    for (const change of [...(entry?.changes || []), ...socialChanges]) {
      const value = change?.value || {};
      const channel = ["messenger", "instagram"].includes(String(value?.__channel))
        ? String(value.__channel)
        : "whatsapp";
      const phoneId = String(value?.metadata?.phone_number_id || DEFAULT_PHONE_ID);
      for (const message of value?.messages || []) {
        if (!["text", "image"].includes(String(message?.type || "")) || !message?.from || !phoneId) continue;
        const from = String(message.from);
        const isImage = message?.type === "image";
        const text = String(isImage ? (message?.image?.caption || "ابحث عن منتج مشابه لهذه الصورة") : message?.text?.body || "").trim().slice(0, 4000);
        if (!text) continue;
        let imageUrl = "";
        if (isImage) {
          try {
            imageUrl = channel === "whatsapp"
              ? await whatsappImageData(String(message?.image?.id || ""))
              : await socialImageData(String(message?.image?.url || ""));
          } catch (error) { console.error(`${channel} image`, error); }
        }
        const conversation = await getConversation(`${channel}:${from}`, from, channel);
        const incomingMessageId = String(message.id);
        const inserted = await insertIncoming(conversation.id, incomingMessageId, text, { channel, type: message.type, timestamp: message.timestamp, has_image: Boolean(imageUrl) });
        if (!inserted && await replyAlreadySent(conversation.id, incomingMessageId)) continue;
        const recent = await recentMessages(conversation.id);
        const context = {
          ...(conversation.state || {}),
          current_topic: conversation.current_topic || "",
          waiting_for: conversation.waiting_for || "",
          channel,
        };
        // Channel adapter only: the canonical Bot Engine owns normalization,
        // knowledge matching, actions, products/orders, follow-up and wording.
        // Passing the raw customer message is essential for website parity.
        let result: any = null;
        let reply = "";
        try {
          const canonical = channelDecision(await askBot(text, conversation, recent, imageUrl, channel));
          result = canonical.result;
          reply = canonical.reply;
        } catch (error) {
          // Never run an independent knowledge/product fallback here. A weak
          // adapter-side match must not override the canonical engine.
          console.error("canonical bot engine unavailable", error);
          result = { action: "silent", unanswered: true, entities: context };
        }
        if (!reply || result?.silent || result?.action === "silent") {
          await saveUnanswered(text, conversation.id, { ...context, source: channel });
          result = { ...result, action: "unanswered", entities: context };
          console.log(`${channel} bot decision`, JSON.stringify({ action: "unanswered", knowledge_id: result?.knowledge_id || null, has_reply: false }));
          await saveConversationState(conversation, result, "", channel);
          continue;
        }
        console.log(`${channel} bot decision`, JSON.stringify({ action: result?.action || "", knowledge_id: result?.knowledge_id || null, has_reply: Boolean(reply) }));
        if (!reply) continue;
        const sent = channel === "whatsapp"
          ? await sendWhatsApp(phoneId, from, reply.slice(0, 4096))
          : await sendMetaMessage(channel as "messenger" | "instagram", phoneId, from, reply.slice(0, 2000));
        await saveAssistant(conversation.id, incomingMessageId, reply, result, sent, channel);
        await saveConversationState(conversation, result, reply, channel);
      }
    }
  }
}

serve(async (req) => {
  try { await ensureWabaSubscription(); }
  catch (error) { console.error("waba subscription", error); }
  try { await ensurePageSubscription(); }
  catch (error) { console.error("page subscription", error); }
  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode") || "";
    const token = url.searchParams.get("hub.verify_token") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (mode === "subscribe" && VERIFY_TOKEN && constantTimeEqual(token, VERIFY_TOKEN)) {
      return response(challenge);
    }
    return response("Forbidden", 403);
  }
  if (req.method !== "POST") return response("Method not allowed", 405);
  const rawBody = await req.text();
  if (!(await validSignature(rawBody, req.headers.get("x-hub-signature-256") || ""))) {
    return response("Invalid signature", 401);
  }
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return response("Invalid JSON", 400); }
  const task = processWebhook(payload).catch((error) => console.error("meta-webhook", error));
  // Supabase Edge Runtime keeps the task alive after the immediate webhook acknowledgement.
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task); else await task;
  return response("EVENT_RECEIVED");
});
