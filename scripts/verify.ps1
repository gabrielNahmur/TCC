$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location (Join-Path $projectRoot "prototype/backend")
try {
    .\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing
    if ($LASTEXITCODE -ne 0) { throw "Os testes do backend falharam." }
} finally {
    Pop-Location
}

Push-Location (Join-Path $projectRoot "prototype/frontend")
try {
    npm test
    if ($LASTEXITCODE -ne 0) { throw "Os testes do frontend falharam." }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "O build do frontend falhou." }
    npm audit --audit-level=high
    if ($LASTEXITCODE -ne 0) { throw "A auditoria de dependencias do frontend falhou." }
} finally {
    Pop-Location
}

$firmwareRoot = Join-Path $projectRoot "prototype/firmware"
$hostBinary = Join-Path $env:TEMP "tcc-interlock-logic-test.exe"
& g++ -std=c++17 -Wall -Wextra -Werror `
    "-I$(Join-Path $firmwareRoot 'include')" `
    (Join-Path $firmwareRoot "test_host/interlock_logic_test.cpp") `
    -o $hostBinary
if ($LASTEXITCODE -ne 0) { throw "A compilacao do teste C++ host falhou." }
& $hostBinary
if ($LASTEXITCODE -ne 0) { throw "Os testes C++ host falharam." }

$localPio = Join-Path $firmwareRoot ".pio-venv\Scripts\pio.exe"
$pioCommand = if (Test-Path -LiteralPath $localPio) { $localPio } else { "pio" }
& $pioCommand run --project-dir $firmwareRoot --environment picsimlab
if ($LASTEXITCODE -ne 0) { throw "A compilacao do firmware PICSimLab falhou." }

Write-Host "Verificacoes locais concluidas." -ForegroundColor Green
