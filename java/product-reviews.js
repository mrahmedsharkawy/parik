(function(){
  function getProductIdFromUrl(){
    const fromQuery = new URLSearchParams(location.search).get('id');
    if(fromQuery) return fromQuery;
    const parts = location.pathname.split('/').filter(Boolean);
    const productIndex = parts.findIndex(p => p.toLowerCase() === 'product' || p.toLowerCase() === 'product.html');
    return productIndex >= 0 && parts[productIndex + 1] ? decodeURIComponent(parts[productIndex + 1]) : '';
  }

  const pid = getProductIdFromUrl();
  if(!pid) return;
  const SB_URL = 'https://knleehjjejfeobcmpwnw.supabase.co';
  const SB_KEY = 'sb_publishable_VPSO9nbXg5eVNMj03KpgdA_VSOuMDHw';
  let picked = 5;
  const SHOW = 3;
  const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar';
  const i18n = {
    ar: { empty: 'لا توجد تعليقات بعد.', visitor: 'زائر', showAll: 'إظهار الكل', allReviews: 'كل التقييمات', writeFirst: 'اكتب تعليقك أولاً', sending: '...جارٍ الإرسال', sendError: 'خطأ في الإرسال، حاول مجدداً', submit: 'إرسال التقييم' },
    en: { empty: 'No comments yet.', visitor: 'Guest', showAll: 'Show All', allReviews: 'All Reviews', writeFirst: 'Write your comment first', sending: 'Sending...', sendError: 'Could not submit, please try again', submit: 'Submit Review' }
  };
  const tr = key => (i18n[lang] && i18n[lang][key]) || i18n.ar[key] || key;

  const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  async function sbReviews(method, body){
    const accessToken = localStorage.getItem('x2_token') || SB_KEY;
    const headers = {apikey: SB_KEY, Authorization: 'Bearer '+accessToken, 'Content-Type': 'application/json'};
    if(method==='POST') headers['Prefer'] = 'return=minimal';
    const res = await fetch(SB_URL+'/rest/v1/reviews?product_id=eq.'+encodeURIComponent(pid)+'&order=date.desc',
      {method, headers, body: body ? JSON.stringify(body) : undefined});
    if(method==='GET' && res.ok) return res.json();
    return null;
  }

  function starsStr(n){ n=Math.round(n)||0; return '★'.repeat(n)+'☆'.repeat(5-n); }

  function rvItemHtml(r){
    const dt = r.date ? new Date(r.date).toLocaleDateString(lang === 'en' ? 'en' : 'ar') : '';
    return `<div class="rv-item">
      <div class="top">
        <span class="meta"><span class="who">${esc(r.name)||tr('visitor')}</span><span class="dt">${dt}</span></span>
        <span class="st">${starsStr(r.rating)}</span>
      </div>
      <div class="txt">${esc(r.text)}</div>
    </div>`;
  }

  let allReviews = [];

  function updateProductStars(){
    if(!allReviews.length) return;
    const avg = allReviews.reduce((s,r)=>s+(Number(r.rating)||0),0)/allReviews.length;
    const starsEl = document.getElementById('stars');
    const countEl = document.getElementById('ratingCount');
    if(starsEl) starsEl.innerHTML = `<span style="color:#f59e0b;letter-spacing:1px">${starsStr(Math.round(avg))}</span><span style="color:#888;font-size:.8rem;margin-right:3px">${avg.toFixed(1)}</span>`;
    if(countEl) countEl.textContent = '('+allReviews.length+')';
  }

  function renderList(){
    const list = document.getElementById('rvList');
    const btn = document.getElementById('rvShowMore');
    if(!allReviews.length){ list.innerHTML='<div class="rv-empty">'+tr('empty')+'</div>'; btn.style.display='none'; return; }
    list.innerHTML = allReviews.slice(0,SHOW).map(rvItemHtml).join('');
    btn.style.display = allReviews.length > SHOW ? 'block' : 'none';
    btn.textContent = '⬇ ' + tr('showAll') + ' (' + allReviews.length + ')';
  }

  document.getElementById('rvShowMore').addEventListener('click',function(){
    const bg = document.createElement('div'); bg.className='rv-modal-bg';
    bg.innerHTML = `<div class="rv-modal">
      <div class="rv-modal-head"><h4>${tr('allReviews')} (${allReviews.length})</h4><button class="rv-modal-close">✕</button></div>
      <div class="rv-modal-body">${allReviews.map(rvItemHtml).join('')}</div>
    </div>`;
    document.body.appendChild(bg);
    document.body.style.overflow = 'hidden';
    const close = () => { bg.remove(); document.body.style.overflow = ''; };
    bg.querySelector('.rv-modal-close').onclick = close;
    bg.addEventListener('click', e => { if(e.target===bg) close(); });
    bg.addEventListener('touchmove', function(e){
      const body = bg.querySelector('.rv-modal-body');
      if(body && body.contains(e.target)) e.stopPropagation();
      else e.preventDefault();
    }, {passive:false});
  });

  async function render(){
    const avgBox = document.getElementById('rvAvg');
    try{
      const data = await sbReviews('GET');
      allReviews = Array.isArray(data) ? data : [];
    } catch(e){ allReviews = []; }
    if(allReviews.length){
      const avg = allReviews.reduce((s,r)=>s+(Number(r.rating)||0),0)/allReviews.length;
      avgBox.innerHTML = `<span class="num">${avg.toFixed(1)}</span><span class="stars">${starsStr(avg)}</span>`;
    } else avgBox.innerHTML='';
    renderList();
    updateProductStars();
  }

  const starsEl = document.getElementById('rvStars');
  function paint(){ starsEl.querySelectorAll('span').forEach(s=>s.classList.toggle('on',Number(s.dataset.v)<=picked)); }
  starsEl.querySelectorAll('span').forEach(s=>s.addEventListener('click',()=>{ picked=Number(s.dataset.v); paint(); }));
  picked=5; paint();

  document.getElementById('rvSubmit').addEventListener('click', async ()=>{
    const text=document.getElementById('rvText').value.trim();
    if(!text){ alert(tr('writeFirst')); return; }
    let name=tr('visitor'), customerEmail=''; try{ const p=JSON.parse(localStorage.getItem('x2_profile')||'{}'); if(p.name) name=p.name; customerEmail=String(p.email||'').trim().toLowerCase(); }catch(e){}
    const btn = document.getElementById('rvSubmit');
    btn.disabled = true; btn.textContent = tr('sending');
    try{
      const res = await fetch(SB_URL+'/rest/v1/reviews', {
        method:'POST',
        headers:{apikey:SB_KEY, Authorization:'Bearer '+(localStorage.getItem('x2_token')||SB_KEY), 'Content-Type':'application/json', Prefer:'return=minimal'},
        body: JSON.stringify({product_id:pid, name, rating:picked, text, customer_email:customerEmail||null})
      });
      if(!res.ok) throw new Error(await res.text());
      document.getElementById('rvText').value=''; picked=5; paint();
      await render();
    } catch(e){ alert(tr('sendError')); }
    btn.disabled = false; btn.textContent = tr('submit');
  });

  render();
})();
