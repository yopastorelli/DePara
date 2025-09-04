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
        logger.info('🔍 Verificando atualizações disponíveis...');

        // Verificar se há atualizações no repositório remoto
        exec('git fetch origin', (error, stdout, stderr) => {
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

                    // Verificar se há commits à frente
        exec('git rev-list HEAD..origin/main --count', (error, stdout, stderr) => {
            if (error) {
                logger.warn('⚠️ Erro ao contar commits:', error.message);
                return res.status(500).json({
                    success: false,
                    error: {
                        message: 'Erro ao contar commits',
                        details: error.message
                    }
                });
            }

            const commitsAhead = parseInt(stdout.trim()) || 0;
            const hasUpdates = commitsAhead > 0;

            // Obter versão atual
            exec('git rev-parse --short HEAD', (versionError, versionStdout, versionStderr) => {
                const currentVersion = versionError ? 'unknown' : versionStdout.trim();

                logger.info(`📊 Verificação de atualizações: ${commitsAhead} commits à frente, versão: ${currentVersion}`);

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

        // Parar DePara atual
        exec('pkill -f "node.*main.js"', (error, stdout, stderr) => {
            if (error) {
                logger.warn('⚠️ Erro ao parar DePara:', error.message);
            }

            // Aguardar um pouco
            setTimeout(() => {
                // Iniciar DePara novamente
                exec('nohup npm start > /dev/null 2>&1 &', (error, stdout, stderr) => {
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

        // Verificar se DePara está rodando
        exec('pgrep -f "node.*main.js"', (error, stdout, stderr) => {
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
