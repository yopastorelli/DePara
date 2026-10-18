const fs = require('fs').promises;
const path = require('path');

const logger = require('./logger');
const { getRuntimeDataDir } = require('./runtimePaths');
const { readJsonWithRecovery, writeJsonAtomic } = require('./atomicStore');

function getDefaultWorkflows() {
  return [
    {
      id: '1',
      name: 'Processamento de Documentos',
      description: 'Processa documentos diariamente',
      steps: [],
      createdAt: new Date().toISOString(),
      status: 'active'
    },
    {
      id: '2',
      name: 'Backup Semanal',
      description: 'Realiza backup semanal dos arquivos',
      steps: [],
      createdAt: new Date().toISOString(),
      status: 'active'
    }
  ];
}

class WorkflowStore {
  constructor() {
    this.filePath = path.join(getRuntimeDataDir(), 'workflows.json');
    this.workflows = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const stored = await readJsonWithRecovery(this.filePath, null);
    if (stored === null) {
      this.workflows = getDefaultWorkflows();
      await this.save();
    } else if (!Array.isArray(stored)) {
      throw new Error('Persistência de workflows deve ser um array');
    } else {
      this.workflows = stored;
    }
    this.initialized = true;
  }

  async save() {
    await writeJsonAtomic(this.filePath, this.workflows);
  }

  async list() {
    await this.init();
    return this.workflows;
  }

  async create(data) {
    await this.init();
    const workflow = {
      id: data.id || `workflow_${Date.now()}`,
      name: data.name,
      description: data.description,
      steps: Array.isArray(data.steps) ? data.steps : [],
      createdAt: data.createdAt || new Date().toISOString(),
      status: data.status || 'active'
    };
    this.workflows.push(workflow);
    await this.save();
    logger.info(`Workflow persistido: ${workflow.id}`);
    return workflow;
  }

  async update(id, updates) {
    await this.init();
    const index = this.workflows.findIndex((workflow) => workflow.id === id);
    if (index === -1) throw new Error(`Workflow não encontrado: ${id}`);
    this.workflows[index] = {
      ...this.workflows[index],
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };
    await this.save();
    return this.workflows[index];
  }

  async remove(id) {
    await this.init();
    const index = this.workflows.findIndex((workflow) => workflow.id === id);
    if (index === -1) throw new Error(`Workflow não encontrado: ${id}`);
    const [removed] = this.workflows.splice(index, 1);
    await this.save();
    return removed;
  }

  async replace(workflows = []) {
    if (!Array.isArray(workflows)) throw new Error('Workflows deve ser um array');
    await this.init();
    this.workflows = workflows;
    await this.save();
    return this.workflows;
  }
}

module.exports = new WorkflowStore();
