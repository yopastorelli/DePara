/**
 * Módulo de Operações de Arquivos para DePara
 * Gerencia mover, copiar, apagar e backup de arquivos com frequências personalizáveis
 *
 * @author yopastorelli
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const logger = require('./logger');

/**
 * Valida se um caminho é seguro para operações de arquivo
 * Previne acesso a diretórios não autorizados e ataques de path traversal
 */
async function validateSafePath(filePath, operation = 'read') {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Caminho inválido ou vazio');
  }

  // Resolver caminho absoluto
  const resolvedPath = path.resolve(filePath);

  // Verificar se contém caracteres de navegação perigosa
  if (filePath.includes('..') || filePath.includes('~') || filePath.includes('$')) {
    logger.warn(`Tentativa de acesso com caracteres suspeitos: ${filePath}`);
    throw new Error('Caminho contém caracteres não permitidos');
  }

  // Para aplicações locais, permitir acesso apenas a diretórios seguros
  const allowedBasePaths = [
    '/home',
    '/usr/local',
    '/opt',
    '/var',
    '/tmp',
    '/media',
    '/mnt',
    // Adicionar caminho do projeto
    path.resolve(__dirname, '../..'),
    // Adicionar drives do Windows se estiver em desenvolvimento
    ...(process.platform === 'win32' ? ['C:', 'D:', 'E:'] : [])
  ];

  const isAllowed = allowedBasePaths.some(basePath => {
    return resolvedPath.startsWith(path.resolve(basePath));
  });

  if (!isAllowed) {
    logger.warn(`Tentativa de acesso a caminho não autorizado: ${resolvedPath}`);
    throw new Error(`Acesso negado ao caminho: ${resolvedPath}`);
  }

  // Verificar se o caminho existe e é acessível
  try {
    const fs = require('fs').promises;
    const stats = await fs.stat(resolvedPath);

    // Verificar se é um arquivo/pasta válida
    if (!stats.isFile() && !stats.isDirectory()) {
      throw new Error(`Caminho não é um arquivo ou diretório válido: ${resolvedPath}`);
    }

    return resolvedPath;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Caminho não existe - verificar se podemos criar
      if (operation === 'write' || operation === 'create') {
        const fs = require('fs').promises;
        const parentDir = path.dirname(resolvedPath);
        try {
          await fs.access(parentDir);
          return resolvedPath;
        } catch (parentError) {
          logger.error(`Erro ao acessar diretório pai: ${parentDir}`, parentError);
          throw new Error(`Diretório pai não acessível: ${parentDir}`);
        }
      }
      throw new Error(`Caminho não existe: ${resolvedPath}`);
    }

    // Outros erros de sistema de arquivos
    if (error.code === 'EACCES') {
      throw new Error(`Acesso negado ao caminho: ${resolvedPath}`);
    } else if (error.code === 'ENOTDIR') {
      throw new Error(`Parte do caminho não é um diretório: ${resolvedPath}`);
    } else if (error.code === 'ENAMETOOLONG') {
      throw new Error(`Nome do arquivo muito longo: ${resolvedPath}`);
    }

    // Erro genérico
    logger.error(`Erro ao validar caminho: ${resolvedPath}`, error);
    throw new Error(`Erro ao acessar caminho: ${error.message}`);
  }
}

/**
 * Sanitiza um caminho removendo caracteres perigosos
 */
function sanitizePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return '';
  }

  // Remover caracteres perigosos
  return filePath
    .replace(/\.\./g, '') // Remover ..
    .replace(/~/g, '')    // Remover ~
    .replace(/\$/g, '')   // Remover $
    .replace(/\0/g, '')   // Remover null bytes
    .trim();
}

class FileOperationsManager {
    constructor() {
        this.operations = new Map();
        this.schedules = new Map();

        // Configurações otimizadas para Raspberry Pi
        this.maxConcurrentOperations = process.env.MAX_CONCURRENT_OPERATIONS || 2; // Reduzido para RPi
        this.maxRecursionDepth = process.env.MAX_RECURSION_DEPTH || 5;
        this.streamHighWaterMark = process.env.STREAM_HIGH_WATER_MARK || 64 * 1024; // 64KB para RPi
        this.backupConfig = {
            enabled: true,
            backupDir: path.join(process.cwd(), 'backups'),
            retentionDays: 30,
            compressBackups: true
        };
        this.init();
    }

