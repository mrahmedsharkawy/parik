$path = 'c:\Users\User\OneDrive\Desktop\New folder\parik.html\bariq_app\preview.html'
$content = Get-Content -Raw -LiteralPath $path
$start = $content.IndexOf('body.app-home-active .main-header')
if ($start -lt 0) { $start = $content.IndexOf('.app-hero-shell') }
$len = [Math]::Min(5000, $content.Length - $start)
Write-Output $content.Substring($start, $len)
