# Aperçu CRUZA — évolution du parcours éducateur

URL publiée : https://mouchhh.github.io/Cruza/apercu-cruza-evolution/

## Périmètre

Prototype autonome et navigable, conservant l’identité du Stade Mayennais. Les pages et scripts du site actuel ne sont pas modifiés. Données fictives, indépendantes des comptes des éducateurs.

## Parcours à tester

1. Accueil → Préparer ma causerie : adversaire, équipe et date déjà affichés.
2. Saisir le contexte et les intentions, puis changer de match et revenir : chaque rencontre retrouve ses textes.
3. Simuler l’après-match : le bilan reprend la rencontre et ses intentions. Enregistrer les observations puis ouvrir les séances.
4. Séances : filtrer les 6 exemples, ajouter des situations, consulter et exporter la séance.
5. Effectif : pointer plusieurs joueurs sur les deux dates, recharger pour vérifier la reprise.
6. Changer d’équipe : les préparations et les présences sont séparées.
7. Responsable : explorer les statistiques fictives, les détails par catégorie et la simulation de rôle.
8. Mon club : parcourir les 3 étapes de configuration d’un club pilote.
9. Mon compte : modifier le profil, ajouter une photo redimensionnée, exporter les essais.
10. Cliquer sur le statut de sauvegarde : comprendre les états et simuler le hors-ligne.

## Fonctions réellement présentes dans le prototype

- Navigation par URL `#`, responsive, clavier, focus visible, fenêtres modales, mouvement réduit.
- Saisie et conservation locale des préparations / bilans par rencontre et par équipe.
- Pointage des présences par joueur et par jour.
- Sélection de situations, filtres, recherche et export JSON.
- Profil et photos JPEG/PNG/WebP redimensionnées à 800 px maximum ; 5 Mo en entrée, 6 photos de démonstration maximum.
- Configuration locale de club en 3 étapes ; aucune invitation envoyée.
- Gestion du refus ou du quota de stockage : message et export de la copie en mémoire.
- Synthèse des améliorations accessible dans la navigation et le bandeau.

## Limites explicites

- Pas de connexion Supabase, Canva, Sportcorico ou compte réel. Pas de service worker.
- Pas de synchronisation multi-appareil : « Sur cet appareil » désigne uniquement une sauvegarde locale. Le statut serveur reste à développer et tester.
- Le changement de rôle illustre l’interface, pas la sécurité. Les règles RLS et les contrôles d’autorisation doivent être testés sur le produit réel.
- Aucun dispositif de sauvegarde serveur, restauration, conformité RGPD ou isolation multi-club n’est démontré par cette maquette.
- Six exercices fictifs et des statistiques illustratives : le catalogue réel n’est pas remplacé.
- Diapositives : aperçu des textes enregistrés, sans génération Canva/PPTX.
- Dates de scénario fixées au 17 novembre 2026 pour conserver un parcours reproductible.

## Isolation

Les clés `localStorage` utilisent exclusivement le préfixe `cruza-evolution-preview-v1`. Les données du site principal ne sont ni lues ni modifiées. Les photos restent dans ce stockage de démonstration. Aucun outil d’analyse ou script tiers n’est chargé. Les ressources partagées en lecture sont les polices, les photos publiques du club et l’écusson déjà présents dans `assets/`.

## Validation

`python3 -m http.server 3187` depuis la racine, puis :

```sh
python3 tests/cruza-evolution-preview-browser.py
```

Le test vérifie les parcours, l’isolation des équipes / matchs, les exports, la reprise après rechargement, les 10 pages à 1440 / 1024 / 390 / 320 px, l’absence de débordement global, d’erreur JavaScript, de ressource HTTP en échec et d’appel à un service externe.
