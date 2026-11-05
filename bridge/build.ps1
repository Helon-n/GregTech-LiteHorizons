param([string]$ForgeJar='D:\GTNH_mod\forge-1.7.10-universal.jar')
$ErrorActionPreference='Stop'
$bridgeRoot=$PSScriptRoot
$output=Join-Path $bridgeRoot 'build'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$source=Join-Path $bridgeRoot 'src\main\java\dev\gtnhidle\RecipeExportMod.java'
& javac --release 8 -encoding UTF-8 -cp $ForgeJar -d $output $source
if($LASTEXITCODE -ne 0){throw 'Compilation failed'}
& jar cf (Join-Path $bridgeRoot 'gtnh-idle-export-0.1.0.jar') -C $output dev
if($LASTEXITCODE -ne 0){throw 'Packaging failed'}
Write-Output (Join-Path $bridgeRoot 'gtnh-idle-export-0.1.0.jar')
