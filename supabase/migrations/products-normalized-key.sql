alter table public.products
  add column if not exists normalized_key text;

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

  -- Brand detection
  if lowered ~ 'apple|iphone|ipad|macbook' then
    brand := 'apple';
  elsif lowered ~ 'samsung|galaxy' then
    brand := 'samsung';
  elsif lowered ~ 'xiaomi|redmi|poco' then
    brand := 'xiaomi';
  elsif lowered ~ 'huawei' then
    brand := 'huawei';
  elsif lowered ~ 'google' then
    brand := 'google';
  elsif lowered ~ 'oneplus' then
    brand := 'oneplus';
  elsif lowered ~ 'realme' then
    brand := 'realme';
  elsif lowered ~ 'oppo' then
    brand := 'oppo';
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
  return lower(regexp_replace(coalesce(value, ''), '[^a-z0-9]+', '-', 'g'));
end;
$$;

update public.products
set normalized_key = public.compute_normalized_key(name)
where normalized_key is null or trim(normalized_key) = '';

update public.products p
set normalized_key = p.normalized_key || '-' || p.id
where exists (
  select 1
  from public.products duplicate
  where duplicate.normalized_key = p.normalized_key
    and duplicate.id < p.id
);

create unique index if not exists products_normalized_key_key
  on public.products(normalized_key);

create or replace function public.set_product_normalized_key()
returns trigger
language plpgsql
as $$
declare
  base_key text;
begin
  if new.normalized_key is null or trim(new.normalized_key) = '' then
    base_key := public.compute_normalized_key(new.name);
    new.normalized_key := base_key;
  else
    base_key := new.normalized_key;
  end if;

  if exists (
    select 1
    from public.products product
    where product.normalized_key = new.normalized_key
      and product.id is distinct from new.id
  ) then
    new.normalized_key := base_key || '-' || coalesce(
      new.id::text,
      substr(md5(new.name), 1, 8)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists products_set_normalized_key on public.products;
create trigger products_set_normalized_key
  before insert or update of name, normalized_key on public.products
  for each row
  execute function public.set_product_normalized_key();
