#!/bin/bash

# Script para resolver conflito de merge e aplicar correções
echo "🔧 Resolvendo conflito de merge..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 2

# 2. Fazer stash das mudanças locais
echo "💾 Fazendo stash das mudanças locais..."
git stash push -m "Mudanças locais antes do merge"

# 3. Fazer pull
echo "📥 Fazendo pull..."
git pull origin main

# 4. Aplicar correções manualmente
echo "🔧 Aplicando correções manualmente..."

# Corrigir método browseSlideshowFolder
python3 -c "
import re

# Ler arquivo
with open('src/public/app.js', 'r') as f:
    content = f.read()

# Método browseSlideshowFolder corrigido
browseSlideshowFolder = '''    // Navegar para pasta de slideshow
    browseSlideshowFolder() {
        console.log('📁 Abrindo seletor de pasta...');
        
        // Criar um modal personalizado para seleção de pasta
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = \`
            <div class=\"modal-content\" style=\"max-width: 600px; width: 90%;\">
                <div class=\"modal-header\">
                    <h3>Selecionar Pasta para Slideshow</h3>
                    <button class=\"modal-close slideshow-folder-close-btn\">
                        <span class=\"material-icons\">close</span>
                    </button>
                </div>
                <div class=\"modal-body\">
                    <div class=\"form-group\">
                        <label for=\"folder-path-input\">Caminho da pasta:</label>
                        <div class=\"input-group\">
                            <input type=\"text\" id=\"folder-path-input\" class=\"form-input\"
                                   placeholder=\"Digite o caminho da pasta\" value=\"\">
                            <button class=\"btn btn-outline slideshow-folder-test-btn\">
                                <span class=\"material-icons\">check</span>
                                Testar
                            </button>
                        </div>
                        <small class=\"form-help\">
                            Digite o caminho completo da pasta que contém as imagens
                        </small>
                    </div>
                    <div class=\"folder-suggestions\">
                        <h4>Pastas comuns:</h4>
                        <div class=\"suggestion-buttons\">
                            <button class=\"btn btn-sm slideshow-suggestion-btn\" data-path=\"/mnt\">/mnt</button>
                            <button class=\"btn btn-sm slideshow-suggestion-btn\" data-path=\"/home/yo/Pictures\">~/Pictures</button>
                            <button class=\"btn btn-sm slideshow-suggestion-btn\" data-path=\"/home/yo/Downloads\">~/Downloads</button>
                            <button class=\"btn btn-sm slideshow-suggestion-btn\" data-path=\"/media\">/media</button>
                            <button class=\"btn btn-sm slideshow-suggestion-btn\" data-path=\"/home/yo/Desktop\">~/Desktop</button>
                        </div>
                    </div>
                </div>
                <div class=\"modal-footer\">
                    <button class=\"btn btn-secondary slideshow-folder-cancel-btn\">Cancelar</button>
                    <button class=\"btn btn-primary slideshow-folder-select-btn\">Selecionar</button>
                </div>
            </div>
        \`;

        document.body.appendChild(modal);

        // Configurar event listeners para o modal de slideshow
        this.setupSlideshowFolderEventListeners(modal);
    }'''

# Substituir método browseSlideshowFolder
pattern = r'browseSlideshowFolder\(\) \{[^}]*\}'
if re.search(pattern, content, re.DOTALL):
    content = re.sub(pattern, browseSlideshowFolder, content, flags=re.DOTALL)
    print('✅ browseSlideshowFolder substituído')
else:
    print('❌ browseSlideshowFolder não encontrado')

# Salvar arquivo
with open('src/public/app.js', 'w') as f:
    f.write(content)

print('✅ Correções aplicadas no app.js')
"

# 5. Verificar se a limitação de 50 imagens ainda existe
echo "🔍 Verificando limitação de 50 imagens..."
if grep -q "maxImages = 50" src/routes/fileOperations.js; then
    echo "❌ Limitação ainda existe - removendo..."
    
    # Remover limitação
    sed -i '/const maxImages = 50/d' src/routes/fileOperations.js
    sed -i '/const limitedImages = images\.slice(0, maxImages)/d' src/routes/fileOperations.js
    sed -i '/if (images\.length > maxImages)/d' src/routes/fileOperations.js
    sed -i '/logger\.warn.*limitando/d' src/routes/fileOperations.js
    sed -i '/}/d' src/routes/fileOperations.js
    
    # Substituir retorno da API
    sed -i 's/images: limitedImages,/images: images,/' src/routes/fileOperations.js
    sed -i 's/totalCount: limitedImages\.length,/totalCount: images.length,/' src/routes/fileOperations.js
    sed -i 's/limited: images\.length > maxImages/limited: false/' src/routes/fileOperations.js
    
    echo "✅ Limitação removida!"
else
    echo "✅ Limitação já foi removida"
fi

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

echo "🎉 Conflito de merge resolvido e correções aplicadas!"
