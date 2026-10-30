# Publication de STCK

## Services

- Site : https://cgiy.github.io/stck/
- Dépôt public : https://github.com/CGIY/stck
- Organisation Supabase : STCK (`pkslvjmqlfyvpaadrogq`).
- Projet STCK : `udjigbhpusrovlzmzpdt`, Paris (`eu-west-3`).

Le code et les images sont publics avec l’accord du propriétaire. Les collections, collages et abonnements restent protégés par les règles RLS de Supabase. Aucun autre projet n’est utilisé.

## Comptes

Deux comptes administrativement provisionnés et un espace partagé existent. Chaque personne entre son code STCK ; le client utilise ce code comme mot de passe avec un identifiant interne sans livraison d’e-mail. Les inscriptions publiques et connexions anonymes sont désactivées. Aucun SMTP n’est nécessaire.

Les codes sont remis au propriétaire dans le fichier local `.private/Codes-STCK.txt`, protégé par les permissions du système. Ne jamais le publier, le mettre dans `dist/`, ni l’écrire dans les journaux. Changer un code nécessite une intervention administrateur. Le Site URL de Supabase n’intervient pas dans ce flux sans redirection.

## Base

Migrations appliquées dans l’ordre :

1. `supabase/migrations/20261030100716_stck_core.sql`.
2. `supabase/schedule.sql` (programmation des notifications).
3. `supabase/migrations/20261030150446_stck_free_board.sql`.
4. `supabase/migrations/20261030151214_stck_rare_odds.sql`.

Les tirages sont sérialisés par compte, identifiés par une clé de reprise, et limités à dix demandes par minute. Les exemplaires conservés sont plafonnés à trois par personne et par illustration. La probabilité rare est évaluée avant ce plafond : un rare supplémentaire peut donc être écarté quand trois sont déjà détenus.

Chaque collage identifie son propriétaire d’exemplaire et son numéro de copie. Le serveur vérifie le stock avant l’insertion. Les deux membres peuvent déplacer les exemplaires partagés ; l’auteur initial ne change pas.

## Notifications

`push-dispatch` est déployée avec un secret Bearer dédié, vérifié par la fonction. La vérification JWT de la passerelle est désactivée pour cet appel serveur. Les clés Web Push et le secret de déclenchement sont dans le schéma privé, sans accès client.

La tâche `stck-push-dispatch` tourne chaque minute. Son appel a été vérifié avec une réponse HTTP 200. Aucun appareil n’est inscrit automatiquement. L’utilisateur doit autoriser les notifications depuis STCK sur chacun de ses téléphones.

Pour un nouveau déploiement indépendant, `scripts/generate-push-config.mjs PROJECT_REF` écrit la configuration privée sans remplacer les clés existantes. Ne pas régénérer les clés du projet actuel. Déployer les quatre fichiers de la fonction en spécifiant `deno.json` comme import map.

Les annonces administrateur sont ajoutées dans `public.announcements` (`title`, `body`, `published_at`). Les notifications utilisent un texte discret, adapté à un écran verrouillé.

## Site et publication

GitHub Pages utilise GitHub Actions. Chaque mise à jour de `main`, ou un lancement manuel de « Publier STCK », exécute les tests, vérifie la fonction, compile le site et vérifie ses ressources avant de publier `dist/`.

`config.public.json` est publiable : URL Supabase et clé publishable uniquement. Les fichiers `.private/`, `.env*`, `config.local.json`, `node_modules/` et `dist/` sont exclus des sources publiées.

## Contrôles d’exploitation

- Vérifier l’adresse HTTPS, les planches, le collage et la pochette dans le sous-chemin `/stck/`.
- Contrôler l’accès des deux comptes, le stock de copies et les reprises réseau.
- Sur les téléphones : installer l’application, activer un rappel et les nouveautés, vérifier leur réception et la désactivation.
- Examiner Cron, les réponses `net._http_response`, les journaux et les conseillers Supabase sans afficher de secrets ni de destinations d’abonnement.

Les avis RLS sans politique dans le schéma privé correspondent à un refus d’accès volontaire. L’extension `pg_net` est fournie non déplaçable par Supabase. L’API `push_public_key` est une fonction privilégiée contrôlée qui ne retourne que la clé Web Push publique après vérification de la connexion. Ces choix doivent être revus en cas d’évolution du modèle d’accès.

Avis du conseiller : [schéma des extensions](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [fonction publique privilégiée](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS privée sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). La [vérification des mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) n’est pas activée ; les deux codes ont été générés aléatoirement et les inscriptions restent fermées.
