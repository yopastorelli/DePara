// DePara Web Interface - JavaScript
// @author yopastorelli
// @version 1.0.0

class DeParaUI {
    constructor() {
        this.currentTab = 'dashboard';
        this.folders = [];
        this.settings = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSettings();
        this.loadFolders();
        this.startMonitoring();
        this.showToast('DePara iniciado com sucesso!', 'success');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.closest('.nav-btn').dataset.tab);
            });
        });

        // File input
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });

        // Drag and drop for file upload
        const textarea = document.getElementById('conversion-data');
        textarea.addEventListener('dragover', (e) => {
            e.preventDefault();
            textarea.style.borderColor = '#667eea';
        });

        textarea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            textarea.style.borderColor = 'rgba(102, 126, 234, 0.2)';
        });

        textarea.addEventListener('drop', (e) => {
            e.preventDefault();
            textarea.style.borderColor = 'rgba(102, 126, 234, 0.2)';
            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleFileUpload(file);
            }
        });

        // NOVOS EVENT LISTENERS PARA CONFIGURAÇÃO DE PASTAS
        this.setupFolderConfigListeners();
    }

    setupFolderConfigListeners() {
        // Controle de exibição dos campos de frequência
        const autoProcessCheckbox = document.getElementById('auto-process');
        const frequencyGroup = document.getElementById('frequency-group');
        
        if (autoProcessCheckbox && frequencyGroup) {
            autoProcessCheckbox.addEventListener('change', (e) => {
                frequencyGroup.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        // Controle de exibição do campo cron personalizado
        const processingFrequency = document.getElementById('processing-frequency');
        const cronGroup = document.getElementById('cron-group');
        
        if (processingFrequency && cronGroup) {
            processingFrequency.addEventListener('change', (e) => {
                cronGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
            });
        }

        // Controle de exibição das extensões permitidas
        const processingRules = document.getElementById('processing-rules');
        const extensionGroup = document.getElementById('extension-group');
        
        if (processingRules && extensionGroup) {
            processingRules.addEventListener('change', (e) => {
                extensionGroup.style.display = e.target.value === 'extension' ? 'block' : 'none';
            });
        }
    }

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(tabName).classList.add('active');

        // Activate selected nav button
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        this.currentTab = tabName;

        // Load specific tab data
        switch (tabName) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'folders':
                this.loadFolders();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    async updateDashboard() {
        try {
            // Update system status
            const statusResponse = await fetch('/api/status/resources');
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                
                document.getElementById('memory-usage').textContent = 
                    `${Math.round(statusData.memory.used / 1024 / 1024)} MB / ${Math.round(statusData.memory.total / 1024 / 1024)} MB`;
                
                document.getElementById('disk-usage').textContent = 
                    `${Math.round(statusData.disk.used / 1024 / 1024)} GB / ${Math.round(statusData.disk.total / 1024 / 1024)} GB`;
            }

            // Update CPU temperature (Raspberry Pi specific)
            const tempResponse = await fetch('/api/status/performance');
            if (tempResponse.ok) {
                const tempData = await tempResponse.json();
                if (tempData.cpu && tempData.cpu.temperature) {
                    document.getElementById('cpu-temp').textContent = `${tempData.cpu.temperature}°C`;
                }
            }

            // Update recent activity
            this.updateRecentActivity();

        } catch (error) {
            console.error('Erro ao atualizar dashboard:', error);
        }
    }

    updateRecentActivity() {
        const activityList = document.getElementById('recent-activity');
        const activities = [
            { icon: 'folder', text: 'Pasta configurada: Dados_Entrada', time: '2 min atrás' },
            { icon: 'transform', text: 'Arquivo convertido: dados.csv → dados.json', time: '5 min atrás' },
            { icon: 'map', text: 'Mapeamento criado: nome → name', time: '10 min atrás' }
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
            this.showToast('Erro ao carregar pastas', 'error');
            // Fallback para dados mock se a API falhar
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
                    <span class="folder-type ${folder.type}">${this.getTypeLabel(folder.type)}</span>
                </div>
                <div class="folder-path">${folder.path}</div>
                <div class="folder-actions">
                    <button class="edit-btn" onclick="ui.editFolder(${folder.id})">
                        <span class="material-icons" style="font-size: 16px;">edit</span>
                        Editar
                    </button>
                    <button class="delete-btn" onclick="ui.deleteFolder(${folder.id})">
                        <span class="material-icons" style="font-size: 16px;">delete</span>
                        Excluir
                    </button>
                </div>
            </div>
        `).join('');
    }

    getTypeLabel(type) {
        const labels = {
            'input': 'Entrada',
            'output': 'Saída',
            'temp': 'Temporária'
        };
        return labels[type] || type;
    }

    openFolderConfig() {
        document.getElementById('folder-modal').style.display = 'flex';
        document.getElementById('folder-name').focus();
    }

    closeFolderModal() {
        document.getElementById('folder-modal').style.display = 'none';
        this.clearFolderForm();
    }

    clearFolderForm() {
        document.getElementById('folder-name').value = '';
        document.getElementById('folder-path').value = '';
        document.getElementById('folder-type').value = 'input';
        document.getElementById('folder-format').value = 'auto';
        document.getElementById('auto-process').checked = true;
    }

    resetFolderModal() {
        document.getElementById('folder-name').value = '';
        document.getElementById('folder-path').value = '';
        document.getElementById('folder-type').value = 'input';
        document.getElementById('folder-format').value = 'auto';
        document.getElementById('auto-process').checked = true;
        
        // RESETAR NOVOS CAMPOS
        document.getElementById('processing-frequency').value = 'realtime';
        document.getElementById('cron-expression').value = '';
        document.getElementById('processing-rules').value = 'all';
        document.getElementById('allowed-extensions').value = '';
        
        // Resetar transformações
        document.getElementById('transform-uppercase').checked = false;
        document.getElementById('transform-lowercase').checked = false;
        document.getElementById('transform-trim').checked = false;
        document.getElementById('transform-validate').checked = false;
        
        // Resetar configurações de saída
        document.getElementById('output-backup').checked = false;
        document.getElementById('output-log').checked = false;
        document.getElementById('output-notify').checked = false;
        
        // Ocultar campos condicionais
        document.getElementById('frequency-group').style.display = 'none';
        document.getElementById('cron-group').style.display = 'none';
        document.getElementById('extension-group').style.display = 'none';
        
        this.editingFolderId = null;
    }

    async saveFolder() {
        const name = document.getElementById('folder-name').value.trim();
        const path = document.getElementById('folder-path').value.trim();
        const type = document.getElementById('folder-type').value;
        const format = document.getElementById('folder-format').value;
        const autoProcess = document.getElementById('auto-process').checked;

        if (!name || !path) {
            this.showToast('Preencha todos os campos obrigatórios', 'warning');
            return;
        }

        // NOVOS CAMPOS DE CONFIGURAÇÃO
        const processingFrequency = document.getElementById('processing-frequency').value;
        const cronExpression = document.getElementById('cron-expression').value.trim();
        const processingRules = document.getElementById('processing-rules').value;
        const allowedExtensions = document.getElementById('allowed-extensions').value.trim();
        
        // Transformações
        const transformUppercase = document.getElementById('transform-uppercase').checked;
        const transformLowercase = document.getElementById('transform-lowercase').checked;
        const transformTrim = document.getElementById('transform-trim').checked;
        const transformValidate = document.getElementById('transform-validate').checked;
        
        // Configurações de saída
        const outputBackup = document.getElementById('output-backup').checked;
        const outputLog = document.getElementById('output-log').checked;
        const outputNotify = document.getElementById('output-notify').checked;

        // Validações adicionais
        if (autoProcess && processingFrequency === 'custom' && !cronExpression) {
            this.showToast('Expressão cron é obrigatória para frequência personalizada', 'warning');
            return;
        }

        if (processingRules === 'extension' && !allowedExtensions) {
            this.showToast('Especifique as extensões permitidas', 'warning');
            return;
        }

        try {
            const folderData = {
                name,
                path,
                type,
                format,
                autoProcess,
                // NOVAS CONFIGURAÇÕES
                processing: {
                    frequency: processingFrequency,
                    cronExpression: processingFrequency === 'custom' ? cronExpression : null,
                    rules: processingRules,
                    allowedExtensions: processingRules === 'extension' ? allowedExtensions.split(',').map(ext => ext.trim()) : [],
                    transformations: {
                        uppercase: transformUppercase,
                        lowercase: transformLowercase,
                        trim: transformTrim,
                        validate: transformValidate
                    },
                    output: {
                        backup: outputBackup,
                        log: outputLog,
                        notify: outputNotify
                    }
                }
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
                this.closeFolderModal();
                this.showToast('Pasta configurada com sucesso!', 'success');

                // Switch to folders tab to show the new folder
                this.switchTab('folders');
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Erro ao salvar pasta');
            }

        } catch (error) {
            console.error('Erro ao salvar pasta:', error);
            this.showToast(`Erro ao salvar pasta: ${error.message}`, 'error');
        }
    }

    editFolder(id) {
        const folder = this.folders.find(f => f.id === id);
        if (!folder) return;

        document.getElementById('folder-name').value = folder.name;
        document.getElementById('folder-path').value = folder.path;
        document.getElementById('folder-type').value = folder.type;
        document.getElementById('folder-format').value = folder.format;
        document.getElementById('auto-process').checked = folder.autoProcess;

        // CARREGAR NOVOS CAMPOS DE CONFIGURAÇÃO
        if (folder.processing) {
            const processing = folder.processing;
            
            // Frequência
            if (processing.frequency) {
                document.getElementById('processing-frequency').value = processing.frequency;
                this.toggleFrequencyFields(processing.frequency);
            }
            
            // Cron personalizado
            if (processing.cronExpression) {
                document.getElementById('cron-expression').value = processing.cronExpression;
            }
            
            // Regras de processamento
            if (processing.rules) {
                document.getElementById('processing-rules').value = processing.rules;
                this.toggleProcessingRulesFields(processing.rules);
            }
            
            // Extensões permitidas
            if (processing.allowedExtensions && processing.allowedExtensions.length > 0) {
                document.getElementById('allowed-extensions').value = processing.allowedExtensions.join(', ');
            }
            
            // Transformações
            if (processing.transformations) {
                const transforms = processing.transformations;
                document.getElementById('transform-uppercase').checked = transforms.uppercase || false;
                document.getElementById('transform-lowercase').checked = transforms.lowercase || false;
                document.getElementById('transform-trim').checked = transforms.trim || false;
                document.getElementById('transform-validate').checked = transforms.validate || false;
            }
            
            // Configurações de saída
            if (processing.output) {
                const output = processing.output;
                document.getElementById('output-backup').checked = output.backup || false;
                document.getElementById('output-log').checked = output.log || false;
                document.getElementById('output-notify').checked = output.notify || false;
            }
        }

        document.getElementById('folder-modal').style.display = 'flex';
        // Store the folder being edited
        this.editingFolderId = id;
    }

    // NOVOS MÉTODOS AUXILIARES
    toggleFrequencyFields(frequency) {
        const cronGroup = document.getElementById('cron-group');
        if (cronGroup) {
            cronGroup.style.display = frequency === 'custom' ? 'block' : 'none';
        }
    }

    toggleProcessingRulesFields(rules) {
        const extensionGroup = document.getElementById('extension-group');
        if (extensionGroup) {
            extensionGroup.style.display = rules === 'extension' ? 'block' : 'none';
        }
    }

    async deleteFolder(id) {
        if (confirm('Tem certeza que deseja excluir esta pasta?')) {
            try {
                const response = await fetch(`/api/folders/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.folders = this.folders.filter(f => f.id !== id);
                    this.renderFolders();
                    this.showToast('Pasta excluída com sucesso!', 'success');
                } else {
                    const error = await response.json();
                    throw new Error(error.message || 'Erro ao excluir pasta');
                }
            } catch (error) {
                console.error('Erro ao excluir pasta:', error);
                this.showToast(`Erro ao excluir pasta: ${error.message}`, 'error');
            }
        }
    }

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

    async loadSettings() {
        try {
            // In a real implementation, this would fetch from the API
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
        document.getElementById('app-port').value = this.settings.port;
        document.getElementById('log-level').value = this.settings.logLevel;
        document.getElementById('environment').value = this.settings.environment;
        document.getElementById('log-directory').value = this.settings.logDirectory;
    }

    async saveSettings() {
        const settings = {
            port: parseInt(document.getElementById('app-port').value),
            logLevel: document.getElementById('log-level').value,
            environment: document.getElementById('environment').value,
            logDirectory: document.getElementById('log-directory').value
        };

        try {
            // In a real implementation, this would save to the API
            this.settings = settings;
            this.showToast('Configurações salvas com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            this.showToast('Erro ao salvar configurações', 'error');
        }
    }

    handleFileUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('conversion-data').value = e.target.result;
            this.showToast(`Arquivo "${file.name}" carregado com sucesso!`, 'success');
        };
        reader.readAsText(file);
    }

    startMonitoring() {
        // Update dashboard every 30 seconds
        setInterval(() => {
            if (this.currentTab === 'dashboard') {
                this.updateDashboard();
            }
        }, 30000);

        // Initial update
        this.updateDashboard();
    }

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
        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
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
}

// Global functions for onclick handlers
function openFolderConfig() {
    ui.openFolderConfig();
}

function closeFolderModal() {
    ui.closeFolderModal();
}

function saveFolder() {
    ui.saveFolder();
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

// Initialize the UI when the page loads
let ui;
document.addEventListener('DOMContentLoaded', () => {
    ui = new DeParaUI();
});

// Add slideOutRight animation to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
