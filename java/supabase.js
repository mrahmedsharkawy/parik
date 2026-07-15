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
  if(!res.ok){
    const e = await res.text();
    // لو JWT انتهت صلاحيتها، امسح التوكن وأعِد المحاولة بالـ anon key
    if (res.status === 401 && e.includes('JWT expired') && typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('admin_token');
      // محاولة تجديد التوكن (لو الدالة موجودة في الأدمن)
      if (typeof refreshAdminToken === 'function') {
        const newTok = await refreshAdminToken();
        if (newTok) {
          return sbFetch(path, opts); // إعادة المحاولة بالتوكن الجديد
        }
      }
    }
    throw new Error('SB '+res.status+': '+e);
  }
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
    var customerName = order.customerName || '';
    var customerPhone = order.customerPhone || '';
    var customerEmail = order.customerEmail || '';
    if(order.customerPhone||order.customerName){
      try{
        var cr = await SupaCustomers.upsert({name:order.customerName,phone:order.customerPhone,email:order.customerEmail,city:(order.address||{}).city||'',address:order.address?((order.address.street||'')+' '+(order.address.building||'')).trim():''});
        customerId = cr&&cr[0]?cr[0].id:null;
      }catch(e){}
    }
    return sbFetch('orders',{method:'POST',body:JSON.stringify({order_number:order.id,customer_id:customerId,customer_name:customerName,customer_phone:customerPhone,customer_email:customerEmail,total:parseFloat(order.total)||0,status:order.status||'pending',payment_method:'whatsapp',payment_status:'unpaid',shipping_cost:0,notes:order.notes||null,items:order.items||[],cashback:order.cashback||5,cashback_status:order.cashbackStatus||'pending'})});
  },
  getAll: async function(){ 
    // جلب الطلبات بدون join - أبسط وأسرع
    return sbFetch('orders?select=*&order=created_at.desc&limit=500'); 
  },
  // آمنة للعميل (anon): تستدعي دالة RPC تعيد فقط طلبات هذا الرقم (بدون كشف بقية الجدول)
  getByPhone: async function(phone){
    try {
      return await sbFetch('rpc/get_orders_by_phone', {method:'POST', body: JSON.stringify({p_phone: phone})});
    } catch(e) {
      // fallback في حال عدم وجود الدالة بعد (قبل تنفيذ SQL) - يتطلب سياسة قراءة عامة
      console.warn('[Supabase] get_orders_by_phone RPC غير متاح، محاولة القراءة المباشرة:', e.message);
      return sbFetch('orders?customer_phone=eq.'+encodeURIComponent(phone)+'&order=created_at.desc&limit=200');
    }
  },
  // ملاحظة: هذه الدوال تحدّث بالـ order_number (نص الطلب مثل "#1002") وليس id الصف
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
      var pushedIds = JSON.parse(localStorage.getItem('x2_orders_synced')||'[]');
      var pushed=0;
      var changed=false;
      for(var i=0;i<local.length;i++){
        // تخطي الطلبات التي تم رفعها مسبقاً - يمنع التكرار عند كل تحميل صفحة
        if(local[i]._synced || pushedIds.indexOf(local[i].id)!==-1) continue;
        try{
          await SupaOrders.insert(Object.assign({},local[i],{customerName:local[i].customerName||profile.name||'',customerPhone:local[i].customerPhone||profile.phone||'',customerEmail:local[i].customerEmail||profile.email||''}));
          local[i]._synced = true;
          pushedIds.push(local[i].id);
          changed = true;
          pushed++;
        }catch(e){}
      }
      if(changed){
        localStorage.setItem('x2_orders', JSON.stringify(local));
        localStorage.setItem('x2_orders_synced', JSON.stringify(pushedIds));
      }
      if(pushed) console.warn('[Supabase] Pushed '+pushed+' orders');
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

/* === COUPONS (code, type, value, min_order, expiry, max_use, used_count, active) === */
const SupaCoupons = {
  getAll: async function(){ return sbFetch('coupons?order=created_at.desc'); },
  getActive: async function(){ return sbFetch('coupons?active=eq.true&order=created_at.desc'); },
  getByCode: async function(code){ 
    const r = await sbFetch('coupons?code=eq.'+encodeURIComponent(code.toUpperCase())+'&limit=1'); 
    return r&&r[0]?r[0]:null; 
  },
  insert: async function(c){
    return sbFetch('coupons',{method:'POST',body:JSON.stringify({
      code: (c.code||'').toUpperCase(),
      type: c.type||'percent',
      value: parseFloat(c.value)||0,
      min_order: parseFloat(c.minOrder)||0,
      expiry: c.expiry||null,
      max_use: parseInt(c.maxUse)||0,
      used_count: 0,
      active: c.active !== false
    })});
  },
  update: async function(id, d){ return sbFetch('coupons?id=eq.'+id,{method:'PATCH',body:JSON.stringify(d)}); },
  updateByCode: async function(code, d){ return sbFetch('coupons?code=eq.'+encodeURIComponent(code.toUpperCase()),{method:'PATCH',body:JSON.stringify(d)}); },
  remove: async function(id){ return sbFetch('coupons?id=eq.'+id,{method:'DELETE'}); },
  incrementUsage: async function(code){ 
    const c = await this.getByCode(code);
    if(c) return sbFetch('coupons?id=eq.'+c.id,{method:'PATCH',body:JSON.stringify({used_count: (c.used_count||0)+1})});
  }
};

