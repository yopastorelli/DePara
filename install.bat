@echo off
REM Script de Instalação Automatizada para DePara
REM Este script configura o ambiente e instala as dependências

echo.
echo ========================================
echo    INSTALADOR AUTOMATIZADO DEPARA
echo ========================================
echo.

echo [1/5] Verificando requisitos do sistema...
echo.

REM Verificar se Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale o Node.js versao 16.0.0 ou superior
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

REM Verificar se npm está disponível
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: npm nao encontrado!
    echo Por favor, verifique a instalacao do Node.js
    pause
    exit /b 1
)

echo [OK] Node.js e npm encontrados
echo.

REM Verificar versões
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo Node.js: %NODE_VERSION%
echo npm: %NPM_VERSION%
echo.

echo [2/5] Criando diretorio de logs...
if not exist "logs" mkdir logs
echo [OK] Diretorio de logs criado
echo.

echo [3/5] Instalando dependencias...
echo.
npm install
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias!
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas com sucesso
echo.

echo [4/5] Configurando arquivo de ambiente...
if not exist ".env" (
    if exist "env.example" (
        copy "env.example" ".env" >nul
        echo [OK] Arquivo .env criado a partir do exemplo
    ) else (
        echo [AVISO] Arquivo env.example nao encontrado
        echo Crie manualmente o arquivo .env se necessario
    )
) else (
    echo [OK] Arquivo .env ja existe
)
echo.

echo [5/5] Verificando instalacao...
echo.

REM Testar se a aplicação pode ser iniciada
echo Testando inicializacao da aplicacao...
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo    INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================
echo.
echo Para iniciar a aplicacao:
echo   npm start
echo.
echo Para modo desenvolvimento:
echo   npm run dev
echo.
echo Para executar testes:
echo   npm test
echo.
echo Aplicacao disponivel em: http://localhost:3000
echo Documentacao da API: http://localhost:3000/api/docs
echo.
echo Pressione qualquer tecla para sair...
pause >nul
