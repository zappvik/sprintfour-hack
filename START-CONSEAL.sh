#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo ""
echo "  Conseal — Quick Start (macOS)"
echo "  ============================="
echo ""

if lsof -i :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Backend already running on port 8000 — opening app..."
else
  echo "Start the backend in a separate terminal tab:"
  echo "  ./scripts/1-start-backend.sh"
  echo ""
  echo "Waiting 5 seconds — start the backend now if you haven't..."
  sleep 5
fi

./scripts/2-open-conseal.sh
