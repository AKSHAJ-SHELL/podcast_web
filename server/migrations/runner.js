const fs = require("fs");
const path = require("path");

const migrationsDir = path.join(__dirname);

function listMigrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function runMigrations(db, logger) {
  ensureMigrationsTable(db);
  const appliedRows = db.prepare("SELECT version FROM schema_migrations").all();
  const applied = new Set(appliedRows.map((row) => row.version));
  const files = listMigrationFiles();

  const insertMigration = db.prepare(`
    INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)
  `);

  for (const file of files) {
    if (applied.has(file)) continue;
    const migrationSql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const now = new Date().toISOString();
    const transaction = db.transaction(() => {
      db.exec(migrationSql);
      insertMigration.run(file, now);
    });
    transaction();
    if (logger) {
      logger.info("db.migration_applied", { migration: file });
    }
  }
}

module.exports = {
  runMigrations,
  listMigrationFiles,
};
