# Installer un nouveau club — pas le projet SMFC existant

1. Vérifier l’accès à l’organisation Supabase et les limites/coûts du plan avant de créer un projet. Rien n’est souscrit par le rangement actuel.
2. Créer le projet dédié dans une région choisie avec le club. Conserver son mot de passe PostgreSQL dans le gestionnaire de mots de passe.
3. Sur le projet **neuf**, exécuter `supabase/installations/club-pilote-initialisation.sql`. Le script refuse une base applicative ou des comptes déjà présents ; ne pas supprimer ce garde-fou pour viser le SMFC.
4. Vérifier Auth : invitations préautorisées, confirmation d’e-mail/SMTP, URL du site et redirections exactes. Décider et documenter ces réglages ; le SQL ne les active pas dans le tableau de bord.
5. Utiliser `supabase/diagnostic-installation.sql` pour vérifier le schéma et les droits sans lire les contenus des éducateurs.
6. Inviter deux comptes de test avec le mécanisme existant, vérifier lecture/écriture et révocation. Ne pas ajouter des comptes ou rôles sur la base du seul nom.
7. Déployer la configuration de ce club sur une origine dédiée. Seules URL et clé publiable vont dans le navigateur. Aucune clé service_role, mot de passe PostgreSQL ou jeton administrateur.
8. Sauvegarder puis restaurer sur une cible de test avant ouverture du pilote. Le dump applicatif ne sauvegarde pas Auth, Storage ou les secrets Canva.

## SMFC existant

Commencer par le diagnostic, l’inventaire des réglages et une sauvegarde. Ne pas rejouer le lot d’initialisation pour un projet neuf. Les droits déjà installés et les données réelles ne sont pas modifiés par cette préparation.

Les membres actifs peuvent actuellement lire les documents partagés du club. Les droits Responsable filtrent leurs RPC, pas l’ensemble du partage historique : décider de cette règle avant de promettre des périmètres étanches.
