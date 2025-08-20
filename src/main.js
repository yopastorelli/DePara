/**
 * DePara - Sistema de Conversão e Mapeamento de Dados
 * Arquivo principal da aplicação
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Importar módulos da aplicação
const logger = require('./utils/logger');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

// Configurações da aplicação
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Inicializar aplicação Express
const app = express();

// Middleware de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
}));

// Middleware de CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Middleware para servir arquivos estáticos da interface web
app.use(express.static(path.join(__dirname, 'public')));

// Servir arquivos estáticos para a interface web
app.use('/ui', express.static(path.join(__dirname, 'public')));

// Middleware de request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Rotas da API
app.use('/api', routes);

// Rota de health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: require('../package.json').version
  });
});

// Rota raiz para API
app.get('/', (req, res) => {
    res.json({
        message: 'DePara API - Sistema de Conversão e Mapeamento de Dados',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            status: '/api/status',
            convert: '/api/convert',
            map: '/api/map',
            folders: '/api/folders',
            ui: '/ui'
        },
        documentation: '/api/docs'
    });
});

// Rota para a interface web
app.get('/ui', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware de tratamento de erros
app.use(errorHandler);

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Inicializar servidor
const server = app.listen(PORT, () => {
  logger.info(`🚀 Servidor DePara iniciado na porta ${PORT}`);
  logger.info(`📊 API disponível em: http://localhost:${PORT}`);
  logger.info(`🌐 Interface web disponível em: http://localhost:${PORT}/ui`);
  logger.info(`📚 Documentação da API: http://localhost:${PORT}/api/docs`);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  logger.error('Erro não capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promise rejeitada não tratada:', { reason, promise });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido, encerrando servidor...');
  server.close(() => {
    logger.info('Servidor encerrado com sucesso');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT recebido, encerrando servidor...');
  server.close(() => {
    logger.info('Servidor encerrado com sucesso');
    process.exit(0);
  });
});

module.exports = app;
