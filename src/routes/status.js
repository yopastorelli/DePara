const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const logger = require('../utils/logger');
const { getAppMetadata } = require('../utils/appMetadata');

const router = express.Router();
const appMetadata = getAppMetadata();
const statusCache = new Map();
const STATUS_CACHE_TTL_MS = 15000;

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

async function getCachedValue(cacheKey, loader) {
  const cached = statusCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.loadedAt) < STATUS_CACHE_TTL_MS) {
    return cached.value;
  }

  const value = await loader();
  statusCache.set(cacheKey, {
    loadedAt: now,
    value
  });
  return value;
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
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    type: os.type(),
    release: os.release(),
    arch: os.arch(),
    cpuCount: os.cpus().length,
    loadAverage: os.loadavg(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    userHome: os.homedir()
  };
}

function getProcessMemoryPayload() {
  return {
    heapUsed: process.memoryUsage().heapUsed,
    heapTotal: process.memoryUsage().heapTotal,
    external: process.memoryUsage().external,
    rss: process.memoryUsage().rss,
    arrayBuffers: process.memoryUsage().arrayBuffers
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

    res.status(200).json({
      timestamp: new Date().toISOString(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        percentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
        process: getProcessMemoryPayload()
      },
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        speed: os.cpus()[0]?.speed || 0,
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
        file: process.env.LOG_FILE || 'logs/app.log',
        directory: path.dirname(process.env.LOG_FILE || 'logs/app.log')
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
    const logDir = path.dirname(process.env.LOG_FILE || 'logs/app.log');
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
    const logFile = process.env.LOG_FILE || 'logs/app.log';
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
    const logFile = process.env.LOG_FILE || 'logs/app.log';
    return fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
  } catch {
    return 0;
  }
}

function getLogLastModified() {
  try {
    const logFile = process.env.LOG_FILE || 'logs/app.log';
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
    if (os.platform() === 'win32') {
      return await getWindowsDiskInfo();
    }

    return await getUnixDiskInfo();
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
    const output = await execCommand('wmic logicaldisk get size,freespace,caption');
    const lines = output.split('\n').filter((line) => line.trim() && !line.includes('Caption'));
    const drives = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) {
        continue;
      }

      const caption = parts[0];
      const freeSpace = parseInt(parts[1], 10) || 0;
      const totalSize = parseInt(parts[2], 10) || 0;

      if (totalSize > 0) {
        drives.push({
          drive: caption,
          total: totalSize,
          free: freeSpace,
          used: totalSize - freeSpace,
          percentage: Math.round(((totalSize - freeSpace) / totalSize) * 100)
        });
      }
    }

    return drives;
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

async function getUnixDiskInfo() {
  try {
    const output = await execCommand('df -h');
    const lines = output.split('\n').slice(1);
    const drives = [];
    const virtualFilesystems = [
      'tmpfs', 'devtmpfs', 'overlay', 'squashfs', 'proc', 'sysfs', 'udev',
      'cgroup', 'pstore', 'bpf', 'tracefs', 'debugfs', 'securityfs', 'mqueue',
      'hugetlbfs', 'configfs', 'fusectl', 'binfmt_misc', 'systemd-1', 'rpc_pipefs',
      'sunrpc', 'selinuxfs', 'autofs', 'cgroup2', 'efivarfs', 'devpts', 'none',
      'ramfs', 'rootfs', 'shm', 'run', 'var', 'tmp', 'boot', 'efi'
    ];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) {
        continue;
      }

      const filesystem = parts[0];
      const total = parts[1];
      const used = parts[2];
      const available = parts[3];
      const percentage = parseInt(parts[4], 10) || 0;
      const mountpoint = parts[5];
      const isVirtualFS = virtualFilesystems.some((vfs) => filesystem.includes(vfs) || mountpoint.includes(vfs));
      const isPhysicalDisk = filesystem.startsWith('/dev/')
        && !isVirtualFS
        && total !== '0'
        && total !== '0B'
        && parseSizeToBytes(total) > 1024 * 1024 * 1024;

      if (!isPhysicalDisk) {
        continue;
      }

      drives.push({
        drive: filesystem,
        mountpoint,
        total: parseSizeToBytes(total),
        free: parseSizeToBytes(available),
        used: parseSizeToBytes(used),
        percentage,
        totalFormatted: total,
        usedFormatted: used,
        freeFormatted: available
      });
    }

    return drives;
  } catch (error) {
    logger.warn('Erro ao obter informacoes de disco no Linux:', { error: error.message });
    return [{
      drive: '/',
      total: 0,
      free: 0,
      used: 0,
      percentage: 0,
      error: 'Nao foi possivel obter informacoes de disco'
    }];
  }
}

function parseSizeToBytes(sizeStr) {
  if (!sizeStr) {
    return 0;
  }

  const size = parseFloat(sizeStr);
  const unit = sizeStr.slice(-1).toUpperCase();

  switch (unit) {
    case 'K':
      return size * 1024;
    case 'M':
      return size * 1024 * 1024;
    case 'G':
      return size * 1024 * 1024 * 1024;
    case 'T':
      return size * 1024 * 1024 * 1024 * 1024;
    default:
      return size;
  }
}

module.exports = router;
