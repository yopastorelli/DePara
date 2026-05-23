const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const logger = require('../utils/logger');
const {
  getRuntimeRoot,
  getRuntimeDataDir,
  getRuntimeCurrentDir,
  getRuntimeCurrentEntryPath,
  getRuntimeCurrentReleaseMetaPath,
  getRuntimeReleasesDir,
  getSourceRepoRoot
} = require('../utils/runtimePaths');

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
    this.repoRoot = getSourceRepoRoot();
    this.runtimeRoot = getRuntimeRoot();
    this.dataDir = getRuntimeDataDir();
    this.legacyDataDir = path.join(this.repoRoot, 'src', 'data');
    this.legacyRepoDataDir = path.join(this.repoRoot, 'data');
    this.configPath = path.join(this.dataDir, 'update-config.json');
    this.statePath = path.join(this.dataDir, 'update-state.json');
    this.historyPath = path.join(this.dataDir, 'update-history.log');
    this.lockPath = path.join(this.dataDir, 'update.lock');
    this.releasesDir = getRuntimeReleasesDir();
    this.currentDir = getRuntimeCurrentDir();
    this.currentEntryPath = getRuntimeCurrentEntryPath();
    this.currentReleaseMetaPath = getRuntimeCurrentReleaseMetaPath();

    this.installCommand = 'npm ci --omit=dev';
    this.fallbackInstallCommand = 'npm install --production';
    this.lockStaleMs = 30 * 60 * 1000;

    this.config = null;
    this.state = null;
    this.timer = null;
    this.restartExitTimer = null;
    this.postRestartValidationTimer = null;
    this.isInitialized = false;
    this.isRunning = false;
    this.lockOwnerRunId = null;
  }

  isSideEffectsDisabled() {
    return process.env.DEPARA_DISABLE_UPDATE_SIDE_EFFECTS === 'true';
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
      lastFailureStage: null,
      lastSchedulerTriggerAt: null,
      lastHealthCheckAt: null,
      lastSupervisor: null,
      currentRelease: null,
      targetRelease: null,
      previousRelease: null,
      stagingRelease: null,
      activationState: 'idle',
      rollbackPerformed: false,
      consecutiveFailures: 0,
      restartRequestedAt: null
    };
  }

  async init() {
    if (this.isInitialized) return;

    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.releasesDir, { recursive: true });
    await fs.mkdir(path.join(this.currentDir, 'src'), { recursive: true });
    await this.migrateLegacyDataDir();
    await this.ensureCurrentReleaseWrapper();
    await this.ensureFile(this.configPath, this.getDefaultConfig());
    await this.ensureFile(this.statePath, this.getDefaultState());
    await this.ensureFile(this.historyPath, null, true);

    this.config = await this.readJson(this.configPath, this.getDefaultConfig());
    this.state = await this.readJson(this.statePath, this.getDefaultState());
    this.config = this.normalizeConfig(this.config);
    this.state = this.normalizeState(this.state);
    await this.reconcileReleaseState();
    this.state.currentCommit = await this.getCurrentCommitSafe();
    await this.cleanupStaleLock();
    await this.saveConfig();
    await this.saveState();
    await this.attemptPassiveRecoveryOnInit();

    this.setupScheduler();
    this.isInitialized = true;

    if (this.state.status === 'restarting' || this.state.status === 'validating') {
      this.postRestartValidationTimer = setTimeout(() => {
        this.validateAfterRestart().catch((error) => {
          logger.error('Falha na validação pós-restart', { error: error.message });
        });
      }, 5000);
      if (typeof this.postRestartValidationTimer.unref === 'function') {
        this.postRestartValidationTimer.unref();
      }
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
    const filesToMigrate = [
      'update-config.json',
      'update-state.json',
      'update-history.log',
      'update.lock'
    ];

    const legacyRoots = [this.legacyRepoDataDir, this.legacyDataDir]
      .filter((legacyDir, index, all) => legacyDir !== this.dataDir && all.indexOf(legacyDir) === index);

    for (const fileName of filesToMigrate) {
      const targetPath = path.join(this.dataDir, fileName);
      if (fsSync.existsSync(targetPath)) continue;

      for (const legacyDir of legacyRoots) {
        const legacyPath = path.join(legacyDir, fileName);
        if (!fsSync.existsSync(legacyPath)) {
          continue;
        }

        await fs.copyFile(legacyPath, targetPath);
        break;
      }
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

    if (process.env.DEPARA_DISABLE_UPDATE_SCHEDULER === 'true') return;
    if (!this.config.enabled) return;
    const intervalMs = Math.max(1, Number(this.config.checkIntervalMinutes) || 60) * 60 * 1000;

    this.timer = setInterval(() => {
      this.startUpdateCycle({ reason: 'scheduler' });
    }, intervalMs);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
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

  readLockDetails() {
    if (!fsSync.existsSync(this.lockPath)) {
      return null;
    }

    try {
      const lock = JSON.parse(fsSync.readFileSync(this.lockPath, 'utf8'));
      const startedAtMs = new Date(lock.startedAt || 0).getTime();
      const staleByAge = !startedAtMs || (Date.now() - startedAtMs) > this.lockStaleMs;
      return {
        ...lock,
        stale: staleByAge || !this.isProcessAlive(lock.pid)
      };
    } catch {
      return { invalid: true, stale: true };
    }
  }

  getExpectedPm2AppName() {
    return process.env.PM2_APP_NAME || 'DePara';
  }

  getLegacySystemdServiceName() {
    return process.env.SYSTEMD_SERVICE_NAME || 'depara.service';
  }

  isSystemdFallbackAllowed() {
    return process.env.DEPARA_ALLOW_SYSTEMD_FALLBACK === 'true';
  }

  createStageError(stage, message, extra = {}) {
    const error = new Error(message);
    error.stage = stage;
    Object.assign(error, extra);
    return error;
  }

  async runCommandForStage(command, options, stage, prefixMessage = null) {
    try {
      return await execCommand(command, options);
    } catch (error) {
      error.stage = error.stage || stage;
      if (prefixMessage) {
        error.message = `${prefixMessage}: ${error.message}`;
      }
      throw error;
    }
  }

  getReleaseId(commit) {
    if (!commit) return null;
    return String(commit).trim().replace(/[^a-z0-9._-]/gi, '_');
  }

  getReleasePath(releaseId) {
    return path.join(this.releasesDir, releaseId);
  }

  getCurrentWrapperContent() {
    return `'use strict';

const fs = require('fs');
const path = require('path');

const metaPath = path.join(__dirname, '..', 'release.json');

function loadActiveRelease() {
  if (!fs.existsSync(metaPath)) {
    throw new Error('Release metadata not found at ' + metaPath);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (!meta.activePath) {
    throw new Error('Active release path missing in ' + metaPath);
  }

  return meta.activePath;
}

const activeReleasePath = loadActiveRelease();
process.env.DEPARA_APP_ROOT = activeReleasePath;

module.exports = require(path.join(activeReleasePath, 'src', 'main.js'));
`;
  }

  async ensureCurrentReleaseWrapper() {
    await fs.mkdir(path.dirname(this.currentEntryPath), { recursive: true });
    if (!fsSync.existsSync(this.currentEntryPath)) {
      await fs.writeFile(this.currentEntryPath, this.getCurrentWrapperContent(), 'utf8');
    }

    if (!fsSync.existsSync(this.currentReleaseMetaPath)) {
      await fs.writeFile(this.currentReleaseMetaPath, JSON.stringify({
        activeRelease: null,
        activeCommit: null,
        activePath: null,
        previousRelease: null,
        previousCommit: null,
        updatedAt: null
      }, null, 2), 'utf8');
    }
  }

  async readCurrentReleaseMeta() {
    await this.ensureCurrentReleaseWrapper();
    return this.readJson(this.currentReleaseMetaPath, {
      activeRelease: null,
      activeCommit: null,
      activePath: null,
      previousRelease: null,
      previousCommit: null,
      updatedAt: null
    });
  }

  async writeCurrentReleaseMeta(meta) {
    await this.ensureCurrentReleaseWrapper();
    await fs.writeFile(this.currentReleaseMetaPath, JSON.stringify(meta, null, 2), 'utf8');
  }

  async reconcileReleaseState() {
    const activeRelease = await this.readCurrentReleaseMeta();
    this.state.currentRelease = activeRelease.activeRelease || null;
    this.state.currentCommit = activeRelease.activeCommit || this.state.currentCommit || null;
    this.state.previousRelease = activeRelease.previousRelease || this.state.previousRelease || null;
    this.state.previousCommit = activeRelease.previousCommit || this.state.previousCommit || null;
    this.state.activationState = this.state.activationState || 'idle';
  }

  getLastSchedulerTimestamp() {
    return this.state.lastSchedulerTriggerAt || this.state.lastRunAt || this.state.lastCheckAt || null;
  }

  getSchedulerRuntimeStatus() {
    const intervalMinutes = Math.max(1, Number(this.config?.checkIntervalMinutes) || 60);
    const intervalMs = intervalMinutes * 60 * 1000;
    const lastCycleAt = this.getLastSchedulerTimestamp();
    const ageMs = lastCycleAt ? (Date.now() - new Date(lastCycleAt).getTime()) : null;
    const staleThresholdMs = Math.max(intervalMs * 2, 5 * 60 * 1000);

    return {
      enabled: Boolean(this.config?.enabled),
      intervalMinutes,
      lastCycleAt,
      ageMs,
      staleThresholdMs,
      stale: Boolean(this.config?.enabled) && (!lastCycleAt || ageMs > staleThresholdMs)
    };
  }

  async detectSupervisorStatus() {
    const expectedAppName = this.getExpectedPm2AppName();
    const legacyServiceName = this.getLegacySystemdServiceName();
    const fallbackAllowed = this.isSystemdFallbackAllowed();
    const pm2Available = await this.isPm2Available();
    const pm2Registered = pm2Available
      ? await this.isPm2ProcessRegistered(expectedAppName)
      : false;
    const systemdAvailable = !pm2Registered
      ? await this.isSystemctlAvailable()
      : false;

    const reasons = [];
    if (!pm2Available) {
      reasons.push('pm2_unavailable');
    } else if (!pm2Registered) {
      reasons.push('pm2_process_not_registered');
    }

    if (!pm2Registered && fallbackAllowed && !systemdAvailable) {
      reasons.push('systemd_fallback_unavailable');
    }

    return {
      supervisor: pm2Registered
        ? 'pm2'
        : (fallbackAllowed && systemdAvailable ? 'systemd-fallback' : 'unmanaged'),
      pm2: {
        expectedAppName,
        available: pm2Available,
        registered: pm2Registered
      },
      systemd: {
        legacyServiceName,
        available: systemdAvailable,
        fallbackAllowed
      },
      operationallyReady: pm2Registered || (fallbackAllowed && systemdAvailable),
      reasons
    };
  }

  async getRuntimeStatus() {
    const supervisor = await this.detectSupervisorStatus();
    const worktree = await this.getTrackedWorktreeStatus();
    const activeRelease = await this.readCurrentReleaseMeta();
    return {
      platformTarget: 'rp4',
      supervisor,
      scheduler: this.getSchedulerRuntimeStatus(),
      lock: this.readLockDetails(),
      worktree,
      release: {
        current: activeRelease.activeRelease || this.state.currentRelease || null,
        target: this.state.targetRelease || null,
        previous: activeRelease.previousRelease || this.state.previousRelease || null,
        staging: this.state.stagingRelease || null,
        activationState: this.state.activationState || 'idle'
      },
      autoUpdateOperationallyReady: supervisor.operationallyReady,
      lastFailureStage: this.state.lastFailureStage || null
    };
  }

  async getTrackedWorktreeStatus() {
    try {
      const { stdout } = await execCommand(
        'git status --porcelain --untracked-files=no',
        { cwd: this.repoRoot }
      );
      const entries = (stdout || '')
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter(Boolean);
      return {
        clean: entries.length === 0,
        entries,
        summary: entries.slice(0, 5).join(', ')
      };
    } catch (error) {
      return {
        clean: null,
        entries: [],
        summary: '',
        error: error.message
      };
    }
  }

  async ensureRuntimeOperationalForAutoUpdate() {
    const runtime = await this.getRuntimeStatus();
    if (runtime.autoUpdateOperationallyReady) {
      return runtime;
    }

    const reasons = runtime.supervisor.reasons.join(', ') || 'unknown';
    throw this.createStageError(
      'supervisor_readiness',
      `Auto-update exige processo canônico no PM2. Estado atual: ${reasons}`,
      { runtime }
    );
  }

  async ensureCleanTrackedWorktree() {
    const worktree = await this.getTrackedWorktreeStatus();
    if (worktree.error) {
      throw this.createStageError(
        'worktree_check',
        `Falha ao verificar worktree antes do update: ${worktree.error}`,
        { worktreeError: worktree.error }
      );
    }

    if (!worktree.clean) {
      const worktreeSummary = worktree.summary
        ? ` Arquivos: ${worktree.summary}`
        : '';
      throw this.createStageError(
        'worktree_dirty',
        `Worktree local possui alteracoes rastreadas; auto-update abortado para evitar merge inseguro.${worktreeSummary}`,
        {
          worktree: worktree.entries.join('\n'),
          worktreeEntries: worktree.entries,
          worktreeSummary: worktree.summary
        }
      );
    }
  }

  async getStatus() {
    await this.init();
    const runtime = await this.getRuntimeStatus();
    return {
      config: this.config,
      state: this.state,
      runtime
    };
  }

  async getDiagnostics() {
    await this.init();
    const recentHistory = await this.getHistory(10);
    const runtime = await this.getRuntimeStatus();
    return {
      now: new Date().toISOString(),
      repoRoot: this.repoRoot,
      lockPath: this.lockPath,
      lock: this.readLockDetails(),
      config: this.config,
      state: this.state,
      runtime,
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

  async exportCommitToDirectory(commit, destinationPath) {
    const archivePath = path.join(this.releasesDir, `${this.getReleaseId(commit)}.tar`);
    await fs.rm(destinationPath, { recursive: true, force: true });
    await fs.mkdir(destinationPath, { recursive: true });

    try {
      await this.runCommandForStage(
        `git archive --format=tar ${commit} -o "${archivePath}"`,
        { cwd: this.repoRoot },
        'git_archive',
        'Falha ao gerar release do commit alvo'
      );
      await this.runCommandForStage(
        `tar -xf "${archivePath}" -C "${destinationPath}"`,
        { cwd: this.repoRoot },
        'release_extract',
        'Falha ao extrair release do commit alvo'
      );
    } finally {
      await fs.rm(archivePath, { force: true });
    }
  }

  async installReleaseDependencies(runId, releasePath) {
    try {
      await this.runCommandForStage(
        this.installCommand,
        { cwd: releasePath },
        'npm_ci',
        'Falha ao instalar dependencias do release com npm ci'
      );
    } catch (installError) {
      await this.appendHistory({
        runId,
        event: 'install_fallback',
        stage: installError.stage || 'npm_ci',
        error: installError.message
      });
      await this.runCommandForStage(
        this.fallbackInstallCommand,
        { cwd: releasePath },
        'npm_install_fallback',
        'Falha ao instalar dependencias do release com fallback'
      );
    }
  }

  async prepareRelease(runId, targetCommit) {
    const releaseId = this.getReleaseId(targetCommit);
    const releasePath = this.getReleasePath(releaseId);
    const stagingPath = path.join(this.releasesDir, `.staging-${runId}-${releaseId}`);

    if (!fsSync.existsSync(releasePath)) {
      await this.exportCommitToDirectory(targetCommit, stagingPath);
      await this.installReleaseDependencies(runId, stagingPath);
      await fs.rm(releasePath, { recursive: true, force: true });
      await fs.rename(stagingPath, releasePath);
    } else {
      await fs.rm(stagingPath, { recursive: true, force: true });
    }

    return {
      releaseId,
      releasePath,
      commit: targetCommit
    };
  }

  async activateRelease(release) {
    const activeRelease = await this.readCurrentReleaseMeta();
    await this.writeCurrentReleaseMeta({
      activeRelease: release.releaseId,
      activeCommit: release.commit,
      activePath: release.releasePath,
      previousRelease: activeRelease.activeRelease || null,
      previousCommit: activeRelease.activeCommit || null,
      updatedAt: new Date().toISOString()
    });
  }

  async restorePreviousRelease() {
    const activeRelease = await this.readCurrentReleaseMeta();
    if (!activeRelease.previousRelease || !activeRelease.previousCommit) {
      return false;
    }

    const previousPath = this.getReleasePath(activeRelease.previousRelease);
    if (!fsSync.existsSync(previousPath)) {
      return false;
    }

    await this.writeCurrentReleaseMeta({
      activeRelease: activeRelease.previousRelease,
      activeCommit: activeRelease.previousCommit,
      activePath: previousPath,
      previousRelease: activeRelease.activeRelease || null,
      previousCommit: activeRelease.activeCommit || null,
      updatedAt: new Date().toISOString()
    });
    return true;
  }

  async checkForUpdatesInternal(params = {}) {
    const { passive = false, clearDisabledOnClean = false } = params;
    const execOptions = { cwd: this.repoRoot };
    await this.runCommandForStage('git fetch origin main --prune', execOptions, 'git_fetch', 'Falha ao buscar origin/main');
    const currentCommit = await this.getCurrentCommitSafe();
    const { stdout: targetCommit } = await this.runCommandForStage('git rev-parse origin/main', execOptions, 'git_rev_parse_target');
    const baselineCommit = currentCommit || targetCommit;
    const { stdout: countRaw } = await this.runCommandForStage(`git rev-list ${baselineCommit}..origin/main --count`, execOptions, 'git_rev_list_count');
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
    const requestedAt = new Date().toISOString();

    if (!this.config.enabled && reason === 'scheduler') {
      return { started: false, reason: 'disabled' };
    }

    if (reason === 'scheduler') {
      await this.setState(this.state.status, {
        lastSchedulerTriggerAt: requestedAt
      }, 'scheduler_tick');
    }

    await this.cleanupStaleLock();
    if (this.isRunning || fsSync.existsSync(this.lockPath)) {
      return { started: false, reason: 'running' };
    }

    try {
      const runtime = await this.ensureRuntimeOperationalForAutoUpdate();
      await this.setState(this.state.status, {
        lastSupervisor: runtime.supervisor.supervisor
      }, 'supervisor_checked');
    } catch (error) {
      await this.appendHistory({
        event: 'supervisor_not_ready',
        reason,
        error: error.message,
        supervisor: error.runtime?.supervisor?.supervisor || 'unmanaged'
      });
      return {
        started: false,
        reason: 'not_operational',
        diagnostics: error.runtime || null
      };
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
      const runtime = await this.ensureRuntimeOperationalForAutoUpdate();
      await this.setState('checking', {
        lastRunAt: new Date().toISOString(),
        lastRunId: runId,
        lastError: null,
        lastFailureStage: null,
        lastSupervisor: runtime.supervisor.supervisor
      }, 'cycle_started');
      await this.appendHistory({
        runId,
        reason,
        event: 'cycle_started',
        supervisor: runtime.supervisor.supervisor
      });

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
    if (!/^[0-9a-f]{7,40}$/i.test(check.targetCommit)) {
      throw this.createStageError('target_commit_validation', 'Commit alvo inválido');
    }

    await this.setState('downloading', {
      previousCommit: check.currentCommit,
      targetCommit: check.targetCommit,
      previousRelease: this.state.currentRelease || null,
      targetRelease: this.getReleaseId(check.targetCommit),
      stagingRelease: this.getReleaseId(check.targetCommit),
      activationState: 'staging',
      rollbackPerformed: false
    }, 'downloading');

    const release = await this.prepareRelease(runId, check.targetCommit);
    await this.appendHistory({
      runId,
      event: 'release_prepared',
      releaseId: release.releaseId,
      targetCommit: release.commit
    });

    await this.setState('installing', {
      stagingRelease: null,
      targetRelease: release.releaseId,
      activationState: 'activating'
    }, 'installing');
    await this.activateRelease(release);

    await this.setState('restarting', {
      restartRequestedAt: new Date().toISOString(),
      lastSupervisor: 'pm2',
      currentCommit: release.commit,
      currentRelease: release.releaseId,
      targetRelease: release.releaseId,
      activationState: 'restarting'
    }, 'restart_requested');
    await this.appendHistory({
      runId,
      event: 'restart_requested',
      rollback: false,
      releaseId: release.releaseId,
      targetCommit: release.commit
    });
    await this.requestRestart();
  }

  async validateAfterRestart() {
    await this.init();
    await this.setState('validating', {}, 'validating');

    const health = await this.runHealthCheck();
    await this.setState('validating', {
      lastHealthCheckAt: new Date().toISOString()
    }, 'health_checked');
    await this.appendHistory({
      event: 'health_check',
      ok: health.ok,
      attempts: health.attempts,
      durationMs: health.durationMs,
      path: this.config.healthPath
    });

    if (health.ok) {
      const activeRelease = await this.readCurrentReleaseMeta();
      await this.setState('idle', {
        currentCommit: activeRelease.activeCommit || await this.getCurrentCommitSafe(),
        currentRelease: activeRelease.activeRelease || null,
        previousCommit: activeRelease.previousCommit || this.state.previousCommit,
        previousRelease: activeRelease.previousRelease || this.state.previousRelease,
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        lastFailureStage: null,
        targetRelease: null,
        stagingRelease: null,
        activationState: 'active',
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
    if (!this.state.previousCommit) {
      await this.markFailure('rollback', cause, true);
      return;
    }

    await this.setState('rollback', {
      rollbackPerformed: true,
      lastError: cause.message,
      activationState: 'rollback'
    }, 'rollback_started');
    await this.appendHistory({
      event: 'rollback_started',
      previousCommit: this.state.previousCommit,
      previousRelease: this.state.previousRelease,
      error: cause.message
    });

    try {
      const restored = await this.restorePreviousRelease();
      if (!restored) {
        throw this.createStageError(
          'release_restore',
          'Falha ao restaurar release anterior durante rollback'
        );
      }

      await this.setState('restarting', {
        restartRequestedAt: new Date().toISOString(),
        currentCommit: this.state.previousCommit,
        currentRelease: this.state.previousRelease,
        targetRelease: null,
        stagingRelease: null,
        activationState: 'rollback_restart'
      }, 'rollback_restart_requested');
      await this.appendHistory({
        event: 'rollback_restart_requested',
        previousCommit: this.state.previousCommit,
        previousRelease: this.state.previousRelease
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
    const failureStage = error.stage || 'unknown';

    if (nextConsecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.config.enabled = false;
      await this.saveConfig();
      this.setupScheduler();
      status = 'critical';
      message = `Circuit breaker ativado: ${error.message}`;
    }

    await this.setState(status, {
      lastError: message,
      lastFailureStage: failureStage,
      consecutiveFailures: nextConsecutiveFailures
    }, 'cycle_failed');

    await this.appendHistory({
      runId,
      event: 'cycle_failed',
      stage: failureStage,
      critical: Boolean(critical),
      error: message,
      worktreeSummary: error.worktreeSummary || null,
      consecutiveFailures: nextConsecutiveFailures
    });
  }

  async requestRestart() {
    if (this.isSideEffectsDisabled()) {
      logger.info('Reinicio suprimido por configuracao de teste');
      return;
    }

    const runtime = await this.detectSupervisorStatus();
    const appName = this.getExpectedPm2AppName();
    const systemdServiceName = this.getLegacySystemdServiceName();
    const runId = this.state?.lastRunId || 'restart';
    const canRecordHistory = Boolean(this.historyPath) && fsSync.existsSync(path.dirname(this.historyPath));

    if (runtime.pm2.available && runtime.pm2.registered) {
      await this.runCommandForStage(
        `pm2 restart ${appName}`,
        {},
        'pm2_restart',
        'Falha ao reiniciar processo PM2'
      );
      if (canRecordHistory) {
        await this.appendHistory({
          runId,
          event: 'restart_dispatched',
          supervisor: 'pm2',
          appName
        });
      }
      return;
    }

    if (runtime.systemd.fallbackAllowed && runtime.systemd.available) {
      const restarted = await this.restartViaSystemd(systemdServiceName);
      if (restarted) {
        if (canRecordHistory) {
          await this.appendHistory({
            runId,
            event: 'restart_dispatched',
            supervisor: 'systemd-fallback',
            service: systemdServiceName
          });
        }
        return;
      }
    }

    throw this.createStageError(
      'restart_supervisor',
      `Processo PM2 canônico não está registrado como ${appName}; reinício automático abortado`,
      { runtime }
    );
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
    if (this.isSideEffectsDisabled()) {
      logger.info('Process exit suprimido por configuracao de teste');
      return;
    }

    this.restartExitTimer = setTimeout(() => process.exit(0), 1000);
    if (typeof this.restartExitTimer.unref === 'function') {
      this.restartExitTimer.unref();
    }
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
    const activeRelease = await this.readCurrentReleaseMeta();
    if (activeRelease.activeCommit) {
      return activeRelease.activeCommit;
    }

    try {
      const { stdout } = await execCommand('git rev-parse HEAD', { cwd: this.repoRoot });
      return stdout;
    } catch {
      return null;
    }
  }

  async shutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.restartExitTimer) {
      clearTimeout(this.restartExitTimer);
      this.restartExitTimer = null;
    }

    if (this.postRestartValidationTimer) {
      clearTimeout(this.postRestartValidationTimer);
      this.postRestartValidationTimer = null;
    }

    this.isRunning = false;
    this.isInitialized = false;
  }
}

module.exports = new UpdateOrchestrator();
