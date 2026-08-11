// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { OpenAI } from "https://deno.land/x/openai@v4.20.1/mod.ts";

const ALLOWED_ORIGINS = [
  "https://bariqgifts.com",
  "https://www.bariqgifts.com",
  "https://admin.bariqgifts.com",
];

const ACTION_MAP: Record<string, string> = {
  TRACK_ORDER: "order_track",
  CATEGORY_PRODUCTS: "product_search",
  PRODUCT_SEARCH: "product_search",
  PRODUCT_LOOKUP: "product_search",
  IMAGE_PRODUCT_SEARCH: "image_search",
  HANDOFF_HUMAN: "human",
};

const CATEGORY_HINTS = [
  "مواليد", "مولود", "newborn", "baby",
  "تخرج", "graduation",
  "رمضان", "ramadan",
  "عيد", "eid",
  "ورق", "paper",
  "اكواب", "أكواب", "كوب", "مج", "cups", "mug",
  "فوركس", "الفوركس", "forex", "foam",
  "خشب", "wood",
  "جلد", "leather",
  "استيكر", "ستيكر", "sticker",
  "بوكس", "box",
  "توزيعات", "هدايا", "مناسبات",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function json(req: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders(req) });
}

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\p{L}\p{N}#]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasOrderRef(text: string) {
  return /(?:#\s*\d{3,}|\b\d{4,}\b|رقم\s*(?:طلب|الطلب)?\s*#?\s*\d{3,})/i.test(text);
}

function isOrderIntent(text: string) {
  const n = normalize(text);
  return hasOrderRef(text) || /\b(طلب|الطلب|اوردر|order|track|تتبع|حالته|حاله)\b/i.test(n);
}

function isCategoryIntent(text: string) {
  const n = normalize(text);
  const asksForProducts = /\b(حاجه|شي|منتج|منتجات|كولكشن|فئه|تخص|لل|ل|عايز|عايزه|وريني|اعرض|show|products?)\b/i.test(n);
  const hasCategory = CATEGORY_HINTS.some((term) => {
    const t = normalize(term);
    return new RegExp(`(^|\\s)(?:ال|لل|ل)?${t}(\\s|$)`, "i").test(n);
  });
  return asksForProducts && hasCategory;
}

function actionFromKnowledge(item: any) {
  const actionName = String(item?.action_name || "").trim().toUpperCase();
  if (ACTION_MAP[actionName]) return ACTION_MAP[actionName];

  const inputType = String(item?.input_type || "").trim().toLowerCase();
  if (inputType === "action" || inputType === "required_data") return "clarify";
  return "";
}

function knowledgeText(item: any) {
  const keywords = Array.isArray(item?.keywords) ? item.keywords.join(" ") : String(item?.keywords || "");
  return normalize([item?.question, item?.category, keywords].join(" "));
}

function exactKnowledgeMatch(message: string, knowledge: any[]) {
  const msg = normalize(message);
  if (!msg) return null;
  return knowledge.find((item) => {
    const q = normalize(item?.question);
    if (q && (msg === q || msg.includes(q) || q.includes(msg))) return true;
    const keywords = Array.isArray(item?.keywords) ? item.keywords : String(item?.keywords || "").split(/[,،]/);
    return keywords.some((kw) => {
      const k = normalize(kw);
      return k && new RegExp(`(^|\\s)${k}(\\s|$)`, "i").test(msg);
    });
  }) || null;
}

function guardedDecision(message: string, imageUrl: string, knowledge: any[]) {
  if (imageUrl) {
    return null;
  }

  if (isOrderIntent(message) && hasOrderRef(message)) {
    return {
      action: "order_track",
      knowledge_id: null,
      reply: "تمام، هراجع حالة الطلب بالرقم اللي بعتّه.",
      confidence: 0.98,
    };
  }

  if (isCategoryIntent(message)) {
    return {
      action: "product_search",
      knowledge_id: null,
      reply: "تمام، هعرض لك المنتجات المطابقة للفئة من الموقع.",
      confidence: 0.95,
    };
  }

  const matched = exactKnowledgeMatch(message, knowledge);
  const mappedAction = actionFromKnowledge(matched);
  if (matched && mappedAction) {
    return {
      action: mappedAction,
      knowledge_id: Number(matched.id) || null,
      reply: mappedAction === "order_track"
        ? "تمام، ابعت رقم الطلب وأنا أراجع حالته."
        : mappedAction === "product_search"
          ? "تمام، هعرض لك المنتجات المناسبة من الموقع."
          : "تمام، محتاج منك تفصيلة بسيطة عشان أكمل.",
      confidence: 0.96,
    };
  }

  return null;
}

