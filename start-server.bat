@echo off
setlocal

cd /d "%~dp0"
echo Iniciando DePara no Windows...
call npm run start:windows
pause
