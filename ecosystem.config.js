const os = require('os');
const path = require('path');

const runtimeRoot = process.env.DEPARA_RUNTIME_ROOT || path.join(os.homedir(), '.depara');
const logsDir = path.join(runtimeRoot, 'logs');

module.exports = {
  apps: [
    {
      name: 'DePara',
      script: 'src/main.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: '350M',
      node_args: '--max-old-space-size=256',
      log_file: path.join(logsDir, 'pm2-depara.log'),
      out_file: path.join(logsDir, 'pm2-depara-out.log'),
      error_file: path.join(logsDir, 'pm2-depara-error.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'warn',
        LOG_TO_CONSOLE: 'false',
        DEPARA_RUNTIME_ROOT: runtimeRoot,
        PM2_APP_NAME: 'DePara',
        DEPARA_ALLOW_SYSTEMD_FALLBACK: 'false'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'warn',
        LOG_TO_CONSOLE: 'false',
        DEPARA_RUNTIME_ROOT: runtimeRoot,
        PM2_APP_NAME: 'DePara',
        DEPARA_ALLOW_SYSTEMD_FALLBACK: 'false'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_LEVEL: 'debug',
        LOG_TO_CONSOLE: 'true'
      },
      env_raspberry: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'warn',
        LOG_TO_CONSOLE: 'false',
        DEPARA_RUNTIME_ROOT: runtimeRoot,
        PM2_APP_NAME: 'DePara',
        DEPARA_ALLOW_SYSTEMD_FALLBACK: 'false',
        UV_THREADPOOL_SIZE: 4,
        NODE_OPTIONS: '--max-old-space-size=256'
      }
    }
  ]
};
