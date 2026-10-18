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

function normalizeLogMessage(value) {
    return typeof value === 'string' ? value : String(value);
}

class Logger {
    constructor() {
        this.enableDebug = localStorage.getItem('depara-debug') === 'true';
        this.logLevel = localStorage.getItem('depara-log-level') || 'info';
        this.maxLogs = 100;
        this.logs = [];
    }

    log(level, message, meta = {}) {
        const normalizedMessage = normalizeLogMessage(message);
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: normalizedMessage,
            meta,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Adicionar ao histórico
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
        } else if (this.enableDebug) {
        }

        // Enviar logs críticos para o servidor
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
            // Silenciar erro para não criar loop
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

// Instância global do logger
const logger = new Logger();

class DeParaUI {
    constructor() {
        this.currentTab = 'dashboard';
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
        this.refreshInFlight = false;
        this.slideshowListenersBound = false;
        this.slideshowReturnFocus = null;
        this.init();
    }

    async init() {
        // Carregar configurações do servidor primeiro (persiste entre reinicializações)
        await this.loadServerConfig();
        logger.info('[init] Inicializando DePara UI...', {
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

            // Carregar configurações
            await this.loadSettings();
            logger.success('Configurações carregadas');

            // Carregar pastas
            await this.loadFolders();
            logger.success('Pastas carregadas');

            // Iniciar scheduler unificado de monitoramento/status/dashboard
            this.startUnifiedRefreshScheduler();
            logger.success('Scheduler unificado iniciado');

            // Testar conexão com API
            const apiOnline = await this.testApiConnection();
            if (apiOnline) {
                this.showToast('DePara iniciado com sucesso!', 'success');
                logger.success('API conectada', { apiStatus: 'online' });
            } else {
                this.showToast('API não está respondendo. Verifique se o servidor está rodando.', 'warning');
                logger.warn('API offline', { apiStatus: 'offline' });
            }

            // Atualizar status da API imediatamente
            this.updateApiStatus();
            logger.success('Status da API sincronizado');

            // Configurar atalhos de teclado
            this.setupKeyboardShortcuts();
            logger.success('Atalhos de teclado configurados');

            // Configurar screensaver por inatividade
            this.initScreensaverManager();
            logger.success('Screensaver configurado');
            if (this.isDedicatedScreensaverWindow) {
                this.enableDedicatedScreensaverUI();
            }

            // Mostrar onboarding se necessário
            if (!this.isDedicatedScreensaverWindow && !localStorage.getItem('depara-onboarding-completed')) {
                setTimeout(() => this.showOnboarding(), 1000);
            }

            // Configurar event listeners para substituir violações de CSP
            this.setupCSPSafeEventListeners();

            // Configurar validação de operações
            this.setupOperationValidation();

            // Garantir que o campo de origem esteja sempre visível
            this.ensureSourceFieldVisible();
            this.refreshFileOpsState();

            // Carregar pasta salva do slideshow
            this.loadSlideshowSavedPath();
            if (this.isDedicatedScreensaverWindow) {
                await this.activateScreensaver({ forceLocal: true });
            }

            const initDuration = Date.now() - startTime;
            logger.success('🎉 Inicialização completa!', {
                duration: `${initDuration}ms`,
                components: [
                    'eventListeners',
                    'cache',
                    'settings',
                    'folders',
                    'monitoring',
                    'apiConnection',
                    'shortcuts',
                    'dashboard',
                    'validation'
                ]
            });

        } catch (error) {
            logger.error('❌ Erro durante inicialização', {
                error: error.message,
                stack: error.stack,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            });
            this.showToast('Erro na inicialização. Verifique o console.', 'error');
        } finally {
            // Esconder splash screen após inicialização
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

    // Testa conexão com a API
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
            console.warn('Erro ao testar conexão com API:', error);
            return false;
        }
    }

    // Atualiza status da API na interface
    async updateApiStatus() {
        const apiStatusElement = document.getElementById('api-status');
        const apiStatusIconElement = document.getElementById('api-status-icon');

        if (!apiStatusElement || !apiStatusIconElement) {
            console.warn('Elementos de status da API não encontrados');
            return;
        }

        try {
            const isOnline = await this.testApiConnection();

            if (isOnline) {
                apiStatusElement.textContent = 'Online';
                apiStatusElement.className = 'value online';
                apiStatusIconElement.textContent = 'api';
                apiStatusIconElement.className = 'material-icons online';
            } else {
                apiStatusElement.textContent = 'Offline';
                apiStatusElement.className = 'value offline';
                apiStatusIconElement.textContent = 'error';
                apiStatusIconElement.className = 'material-icons offline';
            }
        } catch (error) {
            console.error('❌ Erro ao verificar status da API:', error);
            apiStatusElement.textContent = 'Erro';
            apiStatusElement.className = 'value offline';
            apiStatusIconElement.textContent = 'error';
            apiStatusIconElement.className = 'material-icons offline';
        }
    }
    async runScheduledUiRefresh() {
        if (document.hidden || this.refreshInFlight) return;

        this.refreshInFlight = true;
        try {
            await this.updateApiStatus();
            if (this.currentTab === 'dashboard') {
                await this.refreshDashboardData();
            }
        } finally {
            this.refreshInFlight = false;
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

            // Carregar operacoes agendadas para o dashboard
            const scheduledOperations = await this.loadDashboardScheduledOperations();

            // Reutilizar a resposta das operacoes agendadas no contador
            await this.updateCounters(scheduledOperations);

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
            return data;
        } catch (error) {
            console.warn('Erro ao atualizar status do sistema:', error);
            return null;
        }
    }

    // Atualizar atividades recentes
    async loadRecentActivities() {
        try {
            const data = window.DeParaRuntimeStatus
                ? await window.DeParaRuntimeStatus.fetchRecentActivities()
                : await (await fetch('/api/files/stats')).json();
            this.updateActivitiesDisplay(data);
            return data;
        } catch (error) {
            console.warn('Erro ao carregar atividades:', error);
            return null;
        }
    }

    // Carregar operações agendadas para o dashboard
    async loadDashboardScheduledOperations() {
        try {
            const data = window.DeParaRuntimeStatus
                ? await window.DeParaRuntimeStatus.fetchScheduledOperations()
                : await (await fetch('/api/files/scheduled')).json();
            this.updateDashboardScheduledOperations(data.data || []);
            return data;
        } catch (error) {
            console.warn('Erro ao carregar operações agendadas para dashboard:', error);
            return null;
        }
    }

    // Atualizar exibição de operações agendadas no dashboard
    updateDashboardScheduledOperations(operations) {
        const container = document.querySelector('#dashboard .scheduled-operations .operations-list');
        if (!container) return;

        if (operations.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhuma operação agendada</p>';
            return;
        }

        container.innerHTML = operations.slice(0, 5).map(op => `
            <div class="operation-item ${op.active ? 'active' : 'paused'}">
                <div class="operation-info">
                    <h4>${op.name || 'Operação sem nome'}</h4>
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
            container.innerHTML += `<p class="more-operations">+${operations.length - 5} operações adicionais</p>`;
        }
    }

    // Atualizar display do status do sistema
    updateSystemStatusDisplay(data) {
        try {
            logger.debug('📊 Atualizando display de status do sistema', {
                memory: data.memory,
                disk: data.disk,
                activeOperations: data.activeOperations
            });

            // Atualizar uso de memória
            const memoryElement = document.getElementById('memory-usage');
            if (memoryElement && data.memory) {
                const memoryUsage = data.memory.percentage || 0;
                memoryElement.textContent = `${memoryUsage}%`;
                logger.debug('✅ Memória atualizada', { memoryUsage });
            }

            // Atualizar uso de disco
            const diskElement = document.getElementById('disk-usage');
            if (diskElement && data.disk && data.disk.drives) {
                const drives = data.disk.drives;
                if (drives.length > 0) {
                    // Filtrar apenas discos válidos (com tamanho > 0)
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

                                // Adicionar ao texto principal (máximo 3 discos visíveis)
                                if (index < 3) {
                                    if (index > 0) diskText += ' | ';
                                    diskText += `${driveUsedGB} GB / ${driveTotalGB} GB (${driveMountpoint})`;
                                }
                            });

                            // Se há mais de 3 discos, adicionar contador
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
                logger.debug('✅ Disco atualizado', { drives, validDrives: drives.filter(d => d.total > 0) });
            }

            // Atualizar operações ativas - buscar operações agendadas
            const activeOpsElement = document.getElementById('active-ops');
            if (activeOpsElement) {
                this.updateActiveOperationsCount();
            }

        } catch (error) {
            logger.error('❌ Erro ao atualizar display de status', {
                error: error.message,
                stack: error.stack,
                data: data
            });
        }
    }

    // Atualizar display de atividades recentes
    updateActivitiesDisplay(data) {
        try {
            logger.debug('📋 Atualizando display de atividades', {
                activitiesCount: data?.activities?.length || 0,
                hasData: !!data
            });

            const activityList = document.getElementById('recent-activity');
            if (!activityList) {
                logger.warn('⚠️ Elemento recent-activity não encontrado');
                return;
            }

            // Se não há dados ou atividades
            if (!data || !data.activities || data.activities.length === 0) {
                activityList.innerHTML = `
                    <div class="activity-item">
                        <span class="material-icons">info</span>
                        <span>Nenhuma atividade recente</span>
                    </div>
                `;
                logger.info('ℹ️ Nenhuma atividade para exibir');
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
            logger.success('✅ Atividades renderizadas', {
                activitiesCount: data.activities.length,
                displayedCount: Math.min(data.activities.length, 10)
            });

        } catch (error) {
            logger.error('❌ Erro ao atualizar display de atividades', {
                error: error.message,
                stack: error.stack,
                data: data
            });
        }
    }

    // Obter ícone apropriado para o tipo de atividade
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
        if (diffMins < 60) return `${diffMins}min atrás`;
        if (diffHours < 24) return `${diffHours}h atrás`;
        return `${diffDays}d atrás`;
    }

    // Navegar para caminho de origem
    browseSourcePath() {
        if (typeof this.showFolderBrowser === 'function') {
            this.showFolderBrowser('source');
        } else {
            console.warn('Função showFolderBrowser não encontrada');
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
            console.warn('Função showFolderBrowser não encontrada');
            // Fallback: apenas focar no input
            const input = document.getElementById('dest-path');
            if (input) {
                input.focus();
                input.select();
            }
        }
    }

    // Executar operação simples
    async executeSimpleOperation(action) {
        if (this.isExecutingOperation) {
            this.showToast('Operação já em andamento. Aguarde...', 'warning');
            return;
        }

        const sourcePath = document.getElementById('source-path').value.trim();
        const destPath = document.getElementById('dest-path').value.trim();
        const recursive = document.getElementById('recursive-option').checked;
        const backup = document.getElementById('backup-option').checked;

        // Validação básica
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
            // Mostrar resultado da operação
            const resultDiv = document.getElementById('operation-result');
            const resultIcon = document.getElementById('result-icon');
            const resultText = document.getElementById('result-text');

            if (resultDiv && resultIcon && resultText) {
                resultDiv.style.display = 'block';
                resultIcon.textContent = 'hourglass_empty';
                resultText.textContent = 'Executando operação...';
            }

            // Preparar dados da operação
            const operationData = {
                action: action,
                sourcePath: sourcePath,
                targetPath: destPath,
                recursive: recursive,
                createBackup: backup
            };

            logger.info('🔄 Executando operação', {
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
                    resultText.textContent = `Operação concluída com sucesso! ${result.message || ''}`;
                    resultDiv.className = 'operation-result success';
                }
                this.showToast('Operação executada com sucesso!', 'success');

                logger.success('✅ Operação executada com sucesso', {
                    operation: operationData.action,
                    message: result.message,
                    responseTime: Date.now() - Date.now() // TODO: calcular tempo real
                });

                // Atualizar contadores e atividades
                await this.refreshDashboardData();

            } else {
                // Erro
                const errorMsg = result.message || 'Erro desconhecido na operação';
                if (resultDiv && resultIcon && resultText) {
                    resultIcon.textContent = 'error';
                    resultText.textContent = `Erro: ${errorMsg}`;
                    resultDiv.className = 'operation-result error';
                }
                this.showToast(errorMsg, 'error');
                logger.error('❌ Erro na operação', {
                    operation: operationData.action,
                    error: errorMsg,
                    result: result,
                    statusCode: response.status
                });
            }

        } catch (error) {
            const errorMsg = error.message || 'Erro de conexão';

            logger.error('❌ Erro ao executar operação', {
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
            logger.debug('🔄 Operação finalizada', { operation });
        }
    }

    // Iniciar slideshow
    async startSlideshow() {
        const folderPath = document.getElementById('slideshow-folder-path').value.trim();

        if (!folderPath) {
            this.showToast('Digite o caminho da pasta', 'error');
            return;
        }

        // Coletar extensões selecionadas
        const selectedExtensions = [];
        const extensionCheckboxes = document.querySelectorAll('.extension-selector input[type="checkbox"]:checked');
        extensionCheckboxes.forEach(checkbox => {
            selectedExtensions.push(checkbox.value);
        });

        if (selectedExtensions.length === 0) {
            this.showToast('Selecione pelo menos uma extensão de arquivo', 'error');
            return;
        }
        await this.loadSlideshowImages(folderPath, selectedExtensions, true, this.slideshowConfig.interval);
    }

    // Validação de campos com feedback visual
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
                    message = 'Nome é obrigatório';
                } else if (value.length < 3) {
                    isValid = false;
                    message = 'Nome deve ter pelo menos 3 caracteres';
                } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(value)) {
                    isValid = false;
                    message = 'Nome contém caracteres inválidos';
                }
                break;

            case 'path':
                if (!value) {
                    isValid = false;
                    message = 'Caminho é obrigatório';
                } else if (!/^[a-zA-Z0-9\s\-_\/\\:.]+$/.test(value)) {
                    isValid = false;
                    message = 'Caminho contém caracteres inválidos';
                }
                break;

            case 'email':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    isValid = false;
                    message = 'Email inválido';
                }
                break;

            default:
                isValid = !!value;
                message = 'Campo obrigatório';
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

    // Validação de formulário completo
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

    // Garantir que o campo de origem esteja sempre visível
    ensureSourceFieldVisible() {
        const sourceField = document.getElementById('source-folder-path');
        const sourceFieldParent = sourceField?.parentElement;

        if (sourceFieldParent) {
            sourceFieldParent.style.display = 'block';
        } else {
            console.warn('⚠️ Campo source-folder-path não encontrado');
        }
    }

    // Carregar pasta salva do slideshow
    loadSlideshowSavedPath() {
        const savedPath = this.getSlideshowSelectedPath();
        if (savedPath) {
            const slideshowField = document.getElementById('slideshow-folder-path');
            if (slideshowField) {
                let finalPath = savedPath;
                if (!savedPath.match(/^[A-Za-z]:[\\/]/)) {
                    finalPath = `C:\\Users\\User\\Pictures\\${savedPath.replace(/^[\\/]+/, '')}`;
                }

                slideshowField.value = finalPath;
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

    // Validação em tempo real para campos de operação
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
                // Limpar validação quando usuário começa a digitar
                const validationDiv = sourcePath.parentNode.querySelector('.validation-message');
                if (validationDiv) {
                    validationDiv.textContent = '';
                    validationDiv.className = 'validation-message';
                    sourcePath.classList.remove('invalid', 'valid');
                    sourcePath.parentNode.classList.remove('error');
                }
                // Atualizar estado dos botões
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
                // Atualizar estado dos botões
                this.updateOperationButtonsState();
            });
        }
    }

    // Feedback visual para botões de operação
    updateOperationButtonsState() {
        const sourcePath = document.getElementById('source-path');
        const destPath = document.getElementById('dest-path');
        const operationButtons = document.querySelectorAll('.simple-operation-btn');

        const hasSourcePath = sourcePath && sourcePath.value.trim();
        const hasDestPath = destPath && destPath.value.trim();

        operationButtons.forEach(btn => {
            const operation = btn.getAttribute('data-operation');

            if (operation === 'delete') {
                // Delete só precisa do caminho de origem
                btn.disabled = !hasSourcePath;
                btn.title = hasSourcePath ? 'Executar operação de exclusão' : 'Digite o caminho de origem primeiro';
            } else {
                // Move e copy precisam de origem e destino
                btn.disabled = !(hasSourcePath && hasDestPath);
                btn.title = (hasSourcePath && hasDestPath) ?
                    `Executar operação de ${operation}` :
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
    async updateCounters(scheduledData = null) {
        try {
            if (!scheduledData) {
                const scheduledResponse = await fetch('/api/files/scheduled');
                if (!scheduledResponse.ok) return;
                scheduledData = await scheduledResponse.json();
            }

            const activeOps = (scheduledData.data || []).filter(op => op.active !== false).length;
            const activeOpsElement = document.getElementById('active-ops');
            if (activeOpsElement) {
                activeOpsElement.textContent = activeOps;
            }
        } catch (error) {
            console.warn('Erro ao atualizar contadores:', error);
        }
    }

    // Atualizar contador de operações ativas
    async updateActiveOperationsCount() {
        try {
            const response = await fetch('/api/files/scheduled');
            if (response.ok) {
                const data = await response.json();
                const activeOps = data.data ? data.data.filter(op => op.active !== false).length : 0;
                const activeOpsElement = document.getElementById('active-ops');
                if (activeOpsElement) {
                    activeOpsElement.textContent = activeOps;
                    logger.debug('✅ Operações ativas atualizadas', { activeOps });
                }
            }
        } catch (error) {
            logger.warn('Erro ao atualizar contador de operações ativas:', error);
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

    // Verificar se cache é válido
    isCacheValid(key) {
        const timestamp = this.cache.timestamps[key];
        if (!timestamp) return false;
        return (Date.now() - timestamp) < this.cacheExpiry;
    }

    // Obter dados do cache ou API
    async getCachedData(key, apiCall, useCache = true) {
        if (useCache && this.isCacheValid(key) && this.cache[key]) {
            return this.cache[key];
        }

        try {
            const data = await apiCall();
            this.cache[key] = data;
            this.cache.timestamps[key] = Date.now();
            return data;
        } catch (error) {
            console.warn(`Erro ao carregar ${key}:`, error);
            // Retornar cache antigo se disponível
            if (this.cache[key]) {
                return this.cache[key];
            }
            throw error;
        }
    }

    // Limpar cache específico
    clearCache(key = null) {
        if (key) {
            this.cache[key] = null;
            delete this.cache.timestamps[key];
        } else {
            this.initializeCache();
        }
    }

    // Métodos de cache específicos
    async loadSettingsCached() {
        return this.getCachedData('settings', async () => {
            const response = await fetch('/api/health');
            if (!response.ok) throw new Error('Erro ao carregar configurações');
            return response.json();
        });
    }

    async loadFoldersCached() {
        return this.getCachedData('folders', async () => {
            // Simular carregamento de pastas (implementar conforme necessário)
            return [];
        });
    }

    async loadWorkflowsCached() {
        return this.getCachedData('workflows', async () => {
            // Simular carregamento de workflows (implementar conforme necessário)
            return [];
        });
    }

    async loadOperationsCached() {
        return this.getCachedData('operations', async () => {
            const response = await fetch('/api/files/scheduled');
            if (!response.ok) throw new Error('Erro ao carregar operações');
            return response.json();
        });
    }

    async loadStatsCached() {
        return this.getCachedData('stats', async () => {
            const response = await fetch('/api/files/stats');
            if (!response.ok) throw new Error('Erro ao carregar estatísticas');
            return response.json();
        }, false); // Stats sempre frescos
    }

    // Sistema de Gráficos
    initializeCharts() {
        this.chartData = {
            operations: 0,
            memory: 0,
            disk: 0
        };
        this.renderChart();
    }

    async updateCharts(resourcesData = null, operationsData = null) {
        try {
            // Obter dados de operações
            if (!operationsData) {
                const operationsResponse = await fetch('/api/files/scheduled');
                if (operationsResponse.ok) {
                    operationsData = await operationsResponse.json();
                }
            }
            if (operationsData) {
                this.chartData.operations = Array.isArray(operationsData.data)
                    ? operationsData.data.length
                    : 0;
            }

            // Usar dados reais de recursos
            if (!resourcesData) {
                const resourcesResponse = await fetch('/api/status/resources');
                if (resourcesResponse.ok) {
                    resourcesData = await resourcesResponse.json();
                }
            }
            if (resourcesData) {
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
            console.warn('Erro ao atualizar gráficos:', error);
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

        // Dados do gráfico
        const data = [
            { label: 'Operações', value: this.chartData.operations, color: '#667eea', max: 20 },
            { label: 'Memória', value: this.chartData.memory, color: '#764ba2', max: 100 },
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

    // Função global para atualizar gráficos
    refreshCharts() {
        if (window.deParaUI) {
            window.deParaUI.updateCharts();
        }
    }

    // Sistema de Atalhos de Teclado
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            const viewer = document.getElementById('slideshow-viewer');
            if (event.defaultPrevented || (viewer && window.getComputedStyle(viewer).display !== 'none')) {
                return;
            }
            // Ignorar se usuário está digitando em input
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            // Ctrl+S: Salvar configurações
            if (event.ctrlKey && event.key === 's') {
                event.preventDefault();
                this.quickSave();
                this.showToast('Configurações salvas!', 'success');
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

            // Alt+F: Ir para Operações de Arquivos
            if (event.altKey && event.key === 'f') {
                event.preventDefault();
                this.switchTab('fileops');
                return;
            }

            // Alt+S: Ir para Operações Agendadas
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

            // Alt+C: Ir para Configurações
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

        // Tentar diferentes métodos de fullscreen
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
            console.warn('Fullscreen não suportado neste navegador');
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
                controls.style.display = 'none';
            }, 300);
        }
    }

    // Fechar aplicação
    closeApplication() {
        // Primeiro sair do fullscreen se estiver ativo
        this.exitDashboardFullscreen();

        // Aguardar um pouco para garantir que as operações sejam concluídas
        setTimeout(() => {
            // Tentar fechar a janela do navegador/Electron
            if (window.close) {
                window.close();
            } else if (window.electronAPI && window.electronAPI.closeApp) {
                // Se estiver rodando no Electron
                window.electronAPI.closeApp();
            } else {
                // Fallback: mostrar mensagem para o usuário
                alert('Para fechar a aplicação, use Alt+F4 ou feche a janela do navegador.');
            }
        }, 500);
    }

    // Configurar controles de fullscreen do dashboard
    setupDashboardFullscreenControls() {
        // Botão sair do fullscreen
        const exitFullscreenBtn = document.getElementById('dashboard-exit-fullscreen-btn');
        if (exitFullscreenBtn) {
            exitFullscreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                logger.info('Botão sair fullscreen clicado', { source: 'dashboard-controls' });
                this.exitDashboardFullscreen();
            });
            logger.debug('Listener do botão exit fullscreen configurado');
        } else {
            console.warn('⚠️ Botão exit fullscreen não encontrado');
            logger.warn('Botão exit fullscreen não encontrado no DOM');
        }

        // Botão fechar aplicação
        const closeAppBtn = document.getElementById('dashboard-close-app-btn');
        if (closeAppBtn) {
            closeAppBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                logger.info('Botão fechar aplicação clicado', { source: 'dashboard-controls' });
                this.closeApplication();
            });
            logger.debug('Listener do botão fechar aplicação configurado');
        } else {
            console.warn('⚠️ Botão fechar aplicação não encontrado');
            logger.warn('Botão fechar aplicação não encontrado no DOM');
        }

        // Botão de fullscreen no header
        const headerFullscreenBtn = document.getElementById('header-fullscreen-btn');
        if (headerFullscreenBtn) {
            headerFullscreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleDashboardFullscreen();
            });
        }

        // Listener para mudanças de fullscreen do dashboard
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

    // Lidar com mudanças de fullscreen do dashboard
    handleDashboardFullscreenChange() {
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer && window.getComputedStyle(viewer).display !== 'none') {
            this.hideDashboardFullscreenControls();
            return;
        }
        const isFullscreen = !!(document.fullscreenElement ||
                               document.webkitFullscreenElement ||
                               document.mozFullScreenElement ||
                               document.msFullscreenElement);
        // Atualizar botão do header
        this.updateHeaderFullscreenButton(isFullscreen);

        if (isFullscreen) {
            this.showDashboardFullscreenControls();
        } else {
            this.hideDashboardFullscreenControls();
        }
    }

    // Atualizar botão de fullscreen no header
    updateHeaderFullscreenButton(isFullscreen) {
        const headerBtn = document.getElementById('header-fullscreen-btn');
        if (headerBtn) {
            const icon = headerBtn.querySelector('.material-icons');
            const text = headerBtn.querySelector('span:not(.material-icons)') || headerBtn.childNodes[headerBtn.childNodes.length - 1];

            if (isFullscreen) {
                // Modo fullscreen - esconder botão do header para evitar redundância
                headerBtn.style.display = 'none';
            } else {
                // Modo normal - mostrar botão do header
                headerBtn.style.display = 'flex';
                if (icon) icon.textContent = 'fullscreen';
                if (text) text.textContent = 'Tela Cheia';
                headerBtn.title = 'Alternar tela cheia (F11)';
                headerBtn.style.background = 'rgba(52,144,220,0.1)';
                headerBtn.style.borderColor = 'rgba(52,144,220,0.3)';
            }
        }
    }

    // Salvar configurações rapidamente
    async quickSave() {
        try {
            // Salvar configurações da aba atual
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
        this.clearCache(); // Limpar cache para forçar atualização
        await this.refreshDashboardData();
        await this.loadOperationsCached();
    }


    // Fechar todos os modais
    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
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
            this.screensaverState.timerId = null;
        }
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer && window.getComputedStyle(viewer).display !== 'none') return;

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
            { key: 'Ctrl+S', description: 'Salvar configurações' },
            { key: 'Ctrl+R', description: 'Atualizar dados' },
            { key: 'F1', description: 'Mostrar esta ajuda' },
            { key: 'Alt+D', description: 'Ir para Dashboard' },
            { key: 'Alt+F', description: 'Ir para Operações de Arquivos' },
            { key: 'Alt+S', description: 'Ir para Operações Agendadas' },
            { key: 'Alt+B', description: 'Ir para Backups' },
            { key: 'Alt+C', description: 'Ir para Configurações' },
            { key: 'Esc', description: 'Fechar modais' }
        ];

        let helpText = '🎹 Atalhos de Teclado Disponíveis:\n\n';
        shortcuts.forEach(shortcut => {
            helpText += `${shortcut.key.padEnd(10)} - ${shortcut.description}\n`;
        });

        alert(helpText);
    }

    // Sistema de Busca em Operações
    filterScheduledOperations(searchTerm) {
        const searchInput = document.getElementById('scheduled-search');
        const clearButton = document.querySelector('.clear-search');
        const operationsList = document.getElementById('scheduled-operations-list');

        if (!operationsList) return;

        const operationItems = operationsList.querySelectorAll('.operation-item');

        if (searchTerm.trim() === '') {
            // Mostrar todas as operações
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

            countElement.textContent = `Encontrados ${visibleItems.length} de ${totalItems.length} operações`;
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

    // Função global para busca
    filterScheduledOperationsGlobal(searchTerm) {
        if (window.deParaUI) {
            window.deParaUI.filterScheduledOperations(searchTerm);
        }
    }

    // Funções globais serão definidas após a inicialização

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

        // Tornar elemento relativo se não for
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

    // Wrapper para funções assíncronas com loading
    async withLoading(elementId, asyncFunction, message = 'Carregando...') {
        try {
            this.showLoading(elementId, message);
            const result = await asyncFunction();
            return result;
        } finally {
            this.hideLoading(elementId);
        }
    }

    // Loading para botões
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

    // Loading para formulários
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
        this.showToast('Tutorial pulado! Você pode acessá-lo novamente pelo botão de ajuda.', 'info');
    }

    startOnboarding() {
        this.quickSetup();
    }

    closeOnboarding() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');
        this.showToast('Tutorial fechado! Use o botão de ajuda se precisar de orientações.', 'info');
    }

    quickSetup() {
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) overlay.style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');
        this.switchTab('fileops');
        this.showToast('Escolha a pasta de origem e a ação para começar.', 'info');
        document.querySelector('.select-folder-btn')?.focus();
    }

    // Mostrar confirmação antes da configuração automática
    async showQuickSetupConfirmation() {
        return new Promise((resolve) => {
            const confirmationHtml = `
                <div style="text-align: center; padding: 20px;">
                    <h3 style="color: #2196F3; margin-bottom: 15px;">🔧 Configuração Automática</h3>
                    <p style="margin-bottom: 20px; color: #666;">
                        O sistema pode criar automaticamente pastas e templates básicos para você começar a usar imediatamente.
                    </p>

                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                        <h4 style="margin-bottom: 10px; color: #333;">📁 Pastas que serão criadas:</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #555;">
                            <li><strong>Documentos Entrada</strong> - Para arquivos de entrada</li>
                            <li><strong>Documentos Processados</strong> - Para arquivos processados</li>
                            <li><strong>Backup Automático</strong> - Para backups</li>
                        </ul>
                    </div>

                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                        <h4 style="margin-bottom: 10px; color: #333;">⚙️ Templates que serão criados:</h4>
                        <ul style="margin: 0; padding-left: 20px; color: #555;">
                            <li><strong>Backup Diário</strong> - Backup automático diário</li>
                            <li><strong>Limpeza Semanal</strong> - Limpeza de arquivos temporários</li>
                        </ul>
                    </div>

                    <p style="color: #ff9800; font-size: 14px; margin-bottom: 20px;">
                        ⚠️ <strong>Atenção:</strong> Isso criará pastas no seu sistema de arquivos. Você pode remover ou modificar tudo depois.
                    </p>
                </div>
            `;

            // Criar modal de confirmação
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
                            ❌ Cancelar
                        </button>
                        <button class="quick-setup-approve-btn" style="background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            ✅ Aprovar e Continuar
                        </button>
                    </div>
                </div>
            `;

            // Armazenar função de resolução
            window.quickSetupResolve = resolve;

            document.body.appendChild(modal);

            // Configurar event listeners para os botões
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

    // Função para obter caminhos padrão baseados na plataforma
    getDefaultPaths() {
        return {
            entrada: 'C:\\Users\\User\\Documents\\Entrada',
            processados: 'C:\\Users\\User\\Documents\\Processados',
            backup: 'C:\\Users\\User\\Documents\\Backup',
            temporarios: 'C:\\Users\\User\\AppData\\Local\\Temp'
        };
    }

    // Criar pastas padrão automaticamente
    async createDefaultFolders() {
        const paths = this.getDefaultPaths();
        const defaultFolders = [
            { name: 'Documentos Entrada', path: paths.entrada, type: 'source', format: 'any' },
            { name: 'Documentos Processados', path: paths.processados, type: 'target', format: 'any' },
            { name: 'Backup Automático', path: paths.backup, type: 'target', format: 'any' }
        ];

        for (const folder of defaultFolders) {
            try {
                await this.saveFolderToServer(folder);
            } catch (error) {
                console.warn(`Erro ao criar pasta ${folder.name}:`, error);
            }
        }
    }

    // Criar templates básicos
    async createDefaultTemplates() {
        const paths = this.getDefaultPaths();
        const templates = [
            {
                name: 'Backup Diário',
                description: 'Faz backup diário de documentos importantes',
                action: 'copy',
                source: paths.entrada,
                target: paths.backup,
                frequency: '1d',
                options: { batch: true, backupBeforeMove: false }
            },
            {
                name: 'Limpeza Semanal',
                description: 'Remove arquivos temporários semanalmente',
                action: 'delete',
                source: paths.temporarios,
                target: '',
                frequency: '1w',
                options: { batch: true }
            }
        ];

        for (const template of templates) {
            try {
                await this.saveTemplate(template);
            } catch (error) {
                console.warn(`Erro ao criar template ${template.name}:`, error);
            }
        }
    }

    // Mostrar resultados da configuração rápida
    showQuickSetupResults() {
        const results = `
        <div style="text-align: center; padding: 20px;">
            <h3 style="color: #4caf50; margin-bottom: 15px;">🎉 Configuração Concluída!</h3>
            <p style="margin-bottom: 20px;">Pastas e templates foram criados automaticamente:</p>

            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                <h4>📁 Pastas Criadas:</h4>
                <ul style="margin: 10px 0;">
                    <li>📥 <strong>Documentos Entrada</strong> - Para arquivos de entrada</li>
                    <li>📤 <strong>Documentos Processados</strong> - Para arquivos processados</li>
                    <li>💾 <strong>Backup Automático</strong> - Para backups</li>
                </ul>
            </div>

            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                <h4>⚙️ Templates Criados:</h4>
                <ul style="margin: 10px 0;">
                    <li>📅 <strong>Backup Diário</strong> - Backup automático diário</li>
                    <li>🧹 <strong>Limpeza Semanal</strong> - Limpeza de arquivos temporários</li>
                </ul>
            </div>

            <p style="color: #666; font-size: 14px;">
                Você pode personalizar essas configurações nas abas "Operações de Arquivos" e "Configurações".
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
                        🎯 Começar a Usar!
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Configurar event listener para o botão fechar
        const closeBtn = modal.querySelector('.quick-setup-results-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }
    }

    // Sistema de configuração rápida de pastas
    async createQuickFolder(type) {
        const paths = this.getDefaultPaths();
        const basePath = 'C:\\Users\\User';

        const folderSets = {
            documents: [
                { name: 'Documentos Entrada', path: paths.entrada, type: 'source', format: 'any' },
                { name: 'Documentos Processados', path: paths.processados, type: 'target', format: 'any' }
            ],
            backup: [
                { name: 'Backup Diário', path: basePath + '\\Backup\\Diario', type: 'target', format: 'any' },
                { name: 'Backup Semanal', path: basePath + '\\Backup\\Semanal', type: 'target', format: 'any' }
            ],
            media: [
                { name: 'Fotos', path: basePath + '\\Pictures', type: 'source', format: 'any' },
                { name: 'Vídeos', path: basePath + '\\Videos', type: 'source', format: 'any' }
            ],
            temp: [
                { name: 'Processamento', path: basePath + '\\Temp\\Processamento', type: 'temp', format: 'any' },
                { name: 'Lixeira', path: basePath + '\\Temp\\Lixeira', type: 'trash', format: 'any' }
            ]
        };

        const folders = folderSets[type];
        if (!folders) {
            console.error(`❌ Tipo de pasta inválido: ${type}`);
            this.showToast('❌ Tipo de pasta inválido', 'error');
            return;
        }

        this.showToast(`[init] Criando pastas de ${type}...`, 'info');

        try {
            // Criar pastas uma por vez para melhor controle
            for (const folder of folders) {
                try {
                    await this.createFolderOnServer(folder);
                } catch (error) {
                    console.warn(`⚠️ Erro ao criar pasta ${folder.name}:`, error);
                    // Continua tentando as outras pastas
                }
            }

            // Criar templates relacionados
            await this.createRelatedTemplates(type);

            this.showToast(`✅ Pastas de ${type} criadas com sucesso!`, 'success');
            this.refreshFoldersList();

        } catch (error) {
            console.error('❌ Erro geral ao criar pastas:', error);
            this.showToast('❌ Erro ao criar pastas', 'error');
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
        // Obter caminhos padrão baseados na plataforma
        const paths = this.getDefaultPaths();

        const templateSets = {
            documents: [
                {
                    name: 'Backup Documentos',
                    description: 'Faz backup diário de documentos importantes',
                    action: 'copy',
                    sourcePath: paths.entrada,
                    targetPath: paths.processados,
                    frequency: '1d',
                    options: { batch: true, backupBeforeMove: false }
                }
            ],
            backup: [
                {
                    name: 'Backup Diário',
                    description: 'Backup automático diário',
                    action: 'copy',
                    sourcePath: paths.entrada.replace('/Entrada', '').replace('\\Entrada', ''),
                    targetPath: paths.backup + '\\Diario',
                    frequency: '1d',
                    options: { batch: true, backupBeforeMove: true }
                },
                {
                    name: 'Backup Semanal',
                    description: 'Backup completo semanal',
                    action: 'copy',
                    sourcePath: paths.entrada.replace('/Entrada', '').replace('\\Entrada', ''),
                    targetPath: paths.backup + '\\Semanal',
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
                    name: 'Limpar Temporários',
                    description: 'Remove arquivos temporários semanalmente',
                    action: 'delete',
                    sourcePath: paths.temporarios,
                    targetPath: '',
                    frequency: '1w',
                    options: { batch: true }
                }
            ]
        };

        const templates = templateSets[type] || [];

        for (const template of templates) {
            try {
                await this.createTemplateOnServer(template);
            } catch (error) {
                console.warn(`⚠️ Erro ao criar template ${template.name}:`, error);
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


    // Atualizar lista de pastas
    async refreshFoldersList() {
        try {
            // Carregar pastas do servidor
            await this.loadFolders();

            // Atualizar interface
            this.updateFoldersDisplay();

            this.showToast('✅ Lista de pastas atualizada!', 'success');
        } catch (error) {
            console.error('❌ Erro ao atualizar lista de pastas:', error);
            this.showToast('❌ Erro ao atualizar lista', 'error');
        }
    }

    // Atualizar exibição de pastas
    updateFoldersDisplay() {
        const foldersList = document.getElementById('folders-list');
        if (!foldersList) return;

        if (this.folders.length === 0) {
            foldersList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">folder_open</span>
                    <p>Nenhuma pasta configurada</p>
                    <small>Use &quot;Gerenciar Pastas&quot; acima ou configure manualmente</small>
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

            // Configurar event listeners para os botões de editar/deletar
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

    // Obter ícone da pasta baseado no tipo
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
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            // Implementar modal de edição
            this.showToast('Edicao rapida indisponivel no momento. Use excluir e criar novamente para alterar a pasta.', 'warning');
        } else {
            this.showToast('Pasta não encontrada', 'error');
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
                    this.showToast('✅ Pasta excluída com sucesso!', 'success');
                    await this.refreshFoldersList();
                } else {
                    throw new Error(`Erro HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('❌ Erro ao excluir pasta:', error);
                this.showToast('❌ Erro ao excluir pasta', 'error');
            }
        }
    }

    // Atualizar exibição de workflows (placeholder)
    updateWorkflowsDisplay() {
        // Implementar conforme necessário
    }

    // Adicionar event listeners para operações de arquivo
    addFileOperationEventListeners() {
        // Mostrar/ocultar filtro de extensões quando recursão é selecionada
        const recursiveCheckbox = document.getElementById('recursive-operation');
        const extensionsFilter = document.getElementById('extensions-filter');

        if (recursiveCheckbox && extensionsFilter) {
            recursiveCheckbox.addEventListener('change', (e) => {
                extensionsFilter.style.display = e.target.checked ? 'block' : 'none';
            });
        }
    }

    // Configurar event listeners para todos os novos botões
    setupAdditionalEventListeners() {
        // Botões de dashboard
        this.addButtonListener('.refresh-charts-btn', () => this.updateCharts());
        this.addButtonListener('.clear-search-btn', () => this.clearSearch());
        this.addButtonListener('.schedule-modal-btn', () => {
            this.switchTab('scheduled');
            if (typeof window.showScheduleModal === 'function') {
                window.showScheduleModal({ operation: {}, mode: 'create' });
            }
        });

        // Botões de ação rápida (interface antiga) - redirecionar para nova interface
        this.addButtonListener('.action-move-btn', () => this.redirectToFileOperations('move'));
        this.addButtonListener('.action-copy-btn', () => this.redirectToFileOperations('copy'));
        this.addButtonListener('.action-delete-btn', () => this.redirectToFileOperations('delete'));
        this.addButtonListener('.action-schedule-btn', () => this.redirectToFileOperations('schedule'));
        this.addButtonListener('.action-slideshow-btn', () => this.showSlideshowModal());

        // Botões de backup
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
        this.addButtonListener('.load-recovery-btn', () => loadRecoveryEntries());

        document.addEventListener('click', (event) => {
            const restoreButton = event.target.closest('.restore-recovery-btn');
            if (restoreButton) {
                restoreRecoveryEntry(restoreButton.getAttribute('data-entry-id'));
            }
        });

        // Botões de configurações
        this.addButtonListener('.show-ignored-btn', () => window.showIgnoredPatterns());
        this.addButtonListener('.save-settings-btn', () => this.saveSettings());

        // Botões de workflow
        this.addButtonListener('.close-workflow-btn', () => window.closeWorkflowModal());
        this.addButtonListener('#prev-step', () => window.previousWorkflowStep());
        this.addButtonListener('#next-step', () => window.nextWorkflowStep());
        this.addButtonListener('#save-step', () => window.saveWorkflow());
        this.addButtonListener('.cancel-workflow-btn', () => window.closeWorkflowModal());

        // Botões de gerenciamento de pastas
        this.addButtonListener('.close-folder-manager-btn', () => window.closeFolderManagerModal());
        this.addButtonListener('.cancel-folder-manager-btn', () => window.closeFolderManagerModal());
        this.addButtonListener('.save-folder-btn', () => window.saveFolder());

        // Botões de operações de arquivo
        this.addButtonListener('.close-file-operation-btn', () => {
            if (typeof closeFileOperationModal === 'function') closeFileOperationModal();
        });
        this.addButtonListener('.cancel-file-operation-btn', () => {
            if (typeof closeFileOperationModal === 'function') closeFileOperationModal();
        });
        this.addButtonListener('.execute-file-operation-btn', () => {
            if (typeof executeFileOperation === 'function') executeFileOperation();
        });

        // Botões de agendamento
        this.addButtonListener('.close-schedule-btn', () => hideScheduleModal());
        this.addButtonListener('.cancel-schedule-btn', () => hideScheduleModal());

        // Botões de filtros rápidos (event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.filter-btn')) {
                const btn = e.target.closest('.filter-btn');
                this.selectFilter({ target: btn });
            }
        });

