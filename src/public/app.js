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

class Logger {
    constructor() {
        this.enableDebug = localStorage.getItem('depara-debug') === 'true';
        this.logLevel = localStorage.getItem('depara-log-level') || 'info';
        this.maxLogs = 100;
        this.logs = [];
    }

    log(level, message, meta = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            meta,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Adicionar ao histÃƒÂ³rico
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Log no console com emoji e cores (alto volume apenas em modo debug)
        const emoji = this.getLevelEmoji(level);
        const color = this.getLevelColor(level);
        const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
        const consoleLine = `${color}${emoji} [${level.toUpperCase()}] ${message}${metaStr}${this.resetColor()}`;
        if (level === 'error') {
            console.error(consoleLine);
        } else if (level === 'warn') {
            console.warn(consoleLine);
        } else if (this.enableDebug) {
            console.log(consoleLine);
        }

        // Enviar logs crÃƒÂ­ticos para o servidor
        if (level === 'error' || level === 'warn') {
            this.sendLogToServer(logEntry);
        }

        return logEntry;
    }

    getLevelEmoji(level) {
        const emojis = {
            error: 'Ã¢ÂÅ’',
            warn: 'Ã¢Å¡Â Ã¯Â¸Â',
            info: 'Ã¢â€žÂ¹Ã¯Â¸Â',
            debug: 'Ã°Å¸â€Â',
            success: 'Ã¢Å“â€¦'
        };
        return emojis[level] || 'Ã°Å¸â€œÂ';
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
            // Silenciar erro para nÃƒÂ£o criar loop
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

// InstÃƒÂ¢ncia global do logger
const logger = new Logger();

class DeParaUI {
    constructor() {
        this.currentTab = 'dashboard';
        this.workflows = [];
        this.folders = [];
        this.settings = {};
        this.currentWorkflowStep = 1;
        this.isExecutingOperation = false;
        this.screensaverConfig = this.getScreensaverConfig();
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
        // Carregar configuraÃƒÂ§ÃƒÂµes do slideshow
        console.log('Ã°Å¸â€Â DEBUG - Inicializando DeParaUI...');
        this.loadSlideshowConfig();
        console.log('Ã°Å¸â€Â DEBUG - ConfiguraÃƒÂ§ÃƒÂµes carregadas:', this.slideshowConfig);
        
        logger.info('Ã°Å¸Å¡â‚¬ Inicializando DePara UI...', {
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

            // Carregar configuraÃƒÂ§ÃƒÂµes
            await this.loadSettings();
            logger.success('ConfiguraÃƒÂ§ÃƒÂµes carregadas');

            // Carregar pastas
            await this.loadFolders();
            logger.success('Pastas carregadas');

            // Carregar workflows
            await this.loadWorkflows();
            logger.success('Workflows carregados');

            // Iniciar scheduler unificado de monitoramento/status/dashboard
            this.startUnifiedRefreshScheduler();
            logger.success('Scheduler unificado iniciado');

            // Testar conexÃƒÂ£o com API
            const apiOnline = await this.testApiConnection();
            if (apiOnline) {
                this.showToast('DePara iniciado com sucesso!', 'success');
                logger.success('API conectada', { apiStatus: 'online' });
            } else {
                this.showToast('API nÃƒÂ£o estÃƒÂ¡ respondendo. Verifique se o servidor estÃƒÂ¡ rodando.', 'warning');
                logger.warn('API offline', { apiStatus: 'offline' });
            }

            // Atualizar status da API imediatamente
            this.updateApiStatus();
            logger.success('Status da API sincronizado');

            // Inicializar grÃƒÂ¡ficos
            this.initializeCharts();
            logger.success('GrÃƒÂ¡ficos inicializados');

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

            // ForÃƒÂ§ar atualizaÃƒÂ§ÃƒÂ£o inicial da dashboard
            await this.updateDashboard();
            logger.success('Dashboard atualizada');

            // Mostrar onboarding se necessÃƒÂ¡rio
            if (!this.isDedicatedScreensaverWindow && !localStorage.getItem('depara-onboarding-completed')) {
                setTimeout(() => this.showOnboarding(), 1000);
            }

            // Configurar event listeners para substituir violaÃƒÂ§ÃƒÂµes de CSP
            this.setupCSPSafeEventListeners();

            // Configurar validaÃƒÂ§ÃƒÂ£o de operaÃƒÂ§ÃƒÂµes
            this.setupOperationValidation();

            // Garantir que o campo de origem esteja sempre visÃƒÂ­vel
            this.ensureSourceFieldVisible();
            
            // Carregar pasta salva do slideshow
            this.loadSlideshowSavedPath();
            if (this.isDedicatedScreensaverWindow) {
                await this.activateScreensaver({ forceLocal: true });
            }

            const initDuration = Date.now() - startTime;
            logger.success('Ã°Å¸Å½â€° InicializaÃƒÂ§ÃƒÂ£o completa!', {
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
            logger.error('Ã¢ÂÅ’ Erro durante inicializaÃƒÂ§ÃƒÂ£o', {
                error: error.message,
                stack: error.stack,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            });
            this.showToast('Erro na inicializaÃƒÂ§ÃƒÂ£o. Verifique o console.', 'error');
        } finally {
            // Esconder splash screen apÃƒÂ³s inicializaÃƒÂ§ÃƒÂ£o
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

    // Testa conexÃƒÂ£o com a API
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
            console.warn('Erro ao testar conexÃƒÂ£o com API:', error);
            return false;
        }
    }

    // Atualiza status da API na interface
    async updateApiStatus() {
        const apiStatusElement = document.getElementById('api-status');
        const apiStatusIconElement = document.getElementById('api-status-icon');

        if (!apiStatusElement || !apiStatusIconElement) {
            console.warn('Elementos de status da API nÃƒÂ£o encontrados');
            return;
        }

        try {
            console.log('Ã°Å¸â€Â Verificando status da API...');
            const isOnline = await this.testApiConnection();

            if (isOnline) {
                console.log('Ã¢Å“â€¦ API estÃƒÂ¡ online');
                apiStatusElement.textContent = 'Online';
                apiStatusElement.className = 'value online';
                apiStatusIconElement.textContent = 'api';
                apiStatusIconElement.className = 'material-icons online';
            } else {
                console.log('Ã¢ÂÅ’ API estÃƒÂ¡ offline');
                apiStatusElement.textContent = 'Offline';
                apiStatusElement.className = 'value offline';
                apiStatusIconElement.textContent = 'error';
                apiStatusIconElement.className = 'material-icons offline';
            }
        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao verificar status da API:', error);
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

            // Atualizar atividades recentes se estiver visÃƒÂ­vel
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
            const response = await fetch('/api/status/resources');
            if (response.ok) {
                const data = await response.json();
                this.updateSystemStatusDisplay(data);
            }
        } catch (error) {
            console.warn('Erro ao atualizar status do sistema:', error);
        }
    }

    // Atualizar atividades recentes
    async loadRecentActivities() {
        try {
            const response = await fetch('/api/files/stats');
            if (response.ok) {
                const data = await response.json();
                this.updateActivitiesDisplay(data);
            }
        } catch (error) {
            console.warn('Erro ao carregar atividades:', error);
        }
    }

    // Carregar operaÃƒÂ§ÃƒÂµes agendadas para o dashboard
    async loadDashboardScheduledOperations() {
        try {
            const response = await fetch('/api/files/scheduled');
            if (response.ok) {
                const data = await response.json();
                this.updateDashboardScheduledOperations(data.data || []);
            }
        } catch (error) {
            console.warn('Erro ao carregar operaÃƒÂ§ÃƒÂµes agendadas para dashboard:', error);
        }
    }

    // Atualizar exibiÃƒÂ§ÃƒÂ£o de operaÃƒÂ§ÃƒÂµes agendadas no dashboard
    updateDashboardScheduledOperations(operations) {
        const container = document.querySelector('#dashboard .scheduled-operations .operations-list');
        if (!container) return;

        if (operations.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhuma operaÃƒÂ§ÃƒÂ£o agendada</p>';
            return;
        }

        container.innerHTML = operations.slice(0, 5).map(op => `
            <div class="operation-item ${op.active ? 'active' : 'paused'}">
                <div class="operation-info">
                    <h4>${op.name || 'OperaÃƒÂ§ÃƒÂ£o sem nome'}</h4>
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
            container.innerHTML += `<p class="more-operations">+${operations.length - 5} operaÃƒÂ§ÃƒÂµes adicionais</p>`;
        }
    }

    // Atualizar display do status do sistema
    updateSystemStatusDisplay(data) {
        try {
            logger.debug('Ã°Å¸â€œÅ  Atualizando display de status do sistema', {
                memory: data.memory,
                disk: data.disk,
                activeOperations: data.activeOperations
            });

            // Atualizar uso de memÃƒÂ³ria
            const memoryElement = document.getElementById('memory-usage');
            if (memoryElement && data.memory) {
                const memoryUsage = data.memory.percentage || 0;
                memoryElement.textContent = `${memoryUsage}%`;
                logger.debug('Ã¢Å“â€¦ MemÃƒÂ³ria atualizada', { memoryUsage });
            }

            // Atualizar uso de disco
            const diskElement = document.getElementById('disk-usage');
            if (diskElement && data.disk && data.disk.drives) {
                const drives = data.disk.drives;
                if (drives.length > 0) {
                    // Filtrar apenas discos vÃƒÂ¡lidos (com tamanho > 0)
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
                                
                                // Adicionar ao texto principal (mÃƒÂ¡ximo 3 discos visÃƒÂ­veis)
                                if (index < 3) {
                                    if (index > 0) diskText += ' | ';
                                    diskText += `${driveUsedGB} GB / ${driveTotalGB} GB (${driveMountpoint})`;
                                }
                            });
                            
                            // Se hÃƒÂ¡ mais de 3 discos, adicionar contador
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
                logger.debug('Ã¢Å“â€¦ Disco atualizado', { drives, validDrives: drives.filter(d => d.total > 0) });
            }

            // Atualizar operaÃƒÂ§ÃƒÂµes ativas - buscar operaÃƒÂ§ÃƒÂµes agendadas
            const activeOpsElement = document.getElementById('active-ops');
            if (activeOpsElement) {
                this.updateActiveOperationsCount();
            }

        } catch (error) {
            logger.error('Ã¢ÂÅ’ Erro ao atualizar display de status', {
                error: error.message,
                stack: error.stack,
                data: data
            });
        }
    }

    // Atualizar display de atividades recentes
    updateActivitiesDisplay(data) {
        try {
            logger.debug('Ã°Å¸â€œâ€¹ Atualizando display de atividades', {
                activitiesCount: data?.activities?.length || 0,
                hasData: !!data
            });

            const activityList = document.getElementById('recent-activity');
            if (!activityList) {
                logger.warn('Ã¢Å¡Â Ã¯Â¸Â Elemento recent-activity nÃƒÂ£o encontrado');
                return;
            }

            // Se nÃƒÂ£o hÃƒÂ¡ dados ou atividades
            if (!data || !data.activities || data.activities.length === 0) {
                activityList.innerHTML = `
                    <div class="activity-item">
                        <span class="material-icons">info</span>
                        <span>Nenhuma atividade recente</span>
                    </div>
                `;
                logger.info('Ã¢â€žÂ¹Ã¯Â¸Â Nenhuma atividade para exibir');
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
            logger.success('Ã¢Å“â€¦ Atividades renderizadas', {
                activitiesCount: data.activities.length,
                displayedCount: Math.min(data.activities.length, 10)
            });

        } catch (error) {
            logger.error('Ã¢ÂÅ’ Erro ao atualizar display de atividades', {
                error: error.message,
                stack: error.stack,
                data: data
            });
        }
    }

    // Obter ÃƒÂ­cone apropriado para o tipo de atividade
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
        if (diffMins < 60) return `${diffMins}min atrÃƒÂ¡s`;
        if (diffHours < 24) return `${diffHours}h atrÃƒÂ¡s`;
        return `${diffDays}d atrÃƒÂ¡s`;
    }

    // Navegar para caminho de origem
    browseSourcePath() {
        if (typeof this.showFolderBrowser === 'function') {
            this.showFolderBrowser('source');
        } else {
            console.warn('FunÃƒÂ§ÃƒÂ£o showFolderBrowser nÃƒÂ£o encontrada');
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
            console.warn('FunÃƒÂ§ÃƒÂ£o showFolderBrowser nÃƒÂ£o encontrada');
            // Fallback: apenas focar no input
            const input = document.getElementById('dest-path');
            if (input) {
                input.focus();
                input.select();
            }
        }
    }

    // Executar operaÃƒÂ§ÃƒÂ£o simples
    async executeSimpleOperation(action) {
        if (this.isExecutingOperation) {
            this.showToast('OperaÃƒÂ§ÃƒÂ£o jÃƒÂ¡ em andamento. Aguarde...', 'warning');
            return;
        }

        const sourcePath = document.getElementById('source-path').value.trim();
        const destPath = document.getElementById('dest-path').value.trim();
        const recursive = document.getElementById('recursive-option').checked;
        const backup = document.getElementById('backup-option').checked;

        // ValidaÃƒÂ§ÃƒÂ£o bÃƒÂ¡sica
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
            // Mostrar resultado da operaÃƒÂ§ÃƒÂ£o
            const resultDiv = document.getElementById('operation-result');
            const resultIcon = document.getElementById('result-icon');
            const resultText = document.getElementById('result-text');

            if (resultDiv && resultIcon && resultText) {
                resultDiv.style.display = 'block';
                resultIcon.textContent = 'hourglass_empty';
                resultText.textContent = 'Executando operaÃƒÂ§ÃƒÂ£o...';
            }

            // Preparar dados da operaÃƒÂ§ÃƒÂ£o
            const operationData = {
                action: action,
                sourcePath: sourcePath,
                targetPath: destPath,
                recursive: recursive,
                createBackup: backup
            };

            logger.info('Ã°Å¸â€â€ž Executando operaÃƒÂ§ÃƒÂ£o', {
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
                    resultText.textContent = `OperaÃƒÂ§ÃƒÂ£o concluÃƒÂ­da com sucesso! ${result.message || ''}`;
                    resultDiv.className = 'operation-result success';
                }
                this.showToast('OperaÃƒÂ§ÃƒÂ£o executada com sucesso!', 'success');

                logger.success('Ã¢Å“â€¦ OperaÃƒÂ§ÃƒÂ£o executada com sucesso', {
                    operation: operationData.action,
                    message: result.message,
                    responseTime: Date.now() - Date.now() // TODO: calcular tempo real
                });

                // Atualizar contadores e atividades
                await this.refreshDashboardData();

            } else {
                // Erro
                const errorMsg = result.message || 'Erro desconhecido na operaÃƒÂ§ÃƒÂ£o';
                if (resultDiv && resultIcon && resultText) {
                    resultIcon.textContent = 'error';
                    resultText.textContent = `Erro: ${errorMsg}`;
                    resultDiv.className = 'operation-result error';
                }
                this.showToast(errorMsg, 'error');
                logger.error('Ã¢ÂÅ’ Erro na operaÃƒÂ§ÃƒÂ£o', {
                    operation: operationData.action,
                    error: errorMsg,
                    result: result,
                    statusCode: response.status
                });
            }

        } catch (error) {
            const errorMsg = error.message || 'Erro de conexÃƒÂ£o';

            logger.error('Ã¢ÂÅ’ Erro ao executar operaÃƒÂ§ÃƒÂ£o', {
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
            logger.debug('Ã°Å¸â€â€ž OperaÃƒÂ§ÃƒÂ£o finalizada', { operation });
        }
    }

    // Iniciar slideshow
    async startSlideshow() {
        console.log('Ã°Å¸â€Â DEBUG - startSlideshow chamada');
        console.log('Ã°Å¸â€Â DEBUG - ConfiguraÃƒÂ§ÃƒÂµes antes do slideshow:', this.slideshowConfig);
        
        const folderPath = document.getElementById('slideshow-folder-path').value.trim();

        if (!folderPath) {
            this.showToast('Digite o caminho da pasta', 'error');
            return;
        }

        // Coletar extensÃƒÂµes selecionadas
        const selectedExtensions = [];
        const extensionCheckboxes = document.querySelectorAll('.extension-selector input[type="checkbox"]:checked');
        extensionCheckboxes.forEach(checkbox => {
            selectedExtensions.push(checkbox.value);
        });

        if (selectedExtensions.length === 0) {
            this.showToast('Selecione pelo menos uma extensÃƒÂ£o de arquivo', 'error');
            return;
        }

        console.log('Ã°Å¸Å½Â¬ Iniciando slideshow:', { folderPath, selectedExtensions });

        await this.loadSlideshowImages(folderPath, selectedExtensions, true, this.slideshowConfig.interval);
        this.startSlideshowViewer();
    }

    // ValidaÃƒÂ§ÃƒÂ£o de campos com feedback visual
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
                    message = 'Nome ÃƒÂ© obrigatÃƒÂ³rio';
                } else if (value.length < 3) {
                    isValid = false;
                    message = 'Nome deve ter pelo menos 3 caracteres';
                } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(value)) {
                    isValid = false;
                    message = 'Nome contÃƒÂ©m caracteres invÃƒÂ¡lidos';
                }
                break;

            case 'path':
                if (!value) {
                    isValid = false;
                    message = 'Caminho ÃƒÂ© obrigatÃƒÂ³rio';
                } else if (!/^[a-zA-Z0-9\s\-_\/\\:.]+$/.test(value)) {
                    isValid = false;
                    message = 'Caminho contÃƒÂ©m caracteres invÃƒÂ¡lidos';
                }
                break;

            case 'email':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    isValid = false;
                    message = 'Email invÃƒÂ¡lido';
                }
                break;

            default:
                isValid = !!value;
                message = 'Campo obrigatÃƒÂ³rio';
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

    // ValidaÃƒÂ§ÃƒÂ£o de formulÃƒÂ¡rio completo
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

    // Garantir que o campo de origem esteja sempre visÃƒÂ­vel
    ensureSourceFieldVisible() {
        const sourceField = document.getElementById('source-folder-path');
        const sourceFieldParent = sourceField?.parentElement;
        
        if (sourceFieldParent) {
            sourceFieldParent.style.display = 'block';
            console.log('Ã¢Å“â€¦ Campo de origem garantido como visÃƒÂ­vel na inicializaÃƒÂ§ÃƒÂ£o');
        } else {
            console.warn('Ã¢Å¡Â Ã¯Â¸Â Campo source-folder-path nÃƒÂ£o encontrado');
        }
    }
    
    // Carregar pasta salva do slideshow
    loadSlideshowSavedPath() {
        const savedPath = localStorage.getItem('slideshowSelectedPath');
        if (savedPath) {
            const slideshowField = document.getElementById('slideshow-folder-path');
            if (slideshowField) {
                // Se o caminho salvo for relativo, converter para absoluto
                let finalPath = savedPath;
                if (!savedPath.startsWith('/') && !savedPath.match(/^[A-Za-z]:/)) {
                    const basePath = '/mnt/lytspot/@SYNC@/_@@PICZ & VIDEOS LYT @@_/_@LYT PicZ por ANO@_';
                    finalPath = `${basePath}/${savedPath}`;
                    console.log('Ã°Å¸â€â€” Caminho relativo convertido para absoluto na inicializaÃƒÂ§ÃƒÂ£o:', finalPath);
                }
                
                // Verificar se o caminho jÃƒÂ¡ contÃƒÂ©m a pasta base (evitar duplicaÃƒÂ§ÃƒÂ£o)
                if (finalPath.includes('/_@LYT PicZ por ANO@_/_@LYT PicZ por ANO@_/')) {
                    finalPath = finalPath.replace('/_@LYT PicZ por ANO@_/_@LYT PicZ por ANO@_/', '/_@LYT PicZ por ANO@_/');
                    console.log('Ã°Å¸â€Â§ Caminho duplicado corrigido na inicializaÃƒÂ§ÃƒÂ£o:', finalPath);
                }
                
                slideshowField.value = finalPath;
                console.log('Ã°Å¸â€œâ€š Pasta do slideshow carregada na inicializaÃƒÂ§ÃƒÂ£o:', finalPath);
                console.log('Ã°Å¸Å½Â¯ Busca recursiva serÃƒÂ¡ forÃƒÂ§ada para encontrar TODAS as imagens');
            }
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

    // ValidaÃƒÂ§ÃƒÂ£o em tempo real para campos de operaÃƒÂ§ÃƒÂ£o
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
                // Limpar validaÃƒÂ§ÃƒÂ£o quando usuÃƒÂ¡rio comeÃƒÂ§a a digitar
                const validationDiv = sourcePath.parentNode.querySelector('.validation-message');
                if (validationDiv) {
                    validationDiv.textContent = '';
                    validationDiv.className = 'validation-message';
                    sourcePath.classList.remove('invalid', 'valid');
                    sourcePath.parentNode.classList.remove('error');
                }
                // Atualizar estado dos botÃƒÂµes
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
                // Atualizar estado dos botÃƒÂµes
                this.updateOperationButtonsState();
            });
        }
    }

    // Feedback visual para botÃƒÂµes de operaÃƒÂ§ÃƒÂ£o
    updateOperationButtonsState() {
        const sourcePath = document.getElementById('source-path');
        const destPath = document.getElementById('dest-path');
        const operationButtons = document.querySelectorAll('.simple-operation-btn');

        const hasSourcePath = sourcePath && sourcePath.value.trim();
        const hasDestPath = destPath && destPath.value.trim();

        operationButtons.forEach(btn => {
            const operation = btn.getAttribute('data-operation');

            if (operation === 'delete') {
                // Delete sÃƒÂ³ precisa do caminho de origem
                btn.disabled = !hasSourcePath;
                btn.title = hasSourcePath ? 'Executar operaÃƒÂ§ÃƒÂ£o de exclusÃƒÂ£o' : 'Digite o caminho de origem primeiro';
            } else {
                // Move e copy precisam de origem e destino
                btn.disabled = !(hasSourcePath && hasDestPath);
                btn.title = (hasSourcePath && hasDestPath) ?
                    `Executar operaÃƒÂ§ÃƒÂ£o de ${operation}` :
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
            // Contar operaÃƒÂ§ÃƒÂµes ativas
            const scheduledResponse = await fetch('/api/files/scheduled');
            if (scheduledResponse.ok) {
                const scheduledData = await scheduledResponse.json();
                const activeOps = scheduledData.data.filter(op =>
                    op.status === 'running' || op.status === 'scheduled'
                ).length;
                document.getElementById('active-ops').textContent = activeOps;
            }
        } catch (error) {
            console.warn('Erro ao atualizar contadores:', error);
        }
    }

    // Atualizar contador de operaÃƒÂ§ÃƒÂµes ativas
    async updateActiveOperationsCount() {
        try {
            const response = await fetch('/api/files/scheduled');
            if (response.ok) {
                const data = await response.json();
                const activeOps = data.data ? data.data.length : 0;
                const activeOpsElement = document.getElementById('active-ops');
                if (activeOpsElement) {
                    activeOpsElement.textContent = activeOps;
                    logger.debug('Ã¢Å“â€¦ OperaÃƒÂ§ÃƒÂµes ativas atualizadas', { activeOps });
                }
            }
        } catch (error) {
            logger.warn('Erro ao atualizar contador de operaÃƒÂ§ÃƒÂµes ativas:', error);
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

    // Verificar se cache ÃƒÂ© vÃƒÂ¡lido
    isCacheValid(key) {
        const timestamp = this.cache.timestamps[key];
        if (!timestamp) return false;
        return (Date.now() - timestamp) < this.cacheExpiry;
    }

    // Obter dados do cache ou API
    async getCachedData(key, apiCall, useCache = true) {
        if (useCache && this.isCacheValid(key) && this.cache[key]) {
            console.log(`Usando cache para ${key}`);
            return this.cache[key];
        }

        try {
            const data = await apiCall();
            this.cache[key] = data;
            this.cache.timestamps[key] = Date.now();
            console.log(`Dados atualizados para ${key}`);
            return data;
        } catch (error) {
            console.warn(`Erro ao carregar ${key}:`, error);
            // Retornar cache antigo se disponÃƒÂ­vel
            if (this.cache[key]) {
                console.log(`Retornando cache antigo para ${key}`);
                return this.cache[key];
            }
            throw error;
        }
    }

    // Limpar cache especÃƒÂ­fico
    clearCache(key = null) {
        if (key) {
            this.cache[key] = null;
            delete this.cache.timestamps[key];
            console.log(`Cache limpo para ${key}`);
        } else {
            this.initializeCache();
            console.log('Todo cache limpo');
        }
    }

    // MÃƒÂ©todos de cache especÃƒÂ­ficos
    async loadSettingsCached() {
        return this.getCachedData('settings', async () => {
            const response = await fetch('/api/health');
            if (!response.ok) throw new Error('Erro ao carregar configuraÃƒÂ§ÃƒÂµes');
            return response.json();
        });
    }

    async loadFoldersCached() {
        return this.getCachedData('folders', async () => {
            // Simular carregamento de pastas (implementar conforme necessÃƒÂ¡rio)
            return [];
        });
    }

    async loadWorkflowsCached() {
        return this.getCachedData('workflows', async () => {
            // Simular carregamento de workflows (implementar conforme necessÃƒÂ¡rio)
            return [];
        });
    }

    async loadOperationsCached() {
        return this.getCachedData('operations', async () => {
            const response = await fetch('/api/files/scheduled');
            if (!response.ok) throw new Error('Erro ao carregar operaÃƒÂ§ÃƒÂµes');
            return response.json();
        });
    }

    async loadStatsCached() {
        return this.getCachedData('stats', async () => {
            const response = await fetch('/api/files/stats');
            if (!response.ok) throw new Error('Erro ao carregar estatÃƒÂ­sticas');
            return response.json();
        }, false); // Stats sempre frescos
    }

    // Sistema de GrÃƒÂ¡ficos
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
            // Obter dados de operaÃƒÂ§ÃƒÂµes
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
            console.warn('Erro ao atualizar grÃƒÂ¡ficos:', error);
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

        // Dados do grÃƒÂ¡fico
        const data = [
            { label: 'OperaÃƒÂ§ÃƒÂµes', value: this.chartData.operations, color: '#667eea', max: 20 },
            { label: 'MemÃƒÂ³ria', value: this.chartData.memory, color: '#764ba2', max: 100 },
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

    // FunÃƒÂ§ÃƒÂ£o global para atualizar grÃƒÂ¡ficos
    refreshCharts() {
        if (window.deParaUI) {
            window.deParaUI.updateCharts();
        }
    }

    // Sistema de Atalhos de Teclado
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ignorar se usuÃƒÂ¡rio estÃƒÂ¡ digitando em input
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            // Ctrl+S: Salvar configuraÃƒÂ§ÃƒÂµes
            if (event.ctrlKey && event.key === 's') {
                event.preventDefault();
                this.quickSave();
                this.showToast('ConfiguraÃƒÂ§ÃƒÂµes salvas!', 'success');
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

            // Alt+F: Ir para OperaÃƒÂ§ÃƒÂµes de Arquivos
            if (event.altKey && event.key === 'f') {
                event.preventDefault();
                this.switchTab('fileops');
                return;
            }

            // Alt+S: Ir para OperaÃƒÂ§ÃƒÂµes Agendadas
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

            // Alt+C: Ir para ConfiguraÃƒÂ§ÃƒÂµes
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
        console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â Entrando em fullscreen do dashboard...');
        
        const element = document.documentElement;
        
        // Tentar diferentes mÃƒÂ©todos de fullscreen
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
            console.warn('Fullscreen nÃƒÂ£o suportado neste navegador');
        }
    }

    // Sair do fullscreen do dashboard
    exitDashboardFullscreen() {
        console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â Saindo do fullscreen do dashboard...');
        
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
            console.log('Ã¢Å“â€¦ Controles de fullscreen do dashboard mostrados');
            
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
                controls.style.display = 'none';
                console.log('Ã¢Å“â€¦ Controles de fullscreen do dashboard escondidos');
            }, 300);
        }
    }

    // Fechar aplicaÃƒÂ§ÃƒÂ£o
    closeApplication() {
        console.log('Ã°Å¸Å¡Âª Fechando aplicaÃƒÂ§ÃƒÂ£o...');
        
        // Primeiro sair do fullscreen se estiver ativo
        this.exitDashboardFullscreen();
        
        // Aguardar um pouco para garantir que as operaÃƒÂ§ÃƒÂµes sejam concluÃƒÂ­das
        setTimeout(() => {
            // Tentar fechar a janela do navegador/Electron
            if (window.close) {
                window.close();
            } else if (window.electronAPI && window.electronAPI.closeApp) {
                // Se estiver rodando no Electron
                window.electronAPI.closeApp();
            } else {
                // Fallback: mostrar mensagem para o usuÃƒÂ¡rio
                alert('Para fechar a aplicaÃƒÂ§ÃƒÂ£o, use Alt+F4 ou feche a janela do navegador.');
            }
        }, 500);
    }

    // Configurar controles de fullscreen do dashboard
    setupDashboardFullscreenControls() {
        // BotÃƒÂ£o sair do fullscreen
        const exitFullscreenBtn = document.getElementById('dashboard-exit-fullscreen-btn');
        if (exitFullscreenBtn) {
            exitFullscreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â BotÃƒÂ£o sair do fullscreen do dashboard clicado');
                logger.info('BotÃƒÂ£o sair fullscreen clicado', { source: 'dashboard-controls' });
                this.exitDashboardFullscreen();
            });
            console.log('Ã¢Å“â€¦ Listener do botÃƒÂ£o exit fullscreen do dashboard adicionado');
            logger.debug('Listener do botÃƒÂ£o exit fullscreen configurado');
        } else {
            console.warn('Ã¢Å¡Â Ã¯Â¸Â BotÃƒÂ£o exit fullscreen nÃƒÂ£o encontrado');
            logger.warn('BotÃƒÂ£o exit fullscreen nÃƒÂ£o encontrado no DOM');
        }

        // BotÃƒÂ£o fechar aplicaÃƒÂ§ÃƒÂ£o
        const closeAppBtn = document.getElementById('dashboard-close-app-btn');
        if (closeAppBtn) {
            closeAppBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Ã°Å¸Å¡Âª BotÃƒÂ£o fechar aplicaÃƒÂ§ÃƒÂ£o do dashboard clicado');
                logger.info('BotÃƒÂ£o fechar aplicaÃƒÂ§ÃƒÂ£o clicado', { source: 'dashboard-controls' });
                this.closeApplication();
            });
            console.log('Ã¢Å“â€¦ Listener do botÃƒÂ£o fechar aplicaÃƒÂ§ÃƒÂ£o do dashboard adicionado');
            logger.debug('Listener do botÃƒÂ£o fechar aplicaÃƒÂ§ÃƒÂ£o configurado');
        } else {
            console.warn('Ã¢Å¡Â Ã¯Â¸Â BotÃƒÂ£o fechar aplicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrado');
            logger.warn('BotÃƒÂ£o fechar aplicaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrado no DOM');
        }

        // BotÃƒÂ£o de fullscreen no header
        const headerFullscreenBtn = document.getElementById('header-fullscreen-btn');
        if (headerFullscreenBtn) {
            headerFullscreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â BotÃƒÂ£o fullscreen do header clicado');
                this.toggleDashboardFullscreen();
            });
            console.log('Ã¢Å“â€¦ Listener do botÃƒÂ£o fullscreen do header adicionado');
        }

        // Listener para mudanÃƒÂ§as de fullscreen do dashboard
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

    // Lidar com mudanÃƒÂ§as de fullscreen do dashboard
    handleDashboardFullscreenChange() {
        console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â MudanÃƒÂ§a de fullscreen do dashboard detectada');
        
        const isFullscreen = !!(document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement || 
                               document.msFullscreenElement);
        
        console.log('Ã°Å¸â€Â Fullscreen do dashboard ativo:', isFullscreen);
        
        // Atualizar botÃƒÂ£o do header
        this.updateHeaderFullscreenButton(isFullscreen);
        
        if (isFullscreen) {
            this.showDashboardFullscreenControls();
        } else {
            this.hideDashboardFullscreenControls();
        }
    }

    // Atualizar botÃƒÂ£o de fullscreen no header
    updateHeaderFullscreenButton(isFullscreen) {
        const headerBtn = document.getElementById('header-fullscreen-btn');
        if (headerBtn) {
            const icon = headerBtn.querySelector('.material-icons');
            const text = headerBtn.querySelector('span:not(.material-icons)') || headerBtn.childNodes[headerBtn.childNodes.length - 1];
            
            if (isFullscreen) {
                // Modo fullscreen - esconder botÃƒÂ£o do header para evitar redundÃƒÂ¢ncia
                headerBtn.style.display = 'none';
                console.log('Ã°Å¸â€Â BotÃƒÂ£o de fullscreen do header escondido em modo fullscreen');
            } else {
                // Modo normal - mostrar botÃƒÂ£o do header
                headerBtn.style.display = 'flex';
                if (icon) icon.textContent = 'fullscreen';
                if (text) text.textContent = 'Tela Cheia';
                headerBtn.title = 'Alternar tela cheia (F11)';
                headerBtn.style.background = 'rgba(52,144,220,0.1)';
                headerBtn.style.borderColor = 'rgba(52,144,220,0.3)';
                console.log('Ã°Å¸â€Â BotÃƒÂ£o de fullscreen do header mostrado em modo normal');
            }
        }
    }

    // Salvar configuraÃƒÂ§ÃƒÂµes rapidamente
    async quickSave() {
        try {
            // Salvar configuraÃƒÂ§ÃƒÂµes da aba atual
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
        this.clearCache(); // Limpar cache para forÃƒÂ§ar atualizaÃƒÂ§ÃƒÂ£o
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

    getScreensaverConfig() {
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

    persistSlideshowSelectedPath(rawPath) {
        const normalizedPath = (rawPath || '').trim();
        if (!normalizedPath) return '';

        try {
            localStorage.setItem('slideshowSelectedPath', normalizedPath);
        } catch (error) {
            console.warn('Falha ao persistir pasta do slideshow:', error);
        }

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
        const localPath = localStorage.getItem('slideshowSelectedPath');
        if (localPath && localPath.trim()) return localPath.trim();
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
            { key: 'Ctrl+S', description: 'Salvar configuraÃƒÂ§ÃƒÂµes' },
            { key: 'Ctrl+R', description: 'Atualizar dados' },
            { key: 'F1', description: 'Mostrar esta ajuda' },
            { key: 'Alt+D', description: 'Ir para Dashboard' },
            { key: 'Alt+F', description: 'Ir para OperaÃƒÂ§ÃƒÂµes de Arquivos' },
            { key: 'Alt+S', description: 'Ir para OperaÃƒÂ§ÃƒÂµes Agendadas' },
            { key: 'Alt+B', description: 'Ir para Backups' },
            { key: 'Alt+C', description: 'Ir para ConfiguraÃƒÂ§ÃƒÂµes' },
            { key: 'Esc', description: 'Fechar modais' }
        ];

        let helpText = 'Ã°Å¸Å½Â¹ Atalhos de Teclado DisponÃƒÂ­veis:\n\n';
        shortcuts.forEach(shortcut => {
            helpText += `${shortcut.key.padEnd(10)} - ${shortcut.description}\n`;
        });

        alert(helpText);
    }

    // Sistema de Busca em OperaÃƒÂ§ÃƒÂµes
    filterScheduledOperations(searchTerm) {
        const searchInput = document.getElementById('scheduled-search');
        const clearButton = document.querySelector('.clear-search');
        const operationsList = document.getElementById('scheduled-operations-list');

        if (!operationsList) return;

        const operationItems = operationsList.querySelectorAll('.operation-item');

        if (searchTerm.trim() === '') {
            // Mostrar todas as operaÃƒÂ§ÃƒÂµes
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

            countElement.textContent = `Encontrados ${visibleItems.length} de ${totalItems.length} operaÃƒÂ§ÃƒÂµes`;
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

    // FunÃƒÂ§ÃƒÂ£o global para busca
    filterScheduledOperationsGlobal(searchTerm) {
        if (window.deParaUI) {
            window.deParaUI.filterScheduledOperations(searchTerm);
        }
    }

    // FunÃƒÂ§ÃƒÂµes globais serÃƒÂ£o definidas apÃƒÂ³s a inicializaÃƒÂ§ÃƒÂ£o

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

        // Tornar elemento relativo se nÃƒÂ£o for
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

    // Wrapper para funÃƒÂ§ÃƒÂµes assÃƒÂ­ncronas com loading
    async withLoading(elementId, asyncFunction, message = 'Carregando...') {
        try {
            this.showLoading(elementId, message);
            const result = await asyncFunction();
            return result;
        } finally {
            this.hideLoading(elementId);
        }
    }

    // Loading para botÃƒÂµes
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

    // Loading para formulÃƒÂ¡rios
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
        this.showToast('Tutorial pulado! VocÃƒÂª pode acessÃƒÂ¡-lo novamente pelo botÃƒÂ£o de ajuda.', 'info');
    }

    startOnboarding() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');
        this.openWorkflowConfig();
    }

    closeOnboarding() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');
        this.showToast('Tutorial fechado! Use o botÃƒÂ£o de ajuda se precisar de orientaÃƒÂ§ÃƒÂµes.', 'info');
    }

    // ConfiguraÃƒÂ§ÃƒÂ£o rÃƒÂ¡pida e automÃƒÂ¡tica
    async quickSetup() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');

        // Mostrar confirmaÃƒÂ§ÃƒÂ£o antes de criar pastas automaticamente
        const confirmed = await this.showQuickSetupConfirmation();

        if (!confirmed) {
            this.showToast('ConfiguraÃƒÂ§ÃƒÂ£o cancelada. VocÃƒÂª pode configurar manualmente.', 'info');
            return;
        }

        this.showToast('Ã°Å¸Å¡â‚¬ Criando pastas e templates...', 'info');

        try {
            // Criar pastas padrÃƒÂ£o automaticamente
            await this.createDefaultFolders();

            // Configurar templates bÃƒÂ¡sicos
            await this.createDefaultTemplates();

            this.showToast('Ã¢Å“â€¦ ConfiguraÃƒÂ§ÃƒÂ£o automÃƒÂ¡tica concluÃƒÂ­da!', 'success');

            // Mostrar modal de pastas configuradas
            this.showQuickSetupResults();

        } catch (error) {
            console.error('Erro na configuraÃƒÂ§ÃƒÂ£o rÃƒÂ¡pida:', error);
            this.showToast('Ã¢ÂÅ’ Erro na configuraÃƒÂ§ÃƒÂ£o automÃƒÂ¡tica. Configure manualmente.', 'error');
        }
    }

    // Mostrar confirmaÃƒÂ§ÃƒÂ£o antes da configuraÃƒÂ§ÃƒÂ£o automÃƒÂ¡tica
    async showQuickSetupConfirmation() {
        return new Promise((resolve) => {
            const confirmationHtml = `
                <div style="text-align: center; padding: 20px;">
                    <h3 style="color: #2196F3; margin-bottom: 15px;">Ã°Å¸â€Â§ ConfiguraÃƒÂ§ÃƒÂ£o AutomÃƒÂ¡tica</h3>
                    <p style="margin-bottom: 20px; color: #666;">
                        O sistema pode criar automaticamente pastas e templates bÃƒÂ¡sicos para vocÃƒÂª comeÃƒÂ§ar a usar imediatamente.
                    </p>

                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                        <h4 style="margin-bottom: 10px; color: #333;">Ã°Å¸â€œÂ Pastas que serÃƒÂ£o criadas:</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #555;">
                            <li><strong>Documentos Entrada</strong> - Para arquivos de entrada</li>
                            <li><strong>Documentos Processados</strong> - Para arquivos processados</li>
                            <li><strong>Backup AutomÃƒÂ¡tico</strong> - Para backups</li>
                        </ul>
                    </div>

                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                        <h4 style="margin-bottom: 10px; color: #333;">Ã¢Å¡â„¢Ã¯Â¸Â Templates que serÃƒÂ£o criados:</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #555;">
                            <li><strong>Backup DiÃƒÂ¡rio</strong> - Backup automÃƒÂ¡tico diÃƒÂ¡rio</li>
                            <li><strong>Limpeza Semanal</strong> - Limpeza de arquivos temporÃƒÂ¡rios</li>
                        </ul>
                    </div>

                    <p style="color: #ff9800; font-size: 14px; margin-bottom: 20px;">
                        Ã¢Å¡Â Ã¯Â¸Â <strong>AtenÃƒÂ§ÃƒÂ£o:</strong> Isso criarÃƒÂ¡ pastas no seu sistema de arquivos. VocÃƒÂª pode remover ou modificar tudo depois.
                    </p>
                </div>
            `;

            // Criar modal de confirmaÃƒÂ§ÃƒÂ£o
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
                            Ã¢ÂÅ’ Cancelar
                        </button>
                        <button class="quick-setup-approve-btn" style="background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            Ã¢Å“â€¦ Aprovar e Continuar
                        </button>
                    </div>
                </div>
            `;

            // Armazenar funÃƒÂ§ÃƒÂ£o de resoluÃƒÂ§ÃƒÂ£o
            window.quickSetupResolve = resolve;

            document.body.appendChild(modal);

            // Configurar event listeners para os botÃƒÂµes
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

    // FunÃƒÂ§ÃƒÂ£o para obter caminhos padrÃƒÂ£o baseados na plataforma
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
            // Linux/Raspberry Pi - usar caminhos genÃƒÂ©ricos que serÃƒÂ£o resolvidos no backend
            return {
                entrada: '/home/user/Documents/Entrada',
                processados: '/home/user/Documents/Processados',
                backup: '/home/user/Documents/Backup'
            };
        }
    }

    // Criar pastas padrÃƒÂ£o automaticamente
    async createDefaultFolders() {
        const paths = this.getDefaultPaths();
        const defaultFolders = [
            { name: 'Documentos Entrada', path: paths.entrada, type: 'source', format: 'any' },
            { name: 'Documentos Processados', path: paths.processados, type: 'target', format: 'any' },
            { name: 'Backup AutomÃƒÂ¡tico', path: paths.backup, type: 'target', format: 'any' }
        ];

        for (const folder of defaultFolders) {
            try {
                await this.saveFolder(folder);
                console.log(`Pasta criada: ${folder.name}`);
            } catch (error) {
                console.warn(`Erro ao criar pasta ${folder.name}:`, error);
            }
        }
    }

    // Criar templates bÃƒÂ¡sicos
    async createDefaultTemplates() {
        const templates = [
            {
                name: 'Backup DiÃƒÂ¡rio',
                description: 'Faz backup diÃƒÂ¡rio de documentos importantes',
                action: 'copy',
                source: paths.entrada,
                target: paths.backup,
                frequency: '1d',
                options: { batch: true, backupBeforeMove: false }
            },
            {
                name: 'Limpeza Semanal',
                description: 'Remove arquivos temporÃƒÂ¡rios semanalmente',
                action: 'delete',
                source: '/tmp',
                target: '',
                frequency: '1w',
                options: { batch: true }
            }
        ];

        for (const template of templates) {
            try {
                await this.saveTemplate(template);
                console.log(`Template criado: ${template.name}`);
            } catch (error) {
                console.warn(`Erro ao criar template ${template.name}:`, error);
            }
        }
    }

    // Mostrar resultados da configuraÃƒÂ§ÃƒÂ£o rÃƒÂ¡pida
    showQuickSetupResults() {
        const results = `
        <div style="text-align: center; padding: 20px;">
            <h3 style="color: #4caf50; margin-bottom: 15px;">Ã°Å¸Å½â€° ConfiguraÃƒÂ§ÃƒÂ£o ConcluÃƒÂ­da!</h3>
            <p style="margin-bottom: 20px;">Pastas e templates foram criados automaticamente:</p>

            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                <h4>Ã°Å¸â€œÂ Pastas Criadas:</h4>
                <ul style="margin: 10px 0;">
                    <li>Ã°Å¸â€œÂ¥ <strong>Documentos Entrada</strong> - Para arquivos de entrada</li>
                    <li>Ã°Å¸â€œÂ¤ <strong>Documentos Processados</strong> - Para arquivos processados</li>
                    <li>Ã°Å¸â€™Â¾ <strong>Backup AutomÃƒÂ¡tico</strong> - Para backups</li>
                </ul>
            </div>

            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                <h4>Ã¢Å¡â„¢Ã¯Â¸Â Templates Criados:</h4>
                <ul style="margin: 10px 0;">
                    <li>Ã°Å¸â€œâ€¦ <strong>Backup DiÃƒÂ¡rio</strong> - Backup automÃƒÂ¡tico diÃƒÂ¡rio</li>
                    <li>Ã°Å¸Â§Â¹ <strong>Limpeza Semanal</strong> - Limpeza de arquivos temporÃƒÂ¡rios</li>
                </ul>
            </div>

            <p style="color: #666; font-size: 14px;">
                VocÃƒÂª pode personalizar essas configuraÃƒÂ§ÃƒÂµes nas abas "OperaÃƒÂ§ÃƒÂµes de Arquivos" e "ConfiguraÃƒÂ§ÃƒÂµes".
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
                        Ã°Å¸Å½Â¯ ComeÃƒÂ§ar a Usar!
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Configurar event listener para o botÃƒÂ£o fechar
        const closeBtn = modal.querySelector('.quick-setup-results-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }
    }

    // Sistema de configuraÃƒÂ§ÃƒÂ£o rÃƒÂ¡pida de pastas
    async createQuickFolder(type) {
        console.log(`Ã°Å¸Å¡â‚¬ Iniciando criaÃƒÂ§ÃƒÂ£o de pastas do tipo: ${type}`);

        // Obter caminhos padrÃƒÂ£o baseados na plataforma
        const paths = this.getDefaultPaths();
        const isWindows = navigator.userAgent.indexOf('Windows') > -1;
        const basePath = isWindows ? 'C:\\Users\\User' : '/home/user';

        const folderSets = {
            documents: [
                { name: 'Documentos Entrada', path: paths.entrada, type: 'source', format: 'any' },
                { name: 'Documentos Processados', path: paths.processados, type: 'target', format: 'any' }
            ],
            backup: [
                { name: 'Backup DiÃƒÂ¡rio', path: isWindows ? basePath + '\\Backup\\Diario' : basePath + '/Backup/Diario', type: 'target', format: 'any' },
                { name: 'Backup Semanal', path: isWindows ? basePath + '\\Backup\\Semanal' : basePath + '/Backup/Semanal', type: 'target', format: 'any' }
            ],
            media: [
                { name: 'Fotos', path: isWindows ? basePath + '\\Pictures' : basePath + '/Pictures', type: 'source', format: 'any' },
                { name: 'VÃƒÂ­deos', path: isWindows ? basePath + '\\Videos' : basePath + '/Videos', type: 'source', format: 'any' }
            ],
            temp: [
                { name: 'Processamento', path: isWindows ? basePath + '\\Temp\\Processamento' : basePath + '/Temp/Processamento', type: 'temp', format: 'any' },
                { name: 'Lixeira', path: isWindows ? basePath + '\\Temp\\Lixeira' : basePath + '/Temp/Lixeira', type: 'trash', format: 'any' }
            ]
        };

        const folders = folderSets[type];
        if (!folders) {
            console.error(`Ã¢ÂÅ’ Tipo de pasta invÃƒÂ¡lido: ${type}`);
            this.showToast('Ã¢ÂÅ’ Tipo de pasta invÃƒÂ¡lido', 'error');
            return;
        }

        this.showToast(`Ã°Å¸Å¡â‚¬ Criando pastas de ${type}...`, 'info');

        try {
            // Criar pastas uma por vez para melhor controle
            for (const folder of folders) {
                console.log(`Ã°Å¸â€œÂ Criando pasta: ${folder.name} em ${folder.path}`);
                try {
                    await this.createFolderOnServer(folder);
                    console.log(`Ã¢Å“â€¦ Pasta criada: ${folder.name}`);
                } catch (error) {
                    console.warn(`Ã¢Å¡Â Ã¯Â¸Â Erro ao criar pasta ${folder.name}:`, error);
                    // Continua tentando as outras pastas
                }
            }

            // Criar templates relacionados
            await this.createRelatedTemplates(type);

            this.showToast(`Ã¢Å“â€¦ Pastas de ${type} criadas com sucesso!`, 'success');
            this.refreshFoldersList();

        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro geral ao criar pastas:', error);
            this.showToast('Ã¢ÂÅ’ Erro ao criar pastas', 'error');
        }
    }

    // Criar pasta no servidor
    async createFolderOnServer(folder) {
        console.log(`Ã°Å¸Å’Â Enviando requisiÃƒÂ§ÃƒÂ£o para criar pasta:`, folder);

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
        console.log(`Ã°Å¸â€œÂ Criando templates relacionados ao tipo: ${type}`);

        // Obter caminhos padrÃƒÂ£o baseados na plataforma
        const paths = this.getDefaultPaths();

        const templateSets = {
            documents: [
                {
                    name: 'Backup Documentos',
                    description: 'Faz backup diÃƒÂ¡rio de documentos importantes',
                    action: 'copy',
                    sourcePath: paths.entrada,
                    targetPath: paths.processados,
                    frequency: '1d',
                    options: { batch: true, backupBeforeMove: false }
                }
            ],
            backup: [
                {
                    name: 'Backup DiÃƒÂ¡rio',
                    description: 'Backup automÃƒÂ¡tico diÃƒÂ¡rio',
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
                    name: 'Limpar TemporÃƒÂ¡rios',
                    description: 'Remove arquivos temporÃƒÂ¡rios semanalmente',
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
            try {
                console.log(`Ã°Å¸â€œâ€¹ Criando template: ${template.name}`);
                await this.createTemplateOnServer(template);
                console.log(`Ã¢Å“â€¦ Template criado: ${template.name}`);
            } catch (error) {
                console.warn(`Ã¢Å¡Â Ã¯Â¸Â Erro ao criar template ${template.name}:`, error);
            }
        }
    }

    // Criar template no servidor
    async createTemplateOnServer(template) {
        console.log(`Ã°Å¸Å’Â Enviando requisiÃƒÂ§ÃƒÂ£o para criar template:`, template);

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
        console.log('Ã°Å¸â€â€ž Atualizando lista de pastas...');

        try {
            // Carregar pastas do servidor
            await this.loadFolders();
            await this.loadWorkflows();

            // Atualizar interface
            this.updateFoldersDisplay();
            this.updateWorkflowsDisplay();

            this.showToast('Ã¢Å“â€¦ Lista de pastas atualizada!', 'success');
            console.log('Ã¢Å“â€¦ Lista de pastas atualizada com sucesso');

        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao atualizar lista de pastas:', error);
            this.showToast('Ã¢ÂÅ’ Erro ao atualizar lista', 'error');
        }
    }

    // Atualizar exibiÃƒÂ§ÃƒÂ£o de pastas
    updateFoldersDisplay() {
        const foldersList = document.getElementById('folders-list');
        if (!foldersList) return;

        if (this.folders.length === 0) {
            foldersList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">folder_open</span>
                    <p>Nenhuma pasta configurada</p>
                    <small>Use a configuraÃƒÂ§ÃƒÂ£o rÃƒÂ¡pida acima ou crie manualmente</small>
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

            // Configurar event listeners para os botÃƒÂµes de editar/deletar
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

    // Obter ÃƒÂ­cone da pasta baseado no tipo
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
    editFolder(folderId) {
        console.log(`Ã¢Å“ÂÃ¯Â¸Â Editando pasta: ${folderId}`);
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            // Implementar modal de ediÃƒÂ§ÃƒÂ£o
            this.showToast('Edicao rapida indisponivel no momento. Use excluir e criar novamente para alterar a pasta.', 'warning');
        } else {
            this.showToast('Pasta nÃƒÂ£o encontrada', 'error');
        }
    }

    // Deletar pasta
    async deleteFolder(folderId) {
        console.log(`Ã°Å¸â€”â€˜Ã¯Â¸Â Deletando pasta: ${folderId}`);

        if (confirm('Tem certeza que deseja excluir esta pasta?')) {
            try {
                const response = await fetch(`/api/files/folders/${folderId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.showToast('Ã¢Å“â€¦ Pasta excluÃƒÂ­da com sucesso!', 'success');
                    await this.refreshFoldersList();
                } else {
                    throw new Error(`Erro HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('Ã¢ÂÅ’ Erro ao excluir pasta:', error);
                this.showToast('Ã¢ÂÅ’ Erro ao excluir pasta', 'error');
            }
        }
    }

    // Atualizar exibiÃƒÂ§ÃƒÂ£o de workflows (placeholder)
    updateWorkflowsDisplay() {
        console.log('Ã°Å¸â€â€ž Atualizando exibiÃƒÂ§ÃƒÂ£o de workflows...');
        // Implementar conforme necessÃƒÂ¡rio
    }

    // Adicionar event listeners para operaÃƒÂ§ÃƒÂµes de arquivo
    addFileOperationEventListeners() {
        // Mostrar/ocultar filtro de extensÃƒÂµes quando recursÃƒÂ£o ÃƒÂ© selecionada
        const recursiveCheckbox = document.getElementById('recursive-operation');
        const extensionsFilter = document.getElementById('extensions-filter');

        if (recursiveCheckbox && extensionsFilter) {
            recursiveCheckbox.addEventListener('change', (e) => {
                extensionsFilter.style.display = e.target.checked ? 'block' : 'none';
            });
        }
    }

    // Configurar event listeners para todos os novos botÃƒÂµes
    setupAdditionalEventListeners() {
        // BotÃƒÂµes de dashboard
        this.addButtonListener('.refresh-charts-btn', () => this.updateCharts());
        this.addButtonListener('.clear-search-btn', () => this.clearSearch());
        this.addButtonListener('.schedule-modal-btn', () => {
            this.switchTab('scheduled');
            this.showScheduleModal();
        });

        // BotÃƒÂµes de aÃƒÂ§ÃƒÂ£o rÃƒÂ¡pida (interface antiga) - redirecionar para nova interface
        this.addButtonListener('.action-move-btn', () => this.redirectToFileOperations('move'));
        this.addButtonListener('.action-copy-btn', () => this.redirectToFileOperations('copy'));
        this.addButtonListener('.action-delete-btn', () => this.redirectToFileOperations('delete'));
        this.addButtonListener('.action-schedule-btn', () => this.redirectToFileOperations('schedule'));
        this.addButtonListener('.action-slideshow-btn', () => this.showSlideshowModal());

        // BotÃƒÂµes de backup
        this.addButtonListener('.load-backups-btn', () => {
            if (typeof loadBackups === 'function') loadBackups();
        });
        this.addButtonListener('.update-backup-btn', () => {
            if (typeof updateBackupConfig === 'function') updateBackupConfig();
        });

        // BotÃƒÂµes de configuraÃƒÂ§ÃƒÂµes
        this.addButtonListener('.show-ignored-btn', () => window.showIgnoredPatterns());
        this.addButtonListener('.save-settings-btn', () => this.saveSettings());

        // BotÃƒÂµes de workflow
        this.addButtonListener('.close-workflow-btn', () => window.closeWorkflowModal());
        this.addButtonListener('#prev-step', () => window.previousWorkflowStep());
        this.addButtonListener('#next-step', () => window.nextWorkflowStep());
        this.addButtonListener('#save-step', () => window.saveWorkflow());
        this.addButtonListener('.cancel-workflow-btn', () => window.closeWorkflowModal());

        // BotÃƒÂµes de gerenciamento de pastas
        this.addButtonListener('.close-folder-manager-btn', () => window.closeFolderManagerModal());
        this.addButtonListener('.cancel-folder-manager-btn', () => window.closeFolderManagerModal());
        this.addButtonListener('.save-folder-btn', () => window.saveFolder());

        // BotÃƒÂµes de operaÃƒÂ§ÃƒÂµes de arquivo
        this.addButtonListener('.close-file-operation-btn', () => {
            if (typeof closeFileOperationModal === 'function') closeFileOperationModal();
        });
        this.addButtonListener('.cancel-file-operation-btn', () => {
            if (typeof closeFileOperationModal === 'function') closeFileOperationModal();
        });
        this.addButtonListener('.execute-file-operation-btn', () => {
            if (typeof executeFileOperation === 'function') executeFileOperation();
        });

        // BotÃƒÂµes de agendamento
        this.addButtonListener('.close-schedule-btn', () => window.closeScheduleModal());
        this.addButtonListener('.cancel-schedule-btn', () => window.closeScheduleModal());
        this.addButtonListener('.schedule-operation-btn', () => window.scheduleOperation());
        
        // BotÃƒÂµes de filtros rÃƒÂ¡pidos (event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.filter-btn')) {
                const btn = e.target.closest('.filter-btn');
                this.selectFilter({ target: btn });
            }
        });
        
        // BotÃƒÂµes de navegaÃƒÂ§ÃƒÂ£o de pastas no modal de agendamento
        this.addButtonListener('#browse-source-btn', () => this.browsePathForSchedule('source'));
        this.addButtonListener('#browse-target-btn', () => this.browsePathForSchedule('target'));
        
        // BotÃƒÂµes de operaÃƒÂ§ÃƒÂµes agendadas (event delegation)
        document.addEventListener('click', (e) => {
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
        
        // BotÃƒÂ£o de reload da pÃƒÂ¡gina
        this.addButtonListener('.reload-page-btn', () => window.location.reload());

        // BotÃƒÂµes de slideshow
        this.addButtonListener('.close-slideshow-folder-btn', () => window.closeSlideshowFolderModal());
        this.addButtonListener('.cancel-slideshow-folder-btn', () => window.closeSlideshowFolderModal());
        this.addButtonListener('.close-slideshow-config-btn', () => window.closeSlideshowConfigModal());
        // Event listeners antigos removidos - usando botÃƒÂµes estÃƒÂ¡ticos

        // BotÃƒÂ£o seletor de pasta
        this.addButtonListener('.select-folder-btn', () => {
            this.selectSourceFolder();
        });

        // BotÃƒÂ£o seletor de pasta de destino
        this.addButtonListener('.select-target-btn', () => {
            this.selectTargetFolder();
        });

        // BotÃƒÂµes de operaÃƒÂ§ÃƒÂ£o
        this.addButtonListener('.move-btn', () => this.selectOperation('move'));
        this.addButtonListener('.copy-btn', () => this.selectOperation('copy'));
        this.addButtonListener('.delete-btn', () => this.selectOperation('delete'));

        // BotÃƒÂµes de sugestÃƒÂ£o de pasta
        this.addButtonListener('.suggestion-btn', (e) => this.selectSuggestedFolder(e));

        // BotÃƒÂµes de aÃƒÂ§ÃƒÂ£o
        this.addButtonListener('.execute-now-btn', () => this.executeNow());
        this.addButtonListener('.schedule-btn', () => {
            if (typeof showScheduleModal === 'function') {
                this.configureOperation();
            } else {
                this.showToast('Funcionalidade de agendamento nÃƒÂ£o disponÃƒÂ­vel', 'warning');
            }
        });

        // Filtros de busca (input events)
        const searchInput = document.getElementById('scheduled-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterScheduledOperations(e.target.value);
            });
        }
    }

    // FunÃƒÂ§ÃƒÂ£o auxiliar para adicionar event listeners de botÃƒÂµes
    addButtonListener(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener('click', callback);
        }
    }

    // Redirecionar da interface antiga para a nova
    redirectToFileOperations(operation) {
        // Mudar para a aba de operaÃƒÂ§ÃƒÂµes de arquivos
        this.switchTab('fileops');

        // PrÃƒÂ©-selecionar a operaÃƒÂ§ÃƒÂ£o
        setTimeout(() => {
            this.selectOperation(operation);
            this.showToast(`Use a nova interface abaixo para configurar a operaÃƒÂ§ÃƒÂ£o de ${operation}`, 'info');
        }, 100);
    }

    // ==========================================
    // OPERATION CONFIGURATION
    // ==========================================

    // Estado da configuraÃƒÂ§ÃƒÂ£o atual
    currentConfig = {
        sourcePath: '',
        operation: '',
        targetPath: '',
        extensions: [],
        recursive: true
    };

    // Selecionar pasta de origem
    selectSourceFolder() {
        this.showNativeFolderDialog('source');
    }

    // Selecionar pasta de destino
    selectTargetFolder() {
        this.showNativeFolderDialog('target');
    }

    // Mostrar diÃƒÂ¡logo nativo de seleÃƒÂ§ÃƒÂ£o de pasta
    showNativeFolderDialog(targetType) {
        // Criar input file oculto para seleÃƒÂ§ÃƒÂ£o de pasta
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
                const selectedPath = files[0].webkitRelativePath.split('/')[0];
                const fullPath = files[0].path || files[0].webkitRelativePath.split('/').slice(0, -1).join('/');
                
                console.log('Ã°Å¸â€œÂ Pasta selecionada:', fullPath);
                
                if (targetType === 'source') {
                    document.getElementById('source-folder-path').value = fullPath;
                    this.showToast(`Pasta de origem selecionada: ${fullPath}`, 'success');
                } else {
                    document.getElementById('target-folder-path').value = fullPath;
                    this.showToast(`Pasta de destino selecionada: ${fullPath}`, 'success');
                }
            }
            
            // Remover o input apÃƒÂ³s uso
            document.body.removeChild(input);
        });
        
        // Adicionar ao DOM e clicar
        document.body.appendChild(input);
        input.click();
    }

    // Mostrar navegador de pastas
    async showFolderBrowser(targetType, callback = null) {
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
                            <input type="text" id="browser-path" value="${navigator.userAgent.indexOf('Windows') > -1 ? 'C:\\\\Users\\\\User' : '/home/yo'}" placeholder="Digite o caminho da pasta ou navegue">
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
                                <small>VocÃƒÂª pode inserir o caminho manualmente ou navegar pelas pastas</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary folder-browser-cancel-btn">Cancelar</button>
                    <button class="btn btn-primary folder-browser-select-btn" data-target-type="${targetType}">Selecionar Esta Pasta</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Configurar event listeners apÃƒÂ³s criar o modal
        this.setupFolderBrowserEventListeners(modal, targetType, callback);

        // Obter diretÃƒÂ³rio home do usuÃƒÂ¡rio automaticamente
        this.setDefaultPath(modal);

        // NÃƒÂ£o carregar pastas automaticamente - permitir entrada manual
        console.log('Ã°Å¸â€œÂ Modal de seleÃƒÂ§ÃƒÂ£o de pasta criado - entrada manual habilitada');
    }

    // Definir caminho padrÃƒÂ£o baseado no sistema operacional
    async setDefaultPath(modal) {
        try {
            // Tentar obter o diretÃƒÂ³rio home via API
            const response = await fetch('/api/status/system');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.userHome) {
                    const pathInput = modal.querySelector('#browser-path');
                    if (pathInput) {
                        pathInput.value = data.data.userHome;
                        console.log('Ã°Å¸ÂÂ  DiretÃƒÂ³rio home detectado:', data.data.userHome);
                        return;
                    }
                }
            }
        } catch (error) {
            console.log('Ã¢Å¡Â Ã¯Â¸Â NÃƒÂ£o foi possÃƒÂ­vel detectar diretÃƒÂ³rio home via API, usando padrÃƒÂ£o');
        }

        // Fallback: usar caminho padrÃƒÂ£o baseado no sistema
        const pathInput = modal.querySelector('#browser-path');
        if (pathInput) {
            const isWindows = navigator.userAgent.indexOf('Windows') > -1;
            const defaultPath = isWindows ? 'C:\\Users\\User' : '/home/yo';
            pathInput.value = defaultPath;
            console.log('Ã°Å¸ÂÂ  Usando caminho padrÃƒÂ£o:', defaultPath);
        }
    }

    // Carregar pastas de um diretÃƒÂ³rio (para o modal de navegaÃƒÂ§ÃƒÂ£o)
    async loadFoldersForBrowser(path) {
        console.log('Ã°Å¸â€Â Iniciando carregamento de pastas para navegaÃƒÂ§ÃƒÂ£o:', path);

        try {
            const response = await fetch('/api/files/list-folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });

            console.log('Ã°Å¸â€œÂ¡ Resposta da API:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Ã°Å¸â€œâ€¹ Resultado da API:', result);

            if (result.success) {
                console.log('Ã¢Å“â€¦ Pastas carregadas:', result.data.folders.length);
                this.renderFolders(result.data.folders, path);
            } else {
                console.error('Ã¢ÂÅ’ Erro na resposta da API:', result.error);
                this.showToast('Erro ao carregar pastas: ' + (result.error?.message || 'Erro desconhecido'), 'error');
            }
        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao carregar pastas:', error);
            this.showToast('Erro ao carregar pastas: ' + error.message, 'error');
        }
    }

    // Configurar event listeners para o navegador de pastas
    setupFolderBrowserEventListeners(modal, targetType, callback = null) {
        // BotÃƒÂ£o fechar
        const closeBtn = modal.querySelector('.folder-browser-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }

        // BotÃƒÂ£o voltar
        const upBtn = modal.querySelector('.folder-browser-up-btn');
        if (upBtn) {
            upBtn.addEventListener('click', () => this.goUp());
        }

        // BotÃƒÂ£o atualizar/refresh
        const refreshBtn = modal.querySelector('.folder-browser-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const currentPath = document.getElementById('browser-path').value;
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

        // BotÃƒÂ£o cancelar
        const cancelBtn = modal.querySelector('.folder-browser-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => modal.remove());
        }

        // BotÃƒÂ£o selecionar
        const selectBtn = modal.querySelector('.folder-browser-select-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                const targetTypeFromBtn = selectBtn.getAttribute('data-target-type');
                this.selectCurrentFolder(targetTypeFromBtn, callback);
            });
        }
    }

    // Renderizar lista de pastas
    renderFolders(folders, currentPath) {
        console.log('Ã°Å¸Å½Â¨ Renderizando pastas:', folders?.length || 0, 'para o caminho:', currentPath);

        const pathInput = document.getElementById('browser-path');
        if (pathInput) {
            pathInput.value = currentPath;
        }

        const folderList = document.getElementById('folder-list');
        if (!folderList) {
            console.error('Ã¢ÂÅ’ Elemento folder-list nÃƒÂ£o encontrado!');
            return;
        }

        if (!folders || folders.length === 0) {
            console.log('Ã°Å¸â€œÂ­ Nenhuma pasta encontrada');
            folderList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">folder_open</span>
                    <p>Nenhuma pasta encontrada</p>
                    <small>Este diretÃƒÂ³rio nÃƒÂ£o contÃƒÂ©m subpastas ou o caminho nÃƒÂ£o existe</small>
                    <button class="btn btn-sm btn-outline folder-retry-btn" style="margin-top: 10px;">
                        <span class="material-icons">refresh</span>
                        Tentar Novamente
                    </button>
                </div>
            `;
            
            // Configurar event listener para o botÃƒÂ£o de tentar novamente
            const retryBtn = folderList.querySelector('.folder-retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    this.loadFoldersForBrowser(currentPath);
                });
            }
            return;
        }

        console.log('Ã°Å¸â€œÂ Renderizando pastas:', folders.map(f => f.name));

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
        console.log('Ã°Å¸â€â€” Configurando event listeners para', folderItems.length, 'itens de pasta');

        folderItems.forEach(item => {
            item.addEventListener('click', () => {
                const path = item.getAttribute('data-path');
                console.log('Ã°Å¸â€œâ€š Clicado na pasta:', path);
                this.navigateTo(path);
            });
        });

        console.log('Ã¢Å“â€¦ RenderizaÃƒÂ§ÃƒÂ£o completa');
    }

    // Navegar para uma pasta
    navigateTo(path) {
        this.loadFoldersForBrowser(path);
    }

    // Voltar um nÃƒÂ­vel
    goUp() {
        const currentPath = document.getElementById('browser-path').value;
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
        this.loadFoldersForBrowser(parentPath);
    }

    // Selecionar filtro rÃƒÂ¡pido
    selectFilter(event) {
        const button = event.target;
        const filter = button.getAttribute('data-filter');
        const filterInput = document.getElementById('schedule-filters');
        
        console.log('Ã°Å¸â€Â BotÃƒÂ£o de filtro clicado:', button);
        console.log('Ã°Å¸â€Â Filtro obtido:', filter);
        console.log('Ã°Å¸â€Â Campo de input encontrado:', !!filterInput);
        
        if (filterInput) {
            filterInput.value = filter;
            
            // Remover classe active de todos os botÃƒÂµes
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Adicionar classe active ao botÃƒÂ£o clicado
            button.classList.add('active');
            
            console.log('Ã¢Å“â€¦ Filtro selecionado:', filter);
            console.log('Ã¢Å“â€¦ Campo atualizado com:', filterInput.value);
            
            // Atualizar resumo da operaÃƒÂ§ÃƒÂ£o se estiver visÃƒÂ­vel
            if (typeof updateOperationSummary === 'function') {
                updateOperationSummary();
            }
        } else {
            console.error('Ã¢ÂÅ’ Campo de filtros nÃƒÂ£o encontrado!');
        }
    }

    // Navegar e selecionar pasta para o modal de agendamento
    browsePathForSchedule(type) {
        const currentPath = type === 'source' 
            ? document.getElementById('schedule-source').value || '/home/yo'
            : document.getElementById('schedule-target').value || '/home/yo';
            
        console.log(`Ã°Å¸â€Â Abrindo navegador de pastas para ${type}:`, currentPath);
        
        // Usar a funÃƒÂ§ÃƒÂ£o existente de navegaÃƒÂ§ÃƒÂ£o de pastas
        this.showFolderBrowser(currentPath, (selectedPath) => {
            if (type === 'source') {
                document.getElementById('schedule-source').value = selectedPath;
                console.log('Ã¢Å“â€¦ Pasta de origem selecionada:', selectedPath);
            } else {
                document.getElementById('schedule-target').value = selectedPath;
                console.log('Ã¢Å“â€¦ Pasta de destino selecionada:', selectedPath);
            }
        });
    }

    // FunÃƒÂ§ÃƒÂ£o auxiliar para preencher campo com mÃƒÂºltiplas tentativas
    fillFieldWithRetry(field, value, fieldName) {
        if (!field) return false;
        
        // Tentativa 1: MÃƒÂ©todo direto
        field.value = value;
        console.log(`Ã°Å¸â€â€ž Tentativa 1 - ${fieldName}:`, field.value);
        
        if (field.value === value) {
            console.log(`Ã¢Å“â€¦ ${fieldName} preenchido com sucesso`);
            return true;
        }
        
        // Tentativa 2: Disparar eventos
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`Ã°Å¸â€â€ž Tentativa 2 - ${fieldName} (com eventos):`, field.value);
        
        if (field.value === value) {
            console.log(`Ã¢Å“â€¦ ${fieldName} preenchido com eventos`);
            return true;
        }
        
        // Tentativa 3: ForÃƒÂ§ar com setTimeout
        setTimeout(() => {
            field.value = value;
            console.log(`Ã°Å¸â€â€ž Tentativa 3 - ${fieldName} (timeout):`, field.value);
        }, 50);
        
        return field.value === value;
    }

    // Selecionar pasta atual
    selectCurrentFolder(targetType, callback = null) {
        const selectedPath = document.getElementById('browser-path').value;
        console.log('Ã°Å¸Å½Â¯ Selecionando pasta:', selectedPath, 'para tipo:', targetType);
        
        // Se hÃƒÂ¡ um callback, usar ele em vez da lÃƒÂ³gica padrÃƒÂ£o
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
                sourceField = document.getElementById('source-path'); // Campo simples
                console.log('Ã°Å¸â€Â Campo source-path encontrado:', !!sourceField);
            } else {
                console.log('Ã°Å¸â€Â Campo source-folder-path encontrado:', !!sourceField);
            }
            
            if (sourceField) {
                // Usar funÃƒÂ§ÃƒÂ£o auxiliar para preencher com mÃƒÂºltiplas tentativas
                const success = this.fillFieldWithRetry(sourceField, selectedPath, 'source-folder-path');
                
                if (success) {
                    this.currentConfig.sourcePath = selectedPath;
                    console.log('Ã¢Å“â€¦ Campo de origem preenchido com sucesso');
                    this.showToast(`Pasta de origem selecionada: ${selectedPath}`, 'success');
                } else {
                    console.error('Ã¢ÂÅ’ Falha ao preencher campo de origem');
                    this.showToast('Erro: Falha ao preencher campo de origem', 'error');
                }
            } else {
                console.error('Ã¢ÂÅ’ Campo de pasta de origem nÃƒÂ£o encontrado');
                console.error('Ã¢ÂÅ’ Tentou source-folder-path:', !!document.getElementById('source-folder-path'));
                console.error('Ã¢ÂÅ’ Tentou source-path:', !!document.getElementById('source-path'));
                this.showToast('Erro: Campo de pasta de origem nÃƒÂ£o encontrado', 'error');
            }
        } else if (targetType === 'target') {
            // Verificar se existe o campo complexo primeiro (mais comum)
            let targetField = document.getElementById('target-folder-path'); // Campo complexo
            if (!targetField) {
                targetField = document.getElementById('dest-path'); // Campo simples
                console.log('Ã°Å¸â€Â Campo dest-path encontrado:', !!targetField);
            } else {
                console.log('Ã°Å¸â€Â Campo target-folder-path encontrado:', !!targetField);
            }
            
            if (targetField) {
                // Usar funÃƒÂ§ÃƒÂ£o auxiliar para preencher com mÃƒÂºltiplas tentativas
                const success = this.fillFieldWithRetry(targetField, selectedPath, 'target-folder-path');
                
                if (success) {
                    this.currentConfig.targetPath = selectedPath;
                    console.log('Ã¢Å“â€¦ Campo de destino preenchido com sucesso');
                    this.showToast(`Pasta de destino selecionada: ${selectedPath}`, 'success');
                } else {
                    console.error('Ã¢ÂÅ’ Falha ao preencher campo de destino');
                    this.showToast('Erro: Falha ao preencher campo de destino', 'error');
                }
            } else {
                console.error('Ã¢ÂÅ’ Campo de pasta de destino nÃƒÂ£o encontrado');
                console.error('Ã¢ÂÅ’ Tentou target-folder-path:', !!document.getElementById('target-folder-path'));
                console.error('Ã¢ÂÅ’ Tentou dest-path:', !!document.getElementById('dest-path'));
                this.showToast('Erro: Campo de pasta de destino nÃƒÂ£o encontrado', 'error');
            }
        }

        // Fechar modal
        document.querySelector('.folder-browser-modal').closest('.modal').remove();
    }

    // Configurar event listeners seguros para CSP (substituir onclick/onchange inline)
    setupCSPSafeEventListeners() {
        // Barra de busca de operaÃƒÂ§ÃƒÂµes agendadas
        const searchInput = document.querySelector('.filter-scheduled-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterScheduledOperations(e.target.value);
            });
        }