function validateDecision(data: any, message: string, imageUrl: string, knowledge: any[]) {
  const allowed = new Set(["answer", "chat", "clarify", "human", "product_search", "order_track", "image_search"]);
  if (!allowed.has(data?.action)) data.action = "chat";
  data.confidence = Math.max(0, Math.min(1, Number(data?.confidence || 0)));

  if (isOrderIntent(message) && hasOrderRef(message)) {
    data.action = "order_track";
    data.knowledge_id = null;
    data.reply = data.reply || "تمام، هراجع حالة الطلب بالرقم اللي بعتّه.";
    data.confidence = Math.max(data.confidence, 0.95);
  }

  if (imageUrl && data.action === "product_search") {
    data.action = "image_search";
  }

  if (isCategoryIntent(message) && data.action !== "image_search") {
    data.action = "product_search";
    data.knowledge_id = null;
    data.reply = data.reply || "تمام، هعرض لك المنتجات المطابقة للفئة من الموقع.";
    data.confidence = Math.max(data.confidence, 0.9);
  }

  if (data.action === "answer" && data.knowledge_id) {
    const found = knowledge.find((k) => Number(k.id) === Number(data.knowledge_id));
    if (!found) {
      data.action = "clarify";
      data.reply = "محتاج أتأكد من المعلومة دي، ممكن توضّح أكتر؟";
      data.knowledge_id = null;
      return data;
    }

    const mapped = actionFromKnowledge(found);
    if (mapped) {
      data.action = mapped;
      data.reply = data.reply || (mapped === "product_search" ? "تمام، هعرض لك المنتجات المناسبة من الموقع." : "تمام.");
    }
  }

  if (data.action === "answer" && data.confidence < 0.75) {
    data.action = "clarify";
    data.knowledge_id = null;
    data.reply = "ممكن توضّح قصدك أكتر؟";
  }

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) return json(req, { error: "Missing API key" }, 500);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  const { message = "", image_url = "", context = {}, conversation = [], knowledge = [] } = body;
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  let visionDescription = "";
  if (image_url) {
    try {
      const visionRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "صف هذا المنتج بالعربية باختصار: نوعه، لونه، شكله، وهل فيه كتابة أو نقش؟" },
            { type: "image_url", image_url: { url: image_url } },
          ],
        }],
        max_tokens: 200,
      });
      visionDescription = visionRes.choices[0]?.message?.content || "";
    } catch (e) {
      console.warn("Vision error:", e?.message || e);
    }
  }

  const guarded = guardedDecision(message, image_url, knowledge);
  if (guarded) return json(req, { ...guarded, image_description: visionDescription });

  const knowledgeLines = knowledge.slice(0, 20).map((k: any) => {
    const action = String(k.action_name || "").trim() || "NONE";
    const input = String(k.input_type || "").trim() || "answer";
    const keywords = Array.isArray(k.keywords) ? k.keywords.join(", ") : String(k.keywords || "");
    return [
      `id:${k.id}`,
      `س:${k.question || ""}`,
      `ج:${String(k.answer || "").slice(0, 120)}`,
      `تصنيف:${k.category || ""}`,
      `كلمات:${keywords}`,
      `نوع:${input}`,
      `إجراء:${action}`,
    ].join(" | ");
  }).join("\n");

  const systemPrompt = `أنت طبقة فهم فقط لمساعد متجر بريق.
مهمتك اختيار action صحيح فقط، وليس اختراع معلومات.

قواعد صارمة:
- لو الرسالة فيها رقم طلب واضح أو العميل يسأل عن حالة طلب برقم: action=order_track.
- لو العميل يطلب منتجات فئة/مناسبة/خامة مثل مواليد، تخرج، ورق، أكواب، فوركس، forex، foam: action=product_search.
- لو عنصر قاعدة المعرفة فيه action_name، لازم تنفذ الإجراء المرتبط ولا تحوله لإجابة نصية.
- لا تسأل عن الميزانية أو الكمية أو موعد التسليم في ترشيح الهدايا.
- لا تخلط السعر برقم الطلب. رقم الطلب غالبا يأتي مع # أو مع كلمة طلب/اوردر.
- لا تختر منتج من ذاكرتك. المنتجات يعرضها النظام بعد اختيار action.
- استخدم answer فقط عندما يكون هناك knowledge_id مطابق ومفيد وليس مربوطا بإجراء.

${visionDescription ? `وصف الصورة: "${visionDescription}"\n` : ""}

السياق:
- الشخص: ${context?.recipient || "غير محدد"}
- المناسبة: ${context?.occasion || "غير محددة"}
- الاهتمام: ${context?.interest || "غير محدد"}
- الستايل: ${context?.style || "غير محدد"}

آخر المحادثة:
${conversation.slice(-6).map((m: any) => `${m.role}: ${m.text}`).join("\n")}

قاعدة المعرفة المتاحة:
${knowledgeLines}

رد JSON صارم فقط:
{
  "action": "answer" | "chat" | "clarify" | "human" | "product_search" | "order_track" | "image_search",
  "knowledge_id": number | null,
  "reply": "رد قصير باللهجة المصرية",
  "confidence": 0.0,
  "image_description": "${visionDescription.replace(/"/g, '\\"')}"
}`;

  let data: any;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: String(message || "") + (visionDescription ? `\n[وصف الصورة: ${visionDescription}]` : "") },
      ],
      temperature: 0.1,
      max_tokens: 350,
      response_format: { type: "json_object" },
    });

    data = JSON.parse(completion.choices[0]?.message?.content || "{}");
  } catch (e) {
    console.warn("LLM error:", e?.message || e);
    data = { action: "chat", knowledge_id: null, reply: "ممكن تعيد السؤال بصيغة أوضح؟", confidence: 0 };
  }

  data = validateDecision(data, message, image_url, knowledge);
  data.image_description = visionDescription;
  return json(req, data);
});
