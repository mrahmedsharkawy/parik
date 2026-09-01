// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseSecretKey } from '../_shared/supabase_keys.ts';
import { dispatchNotification } from '../_shared/notification_dispatch.ts';

const ALLOWED_ORIGINS = ['https://bariqgifts.com', 'https://www.bariqgifts.com', 'https://admin.bariqgifts.com'];
function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function bearer(req: Request) { return (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim(); }
function internal(req: Request) {
  const supplied = String(req.headers.get('apikey') || '').trim();
  const secret = getSupabaseSecretKey();
  return Boolean(secret && supplied === secret);
}
async function isAdmin(req: Request, supabase: any) {
  if (internal(req)) return true;
  const token = bearer(req);
  if (!token) return false;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return false;
  const user = data.user;
  const result = await supabase.from('admins').select('id').eq('active', true).or(`user_id.eq.${user.id},email.eq.${user.email || ''}`).limit(1);
  return !result.error && Boolean(result.data?.length);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  const headers = { ...cors(req), 'Content-Type': 'application/json' };
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', getSupabaseSecretKey());
    if (!(await isAdmin(req, supabase))) return new Response(JSON.stringify({ error: 'Admin authorization required' }), { status: 401, headers });
    const result = await dispatchNotification(supabase, await req.json());
    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    console.error('NOTIFICATION_DISPATCH_FAILED', error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), { status: 500, headers });
  }
});
