@echo off
setlocal EnableDelayedExpansion
title Project Management Intelligence - Client Setup Wizard

color 0B
echo ==============================================================================
echo        Project Management Intelligence Platform - Client Setup Wizard        
echo ==============================================================================
echo.
echo  This setup wizard configures all prerequisites and dependencies for running
echo  the Project Management Intelligence Platform on this system.
echo.
echo  NOTE: You only need to run this setup script ONCE after downloading/cloning.
echo  Once completed, you can start the application anytime using "run.bat".
echo ==============================================================================
echo.

REM Change directory to the folder containing this batch script
cd /d "%~dp0"

REM ==============================================================================
REM [Step 1/6] Check Directory Write Permissions
REM ==============================================================================
echo [Step 1/6] Checking directory write permissions...
echo perm_test > "%~dp0.perm_check.tmp" 2>nul
if not exist "%~dp0.perm_check.tmp" goto ERR_PERMISSIONS
del "%~dp0.perm_check.tmp" >nul 2>nul
echo         Directory write permissions: OK.

REM Configure Git long paths only if this is a Git repository and Git is installed
if exist "%~dp0.git\" (
    where git >nul 2>nul
    if !errorlevel! equ 0 (
        git config core.longpaths true >nul 2>nul
        echo         Git long paths setting enabled.
    )
)
echo.
goto CHECK_NODE

:ERR_PERMISSIONS
echo.
echo [ERROR] Current directory is write-protected or lacks required permissions.
echo Please right-click "setup.bat" and select "Run as administrator",
echo or move the project folder out of protected system directories.
echo.
pause
exit /b 1

REM ==============================================================================
REM [Step 2/6] Check Node.js and npm Runtime & Version Compatibility
REM ==============================================================================
:CHECK_NODE
echo [Step 2/6] Checking Node.js and npm runtime...

where node >nul 2>nul
if %errorlevel% neq 0 goto ERR_NODE_MISSING

for /f "tokens=1,2,3 delims=." %%a in ('node -v') do (
    set NODE_RAW=%%a
    set NODE_FULL=%%a.%%b.%%c
)
set NODE_MAJOR=!NODE_RAW:v=!
echo         Detected Node.js version: !NODE_FULL!

if !NODE_MAJOR! LSS 18 goto WARN_NODE_OLD
echo         Node.js version compatibility: OK.
goto CHECK_NPM

:ERR_NODE_MISSING
echo.
echo ==============================================================================
echo [ERROR] Node.js was not found on this system!
echo ==============================================================================
echo Next.js requires Node.js version 18.18.0 or newer [Node.js 20+ LTS recommended].
echo Please install Node.js from the official site: https://nodejs.org
echo.
set /p OPEN_NODE="Would you like to open the Node.js download page in your browser? [Y/N, default Y]: "
if /i "!OPEN_NODE!" neq "N" (
    start https://nodejs.org/en/download
)
echo.
echo After installing Node.js, reopen this script to complete setup.
echo.
pause
exit /b 1

:WARN_NODE_OLD
echo.
echo [WARNING] Node.js version !NODE_FULL! detected.
echo Next.js 15 requires Node.js v18.18.0 or higher.
echo Older versions may encounter package syntax or runtime errors.
echo Recommended: Install Node.js LTS from https://nodejs.org
echo.
set /p PROCEED_ANYWAY="Do you want to continue anyway? [Y/N, default N]: "
if /i "!PROCEED_ANYWAY!" neq "Y" (
    start https://nodejs.org/en/download
    pause
    exit /b 1
)

:CHECK_NPM
where npm >nul 2>nul
if %errorlevel% neq 0 goto ERR_NPM_MISSING

for /f "tokens=*" %%p in ('npm -v') do set NPM_VER=%%p
echo         Detected npm version: !NPM_VER!
echo.
goto CHECK_NETWORK

:ERR_NPM_MISSING
echo.
echo [ERROR] npm was not found in your system PATH!
echo Although Node.js is present, npm is missing from the environment PATH.
echo Please restart your terminal or reinstall Node.js.
echo.
pause
exit /b 1

REM ==============================================================================
REM [Step 3/6] Check Network / npm Registry Connectivity
REM ==============================================================================
:CHECK_NETWORK
echo [Step 3/6] Checking network connectivity to npm registry...
call npm ping --timeout=6000 >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Cannot connect to npm registry [registry.npmjs.org].
    echo A working internet connection is required to download project dependencies.
    echo If behind a corporate proxy, configure npm proxy:
    echo   npm config set proxy http://your-proxy:8080
    echo.
    set /p RETRY_NET="Continue anyway? [Y/N, default Y]: "
    if /i "!RETRY_NET!"=="N" (
        pause
        exit /b 1
    )
) else (
    echo         Network connectivity: OK.
)
echo.

