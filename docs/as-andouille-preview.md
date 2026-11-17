# Aperçu AS Andouillé

URL : https://mouchhh.github.io/cruza-stade-mayennais/apercu-as-andouille/index.html?mode=local

Aperçu visuel navigable du produit, avec le logo fourni par l’utilisateur et une palette rouge, noir et blanc. Le fichier AVIF a uniquement été converti en PNG transparent pour son affichage. Les pages reprennent les interfaces éducateur existantes ; aucune installation de club n’est provisionnée.

Seize joueurs fictifs, trois séances, une causerie et un bilan d’exemple ; le petit classement est explicitement fictif et ne provient pas de Sportcorico. Pas de photos ni de données des éducateurs du SMFC. Les appels Supabase, Canva, WhatsApp et classement sont désactivés dans cette copie. Le manifeste et l’enregistrement PWA ne sont pas chargés. Le stockage local est préfixé `cruza-as-andouille-demo-v1:` et la bibliothèque IndexedDB possède son propre nom ; le bouton de réinitialisation ne touche que cet aperçu. Cette séparation logique sur la même origine n’est pas une séparation de sécurité entre domaines.

Le site principal et la démonstration CRUZA ne sont pas modifiés. Les assets et styles publics communs sont réutilisés depuis leur chemin parent ; les règles de thème sont appliquées uniquement dans le document de l’aperçu. Les informations du logo ne sont pas des instructions à exécuter.

Vérification : `tests/as-andouille-preview-browser.py`, sept écrans, formats 1440, 390 et 320 pixels ; nom et logo, données fictives, services désactivés, aucun débordement horizontal ni erreur JavaScript, conservation des essais et des données sentinelles du site principal.
