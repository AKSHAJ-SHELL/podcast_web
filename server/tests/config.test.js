const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { createConfig } = require("../config");

test("createConfig resolves relative DB_PATH from server directory", () => {
  const cfg = createConfig({
    DB_PATH: "./data/testing.db",
    CORS_ORIGINS: "http://localhost:3000",
  });
  assert.equal(
    cfg.dbPath,
    path.join(path.dirname(require.resolve("../config")), "data", "testing.db")
  );
});

test("createConfig rejects production without REDIS_URL", () => {
  assert.throws(
    () =>
      createConfig({
        NODE_ENV: "production",
        CORS_ORIGINS: "https://example.com",
        SMTP_HOST: "smtp.example.com",
        SMTP_USER: "mailer@example.com",
        SMTP_PASS: "secret",
        CONTACT_NOTIFY_TO: "ops@example.com",
        ADMIN_API_TOKEN: "token",
      }),
    /REDIS_URL is required/
  );
});
