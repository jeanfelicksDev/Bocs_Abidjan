import React, { useState } from 'react';
import { BocsLogo } from "../BocsLogo";
import { User, UserRole } from '../../types';
import { NavTab } from './Sidebar';
import { LogOut, LogIn, Menu, DollarSign } from 'lucide-react';
import { ThemeSwitcher } from '../common/ThemeSwitcher';
import { canEditExchangeRate, usePermissionsSync } from '../../utils/permissions';
import { MainNav } from './MainNav';
import { MobileNav } from './MobileNav';

interface HeaderProps {
  currentUser: User;
  isAuthenticated: boolean;
  exchangeRateUsd: number;
  onUpdateExchangeRate: (rate: number) => void;
  onLogout: () => void;
  onOpenLogin: () => void;
  onOpenProfile?: () => void;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  counts: {
    escalesCount: number;
    blsCount: number;
    draftsCount: number;
    facturesCount: number;
  };
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrateur',
  AGENT_IMPORT: 'Agent Import',
  AGENT_EXPORT: 'Agent Export',
  COMPTABILITE: 'Comptabilité',
  CLIENT_EXPORT: 'Client Export',
};

/**
 * En-tête des modules, sur deux lignes comme celui du Plan du jour : le logo (retour
 * au Plan du jour) et le compte en haut, la navigation en dessous. Sous 1 280 px, la
 * navigation passe dans le menu commun (MobileNav).
 */
export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isAuthenticated,
  exchangeRateUsd,
  onUpdateExchangeRate,
  onLogout,
  onOpenLogin,
  onOpenProfile,
  activeTab,
  onTabChange,
  counts
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(exchangeRateUsd.toString());

  // Les droits effectifs proviennent de la matrice des habilitations.
  usePermissionsSync();

  const handleRateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(tempRate);
    if (canEditExchangeRate(currentUser) && !isNaN(val) && val > 0) {
      onUpdateExchangeRate(val);
    }
    setEditingRate(false);
  };

  const initials = currentUser.nomComplet.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-50 w-full select-none shadow-xs text-zinc-900">
      <div className="w-full px-4 md:px-6 py-2.5 flex items-center justify-between gap-4">

        {/* Menu (petits écrans) et logo : le logo ramène au Plan du jour */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="xl:hidden p-2 text-zinc-700 hover:text-[#005DAA] transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-zinc-500/10"
            title="Ouvrir le menu"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onTabChange('dashboard')}
            className="py-0.5 shrink-0 cursor-pointer flex items-center rounded-md hover:opacity-90 transition-opacity"
            title="Plan du jour"
            aria-label="Plan du jour"
          >
            <BocsLogo className="h-8 w-auto" />
          </button>
        </div>

        {/* Thème, taux du jour, compte */}
        <div className="flex items-center gap-2.5 shrink-0">

          <ThemeSwitcher compact className="hidden sm:flex shrink-0" />

          {editingRate && canEditExchangeRate(currentUser) ? (
            <form onSubmit={handleRateSubmit} className="flex items-center gap-1 bg-zinc-50 border border-[#005DAA]/40 rounded-xl px-2 py-1">
              <span className="text-2xs text-[#005DAA] font-mono font-bold">$1=</span>
              <input
                type="number"
                value={tempRate}
                onChange={(e) => setTempRate(e.target.value)}
                className="w-16 px-1 py-0.5 text-xs text-zinc-900 bg-white border border-zinc-300 rounded font-mono"
                aria-label="Taux : francs CFA pour 1 dollar"
                autoFocus
                onBlur={handleRateSubmit}
              />
              <span className="text-2xs text-zinc-500">F</span>
            </form>
          ) : (
            canEditExchangeRate(currentUser) ? (
              <button
                type="button"
                onClick={() => setEditingRate(true)}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/20 rounded-xl text-2xs font-mono font-bold text-zinc-800 hover:text-[#005DAA] transition-colors cursor-pointer shadow-2xs"
                title="Taux USD / FCFA officiel - Cliquer pour modifier"
              >
                <DollarSign className="w-3.5 h-3.5 text-[#005DAA]" aria-hidden="true" />
                <span>1 USD = {exchangeRateUsd} FCFA</span>
              </button>
            ) : (
              // Lecture seule : seuls la comptabilité et l'administrateur modifient le taux.
              <span
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-500/10 border border-zinc-500/20 rounded-xl text-2xs font-mono font-bold text-zinc-800 shadow-2xs"
                title="Taux USD / FCFA officiel (modifiable par la comptabilité et l'administrateur)"
              >
                <DollarSign className="w-3.5 h-3.5 text-[#005DAA]" aria-hidden="true" />
                <span>1 USD = {exchangeRateUsd} FCFA</span>
              </span>
            )
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex items-center gap-2 bg-zinc-500/10 hover:bg-zinc-500/20 px-3 py-1.5 rounded-xl border border-zinc-500/20 hover:border-zinc-500/30 shadow-2xs transition-colors cursor-pointer group text-zinc-900"
                title="Mon profil — paramètres & mot de passe"
                aria-label={`Mon profil : ${currentUser.nomComplet}`}
              >
                <div className="w-7 h-7 rounded-full bg-[#005DAA] text-white font-black text-xs flex items-center justify-center shadow-xs">
                  {initials}
                </div>
                <div className="text-left hidden sm:block max-w-[150px]">
                  <span className="text-xs font-extrabold text-zinc-900 block leading-none truncate group-hover:text-[#005DAA] transition-colors">{currentUser.nomComplet}</span>
                  <span className="text-2xs text-[#005DAA] font-mono font-bold leading-none mt-1 block truncate">{ROLE_LABELS[currentUser.role]}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={onLogout}
                aria-label="Se déconnecter"
                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition-colors flex items-center justify-center cursor-pointer"
                title="Se déconnecter"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-4 py-2 premium-btn-primary text-white text-xs font-black rounded-xl transition-colors cursor-pointer shadow-md"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>Connexion</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation principale (grands écrans), sur sa propre ligne : rien ne se chevauche */}
      <div className="hidden xl:block border-t border-zinc-100 px-4 md:px-6 py-2">
        <MainNav
          currentUser={currentUser}
          activeTab={activeTab}
          onTabChange={onTabChange}
          counts={counts}
          className="flex flex-wrap justify-center"
        />
      </div>

      <MobileNav
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentUser={currentUser}
        activeTab={activeTab}
        onNavigate={onTabChange}
        onLogout={onLogout}
      />
    </header>
  );
};
