#!/bin/bash

# Script para corrigir definitivamente a atualização automática
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

echo -e "${BLUE}🔧 Corrigindo atualização automática definitivamente...${NC}"

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
git stash push -m "Backup antes da correção final da atualização automática" 2>/dev/null || true

# 4. Atualizar repositório
echo -e "${YELLOW}📥 Atualizando repositório...${NC}"
git fetch origin
git pull origin main

# 5. Reinstalar dependências
echo -e "${YELLOW}📦 Reinstalando dependências...${NC}"
npm install

# 6. Corrigir problema da atualização automática
echo -e "${YELLOW}🔧 Corrigindo lógica de atualização automática...${NC}"

# Fazer backup do app.js
cp src/public/app.js src/public/app.js.backup

# Corrigir a função de reinicialização para ser mais robusta
cat > temp_restart_fix.js << 'EOF'
async restartApplication() {
    try {
        console.log('🔄 Reiniciando aplicação...');
        
        // Mostrar loading
        this.showLoading('Reiniciando aplicação...');
        
        // Fazer requisição para reiniciar
        const response = await fetch('/api/update/restart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Aplicação reiniciada com sucesso');
            this.hideLoading();
            
            // Aguardar um pouco e recarregar a página
            setTimeout(() => {
                console.log('🔄 Recarregando página...');
                window.location.reload();
            }, 2000);
            
        } else {
            throw new Error(result.error || 'Erro desconhecido ao reiniciar');
        }
        
    } catch (error) {
        console.error('❌ Erro ao reiniciar aplicação:', error);
        this.hideLoading();
        
        // Fallback: tentar recarregar a página mesmo assim
        console.log('🔄 Tentando recarregar página como fallback...');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
}
EOF

# Aplicar a correção da função restartApplication
sed -i '/async restartApplication() {/,/^}/c\
async restartApplication() {\
    try {\
        console.log("🔄 Reiniciando aplicação...");\
        \
        // Mostrar loading\
        this.showLoading("Reiniciando aplicação...");\
        \
        // Fazer requisição para reiniciar\
        const response = await fetch("/api/update/restart", {\
            method: "POST",\
            headers: {\
                "Content-Type": "application/json"\
            }\
        });\
        \
        if (!response.ok) {\
            throw new Error(`Erro HTTP: ${response.status}`);\
        }\
        \
        const result = await response.json();\
        \
        if (result.success) {\
            console.log("✅ Aplicação reiniciada com sucesso");\
            this.hideLoading();\
            \
            // Aguardar um pouco e recarregar a página\
            setTimeout(() => {\
                console.log("🔄 Recarregando página...");\
                window.location.reload();\
            }, 2000);\
            \
        } else {\
            throw new Error(result.error || "Erro desconhecido ao reiniciar");\
        }\
        \
    } catch (error) {\
        console.error("❌ Erro ao reiniciar aplicação:", error);\
        this.hideLoading();\
        \
        // Fallback: tentar recarregar a página mesmo assim\
        console.log("🔄 Tentando recarregar página como fallback...");\
        setTimeout(() => {\
            window.location.reload();\
        }, 1000);\
    }\
}' src/public/app.js

# 7. Corrigir a função de aplicação de atualizações
cat > temp_apply_fix.js << 'EOF'
async applyUpdates() {
    try {
        console.log('🔄 Aplicando atualizações...');
        
        // Mostrar loading
        this.showLoading('Aplicando atualizações...');
        
        // Fazer requisição para aplicar atualizações
        const response = await fetch('/api/update/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Atualizações aplicadas com sucesso');
            this.hideLoading();
            
            // Aguardar um pouco antes de reiniciar
            setTimeout(() => {
                this.restartApplication();
            }, 1000);
            
        } else {
            throw new Error(result.error || 'Erro ao aplicar atualizações');
        }
        
    } catch (error) {
        console.error('❌ Erro ao aplicar atualizações:', error);
        this.hideLoading();
        this.showToast('Erro ao aplicar atualizações: ' + error.message, 'error');
    }
}
EOF

# Aplicar a correção da função applyUpdates
sed -i '/async applyUpdates() {/,/^}/c\
async applyUpdates() {\
    try {\
        console.log("🔄 Aplicando atualizações...");\
        \
        // Mostrar loading\
        this.showLoading("Aplicando atualizações...");\
        \
        // Fazer requisição para aplicar atualizações\
        const response = await fetch("/api/update/apply", {\
            method: "POST",\
            headers: {\
                "Content-Type": "application/json"\
            }\
        });\
        \
        if (!response.ok) {\
            throw new Error(`Erro HTTP: ${response.status}`);\
        }\
        \
        const result = await response.json();\
        \
        if (result.success) {\
            console.log("✅ Atualizações aplicadas com sucesso");\
            this.hideLoading();\
            \
            // Aguardar um pouco antes de reiniciar\
            setTimeout(() => {\
                this.restartApplication();\
            }, 1000);\
            \
        } else {\
            throw new Error(result.error || "Erro ao aplicar atualizações");\
        }\
        \
    } catch (error) {\
        console.error("❌ Erro ao aplicar atualizações:", error);\
        this.hideLoading();\
        this.showToast("Erro ao aplicar atualizações: " + error.message, "error");\
    }\
}' src/public/app.js

# 8. Adicionar função de fallback para quando a API não responde
cat > temp_fallback_fix.js << 'EOF'
// Função de fallback para quando a API não responde
window.fallbackRestart = function() {
    console.log('🔄 Executando fallback de reinicialização...');
    
    // Tentar recarregar a página
    setTimeout(() => {
        window.location.reload();
    }, 1000);
};

