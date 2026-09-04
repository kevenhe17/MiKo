@echo off
setlocal EnableExtensions EnableDelayedExpansion
title BugTrace Dev Launcher

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "LOGS=%ROOT%logs"
set "PY=%BACKEND%\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
if not exist "%LOGS%" mkdir "%LOGS%"

echo ============================================
echo   BugTrace one-click dev launcher
echo   backend :3000  frontend :5173
echo   logs in %LOGS%
echo ============================================
echo.

REM ---------- [1/3] backend (port 3000) ----------
netstat -ano | findstr /C:":3000 " | findstr /C:"LISTENING" >nul
if errorlevel 1 (
  echo [1/3] Starting backend on port 3000 ...
  start "BugTrace-Backend" /min cmd /k "cd /d "%BACKEND%" && "%PY%" wsgi.py >> "%LOGS%\backend.log" 2>&1"
) else (
  echo [1/3] Backend already running on port 3000, skip.
)

echo       Waiting for backend ...
set /a TRIES=0
:wait_backend
ping -n 2 127.0.0.1 >nul
curl -s -o nul -m 2 http://localhost:3000/auth/login -X POST -H "Content-Type: application/json" -d "{}"
if errorlevel 1 (
  set /a TRIES+=1
  if !TRIES! lss 20 goto wait_backend
  echo       WARNING: backend not responding after 20s - see %LOGS%\backend.log
) else (
  echo       Backend is up.
)

REM ---------- [2/3] frontend (port 5173) ----------
netstat -ano | findstr /C:":5173 " | findstr /C:"LISTENING" >nul
if errorlevel 1 (
  echo [2/3] Starting frontend on port 5173 ...
  start "BugTrace-Frontend" /min cmd /k "cd /d "%FRONTEND%" && npm run dev >> "%LOGS%\frontend.log" 2>&1"
) else (
  echo [2/3] Frontend already running on port 5173, skip.
)

echo       Waiting for frontend ...
set /a TRIES=0
:wait_frontend
ping -n 2 127.0.0.1 >nul
curl -s -o nul -m 2 http://localhost:5173/
if errorlevel 1 (
  set /a TRIES+=1
  if !TRIES! lss 30 goto wait_frontend
  echo       WARNING: frontend not responding after 30s - see %LOGS%\frontend.log
) else (
  echo       Frontend is up.
)

REM ---------- [3/3] open browser ----------
echo [3/3] Opening browser ...
start "" http://localhost:5173/login

echo.
echo Done. To stop both servers, run stop-dev.bat
echo (or close the two minimized console windows).
echo.
pause
