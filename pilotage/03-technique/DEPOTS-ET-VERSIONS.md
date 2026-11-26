# Dépôts et versions

Pendant cette phase, un seul dépôt distant existe et est accessible en Git. On y classe le pilotage sans déplacer les fichiers utilisés en production.

## Routine

1. Partir de `main` à jour, créer `feat/sujet` ou `fix/sujet`.
2. Documenter le problème et le comportement attendu avec le modèle d’issue.
3. Modifier, tester, ouvrir une pull request avec une capture si utile.
4. Faire valider, fusionner, vérifier le déploiement et noter le commit livré par installation.
5. Identifier une version commerciale seulement après recette. Ne pas appeler « v1.0 commercial » un simple rangement de fichiers.

## Protections à activer avec l’accès administrateur

Sur main : pull request obligatoire, une approbation, contrôle « Contrôles CRUZA », blocage des suppressions et force-push. Le fichier CODEOWNERS propose le propriétaire actuel ; il ne configure pas ces règles à lui seul. Vérifier les options disponibles pour les dépôts privés avec le plan GitHub choisi.

Conserver les workflows PWA/Pages et le reporting existants. Pour le club pilote, garder le dépôt Cruza comme source commune et utiliser une origine dédiée. Le registre [environnements](../environnements.json) distingue les sites publiés des cibles encore à créer.

## Préparer le deuxième club

- Utiliser une branche de préparation. Les workflows de publication du Stade Mayennais restent liés à `main`.
- Les fiches suivent le même format pour [Club 01 · Stade Mayennais](../../clubs/01-stade-mayennais/configuration.json) et [Club 02 · Pilote](../../clubs/02-pilote/configuration.json). Le [guide des configurations](../../clubs/README.md) explique comment générer les fichiers du site dans le dossier de déploiement dédié.
- Générer le lot SQL avec `python3 scripts/build-club-installation.py` et vérifier l’installation neuve avec le test du dépôt. Les scripts SQL canoniques dans `supabase/` restent à leur emplacement actuel.
- Une fois le projet isolé créé, appliquer la [procédure Supabase](../04-donnees-supabase/INSTALLER-UN-CLUB.md) et vérifier que le site pilote pointe exclusivement vers ce projet, y compris depuis les écrans de connexion et Responsable. Configurer séparément les services optionnels avant de les proposer au club.
