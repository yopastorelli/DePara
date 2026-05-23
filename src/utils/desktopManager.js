/**
 * Gerenciador de arquivo .desktop
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
        this.repoRoot = path.resolve(__dirname, '..', '..');
        this.launcherPath = path.join(this.repoRoot, 'start-depara.sh');
        this.iconSourcePng = path.join(this.repoRoot, 'src/public/favicon/android-chrome-192x192.png');
        this.iconSourceSvg = path.join(this.repoRoot, 'src/public/logos/depara_logo_icon.svg');
        this.iconPath = this.iconSourcePng;
        this.iconThemeDir = path.join(this.homePath, '.local/share/icons/hicolor/192x192/apps');
        this.iconThemePath = path.join(this.iconThemeDir, 'depara.png');
    }

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
            logger.warn('Falha ao instalar icone local, usando fallback', { error: error.message });
            return { iconName: 'applications-utilities', iconPath: 'applications-utilities' };
        }
    }

    buildDesktopContent(iconName) {
        return `[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=Gerenciador de Arquivos e Operacoes
Exec=${this.launcherPath} open
Icon=${iconName}
Terminal=false
StartupNotify=true
Categories=Utility;FileManager;System;
Keywords=files;manager;sync;backup;
StartupWMClass=DePara
NoDisplay=false
Hidden=false
`;
    }

    async createDesktopFile() {
        try {
            logger.info('Criando arquivo .desktop canonico...');

            if (!fs.existsSync(this.desktopPath)) {
                fs.mkdirSync(this.desktopPath, { recursive: true });
            }

            const iconInfo = this.installMenuIcon();
            const desktopContent = this.buildDesktopContent(iconInfo.iconName);
            const currentContent = fs.existsSync(this.desktopFile)
                ? fs.readFileSync(this.desktopFile, 'utf8')
                : null;

            if (currentContent !== desktopContent) {
                fs.writeFileSync(this.desktopFile, desktopContent, 'utf8');
            }

            fs.chmodSync(this.desktopFile, 0o755);

            await this.updateDesktopDatabase();
            await this.updateIconCache();

            logger.info('Arquivo .desktop criado com sucesso');
            return {
                success: true,
                launcherPath: this.launcherPath,
                iconPath: iconInfo.iconPath,
                desktopFile: this.desktopFile
            };
        } catch (error) {
            logger.operationError('Desktop Manager Create', error);
            throw error;
        }
    }

    async updateDesktopDatabase() {
        return new Promise((resolve) => {
            const cmd = `update-desktop-database "${this.desktopPath}"`;
            exec(cmd, () => resolve());
        });
    }

    async updateIconCache() {
        return new Promise((resolve) => {
            const iconsRoot = path.join(this.homePath, '.local/share/icons');
            const cmd = `gtk-update-icon-cache -f -t "${iconsRoot}"`;
            exec(cmd, () => resolve());
        });
    }

    exists() {
        return fs.existsSync(this.desktopFile);
    }

    remove() {
        try {
            if (fs.existsSync(this.desktopFile)) {
                fs.unlinkSync(this.desktopFile);
                logger.info('Arquivo .desktop removido');
                return true;
            }
            return false;
        } catch (error) {
            logger.operationError('Desktop Manager Remove', error);
            return false;
        }
    }

    getInfo() {
        try {
            if (!this.exists()) {
                return null;
            }

            const content = fs.readFileSync(this.desktopFile, 'utf8');
            const lines = content.split('\n');
            const info = {};

            lines.forEach((line) => {
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
