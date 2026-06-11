-- consented_at and consent_version are nullable by definition so that fresh
-- and migrated databases have identical schemas (rows predating consent
-- capture cannot be backfilled honestly). The application always writes both.
create table if not exists contact_submissions (
  id bigserial primary key,
  first_name text not null check (length(first_name) <= 100),
  last_name text not null check (length(last_name) <= 100),
  email text not null check (length(email) <= 254),
  subject text not null check (length(subject) <= 100),
  message text not null check (length(message) <= 5000),
  consented_at timestamptz,
  consent_version text,
  created_at timestamptz not null default now()
);
create index if not exists idx_contact_submissions_created_at
  on contact_submissions(created_at desc);

-- Upgrade path for databases created before consent capture existed.
alter table contact_submissions
  add column if not exists consented_at timestamptz;
alter table contact_submissions
  add column if not exists consent_version text;

-- Durable fixed-window rate limiting (keyed on an HMAC-SHA256 of the client
-- IP -- peppered, so no raw or enumerable IP hashes are stored).
create table if not exists contact_rate_limits (
  key_hash text primary key check (length(key_hash) = 64),
  window_start timestamptz not null,
  count integer not null check (count >= 0)
);
