/**
 * Rotas canonicas para atualizacao automatica do DePara.
 */

const express = require('express');
const logger = require('../utils/logger');
const updateOrchestrator = require('../services/updateOrchestrator');

const router = express.Router();

function respondLegacyRouteRemoved(res) {
  return res.status(410).json({
    success: false,
    error: {
      message: 'Endpoint legado de update removido. Use exclusivamente /api/update/auto/* ou PM2 no RP4.',
      reason: 'legacy_route_removed'
    }
  });
}

router.use(async (req, res, next) => {
  try {
    await updateOrchestrator.init();
    next();
  } catch (error) {
    logger.operationError('Update Init Middleware', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Falha ao inicializar sistema de atualizacao',
        details: error.message
      }
    });
  }
});

router.get('/check', (req, res) => respondLegacyRouteRemoved(res));
router.post('/apply', (req, res) => respondLegacyRouteRemoved(res));
router.post('/restart', (req, res) => respondLegacyRouteRemoved(res));
router.get('/status', (req, res) => respondLegacyRouteRemoved(res));

router.get('/auto/status', async (req, res) => {
  try {
    if (req.query.refresh === '1' || req.query.refresh === 'true') {
      await updateOrchestrator.checkForUpdates();
    }

    const status = await updateOrchestrator.getStatus();
    return res.status(200).json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Auto Update Status', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao obter status automatico',
        details: error.message
      }
    });
  }
});

router.post('/auto/check-now', async (req, res) => {
  try {
    const check = await updateOrchestrator.checkForUpdates();
    const status = await updateOrchestrator.getStatus();
    return res.status(200).json({
      success: true,
      data: {
        ...status,
        check
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Auto Update Check Now', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao executar checagem remota',
        details: error.message
      }
    });
  }
});

router.put('/auto/config', async (req, res) => {
  try {
    const config = await updateOrchestrator.updateConfig(req.body || {});
    return res.status(200).json({
      success: true,
      data: config,
      message: 'Configuracao de atualizacao automatica salva',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Auto Update Config', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao salvar configuracao automatica',
        details: error.message
      }
    });
  }
});

router.post('/auto/trigger', async (req, res) => {
  try {
    const trigger = await updateOrchestrator.startUpdateCycle({ reason: 'manual_trigger' });
    if (!trigger.started) {
      const statusCode = trigger.reason === 'not_operational' ? 412 : 409;
      return res.status(statusCode).json({
        success: false,
        error: {
          message: trigger.reason === 'not_operational'
            ? 'Runtime nao esta operacionalmente apto para auto-update'
            : 'Ciclo ja esta em execucao',
          reason: trigger.reason,
          diagnostics: trigger.diagnostics || null
        }
      });
    }

    return res.status(202).json({
      success: true,
      data: trigger,
      message: 'Ciclo automatico iniciado',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Auto Update Trigger', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao disparar ciclo automatico',
        details: error.message
      }
    });
  }
});

router.get('/auto/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = await updateOrchestrator.getHistory(limit);
    return res.status(200).json({
      success: true,
      data: history,
      count: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Auto Update History', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao carregar historico de atualizacao',
        details: error.message
      }
    });
  }
});

router.get('/auto/diagnostics', async (req, res) => {
  try {
    const diagnostics = await updateOrchestrator.getDiagnostics();
    return res.status(200).json({
      success: true,
      data: diagnostics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Auto Update Diagnostics', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao coletar diagnostico do auto-update',
        details: error.message
      }
    });
  }
});

module.exports = router;
