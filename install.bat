@echo off
echo ========================================
echo       INSTALADOR DePara v2.0
echo ========================================
echo.
echo Sistema de Gerenciamento de Arquivos
echo Com operações automáticas e backup
echo.
echo ========================================

REM Verificar se Node.js está instalado
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js não encontrado!
    echo.
    echo 📥 Baixe e instale o Node.js de:
    echo https://nodejs.org/
    echo.
    echo Pressione qualquer tecla para sair...
    pause >nul
    exit /b 1
)

REM Verificar se npm está instalado
echo [2/5] Verificando npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm não encontrado!
    echo Pressione qualquer tecla para continuar...
    pause >nul
    exit /b 1
)

echo ✅ Node.js e npm encontrados!

REM Instalar dependências
echo.
echo [3/5] Instalando dependências...
echo Isso pode levar alguns minutos...
npm install
if %errorlevel% neq 0 (
    echo ❌ Erro ao instalar dependências!
    pause
    exit /b 1
)

REM Criar estrutura de pastas
echo.
echo [4/5] Criando estrutura de pastas...
if not exist "backups" mkdir backups
if not exist "logs" mkdir logs
if not exist "temp" mkdir temp

REM Criar arquivo de configuração básico
if not exist ".env" (
    echo [5/5] Criando configuração básica...
    echo PORT=3000> .env
    echo NODE_ENV=production>> .env
    echo LOG_LEVEL=info>> .env
    echo LOG_FILE=logs/app.log>> .env
)

echo.
echo ========================================
echo ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!
echo ========================================
echo.
echo 🚀 Para iniciar o DePara:
echo    npm start
echo.
echo 🌐 Interface web:
echo    http://localhost:3000/ui
echo.
echo 📚 Documentação da API:
echo    http://localhost:3000/api/docs
echo.
echo 📁 Principais funcionalidades:
echo    • Mover/copiar arquivos automaticamente
echo    • Backup automático antes de apagar
echo    • Agendamento flexível (segundos a dias)
echo    • Templates pré-configurados
echo    • Interface web amigável
echo.
echo Pressione qualquer tecla para sair...
pause >nul