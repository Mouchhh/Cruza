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

Conserver les workflows PWA/Pages et le reporting existants. La migration vers trois dépôts doit prévoir les URL OAuth, les secrets Actions et les versions installées avant toute bascule DNS.
