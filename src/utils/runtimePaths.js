const os = require('os');
const path = require('path');

function getSourceRepoRoot() {
  return process.env.DEPARA_UPDATE_SOURCE_ROOT || path.resolve(__dirname, '../..');
}

function getRuntimeRoot() {
  return process.env.DEPARA_RUNTIME_ROOT || path.join(os.homedir(), '.depara');
}

function getRuntimeDataDir() {
  return process.env.DEPARA_DATA_DIR || path.join(getRuntimeRoot(), 'data');
}

function getRuntimeLogsDir() {
  return process.env.DEPARA_LOG_DIR || path.join(getRuntimeRoot(), 'logs');
}

function getRuntimeBackupsDir() {
  return process.env.DEPARA_BACKUP_DIR || path.join(getRuntimeRoot(), 'backups');
}

function getRuntimeTempDir() {
  return process.env.DEPARA_TEMP_DIR || path.join(getRuntimeRoot(), 'temp');
}

function getRuntimeReleasesDir() {
  return process.env.DEPARA_RELEASES_DIR || path.join(getRuntimeRoot(), 'releases');
}

function getRuntimeCurrentDir() {
  return process.env.DEPARA_CURRENT_DIR || path.join(getRuntimeRoot(), 'current');
}

function getRuntimeCurrentReleaseMetaPath() {
  return path.join(getRuntimeCurrentDir(), 'release.json');
}

function getRuntimeCurrentEntryPath() {
  return path.join(getRuntimeCurrentDir(), 'src', 'main.js');
}

module.exports = {
  getSourceRepoRoot,
  getRuntimeRoot,
  getRuntimeDataDir,
  getRuntimeLogsDir,
  getRuntimeBackupsDir,
  getRuntimeTempDir,
  getRuntimeReleasesDir,
  getRuntimeCurrentDir,
  getRuntimeCurrentReleaseMetaPath,
  getRuntimeCurrentEntryPath
};
