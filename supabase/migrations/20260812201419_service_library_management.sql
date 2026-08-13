-- More flexible service management and an append-only record of consent changes.

alter table public.user_playlists
  add column if not exists archived_at timestamptz;

create index if not exists idx_user_playlists_owner_archive_updated
  on public.user_playlists (user_id, archived_at, updated_at desc);

create table if not exists public.member_consent_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  preference text not null check (preference in ('account_terms', 'kairos_marketing')),
  granted boolean not null,
  terms_version text,
  source text not null default 'account_settings' check (char_length(source) between 1 and 80),
  recorded_at timestamptz not null default now()
);

create index if not exists idx_member_consent_events_owner_recorded
  on public.member_consent_events (user_id, recorded_at desc);

alter table public.member_consent_events enable row level security;
revoke all on table public.member_consent_events from public, anon, authenticated;
grant select on table public.member_consent_events to authenticated;

drop policy if exists "Members can view their own consent history" on public.member_consent_events;
create policy "Members can view their own consent history"
on public.member_consent_events for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function private.record_member_consent_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.terms_accepted_at is not null then
      insert into public.member_consent_events (user_id, preference, granted, terms_version, source, recorded_at)
      values (new.user_id, 'account_terms', true, new.terms_version, 'account_profile', new.terms_accepted_at);
    end if;
    insert into public.member_consent_events (user_id, preference, granted, terms_version, source, recorded_at)
    values (
      new.user_id,
      'kairos_marketing',
      new.kairos_marketing_opt_in,
      new.terms_version,
      'account_profile',
      coalesce(new.kairos_marketing_opt_in_at, new.kairos_marketing_opt_out_at, now())
    );
  else
    if old.terms_accepted_at is distinct from new.terms_accepted_at and new.terms_accepted_at is not null then
      insert into public.member_consent_events (user_id, preference, granted, terms_version, source, recorded_at)
      values (new.user_id, 'account_terms', true, new.terms_version, 'account_profile', new.terms_accepted_at);
    end if;
    if old.kairos_marketing_opt_in is distinct from new.kairos_marketing_opt_in then
      insert into public.member_consent_events (user_id, preference, granted, terms_version, source, recorded_at)
      values (
        new.user_id,
        'kairos_marketing',
        new.kairos_marketing_opt_in,
        new.terms_version,
        'account_profile',
        coalesce(new.kairos_marketing_opt_in_at, new.kairos_marketing_opt_out_at, now())
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.record_member_consent_change() from public, anon, authenticated;

drop trigger if exists record_member_consent_change on public.app_users;
create trigger record_member_consent_change
after insert or update of terms_accepted_at, kairos_marketing_opt_in on public.app_users
for each row execute function private.record_member_consent_change();

comment on table public.member_consent_events is
  'Append-only evidence of member terms and optional Kairos marketing choices. Members may read only their own history.';

create table if not exists public.admin_member_actions (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  action text not null check (action in ('delete_member')),
  target_user_id uuid not null,
  target_email text,
  target_playlist_count integer not null default 0,
  recorded_at timestamptz not null default now()
);

alter table public.admin_member_actions enable row level security;
revoke all on table public.admin_member_actions from public, anon, authenticated;

comment on table public.admin_member_actions is
  'Server-written audit record for destructive administrator actions. Not exposed to browser roles.';

-- Member deletion now runs through a same-origin server route with verified
-- master-admin role, an AAL2 authenticator session and a server-written audit.
drop function if exists public.delete_member_account(uuid, text);
