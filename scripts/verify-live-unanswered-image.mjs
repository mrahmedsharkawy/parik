import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../bot-training.html',import.meta.url),'utf8');
const key=html.match(/const ANON_KEY='([^']+)'/)?.[1];
const endpoint='https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/bot-llm';
const headers={apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'};
async function ask(body){
  const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw new Error(`${response.status} ${JSON.stringify(data)}`);
  return data;
}

const unknown=await ask({message:'سؤال غير موجود عن مركبة فضائية',conversation:[],context:{channel:'whatsapp',current_state:{sessionId:'live-unanswered-check'}},rpc:true});
console.log(JSON.stringify({case:'unanswered',action:unknown.action,unanswered:unknown.unanswered,reply:unknown.reply,engine_version:unknown.engine_version}));
if(!unknown.unanswered||unknown.reply)throw new Error('Unknown WhatsApp question was not handled as silent unanswered');

const productResponse=await fetch('https://knleehjjejfeobcmpwnw.supabase.co/rest/v1/products?select=id,image&active=eq.true&image=not.is.null&limit=1',{headers:{apikey:key,authorization:`Bearer ${key}`}});
const [product]=await productResponse.json();
if(product?.image){
  const imageResponse=await fetch(product.image);
  const bytes=new Uint8Array(await imageResponse.arrayBuffer());
  const base64=Buffer.from(bytes).toString('base64');
  const mime=imageResponse.headers.get('content-type')||'image/jpeg';
  const image=await ask({message:'أريد نفس المنتج',image_url:`data:${mime};base64,${base64}`,conversation:[],context:{channel:'whatsapp',current_state:{sessionId:'live-image-check'}},rpc:true});
  console.log(JSON.stringify({case:'visual_image',source_product:product.id,action:image.action,matched:(image.products||[]).map(x=>x.id),reply:image.reply}));
}
