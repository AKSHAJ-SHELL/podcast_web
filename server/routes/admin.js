const express = require("express");
const path = require("path");
const {
  listSubmissions,
  deleteSubmissionById,
  purgeSubmissionsOlderThan,
  getSubmissionReport,
  createBackup,
} = require("../db");
const { config } = require("../config");
const { logger } = require("../logger");
const { incrementCounter } = require("../metrics");

const router = express.Router();

function authorize(req, res, next) {
  if (!config.adminApiToken) {
    return res.status(503).json({ ok: false, error: "Admin API is not configured." });
  }

  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const token = bearerToken || req.headers["x-admin-token"];

  if (token !== config.adminApiToken) {
    incrementCounter("admin.auth.failure");
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }
  return next();
}

router.use(authorize);

router.get("/submissions", (req, res) => {
  const limit = Math.min(Number.parseInt(String(req.query.limit || "100"), 10) || 100, 500);
  const offset = Math.max(Number.parseInt(String(req.query.offset || "0"), 10) || 0, 0);
  const submissions = listSubmissions(limit, offset);
  return res.json({ ok: true, data: submissions, limit, offset });
});

router.get("/report", (_req, res) => {
  return res.json({ ok: true, report: getSubmissionReport() });
});

router.delete("/submissions/:id", (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: "Invalid submission id." });
  }
  const deleted = deleteSubmissionById(id);
  return res.json({ ok: true, deleted });
});

router.post("/submissions/purge", (req, res) => {
  const daysRaw = req.body.older_than_days;
  const days = Number.parseInt(String(daysRaw || config.db.retentionDays), 10);
  if (!Number.isInteger(days) || days < 1) {
    return res.status(400).json({ ok: false, error: "older_than_days must be >= 1." });
  }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const deleted = purgeSubmissionsOlderThan(cutoff);
  incrementCounter("admin.purge.executed");
  logger.info("admin.purge_complete", { olderThanDays: days, deleted });
  return res.json({ ok: true, deleted, cutoff });
});

router.post("/backup", async (_req, res) => {
  try {
    const backupPath = await createBackup(config.db.backupDir);
    incrementCounter("admin.backup.success");
    return res.json({
      ok: true,
      backup: {
        file: path.basename(backupPath),
        path: backupPath,
      },
    });
  } catch (error) {
    incrementCounter("admin.backup.failure");
    logger.error("admin.backup_failed", { error: error.message });
    return res.status(500).json({ ok: false, error: "Backup failed." });
  }
});

module.exports = router;
