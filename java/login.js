  /* === Auth Logic === */
  const PROFILE_KEY = 'x2_profile';
  const _SB_URL = 'https://knleehjjejfeobcmpwnw.supabase.co';
  const _SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E';

  function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (i===0&&tab==='login')||(i===1&&tab==='register')));
    document.getElementById('form-login').classList.toggle('active', tab==='login');
    document.getElementById('form-register').classList.toggle('active', tab==='register');
    document.getElementById('auth-success').style.display = 'none';
    hideErrors();
  }

  function togglePass(id, el) {
    const inp = document.getElementById(id);
    if (inp.type === 'password') { inp.type = 'text'; el.textContent = '🙈'; }
    else { inp.type = 'password'; el.textContent = '👁'; }
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = 'block';
  }

  function normalizeUaePhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('00971')) digits = digits.slice(2);
    if (digits.startsWith('971')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
    digits = digits.slice(0, 9);
    return digits ? '+971' + digits : '';
  }

  function enforceUaePhoneInput(input) {
    if (!input) return;
    const phone = normalizeUaePhone(input.value);
    input.value = phone ? phone.replace('+971', '+971 ') : '+971 ';
  }

  async function waitForSbFetch() {
    if (window.sbFetch) return true;
    return await new Promise(resolve => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.sbFetch) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started > 4000) { clearInterval(timer); resolve(false); }
      }, 100);
    });
  }

  async function findExistingCustomer(email, phone) {
    const ready = await waitForSbFetch();
    if (!ready) return null;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = normalizeUaePhone(phone);
    const queries = [];
    if (cleanEmail) queries.push('customers?email=eq.' + encodeURIComponent(cleanEmail) + '&limit=1');
    if (cleanPhone) queries.push('customers?phone=eq.' + encodeURIComponent(cleanPhone) + '&limit=1');
    for (const query of queries) {
      try {
        const rows = await window.sbFetch(query);
        if (rows && rows[0]) return rows[0];
      } catch(e) {}
    }
    return null;
  }

  function customerProfileData(customer) {
    if (!customer) return {};
    const address = typeof customer.address === 'string'
      ? customer.address
      : [customer.city, customer.area, customer.street, customer.building].filter(Boolean).join(' ').trim();
    return {
      name: customer.full_name || customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: address || customer.city || '',
      city: customer.city || ''
    };
  }

  function orderProfileData(order) {
    if (!order) return {};
    return {
      name: order.customer_name || '',
      email: order.customer_email || '',
      phone: order.customer_phone || ''
    };
  }

  async function findLatestOrderByEmail(email) {
    if (!window.sbFetch) return null;
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return null;
    try {
      const rows = await window.sbFetch('orders?customer_email=eq.' + encodeURIComponent(cleanEmail) + '&order=created_at.desc&limit=1');
      return rows && rows[0] ? rows[0] : null;
    } catch(e) { return null; }
  }

  function readLocalUsers() {
    try { return JSON.parse(localStorage.getItem('x2_users') || '[]'); } catch(e) { return []; }
  }

  function rememberLocalUser(profile) {
    try {
      const users = readLocalUsers();
      const email = String(profile.email || '').trim().toLowerCase();
      const phone = normalizeUaePhone(profile.phone || '');
      const idx = users.findIndex(u => String(u.email || '').trim().toLowerCase() === email || normalizeUaePhone(u.phone || '') === phone);
      const row = { name: profile.name || '', email, phone, address: profile.address || '', date: new Date().toISOString() };
      if (idx >= 0) users[idx] = { ...users[idx], ...row };
      else users.push(row);
      users.forEach(user => { delete user.pass; delete user.password; });
      localStorage.setItem('x2_users', JSON.stringify(users));
    } catch(e) {}
  }

  function isDuplicateRegisterError(err) {
    const msg = String(err?.message || err?.error_description || err?.msg || '').toLowerCase();
    return msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already registered') || msg.includes('already exists') || msg.includes('duplicate_email') || msg.includes('duplicate_phone') || msg.includes('duplicate key');
  }

  function duplicateRegisterMessage(err) {
    const msg = String(err?.message || err?.error_description || err?.msg || '').toLowerCase();
    if (msg.includes('duplicate_email') || msg.includes('email')) return '❌ هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول.';
    if (msg.includes('duplicate_phone') || msg.includes('phone')) return '❌ رقم الهاتف مسجّل بالفعل. جرّب تسجيل الدخول.';
    return '❌ هذا البريد الإلكتروني أو رقم الهاتف مسجّل بالفعل. جرّب تسجيل الدخول.';
  }

  function isEmailRateLimitError(err) {
    const msg = String(err?.message || err?.error_description || err?.msg || err?.code || '').toLowerCase();
    return msg.includes('email rate limit') || msg.includes('rate limit') || msg.includes('over_email_send_rate_limit');
  }

  function buildProfile(data) {
    const prev = (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch(e) { return {}; } })();
    delete prev.password;
    const safeData = { ...data };
    delete safeData.password;
    const email = String(data.email || prev.email || '').trim().toLowerCase();
    const phone = normalizeUaePhone(data.phone || prev.phone || '');
    return { ...prev, ...safeData, email, phone, address: data.address || data.city || prev.address || '' };
  }

  function saveProfile(data) {
    const profile = buildProfile(data);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem('x2_logged', '1');
    syncCurrentPushSubscription(profile);
    return profile;
  }

  async function syncCurrentPushSubscription(profile) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    try {
      // The current push runtime owns subscription refresh and registration.
      // Re-run it after login so an existing iPhone Web Push endpoint is bound
      // immediately to the newly saved customer email and phone.
      if (typeof window.ensureBariqPush === 'function') {
        return !!(await window.ensureBariqPush(false));
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return false;
      const p256dh = sub.getKey('p256dh');
      const auth = sub.getKey('auth');
      const payload = {
        endpoint: sub.endpoint,
        p256dh: p256dh ? btoa(String.fromCharCode(...new Uint8Array(p256dh))) : '',
        auth: auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '',
        user_phone: normalizeUaePhone(profile.phone || ''),
        user_email: String(profile.email || '').trim().toLowerCase(),
        user_lang: (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar',
        created_at: new Date().toISOString()
      };
      const headers = { apikey: _SB_ANON, Authorization: 'Bearer ' + _SB_ANON, 'Content-Type': 'application/json' };
      const res = await fetch(_SB_URL + '/rest/v1/push_subscriptions', {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return true;
      const patch = await fetch(_SB_URL + '/rest/v1/push_subscriptions?endpoint=eq.' + encodeURIComponent(sub.endpoint), {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(payload)
      });
      return patch.ok;
    } catch(e) { return false; }
  }

  async function syncProfileToUserSync(profile, token) {
    const email = String(profile.email || '').trim().toLowerCase();
    const authToken = token || localStorage.getItem('x2_token') || '';
    if (!email || !authToken) return false;
    const payload = {
      name: profile.name || '',
      email,
      phone: normalizeUaePhone(profile.phone || ''),
      address: profile.address || profile.city || '',
      ts: Date.now()
    };
    const headers = { apikey: _SB_ANON, Authorization: 'Bearer ' + authToken, 'Content-Type': 'application/json' };
    try {
      const existing = await fetch(_SB_URL + '/rest/v1/user_sync?user_email=eq.' + encodeURIComponent(email) + '&data_type=eq.profile&select=id&limit=1', { headers });
      const rows = existing.ok ? await existing.json() : [];
      const body = JSON.stringify({ user_email: email, data_type: 'profile', data: payload, updated_at: new Date().toISOString() });
      const url = rows && rows[0]
        ? _SB_URL + '/rest/v1/user_sync?id=eq.' + rows[0].id
        : _SB_URL + '/rest/v1/user_sync';
      const res = await fetch(url, { method: rows && rows[0] ? 'PATCH' : 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body });
      return res.ok;
    } catch(e) { return false; }
  }

  async function getProfileSyncToken(email, pass, authData) {
    const existingToken = authData?.access_token || localStorage.getItem('x2_token') || '';
    if (existingToken) return existingToken;
    if (!email || !pass || !window.Supabase || !window.Supabase.Auth) return '';
    try {
      const loginData = await window.Supabase.Auth.signIn(email, pass);
      if (loginData?.access_token) localStorage.setItem('x2_token', loginData.access_token);
      return loginData?.access_token || '';
    } catch(e) { return ''; }
  }

  async function ensureCustomerSaved(profile) {
    const email = String(profile.email || '').trim().toLowerCase();
    const phone = normalizeUaePhone(profile.phone || '');
    const customer = { name: profile.name || '', email, phone, city: profile.address || '', address: profile.address || '' };
    if (!email && !phone) throw new Error('بيانات العميل غير مكتملة');
    const authToken = localStorage.getItem('x2_token') || _SB_ANON;
    const customerHeaders = { apikey: _SB_ANON, Authorization: 'Bearer ' + authToken, 'Content-Type': 'application/json', Prefer: 'return=representation' };

    const fetchCustomer = async (query) => {
      try {
        const rows = await window.sbFetch(query);
        return rows && rows[0] ? rows[0] : null;
      } catch(e) { return null; }
    };
    const emailRow = email ? await fetchCustomer('customers?email=eq.' + encodeURIComponent(email) + '&limit=1') : null;
    const phoneRow = phone ? await fetchCustomer('customers?phone=eq.' + encodeURIComponent(phone) + '&limit=1') : null;
    const rowsToUpdate = [emailRow, phoneRow].filter(Boolean).filter((row, idx, arr) => arr.findIndex(r => r.id === row.id) === idx);

    if (rowsToUpdate.length) {
      let lastSaved = rowsToUpdate[0];
      for (const row of rowsToUpdate) {
        const payload = {
          full_name: customer.name,
          city: customer.city,
          address: customer.address,
          active: true
        };
        if (!row.email || String(row.email).trim().toLowerCase() === email) payload.email = email;
        if (phone && (!row.phone || normalizeUaePhone(row.phone || '') === phone)) payload.phone = phone;
        const update = await fetch(_SB_URL + '/rest/v1/customers?id=eq.' + encodeURIComponent(row.id), {
          method: 'PATCH',
          headers: customerHeaders,
          body: JSON.stringify(payload)
        });
        if (update.ok) {
          const rows = await update.json().catch(() => []);
          lastSaved = rows && rows[0] ? rows[0] : row;
        }
      }
      return lastSaved;
    }

    const insertPayload = { full_name: customer.name, email, city: customer.city, address: customer.address, active: true };
    if (phone) insertPayload.phone = phone;
    const body = JSON.stringify(insertPayload);
    const res = await fetch(_SB_URL + '/rest/v1/customers', {
      method: 'POST',
      headers: customerHeaders,
      body
    });
    if (!res.ok && res.status !== 409) throw new Error('تعذر حفظ العميل في قاعدة البيانات');
    const saved = await findExistingCustomer(email, phone);
    if (!saved) throw new Error('تم إنشاء الحساب لكن لم يتم تأكيد حفظ العميل في قاعدة البيانات');
    return saved;
  }

  function hideErrors() {
    ['login-error','register-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.display = 'none'; el.textContent = ''; }
    });
  }

  function checkStrength(pass) {
    const fill = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');
    if (!pass) { fill.style.width = '0%'; label.textContent = ''; return; }
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    const levels = [
      { w:'25%', c:'#e53935', t:'ضعيفة' },
      { w:'50%', c:'#fb8c00', t:'مقبولة' },
      { w:'75%', c:'#fdd835', t:'جيدة' },
      { w:'100%', c:'#43a047', t:'قوية جداً' }
    ];
    const l = levels[Math.max(0, score-1)];
    fill.style.width = l.w;
    fill.style.background = l.c;
    label.textContent = 'قوة كلمة المرور: ' + l.t;
    label.style.color = l.c;
  }

  async function loginWithoutEmailConfirmation(email, pass) {
    return false;
  }

  async function loginExistingAccountAfterSignup(email, pass, fallback) {
    try {
      const data = await window.Supabase.Auth.signIn(email, pass);
      if (data?.access_token) localStorage.setItem('x2_token', data.access_token);
      const user = data.user || {};
      const meta = user.user_metadata || {};
      const cleanEmail = String(user.email || email || '').trim().toLowerCase();
      const existingCustomer = await findExistingCustomer(cleanEmail, fallback?.phone || meta.phone || '');
      const customerData = customerProfileData(existingCustomer);
      const profile = saveProfile({
        ...customerData,
        name: customerData.name || meta.full_name || fallback?.name || cleanEmail.split('@')[0],
        email: customerData.email || cleanEmail,
        phone: customerData.phone || normalizeUaePhone(meta.phone || fallback?.phone || ''),
        address: customerData.address || meta.address || fallback?.address || ''
      });
      rememberLocalUser(profile, pass);
      await ensureCustomerSaved(profile).catch(() => {});
      syncProfileToUserSync(profile, data.access_token).catch(()=>{});
      showSuccess('تم تسجيل الدخول بنجاح! 🎉', 'مرحباً ' + (profile.name || cleanEmail.split('@')[0]).split(' ')[0] + '! جارٍ تحويلك...');
      setTimeout(() => { window.location.href = 'account.html'; }, 1200);
      return true;
    } catch(e) {
      return false;
    }
  }

  async function doLogin() {
    hideErrors();
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;
    const btn   = document.querySelector('#form-login .auth-btn');

    if (!email) { showError('login-error', '⚠️ من فضلك أدخل البريد الإلكتروني'); return; }
    if (!pass)  { showError('login-error', '⚠️ من فضلك أدخل كلمة المرور'); return; }

    if (btn) { btn.disabled = true; btn.textContent = '⏳ جارٍ التحقق...'; }

    // محاولة تسجيل الدخول عبر Supabase Auth
    try {
      await new Promise(r => { if (window.Supabase) r(); else { const t = setInterval(() => { if (window.Supabase) { clearInterval(t); r(); } }, 100); setTimeout(() => { clearInterval(t); r(); }, 4000); } });

      const data = await window.Supabase.Auth.signIn(email, pass);
      if (data.access_token) localStorage.setItem('x2_token', data.access_token);
      const user = data.user || {};
      const meta = user.user_metadata || {};
      const name = meta.full_name || meta.name || email.split('@')[0];
      const latestOrder = await findLatestOrderByEmail(user.email || email);
      let existingCustomer = await findExistingCustomer(user.email || email, meta.phone || latestOrder?.customer_phone || '');
      let customerData = { ...orderProfileData(latestOrder), ...customerProfileData(existingCustomer) };
      const repairedPhone = normalizeUaePhone(meta.phone || customerData.phone || '');
      if (!existingCustomer && repairedPhone) {
        try {
          await window.Supabase.Customers.upsert({ name: customerData.name || name, email: user.email || customerData.email || email, phone: repairedPhone, city: meta.address || customerData.address || '', address: meta.address || customerData.address || '' });
          existingCustomer = await findExistingCustomer(user.email || email, repairedPhone);
          customerData = { ...customerData, ...customerProfileData(existingCustomer) };
        } catch(e) {}
      }

      // حفظ الجلسة مع دمج بيانات العميل المخزنة سابقاً في customers
      const profile = saveProfile({ ...customerData, name: customerData.name || name, email: user.email || customerData.email || email, phone: meta.phone || customerData.phone || repairedPhone || '', address: meta.address || customerData.address || '' });

      // مزامنة مع جدول customers
      try { await ensureCustomerSaved(profile); } catch(e) {}
      syncProfileToUserSync(profile, data.access_token).catch(()=>{});

      showSuccess('تم تسجيل الدخول بنجاح! 🎉', 'مرحباً ' + name.split(' ')[0] + '! جارٍ تحويلك...');
      setTimeout(() => { window.location.href = 'account.html'; }, 1200);

    } catch(supaErr) {
      const msg = supaErr.message || '';
      if (msg.includes('Invalid login') || msg.includes('invalid') || msg.includes('credentials')) {
        if (await loginWithoutEmailConfirmation(email, pass)) return;
        showError('login-error', '❌ البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else if (msg.includes('Email not confirmed')) {
        const existingCustomer = await findExistingCustomer(email, '');
        if (existingCustomer) {
          const customerData = customerProfileData(existingCustomer);
          const profile = saveProfile({
            ...customerData,
            name: customerData.name || email.split('@')[0],
            email: customerData.email || email,
            phone: customerData.phone || '',
            address: customerData.address || ''
          });
          rememberLocalUser(profile, pass);
          showSuccess('تم تسجيل الدخول بنجاح! 🎉', 'مرحباً ' + (profile.name || email.split('@')[0]).split(' ')[0] + '! جارٍ تحويلك...');
          setTimeout(() => { window.location.href = 'account.html'; }, 1200);
          return;
        }
        if (await loginWithoutEmailConfirmation(email, pass)) return;
        showError('login-error', '❌ البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول أو تواصل معنا لاستعادة الحساب.');
      } else {
        showError('login-error', '❌ ' + msg);
      }
      if (btn) { btn.disabled = false; btn.textContent = 'تسجيل الدخول'; }
    }
  }

  async function doRegister() {
    hideErrors();
    const fullName = document.getElementById('reg-fname').value.trim();
    const address = document.getElementById('reg-address').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const phoneInput = document.getElementById('reg-phone');
    const phone = normalizeUaePhone(phoneInput.value);
    const pass  = document.getElementById('reg-pass').value;
    const terms = document.getElementById('reg-terms').checked;

    if (!fullName) { showError('register-error', '⚠️ أدخل اسمك'); return; }
    if (!email)  { showError('register-error', '⚠️ أدخل البريد الإلكتروني'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { showError('register-error', '⚠️ البريد الإلكتروني غير صحيح'); return; }
    if (!phone)  { showError('register-error', '⚠️ أدخل رقم الهاتف'); return; }
    if (!/^\+971\d{8,9}$/.test(phone)) { showError('register-error', '⚠️ أدخل رقم إمارات صحيح بعد +971'); return; }
    if (pass.length < 6) { showError('register-error', '⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (!terms)  { showError('register-error', '⚠️ يجب الموافقة على الشروط والأحكام'); return; }
    phoneInput.value = phone.replace('+971', '+971 ');

    const fname = fullName.split(' ')[0];
    const btn = document.querySelector('#form-register .auth-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جارٍ إنشاء الحساب...'; }

    try {
      await new Promise(r => { if (window.Supabase) r(); else { const t = setInterval(() => { if (window.Supabase) { clearInterval(t); r(); } }, 100); setTimeout(() => { clearInterval(t); r(); }, 4000); } });

      const signupData = await window.Supabase.Auth.signUp(email, pass, { full_name: fullName, phone, address });
      if (signupData?.access_token) localStorage.setItem('x2_token', signupData.access_token);
      const signupUser = signupData?.user || signupData;
      if (!signupUser && !signupData?.access_token) throw new Error('تعذر إنشاء الحساب حالياً. حاول مرة أخرى بعد قليل.');
      if (signupUser && Array.isArray(signupUser.identities) && signupUser.identities.length === 0) {
        showError('register-error', '❌ هذا البريد الإلكتروني أو رقم الهاتف مسجّل بالفعل. جرّب تسجيل الدخول.');
        if (btn) { btn.disabled = false; btn.textContent = 'إنشاء حساب جديد'; }
        return;
      }

      // حفظ كل بيانات العميل في حسابه (localStorage) بعد التسجيل
      const profile = saveProfile({ name: fullName, email, phone, address });
      rememberLocalUser(profile, pass);

      // حفظ في customers أيضاً والتأكد أنه ظهر في قاعدة العملاء
      await ensureCustomerSaved(profile);
      const syncToken = await getProfileSyncToken(email, pass, signupData);
      syncProfileToUserSync(profile, syncToken).catch(()=>{});

      showSuccess('تم إنشاء حسابك! 🎉', 'مرحباً ' + fname + '! جارٍ تحويلك لحسابك...');
      setTimeout(() => { window.location.href = 'account.html'; }, 1200);

    } catch(err) {
      if (isEmailRateLimitError(err)) {
        const existingCustomer = await findExistingCustomer(email, phone);
        if (existingCustomer) {
          showError('register-error', '❌ هذا البريد الإلكتروني أو رقم الهاتف مسجّل بالفعل. جرّب تسجيل الدخول.');
          if (btn) { btn.disabled = false; btn.textContent = 'إنشاء حساب جديد'; }
          return;
        }
        const profile = buildProfile({ name: fullName, email, phone, address });
        try {
          await ensureCustomerSaved(profile);
        } catch(saveErr) {
          if (isDuplicateRegisterError(saveErr)) showError('register-error', duplicateRegisterMessage(saveErr));
          else showError('register-error', '❌ تعذر حفظ العميل في قاعدة البيانات. حاول مرة أخرى بعد قليل.');
          if (btn) { btn.disabled = false; btn.textContent = 'إنشاء حساب جديد'; }
          return;
        }
        const savedProfile = saveProfile(profile);
        rememberLocalUser(savedProfile, pass);
        showSuccess('تم إنشاء حسابك! 🎉', 'مرحباً ' + fname + '! جارٍ تحويلك لحسابك...');
        setTimeout(() => { window.location.href = 'account.html'; }, 1200);
        return;
      }

      if (isDuplicateRegisterError(err)) {
        showError('register-error', duplicateRegisterMessage(err));
        if (btn) { btn.disabled = false; btn.textContent = 'إنشاء حساب جديد'; }
        return;
      }

      const msg = err.message || '';
      if (isDuplicateRegisterError(err)) {
        showError('register-error', duplicateRegisterMessage(err));
      } else {
        showError('register-error', '❌ ' + msg);
      }
      if (btn) { btn.disabled = false; btn.textContent = 'إنشاء حساب'; }
    }
  }

  function showSuccess(title, msg) {
    document.getElementById('form-login').classList.remove('active');
    document.getElementById('form-register').classList.remove('active');
    document.getElementById('auth-success').style.display = 'block';
    document.getElementById('success-title').textContent = title;
    document.getElementById('success-msg').textContent = msg;
  }

  function showGoogleProfileModal(profile) {
    const modal = document.getElementById('google-profile-modal');
    const phoneInput = document.getElementById('google-profile-phone');
    const addressInput = document.getElementById('google-profile-address');
    const error = document.getElementById('google-profile-error');
    if (error) { error.textContent = ''; error.style.display = 'none'; }
    if (phoneInput) phoneInput.value = profile.phone ? formatUaePhoneInput(profile.phone) : '+971 ';
    if (addressInput) addressInput.value = profile.address || '';
    if (modal) modal.classList.add('active');
    setTimeout(() => { if (phoneInput) phoneInput.focus(); }, 80);
  }

  function formatUaePhoneInput(phone) {
    const normalized = normalizeUaePhone(phone);
    return normalized ? normalized.replace('+971', '+971 ') : '+971 ';
  }

  async function completeGoogleProfile() {
    const btn = document.getElementById('google-profile-save');
    const error = document.getElementById('google-profile-error');
    const phone = normalizeUaePhone(document.getElementById('google-profile-phone')?.value || '');
    const address = String(document.getElementById('google-profile-address')?.value || '').trim();
    if (error) { error.textContent = ''; error.style.display = 'none'; }
    if (!phone) { if (error) showError('google-profile-error', '⚠️ من فضلك أدخل رقم الهاتف'); return; }
    if (!address) { if (error) showError('google-profile-error', '⚠️ من فضلك أدخل العنوان'); return; }
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch(e) { profile = {}; }
    profile = buildProfile({ ...profile, phone, address, auth_provider: 'google' });
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الحفظ...'; }
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem('x2_logged', '1');
      await ensureCustomerSaved(profile);
      syncProfileToUserSync(profile).catch(()=>{});
      window.location.href = 'index.html';
    } catch(e) {
      if (error) showError('google-profile-error', '❌ تعذر حفظ البيانات. حاول مرة أخرى.');
      if (btn) { btn.disabled = false; btn.textContent = 'حفظ ومتابعة'; }
    }
  }

  function showForgot() {
    const email = document.getElementById('login-email').value.trim();
    if (!email) { showError('login-error', '⚠️ أدخل بريدك الإلكتروني أولاً ثم اضغط نسيت كلمة المرور'); return; }
    alert('📧 تم إرسال رابط إعادة تعيين كلمة المرور إلى: ' + email + '\n(ميزة قيد التطوير)');
  }

  function socialLogin(provider, mode) {
    const oauthMode = mode === 'signup' ? 'signup' : 'login';
    try {
      localStorage.setItem('x2_oauth_mode', oauthMode);
      if (oauthMode === 'signup') {
        localStorage.removeItem('x2_logged');
        localStorage.removeItem('x2_token');
        localStorage.removeItem('x2_refresh_token');
        localStorage.removeItem(PROFILE_KEY);
      }
    } catch(e) {}
    const redirectTo = 'https://bariqgifts.com/login.html?oauth_mode=' + encodeURIComponent(oauthMode);
    const oauthUrl = _SB_URL + '/auth/v1/authorize?provider=' + provider
      + '&redirect_to=' + encodeURIComponent(redirectTo)
      + (provider === 'google' ? '&prompt=select_account' : '');
    // فتح في متصفح خارجي لتجنب حجب Google للـ WebView
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      window.open(oauthUrl, '_blank');
    } else {
      window.location.href = oauthUrl;
    }
  }

  // معالجة رجوع OAuth (Google / Facebook)
  async function handleOAuthCallback() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken) return;
    const query = new URLSearchParams(window.location.search);
    const oauthMode = query.get('oauth_mode') || localStorage.getItem('x2_oauth_mode') || 'login';
    localStorage.removeItem('x2_oauth_mode');

    // إزالة الهاش من URL
    history.replaceState(null, '', window.location.pathname + window.location.search);

    try {
      const res = await fetch(_SB_URL + '/auth/v1/user', {
        headers: { apikey: _SB_ANON, Authorization: 'Bearer ' + accessToken }
      });
      if (!res.ok) throw new Error('auth failed');
      const user = await res.json();

      const meta = user.user_metadata || {};
      const fullName = meta.full_name || meta.name || user.email || '';
      const nameParts = fullName.trim().split(' ');
      const existingCustomer = await findExistingCustomer(user.email || '', '');
      const customerData = customerProfileData(existingCustomer);
      if (oauthMode === 'signup' && existingCustomer) {
        localStorage.removeItem('x2_token');
        localStorage.removeItem('x2_refresh_token');
        localStorage.removeItem('x2_logged');
        localStorage.removeItem(PROFILE_KEY);
        switchTab('register');
        showError('register-error', '❌ هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول بحساب Google.');
        return;
      }
      const profile = {
        ...customerData,
        fname: nameParts[0] || '',
        lname: nameParts.slice(1).join(' ') || '',
        name: customerData.name || fullName,
        email: customerData.email || user.email || '',
        phone: customerData.phone || meta.phone || '',
        address: customerData.address || '',
        avatar: meta.avatar_url || meta.picture || '',
        auth_provider: 'google'
      };

      localStorage.setItem('x2_token', accessToken);
      if (refreshToken) localStorage.setItem('x2_refresh_token', refreshToken);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem('x2_logged', '1');
      const needsProfileCompletion = !existingCustomer;
      if (needsProfileCompletion) {
        localStorage.removeItem('x2_goto_section');
        showGoogleProfileModal(profile);
        return;
      }
      try { await ensureCustomerSaved(profile); } catch(e) {}
      syncProfileToUserSync(profile, accessToken).catch(()=>{});
      showSuccess('مرحباً ' + (profile.fname || profile.name || '') + '!', 'تم تسجيل الدخول بنجاح.');
      setTimeout(() => { window.location.href = 'index.html'; }, 700);
    } catch (e) {
      showError('login-error', '❌ فشل تسجيل الدخول الاجتماعي. حاول مرة أخرى.');
    }
  }

  // معالجة رجوع OAuth أولاً
  const _hasOAuthCallback = window.location.hash && window.location.hash.includes('access_token');
  handleOAuthCallback();

  const regPhoneInput = document.getElementById('reg-phone');
  if (regPhoneInput) {
    regPhoneInput.addEventListener('focus', function(){ enforceUaePhoneInput(regPhoneInput); });
    regPhoneInput.addEventListener('input', function(){ enforceUaePhoneInput(regPhoneInput); });
    enforceUaePhoneInput(regPhoneInput);
  }

  // التحقق إذا كان مسجل دخول (تجاهل الفحص لو قادم من تسجيل الخروج)
  const _query = new URLSearchParams(window.location.search);
  const _fromLogout = _query.get('logout') === '1';
  const urlTab = _query.get('tab');
  if (!_fromLogout && !_hasOAuthCallback && urlTab !== 'register' && localStorage.getItem('x2_logged') === '1') {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    if (confirm('مرحباً ' + (p.name || '') + '! أنت مسجّل الدخول بالفعل.\nهل تريد الذهاب لحسابك؟')) {
      window.location.href = 'account.html';
    }
  }

  // فتح التبويب المطلوب من URL
  if (urlTab === 'register') switchTab('register');
