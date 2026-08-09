import React from 'react';
import { User, UserRole } from '../../types';
import { RefreshCw, DollarSign, LogOut, LogIn, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  isAuthenticated: boolean;
  onSwitchUser: (user: User) => void;
  allUsers: User[];
  exchangeRateUsd: number;
  onUpdateExchangeRate: (rate: number) => void;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isAuthenticated,
  onSwitchUser,
  allUsers,
  exchangeRateUsd,
  onUpdateExchangeRate,
  onLogout,
  onOpenLogin
}) => {
  const [showRateModal, setShowRateModal] = React.useState(false);
  const [newRate, setNewRate] = React.useState(exchangeRateUsd.toString());

  const handleRateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newRate);
    if (!isNaN(val) && val > 0) {
      onUpdateExchangeRate(val);
      setShowRateModal(false);
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'Administrateur';
      case 'AGENT_IMPORT': return 'Agent Import';
      case 'AGENT_EXPORT': return 'Agent Export';
      case 'COMPTABILITE': return 'Comptabilité';
      case 'CLIENT_EXPORT': return 'Client Export';
    }
  };

  return (
    <header className="bg-white text-slate-800 border-b border-slate-200/80 sticky top-0 z-40 px-6 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Quick Status / Brand Title */}
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-mono font-extrabold text-slate-700 tracking-wider uppercase flex items-center gap-2">
            <span>BOCS LOGISTICS — Système Opérationnel</span>
            {currentUser.role === 'ADMIN' && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-purple-600" />
                <span>Session Administrateur</span>
              </span>
            )}
          </span>
        </div>

        {/* Right: Currency Exchange Rate, Role Switcher & Auth Actions */}
        <div className="flex items-center gap-3">
          
          {/* Exchange Rate Badge */}
          <button
            onClick={() => setShowRateModal(true)}
            className="flex items-center gap-1.5 bg-amber-50/80 hover:bg-amber-100/80 text-amber-900 px-3 py-1.5 rounded-xl border border-amber-200 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Fixer le taux de change USD / FCFA"
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
            <span>1 USD = <strong className="font-mono text-amber-950">{exchangeRateUsd.toLocaleString('fr-FR')} FCFA</strong></span>
            <RefreshCw className="w-3 h-3 text-amber-600 ml-1" />
          </button>

          {/* User Profile Badge & Logout / Login Action */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-[#005daa] text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
                  {currentUser.nomComplet.charAt(0)}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-black text-slate-900 block leading-none">{currentUser.nomComplet}</span>
                  <span className="text-[10px] text-slate-500 font-semibold leading-none">{getRoleLabel(currentUser.role)}</span>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 transition-all flex items-center gap-1 text-xs font-bold cursor-pointer active:scale-95"
                title="Se déconnecter de la session"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden md:inline">Déconnexion</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 bg-[#005daa] hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl font-bold text-xs shadow transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Se Connecter</span>
            </button>
          )}

        </div>
      </div>

      {/* Modal Fixation Taux USD/FCFA */}
      {showRateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in text-slate-900">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center space-x-3 mb-4 text-[#00182f]">
              <DollarSign className="w-6 h-6 text-[#075fac]" />
              <h3 className="text-lg font-bold">Fixer le Taux de Change (USD / FCFA)</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Ce taux est appliqué automatiquement pour la conversion des montants de factures et devis saisis en USD vers FCFA.
            </p>
            <form onSubmit={handleRateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Taux 1 USD (FCFA)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="w-full pl-3 pr-12 py-2 border border-slate-300 rounded-lg font-bold text-lg text-[#00182f] focus:ring-2 focus:ring-[#005daa] focus:outline-none"
                    placeholder="600.00"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-sm font-bold text-slate-400">FCFA</span>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold text-white bg-[#00182f] hover:bg-[#075fac] rounded-lg shadow"
                >
                  Mettre à Jour
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
