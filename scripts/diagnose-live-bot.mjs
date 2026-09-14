import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../bot-training.html',import.meta.url),'utf8');
const key=html.match(/const ANON_KEY='([^']+)'/)?.[1];
const endpoint='https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/bot-llm';
let state={sessionId:'diagnose-known'},conversation=[];
for(const message of ['عايز 10 كوب شاي و 10 كوب قهوه','كم سعر كوب الشاي','عايز 10 كوب شاي و 10 كوب قهوه','عندكم هدايا مواليد']){
  const r=await fetch(endpoint,{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({message,conversation,context:{...state,current_state:state},rpc:true})});
  const d=await r.json();
  console.log(JSON.stringify({message,status:r.status,reply:d.reply,action:d.action,knowledge_id:d.knowledge_id,products:(d.products||[]).map(p=>({id:p.id,name:p.name_ar,price:p.price})),state:{lastUnitPrice:d.state?.lastUnitPrice,lastPriceProductName:d.state?.lastPriceProductName,currentTopic:d.state?.currentTopic}}));
  if(!r.ok)process.exitCode=1;
  state=d.state||state;conversation=d.conversation||conversation;
}
