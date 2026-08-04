'use strict';

const os = require('os');
const path = require('path');

function setDefault(env, key, value) {
  if (env[key] === undefined || env[key] === null || env[key] === '') {
    env[key] = String(value);
  }
}

function getRuntimeProfile(options = {}) {
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  const env = options.env || process.env;
  const homedir = options.homedir || os.homedir();

  const isWindows = platform === 'win32';
  const isLinux = platform === 'linux';
  const isRaspberryPi = isLinux && (arch === 'arm' || arch === 'arm64');
  const pathApi = isWindows ? path.win32 : path;

  const windowsUserRoot = env.LOCALAPPDATA || env.USERPROFILE || homedir;
  const runtimeRootDefault = isWindows
    ? pathApi.join(windowsUserRoot, 'DePara')
    : pathApi.join(homedir, '.depara');

  let id = platform;
  if (isWindows) id = 'windows';
  if (isRaspberryPi) id = 'rp4';

  return {
    id,
    platform,
    arch,
    isWindows,
    isLinux,
    isRaspberryPi,
    runtimeRootDefault,
    supervisor: isWindows ? 'windows-service' : (isRaspberryPi ? 'pm2' : 'process'),
    desktopIntegration: isWindows ? 'external-shell' : (isRaspberryPi ? 'linux-desktop' : 'browser'),
    update: {
      strategy: isWindows ? 'packaged-release' : 'git-immutable-release',
      schedulerDefault: !isWindows
    },
    capabilities: {
      backend: true,
      fileOperations: true,
      scheduledOperations: true,
      browserUi: true,
      nativeTray: false,
      nativeAutoUpdate: !isWindows
    }
  };
}

function applyPlatformDefaults(options = {}) {
  const env = options.env || process.env;
  const profile = getRuntimeProfile({
    ...options,
    env
  });

  setDefault(env, 'HOST', '127.0.0.1');
  setDefault(env, 'PORT', '3000');
  setDefault(env, 'DEPARA_RUNTIME_ROOT', profile.runtimeRootDefault);
  setDefault(env, 'DEPARA_PLATFORM_TARGET', profile.id);

  if (profile.isWindows) {
    setDefault(env, 'DEPARA_DISABLE_UPDATE_SCHEDULER', 'true');
    setDefault(env, 'DEPARA_ALLOW_SYSTEMD_FALLBACK', 'false');
    setDefault(env, 'DEPARA_WINDOWS_RUNTIME', 'true');
  }

  return profile;
}

module.exports = {
  getRuntimeProfile,
  applyPlatformDefaults
};
