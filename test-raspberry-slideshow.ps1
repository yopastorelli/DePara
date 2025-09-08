# Script de teste para slideshow no Raspberry Pi
# Testa a API de listagem de imagens

Write-Host "🍓 Testando API de slideshow no Raspberry Pi..." -ForegroundColor Green
Write-Host "=" * 60

# URL da API (ajustar conforme necessário)
$apiUrl = "http://localhost:3000/api/files/list-images"

# Caminho de teste (ajustar conforme o caminho real no Raspberry Pi)
$testPath = "/mnt/lytspot/@SYNC@/_@@PICZ & VIDEOS LYT @@_/_@LYT PicZ por ANO@_/@Bfore 2001@"

Write-Host "🔗 URL da API: $apiUrl" -ForegroundColor Yellow
Write-Host "📁 Caminho de teste: $testPath" -ForegroundColor Yellow
Write-Host ""

# Dados da requisição
$body = @{
    folderPath = $testPath
    extensions = @(".jpg", ".jpeg", ".png", ".gif", ".bmp")
    recursive = $true
} | ConvertTo-Json

Write-Host "📤 Enviando requisição..." -ForegroundColor Cyan
Write-Host "📋 Dados: $body" -ForegroundColor Gray
Write-Host ""

try {
    # Fazer requisição para a API
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -ContentType "application/json" -Body $body
    
    Write-Host "✅ Resposta recebida!" -ForegroundColor Green
    Write-Host "📊 Resultado:" -ForegroundColor Yellow
    Write-Host "   - Sucesso: $($response.success)" -ForegroundColor White
    Write-Host "   - Total de imagens: $($response.data.totalCount)" -ForegroundColor White
    Write-Host "   - Caminho processado: $($response.data.folderPath)" -ForegroundColor White
    
    if ($response.data.totalCount -gt 0) {
        Write-Host "📸 Primeiras imagens encontradas:" -ForegroundColor Green
        $response.data.images | Select-Object -First 5 | ForEach-Object {
            Write-Host "   - $($_.name) ($($_.extension), $($_.size) bytes)" -ForegroundColor White
        }
    } else {
        Write-Host "⚠️  Nenhuma imagem encontrada!" -ForegroundColor Red
        Write-Host "🔍 Verifique se o caminho existe e contém imagens" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Erro na requisição:" -ForegroundColor Red
    Write-Host "   - Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "   - Mensagem: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   - Resposta: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🏁 Teste concluído!" -ForegroundColor Green
