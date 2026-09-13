// @ts-nocheck
// Bariq AI Sales Assistant V4 — knowledge-first + waiting-state aware routing
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { OpenAI } from "https://deno.land/x/openai@v4.20.1/mod.ts";
import { getSupabasePublishableKey, getSupabaseSecretKey } from "../_shared/supabase_keys.ts";

const SB_URL = Deno.env.get("SUPABASE_URL") || "https://knleehjjejfeobcmpwnw.supabase.co";
const SERVICE_KEY = getSupabaseSecretKey();
const ANON_KEY = getSupabasePublishableKey();
const LEGACY_ANON_KEY = String(Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const ORIGINS = new Set([
  "https://bariqgifts.com",
  "https://www.bariqgifts.com",
  "https://admin.bariqgifts.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const ACTION_ALIASES: Record<string, string> = {
  NONE: "NONE",
  GET_ORDER_STATUS: "TRACK_ORDER",
  GET_ORDER_DETAILS: "TRACK_ORDER",
  SEARCH_PRODUCT: "PRODUCT_SEARCH",
  SHOW_PRODUCT: "PRODUCT_LOOKUP",
  SHOW_CATEGORY: "CATEGORY_PRODUCTS",
  CHECK_PRODUCT_AVAILABILITY: "PRODUCT_LOOKUP",
  GET_CUSTOMER_ORDERS: "TRACK_ORDER",
  GET_CUSTOMER_INFO: "COLLECT_LEAD",
  HUMAN_HANDOFF: "HANDOFF_HUMAN",
};

const RESPONSE_ACTION: Record<string, string> = {
  TRACK_ORDER: "order_track",
  CATEGORY_PRODUCTS: "answer",
  PRODUCT_SEARCH: "answer",
  PRODUCT_LOOKUP: "answer",
  IMAGE_PRODUCT_SEARCH: "image_search",
  HANDOFF_HUMAN: "human",
  CUSTOM_GIFT_ORDER: "answer",
  CREATE_QUOTE: "answer",
  UPDATE_ORDER: "answer",
  COLLECT_LEAD: "answer",
  NONE: "answer",
};

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://bariqgifts.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

async function isAllowedCaller(req: Request) {
  const apiKey = String(req.headers.get("apikey") || "").trim();
  if (apiKey && (apiKey === ANON_KEY || apiKey === LEGACY_ANON_KEY)) return true;

  const authorization = String(req.headers.get("authorization") || "").trim();
  if (!authorization.toLowerCase().startsWith("bearer ") || !ANON_KEY) return false;
  try {
    const response = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: authorization },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function json(req: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: headers(req) });
}

function normalize(value: unknown) {
  let text = String(value || "").toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/\b(?:أبغي|ابغي|أبغى|ابغى|أبي|ابي|أبا|ابا|بغيت|ودي|عايز|محتاج)\b/gi, "اريد"],
    [/\bشو\b/gi, "ايه"],
    [/\bوين\b/gi, "فين"],
    [/\b(?:مب|مو)\b/gi, "مش"],
    [/\bللحين\b/gi, "لسه"],
    [/\bحق\s+/gi, "ل"],
    [/\b(?:اوردر|order)\b/gi, "طلب"],
    [/\b(?:لوغو|لوجو|logo)\b/gi, "شعار"],
    [/\b(?:براندنق|براندنج|branding)\b/gi, "تخصيص"],
  ];
  rules.forEach(([re, to]) => text = text.replace(re, to));
  text = text
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\p{L}\p{N}#]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text
    .replace(/(^|\s)(?:تخلاج|تخرح|تخرخ|تخريج)(?=\s|$)/g, "$1تخرج")
    .replace(/(^|\s)(?:هداياا|هدايه)(?=\s|$)/g, "$1هدايا")
    .replace(/(^|\s)(?:موالبدد|موالبد|موالبيد|مواليدد|مولدد|مولودد)(?=\s|$)/g, "$1مواليد");
}

