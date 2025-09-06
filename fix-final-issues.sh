#!/bin/bash

# Script para corrigir problemas finais do DePara
# Execute este script no Raspberry Pi

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detectar usuário atual
CURRENT_USER=$(whoami)
USER_HOME="/home/$CURRENT_USER"
DEPARA_DIR="$USER_HOME/DePara"

echo -e "${BLUE}🔧 Corrigindo problemas finais do DePara...${NC}"

# 1. Navegar para o diretório do DePara
cd "$DEPARA_DIR" || {
    echo -e "${RED}❌ Erro: Não foi possível acessar $DEPARA_DIR${NC}"
    exit 1
}

# 2. Corrigir permissões do script de início
echo -e "${YELLOW}🔧 Corrigindo permissões do script de início...${NC}"

if [ -f "start-depara.sh" ]; then
    chmod +x start-depara.sh
    echo -e "${GREEN}✅ Permissões do script corrigidas${NC}"
else
    echo -e "${RED}❌ Script de início não encontrado${NC}"
    exit 1
fi

# 3. Verificar se o DePara está rodando
echo -e "${YELLOW}🔍 Verificando se o DePara está rodando...${NC}"

if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara está rodando${NC}"
else
    echo -e "${YELLOW}▶️ Iniciando DePara...${NC}"
    
    # Parar qualquer processo na porta 3000
    if lsof -ti:3000 > /dev/null 2>&1; then
        echo -e "${YELLOW}🔄 Parando processos na porta 3000...${NC}"
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    # Iniciar DePara
    nohup npm start > /dev/null 2>&1 &
    sleep 5
    
    if pgrep -f "node.*main.js" > /dev/null; then
        echo -e "${GREEN}✅ DePara iniciado com sucesso${NC}"
    else
        echo -e "${RED}❌ Erro ao iniciar DePara${NC}"
        echo -e "${YELLOW}💡 Tentando iniciar manualmente...${NC}"
        npm start &
        sleep 3
    fi
fi

# 4. Testar API
echo -e "${YELLOW}🧪 Testando API...${NC}"

# Aguardar um pouco para a API inicializar
sleep 3

# Testar rota básica
echo -e "${BLUE}🔍 Testando /health...${NC}"
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/health 2>/dev/null)
HEALTH_CODE="${HEALTH_RESPONSE: -3}"

if [ "$HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ /health funcionando (HTTP $HEALTH_CODE)${NC}"
else
    echo -e "${RED}❌ /health com problema (HTTP $HEALTH_CODE)${NC}"
fi

# Testar rota da API
echo -e "${BLUE}🔍 Testando /api/health...${NC}"
API_HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
API_HEALTH_CODE="${API_HEALTH_RESPONSE: -3}"

if [ "$API_HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ /api/health funcionando (HTTP $API_HEALTH_CODE)${NC}"
else
    echo -e "${RED}❌ /api/health com problema (HTTP $API_HEALTH_CODE)${NC}"
fi

# 5. Verificar se o script de início funciona
echo -e "${YELLOW}🧪 Testando script de início...${NC}"

if [ -x "start-depara.sh" ]; then
    echo -e "${GREEN}✅ Script de início é executável${NC}"
    
    # Testar se o script executa sem erro
    if bash -n start-depara.sh 2>/dev/null; then
        echo -e "${GREEN}✅ Script de início tem sintaxe correta${NC}"
    else
        echo -e "${RED}❌ Script de início tem erro de sintaxe${NC}"
    fi
else
    echo -e "${RED}❌ Script de início não é executável${NC}"
    chmod +x start-depara.sh
    echo -e "${GREEN}✅ Permissões corrigidas${NC}"
fi

# 6. Verificar arquivo .desktop
echo -e "${YELLOW}🔍 Verificando arquivo .desktop...${NC}"

DESKTOP_FILE="$USER_HOME/.local/share/applications/depara.desktop"

if [ -f "$DESKTOP_FILE" ]; then
    echo -e "${GREEN}✅ Arquivo .desktop existe${NC}"
    
    # Verificar se é executável
    if [ -x "$DESKTOP_FILE" ]; then
        echo -e "${GREEN}✅ Arquivo .desktop é executável${NC}"
    else
        echo -e "${YELLOW}🔧 Tornando arquivo .desktop executável...${NC}"
        chmod +x "$DESKTOP_FILE"
        echo -e "${GREEN}✅ Permissões corrigidas${NC}"
    fi
    
    # Mostrar conteúdo do arquivo
    echo -e "${BLUE}📄 Conteúdo do arquivo .desktop:${NC}"
    cat "$DESKTOP_FILE"
else
    echo -e "${RED}❌ Arquivo .desktop não encontrado${NC}"
fi

# 7. Testar abertura do DePara
echo -e "${YELLOW}🧪 Testando abertura do DePara...${NC}"

# Simular abertura do DePara
echo -e "${BLUE}🔍 Testando execução do script...${NC}"

# Verificar se o script pode ser executado
if [ -x "start-depara.sh" ] && [ -f "start-depara.sh" ]; then
    echo -e "${GREEN}✅ Script de início está pronto para execução${NC}"
    
    # Verificar se o DePara está rodando
    if pgrep -f "node.*main.js" > /dev/null; then
        echo -e "${GREEN}✅ DePara está rodando e pronto para uso${NC}"
    else
        echo -e "${YELLOW}⚠️ DePara não está rodando, mas o script está pronto${NC}"
    fi
else
    echo -e "${RED}❌ Script de início não está pronto${NC}"
fi

# 8. Resumo final
echo -e "${BLUE}📊 Resumo das correções:${NC}"

if [ -x "start-depara.sh" ]; then
    echo -e "${GREEN}✅ Script de início executável${NC}"
else
    echo -e "${RED}❌ Script de início não executável${NC}"
fi

if [ "$HEALTH_CODE" = "200" ] || [ "$API_HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ API funcionando${NC}"
else
    echo -e "${RED}❌ API com problemas${NC}"
fi

if [ -f "$DESKTOP_FILE" ] && [ -x "$DESKTOP_FILE" ]; then
    echo -e "${GREEN}✅ Arquivo .desktop configurado${NC}"
else
    echo -e "${RED}❌ Arquivo .desktop com problemas${NC}"
fi

echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
echo -e "${YELLOW}💡 Agora teste clicando no ícone do DePara no menu!${NC}"

echo -e "${GREEN}🎉 Correções aplicadas!${NC}"
