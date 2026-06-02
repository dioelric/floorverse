@echo off
title FloorVerse — First-Time Setup
color 0A
cls

echo.
echo  ███████╗██╗      ██████╗  ██████╗ ██████╗ ██╗   ██╗███████╗██████╗ ███████╗███████╗
echo  ██╔════╝██║     ██╔═══██╗██╔═══██╗██╔══██╗██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝
echo  █████╗  ██║     ██║   ██║██║   ██║██████╔╝██║   ██║█████╗  ██████╔╝███████╗█████╗
echo  ██╔══╝  ██║     ██║   ██║██║   ██║██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══╝
echo  ██║     ███████╗╚██████╔╝╚██████╔╝██║  ██║ ╚████╔╝ ███████╗██║  ██║███████║███████╗
echo  ╚═╝     ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝
echo.
echo  SaaS Multi-Tenant Floor Plan ^& 3D Property Visualization Platform
echo  ──────────────────────────────────────────────────────────────────
echo.

:: ── Step 0: Check Node.js ────────────────────────────────────────────
echo [1/5] Checking Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: Node.js is not installed or not in PATH.
    echo.
    echo  Please download and install Node.js from:
    echo  https://nodejs.org/en/download  (choose LTS version)
    echo.
    echo  After installing, close this window and run setup.bat again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo  OK  Node.js %NODE_VERSION% found
echo.

:: ── Step 1: Get MySQL password ───────────────────────────────────────
echo [2/5] MySQL Configuration
echo.
echo  Enter your MySQL root password (leave blank if no password):
set /p MYSQL_PASS=  Password:

:: Update server .env with the password
echo  Updating server\.env with your MySQL password...
powershell -Command "(Get-Content 'server\.env') -replace 'DB_PASSWORD=.*', 'DB_PASSWORD=%MYSQL_PASS%' | Set-Content 'server\.env'"
echo  OK  server\.env configured
echo.

:: ── Step 2: Create MySQL database + tables ───────────────────────────
echo [3/5] Setting up MySQL database...
echo.

if "%MYSQL_PASS%"=="" (
    mysql -u root < server\migrations\001_initial_schema.sql 2>nul
) else (
    mysql -u root -p%MYSQL_PASS% < server\migrations\001_initial_schema.sql 2>nul
)

if %errorlevel% neq 0 (
    color 0E
    echo.
    echo  WARNING: Could not run MySQL migration automatically.
    echo.
    echo  Please run this manually in MySQL Workbench or your terminal:
    echo.
    echo    mysql -u root -p ^< server\migrations\001_initial_schema.sql
    echo.
    echo  Then press any key to continue with npm install...
    echo.
    pause
) else (
    echo  OK  Database 'floorverse' created with all tables
    echo  OK  Super Admin seeded: admin@floorverse.io / Admin@123
)
echo.

:: ── Step 3: Install server dependencies ─────────────────────────────
echo [4/5] Installing backend dependencies (server)...
cd server
call npm install --silent
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: npm install failed for server. Check your internet connection.
    pause
    exit /b 1
)
echo  OK  Server dependencies installed
cd ..
echo.

:: ── Step 4: Install client dependencies ─────────────────────────────
echo [5/5] Installing frontend dependencies (client)...
cd client
call npm install --silent
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: npm install failed for client. Check your internet connection.
    pause
    exit /b 1
)
echo  OK  Client dependencies installed
cd ..
echo.

:: ── Done ─────────────────────────────────────────────────────────────
color 0A
echo  ══════════════════════════════════════════════════════════════
echo.
echo   SETUP COMPLETE!
echo.
echo   Now double-click  start.bat  to launch FloorVerse.
echo.
echo   Once running, open your browser at:
echo   http://localhost:5173
echo.
echo   Login:  admin@floorverse.io
echo   Pass:   Admin@123
echo.
echo  ══════════════════════════════════════════════════════════════
echo.
pause
