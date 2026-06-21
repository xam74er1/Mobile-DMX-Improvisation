@echo off
title DMX Improvisator - Web Preview
cd /d "%~dp0"

echo.
echo  ============================================
echo   Mobile DMX Improvisator - Web Preview
echo  ============================================
echo.
echo  Opens the app in your browser.
echo  NOTE: DMX output is disabled on web.
echo        Use start-android.bat for real DMX control.
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found. Install Node 18+ from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo  [INFO] node_modules not found. Running npm install first...
    echo.
    npm install
    if errorlevel 1 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo  [INFO] Starting web server at http://localhost:8081
echo  [INFO] Press Ctrl+C to stop.
echo.
npx expo start --web

pause
