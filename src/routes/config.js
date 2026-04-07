/**
 * Rota de persistencia de configuracoes funcionais da UI.
 * GET  /api/config
 * POST /api/config
 */

const express = require('express');
const logger = require('../utils/logger');
const configStore = require('../utils/configStore');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const config = await configStore.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    logger.error('Erro ao carregar config', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { key, value, config, ...partialConfig } = req.body || {};

    let savedConfig;
    if (key && typeof key === 'string') {
      savedConfig = await configStore.setConfigValue(key, value);
    } else if (config && typeof config === 'object' && !Array.isArray(config)) {
      savedConfig = await configStore.updateConfig(config);
    } else if (Object.keys(partialConfig).length > 0) {
      savedConfig = await configStore.updateConfig(partialConfig);
    } else {
      return res.status(400).json({ success: false, error: 'payload obrigatorio' });
    }

    res.json({ success: true, config: savedConfig });
  } catch (error) {
    logger.error('Erro ao salvar config', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
