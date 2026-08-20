// @ts-nocheck
// Supabase Edge Function: occasion-reminders
// Run daily from a scheduled job. It sends customer occasion push reminders.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const ALLOWED_ORIGINS = [
  'https://bariqgifts.com',
  'https://www.bariqgifts.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function hasCronAccess(req: Request) {
  const secret = Deno.env.get('OCCASION_REMINDER_CRON_SECRET') || '';
  if (!secret) return false;
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return bearer === secret || req.headers.get('x-cron-secret') === secret;
}

function readVapidSecret(name: string) {
  return String(Deno.env.get(name) || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '');
}

function invalidVapidKeyMessage(name: string, value: string) {
  if (!value) return `Missing ${name}`;
  if (value.includes('=')) return `${name} must be URL-safe Base64 without "=" padding`;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return `${name} must contain only URL-safe Base64 characters`;
  if (name === 'VAPID_PUBLIC_KEY' && value.length < 80) return `${name} looks too short`;
  if (name === 'VAPID_PRIVATE_KEY' && value.length < 40) return `${name} looks too short`;
  return '';
}

function normalizePhoneVariants(phone: string) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  return Array.from(new Set([raw, digits ? '+' + digits : '', digits].filter(Boolean)));
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function validOccasionDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, Math.min(day, daysInMonth(year, month))));
}

function nextOccasionDate(row: any, todayUtc: Date) {
  const month = Number(row.occasion_month || 0);
  const day = Number(row.occasion_day || 0);
  if (!month || !day) return null;
  const currentYear = todayUtc.getUTCFullYear();
  const fixedYear = row.occasion_year ? Number(row.occasion_year) : null;
  let candidate = validOccasionDate(fixedYear || currentYear, month, day);
  if (!fixedYear && candidate < todayUtc) {
    candidate = validOccasionDate(currentYear + 1, month, day);
  }
  return candidate;
}

function isoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function occasionTypeLabel(type: string) {
  const map: Record<string, string> = {
    birthday: 'عيد ميلاد',
    anniversary: 'ذكرى زواج',
    graduation: 'تخرج',
    newborn: 'مولود جديد',
    engagement: 'خطوبة',
    wedding: 'زواج',
    other: 'مناسبة',
  };
  return map[type] || 'مناسبة';
}

function occasionUrl(type: string) {
  const map: Record<string, string> = {
    birthday: '/categories/Occasions',
    anniversary: '/categories/Occasions',
    graduation: '/categories/Occasions/Graduation',
    newborn: '/categories/Occasions/Born-in',
    engagement: '/categories/Occasions',
    wedding: '/categories/Occasions',
    other: '/',
  };
  return 'https://bariqgifts.com' + (map[type] || '/');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
  if (!hasCronAccess(req)) {
    return new Response(JSON.stringify({ error: 'Scheduler authorization required' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const VAPID_PRIVATE = readVapidSecret('VAPID_PRIVATE_KEY');
    const VAPID_PUBLIC = readVapidSecret('VAPID_PUBLIC_KEY');
    const VAPID_EMAIL = String(Deno.env.get('VAPID_EMAIL') || 'mailto:bariq.gifts@gmail.com').trim();
    const privateKeyError = invalidVapidKeyMessage('VAPID_PRIVATE_KEY', VAPID_PRIVATE);
    const publicKeyError = invalidVapidKeyMessage('VAPID_PUBLIC_KEY', VAPID_PUBLIC);
    if (privateKeyError || publicKeyError) throw new Error(privateKeyError || publicKeyError);
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const { data: occasions, error } = await supabase
      .from('customer_occasions')
      .select('id,user_id,customer_id,customer_email,customer_phone,occasion_name,occasion_type,person_name,relationship,occasion_day,occasion_month,occasion_year,remind_before_days,last_reminder_sent_at')
      .eq('reminder_enabled', true)
      .limit(500);
    if (error) throw error;

    let due = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of occasions || []) {
      const nextDate = nextOccasionDate(row, todayUtc);
      if (!nextDate) {
        skipped++;
        continue;
      }
      const remindDate = new Date(nextDate);
      remindDate.setUTCDate(remindDate.getUTCDate() - Number(row.remind_before_days || 7));
      if (isoDateOnly(remindDate) !== isoDateOnly(todayUtc)) continue;

      const sentThisYear = row.last_reminder_sent_at
        && new Date(row.last_reminder_sent_at).getUTCFullYear() === nextDate.getUTCFullYear();
      if (sentThisYear) {
        skipped++;
        continue;
      }
      due++;

      let identityEmail = String(row.customer_email || '').trim().toLowerCase();
      let identityPhone = String(row.customer_phone || '').trim();
      if ((!identityEmail || !identityPhone) && row.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('email,phone')
          .eq('id', row.customer_id)
          .maybeSingle();
        identityEmail = identityEmail || String(customer?.email || '').trim().toLowerCase();
        identityPhone = identityPhone || String(customer?.phone || '').trim();
      }

      const subQueries = [];
      if (identityEmail) {
        subQueries.push(supabase.from('push_subscriptions').select('endpoint,p256dh,auth,user_lang').eq('user_email', identityEmail));
      }
      for (const phoneVariant of normalizePhoneVariants(identityPhone)) {
        subQueries.push(supabase.from('push_subscriptions').select('endpoint,p256dh,auth,user_lang').eq('user_phone', phoneVariant));
      }
      if (!subQueries.length) {
        skipped++;
        continue;
      }

      const results = await Promise.all(subQueries);
      const subs: any[] = [];
      const seen = new Set<string>();
      results.forEach((result: any) => {
        (result.data || []).forEach((sub: any) => {
          if (!sub?.endpoint || seen.has(sub.endpoint)) return;
          seen.add(sub.endpoint);
          subs.push(sub);
        });
      });
      if (!subs.length) {
        skipped++;
        continue;
      }

      const typeLabel = occasionTypeLabel(row.occasion_type);
      const personName = String(row.person_name || row.occasion_name || 'شخص مهم').trim();
      const days = Number(row.remind_before_days || 7);
      const payload = JSON.stringify({
        id: `occasion-${row.id}-${nextDate.getUTCFullYear()}`,
        type: 'customer_occasion',
        icon: '🎁',
        title: `🎁 مناسبة ${personName} قربت!`,
        body: `باقي ${days} أيام على ${typeLabel} ${personName}. جهز هديتك من بريق وخلي المناسبة أجمل.`,
        msg: `باقي ${days} أيام على ${typeLabel} ${personName}. جهز هديتك من بريق وخلي المناسبة أجمل.`,
        url: occasionUrl(row.occasion_type),
        date: new Date().toISOString(),
      });

      let delivered = false;
      for (const sub of subs) {
        try {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          }, new TextEncoder().encode(payload), { TTL: 86400, urgency: 'normal' });
          delivered = true;
        } catch (err) {
          const statusCode = err?.statusCode || 0;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          } else {
            failed++;
          }
        }
      }
      if (delivered) {
        sent++;
        await supabase.from('customer_occasions')
          .update({ last_reminder_sent_at: new Date().toISOString() })
          .eq('id', row.id);
      }
    }

    return new Response(JSON.stringify({ sent, failed, skipped, due }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
