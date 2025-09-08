# Script para monitorar logs do DePara em tempo real
# Mostra logs relacionados ao slideshow

Write-Host "🔍 Monitorando logs do DePara..." -ForegroundColor Green
Write-Host "📁 Caminho do log: logs/app.log" -ForegroundColor Yellow
Write-Host "⏹️  Pressione Ctrl+C para parar" -ForegroundColor Red
Write-Host "=" * 80

# Verificar se o arquivo de log existe
if (Test-Path "logs/app.log") {
    # Usar Get-Content com -Wait para monitorar em tempo real
    Get-Content "logs/app.log" -Wait -Tail 20 | Where-Object { 
        $_ -match "slideshow|list-images|imagem|image|📸|🔍|📁|📄|✅|❌" 
    }
} else {
    Write-Host "❌ Arquivo de log não encontrado: logs/app.log" -ForegroundColor Red
    Write-Host "🔧 Criando diretório de logs..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "logs" -Force | Out-Null
    Write-Host "✅ Diretório criado. Execute o servidor novamente." -ForegroundColor Green
}
