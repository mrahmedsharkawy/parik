// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://bariqgifts.com',
  'https://www.bariqgifts.com',
  'https://admin.bariqgifts.com'
];

function cors(req) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function normalizeUaePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00971')) digits = digits.slice(2);
  if (digits.startsWith('971')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.slice(0, 9);
  return digits ? '+971' + digits : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  try {
    const body = await req.json();
    const endpoint = String(body.endpoint || '').trim();
    const p256dh = String(body.p256dh || '').trim();
    const auth = String(body.auth || '').trim();
    const vapid_public_key = String(body.vapid_public_key || '').trim();

    if (!endpoint || !p256dh || !auth || !vapid_public_key) {
      return new Response(JSON.stringify({error:'Missing subscription fields'}), {
        status:400, headers:{...cors(req),'Content-Type':'application/json'}
      });
    }

    const expected = String(Deno.env.get('VAPID_PUBLIC_KEY') || '').trim();
    if (!expected || expected !== vapid_public_key) {
      return new Response(JSON.stringify({error:'VAPID_PUBLIC_KEY_MISMATCH'}), {
        status:409, headers:{...cors(req),'Content-Type':'application/json'}
      });
    }

    const serviceRole = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    const supabaseUrl = String(Deno.env.get('SUPABASE_URL') || '').trim();
    const supabase = createClient(supabaseUrl, serviceRole);

    const row = {
      endpoint,
      p256dh,
      auth,
      user_phone: normalizeUaePhone(body.user_phone),
      user_email: String(body.user_email || '').trim().toLowerCase(),
      user_lang: String(body.user_lang || '').toLowerCase().startsWith('en') ? 'en' : 'ar',
      vapid_public_key,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const {data,error} = await supabase
      .from('push_subscriptions')
      .upsert(row,{onConflict:'endpoint'})
      .select('id,vapid_public_key,last_seen_at')
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ok:true,saved:true,data}), {
      headers:{...cors(req),'Content-Type':'application/json'}
    });
  } catch (err) {
    return new Response(JSON.stringify({error:err?.message || String(err)}), {
      status:500, headers:{...cors(req),'Content-Type':'application/json'}
    });
  }
});