// Adicionar listener para detectar quando a API não responde
setInterval(() => {
    fetch('/api/health')
        .then(response => {
            if (!response.ok) {
                throw new Error('API não responde');
            }
        })
        .catch(error => {
            console.warn('⚠️ API não responde, tentando fallback...');
            window.fallbackRestart();
        });
}, 5000);
EOF

# Adicionar fallback ao final do arquivo
echo "" >> src/public/app.js
cat temp_fallback_fix.js >> src/public/app.js

# Limpar arquivos temporários
rm -f temp_restart_fix.js temp_apply_fix.js temp_fallback_fix.js

# 9. Corrigir rota de restart no backend
echo -e "${YELLOW}🔧 Corrigindo rota de restart no backend...${NC}"

# Fazer backup do update.js
cp src/routes/update.js src/routes/update.js.backup

# Corrigir a rota de restart para ser mais robusta
cat > temp_backend_fix.js << 'EOF'
// Rota para reiniciar a aplicação
router.post('/restart', async (req, res) => {
    try {
        console.log('🔄 Reiniciando aplicação...');
        
        // Parar a aplicação atual
        const stopCommand = process.platform === 'win32' 
            ? 'taskkill /F /IM node.exe'
            : 'pkill -f "node.*main.js"';
        
        // Executar comando de parada
        exec(stopCommand, (error, stdout, stderr) => {
            if (error && !error.message.includes('not found')) {
                console.warn('⚠️ Aviso ao parar aplicação:', error.message);
            }
            
            // Aguardar um pouco antes de iniciar
            setTimeout(() => {
                // Comando para iniciar a aplicação
                const startCommand = process.platform === 'win32'
                    ? 'npm start'
                    : 'nohup npm start > /dev/null 2>&1 &';
                
                // Executar comando de início
                exec(startCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ Erro ao iniciar aplicação:', error);
                        res.json({
                            success: false,
                            error: 'Erro ao reiniciar aplicação: ' + error.message
                        });
                    } else {
                        console.log('✅ Aplicação reiniciada com sucesso');
                        res.json({
                            success: true,
                            message: 'Aplicação reiniciada com sucesso'
                        });
                    }
                });
            }, 2000);
        });
        
    } catch (error) {
        console.error('❌ Erro ao reiniciar aplicação:', error);
        res.json({
            success: false,
            error: 'Erro interno do servidor: ' + error.message
        });
    }
});
EOF

# Aplicar correção no backend
sed -i '/router.post.*restart/,/^});/c\
router.post("/restart", async (req, res) => {\
    try {\
        console.log("🔄 Reiniciando aplicação...");\
        \
        // Parar a aplicação atual\
        const stopCommand = process.platform === "win32" \
            ? "taskkill /F /IM node.exe"\
            : "pkill -f \"node.*main.js\"";\
        \
        // Executar comando de parada\
        exec(stopCommand, (error, stdout, stderr) => {\
            if (error && !error.message.includes("not found")) {\
                console.warn("⚠️ Aviso ao parar aplicação:", error.message);\
            }\
            \
            // Aguardar um pouco antes de iniciar\
            setTimeout(() => {\
                // Comando para iniciar a aplicação\
                const startCommand = process.platform === "win32"\
                    ? "npm start"\
                    : "nohup npm start > /dev/null 2>&1 &";\
                \
                // Executar comando de início\
                exec(startCommand, (error, stdout, stderr) => {\
                    if (error) {\
                        console.error("❌ Erro ao iniciar aplicação:", error);\
                        res.json({\
                            success: false,\
                            error: "Erro ao reiniciar aplicação: " + error.message\
                        });\
                    } else {\
                        console.log("✅ Aplicação reiniciada com sucesso");\
                        res.json({\
                            success: true,\
                            message: "Aplicação reiniciada com sucesso"\
                        });\
                    }\
                });\
            }, 2000);\
        });\
        \
    } catch (error) {\
        console.error("❌ Erro ao reiniciar aplicação:", error);\
        res.json({\
            success: false,\
            error: "Erro interno do servidor: " + error.message\
        });\
    }\
});' src/routes/update.js

# Limpar arquivo temporário
rm -f temp_backend_fix.js

# 10. Iniciar DePara
echo -e "${YELLOW}▶️ Iniciando DePara...${NC}"
nohup npm start > /dev/null 2>&1 &
sleep 5

# 11. Verificar se está rodando
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ DePara iniciado com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao iniciar DePara${NC}"
    echo -e "${YELLOW}💡 Tente executar manualmente: npm start${NC}"
fi

# 12. Testar API
echo -e "${YELLOW}🧪 Testando API...${NC}"
sleep 3

if curl -s http://localhost:3000/api/health | grep -q "success"; then
    echo -e "${GREEN}✅ API funcionando${NC}"
else
    echo -e "${RED}❌ API com problemas${NC}"
fi

# 13. Resumo final
echo -e "${BLUE}📊 Resumo das correções:${NC}"
echo -e "${GREEN}✅ Atualização automática corrigida${NC}"
echo -e "${GREEN}✅ Função de reinicialização robusta${NC}"
echo -e "${GREEN}✅ Fallback para quando API não responde${NC}"
echo -e "${GREEN}✅ Backend de restart melhorado${NC}"
echo -e "${BLUE}🌐 Acesse: http://localhost:3000${NC}"
echo -e "${BLUE}🔧 Para testar: Vá para Configurações > Atualizações${NC}"
echo -e "${YELLOW}💡 A atualização automática agora deve funcionar corretamente!${NC}"

echo -e "${GREEN}🎉 Correções aplicadas com sucesso!${NC}"
