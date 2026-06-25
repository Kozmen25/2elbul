-- Professional source synchronization for bot-managed listings.
-- Adds source-aware identity, update timestamps, inactive/reactivation states
-- and per-run synchronization counters.

alter table public.listings
  add column if not exists source_id bigint references public.sources(id) on delete set null,
  add column if not exists description text null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz null;

alter table public.listings
  drop constraint if exists listings_status_check;

alter table public.listings
  add constraint listings_status_check
  check (status in ('pending', 'published', 'rejected', 'active', 'inactive'));

create unique index if not exists listings_source_id_external_id_key
  on public.listings(source_id, external_id)
  where source_id is not null and external_id is not null;

create unique index if not exists listings_source_id_url_key
  on public.listings(source_id, url)
  where source_id is not null;

create index if not exists listings_source_id_status_idx
  on public.listings(source_id, status);

create or replace function public.set_listing_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row
  execute function public.set_listing_updated_at();

alter table public.bot_runs
  add column if not exists updated_count int not null default 0,
  add column if not exists inactive_count int not null default 0,
  add column if not exists reactivated_count int not null default 0;

create or replace function public.sync_source_listings(
  p_source_id bigint,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_found int := 0;
  v_inserted int := 0;
  v_updated int := 0;
  v_inactivated int := 0;
  v_reactivated int := 0;
  v_skipped int := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('2elbul-source-sync:' || p_source_id::text, 0));

  create temporary table tmp_source_sync_items (
    external_id text not null,
    product_id bigint not null,
    title text not null,
    price numeric(12, 2) not null,
    city text not null,
    source text not null,
    url text not null,
    condition text not null,
    image_url text null,
    description text null,
    status text not null,
    raw_payload jsonb null,
    matched_listing_id bigint null,
    was_inactive boolean not null default false,
    has_changes boolean not null default false
  ) on commit drop;

  insert into tmp_source_sync_items (
    external_id,
    product_id,
    title,
    price,
    city,
    source,
    url,
    condition,
    image_url,
    description,
    status,
    raw_payload
  )
  select distinct on (external_id)
    external_id,
    product_id,
    title,
    price,
    city,
    source,
    url,
    condition,
    image_url,
    description,
    status,
    raw_payload
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    external_id text,
    product_id bigint,
    title text,
    price numeric,
    city text,
    source text,
    url text,
    condition text,
    image_url text,
    description text,
    status text,
    raw_payload jsonb
  )
  where external_id is not null
    and product_id is not null
    and title is not null
    and price is not null
    and city is not null
    and source is not null
    and url is not null
    and condition is not null
  order by external_id, url;

  get diagnostics v_found = row_count;

  update tmp_source_sync_items item
  set
    matched_listing_id = listing.id,
    was_inactive = listing.status = 'inactive',
    has_changes =
      listing.title is distinct from item.title or
      listing.price is distinct from item.price or
      listing.city is distinct from item.city or
      listing.source is distinct from item.source or
      listing.url is distinct from item.url or
      listing.condition is distinct from item.condition or
      listing.image_url is distinct from item.image_url or
      listing.description is distinct from item.description
  from lateral (
    select id, title, price, city, source, url, condition, image_url, description, status
    from public.listings
    where source_id = p_source_id
      and (external_id = item.external_id or url = item.url)
    order by case when external_id = item.external_id then 0 else 1 end, id
    limit 1
  ) listing;

  update public.listings listing
  set
    product_id = item.product_id,
    external_id = item.external_id,
    title = item.title,
    price = item.price,
    city = item.city,
    source = item.source,
    url = item.url,
    condition = item.condition,
    image_url = item.image_url,
    description = item.description,
    raw_payload = item.raw_payload,
    status = case when listing.status = 'inactive' then 'active' else listing.status end,
    last_seen_at = now()
  from tmp_source_sync_items item
  where listing.id = item.matched_listing_id
    and (item.has_changes or item.was_inactive);

  select count(*) into v_updated
  from tmp_source_sync_items
  where matched_listing_id is not null
    and has_changes
    and not was_inactive;

  select count(*) into v_reactivated
  from tmp_source_sync_items
  where matched_listing_id is not null
    and was_inactive;

  select count(*) into v_skipped
  from tmp_source_sync_items
  where matched_listing_id is not null
    and not has_changes
    and not was_inactive;

  insert into public.listings (
    source_id,
    external_id,
    product_id,
    title,
    price,
    city,
    source,
    url,
    condition,
    image_url,
    description,
    status,
    raw_payload,
    imported_at,
    last_seen_at
  )
  select
    p_source_id,
    external_id,
    product_id,
    title,
    price,
    city,
    source,
    url,
    condition,
    image_url,
    description,
    status,
    raw_payload,
    now(),
    now()
  from tmp_source_sync_items
  where matched_listing_id is null
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  with inactive_rows as (
    update public.listings listing
    set status = 'inactive'
    where listing.source_id = p_source_id
      and listing.status <> 'inactive'
      and not exists (
        select 1
        from tmp_source_sync_items item
        where item.external_id = listing.external_id
           or item.url = listing.url
      )
    returning 1
  )
  select count(*) into v_inactivated from inactive_rows;

  return jsonb_build_object(
    'found', v_found,
    'inserted', v_inserted,
    'updated', v_updated,
    'inactive', v_inactivated,
    'reactivated', v_reactivated,
    'skipped', v_skipped
  );
end;
$$;
