-- Sprint P-11.1: Backfill missing product categories
--
-- Root Cause: The single-product matcher path (findOrCreateMatchedProduct) did
-- not include category in its insert payload. The batch path already did.
-- Early products (IDs 1-21) were created before any category logic existed.
--
-- This migration backfills all 24 uncategorized products using the same
-- detectCategory() logic from lib/normalization/engine.ts.
--
-- NOTE: After this migration + the code fix in matcher.ts, all NEW products
-- will automatically receive a category. This is a one-time backfill.

-- Telefon (iPhone models without storage suffix)
UPDATE public.products SET category = 'Telefon' WHERE id = 1 AND category IS NULL;  -- iPhone 13
UPDATE public.products SET category = 'Telefon' WHERE id = 2 AND category IS NULL;  -- iPhone 14
UPDATE public.products SET category = 'Telefon' WHERE id = 3 AND category IS NULL;  -- iPhone 15
UPDATE public.products SET category = 'Telefon' WHERE id = 11 AND category IS NULL; -- iPhone 15 Pro Max
UPDATE public.products SET category = 'Telefon' WHERE id = 12 AND category IS NULL; -- iPhone 15 Pro
UPDATE public.products SET category = 'Telefon' WHERE id = 13 AND category IS NULL; -- iPhone 14 Pro Max
UPDATE public.products SET category = 'Telefon' WHERE id = 14 AND category IS NULL; -- iPhone 14 Pro
UPDATE public.products SET category = 'Telefon' WHERE id = 15 AND category IS NULL; -- iPhone 13 Pro Max
UPDATE public.products SET category = 'Telefon' WHERE id = 16 AND category IS NULL; -- iPhone 11
UPDATE public.products SET category = 'Telefon' WHERE id = 17 AND category IS NULL; -- iPhone 12
UPDATE public.products SET category = 'Telefon' WHERE id = 18 AND category IS NULL; -- iPhone 16 Pro Max
UPDATE public.products SET category = 'Telefon' WHERE id = 19 AND category IS NULL; -- iPhone 16 Pro

-- Telefon (Samsung models)
UPDATE public.products SET category = 'Telefon' WHERE id = 4 AND category IS NULL;  -- Samsung S23
UPDATE public.products SET category = 'Telefon' WHERE id = 5 AND category IS NULL;  -- Samsung S24

-- Oyun Konsolu
UPDATE public.products SET category = 'Oyun Konsolu' WHERE id = 6 AND category IS NULL;  -- PlayStation 5

-- Ekran Kartı
UPDATE public.products SET category = 'Ekran Kartı' WHERE id = 7 AND category IS NULL;   -- RTX 3060
UPDATE public.products SET category = 'Ekran Kartı' WHERE id = 8 AND category IS NULL;   -- RTX 4060

-- Laptop
UPDATE public.products SET category = 'Laptop' WHERE id = 9 AND category IS NULL;        -- MacBook Air M1

-- Tablet
UPDATE public.products SET category = 'Tablet' WHERE id = 10 AND category IS NULL;       -- iPad 9. Nesil

-- Aksesuar
UPDATE public.products SET category = 'Aksesuar' WHERE id = 20 AND category IS NULL;     -- SAAT
UPDATE public.products SET category = 'Aksesuar' WHERE id = 21 AND category IS NULL;     -- MAUSE
UPDATE public.products SET category = 'Aksesuar' WHERE id = 38 AND category IS NULL;     -- Omix X3
UPDATE public.products SET category = 'Aksesuar' WHERE id = 39 AND category IS NULL;     -- Omix X3 (duplicate)
UPDATE public.products SET category = 'Aksesuar' WHERE id = 40 AND category IS NULL;     -- Omix X3 (duplicate)

-- Verify no products remain without category
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT COUNT(*) INTO remaining FROM public.products WHERE category IS NULL;
  IF remaining > 0 THEN
    RAISE WARNING '% products still missing category after backfill', remaining;
  ELSE
    RAISE NOTICE 'All products now have a category.';
  END IF;
END $$;
