# Configurations des clubs Cruza

| Club | Identité | Déploiement |
| --- | --- | --- |
| 01 | Stade Mayennais | GitHub Pages et projet Supabase existants |
| 02 | Club pilote, nom à confirmer | Origine dédiée et projet Supabase neuf à créer |

Les fiches utilisent le même format. Elles ne contiennent que les paramètres publics. Les secrets et les mots de passe appartiennent aux réglages privés des services.

## Préparer une configuration

1. Renseigner le nom du club, son origine HTTPS et l’URL et la clé publiable de son projet Supabase. Le club 02 garde les intégrations Canva et classement vides tant qu’elles ne disposent pas de leur configuration dédiée.
2. Dans une copie séparée du site, exécuter `python3 scripts/configure-club-deployment.py clubs/02-pilote/configuration.json /chemin/vers/la-copie`. La commande remplace les configurations publiques de Supabase, Canva et du classement dans cette copie et refuse toute cible située dans le dépôt.
3. Valider les connexions sur l’origine dédiée, l’identité du club, le schéma Supabase et la séparation des accès avant publication. Le logo et les couleurs restent configurables dans les paramètres du club. Le générateur ne publie aucun fichier.

Le lot SQL d’installation est commun et réservé aux projets neufs. Le projet SMFC a été renommé « Cruza - Stade Mayennais » dans Supabase. Son identifiant, sa base et son URL d’API sont conservés. L’API de gestion a refusé la création du club 02 avec les droits disponibles.
