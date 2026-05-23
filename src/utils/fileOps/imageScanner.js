const fs = require('fs').promises;
const path = require('path');

async function scanImagesRecursive(folderPath, options = {}) {
  const {
    recursive = true,
    maxDepth = 10,
    extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'],
    shouldIgnore = () => false,
    sortBy = 'name'
  } = options;

  const normalizedExtensions = extensions.map((ext) => ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`);
  const images = [];

  async function scanDirectory(currentPath, currentDepth = 0) {
    if (currentDepth > maxDepth) {
      return;
    }

    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (recursive) {
          await scanDirectory(fullPath, currentDepth + 1);
        }
        continue;
      }

      if (!entry.isFile() || shouldIgnore(entry.name)) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!normalizedExtensions.includes(extension)) {
        continue;
      }

      const stats = await fs.stat(fullPath);
      images.push({
        path: fullPath,
        name: entry.name,
        size: stats.size,
        modified: stats.mtime,
        extension,
        relativePath: path.relative(folderPath, fullPath)
      });
    }
  }

  const rootStats = await fs.stat(folderPath);
  if (!rootStats.isDirectory()) {
    throw new Error('Caminho especificado não é uma pasta');
  }

  await scanDirectory(folderPath, 0);

  if (sortBy === 'modified-desc') {
    images.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  } else {
    images.sort((a, b) => a.name.localeCompare(b.name));
  }

  return images;
}

module.exports = {
  scanImagesRecursive
};
