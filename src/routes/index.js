/**
 * Rotas Principais da API DePara
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Importar rotas específicas
const healthRoutes = require('./health');
const statusRoutes = require('./status');
const fileOperationsRoutes = require('./fileOperations');
const trayRoutes = require('./tray');
const updateRoutes = require('./update');
const desktopRoutes = require('./desktop');

// Middleware de logging para todas as rotas
router.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log do início da requisição
  logger.startOperation('API Request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  // Interceptar o final da resposta para logging
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.endOperation('API Request', duration, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode
    });
  });

  next();
});

// Rota de documentação da API
router.get('/docs', (req, res) => {
  res.json({
    message: 'Documentação da API DePara v2.0.0',
    version: '2.0.0',
    description: 'Sistema simplificado focado em operações de arquivos',
    endpoints: {
      health: {
        GET: '/api/health - Status da aplicação'
      },
      status: {
        GET: '/api/status - Informações detalhadas do sistema'
      },
      files: {
        POST: '/api/files/execute - Executar operação imediata',
        POST: '/api/files/schedule - Agendar operação periódica',
        GET: '/api/files/scheduled - Listar operações agendadas',
        POST: '/api/files/batch - Operação em lote',
        GET: '/api/files/templates - Templates pré-configurados'
      }
    },
    examples: {
      execute: {
        method: 'POST',
        url: '/api/files/execute',
        body: {
          action: 'move',
          sourcePath: '/origem/arquivo.txt',
          targetPath: '/destino/arquivo.txt',
          options: {
            backupBeforeMove: true,
            preserveStructure: true
          }
        }
      },
      schedule: {
        method: 'POST',
        url: '/api/files/schedule',
        body: {
          frequency: '1h',
          action: 'copy',
          sourcePath: '/origem',
          targetPath: '/destino',
          options: {
            batch: true,
            preserveStructure: false
          }
        }
      }
    }
  });
});

// Aplicar rotas específicas
router.use('/health', healthRoutes);
router.use('/status', statusRoutes);
router.use('/files', fileOperationsRoutes);
router.use('/tray', trayRoutes);
router.use('/update', updateRoutes);
router.use('/desktop', desktopRoutes);

// Rota padrão da API
router.get('/', (req, res) => {
  res.json({
    message: 'DePara API v2.0.0',
    description: 'Sistema de Gerenciamento de Arquivos com Operações Automáticas',
    documentation: '/api/docs',
    health: '/api/health',
    status: '/api/status',
    files: '/api/files',
    ui: '/ui'
  });
});

module.exports = router;
