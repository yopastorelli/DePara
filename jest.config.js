/**
 * Configuração do Jest para DePara
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

module.exports = {
  // Diretório raiz dos testes
  testEnvironment: 'node',
  
  // Diretórios onde procurar por testes
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Diretórios a serem ignorados
  testPathIgnorePatterns: [
    '/node_modules/',
    '/logs/',
    '/dist/',
    '/build/'
  ],
  
  // Arquivos de setup
  setupFilesAfterEnv: [],
  
  // Timeout para testes
  testTimeout: 10000,
  
  // Cobertura de código
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],
  
  // Diretório de cobertura
  coverageDirectory: 'coverage',
  
  // Tipos de cobertura
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // Limite de cobertura
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Verbose
  verbose: true,
  
  // Configurações específicas para Node.js
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  
  // Transformações
  transform: {},
  
  // Extensões de arquivo
  moduleFileExtensions: ['js', 'json'],
  
  // Configurações de ambiente
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  }
};
