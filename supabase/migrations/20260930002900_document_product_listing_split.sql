-- Documents the product / listing split in the schema itself (comments only,
-- no data or structure change).
--
--   products  = one catalogue item ("iPhone 13"): identity, matching key,
--               understanding attributes, and its single category.
--   listings  = one offer for a product on one source: price, condition,
--               city, URL, and whatever the source reported about the item.
--
-- Category, brand and model of an item are properties of the product. The
-- same-named listing columns hold what the source said for that one offer;
-- no page reads them, and they must not be used for navigation or grouping.

comment on table public.products is
  'Catalogue item. Owns identity (name, slug, normalized_key), product understanding (attributes) and category (category_id). Offers live in listings.';
comment on table public.listings is
  'One offer for a product (product_id, NOT NULL) on one source: price, condition, city, url, status. Item-level facts (category, brand, model) belong to the product.';

comment on column public.listings.brand is 'Brand as reported by the source for this offer. Raw; the product is canonical.';
comment on column public.listings.model is 'Model as reported by the source for this offer. Raw; the product is canonical.';
comment on column public.listings.storage is 'Storage variant reported by the source for this offer.';
comment on column public.listings.ram is 'RAM variant reported by the source for this offer.';
comment on column public.listings.color is 'Colour reported by the source for this offer.';
