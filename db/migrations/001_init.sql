-- OpenTip schema. Every tenant table carries org_id and is protected by Postgres RLS.
-- The app connects as the owner role, then `SET LOCAL ROLE opentip_app` (no BYPASSRLS) and
-- `set_config('app.org_id', ...)` inside every request transaction (see src/lib/db.ts).
-- Model A (one org per deployment) is simply Model B with a single row in `organizations`.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'opentip_app') then
    create role opentip_app nologin;
  end if;
end $$;
grant opentip_app to current_user;

create or replace function app_org() returns uuid language sql stable as
  $$ select nullif(current_setting('app.org_id', true), '')::uuid $$;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 1 and 120),
  org_type text not null check (org_type in ('crime_stoppers', 'campus')),
  hotline text,
  primary_color text not null default '#1d4ed8' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  max_reward_cents integer not null default 0 check (max_reward_cents >= 0),
  -- data retention (enforced by /api/cron/purge)
  retention_days integer not null default 365 check (retention_days between 1 and 3650),
  audit_retention_days integer not null default 1095 check (audit_retention_days between 30 and 3650),
  backup_retention_days integer not null default 7 check (backup_retention_days between 0 and 365),
  -- evidence limits (MB)
  image_mb integer not null default 10 check (image_mb between 1 and 100),
  doc_mb integer not null default 10 check (doc_mb between 1 and 100),
  av_mb integer not null default 25 check (av_mb between 1 and 500),
  tip_mb integer not null default 50 check (tip_mb between 1 and 500),
  max_files integer not null default 10 check (max_files between 0 and 30),
  -- escalation channels
  escalation_email_mode text not null default 'on_call' check (escalation_email_mode in ('on_call', 'admins', 'off')),
  escalation_webhook_url text check (escalation_webhook_url is null or escalation_webhook_url ~ '^https://'),
  created_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  external_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index locations_external on locations (org_id, external_id) where external_id is not null;

create table categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  sort integer not null default 0,
  active boolean not null default true,
  high_risk boolean not null default false
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  unique (org_id, name)
);

create table category_teams (
  org_id uuid not null references organizations on delete cascade,
  category_id uuid not null references categories on delete cascade,
  team_id uuid not null references teams on delete cascade,
  primary key (category_id, team_id)
);

-- Staff. This is the ONLY place personal identity lives (staff email/name).
create table reviewers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  email text not null,
  name text not null,
  password_hash text not null,
  role text not null default 'reviewer' check (role in ('admin', 'reviewer')),
  all_tips boolean not null default false,   -- broader access than team-routed tips
  on_call boolean not null default false,    -- receives escalation notifications
  active boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
create unique index reviewers_email on reviewers (org_id, lower(email));

create table team_members (
  org_id uuid not null references organizations on delete cascade,
  team_id uuid not null references teams on delete cascade,
  reviewer_id uuid not null references reviewers on delete cascade,
  primary key (team_id, reviewer_id)
);

create table sessions (
  token_hash text primary key,
  org_id uuid not null references organizations on delete cascade,
  reviewer_id uuid not null references reviewers on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ---- Tipster-facing tables: tips, messages, media, push_subscriptions ----
-- ANONYMITY RULE: no column here may identify a person or device (no ip, user agent, email,
-- phone, device id, filename...). tests/anonymity.test.ts enforces an exact column allowlist.

create table tips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  tip_id text not null unique,
  passcode_hash text not null,
  location_id uuid references locations on delete set null,
  category_id uuid not null references categories,
  urgent boolean not null default false,
  description text not null default '' check (char_length(description) <= 5000),
  status text not null default 'new' check (status in ('new', 'under_review', 'actioned', 'closed')),
  needs_reply boolean not null default true,
  assigned_reviewer_id uuid references reviewers on delete set null,
  closure_reason text check (closure_reason in ('actioned', 'unfounded', 'referred', 'other')),
  closure_note text check (char_length(closure_note) <= 2000),
  closed_at timestamptz,
  first_response_at timestamptz,
  reward_eligible boolean not null default false,
  reward_amount_cents integer check (reward_amount_cents >= 0),
  claim_code_hash text,
  claim_code_revealed_at timestamptz,
  claimed_at timestamptz,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  claim_failed_attempts integer not null default 0,
  claim_locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tips_queue on tips (org_id, status, created_at desc);

create table tip_teams (
  org_id uuid not null references organizations on delete cascade,
  tip_id uuid not null references tips on delete cascade,
  team_id uuid not null references teams on delete cascade,
  primary key (tip_id, team_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  org_id uuid not null references organizations on delete cascade,
  tip_id uuid not null references tips on delete cascade,
  sender text not null check (sender in ('tipster', 'reviewer')),
  reviewer_id uuid references reviewers on delete set null, -- staff identity; never shown to the tipster
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index messages_tip on messages (tip_id, seq);

create table internal_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  tip_id uuid not null references tips on delete cascade,
  reviewer_id uuid references reviewers on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

-- Evidence. Original filenames are deliberately NOT stored.
create table media (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  tip_id uuid not null references tips on delete cascade,
  kind text not null check (kind in ('image', 'video', 'audio', 'document')),
  mime text not null,
  size_bytes bigint not null,
  storage_key text not null,
  created_at timestamptz not null default now()
);

-- Web Push: the opaque subscription object and nothing else.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  tip_id uuid not null references tips on delete cascade,
  subscription jsonb not null
);
create unique index push_endpoint on push_subscriptions (tip_id, (subscription ->> 'endpoint'));

create table canned_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  category_id uuid references categories on delete cascade, -- null = available for every category
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 5000)
);

-- Audit trail: STAFF identity only, append-only for the app role (no update/delete grant below).
create table audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations on delete cascade,
  reviewer_id uuid references reviewers on delete set null,
  actor text not null,
  action text not null,
  tip_ref text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index audit_org_time on audit_log (org_id, created_at desc);

-- ---- Row level security: tenant isolation at the database layer ----
alter table organizations enable row level security;
create policy tenant on organizations using (id = app_org()) with check (id = app_org());

do $$
declare t text;
begin
  foreach t in array array[
    'locations', 'categories', 'teams', 'category_teams', 'reviewers', 'team_members', 'sessions',
    'tips', 'tip_teams', 'messages', 'internal_notes', 'media', 'push_subscriptions',
    'canned_responses', 'audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy tenant on %I using (org_id = app_org()) with check (org_id = app_org())', t);
  end loop;
end $$;

grant usage on schema public to opentip_app;
grant select, insert, update, delete on all tables in schema public to opentip_app;
revoke update, delete on audit_log from opentip_app;
