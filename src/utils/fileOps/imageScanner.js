const fs = require('fs').promises;
const path = require('path');

function normalizeExtensions(extensions) {
  return new Set(
    extensions.map((extension) => extension.startsWith('.')
      ? extension.toLowerCase()
      : `.${extension.toLowerCase()}`)
  );
}

function normalizeResultLimit(maxResults) {
  return Number.isFinite(Number(maxResults))
    ? Math.max(0, Number(maxResults))
    : Infinity;
}

function createImageRecord(folderPath, fullPath, entry, stats) {
  return {
    path: fullPath,
    name: entry.name,
    size: stats.size,
    modified: stats.mtime,
    extension: path.extname(entry.name).toLowerCase(),
    relativePath: path.relative(folderPath, fullPath)
  };
}

function isCancelled(options) {
  return typeof options.isCancelled === 'function' && options.isCancelled();
}

function throwIfCancelled(options) {
  if (isCancelled(options)) {
    const error = new Error('Catálogo de imagens encerrado');
    error.code = 'IMAGE_CATALOG_CLOSED';
    throw error;
  }
}

async function assertImageFolder(folderPath) {
  const rootStats = await fs.stat(folderPath);
  if (!rootStats.isDirectory()) {
    throw new Error('Caminho especificado não é uma pasta');
  }
}

async function getImageEntries(currentPath, shouldIgnore) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  return entries
    .filter((entry) => !shouldIgnore(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function scanImagesRecursive(folderPath, options = {}) {
  const {
    recursive = true,
    maxDepth = 10,
    extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'],
    shouldIgnore = () => false,
    sortBy = 'name',
    maxResults = Infinity
  } = options;

  const normalizedExtensions = normalizeExtensions(extensions);
  const resultLimit = normalizeResultLimit(maxResults);
  const images = [];

  async function scanDirectory(currentPath, currentDepth = 0) {
    if (currentDepth > maxDepth || images.length >= resultLimit) {
      return;
    }

    const entries = await getImageEntries(currentPath, shouldIgnore);

    for (const entry of entries) {
      if (images.length >= resultLimit) {
        return;
      }

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (recursive) {
          await scanDirectory(fullPath, currentDepth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!normalizedExtensions.has(extension)) {
        continue;
      }

      const stats = await fs.stat(fullPath);
      images.push(createImageRecord(folderPath, fullPath, entry, stats));
    }
  }

  await assertImageFolder(folderPath);
  await scanDirectory(folderPath, 0);

  if (sortBy === 'modified-desc') {
    images.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  } else {
    images.sort((a, b) => a.name.localeCompare(b.name));
  }

  return images;
}

async function scanImagesToManifest(folderPath, manifestPath, options = {}) {
  const {
    recursive = true,
    maxDepth = 10,
    extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'],
    shouldIgnore = () => false,
    maxResults = Infinity,
    isCancelled: cancellationCheck,
    onImage
  } = options;
  const normalizedExtensions = normalizeExtensions(extensions);
  const resultLimit = normalizeResultLimit(maxResults);
  let imageCount = 0;
  let output;

  await assertImageFolder(folderPath);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });

  try {
    output = await fs.open(manifestPath, 'w');

    async function scanDirectory(currentPath, currentDepth = 0) {
      throwIfCancelled({ isCancelled: cancellationCheck });
      if (currentDepth > maxDepth || imageCount >= resultLimit) {
        return;
      }

      const entries = await getImageEntries(currentPath, shouldIgnore);

      for (const entry of entries) {
        throwIfCancelled({ isCancelled: cancellationCheck });
        if (imageCount >= resultLimit) {
          return;
        }

        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          if (recursive) {
            await scanDirectory(fullPath, currentDepth + 1);
          }
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const extension = path.extname(entry.name).toLowerCase();
        if (!normalizedExtensions.has(extension)) {
          continue;
        }

        const stats = await fs.stat(fullPath);
        const image = createImageRecord(folderPath, fullPath, entry, stats);
        await output.write(`${JSON.stringify(image)}\n`);
        imageCount += 1;
        if (typeof onImage === 'function') {
          await onImage(imageCount, image);
        }
      }
    }

    await scanDirectory(folderPath, 0);
    return imageCount;
  } finally {
    if (output) {
      await output.close();
    }
  }
}

async function countImagesRecursive(folderPath, options = {}) {
  const {
    recursive = true,
    maxDepth = 10,
    extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'],
    shouldIgnore = () => false,
    maxResults = Infinity,
    isCancelled: cancellationCheck
  } = options;
  const normalizedExtensions = normalizeExtensions(extensions);
  const resultLimit = normalizeResultLimit(maxResults);
  let imageCount = 0;

  await assertImageFolder(folderPath);

  async function countDirectory(currentPath, currentDepth = 0) {
    throwIfCancelled({ isCancelled: cancellationCheck });
    if (currentDepth > maxDepth || imageCount >= resultLimit) {
      return;
    }

    const entries = await getImageEntries(currentPath, shouldIgnore);
    for (const entry of entries) {
      throwIfCancelled({ isCancelled: cancellationCheck });
      if (imageCount >= resultLimit) {
        return;
      }

      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (recursive) {
          await countDirectory(fullPath, currentDepth + 1);
        }
        continue;
      }

      if (entry.isFile() && normalizedExtensions.has(path.extname(entry.name).toLowerCase())) {
        imageCount += 1;
      }
    }
  }

  await countDirectory(folderPath, 0);
  return imageCount;
}

module.exports = {
  countImagesRecursive,
  scanImagesRecursive,
  scanImagesToManifest
};
