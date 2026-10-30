-- Single category system: every product belongs to exactly one category,
-- assigned in the database.
--
-- Before: the category a product "belonged to" was recomputed at read time by
-- several independent code paths (keyword routes in lib/category-intelligence.ts,
-- a product-type override on the homepage, a slug derived from free text on the
-- product page, a name-derived slug in the mobile API). They disagreed, so a
-- product could appear under a category in one place and be missing from it in
-- another, and products.category_id was only filled by a one-off script.
--
-- After:
--   * public.categories is the only definition of the taxonomy, including the
--     keyword rules (match_keywords / exclude_keywords).
--   * products.category_id is NOT NULL and points at the most specific
--     category (a subcategory when one matches, otherwise the main category).
--   * A BEFORE INSERT trigger assigns it for every insert path (bots, admin
--     import, scripts) via classify_product_category(). Nothing that is not
--     recognised is dropped: it goes to the fallback category "Diğer".
--   * products.category (text) becomes a mirror of the assigned main
--     category's name, kept in sync by the same trigger.
-- Application code reads membership from category_id only.

-- ---------------------------------------------------------------------------
-- 1) Taxonomy cleanup
-- ---------------------------------------------------------------------------

alter table public.categories
  add column if not exists is_fallback boolean not null default false;

create unique index if not exists categories_single_fallback_idx
  on public.categories (is_fallback) where is_fallback;

-- Duplicates of other subcategories (same items under two parents):
--   bilgisayar-parcalari == yedek-parca-bilgisayar
--   aksesuar-kulaklik    == tv-ses-kulaklik
-- No product references them (category_id held main categories only).
delete from public.categories where slug in ('bilgisayar-parcalari', 'aksesuar-kulaklik');

insert into public.categories (slug, parent_id, name, icon, short_description, long_description, display_order, is_fallback)
values (
  'diger', null, 'Diğer', 'PackageSearch',
  'Henüz bir kategoriye yerleşmeyen ürünler',
  'Diğer kategorilere uymayan ikinci el ürünler için fiyat rehberi ve piyasa özeti.',
  1000, true
)
on conflict (slug) do update set is_fallback = true, parent_id = null;

-- Main-category keyword rules. Matching is on word starts of the normalised
-- product name (see category_keywords_match), evaluated in display_order;
-- the first main category that matches and is not excluded wins.
update public.categories set
  match_keywords = array['telefon','cep telefonu','akilli telefon','smartphone','iphone','samsung galaxy s','samsung galaxy a','samsung galaxy m','samsung galaxy z','samsung galaxy note','xiaomi','redmi','poco','oppo','vivo','honor','huawei','realme','general mobile','oneplus','google pixel','motorola','nokia','tecno','infinix'],
  exclude_keywords = array['tablet','ipad','galaxy tab','watch','saat','kulaklik','airpods','buds','konsol','laptop','bilgisayar','ekran koruyucu','temperli cam','kilif','sarj aleti','sarj cihazi','kablo seti','data kablo','usb kablo','sarj kablo','powerbank','power bank','batarya','yedek parca','sarj soketi','tutucu','adaptor','adapter','lens','selfie','monopod','kizak','hub','mouse','mause','klavye','aksesuar','vivobook','magicbook','matebook','notebook','macbook','chromebook','xiaomi pad','redmi pad','matepad'],
  long_description = 'iPhone, Samsung Galaxy, Xiaomi ve diğer akıllı telefonlar için ikinci el fiyat rehberi, fırsat sinyalleri ve kaynak dağılımı.'
where slug = 'telefon';

update public.categories set
  match_keywords = array['bilgisayar','laptop','notebook','macbook','imac','mac mini','masaustu','desktop','oyuncu bilgisayari','gaming pc','thinkpad','ideapad','legion','victus','pavilion','omen','monster','asus rog','rog strix','zenbook','vivobook','magicbook','lenovo','dell','hp laptop','acer','chromebook','matebook','tablet','ipad','galaxy tab','xiaomi pad','redmi pad','matepad'],
  exclude_keywords = array['telefon','iphone','konsol','ekran karti','monitor','batarya','yedek parca','sarj aleti','kilif','canta'],
  long_description = 'MacBook, laptop, notebook, masaüstü bilgisayar ve tabletler için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.'
where slug = 'bilgisayar';

