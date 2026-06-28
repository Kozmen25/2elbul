@echo off
setlocal

cd /d "%~dp0.."
npm.cmd run lint
if errorlevel 1 exit /b %errorlevel%

npm.cmd run build
exit /b %errorlevel%
