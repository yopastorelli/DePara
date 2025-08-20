/**
 * Rotas para Gerenciamento de Pastas
 * DePara - Sistema de Conversão e Mapeamento de Dados
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const folderManager = require('../config/folders');
const logger = require('../utils/logger');

/**
 * GET /api/folders
 * Lista todas as pastas configuradas
 */
router.get('/', async (req, res) => {
    try {
        const folders = folderManager.getFolders();
        logger.info(`Listando ${folders.length} pastas configuradas`);
        
        res.json({
            success: true,
            data: folders,
            count: folders.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Erro ao listar pastas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

/**
 * GET /api/folders/:id
 * Obtém uma pasta específica por ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const folder = folderManager.getFolder(id);
        
        if (!folder) {
            return res.status(404).json({
                success: false,
                error: 'Pasta não encontrada',
                message: `Pasta com ID ${id} não foi encontrada`
            });
        }
        
        logger.info(`Pasta encontrada: ${folder.name}`);
        res.json({
            success: true,
            data: folder,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Erro ao buscar pasta:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

/**
 * POST /api/folders
 * Cria uma nova pasta configurada
 */
router.post('/', async (req, res) => {
    try {
        const { name, path, type, format, autoProcess } = req.body;
        
        // Validação básica
        if (!name || !path || !type) {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos',
                message: 'Nome, caminho e tipo são obrigatórios'
            });
        }
        
        // Validar tipo
        const validTypes = ['input', 'output', 'temp'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Tipo inválido',
                message: `Tipo deve ser um dos seguintes: ${validTypes.join(', ')}`
            });
        }
        
        const folderData = {
            name: name.trim(),
            path: path.trim(),
            type,
            format: format || 'auto',
            autoProcess: autoProcess !== undefined ? autoProcess : true
        };
        
        const newFolder = await folderManager.addFolder(folderData);
        logger.info(`Nova pasta criada: ${newFolder.name} (${newFolder.path})`);
        
        res.status(201).json({
            success: true,
            data: newFolder,
            message: 'Pasta criada com sucesso',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Erro ao criar pasta:', error);
        
        if (error.message.includes('Caminho inválido')) {
            return res.status(400).json({
                success: false,
                error: 'Caminho inválido',
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

/**
 * PUT /api/folders/:id
 * Atualiza uma pasta existente
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Validar se a pasta existe
        const existingFolder = folderManager.getFolder(id);
        if (!existingFolder) {
            return res.status(404).json({
                success: false,
                error: 'Pasta não encontrada',
                message: `Pasta com ID ${id} não foi encontrada`
            });
        }
        
        // Validar tipo se estiver sendo alterado
        if (updates.type) {
            const validTypes = ['input', 'output', 'temp'];
            if (!validTypes.includes(updates.type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Tipo inválido',
                    message: `Tipo deve ser um dos seguintes: ${validTypes.join(', ')}`
                });
            }
        }
        
        const updatedFolder = await folderManager.updateFolder(id, updates);
        logger.info(`Pasta atualizada: ${updatedFolder.name}`);
        
        res.json({
            success: true,
            data: updatedFolder,
            message: 'Pasta atualizada com sucesso',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Erro ao atualizar pasta:', error);
        
        if (error.message.includes('Caminho inválido')) {
            return res.status(400).json({
                success: false,
                error: 'Caminho inválido',
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

/**
 * DELETE /api/folders/:id
 * Remove uma pasta configurada
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validar se a pasta existe
        const existingFolder = folderManager.getFolder(id);
        if (!existingFolder) {
            return res.status(404).json({
                success: false,
                error: 'Pasta não encontrada',
                message: `Pasta com ID ${id} não foi encontrada`
            });
        }
        
        const deletedFolder = await folderManager.deleteFolder(id);
        logger.info(`Pasta removida: ${deletedFolder.name}`);
        
        res.json({
            success: true,
            data: deletedFolder,
            message: 'Pasta removida com sucesso',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Erro ao remover pasta:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

/**
 * POST /api/folders/:id/enable
 * Habilita uma pasta
 */
router.post('/:id/enable', async (req, res) => {
    try {
        const { id } = req.params;
        const enabledFolder = await folderManager.enableFolder(id);
        
        logger.info(`Pasta habilitada: ${enabledFolder.name}`);
        res.json({
            success: true,
            data: enabledFolder,
            message: 'Pasta habilitada com sucesso',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Erro ao habilitar pasta:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

/**
 * POST /api/folders/:id/disable
 * Desabilita uma pasta
 */
router.post('/:id/disable', async (req, res) => {
    try {
        const { id } = req.params;
        const disabledFolder = await folderManager.disableFolder(id);
        
        logger.info(`Pasta desabilitada: ${disabledFolder.name}`);
        res.json({
            success: true,
            data: disabledFolder,
            message: 'Pasta desabilitada com sucesso',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Erro ao desabilitar pasta:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

/**
 * GET /api/folders/type/:type
 * Lista pastas por tipo
 */
router.get('/type/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const folders = folderManager.getFoldersByType(type);
        
        logger.info(`Listando ${folders.length} pastas do tipo: ${type}`);
        res.json({
            success: true,
            data: folders,
            count: folders.length,
            type,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Erro ao listar pastas por tipo:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

/**
 * GET /api/folders/status/overview
 * Visão geral do status das pastas
 */
router.get('/status/overview', async (req, res) => {
    try {
        const folders = folderManager.getFolders();
        const overview = {
            total: folders.length,
            enabled: folders.filter(f => f.enabled).length,
            disabled: folders.filter(f => !f.enabled).length,
            byType: {
                input: folders.filter(f => f.type === 'input' && f.enabled).length,
                output: folders.filter(f => f.type === 'output' && f.enabled).length,
                temp: folders.filter(f => f.type === 'temp' && f.enabled).length
            },
            autoProcess: folders.filter(f => f.autoProcess && f.enabled).length
        };
        
        logger.info('Status das pastas consultado');
        res.json({
            success: true,
            data: overview,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Erro ao obter status das pastas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

module.exports = router;
