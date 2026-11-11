import React, { useEffect, useState } from 'react';
import { BocsLogo } from "../BocsLogo";
import { User, UserRole } from '../../types';
import { NavTab } from './Sidebar';
import { LogOut, LogIn, Menu, DollarSign, Search, Bell, Clock } from 'lucide-react';
import { ThemeSwitcher } from '../common/ThemeSwitcher';
import { isTabAllowed, usePermissionsSync } from '../../utils/permissions';
import { MainNav } from './MainNav';
import { MobileNav } from './MobileNav';

interface HeaderProps {
  currentUser: User;
  isAuthenticated: boolean;
  exchangeRateUsd: number;
  onLogout: () => void;
  /** Recherche (BL, conteneur, navire) : ouvre le registre des escales. */
  onSearch?: () => void;
  /** Créances ouvertes : la cloche porte un point et mène à la balance client. */
  hasOpenReceivables?: boolean;
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
  onLogout,
  onSearch,
  hasOpenReceivables = false,
  onOpenLogin,
  onOpenProfile,
  activeTab,
  onTabChange,
  counts
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Horloge GMT, affichée en permanence (contexte portuaire).
  const [gmt, setGmt] = useState('');
  useEffect(() => {
    const tick = () => setGmt(new Date().toLocaleTimeString('fr-FR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' GMT');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Les droits effectifs proviennent de la matrice des habilitations.
  usePermissionsSync();
  const canSeeBalance = isTabAllowed(currentUser, 'facturation_balance');
  const canOpenSettings = isTabAllowed(currentUser, 'parametrage');

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

        {/* Recherche, thème, cloche, horloge, taux du jour, compte */}
        <div className="flex items-center gap-2.5 shrink-0">

          {onSearch && (
            <button
              type="button"
              onClick={onSearch}
              className="flex items-center justify-center md:justify-start gap-2 w-9 md:w-56 xl:w-72 h-9 md:px-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-400 hover:border-[#005DAA]/50 hover:text-zinc-600 transition-colors cursor-pointer shrink-0"
              aria-label="Rechercher un BL, un conteneur ou un navire"
            >
              <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
              {/* Sur téléphone : icône seule, la recherche reste accessible. */}
              <span className="hidden md:inline truncate">Recherche BL, conteneur, navire…</span>
            </button>
          )}

          <ThemeSwitcher compact className="hidden sm:flex shrink-0" />

          {canSeeBalance && (
            <button
              type="button"
              onClick={() => onTabChange('facturation_balance')}
              className="relative p-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 hover:text-[#005DAA] transition-colors cursor-pointer shrink-0"
              title={hasOpenReceivables ? 'Créances ouvertes : voir la balance client' : 'Balance client'}
              aria-label={hasOpenReceivables ? 'Créances ouvertes : voir la balance client' : 'Balance client'}
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {hasOpenReceivables && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#005DAA] ring-2 ring-white" aria-hidden="true" />}
            </button>
          )}

          <span className="hidden lg:inline-flex items-center gap-1.5 pl-3 ml-0.5 border-l border-zinc-500/20 h-6 text-2xs font-mono font-semibold text-zinc-800 whitespace-nowrap" title="Heure universelle (GMT)">
            <Clock className="w-3.5 h-3.5 text-[#005DAA]" aria-hidden="true" />
            {gmt}
          </span>

          {/* Taux du jour : affiché ici, réglé dans Paramétrage (un seul endroit). */}
          {canOpenSettings ? (
            <button
              type="button"
              onClick={() => onTabChange('parametrage')}
              className="hidden md:flex items-center gap-1.5 pl-3 pr-1 border-l border-zinc-500/20 h-6 text-2xs font-mono font-semibold text-zinc-800 hover:text-[#005DAA] transition-colors cursor-pointer whitespace-nowrap"
              title="Taux USD / FCFA officiel — se règle dans Paramétrage"
            >
              <DollarSign className="w-3.5 h-3.5 text-[#005DAA]" aria-hidden="true" />
              <span>1 USD = {exchangeRateUsd} FCFA</span>
            </button>
          ) : (
            <span className="hidden md:flex items-center gap-1.5 pl-3 pr-1 border-l border-zinc-500/20 h-6 text-2xs font-mono font-semibold text-zinc-800 whitespace-nowrap" title="Taux USD / FCFA officiel">
              <DollarSign className="w-3.5 h-3.5 text-[#005DAA]" aria-hidden="true" />
              <span>1 USD = {exchangeRateUsd} FCFA</span>
            </span>
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
      <div className="hidden xl:block border-t border-zinc-100 px-4 md:px-6 py-1.5">
        <MainNav
          currentUser={currentUser}
          activeTab={activeTab}
          onTabChange={onTabChange}
          counts={counts}
          className="flex flex-wrap justify-start"
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
