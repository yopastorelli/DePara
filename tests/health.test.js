/**
 * Testes para Rotas de Health da API DePara
 *
 * @author yopastorelli
 * @version 1.0.0
 */

const request = require('supertest');
const path = require('path');

// Mock do logger para testes
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  operationError: jest.fn(),
  performance: jest.fn(),
  startOperation: jest.fn(),
  endOperation: jest.fn()
}));

// Mock do fileOperations para testes
jest.mock('../src/utils/fileOperations', () => ({
  getStats: jest.fn(() => ({
    scheduledOperations: 0,
    totalOperations: 0,
    backupEnabled: true,
    backupDir: '/tmp/backups',
    retentionDays: 30
  })),
  getActiveOperations: jest.fn(() => []),
  getScheduledOperations: jest.fn(() => [])
}));

// Mock do folderManager para testes
jest.mock('../src/config/folders', () => ({
  getFolders: jest.fn(() => []),
  getFolder: jest.fn(() => null)
}));

// Mock do dotenv
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

let app;

beforeAll(() => {
  // Importar app após os mocks
  app = require('../src/main');
});

afterAll(async () => {
  // Limpar recursos após testes
  if (app && app.close) {
    await new Promise(resolve => app.close(resolve));
  }
});

describe('Health Check Endpoints', () => {
  describe('GET /api/health', () => {
    it('deve retornar status 200 e informações básicas de saúde', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
      expect(response.body.memory).toBeDefined();
      expect(response.body.system).toBeDefined();
    });

    it('deve incluir informações de memória válidas', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.memory).toBeDefined();
      expect(typeof response.body.memory.used).toBe('number');
      expect(typeof response.body.memory.total).toBe('number');
    });

    it('deve incluir informações do sistema válidas', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.system).toBeDefined();
      expect(typeof response.body.system.cpuCount).toBe('number');
      expect(Array.isArray(response.body.system.loadAverage)).toBe(true);
    });
  });

  describe('GET /api/health/detailed', () => {
    it('deve retornar status 200 e informações detalhadas de saúde', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.application).toBeDefined();
      expect(response.body.memory).toBeDefined();
      expect(response.body.system).toBeDefined();
      expect(response.body.network).toBeDefined();
    });

    it('deve incluir informações detalhadas da aplicação', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.application).toHaveProperty('name', 'DePara');
      expect(response.body.application).toHaveProperty('version');
      expect(response.body.application).toHaveProperty('uptime');
      expect(response.body.application).toHaveProperty('environment');
      expect(typeof response.body.application.pid).toBe('number');
    });

    it('deve incluir informações detalhadas de memória', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(typeof response.body.memory.heapUsed).toBe('number');
      expect(typeof response.body.memory.heapTotal).toBe('number');
      expect(typeof response.body.memory.external).toBe('number');
      expect(typeof response.body.memory.rss).toBe('number');
    });
  });

  describe('GET /api/health/connectivity', () => {
    it('deve retornar status 200 e informações de conectividade', async () => {
      const response = await request(app)
        .get('/api/health/connectivity')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.checks).toBeDefined();
      expect(response.body.summary).toBeDefined();
    });

    it('deve incluir verificações de conectividade válidas', async () => {
      const response = await request(app)
        .get('/api/health/connectivity')
        .expect(200);

      expect(response.body.checks.fileSystem).toBeDefined();
      expect(response.body.checks.memory).toBeDefined();
      expect(response.body.checks.process).toBeDefined();

      expect(response.body.checks.fileSystem.status).toBeDefined();
      expect(response.body.checks.memory.status).toBeDefined();
      expect(response.body.checks.process.status).toBeDefined();
    });
  });
});
