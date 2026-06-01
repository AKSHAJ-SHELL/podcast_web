const { config } = require("./config");
const { purgeSubmissionsOlderThan } = require("./db");
const { logger } = require("./logger");
const { incrementCounter } = require("./metrics");
const { emitAlert } = require("./alerts");

function runRetentionSweep() {
  const cutoff = new Date(Date.now() - config.db.retentionDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const deleted = purgeSubmissionsOlderThan(cutoff);
    incrementCounter("retention.sweep.success");
    logger.info("retention.sweep_complete", {
      retentionDays: config.db.retentionDays,
      deleted,
      cutoff,
    });
  } catch (error) {
    incrementCounter("retention.sweep.failure");
    logger.error("retention.sweep_failed", { error: error.message });
    emitAlert("retention.sweep.failure", { error: error.message }).catch(() => {});
  }
}

function startRetentionJob() {
  const timer = setInterval(runRetentionSweep, config.db.sweepIntervalMs);
  timer.unref();
  return timer;
}

module.exports = {
  runRetentionSweep,
  startRetentionJob,
};
