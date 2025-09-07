#!/bin/bash

# Script para corrigir seleção de pasta do slideshow
echo "🔧 Corrigindo seleção de pasta do slideshow..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 2

# 2. Atualizar código
echo "📥 Atualizando código..."
git pull origin main

# 3. Corrigir método browseSlideshowFolder
echo "🔧 Corrigindo método browseSlideshowFolder..."
cat > /tmp/fix_browseSlideshowFolder.js << 'EOF'
    // Navegar para pasta de slideshow
    browseSlideshowFolder() {
        console.log('📁 Abrindo seletor de pasta...');
        
        // Criar um modal personalizado para seleção de pasta
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
                                   placeholder="/home/user/Pictures" value="">
                            <button class="btn btn-outline slideshow-folder-test-btn">
                                <span class="material-icons">check</span>
                                Testar
                            </button>
                        </div>
                        <small class="form-help">
                            Digite o caminho completo da pasta que contém as imagens
                        </small>
                    </div>
                    <div class="folder-suggestions">
                        <h4>Pastas comuns:</h4>
                        <div class="suggestion-buttons">
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="/mnt">/mnt</button>
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="/home/yo/Pictures">~/Pictures</button>
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="/home/yo/Downloads">~/Downloads</button>
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="/media">/media</button>
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="/home/yo/Desktop">~/Desktop</button>
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

        // Configurar event listeners para o modal de slideshow
        this.setupSlideshowFolderEventListeners(modal);
    }

    // Configurar event listeners para o modal de seleção de pasta do slideshow
    setupSlideshowFolderEventListeners(modal) {
        // Botão fechar
        const closeBtn = modal.querySelector('.slideshow-folder-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }

        // Botão cancelar
        const cancelBtn = modal.querySelector('.slideshow-folder-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.remove();
            });
        }

        // Botão testar pasta
        const testBtn = modal.querySelector('.slideshow-folder-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                const input = document.getElementById('folder-path-input');
                const path = input.value.trim();
                
                if (!path) {
                    this.showToast('Digite um caminho válido', 'warning');
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
                        this.showToast(`✅ Pasta encontrada! ${count} imagem(ns) localizada(s)`, 'success');
                    } else {
                        this.showToast('❌ Pasta não encontrada ou inacessível', 'error');
                    }
                } catch (error) {
                    this.showToast('❌ Erro ao testar pasta', 'error');
                }
            });
        }

        // Botão selecionar
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
    }
EOF

# 4. Aplicar correção no app.js
echo "🔧 Aplicando correção no app.js..."
python3 -c "
import re

# Ler arquivo
with open('src/public/app.js', 'r') as f:
    content = f.read()

# Ler correção
with open('/tmp/fix_browseSlideshowFolder.js', 'r') as f:
    new_method = f.read()

# Substituir método browseSlideshowFolder
pattern = r'browseSlideshowFolder\(\) \{[^}]*\}'
if re.search(pattern, content, re.DOTALL):
    content = re.sub(pattern, new_method, content, flags=re.DOTALL)
    print('✅ browseSlideshowFolder substituído')
else:
    print('❌ browseSlideshowFolder não encontrado')

# Salvar arquivo
with open('src/public/app.js', 'w') as f:
    f.write(content)

print('✅ Correção aplicada no app.js')
"

# 5. Remover valor padrão do input
echo "🔧 Removendo valor padrão do input..."
sed -i 's/value="\/mnt"//' src/public/app.js
sed -i 's/placeholder="\/home\/user\/Pictures"/placeholder="Digite o caminho da pasta"/' src/public/app.js

# 6. Instalar dependências
echo "📦 Instalando dependências..."
npm install

# 7. Iniciar DePara
echo "▶️ Iniciando DePara..."
npm start &

# 8. Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# 9. Verificar status
echo "✅ Verificando status..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ DePara funcionando!"
    echo "🌐 Acesse: http://localhost:3000"
    echo "🎬 Teste a seleção de pasta do slideshow!"
    echo "📋 O campo deve estar vazio e o botão 'Selecionar Pasta' deve funcionar"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Correção da seleção de pasta concluída!"
