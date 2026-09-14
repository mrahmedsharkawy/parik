import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalEnginePayload, channelDecision } from "../supabase/functions/_shared/channel_adapter.ts";

const cases = [
  ["السلام عليكم", "answer", 101, { topic: "greeting" }, "وعليكم السلام"],
  ["انتو مين", "answer", 18879, { topic: "intro" }, "بريق للهدايا"],
  ["بتعملوا ايه", "answer", 18879, { topic: "intro" }, "بريق للهدايا"],
  ["عندكم هدايا تخرج", "product_search", 201, { occasion: "graduation" }, "هدايا تخرج"],
  ["عندكم هدايا مواليد", "product_search", 202, { occasion: "newborn" }, "هدايا مواليد"],
  ["عايز هدية", "clarify", null, { waiting_for: "gift_occasion" }, "إيه المناسبة؟"],
  ["لأختي", "clarify", null, { recipient: "sister", waiting_for: "gift_occasion" }, "إيه المناسبة؟"],
  ["تخرج", "product_search", 201, { recipient: "sister", occasion: "graduation" }, "اختيارات التخرج"],
  ["كم سعر كوب الشاي", "product_price", 301, { product: "tea_cup" }, "سعر كوب الشاي"],
  ["سعره كام", "product_price", 301, { product: "tea_cup" }, "سعر كوب الشاي"],
  ["20 حبة بكام", "quantity_price", 301, { product: "tea_cup", quantity: 20 }, "الإجمالي"],
  ["وريني أكواب", "product_search", 302, { category: "cups" }, "الأكواب"],
  ["هدايا تحت 100", "product_search", 303, { budget: 100 }, "تحت 100"],
  ["ثبت الطلب", "checkout_contact", null, { waiting_for: "checkout_contact" }, "الاسم والعنوان"],
  ["أحمد - دبي", "draft_order", null, { waiting_for: "" }, "تم تجهيز طلبك"],
  ["عايز أتابع طلبي", "order_track", 401, { waiting_for: "order_number" }, "رقم الطلب"],
  ["1151", "order_track", 401, { order_number: "1151" }, "حالة طلبك"],
  ["عايز ألغي الطلب 1151", "update_order", 402, { order_number: "1151" }, "إلغاء الطلب"],
  ["عايز أكلم موظف", "human", 403, { topic: "human" }, ""],
  ["سؤال غير موجود نهائيًا", "silent", null, { topic: "general" }, ""],
];

test("channel adapter preserves an already-made engine decision", () => {
  assert.equal(cases.length, 20);
  for (const [message, action, knowledge_id, entities, reply] of cases) {
    const engineResult = { action, knowledge_id, entities, reply };
    const adapted = channelDecision(engineResult);
    assert.deepEqual(adapted.result, engineResult, message);
    assert.equal(adapted.reply, reply.trim(), message);
    assert.deepEqual(
      canonicalEnginePayload(message, [], entities),
      { message, image_url: "", conversation: [], context: entities, rpc: true },
      message,
    );
  }
});

test("meta-webhook processing has no independent decision fallback", () => {
  const source = readFileSync(new URL("../supabase/functions/meta-webhook/index.ts", import.meta.url), "utf8");
  const processing = source.slice(source.indexOf("async function processWebhook"));
  for (const forbidden of ["knowledgeFallback(", "recommendProducts(", "matchPricedProduct(", "multiItemQuote(", "orderReply("]) {
    assert.equal(processing.includes(forbidden), false, forbidden);
  }
  assert.match(processing, /askBot\(text, conversation, recent, imageUrl, channel\)/);
  assert.doesNotMatch(source, /function (knowledgeFallback|recommendProducts|matchPricedProduct|multiItemQuote|orderReply)\s*\(/);
  assert.match(processing, /await saveUnanswered\(text, conversation\.id/);
  assert.match(processing, /await saveConversationState\(conversation, result/);
});

test("canonical endpoint reloads the shared live knowledge and catalog", () => {
  const source = readFileSync(new URL("../supabase/functions/bot-llm/index.ts", import.meta.url), "utf8");
  assert.match(source, /await catalog\(\)/);
  assert.match(source, /all\("bot_knowledge",KNOWLEDGE/);
  assert.match(source, /createTrainingEngine\(\{\.\.\.data/);
  assert.doesNotMatch(source, /new OpenAI|OPENAI_API_KEY|knowledgeFallback/);
});
