/**
 * Configuração PM2 para DePara
 * Otimizado para execução em segundo plano no Raspberry Pi
 */

module.exports = {
  apps: [
    {
      name: 'DePara',
      script: 'src/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'info'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'info'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_LEVEL: 'debug'
      },
      // Configurações específicas para Raspberry Pi
      node_args: '--max-old-space-size=512',
      // Reiniciar automaticamente se travar
      restart_delay: 5000,
      // Arquivos de log
      log_file: 'logs/pm2-depara.log',
      out_file: 'logs/pm2-depara-out.log',
      error_file: 'logs/pm2-depara-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Configurações de monitoramento
      merge_logs: true,
      time: true,
      // Reiniciar quando o sistema volta
      autorestart: true,
      // Configurações de cluster (útil para múltiplos cores)
      exec_mode: 'fork',
      // Variáveis de ambiente adicionais para Raspberry Pi
      env_raspberry: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'info',
        // Otimizações para Raspberry Pi
        UV_THREADPOOL_SIZE: 4,
        NODE_OPTIONS: '--max-old-space-size=256'
      }
    }
  ],
  // Configurações de deploy (opcional)
  deploy: {
    production: {
      user: 'pi',
      host: 'raspberrypi.local',
      ref: 'origin/main',
      repo: 'git@github.com:username/DePara.git',
      path: '/home/pi/DePara',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env raspberry',
      'pre-setup': ''
    }
  }
};
