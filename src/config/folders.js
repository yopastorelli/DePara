/**
 * Configuração de Pastas Monitoradas
 * DePara - Sistema de Conversão e Mapeamento de Dados
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class FolderManager {
    constructor() {
        this.configFile = path.join(__dirname, '..', '..', 'data', 'folders.json');
        this.folders = [];
        this.watchers = new Map();
        this.init();
    }

    async init() {
        try {
            await this.ensureDataDirectory();
            await this.loadFolders();
            this.startWatching();
            logger.info('Gerenciador de pastas inicializado com sucesso');
        } catch (error) {
            logger.error('Erro ao inicializar gerenciador de pastas:', error);
        }
    }

    async ensureDataDirectory() {
        const dataDir = path.dirname(this.configFile);
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
            logger.info(`Diretório de dados criado: ${dataDir}`);
        }
    }

    async loadFolders() {
        try {
            const data = await fs.readFile(this.configFile, 'utf8');
            this.folders = JSON.parse(data);
            logger.info(`${this.folders.length} pastas carregadas`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Arquivo não existe, criar com configuração padrão
                this.folders = this.getDefaultFolders();
                await this.saveFolders();
                logger.info('Configuração padrão de pastas criada');
            } else {
                logger.error('Erro ao carregar pastas:', error);
                this.folders = [];
            }
        }
    }

    getDefaultFolders() {
        // Detectar usuário atual e caminhos padrão baseados na plataforma
        const userHome = process.env.HOME || process.env.USERPROFILE || '/tmp';
        const userName = process.env.USER || process.env.USERNAME || 'user';

        // Caminhos adaptáveis por plataforma
        const getDefaultPaths = () => {
            if (process.platform === 'win32') {
                return {
                    input: path.join(userHome, 'Documents', 'Entrada'),
                    output: path.join(userHome, 'Documents', 'Saida'),
                    temp: path.join(userHome, 'Documents', 'Temp')
                };
            } else {
                // Linux/Unix/Raspberry Pi
                return {
                    input: path.join(userHome, 'dados', 'entrada'),
                    output: path.join(userHome, 'dados', 'saida'),
                    temp: path.join(userHome, 'dados', 'temp')
                };
            }
        };

        const paths = getDefaultPaths();

        return [
            {
                id: 'default-input',
                name: 'Dados_Entrada',
                path: paths.input,
                type: 'input',
                format: 'auto',
                autoProcess: true,
                enabled: true,
                processing: {
                    frequency: 'realtime',
                    cronExpression: null,
                    rules: 'all',
                    allowedExtensions: [],
                    transformations: {
                        uppercase: false,
                        lowercase: false,
                        trim: true,
                        validate: true
                    },
                    output: {
                        backup: true,
                        log: true,
                        notify: false
                    }
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'default-output',
                name: 'Dados_Saida',
                path: paths.output,
                type: 'output',
                format: 'json',
                autoProcess: false,
                enabled: true,
                processing: {
                    frequency: 'daily',
                    cronExpression: null,
                    rules: 'all',
                    allowedExtensions: ['json', 'csv'],
                    transformations: {
                        uppercase: false,
                        lowercase: false,
                        trim: true,
                        validate: false
                    },
                    output: {
                        backup: false,
                        log: true,
                        notify: false
                    }
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'default-temp',
                name: 'Dados_Temporarios',
                path: paths.temp,
                type: 'temp',
                format: 'auto',
                autoProcess: false,
                enabled: true,
                processing: {
                    frequency: '1hour',
                    cronExpression: null,
                    rules: 'modified',
                    allowedExtensions: [],
                    transformations: {
                        uppercase: false,
                        lowercase: false,
                        trim: false,
                        validate: false
                    },
                    output: {
                        backup: false,
                        log: false,
                        notify: false
                    }
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
    }

    async saveFolders() {
        try {
            await fs.writeFile(this.configFile, JSON.stringify(this.folders, null, 2));
            logger.info('Configuração de pastas salva com sucesso');
        } catch (error) {
            logger.error('Erro ao salvar configuração de pastas:', error);
            throw error;
        }
    }

    async addFolder(folderData) {
        // VALIDAÇÃO DOS NOVOS CAMPOS
        if (folderData.autoProcess && folderData.processing) {
            const processing = folderData.processing;
            
            // Validar frequência
            if (processing.frequency === 'custom' && !processing.cronExpression) {
                throw new Error('Expressão cron é obrigatória para frequência personalizada');
            }
            
            // Validar regras de extensão
            if (processing.rules === 'extension' && (!processing.allowedExtensions || processing.allowedExtensions.length === 0)) {
                throw new Error('Extensões permitidas são obrigatórias para regra de extensão');
            }
            
            // Validar transformações conflitantes
            if (processing.transformations) {
                const transforms = processing.transformations;
                if (transforms.uppercase && transforms.lowercase) {
                    throw new Error('Não é possível aplicar maiúsculas e minúsculas simultaneamente');
                }
            }
        }

        // CONFIGURAÇÃO PADRÃO DOS CAMPOS DE PROCESSAMENTO
        const defaultProcessing = {
            frequency: 'realtime',
            cronExpression: null,
            rules: 'all',
            allowedExtensions: [],
            transformations: {
                uppercase: false,
                lowercase: false,
                trim: true,
                validate: true
            },
            output: {
                backup: true,
                log: true,
                notify: false
            }
        };

        const folder = {
            id: `folder-${Date.now()}`,
            ...folderData,
            // Mesclar configurações de processamento com padrões
            processing: {
                ...defaultProcessing,
                ...(folderData.processing || {})
            },
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Validar caminho da pasta
        if (!await this.validateFolderPath(folder.path)) {
            throw new Error(`Caminho inválido ou pasta não acessível: ${folder.path}`);
        }

        this.folders.push(folder);
        await this.saveFolders();
        this.startWatchingFolder(folder);
        
        logger.info(`Pasta adicionada: ${folder.name} (${folder.path}) com configurações de processamento`);
        return folder;
    }

    async updateFolder(id, updates) {
        const folderIndex = this.folders.findIndex(f => f.id === id);
        if (folderIndex === -1) {
            throw new Error(`Pasta não encontrada: ${id}`);
        }

        const folder = this.folders[folderIndex];
        const updatedFolder = {
            ...folder,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Validar caminho se foi alterado
        if (updates.path && updates.path !== folder.path) {
            if (!await this.validateFolderPath(updates.path)) {
                throw new Error(`Caminho inválido ou pasta não acessível: ${updates.path}`);
            }
            this.stopWatchingFolder(folder);
            this.startWatchingFolder(updatedFolder);
        }

        this.folders[folderIndex] = updatedFolder;
        await this.saveFolders();
        
        logger.info(`Pasta atualizada: ${updatedFolder.name}`);
        return updatedFolder;
    }

    async deleteFolder(id) {
        const folderIndex = this.folders.findIndex(f => f.id === id);
        if (folderIndex === -1) {
            throw new Error(`Pasta não encontrada: ${id}`);
        }

        const folder = this.folders[folderIndex];
        this.stopWatchingFolder(folder);
        
        this.folders.splice(folderIndex, 1);
        await this.saveFolders();
        
        logger.info(`Pasta removida: ${folder.name}`);
        return folder;
    }

    async validateFolderPath(folderPath) {
        try {
            const stats = await fs.stat(folderPath);
            return stats.isDirectory();
        } catch {
            try {
                // Tentar criar a pasta se não existir
                await fs.mkdir(folderPath, { recursive: true });
                return true;
            } catch {
                return false;
            }
        }
    }

    startWatching() {
        this.folders.forEach(folder => {
            if (folder.enabled) {
                this.startWatchingFolder(folder);
            }
        });
    }

    startWatchingFolder(folder) {
        if (this.watchers.has(folder.id)) {
            this.stopWatchingFolder(folder);
        }

        try {
            const watcher = fs.watch(folder.path, { recursive: true }, (eventType, filename) => {
                if (filename) {
                    this.handleFolderEvent(folder, eventType, filename);
                }
            });

            this.watchers.set(folder.id, watcher);
            logger.info(`Monitoramento iniciado para: ${folder.name} (${folder.path})`);
        } catch (error) {
            logger.error(`Erro ao iniciar monitoramento para ${folder.name}:`, error);
        }
    }

    stopWatchingFolder(folder) {
        const watcher = this.watchers.get(folder.id);
        if (watcher) {
            watcher.close();
            this.watchers.delete(folder.id);
            logger.info(`Monitoramento parado para: ${folder.name}`);
        }
    }

    async handleFolderEvent(folder, eventType, filename) {
        try {
            const filePath = path.join(folder.path, filename);
            const stats = await fs.stat(filePath);

            if (stats.isFile()) {
                logger.info(`Arquivo detectado em ${folder.name}: ${filename} (${eventType})`);
                
                if (folder.autoProcess && folder.type === 'input') {
                    await this.processFile(folder, filePath, filename);
                }
            }
        } catch (error) {
            logger.error(`Erro ao processar evento de pasta ${folder.name}:`, error);
        }
    }

    async processFile(folder, filePath, filename) {
        try {
            logger.info(`Processando arquivo: ${filename} em ${folder.name}`);
            
            // Aqui você implementaria a lógica de processamento
            // Por exemplo, conversão automática, mapeamento, etc.
            
            // Por enquanto, apenas logamos o evento
            logger.info(`Arquivo processado com sucesso: ${filename}`);
            
        } catch (error) {
            logger.error(`Erro ao processar arquivo ${filename}:`, error);
        }
    }

    getFolders() {
        return this.folders;
    }

    getFolder(id) {
        return this.folders.find(f => f.id === id);
    }

    getFoldersByType(type) {
        return this.folders.filter(f => f.type === type && f.enabled);
    }

    async enableFolder(id) {
        return this.updateFolder(id, { enabled: true });
    }

    async disableFolder(id) {
        return this.updateFolder(id, { enabled: false });
    }

    // Método para limpar recursos ao encerrar
    cleanup() {
        this.watchers.forEach(watcher => watcher.close());
        this.watchers.clear();
        logger.info('Gerenciador de pastas encerrado');
    }
}

// Instância singleton
const folderManager = new FolderManager();

// Cleanup ao encerrar a aplicação
process.on('SIGTERM', () => {
    folderManager.cleanup();
});

process.on('SIGINT', () => {
    folderManager.cleanup();
});

module.exports = folderManager;
