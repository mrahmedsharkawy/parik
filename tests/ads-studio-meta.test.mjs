import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {metaConfiguration} from '../api/meta/status.js';

test('Meta status reports every missing OAuth server variable',()=>{
  const names=['META_APP_ID','META_APP_SECRET','META_REDIRECT_URI','META_TOKEN_ENCRYPTION_KEY'];
  const saved=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  try{
    names.forEach(name=>delete process.env[name]);
    assert.deepEqual(metaConfiguration(),{configured:false,missing:names});
    names.forEach(name=>process.env[name]='configured-for-test');
    assert.deepEqual(metaConfiguration(),{configured:true,missing:[]});
  }finally{
    names.forEach(name=>saved[name]===undefined?delete process.env[name]:process.env[name]=saved[name]);
  }
});

test('every Meta endpoint referenced by Ads Studio exists',()=>{
  const source=readFileSync(new URL('../java/ads-studio.js',import.meta.url),'utf8');
  const paths=[...source.matchAll(/["'`]\/api\/meta\/([a-z-]+)/g)].map(match=>match[1]);
  assert.ok(paths.length>0);
  for(const name of new Set(paths)){
    assert.equal(existsSync(new URL(`../api/meta/${name}.js`,import.meta.url)),true,`missing /api/meta/${name}`);
  }
});

test('OAuth requests the permissions used by campaigns and insights',()=>{
  const source=readFileSync(new URL('../api/meta/oauth-start.js',import.meta.url),'utf8');
  for(const permission of ['ads_management','ads_read','business_management','pages_show_list','pages_read_engagement','instagram_basic']){
    assert.match(source,new RegExp(permission));
  }
});
