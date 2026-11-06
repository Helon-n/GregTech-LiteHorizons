param([switch]$TestPackaged)
$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Split-Path $PSScriptRoot -Parent)).Path
Set-Location -LiteralPath $projectRoot
$gitRoot=& git rev-parse --show-toplevel
if($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($gitRoot) -ne $projectRoot){throw 'Run releases from the project Git repository'}
$version=(Get-Content -LiteralPath package.json -Raw -Encoding UTF8 | ConvertFrom-Json).version
$tag="v$version"
& git show-ref --verify --quiet "refs/tags/$tag"
if($LASTEXITCODE -eq 0){throw "$tag already exists. Increment the version before a new release; tags are never overwritten."}
if($LASTEXITCODE -ne 1){throw 'Could not check Git version tags'}
& (Join-Path $PSScriptRoot 'build-windows.ps1')
if($TestPackaged){
    & node scripts/electron-smoke.mjs --packaged
    if($LASTEXITCODE -ne 0){throw 'Packaged desktop smoke test failed'}
    & node scripts/electron-smoke.mjs --portable
    if($LASTEXITCODE -ne 0){throw 'Portable desktop smoke test failed'}
}
& git add --all
if($LASTEXITCODE -ne 0){throw 'Git staging failed'}
& git diff --cached --quiet
if($LASTEXITCODE -eq 1){
    & git commit -m "release: $tag"
    if($LASTEXITCODE -ne 0){throw 'Git commit failed'}
}elseif($LASTEXITCODE -ne 0){throw 'Git diff failed'}
& git tag -a $tag -m "GregTech-LiteHorizons $tag"
if($LASTEXITCODE -ne 0){throw 'Git tag failed'}
Write-Output "Released $tag locally. Only the latest Portable and Setup executables are retained."
