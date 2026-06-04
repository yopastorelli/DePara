#!/usr/bin/env node

'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const {
  getRuntimeConfigPath,
  getDefaultRuntimeConfig
} = require('./src/utils/runtimeConfig');
const {
  getRuntimeRoot,
  getRuntimeDataDir,
  getRuntimeLogsDir,
  getRuntimeBackupsDir,
  getRuntimeTempDir,
  getRuntimeReleasesDir,
  getRuntimeCurrentDir
} = require('./src/utils/runtimePaths');

function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message || command));
        return;
      }
      resolve({ stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
    });
  });
}

function getRuntimeConfigEnvContent(runtimeRoot) {
  const defaults = getDefaultRuntimeConfig({ DEPARA_RUNTIME_ROOT: runtimeRoot });
  return `${Object.entries(defaults)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

async function ensureRuntimeConfigFile(runtimeRoot) {
  const configPath = getRuntimeConfigPath();

  if (fs.existsSync(configPath)) {
    return configPath;
  }

  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  await fsp.writeFile(configPath, getRuntimeConfigEnvContent(runtimeRoot), 'utf8');
  return configPath;
}

function getCurrentWrapperContent() {
  return `'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const metaPath = path.join(__dirname, '..', 'release.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

if (!meta.activePath) {
  throw new Error('Active release path missing in ' + metaPath);
}

process.env.DEPARA_APP_ROOT = meta.activePath;
const configPath = process.env.DEPARA_CONFIG_ENV_PATH
  || path.join(process.env.DEPARA_RUNTIME_ROOT || path.join(require('os').homedir(), '.depara'), 'config.env');

if (fs.existsSync(configPath)) {
  dotenv.config({ path: configPath, override: false });
}

const app = require(path.join(meta.activePath, 'src', 'main.js'));

if (!app || typeof app.startServer !== 'function') {
  throw new Error('Active release entry must export startServer()');
}

app.startServer({ registerHandlers: true }).catch((error) => {
  console.error('Erro critico durante inicializacao do runtime:', error);
  process.exit(1);
});

module.exports = app;
`;
}

async function main() {
  const repoRoot = path.resolve(__dirname);
  const runtimeRoot = getRuntimeRoot();
  const dataDir = getRuntimeDataDir();
  const logsDir = getRuntimeLogsDir();
  const backupsDir = getRuntimeBackupsDir();
  const tempDir = getRuntimeTempDir();
  const releasesDir = getRuntimeReleasesDir();
  const currentDir = getRuntimeCurrentDir();
  const configEnvPath = getRuntimeConfigPath();
  const currentEntryPath = path.join(currentDir, 'src', 'main.js');
  const currentMetaPath = path.join(currentDir, 'release.json');

  await Promise.all([
    fsp.mkdir(dataDir, { recursive: true }),
    fsp.mkdir(logsDir, { recursive: true }),
    fsp.mkdir(backupsDir, { recursive: true }),
    fsp.mkdir(tempDir, { recursive: true }),
    fsp.mkdir(releasesDir, { recursive: true }),
    fsp.mkdir(path.dirname(currentEntryPath), { recursive: true }),
    fsp.mkdir(path.dirname(configEnvPath), { recursive: true })
  ]);

  await ensureRuntimeConfigFile(runtimeRoot);

  const { stdout: commit } = await execCommand('git rev-parse HEAD', { cwd: repoRoot });
  const releaseId = String(commit).trim();
  const releasePath = path.join(releasesDir, releaseId);
  const archivePath = path.join(releasesDir, `${releaseId}.tar`);
  const stagingPath = path.join(releasesDir, `.bootstrap-${releaseId}`);

  if (!fs.existsSync(releasePath)) {
    await fsp.rm(stagingPath, { recursive: true, force: true });
    await fsp.mkdir(stagingPath, { recursive: true });
    try {
      await execCommand(`git archive --format=tar ${releaseId} -o "${archivePath}"`, { cwd: repoRoot });
      await execCommand(`tar -xf "${archivePath}" -C "${stagingPath}"`, { cwd: repoRoot });
      await execCommand('npm ci --omit=dev', { cwd: stagingPath });
      await fsp.rm(releasePath, { recursive: true, force: true });
      await fsp.rename(stagingPath, releasePath);
    } finally {
      await fsp.rm(archivePath, { force: true });
      await fsp.rm(stagingPath, { recursive: true, force: true });
    }
  }

  await fsp.writeFile(currentEntryPath, getCurrentWrapperContent(), 'utf8');
  await fsp.writeFile(currentMetaPath, JSON.stringify({
    activeRelease: releaseId,
    activeCommit: releaseId,
    activePath: releasePath,
    previousRelease: null,
    previousCommit: null,
    updatedAt: new Date().toISOString()
  }, null, 2), 'utf8');

  console.log(`Runtime bootstrap concluido em ${runtimeRoot}`);
  console.log(`Release ativo: ${releaseId}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  execCommand,
  getRuntimeConfigEnvContent,
  ensureRuntimeConfigFile,
  getCurrentWrapperContent,
  main
};
