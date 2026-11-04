import { createLogger } from "@givc/shared-backend";
import { config } from "./env.js";



const logger = createLogger({
  label: "DASHBOARD_LOGGER",
  logLevel: config.LOGGER.LOG_LEVEL,
  logFile: `dashboard-${ config.LOGGER.LOG_ENVIRONMENT}`,
  logDir:  config.LOGGER.LOG_DIR || "logs",
  rotation: {
    datePattern:  config.LOGGER.LOG_ROTATION_DATE_PATTERN || "YYYY-MM-DD",
    maxSize:  config.LOGGER.LOG_ROTATION_MAX_SIZE || "20m",
    maxFiles:  config.LOGGER.LOG_ROTATION_MAX_FILES || "14d",
    zippedArchive:  config.LOGGER.LOG_ROTATION_ZIP !== "false",
  },
});

export default logger;
