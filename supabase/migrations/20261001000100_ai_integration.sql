-- Gemini AI integration: settings managed from the admin panel and a usage log.
--
-- Both tables are service-role only (RLS on, no policies), like email_settings:
-- the API key is stored encrypted (AES-256-GCM, key in
-- EMAIL_SETTINGS_ENCRYPTION_KEY, see lib/email/crypto.ts) and must never be
-- readable with the public anon key.

-- 1) Settings — exactly one row (id = 1).
create table if not exists public.ai_settings (
  id                      smallint primary key default 1 check (id = 1),
  -- Master switch. Off by default: nothing calls the model until an admin turns it on.
  enabled                 boolean not null default false,
  api_key_encrypted       text,
  -- Informational Google Cloud details shown in the panel (not secrets).
  key_label               text,
  project_name            text,
  project_number          text,
  model                   text not null default 'gemini-3.5-flash-lite',
  feature_search          boolean not null default true,
  feature_classification  boolean not null default true,
  feature_matching        boolean not null default true,
  -- Suggestions below this confidence (0..1) are ignored.
  min_confidence          numeric(3, 2) not null default 0.70
                          check (min_confidence between 0.30 and 0.99),
  -- Calls allowed in any rolling 24 hours; 0 blocks every call.
  daily_request_limit     integer not null default 500
                          check (daily_request_limit between 0 and 100000),
  timeout_ms              integer not null default 8000
                          check (timeout_ms between 1000 and 30000),
  last_test_at            timestamptz,
  last_test_ok            boolean,
  last_test_error         text,
  updated_at              timestamptz not null default now(),
  updated_by              uuid references auth.users(id) on delete set null
);

insert into public.ai_settings (id) values (1) on conflict (id) do nothing;

alter table public.ai_settings enable row level security;

drop trigger if exists ai_settings_set_updated_at on public.ai_settings;
create trigger ai_settings_set_updated_at
  before update on public.ai_settings
  for each row
  execute function public.set_updated_at();

create index if not exists ai_settings_updated_by_idx
  on public.ai_settings (updated_by);

-- 2) Usage log. Holds who/what/outcome and a short preview of the input
--    (a search query or listing title) — never the model's full answer.
create table if not exists public.ai_logs (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  feature        text not null check (feature in ('search', 'classification', 'matching', 'test')),
  model          text not null,
  ok             boolean not null,
  error          text,
  latency_ms     integer,
  prompt_tokens  integer,
  output_tokens  integer,
  input_preview  text
);

alter table public.ai_logs enable row level security;

create index if not exists ai_logs_created_at_idx on public.ai_logs (created_at desc);
create index if not exists ai_logs_feature_created_at_idx on public.ai_logs (feature, created_at desc);
