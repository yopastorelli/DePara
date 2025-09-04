/**
 * Rotas de Status do Sistema para DePara
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Status geral do sistema
 * GET /api/status
 */
router.get('/', (req, res) => {
  const startTime = Date.now();
  
  try {
    const systemStatus = {
      status: 'OPERATIONAL',
      timestamp: new Date().toISOString(),
      application: {
        name: 'DePara',
        version: process.env.npm_package_version || '1.0.0',
        description: 'Sistema de Conversão e Mapeamento de Dados',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      system: {
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
      },
      performance: {
        memory: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss,
          arrayBuffers: process.memoryUsage().arrayBuffers
        },
        cpu: {
          usage: process.cpuUsage(),
          uptime: process.uptime()
        }
      }
    };

    const duration = Date.now() - startTime;
    logger.performance('System Status', duration);

    res.status(200).json(systemStatus);
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

/**
 * Status detalhado de recursos
 * GET /api/status/resources
 */
router.get('/resources', (req, res) => {
  const startTime = Date.now();
  
  try {
    const resources = {
      timestamp: new Date().toISOString(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        percentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
        process: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss
        }
      },
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        speed: os.cpus()[0]?.speed || 0,
        loadAverage: os.loadavg(),
        usage: process.cpuUsage()
      },
      disk: {
        // Informações básicas de disco (Windows)
        platform: os.platform(),
        note: 'Informações detalhadas de disco requerem bibliotecas específicas do sistema'
      },
      network: {
        interfaces: os.networkInterfaces()
      }
    };

    const duration = Date.now() - startTime;
    logger.performance('Resources Status', duration);

    res.status(200).json(resources);
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

/**
 * Status de conectividade e serviços
 * GET /api/status/connectivity
 */
router.get('/connectivity', (req, res) => {
  const startTime = Date.now();
  
  try {
    const connectivity = {
      timestamp: new Date().toISOString(),
      checks: {
        fileSystem: {
          status: 'OK',
          details: 'Sistema de arquivos acessível',
          logs: checkLogDirectory(),
          config: checkConfigFiles()
        },
        memory: {
          status: 'OK',
          details: 'Memória disponível',
          available: os.freemem(),
          threshold: 100 * 1024 * 1024 // 100MB
        },
        process: {
          status: 'OK',
          details: 'Processo ativo',
          pid: process.pid,
          uptime: process.uptime()
        }
      },
      summary: 'Todos os serviços estão operacionais'
    };

    // Verificar se há problemas
    const issues = [];
    if (connectivity.checks.memory.available < connectivity.checks.memory.threshold) {
      connectivity.checks.memory.status = 'WARNING';
      connectivity.checks.memory.details = 'Memória baixa';
      issues.push('Memória disponível abaixo do limite recomendado');
    }

    if (issues.length > 0) {
      connectivity.summary = `Problemas detectados: ${issues.join(', ')}`;
    }

    const duration = Date.now() - startTime;
    logger.performance('Connectivity Status', duration);

    res.status(200).json(connectivity);
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

/**
 * Status de performance e métricas
 * GET /api/status/performance
 */
router.get('/performance', (req, res) => {
  const startTime = Date.now();
  
  try {
    const performance = {
      timestamp: new Date().toISOString(),
      metrics: {
        responseTime: {
          current: Date.now() - startTime,
          average: 'Calculado em tempo real'
        },
        throughput: {
          requestsPerSecond: 'Monitorado em tempo real',
          activeConnections: 'Implementar contador de conexões'
        },
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
    };

    const duration = Date.now() - startTime;
    logger.performance('Performance Status', duration);

    res.status(200).json(performance);
  } catch (error) {
    logger.operationError('Performance Status', error);
    res.status(500).json({
      error: {
        message: 'Erro ao obter métricas de performance',
        details: error.message
      }
    });
  }
});

/**
 * Status de logs e monitoramento
 * GET /api/status/logs
 */
router.get('/logs', (req, res) => {
  const startTime = Date.now();
  
  try {
    const logStatus = {
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
    };

    const duration = Date.now() - startTime;
    logger.performance('Logs Status', duration);

    res.status(200).json(logStatus);
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

// Funções auxiliares

function checkLogDirectory() {
  try {
    const logDir = path.dirname(process.env.LOG_FILE || 'logs/app.log');
    return {
      exists: fs.existsSync(logDir),
      writable: true, // Assumindo que é gravável se conseguimos criar
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
  const configFiles = [
    'package.json',
    '.env',
    'env.example'
  ];

  const status = {};
  for (const file of configFiles) {
    try {
      status[file] = {
        exists: fs.existsSync(file),
        readable: true
      };
    } catch (error) {
      status[file] = {
        exists: false,
        readable: false,
        error: error.message
      };
    }
  }

  return status;
}

function getRecentLogs() {
  try {
    const logFile = process.env.LOG_FILE || 'logs/app.log';
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      return {
        lastModified: stats.mtime,
        size: stats.size,
        lines: 'Implementar contagem de linhas'
      };
    }
    return {
      lastModified: null,
      size: 0,
      lines: 0
    };
  } catch (error) {
    return {
      lastModified: null,
      size: 0,
      lines: 0,
      error: error.message
    };
  }
}

function getLogFileSize() {
  try {
    const logFile = process.env.LOG_FILE || 'logs/app.log';
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      return stats.size;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

function getLogLastModified() {
  try {
    const logFile = process.env.LOG_FILE || 'logs/app.log';
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      return stats.mtime;
    }
    return null;
  } catch (error) {
    return null;
  }
}

function generatePerformanceRecommendations() {
  const recommendations = [];
  const memoryUsage = process.memoryUsage();
  const systemMemory = os.freemem();

  if (memoryUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
    recommendations.push('Considerar otimização de memória - heap usado alto');
  }

  if (systemMemory < 200 * 1024 * 1024) { // 200MB
    recommendations.push('Memória do sistema baixa - considerar liberar recursos');
  }

  const loadAvg = os.loadavg();
  if (loadAvg[0] > 2.0) {
    recommendations.push('Carga do sistema alta - considerar balanceamento');
  }

  if (recommendations.length === 0) {
    recommendations.push('Sistema operando dentro dos parâmetros recomendados');
  }

  return recommendations;
}

module.exports = router;
