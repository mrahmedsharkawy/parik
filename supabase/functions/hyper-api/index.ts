// @ts-nocheck
// Supabase Edge Function: send-push
// يرسل Web Push Notification لجميع المشتركين
// Environment Variables needed in Supabase Dashboard:
//   VAPID_PRIVATE_KEY
//   VAPID_PUBLIC_KEY  = BPojY-23BXbIfa1IRkkQD3vAELjTn3nltgFBrlEIjZ3aEbphXAQvFY2E5B2R_mfikZLhGPo0lBeCedB8qoP5-SE
//   VAPID_EMAIL       = mailto:admin@bariq.store

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  return /(?:Ø|Ù|Ð|Ñ|Ã|Â|ƒ|ðŸ|â|œ|™|€|¢|£|¤|¥|¦|§|©|«|¬|®|¯|³|µ|¼|½|¾)/.test(String(value || ''));
}

const WINDOWS_1252_BYTES: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F,
};

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
    pending:       { icon: '⏳', title: '\u0637\u0644\u0628\u0643 \u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629',      body: `\u0637\u0644\u0628\u0643${orderAr} \u064a\u064f\u0631\u0627\u062c\u064e\u0639 \u0627\u0644\u0622\u0646` },
    processing:    { icon: '🔄', title: '\u0637\u0644\u0628\u0643 \u0642\u064a\u062f \u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629',      body: `\u062c\u0627\u0631\u064d \u062a\u062c\u0647\u064a\u0632 \u0637\u0644\u0628\u0643${orderAr}` },
    confirmed:     { icon: '✅', title: '\u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0637\u0644\u0628\u0643',           body: `\u0637\u0644\u0628\u0643${orderAr} \u062a\u0645 \u062a\u0623\u0643\u064a\u062f\u0647 \u0648\u0633\u064a\u064f\u062c\u0647\u0651\u0632 \u0642\u0631\u064a\u0628\u0627\u064b 🎉` },
    manufacturing: { icon: '🔨', title: '\u0637\u0644\u0628\u0643 \u0641\u064a \u0645\u0631\u062d\u0644\u0629 \u0627\u0644\u062a\u0635\u0646\u064a\u0639',  body: `\u0637\u0644\u0628\u0643${orderAr} \u064a\u064f\u0635\u0646\u0651\u0639 \u0627\u0644\u0622\u0646 \u0628\u0639\u0646\u0627\u064a\u0629 ✨` },
    ready:         { icon: '🎁', title: '\u0637\u0644\u0628\u0643 \u062c\u0627\u0647\u0632 \u0644\u0644\u0627\u0633\u062a\u0644\u0627\u0645',     body: `\u0637\u0644\u0628\u0643${orderAr} \u062c\u0627\u0647\u0632 \u0648\u0628\u0627\u0646\u062a\u0638\u0627\u0631\u0643 🎉` },
    shipped:       { icon: '🚚', title: '\u062a\u0645 \u0634\u062d\u0646 \u0637\u0644\u0628\u0643',            body: `\u0637\u0644\u0628\u0643${orderAr} \u0641\u064a \u0627\u0644\u0637\u0631\u064a\u0642 \u0625\u0644\u064a\u0643` },
    delivered:     { icon: '✅', title: '\u062a\u0645 \u062a\u0648\u0635\u064a\u0644 \u0637\u0644\u0628\u0643',          body: `\u0637\u0644\u0628\u0643${orderAr} \u0648\u0635\u0644 \u0628\u0646\u062c\u0627\u062d 🎉` },
    cancelled:     { icon: '❌', title: '\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u0637\u0644\u0628\u0643',          body: `\u0637\u0644\u0628\u0643${orderAr} \u062a\u0645 \u0625\u0644\u063a\u0627\u0624\u0647` },
    returned:      { icon: '↩️', title: '\u062a\u0645\u062a \u0639\u0645\u0644\u064a\u0629 \u0627\u0644\u0625\u0631\u062c\u0627\u0639',       body: `\u062a\u0645\u062a \u0645\u0639\u0627\u0644\u062c\u0629 \u0625\u0631\u062c\u0627\u0639 \u0637\u0644\u0628\u0643${orderAr}` },
  };
  const en: Record<string, { icon: string; title: string; body: string }> = {
    pending:       { icon: '⏳', title: 'Your order is under review',    body: `Your order${orderEn} is being reviewed` },
    processing:    { icon: '🔄', title: 'Your order is being processed', body: `We are preparing your order${orderEn}` },
    confirmed:     { icon: '✅', title: 'Your order is confirmed',       body: `Your order${orderEn} has been confirmed and will be prepared soon 🎉` },
    manufacturing: { icon: '🔨', title: 'Your order is in production',   body: `Your order${orderEn} is being carefully made ✨` },
    ready:         { icon: '🎁', title: 'Your order is ready',           body: `Your order${orderEn} is ready and waiting for you 🎉` },
    shipped:       { icon: '🚚', title: 'Your order has shipped',        body: `Your order${orderEn} is on its way to you` },
    delivered:     { icon: '✅', title: 'Your order was delivered',      body: `Your order${orderEn} was delivered successfully 🎉` },
    cancelled:     { icon: '❌', title: 'Your order was cancelled',      body: `Your order${orderEn} was cancelled` },
    returned:      { icon: '↩️', title: 'Return processed',              body: `The return for your order${orderEn} has been processed` },
  };
  const item = (lang === 'en' ? en : ar)[cleanStatus] || (lang === 'en' ? en.processing : ar.processing);
  return { lang, status: cleanStatus, icon: item.icon, title: `${item.icon} ${item.title}`, body: item.body };
}

