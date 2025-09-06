#!/bin/bash

# Script para resolver conflito do git e executar diagnóstico
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

echo -e "${BLUE}🔧 Resolvendo conflito do git e executando diagnóstico...${NC}"

# 1. Navegar para o diretório
cd "$DEPARA_DIR" || {
    echo -e "${RED}❌ Erro: Não foi possível acessar $DEPARA_DIR${NC}"
    exit 1
}

# 2. Resolver conflito do git
echo -e "${YELLOW}🔧 Resolvendo conflito do git...${NC}"

# Fazer stash das mudanças locais
echo -e "${YELLOW}💾 Fazendo backup das mudanças locais...${NC}"
git stash push -m "Backup antes da resolução do conflito" 2>/dev/null || true

# Atualizar repositório
echo -e "${YELLOW}📥 Atualizando repositório...${NC}"
git pull origin main

# 3. Executar diagnóstico
echo -e "${YELLOW}🔍 Executando diagnóstico da API...${NC}"

# Verificar se o script existe
if [ -f "fix-api-problem.sh" ]; then
    chmod +x fix-api-problem.sh
    ./fix-api-problem.sh
else
    echo -e "${RED}❌ Script fix-api-problem.sh não encontrado${NC}"
    echo -e "${YELLOW}💡 Tentando criar script de diagnóstico básico...${NC}"
    
    # Criar script básico de diagnóstico
    cat > diagnose-api.sh << 'EOF'
#!/bin/bash

echo "🔍 Diagnóstico básico da API DePara..."

# Verificar se DePara está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo "✅ DePara está rodando"
    PID=$(pgrep -f "node.*main.js")
    echo "📊 PID: $PID"
else
    echo "❌ DePara não está rodando"
fi

# Verificar porta 3000
if netstat -tlnp | grep -q ":3000"; then
    echo "✅ Porta 3000 está em uso"
else
    echo "❌ Porta 3000 não está em uso"
fi

# Testar API
echo "🧪 Testando API..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
HEALTH_CODE="${HEALTH_RESPONSE: -3}"

if [ "$HEALTH_CODE" = "200" ]; then
    echo "✅ API funcionando (HTTP $HEALTH_CODE)"
else
    echo "❌ API com problema (HTTP $HEALTH_CODE)"
fi

# Testar rota básica
BASIC_HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/health 2>/dev/null)
BASIC_HEALTH_CODE="${BASIC_HEALTH_RESPONSE: -3}"

if [ "$BASIC_HEALTH_CODE" = "200" ]; then
    echo "✅ Rota básica funcionando (HTTP $BASIC_HEALTH_CODE)"
else
    echo "❌ Rota básica com problema (HTTP $BASIC_HEALTH_CODE)"
fi

echo "🎉 Diagnóstico concluído!"
EOF

    chmod +x diagnose-api.sh
    ./diagnose-api.sh
fi

echo -e "${GREEN}🎉 Processo concluído!${NC}"
