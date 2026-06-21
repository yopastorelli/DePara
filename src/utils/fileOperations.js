/**
 * Módulo de Operações de Arquivos para DePara
 * Gerencia mover, copiar, apagar e backup de arquivos com frequências personalizáveis
 *
 * @author yopastorelli
 * @version 2.0.0
 */

const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const logger = require('./logger');
const { getRuntimeBackupsDir, getRuntimeDataDir, getSourceRepoRoot } = require('./runtimePaths');
const {
    recordMigrationStatus,
    getMigrationStatus
} = require('./persistenceMigration');
const {
    fixFilePermissions,
    ensureWritableTarget,
    copyOrMoveWithOptionalShellFallback
} = require('./fileOps/permissions');
const { scanImagesRecursive } = require('./fileOps/imageScanner');

/**
 * Função utilitária para corrigir permissões de arquivos/diretórios
 * Necessária para sistemas NTFS que criam arquivos como root
 * @param {string} filePath - Caminho do arquivo/diretório
 * @param {string} permissions - Permissões (padrão: 755)
 */
async function legacyFixFilePermissions(filePath, permissions = '755') {
    try {
        // Executar chmod para corrigir permissões
        await execAsync(`chmod ${permissions} "${filePath}"`);
        logger.debug(`✅ Permissões corrigidas: ${filePath} (${permissions})`);
        
        // Verificar se a correção funcionou
        const stats = await fs.stat(filePath);
        logger.debug(`📊 Estatísticas após correção: ${JSON.stringify({
            mode: stats.mode.toString(8),
            uid: stats.uid,
            gid: stats.gid
        })}`);
        
    } catch (error) {
        // Log como aviso, não como erro, pois não é crítico
        logger.warn(`⚠️ Não foi possível corrigir permissões de ${filePath}: ${error.message}`);
        
        // Tentar com sudo se disponível
        try {
            await execAsync(`sudo chmod ${permissions} "${filePath}"`);
            logger.info(`✅ Permissões corrigidas com sudo: ${filePath} (${permissions})`);
        } catch (sudoError) {
            logger.warn(`⚠️ Falha mesmo com sudo: ${sudoError.message}`);
        }
    }
}

/**
 * Verificar e corrigir permissões no Raspberry Pi
 * @param {string} sourcePath - Caminho de origem
 * @param {string} targetPath - Caminho de destino
 * @param {string} operation - Tipo de operação
 */
async function legacyCheckRaspberryPiPermissions(sourcePath, targetPath, operation) {
    try {
        // Detectar se está rodando no Raspberry Pi
        const isRaspberryPi = process.platform === 'linux' && 
                             (process.arch === 'arm' || process.arch === 'arm64');
        
        logger.info(`🔍 DEBUG - Detecção Raspberry Pi:`, {
            platform: process.platform,
            arch: process.arch,
            user: process.env.USER,
            isRaspberryPi: isRaspberryPi
        });

        if (!isRaspberryPi) {
            logger.debug('Não é Raspberry Pi, pulando verificação de permissões');
            return;
        }

        logger.info(`🍓 Verificando permissões no Raspberry Pi para ${operation}`);
        logger.info(`🔍 DEBUG - Caminhos:`, {
            sourcePath: sourcePath,
            targetPath: targetPath,
            operation: operation
        });

        // Verificar permissões do arquivo de origem
        try {
            await fs.access(sourcePath, fs.constants.R_OK);
            logger.info(`✅ Permissão de leitura OK: ${sourcePath}`);
        } catch (error) {
            logger.warn(`⚠️ Sem permissão de leitura: ${sourcePath} - ${error.message}`);
            // Tentar corrigir permissões
            await legacyFixFilePermissions(sourcePath, '644');
        }

        // Verificar/criar diretório de destino
        const targetDir = path.dirname(targetPath);
        try {
            await fs.access(targetDir, fs.constants.W_OK);
            logger.debug(`✅ Permissão de escrita OK: ${targetDir}`);
        } catch (error) {
            logger.warn(`⚠️ Sem permissão de escrita: ${targetDir}`);
            // Criar diretório com permissões corretas
            await fs.mkdir(targetDir, { recursive: true });
            await legacyFixFilePermissions(targetDir, '755');
        }

        // Verificar se o usuário tem permissão sudo
        try {
            await execAsync('sudo -n true');
            logger.debug('✅ Permissão sudo disponível');
        } catch (error) {
            logger.warn('⚠️ Sem permissão sudo - operações podem falhar');
        }

    } catch (error) {
        logger.warn(`⚠️ Erro na verificação de permissões: ${error.message}`);
    }
}

/**
 * Função para executar operações de arquivo com sudo quando necessário
 * @param {string} sourcePath - Caminho de origem
 * @param {string} targetPath - Caminho de destino
 * @param {string} operation - Tipo de operação (copy, move)
 */
