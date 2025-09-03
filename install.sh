#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo -e "${BLUE}       INSTALADOR DePara v2.0${NC}"
echo "========================================"
echo ""
echo "Sistema de Gerenciamento de Arquivos"
echo "Com operações automáticas e backup"
echo ""
echo "========================================"

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar Node.js
echo "[1/5] Verificando Node.js..."
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js encontrado: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js não encontrado!${NC}"
    echo ""
    echo "📥 Instale o Node.js:"
    echo "   Ubuntu/Debian: sudo apt-get install nodejs npm"
    echo "   CentOS/RHEL: sudo yum install nodejs npm"
    echo "   macOS: brew install node"
    echo "   Ou baixe de: https://nodejs.org/"
    echo ""
    exit 1
fi

# Verificar npm
echo "[2/5] Verificando npm..."
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm encontrado: $NPM_VERSION${NC}"
else
    echo -e "${RED}❌ npm não encontrado!${NC}"
    exit 1
fi

# Instalar dependências
echo ""
echo "[3/5] Instalando dependências..."
echo "Isso pode levar alguns minutos..."
if npm install; then
    echo -e "${GREEN}✅ Dependências instaladas com sucesso!${NC}"
else
    echo -e "${RED}❌ Erro ao instalar dependências!${NC}"
    exit 1
fi

# Criar estrutura de pastas
echo ""
echo "[4/5] Criando estrutura de pastas..."
mkdir -p backups logs temp
echo -e "${GREEN}✅ Estrutura de pastas criada!${NC}"

# Criar arquivo de configuração básico
echo "[5/5] Criando configuração básica..."
if [ ! -f ".env" ]; then
    cat > .env << EOF
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
LOG_FILE=logs/app.log
EOF
    echo -e "${GREEN}✅ Arquivo .env criado!${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo .env já existe, pulando...${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo "========================================"
echo ""
echo -e "${BLUE}🚀 Para iniciar o DePara:${NC}"
echo "   npm start"
echo ""
echo -e "${BLUE}🌐 Interface web:${NC}"
echo "   http://localhost:3000/ui"
echo ""
echo -e "${BLUE}📚 Documentação da API:${NC}"
echo "   http://localhost:3000/api/docs"
echo ""
echo -e "${BLUE}📁 Principais funcionalidades:${NC}"
echo "   • Mover/copiar arquivos automaticamente"
echo "   • Backup automático antes de apagar"
echo "   • Agendamento flexível (segundos a dias)"
echo "   • Templates pré-configurados"
echo "   • Interface web amigável"
echo ""
echo -e "${YELLOW}💡 Dicas:${NC}"
echo "   • Use templates para começar rapidamente"
echo "   • Configure backups automáticos"
echo "   • Monitore operações em tempo real"
echo ""

# Perguntar se quer iniciar agora
read -p "Deseja iniciar o DePara agora? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo ""
    echo "Iniciando DePara..."
    npm start
fi
