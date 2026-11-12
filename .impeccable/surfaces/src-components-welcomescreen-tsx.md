---
version: 1
slug: "src-components-welcomescreen-tsx"
primary_target: "src/components/WelcomeScreen.tsx"
related_targets: []
---

# Brief de surface — Cockpit d'accueil (WelcomeScreen, vue « welcome »)

## Scope

Vue d'accueil de `src/components/WelcomeScreen.tsx` (sections A à D actuelles : bandeau
marketing, 4 cartes KPI, 5 cartes modules, mouvements + AIS). Les vues « registre des
escales » et « création d'escale » du même fichier, l'en-tête et les modales ne changent pas.

## Visitor mode

Operate.

## Audience, job, action

Les cinq profils de PRODUCT.md. Ce que la page met en avant dépend du profil (décision
utilisateur du 13/10/2026) : chaque métier voit sa propre file de dossiers et sa propre
action principale. Plusieurs passages par heure, écran 24".

## Proof and content

Uniquement la donnée réelle : escales, BL, drafts, factures. Base vide au premier lancement :
l'état vide enseigne et propose l'action. Retirés car non mesurés : « API Opérationnelle »,
tirant d'eau / climat portuaire, marée.

## Constraints

Logo et nom intouchables. Deux thèmes (clair / sombre bleu BOCS) via les tokens d'état du
pont. Habilitations : un module sans droit n'apparaît pas.

## Direction contract

THESIS: L'accueil est le plan de chargement du jour du métier connecté, pas un mur de cartes
ni une bannière d'accroche. La catégorie empile un hero, quatre KPI égaux et des tuiles
modules ; ici la donnée est une grille de cellules coordonnées dont la teinte est un état.

OWN-WORLD: pont clair légèrement froid (--deck-ground), cellules blanches réglées d'un filet
1px (--cell-rule), encre bleu-noir ; quatre remplissages d'état : vert certifié/réglé, bleu
à traiter, ambre en attente, rouge écart/échéance dépassée. Coordonnée baie·rang en petit
mono dans chaque cellule. Zones séparées par le fond et l'espace, pas par des cartes.

STORY: l'agent lit en un regard combien de dossiers de SON métier attendent une décision et
où ils se trouvent (quelle escale), inspecte une cellule, puis l'ouvre dans le module.

FIRST VIEWPORT: titre « Plan du jour » + date et poste ; à droite l'unique action principale
du métier. Dessous, la bande de liquidation : une rangée de cellules jointives, valeurs en
chiffres tabulaires, coordonnée L-0n en coin. Puis le pont (colonnes = escales, cellules =
dossiers du métier, légende-clé avec effectifs) à gauche ; à droite, le registre numéroté
des modules autorisés, une ligne dense par module avec son effectif réel.

FORM: le plan de chargement cellulaire, position 1 ; repris du brief cockpit, clé de tirage
`38b39877`, adapté par profil.

SIGNATURE: sélectionner une cellule (clic ou clavier) l'affiche dans la fiche d'inspection
sous le pont (référence, client, état, montant) avec l'action « Ouvrir » ; au chargement, les
cellules se remplissent baie par baie, une seule fois, sans mouvement si l'utilisateur le refuse.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Pas de donnée de production : le pont peuplé est vérifié sur des réponses API simulées
  (étiquetées), jamais écrites en base.
