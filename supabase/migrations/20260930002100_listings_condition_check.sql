-- 2026-09-20 — Enforce the canonical condition set at the DB layer.
--
-- listings.condition was `text not null` with no constraint — the 7-value
-- ListingCondition enum only existed in TypeScript (lib/listings.ts), so a
-- typo or a forgotten normalizer call anywhere could write an arbitrary
-- string. Three separate, drifting normalizeCondition() implementations
-- existed in application code; they've been consolidated into one
-- (lib/listing-condition.ts). This migration backfills any stray existing
-- values through the same rules, then locks the column down.

update public.listings
set condition = case
  when condition ilike '%yenilen%' or condition ilike '%refurb%' then 'Yenilenmiş'
  when condition ilike '%sıfır%' or condition ilike '%sifir%' or lower(condition) = 'yeni' then 'Sıfır'
  when condition ilike '%yeni gibi%' then 'Yeni gibi'
  when condition ilike '%çok iyi%' or condition ilike '%cok iyi%' then 'Çok iyi'
  when condition ilike '%kullanılmış%' or condition ilike '%kullanilmis%' then 'Kullanılmış'
  when condition ilike '%2. el%' or condition ilike '%2.el%' or condition ilike '%ikinci el%' then 'İkinci El'
  when condition ilike '%iyi%' then 'İyi'
  else 'İkinci El'
end
where condition not in ('Sıfır', 'Yeni gibi', 'Çok iyi', 'İyi', 'İkinci El', 'Kullanılmış', 'Yenilenmiş');

alter table public.listings drop constraint if exists listings_condition_check;
alter table public.listings
  add constraint listings_condition_check
  check (condition in ('Sıfır', 'Yeni gibi', 'Çok iyi', 'İyi', 'İkinci El', 'Kullanılmış', 'Yenilenmiş'));
