// Supabase Edge Function: send-push
// يرسل Web Push Notification لجميع المشتركين
// Environment Variables needed in Supabase Dashboard:
//   VAPID_PRIVATE_KEY = FNUfl55Aw5g1_Zlw1wQWUlbgRj2WbvWqrMqJaNTCJhg
//   VAPID_PUBLIC_KEY  = BPojY-23BXbIfa1IRkkQD3vAELjTn3nltgFBrlEIjZ3aEbphXAQvFY2E5B2R_mfikZLhGPo0lBeCedB8qoP5-SE
//   VAPID_EMAIL       = mailto:admin@bariq.store

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { title, body, url, image, user_phone, user_email, exclude_endpoint, type, status, iconText } = await req.json();
    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // إعداد VAPID - القيم الافتراضية مضمّنة كـ fallback
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || 'FNUfl55Aw5g1_Zlw1wQWUlbgRj2WbvWqrMqJaNTCJhg';
    const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')  || 'BPojY-23BXbIfa1IRkkQD3vAELjTn3nltgFBrlEIjZ3aEbphXAQvFY2E5B2R_mfikZLhGPo0lBeCedB8qoP5-SE';
    const VAPID_EMAIL   = Deno.env.get('VAPID_EMAIL')       || 'mailto:admin@bariq.store';

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

    // جلب المشتركين من Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // إذا تم تمرير هوية عميل، نجمع الاشتراكات بالهاتف + الإيميل معاً لزيادة احتمال الوصول
    const pickByIdentity = Boolean(user_phone || user_email);
    let subs: any[] = [];
    if (pickByIdentity) {
      const merged: any[] = [];
      if (user_phone) {
        const digits = user_phone.replace(/\D/g, '');
        const withPlus = '+' + digits;
        const { data: s1 } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_phone', user_phone);
        const { data: s2 } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_phone', withPlus);
        const { data: s3 } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_phone', digits);
        merged.push(...(s1 || []), ...(s2 || []), ...(s3 || []));
      }
      if (user_email) {
        const mail = String(user_email).trim().toLowerCase();
        const { data: se } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_email', mail);
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
      const { data, error } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth');
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

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      image: image || null,
      type: type || 'general',
      status: status || null,
      iconText: iconText || null
    });
    const results = await Promise.allSettled(
      filteredSubs.map((sub: any) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          payload,
          {
            TTL: 60,
            urgency: 'high'
          }
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
