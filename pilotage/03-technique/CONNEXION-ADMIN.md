# Terminer les opérations administrateur

Les connexions dans le navigateur personnel ne sont pas automatiquement transmises à Codex. L’accès Git au dépôt existant est distinct de l’accès administrateur aux API.

## GitHub

1. Dans le compte propriétaire, créer une organisation gratuite si souhaité, en vérifiant son nom et les options du plan. Ne pas transférer le SMFC à cette étape.
2. Dans un environnement privé authentifié, préparer le plan : `python3 scripts/prepare-github-repositories.py --owner NOM_DU_PROPRIETAIRE`.
3. Après contrôle du propriétaire et de la visibilité, lancer avec `--apply`. Le script requiert un GH_TOKEN d’administration fourni de manière privée ; il crée seulement trois dépôts privés vides, sans suppression ni transfert.
4. Importer le contenu préparé du dossier personnel, puis activer main, les protections et un Project. Ne pas annoncer ces opérations faites tant que les URL et règles ne sont pas vérifiées.

## Supabase

L’inventaire peut être obtenu avec `python3 scripts/supabase-admin.py --output /dossier-prive/projets.json` dans un environnement doté de SUPABASE_ACCESS_TOKEN. Le script ne récupère ni ne publie les mots de passe des bases.

L’installation neuve exige la référence répétée dans `--install-new-project REF --confirm-ref REF`. Le projet SMFC est explicitement interdit et le SQL refuse toute installation applicative ou tout compte Auth déjà présent. Aucun projet ni plan payant n’est créé par cet outil. Le coût et la région doivent être validés avant une création de projet dans Supabase.

Ne pas envoyer de jeton dans la conversation. Ne pas placer de clés d’administration dans les fichiers JavaScript ou dans GitHub Pages.
