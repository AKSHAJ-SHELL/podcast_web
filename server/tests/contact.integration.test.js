const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const request = require("supertest");

const dbFileName = `test-contact-${process.pid}-${Date.now()}.db`;
const dbRelativePath = `./data/${dbFileName}`;
const dbAbsolutePath = path.join(__dirname, "..", "data", dbFileName);

function clearServerModuleCache() {
  const modules = [
    "../index",
    "../config",
    "../db",
    "../rateLimit",
    "../mailer",
    "../notifications",
    "../retention",
    "../routes/contact",
    "../routes/admin",
  ];
  for (const modulePath of modules) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch (_error) {
      // no-op if module was not loaded
    }
  }
}

function buildTestServer() {
  process.env.NODE_ENV = "test";
  process.env.DB_PATH = dbRelativePath;
  process.env.CORS_ORIGINS = "http://localhost:3000";
  process.env.CONTACT_RATE_LIMIT_MAX = "2";
  process.env.CONTACT_RATE_LIMIT_WINDOW_MS = "900000";
  process.env.ADMIN_API_TOKEN = "test-admin-token";
  process.env.REDIS_URL = "";
  process.env.CAPTCHA_VERIFY_URL = "";
  process.env.CAPTCHA_SECRET = "";
  process.env.METRICS_ENABLED = "true";
  process.env.METRICS_REQUIRE_TOKEN = "false";

  clearServerModuleCache();
  return require("../index");
}

test("contact endpoint accepts valid payload", async (t) => {
  const { app, closeResources } = buildTestServer();
  t.after(async () => {
    await closeResources();
  });

  const response = await request(app).post("/api/contact").send({
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    subject: "General Question",
    message: "Hello from tests",
    website: "",
    captcha_token: "",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.ok, true);
  assert.equal(typeof response.body.id, "number");
});

test("contact endpoint rate limits burst traffic", async (t) => {
  const { app, closeResources } = buildTestServer();
  t.after(async () => {
    await closeResources();
  });

  const payload = {
    first_name: "Rate",
    last_name: "Test",
    email: "rate@example.com",
    subject: "Other",
    message: "Trigger rate limit",
    website: "",
    captcha_token: "",
  };

  const first = await request(app).post("/api/contact").send(payload);
  const second = await request(app).post("/api/contact").send(payload);
  const third = await request(app).post("/api/contact").send(payload);

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(third.status, 429);
  assert.equal(third.body.error, "Too many requests. Please try again later.");
});

test("admin endpoint enforces authorization token", async (t) => {
  const { app, closeResources } = buildTestServer();
  t.after(async () => {
    await closeResources();
  });

  const unauthorized = await request(app).get("/api/admin/report");
  assert.equal(unauthorized.status, 401);

  const authorized = await request(app)
    .get("/api/admin/report")
    .set("Authorization", "Bearer test-admin-token");
  assert.equal(authorized.status, 200);
  assert.equal(authorized.body.ok, true);
});

test.after(() => {
  try {
    fs.rmSync(dbAbsolutePath, { force: true });
    fs.rmSync(`${dbAbsolutePath}-shm`, { force: true });
    fs.rmSync(`${dbAbsolutePath}-wal`, { force: true });
  } catch (_error) {
    // no-op
  }
});
