import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../bot-training.html',import.meta.url),'utf8');
const key=html.match(/const ANON_KEY='([^']+)'/)?.[1];
const headers={apikey:key,authorization:`Bearer ${key}`};
const ar={newborn:'\u0645\u0648\u0627\u0644\u064a\u062f',cup:'\u0643\u0648\u0628',tea:'\u0627\u0644\u0634\u0627\u064a',coffee:'\u0627\u0644\u0642\u0647\u0648\u0629'};
const queries=[
  'id=eq.19285',
  `question=ilike.*${encodeURIComponent(ar.newborn)}*`,
  `or=(question.ilike.*${encodeURIComponent(ar.cup)}*${encodeURIComponent(ar.tea)}*,question.ilike.*${encodeURIComponent(ar.cup)}*${encodeURIComponent(ar.coffee)}*)`
];

for(const query of queries){
  const url='https://knleehjjejfeobcmpwnw.supabase.co/rest/v1/bot_knowledge?select=id,question,category,keywords,input_type,action_name,action_value,active&active=eq.true&'+query+'&limit=8';
  const response=await fetch(url,{headers});
  const rows=await response.json();
  console.log(JSON.stringify({status:response.status,count:Array.isArray(rows)?rows.length:null,rows}));
}
