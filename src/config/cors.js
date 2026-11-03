import { config } from './env.js';

/**
 * List of fully-qualified origins allowed to call this API.
 * Loaded from env so production can change without rebuild.
 */
export function isOriginAllowed(origin) {
  // Allow non-browser clients (Postman, curl, mobile apps) — no Origin header
  if (!origin) return true;

  // Exact match from env
  if (config.CORS_ORIGINS.includes(origin)) return true;

  // Development-only: allow any port on localhost / internal IPs
  if (config.NODE_ENV !== 'production') {
    const devPatterns = [
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      /^http:\/\/172\.22\.\d+\.\d+(:\d+)?$/, // any 172.22.x.x in dev
      /^http:\/\/80\.238\.215\.190(:\d+)?$/,
    ];
    if (devPatterns.some((re) => re.test(origin))) return true;
  }

  return false;
}

export const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400, 
};