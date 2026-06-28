@echo off
setlocal

cd /d "%~dp0.."

set /p COMMIT_MESSAGE=Commit mesaji: 
if "%COMMIT_MESSAGE%"=="" (
  echo Commit mesaji bos olamaz.
  exit /b 1
)

git add .
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 exit /b %errorlevel%

git push
if errorlevel 1 exit /b %errorlevel%

npm.cmd run build
exit /b %errorlevel%
