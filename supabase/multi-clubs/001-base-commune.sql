-- Projet Supabase neuf. Cette migration ne convertit aucune installation existante.
begin;

do $$
begin
 if to_regclass('public.club_members') is not null
    or to_regclass('public.club_documents') is not null then
  raise exception 'Utilisez un projet neuf pour la base multi-clubs.';
 end if;
end;
$$;

create table public.cruza_clubs (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,60}$'),
 name text not null check (length(btrim(name)) between 1 and 100),
 active boolean not null default true
);

create table public.cruza_memberships (
 club_id uuid not null references public.cruza_clubs(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('educateur', 'responsable')),
 active boolean not null default true,
 primary key (club_id, user_id)
);
create index cruza_memberships_user on public.cruza_memberships(user_id);

create table public.cruza_teams (
 club_id uuid not null references public.cruza_clubs(id),
 id uuid not null default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 1 and 100),
 primary key (club_id, id)
);

create table public.cruza_documents (
 club_id uuid not null,
 id uuid not null default gen_random_uuid(),
 owner_id uuid not null default auth.uid(),
 team_id uuid,
 kind text not null check (kind in ('effectif','seance','composition','bilan','agenda','parametres','photo')),
 title text not null check (length(btrim(title)) between 1 and 160),
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 shared boolean not null default false,
 primary key (club_id, id),
 foreign key (club_id, owner_id) references public.cruza_memberships(club_id, user_id),
 foreign key (club_id, team_id) references public.cruza_teams(club_id, id),
 check (kind not in ('parametres','photo') or not shared)
);
create index cruza_documents_owner on public.cruza_documents(club_id, owner_id);

-- The caller can only ask about their own active membership.
create function public.cruza_role(target uuid) returns text
language sql stable security definer set search_path = ''
as $$
 select m.role
 from public.cruza_memberships m
 join public.cruza_clubs c on c.id = m.club_id
 where m.club_id = target and m.user_id = (select auth.uid()) and m.active and c.active
$$;
revoke all on function public.cruza_role(uuid) from public, anon;
grant execute on function public.cruza_role(uuid) to authenticated;

alter table public.cruza_clubs enable row level security;
alter table public.cruza_memberships enable row level security;
alter table public.cruza_teams enable row level security;
alter table public.cruza_documents enable row level security;
revoke all on public.cruza_clubs, public.cruza_memberships, public.cruza_teams, public.cruza_documents
from public, anon, authenticated;
grant select on public.cruza_clubs, public.cruza_memberships, public.cruza_teams, public.cruza_documents to authenticated;
grant insert (club_id, team_id, kind, title, payload, shared),
 update (team_id, title, payload, shared), delete on public.cruza_documents to authenticated;

create policy cruza_club_read on public.cruza_clubs for select to authenticated
 using (public.cruza_role(id) is not null);
create policy cruza_membership_read on public.cruza_memberships for select to authenticated
 using (public.cruza_role(club_id) is not null and
        (user_id = (select auth.uid()) or public.cruza_role(club_id) = 'responsable'));
create policy cruza_team_read on public.cruza_teams for select to authenticated
 using (public.cruza_role(club_id) is not null);
create policy cruza_document_read on public.cruza_documents for select to authenticated
 using (public.cruza_role(club_id) is not null and (owner_id = (select auth.uid()) or shared));
create policy cruza_document_insert on public.cruza_documents for insert to authenticated
 with check (public.cruza_role(club_id) is not null and owner_id = (select auth.uid()));
create policy cruza_document_update on public.cruza_documents for update to authenticated
 using (public.cruza_role(club_id) is not null and owner_id = (select auth.uid()))
 with check (public.cruza_role(club_id) is not null and owner_id = (select auth.uid()));
create policy cruza_document_delete on public.cruza_documents for delete to authenticated
 using (public.cruza_role(club_id) is not null and owner_id = (select auth.uid()));

-- Private files. Convention: <club UUID>/<owner UUID>/<file>.
insert into storage.buckets (id, name, public) values ('cruza-club-private', 'cruza-club-private', false);
create function public.cruza_owns_file(object_name text) returns boolean
language sql stable set search_path = ''
as $$
 select case when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then public.cruza_role(split_part(object_name, '/', 1)::uuid) is not null
    and split_part(object_name, '/', 2) = (select auth.uid())::text
    and split_part(object_name, '/', 3) <> ''
  else false end
$$;
revoke all on function public.cruza_owns_file(text) from public, anon;
grant execute on function public.cruza_owns_file(text) to authenticated;
create policy cruza_file_read on storage.objects for select to authenticated
 using (bucket_id = 'cruza-club-private' and public.cruza_owns_file(name));
create policy cruza_file_insert on storage.objects for insert to authenticated
 with check (bucket_id = 'cruza-club-private' and public.cruza_owns_file(name));
create policy cruza_file_update on storage.objects for update to authenticated
 using (bucket_id = 'cruza-club-private' and public.cruza_owns_file(name))
 with check (bucket_id = 'cruza-club-private' and public.cruza_owns_file(name));
create policy cruza_file_delete on storage.objects for delete to authenticated
 using (bucket_id = 'cruza-club-private' and public.cruza_owns_file(name));
commit;
