// Supabase Edge Function: send-push
// يرسل Web Push Notification لجميع المشتركين
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });

  try {
    // جلب المشتركين من Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (!(await requireAdmin(req, supabase))) {
      return new Response(JSON.stringify({ error: 'Admin authorization required' }), {
        status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    const { title, body, url, image } = await req.json();
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

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscribers' }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }

    // إرسال لكل مشترك
    const payload = JSON.stringify({ title, body, url: url || '/', image: image || null });
    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          payload
        ).catch(async (err) => {
          // حذف الاشتراكات المنتهية (410 Gone)
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
          throw err;
        })
      )
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
