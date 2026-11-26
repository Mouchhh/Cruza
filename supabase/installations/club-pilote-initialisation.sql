-- CRUZA — initialisation d’un projet Supabase NEUF uniquement.
-- Généré depuis les migrations du dépôt. Aucun compte ni droit nominatif créé.
-- Refuse les projets déjà utilisés. Ne pas exécuter sur le SMFC existant.
begin;
do $preflight$
begin
 if to_regclass('auth.users') is null then
  raise exception 'Projet Supabase attendu : schéma Auth absent';
 end if;
 if to_regclass('public.club_members') is not null or to_regclass('public.club_documents') is not null then
  raise exception 'Initialisation refusée : une installation applicative existe déjà. Ne supprimez aucune table.';
 end if;
 if exists(select 1 from auth.users) then
  raise exception 'Initialisation refusée : ce projet contient déjà des comptes Auth.';
 end if;
end;
$preflight$;

-- SOURCE : club.sql
-- Un projet Supabase dédié au club. Script réexécutable sans supprimer les données.
-- Les comptes sont créés dans Authentication puis autorisés dans club_members.

create table if not exists public.club_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(trim(display_name)) between 1 and 70),
 active boolean not null default true
);
alter table public.club_members enable row level security;

create or replace function public.club_is_member() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.club_members where user_id = auth.uid() and active); $$;
revoke all on function public.club_is_member() from public, anon;
grant execute on function public.club_is_member() to authenticated;
drop policy if exists members_read on public.club_members;
create policy members_read on public.club_members for select to authenticated
 using ((select public.club_is_member()));
revoke all on public.club_members from public, anon, authenticated;
grant select on public.club_members to authenticated;

create table if not exists public.club_documents (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references public.club_members(user_id) on delete cascade,
 kind text not null check (kind in ('training','report','composition')),
 source_id text not null check (length(source_id) between 1 and 100),
 title text not null check (length(trim(title)) between 1 and 150),
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 8388608),
 revision integer not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 unique(owner_id,kind,source_id)
);
create index if not exists club_documents_recent on public.club_documents(updated_at desc,id);
alter table public.club_documents enable row level security;
drop policy if exists documents_read on public.club_documents;
create policy documents_read on public.club_documents for select to authenticated
 using ((select public.club_is_member()));
drop policy if exists documents_insert on public.club_documents;
create policy documents_insert on public.club_documents for insert to authenticated
 with check ((select public.club_is_member()) and owner_id = (select auth.uid()));
drop policy if exists documents_update on public.club_documents;
create policy documents_update on public.club_documents for update to authenticated
 using ((select public.club_is_member()) and owner_id = (select auth.uid()))
 with check ((select public.club_is_member()) and owner_id = (select auth.uid()));
drop policy if exists documents_delete on public.club_documents;
create policy documents_delete on public.club_documents for delete to authenticated
 using ((select public.club_is_member()) and owner_id = (select auth.uid()));
-- Écriture uniquement par RPC : protège également les versions contre les mises à jour concurrentes.
revoke all on public.club_documents from public, anon, authenticated;
grant select on public.club_documents to authenticated;

create or replace function public.club_publish_document(
 p_kind text,p_source_id text,p_title text,p_payload jsonb,p_expected_revision integer,p_expected_id uuid default null
) returns public.club_documents
language plpgsql security definer set search_path = '' as $$
declare result public.club_documents; actor uuid := auth.uid();
begin
 if actor is null or not public.club_is_member() then
  raise exception 'Accès réservé aux éducateurs autorisés' using errcode = '42501';
 end if;
 if p_expected_revision = 0 then
  insert into public.club_documents(owner_id,kind,source_id,title,payload)
   values(actor,p_kind,p_source_id,p_title,p_payload)
   on conflict(owner_id,kind,source_id) do nothing returning * into result;
 elsif p_expected_revision > 0 then
  update public.club_documents set title=p_title,payload=p_payload,revision=revision+1,updated_at=now()
   where owner_id=actor and kind=p_kind and source_id=p_source_id and revision=p_expected_revision and id=p_expected_id
   returning * into result;
 end if;
 if result.id is null then
  raise exception 'Version modifiée : récupérer la version partagée avant de réessayer' using errcode = 'PT409';
 end if;
 return result;