function localizedAdminNewOrder(orderId: unknown, langValue: unknown) {
  const lang = normalizeLang(langValue);
  const cleanOrderId = String(orderId || '').replace(/^#/, '').trim();
  if (lang === 'en') {
    return {
      icon: '📦',
      title: '📦 New order from Bariq',
      body: cleanOrderId ? `New order #${cleanOrderId}\nTap to open the order` : 'New order received\nTap to open the order',
    };
  }
  return {
    icon: '📦',
    title: '📦 طلب جديد من بريق',
    body: cleanOrderId ? `طلب جديد #${cleanOrderId}\nاضغط لفتح الطلب` : 'وصل طلب جديد\nاضغط لفتح الطلب',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { title, body, title_en, body_en, url, image, user_phone, user_email, exclude_endpoint, type, status, iconText, emoji, orderId, order_id, lang, user_lang } = payload;
    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')  || 'BPojY-23BXbIfa1IRkkQD3vAELjTn3nltgFBrlEIjZ3aEbphXAQvFY2E5B2R_mfikZLhGPo0lBeCedB8qoP5-SE';
    const VAPID_EMAIL   = Deno.env.get('VAPID_EMAIL')       || 'mailto:admin@bariq.store';
    if (!VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: 'Missing VAPID_PRIVATE_KEY' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

    // جلب المشتركين من Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const publicNewOrder = isAllowedPublicNewOrder(payload);
    if (!publicNewOrder && !(await requireAdmin(req, supabase))) {
      return new Response(JSON.stringify({ error: 'Admin authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // إذا تم تمرير هوية عميل، نجمع الاشتراكات بالهاتف + الإيميل معاً لزيادة احتمال الوصول
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // إرسال لكل مشترك (مع استبعاد جهاز الأدمن لو أُرسل)
    const filteredSubs = exclude_endpoint
      ? subs.filter((s: any) => s.endpoint !== exclude_endpoint)
      : subs;

    if (!filteredSubs.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscribers after exclusion' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        const adminNewOrderText = type === 'admin_new_order' && (!repairedTitle || !repairedBody || hasMojibakeText(`${repairedTitle} ${repairedBody}`))
          ? localizedAdminNewOrder(orderId || order_id, targetLang)
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
          lang: targetLang
        });
        const payload = new TextEncoder().encode(payloadStr);
        return webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          payload,
          {
            // TTL طويل (24 ساعة) بدلاً من 60 ثانية — عشان لو الهاتف كان
            // غير متصل بالإنترنت أو في وضع توفير الطاقة لحظة الإرسال، تحتفظ
            // خوادم Apple/Google بالإشعار وتُعيد تسليمه بمجرد اتصال الجهاز،
            // بدلاً من حذفه فوراً بصمت بعد دقيقة واحدة.
            TTL: 86400,
            urgency: 'high'
          }
        ).catch(async (err) => {
          // حذف الاشتراكات المنتهية (410 Gone)
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
