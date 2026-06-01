const { config } = require("./config");
const { logger } = require("./logger");

let alertFailures = 0;

async function emitAlert(event, payload = {}) {
  if (!config.alerts.webhookUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.alerts.timeoutMs);

  try {
    const response = await fetch(config.alerts.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        payload,
        ts: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Alert webhook failed with status ${response.status}`);
    }
  } catch (error) {
    alertFailures += 1;
    logger.error("alert.delivery_failed", {
      event,
      error: error.message,
      consecutiveFailures: alertFailures,
    });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  emitAlert,
};
