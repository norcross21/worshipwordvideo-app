-- Remove the one anonymous production-alias visit used for final release
-- verification. Genuine reporting begins after this narrow UTC test window.
delete from public.app_usage_events
where occurred_at >= '2026-08-17 10:30:00+00'::timestamptz
  and occurred_at < '2026-08-17 10:35:00+00'::timestamptz;
