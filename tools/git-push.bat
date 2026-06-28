@echo off
setlocal

cd /d "%~dp0.."

git status
git add .

set /p COMMIT_MESSAGE=Commit mesaji: 
if "%COMMIT_MESSAGE%"=="" (
  echo Commit mesaji bos olamaz.
  exit /b 1
)

git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 exit /b %errorlevel%

git push
exit /b %errorlevel%
