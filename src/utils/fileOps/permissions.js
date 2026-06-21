const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

function isRaspberryPiRuntime() {
  return process.platform === 'linux' && (process.arch === 'arm' || process.arch === 'arm64');
}

async function fixFilePermissions(targetPath, mode = 0o755) {
  try {
    await fs.chmod(targetPath, mode);
  } catch (error) {
    logger.warn('Falha ao aplicar permissao nativa', {
      targetPath,
      mode: mode.toString(8),
      error: error.message
    });

    throw error;
  }
}

async function ensureWritableTarget(sourcePath, targetPath, operation) {
  if (!isRaspberryPiRuntime()) {
    return;
  }

  logger.debug('Verificando precondicoes de permissao no RP4', {
    sourcePath,
    targetPath,
    operation
  });

  await fs.access(sourcePath, fs.constants.R_OK);

  const targetDir = path.dirname(targetPath);
  await fs.mkdir(targetDir, { recursive: true });

  try {
    await fs.access(targetDir, fs.constants.W_OK);
  } catch (error) {
    logger.warn('Diretorio de destino sem escrita direta; aplicando permissao minima', {
      targetDir,
      operation,
      error: error.message
    });
    await fixFilePermissions(targetDir, 0o755);
  }
}

async function copyOrMoveWithOptionalShellFallback(sourcePath, targetPath, operation) {
  if (operation === 'copy') {
    try {
      await fs.copyFile(sourcePath, targetPath);
      return;
    } catch (error) {
      if (error.code !== 'EXDEV') {
        throw error;
      }
    }
  }

  if (operation === 'move') {
    try {
      await fs.rename(sourcePath, targetPath);
      return;
    } catch (error) {
      if (error.code !== 'EXDEV') {
        throw error;
      }
    }
  }

  if (operation === 'copy') {
    await fs.copyFile(sourcePath, targetPath);
    return;
  }

  if (operation === 'move') {
    await fs.copyFile(sourcePath, targetPath);
    await fs.unlink(sourcePath);
  }
}

module.exports = {
  fixFilePermissions,
  ensureWritableTarget,
  copyOrMoveWithOptionalShellFallback,
  isRaspberryPiRuntime
};
