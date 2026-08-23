(function(){
'use strict';


(function bpHideKnownOrtCpuWarning(){
  if(window.__bpHideKnownOrtCpuWarning)return;
  window.__bpHideKnownOrtCpuWarning=true;
  var oldWarn=console.warn.bind(console),oldError=console.error.bind(console);
  function harmless(args){
    var s='';
    try{s=Array.prototype.map.call(args,function(v){return String(v);}).join(' ');}catch(_){}
    return s.indexOf('Unknown CPU vendor')!==-1 && s.indexOf('cpuinfo_vendor value: 0')!==-1;
  }
  console.warn=function(){if(!harmless(arguments))oldWarn.apply(console,arguments);};
  console.error=function(){if(!harmless(arguments))oldError.apply(console,arguments);};
})();
if(window.BariqProductPreview)return;

var MAX_PLACE_DIM=1800;
var MAX_PRODUCT_DIM=1200;
var MIN_SCALE=.10;
var MAX_SCALE=5;
var WHITE_BASE=230;
var EDGE_SAMPLE_STEP=3;
var REMBG_ORT_URL='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/ort.min.js';
var REMBG_UMD_URL='https://unpkg.com/@bunnio/rembg-web@1.0.2/dist/index.umd.min.js';
var REMBG_MODEL_URL='/assets/models/u2netp.onnx';
var RMBG_MODEL_URL='https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx?download=true';

var S={
  open:false,initialized:false,
  modal:null,canvas:null,ctx:null,
  placeImg:null,placeUrl:'',placeFile:null,
  productImg:null,productCanvas:null,productOriginal:null,productAuto:null,productUrl:'',
  maskCanvas:null,maskCtx:null,maskMode:'erase',brushSize:46,maskDrawing:false,maskLast:null,maskUndo:[],maskRedo:[],
  productX:0,productY:0,scale:1,rotation:0,
  baseProductW:0,baseProductH:0,
  pointers:new Map(),dragging:false,dragDX:0,dragDY:0,
  pinchStartDist:0,pinchStartAngle:0,pinchStartScale:1,pinchStartRotation:0,
  exportBlob:null,exportUrl:'',tainted:false,warning:'',opacity:1,shadow:true,bodyScrollY:0,
  aiOrt:null,aiSegmenter:null,aiLoading:null,aiDevice:'',aiReady:false,rembgSession:null,rmbgSession:null,rmbgLoading:null
};

function isEn(){
  return (localStorage.getItem('lang')||document.documentElement.lang||'ar').toLowerCase().startsWith('en');
}
function tr(ar,en){return isEn()?en:ar}
function productId(){
  try{
    var q=new URLSearchParams(location.search).get('id');
    if(q)return q;
    var p=location.pathname.split('/').filter(Boolean);
    var i=p.findIndex(function(x){return x.toLowerCase()==='product'||x.toLowerCase()==='product.html'});
    return i>=0&&p[i+1]?decodeURIComponent(p[i+1]):'';
  }catch(_){return''}
}
function productName(){
  var el=document.getElementById('name');
  return String(el&&el.textContent||document.title||tr('المنتج','Product')).trim();
}
function currentProductImage(){
  var candidates=[
    document.querySelector('#mainImage'),
    document.querySelector('#prodCarousel img:not([style*="display: none"])'),
    document.querySelector('#prodCarousel img'),
    document.querySelector('.main-image img'),
    document.querySelector('.gallery img')
  ].filter(Boolean);
  for(var i=0;i<candidates.length;i++){
    var src=candidates[i].currentSrc||candidates[i].src||candidates[i].getAttribute('src')||'';
    if(src&&!/logo/i.test(src))return src;
  }
  try{
    var c=JSON.parse(sessionStorage.getItem('x2_quick_product')||'null');
    if(c&&c.img)return Array.isArray(c.img)?c.img[0]:c.img;
  }catch(_){}
  return '';
}
function esc(v){
  return String(v==null?'':v).replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch];
  });
}
function setStatus(msg,type){
  var el=S.modal&&S.modal.querySelector('.bp-status');
  if(!el)return;
  if(!msg){el.className='bp-status';el.textContent='';return}
  el.textContent=msg;
  el.className='bp-status show '+(type||'info');
}
function setProcessing(on,msg){
  var el=S.modal&&S.modal.querySelector('.bp-processing');
  if(el){
    el.classList.toggle('show',!!on);
    var t=el.querySelector('.bp-processing-text');
    if(t&&msg)t.textContent=msg;
  }
  // Also show progress inside the upload card so the screen never looks frozen.
  var st=S.modal&&S.modal.querySelector('.bp-status');
  if(st&&on&&msg){
    st.textContent=msg;
    st.className='bp-status info';
  }
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function distance(a,b){var dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy)}
function angle(a,b){return Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI}
function normalizeAngle(v){while(v>180)v-=360;while(v<-180)v+=360;return v}

