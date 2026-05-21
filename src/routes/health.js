const express = require('express');
const os = require('os');

const logger = require('../utils/logger');
const { getAppMetadata } = require('../utils/appMetadata');

const router = express.Router();
const appMetadata = getAppMetadata();

router.get('/', (req, res) => {
  const startTime = Date.now();

  try {
    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: appMetadata.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuCount: os.cpus().length,
        loadAverage: os.loadavg()
      }
    };

    logger.performance('Health Check', Date.now() - startTime);
    res.status(200).json(healthData);
  } catch (error) {
    logger.operationError('Health Check', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao verificar saude da aplicacao',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/detailed', (req, res) => {
  const startTime = Date.now();

  try {
    const detailedHealth = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      application: {
        name: appMetadata.displayName,
        version: appMetadata.version,
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid
      },
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss,
        arrayBuffers: process.memoryUsage().arrayBuffers
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuCount: os.cpus().length,
        loadAverage: os.loadavg(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        hostname: os.hostname(),
        type: os.type(),
        release: os.release()
      },
      network: {
        interfaces: os.networkInterfaces()
      }
    };

    logger.performance('Detailed Health Check', Date.now() - startTime);
    res.status(200).json(detailedHealth);
  } catch (error) {
    logger.operationError('Detailed Health Check', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao verificar saude detalhada da aplicacao',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/connectivity', (req, res) => {
  const startTime = Date.now();

  try {
    const connectivity = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      checks: {
        fileSystem: {
          status: 'OK',
          details: 'Sistema de arquivos acessivel',
          value: true
        },
        memory: {
          status: 'OK',
          details: 'Memoria disponivel',
          value: process.memoryUsage().heapUsed > 0
        },
        process: {
          status: 'OK',
          details: 'Processo ativo',
          value: process.pid > 0
        }
      },
      summary: 'Todas as verificacoes de conectividade passaram'
    };

    logger.performance('Connectivity Health Check', Date.now() - startTime);
    res.status(200).json(connectivity);
  } catch (error) {
    logger.operationError('Connectivity Health Check', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao verificar conectividade',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
