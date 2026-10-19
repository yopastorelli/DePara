const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const configStore = require('./configStore');
const fileOperationsManager = require('./fileOperations');
const folderManager = require('../config/folders');
const workflowStore = require('./workflowStore');
const { getRuntimeDataDir, getRuntimeRoot } = require('./runtimePaths');
const { readJsonWithRecovery, writeJsonAtomic } = require('./atomicStore');
const localSyncManager = require('./fileSync/localSyncManager');

const OPERATIONAL_BACKUP_VERSION = 2;
const IMPORT_JOURNAL_VERSION = 1;

function getImportJournalPath() {
  return path.join(getRuntimeDataDir(), 'config-import-journal.json');
}

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Backup operacional invalido');
  }

  if (![1, OPERATIONAL_BACKUP_VERSION].includes(payload.version)) {
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
  if (payload.version === 2 && !Array.isArray(payload.syncJobs)) throw new Error('syncJobs deve ser um array');
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
    workflows: await workflowStore.list(),
    syncJobs: await localSyncManager.list()
  };
}

async function applyOperationalPayload(payload, imported = true) {
  await folderManager.init();
  await workflowStore.init();

  const config = await configStore.replaceConfig(payload.config);
  const scheduledOperations = await fileOperationsManager.replaceScheduledOperations(payload.scheduledOperations);
  const folders = await folderManager.importFolders(payload.folders);
  const workflows = await workflowStore.replace(payload.workflows || []);
  const syncJobs = await localSyncManager.replaceJobs(payload.syncJobs || [], imported);

  return { config, scheduledOperations, folders, workflows, syncJobs };
}

async function writeImportJournal(journal) {
  await writeJsonAtomic(getImportJournalPath(), {
    version: IMPORT_JOURNAL_VERSION,
    ...journal,
    updatedAt: new Date().toISOString()
  });
}

async function recoverPendingOperationalImport() {
  const journalPath = getImportJournalPath();
  const journal = await readJsonWithRecovery(journalPath, null);
  if (!journal || !['prepared', 'applying'].includes(journal.status)) {
    return { recovered: false, status: journal?.status || null };
  }

  validateBackupPayload(journal.previous);
  try {
    await applyOperationalPayload(journal.previous, false);
    await writeImportJournal({
      ...journal,
      status: 'rolled_back',
      recovery: 'startup-rollback',
      recoveredAt: new Date().toISOString()
    });
    logger.warn('Importação operacional interrompida foi revertida na inicialização', {
      transactionId: journal.transactionId
    });
    return { recovered: true, status: 'rolled_back', transactionId: journal.transactionId };
  } catch (error) {
    logger.error('Falha ao reverter importação operacional interrompida', {
      transactionId: journal.transactionId,
      error: error.message
    });
    throw error;
  }
}

async function importOperationalBackup(payload) {
  validateBackupPayload(payload);
  await localSyncManager.init();
  if (localSyncManager.active.size || localSyncManager.importing) throw new Error('Aguarde a sincronização ou importação terminar');
  localSyncManager.importing = true;
  try {
    await fileOperationsManager.init();
    return await fileOperationsManager.transactionalOperations.withExclusiveWork(
      `config-import-${Date.now()}-${process.pid}`,
      () => performOperationalImport(payload)
    );
  } finally { localSyncManager.importing = false; }
}

async function performOperationalImport(payload) {

  await folderManager.init();
  await workflowStore.init();
  const previous = await exportOperationalBackup();
  const transactionId = `config_import_${Date.now()}_${process.pid}`;

  await fs.mkdir(getRuntimeDataDir(), { recursive: true });
  await writeImportJournal({
    transactionId,
    status: 'prepared',
    startedAt: new Date().toISOString(),
    previous,
    payload
  });
  await writeImportJournal({
    transactionId,
    status: 'applying',
    startedAt: new Date().toISOString(),
    previous,
    payload
  });

  let applied;
  try {
    applied = await applyOperationalPayload(payload);
  } catch (error) {
    try {
      await applyOperationalPayload(previous, false);
      await writeImportJournal({
        transactionId,
        status: 'rolled_back',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        previous,
        payload,
        recovery: 'in-process-rollback'
      });
    } catch (rollbackError) {
      logger.error('Falha no rollback da importação operacional', {
        transactionId,
        error: rollbackError.message
      });
    }
    throw error;
  }

  const { config, scheduledOperations, folders, workflows } = applied;
  const summary = {
    configRestored: true,
    scheduledOperationsRestored: scheduledOperations.length,
    foldersRestored: folders.length,
    workflowsRestored: workflows.length
  };

  await writeImportJournal({
    transactionId,
    status: 'committed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    previous,
    payload,
    summary
  });

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
  validateBackupPayload,
  getImportJournalPath,
  recoverPendingOperationalImport
};
