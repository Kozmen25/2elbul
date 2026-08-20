-- 2ElBul account center: guaranteed default avatar on signup.
--
-- Guarantees every new auth user gets a profiles row with a preset avatar the
-- moment their auth.users row is created. When a user picked a preset at signup
-- (passed via options.data.avatar -> raw_user_meta_data), that id is honored;
-- otherwise a deterministic pick by email hash. Builds on the profiles table
-- created in 20260820-account-profiles-avatars.sql.

-- Helper: resolve the preset avatar url for a new user.
--   1. user-chosen id (whitelisted) -> /avatars/preset-<id>.svg
--   2. else hash of email -> deterministic preset
create or replace function public.handle_new_user_avatar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen   text;
  preset_id text;
begin
  chosen := nullif(new.raw_user_meta_data ->> 'avatar', '');
  if chosen in ('a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','r','s','t','u') then
    preset_id := chosen;
  else
    preset_id := case (abs(hashtext(coalesce(new.email, ''))::bigint) % 20)
      when 0  then 'a'
      when 1  then 'b'
      when 2  then 'c'
      when 3  then 'd'
      when 4  then 'e'
      when 5  then 'f'
      when 6  then 'g'
      when 7  then 'h'
      when 8  then 'i'
      when 9  then 'j'
      when 10 then 'k'
      when 11 then 'l'
      when 12 then 'm'
      when 13 then 'n'
      when 14 then 'o'
      when 15 then 'p'
      when 16 then 'r'
      when 17 then 's'
      when 18 then 't'
      else 'u'
    end;
  end if;

  insert into public.profiles (user_id, display_name, location, bio, avatar_url, updated_at)
  values (
    new.id,
    null,
    null,
    null,
    '/avatars/preset-' || preset_id || '.svg',
    now()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_avatar on auth.users;
create trigger on_auth_user_created_avatar
  after insert on auth.users
  for each row execute function public.handle_new_user_avatar();
