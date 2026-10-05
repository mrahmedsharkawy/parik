// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Kept self-contained so the function can also be pasted into the Supabase
// dashboard editor without depending on a sibling _shared directory.
function getSupabaseSecretKey(): string {
  const keysJson = String(Deno.env.get('SUPABASE_SECRET_KEYS') || '').trim();
  if (keysJson) {
    try {
      const keys = JSON.parse(keysJson);
      const defaultKey = String(keys?.default || '').trim();
      if (defaultKey) return defaultKey;
    } catch {
      // Keep legacy environment-variable fallbacks active.
    }
  }
  return String(
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('SUPABASE_SERVICE_KEY') ||
      '',
  ).trim();
}

const ALLOWED_ORIGINS = [
  'https://bariqgifts.com',
  'https://www.bariqgifts.com',
  'https://admin.bariqgifts.com',
];

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function bearer(req: Request) {
  return (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

function optionalSchemaError(error: any) {
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(String(error?.code || ''));
}

async function checked(label: string, operation: Promise<any>, optional = false) {
  const result = await operation;
  if (result?.error && !(optional && optionalSchemaError(result.error))) {
    console.error('DELETE_ACCOUNT_STEP_FAILED', label, result.error);
    throw new Error(`Failed to complete ${label}`);
  }
  return result?.data || [];
}

async function removeStorageFolder(supabase: any, bucketName: string, prefix: string) {
  const bucket = supabase.storage.from(bucketName);
  const files: string[] = [];

  async function walk(folder: string) {
    let offset = 0;
    while (true) {
      const { data, error } = await bucket.list(folder, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) {
        // Missing buckets/folders do not prevent deleting the account itself.
        if (String(error.message || '').toLowerCase().includes('not found')) return;
        throw error;
      }
      const rows = data || [];
      for (const row of rows) {
        const path = folder ? `${folder}/${row.name}` : row.name;
        if (row.id) files.push(path);
        else await walk(path);
      }
      if (rows.length < 100) break;
      offset += rows.length;
    }
  }

  await walk(prefix);
  for (let index = 0; index < files.length; index += 100) {
    const { error } = await bucket.remove(files.slice(index, index + 100));
    if (error) throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  const headers = { ...cors(req), 'Content-Type': 'application/json' };
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const token = bearer(req);
    if (!token) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers });

    const body = await req.json().catch(() => ({}));
    if (body?.confirmation !== 'DELETE') {
      return new Response(JSON.stringify({ error: 'Deletion confirmation required' }), { status: 400, headers });
    }

    const secretKey = getSupabaseSecretKey();
    if (!secretKey) throw new Error('Server configuration is incomplete');
    const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { status: 401, headers });
    }

    const email = String(user.email || '').trim().toLowerCase();
    const adminCheck = await supabase.from('admins').select('id').or(`user_id.eq.${user.id},email.ilike.${email}`).limit(1);
    if (!adminCheck.error && adminCheck.data?.length) {
      return new Response(JSON.stringify({ error: 'Administrative accounts cannot be deleted here' }), { status: 403, headers });
    }

    const customers = email
      ? await checked('customer lookup', supabase.from('customers').select('id,phone,email').ilike('email', email), true)
      : [];
    const phones = [...new Set(customers.map((row: any) => String(row.phone || '').trim()).filter(Boolean))];

    let orders: any[] = [];
    if (email) {
      orders.push(...await checked('order lookup', supabase.from('orders').select('id').ilike('customer_email', email), true));
    }
    for (const phone of phones) {
      orders.push(...await checked('order lookup', supabase.from('orders').select('id').eq('customer_phone', phone), true));
    }
    const orderIds = [...new Set(orders.map((row: any) => String(row.id || '')).filter(Boolean))];
    for (const orderId of orderIds) {
      await removeStorageFolder(supabase, 'products', `custom-orders/${orderId}`);
    }

    await checked('occasions', supabase.from('customer_occasions').delete().eq('user_id', user.id), true);
    await checked('notifications', supabase.from('notifications').delete().eq('user_id', user.id), true);
    await checked('device tokens', supabase.from('app_device_tokens').delete().eq('user_id', user.id), true);
    await checked('reviews', supabase.from('reviews').delete().eq('user_id', user.id), true);

    if (email) {
      await checked('occasions', supabase.from('customer_occasions').delete().ilike('customer_email', email), true);
      await checked('notifications', supabase.from('notifications').delete().ilike('customer_email', email), true);
      await checked('push subscriptions', supabase.from('push_subscriptions').delete().ilike('user_email', email), true);
      await checked('abandoned carts', supabase.from('abandoned_carts').delete().ilike('user_email', email), true);
      await checked('synced profile', supabase.from('user_sync').delete().ilike('user_email', email), true);
      await checked('reviews', supabase.from('reviews').delete().ilike('customer_email', email), true);
      await checked('order customer link', supabase.from('orders').update({ customer_id: null }).ilike('customer_email', email), true);
      await checked('orders', supabase.from('orders').update({
        customer_name: 'Deleted customer', customer_email: null, customer_phone: null,
        address: {}, notes: null,
      }).ilike('customer_email', email), true);
    }

    for (const phone of phones) {
      await checked('occasions', supabase.from('customer_occasions').delete().eq('customer_phone', phone), true);
      await checked('notifications', supabase.from('notifications').delete().eq('customer_phone', phone), true);
      await checked('push subscriptions', supabase.from('push_subscriptions').delete().eq('user_phone', phone), true);
      await checked('abandoned carts', supabase.from('abandoned_carts').delete().eq('user_phone', phone), true);
      await checked('order customer link', supabase.from('orders').update({ customer_id: null }).eq('customer_phone', phone), true);
      await checked('orders', supabase.from('orders').update({
        customer_name: 'Deleted customer', customer_email: null, customer_phone: null,
        address: {}, notes: null,
      }).eq('customer_phone', phone), true);
    }

    if (email) await checked('customer profile', supabase.from('customers').delete().ilike('email', email), true);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id, false);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ deleted: true }), { status: 200, headers });
  } catch (error) {
    console.error('DELETE_ACCOUNT_FAILED', error);
    return new Response(JSON.stringify({ error: 'Account deletion could not be completed' }), { status: 500, headers });
  }
});
