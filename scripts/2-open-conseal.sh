#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo ""
echo "  Conseal Desktop"
echo "  ==============="
echo ""

if [ ! -d node_modules/electron ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -f out/index.html ]; then
  echo "Building desktop UI (one-time)..."
  npm run build
fi

echo "Opening Conseal desktop window..."
npx electron .
