/**
 * Rota de Persistência de Configurações do Cliente
 * Salva/carrega configurações em arquivo JSON no servidor,
 * garantindo que as configs sobrevivam a resets de localStorage.
 *
 * GET  /api/config       — lê todas as configurações salvas
 * POST /api/config       — salva { key, value } no arquivo
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const CONFIG_FILE = path.join(__dirname, '../../data/depara-config.json');

function readConfig() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
        return {};
    }
}

// GET /api/config — retorna todas as configurações salvas
router.get('/', (req, res) => {
    res.json({ success: true, config: readConfig() });
});

// POST /api/config — { key: string, value: any }
router.post('/', (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || typeof key !== 'string') {
            return res.status(400).json({ success: false, error: 'key obrigatório' });
        }
        const config = readConfig();
        config[key] = value;
        fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        res.json({ success: true });
    } catch (err) {
        logger.error('Erro ao salvar config', { error: err.message });
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
