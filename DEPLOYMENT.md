# Publication de STCK

## Destination

- Dépôt privé : https://github.com/CGIY/stck
- Organisation Supabase créée : STCK (`pkslvjmqlfyvpaadrogq`).
- Région prévue : Paris (`eu-west-3`).

La connexion Supabase actuellement disponible ne permet pas d’accéder à cette organisation. La reconnecter en sélectionnant STCK avant toute opération distante. Aucun autre projet n’a besoin d’être modifié.

## 1. Base Supabase

Créer un projet STCK dans cette organisation, puis contrôler qu’il est sain et qu’il ne contient aucune table métier existante. Appliquer `supabase/migrations/20261030100716_stck_core.sql` une seule fois. Exécuter les conseillers de sécurité et vérifier les tables, les règles RLS et les fonctions avec des utilisateurs de test distincts.

Les tables exposées ont toutes RLS activé. Les rôles publics n’ont pas de droit de mutation sur les espaces ou les tirages. Les opérations privilégiées des utilisateurs vérifient leur identité dans le schéma privé. Les opérations d’envoi sont réservées au rôle serveur.

## 2. Connexion

Configurer l’adresse finale HTTPS dans **Authentication → URL Configuration**, comme Site URL et URL de redirection autorisée (`https://…/index.html`). Le client utilise le lien de connexion e-mail standard. Configurer un fournisseur SMTP pour un usage réel : le service e-mail par défaut de Supabase est limité et ne convient pas à une ouverture générale. Ne pas désactiver la validation des adresses pour contourner cette étape.

## 3. Notifications

```sh
node scripts/generate-push-config.mjs PROJECT_REF
```

Cette commande écrit `.private/push-config.sql` avec des droits locaux restreints. Elle génère les clés Web Push et un secret distinct pour le déclenchement du service. Ne jamais ajouter ce fichier au dépôt, le placer dans `dist/`, ou afficher son contenu dans des journaux publics.

Exécuter ce fichier dans la base via un canal administrateur autorisé. Il crée uniquement la configuration du projet STCK et refuse de remplacer des clés existantes. Les clés sont stockées dans `stck_private.push_config`, sans accès utilisateur.

Déployer la fonction `push-dispatch` avec ses fichiers TypeScript, JavaScript, `deno.json` et `deno.lock` et la vérification JWT de la passerelle désactivée : **la fonction vérifie elle-même le secret Bearer dédié**. Ne pas utiliser une clé utilisateur ou publique à la place du secret. Appliquer ensuite `supabase/schedule.sql` pour appeler la fonction chaque minute.

Contrôler l’historique Cron et les réponses `net._http_response`, puis inscrire un appareil depuis l’application. Ne pas insérer de fausse destination de notification. Vérifier un rappel, le désabonnement de l’appareil et la suppression d’un abonnement expiré. Les notifications restent désactivées par défaut.

Les annonces se publient côté administrateur dans `public.announcements` (`title`, `body`, `published_at`). Elles sont distribuées aux utilisateurs ayant activé les nouveautés pendant les 24 heures suivant leur publication. Garder le texte adapté à un écran verrouillé.

## 4. Site

Renseigner les variables de compilation :

```text
STCK_SUPABASE_URL=https://PROJECT_REF.supabase.co
STCK_SUPABASE_KEY=clé publique publishable
```

En local, `config.local.json` peut contenir les champs `supabaseUrl` et `supabaseKey` et reste ignoré par Git. Une clé `service_role` ou `sb_secret_…` ne doit jamais être utilisée pour compiler le site.

Pour GitHub Pages, renseigner les deux variables dans les variables Actions du dépôt, activer Pages avec GitHub Actions, puis lancer manuellement « Publier STCK ». Un dépôt privé requiert une offre GitHub compatible avec Pages ; si elle ne l’est pas, conserver le dépôt privé et choisir un hébergeur HTTPS compatible plutôt que rendre le dépôt public implicitement. Le dossier `dist/` est portable.

Le workflow de publication exécute les tests, compile avec la vraie configuration, contrôle les ressources et publie seulement si ces étapes réussissent. Aucun déploiement de production n’est lancé par les simples poussées de code.

## 5. Contrôle final

1. Vérifier le site depuis son adresse publique et dans le sous-chemin final.
2. Se connecter avec deux comptes, créer puis rejoindre un espace par invitation.
3. Déplacer un sticker, recharger la page et vérifier la synchronisation sur le second appareil.
4. Ouvrir une pochette ; vérifier qu’une reprise réseau ne produit pas un autre tirage.
5. Installer STCK sur un iPhone réel, autoriser les notifications à partir du bouton, tester le rappel et une annonce, puis désactiver les notifications sur cet appareil.
6. Repasser les conseillers Supabase et examiner les journaux d’échec sans exposer les secrets ni les abonnements.

## Références

- [Supabase : connexion par e-mail](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase : sécuriser l’API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase : planifier les Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Apple : Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
