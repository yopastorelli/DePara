#!/bin/bash

# Script para remover modal antigo do slideshow
# Autor: yopastorelli
# Versão: 1.0.0

echo "🗑️ Removendo modal antigo do slideshow..."

# 1. Verificar se o DePara está rodando
echo "🔍 Verificando se o DePara está rodando..."
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ DePara não está rodando. Iniciando..."
    cd ~/DePara
    npm start &
    sleep 5
fi

# 2. Aguardar API estar disponível
echo "⏳ Aguardando API estar disponível..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null; then
        echo "✅ API disponível!"
        break
    fi
    echo "⏳ Aguardando... ($i/30)"
    sleep 1
done

# 3. Criar script para remover modal antigo
echo "📝 Criando script para remover modal antigo..."
cat > /home/yo/DePara/remove-old-modal.js << 'EOF'
// Script para remover modal antigo do slideshow
console.log('🗑️ Removendo modal antigo do slideshow...');

// Aguardar DeParaUI estar disponível
function waitForDeParaUI() {
    return new Promise((resolve) => {
        const check = () => {
            if (typeof window.deParaUI !== 'undefined') {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

async function removeOldModal() {
    await waitForDeParaUI();
    
    console.log('✅ DeParaUI encontrada');
    
    // 1. Remover modal antigo do DOM
    const oldModal = document.getElementById('slideshow-folder-modal');
    if (oldModal) {
        oldModal.remove();
        console.log('✅ Modal antigo removido do DOM');
    } else {
        console.log('ℹ️ Modal antigo não encontrado no DOM');
    }
    
    // 2. Sobrescrever função global para usar modal novo
    window.showSlideshowModal = function() {
        console.log('🎬 Redirecionando para modal novo...');
        if (window.deParaUI) {
            window.deParaUI.showSlideshowModal();
        } else {
            console.error('❌ DeParaUI não encontrada');
        }
    };
    
    // 3. Verificar se o botão está funcionando
    const slideshowCard = document.querySelector('.action-slideshow-card');
    if (slideshowCard) {
        console.log('✅ Botão do slideshow encontrado');
        
        // Remover event listeners antigos
        slideshowCard.onclick = null;
        
        // Adicionar novo event listener
        slideshowCard.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🎬 Botão clicado, abrindo modal novo...');
            window.deParaUI.showSlideshowModal();
        });
        
        console.log('🔧 Event listener atualizado');
    } else {
        console.error('❌ Botão do slideshow não encontrado');
    }
    
    // 4. Testar abertura do modal
    console.log('🧪 Testando abertura do modal...');
    window.deParaUI.showSlideshowModal();
    
    setTimeout(() => {
        const newModal = document.getElementById('slideshow-config-modal');
        
        if (newModal && newModal.style.display !== 'none') {
            console.log('✅ Modal novo aberto com sucesso!');
            console.log('📋 Configurações disponíveis:');
            console.log('  - Intervalo:', document.getElementById('slideshow-interval').value);
            console.log('  - Aleatório:', document.getElementById('slideshow-random').checked);
            console.log('  - Pré-carregar:', document.getElementById('slideshow-preload').checked);
            console.log('  - Recursivo:', document.getElementById('slideshow-recursive').checked);
            
            // Fechar modal
            window.deParaUI.closeSlideshowModal();
        } else {
            console.error('❌ Modal novo não foi aberto');
        }
    }, 1000);
    
    console.log('🎉 Modal antigo removido e modal novo configurado!');
}

// Executar
removeOldModal().catch(console.error);
EOF

echo "✅ Script criado!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Cole o conteúdo do arquivo remove-old-modal.js no console do navegador"
echo "🎬 Isso vai remover o modal antigo e forçar o uso do novo!"
