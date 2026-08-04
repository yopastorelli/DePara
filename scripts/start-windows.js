'use strict';

const { applyPlatformDefaults } = require('../src/platform/runtimeProfile');

if (process.platform !== 'win32' && process.env.DEPARA_ALLOW_NON_WINDOWS_START !== 'true') {
  console.error('O launcher start:windows deve ser executado no Windows nativo.');
  process.exit(1);
}

const profile = applyPlatformDefaults({ applyNetworkDefaults: false });
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
