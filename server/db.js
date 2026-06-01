const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { config } = require("./config");
const { logger } = require("./logger");
const { runMigrations } = require("./migrations/runner");

const dbPath = config.dbPath;
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function initializeDatabase() {
  runMigrations(db, logger);
}

function createContactSubmission(payload) {
  const insertContactSubmission = db.prepare(`
    INSERT INTO contact_submissions (
      first_name,
      last_name,
      email,
      subject,
      message,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = insertContactSubmission.run(
    payload.first_name,
    payload.last_name,
    payload.email,
    payload.subject,
    payload.message,
    payload.created_at
  );
  return Number(result.lastInsertRowid);
}

function deleteSubmissionById(id) {
  const deleteSubmissionByIdStatement = db.prepare(`
    DELETE FROM contact_submissions WHERE id = ?
  `);
  const result = deleteSubmissionByIdStatement.run(id);
  return result.changes > 0;
}

function listSubmissions(limit, offset) {
  const listSubmissionsStatement = db.prepare(`
    SELECT id, first_name, last_name, email, subject, message, created_at
    FROM contact_submissions
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  return listSubmissionsStatement.all(limit, offset);
}

function purgeSubmissionsOlderThan(cutoffIso) {
  const purgeOlderThanStatement = db.prepare(`
    DELETE FROM contact_submissions WHERE created_at < ?
  `);
  const result = purgeOlderThanStatement.run(cutoffIso);
  return result.changes;
}

function getSubmissionReport() {
  const reportStatement = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS last_24h,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS last_7d
    FROM contact_submissions
  `);
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return reportStatement.get(last24h, last7d);
}

async function createBackup(backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  const name = `podcast-${Date.now()}.db`;
  const targetPath = path.join(backupDir, name);
  await db.backup(targetPath);
  return targetPath;
}

module.exports = {
  db,
  dbPath,
  initializeDatabase,
  createContactSubmission,
  deleteSubmissionById,
  listSubmissions,
  purgeSubmissionsOlderThan,
  getSubmissionReport,
  createBackup,
};
