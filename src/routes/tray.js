/**
 * Routes for tray and dedicated browser windows.
 */

const express = require('express');
const os = require('os');
const path = require('path');
const { exec, spawn } = require('child_process');
const logger = require('../utils/logger');

const router = express.Router();

const SCREEN_SAVER_PROFILE_DIR = path.join(os.tmpdir(), 'depara-screensaver-browser');
const SCREEN_SAVER_ROUTE = '/?screensaver=1&dedicated=1';

const dedicatedScreensaverState = {
    pid: null,
    browser: null,
    sessionId: null,
    openedAt: null,
    trayMinimized: false,
    armed: false,
    armTimeoutId: null,
    armDueAt: null
};

function commandExists(command) {
    return new Promise((resolve) => {
        exec(`where.exe ${command}`, (error, stdout) => {
            resolve(!error && Boolean(stdout.trim()));
        });
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasGraphicalSession() {
    return true;
}

function buildDesktopEnv() {
    return { ...process.env };
}

function getBrowserCandidates(targetUrl, options = {}) {
    const kiosk = options.kiosk === true;
    const profile = options.profileDir || path.join(os.tmpdir(), 'depara-browser');
    const commonChromiumArgs = [
        '--new-window',
        `--app=${targetUrl}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        `--user-data-dir=${profile}`
    ];
    if (kiosk) {
        commonChromiumArgs.push('--start-fullscreen');
        commonChromiumArgs.push('--kiosk');
    }

    return [
        {
            binary: 'msedge.exe',
            name: 'Microsoft Edge',
            args: commonChromiumArgs
        },
        {
            binary: 'chrome.exe',
            name: 'Google Chrome',
            args: commonChromiumArgs
        },
        {
            binary: 'chromium.exe',
            name: 'Chromium',
            args: commonChromiumArgs
        },
        {
            binary: 'firefox.exe',
            name: 'Firefox',
            args: kiosk ? ['--kiosk', targetUrl] : ['--new-window', targetUrl]
        }
    ];
}

async function resolveBrowserLaunch(targetUrl, options = {}) {
    const candidates = getBrowserCandidates(targetUrl, options);
    for (const candidate of candidates) {
        const exists = await commandExists(candidate.binary);
        if (exists) return candidate;
    }
    return null;
}

function spawnDetachedBrowser(launchConfig) {
    const child = spawn(launchConfig.binary, launchConfig.args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: buildDesktopEnv()
    });
    child.unref();
    return child;
}

function isProcessRunning(pid) {
    if (!pid) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function clearDedicatedScreensaverState() {
    dedicatedScreensaverState.pid = null;
    dedicatedScreensaverState.browser = null;
    dedicatedScreensaverState.sessionId = null;
    dedicatedScreensaverState.openedAt = null;
}

function disarmDedicatedScreensaver() {
    if (dedicatedScreensaverState.armTimeoutId) {
        clearTimeout(dedicatedScreensaverState.armTimeoutId);
        dedicatedScreensaverState.armTimeoutId = null;
    }
    dedicatedScreensaverState.armed = false;
    dedicatedScreensaverState.armDueAt = null;
}

async function closeDedicatedScreensaverProcess() {
    if (!isProcessRunning(dedicatedScreensaverState.pid)) {
        clearDedicatedScreensaverState();
    } else {
        try {
            process.kill(dedicatedScreensaverState.pid, 'SIGTERM');
        } catch {
            // Ignore and proceed with fallback.
        }

        await sleep(300);

        if (isProcessRunning(dedicatedScreensaverState.pid)) {
            try {
                process.kill(dedicatedScreensaverState.pid, 'SIGKILL');
            } catch {
                // Ignore and proceed with fallback.
            }
        }

        clearDedicatedScreensaverState();
    }
}

/**
 * Minimize app to tray.
 * POST /api/tray/minimize
 */
router.post('/minimize', async (req, res) => {
    try {
        logger.info('Minimizando aplicacao para system tray...');
        dedicatedScreensaverState.trayMinimized = true;
        res.status(200).json({
            success: true,
            message: 'Estado de tray registrado no processo Windows',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.warn('Erro ao minimizar para system tray', { error: error.message });
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao minimizar para system tray',
                details: error.message
            }
        });
    }
});

/**
 * Restore app from tray.
 * POST /api/tray/restore
 */
router.post('/restore', async (req, res) => {
    try {
        logger.info('Restaurando aplicacao do system tray...');
        dedicatedScreensaverState.trayMinimized = false;
        disarmDedicatedScreensaver();
        res.status(200).json({
            success: true,
            message: 'Estado de tray restaurado no processo Windows',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.warn('Erro ao restaurar do system tray', { error: error.message });
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao restaurar do system tray',
                details: error.message
            }
        });
    }
});

/**
 * Open app in dedicated window.
 * POST /api/tray/open-dedicated
 */
router.post('/open-dedicated', async (req, res) => {
    try {
        const port = process.env.PORT || 3000;
        const targetUrl = `http://127.0.0.1:${port}`;

        const launchConfig = await resolveBrowserLaunch(targetUrl, {
            kiosk: false,
            profileDir: path.join(os.tmpdir(), 'depara-browser')
        });

        if (!launchConfig) {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Nenhum navegador compativel encontrado'
                }
            });
            return;
        }

        spawnDetachedBrowser(launchConfig);
        res.status(200).json({
            success: true,
            message: 'Aplicacao aberta em janela dedicada',
            browser: launchConfig.name,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.warn('Erro ao abrir janela dedicada', { error: error.message });
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao abrir janela dedicada',
                details: error.message
            }
        });
    }
});

