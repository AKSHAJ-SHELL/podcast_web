const { neon } = require("@neondatabase/serverless");
const { config } = require("./config");
const logger = require("./logger");

async function insertContactSubmission(payload) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sql = neon(process.env.DATABASE_URL);
  const result = await sql`
    INSERT INTO contact_submissions (
      first_name,
      last_name,
      email,
      subject,
      message,
      consented_at,
      consent_version
    ) VALUES (
      ${payload.first_name},
      ${payload.last_name},
      ${payload.email},
      ${payload.subject},
      ${payload.message},
      now(),
      ${config.privacyPolicyVersion}
    )
    RETURNING id, created_at;
  `;

  logger.info("db.insert_contact_submission", { id: result[0] && result[0].id });
  return result[0];
}

async function purgeSubmissionsOlderThan(days) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sql = neon(process.env.DATABASE_URL);
  const result = await sql`
    delete from contact_submissions
    where created_at < now() - make_interval(days => ${days})
    returning id;
  `;
  return result.length;
}

module.exports = {
  insertContactSubmission,
  purgeSubmissionsOlderThan,
};
