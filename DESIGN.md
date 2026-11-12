# BOCS CI — Design System « Bleu BOCS », clair et sombre

## 1. Vision et principes
Une seule marque, deux éclairages. L'interface BOCS CI (Bremen Overseas Chartering Shipping)
garde l'identité du logo — bleu BOCS, vert BOCS, bleu nuit — en thème clair comme en thème
sombre. Le thème sombre n'est pas une autre direction artistique : c'est le même plan de
chargement, lu de nuit.

- **Surfaces mates** : pas de verre (glassmorphism), pas de halo. Les bordures et l'espace
  délimitent l'information ; une seule ombre courte par niveau d'élévation.
- **L'état est une couleur, toujours la même** : vert = certifié / encaissé, bleu = en cours /
  action, ambre = en attente, rouge = écart. Identique dans les deux thèmes.
- **Pas d'or, pas de violet décoratif** : le violet ne subsiste qu'en couleur de catégorie (rôle Admin, opérations Export) en thème clair ; en sombre il retombe sur le bleu.

## 2. Thèmes et préférence utilisateur
- Trois thèmes, un bouton chacun :
  - **Soleil — Eglin** (`eglin`) : fond crème, encre vert-noir, action vert forêt.
  - **Écran — Bleu BOCS** (`bocs`) : clair, bleu du logo. C'est le thème de base (`:root`).
  - **Lune — Sombre** (`night`) : la nuit d'Eglin, fond vert-noir, texte ivoire, action
    émeraude ; l'or est réservé à la sélection de texte et à l'anneau de focus.
- Le choix est mémorisé sur le poste (`localStorage.theme`). Sans choix, le réglage du
  poste décide : sombre → `night`, sinon `bocs`. Les anciennes valeurs `dark` et `light`
  sont relues comme `eglin` et `bocs`.
- Classes sur `<html>` : `light` (bleu BOCS), `dark` (Eglin), `dark night` (sombre).
  `.dark` active les variantes `dark:` et les jetons `night-*`, communs à Eglin et au
  sombre ; `.night` n'en remplace que les valeurs (`tokens.css` §13).
- Logique : `src/utils/theme.ts` (+ script en ligne dans `index.html` contre le flash au
  chargement). Interface : `src/components/common/ThemeSwitcher.tsx` — segmenté à trois
  boutons, ou `compact` (un bouton qui fait défiler) dans les barres chargées.

## 3. Palette
Source de vérité : `src/styles/tokens.css`. Les composants consomment des rôles, jamais des hex.

| Rôle | Bleu BOCS | Eglin (`night-*`) | Sombre (`night-*` sous `.night`) |
|---|---|---|---|
| Fond de l'application | `#F6F8FB` / pont `#EAEFF4` | `#F6F5F0` | `#090D0B` |
| Panneaux, cartes | `#FFFFFF` | `#FFFFFF` | `#111714` |
| Survol, puces | `#EEF2F7` | `#ECEBE4` | `#19211D` |
| Règle / bordure | `#DDE5EE` | `#E2E0D8` | `#222C27` |
| Texte principal | `#002B49` | `#17201B` | `#EDEAE1` |
| Texte secondaire | `#33465C` | `#3D4942` | `#B2BAB2` |
| Texte discret | `#64778C` | `#5C6860` | `#86928A` |
| Action (fond bouton) | `#005DAA` | `#0E3B2C` | `#1E7854` |
| Lien, icône active | `#004580` | `#1F6A48` | `#7DD3A7` |
| Validé / encaissé | `#00875A` | `#1F6A48` | `#74D3A3` |
| En attente | `#B46A00` | `#82580F` | `#E8BE6A` |
| Écart / retard | `#C02440` | `#9A3322` | `#F09A8F` |

Tous les textes sont ≥ 4,5:1 sur leur surface. En sombre, la profondeur vient des surfaces
(fond < carte < survol) et d'un filet de lumière en tête de carte, pas d'ombres lourdes.
Ce qu'un jeton ne sait pas dire en sombre (teintes pastel translucides, carte du port,
aplats d'état pleins) vit dans `src/styles/night.css`.

## 4. Typographie
- **Interface et montants** : `Albert Sans`.
- **Identifiants** (n° de BL, conteneurs, coordonnées) : `JetBrains Mono`.

## 5. Règles d'implémentation
1. **Pas d'hex en dur dans le JSX.** Rôles sémantiques (`bg-surface-base`, `text-text-primary`,
   `border-border-default`) ; s'ils ne suffisent pas en sombre, `dark:` + palette `night-*`
   (`dark:bg-night-surface`, `dark:text-night-ink-2`, opacité permise : `dark:bg-night-raised/60`).
2. **Une variante `dark:` par propriété.** Deux `dark:bg-*` dans la même chaîne se
   contredisent ; l'ordre CSS tranche au hasard.
3. `src/styles/dark-safety.css` remappe en sombre les utilitaires clairs hérités
   (`bg-white`, `text-zinc-900`…). C'est un filet de transition, pas un modèle à suivre.
4. **Tableaux** : séparateurs 1px pleins ; état actif = changement de surface, pas de néon.
   Le contenu se lit dans la fonte d'interface (réglé une fois dans `base.css`) ; seules les
   cellules d'identifiant demandent la fonte de données par `font-mono`.
5. **Logo** : composant `BocsLogo` uniquement — son soulignement bleu nuit passe en encre
   claire en thème sombre pour rester lisible.

## 6. Dette connue
- ~1 900 tailles de texte fractionnaires (`text-[14.4px]`) héritées de l'ancien `zoom: 0.75`.
- Hex clairs en dur dans les modules (thème clair) — à migrer vers les rôles.
- `legacy.css` et `dark-safety.css` disparaissent quand les modules consomment les rôles.

## 7. Cockpit d'accueil : le plan de chargement
`src/components/cockpit/CockpitPlan.tsx`, monté par `WelcomeScreen` (vue « welcome »).
Brief : `.impeccable/surfaces/src-components-welcomescreen-tsx.md`.

- **Adapté au métier** : le plan montre les BL (Administration, Agent import), les drafts
  (Agent export, Client export) ou les factures (Comptabilité). Bande de comptes, libellés
  d'état et action principale changent avec le profil.
- **Bande de liquidation** (`.bocs-strip`) : quatre comptes jointifs, valeur à droite en
  chiffres tabulaires, coordonnée `L-0n`.
- **Pont** (`.bocs-deck`) : colonnes = escales (baies `B0n`, triées par urgence), cellules
  `.bocs-cell--{late|todo|wait|ok}` = dossiers, coordonnée `baie·rang`. Clé avec effectifs.
  Cale vide : grille hachurée qui garde ses coordonnées + l'action du métier.
- **Fiche d'inspection** (`.bocs-inspector`) : la cellule sélectionnée (clic / clavier) se lit,
  puis « Ouvrir » ou double-clic mène au module.
- **Registre des modules** (`.bocs-register`) : lignes numérotées, effectif réel par module,
  filtrées par les habilitations.
- **Mouvement** : remplissage baie par baie à l'arrivée (`.bocs-cell--enter`), une seule fois.
- Aucune valeur non mesurée : les anciennes mentions de marée, tirant d'eau et état d'API
  ont été retirées.
