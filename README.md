# STCK

Des planches de stickers à partager à deux, dans un décor de forêt cartoon en papier découpé.

[Ouvrir STCK](https://cgiy.github.io/stck/) · [Publication et exploitation](DEPLOYMENT.md)

## Utilisation

- Chacun entre son code personnel. Les deux comptes rejoignent le même espace ; aucune adresse e-mail n’est demandée.
- Les quatre planches se superposent. Glisser leur bord ou leur titre, toucher une flèche, ou utiliser les onglets permet de changer de planche.
- La surface de collage est libre : les stickers se superposent et peuvent dépasser du cadre. Un repère A/B indique qui a posé chaque exemplaire. Ce repère reste identique quand l’autre personne le déplace.
- Chaque personne conserve au maximum trois exemplaires d’un même sticker. Chaque exemplaire peut être collé séparément ; le compteur indique ceux qui restent sur la planche. Ramener son sticker sur les planches le range à nouveau.
- Une pochette donne un sticker rare avec une probabilité de **1 %**, répartie entre les huit rares. Les 24 stickers courants se partagent les 99 % restants. Un quatrième exemplaire apparaît puis disparaît avec une explication ; il ne remplace aucun sticker conservé et ne relance pas le tirage.
- Le libellé « Acheter une pochette » ouvre la pochette animée. Aucun paiement ni système de monnaie n’est intégré à cette version.
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

Les tests couvrent l’isolation, les invitations internes, les reprises de tirage, les préférences, la file d’envoi, le changement d’heure, les dépassements du cadre, l’auteur du collage, le seuil de 1 %, les trois exemplaires et le refus des exemplaires forgés. Les deux codes ont été vérifiés contre Supabase. Le service de notifications et sa programmation ont répondu correctement.

La réception réelle d’une notification doit encore être vérifiée sur les téléphones, une fois leurs notifications autorisées. Le collage se synchronise toutes les 15 secondes quand la page est visible ; une modification en attente reprend après une coupure de réseau. En cas de déplacement simultané du même exemplaire, la dernière écriture reçue l’emporte. L’application affiche une page dédiée hors connexion ; elle ne met pas la collection privée en cache dans le service worker.
