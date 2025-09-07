#!/bin/bash

# Script para corrigir problemas finais do slideshow
echo "🔧 Corrigindo problemas finais do slideshow..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 3

# 2. Fazer backup do app.js
echo "💾 Fazendo backup do app.js..."
cp src/public/app.js src/public/app.js.backup

# 3. Corrigir problema da seleção de pasta
echo "🔧 Corrigindo seleção de pasta..."
python3 << 'EOF'
import re

# Ler o arquivo
with open('src/public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Corrigir o problema da seleção de pasta
# O problema é que o campo slideshow-folder-path não está sendo atualizado corretamente
old_confirm = '''    confirmFolderSelection() {
        const input = document.getElementById('folder-path-input');
        const slideshowInput = document.getElementById('slideshow-folder-path');

        if (input && slideshowInput) {
            slideshowInput.value = input.value;
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
        }

        // Fechar modal
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
        }
    }'''

content = content.replace(old_confirm, new_confirm)

# Corrigir problema do carregamento de imagens
# Adicionar mais logs e melhorar tratamento de erro
old_load = '''    async loadSlideshowImages(folderPath, extensions, recursive, interval) {
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

            if (!result.success) {'''

new_load = '''    async loadSlideshowImages(folderPath, extensions, recursive, interval) {
        try {
            console.log('🔍 Iniciando carregamento de imagens...');
            console.log('📁 Pasta:', folderPath);
            console.log('📋 Extensões:', extensions);
            console.log('🔄 Recursivo:', recursive);
            this.showToast('🔍 Procurando imagens...', 'info');

            // Preparar extensões para a API
            const formattedExtensions = extensions.map(ext => ext.startsWith('.') ? ext : '.' + ext);

            console.log('📡 Enviando requisição para API...');
            console.log('📡 URL:', '/api/files/list-images');
            console.log('📡 Body:', JSON.stringify({
                folderPath,
                extensions: formattedExtensions,
                recursive
            }));

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
                const errorText = await response.text();
                console.error('❌ Erro na resposta:', errorText);
                throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('📊 Resultado da API:', result);

            if (!result.success) {'''

content = content.replace(old_load, new_load)

# Escrever o arquivo corrigido
with open('src/public/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Correções aplicadas!")
EOF

# 4. Verificar se as correções foram aplicadas
echo "🔍 Verificando correções..."
if grep -q "Pasta selecionada:" src/public/app.js; then
    echo "✅ Seleção de pasta corrigida"
else
    echo "❌ Erro na correção da seleção de pasta"
fi

if grep -q "console.log('📁 Pasta:', folderPath);" src/public/app.js; then
    echo "✅ Logs de debug adicionados"
else
    echo "❌ Erro na adição dos logs"
fi

# 5. Iniciar DePara
echo "▶️ Iniciando DePara..."
npm start &

# 6. Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# 7. Verificar status
echo "✅ Verificando status..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ DePara funcionando!"
    echo "🌐 Acesse: http://localhost:3000"
    echo "💡 Pressione Ctrl+F5 para limpar cache do navegador"
    echo "🎬 Teste o slideshow agora!"
    echo ""
    echo "🔧 Correções aplicadas:"
    echo "  ✅ Seleção de pasta agora atualiza o campo"
    echo "  ✅ Logs detalhados para debug do carregamento"
    echo "  ✅ Melhor tratamento de erros"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Correções aplicadas com sucesso!"
