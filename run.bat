@echo off
setlocal EnableDelayedExpansion
title Project Management Intelligence - Application Server

color 0A
echo ==============================================================================
echo     Project Management Intelligence Platform - Launching Server               
echo ==============================================================================
echo.

REM Set current folder as working directory
cd /d "%~dp0"

REM ------------------------------------------------------------------------------
REM 1. Verify if Initial Setup has been performed
REM ------------------------------------------------------------------------------
if not exist "%~dp0node_modules\" (
    echo [NOTICE] Dependencies are missing on this system.
    echo          Launching "setup.bat" to perform one-time installation...
    echo.
    call "%~dp0setup.bat"
    if %errorlevel% neq 0 (
        echo [ERROR] Setup did not complete successfully. Cannot launch server.
        pause
        exit /b 1
    )
    exit /b 0
)

REM ------------------------------------------------------------------------------
REM 2. Check if Node.js runtime is accessible
REM ------------------------------------------------------------------------------
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not recognized in your system PATH!
    echo Please run "setup.bat" to configure prerequisites.
    echo.
    pause
    exit /b 1
)

REM ------------------------------------------------------------------------------
REM 3. Verify .env.local Configuration
REM ------------------------------------------------------------------------------
if not exist "%~dp0.env.local" (
    if exist "%~dp0.env.example" (
        copy /y "%~dp0.env.example" "%~dp0.env.local" >nul
        echo [INFO] Restored .env.local from .env.example template.
    ) else (
        echo # Gemini API Key > "%~dp0.env.local"
        echo GEMINI_API_KEY= >> "%~dp0.env.local"
    )
)

REM ------------------------------------------------------------------------------
REM 4. Check and Free Port 3000 if occupied
REM ------------------------------------------------------------------------------
echo [1/3] Checking port 3000 availability...
set PORT_IN_USE=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    set PORT_IN_USE=1
    echo       Port 3000 is occupied by PID %%a. Releasing port...
    taskkill /F /PID %%a >nul 2>nul
)
if !PORT_IN_USE! equ 0 (
    echo       Port 3000 is available.
)

REM ------------------------------------------------------------------------------
REM 5. Automatically launch browser when server starts
REM ------------------------------------------------------------------------------
echo [2/3] Preparing browser launch...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

REM ------------------------------------------------------------------------------
REM 6. Start Next.js Server
REM ------------------------------------------------------------------------------
echo [3/3] Starting Next.js development server...
echo.
echo ==============================================================================
echo  Server is active! 
echo  Access Web App at: http://localhost:3000
echo  Press Ctrl+C in this console window anytime to stop the server.
echo ==============================================================================
echo.

call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo ==============================================================================
    echo [APPLICATION SERVER STOPPED]
    echo If the server stopped unexpectedly:
    echo  1. Port Conflict: If port 3000 was locked, check browser for http://localhost:3001
    echo  2. Missing Packages: Run "setup.bat" to refresh or repair dependencies.
    echo  3. Missing API Key: Set GEMINI_API_KEY in .env.local or inside the app UI.
    echo ==============================================================================
    pause
)

exit /b %errorlevel%
