# Diagnóstico do Slideshow no Raspberry Pi
Write-Host "🔍 DIAGNÓSTICO COMPLETO DO SLIDESHOW NO RASPBERRY PI" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Verificar se está no diretório correto
Write-Host "📁 Diretório atual: $(Get-Location)" -ForegroundColor Yellow
Write-Host "📁 Conteúdo do diretório:" -ForegroundColor Yellow
Get-ChildItem | Format-Table Name, Length, LastWriteTime

# Verificar se o git está atualizado
Write-Host ""
Write-Host "🔄 Verificando atualizações do Git..." -ForegroundColor Yellow
git status
Write-Host ""
Write-Host "📥 Puxando últimas alterações..." -ForegroundColor Yellow
git pull origin main

# Verificar se o arquivo app.js foi atualizado
Write-Host ""
Write-Host "📄 Verificando timestamp do app.js:" -ForegroundColor Yellow
Get-ChildItem src/public/app.js | Format-Table Name, Length, LastWriteTime

# Verificar se há erros de sintaxe no JavaScript
Write-Host ""
Write-Host "🔍 Verificando sintaxe do JavaScript..." -ForegroundColor Yellow
try {
    node -c src/public/app.js
    Write-Host "✅ Sintaxe OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro de sintaxe" -ForegroundColor Red
}

# Verificar se o servidor está rodando
Write-Host ""
Write-Host "🌐 Verificando se o servidor está rodando..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5
    Write-Host "✅ API está respondendo (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ API não está respondendo" -ForegroundColor Red
}

# Verificar processos Node.js
Write-Host ""
Write-Host "🟢 Processos Node.js rodando:" -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Format-Table Id, ProcessName, CPU

Write-Host ""
Write-Host "🎯 DIAGNÓSTICO CONCLUÍDO!" -ForegroundColor Green
Write-Host "Execute este script no Raspberry Pi para diagnóstico completo." -ForegroundColor Yellow
