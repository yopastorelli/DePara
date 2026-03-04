const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const logger = require('../utils/logger');

function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(stderr || error.message || `Command failed: ${command}`);
        err.command = command;
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
    });
  });
}

class UpdateOrchestrator {
  constructor() {
    this.repoRoot = path.resolve(__dirname, '../..');
    this.dataDir = path.join(this.repoRoot, 'src', 'data');
    this.configPath = path.join(this.dataDir, 'update-config.json');
    this.statePath = path.join(this.dataDir, 'update-state.json');
    this.historyPath = path.join(this.dataDir, 'update-history.log');
    this.lockPath = path.join(this.dataDir, 'update.lock');

    this.config = null;
    this.state = null;
    this.timer = null;
    this.isInitialized = false;
    this.isRunning = false;
  }

  getDefaultConfig() {
    return {
      enabled: true,
      autoApply: true,
      checkIntervalMinutes: 60,
      healthTimeoutMs: 3000,
      healthRetries: 5,
      installCommand: 'npm ci --omit=dev',
      fallbackInstallCommand: 'npm install --production',
      maxConsecutiveFailures: 3
    };
  }

  getDefaultState() {
    return {
      status: 'idle',
      currentCommit: null,
      targetCommit: null,
      previousCommit: null,
      lastRunAt: null,
      lastSuccessAt: null,
      lastCheckAt: null,
      lastError: null,
      rollbackPerformed: false,
      consecutiveFailures: 0,
      restartRequestedAt: null
    };
  }

  async init() {
    if (this.isInitialized) return;

    await fs.mkdir(this.dataDir, { recursive: true });
    await this.ensureFile(this.configPath, this.getDefaultConfig());
    await this.ensureFile(this.statePath, this.getDefaultState());
    await this.ensureFile(this.historyPath, null, true);

    this.config = await this.readJson(this.configPath, this.getDefaultConfig());
    this.state = await this.readJson(this.statePath, this.getDefaultState());
    this.state.currentCommit = await this.getCurrentCommitSafe();
    await this.saveState();

    this.setupScheduler();
    this.isInitialized = true;

    if (this.state.status === 'restarting' || this.state.status === 'validating') {
      setTimeout(() => {
        this.validateAfterRestart().catch((error) => {
          logger.error('Falha na validação pós-restart', { error: error.message });
        });
      }, 5000);
    }
  }

  async ensureFile(filePath, defaultData, plainText = false) {
    if (fsSync.existsSync(filePath)) return;
    if (plainText) {
      await fs.writeFile(filePath, '', 'utf8');
      return;
    }
    await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
  }

