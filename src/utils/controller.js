import logger from "../config/logger.js";

export const handleController =
  (handler, errorMessage = "An unexpected error occurred.") =>
  async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      logger.error(error);
      return res.status(500).json({
        message: error.message ?? errorMessage,
      });
    }
  };
