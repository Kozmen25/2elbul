-- Sprint P-10.1: Normalization Fix Rollout
-- Fixes RC-A, RC-B, RC-C, RC-D (PL/pgSQL layer)
--
-- Changes:
-- 1. Fix RC-A: Fallback uses `lowered` variable instead of raw `value`
-- 2. Fix RC-B: Expanded brand detection from 8 to 24 brands
-- 3. Fix RC-C: Added Omix to brand detection
-- 4. Backfill: Fix 5 malformed normalized_keys from the original backfill

-- Step 1: Updated compute_normalized_key() with all fixes
create or replace function public.compute_normalized_key(value text)
returns text
language plpgsql
immutable
as $$
declare
  lowered text;
  brand text;
  model text;
  storage text;
  ram text;
  key_parts text[];
  fallback text;
  iphone_match text[];
  samsung_match text[];
  ipad_match text[];
  macbook_match text[];
begin
  lowered := trim(
    both '-' from regexp_replace(
      lower(
        translate(
          coalesce(value, ''),
          'çğıİöşüÇĞIÖŞÜ',
          'cgiiosuCGIOSU'
        )
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );

  -- Brand detection (expanded: 8 → 24 brands)
  if lowered ~ 'apple|iphone|ipad|macbook|airpods' then
    brand := 'apple';
  elsif lowered ~ 'samsung|galaxy' then
    brand := 'samsung';
  elsif lowered ~ 'xiaomi|redmi|poco' then
    brand := 'xiaomi';
  elsif lowered ~ 'huawei' then
    brand := 'huawei';
  elsif lowered ~ 'google|pixel' then
    brand := 'google';
  elsif lowered ~ 'oneplus' then
    brand := 'oneplus';
  elsif lowered ~ 'realme' then
    brand := 'realme';
  elsif lowered ~ 'oppo' then
    brand := 'oppo';
  elsif lowered ~ 'vivo' then
    brand := 'vivo';
  elsif lowered ~ 'motorola' then
    brand := 'motorola';
  elsif lowered ~ 'nokia' then
    brand := 'nokia';
  elsif lowered ~ 'sony|playstation|ps5|ps4|xperia' then
    brand := 'sony';
  elsif lowered ~ 'nvidia|rtx|geforce' then
    brand := 'nvidia';
  elsif lowered ~ 'omix' then
    brand := 'omix';
  elsif lowered ~ '\mlg\m' then
    brand := 'lg';
  elsif lowered ~ 'lenovo' then
    brand := 'lenovo';
  elsif lowered ~ '\mhp\m' then
    brand := 'hp';
  elsif lowered ~ 'dell' then
    brand := 'dell';
  elsif lowered ~ 'asus' then
    brand := 'asus';
  elsif lowered ~ 'razer' then
    brand := 'razer';
  elsif lowered ~ 'blackberry' then
    brand := 'blackberry';
  elsif lowered ~ 'htc' then
    brand := 'htc';
  elsif lowered ~ 'honor' then
    brand := 'honor';
  elsif lowered ~ 'msi|msı' then
    brand := 'msi';
  elsif lowered ~ 'nothing' then
    brand := 'nothing';
  end if;

  -- iPhone detection
  iphone_match := regexp_matches(lowered, '(iphone[-\s]*)?(1[1-6])[-\s]*(pro[-\s]*max|pro|plus|mini)?', '');
  if (brand = 'apple' or lowered ~ '\m1[1-6][-\s]*(pro[-\s]*max|pro|plus|mini)') and iphone_match is not null then
    model := 'iphone-' || iphone_match[2];
    if iphone_match[3] is not null and iphone_match[3] != '' then
      model := model || '-' || replace(iphone_match[3], ' ', '-');
    end if;
  end if;

  -- Samsung detection (if not already matched as iPhone)
  if model is null then
    samsung_match := regexp_matches(lowered, '(samsung[-\s]*)?(galaxy[-\s]*)?((s|a|m)[0-9]{2}([-\s]*(ultra|plus|fe))?|z[-\s]*(fold|flip)[-\s]*[0-9]?)', '');
    if (brand = 'samsung' or lowered ~ 'galaxy') and samsung_match is not null then
      model := 'galaxy-' || replace(samsung_match[3], ' ', '-');
    end if;
  end if;

  -- iPad detection
  if model is null then
    ipad_match := regexp_matches(lowered, 'ipad[-\s]*(pro|air|mini|[0-9]+)?', '');
    if ipad_match is not null then
      model := 'ipad';
      if ipad_match[1] is not null and ipad_match[1] != '' then
        model := model || '-' || ipad_match[1];
      end if;
    end if;
  end if;

  -- MacBook detection
  if model is null then
    macbook_match := regexp_matches(lowered, 'macbook[-\s]*(air|pro)?[-\s]*(m[0-9])?', '');
    if macbook_match is not null then
      model := 'macbook';
      if macbook_match[1] is not null and macbook_match[1] != '' then
        model := model || '-' || macbook_match[1];
      end if;
      if macbook_match[2] is not null and macbook_match[2] != '' then
        model := model || '-' || macbook_match[2];
      end if;
    end if;
  end if;

  -- Storage detection
  storage := regexp_replace(lowered, '.*?([0-9]{2,4}gb|[0-9]+tb).*', '\1', '');
  if storage = lowered then
    storage := null;
  end if;
  if storage = '1024gb' then
    storage := '1tb';
  end if;

  -- RAM detection
  ram := regexp_replace(lowered, '.*?([0-9]{1,3})[-\s]*gb[-\s]*ram.*', '\1gb', '');
  if ram = lowered then
    ram := null;
  end if;

  -- Assemble key
  key_parts := array_remove(Array[brand, model, storage], null);

  if array_length(key_parts, 1) > 0 then
    return array_to_string(key_parts, '-');
  end if;

  -- Fallback: use the lowered-and-hyphenated name directly
  -- FIX RC-A: was using raw `value` without lowering, causing uppercase chars to strip
  return lowered;
end;
$$;

-- Step 2: Backfill — fix only the 5 malformed keys from RC-A
-- These products had their keys destroyed by the old fallback regex bug
update public.products
set normalized_key = public.compute_normalized_key(name)
where id in (6, 7, 8, 20, 21);

-- Step 3: Resolve any new conflicts introduced by the backfill
-- (The suffix approach mirrors the original migration's conflict resolution)
update public.products p
set normalized_key = p.normalized_key || '-' || p.id
where exists (
  select 1
  from public.products duplicate
  where duplicate.normalized_key = p.normalized_key
    and duplicate.id < p.id
);
