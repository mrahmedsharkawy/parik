import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../bot-admin.html',import.meta.url),'utf8');
const key=html.match(/const ANON_KEY='([^']+)'/)?.[1];
if(!key)throw new Error('Public key not found');
const endpoint='https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/bot-llm';
let state={sessionId:'live-smoke'},conversation=[];
let engineVersion='';
for(const message of ['كم سعر كوب الشاي','لو عايز 10','10 بكام','كم سعر كوب القهوة','عايز 3']){
  const res=await fetch(endpoint,{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({message,conversation,context:{current_state:state},rpc:true})});
  const data=await res.json();
  if(!res.ok)throw new Error(`${res.status} ${JSON.stringify(data)}`);
  engineVersion=data.engine_version||engineVersion;
  console.log(JSON.stringify({message,reply:data.reply,action:data.action,knowledge_id:data.knowledge_id,unanswered:data.unanswered,products:(data.products||[]).map(x=>x.id),engine_version:data.engine_version}));
  state=data.state||state;conversation=data.conversation||conversation;
}
if(!/^bariq-v57-[a-f0-9]{12}$/.test(engineVersion))throw new Error('Canonical engine version missing');
const productRes=await fetch('https://knleehjjejfeobcmpwnw.supabase.co/rest/v1/products?select=id,image&active=eq.true&image=not.is.null&limit=1',{headers:{apikey:key,authorization:`Bearer ${key}`}});
const [product]=await productRes.json();
if(product?.image){
  const res=await fetch(endpoint,{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({message:'',image_url:product.image,conversation:[],context:{current_state:{sessionId:'image-smoke'}},rpc:true})});
  const data=await res.json();
  if(!res.ok)throw new Error(`${res.status} ${JSON.stringify(data)}`);
  console.log(JSON.stringify({message:'[exact product image]',action:data.action,products:(data.products||[]).map(x=>x.id),source_product:product.id}));
  if(!data.products?.some(x=>String(x.image||'').trim()===String(product.image).trim()))throw new Error('Exact image URL was not matched');
}
