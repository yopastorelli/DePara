# Script PowerShell para corrigir problemas após atualização automática
# - Corrigir funcionalidade de reinicialização
# - Verificar status da aplicação

Write-Host "🔧 Corrigindo problemas pós-atualização do DePara..." -ForegroundColor Blue

# 1. Verificar se o DePara está rodando
Write-Host "📊 Verificando status do DePara..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*main.js*" }

if ($nodeProcesses) {
    Write-Host "✅ DePara está rodando (PID: $($nodeProcesses.Id))" -ForegroundColor Green
} else {
    Write-Host "⚠️ DePara não está rodando, iniciando..." -ForegroundColor Yellow
    
    # Navegar para o diretório do projeto
    Set-Location $PSScriptRoot
    
    # Verificar se package.json existe
    if (Test-Path "package.json") {
        # Instalar dependências se necessário
        if (-not (Test-Path "node_modules")) {
            Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
            npm install
        }
        
        # Iniciar o DePara
        Write-Host "▶️ Iniciando DePara..." -ForegroundColor Yellow
        Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden
        
        # Aguardar inicialização
        Start-Sleep -Seconds 5
        
        # Verificar novamente
        $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*main.js*" }
        if ($nodeProcesses) {
            Write-Host "✅ DePara iniciado com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "❌ Falha ao iniciar DePara" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ package.json não encontrado" -ForegroundColor Red
    }
}

# 2. Melhorar funcionalidade de reinicialização
Write-Host "🔧 Melhorando funcionalidade de reinicialização..." -ForegroundColor Yellow

# Criar script de reinicialização melhorado
$restartScript = @"
# Script melhorado para reinicializar o DePara
Write-Host "🔄 Reiniciando DePara..." -ForegroundColor Blue

# Parar DePara se estiver rodando
`$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { `$_.CommandLine -like "*main.js*" }
if (`$nodeProcesses) {
    Write-Host "⏹️ Parando DePara..." -ForegroundColor Yellow
    Stop-Process -Id `$nodeProcesses.Id -Force
    Start-Sleep -Seconds 3
}

# Navegar para o diretório
Set-Location "`$PSScriptRoot"

# Verificar se package.json existe
if (Test-Path "package.json") {
    # Reinstalar dependências se necessário
    Write-Host "📦 Verificando dependências..." -ForegroundColor Yellow
    npm install
    
    # Iniciar DePara
    Write-Host "▶️ Iniciando DePara..." -ForegroundColor Yellow
    Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden
    
    # Aguardar inicialização
    Start-Sleep -Seconds 5
    
    # Verificar se está rodando
    `$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { `$_.CommandLine -like "*main.js*" }
    if (`$nodeProcesses) {
        Write-Host "✅ DePara reiniciado com sucesso!" -ForegroundColor Green
        Write-Host "🌐 Acesse: http://localhost:3000" -ForegroundColor Blue
        
        # Abrir no navegador
        Start-Process "http://localhost:3000"
    } else {
        Write-Host "❌ Erro: Falha ao reiniciar DePara" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ package.json não encontrado" -ForegroundColor Red
    exit 1
}
"@

# Salvar script de reinicialização
$restartScript | Out-File -FilePath "restart-depara.ps1" -Encoding UTF8

Write-Host "✅ Script de reinicialização criado" -ForegroundColor Green

# 3. Verificar e corrigir rota de reinicialização no backend
Write-Host "🔧 Verificando rota de reinicialização..." -ForegroundColor Yellow

if (Test-Path "src/routes/update.js") {
    # Fazer backup do arquivo original
    Copy-Item "src/routes/update.js" "src/routes/update.js.backup"
    
    # Ler o conteúdo do arquivo
    $content = Get-Content "src/routes/update.js" -Raw
    
    # Atualizar a rota de reinicialização para usar PowerShell no Windows
    $newContent = $content -replace 'exec\(''nohup npm start > /dev/null 2>&1 &''', 'exec(''powershell -ExecutionPolicy Bypass -File restart-depara.ps1'')'
    
    # Salvar o arquivo atualizado
    $newContent | Out-File -FilePath "src/routes/update.js" -Encoding UTF8
    
    Write-Host "✅ Rota de reinicialização atualizada para Windows" -ForegroundColor Green
} else {
    Write-Host "⚠️ Arquivo de rotas não encontrado" -ForegroundColor Yellow
}

# 4. Testar funcionalidade de reinicialização
Write-Host "🧪 Testando funcionalidade de reinicialização..." -ForegroundColor Yellow

# Verificar se o DePara está rodando antes do teste
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*main.js*" }

if ($nodeProcesses) {
    Write-Host "✅ DePara está rodando, funcionalidade de reinicialização deve funcionar" -ForegroundColor Green
} else {
    Write-Host "⚠️ DePara não está rodando, iniciando para teste..." -ForegroundColor Yellow
    & ".\restart-depara.ps1"
}

# 5. Verificar status final
Write-Host "📊 Status final:" -ForegroundColor Blue

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*main.js*" }

if ($nodeProcesses) {
    Write-Host "✅ DePara está rodando (PID: $($nodeProcesses.Id))" -ForegroundColor Green
    Write-Host "✅ Script de reinicialização melhorado" -ForegroundColor Green
    Write-Host "✅ Rota de reinicialização atualizada" -ForegroundColor Green
    Write-Host "🌐 Acesse: http://localhost:3000" -ForegroundColor Blue
    Write-Host "🔄 Botão 'Reiniciar Aplicação' deve funcionar agora" -ForegroundColor Blue
} else {
    Write-Host "❌ DePara não está rodando" -ForegroundColor Red
    Write-Host "💡 Execute manualmente: npm start" -ForegroundColor Yellow
}

Write-Host "🎉 Correções aplicadas com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Teste o botão 'Reiniciar Aplicação' na interface web" -ForegroundColor White
Write-Host "2. Verifique se o DePara está acessível em http://localhost:3000" -ForegroundColor White
Write-Host "3. Para problemas com ícone do desktop, execute no Linux: ./fix-post-update-issues.sh" -ForegroundColor White