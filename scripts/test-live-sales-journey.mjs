import {readFileSync} from 'node:fs';
import {createTrainingEngine,BOT_ENGINE_VERSION} from '../supabase/functions/_shared/training-engine.generated.mjs';

const html=readFileSync(new URL('../bot-admin.html',import.meta.url),'utf8');
const key=html.match(/const ANON_KEY='([^']+)'/)?.[1];
const base='https://knleehjjejfeobcmpwnw.supabase.co/rest/v1/';
const headers={apikey:key,authorization:`Bearer ${key}`};
async function all(table,select,tail=''){
  const out=[];
  for(let offset=0;;offset+=500){
    const response=await fetch(`${base}${table}?select=${encodeURIComponent(select)}&limit=500&offset=${offset}${tail}`,{headers});
    if(!response.ok)throw new Error(`${table} ${response.status}`);
    const rows=await response.json();out.push(...rows);if(rows.length<500)break;
  }
  return out;
}
const [knowledge,products,categories,subcategories]=await Promise.all([
  all('bot_knowledge','*','&active=eq.true&order=id.desc'),
  all('products','*','&active=eq.true&order=sort_order.asc'),
  all('categories','*','&active=eq.true&order=sort_order.asc'),
  all('subcategories','*','&active=eq.true&order=sort_order.asc')
]);
const engine=createTrainingEngine({knowledge,products,categories,subcategories,state:{sessionId:'sales-journey-live-data'},settings:{useLLM:false},sbFetch:async()=>[]});
const turns=[
  'السلام عليكم',
  'كم سعر كوب الشاي',
  'عايز 10',
  'وعايز كمان 10 كوب قهوة',
  'ضيف 2 هالو كارد اكريليك 18 سم',
  'وكمان 3 بوكس اكريليك 15x15 ارتفاع 5 سم',
  'بالمناسبة عندكم توصيل لدبي؟',
  'طيب كنا وصلنا لكام؟',
  'زود الشاي 5 كمان',
  'وريني فئة هدايا التخرج',
  'ارجع للطلب، الإجمالي بقى كام؟',
  'ثبت الطلب'
];
console.log(JSON.stringify({engine_version:BOT_ENGINE_VERSION,knowledge:knowledge.length,products:products.length,categories:categories.length,subcategories:subcategories.length}));
for(const message of turns){
  const output=await engine.message(message),result=output.result||{},state=output.state||{};
  console.log(JSON.stringify({message,reply:result.text||'',action:result.systemAction||result.type||'',knowledge_id:result.knowledgeId||result.match?.id||null,cart:state.shoppingCart||state.draftOrder?.items||[],waiting_for:state.waitingFor||'',topic:state.currentTopic||''}));
}
