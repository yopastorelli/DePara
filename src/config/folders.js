const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const logger = require('../utils/logger');
const { getRuntimeDataDir, getSourceRepoRoot } = require('../utils/runtimePaths');
const {
  recordMigrationStatus,
  getMigrationStatus
} = require('../utils/persistenceMigration');

class FolderManager {
  constructor() {
    this.configFile = path.join(getRuntimeDataDir(), 'folders.json');
    this.legacyConfigFiles = [
      path.join(getSourceRepoRoot(), 'data', 'folders.json'),
      path.join(getSourceRepoRoot(), 'src', 'data', 'folders.json')
    ];
    this.folders = [];
    this.watchers = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      return;
    }

    try {
      await this.ensureDataDirectory();
      await this.loadFolders();
      await this.ensureWatchableFolders();
      await this.startWatching();
      this.initialized = true;
      logger.info('Gerenciador de pastas inicializado com sucesso');
    } catch (error) {
      logger.error('Erro ao inicializar gerenciador de pastas', { error: error.message });
    }
  }

  async ensureDataDirectory() {
    await fs.mkdir(path.dirname(this.configFile), { recursive: true });
  }

  async ensurePersistenceFile() {
    await this.ensureDataDirectory();
    if (!fsSync.existsSync(this.configFile)) {
      await this.saveFolders();
    }
  }

  async loadFolders() {
    try {
      await fs.access(this.configFile);
      const marker = await getMigrationStatus();
      if (!marker.folders || marker.folders.outcome === 'unknown') {
        await recordMigrationStatus('folders', {
          migrated: false,
          source: 'runtime',
          outcome: 'runtime_present'
        });
      }
    } catch {
      const migrated = await this.tryMigrateLegacyFolders();
      if (!migrated) {
        this.folders = this.getDefaultFolders();
        await this.saveFolders();
        await recordMigrationStatus('folders', {
          migrated: false,
          source: null,
          outcome: 'legacy_not_found'
        });
        logger.info('Configuracao padrao de pastas criada');
        return;
      }
    }

    try {
      const data = await fs.readFile(this.configFile, 'utf8');
      const parsed = JSON.parse(data);
      this.folders = this.normalizeFolders(parsed);
      logger.info(`${this.folders.length} pastas carregadas`);
    } catch (error) {
      logger.error('Erro ao carregar pastas', { error: error.message });
      this.folders = [];
    }
  }

  async tryMigrateLegacyFolders() {
    for (const legacyPath of this.legacyConfigFiles) {
      if (path.resolve(legacyPath) === path.resolve(this.configFile)) {
        continue;
      }

      if (!fsSync.existsSync(legacyPath)) {
        continue;
      }

      const data = await fs.readFile(legacyPath, 'utf8');
      this.folders = this.normalizeFolders(JSON.parse(data));
      await this.saveFolders();
      await recordMigrationStatus('folders', {
        migrated: true,
        source: legacyPath,
        outcome: 'migrated'
      });
      logger.info('Pastas configuradas migradas para o runtime', {
        source: legacyPath,
        target: this.configFile
      });
      return true;
    }

    return false;
  }

  getDefaultFolders() {
    const userHome = process.env.HOME || process.env.USERPROFILE || '/tmp';
    const now = new Date().toISOString();
    const paths = process.platform === 'win32'
      ? {
          input: path.join(userHome, 'Documents', 'Entrada'),
          output: path.join(userHome, 'Documents', 'Saida'),
          temp: path.join(userHome, 'Documents', 'Temp')
        }
      : {
          input: path.join(userHome, 'dados', 'entrada'),
          output: path.join(userHome, 'dados', 'saida'),
          temp: path.join(userHome, 'dados', 'temp')
        };

    return [
      {
        id: 'default-input',
        name: 'Dados_Entrada',
        path: paths.input,
        type: 'input',
        format: 'auto',
        autoProcess: true,
        enabled: true,
        processing: this.normalizeProcessing({
          frequency: 'realtime',
          rules: 'all',
          output: {
            backup: true,
            log: true,
            notify: false
          }
        }),
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'default-output',
        name: 'Dados_Saida',
        path: paths.output,
        type: 'output',
        format: 'json',
        autoProcess: false,
        enabled: true,
        processing: this.normalizeProcessing({
          frequency: 'daily',
          rules: 'all',
          allowedExtensions: ['json', 'csv'],
          output: {
            backup: false,
            log: true,
            notify: false
          }
        }),
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'default-temp',
        name: 'Dados_Temporarios',
        path: paths.temp,
        type: 'temp',
        format: 'auto',
        autoProcess: false,
        enabled: true,
        processing: this.normalizeProcessing({
          frequency: '1hour',
          rules: 'modified',
          output: {
            backup: false,
            log: false,
            notify: false
          },
          transformations: {
            uppercase: false,
            lowercase: false,
            trim: false,
            validate: false
          }
        }),
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  normalizeProcessing(processing = {}) {
    return {
      frequency: typeof processing.frequency === 'string' && processing.frequency.trim()
        ? processing.frequency.trim()
        : 'realtime',
      cronExpression: typeof processing.cronExpression === 'string' && processing.cronExpression.trim()
        ? processing.cronExpression.trim()
        : null,
      rules: typeof processing.rules === 'string' && processing.rules.trim()
        ? processing.rules.trim()
        : 'all',
      allowedExtensions: Array.isArray(processing.allowedExtensions)
        ? processing.allowedExtensions
            .filter((item) => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
      transformations: {
        uppercase: Boolean(processing.transformations?.uppercase),
        lowercase: Boolean(processing.transformations?.lowercase),
        trim: processing.transformations?.trim === undefined ? true : Boolean(processing.transformations.trim),
        validate: processing.transformations?.validate === undefined ? true : Boolean(processing.transformations.validate)
      },
      output: {
        backup: processing.output?.backup === undefined ? true : Boolean(processing.output.backup),
        log: processing.output?.log === undefined ? true : Boolean(processing.output.log),
        notify: Boolean(processing.output?.notify)
      }
    };
  }

  normalizeFolder(folder = {}, index = 0) {
    const now = new Date().toISOString();
    return {
      id: typeof folder.id === 'string' && folder.id.trim() ? folder.id.trim() : `folder-${Date.now()}-${index}`,
      name: typeof folder.name === 'string' && folder.name.trim() ? folder.name.trim() : `Pasta ${index + 1}`,
      path: typeof folder.path === 'string' ? folder.path.trim() : '',
      type: typeof folder.type === 'string' && folder.type.trim() ? folder.type.trim() : 'input',
      format: typeof folder.format === 'string' && folder.format.trim() ? folder.format.trim() : 'auto',
      autoProcess: Boolean(folder.autoProcess),
      enabled: folder.enabled === undefined ? true : Boolean(folder.enabled),
      processing: this.normalizeProcessing(folder.processing || {}),
      createdAt: typeof folder.createdAt === 'string' && folder.createdAt.trim() ? folder.createdAt : now,
      updatedAt: typeof folder.updatedAt === 'string' && folder.updatedAt.trim() ? folder.updatedAt : now
    };
  }

  normalizeFolders(folders) {
    return Array.isArray(folders)
      ? folders.map((folder, index) => this.normalizeFolder(folder, index))
      : [];
  }

  async saveFolders() {
    await this.ensureDataDirectory();
    await fs.writeFile(this.configFile, JSON.stringify(this.folders, null, 2), 'utf8');
    logger.info('Configuracao de pastas salva com sucesso');
  }

  async exportFolders() {
    await this.ensurePersistenceFile();
    return this.normalizeFolders(this.folders);
  }

  async importFolders(folders = []) {
    const normalizedFolders = this.normalizeFolders(folders);

    this.cleanup();
    this.folders = normalizedFolders;
    await this.saveFolders();
    await this.ensureWatchableFolders();
    await this.startWatching();
    this.initialized = true;

    logger.info('Pastas configuradas importadas para o runtime', {
      total: normalizedFolders.length
    });

    return normalizedFolders;
  }

  async addFolder(folderData) {
    if (folderData.autoProcess && folderData.processing) {
      const processing = folderData.processing;
      if (processing.frequency === 'custom' && !processing.cronExpression) {
        throw new Error('Expressao cron e obrigatoria para frequencia personalizada');
      }
      if (processing.rules === 'extension' && (!processing.allowedExtensions || processing.allowedExtensions.length === 0)) {
        throw new Error('Extensoes permitidas sao obrigatorias para regra de extensao');
      }
      if (processing.transformations?.uppercase && processing.transformations?.lowercase) {
        throw new Error('Nao e possivel aplicar maiusculas e minusculas simultaneamente');
      }
    }

    const folder = this.normalizeFolder({
      id: `folder-${Date.now()}`,
      ...folderData,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, this.folders.length);

    if (!await this.validateFolderPath(folder.path)) {
      throw new Error(`Caminho invalido ou pasta nao acessivel: ${folder.path}`);
    }

    this.folders.push(folder);
    await this.saveFolders();
    await this.startWatchingFolder(folder);

    logger.info(`Pasta adicionada: ${folder.name} (${folder.path})`);
    return folder;
  }

  async updateFolder(id, updates) {
    const folderIndex = this.folders.findIndex((folder) => folder.id === id);
    if (folderIndex === -1) {
      throw new Error(`Pasta nao encontrada: ${id}`);
    }

    const currentFolder = this.folders[folderIndex];
    const updatedFolder = this.normalizeFolder({
      ...currentFolder,
      ...updates,
      id: currentFolder.id,
      createdAt: currentFolder.createdAt,
      updatedAt: new Date().toISOString()
    }, folderIndex);

    if (updates.path && updates.path !== currentFolder.path) {
      if (!await this.validateFolderPath(updatedFolder.path)) {
        throw new Error(`Caminho invalido ou pasta nao acessivel: ${updatedFolder.path}`);
      }
      this.stopWatchingFolder(currentFolder);
    }

    this.folders[folderIndex] = updatedFolder;
    await this.saveFolders();

    if (updatedFolder.enabled) {
      await this.startWatchingFolder(updatedFolder);
    } else {
      this.stopWatchingFolder(updatedFolder);
    }

    logger.info(`Pasta atualizada: ${updatedFolder.name}`);
    return updatedFolder;
  }

  async deleteFolder(id) {
    const folderIndex = this.folders.findIndex((folder) => folder.id === id);
    if (folderIndex === -1) {
      throw new Error(`Pasta nao encontrada: ${id}`);
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
        await fs.mkdir(folderPath, { recursive: true });
        return true;
      } catch {
        return false;
      }
    }
  }

  async ensureFolderReady(folder) {
    if (!folder?.path) {
      return false;
    }

    const ready = await this.validateFolderPath(folder.path);
    if (!ready) {
      logger.error(`Nao foi possivel preparar a pasta para monitoramento: ${folder.name}`, {
        path: folder.path
      });
    }

    return ready;
  }

  async ensureWatchableFolders() {
    for (const folder of this.folders) {
      if (folder.enabled) {
        await this.ensureFolderReady(folder);
      }
    }
  }

  async startWatching() {
    for (const folder of this.folders) {
      if (folder.enabled) {
        await this.startWatchingFolder(folder);
      }
    }
  }

  async startWatchingFolder(folder) {
    if (!folder?.enabled || !folder.path) {
      return;
    }

    if (this.watchers.has(folder.id)) {
      this.stopWatchingFolder(folder);
    }

    try {
      const ready = await this.ensureFolderReady(folder);
      if (!ready) {
        return;
      }

      const watcher = fsSync.watch(folder.path, { persistent: false }, (eventType, filename) => {
        if (filename) {
          this.handleFolderEvent(folder, eventType, filename);
        }
      });

      this.watchers.set(folder.id, watcher);
      logger.info(`Monitoramento iniciado para: ${folder.name} (${folder.path})`);
    } catch (error) {
      logger.error(`Erro ao iniciar monitoramento para ${folder.name}`, { error: error.message });
    }
  }

  stopWatchingFolder(folder) {
    const watcher = this.watchers.get(folder.id);
    if (!watcher) {
      return;
    }

    watcher.close();
    this.watchers.delete(folder.id);
    logger.info(`Monitoramento parado para: ${folder.name}`);
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
      logger.error(`Erro ao processar evento de pasta ${folder.name}`, { error: error.message });
    }
  }

  async processFile(folder, filePath, filename) {
    logger.info(`Processando arquivo: ${filename} em ${folder.name}`, { filePath });
  }

  getFolders() {
    return this.folders;
  }

  getFolder(id) {
    return this.folders.find((folder) => folder.id === id);
  }

  getFoldersByType(type) {
    return this.folders.filter((folder) => folder.type === type && folder.enabled);
  }

  async enableFolder(id) {
    return this.updateFolder(id, { enabled: true });
  }

  async disableFolder(id) {
    return this.updateFolder(id, { enabled: false });
  }

  async getPersistenceStatus() {
    const marker = await getMigrationStatus();
    return marker.folders || {
      migrated: false,
      source: null,
      outcome: 'unknown',
      attemptedAt: null
    };
  }

  cleanup() {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    logger.info('Gerenciador de pastas encerrado');
  }
}

module.exports = new FolderManager();
