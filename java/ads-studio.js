const state={products:[],categories:[],selected:new Set(),page:0,pageSize:20,meta:null,accounts:[],pages:[]};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(window.__adsToast);window.__adsToast=setTimeout(()=>el.classList.remove("show"),2600)}
function money(v){const n=Number(v);return Number.isFinite(n)?`AED ${n.toLocaleString("en-US",{maximumFractionDigits:2})}`:"—"}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function productUrl(p){return `${location.origin}/product/${encodeURIComponent(p.id)}/${encodeURIComponent((p.name_ar||p.name_en||"product").toLowerCase().replace(/\s+/g,"-"))}`}
async function api(path,opts={}){const r=await fetch(path,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||data.message||`HTTP ${r.status}`);return data}
async function loadProducts(){
  $("#productsState").classList.remove("hidden");$("#productsState").textContent="جاري تحميل المنتجات الحقيقية…";
  try{
    if(typeof window.sbFetch!=="function") throw new Error("Supabase client not loaded");
    const offset=state.page*state.pageSize;
    const q=`products?select=id,name_ar,name_en,price,stock,image,category_id,active,created_at&active=eq.true&order=created_at.desc&limit=${state.pageSize}&offset=${offset}`;
    const rows=await window.sbFetch(q,{forceAnon:true});
    state.products=Array.isArray(rows)?rows:[];
    await loadCategories();
    renderProducts();
    $("#productsState").classList.toggle("hidden",state.products.length>0);
    if(!state.products.length)$("#productsState").textContent="لا توجد منتجات في هذه الصفحة.";
  }catch(e){$("#productsState").textContent=`تعذر تحميل المنتجات: ${e.message}`}
}
async function loadCategories(){
  if(state.categories.length)return;
  try{
    const rows=await window.sbFetch("categories?select=id,name_ar,name_en&active=eq.true&order=sort_order.asc",{forceAnon:true});
    state.categories=Array.isArray(rows)?rows:[];
    $("#categoryFilter").innerHTML='<option value="">كل الفئات</option>'+state.categories.map(c=>`<option value="${c.id}">${esc(c.name_ar||c.name_en||c.id)}</option>`).join("");
  }catch(_){}
}
function renderProducts(){
  const search=$("#productSearch").value.trim().toLowerCase(),cat=$("#categoryFilter").value,sort=$("#productSort").value;
  let rows=state.products.filter(p=>(!search||`${p.name_ar||""} ${p.name_en||""}`.toLowerCase().includes(search))&&(!cat||String(p.category_id)===cat));
  rows=rows.slice().sort((a,b)=>sort==="price_asc"?Number(a.price)-Number(b.price):sort==="price_desc"?Number(b.price)-Number(a.price):new Date(b.created_at)-new Date(a.created_at));
  $("#productsCarousel").innerHTML=rows.map(p=>`<article class="product-card ${state.selected.has(p.id)?"selected":""}">
    <label class="pick"><input type="checkbox" data-pick="${p.id}" ${state.selected.has(p.id)?"checked":""}></label>
    <div class="product-image">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name_ar||p.name_en||"")}">`:"<span>لا توجد صورة</span>"}</div>
    <div class="product-body"><div class="product-name">${esc(p.name_ar||p.name_en||`#${p.id}`)}</div>
    <div class="product-row"><span>المخزون ${Number(p.stock||0)}</span><span class="product-price">${money(p.price)}</span></div>
    <div class="product-actions"><button data-preview="${p.id}">Preview</button><button data-create="${p.id}">Create Ad</button></div></div>
  </article>`).join("");
  $("#productPageLabel").textContent=`صفحة ${state.page+1}`;
  $$("[data-pick]").forEach(el=>el.onchange=()=>{const id=Number(el.dataset.pick);state.selected.has(id)?state.selected.delete(id):state.selected.add(id);renderProducts();updateSelection()});
  $$("[data-create]").forEach(el=>el.onclick=()=>openAd([Number(el.dataset.create)]));
  $$("[data-preview]").forEach(el=>el.onclick=()=>window.open(productUrl(state.products.find(p=>p.id===Number(el.dataset.preview))),"_blank"));
  updateSelection();
}
function updateSelection(){const n=state.selected.size;$("#selectionBar").classList.toggle("show",n>0);$("#selectionCount").textContent=`${n} محدد`}
async function loadMetaStatus(){
  try{
    const data=await api("/api/meta/status");
    state.meta=data;
    $("#apiVersionField").value=data.api_version||"—";
    if(!data.connected){$("#metaState").className="state state-warn";$("#metaState").textContent="ميتا غير متصل";$("#connectMetaBtn").hidden=false;clearKpis();renderCampaigns([]);return}
    $("#metaState").className="state state-ok";$("#metaState").textContent=`Meta Connected${data.user_name?` — ${data.user_name}`:""}`;$("#connectMetaBtn").hidden=true;
    await loadMetaAssets();
    await Promise.all([loadCampaigns(),loadInsights()]);
  }catch(e){$("#metaState").className="state state-bad";$("#metaState").textContent="تعذر فحص Meta";clearKpis()}
}
async function loadMetaAssets(){
  try{
    const data=await api("/api/meta/assets");
    state.accounts=data.ad_accounts||[];state.pages=data.pages||[];
    const saved=JSON.parse(localStorage.getItem("bariq_ads_meta_selection")||"{}");
    $("#adAccountSelect").innerHTML='<option value="">اختر الحساب</option>'+state.accounts.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.id)}</option>`).join("");
    $("#pageSelect").innerHTML='<option value="">اختر الصفحة</option>'+state.pages.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.id)}</option>`).join("");
    if(saved.ad_account_id)$("#adAccountSelect").value=saved.ad_account_id;if(saved.page_id)$("#pageSelect").value=saved.page_id;
    fillInstagram();
  }catch(e){toast(`تعذر تحميل حسابات Meta: ${e.message}`)}
}
function fillInstagram(){const page=state.pages.find(x=>x.id===$("#pageSelect").value);const ig=page?.instagram_business_account;$("#instagramSelect").innerHTML='<option value="">—</option>'+(ig?`<option selected value="${esc(ig.id)}">${esc(ig.username||ig.id)}</option>`:"")}
function selection(){const saved=JSON.parse(localStorage.getItem("bariq_ads_meta_selection")||"{}");return{ad_account_id:$("#adAccountSelect").value||saved.ad_account_id||"",page_id:$("#pageSelect").value||saved.page_id||"",instagram_account_id:$("#instagramSelect").value||saved.instagram_account_id||""}}
async function loadCampaigns(){
  const s=selection();if(!s.ad_account_id){renderCampaigns([]);return}
  try{const data=await api(`/api/meta/campaigns?ad_account_id=${encodeURIComponent(s.ad_account_id)}`);renderCampaigns(data.data||[])}catch(e){renderCampaigns([],e.message)}
}
function renderCampaigns(rows,error=""){
  const html=error?`<div class="notice">${esc(error)}</div>`:!rows.length?`<div class="notice">${state.meta?.connected?"لا توجد حملات أو لم يتم اختيار Ad Account.":"اربط Meta أولًا لعرض الحملات."}</div>`:`<table><thead><tr><th>Campaign</th><th>Status</th><th>Objective</th><th>Budget</th><th>Start</th><th>الإجراءات</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${esc(c.name)}</td><td><span class="pill ${String(c.status).toLowerCase()}">${esc(c.status)}</span></td><td>${esc(c.objective||"—")}</td><td>${c.daily_budget?money(Number(c.daily_budget)/100):"—"}</td><td>${esc(c.start_time||"—")}</td><td><div class="row-actions"><button class="table-action edit" data-edit-campaign="${c.id}" data-name="${esc(c.name)}">تعديل</button><button class="table-action" data-toggle-campaign="${c.id}" data-status="${c.status}">${c.status==="ACTIVE"?"إيقاف":"تشغيل"}</button><button class="table-action delete" data-delete-campaign="${c.id}">حذف</button></div></td></tr>`).join("")}</tbody></table>`;
  $("#campaignsTable").innerHTML=html;$("#dashboardCampaigns").innerHTML=html;
  $$("[data-toggle-campaign]").forEach(b=>b.onclick=async()=>{try{await api("/api/meta/campaign-status",{method:"POST",body:JSON.stringify({campaign_id:b.dataset.toggleCampaign,status:b.dataset.status==="ACTIVE"?"PAUSED":"ACTIVE"})});toast("تم تحديث الحملة");await loadCampaigns()}catch(e){toast(e.message)}})
}
async function editMetaCampaign(id,currentName){const name=prompt("اسم الحملة",currentName||"");if(name===null||!name.trim())return;try{await api("/api/meta/campaign-update",{method:"POST",body:JSON.stringify({campaign_id:id,name:name.trim()})});toast("تم تعديل الحملة");await loadCampaigns()}catch(e){toast(e.message)}}
async function deleteMetaCampaign(id){if(!confirm("حذف هذه الحملة من ميتا؟"))return;try{await api("/api/meta/campaign-delete",{method:"POST",body:JSON.stringify({campaign_id:id})});toast("تم حذف الحملة");await loadCampaigns()}catch(e){toast(e.message)}}
document.addEventListener("click",e=>{const ed=e.target.closest?.("[data-edit-campaign]");if(ed)editMetaCampaign(ed.dataset.editCampaign,ed.dataset.name);const del=e.target.closest?.("[data-delete-campaign]");if(del)deleteMetaCampaign(del.dataset.deleteCampaign)});

