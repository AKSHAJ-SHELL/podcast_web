require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const { config } = require("./config");
const { initializeDatabase } = require("./db");
const { logger } = require("./logger");
const { observeDuration, toJSON, incrementCounter } = require("./metrics");
const { createContactRateLimiter } = require("./rateLimit");
const { startRetentionJob } = require("./retention");
const contactRouter = require("./routes/contact");
const adminRouter = require("./routes/admin");

const app = express();
let retentionTimer = null;
let rateLimiterHandle = null;

initializeDatabase();
app.set("trust proxy", config.trustProxy);

const corsOrigins = config.corsOrigins;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  if (config.isProduction && req.headers["x-forwarded-proto"] && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  }
  return next();
});

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    observeDuration("http.request.duration_ms", durationMs, {
      method: req.method,
      route: req.path,
      status: res.statusCode,
    });
    logger.info("http.request_complete", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
    });
  });
  next();
});

rateLimiterHandle = createContactRateLimiter(config, logger);

app.get("/health", (_req, res) => {
  res.json({ ok: true, dbPath: config.dbPath });
});

app.get("/metrics", (req, res) => {
  if (config.metrics.requireToken && req.headers["x-metrics-token"] !== config.metrics.token) {
    incrementCounter("metrics.unauthorized");
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }
  if (!config.metrics.enabled) {
    return res.status(404).json({ ok: false, error: "Metrics are disabled." });
  }
  return res.json({ ok: true, metrics: toJSON() });
});

app.get("/", (_req, res) => {
  res.redirect(302, "/index.html");
});

app.use("/api/contact", rateLimiterHandle.middleware, contactRouter);
app.use("/api/admin", adminRouter);

// Serve frontend (HTML and assets) from project root so one server runs both
app.use(express.static(path.join(__dirname, "..")));

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Not found." });
});

app.use((err, _req, res, _next) => {
  logger.error("http.unhandled_error", {
    error: err && err.message ? err.message : "unknown_error",
  });
  if (err && err.message === "Origin not allowed by CORS") {
    return res.status(403).json({ ok: false, error: "Origin not allowed." });
  }
  return res.status(500).json({ ok: false, error: "Internal server error." });
});

retentionTimer = startRetentionJob();

let server;

function startServer() {
  server = app.listen(config.port, () => {
    logger.info("server.started", { port: config.port });
  });
  return server;
}

async function closeResources() {
  if (retentionTimer) clearInterval(retentionTimer);
  if (rateLimiterHandle) {
    await rateLimiterHandle.close();
  }
  if (server && server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
  closeResources,
};
