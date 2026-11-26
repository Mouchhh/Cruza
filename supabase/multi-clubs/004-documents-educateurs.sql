-- Raccordement de l'espace éducateur à la base commune.
begin;

alter table public.cruza_memberships add column display_name text
 check (length(btrim(display_name)) between 1 and 70);
alter table public.cruza_documents
 add column source_id text check (length(source_id) between 1 and 100),
 add column revision integer not null default 1 check (revision > 0),
 add column updated_at timestamptz not null default now(),
 add unique (club_id, owner_id, kind, source_id);

-- Les documents versionnés passent exclusivement par les fonctions ci-dessous.
alter policy cruza_document_update on public.cruza_documents
 using (source_id is null and public.cruza_role(club_id) is not null and owner_id = (select auth.uid()));
alter policy cruza_document_delete on public.cruza_documents
 using (source_id is null and public.cruza_role(club_id) is not null and owner_id = (select auth.uid()));

create function public.cruza_requested_club() returns uuid
language sql stable set search_path = '' as $$
 select case when header ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then header::uuid end
 from (select nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-cruza-club' as header) request
$$;
revoke all on function public.cruza_requested_club() from public, anon;
grant execute on function public.cruza_requested_club() to authenticated;

create function public.cruza_active_educators()
returns table (user_id uuid, display_name text, active boolean)
language sql stable security definer set search_path = '' as $$
 select m.user_id, coalesce(m.display_name, 'Éducateur du club'), m.active
 from public.cruza_memberships m
 where m.club_id = public.cruza_requested_club() and m.active
   and public.cruza_role(m.club_id) is not null
$$;
revoke all on function public.cruza_active_educators() from public, anon;
grant execute on function public.cruza_active_educators() to authenticated;

create view public.club_members with (security_invoker = true) as
 select * from public.cruza_active_educators();

create view public.club_documents with (security_invoker = true) as
 select id, owner_id,
        case kind when 'seance' then 'training' when 'bilan' then 'report' else kind end as kind,
        source_id, title, payload, revision, updated_at
 from public.cruza_documents
 where club_id = (select public.cruza_requested_club()) and source_id is not null and shared;

revoke all on public.club_members, public.club_documents from public, anon, authenticated;
grant select on public.club_members, public.club_documents to authenticated;

create function public.club_publish_document(
 p_kind text, p_source_id text, p_title text, p_payload jsonb,
 p_expected_revision integer, p_expected_id uuid default null
) returns public.club_documents
language plpgsql security definer set search_path = '' as $$
declare
 club uuid := public.cruza_requested_club();
 actor uuid := auth.uid();
 document_kind text := case p_kind when 'training' then 'seance' when 'report' then 'bilan'
                           when 'composition' then 'composition' end;
 document_id uuid;
 result public.club_documents;
begin
 if public.cruza_role(club) is null then
  raise exception 'Accès réservé aux éducateurs du club' using errcode = '42501';
 end if;
 if document_kind is null or p_source_id is null or p_payload is null
    or octet_length(p_payload::text) > 8388608 then
  raise exception 'Document incompatible' using errcode = '22023';
 end if;
 if p_expected_revision = 0 and p_expected_id is null then
  insert into public.cruza_documents(club_id, owner_id, kind, source_id, title, payload, shared)
   values(club, actor, document_kind, p_source_id, p_title, p_payload, true)
   on conflict (club_id, owner_id, kind, source_id) do nothing returning id into document_id;
 elsif p_expected_revision > 0 then
  update public.cruza_documents set title = p_title, payload = p_payload, revision = revision + 1, updated_at = now()
   where club_id = club and owner_id = actor and kind = document_kind
     and source_id = p_source_id and id = p_expected_id and revision = p_expected_revision
   returning id into document_id;
 end if;
 if document_id is null then
  raise exception 'Version modifiée : récupérer la version partagée avant de réessayer' using errcode = 'PT409';
 end if;
 select * into result from public.club_documents where id = document_id;
 return result;
end;
$$;

create function public.club_remove_document(p_id uuid, p_expected_revision integer) returns void
language plpgsql security definer set search_path = '' as $$
declare club uuid := public.cruza_requested_club();
begin
 if public.cruza_role(club) is null then
  raise exception 'Accès réservé aux éducateurs du club' using errcode = '42501';
 end if;
 delete from public.cruza_documents
 where club_id = club and owner_id = auth.uid() and id = p_id and revision = p_expected_revision and source_id is not null;
 if not found then
  raise exception 'Version modifiée ou document non autorisé' using errcode = 'PT409';
 end if;
end;
$$;

revoke all on function public.club_publish_document(text,text,text,jsonb,integer,uuid),
 public.club_remove_document(uuid,integer) from public, anon;
grant execute on function public.club_publish_document(text,text,text,jsonb,integer,uuid),
 public.club_remove_document(uuid,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
