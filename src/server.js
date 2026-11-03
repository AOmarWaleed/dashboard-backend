import { app } from './app.js';
import { config } from './config/env.js';
import logger from './config/logger.js';
import { closeDatabasePool, checkDatabaseConnection } from './config/database.js';
import { loadConf } from './config/conf.js';

const PORT = config.PORT || 5000;

let server;

async function start() {
  // Fail fast if DB is unreachable on boot
  const dbOk = await checkDatabaseConnection();
  if (!dbOk) {
    logger.error('�?O Cannot connect to database. Aborting startup.');
    process.exit(1);
  }

  // Load DB-backed configuration (rcm.conf) into memory
  await loadConf();

  server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
    logger.info(`   Environment: ${config.NODE_ENV}`);
  });
}

// ---------- Graceful shutdown ----------
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    logger.warn(`${signal} received but shutdown already in progress`);
    return;
  }
  isShuttingDown = true;

  logger.info(`${signal} received, starting graceful shutdown...`);

  const forceExit = setTimeout(() => {
    logger.error('⏱️  Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');
    }

    await closeDatabasePool();

    logger.info('✅ Graceful shutdown complete');
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, '❌ Error during shutdown');
    clearTimeout(forceExit);
    process.exit(1);
  }
}

// ---------- Process signals ----------
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection');
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  void shutdown('uncaughtException');
});

// ---------- Boot ----------
start().catch((err) => {
  logger.error({ err }, '❌ Failed to start server');
  process.exit(1);
});