end; $$;
revoke all on function public.club_publish_document(text,text,text,jsonb,integer,uuid) from public,anon;
grant execute on function public.club_publish_document(text,text,text,jsonb,integer,uuid) to authenticated;

create or replace function public.club_remove_document(p_id uuid,p_expected_revision integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.club_is_member() then
  raise exception 'Accès réservé aux éducateurs autorisés' using errcode = '42501';
 end if;
 delete from public.club_documents where id=p_id and owner_id=auth.uid() and revision=p_expected_revision;
 if not found then
  raise exception 'Version modifiée ou document non autorisé' using errcode = 'PT409';
 end if;
end; $$;
revoke all on function public.club_remove_document(uuid,integer) from public,anon;
grant execute on function public.club_remove_document(uuid,integer) to authenticated;
notify pgrst, 'reload schema';


-- SOURCE : club-accounts.sql
-- Migration à exécuter APRÈS club.sql. Réexécutable, sans suppression des comptes/documents.
-- Autorise l'inscription uniquement des adresses préalablement approuvées par le club.

create table if not exists public.club_invitations (
 email text primary key check (email=lower(trim(email)) and length(email) between 3 and 254 and position('@' in email)>1),
 display_name text not null check (length(trim(display_name)) between 1 and 70),
 active boolean not null default true,
 activation_code_hash text check (activation_code_hash is null or activation_code_hash ~ '^[0-9a-f]{64}$')
);
alter table public.club_invitations enable row level security;
revoke all on public.club_invitations from public,anon,authenticated;
-- Reprendre les autorisations existantes, sans réactiver une invitation déjà désactivée.
insert into public.club_invitations(email,display_name,active)
 select lower(trim(u.email)),m.display_name,m.active
 from public.club_members m join auth.users u on u.id=m.user_id
 where u.email is not null
 on conflict(email) do nothing;

create or replace function public.club_guard_registration() returns trigger
language plpgsql security definer set search_path='' as $$
declare given_name text;family_name text;
begin
 if new.email is null or not exists(
  select 1 from public.club_invitations i where i.email=lower(trim(new.email)) and i.active
   and i.activation_code_hash=encode(sha256(convert_to(coalesce(new.raw_user_meta_data->>'club_activation_code',''),'UTF8')),'hex')
 ) then
  raise exception 'Inscription réservée aux adresses autorisées par le club' using errcode='42501';
 end if;
 if new.raw_user_meta_data ? 'first_name' or new.raw_user_meta_data ? 'last_name' then
  given_name:=case when jsonb_typeof(new.raw_user_meta_data->'first_name')='string' then trim(new.raw_user_meta_data->>'first_name') else '' end;
  family_name:=case when jsonb_typeof(new.raw_user_meta_data->'last_name')='string' then trim(new.raw_user_meta_data->>'last_name') else '' end;
  if length(given_name) not between 1 and 35 or length(family_name) not between 1 and 35 or length(given_name||' '||family_name)>70 then
   raise exception 'Prénom et nom obligatoires, 70 caractères maximum au total' using errcode='22023';
  end if;
  new.raw_user_meta_data:=jsonb_set(jsonb_set(new.raw_user_meta_data,'{first_name}',to_jsonb(given_name)),'{last_name}',to_jsonb(family_name));
 end if;
 new.raw_user_meta_data:=coalesce(new.raw_user_meta_data,'{}'::jsonb)-'club_activation_code';
 return new;
end; $$;
revoke all on function public.club_guard_registration() from public,anon,authenticated;
drop trigger if exists club_registration_guard on auth.users;
create trigger club_registration_guard before insert on auth.users
 for each row execute function public.club_guard_registration();

create or replace function public.club_register_member() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.club_members(user_id,display_name,active)
 select new.id,case when new.raw_user_meta_data ? 'first_name' then (new.raw_user_meta_data->>'first_name')||' '||(new.raw_user_meta_data->>'last_name') else i.display_name end,true from public.club_invitations i
 where i.email=lower(trim(new.email)) and i.active
 on conflict(user_id) do nothing;
 update public.club_invitations set activation_code_hash=null where email=lower(trim(new.email));
 return new;
end; $$;
revoke all on function public.club_register_member() from public,anon,authenticated;
drop trigger if exists club_registration_member on auth.users;
create trigger club_registration_member after insert on auth.users
 for each row execute function public.club_register_member();

-- Retirer l'autorisation ferme aussi l'accès des comptes déjà créés.
create or replace function public.club_invitation_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare target_email text;
begin
 target_email:=case when tg_op='DELETE' then old.email else new.email end;
 if tg_op='UPDATE' and old.email<>new.email then
  update public.club_members set active=false where user_id in(select id from auth.users where lower(trim(email))=old.email);
 end if;
 update public.club_members set active=case when tg_op='DELETE' then false else new.active end
 where user_id in(select id from auth.users where lower(trim(email))=target_email);
 if tg_op='DELETE' then return old;end if;
 return new;
end; $$;
revoke all on function public.club_invitation_changed() from public,anon,authenticated;
drop trigger if exists club_invitation_access on public.club_invitations;
create trigger club_invitation_access after update or delete on public.club_invitations
 for each row execute function public.club_invitation_changed();
-- Cette fonction d'administration ne peut pas être appelée depuis le site.
create or replace function public.club_authorize_educator(p_email text,p_name text)
 returns table(invited_email text,activation_code text)
language plpgsql security definer set search_path='' as $$
declare code text:=replace(gen_random_uuid()::text,'-','');normalized text:=lower(trim(p_email));
begin
 insert into public.club_invitations(email,display_name,active,activation_code_hash)
 values(normalized,trim(p_name),true,encode(sha256(convert_to(code,'UTF8')),'hex'))
 on conflict(email) do update set display_name=excluded.display_name,active=true,activation_code_hash=excluded.activation_code_hash;
 return query select normalized,code;
end; $$;
revoke all on function public.club_authorize_educator(text,text) from public,anon,authenticated;

-- Ne révèle aucune adresse : permet à la page de vérifier que le filtre d'inscription est installé.
create or replace function public.club_registration_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select count(*)=2 from pg_catalog.pg_trigger t
 where t.tgrelid='auth.users'::regclass and t.tgname in ('club_registration_guard','club_registration_member') and t.tgenabled<>'D';
$$;
revoke all on function public.club_registration_ready() from public;
grant execute on function public.club_registration_ready() to anon,authenticated;
-- Les nouveaux formulaires vérifient aussi la prise en charge des noms de profil.
create or replace function public.club_profile_registration_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select public.club_registration_ready();
$$;
revoke all on function public.club_profile_registration_ready() from public;
grant execute on function public.club_profile_registration_ready() to anon,authenticated;
notify pgrst,'reload schema';


-- SOURCE : club-terms-acceptance.sql
-- Preuve d'acceptation des CGU à l'inscription. Réexécutable. Ne modifie aucune donnée existante.
-- À lancer APRÈS club-accounts.sql.
create table if not exists public.club_terms_acceptances (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version text not null check (length(version) between 1 and 40),
 accepted_at timestamptz not null default now()
);
alter table public.club_terms_acceptances enable row level security;
revoke all on public.club_terms_acceptances from public,anon,authenticated;
grant select on public.club_terms_acceptances to authenticated;
drop policy if exists club_terms_read_own on public.club_terms_acceptances;
create policy club_terms_read_own on public.club_terms_acceptances for select to authenticated using (user_id=(select auth.uid()));

-- Refuse la création du compte si la case n'est pas cochée (contrôle côté serveur).
create or replace function public.club_require_terms() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.raw_user_meta_data->>'terms_accepted','')<>'true'
  or length(coalesce(new.raw_user_meta_data->>'terms_version',''))not between 1 and 40 then
  raise exception 'Acceptation des CGU obligatoire' using errcode='22023';
 end if;
 return new;
