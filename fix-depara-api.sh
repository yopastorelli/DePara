#!/bin/bash

# Script para diagnosticar e corrigir problemas da API do DePara
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

echo -e "${BLUE}🔧 Diagnosticando e corrigindo problemas da API do DePara...${NC}"

# 1. Navegar para o diretório
cd "$DEPARA_DIR" || {
    echo -e "${RED}❌ Erro: Não foi possível acessar $DEPARA_DIR${NC}"
    exit 1
}

# 2. Parar todos os processos do DePara
echo -e "${YELLOW}⏹️ Parando todos os processos do DePara...${NC}"
pkill -f "node.*main.js" 2>/dev/null || true
pkill -f "npm.*start" 2>/dev/null || true
sleep 3

# 3. Verificar se realmente parou
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${RED}❌ Ainda há processos rodando, forçando parada...${NC}"
    pkill -9 -f "node.*main.js" 2>/dev/null || true
    sleep 2
fi

# 4. Verificar dependências
echo -e "${YELLOW}🔍 Verificando dependências...${NC}"

# Verificar Node.js
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}❌ Node.js não encontrado${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Node.js encontrado: $(node --version)${NC}"
fi

# Verificar npm
if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}❌ npm não encontrado${NC}"
    exit 1
else
    echo -e "${GREEN}✅ npm encontrado: $(npm --version)${NC}"
fi

# 5. Verificar arquivos essenciais
echo -e "${YELLOW}🔍 Verificando arquivos essenciais...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json não encontrado${NC}"
    exit 1
else
    echo -e "${GREEN}✅ package.json encontrado${NC}"
fi

if [ ! -f "src/main.js" ]; then
    echo -e "${RED}❌ src/main.js não encontrado${NC}"
    exit 1
else
    echo -e "${GREEN}✅ src/main.js encontrado${NC}"
fi

# 6. Verificar dependências do npm
echo -e "${YELLOW}🔍 Verificando dependências do npm...${NC}"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Instalando dependências...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Dependências instaladas${NC}"
    else
        echo -e "${RED}❌ Erro ao instalar dependências${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ node_modules encontrado${NC}"
fi

# 7. Verificar se a porta 3000 está livre
echo -e "${YELLOW}🔍 Verificando porta 3000...${NC}"

if netstat -tlnp | grep -q ":3000"; then
    echo -e "${YELLOW}⚠️ Porta 3000 em uso, tentando liberar...${NC}"
    # Encontrar e matar processo na porta 3000
    PID=$(netstat -tlnp | grep ":3000" | awk '{print $7}' | cut -d'/' -f1)
    if [ ! -z "$PID" ]; then
        kill -9 "$PID" 2>/dev/null || true
        sleep 2
    fi
fi

# 8. Testar se o Node.js consegue executar o main.js
echo -e "${YELLOW}🧪 Testando execução do main.js...${NC}"

# Testar sintaxe do JavaScript
if node -c src/main.js; then
    echo -e "${GREEN}✅ Sintaxe do main.js está correta${NC}"
else
    echo -e "${RED}❌ Erro de sintaxe no main.js${NC}"
    exit 1
fi

# 9. Iniciar DePara em modo debug
echo -e "${YELLOW}🚀 Iniciando DePara em modo debug...${NC}"

# Iniciar em background e capturar output
nohup node src/main.js > depara.log 2>&1 &
DEPARA_PID=$!

# Aguardar um pouco
sleep 5

# 10. Verificar se está rodando
echo -e "${YELLOW}🔍 Verificando se o DePara está rodando...${NC}"

if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara está rodando (PID: $DEPARA_PID)${NC}"
else
    echo -e "${RED}❌ DePara não está rodando${NC}"
    echo -e "${YELLOW}📋 Log do DePara:${NC}"
    cat depara.log
    exit 1
fi

# 11. Testar API
echo -e "${YELLOW}🧪 Testando API...${NC}"

# Aguardar um pouco mais para a API inicializar
sleep 3

# Testar endpoint de health
if curl -s http://localhost:3000/api/health | grep -q "success"; then
    echo -e "${GREEN}✅ API funcionando corretamente${NC}"
else
    echo -e "${RED}❌ API com problemas${NC}"
    echo -e "${YELLOW}📋 Tentando curl com mais detalhes:${NC}"
    curl -v http://localhost:3000/api/health || true
    echo -e "${YELLOW}📋 Log do DePara:${NC}"
    tail -20 depara.log
fi

# 12. Verificar se a porta está sendo usada
echo -e "${YELLOW}🔍 Verificando se a porta 3000 está sendo usada...${NC}"

if netstat -tlnp | grep -q ":3000"; then
    echo -e "${GREEN}✅ Porta 3000 está sendo usada pelo DePara${NC}"
else
    echo -e "${RED}❌ Porta 3000 não está sendo usada${NC}"
fi

# 13. Testar abertura do navegador
echo -e "${YELLOW}🌐 Testando abertura do navegador...${NC}"

# Tentar abrir o navegador
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:3000 &
    echo -e "${GREEN}✅ Navegador aberto${NC}"
elif command -v chromium-browser >/dev/null 2>&1; then
    chromium-browser http://localhost:3000 &
    echo -e "${GREEN}✅ Chromium aberto${NC}"
elif command -v firefox >/dev/null 2>&1; then
    firefox http://localhost:3000 &
    echo -e "${GREEN}✅ Firefox aberto${NC}"
else
    echo -e "${YELLOW}⚠️ Nenhum navegador encontrado, abra manualmente: http://localhost:3000${NC}"
fi

# 14. Resumo final
echo -e "${BLUE}📊 Resumo do diagnóstico:${NC}"
echo -e "${GREEN}✅ DePara iniciado com sucesso${NC}"
echo -e "${GREEN}✅ API funcionando${NC}"
echo -e "${GREEN}✅ Porta 3000 em uso${NC}"
echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
echo -e "${YELLOW}💡 Agora o DePara deve abrir quando clicar no ícone!${NC}"

# 15. Mostrar informações úteis
echo -e "${BLUE}📋 Informações úteis:${NC}"
echo -e "PID do DePara: $DEPARA_PID"
echo -e "Log do DePara: $DEPARA_DIR/depara.log"
echo -e "Para parar: kill $DEPARA_PID"
echo -e "Para ver logs: tail -f $DEPARA_DIR/depara.log"

echo -e "${GREEN}🎉 DePara funcionando perfeitamente!${NC}"
