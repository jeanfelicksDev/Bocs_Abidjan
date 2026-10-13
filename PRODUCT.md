# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Utilisateurs internes BOCS CI** — agence consignataire et manutention portuaire, Port
d'Abidjan. Quatre métiers, tous en journée de bureau sur écran 24", avec des tableaux
financiers denses :

- **Administrateur** — gère les comptes, la matrice des habilitations, les paramètres FNE
  et consulte le journal d'audit.
- **Agent import** — réceptionne les manifestes douaniers (XML GUCE ou PDF souvent scanné),
  crée les escales, suit les BL import jusqu'à la facturation.
- **Agent export** — suit la soumission des drafts BL des clients, valide côté armateur,
  consolide le manifeste export, émet et signe le BL original.
- **Comptabilité / facturation** — émet proformas et factures certifiées DGI/FNE, applique
  timbre fiscal et taxes, suit la balance âgée et les règlements.

**Clients exportateurs** (transitaires, chargeurs) — espace client limité à leurs propres
dossiers : soumission d'un draft BL en quatre étapes, suivi de l'instruction, documents.

## Product Purpose

Une seule passerelle pour la gestion maritime et la facturation d'une agence consignataire :
escales et suivi des navires, manifestes import, workflow export du draft BL jusqu'au BL
original signé, calcul des surestaries (DMDT), facturation fiscale ivoirienne et recouvrement.

Le produit existe parce que cette chaîne est aujourd'hui répartie entre des fichiers
douaniers, des PDF et des tableurs : chaque ressaisie est une source d'écart entre le
manifeste, le BL et la facture. Succès = la donnée douanière est saisie une fois et ressort
en facture certifiée, sans double saisie ni ressaisie.

## Positioning

Le mécanisme que la catégorie ne peut pas copier : la plateforme **lit les fichiers
douaniers réels** (XML GUCE, manifestes PDF jusqu'à l'OCR) et pousse cette même donnée
jusqu'au BL original signé puis à la facture certifiée DGI/FNE — import, export et fiscalité
ivoirienne dans un flux unique. Un logiciel de facturation ne sait pas parser un manifeste
douanier ; un outil de manifeste ne produit ni BL original ni facture fiscale conforme.

## Operating Context

- **Documents entrants** : manifeste import XML GUCE (exemple réel à la racine,
  `GUCE_ABIDJAN_IMPORT.XML`), manifestes PDF — fréquemment des scans, donc extraction de
  texte puis OCR (tesseract.js côté client).
- **Vocabulaire métier imposé** : escale, manifeste, BL / connaissement, draft, consolidation
  de manifeste, surestarie / DMDT (démurrage & detention), franchise, timbre fiscal, taxe
  additionnelle exceptionnelle, proforma, avoir, balance âgée, FNE, DGI, SOC/COC, agréage,
  quai Vridi, rade.
- **Devise et temps** : FCFA comme devise d'émission, USD en contrepartie pour l'export
  (taux de change paramétrable, ~600), horloge GMT affichée en permanence.
- **Droits** : matrice d'habilitations persistée (`bocs_permissions_matrix`) + exceptions
  par utilisateur ; un profil sans droit ne doit pas simplement voir le module grisé.
- **Mode démo** : les écrans d'entrée exposent des comptes de test 1-clic et une purge de
  données de démonstration ; la plateforme sert aussi à montrer le produit.
- **Facturation réelle** : numérotation fiscale unique (préfixes par type de facture,
  rapprochement anti-doublon), avoirs, échéanciers de règlement, journal d'audit horodaté.

## Capabilities and Constraints

- **Stack en place** : React 18 + TypeScript + Vite, Tailwind, Prisma 7 + adaptateur Neon
  (Postgres serverless), fonctions API sous `api/`, déploiement Vercel.
- **Vérifié** : build de production vert (`npm run build`), 1 553 modules, CSS ~117 Ko.
- **Dette connue, hors périmètre design** : les routes API renvoient du non-JSON au client
  (`Erreur lors de la synchronisation avec Neon`, `logAuditAction … Unexpected end of JSON
  input`) — panne de configuration/base, à traiter séparément.
