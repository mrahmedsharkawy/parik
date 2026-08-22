// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const ALLOWED_ORIGINS = ['https://bariqgifts.com','https://www.bariqgifts.com','https://admin.bariqgifts.com'];
function cors(req){const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':ALLOWED_ORIGINS.includes(o)?o:ALLOWED_ORIGINS[0],'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};}
function trustedOrigin(req){const o=req.headers.get('origin')||'';if(ALLOWED_ORIGINS.includes(o))return true;const r=req.headers.get('referer')||'';return ALLOWED_ORIGINS.some(x=>r.startsWith(x+'/'));}
function token(req){const m=(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i);return m?m[1].trim():'';}
async function requireAdmin(req,sb){const t=token(req);if(!t)return false;const {data,error}=await sb.auth.getUser(t);const u=data?.user;if(error||!u)return false;let q=await sb.from('admins').select('id').eq('active',true).eq('user_id',u.id).maybeSingle();if(!q.error&&q.data)return true;q=await sb.from('admins').select('id').eq('active',true).eq('email',u.email||'').maybeSingle();return !q.error&&!!q.data;}
function publicAdminOrder(p){return p?.type==='admin_new_order'&&p?.user_email==='__bariq_admin_orders__@bariq.local'&&!p?.user_phone;}
function lang(v){return String(v||'').toLowerCase().startsWith('en')?'en':'ar';}
function orderText(status,orderId,l){const s=String(status||'processing').toLowerCase(),id=String(orderId||'').trim();const ar={pending:['⏳','طلبك قيد المراجعة','طلبك يُراجع الآن'],processing:['🔄','طلبك قيد المعالجة','جارٍ تجهيز طلبك'],confirmed:['✅','تم تأكيد طلبك','تم تأكيد طلبك وسيُجهز قريباً 🎉'],manufacturing:['🔨','طلبك في مرحلة التصنيع','طلبك يُصنع الآن بعناية ✨'],ready:['🎁','طلبك جاهز للاستلام','طلبك جاهز وبانتظارك 🎉'],shipped:['🚚','تم شحن طلبك','طلبك في الطريق إليك'],delivered:['✅','تم توصيل طلبك','طلبك وصل بنجاح 🎉'],cancelled:['❌','تم إلغاء طلبك','تم إلغاء طلبك'],returned:['↩️','تمت عملية الإرجاع','تمت معالجة إرجاع طلبك']};const en={pending:['⏳','Your order is under review','Your order is being reviewed'],processing:['🔄','Your order is being processed','We are preparing your order'],confirmed:['✅','Your order is confirmed','Your order has been confirmed 🎉'],manufacturing:['🔨','Your order is in production','Your order is being carefully made ✨'],ready:['🎁','Your order is ready','Your order is ready 🎉'],shipped:['🚚','Your order has shipped','Your order is on its way'],delivered:['✅','Your order was delivered','Your order was delivered successfully 🎉'],cancelled:['❌','Your order was cancelled','Your order was cancelled'],returned:['↩️','Return processed','Your return was processed']};const x=(l==='en'?en:ar)[s]||(l==='en'?en.processing:ar.processing);return {status:s,icon:x[0],title:`${x[0]} ${x[1]}`,body:`${x[2]}${id?(l==='en'?` #${id.replace(/^#/,'')}`:` رقم ${id}`):''}`};}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
 try{
  const p=await req.json();
  if(!p.title||!p.body)return new Response(JSON.stringify({error:'title and body required'}),{status:400,headers:{...cors(req),'Content-Type':'application/json'}});
  const VAPID_PRIVATE=String(Deno.env.get('VAPID_PRIVATE_KEY')||'').trim();
  const VAPID_PUBLIC=String(Deno.env.get('VAPID_PUBLIC_KEY')||'').trim();
  const VAPID_EMAIL=String(Deno.env.get('VAPID_EMAIL')||'mailto:admin@bariq.store').trim();
  if(!VAPID_PRIVATE||!VAPID_PUBLIC)return new Response(JSON.stringify({error:'Missing VAPID key'}),{status:500,headers:{...cors(req),'Content-Type':'application/json'}});
  webpush.setVapidDetails(VAPID_EMAIL,VAPID_PUBLIC,VAPID_PRIVATE);
  const sb=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'');
  const isPublic=publicAdminOrder(p);
  if(isPublic&&!trustedOrigin(req))return new Response(JSON.stringify({error:'Trusted origin required'}),{status:403,headers:{...cors(req),'Content-Type':'application/json'}});
  if(!isPublic&&!(await requireAdmin(req,sb)))return new Response(JSON.stringify({error:'Admin authorization required'}),{status:401,headers:{...cors(req),'Content-Type':'application/json'}});

  const fields='endpoint,p256dh,auth,user_lang,vapid_public_key';
  let subs=[];
  if(p.user_phone||p.user_email){const merged=[];if(p.user_phone){const digits=String(p.user_phone).replace(/\D/g,''),plus='+'+digits;for(const v of [p.user_phone,plus,digits]){const {data}=await sb.from('push_subscriptions').select(fields).eq('user_phone',v);merged.push(...(data||[]));}}if(p.user_email){const {data}=await sb.from('push_subscriptions').select(fields).eq('user_email',String(p.user_email).trim().toLowerCase());merged.push(...(data||[]));}const seen=new Set();subs=merged.filter(s=>s?.endpoint&&!seen.has(s.endpoint)&&seen.add(s.endpoint));}else{const {data,error}=await sb.from('push_subscriptions').select(fields);if(error)throw error;subs=data||[];}

  const beforeVapid=subs.length;
  subs=subs.filter(s=>String(s.vapid_public_key||'').trim()===VAPID_PUBLIC);
  const skippedLegacy=beforeVapid-subs.length;
  if(p.exclude_endpoint)subs=subs.filter(s=>s.endpoint!==p.exclude_endpoint);
  if(!subs.length)return new Response(JSON.stringify({sent:0,failed:0,total:0,skipped_legacy:skippedLegacy,message:'No current-VAPID subscribers'}),{headers:{...cors(req),'Content-Type':'application/json'}});

  const results=await Promise.allSettled(subs.map(async sub=>{
    const targetLang=lang(sub.user_lang||p.user_lang||p.lang);
    const sf=String(p.type||'').match(/^order_status_([a-z_]+)$/i)?.[1]||'';
    const ot=(p.type==='order_status'||p.status||sf)?orderText(p.status||sf,p.orderId||p.order_id,targetLang):null;
    const payload=JSON.stringify({
      title:ot?.title||(targetLang==='en'&&p.title_en?p.title_en:p.title),
      body:ot?.body||(targetLang==='en'&&p.body_en?p.body_en:p.body),
      url:p.url||'/',image:p.image||null,type:p.type||'general',status:ot?.status||p.status||null,
      iconText:ot?.icon||p.iconText||p.emoji||null,emoji:ot?.icon||p.iconText||p.emoji||null,
      orderId:p.orderId||p.order_id||null,order_id:p.order_id||p.orderId||null,lang:targetLang,
      customerName:p.customerName||p.customer_name||p.customer||null,customerPhone:p.customerPhone||p.customer_phone||p.phone||null,
      productName:p.productName||p.product_name||p.product||null,totalText:p.totalText||p.total_text||p.orderTotal||p.total||null,
      itemCount:p.itemCount||p.item_count||null,city:p.city||p.customerCity||p.customer_city||null,payment:p.payment||p.paymentMethod||p.payment_method||null
    });
    try{return await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload,{TTL:86400,urgency:'high'});}catch(err){const detail={statusCode:err?.statusCode||null,name:err?.name||null,message:err?.message||String(err),body:err?.body||null,endpointHost:(()=>{try{return new URL(sub.endpoint).host}catch{return null}})()};console.error('WEB_PUSH_DELIVERY_FAILED',detail);if(err?.statusCode===404||err?.statusCode===410)await sb.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);throw detail;}
  }));
  const failures=results.filter(r=>r.status==='rejected').map(r=>r.reason);
  const sent=results.filter(r=>r.status==='fulfilled').length;
  return new Response(JSON.stringify({sent,failed:failures.length,total:subs.length,skipped_legacy:skippedLegacy,failures}),{headers:{...cors(req),'Content-Type':'application/json'}});
 }catch(err){console.error('HYPER_API_FATAL',err);return new Response(JSON.stringify({error:err?.message||String(err)}),{status:500,headers:{...cors(req),'Content-Type':'application/json'}});}
});