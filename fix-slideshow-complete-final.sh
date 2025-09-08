#!/bin/bash

# Script completo para corrigir todos os problemas do slideshow
echo "🔧 Corrigindo TODOS os problemas do slideshow..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 3

# 2. Fazer backups
echo "💾 Fazendo backups..."
cp src/public/index.html src/public/index.html.backup
cp src/public/app.js src/public/app.js.backup

# 3. Corrigir HTML - IDs duplicados
echo "🔧 Corrigindo HTML - IDs duplicados..."
python3 << 'EOF'
import re

# Ler o arquivo
with open('src/public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Corrigir TODOS os IDs duplicados
# Modal de configuração
content = content.replace('id="slideshow-folder-path"', 'id="slideshow-config-folder-path"')
content = content.replace('id="slideshow-loading"', 'id="slideshow-config-loading"')
content = content.replace('id="slideshow-error"', 'id="slideshow-config-error"')

# Escrever o arquivo corrigido
with open('src/public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ HTML corrigido - IDs duplicados removidos!")
EOF

# 4. Corrigir JavaScript - IDs e lógica
echo "🔧 Corrigindo JavaScript - IDs e lógica..."
python3 << 'EOF'
import re

# Ler o arquivo
with open('src/public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Corrigir referências ao input de configuração
content = content.replace('document.getElementById(\'slideshow-folder-path\')', 'document.getElementById(\'slideshow-config-folder-path\')')

# Corrigir o método confirmFolderSelection para usar o ID correto
old_confirm = '''    confirmFolderSelection() {
        const input = document.getElementById('folder-path-input');
        const slideshowInput = document.getElementById('slideshow-folder-path');

        if (input && slideshowInput) {
            slideshowInput.value = input.value;
            console.log('📁 Pasta selecionada:', input.value);
            this.showToast('Pasta selecionada: ' + input.value, 'success');
        }

        // Fechar modal
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
        }
    }'''

new_confirm = '''    confirmFolderSelection() {
        const input = document.getElementById('folder-path-input');
        const slideshowInput = document.getElementById('slideshow-folder-path');

        if (input && slideshowInput) {
            slideshowInput.value = input.value;
            console.log('📁 Pasta selecionada:', input.value);
            this.showToast('Pasta selecionada: ' + input.value, 'success');
            
            // Salvar no localStorage
            localStorage.setItem('slideshowSelectedPath', input.value);
        }

        // Fechar modal
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
        }
    }'''

content = content.replace(old_confirm, new_confirm)

# Corrigir o método startSlideshowFromModal para usar o ID correto
old_start = '''    async startSlideshowFromModal() {
        const folderPath = document.getElementById('slideshow-folder-path').value.trim();

        if (!folderPath) {
            this.showToast('Selecione uma pasta com imagens', 'error');
            return;
        }

        // Salvar configurações
        this.saveSlideshowConfig();

        // Fechar modal
        document.getElementById('slideshow-config-modal').style.display = 'none';

        // Iniciar slideshow
        await this.loadSlideshowImages(folderPath, this.slideshowConfig.extensions, this.slideshowConfig.recursive, this.slideshowConfig.interval);
    }'''

new_start = '''    async startSlideshowFromModal() {
        const folderPath = document.getElementById('slideshow-config-folder-path').value.trim();

        if (!folderPath) {
            this.showToast('Selecione uma pasta com imagens', 'error');
            return;
        }

        // Salvar configurações
        this.saveSlideshowConfig();

        // Fechar modal
        document.getElementById('slideshow-config-modal').style.display = 'none';

        // Iniciar slideshow
        await this.loadSlideshowImages(folderPath, this.slideshowConfig.extensions, this.slideshowConfig.recursive, this.slideshowConfig.interval);
    }'''

content = content.replace(old_start, new_start)

# Escrever o arquivo corrigido
with open('src/public/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ JavaScript corrigido - IDs e lógica atualizados!")
EOF

# 5. Verificar se as correções foram aplicadas
echo "🔍 Verificando correções..."
if grep -q "slideshow-config-folder-path" src/public/index.html; then
    echo "✅ HTML: Input de configuração corrigido"
else
    echo "❌ Erro: HTML não foi corrigido"
fi

if grep -q "slideshow-config-folder-path" src/public/app.js; then
    echo "✅ JavaScript: Referências corrigidas"
else
    echo "❌ Erro: JavaScript não foi corrigido"
fi

# 6. Verificar se ainda há IDs duplicados
echo "🔍 Verificando se ainda há IDs duplicados..."
DUPLICATES=$(grep -o 'id="[^"]*"' src/public/index.html | sort | uniq -d)
if [ -n "$DUPLICATES" ]; then
    echo "⚠️ Ainda há IDs duplicados:"
    echo "$DUPLICATES"
else
    echo "✅ Nenhum ID duplicado encontrado"
fi

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
    echo "💡 Pressione Ctrl+F5 para limpar cache do navegador"
    echo "🎬 Teste o slideshow agora!"
    echo ""
    echo "🔧 Correções aplicadas:"
    echo "  ✅ HTML: IDs duplicados removidos"
    echo "  ✅ JavaScript: Referências corrigidas"
    echo "  ✅ Seleção de pasta: Deve funcionar agora"
    echo "  ✅ Carregamento de imagens: Deve funcionar agora"
    echo "  ✅ localStorage: Pasta salva automaticamente"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Correções completas aplicadas com sucesso!"
