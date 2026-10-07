$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "    AI Assemble - First Time Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Prerequisites
Write-Host "`n[1/3] Checking Prerequisites..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  Found Python: $pythonVersion" -ForegroundColor Green
}
catch {
    Write-Error "Python is not installed or not in PATH. Please install Python 3.10+."
    exit 1
}

try {
    $nodeVersion = node --version 2>&1
    Write-Host "  Found Node.js: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Error "Node.js is not installed or not in PATH. Please install Node.js (LTS)."
    exit 1
}

# 2. Setup Backend
$BackendDir = Join-Path $PSScriptRoot "backend"
Write-Host "`n[2/3] Setting up Backend ($BackendDir)..." -ForegroundColor Yellow

if (Test-Path $BackendDir) {
    Push-Location $BackendDir

    # Environment Variables handled by start_all.ps1 from root .env
    # We just ensure the root .env exists or warn the user
    if (-not (Test-Path "$PSScriptRoot\.env")) {
        if (Test-Path "$PSScriptRoot\.env.example") {
            Copy-Item "$PSScriptRoot\.env.example" "$PSScriptRoot\.env"
            Write-Host "  Created root .env from .env.example" -ForegroundColor Green
        }
    }

    # Virtual Environment
    if (-not (Test-Path "venv")) {
        Write-Host "  Creating Python virtual environment..." -ForegroundColor White
        python -m venv venv
        Write-Host "  Virtual environment created." -ForegroundColor Green
    }
    else {
        Write-Host "  Virtual environment already exists." -ForegroundColor Gray
    }

    # Install Dependencies
    Write-Host "  Installing Python dependencies..." -ForegroundColor White
    $PipPath = ".\venv\Scripts\pip.exe"
    if (-not (Test-Path $PipPath)) {
        # Fallback for non-standard install
        $PipPath = ".\venv\bin\pip" 
    }
    
    & $PipPath install --upgrade pip | Out-Null
    & $PipPath install -r requirements.txt | Out-Null
    Write-Host "  Dependencies installed." -ForegroundColor Green

    Pop-Location
}
else {
    Write-Error "Backend directory 'backend' not found!"
    exit 1
}

# 3. Setup Frontend
$FrontendDir = Join-Path $PSScriptRoot "frontend"
Write-Host "`n[3/3] Setting up Frontend ($FrontendDir)..." -ForegroundColor Yellow

if (Test-Path $FrontendDir) {
    Push-Location $FrontendDir

    # Environment Variables will be synced from root .env by start_all.ps1

    # Install Dependencies
    Write-Host "  Installing Node dependencies (this may take a moment)..." -ForegroundColor White
    # Check for pnpm
    if (Get-Command "pnpm" -ErrorAction SilentlyContinue) {
        Write-Host "  Installing Node dependencies with pnpm..." -ForegroundColor White
        pnpm install | Out-Null
    }
    else {
        Write-Warning "  pnpm not found. Installing pnpm..."
        npm install -g pnpm
        Write-Host "  Installing Node dependencies with pnpm..." -ForegroundColor White
        pnpm install | Out-Null
    }
    Write-Host "  Node dependencies installed." -ForegroundColor Green

    Pop-Location
}
else {
    Write-Error "Frontend directory 'frontend' not found!"
    exit 1
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "       SETUP COMPLETE!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "1. Update .env files with your API keys if you haven't already."
Write-Host "2. Run '.\start_all.ps1' to start the application."
Write-Host "==========================================" -ForegroundColor Cyan