        // Botões de navegação de pastas no modal de agendamento
        this.addButtonListener('#browse-source-btn', () => this.browsePathForSchedule('source'));
        this.addButtonListener('#browse-target-btn', () => this.browsePathForSchedule('target'));

        // Botões de operações agendadas (event delegation)
        document.addEventListener('click', (e) => {
            const cancelFileButton = e.target.closest('.cancel-file-operation-btn');
            if (cancelFileButton) {
                cancelFileOperation(cancelFileButton.getAttribute('data-operation-id'));
                return;
            }
            if (e.target.closest('.schedule-btn')) {
                if (typeof window.showScheduleModal === 'function') {
                    this.configureOperation();
                } else {
                    this.showToast('Funcionalidade de agendamento não disponível', 'warning');
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

        // Botão de reload da página
        this.addButtonListener('.reload-page-btn', () => window.location.reload());

        // Botões de slideshow
        this.addButtonListener('.close-slideshow-folder-btn', () => window.closeSlideshowFolderModal());
        this.addButtonListener('.cancel-slideshow-folder-btn', () => window.closeSlideshowFolderModal());
        this.addButtonListener('.close-slideshow-config-btn', () => window.closeSlideshowConfigModal());
        // Event listeners antigos removidos - usando botões estáticos

        // Botão seletor de pasta
        this.addButtonListener('.select-folder-btn', () => {
            this.showFolderBrowser('source');
        });

        // Botão seletor de pasta de destino
        this.addButtonListener('.select-target-btn', () => {
            this.showFolderBrowser('target');
        });

        // Botões de operação
        this.addButtonListener('.move-btn', () => this.selectOperation('move'));
        this.addButtonListener('.copy-btn', () => this.selectOperation('copy'));
        this.addButtonListener('.delete-btn', () => this.selectOperation('delete'));

        // Botões de sugestão de pasta
        this.addButtonListener('.suggestion-btn', (e) => this.selectSuggestedFolder(e));

        // Botões de ação
        this.addButtonListener('.execute-now-btn', () => this.executeNow());

        // Filtros de busca (input events)
        const searchInput = document.getElementById('scheduled-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterScheduledOperations(e.target.value);
            });
        }
    }

    // Função auxiliar para adicionar event listeners de botões
    addButtonListener(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener('click', callback);
        }
    }

