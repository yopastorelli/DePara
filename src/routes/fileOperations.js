/**
 * Rotas de Operações de Arquivos para DePara
 * Gerencia mover, copiar, apagar e backup de arquivos
 *
 * @author yopastorelli
 * @version 2.0.0
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const fileOperationsManager = require('../utils/fileOperations');
const fileTemplates = require('../utils/fileTemplates');
const logger = require('../utils/logger');
const { normalRateLimiter, strictRateLimiter } = require('../middleware/rateLimiter');
const { sanitizeString, sanitizeFilePath, sanitizeIdentifier, ValidationError } = require('../utils/inputSanitizer');

/**
 * Gerenciamento de Pastas
 * GET /api/files/folders - Listar pastas configuradas
 * POST /api/files/folders - Criar nova pasta
 * DELETE /api/files/folders/:id - Deletar pasta
 */

// Lista de pastas configuradas (armazenamento em memória por enquanto)
const getDefaultConfiguredFolders = () => {
    const userHome = process.env.HOME || process.env.USERPROFILE || '/tmp';

    if (process.platform === 'win32') {
        return [
            {
                id: '1',
                name: 'Documentos Entrada',
                path: path.join(userHome, 'Documents', 'Entrada'),
                type: 'source',
                format: 'any',
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                name: 'Documentos Processados',
                path: path.join(userHome, 'Documents', 'Processados'),
                type: 'target',
                format: 'any',
                createdAt: new Date().toISOString()
            }
        ];
    } else {
        // Linux/Unix/Raspberry Pi
        return [
            {
                id: '1',
                name: 'Documentos Entrada',
                path: path.join(userHome, 'Documents', 'Entrada'),
                type: 'source',
                format: 'any',
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                name: 'Documentos Processados',
                path: path.join(userHome, 'Documents', 'Processados'),
                type: 'target',
                format: 'any',
                createdAt: new Date().toISOString()
            }
        ];
    }
};

let configuredFolders = getDefaultConfiguredFolders();

// Lista de workflows configurados (armazenamento em memória por enquanto)
let configuredWorkflows = [
    {
        id: '1',
        name: 'Processamento Diário',
        description: 'Processa documentos diariamente',
        steps: [],
        createdAt: new Date().toISOString(),
        status: 'active'
    },
    {
        id: '2',
        name: 'Backup Semanal',
        description: 'Realiza backup semanal dos arquivos',
        steps: [],
        createdAt: new Date().toISOString(),
        status: 'active'
    }
];

/**
 * GET /api/files/folders - Listar pastas configuradas
 */
