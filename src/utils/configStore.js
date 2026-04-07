const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const DEFAULT_CONFIG_VERSION = 1;
const DEFAULT_SLIDESHOW_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];

function getRepoRoot() {
  return path.resolve(__dirname, '../..');
}

function getDataDir() {
  return process.env.DEPARA_DATA_DIR || path.join(getRepoRoot(), 'data');
}

function getConfigPath() {
  return process.env.DEPARA_CONFIG_FILE || path.join(getDataDir(), 'depara-config.json');
}

function getLegacyConfigPath() {
  return path.join(getRepoRoot(), 'src', 'data', 'depara-config.json');
}

function getDefaultConfig() {
  return {
    version: DEFAULT_CONFIG_VERSION,
    slideshowConfig: {
      interval: 3,
      random: false,
      preload: true,
      extensions: [...DEFAULT_SLIDESHOW_EXTENSIONS],
      recursive: true,
      deletedFolder: '',
      hiddenFolder: '',
      adjustableFolder: ''
    },
    slideshowSelectedPath: '',
    screensaverConfig: {
      enabled: true,
      idleMinutes: 3,
      exitMode: 'esc_only'
    },
    appSettings: {
      port: 3000,
      logLevel: 'info',
      environment: 'production',
      logDirectory: 'logs/'
    }
  };
}

function uniqueExtensions(extensions) {
  const normalized = Array.isArray(extensions)
    ? extensions
        .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
        .filter(Boolean)
        .map((item) => (item.startsWith('.') ? item : `.${item}`))
    : [];

  return Array.from(new Set(normalized));
}

function normalizeSlideshowConfig(slideshowConfig = {}) {
  const defaults = getDefaultConfig().slideshowConfig;
  return {
    interval: Math.max(1, Math.min(60, Number(slideshowConfig.interval) || defaults.interval)),
    random: slideshowConfig.random === undefined ? defaults.random : Boolean(slideshowConfig.random),
    preload: slideshowConfig.preload === undefined ? defaults.preload : Boolean(slideshowConfig.preload),
    extensions: uniqueExtensions(slideshowConfig.extensions).length > 0
      ? uniqueExtensions(slideshowConfig.extensions)
      : [...defaults.extensions],
    recursive: slideshowConfig.recursive === undefined ? defaults.recursive : Boolean(slideshowConfig.recursive),
    deletedFolder: typeof slideshowConfig.deletedFolder === 'string' ? slideshowConfig.deletedFolder.trim() : '',
    hiddenFolder: typeof slideshowConfig.hiddenFolder === 'string' ? slideshowConfig.hiddenFolder.trim() : '',
    adjustableFolder: typeof slideshowConfig.adjustableFolder === 'string' ? slideshowConfig.adjustableFolder.trim() : ''
  };
}

function normalizeScreensaverConfig(screensaverConfig = {}) {
  const defaults = getDefaultConfig().screensaverConfig;
  return {
    enabled: screensaverConfig.enabled === undefined ? defaults.enabled : Boolean(screensaverConfig.enabled),
    idleMinutes: Math.max(1, Math.min(180, Number(screensaverConfig.idleMinutes) || defaults.idleMinutes)),
    exitMode: 'esc_only'
  };
}

function normalizeAppSettings(appSettings = {}) {
  const defaults = getDefaultConfig().appSettings;
  return {
    port: Math.max(1, Number(appSettings.port) || defaults.port),
    logLevel: typeof appSettings.logLevel === 'string' && appSettings.logLevel.trim()
      ? appSettings.logLevel.trim()
      : defaults.logLevel,
    environment: typeof appSettings.environment === 'string' && appSettings.environment.trim()
      ? appSettings.environment.trim()
      : defaults.environment,
    logDirectory: typeof appSettings.logDirectory === 'string' && appSettings.logDirectory.trim()
      ? appSettings.logDirectory.trim()
      : defaults.logDirectory
  };
}

function normalizeConfig(config = {}) {
  const defaults = getDefaultConfig();
  return {
    version: DEFAULT_CONFIG_VERSION,
    slideshowConfig: normalizeSlideshowConfig(config.slideshowConfig || {}),
    slideshowSelectedPath: typeof config.slideshowSelectedPath === 'string'
      ? config.slideshowSelectedPath.trim()
      : defaults.slideshowSelectedPath,
    screensaverConfig: normalizeScreensaverConfig(config.screensaverConfig || {}),
    appSettings: normalizeAppSettings(config.appSettings || {})
  };
}

async function ensureDirectory() {
  await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
}

async function writeConfigAtomic(config) {
  const filePath = getConfigPath();
  const tempPath = `${filePath}.tmp`;
  await ensureDirectory();
  await fs.writeFile(tempPath, JSON.stringify(normalizeConfig(config), null, 2), 'utf8');
  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    if (error.code !== 'EEXIST' && error.code !== 'EPERM') {
      throw error;
    }
    await fs.rm(filePath, { force: true });
    await fs.rename(tempPath, filePath);
  }
}

async function migrateLegacyConfigIfNeeded() {
  const targetPath = getConfigPath();
  const legacyPath = getLegacyConfigPath();

  if (fsSync.existsSync(targetPath) || !fsSync.existsSync(legacyPath)) {
    return;
  }

  await ensureDirectory();
  await fs.copyFile(legacyPath, targetPath);
}

async function readRawConfig() {
  await migrateLegacyConfigIfNeeded();
  try {
    const data = await fs.readFile(getConfigPath(), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return getDefaultConfig();
    }
    return getDefaultConfig();
  }
}

async function getConfig() {
  const config = normalizeConfig(await readRawConfig());
  if (!fsSync.existsSync(getConfigPath())) {
    await writeConfigAtomic(config);
  }
  return config;
}

async function saveConfig(nextConfig) {
  const normalized = normalizeConfig(nextConfig);
  await writeConfigAtomic(normalized);
  return normalized;
}

async function updateConfig(partialConfig = {}) {
  const current = await getConfig();
  const merged = {
    ...current,
    ...partialConfig,
    slideshowConfig: partialConfig.slideshowConfig
      ? { ...current.slideshowConfig, ...partialConfig.slideshowConfig }
      : current.slideshowConfig,
    screensaverConfig: partialConfig.screensaverConfig
      ? { ...current.screensaverConfig, ...partialConfig.screensaverConfig }
      : current.screensaverConfig,
    appSettings: partialConfig.appSettings
      ? { ...current.appSettings, ...partialConfig.appSettings }
      : current.appSettings
  };

  return saveConfig(merged);
}

async function setConfigValue(key, value) {
  const current = await getConfig();
  const next = { ...current };

  if (key === 'slideshowConfig') {
    next.slideshowConfig = { ...current.slideshowConfig, ...(value || {}) };
  } else if (key === 'screensaverConfig') {
    next.screensaverConfig = { ...current.screensaverConfig, ...(value || {}) };
  } else if (key === 'appSettings') {
    next.appSettings = { ...current.appSettings, ...(value || {}) };
  } else {
    next[key] = value;
  }

  return saveConfig(next);
}

async function ensureConfigFile() {
  const config = await getConfig();
  await writeConfigAtomic(config);
  return config;
}

module.exports = {
  DEFAULT_CONFIG_VERSION,
  getConfigPath,
  getDataDir,
  getDefaultConfig,
  normalizeConfig,
  ensureConfigFile,
  getConfig,
  saveConfig,
  updateConfig,
  setConfigValue
};
