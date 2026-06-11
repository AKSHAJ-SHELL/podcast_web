const nodemailer = require("nodemailer");
const { config } = require("./config");
const logger = require("./logger");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass || !config.contactNotifyTo) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter;
}

// Defense in depth for header injection: never rely solely on the mail
// library's header encoding for user-controlled values placed in headers.
function headerSafe(value) {
  return String(value).replace(/[\r\n\t\u0000-\u001f\u007f]+/g, " ").trim();
}

async function sendContactNotification(payload) {
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    logger.warn("mail.skip_smtp_not_configured");
    return;
  }

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

  await mailTransporter.sendMail({
    from: config.smtpUser,
    to: config.contactNotifyTo,
    replyTo: headerSafe(payload.email),
    subject: headerSafe(
      `CONTACT: ${payload.subject} | ${payload.first_name} ${payload.last_name}`
    ),
    text,
  });
}

module.exports = {
  sendContactNotification,
  headerSafe,
};
