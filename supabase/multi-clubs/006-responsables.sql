-- Accès Responsable et catégories par club. Les vues 004 limitent les documents et membres au club demandé.
begin;
create table if not exists public.club_management_access (
 club_id uuid not null,
 user_id uuid not null,
 primary key (club_id, user_id),
 foreign key (club_id, user_id) references public.cruza_memberships(club_id, user_id) on delete cascade,
 role text not null check(role in ('director','pole')),
 categories text[] not null default '{}',
 check ((role='director' and cardinality(categories)=0) or
        (role='pole' and cardinality(categories) between 1 and 30))
);
alter table public.club_management_access enable row level security;
revoke all on public.club_management_access from public,anon,authenticated;

create or replace function public.club_management_access_info() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('allowed',true,'role',a.role,
  'categories',a.categories,'display_name',m.display_name)
  from public.club_management_access a join public.club_members m using(user_id)
  where a.club_id=public.cruza_requested_club() and a.user_id=auth.uid() and m.active),'{"allowed":false}'::jsonb);
$$;

create or replace function public.club_management_category(p_kind text,p_payload jsonb) returns text
language sql immutable set search_path='' as $$
 select upper(trim(coalesce(nullif(case when p_kind='report' then p_payload#>>'{info,category}' end,''),
  nullif(p_payload->>'category',''),p_payload#>>'{teamContext,category}','')));
$$;

create or replace function public.club_management_can_read(p_kind text,p_payload jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.club_management_access a join public.club_members m using(user_id)
 where a.club_id=public.cruza_requested_club() and a.user_id=auth.uid() and m.active and
 (a.role='director' or public.club_management_category(p_kind,p_payload)=any(a.categories)));
$$;

create or replace function public.club_management_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare access jsonb; result jsonb;
begin
 access:=public.club_management_access_info();
 if not (access->>'allowed')::boolean then raise exception 'Accès Responsable non autorisé' using errcode='42501';end if;
 with visible as (
  select d.*,public.club_management_category(d.kind,d.payload) as category
  from public.club_documents d where public.club_management_can_read(d.kind,d.payload)
 ), recent as (select * from visible order by updated_at desc,id limit 500)
 select jsonb_build_object('access',access,'generated_at',now(),
 'total_documents',(select count(*) from visible),
 'truncated',(select count(*)>500 from visible),
 'educators',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.display_name,'active',m.active) order by m.display_name)
  from public.club_members m where access->>'role'='director' or exists(select 1 from visible v where v.owner_id=m.user_id)),'[]'::jsonb),
 'documents',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'owner_id',r.owner_id,'kind',r.kind,'title',r.title,
  'category',r.category,'team',coalesce(nullif(r.payload#>>'{teamContext,name}',''),r.payload->>'team',''),
  'revision',r.revision,'updated_at',r.updated_at) order by r.updated_at desc,r.id) from recent r),'[]'::jsonb)) into result;
 return result;
end $$;

