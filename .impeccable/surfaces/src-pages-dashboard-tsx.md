---
version: 1
slug: "src-pages-dashboard-tsx"
primary_target: "src/pages/Dashboard.tsx"
related_targets: ["src/components/layout/Header.tsx","src/components/layout/Sidebar.tsx"]
---

# Brief de surface — Cockpit (tableau de bord + shell)

## Scope

Cible primaire : `src/pages/Dashboard.tsx`, et le shell qui le porte
(`src/components/layout/Header.tsx`, `src/components/layout/Sidebar.tsx`).
Les six modules métier ne sont pas touchés dans ce lot.

## Visitor mode

Operate.

## Audience, job, action

Agents BOCS CI (administrateur, agent import, agent export, comptabilité), à terme
clients exportateurs sur leur espace restreint. Leur tâche au cockpit : voir en quelques
secondes ce qui est dû, ce qui est certifié, ce qui attend une décision, puis entrer dans
le module qui traite. Fréquence : plusieurs fois par heure, toute la journée, écran 24".

## Proof and content

Le mécanisme démontré : lire les fichiers douaniers réels (XML GUCE, manifestes PDF) et
pousser la donnée jusqu'à la facture certifiée DGI/FNE. La base est **vide au premier
lancement** : l'état vide fait partie de la première impression et doit enseigner le
vocabulaire et la première action, pas meubler l'attente.

## Constraints

Le logo BOCS et le nom sont intouchables. Les composants web standard restent la norme
(navigation, boutons, champs, tableaux). Aucune valeur inventée : les montants et statuts
viennent de la donnée, ou d'une démonstration étiquetée comme synthétique. Les six modules
existants doivent continuer de fonctionner pendant la transition ; `legacy.css` ne
disparaît qu'à la fin, pas dans ce lot.

## Chosen direction and memorable moment

**Le plan de chargement** (plan de chargement cellulaire), clé de tirage `38b39877`.
Le moment mémorable : **la cale vide reste une cale** — le pont vide montre sa grille de
coordonnées (`baie.rang.tier`), sa légende et son unique action ; dès la première escale,
les cellules se remplissent d'état et le plan devient lisible d'un regard.

## Unresolved

- Les six modules métier seront repris dans les lots suivants.
- Les volumes réels de production restent inconnus.
- Aucune donnée de démonstration fournie : les captures peuplées seront synthétiques et
  étiquetées comme telles.

## Direction contract

THESIS: Le cockpit est un **plan de chargement**, pas un mur de cartes. La catégorie pose
cinq cartes égales avec un gros nombre et une icône ; ici la donnée est une grille de
cellules coordonnées dont la teinte est un état, et l'écran ne contient aucune carte.

OWN-WORLD: encre structurale bleu-noir, pont clair légèrement froid, blanc de cellule, et
quatre remplissages d'état pris au monde : vert BOCS (certifié / encaissé), bleu BOCS
(en cours / action), ambre (en attente), rouge (écart). Chaque cellule porte sa coordonnée
`baie.rang.tier` en petit mono ; les zones se séparent par le fond et l'espace, jamais par
une bordure décorative ; une seule ombre, un seul anneau de focus. Type : Libre Franklin
(grotesque administrative, chiffres tabulaires) pour l'UI et les montants, JetBrains Mono
réservé aux identifiants et aux coordonnées.

STORY: L'opérateur comprend en un regard où en est la journée — escales, BL, drafts,
factures, et surtout ce qui attend une décision — puis entre dans le module qui traite.

FIRST VIEWPORT: bandeau de service pleine largeur (marque BOCS, recherche, horloge GMT,
profil). Dessous, la **bande de liquidation** : une rangée de cellules étiquetées, valeurs
en chiffres tabulaires alignées à droite, coordonnée en coin. Puis le **pont** : colonnes =
escales du jour (ou la cale vide), cellules = éléments à traiter, coordonnée en coin,
teinte = état, légende en clé du plan. À droite, le registre des modules en entrées
numérotées, chaque entrée une ligne dense et cliquable — pas de carte, pas de chiffre
fantôme. Action primaire unique : « Importer un manifeste ».

FORM: le plan de chargement (plan de chargement cellulaire), position 1 de la liste
ordonnée ; clé de tirage `38b39877`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
the verdict, DESIGN.md, and every shipping raster carrying its provenance.
