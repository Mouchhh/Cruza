-- L’auteur peut synchroniser sa causerie privée. Les autres membres restent soumis à la politique de lecture.
begin;

create or replace view public.club_documents with (security_invoker = true) as
 select id, owner_id,
        case kind when 'seance' then 'training' when 'bilan' then 'report' else kind end as kind,
        source_id, title, payload, revision, updated_at
 from public.cruza_documents
 where club_id = (select public.cruza_requested_club()) and source_id is not null and (shared or owner_id = (select auth.uid()));

create or replace function public.club_publish_document(
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
 visibility text := case when p_kind='composition' then p_payload->>'causerieVisibility' end;
begin
 if public.cruza_role(club) is null then
  raise exception 'Accès réservé aux éducateurs du club' using errcode = '42501';
 end if;
 if document_kind is null or p_source_id is null or p_payload is null
    or (visibility is not null and visibility not in ('private','club'))
    or octet_length(p_payload::text) > 8388608 then
  raise exception 'Document incompatible' using errcode = '22023';
 end if;
 if p_expected_revision = 0 and p_expected_id is null then
  insert into public.cruza_documents(club_id, owner_id, kind, source_id, title, payload, shared)
   values(club, actor, document_kind, p_source_id, p_title, p_payload, visibility is distinct from 'private')
   on conflict (club_id, owner_id, kind, source_id) do nothing returning id into document_id;
 elsif p_expected_revision > 0 then
  update public.cruza_documents set title = p_title,
      payload = case when not shared and visibility is null then
        jsonb_set(p_payload,'{causerieVisibility}','"private"'::jsonb) else p_payload end,
      shared = case when visibility is null then shared else visibility='club' end,
      revision = revision + 1, updated_at = now()
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

notify pgrst, 'reload schema';
commit;
