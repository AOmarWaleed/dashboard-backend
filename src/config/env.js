import dotenv from "dotenv";
dotenv.config();

export const config = {
  CORS_ORIGIN: process.env.CORS_ORIGINS, 
  NODE_ENV: process.env.NODE_ENV, 
  PORT: process.env.PORT, 
  JWT_SECRET: process.env.JWT_SECRET, 
  
  LOGGER: {
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_ENVIRONMENT: process.env.LOG_ENVIRONMENT,
    LOG_DIR: process.env.LOG_DIR || "logs",
    LOG_ROTATION_DATE_PATTERN:
      process.env.LOG_ROTATION_DATE_PATTERN || "YYYY-MM-DD",
    LOG_ROTATION_MAX_SIZE: process.env.LOG_ROTATION_MAX_SIZE || "20m",
    LOG_ROTATION_MAX_FILES: process.env.LOG_ROTATION_MAX_FILES || "14d",
    LOG_ROTATION_ZIP: process.env.LOG_ROTATION_ZIP !== "false",
  },
  DB: {
    USER: process.env.DB_USER,
    HOST: process.env.DB_HOST,
    DATABASE: process.env.DB_DATABASE,
    PASSWORD: process.env.DB_PASSWORD,
    PORT: process.env.DB_PORT || 5432,

    API_POOL_MAX: process.env.API_POOL_MAX,
    IDLE_TIMEOUT_MILLIS: process.env.IDLE_TIMEOUT_MILLIS,
    CONNECTION_TIMEOUT_MILLIS: process.env.CONNECTION_TIMEOUT_MILLIS,
    API_POOL_MAX: process.env.API_POOL_MAX,
  },
};