  async readJson(filePath, fallback) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return fallback;
    }
  }

  async saveConfig() {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  async saveState() {
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf8');
  }

  async appendHistory(entry) {
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
    await fs.appendFile(this.historyPath, `${line}\n`, 'utf8');
  }

  setupScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (!this.config.enabled) return;

    const intervalMs = Math.max(1, Number(this.config.checkIntervalMinutes) || 60) * 60 * 1000;
    this.timer = setInterval(() => {
      this.startUpdateCycle({ reason: 'scheduler' });
    }, intervalMs);
  }

  async getStatus() {
    await this.init();
    return {
      config: this.config,
      state: this.state
    };
  }

  async getHistory(limit = 50) {
    await this.init();
    try {
      const content = await fs.readFile(this.historyPath, 'utf8');
      const rows = content
        .split('\n')
        .filter(Boolean)
        .slice(-Math.max(1, limit))
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      return rows.reverse();
    } catch {
      return [];
    }
  }

  async updateConfig(partialConfig = {}) {
    await this.init();

    const next = {
      ...this.config,
      ...partialConfig
    };

    next.enabled = Boolean(next.enabled);
    next.autoApply = Boolean(next.autoApply);
    next.checkIntervalMinutes = Math.max(1, Number(next.checkIntervalMinutes) || 60);
    next.healthTimeoutMs = Math.max(500, Number(next.healthTimeoutMs) || 3000);
    next.healthRetries = Math.max(1, Number(next.healthRetries) || 5);
    next.maxConsecutiveFailures = Math.max(1, Number(next.maxConsecutiveFailures) || 3);
    next.installCommand = String(next.installCommand || 'npm ci --omit=dev');
    next.fallbackInstallCommand = String(next.fallbackInstallCommand || 'npm install --production');

    this.config = next;
    await this.saveConfig();
    this.setupScheduler();

    return this.config;
  }

  async checkForUpdates() {
    await this.init();
    return this.checkForUpdatesInternal();
  }

  async checkForUpdatesInternal() {
    const options = { cwd: this.repoRoot };
    await execCommand('git fetch origin main --prune', options);
    const { stdout: currentCommit } = await execCommand('git rev-parse HEAD', options);
    const { stdout: targetCommit } = await execCommand('git rev-parse origin/main', options);
    const { stdout: countRaw } = await execCommand('git rev-list HEAD..origin/main --count', options);
    const commitsAhead = parseInt(countRaw || '0', 10) || 0;

    this.state.lastCheckAt = new Date().toISOString();
    this.state.currentCommit = currentCommit;
    this.state.targetCommit = targetCommit;
    await this.saveState();

    return {
      hasUpdates: commitsAhead > 0,
      commitsAhead,
      currentCommit,
      targetCommit
    };
  }

  async startUpdateCycle({ reason = 'manual' } = {}) {
    await this.init();

    if (!this.config.enabled && reason === 'scheduler') {
      return { started: false, reason: 'disabled' };
    }

    if (this.isRunning || fsSync.existsSync(this.lockPath)) {
      return { started: false, reason: 'running' };
    }

    this.isRunning = true;
    const runId = `run_${Date.now()}`;

    try {
      fsSync.writeFileSync(this.lockPath, runId, 'utf8');
      this.runCycle({ runId, reason }).catch((error) => {
        logger.error('Erro no ciclo de atualização', { runId, error: error.message });
      });
      return { started: true, runId };
    } catch (error) {
      this.isRunning = false;
      if (fsSync.existsSync(this.lockPath)) {
        fsSync.unlinkSync(this.lockPath);
      }
      throw error;
    }
  }

  async runCycle({ runId, reason }) {
    try {
      this.state.status = 'checking';
      this.state.lastRunAt = new Date().toISOString();
      this.state.lastError = null;
      await this.saveState();
      await this.appendHistory({ runId, reason, event: 'cycle_started' });

      const check = await this.checkForUpdatesInternal();
      await this.appendHistory({ runId, reason, event: 'check_result', ...check });

      if (!check.hasUpdates) {
        this.state.status = 'idle';
        this.state.lastSuccessAt = new Date().toISOString();
        this.state.rollbackPerformed = false;
        this.state.consecutiveFailures = 0;
        await this.saveState();
        await this.appendHistory({ runId, reason, event: 'no_update' });
        return;
      }

      if (!this.config.autoApply) {
        this.state.status = 'idle';
        await this.saveState();
        await this.appendHistory({ runId, reason, event: 'auto_apply_disabled' });
        return;
      }

      await this.applyUpdate(runId, check);
    } catch (error) {
      await this.markFailure(runId, error, false);
    } finally {
      this.isRunning = false;
      if (fsSync.existsSync(this.lockPath)) {
        fsSync.unlinkSync(this.lockPath);
      }
    }
  }

  async applyUpdate(runId, check) {
    const options = { cwd: this.repoRoot };
    if (!/^[0-9a-f]{7,40}$/i.test(check.targetCommit)) {
      throw new Error('Commit alvo inválido');
    }

    this.state.status = 'downloading';
    this.state.previousCommit = check.currentCommit;
    this.state.targetCommit = check.targetCommit;
    this.state.rollbackPerformed = false;
    await this.saveState();

    await execCommand(`git merge --ff-only ${check.targetCommit}`, options);
    await this.appendHistory({ runId, event: 'merged_target', targetCommit: check.targetCommit });

    this.state.status = 'installing';
    await this.saveState();

    try {
      await execCommand(this.config.installCommand, options);
    } catch (installError) {
      await this.appendHistory({ runId, event: 'install_fallback', error: installError.message });
      await execCommand(this.config.fallbackInstallCommand, options);
    }

    this.state.status = 'restarting';
    this.state.restartRequestedAt = new Date().toISOString();
    await this.saveState();
    await this.appendHistory({ runId, event: 'restart_requested', rollback: false });

    await this.requestRestart();
  }

  async validateAfterRestart() {
    await this.init();
    this.state.status = 'validating';
    await this.saveState();

    const healthy = await this.runHealthCheck();
    if (healthy) {
      this.state.status = 'idle';
      this.state.currentCommit = await this.getCurrentCommitSafe();
      this.state.lastSuccessAt = new Date().toISOString();
      this.state.lastError = null;
      this.state.rollbackPerformed = false;
      this.state.consecutiveFailures = 0;
      await this.saveState();
      await this.appendHistory({
        event: 'validation_success',
        currentCommit: this.state.currentCommit
      });
      return;
    }

    await this.rollbackAndRestart(new Error('Health check falhou após atualização'));
  }

  async rollbackAndRestart(cause) {
    const options = { cwd: this.repoRoot };
    if (!this.state.previousCommit) {
      await this.markFailure('rollback', cause, true);
      return;
    }

    this.state.status = 'rollback';
    this.state.rollbackPerformed = true;
    this.state.lastError = cause.message;
    await this.saveState();
    await this.appendHistory({
      event: 'rollback_started',
      previousCommit: this.state.previousCommit,
      error: cause.message
    });

    try {
      await execCommand(`git reset --hard ${this.state.previousCommit}`, options);
      try {
        await execCommand(this.config.installCommand, options);
      } catch {
        await execCommand(this.config.fallbackInstallCommand, options);
      }
      this.state.status = 'restarting';
      this.state.restartRequestedAt = new Date().toISOString();
      await this.saveState();
      await this.appendHistory({ event: 'rollback_restart_requested', previousCommit: this.state.previousCommit });
      await this.requestRestart();
    } catch (error) {
      await this.markFailure('rollback', error, true);
    }
  }

  async markFailure(runId, error, critical) {
    this.state.status = critical ? 'critical' : 'idle';
    this.state.lastError = error.message;
    this.state.consecutiveFailures = (this.state.consecutiveFailures || 0) + 1;

    if (this.state.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.config.enabled = false;
      await this.saveConfig();
      this.setupScheduler();
      this.state.status = 'critical';
      this.state.lastError = `Circuit breaker ativado: ${error.message}`;
    }

    await this.saveState();
    await this.appendHistory({
      runId,
      event: 'cycle_failed',
      critical: Boolean(critical),
      error: error.message,
      consecutiveFailures: this.state.consecutiveFailures
    });
  }

  async requestRestart() {
    const pm2Available = await this.isPm2Available();

    if (pm2Available) {
      await execCommand('pm2 restart DePara');
      return;
    }

    // Fallback para ambiente sem PM2: depende de supervisor externo.
    setTimeout(() => process.exit(0), 1000);
  }

  async isPm2Available() {
    try {
      await execCommand('pm2 -v');
      return true;
    } catch {
      return false;
    }
  }

  async runHealthCheck() {
    const retries = Math.max(1, Number(this.config.healthRetries) || 5);
    const timeoutMs = Math.max(500, Number(this.config.healthTimeoutMs) || 3000);
    const port = process.env.PORT || 3000;

    for (let attempt = 0; attempt < retries; attempt += 1) {
      const ok = await new Promise((resolve) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/health',
            method: 'GET',
            timeout: timeoutMs
          },
          (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 300);
          }
        );

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        req.end();
      });

      if (ok) return true;
      await new Promise((r) => setTimeout(r, 1500));
    }

    return false;
  }

  async getCurrentCommitSafe() {
    try {
      const { stdout } = await execCommand('git rev-parse HEAD', { cwd: this.repoRoot });
      return stdout;
    } catch {
      return null;
    }
  }
}

module.exports = new UpdateOrchestrator();