    // Redirecionar da interface antiga para a nova
    redirectToFileOperations(operation) {
        // Mudar para a aba de operações de arquivos
        this.switchTab('fileops');

        // Pré-selecionar a operação
        setTimeout(() => {
            this.selectOperation(operation);
            this.showToast(`Use a nova interface abaixo para configurar a operação de ${operation}`, 'info');
        }, 100);
    }

    // ==========================================
    // OPERATION CONFIGURATION
    // ==========================================

    // Estado da configuração atual
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
        return 'C:\\Users\\User';
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

    // Mostrar diálogo nativo de seleção de pasta
    showNativeFolderDialog(targetType) {
        this.showFolderBrowser(targetType);
    }





    // Renderizar lista de pastas
    renderFolders(folders, currentPath) {
        const pathInput = document.getElementById('browser-path');
        if (pathInput) {
            pathInput.value = currentPath;
        }

        const folderList = document.getElementById('folder-list');
        if (!folderList) {
            console.error('❌ Elemento folder-list não encontrado!');
            return;
        }

        if (!folders || folders.length === 0) {
            folderList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">folder_open</span>
                    <p>Nenhuma pasta encontrada</p>
                    <small>Este diretório não contém subpastas ou o caminho não existe</small>
                    <button class="btn btn-sm btn-outline folder-retry-btn" style="margin-top: 10px;">
                        <span class="material-icons">refresh</span>
                        Tentar Novamente
                    </button>
                </div>
            `;

            // Configurar event listener para o botão de tentar novamente
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
                const path = item.getAttribute('data-path');
                this.navigateTo(path);
            });
        });
    }

    // Navegar para uma pasta
    navigateTo(path) {
        this.loadFoldersForBrowser(path);
    }


    // Selecionar filtro rápido
    selectFilter(event) {
        const button = event.target;
        const filter = button.getAttribute('data-filter');
        const filterInput = document.getElementById('schedule-filters');
        if (filterInput) {
            filterInput.value = filter;

            // Remover classe active de todos os botões
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // Adicionar classe active ao botão clicado
            button.classList.add('active');
            // Atualizar resumo da operação se estiver visível
            if (typeof updateOperationSummary === 'function') {
                updateOperationSummary();
            }
        } else {
            console.error('❌ Campo de filtros não encontrado!');
        }
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
        } catch (error) {
        }

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
        // Barra de busca de operações agendadas
        const searchInput = document.querySelector('.filter-scheduled-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterScheduledOperations(e.target.value);
            });
        }

        // Selects do formulário de operações
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

        // Checkboxes de transformação
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

        // Selects do formulário de pastas
        const folderTypeSelect = document.querySelector('.folder-type-select');
        if (folderTypeSelect) {
            folderTypeSelect.addEventListener('change', () => {
                this.updateFolderTypeHelp();
            });
        }

        // Select do formulário de agendamento
        const scheduleActionSelect = document.querySelector('.schedule-action-select');
        if (scheduleActionSelect) {
            scheduleActionSelect.addEventListener('change', () => {
                if (typeof updateScheduleForm === 'function') {
                    updateScheduleForm();
                }
            });
        }

        // Event listeners para atualizar resumo da operação
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

        // Input de validação de nome
        const nameInput = document.querySelector('.validate-name-input');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.validateField(e.target, 'name');
            });
        }

        // Botões de navegação de pastas no dashboard
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

        // Botões de operações simples
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

        const operationId = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let operationTimer = null;
        try {
            this.isExecutingOperation = true;
            this.updateOperationDraft({ mode: 'execute' });

            const { sourcePath, operation, targetPath, options } = validation.draft;
            operationTimer = startOperationProgressPolling(operationId);
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
                        preserveStructure: true,
                        operationId
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
            stopOperationProgressPolling(operationTimer);
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
        interval: 10,
        random: false,
        preload: false,
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
        recursive: true,
        deletedFolder: '',
        hiddenFolder: '',
        adjustableFolder: ''
    };
    preloadedImages = new Map();
    slideshowLoadTimeout = null;
    slideshowRenderToken = 0;
    slideshowCatalogId = null;
    slideshowCatalogPage = 0;
    slideshowCatalogPageSize = 250;
    slideshowCatalogNextCursor = null;
    slideshowCatalogPageCursors = [];
    slideshowCatalogLoadedCount = 0;
    slideshowCatalogTotalCount = null;
    slideshowCatalogHasMore = false;
    slideshowCatalogFolderPath = '';
    slideshowCatalogExtensions = [];
    slideshowCatalogRecursive = true;
    slideshowCatalogLoading = false;
    slideshowCatalogFirstPage = [];
    slideshowRemovedImagePaths = new Set();

    getDefaultSlideshowConfig() {
        return {
            interval: 10,
            random: false,
            preload: false,
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
            interval: Math.max(1, Math.min(300, Number(config.interval) || defaults.interval)),
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
        if (typeof serverConfig.slideshowSelectedPath === 'string' && serverConfig.slideshowSelectedPath.trim()) {
            return serverConfig;
        }
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


    // Carregar configurações do slideshow do localStorage
    loadSlideshowConfig() {
        const saved = localStorage.getItem('slideshowConfig');
        if (saved) {
            try {
                this.slideshowConfig = { ...this.slideshowConfig, ...JSON.parse(saved) };
            } catch (error) {
                console.warn('⚠️ Erro ao carregar configurações do slideshow:', error);
            }
        }
    }


    // Aplicar configurações do modal para o objeto de configuração
    applySlideshowConfigFromModal() {
        const interval = Number(document.getElementById('slideshow-interval').value) || this.getDefaultSlideshowConfig().interval;
        const random = document.getElementById('slideshow-random').checked;
        const preload = document.getElementById('slideshow-preload').checked;
        const recursive = document.getElementById('slideshow-recursive').checked;

        // Coletar extensões selecionadas
        const extensionCheckboxes = document.querySelectorAll('.extensions-list input[type="checkbox"]');
        const extensions = Array.from(extensionCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        // Coletar pastas de organização
        const deletedField = document.getElementById('slideshow-deleted-folder');
        const hiddenField = document.getElementById('slideshow-hidden-folder');
        const adjustableField = document.getElementById('slideshow-adjustable-folder');

        const deletedFolder = deletedField ? deletedField.value.trim() : '';
        const hiddenFolder = hiddenField ? hiddenField.value.trim() : '';
        const adjustableFolder = adjustableField ? adjustableField.value.trim() : '';
        this.slideshowConfig = {
            interval: Math.max(1, Math.min(300, interval)),
            random,
            preload,
            extensions: extensions.length > 0 ? extensions : ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
            recursive,
            deletedFolder,
            hiddenFolder,
            adjustableFolder
        };
    }

    // Aplicar configurações salvas ao modal
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
        this.syncSlideshowIntervalPreset();
        document.getElementById('slideshow-random').checked = this.slideshowConfig.random;
        document.getElementById('slideshow-preload').checked = this.slideshowConfig.preload;
        document.getElementById('slideshow-recursive').checked = this.slideshowConfig.recursive;

        // Aplicar extensões selecionadas
        const extensionCheckboxes = document.querySelectorAll('.extensions-list input[type="checkbox"]');
        extensionCheckboxes.forEach(cb => {
            cb.checked = this.slideshowConfig.extensions.includes(cb.value);
        });

        // Aplicar pastas de organização
        const deletedField = document.getElementById('slideshow-deleted-folder');
        const hiddenField = document.getElementById('slideshow-hidden-folder');
        const adjustableField = document.getElementById('slideshow-adjustable-folder');

        if (deletedField) {
            deletedField.value = this.slideshowConfig.deletedFolder || '';
        } else {
            console.error('❌ Campo slideshow-deleted-folder não encontrado');
        }

        if (hiddenField) {
            hiddenField.value = this.slideshowConfig.hiddenFolder || '';
        } else {
            console.error('❌ Campo slideshow-hidden-folder não encontrado');
        }

        if (adjustableField) {
            adjustableField.value = this.slideshowConfig.adjustableFolder || '';
        } else {
            console.error('❌ Campo slideshow-adjustable-folder não encontrado');
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


    syncSlideshowIntervalPreset() {
        const interval = document.getElementById('slideshow-interval');
        const preset = document.getElementById('slideshow-interval-preset');
        if (!interval || !preset) return;
        const value = String(Number(interval.value));
        preset.value = Array.from(preset.options).some(option => option.value === value) ? value : '';
    }

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
        bindInputOnce('#slideshow-interval-preset', (event) => {
            if (event.target.value) {
                document.getElementById('slideshow-interval').value = event.target.value;
            }
        });
        bindInputOnce('#slideshow-interval', () => this.syncSlideshowIntervalPreset());
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
                if (e.defaultPrevented || e.isComposing) return;
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
            }, true);
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
        this.slideshowReturnFocus = document.activeElement;
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


    // Navegar para pasta de fotos excluídas
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

    // Configurar event listeners para o modal de seleção de pasta do slideshow
    setupSlideshowFolderEventListeners(modal) {
        // Botão fechar
        const closeBtn = modal.querySelector('.slideshow-folder-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }

        // Botão testar
        const testBtn = modal.querySelector('.slideshow-folder-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testFolderPath());
        }

        // Botões de sugestão
        const suggestionBtns = modal.querySelectorAll('.slideshow-suggestion-btn');
        suggestionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const path = btn.getAttribute('data-path');
                this.selectSuggestedFolder(path);
            });
        });

        // Botão cancelar
        const cancelBtn = modal.querySelector('.slideshow-folder-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => modal.remove());
        }

        // Botão selecionar
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
            this.showToast('Digite um caminho válido', 'warning');
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
                    recursive: true,
                    countOnly: true
                })
            });

            const result = await response.json();

            if (result.success) {
                const count = result.data.totalCount;
                this.showToast(`✅ Pasta encontrada! ${count} imagem(ns) localizada(s)`, 'success');
            } else {
                this.showToast('❌ Pasta não encontrada ou inacessível', 'error');
            }
        } catch (error) {
            this.showToast('❌ Erro ao testar pasta', 'error');
        }
    }

    // Confirmar seleção de pasta
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
        if (this.slideshowStartInFlight) return;
        const folderPath = document.getElementById('slideshow-folder-path').value.trim();

        if (!folderPath) {
            this.showToast('Selecione uma pasta com imagens', 'error');
            return;
        }

        if (!/^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/.test(folderPath)) {
            this.showToast('Selecione uma pasta com caminho completo do Windows', 'error');
            return;
        }

        this.slideshowStartInFlight = true;
        const startButton = document.querySelector('.slideshow-start-btn');
        if (startButton) startButton.disabled = true;
        try {
            await this.persistSlideshowSelectedPath(folderPath);
            await this.persistSlideshowConfigFromModal(false);
            this.closeSlideshowModal();
            await this.loadSlideshowImages(
                folderPath,
                this.slideshowConfig.extensions,
                this.slideshowConfig.recursive,
                this.slideshowConfig.interval
            );
        } catch (error) {
            this.showToast('Não foi possível iniciar o slideshow: ' + error.message, 'error');
        } finally {
            this.slideshowStartInFlight = false;
            if (startButton) startButton.disabled = false;
        }
    }

    // Carregar imagens do slideshow
    async loadSlideshowImages(folderPath, extensions, recursive, interval) {
        try {
            this.showToast('🔍 Procurando imagens...', 'info');
            this.slideshowCatalogId = null;
            this.slideshowCatalogPage = 0;
            this.slideshowCatalogPageCursors = [];
            this.slideshowCatalogNextCursor = null;
            this.slideshowCatalogLoadedCount = 0;
            this.slideshowCatalogTotalCount = null;
            this.slideshowCatalogHasMore = false;
            this.slideshowCatalogFolderPath = folderPath;
            this.slideshowCatalogExtensions = extensions.map(ext => ext.startsWith('.') ? ext : '.' + ext);
            this.slideshowCatalogRecursive = recursive;
            this.slideshowCatalogFirstPage = [];
            this.slideshowRemovedImagePaths = new Set();
            this.slideshowInterval = interval * 1000;

            const data = await this.requestSlideshowPage(null);
            this.applySlideshowPage(data, 0, 0);
            if (this.slideshowImages.length === 0) {
                this.showToast('Nenhuma imagem encontrada na pasta', 'warning');
                return;
            }

            if (this.slideshowConfig.random) {
                this.shuffleArray(this.slideshowImages);
            }

            this.preloadedImages.clear();

            const modeText = this.slideshowConfig.random ? ' (ordem aleatória)' : ' (ordem sequencial)';
            const countText = this.slideshowCatalogTotalCount === null
                ? `${this.slideshowCatalogLoadedCount}+`
                : this.slideshowCatalogTotalCount;
            this.showToast(`✅ ${countText} imagens encontradas${modeText}`, 'success');
            this.startSlideshowViewer();

        } catch (error) {
            console.error('Erro ao carregar imagens:', error);
            this.showToast('Erro ao carregar imagens: ' + error.message, 'error');
        }
    }

    async requestSlideshowPage(cursor) {
        const body = {
            folderPath: this.slideshowCatalogFolderPath,
            extensions: this.slideshowCatalogExtensions,
            recursive: this.slideshowCatalogRecursive,
            pageSize: this.slideshowCatalogPageSize
        };

        if (this.slideshowCatalogId) {
            body.catalogId = this.slideshowCatalogId;
        }
        if (cursor) {
            body.cursor = cursor;
        }

        const response = await fetch('/api/files/list-images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success || !result.data?.pagination) {
            throw new Error(result.error?.message || 'Resposta da API não contém paginação');
        }

        return result.data;
    }

    applySlideshowPage(data, page, currentIndex = 0) {
        const pagination = data.pagination;
        this.slideshowImages = (Array.isArray(data.images) ? data.images : [])
            .filter((image) => !this.slideshowRemovedImagePaths.has(image.path));
        this.currentSlideIndex = Math.min(
            Math.max(0, currentIndex),
            Math.max(0, this.slideshowImages.length - 1)
        );
        this.slideshowCatalogId = pagination.catalogId;
        this.slideshowCatalogPage = page;
        this.slideshowCatalogPageSize = pagination.pageSize || this.slideshowCatalogPageSize;
        this.slideshowCatalogLoadedCount = Math.max(
            0,
            (pagination.loadedCount || this.slideshowImages.length) - this.slideshowRemovedImagePaths.size
        );
        this.slideshowCatalogTotalCount = pagination.totalCount === null || pagination.totalCount === undefined
            ? null
            : Math.max(0, pagination.totalCount - this.slideshowRemovedImagePaths.size);
        this.slideshowCatalogHasMore = Boolean(pagination.hasMore);
        this.slideshowCatalogNextCursor = pagination.nextCursor;
        this.slideshowCatalogPageCursors[page] = page === 0 ? null : pagination.cursor;
        if (page === 0) {
            this.slideshowCatalogFirstPage = [...this.slideshowImages];
        }
        this.preloadedImages.clear();
    }

    async loadSlideshowPage(page, cursor, currentIndex = 0) {
        if (this.slideshowCatalogLoading) {
            return false;
        }

        this.slideshowCatalogLoading = true;
        try {
            const data = await this.requestSlideshowPage(cursor);
            this.applySlideshowPage(data, page, currentIndex);
            this.updateSlideDisplay();
            this.updateDynamicCounter();
            return this.slideshowImages.length > 0;
        } finally {
            this.slideshowCatalogLoading = false;
        }
    }

    async loadNextSlideshowPage() {
        if (!this.slideshowCatalogHasMore || !this.slideshowCatalogNextCursor) {
            return false;
        }

        return this.loadSlideshowPage(
            this.slideshowCatalogPage + 1,
            this.slideshowCatalogNextCursor,
            0
        );
    }

    async handleSlideshowImageRemoved() {
        const removedImage = this.slideshowImages[this.currentSlideIndex];
        if (removedImage?.path) {
            this.slideshowRemovedImagePaths.add(removedImage.path);
        }
        this.slideshowImages.splice(this.currentSlideIndex, 1);
        this.slideshowCatalogLoadedCount = Math.max(0, this.slideshowCatalogLoadedCount - 1);
        if (this.slideshowCatalogTotalCount !== null) {
            this.slideshowCatalogTotalCount = Math.max(0, this.slideshowCatalogTotalCount - 1);
        }

        if (this.currentSlideIndex >= this.slideshowImages.length) {
            this.currentSlideIndex = Math.max(0, this.slideshowImages.length - 1);
        }

        if (this.slideshowImages.length === 0 && await this.loadNextSlideshowPage()) {
            return true;
        }

        if (this.slideshowCatalogPage === 0) {
            this.slideshowCatalogFirstPage = [...this.slideshowImages];
        }

        if (this.slideshowImages.length > 0) {
            this.updateSlideDisplay();
            this.updateDynamicCounter();
            return true;
        }

        return false;
    }

    // Pré-carregar imagem
    preloadImage(imagePath) {
        return new Promise((resolve, reject) => {
            if (this.preloadedImages.has(imagePath)) {
                resolve(this.preloadedImages.get(imagePath));
                return;
            }

            const img = new Image();
            img.onload = () => {
                this.preloadedImages.set(imagePath, img);
                resolve(img);
            };
            img.onerror = () => {
                console.warn('⚠️ Erro ao pré-carregar imagem:', imagePath);
                reject(new Error('Erro ao carregar imagem'));
            };
            img.src = imagePath;
        });
    }

    // Pré-carregar próxima imagem se habilitado
    async preloadNextImage() {
        if (!this.slideshowConfig.preload || this.slideshowImages.length <= 1) {
            return;
        }

        // Limitar pré-carregamento para apenas 1 imagem (próxima)
        if (this.preloadedImages.size >= 1) {
            return; // Máximo 1 imagem pré-carregada
        }

        const nextIndex = (this.currentSlideIndex + 1) % this.slideshowImages.length;
        const nextImagePath = this.slideshowImages[nextIndex];

        // Construir URL corretamente
        const imageUrl = `/api/files/image/${encodeURIComponent(nextImagePath.path)}`;

        try {
            await this.preloadImage(imageUrl);
        } catch (error) {
            console.warn('Erro ao pré-carregar próxima imagem:', error);
        }
    }

    // Iniciar viewer do slideshow
    startSlideshowViewer() {
        // Limpar elementos antigos se existirem
        const oldElement = document.getElementById('slideshow-image-new');
        if (oldElement) {
            oldElement.remove();
        }

        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            console.error('❌ Nenhuma imagem disponível para slideshow');
            this.showToast('Nenhuma imagem encontrada para o slideshow', 'error');
            return;
        }

        // Mostrar viewer
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) {
            viewer.style.display = 'flex';
            if (!this.slideshowReturnFocus || this.slideshowReturnFocus === document.body) {
                this.slideshowReturnFocus = document.querySelector('.action-slideshow-card');
            }
            viewer.focus({ preventScroll: true });
            // Mostrar controles estáticos quando o viewer for exibido
            const staticControls = document.getElementById('static-slideshow-controls');
            if (staticControls) {
                staticControls.style.removeProperty('display');
                // Configurar event listeners se ainda não foram configurados
                this.setupStaticButtons();
            }

        } else {
            console.error('❌ Elemento slideshow-viewer não encontrado no DOM');
            this.showToast('Erro: Elemento de visualização não encontrado', 'error');
            return;
        }

        this.currentSlideIndex = 0;
        this.slideshowPlaying = true;
        if (this.screensaverState.timerId) {
            clearTimeout(this.screensaverState.timerId);
            this.screensaverState.timerId = null;
        }
        this.updateSlideshowControls();

        // Entrar em fullscreen automaticamente
        this.enterFullscreen(this.isDedicatedScreensaverWindow || this.screensaverState.isActive);

        // Atualizar exibição e iniciar auto-play APÓS a imagem ser carregada
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

        const target = viewer;
        const requestFn = target.requestFullscreen
            || target.webkitRequestFullscreen
            || target.mozRequestFullScreen
            || target.msRequestFullscreen;
        if (requestFn && document.fullscreenElement !== target) {
            this.performSlideshowFullscreenTransition(() => requestFn.call(target), true);
        }
    }

    async performSlideshowFullscreenTransition(action, closeWhenHidden = false) {
        if (this.slideshowFullscreenPending) return;
        this.slideshowFullscreenPending = true;
        this.updateSlideshowControls();
        try {
            await action();
        } catch {
            return;
        } finally {
            this.slideshowFullscreenPending = false;
            this.updateSlideshowControls();
            const viewer = document.getElementById('slideshow-viewer');
            if (closeWhenHidden && viewer && window.getComputedStyle(viewer).display === 'none'
                && (document.fullscreenElement || document.webkitFullscreenElement) === viewer) {
                this.exitFullscreen();
            }
        }
    }

    toggleSlideshowFullscreen() {
        if (this.slideshowFullscreenPending) return;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    // Sair do fullscreen
    exitFullscreen() {
        // Remover CSS fullscreen override
        const viewer = document.getElementById('slideshow-viewer');
        if (viewer) viewer.classList.remove('fullscreen-override');
        if (!viewer || window.getComputedStyle(viewer).display === 'none') {
            document.body.classList.remove('slideshow-active-fullscreen');
        }

        const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement
            || document.mozFullScreenElement || document.msFullscreenElement;
        const exitFn = document.exitFullscreen || document.webkitExitFullscreen
            || document.mozCancelFullScreen || document.msExitFullscreen;
        if (fullscreenElement && exitFn) {
            this.performSlideshowFullscreenTransition(() => exitFn.call(document));
        }
    }

    // Lidar com mudanças de fullscreen
    handleFullscreenChange() {
        const viewer = document.getElementById('slideshow-viewer');
        const viewerVisible = viewer && window.getComputedStyle(viewer).display !== 'none';
        const slideshowActive = viewerVisible && (
            this.screensaverState?.isActive || (Array.isArray(this.slideshowImages) && this.slideshowImages.length > 0)
        );
        if (!slideshowActive) {
            return;
        }

        // Garantir que os controles estáticos permaneçam visíveis
        const staticControls = document.getElementById('static-slideshow-controls');
        if (staticControls) {
            staticControls.style.removeProperty('display');
        }

        // Garantir que o viewer permaneça visível no contexto do slideshow/screenaver
        if (viewer) {
            viewer.style.display = 'flex';
            if (!viewer.contains(document.activeElement)) {
                viewer.focus({ preventScroll: true });
            }
        }
        this.updateSlideshowControls();
    }

    renderSlideshowSlideFast() {
        const images = this.slideshowImages || [];
        const imageElement = document.getElementById('slideshow-image');
        const counterElement = document.getElementById('slideshow-counter');
        const filenameElement = document.getElementById('slideshow-filename');
        const loadingElement = document.getElementById('slideshow-loading');
        const errorElement = document.getElementById('slideshow-error');

        if (!images.length || !imageElement) {
            if (loadingElement) loadingElement.style.display = 'none';
            if (errorElement) errorElement.style.display = images.length ? 'block' : 'none';
            if (imageElement) imageElement.style.display = 'none';
            return true;
        }

        const currentImage = images[this.currentSlideIndex];
        if (!currentImage) return true;

        this.slideshowRenderToken = (this.slideshowRenderToken || 0) + 1;
        const renderToken = this.slideshowRenderToken;
        const imageUrl = `/api/files/image/${encodeURIComponent(currentImage.path)}`;
        if (this.slideshowLoadTimeout) {
            clearTimeout(this.slideshowLoadTimeout);
            this.slideshowLoadTimeout = null;
        }

        const loadTimeout = setTimeout(() => {
            if (this.slideshowRenderToken !== renderToken) return;
            this.slideshowLoadTimeout = null;
            if (loadingElement) loadingElement.style.display = 'none';
            imageElement.style.display = 'none';
            if (errorElement) errorElement.style.display = 'block';
        }, 10000);
        this.slideshowLoadTimeout = loadTimeout;

        const currentPosition = this.slideshowCatalogPage * this.slideshowCatalogPageSize
            + this.currentSlideIndex + 1;
        const totalPosition = this.slideshowCatalogTotalCount === null
            ? `${this.slideshowCatalogLoadedCount}+`
            : this.slideshowCatalogTotalCount;
        if (counterElement) counterElement.textContent = `${currentPosition} / ${totalPosition}`;
        if (filenameElement) filenameElement.textContent = currentImage.name;
        if (filenameElement) filenameElement.title = currentImage.name;
        imageElement.alt = currentImage.name || 'Foto do slideshow';
        if (loadingElement) loadingElement.style.display = 'block';
        if (errorElement) errorElement.style.display = 'none';
        imageElement.style.display = 'none';
        imageElement.onload = () => {
            clearTimeout(loadTimeout);
            if (this.slideshowLoadTimeout === loadTimeout) {
                this.slideshowLoadTimeout = null;
            }
            if (this.slideshowRenderToken !== renderToken) return;
            imageElement.style.display = 'block';
            if (loadingElement) loadingElement.style.display = 'none';
            if (errorElement) errorElement.style.display = 'none';
            if (this.currentSlideIndex === 0 && this.slideshowPlaying) {
                this.startAutoPlay();
            }
            this.preloadNextImage();
        };
        imageElement.onerror = () => {
            clearTimeout(loadTimeout);
            if (this.slideshowLoadTimeout === loadTimeout) {
                this.slideshowLoadTimeout = null;
            }
            if (this.slideshowRenderToken !== renderToken) return;
            imageElement.style.display = 'none';
            if (loadingElement) loadingElement.style.display = 'none';
            if (errorElement) errorElement.style.display = 'block';
        };
        imageElement.src = imageUrl;
        return true;
    }

    // Atualizar exibição do slide atual
    updateSlideDisplay() {
        this.renderSlideshowSlideFast();
        this.updateSlideshowControls();
    }

    updateSlideshowControls() {
        const playPause = document.getElementById('static-play-pause-btn');
        if (playPause) {
            const label = this.slideshowPlaying ? 'Pausar slideshow (Espaço)' : 'Reproduzir slideshow (Espaço)';
            playPause.setAttribute('aria-label', label);
            playPause.title = label;
            playPause.querySelector('span').textContent = this.slideshowPlaying ? 'Ⅱ' : '▶';
        }
        const fullscreen = document.getElementById('static-fullscreen-btn');
        if (fullscreen) {
            fullscreen.disabled = Boolean(this.slideshowFullscreenPending);
            const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
            const label = active ? 'Sair da tela cheia (F11)' : 'Entrar em tela cheia (F11)';
            fullscreen.setAttribute('aria-label', label);
            fullscreen.title = label;
        }
        const previous = document.getElementById('static-prev-btn');
        if (previous) previous.disabled = this.slideshowCatalogPage === 0 && this.currentSlideIndex === 0;
        const next = document.getElementById('static-next-btn');
        if (next) next.disabled = this.slideshowImages.length < 2 && !this.slideshowCatalogHasMore && this.slideshowCatalogPage === 0;
        for (const [buttonId, configuredPath] of [
            ['static-delete-btn', this.slideshowConfig.deletedFolder],
            ['static-hide-btn', this.slideshowConfig.hiddenFolder],
            ['static-adjust-btn', this.slideshowConfig.adjustableFolder]
        ]) {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = !configuredPath;
                if (!configuredPath) button.title = 'Configure a pasta de destino nas configurações do slideshow';
            }
        }
    }

    async navigateSlideshow(direction) {
        this.stopAutoPlay();
        try {
            if (direction > 0) {
                await this.nextSlide();
            } else {
                await this.previousSlide();
            }
        } catch (error) {
            this.showToast('Não foi possível trocar a foto: ' + error.message, 'error');
        } finally {
            if (this.slideshowPlaying) this.startAutoPlay();
        }
    }

    // Próximo slide
    async nextSlide() {
        if (this.slideshowImages.length === 0 || this.slideshowCatalogLoading) return;

        if (this.currentSlideIndex < this.slideshowImages.length - 1) {
            this.currentSlideIndex += 1;
            this.updateSlideDisplay();
            this.updateDynamicCounter();
            return;
        }

        if (await this.loadNextSlideshowPage()) {
            return;
        }

        if (this.slideshowCatalogPage > 0 && this.slideshowCatalogFirstPage.length > 0) {
            this.applySlideshowPage({
                images: this.slideshowCatalogFirstPage,
                pagination: {
                    catalogId: this.slideshowCatalogId,
                    pageSize: this.slideshowCatalogPageSize,
                    loadedCount: this.slideshowCatalogLoadedCount,
                    totalCount: this.slideshowCatalogTotalCount,
                    hasMore: this.slideshowCatalogFirstPage.length < this.slideshowCatalogTotalCount,
                    cursor: null,
                    nextCursor: this.slideshowCatalogPageCursors[1] || null
                }
            }, 0, 0);
            this.updateSlideDisplay();
            this.updateDynamicCounter();
            return;
        }

        this.currentSlideIndex = 0;
        this.updateSlideDisplay();
        this.updateDynamicCounter();
    }

    // Slide anterior
    async previousSlide() {
        if (this.slideshowImages.length === 0 || this.slideshowCatalogLoading) return;

        if (this.currentSlideIndex > 0) {
            this.currentSlideIndex -= 1;
            this.updateSlideDisplay();
            this.updateDynamicCounter();
            return;
        }

        if (this.slideshowCatalogPage > 0) {
            await this.loadSlideshowPage(
                this.slideshowCatalogPage - 1,
                this.slideshowCatalogPageCursors[this.slideshowCatalogPage - 1],
                this.slideshowCatalogPageSize - 1
            );
        }
    }

    // Alternar play/pause
    togglePlayPause() {
        this.slideshowPlaying = !this.slideshowPlaying;
        if (this.slideshowPlaying) {
            this.startAutoPlay();
        } else {
            this.stopAutoPlay();
        }
        this.updateSlideshowControls();
    }

    // Iniciar reprodução automática
    startAutoPlay() {
        this.stopAutoPlay(); // Parar qualquer intervalo existente

        if (this.slideshowPlaying && (this.slideshowImages.length > 1 || this.slideshowCatalogHasMore)) {
            const intervalMs = this.slideshowConfig.interval * 1000;
            this.autoPlayInterval = setInterval(() => {
                this.nextSlide().catch((error) => {
                    console.warn('Erro ao avançar slideshow:', error);
                });
            }, intervalMs);
        }
    }

    // Parar reprodução automática
    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }

    // Criar controles de navegação para slideshow dinâmico
    createDynamicSlideshowControls() {
        // Remover controles dinâmicos antigos se existirem
        const oldControls = document.getElementById('dynamic-slideshow-controls');
        if (oldControls) {
            oldControls.remove();
        }

        // Mostrar controles estáticos
        const staticControls = document.getElementById('static-slideshow-controls');
        if (staticControls) {
            staticControls.style.removeProperty('display');
        } else {
            console.error('❌ Controles estáticos não encontrados');
        }

        // Configurar event listeners para botões estáticos
        this.setupStaticButtons();

        this.dynamicControlsCreated = true;

        // Atualizar contador
        this.updateStaticCounter();
    }

    setupStaticButtons() {
        for (const [buttonId, handler] of [
            ['static-play-pause-btn', () => this.togglePlayPause()],
            ['static-fullscreen-btn', () => this.toggleSlideshowFullscreen()]
        ]) {
            const button = document.getElementById(buttonId);
            if (button && !button.hasAttribute('data-listener-added')) {
                button.addEventListener('click', handler);
                button.setAttribute('data-listener-added', 'true');
            }
        }
        // Botão anterior
        const prevBtn = document.getElementById('static-prev-btn');
        if (prevBtn && !prevBtn.hasAttribute('data-listener-added')) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.navigateSlideshow(-1);
            });
            prevBtn.setAttribute('data-listener-added', 'true');
        }

        // Botão próximo
        const nextBtn = document.getElementById('static-next-btn');
        if (nextBtn && !nextBtn.hasAttribute('data-listener-added')) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.navigateSlideshow(1);
            });
            nextBtn.setAttribute('data-listener-added', 'true');
        }

        // Botão fechar
        const closeBtn = document.getElementById('static-close-btn');
        if (closeBtn && !closeBtn.hasAttribute('data-listener-added')) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeSlideshowViewer();
            });
            closeBtn.setAttribute('data-listener-added', 'true');
        }

        // Botão apagar
        const deleteBtn = document.getElementById('static-delete-btn');
        if (deleteBtn) {
        }

        if (deleteBtn && !deleteBtn.hasAttribute('data-listener-added')) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Usar window.deParaUI para garantir contexto correto
                if (window.deParaUI && typeof window.deParaUI.deleteCurrentImage === 'function') {
                    window.deParaUI.deleteCurrentImage();
                } else {
                    console.error('❌ DeParaUI não disponível ou método não encontrado');
                    console.error('❌ window.deParaUI:', window.deParaUI);
                    console.error('❌ typeof deleteCurrentImage:', typeof window.deParaUI?.deleteCurrentImage);
                }
            });
            deleteBtn.setAttribute('data-listener-added', 'true');
        }

        // Botão ocultar
        const hideBtn = document.getElementById('static-hide-btn');
        if (hideBtn) {
        }

        if (hideBtn && !hideBtn.hasAttribute('data-listener-added')) {
            hideBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Usar window.deParaUI para garantir contexto correto
                if (window.deParaUI && typeof window.deParaUI.hideCurrentImage === 'function') {
                    window.deParaUI.hideCurrentImage();
                } else {
                    console.error('❌ DeParaUI não disponível ou método não encontrado');
                    console.error('❌ window.deParaUI:', window.deParaUI);
                    console.error('❌ typeof hideCurrentImage:', typeof window.deParaUI?.hideCurrentImage);
                }
            });
            hideBtn.setAttribute('data-listener-added', 'true');
        }



        // Botão favoritar
        const favoriteBtn = document.getElementById('static-favorite-btn');
        if (favoriteBtn && !favoriteBtn.hasAttribute('data-listener-added')) {
            favoriteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.favoriteCurrentImage();
            });
            favoriteBtn.setAttribute('data-listener-added', 'true');
        }

        // Botão ajustar
        const adjustBtn = document.getElementById('static-adjust-btn');
        if (adjustBtn && !adjustBtn.hasAttribute('data-listener-added')) {
            adjustBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.adjustCurrentImage();
            });
            adjustBtn.setAttribute('data-listener-added', 'true');
        }
    }

    updateStaticCounter() {
        const counter = document.getElementById('static-counter');
        const filename = document.getElementById('static-filename');
        const currentPosition = this.slideshowCatalogPage * this.slideshowCatalogPageSize
            + this.currentSlideIndex + 1;
        const totalPosition = this.slideshowCatalogTotalCount === null
            ? `${this.slideshowCatalogLoadedCount}+`
            : this.slideshowCatalogTotalCount;

        if (counter && this.slideshowImages) {
            counter.textContent = `${currentPosition} / ${totalPosition}`;
        }

        if (filename && this.slideshowImages && this.slideshowImages[this.currentSlideIndex]) {
            const currentImage = this.slideshowImages[this.currentSlideIndex];
            filename.textContent = currentImage.name || 'Arquivo sem nome';
        }
    }

    // Atualizar contador dinâmico
    updateDynamicCounter() {
        // Usar botões estáticos se disponíveis
        this.updateStaticCounter();

        // Fallback para botões dinâmicos se existirem
        const counter = document.getElementById('dynamic-slideshow-counter');
        const filename = document.getElementById('dynamic-slideshow-filename');
        const currentPosition = this.slideshowCatalogPage * this.slideshowCatalogPageSize
            + this.currentSlideIndex + 1;
        const totalPosition = this.slideshowCatalogTotalCount === null
            ? `${this.slideshowCatalogLoadedCount}+`
            : this.slideshowCatalogTotalCount;

        if (counter && this.slideshowImages) {
            counter.textContent = `${currentPosition} / ${totalPosition}`;
        }

        if (filename && this.slideshowImages && this.slideshowImages[this.currentSlideIndex]) {
            const currentImage = this.slideshowImages[this.currentSlideIndex];
            filename.textContent = currentImage.name || 'Arquivo sem nome';
        }
    }

    getFileNameFromPath(filePath) {
        const normalizedPath = String(filePath || '');
        return normalizedPath.split(/[\\/]/).pop() || normalizedPath;
    }

    getParentPathAndSeparator(filePath) {
        const normalizedPath = String(filePath || '');
        const separatorIndex = Math.max(normalizedPath.lastIndexOf('\\'), normalizedPath.lastIndexOf('/'));
        if (separatorIndex < 0) {
            return { parentPath: '', separator: '\\' };
        }
        return {
            parentPath: normalizedPath.slice(0, separatorIndex),
            separator: normalizedPath[separatorIndex]
        };
    }

    joinFilePath(parentPath, fileName, separator = null) {
        const basePath = String(parentPath || '').replace(/[\\/]+$/, '');
        const pathSeparator = separator || (basePath.includes('\\') ? '\\' : '/');
        return `${basePath}${pathSeparator}${String(fileName || '').replace(/^[\\/]+/, '')}`;
    }

    // Apagar imagem atual (mover para pasta de excluídas)
    async deleteCurrentImage() {
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            this.showToast('Nenhuma imagem para apagar', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {
            this.showToast('Imagem atual não encontrada', 'error');
            return;
        }

        if (!this.slideshowConfig.deletedFolder) {
            this.showToast('Configure a pasta de fotos excluídas nas configurações', 'error');
            return;
        }

        try {
            // Verificar se pasta de destino existe, se não, criar
            // Pasta de destino já configurada - prosseguir diretamente
            // Debug: Log dos dados sendo enviados
            const fileName = currentImage.name || this.getFileNameFromPath(currentImage.path);
            const targetPath = this.joinFilePath(this.slideshowConfig.deletedFolder, fileName);

            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath
            };
            // Chamar API para mover arquivo
            const response = await fetch('/api/files/execute', {
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
                    console.error('❌ Detalhes do erro da API:', errorDetails);
                } catch (e) {
                    console.error('❌ Erro ao parsear resposta de erro:', e);
                    try {
                        const errorText = await response.text();
                        console.error('❌ Resposta de erro (texto):', errorText);
                    } catch (textError) {
                        console.error('❌ Erro ao ler resposta como texto:', textError);
                    }
                }
            }

            if (response.ok) {
                await response.json();
                const hasRemainingImages = await this.handleSlideshowImageRemoved();
                if (!hasRemainingImages) {
                    this.showToast('Todas as imagens foram apagadas', 'info');
                    this.closeSlideshowViewer();
                }

                this.showToast('Imagem apagada com sucesso', 'success');
            } else {
                console.error('❌ Erro ao apagar imagem - status:', response.status);
                this.showToast(`Erro ao apagar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('❌ Erro ao apagar imagem:', error);
            this.showToast('Erro ao apagar imagem', 'error');
        }
    }

