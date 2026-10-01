@echo off
rem Baut den aktuellen Stand lokal.
rem "build.cmd"           -> lose exe ohne Installer (schnell)
rem "build.cmd installer" -> NSIS-Installer plus exe
setlocal
cd /d "%~dp0"
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

if not exist node_modules (
    echo Abhaengigkeiten fehlen, installiere ...
    call pnpm install --frozen-lockfile
    if errorlevel 1 goto failed
)

if /i "%~1"=="installer" goto installer

call pnpm tauri build --no-bundle
if errorlevel 1 goto failed
echo.
echo Fertig: %~dp0src-tauri\target\release\verwalter.exe
goto done

:installer
call pnpm tauri build
if errorlevel 1 goto failed
echo.
echo Fertig: %~dp0src-tauri\target\release\bundle\nsis\
echo Lose exe: %~dp0src-tauri\target\release\verwalter.exe
goto done

:failed
echo.
echo Build fehlgeschlagen.
exit /b 1

:done
if /i not "%CI%"=="true" pause
