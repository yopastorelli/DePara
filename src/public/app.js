// DePara Web Interface - JavaScript
// @author yopastorelli
// @version 2.0.0

class DeParaUI {
    constructor() {
        this.currentTab = 'dashboard';
        this.workflows = [];
        this.folders = [];
        this.settings = {};
        this.currentWorkflowStep = 1;
        this.init();
    }

    async init() {
        console.log('🚀 Inicializando DePara UI...');

        try {
            // Configurar event listeners primeiro
            this.setupEventListeners();
            console.log('✅ Event listeners configurados');

            // Inicializar cache
            this.initializeCache();
            console.log('✅ Cache inicializado');

            // Carregar configurações
            await this.loadSettings();
            console.log('✅ Configurações carregadas');

            // Carregar pastas
            await this.loadFolders();
            console.log('✅ Pastas carregadas');

            // Carregar workflows
            await this.loadWorkflows();
            console.log('✅ Workflows carregados');

            // Iniciar monitoramento
            this.startMonitoring();
            console.log('✅ Monitoramento iniciado');

            // Testar conexão com API
            const apiOnline = await this.testApiConnection();
            if (apiOnline) {
                this.showToast('DePara iniciado com sucesso!', 'success');
                console.log('✅ API conectada');
            } else {
                this.showToast('API não está respondendo. Verifique se o servidor está rodando.', 'warning');
                console.log('⚠️ API offline');
            }

            // Iniciar monitoramento do status da API
            this.updateApiStatus();
            setInterval(() => this.updateApiStatus(), 30000);
            console.log('✅ Status da API sendo monitorado');

            // Iniciar auto-refresh da dashboard
            this.startDashboardAutoRefresh();
            console.log('✅ Auto-refresh da dashboard iniciado');

            // Inicializar gráficos
            this.initializeCharts();
            console.log('✅ Gráficos inicializados');

            // Configurar atalhos de teclado
            this.setupKeyboardShortcuts();
            console.log('✅ Atalhos de teclado configurados');

            // Forçar atualização inicial da dashboard
            await this.updateDashboard();
            console.log('✅ Dashboard atualizada');

            // Mostrar onboarding se necessário
            if (!localStorage.getItem('depara-onboarding-completed')) {
                setTimeout(() => this.showOnboarding(), 1000);
            }

            console.log('🎉 Inicialização completa!');

        } catch (error) {
            console.error('❌ Erro durante inicialização:', error);
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
                        <button onclick="this.closest('div').parentElement.remove(); window.quickSetupResolve(false);" style="background: #757575; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            ❌ Cancelar
                        </button>
                        <button onclick="this.closest('div').parentElement.remove(); window.quickSetupResolve(true);" style="background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            ✅ Aprovar e Continuar
                        </button>
                    </div>
                </div>
            `;

            // Armazenar função de resolução
            window.quickSetupResolve = resolve;

            document.body.appendChild(modal);
        });
    }

    // Criar pastas padrão automaticamente
    async createDefaultFolders() {
        const defaultFolders = [
            { name: 'Documentos Entrada', path: '/home/pi/Documents/Entrada', type: 'source', format: 'any' },
            { name: 'Documentos Processados', path: '/home/pi/Documents/Processados', type: 'target', format: 'any' },
            { name: 'Backup Automático', path: '/home/pi/Documents/Backup', type: 'target', format: 'any' }
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
                source: '/home/pi/Documents/Entrada',
                target: '/home/pi/Documents/Backup',
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
                    <button onclick="this.closest('div').parentElement.remove()" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        🎯 Começar a Usar!
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Sistema de configuração rápida de pastas
    async createQuickFolder(type) {
        console.log(`🚀 Iniciando criação de pastas do tipo: ${type}`);

        const folderSets = {
            documents: [
                { name: 'Documentos Entrada', path: '/home/pi/Documents/Entrada', type: 'source', format: 'any' },
                { name: 'Documentos Processados', path: '/home/pi/Documents/Processados', type: 'target', format: 'any' }
            ],
            backup: [
                { name: 'Backup Diário', path: '/home/pi/Backup/Diario', type: 'target', format: 'any' },
                { name: 'Backup Semanal', path: '/home/pi/Backup/Semanal', type: 'target', format: 'any' }
            ],
            media: [
                { name: 'Fotos', path: '/home/pi/Media/Fotos', type: 'source', format: 'any' },
                { name: 'Vídeos', path: '/home/pi/Media/Videos', type: 'source', format: 'any' }
            ],
            temp: [
                { name: 'Processamento', path: '/home/pi/Temp/Processamento', type: 'temp', format: 'any' },
                { name: 'Lixeira', path: '/home/pi/Temp/Lixeira', type: 'trash', format: 'any' }
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

        const templateSets = {
            documents: [
                {
                    name: 'Backup Documentos',
                    description: 'Faz backup diário de documentos importantes',
                    action: 'copy',
                    sourcePath: '/home/pi/Documents/Entrada',
                    targetPath: '/home/pi/Documents/Processados',
                    frequency: '1d',
                    options: { batch: true, backupBeforeMove: false }
                }
            ],
            backup: [
                {
                    name: 'Backup Diário',
                    description: 'Backup automático diário',
                    action: 'copy',
                    sourcePath: '/home/pi/Documents',
                    targetPath: '/home/pi/Backup/Diario',
                    frequency: '1d',
                    options: { batch: true, backupBeforeMove: true }
                },
                {
                    name: 'Backup Semanal',
                    description: 'Backup completo semanal',
                    action: 'copy',
                    sourcePath: '/home/pi/Documents',
                    targetPath: '/home/pi/Backup/Semanal',
                    frequency: '1w',
                    options: { batch: true, backupBeforeMove: true }
                }
            ],
            media: [
                {
                    name: 'Organizar Fotos',
                    description: 'Move fotos para pasta organizada',
                    action: 'move',
                    sourcePath: '/home/pi/Media/Fotos',
                    targetPath: '/home/pi/Media/Organizadas/Fotos',
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
                        <button onclick="editFolder('${folder.id}')" class="btn-icon">
                            <span class="material-icons">edit</span>
                        </button>
                        <button onclick="deleteFolder('${folder.id}')" class="btn-icon danger">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                </div>
            `).join('');
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
                this.renderFolders();
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
                    <button class="edit-btn" onclick="ui.editWorkflow('${workflow.id}')">
                        <span class="material-icons">edit</span>
                        Editar
                    </button>
                    <button class="toggle-btn" onclick="ui.toggleWorkflow('${workflow.id}')">
                        <span class="material-icons">${workflow.status === 'active' ? 'pause' : 'play_arrow'}</span>
                        ${workflow.status === 'active' ? 'Pausar' : 'Ativar'}
                    </button>
                    <button class="delete-btn" onclick="ui.deleteWorkflow('${workflow.id}')">
                        <span class="material-icons">delete</span>
                        Excluir
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadFolders() {
        try {
            console.log('🔍 Carregando pastas da API...');
            const response = await fetch('/api/files/folders');
            if (response.ok) {
                const result = await response.json();
                this.folders = result.data || [];
                console.log('✅ Pastas carregadas:', this.folders);
                this.renderFolders();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar pastas:', error);
            this.folders = [];
            this.renderFolders();
        }
    }

    renderFolders() {
        const foldersList = document.getElementById('folders-list');

        if (!foldersList) {
            console.warn('⚠️ Elemento folders-list não encontrado');
            return;
        }

        console.log('🎨 Renderizando pastas:', this.folders);

        if (this.folders.length === 0) {
            foldersList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">folder_open</span>
                    <p>Nenhuma pasta configurada</p>
                    <small>Use a configuração rápida acima ou crie manualmente</small>
                </div>
            `;
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
    }

    // Adicionar event listeners para botões de ação (evita CSP violation)
    addActionButtonListeners() {
        // Botão mover arquivo
        const moveBtn = document.querySelector('.action-move-btn');
        if (moveBtn) {
            moveBtn.addEventListener('click', () => {
                this.showFileOperationModal('move');
            });
        }

        // Botão copiar arquivo
        const copyBtn = document.querySelector('.action-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.showFileOperationModal('copy');
            });
        }

        // Botão deletar arquivo
        const deleteBtn = document.querySelector('.action-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.showFileOperationModal('delete');
            });
        }

        // Botão agendar operação
        const scheduleBtn = document.querySelector('.action-schedule-btn');
        if (scheduleBtn) {
            scheduleBtn.addEventListener('click', () => {
                this.showScheduleModal();
            });
        }

        // Botão slideshow
        const slideshowBtn = document.querySelector('.action-slideshow-btn');
        if (slideshowBtn) {
            slideshowBtn.addEventListener('click', () => {
                this.showSlideshowModal();
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
                this.loadFolders();
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
                preserveStructure
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

    // Reset form
    document.getElementById('schedule-name').value = '';
    document.getElementById('schedule-action').value = '';
    document.getElementById('schedule-frequency').value = '';
    document.getElementById('schedule-source').value = '';
    document.getElementById('schedule-target').value = '';
    document.getElementById('schedule-filters').value = '';
    document.getElementById('schedule-batch').checked = true;
    document.getElementById('schedule-backup').checked = false;

    updateScheduleForm();

    modal.style.display = 'flex';
}

function closeScheduleModal() {
    document.getElementById('schedule-modal').style.display = 'none';
}

function updateScheduleForm() {
    const action = document.getElementById('schedule-action').value;
    const targetGroup = document.getElementById('schedule-target-group');

    if (action === 'delete') {
        targetGroup.style.display = 'none';
    } else {
        targetGroup.style.display = 'block';
    }
}

async function scheduleOperation() {
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
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }

    if ((action === 'move' || action === 'copy') && !targetPath) {
        showToast('Caminho de destino é obrigatório', 'error');
        return;
    }

    try {
        const requestData = {
            operationId: `ui_${Date.now()}`,
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

        const response = await fetch('/api/files/schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (result.success) {
            const structureMsg = preserveStructure ? ' (estrutura preservada)' : ' (estrutura achatada)';
            showToast(`Operação "${name}" agendada com sucesso!${structureMsg}`, 'success', true);
            closeScheduleModal();
            loadScheduledOperations();
        } else {
            showToast(result.error?.message || 'Erro ao agendar operação', 'error', true);
        }

    } catch (error) {
        console.error('Erro ao agendar operação:', error);
        showToast('Erro ao agendar operação', 'error');
    }
}

// Load Templates
async function loadTemplates() {
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
        const result = await response.json();

        if (result.success) {
            renderProgress(result.data);
        }
    } catch (error) {
        console.error('Erro ao carregar progresso:', error);
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
    try {
        const response = await fetch('/api/files/scheduled');
        const result = await response.json();

        if (result.success) {
            renderScheduledOperations(result.data);
        }
    } catch (error) {
        console.error('Erro ao carregar operações agendadas:', error);
    }
}

function renderScheduledOperations(operations) {
    const container = document.getElementById('scheduled-operations-list');

    if (operations.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma operação agendada</p>';
        return;
    }

    container.innerHTML = operations.map(op => `
        <div class="operation-item ${op.active ? 'active' : 'paused'}">
            <div class="operation-info">
                <h4>${op.action.toUpperCase()} - ${op.frequency}</h4>
                <p><strong>Origem:</strong> ${op.sourcePath}</p>
                ${op.targetPath ? `<p><strong>Destino:</strong> ${op.targetPath}</p>` : ''}
                <p><strong>Status:</strong> ${op.active ? 'Ativa' : 'Pausada'}</p>
            </div>
            <div class="operation-actions">
                <button class="btn btn-sm btn-danger" onclick="cancelScheduledOperation('${op.id}')">
                    Cancelar
                </button>
            </div>
        </div>
    `).join('');
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

// Load Backups
async function loadBackups() {
    try {
        const response = await fetch('/api/files/backups');
        const result = await response.json();

        if (result.success) {
            renderBackups(result.data);
        }
    } catch (error) {
        console.error('Erro ao carregar backups:', error);
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
                    loadTemplates();
                    loadScheduledOperations();
                    loadBackups();
                }
            }
        });
    });

    observer.observe(fileopsTab, {
        attributes: true,
        attributeFilter: ['class']
    });

    // Load initial data
    setTimeout(() => {
        loadTemplates();
        loadScheduledOperations();
        loadBackups();
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
                    // Load data when tab becomes active
                    loadScheduledOperations();
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

    // Load initial data
    setTimeout(() => {
        loadScheduledOperations();
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
        showSystemNotification(title, message);
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

    // Focus no campo de pasta
    setTimeout(() => {
        document.getElementById('slideshow-folder-path').focus();
    }, 100);
}

function closeSlideshowFolderModal() {
    document.getElementById('slideshow-folder-modal').style.display = 'none';
    resetSlideshowFolderForm();
}

function resetSlideshowFolderForm() {
    document.getElementById('slideshow-folder-path').value = '';
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

        // Adicionar event listeners para botões (evita CSP violation)
        ui.addOnboardingEventListeners();
    }, 100);
});

// Adicionar animação CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
