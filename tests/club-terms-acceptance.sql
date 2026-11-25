-- PostgreSQL temporaire VIDE uniquement. Teste la preuve d'acceptation des CGU.
\set ON_ERROR_STOP on
\ir club-accounts-access.sql
\ir ../supabase/club-terms-acceptance.sql
\ir ../supabase/club-terms-acceptance.sql
create temp table t_inv as select * from public.club_authorize_educator('terms@example.test','Terms Coach');
do $$begin
 begin insert into auth.users(id,email,raw_user_meta_data) select '00000000-0000-4000-8000-000000000009','terms@example.test',jsonb_build_object('club_activation_code',activation_code) from t_inv;raise exception 'Signup without terms allowed';exception when sqlstate '22023' then null;end;
 insert into auth.users(id,email,raw_user_meta_data) select '00000000-0000-4000-8000-000000000009','terms@example.test',jsonb_build_object('club_activation_code',activation_code,'terms_accepted','true','terms_version','v0.1-test') from t_inv;
 if not exists(select 1 from public.club_terms_acceptances where user_id='00000000-0000-4000-8000-000000000009' and version='v0.1-test') then raise exception 'Acceptance proof missing';end if;
end $$;
