import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../bot-admin.html',import.meta.url),'utf8');
const key=html.match(/const ANON_KEY='([^']+)'/)?.[1];
const endpoint='https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/bot-llm';
let state={sessionId:`product-switch-${Date.now()}`},conversation=[];
let last;
for(const message of ['شو سعر استاند دبل جلد 40 سم','تمام لو عايز 2','اه عايز 10 كوب شاي']){
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({message,conversation,context:{current_state:state},rpc:true})});
  last=await response.json();
  if(!response.ok)throw new Error(`${response.status} ${JSON.stringify(last)}`);
  state=last.state||state;conversation=last.conversation||conversation;
  console.log(JSON.stringify({message,reply:last.reply,action:last.action,cart:state.shoppingCart||[],engine_version:last.engine_version}));
}
if(!/كوب شاي/.test(last.reply||'')||!/10 × 2\.00 = 20\.00/.test(last.reply||'')||/10 × 170\.00/.test(last.reply||'')){
  throw new Error(`New product inherited the previous price: ${last.reply}`);
}