end; $$;
revoke all on function public.club_require_terms() from public,anon,authenticated;
drop trigger if exists club_registration_terms_check on auth.users;
create trigger club_registration_terms_check before insert on auth.users
 for each row execute function public.club_require_terms();

-- Enregistre la preuve (date + version) une fois le compte créé.
create or replace function public.club_record_terms() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.club_terms_acceptances(user_id,version) values(new.id,new.raw_user_meta_data->>'terms_version')
 on conflict(user_id) do nothing;
 return new;
end; $$;
revoke all on function public.club_record_terms() from public,anon,authenticated;
drop trigger if exists club_registration_terms_record on auth.users;
create trigger club_registration_terms_record after insert on auth.users
 for each row execute function public.club_record_terms();


-- SOURCE : club-presence.sql
-- À exécuter après club.sql. Présence temporaire des éducateurs, sans toucher aux documents.
-- Script réexécutable ; chaque navigateur publie uniquement sa propre présence authentifiée.

create table if not exists public.club_presence (
 user_id uuid not null references public.club_members(user_id) on delete cascade,
 session_id uuid not null,
 last_seen timestamptz not null default clock_timestamp(),
 is_online boolean not null default true,
 primary key(user_id,session_id)
);
create index if not exists club_presence_recent on public.club_presence(last_seen);
alter table public.club_presence enable row level security;
revoke all on public.club_presence from public,anon,authenticated;
-- Pas d'accès direct aux sessions, même pour les éducateurs. Lecture agrégée par RPC seulement.
create or replace function public.club_presence_ping(p_session_id uuid,p_online boolean default true)
 returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.club_is_member() then
  raise exception 'Accès réservé aux éducateurs autorisés' using errcode='42501';
 end if;
 if p_online is null then raise exception 'Présence invalide' using errcode='22023';end if;
 insert into public.club_presence(user_id,session_id,last_seen,is_online)
 values(auth.uid(),p_session_id,clock_timestamp(),p_online)
 on conflict(user_id,session_id) do update set last_seen=clock_timestamp(),is_online=excluded.is_online;
 delete from public.club_presence where last_seen<clock_timestamp()-interval '1 day';
