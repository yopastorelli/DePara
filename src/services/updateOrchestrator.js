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
    this.dataDir = process.env.DEPARA_DATA_DIR || path.join(this.repoRoot, 'data');
    this.legacyDataDir = path.join(this.repoRoot, 'src', 'data');
    this.configPath = path.join(this.dataDir, 'update-config.json');
    this.statePath = path.join(this.dataDir, 'update-state.json');
    this.historyPath = path.join(this.dataDir, 'update-history.log');
    this.lockPath = path.join(this.dataDir, 'update.lock');

    this.installCommand = 'npm ci --omit=dev';
    this.fallbackInstallCommand = 'npm install --production';
    this.lockStaleMs = 30 * 60 * 1000;

    this.config = null;
    this.state = null;
    this.timer = null;
    this.isInitialized = false;
    this.isRunning = false;
    this.lockOwnerRunId = null;
  }

  getDefaultConfig() {
    return {
      enabled: true,
      autoApply: true,
      checkIntervalMinutes: 60,
      healthTimeoutMs: 3000,
      healthRetries: 5,
      healthPath: '/health',
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
      lastRunId: null,
      lastEvent: null,
      rollbackPerformed: false,
      consecutiveFailures: 0,
      restartRequestedAt: null
    };
  }

  async init() {
    if (this.isInitialized) return;

    await fs.mkdir(this.dataDir, { recursive: true });
    await this.migrateLegacyDataDir();
    await this.ensureFile(this.configPath, this.getDefaultConfig());
    await this.ensureFile(this.statePath, this.getDefaultState());
    await this.ensureFile(this.historyPath, null, true);

    this.config = await this.readJson(this.configPath, this.getDefaultConfig());
    this.state = await this.readJson(this.statePath, this.getDefaultState());
    this.config = this.normalizeConfig(this.config);
    this.state = this.normalizeState(this.state);
    this.state.currentCommit = await this.getCurrentCommitSafe();
    await this.cleanupStaleLock();
    await this.saveConfig();
    await this.saveState();
    await this.attemptPassiveRecoveryOnInit();

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

  async attemptPassiveRecoveryOnInit() {
    const shouldAttemptRecovery =
      !this.config.enabled ||
      this.state.status === 'critical' ||
      Boolean(this.state.lastError) ||
      (this.state.consecutiveFailures || 0) > 0;

    if (!shouldAttemptRecovery) {
      return;
    }

    try {
      await this.checkForUpdatesInternal({
        passive: true,
        clearDisabledOnClean: true
      });
    } catch (error) {
      logger.warn('Falha na reconciliacao passiva do auto-update', {
        error: error.message
      });
    }
  }

  async migrateLegacyDataDir() {
    if (this.legacyDataDir === this.dataDir) return;
    if (!fsSync.existsSync(this.legacyDataDir)) return;

    const filesToMigrate = [
      'update-config.json',
      'update-state.json',
      'update-history.log',
      'update.lock'
    ];

    for (const fileName of filesToMigrate) {
      const legacyPath = path.join(this.legacyDataDir, fileName);
      const targetPath = path.join(this.dataDir, fileName);

      if (!fsSync.existsSync(legacyPath) || fsSync.existsSync(targetPath)) {
        continue;
      }

      await fs.copyFile(legacyPath, targetPath);
    }
  }

  normalizeConfig(config = {}) {
    const allowed = {
      enabled: Boolean(config.enabled),
      autoApply: config.autoApply === undefined ? true : Boolean(config.autoApply),
      checkIntervalMinutes: Math.max(1, Number(config.checkIntervalMinutes) || 60),
      healthTimeoutMs: Math.max(500, Number(config.healthTimeoutMs) || 3000),
      healthRetries: Math.max(1, Number(config.healthRetries) || 5),
      healthPath: typeof config.healthPath === 'string' && config.healthPath.startsWith('/')
        ? config.healthPath
        : '/health',
      maxConsecutiveFailures: Math.max(1, Number(config.maxConsecutiveFailures) || 3)
    };
    return allowed;
  }

  normalizeState(state = {}) {
    return {
      ...this.getDefaultState(),
      ...state
    };
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
    } catch {
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
    this.state.lastEvent = entry.event || this.state.lastEvent;
  }

  async setState(status, patch = {}, event = null) {
    this.state.status = status;
    this.state = {
      ...this.state,
      ...patch
    };
    if (event) this.state.lastEvent = event;
    await this.saveState();
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

  async cleanupStaleLock() {
    if (!fsSync.existsSync(this.lockPath)) return;

    let lockData = null;
    try {
      lockData = JSON.parse(fsSync.readFileSync(this.lockPath, 'utf8'));
    } catch {
      fsSync.unlinkSync(this.lockPath);
      return;
    }

    const startedAtMs = new Date(lockData.startedAt || 0).getTime();
    const isStaleByAge = !startedAtMs || (Date.now() - startedAtMs) > this.lockStaleMs;
    const isAlive = this.isProcessAlive(lockData.pid);

    if (isStaleByAge || !isAlive) {
      fsSync.unlinkSync(this.lockPath);
      await this.appendHistory({
        event: 'lock_cleared',
        reason: isStaleByAge ? 'stale_age' : 'stale_pid',
        pid: lockData.pid,
        runId: lockData.runId
      });
    }
  }

  isProcessAlive(pid) {
    if (!pid || Number.isNaN(Number(pid))) return false;
    try {
      process.kill(Number(pid), 0);
      return true;
    } catch {
      return false;
    }
  }

  acquireLock(runId) {
    if (fsSync.existsSync(this.lockPath)) return false;
    const lockData = {
      runId,
      pid: process.pid,
      startedAt: new Date().toISOString()
    };
    fsSync.writeFileSync(this.lockPath, JSON.stringify(lockData), 'utf8');
    this.lockOwnerRunId = runId;
    return true;
  }

  releaseLock(runId) {
    if (!fsSync.existsSync(this.lockPath)) return;
    try {
      const lockData = JSON.parse(fsSync.readFileSync(this.lockPath, 'utf8'));
      if (!runId || lockData.runId === runId) {
        fsSync.unlinkSync(this.lockPath);
      }
    } catch {
      fsSync.unlinkSync(this.lockPath);
    } finally {
      this.lockOwnerRunId = null;
    }
  }

  async getStatus() {
    await this.init();
    return {
      config: this.config,
      state: this.state
    };
  }

  async getDiagnostics() {
    await this.init();
    let lock = null;
    if (fsSync.existsSync(this.lockPath)) {
      try {
        lock = JSON.parse(fsSync.readFileSync(this.lockPath, 'utf8'));
      } catch {
        lock = { invalid: true };
      }
    }

    const recentHistory = await this.getHistory(10);
    return {
      now: new Date().toISOString(),
      repoRoot: this.repoRoot,
      lockPath: this.lockPath,
      lock,
      config: this.config,
      state: this.state,
      recentHistory
    };
  }

  async getHistory(limit = 50) {
    await this.init();
    try {
      const content = await fs.readFile(this.historyPath, 'utf8');
      return content
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
        .filter(Boolean)
        .reverse();
    } catch {
      return [];
    }
  }

  async updateConfig(partialConfig = {}) {
    await this.init();
    const allowedKeys = [
      'enabled',
      'autoApply',
      'checkIntervalMinutes',
      'healthTimeoutMs',
      'healthRetries',
      'healthPath',
      'maxConsecutiveFailures'
    ];

    const filtered = {};
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(partialConfig, key)) {
        filtered[key] = partialConfig[key];
      }
    }

    this.config = this.normalizeConfig({
      ...this.config,
      ...filtered
    });

    await this.saveConfig();
    this.setupScheduler();
    await this.appendHistory({
      event: 'config_updated',
      keys: Object.keys(filtered)
    });
    return this.config;
  }

  async checkForUpdates() {
    await this.init();
    return this.checkForUpdatesInternal({
      passive: true,
      clearDisabledOnClean: true
    });
  }

  async checkForUpdatesInternal(params = {}) {
    const { passive = false, clearDisabledOnClean = false } = params;
    const execOptions = { cwd: this.repoRoot };
    await execCommand('git fetch origin main --prune', execOptions);
    const { stdout: currentCommit } = await execCommand('git rev-parse HEAD', execOptions);
    const { stdout: targetCommit } = await execCommand('git rev-parse origin/main', execOptions);
    const { stdout: countRaw } = await execCommand('git rev-list HEAD..origin/main --count', execOptions);
    const commitsAhead = parseInt(countRaw || '0', 10) || 0;
    const hasUpdates = commitsAhead > 0;

    if (passive && !hasUpdates) {
      await this.setState('idle', {
        lastCheckAt: new Date().toISOString(),
        currentCommit,
        targetCommit,
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        rollbackPerformed: false,
        consecutiveFailures: 0
      }, 'check_result');

      if (clearDisabledOnClean && !this.config.enabled) {
        this.config.enabled = true;
        await this.saveConfig();
        await this.appendHistory({
          event: 'circuit_breaker_cleared',
          reason: 'passive_clean_check'
        });
      }
    } else {
      await this.setState(this.state.status, {
        lastCheckAt: new Date().toISOString(),
        currentCommit,
        targetCommit,
        lastError: passive ? null : this.state.lastError
      }, 'check_result');
    }

    return {
      hasUpdates,
      commitsAhead,
      currentCommit,
      targetCommit,
      lastCheckAt: this.state.lastCheckAt
    };
  }

  async startUpdateCycle({ reason = 'manual' } = {}) {
    await this.init();

    if (!this.config.enabled && reason === 'scheduler') {
      return { started: false, reason: 'disabled' };
    }

    await this.cleanupStaleLock();
    if (this.isRunning || fsSync.existsSync(this.lockPath)) {
      return { started: false, reason: 'running' };
    }

    this.isRunning = true;
    const runId = `run_${Date.now()}`;

    try {
      if (!this.acquireLock(runId)) {
        this.isRunning = false;
        return { started: false, reason: 'running' };
      }
      this.runCycle({ runId, reason }).catch((error) => {
        logger.error('Erro no ciclo de atualização', { runId, error: error.message });
      });
      return { started: true, runId };
    } catch (error) {
      this.isRunning = false;
      this.releaseLock(runId);
      throw error;
    }
  }

  async runCycle({ runId, reason }) {
    try {
      await this.setState('checking', {
        lastRunAt: new Date().toISOString(),
        lastRunId: runId,
        lastError: null
      }, 'cycle_started');
      await this.appendHistory({ runId, reason, event: 'cycle_started' });

      const check = await this.checkForUpdatesInternal();
      await this.appendHistory({ runId, reason, event: 'check_result', ...check });

      if (!check.hasUpdates) {
        await this.setState('idle', {
          lastSuccessAt: new Date().toISOString(),
          rollbackPerformed: false,
          consecutiveFailures: 0
        }, 'no_update');
        await this.appendHistory({ runId, reason, event: 'no_update' });
        return;
      }

      if (!this.config.autoApply) {
        await this.setState('idle', {}, 'auto_apply_disabled');
        await this.appendHistory({ runId, reason, event: 'auto_apply_disabled' });
        return;
      }

      await this.applyUpdate(runId, check);
    } catch (error) {
      await this.markFailure(runId, error, false);
    } finally {
      this.isRunning = false;
      this.releaseLock(runId);
    }
  }

  async applyUpdate(runId, check) {
    const options = { cwd: this.repoRoot };
    if (!/^[0-9a-f]{7,40}$/i.test(check.targetCommit)) {
      throw new Error('Commit alvo inválido');
    }

    await this.setState('downloading', {
      previousCommit: check.currentCommit,
      targetCommit: check.targetCommit,
      rollbackPerformed: false
    }, 'downloading');

    await execCommand(`git merge --ff-only ${check.targetCommit}`, options);
    await this.appendHistory({ runId, event: 'merged_target', targetCommit: check.targetCommit });

    await this.setState('installing', {}, 'installing');
    try {
      await execCommand(this.installCommand, options);
    } catch (installError) {
      await this.appendHistory({ runId, event: 'install_fallback', error: installError.message });
      await execCommand(this.fallbackInstallCommand, options);
    }

    await this.setState('restarting', {
      restartRequestedAt: new Date().toISOString()
    }, 'restart_requested');
    await this.appendHistory({ runId, event: 'restart_requested', rollback: false });
    await this.requestRestart();
  }

  async validateAfterRestart() {
    await this.init();
    await this.setState('validating', {}, 'validating');

    const health = await this.runHealthCheck();
    await this.appendHistory({
      event: 'health_check',
      ok: health.ok,
      attempts: health.attempts,
      durationMs: health.durationMs,
      path: this.config.healthPath
    });

    if (health.ok) {
      await this.setState('idle', {
        currentCommit: await this.getCurrentCommitSafe(),
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        rollbackPerformed: false,
        consecutiveFailures: 0
      }, 'validation_success');
      await this.appendHistory({
        event: 'validation_success',
        currentCommit: this.state.currentCommit
      });
      return;
    }

    if (this.state.rollbackPerformed) {
      await this.markFailure(
        this.state.lastRunId || 'validation',
        new Error('Health check falhou após rollback'),
        true
      );
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

    await this.setState('rollback', {
      rollbackPerformed: true,
      lastError: cause.message
    }, 'rollback_started');
    await this.appendHistory({
      event: 'rollback_started',
      previousCommit: this.state.previousCommit,
      error: cause.message
    });

    try {
      await execCommand(`git reset --hard ${this.state.previousCommit}`, options);
      try {
        await execCommand(this.installCommand, options);
      } catch {
        await execCommand(this.fallbackInstallCommand, options);
      }

      await this.setState('restarting', {
        restartRequestedAt: new Date().toISOString()
      }, 'rollback_restart_requested');
      await this.appendHistory({
        event: 'rollback_restart_requested',
        previousCommit: this.state.previousCommit
      });
      await this.requestRestart();
    } catch (error) {
      await this.markFailure('rollback', error, true);
    }
  }

  async markFailure(runId, error, critical) {
    const nextConsecutiveFailures = (this.state.consecutiveFailures || 0) + 1;
    let status = critical ? 'critical' : 'idle';
    let message = error.message;

    if (nextConsecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.config.enabled = false;
      await this.saveConfig();
      this.setupScheduler();
      status = 'critical';
      message = `Circuit breaker ativado: ${error.message}`;
    }

    await this.setState(status, {
      lastError: message,
      consecutiveFailures: nextConsecutiveFailures
    }, 'cycle_failed');

    await this.appendHistory({
      runId,
      event: 'cycle_failed',
      critical: Boolean(critical),
      error: message,
      consecutiveFailures: nextConsecutiveFailures
    });
  }

  async requestRestart() {
    const pm2Available = await this.isPm2Available();
    const appName = process.env.PM2_APP_NAME || 'DePara';
    const systemdServiceName = process.env.SYSTEMD_SERVICE_NAME || 'depara.service';

    if (pm2Available && await this.isPm2ProcessRegistered(appName)) {
      await execCommand(`pm2 restart ${appName}`);
      return;
    }

    if (pm2Available) {
      logger.warn('PM2 disponivel, mas processo nao encontrado. Tentando fallback.', { appName });
    }

    if (await this.isSystemctlAvailable()) {
      const restarted = await this.restartViaSystemd(systemdServiceName);
      if (restarted) {
        return;
      }
    }

    this.scheduleProcessExit();
  }

  async isPm2Available() {
    try {
      await execCommand('pm2 -v');
      return true;
    } catch {
      return false;
    }
  }

  async isPm2ProcessRegistered(appName) {
    try {
      const { stdout } = await execCommand('pm2 jlist');
      const processList = JSON.parse(stdout || '[]');
      return Array.isArray(processList) && processList.some((processInfo) => {
        return processInfo?.name === appName || processInfo?.pm2_env?.name === appName;
      });
    } catch (error) {
      logger.warn('Falha ao consultar processos PM2', { error: error.message, appName });
      return false;
    }
  }

  async isSystemctlAvailable() {
    try {
      await execCommand('systemctl --version');
      return true;
    } catch {
      return false;
    }
  }

  async restartViaSystemd(serviceName) {
    const service = (serviceName || '').trim();
    if (!service) {
      return false;
    }

    const commands = [
      `systemctl restart ${service}`,
      `systemctl --user restart ${service}`
    ];

    for (const command of commands) {
      try {
        await execCommand(command);
        return true;
      } catch (error) {
        logger.warn('Falha ao reiniciar via systemd', {
          error: error.message,
          command,
          service
        });
      }
    }

    return false;
  }

  scheduleProcessExit() {
    setTimeout(() => process.exit(0), 1000);
  }

  async runHealthCheck() {
    const retries = Math.max(1, Number(this.config.healthRetries) || 5);
    const timeoutMs = Math.max(500, Number(this.config.healthTimeoutMs) || 3000);
    const port = process.env.PORT || 3000;
    const startAt = Date.now();

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      const ok = await new Promise((resolve) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: this.config.healthPath || '/health',
            method: 'GET',
            timeout: timeoutMs
          },
          (res) => resolve(res.statusCode >= 200 && res.statusCode < 300)
        );

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        req.end();
      });

      if (ok) {
        return {
          ok: true,
          attempts: attempt,
          durationMs: Date.now() - startAt
        };
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    return {
      ok: false,
      attempts: retries,
      durationMs: Date.now() - startAt
    };
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
