-- Privacy-preserving product analytics for the protected administrator area.
-- No IP address, account ID, email, search text, video ID or playlist title is collected.
-- The master administrator is excluded inside the database, so their activity
-- is not counted even if a browser attempts to submit it.

create table if not exists public.app_usage_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'visit',
    'search',
    'language_filter',
    'video_preview',
    'playlist_add',
    'projection_open',
    'service_create'
  )),
  session_id uuid not null,
  signed_in boolean not null default false,
  occurred_at timestamptz not null default now()
);

-- Keep the event stream non-identifying if this migration is reapplied over
-- an earlier preview of the analytics schema.
alter table public.app_usage_events
  add column if not exists signed_in boolean not null default false;
alter table public.app_usage_events drop column if exists user_id;

create index if not exists idx_app_usage_events_occurred
  on public.app_usage_events (occurred_at desc);

create index if not exists idx_app_usage_events_name_occurred
  on public.app_usage_events (event_name, occurred_at desc);

alter table public.app_usage_events enable row level security;
revoke all on table public.app_usage_events from public, anon, authenticated;

create or replace function public.record_app_usage_event(
  requested_event_name text,
  requested_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if requested_event_name not in (
    'visit', 'search', 'language_filter', 'video_preview',
    'playlist_add', 'projection_open', 'service_create'
  ) then
    raise exception 'unsupported analytics event' using errcode = '22023';
  end if;

  if current_user_id is not null and exists (
    select 1
    from public.app_admins
    where app_admins.user_id = current_user_id
      and app_admins.role = 'master_admin'
  ) then
    return;
  end if;

  -- A visit is counted once per in-memory page session. The identifier is not
  -- kept in browser storage and changes after a full page reload.
  if requested_event_name = 'visit' and exists (
    select 1 from public.app_usage_events
    where event_name = 'visit'
      and session_id = requested_session_id
  ) then
    return;
  end if;

  if exists (
    select 1 from public.app_usage_events
    where event_name = requested_event_name
      and session_id = requested_session_id
      and occurred_at > now() - interval '2 seconds'
  ) then
    return;
  end if;

  if requested_event_name = 'visit' then
    delete from public.app_usage_events
    where occurred_at < now() - interval '13 months';
  end if;

  insert into public.app_usage_events (event_name, session_id, signed_in)
  values (requested_event_name, requested_session_id, current_user_id is not null);
end;
$$;

revoke all on function public.record_app_usage_event(text, uuid) from public;
grant execute on function public.record_app_usage_event(text, uuid) to anon, authenticated;

create or replace function public.get_admin_usage_metrics(days_back integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  requested_days integer := greatest(1, least(coalesce(days_back, 30), 365));
  start_at timestamptz := date_trunc('day', now()) - (greatest(1, least(coalesce(days_back, 30), 365)) - 1) * interval '1 day';
  result jsonb;
begin
  if not exists (
    select 1
    from public.app_admins
    where app_admins.user_id = auth.uid()
      and app_admins.role = 'master_admin'
  ) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  with filtered as (
    select event_name, session_id, signed_in, occurred_at
    from public.app_usage_events
    where occurred_at >= start_at
  ),
  totals as (
    select
      count(*) filter (where event_name = 'visit') as visits,
      count(distinct session_id) as browser_sessions,
      count(distinct session_id) filter (where signed_in) as signed_in_sessions,
      count(*) filter (where event_name = 'search') as searches,
      count(*) filter (where event_name = 'language_filter') as language_filters,
      count(*) filter (where event_name = 'video_preview') as video_previews,
      count(*) filter (where event_name = 'playlist_add') as playlist_adds,
      count(*) filter (where event_name = 'projection_open') as projection_opens,
      count(*) filter (where event_name = 'service_create') as services_created
    from filtered
  ),
  daily as (
    select day::date as date,
      count(distinct filtered.session_id) as browser_sessions,
      count(*) filter (where filtered.event_name = 'visit') as visits,
      count(*) filter (where filtered.event_name = 'video_preview') as video_previews
    from generate_series(date_trunc('day', start_at), date_trunc('day', now()), interval '1 day') as day
    left join filtered on filtered.occurred_at >= day and filtered.occurred_at < day + interval '1 day'
    group by day
    order by day
  )
  select jsonb_build_object(
    'days', requested_days,
    'totals', to_jsonb(totals),
    'daily', coalesce((select jsonb_agg(to_jsonb(daily)) from daily), '[]'::jsonb)
  ) into result
  from totals;

  return result;
end;
$$;

revoke all on function public.get_admin_usage_metrics(integer) from public, anon;
grant execute on function public.get_admin_usage_metrics(integer) to authenticated;

comment on table public.app_usage_events is
  'Anonymous aggregate product-usage events with a page-lifetime session ID, but no IP addresses, account IDs, search text, video IDs or playlist names. Master administrator activity is excluded and events expire after 13 months.';

comment on function public.record_app_usage_event(text, uuid) is
  'Records an allowlisted anonymous product event and silently excludes master administrator activity.';

comment on function public.get_admin_usage_metrics(integer) is
  'Returns aggregate usage metrics only to a verified master administrator.';