    // Ocultar imagem atual (mover para pasta de ocultas)
    async hideCurrentImage() {
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            this.showToast('Nenhuma imagem para ocultar', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {
            this.showToast('Imagem atual não encontrada', 'error');
            return;
        }

        if (!this.slideshowConfig.hiddenFolder || this.slideshowConfig.hiddenFolder.trim() === '') {
            this.showToast('Configure a pasta de fotos ocultas nas configurações', 'error');
            return;
        }
        try {
            // Verificar se pasta de destino existe, se não, criar
            // Pasta de destino já configurada - prosseguir diretamente
            // Debug: Log dos dados sendo enviados
            const fileName = currentImage.name || this.getFileNameFromPath(currentImage.path);
            const targetPath = this.joinFilePath(this.slideshowConfig.hiddenFolder, fileName);

            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath
            };
            // Chamar API para mover arquivo
            const response = await fetch('/api/files/execute', {
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
                    console.error('❌ Detalhes do erro da API:', errorDetails);
                } catch (e) {
                    console.error('❌ Erro ao parsear resposta de erro:', e);
                    try {
                        const errorText = await response.text();
                        console.error('❌ Resposta de erro (texto):', errorText);
                    } catch (textError) {
                        console.error('❌ Erro ao ler resposta como texto:', textError);
                    }
                }
            }

            if (response.ok) {
                await response.json();
                const hasRemainingImages = await this.handleSlideshowImageRemoved();
                if (!hasRemainingImages) {
                    this.showToast('Todas as imagens foram ocultadas', 'info');
                    this.closeSlideshowViewer();
                }

                this.showToast('Imagem ocultada com sucesso', 'success');
            } else {
                console.error('❌ Erro ao ocultar imagem - status:', response.status);
                this.showToast(`Erro ao ocultar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('❌ Erro ao ocultar imagem:', error);
            this.showToast('Erro ao ocultar imagem', 'error');
        }
    }

    // Favoritar imagem atual (mover para subpasta dentro da pasta atual)
    async favoriteCurrentImage() {
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            this.showToast('Nenhuma imagem para favoritar', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {
            this.showToast('Imagem atual não encontrada', 'error');
            return;
        }

        try {
            // Extrair diretório pai da imagem atual
            const { parentPath: currentDir, separator } = this.getParentPathAndSeparator(currentImage.path);
            const fileName = currentImage.name || this.getFileNameFromPath(currentImage.path);
            const parentFolderName = this.getFileNameFromPath(currentDir) || 'Fotos';
            // Criar subdiretório "Favoritas + Nome da pasta pai" DENTRO da pasta atual
            const favoritesSubDir = `Favoritas ${parentFolderName}`;
            const targetDir = this.joinFilePath(currentDir, favoritesSubDir, separator);
            const targetPath = this.joinFilePath(targetDir, fileName, separator);

            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath,
                createTargetDir: true // Flag para criar diretório se não existir
            };
            // Chamar API para mover arquivo
            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            if (response.ok) {
                await response.json();
                const hasRemainingImages = await this.handleSlideshowImageRemoved();
                if (!hasRemainingImages) {
                    this.showToast('Todas as imagens foram favoritadas', 'info');
                    this.closeSlideshowViewer();
                }

                this.showToast(`Imagem favoritada! Movida para: ${favoritesSubDir}`, 'success');
            } else {
                console.error('❌ Erro ao favoritar imagem - status:', response.status);
                this.showToast(`Erro ao favoritar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('❌ Erro ao favoritar imagem:', error);
            this.showToast('Erro ao favoritar imagem', 'error');
        }
    }

    // Ajustar imagem atual (mover para pasta configurada)
    async adjustCurrentImage() {
        if (!this.slideshowImages || this.slideshowImages.length === 0) {
            this.showToast('Nenhuma imagem para ajustar', 'error');
            return;
        }

        if (!this.slideshowConfig.adjustableFolder || this.slideshowConfig.adjustableFolder.trim() === '') {
            this.showToast('Configure a pasta de fotos para ajustar nas configurações do slideshow', 'error');
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];
        if (!currentImage) {
            this.showToast('Imagem atual não encontrada', 'error');
            return;
        }

        try {
            // Extrair nome do arquivo
            const fileName = currentImage.name || this.getFileNameFromPath(currentImage.path);

            // Usar pasta configurada
            const targetPath = this.joinFilePath(this.slideshowConfig.adjustableFolder, fileName);

            const requestData = {
                action: 'move',
                sourcePath: currentImage.path,
                targetPath: targetPath,
                createTargetDir: true // Flag para criar diretório se não existir
            };
            // Chamar API para mover arquivo
            const response = await fetch('/api/files/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            if (response.ok) {
                await response.json();
                const hasRemainingImages = await this.handleSlideshowImageRemoved();
                if (!hasRemainingImages) {
                    this.showToast('Todas as imagens foram ajustadas', 'info');
                    this.closeSlideshowViewer();
                }

                this.showToast(`Imagem ajustada! Movida para: ${this.slideshowConfig.adjustableFolder}`, 'success');
            } else {
                console.error('❌ Erro ao ajustar imagem - status:', response.status);
                this.showToast(`Erro ao ajustar imagem: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('❌ Erro ao ajustar imagem:', error);
            this.showToast('Erro ao ajustar imagem', 'error');
        }
    }

    // Fechar viewer do slideshow
    closeSlideshowViewer() {
        const catalogId = this.slideshowCatalogId;
        this.stopAutoPlay();
        if (this.slideshowLoadTimeout) {
            clearTimeout(this.slideshowLoadTimeout);
            this.slideshowLoadTimeout = null;
        }
        this.slideshowRenderToken += 1;
        this.preloadedImages.clear();
        this.slideshowCatalogId = null;
        this.slideshowCatalogPage = 0;
        this.slideshowCatalogNextCursor = null;
        this.slideshowCatalogPageCursors = [];
        this.slideshowCatalogLoadedCount = 0;
        this.slideshowCatalogTotalCount = null;
        this.slideshowCatalogHasMore = false;
        this.slideshowCatalogFolderPath = '';
        this.slideshowCatalogExtensions = [];
        this.slideshowCatalogFirstPage = [];
        this.slideshowRemovedImagePaths = new Set();
        if (catalogId) {
            fetch(`/api/files/image-catalog/${encodeURIComponent(catalogId)}`, { method: 'DELETE' }).catch(() => {});
        }

        // Sair do fullscreen antes de fechar o viewer
        this.exitFullscreen();

        // Aguardar um pouco para garantir que a saída do fullscreen seja processada
        setTimeout(() => {
            // Verificar se ainda está em fullscreen e forçar saída se necessário
            const isStillFullscreen = !!(document.fullscreenElement ||
                                       document.webkitFullscreenElement ||
                                       document.mozFullScreenElement ||
                                       document.msFullscreenElement);

            if (isStillFullscreen) {
                this.exitFullscreen();
            }
        }, 100);

        // Limpeza de proteção de ícones (sem setInterval)
        // Resetar flag de controles criados
        this.dynamicControlsCreated = false;

        // Limpar elementos criados dinamicamente
        const dynamicElement = document.getElementById('slideshow-image-new');
        if (dynamicElement) {
            dynamicElement.remove();
        }

        // Limpar controles dinâmicos antigos (se existirem)
        const dynamicControls = document.getElementById('dynamic-slideshow-controls');
        if (dynamicControls) {
            dynamicControls.remove();
        }

        // Esconder controles estáticos
        const staticControls = document.getElementById('static-slideshow-controls');
        if (staticControls) {
            staticControls.style.display = 'none';
        }

        // Remover botões de organização dinâmicos
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
        }
        document.body.classList.remove('slideshow-active-fullscreen');
        const imageElement = document.getElementById('slideshow-image');
        if (imageElement) {
            imageElement.onload = null;
            imageElement.onerror = null;
            imageElement.removeAttribute('src');
        }
        const returnFocus = this.slideshowReturnFocus?.isConnected
            ? this.slideshowReturnFocus
            : document.querySelector('.action-slideshow-card');
        returnFocus?.focus({ preventScroll: true });
        this.slideshowReturnFocus = null;

        // Limpar dados do slideshow
        this.slideshowImages = [];
        this.currentSlideIndex = 0;
        this.slideshowPlaying = false;
        this.resetScreensaverTimer();
    }


    // Manipular eventos de teclado no slideshow
    handleSlideshowKeydown(event) {
        if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
        if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        const key = (event.key || '').toLowerCase();
        if (key === 'tab') {
            const viewer = document.getElementById('slideshow-viewer');
            const buttons = Array.from(viewer.querySelectorAll('button:not(:disabled)'))
                .filter(button => button.getClientRects().length > 0);
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === viewer)) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
            return;
        }
        switch (key) {
            case 'arrowleft':
                event.preventDefault();
                this.navigateSlideshow(-1);
                break;
            case 'arrowright':
                event.preventDefault();
                this.navigateSlideshow(1);
                break;
            case 'f11':
                event.preventDefault();
                this.toggleSlideshowFullscreen();
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

    // Salvar pasta (método auxiliar)
    async saveFolderToServer(folder) {
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
            return result;

        } catch (error) {
            console.error('❌ Erro ao salvar pasta:', error);
            throw error;
        }
    }

    // Salvar template (método auxiliar)
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

            const result = await response.json();
            return result;

        } catch (error) {
            console.error('❌ Erro ao salvar template:', error);
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
                this.showFieldError(field, 'Este campo é obrigatório');
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
            this.showToast('Pasta de origem e destino não podem ser iguais', 'warning');
            isValid = false;
        }

        return isValid;
    }

    validateWorkflowSchedule() {
        let isValid = true;
        const frequency = document.getElementById('execution-frequency');
        const cronExpression = document.getElementById('cron-expression');

        if (frequency.value === 'custom' && !cronExpression.value.trim()) {
            this.showFieldError(cronExpression, 'Expressão cron é obrigatória para frequência personalizada');
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
            this.showFieldError(extensions, 'Especifique as extensões permitidas');
            isValid = false;
        }

        if (filterType === 'size' && (!minSize.value || parseFloat(minSize.value) < 0)) {
            this.showFieldError(minSize, 'Tamanho mínimo deve ser um número positivo');
            isValid = false;
        }

        if (filterType === 'age' && (!minAge.value || parseFloat(minAge.value) < 0)) {
            this.showFieldError(minAge, 'Idade mínima deve ser um número positivo');
            isValid = false;
        }

        const uppercase = document.getElementById('transform-uppercase');
        const lowercase = document.getElementById('transform-lowercase');

        if (uppercase.checked && lowercase.checked) {
            this.showToast('Não é possível aplicar maiúsculas e minúsculas simultaneamente', 'warning');
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
            this.showFieldError(customTrashPath, 'Caminho da pasta de lixeira personalizada é obrigatório');
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
            this.showToast('Preencha todos os campos obrigatórios', 'warning');
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
            <h5>📋 Resumo do Fluxo de Trabalho</h5>
            <ul>
                <li><strong>Nome:</strong> ${workflowData.name}</li>
                <li><strong>Origem:</strong> ${this.getFolderName(workflowData.sourceFolder)}</li>
                <li><strong>Destino:</strong> ${this.getFolderName(workflowData.targetFolder)}</li>
                <li><strong>Ação:</strong> ${this.getActionLabel(workflowData.fileAction)}</li>
                <li><strong>Frequência:</strong> ${this.getFrequencyLabel(workflowData.executionFrequency)}</li>
                <li><strong>Filtro:</strong> ${this.getFilterLabel(workflowData.filterType)}</li>
                ${workflowData.autoCleanup ? `<li><strong>Limpeza:</strong> ${workflowData.cleanupFrequency} (${workflowData.maxFileAge} dias)</li>` : ''}
            </ul>
        `;
    }

    // Métodos auxiliares
    getFolderName(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        return folder ? folder.name : 'N/A';
    }

    getActionLabel(action) {
        const labels = {
            'copy': '📋 Copiar',
            'move': '📤 Mover',
            'copy_and_clean': '🧹 Copiar e Limpar'
        };
        return labels[action] || action;
    }

    getFrequencyLabel(frequency) {
        const labels = {
            'realtime': '⚡ Tempo Real',
            '1min': '⏱️ A cada 1 minuto',
            '5min': '⏱️ A cada 5 minutos',
            '15min': '⏱️ A cada 15 minutos',
            '30min': '⏱️ A cada 30 minutos',
            '1hour': '⏰ A cada 1 hora',
            '6hours': '⏰ A cada 6 horas',
            '12hours': '⏰ A cada 12 horas',
            'daily': '📅 Diário',
            'weekly': '📅 Semanal',
            'monthly': '📅 Mensal',
            'custom': '⚙️ Personalizado'
        };
        return labels[frequency] || frequency;
    }

    getFilterLabel(filterType) {
        const labels = {
            'all': '✅ Todos os Arquivos',
            'new': '🆕 Apenas Novos',
            'modified': '📝 Apenas Modificados',
            'extension': '🔍 Por Extensão',
            'size': '📏 Por Tamanho',
            'age': '⏰ Por Idade'
        };
        return labels[filterType] || filterType;
    }

    // População de campos
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

            // Botão de system tray
        const trayBtn = document.getElementById('tray-btn');
        if (trayBtn) {
            trayBtn.addEventListener('click', () => {
                minimizeToTray();
            });
        }

        // Sistema de atualizações
        this.setupUpdateEventListeners();

        this.setupWorkflowEventListeners();
}

    // Sistema de Atualizações
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

        // A verificação de atualização é acionada somente pelo usuário.
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
                enabled: autoCheckUpdates ? autoCheckUpdates.checked : false,
                autoApply: autoApplyUpdates ? autoApplyUpdates.checked : false,
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
                throw new Error(result.error?.message || 'Falha ao salvar configuração');
            }
        } catch (error) {
            logger.error('Erro ao salvar config de auto update:', error);
            showToast('Erro ao salvar configuração de atualização', 'error');
        }
    }

    // Verificar atualizações disponíveis
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
            logger.error('Erro ao verificar atualizações:', error);
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
            lastCheckText.textContent = `Última verificação: ${state.lastCheckAt ? new Date(state.lastCheckAt).toLocaleString('pt-BR') : '-'}`;
        }

