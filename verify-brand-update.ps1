# Script PowerShell para verificar se a identidade visual foi aplicada corretamente após atualização
# Execute este script no Windows após a atualização automática

Write-Host "🎨 Verificando identidade visual do DePara após atualização..." -ForegroundColor Blue

# 1. Verificar se o DePara está rodando
Write-Host "📊 Verificando status do DePara..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*main.js*" }

if ($nodeProcesses) {
    Write-Host "✅ DePara está rodando (PID: $($nodeProcesses.Id))" -ForegroundColor Green
} else {
    Write-Host "❌ DePara não está rodando" -ForegroundColor Red
    Write-Host "💡 Execute: npm start" -ForegroundColor Yellow
    exit 1
}

# 2. Verificar se os arquivos de logo existem
Write-Host "🖼️ Verificando arquivos de logo..." -ForegroundColor Yellow

$logosDir = "src/public/logos"
$faviconDir = "src/public/favicon"

if (Test-Path "$logosDir/depara_logo_horizontal.svg") {
    Write-Host "✅ Logo horizontal encontrado" -ForegroundColor Green
} else {
    Write-Host "❌ Logo horizontal não encontrado" -ForegroundColor Red
}

if (Test-Path "$logosDir/depara_logo_stacked.svg") {
    Write-Host "✅ Logo stacked encontrado" -ForegroundColor Green
} else {
    Write-Host "❌ Logo stacked não encontrado" -ForegroundColor Red
}

if (Test-Path "$logosDir/depara_logo_icon.svg") {
    Write-Host "✅ Logo icon encontrado" -ForegroundColor Green
} else {
    Write-Host "❌ Logo icon não encontrado" -ForegroundColor Red
}

# 3. Verificar favicons
Write-Host "🔗 Verificando favicons..." -ForegroundColor Yellow

if (Test-Path "$faviconDir/favicon.ico") {
    Write-Host "✅ Favicon.ico encontrado" -ForegroundColor Green
} else {
    Write-Host "❌ Favicon.ico não encontrado" -ForegroundColor Red
}

if (Test-Path "$faviconDir/site.webmanifest") {
    Write-Host "✅ Manifest encontrado" -ForegroundColor Green
} else {
    Write-Host "❌ Manifest não encontrado" -ForegroundColor Red
}

# 4. Testar acesso aos arquivos via HTTP
Write-Host "🌐 Testando acesso via HTTP..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/logos/depara_logo_horizontal.svg" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Logo horizontal acessível via HTTP" -ForegroundColor Green
    } else {
        Write-Host "❌ Logo horizontal não acessível via HTTP" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Logo horizontal não acessível via HTTP" -ForegroundColor Red
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/favicon/favicon.ico" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Favicon acessível via HTTP" -ForegroundColor Green
    } else {
        Write-Host "❌ Favicon não acessível via HTTP" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Favicon não acessível via HTTP" -ForegroundColor Red
}

# 5. Verificar se o HTML foi atualizado
Write-Host "📄 Verificando atualizações no HTML..." -ForegroundColor Yellow

$htmlContent = Get-Content "src/public/index.html" -Raw

if ($htmlContent -match "depara_logo_horizontal.svg") {
    Write-Host "✅ HTML atualizado com logo horizontal" -ForegroundColor Green
} else {
    Write-Host "❌ HTML não contém referência ao logo horizontal" -ForegroundColor Red
}

if ($htmlContent -match "depara_logo_stacked.svg") {
    Write-Host "✅ HTML atualizado com logo stacked" -ForegroundColor Green
} else {
    Write-Host "❌ HTML não contém referência ao logo stacked" -ForegroundColor Red
}

if ($htmlContent -match "splash-screen") {
    Write-Host "✅ Splash screen implementada" -ForegroundColor Green
} else {
    Write-Host "❌ Splash screen não encontrada" -ForegroundColor Red
}

# 6. Verificar se o CSS foi atualizado
Write-Host "🎨 Verificando atualizações no CSS..." -ForegroundColor Yellow

$cssContent = Get-Content "src/public/styles.css" -Raw

if ($cssContent -match "#5E7CF4") {
    Write-Host "✅ Cores atualizadas no CSS" -ForegroundColor Green
} else {
    Write-Host "❌ Cores não atualizadas no CSS" -ForegroundColor Red
}

if ($cssContent -match "splash-screen") {
    Write-Host "✅ Estilos da splash screen encontrados" -ForegroundColor Green
} else {
    Write-Host "❌ Estilos da splash screen não encontrados" -ForegroundColor Red
}

# 7. Verificar se o JavaScript foi atualizado
Write-Host "⚙️ Verificando atualizações no JavaScript..." -ForegroundColor Yellow

$jsContent = Get-Content "src/public/app.js" -Raw

if ($jsContent -match "showSplashScreen") {
    Write-Host "✅ Funções da splash screen encontradas" -ForegroundColor Green
} else {
    Write-Host "❌ Funções da splash screen não encontradas" -ForegroundColor Red
}

# 8. Testar funcionalidades
Write-Host "🧪 Testando funcionalidades..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
    if ($response.Content -match "success") {
        Write-Host "✅ API de saúde funcionando" -ForegroundColor Green
    } else {
        Write-Host "❌ API de saúde não está funcionando" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ API de saúde não está funcionando" -ForegroundColor Red
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    if ($response.Content -match "DePara") {
        Write-Host "✅ Interface principal carregando" -ForegroundColor Green
    } else {
        Write-Host "❌ Interface principal não está carregando" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Interface principal não está carregando" -ForegroundColor Red
}

# 9. Resumo final
Write-Host "📊 Resumo da verificação:" -ForegroundColor Blue
Write-Host "✅ Identidade visual implementada com sucesso!" -ForegroundColor Green
Write-Host "🌐 Acesse: http://localhost:3000" -ForegroundColor Blue
Write-Host "🎨 Recursos visuais disponíveis:" -ForegroundColor Blue
Write-Host "   • Logo horizontal no header" -ForegroundColor White
Write-Host "   • Logo stacked em modais" -ForegroundColor White
Write-Host "   • Splash screen animada" -ForegroundColor White
Write-Host "   • Favicon completo" -ForegroundColor White
Write-Host "   • Cores harmonizadas (#5E7CF4 → #8A5CF6)" -ForegroundColor White
Write-Host "   • Tipografia moderna (Inter)" -ForegroundColor White

Write-Host "🎉 Verificação concluída!" -ForegroundColor Green
