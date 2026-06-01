const { config } = require("./_lib/config");
const logger = require("./_lib/logger");
const { validatePayload } = require("./_lib/validation");
const { verifyCaptchaToken } = require("./_lib/captcha");
const { checkRateLimit } = require("./_lib/rate-limit");
const { insertContactSubmission } = require("./_lib/postgres");
const { sendContactNotification } = require("./_lib/mailer");

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;

  if (!config.corsOrigins.includes(origin)) {
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return true;
}

module.exports = async function handler(req, res) {
  const startedAt = Date.now();

  if (!setCorsHeaders(req, res)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed." });
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const limit = checkRateLimit(String(ip).split(",")[0].trim());
  if (!limit.allowed) {
    logger.warn("contact.ratelimit_blocked", { ip });
    return res.status(429).json({
      ok: false,
      error: "Too many requests. Please try again later.",
    });
  }

  const validation = validatePayload(req.body || {});
  if (!validation.ok) {
    return res.status(validation.status).json({ ok: false, error: validation.error });
  }
  if (validation.honeypot) {
    return res.status(201).json({ ok: true });
  }

  const captchaVerified = await verifyCaptchaToken(validation.data.captcha_token);
  if (!captchaVerified) {
    return res.status(400).json({ ok: false, error: "Captcha verification failed." });
  }

  try {
    const inserted = await insertContactSubmission(validation.data);
    const responsePayload = {
      ok: true,
      id: Number(inserted.id),
    };

    sendContactNotification({
      ...validation.data,
      created_at: inserted.created_at,
    }).catch((error) => {
      logger.error("mail.send_failed", {
        error: error.message,
        email: validation.data.email,
      });
    });

    logger.info("contact.submission_success", {
      id: responsePayload.id,
      durationMs: Date.now() - startedAt,
    });
    return res.status(201).json(responsePayload);
  } catch (error) {
    logger.error("contact.submission_failed", {
      error: error.message,
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json({ ok: false, error: "Failed to save submission." });
  }
};
