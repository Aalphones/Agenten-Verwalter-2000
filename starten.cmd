@echo off
rem Startet Agenten Verwalter 2000 im Entwicklungsmodus.
rem "start.cmd build" baut stattdessen die lose exe ohne Installer.
setlocal
cd /d "%~dp0"
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

if /i "%~1"=="build" goto build

call pnpm tauri dev
if errorlevel 1 pause
goto :eof

:build
call pnpm tauri build --no-bundle
if errorlevel 1 goto failed
echo.
echo Fertig: %~dp0src-tauri\target\release\verwalter.exe
pause
goto :eof

:failed
pause
