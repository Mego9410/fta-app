-- Supabase Auth trigger (run in Supabase SQL editor)
-- Purpose: automatically create a row in public.profiles whenever a new auth user is created.
-- This avoids client-side RLS issues during sign-up flows (especially when email confirmation is enabled).

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, onboarding_step)
  values (new.id, '', 'profile')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

commit;

