@echo off
rem Double-click this to run FinanceOS. Builds on first run, then starts the local
rem server and opens it in its own window. Nothing ever leaves this laptop.
setlocal
cd /d "%~dp0"
set PORT=4321

where node >nul 2>&1 || (echo Node.js is not installed. Get it from https://nodejs.org and run this again. & pause & exit /b 1)

if not exist "node_modules" (
  echo Installing dependencies, one time only...
  call npm install || (pause & exit /b 1)
)
if not exist "dist\index.html" (
  echo Building the interface, one time only...
  call npm run build || (pause & exit /b 1)
)

set EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
if exist "%EDGE%" (
  set OPEN=start "" "%EDGE%" --app=http://localhost:%PORT%
) else (
  set OPEN=start "" http://localhost:%PORT%
)

rem Open the window a moment after the server is listening.
start /b "" cmd /c "timeout /t 2 /nobreak >nul & %OPEN%"

echo.
echo   FinanceOS  -  http://localhost:%PORT%
echo   Close this window to stop it.
echo.
node server\server.js
