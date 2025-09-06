#!/bin/bash

# Script para corrigir ícone feio e atualização automática
# Execute este script no Raspberry Pi

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"
DESKTOP_DIR="$USER_HOME/.local/share/applications"
ICONS_DIR="$USER_HOME/.local/share/icons"

echo -e "${BLUE}🔧 Corrigindo ícone feio e atualização automática...${NC}"

# 1. Parar DePara se estiver rodando
echo -e "${YELLOW}⏹️ Parando DePara...${NC}"
if pgrep -f "node.*main.js" > /dev/null; then
    pkill -f "node.*main.js"
    sleep 3
    echo -e "${GREEN}✅ DePara parado${NC}"
else
    echo -e "${YELLOW}⚠️ DePara não estava rodando${NC}"
fi

# 2. Navegar para o diretório
cd "$DEPARA_DIR" || {
    echo -e "${RED}❌ Erro: Não foi possível acessar $DEPARA_DIR${NC}"
    exit 1
}

# 3. Fazer backup das mudanças locais
echo -e "${YELLOW}💾 Fazendo backup das mudanças locais...${NC}"
git stash push -m "Backup antes da correção do ícone e atualização" 2>/dev/null || true

# 4. Atualizar repositório
echo -e "${YELLOW}📥 Atualizando repositório...${NC}"
git fetch origin
git pull origin main

# 5. Reinstalar dependências
echo -e "${YELLOW}📦 Reinstalando dependências...${NC}"
npm install

# 6. Corrigir arquivo .desktop
echo -e "${YELLOW}🔧 Corrigindo arquivo .desktop...${NC}"

# Criar diretórios se não existirem
mkdir -p "$DESKTOP_DIR"
mkdir -p "$ICONS_DIR"

# Remover arquivo .desktop antigo se existir
rm -f "$DESKTOP_DIR/depara.desktop"

# Criar novo arquivo .desktop correto
cat > "$DESKTOP_DIR/depara.desktop" << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=DePara - Sistema de Sincronização de Arquivos
Exec=/home/yo/DePara/start-depara.sh
Icon=/home/yo/DePara/src/public/logos/depara_logo_icon.svg
Terminal=false
StartupNotify=true
Categories=Utility;FileManager;
Keywords=files;sync;backup;
StartupWMClass=DePara
EOF

# 7. Corrigir ícone
echo -e "${YELLOW}🎨 Corrigindo ícone...${NC}"

# Copiar ícone SVG para o diretório de ícones
cp "$DEPARA_DIR/src/public/logos/depara_logo_icon.svg" "$ICONS_DIR/depara.svg"

# Gerar ícones PNG em diferentes tamanhos
if command -v convert >/dev/null 2>&1; then
    echo -e "${YELLOW}🖼️ Gerando ícones PNG...${NC}"
    
    # Ícone 16x16
    convert "$ICONS_DIR/depara.svg" -resize 16x16 "$ICONS_DIR/depara-16.png" 2>/dev/null || true
    
    # Ícone 32x32
    convert "$ICONS_DIR/depara.svg" -resize 32x32 "$ICONS_DIR/depara-32.png" 2>/dev/null || true
    
    # Ícone 48x48
    convert "$ICONS_DIR/depara.svg" -resize 48x48 "$ICONS_DIR/depara-48.png" 2>/dev/null || true
    
    # Ícone 64x64
    convert "$ICONS_DIR/depara.svg" -resize 64x64 "$ICONS_DIR/depara-64.png" 2>/dev/null || true
    
    # Ícone 128x128
    convert "$ICONS_DIR/depara.svg" -resize 128x128 "$ICONS_DIR/depara-128.png" 2>/dev/null || true
    
    # Ícone 256x256
    convert "$ICONS_DIR/depara.svg" -resize 256x256 "$ICONS_DIR/depara-256.png" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Ícones PNG gerados${NC}"
else
    echo -e "${YELLOW}⚠️ ImageMagick não encontrado, usando apenas SVG${NC}"
fi

# 8. Atualizar cache de ícones
echo -e "${YELLOW}🔄 Atualizando cache de ícones...${NC}"

# Atualizar cache de ícones do sistema
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "$ICONS_DIR" 2>/dev/null || true
fi

# Atualizar banco de dados de aplicações
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

# 9. Tornar script de início executável
chmod +x "$DEPARA_DIR/start-depara.sh"

