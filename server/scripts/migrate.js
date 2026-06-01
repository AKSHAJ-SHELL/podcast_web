require("dotenv").config();
const { initializeDatabase, dbPath } = require("../db");
const { logger } = require("../logger");

try {
  initializeDatabase();
  logger.info("db.migrations_complete", { dbPath });
  process.exit(0);
} catch (error) {
  logger.error("db.migrations_failed", { error: error.message });
  process.exit(1);
}
