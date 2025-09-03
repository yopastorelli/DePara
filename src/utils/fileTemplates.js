/**
 * Templates Pré-configurados para Operações de Arquivos
 * Cenários comuns de uso para facilitar a configuração
 *
 * @author yopastorelli
 * @version 2.0.0
 */

const fileTemplates = {
    // Templates de backup
    backup: {
        daily: {
            name: 'Backup Diário',
            description: 'Faz backup diário de arquivos importantes',
            config: {
                frequency: '1d',
                action: 'copy',
                sourcePath: '/dados/importantes',
                targetPath: '/backup/diario',
                options: {
                    batch: true,
                    addTimestamp: true,
                    filters: {
                        extensions: ['txt', 'csv', 'json', 'xml']
                    }
                }
            }
        },
        hourly: {
            name: 'Backup por Hora',
            description: 'Backup frequente para arquivos críticos',
            config: {
                frequency: '1h',
                action: 'copy',
                sourcePath: '/dados/criticos',
                targetPath: '/backup/horario',
                options: {
                    batch: true,
                    addTimestamp: true,
                    suffix: '_backup'
                }
            }
        }
    },

    // Templates de limpeza
    cleanup: {
        temp_files: {
            name: 'Limpeza de Arquivos Temporários',
            description: 'Remove arquivos temporários antigos',
            config: {
                frequency: '6h',
                action: 'delete',
                sourcePath: '/temp',
                options: {
                    batch: true,
                    filters: {
                        extensions: ['tmp', 'temp', 'log'],
                        minAge: 86400 // 24 horas em segundos
                    }
                }
            }
        },
        old_logs: {
            name: 'Limpeza de Logs Antigos',
            description: 'Remove arquivos de log com mais de 7 dias',
            config: {
                frequency: '1d',
                action: 'delete',
                sourcePath: '/logs',
                options: {
                    batch: true,
                    filters: {
                        extensions: ['log'],
                        minAge: 604800 // 7 dias em segundos
                    }
                }
            }
        }
    },

    // Templates de organização
    organize: {
        by_type: {
            name: 'Organizar por Tipo',
            description: 'Move arquivos para pastas organizadas por extensão',
            config: {
                frequency: 'realtime',
                action: 'move',
                sourcePath: '/downloads',
                targetPath: '/downloads', // Será determinado dinamicamente
                options: {
                    batch: true,
                    organizeByType: true,
                    typeMappings: {
                        'pdf': '/downloads/documentos',
                        'doc': '/downloads/documentos',
                        'docx': '/downloads/documentos',
                        'txt': '/downloads/textos',
                        'jpg': '/downloads/imagens',
                        'png': '/downloads/imagens',
                        'gif': '/downloads/imagens',
                        'mp4': '/downloads/videos',
                        'mp3': '/downloads/audio',
                        'zip': '/downloads/compactados',
                        'rar': '/downloads/compactados'
                    }
                }
            }
        },
        by_date: {
            name: 'Organizar por Data',
            description: 'Move arquivos para pastas organizadas por data de criação',
            config: {
                frequency: '1d',
                action: 'move',
                sourcePath: '/arquivos',
                targetPath: '/arquivos', // Será determinado dinamicamente
                options: {
                    batch: true,
                    organizeByDate: true,
                    dateFormat: 'YYYY/MM/DD'
                }
            }
        }
    },

    // Templates de sincronização
    sync: {
        mirror_folders: {
            name: 'Espelhamento de Pastas',
            description: 'Mantém duas pastas sincronizadas',
            config: {
                frequency: '5m',
                action: 'copy',
                sourcePath: '/origem',
                targetPath: '/destino',
                options: {
                    batch: true,
                    mirrorMode: true,
                    overwrite: true
                }
            }
        },
        incremental_backup: {
            name: 'Backup Incremental',
            description: 'Copia apenas arquivos modificados',
            config: {
                frequency: '15m',
                action: 'copy',
                sourcePath: '/dados',
                targetPath: '/backup/incremental',
                options: {
                    batch: true,
                    incremental: true,
                    addTimestamp: true
                }
            }
        }
    },

    // Templates de processamento
    processing: {
        data_import: {
            name: 'Importação de Dados',
            description: 'Move arquivos CSV para processamento',
            config: {
                frequency: '10m',
                action: 'move',
                sourcePath: '/uploads',
                targetPath: '/processamento',
                options: {
                    batch: true,
                    filters: {
                        extensions: ['csv', 'xlsx', 'json']
                    },
                    addTimestamp: true
                }
            }
        },
        archive_old: {
            name: 'Arquivar Antigos',
            description: 'Move arquivos antigos para arquivo morto',
            config: {
                frequency: '1d',
                action: 'move',
                sourcePath: '/ativos',
                targetPath: '/arquivo_morto',
                options: {
                    batch: true,
                    filters: {
                        minAge: 2592000 // 30 dias
                    },
                    addTimestamp: true,
                    suffix: '_arquivado'
                }
            }
        }
    }
};

