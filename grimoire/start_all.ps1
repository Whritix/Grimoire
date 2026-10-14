$ErrorActionPreference = "Stop"

Write-Host "Starting AI Agents System..." -ForegroundColor Green

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Define paths relative to script location
$BackendDir = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "frontend"
$VenvPython = Join-Path $BackendDir "venv\Scripts\python.exe"

# Check for Virtual Environment
if (-not (Test-Path $VenvPython)) {
    Write-Error "Virtual environment not found at $VenvPython. Please run '.\first_time_setup.ps1' first."
    exit 1
}

# synchronize .env files
Write-Host "Synchronizing .env configuration..." -ForegroundColor Cyan
if (Test-Path "$ScriptDir\.env") {
    Copy-Item "$ScriptDir\.env" "$BackendDir\.env" -Force
    Copy-Item "$ScriptDir\.env" "$FrontendDir\.env.local" -Force
    Write-Host "  Updated backend\.env and frontend\.env.local from root .env" -ForegroundColor Green
}
else {
    Write-Warning "Root .env file not found! Application may not work correctly."
}

# Start Backend
Write-Host "Starting Python Backend..." -ForegroundColor Cyan
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$Result = Start-Process -FilePath $VenvPython -ArgumentList "-m", "uvicorn", "services.gateway.main:app", "--reload", "--port", "8000" -WorkingDirectory $BackendDir -NoNewWindow -PassThru
$Result | Write-Output

Write-Host "Backend started in new window (or background)."

# Start Frontend
Write-Host "Starting Next.js Frontend..." -ForegroundColor Cyan
Set-Location $FrontendDir
pnpm run dev

