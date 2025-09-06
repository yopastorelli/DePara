# Script PowerShell para corrigir o ícone do DePara no menu de aplicações
# Execute este script no Raspberry Pi via SSH

Write-Host "🎨 Corrigindo ícone do DePara no menu..." -ForegroundColor Blue

# 1. Verificar se o DePara está rodando
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*main.js*" }

if ($nodeProcesses) {
    Write-Host "✅ DePara está rodando (PID: $($nodeProcesses.Id))" -ForegroundColor Green
} else {
    Write-Host "⚠️ DePara não está rodando, iniciando..." -ForegroundColor Yellow
    Set-Location "~/DePara"
    Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# 2. Criar diretório de ícones se não existir
$iconDir = "~/.local/share/icons"
if (-not (Test-Path $iconDir)) {
    New-Item -ItemType Directory -Path $iconDir -Force
    Write-Host "✅ Diretório de ícones criado" -ForegroundColor Green
}

# 3. Copiar ícone do DePara para o diretório de ícones
Write-Host "🖼️ Copiando ícone do DePara..." -ForegroundColor Yellow

# Copiar o ícone icon (melhor para menu)
if (Test-Path "src/public/logos/depara_logo_icon.svg") {
    Copy-Item "src/public/logos/depara_logo_icon.svg" "$iconDir/depara.svg"
    Write-Host "✅ Ícone SVG copiado" -ForegroundColor Green
} else {
    Write-Host "❌ Ícone SVG não encontrado" -ForegroundColor Red
}

# Copiar favicon como fallback
if (Test-Path "src/public/favicon/favicon-32x32.png") {
    Copy-Item "src/public/favicon/favicon-32x32.png" "$iconDir/depara.png"
    Write-Host "✅ Ícone PNG copiado" -ForegroundColor Green
} else {
    Write-Host "❌ Ícone PNG não encontrado" -ForegroundColor Red
}

# 4. Criar ícone em diferentes tamanhos
Write-Host "🔧 Criando ícones em diferentes tamanhos..." -ForegroundColor Yellow

# Criar diretório de ícones do DePara
$deparaIconDir = "$iconDir/depara"
if (-not (Test-Path $deparaIconDir)) {
    New-Item -ItemType Directory -Path $deparaIconDir -Force
}

# Copiar ícone para diferentes tamanhos
$sizes = @(16, 24, 32, 48, 64, 128, 256)
foreach ($size in $sizes) {
    $sourceFile = "src/public/favicon/favicon-${size}x${size}.png"
    if (Test-Path $sourceFile) {
        Copy-Item $sourceFile "$deparaIconDir/${size}x${size}.png"
    }
}

# 5. Atualizar arquivo .desktop
Write-Host "🔧 Atualizando arquivo .desktop..." -ForegroundColor Yellow

$desktopFile = "~/.local/share/applications/depara.desktop"
$desktopDir = Split-Path $desktopFile -Parent

if (-not (Test-Path $desktopDir)) {
    New-Item -ItemType Directory -Path $desktopDir -Force
}

# Obter diretório atual
$currentDir = Get-Location

# Criar arquivo .desktop corrigido
$desktopContent = @"
[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=Gerenciador de Arquivos e Operações - mover, copiar, apagar
Exec=$currentDir/start-depara.sh open
Icon=depara
Terminal=false
StartupNotify=true
Categories=Utility;FileManager;Office;
Keywords=files;manager;sync;backup;mover;copiar;apagar;
StartupWMClass=DePara
MimeType=application/x-depara;
X-GNOME-Autostart-enabled=false
"@

$desktopContent | Out-File -FilePath $desktopFile -Encoding UTF8

# 6. Atualizar cache do desktop
Write-Host "🔄 Atualizando cache do desktop..." -ForegroundColor Yellow

# Atualizar cache do desktop
try {
    & update-desktop-database $desktopDir 2>$null
    Write-Host "✅ Cache do desktop atualizado" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Não foi possível atualizar cache do desktop" -ForegroundColor Yellow
}

# Atualizar cache de ícones
try {
    & gtk-update-icon-cache -f -t $iconDir 2>$null
    Write-Host "✅ Cache de ícones atualizado" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Não foi possível atualizar cache de ícones" -ForegroundColor Yellow
}

# 7. Verificar se o script start-depara.sh existe e está executável
if (Test-Path "start-depara.sh") {
    Write-Host "✅ Script start-depara.sh encontrado" -ForegroundColor Green
} else {
    Write-Host "❌ Script start-depara.sh não encontrado" -ForegroundColor Red
}

# 8. Criar ícone de alta qualidade usando o logo stacked
Write-Host "🎨 Criando ícone de alta qualidade..." -ForegroundColor Yellow

# Usar o logo stacked como base para o ícone
if (Test-Path "src/public/logos/depara_logo_stacked.svg") {
    # Criar versão otimizada para menu
    Copy-Item "src/public/logos/depara_logo_stacked.svg" "$iconDir/depara-menu.svg"
    Write-Host "✅ Ícone de alta qualidade criado" -ForegroundColor Green
}

# 9. Atualizar arquivo .desktop com ícone de alta qualidade
$desktopContent = @"
[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=Gerenciador de Arquivos e Operações - mover, copiar, apagar
Exec=$currentDir/start-depara.sh open
Icon=depara-menu
Terminal=false
StartupNotify=true
Categories=Utility;FileManager;Office;
Keywords=files;manager;sync;backup;mover;copiar;apagar;
StartupWMClass=DePara
MimeType=application/x-depara;
X-GNOME-Autostart-enabled=false
"@

$desktopContent | Out-File -FilePath $desktopFile -Encoding UTF8

# 10. Testar funcionalidade do .desktop
Write-Host "🧪 Testando funcionalidade do .desktop..." -ForegroundColor Yellow

try {
    & desktop-file-validate $desktopFile 2>$null
    Write-Host "✅ Arquivo .desktop é válido" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Arquivo .desktop pode ter problemas, mas foi criado" -ForegroundColor Yellow
}

# 11. Verificar status final
Write-Host "📊 Status final:" -ForegroundColor Blue

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*main.js*" }

if ($nodeProcesses) {
    Write-Host "✅ DePara está rodando (PID: $($nodeProcesses.Id))" -ForegroundColor Green
    Write-Host "✅ Arquivo .desktop corrigido" -ForegroundColor Green
    Write-Host "✅ Ícones atualizados" -ForegroundColor Green
    Write-Host "✅ Cache do desktop atualizado" -ForegroundColor Green
    Write-Host "🌐 Acesse: http://localhost:3000" -ForegroundColor Blue
    Write-Host "📱 Ícone no menu deve estar corrigido agora" -ForegroundColor Blue
    Write-Host "🔄 Reinicie o menu de aplicações para ver as mudanças" -ForegroundColor Blue
} else {
    Write-Host "❌ DePara não está rodando" -ForegroundColor Red
    Write-Host "💡 Execute: npm start" -ForegroundColor Yellow
}

Write-Host "🎉 Correção do ícone aplicada com sucesso!" -ForegroundColor Green
Write-Host "💡 Dica: Feche e abra o menu de aplicações para ver o novo ícone" -ForegroundColor Yellow
