#!/bin/bash

# Script para corrigir erro de sintaxe no fileOperations.js
echo "🔧 Corrigindo erro de sintaxe no fileOperations.js..."

cd ~/DePara

# 1. Parar DePara
echo "⏹️ Parando DePara..."
sudo pkill -f "node.*main.js" 2>/dev/null || true
sleep 2

# 2. Fazer backup do arquivo corrompido
echo "💾 Fazendo backup do arquivo corrompido..."
cp src/routes/fileOperations.js src/routes/fileOperations.js.backup

# 3. Restaurar arquivo original do git
echo "🔄 Restaurando arquivo original..."
git checkout HEAD -- src/routes/fileOperations.js

# 4. Aplicar correção manual (sem quebrar a sintaxe)
echo "🔧 Aplicando correção manual..."

# Encontrar e substituir a seção problemática
python3 -c "
import re

# Ler arquivo
with open('src/routes/fileOperations.js', 'r') as f:
    content = f.read()

# Encontrar a seção de limitação de imagens
pattern = r'// Limitar número de imagens para performance do slideshow\s*const maxImages = 50;.*?limited: images\.length > maxImages\s*},'

# Substituir por versão sem limitação
replacement = '''// Usar todas as imagens encontradas (remover limitação)
        logger.info(\`📸 Encontradas \${images.length} imagens para slideshow\`);

        const duration = Date.now() - startTime;
        logger.endOperation('List Images', duration, {
            imageCount: images.length,
            folderPath: safePath
        });

        res.json({
            success: true,
            data: {
                images: images,
                totalCount: images.length,
                originalCount: images.length,
                folderPath: safePath,
                limited: false
            },'''

# Aplicar substituição
new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Salvar arquivo
with open('src/routes/fileOperations.js', 'w') as f:
    f.write(new_content)

print('✅ Limitação de 50 imagens removida corretamente')
"

# 5. Verificar sintaxe
echo "🔍 Verificando sintaxe..."
if node -c src/routes/fileOperations.js; then
    echo "✅ Sintaxe corrigida!"
else
    echo "❌ Ainda há erro de sintaxe"
    echo "🔄 Restaurando backup e tentando novamente..."
    cp src/routes/fileOperations.js.backup src/routes/fileOperations.js
    git checkout HEAD -- src/routes/fileOperations.js
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
    echo "🎬 Teste o slideshow agora!"
else
    echo "❌ Erro na inicialização"
    echo "📋 Verifique os logs: tail -f logs/depara.log"
fi

echo "🎉 Correção de sintaxe concluída!"
