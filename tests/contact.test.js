const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// The handler resolves shared modules from lib/ at require time, so install
// stubs into the require cache before loading it.
const state = {
  rateLimit: { allowed: true, remaining: 9 },
  rateLimitError: null,
  insertError: null,
  inserted: { id: 7, created_at: "2026-06-11T00:00:00.000Z" },
  mailError: null,
  mailCalls: [],
  insertCalls: [],
};

function mockModule(relPath, exports) {
  const fullPath = path.join(__dirname, "..", relPath);
  require.cache[fullPath] = {
    id: fullPath,
    filename: fullPath,
    loaded: true,
    exports,
  };
}

mockModule("lib/rate-limit.js", {
  async checkRateLimit() {
    if (state.rateLimitError) throw state.rateLimitError;
    return state.rateLimit;
  },
  async purgeStaleRateLimits() {
    return 0;
  },
});

mockModule("lib/postgres.js", {
  async insertContactSubmission(payload) {
    state.insertCalls.push(payload);
    if (state.insertError) throw state.insertError;
    return state.inserted;
  },
  async purgeSubmissionsOlderThan() {
    return 0;
  },
});

mockModule("lib/mailer.js", {
  async sendContactNotification(payload) {
    state.mailCalls.push(payload);
    if (state.mailError) throw state.mailError;
  },
});

const { handler } = require("../netlify/functions/contact.js");

const IP_HEADER = { "x-nf-client-connection-ip": "203.0.113.7" };

function validPayload(overrides = {}) {
  return {
    first_name: "Test",
    last_name: "User",
    email: "test@example.com",
    subject: "General Question",
    message: "Hello there",
    website: "",
    consent: true,
    ...overrides,
  };
}

function postEvent(payload, headers = {}) {
  return {
    httpMethod: "POST",
    headers: { ...IP_HEADER, ...headers },
    body: JSON.stringify(payload),
  };
}

test.beforeEach(() => {
  state.rateLimit = { allowed: true, remaining: 9 };
  state.rateLimitError = null;
  state.insertError = null;
  state.mailError = null;
  state.mailCalls = [];
  state.insertCalls = [];
});

test("rejects non-POST methods", async () => {
  const res = await handler({ httpMethod: "GET", headers: { ...IP_HEADER } });
  assert.equal(res.statusCode, 405);
});

test("answers preflight for allowed origin with CORS headers", async () => {
  const res = await handler({
    httpMethod: "OPTIONS",
    headers: { ...IP_HEADER, origin: "http://localhost:3000" },
  });
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "http://localhost:3000");
});

test("rejects disallowed origin", async () => {
  const res = await handler(postEvent(validPayload(), { origin: "https://evil.example" }));
  assert.equal(res.statusCode, 403);
});

test("rejects requests without Netlify client IP header", async () => {
  const res = await handler({
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify(validPayload()),
  });
  assert.equal(res.statusCode, 400);
});

test("returns 429 when rate limited", async () => {
  state.rateLimit = { allowed: false, remaining: 0 };
  const res = await handler(postEvent(validPayload()));
  assert.equal(res.statusCode, 429);
});

test("fails closed with 503 when the rate limiter errors", async () => {
  state.rateLimitError = new Error("db unreachable");
  const res = await handler(postEvent(validPayload()));
  assert.equal(res.statusCode, 503);
  assert.equal(state.insertCalls.length, 0);
});

test("rejects oversized bodies", async () => {
  const res = await handler(
    postEvent(validPayload({ message: "x".repeat(11 * 1024) }))
  );
  assert.equal(res.statusCode, 413);
});

test("rejects invalid JSON", async () => {
  const res = await handler({
    httpMethod: "POST",
    headers: { ...IP_HEADER },
    body: "{not json",
  });
  assert.equal(res.statusCode, 400);
});

test("honeypot returns 201 without storing anything", async () => {
  const res = await handler(postEvent(validPayload({ website: "spam-bot" })));
  assert.equal(res.statusCode, 201);
  assert.equal(state.insertCalls.length, 0);
  assert.equal(state.mailCalls.length, 0);
});

test("rejects submissions without consent", async () => {
  const res = await handler(postEvent(validPayload({ consent: false })));
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /privacy/i);
  assert.equal(state.insertCalls.length, 0);
});

test("success returns 201 with no identifiers and sends notification", async () => {
  const res = await handler(postEvent(validPayload()));
  assert.equal(res.statusCode, 201);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
  assert.equal(state.insertCalls.length, 1);
  assert.equal(state.mailCalls.length, 1);
});

test("still succeeds when the notification email fails", async () => {
  state.mailError = new Error("smtp down");
  const res = await handler(postEvent(validPayload()));
  assert.equal(res.statusCode, 201);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
});

test("returns 500 when the insert fails", async () => {
  state.insertError = new Error("insert failed");
  const res = await handler(postEvent(validPayload()));
  assert.equal(res.statusCode, 500);
});
