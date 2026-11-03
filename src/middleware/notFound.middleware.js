import { NotFoundError } from '../errors/AppError.js';

export const notFoundHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
};