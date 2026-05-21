const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class Logger {
  constructor() {
    this.logFile = process.env.LOG_FILE || 'logs/app.log';
    this.currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] || LOG_LEVELS.info;
    this.logBuffer = [];
    this.bufferSize = Number(process.env.LOG_BUFFER_SIZE || 10);
    this.flushInterval = Number(process.env.LOG_FLUSH_INTERVAL || 5000);

    this.ensureLogDirectory();
    this.startBufferFlush();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  formatMessage(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...meta
    });
  }

  startBufferFlush() {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.flushInterval);

    if (typeof this.flushTimer.unref === 'function') {
      this.flushTimer.unref();
    }
  }

  stopBufferFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.flushBuffer();
  }

  addToBuffer(logEntry) {
    this.logBuffer.push(logEntry);

    if (this.logBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }
  }

  flushBuffer() {
    if (this.logBuffer.length === 0) {
      return;
    }

    try {
      this.ensureLogDirectory();
      fs.appendFileSync(this.logFile, `${this.logBuffer.join('\n')}\n`);
    } catch (error) {
      console.error('Erro ao escrever buffer no arquivo de log:', error);
    } finally {
      this.logBuffer = [];
    }
  }

  writeToConsole(level, message, meta = {}) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const metaStr = Object.keys(meta).length > 0
      ? ` ${COLORS.blue}${JSON.stringify(meta)}${COLORS.reset}`
      : '';

    const colorByLevel = {
      error: COLORS.red,
      warn: COLORS.yellow,
      info: COLORS.green,
      debug: COLORS.cyan
    };

    const color = colorByLevel[level] || COLORS.reset;
    console.log(`${color}[${timestamp}] [${level.toUpperCase()}]${COLORS.reset} ${message}${metaStr}`);
  }

  log(level, message, meta = {}) {
    if (LOG_LEVELS[level] > this.currentLevel) {
      return;
    }

    const logEntry = this.formatMessage(level, message, meta);
    this.addToBuffer(logEntry);
    this.writeToConsole(level, message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  startOperation(operation, meta = {}) {
    this.info(`Iniciando operacao: ${operation}`, {
      operation,
      startTime: new Date().toISOString(),
      ...meta
    });
  }

  endOperation(operation, duration, meta = {}) {
    this.info(`Operacao concluida: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      endTime: new Date().toISOString(),
      ...meta
    });
  }

  operationError(operation, error, meta = {}) {
    this.error(`Erro na operacao: ${operation}`, {
      operation,
      error: error.message,
      stack: error.stack,
      ...meta
    });
  }

  performance(operation, duration, meta = {}) {
    if (duration > 1000) {
      this.warn(`Operacao lenta detectada: ${operation}`, {
        operation,
        duration: `${duration}ms`,
        ...meta
      });
      return;
    }

    this.debug(`Operacao rapida: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...meta
    });
  }

  close() {
    this.stopBufferFlush();
  }
}

const logger = new Logger();

process.on('exit', () => {
  logger.close();
});

module.exports = logger;
