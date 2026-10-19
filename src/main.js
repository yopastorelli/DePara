const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

const { loadOperationalConfig } = require('./utils/runtimeConfig');
loadOperationalConfig();

const logger = require('./utils/logger');
const { getAppMetadata } = require('./utils/appMetadata');
const routes = require('./routes');
const updateOrchestrator = require('./services/updateOrchestrator');
const configStore = require('./utils/configStore');
const folderManager = require('./config/folders');
const fileOperationsManager = require('./utils/fileOperations');
const localSyncManager = require('./utils/fileSync/localSyncManager');
const { recoverPendingOperationalImport } = require('./utils/operationalBackup');
const errorHandler = require('./middleware/errorHandler');
const { readRateLimiter } = require('./middleware/rateLimiter');
const { writeJsonAtomic } = require('./utils/atomicStore');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const NODE_ENV = process.env.NODE_ENV || 'development';
const appMetadata = getAppMetadata();

const app = express();

let server = null;
let processHandlersRegistered = false;
let shutdownPromise = null;
let shutdownRequest = null;
let shutdownToken = null;

function getRepoRoot() {
  return path.resolve(__dirname, '..');
}

function getRuntimeRoot() {
  return process.env.DEPARA_RUNTIME_ROOT || path.join(os.homedir(), '.depara');
}

function getRuntimeDirectories() {
  const runtimeRoot = getRuntimeRoot();
  const runtimePublicDir = process.env.DEPARA_RUNTIME_PUBLIC_DIR || path.join(runtimeRoot, 'public');

  return [
    process.env.DEPARA_LOG_DIR || path.join(runtimeRoot, 'logs'),
    process.env.DEPARA_BACKUP_DIR || path.join(runtimeRoot, 'backups'),
    process.env.DEPARA_TEMP_DIR || path.join(runtimeRoot, 'temp'),
    path.join(runtimePublicDir, 'uploads'),
    path.join(runtimePublicDir, 'downloads'),
    configStore.getDataDir()
  ];
}

async function initializeDirectories() {
  const fs = require('fs').promises;
  const directories = getRuntimeDirectories();

  for (const directory of directories) {
    await fs.mkdir(directory, { recursive: true });
  }

  shutdownToken = crypto.randomBytes(32).toString('hex');
  await writeJsonAtomic(path.join(getRuntimeRoot(), 'control', 'shutdown.json'), {
    pid: process.pid,
    port: Number(PORT),
    token: shutdownToken,
    createdAt: new Date().toISOString()
  });
}

