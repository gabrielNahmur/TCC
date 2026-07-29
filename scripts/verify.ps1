$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location (Join-Path $projectRoot "prototype/backend")
try {
    .\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing
} finally {
    Pop-Location
}

Push-Location (Join-Path $projectRoot "prototype/frontend")
try {
    npm test
    npm run build
    npm audit --audit-level=high
} finally {
    Pop-Location
}

$firmwareRoot = Join-Path $projectRoot "prototype/firmware"
$hostBinary = Join-Path $env:TEMP "tcc-interlock-logic-test.exe"
& g++ -std=c++17 -Wall -Wextra -Werror `
    "-I$(Join-Path $firmwareRoot 'include')" `
    (Join-Path $firmwareRoot "test_host/interlock_logic_test.cpp") `
    -o $hostBinary
& $hostBinary

Write-Host "Verificacoes locais concluidas." -ForegroundColor Green
