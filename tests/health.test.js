/**
 * Testes para Rotas de Health da API DePara
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const request = require('supertest');
const app = require('../src/main');

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
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('system');
    });

    it('deve incluir informações de memória válidas', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.memory).toHaveProperty('used');
      expect(response.body.memory).toHaveProperty('total');
      expect(response.body.memory).toHaveProperty('external');
      expect(typeof response.body.memory.used).toBe('number');
      expect(typeof response.body.memory.total).toBe('number');
    });

    it('deve incluir informações do sistema válidas', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.system).toHaveProperty('platform');
      expect(response.body.system).toHaveProperty('arch');
      expect(response.body.system).toHaveProperty('nodeVersion');
      expect(response.body.system).toHaveProperty('cpuCount');
      expect(response.body.system).toHaveProperty('loadAverage');
    });
  });

  describe('GET /api/health/detailed', () => {
    it('deve retornar status 200 e informações detalhadas de saúde', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('application');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('network');
    });

    it('deve incluir informações detalhadas da aplicação', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.application).toHaveProperty('name', 'DePara');
      expect(response.body.application).toHaveProperty('version');
      expect(response.body.application).toHaveProperty('uptime');
      expect(response.body.application).toHaveProperty('environment');
      expect(response.body.application).toHaveProperty('pid');
    });

    it('deve incluir informações detalhadas de memória', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.memory).toHaveProperty('heapUsed');
      expect(response.body.memory).toHaveProperty('heapTotal');
      expect(response.body.memory).toHaveProperty('external');
      expect(response.body.memory).toHaveProperty('rss');
      expect(response.body.memory).toHaveProperty('arrayBuffers');
    });
  });

  describe('GET /api/health/connectivity', () => {
    it('deve retornar status 200 e informações de conectividade', async () => {
      const response = await request(app)
        .get('/api/health/connectivity')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('summary');
    });

    it('deve incluir verificações de conectividade válidas', async () => {
      const response = await request(app)
        .get('/api/health/connectivity')
        .expect(200);

      expect(response.body.checks).toHaveProperty('fileSystem');
      expect(response.body.checks).toHaveProperty('memory');
      expect(response.body.checks).toHaveProperty('process');

      expect(response.body.checks.fileSystem).toHaveProperty('status');
      expect(response.body.checks.memory).toHaveProperty('status');
      expect(response.body.checks.process).toHaveProperty('status');
    });
  });
});