function makeButton(){
  if(document.querySelector('.bp-preview-entry'))return;
  var wrap=document.createElement('div');
  wrap.className='bp-preview-entry';
  var btn=document.createElement('button');
  btn.type='button';
  btn.className='bp-preview-open';
  btn.innerHTML='<span class="bp-spark">✨</span><span>'+esc(tr('جرّب المنتج في مكانك','Preview in Your Space'))+'</span>';
  btn.addEventListener('click',open);
  wrap.appendChild(btn);

  var all=Array.from(document.querySelectorAll('button,a'));
  var customize=all.find(function(el){
    var txt=String(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    return txt.indexOf('تخصيص الطلب')>=0||txt.indexOf('customize')>=0||txt.indexOf('customise')>=0;
  });
  if(customize){
    var host=customize.closest('.product-customization')||customize.parentElement;
    if(host&&host.parentNode) host.parentNode.insertBefore(wrap,host.nextSibling);
    else customize.insertAdjacentElement('afterend',wrap);
  }else{
    var info=document.querySelector('.product-page .info,.product-page-body .info,.info');
    if(info)info.appendChild(wrap);
  }
}

function buildModal(){
  if(S.modal)return S.modal;
  var bg=document.createElement('div');
  bg.className='bp-preview-backdrop';
  bg.hidden=true;
  bg.innerHTML=
    '<section class="bp-preview-sheet" role="dialog" aria-modal="true" aria-label="'+esc(tr('جرّب المنتج في مكانك','Preview in Your Space'))+'">'+
      '<header class="bp-preview-head">'+
        '<div class="bp-preview-titlebox">'+
          '<h3 class="bp-preview-title">'+esc(tr('✨ جرّب المنتج في مكانك','✨ Preview in Your Space'))+'</h3>'+
          '<p class="bp-preview-sub">'+esc(tr('ارفع صورة المكان وشاهد شكل المنتج قبل الطلب.','Upload a photo of your space and preview the product before ordering.'))+'</p>'+
        '</div>'+
        '<button type="button" class="bp-preview-close" aria-label="'+esc(tr('إغلاق','Close'))+'">×</button>'+
      '</header>'+
      '<div class="bp-preview-body">'+
        '<div class="bp-upload-card">'+
          '<div class="bp-upload-icon">📷</div>'+
          '<div class="bp-upload-title">'+esc(tr('اختر صورة المكان','Choose a photo of your space'))+'</div>'+
          '<div class="bp-upload-help">'+esc(tr('المعالجة تتم على جهازك. في أول استخدام فقط يتم تنزيل موديل القص المجاني ثم يُحفظ في كاش المتصفح.','Processing runs on your device. On first use only, the free cutout model is downloaded and then cached by your browser.'))+'</div>'+
          '<label class="bp-file-btn">📷 '+esc(tr('اختر صورة المكان','Choose Space Photo'))+
            '<input class="bp-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif">'+
          '</label>'+
          '<div class="bp-status"></div>'+
        '</div>'+
        '<div class="bp-editor">'+
          '<div class="bp-stage-wrap">'+
            '<canvas class="bp-stage"></canvas>'+
            '<div class="bp-stage-hint">'+esc(tr('اضغط للمكان • اسحب • قرّب بإصبعين','Tap to place • Drag • Pinch to zoom'))+'</div>'+
            '<div class="bp-processing"><div class="bp-spinner"></div><div class="bp-processing-text">'+esc(tr('جاري تجهيز المعاينة...','Preparing preview...'))+'</div></div>'+
          '</div>'+
          '<div class="bp-clean-card">'+
            '<div class="bp-clean-head"><div><b>'+esc(tr('القص محتاج تعديل؟','Cutout needs a quick fix?'))+'</b><small>'+esc(tr('استخدم المسح أو الاسترجاع فقط عند الحاجة.','Use Erase or Restore only if needed.'))+'</small></div><button type="button" class="bp-clean-toggle" data-act="cleanToggle">✏️ '+esc(tr('تعديل القص','Edit Cutout'))+'</button></div>'+
            '<div class="bp-mask-editor">'+
              '<div class="bp-mask-tip">'+esc(tr('مرّر إصبعك على الجزء المطلوب فقط','Brush only over the part you want to fix'))+'</div>'+
              '<div class="bp-mask-wrap"><canvas class="bp-mask-canvas"></canvas></div>'+
              '<div class="bp-mask-tools bp-mask-tools-simple">'+
                '<button type="button" class="bp-mask-tool active" data-mask="erase">🧽 '+esc(tr('مسح الزائد','Erase extra'))+'</button>'+
                '<button type="button" class="bp-mask-tool" data-mask="restore">↩ '+esc(tr('استرجاع جزء','Restore part'))+'</button>'+
              '</div>'+
              '<div class="bp-brush-row"><label>'+esc(tr('حجم الفرشة','Brush size'))+'</label><input class="bp-brush-size" type="range" min="12" max="110" step="2" value="46"><span class="bp-brush-value">46</span></div>'+
              '<div class="bp-mask-actions bp-mask-actions-simple"><button type="button" data-act="autoCut">↺ '+esc(tr('إعادة القص','Reset cutout'))+'</button><button type="button" class="bp-mask-done" data-act="cleanDone">✓ '+esc(tr('تم','Done'))+'</button></div>'+
            '</div>'+
          '</div>'+
          '<div class="bp-tools">'+
            '<button type="button" class="bp-tool" data-act="reset">↺ '+esc(tr('إعادة ضبط','Reset'))+'</button>'+
            '<button type="button" class="bp-tool" data-act="minus">− '+esc(tr('تصغير','Smaller'))+'</button>'+
            '<button type="button" class="bp-tool" data-act="plus">＋ '+esc(tr('تكبير','Larger'))+'</button>'+
            '<button type="button" class="bp-tool" data-act="center">⊙ '+esc(tr('توسيط','Center'))+'</button>'+
          '</div>'+
          '<div class="bp-rotate-row"><label>↻ '+esc(tr('تدوير','Rotate'))+'</label><input class="bp-rotate" type="range" min="-180" max="180" step="1" value="0"></div>'+
          '<div class="bp-look-row"><label>'+esc(tr('شفافية','Opacity'))+'</label><input class="bp-opacity" type="range" min="35" max="100" value="100"><button type="button" class="bp-shadow-toggle active" data-act="shadow">◒ '+esc(tr('ظل','Shadow'))+'</button></div>'+
          '<div class="bp-actions">'+
            '<button type="button" class="bp-secondary" data-act="change">📷 '+esc(tr('تغيير الصورة','Change Photo'))+'</button>'+
            '<button type="button" class="bp-primary gold" data-act="create">✓ '+esc(tr('إنشاء المعاينة','Create Preview'))+'</button>'+
          '</div>'+
          '<div class="bp-final">'+
            '<img class="bp-final-img" alt="'+esc(tr('المعاينة النهائية','Final preview'))+'">'+
            '<div class="bp-final-actions">'+
              '<button type="button" data-act="save">⬇ '+esc(tr('حفظ الصورة','Save Image'))+'</button>'+
              '<button type="button" data-act="share">↗ '+esc(tr('مشاركة المعاينة','Share Preview'))+'</button>'+
              '<button type="button" class="bp-sales" data-act="sales">💬 '+esc(tr('إرسال لفريق بريق','Send to Bariq Team'))+'</button>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</section>';
  document.body.appendChild(bg);
  S.modal=bg;
  S.canvas=bg.querySelector('.bp-stage');
  S.ctx=S.canvas.getContext('2d',{alpha:false,willReadFrequently:false});
  bindModal();
  return bg;
}

function bindModal(){
  var m=S.modal;
  m.querySelector('.bp-preview-close').addEventListener('click',close);
  m.addEventListener('click',function(e){if(e.target===m)close()});
  var input=m.querySelector('.bp-file-input');
  input.addEventListener('change',function(){
    var f=input.files&&input.files[0];
    if(f)handlePlaceFile(f);
    input.value='';
  });
  m.querySelectorAll('[data-act]').forEach(function(b){
    b.addEventListener('click',function(){act(b.getAttribute('data-act'))});
  });
  m.querySelector('.bp-rotate').addEventListener('input',function(e){
    S.rotation=Number(e.target.value)||0; draw();
  });
  m.querySelector('.bp-opacity').addEventListener('input',function(e){S.opacity=clamp((Number(e.target.value)||100)/100,.35,1);draw()});
  m.querySelector('.bp-brush-size').addEventListener('input',function(e){S.brushSize=Number(e.target.value)||46;m.querySelector('.bp-brush-value').textContent=String(S.brushSize)});
  m.querySelectorAll('[data-mask]').forEach(function(b){b.addEventListener('click',function(){S.maskMode=b.getAttribute('data-mask');m.querySelectorAll('[data-mask]').forEach(function(x){x.classList.toggle('active',x===b)})})});
  S.maskCanvas=m.querySelector('.bp-mask-canvas');S.maskCtx=S.maskCanvas.getContext('2d',{willReadFrequently:true});
  ['pointerdown','pointermove','pointerup','pointercancel'].forEach(function(n){S.maskCanvas.addEventListener(n,maskPointer,{passive:false})});

  var c=S.canvas;
  c.addEventListener('pointerdown',pointerDown);
  c.addEventListener('pointermove',pointerMove);
  c.addEventListener('pointerup',pointerUp);
  c.addEventListener('pointercancel',pointerUp);
  c.addEventListener('contextmenu',function(e){e.preventDefault()});
}
function open(){
  buildModal();
  if(S.open)return;
  S.open=true;
  S.bodyScrollY=window.scrollY||0;
  S.modal.hidden=false;
  S.modal.setAttribute('aria-hidden','false');
  document.documentElement.classList.add('bp-preview-lock');
  document.body.classList.add('bp-preview-lock');
  setStatus('', '');
  setTimeout(function(){var b=S.modal&&S.modal.querySelector('.bp-preview-close');if(b)b.focus({preventScroll:true})},0);
}
function close(){
  if(!S.modal)return;
  S.open=false;
  S.pointers.clear();S.dragging=false;S.maskDrawing=false;
  setProcessing(false);
  // Move focus out of the dialog before hiding it so browsers do not block aria-hidden.
  var active=document.activeElement;
  if(active&&S.modal.contains(active)&&typeof active.blur==='function')active.blur();
  S.modal.setAttribute('aria-hidden','true');
  S.modal.hidden=true;
  document.documentElement.classList.remove('bp-preview-lock');
  document.body.classList.remove('bp-preview-lock');
  cleanup();
}
function cleanup(){
  if(S.placeUrl){URL.revokeObjectURL(S.placeUrl);S.placeUrl=''}
  if(S.productUrl){URL.revokeObjectURL(S.productUrl);S.productUrl=''}
  if(S.exportUrl){URL.revokeObjectURL(S.exportUrl);S.exportUrl=''}
  S.placeImg=null;S.placeFile=null;S.productImg=null;S.productCanvas=null;S.productOriginal=null;S.productAuto=null;S.exportBlob=null;
  S.maskUndo=[];S.maskRedo=[];S.maskLast=null;S.opacity=1;S.shadow=true;
  S.pointers.clear();S.dragging=false;S.tainted=false;S.warning='';
  if(S.canvas){S.canvas.width=1;S.canvas.height=1}
  if(S.modal){
    S.modal.querySelector('.bp-editor').classList.remove('active');
    S.modal.querySelector('.bp-final').classList.remove('active');
    S.modal.querySelector('.bp-upload-card').style.display='';
    S.modal.querySelector('.bp-mask-editor').classList.remove('active');
    S.modal.querySelector('.bp-opacity').value='100';
    S.modal.querySelector('.bp-shadow-toggle').classList.add('active');
    setStatus('','');
  }
}

function validImage(file){
  if(!file)return false;
  var type=String(file.type||'').toLowerCase();
  var ok=/^image\/(jpeg|png|webp|heic|heif)$/.test(type);
  if(!ok && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name||''))return false;
  if(file.size>30*1024*1024)return false;
  return true;
}
function loadImageUrl(url,cross){
  return new Promise(function(resolve,reject){
    var im=new Image();
    if(cross)im.crossOrigin='anonymous';
    im.decoding='async';
    im.onload=function(){resolve(im)};
    im.onerror=function(){reject(new Error('IMAGE_LOAD_FAILED'))};
    im.src=url;
  });
}
async function handlePlaceFile(file){
  if(!validImage(file)){
    setStatus(tr('اختر صورة JPG أو PNG أو WebP بحجم مناسب.','Choose a JPG, PNG or WebP image of a suitable size.'),'error');
    return;
  }
  setProcessing(true,tr('جاري تجهيز صورة المكان...','Preparing your space photo...'));
  try{
    if(S.placeUrl)URL.revokeObjectURL(S.placeUrl);
    S.placeUrl=URL.createObjectURL(file);
    S.placeFile=file;
    var im=await loadImageUrl(S.placeUrl,false);
    S.placeImg=await resizeToCanvasImage(im,MAX_PLACE_DIM);

    // Show the selected space photo immediately instead of leaving the user
    // staring at the upload screen while the 200MB model downloads/initializes.
    S.modal.querySelector('.bp-upload-card').style.display='none';
    S.modal.querySelector('.bp-editor').classList.add('active');
    if(S.canvas){
      S.canvas.width=S.placeImg.width;
      S.canvas.height=S.placeImg.height;
      draw();
    }
    setProcessing(true,tr('جاري تحميل موديل القص الدقيق لأول مرة...','Loading the precise cutout model for the first time...'));

    await prepareProduct();
    setupCanvas();
    setStatus(S.warning||'',S.warning?'warn':'info');
    draw();
  }catch(e){
    console.error('[BARIQ_PREVIEW]',e);
    var msg=e&&e.message==='PRODUCT_IMAGE_MISSING'
      ?tr('هذا المنتج لا يحتوي على صورة مناسبة للمعاينة.','This product does not have a suitable preview image.')
      :tr('تعذر قراءة الصورة على هذا الجهاز. جرّب JPG أو PNG أو WebP.','This image could not be read on this device. Try JPG, PNG or WebP.');
    setStatus(msg,'error');
  }finally{setProcessing(false)}
}
async function resizeToCanvasImage(im,maxDim){
  var w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;
  if(!w||!h)throw new Error('IMAGE_INVALID');
  var k=Math.min(1,maxDim/Math.max(w,h));
  var c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
  var x=c.getContext('2d',{alpha:false});
  x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
  x.drawImage(im,0,0,c.width,c.height);
  return c;
}

