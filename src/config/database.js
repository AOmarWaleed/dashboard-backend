import pg from "pg";
import { config } from "./env.js";
import logger from "./logger.js";

const { Pool } = pg;

let pool = null;
let isShuttingDown = false;
const API_POOL_MAX = config.DB.API_POOL_MAX || 20;

function createPool() {
  const newPool = new Pool({
    user: config.DB.USER,
    host: config.DB.HOST,
    database: config.DB.DATABASE,
    password: config.DB.PASSWORD,
    port: config.DB.PORT,

    max: API_POOL_MAX,
    idleTimeoutMillis: config.DB.IDLE_TIMEOUT_MILLIS || 30000,
    connectionTimeoutMillis: config.DB.CONNECTION_TIMEOUT_MILLIS || 30000,
  });

  newPool.on("error", (err) => {
    logger.error({ err }, "Unexpected error on idle PostgreSQL client");
  });

  logger.info(` max: ${API_POOL_MAX }, "PostgreSQL pool created" `);

  return newPool;
}

function getPool() {
  if (!pool || pool.ended) {
    if (isShuttingDown) {
      throw new Error("Database pool is shutting down, cannot create new pool");
    }
    logger.info("Database pool was closed or missing, creating a new pool...");
    pool = createPool();
  }
  return pool;
}

export const query = async (text, params) => {
  const start = Date.now();
  const activePool = getPool();

  try {
    const result = await activePool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn(
        { text, duration, rows: result.rowCount },
        "Slow query detected",
      );
    }

    return result;
  } catch (error) {
    logger.error({ err: error, query: text, params }, "Database query error");
    throw error;
  }
};

export async function checkDatabaseConnection() {
  try {
    await query("SELECT 1");
    return true;
  } catch (error) {
    logger.error({ err: error }, "Database connection check failed");
    return false;
  }
}

export async function closeDatabasePool() {
  try {
    isShuttingDown = true;
    if (pool && !pool.ended) {
      await pool.end();
      logger.info("Database pool has ended");
    }
    pool = null;
  } catch (error) {
    logger.error({ err: error }, "Error closing database pool");
    pool = null;
  } finally {
    isShuttingDown = false;
  }
}
