# Base commune Cruza

La migration [001-base-commune.sql](001-base-commune.sql) est destinée à un projet Supabase neuf. Elle installe les clubs, appartenances, équipes, documents et stockage privé. Elle refuse le schéma historique du Stade Mayennais.

Les éducateurs ont le même compte pour leurs différents clubs. Le serveur tient compte des appartenances actives à chaque lecture et écriture. Un éducateur peut publier un document à son club. Ses paramètres et photos privés sont lisibles par lui seul. Les responsables voient les appartenances de leur club et les documents partagés, avec les mêmes limites que les autres membres sur les documents privés.

Le test `tests/multi-club-access.mjs` vérifie les politiques PostgreSQL avec deux clubs fictifs et un compte commun aux deux. Il simule Auth et Storage. Les comportements en conditions Supabase réelles restent à valider.

## Raccordement restant avant la mise en service

1. Disposer d’un projet Supabase neuf et appliquer la migration sur ce seul projet.
2. Adapter la sélection du club, les invitations, les RPC, les synchronisations et les brouillons au contexte de club. Le site actuel utilise toujours les tables et RPC de l’installation dédiée.
3. Tester les parcours réels avec deux clubs, y compris le compte commun et la révocation. Préparer ensuite une reprise des données SMFC après sauvegarde et validation, avec retour possible vers le site actuel.
