#!/bin/bash

set -euo pipefail

APP_DIR="${1:-$HOME/DePara}"
DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$DESKTOP_DIR/depara.desktop"
ICON_DIR="$HOME/.local/share/icons/hicolor/192x192/apps"
ICON_FILE="$ICON_DIR/depara.png"

echo "Atualizando atalho do DePara no menu desktop..."

if [ ! -d "$APP_DIR" ]; then
  echo "Diretorio da aplicacao nao encontrado: $APP_DIR"
  exit 1
fi

mkdir -p "$DESKTOP_DIR"
mkdir -p "$ICON_DIR"

if [ -f "$APP_DIR/src/public/favicon/android-chrome-192x192.png" ]; then
  cp "$APP_DIR/src/public/favicon/android-chrome-192x192.png" "$ICON_FILE"
elif [ -f "$APP_DIR/src/public/favicon/favicon-32x32.png" ]; then
  cp "$APP_DIR/src/public/favicon/favicon-32x32.png" "$ICON_FILE"
else
  echo "Icone PNG nao encontrado em $APP_DIR/src/public/favicon"
  exit 1
fi

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=DePara
Comment=DePara - Operacoes de Arquivos e Agendamentos
Exec=$APP_DIR/start-depara.sh open
Icon=depara
Terminal=false
StartupNotify=true
Categories=Utility;FileTools;System;
Keywords=files;sync;backup;schedule;
StartupWMClass=DePara
EOF

chmod +x "$DESKTOP_FILE"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DESKTOP_DIR" || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "$HOME/.local/share/icons" || true
fi

echo "Atalho atualizado:"
echo "  Desktop file: $DESKTOP_FILE"
echo "  Icone: $ICON_FILE"
