const { createHmac } = require("node:crypto");
const { neon } = require("@neondatabase/serverless");
const { config } = require("./config");

// Keyed hash: a plain SHA-256 of an IPv4 is reversible by enumerating the
// 2^32 keyspace, so it would still be personal data in all but name. The
// pepper makes the stored value useless without the secret.
function hashKey(ip) {
  if (!config.rateLimitPepper) {
    throw new Error("RATE_LIMIT_PEPPER is not configured.");
  }
  return createHmac("sha256", config.rateLimitPepper).update(String(ip)).digest("hex");
}

// Fixed-window counter persisted in Postgres so it survives Lambda cold
// starts and concurrent containers. A single atomic upsert avoids races.
async function checkRateLimit(ip) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sql = neon(process.env.DATABASE_URL);
  const keyHash = hashKey(ip);
  const windowSeconds = Math.max(1, Math.floor(config.rateLimitWindowMs / 1000));

  const result = await sql`
    insert into contact_rate_limits (key_hash, window_start, count)
    values (${keyHash}, now(), 1)
    on conflict (key_hash) do update set
      count = case
        when contact_rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds})
          then 1
        else contact_rate_limits.count + 1
      end,
      window_start = case
        when contact_rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds})
          then now()
        else contact_rate_limits.window_start
      end
    returning count;
  `;

  const count = Number(result[0].count);
  return {
    allowed: count <= config.rateLimitMax,
    remaining: Math.max(config.rateLimitMax - count, 0),
  };
}

async function purgeStaleRateLimits() {
  const sql = neon(process.env.DATABASE_URL);
  const windowSeconds = Math.max(1, Math.floor(config.rateLimitWindowMs / 1000));
  const result = await sql`
    delete from contact_rate_limits
    where window_start <= now() - make_interval(secs => ${windowSeconds})
    returning key_hash;
  `;
  return result.length;
}

module.exports = {
  checkRateLimit,
  purgeStaleRateLimits,
};
