import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";

import { config } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { notFoundHandler } from "./middleware/notFound.middleware.js";
import { requestId } from "./middleware/requestId.middleware.js";
import { apiLimiter } from "./middleware/rateLimit.middleware.js";
import { checkDatabaseConnection } from "./config/database.js";

export const app = express();

// ---------- Trust proxy (for rate limiting / IP behind LB) ----------
app.set("trust proxy", 1);

// ---------- Security & basics ----------
app.use(
  helmet({
    strictTransportSecurity: false,
  }),
);
app.use(
  cors({
    origin: config.CORS_ORIGIN, // todo
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- Tracing & logging ----------
app.use(requestId);
app.use(
  morgan(
    ":method :url :status :res[content-length] - :response-time ms - reqId=:req[x-request-id]",
  ),
);

// ---------- Rate limiting ----------
app.use('/dashboard-api', apiLimiter);

// ---------- Health check ----------
app.get("/health", async (_req, res) => {
  const dbOk = await checkDatabaseConnection();

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/live", (_req, res) => {
  res.json({ status: "ok" });
});

// ---------- API routes ----------
app.use("/dashboard-api", routes);

// ---------- 404 + Error handler (MUST BE LAST) ----------
app.use(notFoundHandler);
app.use(errorHandler);
