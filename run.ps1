Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Project Management Intelligence - Application Server   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Set location to the script directory
Set-Location -Path $PSScriptRoot

# 1. Check if setup has been performed
if (-not (Test-Path -Path "node_modules")) {
    Write-Host "[NOTICE] Project setup has not been run yet. Launching setup.bat..." -ForegroundColor Yellow
    cmd.exe /c "$PSScriptRoot\setup.bat"
    exit 0
}

# 2. Check for Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found on your system! Please run setup.bat." -ForegroundColor Red
    pause
    exit 1
}

# 3. Check and free port 3000 if occupied
Write-Host "[1/3] Checking port 3000 status..." -ForegroundColor Yellow
$pids = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($pids) {
    foreach ($procId in $pids) {
        Write-Host "Clearing process on port 3000 (PID: $procId)..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "Port 3000 is available." -ForegroundColor Green
}

# 4. Open browser
Write-Host "[2/3] Launching browser at http://localhost:3000..." -ForegroundColor Green
Start-Process "http://localhost:3000"

# 5. Run server
Write-Host "[3/3] Starting Next.js development server..." -ForegroundColor Green
npm run dev
