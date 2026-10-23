@echo off
set EXECUTABLE=webmemsfcr
set DIST=%~dp0dist\windows
set RES=%DIST%\resources

cd /d %~dp0app
go build -o "%DIST%\%EXECUTABLE%.exe" -ldflags="-H windowsgui -s -w" || exit /b 1

rem the web server serves files from <exe folder>\resources
if exist "%RES%" rmdir /s /q "%RES%"
mkdir "%RES%\static"
copy /y index.html "%RES%\" >nul
copy /y error.html "%RES%\" >nul
xcopy /e /i /y static "%RES%\static" >nul

cd /d %DIST%
start "" "%EXECUTABLE%.exe"
