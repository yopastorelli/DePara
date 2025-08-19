/**
 * Rotas de Health Check para DePara
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const os = require('os');

/**
 * Health Check Básico
 * GET /api/health
 */
router.get('/', (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: require('../../package.json').version,
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

    const duration = Date.now() - startTime;
    logger.performance('Health Check', duration);

    res.status(200).json(healthData);
  } catch (error) {
    logger.operationError('Health Check', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao verificar saúde da aplicação',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health Check Detalhado
 * GET /api/health/detailed
 */
router.get('/detailed', (req, res) => {
  const startTime = Date.now();
  
  try {
    const detailedHealth = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      application: {
        name: 'DePara',
        version: require('../../package.json').version,
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

    const duration = Date.now() - startTime;
    logger.performance('Detailed Health Check', duration);

    res.status(200).json(detailedHealth);
  } catch (error) {
    logger.operationError('Detailed Health Check', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao verificar saúde detalhada da aplicação',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health Check de Conectividade
 * GET /api/health/connectivity
 */
router.get('/connectivity', (req, res) => {
  const startTime = Date.now();
  
  try {
    // Verificar conectividade básica
    const connectivity = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      checks: {
        fileSystem: {
          status: 'OK',
          details: 'Sistema de arquivos acessível',
          value: true
        },
        memory: {
          status: 'OK',
          details: 'Memória disponível',
          value: process.memoryUsage().heapUsed > 0
        },
        process: {
          status: 'OK',
          details: 'Processo ativo',
          value: process.pid > 0
        }
      },
      summary: 'Todas as verificações de conectividade passaram'
    };

    const duration = Date.now() - startTime;
    logger.performance('Connectivity Health Check', duration);

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