end; $$;
revoke all on function public.club_presence_ping(uuid,boolean) from public,anon;
grant execute on function public.club_presence_ping(uuid,boolean) to authenticated;

create or replace function public.club_connected_coaches()
 returns table(user_id uuid,display_name text,last_seen timestamptz)
 language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.club_is_member() then
  raise exception 'Accès réservé aux éducateurs autorisés' using errcode='42501';
 end if;
 return query select m.user_id,m.display_name,max(p.last_seen)
 from public.club_members m join public.club_presence p on p.user_id=m.user_id
 where m.active and p.is_online and p.last_seen>clock_timestamp()-interval '90 seconds'
 group by m.user_id,m.display_name order by m.display_name,m.user_id;
end; $$;
revoke all on function public.club_connected_coaches() from public,anon;
grant execute on function public.club_connected_coaches() to authenticated;
-- Dernière authentification réelle : aucune adresse ni donnée auth n'est exposée.
create or replace function public.club_educator_activity()
 returns table(user_id uuid,display_name text,last_login timestamptz,is_online boolean)
 language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.club_is_member() then
  raise exception 'Accès réservé aux éducateurs autorisés' using errcode='42501';
 end if;
 return query select m.user_id,m.display_name,u.last_sign_in_at,
 exists(select 1 from public.club_presence p where p.user_id=m.user_id and p.is_online and p.last_seen>clock_timestamp()-interval '90 seconds')
 from public.club_members m join auth.users u on u.id=m.user_id
 where m.active order by m.display_name,m.user_id;
end; $$;
revoke all on function public.club_educator_activity() from public,anon;
grant execute on function public.club_educator_activity() to authenticated;
notify pgrst,'reload schema';


-- SOURCE : club-references.sql
-- Après club.sql. Réexécutable ; ne supprime ni comptes ni documents.

create table if not exists public.club_sport_leads (
 user_id uuid primary key references public.club_members(user_id) on delete cascade
);
-- Les anciennes désignations restent conservées mais sans droit global implicite.
alter table public.club_sport_leads add column if not exists pole text not null default 'unassigned';
alter table public.club_sport_leads drop constraint if exists club_sport_leads_pole_check;
alter table public.club_sport_leads add constraint club_sport_leads_pole_check
 check(pole in ('seniors','jeunes','unassigned'));
alter table public.club_sport_leads drop constraint if exists club_sport_leads_pkey;
alter table public.club_sport_leads add primary key(user_id,pole);
alter table public.club_sport_leads enable row level security;
revoke all on public.club_sport_leads from public,anon,authenticated;
create table if not exists public.club_document_reviews (
 document_id uuid primary key references public.club_documents(id) on delete cascade,
 revision integer not null check(revision>0),
 reviewer_id uuid not null references public.club_members(user_id) on delete cascade,
 reviewed_at timestamptz not null default now()
);
-- Les anciennes validations non sectorisées doivent être relues.
alter table public.club_document_reviews add column if not exists pole text;
alter table public.club_document_reviews enable row level security;
revoke all on public.club_document_reviews from public,anon,authenticated;