    async init() {
        try {
            await this.ensureBackupDirectory();
            this.startScheduler();
            logger.info('Gerenciador de operações de arquivos inicializado');
        } catch (error) {
            logger.error('Erro ao inicializar gerenciador de operações:', error);
        }
    }

    async ensureBackupDirectory() {
        try {
            await fs.access(this.backupConfig.backupDir);
        } catch {
            await fs.mkdir(this.backupConfig.backupDir, { recursive: true });
            logger.info(`Diretório de backup criado: ${this.backupConfig.backupDir}`);
        }
    }

    /**
     * Executa operação de mover arquivo
     */
    async moveFile(sourcePath, targetPath, options = {}) {
        const operationId = this.generateOperationId();
        const startTime = Date.now();

        try {
            // Validar caminhos antes de qualquer operação
            const safeSourcePath = await validateSafePath(sourcePath, 'read');
            const safeTargetPath = await validateSafePath(targetPath, 'write');

            logger.startOperation('File Move', {
                operationId,
                sourcePath: safeSourcePath,
                targetPath: safeTargetPath,
                options
            });

            // Criar backup se solicitado
            if (options.backupBeforeMove) {
                await this.createBackup(safeSourcePath, 'move');
            }

            // Garantir que o diretório de destino existe
            const targetDir = path.dirname(safeTargetPath);
            await fs.mkdir(targetDir, { recursive: true });

            // Mover o arquivo
            await fs.rename(safeSourcePath, safeTargetPath);

            // Verificar se moveu corretamente
            const stats = await fs.stat(safeTargetPath);

            const duration = Date.now() - startTime;
            logger.endOperation('File Move', duration, {
                operationId,
                success: true,
                fileSize: stats.size,
                targetPath: safeTargetPath,
                preserveStructure: options.preserveStructure
            });

            return {
                success: true,
                operationId,
                fileSize: stats.size,
                duration,
                preserveStructure: options.preserveStructure
            };

        } catch (error) {
            logger.operationError('File Move', error, {
                operationId,
                sourcePath: safeSourcePath,
                targetPath: safeTargetPath
            });
            throw error;
        }
    }

    /**
     * Executa operação de copiar arquivo
     */
    async copyFile(sourcePath, targetPath, options = {}) {
        const operationId = this.generateOperationId();
        const startTime = Date.now();

        try {
            // Validar caminhos antes de qualquer operação
            const safeSourcePath = await validateSafePath(sourcePath, 'read');
            const safeTargetPath = await validateSafePath(targetPath, 'write');

            logger.startOperation('File Copy', {
                operationId,
                sourcePath: safeSourcePath,
                targetPath: safeTargetPath,
                options
            });

            // Garantir que o diretório de destino existe
            const targetDir = path.dirname(safeTargetPath);
            await fs.mkdir(targetDir, { recursive: true });

            // Copiar o arquivo
            await fs.copyFile(safeSourcePath, safeTargetPath);

            // Verificar se copiou corretamente
            const stats = await fs.stat(safeTargetPath);

            const duration = Date.now() - startTime;
            logger.endOperation('File Copy', duration, {
                operationId,
                success: true,
                fileSize: stats.size,
                targetPath: safeTargetPath,
                preserveStructure: options.preserveStructure
            });

            return {
                success: true,
                operationId,
                fileSize: stats.size,
                duration,
                preserveStructure: options.preserveStructure
            };

        } catch (error) {
            logger.operationError('File Copy', error, {
                operationId,
                sourcePath: safeSourcePath,
                targetPath: safeTargetPath
            });
            throw error;
        }
    }