const OCCASION_RULES: Array<[RegExp, string, string]> = [
  [/اليوم\s*الوطني|يوم\s*وطني|national\s*day/, "اليوم الوطني", "national_day"],
  [/يوم\s*العلم|flag\s*day/, "يوم العلم", "flag_day"],
  [/حق\s*الليله|حق\s*ليله|haq\s*al[-\s]*laila/, "حق الليلة", "haq_al_laila"],
  [/يوم\s*الام|عيد\s*الام|mother'?s?\s*day/, "يوم الأم", "mothers_day"],
  [/عيد\s*الفطر|الفطر/, "عيد الفطر", "eid_al_fitr"],
  [/عيد\s*الاضحي|الاضحي/, "عيد الأضحى", "eid_al_adha"],
  [/ميلاد/, "عيد ميلاد", "birthday"], [/خطوب[هة]|خطبه/, "خطوبة", "engagement"],
  [/زواج|جواز|عرس|فرح/, "زواج", "wedding"], [/تخرج|جامع[هة]/, "تخرج", "graduation"],
  [/ترقي[هة]/, "ترقية", "promotion"], [/مولود|مواليد|بيبي/, "مولود جديد", "newborn"],
  [/فالنتين|رومانسي/, "رومانسي", "romantic"], [/رمضان|فطار|افطار/, "رمضان", "ramadan"],
  [/حج/, "الحج", "hajj"], [/شكر|تقدير/, "شكر وتقدير", "appreciation"],
  [/اعتذار|سوري/, "اعتذار", "apology"], [/تهنئه|مبروك/, "تهنئة", "congratulations"],
  [/افتتاح|مشروع\s*جديد/, "افتتاح", "opening"], [/سفر|وداع/, "سفر/وداع", "farewell"],
  [/انجاز|نجاح/, "إنجاز", "achievement"], [/عيد/, "عيد", "eid"],
];

function occasionDetails(message: string) {
  const n = normalize(message);
  const found = OCCASION_RULES.find(([pattern]) => pattern.test(n));
  return found ? { label: found[1], key: found[2] } : { label: "", key: "" };
}

function orderRef(message: string) {
  const m = String(message || "").replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).match(/#?\s*(\d{3,10})/);
  return m?.[1] || "";
}

function topic(message: string, ctx: any = {}) {
  const n = normalize(message);
  const waiting=waitingFor(ctx);
  if(waiting==="order_number" && /^#?\s*\d{3,10}\s*$/.test(String(message||"").replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))))) return "order";
  if(waiting.startsWith("gift_")) return "gift";
  if (returnOrderIntent(message)) return "update_order";
  if (/موظف|بشر|حد يكلمني|human|support/.test(n)) return "human";
  if (orderRef(message) && /طلب|رقم|تتبع|حاله|فين|وين|وصل|اتشحن|شحن|order/.test(n)) return "order";
  if (/طلب|طلبي|تتبع|حاله الطلب|اتشحن|شو صار/.test(n)) return "order";
  if (/صوره|صورة|image|photo|pic/.test(n)) return "image";
  if (/هديه|هدية|gift|اختي|امي|الوالده|تخرج|ميلاد|مولود|رمضان|عيد/.test(n)) return "gift";
  if (/منتجات|منتج|فئه|فئة|كولكشن|وريني|اعرض|شوف|شغل|استيكر|ورق|كوب|اكواب|فوركس|اكريلك|بوكس/.test(n)) return "browse";
  if (/سلام|هلا|مرحبا|هاي|شكرا|صباح|مساء/.test(n)) return "greeting";
  return ctx?.current_topic || ctx?.topic || "general";
}

function parseNumber(message: string, kind: "budget" | "quantity", ctx: any = {}) {
  const clean = String(message || "").replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (kind === "budget") {
    const m = clean.match(/(?:ميزاني(?:ه|ة)|budget|حدود|حتى|حوالي)\s*[:=]?\s*(\d+(?:\.\d+)?)/i)
      || clean.match(/(\d+(?:\.\d+)?)\s*(?:درهم|aed)/i);
    return m ? Number(m[1]) : null;
  }
  const m = clean.match(/(?:كمي(?:ه|ة)|عدد|qty|quantity|قطعه|قطعة|حبه|حبة|pc|pcs)\s*[:=]?\s*(\d+)/i)
    || clean.match(/(\d+)\s*(?:قطعه|قطعة|حبه|حبة|pc|pcs)/i);
  if (m) return Number(m[1]);
  if (/^\s*\d{1,4}\s*$/.test(clean) && /quantity|gift_quantity|qty/.test(String(ctx?.waiting_for || ctx?.current_state?.waiting_for || ""))) return Number(clean.trim());
  return null;
}

function extractColors(message: string) {
  const n = normalize(message);
  const map: Record<string,string> = { كحلي:"navy", ذهبي:"gold", دهبي:"gold", فضي:"silver", ابيض:"white", اسود:"black", وردي:"pink", روز:"pink", ازرق:"blue", احمر:"red", اخضر:"green", بنفسجي:"purple", موف:"purple" };
  return [...new Set(Object.entries(map).filter(([k]) => n.includes(k)).map(([,v]) => v))];
}

function entities(message: string, ctx: any = {}) {
  const n = normalize(message);
  const current = ctx?.current_state || {};
  const detectedOccasion = occasionDetails(message);
  const freshProductSignal = /سعر|بكم|بكام|price|منتج|كوب|اكواب|مج|ستاند|بوكس|اكريلك|ورق|خشب|جلد|استيكر|فوركس/.test(n);
  const category = /اكريلك|acrylic/.test(n) ? "acrylic" : /بوكس|box/.test(n) ? "box" : /استيكر|ستيكر|sticker/.test(n) ? "sticker" : /كوب|اكواب|مج|cup|mug/.test(n) ? "cups" : /ورق|paper/.test(n) ? "paper" : /فوركس|forex|foam/.test(n) ? "forex" : ctx?.category || current?.category || "";
  const occasion = detectedOccasion.key || (freshProductSignal ? "" : (ctx?.occasion || current?.occasion || ""));
  const recipient = /اخت|اختي|لاختي/.test(n) ? "sister" : /اخ|اخي|لاخي/.test(n) ? "brother" : /ام|امي|الوالده/.test(n) ? "mother" : /اب|ابي|الوالد/.test(n) ? "father" : /زوجتي|مراتي|زوجه/.test(n) ? "wife" : /زوجي|جوزي/.test(n) ? "husband" : /بنتي|ابنتي/.test(n) ? "daughter" : /ابني|ولدي/.test(n) ? "son" : /صديقتي/.test(n) ? "female_friend" : /صديقي|صاحب/.test(n) ? "friend" : ctx?.recipient || current?.recipient || "";
  const city = /راس الخيمه|رأس الخيمة/.test(n) ? "Ras Al Khaimah" : /دبي/.test(n) ? "Dubai" : /ابوظبي|أبوظبي/.test(n) ? "Abu Dhabi" : /الشارقه|الشارقة/.test(n) ? "Sharjah" : /عجمان/.test(n) ? "Ajman" : ctx?.city || current?.city || "";
  const budget = parseNumber(message, "budget", ctx) ?? ctx?.budget ?? current?.budget ?? null;
  const quantity = parseNumber(message, "quantity", ctx) ?? ctx?.quantity ?? current?.quantity ?? null;
  const colors = extractColors(message).length ? extractColors(message) : (ctx?.colors || current?.colors || []);
  const explicitProductSignal = /هديه|هديه|هدايا|gift|منتج|منتجات|فئه|فئه|كولكشن|وريني|اعرض|اكريليك|بوكس|استيكر|ورق|كوب|اكواب|مج|فوركس|خشب|جلد/.test(n) || Boolean(detectedOccasion.label);
  return { ...ctx, topic: topic(message, ctx), normalized: n, order_number: ((waitingFor(ctx)==="order_number" || explicitOrderSignal(message)) ? orderRef(message) : "") || ctx?.order_number || current?.order_number || "", category, occasion, occasion_label: detectedOccasion.label || ctx?.occasion_label || current?.occasion_label || "", explicit_occasion: Boolean(detectedOccasion.label), explicit_product_signal: explicitProductSignal, recipient, city, budget, quantity, colors };
}

function siteDeterministicRoute(message: string, ctx: any) {
  const n = normalize(message);
  if (!n) return { action: "silent", reply: "", unanswered: false, entities: ctx };

  const waiting = waitingFor(ctx);
  if (waiting === "order_number") {
    if (/^#?\s*\d{3,10}\s*$/.test(String(message || "").replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))))) {
      return { action: "order_track", reply: "", unanswered: false, entities: ctx };
    }
    return { action: "clarify", reply: "📦 أنا مستني رقم الطلب عشان أكمل التتبع. ابعته بالأرقام، مثال: 1151.", unanswered: false, entities: ctx };
  }

  const genericPrice = /(?:ابغي|ابي|اريد|عايز|محتاج).*(?:اعرف|معرفه).*(?:سعر|السعر).*(?:منتج|شي|حاجه)?|(?:سعر\s+منتج).*(?:بس|فقط|الحين|الان)?/i.test(n);
  if (genericPrice && !/\d/.test(n)) {
    return { action: "clarify", reply: "أكيد 🌷 شو اسم المنتج والمقاس اللي حاب تعرف سعره؟", unanswered: false, entities: { ...ctx, waiting_for: "price_product" } };
  }

  const specificRoutes: Array<[RegExp, string, string]> = [
    [/(?:مقاعد|بنش|benches).*(?:خشب)|(?:خشب).*(?:مقاعد|بنش|benches)/i, "https://bariqgifts.com/categories.html?category=Wood&subcategory=benches", "مقاعد خشب"],
    [/(?:طاولات|طاوله|طاولة).*(?:فوركس)|(?:فوركس).*(?:طاولات|طاوله|طاولة)/i, "https://bariqgifts.com/categories.html?category=Forex&subcategory=tables", "طاولات فوركس"],
    [/(?:طاولات|طاوله|طاولة).*(?:خشب)|(?:خشب).*(?:طاولات|طاوله|طاولة)/i, "https://bariqgifts.com/categories.html?category=Wood&subcategory=tables", "طاولات خشب"],
    [/(?:طاولات|طاوله|طاولة).*(?:جلد)|(?:جلد).*(?:طاولات|طاوله|طاولة)/i, "https://bariqgifts.com/categories.html?category=Leather&subcategory=tables", "طاولات جلد"],
    [/(?:بوكس|بوكسات|صندوق).*(?:جلد)|(?:جلد).*(?:بوكس|بوكسات|صندوق)/i, "https://bariqgifts.com/categories.html?category=Leather&subcategory=boxes", "بوكسات جلد"],
    [/(?:ستاند|استاند|ستاندات).*(?:فوركس)|(?:فوركس).*(?:ستاند|استاند|ستاندات)/i, "https://bariqgifts.com/categories.html?category=Forex&subcategory=stands", "ستاندات فوركس"],
    [/(?:طاولات|طاوله|طاولة).*(?:اكريليك)|(?:اكريليك).*(?:طاولات|طاوله|طاولة)/i, "https://bariqgifts.com/categories.html?category=Acrylic&subcategory=Tables", "طاولات أكريليك"],
  ];
  for (const [pattern, url, label] of specificRoutes) {
    if (pattern.test(n) && !/سعر|بكم|بكام/.test(n)) return { action: "answer", reply: `أكيد 🎁 تقدر تشوف ${label} من هنا: ${url}`, unanswered: false, entities: ctx };
  }

  const asksBrowse = /(?:شو|ايه|ابي|ابغي|اريد|عندكم|وين|ورني|اشوف|اعرض|قسم)/i.test(n);
  const mainRoutes: Array<[RegExp, string, string]> = [
    [/خشب/i, "Wood", "قسم الخشب"], [/فوركس/i, "Forex", "قسم الفوركس"],
    [/جلد/i, "Leather", "قسم الجلد"], [/اكريليك/i, "Acrylic", "قسم الأكريليك"],
    [/ورق/i, "Paper", "قسم الورق"], [/استيكر/i, "Sticker", "قسم الاستيكر"],
    [/رمضان/i, "Ramadan", "قسم رمضان"], [/مناسبات/i, "Occasions", "قسم المناسبات"],
  ];
  if (asksBrowse && !/سعر|بكم|بكام/.test(n)) {
    for (const [pattern, category, label] of mainRoutes) {
      if (pattern.test(n)) return { action: "answer", reply: `أكيد 🎁 تقدر تشوف ${label} من هنا: https://bariqgifts.com/categories.html?category=${category}`, unanswered: false, entities: ctx };
    }
  }

  const giftRequest = /هديه|هدايا|gift|مناسبه|توزيعات/.test(n);
  if (giftRequest && ctx.explicit_occasion) return { action: "product_search", reply: "", unanswered: false, entities: ctx };
  if (giftRequest && !ctx.explicit_occasion) {
    return { action: "clarify", reply: "أكيد 🎁 شو المناسبة؟ عيد ميلاد، تخرج، مولود، زواج، اليوم الوطني، عيد ولا مناسبة ثانية؟", unanswered: false, entities: { ...ctx, waiting_for: "gift_occasion" } };
  }
  return null;
}

function canonicalAction(value: unknown) {
  const raw = String(value || "").trim().toUpperCase();
  return ACTION_ALIASES[raw] || raw || "NONE";
}

function returnOrderIntent(message: string) {
  const n = normalize(message);
  return /(?:ارجاع|إرجاع|رجوع|استرجاع|استرداد|مرتجع|ارجعه|ارجع|refund|return)/i.test(n);
}

function levenshtein(a: string, b: string) {
  a=normalize(a); b=normalize(b);
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=0;i<a.length;i++){
    const cur=[i+1];
    for(let j=0;j<b.length;j++) cur[j+1]=Math.min(cur[j]+1,prev[j+1]+1,prev[j]+(a[i]===b[j]?0:1));
    for(let j=0;j<cur.length;j++)prev[j]=cur[j];
  }
  return prev[b.length];
}
function wholeSimilarity(a:string,b:string){
  a=normalize(a);b=normalize(b);if(!a||!b)return 0;
  return Math.max(0,1-levenshtein(a,b)/Math.max(a.length,b.length));
}
function waitingFor(ctx:any){ return String(ctx?.waiting_for || ctx?.current_state?.waiting_for || ''); }
function explicitOrderSignal(message:string){ return /طلب|طلبي|اوردر|order|تتبع|حاله|حالة|وصل|فين|وين|اتشحن|شحن|رقم الطلب/.test(normalize(message)); }

function phraseMatch(message: string, question: string) {
  const msg = normalize(message);
  const q = normalize(question);
  if (!msg || !q) return false;
  if (msg === q || msg.includes(q)) return true;
  const stop = new Set(["هل", "هو", "هي", "في", "فيه", "عند", "لو", "ممكن", "من", "عن"]);
  const qTokens = q.split(" ").filter((x) => x.length > 1 && !stop.has(x));
  const msgTokens = new Set(msg.split(" ").filter((x) => x.length > 1 && !stop.has(x)));
  return qTokens.length >= 2 && qTokens.every((x) => msgTokens.has(x));
}

function actionFromKnowledge(item: any) {
  let action = canonicalAction(item?.action_name);
  const value = String(item?.action_value || item?.param_example || "");
  if (/categories\.html|[?&]category=|[?&]subcategory=/i.test(value)) action = "CATEGORY_PRODUCTS";
  return action;
}

function priceKnowledgeCompatible(message: string, item: any) {
  const n = normalize(message);
  if (!/(?:سعر|بكم|بكام|كم سعر|كام سعر|price)/.test(n)) return true;
  const stop = new Set(["سعر", "بكم", "بكام", "كم", "كام", "شو", "ايه", "هذا", "هاذا", "المنتج", "درهم", "aed"]);
  const messageTerms = n.split(" ").filter((term) => term.length > 1 && !stop.has(term));
  if (!messageTerms.length) return true;
  const knowledgeTerms = new Set(normalize([item?.question, item?.action_value, item?.param_example].filter(Boolean).join(" "))
    .split(" ").filter((term) => term.length > 1 && !stop.has(term)));
  return messageTerms.some((term) => knowledgeTerms.has(term));
}

function intentKnowledge(message: string, rows: any[]) {
  const n = normalize(message);
  const introIntent = /^(?:انتو مين|انتم مين|من انتم|مين انتو|مين انتم|انت مين|مين انت|من انت|عرفني بنفسك|عرف نفسك|مين بريق(?: للهدايا)?|ما هو دورك|ايه دورك|دورك ايه|تقدر تعمل ايه|بتعمل ايه|who are you|what can you do)$/i;
  if (!introIntent.test(n)) return null;

  // Keep the customer-facing text owned by the knowledge base. This only
  // resolves dialect variants of the same intent; it never supplies an answer.
  return rows.find((row: any) => {
    if (!String(row?.answer || "").trim()) return false;
    const category = normalize(row?.category);
    const question = normalize(row?.question);
    return category.includes("تعريف الشركه") || introIntent.test(question);
  }) || null;
}

async function rpcSearch(req: Request, message: string, ctx: any) {
  const incomingAuth = req.headers.get("authorization") || "";
  const incomingApiKey = req.headers.get("apikey") || "";
  const key = SERVICE_KEY || incomingApiKey || ANON_KEY;
  if (!key) return [];
  const requestHeaders: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
  };
  if (!SERVICE_KEY && incomingAuth.toLowerCase().startsWith("bearer ")) {
    requestHeaders.Authorization = incomingAuth;
  }
  const res = await fetch(`${SB_URL}/rest/v1/rpc/bot_knowledge_search`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ p_message: ctx.normalized || message, p_context: ctx, p_limit: 30 }),
  });
  if (!res.ok) {
    console.warn("bot_knowledge_search failed", res.status, await res.text());
    return [];
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function classify(rows: any[]) {
  const best = rows[0];
  const second = rows[1];
  if (!best) return { label: "low", selected: null };
  const score = Number(best.__v4_score ?? best.score ?? 0);
  const margin = score - Number(second?.__v4_score ?? second?.score ?? 0);
  const action = actionFromKnowledge(best);
  const hasToken = Array.isArray(best.matched_tokens) && best.matched_tokens.length > 0;
  const typoSim = Number((best as any).__v4_similarity || 0);
  const actionHigh = ["CATEGORY_PRODUCTS", "PRODUCT_SEARCH", "CUSTOM_GIFT_ORDER", "TRACK_ORDER"].includes(action) && hasToken && score >= 20;
  const phrase = Boolean((best as any).__v4_phrase);
  const high = typoSim >= 0.86 || phrase || actionHigh || (hasToken && (score >= 38 || (score >= 28 && margin >= 8)));
  return { label: high ? "high" : score >= 18 ? "medium" : "low", selected: high ? best : null, candidate: best };
}

function rerankCandidates(message: string, rows: any[], ctx: any = {}) {
  const boosted = [...rows].map((x:any)=>{
    const sim=wholeSimilarity(message,x.question||"");
    const phrase=phraseMatch(message,x.question||"");
    const doc=normalize([x.question,x.answer,x.category,JSON.stringify(x.keywords||[]),x.action_value].join(" "));
    const occasionLabel=ctx?.explicit_occasion ? normalize(ctx?.occasion_label||"") : "";
    const occasionBoost=occasionLabel && doc.includes(occasionLabel) ? 100 : 0;
    return {...x,__v4_phrase:phrase,__v4_similarity:sim,__v4_score:Number(x.score||0)+(phrase?60:0)+(sim>=.86?35:sim>=.78?18:0)+occasionBoost};
  }).sort((a:any,b:any)=>Number(b.__v4_score||0)-Number(a.__v4_score||0));
  rows=boosted;
  if (!returnOrderIntent(message)) return rows;
  return [...rows].sort((a, b) => {
    const score = (x: any) => {
      const action = actionFromKnowledge(x);
      const text = normalize([x.question, x.answer, x.keywords].filter(Boolean).join(" "));
      let s = Number(x.score || 0);
      if (phraseMatch(message, x.question || "")) s += 50;
      if (action === "UPDATE_ORDER") s += 30;
      if (/ارجاع|إرجاع|استرجاع|استرداد|مرتجع|refund|return/.test(text)) s += 20;
      if (["CREATE_QUOTE", "CUSTOM_GIFT_ORDER", "PRODUCT_SEARCH", "CATEGORY_PRODUCTS", "PRODUCT_LOOKUP"].includes(action)) s -= 30;
      if (/اعمل طلب|اسوي طلب|اطلب|اشتري|شراء|طلب جديد/.test(text)) s -= 20;
      return s;
    };
    return score(b) - score(a);
  });
}

async function describeImage(imageUrl: string) {
  if (!imageUrl || !OPENAI_API_KEY) return "";
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: [
        { type: "text", text: "صف هذا المنتج بالعربية باختصار: نوعه، لونه، شكله، وهل فيه كتابة أو نقش؟" },
        { type: "image_url", image_url: { url: imageUrl } },
      ] }],
      max_tokens: 180,
    });
    return res.choices[0]?.message?.content || "";
  } catch (e) {
    console.warn("Vision error", e?.message || e);
    return "";
  }
}

