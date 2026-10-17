import React, { useState } from 'react';
import { BocsLogo } from "../BocsLogo";
import { User, UserRole } from '../../types';
import { NavTab } from './Sidebar';
import { LogOut, LogIn, ShieldCheck, Menu, X, DollarSign, ArrowLeft } from 'lucide-react';
import { ThemeSwitcher } from '../common/ThemeSwitcher';
import { canEditExchangeRate, isTabAllowed, usePermissionsSync } from '../../utils/permissions';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { MainNav } from './MainNav';

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
  onReturnToWelcome?: () => void;
  counts: {
    escalesCount: number;
    blsCount: number;
    draftsCount: number;
    facturesCount: number;
  };
}

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
  onReturnToWelcome,
  counts
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(exchangeRateUsd.toString());

  // Audit UX : fermeture clavier du menu mobile via Ã‰chap.
  useEscapeClose(mobileMenuOpen, () => setMobileMenuOpen(false), { menu: true });

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'Administrateur';
      case 'AGENT_IMPORT': return 'Agent Import';
      case 'AGENT_EXPORT': return 'Agent Export';
      case 'COMPTABILITE': return 'Comptabilité';
      case 'CLIENT_EXPORT': return 'Client Export';
    }
  };

  // RBAC : les droits effectifs proviennent désormais de la matrice des habilitations
  // (bocs_permissions_matrix + overrides par utilisateur) au lieu de listes codées en dur.
  usePermissionsSync();

  const isAllowed = (tab: NavTab) => isTabAllowed(currentUser, tab);

  const handleRateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(tempRate);
    if (canEditExchangeRate(currentUser) && !isNaN(val) && val > 0) {
      onUpdateExchangeRate(val);
    }
    setEditingRate(false);
  };

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-50 w-full px-4 md:px-6 py-2.5 transition-all select-none shadow-xs text-zinc-900">
      <div className="w-full flex items-center justify-between gap-4">

        {/* Left Section: Brand Logo & Mobile Menu Toggle & Bouton Retour Plateforme */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="xl:hidden p-1.5 text-zinc-700 hover:text-[#005DAA] transition-all cursor-pointer active:scale-95 flex items-center justify-center rounded-lg hover:bg-zinc-500/10"
            title="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Icône de retour à la Plateforme Intégrée de Gestion et Facturation Maritime */}
          {onReturnToWelcome && (
            <button
              type="button"
              onClick={onReturnToWelcome}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-[#F0F7FF] hover:bg-[#E0EFFF] text-[#005DAA] border border-[#005DAA]/30 hover:border-[#005DAA] transition-all cursor-pointer shadow-2xs group active:scale-95"
              title="Retour à la plateforme intégrée de gestion et facturation maritime"
              aria-label="Retour à la plateforme intégrée de gestion et facturation maritime"
            >
              <ArrowLeft className="w-4 h-4 text-[#005DAA] group-hover:-translate-x-0.5 transition-transform shrink-0" />
              <div className="hidden sm:flex xl:hidden min-[1680px]:flex flex-col text-left">
                <span className="text-2xs uppercase tracking-wider font-extrabold text-[#00875A] leading-none">Retour</span>
                <span className="text-xs font-black text-[#002B49] group-hover:text-[#005DAA] leading-tight mt-0.5 whitespace-nowrap">Plateforme Intégrée</span>
              </div>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div
              className="py-0.5 shrink-0 cursor-pointer flex items-center group/logo"
              onClick={() => onReturnToWelcome ? onReturnToWelcome() : onTabChange('dashboard')}
              title="Retour à la plateforme intégrée de gestion et facturation maritime"
            >
              <BocsLogo className="h-8 w-auto group-hover/logo:opacity-90 transition-opacity" />
            </div>
            {currentUser.role === 'ADMIN' && (
              <span className="hidden sm:inline-flex xl:hidden min-[1680px]:inline-flex px-2.5 py-0.5 rounded-full text-2xs font-black bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30 items-center gap-1 uppercase tracking-wider shadow-xs">
                <ShieldCheck className="w-3 h-3 text-[#00875A]" />
                <span>Admin</span>
              </span>
            )}
          </div>
        </div>

        {/* Middle Section: Complete Desktop Operational Flow Navigation */}
        <MainNav
          currentUser={currentUser}
          activeTab={activeTab}
          onTabChange={onTabChange}
          counts={counts}
          className="hidden xl:flex flex-1 min-w-0 justify-center"
        />

        {/* Right Section: Currency Exchange, Profile, Role Switcher */}
        <div className="flex items-center gap-2.5 shrink-0">

          <ThemeSwitcher compact className="hidden sm:flex shrink-0" />

          {/* Quick Currency Rate Widget */}
          {editingRate && canEditExchangeRate(currentUser) ? (
            <form onSubmit={handleRateSubmit} className="flex items-center gap-1 bg-zinc-50 border border-[#005DAA]/40 rounded-xl px-2 py-1">
              <span className="text-2xs text-[#005DAA] font-mono font-bold">$1=</span>
              <input
                type="number"
                value={tempRate}
                onChange={(e) => setTempRate(e.target.value)}
                className="w-16 px-1 py-0.5 text-xs text-zinc-900 bg-white border border-zinc-300 rounded font-mono"
                autoFocus
                onBlur={handleRateSubmit}
              />
              <span className="text-2xs text-zinc-500">F</span>
            </form>
          ) : (
            canEditExchangeRate(currentUser) ? (
              <button
                onClick={() => setEditingRate(true)}
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/20 rounded-xl text-2xs font-mono font-bold text-zinc-800 hover:text-[#005DAA] transition-all cursor-pointer shadow-2xs"
                title="Taux USD / FCFA officiel - Cliquer pour modifier"
              >
                <DollarSign className="w-3.5 h-3.5 text-[#005DAA]" />
                <span>1 USD = {exchangeRateUsd} FCFA</span>
              </button>
            ) : (
              // Lecture seule : seuls la comptabilité et l'administrateur modifient le taux.
              <span
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-500/10 border border-zinc-500/20 rounded-xl text-2xs font-mono font-bold text-zinc-800 shadow-2xs"
                title="Taux USD / FCFA officiel (modifiable par la comptabilité et l'administrateur)"
              >
                <DollarSign className="w-3.5 h-3.5 text-[#005DAA]" />
                <span>1 USD = {exchangeRateUsd} FCFA</span>
              </span>
            )
          )}

          {/* User Account summary */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={onOpenProfile}
                className="flex items-center gap-2 bg-zinc-500/10 hover:bg-zinc-500/20 px-3 py-1.5 rounded-xl border border-zinc-500/20 hover:border-zinc-500/30 shadow-2xs transition-all cursor-pointer group active:scale-95 text-zinc-900"
                title="Mon profil — paramètres & mot de passe"
                aria-label={`Mon profil : ${currentUser.nomComplet}`}
              >
                <div className="w-7 h-7 rounded-full bg-[#005DAA] text-white font-black text-xs flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  {currentUser.nomComplet.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="text-left hidden sm:block xl:hidden min-[1680px]:block max-w-[130px]">
                  <span className="text-xs font-extrabold text-zinc-900 block leading-none truncate group-hover:text-[#005DAA] transition-colors">{currentUser.nomComplet}</span>
                  <span className="text-2xs text-[#005DAA] font-mono font-bold leading-none mt-1 block truncate">{getRoleLabel(currentUser.role)}</span>
                </div>
              </button>

              <button
                onClick={onLogout}
                aria-label="Se déconnecter"
                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                title="Se déconnecter"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-4 py-2 premium-btn-primary text-white text-xs font-black rounded-xl transition-all cursor-pointer active:scale-95 shadow-md"
            >
              <LogIn className="w-4 h-4" />
              <span>Connexion</span>
            </button>
          )}

        </div>
      </div>

      {/* Mobile Drawer Navigation (Slide-over) */}
      {mobileMenuOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex xl:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative flex-grow max-w-xs w-full bg-white text-zinc-900 flex flex-col justify-between p-4 shadow-2xl animate-slide-in overflow-y-auto z-55 border-r border-zinc-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
                <div className="py-1 shrink-0">
                  <BocsLogo className="h-8 w-auto" />
                </div>
                <ThemeSwitcher />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fermer le menu"
                  className="p-1.5 text-zinc-500 hover:text-black dark:hover:text-night-ink rounded-lg hover:bg-zinc-500/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile links list */}
              <nav className="mt-6 space-y-1.5 text-zinc-800">

                {/* 0. Retour Plateforme Intégrée */}
                {onReturnToWelcome && (
                  <button
                    onClick={() => { onReturnToWelcome(); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 hover:bg-[#E0EFFF] cursor-pointer shadow-2xs group mb-2"
                    title="Retour à la plateforme intégrée de gestion et facturation maritime"
                  >
                    <ArrowLeft className="w-4 h-4 text-[#005DAA] group-hover:-translate-x-1 transition-transform" />
                    <div className="text-left">
                      <div className="text-2xs uppercase font-black text-[#00875A]">Portail Principal</div>
                      <span className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Plateforme Intégrée Maritime</span>
                    </div>
                  </button>
                )}

                {/* 1. Tableau de bord */}
                {isAllowed('dashboard') && (
                  <button
                    onClick={() => { onTabChange('dashboard'); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                      }`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg">grid_view</span>
                    <span>Cockpit / Dashboard</span>
                  </button>
                )}

                {/* 2. Escales */}
                {isAllowed('vessels') && (
                  <button
                    onClick={() => { onTabChange('vessels'); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'vessels' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                      }`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg">radar</span>
                    <div className="flex-1 flex justify-between items-center">
                      <span>Escales & Flotte</span>
                      {counts.escalesCount > 0 && (
                        <span className="text-2xs bg-[#005DAA] text-white px-2 py-0.5 rounded-full font-mono font-bold">
                          {counts.escalesCount}
                        </span>
                      )}
                    </div>
                  </button>
                )}

                {/* 3. Registre des navires */}
                {isAllowed('navires') && (
                  <button
                    onClick={() => { onTabChange('navires'); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'navires' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                      }`}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg">sailing</span>
                    <span>Registre des Navires</span>
                  </button>
                )}

                {/* 4. Facturation Accordion */}
                {isAllowed('facturation') && (
                  <div className="space-y-1 pt-2 border-t border-zinc-200">
                    <div className="px-3 py-1 text-2xs font-black uppercase text-[#005DAA] tracking-wider">Facturation & Règlements</div>
                    {isAllowed('facturation') && (
                      <button
                        onClick={() => { onTabChange('facturation'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'facturation' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">credit_card</span>
                        <span>Facturation BL par BL</span>
                      </button>
                    )}
                    {isAllowed('facturation_journal') && (
                      <button
                        onClick={() => { onTabChange('facturation_journal'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'facturation_journal' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">receipt_long</span>
                        <span>Journal des Factures</span>
                      </button>
                    )}
                    {isAllowed('facturation_avoirs') && (
                      <button
                        onClick={() => { onTabChange('facturation_avoirs'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'facturation_avoirs' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">assignment_return</span>
                        <span>Notes d'Avoir</span>
                      </button>
                    )}
                    {isAllowed('facturation_tarifs') && (
                      <button
                        onClick={() => { onTabChange('facturation_tarifs'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'facturation_tarifs' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">payments</span>
                        <span>Grille Tarifs DMDT</span>
                      </button>
                    )}
                    {isAllowed('surestarie') && (
                      <button
                        onClick={() => { onTabChange('surestarie'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'surestarie' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">timer</span>
                        <span>Surestaries & Détentions</span>
                      </button>
                    )}
                    {isAllowed('facturation_balance') && (
                      <button
                        onClick={() => { onTabChange('facturation_balance'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'facturation_balance' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">account_balance</span>
                        <span>Balance Client</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 5. Exportation Accordion */}
                {isAllowed('export') && (
                  <div className="space-y-1 pt-2 border-t border-zinc-200">
                    <div className="px-3 py-1 text-2xs font-black uppercase text-[#005DAA] tracking-wider">Exportation</div>
                    {isAllowed('export_saisie') && (
                      <button
                        onClick={() => { onTabChange('export_saisie'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'export_saisie' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">edit_note</span>
                        <span>Saisie Draft BL</span>
                      </button>
                    )}
                    {isAllowed('export_list') && (
                      <button
                        onClick={() => { onTabChange('export_list'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'export_list' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">folder_open</span>
                        <span>Espace Client / Drafts</span>
                      </button>
                    )}
                    {isAllowed('export_consolidation') && (
                      <button
                        onClick={() => { onTabChange('export_consolidation'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'export_consolidation' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">inventory</span>
                        <span>Consolidation Manifeste</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 6. Administration Accordion */}
                {isAllowed('admin') && (
                  <div className="space-y-1 pt-2 border-t border-zinc-200">
                    <div className="px-3 py-1 text-2xs font-black uppercase text-[#005DAA] tracking-wider">Administration</div>
                    {isAllowed('admin_users') && (
                      <button
                        onClick={() => { onTabChange('admin_users'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'admin_users' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">manage_accounts</span>
                        <span>Comptes Utilisateurs</span>
                      </button>
                    )}
                    {isAllowed('admin_fne') && (
                      <button
                        onClick={() => { onTabChange('admin_fne'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'admin_fne' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">tune</span>
                        <span>Params FNE DGI</span>
                      </button>
                    )}
                    {isAllowed('admin_audit') && (
                      <button
                        onClick={() => { onTabChange('admin_audit'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'admin_audit' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">verified_user</span>
                        <span>Journal d'Audit</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 7. Paramétrage */}
                {isAllowed('parametrage') && (
                  <div className="pt-2 border-t border-zinc-200">
                    <button
                      onClick={() => { onTabChange('parametrage'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'parametrage' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                        }`}
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">settings</span>
                      <span>Paramétrage</span>
                    </button>
                  </div>
                )}

              </nav>
            </div>

            {/* Mobile Footer */}
            <div className="pt-4 border-t border-zinc-200 space-y-3">
              {currentUser && isAuthenticated && (
                <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#005DAA] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {currentUser.nomComplet.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-zinc-900 truncate leading-tight">{currentUser.nomComplet}</p>
                      <p className="text-2xs text-[#005DAA] font-mono font-bold leading-tight mt-0.5">{getRoleLabel(currentUser.role)}</p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                </div>
              )}

              <button
                onClick={() => {
                  onLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-all border border-rose-200 cursor-pointer text-xs"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span className="font-bold">Se Déconnecter</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </header>
  );
};