router.get('/folders', async (req, res) => {
    try {
        logger.startOperation('List Folders', {});
        const result = configuredFolders;
        const duration = Date.now() - Date.now();
        logger.endOperation('List Folders', duration, result);

        res.json({
            success: true,
            data: result,
            count: result.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.operationError('List Folders', error);
        res.status(500).json({
            error: {
                message: 'Erro ao listar pastas',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/files/folders - Criar nova pasta
 */
router.post('/folders', async (req, res) => {
    try {
        const { name, path, type = 'source', format = 'any' } = req.body;

        // Validação básica
        if (!name || !path) {
            return res.status(400).json({
                error: {
                    message: 'Nome e caminho são obrigatórios',
                    required: ['name', 'path']
                }
            });
        }

        // Criar ID único
        const id = Date.now().toString();

        const newFolder = {
            id,
            name,
            path,
            type,
            format,
            createdAt: new Date().toISOString()
        };

        // Adicionar à lista
        configuredFolders.push(newFolder);

        logger.startOperation('Create Folder', newFolder);
        const duration = Date.now() - Date.now();
        logger.endOperation('Create Folder', duration, newFolder);

        res.status(201).json({
            success: true,
            data: newFolder,
            message: 'Pasta criada com sucesso',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.operationError('Create Folder', error);
        res.status(500).json({
            error: {
                message: 'Erro ao criar pasta',
                details: error.message
            }
        });
    }
});

/**
 * DELETE /api/files/folders/:id - Deletar pasta
 */
router.delete('/folders/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const folderIndex = configuredFolders.findIndex(folder => folder.id === id);

        if (folderIndex === -1) {
            return res.status(404).json({
                error: {
                    message: 'Pasta não encontrada',
                    id: id
                }
            });
        }

        const deletedFolder = configuredFolders.splice(folderIndex, 1)[0];

        logger.startOperation('Delete Folder', { id });
        const duration = Date.now() - Date.now();
        logger.endOperation('Delete Folder', duration, deletedFolder);

        res.json({
            success: true,
            data: deletedFolder,
            message: 'Pasta deletada com sucesso',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.operationError('Delete Folder', error);
        res.status(500).json({
            error: {
                message: 'Erro ao deletar pasta',
                details: error.message
            }
        });
    }
});

/**
 * Gerenciamento de Workflows
 * GET /api/files/workflows - Listar workflows configurados
 * POST /api/files/workflows - Criar novo workflow
 * DELETE /api/files/workflows/:id - Deletar workflow
 */

/**
 * GET /api/files/workflows - Listar workflows configurados
 */
router.get('/workflows', async (req, res) => {
    try {
        logger.startOperation('List Workflows', {});
        const result = configuredWorkflows;
        const duration = Date.now() - Date.now();
        logger.endOperation('List Workflows', duration, result);

        res.json({
            success: true,
            data: result,
            count: result.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.operationError('List Workflows', error);
        res.status(500).json({
            error: {
                message: 'Erro ao listar workflows',
                details: error.message
            }
        });
    }
});

/**
 * POST /api/files/workflows - Criar novo workflow
 */
router.post('/workflows', async (req, res) => {
    try {
        const { name, description, steps = [] } = req.body;

        // Validação básica
        if (!name || !description) {
            return res.status(400).json({
                error: {
                    message: 'Nome e descrição são obrigatórios',
                    required: ['name', 'description']
                }
            });
        }

        // Criar ID único
        const id = Date.now().toString();

        const newWorkflow = {
            id,
            name,
            description,
            steps,
            createdAt: new Date().toISOString(),
            status: 'active'
        };

        // Adicionar à lista
        configuredWorkflows.push(newWorkflow);

        logger.startOperation('Create Workflow', newWorkflow);
        const duration = Date.now() - Date.now();
        logger.endOperation('Create Workflow', duration, newWorkflow);

        res.status(201).json({
            success: true,
            data: newWorkflow,
            message: 'Workflow criado com sucesso',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.operationError('Create Workflow', error);
        res.status(500).json({
            error: {
                message: 'Erro ao criar workflow',
                details: error.message
            }
        });
    }
});

/**
 * DELETE /api/files/workflows/:id - Deletar workflow
 */
router.delete('/workflows/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const workflowIndex = configuredWorkflows.findIndex(workflow => workflow.id === id);

        if (workflowIndex === -1) {
            return res.status(404).json({
                error: {
                    message: 'Workflow não encontrado',
                    id: id
                }
            });
        }

        const deletedWorkflow = configuredWorkflows.splice(workflowIndex, 1)[0];

        logger.startOperation('Delete Workflow', { id });
        const duration = Date.now() - Date.now();
        logger.endOperation('Delete Workflow', duration, deletedWorkflow);

        res.json({
            success: true,
            data: deletedWorkflow,
            message: 'Workflow deletado com sucesso',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.operationError('Delete Workflow', error);
        res.status(500).json({
            error: {
                message: 'Erro ao deletar workflow',
                details: error.message
            }
        });
    }
});

/**
 * Executar operação imediata em arquivo
 * POST /api/files/execute
 */
router.post('/execute', normalRateLimiter, async (req, res) => {
    const startTime = Date.now();

    try {
        const { action, sourcePath, targetPath, options = {} } = req.body;

        // Validação robusta dos parâmetros obrigatórios
        if (!action || typeof action !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'Parâmetro action é obrigatório e deve ser uma string',
                    details: 'action deve ser uma das ações suportadas',
                    required: ['action', 'sourcePath'],
                    supported: ['move', 'copy', 'delete']
                }
            });
        }

        if (!sourcePath || typeof sourcePath !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'Parâmetro sourcePath é obrigatório e deve ser uma string',
                    details: 'sourcePath deve ser um caminho de arquivo válido',
                    required: ['action', 'sourcePath']
                }
            });
        }

        // Validar ação suportada
        const supportedActions = ['move', 'copy', 'delete'];
        if (!supportedActions.includes(action.toLowerCase())) {
            return res.status(400).json({
                error: {
                    message: 'Ação não suportada',
                    details: `Ação '${action}' não é suportada. Use: ${supportedActions.join(', ')}`,
                    supported: supportedActions
                }
            });
        }

        // Normalizar action para lowercase
        const normalizedAction = action.toLowerCase();

        // Validar targetPath quando necessário
        if ((normalizedAction === 'move' || normalizedAction === 'copy') && (!targetPath || typeof targetPath !== 'string')) {
            return res.status(400).json({
                error: {
                    message: `Parâmetro targetPath é obrigatório para ação '${normalizedAction}'`,
                    details: 'targetPath deve ser um caminho de destino válido'
                }
            });
        }

        // Validar opções se fornecidas
        if (options && typeof options !== 'object') {
            return res.status(400).json({
                error: {
                    message: 'Parâmetro options deve ser um objeto',
                    details: 'options deve conter configurações válidas para a operação'
                }
            });
        }

        logger.startOperation('File Operation Execute', {
            action: normalizedAction,
            sourcePath,
            targetPath,
            options
        });

        let result;

        switch (normalizedAction) {
            case 'move':
                result = await fileOperationsManager.moveFile(sourcePath, targetPath, options);
                break;

            case 'copy':
                result = await fileOperationsManager.copyFile(sourcePath, targetPath, options);
                break;

            case 'delete':
                result = await fileOperationsManager.deleteFile(sourcePath, options);
                break;

            default:
                return res.status(400).json({
                    error: {
                        message: 'Ação não implementada',
                        details: `A ação '${normalizedAction}' não foi implementada`
                    }
                });
        }

        const duration = Date.now() - startTime;
        logger.endOperation('File Operation Execute', duration, result);

        res.status(200).json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('File Operation Execute', error);
        res.status(500).json({
            error: {
                message: 'Erro na execução da operação',
                details: error.message
            }
        });
    }
});

/**
 * Agendar operação periódica
 * POST /api/files/schedule
 */
router.post('/schedule', async (req, res) => {
    try {
        const { operationId, frequency, action, sourcePath, targetPath, options = {} } = req.body;

        // Validação
        if (!frequency || !action || !sourcePath) {
            return res.status(400).json({
                error: {
                    message: 'Parâmetros obrigatórios ausentes',
                    required: ['frequency', 'action', 'sourcePath']
                }
            });
        }

        // Gerar ID se não fornecido
        const id = operationId || `scheduled_${Date.now()}`;

        const config = {
            frequency,
            action,
            sourcePath,
            targetPath,
            options
        };

        fileOperationsManager.scheduleOperation(id, config);

        logger.info(`Operação agendada: ${id}`);

        res.status(201).json({
            success: true,
            data: {
                operationId: id,
                config,
                status: 'scheduled'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('File Operation Schedule', error);
        res.status(500).json({
            error: {
                message: 'Erro ao agendar operação',
                details: error.message
            }
        });
    }
});

/**
 * Cancelar operação agendada
 * DELETE /api/files/schedule/:operationId
 */
router.delete('/schedule/:operationId', strictRateLimiter, async (req, res) => {
    try {
        const { operationId } = req.params;

        fileOperationsManager.cancelScheduledOperation(operationId);

        res.status(200).json({
            success: true,
            message: `Operação ${operationId} cancelada`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('File Operation Cancel', error);
        res.status(500).json({
            error: {
                message: 'Erro ao cancelar operação',
                details: error.message
            }
        });
    }
});

/**
 * Editar operação agendada
 * PUT /api/files/schedule/:operationId
 */
router.put('/schedule/:operationId', strictRateLimiter, async (req, res) => {
    try {
        const { operationId } = req.params;
        const { frequency, action, sourcePath, targetPath, options = {} } = req.body;

        // Sanitização e validação robusta dos parâmetros
        try {
            if (frequency !== undefined) {
                frequency = sanitizeString(frequency, {
                    field: 'frequency',
                    maxLength: 10,
                    allowedChars: '0-9mhdw'
                });
            }

            if (action !== undefined) {
                action = sanitizeString(action, {
                    field: 'action',
                    maxLength: 10,
                    allowedChars: 'a-z'
                });
                // Validar ação específica
                const validActions = ['move', 'copy', 'delete'];
                if (!validActions.includes(action)) {
                    throw new ValidationError(`Ação inválida. Deve ser uma das seguintes: ${validActions.join(', ')}`, 'action', action);
                }
            }

            if (sourcePath !== undefined) {
                sourcePath = sanitizeFilePath(sourcePath, {
                    field: 'sourcePath',
                    allowAbsolute: true,
                    allowRelative: true
                });
            }

            if (targetPath !== undefined) {
                targetPath = sanitizeFilePath(targetPath, {
                    field: 'targetPath',
                    allowAbsolute: true,
                    allowRelative: true
                });
            }
        } catch (validationError) {
            return res.status(400).json({
                error: {
                    message: 'Erro de validação nos parâmetros',
                    details: validationError.message,
                    field: validationError.field
                }
            });
        }

        // Preparar nova configuração (apenas campos fornecidos)
        const newConfig = {};
        if (frequency !== undefined) newConfig.frequency = frequency;
        if (action !== undefined) newConfig.action = action;
        if (sourcePath !== undefined) newConfig.sourcePath = sourcePath;
        if (targetPath !== undefined) newConfig.targetPath = targetPath;
        if (options !== undefined) newConfig.options = options;

        // Verificar se pelo menos um campo foi fornecido
        if (Object.keys(newConfig).length === 0) {
            return res.status(400).json({
                error: {
                    message: 'Nenhum campo para atualização fornecido',
                    details: 'Forneça pelo menos um dos campos: frequency, action, sourcePath, targetPath, options'
                }
            });
        }

        logger.startOperation('File Operation Edit', {
            operationId,
            newConfig
        });

        const result = fileOperationsManager.editScheduledOperation(operationId, newConfig);

        const duration = Date.now() - Date.now();
        logger.endOperation('File Operation Edit', duration, result);

        res.status(200).json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('File Operation Edit', error);

        // Tratamento específico de erros
        if (error.message.includes('não encontrada')) {
            return res.status(404).json({
                error: {
                    message: 'Operação agendada não encontrada',
                    details: `A operação ${req.params.operationId} não existe ou já foi cancelada`
                }
            });
        }

        if (error.message.includes('Parâmetros obrigatórios ausentes') ||
            error.message.includes('Ação não suportada') ||
            error.message.includes('targetPath é obrigatório')) {
            return res.status(400).json({
                error: {
                    message: 'Configuração inválida',
                    details: error.message
                }
            });
        }

        res.status(500).json({
            error: {
                message: 'Erro ao editar operação agendada',
                details: error.message
            }
        });
    }
});

/**
 * Listar operações agendadas
 * GET /api/files/scheduled
 */
router.get('/scheduled', async (req, res) => {
    try {
        const operations = fileOperationsManager.getScheduledOperations();

        res.status(200).json({
            success: true,
            data: operations,
            count: operations.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('File Operations List', error);
        res.status(500).json({
            error: {
                message: 'Erro ao listar operações',
                details: error.message
            }
        });
    }
});

/**
 * Obter estatísticas das operações
 * GET /api/files/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = fileOperationsManager.getStats();

        res.status(200).json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('File Operations Stats', error);
        res.status(500).json({
            error: {
                message: 'Erro ao obter estatísticas',
                details: error.message
            }
        });
    }
});

/**
 * Atualizar configuração de backup
 * PUT /api/files/backup-config
 */
router.put('/backup-config', async (req, res) => {
    try {
        const { enabled, backupDir, retentionDays, compressBackups } = req.body;

        const config = {};
        if (typeof enabled === 'boolean') config.enabled = enabled;
        if (backupDir) config.backupDir = backupDir;
        if (retentionDays) config.retentionDays = retentionDays;
        if (typeof compressBackups === 'boolean') config.compressBackups = compressBackups;

        fileOperationsManager.updateBackupConfig(config);

        res.status(200).json({
            success: true,
            message: 'Configuração de backup atualizada',
            config: fileOperationsManager.backupConfig,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Backup Config Update', error);
        res.status(500).json({
            error: {
                message: 'Erro ao atualizar configuração de backup',
                details: error.message
            }
        });
    }
});

/**
 * Obter configuração de backup
 * GET /api/files/backup-config
 */
router.get('/backup-config', async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            data: fileOperationsManager.backupConfig,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Backup Config Get', error);
        res.status(500).json({
            error: {
                message: 'Erro ao obter configuração de backup',
                details: error.message
            }
        });
    }
});

/**
 * Listar backups disponíveis
 * GET /api/files/backups
 */
router.get('/backups', async (req, res) => {
    try {

        const backupDir = fileOperationsManager.backupConfig.backupDir;

        try {
            const files = await fs.readdir(backupDir);
            const backups = [];

            for (const file of files) {
                const filePath = path.join(backupDir, file);
                const stats = await fs.stat(filePath);

                backups.push({
                    filename: file,
                    path: filePath,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                });
            }

            // Ordenar por data de criação (mais recente primeiro)
            backups.sort((a, b) => b.created.getTime() - a.created.getTime());

            res.status(200).json({
                success: true,
                data: backups,
                count: backups.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            // Diretório não existe ainda
            res.status(200).json({
                success: true,
                data: [],
                count: 0,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        logger.operationError('Backups List', error);
        res.status(500).json({
            error: {
                message: 'Erro ao listar backups',
                details: error.message
            }
        });
    }
});

/**
 * Executar operação em lote (todos os arquivos de uma pasta)
 * POST /api/files/batch
 */
router.post('/batch', async (req, res) => {
    const startTime = Date.now();

    try {
        const { action, sourceDir, targetDir, options = {} } = req.body;

        // Validação
        if (!action || !sourceDir) {
            return res.status(400).json({
                error: {
                    message: 'Parâmetros obrigatórios ausentes',
                    required: ['action', 'sourceDir']
                }
            });
        }

        // Para move e copy, targetDir é obrigatório
        if ((action === 'move' || action === 'copy') && !targetDir) {
            return res.status(400).json({
                error: {
                    message: 'targetDir é obrigatório para ações move e copy'
                }
            });
        }

        logger.startOperation('File Batch Operation', {
            action,
            sourceDir,
            targetDir,
            options
        });

        // Executar operação em lote
        await fileOperationsManager.executeBatchOperation(
            `batch_${Date.now()}`,
            action,
            sourceDir,
            targetDir,
            { ...options, batch: true }
        );

        const duration = Date.now() - startTime;
        logger.endOperation('File Batch Operation', duration, {
            action,
            sourceDir,
            targetDir
        });

        res.status(200).json({
            success: true,
            message: `Operação em lote ${action} executada com sucesso`,
            duration,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('File Batch Operation', error);
        res.status(500).json({
            error: {
                message: 'Erro na operação em lote',
                details: error.message
            }
        });
    }
});

/**
 * Listar templates disponíveis
 * GET /api/files/templates
 */
router.get('/templates', async (req, res) => {
    try {
        const { category } = req.query;

        let templates;
        if (category) {
            templates = fileTemplates.getTemplatesByCategory(category);
        } else {
            templates = fileTemplates.getAllTemplates();
        }

        const categories = fileTemplates.getCategories();

        res.status(200).json({
            success: true,
            data: {
                templates,
                categories,
                count: templates.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Templates List', error);
        res.status(500).json({
            error: {
                message: 'Erro ao listar templates',
                details: error.message
            }
        });
    }
});

/**
 * Obter template específico
 * GET /api/files/templates/:category/:name
 */
router.get('/templates/:category/:name', async (req, res) => {
    try {
        const { category, name } = req.params;

        const template = fileTemplates.getTemplate(category, name);

        if (!template) {
            return res.status(404).json({
                error: {
                    message: 'Template não encontrado',
                    details: `Template ${category}/${name} não existe`
                }
            });
        }

        res.status(200).json({
            success: true,
            data: template,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Template Get', error);
        res.status(500).json({
            error: {
                message: 'Erro ao obter template',
                details: error.message
            }
        });
    }
});

/**
 * Aplicar template com customizações
 * POST /api/files/templates/:category/:name/apply
 */
router.post('/templates/:category/:name/apply', async (req, res) => {
    try {
        const { category, name } = req.params;
        const customizations = req.body;

        const template = fileTemplates.customizeTemplate(category, name, customizations);

        // Gerar ID único para a operação
        const operationId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Agendar a operação baseada no template
        fileOperationsManager.scheduleOperation(operationId, template.config);

        res.status(201).json({
            success: true,
            data: {
                operationId,
                template: template.name,
                category: template.category,
                config: template.config,
                status: 'scheduled'
            },
            message: `Template "${template.name}" aplicado com sucesso`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Template Apply', error);
        res.status(500).json({
            error: {
                message: 'Erro ao aplicar template',
                details: error.message
            }
        });
    }
});

/**
 * Obter informações das categorias
 * GET /api/files/templates/categories
 */
router.get('/templates/categories', async (req, res) => {
    try {
        const categories = fileTemplates.getCategories();
        const categoryInfos = categories.map(cat => fileTemplates.getCategoryInfo(cat));

        res.status(200).json({
            success: true,
            data: {
                categories: categoryInfos,
                count: categories.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Categories Info', error);
        res.status(500).json({
            error: {
                message: 'Erro ao obter informações das categorias',
                details: error.message
            }
        });
    }
});

/**
 * Obter progresso de uma operação
 * GET /api/files/progress/:operationId
 */
router.get('/progress/:operationId', async (req, res) => {
    try {
        const { operationId } = req.params;
        const progress = fileOperationsManager.getProgress(operationId);

        if (!progress) {
            return res.status(404).json({
                error: {
                    message: 'Operação não encontrada ou já concluída',
                    operationId
                }
            });
        }

        res.status(200).json({
            success: true,
            data: progress,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Progress Get', error);
        res.status(500).json({
            error: {
                message: 'Erro ao obter progresso',
                details: error.message
            }
        });
    }
});

/**
 * Listar operações ativas com progresso
 * GET /api/files/progress
 */
router.get('/progress', async (req, res) => {
    try {
        const activeOperations = fileOperationsManager.getActiveOperations();

        res.status(200).json({
            success: true,
            data: activeOperations,
            count: activeOperations.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Active Operations Get', error);
        res.status(500).json({
            error: {
                message: 'Erro ao obter operações ativas',
                details: error.message
            }
        });
    }
});

/**
 * Obter padrões de arquivos ignorados
 * GET /api/files/ignored-patterns
 */
router.get('/ignored-patterns', async (req, res) => {
    try {
        const patterns = fileOperationsManager.getIgnoredPatterns();

        res.status(200).json({
            success: true,
            data: {
                patterns,
                description: 'Padrões de arquivos automaticamente ignorados para proteger sincronização e sistema',
                categories: {
                    resilioSync: 'Arquivos do Resilio Sync (BitTorrent Sync) - críticos para sincronização',
                    systemFiles: 'Arquivos de sistema operacional - evitam problemas de compatibilidade',
                    tempFiles: 'Arquivos temporários - evitam processamento desnecessário'
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Ignored Patterns Get', error);
        res.status(500).json({
            error: {
                message: 'Erro ao obter padrões ignorados',
                details: error.message
            }
        });
    }
});

/**
 * Verificar se um arquivo seria ignorado
 * POST /api/files/check-ignore
 */
router.post('/check-ignore', async (req, res) => {
    try {
        const { filePath, filename } = req.body;

        if (!filename) {
            return res.status(400).json({
                error: {
                    message: 'Parâmetro filename é obrigatório',
                    required: ['filename']
                }
            });
        }

        const shouldIgnore = fileOperationsManager.shouldIgnoreFile(filePath || '', filename);

        res.status(200).json({
            success: true,
            data: {
                filename,
                filePath,
                shouldIgnore,
                reason: shouldIgnore ? 'Arquivo será automaticamente ignorado' : 'Arquivo será processado normalmente'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('Check Ignore', error);
        res.status(500).json({
            error: {
                message: 'Erro ao verificar arquivo',
                details: error.message
            }
        });
    }
});

/**
 * Listar imagens recursivamente para slideshow
 * GET /api/files/images/:folderPath
 */
router.get('/images/:folderPath(*)', async (req, res) => {
    try {
        const folderPath = '/' + req.params.folderPath;
        const { maxDepth = 10, extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'] } = req.query;

        logger.startOperation('List Images', { folderPath, maxDepth, extensions });

        const images = await fileOperationsManager.listImagesRecursive(folderPath, {
            maxDepth: parseInt(maxDepth),
            extensions: Array.isArray(extensions) ? extensions : extensions.split(',')
        });

        const duration = Date.now() - Date.now();
        logger.endOperation('List Images', duration, { imageCount: images.length });

        res.status(200).json({
            success: true,
            data: {
                images,
                count: images.length,
                folderPath,
                extensions: Array.isArray(extensions) ? extensions : extensions.split(',')
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('List Images', error);
        res.status(500).json({
            error: {
                message: 'Erro ao listar imagens',
                details: error.message
            }
        });
    }
});

/**
 * Servir imagem diretamente para o slideshow
 * GET /api/files/image/:imagePath
 */
router.get('/image/:imagePath(*)', async (req, res) => {
    try {
        const imagePath = '/' + req.params.imagePath;

        // Verificar se o arquivo existe e é uma imagem

        const stats = await fs.stat(imagePath);
        if (!stats.isFile()) {
            return res.status(404).json({
                error: {
                    message: 'Arquivo não encontrado',
                    details: 'O caminho especificado não é um arquivo'
                }
            });
        }

        const ext = path.extname(imagePath).toLowerCase().slice(1);
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg'];

        if (!allowedExtensions.includes(ext)) {
            return res.status(400).json({
                error: {
                    message: 'Tipo de arquivo não suportado',
                    details: `Extensão .${ext} não é suportada para imagens`
                }
            });
        }

        // Verificar se não deve ser ignorado
        if (fileOperationsManager.shouldIgnoreFile(path.dirname(imagePath), path.basename(imagePath))) {
            return res.status(403).json({
                error: {
                    message: 'Arquivo protegido',
                    details: 'Este arquivo está na lista de arquivos protegidos'
                }
            });
        }

        // Definir content-type baseado na extensão
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'webp': 'image/webp',
            'tiff': 'image/tiff',
            'svg': 'image/svg+xml'
        };

        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora

        // Stream do arquivo com gerenciamento adequado
        const fileStream = fsSync.createReadStream(imagePath);

        // Configurar timeout para evitar streams presos
        const streamTimeout = setTimeout(() => {
            fileStream.destroy(new Error('Stream timeout'));
        }, 30000); // 30 segundos timeout

        fileStream.pipe(res);

        // Limpar timeout quando stream terminar
        fileStream.on('end', () => {
            clearTimeout(streamTimeout);
        });

        // Limpar timeout quando stream for fechado
        fileStream.on('close', () => {
            clearTimeout(streamTimeout);
        });

        fileStream.on('error', (error) => {
            clearTimeout(streamTimeout);
            logger.error(`Erro ao servir imagem ${imagePath}:`, error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: {
                        message: 'Erro ao carregar imagem',
                        details: error.message
                    }
                });
            }
        });

        // Limpar recursos quando resposta terminar
        res.on('finish', () => {
            clearTimeout(streamTimeout);
            if (!fileStream.destroyed) {
                fileStream.destroy();
            }
        });

        res.on('close', () => {
            clearTimeout(streamTimeout);
            if (!fileStream.destroyed) {
                fileStream.destroy();
            }
        });

    } catch (error) {
        logger.operationError('Serve Image', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: {
                    message: 'Erro ao servir imagem',
                    details: error.message
                }
            });
        }
    }
});

/**
 * Obter ações suportadas e exemplos
 * GET /api/files/actions
 */
router.get('/actions', async (req, res) => {
    try {
        const actions = {
            move: {
                description: 'Mover arquivo de uma pasta para outra',
                parameters: {
                    sourcePath: 'Caminho completo do arquivo origem',
                    targetPath: 'Caminho completo do destino',
                    options: {
                        backupBeforeMove: 'Criar backup antes de mover (boolean)',
                        overwrite: 'Sobrescrever se existir (boolean)'
                    }
                },
                example: {
                    action: 'move',
                    sourcePath: '/pasta_origem/arquivo.txt',
                    targetPath: '/pasta_destino/arquivo.txt',
                    options: { backupBeforeMove: true }
                }
            },
            copy: {
                description: 'Copiar arquivo de uma pasta para outra',
                parameters: {
                    sourcePath: 'Caminho completo do arquivo origem',
                    targetPath: 'Caminho completo do destino',
                    options: {
                        overwrite: 'Sobrescrever se existir (boolean)'
                    }
                },
                example: {
                    action: 'copy',
                    sourcePath: '/pasta_origem/arquivo.txt',
                    targetPath: '/pasta_destino/copia_arquivo.txt',
                    options: { overwrite: false }
                }
            },
            delete: {
                description: 'Apagar arquivo com backup automático',
                parameters: {
                    sourcePath: 'Caminho completo do arquivo',
                    options: {
                        forceBackup: 'Forçar criação de backup (boolean)'
                    }
                },
                example: {
                    action: 'delete',
                    sourcePath: '/pasta/arquivo.txt',
                    options: { forceBackup: true }
                }
            }
        };

        const frequencies = {
            '30s': 'A cada 30 segundos',
            '1m': 'A cada 1 minuto',
            '5m': 'A cada 5 minutos',
            '15m': 'A cada 15 minutos',
            '30m': 'A cada 30 minutos',
            '1h': 'A cada 1 hora',
            '6h': 'A cada 6 horas',
            '12h': 'A cada 12 horas',
            '1d': 'A cada 1 dia'
        };

        res.status(200).json({
            success: true,
            data: {
                actions,
                frequencies,
                batch: {
                    description: 'Operações em lote (todos os arquivos de uma pasta)',
                    example: {
                        action: 'move',
                        sourceDir: '/pasta_origem',
                        targetDir: '/pasta_destino',
                        options: {
                            filters: {
                                extensions: ['txt', 'csv', 'json'],
                                pattern: '.*\\.txt$'
                            }
                        }
                    }
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.operationError('File Actions Info', error);
        res.status(500).json({
            error: {
                message: 'Erro ao obter informações das ações',
                details: error.message
            }
        });
    }
});

// Listar imagens para slideshow
router.post('/list-images', async (req, res) => {
    const startTime = Date.now();

    try {
        const { folderPath, extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'], recursive = true } = req.body;

        if (!folderPath || typeof folderPath !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'Parâmetro folderPath é obrigatório e deve ser uma string',
                    required: ['folderPath']
                }
            });
        }

        logger.startOperation('List Images', {
            folderPath,
            extensions,
            recursive
        });

        // Validar caminho
        const safePath = await fileOperationsManager.validateSafePath(folderPath, 'read');

        // Função auxiliar para listar imagens recursivamente
        async function listImagesRecursively(dirPath, imageList = []) {
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);

                    if (entry.isDirectory() && recursive) {
                        // Recursão para subdiretórios
                        await listImagesRecursively(fullPath, imageList);
                    } else if (entry.isFile()) {
                        // Verificar se arquivo deve ser ignorado
                        const shouldIgnore = fileOperationsManager.shouldIgnoreFile(entry.name);
                        if (shouldIgnore) {
                            continue; // Pular arquivos ignorados
                        }

                        // Verificar se é uma imagem
                        const ext = path.extname(entry.name).toLowerCase();
                        if (extensions.includes(ext)) {
                            // Obter informações do arquivo
                            const stats = await fs.stat(fullPath);
                            imageList.push({
                                path: fullPath,
                                name: entry.name,
                                size: stats.size,
                                modified: stats.mtime,
                                extension: ext
                            });
                        }
                    }
                }
            } catch (error) {
                logger.warn(`Erro ao acessar diretório ${dirPath}:`, error.message);
            }

            return imageList;
        }

        const images = await listImagesRecursively(safePath);

        // Ordenar por nome do arquivo
        images.sort((a, b) => a.name.localeCompare(b.name));

        const duration = Date.now() - startTime;
        logger.endOperation('List Images', duration, {
            imageCount: images.length,
            folderPath: safePath
        });

        res.json({
            success: true,
            data: {
                images,
                totalCount: images.length,
                folderPath: safePath
            },
            timestamp: new Date().toISOString(),
            duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.operationError('List Images', error);
        res.status(500).json({
            error: {
                message: 'Erro interno do servidor',
                details: error.message
            }
        });
    }
});

// Servir imagem para slideshow
router.get('/image/:imagePath(*)', async (req, res) => {
    try {
        const imagePath = req.params.imagePath;

        // Validar caminho da imagem
        const safePath = await fileOperationsManager.validateSafePath(imagePath, 'read');

        // Verificar se o arquivo existe
        const stats = await fs.stat(safePath);

        // Verificar se é uma imagem
        const ext = path.extname(safePath).toLowerCase();
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

        if (!allowedExtensions.includes(ext)) {
            return res.status(403).json({
                error: {
                    message: 'Tipo de arquivo não permitido para visualização'
                }
            });
        }

        // Definir content-type baseado na extensão
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp'
        };

        res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora

        // Stream do arquivo
        const stream = fsSync.createReadStream(safePath);
        stream.pipe(res);

        stream.on('error', (error) => {
            logger.error('Erro ao streamar imagem:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: {
                        message: 'Erro ao carregar imagem'
                    }
                });
            }
        });

    } catch (error) {
        logger.error('Erro ao servir imagem:', error);
        res.status(404).json({
            error: {
                message: 'Imagem não encontrada',
                details: error.message
            }
        });
    }
});

// Listar pastas de um diretório para navegador
router.post('/list-folders', async (req, res) => {
    const startTime = Date.now();

    try {
        const { path: requestedPath } = req.body;

        if (!requestedPath || typeof requestedPath !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'Parâmetro path é obrigatório e deve ser uma string',
                    required: ['path']
                }
            });
        }

        logger.startOperation('List Folders', { path: requestedPath });

        // Validar caminho usando fileOperationsManager
        const safePath = await fileOperationsManager.validateSafePath(requestedPath, 'read');

        // Verificar se o diretório existe antes de tentar lê-lo
        let entries;
        try {
            entries = await fs.readdir(safePath, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Diretório não existe - retornar lista vazia
                const duration = Date.now() - startTime;
                logger.endOperation('List Folders', duration, {
                    folderCount: 0,
                    path: safePath,
                    note: 'Diretório não existe'
                });

                return res.json({
                    success: true,
                    data: {
                        folders: [],
                        currentPath: safePath,
                        totalCount: 0,
                        message: 'Diretório não existe ou está vazio'
                    },
                    timestamp: new Date().toISOString(),
                    duration
                });
            }
            throw error; // Re-throw outros erros
        }

        // Filtrar apenas diretórios (pastas)
        const folders = entries
            .filter(entry => entry.isDirectory())
            .filter(entry => !fileOperationsManager.shouldIgnoreFile(entry.name)) // Não mostrar pastas ignoradas
            .map(entry => {
                try {
                    const folderPath = path.join(safePath, entry.name);
                    return {
                        name: entry.name,
                        path: folderPath
                    };
                } catch (error) {
                    logger.error(`Erro ao processar pasta ${entry.name}:`, error);
                    return {
                        name: entry.name,
                        path: `${safePath}/${entry.name}` // Fallback manual
                    };
                }
            })
            .sort((a, b) => a.name.localeCompare(b.name)); // Ordenar alfabeticamente

        const duration = Date.now() - startTime;
        logger.endOperation('List Folders', duration, {
            folderCount: folders.length,
            path: safePath
        });

        res.json({
            success: true,
            data: {
                folders,
                currentPath: safePath,
                totalCount: folders.length
            },
            timestamp: new Date().toISOString(),
            duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.operationError('List Folders', error);
        res.status(500).json({
            error: {
                message: 'Erro interno do servidor',
                details: error.message
            }
        });
    }
});

module.exports = router;