update public.categories set
  match_keywords = array['konsol','oyun konsolu','playstation','ps5','ps4','xbox','series s','series x','nintendo','switch','dualsense','joy con','wii','steam deck'],
  exclude_keywords = array['telefon','iphone','laptop','bilgisayar','tablet'],
  long_description = 'PlayStation 5, Xbox, Nintendo Switch ve oyun konsolları için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.'
where slug = 'konsol';

update public.categories set
  match_keywords = array['tv','televizyon','smart tv','oled','qled','led tv','ses sistemi','soundbar','hoparlor','kulaklik','airpods','galaxy buds','buds','jbl','marshall','bose','monitor'],
  exclude_keywords = array['telefon','iphone','laptop','bilgisayar','konsol','playstation','ps5','tablet','ekran karti','kilif','kablo seti','data kablo','usb kablo','sarj kablo','aksesuar'],
  long_description = 'Smart TV, OLED, QLED, soundbar, hoparlör, kulaklık ve monitörler için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.'
where slug = 'tv-ses';

update public.categories set
  match_keywords = array['arac','vasita','otomobil','araba','motosiklet','scooter','suv','pickup','minivan','panelvan','kamyonet','ticari arac','elektrikli arac','karavan','fiat','renault','volkswagen','honda','toyota','ford','hyundai','opel','peugeot','citroen','dacia','skoda','nissan','kia','seat','bmw','mercedes','audi','volvo','tofas','togg','tesla'],
  exclude_keywords = array['telefon','laptop','emlak','daire','arsa','yedek parca','ekran karti','jant','lastik','oto teyp','tampon'],
  long_description = 'Otomobil, motosiklet, SUV ve ticari araçlar için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.'
where slug = 'arac';

update public.categories set
  match_keywords = array['emlak','konut','daire','villa','mustakil','arsa','tarla','isyeri','is yeri','ofis','dukkan','magaza','kiralik','satilik','rezidans','devre mulk'],
  exclude_keywords = array['arac','otomobil','telefon','laptop','yedek parca','koltuk','sandalye','masa','mobilya'],
  long_description = 'Konut, daire, villa, arsa ve iş yerleri için satılık ve kiralık fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.'
where slug = 'emlak';

update public.categories set
  match_keywords = array['yedek parca','ekran karti','islemci','anakart','ram','ssd','hdd','nvme','ddr4','ddr5','psu','rtx','gtx','radeon','ryzen','i3','i5','i7','i9','jant','lastik','far takimi','sis fari','stop lambasi','tampon','oto teyp','oto aku','batarya','sarj soketi','ekran degisimi','rezistans'],
  exclude_keywords = array['emlak','daire'],
  long_description = 'Ekran kartı, işlemci, RAM, SSD, telefon yedek parçası ve otomotiv parçaları için ikinci el fiyat rehberi.'
where slug = 'yedek-parca';

update public.categories set
  match_keywords = array['beyaz esya','mobilya','klima','supurge','camasir','bulasik','kurutma makinesi','firin','ocak','utu','dekorasyon','hali','perde','avize','buzdolabi','derin dondurucu','kahve makinesi','blender','airfryer','mikrodalga','koltuk','yemek odasi','yatak odasi'],
  exclude_keywords = array['telefon','iphone','laptop','bilgisayar','konsol','tv','arac','emlak'],
  long_description = 'Beyaz eşya, mobilya, küçük ev aletleri ve ev dekorasyonu için ikinci el fiyat rehberi ve piyasa istihbaratı.'
where slug = 'ev-yasam';

update public.categories set
  match_keywords = array['aksesuar','kilif','kapak','sarj aleti','sarj cihazi','powerbank','power bank','ekran koruyucu','ekran koruma','temperli cam','kablo seti','data kablo','usb kablo','sarj kablo','usb c','tutucu','adaptor','adapter','donusturucu','lens kiti','selfie','monopod'],
  exclude_keywords = array['laptop','bilgisayar','tv','televizyon','konsol','playstation','arac','otomobil','emlak','daire'],
  long_description = 'Kılıf, şarj aleti, powerbank, ekran koruyucu, kablo, tutucu ve diğer telefon aksesuarları için ikinci el fiyat rehberi, fırsat sinyalleri ve piyasa istihbaratı.'
where slug = 'aksesuar';

