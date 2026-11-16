# Renommage du dépôt SMFC — préparé, non effectué

Nom demandé : `cruza-stade-mayennais`. Le dépôt actuel héberge le site SMFC, avec une démonstration CRUZA et le pilotage. Il ne représente pas encore trois dépôts commerciaux distincts.

## État
Le renommage API a été tenté puis refusé (`Forbidden`) avec l’accès disponible ici. Cette branche ne renomme pas le dépôt et ne déploie pas le site ; elle prépare ses liens.

## Opération administrateur
Dans le dépôt GitHub : Settings → General → Repository name → `cruza-stade-mayennais` → Rename. La cible doit être le même propriétaire `Mouchhh` ; il ne s’agit pas d’un transfert.

Après le renommage effectif, intégrer cette branche, vérifier Pages et ouvrir la nouvelle adresse : `https://mouchhh.github.io/cruza-stade-mayennais/`. Ne pas annoncer l’adresse disponible avant le déploiement. Les liens Git de l’ancien dépôt sont normalement redirigés par GitHub ; ne pas supposer que l’ancien lien du site Pages le sera.

## Ce qui est préparé
Les liens actifs d’assistance, d’issues, de pilotage, de démo et la référence Render sont mis au nouveau nom. L’extension accepte l’ancien et le nouveau chemin pendant la transition. Les archives et preuves historiques gardent leur nom d’origine.

## Vérifications après renommage
- Mettre à jour les remotes Git des postes et la connexion du dépôt dans les services qui ne suivent pas le renommage.
- Conserver le domaine `mouchhh.github.io`, la base Supabase, les comptes et toutes les clés de stockage : aucun effacement ni migration de données nécessaire pour ce changement de nom.
- Le manifest PWA utilise des chemins relatifs. L’application déjà installée peut pointer sur l’ancien chemin ; vérifier puis réinstaller le raccourci depuis la nouvelle adresse si nécessaire.
- Contrôler les URL Site/Redirect dans Supabase si elles contiennent l’ancien chemin, notamment pour les liens e-mail.
- La passerelle Canva utilise l’origine `https://mouchhh.github.io` et un retour calculé depuis l’adresse courante. Son callback OAuth serveur n’est pas modifié par le nom du dépôt. Tester un export réel après bascule.
- Tester connexion, document existant, causerie/bilan, export, démo et nouvelle installation PWA. Ne pas purger les données du navigateur.
