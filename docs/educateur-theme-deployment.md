# Thème éducateur validé — 16 novembre 2026

Le thème présenté dans l’aperçu navigable est appliqué aux interfaces éducateur du Stade Mayennais et de la démonstration CRUZA. Le Stade Mayennais conserve ses photos, son écusson et ses couleurs ; CRUZA conserve son logo et sa palette bleu, crème et rouge.

Changements : typographies Archivo/Unbounded, navigation latérale, en-tête, cartes, formulaires, bibliothèques et onglets. Les règles sont limitées à l’écran ; les styles d’impression restent inchangés. Aucun changement des données, comptes, autorisations, exports ou configurations Supabase/Canva.

Fichiers : `educateur-theme.css`, copie adaptée dans `cruza-demo/educateur-theme.css`, liens de chargement dans les deux interfaces et l’accueil SMFC. L’accueil public CRUZA, distinct de l’application, conserve sa mise en page.

Vérification : `tests/educateur-theme-browser.py` utilise `TEST_BASE_URL` et `ARTIFACT_DIR`. Contrôle sept vues sur cinq tailles d’écran, absence de débordement et d’erreur JavaScript, alignements de navigation et contenu, conservation des données lors du changement de style. Contrôle supplémentaire de l’éditeur tactique grand écran, du zoom et des animations sur les deux versions.
