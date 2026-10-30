alter table public.bot_runs
  add column if not exists matched_product_count int not null default 0;

create index if not exists bot_runs_run_type_created_at_idx
  on public.bot_runs(run_type, created_at desc);