        // Selects do formulÃƒÂ¡rio de operaÃƒÂ§ÃƒÂµes
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

        // Checkboxes de transformaÃƒÂ§ÃƒÂ£o
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

        // Selects do formulÃƒÂ¡rio de pastas
        const folderTypeSelect = document.querySelector('.folder-type-select');
        if (folderTypeSelect) {
            folderTypeSelect.addEventListener('change', () => {
                this.updateFolderTypeHelp();
            });
        }

        // Select do formulÃƒÂ¡rio de agendamento
        const scheduleActionSelect = document.querySelector('.schedule-action-select');
        if (scheduleActionSelect) {
            scheduleActionSelect.addEventListener('change', () => {
                if (typeof updateScheduleForm === 'function') {
                    updateScheduleForm();
                }
            });
        }
        
        // Event listeners para atualizar resumo da operaÃƒÂ§ÃƒÂ£o
        const scheduleSourceInput = document.getElementById('schedule-source');
        const scheduleTargetInput = document.getElementById('schedule-target');
        
        if (scheduleSourceInput) {
            scheduleSourceInput.addEventListener('input', updateOperationSummary);
        }
        if (scheduleTargetInput) {
            scheduleTargetInput.addEventListener('input', updateOperationSummary);
        }

        // Input de validaÃƒÂ§ÃƒÂ£o de nome
        const nameInput = document.querySelector('.validate-name-input');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.validateField(e.target, 'name');
            });
        }

        // BotÃƒÂµes de navegaÃƒÂ§ÃƒÂ£o de pastas no dashboard
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

        // BotÃƒÂµes de operaÃƒÂ§ÃƒÂµes simples
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

    // Selecionar operaÃƒÂ§ÃƒÂ£o
    selectOperation(operation) {
        console.log('Ã°Å¸Å½Â¯ Selecionando operaÃƒÂ§ÃƒÂ£o:', operation);
        
        // Remove classe active de todos os botÃƒÂµes
        document.querySelectorAll('.operation-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Adiciona classe active ao botÃƒÂ£o selecionado
        const selectedBtn = document.querySelector(`.${operation}-btn`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        this.currentConfig.operation = operation;

        // Verificar se o campo de origem estÃƒÂ¡ visÃƒÂ­vel
        const sourceField = document.getElementById('source-folder-path');
        const sourceFieldParent = sourceField?.parentElement;
        console.log('Ã°Å¸â€Â Campo source-folder-path encontrado:', !!sourceField);
        console.log('Ã°Å¸â€Â Campo source-folder-path visÃƒÂ­vel:', sourceFieldParent?.style.display !== 'none');
        console.log('Ã°Å¸â€Â Campo source-folder-path display:', sourceFieldParent?.style.display);

        // Garantir que o campo de origem esteja sempre visÃƒÂ­vel
        if (sourceFieldParent) {
            sourceFieldParent.style.display = 'block';
            console.log('Ã¢Å“â€¦ Campo de origem forÃƒÂ§ado a ser visÃƒÂ­vel');
        }

        // Controla a visibilidade e obrigatoriedade do campo destino
        const targetField = document.getElementById('target-folder-path').parentElement;
        const targetInput = document.getElementById('target-folder-path');
        const targetHelp = document.getElementById('target-help');

        if (operation === 'delete') {
            // Para apagar, o campo destino ÃƒÂ© opcional e fica oculto
            targetField.style.display = 'none';
            targetInput.required = false;
            targetInput.value = ''; // Limpar valor
        } else {
            // Para mover/copiar, o campo destino ÃƒÂ© obrigatÃƒÂ³rio e fica visÃƒÂ­vel
            targetField.style.display = 'block';
            targetInput.required = true;

            // Atualizar texto de ajuda
            const operationText = operation === 'move' ? 'mover' : 'copiar';
            targetHelp.textContent = `Selecione a pasta de destino (obrigatÃƒÂ³rio para ${operationText})`;
        }

        this.showToast(`OperaÃƒÂ§ÃƒÂ£o selecionada: ${operation}`, 'info');
    }

    // Executar operaÃƒÂ§ÃƒÂ£o imediatamente
    async executeNow() {
        const sourcePath = this.currentConfig.sourcePath;
        const operation = this.currentConfig.operation;
        const targetPath = document.getElementById('target-folder-path').value.trim();

        if (!sourcePath) {
            this.showToast('Selecione uma pasta de origem', 'error');
            return;
        }

        if (!operation) {
            this.showToast('Selecione uma operaÃƒÂ§ÃƒÂ£o', 'error');
            return;
        }

        if ((operation === 'move' || operation === 'copy') && !targetPath) {
            this.showToast('Digite o caminho de destino', 'error');
            return;
        }

        try {
            this.showToast(`Executando ${operation}...`, 'info');

            // Executa a operaÃƒÂ§ÃƒÂ£o diretamente via API
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
                this.showToast(`OperaÃƒÂ§ÃƒÂ£o ${operation} executada com sucesso!`, 'success', true);
            } else {
                this.showToast(`Erro: ${result.error?.message || 'Erro desconhecido'}`, 'error');
            }

        } catch (error) {
            console.error('Erro ao executar operaÃƒÂ§ÃƒÂ£o:', error);
            this.showToast('Erro ao executar operaÃƒÂ§ÃƒÂ£o', 'error');
        }
    }

    // Configurar operaÃƒÂ§ÃƒÂ£o completa (para agendamento)
    configureOperation() {
        // Obter valores atuais dos campos
        const sourcePath = document.getElementById('source-folder-path')?.value.trim() || this.currentConfig.sourcePath;
        const operation = this.currentConfig.operation;
        const targetPath = document.getElementById('target-folder-path')?.value.trim() || '';

        console.log('Ã°Å¸â€Â§ Configurando operaÃƒÂ§ÃƒÂ£o:', { sourcePath, operation, targetPath });
        console.log('Ã°Å¸â€Â§ currentConfig atual:', this.currentConfig);

        if (!sourcePath) {
            this.showToast('Selecione uma pasta de origem', 'error');
            return;
        }

        if (!operation) {
            this.showToast('Selecione uma operaÃƒÂ§ÃƒÂ£o', 'error');
            return;
        }

        if ((operation === 'move' || operation === 'copy') && !targetPath) {
            this.showToast('Digite o caminho de destino', 'error');
            return;
        }

        // Atualizar configuraÃƒÂ§ÃƒÂ£o atual com valores dos campos
        this.currentConfig.sourcePath = sourcePath;
        this.currentConfig.operation = operation;
        this.currentConfig.targetPath = targetPath;

        console.log('Ã¢Å“â€¦ ConfiguraÃƒÂ§ÃƒÂ£o atualizada:', this.currentConfig);

        this.showToast(`OperaÃƒÂ§ÃƒÂ£o configurada: ${operation} de ${sourcePath}`, 'success');

        // Abre o modal de agendamento
        if (typeof showScheduleModal === 'function') {
            showScheduleModal();
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

    // Carregar configuraÃƒÂ§ÃƒÂµes do slideshow do localStorage
    loadSlideshowConfig() {
        const saved = localStorage.getItem('slideshowConfig');
        if (saved) {
            try {
                this.slideshowConfig = { ...this.slideshowConfig, ...JSON.parse(saved) };
                console.log('Ã°Å¸â€œâ€¹ ConfiguraÃƒÂ§ÃƒÂµes do slideshow carregadas:', this.slideshowConfig);
                console.log('Ã°Å¸â€Â DEBUG - Pasta oculta carregada:', this.slideshowConfig.hiddenFolder);
                console.log('Ã°Å¸â€Â DEBUG - Pasta excluÃƒÂ­da carregada:', this.slideshowConfig.deletedFolder);
                console.log('Ã°Å¸â€Â DEBUG - Pasta ajustÃƒÂ¡vel carregada:', this.slideshowConfig.adjustableFolder);
            } catch (error) {
                console.warn('Ã¢Å¡Â Ã¯Â¸Â Erro ao carregar configuraÃƒÂ§ÃƒÂµes do slideshow:', error);
            }
        } else {
            console.log('Ã¢Å¡Â Ã¯Â¸Â Nenhuma configuraÃƒÂ§ÃƒÂ£o salva encontrada');
        }
    }

    // Salvar configuraÃƒÂ§ÃƒÂµes do slideshow no localStorage
    saveSlideshowConfig() {
        try {
            localStorage.setItem('slideshowConfig', JSON.stringify(this.slideshowConfig));
            console.log('Ã°Å¸â€™Â¾ ConfiguraÃƒÂ§ÃƒÂµes do slideshow salvas:', this.slideshowConfig);
        } catch (error) {
            console.warn('Ã¢Å¡Â Ã¯Â¸Â Erro ao salvar configuraÃƒÂ§ÃƒÂµes do slideshow:', error);
        }
    }

    // Aplicar configuraÃƒÂ§ÃƒÂµes do modal para o objeto de configuraÃƒÂ§ÃƒÂ£o
    applySlideshowConfigFromModal() {
        const interval = parseInt(document.getElementById('slideshow-interval').value) || 3;
        const random = document.getElementById('slideshow-random').checked;
        const preload = document.getElementById('slideshow-preload').checked;
        const recursive = document.getElementById('slideshow-recursive').checked;
        
        // Coletar extensÃƒÂµes selecionadas
        const extensionCheckboxes = document.querySelectorAll('.extensions-list input[type="checkbox"]');
        const extensions = Array.from(extensionCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        // Coletar pastas de organizaÃƒÂ§ÃƒÂ£o
        const deletedField = document.getElementById('slideshow-deleted-folder');
        const hiddenField = document.getElementById('slideshow-hidden-folder');
        const adjustableField = document.getElementById('slideshow-adjustable-folder');
        
        const deletedFolder = deletedField ? deletedField.value.trim() : '';
        const hiddenFolder = hiddenField ? hiddenField.value.trim() : '';
        const adjustableFolder = adjustableField ? adjustableField.value.trim() : '';
        
        console.log('Ã°Å¸â€Â DEBUG - Pastas coletadas:');
        console.log('Ã°Å¸â€Â deletedField encontrado:', !!deletedField);
        console.log('Ã°Å¸â€Â hiddenField encontrado:', !!hiddenField);
        console.log('Ã°Å¸â€Â adjustableField encontrado:', !!adjustableField);
        console.log('Ã°Å¸â€Â deletedFolder:', deletedFolder);
        console.log('Ã°Å¸â€Â hiddenFolder:', hiddenFolder);
        console.log('Ã°Å¸â€Â adjustableFolder:', adjustableFolder);

        this.slideshowConfig = {
            interval: Math.max(1, Math.min(60, interval)),
            random,
            preload,
            extensions: extensions.length > 0 ? extensions : ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
            recursive,
            deletedFolder,
            hiddenFolder,
            adjustableFolder
        };
        
        console.log('Ã°Å¸â€Â DEBUG - ConfiguraÃƒÂ§ÃƒÂ£o atualizada:', this.slideshowConfig);

        this.saveSlideshowConfig();
        console.log('Ã¢Å¡â„¢Ã¯Â¸Â ConfiguraÃƒÂ§ÃƒÂµes aplicadas:', this.slideshowConfig);
        console.log('Ã°Å¸â€Â DEBUG - ConfiguraÃƒÂ§ÃƒÂµes salvas no localStorage:', localStorage.getItem('slideshowConfig'));
    }

    // Aplicar configuraÃƒÂ§ÃƒÂµes salvas ao modal
    saveSlideshowSettingsFromModal() {
        const folderPath = document.getElementById('slideshow-folder-path')?.value?.trim() || '';
        this.applySlideshowConfigFromModal();
        if (folderPath) {
            this.persistSlideshowSelectedPath(folderPath);
        }
        this.showToast('Configuracoes do slideshow salvas', 'success');
    }

    applySlideshowConfigToModal() {
        document.getElementById('slideshow-interval').value = this.slideshowConfig.interval;
        document.getElementById('slideshow-random').checked = this.slideshowConfig.random;
        document.getElementById('slideshow-preload').checked = this.slideshowConfig.preload;
        document.getElementById('slideshow-recursive').checked = this.slideshowConfig.recursive;

        // Aplicar extensÃƒÂµes selecionadas
        const extensionCheckboxes = document.querySelectorAll('.extensions-list input[type="checkbox"]');
        extensionCheckboxes.forEach(cb => {
            cb.checked = this.slideshowConfig.extensions.includes(cb.value);
        });

        // Aplicar pastas de organizaÃƒÂ§ÃƒÂ£o
        const deletedField = document.getElementById('slideshow-deleted-folder');
        const hiddenField = document.getElementById('slideshow-hidden-folder');
        const adjustableField = document.getElementById('slideshow-adjustable-folder');
        
        if (deletedField) {
            deletedField.value = this.slideshowConfig.deletedFolder || '';
            console.log('Ã°Å¸â€Â DEBUG - Campo deleted aplicado:', deletedField.value);
        } else {
            console.error('Ã¢ÂÅ’ Campo slideshow-deleted-folder nÃƒÂ£o encontrado');
        }
        
        if (hiddenField) {
            hiddenField.value = this.slideshowConfig.hiddenFolder || '';
            console.log('Ã°Å¸â€Â DEBUG - Campo hidden aplicado:', hiddenField.value);
        } else {
            console.error('Ã¢ÂÅ’ Campo slideshow-hidden-folder nÃƒÂ£o encontrado');
        }

        if (adjustableField) {
            adjustableField.value = this.slideshowConfig.adjustableFolder || '';
            console.log('Ã°Å¸â€Â DEBUG - Campo adjustable aplicado:', adjustableField.value);
        } else {
            console.error('Ã¢ÂÅ’ Campo slideshow-adjustable-folder nÃƒÂ£o encontrado');
        }
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

        bindOnce('.slideshow-start-btn', () => this.startSlideshowFromModal());
        bindOnce('.slideshow-save-btn', () => this.saveSlideshowSettingsFromModal());
        bindOnce('.slideshow-browse-btn', () => this.browseSlideshowFolder());
        bindOnce('.slideshow-browse-deleted-btn', () => this.browseDeletedFolder());
        bindOnce('.slideshow-browse-hidden-btn', () => this.browseHiddenFolder());
        bindOnce('.slideshow-browse-adjustable-btn', () => this.browseAdjustableFolder());
        bindOnce('.close-slideshow-config-btn', () => this.closeSlideshowModal());
        bindOnce('.slideshow-close-btn', () => this.closeSlideshowModal());


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

        const savedPath = localStorage.getItem('slideshowSelectedPath');
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
        this.showFolderBrowser('source', (selectedPath) => {
            const field = document.getElementById('slideshow-folder-path');
            if (field) {
                this.persistSlideshowSelectedPath(selectedPath);
                this.showToast(`Pasta selecionada: ${selectedPath}`, 'success');
            } else {
                this.showToast('Erro: campo de pasta do slideshow nao encontrado', 'error');
            }
        });
    }


    // Navegar para pasta de fotos excluÃƒÂ­das
    browseDeletedFolder() {
        this.showFolderBrowser('source', (selectedPath) => {
            const field = document.getElementById('slideshow-deleted-folder');
            if (field) {
                field.value = selectedPath;
                this.showToast(`Pasta de fotos excluidas: ${selectedPath}`, 'success');
            } else {
                this.showToast('Erro: campo de pasta de fotos excluidas nao encontrado', 'error');
            }
        });
    }

    // Navegar para pasta de fotos ocultas
    browseHiddenFolder() {
        this.showFolderBrowser('source', (selectedPath) => {
            const field = document.getElementById('slideshow-hidden-folder');
            if (field) {
                field.value = selectedPath;
                this.showToast(`Pasta de fotos ocultas: ${selectedPath}`, 'success');
            } else {
                this.showToast('Erro: campo de pasta de fotos ocultas nao encontrado', 'error');
            }
        });
    }

    // Navegar pela pasta de fotos para ajustar
    browseAdjustableFolder() {
        this.showFolderBrowser('source', (selectedPath) => {
            const field = document.getElementById('slideshow-adjustable-folder');
            if (field) {
                field.value = selectedPath;
                this.showToast(`Pasta de fotos para ajustar: ${selectedPath}`, 'success');
            } else {
                this.showToast('Erro: campo de pasta para ajustar nao encontrado', 'error');
            }
        });
    }

    // Configurar event listeners para o modal de seleÃƒÂ§ÃƒÂ£o de pasta do slideshow
    setupSlideshowFolderEventListeners(modal) {
        // BotÃƒÂ£o fechar
        const closeBtn = modal.querySelector('.slideshow-folder-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }

        // BotÃƒÂ£o testar
        const testBtn = modal.querySelector('.slideshow-folder-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testFolderPath());
        }

        // BotÃƒÂµes de sugestÃƒÂ£o
        const suggestionBtns = modal.querySelectorAll('.slideshow-suggestion-btn');
        suggestionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const path = btn.getAttribute('data-path');
                this.selectSuggestedFolder(path);
            });
        });

        // BotÃƒÂ£o cancelar
        const cancelBtn = modal.querySelector('.slideshow-folder-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => modal.remove());
        }

        // BotÃƒÂ£o selecionar
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
            this.showToast('Digite um caminho vÃƒÂ¡lido', 'warning');
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
                this.showToast(`Ã¢Å“â€¦ Pasta encontrada! ${count} imagem(ns) localizada(s)`, 'success');
            } else {
                this.showToast('Ã¢ÂÅ’ Pasta nÃƒÂ£o encontrada ou inacessÃƒÂ­vel', 'error');
            }
        } catch (error) {
            this.showToast('Ã¢ÂÅ’ Erro ao testar pasta', 'error');
        }
    }

    // Confirmar seleÃƒÂ§ÃƒÂ£o de pasta
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
            folderPath = `${basePath}/${folderPath}`;
            console.log('Caminho relativo convertido para absoluto:', folderPath);
        }

        if (folderPath.includes('/_@LYT PicZ por ANO@_/_@LYT PicZ por ANO@_/')) {
            folderPath = folderPath.replace('/_@LYT PicZ por ANO@_/_@LYT PicZ por ANO@_/', '/_@LYT PicZ por ANO@_/');
            console.log('Caminho duplicado corrigido:', folderPath);
        }

        this.persistSlideshowSelectedPath(folderPath);
        this.applySlideshowConfigFromModal();
        this.closeSlideshowModal();

        console.log('Forcando busca recursiva para encontrar todas as imagens.');
        await this.loadSlideshowImages(folderPath, this.slideshowConfig.extensions, true, this.slideshowConfig.interval);
    }

    // Carregar imagens do slideshow
    async loadSlideshowImages(folderPath, extensions, recursive, interval) {
        try {
            console.log('Ã°Å¸â€Â Iniciando carregamento de imagens...');
            this.showToast('Ã°Å¸â€Â Procurando imagens...', 'info');

            // Preparar extensÃƒÂµes para a API
            const formattedExtensions = extensions.map(ext => ext.startsWith('.') ? ext : '.' + ext);

            // SEMPRE forÃƒÂ§ar busca recursiva para encontrar TODAS as imagens
            const forceRecursive = true;

            console.log('Ã°Å¸â€œÂ¡ Enviando requisiÃƒÂ§ÃƒÂ£o para API...');
            console.log('Ã°Å¸â€â€” Caminho sendo enviado:', folderPath);
            console.log('Ã°Å¸â€Â§ ExtensÃƒÂµes formatadas:', formattedExtensions);
            console.log('Ã°Å¸â€â€ž Recursivo (forÃƒÂ§ado):', forceRecursive);
            console.log('Ã°Å¸Å½Â¯ Buscando TODAS as imagens em:', folderPath, 'e todas as subpastas');

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

            console.log('Ã°Å¸â€œÂ¡ Resposta recebida:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Ã°Å¸â€œÅ  Resultado da API:', result);
            console.log('Ã°Å¸â€œÅ  Estrutura da resposta:', {
                success: result.success,
                hasData: !!result.data,
                hasImages: !!(result.data && result.data.images),
                imageCount: result.data?.images?.length || 0
            });

            if (!result.success) {
                throw new Error(result.error?.message || 'Erro ao listar imagens');
            }

            // Verificar se a estrutura da resposta estÃƒÂ¡ correta
            if (!result.data || !result.data.images) {
                console.error('Ã¢ÂÅ’ Estrutura de resposta invÃƒÂ¡lida:', result);
                throw new Error('Resposta da API nÃƒÂ£o contÃƒÂ©m dados de imagens');
            }

            this.slideshowImages = result.data.images;
            this.slideshowInterval = interval * 1000;

            console.log('Ã°Å¸â€œÂ¸ Imagens carregadas:', this.slideshowImages.length);

            if (this.slideshowImages.length === 0) {
                this.showToast('Nenhuma imagem encontrada na pasta', 'warning');
                return;
            }

            // Aplicar modo aleatÃƒÂ³rio se configurado
            if (this.slideshowConfig.random) {
            this.shuffleArray(this.slideshowImages);
            console.log('Ã°Å¸Å½Â² Imagens embaralhadas para ordem aleatÃƒÂ³ria');
            }

            // Limpar cache de prÃƒÂ©-carregamento
            this.preloadedImages.clear();

            const modeText = this.slideshowConfig.random ? ' (ordem aleatÃƒÂ³ria)' : ' (ordem sequencial)';
            this.showToast(`Ã¢Å“â€¦ ${this.slideshowImages.length} imagens encontradas${modeText}`, 'success');
            this.startSlideshowViewer();

        } catch (error) {
            console.error('Erro ao carregar imagens:', error);
            this.showToast('Erro ao carregar imagens: ' + error.message, 'error');
        }
    }

    // PrÃƒÂ©-carregar imagem
    preloadImage(imagePath) {
        return new Promise((resolve, reject) => {
            if (this.preloadedImages.has(imagePath)) {
                resolve(this.preloadedImages.get(imagePath));
                return;
            }

            const img = new Image();
            img.onload = () => {
                this.preloadedImages.set(imagePath, img);
                console.log('Ã°Å¸â€“Â¼Ã¯Â¸Â Imagem prÃƒÂ©-carregada:', imagePath);
                resolve(img);
            };
            img.onerror = () => {
                console.warn('Ã¢Å¡Â Ã¯Â¸Â Erro ao prÃƒÂ©-carregar imagem:', imagePath);
                reject(new Error('Erro ao carregar imagem'));
            };
            img.src = imagePath;
        });
    }

    // PrÃƒÂ©-carregar prÃƒÂ³xima imagem se habilitado
    async preloadNextImage() {
        if (!this.slideshowConfig.preload || this.slideshowImages.length <= 1) {
            return;
        }

        // Limitar prÃƒÂ©-carregamento para apenas 1 imagem (prÃƒÂ³xima)
        if (this.preloadedImages.size >= 1) {
            return; // MÃƒÂ¡ximo 1 imagem prÃƒÂ©-carregada
        }

        const nextIndex = (this.currentSlideIndex + 1) % this.slideshowImages.length;
        const nextImagePath = this.slideshowImages[nextIndex];

        // Construir URL corretamente
        const imageUrl = `/api/files/image/${encodeURIComponent(nextImagePath.path)}`;

        try {
            await this.preloadImage(imageUrl);
        } catch (error) {
            console.warn('Erro ao prÃƒÂ©-carregar prÃƒÂ³xima imagem:', error);
        }
    }

    // Iniciar viewer do slideshow
    startSlideshowViewer() {
        console.log('Ã°Å¸Å½Â¬ Iniciando viewer do slideshow...');
        console.log('Ã°Å¸â€œÂ¸ Imagens disponÃƒÂ­veis:', this.slideshowImages?.length || 0);
        console.log('Ã°Å¸â€œÂ¸ Primeira imagem:', this.slideshowImages?.[0]);
        
        // Limpar elementos antigos se existirem
        const oldElement = document.getElementById('slideshow-image-new');
        if (oldElement) {
            oldElement.remove();
            console.log('Ã°Å¸Â§Â¹ Elemento antigo removido');
        }
        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            console.error('Ã¢ÂÅ’ Nenhuma imagem disponÃƒÂ­vel para slideshow');
            this.showToast('Nenhuma imagem encontrada para o slideshow', 'error');
            return;
        }
        
        // Mostrar viewer
        const viewer = document.getElementById('slideshow-viewer');
        console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â Elemento viewer encontrado:', !!viewer);
        
        if (viewer) {
            console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â Estilo atual do viewer:', {
                display: viewer.style.display,
                visibility: viewer.style.visibility,
                opacity: viewer.style.opacity,
                zIndex: viewer.style.zIndex
            });
            
            viewer.style.display = 'flex';
            console.log('Ã¢Å“â€¦ Viewer exibido');
            
            // Mostrar controles estÃƒÂ¡ticos quando o viewer for exibido
            const staticControls = document.getElementById('static-slideshow-controls');
            if (staticControls) {
                staticControls.style.display = 'block';
                console.log('Ã¢Å“â€¦ Controles estÃƒÂ¡ticos exibidos com o viewer');
                
                // Configurar event listeners se ainda nÃƒÂ£o foram configurados
                this.setupStaticButtons();
            }
            
            console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â Estilo apÃƒÂ³s exibir:', {
                display: viewer.style.display,
                visibility: viewer.style.visibility,
                opacity: viewer.style.opacity
            });
        } else {
            console.error('Ã¢ÂÅ’ Elemento slideshow-viewer nÃƒÂ£o encontrado no DOM');
            this.showToast('Erro: Elemento de visualizaÃƒÂ§ÃƒÂ£o nÃƒÂ£o encontrado', 'error');
            return;
        }
        
        this.currentSlideIndex = 0;
        this.slideshowPlaying = true;
        console.log('Ã°Å¸Å½Â¯ ConfiguraÃƒÂ§ÃƒÂµes do slideshow:', {
            currentSlideIndex: this.currentSlideIndex,
            slideshowPlaying: this.slideshowPlaying,
            totalImages: this.slideshowImages.length
        });

        // Entrar em fullscreen automaticamente
        this.enterFullscreen();

        // Atualizar exibiÃƒÂ§ÃƒÂ£o e iniciar auto-play APÃƒâ€œS a imagem ser carregada
        this.updateSlideDisplay();
    }

    // Entrar em fullscreen
    enterFullscreen() {
        console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â Entrando em fullscreen...');
        
        const viewer = document.getElementById('slideshow-viewer');
        if (!viewer) return;

        // Tentar diferentes mÃƒÂ©todos de fullscreen
        if (viewer.requestFullscreen) {
            viewer.requestFullscreen().catch(err => {
                console.warn('Erro ao entrar em fullscreen:', err);
            });
        } else if (viewer.webkitRequestFullscreen) {
            viewer.webkitRequestFullscreen();
        } else if (viewer.mozRequestFullScreen) {
            viewer.mozRequestFullScreen();
        } else if (viewer.msRequestFullscreen) {
            viewer.msRequestFullscreen();
        } else {
            console.warn('Fullscreen nÃƒÂ£o suportado neste navegador');
        }
    }

    // Sair do fullscreen
    exitFullscreen() {
        console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â Saindo do fullscreen...');
        
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    // Lidar com mudanÃƒÂ§as de fullscreen
    handleFullscreenChange() {
        console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â MudanÃƒÂ§a de fullscreen detectada');
        
        const isFullscreen = !!(document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement || 
                               document.msFullscreenElement);
        
        console.log('Ã°Å¸â€Â Fullscreen ativo:', isFullscreen);
        
        const viewer = document.getElementById('slideshow-viewer');
        const viewerVisible = viewer && window.getComputedStyle(viewer).display !== 'none';
        const slideshowActive = viewerVisible && (
            this.screensaverState?.isActive || (Array.isArray(this.slideshowImages) && this.slideshowImages.length > 0)
        );
        if (!slideshowActive) {
            return;
        }

        // Garantir que os controles estÃƒÂ¡ticos permaneÃƒÂ§am visÃƒÂ­veis
        const staticControls = document.getElementById('static-slideshow-controls');
        if (staticControls) {
            staticControls.style.display = 'block';
            staticControls.style.zIndex = '999999';
            console.log('Ã¢Å“â€¦ Controles estÃƒÂ¡ticos mantidos visÃƒÂ­veis apÃƒÂ³s mudanÃƒÂ§a de fullscreen');
        }
        
        // Garantir que o viewer permaneÃƒÂ§a visÃÂ­vel no contexto do slideshow/screenaver
        if (viewer) {
            viewer.style.display = 'flex';
            console.log('Ã¢Å“â€¦ Viewer mantido visÃƒÂ­vel apÃƒÂ³s mudanÃƒÂ§a de fullscreen');
        }
    }

    // Atualizar exibiÃƒÂ§ÃƒÂ£o do slide atual
    async updateSlideDisplay() {
        console.log('Ã°Å¸â€“Â¼Ã¯Â¸Â Atualizando exibiÃƒÂ§ÃƒÂ£o do slide...');
        
        // Verificar contexto geral antes de prosseguir
        console.log('Ã°Å¸Å’Â Contexto geral:', {
            documentReady: document.readyState,
            windowLoaded: window.onload ? 'loaded' : 'not loaded',
            slideshowPlaying: this.slideshowPlaying,
            currentSlideIndex: this.currentSlideIndex,
            totalImages: this.slideshowImages?.length || 0
        });
        
        // Garantir que os controles estÃƒÂ¡ticos existam
        if (this.slideshowImages && this.slideshowImages.length > 0) {
            console.log('Ã°Å¸Å½Â® Usando controles estÃƒÂ¡ticos...');
            this.createDynamicSlideshowControls();
        }
        
        let imageElement = document.getElementById('slideshow-image');
        const counterElement = document.getElementById('slideshow-counter');
        const filenameElement = document.getElementById('slideshow-filename');
        const loadingElement = document.getElementById('slideshow-loading');
        const errorElement = document.getElementById('slideshow-error');
        const imageContainer = document.querySelector('.slideshow-image-container');
        
        // Se nÃƒÂ£o encontrar o elemento slideshow-image, tentar encontrar o slideshow-image-new
        if (!imageElement) {
            imageElement = document.getElementById('slideshow-image-new');
            if (imageElement) {
                console.log('Ã°Å¸â€â€ž Usando elemento slideshow-image-new encontrado');
            }
        }

        // Verificar se o slideshow-viewer estÃƒÂ¡ visÃƒÂ­vel
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) {
            console.log('Ã°Å¸Å½Â¬ Estado do viewer:', {
                display: viewer.style.display,
                visibility: viewer.style.visibility,
                rect: viewer.getBoundingClientRect()
            });
        }
        
        console.log('Ã°Å¸â€Â Elementos encontrados:', {
            imageElement: !!imageElement,
            counterElement: !!counterElement,
            filenameElement: !!filenameElement,
            loadingElement: !!loadingElement,
            errorElement: !!errorElement,
            imageContainer: !!imageContainer
        });
        
        if (imageContainer) {
            console.log('Ã°Å¸â€œÂ¦ Container da imagem:', {
                display: imageContainer.style.display,
                visibility: imageContainer.style.visibility,
                opacity: imageContainer.style.opacity,
                position: imageContainer.style.position,
                zIndex: imageContainer.style.zIndex
            });
            
            // FORÃƒâ€¡AR ESTILOS NO CONTAINER para garantir que a imagem seja exibida
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
            
            console.log('Ã°Å¸â€œÂ¦ Container apÃƒÂ³s forÃƒÂ§ar estilos:', {
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

        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            console.log('Ã¢ÂÅ’ Nenhuma imagem carregada');
            if (loadingElement) loadingElement.style.display = 'none';
            if (errorElement) errorElement.style.display = 'block';
            if (imageElement) imageElement.style.display = 'none';
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        console.log('Ã°Å¸â€œÂ¸ Imagem atual:', currentImage);

        // Mostrar loading
        if (loadingElement) loadingElement.style.display = 'block';
        if (errorElement) errorElement.style.display = 'none';
        if (imageElement) imageElement.style.display = 'none';

        // Atualizar contador e nome do arquivo
        if (counterElement) counterElement.textContent = `${this.currentSlideIndex + 1} / ${this.slideshowImages.length}`;
        if (filenameElement) filenameElement.textContent = currentImage.name;
        
        // Atualizar caminho completo da imagem no rodapÃƒÂ©
        const pathElement = document.getElementById('slideshow-path');
        if (pathElement) {
            pathElement.textContent = currentImage.path;
        }

        // Construir URL da imagem
        const imageUrl = `/api/files/image/${encodeURIComponent(currentImage.path)}`;
        console.log('Ã°Å¸â€â€” URL da imagem:', imageUrl);
        console.log('Ã°Å¸â€â€” Caminho original:', currentImage.path);
        console.log('Ã°Å¸â€â€” Caminho codificado:', encodeURIComponent(currentImage.path));

        try {
            // Carregar imagem diretamente
            const img = new Image();
            
            // Timeout para evitar loading infinito
            const loadTimeout = setTimeout(() => {
                console.error('Ã¢ÂÂ° Timeout ao carregar imagem:', imageUrl);
                if (loadingElement) loadingElement.style.display = 'none';
                if (imageElement) imageElement.style.display = 'none';
                if (errorElement) errorElement.style.display = 'block';
            }, 10000); // 10 segundos timeout
            
            img.onload = () => {
                clearTimeout(loadTimeout);
                console.log('Ã¢Å“â€¦ Imagem carregada com sucesso:', imageUrl);

                if (imageElement) {
                    // SOLUÃƒâ€¡ÃƒÆ’O RADICAL: Criar novo elemento se o atual nÃƒÂ£o funcionar
                    let targetElement = imageElement;
                    
                    // REMOVER imagem anterior para evitar empilhamento
                    const existingDynamicImage = document.getElementById('slideshow-image-new');
                    if (existingDynamicImage) {
                        existingDynamicImage.remove();
                        console.log('Ã°Å¸â€”â€˜Ã¯Â¸Â Imagem anterior removida para evitar empilhamento');
                    }
                    
                    // Verificar se o elemento atual tem problemas
                    const currentRect = imageElement.getBoundingClientRect();
                    if (currentRect.width === 0 || currentRect.height === 0) {
                        console.warn('Ã¢Å¡Â Ã¯Â¸Â Elemento atual tem dimensÃƒÂµes zero, criando novo elemento...');
                        
                        // Criar novo elemento de imagem
                        const newImageElement = document.createElement('img');
                        newImageElement.id = 'slideshow-image-new';
                        newImageElement.className = 'slideshow-image-new';
                        newImageElement.alt = currentImage.name;
                        
                        // Aplicar estilos diretamente no elemento (compatÃƒÂ­vel com Raspberry Pi)
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
                        
                        // Aplicar estilos individualmente para mÃƒÂ¡xima compatibilidade
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
                            console.log('Ã¢Å“â€¦ Imagem adicionada DENTRO do slideshow-viewer');
                            
                            // Esconder a imagem original para evitar sobreposiÃƒÂ§ÃƒÂ£o
                            const originalImage = document.getElementById('slideshow-image');
                            if (originalImage) {
                                originalImage.style.display = 'none';
                                console.log('Ã¢Å“â€¦ Imagem original escondida para evitar sobreposiÃƒÂ§ÃƒÂ£o');
                            }
                        } else {
                            document.body.appendChild(newImageElement);
                            console.log('Ã¢Å¡Â Ã¯Â¸Â slideshow-viewer nÃƒÂ£o encontrado, adicionando ao body');
                        }
                        targetElement = newImageElement;
                        
                        // Garantir que a imagem esteja dentro do viewer mas abaixo dos controles estÃƒÂ¡ticos
                        newImageElement.style.zIndex = '1';
                        newImageElement.style.pointerEvents = 'none';
                        
                        // Adicionar fundo preto atrÃƒÂ¡s de tudo
                        document.body.style.background = 'black';
                        document.body.style.overflow = 'hidden';
                        document.body.style.cursor = 'default';
                        
                        // MANTER o slideshow-viewer visÃƒÂ­vel para que os botÃƒÂµes estÃƒÂ¡ticos sejam exibidos
                        if (slideshowViewer) {
                            // NÃƒÆ’O ESCONDER! Os botÃƒÂµes estÃƒÂ¡ticos estÃƒÂ£o dentro dele
                            console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â Slideshow viewer mantido visÃƒÂ­vel para preservar botÃƒÂµes estÃƒÂ¡ticos');
                        }
                        
                        // Criar controles de navegaÃƒÂ§ÃƒÂ£o para a imagem dinÃƒÂ¢mica
                        // Usar controles estÃƒÂ¡ticos
                        this.createDynamicSlideshowControls();
                        console.log('Ã°Å¸Å½Â® Controles estÃƒÂ¡ticos configurados');
                        
                        console.log('Ã°Å¸â€ â€¢ Novo elemento criado e adicionado ao body');
                        console.log('Ã°Å¸â€Â Debug Raspberry Pi - Elemento criado:', {
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

                    // Se for o elemento original, aplicar estilos bÃƒÂ¡sicos
                    if (targetElement === imageElement) {
                        targetElement.style.setProperty('display', 'block', 'important');
                        targetElement.style.setProperty('visibility', 'visible', 'important');
                        targetElement.style.setProperty('opacity', '1', 'important');
                        targetElement.style.setProperty('width', '90vw', 'important');
                        targetElement.style.setProperty('height', '90vh', 'important');
                        targetElement.style.setProperty('object-fit', 'contain', 'important');
                        targetElement.style.setProperty('border', '3px solid #4CAF50', 'important');
                    }

                    console.log('Ã°Å¸â€“Â¼Ã¯Â¸Â Imagem exibida no elemento:', targetElement.src);
                    console.log('Ã°Å¸â€“Â¼Ã¯Â¸Â Tipo de elemento:', targetElement.tagName);
                    console.log('Ã°Å¸â€“Â¼Ã¯Â¸Â ID do elemento:', targetElement.id);
                    
                    // ForÃƒÂ§ar reflow para garantir que os estilos sejam aplicados
                    targetElement.offsetHeight;
                    targetElement.offsetWidth;

                    // ForÃƒÂ§ar reflow mÃƒÂºltiplas vezes
                    targetElement.offsetHeight;
                    targetElement.offsetWidth;
                    targetElement.getBoundingClientRect();
                    
                    // VerificaÃƒÂ§ÃƒÂ£o final das dimensÃƒÂµes
                    setTimeout(() => {
                        const finalRect = targetElement.getBoundingClientRect();
                        console.log('Ã°Å¸â€Â VerificaÃƒÂ§ÃƒÂ£o final das dimensÃƒÂµes:', {
                            width: finalRect.width,
                            height: finalRect.height,
                            visible: finalRect.width > 0 && finalRect.height > 0
                        });
                        
                        // Debug especÃƒÂ­fico para Raspberry Pi
                        console.log('Ã°Å¸Ââ€œ Debug Raspberry Pi - Estado final:', {
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
                            console.error('Ã°Å¸Å¡Â¨ FALHA CRÃƒÂTICA: Imagem ainda com dimensÃƒÂµes zero apÃƒÂ³s todas as correÃƒÂ§ÃƒÂµes!');
                            console.error('Ã°Å¸Ââ€œ Raspberry Pi - Tentando soluÃƒÂ§ÃƒÂ£o de emergÃƒÂªncia...');
                            
                            // SoluÃƒÂ§ÃƒÂ£o de emergÃƒÂªncia especÃƒÂ­fica para Raspberry Pi
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
                            
                            // ForÃƒÂ§ar reflow
                            targetElement.offsetHeight;
                            targetElement.offsetWidth;
                            
                            console.log('Ã°Å¸Ââ€œ Raspberry Pi - SoluÃƒÂ§ÃƒÂ£o de emergÃƒÂªncia aplicada');
                        } else {
                            console.log('Ã¢Å“â€¦ Imagem exibida com sucesso!');
                            console.log('Ã°Å¸Ââ€œ Raspberry Pi - Slideshow funcionando corretamente!');
                        }
                    }, 100);

                    // Verificar contexto do documento
                    console.log('Ã°Å¸â€œâ€ž Contexto do documento:', {
                        readyState: document.readyState,
                        hidden: document.hidden,
                        visibilityState: document.visibilityState
                    });

                    // Verificar se estÃƒÂ¡ no viewport correto
                    const rect = targetElement.getBoundingClientRect();
                    const viewport = {
                        width: window.innerWidth,
                        height: window.innerHeight,
                        scrollX: window.scrollX,
                        scrollY: window.scrollY
                    };

                    console.log('Ã°Å¸â€“Â¼Ã¯Â¸Â PosiÃƒÂ§ÃƒÂ£o da imagem:', {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                        visible: rect.width > 0 && rect.height > 0,
                        inViewport: rect.top >= 0 && rect.left >= 0 &&
                                   rect.bottom <= viewport.height &&
                                   rect.right <= viewport.width
                    });

                    console.log('Ã°Å¸â€“Â¼Ã¯Â¸Â Viewport:', viewport);

                    // ForÃƒÂ§ar renderizaÃƒÂ§ÃƒÂ£o adicional se ainda nÃƒÂ£o estiver visÃƒÂ­vel
                    if (rect.width === 0 || rect.height === 0) {
                        console.error('Ã°Å¸Å¡Â¨ CRÃƒÂTICO: Imagem ainda com dimensÃƒÂµes zero apÃƒÂ³s todas as tentativas!');

                        // ÃƒÅ¡ltimo recurso: forÃƒÂ§ar com setTimeout
                        setTimeout(() => {
                            console.log('Ã¢ÂÂ° Tentativa final com setTimeout...');
                            targetElement.style.setProperty('width', '400px', 'important');
                            targetElement.style.setProperty('height', '400px', 'important');
                            targetElement.style.setProperty('position', 'absolute', 'important');
                            targetElement.style.setProperty('top', '50%', 'important');
                            targetElement.style.setProperty('left', '50%', 'important');
                            targetElement.style.setProperty('transform', 'translate(-50%, -50%)', 'important');

                            const finalRect = targetElement.getBoundingClientRect();
                            console.log('Ã°Å¸â€“Â¼Ã¯Â¸Â PosiÃƒÂ§ÃƒÂ£o FINAL:', {
                                top: finalRect.top,
                                left: finalRect.left,
                                width: finalRect.width,
                                height: finalRect.height,
                                visible: finalRect.width > 0 && finalRect.height > 0
                            });
                        }, 100);
                    }
                } else {
                    console.error('Ã¢ÂÅ’ Elemento slideshow-image nÃƒÂ£o encontrado!');
                    // Tentar encontrar o elemento novamente
                    const imageElement = document.getElementById('slideshow-image') || document.querySelector('.slideshow-image');
                    if (imageElement) {
                        console.log('Ã¢Å“â€¦ Elemento encontrado na segunda tentativa');
                imageElement.src = imageUrl;
            imageElement.style.display = 'block';
                        imageElement.style.visibility = 'visible';
                        imageElement.style.opacity = '1';
                    } else {
                        console.error('Ã¢ÂÅ’ Elemento slideshow-image ainda nÃƒÂ£o encontrado apÃƒÂ³s segunda tentativa');
                    }
                }

                if (loadingElement) loadingElement.style.display = 'none';
                if (errorElement) errorElement.style.display = 'none';
                
                // Iniciar auto-play apenas na primeira imagem carregada
                if (this.currentSlideIndex === 0 && this.slideshowPlaying) {
                    console.log('Ã°Å¸Å½Â¬ Iniciando auto-play apÃƒÂ³s primeira imagem carregada');
                    this.startAutoPlay();
                }
                
                // PrÃƒÂ©-carregar prÃƒÂ³xima imagem
                this.preloadNextImage();
            };
            
            img.onerror = (error) => {
                clearTimeout(loadTimeout);
                console.error('Ã¢ÂÅ’ Erro ao carregar imagem:', error);
                console.error('Ã¢ÂÅ’ URL que falhou:', imageUrl);
                if (loadingElement) loadingElement.style.display = 'none';
                if (imageElement) imageElement.style.display = 'none';
                if (errorElement) errorElement.style.display = 'block';
            };

            console.log('Ã°Å¸â€â€ž Tentando carregar imagem:', imageUrl);
            img.src = imageUrl;
            
        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao carregar imagem:', error);
            if (loadingElement) loadingElement.style.display = 'none';
            if (imageElement) imageElement.style.display = 'none';
            if (errorElement) errorElement.style.display = 'block';
        }
    }

    // PrÃƒÂ³ximo slide
    nextSlide() {
        if (this.slideshowImages.length === 0) return;

        console.log('Ã¢Å¾Â¡Ã¯Â¸Â Navegando para prÃƒÂ³ximo slide...');
        console.log('Ã°Å¸â€œÅ  Estado atual:', {
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
        if (this.slideshowImages.length === 0) return;

        console.log('Ã¢Â¬â€¦Ã¯Â¸Â Navegando para slide anterior...');
        console.log('Ã°Å¸â€œÅ  Estado atual:', {
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

    // Iniciar reproduÃƒÂ§ÃƒÂ£o automÃƒÂ¡tica
    startAutoPlay() {
        this.stopAutoPlay(); // Parar qualquer intervalo existente

        if (this.slideshowPlaying && this.slideshowImages.length > 1) {
            const intervalMs = this.slideshowConfig.interval * 1000;
            this.autoPlayInterval = setInterval(() => {
                console.log('Ã¢ÂÂ° Auto-play: mudando para prÃƒÂ³ximo slide...');
                this.nextSlide();
            }, intervalMs);
            console.log(`Ã¢ÂÂ° Auto-play iniciado com intervalo de ${this.slideshowConfig.interval}s`);
        } else {
            console.log('Ã¢ÂÂ° Auto-play nÃƒÂ£o iniciado:', {
                slideshowPlaying: this.slideshowPlaying,
                imageCount: this.slideshowImages.length
            });
        }
    }

    // Parar reproduÃƒÂ§ÃƒÂ£o automÃƒÂ¡tica
    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }

    // Criar controles de navegaÃƒÂ§ÃƒÂ£o para slideshow dinÃƒÂ¢mico
    createDynamicSlideshowControls() {
        console.log('Ã°Å¸â€Â¥ USANDO BOTÃƒâ€¢ES ESTÃƒÂTICOS - SOLUÃƒâ€¡ÃƒÆ’O DEFINITIVA');
        
        // Remover controles dinÃƒÂ¢micos antigos se existirem
        const oldControls = document.getElementById('dynamic-slideshow-controls');
        if (oldControls) {
            oldControls.remove();
        }
        
        // Mostrar controles estÃƒÂ¡ticos
        const staticControls = document.getElementById('static-slideshow-controls');
        if (staticControls) {
            staticControls.style.display = 'block';
            console.log('Ã¢Å“â€¦ Controles estÃƒÂ¡ticos exibidos dentro do slideshow-viewer');
        } else {
            console.error('Ã¢ÂÅ’ Controles estÃƒÂ¡ticos nÃƒÂ£o encontrados');
        }
        
        // Configurar event listeners para botÃƒÂµes estÃƒÂ¡ticos
        this.setupStaticButtons();
        
        this.dynamicControlsCreated = true;
        
        // Atualizar contador
        this.updateStaticCounter();
    }
    
    setupStaticButtons() {
        console.log('Ã°Å¸â€Â§ Configurando botÃƒÂµes estÃƒÂ¡ticos...');
        console.log('Ã°Å¸â€Â DEBUG - setupStaticButtons chamada');
        console.log('Ã°Å¸â€Â DEBUG - this context:', this);
        console.log('Ã°Å¸â€Â DEBUG - window.deParaUI:', window.deParaUI);
        
        // BotÃƒÂ£o anterior
        const prevBtn = document.getElementById('static-prev-btn');
        console.log('Ã°Å¸â€Â BotÃƒÂ£o anterior encontrado:', !!prevBtn);
        if (prevBtn && !prevBtn.hasAttribute('data-listener-added')) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Ã¢Â¬â€¦Ã¯Â¸Â BotÃƒÂ£o anterior clicado (ESTÃƒÂTICO)');
                console.log('Ã°Å¸â€Â Fullscreen ativo:', !!document.fullscreenElement);
                this.previousSlide();
            });
            prevBtn.setAttribute('data-listener-added', 'true');
            console.log('Ã¢Å“â€¦ Event listener anterior adicionado');
        }
        
        // BotÃƒÂ£o prÃƒÂ³ximo
        const nextBtn = document.getElementById('static-next-btn');
        console.log('Ã°Å¸â€Â BotÃƒÂ£o prÃƒÂ³ximo encontrado:', !!nextBtn);
        if (nextBtn && !nextBtn.hasAttribute('data-listener-added')) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Ã¢Å¾Â¡Ã¯Â¸Â BotÃƒÂ£o prÃƒÂ³ximo clicado (ESTÃƒÂTICO)');
                console.log('Ã°Å¸â€Â Fullscreen ativo:', !!document.fullscreenElement);
                this.nextSlide();
            });
            nextBtn.setAttribute('data-listener-added', 'true');
            console.log('Ã¢Å“â€¦ Event listener prÃƒÂ³ximo adicionado');
        }
        
        // BotÃƒÂ£o fechar
        const closeBtn = document.getElementById('static-close-btn');
        if (closeBtn && !closeBtn.hasAttribute('data-listener-added')) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Ã¢ÂÅ’ BotÃƒÂ£o fechar clicado (ESTÃƒÂTICO)');
                this.closeSlideshowViewer();
            });
            closeBtn.setAttribute('data-listener-added', 'true');
        }
        
        // BotÃƒÂ£o apagar
        const deleteBtn = document.getElementById('static-delete-btn');
        console.log('Ã°Å¸â€Â DEBUG - BotÃƒÂ£o delete encontrado:', !!deleteBtn);
        if (deleteBtn) {
            console.log('Ã°Å¸â€Â DEBUG - BotÃƒÂ£o delete jÃƒÂ¡ tem listener:', deleteBtn.hasAttribute('data-listener-added'));
        }
        
        if (deleteBtn && !deleteBtn.hasAttribute('data-listener-added')) {
            console.log('Ã°Å¸â€Â DEBUG - Adicionando listener ao botÃƒÂ£o delete');
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Ã°Å¸â€”â€˜Ã¯Â¸Â BotÃƒÂ£o apagar clicado (ESTÃƒÂTICO)');
                console.log('Ã°Å¸â€Â DEBUG - window.deParaUI disponÃƒÂ­vel:', !!window.deParaUI);
                console.log('Ã°Å¸â€Â DEBUG - deleteCurrentImage disponÃƒÂ­vel:', !!(window.deParaUI && typeof window.deParaUI.deleteCurrentImage === 'function'));
                
                // Usar window.deParaUI para garantir contexto correto
                if (window.deParaUI && typeof window.deParaUI.deleteCurrentImage === 'function') {
                    console.log('Ã°Å¸â€Â DEBUG - Chamando deleteCurrentImage');
                    window.deParaUI.deleteCurrentImage();
                } else {
                    console.error('Ã¢ÂÅ’ DeParaUI nÃƒÂ£o disponÃƒÂ­vel ou mÃƒÂ©todo nÃƒÂ£o encontrado');
                    console.error('Ã¢ÂÅ’ window.deParaUI:', window.deParaUI);
                    console.error('Ã¢ÂÅ’ typeof deleteCurrentImage:', typeof window.deParaUI?.deleteCurrentImage);
                }
            });
            deleteBtn.setAttribute('data-listener-added', 'true');
            console.log('Ã¢Å“â€¦ Listener do botÃƒÂ£o delete adicionado');
        }
        
        // BotÃƒÂ£o ocultar
        const hideBtn = document.getElementById('static-hide-btn');
        console.log('Ã°Å¸â€Â DEBUG - BotÃƒÂ£o hide encontrado:', !!hideBtn);
        if (hideBtn) {
            console.log('Ã°Å¸â€Â DEBUG - BotÃƒÂ£o hide jÃƒÂ¡ tem listener:', hideBtn.hasAttribute('data-listener-added'));
        }
        
        if (hideBtn && !hideBtn.hasAttribute('data-listener-added')) {
            console.log('Ã°Å¸â€Â DEBUG - Adicionando listener ao botÃƒÂ£o hide');
            hideBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Ã°Å¸â€˜ÂÃ¯Â¸Â BotÃƒÂ£o ocultar clicado (ESTÃƒÂTICO)');
                console.log('Ã°Å¸â€Â DEBUG - window.deParaUI disponÃƒÂ­vel:', !!window.deParaUI);
                console.log('Ã°Å¸â€Â DEBUG - hideCurrentImage disponÃƒÂ­vel:', !!(window.deParaUI && typeof window.deParaUI.hideCurrentImage === 'function'));
                
                // Usar window.deParaUI para garantir contexto correto
                if (window.deParaUI && typeof window.deParaUI.hideCurrentImage === 'function') {
                    console.log('Ã°Å¸â€Â DEBUG - Chamando hideCurrentImage');
                    window.deParaUI.hideCurrentImage();
                } else {
                    console.error('Ã¢ÂÅ’ DeParaUI nÃƒÂ£o disponÃƒÂ­vel ou mÃƒÂ©todo nÃƒÂ£o encontrado');
                    console.error('Ã¢ÂÅ’ window.deParaUI:', window.deParaUI);
                    console.error('Ã¢ÂÅ’ typeof hideCurrentImage:', typeof window.deParaUI?.hideCurrentImage);
                }
            });
            hideBtn.setAttribute('data-listener-added', 'true');
            console.log('Ã¢Å“â€¦ Listener do botÃƒÂ£o hide adicionado');
        }
        
        
        
        // BotÃƒÂ£o favoritar
        const favoriteBtn = document.getElementById('static-favorite-btn');
        console.log('Ã°Å¸â€Â DEBUG - BotÃƒÂ£o favoritar encontrado:', !!favoriteBtn);
        if (favoriteBtn && !favoriteBtn.hasAttribute('data-listener-added')) {
            favoriteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Ã¢Â­Â BotÃƒÂ£o favoritar clicado (ESTÃƒÂTICO)');
                this.favoriteCurrentImage();
            });
            favoriteBtn.setAttribute('data-listener-added', 'true');
            console.log('Ã¢Å“â€¦ Listener do botÃƒÂ£o favoritar adicionado');
        }

        // BotÃƒÂ£o ajustar
        const adjustBtn = document.getElementById('static-adjust-btn');
        console.log('Ã°Å¸â€Â DEBUG - BotÃƒÂ£o ajustar encontrado:', !!adjustBtn);
        if (adjustBtn && !adjustBtn.hasAttribute('data-listener-added')) {
            adjustBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Ã°Å¸â€Â§ BotÃƒÂ£o ajustar clicado (ESTÃƒÂTICO)');
                this.adjustCurrentImage();
            });
            adjustBtn.setAttribute('data-listener-added', 'true');
            console.log('Ã¢Å“â€¦ Listener do botÃƒÂ£o ajustar adicionado');
        }
        
        console.log('Ã¢Å“â€¦ Event listeners dos botÃƒÂµes estÃƒÂ¡ticos configurados');
    }
    
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
    
    // Atualizar contador dinÃƒÂ¢mico
    updateDynamicCounter() {
        // Usar botÃƒÂµes estÃƒÂ¡ticos se disponÃƒÂ­veis
        this.updateStaticCounter();
        
        // Fallback para botÃƒÂµes dinÃƒÂ¢micos se existirem
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

    // Apagar imagem atual (mover para pasta de excluÃƒÂ­das)
    async deleteCurrentImage() {
        console.log('Ã°Å¸â€Â DEBUG deleteCurrentImage - Iniciando...');
        console.log('Ã°Å¸â€Â slideshowImages:', this.slideshowImages);
        console.log('Ã°Å¸â€Â currentSlideIndex:', this.currentSlideIndex);
        console.log('Ã°Å¸â€Â slideshowConfig:', this.slideshowConfig);
        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            console.log('Ã¢ÂÅ’ Nenhuma imagem para apagar');
            this.showToast('Nenhuma imagem para apagar', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {
            console.log('Ã¢ÂÅ’ Imagem atual nÃƒÂ£o encontrada');
            this.showToast('Imagem atual nÃƒÂ£o encontrada', 'error');
            return;
        }

        if (!this.slideshowConfig.deletedFolder) {
            console.log('Ã¢ÂÅ’ Pasta de excluÃƒÂ­das nÃƒÂ£o configurada');
            this.showToast('Configure a pasta de fotos excluÃƒÂ­das nas configuraÃƒÂ§ÃƒÂµes', 'error');
            return;
        }

        try {
            console.log('Ã°Å¸â€”â€˜Ã¯Â¸Â Apagando imagem:', currentImage.path);
            console.log('Ã°Å¸â€œÂ Movendo para pasta:', this.slideshowConfig.deletedFolder);

            // Verificar se pasta de destino existe, se nÃƒÂ£o, criar
            console.log('Ã°Å¸â€œÂ Pasta de destino configurada:', this.slideshowConfig.deletedFolder);
            
            // Pasta de destino jÃƒÂ¡ configurada - prosseguir diretamente
            console.log('Ã¢Å“â€¦ Pasta de destino configurada, prosseguindo com operaÃƒÂ§ÃƒÂ£o');

            // Debug: Log dos dados sendo enviados
            const fileName = currentImage.name || currentImage.path.split('/').pop();
            const targetPath = `${this.slideshowConfig.deletedFolder}/${fileName}`;
            
            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath
            };
            console.log('Ã°Å¸â€Â DEBUG - Dados sendo enviados para API (DELETE):', requestData);
            console.log('Ã°Å¸â€Â DEBUG - sourcePath existe:', !!currentImage.path);
            console.log('Ã°Å¸â€Â DEBUG - targetPath existe:', !!this.slideshowConfig.deletedFolder);
            console.log('Ã°Å¸â€Â DEBUG - sourcePath tipo:', typeof currentImage.path);
            console.log('Ã°Å¸â€Â DEBUG - targetPath tipo:', typeof this.slideshowConfig.deletedFolder);
            console.log('Ã°Å¸â€Â DEBUG - fileName extraÃƒÂ­do:', fileName);
            console.log('Ã°Å¸â€Â DEBUG - targetPath completo:', targetPath);
            
            // Chamar API para mover arquivo
            console.log('Ã°Å¸â€œÂ¡ Enviando requisiÃƒÂ§ÃƒÂ£o para /api/files/execute...');
            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            console.log('Ã°Å¸â€œÂ¡ Resposta da API:', response.status, response.statusText);
            
            // Capturar detalhes do erro se houver
            if (!response.ok) {
                let errorDetails = {};
                try {
                    errorDetails = await response.json();
                    console.error('Ã¢ÂÅ’ Detalhes do erro da API:', errorDetails);
                } catch (e) {
                    console.error('Ã¢ÂÅ’ Erro ao parsear resposta de erro:', e);
                    try {
                        const errorText = await response.text();
                        console.error('Ã¢ÂÅ’ Resposta de erro (texto):', errorText);
                    } catch (textError) {
                        console.error('Ã¢ÂÅ’ Erro ao ler resposta como texto:', textError);
                    }
                }
            }
            
            if (response.ok) {
                const result = await response.json();
                console.log('Ã¢Å“â€¦ Imagem apagada com sucesso:', result);
                
                // Remover imagem da lista atual
                this.slideshowImages.splice(this.currentSlideIndex, 1);
                
                // Ajustar ÃƒÂ­ndice se necessÃƒÂ¡rio
                if (this.currentSlideIndex >= this.slideshowImages.length) {
                    this.currentSlideIndex = Math.max(0, this.slideshowImages.length - 1);
                }
                
                // Atualizar exibiÃƒÂ§ÃƒÂ£o
                if (this.slideshowImages.length > 0) {
                    this.updateSlideDisplay();
                    this.updateDynamicCounter();
                } else {
                    this.showToast('Todas as imagens foram apagadas', 'info');
                    this.closeSlideshowViewer();
                }
                
                this.showToast('Imagem apagada com sucesso', 'success');
            } else {
                console.error('Ã¢ÂÅ’ Erro ao apagar imagem - status:', response.status);
                this.showToast(`Erro ao apagar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao apagar imagem:', error);
            this.showToast('Erro ao apagar imagem', 'error');
        }
    }

    // Ocultar imagem atual (mover para pasta de ocultas)
    async hideCurrentImage() {
        console.log('Ã°Å¸â€Â DEBUG hideCurrentImage - Iniciando...');
        console.log('Ã°Å¸â€Â slideshowImages:', this.slideshowImages);
        console.log('Ã°Å¸â€Â currentSlideIndex:', this.currentSlideIndex);
        console.log('Ã°Å¸â€Â slideshowConfig:', this.slideshowConfig);
        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            console.log('Ã¢ÂÅ’ Nenhuma imagem para ocultar');
            this.showToast('Nenhuma imagem para ocultar', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {
            console.log('Ã¢ÂÅ’ Imagem atual nÃƒÂ£o encontrada');
            this.showToast('Imagem atual nÃƒÂ£o encontrada', 'error');
            return;
        }

        if (!this.slideshowConfig.hiddenFolder || this.slideshowConfig.hiddenFolder.trim() === '') {
            console.log('Ã¢ÂÅ’ Pasta de ocultas nÃƒÂ£o configurada');
            console.log('Ã¢ÂÅ’ slideshowConfig.hiddenFolder:', this.slideshowConfig.hiddenFolder);
            console.log('Ã¢ÂÅ’ slideshowConfig completo:', this.slideshowConfig);
            this.showToast('Configure a pasta de fotos ocultas nas configuraÃƒÂ§ÃƒÂµes', 'error');
            return;
        }
        
        console.log('Ã¢Å“â€¦ Pasta de ocultas configurada:', this.slideshowConfig.hiddenFolder);
        console.log('Ã¢Å“â€¦ ConfiguraÃƒÂ§ÃƒÂ£o completa:', this.slideshowConfig);

        try {
            console.log('Ã°Å¸â€˜ÂÃ¯Â¸Â Ocultando imagem:', currentImage.path);
            console.log('Ã°Å¸â€œÂ Movendo para pasta:', this.slideshowConfig.hiddenFolder);

            // Verificar se pasta de destino existe, se nÃƒÂ£o, criar
            console.log('Ã°Å¸â€œÂ Pasta de destino configurada:', this.slideshowConfig.hiddenFolder);
            
            // Pasta de destino jÃƒÂ¡ configurada - prosseguir diretamente
            console.log('Ã¢Å“â€¦ Pasta de destino configurada, prosseguindo com operaÃƒÂ§ÃƒÂ£o');

            // Debug: Log dos dados sendo enviados
            const fileName = currentImage.name || currentImage.path.split('/').pop();
            const targetPath = `${this.slideshowConfig.hiddenFolder}/${fileName}`;
            
            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath
            };
            console.log('Ã°Å¸â€Â DEBUG - Dados sendo enviados para API (HIDE):', requestData);
            console.log('Ã°Å¸â€Â DEBUG - sourcePath existe:', !!currentImage.path);
            console.log('Ã°Å¸â€Â DEBUG - targetPath existe:', !!this.slideshowConfig.hiddenFolder);
            console.log('Ã°Å¸â€Â DEBUG - sourcePath tipo:', typeof currentImage.path);
            console.log('Ã°Å¸â€Â DEBUG - targetPath tipo:', typeof this.slideshowConfig.hiddenFolder);
            console.log('Ã°Å¸â€Â DEBUG - fileName extraÃƒÂ­do:', fileName);
            console.log('Ã°Å¸â€Â DEBUG - targetPath completo:', targetPath);
            
            // Chamar API para mover arquivo
            console.log('Ã°Å¸â€œÂ¡ Enviando requisiÃƒÂ§ÃƒÂ£o para /api/files/execute...');
            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            console.log('Ã°Å¸â€œÂ¡ Resposta da API:', response.status, response.statusText);
            
            // Capturar detalhes do erro se houver
            if (!response.ok) {
                let errorDetails = {};
                try {
                    errorDetails = await response.json();
                    console.error('Ã¢ÂÅ’ Detalhes do erro da API:', errorDetails);
                } catch (e) {
                    console.error('Ã¢ÂÅ’ Erro ao parsear resposta de erro:', e);
                    try {
                        const errorText = await response.text();
                        console.error('Ã¢ÂÅ’ Resposta de erro (texto):', errorText);
                    } catch (textError) {
                        console.error('Ã¢ÂÅ’ Erro ao ler resposta como texto:', textError);
                    }
                }
            }
            
            if (response.ok) {
                const result = await response.json();
                console.log('Ã¢Å“â€¦ Imagem ocultada com sucesso:', result);
                
                // Remover imagem da lista atual
                this.slideshowImages.splice(this.currentSlideIndex, 1);
                
                // Ajustar ÃƒÂ­ndice se necessÃƒÂ¡rio
                if (this.currentSlideIndex >= this.slideshowImages.length) {
                    this.currentSlideIndex = Math.max(0, this.slideshowImages.length - 1);
                }
                
                // Atualizar exibiÃƒÂ§ÃƒÂ£o
                if (this.slideshowImages.length > 0) {
                    this.updateSlideDisplay();
                    this.updateDynamicCounter();
                } else {
                    this.showToast('Todas as imagens foram ocultadas', 'info');
                    this.closeSlideshowViewer();
                }
                
                this.showToast('Imagem ocultada com sucesso', 'success');
            } else {
                console.error('Ã¢ÂÅ’ Erro ao ocultar imagem - status:', response.status);
                this.showToast(`Erro ao ocultar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao ocultar imagem:', error);
            this.showToast('Erro ao ocultar imagem', 'error');
        }
    }

    // Favoritar imagem atual (mover para subpasta dentro da pasta atual)
    async favoriteCurrentImage() {
        console.log('Ã°Å¸â€Â DEBUG favoriteCurrentImage - Iniciando...');
        console.log('Ã°Å¸â€Â slideshowImages:', this.slideshowImages);
        console.log('Ã°Å¸â€Â currentSlideIndex:', this.currentSlideIndex);
        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            console.log('Ã¢ÂÅ’ Nenhuma imagem para favoritar');
            this.showToast('Nenhuma imagem para favoritar', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {
            console.log('Ã¢ÂÅ’ Imagem atual nÃƒÂ£o encontrada');
            this.showToast('Imagem atual nÃƒÂ£o encontrada', 'error');
            return;
        }

        try {
            console.log('Ã¢Â­Â Favoritando imagem:', currentImage.path);

            // Extrair diretÃƒÂ³rio pai da imagem atual
            const pathParts = currentImage.path.split('/');
            const fileName = pathParts.pop(); // Nome do arquivo
            const currentDir = pathParts.join('/'); // DiretÃƒÂ³rio atual da imagem
            const parentFolderName = pathParts[pathParts.length - 1] || 'Fotos';
            
            console.log('Ã°Å¸â€œÂ DiretÃƒÂ³rio atual da imagem:', currentDir);
            console.log('Ã°Å¸â€œÂ Nome da pasta pai:', parentFolderName);

            // Criar subdiretÃƒÂ³rio "Favoritas + Nome da pasta pai" DENTRO da pasta atual
            const favoritesSubDir = `Favoritas ${parentFolderName}`;
            const targetDir = `${currentDir}/${favoritesSubDir}`;
            console.log('Ã°Å¸â€œÂ SubdiretÃƒÂ³rio de favoritas:', favoritesSubDir);
            console.log('Ã°Å¸â€œÂ DiretÃƒÂ³rio completo de destino:', targetDir);

            const targetPath = `${targetDir}/${fileName}`;
            
            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath,
                createTargetDir: true // Flag para criar diretÃƒÂ³rio se nÃƒÂ£o existir
            };
            
            console.log('Ã°Å¸â€Â DEBUG - Dados sendo enviados para API (FAVORITE):', requestData);
            
            // Chamar API para mover arquivo
            console.log('Ã°Å¸â€œÂ¡ Enviando requisiÃƒÂ§ÃƒÂ£o para /api/files/execute...');
            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            console.log('Ã°Å¸â€œÂ¡ Resposta da API:', response.status, response.statusText);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Ã¢Å“â€¦ Imagem favoritada com sucesso:', result);
                
                // Remover imagem da lista atual
                this.slideshowImages.splice(this.currentSlideIndex, 1);
                
                // Ajustar ÃƒÂ­ndice se necessÃƒÂ¡rio
                if (this.currentSlideIndex >= this.slideshowImages.length) {
                    this.currentSlideIndex = Math.max(0, this.slideshowImages.length - 1);
                }
                
                // Atualizar exibiÃƒÂ§ÃƒÂ£o
                if (this.slideshowImages.length > 0) {
                    this.updateSlideDisplay();
                    this.updateDynamicCounter();
                } else {
                    this.showToast('Todas as imagens foram favoritadas', 'info');
                    this.closeSlideshowViewer();
                }
                
                this.showToast(`Imagem favoritada! Movida para: ${favoritesSubDir}`, 'success');
            } else {
                console.error('Ã¢ÂÅ’ Erro ao favoritar imagem - status:', response.status);
                this.showToast(`Erro ao favoritar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao favoritar imagem:', error);
            this.showToast('Erro ao favoritar imagem', 'error');
        }
    }

    // Ajustar imagem atual (mover para pasta configurada)
    async adjustCurrentImage() {
        console.log('Ã°Å¸â€Â DEBUG adjustCurrentImage - Iniciando...');
        console.log('Ã°Å¸â€Â slideshowImages:', this.slideshowImages);
        console.log('Ã°Å¸â€Â currentSlideIndex:', this.currentSlideIndex);
        console.log('Ã°Å¸â€Â adjustableFolder:', this.slideshowConfig.adjustableFolder);
        
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            console.log('Ã¢ÂÅ’ Nenhuma imagem para ajustar');
            this.showToast('Nenhuma imagem para ajustar', 'error');
            return;
        }

        if (!this.slideshowConfig.adjustableFolder || this.slideshowConfig.adjustableFolder.trim() === '') {
            console.log('Ã¢ÂÅ’ Pasta de ajustes nÃƒÂ£o configurada');
            this.showToast('Configure a pasta de fotos para ajustar nas configuraÃƒÂ§ÃƒÂµes do slideshow', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {
            console.log('Ã¢ÂÅ’ Imagem atual nÃƒÂ£o encontrada');
            this.showToast('Imagem atual nÃƒÂ£o encontrada', 'error');
            return;
        }

        try {
            console.log('Ã°Å¸â€Â§ Ajustando imagem:', currentImage.path);

            // Extrair nome do arquivo
            const pathParts = currentImage.path.split('/');
            const fileName = pathParts.pop();
            
            // Usar pasta configurada
            const targetPath = `${this.slideshowConfig.adjustableFolder}/${fileName}`;
            
            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath,
                createTargetDir: true // Flag para criar diretÃƒÂ³rio se nÃƒÂ£o existir
            };
            
            console.log('Ã°Å¸â€Â DEBUG - Dados sendo enviados para API (ADJUST):', requestData);
            
            // Chamar API para mover arquivo
            console.log('Ã°Å¸â€œÂ¡ Enviando requisiÃƒÂ§ÃƒÂ£o para /api/files/execute...');
            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            console.log('Ã°Å¸â€œÂ¡ Resposta da API:', response.status, response.statusText);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Ã¢Å“â€¦ Imagem ajustada com sucesso:', result);
                
                // Remover imagem da lista atual
                this.slideshowImages.splice(this.currentSlideIndex, 1);
                
                // Ajustar ÃƒÂ­ndice se necessÃƒÂ¡rio
                if (this.currentSlideIndex >= this.slideshowImages.length) {
                    this.currentSlideIndex = Math.max(0, this.slideshowImages.length - 1);
                }
                
                // Atualizar exibiÃƒÂ§ÃƒÂ£o
                if (this.slideshowImages.length > 0) {
                    this.updateSlideDisplay();
                    this.updateDynamicCounter();
                } else {
                    this.showToast('Todas as imagens foram ajustadas', 'info');
                    this.closeSlideshowViewer();
                }
                
                this.showToast(`Imagem ajustada! Movida para: ${this.slideshowConfig.adjustableFolder}`, 'success');
            } else {
                console.error('Ã¢ÂÅ’ Erro ao ajustar imagem - status:', response.status);
                this.showToast(`Erro ao ajustar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao ajustar imagem:', error);
            this.showToast('Erro ao ajustar imagem', 'error');
        }
    }

    // Fechar viewer do slideshow
    closeSlideshowViewer() {
        this.stopAutoPlay();
        
        // Sair do fullscreen antes de fechar o viewer
        console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â Saindo do fullscreen antes de fechar slideshow...');
        this.exitFullscreen();
        
        // Aguardar um pouco para garantir que a saÃƒÂ­da do fullscreen seja processada
        setTimeout(() => {
            // Verificar se ainda estÃƒÂ¡ em fullscreen e forÃƒÂ§ar saÃƒÂ­da se necessÃƒÂ¡rio
            const isStillFullscreen = !!(document.fullscreenElement || 
                                       document.webkitFullscreenElement || 
                                       document.mozFullScreenElement || 
                                       document.msFullscreenElement);
            
            if (isStillFullscreen) {
                console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â Ainda em fullscreen, forÃƒÂ§ando saÃƒÂ­da...');
                this.exitFullscreen();
            }
        }, 100);
        
        // Limpeza de proteÃƒÂ§ÃƒÂ£o de ÃƒÂ­cones (sem setInterval)
        console.log('Ã°Å¸Â§Â¹ ProteÃƒÂ§ÃƒÂ£o de ÃƒÂ­cones limpa');
        
        // Resetar flag de controles criados
        this.dynamicControlsCreated = false;
        
        // Limpar elementos criados dinamicamente
        const dynamicElement = document.getElementById('slideshow-image-new');
        if (dynamicElement) {
            dynamicElement.remove();
            console.log('Ã°Å¸Â§Â¹ Elemento dinÃƒÂ¢mico removido');
        }
        
        // Limpar controles dinÃƒÂ¢micos antigos (se existirem)
        const dynamicControls = document.getElementById('dynamic-slideshow-controls');
        if (dynamicControls) {
            dynamicControls.remove();
            console.log('Ã°Å¸Â§Â¹ Controles dinÃƒÂ¢micos antigos removidos');
        }
        
        // Esconder controles estÃƒÂ¡ticos
        const staticControls = document.getElementById('static-slideshow-controls');
        if (staticControls) {
            staticControls.style.display = 'none';
            console.log('Ã°Å¸Â§Â¹ Controles estÃƒÂ¡ticos escondidos');
        }

        // Remover botÃƒÂµes de organizaÃƒÂ§ÃƒÂ£o dinÃƒÂ¢micos
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
            slideshowViewer.style.display = 'none';
            console.log('Ã°Å¸â€“Â¥Ã¯Â¸Â Modal do slideshow fechado');
        }
        
        // Limpar dados do slideshow
        this.slideshowImages = [];
        this.currentSlideIndex = 0;
        this.slideshowPlaying = false;
        
        console.log('Ã¢Å“â€¦ Slideshow completamente fechado');
    }


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

    // Salvar pasta (mÃƒÂ©todo auxiliar)
    async saveFolder(folder) {
        console.log('Ã°Å¸â€™Â¾ Salvando pasta:', folder);

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

            const result = await response.json();
            console.log('Ã¢Å“â€¦ Pasta salva com sucesso:', result);
            return result;

        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao salvar pasta:', error);
            throw error;
        }
    }

    // Salvar template (mÃƒÂ©todo auxiliar)
    async saveTemplate(template) {
        console.log('Ã°Å¸â€œâ€¹ Salvando template:', template);

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

            const result = await response.json();
            console.log('Ã¢Å“â€¦ Template salvo com sucesso:', result);
            return result;

        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao salvar template:', error);
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
                this.showFieldError(field, 'Este campo ÃƒÂ© obrigatÃƒÂ³rio');
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
            this.showToast('Pasta de origem e destino nÃƒÂ£o podem ser iguais', 'warning');
            isValid = false;
        }

        return isValid;
    }

    validateWorkflowSchedule() {
        let isValid = true;
        const frequency = document.getElementById('execution-frequency');
        const cronExpression = document.getElementById('cron-expression');

        if (frequency.value === 'custom' && !cronExpression.value.trim()) {
            this.showFieldError(cronExpression, 'ExpressÃƒÂ£o cron ÃƒÂ© obrigatÃƒÂ³ria para frequÃƒÂªncia personalizada');
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
            this.showFieldError(extensions, 'Especifique as extensÃƒÂµes permitidas');
            isValid = false;
        }

        if (filterType === 'size' && (!minSize.value || parseFloat(minSize.value) < 0)) {
            this.showFieldError(minSize, 'Tamanho mÃƒÂ­nimo deve ser um nÃƒÂºmero positivo');
            isValid = false;
        }

        if (filterType === 'age' && (!minAge.value || parseFloat(minAge.value) < 0)) {
            this.showFieldError(minAge, 'Idade mÃƒÂ­nima deve ser um nÃƒÂºmero positivo');
            isValid = false;
        }

        const uppercase = document.getElementById('transform-uppercase');
        const lowercase = document.getElementById('transform-lowercase');

        if (uppercase.checked && lowercase.checked) {
            this.showToast('NÃƒÂ£o ÃƒÂ© possÃƒÂ­vel aplicar maiÃƒÂºsculas e minÃƒÂºsculas simultaneamente', 'warning');
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
            this.showFieldError(customTrashPath, 'Caminho da pasta de lixeira personalizada ÃƒÂ© obrigatÃƒÂ³rio');
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
            this.showToast('Preencha todos os campos obrigatÃƒÂ³rios', 'warning');
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
            <h5>Ã°Å¸â€œâ€¹ Resumo do Fluxo de Trabalho</h5>
            <ul>
                <li><strong>Nome:</strong> ${workflowData.name}</li>
                <li><strong>Origem:</strong> ${this.getFolderName(workflowData.sourceFolder)}</li>
                <li><strong>Destino:</strong> ${this.getFolderName(workflowData.targetFolder)}</li>
                <li><strong>AÃƒÂ§ÃƒÂ£o:</strong> ${this.getActionLabel(workflowData.fileAction)}</li>
                <li><strong>FrequÃƒÂªncia:</strong> ${this.getFrequencyLabel(workflowData.executionFrequency)}</li>
                <li><strong>Filtro:</strong> ${this.getFilterLabel(workflowData.filterType)}</li>
                ${workflowData.autoCleanup ? `<li><strong>Limpeza:</strong> ${workflowData.cleanupFrequency} (${workflowData.maxFileAge} dias)</li>` : ''}
            </ul>
        `;
    }

    // MÃƒÂ©todos auxiliares
    getFolderName(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        return folder ? folder.name : 'N/A';
    }

    getActionLabel(action) {
        const labels = {
            'copy': 'Ã°Å¸â€œâ€¹ Copiar',
            'move': 'Ã°Å¸â€œÂ¤ Mover',
            'copy_and_clean': 'Ã°Å¸Â§Â¹ Copiar e Limpar'
        };
        return labels[action] || action;
    }

    getFrequencyLabel(frequency) {
        const labels = {
            'realtime': 'Ã¢Å¡Â¡ Tempo Real',
            '1min': 'Ã¢ÂÂ±Ã¯Â¸Â A cada 1 minuto',
            '5min': 'Ã¢ÂÂ±Ã¯Â¸Â A cada 5 minutos',
            '15min': 'Ã¢ÂÂ±Ã¯Â¸Â A cada 15 minutos',
            '30min': 'Ã¢ÂÂ±Ã¯Â¸Â A cada 30 minutos',
            '1hour': 'Ã¢ÂÂ° A cada 1 hora',
            '6hours': 'Ã¢ÂÂ° A cada 6 horas',
            '12hours': 'Ã¢ÂÂ° A cada 12 horas',
            'daily': 'Ã°Å¸â€œâ€¦ DiÃƒÂ¡rio',
            'weekly': 'Ã°Å¸â€œâ€¦ Semanal',
            'monthly': 'Ã°Å¸â€œâ€¦ Mensal',
            'custom': 'Ã¢Å¡â„¢Ã¯Â¸Â Personalizado'
        };
        return labels[frequency] || frequency;
    }

    getFilterLabel(filterType) {
        const labels = {
            'all': 'Ã¢Å“â€¦ Todos os Arquivos',
            'new': 'Ã°Å¸â€ â€¢ Apenas Novos',
            'modified': 'Ã°Å¸â€œÂ Apenas Modificados',
            'extension': 'Ã°Å¸â€Â Por ExtensÃƒÂ£o',
            'size': 'Ã°Å¸â€œÂ Por Tamanho',
            'age': 'Ã¢ÂÂ° Por Idade'
        };
        return labels[filterType] || filterType;
    }

    // PopulaÃƒÂ§ÃƒÂ£o de campos
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

            // BotÃƒÂ£o de system tray
        const trayBtn = document.getElementById('tray-btn');
        if (trayBtn) {
            trayBtn.addEventListener('click', () => {
                minimizeToTray();
            });
        }

        // Sistema de atualizaÃƒÂ§ÃƒÂµes
        this.setupUpdateEventListeners();

        this.setupWorkflowEventListeners();
}

    // Sistema de AtualizaÃƒÂ§ÃƒÂµes
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
                throw new Error(result.error?.message || 'Falha ao salvar configuraÃƒÂ§ÃƒÂ£o');
            }
        } catch (error) {
            logger.error('Erro ao salvar config de auto update:', error);
            showToast('Erro ao salvar configuraÃƒÂ§ÃƒÂ£o de atualizaÃƒÂ§ÃƒÂ£o', 'error');
        }
    }

    // Verificar atualizaÃƒÂ§ÃƒÂµes disponÃƒÂ­veis
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
            logger.error('Erro ao verificar atualizaÃƒÂ§ÃƒÂµes:', error);
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
        const hasUpdates = Boolean(
            state.targetCommit &&
            state.currentCommit &&
            state.targetCommit !== state.currentCommit
        );

        if (statusText) {
            statusText.textContent = state.lastError
                ? `Erro: ${state.lastError}`
                : `Status: ${state.status || 'idle'}`;
        }

        if (lastCheckText) {
            lastCheckText.textContent = `ÃƒÅ¡ltima verificaÃƒÂ§ÃƒÂ£o: ${state.lastCheckAt ? new Date(state.lastCheckAt).toLocaleString('pt-BR') : '-'}`;
        }

        if (lastResultText) {
            lastResultText.textContent = `ÃƒÅ¡ltimo resultado: ${state.lastEvent || '-'}`;
        }

        if (versionText) {
            const current = state.currentCommit ? state.currentCommit.slice(0, 8) : 'desconhecida';
            const target = state.targetCommit ? state.targetCommit.slice(0, 8) : current;
            versionText.textContent = `Commit atual: ${current} | alvo: ${target}`;
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
            updateMessage.textContent = hasUpdates
                ? 'Ha atualizacao disponivel no origin/main'
                : 'Aplicacao atualizada. Voce ainda pode executar ciclo manual para diagnostico.';
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
                throw new Error(result.error?.message || 'Falha ao carregar histÃƒÂ³rico');
            }

            if (result.data.length === 0) {
                list.innerHTML = '<small>Nenhum evento recente</small>';
                return;
            }

            list.innerHTML = result.data
                .map((item) => {
                    const when = item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '-';
                    const event = item.event || 'evento';
                    const detail = item.error || item.reason || item.status || '';
                    return `<div><small><strong>${event}</strong> - ${when}${detail ? ` - ${detail}` : ''}</small></div>`;
                })
                .join('');
        } catch (error) {
            list.innerHTML = '<small>Erro ao carregar histÃƒÂ³rico</small>';
        }
    }

    // Aplicar atualizaÃƒÂ§ÃƒÂµes
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

    // Reiniciar aplicaÃƒÂ§ÃƒÂ£o
    async restartApplication() {
        try {
            const restartBtn = document.getElementById('restart-app-btn');
            if (restartBtn) {
                restartBtn.disabled = true;
                restartBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Reiniciando...';
            }

            const response = await fetch('/api/update/restart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error?.message || 'Falha ao reiniciar');
            }

            showToast('ReinÃƒÂ­cio solicitado com sucesso.', 'success');
            setTimeout(() => window.location.reload(), 3000);
        } catch (error) {
            logger.error('Erro ao reiniciar aplicaÃƒÂ§ÃƒÂ£o:', error);
            showToast(error.message || 'Erro ao reiniciar aplicaÃƒÂ§ÃƒÂ£o', 'error');
        } finally {
            const restartBtn = document.getElementById('restart-app-btn');
            if (restartBtn) {
                restartBtn.disabled = false;
                restartBtn.innerHTML = '<span class="material-icons">restart_alt</span> Reiniciar AplicaÃƒÂ§ÃƒÂ£o';
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

    // MÃƒÂ©todos de validaÃƒÂ§ÃƒÂ£o
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

    // MÃƒÂ©todos de toggle
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

    // MÃƒÂ©todos de carregamento de dados
    async loadWorkflows() {
        try {
            console.log('Ã°Å¸â€Â Carregando workflows da API...');
            const response = await fetch('/api/files/workflows');
            if (response.ok) {
                const result = await response.json();
                this.workflows = result.data || [];
                console.log('Ã¢Å“â€¦ Workflows carregados:', this.workflows);
                this.renderWorkflows();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao carregar workflows:', error);
            this.workflows = [];
            this.renderWorkflows();
        }
    }

    renderWorkflows() {
        const workflowsList = document.getElementById('workflows-list');

        if (!workflowsList) {
            console.warn('Ã¢Å¡Â Ã¯Â¸Â Elemento workflows-list nÃƒÂ£o encontrado');
            return;
        }

        console.log('Ã°Å¸Å½Â¨ Renderizando workflows:', this.workflows);

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
                        <div class="workflow-description">${workflow.description || 'Sem descriÃƒÂ§ÃƒÂ£o'}</div>
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

        // Configurar event listeners para os botÃƒÂµes de workflow
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
        // Evitar chamadas simultÃƒÂ¢neas
        if (this.isLoadingFolders) {
            console.log('Ã¢Å¡Â Ã¯Â¸Â Carregamento de pastas jÃƒÂ¡ em andamento, pulando...');
            return;
        }
        this.isLoadingFolders = true;

        try {
            console.log('Ã°Å¸â€Â Carregando pastas da API...');
            const response = await fetch('/api/files/folders');
            if (response.ok) {
                const result = await response.json();
                this.folders = result.data || [];
                console.log('Ã¢Å“â€¦ Pastas carregadas:', this.folders);
                this.renderConfiguredFolders();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Ã¢ÂÅ’ Erro ao carregar pastas:', error);

            // Verificar se ÃƒÂ© erro de conexÃƒÂ£o (API nÃƒÂ£o disponÃƒÂ­vel)
            if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
                console.warn('Ã¢Å¡Â Ã¯Â¸Â API nÃƒÂ£o estÃƒÂ¡ disponÃƒÂ­vel. Mostrando mensagem para o usuÃƒÂ¡rio.');
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

    // Mostrar mensagem quando API nÃƒÂ£o estÃƒÂ¡ disponÃƒÂ­vel
    showApiUnavailableMessage() {
        const foldersList = document.getElementById('folders-list');
        if (!foldersList) return;

        foldersList.innerHTML = `
            <div class="empty-state api-unavailable">
                <span class="material-icons" style="color: #ff9800;">warning</span>
                <p><strong>Servidor nÃƒÂ£o estÃƒÂ¡ executando</strong></p>
                <small style="color: #666;">
                    O servidor Node.js precisa estar rodando para carregar as pastas.<br>
                    Execute: <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px;">node src/main.js</code>
                </small>
                <button class="btn btn-primary reload-page-btn" style="margin-top: 10px;">
                    <span class="material-icons">refresh</span>
                    Tentar Novamente
                </button>
            </div>
        `;

        console.log('Ã°Å¸â€œÂ¢ Mensagem de API indisponÃƒÂ­vel exibida');
    }

    renderConfiguredFolders() {
        console.log('Ã°Å¸â€â€ž Iniciando renderConfiguredFolders com', this.folders?.length || 0, 'pastas');

        // Verificar se jÃƒÂ¡ estÃƒÂ¡ renderizando para evitar loops
        if (this.isRenderingFolders) {
            console.log('Ã¢Å¡Â Ã¯Â¸Â RenderizaÃƒÂ§ÃƒÂ£o jÃƒÂ¡ em andamento, pulando...');
            return;
        }
        this.isRenderingFolders = true;

        const foldersList = document.getElementById('folders-list');
        console.log('Ã°Å¸â€œÂ Elemento folders-list encontrado:', !!foldersList);

        if (!foldersList) {
            console.warn('Ã¢Å¡Â Ã¯Â¸Â Elemento folders-list nÃƒÂ£o encontrado');
            this.isRenderingFolders = false;
            return;
        }

        console.log('Ã°Å¸Å½Â¨ Renderizando pastas:', this.folders);
        console.log('Ã°Å¸â€œÅ  ConteÃƒÂºdo atual do foldersList:', foldersList.innerHTML.substring(0, 100) + '...');

        if (this.folders.length === 0) {
            foldersList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">folder_open</span>
                    <p>Nenhuma pasta configurada</p>
                    <small>Use a configuraÃƒÂ§ÃƒÂ£o rÃƒÂ¡pida acima ou crie manualmente</small>
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

        console.log('Ã¢Å“â€¦ HTML definido para foldersList');
        console.log('Ã°Å¸â€œÅ  Novo conteÃƒÂºdo do foldersList:', foldersList.innerHTML.substring(0, 200) + '...');

        // Adicionar event listeners para os botÃƒÂµes (evita CSP violation)
        this.addFolderEventListeners();

        // Liberar flag de renderizaÃƒÂ§ÃƒÂ£o
        this.isRenderingFolders = false;
    }

    getFolderTypeLabel(type) {
        const labels = {
            'source': 'Ã°Å¸â€œÂ¥ Origem',
            'target': 'Ã°Å¸â€œÂ¤ Destino',
            'temp': 'Ã°Å¸â€”â€šÃ¯Â¸Â TemporÃƒÂ¡ria',
            'trash': 'Ã°Å¸â€”â€˜Ã¯Â¸Â Lixeira',
            'any': 'Ã°Å¸â€œÂ Qualquer'
        };
        return labels[type] || type;
    }

    // Adicionar event listeners para botÃƒÂµes de pasta (evita CSP violation)
    addFolderEventListeners() {
        // BotÃƒÂµes de editar pasta
        const editButtons = document.querySelectorAll('.edit-folder-btn');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const folderId = e.currentTarget.getAttribute('data-folder-id');
                this.editFolder(folderId);
            });
        });

        // BotÃƒÂµes de deletar pasta
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
        // BotÃƒÂ£o de ajuda/tutorial
        const helpBtn = document.querySelector('.help-tutorial-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                this.showOnboarding();
            });
        }

        // BotÃƒÂµes do modal de onboarding
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

        // BotÃƒÂµes de aÃƒÂ§ÃƒÂ£o principal (evita CSP violation)
        this.addActionButtonListeners();

        // BotÃƒÂµes de slideshow
        this.addSlideshowEventListeners();

        // Filtros de operaÃƒÂ§ÃƒÂ£o de arquivo
        this.addFileOperationEventListeners();
    }

    // Adicionar event listeners para botÃƒÂµes de aÃƒÂ§ÃƒÂ£o (evita CSP violation)
    addActionButtonListeners() {
        // BotÃƒÂµes da dashboard principal
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

        // BotÃƒÂµes de configuraÃƒÂ§ÃƒÂ£o rÃƒÂ¡pida de pastas
        this.addQuickFolderListeners();

        // BotÃƒÂµes de gerenciamento de pastas
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

    // Adicionar event listeners para botÃƒÂµes de configuraÃƒÂ§ÃƒÂ£o rÃƒÂ¡pida de pastas
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

    // MÃƒÂ©todos de navegaÃƒÂ§ÃƒÂ£o
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
                // NÃƒÂ£o recarregar pastas se jÃƒÂ¡ foram carregadas na inicializaÃƒÂ§ÃƒÂ£o
                if (!this.folders || this.folders.length === 0) {
                    this.loadFolders();
                }
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    // MÃƒÂ©todos existentes mantidos
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
            { icon: 'workflow', text: 'Fluxo configurado: Processamento CSV', time: '2 min atrÃƒÂ¡s' },
            { icon: 'transform', text: 'Arquivo convertido: dados.csv Ã¢â€ â€™ dados.json', time: '5 min atrÃƒÂ¡s' },
            { icon: 'folder', text: 'Pasta configurada: Dados_Entrada', time: '10 min atrÃƒÂ¡s' }
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

    // MÃƒÂ©todos de conversÃƒÂ£o e mapeamento mantidos
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
                this.showToast('ConversÃƒÂ£o realizada com sucesso!', 'success');
            } else {
                const error = await response.json();
                this.showToast(`Erro na conversÃƒÂ£o: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error('Erro na conversÃƒÂ£o:', error);
            this.showToast('Erro na conversÃƒÂ£o', 'error');
        }
    }

    showConversionResult(result) {
        const resultDiv = document.getElementById('conversion-result');
        if (!resultDiv) return;

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <h3>Resultado da ConversÃƒÂ£o</h3>
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
                <label>ConfianÃƒÂ§a:</label>
                <input type="text" readonly value="${result.confidence || 'N/A'}%">
            </div>
        `;
    }

    // MÃƒÂ©todos de configuraÃƒÂ§ÃƒÂµes
    async loadSettings() {
        try {
            this.settings = {
                port: 3000,
                logLevel: 'info',
                environment: 'production',
                logDirectory: 'logs/'
            };

            this.populateSettingsForm();
        } catch (error) {
            console.error('Erro ao carregar configuraÃƒÂ§ÃƒÂµes:', error);
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
        const settings = {
            port: parseInt(document.getElementById('app-port').value),
            logLevel: document.getElementById('log-level').value,
            environment: document.getElementById('environment').value,
            logDirectory: document.getElementById('log-directory').value
        };

        try {
            this.settings = settings;
            this.showToast('ConfiguraÃƒÂ§ÃƒÂµes salvas com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao salvar configuraÃƒÂ§ÃƒÂµes:', error);
            this.showToast('Erro ao salvar configuraÃƒÂ§ÃƒÂµes', 'error');
        }
    }

    // MÃƒÂ©todos de arquivo
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
    // MÃ©todos de monitoramento
    startMonitoring() {
        this.startUnifiedRefreshScheduler();
    }

    // Sistema de notificaÃƒÂ§ÃƒÂµes
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

    // MÃƒÂ©todos de ajuda
    updateSourceFolderInfo() {
        const sourceFolder = document.getElementById('source-folder');
        const helpText = document.getElementById('source-folder-help');
        
        if (sourceFolder && helpText) {
            const selectedFolder = this.folders.find(f => f.id === sourceFolder.value);
            if (selectedFolder) {
                helpText.textContent = `Pasta: ${selectedFolder.name} (${selectedFolder.path})`;
            } else {
                helpText.textContent = 'Pasta onde os arquivos estÃƒÂ£o localizados';
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
                helpText.textContent = 'Pasta para onde os arquivos serÃƒÂ£o enviados';
            }
        }
    }

    updateActionHelp() {
        const action = document.getElementById('file-action');
        const helpText = document.getElementById('action-help');
        
        if (action && helpText) {
            const helpTexts = {
                'copy': 'Ã°Å¸â€œâ€¹ Os arquivos originais permanecerÃƒÂ£o na pasta de origem',
                'move': 'Ã°Å¸â€œÂ¤ Os arquivos originais serÃƒÂ£o removidos da pasta de origem',
                'copy_and_clean': 'Ã°Å¸Â§Â¹ Os arquivos serÃƒÂ£o copiados e os originais limpos/truncados'
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
                'source': 'Ã°Å¸â€œÂ¥ Pasta onde arquivos chegam para processamento',
                'target': 'Ã°Å¸â€œÂ¤ Pasta onde arquivos processados sÃƒÂ£o salvos',
                'temp': 'Ã°Å¸â€”â€šÃ¯Â¸Â Pasta temporÃƒÂ¡ria para arquivos em processamento',
                'trash': 'Ã°Å¸â€”â€˜Ã¯Â¸Â Pasta para arquivos removidos/antigos',
                'any': 'Ã°Å¸â€œÂ Pasta que pode ser usada como origem ou destino'
            };
            typeHelp.textContent = helpTexts[type] || helpTexts['source'];
        }
    }
}

// FunÃƒÂ§ÃƒÂµes globais
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

// FunÃƒÂ§ÃƒÂ£o para minimizar para system tray
async function minimizeToTray() {
    try {
        logger.info('Ã°Å¸â€œÂ± Minimizando aplicaÃƒÂ§ÃƒÂ£o para system tray...');
        
        const response = await fetch('/api/tray/minimize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            logger.info('Ã¢Å“â€¦ AplicaÃƒÂ§ÃƒÂ£o minimizada para system tray');
            const activeUi = window.deParaUI || ui;
            if (activeUi && typeof activeUi.handleAppMinimizedToTray === 'function') {
                await activeUi.handleAppMinimizedToTray();
            }
            showToast('AplicaÃƒÂ§ÃƒÂ£o minimizada para system tray', 'success');
        } else {
            logger.warn('Ã¢Å¡Â Ã¯Â¸Â Erro ao minimizar para system tray:', result.error);
            showToast(result.error?.message || 'Erro ao minimizar para system tray', 'error');
        }
    } catch (error) {
        logger.error('Ã¢ÂÅ’ Erro ao minimizar para system tray:', error);
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
        showToast('Caminho de origem ÃƒÂ© obrigatÃƒÂ³rio', 'error');
        return;
    }

    if ((action === 'move' || action === 'copy') && !targetPath) {
        showToast('Caminho de destino ÃƒÂ© obrigatÃƒÂ³rio', 'error');
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
            showToast(`OperaÃƒÂ§ÃƒÂ£o ${action} executada com sucesso!${structureMsg}`, 'success', true);
            closeFileOperationModal();
            // Refresh relevant sections
            loadScheduledOperations();
            loadBackups();
        } else {
            showToast(result.error?.message || 'Erro na operaÃƒÂ§ÃƒÂ£o', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao executar operaÃƒÂ§ÃƒÂ£o:', error);
        showToast('Erro ao executar operaÃƒÂ§ÃƒÂ£o', 'error');
    }
}

// Schedule Modal
function showScheduleModal() {
    const modal = document.getElementById('schedule-modal');

    // Preencher com dados da operaÃƒÂ§ÃƒÂ£o atual se disponÃƒÂ­vel
    if (window.deParaUI && window.deParaUI.currentConfig) {
        const config = window.deParaUI.currentConfig;
        
        // Preencher campos com valores atuais
        document.getElementById('schedule-name').value = config.name || `OperaÃƒÂ§ÃƒÂ£o ${config.operation || 'arquivo'}`;
        document.getElementById('schedule-action').value = config.operation || '';
        document.getElementById('schedule-frequency').value = '1d'; // PadrÃƒÂ£o: diariamente
        document.getElementById('schedule-source').value = config.sourcePath || '';
        document.getElementById('schedule-target').value = config.targetPath || '';
        
        // Carregar filtros de extensÃƒÂµes corretamente
        let filtersValue = '';
        if (config.options && config.options.filters && config.options.filters.extensions) {
            filtersValue = config.options.filters.extensions.map(ext => `*.${ext}`).join(', ');
        }
        document.getElementById('schedule-filters').value = filtersValue;
        
        document.getElementById('schedule-batch').checked = true;
        document.getElementById('schedule-backup').checked = false;
        
        console.log('Ã¢Å“â€¦ Modal preenchido com configuraÃƒÂ§ÃƒÂ£o atual:', config);
    } else {
        // Reset form se nÃƒÂ£o hÃƒÂ¡ configuraÃƒÂ§ÃƒÂ£o
        document.getElementById('schedule-name').value = '';
        document.getElementById('schedule-action').value = '';
        document.getElementById('schedule-frequency').value = '1d'; // PadrÃƒÂ£o: diariamente
        document.getElementById('schedule-source').value = '';
        document.getElementById('schedule-target').value = '';
        document.getElementById('schedule-filters').value = '';
        document.getElementById('schedule-batch').checked = true;
        document.getElementById('schedule-backup').checked = false;
        
        console.log('Ã¢Å¡Â Ã¯Â¸Â Nenhuma configuraÃƒÂ§ÃƒÂ£o atual encontrada, modal resetado');
    }

    updateScheduleForm();

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

// FunÃƒÂ§ÃƒÂ£o closeScheduleModal removida - usando window.closeScheduleModal

function updateScheduleForm() {
    const action = document.getElementById('schedule-action').value;
    const targetGroup = document.getElementById('schedule-target-group');

    if (action === 'delete') {
        targetGroup.style.display = 'none';
    } else {
        targetGroup.style.display = 'block';
    }
    
    // Atualizar resumo da operaÃƒÂ§ÃƒÂ£o
    updateOperationSummary();
}

function updateOperationSummary() {
    const action = document.getElementById('schedule-action').value;
    const source = document.getElementById('schedule-source').value;
    const target = document.getElementById('schedule-target').value;
    const summaryDiv = document.getElementById('operation-summary');
    
    // Mostrar resumo apenas se hÃƒÂ¡ dados suficientes
    if (action && source) {
        summaryDiv.style.display = 'block';
        
        // Atualizar conteÃƒÂºdo do resumo
        document.getElementById('summary-action').textContent = action.toUpperCase();
        document.getElementById('summary-source').textContent = source;
        document.getElementById('summary-target').textContent = target || (action === 'delete' ? 'N/A' : 'NÃƒÂ£o definido');
    } else {
        summaryDiv.style.display = 'none';
    }
}

async function scheduleOperation() {
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

    console.log('Ã°Å¸â€Â Campos capturados:', { name, action, frequency, sourcePath, targetPath });

    if (!name || !action || !frequency || !sourcePath) {
        showToast('Preencha todos os campos obrigatÃƒÂ³rios', 'error');
        return;
    }

    if ((action === 'move' || action === 'copy') && !targetPath) {
        showToast('Caminho de destino ÃƒÂ© obrigatÃƒÂ³rio', 'error');
        return;
    }

    try {
        // Gerar ID correto baseado no contexto
        let operationId;
        if (isEditing) {
            // EdiÃƒÂ§ÃƒÂ£o: usar ID existente
            operationId = isEditing;
        } else {
            // CriaÃƒÂ§ÃƒÂ£o nova: gerar novo ID
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
            // Filtro especificado - processar extensÃƒÂµes
            requestData.options.filters = {
                extensions: filters.split(',').map(ext => ext.trim().replace('*.', ''))
            };
        } else {
            // Filtro vazio - nÃƒÂ£o aplicar filtros (aceitar todos os arquivos)
            requestData.options.filters = {};
        }

        const url = isEditing ? `/api/files/schedule/${isEditing}` : '/api/files/schedule';
        const method = isEditing ? 'PUT' : 'POST';
        
        console.log(`${isEditing ? 'Ã¢Å“ÂÃ¯Â¸Â Editando' : 'Ã¢Å¾â€¢ Criando'} operaÃƒÂ§ÃƒÂ£o:`, requestData);
        console.log('Ã°Å¸â€Â Contexto:', { isEditing, operationId, modalDataset: modal.dataset });

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
            showToast(`OperaÃƒÂ§ÃƒÂ£o "${name}" ${actionMsg} com sucesso!${structureMsg}`, 'success', true);
            window.closeScheduleModal();
            loadScheduledOperations();
        } else {
            const actionMsg = isEditing ? 'editar' : 'agendar';
            showToast(result.error?.message || `Erro ao ${actionMsg} operaÃƒÂ§ÃƒÂ£o`, 'error', true);
        }

    } catch (error) {
        console.error('Erro ao agendar operaÃƒÂ§ÃƒÂ£o:', error);
        showToast('Erro ao agendar operaÃƒÂ§ÃƒÂ£o', 'error');
    }
}

// Controle de carregamento para evitar chamadas simultÃƒÂ¢neas
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

// Controle de operaÃƒÂ§ÃƒÂµes simples
let isExecutingOperation = false;

// FunÃƒÂ§ÃƒÂ£o helper para controle de carregamento com debouncing
function shouldLoadData(type) {
    const now = Date.now();
    const control = loadingControl[type];

    if (!control) return false;

    // Se jÃƒÂ¡ estÃƒÂ¡ carregando, nÃƒÂ£o permitir nova chamada
    if (control.isLoading) {
        console.log(`Ã¢Å¡Â Ã¯Â¸Â ${type} jÃƒÂ¡ estÃƒÂ¡ carregando, pulando...`);
        return false;
    }

    // Se carregou recentemente (debounce), nÃƒÂ£o permitir
    if (now - control.lastLoad < control.debounceMs) {
        console.log(`Ã¢Å¡Â Ã¯Â¸Â ${type} carregado recentemente, pulando (debounce)...`);
        return false;
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

// FunÃƒÂ§ÃƒÂ£o helper para carregamento seguro com verificaÃƒÂ§ÃƒÂ£o
function safeLoadData(type, loadFunction) {
    if (shouldLoadData(type)) {
        console.log(`Ã°Å¸â€â€ž Iniciando carregamento de ${type}...`);
        loadFunction();
    } else {
        console.log(`Ã¢ÂÂ­Ã¯Â¸Â Pulando carregamento de ${type} (debounce ou jÃƒÂ¡ carregando)`);
    }
}

// Load Templates
async function loadTemplates() {
    // Usar novo sistema de controle
    if (!shouldLoadData('templates')) {
        return;
    }
    markLoading('templates', true);

    try {
        console.log('Ã°Å¸â€Â Carregando templates...');
        const response = await fetch('/api/files/templates');
        const result = await response.json();

        console.log('Ã°Å¸â€œâ€¹ Resposta da API de templates:', result);

        if (result.success && result.data) {
            // Usar categories diretamente se existir, senÃƒÂ£o usar array vazio
            const categories = result.data.categories || [];
            console.log('Ã°Å¸â€œâ€š Categorias recebidas:', categories);
            renderTemplates(categories);
        } else {
            console.warn('Ã¢Å¡Â Ã¯Â¸Â Resposta da API nÃƒÂ£o contÃƒÂ©m dados vÃƒÂ¡lidos');
            renderTemplates([]);
        }
    } catch (error) {
        console.error('Ã¢ÂÅ’ Erro ao carregar templates:', error);
        renderTemplates([]);
    } finally {
        // Sempre liberar o flag de carregamento
        markLoading('templates', false);
    }
}

function renderTemplates(categories) {
    const container = document.getElementById('template-categories');

    if (!container) {
        console.warn('Ã¢Å¡Â Ã¯Â¸Â Container de templates nÃƒÂ£o encontrado');
        return;
    }

    console.log('Ã°Å¸Å½Â¨ Renderizando templates:', categories);

    // Verificar se categories ÃƒÂ© um array
    if (!Array.isArray(categories)) {
        console.warn('Ã¢Å¡Â Ã¯Â¸Â Categories nÃƒÂ£o ÃƒÂ© um array:', categories);
        categories = [];
    }

    container.innerHTML = '';

    categories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'template-category';

        // Verificar se templates existe e ÃƒÂ© um array
        const templates = category.templates || [];
        const templatesHtml = Array.isArray(templates) ? templates.map(template => `
                    <div class="template-card" onclick="applyTemplate('${template.category}', '${template.templateName}')">
                        <h5>${template.name}</h5>
                        <p>${template.description}</p>
                        <div class="template-actions">
                            <button class="btn btn-sm btn-primary">Aplicar</button>
                        </div>
                    </div>
                `).join('') : '<p class="no-templates">Nenhum template disponÃƒÂ­vel</p>';

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
            loadScheduledOperations();
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
            // Se a resposta nÃƒÂ£o for OK, nÃƒÂ£o logar erro (pode ser normal)
            return;
        }
        
        const result = await response.json();

        if (result.success) {
            renderProgress(result.data);
        }
    } catch (error) {
        // SÃƒÂ³ logar erro se nÃƒÂ£o for erro de conexÃƒÂ£o (que ÃƒÂ© normal quando nÃƒÂ£o hÃƒÂ¡ operaÃƒÂ§ÃƒÂµes ativas)
        if (!error.message.includes('Failed to fetch') && !error.message.includes('ERR_CONNECTION_REFUSED')) {
            console.error('Erro ao carregar progresso:', error);
        }
    }
}

function renderProgress(operations) {
    const container = document.getElementById('progress-list');

    if (operations.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma operaÃƒÂ§ÃƒÂ£o em andamento</p>';
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
                        ${isError ? 'Erro' : isCompleted ? 'ConcluÃƒÂ­do' : `${op.percentage}%`}
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
async function loadScheduledOperations() {
    // Usar novo sistema de controle
    if (!shouldLoadData('scheduledOperations')) {
        return;
    }
    markLoading('scheduledOperations', true);

    try {
        const response = await fetch('/api/files/scheduled');
        const result = await response.json();

        if (result.success) {
            console.log('Ã°Å¸â€œâ€¹ OperaÃƒÂ§ÃƒÂµes agendadas recebidas:', result.data);
            console.log('Ã°Å¸â€œÅ  Total de operaÃƒÂ§ÃƒÂµes:', result.data.length);
            renderScheduledOperations(result.data);
        }
    } catch (error) {
        console.error('Erro ao carregar operaÃƒÂ§ÃƒÂµes agendadas:', error);
    } finally {
        // Sempre liberar o flag de carregamento
        markLoading('scheduledOperations', false);
    }
}

function renderScheduledOperations(operations) {
    const container = document.getElementById('scheduled-operations-list');

    if (operations.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma operaÃƒÂ§ÃƒÂ£o agendada</p>';
        return;
    }

    container.innerHTML = operations.map(op => {
        console.log('Ã°Å¸â€Â Renderizando operaÃƒÂ§ÃƒÂ£o:', { id: op.id, name: op.name, action: op.action, frequency: op.frequency });
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
                <button class="btn btn-sm btn-primary edit-scheduled-operation-btn" data-operation-id="${op.id}" title="Editar operaÃƒÂ§ÃƒÂ£o">
                    <span class="material-icons">edit</span>
                </button>
                <button class="btn btn-sm btn-info duplicate-scheduled-operation-btn" data-operation-id="${op.id}" title="Duplicar operaÃƒÂ§ÃƒÂ£o">
                    <span class="material-icons">content_copy</span>
                </button>
                <button class="btn btn-sm btn-success execute-scheduled-operation-btn" data-operation-id="${op.id}" title="Executar agora">
                    <span class="material-icons">play_arrow</span>
                </button>
                <button class="btn btn-sm btn-warning toggle-scheduled-operation-btn" data-operation-id="${op.id}" data-active="${op.active}" title="${op.active ? 'Pausar' : 'Retomar'} operaÃƒÂ§ÃƒÂ£o">
                    <span class="material-icons">${op.active ? 'pause' : 'play_arrow'}</span>
                </button>
                <button class="btn btn-sm btn-danger cancel-scheduled-operation-btn" data-operation-id="${op.id}" title="Cancelar operaÃƒÂ§ÃƒÂ£o">
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
            showToast('OperaÃƒÂ§ÃƒÂ£o cancelada com sucesso!', 'success', true);
            loadScheduledOperations();
        } else {
            showToast(result.error?.message || 'Erro ao cancelar operaÃƒÂ§ÃƒÂ£o', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao cancelar operaÃƒÂ§ÃƒÂ£o:', error);
        showToast('Erro ao cancelar operaÃƒÂ§ÃƒÂ£o', 'error');
    }
}

// Executar operaÃƒÂ§ÃƒÂ£o agendada imediatamente
async function executeScheduledOperation(operationId) {
    if (!operationId) {
        console.error('Ã¢ÂÅ’ ID da operaÃƒÂ§ÃƒÂ£o nÃƒÂ£o fornecido');
        return;
    }

    console.log(`Ã°Å¸Å¡â‚¬ Executando operaÃƒÂ§ÃƒÂ£o agendada: ${operationId}`);

    try {
        const response = await fetch(`/api/files/schedule/${operationId}/execute`, {
            method: 'POST'
        });

        console.log(`Ã°Å¸â€œÂ¡ Resposta da API: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const result = await response.json();
            console.log('Ã°Å¸â€œâ€¹ Resultado da execuÃƒÂ§ÃƒÂ£o:', result);
            
            if (result.success) {
                console.log('Ã¢Å“â€¦ OperaÃƒÂ§ÃƒÂ£o executada com sucesso:', result);
                showToast(`OperaÃƒÂ§ÃƒÂ£o executada com sucesso! ${result.message || ''}`, 'success', true);
                
                // Recarregar operaÃƒÂ§ÃƒÂµes agendadas para mostrar status atualizado
                if (typeof loadScheduledOperations === 'function') {
                    loadScheduledOperations();
                }
            } else {
                throw new Error(result.error || 'Erro ao executar operaÃƒÂ§ÃƒÂ£o');
            }
        } else {
            const errorText = await response.text();
            console.error('Ã¢ÂÅ’ Erro HTTP:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Ã¢ÂÅ’ Erro ao executar operaÃƒÂ§ÃƒÂ£o:', error);
        showToast('Erro ao executar operaÃƒÂ§ÃƒÂ£o: ' + error.message, 'error', true);
    }
}

