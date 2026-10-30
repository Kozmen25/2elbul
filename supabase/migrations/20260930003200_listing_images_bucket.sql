-- Photos for user-submitted listings (/listing-ekle).
--
-- Public bucket (the photos are shown on listing cards once the listing is
-- approved), limited to 2 MB and three image types. Users may upload into and
-- delete from their own folder only ("<user id>/<file>"); nobody can overwrite
-- somebody else's files. The size/type limits are also enforced by the app
-- (magic-byte check in app/listing-ekle/actions.ts), this is the backstop.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Listing images are publicly readable" on storage.objects;
create policy "Listing images are publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'listing-images');

drop policy if exists "Users can upload their listing images" on storage.objects;
create policy "Users can upload their listing images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their listing images" on storage.objects;
create policy "Users can delete their listing images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and owner_id = (select auth.uid())::text
  );
