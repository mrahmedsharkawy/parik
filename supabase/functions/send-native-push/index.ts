// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleAuth } from 'npm:google-auth-library@9.15.1';

const ALLOWED_ORIGINS = [
  'https://bariqgifts.com',
  'https://www.bariqgifts.com',
  'https://admin.bariqgifts.com',
];

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function bearer(req: Request) {
  return (req.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

async function isAdmin(req: Request, supabase: any) {
  const token = bearer(req);
  if (!token) return false;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return false;
  const user = data.user;
  const result = await supabase
    .from('admins')
    .select('id')
    .eq('active', true)
    .or(`user_id.eq.${user.id},email.eq.${user.email || ''}`)
    .limit(1);
  return !result.error && Boolean(result.data?.length);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors(req) });
  }

  const headers = { ...cors(req), 'Content-Type': 'application/json' };
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );
    if (!(await isAdmin(req, supabase))) {
      return new Response(JSON.stringify({ error: 'Admin authorization required' }), {
        status: 401,
        headers,
      });
    }

    const input = await req.json();
    const title = String(input.title_ar || input.title || '').trim();
    const body = String(input.body_ar || input.body || '').trim();
    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body required' }), {
        status: 400,
        headers,
      });
    }

    const rawCredentials = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || '';
    if (!rawCredentials) {
      return new Response(JSON.stringify({ error: 'Missing FIREBASE_SERVICE_ACCOUNT_JSON' }), {
        status: 500,
        headers,
      });
    }
    const credentials = JSON.parse(rawCredentials);
    const projectId = credentials.project_id;
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const authClient = await auth.getClient();
    const access = await authClient.getAccessToken();
    const accessToken = typeof access === 'string' ? access : access?.token;
    if (!accessToken || !projectId) throw new Error('Invalid Firebase credentials');

    let query = supabase
      .from('app_device_tokens')
      .select('token, user_id, locale')
      .eq('active', true);
    if (input.user_id) query = query.eq('user_id', input.user_id);
    const { data: devices, error: devicesError } = await query.limit(5000);
    if (devicesError) throw devicesError;

    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const data = Object.fromEntries(
      Object.entries(input.data || {}).map(([key, value]) => [key, String(value ?? '')]),
    );
    if (input.url) data.url = String(input.url);
    if (input.image) data.image = String(input.image);

    const results = await Promise.allSettled((devices || []).map(async (device: any) => {
      const english = String(device.locale || '').toLowerCase().startsWith('en');
      const localizedTitle = english
        ? String(input.title_en || title)
        : title;
      const localizedBody = english
        ? String(input.body_en || body)
        : body;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: {
              title: localizedTitle,
              body: localizedBody,
              ...(input.image ? { image: String(input.image) } : {}),
            },
            data,
            android: {
              priority: 'high',
              notification: {
                channel_id: 'bariq_offers',
                sound: 'default',
              },
            },
            apns: {
              payload: { aps: { sound: 'default', contentAvailable: true } },
            },
          },
        }),
      });
      if (response.ok) return;
      const detail = await response.text();
      if (response.status === 404 || detail.includes('UNREGISTERED')) {
        await supabase
          .from('app_device_tokens')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('token', device.token);
      }
      throw new Error(`FCM ${response.status}: ${detail}`);
    }));

    return new Response(JSON.stringify({
      sent: results.filter((item) => item.status === 'fulfilled').length,
      failed: results.filter((item) => item.status === 'rejected').length,
      total: results.length,
    }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers,
    });
  }
});
