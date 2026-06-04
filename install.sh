#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CURRENT_USER="$(id -un 2>/dev/null || echo user)"
USER_HOME="${HOME:-/home/$CURRENT_USER}"
RUNTIME_ROOT="${DEPARA_RUNTIME_ROOT:-$USER_HOME/.depara}"
CONFIG_ENV_PATH="${DEPARA_CONFIG_ENV_PATH:-$RUNTIME_ROOT/config.env}"

echo "========================================"
echo -e "${BLUE}       INSTALADOR DePara v2.0${NC}"
echo "========================================"
echo ""
echo "Sistema de Gerenciamento de Arquivos"
echo "Com operacoes automaticas e backup"
echo ""
echo "========================================"

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "[1/5] Verificando Node.js..."
if command_exists node; then
    echo -e "${GREEN}Node.js encontrado: $(node --version)${NC}"
else
    echo -e "${RED}Node.js nao encontrado!${NC}"
    exit 1
fi

echo "[2/5] Verificando npm..."
if command_exists npm; then
    echo -e "${GREEN}npm encontrado: $(npm --version)${NC}"
else
    echo -e "${RED}npm nao encontrado!${NC}"
    exit 1
fi

echo ""
echo "[3/5] Instalando dependencias..."
if npm install; then
    echo -e "${GREEN}Dependencias instaladas com sucesso!${NC}"
else
    echo -e "${RED}Erro ao instalar dependencias!${NC}"
    exit 1
fi

echo ""
echo "[4/5] Criando estrutura de runtime..."
mkdir -p backups logs temp "$RUNTIME_ROOT"
echo -e "${GREEN}Estrutura criada!${NC}"

echo "[5/5] Criando configuracao basica..."
if [ ! -f "$CONFIG_ENV_PATH" ]; then
    cat > "$CONFIG_ENV_PATH" <<EOF
PORT=3000
NODE_ENV=production
LOG_LEVEL=warn
LOG_TO_CONSOLE=false
DEPARA_RUNTIME_ROOT=$RUNTIME_ROOT
EOF
    echo -e "${GREEN}Arquivo de runtime criado em $CONFIG_ENV_PATH!${NC}"
else
    echo -e "${YELLOW}Arquivo $CONFIG_ENV_PATH ja existe, pulando...${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}INSTALACAO CONCLUIDA COM SUCESSO!${NC}"
echo "========================================"
echo ""
echo -e "${BLUE}Para iniciar o DePara:${NC}"
echo "   npm start"
echo ""
echo -e "${BLUE}Interface web:${NC}"
echo "   http://localhost:3000/ui (ou a porta definida em $CONFIG_ENV_PATH)"
echo ""
echo -e "${BLUE}Documentacao da API:${NC}"
echo "   http://localhost:3000/api/docs (ou a porta definida em $CONFIG_ENV_PATH)"
echo ""

read -p "Deseja iniciar o DePara agora? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    npm start
fi
