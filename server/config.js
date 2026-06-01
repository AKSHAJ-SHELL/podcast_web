const path = require("path");

function parseInteger(value, fallback, name, min = Number.MIN_SAFE_INTEGER) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new Error(`Invalid ${name}: expected integer >= ${min}.`);
  }
  return parsed;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function parseList(value, fallback) {
  const raw = value || fallback;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveDbPath(dbPath) {
  const defaultDbPath = path.join(__dirname, "data", "podcast.db");
  if (!dbPath) return defaultDbPath;
  if (path.isAbsolute(dbPath)) return dbPath;
  return path.resolve(__dirname, dbPath);
}

function createConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";

  const corsOrigins = parseList(
    env.CORS_ORIGINS,
    "http://localhost:8000,http://localhost:3000"
  );
  if (corsOrigins.length === 0) {
    throw new Error("CORS_ORIGINS must define at least one allowed origin.");
  }

  const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  const smtp = {
    host: env.SMTP_HOST || "",
    port: parseInteger(env.SMTP_PORT, 465, "SMTP_PORT", 1),
    secure: parseBoolean(env.SMTP_SECURE, true),
    user: env.SMTP_USER || "",
    pass: env.SMTP_PASS || "",
    notifyTo: env.CONTACT_NOTIFY_TO || "",
    enabled: smtpConfigured,
  };

  if (isProduction && !smtpConfigured) {
    throw new Error(
      "SMTP configuration is required in production (SMTP_HOST, SMTP_USER, SMTP_PASS)."
    );
  }
  if (smtpConfigured && !smtp.notifyTo) {
    throw new Error("CONTACT_NOTIFY_TO is required when SMTP is configured.");
  }

  const redisUrl = env.REDIS_URL || "";
  if (isProduction && !redisUrl) {
    throw new Error("REDIS_URL is required in production for distributed rate limiting.");
  }

  const adminApiToken = env.ADMIN_API_TOKEN || "";
  if (isProduction && !adminApiToken) {
    throw new Error("ADMIN_API_TOKEN is required in production.");
  }

  return {
    nodeEnv,
    isProduction,
    port: parseInteger(env.PORT, 3000, "PORT", 1),
    trustProxy: parseInteger(env.TRUST_PROXY_HOPS, 1, "TRUST_PROXY_HOPS", 0),
    corsOrigins,
    dbPath: resolveDbPath(env.DB_PATH),
    db: {
      retentionDays: parseInteger(env.DATA_RETENTION_DAYS, 90, "DATA_RETENTION_DAYS", 1),
      sweepIntervalMs: parseInteger(
        env.RETENTION_SWEEP_INTERVAL_MS,
        60 * 60 * 1000,
        "RETENTION_SWEEP_INTERVAL_MS",
        1000
      ),
      backupDir: path.resolve(__dirname, env.DB_BACKUP_DIR || "data/backups"),
    },
    rateLimit: {
      windowMs: parseInteger(
        env.CONTACT_RATE_LIMIT_WINDOW_MS,
        15 * 60 * 1000,
        "CONTACT_RATE_LIMIT_WINDOW_MS",
        1000
      ),
      max: parseInteger(env.CONTACT_RATE_LIMIT_MAX, 10, "CONTACT_RATE_LIMIT_MAX", 1),
      redisUrl,
    },
    captcha: {
      verifyUrl: env.CAPTCHA_VERIFY_URL || "",
      secret: env.CAPTCHA_SECRET || "",
    },
    smtp,
    metrics: {
      enabled: parseBoolean(env.METRICS_ENABLED, true),
      requireToken: parseBoolean(env.METRICS_REQUIRE_TOKEN, false),
      token: env.METRICS_TOKEN || "",
    },
    alerts: {
      webhookUrl: env.ALERT_WEBHOOK_URL || "",
      timeoutMs: parseInteger(env.ALERT_TIMEOUT_MS, 3000, "ALERT_TIMEOUT_MS", 100),
    },
    adminApiToken,
  };
}

const config = createConfig();

module.exports = {
  config,
  createConfig,
};
