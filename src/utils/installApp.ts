import { useSyncExternalStore } from 'react';

/**
 * Installation de BOCS comme application (PC et téléphone).
 *
 * Le navigateur décide seul si l'installation est possible : il l'annonce par
 * l'événement `beforeinstallprompt`, souvent avant même que l'écran Paramétrage
 * soit chargé. `watchInstallability()` l'écoute donc dès le démarrage et garde
 * l'événement, pour que le bouton « Installer » puisse l'utiliser plus tard.
 *
 * - `available`   : le navigateur propose l'installation, le bouton peut la lancer.
 * - `installed`   : BOCS tourne dans sa propre fenêtre, ou vient d'être installée.
 * - `ios`         : iPhone / iPad, où l'installation passe par le menu Partager de Safari.
 * - `unavailable` : navigateur sans installation, ou application déjà installée
 *                   et ouverte ici dans un onglet.
 */
export type InstallState = 'available' | 'installed' | 'ios' | 'unavailable';

export interface InstallFacts {
  isInstalled: boolean;
  hasPrompt: boolean;
  isIos: boolean;
}

export function resolveInstallState({ isInstalled, hasPrompt, isIos }: InstallFacts): InstallState {
  if (isInstalled) return 'installed';
  if (hasPrompt) return 'available';
  if (isIos) return 'ios';
  return 'unavailable';
}

/** Événement propre à Chrome, Edge et aux navigateurs Android : absent des types du DOM. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STANDALONE_QUERY = '(display-mode: standalone)';

let pendingPrompt: BeforeInstallPromptEvent | null = null;
let installedThisSession = false;
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((listener) => listener());

const isStandalone = (): boolean =>
  window.matchMedia(STANDALONE_QUERY).matches ||
  // Safari sur iOS n'expose pas display-mode : il pose ce drapeau hors norme.
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS se présente comme un Mac ; seul l'écran tactile le trahit.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function getInstallState(): InstallState {
  return resolveInstallState({
    isInstalled: installedThisSession || isStandalone(),
    hasPrompt: pendingPrompt !== null,
    isIos: isIos(),
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** À appeler une fois, au démarrage de l'application. */
export function watchInstallability(): void {
  // Pas de preventDefault : le navigateur garde sa propre invite (icône de la barre
  // d'adresse, bandeau Android), le bouton de Paramétrage s'y ajoute.
  window.addEventListener('beforeinstallprompt', (event) => {
    pendingPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    pendingPrompt = null;
    installedThisSession = true;
    notify();
  });
  window.matchMedia(STANDALONE_QUERY).addEventListener('change', notify);
}

let promptInFlight: Promise<boolean> | null = null;

/**
 * Ouvre l'invite d'installation du navigateur. Renvoie `true` si l'utilisateur a accepté.
 * Un second appel pendant que l'invite est ouverte attend la même réponse : rappeler
 * `prompt()` sur le même événement lèverait une erreur.
 */
export function promptInstall(): Promise<boolean> {
  if (promptInFlight) return promptInFlight;
  const event = pendingPrompt;
  if (!event) return Promise.resolve(false);

  promptInFlight = (async () => {
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      return outcome === 'accepted';
    } finally {
      // Un événement ne sert qu'une fois ; le navigateur en émet un nouveau s'il le juge utile.
      pendingPrompt = null;
      promptInFlight = null;
      notify();
    }
  })();
  return promptInFlight;
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getInstallState);
}
