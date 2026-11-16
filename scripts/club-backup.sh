#!/usr/bin/env bash
# Données du club uniquement ; connexion via pg_service.conf / pgpass.
set -euo pipefail
umask 077
if [[ $# != 1 || -z ${PGSERVICE:-} ]]; then
  echo 'Usage : PGSERVICE=club_source bash scripts/club-backup.sh /dossier-prive/club.dump' >&2
  exit 2
fi
command -v pg_dump >/dev/null
command -v pg_restore >/dev/null
command -v psql >/dev/null
target=$1
if [[ -e "$target" ]]; then echo 'Le fichier existe déjà ; choisissez un autre nom.' >&2; exit 2; fi
stage=$(mktemp "${target}.XXXXXX")
trap 'rm -f "$stage"' EXIT
tables=(public.club_members public.club_documents public.club_invitations public.club_sport_leads public.club_document_reviews)
# Compatibilité avec les installations antérieures à l’espace Responsable.
management=$(psql --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --command="select to_regclass('public.club_management_access') is not null")
case "$management" in
  t) tables+=(public.club_management_access);;
  f) ;;
  *) echo 'Impossible de vérifier la présence des droits Responsable.' >&2; exit 1;;
esac
options=()
for table in "${tables[@]}"; do options+=(--table="$table"); done
pg_dump --format=custom --data-only --no-owner --no-privileges \
  "${options[@]}" --file="$stage"
pg_restore --list "$stage" >/dev/null
# Ne jamais écraser une archive existante, même créée pendant le dump.
ln "$stage" "$target"
echo 'Archive créée. Elle contient des données personnelles : conservez-la hors du dépôt et du site.'
echo 'Les droits Responsable sont inclus si leur table est installée.'
echo 'Les comptes Authentication, fichiers Storage et brouillons locaux ne sont pas inclus.'
