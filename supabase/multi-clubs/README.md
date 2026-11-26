# Base commune Cruza

La migration [001-base-commune.sql](001-base-commune.sql) est destinée à un projet Supabase neuf. Elle installe les clubs, appartenances, équipes, documents et stockage privé. Elle refuse le schéma historique du Stade Mayennais.

Les éducateurs ont le même compte pour leurs différents clubs. Le serveur tient compte des appartenances actives à chaque lecture et écriture. Un éducateur peut publier un document à son club. Ses paramètres et photos privés sont lisibles par lui seul. Les responsables voient les appartenances de leur club et les documents partagés, avec les mêmes limites que les autres membres sur les documents privés.

## Application éducateur

La migration [004-documents-educateurs.sql](004-documents-educateurs.sql), appliquée après la 001, raccorde la connexion des comptes préautorisés et le partage versionné des séances, bilans et compositions. Le serveur vérifie l’appartenance au club sélectionné. Un accès depuis un autre club est refusé et une modification sur une révision dépassée déclenche un conflit.

Pour préparer une copie de préproduction, utiliser `scripts/configure-club-deployment.py` avec une origine dédiée, la clé publiable de `nzmkeylibdcqmgqopesu` et le champ `supabase.club_id` égal à l’UUID du club. Renseigner `cruza_memberships.display_name` avec le nom d’affichage du compte préautorisé. Les clés de session et de brouillon sont propres au club lorsqu’un éducateur appartient à plusieurs clubs.

Il reste à raccorder les invitations, la synchronisation des données privées et l’espace Responsable, puis à tester ces parcours avant toute reprise de données et bascule du Stade Mayennais.

## Aperçu de test du nouveau projet

La [page de test](../../apercu-multi-clubs/index.html) cible uniquement le projet `nzmkeylibdcqmgqopesu`. C’est un banc d’essai de connexion, de sélection du club et de lecture et écriture de séances fictives. Le site de production utilise son propre projet. Ouvrir cette page via un serveur HTTP statique ou sur une préproduction dédiée.

Créer deux utilisateurs fictifs confirmés dans **Authentication → Users**, puis adapter et exécuter [002-jeu-essai.sql](002-jeu-essai.sql) dans le nouveau projet. Dans la page de test, saisir la clé **Publishable** du nouveau projet ainsi que le compte fictif. Les informations ne sont pas enregistrées par la page. Connecter le compte A, partager une séance fictive et fermer la session. Avec le compte B, vérifier que seul le club B apparaît et que la séance A est absente. Tester aussi dans le sens inverse. Les tests SQL locaux complètent cet essai avec des opérations de tentative d’accès direct.

Le script [003-verifier-isolation.sql](003-verifier-isolation.sql) permet aussi de vérifier les règles sur la vraie base via le SQL Editor. Il simule deux sessions Auth et annule toutes les données de test à la fin. Il ne vérifie pas la connexion de l’interface ou les opérations Storage.
