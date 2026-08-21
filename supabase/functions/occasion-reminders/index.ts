// @ts-nocheck
// Supabase Edge Function: occasion-reminders
// Scheduled daily. Push delivery is centralized through hyper-api.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://bariqgifts.com',
  'https://www.bariqgifts.com',
  'https://admin.bariqgifts.com',
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

function daysInMonth(year: number, month: number) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
function validOccasionDate(year: number, month: number, day: number) { return new Date(Date.UTC(year, month - 1, Math.min(day, daysInMonth(year, month)))); }
function nextOccasionDate(row: any, todayUtc: Date) {
  const month = Number(row.occasion_month || 0), day = Number(row.occasion_day || 0);
  if (!month || !day) return null;
  const currentYear = todayUtc.getUTCFullYear();
  const fixedYear = row.occasion_year ? Number(row.occasion_year) : null;
  let candidate = validOccasionDate(fixedYear || currentYear, month, day);
  if (!fixedYear && candidate < todayUtc) candidate = validOccasionDate(currentYear + 1, month, day);
  return candidate;
}
function isoDateOnly(date: Date) { return date.toISOString().slice(0, 10); }
function occasionTypeLabel(type: string) {
  return ({ birthday:'عيد ميلاد', anniversary:'ذكرى زواج', graduation:'تخرج', newborn:'مولود جديد', engagement:'خطوبة', wedding:'زواج', other:'مناسبة' } as any)[type] || 'مناسبة';
}
function occasionUrl(type: string) {
  const path = ({ birthday:'/categories/Occasions', anniversary:'/categories/Occasions', graduation:'/categories/Occasions/Graduation', newborn:'/categories/Occasions/Born-in', engagement:'/categories/Occasions', wedding:'/categories/Occasions', other:'/' } as any)[type] || '/';
  return 'https://bariqgifts.com' + path;
}

async function sendViaPushCore(serviceRole: string, payload: any) {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/hyper-api`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'apikey':serviceRole, 'Authorization':`Bearer ${serviceRole}` },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(async () => ({ error: await response.text().catch(() => '') }));
  if (!response.ok) throw new Error(result?.error || `hyper-api ${response.status}`);
  return result || {};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status:405, headers:{...getCorsHeaders(req),'Content-Type':'application/json'} });
  if (!hasCronAccess(req)) return new Response(JSON.stringify({ error:'Scheduler authorization required' }), { status:401, headers:{...getCorsHeaders(req),'Content-Type':'application/json'} });

  try {
    const serviceRole = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    if (!serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRole);
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const { data: occasions, error } = await supabase
      .from('customer_occasions')
      .select('id,user_id,customer_id,customer_email,customer_phone,occasion_name,occasion_type,person_name,relationship,occasion_day,occasion_month,occasion_year,remind_before_days,last_reminder_sent_at')
      .eq('reminder_enabled', true)
      .limit(500);
    if (error) throw error;

    let due=0, sent=0, failed=0, skipped=0;
    const failures:any[] = [];
    for (const row of occasions || []) {
      const nextDate = nextOccasionDate(row, todayUtc);
      if (!nextDate) { skipped++; continue; }
      const remindDate = new Date(nextDate);
      remindDate.setUTCDate(remindDate.getUTCDate() - Number(row.remind_before_days || 7));
      if (isoDateOnly(remindDate) !== isoDateOnly(todayUtc)) continue;
      const sentThisYear = row.last_reminder_sent_at && new Date(row.last_reminder_sent_at).getUTCFullYear() === nextDate.getUTCFullYear();
      if (sentThisYear) { skipped++; continue; }
      due++;

      let email = String(row.customer_email || '').trim().toLowerCase();
      let phone = String(row.customer_phone || '').trim();
      if ((!email || !phone) && row.customer_id) {
        const { data: customer } = await supabase.from('customers').select('email,phone').eq('id', row.customer_id).maybeSingle();
        email = email || String(customer?.email || '').trim().toLowerCase();
        phone = phone || String(customer?.phone || '').trim();
      }
      if (!email && !phone) { skipped++; failures.push({id:row.id,error:'missing customer identity'}); continue; }

      const typeLabel = occasionTypeLabel(row.occasion_type);
      const personName = String(row.person_name || row.occasion_name || 'شخص مهم').trim();
      const days = Number(row.remind_before_days || 7);
      try {
        const result = await sendViaPushCore(serviceRole, {
          title: `🎁 مناسبة ${personName} قربت!`,
          body: `باقي ${days} أيام على ${typeLabel} ${personName}. جهز هديتك من بريق وخلي المناسبة أجمل.`,
          url: occasionUrl(row.occasion_type),
          type: 'customer_occasion',
          iconText: '🎁', emoji: '🎁',
          user_email: email || undefined,
          user_phone: phone || undefined,
        });
        if (Number(result.sent || 0) > 0) {
          sent++;
          await supabase.from('customer_occasions').update({ last_reminder_sent_at: new Date().toISOString() }).eq('id', row.id);
        } else {
          failed++;
          failures.push({ id:row.id, message:result.message || result.error || 'no matching subscription', failures:result.failures || [] });
        }
      } catch (err) {
        failed++;
        failures.push({ id:row.id, error:String(err?.message || err) });
      }
    }

    return new Response(JSON.stringify({ sent, failed, skipped, due, failures: failures.slice(0,20) }), {
      headers:{...getCorsHeaders(req),'Content-Type':'application/json'}
    });
  } catch (err) {
    return new Response(JSON.stringify({ error:err?.message || String(err) }), { status:500, headers:{...getCorsHeaders(req),'Content-Type':'application/json'} });
  }
});
