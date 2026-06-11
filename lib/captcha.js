const { config } = require("./config");
const logger = require("./logger");

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare Turnstile verification. Fail-closed: in production a missing
// secret already throws at config load; here we only allow a bypass in
// non-production contexts so local dev works without a widget.
async function verifyCaptchaToken(captchaToken, remoteIp) {
  if (!config.turnstileSecret) {
    if (config.isProduction) {
      return false;
    }
    logger.warn("captcha.bypassed_no_secret_configured");
    return true;
  }

  if (!captchaToken) return false;

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: config.turnstileSecret,
        response: captchaToken,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });
    if (!response.ok) return false;
    const json = await response.json();
    return Boolean(json && json.success);
  } catch (error) {
    logger.warn("captcha.verify_error", logger.describeError(error));
    return false;
  }
}

module.exports = {
  verifyCaptchaToken,
};
