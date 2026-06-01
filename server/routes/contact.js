const express = require("express");
const { createContactSubmission } = require("../db");
const { config } = require("../config");
const { logger } = require("../logger");
const { incrementCounter, observeDuration } = require("../metrics");
const { enqueueContactNotification } = require("../notifications");
const { emitAlert } = require("../alerts");

const router = express.Router();

const ALLOWED_SUBJECTS = new Set([
  "Guest Suggestion",
  "Collaboration",
  "General Question",
  "Media Inquiry",
  "Other",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeValue(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

async function verifyCaptchaToken(captchaToken) {
  const verificationUrl = config.captcha.verifyUrl;
  const verificationSecret = config.captcha.secret;

  if (!verificationUrl || !verificationSecret) return true;
  if (!captchaToken) return false;

  try {
    const verificationResponse = await fetch(verificationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: verificationSecret,
        response: captchaToken,
      }),
    });

    if (!verificationResponse.ok) return false;

    const verificationResult = await verificationResponse.json();
    return Boolean(verificationResult && verificationResult.success);
  } catch (error) {
    logger.warn("contact.captcha_verify_error", { error: error.message });
    return false;
  }
}

router.post("/", async (req, res) => {
  const startedAt = Date.now();
  const website = normalizeValue(req.body.website);

  // Honeypot for bot filtering: pretend success, skip insert.
  if (website) {
    incrementCounter("contact.honeypot.blocked");
    return res.status(201).json({ ok: true });
  }

  const firstName = normalizeValue(req.body.first_name);
  const lastName = normalizeValue(req.body.last_name);
  const email = normalizeValue(req.body.email).toLowerCase();
  const subject = normalizeValue(req.body.subject);
  const message = normalizeValue(req.body.message);
  const captchaToken = normalizeValue(req.body.captcha_token);

  if (!firstName || !lastName || !email || !subject || !message) {
    incrementCounter("contact.validation.failure", 1, { reason: "required_fields" });
    return res.status(400).json({ ok: false, error: "All fields are required." });
  }

  if (firstName.length > 100 || lastName.length > 100) {
    incrementCounter("contact.validation.failure", 1, { reason: "name_too_long" });
    return res.status(400).json({ ok: false, error: "Name is too long." });
  }

  if (email.length > 254) {
    incrementCounter("contact.validation.failure", 1, { reason: "email_too_long" });
    return res.status(400).json({ ok: false, error: "Email is too long." });
  }

  if (subject.length > 100 || !ALLOWED_SUBJECTS.has(subject)) {
    incrementCounter("contact.validation.failure", 1, { reason: "invalid_subject" });
    return res.status(400).json({ ok: false, error: "Invalid subject." });
  }

  if (message.length > 5000) {
    incrementCounter("contact.validation.failure", 1, { reason: "message_too_long" });
    return res.status(400).json({ ok: false, error: "Message is too long." });
  }

  if (!EMAIL_REGEX.test(email)) {
    incrementCounter("contact.validation.failure", 1, { reason: "invalid_email" });
    return res.status(400).json({ ok: false, error: "Invalid email format." });
  }

  const captchaVerified = await verifyCaptchaToken(captchaToken);
  if (!captchaVerified) {
    incrementCounter("contact.validation.failure", 1, { reason: "captcha_failed" });
    return res.status(400).json({ ok: false, error: "Captcha verification failed." });
  }

  const createdAt = new Date().toISOString();

  try {
    const id = createContactSubmission({
      first_name: firstName,
      last_name: lastName,
      email,
      subject,
      message,
      created_at: createdAt,
    });
    incrementCounter("contact.submission.success");
    observeDuration("contact.submission.duration_ms", Date.now() - startedAt);

    enqueueContactNotification({
      first_name: firstName,
      last_name: lastName,
      email,
      subject,
      message,
      created_at: createdAt,
    });

    return res.status(201).json({ ok: true, id });
  } catch (error) {
    incrementCounter("contact.submission.failure");
    logger.error("contact.submission_failed", { error: error.message });
    emitAlert("contact.submission.failure", { error: error.message }).catch(() => {});
    return res.status(500).json({ ok: false, error: "Failed to save submission." });
  }
});

module.exports = router;