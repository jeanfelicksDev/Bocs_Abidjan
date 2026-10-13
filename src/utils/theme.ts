import { useEffect, useState } from 'react';

/**
 * Préférence de thème de l'utilisateur.
 * - `system` : suit le réglage clair/sombre du poste, y compris quand il change.
 * - `light` / `dark` : choix forcé, mémorisé sur le poste.
 *
 * Le script en ligne de `index.html` applique la même règle avant le premier
 * rendu pour éviter le flash de thème ; les deux doivent rester alignés.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';
const EVENT = 'bocs:theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePreference(): ThemePreference {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

function applyTheme(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('light', !dark);
}

export function setThemePreference(pref: ThemePreference) {
  if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(pref);
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Préférence courante, synchronisée entre tous les sélecteurs et avec le système. */
export function useThemePreference(): [ThemePreference, (p: ThemePreference) => void] {
  const [pref, setPref] = useState<ThemePreference>(getThemePreference);

  useEffect(() => {
    const sync = () => {
      const p = getThemePreference();
      applyTheme(p); // un autre onglet a pu changer la préférence
      setPref(p);
    };
    const onSystemChange = () => {
      if (getThemePreference() === 'system') applyTheme('system');
    };
    const mq = media();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    mq.addEventListener('change', onSystemChange);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
      mq.removeEventListener('change', onSystemChange);
    };
  }, []);

  return [pref, setThemePreference];
}