// Pausar/Retomar operaÃƒÂ§ÃƒÂ£o agendada
async function toggleScheduledOperation(operationId) {
    if (!operationId) {
        console.error('Ã¢ÂÅ’ ID da operaÃƒÂ§ÃƒÂ£o nÃƒÂ£o fornecido');
        return;
    }

    try {
        // Primeiro, obter o status atual da operaÃƒÂ§ÃƒÂ£o
        const response = await fetch(`/api/files/schedule/${operationId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Erro ao obter operaÃƒÂ§ÃƒÂ£o');
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
                console.log(`Ã¢Å“â€¦ OperaÃƒÂ§ÃƒÂ£o ${newStatus ? 'retomada' : 'pausada'} com sucesso`);
                showToast(`OperaÃƒÂ§ÃƒÂ£o ${newStatus ? 'retomada' : 'pausada'} com sucesso!`, 'success', true);
                // Recarregar operaÃƒÂ§ÃƒÂµes agendadas
                loadScheduledOperations();
            } else {
                throw new Error(updateResult.error || 'Erro ao atualizar operaÃƒÂ§ÃƒÂ£o');
            }
        } else {
            throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}`);
        }
    } catch (error) {
        console.error('Ã¢ÂÅ’ Erro ao alterar status da operaÃƒÂ§ÃƒÂ£o:', error);
        showToast('Erro ao alterar status da operaÃƒÂ§ÃƒÂ£o: ' + error.message, 'error', true);
    }
}

