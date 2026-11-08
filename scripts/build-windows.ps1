$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$resourceRoot=Join-Path (Get-Location) '.local\nsis-resources'
if(Test-Path -LiteralPath $resourceRoot){$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR=$resourceRoot}
$bundledElectron=Join-Path (Get-Location) 'node_modules/electron/dist'
if(Test-Path -LiteralPath (Join-Path $bundledElectron 'electron.exe')){
    # Reuse the installed, version-matched runtime instead of fetching it again.
    $expected=(Get-Content -LiteralPath 'node_modules/electron/package.json' -Raw -Encoding UTF8 | ConvertFrom-Json).version
    $actual=(Get-Content -LiteralPath (Join-Path $bundledElectron 'version') -Raw).Trim().TrimStart('v')
    if($expected -ne $actual){throw "Local Electron version mismatch: $actual / $expected"}
    & npm run dist -- "--config.electronDist=$bundledElectron"
}else{
    & npm run dist
}
if($LASTEXITCODE -ne 0){throw 'Windows build failed'}
& (Join-Path $PSScriptRoot 'finalize-release.ps1')
