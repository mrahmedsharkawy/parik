import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../bot-admin.html',import.meta.url),'utf8');
const key=html.match(/const ANON_KEY='([^']+)'/)?.[1];
if(!key)throw new Error('Public key not found');

const endpoint='https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/bot-llm';
const messages=[
  'كم سعر كوب الشاي',
  'عايز 10',
  'وعايز كمان 10 كوب قهوة',
  'ضيف 2 هالو كارد اكريليك 18 سم',
  'وكمان 3 بوكس اكريليك 15x15 ارتفاع 5 سم',
  'تقدرون تسوون تصميم خاص؟',
  'طيب كنا وصلنا لكام؟',
  'زود الشاي 5 كمان',
  'فين طلبي القديم؟',
  'نرجع للطلب، الحساب كام؟'
];

let state={sessionId:`meta-sales-${Date.now()}`},conversation=[];
const rows=[];
for(const message of messages){
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},
    body:JSON.stringify({message,conversation,context:{current_state:state},rpc:true})
  });
  const data=await response.json();
  if(!response.ok)throw new Error(`${response.status} ${JSON.stringify(data)}`);
  state=data.state||state;
  conversation=data.conversation||conversation;
  rows.push({message,reply:data.reply,action:data.action,knowledge_id:data.knowledge_id,
    cart:state.shoppingCart||[],waiting_for:state.waitingFor||'',engine_version:data.engine_version});
}

const last=rows.at(-1),cart=last.cart;
if(cart.length!==4)throw new Error(`Expected 4 cart products, got ${cart.length}`);
if(!cart.some(x=>/شاي/.test(x.name)&&Number(x.qty)===15))throw new Error('Shorthand tea increase was not preserved');
if(!/225\.00/.test(last.reply||''))throw new Error(`Expected restored total 225.00, got: ${last.reply}`);
if(!['CART_SUMMARY','cart_summary'].includes(last.action))throw new Error(`Expected CART_SUMMARY, got ${last.action}`);
console.log(JSON.stringify(rows,null,2));
