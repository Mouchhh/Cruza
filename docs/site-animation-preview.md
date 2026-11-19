# Aperçu assemblé : accueil et semaine validés, outils actuels animés

Lien : https://mouchhh.github.io/Cruza/apercu-site-anime/index.html?mode=local

## Périmètre

Copie des pages, feuilles de style, scripts métier, ressources publiques et données publiques du site au commit `31b7756`. Le manifeste SHA-256 `site-animation-preview-source.json` enregistre les fichiers de référence. La vidéo de référence et les autres aperçus ne sont pas utilisés pour reconstruire ou redessiner l’interface.

Les formulaires, bibliothèques, menus et outils des autres onglets restent ceux du site. À la demande de l’utilisateur, deux présentations sont désormais remplacées dans cet aperçu : l’accueil et la vue d’ensemble de l’agenda. Leur direction visuelle reprend l’aperçu « évolution » précédemment validé. Le vrai site n’est pas modifié.

## Deux pages reprises de l’aperçu précédent

- **Accueil** : grand visuel du club, action de préparation / reprise, fil agenda–causerie–bilan, prochains rendez-vous, indicateurs et retour vers les séances. Le classement reste accessible dans une fenêtre utilisant son lecteur existant.
- **Agenda** : semaine sur sept jours, navigation entre semaines, choix de date et filtres par type. Un clic ouvre le rendez-vous dans son outil habituel. L’onglet Agenda ouvre cette vue semaine par défaut ; le calendrier complet d’origine reste accessible.
- Les données sont lues dans `agendaCalendarAllEvents`, `homeWidgetsSnapshot`, les bibliothèques et les contrôleurs existants. Aucun événement, joueur ou pourcentage de l’ancien scénario fictif n’est injecté.
- Les liens de préparation et de bilan passent par `agendaEventCauserie` et `agendaEventReport`. La création d’une séance passe par `agendaCalendarPrepare` ; les règles d’archivage et de remplacement des brouillons restent celles du produit.
- Le code des deux pages est isolé dans `preview-selected-pages.js` et sa feuille de style. Les éléments de présentation d’origine restent dans le DOM, masqués uniquement dans ces deux vues.
- Pour comparer avec la copie fidèle à animations seules : ajouter `&layout=original` à l’URL. Ce mode est aussi utilisé par le test d’intégrité existant.

## Animations ajoutées

- Transition de sortie et d’entrée sur le contenu de l’onglet avec View Transitions quand cette API est disponible ; l’en-tête et la navigation gardent leur place.
- Apparition des éléments visibles en cascade ; animation d’entrée de secours avec Web Animations.
- Sous-onglets et étapes existants animés, sans réécrire leurs gestionnaires métier.
- Réaction discrète au clic des boutons.
- Annulation de la transition précédente lors d’une navigation rapide.
- Contrôle flottant pour rejouer, couper les animations et ouvrir le vrai site.
- Respect du mouvement réduit du système et des préférences existantes du profil.

Les animations modifient temporairement l’opacité, le flou et les transformations, jamais la structure ou les valeurs des champs. Les compteurs ne sont pas remplacés et aucune statistique fictive n’est injectée dans les pages existantes.

## Adaptations indispensables à l’aperçu

- Stockages local/session et IndexedDB préfixés `cruza-original-motion-v1:` ; canaux BroadcastChannel également séparés.
- Profil de présentation Enzo Mouchet et identité publique Stade Mayennais initialisés dans cet espace isolé. Ni session ni document privé du vrai site n’est lu.
- Configuration Supabase, Canva, WhatsApp et relais du classement désactivée. Le classement peut lire sa copie du fichier JSON public.
- Requêtes de données limitées aux lectures dans le dossier de l’aperçu. Aucun appel d’écriture à une API n’est autorisé.
- Pas de nouveau service worker. Les adaptations du HTML se limitent au chargement de l’isolation, de la couche d’animation et à l’absence de manifeste PWA.
- Le Club garde ses contrôles d’accès existants : il peut demander une connexion, qui n’est pas active ici. Responsable utilise son mode de démonstration existant.
- Si le stockage est plein, les essais du prototype peuvent rester en mémoire ; ils sont alors perdus à la fermeture. Aucun nettoyage du stockage du vrai site n’est exécuté.

La présence de ces adaptations ne constitue ni une modification de production, ni une validation de la sécurité du projet Supabase.

## Vérification

```sh
python3 -m http.server 3190
python3 tests/original-site-motion-browser.py
```

Le test vérifie la fidélité des sources, l’état final des pages, les changements de vue et de sous-onglets, l’animation effective, la conservation des positions lorsque les animations sont coupées, le mouvement réduit, l’isolation du stockage et l’absence d’appels de données externes. Les vérifications navigateur utilisent Chromium ; elles ne remplacent pas des essais sur appareils physiques.

Pour les deux pages assemblées : `python3 tests/selected-home-agenda-browser.py`. Ce test couvre les liens aux outils existants, le contexte du match, les semaines et filtres, l’accès au calendrier d’origine, le classement et les deux vues à quatre largeurs.
