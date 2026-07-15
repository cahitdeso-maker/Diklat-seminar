/**
 * PM2 Ecosystem Configuration
 * 
 * Mengelola wa-gateway sebagai proses long-running dengan auto-restart.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup (agar auto-start saat server reboot)
 */

module.exports = {
  apps: [
    {
      name: "wa-gateway",
      script: "src/index.js",
      cwd: __dirname,
      instances: 1, // Hanya 1 instance karena Baileys singleton
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      min_uptime: 10000,
      
      // Environment variables
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        API_KEY: "d9801abe-7793-4aa5-bb2e-2a92a1c9570e",
        LOG_LEVEL: "info",
        SEND_DELAY_MIN: 1500,
        SEND_DELAY_MAX: 3000,
      },

      // Logging
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      log_file: "logs/pm2-combined.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      time: true,

      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 30000,
      shutdown_with_message: true,
    },
  ],
};
