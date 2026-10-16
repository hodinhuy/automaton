#!/usr/bin/env bash
# Start the Automaton Self-Hosted Browser Service on Linux/macOS

set -e

echo "=== Starting Automaton Browser Engine ==="

# Check if Docker is available
if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo "[INFO] Docker detected. Starting container via docker-compose..."
    docker compose -f src/browser/docker-compose.yml up -d
    echo "[SUCCESS] Automaton Browser Service running at http://127.0.0.1:8765"
    exit 0
fi

# Fallback to local uv / python
if command -v uv &> /dev/null; then
    echo "[INFO] Running locally with uv..."
    uv run python src/browser/server.py
elif command -v python3 &> /dev/null; then
    echo "[INFO] Running locally with python3..."
    python3 src/browser/server.py
else
    echo "[ERROR] Neither Docker, uv, nor Python 3 found. Please install Docker or uv."
    exit 1
fi
