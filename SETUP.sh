#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo ""
echo "  Conseal — First-time setup (macOS)"
echo "  ================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js required. Install from https://nodejs.org"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: Python 3 required. Install from https://www.python.org/downloads/macos/"
  exit 1
fi

echo "[1/3] npm install..."
npm install

echo "[2/3] pip install backend..."
python3 -m pip install -r backend/requirements.txt

echo "[3/3] Building desktop UI..."
npm run build

echo ""
echo "  Setup complete!"
echo "  Next: ./START-CONSEAL.sh"
echo ""
