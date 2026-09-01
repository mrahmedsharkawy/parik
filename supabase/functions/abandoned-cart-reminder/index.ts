// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseSecretKey } from '../_shared/supabase_keys.ts';
import { dispatchNotification } from '../_shared/notification_dispatch.ts';

const INTERNAL = 'bariq-cart-cron-20260822';
const ALLOWED = ['https://bariqgifts.com', 'https://www.bariqgifts.com', 'https://admin.bariqgifts.com'];
function cors(req) { const origin=req.headers.get('origin')||''; return {'Access-Control-Allow-Origin':ALLOWED.includes(origin)?origin:ALLOWED[0],'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-cron-secret','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}; }
function access(req) { const env=String(Deno.env.get('ABANDONED_CART_CRON_SECRET')||'').trim(), header=String(req.headers.get('x-cron-secret')||'').trim(), bearer=String(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim(); return (env&&(header===env||bearer===env))||header===INTERNAL; }
function language(value) { return String(value||'').toLowerCase().startsWith('en')?'en':'ar'; }
function message(row) {
  const english=language(row.user_lang)==='en', count=Math.max(1,Number(row.cart_count)||1), name=String(row.first_product_name||'').trim();
  if (english) return {title:'🛍️ Your cart misses you!',body:name?`🎁 ${name} is still waiting in your cart. Complete your order before it sells out!`:`You have ${count} item${count===1?'':'s'} waiting in your cart.`};
  return {title:'🛍️ نسيت حاجة حلوة في سلتك!',body:name?`🎁 ${name} ما زال في سلتك. أكمل طلبك قبل نفاد الكمية!`:`لديك ${count} منتج في السلة بانتظارك.`};
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...cors(req),'Content-Type':'application/json'}});
  if(!access(req)) return new Response(JSON.stringify({error:'Scheduler authorization required'}),{status:401,headers:{...cors(req),'Content-Type':'application/json'}});
  try {
    const supabase=createClient(Deno.env.get('SUPABASE_URL')||'',getSupabaseSecretKey());
    const {data:rows,error}=await supabase.from('abandoned_carts').select('id,endpoint,user_email,user_phone,user_lang,cart_count,first_product_name,first_product_image,send_attempts').eq('status','pending').lte('scheduled_at',new Date().toISOString()).lt('send_attempts',3).order('scheduled_at',{ascending:true}).limit(100);
    if(error) throw error;
    if(!rows?.length) return new Response(JSON.stringify({sent:0,failed:0,due:0}),{headers:{...cors(req),'Content-Type':'application/json'}});
    const endpoints=[...new Set(rows.map((row)=>String(row.endpoint||'').trim()).filter(Boolean))];
    const {data:subscriptions,error:subscriptionsError}=await supabase.from('push_subscriptions').select('endpoint,user_id,user_email,user_phone,user_lang').in('endpoint',endpoints);
    if(subscriptionsError) throw subscriptionsError;
    const byEndpoint=new Map((subscriptions||[]).map((row)=>[String(row.endpoint||'').trim(),row]));
    let sent=0,failed=0;
    for(const row of rows) {
      const subscription=byEndpoint.get(String(row.endpoint||'').trim())||{};
      const target={user_id:subscription.user_id||null,user_email:row.user_email||subscription.user_email||null,user_phone:row.user_phone||subscription.user_phone||null};
      if(!target.user_id&&!target.user_email&&!target.user_phone) {
        failed++;
        await supabase.from('abandoned_carts').update({send_attempts:Number(row.send_attempts||0)+1,last_error:'missing customer identity',updated_at:new Date().toISOString()}).eq('id',row.id);
        continue;
      }
      const text=message({...row,user_lang:subscription.user_lang||row.user_lang});
      try {
        await dispatchNotification(supabase,{...target,title:text.title,body:text.body,type:'abandoned_cart',icon:'🛒',url:'/Cart',image:row.first_product_image||null});
        sent++;
        await supabase.from('abandoned_carts').update({status:'notified',notified_at:new Date().toISOString(),updated_at:new Date().toISOString(),last_error:''}).eq('id',row.id);
      } catch(error) {
        failed++;
        await supabase.from('abandoned_carts').update({send_attempts:Number(row.send_attempts||0)+1,last_error:String(error?.message||error).slice(0,400),updated_at:new Date().toISOString()}).eq('id',row.id);
      }
    }
    return new Response(JSON.stringify({sent,failed,due:rows.length}),{headers:{...cors(req),'Content-Type':'application/json'}});
  } catch(error) {
    return new Response(JSON.stringify({error:error?.message||String(error)}),{status:500,headers:{...cors(req),'Content-Type':'application/json'}});
  }
});