// Editar operaÃƒÂ§ÃƒÂ£o agendada
async function editScheduledOperation(operationId) {
    console.log('Ã°Å¸â€Â§ Editando operaÃƒÂ§ÃƒÂ£o:', operationId);
    
    try {
        // Obter dados da operaÃƒÂ§ÃƒÂ£o
        const response = await fetch(`/api/files/schedule/${operationId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error?.message || 'Erro ao obter operaÃƒÂ§ÃƒÂ£o');
        }
        
        const operation = result.data;
        console.log('Ã°Å¸â€œâ€¹ Dados da operaÃƒÂ§ÃƒÂ£o para ediÃƒÂ§ÃƒÂ£o:', operation);
        
        // Abrir modal de ediÃƒÂ§ÃƒÂ£o
        showEditOperationModal(operation);
        
    } catch (error) {
        console.error('Ã¢ÂÅ’ Erro ao obter operaÃƒÂ§ÃƒÂ£o para ediÃƒÂ§ÃƒÂ£o:', error);
        showToast('Erro ao carregar operaÃƒÂ§ÃƒÂ£o para ediÃƒÂ§ÃƒÂ£o: ' + error.message, 'error', true);
    }
}

// Mostrar modal de ediÃƒÂ§ÃƒÂ£o de operaÃƒÂ§ÃƒÂ£o
function showEditOperationModal(operation) {
    const modal = document.getElementById('schedule-modal');
    
    // Preencher campos com dados da operaÃƒÂ§ÃƒÂ£o
    document.getElementById('schedule-name').value = operation.name || '';
    document.getElementById('schedule-action').value = operation.action || '';
    document.getElementById('schedule-frequency').value = operation.frequency || '1d';
    document.getElementById('schedule-source').value = operation.sourcePath || '';
    document.getElementById('schedule-target').value = operation.targetPath || '';
    
    // Carregar filtros de extensÃƒÂµes corretamente
    let filtersValue = '';
    if (operation.options && operation.options.filters && operation.options.filters.extensions) {
        filtersValue = operation.options.filters.extensions.map(ext => `*.${ext}`).join(', ');
        console.log('Ã°Å¸â€Â Filtros carregados para ediÃƒÂ§ÃƒÂ£o:', {
            original: operation.options.filters.extensions,
            formatted: filtersValue
        });
    }
    document.getElementById('schedule-filters').value = filtersValue;
    
    document.getElementById('schedule-batch').checked = operation.batch !== false;
    document.getElementById('schedule-backup').checked = operation.backup === true;
    document.getElementById('schedule-preserve-structure').checked = operation.options?.preserveStructure !== false;
    
    // Adicionar ID da operaÃƒÂ§ÃƒÂ£o ao modal para identificaÃƒÂ§ÃƒÂ£o
    modal.dataset.editingOperationId = operation.id;
    
    // Alterar tÃƒÂ­tulo do modal
    const modalTitle = modal.querySelector('.modal-header h3');
    if (modalTitle) {
        modalTitle.textContent = 'Editar OperaÃƒÂ§ÃƒÂ£o';
    }
    
    // Alterar texto do botÃƒÂ£o
    const submitBtn = modal.querySelector('.schedule-operation-btn');
    if (submitBtn) {
        submitBtn.textContent = 'Salvar AlteraÃƒÂ§ÃƒÂµes';
    }
    
    updateScheduleForm();
    updateOperationSummary();
    
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    
    console.log('Ã¢Å“â€¦ Modal de ediÃƒÂ§ÃƒÂ£o aberto para operaÃƒÂ§ÃƒÂ£o:', operation.id);
}

// Duplicar operaÃƒÂ§ÃƒÂ£o agendada
async function duplicateScheduledOperation(operationId) {
    console.log('Ã°Å¸â€œâ€¹ Duplicando operaÃƒÂ§ÃƒÂ£o:', operationId);
    
    try {
        // Obter dados da operaÃƒÂ§ÃƒÂ£o
        const response = await fetch(`/api/files/schedule/${operationId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error?.message || 'Erro ao obter operaÃƒÂ§ÃƒÂ£o');
        }
        
        const operation = result.data;
        console.log('Ã°Å¸â€œâ€¹ Dados da operaÃƒÂ§ÃƒÂ£o para duplicaÃƒÂ§ÃƒÂ£o:', operation);
        
        // Modificar nome para indicar que ÃƒÂ© uma cÃƒÂ³pia
        const duplicatedOperation = {
            ...operation,
            name: `${operation.name} (CÃƒÂ³pia)`,
            id: `duplicate_${Date.now()}` // Novo ID
        };
        
        // Abrir modal de duplicaÃƒÂ§ÃƒÂ£o
        showDuplicateOperationModal(duplicatedOperation);
        
    } catch (error) {
        console.error('Ã¢ÂÅ’ Erro ao obter operaÃƒÂ§ÃƒÂ£o para duplicaÃƒÂ§ÃƒÂ£o:', error);
        showToast('Erro ao carregar operaÃƒÂ§ÃƒÂ£o para duplicaÃƒÂ§ÃƒÂ£o: ' + error.message, 'error', true);
    }
}

