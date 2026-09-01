// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseSecretKey } from '../_shared/supabase_keys.ts';
const ALLOWED=['https://bariqgifts.com','https://www.bariqgifts.com','https://admin.bariqgifts.com'];
function cors(req){const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':ALLOWED.includes(o)?o:ALLOWED[0],'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};}
function allowed(req){const o=req.headers.get('origin')||'';const r=req.headers.get('referer')||'';return !o || ALLOWED.includes(o) || ALLOWED.some(x=>r.startsWith(x+'/'));}
function phone(v){let d=String(v||'').replace(/\D/g,'');if(d.startsWith('00971'))d=d.slice(2);if(d.startsWith('971'))d=d.slice(3);if(d.startsWith('0'))d=d.slice(1);d=d.slice(0,9);return d?'+971'+d:'';}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
 if(req.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...cors(req),'Content-Type':'application/json'}});
 if(!allowed(req))return new Response(JSON.stringify({error:'Origin not allowed'}),{status:403,headers:{...cors(req),'Content-Type':'application/json'}});
 try{
  const body=await req.json(); const endpoint=String(body.endpoint||'').trim();
  if(!endpoint)return new Response(JSON.stringify({error:'endpoint required'}),{status:400,headers:{...cors(req),'Content-Type':'application/json'}});
  const sb=createClient(Deno.env.get('SUPABASE_URL')??'',getSupabaseSecretKey());
  const currentVapid=String(Deno.env.get('VAPID_PUBLIC_KEY')||'').trim();
  const {data:sub,error:subErr}=await sb.from('push_subscriptions').select('endpoint,vapid_public_key,user_phone,user_email,user_lang,user_id').eq('endpoint',endpoint).maybeSingle();
  if(subErr)throw subErr;
  if(!sub)return new Response(JSON.stringify({error:'subscription not found'}),{status:409,headers:{...cors(req),'Content-Type':'application/json'}});
  if(currentVapid&&String(sub.vapid_public_key||'').trim()!==currentVapid)return new Response(JSON.stringify({error:'legacy subscription'}),{status:409,headers:{...cors(req),'Content-Type':'application/json'}});
  if(body.clear===true||Number(body.cart_count||0)<=0){
    const {error}=await sb.from('abandoned_carts').upsert({endpoint,status:'cleared',updated_at:new Date().toISOString(),last_error:''},{onConflict:'endpoint'}); if(error)throw error;
    return new Response(JSON.stringify({ok:true,cleared:true}),{headers:{...cors(req),'Content-Type':'application/json'}});
  }
  const now=Date.now(),delay=Math.max(5,Math.min(1440,Number(body.delay_minutes||45)||45));
  const row={endpoint,user_phone:phone(body.user_phone||sub.user_phone||''),user_email:String(body.user_email||sub.user_email||'').trim().toLowerCase(),user_lang:String(body.user_lang||sub.user_lang||'ar').toLowerCase().startsWith('en')?'en':'ar',cart_count:Math.max(1,Number(body.cart_count)||1),cart_total:Math.max(0,Number(body.cart_total)||0),cart_currency:String(body.cart_currency||'AED').slice(0,8),first_product_name:String(body.first_product_name||'').slice(0,120),first_product_image:String(body.first_product_image||'').slice(0,600),cart_hash:String(body.cart_hash||'').slice(0,1000),status:'pending',scheduled_at:new Date(now+delay*60000).toISOString(),last_cart_at:new Date(now).toISOString(),notified_at:null,send_attempts:0,last_error:'',updated_at:new Date(now).toISOString()};
  const {error}=await sb.from('abandoned_carts').upsert(row,{onConflict:'endpoint'}); if(error)throw error;
  return new Response(JSON.stringify({ok:true,saved:true,scheduled_at:row.scheduled_at}),{headers:{...cors(req),'Content-Type':'application/json'}});
 }catch(err){console.error('ABANDONED_CART_SYNC_FAILED',err);return new Response(JSON.stringify({error:err?.message||String(err)}),{status:500,headers:{...cors(req),'Content-Type':'application/json'}})}
});
