-- The analytics table was empty before the repair was tested. Remove only the
-- short UTC window used for controlled browser and endpoint verification so
-- production reporting starts with genuine post-release activity.
delete from public.app_usage_events
where occurred_at >= '2026-08-17 10:00:00+00'::timestamptz
  and occurred_at < '2026-08-17 10:30:00+00'::timestamptz;
