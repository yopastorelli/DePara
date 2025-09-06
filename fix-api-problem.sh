#!/bin/bash

# Script para diagnosticar e corrigir problema da API
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

echo -e "${BLUE}🔧 Diagnosticando e corrigindo problema da API...${NC}"

# 1. Navegar para o diretório
cd "$DEPARA_DIR" || {
    echo -e "${RED}❌ Erro: Não foi possível acessar $DEPARA_DIR${NC}"
    exit 1
}

# 2. Verificar se o DePara está rodando
echo -e "${YELLOW}🔍 Verificando se o DePara está rodando...${NC}"

if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara está rodando${NC}"
    
    # Obter PID do processo
    PID=$(pgrep -f "node.*main.js")
    echo -e "${BLUE}📊 PID do DePara: $PID${NC}"
    
    # Verificar porta 3000
    if netstat -tlnp | grep -q ":3000"; then
        echo -e "${GREEN}✅ Porta 3000 está em uso${NC}"
    else
        echo -e "${RED}❌ Porta 3000 não está em uso${NC}"
    fi
else
    echo -e "${RED}❌ DePara não está rodando${NC}"
fi

# 3. Testar API diretamente
echo -e "${YELLOW}🧪 Testando API diretamente...${NC}"

# Testar rota de health
echo -e "${BLUE}🔍 Testando /api/health...${NC}"
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
HEALTH_CODE="${HEALTH_RESPONSE: -3}"
HEALTH_BODY="${HEALTH_RESPONSE%???}"

if [ "$HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ /api/health funcionando (HTTP $HEALTH_CODE)${NC}"
    echo -e "${BLUE}📄 Resposta: $HEALTH_BODY${NC}"
else
    echo -e "${RED}❌ /api/health com problema (HTTP $HEALTH_CODE)${NC}"
    echo -e "${BLUE}📄 Resposta: $HEALTH_BODY${NC}"
fi

# Testar rota de health básica
echo -e "${BLUE}🔍 Testando /health...${NC}"
BASIC_HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/health 2>/dev/null)
BASIC_HEALTH_CODE="${BASIC_HEALTH_RESPONSE: -3}"
BASIC_HEALTH_BODY="${BASIC_HEALTH_RESPONSE%???}"

if [ "$BASIC_HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ /health funcionando (HTTP $BASIC_HEALTH_CODE)${NC}"
    echo -e "${BLUE}📄 Resposta: $BASIC_HEALTH_BODY${NC}"
else
    echo -e "${RED}❌ /health com problema (HTTP $BASIC_HEALTH_CODE)${NC}"
    echo -e "${BLUE}📄 Resposta: $BASIC_HEALTH_BODY${NC}"
fi

# 4. Verificar logs do DePara
echo -e "${YELLOW}📋 Verificando logs do DePara...${NC}"

if [ -f "logs/app.log" ]; then
    echo -e "${BLUE}📄 Últimas 10 linhas do log:${NC}"
    tail -10 logs/app.log
else
    echo -e "${YELLOW}⚠️ Arquivo de log não encontrado${NC}"
fi

# 5. Verificar se há erros de sintaxe
echo -e "${YELLOW}🔍 Verificando sintaxe dos arquivos...${NC}"

# Verificar sintaxe do main.js
if node -c src/main.js 2>/dev/null; then
    echo -e "${GREEN}✅ src/main.js - sintaxe OK${NC}"
else
    echo -e "${RED}❌ src/main.js - erro de sintaxe${NC}"
    node -c src/main.js
fi

# Verificar sintaxe do health.js
if node -c src/routes/health.js 2>/dev/null; then
    echo -e "${GREEN}✅ src/routes/health.js - sintaxe OK${NC}"
else
    echo -e "${RED}❌ src/routes/health.js - erro de sintaxe${NC}"
    node -c src/routes/health.js
fi

# Verificar sintaxe do index.js das rotas
if node -c src/routes/index.js 2>/dev/null; then
    echo -e "${GREEN}✅ src/routes/index.js - sintaxe OK${NC}"
else
    echo -e "${RED}❌ src/routes/index.js - erro de sintaxe${NC}"
    node -c src/routes/index.js
fi

# 6. Reiniciar DePara se necessário
if [ "$HEALTH_CODE" != "200" ] || [ "$BASIC_HEALTH_CODE" != "200" ]; then
    echo -e "${YELLOW}🔄 Reiniciando DePara...${NC}"
    
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
        echo -e "${GREEN}✅ DePara reiniciado com sucesso${NC}"
        
        # Aguardar um pouco e testar novamente
        sleep 3
        
        # Testar API novamente
        echo -e "${YELLOW}🧪 Testando API após reinicialização...${NC}"
        
        NEW_HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
        NEW_HEALTH_CODE="${NEW_HEALTH_RESPONSE: -3}"
        NEW_HEALTH_BODY="${NEW_HEALTH_RESPONSE%???}"
        
        if [ "$NEW_HEALTH_CODE" = "200" ]; then
            echo -e "${GREEN}✅ API funcionando após reinicialização (HTTP $NEW_HEALTH_CODE)${NC}"
            echo -e "${BLUE}📄 Resposta: $NEW_HEALTH_BODY${NC}"
        else
            echo -e "${RED}❌ API ainda com problema após reinicialização (HTTP $NEW_HEALTH_CODE)${NC}"
            echo -e "${BLUE}📄 Resposta: $NEW_HEALTH_BODY${NC}"
        fi
    else
        echo -e "${RED}❌ Erro ao reiniciar DePara${NC}"
    fi
fi

# 7. Verificar dependências
echo -e "${YELLOW}📦 Verificando dependências...${NC}"

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules existe${NC}"
    
    # Verificar se as dependências principais estão instaladas
    if [ -d "node_modules/express" ]; then
        echo -e "${GREEN}✅ Express instalado${NC}"
    else
        echo -e "${RED}❌ Express não encontrado${NC}"
    fi
    
    if [ -d "node_modules/cors" ]; then
        echo -e "${GREEN}✅ CORS instalado${NC}"
    else
        echo -e "${YELLOW}⚠️ CORS não encontrado (pode ser normal)${NC}"
    fi
    
    if [ -d "node_modules/helmet" ]; then
        echo -e "${GREEN}✅ Helmet instalado${NC}"
    else
        echo -e "${YELLOW}⚠️ Helmet não encontrado (pode ser normal)${NC}"
    fi
else
    echo -e "${RED}❌ node_modules não encontrado${NC}"
    echo -e "${YELLOW}💡 Execute: npm install${NC}"
fi

# 8. Resumo final
echo -e "${BLUE}📊 Resumo do diagnóstico:${NC}"

if [ "$HEALTH_CODE" = "200" ] || [ "$BASIC_HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ API funcionando corretamente${NC}"
    echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
    echo -e "${BLUE}🔧 Interface: http://localhost:3000/ui${NC}"
else
    echo -e "${RED}❌ API com problemas${NC}"
    echo -e "${YELLOW}💡 Verifique os logs e dependências${NC}"
fi

echo -e "${GREEN}🎉 Diagnóstico concluído!${NC}"