function absoluteProductImage(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://bariqgifts.com/${raw.replace(/^\/+/, "")}`;
}

async function liveProducts() {
  if (!SERVICE_KEY) return [];
  const res = await fetch(`${SB_URL}/rest/v1/products?active=eq.true&select=id,name_ar,name_en,description_ar,description_en,image,gallery,price,stock,categories,category_id,subcategory_id,featured&limit=500`, {
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
  });
  return res.ok ? await res.json().catch(() => []) : [];
}

async function liveTaxonomy() {
  if (!SERVICE_KEY) return { categories: [], subcategories: [] };
  const headers = { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` };
  const [categoriesRes, subcategoriesRes] = await Promise.all([
    fetch(`${SB_URL}/rest/v1/categories?active=eq.true&select=*&limit=500`, { headers }),
    fetch(`${SB_URL}/rest/v1/subcategories?active=eq.true&select=*&limit=500`, { headers }),
  ]);
  return {
    categories: categoriesRes.ok ? await categoriesRes.json().catch(() => []) : [],
    subcategories: subcategoriesRes.ok ? await subcategoriesRes.json().catch(() => []) : [],
  };
}

function taxonomyText(product: any, taxonomy: any) {
  const category = taxonomy.categories.find((row: any) => String(row.id) === String(product.category_id || ""));
  const subcategory = taxonomy.subcategories.find((row: any) => String(row.id) === String(product.subcategory_id || ""));
  return [category, subcategory].map((row: any) => row ? [row.name_ar, row.name_en, row.slug, row.category_slug, row.description_ar].filter(Boolean).join(" ") : "").join(" ");
}

function liveProductName(product: any) {
  return String(product?.name_ar || product?.name_en || "منتج").trim();
}

function liveProductLink(product: any) {
  return `https://bariqgifts.com/product.html?id=${encodeURIComponent(product?.id || "")}`;
}

function liveProductList(products: any[]) {
  return products.map((product, index) => `${index + 1}. ${liveProductName(product)}${Number(product?.price) > 0 ? ` — ${Number(product.price).toFixed(2)} AED` : ""}\n${liveProductLink(product)}`).join("\n\n");
}

function usefulProductTerms(value: string) {
  const stop = new Set(["سعر", "بكم", "بكام", "كم", "كام", "شو", "ايه", "هذا", "هاذا", "المنتج", "عندكم", "عايز", "اريد", "هديه", "هدايا"]);
  return normalize(value).split(" ").filter((term) => term.length > 1 && !stop.has(term));
}

async function matchLiveProduct(value: string) {
  const terms = usefulProductTerms(value);
  if (!terms.length) return null;
  const ranked = (await liveProducts()).map((product: any) => {
    const name = normalize(liveProductName(product));
    const doc = normalize([product.name_ar, product.name_en, product.description_ar, product.description_en, product.categories].join(" "));
    const matched = terms.filter((term) => name.includes(term) || doc.includes(term));
    const nameMatches = terms.filter((term) => name.includes(term)).length;
    return { product, score: nameMatches * 20 + (matched.length - nameMatches) * 3, matched: matched.length, nameMatches };
  }).filter((row: any) => row.matched > 0)
    .sort((a: any, b: any) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.nameMatches < 1 || best.matched < Math.min(2, terms.length)) return null;
  return best.product;
}

function parseMultiProducts(value: string) {
  const clean = String(value || "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[،,]+/g, " و ");
  const chunks = clean.split(/\s+و\s+/).map((part) => part.trim()).filter(Boolean);
  const pairs: any[] = [];
  for (const chunk of chunks) {
    const match = chunk.replace(/^(?:عايز|اريد|أريد|ابغي|أبغي|عطني|هات)\s*/i, "").match(/^(\d+)\s*(?:حبه|حبة|قطعه|قطعة|وحده|وحدة)?\s*(.+)$/i);
    if (match && Number(match[1]) > 0 && match[2]) pairs.push({ quantity: Number(match[1]), name: match[2].trim() });
  }
  return pairs.length >= 2 ? pairs : [];
}

async function liveCommerceResult(message: string, ctx: any) {
  const multi = parseMultiProducts(message);
  if (multi.length) {
    const rows: any[] = [];
    for (const pair of multi) {
      const product = await matchLiveProduct(pair.name);
      if (!product || !(Number(product.price) > 0)) return null;
      rows.push({ product, quantity: pair.quantity, subtotal: pair.quantity * Number(product.price) });
    }
    const products = rows.map(({ product }) => product);
    const reply = rows.map(({ product, quantity, subtotal }) => `• ${quantity} ${liveProductName(product)} × ${Number(product.price).toFixed(2)} درهم = ${subtotal.toFixed(2)} درهم`).join("\n")
      + `\n\n💰 الإجمالي: ${rows.reduce((sum, row) => sum + row.subtotal, 0).toFixed(2)} درهم`;
    return { action: "multi_item_calc", knowledge_id: null, reply, products, entities: { ...ctx, shopping_cart: rows.map(({ product, quantity }) => ({ product_id: product.id, name: liveProductName(product), qty: quantity, unitPrice: Number(product.price) })), last_product: products.at(-1) } };
  }

  const quantityText = String(message).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const bareQuantity = quantityText.match(/^\s*(\d{1,4})\s*$/)?.[1]
    || quantityText.match(/(?:لو\s*(?:عايز|ابغي|ابي|اريد)|عايز|ابغي|ابي|اريد)\s*(\d{1,4})(?:\s*(?:حبه|حبة|قطعه|قطعة))?/i)?.[1]
    || quantityText.match(/^\s*(\d{1,4})\s*(?:بكم|بكام|كم|كام)(?:\s*(?:الحساب|الاجمالي))?\s*\??$/i)?.[1];
  const last = ctx?.last_product || ctx?.current_state?.lastProduct;
  const unit = Number(ctx?.last_unit_price || last?.price || 0);
  if (bareQuantity && unit > 0 && last) {
    const quantity = Number(bareQuantity);
    return { action: "quantity_price", knowledge_id: null, reply: `لو ${quantity} ${last.name || "وحدة"} × ${unit.toFixed(2)} درهم = ${(quantity * unit).toFixed(2)} درهم إجماليًا.`, products: [last], entities: { ...ctx, quantity, last_product: last, last_unit_price: unit } };
  }
  return null;
}

async function recommendLiveProducts(message: string, ctx: any) {
  const terms = usefulProductTerms([message, ctx?.occasion_label, ctx?.category].filter(Boolean).join(" "));
  if (!terms.length) return [];
  const [products, taxonomy] = await Promise.all([liveProducts(), liveTaxonomy()]);
  return products.map((product: any) => {
    const doc = normalize([product.name_ar, product.name_en, product.description_ar, product.description_en, product.categories, taxonomyText(product, taxonomy)].join(" "));
    const requiredOccasion = ctx?.explicit_occasion ? normalize(ctx?.occasion_label || "") : "";
    const productIdentity = normalize([product.name_ar, product.name_en, product.categories, taxonomyText(product, taxonomy)].join(" "));
    const occasionGroups: Record<string, RegExp> = {
      graduation: /تخرج|graduation|graduate/,
      newborn: /مولود|مواليد|بيبي|newborn|baby/,
      wedding: /زواج|عرس|فرح|wedding/,
      birthday: /ميلاد|birthday/,
      engagement: /خطوبه|خطوبة|engagement/,
    };
    const requestedGroup = String(ctx?.occasion || "");
    if (requestedGroup && occasionGroups[requestedGroup]) {
      const conflicts = Object.entries(occasionGroups).filter(([key, pattern]) => key !== requestedGroup && pattern.test(productIdentity));
      if (conflicts.length) return { ...product, _score: -1 };
    }
    if (requiredOccasion && !doc.includes(requiredOccasion)) return { ...product, _score: -1 };
    const score = terms.reduce((sum, term) => sum + (doc.includes(term) ? 1 : 0), 0);
    return { ...product, _score: score };
  }).filter((product: any) => product._score > 0 && Number(product.stock ?? 0) >= 0)
    .sort((a: any, b: any) => b._score - a._score || Number(a.price || 0) - Number(b.price || 0)).slice(0, 4);
}

function normalizedPhone(value: unknown) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `971${digits.slice(1)}`;
  else if (digits.startsWith("5") && digits.length === 9) digits = `971${digits}`;
  return digits;
}

async function liveOrderResult(message: string, ctx: any) {
  const waiting = waitingFor(ctx) === "order_number";
  const n = normalize(message);
  const signal = /تتبع|اتابع|تابع|متابعه|متابعة|حاله|حالة|فين|وين|وصل|اتشحن|شحن|رقم الطلب|track|order status/.test(n);
  if (!waiting && !signal) return null;
  const ref = orderRef(message);
  if (!ref) return { action: "order_track", knowledge_id: null, reply: "أكيد 📦 ابعت رقم الطلب وأنا أجيب لك حالته وآخر تحديث.", entities: { ...ctx, waiting_for: "order_number", topic: "order" } };
  const res = await fetch(`${SB_URL}/rest/v1/orders?select=id,order_number,customer_phone,total,status,created_at&or=(order_number.eq.${encodeURIComponent(ref)},order_number.eq.${encodeURIComponent(`#${ref}`)})&limit=1`, { headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` } });
  const order = res.ok ? (await res.json().catch(() => []))[0] : null;
  if (!order) return { action: "order_track", knowledge_id: null, reply: `رقم الطلب #${ref} مش موجود عندنا. اتأكد من الرقم وابعته مرة ثانية.`, entities: { ...ctx, waiting_for: "order_number", topic: "order", order_number: ref } };
  const sender = normalizedPhone(ctx?.sender_phone);
  const owner = normalizedPhone(order.customer_phone);
  if (sender && owner && sender !== owner) return { action: "order_track", knowledge_id: null, reply: "لقيت رقم الطلب، لكن حفاظًا على خصوصيتك لازم تراسلنا من رقم الهاتف المسجّل في الطلب.", entities: { ...ctx, waiting_for: "order_number", topic: "order" } };
  const labels: Record<string, string> = { pending: "جديد", new: "جديد", confirmed: "تم تأكيد الطلب ✅", processing: "جاري تجهيز الطلب ⏳", manufacturing: "قيد التصنيع 🛠️", shipped: "تم شحن الطلب 🚚", delivered: "تم توصيل الطلب 🎉", cancelled: "تم إلغاء الطلب ❌", refunded: "تم استرجاع المبلغ" };
  const reply = `📦 حالة طلبك ${order.order_number || `#${ref}`}:\n${labels[String(order.status || "").toLowerCase()] || order.status || "قيد المعالجة"}${order.total != null ? `\n💰 إجمالي الطلب: ${Number(order.total).toFixed(2)} AED` : ""}`;
  return { action: "order_track", knowledge_id: null, reply, entities: { ...ctx, waiting_for: "", topic: "order", order_number: ref }, order_id: order.id };
}

async function visualProductMatch(imageUrl: string, description: string) {
  if (!imageUrl || !OPENAI_API_KEY || !SERVICE_KEY) return null;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/products?active=eq.true&select=id,name_ar,name_en,description_ar,description_en,image,gallery,price,stock&limit=500`, {
      headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) return null;
    const products = await res.json();
    const exact = products.find((p: any) => {
      const urls = [p.image, ...(Array.isArray(p.gallery) ? p.gallery : [])].map(absoluteProductImage);
      return urls.includes(absoluteProductImage(imageUrl));
    });
    if (exact) return exact;

    const words = normalize(description).split(" ").filter((w) => w.length > 2);
    const candidates = products.map((p: any) => {
      const doc = normalize([p.name_ar, p.name_en, p.description_ar, p.description_en].join(" "));
      const score = words.reduce((sum, word) => sum + (doc.includes(word) ? 1 : 0), 0);
      return { ...p, _visual_text_score: score, _image: absoluteProductImage(p.image || p.gallery?.[0]) };
    }).filter((p: any) => p._image).sort((a: any, b: any) => b._visual_text_score - a._visual_text_score).slice(0, 8);
    if (!candidates.length) return null;

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const content: any[] = [
      { type: "text", text: `قارن صورة العميل الأولى بصور المنتجات التالية. اختر منتجًا فقط إذا كان نفس المنتج أو مطابقًا بصريًا بدرجة عالية جدًا، وليس لمجرد تشابه الفئة. أعد JSON فقط: {"product_id":"","confidence":0.0}. المرشحون: ${JSON.stringify(candidates.map((p: any) => ({ id: p.id, name: p.name_ar || p.name_en })))}` },
      { type: "image_url", image_url: { url: imageUrl } },
    ];
    candidates.forEach((p: any) => {
      content.push({ type: "text", text: `product_id=${p.id}` });
      content.push({ type: "image_url", image_url: { url: p._image } });
    });
    const matchRes = await openai.chat.completions.create({
      model: "gpt-4o-mini", temperature: 0, max_tokens: 80,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }],
    });
    const parsed = JSON.parse(matchRes.choices[0]?.message?.content || "{}");
    if (Number(parsed.confidence || 0) < 0.9) return null;
    return candidates.find((p: any) => String(p.id) === String(parsed.product_id)) || null;
  } catch (error) {
    console.warn("visual product match error", error?.message || error);
    return null;
  }
}

async function semanticFallback(message: string, ctx: any, rows: any[], conversation: any[] = []) {
  if (!OPENAI_API_KEY) return null;
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const candidates = rows.slice(0, 5).map((x: any) => ({ id:x.id, question:x.question, action:actionFromKnowledge(x), score:x.score }));
    const memories = Array.isArray(ctx?.memories) ? ctx.memories.slice(0, 8) : [];
    const recent = Array.isArray(conversation) ? conversation.slice(-10).map((x:any)=>({ role:x.role, text:x.text || x.message || "" })) : [];
    const prompt = { message, current_state: ctx?.current_state || {}, conversation_summary: ctx?.conversation_summary || null, memories, recent_messages: recent, knowledge_candidates: candidates };
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini", temperature: 0.1, max_tokens: 260, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `أنت Router لمساعد مبيعات Bariq. قاعدة المعرفة المطابقة بقوة لها الأولوية ولا يجوز تغيير معناها أو استبدال ردها برد عام. احترم waiting_for: إذا كان النظام ينتظر قيمة محددة فافهم الرسالة التالية على هذا الأساس ما لم يسأل العميل سؤالًا مباشرًا مختلفًا. لا تخترع سعرًا أو مخزونًا أو حالة طلب أو تاريخ توصيل أو منتجًا أو خصمًا. البيانات الحية تأتي من الأدوات فقط. استخدم السياق لفهم المرجع مثل "خليهم 80". أعد JSON فقط بالشكل: {"action":"product_search|order_track|clarify|human|silent","reply":"","entities":{},"confidence":0.0}. استخدم clarify فقط لو لا يمكن فهم المرجع من current_state/recent_messages. استخدم product_search لطلب هدايا/منتجات. استخدم order_track فقط عند سؤال حالة طلب. استخدم human عند طلب موظف. استخدم silent للأسئلة العامة التي لا توجد لها معرفة مؤكدة.` },
        { role: "user", content: JSON.stringify(prompt) }
      ]
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
    return parsed?.action ? parsed : null;
  } catch (e) { console.warn("semantic fallback error", e?.message || e); return null; }
}

async function decision(req: Request, message: string, ctx: any, rows: any[], imageDescription = "", semantic: any = null, visualProduct: any = null) {
  if (imageDescription) {
    const products = visualProduct ? [{ id: visualProduct.id, name: visualProduct.name_ar || visualProduct.name_en, price: visualProduct.price, image: visualProduct.image, name_ar: visualProduct.name_ar, name_en: visualProduct.name_en }] : [];
    const reply = visualProduct ? `لقيت نفس المنتج المطابق للصورة من الموقع 👇\n\n${liveProductList([visualProduct])}` : "";
    return json(req, { action: visualProduct ? "product_search" : "image_search", knowledge_id: null, reply, confidence: visualProduct ? 0.99 : 0.45, image_description: imageDescription, entities: { ...ctx, last_product: visualProduct ? { id: visualProduct.id, name: liveProductName(visualProduct), price: Number(visualProduct.price || 0), link: liveProductLink(visualProduct) } : ctx?.last_product }, candidates: rows.slice(0, 5), products, silent_if_no_results: true });
  }
  if (ctx.topic === "order" && ctx.order_number) {
    const orderKnowledge = rows.find((x) => actionFromKnowledge(x) === "TRACK_ORDER" && String(x.answer || "").trim());
    if (orderKnowledge) return json(req, { action: "order_track", knowledge_id: Number(orderKnowledge.id) || null, action_name: "TRACK_ORDER", action_value: orderKnowledge.action_value || orderKnowledge.param_example || "", reply: orderKnowledge.answer || "", confidence: 0.98, confidence_label: "high", image_description: "", entities: ctx, candidates: rows.slice(0, 5) });
  }
  const intentSelected = intentKnowledge(message, rows);
  if (intentSelected) {
    const action = actionFromKnowledge(intentSelected);
    return json(req, { action: RESPONSE_ACTION[action] || "answer", knowledge_id: Number(intentSelected.id) || null, action_name: action, action_value: intentSelected.action_value || intentSelected.param_example || "", reply: intentSelected.answer, confidence: 0.99, confidence_label: "high", image_description: "", entities: ctx, candidates: rows.slice(0, 5) });
  }
  const hit = classify(rows);
  if (hit.label === "high" && hit.selected) {
    const selected = hit.selected; const action = actionFromKnowledge(selected);
    const productActions = ["CATEGORY_PRODUCTS", "PRODUCT_SEARCH", "CUSTOM_GIFT_ORDER", "PRODUCT_LOOKUP"];
    if ((!productActions.includes(action) || ctx.explicit_product_signal) && priceKnowledgeCompatible(message, selected)) {
      if (productActions.includes(action)) {
        const products = await recommendLiveProducts([message, selected.question, selected.action_value].filter(Boolean).join(" "), ctx);
        if (products.length) {
          const reply = `${String(selected.answer || "").trim()}\n\n${liveProductList(products)}`.trim();
          return json(req, { action: "product_search", knowledge_id: Number(selected.id) || null, action_name: action, action_value: selected.action_value || selected.param_example || "", reply, products, confidence: 0.99, confidence_label: "high", image_description: "", entities: { ...ctx, last_product: { id: products[0].id, name: liveProductName(products[0]), price: Number(products[0].price || 0), link: liveProductLink(products[0]) } }, candidates: rows.slice(0, 5) });
        }
      }
      let responseEntities = ctx;
      if (/(?:سعر|بكم|بكام|كم سعر|كام سعر|price)/.test(normalize(message))) {
        const unitPrice = Number(String(selected.answer || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0] || 0);
        if (unitPrice > 0) {
          const productLabel = normalize(selected.question || message).replace(/^(?:كم سعر|كام سعر|شو سعر|سعر|بكم|بكام)\s*/i, "").trim();
          responseEntities = { ...ctx, last_product: { id: null, name: productLabel || "وحدة", price: unitPrice, link: "" }, last_unit_price: unitPrice };
        }
      }
      return json(req, { action: RESPONSE_ACTION[action] || "answer", knowledge_id: Number(selected.id) || null, action_name: action, action_value: selected.action_value || selected.param_example || "", reply: selected.answer || "", confidence: Math.min(0.99, Math.max(0.76, Number(selected.score || 0) / 55)), confidence_label: "high", image_description: "", entities: responseEntities, candidates: rows.slice(0, 5) });
    }
  }
  if (ctx.explicit_product_signal) {
    if (/(?:سعر|بكم|بكام|كم سعر|كام سعر|price)/.test(normalize(message))) {
      const product = await matchLiveProduct(message);
      if (product && Number(product.price) > 0) {
        return json(req, { action: "product_price", knowledge_id: null, reply: `سعر ${liveProductName(product)} هو ${Number(product.price).toFixed(2)} AED.\n${liveProductLink(product)}`, products: [product], confidence: 0.96, confidence_label: "high", image_description: "", candidates: rows.slice(0, 5), unanswered: false, entities: { ...ctx, last_product: { id: product.id, name: liveProductName(product), price: Number(product.price), link: liveProductLink(product) }, last_unit_price: Number(product.price) } });
      }
    }
    const products = await recommendLiveProducts(message, ctx);
    const reply = products.length ? `${ctx.occasion_label ? `🎁 دي أفضل اختياراتنا لمناسبة ${ctx.occasion_label}:` : "لقيت لك اختيارات مناسبة من الموقع 👇"}\n\n${liveProductList(products)}` : "";
    return json(req, { action: products.length ? "product_search" : "silent", knowledge_id: null, reply, products, confidence: products.length ? 0.9 : 0.2, confidence_label: products.length ? "high" : "low", image_description: "", entities: ctx, candidates: rows.slice(0, 5), unanswered: !products.length });
  }
  // AI may classify a product request, but it is never allowed to invent the
  // customer-facing answer. The webhook will answer from live catalogue data.
  if (semantic && String(semantic.action || "") === "product_search") {
    return json(req, { action: "product_search", knowledge_id: null, reply: "", confidence: Math.max(0.35, Math.min(0.92, Number(semantic.confidence || 0.6))), confidence_label: hit.label === "medium" ? "medium" : "low", image_description: "", entities: { ...ctx, ...(semantic.entities || {}) }, candidates: rows.slice(0, 5), unanswered: false });
  }
  if (hit.label === "medium") return json(req, { action: "silent", knowledge_id: null, reply: "", confidence: 0.55, confidence_label: "medium", image_description: "", entities: ctx, candidates: rows.slice(0, 5), unanswered: true });
  return json(req, { action: "silent", knowledge_id: null, reply: "", confidence: 0.1, confidence_label: "low", image_description: "", entities: ctx, candidates: rows.slice(0, 5), unanswered: true });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  if (!(await isAllowedCaller(req))) return json(req, { error: "Unauthorized" }, 401);
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }
  const message = String(body.message || "");
  const imageUrl = String(body.image_url || "");
  const conversation = Array.isArray(body.conversation) ? body.conversation.slice(-18) : [];
  const ctx = entities(message, body.context || {});
  const imageDescription = await describeImage(imageUrl);
  const visualProduct = imageDescription ? await visualProductMatch(imageUrl, imageDescription) : null;
  const orderResult = imageUrl ? null : await liveOrderResult(message, ctx);
  if (orderResult) return json(req, { confidence: 0.99, confidence_label: "high", image_description: "", candidates: [], unanswered: false, ...orderResult });
  const commerce = imageUrl ? null : await liveCommerceResult(message, ctx);
  if (commerce) return json(req, { confidence: 0.99, confidence_label: "high", image_description: "", candidates: [], unanswered: false, ...commerce });
  const deterministic = imageUrl ? null : siteDeterministicRoute(message, ctx);
  if (deterministic && deterministic.action !== "product_search") {
    return json(req, { knowledge_id: null, confidence: 1, confidence_label: "high", image_description: "", candidates: [], ...deterministic });
  }
  const rows = rerankCandidates(message, await rpcSearch(req, message, ctx), ctx);
  const hit = classify(rows);
  const semantic = null;
  return await decision(req, message, ctx, rows, imageDescription, semantic, visualProduct);
});
