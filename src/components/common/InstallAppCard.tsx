import { useState } from 'react';
import { Download } from 'lucide-react';
import { promptInstall, useInstallState } from '../../utils/installApp';
import type { InstallState } from '../../utils/installApp';

/** Ce que l'utilisateur doit savoir quand le bouton n'a rien à lancer. */
const HINTS: Record<Exclude<InstallState, 'available'>, string> = {
  installed: 'BOCS est installée sur cet appareil.',
  ios: 'Sur iPhone ou iPad : ouvrez BOCS dans Safari, touchez Partager, puis « Sur l’écran d’accueil ».',
  unavailable:
    'Ouvrez BOCS avec Chrome ou Edge, puis choisissez « Installer BOCS Maritime » dans le menu du navigateur. Si elle est déjà installée, lancez-la depuis le bureau ou l’écran d’accueil.',
};

/** Carte « Application » de Paramétrage : installe BOCS sur le poste ou le téléphone. */
export function InstallAppCard() {
  const state = useInstallState();
  const [hasFailed, setHasFailed] = useState(false);

  const handleInstall = async () => {
    setHasFailed(false);
    try {
      await promptInstall();
    } catch {
      // Le navigateur a refusé d'ouvrir son invite (geste non reconnu, invite déjà consommée).
      setHasFailed(true);
    }
  };

  return (
    <div className="p-4 bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md shadow-1 space-y-3">
      <div>
        <span className="block text-sm font-black text-text-primary dark:text-night-ink">Application</span>
        <span className="block text-xs text-text-muted dark:text-night-ink-2 mt-0.5">
          BOCS dans sa propre fenêtre, avec son icône sur le bureau ou l’écran d’accueil.
        </span>
      </div>
      {state === 'available' ? (
        <button
          type="button"
          onClick={handleInstall}
          className="px-3 h-9 premium-btn-primary text-white text-xs font-bold rounded-md cursor-pointer inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Installer l’application
        </button>
      ) : (
        <p className="text-xs text-text-secondary dark:text-night-ink-2">{HINTS[state]}</p>
      )}
      <p role="status" className="text-xs font-bold text-critical-text min-h-4">
        {hasFailed ? 'L’installation n’a pas pu démarrer. Passez par le menu du navigateur.' : ''}
      </p>
    </div>
  );
}
