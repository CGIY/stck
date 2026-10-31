# Économie des stickers — catalogue à 55 emplacements

Calcul du 31 octobre 2026, après ajout de Monoprix et du quota de 20 % pour les éditions spéciales. Le taux global de rare reste de 10 %.

## Hypothèses vérifiées

Le catalogue actif comporte 55 stickers et huit planches : six principales totalisant 36 communs et 11 rares, puis Rouge-gorge et Monoprix, qui totalisent six communs et deux rares. Les anciens 3-03, 4-06 et 4-08 sont inactifs et conservés uniquement pour l’historique. Le 4-04 est « Reproduire un film porno 1:1 ».

Chaque tirage choisit indépendamment son édition (20 % spéciale, 80 % principale) et sa rareté (10 % rare, 90 % commune), puis choisit uniformément un sticker parmi ceux qui correspondent aux deux critères.

| Groupe | Part des tirages | Nombre de stickers | Probabilité d’un sticker donné |
|---|---:|---:|---:|
| Principal commun | 72 % | 36 | 2,0000 % |
| Principal rare | 8 % | 11 | 0,7273 % |
| Spécial commun | 18 % | 6 | 3,0000 % |
| Spécial rare | 2 % | 2 | 1,0000 % |

La récompense permanente d’une planche est débloquée quand son propriétaire a découvert au moins une fois chacune de ses illustrations actives. Les exemplaires consommés en défis comptent toujours. Les calculs par nombre de tirages s’appliquent donc à cette récompense, même quand le joueur utilise ses stickers. Si l’on veut posséder simultanément toutes les illustrations en stock, les mêmes chiffres supposent zéro consommation et sont une borne optimiste.

Les albums sont privés : 90 tirages correspondent à 90 tirages d’une personne. Les cadeaux du partenaire ne remplissent pas son album. Le plafond de deux exemplaires ne change pas le temps d’obtention du premier exemplaire d’une illustration.

## Gains, dépenses et pertes

| Action | Stock | Jetons partagés |
|---|---|---:|
| Sticker quotidien, par personne | +1 exemplaire si un emplacement de copie est libre | 0 |
| Défi réalisé | −1 exemplaire consommé | +1 |
| Pochette bonus | +1 exemplaire si un emplacement de copie est libre | −3 |
| Défi ouvert expiré après 48 h | Exemplaire rendu disponible, sans consommation | 0 |
| Troisième exemplaire identique et suivants | Aucun nouvel exemplaire conservé | +1 |
| Récompense de planche complète | Emblème et finition permanents | 0 |

Trois défis consomment trois copies, gagnent trois jetons et permettent un tirage bonus. Si ce tirage est conservé, la boucle a rendu une copie pour trois consommées : restitution de 33,3 % et baisse nette du stock de deux copies. Si le tirage tombe sur une illustration déjà conservée en deux exemplaires, il rend à la place un jeton partagé.

**Un bonus coûte trois jetons ; un troisième doublon rembourse un jeton. Son coût net est donc de deux jetons.** Un doublon quotidien donne également un jeton. La compensation est enregistrée sur la demande de tirage : répéter la même demande ne la crédite pas à nouveau.

Si d est la probabilité de tomber sur une illustration déjà présente en deux exemplaires, le coût net moyen d’un bonus est de 3 − d jetons, pour 1 − d copie conservée. À probabilité constante, le coût moyen par copie réellement conservée devient (3 − d)/(1 − d) : par exemple cinq jetons si la moitié des bonus est convertie, contre six sans compensation. Le remboursement améliore le rendement, mais un bonus entièrement converti coûte toujours deux jetons ; il ne permet pas une boucle gratuite infinie.

Deux joueurs récupérant chacun leur quotidien apportent deux tirages gratuits par jour. Chaque tirage peut produire au maximum un jeton, soit immédiatement en compensation de doublon, soit plus tard en réalisant son défi. Le plafond idéal à long terme reste **trois tirages par jour pour le couple** : deux gratuits et un bonus, sans croissance indéfinie du solde. Si les bonus sont partagés équitablement, cela représente au maximum théorique 1,5 tirage par personne et par jour.

