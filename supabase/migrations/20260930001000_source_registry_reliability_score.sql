-- Add reliability_score column to public.sources
-- Source Registry Phase 1: Store source reliability in the DB instead of
-- hardcoded SOURCE_RELIABILITY_RULES in confidence-engine/helpers.ts

alter table public.sources
  add column if not exists reliability_score int
  not null default 65
  check (reliability_score between 0 and 100);

-- Seed values matching current SOURCE_RELIABILITY_RULES from
-- lib/confidence-engine/helpers.ts
update public.sources set reliability_score = 68 where slug = 'sahibinden';
update public.sources set reliability_score = 60 where slug = 'letgo';
update public.sources set reliability_score = 58 where slug = 'facebook-marketplace';
update public.sources set reliability_score = 92 where slug = 'easycep';
update public.sources set reliability_score = 90 where slug = 'getmobil';
update public.sources set reliability_score = 87 where slug = 'yenilenmis-market';
update public.sources set reliability_score = 86 where slug = 'teknosa-yenilenmis';
update public.sources set reliability_score = 85 where slug = 'hepsiburada-yenilenmis';
update public.sources set reliability_score = 84 where slug = 'mediamarkt-yenilenmis';
update public.sources set reliability_score = 65 where slug = 'satariz' and reliability_score = 65;