async function legacyExecuteFileOperationWithSudo(sourcePath, targetPath, operation) {
    try {
        if (operation === 'copy') {
            // Tentar cópia normal primeiro
            await fs.copyFile(sourcePath, targetPath);
            logger.debug(`✅ Cópia normal bem-sucedida: ${sourcePath} -> ${targetPath}`);
        } else if (operation === 'move') {
            // Tentar rename primeiro
            await fs.rename(sourcePath, targetPath);
            logger.debug(`✅ Move normal bem-sucedido: ${sourcePath} -> ${targetPath}`);
        }
        
        // Corrigir permissões após operação bem-sucedida
        await legacyFixFilePermissions(targetPath);
        
    } catch (error) {
        if (error.code === 'EPERM') {
            logger.warn(`⚠️ EPERM detectado, tentando com sudo: ${sourcePath} -> ${targetPath}`);
            
            try {
                if (operation === 'copy') {
                    // Usar sudo cp para copiar
                    await execAsync(`sudo cp "${sourcePath}" "${targetPath}"`);
                    logger.info(`✅ Cópia com sudo bem-sucedida: ${sourcePath} -> ${targetPath}`);
                } else if (operation === 'move') {
                    // Usar sudo mv para mover
                    await execAsync(`sudo mv "${sourcePath}" "${targetPath}"`);
                    logger.info(`✅ Move com sudo bem-sucedido: ${sourcePath} -> ${targetPath}`);
                }
                
                // Corrigir permissões após operação com sudo
                await legacyFixFilePermissions(targetPath);
                
            } catch (sudoError) {
                logger.error(`❌ Erro mesmo com sudo: ${sudoError.message}`);
                throw new Error(`Operação falhou mesmo com sudo: ${sudoError.message}`);
            }
        } else {
            // Re-throw outros erros
            throw error;
        }
    }
}

// Evitar redeclarações desnecessárias
const fsSync = require('fs');

/**
 * Lista de arquivos e extensões que devem ser ignorados automaticamente
 * Inclui arquivos do sistema, temporários e de sincronização
 */
const IGNORED_FILES = [
  // Arquivos do Resilio Sync
  '.sync',
  '!sync',
  '*.!sync',
  '*.sync',
  '.resilio-sync',
  'resilio-sync',

  // Arquivos do sistema
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  '.directory',

  // Arquivos temporários
  '*.tmp',
  '*.temp',
  '~$*',
  '*.bak',
  '*.backup',

  // Arquivos de log
  '*.log',
  '*.log.*',

  // Arquivos de configuração
  '.git',
  '.gitignore',
  '.svn',
  '.hg',

  // Outros arquivos de sistema
  '.Trash',
  '.fseventsd',
  '.Spotlight-V100',
  '.Trashes',
  '.AppleDouble',
  '.LSOverride'
];

/**
 * Lista de pastas comuns que podem ser sugeridas para o usuário
 * Função que gera caminhos baseados na plataforma atual
 */
const getCommonFolders = () => {
  const userHome = process.env.HOME || process.env.USERPROFILE || '/tmp';

  if (process.platform === 'win32') {
    // Windows
    return [
      userHome,
      path.join(userHome, 'Documents'),
      path.join(userHome, 'Downloads'),
      path.join(userHome, 'Pictures'),
      path.join(userHome, 'Videos'),
      path.join(userHome, 'Music'),
      path.join(userHome, 'Desktop'),
      'C:\\',
      'D:\\',
      path.join(userHome, 'AppData', 'Local', 'Temp')
    ];
  } else {
    // Linux/Unix/Raspberry Pi
    return [
      userHome,
      path.join(userHome, 'Documents'),
      path.join(userHome, 'Downloads'),
      path.join(userHome, 'Pictures'),
      path.join(userHome, 'Videos'),
      path.join(userHome, 'Music'),
      path.join(userHome, 'Desktop'),
      '/media',
      '/mnt',
      '/tmp',
      '/var/log'
    ];
  }
};

/**
 * Verifica se um arquivo deve ser ignorado baseado na lista de arquivos ignorados
 * @param {string} fileName - Nome do arquivo
 * @returns {boolean} - true se deve ser ignorado
 */
function shouldIgnoreFile(fileName) {
  if (!fileName || typeof fileName !== 'string') return false;

  const fileNameLower = fileName.toLowerCase();

  for (const pattern of IGNORED_FILES) {
    // Verificar padrões com wildcard
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      if (new RegExp(regexPattern, 'i').test(fileNameLower)) {
        return true;
      }
    } else {
      // Verificar correspondência exata
      if (fileNameLower === pattern.toLowerCase()) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Filtra arquivos ignorados de uma lista
 * @param {Array} files - Lista de arquivos
 * @returns {Array} - Lista filtrada sem arquivos ignorados
 */
function filterIgnoredFiles(files) {
  return files.filter(file => !shouldIgnoreFile(file.name || file));
}

/**
 * Valida se um caminho é seguro para operações de arquivo
 * Previne acesso a diretórios não autorizados e ataques de path traversal
 */
function getAllowedBasePaths() {
  const configuredPaths = (process.env.DEPARA_ALLOWED_PATHS || '')
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);

  if (configuredPaths.length > 0) {
    return configuredPaths.map((item) => path.resolve(item));
  }

  if (process.platform === 'win32') {
    return [os.homedir(), 'C:\\', 'D:\\', 'E:\\'].map((item) => path.resolve(item));
  }

  return [os.homedir(), os.tmpdir(), '/media', '/mnt'].map((item) => path.resolve(item));
}

function isPathWithinBase(candidatePath, basePath) {
  const relativePath = path.relative(basePath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath));
}

function assertAllowedPath(candidatePath) {
  if (!getAllowedBasePaths().some((basePath) => isPathWithinBase(candidatePath, basePath))) {
    throw new Error(`Acesso negado ao caminho: ${candidatePath}`);
  }
}

async function findExistingParent(candidatePath) {
  let currentPath = candidatePath;

  while (true) {
    try {
      await fs.access(currentPath);
      return currentPath;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        throw new Error(`Nenhum diretório pai acessível para: ${candidatePath}`);
      }
      currentPath = parentPath;
    }
  }
}

