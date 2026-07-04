-- Source Engine safety migration
-- Manual/debug/limited source runs should not mark unseen listings inactive.

create or replace function public.sync_source_listings(
  p_source_id bigint,
  p_items jsonb,
  p_skip_inactive_marking boolean default false
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
    old_price numeric(12, 2) null,
    brand text null,
    model text null,
    storage text null,
    ram text null,
    color text null,
    warranty text null,
    seller_name text null,
    source_type text null,
    category text null,
    status text not null,
    raw_payload jsonb null,
    matched_listing_id bigint null,
    previous_price numeric(12, 2) null,
    was_inactive boolean not null default false,
    price_changed boolean not null default false,
    has_changes boolean not null default false
  ) on commit drop;

  insert into tmp_source_sync_items (
    external_id, product_id, title, price, city, source, url, condition,
    image_url, description, old_price, brand, model, storage, ram, color,
    warranty, seller_name, source_type, category, status, raw_payload
  )
  select distinct on (external_id)
    external_id, product_id, title, price, city, source, url, condition,
    image_url, description, old_price, brand, model, storage, ram, color,
    warranty, seller_name, source_type, category, status, raw_payload
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
    old_price numeric,
    brand text,
    model text,
    storage text,
    ram text,
    color text,
    warranty text,
    seller_name text,
    source_type text,
    category text,
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

  with matched as (
    select distinct on (item.external_id)
      item.external_id as item_external_id,
      listing.id,
      listing.title,
      listing.price,
      listing.city,
      listing.source,
      listing.url,
      listing.condition,
      listing.image_url,
      listing.description,
      listing.old_price,
      listing.brand,
      listing.model,
      listing.storage,
      listing.ram,
      listing.color,
      listing.warranty,
      listing.seller_name,
      listing.source_type,
      listing.category,
      listing.status
    from tmp_source_sync_items item
    join public.listings listing
      on listing.source_id = p_source_id
      and (listing.external_id = item.external_id or listing.url = item.url)
    order by
      item.external_id,
      case when listing.external_id = item.external_id then 0 else 1 end,
      listing.id
  )
  update tmp_source_sync_items item
  set
    matched_listing_id = matched.id,
    previous_price = matched.price,
    was_inactive = matched.status = 'inactive',
    price_changed = matched.price is distinct from item.price,
    has_changes =
      matched.title is distinct from item.title or
      matched.price is distinct from item.price or
      matched.city is distinct from item.city or
      matched.source is distinct from item.source or
      matched.url is distinct from item.url or
      matched.condition is distinct from item.condition or
      matched.image_url is distinct from item.image_url or
      matched.description is distinct from item.description or
      matched.old_price is distinct from item.old_price or
      matched.brand is distinct from item.brand or
      matched.model is distinct from item.model or
      matched.storage is distinct from item.storage or
      matched.ram is distinct from item.ram or
      matched.color is distinct from item.color or
      matched.warranty is distinct from item.warranty or
      matched.seller_name is distinct from item.seller_name or
      matched.source_type is distinct from item.source_type or
      matched.category is distinct from item.category
  from matched
  where matched.item_external_id = item.external_id;

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
    old_price = item.old_price,
    brand = item.brand,
    model = item.model,
    storage = item.storage,
    ram = item.ram,
    color = item.color,
    warranty = item.warranty,
    seller_name = item.seller_name,
    source_type = item.source_type,
    category = item.category,
    raw_payload = item.raw_payload,
    status = case when listing.status = 'inactive' then 'active' else listing.status end,
    inactive_at = case when listing.status = 'inactive' then null else listing.inactive_at end,
    last_seen_at = now()
  from tmp_source_sync_items item
  where listing.id = item.matched_listing_id
    and (item.has_changes or item.was_inactive);

  insert into public.price_history (
    product_id,
    listing_id,
    source,
    price,
    recorded_at
  )
  select
    item.product_id,
    item.matched_listing_id,
    item.source,
    item.price::bigint,
    now()
  from tmp_source_sync_items item
  where item.matched_listing_id is not null
    and item.price_changed
    and not exists (
      select 1
      from public.price_history history
      where history.listing_id = item.matched_listing_id
        and history.recorded_at::date = current_date
        and history.price = item.price::bigint
    );

  select count(*) into v_updated
  from tmp_source_sync_items
  where matched_listing_id is not null and has_changes and not was_inactive;

  select count(*) into v_reactivated
  from tmp_source_sync_items
  where matched_listing_id is not null and was_inactive;

  select count(*) into v_skipped
  from tmp_source_sync_items
  where matched_listing_id is not null and not has_changes and not was_inactive;

  with inserted_rows as (
    insert into public.listings (
      source_id, external_id, product_id, title, price, city, source, url,
      condition, image_url, description, old_price, brand, model, storage, ram,
      color, warranty, seller_name, source_type, category, status, raw_payload,
      imported_at, first_seen_at, last_seen_at
    )
    select
      p_source_id, external_id, product_id, title, price, city, source, url,
      condition, image_url, description, old_price, brand, model, storage, ram,
      color, warranty, seller_name, source_type, category, status, raw_payload,
      now(), now(), now()
    from tmp_source_sync_items
    where matched_listing_id is null
    on conflict do nothing
    returning id, product_id, source, price
  ),
  inserted_history as (
    insert into public.price_history (
      product_id,
      listing_id,
      source,
      price,
      recorded_at
    )
    select
      product_id,
      id,
      source,
      price::bigint,
      now()
    from inserted_rows
    returning 1
  )
  select count(*) into v_inserted from inserted_rows;

  with inactive_rows as (
    update public.listings listing
    set
      status = 'inactive',
      inactive_at = coalesce(listing.inactive_at, now())
    where not p_skip_inactive_marking
      and listing.source_id = p_source_id
      and listing.status <> 'inactive'
      and not exists (
        select 1
        from tmp_source_sync_items item
        where item.external_id = listing.external_id or item.url = listing.url
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
