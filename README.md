# STCK

Des planches de stickers à partager à deux, dans un décor de forêt cartoon en papier découpé.

[Ouvrir STCK](https://cgiy.github.io/stck/) · [Publication et exploitation](DEPLOYMENT.md)

## Utilisation

- Chacun entre son code personnel. Les deux comptes rejoignent le même espace ; aucune adresse e-mail n’est demandée.
- Les six planches principales se superposent ; deux petites planches spéciales Rouge-gorge et Monoprix restent séparées. Glisser leur bord ou leur titre, toucher une flèche, ou utiliser les onglets permet de changer de planche.
- La surface de collage est libre : les stickers se superposent et peuvent dépasser du cadre. Un repère A/B indique qui a posé chaque exemplaire. Ce repère reste identique quand l’autre personne le déplace.
- Chaque personne conserve au maximum deux exemplaires d’un même sticker. Chaque exemplaire peut être collé séparément ; le compteur indique ceux qui restent sur la planche. Ramener son sticker sur les planches le range à nouveau.
- Une pochette donne un sticker rare avec une probabilité de **10 %**, répartie entre les treize rares. Les 42 stickers courants se partagent les 90 % restants. Les éditions spéciales représentent 20 % des tirages ; la rareté reste indépendante à 10 %. Un troisième exemplaire se désintègre et rapporte un jeton commun, une seule fois. Il ne remplace aucun sticker conservé et ne relance pas le tirage.
- La pochette bonus coûte 3 jetons communs. Chaque défi réalisé consomme un exemplaire et rapporte 1 jeton. Chaque personne peut réclamer un sticker gratuit par jour.
- Les découvertes sont privées. Seuls les stickers effectivement collés sont partagés.
- Rappel quotidien à l’heure choisie et notifications de nouveautés, facultatifs par appareil. Sur iPhone : ajouter STCK à l’écran d’accueil depuis Safari, l’ouvrir, puis activer les notifications dans « Mon espace ».

## Développement

Node.js 24 est utilisé pour les vérifications.

```sh
npm ci
npm test
npm run check:edge
npm run build
node scripts/check-assets.mjs
npm run preview
```

L’aperçu est accessible à `http://127.0.0.1:4173`. Le bouton « Explorer l’aperçu » conserve un collage de démonstration sur l’appareil, séparé des deux comptes réels. Les tirages de démonstration ne modifient pas leur collection.

`config.public.json` contient uniquement l’URL du projet et sa clé publique. Les variables `STCK_SUPABASE_URL` / `STCK_SUPABASE_KEY` et le fichier ignoré `config.local.json` permettent une surcharge. Une clé serveur est refusée à la compilation.

## Organisation

- `web/` : interface, animations, images WebP, installation et notifications.
- `src/` : comptes, stocks, sauvegarde et préférences.
- `supabase/migrations/` : schéma et accès aux données.
- `supabase/functions/push-dispatch/` : envoi Web Push.
- `tests/` : isolation des comptes, tirages, exemplaires et notifications.
- `.github/workflows/` : contrôles et publication GitHub Pages après réussite des tests.

Le prototype d’origine reste séparé. Les codes personnels et secrets sont dans un dossier local `.private/`, exclu du dépôt et du site.

## Vérifications et limites

Les tests couvrent l’isolation, les invitations internes, les reprises de tirage, les préférences, la file d’envoi, le changement d’heure, les dépassements du cadre, l’auteur du collage, le seuil historique de 1 % et le taux actuel de 10 %, le plafond actuel de deux exemplaires et le refus des exemplaires forgés. Les deux codes ont été vérifiés contre Supabase. Le service de notifications et sa programmation ont répondu correctement.

La réception réelle d’une notification doit encore être vérifiée sur les téléphones, une fois leurs notifications autorisées. Le collage se synchronise toutes les 15 secondes quand la page est visible ; une modification en attente reprend après une coupure de réseau. En cas de déplacement simultané du même exemplaire, la dernière écriture reçue l’emporte. L’application affiche une page dédiée hors connexion ; elle ne met pas la collection privée en cache dans le service worker.

## Catalogue et planches complétées

Le catalogue comprend 55 stickers actifs, 42 communs et 13 rares foils, répartis entre Amour, Douceurs, Saveurs, Plaisirs, Intimité, Porn & love et les planches spéciales Rouge-gorge et Monoprix. `src/catalog.json` et `src/collections.json` pilotent le catalogue et sa génération HTML. `scripts/sync-catalogue.mjs` synchronise les deux pages à chaque compilation. Les illustrations ajoutées et leurs briefs sont documentés dans `art-direction/sticker-prompts.json`.

Une première découverte de chaque sticker actif de la planche débloque un emblème animé et une finition de papier spéciale, conservés après consommation des exemplaires. La récompense est privée et permanente, sans attribution de jetons. Le stock reste distinct de cet historique. Les anciens 3-03, 4-06 et 4-08 sont conservés pour ses exemplaires et archives, en dehors des nouveaux tirages.

Les six planches principales gardent la même taille pendant le défilement ; le format commun peut accueillir la planche Saveurs à 13 emplacements. Les éditions spéciales sont plus petites.
