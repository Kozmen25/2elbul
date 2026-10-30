-- 2026-08-29 — Admin user management.
-- DB grants for admin identity (dual gate with ADMIN_EMAILS env allow-list) and
-- a privacy-safe admin audit trail.
--
-- PRIVACY: admin_audit_logs.metadata may ONLY be written through
-- lib/auth/audit.ts sanitizeAuditMetadata(). It must never contain passwords,
-- tokens, secrets, or raw IPs.

create table if not exists public.admin_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id             bigint generated always as identity primary key,
  admin_user_id  uuid references auth.users(id) on delete set null,
  action         text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata       jsonb,
  ip_address     text,
  created_at     timestamptz not null default now()
);

create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs (target_user_id);
create index if not exists admin_audit_logs_admin_idx  on public.admin_audit_logs (admin_user_id);

-- RLS enabled; no policies. Both service-role (admin server actions) and anon
-- see nothing here. Admin identity is never client-facing.
alter table public.admin_roles      enable row level security;
alter table public.admin_audit_logs enable row level security;
