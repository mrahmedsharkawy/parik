// @ts-nocheck
// Bariq central Web Push core.
// IMPORTANT: VAPID secrets are read ONLY from Supabase Edge Function Secrets.
// Required: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_EMAIL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const ALLOWED_ORIGINS = [
  'https://bariqgifts.com',
  'https://www.bariqgifts.com',
  'https://admin.bariqgifts.com',
];

function cors(req) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function requestOriginIsTrusted(req) {
  const origin = req.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  const ref = req.headers.get('referer') || '';
  return ALLOWED_ORIGINS.some(x => ref.startsWith(x + '/'));
}

function bearer(req) {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function cleanSecret(name) {
  return String(Deno.env.get(name) || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '');
}

function validateVapid(name, value) {
  if (!value) return `Missing ${name}`;
  if (value.includes('=')) return `${name} must be URL-safe Base64 without "=" padding`;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return `${name} contains invalid Base64URL characters`;
  if (name === 'VAPID_PUBLIC_KEY' && value.length < 80) return `${name} looks too short`;
  if (name === 'VAPID_PRIVATE_KEY' && value.length < 40) return `${name} looks too short`;
  return '';
}

function normalizeLang(value) {
  return String(value || '').toLowerCase().startsWith('en') ? 'en' : 'ar';
}

function phoneVariants(value) {
  const raw = String(value || '').trim();
  let digits = raw.replace(/\D/g, '');
  const out = new Set();
  if (raw) out.add(raw);
  if (digits) { out.add(digits); out.add('+' + digits); }
  if (digits.startsWith('00971')) digits = digits.slice(2);
  if (digits.startsWith('971')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits) {
    out.add(digits);
    out.add('0' + digits);
    out.add('971' + digits);
    out.add('+971' + digits);
    out.add('00971' + digits);
  }
  return [...out].filter(Boolean);
}

async function isAdmin(req, supabase) {
  const token = bearer(req);
  if (!token) return false;
  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return false;

  const byUser = await supabase.from('admins').select('id')
    .eq('active', true).eq('user_id', user.id).maybeSingle();
  if (!byUser.error && byUser.data) return true;

  const byEmail = await supabase.from('admins').select('id')
    .eq('active', true).eq('email', user.email || '').maybeSingle();
  return !byEmail.error && Boolean(byEmail.data);
}

function internalServiceRole(req) {
  const service = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  return Boolean(service && bearer(req) === service);
}

function allowedPublicAdminOrder(payload, req) {
  return payload?.type === 'admin_new_order'
    && payload?.user_email === '__bariq_admin_orders__@bariq.local'
    && requestOriginIsTrusted(req);
}

function orderStatusMessage(statusValue, orderIdValue, langValue) {
  const lang = normalizeLang(langValue);
  const status = String(statusValue || 'processing').toLowerCase();
  const id = String(orderIdValue || '').replace(/^#/, '').trim();
  const arId = id ? ` رقم ${id}` : '';
  const enId = id ? ` #${id}` : '';

  const ar = {
    pending: ['⏳','طلبك قيد المراجعة',`طلبك${arId} يُراجع الآن`],
    processing: ['🔄','طلبك قيد المعالجة',`جارٍ تجهيز طلبك${arId}`],
    confirmed: ['✅','تم تأكيد طلبك',`طلبك${arId} تم تأكيده وسيُجهّز قريباً 🎉`],
    manufacturing: ['🔨','طلبك في مرحلة التصنيع',`طلبك${arId} يُصنّع الآن بعناية ✨`],
    ready: ['🎁','طلبك جاهز للاستلام',`طلبك${arId} جاهز وبانتظارك 🎉`],
    shipped: ['🚚','تم شحن طلبك',`طلبك${arId} في الطريق إليك`],
    delivered: ['✅','تم توصيل طلبك',`طلبك${arId} وصل بنجاح 🎉`],
    cancelled: ['❌','تم إلغاء طلبك',`طلبك${arId} تم إلغاؤه`],
    returned: ['↩️','تمت عملية الإرجاع',`تمت معالجة إرجاع طلبك${arId}`],
  };
  const en = {
    pending: ['⏳','Your order is under review',`Your order${enId} is being reviewed`],
    processing: ['🔄','Your order is being processed',`We are preparing your order${enId}`],
    confirmed: ['✅','Your order is confirmed',`Your order${enId} has been confirmed 🎉`],
    manufacturing: ['🔨','Your order is in production',`Your order${enId} is being carefully made ✨`],
    ready: ['🎁','Your order is ready',`Your order${enId} is ready 🎉`],
    shipped: ['🚚','Your order has shipped',`Your order${enId} is on its way`],
    delivered: ['✅','Your order was delivered',`Your order${enId} was delivered successfully 🎉`],
    cancelled: ['❌','Your order was cancelled',`Your order${enId} was cancelled`],
    returned: ['↩️','Return processed',`The return for your order${enId} has been processed`],
  };

  const item = (lang === 'en' ? en : ar)[status] || (lang === 'en' ? en.processing : ar.processing);
  return { lang, status, icon: item[0], title: `${item[0]} ${item[1]}`, body: item[2] };
}

function adminNewOrderMessage(payload, langValue) {
  const lang = normalizeLang(langValue);
  const id = String(payload.orderId || payload.order_id || '').replace(/^#/, '').trim();
  const customer = String(payload.customerName || payload.customer_name || payload.customer || '').trim();
  const product = String(payload.productName || payload.product_name || payload.product || '').trim();
  const total = String(payload.totalText || payload.total_text || payload.orderTotal || payload.total || '').trim();

  if (lang === 'en') {
    return {
      icon: '📦',
      title: '📦 New order from Bariq',
      body: [
        id ? `New order #${id}` : 'New order received',
        customer ? `Customer: ${customer}` : '',
        product ? `Product: ${product}` : '',
        total ? `Price: ${total}` : '',
        'Tap to open the order',
      ].filter(Boolean).join('\n')
    };
  }
  return {
    icon: '📦',
    title: '📦 طلب جديد من بريق',
    body: [
      id ? `طلب جديد #${id}` : 'وصل طلب جديد',
      customer ? `العميل: ${customer}` : '',
      product ? `المنتج: ${product}` : '',
      total ? `السعر: ${total}` : '',
      'اضغط لفتح الطلب',
    ].filter(Boolean).join('\n')
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { ...cors(req), 'Content-Type': 'application/json' }
  });

  try {
    const VAPID_PRIVATE = cleanSecret('VAPID_PRIVATE_KEY');
    const VAPID_PUBLIC = cleanSecret('VAPID_PUBLIC_KEY');
    const VAPID_EMAIL = String(Deno.env.get('VAPID_EMAIL') || 'mailto:bariq.gifts@gmail.com').trim();

    const vapidError = validateVapid('VAPID_PRIVATE_KEY', VAPID_PRIVATE)
      || validateVapid('VAPID_PUBLIC_KEY', VAPID_PUBLIC);
    if (vapidError) {
      return new Response(JSON.stringify({ error: vapidError }), {
        status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' }
      });
    }

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

    const serviceRole = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRole);

    const payload = await req.json();
    const {
      title, body, title_en, body_en, url, image,
      user_phone, user_email, target_endpoint, target_endpoints,
      exclude_endpoint, type, status, iconText, emoji,
      orderId, order_id, lang, user_lang
    } = payload;

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body required' }), {
        status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' }
      });
    }

    const permitted = internalServiceRole(req)
      || allowedPublicAdminOrder(payload, req)
      || await isAdmin(req, supabase);

    if (!permitted) {
      return new Response(JSON.stringify({ error: 'Admin authorization required' }), {
        status: 401, headers: { ...cors(req), 'Content-Type': 'application/json' }
      });
    }

    const baseSelect = 'endpoint,p256dh,auth,user_lang,vapid_public_key';
    const directEndpoints = [...new Set([
      ...(Array.isArray(target_endpoints) ? target_endpoints : []),
      ...(target_endpoint ? [target_endpoint] : [])
    ].map(x => String(x || '').trim()).filter(Boolean))];

    const pickByIdentity = Boolean(user_phone || user_email);
    let subs = [];

    if (directEndpoints.length) {
      const { data, error } = await supabase.from('push_subscriptions')
        .select(baseSelect)
        .in('endpoint', directEndpoints)
        .eq('vapid_public_key', VAPID_PUBLIC);
      if (error) throw error;
      subs = data || [];
    } else if (pickByIdentity) {
      const merged = [];
      for (const variant of phoneVariants(user_phone)) {
        const { data } = await supabase.from('push_subscriptions')
          .select(baseSelect)
          .eq('user_phone', variant)
          .eq('vapid_public_key', VAPID_PUBLIC);
        merged.push(...(data || []));
      }
      if (user_email) {
        const email = String(user_email).trim().toLowerCase();
        const { data } = await supabase.from('push_subscriptions')
          .select(baseSelect)
          .ilike('user_email', email)
          .eq('vapid_public_key', VAPID_PUBLIC);
        merged.push(...(data || []));
      }
      const seen = new Set();
      subs = merged.filter(sub => {
        const endpoint = String(sub?.endpoint || '');
        if (!endpoint || seen.has(endpoint) || !sub?.p256dh || !sub?.auth) return false;
        seen.add(endpoint);
        return true;
      });
    } else {
      const { data, error } = await supabase.from('push_subscriptions')
        .select(baseSelect)
        .eq('vapid_public_key', VAPID_PUBLIC);
      if (error) throw error;
      subs = (data || []).filter(sub => sub?.endpoint && sub?.p256dh && sub?.auth);
    }

    if (exclude_endpoint) subs = subs.filter(sub => sub.endpoint !== exclude_endpoint);

    if (!subs.length) {
      return new Response(JSON.stringify({
        sent: 0,
        failed: 0,
        total: 0,
        ok: false,
        needs_resubscribe: true,
        message: pickByIdentity
          ? 'No current-VAPID subscription for this customer'
          : 'No current-VAPID subscribers'
      }), { headers: { ...cors(req), 'Content-Type': 'application/json' } });
    }

    const results = await Promise.allSettled(subs.map(async sub => {
      const targetLang = normalizeLang(sub.user_lang || user_lang || lang);
      const statusFromType = String(type || '').match(/^order_status_([a-z_]+)$/i)?.[1] || '';

      const statusText = (type === 'order_status' || status || statusFromType)
        ? orderStatusMessage(status || statusFromType, orderId || order_id, targetLang)
        : null;
      const adminText = type === 'admin_new_order'
        ? adminNewOrderMessage(payload, targetLang)
        : null;

      const localizedTitle = adminText?.title
        || statusText?.title
        || (targetLang === 'en' && title_en ? title_en : title);
      const localizedBody = adminText?.body
        || statusText?.body
        || (targetLang === 'en' && body_en ? body_en : body);
      const localizedIcon = adminText?.icon || statusText?.icon || iconText || emoji || null;

      const pushPayload = JSON.stringify({
        title: localizedTitle,
        body: localizedBody,
        url: url || '/',
        image: image || null,
        type: type || 'general',
        status: statusText?.status || status || null,
        iconText: localizedIcon,
        emoji: localizedIcon,
        orderId: orderId || order_id || null,
        order_id: order_id || orderId || null,
        lang: targetLang
      });

      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, pushPayload, { TTL: 86400, urgency: 'high' });
        return { ok: true };
      } catch (err) {
        const statusCode = err?.statusCode || err?.status || null;
        const errBody = typeof err?.body === 'string' ? err.body : '';

        // Dead endpoints and any VAPID mismatch row marked as current are removed,
        // so one broken row cannot poison future broadcasts.
        if (
          statusCode === 404 || statusCode === 410 ||
          /VapidPkHashMismatch|VAPID credentials/i.test(errBody)
        ) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }

        console.error('WEB_PUSH_DELIVERY_FAILED', {
          statusCode,
          name: err?.name || 'WebPushError',
          message: err?.message || 'Web Push delivery failed',
          body: errBody || null,
          endpointHost: (() => { try { return new URL(String(sub.endpoint)).host; } catch (_) { return ''; } })()
        });

        throw err;
      }
    }));

    const sent = results.filter(x => x.status === 'fulfilled').length;
    const failed = results.length - sent;
    const failures = results.map((result, index) => {
      if (result.status !== 'rejected') return null;
      const err = result.reason || {};
      return {
        index,
        statusCode: Number(err.statusCode || err.status || 0) || null,
        name: String(err.name || 'WebPushError'),
        message: String(err.message || 'Web Push delivery failed'),
        body: typeof err.body === 'string' ? err.body : null,
      };
    }).filter(Boolean);

    return new Response(JSON.stringify({
      sent,
      failed,
      total: subs.length,
      ok: failed === 0 && sent > 0,
      ...(failures.length ? { failures, error: 'One or more Web Push deliveries failed' } : {})
    }), { headers: { ...cors(req), 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('HYPER_API_FATAL', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' }
    });
  }
});
