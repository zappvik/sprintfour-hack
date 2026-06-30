@echo off
cd /d "%~dp0"

echo.
echo  Conseal — Quick Start
echo  ====================
echo.

powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue; if ($c) { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo Backend not detected — starting in a new window...
  start "Conseal Backend" "%~dp0scripts\1-start-backend.bat"
  echo Waiting for backend...
  timeout /t 5 /nobreak >nul
) else (
  echo Backend already running on port 8000 — skipping start.
)

call "%~dp0scripts\2-open-conseal.bat"
