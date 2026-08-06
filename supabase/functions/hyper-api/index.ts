// @ts-nocheck
// Supabase Edge Function: send-push
// ÙŠØ±Ø³Ù„ Web Push Notification Ù„Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ø´ØªØ±ÙƒÙŠÙ†
// Environment Variables needed in Supabase Dashboard:
//   VAPID_PRIVATE_KEY
//   VAPID_PUBLIC_KEY  = BPojY-23BXbIfa1IRkkQD3vAELjTn3nltgFBrlEIjZ3aEbphXAQvFY2E5B2R_mfikZLhGPo0lBeCedB8qoP5-SE
//   VAPID_EMAIL       = mailto:admin@bariq.store

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// Security improvement: restrict CORS to bariqgifts.com domains only
const ALLOWED_ORIGINS = [
  'https://bariqgifts.com',
  'https://www.bariqgifts.com',
  'https://admin.bariqgifts.com',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function bearerToken(req: Request) {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function requireAdmin(req: Request, supabase: any) {
  const token = bearerToken(req);
  if (!token) return false;
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return false;
  const byUserId = await supabase
    .from('admins')
    .select('id')
    .eq('active', true)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!byUserId.error && byUserId.data) return true;
  const byEmail = await supabase
    .from('admins')
    .select('id')
    .eq('active', true)
    .eq('email', user.email || '')
    .maybeSingle();
  return !byEmail.error && Boolean(byEmail.data);
}

function isAllowedPublicNewOrder(payload: any) {
  return payload?.type === 'admin_new_order'
    && payload?.user_email === '__bariq_admin_orders__@bariq.local'
    && !payload?.user_phone;
}

function normalizeLang(value: unknown) {
  return String(value || '').toLowerCase().startsWith('en') ? 'en' : 'ar';
}

function hasMojibakeText(value: unknown) {
  return /(?:\u00d8|\u00d9|\u00d0|\u00d1|\u00c3|\u00c2|\u00ca|\u00cb|\u0192|\u00f0\u0178|\u00e2|\u0153|\u2122|\u20ac|\u00a2|\u00a3|\u00a4|\u00a5|\u00a6|\u00a7|\u00a8|\u00a9|\u00aa|\u00ab|\u00ac|\u00ae|\u00af|\u00b3|\u00b5|\u00bc|\u00bd|\u00be)/.test(String(value || ''));
}

const WINDOWS_1252_BYTES: Record<string, number> = {};
[
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
  [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E],
  [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F]
].forEach(pair => { WINDOWS_1252_BYTES[String.fromCharCode(pair[0])] = pair[1]; });

function mojibakeBytes(text: string) {
  const bytes = new Uint8Array(text.length);
  for (let j = 0; j < text.length; j++) {
    const ch = text[j];
    bytes[j] = Object.prototype.hasOwnProperty.call(WINDOWS_1252_BYTES, ch) ? WINDOWS_1252_BYTES[ch] : (text.charCodeAt(j) & 255);
  }
  return bytes;
}

function repairMojibakeText(value: unknown) {
  let text = String(value || '');
  if (!text) return text;
  for (let i = 0; i < 4; i++) {
    if (!hasMojibakeText(text)) break;
    try {
      const bytes = mojibakeBytes(text);
      const fixed = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      if (!fixed || fixed === text) break;
      text = fixed;
    } catch (_err) {
      break;
    }
  }
  return text;
}

function localizedOrderStatus(status: unknown, orderId: unknown, langValue: unknown) {
  const lang = normalizeLang(langValue);
  const cleanStatus = String(status || 'processing').toLowerCase();
  const cleanOrderId = String(orderId || '').trim();
  const orderAr = cleanOrderId ? ` \u0631\u0642\u0645 ${cleanOrderId}` : '';
  const orderEn = cleanOrderId ? ` #${cleanOrderId.replace(/^#/, '')}` : '';
  const ar: Record<string, { icon: string; title: string; body: string }> = {
    pending:       { icon: 'â³', title: '\u0637\u0644\u0628\u0643 \u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629',      body: `\u0637\u0644\u0628\u0643${orderAr} \u064a\u064f\u0631\u0627\u062c\u064e\u0639 \u0627\u0644\u0622\u0646` },
    processing:    { icon: 'ðŸ”„', title: '\u0637\u0644\u0628\u0643 \u0642\u064a\u062f \u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629',      body: `\u062c\u0627\u0631\u064d \u062a\u062c\u0647\u064a\u0632 \u0637\u0644\u0628\u0643${orderAr}` },
    confirmed:     { icon: 'âœ…', title: '\u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0637\u0644\u0628\u0643',           body: `\u0637\u0644\u0628\u0643${orderAr} \u062a\u0645 \u062a\u0623\u0643\u064a\u062f\u0647 \u0648\u0633\u064a\u064f\u062c\u0647\u0651\u0632 \u0642\u0631\u064a\u0628\u0627\u064b ðŸŽ‰` },
    manufacturing: { icon: 'ðŸ”¨', title: '\u0637\u0644\u0628\u0643 \u0641\u064a \u0645\u0631\u062d\u0644\u0629 \u0627\u0644\u062a\u0635\u0646\u064a\u0639',  body: `\u0637\u0644\u0628\u0643${orderAr} \u064a\u064f\u0635\u0646\u0651\u0639 \u0627\u0644\u0622\u0646 \u0628\u0639\u0646\u0627\u064a\u0629 âœ¨` },
    ready:         { icon: 'ðŸŽ', title: '\u0637\u0644\u0628\u0643 \u062c\u0627\u0647\u0632 \u0644\u0644\u0627\u0633\u062a\u0644\u0627\u0645',     body: `\u0637\u0644\u0628\u0643${orderAr} \u062c\u0627\u0647\u0632 \u0648\u0628\u0627\u0646\u062a\u0638\u0627\u0631\u0643 ðŸŽ‰` },
    shipped:       { icon: 'ðŸšš', title: '\u062a\u0645 \u0634\u062d\u0646 \u0637\u0644\u0628\u0643',            body: `\u0637\u0644\u0628\u0643${orderAr} \u0641\u064a \u0627\u0644\u0637\u0631\u064a\u0642 \u0625\u0644\u064a\u0643` },
    delivered:     { icon: 'âœ…', title: '\u062a\u0645 \u062a\u0648\u0635\u064a\u0644 \u0637\u0644\u0628\u0643',          body: `\u0637\u0644\u0628\u0643${orderAr} \u0648\u0635\u0644 \u0628\u0646\u062c\u0627\u062d ðŸŽ‰` },
    cancelled:     { icon: 'âŒ', title: '\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u0637\u0644\u0628\u0643',          body: `\u0637\u0644\u0628\u0643${orderAr} \u062a\u0645 \u0625\u0644\u063a\u0627\u0624\u0647` },
    returned:      { icon: 'â†©ï¸', title: '\u062a\u0645\u062a \u0639\u0645\u0644\u064a\u0629 \u0627\u0644\u0625\u0631\u062c\u0627\u0639',       body: `\u062a\u0645\u062a \u0645\u0639\u0627\u0644\u062c\u0629 \u0625\u0631\u062c\u0627\u0639 \u0637\u0644\u0628\u0643${orderAr}` },
  };
  const en: Record<string, { icon: string; title: string; body: string }> = {
    pending:       { icon: 'â³', title: 'Your order is under review',    body: `Your order${orderEn} is being reviewed` },
    processing:    { icon: 'ðŸ”„', title: 'Your order is being processed', body: `We are preparing your order${orderEn}` },
    confirmed:     { icon: 'âœ…', title: 'Your order is confirmed',       body: `Your order${orderEn} has been confirmed and will be prepared soon ðŸŽ‰` },
    manufacturing: { icon: 'ðŸ”¨', title: 'Your order is in production',   body: `Your order${orderEn} is being carefully made âœ¨` },
    ready:         { icon: 'ðŸŽ', title: 'Your order is ready',           body: `Your order${orderEn} is ready and waiting for you ðŸŽ‰` },
    shipped:       { icon: 'ðŸšš', title: 'Your order has shipped',        body: `Your order${orderEn} is on its way to you` },
    delivered:     { icon: 'âœ…', title: 'Your order was delivered',      body: `Your order${orderEn} was delivered successfully ðŸŽ‰` },
    cancelled:     { icon: 'âŒ', title: 'Your order was cancelled',      body: `Your order${orderEn} was cancelled` },
    returned:      { icon: 'â†©ï¸', title: 'Return processed',              body: `The return for your order${orderEn} has been processed` },
  };
  const item = (lang === 'en' ? en : ar)[cleanStatus] || (lang === 'en' ? en.processing : ar.processing);
  return { lang, status: cleanStatus, icon: item.icon, title: `${item.icon} ${item.title}`, body: item.body };
}

function localizedAdminNewOrder(orderId: unknown, langValue: unknown, details: any = {}) {
  const lang = normalizeLang(langValue);
  const cleanOrderId = String(orderId || '').replace(/^#/, '').trim();
  const customer = repairMojibakeText(details.customerName || details.customer_name || details.customer || '').trim();
  const phone = repairMojibakeText(details.customerPhone || details.customer_phone || details.phone || '').trim();
  const product = repairMojibakeText(details.productName || details.product_name || details.product || '').trim();
  const total = repairMojibakeText(details.totalText || details.total_text || details.orderTotal || details.total || '').trim();
  const city = repairMojibakeText(details.city || details.customerCity || details.customer_city || '').trim();
  const payment = repairMojibakeText(details.payment || details.paymentMethod || details.payment_method || '').trim();
  const itemCount = Number(details.itemCount || details.item_count || 0) || 0;
  const enLines = [
    cleanOrderId ? `New order #${cleanOrderId}` : 'New order received',
    `Customer: ${customer || 'Not provided'} | Product: ${product || 'Product'} | Price: ${total || 'Not provided'}`,
    phone || city ? `Phone: ${phone || 'Not provided'}${city ? ` | City: ${city}` : ''}` : '',
    itemCount > 1 ? `Items: ${itemCount}` : '',
    payment ? `Payment: ${payment}` : '',
    'Tap to open the order'
  ].filter(Boolean);
  const arLines = [
    cleanOrderId ? `\u0637\u0644\u0628 \u062c\u062f\u064a\u062f #${cleanOrderId}` : '\u0648\u0635\u0644 \u0637\u0644\u0628 \u062c\u062f\u064a\u062f',
    `\u0627\u0644\u0639\u0645\u064a\u0644: ${customer || '\u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631'} | \u0627\u0644\u0645\u0646\u062a\u062c: ${product || '\u0645\u0646\u062a\u062c'} | \u0627\u0644\u0633\u0639\u0631: ${total || '\u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631'}`,
    phone || city ? `\u0627\u0644\u0647\u0627\u062a\u0641: ${phone || '\u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631'}${city ? ` | \u0627\u0644\u0645\u062f\u064a\u0646\u0629: ${city}` : ''}` : '',
    itemCount > 1 ? `\u0639\u062f\u062f \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a: ${itemCount}` : '',
    payment ? `\u0627\u0644\u062f\u0641\u0639: ${payment}` : '',
    '\u0627\u0636\u063a\u0637 \u0644\u0641\u062a\u062d \u0627\u0644\u0637\u0644\u0628'
  ].filter(Boolean);
  if (lang === 'en') {
    return {
      icon: 'ðŸ“¦',
      title: 'ðŸ“¦ New order from Bariq',
      body: enLines.join('\n'),
    };
  }
  return {
    icon: 'ðŸ“¦',
    title: 'ðŸ“¦ Ø·Ù„Ø¨ Ø¬Ø¯ÙŠØ¯ Ù…Ù† Ø¨Ø±ÙŠÙ‚',
    body: arLines.join('\n'),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });

  try {
    const payload = await req.json();
    const { title, body, title_en, body_en, url, image, user_phone, user_email, exclude_endpoint, type, status, iconText, emoji, orderId, order_id, lang, user_lang } = payload;
    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body required' }), {
        status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')  || 'BPojY-23BXbIfa1IRkkQD3vAELjTn3nltgFBrlEIjZ3aEbphXAQvFY2E5B2R_mfikZLhGPo0lBeCedB8qoP5-SE';
    const VAPID_EMAIL   = Deno.env.get('VAPID_EMAIL')       || 'mailto:admin@bariq.store';
    if (!VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: 'Missing VAPID_PRIVATE_KEY' }), {
        status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

    // Ø¬Ù„Ø¨ Ø§Ù„Ù…Ø´ØªØ±ÙƒÙŠÙ† Ù…Ù† Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const publicNewOrder = isAllowedPublicNewOrder(payload);
    if (!publicNewOrder && !(await requireAdmin(req, supabase))) {
      return new Response(JSON.stringify({ error: 'Admin authorization required' }), {
        status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    // Ø¥Ø°Ø§ ØªÙ… ØªÙ…Ø±ÙŠØ± Ù‡ÙˆÙŠØ© Ø¹Ù…ÙŠÙ„ØŒ Ù†Ø¬Ù…Ø¹ Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª Ø¨Ø§Ù„Ù‡Ø§ØªÙ + Ø§Ù„Ø¥ÙŠÙ…ÙŠÙ„ Ù…Ø¹Ø§Ù‹ Ù„Ø²ÙŠØ§Ø¯Ø© Ø§Ø­ØªÙ…Ø§Ù„ Ø§Ù„ÙˆØµÙˆÙ„
    const pickByIdentity = Boolean(user_phone || user_email);
    let subs: any[] = [];
    if (pickByIdentity) {
      const merged: any[] = [];
      if (user_phone) {
        const digits = user_phone.replace(/\D/g, '');
        const withPlus = '+' + digits;
        const { data: s1 } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_lang').eq('user_phone', user_phone);
        const { data: s2 } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_lang').eq('user_phone', withPlus);
        const { data: s3 } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_lang').eq('user_phone', digits);
        merged.push(...(s1 || []), ...(s2 || []), ...(s3 || []));
      }
      if (user_email) {
        const mail = String(user_email).trim().toLowerCase();
        const { data: se } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_lang').eq('user_email', mail);
        merged.push(...(se || []));
      }
      const seen = new Set<string>();
      subs = merged.filter((s) => {
        if (!s?.endpoint) return false;
        if (seen.has(s.endpoint)) return false;
        seen.add(s.endpoint);
        return true;
      });
    } else {
      const { data, error } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_lang');
      if (error) throw error;
      subs = data || [];
    }
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: pickByIdentity ? 'No subscribers for this customer' : 'No subscribers' }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    // Ø¥Ø±Ø³Ø§Ù„ Ù„ÙƒÙ„ Ù…Ø´ØªØ±Ùƒ (Ù…Ø¹ Ø§Ø³ØªØ¨Ø¹Ø§Ø¯ Ø¬Ù‡Ø§Ø² Ø§Ù„Ø£Ø¯Ù…Ù† Ù„Ùˆ Ø£ÙØ±Ø³Ù„)
    const filteredSubs = exclude_endpoint
      ? subs.filter((s: any) => s.endpoint !== exclude_endpoint)
      : subs;

    if (!filteredSubs.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscribers after exclusion' }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    const results = await Promise.allSettled(
      filteredSubs.map((sub: any) => {
        const targetLang = normalizeLang(sub.user_lang || user_lang || lang);
        const statusFromType = String(type || '').match(/^order_status_([a-z_]+)$/i)?.[1] || '';
        const orderStatusText = type === 'order_status' || status || statusFromType
          ? localizedOrderStatus(status || statusFromType, orderId || order_id, targetLang)
          : null;
        const sourceTitle = targetLang === 'en' && title_en ? title_en : title;
        const sourceBody = targetLang === 'en' && body_en ? body_en : body;
        const repairedTitle = repairMojibakeText(sourceTitle);
        const repairedBody = repairMojibakeText(sourceBody);
        const adminNewOrderText = type === 'admin_new_order'
          ? localizedAdminNewOrder(orderId || order_id, targetLang, payload)
          : null;
        const localizedTitle = adminNewOrderText ? adminNewOrderText.title : (orderStatusText ? orderStatusText.title : repairedTitle);
        const localizedBody = adminNewOrderText ? adminNewOrderText.body : (orderStatusText ? orderStatusText.body : repairedBody);
        const localizedIcon = adminNewOrderText ? adminNewOrderText.icon : (orderStatusText ? orderStatusText.icon : (iconText || emoji || null));
        const payloadStr = JSON.stringify({
          title: localizedTitle,
          body: localizedBody,
          url: url || '/',
          image: image || null,
          type: type || 'general',
          status: orderStatusText ? orderStatusText.status : status || null,
          iconText: localizedIcon,
          emoji: localizedIcon,
          orderId: orderId || order_id || null,
          order_id: order_id || orderId || null,
          customerName: payload.customerName || payload.customer_name || payload.customer || null,
          customerPhone: payload.customerPhone || payload.customer_phone || payload.phone || null,
          productName: payload.productName || payload.product_name || payload.product || null,
          totalText: payload.totalText || payload.total_text || payload.orderTotal || payload.total || null,
          itemCount: payload.itemCount || payload.item_count || null,
          city: payload.city || payload.customerCity || payload.customer_city || null,
          payment: payload.payment || payload.paymentMethod || payload.payment_method || null,
          lang: targetLang
        });
        const encodedPayload = new TextEncoder().encode(payloadStr);
        return webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          encodedPayload,
          {
            // TTL Ø·ÙˆÙŠÙ„ (24 Ø³Ø§Ø¹Ø©) Ø¨Ø¯Ù„Ø§Ù‹ Ù…Ù† 60 Ø«Ø§Ù†ÙŠØ© â€” Ø¹Ø´Ø§Ù† Ù„Ùˆ Ø§Ù„Ù‡Ø§ØªÙ ÙƒØ§Ù†
            // ØºÙŠØ± Ù…ØªØµÙ„ Ø¨Ø§Ù„Ø¥Ù†ØªØ±Ù†Øª Ø£Ùˆ ÙÙŠ ÙˆØ¶Ø¹ ØªÙˆÙÙŠØ± Ø§Ù„Ø·Ø§Ù‚Ø© Ù„Ø­Ø¸Ø© Ø§Ù„Ø¥Ø±Ø³Ø§Ù„ØŒ ØªØ­ØªÙØ¸
            // Ø®ÙˆØ§Ø¯Ù… Apple/Google Ø¨Ø§Ù„Ø¥Ø´Ø¹Ø§Ø± ÙˆØªÙØ¹ÙŠØ¯ ØªØ³Ù„ÙŠÙ…Ù‡ Ø¨Ù…Ø¬Ø±Ø¯ Ø§ØªØµØ§Ù„ Ø§Ù„Ø¬Ù‡Ø§Ø²ØŒ
            // Ø¨Ø¯Ù„Ø§Ù‹ Ù…Ù† Ø­Ø°ÙÙ‡ ÙÙˆØ±Ø§Ù‹ Ø¨ØµÙ…Øª Ø¨Ø¹Ø¯ Ø¯Ù‚ÙŠÙ‚Ø© ÙˆØ§Ø­Ø¯Ø©.
            TTL: 86400,
            urgency: 'high'
          }
        ).catch(async (err) => {
          // Ø­Ø°Ù Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª Ø§Ù„Ù…Ù†ØªÙ‡ÙŠØ© (410 Gone)
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
          throw err;
        })
      })
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(JSON.stringify({ sent, failed, total: subs.length }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    });
  }
});
