-- Uniquement sur Cruza - Multi-clubs (nzmkeylibdcqmgqopesu).
-- Créer deux utilisateurs fictifs dans Authentication > Users avant de lancer.
-- Remplacer les deux adresses par celles des comptes de test. Aucun mot de passe ici.
begin;
do $$
declare
 email_a text := 'test-a@example.invalid';
 email_b text := 'test-b@example.invalid';
 user_a uuid;
 user_b uuid;
 club_a uuid;
 club_b uuid;
begin
 select id into user_a from auth.users where lower(email) = lower(email_a);
 select id into user_b from auth.users where lower(email) = lower(email_b);
 if user_a is null or user_b is null or user_a = user_b then
  raise exception 'Deux comptes de test distincts doivent exister dans Authentication.';
 end if;
 insert into public.cruza_clubs(slug, name)
 values ('essai-club-a', 'Club fictif A'), ('essai-club-b', 'Club fictif B')
 on conflict (slug) do nothing;
 select id into strict club_a from public.cruza_clubs where slug = 'essai-club-a';
 select id into strict club_b from public.cruza_clubs where slug = 'essai-club-b';
 if exists (
  select 1 from public.cruza_memberships
  where (user_id = user_a and club_id <> club_a) or (user_id = user_b and club_id <> club_b)
 ) then
  raise exception 'Les comptes doivent être réservés à un seul club fictif chacun pour ce test.';
 end if;
 insert into public.cruza_memberships(club_id, user_id, role)
 values (club_a, user_a, 'educateur'), (club_b, user_b, 'responsable')
 on conflict (club_id, user_id) do nothing;
end;
$$;
commit;
