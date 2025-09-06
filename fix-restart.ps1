# Script simples para corrigir problema de reinicialização
Write-Host "🔧 Corrigindo problema de reinicialização..." -ForegroundColor Blue

# Verificar se DePara está rodando
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*main.js*" }

if ($nodeProcesses) {
    Write-Host "✅ DePara está rodando (PID: $($nodeProcesses.Id))" -ForegroundColor Green
} else {
    Write-Host "⚠️ DePara não está rodando" -ForegroundColor Yellow
}

# Atualizar rota de reinicialização
if (Test-Path "src/routes/update.js") {
    Write-Host "🔧 Atualizando rota de reinicialização..." -ForegroundColor Yellow
    
    # Fazer backup
    Copy-Item "src/routes/update.js" "src/routes/update.js.backup"
    
    # Ler e atualizar arquivo
    $content = Get-Content "src/routes/update.js" -Raw
    $newContent = $content -replace 'exec\(''nohup npm start > /dev/null 2>&1 &''', 'exec(''npm start'')'
    $newContent | Out-File -FilePath "src/routes/update.js" -Encoding UTF8
    
    Write-Host "✅ Rota de reinicialização atualizada" -ForegroundColor Green
}

Write-Host "🎉 Correção aplicada!" -ForegroundColor Green
Write-Host "🌐 Acesse: http://localhost:3000" -ForegroundColor Blue
