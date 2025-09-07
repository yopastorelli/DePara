/**
 * Rotas para System Tray
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const express = require('express');
const { exec } = require('child_process');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * Minimizar aplicação para system tray
 * POST /api/tray/minimize
 */
router.post('/minimize', async (req, res) => {
    try {
        logger.info('📱 Minimizando aplicação para system tray...');

        // Executar comando para minimizar janelas do navegador
        const command = `wmctrl -l | grep -E "(DePara|localhost:3000|Chromium|Chrome|Firefox)" | awk '{print $1}' | while read window_id; do wmctrl -i -r "$window_id" -b add,hidden,below,sticky 2>/dev/null; wmctrl -i -r "$window_id" -e 0,-1,-1,1,1 2>/dev/null; done`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                logger.warn('⚠️ Erro ao minimizar para system tray:', error.message);
                return res.status(500).json({
                    success: false,
                    error: {
                        message: 'Erro ao minimizar para system tray',
                        details: error.message
                    }
                });
            }

            logger.info('✅ Aplicação minimizada para system tray');
            res.status(200).json({
                success: true,
                message: 'Aplicação minimizada para system tray',
                timestamp: new Date().toISOString()
            });
        });

    } catch (error) {
        logger.operationError('Tray Minimize', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro interno ao minimizar para system tray',
                details: error.message
            }
        });
    }
});

/**
 * Restaurar aplicação do system tray
 * POST /api/tray/restore
 */
router.post('/restore', async (req, res) => {
    try {
        logger.info('📱 Restaurando aplicação do system tray...');

        // Executar comando para restaurar janelas do navegador
        const command = `wmctrl -l | grep -E "(DePara|localhost:3000|Chromium|Chrome|Firefox)" | awk '{print $1}' | while read window_id; do wmctrl -i -r "$window_id" -b remove,hidden 2>/dev/null; wmctrl -i -a "$window_id" 2>/dev/null; done`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                logger.warn('⚠️ Erro ao restaurar do system tray:', error.message);
                return res.status(500).json({
                    success: false,
                    error: {
                        message: 'Erro ao restaurar do system tray',
                        details: error.message
                    }
                });
            }

            logger.info('✅ Aplicação restaurada do system tray');
            res.status(200).json({
                success: true,
                message: 'Aplicação restaurada do system tray',
                timestamp: new Date().toISOString()
            });
        });

    } catch (error) {
        logger.operationError('Tray Restore', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro interno ao restaurar do system tray',
                details: error.message
            }
        });
    }
});

/**
 * Abrir aplicação em janela dedicada
 * POST /api/tray/open-dedicated
 */
router.post('/open-dedicated', async (req, res) => {
    try {
        logger.info('🪟 Abrindo aplicação em janela dedicada...');

        // Detectar navegador disponível
        const browsers = [
            'firefox --new-window --app=http://localhost:3000',
            'chromium-browser --new-window --app=http://localhost:3000',
            'google-chrome --new-window --app=http://localhost:3000',
            'firefox http://localhost:3000',
            'chromium-browser http://localhost:3000'
        ];

        let browserFound = false;
        let command = '';

        // Verificar qual navegador está disponível
        for (const browserCmd of browsers) {
            const browserName = browserCmd.split(' ')[0];
            exec(`which ${browserName}`, (error, stdout, stderr) => {
                if (!error && stdout.trim() !== '' && !browserFound) {
                    browserFound = true;
                    command = browserCmd;
                    
                    // Executar comando do navegador
                    exec(command, (error, stdout, stderr) => {
                        if (error) {
                            logger.warn('⚠️ Erro ao abrir janela dedicada:', error.message);
                            return res.status(500).json({
                                success: false,
                                error: {
                                    message: 'Erro ao abrir janela dedicada',
                                    details: error.message
                                }
                            });
                        }

                        logger.info('✅ Aplicação aberta em janela dedicada');
                        res.status(200).json({
                            success: true,
                            message: 'Aplicação aberta em janela dedicada',
                            browser: browserName,
                            timestamp: new Date().toISOString()
                        });
                    });
                }
            });
        }

        // Se nenhum navegador for encontrado
        setTimeout(() => {
            if (!browserFound) {
                logger.warn('⚠️ Nenhum navegador compatível encontrado');
                res.status(500).json({
                    success: false,
                    error: {
                        message: 'Nenhum navegador compatível encontrado',
                        details: 'Instale Firefox ou Chromium para usar janela dedicada'
                    }
                });
            }
        }, 2000);

    } catch (error) {
        logger.operationError('Tray Open Dedicated', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro interno ao abrir janela dedicada',
                details: error.message
            }
        });
    }
});

/**
 * Verificar se wmctrl está disponível
 * GET /api/tray/status
 */
router.get('/status', async (req, res) => {
    try {
        logger.info('🔍 Verificando status do system tray...');

        exec('which wmctrl', (error, stdout, stderr) => {
            const isAvailable = !error && stdout.trim() !== '';
            
            res.status(200).json({
                success: true,
                data: {
                    wmctrlAvailable: isAvailable,
                    message: isAvailable ? 'System tray disponível' : 'wmctrl não encontrado'
                },
                timestamp: new Date().toISOString()
            });
        });

    } catch (error) {
        logger.operationError('Tray Status', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao verificar status do system tray',
                details: error.message
            }
        });
    }
});

module.exports = router;
