@echo off
rem Dijalankan oleh Scheduled Task "Propertika AI Backup".
rem Argumen pertama = jumlah backup yang disimpan (bawaan 14).
setlocal
cd /d "%~dp0.."

if not exist "backups" mkdir "backups"

set "KEEP=%~1"
if "%KEEP%"=="" set "KEEP=14"

echo. >> "backups\backup.log"
echo ==== %DATE% %TIME% ==== >> "backups\backup.log"
call npm run backup -- --keep %KEEP% >> "backups\backup.log" 2>&1
exit /b %errorlevel%
