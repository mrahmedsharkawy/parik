/**
 * supabase.js - Bariq Store Supabase Client
 * Tables: customers, orders, admins, settings, categories, subcategories, products
 */

const SUPABASE_URL  = 'https://knleehjjejfeobcmpwnw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E';

async function sbFetch(path, opts){
  opts = opts || {};
  // استخدم JWT الأدمن لو مسجّل دخول، وإلا استخدم الـ anon key
  const adminToken = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_token')) || SUPABASE_ANON;
  const res = await fetch(SUPABASE_URL+'/rest/v1/'+path, Object.assign({}, opts, {
    headers: Object.assign({
      'apikey': SUPABASE_ANON,
      'Authorization': 'Bearer '+adminToken,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation'
    }, opts.extraHeaders||{})
  }));
  if(!res.ok){ const e=await res.text(); throw new Error('SB '+res.status+': '+e); }
  const t=await res.text(); return t?JSON.parse(t):null;
}
window.sbFetch = sbFetch;

/* === CUSTOMERS === */
const SupaCustomers = {
  upsert: async function(c){
    if(c.phone){
      const rows = await sbFetch('customers?phone=eq.'+encodeURIComponent(c.phone)+'&limit=1').catch(function(){return[];});
      if(rows&&rows[0]) return sbFetch('customers?id=eq.'+rows[0].id,{method:'PATCH',body:JSON.stringify({full_name:c.name||rows[0].full_name,email:c.email||rows[0].email})});
    }
    return sbFetch('customers',{method:'POST',body:JSON.stringify({full_name:c.name||'',email:c.email||'',phone:c.phone||'',country:c.country||'',city:c.city||'',address:c.address||'',active:true})});
  },
  getAll: async function(){ return sbFetch('customers?order=created_at.desc'); },
  getByPhone: async function(phone){ return sbFetch('customers?phone=eq.'+encodeURIComponent(phone)+'&limit=1'); }
};

/* === ORDERS (order_number, customer_id, total, status, payment_method, payment_status, shipping_cost, notes, items, cashback, cashback_status) === */
const SupaOrders = {
  insert: async function(order){
    var customerId = null;
    if(order.customerPhone||order.customerName){
      try{
        var cr = await SupaCustomers.upsert({name:order.customerName,phone:order.customerPhone,email:order.customerEmail,city:(order.address||{}).city||'',address:order.address?((order.address.street||'')+' '+(order.address.building||'')).trim():''});
        customerId = cr&&cr[0]?cr[0].id:null;
      }catch(e){}
    }
    return sbFetch('orders',{method:'POST',body:JSON.stringify({order_number:order.id,customer_id:customerId,total:parseFloat(order.total)||0,status:order.status||'pending',payment_method:'whatsapp',payment_status:'unpaid',shipping_cost:0,notes:order.notes||null,items:order.items||[],cashback:order.cashback||5,cashback_status:order.cashbackStatus||'pending'})});
  },
  getAll: async function(){ return sbFetch('orders?order=created_at.desc&limit=200'); },
  updateStatus: async function(orderNum,status){ return sbFetch('orders?order_number=eq.'+encodeURIComponent(orderNum),{method:'PATCH',body:JSON.stringify({status:status})}); },
  updateCashback: async function(orderNum,cbStatus){ return sbFetch('orders?order_number=eq.'+encodeURIComponent(orderNum),{method:'PATCH',body:JSON.stringify({cashback_status:cbStatus})}); }
};

/* === SETTINGS (site_name, logo, whatsapp, currency, language) === */
const SupaSettings = {
  get: async function(){ var r=await sbFetch('settings?limit=1').catch(function(){return[];}); return r&&r[0]?r[0]:{}; },
  save: async function(obj){
    var cur=await this.get();
    if(cur.id) return sbFetch('settings?id=eq.'+cur.id,{method:'PATCH',body:JSON.stringify(obj)});
    return sbFetch('settings',{method:'POST',body:JSON.stringify(Object.assign({site_name:'Bariq',currency:'AED',language:'ar'},obj))});
  }
};

/* === CATEGORIES (name_ar, name_en, image, icon, active, sort_order) === */
const SupaCategories = {
  getAll: async function(){ return sbFetch('categories?active=eq.true&order=sort_order.asc'); },
  insert: async function(c){ return sbFetch('categories',{method:'POST',body:JSON.stringify({name_ar:c.nameAr,name_en:c.nameEn||c.nameAr,image:c.image||'',icon:c.icon||'',sort_order:c.order||0,active:true})}); },
  update: async function(id,d){ return sbFetch('categories?id=eq.'+id,{method:'PATCH',body:JSON.stringify(d)}); },
  remove: async function(id){ return sbFetch('categories?id=eq.'+id,{method:'PATCH',body:JSON.stringify({active:false})}); }
};

/* === SUBCATEGORIES (category_id, name_ar, name_en, image, active, sort_order) === */
const SupaSubcategories = {
  getAll: async function(){ return sbFetch('subcategories?active=eq.true&order=sort_order.asc'); },
  getByCategory: async function(catId){ return sbFetch('subcategories?category_id=eq.'+catId+'&active=eq.true&order=sort_order.asc'); },
  insert: async function(s){ return sbFetch('subcategories',{method:'POST',body:JSON.stringify({category_id:s.categoryId,name_ar:s.nameAr,name_en:s.nameEn||s.nameAr,image:s.image||'',sort_order:s.order||0,active:true})}); }
};

