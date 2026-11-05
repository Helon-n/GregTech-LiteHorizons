$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Split-Path $PSScriptRoot -Parent)).Path
$releaseRoot=(Resolve-Path -LiteralPath (Join-Path $projectRoot 'release')).Path
if($releaseRoot -ne (Join-Path $projectRoot 'release')){throw 'Release directory must be inside this project'}
$metadata=Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$version=$metadata.version
$installerName="GTNH-Idle-$version-Setup.exe"
$installer=Join-Path $releaseRoot $installerName
$application=Join-Path (Join-Path $releaseRoot 'win-unpacked') ($metadata.build.productName+'.exe')
foreach($required in @($installer,"$installer.blockmap",$application,(Join-Path $releaseRoot 'win-unpacked\resources\app.asar'))){
    if(!(Test-Path -LiteralPath $required -PathType Leaf) -or (Get-Item -LiteralPath $required).Length -eq 0){throw "Missing build artifact: $required"}
}
# Only remove recognized application installers and their matching block maps.
# All targets are resolved and checked before any deletion; no recursive delete.
$oldFiles=@(Get-ChildItem -LiteralPath $releaseRoot -File | Where-Object {
    $_.Name -match '^GTNH-Idle-\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?-Setup\.exe(?:\.blockmap)?$' -and
    $_.Name -ne $installerName -and $_.Name -ne "$installerName.blockmap"
})
foreach($file in $oldFiles){
    $resolved=(Resolve-Path -LiteralPath $file.FullName).Path
    if((Split-Path $resolved -Parent) -ne $releaseRoot){throw "Cleanup target is outside release: $resolved"}
}
$hashTargets=@($installer,$application)
$bridge=Join-Path $projectRoot 'bridge\gtnh-idle-export-0.1.0.jar'
if(Test-Path -LiteralPath $bridge -PathType Leaf){$hashTargets+=$bridge}
$hashLines=foreach($target in $hashTargets){
    $stream=[IO.File]::OpenRead($target)
    $sha=[Security.Cryptography.SHA256]::Create()
    try{$digest=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLower()}
    finally{$sha.Dispose();$stream.Dispose()}
    $digest+'  '+$target.Substring($projectRoot.Length+1)
}
foreach($file in $oldFiles){Remove-Item -LiteralPath $file.FullName;Write-Output "Removed old release: $($file.Name)"}
$hashLines | Set-Content -LiteralPath (Join-Path $releaseRoot 'SHA256SUMS.txt') -Encoding UTF8
Write-Output "Latest release retained: v$version"
