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
        current_state: {
          ...(conversation.state || {}),
          currentTopic: conversation.current_topic || conversation.state?.currentTopic || "",
          current_topic: conversation.current_topic || conversation.state?.current_topic || "",
          waitingFor: conversation.waiting_for || conversation.state?.waitingFor || null,
          waiting_for: conversation.waiting_for || conversation.state?.waiting_for || null,
        },
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
  const normalizedText = normalizeArabic(text);
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

function channelReply(result: any) {
  const base = String(result?.reply || "").trim();
  const products = Array.isArray(result?.products) ? result.products.slice(0, 4) : [];
  if (!products.length) return base;
  const lines = products.map((product: any, index: number) => {
    const name = String(product?.name_ar || product?.name || product?.name_en || `منتج ${index + 1}`).trim();
    const amount = Number(product?.price);
    const price = Number.isFinite(amount) && amount > 0 ? ` — ${amount.toFixed(2)} AED` : "";
    const id = product?.id || product?.supabaseId;
    const link = String(product?.link || (id ? `https://bariqgifts.com/product.html?id=${encodeURIComponent(id)}` : "")).trim();
    return `${index + 1}. ${name}${price}${link ? `\n${link}` : ""}`;
  });
  return [base, lines.join("\n\n")].filter(Boolean).join("\n\n");
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
          reply = channelReply(canonical.result);
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
