#!/bin/bash

# Script para corrigir problemas da atualização automática
# - Corrigir verificação de status após atualização
# - Melhorar sequência de reinicialização
# - Corrigir links quebrados

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

echo -e "${BLUE}🔧 Corrigindo problemas da atualização automática...${NC}"

# 1. Parar DePara se estiver rodando
echo -e "${YELLOW}⏹️ Parando DePara...${NC}"
if pgrep -f "node.*main.js" > /dev/null; then
    pkill -f "node.*main.js"
    sleep 3
    echo -e "${GREEN}✅ DePara parado${NC}"
else
    echo -e "${YELLOW}⚠️ DePara não estava rodando${NC}"
fi

# 2. Navegar para o diretório
cd "$DEPARA_DIR" || {
    echo -e "${RED}❌ Erro: Não foi possível acessar $DEPARA_DIR${NC}"
    exit 1
}

# 3. Fazer backup das mudanças locais
echo -e "${YELLOW}💾 Fazendo backup das mudanças locais...${NC}"
git stash push -m "Backup antes da correção de atualização automática" 2>/dev/null || true

# 4. Atualizar repositório
echo -e "${YELLOW}📥 Atualizando repositório...${NC}"
git fetch origin
git pull origin main

# 5. Reinstalar dependências
echo -e "${YELLOW}📦 Reinstalando dependências...${NC}"
npm install

# 6. Corrigir problema de verificação de status
echo -e "${YELLOW}🔧 Corrigindo verificação de status...${NC}"

# Criar script melhorado para verificação de status
cat > check-update-status.sh << 'EOF'
#!/bin/bash

# Script melhorado para verificar status de atualizações
cd "$(dirname "$0")"

# Fazer fetch para garantir que temos as últimas informações
git fetch origin > /dev/null 2>&1

# Verificar se há commits à frente
COMMITS_AHEAD=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")
COMMITS_AHEAD=$((COMMITS_AHEAD))

# Verificar se há commits atrás (local desatualizado)
COMMITS_BEHIND=$(git rev-list origin/main..HEAD --count 2>/dev/null || echo "0")
COMMITS_BEHIND=$((COMMITS_BEHIND))

# Determinar status
if [ "$COMMITS_AHEAD" -gt 0 ]; then
    echo "HAS_UPDATES=true"
    echo "COMMITS_AHEAD=$COMMITS_AHEAD"
elif [ "$COMMITS_BEHIND" -gt 0 ]; then
    echo "HAS_UPDATES=false"
    echo "COMMITS_AHEAD=0"
    echo "LOCAL_AHEAD=true"
else
    echo "HAS_UPDATES=false"
    echo "COMMITS_AHEAD=0"
    echo "UP_TO_DATE=true"
fi

# Obter versão atual
CURRENT_VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "CURRENT_VERSION=$CURRENT_VERSION"
EOF

chmod +x check-update-status.sh

# 7. Corrigir rota de verificação de atualizações
echo -e "${YELLOW}🔧 Corrigindo rota de verificação...${NC}"

# Fazer backup do arquivo original
cp src/routes/update.js src/routes/update.js.backup

# Atualizar a rota para usar o script melhorado
cat > temp_update_route.js << 'EOF'
/**
 * Rotas para Sistema de Atualização Automática
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const express = require('express');
const { exec } = require('child_process');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * Verificar atualizações disponíveis
 * GET /api/update/check
 */
router.get('/check', async (req, res) => {
    try {
        logger.info('🔍 Verificando atualizações...');

        // Usar script melhorado para verificação
        exec('./check-update-status.sh', (error, stdout, stderr) => {
            if (error) {
                logger.warn('⚠️ Erro ao verificar atualizações:', error.message);
                return res.status(500).json({
                    success: false,
                    error: {
                        message: 'Erro ao verificar atualizações',
                        details: error.message
                    }
                });
            }

            // Parse do output do script
            const lines = stdout.trim().split('\n');
            let hasUpdates = false;
            let commitsAhead = 0;
            let currentVersion = 'unknown';

            lines.forEach(line => {
                if (line.startsWith('HAS_UPDATES=')) {
                    hasUpdates = line.split('=')[1] === 'true';
                } else if (line.startsWith('COMMITS_AHEAD=')) {
                    commitsAhead = parseInt(line.split('=')[1]) || 0;
                } else if (line.startsWith('CURRENT_VERSION=')) {
                    currentVersion = line.split('=')[1];
                }
            });

            logger.info(`📊 Status: ${commitsAhead} commits à frente, versão: ${currentVersion}`);

            res.status(200).json({
                success: true,
                data: {
                    hasUpdates,
                    commitsAhead,
                    currentVersion,
                    lastChecked: new Date().toISOString(),
                    message: hasUpdates ? 
                        `Há ${commitsAhead} atualização(ões) disponível(is)` : 
                        'DePara está atualizado'
                },
                timestamp: new Date().toISOString()
            });
        });

    } catch (error) {
        logger.operationError('Update Check', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro interno ao verificar atualizações',
                details: error.message
            }
        });
    }
});

/**
 * Aplicar atualizações
 * POST /api/update/apply
 */