/**
 * Open dedicated screensaver fullscreen window.
 * POST /api/tray/screensaver/open
 */
router.post('/screensaver/open', async (req, res) => {
    try {
        disarmDedicatedScreensaver();
        if (isProcessRunning(dedicatedScreensaverState.pid)) {
            res.status(200).json({
                success: true,
                already_open: true,
                data: {
                    sessionId: dedicatedScreensaverState.sessionId,
                    pid: dedicatedScreensaverState.pid,
                    openedAt: dedicatedScreensaverState.openedAt
                },
                timestamp: new Date().toISOString()
            });
            return;
        }

        clearDedicatedScreensaverState();

        if (!dedicatedScreensaverState.trayMinimized) {
            res.status(200).json({
                success: true,
                skipped: true,
                data: {
                    reason: 'tray_not_minimized'
                },
                timestamp: new Date().toISOString()
            });
            return;
        }

        const port = process.env.PORT || 3000;
        const targetUrl = `http://127.0.0.1:${port}${SCREEN_SAVER_ROUTE}`;
        const launchConfig = await resolveBrowserLaunch(targetUrl, {
            kiosk: true,
            profileDir: SCREEN_SAVER_PROFILE_DIR
        });

        if (!launchConfig) {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Nenhum navegador compativel encontrado para screensaver dedicado'
                }
            });
            return;
        }

        const child = spawnDetachedBrowser(launchConfig);
        dedicatedScreensaverState.pid = child.pid;
        dedicatedScreensaverState.browser = launchConfig.name;
        dedicatedScreensaverState.sessionId = `ss_${Date.now()}`;
        dedicatedScreensaverState.openedAt = new Date().toISOString();

        logger.info('Screensaver dedicado aberto', {
            sessionId: dedicatedScreensaverState.sessionId,
            pid: dedicatedScreensaverState.pid,
            browser: dedicatedScreensaverState.browser
        });

        res.status(200).json({
            success: true,
            already_open: false,
            data: {
                sessionId: dedicatedScreensaverState.sessionId,
                pid: dedicatedScreensaverState.pid,
                browser: dedicatedScreensaverState.browser,
                openedAt: dedicatedScreensaverState.openedAt
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.warn('Erro ao abrir screensaver dedicado', { error: error.message });
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao abrir screensaver dedicado',
                details: error.message
            }
        });
    }
});

/**
 * Arm dedicated screensaver open after idle period.
 * POST /api/tray/screensaver/arm
 */