/* === CAMPAIGNS (name, description, banner, start_date, end_date, discount, active) === */
const SupaCampaigns = {
  getAll: async function(){ return sbFetch('campaigns?order=created_at.desc'); },
  getActive: async function(){ 
    const now = new Date().toISOString();
    return sbFetch('campaigns?active=eq.true&or=(start_date.is.null,start_date.lte.'+now+')&or=(end_date.is.null,end_date.gte.'+now+')&order=created_at.desc'); 
  },
  insert: async function(c){
    return sbFetch('campaigns',{method:'POST',body:JSON.stringify({
      name: c.name||'',
      description: c.desc||c.description||'',
      banner: c.banner||'',
      start_date: c.start||c.start_date||null,
      end_date: c.end||c.end_date||null,
      discount: parseFloat(c.discount)||0,
      active: c.active !== false
    })});
  },
  update: async function(id, d){ return sbFetch('campaigns?id=eq.'+id,{method:'PATCH',body:JSON.stringify(d)}); },
  remove: async function(id){ return sbFetch('campaigns?id=eq.'+id,{method:'DELETE'}); }
};

/* === VISITORS (للإحصائيات) === */
const SupaVisitors = {
  getAll: async function(limit){ return sbFetch('visitors?order=visited_at.desc&limit='+(limit||500)); },
  getToday: async function(){
    const today = new Date().toISOString().slice(0,10);
    return sbFetch('visitors?visited_at=gte.'+today+'T00:00:00&order=visited_at.desc');
  },
  insert: async function(v){
    return sbFetch('visitors',{method:'POST',body:JSON.stringify({
      page: v.page||'/',
      ip: v.ip||'',
      country: v.country||'',
      city: v.city||'',
      user_agent: v.userAgent||navigator.userAgent||''
    })});
  },
  getStats: async function(){
    const all = await this.getAll(10000);
    const today = new Date().toDateString();
    const todayCount = (all||[]).filter(v => new Date(v.visited_at).toDateString() === today).length;
    return { total: (all||[]).length, today: todayCount, data: all||[] };
  }
};

/* === تحديث ORDERS بدوال إضافية === */
SupaOrders.update = async function(id, d){ return sbFetch('orders?id=eq.'+id,{method:'PATCH',body:JSON.stringify(d)}); };
SupaOrders.remove = async function(id){ return sbFetch('orders?id=eq.'+id,{method:'DELETE'}); };
SupaOrders.getById = async function(id){ const r = await sbFetch('orders?id=eq.'+id+'&limit=1'); return r&&r[0]?r[0]:null; };
SupaOrders.getByOrderNumber = async function(num){ const r = await sbFetch('orders?order_number=eq.'+encodeURIComponent(num)+'&limit=1'); return r&&r[0]?r[0]:null; };

/* === تحديث CUSTOMERS بدوال إضافية === */
SupaCustomers.update = async function(id, d){ return sbFetch('customers?id=eq.'+id,{method:'PATCH',body:JSON.stringify(d)}); };
SupaCustomers.block = async function(id){ return sbFetch('customers?id=eq.'+id,{method:'PATCH',body:JSON.stringify({blocked:true})}); };
SupaCustomers.unblock = async function(id){ return sbFetch('customers?id=eq.'+id,{method:'PATCH',body:JSON.stringify({blocked:false})}); };
SupaCustomers.getBlocked = async function(){ return sbFetch('customers?blocked=eq.true&order=created_at.desc'); };

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

window.Supabase = { 
  Orders: SupaOrders, 
  Customers: SupaCustomers, 
  Categories: SupaCategories, 
  Subcategories: SupaSubcategories, 
  Products: SupaProducts, 
  Settings: SupaSettings, 
  Sync: SupaSync, 
  Auth: SupaAuth, 
  Storage: SupaStorage,
  Coupons: SupaCoupons,
  Campaigns: SupaCampaigns,
  Visitors: SupaVisitors
};

window.addEventListener('load',function(){ setTimeout(function(){ SupaSync.loadSettings(); SupaSync.pushLocalOrders(); },2000); });