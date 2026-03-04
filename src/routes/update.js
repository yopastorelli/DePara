/**
 * Rotas para atualização automática do DePara.
 */

const express = require('express');
const logger = require('../utils/logger');
const updateOrchestrator = require('../services/updateOrchestrator');

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    await updateOrchestrator.init();
    next();
  } catch (error) {
    logger.operationError('Update Init Middleware', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Falha ao inicializar sistema de atualização',
        details: error.message
      }
    });
  }
});

/**
 * Legacy: GET /api/update/check
 */
router.get('/check', async (req, res) => {
  try {
    const check = await updateOrchestrator.checkForUpdates();
    res.status(200).json({
      success: true,
      data: {
        hasUpdates: check.hasUpdates,
        commitsAhead: check.commitsAhead,
        currentVersion: check.currentCommit ? check.currentCommit.slice(0, 8) : 'unknown',
        targetVersion: check.targetCommit ? check.targetCommit.slice(0, 8) : 'unknown',
        lastChecked: new Date().toISOString(),
        message: check.hasUpdates
          ? `Há ${check.commitsAhead} atualização(ões) disponível(is)`
          : 'DePara está atualizado'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Update Check', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao verificar atualizações',
        details: error.message
      }
    });
  }
});

/**
 * Legacy: POST /api/update/apply
 * Inicia ciclo completo automático e retorna imediatamente.
 */
router.post('/apply', async (req, res) => {
  try {
    const trigger = await updateOrchestrator.startUpdateCycle({ reason: 'manual_apply' });
    if (!trigger.started) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Ciclo de atualização já está em execução',
          reason: trigger.reason
        }
      });
    }

    return res.status(202).json({
      success: true,
      message: 'Ciclo automático iniciado com sucesso',
      data: {
        runId: trigger.runId
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Update Apply', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao iniciar atualização automática',
        details: error.message
      }
    });
  }
});

/**
 * Legacy: POST /api/update/restart
 */
router.post('/restart', async (req, res) => {
  try {
    setTimeout(() => {
      updateOrchestrator.requestRestart().catch((error) => {
        logger.operationError('Manual Restart', error);
      });
    }, 250);

    return res.status(202).json({
      success: true,
      message: 'Reinício solicitado',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Update Restart', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao solicitar reinício',
        details: error.message
      }
    });
  }
});

/**
 * Legacy: GET /api/update/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await updateOrchestrator.getStatus();
    return res.status(200).json({
      success: true,
      data: {
        ...status.state,
        config: status.config
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Update Status', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao obter status de atualização',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/update/auto/status
 */
router.get('/auto/status', async (req, res) => {
  try {
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
        message: 'Erro ao obter status automático',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/update/auto/config
 */
router.put('/auto/config', async (req, res) => {
  try {
    const config = await updateOrchestrator.updateConfig(req.body || {});
    return res.status(200).json({
      success: true,
      data: config,
      message: 'Configuração de atualização automática salva',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Auto Update Config', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao salvar configuração automática',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/update/auto/trigger
 */
router.post('/auto/trigger', async (req, res) => {
  try {
    const trigger = await updateOrchestrator.startUpdateCycle({ reason: 'manual_trigger' });
    if (!trigger.started) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Ciclo já está em execução',
          reason: trigger.reason
        }
      });
    }

    return res.status(202).json({
      success: true,
      data: trigger,
      message: 'Ciclo automático iniciado',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.operationError('Auto Update Trigger', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro ao disparar ciclo automático',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/update/auto/history
 */
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
        message: 'Erro ao carregar histórico de atualização',
        details: error.message
      }
    });
  }
});

module.exports = router;
