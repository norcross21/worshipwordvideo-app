-- Remove the anonymous preview visit/search/video-open used to verify the
-- repaired end-to-end production path before promotion.
delete from public.app_usage_events
where occurred_at >= '2026-08-17 10:20:00+00'::timestamptz
  and occurred_at < '2026-08-17 10:30:00+00'::timestamptz;
