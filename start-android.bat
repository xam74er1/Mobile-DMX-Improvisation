@echo off
title DMX Improvisator - Android Build
cd /d "%~dp0"

echo.
echo  ============================================
echo   Mobile DMX Improvisator - Android Build
echo  ============================================
echo.
echo  This will build the development APK and
echo  install it on your connected Android device.
echo.
echo  Requirements:
echo    - Android device connected via USB
echo      (or Android emulator running)
echo    - USB debugging enabled on device
echo    - Node 18+ installed
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

echo  [INFO] Starting Android build...
echo  [INFO] First build may take several minutes (Gradle setup).
echo.
npx expo run:android

pause
