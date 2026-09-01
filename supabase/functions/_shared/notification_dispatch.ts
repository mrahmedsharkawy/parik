// @ts-nocheck
import webpush from 'npm:web-push@3.6.7';
import { GoogleAuth } from 'npm:google-auth-library@9.15.1';

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function email(value: unknown) {
  return clean(value).toLowerCase();
}

function phone(value: unknown) {
  let digits = clean(value).replace(/\D/g, '');
  if (digits.startsWith('00971')) digits = digits.slice(2);
  if (digits.startsWith('971')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.slice(0, 9);
  return digits ? `+971${digits}` : '';
}

function phoneVariants(value: unknown) {
  const normalized = phone(value);
  return normalized
    ? [normalized, normalized.slice(1), `0${normalized.slice(4)}`]
    : [];
}

function localized(input: any, english: boolean) {
  return {
    title: english ? clean(input.title_en || input.title) : clean(input.title_ar || input.title),
    body: english ? clean(input.body_en || input.body) : clean(input.body_ar || input.body),
  };
}

async function matchingSubscriptions(supabase: any, input: any, fields: string) {
  if (input.broadcast === true) {
    const { data, error } = await supabase.from('push_subscriptions').select(fields);
    if (error) throw error;
    return data || [];
  }
  const rows: any[] = [];
  if (clean(input.user_id)) {
    const { data, error } = await supabase.from('push_subscriptions').select(fields).eq('user_id', clean(input.user_id));
    if (error) throw error;
    rows.push(...(data || []));
  }
  if (email(input.user_email || input.customer_email)) {
    const { data, error } = await supabase.from('push_subscriptions').select(fields).eq('user_email', email(input.user_email || input.customer_email));
    if (error) throw error;
    rows.push(...(data || []));
  }
  for (const value of phoneVariants(input.user_phone || input.customer_phone)) {
    const { data, error } = await supabase.from('push_subscriptions').select(fields).eq('user_phone', value);
    if (error) throw error;
    rows.push(...(data || []));
  }
  const seen = new Set<string>();
  return rows.filter((row) => row?.endpoint && !seen.has(row.endpoint) && seen.add(row.endpoint));
}

async function resolveUserIds(supabase: any, input: any, subscriptions: any[]) {
  const ids = new Set<string>();
  if (clean(input.user_id)) ids.add(clean(input.user_id));
  for (const sub of subscriptions) if (clean(sub.user_id)) ids.add(clean(sub.user_id));
  const wantedEmail = email(input.user_email || input.customer_email);
  const wantedPhone = phone(input.user_phone || input.customer_phone);
  if (!ids.size && (wantedEmail || wantedPhone)) {
    for (let page = 1; page <= 10 && !ids.size; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const users = data?.users || [];
      for (const user of users) {
        const userPhone = phone(user.phone || user.user_metadata?.phone);
        if ((wantedEmail && email(user.email) === wantedEmail) || (wantedPhone && userPhone === wantedPhone)) ids.add(user.id);
      }
      if (users.length < 1000) break;
    }
  }
  return [...ids];
}

async function sendWebPush(subscriptions: any[], input: any) {
  const publicKey = clean(Deno.env.get('VAPID_PUBLIC_KEY'));
  const privateKey = clean(Deno.env.get('VAPID_PRIVATE_KEY'));
  if (!publicKey || !privateKey) return { sent: 0, failed: 0, skipped: subscriptions.length };
  webpush.setVapidDetails(clean(Deno.env.get('VAPID_EMAIL')) || 'mailto:admin@bariq.store', publicKey, privateKey);
  const current = subscriptions.filter((sub) => clean(sub.vapid_public_key) === publicKey);
  const results = await Promise.allSettled(current.map((sub) => {
    const text = localized(input, clean(sub.user_lang).toLowerCase().startsWith('en'));
    return webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({
      title: text.title, body: text.body, url: input.url || '/', image: input.image || null,
      type: input.type || 'general', status: input.status || null, orderId: input.order_id || input.orderId || null,
      product_id: input.product_id || null, iconText: input.icon || input.iconText || null,
    }), { TTL: 86400, urgency: 'high' });
  }));
  return { sent: results.filter((r) => r.status === 'fulfilled').length, failed: results.filter((r) => r.status === 'rejected').length, skipped: subscriptions.length - current.length };
}

