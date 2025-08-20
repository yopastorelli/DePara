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
const convertRoutes = require('./convert');
const mapRoutes = require('./map');
const statusRoutes = require('./status');
const folderRoutes = require('./folders');

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
    message: 'Documentação da API DePara',
    version: '1.0.0',
    endpoints: {
      health: {
        GET: '/api/health - Status da aplicação'
      },
      convert: {
        POST: '/api/convert - Conversão de dados entre formatos'
      },
      map: {
        POST: '/api/map - Mapeamento de campos de dados'
      },
      status: {
        GET: '/api/status - Informações detalhadas do sistema'
      }
    },
    examples: {
      convert: {
        method: 'POST',
        url: '/api/convert',
        body: {
          sourceFormat: 'csv',
          targetFormat: 'json',
          data: 'nome,idade\nJoão,25\nMaria,30'
        }
      },
      map: {
        method: 'POST',
        url: '/api/map',
        body: {
          sourceFields: ['nome', 'idade'],
          targetFields: ['name', 'age'],
          mapping: {
            'nome': 'name',
            'idade': 'age'
          }
        }
      }
    }
  });
});

// Aplicar rotas específicas
router.use('/health', healthRoutes);
router.use('/convert', convertRoutes);
router.use('/map', mapRoutes);
router.use('/status', statusRoutes);
router.use('/folders', folderRoutes);

// Rota padrão da API
router.get('/', (req, res) => {
  res.json({
    message: 'DePara API v1.0.0',
    description: 'Sistema de Conversão e Mapeamento de Dados',
    documentation: '/api/docs',
    health: '/api/health',
    status: '/api/status'
  });
});

module.exports = router;
