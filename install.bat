@echo off
setlocal

set "RUNTIME_ROOT=%USERPROFILE%\.depara"
if not "%DEPARA_RUNTIME_ROOT%"=="" set "RUNTIME_ROOT=%DEPARA_RUNTIME_ROOT%"
set "CONFIG_ENV_PATH=%RUNTIME_ROOT%\config.env"
if not "%DEPARA_CONFIG_ENV_PATH%"=="" set "CONFIG_ENV_PATH=%DEPARA_CONFIG_ENV_PATH%"

echo ========================================
echo       INSTALADOR DePara v2.0
echo ========================================
echo.

echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js nao encontrado!
    pause >nul
    exit /b 1
)

echo [2/5] Verificando npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo npm nao encontrado!
    pause >nul
    exit /b 1
)

echo [3/5] Instalando dependencias...
npm install
if %errorlevel% neq 0 (
    echo Erro ao instalar dependencias!
    pause >nul
    exit /b 1
)

echo [4/5] Criando estrutura de runtime...
if not exist "backups" mkdir backups
if not exist "logs" mkdir logs
if not exist "temp" mkdir temp
if not exist "%RUNTIME_ROOT%" mkdir "%RUNTIME_ROOT%"

echo [5/5] Criando configuracao basica...
if not exist "%CONFIG_ENV_PATH%" (
    > "%CONFIG_ENV_PATH%" echo PORT=3000
    >> "%CONFIG_ENV_PATH%" echo NODE_ENV=production
    >> "%CONFIG_ENV_PATH%" echo LOG_LEVEL=warn
    >> "%CONFIG_ENV_PATH%" echo LOG_TO_CONSOLE=false
    >> "%CONFIG_ENV_PATH%" echo DEPARA_RUNTIME_ROOT=%RUNTIME_ROOT%
)

echo.
echo ========================================
echo INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================
echo.
echo Para iniciar o DePara:
echo    npm start
echo.
echo Configuracao operacional:
echo    %CONFIG_ENV_PATH%
echo.
echo Interface web:
echo    http://localhost:3000/ui
echo.
pause >nul