-- La catégorie de la fiche est la seule source de secteur. Aucun champ JSON de droit
-- ni nom d'équipe ni nom du coach ne peut attribuer un pouvoir de validation.
create or replace function public.club_document_pole(p_kind text,p_payload jsonb) returns text
language sql immutable set search_path='' as $$
 with category as (
  select lower(translate(trim(case when p_kind='report' then p_payload->'info'->>'category'
    when p_kind in ('training','composition') then p_payload->>'category' end),'éèêëÉÈÊË','eeeeEEEE')) as value
 )
 select case
  when value ~ '^u([6-9]|1[0-9]|20)([[:space:]]*/[[:space:]]*u([6-9]|1[0-9]|20))*([[:space:]]+(f|m|feminines?|masculins?|mixte|r[1-3]|d[1-9]|national|regional|district))*$' then 'jeunes'
  when value ~ '^seniors?([[:space:]]+([a-d]|[1-9]|f|m|feminines?|masculins?|mixte|r[1-3]|d[1-9]|national|regional|district))*$' then 'seniors'
  else null end from category;
$$;
revoke all on function public.club_document_pole(text,jsonb) from public,anon,authenticated;

-- Les métadonnées de validation sont indépendantes du JSON modifiable par l'auteur.
create or replace function public.club_reference_overview() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.club_is_member() then
  raise exception 'Accès réservé aux éducateurs autorisés' using errcode='42501';
 end if;
 return jsonb_build_object(
  'scope_version',2,
  'can_review',exists(select 1 from public.club_sport_leads where user_id=auth.uid() and pole in ('seniors','jeunes')),
  'poles',coalesce((select jsonb_agg(pole order by pole) from public.club_sport_leads where user_id=auth.uid() and pole in ('seniors','jeunes')),'[]'::jsonb),
  'references',coalesce((select jsonb_agg(jsonb_build_object(
   'document_id',d.id,'revision',d.revision,'reviewer_id',r.reviewer_id,'reviewed_at',r.reviewed_at,
   'pole',public.club_document_pole(d.kind,d.payload),
   'can_review',exists(select 1 from public.club_sport_leads l where l.user_id=auth.uid() and l.pole=public.club_document_pole(d.kind,d.payload))
  )) from public.club_documents d
  left join public.club_document_reviews r on r.document_id=d.id and r.revision=d.revision
   and r.pole=public.club_document_pole(d.kind,d.payload)
   and exists(select 1 from public.club_sport_leads l join public.club_members m on m.user_id=l.user_id
              where l.user_id=r.reviewer_id and l.pole=r.pole and m.active)
  where d.payload->'clubReference'='true'::jsonb),'[]'::jsonb)
 );
end $$;
create or replace function public.club_review_reference(p_document_id uuid,p_expected_revision integer,p_approve boolean) returns void
language plpgsql security definer set search_path='' as $$
declare doc public.club_documents; doc_pole text;
begin
 if not public.club_is_member() or not exists(select 1 from public.club_sport_leads where user_id=auth.uid() and pole in ('seniors','jeunes')) then
  raise exception 'Validation réservée au responsable sportif désigné' using errcode='42501';
 end if;
 if p_approve is null then raise exception 'Décision manquante' using errcode='22023';end if;
 select * into doc from public.club_documents where id=p_document_id for update;
 if not found or doc.revision is distinct from p_expected_revision then
  raise exception 'Le document a changé : consultez sa nouvelle version' using errcode='PT409';
 end if;
 doc_pole:=public.club_document_pole(doc.kind,doc.payload);
 if doc_pole is null then
  raise exception 'Catégorie à préciser : choisissez Seniors ou une catégorie U6 à U20' using errcode='22023';
 end if;
 if not exists(select 1 from public.club_sport_leads where user_id=auth.uid() and pole=doc_pole) then
  raise exception 'Ce document relève d’un autre pôle sportif' using errcode='42501';
 end if;
 if p_approve then
  if doc.payload->'clubReference' is distinct from 'true'::jsonb then
   raise exception 'Ce document ne figure pas dans les repères proposés' using errcode='22023';
  end if;
  insert into public.club_document_reviews(document_id,revision,reviewer_id,reviewed_at,pole)
   values(doc.id,doc.revision,auth.uid(),now(),doc_pole)
   on conflict(document_id) do update set revision=excluded.revision,reviewer_id=excluded.reviewer_id,reviewed_at=excluded.reviewed_at,pole=excluded.pole;
 else
  delete from public.club_document_reviews where document_id=doc.id;
 end if;
