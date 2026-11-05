param([string]$Mirror='https://cdn.npmmirror.com/binaries/electron')
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
& npm ci --ignore-scripts --no-audit --no-fund
if($LASTEXITCODE -ne 0){throw 'npm dependency installation failed'}
$electronVersion=(Get-Content -Raw node_modules/electron/package.json | ConvertFrom-Json).version
$archiveName="electron-v$electronVersion-win32-x64.zip"
$cacheRoot=Join-Path (Get-Location) '.local'
New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
$archivePath=Join-Path $cacheRoot $archiveName
Invoke-WebRequest -Uri "$Mirror/$electronVersion/$archiveName" -OutFile $archivePath
$expected=(Get-Content -Raw node_modules/electron/checksums.json | ConvertFrom-Json).$archiveName
$actual=(Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLower()
if($actual -ne $expected){throw 'Electron SHA-256 checksum mismatch'}
Expand-Archive -LiteralPath $archivePath -DestinationPath node_modules/electron/dist -Force
[IO.File]::WriteAllText((Join-Path (Get-Location) 'node_modules/electron/path.txt'),'electron.exe')
Write-Output 'Electron is ready. Run npm start.'
