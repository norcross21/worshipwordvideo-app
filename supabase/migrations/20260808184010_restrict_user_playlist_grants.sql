-- The original table granted every table privilege to authenticated users.
-- Keep only the four operations used by the app.
revoke all on table public.user_playlists from authenticated;
grant select, insert, update, delete on table public.user_playlists to authenticated;
