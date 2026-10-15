@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "RUNTIME_ROOT=%USERPROFILE%\.depara"
if not "%DEPARA_RUNTIME_ROOT%"=="" set "RUNTIME_ROOT=%DEPARA_RUNTIME_ROOT%"
set "CONFIG_ENV_PATH=%RUNTIME_ROOT%\config.env"
if not "%DEPARA_CONFIG_ENV_PATH%"=="" set "CONFIG_ENV_PATH=%DEPARA_CONFIG_ENV_PATH%"

echo Instalando DePara para Windows...
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js 18.15.0 ou superior nao encontrado.
    exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
    echo npm 9 ou superior nao encontrado.
    exit /b 1
)

for /f "tokens=1,2 delims=." %%A in ('node --version') do (
    set "NODE_MAJOR=%%A"
    set "NODE_MINOR=%%B"
)
set "NODE_MAJOR=%NODE_MAJOR:v=%"
if %NODE_MAJOR% LSS 18 (
    echo Node.js 18.15.0 ou superior e necessario.
    exit /b 1
)
if %NODE_MAJOR% EQU 18 if %NODE_MINOR% LSS 15 (
    echo Node.js 18.15.0 ou superior e necessario.
    exit /b 1
)

echo Instalando dependencias com npm ci...
call npm ci
if errorlevel 1 exit /b 1

for %%D in ("%RUNTIME_ROOT%" "%RUNTIME_ROOT%\data" "%RUNTIME_ROOT%\logs" "%RUNTIME_ROOT%\backups" "%RUNTIME_ROOT%\temp" "%RUNTIME_ROOT%\releases" "%RUNTIME_ROOT%\current") do (
    if not exist "%%~D" mkdir "%%~D"
)

if not exist "%CONFIG_ENV_PATH%" (
    > "%CONFIG_ENV_PATH%" echo PORT=3000
    >> "%CONFIG_ENV_PATH%" echo NODE_ENV=production
    >> "%CONFIG_ENV_PATH%" echo MAX_PAYLOAD=25mb
    >> "%CONFIG_ENV_PATH%" echo LOG_LEVEL=warn
    >> "%CONFIG_ENV_PATH%" echo LOG_TO_CONSOLE=false
    >> "%CONFIG_ENV_PATH%" echo DEPARA_HTTP_LOGGING=false
    >> "%CONFIG_ENV_PATH%" echo DEPARA_REQUEST_METADATA_LOGGING=false
    >> "%CONFIG_ENV_PATH%" echo DEPARA_RUNTIME_ROOT=%RUNTIME_ROOT%
)

echo.
echo Instalacao concluida.
echo Runtime: %RUNTIME_ROOT%
echo Configuracao: %CONFIG_ENV_PATH%
echo Inicializacao: npm run start:windows
exit /b 0
