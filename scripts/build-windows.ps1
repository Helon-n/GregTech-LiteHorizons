$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$resourceRoot=Join-Path (Get-Location) '.local\nsis-resources'
if(Test-Path -LiteralPath $resourceRoot){$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR=$resourceRoot}
& npm test
if($LASTEXITCODE -ne 0){throw 'Tests failed; no build produced'}
& npm run dist
if($LASTEXITCODE -ne 0){throw 'Windows build failed'}
& node scripts/electron-smoke.mjs --packaged
if($LASTEXITCODE -ne 0){throw 'Packaged application checks failed; old releases retained'}
& (Join-Path $PSScriptRoot 'finalize-release.ps1')
