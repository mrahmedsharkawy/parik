document.addEventListener('DOMContentLoaded', function() {
  function buildSocialBar(s) {
    var container = document.getElementById('acc-social-links');
    if (!container) return;
    container.innerHTML = '';
    var map = [
      { name: 'Instagram', img: 'assets/social/instagram.png',  url: s.instagram },
      { name: 'Facebook',  img: 'assets/social/facebook.png',   url: s.facebook },
      { name: 'TikTok',    img: 'assets/social/tiktok.png',     url: s.tiktok },
      { name: 'Snapchat',  img: 'assets/social/snapchat.png',   url: s.snapchat },
      { name: 'YouTube',   img: 'assets/social/youtube.png',    url: s.youtube },
      { name: 'Twitter',   img: 'assets/social/twitter.png',    url: s.twitter },
      { name: 'Pinterest', img: 'assets/social/pinterest.png',  url: s.pinterest },
      { name: 'WhatsApp',  img: 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/whatsapp.svg', url: s.wa ? 'https://wa.me/' + String(s.wa).replace(/\D/g,'') : null }
    ];
    map.forEach(function(item) {
      if (!item.url) return;
      var a = document.createElement('a');
      a.href = item.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = item.name;
      var isMobile = window.innerWidth < 768;
      a.style.cssText = isMobile
        ? 'display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex-shrink:0'
        : 'display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;flex-shrink:0';
      var img = document.createElement('img');
      var sz = isMobile ? 28 : 36;
      img.src = item.img; img.alt = item.name; img.width = sz; img.height = sz;
      if (item.name === 'WhatsApp') img.style.filter = 'invert(33%) sepia(99%) saturate(400%) hue-rotate(90deg)';
      a.appendChild(img);
      container.appendChild(a);
    });
  }
  try {
    var cached = JSON.parse(localStorage.getItem('x2_settings') || '{}');
    if (cached.instagram || cached.facebook || cached.tiktok || cached.wa) buildSocialBar(cached);
  } catch(e) {}
  // دايماً اجلب من Supabase عشان تاخد أحدث إعدادات
  var sbAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E';
  fetch('https://knleehjjejfeobcmpwnw.supabase.co/rest/v1/settings?limit=1', {
    headers: { apikey: sbAnon, Authorization: 'Bearer ' + sbAnon }
  }).then(function(r){return r.json()}).then(function(rows){
    if (rows && rows[0]) {
      var s = rows[0];
      var settings = { instagram:s.instagram, facebook:s.facebook, tiktok:s.tiktok, snapchat:s.snapchat, youtube:s.youtube, twitter:s.twitter, pinterest:s.pinterest, wa:s.whatsapp||s.wa };
      localStorage.setItem('x2_settings', JSON.stringify(settings));
      buildSocialBar(settings);
    }
  }).catch(function(){});
});
