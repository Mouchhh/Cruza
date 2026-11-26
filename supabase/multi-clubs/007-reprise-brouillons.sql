begin;
alter table public.cruza_memberships add column legacy_storage_id uuid;
-- Only the authenticated owner may retrieve their own previous storage identity.
revoke select on public.cruza_memberships from authenticated;
grant select (club_id,user_id,role,active,display_name) on public.cruza_memberships to authenticated;
create function public.cruza_legacy_storage_id() returns uuid
language sql stable security definer set search_path='' as $$
 select m.legacy_storage_id
 from public.cruza_memberships m
 where m.club_id=public.cruza_requested_club() and m.user_id=auth.uid()
 and public.cruza_role(m.club_id) is not null
$$;
revoke all on function public.cruza_legacy_storage_id() from public,anon;
grant execute on function public.cruza_legacy_storage_id() to authenticated;
notify pgrst, 'reload schema';
commit;
