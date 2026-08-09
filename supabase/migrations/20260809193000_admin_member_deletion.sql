-- Audited member deletion for the verified master administrator.
-- The function requires the target email to be typed exactly, prevents the
-- administrator deleting their own account, and leaves a private audit row.

create table if not exists private.admin_member_deletion_audit (
  id bigint generated always as identity primary key,
  administrator_user_id uuid not null,
  target_user_id uuid not null,
  target_email text not null,
  saved_playlist_count bigint not null default 0,
  deleted_at timestamptz not null default now()
);

alter table private.admin_member_deletion_audit enable row level security;
revoke all on table private.admin_member_deletion_audit from public, anon, authenticated;

create or replace function public.delete_member_account(
  target_user_id uuid,
  confirmation_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  administrator_id uuid := auth.uid();
  member_email text;
  member_playlist_count bigint;
begin
  if administrator_id is null or not exists (
    select 1
    from public.app_admins
    where app_admins.user_id = administrator_id
      and app_admins.role = 'master_admin'
  ) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if target_user_id is null then
    raise exception 'member account is required' using errcode = '22023';
  end if;

  if target_user_id = administrator_id then
    raise exception 'you cannot delete your own administrator account' using errcode = '42501';
  end if;

  select lower(users.email)
  into member_email
  from auth.users as users
  where users.id = target_user_id;

  if member_email is null then
    raise exception 'member account was not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from private.admin_email_allowlist as allowlist
    where allowlist.email = member_email
  ) then
    raise exception 'administrator accounts cannot be deleted here' using errcode = '42501';
  end if;

  if lower(btrim(coalesce(confirmation_email, ''))) <> member_email then
    raise exception 'type the member email exactly to confirm deletion' using errcode = '22023';
  end if;

  select count(*)
  into member_playlist_count
  from public.user_playlists
  where user_id = target_user_id;

  insert into private.admin_member_deletion_audit (
    administrator_user_id,
    target_user_id,
    target_email,
    saved_playlist_count
  ) values (
    administrator_id,
    target_user_id,
    member_email,
    member_playlist_count
  );

  delete from auth.users where id = target_user_id;

  if not found then
    raise exception 'member account could not be deleted' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'deleted', true,
    'email', member_email,
    'saved_playlists_deleted', member_playlist_count
  );
end;
$$;

revoke all on function public.delete_member_account(uuid, text) from public, anon;
grant execute on function public.delete_member_account(uuid, text) to authenticated;

comment on function public.delete_member_account(uuid, text) is
  'Permanently deletes a non-administrator member after exact-email confirmation and writes a private audit record.';
