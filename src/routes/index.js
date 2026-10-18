const express = require('express');

const logger = require('../utils/logger');
const { getAppMetadata } = require('../utils/appMetadata');
const healthRoutes = require('./health');
const statusRoutes = require('./status');
const fileOperationsRoutes = require('./fileOperations');
const trayRoutes = require('./tray');
const updateRoutes = require('./update');
const logsRoutes = require('./logs');
const configRoutes = require('./config');

const router = express.Router();
const appMetadata = getAppMetadata();

const apiRequestLoggingEnabled = typeof logger.isLevelEnabled !== 'function'
  || logger.isLevelEnabled('info');

if (apiRequestLoggingEnabled) {
  router.use((req, res, next) => {
    const startTime = Date.now();

    logger.startOperation('API Request', {
      method: req.method,
      path: req.path,
      ip: req.ip
    });

    res.on('finish', () => {
      logger.endOperation('API Request', Date.now() - startTime, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode
      });
    });

    next();
  });
}

router.get('/docs', (req, res) => {
  res.json({
    message: `Documentacao da API ${appMetadata.displayName} v${appMetadata.version}`,
    version: appMetadata.version,
    description: appMetadata.description,
    canonicalDocs: '/docs/README.md',
    endpoints: {
      health: {
        GET: '/api/health'
      },
      status: {
        GET: '/api/status'
      },
      config: {
        GET: '/api/config',
        POST: '/api/config',
        EXPORT: '/api/config/export',
        IMPORT: '/api/config/import'
      },
      files: {
        GET_FOLDERS: '/api/files/folders',
        POST_FOLDER: '/api/files/folders',
        PUT_FOLDER: '/api/files/folders/:id',
        DELETE_FOLDER: '/api/files/folders/:id',
        GET_WORKFLOWS: '/api/files/workflows',
        POST_WORKFLOW: '/api/files/workflows',
        PUT_WORKFLOW: '/api/files/workflows/:id',
        DELETE_WORKFLOW: '/api/files/workflows/:id',
        POST_EXECUTE: '/api/files/execute',
        POST_BATCH: '/api/files/batch',
        GET_OPERATION: '/api/files/operations/:operationId',
        POST_CANCEL_OPERATION: '/api/files/operations/:operationId/cancel',
        GET_RECOVERY: '/api/files/recovery',
        POST_RESTORE_RECOVERY: '/api/files/recovery/:entryId/restore',
        POST_SCHEDULE: '/api/files/schedule',
        GET_SCHEDULED: '/api/files/scheduled',
        POST: '/api/files/list-images',
        DELETE: '/api/files/image-catalog/:catalogId',
        POST: '/api/files/list-folders'
      },
      update: {
        GET: '/api/update/auto/status',
        POST: '/api/update/auto/check-now',
        PUT: '/api/update/auto/config',
        POST: '/api/update/auto/trigger',
        GET: '/api/update/auto/history',
        GET: '/api/update/auto/diagnostics'
      },
      tray: {
        GET: '/api/tray/status'
      }
    }
  });
});

router.use('/health', healthRoutes);
router.use('/status', statusRoutes);
router.use('/files', fileOperationsRoutes);
router.use('/tray', trayRoutes);
router.use('/update', updateRoutes);
router.use('/logs', logsRoutes);
router.use('/config', configRoutes);

router.get('/', (req, res) => {
  res.json({
    message: `${appMetadata.displayName} API v${appMetadata.version}`,
    description: appMetadata.description,
    documentation: '/api/docs',
    health: '/api/health',
    status: '/api/status',
    files: '/api/files',
    ui: '/ui'
  });
});

module.exports = router;