async function validateSafePath(filePath, operation = 'read') {
  if (!filePath || typeof filePath !== 'string' || filePath.includes('\0')) {
    throw new Error('Caminho inválido ou vazio');
  }

  if (filePath.includes('../') || filePath.includes('..\\') || filePath.startsWith('~/')) {
    logger.warn(`Tentativa de acesso com sequências suspeitas: ${filePath}`);
    throw new Error('Caminho contém sequências não permitidas');
  }

  const resolvedPath = path.resolve(filePath);
  assertAllowedPath(resolvedPath);

  try {
    const realPath = await fs.realpath(resolvedPath);
    assertAllowedPath(realPath);
    const stats = await fs.stat(realPath);

    if (!stats.isFile() && !stats.isDirectory()) {
      throw new Error(`Caminho não é um arquivo ou diretório válido: ${realPath}`);
    }

    return realPath;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      if (error.code === 'EACCES') {
        throw new Error(`Acesso negado ao caminho: ${resolvedPath}`);
      }
      throw error;
    }
  }

  const existingParent = await findExistingParent(path.dirname(resolvedPath));
  const realParent = await fs.realpath(existingParent);
  assertAllowedPath(realParent);

  if (operation === 'write' || operation === 'create') {
    return resolvedPath;
  }

  if (operation === 'read') {
    return resolvedPath;
  }

  throw new Error(`Caminho não existe: ${resolvedPath}`);
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

        // Persistência de operações agendadas
        this.dataDir = getRuntimeDataDir();
        this.persistenceFile = path.join(this.dataDir, 'scheduled-operations.json');
        const sourceRepoRoot = getSourceRepoRoot();
        this.legacyPersistenceFiles = [
            path.join(sourceRepoRoot, 'data', 'scheduled-operations.json'),
            path.join(sourceRepoRoot, 'src', 'data', 'scheduled-operations.json')
        ];

        // Configurações otimizadas para Raspberry Pi
        this.maxConcurrentOperations = process.env.MAX_CONCURRENT_OPERATIONS || 2; // Reduzido para RPi
        this.maxRecursionDepth = process.env.MAX_RECURSION_DEPTH || 5;
        this.streamHighWaterMark = process.env.STREAM_HIGH_WATER_MARK || 64 * 1024; // 64KB para RPi
        this.backupConfig = {
            enabled: true,
            backupDir: getRuntimeBackupsDir(),
            retentionDays: 30,
            compressBackups: true
        };
        this.initialized = false;
        this.initializingPromise = null;
        this.init();
    }

    async init() {
        if (this.initialized) {
            return this;
        }

        if (this.initializingPromise) {
            return this.initializingPromise;
        }

        this.initializingPromise = (async () => {
            try {
                // Garantir que o diretório de logs existe

                // Inicializar diretório de backup
                await this.ensureBackupDirectory();

                // Carregar operações agendadas salvas
                await this.loadScheduledOperations();

                this.initialized = true;
                logger.info('Gerenciador de operações de arquivos inicializado com sucesso');
                return this;
            } catch (error) {
                logger.error('Erro ao inicializar gerenciador de operações de arquivos:', error);
                throw error;
            } finally {
                this.initializingPromise = null;
            }
        })();

        return this.initializingPromise;
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
     * Carrega operações agendadas do arquivo de persistência
     */
    async loadScheduledOperations() {
        try {
            // Garantir que o diretório de dados existe
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // Verificar se o arquivo de persistência existe
            try {
                await fs.access(this.persistenceFile);
                const marker = await getMigrationStatus();
                if (!marker.scheduledOperations || marker.scheduledOperations.outcome === 'unknown') {
                    await recordMigrationStatus('scheduledOperations', {
                        migrated: false,
                        source: 'runtime',
                        outcome: 'runtime_present'
                    });
                }
            } catch (error) {
                const migrated = await this.tryMigrateLegacyScheduledOperations();
                if (!migrated) {
                    // Arquivo não existe - criar arquivo vazio
                    await this.saveScheduledOperations();
                    logger.info('Arquivo de persistência de operações agendadas criado');
                    return;
                }
            }
            
            // Ler arquivo de persistência
            const data = await fs.readFile(this.persistenceFile, 'utf8');
            const savedOperations = JSON.parse(data);
            
            logger.info(`Carregando ${savedOperations.length} operações agendadas do arquivo de persistência`);
            
            // Restaurar operações
            for (const operation of savedOperations) {
                const { id, config } = operation;
                const normalizedConfig = this.normalizeScheduledOperationConfig(config);

                this.operations.set(id, normalizedConfig);
                this.armScheduledOperation(id, normalizedConfig);
            }
            
            logger.info(`✅ ${savedOperations.length} operações agendadas carregadas e reagendadas`);
            
        } catch (error) {
            logger.error('Erro ao carregar operações agendadas:', error);
        }
    }

    async tryMigrateLegacyScheduledOperations() {
        for (const legacyPath of this.legacyPersistenceFiles) {
            if (path.resolve(legacyPath) === path.resolve(this.persistenceFile)) {
                continue;
            }

            if (!fsSync.existsSync(legacyPath)) {
                continue;
            }

            await fs.copyFile(legacyPath, this.persistenceFile);
            await recordMigrationStatus('scheduledOperations', {
                migrated: true,
                source: legacyPath,
                outcome: 'migrated'
            });
            logger.info('Operações agendadas migradas para o runtime', {
                source: legacyPath,
                target: this.persistenceFile
            });
            return true;
        }

        await recordMigrationStatus('scheduledOperations', {
            migrated: false,
            source: null,
            outcome: 'legacy_not_found'
        });
        return false;
    }

    /**
     * Salva operações agendadas no arquivo de persistência
     */
    async saveScheduledOperations() {
        try {
            // Garantir que o diretório de dados existe
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // Converter Map para array
            const operationsArray = Array.from(this.operations.entries()).map(([id, config]) => ({
                id,
                config,
                timestamp: new Date().toISOString()
            }));
            
            // Salvar no arquivo
            await fs.writeFile(this.persistenceFile, JSON.stringify(operationsArray, null, 2), 'utf8');
            
            logger.info(`✅ ${operationsArray.length} operações agendadas salvas no arquivo de persistência`);
            
        } catch (error) {
            logger.error('Erro ao salvar operações agendadas:', error);
        }
    }

    async exportScheduledOperations() {
        await fs.mkdir(this.dataDir, { recursive: true });
        return Array.from(this.operations.entries()).map(([id, config]) => ({
            id,
            config: this.normalizeScheduledOperationConfig(config),
            timestamp: new Date().toISOString()
        }));
    }

    async getPersistenceStatus() {
        const marker = await getMigrationStatus();
        return marker.scheduledOperations || {
            migrated: false,
            source: null,
            outcome: 'unknown',
            attemptedAt: null
        };
    }

    normalizeScheduledOperationConfig(config = {}) {
        return {
            ...config,
            options: config.options || {},
            active: config.active !== false
        };
    }

    validateScheduledOperationConfig(config) {
        const normalizedConfig = this.normalizeScheduledOperationConfig(config);
        const { name, frequency, action, sourcePath, targetPath } = normalizedConfig;

        if (!name || !frequency || !action || !sourcePath) {
            throw new Error('Parâmetros obrigatórios ausentes: name, frequency, action, sourcePath');
        }

        const normalizedAction = action.toLowerCase();
        const supportedActions = ['move', 'copy', 'delete'];
        if (!supportedActions.includes(normalizedAction)) {
            throw new Error(`Ação não suportada: ${action}. Use: ${supportedActions.join(', ')}`);
        }

        if ((normalizedAction === 'move' || normalizedAction === 'copy') && !targetPath) {
            throw new Error(`targetPath é obrigatório para ação '${normalizedAction}'`);
        }

        return {
            ...normalizedConfig,
            action: normalizedAction
        };
    }

    unscheduleOperation(operationId) {
        if (this.schedules.has(operationId)) {
            clearInterval(this.schedules.get(operationId));
            this.schedules.delete(operationId);
        }
    }

    armScheduledOperation(operationId, config) {
        this.unscheduleOperation(operationId);

        if (config.active === false) {
            logger.info(`Operação desativada mantida sem timer: ${operationId}`);
            return;
        }

        const intervalMs = this.parseFrequency(config.frequency);

        if (intervalMs > 0) {
            const intervalId = setInterval(async () => {
                try {
                    await this.executeScheduledOperation(
                        operationId,
                        config.action,
                        config.sourcePath,
                        config.targetPath,
                        config.options || {}
                    );
                } catch (error) {
                    logger.error(`Erro na operação agendada ${operationId}:`, error);
                }
            }, intervalMs);

            this.schedules.set(operationId, intervalId);
            logger.info(`Operação reagendada: ${operationId} - ${config.frequency}`);
            return;
        }

        if (intervalMs === 0) {
            logger.info(`Executando operação de inicialização: ${operationId}`);
            this.executeScheduledOperation(
                operationId,
                config.action,
                config.sourcePath,
                config.targetPath,
                config.options || {}
            ).catch(error => {
                logger.error(`Erro na operação de inicialização ${operationId}:`, error);
            });
            return;
        }

        logger.info(`Operação manual restaurada: ${operationId}`);
    }

    /**
     * Move arquivo com suporte a cross-device (copy + delete)
     */
    async moveFileCrossDevice(sourcePath, targetPath) {
        try {
            // Tentar rename primeiro (mais rápido para mesmo dispositivo)
            await copyOrMoveWithOptionalShellFallback(sourcePath, targetPath, 'move');
            
            // Validar que o arquivo chegou ao destino
            const targetStats = await fs.stat(targetPath);
            await fs.access(targetPath, fs.constants.R_OK);
            
            logger.info(`✅ Arquivo movido com rename: ${sourcePath} -> ${targetPath} (${targetStats.size} bytes)`);
        } catch (error) {
            if (error.code === 'EXDEV') {
                // Cross-device link not permitted - usar copy + delete
                logger.info(`Cross-device detectado, usando copy + delete: ${sourcePath} -> ${targetPath}`);
                
                // Garantir que o diretório de destino existe
                const targetDir = path.dirname(targetPath);
                await fs.mkdir(targetDir, { recursive: true });
                
                // Copiar arquivo com suporte a sudo
                await copyOrMoveWithOptionalShellFallback(sourcePath, targetPath, 'copy');
                
                // Verificar se a cópia foi bem-sucedida
                const sourceStats = await fs.stat(sourcePath);
                const targetStats = await fs.stat(targetPath);
                
                // Validação robusta: tamanho, existência e integridade
                if (sourceStats.size === targetStats.size && targetStats.size > 0) {
                    // Verificação adicional: tentar ler o arquivo de destino
                    try {
                        await fs.access(targetPath, fs.constants.R_OK);
                        
                        // Se chegou até aqui, a cópia foi bem-sucedida
                        await fs.unlink(sourcePath);
                        
                        logger.info(`✅ Arquivo movido com copy + delete: ${sourcePath} -> ${targetPath} (${targetStats.size} bytes)`);
                    } catch (accessError) {
                        // Arquivo de destino não é legível
                        await fs.unlink(targetPath); // Limpar arquivo corrompido
                        throw new Error(`Arquivo de destino não é legível: ${targetPath}`);
                    }
                } else {
                    // Tamanhos diferentes ou arquivo vazio - erro na cópia
                    await fs.unlink(targetPath); // Limpar arquivo parcial
                    throw new Error(`Erro na cópia: tamanhos diferentes (origem: ${sourceStats.size}, destino: ${targetStats.size})`);
                }
            } else {
                // Outro tipo de erro
                throw error;
            }
        }
    }

    /**
     * Executa operação de mover arquivo
     */
    async moveFile(sourcePath, targetPath, options = {}) {
        const operationId = this.generateOperationId();
        const startTime = Date.now();

        // Definir variáveis para uso no bloco catch
        let safeSourcePath = sourcePath;
        let safeTargetPath = targetPath;

        try {
            // Validar caminhos antes de qualquer operação
            safeSourcePath = await validateSafePath(sourcePath, 'read');
            safeTargetPath = await validateSafePath(targetPath, 'write');

            logger.startOperation('File Move', {
                operationId,
                sourcePath: safeSourcePath,
                targetPath: safeTargetPath,
                options
            });

            // Verificar se é um diretório para operação recursiva
            const stats = await fs.stat(safeSourcePath);
            const isDirectory = stats.isDirectory();
            const fileSize = stats.size;

            // Verificar permissões no Raspberry Pi
            await this.checkRaspberryPiPermissions(safeSourcePath, safeTargetPath, 'move');

            // Criar backup se solicitado
            if (options.backupBeforeMove) {
                await this.createBackup(safeSourcePath, 'move');
            }

            if (isDirectory && options.recursive !== false) {
                // Operação recursiva em diretório
                await this.moveDirectoryRecursive(safeSourcePath, safeTargetPath, options);
            } else {
                // Operação simples em arquivo
                // Garantir que o diretório de destino existe
                const targetDir = path.dirname(safeTargetPath);
                await fs.mkdir(targetDir, { recursive: true });

                // Mover o arquivo (com suporte a cross-device)
                await this.moveFileCrossDevice(safeSourcePath, safeTargetPath);
            }

            // Verificar se moveu corretamente
            const targetStats = await fs.stat(safeTargetPath);
            
            // Validação adicional: verificar se o arquivo é legível
            await fs.access(safeTargetPath, fs.constants.R_OK);
            
            // Verificar se o arquivo original foi removido (para operações de move)
            try {
                await fs.access(safeSourcePath, fs.constants.F_OK);
                // Se chegou aqui, o arquivo original ainda existe - isso é um problema para move
                logger.warn(`⚠️ Arquivo original ainda existe após move: ${safeSourcePath}`);
            } catch (notFoundError) {
                // Arquivo original não existe mais - isso é correto para move
                logger.info(`✅ Arquivo original removido com sucesso: ${safeSourcePath}`);
            }

            const duration = Date.now() - startTime;
            logger.endOperation('File Move', duration, {
                operationId,
                success: true,
                fileSize: targetStats.size,
                targetPath: safeTargetPath,
                preserveStructure: options.preserveStructure
            });

            return {
                success: true,
                operationId,
                fileSize: targetStats.size,
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
     * Move diretório recursivamente com todas as subpastas
     */
    async moveDirectoryRecursive(sourceDir, targetDir, options = {}) {
        logger.info(`Iniciando movimento recursivo: ${sourceDir} -> ${targetDir}`);

        // Garantir que o diretório de destino existe
        await fs.mkdir(targetDir, { recursive: true });

        // Ler conteúdo do diretório
        const entries = await fs.readdir(sourceDir, { withFileTypes: true });

        for (const entry of entries) {
            const sourcePath = path.join(sourceDir, entry.name);
            const targetPath = path.join(targetDir, entry.name);

            if (entry.isDirectory()) {
                // Recursão para subdiretórios
                await this.moveDirectoryRecursive(sourcePath, targetPath, options);
            } else {
                // Verificar se arquivo deve ser ignorado
                if (shouldIgnoreFile(entry.name)) {
                    logger.info(`Pulando arquivo ignorado: ${sourcePath}`);
                    continue;
                }

                // Filtrar por extensões se especificado
                if (options.extensions && options.extensions.length > 0) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (!options.extensions.includes(ext)) {
                        logger.info(`Pulando arquivo (extensão não permitida): ${sourcePath}`);
                        continue; // Pular arquivo se extensão não estiver na lista
                    }
                }

                // Mover arquivo (com suporte a cross-device)
                await this.moveFileCrossDevice(sourcePath, targetPath);
                logger.info(`Arquivo movido: ${sourcePath} -> ${targetPath}`);
            }
        }

        // Remover diretório vazio
        await fs.rmdir(sourceDir);
        logger.info(`Diretório movido: ${sourceDir} -> ${targetDir}`);
    }

    /**
     * Executa operação de copiar arquivo
     */
    async copyFile(sourcePath, targetPath, options = {}) {
        const operationId = this.generateOperationId();
        const startTime = Date.now();

        // Definir variáveis para uso no bloco catch
        let safeSourcePath = sourcePath;
        let safeTargetPath = targetPath;

        try {
            // Validar caminhos antes de qualquer operação
            safeSourcePath = await validateSafePath(sourcePath, 'read');
            safeTargetPath = await validateSafePath(targetPath, 'write');

            logger.startOperation('File Copy', {
                operationId,
                sourcePath: safeSourcePath,
                targetPath: safeTargetPath,
                options
            });

            // Verificar se é um diretório para operação recursiva
            const stats = await fs.stat(safeSourcePath);
            const isDirectory = stats.isDirectory();

            // Verificar permissões no Raspberry Pi
            await this.checkRaspberryPiPermissions(safeSourcePath, safeTargetPath, 'copy');

            if (isDirectory && options.recursive !== false) {
                // Operação recursiva em diretório
                await this.copyDirectoryRecursive(safeSourcePath, safeTargetPath, options);
            } else {
                // Operação simples em arquivo
                // Garantir que o diretório de destino existe
                const targetDir = path.dirname(safeTargetPath);
                await fs.mkdir(targetDir, { recursive: true });
                
                // Corrigir permissões do diretório criado
                await fixFilePermissions(targetDir);

                await copyOrMoveWithOptionalShellFallback(safeSourcePath, safeTargetPath, 'copy');
                await fixFilePermissions(safeTargetPath);
            }

            // Verificar se copiou corretamente
            const targetStats = await fs.stat(safeTargetPath);

            const duration = Date.now() - startTime;
            logger.endOperation('File Copy', duration, {
                operationId,
                success: true,
                fileSize: targetStats.size,
                targetPath: safeTargetPath,
                preserveStructure: options.preserveStructure
            });

            return {
                success: true,
                operationId,
                fileSize: targetStats.size,
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
     * Copia diretório recursivamente com todas as subpastas
     */
    async copyDirectoryRecursive(sourceDir, targetDir, options = {}) {
        logger.info(`Iniciando cópia recursiva: ${sourceDir} -> ${targetDir}`);

        // Garantir que o diretório de destino existe
        await fs.mkdir(targetDir, { recursive: true });
        
        // Corrigir permissões do diretório criado
        await fixFilePermissions(targetDir);

        // Ler conteúdo do diretório
        const entries = await fs.readdir(sourceDir, { withFileTypes: true });

        for (const entry of entries) {
            const sourcePath = path.join(sourceDir, entry.name);
            const targetPath = path.join(targetDir, entry.name);

            if (entry.isDirectory()) {
                // Recursão para subdiretórios
                await this.copyDirectoryRecursive(sourcePath, targetPath, options);
            } else {
                // Verificar se arquivo deve ser ignorado
                if (shouldIgnoreFile(entry.name)) {
                    logger.info(`Pulando arquivo ignorado: ${sourcePath}`);
                    continue;
                }

                // Filtrar por extensões se especificado
                if (options.extensions && options.extensions.length > 0) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (!options.extensions.includes(ext)) {
                        logger.info(`Pulando arquivo (extensão não permitida): ${sourcePath}`);
                        continue; // Pular arquivo se extensão não estiver na lista
                    }
                }

                await copyOrMoveWithOptionalShellFallback(sourcePath, targetPath, 'copy');
                await fixFilePermissions(targetPath);
                
                logger.info(`Arquivo copiado: ${sourcePath} -> ${targetPath}`);
            }
        }

        logger.info(`Diretório copiado: ${sourceDir} -> ${targetDir}`);
    }

    /**
     * Executa operação de apagar arquivo com backup
     */
    async deleteFile(filePath, options = {}) {
        const operationId = this.generateOperationId();
        const startTime = Date.now();

        // Definir variável para uso no bloco catch
        let safeFilePath = filePath;

        try {
            // Validar caminho antes de qualquer operação
            safeFilePath = await validateSafePath(filePath, 'read');

            logger.startOperation('File Delete', {
                operationId,
                filePath: safeFilePath,
                options
            });

            // Criar backup antes de apagar
            if (this.backupConfig.enabled || options.forceBackup) {
                await this.createBackup(safeFilePath, 'delete');
            }

            // Obter informações do arquivo/diretório antes de apagar
            const stats = await fs.stat(safeFilePath);
            const isDirectory = stats.isDirectory();

            if (isDirectory && options.recursive !== false) {
                // Operação recursiva em diretório
                await this.deleteDirectoryRecursive(safeFilePath, options);
            } else {
                // Operação simples em arquivo
                // Apagar o arquivo
                await fs.unlink(safeFilePath);
            }

            const duration = Date.now() - startTime;
            logger.endOperation('File Delete', duration, {
                operationId,
                success: true,
                fileSize: stats.size,
                backupCreated: this.backupConfig.enabled || options.forceBackup
            });

            return {
                success: true,
                operationId,
                fileSize: stats.size,
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
     * Apaga diretório recursivamente com todas as subpastas
     */
    async deleteDirectoryRecursive(dirPath, options = {}) {
        logger.info(`Iniciando exclusão recursiva: ${dirPath}`);

        // Ler conteúdo do diretório
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                // Recursão para subdiretórios
                await this.deleteDirectoryRecursive(fullPath, options);
            } else {
                // Verificar se arquivo deve ser ignorado
                if (shouldIgnoreFile(entry.name)) {
                    logger.info(`Pulando arquivo ignorado: ${fullPath}`);
                    continue;
                }

                // Filtrar por extensões se especificado
                if (options.extensions && options.extensions.length > 0) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (!options.extensions.includes(ext)) {
                        logger.info(`Pulando arquivo (extensão não permitida): ${fullPath}`);
                        continue; // Pular arquivo se extensão não estiver na lista
                    }
                }

                // Criar backup se solicitado
                if (this.backupConfig.enabled || options.forceBackup) {
                    await this.createBackup(fullPath, 'delete');
                }

                // Apagar arquivo
                await fs.unlink(fullPath);
                logger.info(`Arquivo excluído: ${fullPath}`);
            }
        }

        // Apagar diretório vazio
        await fs.rmdir(dirPath);
        logger.info(`Diretório excluído: ${dirPath}`);
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
            
            // Corrigir permissões do arquivo de backup
            await fixFilePermissions(backupPath);

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
        const normalizedConfig = this.validateScheduledOperationConfig(config);
        const { name, frequency, action, sourcePath, targetPath } = normalizedConfig;
        
        logger.info(`Agendando operação: ${operationId}`, { name, frequency, action, sourcePath, targetPath });

        this.operations.set(operationId, normalizedConfig);
        this.armScheduledOperation(operationId, normalizedConfig);
        
        // Salvar operações agendadas no arquivo de persistência
        this.saveScheduledOperations().catch(error => {
            logger.error('Erro ao salvar operações agendadas:', error);
        });
    }

    /**
     * Cancela agendamento de operação
     */
    cancelScheduledOperation(operationId) {
        this.unscheduleOperation(operationId);
        this.operations.delete(operationId);
        logger.info(`Agendamento cancelado: ${operationId}`);
        
        this.saveScheduledOperations().catch(error => {
            logger.error('Erro ao salvar operações agendadas após cancelamento:', error);
        });
    }

    /**
     * Edita operação agendada existente
     */
    editScheduledOperation(operationId, newConfig) {
        if (!this.operations.has(operationId)) {
            throw new Error(`Operação agendada não encontrada: ${operationId}`);
        }

        const currentConfig = this.operations.get(operationId);
        const mergedConfig = this.validateScheduledOperationConfig({ ...currentConfig, ...newConfig });

        this.operations.set(operationId, mergedConfig);
        this.armScheduledOperation(operationId, mergedConfig);
        this.saveScheduledOperations().catch(error => {
            logger.error('Erro ao salvar operações agendadas após edição:', error);
        });

        logger.info(`Operação editada: ${operationId} - ${mergedConfig.frequency}`);

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
        logger.info(`🚀 Iniciando execução agendada: ${operationId}`, { action, sourcePath, targetPath, options });
        
        try {
            // Verificar se é uma operação em lote (pasta inteira)
            const stats = await fs.stat(sourcePath);
            logger.info(`📁 Tipo de operação: ${stats.isDirectory() ? 'diretório' : 'arquivo'}`, { sourcePath });
            
            if (options.batch && stats.isDirectory()) {
                logger.info(`📦 Executando operação em lote: ${sourcePath} -> ${targetPath}`);
                await this.executeBatchOperation(operationId, action, sourcePath, targetPath, options);
            } else {
                logger.info(`📄 Executando operação em arquivo único: ${sourcePath} -> ${targetPath}`);
                await this.executeSingleOperation(operationId, action, sourcePath, targetPath, options);
            }
            
            logger.info(`✅ Execução agendada concluída: ${operationId}`);
        } catch (error) {
            logger.error(`❌ Erro na execução agendada ${operationId}:`, error);
            throw error; // Re-throw para que o erro seja propagado
        }
    }

    /**
     * Executar operação agendada imediatamente (wrapper)
     */
    async executeScheduledOperationNow(operationId) {
        const operation = this.getScheduledOperation(operationId);
        if (!operation) {
            throw new Error(`Operação agendada não encontrada: ${operationId}`);
        }

        const { action, sourcePath, targetPath, options = {} } = operation;
        return await this.executeScheduledOperation(operationId, action, sourcePath, targetPath, options);
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
                        logger.debug(`🔍 Aplicando filtros para: ${fileName}`, { 
                            hasFilters: !!options.filters,
                            filterKeys: options.filters ? Object.keys(options.filters) : []
                        });
                        
                        if (!this.matchesFilters(fileName, options.filters, filePath)) {
                            logger.debug(`🚫 Arquivo rejeitado pelos filtros: ${fileName}`);
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
                        logger.error(`Erro ao processar arquivo ${filePath}:`, { error: error.message });
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
        logger.debug(`Progresso ${operationId}: ${percentage}% - ${message}`);
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
     * Verificar permissões no Raspberry Pi
     * @param {string} sourcePath - Caminho de origem
     * @param {string} targetPath - Caminho de destino
     * @param {string} operation - Tipo de operação
     */
    async checkRaspberryPiPermissions(sourcePath, targetPath, operation) {
        return await ensureWritableTarget(sourcePath, targetPath, operation);
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
            logger.debug(`🚫 Arquivo ignorado: ${filename}`);
            return false;
        }

        // Se não há filtros definidos, aceitar todos os arquivos
        if (!filters || Object.keys(filters).length === 0) {
            logger.debug(`✅ Sem filtros - aceitando: ${filename}`);
            return true;
        }

        // Filtro por extensão
        if (filters.extensions && filters.extensions.length > 0) {
            const ext = path.extname(filename).toLowerCase().slice(1);
            const isAllowed = filters.extensions.includes(ext);
            
            logger.debug(`🔍 Filtro de extensão: ${filename} (${ext}) - Permitido: ${isAllowed} (${filters.extensions.join(', ')})`);
            
            if (!isAllowed) {
                return false;
            }
        }

        // Filtro por tamanho (se conseguir obter)
        if (filters.minSize || filters.maxSize) {
            // Implementar verificação de tamanho se necessário
        }

        // Filtro por padrão de nome
        if (filters.pattern) {
            const regex = new RegExp(filters.pattern, 'i');
            const matches = regex.test(filename);
            logger.debug(`🔍 Filtro de padrão: ${filename} - Corresponde: ${matches} (${filters.pattern})`);
            if (!matches) return false;
        }

        logger.debug(`✅ Arquivo aprovado pelos filtros: ${filename}`);
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
        // Frequências especiais
        if (frequency === 'on-startup') {
            return 0; // Executar apenas uma vez na inicialização
        }
        if (frequency === 'manual') {
            return -1; // Não agendar automaticamente
        }
        
        // Frequências com regex
        const match = frequency.match(/^(\d+)([smhdwM])$/);
        if (!match) return 60000; // padrão 1 minuto

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;        // segundos
            case 'm': return value * 60 * 1000;   // minutos
            case 'h': return value * 60 * 60 * 1000; // horas
            case 'd': return value * 24 * 60 * 60 * 1000; // dias
            case 'w': return value * 7 * 24 * 60 * 60 * 1000; // semanas
            case 'M': return value * 30 * 24 * 60 * 60 * 1000; // meses (aproximado)
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
        return Array.from(this.operations.entries()).map(([id, config]) => ({
            id,
            ...this.normalizeScheduledOperationConfig(config)
        }));
    }

    /**
     * Obter uma operação agendada específica
     */
    getScheduledOperation(operationId) {
        const config = this.operations.get(operationId);
        if (!config) {
            return null;
        }
        
        return {
            id: operationId,
            ...this.normalizeScheduledOperationConfig(config)
        };
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
    async replaceScheduledOperations(operations = []) {
        const normalizedOperations = Array.isArray(operations) ? operations : [];

        for (const intervalId of this.schedules.values()) {
            clearInterval(intervalId);
        }
        this.schedules.clear();
        this.operations.clear();

        for (const operation of normalizedOperations) {
            if (!operation || typeof operation !== 'object') {
                throw new Error('Operacao agendada invalida no backup');
            }

            const operationId = typeof operation.id === 'string' && operation.id.trim()
                ? operation.id.trim()
                : this.generateOperationId();
            const normalizedConfig = this.validateScheduledOperationConfig(operation.config || operation);

            this.operations.set(operationId, normalizedConfig);
            this.armScheduledOperation(operationId, normalizedConfig);
        }

        await this.saveScheduledOperations();
        logger.info('Operacoes agendadas importadas para o runtime', {
            total: this.operations.size
        });

        return this.getScheduledOperations();
    }

    getStats() {
        // Obter atividades recentes (últimas 20 operações)
        const recentActivities = Array.from(this.operations.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20)
            .map(operation => ({
                id: operation.id,
                type: operation.type,
                action: operation.action,
                sourcePath: operation.sourcePath,
                targetPath: operation.targetPath,
                timestamp: operation.timestamp,
                duration: operation.duration,
                success: operation.success,
                fileSize: operation.fileSize,
                preserveStructure: operation.preserveStructure
            }));

        return {
            scheduledOperations: this.schedules.size,
            totalOperations: this.operations.size,
            backupEnabled: this.backupConfig.enabled,
            backupDir: this.backupConfig.backupDir,
            retentionDays: this.backupConfig.retentionDays,
            activities: recentActivities
        };
    }

    /**
     * Lista imagens recursivamente para slideshow
     */
    async listImagesRecursive(folderPath, options = {}) {
        const { maxDepth = 10, extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'] } = options;
        const images = [];
        const safeFolderPath = await validateSafePath(folderPath, 'read');

        logger.info(`🖼️ Iniciando listImagesRecursive: ${safeFolderPath}`);
        logger.info(`🔧 Opções: ${JSON.stringify(options)}`);

        try {
            const stats = await fs.stat(safeFolderPath);
            logger.info(`📁 Pasta encontrada: ${safeFolderPath}, isDirectory: ${stats.isDirectory()}`);

            if (!stats.isDirectory()) {
                throw new Error('Caminho especificado não é uma pasta');
            }

            async function scanDirectory(currentPath, currentDepth = 0) {
                if (currentDepth > maxDepth) return;

                    logger.info(`🔍 Escaneando pasta: ${currentPath} (profundidade: ${currentDepth})`);

                    try {
                        const items = await fs.readdir(currentPath);
                        logger.info(`📋 Itens encontrados em ${currentPath}: ${items.length} (${items.slice(0, 10).join(', ')}${items.length > 10 ? '...' : ''})`);

                        for (const item of items) {
                            const itemPath = await validateSafePath(path.join(currentPath, item), 'read');
                            const itemStats = await fs.stat(itemPath);

                        if (itemStats.isDirectory()) {
                            // Recursivamente escanear subpastas
                            await scanDirectory(itemPath, currentDepth + 1);
                        } else if (itemStats.isFile()) {
                            const ext = path.extname(item).toLowerCase().slice(1);
                            logger.info(`📄 Arquivo encontrado: ${item} (ext: ${ext})`);

                            if (extensions.includes(ext)) {
                                logger.info(`✅ Extensão válida: ${ext}`);
                                // Verificar se não deve ser ignorado
                                if (!shouldIgnoreFile(item)) {
                                    logger.info(`✅ Arquivo não ignorado: ${item}`);
                                    images.push({
                                        path: itemPath,
                                        name: item,
                                        size: itemStats.size,
                                        modified: itemStats.mtime,
                                        extension: ext,
                                        relativePath: path.relative(safeFolderPath, itemPath)
                                    });
                                } else {
                                    logger.warn(`🚫 Arquivo ignorado: ${item}`);
                                }
                            } else {
                                logger.info(`❌ Extensão inválida: ${ext} (esperado: ${extensions.join(', ')})`);
                            }
                        }
                    }
                } catch (error) {
                    logger.warn(`Erro ao escanear pasta ${currentPath}:`, error.message);
                }
            }

            await scanDirectory.call(this, safeFolderPath);

            // Ordenar imagens por data de modificação (mais recentes primeiro)
            images.sort((a, b) => b.modified.getTime() - a.modified.getTime());

            logger.info(`🎯 Total de imagens encontradas: ${images.length}`);
            if (images.length > 0) {
                logger.info(`📸 Primeiras imagens: ${images.slice(0, 5).map(img => img.name).join(', ')}`);
            }

            return images;

        } catch (error) {
            logger.error(`Erro ao listar imagens da pasta ${safeFolderPath}:`, error);
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

// Adicionar funções utilitárias ao objeto exportado
fileOperationsManager.validateSafePath = validateSafePath;
fileOperationsManager.shouldIgnoreFile = shouldIgnoreFile;
fileOperationsManager.filterIgnoredFiles = filterIgnoredFiles;

// Cleanup ao encerrar
process.on('SIGTERM', () => {
    fileOperationsManager.stopAllScheduledOperations();
});

process.on('SIGINT', () => {
    fileOperationsManager.stopAllScheduledOperations();
});

module.exports = fileOperationsManager;
