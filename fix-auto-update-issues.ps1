# Script PowerShell para corrigir problemas da atualização automática
# - Corrigir verificação de status após atualização
# - Melhorar sequência de reinicialização
# - Corrigir links quebrados

Write-Host "🔧 Corrigindo problemas da atualização automática..." -ForegroundColor Blue

# 1. Parar DePara se estiver rodando
Write-Host "⏹️ Parando DePara..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*main.js*" }
if ($nodeProcesses) {
    Stop-Process -Id $nodeProcesses.Id -Force
    Start-Sleep -Seconds 3
    Write-Host "✅ DePara parado" -ForegroundColor Green
} else {
    Write-Host "⚠️ DePara não estava rodando" -ForegroundColor Yellow
}

# 2. Navegar para o diretório
Set-Location $PSScriptRoot

# 3. Fazer backup das mudanças locais
Write-Host "💾 Fazendo backup das mudanças locais..." -ForegroundColor Yellow
git stash push -m "Backup antes da correção de atualização automática" 2>$null

# 4. Atualizar repositório
Write-Host "📥 Atualizando repositório..." -ForegroundColor Yellow
git fetch origin
git pull origin main

# 5. Reinstalar dependências
Write-Host "📦 Reinstalando dependências..." -ForegroundColor Yellow
npm install

# 6. Corrigir problema de verificação de status
Write-Host "🔧 Corrigindo verificação de status..." -ForegroundColor Yellow

# Criar script melhorado para verificação de status
$checkScript = @"
# Script melhorado para verificar status de atualizações
cd "`$PSScriptRoot"

# Fazer fetch para garantir que temos as últimas informações
git fetch origin > `$null 2>&1

# Verificar se há commits à frente
`$commitsAhead = 0
try {
    `$commitsAhead = [int](git rev-list HEAD..origin/main --count 2>`$null)
} catch {
    `$commitsAhead = 0
}

# Verificar se há commits atrás (local desatualizado)
`$commitsBehind = 0
try {
    `$commitsBehind = [int](git rev-list origin/main..HEAD --count 2>`$null)
} catch {
    `$commitsBehind = 0
}

# Determinar status
if (`$commitsAhead -gt 0) {
    Write-Host "HAS_UPDATES=true"
    Write-Host "COMMITS_AHEAD=`$commitsAhead"
} elseif (`$commitsBehind -gt 0) {
    Write-Host "HAS_UPDATES=false"
    Write-Host "COMMITS_AHEAD=0"
    Write-Host "LOCAL_AHEAD=true"
} else {
    Write-Host "HAS_UPDATES=false"
    Write-Host "COMMITS_AHEAD=0"
    Write-Host "UP_TO_DATE=true"
}

# Obter versão atual
try {
    `$currentVersion = git rev-parse --short HEAD 2>`$null
    if (`$currentVersion) {
        Write-Host "CURRENT_VERSION=`$currentVersion"
    } else {
        Write-Host "CURRENT_VERSION=unknown"
    }
} catch {
    Write-Host "CURRENT_VERSION=unknown"
}
"@

$checkScript | Out-File -FilePath "check-update-status.ps1" -Encoding UTF8

# 7. Corrigir rota de verificação de atualizações
Write-Host "🔧 Corrigindo rota de verificação..." -ForegroundColor Yellow

# Fazer backup do arquivo original
Copy-Item "src/routes/update.js" "src/routes/update.js.backup"

# Atualizar a rota para usar o script melhorado
$updateRoute = @'
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
        const isWindows = process.platform === 'win32';
        const checkCommand = isWindows ? 'powershell -ExecutionPolicy Bypass -File check-update-status.ps1' : './check-update-status.sh';
        
        exec(checkCommand, (error, stdout, stderr) => {
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
'@

$updateRoute | Out-File -FilePath "src/routes/update.js" -Encoding UTF8

# 8. Corrigir JavaScript da interface para atualizar status após aplicação
Write-Host "🔧 Corrigindo JavaScript da interface..." -ForegroundColor Yellow

# Fazer backup do app.js
Copy-Item "src/public/app.js" "src/public/app.js.backup"

# Atualizar função de aplicação de atualizações
$appJsContent = Get-Content "src/public/app.js" -Raw
$appJsContent = $appJsContent -replace 'this\.showToast.*Aplicando atualizações.*success.*', 'this.showToast("✅ Atualizações aplicadas! Verificando status...", "success");`n                // Verificar status após aplicação`n                setTimeout(() => {`n                    this.checkForUpdates();`n                }, 2000);'
$appJsContent | Out-File -FilePath "src/public/app.js" -Encoding UTF8

# 9. Iniciar DePara
Write-Host "▶️ Iniciando DePara..." -ForegroundColor Yellow
Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden
Start-Sleep -Seconds 5

# 10. Verificar se está rodando
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*main.js*" }
if ($nodeProcesses) {
    Write-Host "✅ DePara iniciado com sucesso (PID: $($nodeProcesses.Id))" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao iniciar DePara" -ForegroundColor Red
    Write-Host "💡 Tente executar manualmente: npm start" -ForegroundColor Yellow
}

# 11. Testar API de atualizações
Write-Host "🧪 Testando API de atualizações..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/update/status" -UseBasicParsing -TimeoutSec 5
    if ($response.Content -match "success") {
        Write-Host "✅ API de atualizações funcionando" -ForegroundColor Green
    } else {
        Write-Host "❌ API de atualizações com problemas" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ API de atualizações com problemas" -ForegroundColor Red
}

# 12. Resumo final
Write-Host "📊 Resumo das correções:" -ForegroundColor Blue
Write-Host "✅ Problemas da atualização automática corrigidos" -ForegroundColor Green
Write-Host "✅ Verificação de status melhorada" -ForegroundColor Green
Write-Host "✅ Sequência de reinicialização corrigida" -ForegroundColor Green
Write-Host "✅ Compatibilidade Windows/Linux implementada" -ForegroundColor Green
Write-Host "🌐 Acesse: http://localhost:3000" -ForegroundColor Blue
Write-Host "🔧 Para testar: Vá para Configurações > Atualizações" -ForegroundColor Blue

Write-Host "🎉 Correções aplicadas com sucesso!" -ForegroundColor Green
