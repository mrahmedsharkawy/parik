(function(){
  var slider=document.getElementById('mobBannerSlider');
  if(!slider||window.innerWidth>899)return;
  var track=document.getElementById('mobSliderTrack');
  var dots=document.querySelectorAll('.mob-slider-dot');
  var slides=track?track.querySelectorAll('.mob-slider-slide'):[];
  var total=slides.length;
  if(total<2)return;
  var cur=0,startX=0,isDragging=false;
  function goTo(n){
    cur=(n+total)%total;
    track.style.transform='translateX('+(-cur*33.333333)+'%)';
    dots.forEach(function(d,i){d.classList.toggle('active',i===cur)});
  }
  dots.forEach(function(d){d.addEventListener('click',function(){goTo(+d.dataset.idx)})});
  track.addEventListener('touchstart',function(e){startX=e.touches[0].clientX;isDragging=true},{passive:true});
  track.addEventListener('touchmove',function(e){
    if(!isDragging)return;
    var dx=e.touches[0].clientX-startX;
    if(Math.abs(dx)>8)e.preventDefault();
  },{passive:false});
  track.addEventListener('touchend',function(e){
    if(!isDragging)return;isDragging=false;
    var dx=e.changedTouches[0].clientX-startX;
    if(Math.abs(dx)>40)goTo(cur+(dx<0?1:-1));
  },{passive:true});
})();
