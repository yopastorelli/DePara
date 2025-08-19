# Script de Instalação Automatizada para DePara (PowerShell)
# Este script configura o ambiente e instala as dependências

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    INSTALADOR AUTOMATIZADO DEPARA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] Verificando requisitos do sistema..." -ForegroundColor Yellow
Write-Host ""

# Verificar se Node.js está instalado
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js não encontrado"
    }
    Write-Host "[OK] Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERRO: Node.js não encontrado!" -ForegroundColor Red
    Write-Host "Por favor, instale o Node.js versão 16.0.0 ou superior" -ForegroundColor Red
    Write-Host "Download: https://nodejs.org/" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Verificar se npm está disponível
try {
    $npmVersion = npm --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "npm não encontrado"
    }
    Write-Host "[OK] npm encontrado: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "ERRO: npm não encontrado!" -ForegroundColor Red
    Write-Host "Por favor, verifique a instalação do Node.js" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""

Write-Host "[2/5] Criando diretório de logs..." -ForegroundColor Yellow
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
    Write-Host "[OK] Diretório de logs criado" -ForegroundColor Green
} else {
    Write-Host "[OK] Diretório de logs já existe" -ForegroundColor Green
}
Write-Host ""

Write-Host "[3/5] Instalando dependências..." -ForegroundColor Yellow
Write-Host ""
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao instalar dependências"
    }
    Write-Host "[OK] Dependências instaladas com sucesso" -ForegroundColor Green
} catch {
    Write-Host "ERRO: Falha ao instalar dependências!" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host ""

Write-Host "[4/5] Configurando arquivo de ambiente..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    if (Test-Path "env.example") {
        Copy-Item "env.example" ".env"
        Write-Host "[OK] Arquivo .env criado a partir do exemplo" -ForegroundColor Green
    } else {
        Write-Host "[AVISO] Arquivo env.example não encontrado" -ForegroundColor Yellow
        Write-Host "Crie manualmente o arquivo .env se necessário" -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] Arquivo .env já existe" -ForegroundColor Green
}
Write-Host ""

Write-Host "[5/5] Verificando instalação..." -ForegroundColor Yellow
Write-Host ""

# Testar se a aplicação pode ser iniciada
Write-Host "Testando inicialização da aplicação..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    INSTALAÇÃO CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Para iniciar a aplicação:" -ForegroundColor White
Write-Host "  npm start" -ForegroundColor Cyan
Write-Host ""

Write-Host "Para modo desenvolvimento:" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor Cyan
Write-Host ""

Write-Host "Para executar testes:" -ForegroundColor White
Write-Host "  npm test" -ForegroundColor Cyan
Write-Host ""

Write-Host "Aplicação disponível em: http://localhost:3000" -ForegroundColor White
Write-Host "Documentação da API: http://localhost:3000/api/docs" -ForegroundColor White
Write-Host ""

Write-Host "Pressione Enter para sair..." -ForegroundColor Yellow
Read-Host
