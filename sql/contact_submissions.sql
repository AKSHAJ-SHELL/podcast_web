create table if not exists contact_submissions (
  id bigserial primary key,
  first_name text not null check (length(first_name) <= 100),
  last_name text not null check (length(last_name) <= 100),
  email text not null check (length(email) <= 254),
  subject text not null check (length(subject) <= 100),
  message text not null check (length(message) <= 5000),
  created_at timestamptz not null default now()
);
create index if not exists idx_contact_submissions_created_at
  on contact_submissions(created_at desc);
