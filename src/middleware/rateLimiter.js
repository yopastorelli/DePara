/**
 * Middleware de Rate Limiting para DePara
 * Sistema básico de controle de taxa de requisições por IP
 *
 * @author yopastorelli
 * @version 1.0.0
 */

const logger = require('../utils/logger');

// Armazenamento em memória para IPs e suas requisições
const requestStore = new Map();

/**
 * Classe de erro para rate limiting
 */
class RateLimitError extends Error {
  constructor(message, resetTime) {
    super(message);
    this.name = 'RateLimitError';
    this.resetTime = resetTime;
  }
}

/**
 * Middleware de rate limiting
 */
const rateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutos
    maxRequests = 100, // Máximo de requisições por janela
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req) => req.ip,
    handler = null
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Obter ou criar registro para este IP
    if (!requestStore.has(key)) {
      requestStore.set(key, {
        requests: [],
        lastReset: now
      });
    }

    const record = requestStore.get(key);

    // Limpar requisições antigas
    record.requests = record.requests.filter(timestamp => now - timestamp < windowMs);

    // Verificar se excedeu o limite
    if (record.requests.length >= maxRequests) {
      const resetTime = record.requests[0] + windowMs;
      const remainingTime = Math.ceil((resetTime - now) / 1000);

      const error = new RateLimitError(
        `Rate limit excedido. Tente novamente em ${remainingTime} segundos.`,
        resetTime
      );

      // Log do rate limit
      logger.warn('Rate limit excedido', {
        ip: key,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        remainingTime
      });

      // Usar handler customizado ou enviar erro padrão
      if (handler) {
        return handler(req, res, next, error);
      }

      return res.status(429).json({
        error: {
          message: error.message,
          statusCode: 429,
          resetTime: new Date(resetTime).toISOString(),
          retryAfter: remainingTime,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Registrar esta requisição
    record.requests.push(now);

    // Adicionar headers informativos
    const remainingRequests = Math.max(0, maxRequests - record.requests.length);
    const resetTime = record.requests.length > 0 ? record.requests[0] + windowMs : now + windowMs;

    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': remainingRequests,
      'X-RateLimit-Reset': new Date(resetTime).toISOString()
    });

    next();
  };
};

/**
 * Limpeza periódica do armazenamento
 * Remove registros antigos para evitar vazamento de memória
 */
const cleanupOldRecords = () => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hora

  for (const [key, record] of requestStore.entries()) {
    // Remover registros com mais de 1 hora sem atividade
    if (now - record.lastReset > maxAge) {
      requestStore.delete(key);
    }
  }
};

// Executar limpeza a cada 30 minutos
setInterval(cleanupOldRecords, 30 * 60 * 1000);

// Middleware específico para operações críticas
const strictRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutos
  maxRequests: 20, // 20 requisições por 5 minutos
  keyGenerator: (req) => `${req.ip}:${req.path}`
});

// Middleware para operações normais
const normalRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 100 // 100 requisições por 15 minutos
});

// Middleware permissivo para leitura
const readRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 60 // 60 requisições por minuto
});

module.exports = {
  rateLimiter,
  strictRateLimiter,
  normalRateLimiter,
  readRateLimiter,
  RateLimitError
};