async function prepareProduct(){
  var src=currentProductImage();
  if(!src)throw new Error('PRODUCT_IMAGE_MISSING');
  S.warning='';S.tainted=false;
  var im;
  try{
    im=await loadImageUrl(src,true);
  }catch(_){
    im=await loadImageUrl(src,false);
    S.tainted=true;
  }
  S.productImg=im;
  S.productOriginal=await resizeToAlphaCanvas(im,MAX_PRODUCT_DIM);
  try{
    S.productCanvas=await removeBackgroundAI(S.productOriginal);
    S.productAuto=cloneCanvas(S.productCanvas);
    S.warning='';
  }catch(e){
    console.warn('[BARIQ_PREVIEW] AI background removal fallback',e);
    try{
      S.productCanvas=removeConnectedBackground(im);
      S.productAuto=cloneCanvas(S.productCanvas);
      S.warning=tr('تعذر تحميل موديل القص الذكي، وتم استخدام القص السريع مؤقتًا. افتح وحدة التحكم إذا استمر الخطأ.','The AI cutout model could not load, so the fast cutout was used temporarily. Check the console if this persists.');
    }catch(e2){
      S.productCanvas=cloneCanvas(S.productOriginal);
      S.productAuto=cloneCanvas(S.productCanvas);
      S.warning=tr('تعذر قص الخلفية تلقائيًا. يمكنك استخدام تعديل القص يدويًا.','Automatic background removal failed. You can use Edit Cutout manually.');
    }
  }
  S.maskUndo=[];S.maskRedo=[];
}

