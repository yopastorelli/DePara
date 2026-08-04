'use strict';

const {
  getRuntimeProfile,
  applyPlatformDefaults
} = require('../../../src/platform/runtimeProfile');

describe('runtimeProfile', () => {
  test('detects Raspberry Pi without changing the existing runtime contract', () => {
    const profile = getRuntimeProfile({
      platform: 'linux',
      arch: 'arm64',
      env: {},
      homedir: '/home/pi'
    });

    expect(profile.id).toBe('rp4');
    expect(profile.isRaspberryPi).toBe(true);
    expect(profile.runtimeRootDefault).toBe('/home/pi/.depara');
    expect(profile.supervisor).toBe('pm2');
    expect(profile.update.strategy).toBe('git-immutable-release');
    expect(profile.update.schedulerDefault).toBe(true);
  });

  test('detects native Windows and uses a per-user runtime for interactive runs', () => {
    const profile = getRuntimeProfile({
      platform: 'win32',
      arch: 'x64',
      env: {
        LOCALAPPDATA: 'C:\\Users\\Ada\\AppData\\Local'
      },
      homedir: 'C:\\Users\\Ada'
    });

    expect(profile.id).toBe('windows');
    expect(profile.isWindows).toBe(true);
    expect(profile.runtimeRootDefault).toBe('C:\\Users\\Ada\\AppData\\Local\\DePara');
    expect(profile.supervisor).toBe('windows-service');
    expect(profile.desktopIntegration).toBe('external-shell');
    expect(profile.update.strategy).toBe('packaged-release');
    expect(profile.update.schedulerDefault).toBe(false);
  });

  test('applies safe Windows defaults without replacing explicit configuration', () => {
    const env = {
      PORT: '3456',
      DEPARA_RUNTIME_ROOT: 'D:\\DeParaData'
    };

    const profile = applyPlatformDefaults({
      platform: 'win32',
      arch: 'x64',
      env,
      homedir: 'C:\\Users\\Ada'
    });

    expect(profile.id).toBe('windows');
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.PORT).toBe('3456');
    expect(env.DEPARA_RUNTIME_ROOT).toBe('D:\\DeParaData');
    expect(env.DEPARA_PLATFORM_TARGET).toBe('windows');
    expect(env.DEPARA_DISABLE_UPDATE_SCHEDULER).toBe('true');
    expect(env.DEPARA_ALLOW_SYSTEMD_FALLBACK).toBe('false');
    expect(env.DEPARA_WINDOWS_RUNTIME).toBe('true');
  });

  test('does not inject Windows-only flags on a generic Linux workstation', () => {
    const env = {};

    const profile = applyPlatformDefaults({
      platform: 'linux',
      arch: 'x64',
      env,
      homedir: '/home/dev'
    });

    expect(profile.id).toBe('linux');
    expect(env.DEPARA_RUNTIME_ROOT).toBe('/home/dev/.depara');
    expect(env.DEPARA_DISABLE_UPDATE_SCHEDULER).toBeUndefined();
    expect(env.DEPARA_WINDOWS_RUNTIME).toBeUndefined();
  });
});
