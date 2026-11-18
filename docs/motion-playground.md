# CRUZA · aperçu interactif des animations

URL : https://mouchhh.github.io/Cruza/apercu-motion/

## Intention

Étude des mouvements de l’interface montrés dans la vidéo fournie : masque d’ouverture, disparition du flou, surfaces translucides, transitions entre rubriques, graphes et compteurs, bulles de conversation et changement global de palette. Le prototype reprend ces principes sur une interface illustrative CRUZA, sans modifier le site actuel. La vidéo de référence n’est pas publiée.

## Ce qui est interactif

- Neuf rubriques : vue d’ensemble, match, séances, agenda, effectif, bilans, ressources, messagerie, club.
- Ouverture circulaire progressive, flou / mise au point, translation et échelle.
- Sortie / entrée des pages avec profondeur légère ; apparitions en cascade.
- Indicateur actif qui suit l’onglet, y compris en navigation horizontale sur téléphone.
- Compteurs interpolés, anneau tracé, barres de progression, apparition du graphe.
- Morphing de la courbe entre 7 jours, 30 jours et saison ; survol et infobulle.
- Déplacement des joueurs entre les systèmes 4-3-3 et 4-4-2.
- Filtres et ajout / retrait de situations, pointage de plusieurs joueurs, boutons qui répondent à l’action.
- Conversations en mémoire, insertion des bulles, indicateur de saisie et réponse prédéfinie.
- Quatre palettes avec transition commune des variables de couleur ; contrôle du verre dépoli.
- Visite automatique interrompue lors d’une navigation manuelle et lorsque la page passe en arrière-plan.

## Portée

Prototype autonome. Données fictives, aucune connexion Supabase, aucun envoi de message réel, aucun appel API, aucune bibliothèque tierce, aucun service worker, aucune lecture / écriture des documents existants ou du stockage de production. Les essais sont conservés en mémoire jusqu’au rechargement uniquement.

La messagerie n’est ni un service temps réel ni un assistant IA. Le graphique n’est pas relié aux statistiques des éducateurs. Les effets sont volontairement démonstratifs et pourront être raccourcis pour un usage quotidien.

## Accessibilité et comportement

- Respect de `prefers-reduced-motion`, avec interruption des animations en cours et affichage direct de l’état final.
- Contrôle manuel « Animations », sans perdre l’accès aux rubriques et actions.
- Navigation clavier, indicateur de focus, commandes nommées, dialogues natifs, annonce des nouveaux messages.
- Pas de capture du défilement ; inclinaison de carte légère à la souris seulement, désactivée sur téléphone et avec mouvement réduit.
- Le prototype nécessite un navigateur moderne prenant en charge Web Animations et `color-mix`. Aucune compatibilité tous navigateurs n’est présumée sans tests correspondants.

## Vérification

Serveur statique à la racine : `python3 -m http.server 3187`.

Puis : `python3 tests/motion-playground-browser.py`.

Le test couvre les neuf rubriques sur quatre largeurs, le changement rapide d’onglet, les animations effectives, le morphing de courbe, les systèmes, les palettes, la messagerie, les sélections, le clavier et le mouvement réduit. Les vérifications portent sur Chromium, avec et sans mouvement réduit, pas sur des appareils physiques.
