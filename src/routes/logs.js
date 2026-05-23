/**
 * Rotas para ingestao leve de logs do frontend.
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const ALLOWED_LEVELS = new Set(['error', 'warn', 'info', 'debug', 'success']);

router.post('/', async (req, res) => {
  try {
    const { level = 'info', message = '', meta = {}, timestamp } = req.body || {};
    const normalizedLevel = String(level).toLowerCase();
    const normalizedMessage = String(message).slice(0, 1000);

    if (!normalizedMessage) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Mensagem de log e obrigatoria'
        }
      });
    }

    if (!ALLOWED_LEVELS.has(normalizedLevel)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Nivel de log invalido'
        }
      });
    }

    const payload = {
      source: 'frontend',
      timestamp: timestamp || new Date().toISOString(),
      meta: typeof meta === 'object' && meta !== null ? meta : {}
    };

    if (normalizedLevel === 'error') logger.error(normalizedMessage, payload);
    else if (normalizedLevel === 'warn') logger.warn(normalizedMessage, payload);
    else if (normalizedLevel === 'debug') logger.debug(normalizedMessage, payload);
    else logger.info(normalizedMessage, payload);

    return res.status(202).json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Frontend Log Ingest', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao processar log'
      }
    });
  }
});

module.exports = router;
