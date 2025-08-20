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

    init() {
        this.setupEventListeners();
        this.loadSettings();
        this.loadFolders();
        this.loadWorkflows();
        this.startMonitoring();
        this.showToast('DePara iniciado com sucesso!', 'success');
        
        if (!localStorage.getItem('depara-onboarding-completed')) {
            setTimeout(() => this.showOnboarding(), 1000);
        }
    }

    // Sistema de Onboarding
    showOnboarding() {
        document.getElementById('onboarding-overlay').style.display = 'flex';
    }

    skipOnboarding() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');
    }

    startOnboarding() {
        document.getElementById('onboarding-overlay').style.display = 'none';
        localStorage.setItem('depara-onboarding-completed', 'true');
        this.openWorkflowConfig();
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
            const response = await fetch('/api/workflows');
            if (response.ok) {
                const result = await response.json();
                this.workflows = result.data || [];
                this.renderWorkflows();
            } else {
                throw new Error('Falha ao carregar fluxos de trabalho');
            }
        } catch (error) {
            console.error('Erro ao carregar fluxos de trabalho:', error);
            this.workflows = [];
            this.renderWorkflows();
        }
    }

    renderWorkflows() {
        const workflowsGrid = document.getElementById('workflows-grid');
        
        if (this.workflows.length === 0) {
            workflowsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                    <span class="material-icons" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">workflow</span>
                    <p>Nenhum fluxo de trabalho configurado</p>
                    <p>Clique em "Novo Fluxo" para começar</p>
                </div>
            `;
            return;
        }

        workflowsGrid.innerHTML = this.workflows.map(workflow => `
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
            const response = await fetch('/api/folders');
            if (response.ok) {
                const result = await response.json();
                this.folders = result.data || [];
                this.renderFolders();
            } else {
                throw new Error('Falha ao carregar pastas');
            }
        } catch (error) {
            console.error('Erro ao carregar pastas:', error);
            this.folders = [];
            this.renderFolders();
        }
    }

    renderFolders() {
        const foldersGrid = document.getElementById('folders-grid');
        
        if (this.folders.length === 0) {
            foldersGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                    <span class="material-icons" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">folder_open</span>
                    <p>Nenhuma pasta configurada</p>
                    <p>Clique em "Nova Pasta" para começar</p>
                </div>
            `;
            return;
        }

        foldersGrid.innerHTML = this.folders.map(folder => `
            <div class="folder-card">
                <div class="folder-header">
                    <div class="folder-name">${folder.name}</div>
                    <span class="folder-type ${folder.type}">${this.getFolderTypeLabel(folder.type)}</span>
                </div>
                <div class="folder-path">${folder.path}</div>
                <div class="folder-description">${folder.description || 'Sem descrição'}</div>
                <div class="folder-actions">
                    <button class="edit-btn" onclick="ui.editFolder('${folder.id}')">
                        <span class="material-icons">edit</span>
                        Editar
                    </button>
                    <button class="delete-btn" onclick="ui.deleteFolder('${folder.id}')">
                        <span class="material-icons">delete</span>
                        Excluir
                    </button>
                </div>
            </div>
        `).join('');
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

function convertData() {
    ui.convertData();
}

function generateMapping() {
    ui.generateMapping();
}

function saveSettings() {
    ui.saveSettings();
}

// Inicialização
let ui;
document.addEventListener('DOMContentLoaded', () => {
    ui = new DeParaUI();
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
