const logger = require('./logger');
const configStore = require('./configStore');
const fileOperationsManager = require('./fileOperations');
const folderManager = require('../config/folders');
const workflowStore = require('./workflowStore');
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
  if (payload.workflows !== undefined && !Array.isArray(payload.workflows)) {
    throw new Error('workflows deve ser um array');
  }
}

async function exportOperationalBackup() {
  await folderManager.init();
  await workflowStore.init();

  return {
    version: OPERATIONAL_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sourceRuntime: getRuntimeRoot(),
    config: await configStore.getConfig(),
    scheduledOperations: await fileOperationsManager.exportScheduledOperations(),
    folders: await folderManager.exportFolders(),
    workflows: await workflowStore.list()
  };
}

async function importOperationalBackup(payload) {
  validateBackupPayload(payload);

  await folderManager.init();
  await workflowStore.init();
  const previous = await exportOperationalBackup();

  let config;
  let scheduledOperations;
  let folders;
  let workflows;
  try {
    config = await configStore.replaceConfig(payload.config);
    scheduledOperations = await fileOperationsManager.replaceScheduledOperations(payload.scheduledOperations);
    folders = await folderManager.importFolders(payload.folders);
    workflows = await workflowStore.replace(payload.workflows || []);
  } catch (error) {
    await configStore.replaceConfig(previous.config).catch(() => {});
    await fileOperationsManager.replaceScheduledOperations(previous.scheduledOperations).catch(() => {});
    await folderManager.importFolders(previous.folders).catch(() => {});
    await workflowStore.replace(previous.workflows || []).catch(() => {});
    throw error;
  }

  const summary = {
    configRestored: true,
    scheduledOperationsRestored: scheduledOperations.length,
    foldersRestored: folders.length,
    workflowsRestored: workflows.length
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
    folders,
    workflows
  };
}

module.exports = {
  OPERATIONAL_BACKUP_VERSION,
  exportOperationalBackup,
  importOperationalBackup,
  validateBackupPayload
};