/**
 * Obtém template por categoria e nome
 */
function getTemplate(category, name) {
    if (fileTemplates[category] && fileTemplates[category][name]) {
        return {
            ...fileTemplates[category][name],
            category,
            templateName: name
        };
    }
    return null;
}

/**
 * Lista todos os templates disponíveis
 */
function getAllTemplates() {
    const templates = [];

    for (const [category, categoryTemplates] of Object.entries(fileTemplates)) {
        for (const [name, template] of Object.entries(categoryTemplates)) {
            templates.push({
                ...template,
                category,
                templateName: name
            });
        }
    }

    return templates;
}

/**
 * Lista templates por categoria
 */
function getTemplatesByCategory(category) {
    if (!fileTemplates[category]) {
        return [];
    }

    const templates = [];
    for (const [name, template] of Object.entries(fileTemplates[category])) {
        templates.push({
            ...template,
            category,
            templateName: name
        });
    }

    return templates;
}

/**
 * Cria configuração personalizada baseada em template
 */
function customizeTemplate(category, name, customizations = {}) {
    const template = getTemplate(category, name);
    if (!template) {
        throw new Error(`Template não encontrado: ${category}/${name}`);
    }

    // Mesclar customizações com configuração do template
    const customizedConfig = {
        ...template.config,
        ...customizations,
        options: {
            ...template.config.options,
            ...customizations.options
        }
    };

    return {
        ...template,
        config: customizedConfig,
        customized: true
    };
}

/**
 * Lista categorias disponíveis
 */
function getCategories() {
    const categories = [];
    const categoryInfo = {
        backup: {
            title: '💾 Backup e Segurança',
            description: 'Templates para criar backups automáticos de arquivos importantes',
            icon: 'backup'
        },
        cleanup: {
            title: '🧹 Limpeza e Manutenção',
            description: 'Templates para limpeza automática de arquivos temporários e antigos',
            icon: 'cleaning_services'
        },
        organization: {
            title: '📁 Organização de Arquivos',
            description: 'Templates para organizar e mover arquivos automaticamente',
            icon: 'folder'
        },
        monitoring: {
            title: '📊 Monitoramento',
            description: 'Templates para monitorar mudanças em diretórios',
            icon: 'monitoring'
        }
    };

    Object.keys(fileTemplates).forEach(key => {
        if (categoryInfo[key]) {
            categories.push({
                id: key,
                ...categoryInfo[key],
                templateCount: Object.keys(fileTemplates[key]).length
            });
        }
    });

    return categories;
}

/**
 * Obtém informações detalhadas sobre uma categoria
 */
function getCategoryInfo(category) {
    const templates = getTemplatesByCategory(category);
    const descriptions = {
        backup: {
            title: '💾 Backup e Segurança',
            description: 'Templates para criar backups automáticos de arquivos importantes',
            icon: 'backup'
        },
        cleanup: {
            title: '🧹 Limpeza e Manutenção',
            description: 'Templates para limpeza automática de arquivos temporários e antigos',
            icon: 'cleaning_services'
        },
        organize: {
            title: '📁 Organização',
            description: 'Templates para organizar arquivos automaticamente por tipo ou data',
            icon: 'folder'
        },
        sync: {
            title: '🔄 Sincronização',
            description: 'Templates para manter pastas sincronizadas',
            icon: 'sync'
        },
        processing: {
            title: '⚙️ Processamento',
            description: 'Templates para processamento automático de dados',
            icon: 'settings'
        }
    };

    return {
        category,
        templatesCount: templates.length,
        templates,
        ...(descriptions[category] || {
            title: category,
            description: `Templates da categoria ${category}`,
            icon: 'category'
        })
    };
}

module.exports = {
    getTemplate,
    getAllTemplates,
    getTemplatesByCategory,
    customizeTemplate,
    getCategories,
    getCategoryInfo,
    templates: fileTemplates
};