// Mostrar modal de duplicaÃƒÂ§ÃƒÂ£o de operaÃƒÂ§ÃƒÂ£o
function showDuplicateOperationModal(operation) {
    const modal = document.getElementById('schedule-modal');
    
    // Preencher campos com dados da operaÃƒÂ§ÃƒÂ£o
    document.getElementById('schedule-name').value = operation.name || '';
    document.getElementById('schedule-action').value = operation.action || '';
    document.getElementById('schedule-frequency').value = operation.frequency || '1d';
    document.getElementById('schedule-source').value = operation.sourcePath || '';
    document.getElementById('schedule-target').value = operation.targetPath || '';
    
    // Carregar filtros de extensÃƒÂµes corretamente
    let filtersValue = '';
    if (operation.options && operation.options.filters && operation.options.filters.extensions) {
        filtersValue = operation.options.filters.extensions.map(ext => `*.${ext}`).join(', ');
    }
    document.getElementById('schedule-filters').value = filtersValue;
    
    document.getElementById('schedule-batch').checked = operation.batch !== false;
    document.getElementById('schedule-backup').checked = operation.backup === true;
    document.getElementById('schedule-preserve-structure').checked = operation.options?.preserveStructure !== false;
    
    // Adicionar ID da operaÃƒÂ§ÃƒÂ£o ao modal para identificaÃƒÂ§ÃƒÂ£o
    modal.dataset.editingOperationId = operation.id;
    
    // Alterar tÃƒÂ­tulo do modal
    const modalTitle = modal.querySelector('.modal-header h3');
    if (modalTitle) {
        modalTitle.textContent = 'Duplicar OperaÃƒÂ§ÃƒÂ£o';
    }
    
    // Alterar texto do botÃƒÂ£o
    const submitBtn = modal.querySelector('.schedule-operation-btn');
    if (submitBtn) {
        submitBtn.textContent = 'Duplicar OperaÃƒÂ§ÃƒÂ£o';
    }
    
    updateScheduleForm();
    updateOperationSummary();
    
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    
    console.log('Ã¢Å“â€¦ Modal de duplicaÃƒÂ§ÃƒÂ£o aberto para operaÃƒÂ§ÃƒÂ£o:', operation.id);
}

