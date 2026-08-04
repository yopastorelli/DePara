'use strict';

const { applyPlatformDefaults } = require('../src/platform/runtimeProfile');
const { loadOperationalConfig } = require('../src/utils/runtimeConfig');

if (process.platform !== 'win32' && process.env.DEPARA_ALLOW_NON_WINDOWS_START !== 'true') {
  console.error('O launcher start:windows deve ser executado no Windows nativo.');
  process.exit(1);
}

const isService = process.env.DEPARA_WINDOWS_SERVICE === 'true';
const profile = applyPlatformDefaults({ applyNetworkDefaults: false });

if (isService) {
  loadOperationalConfig({ override: true });
  process.env.DEPARA_WINDOWS_SERVICE = 'true';
  process.env.DEPARA_WINDOWS_RUNTIME = 'true';
  process.env.DEPARA_PLATFORM_TARGET = 'windows';
  process.env.DEPARA_DISABLE_UPDATE_SCHEDULER = 'true';
  process.env.DEPARA_ALLOW_SYSTEMD_FALLBACK = 'false';
}

const app = require('../src/main');

app.startServer({ registerHandlers: true })
  .then(() => {
    process.stdout.write(
      `DePara iniciado para ${profile.id}/${profile.arch} com runtime em ${process.env.DEPARA_RUNTIME_ROOT}\n`
    );
  })
  .catch((error) => {
    console.error('Falha ao iniciar o DePara no Windows:', error);
    process.exit(1);
  });
