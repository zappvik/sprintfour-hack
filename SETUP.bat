@echo off
cd /d "%~dp0"

echo.
echo  Conseal — First-time setup
echo  ==========================
echo.

python --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python 3 required. Install from https://python.org
  pause
  exit /b 1
)

echo [1/3] npm install...
call npm install
if errorlevel 1 goto :fail

echo [2/3] pip install backend...
pip install -r backend\requirements.txt
if errorlevel 1 goto :fail

echo [3/3] Building desktop UI...
call npm run build
if errorlevel 1 goto :fail

echo.
echo  Setup complete!
echo  Next: double-click START-CONSEAL.bat
echo.
pause
exit /b 0

:fail
echo.
echo Setup failed. Fix errors above and run again.
pause
exit /b 1
