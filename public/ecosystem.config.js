// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'gusto-web',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/gusto/Gusto2.0',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/gusto/web-error.log',
      out_file: '/var/log/gusto/web-out.log',
      log_file: '/var/log/gusto/web-combined.log',
      time: true
    },
    {
      name: 'gusto-voice-processor',
      script: './services/voiceProcessor.js',
      cwd: '/var/www/gusto/Gusto2.0',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/gusto/voice-error.log',
      out_file: '/var/log/gusto/voice-out.log',
      log_file: '/var/log/gusto/voice-combined.log',
      time: true
    },
    {
      name: 'gusto-health-monitor',
      script: './services/healthMonitor.js',
      cwd: '/var/www/gusto/Gusto2.0',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/gusto/health-error.log',
      out_file: '/var/log/gusto/health-out.log',
      time: true
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: 'your-droplet-ip',
      ref: 'origin/main',
      repo: 'git@github.com:GGlassworks/Gusto2.0.git',
      path: '/var/www/gusto',
      'post-deploy': 'npm install && npx prisma migrate deploy && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': '',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
}

