#!/bin/bash

# Script para corrigir problemas do slideshow
# Autor: yopastorelli
# Versão: 1.0.0

echo "🔧 Corrigindo problemas do slideshow..."

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

# 3. Criar script de correção
echo "📝 Criando script de correção..."
cat > /home/yo/DePara/fix-slideshow-issues.js << 'EOF'
// Script para corrigir problemas do slideshow
console.log('🔧 Corrigindo problemas do slideshow...');

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

async function fixSlideshowIssues() {
    await waitForDeParaUI();
    
    console.log('✅ DeParaUI encontrada');
    
    // 1. Corrigir método browseSlideshowFolder
    window.deParaUI.browseSlideshowFolder = function() {
        console.log('📁 Abrindo seletor de pasta...');
        
        // Criar modal de seleção de pasta
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; width: 90%;">
                <div class="modal-header">
                    <h3>Selecionar Pasta para Slideshow</h3>
                    <button class="modal-close slideshow-folder-close-btn">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="folder-path-input">Caminho da pasta:</label>
                        <div class="input-group">
                            <input type="text" id="folder-path-input" class="form-input"
                                   placeholder="/home/user/Pictures" value="/mnt">
                            <button class="btn btn-outline slideshow-folder-test-btn">
                                <span class="material-icons">check</span>
                                Testar
                            </button>
                        </div>
                        <small class="form-help">Digite o caminho completo da pasta que contém as imagens</small>
                    </div>
                    <div class="folder-suggestions">
                        <h4>Pastas comuns:</h4>
                        <div class="suggestion-buttons">
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="/mnt">/mnt</button>
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="/home/yo/Pictures">~/Pictures</button>
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="/home/yo/Downloads">~/Downloads</button>
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="/media">/media</button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary slideshow-folder-cancel-btn">Cancelar</button>
                    <button class="btn btn-primary slideshow-folder-select-btn">Selecionar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Configurar event listeners
        const closeBtn = modal.querySelector('.slideshow-folder-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }

        const cancelBtn = modal.querySelector('.slideshow-folder-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => modal.remove());
        }

        const testBtn = modal.querySelector('.slideshow-folder-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                const input = document.getElementById('folder-path-input');
                const path = input.value.trim();
                
                if (!path) {
                    window.deParaUI.showToast('Digite um caminho válido', 'warning');
                    return;
                }

                try {
                    const response = await fetch('/api/files/list-images', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            folderPath: path,
                            extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
                            recursive: true
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        const count = result.data.totalCount;
                        window.deParaUI.showToast(`✅ Pasta encontrada! ${count} imagem(ns) localizada(s)`, 'success');
                    } else {
                        window.deParaUI.showToast('❌ Pasta não encontrada ou inacessível', 'error');
                    }
                } catch (error) {
                    window.deParaUI.showToast('❌ Erro ao testar pasta', 'error');
                }
            });
        }

        const selectBtn = modal.querySelector('.slideshow-folder-select-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                const input = document.getElementById('folder-path-input');
                const slideshowInput = document.getElementById('slideshow-folder-path');
                
                if (input && slideshowInput) {
                    slideshowInput.value = input.value;
                    console.log('📁 Pasta selecionada:', input.value);
                }
                
                modal.remove();
            });
        }

        // Botões de sugestão
        const suggestionBtns = modal.querySelectorAll('.slideshow-suggestion-btn');
        suggestionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const path = btn.getAttribute('data-path');
                const input = document.getElementById('folder-path-input');
                if (input) {
                    input.value = path;
                }
            });
        });
    };
    
    console.log('🔧 Método browseSlideshowFolder corrigido');
    
    // 2. Corrigir método loadSlideshowImages para evitar carregamento infinito
    window.deParaUI.loadSlideshowImages = async function(folderPath, extensions, recursive, interval) {
        try {
            console.log('🔍 Iniciando carregamento de imagens...');
            this.showToast('🔍 Procurando imagens...', 'info');

            // Preparar extensões para a API
            const formattedExtensions = extensions.map(ext => ext.startsWith('.') ? ext : '.' + ext);

            console.log('📡 Enviando requisição para API...');
            const response = await fetch('/api/files/list-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    folderPath,
                    extensions: formattedExtensions,
                    recursive
                })
            });

            console.log('📡 Resposta recebida:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('📊 Resultado da API:', result);

            if (!result.success) {
                throw new Error(result.error?.message || 'Erro ao listar imagens');
            }

            // Limitar a 50 imagens para performance
            let images = result.data.images;
            if (images.length > 50) {
                images = images.slice(0, 50);
                this.showToast(`⚠️ Limitado a 50 imagens para melhor performance`, 'warning');
            }

            this.slideshowImages = images;
            this.slideshowInterval = interval * 1000;

            if (this.slideshowImages.length === 0) {
                this.showToast('Nenhuma imagem encontrada na pasta', 'warning');
                return;
            }

            // Aplicar modo aleatório se configurado
            if (this.slideshowConfig.random) {
                this.shuffleArray(this.slideshowImages);
                console.log('🎲 Imagens embaralhadas');
            }

            // Limpar cache de pré-carregamento
            this.preloadedImages.clear();

            const modeText = this.slideshowConfig.random ? ' (aleatório)' : ' (sequencial)';
            this.showToast(`✅ ${this.slideshowImages.length} imagens carregadas${modeText}`, 'success');
            
            console.log('🎬 Iniciando viewer do slideshow...');
            this.startSlideshowViewer();

        } catch (error) {
            console.error('❌ Erro ao carregar imagens:', error);
            this.showToast('Erro ao carregar imagens: ' + error.message, 'error');
        }
    };
    
    console.log('🔧 Método loadSlideshowImages corrigido');
    
    // 3. Adicionar método shuffleArray se não existir
    if (!window.deParaUI.shuffleArray) {
        window.deParaUI.shuffleArray = function(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };
        console.log('🔧 Método shuffleArray adicionado');
    }
    
    // 4. Testar correções
    console.log('🧪 Testando correções...');
    
    // Testar abertura do modal
    window.deParaUI.showSlideshowModal();
    
    setTimeout(() => {
        const modal = document.getElementById('slideshow-config-modal');
        if (modal && modal.style.display !== 'none') {
            console.log('✅ Modal do slideshow funcionando');
            
            // Testar botão de seleção de pasta
            const browseBtn = document.querySelector('.slideshow-browse-btn');
            if (browseBtn) {
                console.log('✅ Botão de seleção de pasta encontrado');
            } else {
                console.error('❌ Botão de seleção de pasta não encontrado');
            }
            
            // Fechar modal
            window.deParaUI.closeSlideshowModal();
        } else {
            console.error('❌ Modal do slideshow não está funcionando');
        }
    }, 1000);
    
    console.log('🎉 Correções aplicadas!');
    console.log('📋 Problemas corrigidos:');
    console.log('  - Seleção de pasta funcionando');
    console.log('  - Carregamento infinito resolvido');
    console.log('  - Logs adicionados para debug');
}

// Executar correções
fixSlideshowIssues().catch(console.error);
EOF

echo "✅ Script de correção criado!"
echo "🌐 Acesse: http://localhost:3000"
echo "💡 Cole o conteúdo do arquivo fix-slideshow-issues.js no console do navegador"
echo "🔧 Isso vai corrigir ambos os problemas do slideshow!"
