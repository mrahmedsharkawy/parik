// @ts-nocheck
// Supabase Edge Function: abandoned-cart-reminder
// Run from a scheduled job every 5-10 minutes. It sends due abandoned cart push reminders.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!hasCronAccess(req)) {
      return new Response(JSON.stringify({ error: 'Scheduler authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || 'BPojY-23BXbIfa1IRkkQD3vAELjTn3nltgFBrlEIjZ3aEbphXAQvFY2E5B2R_mfikZLhGPo0lBeCedB8qoP5-SE';
    const VAPID_EMAIL = Deno.env.get('VAPID_EMAIL') || 'mailto:admin@bariq.store';
    if (!VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: 'Missing VAPID_PRIVATE_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

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
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, due: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    let failed = 0;
    let cleared = 0;

    for (const row of rows) {
      const { data: sub } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth, user_lang')
        .eq('endpoint', row.endpoint)
        .maybeSingle();

      if (!sub) {
        cleared++;
        await supabase.from('abandoned_carts').update({
          status: 'cleared',
          updated_at: new Date().toISOString(),
          last_error: 'push subscription not found',
        }).eq('id', row.id);
        continue;
      }

      const lang = normalizeLang(sub.user_lang || row.user_lang);
      const text = notificationText({ ...row, user_lang: lang });
      const payload = JSON.stringify({
        title: text.title,
        body: text.body,
        url: '/Cart',
        image: row.first_product_image || null,
        type: 'abandoned_cart',
        iconText: '🛒',
        emoji: '🛒',
        lang,
      });

      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, new TextEncoder().encode(payload), {
          TTL: 86400,
          urgency: 'high',
        });

        sent++;
        await supabase.from('abandoned_carts').update({
          status: 'notified',
          notified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: '',
        }).eq('id', row.id);
      } catch (err) {
        failed++;
        const statusCode = err?.statusCode || 0;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          await supabase.from('abandoned_carts').update({
            status: 'cleared',
            updated_at: new Date().toISOString(),
            last_error: `expired subscription ${statusCode}`,
          }).eq('id', row.id);
        } else {
          await supabase.from('abandoned_carts').update({
            send_attempts: Number(row.send_attempts || 0) + 1,
            updated_at: new Date().toISOString(),
            last_error: String(err?.message || err || 'send failed').slice(0, 400),
          }).eq('id', row.id);
        }
      }
    }

    return new Response(JSON.stringify({ sent, failed, cleared, due: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
