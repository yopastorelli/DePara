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
const fs = require('fs');
require('dotenv').config();

// Carregar informações do package.json de forma segura
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

// Importar módulos da aplicação
const logger = require('./utils/logger');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { readRateLimiter, normalRateLimiter, strictRateLimiter } = require('./middleware/rateLimiter');
const fs = require('fs').promises;

// Configurações da aplicação
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Inicializa diretórios necessários para a aplicação
 */
async function initializeDirectories() {
    const directories = [
        'logs',
        'backups',
        'temp',
        'public/uploads',
        'public/downloads'
    ];

    console.log('🔧 Inicializando diretórios da aplicação...');

    for (const dir of directories) {
        try {
            await fs.access(dir);
            console.log(`✅ Diretório existe: ${dir}`);
        } catch {
            await fs.mkdir(dir, { recursive: true });
            console.log(`📁 Diretório criado: ${dir}`);
        }
    }

    console.log('🎯 Inicialização de diretórios concluída!\n');
}

// Inicializar aplicação Express
const app = express();

// Middleware de segurança simplificado para uso local
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      // Removido upgradeInsecureRequests para desenvolvimento local
    },
  },
  // Desabilitar HSTS para desenvolvimento local
  hsts: false,
  // Simplificar outras configurações
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true
}));

// Middleware de CORS removido - aplicação roda apenas localmente
// Não há necessidade de CORS para uso local no Raspberry Pi

// Rate limiting para todas as rotas
app.use('/api', readRateLimiter); // Rate limiting permissivo para leitura

// Middleware de parsing com limites adequados para processamento local
const MAX_PAYLOAD = process.env.MAX_PAYLOAD || '100mb'; // Muito maior para dados locais
app.use(express.json({ limit: MAX_PAYLOAD }));
app.use(express.urlencoded({ extended: true, limit: MAX_PAYLOAD }));

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
    version: packageInfo.version
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
            files: '/api/files',
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
async function startServer() {
    try {
        // Inicializar diretórios necessários
        await initializeDirectories();

        // Iniciar servidor
        const server = app.listen(PORT, () => {
            logger.info(`🚀 Servidor DePara iniciado na porta ${PORT}`);
            logger.info(`📊 API disponível em: http://localhost:${PORT}`);
            logger.info(`🌐 Interface web disponível em: http://localhost:${PORT}/ui`);
            logger.info(`📚 Documentação da API: http://localhost:${PORT}/api/docs`);
        });

        return server;
    } catch (error) {
        console.error('❌ Erro crítico durante inicialização:', error);
        process.exit(1);
    }
}

// Iniciar aplicação
startServer();

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
