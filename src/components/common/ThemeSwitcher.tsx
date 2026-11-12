import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { ThemePreference, useThemePreference } from '../../utils/theme';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'eglin', label: 'Thème Eglin (crème)', Icon: Sun },
  { value: 'bocs', label: 'Thème bleu BOCS', Icon: Monitor },
  { value: 'night', label: 'Thème sombre', Icon: Moon },
];

const NEXT: Record<ThemePreference, ThemePreference> = { eglin: 'bocs', bocs: 'night', night: 'eglin' };

interface ThemeSwitcherProps {
  className?: string;
  /** Un seul bouton qui fait défiler Eglin → Bleu BOCS → Sombre (barres chargées). */
  compact?: boolean;
}

/** Sélecteur Eglin (soleil) / Bleu BOCS (écran) / Sombre (lune). Un seul composant pour tout l'écran. */
export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ className = '', compact = false }) => {
  const [pref, setPref] = useThemePreference();

  if (compact) {
    const current = OPTIONS.find((o) => o.value === pref)!;
    const next = OPTIONS.find((o) => o.value === NEXT[pref])!;
    const label = `${current.label} — cliquer pour : ${next.label}`;
    return (
      <button
        type="button"
        onClick={() => setPref(next.value)}
        aria-label={label}
        title={label}
        className={`flex items-center justify-center w-9 h-9 rounded-md border border-border-default bg-surface-sunken text-text-secondary hover:text-text-link transition-colors duration-150 cursor-pointer ${className}`}
      >
        <current.Icon className="w-4 h-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Thème d'affichage"
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border-default bg-surface-sunken ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPref(value)}
            className={`flex items-center justify-center w-8 h-8 rounded-sm transition-colors duration-150 cursor-pointer ${
              active
                ? 'bg-surface-base text-text-link shadow-[var(--elevation-1)]'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
};