async function firebaseAccess() {
  const raw = clean(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON'));
  if (!raw) return null;
  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
  const client = await auth.getClient();
  const result = await client.getAccessToken();
  const token = typeof result === 'string' ? result : result?.token;
  return token && credentials.project_id ? { token, projectId: credentials.project_id } : null;
}

async function sendFcm(supabase: any, input: any, userIds: string[]) {
  const firebase = await firebaseAccess();
  if (!firebase) return { sent: 0, failed: 0, skipped: true };
  let targets: any[] = [];
  if (input.broadcast === true) {
    targets = [{ topic: 'bariq_general_ar', english: false }, { topic: 'bariq_general_en', english: true }];
  } else if (userIds.length) {
    const { data, error } = await supabase.from('app_device_tokens').select('token,locale').eq('active', true).in('user_id', userIds).limit(500);
    if (error) throw error;
    targets = (data || []).map((row) => ({ token: row.token, english: clean(row.locale).toLowerCase().startsWith('en') }));
  }
  const endpoint = `https://fcm.googleapis.com/v1/projects/${firebase.projectId}/messages:send`;
  const results = await Promise.allSettled(targets.map(async (target) => {
    const text = localized(input, target.english);
    const data = Object.fromEntries(Object.entries({
      ...(input.data || {}), type: input.type || 'general', url: input.url || '/', status: input.status || '',
      order_id: input.order_id || input.orderId || '', product_id: input.product_id || '',
    }).map(([key, value]) => [key, String(value ?? '')]));
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${firebase.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: {
        ...(target.topic ? { topic: target.topic } : { token: target.token }),
        notification: { title: text.title, body: text.body, ...(input.image ? { image: String(input.image) } : {}) },
        data,
        android: {
          priority: 'high',
          notification: {
            channel_id: 'bariq_offers',
            sound: 'default',
            notification_count: Math.max(1, Number(input.badge_count || 1)),
          },
        },
        apns: { payload: { aps: { sound: 'default', badge: Number(input.badge_count || 1), contentAvailable: true } } },
      } }),
    });
    if (!response.ok) {
      const detail = await response.text();
      const error: any = new Error(`FCM ${response.status}: ${detail}`);
      error.status = response.status;
      error.detail = detail;
      error.token = target.token || '';
      throw error;
    }
  }));
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  const invalidTokens = rejected
    .filter((result) => /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/i.test(clean(result.reason?.detail || result.reason?.message)))
    .map((result) => clean(result.reason?.token))
    .filter(Boolean);
  if (invalidTokens.length) {
    await supabase.from('app_device_tokens').update({ active: false }).in('token', invalidTokens);
  }
  return {
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: rejected.length,
    total: targets.length,
    errors: rejected.slice(0, 3).map((result) => clean(result.reason?.message).slice(0, 500)),
    invalid_tokens_disabled: invalidTokens.length,
  };
}

async function saveInbox(supabase: any, input: any) {
  if (input.save_inbox === false) return null;
  const payload = {
    type: input.type || 'general', icon: input.icon || input.iconText || '🔔',
    title: localized(input, false).title, body: localized(input, false).body, msg: localized(input, false).body,
    user_id: clean(input.user_id) || null,
    customer_email: email(input.user_email || input.customer_email) || null,
    customer_phone: phone(input.user_phone || input.customer_phone) || null,
    order_id: clean(input.order_id || input.orderId) || null,
    url: input.url || '/', status: input.status || 'sent', order_status: input.order_status || input.status || null,
    data: { ...(input.data || {}), title_en: input.title_en || '', body_en: input.body_en || '', image: input.image || '', product_id: input.product_id || '' },
    is_read: false,
  };
  const { data, error } = await supabase.from('notifications').insert(payload).select('id').maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

export async function dispatchNotification(supabase: any, input: any) {
  if (!localized(input, false).title || !localized(input, false).body) throw new Error('title and body required');
  const personal = clean(input.user_id || input.user_email || input.customer_email || input.user_phone || input.customer_phone || input.order_id || input.orderId);
  if (input.broadcast !== true && !personal) throw new Error('A personal target or broadcast=true is required');
  const subscriptions = await matchingSubscriptions(supabase, input, 'endpoint,p256dh,auth,user_lang,vapid_public_key,user_id');
  const userIds = input.broadcast === true ? [] : await resolveUserIds(supabase, input, subscriptions);
  const [inbox, web, native] = await Promise.all([
    saveInbox(supabase, input),
    input.skip_web === true ? { sent: 0, failed: 0, skipped: true } : sendWebPush(subscriptions, input),
    input.skip_native === true ? { sent: 0, failed: 0, skipped: true } : sendFcm(supabase, input, userIds),
  ]);
  return { inbox, web, native, broadcast: input.broadcast === true, matched_user_ids: userIds.length };
}
