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
- Trois choix : **Clair**, **Sombre**, **Système** (par défaut : suit le réglage du poste,
  y compris quand il change en cours de session).
- Le choix est mémorisé sur le poste (`localStorage.theme` ; absent = Système).
- Logique : `src/utils/theme.ts` (+ script en ligne dans `index.html` contre le flash au
  chargement). Interface : `src/components/common/ThemeSwitcher.tsx` — segmenté à trois
  boutons, ou `compact` (un bouton qui fait défiler) dans les barres chargées.

## 3. Palette
Source de vérité : `src/styles/tokens.css`. Les composants consomment des rôles, jamais des hex.

| Rôle | Clair | Sombre (`night-*`) |
|---|---|---|
| Fond de l'application | `#F6F8FB` / pont `#EAEFF4` | `#0B1622` |
| Panneaux, cartes | `#FFFFFF` | `#111F2E` |
| Survol, puces | `#EEF2F7` | `#182A3C` |
| Règle / bordure | `#DDE5EE` | `#23384D` |
| Texte principal | `#002B49` | `#E6EDF4` |
| Texte secondaire | `#33465C` | `#A8B7C6` |
| Texte discret | `#64778C` | `#8195A9` |
| Action (fond bouton) | `#005DAA` | `#1569B5` |
| Lien, icône active | `#004580` | `#7DB9F5` |
| Validé / encaissé | `#00875A` | `#5CCF9B` |
| En attente | `#B46A00` | `#EDBE62` |
| Écart / retard | `#C02440` | `#F4949E` |

Tous les textes sont ≥ 4,5:1 sur leur surface. Le sombre dérive du bleu nuit `#002B49` du logo.

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
5. **Logo** : composant `BocsLogo` uniquement — son soulignement bleu nuit passe en encre
   claire en thème sombre pour rester lisible.

## 6. Dette connue
- ~1 900 tailles de texte fractionnaires (`text-[14.4px]`) héritées de l'ancien `zoom: 0.75`.
- Hex clairs en dur dans les modules (thème clair) — à migrer vers les rôles.
- `legacy.css` et `dark-safety.css` disparaissent quand les modules consomment les rôles.