- **Dette design connue** : les composants n'ont pas adopté le système de tokens ; ils
  portent des hexadécimaux en dur (`bg-[#005DAA]/10`), des tailles fractionnaires héritées
  d'un ancien `zoom: 0.75` (`text-[14.4px]`, `text-[21.6px]`) et des rayons hors échelle
  (`rounded-3xl`). Le fichier `src/styles/legacy.css` est un calque de compatibilité
  explicitement temporaire.
- **Indécidé** : aucune donnée de production ne m'a été fournie ; les volumes réels
  (nombre d'escales, de BL, de factures par jour) restent inconnus et ne doivent pas être
  inventés dans les écrans.

## Brand Commitments

- **Nom et entité** : BOCS CI — *Bremen Overseas Chartering Shipping*, Agence Consignataire
  & Manutention Portuaire, Port d'Abidjan.
- **Logo** : logo vectoriel BOCS partagé dans l'application (`BocsLogo`) — **explicitement
  conservé**, y compris son lettrage vert et son soulignement bleu nuit.
- **Autorité accordée sur la direction visuelle** : grande latitude — typographie, palette
  étendue autour du bleu BOCS, traitement des surfaces et profondeur peuvent être redéfinis.
  Le logo et le nom sont la seule chose intouchable.
- **Ancrage couleur existant** : bleu `#005DAA` (action), vert `#00875A` (validé / encaissé),
  bleu nuit `#002B49` (encre des titres). Ces trois valeurs viennent du logo : elles sont
  l'hypothèse de départ, extensibles, non contraignantes.
- **Voix** : française, professionnelle et sobre ; les libellés historiques portent des
  interdits personnels du client (« pas d'`animate-pulse` », « pas d'AI-tell »). Le
  vocabulaire de marque est factuel et maritime, jamais promotionnel.

## Evidence on Hand

- `GUCE_ABIDJAN_IMPORT.XML` — manifeste douanier réel, entrée du module import.
- `Proforma.pdf` — proforma réel, sortie du module facturation.
- `public/port-bg.jpg` / `public/port-bg.png` — photographie du port, seul actif visuel.
- `stitch_bocs_maritime_manager/` — 25 écrans de référence (HTML + captures) issus d'une
  exploration antérieure, plus la nomenclature des écrans et l'architecture prévue.
- `shots/` — captures de l'état actuel aux trois formats (desktop / wide / mobile).
- `tests/escales-persistence-contract.test.mjs` — contrat de persistance des escales.

**Absences à ne pas combler** : aucun témoignage client, aucune métrique d'usage, aucun
chiffre d'activité, aucune référence de conformité écrite fournis. Rien de tout cela ne
doit être fabriqué dans l'interface.

## Product Principles

1. **Une donnée, un chemin.** L'information douanière est saisie une fois et descend jusqu'à
   la facture ; tout écran qui demande de la ressaisir est un écran à corriger.
2. **La conformité se voit.** DGI/FNE, statuts et numérotation fiscale sont des états
   affichés, jamais des notes explicatives en bas de page.
3. **L'opérateur lit d'abord la donnée.** Des tableaux denses, comparables, alignés ; le
   décor ne gagne jamais la place que dispute l'information.
4. **Ce que le profil n'a pas le droit de faire n'existe pas à l'écran.** Les habilitations
   structurent la navigation, elles ne la décorent pas.
5. **Aucune valeur inventée.** Montants, statuts, positions de navires et références
   viennent de la donnée réelle ou d'une démonstration assumée comme telle.

## Accessibility & Inclusion

Interface en français, utilisée plusieurs heures par jour en poste de travail : le texte
courant ne descend pas sous le seuil de lisibilité confortable, la hiérarchie repose sur la
taille et le poids plutôt que sur la couleur seule, le focus clavier reste visible sur tous
les contrôles, et les animations respectent `prefers-reduced-motion` (déjà honoré par les
primitives). Aucun standard réglementaire n'a été exigé par le client.
