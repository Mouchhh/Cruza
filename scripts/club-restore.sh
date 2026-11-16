#!/usr/bin/env bash
# Restauration des tables applicatives sur cible vide, comptes déjà restaurés.
set -euo pipefail
umask 077
if [[ $# != 2 || "$1" != '--empty-target' || -z ${PGSERVICE:-} ]]; then
  echo 'Usage : PGSERVICE=club_test bash scripts/club-restore.sh --empty-target /dossier-prive/club.dump' >&2
  exit 2
fi
command -v pg_restore >/dev/null
command -v psql >/dev/null
[[ -f "$2" ]] || { echo 'Archive introuvable.' >&2; exit 2; }
stage=$(mktemp)
listing=$(mktemp)
trap 'rm -f "$stage" "$listing"' EXIT
pg_restore --list "$2" > "$listing"
cat > "$stage" <<'SQL'
-- Verrouille les tables pendant le contrôle et toute la restauration.
lock table public.club_members,public.club_documents,public.club_invitations,
 public.club_sport_leads,public.club_document_reviews in access exclusive mode;
do $$begin
 if exists(select 1 from public.club_members)
 or exists(select 1 from public.club_documents)
 or exists(select 1 from public.club_invitations)
 or exists(select 1 from public.club_sport_leads)
 or exists(select 1 from public.club_document_reviews) then
 raise exception 'Restauration refusée : les tables cibles doivent être vides';
 end if;
end $$;
SQL
if rg_role=$(awk '$0 ~ / TABLE DATA public club_management_access / {print "yes"; exit}' "$listing"); [[ "$rg_role" == 'yes' ]]; then
  cat >> "$stage" <<'SQL'
do $$begin
 if to_regclass('public.club_management_access') is null then
  raise exception 'La cible doit installer la migration Responsable avant de restaurer ses droits';
 end if;
end $$;
SQL
fi
cat >> "$stage" <<'SQL'
do $$begin
 if to_regclass('public.club_management_access') is not null then
  execute 'lock table public.club_management_access in access exclusive mode';
  if exists(select 1 from public.club_management_access) then
   raise exception 'Restauration refusée : les droits Responsable cibles doivent être vides';
  end if;
 end if;
end $$;
SQL
pg_restore --data-only --no-owner --no-privileges --file=- "$2" >> "$stage"
# Aucun DELETE/TRUNCATE ni désactivation des droits, contraintes ou triggers.
# Une erreur (notamment compte auth manquant) annule toute la transaction.
psql --no-psqlrc --set=ON_ERROR_STOP=1 --single-transaction --file="$stage"
echo 'Transaction terminée. Vérifiez les comptes, droits et documents avant de remettre le site en service.'