function loadExternalScript(src){
  return new Promise(function(resolve,reject){
    var old=document.querySelector('script[data-bp-src="'+src.replace(/"/g,'')+'"]');
    if(old){
      if(old.dataset.loaded==='1')return resolve();
      old.addEventListener('load',function(){resolve()},{once:true});
      old.addEventListener('error',function(){reject(new Error('SCRIPT_LOAD_FAILED'))},{once:true});
      return;
    }
    var sc=document.createElement('script');
    sc.src=src;sc.async=true;sc.crossOrigin='anonymous';sc.dataset.bpSrc=src;
    sc.onload=function(){sc.dataset.loaded='1';resolve()};
    sc.onerror=function(){reject(new Error('SCRIPT_LOAD_FAILED: '+src))};
    document.head.appendChild(sc);
  });
}
async function loadAiSegmenter(){
  if(S.aiSegmenter&&S.rembgSession)return S.aiSegmenter;
  if(S.aiLoading)return S.aiLoading;
  S.aiLoading=(async function(){
    setProcessing(true,tr('أول مرة فقط: جاري تحميل أداة القص الذكي...','First time only: loading the smart cutout engine...'));

    if(!window.ort)await loadExternalScript(REMBG_ORT_URL);
    if(!window.rembgWeb)await loadExternalScript(REMBG_UMD_URL);

    var api=window.rembgWeb||window.RembgWeb||window.rembg||null;
    if(!api||typeof api.remove!=='function'||typeof api.newSession!=='function'){
      console.error('[BARIQ_PREVIEW] rembg API is incomplete',api);
      throw new Error('REMBG_LIBRARY_NOT_READY');
    }

    window.rembgWeb=api;

    // Keep model traffic same-origin. /assets/models/u2netp.onnx is served locally from Bariq.
    if(api.rembgConfig){
      if(typeof api.rembgConfig.setBaseUrl==='function'){
        api.rembgConfig.setBaseUrl('/assets/models');
      }
      if(typeof api.rembgConfig.setCustomModelPath==='function'){
        api.rembgConfig.setCustomModelPath('u2netp',REMBG_MODEL_URL);
      }
      if(typeof api.rembgConfig.enableGeneralLogging==='function')api.rembgConfig.enableGeneralLogging(false);
      if(typeof api.rembgConfig.enablePerformanceLogging==='function')api.rembgConfig.enablePerformanceLogging(false);
      if(typeof api.rembgConfig.enableWebGPU==='function')api.rembgConfig.enableWebGPU(false);
      if(typeof api.rembgConfig.enableWebNN==='function')api.rembgConfig.enableWebNN(false);
      if(typeof api.rembgConfig.setSessionCacheBypass==='function')api.rembgConfig.setSessionCacheBypass(false);
      if(typeof api.rembgConfig.setModelCacheBypass==='function')api.rembgConfig.setModelCacheBypass(false);
    }

    // IMPORTANT: newSession() is async. Passing it without await sends a Promise
    // to remove(), which causes "predict is not a function".
    S.rembgSession=await api.newSession('u2netp',undefined,{
      preferWebGPU:false,
      preferWebNN:false,
      numThreads:1,
      onProgress:function(info){
        if(!info)return;
        var pct=Math.max(0,Math.min(100,Math.round(Number(info.progress)||0)));
        setProcessing(true,tr('جاري تحميل موديل القص... ','Loading cutout model... ')+pct+'%');
      }
    });

    if(!S.rembgSession||typeof S.rembgSession.predict!=='function'){
      console.error('[BARIQ_PREVIEW] invalid rembg session',S.rembgSession);
      throw new Error('REMBG_SESSION_INVALID');
    }

    S.aiSegmenter=api;
    S.aiDevice='wasm';
    S.aiReady=true;
    return api;
  })();

  try{
    return await S.aiLoading;
  }finally{
    S.aiLoading=null;
  }
}
async function blobToCanvas(blob,maxDim){
  var url=URL.createObjectURL(blob);
  try{
    var im=await loadImageUrl(url,false);
    return await resizeToAlphaCanvas(im,maxDim||MAX_PRODUCT_DIM);
  }finally{URL.revokeObjectURL(url)}
}
function rmbgOpenDb(){
  return new Promise(function(resolve,reject){
    try{
      var req=indexedDB.open('bariq-ai-models',1);
      req.onupgradeneeded=function(){
        var db=req.result;
        if(!db.objectStoreNames.contains('models'))db.createObjectStore('models');
      };
      req.onsuccess=function(){resolve(req.result)};
      req.onerror=function(){reject(req.error||new Error('IDB_OPEN_FAILED'))};
    }catch(e){reject(e)}
  });
}

async function rmbgCacheGet(key){
  try{
    var db=await rmbgOpenDb();
    return await new Promise(function(resolve,reject){
      var tx=db.transaction('models','readonly');
      var req=tx.objectStore('models').get(key);
      req.onsuccess=function(){resolve(req.result||null)};
      req.onerror=function(){reject(req.error)};
    });
  }catch(_){return null}
}

async function rmbgCachePut(key,bytes){
  try{
    var db=await rmbgOpenDb();
    await new Promise(function(resolve,reject){
      var tx=db.transaction('models','readwrite');
      tx.objectStore('models').put(bytes,key);
      tx.oncomplete=function(){resolve()};
      tx.onerror=function(){reject(tx.error)};
      tx.onabort=function(){reject(tx.error||new Error('IDB_ABORT'))};
    });
  }catch(e){
    console.warn('[BARIQ_PREVIEW] RMBG cache write skipped',e);
  }
}

async function fetchRmbgBytes(){
  var cacheKey='rmbg-1.4-q8-a6648479275d';
  var cached=await rmbgCacheGet(cacheKey);
  if(cached){
    var cachedBytes=cached instanceof Uint8Array?cached:new Uint8Array(cached);
    if(cachedBytes.byteLength>40000000){
      setProcessing(true,tr('الموديل محفوظ على الجهاز، جاري تشغيله...','Model cached on device, starting...'));
      return cachedBytes;
    }
  }

  var controller=new AbortController();
  var timer=setTimeout(function(){controller.abort()},120000);
  try{
    var res=await fetch(RMBG_MODEL_URL,{
      mode:'cors',
      credentials:'omit',
      cache:'force-cache',
      signal:controller.signal
    });
    if(!res.ok)throw new Error('RMBG_HTTP_'+res.status);

    var total=Number(res.headers.get('content-length')||44403226);
    var bytes;

    if(!res.body||!res.body.getReader){
      bytes=new Uint8Array(await res.arrayBuffer());
    }else{
      var reader=res.body.getReader(),chunks=[],received=0,lastPct=-1;
      while(true){
        var part=await reader.read();
        if(part.done)break;
        chunks.push(part.value);
        received+=part.value.byteLength;
        var pct=Math.min(100,Math.round(received*100/Math.max(1,total)));
        if(pct!==lastPct){
          lastPct=pct;
          setProcessing(true,tr('تحميل موديل القص: ','Downloading cutout model: ')+pct+'%');
        }
      }
      bytes=new Uint8Array(received);
      var off=0;
      for(var i=0;i<chunks.length;i++){bytes.set(chunks[i],off);off+=chunks[i].byteLength}
    }

    if(bytes.byteLength<40000000)throw new Error('RMBG_FILE_TOO_SMALL_'+bytes.byteLength);
    setProcessing(true,tr('تم التحميل، جاري حفظ الموديل على الجهاز...','Downloaded, caching model on device...'));
    rmbgCachePut(cacheKey,bytes.slice()).catch(function(){});
    return bytes;
  }finally{
    clearTimeout(timer);
  }
}

async function loadRmbg14(){
  if(S.rmbgSession)return S.rmbgSession;
  if(S.rmbgLoading)return S.rmbgLoading;

  S.rmbgLoading=(async function(){
    if(!window.ort)await loadExternalScript(REMBG_ORT_URL);
    if(!window.ort||!window.ort.InferenceSession)throw new Error('ORT_NOT_READY');

    setProcessing(true,tr('جاري تجهيز موديل القص السريع...','Preparing fast cutout model...'));

    try{
      var modelBytes=await fetchRmbgBytes();
      setProcessing(true,tr('جاري تهيئة موديل القص...','Initializing cutout model...'));
      S.rmbgSession=await window.ort.InferenceSession.create(modelBytes,{
        executionProviders:['wasm'],
        graphOptimizationLevel:'all',
        executionMode:'sequential'
      });
    }catch(e){
      console.warn('[BARIQ_PREVIEW] RMBG-1.4 unavailable; falling back to U2NetP',e);
      S.rmbgSession=null;
      throw e;
    }

    return S.rmbgSession;
  })();

  try{return await S.rmbgLoading}
  finally{S.rmbgLoading=null}
}

async function removeBackgroundRmbg14(originalCanvas){
  var session=await loadRmbg14();
  var size=1024;
  var input=document.createElement('canvas');
  input.width=size;input.height=size;
  var ix=input.getContext('2d',{willReadFrequently:true});
  ix.imageSmoothingEnabled=true;ix.imageSmoothingQuality='high';
  ix.drawImage(originalCanvas,0,0,size,size);

  var rgba=ix.getImageData(0,0,size,size).data;
  var plane=size*size,data=new Float32Array(plane*3);

  // Official RMBG-1.4 preprocessing:
  // image / 255, then normalize mean [.5,.5,.5], std [1,1,1].
  for(var i=0;i<plane;i++){
    var p=i*4;
    data[i]=rgba[p]/255-.5;
    data[plane+i]=rgba[p+1]/255-.5;
    data[plane*2+i]=rgba[p+2]/255-.5;
  }

  setProcessing(true,tr('جاري فصل المنتج...','Separating product...'));
  var tensor=new window.ort.Tensor('float32',data,[1,3,size,size]);
  var feeds={};feeds[session.inputNames[0]]=tensor;
  var result=await session.run(feeds);
  var outTensor=result[session.outputNames[0]];
  if(!outTensor||!outTensor.data)throw new Error('RMBG_EMPTY_OUTPUT');

  var raw=outTensor.data;
  if(raw.length<plane)throw new Error('RMBG_BAD_OUTPUT_'+raw.length);

  // Official postprocess normalizes prediction with min/max.
  var mi=Infinity,ma=-Infinity;
  for(var i=0;i<plane;i++){
    var v=Number(raw[i]);
    if(v<mi)mi=v;
    if(v>ma)ma=v;
  }
  var range=Math.max(1e-8,ma-mi);

  var mask=document.createElement('canvas');
  mask.width=size;mask.height=size;
  var mx=mask.getContext('2d'),mid=mx.createImageData(size,size),md=mid.data;
  for(var i=0;i<plane;i++){
    var a=Math.max(0,Math.min(1,(Number(raw[i])-mi)/range));
    // Preserve soft/pale details; do not hard threshold.
    a=Math.max(0,Math.min(1,(a-.015)/.97));
    var val=Math.round(a*255),p=i*4;
    md[p]=md[p+1]=md[p+2]=255;md[p+3]=val;
  }
  mx.putImageData(mid,0,0);

  var out=document.createElement('canvas');
  out.width=originalCanvas.width;out.height=originalCanvas.height;
  var ox=out.getContext('2d',{willReadFrequently:true});
  ox.drawImage(originalCanvas,0,0);
  ox.globalCompositeOperation='destination-in';
  ox.imageSmoothingEnabled=true;ox.imageSmoothingQuality='high';
  ox.drawImage(mask,0,0,out.width,out.height);
  ox.globalCompositeOperation='source-over';

  // Only a tiny alpha smoothing pass. No color rules / no blob recovery.
  var id=ox.getImageData(0,0,out.width,out.height),d=id.data,w=out.width,h=out.height;
  var alpha=new Uint8ClampedArray(w*h);
  for(var i=0,j=3;i<alpha.length;i++,j+=4)alpha[i]=d[j];
  for(var y=1;y<h-1;y++)for(var x=1;x<w-1;x++){
    var k=y*w+x,a=alpha[k];
    if(a>5&&a<250){
      var avg=(alpha[k-1]+alpha[k+1]+alpha[k-w]+alpha[k+w]+a*6)/10;
      d[k*4+3]=Math.round(a*.88+avg*.12);
    }
  }
  ox.putImageData(id,0,0);
  return out;
}

async function removeBackgroundAI(originalCanvas){
  var out=null;
  try{
    out=await removeBackgroundRmbg14(originalCanvas);
  }catch(e){
    console.warn('[BARIQ_PREVIEW] RMBG-1.4 failed; U2NetP fallback',e);
    out=await removeBackgroundU2Fallback(originalCanvas);
  }

  var ctx=out.getContext('2d',{willReadFrequently:true}),
      d=ctx.getImageData(0,0,out.width,out.height).data;
  var visible=0,total=out.width*out.height;
  for(var i=3;i<d.length;i+=4)if(d[i]>12)visible++;
  var ratio=visible/Math.max(1,total);
  if(ratio<.006||ratio>.99)throw new Error('AI_UNSAFE_MASK_'+ratio.toFixed(3));
  return out;
}

async function removeBackgroundU2Fallback(originalCanvas){
  var api=await loadAiSegmenter();
  setProcessing(true,tr('جاري عزل المنتج تلقائيًا...','Automatically cutting out the product...'));
  var opts={
    session:S.rembgSession,postProcessMask:true,
    onProgress:function(info){
      if(!info)return;
      var pct=Math.max(0,Math.min(100,Math.round(Number(info.progress)||0)));
      setProcessing(true,tr('جاري تجهيز القص الاحتياطي... ','Preparing fallback cutout... ')+pct+'%');
    }
  };
  var blob=await api.remove(originalCanvas,opts);
  if(!(blob instanceof Blob))throw new Error('REMBG_INVALID_RESULT');
  var out=await blobToCanvas(blob,MAX_PRODUCT_DIM);
  if(!out||!out.width||!out.height)throw new Error('REMBG_EMPTY_RESULT');
  return protectProductDetails(out);
}

async function removeBackgroundAI(originalCanvas){
  var out=null,primaryErr=null;
  try{
    out=await removeBackgroundU2Fallback(originalCanvas);
  }catch(e){
    primaryErr=e;
    console.warn('[BARIQ_PREVIEW] RMBG-1.4 failed; U2NetP fallback',e);
    out=await removeBackgroundU2Fallback(originalCanvas);
  }
  var ctx=out.getContext('2d',{willReadFrequently:true}),d=ctx.getImageData(0,0,out.width,out.height).data;
  var visible=0,total=out.width*out.height;
  for(var i=3;i<d.length;i+=4)if(d[i]>12)visible++;
  var ratio=visible/Math.max(1,total);
  if(ratio<.006||ratio>.99)throw new Error('AI_UNSAFE_MASK_'+ratio.toFixed(3));
  return out;
}

function protectProductDetails(c){
  // R18: keep R15 behavior, but preserve pale/thin edges a little more.
  // This works only on the model alpha mask, so it cannot throw source-canvas errors.
  var x=c.getContext('2d',{willReadFrequently:true}),id=x.getImageData(0,0,c.width,c.height),d=id.data;
  var w=c.width,h=c.height,n=w*h,src=new Uint8ClampedArray(n),pass1=new Uint8ClampedArray(n),dst=new Uint8ClampedArray(n);
  for(var i=0,j=3;i<n;i++,j+=4)src[i]=d[j];

  // Strong but still conservative 1px recovery around existing foreground.
  for(var y=0;y<h;y++)for(var xx=0;xx<w;xx++){
    var k=y*w+xx,m=src[k];
    for(var yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(var x2=Math.max(0,xx-1);x2<=Math.min(w-1,xx+1);x2++){
      var a=src[yy*w+x2];if(a>m)m=a;
    }
    pass1[k]=Math.max(src[k],Math.round(m*.82));
  }

  // Very soft second-ring recovery only near strong foreground.
  // Helps light product tips that U2Netp tends to eat without creating a thick halo.
  for(var y=0;y<h;y++)for(var xx=0;xx<w;xx++){
    var k=y*w+xx,a0=pass1[k],m=0,strong=0;
    for(var yy=Math.max(0,y-2);yy<=Math.min(h-1,y+2);yy++)for(var x2=Math.max(0,xx-2);x2<=Math.min(w-1,xx+2);x2++){
      var a=src[yy*w+x2];
      if(a>m)m=a;
      if(a>205)strong++;
    }
    var soft=(strong>=2&&m>210)?Math.round(m*.34):0;
    dst[k]=Math.max(a0,soft);
  }

  // Small feather keeps edges natural instead of hard/jagged.
  for(var y=0;y<h;y++)for(var xx=0;xx<w;xx++){
    var k=y*w+xx,a=dst[k];
    if(a>12&&a<248){
      var sum=0,count=0;
      for(var yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(var x2=Math.max(0,xx-1);x2<=Math.min(w-1,xx+1);x2++){
        sum+=dst[yy*w+x2];count++;
      }
      a=Math.max(a,Math.round((a*4+sum/count)/5));
    }
    d[k*4+3]=a;
  }
  x.putImageData(id,0,0);return c;
}

async function rerunAiCut(){
  if(!S.productOriginal)return;
  pushMaskUndo();
  try{
    setProcessing(true,tr('جاري إعادة القص الذكي...','Re-running smart cutout...'));
    S.productCanvas=await removeBackgroundAI(S.productOriginal);
    S.productAuto=cloneCanvas(S.productCanvas);
    S.warning='';
    renderMaskEditor();draw();
    setStatus(tr('تم تحديث القص الذكي ✓','Smart cutout updated ✓'),'info');
  }catch(e){
    console.error('[BARIQ_PREVIEW] AI recut failed',e);
    setStatus(tr('تعذر إعادة القص الذكي الآن. يمكنك استخدام المسح أو الاسترجاع.','Smart cutout could not run now. You can use Erase or Restore.'),'warn');
  }finally{setProcessing(false)}
}

async function resizeToAlphaCanvas(im,maxDim){
  var w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;
  var k=Math.min(1,maxDim/Math.max(w,h));
  var c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
  var x=c.getContext('2d',{willReadFrequently:true});
  x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
  x.drawImage(im,0,0,c.width,c.height);
  return c;
}
function borderStats(data,w,h){
  var rs=0,gs=0,bs=0,n=0;
  function add(x,y){
    var i=(y*w+x)*4, r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
    if(a<10)return;
    if(r>185&&g>185&&b>185){rs+=r;gs+=g;bs+=b;n++}
  }
  var step=Math.max(1,EDGE_SAMPLE_STEP);
  for(var x=0;x<w;x+=step){add(x,0);add(x,h-1)}
  for(var y=0;y<h;y+=step){add(0,y);add(w-1,y)}
  return n?{r:rs/n,g:gs/n,b:bs/n,n:n}:{r:255,g:255,b:255,n:0};
}
function colorDist(r,g,b,c){
  var dr=r-c.r,dg=g-c.g,db=b-c.b;
  return Math.sqrt(dr*dr+dg*dg+db*db);
}
function removeConnectedBackground(im){
  var w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;
  var k=Math.min(1,MAX_PRODUCT_DIM/Math.max(w,h));
  w=Math.max(1,Math.round(w*k));h=Math.max(1,Math.round(h*k));
  var c=document.createElement('canvas');c.width=w;c.height=h;
  var x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(im,0,0,w,h);
  var id=x.getImageData(0,0,w,h),d=id.data;
  var bg=borderStats(d,w,h);
  if(bg.n<4)throw new Error('NO_LIGHT_BORDER');

  var threshold=Math.max(24,Math.min(62, 22 + (255-((bg.r+bg.g+bg.b)/3))*.6));
  var visited=new Uint8Array(w*h);
  var queue=new Int32Array(w*h);
  var head=0,tail=0,removed=0;

  function candidate(idx){
    var i=idx*4,r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
    if(a<8)return true;
    var lum=(r+g+b)/3;
    return lum>WHITE_BASE-12 && colorDist(r,g,b,bg)<threshold;
  }
  function push(idx){
    if(idx<0||idx>=w*h||visited[idx])return;
    visited[idx]=1;
    if(candidate(idx))queue[tail++]=idx;
  }
  for(var xx=0;xx<w;xx++){push(xx);push((h-1)*w+xx)}
  for(var yy=0;yy<h;yy++){push(yy*w);push(yy*w+w-1)}

  while(head<tail){
    var idx=queue[head++], px=idx%w,py=(idx/w)|0;
    var ii=idx*4;
    d[ii+3]=0;removed++;
    if(px>0)push(idx-1);if(px<w-1)push(idx+1);if(py>0)push(idx-w);if(py<h-1)push(idx+w);
  }

  var ratio=removed/(w*h);
  if(ratio<.03||ratio>.94)throw new Error('UNSAFE_REMOVAL_'+ratio.toFixed(3));

  // Gentle edge feather: pixels next to removed background get partial alpha if near background color.
  var out=new Uint8ClampedArray(d);
  for(var y=1;y<h-1;y++){
    for(var x0=1;x0<w-1;x0++){
      var idx0=y*w+x0, i0=idx0*4;
      if(d[i0+3]===0)continue;
      var touch=visited[idx0-1]||visited[idx0+1]||visited[idx0-w]||visited[idx0+w];
      if(!touch)continue;
      var dist=colorDist(d[i0],d[i0+1],d[i0+2],bg);
      if(dist<threshold*1.55){
        var a=clamp(Math.round(255*(dist-threshold*.45)/(threshold*1.1)),45,255);
        out[i0+3]=Math.min(out[i0+3],a);
      }
    }
  }
  id.data.set(out);x.putImageData(id,0,0);
  return c;
}

function cloneCanvas(src){
  var c=document.createElement('canvas');c.width=src.width;c.height=src.height;
  c.getContext('2d').drawImage(src,0,0);return c;
}
function alphaSnapshot(){
  var x=S.productCanvas.getContext('2d',{willReadFrequently:true}),d=x.getImageData(0,0,S.productCanvas.width,S.productCanvas.height).data,a=new Uint8Array(S.productCanvas.width*S.productCanvas.height);
  for(var i=0,j=3;i<a.length;i++,j+=4)a[i]=d[j];return a;
}
function applyAlpha(a){
  if(!a||!S.productCanvas)return;var x=S.productCanvas.getContext('2d',{willReadFrequently:true}),id=x.getImageData(0,0,S.productCanvas.width,S.productCanvas.height),d=id.data;
  for(var i=0,j=3;i<a.length&&j<d.length;i++,j+=4)d[j]=a[i];x.putImageData(id,0,0);renderMaskEditor();draw();
}
function pushMaskUndo(){S.maskUndo.push(alphaSnapshot());if(S.maskUndo.length>8)S.maskUndo.shift();S.maskRedo=[]}
function renderMaskEditor(){
  if(!S.maskCanvas||!S.productCanvas)return;S.maskCanvas.width=S.productCanvas.width;S.maskCanvas.height=S.productCanvas.height;
  var x=S.maskCtx,sz=20;x.clearRect(0,0,S.maskCanvas.width,S.maskCanvas.height);
  for(var y=0;y<S.maskCanvas.height;y+=sz)for(var xx=0;xx<S.maskCanvas.width;xx+=sz){x.fillStyle=((xx/sz+y/sz)&1)?'#e7e9ee':'#fff';x.fillRect(xx,y,sz,sz)}
  x.drawImage(S.productCanvas,0,0);
}
function maskPoint(e){var r=S.maskCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*S.maskCanvas.width/r.width,y:(e.clientY-r.top)*S.maskCanvas.height/r.height}}
function maskPointer(e){
  if(!S.productCanvas)return;e.preventDefault();
  if(e.type==='pointerdown'){S.maskCanvas.setPointerCapture&&S.maskCanvas.setPointerCapture(e.pointerId);pushMaskUndo();S.maskDrawing=true;S.maskLast=maskPoint(e);paintMask(S.maskLast,S.maskLast);return}
  if(e.type==='pointermove'&&S.maskDrawing){var p=maskPoint(e);paintMask(S.maskLast,p);S.maskLast=p;return}
  if(e.type==='pointerup'||e.type==='pointercancel'){S.maskDrawing=false;S.maskLast=null}
}
function paintMask(a,b){
  var c=S.productCanvas,x=c.getContext('2d',{willReadFrequently:true}),orig=S.productOriginal.getContext('2d',{willReadFrequently:true});
  var dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.ceil(Math.sqrt(dx*dx+dy*dy)/(S.brushSize*.18))),rad=S.brushSize/2;
  var id=x.getImageData(0,0,c.width,c.height),od=orig.getImageData(0,0,c.width,c.height).data,d=id.data;
  for(var st=0;st<=len;st++){var cx=a.x+dx*st/len,cy=a.y+dy*st/len,minx=Math.max(0,Math.floor(cx-rad)),maxx=Math.min(c.width-1,Math.ceil(cx+rad)),miny=Math.max(0,Math.floor(cy-rad)),maxy=Math.min(c.height-1,Math.ceil(cy+rad));
    for(var yy=miny;yy<=maxy;yy++)for(var xx=minx;xx<=maxx;xx++){var dd=Math.hypot(xx-cx,yy-cy);if(dd>rad)continue;var fall=clamp((rad-dd)/Math.max(1,rad*.28),0,1),i=(yy*c.width+xx)*4;
      if(S.maskMode==='erase'){
        d[i+3]=Math.round(d[i+3]*(1-fall));
      }else{
        // Restore the REAL original pixel, not only its alpha channel.
        // This prevents transparent pixels from coming back as black.
        d[i]=od[i];d[i+1]=od[i+1];d[i+2]=od[i+2];
        d[i+3]=Math.max(d[i+3],Math.round(od[i+3]*fall));
      }
    }
  }
  x.putImageData(id,0,0);renderMaskEditor();draw();
}
function softenEdges(){
  if(!S.productCanvas)return;pushMaskUndo();var c=S.productCanvas,x=c.getContext('2d',{willReadFrequently:true}),id=x.getImageData(0,0,c.width,c.height),d=id.data,a=new Uint8Array(c.width*c.height),out=new Uint8Array(c.width*c.height);
  for(var i=0,j=3;i<a.length;i++,j+=4)a[i]=d[j];
  for(var y=1;y<c.height-1;y++)for(var xx=1;xx<c.width-1;xx++){var idx=y*c.width+xx,v=a[idx];if(v>8&&v<247||a[idx-1]<20||a[idx+1]<20||a[idx-c.width]<20||a[idx+c.width]<20){var sum=0,n=0;for(var yy=-1;yy<=1;yy++)for(var xxx=-1;xxx<=1;xxx++){sum+=a[idx+yy*c.width+xxx];n++}out[idx]=Math.round(sum/n)}else out[idx]=v}
  for(var k=0,jj=3;k<out.length;k++,jj+=4)if(out[k])d[jj]=out[k];x.putImageData(id,0,0);renderMaskEditor();draw();
}
function resetMask(which){pushMaskUndo();S.productCanvas=cloneCanvas(which==='auto'&&S.productAuto?S.productAuto:S.productOriginal);renderMaskEditor();draw()}

function setupCanvas(){
  S.canvas.width=S.placeImg.width;
  S.canvas.height=S.placeImg.height;
  var pw=S.productCanvas.width,ph=S.productCanvas.height;
  var maxW=S.canvas.width*.34,maxH=S.canvas.height*.34;
  var k=Math.min(maxW/pw,maxH/ph,1);
  S.baseProductW=pw*k;S.baseProductH=ph*k;
  S.scale=1;S.rotation=0;
  S.productX=S.canvas.width/2;S.productY=S.canvas.height/2;
  S.modal.querySelector('.bp-rotate').value='0';
  S.modal.querySelector('.bp-final').classList.remove('active');
  revokeExport();
  renderMaskEditor();
}
function draw(){
  if(!S.ctx||!S.placeImg)return;
  var c=S.canvas,x=S.ctx;
  x.save();
  x.clearRect(0,0,c.width,c.height);
  x.drawImage(S.placeImg,0,0,c.width,c.height);
  if(S.productCanvas){
    x.translate(S.productX,S.productY);
    x.rotate(S.rotation*Math.PI/180);
    var w=S.baseProductW*S.scale,h=S.baseProductH*S.scale;
    x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.globalAlpha=S.opacity;
    if(S.shadow){
      // Contact shadow anchors the product to the floor instead of making it look pasted on.
      x.save();
      x.globalAlpha=.20*S.opacity;x.fillStyle='#000';
      x.filter='blur('+Math.max(5,Math.min(18,w*.018))+'px)';
      x.beginPath();x.ellipse(0,h*.465,Math.max(12,w*.38),Math.max(3,h*.035),0,0,Math.PI*2);x.fill();
      x.restore();
      // A softer object shadow adds depth without a heavy halo.
      x.shadowColor='rgba(0,0,0,.16)';x.shadowBlur=Math.max(4,Math.min(20,w*.018));x.shadowOffsetY=Math.max(2,Math.min(10,h*.012));
    }
    // Very light tonal blending keeps the mockup natural without changing product colours noticeably.
    x.filter='saturate(.98) contrast(.99)';
    x.drawImage(S.productCanvas,-w/2,-h/2,w,h);x.filter='none';x.globalAlpha=1;x.shadowColor='transparent';x.shadowBlur=0;x.shadowOffsetY=0;
  }
  x.restore();
}
function canvasPoint(e){
  var r=S.canvas.getBoundingClientRect();
  return {x:(e.clientX-r.left)*(S.canvas.width/r.width),y:(e.clientY-r.top)*(S.canvas.height/r.height)};
}
function hitProduct(p){
  var dx=p.x-S.productX,dy=p.y-S.productY;
  var rad=-S.rotation*Math.PI/180;
  var lx=dx*Math.cos(rad)-dy*Math.sin(rad),ly=dx*Math.sin(rad)+dy*Math.cos(rad);
  return Math.abs(lx)<=S.baseProductW*S.scale/2 && Math.abs(ly)<=S.baseProductH*S.scale/2;
}
function pointerDown(e){
  if(!S.productCanvas)return;
  S.canvas.setPointerCapture&&S.canvas.setPointerCapture(e.pointerId);
  var p=canvasPoint(e);S.pointers.set(e.pointerId,p);
  if(S.pointers.size===1){
    if(hitProduct(p)){S.dragging=true;S.dragDX=p.x-S.productX;S.dragDY=p.y-S.productY}
    else{
      S.productX=p.x;S.productY=p.y;S.dragging=false;draw();
    }
  }else if(S.pointers.size===2){
    var a=Array.from(S.pointers.values());
    S.pinchStartDist=distance(a[0],a[1])||1;
    S.pinchStartAngle=angle(a[0],a[1]);
    S.pinchStartScale=S.scale;
    S.pinchStartRotation=S.rotation;
    S.dragging=false;
  }
  e.preventDefault();
}
function pointerMove(e){
  if(!S.pointers.has(e.pointerId))return;
  var p=canvasPoint(e);S.pointers.set(e.pointerId,p);
  if(S.pointers.size===1&&S.dragging){
    S.productX=clamp(p.x-S.dragDX,0,S.canvas.width);
    S.productY=clamp(p.y-S.dragDY,0,S.canvas.height);
  }else if(S.pointers.size===2){
    var a=Array.from(S.pointers.values()),dist=distance(a[0],a[1])||1;
    S.scale=clamp(S.pinchStartScale*(dist/S.pinchStartDist),MIN_SCALE,MAX_SCALE);
    S.rotation=normalizeAngle(S.pinchStartRotation+(angle(a[0],a[1])-S.pinchStartAngle));
    var mid={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};
    S.productX=mid.x;S.productY=mid.y;
    S.modal.querySelector('.bp-rotate').value=String(Math.round(S.rotation));
  }
  draw();e.preventDefault();
}
function pointerUp(e){
  S.pointers.delete(e.pointerId);
  if(S.pointers.size===0)S.dragging=false;
  if(S.pointers.size===1){
    var a=Array.from(S.pointers.values());
    S.dragging=hitProduct(a[0]);
    S.dragDX=a[0].x-S.productX;S.dragDY=a[0].y-S.productY;
  }
  e.preventDefault();
}

function act(a){
  if(a==='cleanToggle'){var e=S.modal.querySelector('.bp-mask-editor');e.classList.toggle('active');if(e.classList.contains('active'))renderMaskEditor();return}
  if(a==='cleanDone'){S.modal.querySelector('.bp-mask-editor').classList.remove('active');return}
  if(a==='undoMask'){if(S.maskUndo.length){S.maskRedo.push(alphaSnapshot());applyAlpha(S.maskUndo.pop())}return}
  if(a==='redoMask'){if(S.maskRedo.length){S.maskUndo.push(alphaSnapshot());applyAlpha(S.maskRedo.pop())}return}
  if(a==='resetMask'){resetMask('original');return}
  if(a==='autoCut'){rerunAiCut();return}
  if(a==='soften'){softenEdges();return}
  if(a==='shadow'){S.shadow=!S.shadow;S.modal.querySelector('.bp-shadow-toggle').classList.toggle('active',S.shadow);draw();return}
  if(a==='reset'){setupCanvas();draw();return}
  if(a==='minus'){S.scale=clamp(S.scale*.86,MIN_SCALE,MAX_SCALE);draw();return}
  if(a==='plus'){S.scale=clamp(S.scale*1.16,MIN_SCALE,MAX_SCALE);draw();return}
  if(a==='center'){S.productX=S.canvas.width/2;S.productY=S.canvas.height/2;draw();return}
  if(a==='change'){S.modal.querySelector('.bp-file-input').click();return}
  if(a==='create'){createPreview();return}
  if(a==='save'){savePreview();return}
  if(a==='share'){sharePreview(false);return}
  if(a==='sales'){sharePreview(true);return}
}
function revokeExport(){
  if(S.exportUrl){URL.revokeObjectURL(S.exportUrl);S.exportUrl=''}
  S.exportBlob=null;
}
function canvasBlob(canvas,type,quality){
  return new Promise(function(resolve,reject){
    try{canvas.toBlob(function(b){b?resolve(b):reject(new Error('BLOB_FAILED'))},type,quality)}
    catch(e){reject(e)}
  });
}
async function createPreview(){
  setProcessing(true,tr('جاري إنشاء المعاينة...','Creating preview...'));
  try{
    draw();revokeExport();
    var b=await canvasBlob(S.canvas,'image/jpeg',.92);
    S.exportBlob=b;S.exportUrl=URL.createObjectURL(b);
    var img=S.modal.querySelector('.bp-final-img');
    img.src=S.exportUrl;
    S.modal.querySelector('.bp-final').classList.add('active');
    setStatus(tr('تم إنشاء المعاينة على جهازك فقط.','Preview created locally on your device.'),'info');
    setTimeout(function(){S.modal.querySelector('.bp-final').scrollIntoView({behavior:'smooth',block:'nearest'})},60);
  }catch(e){
    console.error('[BARIQ_PREVIEW] export',e);
    setStatus(tr('تعذر إنشاء ملف المعاينة بسبب مصدر صورة المنتج. جرّب منتجًا بصورة أخرى أو تواصل مع فريق بريق.','Could not export the preview because of the product image source. Try another product image or contact Bariq.'),'error');
  }finally{setProcessing(false)}
}
async function ensureExport(){
  if(S.exportBlob)return S.exportBlob;
  await createPreview();
  return S.exportBlob;
}
async function savePreview(){
  var b=await ensureExport();if(!b)return;
  var a=document.createElement('a');
  a.href=S.exportUrl||URL.createObjectURL(b);
  a.download='bariq-preview-'+(productId()||'product')+'.jpg';
  document.body.appendChild(a);a.click();a.remove();
}
async function sharePreview(toSales){
  var b=await ensureExport();if(!b)return;
  var file=new File([b],'bariq-preview-'+(productId()||'product')+'.jpg',{type:'image/jpeg'});
  var text=(toSales
    ?tr('مرحبًا، هذه معاينة المنتج في المكان الذي أريده.','Hello, this is a preview of the product in my space.')
    :tr('شاهد معاينة المنتج من بريق ✨','See my Bariq product preview ✨'))+
    '\n'+productName()+
    (productId()?'\nID: '+productId():'')+
    '\n'+location.href;
  try{
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      await navigator.share({title:productName(),text:text,files:[file]});
      return;
    }
  }catch(e){
    if(e&&e.name==='AbortError')return;
  }
  if(toSales){
    var wa=getWhatsappNumber();
    var url='https://wa.me/'+wa+'?text='+encodeURIComponent(text+'\n\n'+tr('تم حفظ صورة المعاينة على جهازي وسأرسلها هنا.','I saved the preview image and will attach it here.'));
    window.open(url,'_blank','noopener');
    savePreview();
  }else{
    savePreview();
    setStatus(tr('تم حفظ الصورة. يمكنك مشاركتها من تطبيق الصور.','Image saved. You can share it from your Photos app.'),'info');
  }
}
function getWhatsappNumber(){
  var fallback='971554423151';
  try{
    var vals=[
      localStorage.getItem('x2_whatsapp'),
      localStorage.getItem('whatsapp'),
      localStorage.getItem('site_whatsapp'),
      window.BARIQ_WHATSAPP
    ];
    for(var i=0;i<vals.length;i++){
      var d=String(vals[i]||'').replace(/\D/g,'');
      if(d.length>=8)return d;
    }
  }catch(_){}
  return fallback;
}

document.addEventListener('keydown',function(e){if(e.key==='Escape'&&S.open)close()});
window.addEventListener('pagehide',function(){if(S.open)close()});

function init(){
  if(S.initialized)return;S.initialized=true;
  makeButton();
  var mo=new MutationObserver(function(){
    if(!document.querySelector('.bp-preview-entry'))makeButton();
  });
  mo.observe(document.body,{childList:true,subtree:true});
}
window.BariqProductPreview={open:open,close:close};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();