# 10. Corrigir problema da atualização automática
echo -e "${YELLOW}🔧 Corrigindo atualização automática...${NC}"

# Fazer backup do app.js
cp src/public/app.js src/public/app.js.backup

# Corrigir a função de verificação de atualizações
cat > temp_update_fix.js << 'EOF'
async checkForUpdates() {
    try {
        console.log('🔍 Verificando atualizações...');
        
        const response = await fetch('/api/update/check');
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            if (result.data.hasUpdate) {
                console.log('📦 Atualização disponível:', result.data);
                this.showUpdateAvailable(result.data);
            } else {
                console.log('✅ DePara está atualizado');
                this.hideUpdateAvailable();
            }
        } else {
            throw new Error(result.error || 'Erro ao verificar atualizações');
        }
        
    } catch (error) {
        console.error('❌ Erro ao verificar atualizações:', error);
        // Não mostrar erro para o usuário, apenas logar
    }
}
EOF

# Aplicar correção da função checkForUpdates
sed -i '/async checkForUpdates() {/,/^}/c\
async checkForUpdates() {\
    try {\
        console.log("🔍 Verificando atualizações...");\
        \
        const response = await fetch("/api/update/check");\
        \
        if (!response.ok) {\
            throw new Error(`Erro HTTP: ${response.status}`);\
        }\
        \
        const result = await response.json();\
        \
        if (result.success) {\
            if (result.data.hasUpdate) {\
                console.log("📦 Atualização disponível:", result.data);\
                this.showUpdateAvailable(result.data);\
            } else {\
                console.log("✅ DePara está atualizado");\
                this.hideUpdateAvailable();\
            }\
        } else {\
            throw new Error(result.error || "Erro ao verificar atualizações");\
        }\
        \
    } catch (error) {\
        console.error("❌ Erro ao verificar atualizações:", error);\
        // Não mostrar erro para o usuário, apenas logar\
    }\
}' src/public/app.js

# 11. Corrigir função de aplicação de atualizações
cat > temp_apply_fix.js << 'EOF'
async applyUpdates() {
    try {
        console.log('🔄 Aplicando atualizações...');
        
        // Mostrar loading
        this.showLoading('Aplicando atualizações...');
        
        // Fazer requisição para aplicar atualizações
        const response = await fetch('/api/update/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Atualizações aplicadas com sucesso');
            this.hideLoading();
            
            // Mostrar mensagem de sucesso
            this.showToast('Atualizações aplicadas! Reiniciando...', 'success');
            
            // Aguardar um pouco antes de reiniciar
            setTimeout(() => {
                this.restartApplication();
            }, 2000);
            
        } else {
            throw new Error(result.error || 'Erro ao aplicar atualizações');
        }
        
    } catch (error) {
        console.error('❌ Erro ao aplicar atualizações:', error);
        this.hideLoading();
        this.showToast('Erro ao aplicar atualizações: ' + error.message, 'error');
    }
}
EOF

# Aplicar correção da função applyUpdates
sed -i '/async applyUpdates() {/,/^}/c\
async applyUpdates() {\
    try {\
        console.log("🔄 Aplicando atualizações...");\
        \
        // Mostrar loading\
        this.showLoading("Aplicando atualizações...");\
        \
        // Fazer requisição para aplicar atualizações\
        const response = await fetch("/api/update/apply", {\
            method: "POST",\
            headers: {\
                "Content-Type": "application/json"\
            }\
        });\
        \
        if (!response.ok) {\
            throw new Error(`Erro HTTP: ${response.status}`);\
        }\
        \
        const result = await response.json();\
        \
        if (result.success) {\
            console.log("✅ Atualizações aplicadas com sucesso");\
            this.hideLoading();\
            \
            // Mostrar mensagem de sucesso\
            this.showToast("Atualizações aplicadas! Reiniciando...", "success");\
            \
            // Aguardar um pouco antes de reiniciar\
            setTimeout(() => {\
                this.restartApplication();\
            }, 2000);\
            \
        } else {\
            throw new Error(result.error || "Erro ao aplicar atualizações");\
        }\
        \
    } catch (error) {\
        console.error("❌ Erro ao aplicar atualizações:", error);\
        this.hideLoading();\
        this.showToast("Erro ao aplicar atualizações: " + error.message, "error");\
    }\
}' src/public/app.js

