-- Site-wide settings for admin panel (general info, maintenance mode).

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value)
values
  (
    'general',
    jsonb_build_object(
      'siteName', '2ElBul',
      'siteDescription', 'İkinci elin fiyat rehberi.'
    )
  ),
  (
    'maintenance',
    jsonb_build_object(
      'enabled', false,
      'message', 'Planlı bakım çalışması yapılıyor. Kısa süre içinde tekrar hizmetinizdeyiz.'
    )
  )
on conflict (key) do nothing;

alter table public.site_settings enable row level security;

-- Admin pages use service-role; no public policies on this table.

create or replace function public.get_admin_platform_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('label', day_label, 'value', day_count) order by day_label)
      from (
        select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day_label,
               count(*)::int as day_count
        from public.listings
        where created_at >= now() - interval '14 days'
        group by 1
      ) daily_rows
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('label', source, 'value', cnt) order by cnt desc, source)
      from (
        select source, count(*)::int as cnt
        from public.listings
        group by source
      ) source_rows
    ), '[]'::jsonb),
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object('label', condition_label, 'value', condition_count))
      from (
        select unnest(array['İkinci El', 'Yeni gibi', 'İyi', 'Yenilenmiş']) as condition_label
      ) condition_labels
      left join lateral (
        select count(*)::int as condition_count
        from public.listings l
        where l.condition = condition_labels.condition_label
      ) counts on true
    ), '[]'::jsonb),
    'cities', coalesce((
      select jsonb_agg(jsonb_build_object('label', city, 'value', cnt) order by cnt desc, city)
      from (
        select city, count(*)::int as cnt
        from public.listings
        group by city
        order by cnt desc, city
        limit 12
      ) city_rows
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('label', product_name, 'value', cnt) order by cnt desc, product_name)
      from (
        select p.name as product_name, count(*)::int as cnt
        from public.listings l
        join public.products p on p.id = l.product_id
        group by p.name
        order by cnt desc, p.name
        limit 10
      ) product_rows
    ), '[]'::jsonb),
    'favorites', coalesce((
      select jsonb_agg(jsonb_build_object('label', title, 'value', cnt) order by cnt desc, title)
      from (
        select l.title, count(*)::int as cnt
        from public.favorites f
        join public.listings l on l.id = f.listing_id
        group by l.title
        order by cnt desc, l.title
        limit 10
      ) favorite_rows
    ), '[]'::jsonb),
    'expensiveProducts', coalesce((
      select jsonb_agg(jsonb_build_object('label', product_name, 'value', avg_price) order by avg_price desc, product_name)
      from (
        select p.name as product_name, round(avg(l.price))::int as avg_price
        from public.listings l
        join public.products p on p.id = l.product_id
        group by p.name
        having count(*) >= 1
        order by avg_price desc, p.name
        limit 10
      ) price_rows
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;
