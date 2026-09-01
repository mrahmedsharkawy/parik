// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseSecretKey } from '../_shared/supabase_keys.ts';
import { dispatchNotification } from '../_shared/notification_dispatch.ts';

const INTERNAL='bariq-occ-cron-20260822';
const ALLOWED=['https://bariqgifts.com','https://www.bariqgifts.com','https://admin.bariqgifts.com'];
function cors(req){const origin=req.headers.get('origin')||'';return{'Access-Control-Allow-Origin':ALLOWED.includes(origin)?origin:ALLOWED[0],'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-cron-secret','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};}
function access(req){const env=String(Deno.env.get('OCCASION_REMINDER_CRON_SECRET')||'').trim(),header=String(req.headers.get('x-cron-secret')||'').trim(),bearer=String(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();return(env&&(header===env||bearer===env))||header===INTERNAL;}
function daysInMonth(year,month){return new Date(Date.UTC(year,month,0)).getUTCDate();}
function date(year,month,day){return new Date(Date.UTC(year,month-1,Math.min(day,daysInMonth(year,month))));}
function nextDate(row,today){const month=Number(row.occasion_month)||0,day=Number(row.occasion_day)||0;if(!month||!day)return null;const year=today.getUTCFullYear(),fixed=row.occasion_year?Number(row.occasion_year):null;let result=date(fixed||year,month,day);if(!fixed&&result<today)result=date(year+1,month,day);return result;}
function label(type){return({birthday:'عيد ميلاد',anniversary:'ذكرى زواج',graduation:'تخرج',newborn:'مولود جديد',engagement:'خطوبة',wedding:'زواج',other:'مناسبة'})[type]||'مناسبة';}
function targetUrl(type){const path=({birthday:'/categories/Occasions',anniversary:'/categories/Occasions',graduation:'/categories/Occasions/Graduation',newborn:'/categories/Occasions/Born-in',engagement:'/categories/Occasions',wedding:'/categories/Occasions',other:'/'})[type]||'/';return `https://bariqgifts.com${path}`;}
function normalizePhone(value){let digits=String(value||'').replace(/\D/g,'');if(digits.startsWith('00971'))digits=digits.slice(2);if(digits.startsWith('971'))digits=digits.slice(3);if(digits.startsWith('0'))digits=digits.slice(1);digits=digits.slice(0,9);return digits?`+971${digits}`:'';}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...cors(req),'Content-Type':'application/json'}});
  if(!access(req))return new Response(JSON.stringify({error:'Scheduler authorization required'}),{status:401,headers:{...cors(req),'Content-Type':'application/json'}});
  try{
    const supabase=createClient(Deno.env.get('SUPABASE_URL')||'',getSupabaseSecretKey());
    const now=new Date(),today=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
    const {data:rows,error}=await supabase.from('customer_occasions').select('*').eq('reminder_enabled',true).limit(500);
    if(error)throw error;
    let due=0,sent=0,failed=0,skipped=0;
    const failures=[];
    for(const row of rows||[]){
      const occasionDate=nextDate(row,today);
      if(!occasionDate){skipped++;continue;}
      const reminderDate=new Date(occasionDate);reminderDate.setUTCDate(reminderDate.getUTCDate()-Number(row.remind_before_days||7));
      if(today<reminderDate||today>occasionDate)continue;
      if(row.last_reminder_sent_at&&new Date(row.last_reminder_sent_at).getUTCFullYear()===occasionDate.getUTCFullYear()){skipped++;continue;}
      due++;
      let userEmail=String(row.customer_email||'').trim().toLowerCase(),userPhone=normalizePhone(row.customer_phone),userId=row.user_id||null;
      if(row.customer_id&&(!userEmail||!userPhone)){const{data:customer}=await supabase.from('customers').select('email,phone').eq('id',row.customer_id).maybeSingle();userEmail=userEmail||String(customer?.email||'').trim().toLowerCase();userPhone=userPhone||normalizePhone(customer?.phone);}
      if(!userId&&!userEmail&&!userPhone){failed++;failures.push({id:row.id,error:'missing customer identity'});continue;}
      const person=String(row.person_name||row.occasion_name||'شخص مهم').trim(),remaining=Math.max(0,Math.ceil((occasionDate.getTime()-today.getTime())/86400000));
      const title=`🎁 مناسبة ${person} اقتربت!`;
      const body=remaining===0?`اليوم ${label(row.occasion_type)} ${person} 🎉 جهز هديتك من بريق.`:`باقي ${remaining} ${remaining===1?'يوم':'أيام'} على ${label(row.occasion_type)} ${person}. جهز هديتك من بريق.`;
      try{
        await dispatchNotification(supabase,{user_id:userId,user_email:userEmail,user_phone:userPhone,title,body,type:'occasion',icon:'🎁',url:targetUrl(row.occasion_type)});
        sent++;
        await supabase.from('customer_occasions').update({last_reminder_sent_at:new Date().toISOString()}).eq('id',row.id);
      }catch(error){failed++;failures.push({id:row.id,error:String(error?.message||error)});}
    }
    return new Response(JSON.stringify({sent,failed,skipped,due,failures:failures.slice(0,20)}),{headers:{...cors(req),'Content-Type':'application/json'}});
  }catch(error){return new Response(JSON.stringify({error:error?.message||String(error)}),{status:500,headers:{...cors(req),'Content-Type':'application/json'}});}
});
