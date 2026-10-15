const fs = require('fs').promises;
async function copyOrMoveNative(sourcePath, targetPath, operation) {
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
  copyOrMoveNative
};