// Load Backups
async function loadBackups() {
    // Usar novo sistema de controle
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
        // Sempre liberar o flag de carregamento
        markLoading('backups', false);
    }
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
        console.error('Erro ao mostrar notificaÃƒÂ§ÃƒÂ£o:', error);
    }
}

// Enhanced Toast notifications helper
function showToast(message, type = 'info', showSystemNotification = false) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">Ãƒâ€”</button>
    `;

    container.appendChild(toast);

    // Show system notification for important messages
    if (showSystemNotification && (type === 'success' || type === 'error')) {
        const title = type === 'success' ? 'OperaÃƒÂ§ÃƒÂ£o ConcluÃƒÂ­da' : 'Erro na OperaÃƒÂ§ÃƒÂ£o';
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
async function executeFileOperationDirect(file, operation, destination) {
    try {
        const preserveStructure = document.getElementById('preserve-structure-modal')?.checked ?? true;

        const requestData = {
            action: operation,
            sourcePath: file.path || file.name, // Para arquivos do drag & drop, pode nÃƒÂ£o ter path
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
            showToast(`OperaÃƒÂ§ÃƒÂ£o ${operation} executada com sucesso!${structureMsg}`, 'success', true);

            // Fecha modal se existir
            const modal = document.querySelector('.modal');
            if (modal) modal.remove();

            // Limpa preview
            clearFilePreview();
        } else {
            showToast(result.error?.message || 'Erro na operaÃƒÂ§ÃƒÂ£o', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao executar operaÃƒÂ§ÃƒÂ£o:', error);
        showToast('Erro ao executar operaÃƒÂ§ÃƒÂ£o', 'error', true);
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
            showToast('ConfiguraÃƒÂ§ÃƒÂµes de backup atualizadas!', 'success', true);
            loadBackups();
        } else {
            showToast(result.error?.message || 'Erro ao atualizar configuraÃƒÂ§ÃƒÂµes', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao atualizar configuraÃƒÂ§ÃƒÂµes de backup:', error);
        showToast('Erro ao atualizar configuraÃƒÂ§ÃƒÂµes de backup', 'error');
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
        console.error('Erro ao carregar configuraÃƒÂ§ÃƒÂµes de backup:', error);
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
    fileSelector.addEventListener('change', handleFileSelect);

    console.log('Drag & drop initialized');
}

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
    // SÃƒÂ³ remove a classe se o mouse saiu realmente da zona
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

    // Esconde conteÃƒÂºdo original
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
                        <p>${formatFileSize(file.size)} Ã¢â‚¬Â¢ ${getFileType(file.type, file.name)}</p>
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
                Limpar SeleÃƒÂ§ÃƒÂ£o
            </button>
        </div>
    `;
}

