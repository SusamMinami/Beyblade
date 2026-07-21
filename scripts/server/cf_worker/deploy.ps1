param(
    [switch]$Dev,
    [switch]$Setup,
    [switch]$Tail
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Test-Command($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

if ($Setup) {
    Write-Host "=== Checking prerequisites ===" -ForegroundColor Cyan

    if (-not (Test-Command "node")) {
        Write-Host "[ERROR] Node.js is not installed. Please install Node.js 20.x from https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
    $nodeVersion = (node --version)
    Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green

    if (-not (Test-Command "npm")) {
        Write-Host "[ERROR] npm is not available." -ForegroundColor Red
        exit 1
    }
    $npmVersion = (npm --version)
    Write-Host "[OK] npm: $npmVersion" -ForegroundColor Green

    Write-Host ""
    Write-Host "=== Installing dependencies ===" -ForegroundColor Cyan
    npm install

    Write-Host ""
    Write-Host "=== Checking wrangler login ===" -ForegroundColor Cyan
    npx wrangler whoami
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Not logged in. Starting browser login..." -ForegroundColor Yellow
        npx wrangler login
    }

    Write-Host ""
    Write-Host "=== Creating R2 bucket (if not exists) ===" -ForegroundColor Cyan
    npx wrangler r2 bucket create beyblade-replays 2>$null
    Write-Host "[OK] R2 bucket ready (or already exists)" -ForegroundColor Green

    Write-Host ""
    Write-Host "=== Setup complete ===" -ForegroundColor Green
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "  1. Run '.\deploy.ps1 -Dev' for local development" -ForegroundColor White
    Write-Host "  2. Run '.\deploy.ps1' for production deployment" -ForegroundColor White
    exit 0
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Dependencies not found. Running npm install..." -ForegroundColor Yellow
    npm install
}

Write-Host "=== Type-checking ===" -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] TypeScript type check failed." -ForegroundColor Red
    exit 1
}

if ($Dev) {
    Write-Host "=== Starting local dev server ===" -ForegroundColor Cyan
    if ($Tail) {
        npx wrangler dev --tail
    } else {
        npx wrangler dev
    }
} else {
    Write-Host "=== Deploying to Cloudflare Workers (free tier) ===" -ForegroundColor Cyan
    npx wrangler deploy

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=== Deployment successful! ===" -ForegroundColor Green
        Write-Host ""
        Write-Host "Your battle server is now live." -ForegroundColor White
        Write-Host "Health check: GET https://<your-worker-subdomain>.workers.dev/health" -ForegroundColor White
        Write-Host ""
        Write-Host "To test in Godot/Web client, update the WebSocket URL to:" -ForegroundColor White
        Write-Host "  wss://<your-worker-subdomain>.workers.dev/room/<roomId>/ws" -ForegroundColor White
        Write-Host ""
        Write-Host "To view logs, run: .\deploy.ps1 -Dev -Tail" -ForegroundColor White
    } else {
        Write-Host "[ERROR] Deployment failed." -ForegroundColor Red
        exit 1
    }
}
