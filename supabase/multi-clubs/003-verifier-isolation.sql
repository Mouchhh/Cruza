-- Cruza - Multi-clubs uniquement. Les comptes et documents ci-dessous disparaissent au rollback.
begin;
set local statement_timeout = '15s';

do $$
begin
  if to_regclass('public.cruza_memberships') is null or to_regclass('public.club_members') is not null then
    raise exception 'Ouvrez le projet Cruza - Multi-clubs avant de lancer ce test.';
  end if;
end;
$$;

-- Identifiants aléatoires par exécution. Aucun e-mail réel ni mot de passe.
select set_config('cruza.test_a', gen_random_uuid()::text, true),
       set_config('cruza.test_b', gen_random_uuid()::text, true),
       set_config('cruza.test_user_a', gen_random_uuid()::text, true),
       set_config('cruza.test_user_b', gen_random_uuid()::text, true);

insert into auth.users(id, email)
select id::uuid, id || '@cruza-test.invalid'
from (values (current_setting('cruza.test_user_a')), (current_setting('cruza.test_user_b'))) as fixtures(id);

insert into public.cruza_clubs(id, slug, name)
select id::uuid, 'test-' || id, name
from (values (current_setting('cruza.test_a'), 'Club fictif A'),
             (current_setting('cruza.test_b'), 'Club fictif B')) as fixtures(id, name);

insert into public.cruza_memberships(club_id,user_id,role)
values (current_setting('cruza.test_a')::uuid, current_setting('cruza.test_user_a')::uuid,'educateur'),
       (current_setting('cruza.test_b')::uuid, current_setting('cruza.test_user_b')::uuid,'responsable');

set local role authenticated;
do $$
declare
  own_club uuid;
  other_club uuid;
  coach uuid;
  suffix text;
begin
  foreach suffix in array array['a', 'b'] loop
    own_club := current_setting('cruza.test_' || suffix)::uuid;
    other_club := current_setting('cruza.test_' || case when suffix = 'a' then 'b' else 'a' end)::uuid;
    coach := current_setting('cruza.test_user_' || suffix)::uuid;
    perform set_config('request.jwt.claim.sub', coach::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', coach::text, 'role','authenticated')::text, true);
    if not exists (select 1 from public.cruza_clubs where id = own_club)
      or exists (select 1 from public.cruza_clubs where id = other_club) then
      raise exception 'Visibilité incorrecte des clubs pour le compte %.', suffix;
    end if;
    insert into public.cruza_documents(club_id,kind,title,payload,shared)
    values (own_club,'seance','Séance fictive','{}',true);
    if not exists (select 1 from public.cruza_documents where club_id = own_club)
      or exists (select 1 from public.cruza_documents where club_id = other_club) then
      raise exception 'Visibilité incorrecte des séances pour le compte %.', suffix;
    end if;
    begin
      insert into public.cruza_documents(club_id,kind,title,payload)
      values (other_club,'seance','Écriture hors club','{}');
      raise exception 'Une écriture hors club a été autorisée pour le compte %.', suffix;
    exception when insufficient_privilege then
      null;
    end;
  end loop;

  coach := current_setting('cruza.test_user_a')::uuid;
  perform set_config('request.jwt.claim.sub', coach::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', coach::text, 'role','authenticated')::text, true);
  if exists (select 1 from public.cruza_documents where club_id = current_setting('cruza.test_b')::uuid) then
    raise exception 'Le compte A voit la séance du club B.';
  end if;
end;
$$;
reset role;

rollback;
select 'OK — accès au club propre, lecture et écriture hors club bloquées dans les deux sens. Essai annulé.' as resultat;