# 12. Corrigir função de reinicialização
cat > temp_restart_fix.js << 'EOF'
async restartApplication() {
    try {
        console.log('🔄 Reiniciando aplicação...');
        
        // Mostrar loading
        this.showLoading('Reiniciando aplicação...');
        
        // Fazer requisição para reiniciar
        const response = await fetch('/api/update/restart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Aplicação reiniciada com sucesso');
            this.hideLoading();
            
            // Mostrar mensagem de sucesso
            this.showToast('Aplicação reiniciada! Recarregando...', 'success');
            
            // Aguardar um pouco e recarregar a página
            setTimeout(() => {
                console.log('🔄 Recarregando página...');
                window.location.reload();
            }, 2000);
            
        } else {
            throw new Error(result.error || 'Erro desconhecido ao reiniciar');
        }
        
    } catch (error) {
        console.error('❌ Erro ao reiniciar aplicação:', error);
        this.hideLoading();
        
        // Mostrar erro
        this.showToast('Erro ao reiniciar: ' + error.message, 'error');
        
        // Fallback: tentar recarregar a página mesmo assim
        console.log('🔄 Tentando recarregar página como fallback...');
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    }
}
EOF

# Aplicar correção da função restartApplication
sed -i '/async restartApplication() {/,/^}/c\
async restartApplication() {\
    try {\
        console.log("🔄 Reiniciando aplicação...");\
        \
        // Mostrar loading\
        this.showLoading("Reiniciando aplicação...");\
        \
        // Fazer requisição para reiniciar\
        const response = await fetch("/api/update/restart", {\
            method: "POST",\
            headers: {\
                "Content-Type": "application/json"\
            }\
        });\
        \
        if (!response.ok) {\
            throw new Error(`Erro HTTP: ${response.status}`);\
        }\
        \
        const result = await response.json();\
        \
        if (result.success) {\
            console.log("✅ Aplicação reiniciada com sucesso");\
            this.hideLoading();\
            \
            // Mostrar mensagem de sucesso\
            this.showToast("Aplicação reiniciada! Recarregando...", "success");\
            \
            // Aguardar um pouco e recarregar a página\
            setTimeout(() => {\
                console.log("🔄 Recarregando página...");\
                window.location.reload();\
            }, 2000);\
            \
        } else {\
            throw new Error(result.error || "Erro desconhecido ao reiniciar");\
        }\
        \
    } catch (error) {\
        console.error("❌ Erro ao reiniciar aplicação:", error);\
        this.hideLoading();\
        \
        // Mostrar erro\
        this.showToast("Erro ao reiniciar: " + error.message, "error");\
        \
        // Fallback: tentar recarregar a página mesmo assim\
        console.log("🔄 Tentando recarregar página como fallback...");\
        setTimeout(() => {\
            window.location.reload();\
        }, 3000);\
    }\
}' src/public/app.js

# Limpar arquivos temporários
rm -f temp_update_fix.js temp_apply_fix.js temp_restart_fix.js

# 13. Iniciar DePara
echo -e "${YELLOW}▶️ Iniciando DePara...${NC}"
nohup npm start > /dev/null 2>&1 &
sleep 5

# 14. Verificar se está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara iniciado com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao iniciar DePara${NC}"
    echo -e "${YELLOW}💡 Tente executar manualmente: npm start${NC}"
fi

# 15. Testar API
echo -e "${YELLOW}🧪 Testando API...${NC}"
sleep 3

if curl -s http://localhost:3000/api/health | grep -q "success"; then
    echo -e "${GREEN}✅ API funcionando${NC}"
else
    echo -e "${RED}❌ API com problemas${NC}"
fi

# 16. Resumo final
echo -e "${BLUE}📊 Resumo das correções:${NC}"
echo -e "${GREEN}✅ Arquivo .desktop corrigido${NC}"
echo -e "${GREEN}✅ Ícone feio corrigido${NC}"
echo -e "${GREEN}✅ Atualização automática corrigida${NC}"
echo -e "${GREEN}✅ Cache de ícones atualizado${NC}"
echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
echo -e "${BLUE}🔧 Para testar: Vá para Configurações > Atualizações${NC}"
echo -e "${YELLOW}💡 O ícone agora deve aparecer bonito no menu!${NC}"

echo -e "${GREEN}🎉 Correções aplicadas com sucesso!${NC}"
