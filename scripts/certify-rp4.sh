#!/bin/bash

set -euo pipefail

RUNTIME_ROOT="${DEPARA_RUNTIME_ROOT:-$HOME/.depara}"
CONFIG_ENV_PATH="${DEPARA_CONFIG_ENV_PATH:-$RUNTIME_ROOT/config.env}"
PM2_APP_NAME="${PM2_APP_NAME:-DePara}"

fail() {
    printf 'RP4_CERTIFICATION_FAIL: %s\n' "$1" >&2
    exit 1
}

read_config_value() {
    local key="$1"
    local default_value="$2"
    local value=""

    if [ -f "$CONFIG_ENV_PATH" ]; then
        value="$(grep -E "^${key}=" "$CONFIG_ENV_PATH" | tail -n 1 | cut -d '=' -f 2- || true)"
    fi

    printf '%s\n' "${value:-$default_value}"
}

case "$(uname -m)" in
    aarch64|arm64|armv7l|armv7*)
        ;;
    *)
        fail "arquitetura nao-RP4: $(uname -m)"
        ;;
esac

command -v node >/dev/null 2>&1 || fail 'node ausente'
command -v npm >/dev/null 2>&1 || fail 'npm ausente'
command -v pm2 >/dev/null 2>&1 || fail 'pm2 ausente'
command -v curl >/dev/null 2>&1 || fail 'curl ausente'

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" != '22' ] && [ "$NODE_MAJOR" != '24' ]; then
    fail "Node nao certificado: $(node --version)"
fi

[ -f "$CONFIG_ENV_PATH" ] || fail "config.env ausente: $CONFIG_ENV_PATH"
[ -f "$RUNTIME_ROOT/current/src/main.js" ] || fail 'wrapper da release ativa ausente'
[ -f "$RUNTIME_ROOT/current/release.json" ] || fail 'release.json ativo ausente'

for required_directory in data logs backups temp releases current; do
    [ -d "$RUNTIME_ROOT/$required_directory" ] || fail "diretorio ausente: $RUNTIME_ROOT/$required_directory"
done

HOST_VALUE="$(read_config_value HOST '127.0.0.1')"
PORT_VALUE="$(read_config_value PORT '3001')"

[ "$HOST_VALUE" = '127.0.0.1' ] || fail "HOST inseguro: $HOST_VALUE"
[[ "$PORT_VALUE" =~ ^[0-9]+$ ]] || fail "PORT invalida: $PORT_VALUE"
[ "$PORT_VALUE" -ge 1 ] && [ "$PORT_VALUE" -le 65535 ] || fail "PORT fora do intervalo: $PORT_VALUE"

PM2_JSON="$(pm2 jlist)"
printf '%s' "$PM2_JSON" | node - "$PM2_APP_NAME" "$RUNTIME_ROOT/current/src/main.js" <<'NODE'
const fs = require('fs');
const path = require('path');
const [appName, expectedEntry] = process.argv.slice(2);
const apps = JSON.parse(fs.readFileSync(0, 'utf8'));
const app = apps.find((item) => item.name === appName);

if (!app) {
  throw new Error(`PM2 app ausente: ${appName}`);
}

if (app.pm2_env?.status !== 'online') {
  throw new Error(`PM2 app nao esta online: ${app.pm2_env?.status}`);
}

const actualEntry = path.resolve(app.pm2_env?.pm_exec_path || '');
if (actualEntry !== path.resolve(expectedEntry)) {
  throw new Error(`PM2 entry divergente: ${actualEntry}`);
}
NODE

BASE_URL="http://127.0.0.1:${PORT_VALUE}"
HEALTH_JSON="$(curl -fsS --max-time 5 "$BASE_URL/health")"
STATUS_JSON="$(curl -fsS --max-time 5 "$BASE_URL/api/status")"
DIAGNOSTICS_JSON="$(curl -fsS --max-time 10 "$BASE_URL/api/update/auto/diagnostics")"

printf '%s' "$HEALTH_JSON" | node -e "const fs=require('fs');const value=JSON.parse(fs.readFileSync(0,'utf8'));if(value.status!=='OK')process.exit(1)" \
    || fail 'health nao retornou OK'
printf '%s' "$STATUS_JSON" | node -e "const fs=require('fs');const value=JSON.parse(fs.readFileSync(0,'utf8'));if(value.status!=='OPERATIONAL')process.exit(1)" \
    || fail 'status nao retornou OPERATIONAL'
printf '%s' "$DIAGNOSTICS_JSON" | node -e "const fs=require('fs');const value=JSON.parse(fs.readFileSync(0,'utf8'));if(value.success!==true)process.exit(1)" \
    || fail 'diagnosticos do updater falharam'

node - <<NODE
console.log(JSON.stringify({
  certification: 'RP4_PASS',
  architecture: process.arch,
  node: process.version,
  runtimeRoot: ${RUNTIME_ROOT@Q},
  configPath: ${CONFIG_ENV_PATH@Q},
  app: ${PM2_APP_NAME@Q},
  url: ${BASE_URL@Q},
  certifiedAt: new Date().toISOString()
}, null, 2));
NODE
