const { config } = require("./config");

const hitsByIp = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - config.rateLimitWindowMs;
  const key = ip || "unknown";
  const history = hitsByIp.get(key) || [];
  const active = history.filter((ts) => ts > windowStart);

  if (active.length >= config.rateLimitMax) {
    hitsByIp.set(key, active);
    return {
      allowed: false,
      remaining: 0,
    };
  }

  active.push(now);
  hitsByIp.set(key, active);
  return {
    allowed: true,
    remaining: Math.max(config.rateLimitMax - active.length, 0),
  };
}

module.exports = {
  checkRateLimit,
};
