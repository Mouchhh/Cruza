# Profil et photos privés entre appareils

## Activation pour tous les éducateurs du club

1. Dans le SQL Editor du projet Supabase du club, exécuter une fois `supabase/coach-private-sync.sql`. Le script est réexécutable et ne modifie pas les tables de documents partagés.
2. Sur l’appareil où se trouvent déjà les informations et photos, se connecter au compte du club et ouvrir **Mon compte et paramètres**. Le bloc **Synchroniser mon profil et mes photos** indique le résultat. Laisser la première synchronisation se terminer avant de fermer la page.
3. Sur un autre appareil, se connecter au même compte. Les informations et photos sont récupérées en arrière-plan. Un profil local différent n’est pas écrasé : le bouton **Voir les différences** permet de choisir.

Le SQL s’applique à tous les membres actifs actuels et futurs. Aucun mot de passe, clé administrateur ou configuration Render supplémentaire. Les profils en mode local sans compte restent locaux. La démonstration neutre et l’aperçu ne se connectent pas au stockage privé de production.

## Périmètre

- Informations du profil éducateur, y compris sa photo.
- Fiche club personnelle (nom, identité visuelle, logo, coordonnées), déjà commune aux équipes de ce profil.
- Bibliothèque de photos proposées pour les causeries : images, noms et suppressions.
- Les préférences de notification et les brouillons ouverts restent propres à l’appareil. Les documents partagés gardent leur mécanisme existant. Cette modification ne synchronise pas encore le manifeste des équipes.

## Protection et conservation

Nouvelle table `coach_private_records`, séparée de `club_documents`. Lecture RLS limitée à `auth.uid()` et aux membres actifs ; les responsables n’ont aucun accès supplémentaire. Écriture uniquement par RPC, avec vérification explicite du propriétaire attendu, version comparée et verrou de transaction par compte. Accès anonyme et écritures directes refusés.

La copie locale reste disponible si le réseau manque, si le quota est atteint ou si le SQL n’est pas installé. Les photos existantes ne sont ni supprimées ni réattribuées à un autre compte. Aucun import automatique des anciennes photos anonymes d’un navigateur partagé : seuls les éléments du profil authentifié courant sont envoyés.

Chaque photo est un enregistrement versionné distinct, plafonné à 2 Mo de JSON, 30 photos actives par compte. Les JPEG sont déjà redimensionnés à 1600 pixels par la bibliothèque existante. Cette première synchronisation utilise la base Supabase (images JPEG encodées), donc son volume consomme le quota de base de données, pas Supabase Storage. Une bibliothèque volumineuse devra évoluer vers un bucket privé avant un déploiement commercial important. Une photo trop lourde reste locale et la synchronisation n’annonce pas de faux succès.

Les suppressions sont des tombstones : un autre appareil ne ressuscite pas une ancienne photo sans demande explicite. Les divergences sont conservées et signalées. Avant de récupérer la version du compte lors d’un conflit, une sauvegarde de la donnée locale est conservée dans IndexedDB `cruza-private-sync-backups`, identifiée par propriétaire. Les données du compte ne doivent être réinitialisées qu’après sauvegarde ; ces copies de sécurité ne sont pas ajoutées à la bibliothèque de compositions.

## Vérifications réalisées

- SQL sur PostgreSQL embarqué (PGlite) : installation réexécutable, deux comptes isolés, refus d’écriture directe, verrou de version, quota de 30 photos, suppression, membre inactif et anonyme refusés.
- Navigateur, deux espaces de stockage séparés : profil, fiche club et photo récupérés ; compte B sans accès aux données de A ; modification hors connexion conservée ; modifications concurrentes détectées sans écrasement ; résolution et suppression propagées.
- Aucun compte réel ni donnée de production utilisé pour ces tests. Le déploiement du SQL dans Supabase doit encore être effectué par un administrateur du club.

Tests : `node tests/coach-private-sql.mjs` (module PGlite dans `PGLITE_MODULE` si autre chemin), `python3 tests/coach-private-sync-browser.py` avec le site servi sur le port 3113.
