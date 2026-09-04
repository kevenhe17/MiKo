@echo off
setlocal EnableExtensions
title BugTrace Dev Stopper

echo Stopping BugTrace dev servers ...

for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":3000 " ^| findstr /C:"LISTENING"') do (
  echo   killing backend PID %%p
  taskkill /PID %%p /F >nul 2>&1
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":5173 " ^| findstr /C:"LISTENING"') do (
  echo   killing frontend PID %%p
  taskkill /PID %%p /F >nul 2>&1
)

echo Done.
pause
