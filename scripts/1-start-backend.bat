@echo off
title Conseal — Backend
cd /d "%~dp0.."

echo.
echo  Conseal Backend (Python sidecar)
echo  ==============================
echo  Keep this window OPEN while using Conseal.
echo.

python --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python not found. Install Python 3 and add it to PATH.
  pause
  exit /b 1
)

if not exist "backend\requirements.txt" (
  echo ERROR: Run this from the conseal project folder.
  pause
  exit /b 1
)

powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue; if ($c) { exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  echo Backend is ALREADY running on http://127.0.0.1:8000
  echo You can skip this step and open Conseal with scripts\2-open-conseal.bat
  echo.
  pause
  exit /b 0
)

echo Starting on http://127.0.0.1:8000 ...
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
pause
