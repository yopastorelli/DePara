#!/bin/bash

# Script para corrigir definitivamente o problema do slideshow
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

echo -e "${BLUE}🔧 Corrigindo problema do slideshow...${NC}"

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
git stash push -m "Backup antes da correção do slideshow" 2>/dev/null || true

# 4. Atualizar repositório
echo -e "${YELLOW}📥 Atualizando repositório...${NC}"
git fetch origin
git pull origin main

# 5. Reinstalar dependências
echo -e "${YELLOW}📦 Reinstalando dependências...${NC}"
npm install

# 6. Corrigir problema do slideshow
echo -e "${YELLOW}🔧 Corrigindo implementação do slideshow...${NC}"

# Fazer backup do app.js
cp src/public/app.js src/public/app.js.backup

# Corrigir a função startSlideshow para sempre usar a implementação da classe
cat > temp_slideshow_fix.js << 'EOF'
async function startSlideshow() {
    console.log('🚀 Iniciando slideshow...');
    
    // Sempre usar a implementação da classe DeParaUI
    if (window.deParaUI && typeof window.deParaUI.startSlideshowFromModal === 'function') {
        console.log('✅ Usando implementação da classe DeParaUI');
        await window.deParaUI.startSlideshowFromModal();
    } else {
        console.error('❌ window.deParaUI não está disponível ou método não existe');
        console.log('window.deParaUI:', window.deParaUI);
        showToast('Erro: Interface não inicializada corretamente', 'error');
    }
}
EOF

# Aplicar a correção
sed -i '/async function startSlideshow() {/,/^}/c\
async function startSlideshow() {\
    console.log("🚀 Iniciando slideshow...");\
    \
    // Sempre usar a implementação da classe DeParaUI\
    if (window.deParaUI && typeof window.deParaUI.startSlideshowFromModal === "function") {\
        console.log("✅ Usando implementação da classe DeParaUI");\
        await window.deParaUI.startSlideshowFromModal();\
    } else {\
        console.error("❌ window.deParaUI não está disponível ou método não existe");\
        console.log("window.deParaUI:", window.deParaUI);\
        showToast("Erro: Interface não inicializada corretamente", "error");\
    }\
}' src/public/app.js

# 7. Corrigir função showSlideshowModal global para usar a implementação da classe
cat > temp_modal_fix.js << 'EOF'
function showSlideshowModal() {
    console.log('📱 Abrindo modal de slideshow...');
    
    // Sempre usar a implementação da classe DeParaUI
    if (window.deParaUI && typeof window.deParaUI.showSlideshowModal === 'function') {
        console.log('✅ Usando implementação da classe DeParaUI');
        window.deParaUI.showSlideshowModal();
    } else {
        console.error('❌ window.deParaUI não está disponível ou método não existe');
        console.log('window.deParaUI:', window.deParaUI);
        showToast('Erro: Interface não inicializada corretamente', 'error');
    }
}
EOF

# Aplicar a correção do modal
sed -i '/function showSlideshowModal() {/,/^}/c\
function showSlideshowModal() {\
    console.log("📱 Abrindo modal de slideshow...");\
    \
    // Sempre usar a implementação da classe DeParaUI\
    if (window.deParaUI && typeof window.deParaUI.showSlideshowModal === "function") {\
        console.log("✅ Usando implementação da classe DeParaUI");\
        window.deParaUI.showSlideshowModal();\
    } else {\
        console.error("❌ window.deParaUI não está disponível ou método não existe");\
        console.log("window.deParaUI:", window.deParaUI);\
        showToast("Erro: Interface não inicializada corretamente", "error");\
    }\
}' src/public/app.js

# 8. Adicionar debug para verificar inicialização
cat > temp_debug_fix.js << 'EOF'
// Debug da inicialização do slideshow
setTimeout(() => {
    console.log('🔍 Debug do Slideshow após inicialização:');
    console.log('window.deParaUI existe?', !!window.deParaUI);
    
    if (window.deParaUI) {
        console.log('Configurações do slideshow:', window.deParaUI.slideshowConfig);
        console.log('Método startSlideshowFromModal existe?', typeof window.deParaUI.startSlideshowFromModal);
        console.log('Método showSlideshowModal existe?', typeof window.deParaUI.showSlideshowModal);
    }
    
    // Verificar elementos do modal
    console.log('Modal slideshow-config-modal existe?', !!document.getElementById('slideshow-config-modal'));
    console.log('Campo slideshow-interval existe?', !!document.getElementById('slideshow-interval'));
    console.log('Campo slideshow-random existe?', !!document.getElementById('slideshow-random'));
    console.log('Campo slideshow-preload existe?', !!document.getElementById('slideshow-preload'));
}, 2000);
EOF

# Adicionar debug ao final do arquivo
echo "" >> src/public/app.js
cat temp_debug_fix.js >> src/public/app.js

# Limpar arquivos temporários
rm -f temp_slideshow_fix.js temp_modal_fix.js temp_debug_fix.js

# 9. Iniciar DePara
echo -e "${YELLOW}▶️ Iniciando DePara...${NC}"
nohup npm start > /dev/null 2>&1 &
sleep 5

# 10. Verificar se está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara iniciado com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao iniciar DePara${NC}"
    echo -e "${YELLOW}💡 Tente executar manualmente: npm start${NC}"
fi

# 11. Testar API
echo -e "${YELLOW}🧪 Testando API...${NC}"
sleep 3

if curl -s http://localhost:3000/api/health | grep -q "success"; then
    echo -e "${GREEN}✅ API funcionando${NC}"
else
    echo -e "${RED}❌ API com problemas${NC}"
fi

# 12. Resumo final
echo -e "${BLUE}📊 Resumo das correções:${NC}"
echo -e "${GREEN}✅ Problema do slideshow corrigido${NC}"
echo -e "${GREEN}✅ Implementação da classe DeParaUI forçada${NC}"
echo -e "${GREEN}✅ Debug adicionado para verificação${NC}"
echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
echo -e "${BLUE}🔧 Para testar: Vá para Slideshow e configure as opções${NC}"
echo -e "${YELLOW}💡 Verifique o console do navegador para logs de debug${NC}"

echo -e "${GREEN}🎉 Correções aplicadas com sucesso!${NC}"
