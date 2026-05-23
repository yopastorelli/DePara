// DePara Web Interface - JavaScript
// @author yopastorelli
// @version 2.0.0

/**
 * Sistema de Logging Estruturado para Frontend
 */
const DEPARA_DEBUG_ENABLED = localStorage.getItem('depara-debug') === 'true';
if (!DEPARA_DEBUG_ENABLED) {
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
}

const DEPARA_MOJIBAKE_REPLACEMENTS = [
    ['ÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£', 'cao'],
    ['ÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµ', 'co'],
    ['ÃƒÆ’Ã‚Â£', 'a'],
    ['ÃƒÆ’Ã‚Â¡', 'a'],
    ['ÃƒÆ’Ã‚Âµ', 'o'],
    ['ÃƒÆ’Ã‚Â­', 'i'],
    ['ÃƒÆ’Ã‚Â©', 'e'],
    ['ÃƒÆ’Ã‚Â³', 'o'],
    ['ÃƒÆ’Ã‚Â§', 'c'],
    ['ÃƒÆ’Ã‚Â¢', 'a'],
    ['ÃƒÆ’Ã‚Âª', 'e'],
    ['ÃƒÆ’Ã‚Âº', 'u'],
    ['ÃƒÆ’Ã…Â¡', 'U'],
    ['ÃƒÂ¢Ã‚ÂÃ…â€™', '[x]'],
    ['ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â', '[!]'],
    ['ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦', '[ok]'],
    ['ÃƒÂ¢Ã‚ÂÃ‚Â°', '[timer]'],
    ['ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â', '[dbg]'],
    ['ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¤', '[send]'],
    ['ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â ', '[dbg]'],
    ['ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹', '[load]'],
    ['ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â', '[path]'],
    ['ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦', '[ok]'],
    ['ÃƒÂ¢Ã‚ÂÃ‚Â±ÃƒÂ¯Ã‚Â¸Ã‚Â', '[timer]']
];

function sanitizeVisibleText(value) {
    if (typeof value !== 'string' || value.length === 0) {
        return value;
    }

    let sanitized = value;
    for (const [from, to] of DEPARA_MOJIBAKE_REPLACEMENTS) {
        sanitized = sanitized.split(from).join(to);
    }

    return sanitized;
}

function installDomTextSanitizer() {
    if (window.__deparaDomTextSanitizerInstalled) {
        return;
    }

    const innerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (innerHTMLDescriptor?.set && innerHTMLDescriptor?.get) {
        Object.defineProperty(Element.prototype, 'innerHTML', {
            configurable: true,
            enumerable: innerHTMLDescriptor.enumerable,
            get() {
                return innerHTMLDescriptor.get.call(this);
            },
            set(value) {
                innerHTMLDescriptor.set.call(this, sanitizeVisibleText(value));
            }
        });
    }

    const textContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    if (textContentDescriptor?.set && textContentDescriptor?.get) {
        Object.defineProperty(Node.prototype, 'textContent', {
            configurable: true,
            enumerable: textContentDescriptor.enumerable,
            get() {
                return textContentDescriptor.get.call(this);
            },
            set(value) {
                textContentDescriptor.set.call(this, sanitizeVisibleText(value));
            }
        });
    }

    window.__deparaDomTextSanitizerInstalled = true;
}

installDomTextSanitizer();

class Logger {
    constructor() {
        this.enableDebug = localStorage.getItem('depara-debug') === 'true';
        this.logLevel = localStorage.getItem('depara-log-level') || 'info';
        this.maxLogs = 100;
        this.logs = [];
    }

    log(level, message, meta = {}) {
        const normalizedMessage = sanitizeVisibleText(message);
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: normalizedMessage,
            meta,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Adicionar ao histÃƒÆ’Ã‚Â³rico
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Log no console com cores, mantendo alto volume apenas em modo debug.
        const emoji = this.getLevelEmoji(level);
        const color = this.getLevelColor(level);
        const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
        const consoleLine = `${color}${emoji} [${level.toUpperCase()}] ${normalizedMessage}${metaStr}${this.resetColor()}`;
        if (level === 'error') {
            console.error(consoleLine);
        } else if (level === 'warn') {
            console.warn(consoleLine);
        } else if (this.enableDebug) {        }

        // Enviar logs crÃƒÆ’Ã‚Â­ticos para o servidor
        if (level === 'error' || level === 'warn') {
            this.sendLogToServer(logEntry);
        }

        return logEntry;
    }

    getLevelEmoji(level) {
        const emojis = {
            error: '[x]',
            warn: '[!]',
            info: '[i]',
            debug: '[d]',
            success: '[ok]'
        };
        return emojis[level] || '[>]';
    }

    getLevelColor(level) {
        const colors = {
            error: '\x1b[31m', // vermelho
            warn: '\x1b[33m',  // amarelo
            info: '\x1b[36m',  // ciano
            debug: '\x1b[35m', // magenta
            success: '\x1b[32m' // verde
        };
        return colors[level] || '';
    }

    resetColor() {
        return '\x1b[0m';
    }

    error(message, meta = {}) {
        return this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        return this.log('warn', message, meta);
    }

    info(message, meta = {}) {
        return this.log('info', message, meta);
    }

    debug(message, meta = {}) {
        if (this.enableDebug) {
            return this.log('debug', message, meta);
        }
    }

    success(message, meta = {}) {
        return this.log('success', message, meta);
    }

    async sendLogToServer(logEntry) {
        try {
            await fetch('/api/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            // Silenciar erro para nÃƒÆ’Ã‚Â£o criar loop
            console.warn('Falha ao enviar log para servidor:', error);
        }
    }

    getLogs() {
        return this.logs;
    }

    clearLogs() {
        this.logs = [];
    }

    setDebug(enabled) {
        this.enableDebug = enabled;
        localStorage.setItem('depara-debug', enabled.toString());
    }

    setLogLevel(level) {
        this.logLevel = level;
        localStorage.setItem('depara-log-level', level);
    }
}

// InstÃƒÆ’Ã‚Â¢ncia global do logger
const logger = new Logger();

class DeParaUI {
    constructor() {
        this.currentTab = 'dashboard';
        this.workflows = [];
        this.folders = [];
        this.settings = {};
        this.currentWorkflowStep = 1;
        this.isExecutingOperation = false;
        this.persistedConfig = null;
        this.screensaverConfig = this.getDefaultScreensaverConfig();
        this.screensaverState = {
            isActive: false,
            timerId: null,
            savedUIState: null,
            viewerWasVisible: false,
            startedSlideshowSession: false,
            showingFallback: false,
            dedicatedActive: false,
            dedicatedSessionId: null
        };
        this.isDedicatedScreensaverWindow = this.isDedicatedScreensaverRoute();
        this.trayMinimized = false;
        this.screensaverClockInterval = null;
        this.screensaverDedicatedSyncInterval = null;
        this.refreshSchedulerInterval = null;
        this.refreshSchedulerIntervalMs = 30000;
        this.refreshVisibilityListenerAdded = false;
        this.slideshowListenersBound = false;
        this.init();
    }

    async init() {
        // Carregar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes do servidor primeiro (persiste entre reinicializacões)
        await this.loadServerConfig();        
        logger.info('Ò°�&¸�&¡â�a¬ Inicializando DePara UI...', {
            version: '2.0.0',
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });

        // Mostrar splash screen
        this.showSplashScreen();

        const startTime = Date.now();

        try {
            // Configurar event listeners primeiro
            this.setupEventListeners();
            logger.success('Event listeners configurados');

            // Inicializar cache
            this.initializeCache();
            logger.success('Cache inicializado');

            // Carregar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
            await this.loadSettings();
            logger.success('ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes carregadas');

            // Carregar pastas
            await this.loadFolders();
            logger.success('Pastas carregadas');

            // Carregar workflows
            await this.loadWorkflows();
            logger.success('Workflows carregados');

            // Iniciar scheduler unificado de monitoramento/status/dashboard
            this.startUnifiedRefreshScheduler();
            logger.success('Scheduler unificado iniciado');

            // Testar conexÃƒÆ’Ã‚Â£o com API
            const apiOnline = await this.testApiConnection();
            if (apiOnline) {
                this.showToast('DePara iniciado com sucesso!', 'success');
                logger.success('API conectada', { apiStatus: 'online' });
            } else {
                this.showToast('API nÃƒÆ’Ã‚Â£o estÃƒÆ’Ã‚Â¡ respondendo. Verifique se o servidor estÃƒÆ’Ã‚Â¡ rodando.', 'warning');
                logger.warn('API offline', { apiStatus: 'offline' });
            }

            // Atualizar status da API imediatamente
            this.updateApiStatus();
            logger.success('Status da API sincronizado');

            // Inicializar grÃƒÆ’Ã‚Â¡ficos
            this.initializeCharts();
            logger.success('GrÃƒÆ’Ã‚Â¡ficos inicializados');

            // Configurar atalhos de teclado
            this.setupKeyboardShortcuts();
            logger.success('Atalhos de teclado configurados');

            // Configurar screensaver por inatividade
            this.initScreensaverManager();
            logger.success('Screensaver configurado');
            if (this.isDedicatedScreensaverWindow) {
                this.enableDedicatedScreensaverUI();
            }

            // Configurar controles de fullscreen do dashboard
            this.setupDashboardFullscreenControls();
            logger.success('Controles de fullscreen do dashboard configurados');

            // ForÃƒÆ’Ã‚Â§ar atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o inicial da dashboard
            await this.updateDashboard();
            logger.success('Dashboard atualizada');

            // Mostrar onboarding se necessÃƒÆ’Ã‚Â¡rio
            if (!this.isDedicatedScreensaverWindow && !localStorage.getItem('depara-onboarding-completed')) {
                setTimeout(() => this.showOnboarding(), 1000);
            }

            // Configurar event listeners para substituir violaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de CSP
            this.setupCSPSafeEventListeners();

            // Configurar validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
            this.setupOperationValidation();

            // Garantir que o campo de origem esteja sempre visÃƒÆ’Ã‚Â­vel
            this.ensureSourceFieldVisible();
            this.refreshFileOpsState();
            
            // Carregar pasta salva do slideshow
            this.loadSlideshowSavedPath();
            if (this.isDedicatedScreensaverWindow) {
                await this.activateScreensaver({ forceLocal: true });
            }

            const initDuration = Date.now() - startTime;
            logger.success('ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â° InicializaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o completa!', {
                duration: `${initDuration}ms`,
                components: [
                    'eventListeners',
                    'cache',
                    'settings',
                    'folders',
                    'workflows',
                    'monitoring',
                    'apiConnection',
                    'charts',
                    'shortcuts',
                    'dashboard',
                    'validation'
                ]
            });

        } catch (error) {
            logger.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro durante inicializaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', {
                error: error.message,
                stack: error.stack,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            });
            this.showToast('Erro na inicializaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o. Verifique o console.', 'error');
        } finally {
            // Esconder splash screen apÃƒÆ’Ã‚Â³s inicializaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
            setTimeout(() => this.hideSplashScreen(), 2000);
        }
    }

    // Mostrar splash screen
    showSplashScreen() {
        const splashScreen = document.getElementById('splash-screen');
        if (splashScreen) {
            splashScreen.style.display = 'flex';
            splashScreen.classList.remove('hidden');
        }
    }

    // Esconder splash screen
    hideSplashScreen() {
        const splashScreen = document.getElementById('splash-screen');
        if (splashScreen) {
            splashScreen.classList.add('hidden');
            setTimeout(() => {
                splashScreen.style.display = 'none';
            }, 500);
        }
    }

    // Testa conexÃƒÆ’Ã‚Â£o com a API
    async testApiConnection() {
        try {
            const response = await fetch('/api/health', {
                timeout: 5000,
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            return response.ok;
        } catch (error) {
            console.warn('Erro ao testar conexÃƒÆ’Ã‚Â£o com API:', error);
            return false;
        }
    }

    // Atualiza status da API na interface
    async updateApiStatus() {
        const apiStatusElement = document.getElementById('api-status');
        const apiStatusIconElement = document.getElementById('api-status-icon');

        if (!apiStatusElement || !apiStatusIconElement) {
            console.warn('Elementos de status da API nÃƒÆ’Ã‚Â£o encontrados');
            return;
        }

        try {            const isOnline = await this.testApiConnection();

            if (isOnline) {                apiStatusElement.textContent = 'Online';
                apiStatusElement.className = 'value online';
                apiStatusIconElement.textContent = 'api';
                apiStatusIconElement.className = 'material-icons online';
            } else {                apiStatusElement.textContent = 'Offline';
                apiStatusElement.className = 'value offline';
                apiStatusIconElement.textContent = 'error';
                apiStatusIconElement.className = 'material-icons offline';
            }
        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao verificar status da API:', error);
            apiStatusElement.textContent = 'Erro';
            apiStatusElement.className = 'value offline';
            apiStatusIconElement.textContent = 'error';
            apiStatusIconElement.className = 'material-icons offline';
        }
    }
    async runScheduledUiRefresh() {
        if (document.hidden) return;
        await this.updateApiStatus();
        if (this.currentTab === 'dashboard') {
            await this.refreshDashboardData();
        }
    }

    startUnifiedRefreshScheduler() {
        if (this.refreshSchedulerInterval) {
            clearInterval(this.refreshSchedulerInterval);
            this.refreshSchedulerInterval = null;
        }

        this.runScheduledUiRefresh();
        this.refreshSchedulerInterval = setInterval(() => {
            this.runScheduledUiRefresh();
        }, this.refreshSchedulerIntervalMs);

        if (!this.refreshVisibilityListenerAdded) {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    this.runScheduledUiRefresh();
                }
            });
            this.refreshVisibilityListenerAdded = true;
        }
    }

    // Compatibilidade retroativa
    startDashboardAutoRefresh() {
        this.startUnifiedRefreshScheduler();
    }

    // Atualizar dados da dashboard
    async refreshDashboardData() {
        try {
            // Atualizar status do sistema
            await this.updateSystemStatus();

            // Atualizar atividades recentes se estiver visÃƒÆ’Ã‚Â­vel
            await this.loadRecentActivities();

            // Atualizar contadores
            await this.updateCounters();

            // Carregar operacoes agendadas para o dashboard
            await this.loadDashboardScheduledOperations();

            // Atualizar graficos apenas quando dashboard estiver ativa
            if (this.currentTab === 'dashboard') {
                await this.updateCharts();
            }

            logger.debug('Dashboard atualizada automaticamente');
        } catch (error) {
            console.warn('Erro ao atualizar dashboard:', error);
        }
    }

    // Atualizar status do sistema
    async updateSystemStatus() {
        try {
            const data = window.DeParaRuntimeStatus
                ? await window.DeParaRuntimeStatus.fetchSystemResources()
                : await (await fetch('/api/status/resources')).json();
            this.updateSystemStatusDisplay(data);
        } catch (error) {
            console.warn('Erro ao atualizar status do sistema:', error);
        }
    }

    // Atualizar atividades recentes
    async loadRecentActivities() {
        try {
            const data = window.DeParaRuntimeStatus
                ? await window.DeParaRuntimeStatus.fetchRecentActivities()
                : await (await fetch('/api/files/stats')).json();
            this.updateActivitiesDisplay(data);
        } catch (error) {
            console.warn('Erro ao carregar atividades:', error);
        }
    }

    // Carregar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes agendadas para o dashboard
    async loadDashboardScheduledOperations() {
        try {
            const data = window.DeParaRuntimeStatus
                ? await window.DeParaRuntimeStatus.fetchScheduledOperations()
                : await (await fetch('/api/files/scheduled')).json();
            this.updateDashboardScheduledOperations(data.data || []);
        } catch (error) {
            console.warn('Erro ao carregar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes agendadas para dashboard:', error);
        }
    }

    // Atualizar exibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes agendadas no dashboard
    updateDashboardScheduledOperations(operations) {
        const container = document.querySelector('#dashboard .scheduled-operations .operations-list');
        if (!container) return;

        if (operations.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhuma operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o agendada</p>';
            return;
        }

        container.innerHTML = operations.slice(0, 5).map(op => `
            <div class="operation-item ${op.active ? 'active' : 'paused'}">
                <div class="operation-info">
                    <h4>${op.name || 'OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o sem nome'}</h4>
                    <p>${op.action} - ${op.frequency}</p>
                </div>
                <div class="operation-status">
                    <span class="status-badge ${op.active ? 'active' : 'paused'}">
                        ${op.active ? 'Ativa' : 'Pausada'}
                    </span>
                </div>
            </div>
        `).join('');

        if (operations.length > 5) {
            container.innerHTML += `<p class="more-operations">+${operations.length - 5} operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes adicionais</p>`;
        }
    }

    // Atualizar display do status do sistema
    updateSystemStatusDisplay(data) {
        try {
            logger.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  Atualizando display de status do sistema', {
                memory: data.memory,
                disk: data.disk,
                activeOperations: data.activeOperations
            });

            // Atualizar uso de memÃƒÆ’Ã‚Â³ria
            const memoryElement = document.getElementById('memory-usage');
            if (memoryElement && data.memory) {
                const memoryUsage = data.memory.percentage || 0;
                memoryElement.textContent = `${memoryUsage}%`;
                logger.debug('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ MemÃƒÆ’Ã‚Â³ria atualizada', { memoryUsage });
            }

            // Atualizar uso de disco
            const diskElement = document.getElementById('disk-usage');
            if (diskElement && data.disk && data.disk.drives) {
                const drives = data.disk.drives;
                if (drives.length > 0) {
                    // Filtrar apenas discos vÃƒÆ’Ã‚Â¡lidos (com tamanho > 0)
                    const validDrives = drives.filter(drive => drive.total > 0);
                    
                    if (validDrives.length > 0) {
                        if (validDrives.length === 1) {
                            // Mostrar apenas um disco
                            const drive = validDrives[0];
                            const usedGB = Math.round(drive.used / (1024 * 1024 * 1024));
                            const totalGB = Math.round(drive.total / (1024 * 1024 * 1024));
                            diskElement.textContent = `${usedGB} GB / ${totalGB} GB`;
                        } else {
                            // Mostrar todos os discos em uma lista
                            let diskText = '';
                            let tooltipText = `Discos detectados (${validDrives.length}):\n\n`;
                            
                            validDrives.forEach((drive, index) => {
                                const driveUsedGB = Math.round(drive.used / (1024 * 1024 * 1024));
                                const driveTotalGB = Math.round(drive.total / (1024 * 1024 * 1024));
                                const driveMountpoint = drive.mountpoint || drive.drive;
                                
                                // Adicionar ao tooltip
                                tooltipText += `${index + 1}. ${driveMountpoint}: ${driveUsedGB} GB / ${driveTotalGB} GB (${drive.percentage}%)\n`;
                                
                                // Adicionar ao texto principal (mÃƒÆ’Ã‚Â¡ximo 3 discos visÃƒÆ’Ã‚Â­veis)
                                if (index < 3) {
                                    if (index > 0) diskText += ' | ';
                                    diskText += `${driveUsedGB} GB / ${driveTotalGB} GB (${driveMountpoint})`;
                                }
                            });
                            
                            // Se hÃƒÆ’Ã‚Â¡ mais de 3 discos, adicionar contador
                            if (validDrives.length > 3) {
                                diskText += ` +${validDrives.length - 3}`;
                            }
                            
                            diskElement.textContent = diskText;
                            diskElement.title = tooltipText;
                            diskElement.style.cursor = 'help';
                        }
                    } else {
                        diskElement.textContent = 'N/A';
                    }
                } else {
                    diskElement.textContent = 'N/A';
                }
                logger.debug('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Disco atualizado', { drives, validDrives: drives.filter(d => d.total > 0) });
            }

            // Atualizar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes ativas - buscar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes agendadas
            const activeOpsElement = document.getElementById('active-ops');
            if (activeOpsElement) {
                this.updateActiveOperationsCount();
            }

        } catch (error) {
            logger.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao atualizar display de status', {
                error: error.message,
                stack: error.stack,
                data: data
            });
        }
    }

    // Atualizar display de atividades recentes
    updateActivitiesDisplay(data) {
        try {
            logger.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Atualizando display de atividades', {
                activitiesCount: data?.activities?.length || 0,
                hasData: !!data
            });

            const activityList = document.getElementById('recent-activity');
            if (!activityList) {
                logger.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Elemento recent-activity nÃƒÆ’Ã‚Â£o encontrado');
                return;
            }

            // Se nÃƒÆ’Ã‚Â£o hÃƒÆ’Ã‚Â¡ dados ou atividades
            if (!data || !data.activities || data.activities.length === 0) {
                activityList.innerHTML = `
                    <div class="activity-item">
                        <span class="material-icons">info</span>
                        <span>Nenhuma atividade recente</span>
                    </div>
                `;
                logger.info('ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¹ÃƒÂ¯Ã‚Â¸Ã‚Â Nenhuma atividade para exibir');
                return;
            }

            // Renderizar atividades
            const activitiesHtml = data.activities.slice(0, 10).map(activity => {
                const icon = this.getActivityIcon(activity.type);
                const timeAgo = this.formatTimeAgo(activity.timestamp);
                return `
                    <div class="activity-item">
                        <span class="material-icons">${icon}</span>
                        <div class="activity-details">
                            <span class="activity-description">${activity.description || 'Atividade executada'}</span>
                            <span class="activity-time">${timeAgo}</span>
                        </div>
                    </div>
                `;
            }).join('');

            activityList.innerHTML = activitiesHtml;
            logger.success('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Atividades renderizadas', {
                activitiesCount: data.activities.length,
                displayedCount: Math.min(data.activities.length, 10)
            });

        } catch (error) {
            logger.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao atualizar display de atividades', {
                error: error.message,
                stack: error.stack,
                data: data
            });
        }
    }

    // Obter ÃƒÆ’Ã‚Â­cone apropriado para o tipo de atividade
    getActivityIcon(type) {
        const iconMap = {
            'move': 'drive_file_move',
            'copy': 'content_copy',
            'delete': 'delete',
            'backup': 'backup',
            'error': 'error',
            'success': 'check_circle',
            'info': 'info'
        };
        return iconMap[type] || 'info';
    }

    // Formatar tempo relativo
    formatTimeAgo(timestamp) {
        if (!timestamp) return '';

        const now = new Date();
        const activityTime = new Date(timestamp);
        const diffMs = now - activityTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'agora';
        if (diffMins < 60) return `${diffMins}min atrÃƒÆ’Ã‚Â¡s`;
        if (diffHours < 24) return `${diffHours}h atrÃƒÆ’Ã‚Â¡s`;
        return `${diffDays}d atrÃƒÆ’Ã‚Â¡s`;
    }

    // Navegar para caminho de origem
    browseSourcePath() {
        if (typeof this.showFolderBrowser === 'function') {
            this.showFolderBrowser('source');
        } else {
            console.warn('FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o showFolderBrowser nÃƒÆ’Ã‚Â£o encontrada');
            // Fallback: apenas focar no input
            const input = document.getElementById('source-path');
            if (input) {
                input.focus();
                input.select();
            }
        }
    }

    // Navegar para caminho de destino
    browseDestPath() {
        if (typeof this.showFolderBrowser === 'function') {
            this.showFolderBrowser('target');
        } else {
            console.warn('FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o showFolderBrowser nÃƒÆ’Ã‚Â£o encontrada');
            // Fallback: apenas focar no input
            const input = document.getElementById('dest-path');
            if (input) {
                input.focus();
                input.select();
            }
        }
    }

    // Executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o simples
    async executeSimpleOperation(action) {
        if (this.isExecutingOperation) {
            this.showToast('OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o jÃƒÆ’Ã‚Â¡ em andamento. Aguarde...', 'warning');
            return;
        }

        const sourcePath = document.getElementById('source-path').value.trim();
        const destPath = document.getElementById('dest-path').value.trim();
        const recursive = document.getElementById('recursive-option').checked;
        const backup = document.getElementById('backup-option').checked;

        // ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o bÃƒÆ’Ã‚Â¡sica
        if (!sourcePath) {
            this.showToast('Digite o caminho de origem', 'error');
            return;
        }

        if ((action === 'move' || action === 'copy') && !destPath) {
            this.showToast('Digite o caminho de destino', 'error');
            return;
        }

        // Marcar como executando
        this.isExecutingOperation = true;

        try {
            // Mostrar resultado da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
            const resultDiv = document.getElementById('operation-result');
            const resultIcon = document.getElementById('result-icon');
            const resultText = document.getElementById('result-text');

            if (resultDiv && resultIcon && resultText) {
                resultDiv.style.display = 'block';
                resultIcon.textContent = 'hourglass_empty';
                resultText.textContent = 'Executando operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o...';
            }

            // Preparar dados da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
            const operationData = {
                action: action,
                sourcePath: sourcePath,
                targetPath: destPath,
                recursive: recursive,
                createBackup: backup
            };

            logger.info('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ Executando operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', {
                operation: operationData.action,
                sourcePath: operationData.sourcePath,
                targetPath: operationData.targetPath,
                recursive: operationData.recursive,
                createBackup: operationData.createBackup
            });

            // Enviar para API
            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(operationData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Sucesso
                if (resultDiv && resultIcon && resultText) {
                    resultIcon.textContent = 'check_circle';
                    resultText.textContent = `OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o concluÃƒÆ’Ã‚Â­da com sucesso! ${result.message || ''}`;
                    resultDiv.className = 'operation-result success';
                }
                this.showToast('OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o executada com sucesso!', 'success');

                logger.success('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o executada com sucesso', {
                    operation: operationData.action,
                    message: result.message,
                    responseTime: Date.now() - Date.now() // TODO: calcular tempo real
                });

                // Atualizar contadores e atividades
                await this.refreshDashboardData();

            } else {
                // Erro
                const errorMsg = result.message || 'Erro desconhecido na operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o';
                if (resultDiv && resultIcon && resultText) {
                    resultIcon.textContent = 'error';
                    resultText.textContent = `Erro: ${errorMsg}`;
                    resultDiv.className = 'operation-result error';
                }
                this.showToast(errorMsg, 'error');
                logger.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro na operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', {
                    operation: operationData.action,
                    error: errorMsg,
                    result: result,
                    statusCode: response.status
                });
            }

        } catch (error) {
            const errorMsg = error.message || 'Erro de conexÃƒÆ’Ã‚Â£o';

            logger.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', {
                operation: operation,
                error: errorMsg,
                stack: error.stack,
                sourcePath: sourcePath,
                destPath: destPath
            });

            const resultDiv = document.getElementById('operation-result');
            const resultIcon = document.getElementById('result-icon');
            const resultText = document.getElementById('result-text');

            if (resultDiv && resultIcon && resultText) {
                resultIcon.textContent = 'error';
                resultText.textContent = `Erro: ${errorMsg}`;
                resultDiv.className = 'operation-result error';
            }

            this.showToast(errorMsg, 'error');
        } finally {
            this.isExecutingOperation = false;
            logger.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o finalizada', { operation });
        }
    }

    // Iniciar slideshow
    async startSlideshow() {        
        const folderPath = document.getElementById('slideshow-folder-path').value.trim();

        if (!folderPath) {
            this.showToast('Digite o caminho da pasta', 'error');
            return;
        }

        // Coletar extensÃƒÆ’Ã‚Âµes selecionadas
        const selectedExtensions = [];
        const extensionCheckboxes = document.querySelectorAll('.extension-selector input[type="checkbox"]:checked');
        extensionCheckboxes.forEach(checkbox => {
            selectedExtensions.push(checkbox.value);
        });

        if (selectedExtensions.length === 0) {
            this.showToast('Selecione pelo menos uma extensÃƒÆ’Ã‚Â£o de arquivo', 'error');
            return;
        }
        await this.loadSlideshowImages(folderPath, selectedExtensions, true, this.slideshowConfig.interval);
        this.startSlideshowViewer();
    }

    // ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de campos com feedback visual
    validateField(field, type) {
        const value = field.value.trim();
        const validationDiv = field.parentNode.querySelector('.validation-message');
        const fieldContainer = field.parentNode;

        if (!validationDiv) return true;

        let isValid = true;
        let message = '';

        switch (type) {
            case 'name':
                if (!value) {
                    isValid = false;
                    message = 'Nome ÃƒÆ’Ã‚Â© obrigatÃƒÆ’Ã‚Â³rio';
                } else if (value.length < 3) {
                    isValid = false;
                    message = 'Nome deve ter pelo menos 3 caracteres';
                } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(value)) {
                    isValid = false;
                    message = 'Nome contÃƒÆ’Ã‚Â©m caracteres invÃƒÆ’Ã‚Â¡lidos';
                }
                break;

            case 'path':
                if (!value) {
                    isValid = false;
                    message = 'Caminho ÃƒÆ’Ã‚Â© obrigatÃƒÆ’Ã‚Â³rio';
                } else if (!/^[a-zA-Z0-9\s\-_\/\\:.]+$/.test(value)) {
                    isValid = false;
                    message = 'Caminho contÃƒÆ’Ã‚Â©m caracteres invÃƒÆ’Ã‚Â¡lidos';
                }
                break;

            case 'email':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    isValid = false;
                    message = 'Email invÃƒÆ’Ã‚Â¡lido';
                }
                break;

            default:
                isValid = !!value;
                message = 'Campo obrigatÃƒÆ’Ã‚Â³rio';
        }

        // Atualizar feedback visual
        if (isValid) {
            validationDiv.textContent = '';
            validationDiv.className = 'validation-message';
            field.classList.remove('invalid');
            field.classList.add('valid');
            fieldContainer.classList.remove('error');
        } else {
            validationDiv.textContent = message;
            validationDiv.className = 'validation-message error';
            field.classList.remove('valid');
            field.classList.add('invalid');
            fieldContainer.classList.add('error');
        }

        return isValid;
    }

    // ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de formulÃƒÆ’Ã‚Â¡rio completo
    validateForm(formSelector) {
        const form = document.querySelector(formSelector);
        if (!form) return false;

        const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            const fieldType = field.getAttribute('data-validation-type') || 'text';
            if (!this.validateField(field, fieldType)) {
                isValid = false;
            }
        });

        return isValid;
    }

    // Garantir que o campo de origem esteja sempre visÃƒÆ’Ã‚Â­vel
    ensureSourceFieldVisible() {
        const sourceField = document.getElementById('source-folder-path');
        const sourceFieldParent = sourceField?.parentElement;
        
        if (sourceFieldParent) {
            sourceFieldParent.style.display = 'block';        } else {
            console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Campo source-folder-path nÃƒÆ’Ã‚Â£o encontrado');
        }
    }
    
    // Carregar pasta salva do slideshow
    loadSlideshowSavedPath() {
        const savedPath = this.getSlideshowSelectedPath();
        if (savedPath) {
            const slideshowField = document.getElementById('slideshow-folder-path');
            if (slideshowField) {
                // Se o caminho salvo for relativo, converter para absoluto
                let finalPath = savedPath;
                if (!savedPath.startsWith('/') && !savedPath.match(/^[A-Za-z]:/)) {
                    const basePath = '/mnt/lytspot/@SYNC@/_@@PICZ & VIDEOS LYT @@_/_@LYT PicZ por ANO@_';
                    finalPath = `${basePath}/${savedPath}`;                }
                
                // Verificar se o caminho jÃƒÆ’Ã‚Â¡ contÃƒÆ’Ã‚Â©m a pasta base (evitar duplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o)
                if (finalPath.includes('/_@LYT PicZ por ANO@_/_@LYT PicZ por ANO@_/')) {
                    finalPath = finalPath.replace('/_@LYT PicZ por ANO@_/_@LYT PicZ por ANO@_/', '/_@LYT PicZ por ANO@_/');                }
                
                slideshowField.value = finalPath;            }
        }
    }
    
    // Embaralhar array (algoritmo Fisher-Yates)
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o em tempo real para campos de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    setupOperationValidation() {
        // Campos de origem e destino no dashboard
        const sourcePath = document.getElementById('source-path');
        const destPath = document.getElementById('dest-path');

        if (sourcePath) {
            sourcePath.addEventListener('blur', () => {
                this.validateField(sourcePath, 'path');
                this.updateOperationButtonsState();
            });
            sourcePath.addEventListener('input', () => {
                // Limpar validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o quando usuÃƒÆ’Ã‚Â¡rio comeÃƒÆ’Ã‚Â§a a digitar
                const validationDiv = sourcePath.parentNode.querySelector('.validation-message');
                if (validationDiv) {
                    validationDiv.textContent = '';
                    validationDiv.className = 'validation-message';
                    sourcePath.classList.remove('invalid', 'valid');
                    sourcePath.parentNode.classList.remove('error');
                }
                // Atualizar estado dos botÃƒÆ’Ã‚Âµes
                this.updateOperationButtonsState();
            });
        }

        if (destPath) {
            destPath.addEventListener('blur', () => {
                this.validateField(destPath, 'path');
                this.updateOperationButtonsState();
            });
            destPath.addEventListener('input', () => {
                const validationDiv = destPath.parentNode.querySelector('.validation-message');
                if (validationDiv) {
                    validationDiv.textContent = '';
                    validationDiv.className = 'validation-message';
                    destPath.classList.remove('invalid', 'valid');
                    destPath.parentNode.classList.remove('error');
                }
                // Atualizar estado dos botÃƒÆ’Ã‚Âµes
                this.updateOperationButtonsState();
            });
        }
    }

    // Feedback visual para botÃƒÆ’Ã‚Âµes de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    updateOperationButtonsState() {
        const sourcePath = document.getElementById('source-path');
        const destPath = document.getElementById('dest-path');
        const operationButtons = document.querySelectorAll('.simple-operation-btn');

        const hasSourcePath = sourcePath && sourcePath.value.trim();
        const hasDestPath = destPath && destPath.value.trim();

        operationButtons.forEach(btn => {
            const operation = btn.getAttribute('data-operation');

            if (operation === 'delete') {
                // Delete sÃƒÆ’Ã‚Â³ precisa do caminho de origem
                btn.disabled = !hasSourcePath;
                btn.title = hasSourcePath ? 'Executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de exclusÃƒÆ’Ã‚Â£o' : 'Digite o caminho de origem primeiro';
            } else {
                // Move e copy precisam de origem e destino
                btn.disabled = !(hasSourcePath && hasDestPath);
                btn.title = (hasSourcePath && hasDestPath) ?
                    `Executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de ${operation}` :
                    'Digite os caminhos de origem e destino primeiro';
            }

            // Feedback visual
            if (btn.disabled) {
                btn.classList.add('disabled');
            } else {
                btn.classList.remove('disabled');
            }
        });
    }

    // Atualizar contadores
    async updateCounters() {
        try {
            // Contar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes ativas
            const scheduledResponse = await fetch('/api/files/scheduled');
            if (scheduledResponse.ok) {
                const scheduledData = await scheduledResponse.json();
                const activeOps = (scheduledData.data || []).filter(op => op.active !== false).length;
                document.getElementById('active-ops').textContent = activeOps;
            }
        } catch (error) {
            console.warn('Erro ao atualizar contadores:', error);
        }
    }

    // Atualizar contador de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes ativas
    async updateActiveOperationsCount() {
        try {
            const response = await fetch('/api/files/scheduled');
            if (response.ok) {
                const data = await response.json();
                const activeOps = data.data ? data.data.filter(op => op.active !== false).length : 0;
                const activeOpsElement = document.getElementById('active-ops');
                if (activeOpsElement) {
                    activeOpsElement.textContent = activeOps;
                    logger.debug('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes ativas atualizadas', { activeOps });
                }
            }
        } catch (error) {
            logger.warn('Erro ao atualizar contador de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes ativas:', error);
            const activeOpsElement = document.getElementById('active-ops');
            if (activeOpsElement) {
                activeOpsElement.textContent = '0';
            }
        }
    }

    // Sistema de Cache
    initializeCache() {
        this.cache = {
            settings: null,
            folders: null,
            workflows: null,
            operations: null,
            stats: null,
            timestamps: {}
        };
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
    }

    // Verificar se cache ÃƒÆ’Ã‚Â© vÃƒÆ’Ã‚Â¡lido
    isCacheValid(key) {
        const timestamp = this.cache.timestamps[key];
        if (!timestamp) return false;
        return (Date.now() - timestamp) < this.cacheExpiry;
    }

    // Obter dados do cache ou API
    async getCachedData(key, apiCall, useCache = true) {
        if (useCache && this.isCacheValid(key) && this.cache[key]) {            return this.cache[key];
        }

        try {
            const data = await apiCall();
            this.cache[key] = data;
            this.cache.timestamps[key] = Date.now();            return data;
        } catch (error) {
            console.warn(`Erro ao carregar ${key}:`, error);
            // Retornar cache antigo se disponÃƒÆ’Ã‚Â­vel
            if (this.cache[key]) {                return this.cache[key];
            }
            throw error;
        }
    }

    // Limpar cache especÃƒÆ’Ã‚Â­fico
    clearCache(key = null) {
        if (key) {
            this.cache[key] = null;
            delete this.cache.timestamps[key];        } else {
            this.initializeCache();        }
    }

    // MÃƒÆ’Ã‚Â©todos de cache especÃƒÆ’Ã‚Â­ficos
    async loadSettingsCached() {
        return this.getCachedData('settings', async () => {
            const response = await fetch('/api/health');
            if (!response.ok) throw new Error('Erro ao carregar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes');
            return response.json();
        });
    }

    async loadFoldersCached() {
        return this.getCachedData('folders', async () => {
            // Simular carregamento de pastas (implementar conforme necessÃƒÆ’Ã‚Â¡rio)
            return [];
        });
    }

    async loadWorkflowsCached() {
        return this.getCachedData('workflows', async () => {
            // Simular carregamento de workflows (implementar conforme necessÃƒÆ’Ã‚Â¡rio)
            return [];
        });
    }

    async loadOperationsCached() {
        return this.getCachedData('operations', async () => {
            const response = await fetch('/api/files/scheduled');
            if (!response.ok) throw new Error('Erro ao carregar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes');
            return response.json();
        });
    }

    async loadStatsCached() {
        return this.getCachedData('stats', async () => {
            const response = await fetch('/api/files/stats');
            if (!response.ok) throw new Error('Erro ao carregar estatÃƒÆ’Ã‚Â­sticas');
            return response.json();
        }, false); // Stats sempre frescos
    }

    // Sistema de GrÃƒÆ’Ã‚Â¡ficos
    initializeCharts() {
        this.chartData = {
            operations: 0,
            memory: 0,
            disk: 0
        };
        this.updateCharts();
    }

    async updateCharts() {
        try {
            // Obter dados de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
            const operationsResponse = await fetch('/api/files/scheduled');
            if (operationsResponse.ok) {
                const operationsData = await operationsResponse.json();
                this.chartData.operations = operationsData.data.length;
            }
            // Usar dados reais de recursos
            const resourcesResponse = await fetch('/api/status/resources');
            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                this.chartData.memory = Number(resourcesData?.memory?.percentage) || 0;
                const drives = Array.isArray(resourcesData?.disk?.drives) ? resourcesData.disk.drives : [];
                const validDrives = drives.filter((drive) => Number(drive.total) > 0);
                if (validDrives.length > 0) {
                    const used = validDrives.reduce((sum, drive) => sum + (Number(drive.used) || 0), 0);
                    const total = validDrives.reduce((sum, drive) => sum + (Number(drive.total) || 0), 0);
                    this.chartData.disk = total > 0 ? Math.round((used / total) * 100) : 0;
                } else {
                    this.chartData.disk = 0;
                }
            }

            this.renderChart();
        } catch (error) {
            console.warn('Erro ao atualizar grÃƒÆ’Ã‚Â¡ficos:', error);
        }
    }

    renderChart() {
        const canvas = document.getElementById('usage-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Limpar canvas
        ctx.clearRect(0, 0, width, height);

        // Dados do grÃƒÆ’Ã‚Â¡fico
        const data = [
            { label: 'OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes', value: this.chartData.operations, color: '#667eea', max: 20 },
            { label: 'MemÃƒÆ’Ã‚Â³ria', value: this.chartData.memory, color: '#764ba2', max: 100 },
            { label: 'Disco', value: this.chartData.disk, color: '#f093fb', max: 100 }
        ];

        const barWidth = 40;
        const spacing = 60;
        const startX = 50;
        const maxBarHeight = height - 60;

        data.forEach((item, index) => {
            const x = startX + (index * spacing);
            const barHeight = (item.value / item.max) * maxBarHeight;
            const y = height - 40 - barHeight;

            // Desenhar barra
            ctx.fillStyle = item.color;
            ctx.fillRect(x, y, barWidth, barHeight);

            // Desenhar borda
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, barWidth, barHeight);

            // Desenhar valor
            ctx.fillStyle = '#333';
            ctx.font = '12px Roboto';
            ctx.textAlign = 'center';
            ctx.fillText(item.value.toString(), x + barWidth/2, y - 5);

            // Desenhar label
            ctx.fillStyle = '#666';
            ctx.font = '10px Roboto';
            ctx.fillText(item.label, x + barWidth/2, height - 20);
        });
    }

    // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o global para atualizar grÃƒÆ’Ã‚Â¡ficos
    refreshCharts() {
        if (window.deParaUI) {
            window.deParaUI.updateCharts();
        }
    }

    // Sistema de Atalhos de Teclado
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ignorar se usuÃƒÆ’Ã‚Â¡rio estÃƒÆ’Ã‚Â¡ digitando em input
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            // Ctrl+S: Salvar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
            if (event.ctrlKey && event.key === 's') {
                event.preventDefault();
                this.quickSave();
                this.showToast('ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes salvas!', 'success');
                return;
            }

            // Ctrl+R: Atualizar dados
            if (event.ctrlKey && event.key === 'r') {
                event.preventDefault();
                this.refreshAllData();
                this.showToast('Dados atualizados!', 'success');
                return;
            }

            // F1: Mostrar ajuda
            if (event.key === 'F1') {
                event.preventDefault();
                this.showKeyboardHelp();
                return;
            }

            // Alt+D: Ir para Dashboard
            if (event.altKey && event.key === 'd') {
                event.preventDefault();
                this.switchTab('dashboard');
                return;
            }

            // Alt+F: Ir para OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de Arquivos
            if (event.altKey && event.key === 'f') {
                event.preventDefault();
                this.switchTab('fileops');
                return;
            }

            // Alt+S: Ir para OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes Agendadas
            if (event.altKey && event.key === 's') {
                event.preventDefault();
                this.switchTab('scheduled');
                return;
            }

            // Alt+B: Ir para Backups
            if (event.altKey && event.key === 'b') {
                event.preventDefault();
                this.switchTab('backups');
                return;
            }

            // Alt+C: Ir para ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
            if (event.altKey && event.key === 'c') {
                event.preventDefault();
                this.switchTab('settings');
                return;
            }

            // F11: Alternar fullscreen do dashboard
            if (event.key === 'F11') {
                event.preventDefault();
                this.toggleDashboardFullscreen();
                return;
            }

            // Escape: Fechar modais
            if (event.key === 'Escape') {
                this.closeAllModals();
                return;
            }
        });
    }

    // Alternar fullscreen do dashboard
    toggleDashboardFullscreen() {
        const isFullscreen = !!(document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement || 
                               document.msFullscreenElement);
        
        if (isFullscreen) {
            this.exitDashboardFullscreen();
        } else {
            this.enterDashboardFullscreen();
        }
    }

    // Entrar em fullscreen do dashboard
    enterDashboardFullscreen() {        
        const element = document.documentElement;
        
        // Tentar diferentes mÃƒÆ’Ã‚Â©todos de fullscreen
        if (element.requestFullscreen) {
            element.requestFullscreen().then(() => {
                this.showDashboardFullscreenControls();
            }).catch(err => {
                console.warn('Erro ao entrar em fullscreen:', err);
            });
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
            this.showDashboardFullscreenControls();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
            this.showDashboardFullscreenControls();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
            this.showDashboardFullscreenControls();
        } else {
            console.warn('Fullscreen nÃƒÆ’Ã‚Â£o suportado neste navegador');
        }
    }

    // Sair do fullscreen do dashboard
    exitDashboardFullscreen() {        
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        
        this.hideDashboardFullscreenControls();
    }

    // Mostrar controles de fullscreen do dashboard
    showDashboardFullscreenControls() {
        const controls = document.getElementById('dashboard-fullscreen-controls');
        if (controls) {
            controls.style.display = 'flex';
            controls.style.flexDirection = 'row';
            controls.style.alignItems = 'center';            
            // Adicionar fade-in para melhor UX
            controls.style.opacity = '0';
            controls.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                controls.style.transition = 'all 0.3s ease';
                controls.style.opacity = '1';
                controls.style.transform = 'translateY(0)';
            }, 10);
        }
    }

    // Esconder controles de fullscreen do dashboard
    hideDashboardFullscreenControls() {
        const controls = document.getElementById('dashboard-fullscreen-controls');
        if (controls) {
            // Adicionar fade-out para melhor UX
            controls.style.transition = 'all 0.3s ease';
            controls.style.opacity = '0';
            controls.style.transform = 'translateY(-10px)';
            
            setTimeout(() => {
                controls.style.display = 'none';            }, 300);
        }
    }

    // Fechar aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    closeApplication() {        
        // Primeiro sair do fullscreen se estiver ativo
        this.exitDashboardFullscreen();
        
        // Aguardar um pouco para garantir que as operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes sejam concluÃƒÆ’Ã‚Â­das
        setTimeout(() => {
            // Tentar fechar a janela do navegador/Electron
            if (window.close) {
                window.close();
            } else if (window.electronAPI && window.electronAPI.closeApp) {
                // Se estiver rodando no Electron
                window.electronAPI.closeApp();
            } else {
                // Fallback: mostrar mensagem para o usuÃƒÆ’Ã‚Â¡rio
                alert('Para fechar a aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, use Alt+F4 ou feche a janela do navegador.');
            }
        }, 500);
    }

    // Configurar controles de fullscreen do dashboard
    setupDashboardFullscreenControls() {
        // BotÃƒÆ’Ã‚Â£o sair do fullscreen
        const exitFullscreenBtn = document.getElementById('dashboard-exit-fullscreen-btn');
        if (exitFullscreenBtn) {
            exitFullscreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();                logger.info('BotÃƒÆ’Ã‚Â£o sair fullscreen clicado', { source: 'dashboard-controls' });
                this.exitDashboardFullscreen();
            });            logger.debug('Listener do botÃƒÆ’Ã‚Â£o exit fullscreen configurado');
        } else {
            console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â BotÃƒÆ’Ã‚Â£o exit fullscreen nÃƒÆ’Ã‚Â£o encontrado');
            logger.warn('BotÃƒÆ’Ã‚Â£o exit fullscreen nÃƒÆ’Ã‚Â£o encontrado no DOM');
        }

        // BotÃƒÆ’Ã‚Â£o fechar aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        const closeAppBtn = document.getElementById('dashboard-close-app-btn');
        if (closeAppBtn) {
            closeAppBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();                logger.info('BotÃƒÆ’Ã‚Â£o fechar aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o clicado', { source: 'dashboard-controls' });
                this.closeApplication();
            });            logger.debug('Listener do botÃƒÆ’Ã‚Â£o fechar aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o configurado');
        } else {
            console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â BotÃƒÆ’Ã‚Â£o fechar aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nÃƒÆ’Ã‚Â£o encontrado');
            logger.warn('BotÃƒÆ’Ã‚Â£o fechar aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nÃƒÆ’Ã‚Â£o encontrado no DOM');
        }

        // BotÃƒÆ’Ã‚Â£o de fullscreen no header
        const headerFullscreenBtn = document.getElementById('header-fullscreen-btn');
        if (headerFullscreenBtn) {
            headerFullscreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();                this.toggleDashboardFullscreen();
            });        }

        // Listener para mudanÃƒÆ’Ã‚Â§as de fullscreen do dashboard
        document.addEventListener('fullscreenchange', () => {
            this.handleDashboardFullscreenChange();
        });
        document.addEventListener('webkitfullscreenchange', () => {
            this.handleDashboardFullscreenChange();
        });
        document.addEventListener('mozfullscreenchange', () => {
            this.handleDashboardFullscreenChange();
        });
        document.addEventListener('msfullscreenchange', () => {
            this.handleDashboardFullscreenChange();
        });
    }

    // Lidar com mudanÃƒÆ’Ã‚Â§as de fullscreen do dashboard
    handleDashboardFullscreenChange() {        
        const isFullscreen = !!(document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement || 
                               document.msFullscreenElement);        
        // Atualizar botÃƒÆ’Ã‚Â£o do header
        this.updateHeaderFullscreenButton(isFullscreen);
        
        if (isFullscreen) {
            this.showDashboardFullscreenControls();
        } else {
            this.hideDashboardFullscreenControls();
        }
    }

    // Atualizar botÃƒÆ’Ã‚Â£o de fullscreen no header
    updateHeaderFullscreenButton(isFullscreen) {
        const headerBtn = document.getElementById('header-fullscreen-btn');
        if (headerBtn) {
            const icon = headerBtn.querySelector('.material-icons');
            const text = headerBtn.querySelector('span:not(.material-icons)') || headerBtn.childNodes[headerBtn.childNodes.length - 1];
            
            if (isFullscreen) {
                // Modo fullscreen - esconder botÃƒÆ’Ã‚Â£o do header para evitar redundÃƒÆ’Ã‚Â¢ncia
                headerBtn.style.display = 'none';            } else {
                // Modo normal - mostrar botÃƒÆ’Ã‚Â£o do header
                headerBtn.style.display = 'flex';
                if (icon) icon.textContent = 'fullscreen';
                if (text) text.textContent = 'Tela Cheia';
                headerBtn.title = 'Alternar tela cheia (F11)';
                headerBtn.style.background = 'rgba(52,144,220,0.1)';
                headerBtn.style.borderColor = 'rgba(52,144,220,0.3)';            }
        }
    }

    // Salvar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes rapidamente
    async quickSave() {
        try {
            // Salvar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes da aba atual
            if (this.currentTab === 'settings') {
                await this.saveSettings();
            } else if (this.currentTab === 'backups') {
                await this.updateBackupConfig();
            }
        } catch (error) {
            console.warn('Erro ao salvar rapidamente:', error);
        }
    }

    // Atualizar todos os dados
    async refreshAllData() {
        this.clearCache(); // Limpar cache para forÃƒÆ’Ã‚Â§ar atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        await this.refreshDashboardData();
        await this.updateCharts();
        await this.loadOperationsCached();
    }

    // Trocar aba
    switchTab(tabId) {
        const tabButton = document.querySelector(`[data-tab="${tabId}"]`);
        if (tabButton) {
            tabButton.click();
        }
    }

    // Fechar todos os modais
    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }

    getScreensaverConfigLegacy() {
        const defaults = {
            enabled: true,
            idleMinutes: 3,
            exitMode: 'esc_only'
        };
        try {
            const raw = localStorage.getItem('screensaverConfig');
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            return {
                enabled: parsed.enabled !== false,
                idleMinutes: Math.max(1, Number(parsed.idleMinutes) || 3),
                exitMode: 'esc_only'
            };
        } catch {
            return defaults;
        }
    }

    isDedicatedScreensaverRoute() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('screensaver') === '1' && params.get('dedicated') === '1';
        } catch {
            return false;
        }
    }

    updateScreensaverStatusLabel() {
        const statusEl = document.getElementById('screensaver-config-status');
        if (!statusEl) return;

        let runtimeState = 'inativo';
        if (!this.screensaverConfig.enabled) {
            runtimeState = 'desativado';
        } else if (this.isDedicatedScreensaverWindow || this.screensaverState.dedicatedActive) {
            runtimeState = 'ativo dedicado';
        } else if (this.screensaverState.isActive) {
            runtimeState = 'ativo local';
        }

        statusEl.textContent = `Saida: ESC apenas | Estado: ${runtimeState}`;
    }

    async openDedicatedScreensaverWindow() {
        if (this.screensaverState.dedicatedActive) {
            return true;
        }
        this.disarmDedicatedScreensaverTimer();

        try {
            const response = await fetch('/api/tray/screensaver/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result?.error?.message || `HTTP ${response.status}`);
            }
            if (result?.skipped) {
                return false;
            }

            this.screensaverState.dedicatedActive = true;
            this.screensaverState.dedicatedSessionId = result?.data?.sessionId || null;
            this.updateScreensaverStatusLabel();
            return true;
        } catch (error) {
            console.warn('Erro ao abrir screensaver dedicado:', error);
            return false;
        }
    }

    persistSlideshowSelectedPathLegacy(rawPath) {
        const normalizedPath = (rawPath || '').trim();
        if (!normalizedPath) return '';

        try {
            localStorage.setItem('slideshowSelectedPath', normalizedPath);
        } catch (error) {
            console.warn('Falha ao persistir pasta do slideshow:', error);
        }

        // Persistir no servidor (sobrevive a resets de localStorage)
        fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'slideshowSelectedPath', value: normalizedPath })
        }).catch(err => console.warn('Erro ao persistir slideshowSelectedPath no servidor:', err));

        const field = document.getElementById('slideshow-folder-path');
        if (field) {
            field.value = normalizedPath;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }

        return normalizedPath;
    }

    async armDedicatedScreensaverTimer() {
        if (!this.screensaverConfig.enabled || this.isDedicatedScreensaverWindow || !this.trayMinimized) return;
        try {
            await fetch('/api/tray/screensaver/arm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idleMinutes: this.screensaverConfig.idleMinutes })
            });
        } catch (error) {
            console.warn('Erro ao armar timer dedicado do screensaver:', error);
        }
    }

    async disarmDedicatedScreensaverTimer() {
        if (this.isDedicatedScreensaverWindow) return;
        try {
            await fetch('/api/tray/screensaver/disarm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true
            });
        } catch (error) {
            console.warn('Erro ao desarmar timer dedicado do screensaver:', error);
        }
    }

    async handleAppMinimizedToTray() {
        if (this.isDedicatedScreensaverWindow) return;
        this.trayMinimized = true;
        await this.disarmDedicatedScreensaverTimer();
        if (this.screensaverConfig.enabled && !this.screensaverState.isActive) {
            await this.armDedicatedScreensaverTimer();
        }
    }

    async closeDedicatedScreensaverWindow() {
        if (!this.screensaverState.dedicatedActive && !this.isDedicatedScreensaverWindow) {
            return true;
        }

        try {
            await fetch('/api/tray/screensaver/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true
            });
        } catch (error) {
            console.warn('Erro ao fechar screensaver dedicado:', error);
        } finally {
            this.screensaverState.dedicatedActive = false;
            this.screensaverState.dedicatedSessionId = null;
            this.updateScreensaverStatusLabel();
        }

        return true;
    }

    async syncDedicatedScreensaverStatus() {
        try {
            const response = await fetch('/api/tray/status');
            const result = await response.json();
            if (!response.ok || !result.success) return;

            this.screensaverState.dedicatedActive = Boolean(result?.data?.screensaverDedicatedActive);
            this.screensaverState.dedicatedSessionId = result?.data?.screensaverSessionId || null;
            this.trayMinimized = Boolean(result?.data?.trayMinimized);
            this.updateScreensaverStatusLabel();
        } catch (error) {
            console.warn('Erro ao sincronizar status do screensaver dedicado:', error);
        }
    }

    enableDedicatedScreensaverUI() {
        document.body.classList.add('screensaver-dedicated-window');

        if (!document.getElementById('screensaver-dedicated-style')) {
            const style = document.createElement('style');
            style.id = 'screensaver-dedicated-style';
            style.textContent = `
                body.screensaver-dedicated-window .header,
                body.screensaver-dedicated-window .main,
                body.screensaver-dedicated-window #dashboard-fullscreen-controls,
                body.screensaver-dedicated-window .toast-container {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Aplicar CSS fullscreen imediatamente (nao depende de gesto do usuario)
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) viewer.classList.add('fullscreen-override');
        document.body.classList.add('slideshow-active-fullscreen');

        // Tentar fullscreen nativo apos delay (browser precisa de tempo para inicializar)
        setTimeout(() => {
            const target = document.documentElement;
            const fn = target.requestFullscreen || target.webkitRequestFullscreen
                || target.mozRequestFullScreen || target.msRequestFullscreen;
            if (fn) fn.call(target).catch(() => {});
            fetch('/api/tray/maximize', { method: 'POST' }).catch(() => {});
        }, 500);
    }

    initScreensaverManager() {
        this.createScreensaverFallback();
        localStorage.setItem('screensaverConfig', JSON.stringify(this.screensaverConfig));
        this.setupScreensaverSettingsUI();
        const activityEvents = ['mousemove', 'mousedown', 'wheel', 'touchstart', 'keydown'];
        activityEvents.forEach((eventName) => {
            document.addEventListener(eventName, () => {
                if (this.trayMinimized && !document.hidden) {
                    this.trayMinimized = false;
                    this.disarmDedicatedScreensaverTimer();
                }
                if (!this.screensaverState.isActive) {
                    this.resetScreensaverTimer();
                }
            }, { passive: true });
        });

        document.addEventListener('keydown', (event) => {
            if (!this.screensaverState.isActive) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.deactivateScreensaver();
                return;
            }
            if (this.screensaverState.showingFallback) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        }, true);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.trayMinimized = false;
                this.disarmDedicatedScreensaverTimer();
                if (!this.screensaverState.isActive) this.resetScreensaverTimer();
                if (!this.isDedicatedScreensaverWindow) {
                    this.syncDedicatedScreensaverStatus();
                }
            }
        });

        this.resetScreensaverTimer();
        this.updateScreensaverStatusLabel();
        if (!this.isDedicatedScreensaverWindow) {
            this.syncDedicatedScreensaverStatus();
        }

        if (!this.isDedicatedScreensaverWindow && !this.screensaverDedicatedSyncInterval) {
            this.screensaverDedicatedSyncInterval = setInterval(() => {
                if (this.screensaverState.dedicatedActive || this.trayMinimized) {
                    this.syncDedicatedScreensaverStatus();
                }
            }, 45000);
        }
    }

    setupScreensaverSettingsUI() {
        const enabledEl = document.getElementById('screensaver-enabled');
        const idleEl = document.getElementById('screensaver-idle-minutes');
        if (!enabledEl || !idleEl) return;

        enabledEl.checked = Boolean(this.screensaverConfig.enabled);
        idleEl.value = String(this.screensaverConfig.idleMinutes || 3);
        idleEl.disabled = !enabledEl.checked;
        this.updateScreensaverStatusLabel();

        if (!enabledEl.dataset.listenerAdded) {
            enabledEl.addEventListener('change', () => {
                this.applyScreensaverConfig({
                    enabled: enabledEl.checked,
                    idleMinutes: Number(idleEl.value) || 3,
                    exitMode: 'esc_only'
                });
                idleEl.disabled = !enabledEl.checked;
                this.updateScreensaverStatusLabel();
            });
            enabledEl.dataset.listenerAdded = 'true';
        }

        if (!idleEl.dataset.listenerAdded) {
            idleEl.addEventListener('change', () => {
                const nextMinutes = Math.max(1, Number(idleEl.value) || 3);
                idleEl.value = String(nextMinutes);
                this.applyScreensaverConfig({
                    enabled: enabledEl.checked,
                    idleMinutes: nextMinutes,
                    exitMode: 'esc_only'
                });
            });
            idleEl.dataset.listenerAdded = 'true';
        }
    }

    applyScreensaverConfig(nextConfig) {
        this.screensaverConfig = {
            enabled: nextConfig.enabled !== false,
            idleMinutes: Math.max(1, Number(nextConfig.idleMinutes) || 3),
            exitMode: 'esc_only'
        };
        localStorage.setItem('screensaverConfig', JSON.stringify(this.screensaverConfig));
        // Persistir no servidor
        fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'screensaverConfig', value: this.screensaverConfig })
        }).catch(() => {});

        if (!this.screensaverConfig.enabled) {
            if (this.screensaverState.timerId) {
                clearTimeout(this.screensaverState.timerId);
                this.screensaverState.timerId = null;
            }
            if (this.screensaverState.isActive || this.screensaverState.dedicatedActive) {
                this.deactivateScreensaver();
            }
            this.disarmDedicatedScreensaverTimer();
            this.updateScreensaverStatusLabel();
            this.showToast('Screensaver desativado', 'info');
            return;
        }

        this.disarmDedicatedScreensaverTimer();
        this.resetScreensaverTimer();
        this.updateScreensaverStatusLabel();
        this.showToast(`Screensaver ativo (${this.screensaverConfig.idleMinutes} min)`, 'success');
    }

    resetScreensaverTimer() {
        if (!this.screensaverConfig.enabled) return;
        if (this.screensaverState.timerId) {
            clearTimeout(this.screensaverState.timerId);
        }

        this.screensaverState.timerId = setTimeout(() => {
            this.activateScreensaver();
        }, this.screensaverConfig.idleMinutes * 60 * 1000);
    }

    captureUIState() {
        const activeButton = document.querySelector('.nav-btn.active');
        const modalStates = Array.from(document.querySelectorAll('.modal'))
            .filter((modal) => window.getComputedStyle(modal).display !== 'none')
            .map((modal) => ({ id: modal.id, display: modal.style.display || 'flex' }));

        const fieldIds = [
            'source-path',
            'target-path',
            'schedule-name',
            'schedule-action',
            'schedule-source',
            'schedule-target',
            'filter-extensions'
        ];

        const fieldValues = {};
        fieldIds.forEach((id) => {
            const field = document.getElementById(id);
            if (field) fieldValues[id] = field.value;
        });

        const slideshowViewer = document.getElementById('slideshow-viewer');

        return {
            activeTab: activeButton?.dataset?.tab || this.currentTab || 'dashboard',
            modalStates,
            fieldValues,
            scrollY: window.scrollY || 0,
            slideshowState: {
                viewerVisible: slideshowViewer && window.getComputedStyle(slideshowViewer).display !== 'none',
                currentSlideIndex: this.currentSlideIndex || 0,
                slideshowPlaying: Boolean(this.slideshowPlaying)
            }
        };
    }

    restoreUIState(savedState) {
        if (!savedState) return;
        this.switchTab(savedState.activeTab || 'dashboard');

        Object.entries(savedState.fieldValues || {}).forEach(([id, value]) => {
            const field = document.getElementById(id);
            if (field) field.value = value;
        });

        this.closeAllModals();
        (savedState.modalStates || []).forEach((modalState) => {
            const modal = document.getElementById(modalState.id);
            if (modal) {
                modal.style.display = modalState.display || 'flex';
            }
        });

        setTimeout(() => {
            window.scrollTo(0, savedState.scrollY || 0);
        }, 0);
    }

    createScreensaverFallback() {
        if (!document.getElementById('screensaver-style')) {
            const style = document.createElement('style');
            style.id = 'screensaver-style';
            style.textContent = `
                #slideshow-viewer.screensaver-mode {
                    z-index: 9999998 !important;
                    cursor: none !important;
                }
            `;
            document.head.appendChild(style);
        }
        if (document.getElementById('screensaver-fallback')) return;
        const overlay = document.createElement('div');
        overlay.id = 'screensaver-fallback';
        overlay.style.cssText = `
            display:none;
            position:fixed;
            inset:0;
            z-index:9999999;
            background:radial-gradient(circle at 20% 20%, #1d3557, #111 55%, #000);
            color:#fff;
            align-items:center;
            justify-content:center;
            flex-direction:column;
            text-align:center;
            font-family:Arial, sans-serif;
        `;
        overlay.innerHTML = `
            <div style="font-size:48px;font-weight:700;letter-spacing:2px;">DePara</div>
            <div id="screensaver-clock" style="font-size:22px;opacity:.9;margin-top:10px;">--:--:--</div>
            <div style="font-size:14px;opacity:.75;margin-top:14px;">Pressione ESC para sair</div>
        `;
        document.body.appendChild(overlay);
    }

    showScreensaverFallback() {
        const overlay = document.getElementById('screensaver-fallback');
        if (!overlay) return;
        this.screensaverState.showingFallback = true;
        overlay.style.display = 'flex';

        const clock = document.getElementById('screensaver-clock');
        const tick = () => {
            if (clock) clock.textContent = new Date().toLocaleTimeString('pt-BR');
        };
        tick();
        if (this.screensaverClockInterval) clearInterval(this.screensaverClockInterval);
        this.screensaverClockInterval = setInterval(tick, 1000);
    }

    hideScreensaverFallback() {
        const overlay = document.getElementById('screensaver-fallback');
        if (overlay) overlay.style.display = 'none';
        this.screensaverState.showingFallback = false;
        if (this.screensaverClockInterval) {
            clearInterval(this.screensaverClockInterval);
            this.screensaverClockInterval = null;
        }
    }

    enforceScreensaverFullscreen(attempts = 3) {
        if (attempts <= 0) return;
        const tryEnter = (remaining) => {
            this.enterFullscreen();
            if (remaining <= 1) return;
            setTimeout(() => tryEnter(remaining - 1), 800);
        };
        tryEnter(attempts);
    }

    getScreensaverSourcePath() {
        const localPath = this.getSlideshowSelectedPath();
        if (localPath) return localPath;
        const fieldPath = document.getElementById('slideshow-folder-path')?.value?.trim();
        if (fieldPath) return fieldPath;
        return '';
    }

    async activateScreensaver(options = {}) {
        if (this.screensaverState.isActive || !this.screensaverConfig.enabled) return;

        this.screensaverState.savedUIState = this.captureUIState();
        this.screensaverState.isActive = true;
        this.screensaverState.startedSlideshowSession = false;
        this.screensaverState.showingFallback = false;
        this.updateScreensaverStatusLabel();

        const viewer = document.getElementById('slideshow-viewer');
        const viewerVisible = viewer && window.getComputedStyle(viewer).display !== 'none';
        this.screensaverState.viewerWasVisible = Boolean(viewerVisible);
        if (viewerVisible) {
            viewer.classList.add('screensaver-mode');
            if (this.isDedicatedScreensaverWindow) {
                this.enforceScreensaverFullscreen();
            }
            return;
        }

        try {
            this.loadSlideshowConfig();
            const sourcePath = this.getScreensaverSourcePath();
            if (!sourcePath) {
                this.showScreensaverFallback();
                return;
            }

            await this.loadSlideshowImages(
                sourcePath,
                this.slideshowConfig.extensions,
                true,
                this.slideshowConfig.interval
            );

            if (!this.screensaverState.isActive) return;
            if (Array.isArray(this.slideshowImages) && this.slideshowImages.length > 0) {
                const activeViewer = document.getElementById('slideshow-viewer');
                if (activeViewer) activeViewer.classList.add('screensaver-mode');
                this.screensaverState.startedSlideshowSession = true;
                this.hideScreensaverFallback();
                if (this.isDedicatedScreensaverWindow) {
                    this.enforceScreensaverFullscreen();
                }
                return;
            }
        } catch (error) {
            console.warn('Erro ao iniciar slideshow no screensaver:', error);
        }

        this.showScreensaverFallback();
        if (this.isDedicatedScreensaverWindow) {
            this.enforceScreensaverFullscreen();
        }
    }

    async deactivateScreensaver() {
        if (!this.screensaverState.isActive && !this.screensaverState.dedicatedActive && !this.isDedicatedScreensaverWindow) return;

        if (this.isDedicatedScreensaverWindow) {
            await this.closeDedicatedScreensaverWindow();
            this.hideScreensaverFallback();
            this.closeSlideshowViewer();
            this.screensaverState.isActive = false;
            this.updateScreensaverStatusLabel();
            setTimeout(() => {
                window.close();
            }, 50);
            return;
        }

        if (!this.screensaverState.isActive && this.screensaverState.dedicatedActive) {
            await this.closeDedicatedScreensaverWindow();
            this.resetScreensaverTimer();
            return;
        }

        this.hideScreensaverFallback();
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) viewer.classList.remove('screensaver-mode');

        if (this.screensaverState.startedSlideshowSession) {
            this.closeSlideshowViewer();
        } else if (this.screensaverState.viewerWasVisible) {
            if (viewer) viewer.style.display = 'flex';
        }

        this.restoreUIState(this.screensaverState.savedUIState);
        this.screensaverState.savedUIState = null;
        this.screensaverState.viewerWasVisible = false;
        this.screensaverState.startedSlideshowSession = false;
        this.screensaverState.showingFallback = false;
        this.screensaverState.isActive = false;
        this.updateScreensaverStatusLabel();
        this.resetScreensaverTimer();
    }

    // Mostrar ajuda de atalhos
    showKeyboardHelp() {
        const shortcuts = [
            { key: 'Ctrl+S', description: 'Salvar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes' },
            { key: 'Ctrl+R', description: 'Atualizar dados' },
            { key: 'F1', description: 'Mostrar esta ajuda' },
            { key: 'Alt+D', description: 'Ir para Dashboard' },
            { key: 'Alt+F', description: 'Ir para OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de Arquivos' },
            { key: 'Alt+S', description: 'Ir para OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes Agendadas' },
            { key: 'Alt+B', description: 'Ir para Backups' },
            { key: 'Alt+C', description: 'Ir para ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes' },
            { key: 'Esc', description: 'Fechar modais' }
        ];

        let helpText = 'ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¹ Atalhos de Teclado DisponÃƒÆ’Ã‚Â­veis:\n\n';
        shortcuts.forEach(shortcut => {
            helpText += `${shortcut.key.padEnd(10)} - ${shortcut.description}\n`;
        });

        alert(helpText);
    }

    // Sistema de Busca em OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
    filterScheduledOperations(searchTerm) {
        const searchInput = document.getElementById('scheduled-search');
        const clearButton = document.querySelector('.clear-search');
        const operationsList = document.getElementById('scheduled-operations-list');

        if (!operationsList) return;

        const operationItems = operationsList.querySelectorAll('.operation-item');

        if (searchTerm.trim() === '') {
            // Mostrar todas as operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
            operationItems.forEach(item => {
                item.style.display = 'block';
            });
            clearButton.style.display = 'none';
            return;
        }

        clearButton.style.display = 'block';

        const term = searchTerm.toLowerCase();

        operationItems.forEach(item => {
            const operationName = item.querySelector('.operation-name')?.textContent.toLowerCase() || '';
            const operationType = item.querySelector('.operation-type')?.textContent.toLowerCase() || '';
            const operationPath = item.querySelector('.operation-path')?.textContent.toLowerCase() || '';
            const operationFrequency = item.querySelector('.operation-frequency')?.textContent.toLowerCase() || '';

            const matches = operationName.includes(term) ||
                          operationType.includes(term) ||
                          operationPath.includes(term) ||
                          operationFrequency.includes(term);

            item.style.display = matches ? 'block' : 'none';
        });

        this.updateSearchResultsCount();
    }

    // Atualizar contador de resultados da busca
    updateSearchResultsCount() {
        const operationsList = document.getElementById('scheduled-operations-list');
        if (!operationsList) return;

        const visibleItems = operationsList.querySelectorAll('.operation-item[style*="block"], .operation-item:not([style*="none"])');
        const totalItems = operationsList.querySelectorAll('.operation-item');

        const searchInput = document.getElementById('scheduled-search');
        if (searchInput && searchInput.value.trim() !== '') {
            const countElement = document.querySelector('.search-results-count') ||
                               this.createSearchResultsCount();

            countElement.textContent = `Encontrados ${visibleItems.length} de ${totalItems.length} operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes`;
        } else {
            const countElement = document.querySelector('.search-results-count');
            if (countElement) {
                countElement.remove();
            }
        }
    }

    // Criar elemento de contador de resultados
    createSearchResultsCount() {
        const searchContainer = document.querySelector('.search-container');
        const countElement = document.createElement('div');
        countElement.className = 'search-results-count';
        countElement.style.cssText = `
            font-size: 12px;
            color: #666;
            margin-top: 8px;
            font-weight: 500;
        `;

        searchContainer.appendChild(countElement);
        return countElement;
    }

    // Limpar busca
    clearSearch() {
        const searchInput = document.getElementById('scheduled-search');
        const clearButton = document.querySelector('.clear-search');

        if (searchInput) {
            searchInput.value = '';
            this.filterScheduledOperations('');
        }

        if (clearButton) {
            clearButton.style.display = 'none';
        }
    }

    // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o global para busca
    filterScheduledOperationsGlobal(searchTerm) {
        if (window.deParaUI) {
            window.deParaUI.filterScheduledOperations(searchTerm);
        }
    }

    // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes globais serÃƒÆ’Ã‚Â£o definidas apÃƒÆ’Ã‚Â³s a inicializaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o

    // Sistema de Loading States
    showLoading(elementId, message = 'Carregando...') {
        const element = document.getElementById(elementId);
        if (!element) return;

        // Criar overlay de loading
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.id = `loading-${elementId}`;
        loadingOverlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-message">${message}</div>
        `;

        // Adicionar estilos inline para garantir visibilidade
        loadingOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            border-radius: 8px;
        `;

        // Tornar elemento relativo se nÃƒÆ’Ã‚Â£o for
        const currentPosition = window.getComputedStyle(element).position;
        if (currentPosition === 'static') {
            element.style.position = 'relative';
        }

        element.appendChild(loadingOverlay);
    }

    hideLoading(elementId) {
        const loadingOverlay = document.getElementById(`loading-${elementId}`);
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }

    // Wrapper para funÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes assÃƒÆ’Ã‚Â­ncronas com loading
    async withLoading(elementId, asyncFunction, message = 'Carregando...') {
        try {
            this.showLoading(elementId, message);
            const result = await asyncFunction();
            return result;
        } finally {
            this.hideLoading(elementId);
        }
    }

    // Loading para botÃƒÆ’Ã‚Âµes
    setButtonLoading(button, loading = true, originalText = null) {
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = originalText || button.innerHTML;
            button.innerHTML = `
                <div class="button-loading">
                    <div class="loading-spinner small"></div>
                    Carregando...
                </div>
            `;
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
            }
        }
    }

    // Loading para formulÃƒÆ’Ã‚Â¡rios
    setFormLoading(form, loading = true) {
        const inputs = form.querySelectorAll('input, select, textarea, button');
        inputs.forEach(input => {
            if (input.type === 'submit' || input.type === 'button' || input.tagName === 'BUTTON') {
                this.setButtonLoading(input, loading);
            } else {
                input.disabled = loading;
                if (loading) {
                    input.dataset.wasDisabled = input.disabled;
                } else if (input.dataset.wasDisabled === 'false') {
                    input.disabled = false;
                }
            }
        });
    }

    // Sistema de Onboarding
    showOnboarding() {
        document.getElementById('onboarding-overlay').style.display = 'flex';
    }

    skipOnboarding() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');
        this.showToast('Tutorial pulado! VocÃƒÆ’Ã‚Âª pode acessÃƒÆ’Ã‚Â¡-lo novamente pelo botÃƒÆ’Ã‚Â£o de ajuda.', 'info');
    }

    startOnboarding() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');
        this.openWorkflowConfig();
    }

    closeOnboarding() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');
        this.showToast('Tutorial fechado! Use o botÃƒÆ’Ã‚Â£o de ajuda se precisar de orientaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes.', 'info');
    }

    // ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o rÃƒÆ’Ã‚Â¡pida e automÃƒÆ’Ã‚Â¡tica
    async quickSetup() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');

        // Mostrar confirmaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o antes de criar pastas automaticamente
        const confirmed = await this.showQuickSetupConfirmation();

        if (!confirmed) {
            this.showToast('ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o cancelada. VocÃƒÆ’Ã‚Âª pode configurar manualmente.', 'info');
            return;
        }

        this.showToast('Ò°�&¸�&¡â�a¬ Criando pastas e templates...', 'info');

        try {
            // Criar pastas padrÃƒÆ’Ã‚Â£o automaticamente
            await this.createDefaultFolders();

            // Configurar templates bÃƒÆ’Ã‚Â¡sicos
            await this.createDefaultTemplates();

            this.showToast('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o automÃƒÆ’Ã‚Â¡tica concluÃƒÆ’Ã‚Â­da!', 'success');

            // Mostrar modal de pastas configuradas
            this.showQuickSetupResults();

        } catch (error) {
            console.error('Erro na configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o rÃƒÆ’Ã‚Â¡pida:', error);
            this.showToast('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro na configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o automÃƒÆ’Ã‚Â¡tica. Configure manualmente.', 'error');
        }
    }

    // Mostrar confirmaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o antes da configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o automÃƒÆ’Ã‚Â¡tica
    async showQuickSetupConfirmation() {
        return new Promise((resolve) => {
            const confirmationHtml = `
                <div style="text-align: center; padding: 20px;">
                    <h3 style="color: #2196F3; margin-bottom: 15px;">ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o AutomÃƒÆ’Ã‚Â¡tica</h3>
                    <p style="margin-bottom: 20px; color: #666;">
                        O sistema pode criar automaticamente pastas e templates bÃƒÆ’Ã‚Â¡sicos para vocÃƒÆ’Ã‚Âª comeÃƒÆ’Ã‚Â§ar a usar imediatamente.
                    </p>

                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                        <h4 style="margin-bottom: 10px; color: #333;">ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â Pastas que serÃƒÆ’Ã‚Â£o criadas:</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #555;">
                            <li><strong>Documentos Entrada</strong> - Para arquivos de entrada</li>
                            <li><strong>Documentos Processados</strong> - Para arquivos processados</li>
                            <li><strong>Backup AutomÃƒÆ’Ã‚Â¡tico</strong> - Para backups</li>
                        </ul>
                    </div>

                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                        <h4 style="margin-bottom: 10px; color: #333;">ÃƒÂ¢Ã…Â¡Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â Templates que serÃƒÆ’Ã‚Â£o criados:</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #555;">
                            <li><strong>Backup DiÃƒÆ’Ã‚Â¡rio</strong> - Backup automÃƒÆ’Ã‚Â¡tico diÃƒÆ’Ã‚Â¡rio</li>
                            <li><strong>Limpeza Semanal</strong> - Limpeza de arquivos temporÃƒÆ’Ã‚Â¡rios</li>
                        </ul>
                    </div>

                    <p style="color: #ff9800; font-size: 14px; margin-bottom: 20px;">
                        ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â <strong>AtenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:</strong> Isso criarÃƒÆ’Ã‚Â¡ pastas no seu sistema de arquivos. VocÃƒÆ’Ã‚Âª pode remover ou modificar tudo depois.
                    </p>
                </div>
            `;

            // Criar modal de confirmaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

            modal.innerHTML = `
                <div style="background: white; padding: 0; border-radius: 12px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
                    ${confirmationHtml}
                    <div style="padding: 20px; border-top: 1px solid #eee; text-align: center; display: flex; gap: 10px; justify-content: center;">
                        <button class="quick-setup-cancel-btn" style="background: #757575; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            ÃƒÂ¢Ã‚ÂÃ…â€™ Cancelar
                        </button>
                        <button class="quick-setup-approve-btn" style="background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Aprovar e Continuar
                        </button>
                    </div>
                </div>
            `;

            // Armazenar funÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de resoluÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
            window.quickSetupResolve = resolve;

            document.body.appendChild(modal);

            // Configurar event listeners para os botÃƒÆ’Ã‚Âµes
            const cancelBtn = modal.querySelector('.quick-setup-cancel-btn');
            const approveBtn = modal.querySelector('.quick-setup-approve-btn');

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    modal.remove();
                    resolve(false);
                });
            }

            if (approveBtn) {
                approveBtn.addEventListener('click', () => {
                    modal.remove();
                    resolve(true);
                });
            }
        });
    }

    // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para obter caminhos padrÃƒÆ’Ã‚Â£o baseados na plataforma
    getDefaultPaths() {
        // Detectar se estamos no Windows ou Linux
        const isWindows = navigator.userAgent.indexOf('Windows') > -1;

        if (isWindows) {
            return {
                entrada: 'C:\\Users\\User\\Documents\\Entrada',
                processados: 'C:\\Users\\User\\Documents\\Processados',
                backup: 'C:\\Users\\User\\Documents\\Backup'
            };
        } else {
            // Linux/Raspberry Pi - usar caminhos genÃƒÆ’Ã‚Â©ricos que serÃƒÆ’Ã‚Â£o resolvidos no backend
            return {
                entrada: '/home/user/Documents/Entrada',
                processados: '/home/user/Documents/Processados',
                backup: '/home/user/Documents/Backup'
            };
        }
    }

    // Criar pastas padrÃƒÆ’Ã‚Â£o automaticamente
    async createDefaultFolders() {
        const paths = this.getDefaultPaths();
        const defaultFolders = [
            { name: 'Documentos Entrada', path: paths.entrada, type: 'source', format: 'any' },
            { name: 'Documentos Processados', path: paths.processados, type: 'target', format: 'any' },
            { name: 'Backup AutomÃƒÆ’Ã‚Â¡tico', path: paths.backup, type: 'target', format: 'any' }
        ];

        for (const folder of defaultFolders) {
            try {
                await this.saveFolder(folder);            } catch (error) {
                console.warn(`Erro ao criar pasta ${folder.name}:`, error);
            }
        }
    }

    // Criar templates bÃƒÆ’Ã‚Â¡sicos
    async createDefaultTemplates() {
        const templates = [
            {
                name: 'Backup DiÃƒÆ’Ã‚Â¡rio',
                description: 'Faz backup diÃƒÆ’Ã‚Â¡rio de documentos importantes',
                action: 'copy',
                source: paths.entrada,
                target: paths.backup,
                frequency: '1d',
                options: { batch: true, backupBeforeMove: false }
            },
            {
                name: 'Limpeza Semanal',
                description: 'Remove arquivos temporÃƒÆ’Ã‚Â¡rios semanalmente',
                action: 'delete',
                source: '/tmp',
                target: '',
                frequency: '1w',
                options: { batch: true }
            }
        ];

        for (const template of templates) {
            try {
                await this.saveTemplate(template);            } catch (error) {
                console.warn(`Erro ao criar template ${template.name}:`, error);
            }
        }
    }

    // Mostrar resultados da configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o rÃƒÆ’Ã‚Â¡pida
    showQuickSetupResults() {
        const results = `
        <div style="text-align: center; padding: 20px;">
            <h3 style="color: #4caf50; margin-bottom: 15px;">ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â° ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ConcluÃƒÆ’Ã‚Â­da!</h3>
            <p style="margin-bottom: 20px;">Pastas e templates foram criados automaticamente:</p>

            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                <h4>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â Pastas Criadas:</h4>
                <ul style="margin: 10px 0;">
                    <li>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¥ <strong>Documentos Entrada</strong> - Para arquivos de entrada</li>
                    <li>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¤ <strong>Documentos Processados</strong> - Para arquivos processados</li>
                    <li>ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¾ <strong>Backup AutomÃƒÆ’Ã‚Â¡tico</strong> - Para backups</li>
                </ul>
            </div>

            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                <h4>ÃƒÂ¢Ã…Â¡Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â Templates Criados:</h4>
                <ul style="margin: 10px 0;">
                    <li>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦ <strong>Backup DiÃƒÆ’Ã‚Â¡rio</strong> - Backup automÃƒÆ’Ã‚Â¡tico diÃƒÆ’Ã‚Â¡rio</li>
                    <li>ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â¹ <strong>Limpeza Semanal</strong> - Limpeza de arquivos temporÃƒÆ’Ã‚Â¡rios</li>
                </ul>
            </div>

            <p style="color: #666; font-size: 14px;">
                VocÃƒÆ’Ã‚Âª pode personalizar essas configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes nas abas "OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de Arquivos" e "ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes".
            </p>
        </div>
        `;

        // Criar modal simples
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 0; border-radius: 12px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
                ${results}
                <div style="padding: 20px; border-top: 1px solid #eee; text-align: center;">
                    <button class="quick-setup-results-close-btn" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ ComeÃƒÆ’Ã‚Â§ar a Usar!
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Configurar event listener para o botÃƒÆ’Ã‚Â£o fechar
        const closeBtn = modal.querySelector('.quick-setup-results-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }
    }

    // Sistema de configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o rÃƒÆ’Ã‚Â¡pida de pastas
    async createQuickFolder(type) {
        // Obter caminhos padrÃƒÆ’Ã‚Â£o baseados na plataforma
        const paths = this.getDefaultPaths();
        const isWindows = navigator.userAgent.indexOf('Windows') > -1;
        const basePath = isWindows ? 'C:\\Users\\User' : '/home/user';

        const folderSets = {
            documents: [
                { name: 'Documentos Entrada', path: paths.entrada, type: 'source', format: 'any' },
                { name: 'Documentos Processados', path: paths.processados, type: 'target', format: 'any' }
            ],
            backup: [
                { name: 'Backup DiÃƒÆ’Ã‚Â¡rio', path: isWindows ? basePath + '\\Backup\\Diario' : basePath + '/Backup/Diario', type: 'target', format: 'any' },
                { name: 'Backup Semanal', path: isWindows ? basePath + '\\Backup\\Semanal' : basePath + '/Backup/Semanal', type: 'target', format: 'any' }
            ],
            media: [
                { name: 'Fotos', path: isWindows ? basePath + '\\Pictures' : basePath + '/Pictures', type: 'source', format: 'any' },
                { name: 'VÃƒÆ’Ã‚Â­deos', path: isWindows ? basePath + '\\Videos' : basePath + '/Videos', type: 'source', format: 'any' }
            ],
            temp: [
                { name: 'Processamento', path: isWindows ? basePath + '\\Temp\\Processamento' : basePath + '/Temp/Processamento', type: 'temp', format: 'any' },
                { name: 'Lixeira', path: isWindows ? basePath + '\\Temp\\Lixeira' : basePath + '/Temp/Lixeira', type: 'trash', format: 'any' }
            ]
        };

        const folders = folderSets[type];
        if (!folders) {
            console.error(`ÃƒÂ¢Ã‚ÂÃ…â€™ Tipo de pasta invÃƒÆ’Ã‚Â¡lido: ${type}`);
            this.showToast('ÃƒÂ¢Ã‚ÂÃ…â€™ Tipo de pasta invÃƒÆ’Ã‚Â¡lido', 'error');
            return;
        }

        this.showToast(`Ò°�&¸�&¡â�a¬ Criando pastas de ${type}...`, 'info');

        try {
            // Criar pastas uma por vez para melhor controle
            for (const folder of folders) {                try {
                    await this.createFolderOnServer(folder);                } catch (error) {
                    console.warn(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Erro ao criar pasta ${folder.name}:`, error);
                    // Continua tentando as outras pastas
                }
            }

            // Criar templates relacionados
            await this.createRelatedTemplates(type);

            this.showToast(`ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Pastas de ${type} criadas com sucesso!`, 'success');
            this.refreshFoldersList();

        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro geral ao criar pastas:', error);
            this.showToast('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao criar pastas', 'error');
        }
    }

    // Criar pasta no servidor
    async createFolderOnServer(folder) {
        const response = await fetch('/api/files/folders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(folder)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Erro ao criar pasta: ${error}`);
        }

        return await response.json();
    }

    // Criar templates relacionados ao tipo de pasta
    async createRelatedTemplates(type) {
        // Obter caminhos padrÃƒÆ’Ã‚Â£o baseados na plataforma
        const paths = this.getDefaultPaths();

        const templateSets = {
            documents: [
                {
                    name: 'Backup Documentos',
                    description: 'Faz backup diÃƒÆ’Ã‚Â¡rio de documentos importantes',
                    action: 'copy',
                    sourcePath: paths.entrada,
                    targetPath: paths.processados,
                    frequency: '1d',
                    options: { batch: true, backupBeforeMove: false }
                }
            ],
            backup: [
                {
                    name: 'Backup DiÃƒÆ’Ã‚Â¡rio',
                    description: 'Backup automÃƒÆ’Ã‚Â¡tico diÃƒÆ’Ã‚Â¡rio',
                    action: 'copy',
                    sourcePath: paths.entrada.replace('/Entrada', '').replace('\\Entrada', ''),
                    targetPath: paths.backup + (navigator.userAgent.indexOf('Windows') > -1 ? '\\Diario' : '/Diario'),
                    frequency: '1d',
                    options: { batch: true, backupBeforeMove: true }
                },
                {
                    name: 'Backup Semanal',
                    description: 'Backup completo semanal',
                    action: 'copy',
                    sourcePath: paths.entrada.replace('/Entrada', '').replace('\\Entrada', ''),
                    targetPath: paths.backup + (navigator.userAgent.indexOf('Windows') > -1 ? '\\Semanal' : '/Semanal'),
                    frequency: '1w',
                    options: { batch: true, backupBeforeMove: true }
                }
            ],
            media: [
                {
                    name: 'Organizar Fotos',
                    description: 'Move fotos para pasta organizada',
                    action: 'move',
                    sourcePath: paths.entrada.replace('Documents/Entrada', 'Pictures').replace('Documents\\Entrada', 'Pictures'),
                    targetPath: paths.entrada.replace('Documents/Entrada', 'Pictures/Organizadas').replace('Documents\\Entrada', 'Pictures\\Organizadas'),
                    frequency: 'manual',
                    options: { batch: true }
                }
            ],
            temp: [
                {
                    name: 'Limpar TemporÃƒÆ’Ã‚Â¡rios',
                    description: 'Remove arquivos temporÃƒÆ’Ã‚Â¡rios semanalmente',
                    action: 'delete',
                    sourcePath: '/home/pi/Temp',
                    targetPath: '',
                    frequency: '1w',
                    options: { batch: true }
                }
            ]
        };

        const templates = templateSets[type] || [];

        for (const template of templates) {
            try {                await this.createTemplateOnServer(template);            } catch (error) {
                console.warn(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Erro ao criar template ${template.name}:`, error);
            }
        }
    }

    // Criar template no servidor
    async createTemplateOnServer(template) {
        const response = await fetch('/api/files/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(template)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Erro ao criar template: ${error}`);
        }

        return await response.json();
    }

    // Abrir gerenciador de pastas
    openFolderManager() {
        document.getElementById('folder-manager-modal').style.display = 'flex';
    }

    // Atualizar lista de pastas
    async refreshFoldersList() {
        try {
            // Carregar pastas do servidor
            await this.loadFolders();
            await this.loadWorkflows();

            // Atualizar interface
            this.updateFoldersDisplay();
            this.updateWorkflowsDisplay();

            this.showToast('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Lista de pastas atualizada!', 'success');
        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao atualizar lista de pastas:', error);
            this.showToast('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao atualizar lista', 'error');
        }
    }

    // Atualizar exibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de pastas
    updateFoldersDisplay() {
        const foldersList = document.getElementById('folders-list');
        if (!foldersList) return;

        if (this.folders.length === 0) {
            foldersList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">folder_open</span>
                    <p>Nenhuma pasta configurada</p>
                    <small>Use a configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o rÃƒÆ’Ã‚Â¡pida acima ou crie manualmente</small>
                </div>
            `;
        } else {
            foldersList.innerHTML = this.folders.map(folder => `
                <div class="folder-item">
                    <div class="folder-info">
                        <span class="material-icons">${this.getFolderIcon(folder.type)}</span>
                        <div>
                            <strong>${folder.name}</strong>
                            <small>${folder.path}</small>
                        </div>
                    </div>
                    <div class="folder-actions">
                        <button class="btn-icon edit-folder-btn" data-folder-id="${folder.id}">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="btn-icon danger delete-folder-btn" data-folder-id="${folder.id}">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                </div>
            `).join('');

            // Configurar event listeners para os botÃƒÆ’Ã‚Âµes de editar/deletar
            const editButtons = foldersList.querySelectorAll('.edit-folder-btn');
            const deleteButtons = foldersList.querySelectorAll('.delete-folder-btn');

            editButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const folderId = btn.getAttribute('data-folder-id');
                    this.editFolder(folderId);
                });
            });

            deleteButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const folderId = btn.getAttribute('data-folder-id');
                    this.deleteFolder(folderId);
                });
            });
        }
    }

    // Obter ÃƒÆ’Ã‚Â­cone da pasta baseado no tipo
    getFolderIcon(type) {
        const icons = {
            source: 'folder',
            target: 'folder_shared',
            temp: 'folder_special',
            trash: 'delete'
        };
        return icons[type] || 'folder';
    }

    // Editar pasta
    editFolder(folderId) {        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            // Implementar modal de ediÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
            this.showToast('Edicao rapida indisponivel no momento. Use excluir e criar novamente para alterar a pasta.', 'warning');
        } else {
            this.showToast('Pasta nÃƒÆ’Ã‚Â£o encontrada', 'error');
        }
    }

    // Deletar pasta
    async deleteFolder(folderId) {
        if (confirm('Tem certeza que deseja excluir esta pasta?')) {
            try {
                const response = await fetch(`/api/files/folders/${folderId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.showToast('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Pasta excluÃƒÆ’Ã‚Â­da com sucesso!', 'success');
                    await this.refreshFoldersList();
                } else {
                    throw new Error(`Erro HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao excluir pasta:', error);
                this.showToast('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao excluir pasta', 'error');
            }
        }
    }

    // Atualizar exibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de workflows (placeholder)
    updateWorkflowsDisplay() {        // Implementar conforme necessÃƒÆ’Ã‚Â¡rio
    }

    // Adicionar event listeners para operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de arquivo
    addFileOperationEventListeners() {
        // Mostrar/ocultar filtro de extensÃƒÆ’Ã‚Âµes quando recursÃƒÆ’Ã‚Â£o ÃƒÆ’Ã‚Â© selecionada
        const recursiveCheckbox = document.getElementById('recursive-operation');
        const extensionsFilter = document.getElementById('extensions-filter');

        if (recursiveCheckbox && extensionsFilter) {
            recursiveCheckbox.addEventListener('change', (e) => {
                extensionsFilter.style.display = e.target.checked ? 'block' : 'none';
            });
        }
    }

    // Configurar event listeners para todos os novos botÃƒÆ’Ã‚Âµes
    setupAdditionalEventListeners() {
        // BotÃƒÆ’Ã‚Âµes de dashboard
        this.addButtonListener('.refresh-charts-btn', () => this.updateCharts());
        this.addButtonListener('.clear-search-btn', () => this.clearSearch());
        this.addButtonListener('.schedule-modal-btn', () => {
            this.switchTab('scheduled');
            if (typeof window.showScheduleModal === 'function') {
                window.showScheduleModal({ operation: {}, mode: 'create' });
            }
        });

        // BotÃƒÆ’Ã‚Âµes de aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o rÃƒÆ’Ã‚Â¡pida (interface antiga) - redirecionar para nova interface
        this.addButtonListener('.action-move-btn', () => this.redirectToFileOperations('move'));
        this.addButtonListener('.action-copy-btn', () => this.redirectToFileOperations('copy'));
        this.addButtonListener('.action-delete-btn', () => this.redirectToFileOperations('delete'));
        this.addButtonListener('.action-schedule-btn', () => this.redirectToFileOperations('schedule'));
        this.addButtonListener('.action-slideshow-btn', () => this.showSlideshowModal());

        // BotÃƒÆ’Ã‚Âµes de backup
        this.addButtonListener('.load-backups-btn', () => {
            if (typeof loadBackups === 'function') loadBackups();
        });
        this.addButtonListener('.update-backup-btn', () => {
            if (typeof updateBackupConfig === 'function') updateBackupConfig();
        });
        this.addButtonListener('.export-operational-config-btn', () => {
            if (typeof exportOperationalConfig === 'function') exportOperationalConfig();
        });
        this.addButtonListener('.import-operational-config-btn', () => {
            if (typeof importOperationalConfig === 'function') importOperationalConfig();
        });

        // BotÃƒÆ’Ã‚Âµes de configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
        this.addButtonListener('.show-ignored-btn', () => window.showIgnoredPatterns());
        this.addButtonListener('.save-settings-btn', () => this.saveSettings());

        // BotÃƒÆ’Ã‚Âµes de workflow
        this.addButtonListener('.close-workflow-btn', () => window.closeWorkflowModal());
        this.addButtonListener('#prev-step', () => window.previousWorkflowStep());
        this.addButtonListener('#next-step', () => window.nextWorkflowStep());
        this.addButtonListener('#save-step', () => window.saveWorkflow());
        this.addButtonListener('.cancel-workflow-btn', () => window.closeWorkflowModal());

        // BotÃƒÆ’Ã‚Âµes de gerenciamento de pastas
        this.addButtonListener('.close-folder-manager-btn', () => window.closeFolderManagerModal());
        this.addButtonListener('.cancel-folder-manager-btn', () => window.closeFolderManagerModal());
        this.addButtonListener('.save-folder-btn', () => window.saveFolder());

        // BotÃƒÆ’Ã‚Âµes de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de arquivo
        this.addButtonListener('.close-file-operation-btn', () => {
            if (typeof closeFileOperationModal === 'function') closeFileOperationModal();
        });
        this.addButtonListener('.cancel-file-operation-btn', () => {
            if (typeof closeFileOperationModal === 'function') closeFileOperationModal();
        });
        this.addButtonListener('.execute-file-operation-btn', () => {
            if (typeof executeFileOperation === 'function') executeFileOperation();
        });

        // BotÃƒÆ’Ã‚Âµes de agendamento
        this.addButtonListener('.close-schedule-btn', () => hideScheduleModal());
        this.addButtonListener('.cancel-schedule-btn', () => hideScheduleModal());
        
        // BotÃƒÆ’Ã‚Âµes de filtros rÃƒÆ’Ã‚Â¡pidos (event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.filter-btn')) {
                const btn = e.target.closest('.filter-btn');
                this.selectFilter({ target: btn });
            }
        });
        
        // BotÃƒÆ’Ã‚Âµes de navegaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de pastas no modal de agendamento
        this.addButtonListener('#browse-source-btn', () => this.browsePathForSchedule('source'));
        this.addButtonListener('#browse-target-btn', () => this.browsePathForSchedule('target'));
        
        // BotÃƒÆ’Ã‚Âµes de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes agendadas (event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.schedule-btn')) {
                if (typeof window.showScheduleModal === 'function') {
                    this.configureOperation();
                } else {
                    this.showToast('Funcionalidade de agendamento nÃƒÆ’Ã‚Â£o disponÃƒÆ’Ã‚Â­vel', 'warning');
                }
            }
            if (e.target.closest('.cancel-scheduled-operation-btn')) {
                const btn = e.target.closest('.cancel-scheduled-operation-btn');
                const operationId = btn.getAttribute('data-operation-id');
                cancelScheduledOperation(operationId);
            }
            if (e.target.closest('.edit-scheduled-operation-btn')) {
                const btn = e.target.closest('.edit-scheduled-operation-btn');
                const operationId = btn.getAttribute('data-operation-id');
                editScheduledOperation(operationId);
            }
            if (e.target.closest('.duplicate-scheduled-operation-btn')) {
                const btn = e.target.closest('.duplicate-scheduled-operation-btn');
                const operationId = btn.getAttribute('data-operation-id');
                duplicateScheduledOperation(operationId);
            }
            if (e.target.closest('.execute-scheduled-operation-btn')) {
                const btn = e.target.closest('.execute-scheduled-operation-btn');
                const operationId = btn.getAttribute('data-operation-id');
                executeScheduledOperation(operationId);
            }
            if (e.target.closest('.toggle-scheduled-operation-btn')) {
                const btn = e.target.closest('.toggle-scheduled-operation-btn');
                const operationId = btn.getAttribute('data-operation-id');
                toggleScheduledOperation(operationId);
            }
        });
        
        // BotÃƒÆ’Ã‚Â£o de reload da pÃƒÆ’Ã‚Â¡gina
        this.addButtonListener('.reload-page-btn', () => window.location.reload());

        // BotÃƒÆ’Ã‚Âµes de slideshow
        this.addButtonListener('.close-slideshow-folder-btn', () => window.closeSlideshowFolderModal());
        this.addButtonListener('.cancel-slideshow-folder-btn', () => window.closeSlideshowFolderModal());
        this.addButtonListener('.close-slideshow-config-btn', () => window.closeSlideshowConfigModal());
        // Event listeners antigos removidos - usando botÃƒÆ’Ã‚Âµes estÃƒÆ’Ã‚Â¡ticos

        // BotÃƒÆ’Ã‚Â£o seletor de pasta
        this.addButtonListener('.select-folder-btn', () => {
            this.showFolderBrowser('source');
        });

        // BotÃƒÆ’Ã‚Â£o seletor de pasta de destino
        this.addButtonListener('.select-target-btn', () => {
            this.showFolderBrowser('target');
        });

        // BotÃƒÆ’Ã‚Âµes de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        this.addButtonListener('.move-btn', () => this.selectOperation('move'));
        this.addButtonListener('.copy-btn', () => this.selectOperation('copy'));
        this.addButtonListener('.delete-btn', () => this.selectOperation('delete'));

        // BotÃƒÆ’Ã‚Âµes de sugestÃƒÆ’Ã‚Â£o de pasta
        this.addButtonListener('.suggestion-btn', (e) => this.selectSuggestedFolder(e));

        // BotÃƒÆ’Ã‚Âµes de aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        this.addButtonListener('.execute-now-btn', () => this.executeNow());

        // Filtros de busca (input events)
        const searchInput = document.getElementById('scheduled-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterScheduledOperations(e.target.value);
            });
        }
    }

    // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o auxiliar para adicionar event listeners de botÃƒÆ’Ã‚Âµes
    addButtonListener(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener('click', callback);
        }
    }

    // Redirecionar da interface antiga para a nova
    redirectToFileOperations(operation) {
        // Mudar para a aba de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de arquivos
        this.switchTab('fileops');

        // PrÃƒÆ’Ã‚Â©-selecionar a operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        setTimeout(() => {
            this.selectOperation(operation);
            this.showToast(`Use a nova interface abaixo para configurar a operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de ${operation}`, 'info');
        }, 100);
    }

    // ==========================================
    // OPERATION CONFIGURATION
    // ==========================================

    // Estado da configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o atual
    currentConfig = {
        sourcePath: '',
        operation: '',
        targetPath: '',
        mode: '',
        options: {
            batch: true,
            preserveStructure: true,
            filters: {}
        }
    };

    getOperationDraft() {
        return this.currentConfig;
    }

    updateOperationDraft(patch = {}) {
        const current = this.getOperationDraft();
        this.currentConfig = {
            ...current,
            ...patch,
            options: {
                ...(current.options || {}),
                ...(patch.options || {})
            }
        };

        this.refreshFileOpsState();
        return this.currentConfig;
    }

    syncDraftFromFileOps() {
        const sourcePath = document.getElementById('source-folder-path')?.value.trim() || '';
        const targetPath = document.getElementById('target-folder-path')?.value.trim() || '';
        const operation = this.getOperationDraft().operation || '';

        return this.updateOperationDraft({
            sourcePath,
            targetPath,
            operation
        });
    }

    clearOperationFieldErrors() {
        ['source-folder-path', 'target-folder-path', 'schedule-source', 'schedule-target'].forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (field && typeof this.clearFieldError === 'function') {
                this.clearFieldError(field);
            }
        });
    }

    validateOperationDraft(mode = 'execute') {
        const draft = this.syncDraftFromFileOps();
        const errors = [];
        const sourceField = document.getElementById(mode === 'schedule' ? 'schedule-source' : 'source-folder-path');
        const targetField = document.getElementById(mode === 'schedule' ? 'schedule-target' : 'target-folder-path');
        const needsTarget = draft.operation === 'move' || draft.operation === 'copy';

        this.clearOperationFieldErrors();

        if (!draft.sourcePath) {
            errors.push('Selecione a pasta de origem.');
            if (sourceField) this.showFieldError(sourceField, 'Origem obrigatória');
        }

        if (!draft.operation) {
            errors.push('Selecione a ação.');
        }

        if (needsTarget && !draft.targetPath) {
            errors.push('Selecione a pasta de destino.');
            if (targetField) this.showFieldError(targetField, 'Destino obrigatório');
        }

        return {
            isValid: errors.length === 0,
            errors,
            draft
        };
    }

    renderFileOpsSummary(draft = this.getOperationDraft()) {
        const summarySource = document.getElementById('fileops-summary-source');
        const summaryAction = document.getElementById('fileops-summary-action');
        const summaryTarget = document.getElementById('fileops-summary-target');
        const summaryMode = document.getElementById('fileops-summary-mode');
        const summaryNote = document.getElementById('fileops-summary-note');

        if (!summarySource || !summaryAction || !summaryTarget || !summaryMode || !summaryNote) {
            return;
        }

        summarySource.textContent = draft.sourcePath || 'Não definida';
        summaryAction.textContent = draft.operation ? draft.operation.toUpperCase() : 'Não definida';
        summaryTarget.textContent = draft.operation === 'delete'
            ? 'Não aplicável'
            : (draft.targetPath || 'Não definido');
        summaryMode.textContent = draft.mode
            ? (draft.mode === 'schedule' ? 'Agendamento' : 'Execução imediata')
            : 'Escolha executar ou agendar';

        if (!draft.sourcePath) {
            summaryNote.textContent = 'Selecione a pasta de origem para começar.';
        } else if (!draft.operation) {
            summaryNote.textContent = 'Escolha a ação que deseja executar.';
        } else if ((draft.operation === 'move' || draft.operation === 'copy') && !draft.targetPath) {
            summaryNote.textContent = 'A ação selecionada exige uma pasta de destino.';
        } else {
            summaryNote.textContent = 'A operação está pronta para executar ou abrir o agendamento.';
        }
    }

    refreshFileOpsState() {
        const draft = this.getOperationDraft();
        const sourceInput = document.getElementById('source-folder-path');
        const targetInput = document.getElementById('target-folder-path');
        const targetGroup = targetInput?.closest('.form-group');
        const targetHelp = document.getElementById('target-help');
        const executeBtn = document.querySelector('.execute-now-btn');
        const scheduleBtn = document.querySelector('.schedule-btn');
        const needsTarget = draft.operation === 'move' || draft.operation === 'copy';
        const canSubmit = Boolean(draft.sourcePath) && Boolean(draft.operation) && (!needsTarget || Boolean(draft.targetPath));

        if (sourceInput && sourceInput.value !== draft.sourcePath) {
            sourceInput.value = draft.sourcePath || '';
        }

        if (targetInput && targetInput.value !== draft.targetPath) {
            targetInput.value = draft.targetPath || '';
        }

        if (targetGroup) {
            targetGroup.style.display = draft.operation === 'delete' ? 'none' : 'block';
        }

        if (targetInput) {
            targetInput.required = needsTarget;
            if (!needsTarget) {
                targetInput.value = '';
            }
        }

        if (targetHelp) {
            if (draft.operation === 'delete') {
                targetHelp.textContent = 'Excluir cria backup quando configurado e não precisa de destino.';
            } else if (draft.operation === 'move') {
                targetHelp.textContent = 'Selecione a pasta de destino obrigatória para mover.';
            } else if (draft.operation === 'copy') {
                targetHelp.textContent = 'Selecione a pasta de destino obrigatória para copiar.';
            } else {
                targetHelp.textContent = 'Selecione a pasta de destino quando a ação exigir.';
            }
        }

        if (executeBtn) {
            executeBtn.disabled = !canSubmit || this.isExecutingOperation;
        }

        if (scheduleBtn) {
            scheduleBtn.disabled = !canSubmit || this.isExecutingOperation;
        }

        this.renderFileOpsSummary(draft);
    }

    getFolderBrowserStartPath(selectionContext, explicitStartPath = '') {
        if (explicitStartPath && explicitStartPath.trim()) {
            return explicitStartPath.trim();
        }

        const draft = this.getOperationDraft();
        const contextMap = {
            source: draft.sourcePath,
            target: draft.targetPath,
            'schedule-source': document.getElementById('schedule-source')?.value.trim(),
            'schedule-target': document.getElementById('schedule-target')?.value.trim(),
            slideshow: document.getElementById('slideshow-folder-path')?.value.trim(),
            'slideshow-deleted': document.getElementById('slideshow-deleted-folder')?.value.trim(),
            'slideshow-hidden': document.getElementById('slideshow-hidden-folder')?.value.trim(),
            'slideshow-adjustable': document.getElementById('slideshow-adjustable-folder')?.value.trim()
        };

        return contextMap[selectionContext] || '';
    }

    getDefaultBrowserPath() {
        const isWindows = navigator.userAgent.indexOf('Windows') > -1;
        return isWindows ? 'C:\\Users\\User' : '/home/yo';
    }

    getSelectionContextMeta(selectionContext) {
        const contextMap = {
            source: {
                title: 'Selecionar Pasta de Origem',
                actionLabel: 'Usar esta pasta como origem'
            },
            target: {
                title: 'Selecionar Pasta de Destino',
                actionLabel: 'Usar esta pasta como destino'
            },
            'schedule-source': {
                title: 'Selecionar Origem do Agendamento',
                actionLabel: 'Usar esta pasta no agendamento'
            },
            'schedule-target': {
                title: 'Selecionar Destino do Agendamento',
                actionLabel: 'Usar esta pasta no agendamento'
            },
            slideshow: {
                title: 'Selecionar Pasta do Slideshow',
                actionLabel: 'Usar esta pasta no slideshow'
            }
        };

        return contextMap[selectionContext] || {
            title: 'Selecionar Pasta',
            actionLabel: 'Usar esta pasta'
        };
    }

    applyFolderSelection(selectionContext, selectedPath) {
        const normalizedPath = (selectedPath || '').trim();
        if (!normalizedPath) {
            return;
        }

        switch (selectionContext) {
            case 'source':
                this.updateOperationDraft({ sourcePath: normalizedPath });
                this.showToast(`Pasta de origem selecionada: ${normalizedPath}`, 'success');
                break;
            case 'target':
                this.updateOperationDraft({ targetPath: normalizedPath });
                this.showToast(`Pasta de destino selecionada: ${normalizedPath}`, 'success');
                break;
            case 'schedule-source':
                document.getElementById('schedule-source').value = normalizedPath;
                if (typeof updateOperationSummary === 'function') updateOperationSummary();
                this.showToast(`Origem do agendamento atualizada: ${normalizedPath}`, 'success');
                break;
            case 'schedule-target':
                document.getElementById('schedule-target').value = normalizedPath;
                if (typeof updateOperationSummary === 'function') updateOperationSummary();
                this.showToast(`Destino do agendamento atualizado: ${normalizedPath}`, 'success');
                break;
            case 'slideshow':
                document.getElementById('slideshow-folder-path').value = normalizedPath;
                break;
            case 'slideshow-deleted':
                document.getElementById('slideshow-deleted-folder').value = normalizedPath;
                break;
            case 'slideshow-hidden':
                document.getElementById('slideshow-hidden-folder').value = normalizedPath;
                break;
            case 'slideshow-adjustable':
                document.getElementById('slideshow-adjustable-folder').value = normalizedPath;
                break;
            default:
                console.warn('Contexto de seleção de pasta não suportado:', selectionContext);
                break;
        }
    }

    // Selecionar pasta de origem
    selectSourceFolder() {
        this.showFolderBrowser('source');
    }

    // Selecionar pasta de destino
    selectTargetFolder() {
        this.showFolderBrowser('target');
    }

    // Mostrar diÃƒÆ’Ã‚Â¡logo nativo de seleÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de pasta
    showNativeFolderDialog(targetType) {
        this.showFolderBrowser(targetType);
        return;
        // Criar input file oculto para seleÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de pasta
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.directory = true;
        input.multiple = false;
        input.style.display = 'none';
        
        input.addEventListener('change', (event) => {
            const files = event.target.files;
            if (files && files.length > 0) {
                // Pegar o caminho da primeira pasta selecionada
                const fullPath = files[0].path || files[0].webkitRelativePath.split('/').slice(0, -1).join('/');                
                this.applyFolderSelection(targetType, fullPath);
            }
            
            // Remover o input apÃƒÆ’Ã‚Â³s uso
            document.body.removeChild(input);
        });
        
        // Adicionar ao DOM e clicar
        document.body.appendChild(input);
        input.click();
    }

    // Mostrar navegador de pastas
    async showFolderBrowser(selectionContext, callback = null, startPath = '') {
        const browserContext = selectionContext || 'source';
        const initialPath = this.getFolderBrowserStartPath(browserContext, startPath) || this.getDefaultBrowserPath();
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content folder-browser-modal" style="max-width: 700px; width: 90%;">
                <div class="modal-header">
                    <h3>Selecionar Pasta</h3>
                    <button class="modal-close folder-browser-close-btn">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="folder-browser">
                        <div class="current-path">
                            <input type="text" id="browser-path" value="${initialPath}" placeholder="Digite o caminho da pasta ou navegue">
                            <button class="btn btn-sm folder-browser-up-btn" title="Navegar para pasta pai">
                                <span class="material-icons">arrow_upward</span>
                            </button>
                            <button class="btn btn-sm folder-browser-refresh-btn" title="Atualizar lista de pastas">
                                <span class="material-icons">refresh</span>
                            </button>
                        </div>
                        <div class="folder-list" id="folder-list">
                            <div class="empty-state">
                                <span class="material-icons">folder_open</span>
                                <p>Digite o caminho da pasta ou clique em "Atualizar" para navegar</p>
                                <small>VocÃƒÆ’Ã‚Âª pode inserir o caminho manualmente ou navegar pelas pastas</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary folder-browser-cancel-btn">Cancelar</button>
                    <button class="btn btn-primary folder-browser-select-btn" data-selection-context="${browserContext}">Selecionar Esta Pasta</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Configurar event listeners apÃƒÆ’Ã‚Â³s criar o modal
        this.setupFolderBrowserEventListeners(modal, browserContext, callback);

        // Obter diretÃƒÆ’Ã‚Â³rio home do usuÃƒÆ’Ã‚Â¡rio automaticamente
        this.setDefaultPath(modal, initialPath);

        // NÃƒÆ’Ã‚Â£o carregar pastas automaticamente - permitir entrada manual    }

    // Definir caminho padrÃƒÆ’Ã‚Â£o baseado no sistema operacional
    async setDefaultPath(modal, preferredPath = '') {
        if (preferredPath) {
            const pathInput = modal.querySelector('#browser-path');
            if (pathInput) {
                pathInput.value = preferredPath;
            }
            return;
        }

        try {
            // Tentar obter o diretÃƒÆ’Ã‚Â³rio home via API
            const response = await fetch('/api/status/system');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.userHome) {
                    const pathInput = modal.querySelector('#browser-path');
                    if (pathInput) {
                        pathInput.value = data.data.userHome;                        return;
                    }
                }
            }
        } catch (error) {        }

        // Fallback: usar caminho padrÃƒÆ’Ã‚Â£o baseado no sistema
        const pathInput = modal.querySelector('#browser-path');
        if (pathInput) {
            const defaultPath = this.getDefaultBrowserPath();
            pathInput.value = defaultPath;        }
    }

    // Carregar pastas de um diretÃƒÆ’Ã‚Â³rio (para o modal de navegaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o)
    async loadFoldersForBrowser(path) {
        try {
            const response = await fetch('/api/files/list-folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.success) {                this.renderFolders(result.data.folders, result.data.currentPath || path);
            } else {
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro na resposta da API:', result.error);
                this.showToast('Erro ao carregar pastas: ' + (result.error?.message || 'Erro desconhecido'), 'error');
            }
        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao carregar pastas:', error);
            this.showToast('Erro ao carregar pastas: ' + error.message, 'error');
        }
    }

    // Configurar event listeners para o navegador de pastas
    setupFolderBrowserEventListeners(modal, selectionContext, callback = null) {
        // BotÃƒÆ’Ã‚Â£o fechar
        const closeBtn = modal.querySelector('.folder-browser-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }

        // BotÃƒÆ’Ã‚Â£o voltar
        const upBtn = modal.querySelector('.folder-browser-up-btn');
        if (upBtn) {
            upBtn.addEventListener('click', () => this.goUp(modal));
        }

        // BotÃƒÆ’Ã‚Â£o atualizar/refresh
        const refreshBtn = modal.querySelector('.folder-browser-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const currentPath = modal.querySelector('#browser-path').value;
                if (currentPath) {
                    this.loadFoldersForBrowser(currentPath);
                }
            });
        }

        // Permitir entrada manual no campo de caminho
        const pathInput = modal.querySelector('#browser-path');
        if (pathInput) {
            pathInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const path = pathInput.value.trim();
                    if (path) {
                        this.loadFoldersForBrowser(path);
                    }
                }
            });
        }

        // BotÃƒÆ’Ã‚Â£o cancelar
        const cancelBtn = modal.querySelector('.folder-browser-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => modal.remove());
        }

        // BotÃƒÆ’Ã‚Â£o selecionar
        const selectBtn = modal.querySelector('.folder-browser-select-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                const context = selectBtn.getAttribute('data-selection-context') || selectionContext;
                this.selectCurrentFolder(context, callback, modal);
            });
        }
    }

    // Renderizar lista de pastas
    renderFolders(folders, currentPath) {
        const pathInput = document.getElementById('browser-path');
        if (pathInput) {
            pathInput.value = currentPath;
        }

        const folderList = document.getElementById('folder-list');
        if (!folderList) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Elemento folder-list nÃƒÆ’Ã‚Â£o encontrado!');
            return;
        }

        if (!folders || folders.length === 0) {            folderList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">folder_open</span>
                    <p>Nenhuma pasta encontrada</p>
                    <small>Este diretÃƒÆ’Ã‚Â³rio nÃƒÆ’Ã‚Â£o contÃƒÆ’Ã‚Â©m subpastas ou o caminho nÃƒÆ’Ã‚Â£o existe</small>
                    <button class="btn btn-sm btn-outline folder-retry-btn" style="margin-top: 10px;">
                        <span class="material-icons">refresh</span>
                        Tentar Novamente
                    </button>
                </div>
            `;
            
            // Configurar event listener para o botÃƒÆ’Ã‚Â£o de tentar novamente
            const retryBtn = folderList.querySelector('.folder-retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    this.loadFoldersForBrowser(currentPath);
                });
            }
            return;
        }
        folderList.innerHTML = folders.map(folder => `
            <div class="folder-item" data-path="${folder.path}">
                <div class="folder-icon">
                    <span class="material-icons">folder</span>
                </div>
                <div class="folder-info">
                    <div class="folder-name">${folder.name}</div>
                    <div class="folder-path">${folder.path}</div>
                </div>
                <div class="folder-actions">
                    <span class="material-icons">chevron_right</span>
                </div>
            </div>
        `).join('');

        // Configurar event listeners para os itens de pasta
        const folderItems = folderList.querySelectorAll('.folder-item');
        folderItems.forEach(item => {
            item.addEventListener('click', () => {
                const path = item.getAttribute('data-path');                this.navigateTo(path);
            });
        });    }

    // Navegar para uma pasta
    navigateTo(path) {
        this.loadFoldersForBrowser(path);
    }

    getParentPath(currentPath) {
        if (!currentPath) {
            return this.getDefaultBrowserPath();
        }

        const normalized = currentPath.replace(/[\\/]+$/, '');
        if (/^[a-zA-Z]:$/.test(normalized)) {
            return normalized;
        }

        const separator = normalized.includes('\\') ? '\\' : '/';
        const parts = normalized.split(separator).filter(Boolean);

        if (separator === '\\') {
            const driveMatch = normalized.match(/^[a-zA-Z]:/);
            const drive = driveMatch ? driveMatch[0] : '';
            if (parts.length <= 1) {
                return drive || normalized;
            }

            const relative = parts.slice(1, -1).join(separator);
            return relative ? `${drive}${separator}${relative}` : `${drive}${separator}`;
        }

        if (parts.length <= 1) {
            return '/';
        }

        return `/${parts.slice(0, -1).join('/')}`;
    }

    // Voltar um nÃƒÆ’Ã‚Â­vel
    goUp(modal = null) {
        const pathInput = modal?.querySelector('#browser-path') || document.getElementById('browser-path');
        const currentPath = pathInput?.value || '';
        const parentPath = this.getParentPath(currentPath);
        this.loadFoldersForBrowser(parentPath);
    }

    // Selecionar filtro rÃƒÆ’Ã‚Â¡pido
    selectFilter(event) {
        const button = event.target;
        const filter = button.getAttribute('data-filter');
        const filterInput = document.getElementById('schedule-filters');        
        if (filterInput) {
            filterInput.value = filter;
            
            // Remover classe active de todos os botÃƒÆ’Ã‚Âµes
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Adicionar classe active ao botÃƒÆ’Ã‚Â£o clicado
            button.classList.add('active');            
            // Atualizar resumo da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o se estiver visÃƒÆ’Ã‚Â­vel
            if (typeof updateOperationSummary === 'function') {
                updateOperationSummary();
            }
        } else {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Campo de filtros nÃƒÆ’Ã‚Â£o encontrado!');
        }
    }

    // Navegar e selecionar pasta para o modal de agendamento
    legacyBrowsePathForSchedule(type) {
        const currentPath = type === 'source' 
            ? document.getElementById('schedule-source').value || '/home/yo'
            : document.getElementById('schedule-target').value || '/home/yo';        
        // Usar a funÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o existente de navegaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de pastas
        this.showFolderBrowser(currentPath, (selectedPath) => {
            if (type === 'source') {
                document.getElementById('schedule-source').value = selectedPath;            } else {
                document.getElementById('schedule-target').value = selectedPath;            }
        });
    }

    // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o auxiliar para preencher campo com mÃƒÆ’Ã‚Âºltiplas tentativas
    fillFieldWithRetry(field, value, fieldName) {
        if (!field) return false;
        
        // Tentativa 1: MÃƒÆ’Ã‚Â©todo direto
        field.value = value;        
        if (field.value === value) {            return true;
        }
        
        // Tentativa 2: Disparar eventos
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));        
        if (field.value === value) {            return true;
        }
        
        // Tentativa 3: ForÃƒÆ’Ã‚Â§ar com setTimeout
        setTimeout(() => {
            field.value = value;        }, 50);
        
        return field.value === value;
    }

    // Selecionar pasta atual
    selectCurrentFolder(targetType, callback = null) {
        const selectedPath = document.getElementById('browser-path').value;        
        // Se hÃƒÆ’Ã‚Â¡ um callback, usar ele em vez da lÃƒÆ’Ã‚Â³gica padrÃƒÆ’Ã‚Â£o
        if (callback && typeof callback === 'function') {
            callback(selectedPath);
            // Fechar modal
            document.querySelector('.folder-browser-modal').closest('.modal').remove();
            return;
        }

        if (targetType === 'source') {
            // Verificar se existe o campo complexo primeiro (mais comum)
            let sourceField = document.getElementById('source-folder-path'); // Campo complexo
            if (!sourceField) {
                sourceField = document.getElementById('source-path'); // Campo simples            } else {            }
            
            if (sourceField) {
                // Usar funÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o auxiliar para preencher com mÃƒÆ’Ã‚Âºltiplas tentativas
                const success = this.fillFieldWithRetry(sourceField, selectedPath, 'source-folder-path');
                
                if (success) {
                    this.currentConfig.sourcePath = selectedPath;                    this.showToast(`Pasta de origem selecionada: ${selectedPath}`, 'success');
                } else {
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Falha ao preencher campo de origem');
                    this.showToast('Erro: Falha ao preencher campo de origem', 'error');
                }
            } else {
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Campo de pasta de origem nÃƒÆ’Ã‚Â£o encontrado');
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Tentou source-folder-path:', !!document.getElementById('source-folder-path'));
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Tentou source-path:', !!document.getElementById('source-path'));
                this.showToast('Erro: Campo de pasta de origem nÃƒÆ’Ã‚Â£o encontrado', 'error');
            }
        } else if (targetType === 'target') {
            // Verificar se existe o campo complexo primeiro (mais comum)
            let targetField = document.getElementById('target-folder-path'); // Campo complexo
            if (!targetField) {
                targetField = document.getElementById('dest-path'); // Campo simples            } else {            }
            
            if (targetField) {
                // Usar funÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o auxiliar para preencher com mÃƒÆ’Ã‚Âºltiplas tentativas
                const success = this.fillFieldWithRetry(targetField, selectedPath, 'target-folder-path');
                
                if (success) {
                    this.currentConfig.targetPath = selectedPath;                    this.showToast(`Pasta de destino selecionada: ${selectedPath}`, 'success');
                } else {
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Falha ao preencher campo de destino');
                    this.showToast('Erro: Falha ao preencher campo de destino', 'error');
                }
            } else {
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Campo de pasta de destino nÃƒÆ’Ã‚Â£o encontrado');
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Tentou target-folder-path:', !!document.getElementById('target-folder-path'));
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Tentou dest-path:', !!document.getElementById('dest-path'));
                this.showToast('Erro: Campo de pasta de destino nÃƒÆ’Ã‚Â£o encontrado', 'error');
            }
        }

        // Fechar modal
        document.querySelector('.folder-browser-modal').closest('.modal').remove();
    }

    // Overrides canônicos para fileops e browser de pastas
    async showFolderBrowser(selectionContext, callback = null, startPath = '') {
        const browserContext = selectionContext || 'source';
        const initialPath = this.getFolderBrowserStartPath(browserContext, startPath) || this.getDefaultBrowserPath();
        const contextMeta = this.getSelectionContextMeta(browserContext);
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content folder-browser-modal" style="max-width: 700px; width: 90%;">
                <div class="modal-header">
                    <h3>${contextMeta.title}</h3>
                    <button class="modal-close folder-browser-close-btn">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="folder-browser">
                        <div class="folder-browser-context">
                            <strong>Contexto:</strong> ${contextMeta.title}
                        </div>
                        <div class="current-path">
                            <input type="text" id="browser-path" value="${initialPath}" placeholder="Digite o caminho da pasta ou navegue">
                            <button class="btn btn-sm folder-browser-up-btn" title="Navegar para pasta pai">
                                <span class="material-icons">arrow_upward</span>
                            </button>
                            <button class="btn btn-sm folder-browser-refresh-btn" title="Atualizar lista de pastas">
                                <span class="material-icons">refresh</span>
                            </button>
                        </div>
                        <div class="folder-list" id="folder-list">
                            <div class="empty-state">
                                <span class="material-icons">folder_open</span>
                                <p>Digite o caminho da pasta ou clique em "Atualizar" para navegar</p>
                                <small>Você pode inserir o caminho manualmente ou navegar pelas pastas</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary folder-browser-cancel-btn">Cancelar</button>
                    <button class="btn btn-primary folder-browser-select-btn" data-selection-context="${browserContext}">${contextMeta.actionLabel}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupFolderBrowserEventListeners(modal, browserContext, callback);
        await this.setDefaultPath(modal, initialPath);
    }

    async setDefaultPath(modal, preferredPath = '') {
        if (preferredPath) {
            const pathInput = modal.querySelector('#browser-path');
            if (pathInput) {
                pathInput.value = preferredPath;
            }
            return;
        }

        try {
            const response = await fetch('/api/status/system');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.userHome) {
                    const pathInput = modal.querySelector('#browser-path');
                    if (pathInput) {
                        pathInput.value = data.data.userHome;
                        return;
                    }
                }
            }
        } catch (error) {        }

        const pathInput = modal.querySelector('#browser-path');
        if (pathInput) {
            pathInput.value = this.getDefaultBrowserPath();
        }
    }

    async loadFoldersForBrowser(requestedPath) {
        try {
            const response = await fetch('/api/files/list-folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: requestedPath })
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error?.message || `HTTP ${response.status}`);
            }

            this.renderFolders(result.data.folders, result.data.currentPath || requestedPath);
        } catch (error) {
            this.showToast(`Erro ao carregar pastas: ${error.message}`, 'error');
        }
    }

    setupFolderBrowserEventListeners(modal, selectionContext, callback = null) {
        modal.querySelector('.folder-browser-close-btn')?.addEventListener('click', () => modal.remove());
        modal.querySelector('.folder-browser-cancel-btn')?.addEventListener('click', () => modal.remove());
        modal.querySelector('.folder-browser-up-btn')?.addEventListener('click', () => this.goUp(modal));
        modal.querySelector('.folder-browser-refresh-btn')?.addEventListener('click', () => {
            const currentPath = modal.querySelector('#browser-path')?.value.trim();
            if (currentPath) {
                this.loadFoldersForBrowser(currentPath);
            }
        });

        const pathInput = modal.querySelector('#browser-path');
        if (pathInput) {
            pathInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    const nextPath = pathInput.value.trim();
                    if (nextPath) {
                        this.loadFoldersForBrowser(nextPath);
                    }
                }
            });
        }

        modal.querySelector('.folder-browser-select-btn')?.addEventListener('click', () => {
            const context = modal.querySelector('.folder-browser-select-btn').getAttribute('data-selection-context') || selectionContext;
            this.selectCurrentFolder(context, callback, modal);
        });
    }

    getParentPath(currentPath) {
        if (!currentPath) {
            return this.getDefaultBrowserPath();
        }

        const normalized = currentPath.replace(/[\\/]+$/, '');
        if (/^[a-zA-Z]:$/.test(normalized)) {
            return normalized;
        }

        const separator = normalized.includes('\\') ? '\\' : '/';
        const parts = normalized.split(separator).filter(Boolean);

        if (separator === '\\') {
            const driveMatch = normalized.match(/^[a-zA-Z]:/);
            const drive = driveMatch ? driveMatch[0] : '';
            if (parts.length <= 1) {
                return drive || normalized;
            }

            const relative = parts.slice(1, -1).join(separator);
            return relative ? `${drive}${separator}${relative}` : `${drive}${separator}`;
        }

        if (parts.length <= 1) {
            return '/';
        }

        return `/${parts.slice(0, -1).join('/')}`;
    }

    goUp(modal = null) {
        const pathInput = modal?.querySelector('#browser-path') || document.getElementById('browser-path');
        const parentPath = this.getParentPath(pathInput?.value || '');
        this.loadFoldersForBrowser(parentPath);
    }

    browsePathForSchedule(type) {
        const selectionContext = type === 'source' ? 'schedule-source' : 'schedule-target';
        const currentPath = type === 'source'
            ? (document.getElementById('schedule-source').value || this.getOperationDraft().sourcePath)
            : (document.getElementById('schedule-target').value || this.getOperationDraft().targetPath);

        this.showFolderBrowser(selectionContext, null, currentPath || this.getDefaultBrowserPath());
    }

    selectCurrentFolder(selectionContext, callback = null, modal = null) {
        const pathInput = modal?.querySelector('#browser-path') || document.getElementById('browser-path');
        const selectedPath = pathInput?.value || '';

        if (callback && typeof callback === 'function') {
            callback(selectedPath);
            modal?.remove();
            return;
        }

        this.applyFolderSelection(selectionContext, selectedPath);
        modal?.remove();
    }

    // Configurar event listeners seguros para CSP (substituir onclick/onchange inline)
    setupCSPSafeEventListeners() {
        // Barra de busca de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes agendadas
        const searchInput = document.querySelector('.filter-scheduled-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterScheduledOperations(e.target.value);
            });
        }

        // Selects do formulÃƒÆ’Ã‚Â¡rio de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
        const sourceFolderSelect = document.querySelector('.source-folder-select');
        if (sourceFolderSelect) {
            sourceFolderSelect.addEventListener('change', () => {
                this.updateSourceFolderInfo();
            });
        }

        const targetFolderSelect = document.querySelector('.target-folder-select');
        if (targetFolderSelect) {
            targetFolderSelect.addEventListener('change', () => {
                this.updateTargetFolderInfo();
            });
        }

        const fileActionSelect = document.querySelector('.file-action-select');
        if (fileActionSelect) {
            fileActionSelect.addEventListener('change', () => {
                this.updateActionHelp();
            });
        }

        const executionFrequencySelect = document.querySelector('.execution-frequency-select');
        if (executionFrequencySelect) {
            executionFrequencySelect.addEventListener('change', () => {
                this.toggleCronField();
            });
        }

        const filterTypeSelect = document.querySelector('.filter-type-select');
        if (filterTypeSelect) {
            filterTypeSelect.addEventListener('change', () => {
                this.toggleFilterOptions();
            });
        }

        // Checkboxes de transformaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        const uppercaseCheckbox = document.querySelector('.transform-uppercase-checkbox');
        if (uppercaseCheckbox) {
            uppercaseCheckbox.addEventListener('change', () => {
                this.toggleCaseConflict();
            });
        }

        const lowercaseCheckbox = document.querySelector('.transform-lowercase-checkbox');
        if (lowercaseCheckbox) {
            lowercaseCheckbox.addEventListener('change', () => {
                this.toggleCaseConflict();
            });
        }

        const autoCleanupCheckbox = document.querySelector('.auto-cleanup-checkbox');
        if (autoCleanupCheckbox) {
            autoCleanupCheckbox.addEventListener('change', () => {
                this.toggleCleanupOptions();
            });
        }

        // Selects do formulÃƒÆ’Ã‚Â¡rio de pastas
        const folderTypeSelect = document.querySelector('.folder-type-select');
        if (folderTypeSelect) {
            folderTypeSelect.addEventListener('change', () => {
                this.updateFolderTypeHelp();
            });
        }

        // Select do formulÃƒÆ’Ã‚Â¡rio de agendamento
        const scheduleActionSelect = document.querySelector('.schedule-action-select');
        if (scheduleActionSelect) {
            scheduleActionSelect.addEventListener('change', () => {
                if (typeof updateScheduleForm === 'function') {
                    updateScheduleForm();
                }
            });
        }
        
        // Event listeners para atualizar resumo da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        const scheduleSourceInput = document.getElementById('schedule-source');
        const scheduleTargetInput = document.getElementById('schedule-target');
        
        if (scheduleSourceInput) {
            scheduleSourceInput.addEventListener('input', updateOperationSummary);
        }
        if (scheduleTargetInput) {
            scheduleTargetInput.addEventListener('input', updateOperationSummary);
        }

        const sourceConfiguredSelect = document.getElementById('fileops-source-configured');
        if (sourceConfiguredSelect) {
            sourceConfiguredSelect.addEventListener('change', (event) => {
                if (event.target.value) {
                    this.applyFolderSelection('source', event.target.value);
                }
            });
        }

        const targetConfiguredSelect = document.getElementById('fileops-target-configured');
        if (targetConfiguredSelect) {
            targetConfiguredSelect.addEventListener('change', (event) => {
                if (event.target.value) {
                    this.applyFolderSelection('target', event.target.value);
                }
            });
        }

        const sourceFolderPath = document.getElementById('source-folder-path');
        if (sourceFolderPath) {
            sourceFolderPath.addEventListener('change', () => this.syncDraftFromFileOps());
        }

        const targetFolderPath = document.getElementById('target-folder-path');
        if (targetFolderPath) {
            targetFolderPath.addEventListener('change', () => this.syncDraftFromFileOps());
        }

        // Input de validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de nome
        const nameInput = document.querySelector('.validate-name-input');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.validateField(e.target, 'name');
            });
        }

        // BotÃƒÆ’Ã‚Âµes de navegaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de pastas no dashboard
        const browseSourceBtn = document.querySelector('.browse-source-btn');
        if (browseSourceBtn) {
            browseSourceBtn.addEventListener('click', () => {
                this.browseSourcePath();
            });
        }

        const browseDestBtn = document.querySelector('.browse-dest-btn');
        if (browseDestBtn) {
            browseDestBtn.addEventListener('click', () => {
                this.browseDestPath();
            });
        }

        // BotÃƒÆ’Ã‚Âµes de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes simples
        const simpleOperationBtns = document.querySelectorAll('.simple-operation-btn');
        simpleOperationBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const operation = btn.getAttribute('data-operation');
                this.executeSimpleOperation(operation);
            });
        });

        // Input do slideshow com Enter
        const slideshowFolderInput = document.querySelector('.slideshow-folder-input');
        if (slideshowFolderInput) {
            slideshowFolderInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.startSlideshow();
                }
            });
        }
    }

    // Selecionar pasta sugerida
    selectSuggestedFolder(event) {
        const button = event.target;
        const path = button.getAttribute('data-path');

        if (path) {
            this.currentConfig.sourcePath = path;
            document.getElementById('source-folder-path').value = path;
            this.showToast(`Pasta selecionada: ${path}`, 'success');
        }
    }

    // Selecionar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    selectOperation(operation) {        
        // Remove classe active de todos os botÃƒÆ’Ã‚Âµes
        document.querySelectorAll('.operation-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Adiciona classe active ao botÃƒÆ’Ã‚Â£o selecionado
        const selectedBtn = document.querySelector(`.${operation}-btn`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        this.currentConfig.operation = operation;

        // Verificar se o campo de origem estÃƒÆ’Ã‚Â¡ visÃƒÆ’Ã‚Â­vel
        const sourceField = document.getElementById('source-folder-path');
        const sourceFieldParent = sourceField?.parentElement;
        // Garantir que o campo de origem esteja sempre visÃƒÆ’Ã‚Â­vel
        if (sourceFieldParent) {
            sourceFieldParent.style.display = 'block';        }

        // Controla a visibilidade e obrigatoriedade do campo destino
        const targetField = document.getElementById('target-folder-path').parentElement;
        const targetInput = document.getElementById('target-folder-path');
        const targetHelp = document.getElementById('target-help');

        if (operation === 'delete') {
            // Para apagar, o campo destino ÃƒÆ’Ã‚Â© opcional e fica oculto
            targetField.style.display = 'none';
            targetInput.required = false;
            targetInput.value = ''; // Limpar valor
        } else {
            // Para mover/copiar, o campo destino ÃƒÆ’Ã‚Â© obrigatÃƒÆ’Ã‚Â³rio e fica visÃƒÆ’Ã‚Â­vel
            targetField.style.display = 'block';
            targetInput.required = true;

            // Atualizar texto de ajuda
            const operationText = operation === 'move' ? 'mover' : 'copiar';
            targetHelp.textContent = `Selecione a pasta de destino (obrigatÃƒÆ’Ã‚Â³rio para ${operationText})`;
        }

        this.showToast(`OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o selecionada: ${operation}`, 'info');
    }

    // Executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o imediatamente
    async executeNow() {
        const sourcePath = this.currentConfig.sourcePath;
        const operation = this.currentConfig.operation;
        const targetPath = document.getElementById('target-folder-path').value.trim();

        if (!sourcePath) {
            this.showToast('Selecione uma pasta de origem', 'error');
            return;
        }

        if (!operation) {
            this.showToast('Selecione uma operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error');
            return;
        }

        if ((operation === 'move' || operation === 'copy') && !targetPath) {
            this.showToast('Digite o caminho de destino', 'error');
            return;
        }

        try {
            this.showToast(`Executando ${operation}...`, 'info');

            // Executa a operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o diretamente via API
            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: operation,
                    sourcePath: sourcePath,
                    targetPath: targetPath,
                    options: {
                        recursive: true
                    }
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showToast(`OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ${operation} executada com sucesso!`, 'success', true);
            } else {
                this.showToast(`Erro: ${result.error?.message || 'Erro desconhecido'}`, 'error');
            }

        } catch (error) {
            console.error('Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:', error);
            this.showToast('Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error');
        }
    }

    // Configurar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o completa (para agendamento)
    legacyConfigureOperation() {
        // Obter valores atuais dos campos
        const sourcePath = document.getElementById('source-folder-path')?.value.trim() || this.currentConfig.sourcePath;
        const operation = this.currentConfig.operation;
        const targetPath = document.getElementById('target-folder-path')?.value.trim() || '';
        if (!sourcePath) {
            this.showToast('Selecione uma pasta de origem', 'error');
            return;
        }

        if (!operation) {
            this.showToast('Selecione uma operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error');
            return;
        }

        if ((operation === 'move' || operation === 'copy') && !targetPath) {
            this.showToast('Digite o caminho de destino', 'error');
            return;
        }

        // Atualizar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o atual com valores dos campos
        this.currentConfig.sourcePath = sourcePath;
        this.currentConfig.operation = operation;
        this.currentConfig.targetPath = targetPath;
        this.showToast(`OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o configurada: ${operation} de ${sourcePath}`, 'success');

        // Abre o modal de agendamento
        if (typeof window.showScheduleModal === 'function') {
            window.showScheduleModal({ mode: 'create' });
        }
    }

    // Overrides canônicos do fluxo fileops
    selectSuggestedFolder(event) {
        const button = event.target;
        const selectedPath = button.getAttribute('data-path');

        if (selectedPath) {
            this.applyFolderSelection('source', selectedPath);
        }
    }

    selectOperation(operation) {
        document.querySelectorAll('.operation-btn').forEach((button) => {
            button.classList.remove('active');
        });

        const selectedButton = document.querySelector(`.${operation}-btn`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }

        this.updateOperationDraft({
            operation,
            ...(operation === 'delete' ? { targetPath: '' } : {})
        });

        this.showToast(`Operação selecionada: ${operation}`, 'info');
    }

    async executeNow() {
        const validation = this.validateOperationDraft('execute');
        if (!validation.isValid) {
            this.showToast(validation.errors[0], 'error');
            return;
        }

        try {
            this.isExecutingOperation = true;
            this.updateOperationDraft({ mode: 'execute' });

            const { sourcePath, operation, targetPath, options } = validation.draft;
            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: operation,
                    sourcePath,
                    ...(targetPath ? { targetPath } : {}),
                    options: {
                        ...(options || {}),
                        batch: true,
                        preserveStructure: true
                    }
                })
            });

            const result = await response.json();
            if (result.success) {
                this.showToast(`Operação ${operation} executada com sucesso!`, 'success', true);
            } else {
                this.showToast(result.error?.message || 'Erro ao executar operação', 'error');
            }
        } catch (error) {
            console.error('Erro ao executar operação:', error);
            this.showToast('Erro ao executar operação', 'error');
        } finally {
            this.isExecutingOperation = false;
            this.refreshFileOpsState();
        }
    }

    configureOperation() {
        const validation = this.validateOperationDraft('execute');
        if (!validation.isValid) {
            this.showToast(validation.errors[0], 'error');
            return;
        }

        this.updateOperationDraft({
            ...validation.draft,
            mode: 'schedule'
        });

        try {
            const modal = document.getElementById('schedule-modal');
            if (!modal) {
                throw new Error('Modal de agendamento não encontrado');
            }

            modal.style.display = 'flex';
            document.body.classList.add('modal-open');
            populateScheduleModal(modal, {
                ...validation.draft,
                mode: 'schedule'
            }, 'create');
        } catch (error) {
            console.error('Erro ao abrir modal canônico de agendamento:', error);
            this.showToast('Não foi possível abrir o agendamento.', 'error');
        }
    }

    // ==========================================
    // SLIDESHOW FUNCTIONALITY
    // ==========================================

    // Sistema de Slideshow
    slideshowImages = [];
    currentSlideIndex = 0;
    slideshowInterval = null;
    slideshowPlaying = false;
    slideshowConfig = {
        interval: 3,
        random: false,
        preload: true,
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
        recursive: true,
        deletedFolder: '',
        hiddenFolder: '',
        adjustableFolder: ''
    };
    preloadedImages = new Map();

    getDefaultSlideshowConfig() {
        return {
            interval: 3,
            random: false,
            preload: true,
            extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
            recursive: true,
            deletedFolder: '',
            hiddenFolder: '',
            adjustableFolder: ''
        };
    }

    getDefaultScreensaverConfig() {
        return {
            enabled: true,
            idleMinutes: 3,
            exitMode: 'esc_only'
        };
    }

    getDefaultAppSettings() {
        return {
            port: 3000,
            logLevel: 'info',
            environment: 'production',
            logDirectory: 'logs/'
        };
    }

    normalizeSlideshowConfig(config = {}) {
        const defaults = this.getDefaultSlideshowConfig();
        const normalizedExtensions = Array.isArray(config.extensions)
            ? Array.from(new Set(config.extensions
                .map(ext => typeof ext === 'string' ? ext.trim().toLowerCase() : '')
                .filter(Boolean)
                .map(ext => ext.startsWith('.') ? ext : `.${ext}`)))
            : [];

        return {
            interval: Math.max(1, Math.min(60, Number(config.interval) || defaults.interval)),
            random: config.random === undefined ? defaults.random : Boolean(config.random),
            preload: config.preload === undefined ? defaults.preload : Boolean(config.preload),
            extensions: normalizedExtensions.length > 0 ? normalizedExtensions : [...defaults.extensions],
            recursive: config.recursive === undefined ? defaults.recursive : Boolean(config.recursive),
            deletedFolder: typeof config.deletedFolder === 'string' ? config.deletedFolder.trim() : '',
            hiddenFolder: typeof config.hiddenFolder === 'string' ? config.hiddenFolder.trim() : '',
            adjustableFolder: typeof config.adjustableFolder === 'string' ? config.adjustableFolder.trim() : ''
        };
    }

    normalizeScreensaverConfig(config = {}) {
        const defaults = this.getDefaultScreensaverConfig();
        return {
            enabled: config.enabled === undefined ? defaults.enabled : Boolean(config.enabled),
            idleMinutes: Math.max(1, Math.min(180, Number(config.idleMinutes) || defaults.idleMinutes)),
            exitMode: 'esc_only'
        };
    }

    normalizeAppSettings(settings = {}) {
        const defaults = this.getDefaultAppSettings();
        return {
            port: Math.max(1, Number(settings.port) || defaults.port),
            logLevel: typeof settings.logLevel === 'string' && settings.logLevel.trim()
                ? settings.logLevel.trim()
                : defaults.logLevel,
            environment: typeof settings.environment === 'string' && settings.environment.trim()
                ? settings.environment.trim()
                : defaults.environment,
            logDirectory: typeof settings.logDirectory === 'string' && settings.logDirectory.trim()
                ? settings.logDirectory.trim()
                : defaults.logDirectory
        };
    }

    syncFunctionalConfigToLocalCache() {
        try {
            localStorage.setItem('slideshowConfig', JSON.stringify(this.slideshowConfig));
            localStorage.setItem('slideshowSelectedPath', this.getSlideshowSelectedPath());
            localStorage.setItem('screensaverConfig', JSON.stringify(this.screensaverConfig));
        } catch (error) {
            console.warn('Falha ao sincronizar cache local de configuracoes:', error);
        }
    }

    applyFunctionalConfig(config = {}) {
        this.persistedConfig = config || {};
        this.slideshowConfig = this.normalizeSlideshowConfig(config.slideshowConfig || this.slideshowConfig);
        this.screensaverConfig = this.normalizeScreensaverConfig(config.screensaverConfig || this.screensaverConfig);
        this.settings = this.normalizeAppSettings(config.appSettings || this.settings);
        this.persistedConfig.slideshowConfig = this.slideshowConfig;
        this.persistedConfig.screensaverConfig = this.screensaverConfig;
        this.persistedConfig.appSettings = this.settings;
        this.persistedConfig.slideshowSelectedPath = typeof config.slideshowSelectedPath === 'string'
            ? config.slideshowSelectedPath.trim()
            : (this.persistedConfig.slideshowSelectedPath || '');
        this.syncFunctionalConfigToLocalCache();
    }

    async saveFunctionalConfig(partialConfig = {}) {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: partialConfig })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (!result.success || !result.config) {
            throw new Error(result.error || 'Falha ao salvar configuracoes');
        }

        this.applyFunctionalConfig(result.config);
        return result.config;
    }

    async migrateLegacyFunctionalConfig(serverConfig = {}) {
        const patch = {};

        try {
            const savedSlideshowConfig = localStorage.getItem('slideshowConfig');
            if (savedSlideshowConfig) {
                const legacySlideshowConfig = this.normalizeSlideshowConfig(JSON.parse(savedSlideshowConfig));
                const currentSlideshowConfig = this.normalizeSlideshowConfig(serverConfig.slideshowConfig || {});
                const shouldPromoteSlideshow =
                    !serverConfig.slideshowConfig ||
                    JSON.stringify(currentSlideshowConfig) === JSON.stringify(this.getDefaultSlideshowConfig());

                if (shouldPromoteSlideshow && JSON.stringify(legacySlideshowConfig) !== JSON.stringify(this.getDefaultSlideshowConfig())) {
                    patch.slideshowConfig = legacySlideshowConfig;
                }
            }

            const savedSlideshowPath = localStorage.getItem('slideshowSelectedPath');
            if (savedSlideshowPath && !serverConfig.slideshowSelectedPath) {
                patch.slideshowSelectedPath = savedSlideshowPath.trim();
            }

            const savedScreensaverConfig = localStorage.getItem('screensaverConfig');
            if (savedScreensaverConfig) {
                const legacyScreensaverConfig = this.normalizeScreensaverConfig(JSON.parse(savedScreensaverConfig));
                const currentScreensaverConfig = this.normalizeScreensaverConfig(serverConfig.screensaverConfig || {});
                const shouldPromoteScreensaver =
                    !serverConfig.screensaverConfig ||
                    JSON.stringify(currentScreensaverConfig) === JSON.stringify(this.getDefaultScreensaverConfig());

                if (shouldPromoteScreensaver && JSON.stringify(legacyScreensaverConfig) !== JSON.stringify(this.getDefaultScreensaverConfig())) {
                    patch.screensaverConfig = legacyScreensaverConfig;
                }
            }
        } catch (error) {
            console.warn('Falha ao migrar configuracoes legadas do navegador:', error);
        }

        if (Object.keys(patch).length === 0) {
            return serverConfig;
        }

        try {
            return await this.saveFunctionalConfig(patch);
        } catch (error) {
            console.warn('Falha ao promover configuracoes legadas para o arquivo local:', error);
            return serverConfig;
        }
    }

    // Carrega configuracões salvas no servidor e mescla no localStorage
    async loadServerConfigLegacy() {
        try {
            const res = await fetch('/api/config');
            if (!res.ok) {
                this.applyFunctionalConfig({
                    slideshowConfig: this.getDefaultSlideshowConfig(),
                    slideshowSelectedPath: '',
                    screensaverConfig: this.getDefaultScreensaverConfig(),
                    appSettings: this.getDefaultAppSettings()
                });
                return;
            }
            const data = await res.json();
            if (!data.success || !data.config) return;
            const hydratedConfig = await this.migrateLegacyFunctionalConfig(data.config);
            this.applyFunctionalConfig(hydratedConfig);
        } catch (err) {
            console.warn('loadServerConfig: falha ao carregar config do servidor', err);
            this.applyFunctionalConfig({
                slideshowConfig: this.getDefaultSlideshowConfig(),
                slideshowSelectedPath: '',
                screensaverConfig: this.getDefaultScreensaverConfig(),
                appSettings: this.getDefaultAppSettings()
            });
        }
    }

    // Carregar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes do slideshow do localStorage
    loadSlideshowConfig() {
        const saved = localStorage.getItem('slideshowConfig');
        if (saved) {
            try {
                this.slideshowConfig = { ...this.slideshowConfig, ...JSON.parse(saved) };            } catch (error) {
                console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Erro ao carregar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes do slideshow:', error);
            }
        } else {        }
    }

    // Salvar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes do slideshow no localStorage
    saveSlideshowConfigLegacy() {
        try {
            localStorage.setItem('slideshowConfig', JSON.stringify(this.slideshowConfig));
        } catch (error) {
            console.warn('Erro ao salvar slideshowConfig no localStorage:', error);
        }
        // Persistir no servidor (sobrevive a resets de localStorage)
        fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'slideshowConfig', value: this.slideshowConfig })
        }).catch(err => console.warn('Erro ao persistir slideshowConfig no servidor:', err));
    }

    // Aplicar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes do modal para o objeto de configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    applySlideshowConfigFromModal() {
        const interval = parseInt(document.getElementById('slideshow-interval').value) || 3;
        const random = document.getElementById('slideshow-random').checked;
        const preload = document.getElementById('slideshow-preload').checked;
        const recursive = document.getElementById('slideshow-recursive').checked;
        
        // Coletar extensÃƒÆ’Ã‚Âµes selecionadas
        const extensionCheckboxes = document.querySelectorAll('.extensions-list input[type="checkbox"]');
        const extensions = Array.from(extensionCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        // Coletar pastas de organizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        const deletedField = document.getElementById('slideshow-deleted-folder');
        const hiddenField = document.getElementById('slideshow-hidden-folder');
        const adjustableField = document.getElementById('slideshow-adjustable-folder');
        
        const deletedFolder = deletedField ? deletedField.value.trim() : '';
        const hiddenFolder = hiddenField ? hiddenField.value.trim() : '';
        const adjustableFolder = adjustableField ? adjustableField.value.trim() : '';
        this.slideshowConfig = {
            interval: Math.max(1, Math.min(60, interval)),
            random,
            preload,
            extensions: extensions.length > 0 ? extensions : ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
            recursive,
            deletedFolder,
            hiddenFolder,
            adjustableFolder
        };    }

    // Aplicar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes salvas ao modal
    async saveSlideshowSettingsFromModal() {
        const folderPath = document.getElementById('slideshow-folder-path')?.value?.trim() || '';
        if (folderPath) {
            await this.persistSlideshowSelectedPath(folderPath);
        }
        await this.persistSlideshowConfigFromModal(false);
        this.showToast('Configuracoes do slideshow salvas', 'success');
    }

    applySlideshowConfigToModal() {
        document.getElementById('slideshow-interval').value = this.slideshowConfig.interval;
        document.getElementById('slideshow-random').checked = this.slideshowConfig.random;
        document.getElementById('slideshow-preload').checked = this.slideshowConfig.preload;
        document.getElementById('slideshow-recursive').checked = this.slideshowConfig.recursive;

        // Aplicar extensÃƒÆ’Ã‚Âµes selecionadas
        const extensionCheckboxes = document.querySelectorAll('.extensions-list input[type="checkbox"]');
        extensionCheckboxes.forEach(cb => {
            cb.checked = this.slideshowConfig.extensions.includes(cb.value);
        });

        // Aplicar pastas de organizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        const deletedField = document.getElementById('slideshow-deleted-folder');
        const hiddenField = document.getElementById('slideshow-hidden-folder');
        const adjustableField = document.getElementById('slideshow-adjustable-folder');
        
        if (deletedField) {
            deletedField.value = this.slideshowConfig.deletedFolder || '';        } else {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Campo slideshow-deleted-folder nÃƒÆ’Ã‚Â£o encontrado');
        }
        
        if (hiddenField) {
            hiddenField.value = this.slideshowConfig.hiddenFolder || '';        } else {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Campo slideshow-hidden-folder nÃƒÆ’Ã‚Â£o encontrado');
        }

        if (adjustableField) {
            adjustableField.value = this.slideshowConfig.adjustableFolder || '';        } else {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Campo slideshow-adjustable-folder nÃƒÆ’Ã‚Â£o encontrado');
        }
    }

    async loadServerConfig() {
        try {
            const res = await fetch('/api/config');
            if (!res.ok) {
                this.applyFunctionalConfig({
                    slideshowConfig: this.getDefaultSlideshowConfig(),
                    slideshowSelectedPath: '',
                    screensaverConfig: this.getDefaultScreensaverConfig(),
                    appSettings: this.getDefaultAppSettings()
                });
                return;
            }

            const data = await res.json();
            if (!data.success || !data.config) {
                return;
            }

            const hydratedConfig = await this.migrateLegacyFunctionalConfig(data.config);
            this.applyFunctionalConfig(hydratedConfig);
        } catch (err) {
            console.warn('loadServerConfig: falha ao carregar config do servidor', err);
            this.applyFunctionalConfig({
                slideshowConfig: this.getDefaultSlideshowConfig(),
                slideshowSelectedPath: '',
                screensaverConfig: this.getDefaultScreensaverConfig(),
                appSettings: this.getDefaultAppSettings()
            });
        }
    }

    loadSlideshowConfigLegacy() {
        try {
            const cached = localStorage.getItem('slideshowConfig');
            if (cached) {
                this.slideshowConfig = this.normalizeSlideshowConfig(JSON.parse(cached));
            } else {
                this.slideshowConfig = this.normalizeSlideshowConfig(this.persistedConfig?.slideshowConfig || {});
            }        } catch (error) {
            console.warn('Erro ao carregar configuracoes do slideshow:', error);
            this.slideshowConfig = this.normalizeSlideshowConfig(this.persistedConfig?.slideshowConfig || {});
        }
    }

    getSlideshowSelectedPath() {
        return typeof this.persistedConfig?.slideshowSelectedPath === 'string'
            ? this.persistedConfig.slideshowSelectedPath.trim()
            : '';
    }

    async saveSlideshowConfig() {
        this.slideshowConfig = this.normalizeSlideshowConfig(this.slideshowConfig);
        const savedConfig = await this.saveFunctionalConfig({
            slideshowConfig: this.slideshowConfig
        });
        return savedConfig.slideshowConfig;
    }

    async persistSlideshowConfigFromModal(showToast = false) {
        this.applySlideshowConfigFromModal();
        await this.saveSlideshowConfig();
        if (showToast) {
            this.showToast('Configuracoes do slideshow salvas', 'success');
        }
        return this.slideshowConfig;
    }

    async persistSlideshowSelectedPath(rawPath) {
        const normalizedPath = (rawPath || '').trim();
        if (!normalizedPath) return '';

        this.persistedConfig = this.persistedConfig || {};
        this.persistedConfig.slideshowSelectedPath = normalizedPath;
        this.syncFunctionalConfigToLocalCache();

        try {
            await this.saveFunctionalConfig({
                slideshowSelectedPath: normalizedPath
            });
        } catch (error) {
            console.warn('Erro ao persistir slideshowSelectedPath no servidor:', error);
        }

        const field = document.getElementById('slideshow-folder-path');
        if (field) {
            field.value = normalizedPath;
        }

        return normalizedPath;
    }

    applyScreensaverConfigLegacy(nextConfig) {
        this.screensaverConfig = this.normalizeScreensaverConfig(nextConfig);
        this.syncFunctionalConfigToLocalCache();
        this.saveFunctionalConfig({
            screensaverConfig: this.screensaverConfig
        }).catch(() => {});

        if (!this.screensaverConfig.enabled) {
            if (this.screensaverState.timerId) {
                clearTimeout(this.screensaverState.timerId);
                this.screensaverState.timerId = null;
            }
            if (this.screensaverState.isActive || this.screensaverState.dedicatedActive) {
                this.deactivateScreensaver();
            }
            this.disarmDedicatedScreensaverTimer();
            this.updateScreensaverStatusLabel();
            this.showToast('Screensaver desativado', 'info');
            return;
        }

        this.disarmDedicatedScreensaverTimer();
        this.resetScreensaverTimer();
        this.updateScreensaverStatusLabel();
        this.showToast(`Screensaver ativo (${this.screensaverConfig.idleMinutes} min)`, 'success');
    }

    // Adicionar event listeners para slideshow
    addSlideshowEventListeners() {
        if (this.slideshowListenersBound) {
            return;
        }
        this.slideshowListenersBound = true;

        const bindOnce = (selector, handler) => {
            const element = document.querySelector(selector);
            if (!element) return;
            if (element.dataset.listenerAdded === 'true') return;
            element.addEventListener('click', handler);
            element.dataset.listenerAdded = 'true';
        };

        const bindInputOnce = (selector, handler) => {
            const element = document.querySelector(selector);
            if (!element) return;
            if (element.dataset.changeListenerAdded === 'true') return;
            element.addEventListener('change', handler);
            element.dataset.changeListenerAdded = 'true';
        };

        bindOnce('.slideshow-start-btn', () => this.startSlideshowFromModal());
        bindOnce('.slideshow-save-btn', () => this.saveSlideshowSettingsFromModal());
        bindOnce('.slideshow-browse-btn', () => this.browseSlideshowFolder());
        bindOnce('.slideshow-browse-deleted-btn', () => this.browseDeletedFolder());
        bindOnce('.slideshow-browse-hidden-btn', () => this.browseHiddenFolder());
        bindOnce('.slideshow-browse-adjustable-btn', () => this.browseAdjustableFolder());
        bindOnce('.close-slideshow-config-btn', () => this.closeSlideshowModal());
        bindOnce('.slideshow-close-btn', () => this.closeSlideshowModal());
        bindInputOnce('#slideshow-folder-path', async (event) => {
            const nextPath = event.target?.value?.trim() || '';
            if (nextPath) {
                await this.persistSlideshowSelectedPath(nextPath);
            }
        });
        bindInputOnce('#slideshow-deleted-folder', async () => this.persistSlideshowConfigFromModal(false));
        bindInputOnce('#slideshow-hidden-folder', async () => this.persistSlideshowConfigFromModal(false));
        bindInputOnce('#slideshow-adjustable-folder', async () => this.persistSlideshowConfigFromModal(false));


        const slideshowConfigModal = document.getElementById('slideshow-config-modal');
        if (slideshowConfigModal && slideshowConfigModal.dataset.overlayCloseBound !== 'true') {
            slideshowConfigModal.addEventListener('click', (event) => {
                if (event.target === slideshowConfigModal) {
                    this.closeSlideshowModal();
                }
            });
            slideshowConfigModal.dataset.overlayCloseBound = 'true';
        }
        if (!this._slideshowKeyboardListenerAdded) {
            document.addEventListener('keydown', (e) => {
                const viewer = document.getElementById('slideshow-viewer');
                const modal = document.getElementById('slideshow-config-modal');
                if (modal && window.getComputedStyle(modal).display !== 'none' && e.key === 'Escape') {
                    e.preventDefault();
                    this.closeSlideshowModal();
                    return;
                }
                if (viewer && window.getComputedStyle(viewer).display !== 'none') {
                    this.handleSlideshowKeydown(e);
                }
            });
            this._slideshowKeyboardListenerAdded = true;
        }

        if (!this._fullscreenListenerAdded) {
            const handleFullscreen = () => this.handleFullscreenChange();
            document.addEventListener('fullscreenchange', handleFullscreen);
            document.addEventListener('webkitfullscreenchange', handleFullscreen);
            document.addEventListener('mozfullscreenchange', handleFullscreen);
            document.addEventListener('msfullscreenchange', handleFullscreen);
            this._fullscreenListenerAdded = true;
        }
    }

    // Abrir modal de slideshow
    showSlideshowModal() {
        this.loadSlideshowConfig();
        this.applySlideshowConfigToModal();

        const savedPath = this.getSlideshowSelectedPath();
        if (savedPath) {
            const field = document.getElementById('slideshow-folder-path');
            if (field) field.value = savedPath;
        }

        const modal = document.getElementById('slideshow-config-modal');
        if (!modal) return;

        const closeBtn = modal.querySelector('.close-slideshow-config-btn');
        const cancelBtn = modal.querySelector('.slideshow-close-btn');

        if (closeBtn && closeBtn.dataset.listenerAdded !== 'true') {
            closeBtn.addEventListener('click', () => this.closeSlideshowModal());
            closeBtn.dataset.listenerAdded = 'true';
        }

        if (cancelBtn && cancelBtn.dataset.listenerAdded !== 'true') {
            cancelBtn.addEventListener('click', () => this.closeSlideshowModal());
            cancelBtn.dataset.listenerAdded = 'true';
        }

        if (modal.dataset.overlayCloseBound !== 'true') {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    this.closeSlideshowModal();
                }
            });
            modal.dataset.overlayCloseBound = 'true';
        }

        modal.style.display = 'flex';
    }

    // Fechar modal de slideshow
    closeSlideshowModal() {
        const modal = document.getElementById('slideshow-config-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    }

    // Navegar para pasta de slideshow
    browseSlideshowFolder() {
        this.showFolderBrowser('source', async (selectedPath) => {
            const field = document.getElementById('slideshow-folder-path');
            if (field) {
                await this.persistSlideshowSelectedPath(selectedPath);
                this.showToast(`Pasta selecionada: ${selectedPath}`, 'success');
            } else {
                this.showToast('Erro: campo de pasta do slideshow nao encontrado', 'error');
            }
        });
    }


    // Navegar para pasta de fotos excluÃƒÆ’Ã‚Â­das
    browseDeletedFolder() {
        this.showFolderBrowser('source', async (selectedPath) => {
            const field = document.getElementById('slideshow-deleted-folder');
            if (field) {
                field.value = selectedPath;
                await this.persistSlideshowConfigFromModal(false);
                this.showToast(`Pasta de fotos excluidas: ${selectedPath}`, 'success');
            } else {
                this.showToast('Erro: campo de pasta de fotos excluidas nao encontrado', 'error');
            }
        });
    }

    // Navegar para pasta de fotos ocultas
    browseHiddenFolder() {
        this.showFolderBrowser('source', async (selectedPath) => {
            const field = document.getElementById('slideshow-hidden-folder');
            if (field) {
                field.value = selectedPath;
                await this.persistSlideshowConfigFromModal(false);
                this.showToast(`Pasta de fotos ocultas: ${selectedPath}`, 'success');
            } else {
                this.showToast('Erro: campo de pasta de fotos ocultas nao encontrado', 'error');
            }
        });
    }

    // Navegar pela pasta de fotos para ajustar
    browseAdjustableFolder() {
        this.showFolderBrowser('source', async (selectedPath) => {
            const field = document.getElementById('slideshow-adjustable-folder');
            if (field) {
                field.value = selectedPath;
                await this.persistSlideshowConfigFromModal(false);
                this.showToast(`Pasta de fotos para ajustar: ${selectedPath}`, 'success');
            } else {
                this.showToast('Erro: campo de pasta para ajustar nao encontrado', 'error');
            }
        });
    }

    // Configurar event listeners para o modal de seleÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de pasta do slideshow
    setupSlideshowFolderEventListeners(modal) {
        // BotÃƒÆ’Ã‚Â£o fechar
        const closeBtn = modal.querySelector('.slideshow-folder-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }

        // BotÃƒÆ’Ã‚Â£o testar
        const testBtn = modal.querySelector('.slideshow-folder-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testFolderPath());
        }

        // BotÃƒÆ’Ã‚Âµes de sugestÃƒÆ’Ã‚Â£o
        const suggestionBtns = modal.querySelectorAll('.slideshow-suggestion-btn');
        suggestionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const path = btn.getAttribute('data-path');
                this.selectSuggestedFolder(path);
            });
        });

        // BotÃƒÆ’Ã‚Â£o cancelar
        const cancelBtn = modal.querySelector('.slideshow-folder-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => modal.remove());
        }

        // BotÃƒÆ’Ã‚Â£o selecionar
        const selectBtn = modal.querySelector('.slideshow-folder-select-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                this.confirmFolderSelection();
                modal.remove();
            });
        }
    }

    // Selecionar pasta sugerida
    selectSuggestedFolder(path) {
        const input = document.getElementById('folder-path-input');
        if (input) {
            input.value = path;
        }
    }

    // Testar se a pasta existe e tem imagens
    async testFolderPath() {
        const input = document.getElementById('folder-path-input');
        const path = input.value.trim();

        if (!path) {
            this.showToast('Digite um caminho vÃƒÆ’Ã‚Â¡lido', 'warning');
            return;
        }

        try {
            // Tentar listar imagens da pasta
            const response = await fetch('/api/files/list-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderPath: path,
                    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
                    recursive: true
                })
            });

            const result = await response.json();

            if (result.success) {
                const count = result.data.totalCount;
                this.showToast(`ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Pasta encontrada! ${count} imagem(ns) localizada(s)`, 'success');
            } else {
                this.showToast('ÃƒÂ¢Ã‚ÂÃ…â€™ Pasta nÃƒÆ’Ã‚Â£o encontrada ou inacessÃƒÆ’Ã‚Â­vel', 'error');
            }
        } catch (error) {
            this.showToast('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao testar pasta', 'error');
        }
    }

    // Confirmar seleÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de pasta
    confirmFolderSelection() {
        const input = document.getElementById('folder-path-input');
        const slideshowInput = document.getElementById('slideshow-folder-path');

        if (input && slideshowInput) {
            slideshowInput.value = input.value;
        }

        // Fechar modal
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
        }
    }

    // Iniciar slideshow a partir do modal
    async startSlideshowFromModal() {
        let folderPath = document.getElementById('slideshow-folder-path').value.trim();

        if (!folderPath) {
            this.showToast('Selecione uma pasta com imagens', 'error');
            return;
        }

        if (!folderPath.startsWith('/') && !folderPath.match(/^[A-Za-z]:/)) {
            const basePath = '/mnt/lytspot/@SYNC@/_@@PICZ & VIDEOS LYT @@_/_@LYT PicZ por ANO@_';
            folderPath = `${basePath}/${folderPath}`;        }

        if (folderPath.includes('/_@LYT PicZ por ANO@_/_@LYT PicZ por ANO@_/')) {
            folderPath = folderPath.replace('/_@LYT PicZ por ANO@_/_@LYT PicZ por ANO@_/', '/_@LYT PicZ por ANO@_/');        }

        await this.persistSlideshowSelectedPath(folderPath);
        await this.persistSlideshowConfigFromModal(false);
        this.closeSlideshowModal();        await this.loadSlideshowImages(folderPath, this.slideshowConfig.extensions, true, this.slideshowConfig.interval);
    }

    // Carregar imagens do slideshow
    async loadSlideshowImages(folderPath, extensions, recursive, interval) {
        try {            this.showToast('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â Procurando imagens...', 'info');

            // Preparar extensÃƒÆ’Ã‚Âµes para a API
            const formattedExtensions = extensions.map(ext => ext.startsWith('.') ? ext : '.' + ext);

            // SEMPRE forÃƒÆ’Ã‚Â§ar busca recursiva para encontrar TODAS as imagens
            const forceRecursive = true;
            const response = await fetch('/api/files/list-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    folderPath,
                    extensions: formattedExtensions,
                    recursive: forceRecursive
                })
            });
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();            console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  Estrutura da resposta:', {
                success: result.success,
                hasData: !!result.data,
                hasImages: !!(result.data && result.data.images),
                imageCount: result.data?.images?.length || 0
            });

            if (!result.success) {
                throw new Error(result.error?.message || 'Erro ao listar imagens');
            }

            // Verificar se a estrutura da resposta estÃƒÆ’Ã‚Â¡ correta
            if (!result.data || !result.data.images) {
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Estrutura de resposta invÃƒÆ’Ã‚Â¡lida:', result);
                throw new Error('Resposta da API nÃƒÆ’Ã‚Â£o contÃƒÆ’Ã‚Â©m dados de imagens');
            }

            this.slideshowImages = result.data.images;
            this.slideshowInterval = interval * 1000;
            if (this.slideshowImages.length === 0) {
                this.showToast('Nenhuma imagem encontrada na pasta', 'warning');
                return;
            }

            // Aplicar modo aleatÃƒÆ’Ã‚Â³rio se configurado
            if (this.slideshowConfig.random) {
            this.shuffleArray(this.slideshowImages);            }

            // Limpar cache de prÃƒÆ’Ã‚Â©-carregamento
            this.preloadedImages.clear();

            const modeText = this.slideshowConfig.random ? ' (ordem aleatÃƒÆ’Ã‚Â³ria)' : ' (ordem sequencial)';
            this.showToast(`ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ ${this.slideshowImages.length} imagens encontradas${modeText}`, 'success');
            this.startSlideshowViewer();

        } catch (error) {
            console.error('Erro ao carregar imagens:', error);
            this.showToast('Erro ao carregar imagens: ' + error.message, 'error');
        }
    }

    // PrÃƒÆ’Ã‚Â©-carregar imagem
    preloadImage(imagePath) {
        return new Promise((resolve, reject) => {
            if (this.preloadedImages.has(imagePath)) {
                resolve(this.preloadedImages.get(imagePath));
                return;
            }

            const img = new Image();
            img.onload = () => {
                this.preloadedImages.set(imagePath, img);                resolve(img);
            };
            img.onerror = () => {
                console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Erro ao prÃƒÆ’Ã‚Â©-carregar imagem:', imagePath);
                reject(new Error('Erro ao carregar imagem'));
            };
            img.src = imagePath;
        });
    }

    // PrÃƒÆ’Ã‚Â©-carregar prÃƒÆ’Ã‚Â³xima imagem se habilitado
    async preloadNextImage() {
        if (!this.slideshowConfig.preload || this.slideshowImages.length <= 1) {
            return;
        }

        // Limitar prÃƒÆ’Ã‚Â©-carregamento para apenas 1 imagem (prÃƒÆ’Ã‚Â³xima)
        if (this.preloadedImages.size >= 1) {
            return; // MÃƒÆ’Ã‚Â¡ximo 1 imagem prÃƒÆ’Ã‚Â©-carregada
        }

        const nextIndex = (this.currentSlideIndex + 1) % this.slideshowImages.length;
        const nextImagePath = this.slideshowImages[nextIndex];

        // Construir URL corretamente
        const imageUrl = `/api/files/image/${encodeURIComponent(nextImagePath.path)}`;

        try {
            await this.preloadImage(imageUrl);
        } catch (error) {
            console.warn('Erro ao prÃƒÆ’Ã‚Â©-carregar prÃƒÆ’Ã‚Â³xima imagem:', error);
        }
    }

    // Iniciar viewer do slideshow
    startSlideshowViewer() {        
        // Limpar elementos antigos se existirem
        const oldElement = document.getElementById('slideshow-image-new');
        if (oldElement) {
            oldElement.remove();        }
        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Nenhuma imagem disponÃƒÆ’Ã‚Â­vel para slideshow');
            this.showToast('Nenhuma imagem encontrada para o slideshow', 'error');
            return;
        }
        
        // Mostrar viewer
        const viewer = document.getElementById('slideshow-viewer');        
        if (viewer) {
            console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬â€œÃ‚Â¥ÃƒÂ¯Ã‚Â¸Ã‚Â Estilo atual do viewer:', {
                display: viewer.style.display,
                visibility: viewer.style.visibility,
                opacity: viewer.style.opacity,
                zIndex: viewer.style.zIndex
            });
            
            viewer.style.display = 'flex';            
            // Mostrar controles estÃƒÆ’Ã‚Â¡ticos quando o viewer for exibido
            const staticControls = document.getElementById('static-slideshow-controls');
            if (staticControls) {
                staticControls.style.display = 'block';                
                // Configurar event listeners se ainda nÃƒÆ’Ã‚Â£o foram configurados
                this.setupStaticButtons();
            }
            
            console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬â€œÃ‚Â¥ÃƒÂ¯Ã‚Â¸Ã‚Â Estilo apÃƒÆ’Ã‚Â³s exibir:', {
                display: viewer.style.display,
                visibility: viewer.style.visibility,
                opacity: viewer.style.opacity
            });
        } else {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Elemento slideshow-viewer nÃƒÆ’Ã‚Â£o encontrado no DOM');
            this.showToast('Erro: Elemento de visualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nÃƒÆ’Ã‚Â£o encontrado', 'error');
            return;
        }
        
        this.currentSlideIndex = 0;
        this.slideshowPlaying = true;
        console.debug('ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes do slideshow:', {
            currentSlideIndex: this.currentSlideIndex,
            slideshowPlaying: this.slideshowPlaying,
            totalImages: this.slideshowImages.length
        });

        // Entrar em fullscreen automaticamente
        this.enterFullscreen(this.isDedicatedScreensaverWindow || this.screensaverState.isActive);

        // Atualizar exibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e iniciar auto-play APÃƒÆ’Ã¢â‚¬Å“S a imagem ser carregada
        this.updateSlideDisplay();
    }

    // Entrar em fullscreen
    // isAutoTriggered=true quando disparado por screensaver/auto (sem gesto do usuário)
    enterFullscreen(isAutoTriggered = false) {
        const viewer = document.getElementById('slideshow-viewer');
        if (!viewer) return;

        // CSS fullscreen: funciona sem gesto do usuário e é imediato
        viewer.classList.add('fullscreen-override');
        document.body.classList.add('slideshow-active-fullscreen');

        // Quando automático ou dedicated window: maximizar via OS
        const needsMaximize = isAutoTriggered || this.isDedicatedScreensaverWindow || this.screensaverState.isActive;
        if (needsMaximize) {
            fetch('/api/tray/maximize', { method: 'POST' }).catch(() => {});
        }

        // Fullscreen nativo no documento inteiro (requer gesto; silencia erro se bloqueado)
        const target = document.documentElement;
        const requestFn = target.requestFullscreen
            || target.webkitRequestFullscreen
            || target.mozRequestFullScreen
            || target.msRequestFullscreen;
        if (requestFn) {
            requestFn.call(target).catch(() => {
                // Bloqueado sem gesto -- CSS fullscreen já cobre a tela
            });
        }
    }

    // Sair do fullscreen
    exitFullscreen() {
        // Remover CSS fullscreen override
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) viewer.classList.remove('fullscreen-override');
        document.body.classList.remove('slideshow-active-fullscreen');

        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    // Lidar com mudanÃƒÆ’Ã‚Â§as de fullscreen
    handleFullscreenChange() {        
        const isFullscreen = !!(document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement || 
                               document.msFullscreenElement);        
        const viewer = document.getElementById('slideshow-viewer');
        const viewerVisible = viewer && window.getComputedStyle(viewer).display !== 'none';
        const slideshowActive = viewerVisible && (
            this.screensaverState?.isActive || (Array.isArray(this.slideshowImages) && this.slideshowImages.length > 0)
        );
        if (!slideshowActive) {
            return;
        }

        // Garantir que os controles estÃƒÆ’Ã‚Â¡ticos permaneÃƒÆ’Ã‚Â§am visÃƒÆ’Ã‚Â­veis
        const staticControls = document.getElementById('static-slideshow-controls');
        if (staticControls) {
            staticControls.style.display = 'block';
            staticControls.style.zIndex = '999999';        }
        
        // Garantir que o viewer permaneÃƒÆ’Ã‚Â§a visÃƒÃ‚Â­vel no contexto do slideshow/screenaver
        if (viewer) {
            viewer.style.display = 'flex';        }
    }

    // Atualizar exibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do slide atual
    async updateSlideDisplay() {        
        // Verificar contexto geral antes de prosseguir
        console.debug('ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â Contexto geral:', {
            documentReady: document.readyState,
            windowLoaded: window.onload ? 'loaded' : 'not loaded',
            slideshowPlaying: this.slideshowPlaying,
            currentSlideIndex: this.currentSlideIndex,
            totalImages: this.slideshowImages?.length || 0
        });
        
        // Garantir que os controles estÃƒÆ’Ã‚Â¡ticos existam
        if (this.slideshowImages && this.slideshowImages.length > 0) {            this.createDynamicSlideshowControls();
        }
        
        let imageElement = document.getElementById('slideshow-image');
        const counterElement = document.getElementById('slideshow-counter');
        const filenameElement = document.getElementById('slideshow-filename');
        const loadingElement = document.getElementById('slideshow-loading');
        const errorElement = document.getElementById('slideshow-error');
        const imageContainer = document.querySelector('.slideshow-image-container');
        
        // Se nÃƒÆ’Ã‚Â£o encontrar o elemento slideshow-image, tentar encontrar o slideshow-image-new
        if (!imageElement) {
            imageElement = document.getElementById('slideshow-image-new');
            if (imageElement) {            }
        }

        // Verificar se o slideshow-viewer estÃƒÆ’Ã‚Â¡ visÃƒÆ’Ã‚Â­vel
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) {
            console.debug('ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¬ Estado do viewer:', {
                display: viewer.style.display,
                visibility: viewer.style.visibility,
                rect: viewer.getBoundingClientRect()
            });
        }
        
        console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â Elementos encontrados:', {
            imageElement: !!imageElement,
            counterElement: !!counterElement,
            filenameElement: !!filenameElement,
            loadingElement: !!loadingElement,
            errorElement: !!errorElement,
            imageContainer: !!imageContainer
        });
        
        if (imageContainer) {
            console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¦ Container da imagem:', {
                display: imageContainer.style.display,
                visibility: imageContainer.style.visibility,
                opacity: imageContainer.style.opacity,
                position: imageContainer.style.position,
                zIndex: imageContainer.style.zIndex
            });
            
            // FORÃƒÆ’Ã¢â‚¬Â¡AR ESTILOS NO CONTAINER para garantir que a imagem seja exibida
            imageContainer.style.display = 'flex';
            imageContainer.style.alignItems = 'center';
            imageContainer.style.justifyContent = 'center';
            imageContainer.style.width = '100vw';
            imageContainer.style.height = '100vh';
            imageContainer.style.minWidth = '800px';
            imageContainer.style.minHeight = '600px';
            imageContainer.style.position = 'relative';
            imageContainer.style.zIndex = '1';
            imageContainer.style.background = 'rgba(0, 0, 0, 0.1)';
            
            console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¦ Container apÃƒÆ’Ã‚Â³s forÃƒÆ’Ã‚Â§ar estilos:', {
                display: imageContainer.style.display,
                visibility: imageContainer.style.visibility,
                opacity: imageContainer.style.opacity,
                position: imageContainer.style.position,
                zIndex: imageContainer.style.zIndex,
                width: imageContainer.style.width,
                height: imageContainer.style.height,
                minHeight: imageContainer.style.minHeight
            });
        }

        if (!this.slideshowImages || this.slideshowImages.length === 0) {            if (loadingElement) loadingElement.style.display = 'none';
            if (errorElement) errorElement.style.display = 'block';
            if (imageElement) imageElement.style.display = 'none';
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        // Mostrar loading
        if (loadingElement) loadingElement.style.display = 'block';
        if (errorElement) errorElement.style.display = 'none';
        if (imageElement) imageElement.style.display = 'none';

        // Atualizar contador e nome do arquivo
        if (counterElement) counterElement.textContent = `${this.currentSlideIndex + 1} / ${this.slideshowImages.length}`;
        if (filenameElement) filenameElement.textContent = currentImage.name;
        
        // Atualizar caminho completo da imagem no rodapÃƒÆ’Ã‚Â©
        const pathElement = document.getElementById('slideshow-path');
        if (pathElement) {
            pathElement.textContent = currentImage.path;
        }

        // Construir URL da imagem
        const imageUrl = `/api/files/image/${encodeURIComponent(currentImage.path)}`;
        try {
            // Carregar imagem diretamente
            const img = new Image();
            
            // Timeout para evitar loading infinito
            const loadTimeout = setTimeout(() => {
                console.error('ÃƒÂ¢Ã‚ÂÃ‚Â° Timeout ao carregar imagem:', imageUrl);
                if (loadingElement) loadingElement.style.display = 'none';
                if (imageElement) imageElement.style.display = 'none';
                if (errorElement) errorElement.style.display = 'block';
            }, 10000); // 10 segundos timeout
            
            img.onload = () => {
                clearTimeout(loadTimeout);
                if (imageElement) {
                    // SOLUÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O RADICAL: Criar novo elemento se o atual nÃƒÆ’Ã‚Â£o funcionar
                    let targetElement = imageElement;
                    
                    // REMOVER imagem anterior para evitar empilhamento
                    const existingDynamicImage = document.getElementById('slideshow-image-new');
                    if (existingDynamicImage) {
                        existingDynamicImage.remove();                    }
                    
                    // Verificar se o elemento atual tem problemas
                    const currentRect = imageElement.getBoundingClientRect();
                    if (currentRect.width === 0 || currentRect.height === 0) {
                        console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Elemento atual tem dimensÃƒÆ’Ã‚Âµes zero, criando novo elemento...');
                        
                        // Criar novo elemento de imagem
                        const newImageElement = document.createElement('img');
                        newImageElement.id = 'slideshow-image-new';
                        newImageElement.className = 'slideshow-image-new';
                        newImageElement.alt = currentImage.name;
                        
                        // Aplicar estilos diretamente no elemento (compatÃƒÆ’Ã‚Â­vel com Raspberry Pi)
                        newImageElement.style.cssText = `
                            display: block !important;
                            visibility: visible !important;
                            opacity: 1 !important;
                            position: absolute !important;
                            top: 50% !important;
                            left: 50% !important;
                            transform: translate(-50%, -50%) !important;
                            z-index: 1 !important;
                            width: 100vw !important;
                            height: 100vh !important;
                            min-width: 100vw !important;
                            min-height: 100vh !important;
                            max-width: 100vw !important;
                            max-height: 100vh !important;
                            object-fit: contain !important;
                            border: none !important;
                            background: transparent !important;
                            box-shadow: none !important;
                            border-radius: 0 !important;
                            pointer-events: none !important;
                        `;
                        
                        // Aplicar estilos individualmente para mÃƒÆ’Ã‚Â¡xima compatibilidade
                        newImageElement.style.display = 'block';
                        newImageElement.style.visibility = 'visible';
                        newImageElement.style.opacity = '1';
                        newImageElement.style.position = 'absolute';
                        newImageElement.style.top = '50%';
                        newImageElement.style.left = '50%';
                        newImageElement.style.transform = 'translate(-50%, -50%)';
                        newImageElement.style.zIndex = '1';
                        newImageElement.style.width = '100vw';
                        newImageElement.style.height = '100vh';
                        newImageElement.style.minWidth = '100vw';
                        newImageElement.style.minHeight = '100vh';
                        newImageElement.style.maxWidth = '100vw';
                        newImageElement.style.maxHeight = '100vh';
                        newImageElement.style.objectFit = 'contain';
                        newImageElement.style.border = 'none';
                        newImageElement.style.background = 'transparent';
                        newImageElement.style.boxShadow = 'none';
                        newImageElement.style.borderRadius = '0';
                        
                        // Adicionar DENTRO do slideshow-viewer para manter contexto
                        const slideshowViewer = document.getElementById('slideshow-viewer');
                        if (slideshowViewer) {
                            slideshowViewer.appendChild(newImageElement);                            
                            // Esconder a imagem original para evitar sobreposiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
                            const originalImage = document.getElementById('slideshow-image');
                            if (originalImage) {
                                originalImage.style.display = 'none';                            }
                        } else {
                            document.body.appendChild(newImageElement);                        }
                        targetElement = newImageElement;
                        
                        // Garantir que a imagem esteja dentro do viewer mas abaixo dos controles estÃƒÆ’Ã‚Â¡ticos
                        newImageElement.style.zIndex = '1';
                        newImageElement.style.pointerEvents = 'none';
                        
                        // Adicionar fundo preto atrÃƒÆ’Ã‚Â¡s de tudo
                        document.body.style.background = 'black';
                        document.body.style.overflow = 'hidden';
                        document.body.style.cursor = 'default';
                        
                        // MANTER o slideshow-viewer visÃƒÆ’Ã‚Â­vel para que os botÃƒÆ’Ã‚Âµes estÃƒÆ’Ã‚Â¡ticos sejam exibidos
                        if (slideshowViewer) {
                            // NÃƒÆ’Ã†â€™O ESCONDER! Os botÃƒÆ’Ã‚Âµes estÃƒÆ’Ã‚Â¡ticos estÃƒÆ’Ã‚Â£o dentro dele                        }
                        
                        // Criar controles de navegaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para a imagem dinÃƒÆ’Ã‚Â¢mica
                        // Usar controles estÃƒÆ’Ã‚Â¡ticos
                        this.createDynamicSlideshowControls();                        console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â Debug Raspberry Pi - Elemento criado:', {
                            id: newImageElement.id,
                            tagName: newImageElement.tagName,
                            parentNode: newImageElement.parentNode.tagName,
                            position: newImageElement.getBoundingClientRect(),
                            computedStyle: window.getComputedStyle(newImageElement)
                        });
                    }

                    // Configurar o elemento
                    targetElement.src = imageUrl;
                    targetElement.alt = currentImage.name;

                    // Se for o elemento original, aplicar estilos bÃƒÆ’Ã‚Â¡sicos
                    if (targetElement === imageElement) {
                        targetElement.style.setProperty('display', 'block', 'important');
                        targetElement.style.setProperty('visibility', 'visible', 'important');
                        targetElement.style.setProperty('opacity', '1', 'important');
                        targetElement.style.setProperty('width', '90vw', 'important');
                        targetElement.style.setProperty('height', '90vh', 'important');
                        targetElement.style.setProperty('object-fit', 'contain', 'important');
                        targetElement.style.setProperty('border', '3px solid #4CAF50', 'important');
                    }                    
                    // ForÃƒÆ’Ã‚Â§ar reflow para garantir que os estilos sejam aplicados
                    targetElement.offsetHeight;
                    targetElement.offsetWidth;

                    // ForÃƒÆ’Ã‚Â§ar reflow mÃƒÆ’Ã‚Âºltiplas vezes
                    targetElement.offsetHeight;
                    targetElement.offsetWidth;
                    targetElement.getBoundingClientRect();
                    
                    // VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o final das dimensÃƒÆ’Ã‚Âµes
                    setTimeout(() => {
                        const finalRect = targetElement.getBoundingClientRect();
                        console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o final das dimensÃƒÆ’Ã‚Âµes:', {
                            width: finalRect.width,
                            height: finalRect.height,
                            visible: finalRect.width > 0 && finalRect.height > 0
                        });
                        
                        // Debug especÃƒÆ’Ã‚Â­fico para Raspberry Pi
                        console.debug('ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬Å“ Debug Raspberry Pi - Estado final:', {
                            userAgent: navigator.userAgent,
                            platform: navigator.platform,
                            elementId: targetElement.id,
                            elementTag: targetElement.tagName,
                            elementSrc: targetElement.src,
                            elementPosition: finalRect,
                            elementStyles: {
                                display: targetElement.style.display,
                                position: targetElement.style.position,
                                top: targetElement.style.top,
                                left: targetElement.style.left,
                                transform: targetElement.style.transform,
                                zIndex: targetElement.style.zIndex,
                                width: targetElement.style.width,
                                height: targetElement.style.height,
                                border: targetElement.style.border
                            },
                            computedStyles: window.getComputedStyle(targetElement),
                            parentElement: targetElement.parentElement?.tagName,
                            isInBody: targetElement.parentElement === document.body
                        });
                        
                        if (finalRect.width === 0 || finalRect.height === 0) {
                            console.error('ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â¨ FALHA CRÃƒÆ’Ã‚ÂTICA: Imagem ainda com dimensÃƒÆ’Ã‚Âµes zero apÃƒÆ’Ã‚Â³s todas as correÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes!');
                            console.error('ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬Å“ Raspberry Pi - Tentando soluÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de emergÃƒÆ’Ã‚Âªncia...');
                            
                            // SoluÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de emergÃƒÆ’Ã‚Âªncia especÃƒÆ’Ã‚Â­fica para Raspberry Pi
                            targetElement.style.cssText = `
                                display: block !important;
                                visibility: visible !important;
                                opacity: 1 !important;
                                position: absolute !important;
                                top: 100px !important;
                                left: 100px !important;
                                z-index: 99999 !important;
                                width: 800px !important;
                                height: 600px !important;
                                min-width: 800px !important;
                                min-height: 600px !important;
                                max-width: 800px !important;
                                max-height: 600px !important;
                                object-fit: contain !important;
                                border: 10px solid red !important;
                                background: rgba(255, 0, 0, 0.3) !important;
                                box-shadow: 0 0 50px rgba(255, 0, 0, 1) !important;
                            `;
                            
                            // ForÃƒÆ’Ã‚Â§ar reflow
                            targetElement.offsetHeight;
                            targetElement.offsetWidth;                        } else {                        }
                    }, 100);

                    // Verificar contexto do documento
                    console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾ Contexto do documento:', {
                        readyState: document.readyState,
                        hidden: document.hidden,
                        visibilityState: document.visibilityState
                    });

                    // Verificar se estÃƒÆ’Ã‚Â¡ no viewport correto
                    const rect = targetElement.getBoundingClientRect();
                    const viewport = {
                        width: window.innerWidth,
                        height: window.innerHeight,
                        scrollX: window.scrollX,
                        scrollY: window.scrollY
                    };

                    console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬â€œÃ‚Â¼ÃƒÂ¯Ã‚Â¸Ã‚Â PosiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o da imagem:', {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                        visible: rect.width > 0 && rect.height > 0,
                        inViewport: rect.top >= 0 && rect.left >= 0 &&
                                   rect.bottom <= viewport.height &&
                                   rect.right <= viewport.width
                    });
                    // ForÃƒÆ’Ã‚Â§ar renderizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o adicional se ainda nÃƒÆ’Ã‚Â£o estiver visÃƒÆ’Ã‚Â­vel
                    if (rect.width === 0 || rect.height === 0) {
                        console.error('ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â¨ CRÃƒÆ’Ã‚ÂTICO: Imagem ainda com dimensÃƒÆ’Ã‚Âµes zero apÃƒÆ’Ã‚Â³s todas as tentativas!');

                        // ÃƒÆ’Ã…Â¡ltimo recurso: forÃƒÆ’Ã‚Â§ar com setTimeout
                        setTimeout(() => {                            targetElement.style.setProperty('width', '400px', 'important');
                            targetElement.style.setProperty('height', '400px', 'important');
                            targetElement.style.setProperty('position', 'absolute', 'important');
                            targetElement.style.setProperty('top', '50%', 'important');
                            targetElement.style.setProperty('left', '50%', 'important');
                            targetElement.style.setProperty('transform', 'translate(-50%, -50%)', 'important');

                            const finalRect = targetElement.getBoundingClientRect();
                            console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬â€œÃ‚Â¼ÃƒÂ¯Ã‚Â¸Ã‚Â PosiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o FINAL:', {
                                top: finalRect.top,
                                left: finalRect.left,
                                width: finalRect.width,
                                height: finalRect.height,
                                visible: finalRect.width > 0 && finalRect.height > 0
                            });
                        }, 100);
                    }
                } else {
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Elemento slideshow-image nÃƒÆ’Ã‚Â£o encontrado!');
                    // Tentar encontrar o elemento novamente
                    const imageElement = document.getElementById('slideshow-image') || document.querySelector('.slideshow-image');
                    if (imageElement) {                imageElement.src = imageUrl;
            imageElement.style.display = 'block';
                        imageElement.style.visibility = 'visible';
                        imageElement.style.opacity = '1';
                    } else {
                        console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Elemento slideshow-image ainda nÃƒÆ’Ã‚Â£o encontrado apÃƒÆ’Ã‚Â³s segunda tentativa');
                    }
                }

                if (loadingElement) loadingElement.style.display = 'none';
                if (errorElement) errorElement.style.display = 'none';
                
                // Iniciar auto-play apenas na primeira imagem carregada
                if (this.currentSlideIndex === 0 && this.slideshowPlaying) {                    this.startAutoPlay();
                }
                
                // PrÃƒÆ’Ã‚Â©-carregar prÃƒÆ’Ã‚Â³xima imagem
                this.preloadNextImage();
            };
            
            img.onerror = (error) => {
                clearTimeout(loadTimeout);
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao carregar imagem:', error);
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ URL que falhou:', imageUrl);
                if (loadingElement) loadingElement.style.display = 'none';
                if (imageElement) imageElement.style.display = 'none';
                if (errorElement) errorElement.style.display = 'block';
            };            img.src = imageUrl;
            
        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao carregar imagem:', error);
            if (loadingElement) loadingElement.style.display = 'none';
            if (imageElement) imageElement.style.display = 'none';
            if (errorElement) errorElement.style.display = 'block';
        }
    }

    // PrÃƒÆ’Ã‚Â³ximo slide
    nextSlide() {
        if (this.slideshowImages.length === 0) return;        console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  Estado atual:', {
            currentIndex: this.currentSlideIndex,
            totalImages: this.slideshowImages.length,
            nextIndex: (this.currentSlideIndex + 1) % this.slideshowImages.length
        });

        this.currentSlideIndex = (this.currentSlideIndex + 1) % this.slideshowImages.length;
        this.updateSlideDisplay();
        this.updateDynamicCounter();
    }

    // Slide anterior
    previousSlide() {
        if (this.slideshowImages.length === 0) return;        console.debug('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  Estado atual:', {
            currentIndex: this.currentSlideIndex,
            totalImages: this.slideshowImages.length,
            prevIndex: this.currentSlideIndex === 0 ? this.slideshowImages.length - 1 : this.currentSlideIndex - 1
        });

        this.currentSlideIndex = this.currentSlideIndex === 0 ?
            this.slideshowImages.length - 1 :
            this.currentSlideIndex - 1;
        this.updateSlideDisplay();
        this.updateDynamicCounter();
    }

    // Alternar play/pause
    togglePlayPause() {
        this.slideshowPlaying = !this.slideshowPlaying;

        const playPauseBtn = document.querySelector('.slideshow-play-pause-btn .material-icons');
        if (this.slideshowPlaying) {
            playPauseBtn.textContent = 'pause';
            this.startAutoPlay();
        } else {
            playPauseBtn.textContent = 'play_arrow';
            this.stopAutoPlay();
        }
    }

    // Iniciar reproduÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o automÃƒÆ’Ã‚Â¡tica
    startAutoPlay() {
        this.stopAutoPlay(); // Parar qualquer intervalo existente

        if (this.slideshowPlaying && this.slideshowImages.length > 1) {
            const intervalMs = this.slideshowConfig.interval * 1000;
            this.autoPlayInterval = setInterval(() => {                this.nextSlide();
            }, intervalMs);        } else {
            console.debug('ÃƒÂ¢Ã‚ÂÃ‚Â° Auto-play nÃƒÆ’Ã‚Â£o iniciado:', {
                slideshowPlaying: this.slideshowPlaying,
                imageCount: this.slideshowImages.length
            });
        }
    }

    // Parar reproduÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o automÃƒÆ’Ã‚Â¡tica
    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }

    // Criar controles de navegaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para slideshow dinÃƒÆ’Ã‚Â¢mico
    createDynamicSlideshowControls() {        
        // Remover controles dinÃƒÆ’Ã‚Â¢micos antigos se existirem
        const oldControls = document.getElementById('dynamic-slideshow-controls');
        if (oldControls) {
            oldControls.remove();
        }
        
        // Mostrar controles estÃƒÆ’Ã‚Â¡ticos
        const staticControls = document.getElementById('static-slideshow-controls');
        if (staticControls) {
            staticControls.style.display = 'block';        } else {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Controles estÃƒÆ’Ã‚Â¡ticos nÃƒÆ’Ã‚Â£o encontrados');
        }
        
        // Configurar event listeners para botÃƒÆ’Ã‚Âµes estÃƒÆ’Ã‚Â¡ticos
        this.setupStaticButtons();
        
        this.dynamicControlsCreated = true;
        
        // Atualizar contador
        this.updateStaticCounter();
    }
    
    setupStaticButtons() {        
        // BotÃƒÆ’Ã‚Â£o anterior
        const prevBtn = document.getElementById('static-prev-btn');        if (prevBtn && !prevBtn.hasAttribute('data-listener-added')) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();                this.previousSlide();
            });
            prevBtn.setAttribute('data-listener-added', 'true');        }
        
        // BotÃƒÆ’Ã‚Â£o prÃƒÆ’Ã‚Â³ximo
        const nextBtn = document.getElementById('static-next-btn');        if (nextBtn && !nextBtn.hasAttribute('data-listener-added')) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();                this.nextSlide();
            });
            nextBtn.setAttribute('data-listener-added', 'true');        }
        
        // BotÃƒÆ’Ã‚Â£o fechar
        const closeBtn = document.getElementById('static-close-btn');
        if (closeBtn && !closeBtn.hasAttribute('data-listener-added')) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();                this.closeSlideshowViewer();
            });
            closeBtn.setAttribute('data-listener-added', 'true');
        }
        
        // BotÃƒÆ’Ã‚Â£o apagar
        const deleteBtn = document.getElementById('static-delete-btn');        if (deleteBtn) {        }
        
        if (deleteBtn && !deleteBtn.hasAttribute('data-listener-added')) {            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();                
                // Usar window.deParaUI para garantir contexto correto
                if (window.deParaUI && typeof window.deParaUI.deleteCurrentImage === 'function') {                    window.deParaUI.deleteCurrentImage();
                } else {
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ DeParaUI nÃƒÆ’Ã‚Â£o disponÃƒÆ’Ã‚Â­vel ou mÃƒÆ’Ã‚Â©todo nÃƒÆ’Ã‚Â£o encontrado');
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ window.deParaUI:', window.deParaUI);
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ typeof deleteCurrentImage:', typeof window.deParaUI?.deleteCurrentImage);
                }
            });
            deleteBtn.setAttribute('data-listener-added', 'true');        }
        
        // BotÃƒÆ’Ã‚Â£o ocultar
        const hideBtn = document.getElementById('static-hide-btn');        if (hideBtn) {        }
        
        if (hideBtn && !hideBtn.hasAttribute('data-listener-added')) {            hideBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();                
                // Usar window.deParaUI para garantir contexto correto
                if (window.deParaUI && typeof window.deParaUI.hideCurrentImage === 'function') {                    window.deParaUI.hideCurrentImage();
                } else {
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ DeParaUI nÃƒÆ’Ã‚Â£o disponÃƒÆ’Ã‚Â­vel ou mÃƒÆ’Ã‚Â©todo nÃƒÆ’Ã‚Â£o encontrado');
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ window.deParaUI:', window.deParaUI);
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ typeof hideCurrentImage:', typeof window.deParaUI?.hideCurrentImage);
                }
            });
            hideBtn.setAttribute('data-listener-added', 'true');        }
        
        
        
        // BotÃƒÆ’Ã‚Â£o favoritar
        const favoriteBtn = document.getElementById('static-favorite-btn');        if (favoriteBtn && !favoriteBtn.hasAttribute('data-listener-added')) {
            favoriteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();                this.favoriteCurrentImage();
            });
            favoriteBtn.setAttribute('data-listener-added', 'true');        }

        // BotÃƒÆ’Ã‚Â£o ajustar
        const adjustBtn = document.getElementById('static-adjust-btn');        if (adjustBtn && !adjustBtn.hasAttribute('data-listener-added')) {
            adjustBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();                this.adjustCurrentImage();
            });
            adjustBtn.setAttribute('data-listener-added', 'true');        }    }
    
    updateStaticCounter() {
        const counter = document.getElementById('static-counter');
        const filename = document.getElementById('static-filename');
        
        if (counter && this.slideshowImages) {
            counter.textContent = `${this.currentSlideIndex + 1} / ${this.slideshowImages.length}`;
        }
        
        if (filename && this.slideshowImages && this.slideshowImages[this.currentSlideIndex]) {
            const currentImage = this.slideshowImages[this.currentSlideIndex];
            filename.textContent = currentImage.name || 'Arquivo sem nome';
        }
    }
    
    // Atualizar contador dinÃƒÆ’Ã‚Â¢mico
    updateDynamicCounter() {
        // Usar botÃƒÆ’Ã‚Âµes estÃƒÆ’Ã‚Â¡ticos se disponÃƒÆ’Ã‚Â­veis
        this.updateStaticCounter();
        
        // Fallback para botÃƒÆ’Ã‚Âµes dinÃƒÆ’Ã‚Â¢micos se existirem
        const counter = document.getElementById('dynamic-slideshow-counter');
        const filename = document.getElementById('dynamic-slideshow-filename');
        
        if (counter && this.slideshowImages) {
            counter.textContent = `${this.currentSlideIndex + 1} / ${this.slideshowImages.length}`;
        }
        
        if (filename && this.slideshowImages && this.slideshowImages[this.currentSlideIndex]) {
            const currentImage = this.slideshowImages[this.currentSlideIndex];
            filename.textContent = currentImage.name || 'Arquivo sem nome';
        }
    }

    // Apagar imagem atual (mover para pasta de excluÃƒÆ’Ã‚Â­das)
    async deleteCurrentImage() {        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {            this.showToast('Nenhuma imagem para apagar', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {            this.showToast('Imagem atual nÃƒÆ’Ã‚Â£o encontrada', 'error');
            return;
        }

        if (!this.slideshowConfig.deletedFolder) {            this.showToast('Configure a pasta de fotos excluÃƒÆ’Ã‚Â­das nas configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes', 'error');
            return;
        }

        try {
            // Verificar se pasta de destino existe, se nÃƒÆ’Ã‚Â£o, criar            
            // Pasta de destino jÃƒÆ’Ã‚Â¡ configurada - prosseguir diretamente
            // Debug: Log dos dados sendo enviados
            const fileName = currentImage.name || currentImage.path.split('/').pop();
            const targetPath = `${this.slideshowConfig.deletedFolder}/${fileName}`;
            
            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath
            };            
            // Chamar API para mover arquivo            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });            
            // Capturar detalhes do erro se houver
            if (!response.ok) {
                let errorDetails = {};
                try {
                    errorDetails = await response.json();
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Detalhes do erro da API:', errorDetails);
                } catch (e) {
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao parsear resposta de erro:', e);
                    try {
                        const errorText = await response.text();
                        console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Resposta de erro (texto):', errorText);
                    } catch (textError) {
                        console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao ler resposta como texto:', textError);
                    }
                }
            }
            
            if (response.ok) {
                const result = await response.json();                
                // Remover imagem da lista atual
                this.slideshowImages.splice(this.currentSlideIndex, 1);
                
                // Ajustar ÃƒÆ’Ã‚Â­ndice se necessÃƒÆ’Ã‚Â¡rio
                if (this.currentSlideIndex >= this.slideshowImages.length) {
                    this.currentSlideIndex = Math.max(0, this.slideshowImages.length - 1);
                }
                
                // Atualizar exibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
                if (this.slideshowImages.length > 0) {
                    this.updateSlideDisplay();
                    this.updateDynamicCounter();
                } else {
                    this.showToast('Todas as imagens foram apagadas', 'info');
                    this.closeSlideshowViewer();
                }
                
                this.showToast('Imagem apagada com sucesso', 'success');
            } else {
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao apagar imagem - status:', response.status);
                this.showToast(`Erro ao apagar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao apagar imagem:', error);
            this.showToast('Erro ao apagar imagem', 'error');
        }
    }

    // Ocultar imagem atual (mover para pasta de ocultas)
    async hideCurrentImage() {        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {            this.showToast('Nenhuma imagem para ocultar', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {            this.showToast('Imagem atual nÃƒÆ’Ã‚Â£o encontrada', 'error');
            return;
        }

        if (!this.slideshowConfig.hiddenFolder || this.slideshowConfig.hiddenFolder.trim() === '') {            this.showToast('Configure a pasta de fotos ocultas nas configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes', 'error');
            return;
        }
        try {
            // Verificar se pasta de destino existe, se nÃƒÆ’Ã‚Â£o, criar            
            // Pasta de destino jÃƒÆ’Ã‚Â¡ configurada - prosseguir diretamente
            // Debug: Log dos dados sendo enviados
            const fileName = currentImage.name || currentImage.path.split('/').pop();
            const targetPath = `${this.slideshowConfig.hiddenFolder}/${fileName}`;
            
            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath
            };            
            // Chamar API para mover arquivo            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });            
            // Capturar detalhes do erro se houver
            if (!response.ok) {
                let errorDetails = {};
                try {
                    errorDetails = await response.json();
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Detalhes do erro da API:', errorDetails);
                } catch (e) {
                    console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao parsear resposta de erro:', e);
                    try {
                        const errorText = await response.text();
                        console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Resposta de erro (texto):', errorText);
                    } catch (textError) {
                        console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao ler resposta como texto:', textError);
                    }
                }
            }
            
            if (response.ok) {
                const result = await response.json();                
                // Remover imagem da lista atual
                this.slideshowImages.splice(this.currentSlideIndex, 1);
                
                // Ajustar ÃƒÆ’Ã‚Â­ndice se necessÃƒÆ’Ã‚Â¡rio
                if (this.currentSlideIndex >= this.slideshowImages.length) {
                    this.currentSlideIndex = Math.max(0, this.slideshowImages.length - 1);
                }
                
                // Atualizar exibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
                if (this.slideshowImages.length > 0) {
                    this.updateSlideDisplay();
                    this.updateDynamicCounter();
                } else {
                    this.showToast('Todas as imagens foram ocultadas', 'info');
                    this.closeSlideshowViewer();
                }
                
                this.showToast('Imagem ocultada com sucesso', 'success');
            } else {
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao ocultar imagem - status:', response.status);
                this.showToast(`Erro ao ocultar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao ocultar imagem:', error);
            this.showToast('Erro ao ocultar imagem', 'error');
        }
    }

    // Favoritar imagem atual (mover para subpasta dentro da pasta atual)
    async favoriteCurrentImage() {        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {            this.showToast('Nenhuma imagem para favoritar', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {            this.showToast('Imagem atual nÃƒÆ’Ã‚Â£o encontrada', 'error');
            return;
        }

        try {
            // Extrair diretÃƒÆ’Ã‚Â³rio pai da imagem atual
            const pathParts = currentImage.path.split('/');
            const fileName = pathParts.pop(); // Nome do arquivo
            const currentDir = pathParts.join('/'); // DiretÃƒÆ’Ã‚Â³rio atual da imagem
            const parentFolderName = pathParts[pathParts.length - 1] || 'Fotos';
            // Criar subdiretÃƒÆ’Ã‚Â³rio "Favoritas + Nome da pasta pai" DENTRO da pasta atual
            const favoritesSubDir = `Favoritas ${parentFolderName}`;
            const targetDir = `${currentDir}/${favoritesSubDir}`;
            const targetPath = `${targetDir}/${fileName}`;
            
            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath,
                createTargetDir: true // Flag para criar diretÃƒÆ’Ã‚Â³rio se nÃƒÆ’Ã‚Â£o existir
            };            
            // Chamar API para mover arquivo            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });            
            if (response.ok) {
                const result = await response.json();                
                // Remover imagem da lista atual
                this.slideshowImages.splice(this.currentSlideIndex, 1);
                
                // Ajustar ÃƒÆ’Ã‚Â­ndice se necessÃƒÆ’Ã‚Â¡rio
                if (this.currentSlideIndex >= this.slideshowImages.length) {
                    this.currentSlideIndex = Math.max(0, this.slideshowImages.length - 1);
                }
                
                // Atualizar exibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
                if (this.slideshowImages.length > 0) {
                    this.updateSlideDisplay();
                    this.updateDynamicCounter();
                } else {
                    this.showToast('Todas as imagens foram favoritadas', 'info');
                    this.closeSlideshowViewer();
                }
                
                this.showToast(`Imagem favoritada! Movida para: ${favoritesSubDir}`, 'success');
            } else {
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao favoritar imagem - status:', response.status);
                this.showToast(`Erro ao favoritar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao favoritar imagem:', error);
            this.showToast('Erro ao favoritar imagem', 'error');
        }
    }

    // Ajustar imagem atual (mover para pasta configurada)
    async adjustCurrentImage() {        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {            this.showToast('Nenhuma imagem para ajustar', 'error');
            return;
        }

        if (!this.slideshowConfig.adjustableFolder || this.slideshowConfig.adjustableFolder.trim() === '') {            this.showToast('Configure a pasta de fotos para ajustar nas configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes do slideshow', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {            this.showToast('Imagem atual nÃƒÆ’Ã‚Â£o encontrada', 'error');
            return;
        }

        try {
            // Extrair nome do arquivo
            const pathParts = currentImage.path.split('/');
            const fileName = pathParts.pop();
            
            // Usar pasta configurada
            const targetPath = `${this.slideshowConfig.adjustableFolder}/${fileName}`;
            
            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath,
                createTargetDir: true // Flag para criar diretÃƒÆ’Ã‚Â³rio se nÃƒÆ’Ã‚Â£o existir
            };            
            // Chamar API para mover arquivo            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });            
            if (response.ok) {
                const result = await response.json();                
                // Remover imagem da lista atual
                this.slideshowImages.splice(this.currentSlideIndex, 1);
                
                // Ajustar ÃƒÆ’Ã‚Â­ndice se necessÃƒÆ’Ã‚Â¡rio
                if (this.currentSlideIndex >= this.slideshowImages.length) {
                    this.currentSlideIndex = Math.max(0, this.slideshowImages.length - 1);
                }
                
                // Atualizar exibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
                if (this.slideshowImages.length > 0) {
                    this.updateSlideDisplay();
                    this.updateDynamicCounter();
                } else {
                    this.showToast('Todas as imagens foram ajustadas', 'info');
                    this.closeSlideshowViewer();
                }
                
                this.showToast(`Imagem ajustada! Movida para: ${this.slideshowConfig.adjustableFolder}`, 'success');
            } else {
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao ajustar imagem - status:', response.status);
                this.showToast(`Erro ao ajustar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao ajustar imagem:', error);
            this.showToast('Erro ao ajustar imagem', 'error');
        }
    }

    // Fechar viewer do slideshow
    closeSlideshowViewer() {
        this.stopAutoPlay();
        
        // Sair do fullscreen antes de fechar o viewer        this.exitFullscreen();
        
        // Aguardar um pouco para garantir que a saÃƒÆ’Ã‚Â­da do fullscreen seja processada
        setTimeout(() => {
            // Verificar se ainda estÃƒÆ’Ã‚Â¡ em fullscreen e forÃƒÆ’Ã‚Â§ar saÃƒÆ’Ã‚Â­da se necessÃƒÆ’Ã‚Â¡rio
            const isStillFullscreen = !!(document.fullscreenElement || 
                                       document.webkitFullscreenElement || 
                                       document.mozFullScreenElement || 
                                       document.msFullscreenElement);
            
            if (isStillFullscreen) {                this.exitFullscreen();
            }
        }, 100);
        
        // Limpeza de proteÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de ÃƒÆ’Ã‚Â­cones (sem setInterval)        
        // Resetar flag de controles criados
        this.dynamicControlsCreated = false;
        
        // Limpar elementos criados dinamicamente
        const dynamicElement = document.getElementById('slideshow-image-new');
        if (dynamicElement) {
            dynamicElement.remove();        }
        
        // Limpar controles dinÃƒÆ’Ã‚Â¢micos antigos (se existirem)
        const dynamicControls = document.getElementById('dynamic-slideshow-controls');
        if (dynamicControls) {
            dynamicControls.remove();        }
        
        // Esconder controles estÃƒÆ’Ã‚Â¡ticos
        const staticControls = document.getElementById('static-slideshow-controls');
        if (staticControls) {
            staticControls.style.display = 'none';        }

        // Remover botÃƒÆ’Ã‚Âµes de organizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o dinÃƒÆ’Ã‚Â¢micos
        const deleteBtn = document.getElementById('dynamic-slideshow-delete');
        if (deleteBtn) {
            deleteBtn.remove();
        }
        const hideBtn = document.getElementById('dynamic-slideshow-hide');
        if (hideBtn) {
            hideBtn.remove();
        }
        
        // Restaurar fundo original do body
        document.body.style.background = '';
        document.body.style.overflow = '';
        document.body.style.cursor = '';
        
        // Esconder o modal do slideshow
        const slideshowViewer = document.getElementById('slideshow-viewer');
        if (slideshowViewer) {
            slideshowViewer.style.display = 'none';        }
        
        // Limpar dados do slideshow
        this.slideshowImages = [];
        this.currentSlideIndex = 0;
        this.slideshowPlaying = false;    }


    // Manipular eventos de teclado no slideshow
    handleSlideshowKeydown(event) {
        const key = (event.key || '').toLowerCase();
        switch (key) {
            case 'ArrowLeft':
            case 'arrowleft':
                event.preventDefault();
                this.previousSlide();
                break;
            case 'ArrowRight':
            case 'arrowright':
                event.preventDefault();
                this.nextSlide();
                break;
            case ' ':
            case 'spacebar':
                event.preventDefault();
                this.togglePlayPause();
                break;
            case 'd':
                event.preventDefault();
                this.deleteCurrentImage();
                break;
            case 'o':
                event.preventDefault();
                this.hideCurrentImage();
                break;
            case 'a':
                event.preventDefault();
                this.adjustCurrentImage();
                break;
            case 'f':
                event.preventDefault();
                if (typeof this.favoriteCurrentImage === 'function') {
                    this.favoriteCurrentImage();
                }
                break;
            case 'Escape':
            case 'escape':
                event.preventDefault();
                if (this.screensaverState && this.screensaverState.isActive) {
                    this.deactivateScreensaver();
                } else {
                    this.closeSlideshowViewer();
                }
                break;
        }
    }

    // Salvar pasta (mÃƒÆ’Ã‚Â©todo auxiliar)
    async saveFolder(folder) {
        try {
            const response = await fetch('/api/files/folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(folder)
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP ${response.status}`);
            }

            const result = await response.json();            return result;

        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao salvar pasta:', error);
            throw error;
        }
    }

    // Salvar template (mÃƒÆ’Ã‚Â©todo auxiliar)
    async saveTemplate(template) {
        try {
            const response = await fetch('/api/files/templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(template)
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP ${response.status}`);
            }

            const result = await response.json();            return result;

        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao salvar template:', error);
            throw error;
        }
    }

    // Sistema de Workflows
    openWorkflowConfig() {
        document.getElementById('workflow-modal').style.display = 'flex';
        this.currentWorkflowStep = 1;
        this.updateWorkflowStep();
        document.getElementById('workflow-name').focus();
    }

    closeWorkflowModal() {
        document.getElementById('workflow-modal').style.display = 'none';
        this.resetWorkflowModal();
    }

    resetWorkflowModal() {
        document.getElementById('workflow-name').value = '';
        document.getElementById('workflow-description').value = '';
        document.getElementById('source-folder').value = '';
        document.getElementById('target-folder').value = '';
        document.getElementById('file-action').value = 'copy';
        document.getElementById('execution-frequency').value = 'realtime';
        document.getElementById('cron-expression').value = '';
        document.getElementById('filter-type').value = 'all';
        document.getElementById('allowed-extensions').value = '';
        document.getElementById('min-size').value = '';
        document.getElementById('min-age').value = '';
        document.getElementById('transform-uppercase').checked = false;
        document.getElementById('transform-lowercase').checked = false;
        document.getElementById('transform-trim').checked = true;
        document.getElementById('transform-validate').checked = true;
        document.getElementById('auto-cleanup').checked = false;
        document.getElementById('cleanup-frequency').value = 'weekly';
        document.getElementById('max-file-age').value = '30';
        document.getElementById('trash-folder').value = 'system';
        document.getElementById('custom-trash-path').value = '';
        document.getElementById('create-backup').checked = true;
        document.getElementById('generate-logs').checked = true;
        document.getElementById('notify-completion').checked = false;
        document.getElementById('workflow-status').value = 'active';
        
        this.currentWorkflowStep = 1;
        this.updateWorkflowStep();
        this.hideAllConditionalFields();
    }

    hideAllConditionalFields() {
        document.getElementById('cron-group').style.display = 'none';
        document.getElementById('extension-filter').style.display = 'none';
        document.getElementById('size-filter').style.display = 'none';
        document.getElementById('age-filter').style.display = 'none';
        document.getElementById('cleanup-options').style.display = 'none';
        document.getElementById('custom-trash').style.display = 'none';
    }

    // Sistema de Wizard para Workflows
    nextWorkflowStep() {
        if (this.currentWorkflowStep < 6) {
            if (this.validateCurrentWorkflowStep()) {
                this.currentWorkflowStep++;
                this.updateWorkflowStep();
            }
        }
    }

    previousWorkflowStep() {
        if (this.currentWorkflowStep > 1) {
            this.currentWorkflowStep--;
            this.updateWorkflowStep();
        }
    }

    updateWorkflowStep() {
        document.querySelectorAll('.wizard-step').forEach(step => {
            step.classList.remove('active');
        });

        document.querySelector(`[data-step="${this.currentWorkflowStep}"]`).classList.add('active');

        document.querySelectorAll('.step-dot').forEach((dot, index) => {
            dot.classList.remove('active', 'completed');
            if (index + 1 === this.currentWorkflowStep) {
                dot.classList.add('active');
            } else if (index + 1 < this.currentWorkflowStep) {
                dot.classList.add('completed');
            }
        });

        const prevBtn = document.getElementById('prev-step');
        const nextBtn = document.getElementById('next-step');
        const saveBtn = document.getElementById('save-step');

        prevBtn.style.display = this.currentWorkflowStep > 1 ? 'flex' : 'none';
        nextBtn.style.display = this.currentWorkflowStep < 6 ? 'flex' : 'none';
        saveBtn.style.display = this.currentWorkflowStep === 6 ? 'flex' : 'none';

        if (this.currentWorkflowStep === 6) {
            this.updateWorkflowSummary();
        }

        if (this.currentWorkflowStep === 2) {
            this.populateFolderSelects();
        }
    }

    validateCurrentWorkflowStep() {
        let isValid = true;
        const currentStep = document.querySelector(`[data-step="${this.currentWorkflowStep}"]`);

        const requiredFields = currentStep.querySelectorAll('input[required], select[required]');
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                this.showFieldError(field, 'Este campo ÃƒÆ’Ã‚Â© obrigatÃƒÆ’Ã‚Â³rio');
                isValid = false;
            } else {
                this.clearFieldError(field);
            }
        });

        switch (this.currentWorkflowStep) {
            case 1:
                isValid = this.validateWorkflowBasicInfo() && isValid;
                break;
            case 2:
                isValid = this.validateWorkflowFolders() && isValid;
                break;
            case 3:
                isValid = this.validateWorkflowSchedule() && isValid;
                break;
            case 4:
                isValid = this.validateWorkflowFilters() && isValid;
                break;
            case 5:
                isValid = this.validateWorkflowCleanup() && isValid;
                break;
        }

        return isValid;
    }

    validateWorkflowBasicInfo() {
        let isValid = true;
        const name = document.getElementById('workflow-name');

        if (name.value.trim().length < 5) {
            this.showFieldError(name, 'Nome deve ter pelo menos 5 caracteres');
            isValid = false;
        }

        return isValid;
    }

    validateWorkflowFolders() {
        let isValid = true;
        const sourceFolder = document.getElementById('source-folder');
        const targetFolder = document.getElementById('target-folder');

        if (sourceFolder.value === targetFolder.value && sourceFolder.value !== '') {
            this.showToast('Pasta de origem e destino nÃƒÆ’Ã‚Â£o podem ser iguais', 'warning');
            isValid = false;
        }

        return isValid;
    }

    validateWorkflowSchedule() {
        let isValid = true;
        const frequency = document.getElementById('execution-frequency');
        const cronExpression = document.getElementById('cron-expression');

        if (frequency.value === 'custom' && !cronExpression.value.trim()) {
            this.showFieldError(cronExpression, 'ExpressÃƒÆ’Ã‚Â£o cron ÃƒÆ’Ã‚Â© obrigatÃƒÆ’Ã‚Â³ria para frequÃƒÆ’Ã‚Âªncia personalizada');
            isValid = false;
        }

        return isValid;
    }

    validateWorkflowFilters() {
        let isValid = true;
        const filterType = document.getElementById('filter-type').value;
        const extensions = document.getElementById('allowed-extensions');
        const minSize = document.getElementById('min-size');
        const minAge = document.getElementById('min-age');

        if (filterType === 'extension' && !extensions.value.trim()) {
            this.showFieldError(extensions, 'Especifique as extensÃƒÆ’Ã‚Âµes permitidas');
            isValid = false;
        }

        if (filterType === 'size' && (!minSize.value || parseFloat(minSize.value) < 0)) {
            this.showFieldError(minSize, 'Tamanho mÃƒÆ’Ã‚Â­nimo deve ser um nÃƒÆ’Ã‚Âºmero positivo');
            isValid = false;
        }

        if (filterType === 'age' && (!minAge.value || parseFloat(minAge.value) < 0)) {
            this.showFieldError(minAge, 'Idade mÃƒÆ’Ã‚Â­nima deve ser um nÃƒÆ’Ã‚Âºmero positivo');
            isValid = false;
        }

        const uppercase = document.getElementById('transform-uppercase');
        const lowercase = document.getElementById('transform-lowercase');

        if (uppercase.checked && lowercase.checked) {
            this.showToast('NÃƒÆ’Ã‚Â£o ÃƒÆ’Ã‚Â© possÃƒÆ’Ã‚Â­vel aplicar maiÃƒÆ’Ã‚Âºsculas e minÃƒÆ’Ã‚Âºsculas simultaneamente', 'warning');
            isValid = false;
        }

        return isValid;
    }

    validateWorkflowCleanup() {
        let isValid = true;
        const autoCleanup = document.getElementById('auto-cleanup');
        const customTrash = document.getElementById('trash-folder');
        const customTrashPath = document.getElementById('custom-trash-path');

        if (autoCleanup.checked && customTrash.value === 'custom' && !customTrashPath.value.trim()) {
            this.showFieldError(customTrashPath, 'Caminho da pasta de lixeira personalizada ÃƒÆ’Ã‚Â© obrigatÃƒÆ’Ã‚Â³rio');
            isValid = false;
        }

        return isValid;
    }

    // Sistema de Gerenciamento de Pastas
    openFolderManager() {
        document.getElementById('folder-manager-modal').style.display = 'flex';
        this.populateFolderTypeHelp();
    }

    closeFolderManagerModal() {
        document.getElementById('folder-manager-modal').style.display = 'none';
        this.resetFolderManagerModal();
    }

    resetFolderManagerModal() {
        document.getElementById('folder-name').value = '';
        document.getElementById('folder-path').value = '';
        document.getElementById('folder-type').value = 'source';
        document.getElementById('folder-format').value = 'auto';
        document.getElementById('folder-description').value = '';
    }

    async saveFolder() {
        const name = document.getElementById('folder-name').value.trim();
        const path = document.getElementById('folder-path').value.trim();
        const type = document.getElementById('folder-type').value;
        const format = document.getElementById('folder-format').value;
        const description = document.getElementById('folder-description').value.trim();

        if (!name || !path) {
            this.showToast('Preencha todos os campos obrigatÃƒÆ’Ã‚Â³rios', 'warning');
            return;
        }

        try {
            const folderData = {
                name,
                path,
                type,
                format,
                description,
                enabled: true
            };

            const response = await fetch('/api/files/folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(folderData)
            });

            if (response.ok) {
                const result = await response.json();
                this.folders.push(result.data);
                this.renderConfiguredFolders();
                this.renderFileOpsFolderOptions();
                this.closeFolderManagerModal();
                this.showToast('Pasta configurada com sucesso!', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Erro ao salvar pasta');
            }

        } catch (error) {
            console.error('Erro ao salvar pasta:', error);
            this.showToast(`Erro ao salvar pasta: ${error.message}`, 'error');
        }
    }

    // Sistema de Workflows
    async saveWorkflow() {
        if (!this.validateCurrentWorkflowStep()) {
            return;
        }

        try {
            const workflowData = this.collectWorkflowData();
            
            const response = await fetch('/api/files/workflows', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(workflowData)
            });

            if (response.ok) {
                const result = await response.json();
                this.workflows.push(result.data);
                this.renderWorkflows();
                this.closeWorkflowModal();
                this.showToast('Fluxo de trabalho configurado com sucesso!', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Erro ao salvar fluxo de trabalho');
            }

        } catch (error) {
            console.error('Erro ao salvar fluxo de trabalho:', error);
            this.showToast(`Erro ao salvar fluxo de trabalho: ${error.message}`, 'error');
        }
    }

    collectWorkflowData() {
        return {
            name: document.getElementById('workflow-name').value.trim(),
            description: document.getElementById('workflow-description').value.trim(),
            sourceFolder: document.getElementById('source-folder').value,
            targetFolder: document.getElementById('target-folder').value,
            fileAction: document.getElementById('file-action').value,
            executionFrequency: document.getElementById('execution-frequency').value,
            cronExpression: document.getElementById('cron-expression').value.trim(),
            filterType: document.getElementById('filter-type').value,
            allowedExtensions: document.getElementById('allowed-extensions').value.trim(),
            minSize: document.getElementById('min-size').value,
            minAge: document.getElementById('min-age').value,
            transformations: {
                uppercase: document.getElementById('transform-uppercase').checked,
                lowercase: document.getElementById('transform-lowercase').checked,
                trim: document.getElementById('transform-trim').checked,
                validate: document.getElementById('transform-validate').checked
            },
            autoCleanup: document.getElementById('auto-cleanup').checked,
            cleanupFrequency: document.getElementById('cleanup-frequency').value,
            maxFileAge: document.getElementById('max-file-age').value,
            trashFolder: document.getElementById('trash-folder').value,
            customTrashPath: document.getElementById('custom-trash-path').value.trim(),
            options: {
                createBackup: document.getElementById('create-backup').checked,
                generateLogs: document.getElementById('generate-logs').checked,
                notifyCompletion: document.getElementById('notify-completion').checked
            },
            status: document.getElementById('workflow-status').value
        };
    }

    updateWorkflowSummary() {
        const summary = document.getElementById('workflow-summary');
        const workflowData = this.collectWorkflowData();
        
        summary.innerHTML = `
            <h5>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Resumo do Fluxo de Trabalho</h5>
            <ul>
                <li><strong>Nome:</strong> ${workflowData.name}</li>
                <li><strong>Origem:</strong> ${this.getFolderName(workflowData.sourceFolder)}</li>
                <li><strong>Destino:</strong> ${this.getFolderName(workflowData.targetFolder)}</li>
                <li><strong>AÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:</strong> ${this.getActionLabel(workflowData.fileAction)}</li>
                <li><strong>FrequÃƒÆ’Ã‚Âªncia:</strong> ${this.getFrequencyLabel(workflowData.executionFrequency)}</li>
                <li><strong>Filtro:</strong> ${this.getFilterLabel(workflowData.filterType)}</li>
                ${workflowData.autoCleanup ? `<li><strong>Limpeza:</strong> ${workflowData.cleanupFrequency} (${workflowData.maxFileAge} dias)</li>` : ''}
            </ul>
        `;
    }

    // MÃƒÆ’Ã‚Â©todos auxiliares
    getFolderName(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        return folder ? folder.name : 'N/A';
    }

    getActionLabel(action) {
        const labels = {
            'copy': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Copiar',
            'move': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¤ Mover',
            'copy_and_clean': 'ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â¹ Copiar e Limpar'
        };
        return labels[action] || action;
    }

    getFrequencyLabel(frequency) {
        const labels = {
            'realtime': 'ÃƒÂ¢Ã…Â¡Ã‚Â¡ Tempo Real',
            '1min': 'ÃƒÂ¢Ã‚ÂÃ‚Â±ÃƒÂ¯Ã‚Â¸Ã‚Â A cada 1 minuto',
            '5min': 'ÃƒÂ¢Ã‚ÂÃ‚Â±ÃƒÂ¯Ã‚Â¸Ã‚Â A cada 5 minutos',
            '15min': 'ÃƒÂ¢Ã‚ÂÃ‚Â±ÃƒÂ¯Ã‚Â¸Ã‚Â A cada 15 minutos',
            '30min': 'ÃƒÂ¢Ã‚ÂÃ‚Â±ÃƒÂ¯Ã‚Â¸Ã‚Â A cada 30 minutos',
            '1hour': 'ÃƒÂ¢Ã‚ÂÃ‚Â° A cada 1 hora',
            '6hours': 'ÃƒÂ¢Ã‚ÂÃ‚Â° A cada 6 horas',
            '12hours': 'ÃƒÂ¢Ã‚ÂÃ‚Â° A cada 12 horas',
            'daily': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦ DiÃƒÆ’Ã‚Â¡rio',
            'weekly': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦ Semanal',
            'monthly': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦ Mensal',
            'custom': 'ÃƒÂ¢Ã…Â¡Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â Personalizado'
        };
        return labels[frequency] || frequency;
    }

    getFilterLabel(filterType) {
        const labels = {
            'all': 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Todos os Arquivos',
            'new': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Â Ã¢â‚¬Â¢ Apenas Novos',
            'modified': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â Apenas Modificados',
            'extension': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â Por ExtensÃƒÆ’Ã‚Â£o',
            'size': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â Por Tamanho',
            'age': 'ÃƒÂ¢Ã‚ÂÃ‚Â° Por Idade'
        };
        return labels[filterType] || filterType;
    }

    // PopulaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de campos
    populateFolderSelects() {
        const sourceSelect = document.getElementById('source-folder');
        const targetSelect = document.getElementById('target-folder');
        
        sourceSelect.innerHTML = '<option value="">Selecione uma pasta de origem</option>';
        targetSelect.innerHTML = '<option value="">Selecione uma pasta de destino</option>';
        
        this.folders.forEach(folder => {
            if (folder.type === 'source' || folder.type === 'any') {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = `${folder.name} (${folder.path})`;
                sourceSelect.appendChild(option);
            }
            
            if (folder.type === 'target' || folder.type === 'any') {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = `${folder.name} (${folder.path})`;
                targetSelect.appendChild(option);
            }
        });
    }

    // Event Listeners
setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            this.switchTab(e.target.closest('.nav-btn').dataset.tab);
        });
    });

    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });
    }

            // BotÃƒÆ’Ã‚Â£o de system tray
        const trayBtn = document.getElementById('tray-btn');
        if (trayBtn) {
            trayBtn.addEventListener('click', () => {
                minimizeToTray();
            });
        }

        // Sistema de atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
        this.setupUpdateEventListeners();

        this.setupWorkflowEventListeners();
}

    // Sistema de AtualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
    setupUpdateEventListeners() {
        const checkUpdatesBtn = document.getElementById('check-updates-btn');
        if (checkUpdatesBtn) {
            checkUpdatesBtn.addEventListener('click', () => {
                this.checkForUpdates(true);
            });
        }

        const applyUpdatesBtn = document.getElementById('apply-updates-btn');
        if (applyUpdatesBtn) {
            applyUpdatesBtn.addEventListener('click', () => {
                this.applyUpdates();
            });
        }

        const restartAppBtn = document.getElementById('restart-app-btn');
        if (restartAppBtn) {
            restartAppBtn.addEventListener('click', () => {
                this.restartApplication();
            });
        }

        const autoCheckUpdates = document.getElementById('auto-check-updates');
        if (autoCheckUpdates) {
            autoCheckUpdates.addEventListener('change', () => this.saveAutoUpdateConfig());
        }

        const updateCheckFrequency = document.getElementById('update-check-frequency');
        if (updateCheckFrequency) {
            updateCheckFrequency.addEventListener('change', () => this.saveAutoUpdateConfig());
        }

        const autoApplyUpdates = document.getElementById('auto-apply-updates');
        if (autoApplyUpdates) {
            autoApplyUpdates.addEventListener('change', () => this.saveAutoUpdateConfig());
        }

        this.checkForUpdates();
    }

    getUpdateCheckIntervalMinutes(value) {
        switch (value) {
            case 'daily':
                return 24 * 60;
            case 'weekly':
                return 7 * 24 * 60;
            case 'monthly':
                return 30 * 24 * 60;
            case 'manual':
                return 365 * 24 * 60;
            default:
                return 60;
        }
    }

    getUpdateFrequencyLabel(minutes) {
        if (minutes >= 30 * 24 * 60) return 'monthly';
        if (minutes >= 7 * 24 * 60) return 'weekly';
        if (minutes >= 24 * 60) return 'daily';
        return 'manual';
    }

    async saveAutoUpdateConfig() {
        try {
            const autoCheckUpdates = document.getElementById('auto-check-updates');
            const updateCheckFrequency = document.getElementById('update-check-frequency');
            const autoApplyUpdates = document.getElementById('auto-apply-updates');
            const payload = {
                enabled: autoCheckUpdates ? autoCheckUpdates.checked : true,
                autoApply: autoApplyUpdates ? autoApplyUpdates.checked : true,
                checkIntervalMinutes: this.getUpdateCheckIntervalMinutes(
                    updateCheckFrequency ? updateCheckFrequency.value : 'daily'
                )
            };

            const response = await fetch('/api/update/auto/config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error?.message || 'Falha ao salvar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o');
            }
        } catch (error) {
            logger.error('Erro ao salvar config de auto update:', error);
            showToast('Erro ao salvar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error');
        }
    }

    // Verificar atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes disponÃƒÆ’Ã‚Â­veis
    async checkForUpdates(forceRemote = false) {
        try {
            logger.info('Verificando status de auto update...');
            const endpoint = forceRemote ? '/api/update/auto/check-now' : '/api/update/auto/status';
            const method = forceRemote ? 'POST' : 'GET';
            const response = await fetch(endpoint, { method });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Erro ao verificar status');
            }

            this.updateUpdateStatus(result.data);
            this.loadUpdateHistory();
        } catch (error) {
            logger.error('Erro ao verificar atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes:', error);
            this.updateUpdateStatus({
                state: {
                    status: 'error',
                    currentCommit: null,
                    targetCommit: null,
                    lastError: error.message
                },
                config: {
                    enabled: false,
                    checkIntervalMinutes: 0
                }
            });
        }
    }

    // Atualizar interface de status
    updateUpdateStatus(data) {
        if (window.DeParaUpdateRuntimeUI) {
            window.DeParaUpdateRuntimeUI.render(data, {
                getUpdateStateBadgeClass: this.getUpdateStateBadgeClass.bind(this),
                getUpdateFrequencyLabel: this.getUpdateFrequencyLabel.bind(this)
            });
            return;
        }

        const statusText = document.getElementById('update-status-text');
        const versionText = document.getElementById('update-version-text');
        const lastCheckText = document.getElementById('update-last-check-text');
        const lastResultText = document.getElementById('update-last-result-text');
        const stateBadge = document.getElementById('update-state-badge');
        const updateActions = document.getElementById('update-actions');
        const updateMessage = document.getElementById('update-message');
        const updateCommits = document.getElementById('update-commits');
        const autoCheckUpdates = document.getElementById('auto-check-updates');
        const updateCheckFrequency = document.getElementById('update-check-frequency');
        const autoApplyUpdates = document.getElementById('auto-apply-updates');

        const state = data.state || {};
        const config = data.config || {};
        const runtime = data.runtime || {};
        const supervisor = runtime.supervisor || {};
        const scheduler = runtime.scheduler || {};
        const release = runtime.release || {};
        const worktree = runtime.worktree || {};
        const hasUpdates = Boolean(
            state.targetCommit &&
            state.currentCommit &&
            state.targetCommit !== state.currentCommit
        );

        if (statusText) {
            if (state.lastError) {
                statusText.textContent = `Erro: ${state.lastError}`;
            } else if (release.activationState === 'rollback' || release.activationState === 'rollback_restart') {
                statusText.textContent = 'Alerta: rollback automático em andamento';
            } else if (release.activationState === 'staging' || release.activationState === 'activating' || release.activationState === 'restarting') {
                statusText.textContent = `Atualização em andamento: ${release.activationState}`;
            } else if (scheduler.stale) {
                statusText.textContent = 'Alerta: scheduler de auto-update está sem ciclos recentes';
            } else if (runtime.autoUpdateOperationallyReady === false) {
                statusText.textContent = 'Alerta: auto-update não está operacionalmente apto neste runtime';
            } else {
                statusText.textContent = `Status: ${state.status || 'idle'}`;
            }
        }

        if (lastCheckText) {
            lastCheckText.textContent = `ÃƒÆ’Ã…Â¡ltima verificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: ${state.lastCheckAt ? new Date(state.lastCheckAt).toLocaleString('pt-BR') : '-'}`;
        }

        if (lastResultText) {
            lastResultText.textContent = `ÃƒÆ’Ã…Â¡ltimo resultado: ${state.lastEvent || '-'}`;
        }

        if (versionText) {
            const current = state.currentCommit ? state.currentCommit.slice(0, 8) : 'desconhecida';
            const target = state.targetCommit ? state.targetCommit.slice(0, 8) : current;
            const currentRelease = release.current || '-';
            const targetRelease = release.target || currentRelease;
            versionText.textContent = `Commit atual: ${current} | alvo: ${target} | release: ${currentRelease} | alvo release: ${targetRelease}`;
        }

        if (lastResultText) {
            const supervisorLabel = supervisor.supervisor || 'desconhecido';
            const failureStage = runtime.lastFailureStage || state.lastFailureStage || '-';
            lastResultText.textContent = `Ãšltimo resultado: ${state.lastEvent || '-'} | supervisor: ${supervisorLabel} | etapa: ${failureStage}`;
        }

        if (versionText) {
            const current = state.currentCommit ? state.currentCommit.slice(0, 8) : 'desconhecida';
            const target = state.targetCommit ? state.targetCommit.slice(0, 8) : current;
            const currentRelease = release.current || '-';
            const targetRelease = release.target || currentRelease;
            const schedulerLabel = scheduler.lastCycleAt
                ? new Date(scheduler.lastCycleAt).toLocaleString('pt-BR')
                : 'sem ciclo registrado';
            versionText.textContent = `Commit atual: ${current} | alvo: ${target} | release: ${currentRelease} | alvo release: ${targetRelease} | último ciclo: ${schedulerLabel}`;
        }

        if (stateBadge) {
            const status = state.status || 'idle';
            stateBadge.textContent = status;
            stateBadge.className = `badge ${this.getUpdateStateBadgeClass(status)}`;
        }

        if (autoCheckUpdates) {
            autoCheckUpdates.checked = Boolean(config.enabled);
        }

        if (autoApplyUpdates) {
            autoApplyUpdates.checked = Boolean(config.autoApply);
        }

        if (updateCheckFrequency) {
            updateCheckFrequency.value = this.getUpdateFrequencyLabel(Number(config.checkIntervalMinutes) || 0);
        }

        if (updateActions) {
            updateActions.style.display = 'block';
        }

        if (updateMessage) {
            if (runtime.autoUpdateOperationallyReady === false) {
                const reasons = Array.isArray(supervisor.reasons) ? supervisor.reasons.join(', ') : 'sem detalhes';
                updateMessage.textContent = `Runtime não apto para auto-update automático: ${reasons}`;
            } else if (release.activationState === 'staging' && release.staging) {
                updateMessage.textContent = `Preparando release ${release.staging} antes da ativação.`;
            } else if (release.activationState === 'activating' && release.target) {
                updateMessage.textContent = `Ativando release ${release.target} com preservação automática dos dados do usuário.`;
            } else if (release.activationState === 'restarting' && release.target) {
                updateMessage.textContent = `Release ${release.target} publicada. Aguardando reinício e validação de saúde.`;
            } else if ((release.activationState === 'rollback' || release.activationState === 'rollback_restart') && release.previous) {
                updateMessage.textContent = `Rollback automático para a release ${release.previous} em andamento.`;
            } else if (scheduler.stale) {
                updateMessage.textContent = 'Scheduler sem ciclos recentes. Verifique PM2, restart e persistência do processo.';
            } else {
                updateMessage.textContent = hasUpdates
                    ? 'Há atualização disponível e ela será publicada como um novo release imutável.'
                    : 'Aplicação atualizada. O runtime está saudável e preserva os dados do usuário automaticamente.';
            }
        }

        if (updateCommits) {
            updateCommits.textContent = hasUpdates
                ? `Atual: ${(state.currentCommit || '').slice(0, 8)} -> Alvo: ${(state.targetCommit || '').slice(0, 8)}`
                : '';
        }
    }

    getUpdateStateBadgeClass(status) {
        const map = {
            idle: 'badge-success',
            checking: 'badge-info',
            downloading: 'badge-info',
            installing: 'badge-warning',
            restarting: 'badge-warning',
            validating: 'badge-info',
            rollback: 'badge-warning',
            critical: 'badge-danger'
        };
        return map[status] || 'badge-info';
    }

    async loadUpdateHistory() {
        const list = document.getElementById('update-history-list');
        if (!list) return;

        try {
            const response = await fetch('/api/update/auto/history?limit=5');
            const result = await response.json();
            if (!result.success || !Array.isArray(result.data)) {
                throw new Error(result.error?.message || 'Falha ao carregar histÃƒÆ’Ã‚Â³rico');
            }

            if (result.data.length === 0) {
                list.innerHTML = '<small>Nenhum evento recente</small>';
                return;
            }

            list.innerHTML = result.data
                .map((item) => {
                    const when = item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '-';
                    const event = item.event || 'evento';
                    const detail = item.releaseId || item.previousRelease || item.worktreeSummary || item.error || item.reason || item.status || '';
                    return `<div><small><strong>${event}</strong> - ${when}${detail ? ` - ${detail}` : ''}</small></div>`;
                })
                .join('');
        } catch (error) {
            list.innerHTML = '<small>Erro ao carregar histÃƒÆ’Ã‚Â³rico</small>';
        }
    }

    // Aplicar atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
    async applyUpdates() {
        const applyBtn = document.getElementById('apply-updates-btn');
        try {
            if (applyBtn) {
                applyBtn.disabled = true;
                applyBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Verificando update...';
            }

            const checkResponse = await fetch('/api/update/auto/check-now', { method: 'POST' });
            const checkResult = await checkResponse.json();
            if (!checkResult.success) {
                throw new Error(checkResult.error?.message || 'Falha ao verificar atualizacoes');
            }

            const hasUpdates = Boolean(checkResult?.data?.check?.hasUpdates);
            if (!hasUpdates) {
                showToast('Sem atualizacao pendente no origin/main. Aplicacao ja esta atualizada.', 'info');
                this.updateUpdateStatus(checkResult.data);
                return;
            }

            if (applyBtn) {
                applyBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Executando ciclo...';
            }

            const response = await fetch('/api/update/auto/trigger', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Falha ao iniciar ciclo');
            }

            showToast('Ciclo automatico iniciado. Reinicio ocorrera automaticamente.', 'success');
            setTimeout(() => this.checkForUpdates(true), 1000);
        } catch (error) {
            logger.error('Erro ao disparar ciclo de update:', error);
            showToast(error.message || 'Erro ao iniciar ciclo de atualizacao', 'error');
        } finally {
            if (applyBtn) {
                applyBtn.disabled = false;
                applyBtn.innerHTML = '<span class="material-icons">download</span> Executar Ciclo Agora';
            }
        }
    }

    // Reiniciar aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    async restartApplication() {
        try {
            const restartBtn = document.getElementById('restart-app-btn');
            if (restartBtn) {
                restartBtn.disabled = true;
                restartBtn.innerHTML = '<span class="material-icons">info</span> Reinício via PM2';
            }


            showToast('No RP4, reinicie a aplicação com `pm2 restart DePara`.', 'info');
        } catch (error) {
            logger.error('Erro ao reiniciar aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:', error);
            showToast(error.message || 'Erro ao reiniciar aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error');
        } finally {
            const restartBtn = document.getElementById('restart-app-btn');
            if (restartBtn) {
                restartBtn.disabled = false;
                restartBtn.innerHTML = '<span class="material-icons">restart_alt</span> Reiniciar AplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o';
            }
        }
    }

    setupWorkflowEventListeners() {
        const filterType = document.getElementById('filter-type');
        if (filterType) {
            filterType.addEventListener('change', () => this.toggleFilterOptions());
        }

        const autoCleanup = document.getElementById('auto-cleanup');
        if (autoCleanup) {
            autoCleanup.addEventListener('change', () => this.toggleCleanupOptions());
        }

        const trashFolder = document.getElementById('trash-folder');
        if (trashFolder) {
            trashFolder.addEventListener('change', () => this.toggleCustomTrash());
        }

        const uppercase = document.getElementById('transform-uppercase');
        const lowercase = document.getElementById('transform-lowercase');
        if (uppercase && lowercase) {
            uppercase.addEventListener('change', () => this.toggleCaseConflict());
            lowercase.addEventListener('change', () => this.toggleCaseConflict());
        }
    }

    // MÃƒÆ’Ã‚Â©todos de validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    showFieldError(field, message) {
        const validationDiv = field.parentNode.querySelector('.validation-message');
        if (validationDiv) {
            validationDiv.textContent = message;
            validationDiv.className = 'validation-message error';
        }
        field.style.borderColor = '#e74c3c';
    }

    clearFieldError(field) {
        const validationDiv = field.parentNode.querySelector('.validation-message');
        if (validationDiv) {
            validationDiv.textContent = '';
            validationDiv.className = 'validation-message';
        }
        field.style.borderColor = 'rgba(102, 126, 234, 0.2)';
    }

    // MÃƒÆ’Ã‚Â©todos de toggle
    toggleFilterOptions() {
        const filterType = document.getElementById('filter-type').value;
        
        document.getElementById('extension-filter').classList.remove('active');
        document.getElementById('size-filter').classList.remove('active');
        document.getElementById('age-filter').classList.remove('active');
        
        switch (filterType) {
            case 'extension':
                document.getElementById('extension-filter').classList.add('active');
                break;
            case 'size':
                document.getElementById('size-filter').classList.add('active');
                break;
            case 'age':
                document.getElementById('age-filter').classList.add('active');
                break;
        }
    }

    toggleCleanupOptions() {
        const autoCleanup = document.getElementById('auto-cleanup').checked;
        document.getElementById('cleanup-options').style.display = autoCleanup ? 'block' : 'none';
    }

    toggleCustomTrash() {
        const trashFolder = document.getElementById('trash-folder').value;
        document.getElementById('custom-trash').classList.toggle('active', trashFolder === 'custom');
    }

    toggleCaseConflict() {
        const uppercase = document.getElementById('transform-uppercase');
        const lowercase = document.getElementById('transform-lowercase');
        
        if (uppercase.checked && lowercase.checked) {
            if (event.target === uppercase) {
                lowercase.checked = false;
            } else {
                uppercase.checked = false;
            }
        }
    }

    // MÃƒÆ’Ã‚Â©todos de carregamento de dados
    async loadWorkflows() {
        try {            const response = await fetch('/api/files/workflows');
            if (response.ok) {
                const result = await response.json();
                this.workflows = result.data || [];                this.renderWorkflows();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao carregar workflows:', error);
            this.workflows = [];
            this.renderWorkflows();
        }
    }

    renderWorkflows() {
        const workflowsList = document.getElementById('workflows-list');

        if (!workflowsList) {
            console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Elemento workflows-list nÃƒÆ’Ã‚Â£o encontrado');
            return;
        }
        if (this.workflows.length === 0) {
            workflowsList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">workflow</span>
                    <p>Nenhum workflow configurado</p>
                    <small>Use o modal de workflow para criar</small>
                </div>
            `;
            return;
        }

        workflowsList.innerHTML = this.workflows.map(workflow => `
            <div class="workflow-card">
                <div class="workflow-header">
                    <div>
                        <div class="workflow-name">${workflow.name}</div>
                        <div class="workflow-description">${workflow.description || 'Sem descriÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o'}</div>
                    </div>
                    <span class="workflow-status ${workflow.status}">${workflow.status}</span>
                </div>
                
                <div class="workflow-details">
                    <div class="workflow-detail-item">
                        <span class="material-icons">folder</span>
                        <span>De: ${this.getFolderName(workflow.sourceFolder)}</span>
                    </div>
                    <div class="workflow-detail-item">
                        <span class="material-icons">folder_shared</span>
                        <span>Para: ${this.getFolderName(workflow.targetFolder)}</span>
                    </div>
                    <div class="workflow-detail-item">
                        <span class="material-icons">schedule</span>
                        <span>${this.getFrequencyLabel(workflow.executionFrequency)}</span>
                    </div>
                    <div class="workflow-detail-item">
                        <span class="material-icons">filter_list</span>
                        <span>${this.getFilterLabel(workflow.filterType)}</span>
                    </div>
                </div>
                
                <div class="workflow-actions">
                    <button class="edit-btn edit-workflow-btn" data-workflow-id="${workflow.id}">
                        <span class="material-icons">edit</span>
                        Editar
                    </button>
                    <button class="toggle-btn toggle-workflow-btn" data-workflow-id="${workflow.id}">
                        <span class="material-icons">${workflow.status === 'active' ? 'pause' : 'play_arrow'}</span>
                        ${workflow.status === 'active' ? 'Pausar' : 'Ativar'}
                    </button>
                    <button class="delete-btn delete-workflow-btn" data-workflow-id="${workflow.id}">
                        <span class="material-icons">delete</span>
                        Excluir
                    </button>
                </div>
            </div>
        `).join('');

        // Configurar event listeners para os botÃƒÆ’Ã‚Âµes de workflow
        const editButtons = workflowsList.querySelectorAll('.edit-workflow-btn');
        const toggleButtons = workflowsList.querySelectorAll('.toggle-workflow-btn');
        const deleteButtons = workflowsList.querySelectorAll('.delete-workflow-btn');

        editButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const workflowId = btn.getAttribute('data-workflow-id');
                this.editWorkflow(workflowId);
            });
        });

        toggleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const workflowId = btn.getAttribute('data-workflow-id');
                this.toggleWorkflow(workflowId);
            });
        });

        deleteButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const workflowId = btn.getAttribute('data-workflow-id');
                this.deleteWorkflow(workflowId);
            });
        });
    }

    async loadFolders() {
        // Evitar chamadas simultÃƒÆ’Ã‚Â¢neas
        if (this.isLoadingFolders) {            return;
        }
        this.isLoadingFolders = true;

        try {            const response = await fetch('/api/files/folders');
            if (response.ok) {
                const result = await response.json();
                this.folders = result.data || [];                this.renderConfiguredFolders();
                this.renderFileOpsFolderOptions();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao carregar pastas:', error);

            // Verificar se ÃƒÆ’Ã‚Â© erro de conexÃƒÆ’Ã‚Â£o (API nÃƒÆ’Ã‚Â£o disponÃƒÆ’Ã‚Â­vel)
            if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
                console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â API nÃƒÆ’Ã‚Â£o estÃƒÆ’Ã‚Â¡ disponÃƒÆ’Ã‚Â­vel. Mostrando mensagem para o usuÃƒÆ’Ã‚Â¡rio.');
                this.showApiUnavailableMessage();
            } else {
                this.folders = [];
                this.renderConfiguredFolders();
            }
        } finally {
            // Sempre liberar o flag de carregamento
            this.isLoadingFolders = false;
        }
    }

    // Mostrar mensagem quando API nÃƒÆ’Ã‚Â£o estÃƒÆ’Ã‚Â¡ disponÃƒÆ’Ã‚Â­vel
    renderFileOpsFolderOptions() {
        const sourceSelect = document.getElementById('fileops-source-configured');
        const targetSelect = document.getElementById('fileops-target-configured');
        const folders = Array.isArray(this.folders) ? this.folders : [];

        if (sourceSelect) {
            const selectedValue = sourceSelect.value;
            sourceSelect.innerHTML = '<option value="">Selecionar atalho salvo</option>' +
                folders
                    .filter((folder) => folder.path)
                    .map((folder) => `<option value="${folder.path}">${folder.name} · ${folder.path}</option>`)
                    .join('');
            sourceSelect.value = selectedValue;
        }

        if (targetSelect) {
            const selectedValue = targetSelect.value;
            targetSelect.innerHTML = '<option value="">Selecionar atalho salvo</option>' +
                folders
                    .filter((folder) => folder.path)
                    .map((folder) => `<option value="${folder.path}">${folder.name} · ${folder.path}</option>`)
                    .join('');
            targetSelect.value = selectedValue;
        }
    }

    showApiUnavailableMessage() {
        const foldersList = document.getElementById('folders-list');
        if (!foldersList) return;

        foldersList.innerHTML = `
            <div class="empty-state api-unavailable">
                <span class="material-icons" style="color: #ff9800;">warning</span>
                <p><strong>Servidor nÃƒÆ’Ã‚Â£o estÃƒÆ’Ã‚Â¡ executando</strong></p>
                <small style="color: #666;">
                    O servidor Node.js precisa estar rodando para carregar as pastas.<br>
                    Execute: <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px;">node src/main.js</code>
                </small>
                <button class="btn btn-primary reload-page-btn" style="margin-top: 10px;">
                    <span class="material-icons">refresh</span>
                    Tentar Novamente
                </button>
            </div>
        `;    }

    renderConfiguredFolders() {
        // Verificar se jÃƒÆ’Ã‚Â¡ estÃƒÆ’Ã‚Â¡ renderizando para evitar loops
        if (this.isRenderingFolders) {            return;
        }
        this.isRenderingFolders = true;

        const foldersList = document.getElementById('folders-list');
        if (!foldersList) {
            console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Elemento folders-list nÃƒÆ’Ã‚Â£o encontrado');
            this.isRenderingFolders = false;
            return;
        }
        if (this.folders.length === 0) {
            foldersList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">folder_open</span>
                    <p>Nenhuma pasta configurada</p>
                    <small>Use a configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o rÃƒÆ’Ã‚Â¡pida acima ou crie manualmente</small>
                </div>
            `;
            this.isRenderingFolders = false;
            return;
        }

        foldersList.innerHTML = this.folders.map(folder => `
            <div class="folder-item">
                <div class="folder-info">
                    <span class="material-icons">${this.getFolderIcon(folder.type)}</span>
                    <div>
                        <strong>${folder.name}</strong>
                        <small>${folder.path}</small>
                    </div>
                </div>
                <div class="folder-actions">
                    <button class="btn-icon edit-folder-btn" data-folder-id="${folder.id}">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn-icon danger delete-folder-btn" data-folder-id="${folder.id}">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            </div>
        `).join('');
        // Adicionar event listeners para os botÃƒÆ’Ã‚Âµes (evita CSP violation)
        this.addFolderEventListeners();

        // Liberar flag de renderizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        this.isRenderingFolders = false;
    }

    getFolderTypeLabel(type) {
        const labels = {
            'source': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¥ Origem',
            'target': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¤ Destino',
            'temp': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã¢â‚¬Å¡ÃƒÂ¯Ã‚Â¸Ã‚Â TemporÃƒÆ’Ã‚Â¡ria',
            'trash': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã¢â‚¬ËœÃƒÂ¯Ã‚Â¸Ã‚Â Lixeira',
            'any': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â Qualquer'
        };
        return labels[type] || type;
    }

    // Adicionar event listeners para botÃƒÆ’Ã‚Âµes de pasta (evita CSP violation)
    addFolderEventListeners() {
        // BotÃƒÆ’Ã‚Âµes de editar pasta
        const editButtons = document.querySelectorAll('.edit-folder-btn');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const folderId = e.currentTarget.getAttribute('data-folder-id');
                this.editFolder(folderId);
            });
        });

        // BotÃƒÆ’Ã‚Âµes de deletar pasta
        const deleteButtons = document.querySelectorAll('.delete-folder-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const folderId = e.currentTarget.getAttribute('data-folder-id');
                this.deleteFolder(folderId);
            });
        });
    }

    // Adicionar event listeners para onboarding (evita CSP violation)
    addOnboardingEventListeners() {
        // BotÃƒÆ’Ã‚Â£o de ajuda/tutorial
        const helpBtn = document.querySelector('.help-tutorial-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                this.showOnboarding();
            });
        }

        // BotÃƒÆ’Ã‚Âµes do modal de onboarding
        const closeBtn = document.querySelector('.onboarding-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeOnboarding();
            });
        }

        const skipBtn = document.querySelector('.onboarding-skip-btn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                this.skipOnboarding();
            });
        }

        const quickBtn = document.querySelector('.onboarding-quick-btn');
        if (quickBtn) {
            quickBtn.addEventListener('click', () => {
                this.quickSetup();
            });
        }

        // BotÃƒÆ’Ã‚Âµes de aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o principal (evita CSP violation)
        this.addActionButtonListeners();

        // BotÃƒÆ’Ã‚Âµes de slideshow
        this.addSlideshowEventListeners();

        // Filtros de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de arquivo
        this.addFileOperationEventListeners();
    }

    // Adicionar event listeners para botÃƒÆ’Ã‚Âµes de aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o (evita CSP violation)
    addActionButtonListeners() {
        // BotÃƒÆ’Ã‚Âµes da dashboard principal
        const moveCard = document.querySelector('.action-move-card');
        if (moveCard) {
            moveCard.addEventListener('click', () => {
                if (typeof showFileOperationModal === 'function') {
                    showFileOperationModal('move');
                }
            });
        }

        const copyCard = document.querySelector('.action-copy-card');
        if (copyCard) {
            copyCard.addEventListener('click', () => {
                if (typeof showFileOperationModal === 'function') {
                    showFileOperationModal('copy');
                }
            });
        }

        const deleteCard = document.querySelector('.action-delete-card');
        if (deleteCard) {
            deleteCard.addEventListener('click', () => {
                if (typeof showFileOperationModal === 'function') {
                    showFileOperationModal('delete');
                }
            });
        }

        const scheduleCard = document.querySelector('.action-schedule-card');
        if (scheduleCard) {
            scheduleCard.addEventListener('click', () => {
                window.showScheduleModal();
            });
        }

        const slideshowCard = document.querySelector('.action-slideshow-card');
        if (slideshowCard) {
            slideshowCard.addEventListener('click', () => {
                if (window.deParaUI) {
                    window.deParaUI.showSlideshowModal();
                } else {
                window.showSlideshowModal();
                }
            });
        }

        // BotÃƒÆ’Ã‚Âµes de configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o rÃƒÆ’Ã‚Â¡pida de pastas
        this.addQuickFolderListeners();

        // BotÃƒÆ’Ã‚Âµes de gerenciamento de pastas
        const folderManagerBtn = document.querySelector('.folder-manager-btn');
        if (folderManagerBtn) {
            folderManagerBtn.addEventListener('click', () => {
                window.deParaUI.openFolderManager();
            });
        }

        const refreshFoldersBtn = document.querySelector('.refresh-folders-btn');
        if (refreshFoldersBtn) {
            refreshFoldersBtn.addEventListener('click', () => {
                window.deParaUI.refreshFoldersList();
            });
        }
    }

    // Adicionar event listeners para botÃƒÆ’Ã‚Âµes de configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o rÃƒÆ’Ã‚Â¡pida de pastas
    addQuickFolderListeners() {
        const documentsCard = document.querySelector('.quick-folder-documents');
        if (documentsCard) {
            documentsCard.addEventListener('click', () => {
                this.createQuickFolder('documents');
            });
        }

        const backupCard = document.querySelector('.quick-folder-backup');
        if (backupCard) {
            backupCard.addEventListener('click', () => {
                this.createQuickFolder('backup');
            });
        }

        const mediaCard = document.querySelector('.quick-folder-media');
        if (mediaCard) {
            mediaCard.addEventListener('click', () => {
                this.createQuickFolder('media');
            });
        }

        const tempCard = document.querySelector('.quick-folder-temp');
        if (tempCard) {
            tempCard.addEventListener('click', () => {
                this.createQuickFolder('temp');
            });
        }
    }

    // MÃƒÆ’Ã‚Â©todos de navegaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        document.getElementById(tabName).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        this.currentTab = tabName;

        switch (tabName) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'workflows':
                this.loadWorkflows();
                break;
            case 'folders':
                // NÃƒÆ’Ã‚Â£o recarregar pastas se jÃƒÆ’Ã‚Â¡ foram carregadas na inicializaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
                if (!this.folders || this.folders.length === 0) {
                    this.loadFolders();
                }
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    // MÃƒÆ’Ã‚Â©todos existentes mantidos
    async updateDashboard() {
        try {
            await this.refreshDashboardData();
        } catch (error) {
            console.error('Erro ao atualizar dashboard:', error);
        }
    }

    updateRecentActivity() {
        const activityList = document.getElementById('recent-activity');
        if (!activityList) return;

        const activities = [
            { icon: 'workflow', text: 'Fluxo configurado: Processamento CSV', time: '2 min atrÃƒÆ’Ã‚Â¡s' },
            { icon: 'transform', text: 'Arquivo convertido: dados.csv ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ dados.json', time: '5 min atrÃƒÆ’Ã‚Â¡s' },
            { icon: 'folder', text: 'Pasta configurada: Dados_Entrada', time: '10 min atrÃƒÆ’Ã‚Â¡s' }
        ];

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <span class="material-icons">${activity.icon}</span>
                <div style="flex: 1;">
                    <div>${activity.text}</div>
                    <small style="color: #999;">${activity.time}</small>
                </div>
            </div>
        `).join('');
    }

    // MÃƒÆ’Ã‚Â©todos de conversÃƒÆ’Ã‚Â£o e mapeamento mantidos
    async convertData() {
        const sourceFormat = document.getElementById('source-format').value;
        const targetFormat = document.getElementById('target-format').value;
        const data = document.getElementById('conversion-data').value.trim();

        if (!data) {
            this.showToast('Insira dados para converter', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sourceFormat,
                    targetFormat,
                    data
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.showConversionResult(result);
                this.showToast('ConversÃƒÆ’Ã‚Â£o realizada com sucesso!', 'success');
            } else {
                const error = await response.json();
                this.showToast(`Erro na conversÃƒÆ’Ã‚Â£o: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error('Erro na conversÃƒÆ’Ã‚Â£o:', error);
            this.showToast('Erro na conversÃƒÆ’Ã‚Â£o', 'error');
        }
    }

    showConversionResult(result) {
        const resultDiv = document.getElementById('conversion-result');
        if (!resultDiv) return;

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <h3>Resultado da ConversÃƒÆ’Ã‚Â£o</h3>
            <div class="form-group">
                <label>Dados Convertidos:</label>
                <textarea readonly style="min-height: 200px; font-family: monospace;">${result.convertedData || result.data}</textarea>
            </div>
            <div class="form-group">
                <label>Formato de Origem:</label>
                <input type="text" readonly value="${result.sourceFormat}">
            </div>
            <div class="form-group">
                <label>Formato de Destino:</label>
                <input type="text" readonly value="${result.targetFormat}">
            </div>
        `;
    }

    async generateMapping() {
        const sourceFields = document.getElementById('source-fields').value.trim();
        const targetFields = document.getElementById('target-fields').value.trim();
        const data = document.getElementById('mapping-data').value.trim();

        if (!sourceFields || !targetFields) {
            this.showToast('Preencha os campos de origem e destino', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/map/auto', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sourceFields: sourceFields.split(',').map(f => f.trim()),
                    targetFields: targetFields.split(',').map(f => f.trim()),
                    sampleData: data ? JSON.parse(data) : []
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.showMappingResult(result);
                this.showToast('Mapeamento gerado com sucesso!', 'success');
            } else {
                const error = await response.json();
                this.showToast(`Erro no mapeamento: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error('Erro no mapeamento:', error);
            this.showToast('Erro no mapeamento', 'error');
        }
    }

    showMappingResult(result) {
        const resultDiv = document.getElementById('mapping-result');
        if (!resultDiv) return;

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <h3>Mapeamento Gerado</h3>
            <div class="form-group">
                <label>Mapeamento:</label>
                <textarea readonly style="min-height: 200px; font-family: monospace;">${JSON.stringify(result.mapping, null, 2)}</textarea>
            </div>
            <div class="form-group">
                <label>ConfianÃƒÆ’Ã‚Â§a:</label>
                <input type="text" readonly value="${result.confidence || 'N/A'}%">
            </div>
        `;
    }

    // MÃƒÆ’Ã‚Â©todos de configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
    async loadSettings() {
        try {
            this.settings = this.normalizeAppSettings(this.persistedConfig?.appSettings || this.settings || this.getDefaultAppSettings());
            this.populateSettingsForm();
        } catch (error) {
            console.error('Erro ao carregar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes:', error);
        }
    }

    populateSettingsForm() {
        const appPort = document.getElementById('app-port');
        const logLevel = document.getElementById('log-level');
        const environment = document.getElementById('environment');
        const logDirectory = document.getElementById('log-directory');

        if (appPort) appPort.value = this.settings.port;
        if (logLevel) logLevel.value = this.settings.logLevel;
        if (environment) environment.value = this.settings.environment;
        if (logDirectory) logDirectory.value = this.settings.logDirectory;
    }

    async saveSettings() {
        const settings = this.normalizeAppSettings({
            port: parseInt(document.getElementById('app-port').value),
            logLevel: document.getElementById('log-level').value,
            environment: document.getElementById('environment').value,
            logDirectory: document.getElementById('log-directory').value
        });

        try {
            this.settings = settings;
            await this.saveFunctionalConfig({
                appSettings: settings
            });
            this.showToast('ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes salvas com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao salvar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes:', error);
            this.showToast('Erro ao salvar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes', 'error');
        }
    }

    // MÃƒÆ’Ã‚Â©todos de arquivo
    handleFileUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const conversionData = document.getElementById('conversion-data');
            if (conversionData) {
                conversionData.value = e.target.result;
            }
            this.showToast(`Arquivo "${file.name}" carregado com sucesso!`, 'success');
        };
        reader.readAsText(file);
    }
    // MÒ©todos de monitoramento
    startMonitoring() {
        this.startUnifiedRefreshScheduler();
    }

    // Sistema de notificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="material-icons">${this.getToastIcon(type)}</span>
                <span>${message}</span>
            </div>
        `;

        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 5000);
        }
    }

    getToastIcon(type) {
        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };
        return icons[type] || 'info';
    }

    // MÃƒÆ’Ã‚Â©todos de ajuda
    updateSourceFolderInfo() {
        const sourceFolder = document.getElementById('source-folder');
        const helpText = document.getElementById('source-folder-help');
        
        if (sourceFolder && helpText) {
            const selectedFolder = this.folders.find(f => f.id === sourceFolder.value);
            if (selectedFolder) {
                helpText.textContent = `Pasta: ${selectedFolder.name} (${selectedFolder.path})`;
            } else {
                helpText.textContent = 'Pasta onde os arquivos estÃƒÆ’Ã‚Â£o localizados';
            }
        }
    }

    updateTargetFolderInfo() {
        const targetFolder = document.getElementById('target-folder');
        const helpText = document.getElementById('target-folder-help');
        
        if (targetFolder && helpText) {
            const selectedFolder = this.folders.find(f => f.id === targetFolder.value);
            if (selectedFolder) {
                helpText.textContent = `Pasta: ${selectedFolder.name} (${selectedFolder.path})`;
            } else {
                helpText.textContent = 'Pasta para onde os arquivos serÃƒÆ’Ã‚Â£o enviados';
            }
        }
    }

    updateActionHelp() {
        const action = document.getElementById('file-action');
        const helpText = document.getElementById('action-help');
        
        if (action && helpText) {
            const helpTexts = {
                'copy': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Os arquivos originais permanecerÃƒÆ’Ã‚Â£o na pasta de origem',
                'move': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¤ Os arquivos originais serÃƒÆ’Ã‚Â£o removidos da pasta de origem',
                'copy_and_clean': 'ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â¹ Os arquivos serÃƒÆ’Ã‚Â£o copiados e os originais limpos/truncados'
            };
            helpText.textContent = helpTexts[action.value] || helpTexts['copy'];
        }
    }

    updateFolderTypeHelp() {
        const typeSelect = document.getElementById('folder-type');
        const typeHelp = document.getElementById('folder-type-help');
        
        if (typeSelect && typeHelp) {
            const type = typeSelect.value;
            const helpTexts = {
                'source': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¥ Pasta onde arquivos chegam para processamento',
                'target': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¤ Pasta onde arquivos processados sÃƒÆ’Ã‚Â£o salvos',
                'temp': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã¢â‚¬Å¡ÃƒÂ¯Ã‚Â¸Ã‚Â Pasta temporÃƒÆ’Ã‚Â¡ria para arquivos em processamento',
                'trash': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã¢â‚¬ËœÃƒÂ¯Ã‚Â¸Ã‚Â Pasta para arquivos removidos/antigos',
                'any': 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â Pasta que pode ser usada como origem ou destino'
            };
            typeHelp.textContent = helpTexts[type] || helpTexts['source'];
        }
    }
}

// FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes globais
function openWorkflowConfig() {
    ui.openWorkflowConfig();
}

function closeWorkflowModal() {
    ui.closeWorkflowModal();
}

function saveWorkflow() {
    ui.saveWorkflow();
}

function openFolderManager() {
    ui.openFolderManager();
}

function closeFolderManagerModal() {
    ui.closeFolderManagerModal();
}

function saveFolder() {
    ui.saveFolder();
}

function showOnboarding() {
    ui.showOnboarding();
}

function skipOnboarding() {
    ui.skipOnboarding();
}

function startOnboarding() {
    ui.startOnboarding();
}

function nextWorkflowStep() {
    ui.nextWorkflowStep();
}

function previousWorkflowStep() {
    ui.previousWorkflowStep();
}

function toggleFilterOptions() {
    ui.toggleFilterOptions();
}

function toggleCleanupOptions() {
    ui.toggleCleanupOptions();
}

function toggleCustomTrash() {
    ui.toggleCustomTrash();
}

function toggleCaseConflict() {
    ui.toggleCaseConflict();
}

function validateField(field, type) {
    ui.validateField(field, type);
}

function openConversion() {
    ui.switchTab('conversion');
}

function openMapping() {
    ui.switchTab('mapping');
}

// ==========================================
// FILE OPERATIONS FUNCTIONS
// ==========================================

// File Operation Modal
function showFileOperationModal(action) {
    const modal = document.getElementById('file-operation-modal');
    const title = document.getElementById('file-operation-title');
    const targetGroup = document.getElementById('target-file-group');

    // Set title and hide/show target field based on action
    switch(action) {
        case 'move':
            title.textContent = 'Mover Arquivo';
            targetGroup.style.display = 'block';
            break;
        case 'copy':
            title.textContent = 'Copiar Arquivo';
            targetGroup.style.display = 'block';
            break;
        case 'delete':
            title.textContent = 'Apagar Arquivo';
            targetGroup.style.display = 'none';
            break;
    }

    // Store current action
    modal.dataset.action = action;

    // Reset form
    document.getElementById('source-file-path').value = '';
    document.getElementById('target-file-path').value = '';
    document.getElementById('backup-before-operation').checked = true;
    document.getElementById('overwrite-existing').checked = false;

    modal.style.display = 'flex';
}

function closeFileOperationModal() {
    document.getElementById('file-operation-modal').style.display = 'none';
}

// FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para minimizar para system tray
async function minimizeToTray() {
    try {
        logger.info('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â± Minimizando aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para system tray...');
        
        const response = await fetch('/api/tray/minimize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            logger.info('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ AplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o minimizada para system tray');
            const activeUi = window.deParaUI || ui;
            if (activeUi && typeof activeUi.handleAppMinimizedToTray === 'function') {
                await activeUi.handleAppMinimizedToTray();
            }
            showToast('AplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o minimizada para system tray', 'success');
        } else {
            logger.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Erro ao minimizar para system tray:', result.error);
            showToast(result.error?.message || 'Erro ao minimizar para system tray', 'error');
        }
    } catch (error) {
        logger.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao minimizar para system tray:', error);
        showToast('Erro ao minimizar para system tray', 'error');
    }
}

async function executeFileOperation() {
    const modal = document.getElementById('file-operation-modal');
    const action = modal.dataset.action;
    const sourcePath = document.getElementById('source-file-path').value.trim();
    const targetPath = document.getElementById('target-file-path').value.trim();
    const backupBefore = document.getElementById('backup-before-operation').checked;
    const overwrite = document.getElementById('overwrite-existing').checked;
    const preserveStructure = document.getElementById('preserve-structure').checked;
    const recursive = document.getElementById('recursive-operation').checked;
    const extensionsInput = document.getElementById('file-extensions').value.trim();
    const extensions = extensionsInput ? extensionsInput.split(',').map(ext => ext.trim().toLowerCase()) : null;

    if (!sourcePath) {
        showToast('Caminho de origem ÃƒÆ’Ã‚Â© obrigatÃƒÆ’Ã‚Â³rio', 'error');
        return;
    }

    if ((action === 'move' || action === 'copy') && !targetPath) {
        showToast('Caminho de destino ÃƒÆ’Ã‚Â© obrigatÃƒÆ’Ã‚Â³rio', 'error');
        return;
    }

    try {
        const requestData = {
            action,
            sourcePath,
            options: {
                backupBeforeMove: action === 'move' ? backupBefore : false,
                forceBackup: action === 'delete' ? backupBefore : false,
                overwrite,
                preserveStructure,
                recursive,
                extensions
            }
        };

        if (action === 'move' || action === 'copy') {
            requestData.targetPath = targetPath;
        }

        const response = await fetch('/api/files/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (result.success) {
            const structureMsg = preserveStructure ? ' (estrutura preservada)' : ' (estrutura achatada)';
            showToast(`OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ${action} executada com sucesso!${structureMsg}`, 'success', true);
            closeFileOperationModal();
            // Refresh relevant sections
            forceReloadScheduledOperations();
            loadBackups();
        } else {
            showToast(result.error?.message || 'Erro na operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:', error);
        showToast('Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error');
    }
}

// Schedule Modal
function legacyShowScheduleModal() {
    const modal = document.getElementById('schedule-modal');

    // Preencher com dados da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o atual se disponÃƒÆ’Ã‚Â­vel
    if (window.deParaUI && window.deParaUI.currentConfig) {
        const config = window.deParaUI.currentConfig;
        
        // Preencher campos com valores atuais
        document.getElementById('schedule-name').value = config.name || `OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ${config.operation || 'arquivo'}`;
        document.getElementById('schedule-action').value = config.operation || '';
        document.getElementById('schedule-frequency').value = '1d'; // PadrÃƒÆ’Ã‚Â£o: diariamente
        document.getElementById('schedule-source').value = config.sourcePath || '';
        document.getElementById('schedule-target').value = config.targetPath || '';
        
        // Carregar filtros de extensÃƒÆ’Ã‚Âµes corretamente
        let filtersValue = '';
        if (config.options && config.options.filters && config.options.filters.extensions) {
            filtersValue = config.options.filters.extensions.map(ext => `*.${ext}`).join(', ');
        }
        document.getElementById('schedule-filters').value = filtersValue;
        
        document.getElementById('schedule-batch').checked = true;
        document.getElementById('schedule-backup').checked = false;    } else {
        // Reset form se nÃƒÆ’Ã‚Â£o hÃƒÆ’Ã‚Â¡ configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        document.getElementById('schedule-name').value = '';
        document.getElementById('schedule-action').value = '';
        document.getElementById('schedule-frequency').value = '1d'; // PadrÃƒÆ’Ã‚Â£o: diariamente
        document.getElementById('schedule-source').value = '';
        document.getElementById('schedule-target').value = '';
        document.getElementById('schedule-filters').value = '';
        document.getElementById('schedule-batch').checked = true;
        document.getElementById('schedule-backup').checked = false;    }

    updateScheduleForm();

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

// FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o closeScheduleModal removida - usando window.closeScheduleModal

function updateScheduleForm() {
    const action = document.getElementById('schedule-action').value;
    const targetGroup = document.getElementById('schedule-target-group');

    if (action === 'delete') {
        targetGroup.style.display = 'none';
    } else {
        targetGroup.style.display = 'block';
    }
    
    // Atualizar resumo da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    updateOperationSummary();
}

function updateOperationSummary() {
    const action = document.getElementById('schedule-action').value;
    const source = document.getElementById('schedule-source').value;
    const target = document.getElementById('schedule-target').value;
    const summaryDiv = document.getElementById('operation-summary');
    
    // Mostrar resumo apenas se hÃƒÆ’Ã‚Â¡ dados suficientes
    if (action && source) {
        summaryDiv.style.display = 'block';
        
        // Atualizar conteÃƒÆ’Ã‚Âºdo do resumo
        document.getElementById('summary-action').textContent = action.toUpperCase();
        document.getElementById('summary-source').textContent = source;
        document.getElementById('summary-target').textContent = target || (action === 'delete' ? 'N/A' : 'NÃƒÆ’Ã‚Â£o definido');
    } else {
        summaryDiv.style.display = 'none';
    }
}

async function legacyScheduleOperation() {
    const modal = document.getElementById('schedule-modal');
    const isEditing = modal.dataset.editingOperationId;
    
    const name = document.getElementById('schedule-name').value.trim();
    const action = document.getElementById('schedule-action').value;
    const frequency = document.getElementById('schedule-frequency').value;
    const sourcePath = document.getElementById('schedule-source').value.trim();
    const targetPath = document.getElementById('schedule-target').value.trim();
    const filters = document.getElementById('schedule-filters').value.trim();
    const batch = document.getElementById('schedule-batch').checked;
    const backup = document.getElementById('schedule-backup').checked;
    const preserveStructure = document.getElementById('schedule-preserve-structure').checked;
    if (!name || !action || !frequency || !sourcePath) {
        showToast('Preencha todos os campos obrigatÃƒÆ’Ã‚Â³rios', 'error');
        return;
    }

    if ((action === 'move' || action === 'copy') && !targetPath) {
        showToast('Caminho de destino ÃƒÆ’Ã‚Â© obrigatÃƒÆ’Ã‚Â³rio', 'error');
        return;
    }

    try {
        // Gerar ID correto baseado no contexto
        let operationId;
        if (isEditing) {
            // EdiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: usar ID existente
            operationId = isEditing;
        } else {
            // CriaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nova: gerar novo ID
            operationId = `ui_${Date.now()}`;
        }
        
        const requestData = {
            operationId,
            name,
            frequency,
            action,
            sourcePath,
            options: {
                batch,
                backupBeforeMove: action === 'move' ? backup : false,
                forceBackup: action === 'delete' ? backup : false,
                preserveStructure
            }
        };

        if (action === 'move' || action === 'copy') {
            requestData.targetPath = targetPath;
        }

        // Processar filtros - sempre criar objeto filters, mesmo se vazio
        if (filters && filters.trim()) {
            // Filtro especificado - processar extensÃƒÆ’Ã‚Âµes
            requestData.options.filters = {
                extensions: filters.split(',').map(ext => ext.trim().replace('*.', ''))
            };
        } else {
            // Filtro vazio - nÃƒÆ’Ã‚Â£o aplicar filtros (aceitar todos os arquivos)
            requestData.options.filters = {};
        }

        const url = isEditing ? `/api/files/schedule/${isEditing}` : '/api/files/schedule';
        const method = isEditing ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (result.success) {
            const structureMsg = preserveStructure ? ' (estrutura preservada)' : ' (estrutura achatada)';
            const actionMsg = isEditing ? 'editada' : 'agendada';
            showToast(`OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o "${name}" ${actionMsg} com sucesso!${structureMsg}`, 'success', true);
            window.closeScheduleModal();
            forceReloadScheduledOperations();
        } else {
            const actionMsg = isEditing ? 'editar' : 'agendar';
            showToast(result.error?.message || `Erro ao ${actionMsg} operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o`, 'error', true);
        }

    } catch (error) {
        console.error('Erro ao agendar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:', error);
        showToast('Erro ao agendar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error');
    }
}

function populateScheduleModal(modal, operation = {}, mode = 'create') {
    const action = operation.action || operation.operation || '';
    const filtersValue = operation.options?.filters?.extensions
        ? operation.options.filters.extensions.map((ext) => `*.${ext}`).join(', ')
        : '';
    const backupEnabled = Boolean(operation.options?.backupBeforeMove || operation.options?.forceBackup);

    delete modal.dataset.editingOperationId;
    modal.dataset.scheduleMode = mode;
    if (mode === 'edit' && operation.id) {
        modal.dataset.editingOperationId = operation.id;
    }

    document.getElementById('schedule-name').value = operation.name || (action ? `Operação ${action}` : '');
    document.getElementById('schedule-action').value = action;
    document.getElementById('schedule-frequency').value = operation.frequency || '1d';
    document.getElementById('schedule-source').value = operation.sourcePath || '';
    document.getElementById('schedule-target').value = operation.targetPath || '';
    document.getElementById('schedule-filters').value = filtersValue;
    document.getElementById('schedule-batch').checked = Boolean(operation.options?.batch);
    document.getElementById('schedule-backup').checked = backupEnabled;
    document.getElementById('schedule-preserve-structure').checked = Boolean(operation.options?.preserveStructure);

    const modalTitle = modal.querySelector('.modal-header h3');
    const submitBtn = modal.querySelector('.schedule-operation-btn');
    const closeBtn = modal.querySelector('.close-schedule-btn');
    const cancelBtn = modal.querySelector('.cancel-schedule-btn');
    if (modalTitle) {
        modalTitle.textContent = mode === 'edit'
            ? 'Editar Operação'
            : (mode === 'duplicate' ? 'Duplicar Operação' : 'Agendar Operação');
    }
    if (submitBtn) {
        submitBtn.type = 'button';
        submitBtn.textContent = mode === 'edit'
            ? 'Salvar Alterações'
            : (mode === 'duplicate' ? 'Duplicar Operação' : 'Agendar');
        submitBtn.onclick = async (event) => {
            event.preventDefault();
            await performScheduleOperation();
        };
    }
    if (closeBtn) {
        closeBtn.onclick = (event) => {
            event.preventDefault();
            hideScheduleModal();
        };
    }
    if (cancelBtn) {
        cancelBtn.onclick = (event) => {
            event.preventDefault();
            hideScheduleModal();
        };
    }

    window.deParaUI?.clearOperationFieldErrors?.();
    try {
        updateScheduleForm();
    } catch (error) {
        console.error('Erro ao atualizar o formulário de agendamento:', error);
    }
}

// Controle de carregamento para evitar chamadas simultaneas
function openScheduleModal(options = {}) {
    const modal = document.getElementById('schedule-modal');
    if (!modal) {
        return;
    }

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    const operation = options.operation || window.deParaUI?.getOperationDraft?.() || window.deParaUI?.currentConfig || {};
    const mode = options.mode || 'create';
    populateScheduleModal(modal, operation, mode);
}

function hideScheduleModal() {
    const modal = document.getElementById('schedule-modal');
    if (!modal) {
        return;
    }

    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    delete modal.dataset.editingOperationId;
    modal.dataset.scheduleMode = 'create';

    const modalTitle = modal.querySelector('.modal-header h3');
    const submitBtn = modal.querySelector('.schedule-operation-btn');
    if (modalTitle) {
        modalTitle.textContent = 'Agendar Operação';
    }
    if (submitBtn) {
        submitBtn.textContent = 'Agendar';
    }

    window.deParaUI?.clearOperationFieldErrors?.();
}

async function performScheduleOperation() {
    const modal = document.getElementById('schedule-modal');
    const submitBtn = modal?.querySelector('.schedule-operation-btn');

    if (modal?.dataset.submittingSchedule === 'true') {
        return false;
    }

    const isEditing = modal.dataset.scheduleMode === 'edit' && modal.dataset.editingOperationId;
    const name = document.getElementById('schedule-name').value.trim();
    const action = document.getElementById('schedule-action').value;
    const frequency = document.getElementById('schedule-frequency').value;
    const sourcePath = document.getElementById('schedule-source').value.trim();
    const targetPath = document.getElementById('schedule-target').value.trim();
    const filters = document.getElementById('schedule-filters').value.trim();
    const batch = document.getElementById('schedule-batch').checked;
    const backup = document.getElementById('schedule-backup').checked;
    const preserveStructure = document.getElementById('schedule-preserve-structure').checked;

    window.deParaUI?.clearOperationFieldErrors?.();

    if (!name || !action || !frequency || !sourcePath) {
        if (!sourcePath) {
            window.deParaUI?.showFieldError?.(document.getElementById('schedule-source'), 'Origem obrigatória');
        }
        showToast(!name ? 'Defina um nome para a operação agendada.' : 'Preencha os campos obrigatórios do agendamento.', 'error');
        return false;
    }

    if ((action === 'move' || action === 'copy') && !targetPath) {
        window.deParaUI?.showFieldError?.(document.getElementById('schedule-target'), 'Destino obrigatório');
        showToast('Selecione a pasta de destino para concluir o agendamento.', 'error');
        return false;
    }

    try {
        if (modal) {
            modal.dataset.submittingSchedule = 'true';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.originalLabel = submitBtn.textContent;
            submitBtn.textContent = isEditing ? 'Salvando...' : 'Agendando...';
        }

        const requestData = {
            name,
            frequency,
            action,
            sourcePath,
            options: {
                batch,
                backupBeforeMove: action === 'move' ? backup : false,
                forceBackup: action === 'delete' ? backup : false,
                preserveStructure,
                filters: filters
                    ? { extensions: filters.split(',').map((ext) => ext.trim().replace('*.', '')).filter(Boolean) }
                    : {}
            }
        };

        if (!isEditing) {
            requestData.operationId = `ui_${Date.now()}`;
            requestData.active = true;
        }

        if (action === 'move' || action === 'copy') {
            requestData.targetPath = targetPath;
        }

        const response = await fetch(isEditing ? `/api/files/schedule/${isEditing}` : '/api/files/schedule', {
            method: isEditing ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();
        if (result.success) {
            showToast(`Operação "${name}" ${isEditing ? 'editada' : 'agendada'} com sucesso!`, 'success', true);
            hideScheduleModal();
            forceReloadScheduledOperations();
            return true;
        } else {
            showToast(result.error?.message || 'Erro ao salvar operação agendada', 'error', true);
        }
    } catch (error) {
        console.error('Erro ao agendar operação:', error);
        showToast('Erro ao agendar operação', 'error');
    } finally {
        if (modal) {
            delete modal.dataset.submittingSchedule;
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalLabel || (isEditing ? 'Salvar Alterações' : 'Agendar');
            delete submitBtn.dataset.originalLabel;
        }
    }

    return false;
}
let isLoadingTemplates = false;
let isLoadingScheduledOperations = false;
let isLoadingBackups = false;

// Controle de carregamento com debouncing
const loadingControl = {
    templates: {
        lastLoad: 0,
        debounceMs: 1000,
        isLoading: false
    },
    scheduledOperations: {
        lastLoad: 0,
        debounceMs: 1000,
        isLoading: false
    },
    backups: {
        lastLoad: 0,
        debounceMs: 1000,
        isLoading: false
    }
};

// Controle de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes simples
let isExecutingOperation = false;

// FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o helper para controle de carregamento com debouncing
function shouldLoadData(type) {
    const now = Date.now();
    const control = loadingControl[type];

    if (!control) return false;

    // Se jÃƒÆ’Ã‚Â¡ estÃƒÆ’Ã‚Â¡ carregando, nÃƒÆ’Ã‚Â£o permitir nova chamada
    if (control.isLoading) {        return false;
    }

    // Se carregou recentemente (debounce), nÃƒÆ’Ã‚Â£o permitir
    if (now - control.lastLoad < control.debounceMs) {        return false;
    }

    return true;
}

function markLoading(type, isLoading) {
    const control = loadingControl[type];
    if (control) {
        control.isLoading = isLoading;
        if (!isLoading) {
            control.lastLoad = Date.now();
        }
    }
}

// FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o helper para carregamento seguro com verificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
function safeLoadData(type, loadFunction) {
    if (shouldLoadData(type)) {        loadFunction();
    } else {    }
}

// Load Templates
async function loadTemplates() {
    // Usar novo sistema de controle
    if (!shouldLoadData('templates')) {
        return;
    }
    markLoading('templates', true);

    try {        const response = await fetch('/api/files/templates');
        const result = await response.json();
        if (result.success && result.data) {
            // Usar categories diretamente se existir, senÃƒÆ’Ã‚Â£o usar array vazio
            const categories = result.data.categories || [];            renderTemplates(categories);
        } else {
            console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Resposta da API nÃƒÆ’Ã‚Â£o contÃƒÆ’Ã‚Â©m dados vÃƒÆ’Ã‚Â¡lidos');
            renderTemplates([]);
        }
    } catch (error) {
        console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao carregar templates:', error);
        renderTemplates([]);
    } finally {
        // Sempre liberar o flag de carregamento
        markLoading('templates', false);
    }
}

function renderTemplates(categories) {
    const container = document.getElementById('template-categories');

    if (!container) {
        console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Container de templates nÃƒÆ’Ã‚Â£o encontrado');
        return;
    }
    // Verificar se categories ÃƒÆ’Ã‚Â© um array
    if (!Array.isArray(categories)) {
        console.warn('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Categories nÃƒÆ’Ã‚Â£o ÃƒÆ’Ã‚Â© um array:', categories);
        categories = [];
    }

    container.innerHTML = '';

    categories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'template-category';

        // Verificar se templates existe e ÃƒÆ’Ã‚Â© um array
        const templates = category.templates || [];
        const templatesHtml = Array.isArray(templates) ? templates.map(template => `
                    <div class="template-card" onclick="applyTemplate('${template.category}', '${template.templateName}')">
                        <h5>${template.name}</h5>
                        <p>${template.description}</p>
                        <div class="template-actions">
                            <button class="btn btn-sm btn-primary">Aplicar</button>
                        </div>
                    </div>
                `).join('') : '<p class="no-templates">Nenhum template disponÃƒÆ’Ã‚Â­vel</p>';

        categoryDiv.innerHTML = `
            <div class="category-header">
                <h4>${category.title}</h4>
                <p>${category.description}</p>
            </div>
            <div class="category-templates">
                ${templatesHtml}
            </div>
        `;
        container.appendChild(categoryDiv);
    });
}

async function applyTemplate(category, name) {
    try {
        const response = await fetch(`/api/files/templates/${category}/${name}/apply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const result = await response.json();

        if (result.success) {
            showToast(`Template "${result.data.template}" aplicado com sucesso!`, 'success', true);
            forceReloadScheduledOperations();
        } else {
            showToast(result.error?.message || 'Erro ao aplicar template', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao aplicar template:', error);
        showToast('Erro ao aplicar template', 'error');
    }
}

// Load Progress of Active Operations
async function loadProgress() {
    try {
        const response = await fetch('/api/files/progress');
        
        if (!response.ok) {
            // Se a resposta nÃƒÆ’Ã‚Â£o for OK, nÃƒÆ’Ã‚Â£o logar erro (pode ser normal)
            return;
        }
        
        const result = await response.json();

        if (result.success) {
            renderProgress(result.data);
        }
    } catch (error) {
        // SÃƒÆ’Ã‚Â³ logar erro se nÃƒÆ’Ã‚Â£o for erro de conexÃƒÆ’Ã‚Â£o (que ÃƒÆ’Ã‚Â© normal quando nÃƒÆ’Ã‚Â£o hÃƒÆ’Ã‚Â¡ operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes ativas)
        if (!error.message.includes('Failed to fetch') && !error.message.includes('ERR_CONNECTION_REFUSED')) {
            console.error('Erro ao carregar progresso:', error);
        }
    }
}

function renderProgress(operations) {
    const container = document.getElementById('progress-list');

    if (operations.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o em andamento</p>';
        return;
    }

    container.innerHTML = operations.map(op => {
        const isError = op.percentage < 0;
        const isCompleted = op.percentage === 100;
        const progressClass = isError ? 'progress-error' :
                             isCompleted ? 'progress-completed' : '';

        return `
            <div class="progress-item ${progressClass}">
                <div class="progress-header">
                    <span class="progress-title">${op.operationId}</span>
                    <span class="progress-percentage">
                        ${isError ? 'Erro' : isCompleted ? 'ConcluÃƒÆ’Ã‚Â­do' : `${op.percentage}%`}
                    </span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${Math.max(0, op.percentage)}%"></div>
                </div>
                <div class="progress-message">${op.message}</div>
            </div>
        `;
    }).join('');
}

// Load Scheduled Operations
async function loadScheduledOperations(options = {}) {
    const force = options.force === true;
    if (!force && !shouldLoadData('scheduledOperations')) {
        return;
    }
    markLoading('scheduledOperations', true);

    try {
        const response = await fetch('/api/files/scheduled');
        const result = await response.json();

        if (result.success) {
            renderScheduledOperations(result.data);
        }
    } catch (error) {
        console.error('Erro ao carregar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes agendadas:', error);
    } finally {
        // Sempre liberar o flag de carregamento
        markLoading('scheduledOperations', false);
    }
}

function renderScheduledOperations(operations) {
    const container = document.getElementById('scheduled-operations-list');

    if (operations.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o agendada</p>';
        return;
    }

    container.innerHTML = operations.map(op => {
        return `
        <div class="operation-item ${op.active ? 'active' : 'paused'}">
            <div class="operation-info">
                <h4>${op.name || `${op.action.toUpperCase()} - ${op.frequency}`}</h4>
                <p class="operation-details">${op.action.toUpperCase()} - ${op.frequency}</p>
                <p><strong>Origem:</strong> ${op.sourcePath}</p>
                ${op.targetPath ? `<p><strong>Destino:</strong> ${op.targetPath}</p>` : ''}
                <p><strong>Status:</strong> ${op.active ? 'Ativa' : 'Pausada'}</p>
            </div>
            <div class="operation-actions">
                <button class="btn btn-sm btn-primary edit-scheduled-operation-btn" data-operation-id="${op.id}" title="Editar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o">
                    <span class="material-icons">edit</span>
                </button>
                <button class="btn btn-sm btn-info duplicate-scheduled-operation-btn" data-operation-id="${op.id}" title="Duplicar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o">
                    <span class="material-icons">content_copy</span>
                </button>
                <button class="btn btn-sm btn-success execute-scheduled-operation-btn" data-operation-id="${op.id}" title="Executar agora">
                    <span class="material-icons">play_arrow</span>
                </button>
                <button class="btn btn-sm btn-warning toggle-scheduled-operation-btn" data-operation-id="${op.id}" data-active="${op.active}" title="${op.active ? 'Pausar' : 'Retomar'} operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o">
                    <span class="material-icons">${op.active ? 'pause' : 'play_arrow'}</span>
                </button>
                <button class="btn btn-sm btn-danger cancel-scheduled-operation-btn" data-operation-id="${op.id}" title="Cancelar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </div>
    `;
    }).join('');
}

async function cancelScheduledOperation(operationId) {
    try {
        const response = await fetch(`/api/files/schedule/${operationId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast('OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o cancelada com sucesso!', 'success', true);
            forceReloadScheduledOperations();
        } else {
            showToast(result.error?.message || 'Erro ao cancelar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao cancelar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:', error);
        showToast('Erro ao cancelar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error');
    }
}

// Executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o agendada imediatamente
async function executeScheduledOperation(operationId) {
    if (!operationId) {
        console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ ID da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nÃƒÆ’Ã‚Â£o fornecido');
        return;
    }

    try {
        const response = await fetch(`/api/files/schedule/${operationId}/execute`, {
            method: 'POST'
        });

        if (response.ok) {
            const result = await response.json();
            
            if (result.success) {
                showToast(`OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o executada com sucesso! ${result.message || ''}`, 'success', true);
                
                // Recarregar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes agendadas para mostrar status atualizado
                if (typeof loadScheduledOperations === 'function') {
                    forceReloadScheduledOperations();
                }
            } else {
                throw new Error(result.error || 'Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o');
            }
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:', error);
        showToast('Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: ' + error.message, 'error', true);
    }
}

// Pausar/Retomar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o agendada
async function toggleScheduledOperation(operationId) {
    if (!operationId) {
        console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ ID da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nÃƒÆ’Ã‚Â£o fornecido');
        return;
    }

    try {
        // Primeiro, obter o status atual da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        const response = await fetch(`/api/files/schedule/${operationId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Erro ao obter operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o');
        }

        const currentStatus = result.data.active;
        const newStatus = !currentStatus;

        // Atualizar o status
        const updateResponse = await fetch(`/api/files/schedule/${operationId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: newStatus })
        });

        if (updateResponse.ok) {
            const updateResult = await updateResponse.json();
            if (updateResult.success) {
                showToast(`OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ${newStatus ? 'retomada' : 'pausada'} com sucesso!`, 'success', true);
                // Recarregar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes agendadas
                forceReloadScheduledOperations();
            } else {
                throw new Error(updateResult.error || 'Erro ao atualizar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o');
            }
        } else {
            throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}`);
        }
    } catch (error) {
        console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao alterar status da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:', error);
        showToast('Erro ao alterar status da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: ' + error.message, 'error', true);
    }
}

// Editar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o agendada
// Editar operação agendada
async function editScheduledOperation(operationId) {
    try {
        const response = await fetch(`/api/files/schedule/${operationId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error?.message || 'Erro ao obter operação');
        }

        showEditOperationModal(result.data);
    } catch (error) {
        console.error('Erro ao obter operação para edição:', error);
        showToast('Erro ao carregar operação para edição: ' + error.message, 'error', true);
    }
}

function showEditOperationModal(operation) {
    openScheduleModal({ operation, mode: 'edit' });
}

// Duplicar operação agendada
async function duplicateScheduledOperation(operationId) {
    try {
        const response = await fetch(`/api/files/schedule/${operationId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error?.message || 'Erro ao obter operação');
        }

        const duplicatedOperation = {
            ...result.data,
            id: undefined,
            name: `${result.data.name} (Cópia)`
        };

        showDuplicateOperationModal(duplicatedOperation);
    } catch (error) {
        console.error('Erro ao obter operação para duplicação:', error);
        showToast('Erro ao carregar operação para duplicação: ' + error.message, 'error', true);
    }
}

function showDuplicateOperationModal(operation) {
    openScheduleModal({ operation, mode: 'duplicate' });
}

// Load Backups
async function loadBackups() {
    if (!shouldLoadData('backups')) {
        return;
    }
    markLoading('backups', true);

    try {
        const response = await fetch('/api/files/backups');
        const result = await response.json();

        if (result.success) {
            renderBackups(result.data);
        }
    } catch (error) {
        console.error('Erro ao carregar backups:', error);
    } finally {
        markLoading('backups', false);
    }
}

async function exportOperationalConfig() {
    try {
        const response = await fetch('/api/config/export');
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Falha ao exportar backup operacional');
        }

        const backup = result.data;
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = downloadUrl;
        link.download = `depara-operational-backup-${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        showToast('Backup operacional exportado com sucesso!', 'success', true);
    } catch (error) {
        console.error('Erro ao exportar backup operacional:', error);
        showToast(error.message || 'Erro ao exportar backup operacional', 'error', true);
    }
}

async function importOperationalConfig() {
    const fileInput = document.getElementById('operational-config-file');
    const file = fileInput?.files?.[0];

    if (!file) {
        showToast('Selecione um arquivo JSON para importar.', 'warning', true);
        return;
    }

    const confirmed = window.confirm('A importacao substituira slideshow, screensaver, operacoes agendadas e pastas configuradas. Deseja continuar?');
    if (!confirmed) {
        return;
    }

    try {
        const rawContent = await file.text();
        const payload = JSON.parse(rawContent);

        const response = await fetch('/api/config/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Falha ao importar backup operacional');
        }

        if (window.deParaUI?.loadServerConfig) {
            await window.deParaUI.loadServerConfig();
        }
        if (window.deParaUI?.loadFolders) {
            await window.deParaUI.loadFolders();
        }
        await forceReloadScheduledOperations();
        await loadBackups();

        if (fileInput) {
            fileInput.value = '';
        }

        showToast('Backup operacional importado com sucesso!', 'success', true);
    } catch (error) {
        console.error('Erro ao importar backup operacional:', error);
        showToast(error.message || 'Erro ao importar backup operacional', 'error', true);
    }
}

function forceReloadScheduledOperations() {
    const control = loadingControl.scheduledOperations;
    if (control) {
        control.lastLoad = 0;
        control.isLoading = false;
    }
    return loadScheduledOperations({ force: true });
}

function renderBackups(backups) {
    const container = document.getElementById('backups-list');

    if (backups.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum backup encontrado</p>';
        return;
    }

    container.innerHTML = backups.slice(0, 10).map(backup => `
        <div class="backup-item">
            <div class="backup-info">
                <h4>${backup.filename}</h4>
                <p><strong>Tamanho:</strong> ${(backup.size / 1024).toFixed(1)} KB</p>
                <p><strong>Criado:</strong> ${new Date(backup.created).toLocaleString()}</p>
            </div>
        </div>
    `).join('');
}

// Initialize File Operations Tab
function initFileOperationsTab() {
    // Load data when tab is activated
    const fileopsTab = document.getElementById('fileops');

    // Create a mutation observer to detect when tab becomes active
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (fileopsTab.classList.contains('active')) {
                    // Usar carregamento seguro com controle de debouncing
                    if (typeof loadTemplates === 'function') safeLoadData('templates', loadTemplates);
                    if (typeof loadScheduledOperations === 'function') safeLoadData('scheduledOperations', loadScheduledOperations);
                    if (typeof loadBackups === 'function') safeLoadData('backups', loadBackups);
                }
            }
        });
    });

    observer.observe(fileopsTab, {
        attributes: true,
        attributeFilter: ['class']
    });

    // Load initial data (com controle de debouncing)
    setTimeout(() => {
        if (typeof loadTemplates === 'function') safeLoadData('templates', loadTemplates);
        if (typeof loadScheduledOperations === 'function') safeLoadData('scheduledOperations', loadScheduledOperations);
        if (typeof loadBackups === 'function') safeLoadData('backups', loadBackups);
    }, 100);
}

// Initialize Scheduled Operations Tab with Progress
function initScheduledOperationsTab() {
    const scheduledTab = document.getElementById('scheduled');
    let progressInterval;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (scheduledTab.classList.contains('active')) {
                    // Load data when tab becomes active (com controle)
                    safeLoadData('scheduledOperations', loadScheduledOperations);
                    loadProgress();

                    // Start auto-refresh for progress
                    if (!progressInterval) {
                        progressInterval = setInterval(() => {
                            loadProgress();
                        }, 2000); // Update every 2 seconds
                    }
                } else {
                    // Stop auto-refresh when tab becomes inactive
                    if (progressInterval) {
                        clearInterval(progressInterval);
                        progressInterval = null;
                    }
                }
            }
        });
    });

    observer.observe(scheduledTab, {
        attributes: true,
        attributeFilter: ['class']
    });

    // Load initial data (com controle)
    setTimeout(() => {
        safeLoadData('scheduledOperations', loadScheduledOperations);
        loadProgress();
    }, 100);
}

// System Notifications
let notificationsEnabled = false;

async function initNotifications() {
    // Check if notifications are supported
    if ('Notification' in window) {
        // Check current permission
        if (Notification.permission === 'granted') {
            notificationsEnabled = true;
        } else if (Notification.permission !== 'denied') {
            // Request permission
            const permission = await Notification.requestPermission();
            notificationsEnabled = permission === 'granted';
        }
    }

    // Store preference
    localStorage.setItem('notificationsEnabled', notificationsEnabled);
}

function showSystemNotification(title, body, icon = '/icon-192x192.png') {
    if (!notificationsEnabled) return;

    try {
        const notification = new Notification(title, {
            body: body,
            icon: icon,
            badge: icon,
            tag: 'depara-operation', // Group similar notifications
            requireInteraction: false,
            silent: false
        });

        // Auto close after 5 seconds
        setTimeout(() => {
            notification.close();
        }, 5000);

        // Handle click
        notification.onclick = function() {
            window.focus();
            notification.close();
        };

    } catch (error) {
        console.error('Erro ao mostrar notificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:', error);
    }
}

// Enhanced Toast notifications helper
function showToast(message, type = 'info', showSystemNotification = false) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">ÃƒÆ’Ã¢â‚¬â€</button>
    `;

    container.appendChild(toast);

    // Show system notification for important messages
    if (showSystemNotification && (type === 'success' || type === 'error')) {
        const title = type === 'success' ? 'OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ConcluÃƒÆ’Ã‚Â­da' : 'Erro na OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o';
        if (typeof showSystemNotification === 'function') {
            showSystemNotification(title, message);
        }
    }

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Enhanced operation feedback with notifications
async function executeFileOperationDirectLegacy(file, operation, destination) {
    try {
        const preserveStructure = Boolean(document.getElementById('preserve-structure-modal')?.checked);

        const requestData = {
            action: operation,
            sourcePath: file.path || file.name, // Para arquivos do drag & drop, pode nÃƒÆ’Ã‚Â£o ter path
            options: {
                preserveStructure,
                batch: false
            }
        };

        if (operation !== 'delete') {
            requestData.targetPath = destination;
        }

        const response = await fetch('/api/files/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (result.success) {
            const structureMsg = preserveStructure ? ' (estrutura preservada)' : ' (estrutura achatada)';
            showToast(`OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ${operation} executada com sucesso!${structureMsg}`, 'success', true);

            // Fecha modal se existir
            const modal = document.querySelector('.modal');
            if (modal) modal.remove();

            // Limpa preview
            clearFilePreview();
        } else {
            showToast(result.error?.message || 'Erro na operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:', error);
        showToast('Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error', true);
    }
}

// Backup Configuration
async function updateBackupConfig() {
    const backupDir = document.getElementById('backup-dir').value.trim();
    const retentionDays = parseInt(document.getElementById('retention-days').value);
    const enabled = document.getElementById('backup-enabled').checked;

    try {
        const config = {
            enabled,
            retentionDays
        };

        if (backupDir) {
            config.backupDir = backupDir;
        }

        const response = await fetch('/api/files/backup-config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        const result = await response.json();

        if (result.success) {
            showToast('ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de backup atualizadas!', 'success', true);
            loadBackups();
        } else {
            showToast(result.error?.message || 'Erro ao atualizar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao atualizar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de backup:', error);
        showToast('Erro ao atualizar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de backup', 'error');
    }
}

// Load backup configuration into form
async function loadBackupConfig() {
    try {
        const response = await fetch('/api/files/backup-config');
        const result = await response.json();

        if (result.success) {
            const config = result.data;
            document.getElementById('backup-dir').value = config.backupDir || '';
            document.getElementById('retention-days').value = config.retentionDays || 30;
            document.getElementById('backup-enabled').checked = config.enabled !== false;
        }
    } catch (error) {
        console.error('Erro ao carregar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de backup:', error);
    }
}

// ==========================================
// DRAG & DROP FUNCTIONALITY
// ==========================================

let draggedFiles = [];
let currentOperation = null;

function initDragAndDrop() {
    const dropZone = document.getElementById('drag-drop-zone');
    const fileSelector = document.getElementById('file-selector');

    if (!dropZone) return;

    // Event listeners para drag & drop
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Event listener para seletor de arquivos
    fileSelector.addEventListener('change', handleFileSelect);}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();

    const dropZone = document.getElementById('drag-drop-zone');
    dropZone.classList.add('drag-over');

    // Feedback visual
    e.dataTransfer.dropEffect = 'copy';
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();

    const dropZone = document.getElementById('drag-drop-zone');
    // SÃƒÆ’Ã‚Â³ remove a classe se o mouse saiu realmente da zona
    const rect = dropZone.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        dropZone.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const dropZone = document.getElementById('drag-drop-zone');
    dropZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        handleFiles(files);
    }
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        handleFiles(files);
    }
}

function handleFiles(files) {
    draggedFiles = files;
    showFilePreview(files);
}

function showFilePreview(files) {
    const dropZone = document.getElementById('drag-drop-zone');
    const dropContent = dropZone.querySelector('.drop-zone-content');
    const dropPreview = document.getElementById('drop-preview');

    // Esconde conteÃƒÆ’Ã‚Âºdo original
    dropContent.style.display = 'none';

    // Mostra preview
    dropPreview.style.display = 'flex';
    dropPreview.innerHTML = `
        <h4>${files.length} arquivo(s) selecionado(s)</h4>
        <div class="file-preview-list">
            ${files.map((file, index) => `
                <div class="file-preview-item">
                    <span class="material-icons file-preview-icon">
                        ${getFileIcon(file.type, file.name)}
                    </span>
                    <div class="file-preview-info">
                        <h5>${file.name}</h5>
                        <p>${formatFileSize(file.size)} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ${getFileType(file.type, file.name)}</p>
                    </div>
                    <div class="file-preview-actions">
                        <button class="btn btn-sm btn-primary" onclick="selectOperationForFile(${index}, 'move')">
                            Mover
                        </button>
                        <button class="btn btn-sm btn-success" onclick="selectOperationForFile(${index}, 'copy')">
                            Copiar
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="selectOperationForFile(${index}, 'delete')">
                            Apagar
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="preview-actions" style="margin-top: 20px;">
            <button class="btn btn-secondary" onclick="clearFilePreview()">
                <span class="material-icons">clear</span>
                Limpar SeleÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
            </button>
        </div>
    `;
}

function selectOperationForFile(fileIndex, operation) {
    const file = draggedFiles[fileIndex];
    currentOperation = { file, operation };

    if (operation === 'delete') {
        // Para delete, nÃƒÆ’Ã‚Â£o precisa de destino
        showDeleteConfirmation(file);
    } else {
        // Para move/copy, precisa escolher destino
        showDestinationModal(file, operation);
    }
}

function showDeleteConfirmation(file) {
    if (confirm(`Tem certeza que deseja apagar "${file.name}"?\n\nEsta aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o criarÃƒÆ’Ã‚Â¡ um backup automÃƒÆ’Ã‚Â¡tico.`)) {
        executeFileOperationDirect(file, 'delete', null);
    }
}

function showDestinationModal(file, operation) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${operation === 'move' ? 'Mover' : 'Copiar'} Arquivo</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">ÃƒÆ’Ã¢â‚¬â€</button>
            </div>
            <div class="modal-body">
                <div class="file-info">
                    <span class="material-icons">${getFileIcon(file.type, file.name)}</span>
                    <div>
                        <h4>${file.name}</h4>
                        <p>${formatFileSize(file.size)}</p>
                    </div>
                </div>
                <div class="form-group">
                    <label>Caminho de destino:</label>
                    <input type="text" id="destination-path" placeholder="/caminho/destino" required>
                    <small class="form-help">Digite o caminho completo onde o arquivo serÃƒÆ’Ã‚Â¡ ${operation === 'move' ? 'movido' : 'copiado'}</small>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="preserve-structure-modal" checked>
                        Preservar estrutura de pastas
                    </label>
                    <small class="form-help">MantÃƒÆ’Ã‚Â©m a organizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de subpastas no destino</small>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                <button class="btn btn-primary" onclick="executeFileOperationDirect(${JSON.stringify(file).replace(/"/g, '&quot;')}, '${operation}', document.getElementById('destination-path').value)">
                    ${operation === 'move' ? 'Mover' : 'Copiar'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

async function executeFileOperationDirect(file, operation, destination) {
    try {
        const preserveStructure = Boolean(document.getElementById('preserve-structure-modal')?.checked);

        const requestData = {
            action: operation,
            sourcePath: file.path || file.name, // Para arquivos do drag & drop, pode nÃƒÆ’Ã‚Â£o ter path
            options: {
                preserveStructure,
                batch: false
            }
        };

        if (operation !== 'delete') {
            requestData.targetPath = destination;
        }

        const response = await fetch('/api/files/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (result.success) {
            showToast(`OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ${operation} executada com sucesso!`, 'success');

            // Fecha modal se existir
            const modal = document.querySelector('.modal');
            if (modal) modal.remove();

            // Limpa preview
            clearFilePreview();
        } else {
            showToast(result.error?.message || 'Erro na operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error');
        }

    } catch (error) {
        console.error('Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:', error);
        showToast('Erro ao executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error');
    }
}

function clearFilePreview() {
    const dropZone = document.getElementById('drag-drop-zone');
    const dropContent = dropZone.querySelector('.drop-zone-content');
    const dropPreview = document.getElementById('drop-preview');

    dropContent.style.display = 'flex';
    dropPreview.style.display = 'none';
    dropPreview.innerHTML = '';
    draggedFiles = [];
    currentOperation = null;
}

// Utility functions
function getFileIcon(mimeType, fileName) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'videocam';
    if (mimeType.startsWith('audio/')) return 'audiotrack';
    if (mimeType === 'application/pdf') return 'picture_as_pdf';

    // Por extensÃƒÆ’Ã‚Â£o
    const ext = fileName.split('.').pop().toLowerCase();
    switch (ext) {
        case 'txt': return 'description';
        case 'doc':
        case 'docx': return 'article';
        case 'xls':
        case 'xlsx': return 'table_chart';
        case 'zip':
        case 'rar':
        case '7z': return 'archive';
        case 'js':
        case 'py':
        case 'java':
        case 'cpp':
        case 'c': return 'code';
        default: return 'insert_drive_file';
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileType(mimeType, fileName) {
    if (mimeType) return mimeType.split('/')[0];
    return fileName.split('.').pop().toUpperCase();
}

// ==========================================
// IGNORED FILES MANAGEMENT
// ==========================================

// Show ignored patterns modal
async function showIgnoredPatterns() {
    try {
        const response = await fetch('/api/files/ignored-patterns');
        const result = await response.json();

        if (result.success) {
            showIgnoredPatternsModal(result.data);
        } else {
            showToast('Erro ao carregar padrÃƒÆ’Ã‚Âµes ignorados', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar padrÃƒÆ’Ã‚Âµes ignorados:', error);
        showToast('Erro ao carregar padrÃƒÆ’Ã‚Âµes ignorados', 'error');
    }
}

function showIgnoredPatternsModal(data) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content large-modal">
            <div class="modal-header">
                <h3>ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â Arquivos Automaticamente Ignorados</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">ÃƒÆ’Ã¢â‚¬â€</button>
            </div>
            <div class="modal-body">
                <div class="ignored-description">
                    <p><strong>Por que ignorar arquivos?</strong></p>
                    <p>Certos arquivos sÃƒÆ’Ã‚Â£o crÃƒÆ’Ã‚Â­ticos para o funcionamento do sistema e sincronizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.
                    Eles sÃƒÆ’Ã‚Â£o automaticamente ignorados para evitar:</p>
                    <ul>
                        <li>ÃƒÂ¢Ã‚ÂÃ…â€™ InterrupÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o da sincronizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do Resilio Sync</li>
                        <li>ÃƒÂ¢Ã‚ÂÃ…â€™ Problemas de compatibilidade entre sistemas</li>
                        <li>ÃƒÂ¢Ã‚ÂÃ…â€™ Processamento desnecessÃƒÆ’Ã‚Â¡rio de arquivos temporÃƒÆ’Ã‚Â¡rios</li>
                        <li>ÃƒÂ¢Ã‚ÂÃ…â€™ Conflitos com ferramentas de desenvolvimento</li>
                    </ul>
                </div>

                <div class="ignored-categories">
                    ${Object.entries(data.categories).map(([key, description]) => `
                        <div class="ignored-category">
                            <h4>${key === 'resilioSync' ? 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾' : key === 'systemFiles' ? 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â»' : 'ÃƒÂ¢Ã‚ÂÃ‚Â°'} ${description.split(' - ')[0]}</h4>
                            <p>${description}</p>
                            <div class="patterns-grid">
                                ${data.patterns[key].map(pattern => `
                                    <span class="pattern-tag">${pattern}</span>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="ignored-test">
                    <h4>ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â Testar Arquivo</h4>
                    <p>Verifique se um arquivo especÃƒÆ’Ã‚Â­fico seria ignorado:</p>
                    <div class="test-form">
                        <input type="text" id="test-file-path" placeholder="/caminho/arquivo.ext" style="flex: 1;">
                        <button class="btn btn-primary" onclick="testFileIgnore()">
                            Verificar
                        </button>
                    </div>
                    <div id="test-result" class="test-result" style="margin-top: 10px;"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Fechar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

async function testFileIgnore() {
    const filePath = document.getElementById('test-file-path').value.trim();
    const resultDiv = document.getElementById('test-result');

    if (!filePath) {
        resultDiv.innerHTML = '<span style="color: #f44336;">Digite um caminho de arquivo</span>';
        return;
    }

    // Extrair apenas o nome do arquivo
    const filename = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;

    try {
        const response = await fetch('/api/files/check-ignore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filePath,
                filename
            })
        });

        const result = await response.json();

        if (result.success) {
            const isIgnored = result.data.shouldIgnore;
            resultDiv.innerHTML = `
                <div style="padding: 10px; border-radius: 6px; background: ${isIgnored ? '#ffebee' : '#e8f5e8'}; border-left: 4px solid ${isIgnored ? '#f44336' : '#4caf50'};">
                    <strong>${isIgnored ? 'ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â« IGNORADO' : 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ PROCESSADO'}</strong><br>
                    <small>${result.data.reason}</small>
                </div>
            `;
        } else {
            resultDiv.innerHTML = '<span style="color: #f44336;">Erro ao verificar arquivo</span>';
        }

    } catch (error) {
        console.error('Erro ao testar arquivo:', error);
        resultDiv.innerHTML = '<span style="color: #f44336;">Erro ao verificar arquivo</span>';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    if (window.__deparaLegacyDomReadyDone) return;
    window.__deparaLegacyDomReadyDone = true;
    // Initialize notifications first
    await initNotifications();

    // Initialize tabs
    initFileOperationsTab();
    initScheduledOperationsTab();
    initDragAndDrop();

    // Load backup config when backups tab is activated
    const backupsTab = document.getElementById('backups');
    if (backupsTab) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (backupsTab.classList.contains('active')) {
                        loadBackupConfig();
                        loadBackups();
                    }
                }
            });
        });
        observer.observe(backupsTab, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
});

function convertData() {
    ui.convertData();
}

function generateMapping() {
    ui.generateMapping();
}

function saveSettings() {
    ui.saveSettings();
}

// ==========================================
// SLIDESHOW FUNCTIONALITY (LEGACY - REMOVIDO)
// ==========================================
// Agora usando implementaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o da classe DeParaUI


function closeSlideshowConfigModal() {
    const modal = document.getElementById('slideshow-config-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

function resetSlideshowFolderForm() {
    // NÃƒÆ’Ã‚Â£o limpar o campo de pasta se houver uma pasta salva
    const savedPath = window.deParaUI?.getSlideshowSelectedPath?.() || '';
    if (!savedPath) {
        document.getElementById('slideshow-folder-path').value = '';
    }
    
    document.getElementById('slideshow-max-depth').value = '3';

    // Resetar checkboxes de extensÃƒÆ’Ã‚Âµes
    const extensionCheckboxes = document.querySelectorAll('.extension-selector input[type="checkbox"]');
    extensionCheckboxes.forEach(checkbox => {
        const isDefaultChecked = ['jpg', 'jpeg', 'png', 'gif'].includes(checkbox.value);
        checkbox.checked = isDefaultChecked;
    });
}

async function startSlideshow() {
    // Usar a implementaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o da classe DeParaUI
    if (window.deParaUI) {
        window.deParaUI.startSlideshowFromModal();
    } else {
        console.error('DeParaUI nÃƒÆ’Ã‚Â£o estÃƒÆ’Ã‚Â¡ disponÃƒÆ’Ã‚Â­vel');
        showToast('Erro: Interface nÃƒÆ’Ã‚Â£o inicializada', 'error');
    }
}








// ==========================================
// END SLIDESHOW FUNCTIONALITY
// ==========================================

// InicializaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
let ui;
document.addEventListener('DOMContentLoaded', () => {
    if (window.__deparaMainInitDone) return;
    window.__deparaMainInitDone = true;
    ui = new DeParaUI();

    // ApÃƒÆ’Ã‚Â³s inicializar, definir funÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes globais
    setTimeout(() => {
        // Tornar UI disponÃƒÆ’Ã‚Â­vel globalmente primeiro
        window.deParaUI = ui;

        // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o global para limpar busca
        window.clearSearchGlobal = function() {
            if (window.deParaUI) {
                window.deParaUI.clearSearch();
            }
        };

        // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes globais para onboarding
        window.closeOnboarding = function() {
            if (window.deParaUI) {
                window.deParaUI.closeOnboarding();
            }
        };

        window.quickSetup = function() {
            if (window.deParaUI) {
                window.deParaUI.quickSetup();
            }
        };

        // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o rÃƒÆ’Ã‚Â¡pida de pastas
        window.createQuickFolder = function(type) {
            if (window.deParaUI) {
                window.deParaUI.createQuickFolder(type);
            }
        };

        window.showFolderManager = function() {
            if (window.deParaUI) {
                window.deParaUI.openFolderManager();
            }
        };

        window.refreshFolders = function() {
            if (window.deParaUI) {
                window.deParaUI.refreshFoldersList();
            }
        };

            // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes auxiliares globais
        window.editFolder = function(folderId) {
            if (window.deParaUI) {
                window.deParaUI.editFolder(folderId);
            }
        };

        window.deleteFolder = function(folderId) {
            if (window.deParaUI) {
                window.deParaUI.deleteFolder(folderId);
            }
        };

        // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes para botÃƒÆ’Ã‚Âµes de dashboard
        window.refreshCharts = function() {
            if (window.deParaUI) {
                window.deParaUI.updateCharts();
            }
        };

        window.clearSearch = function() {
            if (window.deParaUI) {
                window.deParaUI.clearSearch();
            }
        };

        window.showScheduleModal = function(options = {}) {
            return openScheduleModal(options);
        };

        // Funções para backups (já existem como globais, não precisamos recriar)
        // loadBackups() e updateBackupConfig() já estão definidos como funções globais
        // Vamos apenas garantir que elas sejam acessíveis

        // Funções para configurações
        window.showIgnoredPatterns = function() {
            // Chamar diretamente a função global showIgnoredPatterns
            if (typeof showIgnoredPatterns === 'function') {
                showIgnoredPatterns();
            }
        };

        window.saveSettings = function() {
            // Chamar o método da classe DeParaUI
            if (window.deParaUI && typeof window.deParaUI.saveSettings === 'function') {
                window.deParaUI.saveSettings();
            }
        };

        // Funções para workflows (todas são funções globais)
        window.closeWorkflowModal = function() {
            if (typeof closeWorkflowModal === 'function') {
                closeWorkflowModal();
            }
        };

        window.previousWorkflowStep = function() {
            if (typeof previousWorkflowStep === 'function') {
                previousWorkflowStep();
            }
        };

        window.nextWorkflowStep = function() {
            if (typeof nextWorkflowStep === 'function') {
                nextWorkflowStep();
            }
        };

        window.saveWorkflow = function() {
            if (typeof saveWorkflow === 'function') {
                saveWorkflow();
            }
        };

        // Funções para gerenciamento de pastas (todas são funções globais)
        window.closeFolderManagerModal = function() {
            if (typeof closeFolderManagerModal === 'function') {
                closeFolderManagerModal();
            }
        };

        window.saveFolder = function() {
            if (typeof saveFolder === 'function') {
                saveFolder();
            }
        };

        // Funções para operações de arquivo (já existem como globais, não precisamos recriar)
        // closeFileOperationModal() e executeFileOperation() já estão definidos como funções globais

        // Funções para agendamento (todas são funções globais)
        window.closeScheduleModal = function() {
            return hideScheduleModal();
        };

        window.scheduleOperation = async function() {
            return performScheduleOperation();
        };

        // Funções para slideshow (todas são funções globais)
        window.closeSlideshowFolderModal = function() {
            const modal = document.getElementById('slideshow-folder-modal');
            if (modal) {
                modal.style.display = 'none';
                document.body.classList.remove('modal-open');            }
        };

        // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o startSlideshow removida - usando implementaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o da classe DeParaUI
        // window.startSlideshow agora ÃƒÆ’Ã‚Â© apenas um alias para window.deParaUI.startSlideshowFromModal()

        // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de slideshow (estas sÃƒÆ’Ã‚Â£o mÃƒÆ’Ã‚Â©todos da classe DeParaUI)
        window.previousImage = function() {
            if (window.deParaUI && typeof window.deParaUI.previousSlide === 'function') {
                window.deParaUI.previousSlide();
            }
        };

        window.nextImage = function() {
            if (window.deParaUI && typeof window.deParaUI.nextSlide === 'function') {
                window.deParaUI.nextSlide();
            }
        };

        window.closeSlideshow = function() {
            if (window.deParaUI && typeof window.deParaUI.closeSlideshowViewer === 'function') {
                window.deParaUI.closeSlideshowViewer();
            }
        };

        // Adicionar event listeners para botÃƒÆ’Ã‚Âµes (evita CSP violation)
        ui.addOnboardingEventListeners();
        ui.setupAdditionalEventListeners();
    }, 100);
});

// FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para substituir caminhos dinÃƒÆ’Ã‚Â¢micos baseados na plataforma
function updateDynamicPaths() {
    const isWindows = navigator.userAgent.indexOf('Windows') > -1;
    const defaultPicturesPath = isWindows ? 'C:\\Users\\User\\Pictures' : '/home/yo/Pictures';
    const slideshowInput = document.getElementById('slideshow-folder-path');

    if (!slideshowInput) {
        return;
    }

    slideshowInput.placeholder = defaultPicturesPath;
    const savedPath = window.deParaUI?.getSlideshowSelectedPath?.() || localStorage.getItem('slideshowSelectedPath');
    if (savedPath && savedPath.trim()) {
        slideshowInput.value = savedPath.trim();
    } else if (!slideshowInput.value || !slideshowInput.value.trim()) {
        slideshowInput.value = defaultPicturesPath;
    }
}

// Executar quando o DOM estiver carregado (jÃƒÆ’Ã‚Â¡ feito em updateSimplePaths)

// ===========================================
// FUNÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES DE OPERAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES SIMPLES DE ARQUIVOS
// ===========================================

// Executar operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o simples
async function executeSimpleOperation(action) {
    if (isExecutingOperation) {
        showToast('OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o jÃƒÆ’Ã‚Â¡ em andamento. Aguarde...', 'warning');
        return;
    }

    const sourcePath = document.getElementById('source-path').value.trim();
    const destPath = document.getElementById('dest-path').value.trim();
    const recursive = document.getElementById('recursive-option').checked;
    const backup = document.getElementById('backup-option').checked;

    // ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o bÃƒÆ’Ã‚Â¡sica
    if (!sourcePath) {
        showToast('Digite o caminho de origem', 'error');
        return;
    }

    if ((action === 'move' || action === 'copy') && !destPath) {
        showToast('Digite o caminho de destino', 'error');
        return;
    }

    // Mostrar resultado da operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    const resultDiv = document.getElementById('operation-result');
    const resultIcon = document.getElementById('result-icon');
    const resultText = document.getElementById('result-text');

    resultDiv.style.display = 'block';
    resultIcon.textContent = 'hourglass_empty';
    resultText.textContent = 'Executando operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o...';

    // Desabilitar botÃƒÆ’Ã‚Âµes durante execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    setOperationButtonsDisabled(true);
    isExecutingOperation = true;

    try {
        const options = {
            batch: recursive,
            backupBeforeMove: backup,
            preserveStructure: true
        };
        let response;
        if (action === 'delete') {
            response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: action,
                    sourcePath: sourcePath,
                    options: options
                })
            });
        } else {
            response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: action,
                    sourcePath: sourcePath,
                    targetPath: destPath,
                    options: options
                })
            });
        }

        const result = await response.json();

        if (response.ok && result.success) {
            resultIcon.textContent = 'check_circle';
            resultText.textContent = `ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ${action} executada com sucesso!`;
            showToast(`OperaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ${action} concluÃƒÆ’Ã‚Â­da!`, 'success');

            // Atualizar atividades recentes
            if (typeof loadRecentActivities === 'function') {
                loadRecentActivities();
            }
        } else {
            resultIcon.textContent = 'error';
            resultText.textContent = `ÃƒÂ¢Ã‚ÂÃ…â€™ Erro: ${result.error?.message || 'Erro desconhecido'}`;
            showToast(result.error?.message || 'Erro na operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o', 'error');
        }

    } catch (error) {
        console.error('Erro na operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:', error);
        resultIcon.textContent = 'error';
        resultText.textContent = `ÃƒÂ¢Ã‚ÂÃ…â€™ Erro de conexÃƒÆ’Ã‚Â£o: ${error.message}`;
        showToast('Erro de conexÃƒÆ’Ã‚Â£o com o servidor', 'error');
    } finally {
        // Reabilitar botÃƒÆ’Ã‚Âµes
        setOperationButtonsDisabled(false);
        isExecutingOperation = false;
    }
}

// Desabilitar/Habilitar botÃƒÆ’Ã‚Âµes de operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
function setOperationButtonsDisabled(disabled) {
    const buttons = ['move-btn', 'copy-btn', 'delete-btn'];
    buttons.forEach(btnId => {
        const button = document.getElementById(btnId);
        if (button) {
            button.disabled = disabled;
            button.style.opacity = disabled ? '0.6' : '1';
        }
    });
}

// Navegar para caminho de origem
function browseSourcePath() {
    if (window.deParaUI && typeof window.deParaUI.showFolderBrowser === 'function') {
        window.deParaUI.showFolderBrowser('source');
    } else {
        console.warn('FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o showFolderBrowser nÃƒÆ’Ã‚Â£o encontrada');
        // Fallback: apenas focar no input
        const input = document.getElementById('source-path');
        if (input) {
            input.focus();
            input.select();
        }
    }
}

// Navegar para caminho de destino
function browseDestPath() {
    if (window.deParaUI && typeof window.deParaUI.showFolderBrowser === 'function') {
        window.deParaUI.showFolderBrowser('target');
    } else {
        console.warn('FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o showFolderBrowser nÃƒÆ’Ã‚Â£o encontrada');
        // Fallback: apenas focar no input
        const input = document.getElementById('dest-path');
        if (input) {
            input.focus();
            input.select();
        }
    }
}

// Atualizar caminhos baseados na plataforma (versÃƒÆ’Ã‚Â£o simplificada)
function updateSimplePaths() {
    const isWindows = navigator.userAgent.indexOf('Windows') > -1;
    const userName = 'user'; // Valor padrÃƒÆ’Ã‚Â£o simples

    const sourceInput = document.getElementById('source-path');
    const destInput = document.getElementById('dest-path');

    if (sourceInput && sourceInput.value.includes('/home/user')) {
        sourceInput.value = isWindows ?
            'C:\\Users\\User\\Documents\\origem' :
            '/home/user/Documents/origem';
    }

    if (destInput && destInput.value.includes('/home/user')) {
        destInput.value = isWindows ?
            'C:\\Users\\User\\Documents\\destino' :
            '/home/user/Documents/destino';
    }
}

// Inicializar caminhos quando a pÃƒÆ’Ã‚Â¡gina carregar
document.addEventListener('DOMContentLoaded', function() {
    if (window.__deparaSimplePathsInitDone) return;
    window.__deparaSimplePathsInitDone = true;
    updateSimplePaths();
});

// Adicionar animaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }

    /* Estilos para operaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes simples */
    .file-operations-form {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .file-operations-form .form-group {
        margin: 0;
    }

    .file-operations-form .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        color: #333;
    }

    .file-operations-form .input-group {
        display: flex;
        gap: 8px;
    }

    .file-operations-form .input-group .form-input {
        flex: 1;
    }

    .file-operations-form .input-group .btn {
        flex-shrink: 0;
        padding: 8px;
        min-width: 36px;
    }

    .operation-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .operation-buttons .btn {
        flex: 1;
        min-width: 100px;
    }

    .checkbox-group {
        display: flex;
        gap: 15px;
        flex-wrap: wrap;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
    }

    .operation-result {
        padding: 12px;
        border-radius: 6px;
        background: #f8f9fa;
        border: 1px solid #e9ecef;
    }

    .result-content {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .result-content .material-icons {
        font-size: 20px;
    }

    .result-content.success {
        background: #d4edda;
        border-color: #c3e6cb;
        color: #155724;
    }

    .result-content.error {
        background: #f8d7da;
        border-color: #f5c6cb;
        color: #721c24;
    }
`;
document.head.appendChild(style);
