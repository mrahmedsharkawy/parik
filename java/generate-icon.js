(function (w, d, s, l, i) {
  w[l] = w[l] || [];
  w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var firstScript = d.getElementsByTagName(s)[0];
  var tag = d.createElement(s);
  var dataLayer = l !== 'dataLayer' ? '&l=' + l : '';
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dataLayer;
  firstScript.parentNode.insertBefore(tag, firstScript);
})(window, document, 'script', 'dataLayer', 'GTM-PR8J7RM7');

(function () {
  const canvas = document.getElementById('c');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 512, 80);
  ctx.fillStyle = '#152546';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(256, 220, 150, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(212, 175, 55, 0.12)';
  ctx.fill();

  ctx.fillStyle = '#D4AF37';
  ctx.beginPath();
  const cx = 256, cy = 210, r1 = 110, r2 = 48, pts = 8;
  for (let i = 0; i < pts * 2; i++) {
    const angle = (i * Math.PI) / pts - Math.PI / 2;
    const radius = i % 2 === 0 ? r1 : r2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(256, 210, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#152546';
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 88px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('بريق', 256, 380);

  ctx.fillStyle = '#D4AF37';
  ctx.beginPath();
  ctx.roundRect(156, 418, 200, 6, 3);
  ctx.fill();

  const downloadLink = document.getElementById('dl');
  if (downloadLink) downloadLink.href = canvas.toDataURL('image/png');
})();
