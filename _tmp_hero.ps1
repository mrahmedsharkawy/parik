$path = 'c:\Users\User\OneDrive\Desktop\New folder\parik.html\bariq_app\preview.html'
$content = Get-Content -Raw -LiteralPath $path
$patterns = @(
  '\.app-hero-shell[^{]*\{[^}]*\}',
  '\.immersive-topbar[^{]*\{[^}]*\}',
  '\.immersive-tabs[^{]*\{[^}]*\}',
  '\.immersive-tab[^{]*\{[^}]*\}',
  '\.hero-swiper[^{]*\{[^}]*\}',
  '\.hero-slide[^{]*\{[^}]*\}',
  '\.hero-slide img[^{]*\{[^}]*\}',
  '\.hero-slide-caption[^{]*\{[^}]*\}',
  '\.hero-chip[^{]*\{[^}]*\}',
  '\.hero-dot[^{]*\{[^}]*\}',
  '\.hero-dots[^{]*\{[^}]*\}'
)
foreach ($p in $patterns) {
  Write-Output "=== $p ==="
  $matches = [regex]::Matches($content, $p)
  foreach ($m in $matches) { Write-Output $m.Value }
  Write-Output ""
}
