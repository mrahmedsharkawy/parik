// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const INTERNAL='bariq-occ-cron-20260822';
const ALLOWED=['https://bariqgifts.com','https://www.bariqgifts.com','https://admin.bariqgifts.com'];
function cors(req){const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':ALLOWED.includes(o)?o:ALLOWED[0],'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-cron-secret','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};}
function access(req){const env=String(Deno.env.get('OCCASION_REMINDER_CRON_SECRET')||'').trim(),h=String(req.headers.get('x-cron-secret')||'').trim(),b=String(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();return (env&&(h===env||b===env))||h===INTERNAL;}
function dim(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate()} function dte(y,m,d){return new Date(Date.UTC(y,m-1,Math.min(d,dim(y,m))))}
function next(row,today){const m=+row.occasion_month||0,d=+row.occasion_day||0;if(!m||!d)return null;const y=today.getUTCFullYear(),fy=row.occasion_year?+row.occasion_year:null;let c=dte(fy||y,m,d);if(!fy&&c<today)c=dte(y+1,m,d);return c}
function label(t){return ({birthday:'عيد ميلاد',anniversary:'ذكرى زواج',graduation:'تخرج',newborn:'مولود جديد',engagement:'خطوبة',wedding:'زواج',other:'مناسبة'})[t]||'مناسبة'}
function targetUrl(t){const p=({birthday:'/categories/Occasions',anniversary:'/categories/Occasions',graduation:'/categories/Occasions/Graduation',newborn:'/categories/Occasions/Born-in',engagement:'/categories/Occasions',wedding:'/categories/Occasions',other:'/'})[t]||'/';return 'https://bariqgifts.com'+p}
function normPhone(v){let x=String(v||'').replace(/\D/g,'');if(x.startsWith('00971'))x=x.slice(2);if(x.startsWith('971'))x=x.slice(3);if(x.startsWith('0'))x=x.slice(1);x=x.slice(0,9);return x?'+971'+x:''}
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});if(req.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...cors(req),'Content-Type':'application/json'}});if(!access(req))return new Response(JSON.stringify({error:'Scheduler authorization required'}),{status:401,headers:{...cors(req),'Content-Type':'application/json'}});try{
 const sb=createClient(Deno.env.get('SUPABASE_URL')??'',String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'').trim());
 const pub=String(Deno.env.get('VAPID_PUBLIC_KEY')||'').trim(),priv=String(Deno.env.get('VAPID_PRIVATE_KEY')||'').trim(),mail=String(Deno.env.get('VAPID_EMAIL')||'mailto:admin@bariq.store').trim(); if(!pub||!priv)throw new Error('Missing VAPID keys'); webpush.setVapidDetails(mail,pub,priv);
 const now=new Date(),today=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 const {data:rows,error}=await sb.from('customer_occasions').select('*').eq('reminder_enabled',true).limit(500);if(error)throw error;
 let due=0,sent=0,failed=0,skipped=0;const failures=[];
 for(const row of rows||[]){const nd=next(row,today);if(!nd){skipped++;continue}const rd=new Date(nd);rd.setUTCDate(rd.getUTCDate()-Number(row.remind_before_days||7));if(today<rd||today>nd)continue;if(row.last_reminder_sent_at&&new Date(row.last_reminder_sent_at).getUTCFullYear()===nd.getUTCFullYear()){skipped++;continue}due++;
   let subs=[];
   if(row.user_id){const {data}=await sb.from('push_subscriptions').select('endpoint,p256dh,auth,user_lang,vapid_public_key,user_id').eq('user_id',row.user_id);subs.push(...(data||[]))}
   const emails=new Set(),phones=new Set(); if(row.customer_email)emails.add(String(row.customer_email).trim().toLowerCase()); if(row.customer_phone)phones.add(normPhone(row.customer_phone));
   if(row.customer_id){const {data:c}=await sb.from('customers').select('email,phone').eq('id',row.customer_id).maybeSingle();if(c?.email)emails.add(String(c.email).trim().toLowerCase());if(c?.phone)phones.add(normPhone(c.phone))}
   for(const email of emails){if(!email)continue;const {data}=await sb.from('push_subscriptions').select('endpoint,p256dh,auth,user_lang,vapid_public_key,user_id').eq('user_email',email);subs.push(...(data||[]))}
   for(const phone of phones){if(!phone)continue;for(const p of [phone,phone.replace(/^\+/, '')]){const {data}=await sb.from('push_subscriptions').select('endpoint,p256dh,auth,user_lang,vapid_public_key,user_id').eq('user_phone',p);subs.push(...(data||[]))}}
   const seen=new Set();subs=subs.filter(s=>s?.endpoint&&!seen.has(s.endpoint)&&seen.add(s.endpoint)&&String(s.vapid_public_key||'').trim()===pub);
   if(!subs.length){failed++;failures.push({id:row.id,error:'no current subscription',user_id:row.user_id||null});continue}
   const person=String(row.person_name||row.occasion_name||'شخص مهم').trim(),days=Math.max(0,Math.ceil((nd.getTime()-today.getTime())/86400000)),title=`🎁 مناسبة ${person} قربت!`,body=days===0?`النهارده ${label(row.occasion_type)} ${person} 🎉 جهز هديتك من بريق وخلي المناسبة أجمل.`:`باقي ${days} ${days===1?'يوم':'أيام'} على ${label(row.occasion_type)} ${person}. جهز هديتك من بريق وخلي المناسبة أجمل.`;
   let ok=0;for(const s of subs){try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body,url:targetUrl(row.occasion_type),type:'customer_occasion',iconText:'🎁',emoji:'🎁',lang:s.user_lang||'ar'}),{TTL:86400,urgency:'high'});ok++}catch(e){console.error('OCCASION_PUSH_FAILED',{statusCode:e?.statusCode||null,body:e?.body||null,message:e?.message||String(e)})}}
   if(ok>0){sent++;await sb.from('customer_occasions').update({last_reminder_sent_at:new Date().toISOString()}).eq('id',row.id)}else{failed++;failures.push({id:row.id,error:'delivery failed'})}
 }
 return new Response(JSON.stringify({sent,failed,skipped,due,failures:failures.slice(0,20)}),{headers:{...cors(req),'Content-Type':'application/json'}})
}catch(e){return new Response(JSON.stringify({error:e?.message||String(e)}),{status:500,headers:{...cors(req),'Content-Type':'application/json'}})}});