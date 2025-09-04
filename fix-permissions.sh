#!/bin/bash

# Script para corrigir permissões do DePara
# Execute este script no Raspberry Pi

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo "🔧 Corrigindo permissões para usuário: $CURRENT_USER"

# Navegar para o diretório do projeto
cd "$DEPARA_DIR" || {
    echo "❌ Erro: Não foi possível acessar $DEPARA_DIR"
    exit 1
}

# Corrigir permissões dos scripts
echo "📝 Corrigindo permissões dos scripts..."
chmod +x start-depara.sh
chmod +x install-raspberry.sh
chmod +x fix-installation.sh
chmod +x quick-fix.sh
chmod +x fix-desktop.sh
chmod +x update-depara.sh
chmod +x check-updates.sh

# Remover link simbólico antigo se existir
echo "🗑️ Removendo link simbólico antigo..."
sudo rm -f /usr/local/bin/depara

# Criar novo link simbólico
echo "🔗 Criando novo link simbólico..."
sudo ln -sf "$DEPARA_DIR/start-depara.sh" /usr/local/bin/depara

# Corrigir permissões do link
sudo chmod +x /usr/local/bin/depara

# Verificar se o link foi criado corretamente
echo "✅ Verificando link simbólico..."
if [ -L /usr/local/bin/depara ]; then
    echo "✅ Link simbólico criado com sucesso!"
    ls -la /usr/local/bin/depara
else
    echo "❌ Erro ao criar link simbólico"
fi

# Corrigir permissões do diretório
echo "📁 Corrigindo permissões do diretório..."
chmod 755 "$DEPARA_DIR"
chmod 755 "$DEPARA_DIR/src"
chmod 755 "$DEPARA_DIR/src/public"

# Criar diretório de logs se não existir
echo "📝 Criando diretório de logs..."
mkdir -p "$DEPARA_DIR/logs"
chmod 755 "$DEPARA_DIR/logs"

# Corrigir permissões do arquivo .desktop
echo "🖥️ Corrigindo permissões do arquivo .desktop..."
chmod 644 "$USER_HOME/.local/share/applications/depara.desktop"

# Atualizar banco de dados de aplicações
echo "🔄 Atualizando banco de dados de aplicações..."
update-desktop-database "$USER_HOME/.local/share/applications" 2>/dev/null || true

# Testar comando depara
echo "🧪 Testando comando depara..."
if command -v depara > /dev/null 2>&1; then
    echo "✅ Comando depara encontrado!"
    
    # Testar se o comando executa
    if depara status > /dev/null 2>&1; then
        echo "✅ Comando depara funcionando!"
    else
        echo "⚠️ Comando depara encontrado mas pode ter problemas"
    fi
else
    echo "❌ Comando depara não encontrado"
fi

echo ""
echo "🎉 Correção de permissões concluída!"
echo ""
echo "🧪 Para testar:"
echo "   depara status"
echo "   depara start"
echo "   depara open"
echo ""
echo "📱 Para acessar pelo menu:"
echo "   Aplicações > Utilitários > DePara"
echo ""
echo "🔧 Se ainda não funcionar, execute:"
echo "   ./start-depara.sh start"
