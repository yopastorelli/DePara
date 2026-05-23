const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { getRuntimeDataDir } = require('./runtimePaths');

function getPersistenceMigrationMarkerPath() {
  return path.join(getRuntimeDataDir(), 'persistence-migration.json');
}

function getDefaultMarker() {
  return {
    config: {
      migrated: false,
      source: null,
      outcome: 'unknown',
      attemptedAt: null
    },
    scheduledOperations: {
      migrated: false,
      source: null,
      outcome: 'unknown',
      attemptedAt: null
    },
    folders: {
      migrated: false,
      source: null,
      outcome: 'unknown',
      attemptedAt: null
    }
  };
}

async function readMarker() {
  const markerPath = getPersistenceMigrationMarkerPath();
  try {
    const data = await fs.readFile(markerPath, 'utf8');
    return {
      ...getDefaultMarker(),
      ...JSON.parse(data || '{}')
    };
  } catch {
    return getDefaultMarker();
  }
}

async function writeMarker(marker) {
  const markerPath = getPersistenceMigrationMarkerPath();
  await fs.mkdir(path.dirname(markerPath), { recursive: true });
  await fs.writeFile(markerPath, JSON.stringify(marker, null, 2), 'utf8');
}

async function recordMigrationStatus(key, patch) {
  const marker = await readMarker();
  marker[key] = {
    ...(marker[key] || {}),
    attemptedAt: new Date().toISOString(),
    ...patch
  };
  await writeMarker(marker);
  return marker[key];
}

async function getMigrationStatus() {
  return readMarker();
}

function hasMigrationMarker() {
  return fsSync.existsSync(getPersistenceMigrationMarkerPath());
}

module.exports = {
  getPersistenceMigrationMarkerPath,
  getDefaultMarker,
  readMarker,
  writeMarker,
  recordMigrationStatus,
  getMigrationStatus,
  hasMigrationMarker
};
