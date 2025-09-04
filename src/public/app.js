// DePara Web Interface - JavaScript
// @author yopastorelli
// @version 2.0.0

/**
 * Sistema de Logging Estruturado para Frontend
 */
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

        // Adicionar ao histórico
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Log no console com emoji e cores
        const emoji = this.getLevelEmoji(level);
        const color = this.getLevelColor(level);
        const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';

        console.log(`${color}${emoji} [${level.toUpperCase()}] ${message}${metaStr}${this.resetColor()}`);

        // Enviar logs críticos para o servidor
        if (level === 'error' || level === 'warn') {
            this.sendLogToServer(logEntry);
        }

        return logEntry;
    }

    getLevelEmoji(level) {
        const emojis = {
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️',
            debug: '🔍',
            success: '✅'
        };
        return emojis[level] || '📝';
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
        this.workflows = [];
        this.folders = [];
        this.settings = {};
        this.currentWorkflowStep = 1;
        this.isExecutingOperation = false;
        this.init();
    }

    async init() {
        logger.info('🚀 Inicializando DePara UI...', {
            version: '2.0.0',
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });

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

            // Carregar workflows
            await this.loadWorkflows();
            logger.success('Workflows carregados');

            // Iniciar monitoramento
            this.startMonitoring();
            logger.success('Monitoramento iniciado');

            // Testar conexão com API
            const apiOnline = await this.testApiConnection();
            if (apiOnline) {
                this.showToast('DePara iniciado com sucesso!', 'success');
                logger.success('API conectada', { apiStatus: 'online' });
            } else {
                this.showToast('API não está respondendo. Verifique se o servidor está rodando.', 'warning');
                logger.warn('API offline', { apiStatus: 'offline' });
            }

            // Iniciar monitoramento do status da API
            this.updateApiStatus();
            setInterval(() => this.updateApiStatus(), 30000);
            logger.success('Status da API sendo monitorado');

            // Iniciar auto-refresh da dashboard
            this.startDashboardAutoRefresh();
            logger.success('Auto-refresh da dashboard iniciado');

            // Inicializar gráficos
            this.initializeCharts();
            logger.success('Gráficos inicializados');

            // Configurar atalhos de teclado
            this.setupKeyboardShortcuts();
            logger.success('Atalhos de teclado configurados');

            // Forçar atualização inicial da dashboard
            await this.updateDashboard();
            logger.success('Dashboard atualizada');

            // Mostrar onboarding se necessário
            if (!localStorage.getItem('depara-onboarding-completed')) {
                setTimeout(() => this.showOnboarding(), 1000);
            }

            // Configurar event listeners para substituir violações de CSP
            this.setupCSPSafeEventListeners();

            // Configurar validação de operações
            this.setupOperationValidation();

            // Garantir que o campo de origem esteja sempre visível
            this.ensureSourceFieldVisible();
            
            // Carregar pasta salva do slideshow
            this.loadSlideshowSavedPath();

            const initDuration = Date.now() - startTime;
            logger.success('🎉 Inicialização completa!', {
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
            logger.error('❌ Erro durante inicialização', {
                error: error.message,
                stack: error.stack,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            });
            this.showToast('Erro na inicialização. Verifique o console.', 'error');
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
            console.log('🔍 Verificando status da API...');
            const isOnline = await this.testApiConnection();

            if (isOnline) {
                console.log('✅ API está online');
                apiStatusElement.textContent = 'Online';
                apiStatusElement.className = 'value online';
                apiStatusIconElement.textContent = 'api';
                apiStatusIconElement.className = 'material-icons online';
            } else {
                console.log('❌ API está offline');
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

    // Auto-refresh da dashboard
    startDashboardAutoRefresh() {
        this.autoRefreshInterval = setInterval(async () => {
            if (this.currentTab === 'dashboard') {
                await this.refreshDashboardData();
            }
        }, 30000); // Atualizar a cada 30 segundos

        // Também atualizar quando voltar para a aba dashboard
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tab = btn.dataset.tab;
                if (tab === 'dashboard') {
                    setTimeout(() => this.refreshDashboardData(), 100);
                }
            });
        });
    }

    // Atualizar dados da dashboard
    async refreshDashboardData() {
        try {
            // Atualizar status do sistema
            await this.updateSystemStatus();

            // Atualizar atividades recentes se estiver visível
            await this.loadRecentActivities();

            // Atualizar contadores
            await this.updateCounters();

            console.log('Dashboard atualizada automaticamente');
        } catch (error) {
            console.warn('Erro ao atualizar dashboard:', error);
        }
    }

    // Atualizar status do sistema
    async updateSystemStatus() {
        try {
            const response = await fetch('/api/health');
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
            if (diskElement && data.disk) {
                const diskUsage = data.disk.percentage || 0;
                diskElement.textContent = `${diskUsage}%`;
                logger.debug('✅ Disco atualizado', { diskUsage });
            }

            // Atualizar operações ativas
            const activeOpsElement = document.getElementById('active-ops');
            if (activeOpsElement && data.activeOperations !== undefined) {
                const activeOps = data.activeOperations || 0;
                activeOpsElement.textContent = activeOps;
                logger.debug('✅ Operações ativas atualizadas', { activeOps });
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
        const maxDepth = document.getElementById('slideshow-max-depth').value;

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

        console.log('🎬 Iniciando slideshow:', { folderPath, selectedExtensions, maxDepth });

        // Implementação do slideshow pode ser expandida aqui
        this.showToast('Slideshow não implementado ainda', 'info');
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
            console.log('✅ Campo de origem garantido como visível na inicialização');
        } else {
            console.warn('⚠️ Campo source-folder-path não encontrado');
        }
    }
    
    // Carregar pasta salva do slideshow
    loadSlideshowSavedPath() {
        const savedPath = localStorage.getItem('slideshowSelectedPath');
        if (savedPath) {
            const slideshowField = document.getElementById('slideshow-folder-path');
            if (slideshowField) {
                slideshowField.value = savedPath;
                console.log('📂 Pasta do slideshow carregada na inicialização:', savedPath);
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
    async updateCounters() {
        try {
            // Contar operações ativas
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
            // Retornar cache antigo se disponível
            if (this.cache[key]) {
                console.log(`Retornando cache antigo para ${key}`);
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
            console.log(`Cache limpo para ${key}`);
        } else {
            this.initializeCache();
            console.log('Todo cache limpo');
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
        this.updateCharts();
    }

    async updateCharts() {
        try {
            // Obter dados de operações
            const operationsResponse = await fetch('/api/files/scheduled');
            if (operationsResponse.ok) {
                const operationsData = await operationsResponse.json();
                this.chartData.operations = operationsData.data.length;
            }

            // Simular dados de memória e disco (em produção, obter da API /api/health/detailed)
            this.chartData.memory = Math.floor(Math.random() * 30) + 20; // 20-50%
            this.chartData.disk = Math.floor(Math.random() * 20) + 10;   // 10-30%

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

            // Escape: Fechar modais
            if (event.key === 'Escape') {
                this.closeAllModals();
                return;
            }
        });
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
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');
        this.openWorkflowConfig();
    }

    closeOnboarding() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');
        this.showToast('Tutorial fechado! Use o botão de ajuda se precisar de orientações.', 'info');
    }

    // Configuração rápida e automática
    async quickSetup() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');

        // Mostrar confirmação antes de criar pastas automaticamente
        const confirmed = await this.showQuickSetupConfirmation();

        if (!confirmed) {
            this.showToast('Configuração cancelada. Você pode configurar manualmente.', 'info');
            return;
        }

        this.showToast('🚀 Criando pastas e templates...', 'info');

        try {
            // Criar pastas padrão automaticamente
            await this.createDefaultFolders();

            // Configurar templates básicos
            await this.createDefaultTemplates();

            this.showToast('✅ Configuração automática concluída!', 'success');

            // Mostrar modal de pastas configuradas
            this.showQuickSetupResults();

        } catch (error) {
            console.error('Erro na configuração rápida:', error);
            this.showToast('❌ Erro na configuração automática. Configure manualmente.', 'error');
        }
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
        // Detectar se estamos no Windows ou Linux
        const isWindows = navigator.userAgent.indexOf('Windows') > -1;

        if (isWindows) {
            return {
                entrada: 'C:\\Users\\User\\Documents\\Entrada',
                processados: 'C:\\Users\\User\\Documents\\Processados',
                backup: 'C:\\Users\\User\\Documents\\Backup'
            };
        } else {
            // Linux/Raspberry Pi - usar caminhos genéricos que serão resolvidos no backend
            return {
                entrada: '/home/user/Documents/Entrada',
                processados: '/home/user/Documents/Processados',
                backup: '/home/user/Documents/Backup'
            };
        }
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
                await this.saveFolder(folder);
                console.log(`Pasta criada: ${folder.name}`);
            } catch (error) {
                console.warn(`Erro ao criar pasta ${folder.name}:`, error);
            }
        }
    }

    // Criar templates básicos
    async createDefaultTemplates() {
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
        console.log(`🚀 Iniciando criação de pastas do tipo: ${type}`);

        // Obter caminhos padrão baseados na plataforma
        const paths = this.getDefaultPaths();
        const isWindows = navigator.userAgent.indexOf('Windows') > -1;
        const basePath = isWindows ? 'C:\\Users\\User' : '/home/user';

        const folderSets = {
            documents: [
                { name: 'Documentos Entrada', path: paths.entrada, type: 'source', format: 'any' },
                { name: 'Documentos Processados', path: paths.processados, type: 'target', format: 'any' }
            ],
            backup: [
                { name: 'Backup Diário', path: isWindows ? basePath + '\\Backup\\Diario' : basePath + '/Backup/Diario', type: 'target', format: 'any' },
                { name: 'Backup Semanal', path: isWindows ? basePath + '\\Backup\\Semanal' : basePath + '/Backup/Semanal', type: 'target', format: 'any' }
            ],
            media: [
                { name: 'Fotos', path: isWindows ? basePath + '\\Pictures' : basePath + '/Pictures', type: 'source', format: 'any' },
                { name: 'Vídeos', path: isWindows ? basePath + '\\Videos' : basePath + '/Videos', type: 'source', format: 'any' }
            ],
            temp: [
                { name: 'Processamento', path: isWindows ? basePath + '\\Temp\\Processamento' : basePath + '/Temp/Processamento', type: 'temp', format: 'any' },
                { name: 'Lixeira', path: isWindows ? basePath + '\\Temp\\Lixeira' : basePath + '/Temp/Lixeira', type: 'trash', format: 'any' }
            ]
        };

        const folders = folderSets[type];
        if (!folders) {
            console.error(`❌ Tipo de pasta inválido: ${type}`);
            this.showToast('❌ Tipo de pasta inválido', 'error');
            return;
        }

        this.showToast(`🚀 Criando pastas de ${type}...`, 'info');

        try {
            // Criar pastas uma por vez para melhor controle
            for (const folder of folders) {
                console.log(`📁 Criando pasta: ${folder.name} em ${folder.path}`);
                try {
                    await this.createFolderOnServer(folder);
                    console.log(`✅ Pasta criada: ${folder.name}`);
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
        console.log(`🌐 Enviando requisição para criar pasta:`, folder);

        const response = await fetch('/api/folders', {
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
        console.log(`📝 Criando templates relacionados ao tipo: ${type}`);

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
                    name: 'Limpar Temporários',
                    description: 'Remove arquivos temporários semanalmente',
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
                console.log(`📋 Criando template: ${template.name}`);
                await this.createTemplateOnServer(template);
                console.log(`✅ Template criado: ${template.name}`);
            } catch (error) {
                console.warn(`⚠️ Erro ao criar template ${template.name}:`, error);
            }
        }
    }

    // Criar template no servidor
    async createTemplateOnServer(template) {
        console.log(`🌐 Enviando requisição para criar template:`, template);

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
        console.log('🔄 Atualizando lista de pastas...');

        try {
            // Carregar pastas do servidor
            await this.loadFolders();
            await this.loadWorkflows();

            // Atualizar interface
            this.updateFoldersDisplay();
            this.updateWorkflowsDisplay();

            this.showToast('✅ Lista de pastas atualizada!', 'success');
            console.log('✅ Lista de pastas atualizada com sucesso');

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
                    <small>Use a configuração rápida acima ou crie manualmente</small>
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
        console.log(`✏️ Editando pasta: ${folderId}`);
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) {
            // Implementar modal de edição
            this.showToast('Funcionalidade de edição em desenvolvimento', 'info');
        } else {
            this.showToast('Pasta não encontrada', 'error');
        }
    }

    // Deletar pasta
    async deleteFolder(folderId) {
        console.log(`🗑️ Deletando pasta: ${folderId}`);

        if (confirm('Tem certeza que deseja excluir esta pasta?')) {
            try {
                const response = await fetch(`/api/folders/${folderId}`, {
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
        console.log('🔄 Atualizando exibição de workflows...');
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
            // Redirecionar para a nova interface de operações de arquivos
            this.switchTab('fileops');
            this.showToast('Use a nova interface de configuração de operações abaixo', 'info');
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
        this.addButtonListener('.close-schedule-btn', () => window.closeScheduleModal());
        this.addButtonListener('.cancel-schedule-btn', () => window.closeScheduleModal());
        this.addButtonListener('.schedule-operation-btn', () => window.scheduleOperation());
        
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
        this.addButtonListener('.start-slideshow-btn', () => window.startSlideshow());
        this.addButtonListener('#slideshow-prev', () => this.previousSlide());
        this.addButtonListener('#slideshow-next', () => this.nextSlide());
        this.addButtonListener('.close-slideshow-btn', () => this.closeSlideshowViewer());

        // Botão seletor de pasta
        this.addButtonListener('.select-folder-btn', () => {
            this.selectSourceFolder();
        });

        // Botão seletor de pasta de destino
        this.addButtonListener('.select-target-btn', () => {
            this.selectTargetFolder();
        });

        // Botões de operação
        this.addButtonListener('.move-btn', () => this.selectOperation('move'));
        this.addButtonListener('.copy-btn', () => this.selectOperation('copy'));
        this.addButtonListener('.delete-btn', () => this.selectOperation('delete'));

        // Botões de sugestão de pasta
        this.addButtonListener('.suggestion-btn', (e) => this.selectSuggestedFolder(e));

        // Botões de ação
        this.addButtonListener('.execute-now-btn', () => this.executeNow());
        this.addButtonListener('.schedule-btn', () => {
            if (typeof showScheduleModal === 'function') {
                this.configureOperation();
            } else {
                this.showToast('Funcionalidade de agendamento não disponível', 'warning');
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
        extensions: [],
        recursive: true
    };

    // Selecionar pasta de origem
    selectSourceFolder() {
        this.showFolderBrowser('source');
    }

    // Selecionar pasta de destino
    selectTargetFolder() {
        this.showFolderBrowser('target');
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
                                <small>Você pode inserir o caminho manualmente ou navegar pelas pastas</small>
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

        // Configurar event listeners após criar o modal
        this.setupFolderBrowserEventListeners(modal, targetType, callback);

        // Obter diretório home do usuário automaticamente
        this.setDefaultPath(modal);

        // Não carregar pastas automaticamente - permitir entrada manual
        console.log('📁 Modal de seleção de pasta criado - entrada manual habilitada');
    }

    // Definir caminho padrão baseado no sistema operacional
    async setDefaultPath(modal) {
        try {
            // Tentar obter o diretório home via API
            const response = await fetch('/api/status/system');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.userHome) {
                    const pathInput = modal.querySelector('#browser-path');
                    if (pathInput) {
                        pathInput.value = data.data.userHome;
                        console.log('🏠 Diretório home detectado:', data.data.userHome);
                        return;
                    }
                }
            }
        } catch (error) {
            console.log('⚠️ Não foi possível detectar diretório home via API, usando padrão');
        }

        // Fallback: usar caminho padrão baseado no sistema
        const pathInput = modal.querySelector('#browser-path');
        if (pathInput) {
            const isWindows = navigator.userAgent.indexOf('Windows') > -1;
            const defaultPath = isWindows ? 'C:\\Users\\User' : '/home/yo';
            pathInput.value = defaultPath;
            console.log('🏠 Usando caminho padrão:', defaultPath);
        }
    }

    // Carregar pastas de um diretório (para o modal de navegação)
    async loadFoldersForBrowser(path) {
        console.log('🔍 Iniciando carregamento de pastas para navegação:', path);

        try {
            const response = await fetch('/api/files/list-folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });

            console.log('📡 Resposta da API:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('📋 Resultado da API:', result);

            if (result.success) {
                console.log('✅ Pastas carregadas:', result.data.folders.length);
                this.renderFolders(result.data.folders, path);
            } else {
                console.error('❌ Erro na resposta da API:', result.error);
                this.showToast('Erro ao carregar pastas: ' + (result.error?.message || 'Erro desconhecido'), 'error');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar pastas:', error);
            this.showToast('Erro ao carregar pastas: ' + error.message, 'error');
        }
    }

    // Configurar event listeners para o navegador de pastas
    setupFolderBrowserEventListeners(modal, targetType, callback = null) {
        // Botão fechar
        const closeBtn = modal.querySelector('.folder-browser-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }

        // Botão voltar
        const upBtn = modal.querySelector('.folder-browser-up-btn');
        if (upBtn) {
            upBtn.addEventListener('click', () => this.goUp());
        }

        // Botão atualizar/refresh
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

        // Botão cancelar
        const cancelBtn = modal.querySelector('.folder-browser-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => modal.remove());
        }

        // Botão selecionar
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
        console.log('🎨 Renderizando pastas:', folders?.length || 0, 'para o caminho:', currentPath);

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
            console.log('📭 Nenhuma pasta encontrada');
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

        console.log('📁 Renderizando pastas:', folders.map(f => f.name));

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
        console.log('🔗 Configurando event listeners para', folderItems.length, 'itens de pasta');

        folderItems.forEach(item => {
            item.addEventListener('click', () => {
                const path = item.getAttribute('data-path');
                console.log('📂 Clicado na pasta:', path);
                this.navigateTo(path);
            });
        });

        console.log('✅ Renderização completa');
    }

    // Navegar para uma pasta
    navigateTo(path) {
        this.loadFoldersForBrowser(path);
    }

    // Voltar um nível
    goUp() {
        const currentPath = document.getElementById('browser-path').value;
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
        this.loadFoldersForBrowser(parentPath);
    }

    // Selecionar filtro rápido
    selectFilter(event) {
        const button = event.target;
        const filter = button.getAttribute('data-filter');
        const filterInput = document.getElementById('schedule-filters');
        
        console.log('🔍 Botão de filtro clicado:', button);
        console.log('🔍 Filtro obtido:', filter);
        console.log('🔍 Campo de input encontrado:', !!filterInput);
        
        if (filterInput) {
            filterInput.value = filter;
            
            // Remover classe active de todos os botões
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Adicionar classe active ao botão clicado
            button.classList.add('active');
            
            console.log('✅ Filtro selecionado:', filter);
            console.log('✅ Campo atualizado com:', filterInput.value);
            
            // Atualizar resumo da operação se estiver visível
            if (typeof updateOperationSummary === 'function') {
                updateOperationSummary();
            }
        } else {
            console.error('❌ Campo de filtros não encontrado!');
        }
    }

    // Navegar e selecionar pasta para o modal de agendamento
    browsePathForSchedule(type) {
        const currentPath = type === 'source' 
            ? document.getElementById('schedule-source').value || '/home/yo'
            : document.getElementById('schedule-target').value || '/home/yo';
            
        console.log(`🔍 Abrindo navegador de pastas para ${type}:`, currentPath);
        
        // Usar a função existente de navegação de pastas
        this.showFolderBrowser(currentPath, (selectedPath) => {
            if (type === 'source') {
                document.getElementById('schedule-source').value = selectedPath;
                console.log('✅ Pasta de origem selecionada:', selectedPath);
            } else {
                document.getElementById('schedule-target').value = selectedPath;
                console.log('✅ Pasta de destino selecionada:', selectedPath);
            }
        });
    }

    // Função auxiliar para preencher campo com múltiplas tentativas
    fillFieldWithRetry(field, value, fieldName) {
        if (!field) return false;
        
        // Tentativa 1: Método direto
        field.value = value;
        console.log(`🔄 Tentativa 1 - ${fieldName}:`, field.value);
        
        if (field.value === value) {
            console.log(`✅ ${fieldName} preenchido com sucesso`);
            return true;
        }
        
        // Tentativa 2: Disparar eventos
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`🔄 Tentativa 2 - ${fieldName} (com eventos):`, field.value);
        
        if (field.value === value) {
            console.log(`✅ ${fieldName} preenchido com eventos`);
            return true;
        }
        
        // Tentativa 3: Forçar com setTimeout
        setTimeout(() => {
            field.value = value;
            console.log(`🔄 Tentativa 3 - ${fieldName} (timeout):`, field.value);
        }, 50);
        
        return field.value === value;
    }

    // Selecionar pasta atual
    selectCurrentFolder(targetType, callback = null) {
        const selectedPath = document.getElementById('browser-path').value;
        console.log('🎯 Selecionando pasta:', selectedPath, 'para tipo:', targetType);
        
        // Se há um callback, usar ele em vez da lógica padrão
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
                console.log('🔍 Campo source-path encontrado:', !!sourceField);
            } else {
                console.log('🔍 Campo source-folder-path encontrado:', !!sourceField);
            }
            
            if (sourceField) {
                // Usar função auxiliar para preencher com múltiplas tentativas
                const success = this.fillFieldWithRetry(sourceField, selectedPath, 'source-folder-path');
                
                if (success) {
                    this.currentConfig.sourcePath = selectedPath;
                    console.log('✅ Campo de origem preenchido com sucesso');
                    this.showToast(`Pasta de origem selecionada: ${selectedPath}`, 'success');
                } else {
                    console.error('❌ Falha ao preencher campo de origem');
                    this.showToast('Erro: Falha ao preencher campo de origem', 'error');
                }
            } else {
                console.error('❌ Campo de pasta de origem não encontrado');
                console.error('❌ Tentou source-folder-path:', !!document.getElementById('source-folder-path'));
                console.error('❌ Tentou source-path:', !!document.getElementById('source-path'));
                this.showToast('Erro: Campo de pasta de origem não encontrado', 'error');
            }
        } else if (targetType === 'target') {
            // Verificar se existe o campo complexo primeiro (mais comum)
            let targetField = document.getElementById('target-folder-path'); // Campo complexo
            if (!targetField) {
                targetField = document.getElementById('dest-path'); // Campo simples
                console.log('🔍 Campo dest-path encontrado:', !!targetField);
            } else {
                console.log('🔍 Campo target-folder-path encontrado:', !!targetField);
            }
            
            if (targetField) {
                // Usar função auxiliar para preencher com múltiplas tentativas
                const success = this.fillFieldWithRetry(targetField, selectedPath, 'target-folder-path');
                
                if (success) {
                    this.currentConfig.targetPath = selectedPath;
                    console.log('✅ Campo de destino preenchido com sucesso');
                    this.showToast(`Pasta de destino selecionada: ${selectedPath}`, 'success');
                } else {
                    console.error('❌ Falha ao preencher campo de destino');
                    this.showToast('Erro: Falha ao preencher campo de destino', 'error');
                }
            } else {
                console.error('❌ Campo de pasta de destino não encontrado');
                console.error('❌ Tentou target-folder-path:', !!document.getElementById('target-folder-path'));
                console.error('❌ Tentou dest-path:', !!document.getElementById('dest-path'));
                this.showToast('Erro: Campo de pasta de destino não encontrado', 'error');
            }
        }

        // Fechar modal
        document.querySelector('.folder-browser-modal').closest('.modal').remove();
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

    // Selecionar operação
    selectOperation(operation) {
        console.log('🎯 Selecionando operação:', operation);
        
        // Remove classe active de todos os botões
        document.querySelectorAll('.operation-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Adiciona classe active ao botão selecionado
        const selectedBtn = document.querySelector(`.${operation}-btn`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        this.currentConfig.operation = operation;

        // Verificar se o campo de origem está visível
        const sourceField = document.getElementById('source-folder-path');
        const sourceFieldParent = sourceField?.parentElement;
        console.log('🔍 Campo source-folder-path encontrado:', !!sourceField);
        console.log('🔍 Campo source-folder-path visível:', sourceFieldParent?.style.display !== 'none');
        console.log('🔍 Campo source-folder-path display:', sourceFieldParent?.style.display);

        // Garantir que o campo de origem esteja sempre visível
        if (sourceFieldParent) {
            sourceFieldParent.style.display = 'block';
            console.log('✅ Campo de origem forçado a ser visível');
        }

        // Controla a visibilidade e obrigatoriedade do campo destino
        const targetField = document.getElementById('target-folder-path').parentElement;
        const targetInput = document.getElementById('target-folder-path');
        const targetHelp = document.getElementById('target-help');

        if (operation === 'delete') {
            // Para apagar, o campo destino é opcional e fica oculto
            targetField.style.display = 'none';
            targetInput.required = false;
            targetInput.value = ''; // Limpar valor
        } else {
            // Para mover/copiar, o campo destino é obrigatório e fica visível
            targetField.style.display = 'block';
            targetInput.required = true;

            // Atualizar texto de ajuda
            const operationText = operation === 'move' ? 'mover' : 'copiar';
            targetHelp.textContent = `Selecione a pasta de destino (obrigatório para ${operationText})`;
        }

        this.showToast(`Operação selecionada: ${operation}`, 'info');
    }

    // Executar operação imediatamente
    async executeNow() {
        const sourcePath = this.currentConfig.sourcePath;
        const operation = this.currentConfig.operation;
        const targetPath = document.getElementById('target-folder-path').value.trim();

        if (!sourcePath) {
            this.showToast('Selecione uma pasta de origem', 'error');
            return;
        }

        if (!operation) {
            this.showToast('Selecione uma operação', 'error');
            return;
        }

        if ((operation === 'move' || operation === 'copy') && !targetPath) {
            this.showToast('Digite o caminho de destino', 'error');
            return;
        }

        try {
            this.showToast(`Executando ${operation}...`, 'info');

            // Executa a operação diretamente via API
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
                this.showToast(`Operação ${operation} executada com sucesso!`, 'success', true);
            } else {
                this.showToast(`Erro: ${result.error?.message || 'Erro desconhecido'}`, 'error');
            }

        } catch (error) {
            console.error('Erro ao executar operação:', error);
            this.showToast('Erro ao executar operação', 'error');
        }
    }

    // Configurar operação completa (para agendamento)
    configureOperation() {
        // Obter valores atuais dos campos
        const sourcePath = document.getElementById('source-folder-path')?.value.trim() || this.currentConfig.sourcePath;
        const operation = this.currentConfig.operation;
        const targetPath = document.getElementById('target-folder-path')?.value.trim() || '';

        console.log('🔧 Configurando operação:', { sourcePath, operation, targetPath });
        console.log('🔧 currentConfig atual:', this.currentConfig);

        if (!sourcePath) {
            this.showToast('Selecione uma pasta de origem', 'error');
            return;
        }

        if (!operation) {
            this.showToast('Selecione uma operação', 'error');
            return;
        }

        if ((operation === 'move' || operation === 'copy') && !targetPath) {
            this.showToast('Digite o caminho de destino', 'error');
            return;
        }

        // Atualizar configuração atual com valores dos campos
        this.currentConfig.sourcePath = sourcePath;
        this.currentConfig.operation = operation;
        this.currentConfig.targetPath = targetPath;

        console.log('✅ Configuração atualizada:', this.currentConfig);

        this.showToast(`Operação configurada: ${operation} de ${sourcePath}`, 'success');

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

    // Adicionar event listeners para slideshow
    addSlideshowEventListeners() {
        // Modal de configuração
        const closeBtns = document.querySelectorAll('.slideshow-close-btn');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeSlideshowModal();
            });
        });

        const startBtn = document.querySelector('.slideshow-start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startSlideshowFromModal();
            });
        }

        const browseBtn = document.querySelector('.slideshow-browse-btn');
        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.browseSlideshowFolder();
            });
        }

        // Viewer de slideshow
        const prevBtn = document.querySelector('.slideshow-prev-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.previousSlide();
            });
        }

        const nextBtn = document.querySelector('.slideshow-next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.nextSlide();
            });
        }

        const playPauseBtn = document.querySelector('.slideshow-play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.togglePlayPause();
            });
        }

        const closeViewerBtn = document.querySelector('.slideshow-close-viewer-btn');
        if (closeViewerBtn) {
            closeViewerBtn.addEventListener('click', () => {
                this.closeSlideshowViewer();
            });
        }

        // Controles de teclado
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('slideshow-viewer').style.display !== 'none') {
                this.handleSlideshowKeydown(e);
            }
        });
    }

    // Abrir modal de slideshow
    showSlideshowModal() {
        document.getElementById('slideshow-modal').style.display = 'flex';
    }

    // Fechar modal de slideshow
    closeSlideshowModal() {
        document.getElementById('slideshow-modal').style.display = 'none';
    }

    // Navegar para pasta de slideshow
    browseSlideshowFolder() {
        // Criar um modal personalizado para seleção de pasta
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; width: 90%;">
                <div class="modal-header">
                    <h3>Selecionar Pasta</h3>
                    <button class="modal-close slideshow-folder-close-btn">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="folder-path-input">Caminho da pasta:</label>
                        <div class="input-group">
                            <input type="text" id="folder-path-input" class="form-input"
                                   placeholder="${navigator.userAgent.indexOf('Windows') > -1 ? 'C:\\\\Users\\\\User\\\\Pictures' : '/home/user/Pictures'}" value="${navigator.userAgent.indexOf('Windows') > -1 ? 'C:\\\\Users\\\\User\\\\Pictures' : '/home/user/Pictures'}">
                            <button class="btn btn-outline slideshow-folder-test-btn">
                                <span class="material-icons">check</span>
                                Testar
                            </button>
                        </div>
                        <small class="form-help">
                            Digite o caminho completo da pasta que contém as imagens
                        </small>
                    </div>
                    <div class="folder-suggestions">
                        <h4>Pastas comuns:</h4>
                        <div class="suggestion-buttons">
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="${navigator.userAgent.indexOf('Windows') > -1 ? 'C:\\\\Users\\\\User\\\\Pictures' : '/home/user/Pictures'}">~/Pictures</button>
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="${navigator.userAgent.indexOf('Windows') > -1 ? 'C:\\\\Users\\\\User\\\\Downloads' : '/home/user/Downloads'}">~/Downloads</button>
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="/media">/media</button>
                            <button class="btn btn-sm slideshow-suggestion-btn" data-path="./">Diretório atual</button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary slideshow-folder-cancel-btn">Cancelar</button>
                    <button class="btn btn-primary slideshow-folder-select-btn">Selecionar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Configurar event listeners para o modal de slideshow
        this.setupSlideshowFolderEventListeners(modal);
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
                    recursive: true
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
        const folderPath = document.getElementById('slideshow-folder-path').value.trim();
        const interval = parseInt(document.getElementById('slideshow-interval').value) || 3;
        const recursive = document.getElementById('slideshow-recursive').checked;

        // Coletar extensões selecionadas
        const extensions = [];
        document.querySelectorAll('.extensions-list input:checked').forEach(checkbox => {
            extensions.push(checkbox.value);
        });

        if (!folderPath) {
            this.showToast('Selecione uma pasta com imagens', 'error');
            return;
        }

        if (extensions.length === 0) {
            this.showToast('Selecione pelo menos uma extensão de imagem', 'error');
            return;
        }

        // Fechar modal de configuração
        this.closeSlideshowModal();

        // Iniciar carregamento das imagens
        await this.loadSlideshowImages(folderPath, extensions, recursive, interval);
    }

    // Carregar imagens do slideshow
    async loadSlideshowImages(folderPath, extensions, recursive, interval) {
        try {
            this.showToast('🔍 Procurando imagens...', 'info');

            // Preparar extensões para a API
            const formattedExtensions = extensions.map(ext => ext.startsWith('.') ? ext : '.' + ext);

            const response = await fetch('/api/files/list-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    folderPath,
                    extensions: formattedExtensions,
                    recursive
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Erro ao listar imagens');
            }

            this.slideshowImages = result.data.images;
            this.slideshowInterval = interval * 1000;

            if (this.slideshowImages.length === 0) {
                this.showToast('Nenhuma imagem encontrada na pasta', 'warning');
                return;
            }

            // Embaralhar as imagens para ordem aleatória
            this.shuffleArray(this.slideshowImages);
            console.log('🎲 Imagens embaralhadas para ordem aleatória');

            this.showToast(`✅ ${this.slideshowImages.length} imagens encontradas (ordem aleatória)`, 'success');
            this.startSlideshowViewer();

        } catch (error) {
            console.error('Erro ao carregar imagens:', error);
            this.showToast('Erro ao carregar imagens: ' + error.message, 'error');
        }
    }

    // Iniciar viewer do slideshow
    startSlideshowViewer() {
        document.getElementById('slideshow-viewer').style.display = 'flex';
        this.currentSlideIndex = 0;
        this.slideshowPlaying = true;

        this.updateSlideDisplay();
        this.startAutoPlay();
    }

    // Atualizar exibição do slide atual
    updateSlideDisplay() {
        const imageElement = document.getElementById('slideshow-image');
        const counterElement = document.getElementById('slideshow-counter');
        const filenameElement = document.getElementById('slideshow-filename');
        const loadingElement = document.getElementById('slideshow-loading');
        const errorElement = document.getElementById('slideshow-error');

        if (this.slideshowImages.length === 0) {
            loadingElement.style.display = 'none';
            errorElement.style.display = 'block';
            return;
        }

        const currentImage = this.slideshowImages[this.currentSlideIndex];

        // Atualizar contador e nome do arquivo
        counterElement.textContent = `${this.currentSlideIndex + 1} / ${this.slideshowImages.length}`;
        filenameElement.textContent = currentImage.name;
        
        // Atualizar caminho completo da imagem no rodapé
        const pathElement = document.getElementById('slideshow-path');
        if (pathElement) {
            pathElement.textContent = currentImage.path;
        }

        // Mostrar loading
        loadingElement.style.display = 'block';
        imageElement.style.display = 'none';
        errorElement.style.display = 'none';

        // Carregar imagem através da API
        setTimeout(() => {
            loadingElement.style.display = 'none';
            imageElement.src = `/api/files/image/${encodeURIComponent(currentImage.path)}`;
            imageElement.style.display = 'block';

            // Manipular erro de carregamento
            imageElement.onerror = () => {
                loadingElement.style.display = 'none';
                imageElement.style.display = 'none';
                errorElement.style.display = 'block';
            };

            imageElement.onload = () => {
                // Imagem carregada com sucesso
                errorElement.style.display = 'none';
            };
        }, 300);
    }

    // Próximo slide
    nextSlide() {
        if (this.slideshowImages.length === 0) return;

        this.currentSlideIndex = (this.currentSlideIndex + 1) % this.slideshowImages.length;
        this.updateSlideDisplay();
    }

    // Slide anterior
    previousSlide() {
        if (this.slideshowImages.length === 0) return;

        this.currentSlideIndex = this.currentSlideIndex === 0 ?
            this.slideshowImages.length - 1 :
            this.currentSlideIndex - 1;
        this.updateSlideDisplay();
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

    // Iniciar reprodução automática
    startAutoPlay() {
        this.stopAutoPlay(); // Parar qualquer intervalo existente

        if (this.slideshowPlaying && this.slideshowImages.length > 1) {
            this.autoPlayInterval = setInterval(() => {
                this.nextSlide();
            }, this.slideshowInterval);
        }
    }

    // Parar reprodução automática
    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }

    // Fechar viewer do slideshow
    closeSlideshowViewer() {
        this.stopAutoPlay();
        document.getElementById('slideshow-viewer').style.display = 'none';
        this.slideshowImages = [];
        this.currentSlideIndex = 0;
    }

    // Manipular eventos de teclado no slideshow
    handleSlideshowKeydown(event) {
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.previousSlide();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextSlide();
                break;
            case ' ':
                event.preventDefault();
                this.togglePlayPause();
                break;
            case 'Escape':
                event.preventDefault();
                this.closeSlideshowViewer();
                break;
        }
    }

    // Salvar pasta (método auxiliar)
    async saveFolder(folder) {
        console.log('💾 Salvando pasta:', folder);

        try {
            const response = await fetch('/api/folders', {
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
            console.log('✅ Pasta salva com sucesso:', result);
            return result;

        } catch (error) {
            console.error('❌ Erro ao salvar pasta:', error);
            throw error;
        }
    }

    // Salvar template (método auxiliar)
    async saveTemplate(template) {
        console.log('📋 Salvando template:', template);

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
            console.log('✅ Template salvo com sucesso:', result);
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

            const response = await fetch('/api/folders', {
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
            
            const response = await fetch('/api/workflows', {
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

        this.setupWorkflowEventListeners();
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
            console.log('🔍 Carregando workflows da API...');
            const response = await fetch('/api/files/workflows');
            if (response.ok) {
                const result = await response.json();
                this.workflows = result.data || [];
                console.log('✅ Workflows carregados:', this.workflows);
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

        console.log('🎨 Renderizando workflows:', this.workflows);

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
            console.log('⚠️ Carregamento de pastas já em andamento, pulando...');
            return;
        }
        this.isLoadingFolders = true;

        try {
            console.log('🔍 Carregando pastas da API...');
            const response = await fetch('/api/files/folders');
            if (response.ok) {
                const result = await response.json();
                this.folders = result.data || [];
                console.log('✅ Pastas carregadas:', this.folders);
                this.renderConfiguredFolders();
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

        console.log('📢 Mensagem de API indisponível exibida');
    }

    renderConfiguredFolders() {
        console.log('🔄 Iniciando renderConfiguredFolders com', this.folders?.length || 0, 'pastas');

        // Verificar se já está renderizando para evitar loops
        if (this.isRenderingFolders) {
            console.log('⚠️ Renderização já em andamento, pulando...');
            return;
        }
        this.isRenderingFolders = true;

        const foldersList = document.getElementById('folders-list');
        console.log('📍 Elemento folders-list encontrado:', !!foldersList);

        if (!foldersList) {
            console.warn('⚠️ Elemento folders-list não encontrado');
            this.isRenderingFolders = false;
            return;
        }

        console.log('🎨 Renderizando pastas:', this.folders);
        console.log('📊 Conteúdo atual do foldersList:', foldersList.innerHTML.substring(0, 100) + '...');

        if (this.folders.length === 0) {
            foldersList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">folder_open</span>
                    <p>Nenhuma pasta configurada</p>
                    <small>Use a configuração rápida acima ou crie manualmente</small>
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

        console.log('✅ HTML definido para foldersList');
        console.log('📊 Novo conteúdo do foldersList:', foldersList.innerHTML.substring(0, 200) + '...');

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
                window.showSlideshowModal();
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
            case 'workflows':
                this.loadWorkflows();
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
            const statusResponse = await fetch('/api/status/resources');
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                
                const memoryUsage = document.getElementById('memory-usage');
                const diskUsage = document.getElementById('disk-usage');
                
                if (memoryUsage) {
                    memoryUsage.textContent = 
                        `${Math.round(statusData.memory.used / 1024 / 1024)} MB / ${Math.round(statusData.memory.total / 1024 / 1024)} MB`;
                }
                
                if (diskUsage) {
                    diskUsage.textContent = 
                        `${Math.round(statusData.disk.used / 1024 / 1024)} GB / ${Math.round(statusData.disk.total / 1024 / 1024)} GB`;
                }
            }

            const tempResponse = await fetch('/api/status/performance');
            if (tempResponse.ok) {
                const tempData = await tempResponse.json();
                const cpuTemp = document.getElementById('cpu-temp');
                if (cpuTemp && tempData.cpu && tempData.cpu.temperature) {
                    cpuTemp.textContent = `${tempData.cpu.temperature}°C`;
                }
            }

            this.updateRecentActivity();

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
            this.settings = {
                port: 3000,
                logLevel: 'info',
                environment: 'production',
                logDirectory: 'logs/'
            };

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
        const settings = {
            port: parseInt(document.getElementById('app-port').value),
            logLevel: document.getElementById('log-level').value,
            environment: document.getElementById('environment').value,
            logDirectory: document.getElementById('log-directory').value
        };

        try {
            this.settings = settings;
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

    // Métodos de monitoramento
    startMonitoring() {
        setInterval(() => {
            if (this.currentTab === 'dashboard') {
                this.updateDashboard();
            }
        }, 30000);

        this.updateDashboard();
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
            loadScheduledOperations();
            loadBackups();
        } else {
            showToast(result.error?.message || 'Erro na operação', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao executar operação:', error);
        showToast('Erro ao executar operação', 'error');
    }
}

// Schedule Modal
function showScheduleModal() {
    const modal = document.getElementById('schedule-modal');

    // Preencher com dados da operação atual se disponível
    if (window.deParaUI && window.deParaUI.currentConfig) {
        const config = window.deParaUI.currentConfig;
        
        // Preencher campos com valores atuais
        document.getElementById('schedule-name').value = config.name || `Operação ${config.operation || 'arquivo'}`;
        document.getElementById('schedule-action').value = config.operation || '';
        document.getElementById('schedule-frequency').value = '1d'; // Padrão: diariamente
        document.getElementById('schedule-source').value = config.sourcePath || '';
        document.getElementById('schedule-target').value = config.targetPath || '';
        document.getElementById('schedule-filters').value = config.fileFilters || '';
        document.getElementById('schedule-batch').checked = true;
        document.getElementById('schedule-backup').checked = false;
        
        console.log('✅ Modal preenchido com configuração atual:', config);
    } else {
        // Reset form se não há configuração
        document.getElementById('schedule-name').value = '';
        document.getElementById('schedule-action').value = '';
        document.getElementById('schedule-frequency').value = '1d'; // Padrão: diariamente
        document.getElementById('schedule-source').value = '';
        document.getElementById('schedule-target').value = '';
        document.getElementById('schedule-filters').value = '';
        document.getElementById('schedule-batch').checked = true;
        document.getElementById('schedule-backup').checked = false;
        
        console.log('⚠️ Nenhuma configuração atual encontrada, modal resetado');
    }

    updateScheduleForm();

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

// Função closeScheduleModal removida - usando window.closeScheduleModal

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

    console.log('🔍 Campos capturados:', { name, action, frequency, sourcePath, targetPath });

    if (!name || !action || !frequency || !sourcePath) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }

    if ((action === 'move' || action === 'copy') && !targetPath) {
        showToast('Caminho de destino é obrigatório', 'error');
        return;
    }

    try {
        // Gerar ID correto baseado no contexto
        let operationId;
        if (isEditing) {
            // Edição: usar ID existente
            operationId = isEditing;
        } else {
            // Criação nova: gerar novo ID
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

        if (filters) {
            requestData.options.filters = {
                extensions: filters.split(',').map(ext => ext.trim().replace('*.', ''))
            };
        }

        const url = isEditing ? `/api/files/schedule/${isEditing}` : '/api/files/schedule';
        const method = isEditing ? 'PUT' : 'POST';
        
        console.log(`${isEditing ? '✏️ Editando' : '➕ Criando'} operação:`, requestData);
        console.log('🔍 Contexto:', { isEditing, operationId, modalDataset: modal.dataset });

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
            showToast(`Operação "${name}" ${actionMsg} com sucesso!${structureMsg}`, 'success', true);
            window.closeScheduleModal();
            loadScheduledOperations();
        } else {
            const actionMsg = isEditing ? 'editar' : 'agendar';
            showToast(result.error?.message || `Erro ao ${actionMsg} operação`, 'error', true);
        }

    } catch (error) {
        console.error('Erro ao agendar operação:', error);
        showToast('Erro ao agendar operação', 'error');
    }
}

// Controle de carregamento para evitar chamadas simultâneas
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
        console.log(`⚠️ ${type} já está carregando, pulando...`);
        return false;
    }

    // Se carregou recentemente (debounce), não permitir
    if (now - control.lastLoad < control.debounceMs) {
        console.log(`⚠️ ${type} carregado recentemente, pulando (debounce)...`);
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
        console.log(`🔄 Iniciando carregamento de ${type}...`);
        loadFunction();
    } else {
        console.log(`⏭️ Pulando carregamento de ${type} (debounce ou já carregando)`);
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
        console.log('🔍 Carregando templates...');
        const response = await fetch('/api/files/templates');
        const result = await response.json();

        console.log('📋 Resposta da API de templates:', result);

        if (result.success && result.data) {
            // Usar categories diretamente se existir, senão usar array vazio
            const categories = result.data.categories || [];
            console.log('📂 Categorias recebidas:', categories);
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

    console.log('🎨 Renderizando templates:', categories);

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

function renderProgress(operations) {
    const container = document.getElementById('progress-list');

    if (operations.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma operação em andamento</p>';
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
                        ${isError ? 'Erro' : isCompleted ? 'Concluído' : `${op.percentage}%`}
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
            console.log('📋 Operações agendadas recebidas:', result.data);
            console.log('📊 Total de operações:', result.data.length);
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
        console.log('🔍 Renderizando operação:', { id: op.id, name: op.name, action: op.action, frequency: op.frequency });
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
            loadScheduledOperations();
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

    console.log(`🚀 Executando operação agendada: ${operationId}`);

    try {
        const response = await fetch(`/api/files/schedule/${operationId}/execute`, {
            method: 'POST'
        });

        console.log(`📡 Resposta da API: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const result = await response.json();
            console.log('📋 Resultado da execução:', result);
            
            if (result.success) {
                console.log('✅ Operação executada com sucesso:', result);
                showToast(`Operação executada com sucesso! ${result.message || ''}`, 'success', true);
                
                // Recarregar operações agendadas para mostrar status atualizado
                if (typeof loadScheduledOperations === 'function') {
                    loadScheduledOperations();
                }
            } else {
                throw new Error(result.error || 'Erro ao executar operação');
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Erro HTTP:', response.status, errorText);
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
                console.log(`✅ Operação ${newStatus ? 'retomada' : 'pausada'} com sucesso`);
                showToast(`Operação ${newStatus ? 'retomada' : 'pausada'} com sucesso!`, 'success', true);
                // Recarregar operações agendadas
                loadScheduledOperations();
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
async function editScheduledOperation(operationId) {
    console.log('🔧 Editando operação:', operationId);
    
    try {
        // Obter dados da operação
        const response = await fetch(`/api/files/schedule/${operationId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error?.message || 'Erro ao obter operação');
        }
        
        const operation = result.data;
        console.log('📋 Dados da operação para edição:', operation);
        
        // Abrir modal de edição
        showEditOperationModal(operation);
        
    } catch (error) {
        console.error('❌ Erro ao obter operação para edição:', error);
        showToast('Erro ao carregar operação para edição: ' + error.message, 'error', true);
    }
}

// Mostrar modal de edição de operação
function showEditOperationModal(operation) {
    const modal = document.getElementById('schedule-modal');
    
    // Preencher campos com dados da operação
    document.getElementById('schedule-name').value = operation.name || '';
    document.getElementById('schedule-action').value = operation.action || '';
    document.getElementById('schedule-frequency').value = operation.frequency || '1d';
    document.getElementById('schedule-source').value = operation.sourcePath || '';
    document.getElementById('schedule-target').value = operation.targetPath || '';
    document.getElementById('schedule-filters').value = operation.fileFilters || '';
    document.getElementById('schedule-batch').checked = operation.batch !== false;
    document.getElementById('schedule-backup').checked = operation.backup === true;
    
    // Adicionar ID da operação ao modal para identificação
    modal.dataset.editingOperationId = operation.id;
    
    // Alterar título do modal
    const modalTitle = modal.querySelector('.modal-header h3');
    if (modalTitle) {
        modalTitle.textContent = 'Editar Operação';
    }
    
    // Alterar texto do botão
    const submitBtn = modal.querySelector('.schedule-operation-btn');
    if (submitBtn) {
        submitBtn.textContent = 'Salvar Alterações';
    }
    
    updateScheduleForm();
    updateOperationSummary();
    
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    
    console.log('✅ Modal de edição aberto para operação:', operation.id);
}

// Duplicar operação agendada
async function duplicateScheduledOperation(operationId) {
    console.log('📋 Duplicando operação:', operationId);
    
    try {
        // Obter dados da operação
        const response = await fetch(`/api/files/schedule/${operationId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error?.message || 'Erro ao obter operação');
        }
        
        const operation = result.data;
        console.log('📋 Dados da operação para duplicação:', operation);
        
        // Modificar nome para indicar que é uma cópia
        const duplicatedOperation = {
            ...operation,
            name: `${operation.name} (Cópia)`,
            id: `duplicate_${Date.now()}` // Novo ID
        };
        
        // Abrir modal de duplicação
        showDuplicateOperationModal(duplicatedOperation);
        
    } catch (error) {
        console.error('❌ Erro ao obter operação para duplicação:', error);
        showToast('Erro ao carregar operação para duplicação: ' + error.message, 'error', true);
    }
}

// Mostrar modal de duplicação de operação
function showDuplicateOperationModal(operation) {
    const modal = document.getElementById('schedule-modal');
    
    // Preencher campos com dados da operação
    document.getElementById('schedule-name').value = operation.name || '';
    document.getElementById('schedule-action').value = operation.action || '';
    document.getElementById('schedule-frequency').value = operation.frequency || '1d';
    document.getElementById('schedule-source').value = operation.sourcePath || '';
    document.getElementById('schedule-target').value = operation.targetPath || '';
    document.getElementById('schedule-filters').value = operation.fileFilters || '';
    document.getElementById('schedule-batch').checked = operation.batch !== false;
    document.getElementById('schedule-backup').checked = operation.backup === true;
    
    // Adicionar ID da operação ao modal para identificação
    modal.dataset.editingOperationId = operation.id;
    
    // Alterar título do modal
    const modalTitle = modal.querySelector('.modal-header h3');
    if (modalTitle) {
        modalTitle.textContent = 'Duplicar Operação';
    }
    
    // Alterar texto do botão
    const submitBtn = modal.querySelector('.schedule-operation-btn');
    if (submitBtn) {
        submitBtn.textContent = 'Duplicar Operação';
    }
    
    updateScheduleForm();
    updateOperationSummary();
    
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    
    console.log('✅ Modal de duplicação aberto para operação:', operation.id);
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
        console.error('Erro ao mostrar notificação:', error);
    }
}

// Enhanced Toast notifications helper
function showToast(message, type = 'info', showSystemNotification = false) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Show system notification for important messages
    if (showSystemNotification && (type === 'success' || type === 'error')) {
        const title = type === 'success' ? 'Operação Concluída' : 'Erro na Operação';
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
            const structureMsg = preserveStructure ? ' (estrutura preservada)' : ' (estrutura achatada)';
            showToast(`Operação ${operation} executada com sucesso!${structureMsg}`, 'success', true);

            // Fecha modal se existir
            const modal = document.querySelector('.modal');
            if (modal) modal.remove();

            // Limpa preview
            clearFilePreview();
        } else {
            showToast(result.error?.message || 'Erro na operação', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao executar operação:', error);
        showToast('Erro ao executar operação', 'error', true);
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
        const preserveStructure = document.getElementById('preserve-structure-modal')?.checked ?? true;

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
// SLIDESHOW FUNCTIONALITY
// ==========================================

// Slideshow state
let slideshowImages = [];
let currentImageIndex = 0;
let slideshowInterval = null;
let autoAdvance = true;

// Slideshow Functions
function showSlideshowModal() {
    const modal = document.getElementById('slideshow-folder-modal');
    modal.style.display = 'flex';

    // Carregar pasta salva do localStorage
    const savedPath = localStorage.getItem('slideshowSelectedPath');
    if (savedPath) {
        document.getElementById('slideshow-folder-path').value = savedPath;
        console.log('📂 Pasta do slideshow carregada:', savedPath);
    }

    // Focus no campo de pasta
    setTimeout(() => {
        document.getElementById('slideshow-folder-path').focus();
    }, 100);
}

function closeSlideshowFolderModal() {
    document.getElementById('slideshow-folder-modal').style.display = 'none';
    resetSlideshowFolderForm();
}

function closeSlideshowConfigModal() {
    const modal = document.getElementById('slideshow-config-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

function resetSlideshowFolderForm() {
    // Não limpar o campo de pasta se houver uma pasta salva
    const savedPath = localStorage.getItem('slideshowSelectedPath');
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
    const folderPath = document.getElementById('slideshow-folder-path').value.trim();
    const maxDepth = document.getElementById('slideshow-max-depth').value;

    if (!folderPath) {
        showToast('Digite o caminho da pasta', 'error');
        return;
    }

    // Coletar extensões selecionadas
    const selectedExtensions = [];
    const extensionCheckboxes = document.querySelectorAll('.extension-selector input[type="checkbox"]:checked');
    extensionCheckboxes.forEach(checkbox => {
        selectedExtensions.push(checkbox.value);
    });

    if (selectedExtensions.length === 0) {
        showToast('Selecione pelo menos uma extensão de arquivo', 'error');
        return;
    }

    try {
        // Fechar modal de seleção
        closeSlideshowFolderModal();

        // Mostrar slideshow
        showSlideshow(folderPath, selectedExtensions, maxDepth);

    } catch (error) {
        console.error('Erro ao iniciar slideshow:', error);
        showToast('Erro ao iniciar slideshow', 'error');
    }
}

async function showSlideshow(folderPath, extensions, maxDepth) {
    const slideshowModal = document.getElementById('slideshow-modal');
    const imageElement = document.getElementById('slideshow-image');
    const loadingElement = document.getElementById('slideshow-loading');
    const errorElement = document.getElementById('slideshow-error');

    // Reset state
    slideshowImages = [];
    currentImageIndex = 0;

    // Show modal
    slideshowModal.style.display = 'block';

    // Show loading
    loadingElement.style.display = 'flex';
    imageElement.style.display = 'none';
    errorElement.style.display = 'none';

    try {
        // Build query parameters
        const params = new URLSearchParams({
            extensions: extensions.join(','),
            maxDepth: maxDepth || '3'
        });

        const response = await fetch(`/api/files/images/${encodeURIComponent(folderPath)}?${params}`);

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data.images && result.data.images.length > 0) {
            slideshowImages = result.data.images;
            await loadImage(0);
            updateSlideshowUI();

            // Start auto-advance if enabled
            if (autoAdvance) {
                startAutoAdvance();
            }

            showToast(`Slideshow iniciado com ${slideshowImages.length} imagens`, 'success');
        } else {
            throw new Error(result.error?.message || 'Nenhuma imagem encontrada');
        }

    } catch (error) {
        console.error('Erro ao carregar imagens:', error);
        showSlideshowError(error.message);
    }
}

async function loadImage(index) {
    if (index < 0 || index >= slideshowImages.length) {
        return;
    }

    const imageElement = document.getElementById('slideshow-image');
    const loadingElement = document.getElementById('slideshow-loading');
    const errorElement = document.getElementById('slideshow-error');

    // Show loading
    loadingElement.style.display = 'flex';
    imageElement.style.display = 'none';
    errorElement.style.display = 'none';

    const image = slideshowImages[index];

    return new Promise((resolve, reject) => {
        imageElement.onload = () => {
            loadingElement.style.display = 'none';
            imageElement.style.display = 'block';
            currentImageIndex = index;
            updateSlideshowUI();
            resolve();
        };

        imageElement.onerror = () => {
            console.error('Erro ao carregar imagem:', image.path);
            showSlideshowError(`Erro ao carregar: ${image.name}`);
            reject(new Error(`Erro ao carregar imagem: ${image.name}`));
        };

        // Set image source - por enquanto usaremos um placeholder
        // TODO: Implementar endpoint para servir imagens
        imageElement.src = `data:image/svg+xml;base64,${btoa(`
            <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#f0f0f0"/>
                <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#666" font-family="Arial" font-size="16">
                    ${image.name}
                </text>
            </svg>
        `)}`;
        imageElement.alt = image.name;
    });
}

function showSlideshowError(message) {
    const loadingElement = document.getElementById('slideshow-loading');
    const errorElement = document.getElementById('slideshow-error');
    const errorText = errorElement.querySelector('p');

    loadingElement.style.display = 'none';
    errorElement.style.display = 'flex';
    errorText.textContent = message;
}

function updateSlideshowUI() {
    const currentImageElement = document.getElementById('current-image');
    const totalImagesElement = document.getElementById('total-images');
    const filenameElement = document.getElementById('image-filename');
    const progressBar = document.getElementById('slideshow-progress-bar');
    const prevBtn = document.getElementById('slideshow-prev');
    const nextBtn = document.getElementById('slideshow-next');

    if (slideshowImages.length > 0) {
        const currentImage = slideshowImages[currentImageIndex];

        currentImageElement.textContent = currentImageIndex + 1;
        totalImagesElement.textContent = slideshowImages.length;
        filenameElement.textContent = currentImage.name;

        // Update progress bar
        const progress = ((currentImageIndex + 1) / slideshowImages.length) * 100;
        progressBar.style.width = `${progress}%`;

        // Update navigation buttons
        prevBtn.disabled = currentImageIndex === 0;
        nextBtn.disabled = currentImageIndex === slideshowImages.length - 1;

        prevBtn.style.opacity = prevBtn.disabled ? 0.5 : 1;
        nextBtn.style.opacity = nextBtn.disabled ? 0.5 : 1;
    }
}

function nextImage() {
    if (currentImageIndex < slideshowImages.length - 1) {
        loadImage(currentImageIndex + 1);
    }
}

function previousImage() {
    if (currentImageIndex > 0) {
        loadImage(currentImageIndex - 1);
    }
}

function startAutoAdvance() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
    }

    slideshowInterval = setInterval(() => {
        if (currentImageIndex < slideshowImages.length - 1) {
            nextImage();
        } else {
            // Loop back to first image
            loadImage(0);
        }
    }, 5000); // Change image every 5 seconds
}

function stopAutoAdvance() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = null;
    }
}

function closeSlideshow() {
    const slideshowModal = document.getElementById('slideshow-modal');

    // Stop auto-advance
    stopAutoAdvance();

    // Hide modal
    slideshowModal.style.display = 'none';

    // Reset state
    slideshowImages = [];
    currentImageIndex = 0;

    // Clear image source
    const imageElement = document.getElementById('slideshow-image');
    imageElement.src = '';
    imageElement.style.display = 'none';

    // Reset UI
    document.getElementById('slideshow-loading').style.display = 'none';
    document.getElementById('slideshow-error').style.display = 'none';
}

// Keyboard navigation
document.addEventListener('keydown', (event) => {
    const slideshowModal = document.getElementById('slideshow-modal');

    if (slideshowModal.style.display === 'block') {
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                previousImage();
                break;
            case 'ArrowRight':
                event.preventDefault();
                nextImage();
                break;
            case ' ':
                event.preventDefault();
                // Toggle auto-advance
                if (slideshowInterval) {
                    stopAutoAdvance();
                    showToast('Apresentação automática parada', 'info');
                } else {
                    startAutoAdvance();
                    showToast('Apresentação automática iniciada', 'info');
                }
                break;
            case 'Escape':
                event.preventDefault();
                closeSlideshow();
                break;
            case 'Home':
                event.preventDefault();
                loadImage(0);
                break;
            case 'End':
                event.preventDefault();
                loadImage(slideshowImages.length - 1);
                break;
        }
    }
});

// Mouse wheel navigation
document.addEventListener('wheel', (event) => {
    const slideshowModal = document.getElementById('slideshow-modal');

    if (slideshowModal.style.display === 'block') {
        event.preventDefault();

        if (event.deltaY > 0) {
            nextImage();
        } else {
            previousImage();
        }
    }
});

// Touch/swipe navigation for mobile
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (event) => {
    const slideshowModal = document.getElementById('slideshow-modal');

    if (slideshowModal.style.display === 'block') {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
    }
});

document.addEventListener('touchend', (event) => {
    const slideshowModal = document.getElementById('slideshow-modal');

    if (slideshowModal.style.display === 'block') {
        const touchEndX = event.changedTouches[0].clientX;
        const touchEndY = event.changedTouches[0].clientY;

        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // Check if it's a horizontal swipe (more horizontal than vertical)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX > 0) {
                previousImage(); // Swipe right = previous
            } else {
                nextImage(); // Swipe left = next
            }
        }
    }
});

// Prevent context menu in slideshow
document.addEventListener('contextmenu', (event) => {
    const slideshowModal = document.getElementById('slideshow-modal');

    if (slideshowModal.style.display === 'block') {
        event.preventDefault();
    }
});

// Add slideshow hints
function addSlideshowHints() {
    const slideshowModal = document.getElementById('slideshow-modal');
    const existingHints = slideshowModal.querySelector('.slideshow-hints');

    if (!existingHints) {
        const hints = document.createElement('div');
        hints.className = 'slideshow-hints';
        hints.innerHTML = `
            <div><strong>Navegação:</strong></div>
            <div>← → Setas | Espaço: Pausar/Continuar</div>
            <div>Home/End: Início/Fim | ESC: Sair</div>
            <div>Roda do mouse: Próxima/Anterior</div>
        `;

        slideshowModal.querySelector('.slideshow-container').appendChild(hints);
    }
}

// Initialize slideshow hints when modal is shown
const slideshowObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const slideshowModal = document.getElementById('slideshow-modal');
            if (slideshowModal.style.display === 'block') {
                addSlideshowHints();
            }
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const slideshowModal = document.getElementById('slideshow-modal');
    if (slideshowModal) {
        slideshowObserver.observe(slideshowModal, {
            attributes: true,
            attributeFilter: ['style']
        });
    }
});

// ==========================================
// END SLIDESHOW FUNCTIONALITY
// ==========================================

// Inicialização
let ui;
document.addEventListener('DOMContentLoaded', () => {
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

        window.showScheduleModal = function() {
            // Chamar diretamente a função global showScheduleModal (sem recursão)
            const modal = document.getElementById('schedule-modal');
            if (modal) {
                modal.style.display = 'block';
                document.body.classList.add('modal-open');
            } else {
                console.error('❌ Modal de agendamento não encontrado');
                this.showToast('Erro: Modal de agendamento não encontrado', 'error');
            }
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
            const modal = document.getElementById('schedule-modal');
            if (modal) {
                modal.style.display = 'none';
                document.body.classList.remove('modal-open');
                
                // Limpar estado de edição
                delete modal.dataset.editingOperationId;
                
                // Restaurar título e botão originais
                const modalTitle = modal.querySelector('.modal-header h3');
                if (modalTitle) {
                    modalTitle.textContent = 'Agendar Operação';
                }
                
                const submitBtn = modal.querySelector('.schedule-operation-btn');
                if (submitBtn) {
                    submitBtn.textContent = 'Agendar';
                }
                
                console.log('✅ Modal de agendamento fechado via window.closeScheduleModal');
            }
        };

        window.scheduleOperation = async function() {
            // Chamar diretamente a função global scheduleOperation (sem recursão)
            const name = document.getElementById('schedule-name').value.trim();
            const action = document.getElementById('schedule-action').value;
            const frequency = document.getElementById('schedule-frequency').value;
            const sourcePath = document.getElementById('schedule-source').value.trim();
            const targetPath = document.getElementById('schedule-target').value.trim();
            const filters = document.getElementById('schedule-filters').value.trim();
            const batch = document.getElementById('schedule-batch').checked;
            const backup = document.getElementById('schedule-backup').checked;
            
            if (!name || !action || !frequency || !sourcePath) {
                alert('Por favor, preencha todos os campos obrigatórios.');
                return;
            }
            
            if (action !== 'delete' && !targetPath) {
                alert('Caminho de destino é obrigatório para operações de mover e copiar.');
                return;
            }
            
            console.log('✅ Agendando operação:', { name, action, frequency, sourcePath, targetPath, filters, batch, backup });
            
            try {
                // Preparar dados para a API
                const operationData = {
                    name: name,
                    action: action,
                    frequency: frequency,
                    sourcePath: sourcePath,
                    targetPath: targetPath,
                    options: {
                        filters: filters,
                        batch: batch,
                        backup: backup,
                        preserveStructure: document.getElementById('schedule-preserve-structure').checked
                    }
                };
                
                console.log('📡 Enviando dados para API:', operationData);
                
                // Chamar API para agendar operação
                const response = await fetch('/api/files/schedule', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(operationData)
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    console.log('✅ Operação agendada com sucesso:', result.data);
                    
                    // Fechar modal
                    window.closeScheduleModal();
                    
                    // Mostrar mensagem de sucesso
                    if (window.deParaUI) {
                        window.deParaUI.showToast(`Operação "${name}" agendada com sucesso!`, 'success');
                        
                        // Recarregar operações agendadas se estivermos na aba correta
                        if (window.deParaUI.currentTab === 'scheduled') {
                            if (typeof loadScheduledOperations === 'function') {
                                loadScheduledOperations();
                            }
                        }
                    }
                } else {
                    console.error('❌ Erro ao agendar operação:', result.error);
                    alert(`Erro ao agendar operação: ${result.error?.message || 'Erro desconhecido'}`);
                }
                
            } catch (error) {
                console.error('❌ Erro na requisição:', error);
                alert(`Erro de conexão: ${error.message}`);
            }
        };

        // Funções para slideshow (todas são funções globais)
        window.closeSlideshowFolderModal = function() {
            const modal = document.getElementById('slideshow-folder-modal');
            if (modal) {
                modal.style.display = 'none';
                document.body.classList.remove('modal-open');
                console.log('✅ Modal de slideshow fechado via window.closeSlideshowFolderModal');
            }
        };

        window.startSlideshow = function() {
            const sourcePath = document.getElementById('slideshow-folder-path').value.trim();
            if (!sourcePath) {
                alert('Por favor, selecione uma pasta de origem para o slideshow.');
                return;
            }
            
            // Salvar pasta selecionada no localStorage
            localStorage.setItem('slideshowSelectedPath', sourcePath);
            console.log('💾 Pasta do slideshow salva:', sourcePath);
            
            console.log('✅ Iniciando slideshow para:', sourcePath);
            
            // Fechar modal
            window.closeSlideshowFolderModal();
            
            // Chamar a função que realmente inicia o slideshow
            if (window.deParaUI) {
                window.deParaUI.startSlideshowFromModal();
            } else {
                // Fallback para função global
                startSlideshow();
            }
        };

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
    const isWindows = navigator.userAgent.indexOf('Windows') > -1;
    // No navegador, não temos acesso direto às variáveis de ambiente
    // Vamos usar valores padrão mais inteligentes baseados na plataforma
    const userName = isWindows ? 'User' : 'user';

    // Mapeamento de caminhos dinâmicos
    const pathMappings = {
        'dynamic-home': isWindows ? `C:\\Users\\${userName}` : `/home/${userName}`,
        'dynamic-documents': isWindows ? `C:\\Users\\${userName}\\Documents` : `/home/${userName}/Documents`,
        'dynamic-downloads': isWindows ? `C:\\Users\\${userName}\\Downloads` : `/home/${userName}/Downloads`,
        'dynamic-pictures': isWindows ? `C:\\Users\\${userName}\\Pictures` : `/home/${userName}/Pictures`,
        'dynamic-desktop': isWindows ? `C:\\Users\\${userName}\\Desktop` : `/home/${userName}/Desktop`,
        'dynamic-pictures-placeholder': isWindows ? `C:\\Users\\${userName}\\Pictures` : `/home/${userName}/Pictures`
    };

    // Substituir data-path dos botões
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
        slideshowInput.value = pathMappings['dynamic-pictures-placeholder'];
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

        console.log(`🔄 Executando operação: ${action}`, { sourcePath, destPath, options });

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

// Atualizar caminhos baseados na plataforma (versão simplificada)
function updateSimplePaths() {
    const isWindows = navigator.userAgent.indexOf('Windows') > -1;
    const userName = 'user'; // Valor padrão simples

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

// Inicializar caminhos quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    updateSimplePaths();
});

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
