(function(){
'use strict';
if(window.__bariqAbandonedCartV4)return;
window.__bariqAbandonedCartV4=true;

var ANON_KEY='sb_publishable_VPSO9nbXg5eVNMj03KpgdA_VSOuMDHw';
var API='https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/abandoned-cart-sync';
var timer=0,lastKey='',lastAt=0;

function j(k,f){try{var r=localStorage.getItem(k);return r?JSON.parse(r):f}catch(e){return f}}
function cart(){var x=j('x2_cart',[]);return Array.isArray(x)?x.filter(Boolean):[]}
function lng(){return (localStorage.getItem('lang')||document.documentElement.lang||'ar')==='en'?'en':'ar'}
function ph(v){var d=String(v||'').replace(/\D/g,'');if(d.indexOf('00971')===0)d=d.slice(2);if(d.indexOf('971')===0)d=d.slice(3);if(d.indexOf('0')===0)d=d.slice(1);d=d.slice(0,9);return d?'+971'+d:''}
function nm(i){var v=i&&(i.name||i.title||i.productName||i.nameAr||i.arName);if(v&&typeof v==='object')v=v[lng()]||v.ar||v.en||'';return String(v||'').trim().slice(0,120)}
function img(i){var v=i&&(i.img||i.image||i.photo||i.thumbnail||i.cover||i.imageUrl);if(Array.isArray(v))v=v[0];return String(v||'').trim().slice(0,600)}
function qty(i){return Math.max(1,Number(i&&(i.qty||i.quantity||i.count))||1)}
function price(i){var r=i&&(i.priceValue||i.priceCurrent||i.price||i.salePrice||i.finalPrice||0);if(typeof r==='string')r=r.replace(/[^\d.\-]/g,'');return Math.max(0,Number(r)||0)}
function summary(a){var c=0,t=0,h=[];a.forEach(function(i){var q=qty(i),p=price(i);c+=q;t+=q*p;h.push([i.id||i.productId||i.sku||nm(i),q,p].join(':'))});var f=a[0]||{};return{count:c,total:Math.round(t*100)/100,firstName:nm(f),firstImage:img(f),hash:h.join('|')}}
async function sub(){if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)||Notification.permission!=='granted')return null;try{var r=await navigator.serviceWorker.ready;return await r.pushManager.getSubscription()}catch(e){return null}}
async function send(body){var r=await fetch(API,{method:'POST',headers:{apikey:ANON_KEY,Authorization:'Bearer '+ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)}),txt=await r.text();if(!r.ok){console.warn('[BARIQ_CART] sync',r.status,txt);throw new Error(txt)}return txt}
async function sync(){
 var s=await sub();if(!s||!s.endpoint)return;
 var a=cart(),p=j('x2_profile',{});
 if(!a.length){lastKey='';try{await send({endpoint:s.endpoint,clear:true,cart_count:0})}catch(e){}return}
 var x=summary(a),key=s.endpoint+'|'+x.hash+'|'+x.count,now=Date.now();if(key===lastKey&&now-lastAt<30000)return;
 try{await send({endpoint:s.endpoint,user_phone:ph(p.phone||''),user_email:String(p.email||p.authEmail||'').trim().toLowerCase(),user_lang:lng(),cart_count:x.count,cart_total:x.total,cart_currency:localStorage.getItem('currency')||'AED',first_product_name:x.firstName,first_product_image:x.firstImage,cart_hash:x.hash,delay_minutes:45});lastKey=key;lastAt=now;console.log('[BARIQ_CART] queued',x.count)}catch(e){}
}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,600)}
['cart:updated','cart:persisted','x2:cart-updated'].forEach(function(ev){window.addEventListener(ev,schedule)});
window.addEventListener('pageshow',schedule);window.addEventListener('focus',schedule);window.addEventListener('storage',function(e){if(!e.key||e.key==='x2_cart'||e.key==='x2_profile')schedule()});
document.addEventListener('visibilitychange',schedule);
document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('[data-add-to-cart],.add-to-cart,.add-cart-btn,#addToCartBtn'))setTimeout(schedule,350)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
setTimeout(schedule,1500);
window.BariqAbandonedCart={sync:sync};
})();