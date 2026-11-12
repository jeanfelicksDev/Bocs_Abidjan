import { useEffect, useState } from 'react';

/**
 * Thème d'affichage choisi par l'utilisateur, mémorisé sur le poste.
 * - `eglin` (soleil) : crème et vert forêt.
 * - `bocs`  (écran)  : clair bleu BOCS.
 * - `night` (lune)   : sombre, vert-noir et ivoire.
 *
 * Sans choix mémorisé, le réglage du poste décide : sombre → `night`, sinon `bocs`.
 * Les anciennes valeurs `dark` et `light` désignaient Eglin et le bleu BOCS :
 * elles sont relues comme telles, un choix déjà fait ne change pas. Seul un poste
 * réglé en sombre et sans choix mémorisé passe d'Eglin au thème sombre.
 *
 * Le script en ligne de `index.html` applique la même règle avant le premier
 * rendu pour éviter le flash de thème ; les deux doivent rester alignés.
 */
export type ThemePreference = 'eglin' | 'bocs' | 'night';

const STORAGE_KEY = 'theme';
const EVENT = 'bocs:theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Couleur de l'en-tête de chaque thème : la barre de titre de l'application installée la reprend. */
const THEME_COLOR: Record<ThemePreference, string> = {
  eglin: '#ffffff',
  bocs: '#ffffff',
  night: '#111714',
};

export function themeColorFor(theme: ThemePreference): string {
  return THEME_COLOR[theme];
}

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'eglin' || stored === 'bocs' || stored === 'night') return stored;
  if (stored === 'dark') return 'eglin';
  if (stored === 'light') return 'bocs';
  return media().matches ? 'night' : 'bocs';
}

function applyTheme(theme: ThemePreference): void {
  const classes = document.documentElement.classList;
  // `.dark` active les variantes `dark:` et les jetons `night-*`, communs à Eglin
  // et au sombre ; `.night` n'en remplace que les valeurs (tokens.css §13).
  classes.toggle('dark', theme !== 'bocs');
  classes.toggle('night', theme === 'night');
  classes.toggle('light', theme === 'bocs');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColorFor(theme));
}

export function setThemePreference(theme: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Thème courant, synchronisé entre tous les sélecteurs, les onglets et le poste. */
export function useThemePreference(): [ThemePreference, (theme: ThemePreference) => void] {
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);

  useEffect(() => {
    // Un autre sélecteur, un autre onglet ou le réglage du poste a pu changer le thème.
    const sync = () => {
      const current = getThemePreference();
      applyTheme(current);
      setTheme(current);
    };
    const mq = media();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    mq.addEventListener('change', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
      mq.removeEventListener('change', sync);
    };
  }, []);

  return [theme, setThemePreference];
}