async function loadInsights(){
  const s=selection();if(!s.ad_account_id){clearKpis();return}
  try{
    const data=await api(`/api/meta/insights?ad_account_id=${encodeURIComponent(s.ad_account_id)}&range=${encodeURIComponent($("#rangeSelect").value)}`);
    const k=data.summary||{};setKpi("spend",money(k.spend));setKpi("revenue",money(k.revenue));setKpi("roas",k.roas!=null?`${Number(k.roas).toFixed(2)}x`:"—");setKpi("purchases",k.purchases??"—");setKpi("ctr",k.ctr!=null?`${Number(k.ctr).toFixed(2)}%`:"—");setKpi("active_campaigns",data.active_campaigns??"—");
  }catch(e){clearKpis();toast(`Insights: ${e.message}`)}
}
function setKpi(k,v){const el=$(`[data-kpi="${k}"]`);if(el)el.textContent=v}
function clearKpis(){["spend","revenue","roas","purchases","ctr","active_campaigns"].forEach(k=>setKpi(k,"—"))}

const campaignComposer={format:"single",selectedIds:[],creativeSource:"product",media:[],placement:"feed",targetMode:"all_uae",budgetMode:"daily"};

function campaignSelectedProducts(){return campaignComposer.selectedIds.map(id=>state.products.find(p=>String(p.id)===String(id))).filter(Boolean)}
function syncCampaignProductSelect(){
  const q=(document.querySelector("#campaignProductSearch")?.value||"").trim().toLowerCase();
  const rows=state.products.filter(p=>!q||`${p.name_ar||""} ${p.name_en||""}`.toLowerCase().includes(q));
  document.querySelector("#campaignProductSelect").innerHTML='<option value="">اختر منتجًا</option>'+rows.map(p=>`<option value="${p.id}">${esc(p.name_ar||p.name_en||p.id)} — ${money(p.price)}</option>`).join("")
}
function setCampaignFormat(format){
  campaignComposer.format=format==="carousel"?"carousel":"single";
  if(campaignComposer.format==="single"&&campaignComposer.selectedIds.length>1)campaignComposer.selectedIds=campaignComposer.selectedIds.slice(0,1);
  document.querySelectorAll("[data-format-card]").forEach(x=>x.classList.toggle("active",x.dataset.formatCard===campaignComposer.format));
  const r=document.querySelector(`input[name="adFormat"][value="${campaignComposer.format}"]`);if(r)r.checked=true;
  const hint=document.querySelector("#campaignProductHint");if(hint)hint.textContent=campaignComposer.format==="single"?"الإعلان المنفرد يسمح بمنتج واحد.":"الإعلان الدائري يسمح من 2 إلى 10 منتجات أو وسائط.";
  renderCampaignSelectedProducts();renderPreview()
}
function addCampaignProduct(id){
  id=Number(id);if(!id)return;
  if(campaignComposer.format==="single")campaignComposer.selectedIds=[id];
  else if(!campaignComposer.selectedIds.includes(id)){if(campaignComposer.selectedIds.length>=10)return toast("الحد الأقصى للإعلان الدائري 10 منتجات.");campaignComposer.selectedIds.push(id)}
  document.querySelector("#adForm").dataset.productIds=campaignComposer.selectedIds.join(",");
  renderCampaignSelectedProducts();renderPreview()
}
function removeCampaignProduct(id){
  campaignComposer.selectedIds=campaignComposer.selectedIds.filter(x=>String(x)!==String(id));
  document.querySelector("#adForm").dataset.productIds=campaignComposer.selectedIds.join(",");
  renderCampaignSelectedProducts();renderPreview()
}
function renderCampaignSelectedProducts(){
  const rows=campaignSelectedProducts(),box=document.querySelector("#campaignSelectedProducts");if(!box)return;
  box.innerHTML=rows.length?rows.map((p,i)=>`<div class="campaign-product-chip">${p.image?`<img src="${esc(p.image)}" alt="">`:"<div></div>"}<div><b>${esc(p.name_ar||p.name_en||p.id)}</b><small>${money(p.price)} • ${i+1} من ${rows.length}</small></div><button type="button" data-remove-campaign-product="${p.id}">×</button></div>`).join(""):'<div class="composer-hint">لم يتم اختيار أي منتج بعد.</div>';
  document.querySelectorAll("[data-remove-campaign-product]").forEach(b=>b.onclick=()=>removeCampaignProduct(b.dataset.removeCampaignProduct));updateComposerChecklist()
}
function setCreativeSource(source){
  campaignComposer.creativeSource=source==="custom"?"custom":"product";
  document.querySelector("#customMediaBox")?.classList.toggle("hidden",campaignComposer.creativeSource!=="custom");
  document.querySelectorAll(".source-option").forEach(x=>x.classList.toggle("active",x.querySelector("input")?.value===campaignComposer.creativeSource));
  renderPreview();updateComposerChecklist()
}
function addCampaignMedia(files){
  [...files].forEach(file=>{
    if(campaignComposer.media.length>=10)return;
    const type=file.type.startsWith("video/")?"video":file.type.startsWith("image/")?"image":null;if(!type)return;
    campaignComposer.media.push({id:crypto.randomUUID(),file,url:URL.createObjectURL(file),type,name:file.name,size:file.size})
  });
  renderCampaignMedia();renderPreview()
}
function removeCampaignMedia(id){
  const item=campaignComposer.media.find(x=>x.id===id);if(item)URL.revokeObjectURL(item.url);
  campaignComposer.media=campaignComposer.media.filter(x=>x.id!==id);renderCampaignMedia();renderPreview()
}
function renderCampaignMedia(){
  const box=document.querySelector("#campaignMediaList");if(!box)return;
  box.innerHTML=campaignComposer.media.map(m=>`<div class="campaign-media-item">${m.type==="video"?`<video src="${m.url}" muted playsinline></video>`:`<img src="${m.url}" alt="">`}<button type="button" data-remove-media="${m.id}">×</button><small>${esc(m.name)}</small></div>`).join("");
  document.querySelectorAll("[data-remove-media]").forEach(b=>b.onclick=()=>removeCampaignMedia(b.dataset.removeMedia));updateComposerChecklist()
}
function campaignCreativeItems(){
  if(campaignComposer.creativeSource==="custom"&&campaignComposer.media.length)return campaignComposer.media.map(m=>({type:m.type,url:m.url,name:m.name,price:null}));
  return campaignSelectedProducts().map(p=>({type:"image",url:p.image||"",name:p.name_ar||p.name_en||"منتج بريق",price:p.price,product:p}))
}
function ctaArabic(){return {SHOP_NOW:"تسوق الآن",LEARN_MORE:"اعرف المزيد",MESSAGE_PAGE:"إرسال رسالة"}[document.querySelector("#cta")?.value]||"تسوق الآن"}
function getTargetingPayload(){
  if(campaignComposer.targetMode==="all_uae")return{mode:"all_uae",country:"AE",emirates:[],areas:[]};
  const emirates=[...document.querySelectorAll("#customTargetingBox input[type='checkbox']:checked")].map(x=>x.value);
  const areas=(document.querySelector("#customAreasInput")?.value||"").split(/[,،]/).map(x=>x.trim()).filter(Boolean);
  return{mode:"custom",country:"AE",emirates,areas}
}
function setTargetMode(mode){
  campaignComposer.targetMode=mode==="custom"?"custom":"all_uae";
  document.querySelector("#customTargetingBox")?.classList.toggle("hidden",campaignComposer.targetMode!=="custom");
  document.querySelectorAll(".target-mode").forEach(x=>x.classList.toggle("active",x.querySelector("input")?.value===campaignComposer.targetMode));updateComposerChecklist()
}
function setBudgetMode(mode){
  campaignComposer.budgetMode=mode==="total"?"total":"daily";
  document.querySelector("#dailyBudgetLabel")?.classList.toggle("hidden",campaignComposer.budgetMode!=="daily");
  document.querySelector("#totalBudgetLabel")?.classList.toggle("hidden",campaignComposer.budgetMode!=="total");
  document.querySelectorAll(".budget-mode").forEach(x=>x.classList.toggle("active",x.querySelector("input")?.value===campaignComposer.budgetMode));calcBudget()
}
function renderPreview(){
  const items=campaignCreativeItems(),format=campaignComposer.format,text=document.querySelector("#primaryText")?.value||"اكتب نص الإعلان هنا...",placement=campaignComposer.placement;
  const mediaClass=placement==="story"?"story":placement==="reel"?"reel":"feed";
  let mediaHtml="";
  if(format==="carousel"&&items.length){
    mediaHtml=`<div class="meta-carousel">${items.slice(0,10).map(x=>`<div class="meta-carousel-card">${x.type==="video"?`<video src="${x.url}" muted playsinline controls></video>`:x.url?`<img src="${esc(x.url)}" alt="">`:`<div class="meta-preview-placeholder">بدون صورة</div>`}<div><b>${esc(x.name||"مادة إعلانية")}</b>${x.price!=null?`<small>${money(x.price)}</small>`:""}</div></div>`).join("")}</div>`
  }else{
    const x=items[0];mediaHtml=x?(x.type==="video"?`<video src="${x.url}" muted playsinline controls></video>`:x.url?`<img src="${esc(x.url)}" alt="">`:`<div class="meta-preview-placeholder">لا توجد صورة</div>`):'<div class="meta-preview-placeholder">اختر منتجًا أو ارفع صورة/فيديو</div>'
  }
  const p=campaignSelectedProducts()[0],preview=document.querySelector("#adPreview");if(!preview)return;
  preview.innerHTML=`<div class="meta-preview-head"><div class="meta-preview-avatar">B</div><div><b>Bariq Gifts</b><small>إعلان ممول</small></div></div><div class="meta-preview-copy">${esc(text)}</div><div class="meta-preview-media ${mediaClass}">${mediaHtml}</div><div class="meta-preview-footer"><div><b>${esc(p?.name_ar||p?.name_en||document.querySelector("#campaignName")?.value||"Bariq Gifts")}</b><small>${p?money(p.price):"bariqgifts.com"}</small></div><button type="button" class="meta-preview-cta">${ctaArabic()}</button></div>`;
  updateComposerChecklist()
}
function updateComposerChecklist(){
  const products=campaignSelectedProducts(),items=campaignCreativeItems();
  const productOk=campaignComposer.creativeSource==="custom"?campaignComposer.media.length>0:products.length>0;
  const creativeOk=items.some(x=>x.url),formatOk=campaignComposer.format==="single"?items.length>=1:items.length>=2;
  const t=getTargetingPayload(),targetOk=campaignComposer.targetMode==="all_uae"||t.emirates.length>0||t.areas.length>0;
  const daily=Number(document.querySelector("#dailyBudget")?.value||0),total=Number(document.querySelector("#totalBudget")?.value||0),budgetOk=campaignComposer.budgetMode==="daily"?daily>0:total>0;
  [["#checkProduct",productOk],["#checkCreative",creativeOk&&formatOk],["#checkTarget",targetOk],["#checkBudget",budgetOk],["#checkMeta",!!state.meta?.connected]].forEach(([s,ok])=>{
    const el=document.querySelector(s);if(!el)return;el.classList.toggle("ok",ok);const dot=el.querySelector("span");if(dot)dot.textContent=ok?"✓":"○"
  });
  const st=document.querySelector("#composerStatus");if(st)st.textContent=!productOk?"اختر المنتج أو المادة الإعلانية":!formatOk&&campaignComposer.format==="carousel"?"الإعلان الدائري يحتاج عنصرين على الأقل":!targetOk?"حدد منطقة الاستهداف":creativeOk?"المعاينة جاهزة":"اختر صورة أو فيديو"
}
function calcBudget(){
  const d=Math.max(1,Number(document.querySelector("#durationDays")?.value||1));
  let daily=Number(document.querySelector("#dailyBudget")?.value||0),total=Number(document.querySelector("#totalBudget")?.value||0);
  if(campaignComposer.budgetMode==="daily"){total=daily*d;document.querySelector("#totalBudget").value=total||""}
  else{daily=total/d;document.querySelector("#dailyBudget").value=daily?daily.toFixed(2):""}
  document.querySelector("#estimatedSpend").textContent=money(total);
  document.querySelector("#budgetModeSummary").textContent=campaignComposer.budgetMode==="daily"?"يومية":"كلية";
  document.querySelector("#budgetDailySummary").textContent=money(daily);
  document.querySelector("#budgetDurationSummary").textContent=`${d} أيام`;
  const warn=document.querySelector("#publishWarning");warn.classList.toggle("hidden",total<5000);warn.textContent=total>=5000?`تحذير: إجمالي الميزانية ${money(total)}. راجع القيمة قبل النشر.`:"";
  updateComposerChecklist()
}
function openAd(ids=[]){
  campaignComposer.editingDraftId=null;
  campaignComposer.selectedIds=(ids||[]).map(Number).filter(Boolean).slice(0,10);
  campaignComposer.format=campaignComposer.selectedIds.length>1?"carousel":"single";
  campaignComposer.creativeSource="product";campaignComposer.placement="feed";campaignComposer.targetMode="all_uae";campaignComposer.budgetMode="daily";
  campaignComposer.media.forEach(m=>URL.revokeObjectURL(m.url));campaignComposer.media=[];
  document.querySelector("#adForm").dataset.productIds=campaignComposer.selectedIds.join(",");
  const p=campaignSelectedProducts()[0];
  document.querySelector("#adDialogTitle").textContent=p?`إنشاء حملة — ${p.name_ar||p.name_en||p.id}`:"إنشاء حملة إعلانية";
  document.querySelector("#campaignName").value=p?`Bariq - ${p.name_ar||p.name_en||p.id}`:`Bariq - حملة ${new Date().toLocaleDateString("ar-AE")}`;
  document.querySelector("#primaryText").value=p?`اكتشف ${p.name_ar||p.name_en||"منتج بريق"} من بريق للهدايا.`:"اكتشف منتجات بريق المميزة واختر الهدية المناسبة لمناسبتك.";
  setCampaignFormat(campaignComposer.format);setCreativeSource("product");setTargetMode("all_uae");setBudgetMode("daily");
  syncCampaignProductSelect();renderCampaignMedia();calcBudget();renderPreview();document.querySelector("#adDialog").showModal()
}
function draftPayload(){
  const products=campaignSelectedProducts(),targeting=getTargetingPayload(),d=Math.max(1,Number(document.querySelector("#durationDays").value||1));
  const total=campaignComposer.budgetMode==="total"?Number(document.querySelector("#totalBudget").value||0):Number(document.querySelector("#dailyBudget").value||0)*d;
  const daily=campaignComposer.budgetMode==="daily"?Number(document.querySelector("#dailyBudget").value||0):total/d;
  return{id:crypto.randomUUID(),created_at:new Date().toISOString(),campaign_name:document.querySelector("#campaignName").value,objective:document.querySelector("#objective").value,daily_budget:daily,total_budget:total,budget_mode:campaignComposer.budgetMode,duration_days:d,targeting,platforms:document.querySelector("#campaignPlatforms").value,age_range:document.querySelector("#ageRange").value,primary_text:document.querySelector("#primaryText").value,cta:document.querySelector("#cta").value,ad_format:campaignComposer.format,creative_source:campaignComposer.creativeSource,products:products.map(p=>({id:p.id,name:p.name_ar||p.name_en,image:p.image,price:p.price,url:productUrl(p)})),custom_media:campaignComposer.media.map(m=>({name:m.name,type:m.type,size:m.size}))}
}
function saveDraft(){const d=draftPayload(),arr=JSON.parse(localStorage.getItem("bariq_ads_drafts_v1")||"[]"),editId=campaignComposer.editingDraftId;if(editId){const i=arr.findIndex(x=>x.id===editId);if(i>=0){d.id=editId;d.created_at=arr[i].created_at;d.updated_at=new Date().toISOString();arr[i]=d}else arr.unshift(d);campaignComposer.editingDraftId=null}else arr.unshift(d);localStorage.setItem("bariq_ads_drafts_v1",JSON.stringify(arr.slice(0,50)));renderDrafts();toast(editId?"تم تحديث المسودة":"تم حفظ الحملة كمسودة")}
function draftTargetLabel(d){if(d?.targeting?.mode==="custom"){const parts=[...(d.targeting.emirates||[]),...(d.targeting.areas||[])];return parts.length?parts.join("، "):"مناطق محددة"}return "كل الإمارات"}
function deleteDraft(id){if(!confirm("حذف هذه المسودة نهائيًا؟"))return;const arr=JSON.parse(localStorage.getItem("bariq_ads_drafts_v1")||"[]").filter(d=>d.id!==id);localStorage.setItem("bariq_ads_drafts_v1",JSON.stringify(arr));renderDrafts();toast("تم حذف المسودة")}
function editDraft(id){const arr=JSON.parse(localStorage.getItem("bariq_ads_drafts_v1")||"[]"),d=arr.find(x=>x.id===id);if(!d)return;campaignComposer.editingDraftId=id;campaignComposer.selectedIds=(d.products||[]).map(p=>Number(p.id)).filter(Boolean);campaignComposer.format=d.ad_format||((d.products||[]).length>1?"carousel":"single");campaignComposer.creativeSource="product";campaignComposer.targetMode=d.targeting?.mode||"all_uae";campaignComposer.budgetMode=d.budget_mode||"daily";document.querySelector("#adForm").dataset.productIds=campaignComposer.selectedIds.join(",");document.querySelector("#adDialogTitle").textContent=`تعديل المسودة — ${d.campaign_name||"حملة"}`;document.querySelector("#campaignName").value=d.campaign_name||"";document.querySelector("#objective").value=d.objective||"OUTCOME_SALES";document.querySelector("#primaryText").value=d.primary_text||"";document.querySelector("#cta").value=d.cta||"SHOP_NOW";document.querySelector("#durationDays").value=d.duration_days||7;document.querySelector("#dailyBudget").value=d.daily_budget||50;document.querySelector("#totalBudget").value=d.total_budget||((d.daily_budget||50)*(d.duration_days||7));setCampaignFormat(campaignComposer.format);setCreativeSource("product");setTargetMode(campaignComposer.targetMode);setBudgetMode(campaignComposer.budgetMode);if(d.targeting?.mode==="custom"){document.querySelectorAll("#customTargetingBox input[type=checkbox]").forEach(x=>x.checked=(d.targeting.emirates||[]).includes(x.value));document.querySelector("#customAreasInput").value=(d.targeting.areas||[]).join("، ")}syncCampaignProductSelect();renderCampaignSelectedProducts();calcBudget();renderPreview();document.querySelector("#adDialog").showModal()}
window.editDraft=editDraft;window.deleteDraft=deleteDraft;
function renderDrafts(){const arr=JSON.parse(localStorage.getItem("bariq_ads_drafts_v1")||"[]"),box=document.querySelector("#draftsList");if(!box)return;if(!arr.length){box.innerHTML='<div class="notice">لا توجد مسودات.</div>';return}box.innerHTML=`<div class="drafts-grid">${arr.map(d=>{const products=d.products||[],imgs=products.filter(p=>p.image).slice(0,4);return `<article class="draft-card"><div class="draft-media">${imgs.length?imgs.map((p,i)=>`<img src="${esc(p.image)}" alt="${esc(p.name||"")}" style="z-index:${10-i}">`).join(""):'<div class="draft-no-media">لا توجد صورة</div>'}</div><div class="draft-body"><div class="draft-top"><span class="draft-type">${d.ad_format==="carousel"?"إعلان دائري":"إعلان منفرد"}</span><small>${new Date(d.created_at).toLocaleString("ar-AE")}</small></div><h3>${esc(d.campaign_name||"مسودة حملة")}</h3><p>${esc(d.primary_text||"بدون نص إعلاني")}</p><div class="draft-meta"><span><b>${products.length}</b> منتج</span><span><b>${money(d.total_budget||((d.daily_budget||0)*(d.duration_days||0)))}</b> الميزانية</span><span><b>${d.duration_days||"—"}</b> يوم</span><span><b>${esc(draftTargetLabel(d))}</b> الاستهداف</span></div><div class="draft-products">${products.slice(0,3).map(p=>`<span>${esc(p.name||p.id)}</span>`).join("")}${products.length>3?`<span>+${products.length-3}</span>`:""}</div><div class="draft-actions"><button class="btn ghost" onclick="editDraft('${d.id}')">✎ تعديل</button><button class="btn danger" onclick="deleteDraft('${d.id}')">🗑 حذف</button></div></div></article>`}).join("")}</div>`}