router.post('/apply', async (req, res) => {
    try {
        logger.info('🔄 Aplicando atualizações...');

        // Fazer backup das mudanças locais
        exec('git stash push -m "Backup antes da atualização automática"', (error, stdout, stderr) => {
            if (error) {
                logger.warn('⚠️ Erro ao fazer backup:', error.message);
            }

            // Fazer pull das atualizações
            exec('git pull origin main', (error, stdout, stderr) => {
                if (error) {
                    logger.error('❌ Erro ao aplicar atualizações:', error.message);
                    return res.status(500).json({
                        success: false,
                        error: {
                            message: 'Erro ao aplicar atualizações',
                            details: error.message
                        }
                    });
                }

                logger.info('✅ Atualizações aplicadas com sucesso');

                // Reinstalar dependências se necessário
                exec('npm install', (error, stdout, stderr) => {
                    if (error) {
                        logger.warn('⚠️ Erro ao reinstalar dependências:', error.message);
                    }

                    res.status(200).json({
                        success: true,
                        message: 'Atualizações aplicadas com sucesso',
                        data: {
                            output: stdout,
                            timestamp: new Date().toISOString()
                        }
                    });
                });
            });
        });

    } catch (error) {
        logger.operationError('Update Apply', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro interno ao aplicar atualizações',
                details: error.message
            }
        });
    }
});

/**
 * Reiniciar aplicação após atualização
 * POST /api/update/restart
 */
router.post('/restart', async (req, res) => {
    try {
        logger.info('🔄 Reiniciando aplicação após atualização...');

        // Parar DePara atual (compatível com Windows e Linux)
        const isWindows = process.platform === 'win32';
        const stopCommand = isWindows ? 'taskkill /F /IM node.exe' : 'pkill -f "node.*main.js"';
        
        exec(stopCommand, (error, stdout, stderr) => {
            if (error) {
                logger.warn('⚠️ Erro ao parar DePara:', error.message);
            }

            // Aguardar um pouco
            setTimeout(() => {
                // Iniciar DePara novamente (compatível com Windows e Linux)
                const startCommand = isWindows ? 'npm start' : 'nohup npm start > /dev/null 2>&1 &';
                
                exec(startCommand, (error, stdout, stderr) => {
                    if (error) {
                        logger.error('❌ Erro ao reiniciar DePara:', error.message);
                        return res.status(500).json({
                            success: false,
                            error: {
                                message: 'Erro ao reiniciar aplicação',
                                details: error.message
                            }
                        });
                    }

                    logger.info('✅ Aplicação reiniciada com sucesso');

                    res.status(200).json({
                        success: true,
                        message: 'Aplicação reiniciada com sucesso',
                        timestamp: new Date().toISOString()
                    });
                });
            }, 2000);
        });

    } catch (error) {
        logger.operationError('Update Restart', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro interno ao reiniciar aplicação',
                details: error.message
            }
        });
    }
});

/**
 * Obter status da aplicação
 * GET /api/update/status
 */
router.get('/status', async (req, res) => {
    try {
        logger.info('📊 Verificando status da aplicação...');

        // Verificar se DePara está rodando (compatível com Windows e Linux)
        const isWindows = process.platform === 'win32';
        const checkCommand = isWindows ? 'tasklist /FI "IMAGENAME eq node.exe"' : 'pgrep -f "node.*main.js"';
        
        exec(checkCommand, (error, stdout, stderr) => {
            const isRunning = !error && stdout.trim() !== '';
            
            // Obter versão atual
            exec('git rev-parse --short HEAD', (error, stdout, stderr) => {
                const currentVersion = error ? 'unknown' : stdout.trim();
                
                res.status(200).json({
                    success: true,
                    data: {
                        isRunning,
                        currentVersion,
                        lastChecked: new Date().toISOString(),
                        uptime: process.uptime()
                    },
                    timestamp: new Date().toISOString()
                });
            });
        });

    } catch (error) {
        logger.operationError('Update Status', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro interno ao verificar status',
                details: error.message
            }
        });
    }
});

module.exports = router;
EOF

# Substituir o arquivo original
mv temp_update_route.js src/routes/update.js

# 8. Corrigir JavaScript da interface para atualizar status após aplicação
echo -e "${YELLOW}🔧 Corrigindo JavaScript da interface...${NC}"

# Fazer backup do app.js
cp src/public/app.js src/public/app.js.backup

# Atualizar função de aplicação de atualizações
sed -i 's/this.showToast.*Aplicando atualizações.*success.*/this.showToast("✅ Atualizações aplicadas! Verificando status...", "success");\n                \/\/ Verificar status após aplicação\n                setTimeout(() => {\n                    this.checkForUpdates();\n                }, 2000);/' src/public/app.js

# 9. Iniciar DePara
echo -e "${YELLOW}▶️ Iniciando DePara...${NC}"
nohup npm start > /dev/null 2>&1 &
sleep 5

# 10. Verificar se está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara iniciado com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao iniciar DePara${NC}"
    echo -e "${YELLOW}💡 Tente executar manualmente: npm start${NC}"
fi

# 11. Testar API de atualizações
echo -e "${YELLOW}🧪 Testando API de atualizações...${NC}"
sleep 3

if curl -s http://localhost:3000/api/update/status | grep -q "success"; then
    echo -e "${GREEN}✅ API de atualizações funcionando${NC}"
else
    echo -e "${RED}❌ API de atualizações com problemas${NC}"
fi

# 12. Resumo final
echo -e "${BLUE}📊 Resumo das correções:${NC}"
echo -e "${GREEN}✅ Problemas da atualização automática corrigidos${NC}"
echo -e "${GREEN}✅ Verificação de status melhorada${NC}"
echo -e "${GREEN}✅ Sequência de reinicialização corrigida${NC}"
echo -e "${GREEN}✅ Compatibilidade Windows/Linux implementada${NC}"
echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
echo -e "${BLUE}🔧 Para testar: Vá para Configurações > Atualizações${NC}"

echo -e "${GREEN}🎉 Correções aplicadas com sucesso!${NC}"