-- Subcategory keyword rules (evaluated only inside the chosen main category,
-- in display_order; no match keeps the product on the main category).
update public.categories c set match_keywords = v.m, exclude_keywords = v.x
from (values
  ('bilgisayar-laptop',   array['laptop','notebook','macbook','dizustu','thinkpad','ideapad','legion','asus rog','rog strix','zenbook','vivobook','magicbook','victus','pavilion','omen','monster','chromebook','matebook','xps','inspiron','latitude','aspire','nitro','predator'], array[]::text[]),
  ('bilgisayar-masaustu', array['masaustu','desktop','imac','mac mini','mac studio','gaming pc','oyuncu bilgisayari','all in one'], array[]::text[]),
  ('bilgisayar-tablet',   array['tablet','ipad','galaxy tab','lenovo tab','matepad','xiaomi pad','redmi pad'], array[]::text[]),
  ('konsol-playstation',  array['playstation','ps5','ps4'], array['kol','dualsense','gamepad','joystick']),
  ('konsol-xbox',         array['xbox','series s','series x'], array['kol','gamepad','joystick']),
  ('konsol-nintendo',     array['nintendo','switch'], array['joy con','kol']),
  ('konsol-aksesuar',     array['oyun kolu','kol','dualsense','joy con','gamepad','joystick'], array[]::text[]),
  ('tv-ses-televizyon',   array['tv','televizyon','smart tv','oled','qled','led tv'], array['monitor']),
  ('tv-ses-kulaklik',     array['kulaklik','airpods','galaxy buds','buds'], array[]::text[]),
  ('tv-ses-hoparlor',     array['ses sistemi','soundbar','hoparlor','jbl','marshall','bose'], array[]::text[]),
  ('tv-ses-monitor',      array['monitor'], array[]::text[]),
  ('arac-otomobil',       array['otomobil','araba','sedan','hatchback','suv','fiat','renault','volkswagen','honda','toyota','ford','hyundai','opel','peugeot','citroen','dacia','skoda','nissan','kia','seat','bmw','mercedes','audi','volvo','tofas'], array['motosiklet','scooter','motor','elektrikli','tesla','togg']),
  ('arac-motosiklet',     array['motosiklet','motor','scooter'], array[]::text[]),
  ('arac-ticari',         array['ticari arac','minivan','panelvan','kamyonet','pickup'], array[]::text[]),
  ('arac-elektrikli',     array['elektrikli arac','elektrikli','tesla','togg'], array[]::text[]),
  ('emlak-konut',         array['konut','daire','villa','mustakil','rezidans'], array['gunluk kiralik']),
  ('emlak-arsa',          array['arsa','tarla','bag','bahce'], array[]::text[]),
  ('emlak-isyeri',        array['isyeri','is yeri','ofis','dukkan','magaza'], array[]::text[]),
  ('emlak-gunluk-kiralik',array['gunluk kiralik'], array[]::text[]),
  ('yedek-parca-bilgisayar', array['ekran karti','islemci','anakart','ram','ssd','hdd','nvme','ddr4','ddr5','psu','rtx','gtx','radeon','ryzen','i3','i5','i7','i9'], array[]::text[]),
  ('yedek-parca-telefon',    array['telefon','iphone','samsung','ekran','batarya','sarj soketi','ekran degisimi'], array[]::text[]),
  ('yedek-parca-otomotiv',   array['jant','lastik','far takimi','sis fari','stop lambasi','tampon','oto teyp','oto aku'], array[]::text[]),
  ('yedek-parca-beyaz-esya', array['rezistans','pompa','motor'], array[]::text[]),
  ('ev-yasam-beyaz-esya',    array['beyaz esya','buzdolabi','camasir','bulasik','kurutma makinesi','derin dondurucu','firin','klima'], array[]::text[]),
  ('ev-yasam-mobilya',       array['mobilya','koltuk','masa','sandalye','yatak','yemek odasi','yatak odasi'], array[]::text[]),
  ('ev-yasam-kucuk-aletler', array['supurge','utu','kahve makinesi','blender','airfryer','mikrodalga'], array[]::text[]),
  ('ev-yasam-dekorasyon',    array['dekorasyon','hali','perde','avize'], array[]::text[]),
  ('aksesuar-kilif',         array['kilif','kapak','cover'], array[]::text[]),
  ('aksesuar-sarj',          array['sarj aleti','sarj cihazi','kablo seti','data kablo','usb kablo','sarj kablo','usb c','adaptor','adapter'], array[]::text[]),
  ('aksesuar-powerbank',     array['powerbank','power bank'], array[]::text[]),
  ('aksesuar-ekran-koruyucu',array['ekran koruyucu','ekran koruma','temperli cam'], array[]::text[])
) as v(slug, m, x)
where c.slug = v.slug;

