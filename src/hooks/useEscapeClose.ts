import { useEffect } from 'react';

/**
 * Pile globale des modales ouvertes : Échap ne ferme que la modale au sommet,
 * pas toutes les modales empilées (ex. aperçu d'impression au-dessus du module).
 */
const modalesOuvertes: symbol[] = [];

/**
 * Ferme une modale via la touche Échap tant qu'elle est affichée.
 *
 * @param active   La modale est-elle ouverte ?
 * @param onClose  Callback de fermeture (ex. `() => setOpened(null)`).
 *
 * Audit UX P1 : seules 3 modales géraient Échap ; ce hook standardise la
 * fermeture clavier sur toutes les modales de l'application.
 */
export function useEscapeClose(active: boolean | undefined, onClose: (() => void) | undefined): void {
  useEffect(() => {
    if (!active || !onClose) return;
    const id = Symbol('modal');
    modalesOuvertes.push(id);
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Seule la modale affichée en dernier (sommet de pile) se ferme.
      if (modalesOuvertes[modalesOuvertes.length - 1] !== id) return;
      const i = modalesOuvertes.indexOf(id);
      if (i >= 0) modalesOuvertes.splice(i, 1);
      onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      const i = modalesOuvertes.indexOf(id);
      if (i >= 0) modalesOuvertes.splice(i, 1);
      window.removeEventListener('keydown', handler);
    };
  }, [active, onClose]);
}

/**
 * Gestionnaire de clic sur l'arrière-plan d'une modale : ferme UNIQUEMENT si
 * l'utilisateur clique sur l'overlay lui-même (et pas dans le panneau),
 * grâce au test `e.target === e.currentTarget`. Une seule édition par modale,
 * sans stopPropagation sur les panneaux.
 */
export function overlayClickClose(onClose: () => void) {
  return (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
}
