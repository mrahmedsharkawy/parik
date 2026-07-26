// @ts-nocheck
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

function normalizeLang(value: unknown) {
  return String(value || '').toLowerCase().startsWith('en') ? 'en' : 'ar';
}

function localizedOrderStatus(status: unknown, orderId: unknown, langValue: unknown) {
  const lang = normalizeLang(langValue);
  const cleanStatus = String(status || 'processing').toLowerCase();
  const cleanOrderId = String(orderId || '').trim();
  const orderAr = cleanOrderId ? ` رقم ${cleanOrderId}` : '';
  const orderEn = cleanOrderId ? ` #${cleanOrderId.replace(/^#/, '')}` : '';
  const ar: Record<string, { icon: string; title: string; body: string }> = {
    pending:       { icon: '⏳', title: 'طلبك قيد المراجعة',      body: `طلبك${orderAr} يُراجَع الآن` },
    processing:    { icon: '🔄', title: 'طلبك قيد المعالجة',      body: `جارٍ تجهيز طلبك${orderAr}` },
    confirmed:     { icon: '✅', title: 'تم تأكيد طلبك',           body: `طلبك${orderAr} تم تأكيده وسيُجهَّز قريباً 🎉` },
    manufacturing: { icon: '🔨', title: 'طلبك في مرحلة التصنيع',  body: `طلبك${orderAr} يُصنَّع الآن بعناية ✨` },
    ready:         { icon: '🎁', title: 'طلبك جاهز للاستلام',     body: `طلبك${orderAr} جاهز وبانتظارك 🎉` },
    shipped:       { icon: '🚚', title: 'تم شحن طلبك',            body: `طلبك${orderAr} في الطريق إليك` },
    delivered:     { icon: '✅', title: 'تم توصيل طلبك',          body: `طلبك${orderAr} وصل بنجاح 🎉` },
    cancelled:     { icon: '❌', title: 'تم إلغاء طلبك',          body: `طلبك${orderAr} تم إلغاؤه` },
    returned:      { icon: '↩️', title: 'تمت عملية الإرجاع',       body: `تمت معالجة إرجاع طلبك${orderAr}` },
  };
  const en: Record<string, { icon: string; title: string; body: string }> = {
    pending:       { icon: '⏳', title: 'Your order is under review',    body: `Your order${orderEn} is being reviewed` },
    processing:    { icon: '🔄', title: 'Your order is being processed', body: `We are preparing your order${orderEn}` },
    confirmed:     { icon: '✅', title: 'Your order is confirmed',       body: `Your order${orderEn} has been confirmed and will be prepared soon 🎉` },
    manufacturing: { icon: '🔨', title: 'Your order is in production',   body: `Your order${orderEn} is being carefully made ✨` },
    ready:         { icon: '🎁', title: 'Your order is ready',           body: `Your order${orderEn} is ready and waiting for you 🎉` },
    shipped:       { icon: '🚚', title: 'Your order has shipped',        body: `Your order${orderEn} is on its way to you` },
    delivered:     { icon: '✅', title: 'Your order was delivered',      body: `Your order${orderEn} was delivered successfully 🎉` },
    cancelled:     { icon: '❌', title: 'Your order was cancelled',      body: `Your order${orderEn} was cancelled` },
    returned:      { icon: '↩️', title: 'Return processed',              body: `The return for your order${orderEn} has been processed` },
  };
  const item = (lang === 'en' ? en : ar)[cleanStatus] || (lang === 'en' ? en.processing : ar.processing);
  return { lang, status: cleanStatus, icon: item.icon, title: `${item.icon} ${item.title}`, body: item.body };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { title, body, title_en, body_en, url, image, user_phone, user_email, exclude_endpoint, type, status, iconText, emoji, orderId, order_id, lang, user_lang } = await req.json();
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
        const { data: s1 } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_lang').eq('user_phone', user_phone);
        const { data: s2 } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_lang').eq('user_phone', withPlus);
        const { data: s3 } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_lang').eq('user_phone', digits);
        merged.push(...(s1 || []), ...(s2 || []), ...(s3 || []));
      }
      if (user_email) {
        const mail = String(user_email).trim().toLowerCase();
        const { data: se } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_lang').eq('user_email', mail);
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
      const { data, error } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_lang');
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

    const results = await Promise.allSettled(
      filteredSubs.map((sub: any) => {
        const targetLang = normalizeLang(sub.user_lang || user_lang || lang);
        const orderStatusText = type === 'order_status' || status
          ? localizedOrderStatus(status, orderId || order_id, targetLang)
          : null;
        const localizedTitle = orderStatusText ? orderStatusText.title : (targetLang === 'en' && title_en ? title_en : title);
        const localizedBody = orderStatusText ? orderStatusText.body : (targetLang === 'en' && body_en ? body_en : body);
        const localizedIcon = orderStatusText ? orderStatusText.icon : (iconText || emoji || null);
        const payloadStr = JSON.stringify({
          title: localizedTitle,
          body: localizedBody,
          url: url || '/',
          image: image || null,
          type: type || 'general',
          status: orderStatusText ? orderStatusText.status : status || null,
          iconText: localizedIcon,
          emoji: localizedIcon,
          orderId: orderId || order_id || null,
          order_id: order_id || orderId || null,
          lang: targetLang
        });
        const payload = new TextEncoder().encode(payloadStr);
        return webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          payload,
          {
            // TTL طويل (24 ساعة) بدلاً من 60 ثانية — عشان لو الهاتف كان
            // غير متصل بالإنترنت أو في وضع توفير الطاقة لحظة الإرسال، تحتفظ
            // خوادم Apple/Google بالإشعار وتُعيد تسليمه بمجرد اتصال الجهاز،
            // بدلاً من حذفه فوراً بصمت بعد دقيقة واحدة.
            TTL: 86400,
            urgency: 'high'
          }
        ).catch(async (err) => {
          // حذف الاشتراكات المنتهية (410 Gone)
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
          throw err;
        })
      })
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
