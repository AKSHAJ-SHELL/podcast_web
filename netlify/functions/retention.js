const { config } = require("../../lib/config");
const logger = require("../../lib/logger");
const { purgeSubmissionsOlderThan } = require("../../lib/postgres");
const { purgeStaleRateLimits } = require("../../lib/rate-limit");

// Scheduled daily via netlify.toml. Enforces the retention window promised in
// the privacy policy, and clears expired rate-limit rows while it's at it.
exports.handler = async function handler() {
  try {
    const deletedSubmissions = await purgeSubmissionsOlderThan(config.retentionDays);
    const deletedRateLimits = await purgeStaleRateLimits();
    logger.info("retention.sweep_complete", {
      retentionDays: config.retentionDays,
      deletedSubmissions,
      deletedRateLimits,
    });
    return { statusCode: 200 };
  } catch (error) {
    logger.error("retention.sweep_failed", logger.describeError(error));
    return { statusCode: 500 };
  }
};
