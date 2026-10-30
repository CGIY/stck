# STCK

Une bibliothèque de stickers à partager à deux : quatre grimoires, une table de collage et une pochette animée.

Le projet est indépendant des autres applications. Le prototype d’origine et ses archives ne font pas partie de ce dépôt.

## État de la publication

Le code, les images optimisées, la base Supabase, le service de notifications et les workflows GitHub sont préparés. La base distante et les notifications ne sont pas encore activées : la connexion Supabase doit autoriser la nouvelle organisation **STCK**. L’hébergement public reste aussi à choisir : GitHub Pages n’est pas disponible pour ce dépôt privé avec l’offre actuelle.

## Fonctionnement

- Connexion par lien envoyé par e-mail.
- Espace à deux, avec invitation à usage unique valable 48 heures.
- Collage sauvegardé par sticker ; synchronisation toutes les 15 secondes lorsque la page est visible. Une modification en attente est conservée sur l’appareil et retentée après une coupure de réseau.
- Tirage des pochettes enregistré côté serveur. Une requête répétée conserve le même sticker. Le catalogue reste consultable en entier ; les stickers découverts sont signalés.
- Notifications facultatives sur chaque appareil : rappel quotidien à l’heure choisie et annonces de nouveautés. Les messages ne contiennent pas les détails des stickers.
- Application installable sur téléphone. Sur iPhone, ouvrir le site dans Safari, l’ajouter à l’écran d’accueil puis activer les notifications dans « Mon espace ».

## Aperçu local

Node.js 24 est utilisé pour les vérifications.

```sh
npm ci
npm test
npm run check:edge
node scripts/build.mjs --preview
npm run preview
```

L’aperçu est accessible à `http://127.0.0.1:4173`. Sans configuration Supabase, le collage reste local et les pochettes sont des démonstrations explicitement signalées.

## Publication

Voir [DEPLOYMENT.md](DEPLOYMENT.md). La compilation de production refuse une configuration Supabase absente ou une clé serveur. Le navigateur reçoit uniquement l’URL de l’API et sa clé publique.

```sh
npm run build
node scripts/check-assets.mjs
```

Le dossier `dist/` est un site statique compatible avec un hébergement HTTPS. Les chemins sont relatifs, y compris le service worker, pour fonctionner dans un sous-dossier comme `/stck/`.

## Organisation du code

- `web/` : interface, animations, images WebP, manifeste et service worker.
- `src/` : connexion, sauvegarde, invitations et préférences de notification.
- `supabase/migrations/` : structure, droits d’accès et fonctions de la base.
- `supabase/functions/push-dispatch/` : envoi Web Push avec contrôle des destinations.
- `tests/` : tests Postgres avec PGlite et tests de validation des notifications.
- `.github/workflows/` : contrôles automatiques et publication manuelle GitHub Pages.

## Vérification et limites

Les tests couvrent l’isolation entre comptes, les invitations, l’idempotence des tirages, les préférences, la file d’envoi et les rappels autour de minuit et du changement d’heure. La fonction Web Push est également vérifiée par Deno. L’interface, le rechargement du collage et les ressources sont vérifiés localement.

La réception réelle d’une notification sur iPhone, l’authentification par e-mail et l’isolation sur le projet Supabase distant doivent être vérifiées après déploiement. Les notifications sont envoyées avec reprise sur erreur ; un crash après un envoi peut entraîner une répétition, regroupée par le même identifiant de notification. La synchronisation simultanée du même sticker suit la dernière écriture reçue par le serveur. La navigation hors connexion affiche une page de reprise, sans mettre en cache les données de compte.
