CREATE TABLE IF NOT EXISTS contact_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL CHECK(length(first_name) <= 100),
  last_name TEXT NOT NULL CHECK(length(last_name) <= 100),
  email TEXT NOT NULL CHECK(length(email) <= 254),
  subject TEXT NOT NULL CHECK(length(subject) <= 100),
  message TEXT NOT NULL CHECK(length(message) <= 5000),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at
  ON contact_submissions(created_at);
