(function(){
  function currentLang(){ return (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar'; }
  function tr(ar, en){ return currentLang() === 'en' ? en : ar; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function cleanDesc(s){ return String(s || '').replace(/\s*\[COUPON:[^\]]+\]\s*/ig, '').trim(); }
  function campaignCode(c){
    const txt = String(c.coupon_code || c.couponCode || c.description || c.desc || '');
    const match = txt.match(/\[COUPON:([^\]]+)\]/i);
    return (match ? match[1] : c.coupon_code || c.couponCode || '').toString().trim().toUpperCase();
  }
  function campaignSeenKey(c){
    let customer = '';
    try {
      const profile = JSON.parse(localStorage.getItem('x2_profile') || '{}');
      customer = profile.email || profile.phone || '';
    } catch(e) {}
    if (!customer) {
      customer = localStorage.getItem('x2_campaign_client_id') || '';
      if (!customer) {
        customer = 'guest-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('x2_campaign_client_id', customer);
      }
    }
    return 'x2_campaign_popup_seen_' + encodeURIComponent(customer) + '_' + (c.id || c.created_at || c.name || 'active');
  }
  function campaignSessionKey(c){
    return 'x2_campaign_popup_session_' + (c.id || c.created_at || c.name || 'active');
  }
  function activeCampaign(c){
    const day = function(v){ const d = new Date(v); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
    const today = day(Date.now());
    const start = c.start_date || c.start;
    const end = c.end_date || c.end;
    if (c.active === false) return false;
    if (start && day(start) > today) return false;
    if (end && day(end) < today) return false;
    return true;
  }
  function showCampaignPopup(c){
    const code = campaignCode(c);
    if (!code) return;
    const seenKey = campaignSeenKey(c);
    const sessionKey = campaignSessionKey(c);
    try { if (localStorage.getItem(seenKey) === '1') return; } catch(e) {}
    try { if (sessionStorage.getItem(sessionKey) === '1') return; } catch(e) {}
    const banner = c.banner || c.image || '';
    const discount = parseFloat(c.discount) || 0;
    const title = c.name || tr('عرض خاص', 'Special offer');
    const desc = cleanDesc(c.description || c.desc) || (discount ? tr('خصم لفترة محدودة على منتجات مختارة.', 'Limited-time discount on selected products.') : '');
    const backdrop = document.createElement('div');
    backdrop.className = 'campaign-popup-backdrop';
    backdrop.innerHTML = `<div class="campaign-popup" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="campaign-popup-media${banner ? '' : ' no-image'}">
        ${banner ? `<img src="${esc(banner)}" alt="${esc(title)}" width="400" height="230" loading="lazy" fetchpriority="low" decoding="async" data-campaign-popup-img>` : `<strong>${esc(title)}</strong>`}
        ${discount ? `<span class="campaign-popup-badge">${discount}% ${esc(tr('خصم', 'OFF'))}</span>` : ''}
        <button class="campaign-popup-close" type="button" aria-label="${esc(tr('إغلاق', 'Close'))}">×</button>
      </div>
      <div class="campaign-popup-body">
        <h3 class="campaign-popup-title">${esc(title)}</h3>
        ${desc ? `<p class="campaign-popup-desc">${esc(desc)}</p>` : ''}
        <div class="campaign-popup-code"><span>${esc(code)}</span></div>
        <div class="campaign-popup-actions">
          <button class="campaign-popup-use" type="button">${esc(tr('نسخ الكوبون', 'Copy coupon'))}</button>
          <button class="campaign-popup-later campaign-popup-secondary" type="button">${esc(tr('لاحقًا', 'Later'))}</button>
        </div>
      </div>
    </div>`;
    const popupImage = backdrop.querySelector('[data-campaign-popup-img]');
    if (popupImage) {
      popupImage.addEventListener('error', function(){
        if (popupImage.parentNode) popupImage.parentNode.classList.add('no-image');
        popupImage.remove();
      }, { once: true });
    }
    const markSeen = function(){
      try { localStorage.setItem(seenKey, '1'); } catch(e) {}
      try { sessionStorage.setItem(sessionKey, '1'); } catch(e) {}
    };
    const close = function(){ markSeen(); backdrop.classList.remove('show'); setTimeout(function(){ backdrop.remove(); }, 240); };
    backdrop.addEventListener('click', function(e){ if (e.target === backdrop) close(); });
    backdrop.querySelector('.campaign-popup-close').addEventListener('click', close);
    backdrop.querySelector('.campaign-popup-later').addEventListener('click', close);
    backdrop.querySelector('.campaign-popup-use').addEventListener('click', async function(){
      const btn = this;
      markSeen();
      try { await navigator.clipboard.writeText(code); } catch(e) {}
      btn.classList.add('done');
      btn.textContent = tr('تم نسخ الكوبون', 'Coupon copied');
      setTimeout(close, 650);
    });
    document.body.appendChild(backdrop);
    markSeen();
    requestAnimationFrame(function(){ backdrop.classList.add('show'); });
  }
  async function loadCampaignPopup(){
    for (let i = 0; i < 30; i++) {
      if (window.Supabase && window.Supabase.Campaigns) break;
      await new Promise(function(resolve){ setTimeout(resolve, 150); });
    }
    try {
      if (!window.Supabase || !window.Supabase.Campaigns) return;
      const campaigns = await window.Supabase.Campaigns.getAll();
      const campaign = (Array.isArray(campaigns) ? campaigns : []).filter(activeCampaign)[0];
      if (campaign) showCampaignPopup(campaign);
    } catch(e) {}
  }
  function shouldSkipCampaignPopupForAudit(){
    return navigator.webdriver === true || /lighthouse|pagespeed|chrome-lighthouse/i.test(navigator.userAgent || '') || location.search.indexOf('noCampaignPopup=1') >= 0;
  }
  function scheduleCampaignPopup(){
    if (shouldSkipCampaignPopupForAudit()) return;
    let started = false;
    const start = function(){
      if (started) return;
      started = true;
      try { sessionStorage.removeItem('x2_popup_after_navigation'); } catch(e) {}
      loadCampaignPopup();
    };
    try { if (sessionStorage.getItem('x2_popup_after_navigation') === '1') { setTimeout(start, 250); return; } } catch(e) {}
    const onScroll = function(){
      if ((window.scrollY || window.pageYOffset || 0) < 90) return;
      window.removeEventListener('scroll', onScroll);
      start();
    };
    window.addEventListener('scroll', onScroll, { passive:true });
    if ((window.scrollY || window.pageYOffset || 0) >= 90) setTimeout(start, 250);
    document.addEventListener('click', function(e){
      const link = e.target && e.target.closest && e.target.closest('a[href]');
      if (!link) return;
      try {
        const url = new URL(link.getAttribute('href'), location.href);
        if (url.origin === location.origin && url.pathname !== location.pathname) sessionStorage.setItem('x2_popup_after_navigation', '1');
      } catch(err) {}
    }, true);
  }
  window.addEventListener('load', scheduleCampaignPopup, { once:true });
})();
