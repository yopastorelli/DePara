#!/bin/bash

# Script para diagnosticar problema da API que funcionava antes
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

echo -e "${BLUE}🔍 Diagnosticando problema da API que funcionava antes...${NC}"

# 1. Verificar se estamos no diretório correto
echo -e "${YELLOW}📁 Verificando diretório atual...${NC}"
pwd

if [[ "$PWD" == *"DePara-backup"* ]]; then
    echo -e "${YELLOW}⚠️ Estamos no diretório backup, vamos para o principal...${NC}"
    cd "$DEPARA_DIR" 2>/dev/null || {
        echo -e "${RED}❌ Diretório principal não encontrado${NC}"
        exit 1
    }
fi

echo -e "${GREEN}✅ Diretório: $(pwd)${NC}"

# 2. Verificar se o DePara está rodando
echo -e "${YELLOW}🔍 Verificando se o DePara está rodando...${NC}"

if pgrep -f "node.*main.js" > /dev/null; then
    PID=$(pgrep -f "node.*main.js")
    echo -e "${GREEN}✅ DePara está rodando (PID: $PID)${NC}"
else
    echo -e "${RED}❌ DePara não está rodando${NC}"
fi

# 3. Verificar porta 3000
echo -e "${YELLOW}🔍 Verificando porta 3000...${NC}"

if netstat -tlnp | grep -q ":3000"; then
    echo -e "${GREEN}✅ Porta 3000 está em uso${NC}"
    netstat -tlnp | grep ":3000"
else
    echo -e "${RED}❌ Porta 3000 não está em uso${NC}"
fi

# 4. Testar conectividade básica
echo -e "${YELLOW}🧪 Testando conectividade básica...${NC}"

# Testar se o servidor responde
if curl -s --connect-timeout 5 http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Servidor responde na porta 3000${NC}"
else
    echo -e "${RED}❌ Servidor não responde na porta 3000${NC}"
fi

# 5. Testar rotas específicas
echo -e "${YELLOW}🧪 Testando rotas específicas...${NC}"

# Testar rota básica /health
echo -e "${BLUE}🔍 Testando /health...${NC}"
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/health 2>/dev/null)
HEALTH_CODE="${HEALTH_RESPONSE: -3}"
HEALTH_BODY="${HEALTH_RESPONSE%???}"

if [ "$HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ /health funcionando (HTTP $HEALTH_CODE)${NC}"
    echo -e "${BLUE}📄 Resposta: $HEALTH_BODY${NC}"
else
    echo -e "${RED}❌ /health com problema (HTTP $HEALTH_CODE)${NC}"
    echo -e "${BLUE}📄 Resposta: $HEALTH_BODY${NC}"
fi

# Testar rota /api/health
echo -e "${BLUE}🔍 Testando /api/health...${NC}"
API_HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
API_HEALTH_CODE="${API_HEALTH_RESPONSE: -3}"
API_HEALTH_BODY="${API_HEALTH_RESPONSE%???}"

if [ "$API_HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ /api/health funcionando (HTTP $API_HEALTH_CODE)${NC}"
    echo -e "${BLUE}📄 Resposta: $API_HEALTH_BODY${NC}"
else
    echo -e "${RED}❌ /api/health com problema (HTTP $API_HEALTH_CODE)${NC}"
    echo -e "${BLUE}📄 Resposta: $API_HEALTH_BODY${NC}"
fi

# 6. Verificar logs
echo -e "${YELLOW}📋 Verificando logs...${NC}"

if [ -f "logs/app.log" ]; then
    echo -e "${BLUE}📄 Últimas 20 linhas do log:${NC}"
    tail -20 logs/app.log
else
    echo -e "${YELLOW}⚠️ Arquivo de log não encontrado${NC}"
fi

# 7. Verificar sintaxe dos arquivos
echo -e "${YELLOW}🔍 Verificando sintaxe dos arquivos...${NC}"

# Verificar main.js
if node -c src/main.js 2>/dev/null; then
    echo -e "${GREEN}✅ src/main.js - sintaxe OK${NC}"
else
    echo -e "${RED}❌ src/main.js - erro de sintaxe${NC}"
    node -c src/main.js
fi

# Verificar health.js
if node -c src/routes/health.js 2>/dev/null; then
    echo -e "${GREEN}✅ src/routes/health.js - sintaxe OK${NC}"
else
    echo -e "${RED}❌ src/routes/health.js - erro de sintaxe${NC}"
    node -c src/routes/health.js
fi

# Verificar index.js das rotas
if node -c src/routes/index.js 2>/dev/null; then
    echo -e "${GREEN}✅ src/routes/index.js - sintaxe OK${NC}"
else
    echo -e "${RED}❌ src/routes/index.js - erro de sintaxe${NC}"
    node -c src/routes/index.js
fi

# 8. Verificar dependências
echo -e "${YELLOW}📦 Verificando dependências...${NC}"

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules existe${NC}"
    
    # Verificar dependências principais
    if [ -d "node_modules/express" ]; then
        echo -e "${GREEN}✅ Express instalado${NC}"
    else
        echo -e "${RED}❌ Express não encontrado${NC}"
    fi
else
    echo -e "${RED}❌ node_modules não encontrado${NC}"
fi

# 9. Tentar reiniciar se necessário
if [ "$HEALTH_CODE" != "200" ] && [ "$API_HEALTH_CODE" != "200" ]; then
    echo -e "${YELLOW}🔄 Tentando reiniciar DePara...${NC}"
    
    # Parar DePara
    if pgrep -f "node.*main.js" > /dev/null; then
        pkill -f "node.*main.js"
        sleep 3
        echo -e "${GREEN}✅ DePara parado${NC}"
    fi
    
    # Iniciar DePara
    nohup npm start > /dev/null 2>&1 &
    sleep 5
    
    # Verificar se iniciou
    if pgrep -f "node.*main.js" > /dev/null; then
        echo -e "${GREEN}✅ DePara reiniciado${NC}"
        
        # Aguardar e testar novamente
        sleep 3
        
        echo -e "${YELLOW}🧪 Testando após reinicialização...${NC}"
        
        NEW_HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/health 2>/dev/null)
        NEW_HEALTH_CODE="${NEW_HEALTH_RESPONSE: -3}"
        
        if [ "$NEW_HEALTH_CODE" = "200" ]; then
            echo -e "${GREEN}✅ API funcionando após reinicialização${NC}"
        else
            echo -e "${RED}❌ API ainda com problema após reinicialização${NC}"
        fi
    else
        echo -e "${RED}❌ Erro ao reiniciar DePara${NC}"
    fi
fi

# 10. Resumo final
echo -e "${BLUE}📊 Resumo do diagnóstico:${NC}"

if [ "$HEALTH_CODE" = "200" ] || [ "$API_HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ API funcionando corretamente${NC}"
    echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
else
    echo -e "${RED}❌ API com problemas${NC}"
    echo -e "${YELLOW}💡 Verifique os logs e dependências${NC}"
fi

echo -e "${GREEN}🎉 Diagnóstico concluído!${NC}"
