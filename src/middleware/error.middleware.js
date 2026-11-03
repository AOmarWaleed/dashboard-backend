import { AppError, ValidationError } from '../errors/AppError.js';
import logger from '../config/logger.js';
import { config } from '../config/env.js';

export const errorHandler = (err, req, res, _next) => {
  // Known, operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code ?? 'ERROR',
        message: err.message,
        ...(err instanceof ValidationError && { details: err.details }),
      },
    });
  }

  // Unknown errors — log full, don't leak details in prod
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        config.NODE_ENV === 'production'
          ? 'Something went wrong'
          : err.message,
    },
  });
};