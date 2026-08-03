(function(){
  function productIdFromUrl(){
    var q = new URLSearchParams(location.search).get('id');
    if(q) return q;
    var parts = location.pathname.split('/').filter(Boolean);
    var idx = parts.findIndex(function(p){ return p.toLowerCase() === 'product' || p.toLowerCase() === 'product.html'; });
    return idx >= 0 && parts[idx + 1] ? decodeURIComponent(parts[idx + 1]) : '';
  }
  function textOf(value){
    var lang = localStorage.getItem('lang') || document.documentElement.lang || 'ar';
    return value && typeof value === 'object' ? (value[lang] || value.ar || value.en || '') : (value || '');
  }
  function setText(id, value){
    var el = document.getElementById(id);
    if(el && value !== undefined && value !== null) el.textContent = value;
  }
  try {
    var cached = JSON.parse(sessionStorage.getItem('x2_quick_product') || 'null');
    if(!cached || String(cached.id) !== String(productIdFromUrl())) return;
    var img = document.getElementById('mainImage');
    var name = textOf(cached.name);
    if(img && cached.img){
      img.src = cached.img;
      img.alt = name;
      img.loading = 'eager';
      img.decoding = 'async';
      img.setAttribute('fetchpriority', 'high');
    }
    setText('category', textOf(cached.category));
    setText('name', name);
    if(name) document.title = name + ' - Bariq';
    var sym = localStorage.getItem('currency') === 'USD' ? '$' : 'د.إ';
    setText('price', cached.price !== undefined && cached.price !== null ? cached.price + ' ' + sym : '');
    var hasCachedDiscount = cached.oldPrice && Number(cached.oldPrice) > Number(cached.price);
    var oldEl = document.getElementById('oldPrice');
    if(oldEl){
      oldEl.textContent = hasCachedDiscount ? cached.oldPrice + ' ' + sym : '';
      oldEl.style.display = oldEl.textContent ? '' : 'none';
    }
    var discountEl = document.getElementById('discount');
    if(discountEl){
      discountEl.textContent = hasCachedDiscount ? Math.round(100 * (1 - Number(cached.price) / Number(cached.oldPrice))) + '% خصم' : '';
      discountEl.style.display = hasCachedDiscount ? '' : 'none';
    }
    var timerBox = document.getElementById('timer-box');
    if(timerBox) timerBox.style.display = 'none';
    var stockLine = document.getElementById('stock-line');
    if(stockLine) stockLine.style.display = hasCachedDiscount ? '' : 'none';
    setText('stock', hasCachedDiscount ? '🔥 عرض لفترة محدودة' : '');
    setText('ratingCount', cached.ratingCount ? '(' + cached.ratingCount + ' تقييم)' : '');
    var stars = document.getElementById('stars');
    if(stars && cached.rating){
      var r = parseFloat(cached.rating) || 0;
      stars.innerHTML = '<span style="color:#f59e0b;letter-spacing:1px">' + '★'.repeat(Math.floor(r)) + (r % 1 >= .5 ? '½' : '') + '☆'.repeat(5 - Math.ceil(r)) + '</span> <b>' + cached.rating + '</b>';
    }
  } catch(e) {}
})();
