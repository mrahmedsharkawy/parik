param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Destination,
  [string]$ProjectRef = 'knleehjjejfeobcmpwnw'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedDestination = [System.IO.Path]::GetFullPath($Destination)
$resolvedProject = [System.IO.Path]::GetFullPath($projectRoot)
if ($resolvedDestination.StartsWith($resolvedProject, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Destination must be outside the Bariq project. Use an encrypted company drive, NAS, or independent cloud-mounted drive.'
}

$supabaseCli = Get-Command supabase.exe -ErrorAction SilentlyContinue
if (-not $supabaseCli) {
  $knownCli = 'C:\Users\User\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\@supabase\cli-windows-x64\bin\supabase.exe'
  if (Test-Path -LiteralPath $knownCli) { $supabaseCli = Get-Item -LiteralPath $knownCli }
}
if (-not $supabaseCli) { throw 'Supabase CLI was not found. Run: npx.cmd supabase --version' }

$stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd-HH-mm-ssZ')
$backupRoot = Join-Path $resolvedDestination "Bariq-DR-$stamp"
$dbRoot = Join-Path $backupRoot 'database'
$storageRoot = Join-Path $backupRoot 'storage'
$sourceRoot = Join-Path $backupRoot 'rebuild-source'
New-Item -ItemType Directory -Path $dbRoot, $storageRoot, $sourceRoot -Force | Out-Null

Write-Host 'Creating PostgreSQL schema dump...'
& $supabaseCli.FullName db dump --linked --project-ref $ProjectRef --schema public,auth,storage --file (Join-Path $dbRoot 'schema.sql')
if ($LASTEXITCODE -ne 0) { throw 'Schema dump failed. The backup is incomplete.' }

Write-Host 'Creating PostgreSQL data dump...'
& $supabaseCli.FullName db dump --linked --project-ref $ProjectRef --data-only --use-copy --schema public,auth,storage --file (Join-Path $dbRoot 'data.sql')
if ($LASTEXITCODE -ne 0) { throw 'Data dump failed. The backup is incomplete.' }

Write-Host 'Copying all Storage buckets...'
foreach ($bucket in @('products', 'ai-models', 'app-assets')) {
  $bucketTarget = Join-Path $storageRoot $bucket
  New-Item -ItemType Directory -Path $bucketTarget -Force | Out-Null
  & $supabaseCli.FullName storage cp --recursive --linked --project-ref $ProjectRef "ss:///$bucket" $bucketTarget
  if ($LASTEXITCODE -ne 0) { throw "Storage copy failed for bucket: $bucket" }
}

Copy-Item -LiteralPath (Join-Path $projectRoot 'supabase') -Destination $sourceRoot -Recurse -Force
$importantFiles = @('package.json','vercel.json','firebase.json','sw.js')
foreach ($name in $importantFiles) {
  $path = Join-Path $projectRoot $name
  if (Test-Path -LiteralPath $path) { Copy-Item -LiteralPath $path -Destination $sourceRoot -Force }
}

$manifest = [ordered]@{
  format = 'bariq-dr-v1'
  project = 'Bariq Gifts'
  project_ref = $ProjectRef
  created_at_utc = (Get-Date).ToUniversalTime().ToString('o')
  warning = 'Contains sensitive production data. Store only on an encrypted independent destination.'
  files = @()
}
$manifest.files = @(Get-ChildItem -LiteralPath $backupRoot -File -Recurse | ForEach-Object {
  [ordered]@{
    path = $_.FullName.Substring($backupRoot.Length + 1).Replace('\','/')
    size_bytes = $_.Length
    sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  }
})
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $backupRoot 'manifest.json') -Encoding UTF8
$manifestHash = (Get-FileHash -LiteralPath (Join-Path $backupRoot 'manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $backupRoot 'manifest.sha256') -Value "$manifestHash  manifest.json" -Encoding ASCII

Write-Host "Verified DR backup created at: $backupRoot"
Write-Host 'Keep this folder only on an encrypted destination and copy it to a second independent location.'