create or replace function public.club_management_document(p_document_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare doc public.club_documents;begin
 if not (public.club_management_access_info()->>'allowed')::boolean then
  raise exception 'Accès Responsable non autorisé' using errcode='42501';end if;
 select * into doc from public.club_documents where id=p_document_id;
 if not found or not public.club_management_can_read(doc.kind,doc.payload) then
  raise exception 'Document indisponible dans votre périmètre' using errcode='42501';end if;
 return jsonb_build_object('id',doc.id,'kind',doc.kind,'title',doc.title,'revision',doc.revision,
  'updated_at',doc.updated_at,'payload',doc.payload);
end $$;
revoke all on function public.club_management_access_info() from public,anon;
revoke all on function public.club_management_category(text,jsonb) from public,anon;
revoke all on function public.club_management_can_read(text,jsonb) from public,anon;
revoke all on function public.club_management_overview() from public,anon;
revoke all on function public.club_management_document(uuid) from public,anon;
grant execute on function public.club_management_access_info() to authenticated;
grant execute on function public.club_management_overview() to authenticated;
grant execute on function public.club_management_document(uuid) to authenticated;
-- Les fonctions internes ne sont pas exposées au rôle authenticated.
revoke all on function public.club_management_category(text,jsonb) from authenticated;
revoke all on function public.club_management_can_read(text,jsonb) from authenticated;
create or replace function public.club_management_statistics() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare access jsonb; result jsonb;
begin
 access:=public.club_management_access_info();
 if not (access->>'allowed')::boolean then raise exception 'Accès Responsable non autorisé' using errcode='42501';end if;
 with visible as (
  select d.* from public.club_documents d
  where d.kind in ('training','report') and public.club_management_can_read(d.kind,d.payload)
 ), recent as (select * from visible order by updated_at desc,id limit 500)
 select jsonb_build_object('generated_at',now(),'total_documents',(select count(*) from visible),
 'truncated',(select count(*)>500 from visible),'documents',coalesce((select jsonb_agg(
  jsonb_build_object('id',r.id,'owner_id',r.owner_id,'kind',r.kind,'source_id',r.source_id,'title',r.title,
  'category',public.club_management_category(r.kind,r.payload),'updated_at',r.updated_at,
  'stats',jsonb_build_object(
   'id',coalesce(r.payload->>'id',r.source_id),
   'teamContext',jsonb_build_object('id',r.payload#>>'{teamContext,id}','team',r.payload#>>'{teamContext,team}'),
   'team',r.payload->>'team','date',r.payload->>'date','time',r.payload->>'time',
   'duration',r.payload->'duration','libraryOnly',r.payload->'libraryOnly','themes',r.payload->'themes',
   'attendance',case when r.kind='training' then jsonb_build_object(
    'version',r.payload#>'{attendance,version}','date',r.payload#>>'{attendance,date}',
    'time',r.payload#>>'{attendance,time}','validatedAt',r.payload#>>'{attendance,validatedAt}',
    'rows',coalesce((select jsonb_agg(jsonb_build_object('id',a->>'id','squadPlayerId',a->>'squadPlayerId',
      'name',left(a->>'name',100),'included',a->'included','status',a->>'status'))
      from jsonb_array_elements(case when jsonb_typeof(r.payload#>'{attendance,rows}')='array'
       then r.payload#>'{attendance,rows}' else '[]'::jsonb end) a),'[]'::jsonb)) else null end,
   'eventType',r.payload->>'eventType','agendaSourceKey',r.payload->>'agendaSourceKey','statsEventId',r.payload->>'statsEventId',
   'info',jsonb_build_object('category',r.payload#>>'{info,category}','date',r.payload#>>'{info,date}',
    'time',r.payload#>>'{info,time}','opponent',left(r.payload#>>'{info,opponent}',150),
    'goalsFor',r.payload#>>'{info,goalsFor}','goalsAgainst',r.payload#>>'{info,goalsAgainst}',
    'duration',r.payload#>>'{info,duration}'),
   'ratings',case when r.kind='report' then (select jsonb_object_agg(k,jsonb_build_object('score',r.payload#>>array['ratings',k,'score']))
    from unnest(array['project','defence','attack','physical','cohesion','attitude','emotions']) k) else null end,
   'players',case when r.kind='report' then coalesce((select jsonb_agg(jsonb_build_object(
    'id',a->>'id','squadPlayerId',a->>'squadPlayerId','name',left(a->>'name',100),'minutes',a->>'minutes',
    'goals',a->>'goals','assists',a->>'assists','yellowCards',a->>'yellowCards','redCards',a->>'redCards'))
    from jsonb_array_elements(case when jsonb_typeof(r.payload->'players')='array'
     then r.payload->'players' else '[]'::jsonb end) a),'[]'::jsonb) else null end
  )) order by r.updated_at desc,r.id) from recent r),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.club_management_statistics() from public,anon;
grant execute on function public.club_management_statistics() to authenticated;
notify pgrst, 'reload schema';
commit;
