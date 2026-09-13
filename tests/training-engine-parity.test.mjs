import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {trainingSource,generatedSource} from '../scripts/extract-training-engine.mjs';
import {trainingEnvironment} from '../supabase/functions/_shared/training-environment.mjs';
import {createTrainingEngine} from '../supabase/functions/_shared/training-engine.generated.mjs';

const knowledge = [
  [1,'انتو مين','بريق للهدايا متخصص في الهدايا المخصصة.'],
  [2,'عندكم توصيل','نعم، نوصل لجميع الإمارات.'],
  [3,'كم سعر كوب الشاي','سعر كوب الشاي 2 درهم للوحدة.'],
  [4,'كم سعر كوب القهوة','سعر كوب القهوة 3 درهم للوحدة.'],
  [5,'عندكم هدايا مواليد','متوفر هدايا مواليد حسب الطلب.'],
  [6,'عندكم هدايا تخرج','متوفر هدايا تخرج حسب الطلب.'],
].map(([id,question,answer])=>({id,question,answer,active:true,keywords:[],category:'عام',usage_count:0}));
const products=[{id:604,name_ar:'طقم مواليد أكريليك 10 قطع',price:590,active:true},
  {id:11,name_ar:'كوب الشاي',price:2,active:true},{id:12,name_ar:'كوب القهوة',price:3,active:true}];
const io=()=>({knowledge,products,state:{sessionId:'parity'},settings:{useLLM:false},llm:async()=>null,
  sbFetch:async path=>path.startsWith('orders?')?[{id:1,order_number:'#12345',status:'processing',total:40}]:[]});

// Execute the page's ORIGINAL inline script in a separate JS realm. Never mock
// processBotMessage, matching, actions, pricing or the expected answer.
function originalPage(input){
  const env=trainingEnvironment(input);
  const context=vm.createContext({...env,io:input,structuredClone,console,URL,URLSearchParams,AbortController,
    setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();return t;},clearTimeout,
    btoa,atob,encodeURIComponent,decodeURIComponent});
  const boundary=readFileSync(new URL('../supabase/functions/_shared/training-boundary.inc',import.meta.url),'utf8');
  return vm.runInContext(`(function(){${trainingSource()}\n${boundary}\n})()`,context);
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('generated engine has no drift from trained source',()=>assert.equal(
  readFileSync(new URL('../supabase/functions/_shared/training-engine.generated.mjs',import.meta.url),'utf8'),generatedSource()));

const sessions=[
  ['أهلا','انتو مين','عندكم توصيل'],
  ['كم سعر كوب الشاي','لو عايز 10','10 بكام','وكوب القهوة','عايز 5 كوب شاي و 3 كوب قهوة'],
  ['عندكم هدايا مواليد','كم سعر كوب الشاي','كم سعر كوب القهوة','عندكم هدايا تخرج'],
  ['فين طلبي','12345','عايز ألغي الطلب'],
  ['سؤال غير موجود عن مركبة فضائية','عندكم توصيل'],
  ['عايز هدية','تخرج','ميزانيتي 100'],
];
test('20 real page/engine turns, preserving state, decisions and final text',async()=>{
  let count=0;
  for(const messages of sessions){
    const page=originalPage(io());
    let engine=createTrainingEngine(io());
    for(const message of messages){
      const expected=await page.message(message);
      const actual=await engine.message(message);
      assert.deepEqual(plain(actual),plain(expected),message);
      // Simulate an Edge Function cold start, not just in-process memory.
      engine=createTrainingEngine({...io(),...engine.snapshot()});
      count++;
    }
  }
  assert.equal(count,20);
});
test('explicit tea price never selects newborn price',async()=>{
  const engine=createTrainingEngine(io());
  await engine.message('عندكم هدايا مواليد');
  const {result}=await engine.message('كم سعر كوب الشاي');
  assert.match(result.text,/2/);
  assert.doesNotMatch(result.text,/590|طقم مواليد/);
});
test('sessions cannot share pricing state',async()=>{
  const a=createTrainingEngine(io()),b=createTrainingEngine(io());
  await a.message('كم سعر كوب الشاي');
  assert.equal(b.snapshot().state.lastUnitPrice,null);
});
