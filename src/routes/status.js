const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');

const logger = require('../utils/logger');
const { getAppMetadata } = require('../utils/appMetadata');
const { getRuntimeLogsDir } = require('../utils/runtimePaths');

const router = express.Router();
const appMetadata = getAppMetadata();
const statusCache = new Map();
const statusInFlight = new Map();
const STATUS_CACHE_TTL_MS = 15000;

function getLogFilePath() {
  return process.env.LOG_FILE || path.join(getRuntimeLogsDir(), 'app.log');
}

async function getCachedValue(cacheKey, loader) {
  const cached = statusCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.loadedAt) < STATUS_CACHE_TTL_MS) {
    return cached.value;
  }

  const running = statusInFlight.get(cacheKey);
  if (running) {
    return running;
  }

  const pending = Promise.resolve()
    .then(loader)
    .then((value) => {
      statusCache.set(cacheKey, {
        loadedAt: Date.now(),
        value
      });
      return value;
    })
    .finally(() => {
      statusInFlight.delete(cacheKey);
    });

  statusInFlight.set(cacheKey, pending);
  return pending;
}

function getApplicationPayload() {
  return {
    name: appMetadata.displayName,
    version: appMetadata.version,
    description: appMetadata.description,
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  };
}

function getSystemPayload() {
  const cpuInfo = os.cpus();

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    type: os.type(),
    release: os.release(),
    arch: os.arch(),
    cpuCount: cpuInfo.length,
    loadAverage: os.loadavg(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    userHome: os.homedir()
  };
}

function getProcessMemoryPayload() {
  const memoryUsage = process.memoryUsage();

  return {
    heapUsed: memoryUsage.heapUsed,
    heapTotal: memoryUsage.heapTotal,
    external: memoryUsage.external,
    rss: memoryUsage.rss,
    arrayBuffers: memoryUsage.arrayBuffers
  };
}

router.get('/', (req, res) => {
  const startTime = Date.now();

  try {
    res.status(200).json({
      status: 'OPERATIONAL',
      timestamp: new Date().toISOString(),
      application: getApplicationPayload(),
      system: getSystemPayload(),
      performance: {
        memory: getProcessMemoryPayload(),
        cpu: {
          usage: process.cpuUsage(),
          uptime: process.uptime()
        }
      }
    });

    logger.performance('System Status', Date.now() - startTime);
  } catch (error) {
    logger.operationError('System Status', error);
    res.status(500).json({
      error: {
        message: 'Erro ao obter status do sistema',
        details: error.message
      }
    });
  }
});

router.get('/system', (req, res) => {
  req.url = '/';
  router.handle(req, res);
});

router.get('/resources', async (req, res) => {
  const startTime = Date.now();

  try {
    const diskInfo = await getCachedValue('disk-info', getDiskInfo);
    const cpuInfo = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    res.status(200).json({
      timestamp: new Date().toISOString(),
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: totalMemory - freeMemory,
        percentage: Math.round(((totalMemory - freeMemory) / totalMemory) * 100),
        process: getProcessMemoryPayload()
      },
      cpu: {
        count: cpuInfo.length,
        model: cpuInfo[0]?.model || 'Unknown',
        speed: cpuInfo[0]?.speed || 0,
        loadAverage: os.loadavg(),
        usage: process.cpuUsage()
      },
      disk: {
        platform: os.platform(),
        drives: diskInfo
      },
      network: {
        interfaces: os.networkInterfaces()
      },
      collection: {
        cachedDiskInfoTtlMs: STATUS_CACHE_TTL_MS
      }
    });

    logger.performance('Resources Status', Date.now() - startTime);
  } catch (error) {
    logger.operationError('Resources Status', error);
    res.status(500).json({
      error: {
        message: 'Erro ao obter status de recursos',
        details: error.message
      }
    });
  }
});

router.get('/connectivity', (req, res) => {
  const startTime = Date.now();

  try {
    const connectivity = {
      timestamp: new Date().toISOString(),
      checks: {
        fileSystem: {
          status: 'OK',
          details: 'Sistema de arquivos acessivel',
          logs: checkLogDirectory(),
          config: checkConfigFiles()
        },
        memory: {
          status: 'OK',
          details: 'Memoria disponivel',
          available: os.freemem(),
          threshold: 100 * 1024 * 1024
        },
        process: {
          status: 'OK',
          details: 'Processo ativo',
          pid: process.pid,
          uptime: process.uptime()
        }
      },
      summary: 'Todos os servicos estao operacionais'
    };

    if (connectivity.checks.memory.available < connectivity.checks.memory.threshold) {
      connectivity.checks.memory.status = 'WARNING';
      connectivity.checks.memory.details = 'Memoria baixa';
      connectivity.summary = 'Problemas detectados: memoria disponivel abaixo do limite recomendado';
    }

    res.status(200).json(connectivity);
    logger.performance('Connectivity Status', Date.now() - startTime);
  } catch (error) {
    logger.operationError('Connectivity Status', error);
    res.status(500).json({
      error: {
        message: 'Erro ao verificar conectividade',
        details: error.message
      }
    });
  }
});

