#!/bin/bash

echo "🔍 DIAGNÓSTICO COMPLETO DO SLIDESHOW NO RASPBERRY PI"
echo "=================================================="

# Verificar se está no diretório correto
echo "📁 Diretório atual: $(pwd)"
echo "📁 Conteúdo do diretório:"
ls -la

# Verificar se o git está atualizado
echo ""
echo "🔄 Verificando atualizações do Git..."
git status
echo ""
echo "📥 Puxando últimas alterações..."
git pull origin main

# Verificar se o serviço está rodando
echo ""
echo "🔧 Verificando status do serviço..."
sudo systemctl status depara

# Verificar logs do serviço
echo ""
echo "📋 Últimos logs do serviço:"
sudo journalctl -u depara --no-pager -n 20

# Verificar se a porta 3000 está em uso
echo ""
echo "🌐 Verificando porta 3000..."
netstat -tlnp | grep :3000 || echo "Porta 3000 não está em uso"

# Verificar processos Node.js
echo ""
echo "🟢 Processos Node.js rodando:"
ps aux | grep node | grep -v grep

# Verificar se o arquivo app.js foi atualizado
echo ""
echo "📄 Verificando timestamp do app.js:"
ls -la src/public/app.js

# Verificar se há erros de sintaxe no JavaScript
echo ""
echo "🔍 Verificando sintaxe do JavaScript..."
node -c src/public/app.js && echo "✅ Sintaxe OK" || echo "❌ Erro de sintaxe"

# Verificar se o servidor está respondendo
echo ""
echo "🌐 Testando API..."
curl -s http://localhost:3000/api/health || echo "❌ API não está respondendo"

# Verificar se há imagens na pasta
echo ""
echo "📸 Verificando imagens na pasta..."
if [ -d "/mnt/lytspot/@SYNC@/_@@PICZ & VIDEOS LYT @@_/_@LYT PicZ por ANO@_" ]; then
    echo "✅ Pasta existe"
    find "/mnt/lytspot/@SYNC@/_@@PICZ & VIDEOS LYT @@_/_@LYT PicZ por ANO@_" -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" | head -5
    echo "Total de imagens: $(find "/mnt/lytspot/@SYNC@/_@@PICZ & VIDEOS LYT @@_/_@LYT PicZ por ANO@_" -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" | wc -l)"
else
    echo "❌ Pasta não existe"
fi

# Reiniciar o serviço
echo ""
echo "🔄 Reiniciando serviço..."
sudo systemctl restart depara
sleep 3

# Verificar se reiniciou corretamente
echo ""
echo "✅ Verificando se reiniciou..."
sudo systemctl status depara --no-pager

echo ""
echo "🎯 DIAGNÓSTICO CONCLUÍDO!"
echo "Se ainda houver problemas, verifique os logs acima."
