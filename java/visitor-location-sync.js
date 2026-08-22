(function () {
  'use strict';

  var SUPABASE_URL = window.SUPABASE_URL || 'https://knleehjjejfeobcmpwnw.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E';
  var TRACK_API = SUPABASE_URL + '/functions/v1/visitor-track';

  function isAdminPage() {
    return /(?:^|\/)(?:admin|admin-reports)(?:\.html)?(?:$|[?#])/i.test(location.pathname + location.search);
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================
  // 1) Visitor location sync
  // =========================
  function currentPageKey() {
    return (location.pathname.split('/').pop() || 'index.html') + (location.search || '');
  }

  function guessSource() {
    try {
      var p = new URLSearchParams(location.search);
      return p.get('utm_source') || p.get('source') || '';
    } catch (_) {
      return '';
    }
  }

  async function syncVisitorLocation() {
    if (isAdminPage()) return false;

    var page = currentPageKey();
    var body = {
      page: page,
      referrer: document.referrer || '',
      source: guessSource(),
      utm_source: (function () {
        try { return new URLSearchParams(location.search).get('utm_source') || ''; }
        catch (_) { return ''; }
      })()
    };

    try {
      var res = await fetch(TRACK_API, {
        method: 'POST',
        headers: {
          apikey: ANON,
          Authorization: 'Bearer ' + ANON,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        keepalive: true,
        cache: 'no-store'
      });

      if (!res.ok) {
        console.warn('[BARIQ_VISITOR] visitor-track failed', res.status);
        return false;
      }

      var data = await res.json().catch(function () { return {}; });
      if (data && (data.city || data.country)) {
        try {
          localStorage.setItem('x2_last_visitor_location', JSON.stringify({
            city: data.city || '',
            country: data.country || '',
            at: Date.now()
          }));
        } catch (_) {}
      }
      return true;
    } catch (e) {
      console.warn('[BARIQ_VISITOR] location sync failed', e);
      return false;
    }
  }

  window.x2SyncVisitorLocation = syncVisitorLocation;

  if (!isAdminPage()) {
    [1200, 6500].forEach(function (delay) {
      setTimeout(function () { syncVisitorLocation().catch(function () {}); }, delay);
    });
    window.addEventListener('pageshow', function () {
      setTimeout(function () { syncVisitorLocation().catch(function () {}); }, 700);
    });
  }

  // =========================
  // 2) Admin UI patch
  // =========================
  if (!isAdminPage()) return;

  function textOf(el) {
    return String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function findPanelByTab(name) {
    var selectors = [
      '.panel[data-panel="' + name + '"]',
      '#panel-' + name,
      '#' + name,
      '[data-panel-name="' + name + '"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var x = document.querySelector(selectors[i]);
      if (x) return x;
    }
    return null;
  }

  function cleanHeaderActions() {
    var actions = document.querySelector('.topbar .actions');
    if (!actions) return;

    Array.from(actions.querySelectorAll('button, a')).forEach(function (el) {
      var onclick = String(el.getAttribute('onclick') || '');
      var txt = textOf(el);

      var keep =
        onclick.indexOf('syncFromSupabase') >= 0 ||
        onclick.indexOf('exportProducts') >= 0 ||
        txt.indexOf('مزامنة من Supabase') >= 0 ||
        txt.indexOf('تنزيل Products.json') >= 0;

      if (!keep) el.remove();
    });
  }

  function removeBannerBottomCards() {
    var panel = findPanelByTab('banners');

    if (!panel) {
      var headings = Array.from(document.querySelectorAll('.card h2'));
      var target = headings.find(function (h) {
        var t = textOf(h);
        return t.indexOf('إضافة بنر') >= 0 || t.indexOf('البنرات الحالية') >= 0;
      });
      if (target) panel = target.closest('.panel') || target.parentElement;
    }

    if (!panel) return;

    Array.from(panel.querySelectorAll('.card')).forEach(function (card) {
      var h2 = card.querySelector('h2');
      var t = textOf(h2);
      if (t.indexOf('إضافة بنر') >= 0 || t.indexOf('البنرات الحالية') >= 0) {
        card.remove();
      }
    });
  }

  function findCustomersPanel() {
    var panel = findPanelByTab('customers');
    if (panel) return panel;

    var custList = document.getElementById('custList');
    if (custList) return custList.closest('.panel') || custList.parentElement;

    return null;
  }

  function monthName(m) {
    return [
      '', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ][Number(m)] || String(m || '');
  }

  function typeLabel(v) {
    var map = {
      birthday: 'عيد ميلاد',
      anniversary: 'ذكرى',
      wedding: 'زواج',
      graduation: 'تخرج',
      newborn: 'مولود',
      other: 'أخرى'
    };
    var s = String(v || '').trim();
    return map[s.toLowerCase()] || s || 'مناسبة';
  }

  async function fetchOccasions() {
    var path = 'customer_occasions?select=id,user_id,customer_id,customer_email,customer_phone,occasion_name,occasion_type,person_name,relationship,occasion_day,occasion_month,occasion_year,remind_before_days,reminder_enabled,last_reminder_sent_at,created_at&order=occasion_month.asc,occasion_day.asc';

    if (typeof window.sbFetch === 'function') {
      try {
        var data = await window.sbFetch(path, { requireAuth: true });
        if (Array.isArray(data)) return data;
      } catch (e) {
        console.warn('[BARIQ_ADMIN] occasions via sbFetch failed', e);
      }
    }

    try {
      var token = '';
      if (typeof window.getValidAdminToken === 'function') {
        token = await window.getValidAdminToken() || '';
      }
      var res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
        headers: {
          apikey: ANON,
          Authorization: 'Bearer ' + (token || ANON)
        },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var rows = await res.json();
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      console.warn('[BARIQ_ADMIN] occasions fetch failed', e);
      return [];
    }
  }

  function buildOccasionCard() {
    var panel = findCustomersPanel();
    if (!panel) return null;

    var old = document.getElementById('customerOccasionsAdminCard');
    if (old) return old;

    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'customerOccasionsAdminCard';
    card.style.marginTop = '18px';
    card.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
        '<h2 style="margin:0">🎉 مناسبات العملاء</h2>' +
        '<button class="btn-ghost btn-sm" id="reloadCustomerOccasionsBtn">🔄 تحديث</button>' +
      '</div>' +
      '<div class="hint" style="margin-top:12px">المناسبات التي حفظها العملاء من صفحة الحساب في الموقع.</div>' +
      '<div class="admin-table-wrap">' +
        '<table class="admin-table" style="min-width:900px">' +
          '<thead><tr>' +
            '<th>العميل</th>' +
            '<th>المناسبة</th>' +
            '<th>الشخص</th>' +
            '<th>القرابة / الوصف</th>' +
            '<th>التاريخ</th>' +
            '<th>التذكير</th>' +
            '<th>الإشعار</th>' +
            '<th>آخر إرسال</th>' +
          '</tr></thead>' +
          '<tbody id="customerOccasionsAdminBody"><tr><td colspan="8" class="empty">جاري التحميل...</td></tr></tbody>' +
        '</table>' +
      '</div>';

    panel.appendChild(card);

    var btn = card.querySelector('#reloadCustomerOccasionsBtn');
    if (btn) btn.addEventListener('click', loadOccasionsTable);

    return card;
  }

  async function loadOccasionsTable() {
    var card = buildOccasionCard();
    if (!card) return;

    var tbody = card.querySelector('#customerOccasionsAdminBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="empty">جاري التحميل...</td></tr>';

    var rows = await fetchOccasions();

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">لا توجد مناسبات مسجلة حتى الآن</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (r) {
      var customer = r.customer_email || r.customer_phone || (r.customer_id ? ('عميل #' + r.customer_id) : '—');
      var occasion = r.occasion_name || typeLabel(r.occasion_type);
      var date = (r.occasion_day || '—') + ' ' + monthName(r.occasion_month) + (r.occasion_year ? (' ' + r.occasion_year) : '');
      var remind = 'قبل ' + Number(r.remind_before_days || 0) + ' يوم';
      var enabled = r.reminder_enabled === false
        ? '<span class="status-badge st-cancelled">متوقف</span>'
        : '<span class="status-badge st-delivered">مفعّل</span>';
      var lastSent = r.last_reminder_sent_at
        ? new Date(r.last_reminder_sent_at).toLocaleString('ar-AE')
        : 'لم يُرسل';

      return '<tr>' +
        '<td><b>' + esc(customer) + '</b></td>' +
        '<td>' + esc(occasion) + '</td>' +
        '<td>' + esc(r.person_name || '—') + '</td>' +
        '<td>' + esc(r.relationship || '—') + '</td>' +
        '<td>' + esc(date) + '</td>' +
        '<td>' + esc(remind) + '</td>' +
        '<td>' + enabled + '</td>' +
        '<td>' + esc(lastSent) + '</td>' +
      '</tr>';
    }).join('');
  }

  function applyAdminPatch() {
    cleanHeaderActions();
    removeBannerBottomCards();
    buildOccasionCard();
  }

  var patchTimer = 0;
  function schedulePatch() {
    clearTimeout(patchTimer);
    patchTimer = setTimeout(function () {
      applyAdminPatch();

      var customersTab = document.querySelector('.tab[data-tab="customers"]');
      if (customersTab && !customersTab.__bariqOccBound) {
        customersTab.__bariqOccBound = true;
        customersTab.addEventListener('click', function () {
          setTimeout(function () {
            buildOccasionCard();
            loadOccasionsTable();
          }, 120);
        });
      }
    }, 80);
  }

  function startAdminPatch() {
    applyAdminPatch();

    var mo = new MutationObserver(schedulePatch);
    mo.observe(document.body, { childList: true, subtree: true });

    var customersTab = document.querySelector('.tab[data-tab="customers"]');
    if (customersTab) {
      customersTab.addEventListener('click', function () {
        setTimeout(loadOccasionsTable, 150);
      });
    }

    // Load immediately if customers panel is already active.
    setTimeout(function () {
      var panel = findCustomersPanel();
      if (panel && panel.classList.contains('active')) loadOccasionsTable();
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAdminPatch, { once: true });
  } else {
    startAdminPatch();
  }
})();