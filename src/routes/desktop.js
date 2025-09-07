/**
 * Rotas para gerenciamento de arquivo .desktop
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const DesktopManager = require('../utils/desktopManager');
const logger = require('../utils/logger');

/**
 * Criar arquivo .desktop
 * POST /api/desktop/create
 */
router.post('/create', async (req, res) => {
    try {
        logger.info('🖥️ Criando arquivo .desktop...');

        const desktopManager = new DesktopManager();
        const result = await desktopManager.createDesktopFile();

        res.status(200).json({
            success: true,
            message: 'Arquivo .desktop criado com sucesso',
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Desktop Create', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao criar arquivo .desktop',
                details: error.message
            }
        });
    }
});

/**
 * Verificar status do arquivo .desktop
 * GET /api/desktop/status
 */
router.get('/status', async (req, res) => {
    try {
        logger.info('🔍 Verificando status do arquivo .desktop...');

        const desktopManager = new DesktopManager();
        const exists = desktopManager.exists();
        const info = exists ? desktopManager.getInfo() : null;

        res.status(200).json({
            success: true,
            data: {
                exists: exists,
                info: info,
                desktopFile: desktopManager.desktopFile,
                iconPath: desktopManager.iconPath
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Desktop Status', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao verificar status do arquivo .desktop',
                details: error.message
            }
        });
    }
});

/**
 * Remover arquivo .desktop
 * DELETE /api/desktop/remove
 */
router.delete('/remove', async (req, res) => {
    try {
        logger.info('🗑️ Removendo arquivo .desktop...');

        const desktopManager = new DesktopManager();
        const removed = desktopManager.remove();

        res.status(200).json({
            success: true,
            message: removed ? 'Arquivo .desktop removido com sucesso' : 'Arquivo .desktop não existia',
            data: {
                removed: removed
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Desktop Remove', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao remover arquivo .desktop',
                details: error.message
            }
        });
    }
});

/**
 * Atualizar arquivo .desktop
 * PUT /api/desktop/update
 */
router.put('/update', async (req, res) => {
    try {
        logger.info('🔄 Atualizando arquivo .desktop...');

        const desktopManager = new DesktopManager();
        
        // Remover arquivo antigo se existir
        desktopManager.remove();
        
        // Criar novo arquivo
        const result = await desktopManager.createDesktopFile();

        res.status(200).json({
            success: true,
            message: 'Arquivo .desktop atualizado com sucesso',
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Desktop Update', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao atualizar arquivo .desktop',
                details: error.message
            }
        });
    }
});

module.exports = router;