-- Subcategories get their own descriptions so every category page is fully
-- described by this table.
update public.categories
set short_description = name || ' ikinci el piyasa analizi',
    long_description = name || ' için ikinci el fiyat rehberi, fırsat sinyalleri ve kaynak dağılımı.'
where parent_id is not null and (short_description is null or long_description is null);

-- ---------------------------------------------------------------------------
-- 2) Classification
-- ---------------------------------------------------------------------------

-- Lower-case, Turkish letters folded to ASCII, everything else to single spaces.
create or replace function public.normalize_category_text(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(regexp_replace(
    lower(translate(coalesce(value, ''), 'çğıİöşüâîûÇĞIÖŞÜÂÎÛ', 'cgiiosuaiucgiosuaiu')),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

-- True when any keyword occurs at a word start of the (already normalised)
-- haystack: 'kilif' matches 'silikon kilifi' but 'far' does not match 'safari'.
create or replace function public.category_keywords_match(haystack text, keywords text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select exists (
    select 1
    from unnest(coalesce(keywords, '{}'::text[])) as keyword
    where public.normalize_category_text(keyword) <> ''
      and position(' ' || public.normalize_category_text(keyword) in ' ' || haystack) > 0
  );
$$;

-- Most specific category for a product name. The optional hint (source /
-- normaliser category label) only helps choose the main category; the
-- subcategory is chosen from the product name alone, so a broad label such as
-- "TV ve Ses Sistemleri" cannot push a headphone into "Televizyon".
create or replace function public.classify_product_category(p_name text, p_hint text default null)
returns bigint
language plpgsql
stable
set search_path = public
as $$
declare
  v_text text := public.normalize_category_text(coalesce(p_name, '') || ' ' || coalesce(p_hint, ''));
  v_name text := public.normalize_category_text(p_name);
  v_main bigint;
  v_sub bigint;
begin
  select c.id into v_main
  from public.categories c
  where c.parent_id is null
    and c.is_active
    and not c.is_fallback
    and public.category_keywords_match(v_text, c.match_keywords)
    and not public.category_keywords_match(v_text, c.exclude_keywords)
  order by c.display_order, c.id
  limit 1;

  if v_main is null then
    select c.id into v_main from public.categories c where c.is_fallback limit 1;
    return v_main;
  end if;

  select c.id into v_sub
  from public.categories c
  where c.parent_id = v_main
    and c.is_active
    and public.category_keywords_match(v_name, c.match_keywords)
    and not public.category_keywords_match(v_name, c.exclude_keywords)
  order by c.display_order, c.id
  limit 1;

  return coalesce(v_sub, v_main);
end;
$$;

-- On insert (or when category_id is cleared) assign a category; always keep
-- products.category equal to the main category's name.
create or replace function public.assign_product_category()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category_id is null then
    -- new.category is the incoming source/normaliser label: a hint only.
    new.category_id := public.classify_product_category(new.name, new.category);
  end if;

  select coalesce(parent.name, c.name) into new.category
  from public.categories c
  left join public.categories parent on parent.id = c.parent_id
  where c.id = new.category_id;

  return new;
end;
$$;

revoke execute on function public.classify_product_category(text, text) from public, anon, authenticated;
revoke execute on function public.assign_product_category() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Backfill every existing product, then lock the invariant in
-- ---------------------------------------------------------------------------

update public.products
set category_id = public.classify_product_category(name, category);

drop trigger if exists products_assign_category on public.products;
create trigger products_assign_category
  before insert or update of name, category, category_id on public.products
  for each row
  execute function public.assign_product_category();

-- Re-run through the trigger once so products.category mirrors category_id.
update public.products set category_id = category_id;

alter table public.products alter column category_id set not null;

-- A category that still has products cannot be deleted (was ON DELETE SET NULL,
-- which would now violate NOT NULL and silently drop products from navigation).
alter table public.products drop constraint if exists products_category_id_fkey;
alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id) references public.categories(id) on delete restrict;

comment on column public.products.category_id is
  'Most specific category (subcategory or main). Assigned by trigger products_assign_category via classify_product_category(); never null. The only source of category membership.';
comment on column public.products.category is
  'Derived: name of the main category of category_id, maintained by trigger. On insert it is read once as a classification hint. Do not use for membership.';
comment on column public.listings.category is
  'Raw category label reported by the source for this listing. Not used for navigation; the product''s category_id is canonical.';
comment on column public.categories.is_fallback is
  'Exactly one category receives products no keyword rule matches (Diğer).';

-- ---------------------------------------------------------------------------
-- 4) Self-check: known product names must land in the expected category.
--    Fails the migration (and rolls it back) if the rules regress.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_actual text;
  v_failures text := '';
begin
  for r in
    select * from (values
      ('iPhone 13', 'telefon', null),
      ('Samsung Galaxy S23', 'telefon', null),
      ('Xiaomi Redmi Note 13', 'telefon', null),
      ('Motorola Edge 40', 'telefon', null),
      ('iPhone 15 Silikon Kılıf', 'aksesuar-kilif', null),
      ('Temperli Cam iPhone 14', 'aksesuar-ekran-koruyucu', null),
      ('Anker 20000mAh Powerbank', 'aksesuar-powerbank', null),
      ('Baseus 65W Hızlı Şarj Aleti', 'aksesuar-sarj', null),
      ('USB-C Type Kablo Seti', 'aksesuar-sarj', null),
      ('MacBook Air M2', 'bilgisayar-laptop', null),
      ('Asus ROG Strix G15', 'bilgisayar-laptop', null),
      ('Lenovo ThinkPad X1 Carbon', 'bilgisayar-laptop', null),
      ('iPad Air 5', 'bilgisayar-tablet', null),
      ('Gaming PC RTX 4070', 'bilgisayar-masaustu', null),
      ('PS5', 'konsol-playstation', null),
      ('PS5 DualSense Oyun Kolu', 'konsol-aksesuar', null),
      ('Xbox Series X', 'konsol-xbox', null),
      ('Nintendo Switch OLED', 'konsol-nintendo', null),
      ('Samsung 55" QLED Smart TV', 'tv-ses-televizyon', null),
      ('Sony WH-1000XM5 Kulaklık', 'tv-ses-kulaklik', null),
      ('Galaxy Buds 2', 'tv-ses-kulaklik', null),
      ('JBL Charge 5 Hoparlör', 'tv-ses-hoparlor', null),
      ('Dell 27 Monitör', 'tv-ses-monitor', null),
      ('RTX 4070 Ekran Kartı', 'yedek-parca-bilgisayar', null),
      ('i5-12400F', 'yedek-parca-bilgisayar', null),
      ('16GB DDR5 RAM Kiti', 'yedek-parca-bilgisayar', null),
      ('iPhone 11 Batarya', 'yedek-parca-telefon', null),
      ('Fiat Egea 1.4 Fire', 'arac-otomobil', null),
      ('Honda Activa Scooter', 'arac-motosiklet', null),
      ('Togg T10X', 'arac-elektrikli', null),
      ('Kadıköy 3+1 Satılık Daire', 'emlak-konut', null),
      ('Nilüfer Satılık Arsa', 'emlak-arsa', null),
      ('Arçelik Buzdolabı No-Frost', 'ev-yasam-beyaz-esya', null),
      ('Dyson V15 Süpürge', 'ev-yasam-kucuk-aletler', null),
      ('Yemek Odası Mobilya Takımı', 'ev-yasam-mobilya', null),
      ('Asus Vivobook 15', 'bilgisayar-laptop', null),
      ('Xiaomi Pad 6', 'bilgisayar-tablet', null),
      ('Logitech Kablosuz Fare', 'diger', null),
      ('Sony Kablosuz Kulaklık', 'tv-ses-kulaklik', null),
      ('iPhone Şarj Kablosu', 'aksesuar-sarj', null),
      ('Yamaha Akustik Gitar', 'diger', null),
      ('JBL Charge 5 Hoparlör', 'tv-ses-hoparlor', 'TV ve Ses Sistemleri'),
      ('Sony WH-1000XM5 Kulaklık', 'tv-ses-kulaklik', 'TV ve Ses Sistemleri'),
      ('Honda Civic 1.6 Eco', 'arac-otomobil', 'Araç'),
      ('Kedi Maması 10 kg', 'diger', null)
    ) as t(name, expected, hint)
  loop
    select c.slug into v_actual
    from public.categories c
    where c.id = public.classify_product_category(r.name, r.hint);
    if v_actual is distinct from r.expected then
      v_failures := v_failures || format(E'\n  %s -> %s (expected %s)', r.name, v_actual, r.expected);
    end if;
  end loop;

  if v_failures <> '' then
    raise exception 'Category classification self-check failed:%', v_failures;
  end if;
end $$;