function selectOperationForFile(fileIndex, operation) {
    const file = draggedFiles[fileIndex];
    currentOperation = { file, operation };

    if (operation === 'delete') {
        // Para delete, nÃƒÂ£o precisa de destino
        showDeleteConfirmation(file);
    } else {
        // Para move/copy, precisa escolher destino
        showDestinationModal(file, operation);
    }
}

function showDeleteConfirmation(file) {
    if (confirm(`Tem certeza que deseja apagar "${file.name}"?\n\nEsta aÃƒÂ§ÃƒÂ£o criarÃƒÂ¡ um backup automÃƒÂ¡tico.`)) {
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
                <button class="modal-close" onclick="this.closest('.modal').remove()">Ãƒâ€”</button>
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
                    <small class="form-help">Digite o caminho completo onde o arquivo serÃƒÂ¡ ${operation === 'move' ? 'movido' : 'copiado'}</small>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="preserve-structure-modal" checked>
                        Preservar estrutura de pastas
                    </label>
                    <small class="form-help">MantÃƒÂ©m a organizaÃƒÂ§ÃƒÂ£o de subpastas no destino</small>
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
        const preserveStructure = document.getElementById('preserve-structure-modal')?.checked ?? true;

        const requestData = {
            action: operation,
            sourcePath: file.path || file.name, // Para arquivos do drag & drop, pode nÃƒÂ£o ter path
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
            showToast(`OperaÃƒÂ§ÃƒÂ£o ${operation} executada com sucesso!`, 'success');

            // Fecha modal se existir
            const modal = document.querySelector('.modal');
            if (modal) modal.remove();

            // Limpa preview
            clearFilePreview();
        } else {
            showToast(result.error?.message || 'Erro na operaÃƒÂ§ÃƒÂ£o', 'error');
        }

    } catch (error) {
        console.error('Erro ao executar operaÃƒÂ§ÃƒÂ£o:', error);
        showToast('Erro ao executar operaÃƒÂ§ÃƒÂ£o', 'error');
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

    // Por extensÃƒÂ£o
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
            showToast('Erro ao carregar padrÃƒÂµes ignorados', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar padrÃƒÂµes ignorados:', error);
        showToast('Erro ao carregar padrÃƒÂµes ignorados', 'error');
    }
}

function showIgnoredPatternsModal(data) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content large-modal">
            <div class="modal-header">
                <h3>Ã°Å¸â€ºÂ¡Ã¯Â¸Â Arquivos Automaticamente Ignorados</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">Ãƒâ€”</button>
            </div>
            <div class="modal-body">
                <div class="ignored-description">
                    <p><strong>Por que ignorar arquivos?</strong></p>
                    <p>Certos arquivos sÃƒÂ£o crÃƒÂ­ticos para o funcionamento do sistema e sincronizaÃƒÂ§ÃƒÂ£o.
                    Eles sÃƒÂ£o automaticamente ignorados para evitar:</p>
                    <ul>
                        <li>Ã¢ÂÅ’ InterrupÃƒÂ§ÃƒÂ£o da sincronizaÃƒÂ§ÃƒÂ£o do Resilio Sync</li>
                        <li>Ã¢ÂÅ’ Problemas de compatibilidade entre sistemas</li>
                        <li>Ã¢ÂÅ’ Processamento desnecessÃƒÂ¡rio de arquivos temporÃƒÂ¡rios</li>
                        <li>Ã¢ÂÅ’ Conflitos com ferramentas de desenvolvimento</li>
                    </ul>
                </div>

                <div class="ignored-categories">
                    ${Object.entries(data.categories).map(([key, description]) => `
                        <div class="ignored-category">
                            <h4>${key === 'resilioSync' ? 'Ã°Å¸â€â€ž' : key === 'systemFiles' ? 'Ã°Å¸â€™Â»' : 'Ã¢ÂÂ°'} ${description.split(' - ')[0]}</h4>
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
                    <h4>Ã°Å¸â€Â Testar Arquivo</h4>
                    <p>Verifique se um arquivo especÃƒÂ­fico seria ignorado:</p>
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
                    <strong>${isIgnored ? 'Ã°Å¸Å¡Â« IGNORADO' : 'Ã¢Å“â€¦ PROCESSADO'}</strong><br>
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
// Agora usando implementaÃƒÂ§ÃƒÂ£o da classe DeParaUI

// FunÃƒÂ§ÃƒÂµes removidas - agora usando implementaÃƒÂ§ÃƒÂ£o da classe DeParaUI

function closeSlideshowConfigModal() {
    const modal = document.getElementById('slideshow-config-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

function resetSlideshowFolderForm() {
    // NÃƒÂ£o limpar o campo de pasta se houver uma pasta salva
    const savedPath = localStorage.getItem('slideshowSelectedPath');
    if (!savedPath) {
        document.getElementById('slideshow-folder-path').value = '';
    }
    
    document.getElementById('slideshow-max-depth').value = '3';

    // Resetar checkboxes de extensÃƒÂµes
    const extensionCheckboxes = document.querySelectorAll('.extension-selector input[type="checkbox"]');
    extensionCheckboxes.forEach(checkbox => {
        const isDefaultChecked = ['jpg', 'jpeg', 'png', 'gif'].includes(checkbox.value);
        checkbox.checked = isDefaultChecked;
    });
}

async function startSlideshow() {
    // Usar a implementaÃƒÂ§ÃƒÂ£o da classe DeParaUI
    if (window.deParaUI) {
        window.deParaUI.startSlideshowFromModal();
    } else {
        console.error('DeParaUI nÃƒÂ£o estÃƒÂ¡ disponÃƒÂ­vel');
        showToast('Erro: Interface nÃƒÂ£o inicializada', 'error');
    }
}


// FunÃƒÂ§ÃƒÂ£o removida - agora usando implementaÃƒÂ§ÃƒÂ£o da classe DeParaUI

// FunÃƒÂ§ÃƒÂ£o removida - agora usando implementaÃƒÂ§ÃƒÂ£o da classe DeParaUI

// FunÃƒÂ§ÃƒÂµes removidas - agora usando implementaÃƒÂ§ÃƒÂ£o da classe DeParaUI

// FunÃƒÂ§ÃƒÂµes removidas - agora usando implementaÃƒÂ§ÃƒÂ£o da classe DeParaUI

// CÃƒÂ³digo de navegaÃƒÂ§ÃƒÂ£o removido - agora usando implementaÃƒÂ§ÃƒÂ£o da classe DeParaUI

// FunÃƒÂ§ÃƒÂµes de hints removidas - agora usando implementaÃƒÂ§ÃƒÂ£o da classe DeParaUI

// ==========================================
// END SLIDESHOW FUNCTIONALITY
// ==========================================

// InicializaÃƒÂ§ÃƒÂ£o
let ui;
document.addEventListener('DOMContentLoaded', () => {
    if (window.__deparaMainInitDone) return;
    window.__deparaMainInitDone = true;
    ui = new DeParaUI();

    // ApÃƒÂ³s inicializar, definir funÃƒÂ§ÃƒÂµes globais
    setTimeout(() => {
        // Tornar UI disponÃƒÂ­vel globalmente primeiro
        window.deParaUI = ui;

        // FunÃƒÂ§ÃƒÂ£o global para limpar busca
        window.clearSearchGlobal = function() {
            if (window.deParaUI) {
                window.deParaUI.clearSearch();
            }
        };

        // FunÃƒÂ§ÃƒÂµes globais para onboarding
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

        // FunÃƒÂ§ÃƒÂµes de configuraÃƒÂ§ÃƒÂ£o rÃƒÂ¡pida de pastas
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

            // FunÃƒÂ§ÃƒÂµes auxiliares globais
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

        // FunÃƒÂ§ÃƒÂµes para botÃƒÂµes de dashboard
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

        window.showScheduleModal = function() {
            // Chamar diretamente a funÃƒÂ§ÃƒÂ£o global showScheduleModal (sem recursÃƒÂ£o)
            const modal = document.getElementById('schedule-modal');
            if (modal) {
                modal.style.display = 'block';
                document.body.classList.add('modal-open');
            } else {
                console.error('Ã¢ÂÅ’ Modal de agendamento nÃƒÂ£o encontrado');
                this.showToast('Erro: Modal de agendamento nÃƒÂ£o encontrado', 'error');
            }
        };

        // FunÃƒÂ§ÃƒÂµes para backups (jÃƒÂ¡ existem como globais, nÃƒÂ£o precisamos recriar)
        // loadBackups() e updateBackupConfig() jÃƒÂ¡ estÃƒÂ£o definidos como funÃƒÂ§ÃƒÂµes globais
        // Vamos apenas garantir que elas sejam acessÃƒÂ­veis

        // FunÃƒÂ§ÃƒÂµes para configuraÃƒÂ§ÃƒÂµes
        window.showIgnoredPatterns = function() {
            // Chamar diretamente a funÃƒÂ§ÃƒÂ£o global showIgnoredPatterns
            if (typeof showIgnoredPatterns === 'function') {
                showIgnoredPatterns();
            }
        };

        window.saveSettings = function() {
            // Chamar o mÃƒÂ©todo da classe DeParaUI
            if (window.deParaUI && typeof window.deParaUI.saveSettings === 'function') {
                window.deParaUI.saveSettings();
            }
        };

        // FunÃƒÂ§ÃƒÂµes para workflows (todas sÃƒÂ£o funÃƒÂ§ÃƒÂµes globais)
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

        // FunÃƒÂ§ÃƒÂµes para gerenciamento de pastas (todas sÃƒÂ£o funÃƒÂ§ÃƒÂµes globais)
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

        // FunÃƒÂ§ÃƒÂµes para operaÃƒÂ§ÃƒÂµes de arquivo (jÃƒÂ¡ existem como globais, nÃƒÂ£o precisamos recriar)
        // closeFileOperationModal() e executeFileOperation() jÃƒÂ¡ estÃƒÂ£o definidos como funÃƒÂ§ÃƒÂµes globais

        // FunÃƒÂ§ÃƒÂµes para agendamento (todas sÃƒÂ£o funÃƒÂ§ÃƒÂµes globais)
        window.closeScheduleModal = function() {
            const modal = document.getElementById('schedule-modal');
            if (modal) {
                modal.style.display = 'none';
                document.body.classList.remove('modal-open');
                
                // Limpar estado de ediÃƒÂ§ÃƒÂ£o
                delete modal.dataset.editingOperationId;
                
                // Restaurar tÃƒÂ­tulo e botÃƒÂ£o originais
                const modalTitle = modal.querySelector('.modal-header h3');
                if (modalTitle) {
                    modalTitle.textContent = 'Agendar OperaÃƒÂ§ÃƒÂ£o';
                }
                
                const submitBtn = modal.querySelector('.schedule-operation-btn');
                if (submitBtn) {
                    submitBtn.textContent = 'Agendar';
                }
                
                console.log('Ã¢Å“â€¦ Modal de agendamento fechado via window.closeScheduleModal');
            }
        };

        window.scheduleOperation = async function() {
            // Implementar lÃƒÂ³gica de agendamento diretamente aqui para evitar loop infinito
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

            console.log('Ã°Å¸â€Â Campos capturados:', { name, action, frequency, sourcePath, targetPath, filters });

            if (!name || !action || !frequency || !sourcePath) {
                showToast('Preencha todos os campos obrigatÃƒÂ³rios', 'error');
                return;
            }

            if ((action === 'move' || action === 'copy') && !targetPath) {
                showToast('Caminho de destino ÃƒÂ© obrigatÃƒÂ³rio', 'error');
                return;
            }

            try {
                // Gerar ID correto baseado no contexto
                let operationId;
                if (isEditing) {
                    // EdiÃƒÂ§ÃƒÂ£o: usar ID existente
                    operationId = isEditing;
                } else {
                    // CriaÃƒÂ§ÃƒÂ£o nova: gerar novo ID
                    operationId = `ui_${Date.now()}`;
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
                        preserveStructure
                    }
                };

                // Para criaÃƒÂ§ÃƒÂ£o nova, incluir operationId no corpo
                if (!isEditing) {
                    requestData.operationId = operationId;
                }

                if (action === 'move' || action === 'copy') {
                    requestData.targetPath = targetPath;
                }

                // Processar filtros - sempre criar objeto filters, mesmo se vazio
                if (filters && filters.trim()) {
                    // Filtro especificado - processar extensÃƒÂµes
                    requestData.options.filters = {
                        extensions: filters.split(',').map(ext => ext.trim().replace('*.', ''))
                    };
                } else {
                    // Filtro vazio - nÃƒÂ£o aplicar filtros (aceitar todos os arquivos)
                    requestData.options.filters = {};
                }

                const url = isEditing ? `/api/files/schedule/${isEditing}` : '/api/files/schedule';
                const method = isEditing ? 'PUT' : 'POST';
                
                console.log(`${isEditing ? 'Ã¢Å“ÂÃ¯Â¸Â Editando' : 'Ã¢Å¾â€¢ Criando'} operaÃƒÂ§ÃƒÂ£o:`, requestData);
                console.log('Ã°Å¸â€Â Contexto:', { isEditing, operationId, modalDataset: modal.dataset });

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
                    showToast(`OperaÃƒÂ§ÃƒÂ£o "${name}" ${actionMsg} com sucesso!${structureMsg}`, 'success', true);
                    window.closeScheduleModal();
                    loadScheduledOperations();
                } else {
                    const actionMsg = isEditing ? 'editar' : 'agendar';
                    showToast(result.error?.message || `Erro ao ${actionMsg} operaÃƒÂ§ÃƒÂ£o`, 'error', true);
                }

            } catch (error) {
                console.error('Erro ao agendar operaÃƒÂ§ÃƒÂ£o:', error);
                showToast('Erro ao agendar operaÃƒÂ§ÃƒÂ£o', 'error');
            }
        };

        // FunÃƒÂ§ÃƒÂµes para slideshow (todas sÃƒÂ£o funÃƒÂ§ÃƒÂµes globais)
        window.closeSlideshowFolderModal = function() {
            const modal = document.getElementById('slideshow-folder-modal');
            if (modal) {
                modal.style.display = 'none';
                document.body.classList.remove('modal-open');
                console.log('Ã¢Å“â€¦ Modal de slideshow fechado via window.closeSlideshowFolderModal');
            }
        };

        // FunÃƒÂ§ÃƒÂ£o startSlideshow removida - usando implementaÃƒÂ§ÃƒÂ£o da classe DeParaUI
        // window.startSlideshow agora ÃƒÂ© apenas um alias para window.deParaUI.startSlideshowFromModal()

        // FunÃƒÂ§ÃƒÂµes de slideshow (estas sÃƒÂ£o mÃƒÂ©todos da classe DeParaUI)
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

        // Adicionar event listeners para botÃƒÂµes (evita CSP violation)
        ui.addOnboardingEventListeners();
        ui.setupAdditionalEventListeners();
    }, 100);
});

// FunÃƒÂ§ÃƒÂ£o para substituir caminhos dinÃƒÂ¢micos baseados na plataforma
function updateDynamicPaths() {
    const isWindows = navigator.userAgent.indexOf('Windows') > -1;
    // No navegador, nÃƒÂ£o temos acesso direto ÃƒÂ s variÃƒÂ¡veis de ambiente
    // Vamos usar valores padrÃƒÂ£o mais inteligentes baseados na plataforma
    const userName = isWindows ? 'User' : 'user';

    // Mapeamento de caminhos dinÃƒÂ¢micos
    const pathMappings = {
        'dynamic-home': isWindows ? `C:\\Users\\${userName}` : `/home/${userName}`,
        'dynamic-documents': isWindows ? `C:\\Users\\${userName}\\Documents` : `/home/${userName}/Documents`,
        'dynamic-downloads': isWindows ? `C:\\Users\\${userName}\\Downloads` : `/home/${userName}/Downloads`,
        'dynamic-pictures': isWindows ? `C:\\Users\\${userName}\\Pictures` : `/home/${userName}/Pictures`,
        'dynamic-desktop': isWindows ? `C:\\Users\\${userName}\\Desktop` : `/home/${userName}/Desktop`,
        'dynamic-pictures-placeholder': isWindows ? `C:\\Users\\${userName}\\Pictures` : `/home/${userName}/Pictures`
    };

    // Substituir data-path dos botÃƒÂµes
    Object.keys(pathMappings).forEach(key => {
        const buttons = document.querySelectorAll(`[data-path="${key}"]`);
        buttons.forEach(button => {
            button.setAttribute('data-path', pathMappings[key]);
        });
    });

    // Substituir placeholder do slideshow
    const slideshowInput = document.getElementById('slideshow-folder-path');
    if (slideshowInput && pathMappings['dynamic-pictures-placeholder']) {
        slideshowInput.placeholder = pathMappings['dynamic-pictures-placeholder'];
        const savedPath = localStorage.getItem('slideshowSelectedPath');
        if (savedPath && savedPath.trim()) {
            slideshowInput.value = savedPath.trim();
        } else if (!slideshowInput.value || !slideshowInput.value.trim()) {
            slideshowInput.value = pathMappings['dynamic-pictures-placeholder'];
        }
    }
}

// Executar quando o DOM estiver carregado (jÃƒÂ¡ feito em updateSimplePaths)

// ===========================================
// FUNÃƒâ€¡Ãƒâ€¢ES DE OPERAÃƒâ€¡Ãƒâ€¢ES SIMPLES DE ARQUIVOS
// ===========================================

// Executar operaÃƒÂ§ÃƒÂ£o simples
async function executeSimpleOperation(action) {
    if (isExecutingOperation) {
        showToast('OperaÃƒÂ§ÃƒÂ£o jÃƒÂ¡ em andamento. Aguarde...', 'warning');
        return;
    }

    const sourcePath = document.getElementById('source-path').value.trim();
    const destPath = document.getElementById('dest-path').value.trim();
    const recursive = document.getElementById('recursive-option').checked;
    const backup = document.getElementById('backup-option').checked;

    // ValidaÃƒÂ§ÃƒÂ£o bÃƒÂ¡sica
    if (!sourcePath) {
        showToast('Digite o caminho de origem', 'error');
        return;
    }

    if ((action === 'move' || action === 'copy') && !destPath) {
        showToast('Digite o caminho de destino', 'error');
        return;
    }

    // Mostrar resultado da operaÃƒÂ§ÃƒÂ£o
    const resultDiv = document.getElementById('operation-result');
    const resultIcon = document.getElementById('result-icon');
    const resultText = document.getElementById('result-text');

    resultDiv.style.display = 'block';
    resultIcon.textContent = 'hourglass_empty';
    resultText.textContent = 'Executando operaÃƒÂ§ÃƒÂ£o...';

    // Desabilitar botÃƒÂµes durante execuÃƒÂ§ÃƒÂ£o
    setOperationButtonsDisabled(true);
    isExecutingOperation = true;

    try {
        const options = {
            batch: recursive,
            backupBeforeMove: backup,
            preserveStructure: true
        };

        console.log(`Ã°Å¸â€â€ž Executando operaÃƒÂ§ÃƒÂ£o: ${action}`, { sourcePath, destPath, options });

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
            resultText.textContent = `Ã¢Å“â€¦ OperaÃƒÂ§ÃƒÂ£o ${action} executada com sucesso!`;
            showToast(`OperaÃƒÂ§ÃƒÂ£o ${action} concluÃƒÂ­da!`, 'success');

            // Atualizar atividades recentes
            if (typeof loadRecentActivities === 'function') {
                loadRecentActivities();
            }
        } else {
            resultIcon.textContent = 'error';
            resultText.textContent = `Ã¢ÂÅ’ Erro: ${result.error?.message || 'Erro desconhecido'}`;
            showToast(result.error?.message || 'Erro na operaÃƒÂ§ÃƒÂ£o', 'error');
        }

    } catch (error) {
        console.error('Erro na operaÃƒÂ§ÃƒÂ£o:', error);
        resultIcon.textContent = 'error';
        resultText.textContent = `Ã¢ÂÅ’ Erro de conexÃƒÂ£o: ${error.message}`;
        showToast('Erro de conexÃƒÂ£o com o servidor', 'error');
    } finally {
        // Reabilitar botÃƒÂµes
        setOperationButtonsDisabled(false);
        isExecutingOperation = false;
    }
}

// Desabilitar/Habilitar botÃƒÂµes de operaÃƒÂ§ÃƒÂ£o
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
        console.warn('FunÃƒÂ§ÃƒÂ£o showFolderBrowser nÃƒÂ£o encontrada');
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
        console.warn('FunÃƒÂ§ÃƒÂ£o showFolderBrowser nÃƒÂ£o encontrada');
        // Fallback: apenas focar no input
        const input = document.getElementById('dest-path');
        if (input) {
            input.focus();
            input.select();
        }
    }
}

// Atualizar caminhos baseados na plataforma (versÃƒÂ£o simplificada)
function updateSimplePaths() {
    const isWindows = navigator.userAgent.indexOf('Windows') > -1;
    const userName = 'user'; // Valor padrÃƒÂ£o simples

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

// Inicializar caminhos quando a pÃƒÂ¡gina carregar
document.addEventListener('DOMContentLoaded', function() {
    if (window.__deparaSimplePathsInitDone) return;
    window.__deparaSimplePathsInitDone = true;
    updateSimplePaths();
});

// Adicionar animaÃƒÂ§ÃƒÂ£o CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }

    /* Estilos para operaÃƒÂ§ÃƒÂµes simples */
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


