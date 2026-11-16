-- Lecture seule : aucun contenu ni adresse d’éducateur n’est retourné.
-- À exécuter dans SQL Editor avec un compte administrateur du bon projet.
with attendu(nom) as (values
 ('club_members'),('club_documents'),('club_invitations'),('club_presence'),
 ('club_sport_leads'),('club_document_reviews'),('club_management_access'))
select a.nom as table_attendue,c.oid is not null as presente,
 coalesce(c.relrowsecurity,false) as rls_active
from attendu a left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=a.nom and c.relkind='r'
order by a.nom;

select schemaname,tablename,policyname,roles,cmd
from pg_policies where schemaname='public' and tablename like 'club_%'
order by tablename,policyname;

select p.proname as fonction,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_peut_executer,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as compte_peut_executer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('club_authorize_educator','club_publish_document','club_management_access_info',
  'club_management_overview','club_management_statistics','club_registration_ready')
order by p.proname;
