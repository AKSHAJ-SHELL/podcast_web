const { sendContactNotification } = require("./mailer");
const { logger } = require("./logger");
const { incrementCounter } = require("./metrics");
const { emitAlert } = require("./alerts");

const queue = [];
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const payload = queue.shift();
    try {
      await sendContactNotification(payload);
      incrementCounter("contact.email.success");
    } catch (error) {
      incrementCounter("contact.email.failure");
      logger.error("contact.email_async_failed", { error: error.message });
      emitAlert("contact.email.failure", { error: error.message }).catch(() => {});
    }
  }
  processing = false;
}

function enqueueContactNotification(payload) {
  queue.push(payload);
  setImmediate(() => {
    processQueue().catch((error) => {
      logger.error("contact.email_queue_failed", { error: error.message });
    });
  });
}

module.exports = {
  enqueueContactNotification,
};