router.post('/screensaver/arm', async (req, res) => {
    try {
        const idleMinutes = Math.max(1, Number(req.body?.idleMinutes) || 3);
        if (!dedicatedScreensaverState.trayMinimized) {
            disarmDedicatedScreensaver();
            res.status(200).json({
                success: true,
                skipped: true,
                data: {
                    armed: false,
                    reason: 'tray_not_minimized'
                },
                timestamp: new Date().toISOString()
            });
            return;
        }
        disarmDedicatedScreensaver();
        dedicatedScreensaverState.armed = true;
        dedicatedScreensaverState.armDueAt = new Date(Date.now() + idleMinutes * 60 * 1000).toISOString();
        dedicatedScreensaverState.armTimeoutId = setTimeout(async () => {
            try {
                if (isProcessRunning(dedicatedScreensaverState.pid)) {
                    disarmDedicatedScreensaver();
                    return;
                }
                const port = process.env.PORT || 3000;
                const targetUrl = `http://127.0.0.1:${port}${SCREEN_SAVER_ROUTE}`;
                const launchConfig = await resolveBrowserLaunch(targetUrl, {
                    kiosk: true,
                    profileDir: SCREEN_SAVER_PROFILE_DIR
                });
                if (!launchConfig) {
                    logger.warn('Nao foi possivel abrir screensaver dedicado: browser nao encontrado');
                    disarmDedicatedScreensaver();
                    return;
                }
                const child = spawnDetachedBrowser(launchConfig);
                dedicatedScreensaverState.pid = child.pid;
                dedicatedScreensaverState.browser = launchConfig.name;
                dedicatedScreensaverState.sessionId = `ss_${Date.now()}`;
                dedicatedScreensaverState.openedAt = new Date().toISOString();
                logger.info('Screensaver dedicado aberto por arm timer', {
                    sessionId: dedicatedScreensaverState.sessionId,
                    pid: dedicatedScreensaverState.pid
                });
            } catch (error) {
                logger.warn('Falha ao abrir screensaver dedicado via arm timer', { error: error.message });
            } finally {
                disarmDedicatedScreensaver();
            }
        }, idleMinutes * 60 * 1000);

        res.status(200).json({
            success: true,
            data: {
                armed: true,
                idleMinutes,
                dueAt: dedicatedScreensaverState.armDueAt
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao armar screensaver dedicado',
                details: error.message
            }
        });
    }
});

/**
 * Disarm dedicated screensaver open timer.
 * POST /api/tray/screensaver/disarm
 */
router.post('/screensaver/disarm', async (req, res) => {
    disarmDedicatedScreensaver();
    res.status(200).json({
        success: true,
        data: {
            armed: false
        },
        timestamp: new Date().toISOString()
    });
});

/**
 * Request browser-managed maximization on Windows.
 * POST /api/tray/maximize
 */
router.post('/maximize', async (req, res) => {
    res.json({ success: true, message: 'Maximizacao gerenciada pelo navegador Windows' });
});

/**
 * Close dedicated screensaver window.
 * POST /api/tray/screensaver/close
 */
router.post('/screensaver/close', async (req, res) => {
    try {
        disarmDedicatedScreensaver();
        const wasOpen = isProcessRunning(dedicatedScreensaverState.pid);
        await closeDedicatedScreensaverProcess();
        dedicatedScreensaverState.trayMinimized = false;

        logger.info('Screensaver dedicado fechado', { wasOpen });
        res.status(200).json({
            success: true,
            already_closed: !wasOpen,
            message: wasOpen ? 'Screensaver dedicado fechado' : 'Screensaver dedicado ja estava fechado',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.warn('Erro ao fechar screensaver dedicado', { error: error.message });
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao fechar screensaver dedicado',
                details: error.message
            }
        });
    }
});

/**
 * Check tray status.
 * GET /api/tray/status
 */
router.get('/status', async (req, res) => {
    try {
        const dedicatedActive = isProcessRunning(dedicatedScreensaverState.pid);
        if (!dedicatedActive && dedicatedScreensaverState.pid) {
            clearDedicatedScreensaverState();
        }

        res.status(200).json({
            success: true,
            data: {
                windowControl: 'browser-managed',
                graphicalSession: hasGraphicalSession(),
                trayMinimized: dedicatedScreensaverState.trayMinimized,
                screensaverDedicatedActive: dedicatedActive,
                screensaverSessionId: dedicatedScreensaverState.sessionId,
                screensaverArmed: dedicatedScreensaverState.armed,
                screensaverArmDueAt: dedicatedScreensaverState.armDueAt
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.warn('Erro ao verificar status do tray', { error: error.message });
        res.status(500).json({
            success: false,
            error: {
                message: 'Erro ao verificar status do tray',
                details: error.message
            }
        });
    }
});

module.exports = router;
