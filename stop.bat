@echo off
title FloorVerse — Stopping
echo.
echo  Stopping FloorVerse servers...
echo.

:: Kill node processes on ports 5000 and 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo  OK  All FloorVerse processes stopped.
echo.
timeout /t 2 /nobreak >nul
