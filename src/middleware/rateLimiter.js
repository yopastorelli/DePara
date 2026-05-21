const logger = require('../utils/logger');

const requestStore = new Map();

class RateLimitError extends Error {
  constructor(message, resetTime) {
    super(message);
    this.name = 'RateLimitError';
    this.resetTime = resetTime;
  }
}

const rateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    maxRequests = 100,
    keyGenerator = (req) => req.ip,
    handler = null
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!requestStore.has(key)) {
      requestStore.set(key, {
        requests: [],
        lastReset: now
      });
    }

    const record = requestStore.get(key);
    record.lastReset = now;
    record.requests = record.requests.filter((timestamp) => now - timestamp < windowMs);

    if (record.requests.length >= maxRequests) {
      const resetTime = record.requests[0] + windowMs;
      const remainingTime = Math.ceil((resetTime - now) / 1000);
      const error = new RateLimitError(
        `Rate limit excedido. Tente novamente em ${remainingTime} segundos.`,
        resetTime
      );

      logger.warn('Rate limit excedido', {
        ip: key,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        remainingTime
      });

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

    record.requests.push(now);

    const remainingRequests = Math.max(0, maxRequests - record.requests.length);
    const resetTime = record.requests.length > 0 ? record.requests[0] + windowMs : now + windowMs;

    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': remainingRequests,
      'X-RateLimit-Reset': new Date(resetTime).toISOString()
    });

    return next();
  };
};

const cleanupOldRecords = () => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000;

  for (const [key, record] of requestStore.entries()) {
    if (now - record.lastReset > maxAge) {
      requestStore.delete(key);
    }
  }
};

const cleanupInterval = setInterval(cleanupOldRecords, 30 * 60 * 1000);
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

const strictRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 20,
  keyGenerator: (req) => `${req.ip}:${req.path}`
});

const normalRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100
});

const readRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 200
});

const slideshowRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 500
});

module.exports = {
  rateLimiter,
  strictRateLimiter,
  normalRateLimiter,
  readRateLimiter,
  slideshowRateLimiter,
  RateLimitError,
  resetRateLimiterStore: () => requestStore.clear(),
  stopRateLimiterCleanup: () => clearInterval(cleanupInterval)
};