Les doublons quotidiens alimentent désormais le solde même sans réaliser de défis. En revanche, les deux premiers exemplaires conservés ne donnent un jeton que lorsqu’ils sont consommés en défi. Les emblèmes et finitions obtenus restent permanents après cette consommation. Le solde initial de trois jetons donne en plus un premier bonus au couple.

## Première découverte de toutes les cases d’une planche

La médiane est le nombre de tirages auquel la moitié des joueurs a complété les découvertes de la planche. Au 90e centile, 90 % l’ont fait et 10 % attendent encore.

| Planche | Communs + rares | Moyenne | Médiane | 90e centile | Complète à 30 | À 60 | À 90 | À 180 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Amour | 4 + 1 | 173,9 | 141 | 323 | 0,68 % | 8,17 % | 23,25 % | 65,63 % |
| Douceurs | 6 + 2 | 229,6 | 193 | 409 | 0,02 % | 1,28 % | 7,53 % | 45,31 % |
| Saveurs | 11 + 2 | 240,7 | 205 | 411 | 0,00 % | 0,16 % | 2,84 % | 39,46 % |
| Plaisirs | 5 + 2 | 226,9 | 190 | 409 | 0,05 % | 1,89 % | 9,11 % | 46,58 % |
| Intimité | 7 + 2 | 232,2 | 195 | 410 | 0,01 % | 0,86 % | 6,22 % | 44,08 % |
| Porn & love | 3 + 2 | 220,4 | 183 | 408 | 0,29 % | 4,08 % | 13,27 % | 49,20 % |
| Rouge-gorge | 3 + 1 | 119,0 | 93 | 232 | 5,09 % | 26,25 % | 48,49 % | 82,57 % |
| Monoprix | 3 + 1 | 119,0 | 93 | 232 | 5,09 % | 26,25 % | 48,49 % | 82,57 % |

Le quota de 20 % accélère les deux petites éditions spéciales. Chacune a une médiane de 93 tirages et 48,49 % de chances d’être complétée à 90 tirages. Les planches principales sont plus lentes, car 47 stickers se partagent leurs 80 % des tirages. Saveurs a une médiane de 205 tirages et seulement 2,84 % de chances d’être complétée à 90.

Avec le seul quotidien, 93 tirages correspondent à 93 jours pour une personne. Le maximum théorique de 1,5 tirage/jour peut ramener cela vers 62 jours si les bonus sont partagés équitablement. Ce rythme exige de réaliser les défis ; il ne représente pas une promesse de progression.

## Débloquer au moins une récompense permanente

Simulation de 500 000 albums indépendants, graine fixe 20261031 :

| Tirages individuels | Au moins une planche découverte en entier |
|---:|---:|
| 30 | 11,02 % |
| 60 | 55,14 % |
| 90 | 87,74 % |
| 180 | 99,96 % |

À 90 tirages, l’estimation est de 87,74 %, avec un intervalle Monte-Carlo à 95 % d’environ 87,65 à 87,83 %. Les probabilités des différentes planches ne s’additionnent pas : un album peut en compléter plusieurs.

**Le premier emblème devient fréquent avec ce réglage.** C’est un effet du quota de 20 % réservé à deux petites planches de quatre cases. En revanche, tout le catalogue reste long à découvrir : environ 427,7 tirages en moyenne, 395 à la médiane et 642 au 90e centile. La probabilité de découvrir les 57 illustrations à 90 tirages est d’environ 0,0000001802 %, soit un cas sur 555 millions.

## Doublons au plafond de deux copies

Ces chiffres supposent zéro consommation. « Distinctes » compte une seule fois chaque illustration ; « conservés » comprend au maximum deux copies. Chaque copie supplémentaire devient un jeton partagé.