async function publish(){
  if(!state.meta?.connected){toast("اربط ميتا أولًا");return}
  const s=selection();if(!s.ad_account_id||!s.page_id){toast("اختر الحساب الإعلاني وصفحة فيسبوك من الإعدادات");return}
  const payload=draftPayload(),items=campaignCreativeItems();
  if(payload.ad_format==="carousel"&&items.length<2){toast("الإعلان الدائري يحتاج عنصرين على الأقل");return}
  if(payload.targeting.mode==="custom"&&!payload.targeting.emirates.length&&!payload.targeting.areas.length){toast("حدد منطقة استهداف واحدة على الأقل");return}
  if(payload.total_budget>=5000&&!confirm(`أنت على وشك نشر حملة بإجمالي تقريبي ${money(payload.total_budget)}. هل أنت متأكد؟`))return;
  if(campaignComposer.creativeSource==="custom"&&campaignComposer.media.length){toast("تم تجهيز رفع الصور والفيديو داخل الواجهة، ويلزم رفعها للخادم قبل إرسالها إلى ميتا.");return}
  try{
    document.querySelector("#publishAdBtn").disabled=true;document.querySelector("#publishAdBtn").textContent="جاري النشر…";
    const data=await api("/api/meta/publish",{method:"POST",body:JSON.stringify({...payload,...s})});
    toast(`تم إنشاء الإعلان: ${data.ad_id||"تم"}`);document.querySelector("#adDialog").close();await Promise.all([loadCampaigns(),loadInsights()])
  }catch(e){toast(`فشل النشر: ${e.message}`)}
  finally{document.querySelector("#publishAdBtn").disabled=false;document.querySelector("#publishAdBtn").textContent="تأكيد ونشر"}
}

