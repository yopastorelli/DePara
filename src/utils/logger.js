/**
 * Sistema de Logging Estruturado para DePara
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// Configurações de logging
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FILE = process.env.LOG_FILE || 'logs/app.log';

// Níveis de log em ordem de prioridade
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Cores para console (Windows PowerShell)
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Classe Logger para gerenciar logs estruturados
 */
class Logger {
  constructor() {
    this.ensureLogDirectory();
    this.currentLevel = LOG_LEVELS[LOG_LEVEL] || LOG_LEVELS.info;
  }

  /**
   * Garante que o diretório de logs existe
   */
  ensureLogDirectory() {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Formata a mensagem de log
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    return JSON.stringify(logEntry);
  }

  /**
   * Escreve no arquivo de log
   */
  writeToFile(logEntry) {
    try {
      fs.appendFileSync(LOG_FILE, logEntry + '\n');
    } catch (error) {
      console.error('Erro ao escrever no arquivo de log:', error);
    }
  }

  /**
   * Escreve no console com cores
   */
  writeToConsole(level, message, meta = {}) {
    const timestamp = new Date().toLocaleString('pt-BR');
    let color = COLORS.reset;
    
    switch (level) {
      case 'error':
        color = COLORS.red;
        break;
      case 'warn':
        color = COLORS.yellow;
        break;
      case 'info':
        color = COLORS.green;
        break;
      case 'debug':
        color = COLORS.cyan;
        break;
    }

    const metaStr = Object.keys(meta).length > 0 
      ? ` ${COLORS.blue}${JSON.stringify(meta)}${COLORS.reset}`
      : '';

    console.log(`${color}[${timestamp}] [${level.toUpperCase()}]${COLORS.reset} ${message}${metaStr}`);
  }

  /**
   * Método principal de logging
   */
  log(level, message, meta = {}) {
    if (LOG_LEVELS[level] <= this.currentLevel) {
      const logEntry = this.formatMessage(level, message, meta);
      
      // Escrever no arquivo
      this.writeToFile(logEntry);
      
      // Escrever no console
      this.writeToConsole(level, message, meta);
    }
  }

  /**
   * Log de erro
   */
  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  /**
   * Log de aviso
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  /**
   * Log de informação
   */
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  /**
   * Log de debug
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * Log de início de operação
   */
  startOperation(operation, meta = {}) {
    this.info(`🚀 Iniciando operação: ${operation}`, {
      operation,
      startTime: new Date().toISOString(),
      ...meta
    });
  }

  /**
   * Log de conclusão de operação
   */
  endOperation(operation, duration, meta = {}) {
    this.info(`✅ Operação concluída: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      endTime: new Date().toISOString(),
      ...meta
    });
  }

  /**
   * Log de erro em operação
   */
  operationError(operation, error, meta = {}) {
    this.error(`❌ Erro na operação: ${operation}`, {
      operation,
      error: error.message,
      stack: error.stack,
      ...meta
    });
  }

  /**
   * Log de performance
   */
  performance(operation, duration, meta = {}) {
    if (duration > 1000) {
      this.warn(`⚠️  Operação lenta detectada: ${operation}`, {
        operation,
        duration: `${duration}ms`,
        ...meta
      });
    } else {
      this.debug(`⚡ Operação rápida: ${operation}`, {
        operation,
        duration: `${duration}ms`,
        ...meta
      });
    }
  }
}

// Instância singleton do logger
const logger = new Logger();

module.exports = logger;
