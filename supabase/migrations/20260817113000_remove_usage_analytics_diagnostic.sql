-- Remove the single fixed-ID event used to prove the production analytics RPC
-- worked while diagnosing the browser delivery failure.
delete from public.app_usage_events
where session_id = '00000000-0000-4000-8000-000000000001'::uuid;

delete from public.app_usage_events
where session_id = '00000000-0000-4000-8000-000000000002'::uuid;