function bind(){
  $$("#studioNav button").forEach(b=>b.onclick=()=>{$$("#studioNav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".view").forEach(v=>v.classList.remove("active"));$(`#view-${b.dataset.view}`).classList.add("active")});
  $("#connectMetaBtn").onclick=()=>location.href="/api/meta/oauth-start";
  $("#refreshBtn").onclick=async()=>{await loadProducts();await loadMetaStatus()};
  $("#rangeSelect").onchange=loadInsights;$("#productSearch").oninput=renderProducts;$("#categoryFilter").onchange=renderProducts;$("#productSort").onchange=renderProducts;
  $("#prevProducts").onclick=()=>{if(state.page>0){state.page--;loadProducts()}};$("#nextProducts").onclick=()=>{state.page++;loadProducts()};
  $("#clearSelectionBtn").onclick=()=>{state.selected.clear();renderProducts()};$("#carouselAdBtn").onclick=()=>{if(state.selected.size<2)return toast("اختر منتجين على الأقل");openAd([...state.selected])};$("#separateAdsBtn").onclick=()=>toast("استخدم Create Ad لكل منتج في الـMVP الأول.");
  $("#quickAdBtn").onclick=()=>{const p=state.products[0];p?openAd([p.id]):toast("لا توجد منتجات محملة")};$("#createCampaignBtn").onclick=()=>{const p=state.products[0];p?openAd([p.id]):toast("اختر منتجًا")};
  $("#pageSelect").onchange=fillInstagram;$("#saveMetaSelectionBtn").onclick=()=>{const s={ad_account_id:$("#adAccountSelect").value,page_id:$("#pageSelect").value,instagram_account_id:$("#instagramSelect").value};localStorage.setItem("bariq_ads_meta_selection",JSON.stringify(s));toast("تم حفظ الاختيارات");loadCampaigns();loadInsights()};
  $("#disconnectMetaBtn").onclick=async()=>{try{await api("/api/meta/disconnect",{method:"POST",body:"{}"});localStorage.removeItem("bariq_ads_meta_selection");await loadMetaStatus();toast("تم فصل Meta")}catch(e){toast(e.message)}};
  ["#dailyBudget","#durationDays"].forEach(s=>$(s).oninput=calcBudget);$("#primaryText").oninput=()=>{const ids=$("#adForm").dataset.productIds?.split(",").map(Number)||[];renderPreview(ids.map(id=>state.products.find(p=>p.id===id)).filter(Boolean))};
  $("#saveDraftBtn").onclick=saveDraft;$("#reviewAdBtn").onclick=()=>toast("راجع المعاينة والميزانية ثم اضغط Confirm & Publish");$("#publishAdBtn").onclick=publish;

  document.querySelectorAll('input[name="adFormat"]').forEach(r=>r.addEventListener("change",()=>setCampaignFormat(r.value)));
  document.querySelectorAll('input[name="creativeSource"]').forEach(r=>r.addEventListener("change",()=>setCreativeSource(r.value)));
  document.querySelectorAll('input[name="targetMode"]').forEach(r=>r.addEventListener("change",()=>setTargetMode(r.value)));
  document.querySelectorAll('input[name="budgetMode"]').forEach(r=>r.addEventListener("change",()=>setBudgetMode(r.value)));
  document.querySelector("#campaignProductSearch")?.addEventListener("input",syncCampaignProductSelect);
  document.querySelector("#addCampaignProductBtn")?.addEventListener("click",()=>addCampaignProduct(document.querySelector("#campaignProductSelect")?.value));
  document.querySelector("#campaignMediaInput")?.addEventListener("change",e=>addCampaignMedia(e.target.files||[]));
  const campaignDrop=document.querySelector(".campaign-dropzone");
  if(campaignDrop){
    campaignDrop.addEventListener("dragover",e=>{e.preventDefault();campaignDrop.classList.add("drag")});
    campaignDrop.addEventListener("dragleave",()=>campaignDrop.classList.remove("drag"));
    campaignDrop.addEventListener("drop",e=>{e.preventDefault();campaignDrop.classList.remove("drag");addCampaignMedia(e.dataTransfer.files||[])});
  }
  document.querySelector("#customAreasInput")?.addEventListener("input",updateComposerChecklist);
  document.querySelectorAll("#customTargetingBox input[type='checkbox']").forEach(x=>x.addEventListener("change",updateComposerChecklist));
  document.querySelector("#dailyBudget")?.addEventListener("input",calcBudget);
  document.querySelector("#totalBudget")?.addEventListener("input",calcBudget);
  document.querySelector("#durationDays")?.addEventListener("input",calcBudget);
  document.querySelector("#primaryText")?.addEventListener("input",renderPreview);
  document.querySelector("#campaignName")?.addEventListener("input",renderPreview);
  document.querySelector("#cta")?.addEventListener("change",renderPreview);
  document.querySelectorAll("[data-preview-placement]").forEach(b=>b.addEventListener("click",()=>{
    campaignComposer.placement=b.dataset.previewPlacement;
    document.querySelectorAll("[data-preview-placement]").forEach(x=>x.classList.toggle("active",x===b));
    renderPreview();
  }));

}
bind();renderDrafts();loadProducts();loadMetaStatus();

// ===== Marketing Intelligence =====
const marketingState={days:30,orders:[],customers:[],rows:[],metaSummary:null};
const EMIRATES=[
  {key:"Dubai",ar:"دبي",aliases:["dubai","دبي"]},
  {key:"Abu Dhabi",ar:"أبوظبي",aliases:["abu dhabi","abudhabi","أبوظبي","ابوظبي","العين","al ain"]},
  {key:"Sharjah",ar:"الشارقة",aliases:["sharjah","الشارقة","شارقة"]},
  {key:"Ajman",ar:"عجمان",aliases:["ajman","عجمان"]},
  {key:"Ras Al Khaimah",ar:"رأس الخيمة",aliases:["ras al khaimah","rak","رأس الخيمة","راس الخيمة"]},
  {key:"Fujairah",ar:"الفجيرة",aliases:["fujairah","الفجيرة"]},
  {key:"Umm Al Quwain",ar:"أم القيوين",aliases:["umm al quwain","uaq","أم القيوين","ام القيوين"]}
];
function normalizeText(v){return String(v||"").toLowerCase().replace(/\s+/g," ").trim()}
function normalizeArabicGeo(v){return normalizeText(v).normalize("NFD").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي")}
function normalizePhone(v){let d=String(v||"").replace(/\D/g,"");if(d.startsWith("00971"))d=d.slice(2);if(d.startsWith("0")&&d.length<=10)d="971"+d.slice(1);return d}
function normalizeAdminArea(value){
  const raw=String(value||"").trim();
  if(!raw)return "";
  const first=raw.split("،")[0].split(",")[0].trim();
  const low=first.toLowerCase();
  if(/^(غير\s*محدد|unknown|undefined|null|موقع\s*العميل|لم\s*يسمح)/i.test(low))return "";
  return first;
}
function adminPhoneDigits(value){
  return String(value||"").replace(/\D/g,"");
}

function customerAreaByIdentity(phone,email){
  const cleanPhone=adminPhoneDigits(phone);
  const cleanEmail=String(email||"").trim().toLowerCase();
  const customer=(marketingState.customers||[]).find(c=>
    (cleanPhone && adminPhoneDigits(c.phone)===cleanPhone) ||
    (cleanEmail && String(c.email||"").trim().toLowerCase()===cleanEmail)
  );
  return normalizeAdminArea(customer?.city || customer?.address || "");
}

function customerByOrder(o){
  const id=String(o?.customer_id||"");
  if(id){
    const byId=(marketingState.customers||[]).find(c=>String(c.id)===id);
    if(byId)return byId;
  }

  const sh=(o?.shipping && typeof o.shipping==="object") ? o.shipping : {};
  const profile=(o?.profile && typeof o.profile==="object") ? o.profile : {};
  const phone=o?.customerPhone || o?.customer_phone || o?.phone || sh.phone || profile.phone || "";
  const email=o?.customerEmail || o?.customer_email || o?.email || sh.email || profile.email || "";

  const cleanPhone=adminPhoneDigits(phone);
  const cleanEmail=String(email||"").trim().toLowerCase();

  return (marketingState.customers||[]).find(c=>
    (cleanPhone && adminPhoneDigits(c.phone)===cleanPhone) ||
    (cleanEmail && String(c.email||"").trim().toLowerCase()===cleanEmail)
  ) || null;
}

function areaFromOrder(o){
  const address=o?.address || o?.shipping_address || o?.shippingAddress || "";
  const full=(o?.address_full && typeof o.address_full==="object")
    ? o.address_full
    : ((o?.shipping && typeof o.shipping==="object") ? o.shipping : {});

  const sh=(o?.shipping && typeof o.shipping==="object") ? o.shipping : {};
  const profile=(o?.profile && typeof o.profile==="object") ? o.profile : {};
  const phone=o?.customerPhone || o?.customer_phone || o?.phone || sh.phone || profile.phone || "";
  const email=o?.customerEmail || o?.customer_email || o?.email || sh.email || profile.email || "";

  // Same priority used by admin.html emAreaFromOrder()
  const area=
    o?.city ||
    o?.shipping_city ||
    o?.customerCity ||
    o?.customer_city ||
    full.city ||
    full.area ||
    address ||
    customerAreaByIdentity(phone,email) ||
    "غير محدد";

  return normalizeAdminArea(area) || "غير محدد";
}

function remoteOrderToMarketingOrder(r){
  const customerName=r?.customer_name || "";
  const customerPhone=r?.customer_phone || "";
  const customerEmail=r?.customer_email || "";
  const addressObj=(r?.address && typeof r.address==="object") ? r.address : {};

  const orderArea=normalizeAdminArea(
    r?.shipping_city ||
    r?.customer_city ||
    addressObj.city ||
    addressObj.area ||
    r?.shipping_address ||
    (typeof r?.address==="string" ? r.address : "") ||
    ""
  );

  const resolvedArea=orderArea || customerAreaByIdentity(customerPhone,customerEmail);

  return {
    ...r,
    customerName: customerName,
    customerPhone: customerPhone,
    customerEmail: customerEmail,
    city: resolvedArea || r?.city || "",
    address: resolvedArea || (typeof r?.address==="string" ? r.address : "") || "",
    shipping_city: r?.shipping_city || resolvedArea || "",
    customerCity: r?.customer_city || resolvedArea || ""
  };
}

function detectEmirate(row){
  const customer=customerByOrder(row);
  const area=areaFromOrder(row);
  const text=normalizeArabicGeo([area,row?.emirate,row?.city,row?.area,row?.address,row?.shipping_address,row?.delivery_address,row?.customer_address,customer?.city,customer?.address,customer?.country,row?.notes].filter(Boolean).join(" "));
  for(const e of EMIRATES)if(e.aliases.some(a=>text.includes(normalizeArabicGeo(a))))return e.key;
  return area && area!=="غير محدد" ? area : "غير محدد";
}
function orderRevenue(o){for(const k of ["total","total_amount","grand_total","amount","order_total","price"]){const n=Number(o?.[k]);if(Number.isFinite(n)&&n>=0)return n}return 0}
function orderDate(o){const v=o.created_at||o.date||o.order_date||o.updated_at;const d=v?new Date(v):null;return d&&!isNaN(d)?d:null}
function customerKey(o){
  const sh=(o?.shipping&&typeof o.shipping==="object")?o.shipping:{};
  return adminPhoneDigits(o.customerPhone||o.customer_phone||o.phone||o.mobile||sh.phone) ||
    normalizeText(o.customerEmail||o.customer_email||o.email||sh.email) ||
    normalizeText(o.customerName||o.customer_name||o.name||sh.name) ||
    `order-${o.id}`;
}
function extractOrderProductNames(o){
  const out=[];
  if(Array.isArray(o.items))o.items.forEach(i=>out.push(i?.name_ar||i?.name||i?.product_name||i?.title||i?.product?.name_ar||i?.product?.name));
  if(o.product_name)out.push(o.product_name);
  if(o.product)out.push(typeof o.product==="string"?o.product:(o.product.name_ar||o.product.name));
  return out.filter(Boolean)
}
async function syncMarketingCustomersFromSupabase(){
  const PAGE=1000;
  let offset=0;
  const all=[];

  while(true){
    const batch=await window.sbFetch(
      `customers?select=id,full_name,email,phone,country,city,address,active,created_at&order=created_at.desc&limit=${PAGE}&offset=${offset}`,
      {requireAuth:true}
    );

    if(!Array.isArray(batch) || !batch.length)break;

    all.push(...batch.map(c=>({
      id:c.id,
      full_name:c.full_name || c.name || "—",
      name:c.full_name || c.name || "—",
      phone:c.phone || "",
      email:c.email || "",
      country:c.country || "",
      city:c.city || "",
      address:c.address || "",
      active:c.active
    })));

    if(batch.length<PAGE)break;
    offset+=PAGE;
  }

  marketingState.customers=all;
  return all;
}

async function loadMarketingOrders(){
  try{
    if(typeof window.sbFetch!=="function")throw new Error("Supabase unavailable");

    // Important: admin.html loads customers first because order rows often have no city/customer_id.
    await syncMarketingCustomersFromSupabase();

    const orderRows=await window.sbFetch(
      "orders?select=*&order=created_at.desc&limit=5000",
      {requireAuth:true}
    );

    marketingState.orders=(Array.isArray(orderRows)?orderRows:[]).map(remoteOrderToMarketingOrder);

    console.info("[Ads Studio] marketing data",{
      orders:marketingState.orders.length,
      customers:marketingState.customers.length,
      resolvedAreas:marketingState.orders.filter(o=>areaFromOrder(o)!=="غير محدد").length
    });

    if(marketingState.orders.length && !marketingState.customers.length){
      throw new Error("تم تحميل الطلبات لكن جدول العملاء رجع فارغًا.");
    }

    renderMarketingIntelligence();
  }catch(e){
    console.error("[Ads Studio] customer locations failed",e);
    const msg=`تعذر تحميل أماكن العملاء: ${e.message}`;
    ["#topAreasList","#topAreaProducts","#locationsTable","#recommendedTargeting"].forEach(s=>{
      const el=$(s);
      if(el)el.innerHTML=`<div class="notice">${esc(msg)}</div>`;
    });
  }
}

function filteredMarketingOrders(){
  if(marketingState.days==="all")return marketingState.orders.slice();
  const cutoff=Date.now()-Number(marketingState.days)*86400000;
  return marketingState.orders.filter(o=>{const d=orderDate(o);return d&&d.getTime()>=cutoff})
}
function aggregateMarketing(){
  const orders=filteredMarketingOrders(),customers=new Map(),areas=new Map(),productsByArea=new Map(),weekdays=Array(7).fill(0),hours=Array(24).fill(0);
  let revenue=0,geoKnown=0;
  orders.forEach(o=>{
    const rev=orderRevenue(o);revenue+=rev;
    const ck=customerKey(o);customers.set(ck,(customers.get(ck)||0)+1);
    const emirate=detectEmirate(o);if(emirate!=="غير محدد")geoKnown++;
    const rawArea=areaFromOrder(o);
    const city=rawArea&&rawArea!=="غير محدد"?rawArea:(EMIRATES.find(e=>e.key===emirate)?.ar||"غير محدد");
    const canonicalEmirate=EMIRATES.some(e=>e.key===emirate)?emirate:"غير محدد";
    const key=canonicalEmirate==="غير محدد"?city:`${canonicalEmirate}||${city}`;
    if(!areas.has(key))areas.set(key,{emirate:canonicalEmirate,city,orders:0,revenue:0,customers:new Set(),products:new Map()});
    const a=areas.get(key);a.orders++;a.revenue+=rev;a.customers.add(ck);
    extractOrderProductNames(o).forEach(name=>a.products.set(name,(a.products.get(name)||0)+1));
    if(!productsByArea.has(emirate))productsByArea.set(emirate,new Map());
    extractOrderProductNames(o).forEach(name=>{const m=productsByArea.get(emirate);m.set(name,(m.get(name)||0)+1)});
    const d=orderDate(o);if(d){weekdays[d.getDay()]++;hours[d.getHours()]++}
  });
  const returning=[...customers.values()].filter(n=>n>1).length,newCustomers=customers.size-returning;
  const areaRows=[...areas.values()].map(a=>({...a,customers:a.customers.size,aov:a.orders?a.revenue/a.orders:0,topProduct:[...a.products.entries()].sort((x,y)=>y[1]-x[1])[0]?.[0]||"—"}));
  const emirates={};EMIRATES.forEach(e=>emirates[e.key]={orders:0,revenue:0,customers:new Set(),products:new Map()});
  orders.forEach(o=>{
    const detected=detectEmirate(o);const e=EMIRATES.some(x=>x.key===detected)?detected:null;if(!e||!emirates[e])return;
    const a=emirates[e];a.orders++;a.revenue+=orderRevenue(o);a.customers.add(customerKey(o));extractOrderProductNames(o).forEach(n=>a.products.set(n,(a.products.get(n)||0)+1))
  });
  Object.values(emirates).forEach(a=>{a.customerCount=a.customers.size;a.aov=a.orders?a.revenue/a.orders:0;a.topProduct=[...a.products.entries()].sort((x,y)=>y[1]-x[1])[0]?.[0]||"—"});
  return{orders,customers,revenue,returning,newCustomers,areaRows,emirates,weekdays,hours,geoKnown}
}
function renderMarketingIntelligence(){
  const d=aggregateMarketing(),ordersCount=d.orders.length,customerCount=d.customers.size,aov=ordersCount?d.revenue/ordersCount:0,repeatRate=customerCount?d.returning/customerCount*100:0;
  const topEmirate=Object.entries(d.emirates).sort((a,b)=>b[1].revenue-a[1].revenue)[0];
  const dayNames=["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"],topDayIndex=d.weekdays.indexOf(Math.max(...d.weekdays));
  $("#mkCustomers").textContent=customerCount.toLocaleString("en-US");$("#mkCustomersFoot").textContent=`${ordersCount.toLocaleString("en-US")} طلب`;
  $("#mkRevenue").textContent=money(d.revenue);$("#mkRevenueFoot").textContent="من الطلبات الفعلية";
  $("#mkAov").textContent=money(aov);$("#mkAovFoot").textContent="متوسط قيمة الطلب";
  $("#mkRepeat").textContent=`${repeatRate.toFixed(1)}%`;$("#mkRepeatFoot").textContent=`${d.returning} عميل متكرر`;
  $("#mkTopEmirate").textContent=topEmirate?EMIRATES.find(e=>e.key===topEmirate[0])?.ar||topEmirate[0]:"—";$("#mkTopEmirateFoot").textContent=topEmirate?money(topEmirate[1].revenue):"—";
  $("#mkTopDay").textContent=ordersCount?dayNames[topDayIndex]:"—";$("#mkTopDayFoot").textContent=ordersCount?`${d.weekdays[topDayIndex]} طلب`:"—";
  $("#mapCoverageBadge").textContent=`Coverage ${ordersCount?Math.round(d.geoKnown/ordersCount*100):0}%`;
  renderEmirates(d);renderCustomerMix(d);renderAreaLists(d);renderTimeCharts(d);renderLocationTable(d);renderRecommendations(d);renderMarketingScore(d);renderMetaOverlay();
}
function renderEmirates(d){
  $$(".emirate-card").forEach(card=>{
    const e=d.emirates[card.dataset.emirate]||{orders:0,revenue:0,aov:0,topProduct:"—"};
    card.querySelector("b").textContent=money(e.revenue);
    card.querySelector("small").textContent=`${e.orders} طلب • AOV ${money(e.aov)}`;
    card.onclick=()=>{$$(".emirate-card").forEach(x=>x.classList.remove("active"));card.classList.add("active");$("#selectedEmirateDetail").innerHTML=`<div class="intel-item"><div><strong>${card.querySelector("span").textContent}</strong><small>${e.orders} طلب • ${e.customerCount||0} عميل • أفضل منتج: ${esc(e.topProduct)}</small></div><div class="metric">${money(e.revenue)}</div></div>`}
  })
}
function renderCustomerMix(d){
  const total=d.customers.size,ratio=total?d.returning/total:0,deg=Math.round(ratio*360);
  $("#customerDonut").style.background=`conic-gradient(#6dd5b2 0 ${deg}deg,var(--erp-primary) ${deg}deg 360deg)`;
  $("#customerDonut").querySelector("span").textContent=total?`${(ratio*100).toFixed(0)}%`:"—";
  $("#newCustomersValue").textContent=d.newCustomers;$("#returningCustomersValue").textContent=d.returning;
  $("#repeatRateValue").textContent=total?`${(ratio*100).toFixed(1)}%`:"—";
  $("#ordersPerCustomerValue").textContent=total?(d.orders.length/total).toFixed(2):"—";
  const top=d.areaRows.slice().sort((a,b)=>b.customers-a.customers)[0];$("#topCustomerAreaValue").textContent=top?.city||"—";
  $("#revenuePerCustomerValue").textContent=total?money(d.revenue/total):"—";
}
function renderAreaLists(d){
  const top=d.areaRows.slice().sort((a,b)=>b.revenue-a.revenue).slice(0,8);
  $("#topAreasList").innerHTML=top.length?top.map((a,i)=>`<div class="intel-item"><div><strong>${i+1}. ${esc(a.city)}</strong><small>${a.orders} طلب • ${a.customers} عميل • AOV ${money(a.aov)}</small></div><div class="metric">${money(a.revenue)}</div></div>`).join(""):'<div class="notice">لا توجد بيانات جغرافية كافية.</div>';
  const prods=[];
  for(const [em,map] of new Map(Object.entries(d.emirates)).entries()){
    const row=d.emirates[em],topP=[...row.products.entries()].sort((a,b)=>b[1]-a[1])[0];
    if(topP)prods.push({em,name:topP[0],count:topP[1]})
  }
  $("#topAreaProducts").innerHTML=prods.length?prods.sort((a,b)=>b.count-a.count).map(x=>`<div class="intel-item"><div><strong>${EMIRATES.find(e=>e.key===x.em)?.ar||x.em}</strong><small>${esc(x.name)}</small></div><div class="metric">${x.count} طلب</div></div>`).join(""):'<div class="notice">لا توجد بيانات منتجات كافية.</div>';
}
function renderTimeCharts(d){
  const days=["أحد","إثن","ثلا","أرب","خمي","جمع","سبت"],maxD=Math.max(1,...d.weekdays);
  $("#weekdayChart").innerHTML=d.weekdays.map((v,i)=>`<div class="intel-bar"><b>${v}</b><i style="height:${Math.max(4,v/maxD*150)}px"></i><small>${days[i]}</small></div>`).join("");
  const maxH=Math.max(1,...d.hours);$("#hourChart").innerHTML=d.hours.map((v,i)=>`<div class="intel-bar"><b>${v||""}</b><i style="height:${Math.max(3,v/maxH*145)}px"></i><small>${i}</small></div>`).join("");
}
function getAreaAdminState(){try{return JSON.parse(localStorage.getItem("bariq_ads_area_admin_v1")||'{"overrides":{},"excluded":[]}')}catch{return{overrides:{},excluded:[]}}}
function areaAdminKey(a){return `${a.emirate||""}||${a.city||""}`}
function applyAreaAdminState(rows){const st=getAreaAdminState(),excluded=new Set(st.excluded||[]);return rows.filter(a=>!excluded.has(areaAdminKey(a))).map(a=>{const ov=st.overrides?.[areaAdminKey(a)];return ov?{...a,city:ov.city||a.city,emirate:ov.emirate||a.emirate}:a})}
function editAreaRow(encoded){const key=decodeURIComponent(encoded),d=aggregateMarketing(),row=d.areaRows.find(a=>areaAdminKey(a)===key);if(!row)return;const next=prompt("اسم المنطقة الجديد",row.city||"");if(next===null)return;const st=getAreaAdminState();st.overrides=st.overrides||{};st.overrides[key]={city:next.trim()||row.city,emirate:row.emirate};localStorage.setItem("bariq_ads_area_admin_v1",JSON.stringify(st));renderMarketingIntelligence();toast("تم تعديل اسم المنطقة في التحليل")}
function deleteAreaRow(encoded){const key=decodeURIComponent(encoded);if(!confirm("استبعاد هذه المنطقة من جداول التحليل؟ لن يتم حذف الطلبات أو بيانات العملاء الأصلية."))return;const st=getAreaAdminState();st.excluded=[...new Set([...(st.excluded||[]),key])];localStorage.setItem("bariq_ads_area_admin_v1",JSON.stringify(st));renderMarketingIntelligence();toast("تم استبعاد المنطقة من التحليل")}
window.editAreaRow=editAreaRow;window.deleteAreaRow=deleteAreaRow;
function renderLocationTable(d){
  const q=normalizeText($("#locationSearch")?.value),sort=$("#locationSort")?.value||"revenue";
  let rows=applyAreaAdminState(d.areaRows).filter(a=>!q||normalizeText(`${a.city} ${a.emirate}`).includes(q));
  rows.sort((a,b)=>Number(b[sort]||0)-Number(a[sort]||0));
  $("#locationsTable").innerHTML=rows.length?`<table><thead><tr><th>المنطقة</th><th>الإمارة</th><th>العملاء</th><th>الطلبات</th><th>المبيعات</th><th>متوسط الطلب</th><th>أفضل منتج</th><th>الإجراءات</th></tr></thead><tbody>${rows.map(a=>{const k=encodeURIComponent(areaAdminKey(a));return `<tr><td>${esc(a.city)}</td><td>${esc(EMIRATES.find(e=>e.key===a.emirate)?.ar||a.emirate)}</td><td>${a.customers}</td><td>${a.orders}</td><td>${money(a.revenue)}</td><td>${money(a.aov)}</td><td>${esc(a.topProduct)}</td><td><div class="row-actions"><button class="table-action edit" onclick="editAreaRow('${k}')">تعديل</button><button class="table-action delete" onclick="deleteAreaRow('${k}')">حذف</button></div></td></tr>`}).join("")}</tbody></table>`:'<div class="notice">لا توجد نتائج.</div>';
  const byAov=rows.filter(a=>a.orders>=2).slice().sort((a,b)=>b.aov-a.aov).slice(0,5);
  $("#highValueAreas").innerHTML=byAov.map(a=>`<div class="intel-item"><div><strong>${esc(a.city)}</strong><small>${a.orders} طلب • ${a.customers} عميل</small></div><div class="metric">${money(a.aov)} AOV</div></div>`).join("")||'<div class="notice">بيانات غير كافية.</div>';
  const growth=rows.filter(a=>a.orders>=2&&a.revenue>0).slice().sort((a,b)=>(b.aov*Math.log2(b.orders+1))-(a.aov*Math.log2(a.orders+1))).slice(0,5);
  $("#growthAreas").innerHTML=growth.map(a=>`<div class="intel-item"><div><strong>${esc(a.city)}</strong><small>إشارة نمو: طلبات متكررة + قيمة طلب جيدة</small></div><div class="metric">${a.orders} طلب</div></div>`).join("")||'<div class="notice">بيانات غير كافية.</div>';
}
function renderRecommendations(d){
  const rec=[],warn=[],opp=[];
  const topAreas=d.areaRows.filter(a=>a.orders>=2).sort((a,b)=>b.revenue-a.revenue);
  if(topAreas[0])rec.push({kind:"good",title:`ابدأ اختبار استهداف أقوى في ${topAreas[0].city}`,text:`حقق ${topAreas[0].orders} طلب ومبيعات ${money(topAreas[0].revenue)} بمتوسط طلب ${money(topAreas[0].aov)}.`});
  const topProductArea=topAreas.find(a=>a.topProduct&&a.topProduct!=="—");
  if(topProductArea)rec.push({kind:"good",title:`استخدم ${topProductArea.topProduct} في إعلان مخصص لـ ${topProductArea.city}`,text:"المنتج هو الأكثر تكرارًا داخل هذه المنطقة في بيانات الطلبات الحالية."});
  const total=d.customers.size,repeat=total?d.returning/total*100:0;
  if(repeat<15&&total>=10)warn.push({title:"نسبة العملاء المتكررين منخفضة",text:`Repeat Rate الحالي ${repeat.toFixed(1)}%. اختبر Retargeting وعروض إعادة الشراء.`});
  if(d.orders.length&&d.geoKnown/d.orders.length<.7)warn.push({title:"تغطية بيانات الموقع غير مكتملة",text:"أقل من 70% من الطلبات يمكن ربطها بإمارة. تحسين حقول العنوان سيرفع جودة الاستهداف."});
  topAreas.slice(0,3).forEach(a=>opp.push({title:a.city,text:`AOV ${money(a.aov)} • ${a.orders} طلب • أفضل منتج ${a.topProduct}`}));
  $("#recommendedTargeting").innerHTML=rec.length?rec.map(x=>`<div class="recommendation-card ${x.kind}"><strong>${esc(x.title)}</strong><small>${esc(x.text)}</small></div>`).join(""):'<div class="notice">Not enough data.</div>';
  $("#warningsList").innerHTML=warn.length?warn.map(x=>`<div class="recommendation-card warn"><strong>${esc(x.title)}</strong><small>${esc(x.text)}</small></div>`).join(""):'<div class="recommendation-card good"><strong>لا توجد تحذيرات قوية حاليًا</strong><small>سيتم تحديث هذا القسم مع زيادة البيانات.</small></div>';
  $("#opportunitiesList").innerHTML=opp.length?opp.map(x=>`<div class="recommendation-card good"><strong>${esc(x.title)}</strong><small>${esc(x.text)}</small></div>`).join(""):'<div class="notice">Not enough data.</div>';
  $("#overlayAction").textContent=topAreas[0]?`اختبر زيادة تدريجية في ${topAreas[0].city}`:"اجمع بيانات أكثر";
}
function renderMarketingScore(d){
  let score=0;if(d.orders.length>=10)score+=20;if(d.orders.length>=50)score+=10;if(d.customers.size>=10)score+=15;if(d.geoKnown/Math.max(1,d.orders.length)>=.7)score+=20;if(d.returning>0)score+=10;if(d.revenue>0)score+=10;if(state.meta?.connected)score+=15;
  score=Math.min(100,score);$("#marketingScoreRing").style.background=`conic-gradient(var(--erp-primary) 0 ${score*3.6}deg,#e5eaf2 ${score*3.6}deg 360deg)`;$("#marketingScoreRing").querySelector("span").textContent=`${score}/100`;
  $("#marketingScoreText").textContent=score>=80?"البيانات قوية لاتخاذ قرارات استهداف عملية.":score>=55?"البيانات جيدة، لكن بعض الشرائح تحتاج حجمًا أكبر.":"البيانات ما زالت محدودة؛ استخدم التوصيات كاختبارات صغيرة وليس قرارات نهائية.";
}
function renderMetaOverlay(){
  $("#overlayMetaState").textContent=state.meta?.connected?"متصل":"غير متصل";
  const s=marketingState.metaSummary||{};$("#overlayCtr").textContent=s.ctr!=null?`${Number(s.ctr).toFixed(2)}%`:"—";$("#overlayCpc").textContent=s.cpc!=null?money(s.cpc):"—";$("#overlayRoas").textContent=s.roas!=null?`${Number(s.roas).toFixed(2)}x`:"—";$("#overlayPurchases").textContent=s.purchases??"—";
}
async function loadMarketingMetaOverlay(){
  try{const s=selection();if(!state.meta?.connected||!s.ad_account_id){marketingState.metaSummary=null;renderMetaOverlay();return}const data=await api(`/api/meta/insights?ad_account_id=${encodeURIComponent(s.ad_account_id)}&range=30d`);marketingState.metaSummary=data.summary||null;renderMetaOverlay()}catch(_){marketingState.metaSummary=null;renderMetaOverlay()}
}
$$("[data-marketing-period]").forEach(b=>b.onclick=()=>{$$("[data-marketing-period]").forEach(x=>x.classList.remove("active"));b.classList.add("active");marketingState.days=b.dataset.marketingPeriod;renderMarketingIntelligence()});
if($("#locationSearch"))$("#locationSearch").oninput=()=>renderLocationTable(aggregateMarketing());
if($("#locationSort"))$("#locationSort").onchange=()=>renderLocationTable(aggregateMarketing());
if($("#refreshIntelBtn"))$("#refreshIntelBtn").onclick=async()=>{await loadMarketingOrders();await loadMarketingMetaOverlay();toast("تم تحديث التحليل التسويقي")};
const _oldLoadMetaStatus=loadMetaStatus;
loadMetaStatus=async function(){await _oldLoadMetaStatus();await loadMarketingMetaOverlay();renderMarketingIntelligence()};

// ===== FIX: wait for authenticated admin session before customer/location analytics =====
async function waitForAdsAdminAuth(timeoutMs=12000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    try{
      if(typeof window.restoreAdminSession==="function") window.restoreAdminSession();
      const ok=sessionStorage.getItem("admin_ok")==="1";
      const token=(typeof window.getValidAdminToken==="function")
        ? await window.getValidAdminToken()
        : sessionStorage.getItem("admin_token");
      if(ok && token) return token;
    }catch(_){}
    await new Promise(r=>setTimeout(r,200));
  }
  return null;
}

async function bootMarketingAfterAdminAuth(){
  const token=await waitForAdsAdminAuth();
  if(!token){
    const msg="تعذر تحميل أماكن العملاء لأن جلسة الأدمن غير جاهزة. أعد تسجيل الدخول ثم حدّث الصفحة.";
    ["#topAreasList","#topAreaProducts","#locationsTable","#recommendedTargeting"].forEach(s=>{
      const el=document.querySelector(s);
      if(el) el.innerHTML=`<div class="notice">${msg}</div>`;
    });
    return;
  }
  try{
    await loadMarketingOrders();
    await loadMarketingMetaOverlay();
  }catch(e){
    console.error("Ads Studio marketing boot failed",e);
  }
}

// Re-run automatically after admin login gate disappears / session becomes ready.
window.addEventListener("load",()=>{ bootMarketingAfterAdminAuth(); });

window.adsGeoDebug=function(limit=20){
  return (marketingState.orders||[]).slice(0,limit).map(o=>({
    order_id:o.id||o.order_number,
    phone:o.customerPhone||o.customer_phone||o.phone||"",
    email:o.customerEmail||o.customer_email||o.email||"",
    direct_city:o.shipping_city||o.customer_city||o.city||"",
    matched_customer:customerByOrder(o)?.full_name||customerByOrder(o)?.name||"",
    customer_city:customerByOrder(o)?.city||customerByOrder(o)?.address||"",
    final_area:areaFromOrder(o)
  }));
};