router.get('/performance', (req, res) => {
  const startTime = Date.now();

  try {
    res.status(200).json({
      timestamp: new Date().toISOString(),
      metrics: {
        responseTime: {
          current: Date.now() - startTime,
          average: null
        },
        throughput: null,
        resourceUtilization: {
          cpu: {
            current: process.cpuUsage(),
            system: os.loadavg()
          },
          memory: {
            process: process.memoryUsage(),
            system: {
              total: os.totalmem(),
              free: os.freemem(),
              used: os.totalmem() - os.freemem()
            }
          }
        }
      },
      recommendations: generatePerformanceRecommendations()
    });

    logger.performance('Performance Status', Date.now() - startTime);
  } catch (error) {
    logger.operationError('Performance Status', error);
    res.status(500).json({
      error: {
        message: 'Erro ao obter metricas de performance',
        details: error.message
      }
    });
  }
});

router.get('/logs', (req, res) => {
  const startTime = Date.now();

  try {
    res.status(200).json({
      timestamp: new Date().toISOString(),
      logSystem: {
        status: 'OPERATIONAL',
        level: process.env.LOG_LEVEL || 'info',
        file: getLogFilePath(),
        directory: path.dirname(getLogFilePath())
      },
      recentLogs: getRecentLogs(),
      logStats: {
        totalSize: getLogFileSize(),
        lastModified: getLogLastModified()
      }
    });

    logger.performance('Logs Status', Date.now() - startTime);
  } catch (error) {
    logger.operationError('Logs Status', error);
    res.status(500).json({
      error: {
        message: 'Erro ao obter status dos logs',
        details: error.message
      }
    });
  }
});

function checkLogDirectory() {
  try {
    const logDir = path.dirname(getLogFilePath());
    return {
      exists: fs.existsSync(logDir),
      writable: true,
      path: logDir
    };
  } catch (error) {
    return {
      exists: false,
      writable: false,
      error: error.message
    };
  }
}

function checkConfigFiles() {
  const configFiles = ['package.json', '.env', 'env.example'];
  const status = {};

  for (const file of configFiles) {
    status[file] = {
      exists: fs.existsSync(file),
      readable: true
    };
  }

  return status;
}

function getRecentLogs() {
  try {
    const logFile = getLogFilePath();
    if (!fs.existsSync(logFile)) {
      return {
        lastModified: null,
        size: 0,
        lines: null
      };
    }

    const stats = fs.statSync(logFile);
    return {
      lastModified: stats.mtime,
      size: stats.size,
      lines: null
    };
  } catch (error) {
    return {
      lastModified: null,
      size: 0,
      lines: null,
      error: error.message
    };
  }
}

function getLogFileSize() {
  try {
    const logFile = getLogFilePath();
    return fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
  } catch {
    return 0;
  }
}

function getLogLastModified() {
  try {
    const logFile = getLogFilePath();
    return fs.existsSync(logFile) ? fs.statSync(logFile).mtime : null;
  } catch {
    return null;
  }
}

function generatePerformanceRecommendations() {
  const recommendations = [];
  const memoryUsage = process.memoryUsage();
  const systemMemory = os.freemem();
  const loadAvg = os.loadavg();

  if (memoryUsage.heapUsed > 100 * 1024 * 1024) {
    recommendations.push('Considerar otimizacao de memoria - heap usado alto');
  }

  if (systemMemory < 200 * 1024 * 1024) {
    recommendations.push('Memoria do sistema baixa - considerar liberar recursos');
  }

  if (loadAvg[0] > 2) {
    recommendations.push('Carga do sistema alta - considerar reduzir polling, I/O e shell calls');
  }

  if (recommendations.length === 0) {
    recommendations.push('Sistema operando dentro dos parametros recomendados');
  }

  return recommendations;
}

async function getDiskInfo() {
  try {
    return await getWindowsDiskInfo();
  } catch (error) {
    logger.error('Erro geral ao obter informacoes de disco:', { error: error.message });
    return [{
      drive: 'Unknown',
      total: 0,
      free: 0,
      used: 0,
      percentage: 0,
      error: error.message
    }];
  }
}

async function getWindowsDiskInfo() {
  try {
    const configuredDrives = (process.env.DEPARA_STATUS_DRIVES || '')
      .split(';')
      .map((drive) => drive.trim())
      .filter(Boolean);
    const allowedDrives = (process.env.DEPARA_ALLOWED_PATHS || '')
      .split(';')
      .map((allowedPath) => allowedPath.trim().match(/^([A-Za-z]):[\\/]/)?.[1])
      .filter(Boolean)
      .map((drive) => `${drive}:`);
    const systemDrive = process.env.SystemDrive || 'C:';
    const drivesToCheck = [...new Set([systemDrive, ...configuredDrives, ...allowedDrives])]
      .map((drive) => drive.endsWith(':') ? drive : `${drive}:`);

    const drives = await Promise.all(drivesToCheck.map(async (drive) => {
      try {
        const stats = await fs.promises.statfs(`${drive}\\`);
        const totalSize = stats.blocks * stats.bsize;
        const freeSpace = stats.bavail * stats.bsize;
        return {
          drive,
          total: totalSize,
          free: freeSpace,
          used: totalSize - freeSpace,
          percentage: totalSize > 0 ? Math.round(((totalSize - freeSpace) / totalSize) * 100) : 0
        };
      } catch {
        return null;
      }
    }));

    return drives.filter(Boolean);
  } catch (error) {
    logger.warn('Erro ao obter informacoes de disco no Windows:', { error: error.message });
    return [{
      drive: 'C:',
      total: 0,
      free: 0,
      used: 0,
      percentage: 0,
      error: 'Nao foi possivel obter informacoes de disco'
    }];
  }
}

module.exports = router;
