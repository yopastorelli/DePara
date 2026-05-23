#!/usr/bin/env node

'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
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

function getCurrentWrapperContent() {
  return `'use strict';

const fs = require('fs');
const path = require('path');

const metaPath = path.join(__dirname, '..', 'release.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

if (!meta.activePath) {
  throw new Error('Active release path missing in ' + metaPath);
}

process.env.DEPARA_APP_ROOT = meta.activePath;
module.exports = require(path.join(meta.activePath, 'src', 'main.js'));
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
  const currentEntryPath = path.join(currentDir, 'src', 'main.js');
  const currentMetaPath = path.join(currentDir, 'release.json');

  await Promise.all([
    fsp.mkdir(dataDir, { recursive: true }),
    fsp.mkdir(logsDir, { recursive: true }),
    fsp.mkdir(backupsDir, { recursive: true }),
    fsp.mkdir(tempDir, { recursive: true }),
    fsp.mkdir(releasesDir, { recursive: true }),
    fsp.mkdir(path.dirname(currentEntryPath), { recursive: true })
  ]);

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

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
