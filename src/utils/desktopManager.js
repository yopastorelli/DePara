/**
 * Gerenciador de arquivo .desktop
 * 
 * @author yopastorelli
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('./logger');

class DesktopManager {
    constructor() {
        this.homePath = process.env.HOME || `/home/${process.env.USER || 'pi'}`;
        this.desktopPath = path.join(this.homePath, '.local/share/applications');
        this.desktopFile = path.join(this.desktopPath, 'depara.desktop');
        this.appPath = process.cwd();
        this.iconSourcePng = path.join(this.appPath, 'src/public/favicon/android-chrome-192x192.png');
        this.iconSourceSvg = path.join(this.appPath, 'src/public/logos/depara_logo_icon.svg');
        this.iconPath = this.iconSourcePng;
        this.iconThemeDir = path.join(this.homePath, '.local/share/icons/hicolor/192x192/apps');
        this.iconThemePath = path.join(this.iconThemeDir, 'depara.png');
    }

    /**
     * Detectar navegador disponível
     */
    async detectBrowser() {
        return new Promise((resolve) => {
            const browsers = [
                {
                    name: 'chromium',
                    binary: 'chromium',
                    cmd: 'chromium --new-window --app=http://localhost:3000 --no-first-run --no-default-browser-check'
                },
                {
                    name: 'chromium-browser',
                    binary: 'chromium-browser',
                    cmd: 'chromium-browser --new-window --app=http://localhost:3000 --no-first-run --no-default-browser-check'
                },
                {
                    name: 'google-chrome',
                    binary: 'google-chrome',
                    cmd: 'google-chrome --new-window --app=http://localhost:3000 --no-first-run --no-default-browser-check'
                },
                {
                    name: 'firefox',
                    binary: 'firefox',
                    cmd: 'firefox --new-window http://localhost:3000'
                },
                {
                    name: 'xdg-open',
                    binary: 'xdg-open',
                    cmd: 'xdg-open http://localhost:3000'
                }
            ];

            let found = false;
            let index = 0;

            const checkNext = () => {
                if (index >= browsers.length) {
                    resolve(null);
                    return;
                }

                const browser = browsers[index];
                exec(`which ${browser.binary}`, (error, stdout) => {
                    if (!error && stdout.trim() !== '' && !found) {
                        found = true;
                        resolve(browser);
                    } else {
                        index++;
                        checkNext();
                    }
                });
            };

            checkNext();
        });
    }

    /**
     * Instalar icone em tema local do usuario para o menu do desktop.
     */
    installMenuIcon() {
        try {
            if (!fs.existsSync(this.iconThemeDir)) {
                fs.mkdirSync(this.iconThemeDir, { recursive: true });
            }

            if (fs.existsSync(this.iconSourcePng)) {
                fs.copyFileSync(this.iconSourcePng, this.iconThemePath);
                return { iconName: 'depara', iconPath: this.iconThemePath };
            }

            if (fs.existsSync(this.iconSourceSvg)) {
                return { iconName: this.iconSourceSvg, iconPath: this.iconSourceSvg };
            }

            return { iconName: 'applications-utilities', iconPath: 'applications-utilities' };
        } catch (error) {
            logger.warn('Falha ao instalar ícone local, usando fallback', { error: error.message });
            return { iconName: 'applications-utilities', iconPath: 'applications-utilities' };
        }
    }

    /**
     * Criar arquivo .desktop
     */
    async createDesktopFile() {
        try {
            logger.info('🖥️ Criando arquivo .desktop...');

        // Detectar navegador
        const browser = await this.detectBrowser();
        if (!browser) {
            throw new Error('Nenhum navegador compatível encontrado');
        }

        // Criar diretório se não existir
        if (!fs.existsSync(this.desktopPath)) {
            fs.mkdirSync(this.desktopPath, { recursive: true });
        }

        // Instalar ícone local para aparecer corretamente no menu.
        const iconInfo = this.installMenuIcon();

        // Conteúdo do arquivo .desktop com comando correto para janela dedicada
        const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=DePara - Sistema de Sincronização de Arquivos
Exec=${browser.cmd}
Icon=${iconInfo.iconName}
Terminal=false
StartupNotify=true
Categories=Utility;FileTools;System;
Keywords=files;sync;backup;
StartupWMClass=DePara
NoDisplay=false
Hidden=false
`;

            // Escrever arquivo
            fs.writeFileSync(this.desktopFile, desktopContent);

            // Tornar executável
            fs.chmodSync(this.desktopFile, '755');

            // Atualizar banco de dados
            await this.updateDesktopDatabase();
            await this.updateIconCache();

            logger.info('✅ Arquivo .desktop criado com sucesso');
            return {
                success: true,
                browser: browser.name,
                iconPath: iconInfo.iconPath,
                desktopFile: this.desktopFile
            };

        } catch (error) {
            logger.operationError('Desktop Manager Create', error);
            throw error;
        }
    }

    /**
     * Atualizar banco de dados de aplicações
     */
    async updateDesktopDatabase() {
        return new Promise((resolve, reject) => {
            const cmd = `update-desktop-database "${this.desktopPath}"`;
            exec(cmd, (error) => {
                if (error) {
                    logger.warn('Erro ao atualizar banco de dados de aplicações', { error: error.message });
                } else {
                    logger.info('Banco de dados de aplicações atualizado');
                }
                resolve();
            });
        });
    }

    /**
     * Atualizar cache de ícones
     */
    async updateIconCache() {
        return new Promise((resolve, reject) => {
            const iconsRoot = path.join(this.homePath, '.local/share/icons');
            const cmd = `gtk-update-icon-cache -f -t "${iconsRoot}"`;
            exec(cmd, (error) => {
                if (error) {
                    logger.warn('Erro ao atualizar cache de ícones', { error: error.message });
                } else {
                    logger.info('Cache de ícones atualizado');
                }
                resolve();
            });
        });
    }

    /**
     * Verificar se arquivo .desktop existe
     */
    exists() {
        return fs.existsSync(this.desktopFile);
    }

    /**
     * Remover arquivo .desktop
     */
    remove() {
        try {
            if (fs.existsSync(this.desktopFile)) {
                fs.unlinkSync(this.desktopFile);
                logger.info('✅ Arquivo .desktop removido');
                return true;
            }
            return false;
        } catch (error) {
            logger.operationError('Desktop Manager Remove', error);
            return false;
        }
    }

    /**
     * Obter informações do arquivo .desktop
     */
    getInfo() {
        try {
            if (!this.exists()) {
                return null;
            }

            const content = fs.readFileSync(this.desktopFile, 'utf8');
            const lines = content.split('\n');
            const info = {};

            lines.forEach(line => {
                if (line.includes('=')) {
                    const [key, value] = line.split('=', 2);
                    info[key.trim()] = value.trim();
                }
            });

            return info;
        } catch (error) {
            logger.operationError('Desktop Manager Get Info', error);
            return null;
        }
    }
}

module.exports = DesktopManager;
