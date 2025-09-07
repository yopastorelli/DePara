#!/bin/bash

# Script para corrigir slideshow completamente
# Autor: yopastorelli
# Versão: 1.0.0

echo "🎬 Corrigindo slideshow completamente..."

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

# 3. Criar script de teste do slideshow
echo "📝 Criando script de teste do slideshow..."
cat > /home/yo/DePara/test-slideshow-fix.js << 'EOF'
// Script para testar e corrigir slideshow
console.log('🎬 Testando slideshow...');

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

async function testSlideshow() {
    await waitForDeParaUI();
    
    console.log('✅ DeParaUI encontrada');
    
    // 1. Testar configurações
    console.log('🔧 Testando configurações...');
    window.deParaUI.loadSlideshowConfig();
    console.log('📋 Configurações atuais:', window.deParaUI.slideshowConfig);
    
    // 2. Testar elementos HTML
    console.log('🔍 Verificando elementos HTML...');
    const elements = [
        'slideshow-config-modal',
        'slideshow-interval',
        'slideshow-random',
        'slideshow-preload',
        'slideshow-recursive'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log('✅', id, 'encontrado');
        } else {
            console.error('❌', id, 'não encontrado');
        }
    });
    
    // 3. Testar abertura do modal
    console.log('🧪 Testando abertura do modal...');
    window.deParaUI.showSlideshowModal();
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Verificar se o modal abriu
    const modal = document.getElementById('slideshow-config-modal');
    if (modal && modal.style.display !== 'none') {
        console.log('✅ Modal do slideshow aberto com sucesso');
        
        // 5. Testar configurações no modal
        console.log('🔧 Testando configurações no modal...');
        
        // Definir valores de teste
        document.getElementById('slideshow-interval').value = '5';
        document.getElementById('slideshow-random').checked = true;
        document.getElementById('slideshow-preload').checked = true;
        document.getElementById('slideshow-recursive').checked = true;
        
        // Aplicar configurações
        window.deParaUI.applySlideshowConfigFromModal();
        console.log('📊 Configurações aplicadas:', window.deParaUI.slideshowConfig);
        
        // 6. Testar salvamento
        window.deParaUI.saveSlideshowConfig();
        const saved = localStorage.getItem('slideshowConfig');
        console.log('💾 Configurações salvas:', saved ? JSON.parse(saved) : 'Nenhuma');
        
        // 7. Fechar modal
        window.deParaUI.closeSlideshowModal();
        console.log('✅ Modal fechado');
        
    } else {
        console.error('❌ Modal do slideshow não abriu');
    }
    
    // 8. Testar carregamento de imagens
    console.log('🖼️ Testando carregamento de imagens...');
    
    // Simular pasta de teste
    const testPath = '/home/yo/Pictures';
    console.log('📁 Testando pasta:', testPath);
    
    // Tentar carregar imagens
    try {
        const response = await fetch('/api/files/list', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: testPath,
                extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
                recursive: true
            })
        });
        
        const result = await response.json();
        
        if (result.success && result.data.images.length > 0) {
            console.log('✅ Imagens encontradas:', result.data.images.length);
            console.log('📸 Primeiras 3 imagens:', result.data.images.slice(0, 3));
        } else {
            console.warn('⚠️ Nenhuma imagem encontrada na pasta de teste');
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar imagens:', error);
    }
    
    console.log('🎉 Teste do slideshow concluído!');
}

// Executar teste
testSlideshow().catch(console.error);
EOF

# 4. Criar script de correção do slideshow
echo "📝 Criando script de correção do slideshow..."
cat > /home/yo/DePara/fix-slideshow.js << 'EOF'
// Script para corrigir slideshow
console.log('🔧 Corrigindo slideshow...');

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

async function fixSlideshow() {
    await waitForDeParaUI();
    
    console.log('✅ DeParaUI encontrada, corrigindo slideshow...');
    
    // 1. Corrigir configurações padrão
    window.deParaUI.slideshowConfig = {
        interval: 5,
        random: false,
        preload: true,
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
        recursive: true
    };
    
    // 2. Salvar configurações
    window.deParaUI.saveSlideshowConfig();
    console.log('💾 Configurações corrigidas e salvas');
    
    // 3. Verificar se o botão do slideshow está funcionando
    const slideshowCard = document.querySelector('.action-slideshow-card');
    if (slideshowCard) {
        console.log('✅ Botão do slideshow encontrado');
        
        // Adicionar event listener se não existir
        if (!slideshowCard.onclick) {
            slideshowCard.onclick = () => {
                console.log('🎬 Abrindo modal do slideshow...');
                window.deParaUI.showSlideshowModal();
            };
            console.log('🔧 Event listener adicionado ao botão do slideshow');
        }
    } else {
        console.error('❌ Botão do slideshow não encontrado');
    }
    
    // 4. Verificar métodos do slideshow
    const methods = [
        'loadSlideshowConfig',
        'saveSlideshowConfig',
        'applySlideshowConfigFromModal',
        'applySlideshowConfigToModal',
        'startSlideshowFromModal',
        'loadSlideshowImages',
        'preloadImage',
        'preloadNextImage',
        'updateSlideDisplay',
        'startAutoPlay'
    ];
    
    methods.forEach(method => {
        if (typeof window.deParaUI[method] === 'function') {
            console.log('✅', method, 'OK');
        } else {
            console.error('❌', method, 'não encontrado');
        }
    });
    
    // 5. Testar abertura do modal
    console.log('🧪 Testando abertura do modal...');
    window.deParaUI.showSlideshowModal();
    
    setTimeout(() => {
        const modal = document.getElementById('slideshow-config-modal');
        if (modal && modal.style.display !== 'none') {
            console.log('✅ Modal do slideshow funcionando');
            
            // Fechar modal
            window.deParaUI.closeSlideshowModal();
        } else {
            console.error('❌ Modal do slideshow não está funcionando');
        }
    }, 1000);
    
    console.log('🎉 Correção do slideshow concluída!');
}

// Executar correção
fixSlideshow().catch(console.error);
EOF

echo "✅ Scripts de correção criados!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Cole o conteúdo do arquivo test-slideshow-fix.js no console do navegador para testar"
echo "🔧 Cole o conteúdo do arquivo fix-slideshow.js no console do navegador para corrigir"
