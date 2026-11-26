-- Synchronisation privée isolée par club et propriétaire.
begin;
create table if not exists public.coach_private_records (
 club_id uuid not null,
 owner_id uuid not null,
 kind text not null check (kind in ('settings','photo')),
 record_key text not null,
 payload jsonb not null,
 revision bigint not null default 1 check (revision > 0),
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(club_id,owner_id,kind,record_key),
 foreign key(club_id,owner_id) references public.cruza_memberships(club_id,user_id) on delete cascade,
 check (jsonb_typeof(payload) = 'object'),
 check (octet_length(payload::text) <= case when kind='photo' then 2000000 else 500000 end),
 check ((kind='settings' and record_key in ('profile','club')) or
        (kind='photo' and record_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
);
alter table public.coach_private_records enable row level security;
revoke all on public.coach_private_records from public,anon,authenticated;
grant select on public.coach_private_records to authenticated;
drop policy if exists coach_private_read_own on public.coach_private_records;
create policy coach_private_read_own on public.coach_private_records for select to authenticated
 using (owner_id=(select auth.uid()) and (club_id=(select public.cruza_requested_club()) and public.cruza_role(club_id) is not null));
create or replace function public.coach_private_write(
 p_owner_id uuid,p_kind text,p_key text,p_payload jsonb,
 p_expected_revision bigint,p_deleted boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.coach_private_records; result public.coach_private_records; target uuid := public.cruza_requested_club();
begin
 if auth.uid() is null or auth.uid()<>p_owner_id or public.cruza_role(target) is null then
  raise exception 'Compte non autorisé' using errcode='42501';
 end if;
 if p_kind not in ('settings','photo') or p_kind is null or p_key is null or p_payload is null
    or p_deleted is null or p_expected_revision is null or p_expected_revision<0 then
  raise exception 'Paramètres invalides' using errcode='22023';
 end if;
 -- Serialize this account's writes, including the 30-photo quota check.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target::text || ':' || p_owner_id::text,0));
 select * into existing from public.coach_private_records
  where club_id=target and owner_id=p_owner_id and kind=p_kind and record_key=p_key for update;
 if coalesce(existing.revision,0)<>p_expected_revision then
  raise exception 'Version personnelle modifiée sur un autre appareil' using errcode='40001';
 end if;
 if p_deleted and existing.owner_id is null then
  raise exception 'Donnée personnelle inexistante' using errcode='22023';
 end if;
 if existing.owner_id is null and
    (select count(*) from public.coach_private_records where club_id=target and owner_id=p_owner_id)>=2000 then
  raise exception 'Historique personnel à archiver' using errcode='23514';
 end if;
 if p_kind='photo' and not p_deleted then
  if jsonb_typeof(p_payload->'name') is distinct from 'string'
     or length(p_payload->>'name') not between 1 and 60
     or jsonb_typeof(p_payload->'data') is distinct from 'string'
     or (p_payload->>'data') !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$'
     or jsonb_typeof(p_payload->'createdAt') is distinct from 'string'
     or length(p_payload->>'createdAt')>40 then
   raise exception 'Photo invalide' using errcode='22023';
  end if;
  if (existing.owner_id is null or existing.deleted) and
     (select count(*) from public.coach_private_records where club_id=target and owner_id=p_owner_id and kind='photo' and not deleted)>=30 then
   raise exception '30 photos maximum par éducateur' using errcode='23514';
  end if;
 end if;
 insert into public.coach_private_records(club_id,owner_id,kind,record_key,payload,revision,deleted)
 values(target,p_owner_id,p_kind,p_key,case when p_deleted then '{}'::jsonb else p_payload end,1,p_deleted)
 on conflict(club_id,owner_id,kind,record_key) do update set
  payload=excluded.payload,deleted=excluded.deleted,
  revision=coach_private_records.revision+1,updated_at=now()
 returning * into result;
 return to_jsonb(result);
end; $$;
revoke all on function public.coach_private_write(uuid,text,text,jsonb,bigint,boolean) from public,anon;
grant execute on function public.coach_private_write(uuid,text,text,jsonb,bigint,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
