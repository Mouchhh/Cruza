# Classement Sportcorico U17

Source publique fournie : https://www.sportcorico.com/clubs/st-mayennais-fc/mayenne-stade-fc-17. Le tableau est celui de St. Mayennais FC U17 2, U17 Division 1, saison transmise par Sportcorico. Il remplace le widget Dynamique du groupe pour la catégorie U17 ; aucune donnée FFF n’est utilisée pour ce classement. Les autres catégories et la démonstration neutre ne reçoivent pas ce tableau U17.

`scripts/update-sportcorico.py` lit exclusivement cette page publique, extrait ses données Nuxt sans exécuter de JavaScript tiers, valide l’équipe et l’unique championnat puis remplace atomiquement `data/sportcorico-u17.json`. Une erreur laisse le dernier fichier intact. Aucun calcul de classement depuis les bilans du club, aucune collecte de contacts et les logos publics du classement sont chargés uniquement depuis Sportcorico ou son stockage Infomaniak, sans référent.

`.github/workflows/sportcorico.yml` exécute cette récupération toutes les heures à la minute 37 UTC et peut être lancé manuellement. Il enregistre uniquement le fichier public du tableau puis déploie GitHub Pages. Les planifications GitHub peuvent être retardées et les workflows planifiés des dépôts publics peuvent être désactivés après une longue période d’inactivité. Sur ce dépôt public, les runners standard GitHub Actions n’ajoutent pas de service d’hébergement payant. Le workflow nécessite les permissions standard contents:write, pages:write et id-token:write.

L’interface relit le fichier toutes les cinq minutes pendant l’affichage de l’accueil et au retour dans la fenêtre, sans écrire dans le stockage local. La récupération amont reste horaire : ce n’est pas du temps réel seconde par seconde. La date et l’heure sont toujours affichées en heure de Paris ; un avertissement indique si les données datent de plus de deux heures. En cas d’erreur, le tableau déjà reçu reste affiché, accompagné de son état. Le lien Sportcorico permet de consulter directement la source.

Validation : extraction sur la page réellement reçue le 17 novembre 2026 ; dix lignes, bonne équipe et saison ; rejet d’une mauvaise équipe et d’une page de maintenance ; contrôles navigateur 1440, 390 et 320 pixels, intégrité des dix lignes, surbrillance du club, données invalides refusées et conservation du dernier tableau si la récupération échoue. Aucun changement Supabase requis.

## Configuration autonome par équipe

Le bouton **Configurer le classement** du widget ouvre **Configurer mon équipe**. Le champ facultatif **Lien Sportcorico de cette équipe** accepte une page HTTPS `/clubs/club/equipe` de Sportcorico et retire les paramètres de suivi. Il existe aussi à la création d’une équipe. Lien vide : classement désactivé pour cette équipe. Les liens sont enregistrés dans le manifeste des équipes du profil de ce navigateur, comme les autres réglages d’équipe ; cette modification n’ajoute pas de synchronisation des réglages entre appareils.

L’équipe active choisit sa propre source. Les réponses dont la source ou le slug ne correspond pas sont refusées ; un autre classement ne sert jamais de remplacement. Le tableau U17 historique conserve sa récupération horaire existante. Pour les autres sources, l’interface appelle le lecteur public `/api/sportcorico` du service Render existant, cache serveur quinze minutes et nouvelle lecture toutes les cinq minutes sur l’accueil. Les classements sont publics et aucune session Canva ou clé Supabase n’est envoyée par ce lecteur. La configuration publique `ranking-config.js` est distincte de Canva, y compris dans la version neutre.

### Activation du lecteur sur Render

Déployer le commit contenant `canva-gateway/sportcorico.mjs`, la route dans `server.mjs` et le Dockerfile mis à jour sur le service **CANVA EDUCATEUR SMFC**. Aucun nouveau service, variable secrète ou migration Supabase. Le domaine du site doit déjà figurer dans `ALLOWED_ORIGINS` (même origine que Canva). Tant que l’ancien serveur tourne, la configuration du lien et l’accès à Sportcorico fonctionnent, mais les nouveaux tableaux ne peuvent pas se charger automatiquement. Au contrôle initial, l’ancienne route répondait 401 : le lecteur n’y était donc pas encore déployé.

Tests : changement d’équipe U17/U15 par le formulaire réel, stockage séparé, paramètres de suivi supprimés, persistance après rechargement, retour au classement U17 ; dix tests serveur, incluant les imports Canva existants, restrictions d’URL, liaison au slug exact, cache et refus des origines non autorisées.

## Logos et forme des clubs

Chaque ligne inclut le logo public fourni par Sportcorico et jusqu’à cinq résultats de `shape_of_the_moment`, dans l’ordre de la source. V = victoire (vert), N = nul (doré), D = défaite (rouge). Une valeur inconnue reste neutre ; des résultats absents ne sont jamais inventés. Les trois premiers rangs ont un accent doré et l’équipe choisie conserve sa surbrillance bleue.

Les champs logo et forme sont optionnels pour rester compatibles avec l’ancien lecteur Render ; ils s’affichent lorsqu’ils sont fournis. Pour les équipes autres que la source U17 prédéfinie, redéployer le lecteur Render pour enrichir les réponses. Le classement U17 publié est déjà enrichi par la récupération horaire. Un logo indisponible laisse apparaître les initiales du club, y compris dans la fenêtre mobile. Les images utilisent `referrerpolicy=no-referrer` et une liste fermée de domaines HTTPS.
