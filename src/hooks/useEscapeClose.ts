import { useEffect } from 'react';

/**
 * Fermeture des fenêtres modales : UNIQUEMENT par leurs boutons (Fermer, ×,
 * Annuler, Enregistrer…). Un clic à côté de la fenêtre ou la touche Échap ne
 * la ferment plus : on ne perd plus une saisie en cours par mégarde.
 *
 * Les menus (menu déroulant de la navigation, menu mobile) gardent la touche
 * Échap : ils s'appellent avec `{ menu: true }`.
 */

/**
 * Pile globale des menus ouverts : Échap ne ferme que le menu au sommet,
 * pas tous les menus empilés.
 */
const menusOuverts: symbol[] = [];

/**
 * Ferme un menu via la touche Échap tant qu'il est affiché.
 * Sans `{ menu: true }` (fenêtre modale), l'appel ne fait rien : la fenêtre
 * reste ouverte jusqu'au clic sur l'un de ses boutons.
 *
 * @param active   Le menu est-il ouvert ?
 * @param onClose  Callback de fermeture (ex. `() => setOpened(null)`).
 */
export function useEscapeClose(
  active: boolean | undefined,
  onClose: (() => void) | undefined,
  options: { menu?: boolean } = {}
): void {
  const menu = Boolean(options.menu);
  useEffect(() => {
    if (!menu || !active || !onClose) return;
    const id = Symbol('menu');
    menusOuverts.push(id);
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Seul le menu affiché en dernier (sommet de pile) se ferme.
      if (menusOuverts[menusOuverts.length - 1] !== id) return;
      const i = menusOuverts.indexOf(id);
      if (i >= 0) menusOuverts.splice(i, 1);
      onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      const i = menusOuverts.indexOf(id);
      if (i >= 0) menusOuverts.splice(i, 1);
      window.removeEventListener('keydown', handler);
    };
  }, [menu, active, onClose]);
}

/**
 * Clic sur l'arrière-plan d'une fenêtre modale : sans effet. La fenêtre ne se
 * ferme que par ses boutons. Conservé pour les ~70 fenêtres qui l'utilisent.
 */
export function overlayClickClose(_onClose: () => void) {
  return (_e: React.MouseEvent<HTMLDivElement>) => {};
}
