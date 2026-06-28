@echo off
setlocal

cd /d "%~dp0"

:menu
cls
echo ==================================
echo 2ElBul Control Center
echo =====================
echo.
echo 1. Git Push
echo 2. Lint
echo 3. Build
echo 4. Lint + Build
echo 5. Push + Build
echo 6. Git Status
echo 7. Cikis
echo.
set /p CHOICE=Seciminiz: 

if "%CHOICE%"=="1" call "%~dp0tools\git-push.bat"
if "%CHOICE%"=="2" call "%~dp0tools\lint.bat"
if "%CHOICE%"=="3" call "%~dp0tools\build.bat"
if "%CHOICE%"=="4" call "%~dp0tools\lint-build.bat"
if "%CHOICE%"=="5" call "%~dp0tools\push-build.bat"
if "%CHOICE%"=="6" git status
if "%CHOICE%"=="7" exit /b 0

if not "%CHOICE%"=="7" (
  echo.
  pause
  goto menu
)
