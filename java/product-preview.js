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
var RMBG_MODEL_URL='/assets/models/rmbg-1.4-q8.onnx';

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
  perspectiveMode:false,perspectiveCorners:null,perspectiveDragging:-1,perspectiveAutoApplied:false,
  aiOrt:null,aiSegmenter:null,aiLoading:null,aiDevice:'',aiReady:false,rembgSession:null,rmbgSession:null,rmbgLoading:null,colorCanvas:null,colorCtx:null,colorBase:null,colorTolerance:42
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

function setModelBadgeR34(){/* hidden in production */}


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
          '<div class="bp-upload-help">'+esc(tr('',''))+'</div>'+
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
            '<button type="button" class="bp-tool bp-crop-undo" data-act="cropUndoR40" disabled>↶ '+esc(tr('رجوع','Undo'))+'</button>'+
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
            '<button type="button" class="bp-tool bp-perspective-toggle" data-act="perspectiveToggle">◇ '+esc(tr('تعديل الزاوية','Perspective'))+'</button>'+
            '<button type="button" class="bp-tool bp-color-toggle" data-act="colorToggle">🎨 '+esc(tr('تغيير اللون','Change Color'))+'</button>'+
          '</div>'+
          '<div class="bp-perspective-editor">'+
            '<div class="bp-perspective-head"><div><b>◇ '+esc(tr('مطابقة زاوية التصوير','Match Camera Angle'))+'</b><small>'+esc(tr('ابدأ بالاقتراح التلقائي ثم اسحب الأربع نقاط إذا احتجت ضبطًا أدق.','Start with Auto Perspective, then drag the four corners for a finer match.'))+'</small></div></div>'+
            '<div class="bp-perspective-actions">'+
              '<button type="button" class="bp-perspective-auto" data-act="perspectiveAuto">✨ '+esc(tr('Auto Perspective','Auto Perspective'))+'</button>'+
              '<button type="button" data-act="perspectiveReset">↺ '+esc(tr('إلغاء الزاوية','Reset'))+'</button>'+
              '<button type="button" class="bp-perspective-done" data-act="perspectiveDone">✓ '+esc(tr('تم','Done'))+'</button>'+
            '</div>'+
            '<div class="bp-perspective-tip">'+esc(tr('اسحب النقاط الذهبية على أركان المنتج حتى تتوافق مع سطح المكان.','Drag the gold corner points until the product matches the surface.'))+'</div>'+
          '</div>'+
          '<div class="bp-color-editor">'+
            '<div class="bp-color-head"><div><b>🎨 '+esc(tr('فلتر ألوان المنتج','Product Color Filter'))+'</b><small>'+esc(tr('غيّر ألوان المنتج كله مرة واحدة مع الحفاظ على الإضاءة والظلال.','Change the whole product colors at once while keeping lighting and shadows.'))+'</small></div></div>'+
            '<div class="bp-color-presets">'+
              '<button type="button" data-filter="original">↺ '+esc(tr('أصلي','Original'))+'</button>'+
              '<button type="button" data-filter="warm">☀ '+esc(tr('دافئ','Warm'))+'</button>'+
              '<button type="button" data-filter="cool">❄ '+esc(tr('بارد','Cool'))+'</button>'+
              '<button type="button" data-filter="navy">◆ '+esc(tr('كحلي','Navy'))+'</button>'+
              '<button type="button" data-filter="gold">✦ '+esc(tr('ذهبي','Gold'))+'</button>'+
              '<button type="button" data-filter="rose">● '+esc(tr('وردي','Rose'))+'</button>'+
              '<button type="button" data-filter="green">● '+esc(tr('أخضر','Green'))+'</button>'+
              '<button type="button" data-filter="mono">◐ '+esc(tr('أحادي','Mono'))+'</button>'+
            '</div>'+
            '<div class="bp-color-controls">'+
              '<label class="bp-color-pick">'+esc(tr('لون مخصص','Custom Color'))+' <input class="bp-color-input" type="color" value="#b07b55"></label>'+
              '<label class="bp-color-range">'+esc(tr('قوة الفلتر','Filter Strength'))+' <input class="bp-color-strength" type="range" min="0" max="100" step="1" value="72"><span class="bp-color-strength-value">72%</span></label>'+
              '<button type="button" data-act="colorReset">↺ '+esc(tr('الألوان الأصلية','Original Colors'))+'</button>'+
              '<button type="button" class="bp-color-done" data-act="colorDone">✓ '+esc(tr('تم','Done'))+'</button>'+
            '</div>'+
          '</div>'+
          '<div class="bp-rotate-row"><label>↻ '+esc(tr('تدوير','Rotate'))+'</label><input class="bp-rotate" type="range" min="-180" max="180" step="1" value="0"></div>'+

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
  m.querySelector('.bp-brush-size').addEventListener('input',function(e){S.brushSize=Number(e.target.value)||46;m.querySelector('.bp-brush-value').textContent=String(S.brushSize)});
  m.querySelectorAll('[data-mask]').forEach(function(b){b.addEventListener('click',function(){S.maskMode=b.getAttribute('data-mask');m.querySelectorAll('[data-mask]').forEach(function(x){x.classList.toggle('active',x===b)})})});
  S.maskCanvas=m.querySelector('.bp-mask-canvas');S.maskCtx=S.maskCanvas.getContext('2d',{willReadFrequently:true});
  ['pointerdown','pointermove','pointerup','pointercancel'].forEach(function(n){S.maskCanvas.addEventListener(n,maskPointer,{passive:false})});

  var colorInput=m.querySelector('.bp-color-input');
  var colorStrength=m.querySelector('.bp-color-strength');

  colorInput.addEventListener('input',function(){
    m.querySelectorAll('.bp-color-presets button').forEach(function(b){b.classList.remove('active')});
    applyGlobalColorFilter('custom');
  });

  colorStrength.addEventListener('input',function(e){
    m.querySelector('.bp-color-strength-value').textContent=String(e.target.value)+'%';
    var active=m.querySelector('.bp-color-presets button.active');
    applyGlobalColorFilter(active?active.getAttribute('data-filter'):'custom');
  });

  m.querySelectorAll('.bp-color-presets button').forEach(function(btn){
    btn.addEventListener('click',function(){
      m.querySelectorAll('.bp-color-presets button').forEach(function(b){b.classList.remove('active')});
      btn.classList.add('active');
      applyGlobalColorFilter(btn.getAttribute('data-filter'));
    });
  });

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
  S.perspectiveMode=false;S.perspectiveCorners=null;S.perspectiveDragging=-1;S.perspectiveAutoApplied=false;
  S.pointers.clear();S.dragging=false;S.tainted=false;S.warning='';
  if(S.canvas){S.canvas.width=1;S.canvas.height=1}
  if(S.modal){
    S.modal.querySelector('.bp-editor').classList.remove('active');
    S.modal.querySelector('.bp-final').classList.remove('active');
    S.modal.querySelector('.bp-upload-card').style.display='';
    S.modal.querySelector('.bp-mask-editor').classList.remove('active');
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
    setProcessing(true,tr('جاري إنشاء الصورة...','Creating image...'));

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
    S.productAuto=cloneCanvas(S.productCanvas);S.colorBase=null;
    S.warning='';
  }catch(e){
    console.warn('[BARIQ_PREVIEW] AI background removal fallback',e);
    try{
      S.productCanvas=removeConnectedBackground(im);
      S.productAuto=cloneCanvas(S.productCanvas);S.colorBase=null;
      S.warning=tr('تعذر إنشاء القص الذكي لهذه الصورة. جرّب صورة أخرى أو أعد المحاولة.','Could not create the smart cutout for this image. Try another image or retry.');
    }catch(e2){
      S.productCanvas=cloneCanvas(S.productOriginal);
      S.productAuto=cloneCanvas(S.productCanvas);S.colorBase=null;
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
        setProcessing(true,tr('جاري إنشاء الصورة... ','Creating image... ')+pct+'%');
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
  var cacheKey='rmbg-1.4-q8-r43-a6648479275d';
  var cached=await rmbgCacheGet(cacheKey);
  if(cached){
    var cachedBytes=cached instanceof Uint8Array?cached:new Uint8Array(cached);
    if(cachedBytes.byteLength>40000000){
      setProcessing(true,tr('جاري إنشاء الصورة...','Creating image...'));
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
          setProcessing(true,tr('جاري إنشاء الصورة... ','Creating image... ')+pct+'%');
        }
      }
      bytes=new Uint8Array(received);
      var off=0;
      for(var i=0;i<chunks.length;i++){bytes.set(chunks[i],off);off+=chunks[i].byteLength}
    }

    if(bytes.byteLength<40000000)throw new Error('RMBG_FILE_TOO_SMALL_'+bytes.byteLength);
    setProcessing(true,tr('جاري إنشاء الصورة...','Creating image...'));
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

    setModelBadgeR34('RMBG-1.4','loading');
    setProcessing(true,tr('جاري إنشاء الصورة...','Creating image...'));

    try{
      var modelBytes=await fetchRmbgBytes();
      setProcessing(true,tr('جاري إنشاء الصورة...','Creating image...'));
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

  setProcessing(true,tr('جاري إنشاء الصورة...','Creating image...'));
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
  var mx=mask.getContext('2d',{willReadFrequently:true}),mid=mx.createImageData(size,size),md=mid.data;
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


  // R43: remove detached background islands while preserving the real product.
  // We do NOT raise the global cut threshold. Connected product detail stays intact.
  try{
    var oc=out.getContext('2d',{willReadFrequently:true});
    var im=oc.getImageData(0,0,out.width,out.height);
    var d=im.data,w=out.width,h=out.height,n=w*h;
    var fg=new Uint8Array(n),seen=new Uint8Array(n);
    var q=new Int32Array(n);
    var components=[];
    var minSolid=34;

    for(var i=0;i<n;i++){
      if(d[i*4+3]>=minSolid)fg[i]=1;
    }

    // Connected components in the predicted foreground.
    for(var sy=0;sy<h;sy++){
      for(var sx=0;sx<w;sx++){
        var seed=sy*w+sx;
        if(!fg[seed]||seen[seed])continue;

        var head=0,tail=0,count=0,minx=w,maxx=0,miny=h,maxy=0,strong=0,sumAlpha=0;
        q[tail++]=seed; seen[seed]=1;

        while(head<tail){
          var k=q[head++],x=k%w,y=(k/w)|0,a=d[k*4+3];
          count++; sumAlpha+=a;
          if(a>=150)strong++;
          if(x<minx)minx=x;if(x>maxx)maxx=x;
          if(y<miny)miny=y;if(y>maxy)maxy=y;

          var nk;
          if(x>0){nk=k-1;if(fg[nk]&&!seen[nk]){seen[nk]=1;q[tail++]=nk;}}
          if(x<w-1){nk=k+1;if(fg[nk]&&!seen[nk]){seen[nk]=1;q[tail++]=nk;}}
          if(y>0){nk=k-w;if(fg[nk]&&!seen[nk]){seen[nk]=1;q[tail++]=nk;}}
          if(y<h-1){nk=k+w;if(fg[nk]&&!seen[nk]){seen[nk]=1;q[tail++]=nk;}}
        }

        components.push({
          start:seed,count:count,minx:minx,maxx:maxx,miny:miny,maxy:maxy,
          strong:strong,avg:sumAlpha/Math.max(1,count)
        });
      }
    }

    if(components.length){
      // The actual product may contain multiple separate pieces.
      // Keep every substantial/confident component, not only the largest one.
      var largest=0;
      for(var ci=0;ci<components.length;ci++)largest=Math.max(largest,components[ci].count);
      var minKeep=Math.max(28,Math.round(largest*0.006)); // R45: reject detached background speckles more aggressively

      // Re-run flood fill only for components that should be deleted.
      seen.fill(0);
      for(var sy=0;sy<h;sy++){
        for(var sx=0;sx<w;sx++){
          var seed=sy*w+sx;
          if(!fg[seed]||seen[seed])continue;

          var head=0,tail=0,strong=0,sumAlpha=0,minx=w,maxx=0,miny=h,maxy=0;
          q[tail++]=seed;seen[seed]=1;

          while(head<tail){
            var k=q[head++],x=k%w,y=(k/w)|0,a=d[k*4+3];
            sumAlpha+=a;if(a>=150)strong++;
            if(x<minx)minx=x;if(x>maxx)maxx=x;
            if(y<miny)miny=y;if(y>maxy)maxy=y;
            var nk;
            if(x>0){nk=k-1;if(fg[nk]&&!seen[nk]){seen[nk]=1;q[tail++]=nk;}}
            if(x<w-1){nk=k+1;if(fg[nk]&&!seen[nk]){seen[nk]=1;q[tail++]=nk;}}
            if(y>0){nk=k-w;if(fg[nk]&&!seen[nk]){seen[nk]=1;q[tail++]=nk;}}
            if(y<h-1){nk=k+w;if(fg[nk]&&!seen[nk]){seen[nk]=1;q[tail++]=nk;}}
          }

          var count=tail,avg=sumAlpha/Math.max(1,count);
          var bw=maxx-minx+1,bh=maxy-miny+1;
          var touchesEdge=minx<=1||miny<=1||maxx>=w-2||maxy>=h-2;

          // Background residue is typically a small/thin, weak component.
          // Preserve confident small product pieces.
          var weak = avg<118 && strong<Math.max(5,count*.11);
          var tiny = count<minKeep;
          var thin = (bw>12 && bh<=3) || (bh>12 && bw<=3);
          var density=count/Math.max(1,bw*bh);
          // R46: white background splatter is usually an airy/sparse island even when its alpha is strong.
          // Delete sparse detached clouds by geometry, while dense product pieces (boxes, plaques, cups) stay intact.
          var sparseCloud = density<.30 && count<largest*.32;
          var smallAiry = density<.48 && count<Math.max(minKeep*3,largest*.035);
          var remove = sparseCloud || smallAiry ||
            (tiny && (weak || density<.58 || count<Math.max(22,largest*.0022))) ||
            (thin && avg<185) ||
            (touchesEdge && count<largest*.08 && (weak || density<.58));

          if(remove){
            for(var qi=0;qi<tail;qi++)d[q[qi]*4+3]=0;
          }
        }
      }

      // Suppress only very faint fringe left after island removal.
      // Pixels beside solid foreground are retained for antialiased edges.
      var alpha=new Uint8ClampedArray(n);
      for(var i=0;i<n;i++)alpha[i]=d[i*4+3];

      for(var y=1;y<h-1;y++){
        for(var x=1;x<w-1;x++){
          var k=y*w+x,a=alpha[k];
          if(a===0||a>=48)continue;
          var support=0;
          for(var yy=y-1;yy<=y+1;yy++){
            for(var xx=x-1;xx<=x+1;xx++){
              if(alpha[yy*w+xx]>=120)support++;
            }
          }
          if(support===0)d[k*4+3]=0;
        }
      }
    }

    // R47: remove the last pale/white RMBG splatter that can stay connected to the product by tiny bridges.
    // Important: this is NOT a global white-pixel delete. We only prune PALE pixels living in sparse alpha
    // neighbourhoods; dark/thin product details are protected, and pale pixels inside solid product pieces survive.
    var pre47=new Uint8ClampedArray(n);
    for(var r47i=0;r47i<n;r47i++)pre47[r47i]=d[r47i*4+3];
    var integ=new Uint32Array((w+1)*(h+1));
    for(var r47y=0;r47y<h;r47y++){
      var rowsum=0,io=(r47y+1)*(w+1),prev=r47y*(w+1);
      for(var r47x=0;r47x<w;r47x++){
        if(pre47[r47y*w+r47x]>=46)rowsum++;
        integ[io+r47x+1]=integ[prev+r47x+1]+rowsum;
      }
    }
    function r47Count(cx,cy,rad){
      var x0=Math.max(0,cx-rad),x1=Math.min(w-1,cx+rad),y0=Math.max(0,cy-rad),y1=Math.min(h-1,cy+rad);
      var A=y0*(w+1)+x0,B=y0*(w+1)+x1+1,C=(y1+1)*(w+1)+x0,D=(y1+1)*(w+1)+x1+1;
      return integ[D]-integ[B]-integ[C]+integ[A];
    }
    for(var r47y=1;r47y<h-1;r47y++)for(var r47x=1;r47x<w-1;r47x++){
      var rk=r47y*w+r47x,ra=pre47[rk]; if(ra<46)continue;
      var di=rk*4,lum=d[di]*.2126+d[di+1]*.7152+d[di+2]*.0722;
      // Splatter in the supplied examples is pale. Never prune dark graphics/cords/lettering here.
      if(lum<154)continue;
      var c2=r47Count(r47x,r47y,2), c4=r47Count(r47x,r47y,4), c7=r47Count(r47x,r47y,7);
      var den2=c2/25,den4=c4/81,den7=c7/225;
      // Isolated flecks and airy connected clouds. Solid boxes/plaques/trays have much higher local support.
      if((den2<.34 && den4<.39) || (den4<.31 && den7<.36) || (ra<125 && den4<.43 && den7<.46)){
        d[di+3]=0;
      }
    }

    // One tiny bridge-pruning pass after R47, only for pale survivors at the outer edge.
    var r47a=new Uint8ClampedArray(n);for(var r47i=0;r47i<n;r47i++)r47a[r47i]=d[r47i*4+3];
    for(var r47y=1;r47y<h-1;r47y++)for(var r47x=1;r47x<w-1;r47x++){
      var rk=r47y*w+r47x,ra=r47a[rk];if(!ra)continue;var di=rk*4;
      var lum=d[di]*.2126+d[di+1]*.7152+d[di+2]*.0722;if(lum<154)continue;
      var nb=0;for(var yy=r47y-1;yy<=r47y+1;yy++)for(var xx=r47x-1;xx<=r47x+1;xx++)if(!(xx===r47x&&yy===r47y)&&r47a[yy*w+xx]>=46)nb++;
      if(nb<=2)d[di+3]=0;
    }

    // R48: final sparse-halo cleanup.  RMBG can leave large, bright "paint splashes" that are
    // technically connected to the product, so connected-component cleanup alone cannot remove them.
    // Classify only bright pixels, then require BOTH low alpha occupancy at medium/large radii and
    // weak nearby non-bright product support.  Dense white product surfaces remain protected.
    var r48src=new Uint8ClampedArray(n);
    for(var r48i=0;r48i<n;r48i++)r48src[r48i]=d[r48i*4+3];
    var r48occ=new Uint32Array((w+1)*(h+1)),r48dark=new Uint32Array((w+1)*(h+1));
    for(var r48y=0;r48y<h;r48y++){
      var os=0,ds=0,oi=(r48y+1)*(w+1),op=r48y*(w+1);
      for(var r48x=0;r48x<w;r48x++){
        var r48k=r48y*w+r48x,r48di=r48k*4,r48aa=r48src[r48k];
        var r48lum=d[r48di]*.2126+d[r48di+1]*.7152+d[r48di+2]*.0722;
        if(r48aa>=38)os++;
        if(r48aa>=100 && r48lum<142)ds++;
        r48occ[oi+r48x+1]=r48occ[op+r48x+1]+os;
        r48dark[oi+r48x+1]=r48dark[op+r48x+1]+ds;
      }
    }
    function r48Box(ii,cx,cy,rad){
      var x0=Math.max(0,cx-rad),x1=Math.min(w-1,cx+rad),y0=Math.max(0,cy-rad),y1=Math.min(h-1,cy+rad);
      var A=y0*(w+1)+x0,B=y0*(w+1)+x1+1,C=(y1+1)*(w+1)+x0,D=(y1+1)*(w+1)+x1+1;
      return ii[D]-ii[B]-ii[C]+ii[A];
    }
    for(var r48y=1;r48y<h-1;r48y++)for(var r48x=1;r48x<w-1;r48x++){
      var r48k=r48y*w+r48x,r48aa=r48src[r48k];if(r48aa<38)continue;
      var r48di=r48k*4,r48lum=d[r48di]*.2126+d[r48di+1]*.7152+d[r48di+2]*.0722;
      if(r48lum<148)continue; // never touch black cords/text/strong coloured artwork
      var r6=r48Box(r48occ,r48x,r48y,6)/169;
      var r11=r48Box(r48occ,r48x,r48y,11)/529;
      var r17=r48Box(r48occ,r48x,r48y,17)/1225;
      var dark11=r48Box(r48dark,r48x,r48y,11);
      // Big airy halo/splash: much less occupied than a real plaque/box/tray.
      var halo=(r11<.52 && r17<.48 && dark11<18) ||
               (r6<.46 && r11<.57 && dark11<10) ||
               (r48aa<150 && r11<.62 && r17<.54 && dark11<14);
      if(halo)d[r48di+3]=0;
    }
    // Remove one-pixel remnants exposed by the R48 halo deletion.
    var r48post=new Uint8ClampedArray(n);for(var r48i=0;r48i<n;r48i++)r48post[r48i]=d[r48i*4+3];
    for(var r48y=1;r48y<h-1;r48y++)for(var r48x=1;r48x<w-1;r48x++){
      var r48k=r48y*w+r48x,r48aa=r48post[r48k];if(!r48aa)continue;
      var r48di=r48k*4,r48lum=d[r48di]*.2126+d[r48di+1]*.7152+d[r48di+2]*.0722;if(r48lum<148)continue;
      var nn=0;for(var yy=r48y-1;yy<=r48y+1;yy++)for(var xx=r48x-1;xx<=r48x+1;xx++)if(!(xx===r48x&&yy===r48y)&&r48post[yy*w+xx]>=38)nn++;
      if(nn<=3)d[r48di+3]=0;
    }

    // R49: stronger connected white-splatter cleanup.
    // The remaining artefacts in difficult studio photos are often FULL-alpha wall/floor texture,
    // so alpha strength alone cannot identify them.  Remove only BRIGHT pixels that live in an
    // airy neighbourhood and have almost no nearby dark/coloured product support.  Dense white
    // product faces (boxes, plaques, trays) remain because their local occupancy is high.
    for(var r49pass=0;r49pass<2;r49pass++){
      var r49src=new Uint8ClampedArray(n);
      for(var r49i=0;r49i<n;r49i++)r49src[r49i]=d[r49i*4+3];
      var r49occ=new Uint32Array((w+1)*(h+1)),r49solid=new Uint32Array((w+1)*(h+1));
      for(var r49y=0;r49y<h;r49y++){
        var r49os=0,r49ss=0,r49row=(r49y+1)*(w+1),r49prev=r49y*(w+1);
        for(var r49x=0;r49x<w;r49x++){
          var r49k=r49y*w+r49x,r49di=r49k*4,r49a=r49src[r49k];
          var r49lum=d[r49di]*.2126+d[r49di+1]*.7152+d[r49di+2]*.0722;
          if(r49a>=34)r49os++;
          // Non-bright / coloured / dark pixels are strong evidence of a real product part.
          if(r49a>=105 && r49lum<150)r49ss++;
          r49occ[r49row+r49x+1]=r49occ[r49prev+r49x+1]+r49os;
          r49solid[r49row+r49x+1]=r49solid[r49prev+r49x+1]+r49ss;
        }
      }
      function r49Box(ii,cx,cy,rad){
        var x0=Math.max(0,cx-rad),x1=Math.min(w-1,cx+rad),y0=Math.max(0,cy-rad),y1=Math.min(h-1,cy+rad);
        var A=y0*(w+1)+x0,B=y0*(w+1)+x1+1,C=(y1+1)*(w+1)+x0,D=(y1+1)*(w+1)+x1+1;
        return ii[D]-ii[B]-ii[C]+ii[A];
      }
      for(var r49y=1;r49y<h-1;r49y++)for(var r49x=1;r49x<w-1;r49x++){
        var r49k=r49y*w+r49x,r49a=r49src[r49k];if(r49a<34)continue;
        var r49di=r49k*4,r49lum=d[r49di]*.2126+d[r49di+1]*.7152+d[r49di+2]*.0722;
        if(r49lum<160)continue;
        var q5=r49Box(r49occ,r49x,r49y,5)/121;
        var q9=r49Box(r49occ,r49x,r49y,9)/361;
        var q14=r49Box(r49occ,r49x,r49y,14)/841;
        var real9=r49Box(r49solid,r49x,r49y,9);
        var real14=r49Box(r49solid,r49x,r49y,14);
        // Stronger than R48, but requires weak real-product support to avoid eating white objects.
        var airy = (q5<.64 && q9<.69 && q14<.67 && real9<14) ||
                   (q9<.60 && q14<.63 && real14<28) ||
                   (r49a<175 && q9<.72 && q14<.69 && real9<18);
        if(airy)d[r49di+3]=0;
      }
    }

    // Clean tiny bright crumbs exposed by R49 without touching dark typography/cords.
    var r49post=new Uint8ClampedArray(n);for(var r49i=0;r49i<n;r49i++)r49post[r49i]=d[r49i*4+3];
    for(var r49y=1;r49y<h-1;r49y++)for(var r49x=1;r49x<w-1;r49x++){
      var r49k=r49y*w+r49x,r49a=r49post[r49k];if(!r49a)continue;
      var r49di=r49k*4,r49lum=d[r49di]*.2126+d[r49di+1]*.7152+d[r49di+2]*.0722;if(r49lum<160)continue;
      var r49nb=0,r49strong=0;
      for(var yy=r49y-1;yy<=r49y+1;yy++)for(var xx=r49x-1;xx<=r49x+1;xx++)if(!(xx===r49x&&yy===r49y)){
        var aa=r49post[yy*w+xx];if(aa>=34)r49nb++;if(aa>=180)r49strong++;
      }
      if(r49nb<=3 && r49strong<=2)d[r49di+3]=0;
    }

    // R54: conservative final edge polish for the last pale rim/crumbs.
    // Only bright pixels already touching transparent space are affected; dense white product faces stay intact.
    var r54src=new Uint8ClampedArray(n);for(var r54i=0;r54i<n;r54i++)r54src[r54i]=d[r54i*4+3];
    for(var r54y=2;r54y<h-2;r54y++)for(var r54x=2;r54x<w-2;r54x++){
      var r54k=r54y*w+r54x,r54a=r54src[r54k];if(r54a<28)continue;
      var r54di=r54k*4,r54lum=d[r54di]*.2126+d[r54di+1]*.7152+d[r54di+2]*.0722;
      if(r54lum<172)continue;
      var transparent=0,strong=0,dark=0,occupied=0,total=0;
      for(var r54yy=r54y-2;r54yy<=r54y+2;r54yy++)for(var r54xx=r54x-2;r54xx<=r54x+2;r54xx++){
        if(r54xx===r54x&&r54yy===r54y)continue;
        var na=r54src[r54yy*w+r54xx]; total++;
        if(na<=10)transparent++;
        if(na>=190)strong++;
        if(na>=38)occupied++;
        if(na>=105){
          var ndi=(r54yy*w+r54xx)*4;
          var nl=d[ndi]*.2126+d[ndi+1]*.7152+d[ndi+2]*.0722;
          if(nl<150)dark++;
        }
      }
      // True product edges usually have strong/dark support immediately behind them.
      // Pale residue has transparent space on several sides and little structural support.
      if(transparent>=8 && dark<=1 && strong<=7 && occupied/total<.66){
        d[r54di+3]=0;
      }else if(transparent>=6 && dark===0 && strong<=5 && r54a<175){
        d[r54di+3]=Math.max(0,r54a-110);
      }
    }

    // R55: remove only tiny detached BRIGHT airy components left by RMBG (e.g. the last white fleck above the product).
    // Dense/structured detached product pieces are preserved by density + dark-detail checks.
    (function(){
      var aa=new Uint8ClampedArray(n),seen55=new Uint8Array(n),q55=new Int32Array(n);
      for(var i55=0;i55<n;i55++)aa[i55]=d[i55*4+3];
      var maxCandidate=Math.max(180,Math.round(n*.0045));
      for(var y55=0;y55<h;y55++)for(var x55=0;x55<w;x55++){
        var seed55=y55*w+x55;if(aa[seed55]<30||seen55[seed55])continue;
        var head55=0,tail55=0,minx55=w,maxx55=0,miny55=h,maxy55=0,bright55=0,dark55=0,strong55=0;
        q55[tail55++]=seed55;seen55[seed55]=1;
        while(head55<tail55){
          var k55=q55[head55++],xx55=k55%w,yy55=(k55/w)|0,di55=k55*4,a55=aa[k55];
          if(xx55<minx55)minx55=xx55;if(xx55>maxx55)maxx55=xx55;if(yy55<miny55)miny55=yy55;if(yy55>maxy55)maxy55=yy55;
          var lum55=d[di55]*.2126+d[di55+1]*.7152+d[di55+2]*.0722;
          if(lum55>=170)bright55++;if(lum55<145&&a55>=90)dark55++;if(a55>=185)strong55++;
          var nk55;
          if(xx55>0){nk55=k55-1;if(aa[nk55]>=30&&!seen55[nk55]){seen55[nk55]=1;q55[tail55++]=nk55;}}
          if(xx55<w-1){nk55=k55+1;if(aa[nk55]>=30&&!seen55[nk55]){seen55[nk55]=1;q55[tail55++]=nk55;}}
          if(yy55>0){nk55=k55-w;if(aa[nk55]>=30&&!seen55[nk55]){seen55[nk55]=1;q55[tail55++]=nk55;}}
          if(yy55<h-1){nk55=k55+w;if(aa[nk55]>=30&&!seen55[nk55]){seen55[nk55]=1;q55[tail55++]=nk55;}}
        }
        var count55=tail55,bw55=maxx55-minx55+1,bh55=maxy55-miny55+1,density55=count55/Math.max(1,bw55*bh55);
        var brightRatio55=bright55/Math.max(1,count55),darkRatio55=dark55/Math.max(1,count55),strongRatio55=strong55/Math.max(1,count55);
        var compactReal55=density55>=.72 || darkRatio55>=.055 || (strongRatio55>=.72&&density55>=.56);
        var paleAiry55=count55<=maxCandidate && brightRatio55>=.68 && density55<.67 && darkRatio55<.035;
        var tinyPale55=count55<=Math.max(80,Math.round(n*.0012)) && brightRatio55>=.78 && darkRatio55<.025 && density55<.76;
        if(!compactReal55&&(paleAiry55||tinyPale55)){
          for(var z55=0;z55<tail55;z55++)d[q55[z55]*4+3]=0;
        }
      }
    })();

    // R44: trim weak OUTER alpha fringe only (mask-only; preserves white product details).
    var a0=new Uint8ClampedArray(n);
    for(var ai=0;ai<n;ai++)a0[ai]=d[ai*4+3];
    for(var pass=0;pass<2;pass++){
      var src=new Uint8ClampedArray(n);src.set(a0);
      for(var fy=1;fy<h-1;fy++)for(var fx=1;fx<w-1;fx++){
        var fk=fy*w+fx,fa=src[fk]; if(fa===0||fa>=210)continue;
        var z=0,solid=0;
        for(var ny=fy-1;ny<=fy+1;ny++)for(var nx=fx-1;nx<=fx+1;nx++){
          if(nx===fx&&ny===fy)continue; var na=src[ny*w+nx];
          if(na<=8)z++; if(na>=190)solid++;
        }
        if(z>=4&&solid<=2)a0[fk]=0;
        else if(z>=3&&fa<150)a0[fk]=Math.max(0,fa-85);
        else if(z>=2&&fa<105)a0[fk]=Math.max(0,fa-55);
      }
    }
    for(var ai=0;ai<n;ai++)d[ai*4+3]=a0[ai];

    oc.putImageData(im,0,0);
  }catch(e){
    console.warn('[BARIQ PREVIEW] residue cleanup skipped',e);
  }

  return out;
}

async function removeBackgroundAI(originalCanvas){
  // R34 verification mode: RMBG-1.4 ONLY.
  // No U2NetP fallback. If RMBG fails, show the real error to the user.
  setModelBadgeR34('RMBG-1.4', 'loading');

  var out;
  try{
    out=await removeBackgroundRmbg14(originalCanvas);
  }catch(e){
    console.error('[BARIQ_PREVIEW] RMBG-1.4 FAILED — fallback disabled in R34',e);
    setModelBadgeR34('RMBG-1.4 فشل', 'error');
    throw e;
  }

  var ctx=out.getContext('2d',{willReadFrequently:true}),
      d=ctx.getImageData(0,0,out.width,out.height).data;
  var visible=0,total=out.width*out.height;
  for(var i=3;i<d.length;i+=4)if(d[i]>12)visible++;
  var ratio=visible/Math.max(1,total);

  if(ratio<.006||ratio>.99){
    var er=new Error('RMBG_UNSAFE_MASK_'+ratio.toFixed(3));
    console.error('[BARIQ_PREVIEW] RMBG-1.4 FAILED — unsafe mask',er);
    setModelBadgeR34('RMBG-1.4 فشل', 'error');
    throw er;
  }

  console.info('[BARIQ_PREVIEW] RMBG-1.4 R48 EDGE-CLEAN ACTIVE');
  setModelBadgeR34('RMBG-1.4', 'ok');
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
    S.productAuto=cloneCanvas(S.productCanvas);S.colorBase=null;
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
  c.getContext('2d',{willReadFrequently:true}).drawImage(src,0,0);return c;
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

var _bariqCropUndoStack=[];
var _bariqCropUndoMax=12;

function cloneCanvasR40(src){
  if(!src)return null;
  var c=document.createElement('canvas');
  c.width=src.width;c.height=src.height;
  c.getContext('2d',{willReadFrequently:true}).drawImage(src,0,0);
  return c;
}
function pushCropUndoR40(){
  try{
    if(!S.productCanvas)return;
    _bariqCropUndoStack.push(cloneCanvasR40(S.productCanvas));
    if(_bariqCropUndoStack.length>_bariqCropUndoMax)_bariqCropUndoStack.shift();
    updateCropUndoR40();
  }catch(_){}
}
function undoCropR40(){
  var prev=_bariqCropUndoStack.pop();
  if(!prev)return;
  S.productCanvas=prev;
  try{renderMaskEditor();}catch(_){}
  try{draw();}catch(_){}
  try{revokeExport();}catch(_){}
  updateCropUndoR40();
}
function updateCropUndoR40(){
  var b=S.modal&&S.modal.querySelector('[data-act="cropUndoR40"]');
  if(b)b.disabled=!_bariqCropUndoStack.length;
}

function maskPointer(e){
  if(e.type==='pointerdown')pushCropUndoR40();
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



function ensureColorBase(){
  if(!S.productCanvas)return null;
  if(!S.colorBase)S.colorBase=cloneCanvas(S.productCanvas);
  return S.colorBase;
}

function globalHexRgb(v){
  v=String(v||'#b07b55').replace('#','');
  if(v.length===3)v=v.split('').map(function(c){return c+c}).join('');
  var n=parseInt(v,16);
  return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
}

function globalRgbHsv(r,g,b){
  r/=255;g/=255;b/=255;
  var mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;
  if(d){
    if(mx===r)h=((g-b)/d)%6;
    else if(mx===g)h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h*=60;if(h<0)h+=360;
  }
  return {h:h,s:mx?d/mx:0,v:mx};
}

function globalHsvRgb(h,s,v){
  h=((h%360)+360)%360;
  var c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r=0,g=0,b=0;
  if(h<60){r=c;g=x}
  else if(h<120){r=x;g=c}
  else if(h<180){g=c;b=x}
  else if(h<240){g=x;b=c}
  else if(h<300){r=x;b=c}
  else{r=c;b=x}
  return {
    r:Math.round((r+m)*255),
    g:Math.round((g+m)*255),
    b:Math.round((b+m)*255)
  };
}

function filterTarget(name){
  if(name==='warm')return {h:30,s:.56,v:1};
  if(name==='cool')return {h:205,s:.48,v:1};
  if(name==='navy')return {h:220,s:.72,v:.72};
  if(name==='gold')return {h:43,s:.78,v:.95};
  if(name==='rose')return {h:345,s:.58,v:.92};
  if(name==='green')return {h:138,s:.55,v:.82};
  if(name==='mono')return {h:0,s:0,v:.88};
  return null;
}

function applyGlobalColorFilter(name){
  var base=ensureColorBase();
  if(!base)return;

  if(name==='original'){
    resetProductColors();
    return;
  }

  var strengthEl=S.modal.querySelector('.bp-color-strength');
  var strength=Math.max(0,Math.min(1,Number(strengthEl?strengthEl.value:72)/100));
  var target;

  if(name==='custom'){
    var rgb=globalHexRgb(S.modal.querySelector('.bp-color-input').value);
    var hsv=globalRgbHsv(rgb.r,rgb.g,rgb.b);
    target={h:hsv.h,s:hsv.s,v:hsv.v};
  }else{
    target=filterTarget(name);
  }
  if(!target)return;

  var c=cloneCanvas(base),x=c.getContext('2d',{willReadFrequently:true});
  var id=x.getImageData(0,0,c.width,c.height),d=id.data;

  for(var i=0;i<d.length;i+=4){
    if(d[i+3]<10)continue;

    var old=globalRgbHsv(d[i],d[i+1],d[i+2]);

    // Preserve original brightness/shading almost completely.
    var newH=target.h;
    var newS=old.s*(1-strength)+target.s*strength;

    // White/gray areas remain more neutral so logos/text/highlights stay natural.
    if(old.s<.10)newS*=.30;

    var targetV = name==='mono' ? old.v*.96 : old.v;
    var newV=old.v*(1-strength*.10)+targetV*(strength*.10);

    // Very dark details should stay dark instead of being painted flat.
    if(old.v<.18)newS*=.50;

    var rgb=globalHsvRgb(newH,Math.max(0,Math.min(1,newS)),Math.max(0,Math.min(1,newV)));
    d[i]=rgb.r;d[i+1]=rgb.g;d[i+2]=rgb.b;
  }

  x.putImageData(id,0,0);
  S.productCanvas=c;
  renderMaskEditor();
  draw();
  revokeExport();
  setStatus(tr('تم تطبيق فلتر اللون على المنتج بالكامل.','Color filter applied to the whole product.'),'info');
}

function resetProductColors(){
  if(!S.colorBase)return;
  S.productCanvas=cloneCanvas(S.colorBase);
  renderMaskEditor();
  draw();
  revokeExport();
  var buttons=S.modal&&S.modal.querySelectorAll('.bp-color-presets button');
  if(buttons)buttons.forEach(function(b){b.classList.toggle('active',b.getAttribute('data-filter')==='original')});
}



function makeColorPreviewR40(mode){
  if(!S.productCanvas)return '';
  var src=S.productCanvas;
  var c=document.createElement('canvas');
  var W=120,H=90;
  c.width=W;c.height=H;
  var x=c.getContext('2d',{willReadFrequently:true});
  var scale=Math.min((W-10)/src.width,(H-10)/src.height);
  var dw=src.width*scale,dh=src.height*scale,dx=(W-dw)/2,dy=(H-dh)/2;
  x.drawImage(src,dx,dy,dw,dh);

  if(mode && mode!=='original'){
    var map={
      warm:[30,.56,1],
      cool:[205,.48,1],
      navy:[220,.72,.72],
      gold:[43,.78,.95],
      rose:[345,.58,.92],
      green:[138,.55,.82],
      mono:[0,0,.88]
    };
    var t=map[mode];
    if(t){
      var id=x.getImageData(0,0,W,H),d=id.data;
      for(var i=0;i<d.length;i+=4){
        if(d[i+3]<10)continue;
        var old=globalRgbHsv(d[i],d[i+1],d[i+2]);
        var s=old.s<.10?t[1]*.20:t[1];
        var rgb=globalHsvRgb(t[0],s,old.v);
        d[i]=rgb.r;d[i+1]=rgb.g;d[i+2]=rgb.b;
      }
      x.putImageData(id,0,0);
    }
  }
  return c.toDataURL('image/png');
}

function refreshColorPresetThumbsR40(){
  if(!S.modal||!S.productCanvas)return;
  S.modal.querySelectorAll('.bp-color-presets button[data-filter]').forEach(function(btn){
    var mode=btn.getAttribute('data-filter')||'original';
    var img=btn.querySelector('img.bp-preset-thumb');
    if(!img){
      img=document.createElement('img');
      img.className='bp-preset-thumb';
      img.alt='';
      btn.insertBefore(img,btn.firstChild);
    }
    img.src=makeColorPreviewR40(mode);
  });
}

function setupCanvas(){
  S.canvas.width=S.placeImg.width;
  S.canvas.height=S.placeImg.height;
  var pw=S.productCanvas.width,ph=S.productCanvas.height;
  var maxW=S.canvas.width*.34,maxH=S.canvas.height*.34;
  var k=Math.min(maxW/pw,maxH/ph,1);
  S.baseProductW=pw*k;S.baseProductH=ph*k;
  S.scale=1;S.rotation=0;
  S.perspectiveMode=false;S.perspectiveCorners=defaultPerspectiveCorners();S.perspectiveDragging=-1;S.perspectiveAutoApplied=false;
  S.productX=S.canvas.width/2;S.productY=S.canvas.height/2;
  S.modal.querySelector('.bp-rotate').value='0';
  S.modal.querySelector('.bp-final').classList.remove('active');
  revokeExport();
  renderMaskEditor();
}


function defaultPerspectiveCorners(){
  return [
    {x:-.5,y:-.5}, // top-left
    {x:.5,y:-.5},  // top-right
    {x:.5,y:.5},   // bottom-right
    {x:-.5,y:.5}   // bottom-left
  ];
}
function ensurePerspectiveCorners(){
  if(!Array.isArray(S.perspectiveCorners)||S.perspectiveCorners.length!==4)S.perspectiveCorners=defaultPerspectiveCorners();
  return S.perspectiveCorners;
}
function perspectiveLocalCorners(w,h){
  return ensurePerspectiveCorners().map(function(p){return{x:p.x*w,y:p.y*h}});
}
function localToCanvasPoint(p){
  var r=S.rotation*Math.PI/180,cs=Math.cos(r),sn=Math.sin(r);
  return{x:S.productX+p.x*cs-p.y*sn,y:S.productY+p.x*sn+p.y*cs};
}
function canvasToLocalPoint(p){
  var dx=p.x-S.productX,dy=p.y-S.productY,r=-S.rotation*Math.PI/180,cs=Math.cos(r),sn=Math.sin(r);
  return{x:dx*cs-dy*sn,y:dx*sn+dy*cs};
}
function bilerpQuad(q,u,v){
  var a=(1-u)*(1-v),b=u*(1-v),c=u*v,d=(1-u)*v;
  return{x:q[0].x*a+q[1].x*b+q[2].x*c+q[3].x*d,y:q[0].y*a+q[1].y*b+q[2].y*c+q[3].y*d};
}
function affineTriangle(src,dst){
  var x0=src[0].x,y0=src[0].y,x1=src[1].x,y1=src[1].y,x2=src[2].x,y2=src[2].y;
  var u0=dst[0].x,v0=dst[0].y,u1=dst[1].x,v1=dst[1].y,u2=dst[2].x,v2=dst[2].y;
  var den=x0*(y1-y2)+x1*(y2-y0)+x2*(y0-y1);if(Math.abs(den)<1e-6)return null;
  return{
    a:(u0*(y1-y2)+u1*(y2-y0)+u2*(y0-y1))/den,
    c:(u0*(x2-x1)+u1*(x0-x2)+u2*(x1-x0))/den,
    e:(u0*(x1*y2-x2*y1)+u1*(x2*y0-x0*y2)+u2*(x0*y1-x1*y0))/den,
    b:(v0*(y1-y2)+v1*(y2-y0)+v2*(y0-y1))/den,
    d:(v0*(x2-x1)+v1*(x0-x2)+v2*(x1-x0))/den,
    f:(v0*(x1*y2-x2*y1)+v1*(x2*y0-x0*y2)+v2*(x0*y1-x1*y0))/den
  };
}
function drawWarpTriangle(ctx,img,src,dst){
  var m=affineTriangle(src,dst);if(!m)return;
  ctx.save();
  ctx.beginPath();ctx.moveTo(dst[0].x,dst[0].y);ctx.lineTo(dst[1].x,dst[1].y);ctx.lineTo(dst[2].x,dst[2].y);ctx.closePath();ctx.clip();
  ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);
  ctx.drawImage(img,0,0);
  ctx.restore();
}
function drawPerspectiveImage(ctx,img,w,h,quality){
  var q=perspectiveLocalCorners(w,h),cols=quality?12:8,rows=quality?12:8,sw=img.width,sh=img.height;
  for(var gy=0;gy<rows;gy++){
    var v0=gy/rows,v1=(gy+1)/rows;
    for(var gx=0;gx<cols;gx++){
      var u0=gx/cols,u1=(gx+1)/cols;
      var s00={x:u0*sw,y:v0*sh},s10={x:u1*sw,y:v0*sh},s11={x:u1*sw,y:v1*sh},s01={x:u0*sw,y:v1*sh};
      var d00=bilerpQuad(q,u0,v0),d10=bilerpQuad(q,u1,v0),d11=bilerpQuad(q,u1,v1),d01=bilerpQuad(q,u0,v1);
      drawWarpTriangle(ctx,img,[s00,s10,s11],[d00,d10,d11]);
      drawWarpTriangle(ctx,img,[s00,s11,s01],[d00,d11,d01]);
    }
  }
}
function drawPerspectiveHandles(ctx,w,h){
  if(!S.perspectiveMode)return;
  var q=perspectiveLocalCorners(w,h);
  ctx.save();ctx.filter='none';ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(216,172,36,.95)';ctx.lineWidth=Math.max(2,Math.min(4,w*.006));ctx.setLineDash([8,6]);
  ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);for(var i=1;i<4;i++)ctx.lineTo(q[i].x,q[i].y);ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  for(var j=0;j<4;j++){
    ctx.beginPath();ctx.fillStyle='#e0b62f';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.arc(q[j].x,q[j].y,Math.max(7,Math.min(13,w*.018)),0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  ctx.restore();
}
function perspectiveHandleAt(p){
  if(!S.perspectiveMode||!S.productCanvas)return -1;
  var w=S.baseProductW*S.scale,h=S.baseProductH*S.scale,q=perspectiveLocalCorners(w,h),lp=canvasToLocalPoint(p),rad=Math.max(18,Math.min(34,w*.045));
  for(var i=0;i<4;i++){var dx=lp.x-q[i].x,dy=lp.y-q[i].y;if(dx*dx+dy*dy<=rad*rad)return i;}
  return -1;
}
function setPerspectiveCornerFromCanvas(i,p){
  if(i<0||i>3)return;var w=S.baseProductW*S.scale,h=S.baseProductH*S.scale,lp=canvasToLocalPoint(p),q=ensurePerspectiveCorners();
  var nx=clamp(lp.x/w,-.78,.78),ny=clamp(lp.y/h,-.72,.72);
  // Keep corners in their logical quadrants so the mesh cannot fold over itself.
  if(i===0){nx=Math.min(nx,-.04);ny=Math.min(ny,-.04)}
  if(i===1){nx=Math.max(nx,.04);ny=Math.min(ny,-.04)}
  if(i===2){nx=Math.max(nx,.04);ny=Math.max(ny,.04)}
  if(i===3){nx=Math.min(nx,-.04);ny=Math.max(ny,.04)}
  q[i]={x:nx,y:ny};revokeExport();draw();
}
function autoPerspective(){
  if(!S.placeImg||!S.productCanvas)return;
  var yNorm=clamp(S.productY/Math.max(1,S.canvas.height),0,1);
  var xNorm=clamp(S.productX/Math.max(1,S.canvas.width),0,1);
  // Conservative camera-plane estimate: upper edge becomes slightly narrower, with a tiny lateral convergence
  // toward the image centre. This is deliberately mild so Auto is a useful starting point, not a destructive guess.
  var inset=.035+(1-yNorm)*.045;
  var topY=-.48+(1-yNorm)*.015,bottomY=.50;
  var sideBias=(.5-xNorm)*.035;
  S.perspectiveCorners=[
    {x:-.5+inset+sideBias,y:topY},
    {x:.5-inset+sideBias,y:topY},
    {x:.5-sideBias*.25,y:bottomY},
    {x:-.5-sideBias*.25,y:bottomY}
  ];
  S.perspectiveAutoApplied=true;S.perspectiveMode=true;revokeExport();draw();
  setStatus(tr('تم اقتراح زاوية تلقائية. اسحب النقاط الذهبية لو احتجت ضبطًا أدق.','Auto Perspective applied. Drag the gold points if you want a finer match.'),'info');
}
function resetPerspective(){S.perspectiveCorners=defaultPerspectiveCorners();S.perspectiveAutoApplied=false;revokeExport();draw();}

function drawContactShadowR40(ctx,pc,x,y,w,h){
  if(!ctx||!pc||!w||!h)return;

  var px=pc.getContext('2d',{willReadFrequently:true});
  var pw=pc.width,ph=pc.height;
  var data=px.getImageData(0,0,pw,ph).data;
  var step=Math.max(1,Math.floor(Math.max(pw,ph)/650));

  // Find bottom-most visible pixels and their horizontal footprint.
  var maxY=-1,minX=pw,maxX=-1;
  for(var yy=0;yy<ph;yy+=step){
    for(var xx=0;xx<pw;xx+=step){
      if(data[(yy*pw+xx)*4+3]>45){
        if(yy>maxY)maxY=yy;
      }
    }
  }
  if(maxY<0)return;

  var band=Math.max(2,Math.round(ph*.035));
  for(var yy=Math.max(0,maxY-band);yy<=maxY;yy+=step){
    for(var xx=0;xx<pw;xx+=step){
      if(data[(yy*pw+xx)*4+3]>45){
        if(xx<minX)minX=xx;
        if(xx>maxX)maxX=xx;
      }
    }
  }
  if(maxX<minX)return;

  var sx=w/pw,sy=h/ph;
  var left=x+minX*sx,right=x+maxX*sx;
  var bottom=y+maxY*sy;
  var vw=Math.max(10,right-left);
  var cx=(left+right)/2;

  ctx.save();
  ctx.fillStyle='#000';

  // Core contact: exactly on the product base.
  ctx.globalAlpha=.24;
  ctx.filter='blur('+Math.max(.6,Math.min(2.2,vw*.0045))+'px)';
  ctx.beginPath();
  ctx.ellipse(cx,bottom,vw*.30,Math.max(.65,h*.0022),0,0,Math.PI*2);
  ctx.fill();

  // Soft spread: still almost touching, only slightly lower.
  ctx.globalAlpha=.11;
  ctx.filter='blur('+Math.max(1.2,Math.min(4.5,vw*.009))+'px)';
  ctx.beginPath();
  ctx.ellipse(cx,bottom+Math.max(.15,h*.00045),vw*.40,Math.max(1.1,h*.0045),0,0,Math.PI*2);
  ctx.fill();

  ctx.restore();
}
function hideTechnicalControlsR40(){
  if(!S.modal)return;
  S.modal.querySelectorAll('label,button,.bp-control,.bp-row').forEach(function(el){
    var t=(el.textContent||'').trim();
    if(/^(الشفافية|شفافية|الشادو|الظل|opacity|shadow)$/i.test(t))el.style.display='none';
  });
}

function draw(finalMode){
  finalMode=!!finalMode;
  if(!S.ctx||!S.placeImg)return;
  var c=S.canvas,x=S.ctx;
  x.save();
  x.clearRect(0,0,c.width,c.height);
  x.drawImage(S.placeImg,0,0,c.width,c.height);

  if(S.productCanvas){
    var w=S.baseProductW*S.scale,h=S.baseProductH*S.scale;
    var pc=S.productCanvas;
    // R54 final composite: estimate the local scene light from the actual background under/around the product.
    // This runs only for "Create preview" so interactive movement remains fast.
    var ambient={brightness:1,r:128,g:128,b:128};
    if(finalMode){
      try{
        var rx=Math.max(0,Math.floor(S.productX-w*.58)),ry=Math.max(0,Math.floor(S.productY-h*.58));
        var rw=Math.max(2,Math.min(c.width-rx,Math.ceil(w*1.16))),rh=Math.max(2,Math.min(c.height-ry,Math.ceil(h*1.16)));
        var bgd=x.getImageData(rx,ry,rw,rh).data,rr=0,gg=0,bb=0,cnt=0;
        var samp=Math.max(4,Math.floor(Math.sqrt((rw*rh)/12000)));
        for(var sy0=0;sy0<rh;sy0+=samp)for(var sx0=0;sx0<rw;sx0+=samp){
          var bi=(sy0*rw+sx0)*4;rr+=bgd[bi];gg+=bgd[bi+1];bb+=bgd[bi+2];cnt++;
        }
        if(cnt){
          rr/=cnt;gg/=cnt;bb/=cnt;
          var lum=.2126*rr+.7152*gg+.0722*bb;
          ambient={brightness:Math.max(.90,Math.min(1.07,.86+lum/1210)),r:rr,g:gg,b:bb};
        }
      }catch(e){console.warn('[BARIQ PREVIEW] ambient light sampling skipped',e);}
    }

    x.translate(S.productX,S.productY);
    x.rotate(S.rotation*Math.PI/180);

    // R46 automatic contact shadow: derive the base from substantial alpha rows, never from stray residue.
    // The shadow is built from the real lower product mask and compressed vertically, so it hugs the product
    // instead of becoming one distant ellipse / floating spot.
    try{
      var pctx=pc.getContext('2d',{willReadFrequently:true}),pw=pc.width,ph=pc.height;
      var pd=pctx.getImageData(0,0,pw,ph).data;
      var rowCount=new Int32Array(ph),maxCnt=0,totalOpaque=0;
      for(var yy=0;yy<ph;yy++){
        var cnt=0;
        for(var xx=0;xx<pw;xx++)if(pd[(yy*pw+xx)*4+3]>=110)cnt++;
        rowCount[yy]=cnt;totalOpaque+=cnt;if(cnt>maxCnt)maxCnt=cnt;
      }
      if(maxCnt>0&&totalOpaque>0){
        // Require a meaningful horizontal footprint and support in neighbouring rows.
        // This intentionally ignores isolated RMBG splatter below the actual object.
        var rowFloor=Math.max(3,Math.round(maxCnt*.065));
        var baseY=-1;
        for(var yy=ph-1;yy>=0;yy--){
          if(rowCount[yy]<rowFloor)continue;
          var support=rowCount[yy];
          if(yy>0)support+=rowCount[yy-1];
          if(yy>1)support+=rowCount[yy-2];
          if(yy<ph-1)support+=rowCount[yy+1];
          if(support>=rowFloor*2.15){baseY=yy;break;}
        }
        if(baseY<0){
          // Safe fallback: 99.6% opaque-pixel quantile, still resistant to a few low specks.
          var target=totalOpaque*.996,acc=0;
          for(var yy=0;yy<ph;yy++){acc+=rowCount[yy];if(acc>=target){baseY=yy;break;}}
        }
        if(baseY>=0){
          var band=Math.max(5,Math.round(ph*.055));
          var y0=Math.max(0,baseY-band+1),bh=baseY-y0+1;
          var sm=document.createElement('canvas');sm.width=pw;sm.height=bh;
          var sc=sm.getContext('2d',{willReadFrequently:true});
          var sid=sc.createImageData(pw,bh),sd=sid.data;
          for(var sy=0;sy<bh;sy++){
            var srcY=y0+sy;
            // Keep only rows that belong to the substantial lower footprint.
            if(rowCount[srcY]<Math.max(2,rowFloor*.28))continue;
            for(var sx=0;sx<pw;sx++){
              var a=pd[(srcY*pw+sx)*4+3];
              if(a<70)continue;
              var di=(sy*pw+sx)*4;
              sd[di]=sd[di+1]=sd[di+2]=0;
              sd[di+3]=Math.min(255,Math.round(a*.82));
            }
          }
          sc.putImageData(sid,0,0);

          var sxScale=w/pw,syScale=h/ph;
          var bottom=-h/2+baseY*syScale;
          var shadowH=Math.max(2.8,Math.min(h*.030,w*.024));
          var shadowTop=bottom-Math.max(.7,shadowH*.12); // overlap the product base: visibly grounded, never floating

          // R55 broad grounding shadow: use the complete product alpha, compressed vertically at the real base.
          // This gives every lower part some shadow instead of concentrating it in one central spot.
          var fullMask=document.createElement('canvas');fullMask.width=pw;fullMask.height=ph;
          var fm=fullMask.getContext('2d',{willReadFrequently:true}),fid=fm.createImageData(pw,ph),fd=fid.data;
          for(var fmi=0;fmi<pw*ph;fmi++){var fa55=pd[fmi*4+3];if(fa55<55)continue;fd[fmi*4+3]=Math.min(230,Math.round(fa55*.78));}
          fm.putImageData(fid,0,0);

          x.save();
          x.globalCompositeOperation='source-over';
          x.globalAlpha=finalMode?.24:.20;
          x.filter='blur('+Math.max(3.2,Math.min(10,w*.014))+'px)';
          x.drawImage(fullMask,-w/2,bottom-Math.max(1.0,h*.006),w,Math.max(4.5,Math.min(h*.075,w*.060)));
          x.restore();

          x.save();
          x.globalCompositeOperation='source-over';
          x.globalAlpha=finalMode?.36:.31;
          x.filter='blur('+Math.max(1.8,Math.min(6.5,w*.0105))+'px)';
          x.drawImage(sm,-w/2,shadowTop,w,shadowH);
          // Tiny dark contact layer immediately at the base; short and wide, not a central dot.
          x.globalAlpha=finalMode?.25:.22;
          x.filter='blur('+Math.max(.75,Math.min(2.4,w*.0045))+'px)';
          x.drawImage(sm,-w/2,bottom-Math.max(.25,shadowH*.05),w,Math.max(1.3,shadowH*.34));
          x.restore();
        }
      }
    }catch(e){console.warn('[BARIQ PREVIEW] contact shadow skipped',e);}

    x.imageSmoothingEnabled=true;
    x.imageSmoothingQuality='high';
    x.globalAlpha=1;
    if(finalMode){
      x.filter='brightness('+ambient.brightness.toFixed(3)+') saturate(.965) contrast(.985)';
    }else{
      x.filter='saturate(.98) contrast(.99)';
    }
    if(S.perspectiveCorners)drawPerspectiveImage(x,pc,w,h,finalMode);else x.drawImage(pc,-w/2,-h/2,w,h);
    x.filter='none';

    if(finalMode){
      // Very light local colour spill, clipped to the product alpha. This makes whites/greys sit in the room
      // instead of looking pasted on, without recolouring artwork or logos.
      try{
        var tint=document.createElement('canvas');tint.width=pc.width;tint.height=pc.height;
        var tx=tint.getContext('2d');tx.drawImage(pc,0,0);
        tx.globalCompositeOperation='source-atop';
        tx.fillStyle='rgb('+Math.round(ambient.r)+','+Math.round(ambient.g)+','+Math.round(ambient.b)+')';
        tx.globalAlpha=.055;tx.fillRect(0,0,tint.width,tint.height);
        tx.globalAlpha=1;tx.globalCompositeOperation='source-over';
        x.globalAlpha=.34;
        if(S.perspectiveCorners)drawPerspectiveImage(x,tint,w,h,true);else x.drawImage(tint,-w/2,-h/2,w,h);
      }catch(e){console.warn('[BARIQ PREVIEW] ambient tint skipped',e);}
    }
    x.globalAlpha=1;
    drawPerspectiveHandles(x,w,h);
  }

  x.restore();
}
function canvasPoint(e){
  var r=S.canvas.getBoundingClientRect();
  return {x:(e.clientX-r.left)*(S.canvas.width/r.width),y:(e.clientY-r.top)*(S.canvas.height/r.height)};
}
function hitProduct(p){
  var lp=canvasToLocalPoint(p),w=S.baseProductW*S.scale,h=S.baseProductH*S.scale,q=perspectiveLocalCorners(w,h);
  var minX=Math.min(q[0].x,q[1].x,q[2].x,q[3].x),maxX=Math.max(q[0].x,q[1].x,q[2].x,q[3].x);
  var minY=Math.min(q[0].y,q[1].y,q[2].y,q[3].y),maxY=Math.max(q[0].y,q[1].y,q[2].y,q[3].y);
  return lp.x>=minX&&lp.x<=maxX&&lp.y>=minY&&lp.y<=maxY;
}
function pointerDown(e){
  if(!S.productCanvas)return;
  S.canvas.setPointerCapture&&S.canvas.setPointerCapture(e.pointerId);
  var p=canvasPoint(e);S.pointers.set(e.pointerId,p);
  if(S.pointers.size===1&&S.perspectiveMode){var hi=perspectiveHandleAt(p);if(hi>=0){S.perspectiveDragging=hi;S.dragging=false;e.preventDefault();return;}}
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
  if(S.pointers.size===1&&S.perspectiveDragging>=0){setPerspectiveCornerFromCanvas(S.perspectiveDragging,p);e.preventDefault();return;}
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
  if(S.perspectiveDragging>=0)S.perspectiveDragging=-1;
  if(S.pointers.size===0)S.dragging=false;
  if(S.pointers.size===1){
    var a=Array.from(S.pointers.values());
    S.dragging=hitProduct(a[0]);
    S.dragDX=a[0].x-S.productX;S.dragDY=a[0].y-S.productY;
  }
  e.preventDefault();
}

function act(a){
  if(a==='cropUndoR40'){undoCropR40();return;}
  if(a==='perspectiveToggle'){var pe=S.modal.querySelector('.bp-perspective-editor');S.perspectiveMode=!S.perspectiveMode;pe.classList.toggle('active',S.perspectiveMode);revokeExport();draw();return;}
  if(a==='perspectiveAuto'){autoPerspective();var pe2=S.modal.querySelector('.bp-perspective-editor');pe2.classList.add('active');return;}
  if(a==='perspectiveReset'){resetPerspective();return;}
  if(a==='perspectiveDone'){S.perspectiveMode=false;S.perspectiveDragging=-1;var pe3=S.modal.querySelector('.bp-perspective-editor');pe3.classList.remove('active');revokeExport();draw();return;}
  if(a==='colorToggle'){
    var e=S.modal.querySelector('.bp-color-editor');
    e.classList.toggle('active');
    if(e.classList.contains('active')){
      ensureColorBase();
      refreshColorPresetThumbsR40();
      var originalBtn=S.modal.querySelector('.bp-color-presets button[data-filter="original"]');
      if(originalBtn&&!S.modal.querySelector('.bp-color-presets button.active'))originalBtn.classList.add('active');
    }
    return;
  }
  if(a==='colorDone'){S.modal.querySelector('.bp-color-editor').classList.remove('active');return}
  if(a==='colorReset'){resetProductColors();return}
  if(a==='cleanToggle'){var e=S.modal.querySelector('.bp-mask-editor');e.classList.toggle('active');if(e.classList.contains('active'))renderMaskEditor();return}
  if(a==='cleanDone'){S.modal.querySelector('.bp-mask-editor').classList.remove('active');return}
  if(a==='undoMask'){if(S.maskUndo.length){S.maskRedo.push(alphaSnapshot());applyAlpha(S.maskUndo.pop())}return}
  if(a==='redoMask'){if(S.maskRedo.length){S.maskUndo.push(alphaSnapshot());applyAlpha(S.maskRedo.pop())}return}
  if(a==='resetMask'){resetMask('original');return}
  if(a==='autoCut'){rerunAiCut();return}
  if(a==='soften'){softenEdges();return}
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
    draw(true);revokeExport();
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
function textOf(selectors){
  for(var i=0;i<selectors.length;i++){
    var el=document.querySelector(selectors[i]);
    var v=String(el&&el.textContent||'').replace(/\s+/g,' ').trim();
    if(v)return v;
  }
  return '';
}
function inputValue(selectors){
  for(var i=0;i<selectors.length;i++){
    var el=document.querySelector(selectors[i]);
    if(el&&String(el.value||'').trim())return String(el.value).trim();
  }
  return '';
}
function productShareDetails(){
  var price=textOf(['#price','.product-price','.price-current','.current-price','[data-product-price]','.price']);
  var oldPrice=textOf(['#oldPrice','.old-price','.price-old','.compare-price','del']);
  var qty=inputValue(['#qty','#quantity','input[name="quantity"]','.quantity input','.qty input']);
  var sku=textOf(['#sku','[data-sku]','.product-sku','.sku']);
  var canonical=document.querySelector('link[rel="canonical"]');
  var productUrl=(canonical&&canonical.href)||location.href;
  try{
    var u=new URL(productUrl,location.href);
    u.hash='';
    productUrl=u.href;
  }catch(_){}
  return {name:productName(),id:productId(),price:price,oldPrice:oldPrice,qty:qty,sku:sku,url:productUrl};
}
function salesShareText(){
  var d=productShareDetails(),lines=[];
  lines.push(tr('مرحبًا فريق بريق 👋','Hello Bariq Team 👋'));
  lines.push(tr('أرغب في طلب هذا المنتج، وهذه معاينته في المكان الذي اخترته:','I would like to order this product. Here is the preview in my selected space:'));
  lines.push('');
  lines.push('✨ '+d.name);
  if(d.id)lines.push(tr('رقم المنتج: ','Product ID: ')+d.id);
  if(d.sku)lines.push('SKU: '+d.sku);
  if(d.price)lines.push(tr('السعر: ','Price: ')+d.price);
  if(d.oldPrice&&d.oldPrice!==d.price)lines.push(tr('السعر قبل الخصم: ','Original price: ')+d.oldPrice);
  if(d.qty)lines.push(tr('الكمية: ','Quantity: ')+d.qty);
  lines.push('');
  lines.push(tr('رابط المنتج: ','Product link: ')+d.url);
  lines.push('');
  lines.push(tr('📷 صورة المعاينة مرفقة مع الرسالة.','📷 The preview image is attached to this message.'));
  return lines.join('\n');
}
async function sharePreview(toSales){
  var b=await ensureExport();if(!b)return;
  var file=new File([b],'bariq-preview-'+(productId()||'product')+'.jpg',{type:'image/jpeg'});
  var text=toSales?salesShareText():(tr('شاهد معاينة المنتج من بريق ✨','See my Bariq product preview ✨')+'\n'+productName()+'\n'+productShareDetails().url);

  // On phones, Web Share is the only browser-standard way to send the actual
  // generated image file together with its message to WhatsApp. wa.me links
  // can prefill text, but browsers do not allow them to attach a local image.
  try{
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      setStatus(toSales?tr('اختر واتساب ثم محادثة فريق بريق لإرسال الصورة والتفاصيل.','Choose WhatsApp, then the Bariq Team chat to send the image and details.'):'','info');
      await navigator.share({title:productName(),text:text,files:[file]});
      if(toSales)setStatus(tr('تم تجهيز صورة المعاينة وتفاصيل المنتج للمشاركة.','The preview image and product details were prepared for sharing.'),'info');
      return;
    }
  }catch(e){
    if(e&&e.name==='AbortError')return;
    console.warn('[BARIQ_PREVIEW] native share failed',e);
  }

  if(toSales){
    var wa=getWhatsappNumber();
    var note=text+'\n\n'+tr('ملاحظة: المتصفح لا يدعم إرفاق الصورة تلقائيًا، لذلك تم حفظها على الجهاز لإرفاقها في المحادثة.','Note: this browser cannot attach the image automatically, so it was saved to your device to attach in the chat.');
    var url='https://wa.me/'+wa+'?text='+encodeURIComponent(note);
    savePreview();
    var w=window.open(url,'_blank','noopener');
    if(!w)location.href=url;
    setStatus(tr('تم فتح واتساب بتفاصيل المنتج وحفظ صورة المعاينة لإرفاقها.','WhatsApp opened with the product details and the preview image was saved for attachment.'),'info');
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

function preloadRmbgToDevice(){
  // Download/cache model quietly as soon as the product page loads.
  // Does not initialize inference until the customer actually uses preview.
  try{
    var run=function(){
      fetchRmbgBytes().then(function(bytes){
        console.info('[BARIQ_PREVIEW] RMBG-1.4 cached on device:',Math.round(bytes.byteLength/1048576)+' MB');
      }).catch(function(e){
        console.warn('[BARIQ_PREVIEW] background RMBG preload skipped',e);
      });
    };
    if('requestIdleCallback' in window){
      requestIdleCallback(run,{timeout:3500});
    }else{
      setTimeout(run,1800);
    }
  }catch(_){}
}

// Start downloading the ~44MB model to IndexedDB in the background immediately.
// First customer use can therefore be much faster.
preloadRmbgToDevice();

window.BariqProductPreview={open:open,close:close};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();