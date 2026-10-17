const fs = require('fs');
const os = require('os');
const path = require('path');
const dotenv = require('dotenv');

const DEFAULT_RUNTIME_CONFIG = Object.freeze({
  HOST: '127.0.0.1',
  PORT: '3000',
  NODE_ENV: 'production',
  LOG_LEVEL: 'warn',
  LOG_TO_CONSOLE: 'false',
  DEPARA_RESOURCE_PROFILE: 'codex-coexistence',
  MAX_CONCURRENT_OPERATIONS: '1',
  MAX_RECURSION_DEPTH: '10',
  DEPARA_MAX_IMAGE_RESULTS: '1000',
  DEPARA_IMAGE_PAGE_SIZE: '250',
  DEPARA_LOW_MEMORY_PAGE_SIZE: '100',
  DEPARA_MEMORY_WARN_MB: '1024',
  DEPARA_MEMORY_CRITICAL_MB: '512',
  DEPARA_MAX_RSS_MB: '192',
  DEPARA_CATALOG_TTL_MINUTES: '30',
  DEPARA_MAX_CATALOGS: '2',
  DEPARA_SLIDESHOW_PRELOAD: 'false',
  DEPARA_HTTP_LOGGING: 'false',
  MAX_PAYLOAD: '8mb'
});

function getRuntimeRoot() {
  return process.env.DEPARA_RUNTIME_ROOT || path.join(os.homedir(), '.depara');
}

function getRuntimeConfigPath() {
  return process.env.DEPARA_CONFIG_ENV_PATH || path.join(getRuntimeRoot(), 'config.env');
}

function getDefaultRuntimeConfig(overrides = {}) {
  return {
    ...DEFAULT_RUNTIME_CONFIG,
    DEPARA_RUNTIME_ROOT: getRuntimeRoot(),
    ...overrides
  };
}

function loadOperationalConfig(options = {}) {
  const {
    defaults = getDefaultRuntimeConfig(),
    path: configPath = getRuntimeConfigPath(),
    override = false
  } = options;

  let parsedConfig = {};

  if (fs.existsSync(configPath)) {
    parsedConfig = dotenv.parse(fs.readFileSync(configPath));
  }

  for (const [key, value] of Object.entries(parsedConfig)) {
    if (override || process.env[key] === undefined) {
      process.env[key] = String(value);
    }
  }

  for (const [key, value] of Object.entries(defaults)) {
    if (process.env[key] === undefined) {
      process.env[key] = String(value);
    }
  }

  return {
    configPath,
    runtimeRoot: getRuntimeRoot(),
    loaded: fs.existsSync(configPath)
  };
}

module.exports = {
  DEFAULT_RUNTIME_CONFIG,
  getRuntimeRoot,
  getRuntimeConfigPath,
  getDefaultRuntimeConfig,
  loadOperationalConfig
};