/* === PRODUCTS (name_ar, name_en, desc, category_id, subcategory_id, price, old_price, stock, image, gallery, categories, rating, featured, active, sort_order, timer_end) === */
const SupaProducts = {
  getAll: async function(limit){ return sbFetch('products?active=eq.true&order=sort_order.asc&limit='+(limit||500)); },
  getFeatured: async function(){ return sbFetch('products?featured=eq.true&active=eq.true&order=sort_order.asc'); },
  getByCategory: async function(catId){ return sbFetch('products?category_id=eq.'+catId+'&active=eq.true&order=sort_order.asc'); },
  getById: async function(id){ var r=await sbFetch('products?id=eq.'+id+'&limit=1'); return r&&r[0]?r[0]:null; },
  insert: async function(p){
    var name = p.name&&typeof p.name==='object'?p.name:{ar:p.name||'',en:p.name||''};
    var desc = p.desc&&typeof p.desc==='object'?p.desc:{ar:p.desc||'',en:p.desc||''};
    var cats = Array.isArray(p.category)?p.category:(p.category?[p.category]:[]);
    var imgs = Array.isArray(p.img)?p.img.filter(function(s){return s&&!s.startsWith('data:');}):[];
    return sbFetch('products',{method:'POST',body:JSON.stringify({name_ar:name.ar,name_en:name.en,description_ar:desc.ar,description_en:desc.en,category_id:p.categoryId||null,subcategory_id:p.subcategoryId||null,price:parseFloat(p.price)||0,old_price:parseFloat(p.oldPrice)||0,stock:parseInt(p.stock)||0,image:imgs[0]||'',gallery:imgs,categories:cats,rating:parseFloat(p.rating)||5,featured:p.featured||false,active:true,sort_order:p.sort||0,timer_end:p.timerEnd||null})});
  },
  update: async function(id,d){ return sbFetch('products?id=eq.'+id,{method:'PATCH',body:JSON.stringify(d)}); },
  remove: async function(id){ return sbFetch('products?id=eq.'+id,{method:'PATCH',body:JSON.stringify({active:false})}); }
};

/* === SYNC === */
const SupaSync = {
  pushLocalOrders: async function(){
    try{
      var local=JSON.parse(localStorage.getItem('x2_orders')||'[]');
      var profile=JSON.parse(localStorage.getItem('x2_profile')||'{}');
      var pushed=0;
      for(var i=0;i<local.length;i++){
        try{ await SupaOrders.insert(Object.assign({},local[i],{customerName:local[i].customerName||profile.name||'',customerPhone:local[i].customerPhone||profile.phone||'',customerEmail:local[i].customerEmail||profile.email||''})); pushed++; }catch(e){}
      }
      if(pushed) console.log('[Supabase] Pushed '+pushed+' orders');
    }catch(e){ console.warn('[Supabase]',e.message); }
  },
  pullOrders: async function(){
    try{
      var remote=await SupaOrders.getAll();
      if(!remote||!remote.length) return null;
      var local=remote.map(function(r){return{id:r.order_number||String(r.id),date:r.created_at,items:r.items||[],total:r.total,status:r.status,cashback:r.cashback||5,cashbackStatus:r.cashback_status||'pending'};});
      localStorage.setItem('x2_orders',JSON.stringify(local));
      return local;
    }catch(e){ console.warn('[Supabase]',e.message); return null; }
  },
  loadSettings: async function(){
    try{
      var s=await SupaSettings.get();
      if(s.whatsapp) localStorage.setItem('x2_wa_phone',s.whatsapp);
      if(s.currency)  localStorage.setItem('currency',s.currency);
      if(s.language)  localStorage.setItem('lang',s.language);
      return s;
    }catch(e){ return {}; }
  }
};

/* === AUTH (Supabase Auth REST) === */
const SupaAuth = {
  signIn: async function(email, password) {
    const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Login failed');
    return data; // { access_token, user, ... }
  },
  signOut: async function(token) {
    await fetch(SUPABASE_URL + '/auth/v1/logout', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + (token || SUPABASE_ANON) }
    }).catch(function(){});
  },
  getAdmin: async function(userId, token) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/admins?user_id=eq.' + userId + '&active=eq.true&limit=1', {
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + (token || SUPABASE_ANON) }
    });
    const rows = await res.json();
    return rows && rows[0] ? rows[0] : null;
  }
};

/* === STORAGE (رفع الصور والملفات إلى Supabase Storage) === */
const BUCKET_NAME = 'products';
const SupaStorage = {
  /**
   * يرفع ملف (File أو Blob) إلى Supabase Storage ويرجع رابط URL عام قابل للاستخدام مباشرة
   */
  upload: async function(file, folder) {
    const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : (file.type.split('/')[1] || 'jpg');
    const safeName = Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.' + ext;
    const path = (folder ? folder + '/' : '') + safeName;

    const res = await fetch(SUPABASE_URL + '/storage/v1/object/' + BUCKET_NAME + '/' + path, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + ((typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_token')) || SUPABASE_ANON),
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error('فشل رفع الملف: ' + errText);
    }

    // رابط الوصول العام للملف
    return SUPABASE_URL + '/storage/v1/object/public/' + BUCKET_NAME + '/' + path;
  },
  /**
   * تحويل dataURL (base64) إلى Blob ثم رفعه
   */
  uploadDataUrl: async function(dataUrl, folder) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const isVideo = dataUrl.startsWith('data:video');
    const fakeFile = new File([blob], (isVideo ? 'video' : 'image') + '.' + (blob.type.split('/')[1] || 'jpg'), { type: blob.type });
    return SupaStorage.upload(fakeFile, folder);
  }
};

window.Supabase = { Orders:SupaOrders, Customers:SupaCustomers, Categories:SupaCategories, Subcategories:SupaSubcategories, Products:SupaProducts, Settings:SupaSettings, Sync:SupaSync, Auth:SupaAuth, Storage:SupaStorage };

window.addEventListener('load',function(){ setTimeout(function(){ SupaSync.loadSettings(); SupaSync.pushLocalOrders(); },2000); });