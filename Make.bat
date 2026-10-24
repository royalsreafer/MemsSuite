@echo off
setlocal
cd /d %~dp0

cargo tauri build
if errorlevel 1 exit /b %errorlevel%

start "" "%~dp0src-tauri\target\release\memssuite.exe"
