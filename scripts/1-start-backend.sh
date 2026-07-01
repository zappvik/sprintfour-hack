#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo ""
echo "  Conseal Backend (Python sidecar)"
echo "  =============================="
echo "  Keep this terminal OPEN while using Conseal."
echo ""

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found. Install Python 3 and try again."
  exit 1
fi

if lsof -i :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Backend is ALREADY running on http://127.0.0.1:8000"
  echo "Skip this step and run: ./scripts/2-open-conseal.sh"
  exit 0
fi

echo "Starting on http://127.0.0.1:8000 ..."
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
