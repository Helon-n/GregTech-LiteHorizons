$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$resourceRoot=Join-Path (Get-Location) '.local\nsis-resources'
if(Test-Path -LiteralPath $resourceRoot){$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR=$resourceRoot}
& npm run dist
if($LASTEXITCODE -ne 0){throw 'Windows build failed'}
& (Join-Path $PSScriptRoot 'finalize-release.ps1')
