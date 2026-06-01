const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const Redis = require("ioredis");
const { incrementCounter } = require("./metrics");

function createContactRateLimiter(config, logger) {
  let redisClient = null;
  let store = null;

  if (config.rateLimit.redisUrl) {
    redisClient = new Redis(config.rateLimit.redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    redisClient.on("error", (error) => {
      logger.error("ratelimit.redis_error", { error: error.message });
    });
    store = new RedisStore({
      sendCommand: (...args) => redisClient.call(args[0], ...args.slice(1)),
    });
  } else {
    logger.warn("ratelimit.memory_store_enabled");
  }

  const middleware = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: store || undefined,
    handler: (req, res) => {
      incrementCounter("contact.ratelimit.blocked");
      logger.warn("contact.ratelimit_blocked", { ip: req.ip, path: req.path });
      res.status(429).json({
        ok: false,
        error: "Too many requests. Please try again later.",
      });
    },
  });

  return {
    middleware,
    close: async () => {
      if (redisClient) {
        await redisClient.quit();
      }
    },
  };
}

module.exports = {
  createContactRateLimiter,
};
