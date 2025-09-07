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
        this.desktopPath = path.join(process.env.HOME || '/home/yo', '.local/share/applications');
        this.desktopFile = path.join(this.desktopPath, 'depara.desktop');
        this.appPath = process.cwd();
        this.iconPath = path.join(this.appPath, 'src/public/logos/depara_logo_icon.svg');
    }

    /**
     * Detectar navegador disponível
     */
    async detectBrowser() {
        return new Promise((resolve) => {
            const browsers = [
                { name: 'firefox', cmd: 'firefox --new-window --app=http://localhost:3000' },
                { name: 'chromium-browser', cmd: 'chromium-browser --new-window --app=http://localhost:3000' },
                { name: 'google-chrome', cmd: 'google-chrome --new-window --app=http://localhost:3000' },
                { name: 'firefox-fallback', cmd: 'firefox http://localhost:3000' },
                { name: 'chromium-fallback', cmd: 'chromium-browser http://localhost:3000' }
            ];

            let found = false;
            let index = 0;

            const checkNext = () => {
                if (index >= browsers.length) {
                    resolve(null);
                    return;
                }

                const browser = browsers[index];
                exec(`which ${browser.name}`, (error, stdout) => {
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

        // Verificar se ícone existe
        const iconExists = fs.existsSync(this.iconPath);
        const iconPath = iconExists ? this.iconPath : 'applications-utilities';

        // Conteúdo do arquivo .desktop com comando correto para janela dedicada
        const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=DePara - Sistema de Sincronização de Arquivos
Exec=${browser.cmd}
Icon=${iconPath}
Terminal=false
StartupNotify=true
Categories=Utility;FileTools;
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

            logger.info('✅ Arquivo .desktop criado com sucesso');
            return {
                success: true,
                browser: browser.name,
                iconPath: iconPath,
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
            exec('update-desktop-database /home/yo/.local/share/applications', (error, stdout, stderr) => {
                if (error) {
                    logger.warn('⚠️ Erro ao atualizar banco de dados:', error.message);
                } else {
                    logger.info('✅ Banco de dados de aplicações atualizado');
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
            exec('gtk-update-icon-cache -f -t /home/yo/.local/share/icons', (error, stdout, stderr) => {
                if (error) {
                    logger.warn('⚠️ Erro ao atualizar cache de ícones:', error.message);
                } else {
                    logger.info('✅ Cache de ícones atualizado');
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
