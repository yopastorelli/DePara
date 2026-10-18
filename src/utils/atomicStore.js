const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const logger = require('./logger');

const writeQueues = new Map();

function getBackupPath(filePath) {
  return `${filePath}.previous`;
}

function getCorruptPath(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${filePath}.corrupt-${timestamp}-${process.pid}`;
}

async function ensureParentDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function syncFile(filePath, content) {
  if (typeof fs.open !== 'function') {
    await fs.writeFile(filePath, content, 'utf8');
    return;
  }
  const handle = await fs.open(filePath, 'w');
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function existsSync(filePath) {
  return typeof fsSync.existsSync === 'function' && fsSync.existsSync(filePath);
}

async function removeFile(filePath) {
  if (typeof fs.rm === 'function') {
    await fs.rm(filePath, { force: true });
  }
}

async function renameIfExists(sourcePath, targetPath) {
  try {
    await fs.rename(sourcePath, targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function writeJsonAtomicUnsafe(filePath, value, options = {}) {
  const normalized = options.normalize ? options.normalize(value) : value;
  const content = JSON.stringify(normalized, null, 2);
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const previousPath = getBackupPath(filePath);

  await ensureParentDirectory(filePath);
  await syncFile(tempPath, `${content}\n`);

  if (typeof fs.rename !== 'function') {
    try {
      await fs.writeFile(filePath, `${content}\n`, 'utf8');
    } finally {
      await removeFile(tempPath);
    }
    return normalized;
  }

  let movedCurrent = false;
  try {
    if (existsSync(filePath)) {
      await removeFile(previousPath);
      await fs.rename(filePath, previousPath);
      movedCurrent = true;
    }

    await fs.rename(tempPath, filePath);
  } catch (error) {
    if (movedCurrent && !existsSync(filePath) && existsSync(previousPath)) {
      try {
        await fs.rename(previousPath, filePath);
      } catch (restoreError) {
        logger.error('Falha ao restaurar persistência após erro atômico', {
          filePath,
          error: restoreError.message
        });
      }
    }
    throw error;
  } finally {
    await removeFile(tempPath);
  }

  return normalized;
}

function writeJsonAtomic(filePath, value, options = {}) {
  const previousWrite = writeQueues.get(filePath) || Promise.resolve();
  const queuedWrite = previousWrite
    .catch(() => {})
    .then(() => writeJsonAtomicUnsafe(filePath, value, options));

  writeQueues.set(filePath, queuedWrite);
  return queuedWrite.finally(() => {
    if (writeQueues.get(filePath) === queuedWrite) {
      writeQueues.delete(filePath);
    }
  });
}

async function readJsonWithRecovery(filePath, fallbackValue, options = {}) {
  await ensureParentDirectory(filePath);

  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    const previousPath = getBackupPath(filePath);
    try {
      const previousData = await fs.readFile(previousPath, 'utf8');
      const recovered = JSON.parse(previousData);
      const corruptPath = getCorruptPath(filePath);
      if (existsSync(filePath)) {
        await fs.rename(filePath, corruptPath);
      }
      await writeJsonAtomic(filePath, recovered, options);
      logger.warn('Persistência recuperada da versão anterior', {
        filePath,
        corruptPath
      });
      return recovered;
    } catch (recoveryError) {
      const corruptPath = getCorruptPath(filePath);
      if (existsSync(filePath)) {
        try {
          await fs.rename(filePath, corruptPath);
        } catch (quarantineError) {
          logger.error('Falha ao preservar persistência corrompida', {
            filePath,
            error: quarantineError.message
          });
        }
      }

      if (error.code !== 'ENOENT' || recoveryError.code !== 'ENOENT') {
        logger.error('Persistência inválida sem versão anterior recuperável', {
          filePath,
          error: error.message,
          recoveryError: recoveryError.message
        });
      }
      return fallbackValue;
    }
  }
}

module.exports = {
  getBackupPath,
  writeJsonAtomic,
  readJsonWithRecovery
};