        if (lastResultText) {
            lastResultText.textContent = `Último resultado: ${state.lastEvent || '-'}`;
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
            lastResultText.textContent = `Último resultado: ${state.lastEvent || '-'} | supervisor: ${supervisorLabel} | etapa: ${failureStage}`;
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
                updateMessage.textContent = 'Scheduler sem ciclos recentes. Verifique o processo Windows e a persistência.';
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
                throw new Error(result.error?.message || 'Falha ao carregar histórico');
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
            list.innerHTML = '<small>Erro ao carregar histórico</small>';
        }
    }

    // Aplicar atualizações
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

            showToast('Ciclo preparado. Reinicie manualmente o processo Windows após a conclusão.', 'success');
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

    // Reiniciar aplicação
    async restartApplication() {
        try {
            const restartBtn = document.getElementById('restart-app-btn');
            if (restartBtn) {
                restartBtn.disabled = true;
                restartBtn.innerHTML = '<span class="material-icons">info</span> Reinício manual';
            }

            showToast('Reinicie manualmente com Ctrl+C e npm run start:windows.', 'info');
        } catch (error) {
            logger.error('Erro ao reiniciar aplicação:', error);
            showToast(error.message || 'Erro ao reiniciar aplicação', 'error');
        } finally {
            const restartBtn = document.getElementById('restart-app-btn');
            if (restartBtn) {
                restartBtn.disabled = false;
                restartBtn.innerHTML = '<span class="material-icons">restart_alt</span> Reiniciar Aplicação';
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

    // Métodos de validação
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

    // Métodos de toggle
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

    // Métodos de carregamento de dados
    async loadWorkflows() {
        try {
            const response = await fetch('/api/files/workflows');
            if (response.ok) {
                const result = await response.json();
                this.workflows = result.data || [];
                this.renderWorkflows();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar workflows:', error);
            this.workflows = [];
            this.renderWorkflows();
        }
    }

    renderWorkflows() {
        const workflowsList = document.getElementById('workflows-list');

        if (!workflowsList) {
            console.warn('⚠️ Elemento workflows-list não encontrado');
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
                        <div class="workflow-description">${workflow.description || 'Sem descrição'}</div>
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

        // Configurar event listeners para os botões de workflow
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
        // Evitar chamadas simultâneas
        if (this.isLoadingFolders) {
            return;
        }
        this.isLoadingFolders = true;

        try {
            const response = await fetch('/api/files/folders');
            if (response.ok) {
                const result = await response.json();
                this.folders = result.data || [];
                this.renderConfiguredFolders();
                this.renderFileOpsFolderOptions();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar pastas:', error);

            // Verificar se é erro de conexão (API não disponível)
            if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
                console.warn('⚠️ API não está disponível. Mostrando mensagem para o usuário.');
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

    // Mostrar mensagem quando API não está disponível
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
                <p><strong>Servidor não está executando</strong></p>
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
    }

    renderConfiguredFolders() {
        // Verificar se já está renderizando para evitar loops
        if (this.isRenderingFolders) {
            return;
        }
        this.isRenderingFolders = true;

        const foldersList = document.getElementById('folders-list');
        if (!foldersList) {
            console.warn('⚠️ Elemento folders-list não encontrado');
            this.isRenderingFolders = false;
            return;
        }
        if (this.folders.length === 0) {
            foldersList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">folder_open</span>
                    <p>Nenhuma pasta configurada</p>
                    <small>Use &quot;Gerenciar Pastas&quot; acima ou configure manualmente</small>
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
        // Adicionar event listeners para os botões (evita CSP violation)
        this.addFolderEventListeners();

        // Liberar flag de renderização
        this.isRenderingFolders = false;
    }

    getFolderTypeLabel(type) {
        const labels = {
            'source': '📥 Origem',
            'target': '📤 Destino',
            'temp': '🗂️ Temporária',
            'trash': '🗑️ Lixeira',
            'any': '📁 Qualquer'
        };
        return labels[type] || type;
    }

    // Adicionar event listeners para botões de pasta (evita CSP violation)
    addFolderEventListeners() {
        // Botões de editar pasta
        const editButtons = document.querySelectorAll('.edit-folder-btn');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const folderId = e.currentTarget.getAttribute('data-folder-id');
                this.editFolder(folderId);
            });
        });

        // Botões de deletar pasta
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
        // Botão de ajuda/tutorial
        const helpBtn = document.querySelector('.help-tutorial-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                this.showOnboarding();
            });
        }

        // Botões do modal de onboarding
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

        // Botões de ação principal (evita CSP violation)
        this.addActionButtonListeners();

        // Botões de slideshow
        this.addSlideshowEventListeners();

        // Filtros de operação de arquivo
        this.addFileOperationEventListeners();
    }

    // Adicionar event listeners para botões de ação (evita CSP violation)
    addActionButtonListeners() {
        // Botões da dashboard principal
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

        // Botões de configuração rápida de pastas
        this.addQuickFolderListeners();

        // Botões de gerenciamento de pastas
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

    // Adicionar event listeners para botões de configuração rápida de pastas
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

    // Métodos de navegação
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
            case 'folders':
                // Não recarregar pastas se já foram carregadas na inicialização
                if (!this.folders || this.folders.length === 0) {
                    this.loadFolders();
                }
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    // Métodos existentes mantidos
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
            { icon: 'workflow', text: 'Fluxo configurado: Processamento CSV', time: '2 min atrás' },
            { icon: 'transform', text: 'Arquivo convertido: dados.csv → dados.json', time: '5 min atrás' },
            { icon: 'folder', text: 'Pasta configurada: Dados_Entrada', time: '10 min atrás' }
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

    // Métodos de conversão e mapeamento mantidos
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
                this.showToast('Conversão realizada com sucesso!', 'success');
            } else {
                const error = await response.json();
                this.showToast(`Erro na conversão: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error('Erro na conversão:', error);
            this.showToast('Erro na conversão', 'error');
        }
    }

    showConversionResult(result) {
        const resultDiv = document.getElementById('conversion-result');
        if (!resultDiv) return;

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <h3>Resultado da Conversão</h3>
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
                <label>Confiança:</label>
                <input type="text" readonly value="${result.confidence || 'N/A'}%">
            </div>
        `;
    }

    // Métodos de configurações
    async loadSettings() {
        try {
            this.settings = this.normalizeAppSettings(this.persistedConfig?.appSettings || this.settings || this.getDefaultAppSettings());
            this.populateSettingsForm();
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
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
            this.showToast('Configurações salvas com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            this.showToast('Erro ao salvar configurações', 'error');
        }
    }

    // Métodos de arquivo
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
    // Mҩtodos de monitoramento
    startMonitoring() {
        this.startUnifiedRefreshScheduler();
    }

    // Sistema de notificações
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

    // Métodos de ajuda
    updateSourceFolderInfo() {
        const sourceFolder = document.getElementById('source-folder');
        const helpText = document.getElementById('source-folder-help');

        if (sourceFolder && helpText) {
            const selectedFolder = this.folders.find(f => f.id === sourceFolder.value);
            if (selectedFolder) {
                helpText.textContent = `Pasta: ${selectedFolder.name} (${selectedFolder.path})`;
            } else {
                helpText.textContent = 'Pasta onde os arquivos estão localizados';
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
                helpText.textContent = 'Pasta para onde os arquivos serão enviados';
            }
        }
    }

    updateActionHelp() {
        const action = document.getElementById('file-action');
        const helpText = document.getElementById('action-help');

        if (action && helpText) {
            const helpTexts = {
                'copy': '📋 Os arquivos originais permanecerão na pasta de origem',
                'move': '📤 Os arquivos originais serão removidos da pasta de origem',
                'copy_and_clean': '🧹 Os arquivos serão copiados e os originais limpos/truncados'
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
                'source': '📥 Pasta onde arquivos chegam para processamento',
                'target': '📤 Pasta onde arquivos processados são salvos',
                'temp': '🗂️ Pasta temporária para arquivos em processamento',
                'trash': '🗑️ Pasta para arquivos removidos/antigos',
                'any': '📁 Pasta que pode ser usada como origem ou destino'
            };
            typeHelp.textContent = helpTexts[type] || helpTexts['source'];
        }
    }
}

// Funções globais
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

// Função para minimizar para system tray
async function minimizeToTray() {
    try {
        logger.info('📱 Minimizando aplicação para system tray...');

        const response = await fetch('/api/tray/minimize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            logger.info('✅ Aplicação minimizada para system tray');
            const activeUi = window.deParaUI || ui;
            if (activeUi && typeof activeUi.handleAppMinimizedToTray === 'function') {
                await activeUi.handleAppMinimizedToTray();
            }
            showToast('Aplicação minimizada para system tray', 'success');
        } else {
            logger.warn('⚠️ Erro ao minimizar para system tray:', result.error);
            showToast(result.error?.message || 'Erro ao minimizar para system tray', 'error');
        }
    } catch (error) {
        logger.error('❌ Erro ao minimizar para system tray:', error);
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
        showToast('Caminho de origem é obrigatório', 'error');
        return;
    }

    if ((action === 'move' || action === 'copy') && !targetPath) {
        showToast('Caminho de destino é obrigatório', 'error');
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
            showToast(`Operação ${action} executada com sucesso!${structureMsg}`, 'success', true);
            closeFileOperationModal();
            // Refresh relevant sections
            forceReloadScheduledOperations();
            loadBackups();
        } else {
            showToast(result.error?.message || 'Erro na operação', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao executar operação:', error);
        showToast('Erro ao executar operação', 'error');
    }
}


function updateScheduleForm() {
    const action = document.getElementById('schedule-action').value;
    const targetGroup = document.getElementById('schedule-target-group');

    if (action === 'delete') {
        targetGroup.style.display = 'none';
    } else {
        targetGroup.style.display = 'block';
    }

    // Atualizar resumo da operação
    updateOperationSummary();
}

function updateOperationSummary() {
    const action = document.getElementById('schedule-action').value;
    const source = document.getElementById('schedule-source').value;
    const target = document.getElementById('schedule-target').value;
    const summaryDiv = document.getElementById('operation-summary');

    // Mostrar resumo apenas se há dados suficientes
    if (action && source) {
        summaryDiv.style.display = 'block';

        // Atualizar conteúdo do resumo
        document.getElementById('summary-action').textContent = action.toUpperCase();
        document.getElementById('summary-source').textContent = source;
        document.getElementById('summary-target').textContent = target || (action === 'delete' ? 'N/A' : 'Não definido');
    } else {
        summaryDiv.style.display = 'none';
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

// Controle de operações simples
let isExecutingOperation = false;

// Função helper para controle de carregamento com debouncing
function shouldLoadData(type) {
    const now = Date.now();
    const control = loadingControl[type];

    if (!control) return false;

    // Se já está carregando, não permitir nova chamada
    if (control.isLoading) {
        return false;
    }

    // Se carregou recentemente (debounce), não permitir
    if (now - control.lastLoad < control.debounceMs) {
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

// Função helper para carregamento seguro com verificação
function safeLoadData(type, loadFunction) {
    if (shouldLoadData(type)) {
        loadFunction();
    } else {
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
        const response = await fetch('/api/files/templates');
        const result = await response.json();
        if (result.success && result.data) {
            // Usar categories diretamente se existir, senão usar array vazio
            const categories = result.data.categories || [];
            renderTemplates(categories);
        } else {
            console.warn('⚠️ Resposta da API não contém dados válidos');
            renderTemplates([]);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar templates:', error);
        renderTemplates([]);
    } finally {
        // Sempre liberar o flag de carregamento
        markLoading('templates', false);
    }
}

function renderTemplates(categories) {
    const container = document.getElementById('template-categories');

    if (!container) {
        console.warn('⚠️ Container de templates não encontrado');
        return;
    }
    // Verificar se categories é um array
    if (!Array.isArray(categories)) {
        console.warn('⚠️ Categories não é um array:', categories);
        categories = [];
    }

    container.innerHTML = '';

    categories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'template-category';

        // Verificar se templates existe e é um array
        const templates = category.templates || [];
        const templatesHtml = Array.isArray(templates) ? templates.map(template => `
                    <div class="template-card" onclick="applyTemplate('${template.category}', '${template.templateName}')">
                        <h5>${template.name}</h5>
                        <p>${template.description}</p>
                        <div class="template-actions">
                            <button class="btn btn-sm btn-primary">Aplicar</button>
                        </div>
                    </div>
                `).join('') : '<p class="no-templates">Nenhum template disponível</p>';

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
            // Se a resposta não for OK, não logar erro (pode ser normal)
            return;
        }

        const result = await response.json();

        if (result.success) {
            renderProgress(result.data);
        }
    } catch (error) {
        // Só logar erro se não for erro de conexão (que é normal quando não há operações ativas)
        if (!error.message.includes('Failed to fetch') && !error.message.includes('ERR_CONNECTION_REFUSED')) {
            console.error('Erro ao carregar progresso:', error);
        }
    }
}

const operationPollingTimers = new Map();

function escapeMarkup(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function stopOperationProgressPolling(timer) {
    if (!timer) return;
    clearInterval(timer);
    for (const [operationId, activeTimer] of operationPollingTimers.entries()) {
        if (activeTimer === timer) {
            operationPollingTimers.delete(operationId);
            break;
        }
    }
}

function startOperationProgressPolling(operationId) {
    const poll = async () => {
        try {
            const response = await fetch(`/api/files/operations/${encodeURIComponent(operationId)}`);
            if (response.status === 404 || !response.ok) return;
            const result = await response.json();
            if (!result.success || !result.data) return;

            renderProgress([result.data]);
            if (['completed', 'partial', 'conflict', 'cancelled', 'interrupted'].includes(result.data.status)) {
                stopOperationProgressPolling(operationPollingTimers.get(operationId));
            }
        } catch {
            return;
        }
    };

    const timer = setInterval(poll, 1000);
    operationPollingTimers.set(operationId, timer);
    poll();
    return timer;
}

async function cancelFileOperation(operationId) {
    if (!operationId) return;
    try {
        const response = await fetch(`/api/files/operations/${encodeURIComponent(operationId)}/cancel`, {
            method: 'POST'
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error?.message || 'Não foi possível cancelar a operação');
        }
        showToast('Cancelamento solicitado. O item atual será concluído com segurança.', 'info');
    } catch (error) {
        showToast(error.message || 'Não foi possível cancelar a operação', 'error');
    }
}

function renderProgress(operations = []) {
    const container = document.getElementById('progress-list');
    if (!container) return;

    operations = Array.isArray(operations) ? operations : [operations];

    if (operations.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma operação em andamento</p>';
        return;
    }

    container.innerHTML = operations.map(op => {
        const percentage = Math.max(0, Math.min(100, Number(op.percentage) || 0));
        const isError = ['partial', 'conflict'].includes(op.status) || op.percentage < 0;
        const isCompleted = ['completed', 'cancelled', 'interrupted'].includes(op.status) || percentage === 100;
        const progressClass = isError ? 'progress-error' :
                             isCompleted ? 'progress-completed' : '';
        const canCancel = !isCompleted && !isError && op.status !== 'cancelling';

        return `
            <div class="progress-item ${progressClass}">
                <div class="progress-header">
                    <span class="progress-title">${escapeMarkup(op.operationId)}</span>
                    <span class="progress-percentage">
                        ${isError ? 'Pendências' : isCompleted ? (op.status === 'cancelled' ? 'Cancelada' : 'Concluída') : `${percentage}%`}
                    </span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${percentage}%"></div>
                </div>
                <div class="progress-message">${escapeMarkup(op.message)}</div>
                ${canCancel ? `<button type="button" class="btn btn-sm btn-warning cancel-file-operation-btn" data-operation-id="${escapeMarkup(op.operationId)}">Cancelar com segurança</button>` : ''}
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
        console.error('Erro ao carregar operações agendadas:', error);
    } finally {
        // Sempre liberar o flag de carregamento
        markLoading('scheduledOperations', false);
    }
}

function renderScheduledOperations(operations) {
    const container = document.getElementById('scheduled-operations-list');

    if (operations.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma operação agendada</p>';
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
                <button class="btn btn-sm btn-primary edit-scheduled-operation-btn" data-operation-id="${op.id}" title="Editar operação">
                    <span class="material-icons">edit</span>
                </button>
                <button class="btn btn-sm btn-info duplicate-scheduled-operation-btn" data-operation-id="${op.id}" title="Duplicar operação">
                    <span class="material-icons">content_copy</span>
                </button>
                <button class="btn btn-sm btn-success execute-scheduled-operation-btn" data-operation-id="${op.id}" title="Executar agora">
                    <span class="material-icons">play_arrow</span>
                </button>
                <button class="btn btn-sm btn-warning toggle-scheduled-operation-btn" data-operation-id="${op.id}" data-active="${op.active}" title="${op.active ? 'Pausar' : 'Retomar'} operação">
                    <span class="material-icons">${op.active ? 'pause' : 'play_arrow'}</span>
                </button>
                <button class="btn btn-sm btn-danger cancel-scheduled-operation-btn" data-operation-id="${op.id}" title="Cancelar operação">
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
            showToast('Operação cancelada com sucesso!', 'success', true);
            forceReloadScheduledOperations();
        } else {
            showToast(result.error?.message || 'Erro ao cancelar operação', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao cancelar operação:', error);
        showToast('Erro ao cancelar operação', 'error');
    }
}

// Executar operação agendada imediatamente
async function executeScheduledOperation(operationId) {
    if (!operationId) {
        console.error('❌ ID da operação não fornecido');
        return;
    }

    try {
        const response = await fetch(`/api/files/schedule/${operationId}/execute`, {
            method: 'POST'
        });

        if (response.ok) {
            const result = await response.json();

            if (result.success) {
                showToast(`Operação executada com sucesso! ${result.message || ''}`, 'success', true);

                // Recarregar operações agendadas para mostrar status atualizado
                if (typeof loadScheduledOperations === 'function') {
                    forceReloadScheduledOperations();
                }
            } else {
                throw new Error(result.error || 'Erro ao executar operação');
            }
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Erro ao executar operação:', error);
        showToast('Erro ao executar operação: ' + error.message, 'error', true);
    }
}

// Pausar/Retomar operação agendada
async function toggleScheduledOperation(operationId) {
    if (!operationId) {
        console.error('❌ ID da operação não fornecido');
        return;
    }

    try {
        // Primeiro, obter o status atual da operação
        const response = await fetch(`/api/files/schedule/${operationId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Erro ao obter operação');
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
                showToast(`Operação ${newStatus ? 'retomada' : 'pausada'} com sucesso!`, 'success', true);
                // Recarregar operações agendadas
                forceReloadScheduledOperations();
            } else {
                throw new Error(updateResult.error || 'Erro ao atualizar operação');
            }
        } else {
            throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}`);
        }
    } catch (error) {
        console.error('❌ Erro ao alterar status da operação:', error);
        showToast('Erro ao alterar status da operação: ' + error.message, 'error', true);
    }
}

// Editar operação agendada
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

async function loadRecoveryEntries() {
    const container = document.getElementById('recovery-list');
    if (!container) return;

    try {
        const response = await fetch('/api/files/recovery');
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error?.message || 'Falha ao carregar a recuperação');
        }
        renderRecoveryEntries(result.data || []);
    } catch (error) {
        container.innerHTML = `<div class="empty-state">${escapeMarkup(error.message || 'Falha ao carregar a recuperação')}</div>`;
    }
}

function renderRecoveryEntries(entries = []) {
    const container = document.getElementById('recovery-list');
    if (!container) return;

    if (!entries.length) {
        container.innerHTML = '<div class="empty-state">Nenhum item aguardando recuperação.</div>';
        return;
    }

    container.innerHTML = entries.map((entry) => `
        <div class="recovery-item">
            <div>
                <strong>${escapeMarkup(entry.relativePath || entry.originalPath)}</strong>
                <small>Origem: ${escapeMarkup(entry.originalPath)} · ${Number(entry.size || 0).toLocaleString('pt-BR')} bytes</small>
            </div>
            <button class="btn btn-sm btn-secondary restore-recovery-btn" type="button" data-entry-id="${escapeMarkup(entry.entryId)}">Restaurar</button>
        </div>
    `).join('');
}

async function restoreRecoveryEntry(entryId) {
    if (!entryId || !window.confirm('Restaurar este item no caminho original?')) return;

    try {
        const response = await fetch(`/api/files/recovery/${encodeURIComponent(entryId)}/restore`, { method: 'POST' });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error?.message || 'Não foi possível restaurar o item');
        }
        showToast('Item restaurado com sucesso.', 'success');
        await loadRecoveryEntries();
    } catch (error) {
        showToast(error.message || 'Não foi possível restaurar o item', 'error');
    }
}

// Initialize File Operations Tab
function initFileOperationsTab() {
    return undefined;
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

}

// System Notifications
let notificationsEnabled = false;

async function initNotifications() {
    notificationsEnabled = 'Notification' in window && Notification.permission === 'granted';

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
        console.error('Erro ao mostrar notificação:', error);
    }
}

// Enhanced Toast notifications helper
function showToast(message, type = 'info', allowSystemNotification = false) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Show system notification for important messages
    if (allowSystemNotification && (type === 'success' || type === 'error')) {
        const title = type === 'success' ? 'Operação Concluída' : 'Erro na Operação';
        if (typeof window.showSystemNotification === 'function') {
            window.showSystemNotification(title, message);
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
            showToast('Configurações de backup atualizadas!', 'success', true);
            loadBackups();
        } else {
            showToast(result.error?.message || 'Erro ao atualizar configurações', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao atualizar configurações de backup:', error);
        showToast('Erro ao atualizar configurações de backup', 'error');
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
        console.error('Erro ao carregar configurações de backup:', error);
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
    // Só remove a classe se o mouse saiu realmente da zona
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

    // Esconde conteúdo original
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
                        <p>${formatFileSize(file.size)} • ${getFileType(file.type, file.name)}</p>
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
                Limpar Seleção
            </button>
        </div>
    `;
}

function selectOperationForFile(fileIndex, operation) {
    const file = draggedFiles[fileIndex];
    currentOperation = { file, operation };

    if (operation === 'delete') {
        // Para delete, não precisa de destino
        showDeleteConfirmation(file);
    } else {
        // Para move/copy, precisa escolher destino
        showDestinationModal(file, operation);
    }
}

function showDeleteConfirmation(file) {
    if (confirm(`Tem certeza que deseja apagar "${file.name}"?\n\nEsta ação criará um backup automático.`)) {
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
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
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
                    <small class="form-help">Digite o caminho completo onde o arquivo será ${operation === 'move' ? 'movido' : 'copiado'}</small>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="preserve-structure-modal" checked>
                        Preservar estrutura de pastas
                    </label>
                    <small class="form-help">Mantém a organização de subpastas no destino</small>
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
            sourcePath: file.path || file.name, // Para arquivos do drag & drop, pode não ter path
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
            showToast(`Operação ${operation} executada com sucesso!`, 'success');

            // Fecha modal se existir
            const modal = document.querySelector('.modal');
            if (modal) modal.remove();

            // Limpa preview
            clearFilePreview();
        } else {
            showToast(result.error?.message || 'Erro na operação', 'error');
        }

    } catch (error) {
        console.error('Erro ao executar operação:', error);
        showToast('Erro ao executar operação', 'error');
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

    // Por extensão
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
            showToast('Erro ao carregar padrões ignorados', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar padrões ignorados:', error);
        showToast('Erro ao carregar padrões ignorados', 'error');
    }
}

function showIgnoredPatternsModal(data) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content large-modal">
            <div class="modal-header">
                <h3>🛡️ Arquivos Automaticamente Ignorados</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="ignored-description">
                    <p><strong>Por que ignorar arquivos?</strong></p>
                    <p>Certos arquivos são críticos para o funcionamento do sistema e sincronização.
                    Eles são automaticamente ignorados para evitar:</p>
                    <ul>
                        <li>❌ Interrupção da sincronização do Resilio Sync</li>
                        <li>❌ Problemas de compatibilidade entre sistemas</li>
                        <li>❌ Processamento desnecessário de arquivos temporários</li>
                        <li>❌ Conflitos com ferramentas de desenvolvimento</li>
                    </ul>
                </div>

                <div class="ignored-categories">
                    ${Object.entries(data.categories).map(([key, description]) => `
                        <div class="ignored-category">
                            <h4>${key === 'resilioSync' ? '🔄' : key === 'systemFiles' ? '💻' : '⏰'} ${description.split(' - ')[0]}</h4>
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
                    <h4>🔍 Testar Arquivo</h4>
                    <p>Verifique se um arquivo específico seria ignorado:</p>
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
                    <strong>${isIgnored ? '🚫 IGNORADO' : '✅ PROCESSADO'}</strong><br>
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
    if (window.__deparaDomReadyDone) return;
    window.__deparaDomReadyDone = true;
    // Initialize notifications first
    await initNotifications();

    // Initialize tabs
    initFileOperationsTab();
    initScheduledOperationsTab();

    // Load backup config when backups tab is activated
    const backupsTab = document.getElementById('backups');
    if (backupsTab) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (backupsTab.classList.contains('active')) {
                        loadBackupConfig();
                        loadBackups();
                        loadRecoveryEntries();
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
// Compatibilidade dos controles globais do slideshow
// ==========================================
// Agora usando implementação da classe DeParaUI


function closeSlideshowConfigModal() {
    const modal = document.getElementById('slideshow-config-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

function resetSlideshowFolderForm() {
    // Não limpar o campo de pasta se houver uma pasta salva
    const savedPath = window.deParaUI?.getSlideshowSelectedPath?.() || '';
    if (!savedPath) {
        document.getElementById('slideshow-folder-path').value = '';
    }

    document.getElementById('slideshow-max-depth').value = '3';

    // Resetar checkboxes de extensões
    const extensionCheckboxes = document.querySelectorAll('.extension-selector input[type="checkbox"]');
    extensionCheckboxes.forEach(checkbox => {
        const isDefaultChecked = ['jpg', 'jpeg', 'png', 'gif'].includes(checkbox.value);
        checkbox.checked = isDefaultChecked;
    });
}

async function startSlideshow() {
    // Usar a implementação da classe DeParaUI
    if (window.deParaUI) {
        return window.deParaUI.startSlideshowFromModal();
    } else {
        console.error('DeParaUI não está disponível');
        showToast('Erro: Interface não inicializada', 'error');
    }
}








// ==========================================
// END SLIDESHOW FUNCTIONALITY
// ==========================================

// Inicialização
let ui;
document.addEventListener('DOMContentLoaded', () => {
    if (window.__deparaMainInitDone) return;
    window.__deparaMainInitDone = true;
    ui = new DeParaUI();

    // Após inicializar, definir funções globais
    setTimeout(() => {
        // Tornar UI disponível globalmente primeiro
        window.deParaUI = ui;

        // Função global para limpar busca
        window.clearSearchGlobal = function() {
            if (window.deParaUI) {
                window.deParaUI.clearSearch();
            }
        };

        // Funções globais para onboarding
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

        // Funções de configuração rápida de pastas
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

            // Funções auxiliares globais
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

        // Funções para botões de dashboard
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
                document.body.classList.remove('modal-open');
            }
        };

        // Função startSlideshow removida - usando implementação da classe DeParaUI
        // window.startSlideshow agora é apenas um alias para window.deParaUI.startSlideshowFromModal()

        // Funções de slideshow (estas são métodos da classe DeParaUI)
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

        // Adicionar event listeners para botões (evita CSP violation)
        ui.addOnboardingEventListeners();
        ui.setupAdditionalEventListeners();
    }, 100);
});

// Função para substituir caminhos dinâmicos baseados na plataforma
function updateDynamicPaths() {
    const defaultPicturesPath = 'C:\\Users\\User\\Pictures';
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

// Executar quando o DOM estiver carregado (já feito em updateSimplePaths)

// ===========================================
// FUNÇÕES DE OPERAÇÕES SIMPLES DE ARQUIVOS
// ===========================================

// Executar operação simples
async function executeSimpleOperation(action) {
    if (isExecutingOperation) {
        showToast('Operação já em andamento. Aguarde...', 'warning');
        return;
    }

    const sourcePath = document.getElementById('source-path').value.trim();
    const destPath = document.getElementById('dest-path').value.trim();
    const recursive = document.getElementById('recursive-option').checked;
    const backup = document.getElementById('backup-option').checked;

    // Validação básica
    if (!sourcePath) {
        showToast('Digite o caminho de origem', 'error');
        return;
    }

    if ((action === 'move' || action === 'copy') && !destPath) {
        showToast('Digite o caminho de destino', 'error');
        return;
    }

    // Mostrar resultado da operação
    const resultDiv = document.getElementById('operation-result');
    const resultIcon = document.getElementById('result-icon');
    const resultText = document.getElementById('result-text');

    resultDiv.style.display = 'block';
    resultIcon.textContent = 'hourglass_empty';
    resultText.textContent = 'Executando operação...';

    // Desabilitar botões durante execução
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
            resultText.textContent = `✅ Operação ${action} executada com sucesso!`;
            showToast(`Operação ${action} concluída!`, 'success');

            // Atualizar atividades recentes
            if (typeof loadRecentActivities === 'function') {
                loadRecentActivities();
            }
        } else {
            resultIcon.textContent = 'error';
            resultText.textContent = `❌ Erro: ${result.error?.message || 'Erro desconhecido'}`;
            showToast(result.error?.message || 'Erro na operação', 'error');
        }

    } catch (error) {
        console.error('Erro na operação:', error);
        resultIcon.textContent = 'error';
        resultText.textContent = `❌ Erro de conexão: ${error.message}`;
        showToast('Erro de conexão com o servidor', 'error');
    } finally {
        // Reabilitar botões
        setOperationButtonsDisabled(false);
        isExecutingOperation = false;
    }
}

// Desabilitar/Habilitar botões de operação
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
        console.warn('Função showFolderBrowser não encontrada');
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
        console.warn('Função showFolderBrowser não encontrada');
        // Fallback: apenas focar no input
        const input = document.getElementById('dest-path');
        if (input) {
            input.focus();
            input.select();
        }
    }
}

// Adicionar animação CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }

    /* Estilos para operações simples */
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
