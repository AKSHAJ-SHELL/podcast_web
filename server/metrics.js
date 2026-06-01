const counters = new Map();
const timings = new Map();

function normalizeTags(tags = {}) {
  return Object.keys(tags)
    .sort()
    .map((key) => `${key}=${tags[key]}`)
    .join(",");
}

function keyForMetric(name, tags) {
  const suffix = normalizeTags(tags);
  return suffix ? `${name}|${suffix}` : name;
}

function incrementCounter(name, value = 1, tags = {}) {
  const key = keyForMetric(name, tags);
  counters.set(key, (counters.get(key) || 0) + value);
}

function observeDuration(name, durationMs, tags = {}) {
  const key = keyForMetric(name, tags);
  const stat = timings.get(key) || { count: 0, totalMs: 0, maxMs: 0 };
  stat.count += 1;
  stat.totalMs += durationMs;
  stat.maxMs = Math.max(stat.maxMs, durationMs);
  timings.set(key, stat);
}

function toJSON() {
  return {
    counters: Object.fromEntries(counters),
    timings: Object.fromEntries(
      Array.from(timings.entries()).map(([key, value]) => [
        key,
        {
          count: value.count,
          avgMs: Number((value.totalMs / value.count).toFixed(2)),
          maxMs: value.maxMs,
        },
      ])
    ),
  };
}

module.exports = {
  incrementCounter,
  observeDuration,
  toJSON,
};
