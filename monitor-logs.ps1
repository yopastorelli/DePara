$runtimeRoot = if ($env:DEPARA_RUNTIME_ROOT) {
    $env:DEPARA_RUNTIME_ROOT
} else {
    Join-Path $HOME '.depara'
}
$logDirectory = if ($env:DEPARA_LOG_DIR) {
    $env:DEPARA_LOG_DIR
} else {
    Join-Path $runtimeRoot 'logs'
}
$logFile = if ($env:LOG_FILE) {
    $env:LOG_FILE
} else {
    Join-Path $logDirectory 'app.log'
}

Write-Host "🔍 Monitorando logs do DePara..." -ForegroundColor Green
Write-Host "📁 Caminho do log: $logFile" -ForegroundColor Yellow
Write-Host "⏹️  Pressione Ctrl+C para parar" -ForegroundColor Red
Write-Host "=" * 80

# Verificar se o arquivo de log existe
if (Test-Path -LiteralPath $logFile) {
    # Usar Get-Content com -Wait para monitorar em tempo real
    Get-Content -LiteralPath $logFile -Wait -Tail 20 | Where-Object {
        $_ -match "slideshow|list-images|imagem|image|📸|🔍|📁|📄|✅|❌" 
    }
} else {
    Write-Host "❌ Arquivo de log não encontrado: $logFile" -ForegroundColor Red
    Write-Host "🔧 Criando diretório de logs..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path (Split-Path -Parent $logFile) -Force | Out-Null
    Write-Host "✅ Diretório criado. Execute o servidor novamente." -ForegroundColor Green
}
