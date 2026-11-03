import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

interface ConnectionBannerProps {
  onRetry: () => void;
}

/**
 * Le serveur ne répond pas : on le dit en haut de l'écran, au lieu de laisser croire
 * que les escales, BL ou factures ont disparu.
 */
export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ onRetry }) => (
  <div
    role="alert"
    className="w-full flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm"
    style={{ backgroundColor: 'var(--state-late-bg)', color: 'var(--state-late-ink)', borderBottom: '1px solid var(--state-late-line)' }}
  >
    <span className="inline-flex items-center gap-2 font-semibold">
      <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
      Le serveur BOCS ne répond pas : les données affichées peuvent être incomplètes.
    </span>
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold border cursor-pointer bg-transparent hover:bg-[color:var(--state-late-line)] hover:text-white transition-colors"
      style={{ borderColor: 'var(--state-late-line)' }}
    >
      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
      Réessayer
    </button>
  </div>
);
