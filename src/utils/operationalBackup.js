const logger = require('./logger');
const configStore = require('./configStore');
const fileOperationsManager = require('./fileOperations');
const folderManager = require('../config/folders');
const { getRuntimeRoot } = require('./runtimePaths');

const OPERATIONAL_BACKUP_VERSION = 1;

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Backup operacional invalido');
  }

  if (payload.version !== OPERATIONAL_BACKUP_VERSION) {
    throw new Error(`Versao de backup nao suportada: ${payload.version}`);
  }

  if (!payload.config || typeof payload.config !== 'object' || Array.isArray(payload.config)) {
    throw new Error('Config ausente no backup operacional');
  }

  if (!Array.isArray(payload.scheduledOperations)) {
    throw new Error('scheduledOperations deve ser um array');
  }

  if (!Array.isArray(payload.folders)) {
    throw new Error('folders deve ser um array');
  }
}

async function exportOperationalBackup() {
  await folderManager.init();

  return {
    version: OPERATIONAL_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sourceRuntime: getRuntimeRoot(),
    config: await configStore.getConfig(),
    scheduledOperations: await fileOperationsManager.exportScheduledOperations(),
    folders: await folderManager.exportFolders()
  };
}

async function importOperationalBackup(payload) {
  validateBackupPayload(payload);

  await folderManager.init();

  const config = await configStore.replaceConfig(payload.config);
  const scheduledOperations = await fileOperationsManager.replaceScheduledOperations(payload.scheduledOperations);
  const folders = await folderManager.importFolders(payload.folders);

  const summary = {
    configRestored: true,
    scheduledOperationsRestored: scheduledOperations.length,
    foldersRestored: folders.length
  };

  logger.info('Backup operacional importado', {
    version: payload.version,
    exportedAt: payload.exportedAt || null,
    summary
  });

  return {
    version: payload.version,
    exportedAt: payload.exportedAt || null,
    summary,
    config,
    scheduledOperations,
    folders
  };
}

module.exports = {
  OPERATIONAL_BACKUP_VERSION,
  exportOperationalBackup,
  importOperationalBackup,
  validateBackupPayload
};
