alter table public.products
  add column if not exists slug text;

create or replace function public.slugify_product_name(value text)
returns text
language sql
immutable
as $$
  select trim(
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
$$;

update public.products
set slug = public.slugify_product_name(name)
where slug is null or trim(slug) = '';

update public.products p
set slug = p.slug || '-' || p.id
where exists (
  select 1
  from public.products duplicate
  where duplicate.slug = p.slug
    and duplicate.id < p.id
);

create unique index if not exists products_slug_key
  on public.products(slug);

create or replace function public.set_product_slug()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
begin
  if new.slug is null or trim(new.slug) = '' then
    base_slug := public.slugify_product_name(new.name);
    new.slug := base_slug;
  else
    base_slug := new.slug;
  end if;

  if exists (
    select 1
    from public.products product
    where product.slug = new.slug
      and product.id is distinct from new.id
  ) then
    new.slug := base_slug || '-' || coalesce(
      new.id::text,
      substr(md5(new.name), 1, 8)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists products_set_slug on public.products;
create trigger products_set_slug
  before insert or update of name, slug on public.products
  for each row
  execute function public.set_product_slug();
