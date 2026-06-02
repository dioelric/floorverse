@echo off
title FloorVerse — Running
color 0A
cls

echo.
echo  ┌─────────────────────────────────────────────────┐
echo  │   FloorVerse — Starting Development Servers     │
echo  └─────────────────────────────────────────────────┘
echo.

:: Check node
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: Node.js not found. Run setup.bat first.
    pause
    exit /b 1
)

:: Check dependencies installed
if not exist "server\node_modules" (
    color 0E
    echo  Dependencies not installed. Running setup first...
    echo.
    call setup.bat
)

echo  Starting Backend API on http://localhost:5000 ...
echo  Starting Frontend    on http://localhost:5173 ...
echo.
echo  ─────────────────────────────────────────────────
echo  Press Ctrl+C to stop both servers
echo  ─────────────────────────────────────────────────
echo.

:: Open browser after 4 seconds
start "" timeout /t 4 /nobreak >nul && start "" "http://localhost:5173"

:: Start backend in a new window
start "FloorVerse API (port 5000)" cmd /k "cd /d %~dp0server && npm run dev"

:: Start frontend in current window
cd client
npm run dev

pause