REM ==============================================================================
REM [Step 4/6] Install Project Dependencies
REM ==============================================================================
:INSTALL_DEPS
echo [Step 4/6] Installing project dependencies [Next.js, React 19, Recharts, Lucide, Gemini SDK]...
echo         This typically takes 1-3 minutes on a fresh install.
echo.

if exist "%~dp0node_modules\" (
    echo         Existing node_modules folder detected. Validating packages...
)

REM Primary installation with fast flags (disabling audits and funds avoids network hangs)
call npm install --no-fund --no-audit
if %errorlevel% equ 0 goto INSTALL_SUCCESS

echo.
echo [WARNING] Standard npm installation encountered peer dependency warnings.
echo Attempting fallback installation with "--legacy-peer-deps"...
echo.

REM Fallback 1: Legacy peer dependencies mode
call npm install --legacy-peer-deps --no-fund --no-audit
if %errorlevel% equ 0 goto INSTALL_SUCCESS

echo.
echo ==============================================================================
echo [CRITICAL ERROR] Dependency installation failed!
echo ==============================================================================
echo Troubleshooting Steps for Client Machines:
echo  1. Antivirus / File Locking: Some endpoint protection tools lock files in
echo     node_modules. Try running setup.bat as Administrator.
echo  2. Windows Path Limits: Move this project folder to a shorter path (e.g. C:\Projects)
echo  3. Clear Corrupted Cache: Run "npm cache clean --force" and retry setup.bat
echo ==============================================================================
echo.
pause
exit /b 1

:INSTALL_SUCCESS
echo.
echo         Dependencies installed and verified successfully!
echo.

REM ==============================================================================
REM [Step 5/6] Configure Environment Settings (.env.local)
REM ==============================================================================
:SETUP_ENV
echo [Step 5/6] Configuring client environment [.env.local]...

if exist "%~dp0.env.local" goto ENV_EXISTS

if exist "%~dp0.env.example" (
    copy /y "%~dp0.env.example" "%~dp0.env.local" >nul
    echo         Created ".env.local" configuration file from template.
) else (
    echo # Gemini API Key for Project Management Data Analyst > "%~dp0.env.local"
    echo # Get a free key at https://aistudio.google.com/app/apikey >> "%~dp0.env.local"
    echo GEMINI_API_KEY= >> "%~dp0.env.local"
    echo         Created new ".env.local" configuration file.
)

echo.
echo  * OPTIONAL: Gemini API Key Setup
echo    A Gemini API Key is needed for AI questions and automated data generation.
echo    You can enter it now, or leave it blank and configure it anytime inside
echo    the web application Settings menu.
echo.
set /p USER_API_KEY="Enter Gemini API Key [Press Enter to skip]: "
if defined USER_API_KEY (
    if "!USER_API_KEY!" neq "" (
        echo # Gemini API Key for Project Management Data Analyst > "%~dp0.env.local"
        echo # Get a free key at https://aistudio.google.com/app/apikey >> "%~dp0.env.local"
        echo GEMINI_API_KEY=!USER_API_KEY! >> "%~dp0.env.local"
        echo         Gemini API Key saved to ".env.local".
    )
)
goto VERIFY_DATASET

:ENV_EXISTS
echo         Existing ".env.local" configuration file found: OK.

REM ==============================================================================
REM [Step 6/6] Initialize Default Dataset & Create Setup Completion Marker
REM ==============================================================================
:VERIFY_DATASET
echo.
echo [Step 6/6] Initializing default dataset and final verification...

if not exist "%~dp0Project Management" (
    if exist "%~dp0scripts\init_data.js" (
        echo         Generating initial Project Management dataset...
        call node "%~dp0scripts\init_data.js" >nul 2>nul
        echo         Default dataset generated.
    )
) else (
    echo         Default dataset verified: OK.
)

REM Write setup completion marker
echo SETUP_COMPLETED=TRUE > "%~dp0.setup_complete"
echo SETUP_DATE=%DATE% %TIME% >> "%~dp0.setup_complete"
echo NODE_VERSION=!NODE_FULL! >> "%~dp0.setup_complete"
echo NPM_VERSION=!NPM_VER! >> "%~dp0.setup_complete"

echo.
echo ==============================================================================
echo                    SETUP COMPLETED SUCCESSFULLY!                              
echo ==============================================================================
echo.
echo  The Project Management Intelligence Platform is fully configured and ready!
echo.
echo  * You DO NOT need to run "setup.bat" again on this computer.
echo  * To start the application at any time, simply run:
echo.
echo         .\run.bat
echo.
echo ==============================================================================
echo.

set /p LAUNCH_NOW="Would you like to launch the application now using run.bat? [Y/N, default Y]: "
if /i "!LAUNCH_NOW!" neq "N" (
    echo.
    echo Launching Project Management Intelligence Platform...
    call "%~dp0run.bat"
) else (
    echo.
    echo Setup finished. Double-click "run.bat" whenever you are ready to start.
    pause
)

exit /b 0
