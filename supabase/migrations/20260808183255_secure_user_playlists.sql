-- Cloud service playlists for Worship Word Video.
-- The table is private by default: authenticated users can only access rows
-- whose user_id matches their Supabase Auth identity.

create table if not exists public.user_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  items jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_playlists
  alter column is_public set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_playlists_user_id_fkey'
      and conrelid = 'public.user_playlists'::regclass
  ) then
    alter table public.user_playlists
      add constraint user_playlists_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_playlists_title_length_check'
      and conrelid = 'public.user_playlists'::regclass
  ) then
    alter table public.user_playlists
      add constraint user_playlists_title_length_check
      check (char_length(btrim(title)) between 1 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_playlists_items_array_check'
      and conrelid = 'public.user_playlists'::regclass
  ) then
    alter table public.user_playlists
      add constraint user_playlists_items_array_check
      check (jsonb_typeof(items) = 'array');
  end if;
end
$$;

create index if not exists idx_user_playlists_user_id
  on public.user_playlists (user_id);

alter table public.user_playlists enable row level security;

revoke all on table public.user_playlists from public, anon, authenticated;
grant select, insert, update, delete on table public.user_playlists to authenticated;

drop policy if exists "Users can view their own playlists" on public.user_playlists;
drop policy if exists "Users can insert their own playlists" on public.user_playlists;
drop policy if exists "Users can update their own playlists" on public.user_playlists;
drop policy if exists "Users can delete their own playlists" on public.user_playlists;

create policy "Users can view their own playlists"
on public.user_playlists for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert their own playlists"
on public.user_playlists for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own playlists"
on public.user_playlists for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete their own playlists"
on public.user_playlists for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
