const nodemailer = require("nodemailer");
const { config } = require("./config");
const { logger } = require("./logger");

const hasSmtpConfig = config.smtp.enabled;

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
  : null;

async function sendContactNotification(payload) {
  if (!transporter) {
    logger.warn("mail.skip_smtp_not_configured");
    return;
  }

  const to = config.smtp.notifyTo;
  const from = config.smtp.user;

  const text = [
    "New contact form submission",
    "",
    `Name: ${payload.first_name} ${payload.last_name}`,
    `Email: ${payload.email}`,
    `Subject: ${payload.subject}`,
    `Submitted: ${payload.created_at}`,
    "",
    "Message:",
    payload.message,
  ].join("\n");

  try {
    await transporter.sendMail({
      from,
      to,
      replyTo: payload.email,
      subject: `CONTRACT: ${payload.subject} | ${payload.first_name} ${payload.last_name}`,
      text,
    });
  } catch (error) {
    logger.error("mail.send_failed", { error: error.message });
    throw error;
  }
}

module.exports = { sendContactNotification };