end $$;
revoke all on function public.club_reference_overview() from public,anon;
revoke all on function public.club_review_reference(uuid,integer,boolean) from public,anon;
grant execute on function public.club_reference_overview() to authenticated;
grant execute on function public.club_review_reference(uuid,integer,boolean) to authenticated;
notify pgrst,'reload schema';


-- SOURCE : coach-private-sync.sql
-- Synchronisation personnelle : aucun accès aux autres éducateurs, même responsables.
-- Réexécutable. Ne modifie ni les documents du club ni les données locales.

create table if not exists public.coach_private_records (
 owner_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('settings','photo')),
 record_key text not null,
 payload jsonb not null,
 revision bigint not null default 1 check (revision > 0),
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(owner_id,kind,record_key),
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
 using (owner_id=(select auth.uid()) and (select public.club_is_member()));
create or replace function public.coach_private_write(
 p_owner_id uuid,p_kind text,p_key text,p_payload jsonb,
 p_expected_revision bigint,p_deleted boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.coach_private_records; result public.coach_private_records;
begin
 if auth.uid() is null or auth.uid()<>p_owner_id or not public.club_is_member() then
  raise exception 'Compte non autorisé' using errcode='42501';
 end if;
 if p_kind not in ('settings','photo') or p_kind is null or p_key is null or p_payload is null
    or p_deleted is null or p_expected_revision is null or p_expected_revision<0 then
  raise exception 'Paramètres invalides' using errcode='22023';
 end if;
 -- Serialize this account's writes, including the 30-photo quota check.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_id::text,0));
 select * into existing from public.coach_private_records
  where owner_id=p_owner_id and kind=p_kind and record_key=p_key for update;
 if coalesce(existing.revision,0)<>p_expected_revision then
  raise exception 'Version personnelle modifiée sur un autre appareil' using errcode='40001';
 end if;
 if p_deleted and existing.owner_id is null then
  raise exception 'Donnée personnelle inexistante' using errcode='22023';
 end if;
 if existing.owner_id is null and
    (select count(*) from public.coach_private_records where owner_id=p_owner_id)>=2000 then
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
     (select count(*) from public.coach_private_records where owner_id=p_owner_id and kind='photo' and not deleted)>=30 then
   raise exception '30 photos maximum par éducateur' using errcode='23514';
  end if;
 end if;
 insert into public.coach_private_records(owner_id,kind,record_key,payload,revision,deleted)
 values(p_owner_id,p_kind,p_key,case when p_deleted then '{}'::jsonb else p_payload end,1,p_deleted)
 on conflict(owner_id,kind,record_key) do update set
  payload=excluded.payload,deleted=excluded.deleted,
  revision=coach_private_records.revision+1,updated_at=now()
 returning * into result;
 return to_jsonb(result);
end; $$;
revoke all on function public.coach_private_write(uuid,text,text,jsonb,bigint,boolean) from public,anon;
grant execute on function public.coach_private_write(uuid,text,text,jsonb,bigint,boolean) to authenticated;


-- SOURCE : club-management.sql
-- Espace Responsable, lecture seule. Prérequis : club.sql.
-- Une installation/projet Supabase par club. Aucun rôle accordé automatiquement.

create table if not exists public.club_management_access (
 user_id uuid primary key references public.club_members(user_id) on delete cascade,
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
  where a.user_id=auth.uid() and m.active),'{"allowed":false}'::jsonb);
$$;

create or replace function public.club_management_category(p_kind text,p_payload jsonb) returns text
language sql immutable set search_path='' as $$
 select upper(trim(coalesce(nullif(case when p_kind='report' then p_payload#>>'{info,category}' end,''),
  nullif(p_payload->>'category',''),p_payload#>>'{teamContext,category}','')));
$$;

create or replace function public.club_management_can_read(p_kind text,p_payload jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.club_management_access a join public.club_members m using(user_id)
 where a.user_id=auth.uid() and m.active and
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


-- SOURCE : club-management-statistics.sql
-- Additive migration after club-management.sql. Read-only, same assigned scope.

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


commit;
