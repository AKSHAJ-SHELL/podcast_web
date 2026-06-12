const { config } = require("../../lib/config");
const logger = require("../../lib/logger");
const { validatePayload } = require("../../lib/validation");
const { checkRateLimit } = require("../../lib/rate-limit");
const { insertContactSubmission } = require("../../lib/postgres");
const { sendContactNotification } = require("../../lib/mailer");

const MAX_BODY_BYTES = 10 * 1024;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  };
}

exports.handler = async function handler(event) {
  const startedAt = Date.now();
  const origin = event.headers.origin || "";

  let extraHeaders = {};
  if (origin) {
    if (!config.corsOrigins.includes(origin)) {
      return jsonResponse(403, { ok: false, error: "Origin not allowed." });
    }
    extraHeaders = corsHeaders(origin);
  }

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: extraHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed." }, extraHeaders);
  }

  // Trust only Netlify's own connection header; x-forwarded-for is
  // client-forgeable and must never key the rate limiter.
  const ip = event.headers["x-nf-client-connection-ip"];
  if (!ip) {
    return jsonResponse(400, { ok: false, error: "Invalid request." }, extraHeaders);
  }

  try {
    const limit = await checkRateLimit(ip);
    if (!limit.allowed) {
      logger.warn("contact.ratelimit_blocked");
      return jsonResponse(
        429,
        { ok: false, error: "Too many requests. Please try again later." },
        extraHeaders
      );
    }
  } catch (error) {
    // Fail closed: an unreachable rate limiter must not open the gate.
    logger.error("contact.ratelimit_error", logger.describeError(error));
    return jsonResponse(
      503,
      { ok: false, error: "Service temporarily unavailable. Please try again later." },
      extraHeaders
    );
  }

  if (event.body && Buffer.byteLength(event.body, "utf8") > MAX_BODY_BYTES) {
    return jsonResponse(413, { ok: false, error: "Request body too large." }, extraHeaders);
  }

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return jsonResponse(400, { ok: false, error: "Invalid JSON body." }, extraHeaders);
    }
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return jsonResponse(validation.status, { ok: false, error: validation.error }, extraHeaders);
  }
  if (validation.honeypot) {
    return jsonResponse(201, { ok: true }, extraHeaders);
  }

  try {
    const inserted = await insertContactSubmission(validation.data);

    // Await the notification: backgrounding it is unsafe on Lambda since the
    // runtime may freeze as soon as the response is returned.
    try {
      await sendContactNotification({
        ...validation.data,
        created_at: inserted.created_at,
      });
    } catch (error) {
      // Log the row id, never the email address or raw error message:
      // function logs and drains must not become a second PII store.
      logger.error("mail.send_failed", {
        ...logger.describeError(error),
        submissionId: Number(inserted.id),
      });
    }

    logger.info("contact.submission_success", {
      id: Number(inserted.id),
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse(201, { ok: true }, extraHeaders);
  } catch (error) {
    logger.error("contact.submission_failed", {
      ...logger.describeError(error),
      durationMs: Date.now() - startedAt,
    });
    return jsonResponse(500, { ok: false, error: "Failed to save submission." }, extraHeaders);
  }
};
