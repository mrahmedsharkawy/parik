// @ts-nocheck
// Supabase Edge Function: abandoned-cart-reminder
// Scheduled job. Push delivery is centralized through hyper-api.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://bariqgifts.com',
  'https://www.bariqgifts.com',
  'https://admin.bariqgifts.com',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Vary': 'Origin',
  };
}

function hasCronAccess(req: Request) {
  const secret = Deno.env.get('ABANDONED_CART_CRON_SECRET') || '';
  if (!secret) return false;
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return bearer === secret || req.headers.get('x-cron-secret') === secret;
}

function normalizeLang(value: unknown) {
  return String(value || '').toLowerCase().startsWith('en') ? 'en' : 'ar';
}

function notificationText(row: any) {
  const lang = normalizeLang(row.user_lang);
  const count = Math.max(1, Number(row.cart_count) || 1);
  const name = String(row.first_product_name || '').trim();
  if (lang === 'en') {
    return {
      title: 'Your cart is waiting',
      body: name ? `${name} is still in your cart. Complete your order before it runs out.` : `${count} item${count === 1 ? '' : 's'} are still in your cart. Complete your order now.`,
    };
  }
  return {
    title: 'سلتك لسه مستنياك',
    body: name ? `${name} ما زال في سلتك. أكمل الطلب قبل نفاد الكمية.` : `لديك ${count} منتج في السلة. أكمل الطلب الآن قبل نفاد الكمية.`,
  };
}

async function sendViaPushCore(serviceRole: string, payload: any) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/hyper-api`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRole,
      'Authorization': `Bearer ${serviceRole}`,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(async () => ({ error: await response.text().catch(() => '') }));
  if (!response.ok) throw new Error(result?.error || `hyper-api ${response.status}`);
  return result || {};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });
  try {
    if (!hasCronAccess(req)) {
      return new Response(JSON.stringify({ error: 'Scheduler authorization required' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const serviceRole = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    if (!serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRole);

    const now = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from('abandoned_carts')
      .select('id, endpoint, user_lang, cart_count, first_product_name, first_product_image, send_attempts')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .lt('send_attempts', 3)
      .order('scheduled_at', { ascending: true })
      .limit(100);
    if (error) throw error;
    if (!rows?.length) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, cleared: 0, due: 0 }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    let sent = 0, failed = 0, cleared = 0;
    for (const row of rows) {
      const endpoint = String(row.endpoint || '').trim();
      if (!endpoint) {
        cleared++;
        await supabase.from('abandoned_carts').update({ status: 'cleared', updated_at: new Date().toISOString(), last_error: 'missing endpoint' }).eq('id', row.id);
        continue;
      }
      const text = notificationText(row);
      try {
        const result = await sendViaPushCore(serviceRole, {
          title: text.title,
          body: text.body,
          url: '/Cart',
          image: row.first_product_image || null,
          type: 'abandoned_cart',
          iconText: '🛒',
          emoji: '🛒',
          lang: normalizeLang(row.user_lang),
          target_endpoint: endpoint,
        });
        if (Number(result.sent || 0) > 0) {
          sent++;
          await supabase.from('abandoned_carts').update({ status: 'notified', notified_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: '' }).eq('id', row.id);
        } else {
          failed++;
          const msg = result?.message || result?.error || JSON.stringify(result?.failures || []) || 'send failed';
          await supabase.from('abandoned_carts').update({ send_attempts: Number(row.send_attempts || 0) + 1, updated_at: new Date().toISOString(), last_error: String(msg).slice(0, 400) }).eq('id', row.id);
        }
      } catch (err) {
        failed++;
        await supabase.from('abandoned_carts').update({ send_attempts: Number(row.send_attempts || 0) + 1, updated_at: new Date().toISOString(), last_error: String(err?.message || err || 'send failed').slice(0, 400) }).eq('id', row.id);
      }
    }

    return new Response(JSON.stringify({ sent, failed, cleared, due: rows.length }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
