import { useEffect } from 'react';

/**
 * Gestion du focus pour TOUTES les modales de l'application, montée une fois
 * dans App. Une modale se déclare par `role="dialog" aria-modal="true"` sur son
 * overlay ; ce gestionnaire s'occupe du reste :
 *   - à l'ouverture : mémorise l'élément focalisé, nomme la modale d'après son
 *     premier titre si elle n'a pas de nom, et place le focus à l'intérieur ;
 *   - pendant : Tab / Maj+Tab restent dans la modale du dessus ;
 *   - à la fermeture : rend le focus à l'élément d'origine.
 * La fermeture par Échap reste l'affaire de `useEscapeClose`.
 */

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

const DIALOG = '[role="dialog"][aria-modal="true"]';

const isVisible = (el: HTMLElement) => el.getClientRects().length > 0;

function focusables(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isVisible);
}

function topDialog(): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(DIALOG)].filter(isVisible);
  return all[all.length - 1] ?? null;
}

let headingSeq = 0;

function nameDialog(dialog: HTMLElement) {
  if (dialog.hasAttribute('aria-label') || dialog.hasAttribute('aria-labelledby')) return;
  const h = dialog.querySelector<HTMLElement>('h1, h2, h3, h4');
  if (!h) return;
  if (!h.id) h.id = `bocs-dialog-title-${++headingSeq}`;
  dialog.setAttribute('aria-labelledby', h.id);
}

function enter(dialog: HTMLElement) {
  nameDialog(dialog);
  if (dialog.contains(document.activeElement)) return; // autoFocus déjà honoré
  const preferred =
    dialog.querySelector<HTMLElement>('[autofocus], input:not([type="hidden"]):not([disabled]), select, textarea');
  const target = (preferred && isVisible(preferred) ? preferred : focusables(dialog)[0]) ?? dialog;
  if (target === dialog) dialog.tabIndex = -1;
  target.focus({ preventScroll: true });
}

export function useDialogFocus() {
  useEffect(() => {
    const opener = new WeakMap<HTMLElement, Element | null>();
    const open = new Set<HTMLElement>();

    const sync = () => {
      const current = new Set([...document.querySelectorAll<HTMLElement>(DIALOG)]);
      for (const d of current) {
        if (open.has(d)) continue;
        open.add(d);
        opener.set(d, document.activeElement);
        // Le contenu de la modale peut arriver au rendu suivant.
        requestAnimationFrame(() => enter(d));
      }
      for (const d of [...open]) {
        if (current.has(d)) continue;
        open.delete(d);
        const back = opener.get(d);
        // On ne rend le focus que s'il s'est perdu (fermeture), pas s'il a été
        // déplacé volontairement ailleurs.
        if (back instanceof HTMLElement && back.isConnected &&
            (document.activeElement === document.body || document.activeElement === null)) {
          back.focus({ preventScroll: true });
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const dialog = topDialog();
      if (!dialog) return;
      const items = focusables(dialog);
      if (items.length === 0) { e.preventDefault(); dialog.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !dialog.contains(active)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', onKeyDown);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
