// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getSupabasePublishableKey, getSupabaseSecretKey } from "../_shared/supabase_keys.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://knleehjjejfeobcmpwnw.supabase.co";
const SERVICE_KEY = getSupabaseSecretKey();
const PUBLISHABLE_KEY = getSupabasePublishableKey();
const VERIFY_TOKEN = String(Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "");
const APP_SECRET = String(Deno.env.get("META_APP_SECRET") || "");
const ACCESS_TOKEN = String(Deno.env.get("META_WHATSAPP_ACCESS_TOKEN") || "");
const DEFAULT_PHONE_ID = String(Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID") || "");
const GRAPH_VERSION = String(Deno.env.get("META_GRAPH_VERSION") || "v26.0");

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

async function getConversation(sessionId: string, phone: string) {
  const query = new URLSearchParams({
    select: "id,state,current_topic,waiting_for,updated_at",
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
    body: JSON.stringify({ session_id: sessionId, phone, state: { channel: "whatsapp" } }),
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

async function askBot(text: string, conversation: any, recent: any[]) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/bot-llm`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${PUBLISHABLE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: text,
      conversation: recent,
      context: {
        ...(conversation.state || {}),
        current_topic: conversation.current_topic || "",
        waiting_for: conversation.waiting_for || "",
        channel: "whatsapp",
      },
      rpc: true,
    }),
  });
  if (!res.ok) throw new Error(`bot-llm failed: ${res.status}`);
  return await res.json();
}

async function sendWhatsApp(phoneId: string, to: string, text: string) {
  if (!ACCESS_TOKEN) throw new Error("META_WHATSAPP_ACCESS_TOKEN is missing");
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text } }),
  });
  if (!res.ok) throw new Error(`WhatsApp send failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function saveAssistant(conversationId: string, text: string, result: any, sendResult: any) {
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
      metadata: { channel: "whatsapp", meta_message_id: sendResult?.messages?.[0]?.id || null },
    }),
  });
}

async function processWebhook(payload: any) {
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const phoneId = String(value?.metadata?.phone_number_id || DEFAULT_PHONE_ID);
      for (const message of value?.messages || []) {
        if (message?.type !== "text" || !message?.text?.body || !message?.from || !phoneId) continue;
        const from = String(message.from);
        const text = String(message.text.body).trim().slice(0, 4000);
        const conversation = await getConversation(`whatsapp:${from}`, from);
        const inserted = await insertIncoming(conversation.id, String(message.id), text, { channel: "whatsapp", type: message.type, timestamp: message.timestamp });
        if (!inserted) continue;
        const result = await askBot(text, conversation, await recentMessages(conversation.id));
        const reply = String(result?.reply || "").trim();
        if (!reply || result?.silent || result?.action === "silent") continue;
        const sent = await sendWhatsApp(phoneId, from, reply.slice(0, 4096));
        await saveAssistant(conversation.id, reply, result, sent);
      }
    }
  }
}

serve(async (req) => {
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
