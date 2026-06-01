const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");
const { runMigrations } = require("../migrations/runner");

test("runMigrations applies sql files and records versions", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "podcast-migrations-"));
  const dbPath = path.join(tempDir, "test.db");
  const db = new Database(dbPath);

  runMigrations(db);
  const tableRow = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='contact_submissions'")
    .get();
  assert.ok(tableRow, "expected contact_submissions table to exist");

  const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version ASC").all();
  assert.ok(versions.length >= 1, "expected at least one recorded migration");

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