function configureApp() {
  if (app.locals.configured) {
    return app;
  }

  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"]
      }
    },
    hsts: false,
    noSniff: true,
    xssFilter: true
  }));

  app.use('/api', readRateLimiter);

  const maxPayload = process.env.MAX_PAYLOAD || '8mb';
  app.use(express.json({ limit: maxPayload }));
  app.use(express.urlencoded({ extended: true, limit: maxPayload }));

  const httpLoggingEnabled = process.env.DEPARA_HTTP_LOGGING === 'true'
    || (process.env.DEPARA_HTTP_LOGGING !== 'false' && NODE_ENV !== 'production');

  const infoLoggingEnabled = typeof logger.isLevelEnabled !== 'function' || logger.isLevelEnabled('info');

  if (httpLoggingEnabled && infoLoggingEnabled) {
    app.use(morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim())
      }
    }));
  }

  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/ui', express.static(path.join(__dirname, 'public')));

  if (process.env.DEPARA_REQUEST_METADATA_LOGGING === 'true' && infoLoggingEnabled) {
    app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - ${req.ip}`, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  app.use('/api', routes);

  app.post('/internal/shutdown', (req, res) => {
    const suppliedToken = req.get('X-DePara-Shutdown-Token') || '';
    if (!shutdownToken || suppliedToken !== shutdownToken) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    if (req.get('X-DePara-Update') === 'true') {
      const engine = fileOperationsManager.transactionalOperations;
      if (engine.activeOperations.size || localSyncManager.active.size || localSyncManager.importing) {
        return res.status(409).json({ success: false, error: 'Operações em andamento; atualização adiada' });
      }
      engine.draining = true;
    }

    res.status(202).json({ success: true, status: 'shutting_down' });
    if (typeof shutdownRequest === 'function') {
      setImmediate(() => shutdownRequest());
    }
    return undefined;
  });

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      version: appMetadata.version,
      releaseCommit: process.env.DEPARA_RELEASE_COMMIT || null
    });
  });

  app.get('/', (req, res) => {
    res.json({
      name: appMetadata.displayName,
      version: appMetadata.version,
      description: appMetadata.description,
      endpoints: {
        health: '/health',
        apiHealth: '/api/health',
        status: '/api/status',
        files: '/api/files',
        config: '/api/config',
        update: '/api/update',
        ui: '/ui'
      },
      documentation: '/api/docs'
    });
  });

  app.get('/ui', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.use(errorHandler);

  app.use((req, res) => {
    res.status(404).json({
      error: 'Rota nao encontrada',
      path: req.originalUrl,
      method: req.method
    });
  });

  app.locals.configured = true;
  return app;
}

function registerProcessHandlers() {
  if (processHandlersRegistered || process.env.DEPARA_DISABLE_PROCESS_HOOKS === 'true') {
    return;
  }

  const shutdownAndExit = async (exitCode) => {
    if (!shutdownPromise) {
      shutdownPromise = stopServer();
    }
    try {
      await shutdownPromise;
    } finally {
      process.exit(exitCode);
    }
  };

  shutdownRequest = () => shutdownAndExit(0);

  process.on('uncaughtException', (error) => {
    logger.error('Erro nao capturado:', { error: error.message, stack: error.stack });
    shutdownAndExit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Promise rejeitada nao tratada:', { reason });
    shutdownAndExit(1);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM recebido, encerrando servidor...');
    shutdownAndExit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT recebido, encerrando servidor...');
    shutdownAndExit(0);
  });

  processHandlersRegistered = true;
}

async function startServer(options = {}) {
  const { port = PORT, registerHandlers = false } = options;

  configureApp();

  if (server) {
    return server;
  }

  if (registerHandlers) {
    registerProcessHandlers();
  }

  await initializeDirectories();
  await configStore.ensureConfigFile();
  await fileOperationsManager.init();
  await folderManager.init();
  await recoverPendingOperationalImport();
  await localSyncManager.init();

  if (registerHandlers && process.env.DEPARA_ENABLE_UPDATE_SCHEDULER === 'true') {
    try { await updateOrchestrator.init(); }
    catch (error) { logger.warn('Falha ao iniciar atualização automática', { error: error.message }); }
  }

  server = await new Promise((resolve, reject) => {
    const createdServer = app.listen(port, HOST, () => resolve(createdServer));
    createdServer.on('error', reject);
  });

  logger.info(`Servidor ${appMetadata.displayName} iniciado na porta ${port}`);
  logger.info(`API disponivel em: http://${HOST}:${port}`);
  logger.info(`Interface web disponivel em: http://${HOST}:${port}/ui`);


  return server;
}

async function stopServer() {
  const activeServer = server;
  server = null;

  await localSyncManager.stop();

  if (fileOperationsManager && typeof fileOperationsManager.beginShutdown === 'function') {
    await fileOperationsManager.beginShutdown(30000);
  }

  if (typeof updateOrchestrator.shutdown === 'function') {
    await updateOrchestrator.shutdown();
  }

  if (folderManager && typeof folderManager.cleanup === 'function') {
    folderManager.cleanup();
  }

  if (fileOperationsManager && typeof fileOperationsManager.closeImageCatalogs === 'function') {
    await fileOperationsManager.closeImageCatalogs();
  }

  if (activeServer) {
    await new Promise((resolve, reject) => {
      activeServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  if (typeof logger.close === 'function') {
    logger.close();
  }
}

configureApp();

app.startServer = startServer;
app.stopServer = stopServer;
app.close = (callback) => {
  return stopServer()
    .then(() => {
      if (typeof callback === 'function') {
        callback();
      }
    })
    .catch((error) => {
      if (typeof callback === 'function') {
        callback(error);
        return;
      }
      throw error;
    });
};
app.initializeDirectories = initializeDirectories;
app.getRepoRoot = getRepoRoot;
app.getRuntimeRoot = getRuntimeRoot;

if (require.main === module) {
  startServer({ registerHandlers: true }).catch((error) => {
    console.error('Erro critico durante inicializacao:', error);
    process.exit(1);
  });
}

module.exports = app;
