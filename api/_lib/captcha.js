const { config } = require("./config");
const logger = require("./logger");

async function verifyCaptchaToken(captchaToken) {
  if (!config.captchaVerifyUrl || !config.captchaSecret) return true;
  if (!captchaToken) return false;

  try {
    const response = await fetch(config.captchaVerifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: config.captchaSecret,
        response: captchaToken,
      }),
    });
    if (!response.ok) return false;
    const json = await response.json();
    return Boolean(json && json.success);
  } catch (error) {
    logger.warn("contact.captcha_verify_error", { error: error.message });
    return false;
  }
}

module.exports = {
  verifyCaptchaToken,
};
