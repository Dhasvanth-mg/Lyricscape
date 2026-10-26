@echo off
rem Double-click to run Lyricscape: installs what is missing, starts it, opens your browser.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 20+ is required: https://nodejs.org & pause & exit /b 1)
where pnpm >nul 2>nul || (echo Installing pnpm... & call npm i -g pnpm)
node scripts\launch.mjs
if errorlevel 1 pause
