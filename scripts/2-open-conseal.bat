@echo off
title Conseal — Desktop App
cd /d "%~dp0.."

echo.
echo  Conseal Desktop
echo  ===============
echo.

if not exist "node_modules\electron" (
  echo First-time setup: installing dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

if not exist "out\index.html" (
  echo Building desktop UI ^(one-time, ~30 sec^)...
  call npm run build
  if errorlevel 1 (
    echo ERROR: build failed.
    pause
    exit /b 1
  )
)

echo Opening Conseal desktop window...
call npx electron .
if errorlevel 1 (
  echo ERROR: Could not start Electron.
  pause
  exit /b 1
)
