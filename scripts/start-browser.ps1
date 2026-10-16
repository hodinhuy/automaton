# Start Automaton Self-Hosted Browser Service on Windows
Write-Host "=== Starting Automaton Browser Engine ===" -ForegroundColor Cyan

# Check if Docker is running
try {
    $dockerCheck = docker info 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[INFO] Docker detected. Starting container via docker-compose..." -ForegroundColor Green
        docker compose -f src/browser/docker-compose.yml up -d
        Write-Host "[SUCCESS] Browser service running at http://127.0.0.1:8765" -ForegroundColor Green
        exit 0
    }
} catch {}

# Fallback to uv
if (Get-Command uv -ErrorAction SilentlyContinue) {
    Write-Host "[INFO] Docker not active. Starting local service via uv..." -ForegroundColor Yellow
    uv run python src/browser/server.py
    exit 0
}

Write-Host "[ERROR] Neither Docker nor uv found. Please install Docker Desktop or uv." -ForegroundColor Red
exit 1
