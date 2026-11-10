$ErrorActionPreference = "Stop"

$picsimlabRoot = $PSScriptRoot
$prototypeRoot = Split-Path -Parent $picsimlabRoot
$firmwareRoot = Join-Path $prototypeRoot "firmware"
$projectRoot = Split-Path -Parent $prototypeRoot
$localPio = Join-Path $firmwareRoot ".pio-venv\Scripts\pio.exe"
$localPython = Join-Path $firmwareRoot ".pio-venv\Scripts\python.exe"
$platformioRoot = Join-Path $env:USERPROFILE ".platformio"
$esptool = Join-Path $platformioRoot "packages\tool-esptoolpy\esptool.py"
$bootApp = Join-Path $platformioRoot "packages\framework-arduinoespressif32\tools\partitions\boot_app0.bin"
$buildRoot = Join-Path $firmwareRoot ".pio\build\picsimlab"
$outputPath = Join-Path $picsimlabRoot "bancada-intertravamento.pzw"

if (-not (Test-Path -LiteralPath (Join-Path $firmwareRoot "include\tcc_config.h"))) {
    throw "Copie include/tcc_config.picsimlab.example.h para include/tcc_config.h antes de gerar o workspace."
}

$pioCommand = if (Test-Path -LiteralPath $localPio) { $localPio } else { "pio" }
& $pioCommand run --project-dir $firmwareRoot --environment picsimlab
if ($LASTEXITCODE -ne 0) { throw "A compilacao PlatformIO falhou." }

if (-not (Test-Path -LiteralPath $localPython)) { $localPython = "python" }
if (-not (Test-Path -LiteralPath $esptool)) { throw "esptool.py nao localizado em $esptool" }

$workspaceParent = Join-Path ([System.IO.Path]::GetTempPath()) ("tcc-picsimlab-" + [guid]::NewGuid().ToString("N"))
$workspaceDir = Join-Path $workspaceParent "picsimlab_workspace"
New-Item -ItemType Directory -Path $workspaceDir | Out-Null

$flashImage = Join-Path $workspaceDir "mdump_ESP32_DevKitC_ESP32.bin"
& $localPython $esptool --chip esp32 merge_bin `
    --output $flashImage `
    --flash_mode dio `
    --flash_size 4MB `
    --fill-flash-size 4MB `
    0x1000 (Join-Path $buildRoot "bootloader.bin") `
    0x8000 (Join-Path $buildRoot "partitions.bin") `
    0xE000 $bootApp `
    0x10000 (Join-Path $buildRoot "firmware.bin")
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel montar a imagem flash." }

Copy-Item -LiteralPath (Join-Path $picsimlabRoot "picsimlab.ini") -Destination $workspaceDir
Copy-Item -LiteralPath (Join-Path $picsimlabRoot "parts_ESP32_DevKitC.pcf") -Destination $workspaceDir

$aliases = [System.Collections.Generic.List[string]]::new()
$aliases.Add("//N-PinName -ALias   --Aliases da bancada de intertravamento")
$aliasByPin = @{
    8 = "ESTOP"; 9 = "GAS"; 10 = "ETANOL"; 11 = "DS10"; 12 = "GNV"; 15 = "DS500"
}
$pinNames = @{
    1="VDD"; 2="EN"; 3="IO36"; 4="IO39"; 5="IO34"; 6="IO35"; 7="IO32"; 8="IO33";
    9="IO25"; 10="IO26"; 11="IO27"; 12="IO14"; 13="IO12"; 14="GND"; 15="IO13"; 16="IO9";
    17="IO10"; 18="IO11"; 19="VIN"; 20="IO6"; 21="IO7"; 22="IO8"; 23="IO15"; 24="IO2";
    25="IO0"; 26="IO4"; 27="IO16"; 28="IO17"; 29="IO5"; 30="IO18"; 31="IO19"; 32="GND";
    33="IO21"; 34="IO3"; 35="IO1"; 36="IO22"; 37="IO23"; 38="GND"
}
for ($pin = 1; $pin -le 255; $pin++) {
    $pinName = if ($pinNames.ContainsKey($pin)) { $pinNames[$pin] } else { "" }
    $alias = if ($aliasByPin.ContainsKey($pin)) { $aliasByPin[$pin] } else { $pinName }
    $aliases.Add(("{0:D3}-{1,-8}-{2,-7}" -f $pin, $pinName, $alias))
}
$aliases | Set-Content -Encoding utf8 (Join-Path $workspaceDir "palias_ESP32_DevKitC.ppa")

$zipPath = Join-Path $workspaceParent "bancada-intertravamento.zip"
Compress-Archive -LiteralPath $workspaceDir -DestinationPath $zipPath -CompressionLevel Optimal
if (Test-Path -LiteralPath $outputPath) { Remove-Item -LiteralPath $outputPath -Force }
Move-Item -LiteralPath $zipPath -Destination $outputPath

$workspace = Get-Item -LiteralPath $outputPath
Write-Host "Workspace PICSimLab gerado: $($workspace.FullName) ($($workspace.Length) bytes)" -ForegroundColor Green
