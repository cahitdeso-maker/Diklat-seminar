module.exports = {
  apps: [
    {
      name: 'diklat-seminar-web',
      cwd: '/var/www/Diklat-seminar',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      error_file: '/var/log/pm2/diklat-web-error.log',
      out_file: '/var/log/pm2/diklat-web-out.log',
    },
  ],
};
