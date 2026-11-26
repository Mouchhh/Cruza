# Base commune Cruza

La migration [001-base-commune.sql](001-base-commune.sql) est destinée à un projet Supabase neuf. Elle installe les clubs, appartenances, équipes, documents et stockage privé. Elle refuse le schéma historique du Stade Mayennais.

Les éducateurs ont le même compte pour leurs différents clubs. Le serveur tient compte des appartenances actives à chaque lecture et écriture. Un éducateur peut publier un document à son club. Ses paramètres et photos privés sont lisibles par lui seul. Les responsables voient les appartenances de leur club et les documents partagés, avec les mêmes limites que les autres membres sur les documents privés.

Le test `tests/multi-club-access.mjs` vérifie les politiques PostgreSQL avec deux clubs fictifs et un compte commun aux deux. Il simule Auth et Storage. Les comportements en conditions Supabase réelles restent à valider.

## Raccordement restant avant la mise en service

1. Disposer d’un projet Supabase neuf et appliquer la migration sur ce seul projet.
2. Adapter la sélection du club, les invitations, les RPC, les synchronisations et les brouillons au contexte de club. Le site actuel utilise toujours les tables et RPC de l’installation dédiée.
3. Tester les parcours réels avec deux clubs, y compris le compte commun et la révocation. Préparer ensuite une reprise des données SMFC après sauvegarde et validation, avec retour possible vers le site actuel.

## Aperçu de test du nouveau projet

La [page de test](../../apercu-multi-clubs/index.html) cible uniquement le projet `nzmkeylibdcqmgqopesu`. C’est un banc d’essai de connexion, de sélection du club et de lecture et écriture de séances fictives. Le site de production utilise son propre projet. Ouvrir cette page via un serveur HTTP statique ou sur une préproduction dédiée.

Créer deux utilisateurs fictifs confirmés dans **Authentication → Users**, puis adapter et exécuter [002-jeu-essai.sql](002-jeu-essai.sql) dans le nouveau projet. Dans la page de test, saisir la clé **Publishable** du nouveau projet ainsi que le compte fictif. Les informations ne sont pas enregistrées par la page. Connecter le compte A, partager une séance fictive et fermer la session. Avec le compte B, vérifier que seul le club B apparaît et que la séance A est absente. Tester aussi dans le sens inverse. Les tests SQL locaux complètent cet essai avec des opérations de tentative d’accès direct.
