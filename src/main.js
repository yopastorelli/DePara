const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const os = require('os');
const path = require('path');

const logger = require('./utils/logger');
const { getAppMetadata } = require('./utils/appMetadata');
const { loadOperationalConfig } = require('./utils/runtimeConfig');
const routes = require('./routes');
const updateOrchestrator = require('./services/updateOrchestrator');
const configStore = require('./utils/configStore');
const folderManager = require('./config/folders');
const errorHandler = require('./middleware/errorHandler');
const { readRateLimiter } = require('./middleware/rateLimiter');

loadOperationalConfig();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const appMetadata = getAppMetadata();

const app = express();

let server = null;
let processHandlersRegistered = false;

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

  const maxPayload = process.env.MAX_PAYLOAD || '100mb';
  app.use(express.json({ limit: maxPayload }));
  app.use(express.urlencoded({ extended: true, limit: maxPayload }));

  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));

  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/ui', express.static(path.join(__dirname, 'public')));

  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path} - ${req.ip}`, {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    next();
  });

  app.use('/api', routes);

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      version: appMetadata.version
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

  app.use('*', (req, res) => {
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
    try {
      await stopServer();
    } finally {
      process.exit(exitCode);
    }
  };

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
  await folderManager.init();
  await updateOrchestrator.init();

  server = await new Promise((resolve, reject) => {
    const createdServer = app.listen(port, () => resolve(createdServer));
    createdServer.on('error', reject);
  });

  logger.info(`Servidor ${appMetadata.displayName} iniciado na porta ${port}`);
  logger.info(`API disponivel em: http://127.0.0.1:${port}`);
  logger.info(`Interface web disponivel em: http://127.0.0.1:${port}/ui`);

  return server;
}

async function stopServer() {
  const activeServer = server;
  server = null;

  if (typeof updateOrchestrator.shutdown === 'function') {
    await updateOrchestrator.shutdown();
  }

  if (folderManager && typeof folderManager.cleanup === 'function') {
    folderManager.cleanup();
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
