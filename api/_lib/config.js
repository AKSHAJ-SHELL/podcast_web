const DEFAULT_CORS = "http://localhost:3000,http://localhost:8000";

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

const config = {
  corsOrigins: toList(process.env.CORS_ORIGINS, DEFAULT_CORS),
  rateLimitWindowMs: toNumber(process.env.CONTACT_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: toNumber(process.env.CONTACT_RATE_LIMIT_MAX, 10),
  captchaVerifyUrl: process.env.CAPTCHA_VERIFY_URL || "",
  captchaSecret: process.env.CAPTCHA_SECRET || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: toNumber(process.env.SMTP_PORT, 465),
  smtpSecure: toBoolean(process.env.SMTP_SECURE, true),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  contactNotifyTo: process.env.CONTACT_NOTIFY_TO || "",
};

module.exports = {
  config,
};