| Tirages | Illustrations distinctes attendues | Exemplaires conservés | Copies converties en jetons attendues |
|---:|---:|---:|---:|
| 30 | 22,64 | 28,64 | 1,36 |
| 60 | 35,13 | 51,57 | 8,43 |
| 90 | 42,26 | 68,21 | 21,79 |
| 180 | 50,74 | 93,37 | 86,63 |

À 90 tirages individuels sans consommation, le joueur possède en moyenne 42,26 illustrations et 68,21 copies ; 21,79 tirages ont été convertis en jetons partagés. Cela ne signifie pas qu’il a gagné 21,79 jetons en plus de tous ses bonus : il faut déduire les trois jetons dépensés pour chaque bonus effectué. Consommer des copies libère leurs emplacements et réduit les conversions futures.

## Scénarios de rareté, quota spécial maintenu à 20 %

Ces variantes sont des calculs uniquement. Le taux du jeu n’a pas été réduit.

| Taux global de rares | Au moins une planche à 30 | À 60 | À 90 | À 180 |
|---:|---:|---:|---:|---:|
| 10 % | 11,02 % | 55,14 % | 87,74 % | 99,96 % |
| 5 % | 6,53 % | 35,11 % | 65,06 % | 97,10 % |
| 3 % | 4,19 % | 23,24 % | 46,06 % | 85,55 % |

À 5 %, les médianes sont : Amour 206 tirages, Douceurs 339 tirages, Saveurs 340 tirages, Plaisirs 339 tirages, Intimité 340 tirages, Porn & love 339 tirages, Rouge-gorge 145 tirages, Monoprix 145 tirages. À 3 %, elles deviennent : Amour 320, Douceurs 563, Saveurs 563, Plaisirs 563, Intimité 563, Porn & love 563, Rouge-gorge 232, Monoprix 232. Abaisser uniformément le taux de rares pénalise surtout les dernières cases des grandes planches, alors que les petites éditions spéciales restent les premières récompenses probables.

Le taux actuel de 10 % convient si les emblèmes sont des jalons de progression et que le grand objectif rare est le catalogue entier. Si « compléter doit être rare » signifie qu’un premier emblème doit être exceptionnel, le quota de 20 % sur deux petites planches va dans le sens inverse ; le seul taux global ne donne pas ici une attente courte pour les grandes planches et une première récompense exceptionnelle. Aucun ajustement supplémentaire n’est appliqué par cette analyse.

## Reproduire les calculs

Depuis le dossier `stck` :

```sh
python3 scripts/analyze-economy.py > art-direction/economy-results.json
python3 scripts/analyze-economy.py --rare-rate .05 > art-direction/economy-results-five-percent.json
python3 scripts/analyze-economy.py --rare-rate .03 > art-direction/economy-results-three-percent.json
```

Le script lit `src/catalog.json` et `src/collections.json` sans accès réseau ni écriture dans le jeu. Les probabilités par planche sont calculées par inclusion-exclusion à 75 chiffres de précision. La moyenne découle de la somme des temps d’attente des coupons manquants ; médianes et 90es centiles utilisent une recherche du premier nombre de tirages franchissant le seuil. Le catalogue entier utilise quatre classes de probabilités, les planches individuelles seulement les deux classes de leur édition.

Pour une planche contenant c communs de probabilité individuelle p et r rares de probabilité individuelle q :

```text
P(T ≤ n) = Σᵢ₌₀ᶜ Σⱼ₌₀ʳ (−1)^(i+j) × C(c,i) × C(r,j)
           × (1 − i × p − j × q)^n
```

La simulation utilise 500 000 albums de 180 tirages, des relevés à 30/60/90/180, la graine 20261031 et le générateur déterministe Mulberry32 en JavaScript. Il n’y a ni échange entre partenaires, ni tirage ciblé par planche, ni coût réel en euros dans ce modèle.
