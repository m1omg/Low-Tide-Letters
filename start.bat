@echo off
rem Starts the local server and opens the game in the default browser.
rem Without Node.js the game still runs straight from the file.
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  node serve.js --open %*
) else (
  echo Node.js was not found - opening index.html directly instead.
  start "" "index.html"
)