    /**
     * Executa operação de apagar arquivo com backup
     */
    async deleteFile(filePath, options = {}) {
        const operationId = this.generateOperationId();
        const startTime = Date.now();

        try {
            // Validar caminho antes de qualquer operação
            const safeFilePath = await validateSafePath(filePath, 'write');

            logger.startOperation('File Delete', {
                operationId,
                filePath: safeFilePath,
                options
            });

            // Criar backup antes de apagar
            if (this.backupConfig.enabled || options.forceBackup) {
                await this.createBackup(safeFilePath, 'delete');
            }

            // Obter informações do arquivo antes de apagar
            const stats = await fs.stat(safeFilePath);
            const fileSize = stats.size;

            // Apagar o arquivo
            await fs.unlink(safeFilePath);

            const duration = Date.now() - startTime;
            logger.endOperation('File Delete', duration, {
                operationId,
                success: true,
                fileSize,
                backupCreated: this.backupConfig.enabled || options.forceBackup
            });

            return {
                success: true,
                operationId,
                fileSize,
                backupCreated: this.backupConfig.enabled || options.forceBackup,
                duration
            };

        } catch (error) {
            logger.operationError('File Delete', error, {
                operationId,
                filePath: safeFilePath
            });
            throw error;
        }
    }

    /**
     * Cria backup de arquivo antes de operação
     */
    async createBackup(filePath, operation) {
        try {
            const fileName = path.basename(filePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${fileName}.${operation}.${timestamp}`;

            const backupPath = path.join(this.backupConfig.backupDir, backupFileName);

            await fs.copyFile(filePath, backupPath);

            logger.info(`Backup criado: ${backupPath}`);

            // Limpar backups antigos se necessário
            await this.cleanupOldBackups();

            return backupPath;

        } catch (error) {
            logger.error(`Erro ao criar backup de ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Limpa backups antigos baseado na configuração de retenção
     */
    async cleanupOldBackups() {
        try {
            const files = await fs.readdir(this.backupConfig.backupDir);
            const now = Date.now();
            const retentionMs = this.backupConfig.retentionDays * 24 * 60 * 60 * 1000;

            for (const file of files) {
                const filePath = path.join(this.backupConfig.backupDir, file);
                const stats = await fs.stat(filePath);

                if (now - stats.mtime.getTime() > retentionMs) {
                    await fs.unlink(filePath);
                    logger.info(`Backup antigo removido: ${file}`);
                }
            }
        } catch (error) {
            logger.error('Erro ao limpar backups antigos:', error);
        }
    }

    /**
     * Agenda operação periódica
     */
    scheduleOperation(operationId, config) {
        const { frequency, action, sourcePath, targetPath, options = {} } = config;

        // Cancelar agendamento existente se houver
        if (this.schedules.has(operationId)) {
            clearInterval(this.schedules.get(operationId));
        }

        const intervalMs = this.parseFrequency(frequency);

        const intervalId = setInterval(async () => {
            try {
                await this.executeScheduledOperation(operationId, action, sourcePath, targetPath, options);
            } catch (error) {
                logger.error(`Erro na operação agendada ${operationId}:`, error);
            }
        }, intervalMs);

        this.schedules.set(operationId, intervalId);
        this.operations.set(operationId, config);

        logger.info(`Operação agendada: ${operationId} - ${frequency}`);
    }

    /**
     * Cancela agendamento de operação
     */
    cancelScheduledOperation(operationId) {
        if (this.schedules.has(operationId)) {
            clearInterval(this.schedules.get(operationId));
            this.schedules.delete(operationId);
            this.operations.delete(operationId);
            logger.info(`Agendamento cancelado: ${operationId}`);
        }
    }

    /**
     * Edita operação agendada existente
     */
    editScheduledOperation(operationId, newConfig) {
        // Verificar se a operação existe
        if (!this.operations.has(operationId)) {
            throw new Error(`Operação agendada não encontrada: ${operationId}`);
        }

        // Obter configuração atual
        const currentConfig = this.operations.get(operationId);

        // Mesclar configurações (novas sobrescrevem antigas)
        const mergedConfig = { ...currentConfig, ...newConfig };

        // Validar nova configuração
        const { frequency, action, sourcePath, targetPath, options = {} } = mergedConfig;

        if (!frequency || !action || !sourcePath) {
            throw new Error('Parâmetros obrigatórios ausentes: frequency, action, sourcePath');
        }

        // Validar ação suportada
        const supportedActions = ['move', 'copy', 'delete'];
        if (!supportedActions.includes(action.toLowerCase())) {
            throw new Error(`Ação não suportada: ${action}. Use: ${supportedActions.join(', ')}`);
        }

        // Validar targetPath quando necessário
        if ((action === 'move' || action === 'copy') && !targetPath) {
            throw new Error(`targetPath é obrigatório para ação '${action}'`);
        }

        // Cancelar agendamento atual
        this.cancelScheduledOperation(operationId);

        // Agendar com nova configuração
        this.scheduleOperation(operationId, mergedConfig);

        logger.info(`Operação editada: ${operationId} - ${frequency}`);

        return {
            operationId,
            config: mergedConfig,
            status: 'edited'
        };
    }

    /**
     * Executa operação agendada
     */
    async executeScheduledOperation(operationId, action, sourcePath, targetPath, options) {
        try {
            // Verificar se é uma operação em lote (pasta inteira)
            const fs = require('fs').promises;
            const stats = await fs.stat(sourcePath);
            if (options.batch && stats.isDirectory()) {
                await this.executeBatchOperation(operationId, action, sourcePath, targetPath, options);
            } else {
                await this.executeSingleOperation(operationId, action, sourcePath, targetPath, options);
            }
        } catch (error) {
            logger.error(`Erro na execução agendada ${operationId}:`, error);
        }
    }

    /**
     * Executa operação em lote (todos os arquivos de uma pasta)
     */
    async executeBatchOperation(operationId, action, sourceDir, targetDir, options) {
        try {
            const files = await this.getAllFiles(sourceDir, options.preserveStructure);
            let processed = 0;
            let errors = 0;
            const totalFiles = files.length;

            // Limitar processamento para Raspberry Pi
            const batchSize = Math.min(this.maxConcurrentOperations, 3); // Máximo 3 operações simultâneas
            const batches = [];

            // Dividir arquivos em lotes para processamento controlado
            for (let i = 0; i < files.length; i += batchSize) {
                batches.push(files.slice(i, i + batchSize));
            }

            // Emitir progresso inicial
            this.emitProgress(operationId, 0, totalFiles, 'Iniciando operação...');

            // Processar arquivos em lotes controlados
            for (const batch of batches) {
                // Processar arquivos do lote em paralelo, mas limitado
                const batchPromises = batch.map(async (filePath, indexInBatch) => {
                    const globalIndex = processed + errors + indexInBatch;

                    try {
                        // Emitir progresso atual
                        const progress = Math.round(((globalIndex + 1) / totalFiles) * 100);
                        this.emitProgress(operationId, progress, totalFiles, `Processando ${path.basename(filePath)}...`);

                        // Obter informações do arquivo
                        const stats = await fs.stat(filePath);
                        if (!stats.isFile()) {
                            return { status: 'skipped', reason: 'not a file' };
                        }

                        const fileName = path.basename(filePath);

                        // Aplicar filtros se configurados
                        if (!this.matchesFilters(fileName, options.filters, filePath)) {
                            return { status: 'skipped', reason: 'filter mismatch' };
                        }

                        let targetPath;
                        if (options.preserveStructure) {
                            // Manter estrutura de pastas
                            const relativePath = path.relative(sourceDir, filePath);
                            targetPath = path.join(targetDir, relativePath);
                        } else {
                            // Achatar estrutura (todos os arquivos na raiz do destino)
                            targetPath = path.join(targetDir, fileName);
                        }

                        switch (action) {
                            case 'move':
                                await this.moveFile(filePath, targetPath, options);
                                break;
                            case 'copy':
                                await this.copyFile(filePath, targetPath, options);
                                break;
                            case 'delete':
                                await this.deleteFile(filePath, options);
                                break;
                        }

                        return { status: 'processed' };

                    } catch (error) {
                        logger.error(`Erro ao processar arquivo ${filePath}:`, error);
                        return { status: 'error', error: error.message };
                    }
                });

                // Aguardar conclusão do lote atual
                const batchResults = await Promise.all(batchPromises);

                // Contabilizar resultados
                for (const result of batchResults) {
                    if (result.status === 'processed') {
                        processed++;
                    } else if (result.status === 'error') {
                        errors++;
                    }
                }

                // Pequena pausa entre lotes para não sobrecarregar o Raspberry Pi
                if (batches.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Emitir progresso final
            this.emitProgress(operationId, 100, totalFiles, `Concluído: ${processed} processados, ${errors} erros`);

            logger.info(`Operação em lote concluída: ${processed} processados, ${errors} erros, preserveStructure: ${options.preserveStructure}`);

        } catch (error) {
            // Emitir erro de progresso
            this.emitProgress(operationId, -1, 0, `Erro: ${error.message}`);
            logger.error(`Erro na operação em lote ${operationId}:`, error);
        }
    }

    /**
     * Emite progresso da operação
     */
    emitProgress(operationId, percentage, total, message) {
        const progressData = {
            operationId,
            percentage,
            total,
            message,
            timestamp: new Date().toISOString()
        };

        // Salvar progresso para consultas
        if (!this.progressStore) {
            this.progressStore = new Map();
        }
        this.progressStore.set(operationId, progressData);

        logger.info(`Progresso ${operationId}: ${percentage}% - ${message}`);
    }

    /**
     * Obtém progresso de uma operação
     */
    getProgress(operationId) {
        return this.progressStore?.get(operationId) || null;
    }

    /**
     * Lista todas as operações em andamento
     */
    getActiveOperations() {
        const active = [];
        for (const [id, progress] of this.progressStore || []) {
            if (progress.percentage >= 0 && progress.percentage < 100) {
                active.push(progress);
            }
        }
        return active;
    }

    /**
     * Obtém todos os arquivos recursivamente de uma pasta
     */
    async getAllFiles(dirPath, preserveStructure = false) {
        const files = [];

        async function scanDirectory(currentPath) {
            const items = await fs.readdir(currentPath);

            for (const item of items) {
                const itemPath = path.join(currentPath, item);
                const stats = await fs.stat(itemPath);

                if (stats.isDirectory()) {
                    // Sempre escanear subdiretórios, independente de preserveStructure
                    await scanDirectory(itemPath);
                } else if (stats.isFile()) {
                    files.push(itemPath);
                }
            }
        }

        await scanDirectory(dirPath);
        return files;
    }

    /**
     * Executa operação em arquivo único
     */
    async executeSingleOperation(operationId, action, sourcePath, targetPath, options) {
        try {
            // Verificar se arquivo existe
            await fs.access(sourcePath);

            switch (action) {
                case 'move':
                    await this.moveFile(sourcePath, targetPath, options);
                    break;
                case 'copy':
                    await this.copyFile(sourcePath, targetPath, options);
                    break;
                case 'delete':
                    await this.deleteFile(sourcePath, options);
                    break;
            }

        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn(`Arquivo não encontrado para operação ${operationId}: ${sourcePath}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Lista de arquivos/pastas que devem ser ignorados (Resilio Sync + sistema)
     */
    getIgnoredPatterns() {
        return {
            // Resilio Sync (BitTorrent Sync)
            resilioSync: [
                '.sync',           // Diretório de configuração
                '.!sync',          // Arquivos temporários de sync
                '.rsls',           // Arquivos de lista de sincronização
                '.syncignore',     // Arquivo de configuração de ignore
                '.bts',            // Arquivos BitTorrent Sync (legacy)
                '.sync.ffs_db',    // Database FreeFileSync
                '.sync.ffs_lock',  // Lock files FreeFileSync
                '*.!sync',         // Arquivos temporários com extensão
                '*.sync',          // Arquivos de configuração
                '*.rsls',          // Arquivos de lista
                '*.bts'            // Arquivos BitTorrent
            ],

            // Arquivos de sistema gerais
            systemFiles: [
                'Thumbs.db',       // Windows thumbnails
                '.DS_Store',       // macOS
                'desktop.ini',     // Windows
                '.directory',      // Linux/KDE
                '.Trash-*',        // Linux trash
                '.fseventsd',      // macOS file events
                '.Spotlight-*',    // macOS Spotlight
                '.TemporaryItems', // macOS temp items
                '._*',             // macOS resource forks
                '$RECYCLE.BIN',    // Windows recycle bin
                'System Volume Information', // Windows system
                '.AppleDouble',    // macOS
                '.AppleDB',        // macOS
                '.AppleDesktop',   // macOS
                'Network Trash Folder', // macOS
                'Temporary Items', // macOS
                '.apdisk'          // macOS disk images
            ],

            // Arquivos temporários comuns
            tempFiles: [
                '~$*',             // Arquivos temporários Office
                '*.tmp',           // Arquivos temporários
                '*.temp',          // Arquivos temporários
                '*.bak',           // Backups
                '*.backup',        // Backups
                '*.swp',           // Vim swap
                '*.swo',           // Vim swap
                '*~',              // Backup files
                '.#*',             // Emacs lock files
                '#*#',             // Emacs auto-save
                '*.lock',          // Lock files
                '*.lck',           // Lock files
                '.nfs*',           // NFS temp files
                '4913',            // NFS temp files
                '*.part',          // Partial downloads
                '*.crdownload',    // Chrome downloads
                '*.download',      // Generic downloads
                '*.td.part',       // Thunderbird partial
                '*.fcache',        // Font cache
                '*.pyc',           // Python compiled
                '__pycache__',     // Python cache dir
                '*.pyo',           // Python optimized
                '*.class',         // Java compiled
                '*.jar',           // Java archives
                'target/',         // Maven/Gradle build
                'build/',          // Build directories
                'dist/',           // Distribution dirs
                'node_modules/',   // Node.js dependencies
                '.git/',           // Git repository
                '.svn/',           // SVN repository
                '.hg/',            // Mercurial repository
                '.bzr/',           // Bazaar repository
                'CVS/',            // CVS repository
                '.sass-cache/',    // Sass cache
                '.cache/',         // Generic cache
                '*.log',           // Log files
                '*.pid',           // Process ID files
                '*.sock'           // Socket files
            ]
        };
    }

    /**
     * Verifica se um arquivo deve ser ignorado
     */
    shouldIgnoreFile(filePath, filename) {
        const ignoredPatterns = this.getIgnoredPatterns();
        const fullPath = filePath.toLowerCase();
        const baseName = filename.toLowerCase();

        // Função auxiliar para verificar padrões
        const matchesPattern = (pattern) => {
            if (pattern.includes('*')) {
                // Converter wildcard para regex
                const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
                return regex.test(filename) || regex.test(filePath);
            } else {
                return baseName === pattern.toLowerCase() ||
                       fullPath.includes('/' + pattern.toLowerCase() + '/') ||
                       fullPath.endsWith('/' + pattern.toLowerCase());
            }
        };

        // Verificar todos os grupos de padrões
        for (const [groupName, patterns] of Object.entries(ignoredPatterns)) {
            for (const pattern of patterns) {
                if (matchesPattern(pattern)) {
                    logger.debug(`Arquivo ignorado (${groupName}): ${filePath}`);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Verifica se arquivo corresponde aos filtros
     */
    matchesFilters(filename, filters = {}, filePath = '') {
        // Primeiro, verificar se deve ser ignorado (sempre)
        if (this.shouldIgnoreFile(filePath, filename)) {
            return false;
        }

        if (!filters || Object.keys(filters).length === 0) return true;

        // Filtro por extensão
        if (filters.extensions && filters.extensions.length > 0) {
            const ext = path.extname(filename).toLowerCase().slice(1);
            if (!filters.extensions.includes(ext)) return false;
        }

        // Filtro por tamanho (se conseguir obter)
        if (filters.minSize || filters.maxSize) {
            // Implementar verificação de tamanho se necessário
        }

        // Filtro por padrão de nome
        if (filters.pattern) {
            const regex = new RegExp(filters.pattern, 'i');
            if (!regex.test(filename)) return false;
        }

        return true;
    }

    /**
     * Gera caminho de destino baseado nas opções
     */
    generateTargetPath(filename, targetDir, options) {
        let targetFilename = filename;

        // Adicionar timestamp se solicitado
        if (options.addTimestamp) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const ext = path.extname(filename);
            const nameWithoutExt = path.basename(filename, ext);
            targetFilename = `${nameWithoutExt}_${timestamp}${ext}`;
        }

        // Adicionar sufixo se solicitado
        if (options.suffix) {
            const ext = path.extname(filename);
            const nameWithoutExt = path.basename(filename, ext);
            targetFilename = `${nameWithoutExt}${options.suffix}${ext}`;
        }

        return path.join(targetDir, targetFilename);
    }

    /**
     * Converte frequência para milissegundos
     */
    parseFrequency(frequency) {
        const match = frequency.match(/^(\d+)([smhd])$/);
        if (!match) return 60000; // padrão 1 minuto

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;        // segundos
            case 'm': return value * 60 * 1000;   // minutos
            case 'h': return value * 60 * 60 * 1000; // horas
            case 'd': return value * 24 * 60 * 60 * 1000; // dias
            default: return 60000;
        }
    }

    /**
     * Gera ID único para operação
     */
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Lista todas as operações agendadas
     */
    getScheduledOperations() {
        const operations = [];
        for (const [id, config] of this.operations) {
            operations.push({
                id,
                ...config,
                active: this.schedules.has(id)
            });
        }
        return operations;
    }

    /**
     * Para todas as operações agendadas
     */
    stopAllScheduledOperations() {
        for (const [id, intervalId] of this.schedules) {
            clearInterval(intervalId);
        }
        this.schedules.clear();
        this.operations.clear();
        logger.info('Todas as operações agendadas foram paradas');
    }

    /**
     * Obtém estatísticas das operações
     */
    getStats() {
        return {
            scheduledOperations: this.schedules.size,
            totalOperations: this.operations.size,
            backupEnabled: this.backupConfig.enabled,
            backupDir: this.backupConfig.backupDir,
            retentionDays: this.backupConfig.retentionDays
        };
    }

    /**
     * Lista imagens recursivamente para slideshow
     */
    async listImagesRecursive(folderPath, options = {}) {
        const { maxDepth = 10, extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'] } = options;
        const images = [];

        try {
            const stats = await fs.stat(folderPath);
            if (!stats.isDirectory()) {
                throw new Error('Caminho especificado não é uma pasta');
            }

            async function scanDirectory(currentPath, currentDepth = 0) {
                if (currentDepth > maxDepth) return;

                try {
                    const items = await fs.readdir(currentPath);

                    for (const item of items) {
                        const itemPath = path.join(currentPath, item);
                        const itemStats = await fs.stat(itemPath);

                        if (itemStats.isDirectory()) {
                            // Recursivamente escanear subpastas
                            await scanDirectory(itemPath, currentDepth + 1);
                        } else if (itemStats.isFile()) {
                            const ext = path.extname(item).toLowerCase().slice(1);
                            if (extensions.includes(ext)) {
                                // Verificar se não deve ser ignorado
                                if (!this.shouldIgnoreFile(currentPath, item)) {
                                    images.push({
                                        path: itemPath,
                                        name: item,
                                        size: itemStats.size,
                                        modified: itemStats.mtime,
                                        extension: ext,
                                        relativePath: path.relative(folderPath, itemPath)
                                    });
                                }
                            }
                        }
                    }
                } catch (error) {
                    logger.warn(`Erro ao escanear pasta ${currentPath}:`, error.message);
                }
            }

            await scanDirectory.call(this, folderPath);

            // Ordenar imagens por data de modificação (mais recentes primeiro)
            images.sort((a, b) => b.modified.getTime() - a.modified.getTime());

            return images;

        } catch (error) {
            logger.error(`Erro ao listar imagens da pasta ${folderPath}:`, error);
            throw error;
        }
    }

    /**
     * Atualiza configuração de backup
     */
    updateBackupConfig(config) {
        this.backupConfig = { ...this.backupConfig, ...config };
        logger.info('Configuração de backup atualizada:', this.backupConfig);
    }
}

// Instância singleton
const fileOperationsManager = new FileOperationsManager();

// Cleanup ao encerrar
process.on('SIGTERM', () => {
    fileOperationsManager.stopAllScheduledOperations();
});

process.on('SIGINT', () => {
    fileOperationsManager.stopAllScheduledOperations();
});

module.exports = fileOperationsManager;
