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
  return text
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\p{L}\p{N}#]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const category = /اكريلك|acrylic/.test(n) ? "acrylic" : /بوكس|box/.test(n) ? "box" : /استيكر|ستيكر|sticker/.test(n) ? "sticker" : /كوب|اكواب|مج|cup|mug/.test(n) ? "cups" : /ورق|paper/.test(n) ? "paper" : /فوركس|forex|foam/.test(n) ? "forex" : ctx?.category || current?.category || "";
  const occasion = /تخرج|تخريج/.test(n) ? "graduation" : /مولود|مواليد|بيبي/.test(n) ? "newborn" : /زواج|عرس/.test(n) ? "wedding" : /خطوب/.test(n) ? "engagement" : /ذكرى زواج|anniversary/.test(n) ? "anniversary" : /رمضان/.test(n) ? "ramadan" : /عيد ميلاد|ميلاد/.test(n) ? "birthday" : /عيد/.test(n) ? "eid" : ctx?.occasion || current?.occasion || "";
  const recipient = /اخت|اختي|لاختي/.test(n) ? "sister" : /اخ|اخي|لاخي/.test(n) ? "brother" : /ام|امي|الوالده/.test(n) ? "mother" : /اب|ابي|الوالد/.test(n) ? "father" : /زوجتي|مراتي|زوجه/.test(n) ? "wife" : /زوجي|جوزي/.test(n) ? "husband" : /بنتي|ابنتي/.test(n) ? "daughter" : /ابني|ولدي/.test(n) ? "son" : /صديقتي/.test(n) ? "female_friend" : /صديقي|صاحب/.test(n) ? "friend" : ctx?.recipient || current?.recipient || "";
  const city = /راس الخيمه|رأس الخيمة/.test(n) ? "Ras Al Khaimah" : /دبي/.test(n) ? "Dubai" : /ابوظبي|أبوظبي/.test(n) ? "Abu Dhabi" : /الشارقه|الشارقة/.test(n) ? "Sharjah" : /عجمان/.test(n) ? "Ajman" : ctx?.city || current?.city || "";
  const budget = parseNumber(message, "budget", ctx) ?? ctx?.budget ?? current?.budget ?? null;
  const quantity = parseNumber(message, "quantity", ctx) ?? ctx?.quantity ?? current?.quantity ?? null;
  const colors = extractColors(message).length ? extractColors(message) : (ctx?.colors || current?.colors || []);
  return { ...ctx, topic: topic(message, ctx), normalized: n, order_number: ((waitingFor(ctx)==="order_number" || explicitOrderSignal(message)) ? orderRef(message) : "") || ctx?.order_number || current?.order_number || "", category, occasion, recipient, city, budget, quantity, colors };
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
  const qTokens = q.split(" ").filter((x) => x.length > 1);
  const msgTokens = new Set(msg.split(" ").filter(Boolean));
  return qTokens.length >= 2 && qTokens.every((x) => msgTokens.has(x));
}

function actionFromKnowledge(item: any) {
  let action = canonicalAction(item?.action_name);
  const value = String(item?.action_value || item?.param_example || "");
  if (action === "PRODUCT_LOOKUP" && /categories\.html|[?&]category=|[?&]subcategory=/i.test(value)) action = "CATEGORY_PRODUCTS";
  return action;
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
  const score = Number(best.score || 0);
  const margin = score - Number(second?.score || 0);
  const action = actionFromKnowledge(best);
  const hasToken = Array.isArray(best.matched_tokens) && best.matched_tokens.length > 0;
  const typoSim = Number((best as any).__v4_similarity || 0);
  const actionHigh = ["CATEGORY_PRODUCTS", "PRODUCT_SEARCH", "CUSTOM_GIFT_ORDER", "TRACK_ORDER"].includes(action) && hasToken && score >= 20;
  const high = typoSim >= 0.86 || actionHigh || score >= 38 || (score >= 28 && margin >= 8);
  return { label: high ? "high" : score >= 18 ? "medium" : "low", selected: high ? best : null, candidate: best };
}

function rerankCandidates(message: string, rows: any[]) {
  const boosted = [...rows].map((x:any)=>{
    const sim=wholeSimilarity(message,x.question||"");
    const phrase=phraseMatch(message,x.question||"");
    return {...x,__v4_similarity:sim,__v4_score:Number(x.score||0)+(phrase?60:0)+(sim>=.86?35:sim>=.78?18:0)};
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

function decision(req: Request, message: string, ctx: any, rows: any[], imageDescription = "", semantic: any = null) {
  if (imageDescription) return json(req, { action: "image_search", knowledge_id: null, reply: "", confidence: 0.96, image_description: imageDescription, entities: ctx, candidates: rows.slice(0, 5), silent_if_no_results: true });
  if (ctx.topic === "order" && ctx.order_number) {
    const orderKnowledge = rows.find((x) => actionFromKnowledge(x) === "TRACK_ORDER" && String(x.answer || "").trim());
    if (orderKnowledge) return json(req, { action: "order_track", knowledge_id: Number(orderKnowledge.id) || null, action_name: "TRACK_ORDER", action_value: orderKnowledge.action_value || orderKnowledge.param_example || "", reply: orderKnowledge.answer || "", confidence: 0.98, confidence_label: "high", image_description: "", entities: ctx, candidates: rows.slice(0, 5) });
  }
  const hit = classify(rows);
  if (hit.label === "high" && hit.selected) {
    const selected = hit.selected; const action = actionFromKnowledge(selected);
    return json(req, { action: RESPONSE_ACTION[action] || "answer", knowledge_id: Number(selected.id) || null, action_name: action, action_value: selected.action_value || selected.param_example || "", reply: selected.answer || "", confidence: Math.min(0.99, Math.max(0.76, Number(selected.score || 0) / 55)), confidence_label: "high", image_description: "", entities: ctx, candidates: rows.slice(0, 5) });
  }
  if (semantic && ["product_search","order_track","clarify","human"].includes(String(semantic.action || ""))) {
    return json(req, { action: semantic.action, knowledge_id: null, reply: String(semantic.reply || ""), confidence: Math.max(0.35, Math.min(0.92, Number(semantic.confidence || 0.6))), confidence_label: hit.label === "medium" ? "medium" : "low", image_description: "", entities: { ...ctx, ...(semantic.entities || {}) }, candidates: rows.slice(0, 5), unanswered: false });
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
  const rows = rerankCandidates(message, await rpcSearch(req, message, ctx));
  const hit = classify(rows);
  const semantic = (!imageDescription && hit.label !== "high") ? await semanticFallback(message, ctx, rows, conversation) : null;
  return decision(req, message, ctx, rows, imageDescription, semantic);
});
