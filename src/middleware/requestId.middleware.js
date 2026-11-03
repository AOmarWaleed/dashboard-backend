import { randomUUID } from 'node:crypto';

export const requestId = (req, res, next) => {
  const id = req.headers['x-request-id'] || randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};