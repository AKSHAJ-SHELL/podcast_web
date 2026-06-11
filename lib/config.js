const DEFAULT_CORS = "http://localhost:3000,http://localhost:8888";

function toNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function toList(value, fallback) {
  return (value || fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Netlify injects CONTEXT into both builds and function runtimes.
const isProduction = process.env.CONTEXT === "production";

const config = {
  isProduction,
  // Bump when the privacy policy's effective version changes; stored with
  // each submission so consent is provable against a specific policy text.
  privacyPolicyVersion: "2026-06-11",
  corsOrigins: toList(process.env.CORS_ORIGINS, DEFAULT_CORS),
  rateLimitWindowMs: toNumber(process.env.CONTACT_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: toNumber(process.env.CONTACT_RATE_LIMIT_MAX, 10),
  retentionDays: toNumber(process.env.CONTACT_RETENTION_DAYS, 90),
  rateLimitPepper: process.env.RATE_LIMIT_PEPPER || "",
  turnstileSecret: process.env.TURNSTILE_SECRET || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: toNumber(process.env.SMTP_PORT, 465),
  smtpSecure: toBoolean(process.env.SMTP_SECURE, true),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  contactNotifyTo: process.env.CONTACT_NOTIFY_TO || "",
};

// Fail fast in production: a misconfigured deploy must error loudly on every
// invocation instead of silently dropping mail or accepting unverified bots.
if (isProduction) {
  const missing = [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["RATE_LIMIT_PEPPER", config.rateLimitPepper],
    ["TURNSTILE_SECRET", config.turnstileSecret],
    ["SMTP_HOST", config.smtpHost],
    ["SMTP_USER", config.smtpUser],
    ["SMTP_PASS", config.smtpPass],
    ["CONTACT_NOTIFY_TO", config.contactNotifyTo],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
}

module.exports = {
  config,
};
