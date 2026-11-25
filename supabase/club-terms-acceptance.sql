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
