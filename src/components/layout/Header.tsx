import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { NavTab } from './Sidebar';
import { LogOut, LogIn, ShieldCheck, Menu, X, ChevronDown, DollarSign, ArrowLeft } from 'lucide-react';
import { isTabAllowed, usePermissionsSync } from '../../utils/permissions';
import { useEscapeClose } from '../../hooks/useEscapeClose';

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
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(exchangeRateUsd.toString());

  // Audit UX : fermeture clavier du menu mobile et des menus dÃ©roulants via Ã‰chap.
  useEscapeClose(mobileMenuOpen, () => setMobileMenuOpen(false));
  useEscapeClose(activeDropdown !== null, () => setActiveDropdown(null));

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'Administrateur';
      case 'AGENT_IMPORT': return 'Agent Import';
      case 'AGENT_EXPORT': return 'Agent Export';
      case 'COMPTABILITE': return 'ComptabilitÃ©';
      case 'CLIENT_EXPORT': return 'Client Export';
    }
  };

  // RBAC : les droits effectifs proviennent dÃ©sormais de la matrice des habilitations
  // (bocs_permissions_matrix + overrides par utilisateur) au lieu de listes codÃ©es en dur.
  usePermissionsSync();

  const isAllowed = (tab: NavTab) => isTabAllowed(currentUser, tab);

  const isExportActive = ['export', 'export_saisie', 'export_list', 'export_consolidation'].includes(activeTab);
  const isFacturationActive = ['facturation', 'facturation_journal', 'facturation_avoirs', 'facturation_tarifs', 'facturation_balance', 'facturation_config', 'surestarie'].includes(activeTab);
  const isAdminActive = ['admin', 'admin_users', 'admin_rights', 'admin_fne', 'admin_audit'].includes(activeTab);

  const handleRateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(tempRate);
    if (!isNaN(val) && val > 0) {
      onUpdateExchangeRate(val);
    }
    setEditingRate(false);
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-50 w-full px-4 md:px-6 py-2.5 transition-all select-none shadow-xs text-zinc-900">
      <div className="w-full flex items-center justify-between gap-4">

        {/* Left Section: Brand Logo & Mobile Menu Toggle & Bouton Retour Plateforme */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-1.5 text-zinc-700 hover:text-[#005DAA] transition-all cursor-pointer active:scale-95 flex items-center justify-center rounded-lg hover:bg-zinc-500/10"
            title="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* IcÃ´ne de retour Ã  la Plateforme IntÃ©grÃ©e de Gestion et Facturation Maritime */}
          {onReturnToWelcome && (
            <button
              type="button"
              onClick={onReturnToWelcome}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-[#F0F7FF] hover:bg-[#E0EFFF] text-[#005DAA] border border-[#005DAA]/30 hover:border-[#005DAA] transition-all cursor-pointer shadow-2xs group active:scale-95"
              title="Retour Ã  la plateforme intÃ©grÃ©e de gestion et facturation maritime"
              aria-label="Retour Ã  la plateforme intÃ©grÃ©e de gestion et facturation maritime"
            >
              <ArrowLeft className="w-4 h-4 text-[#005DAA] group-hover:-translate-x-0.5 transition-transform shrink-0" />
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#00875A] leading-none">Retour</span>
                <span className="text-xs font-black text-[#002B49] group-hover:text-[#005DAA] leading-tight mt-0.5 whitespace-nowrap">Plateforme IntÃ©grÃ©e</span>
              </div>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div
              className="py-0.5 shrink-0 cursor-pointer flex items-center group/logo"
              onClick={() => onReturnToWelcome ? onReturnToWelcome() : onTabChange('dashboard')}
              title="Retour Ã  la plateforme intÃ©grÃ©e de gestion et facturation maritime"
            >
              <svg className="h-8 w-auto group-hover/logo:opacity-90 transition-opacity" viewBox="0 0 350 90" xmlns="http://www.w3.org/2000/svg">
                <text x="340" y="42" fontFamily="'Plus Jakarta Sans', Arial, sans-serif" fontWeight="900" fontSize="52" fontStyle="italic" fill="#00875A" textAnchor="end" letterSpacing="-2">BOCS</text>
                <polygon points="0,48 350,48 315,88 290,88 316.25,58 0,58" fill="#002B49" />
                <text x="282" y="81" fontFamily="'Plus Jakarta Sans', Arial, sans-serif" fontWeight="bold" fontSize="19" fill="#002B49" textAnchor="end">ABIDJAN</text>
              </svg>
            </div>
            {currentUser.role === 'ADMIN' && (
              <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30 items-center gap-1 uppercase tracking-wider shadow-xs">
                <ShieldCheck className="w-3 h-3 text-[#00875A]" />
                <span>Admin</span>
              </span>
            )}
          </div>
        </div>

        {/* Middle Section: Complete Desktop Operational Flow Navigation */}
        <div className="hidden lg:flex items-center gap-1.5 xl:gap-2.5 flex-1 justify-center">

          {/* 1. Cockpit / Tableau de Bord */}
          {isAllowed('dashboard') && (
            <button
              onClick={() => onTabChange('dashboard')}
              className={`group px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98] ${activeTab === 'dashboard'
                  ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                  : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
                }`}
            >
              <span className={`material-symbols-outlined text-[18px] transition-colors ${activeTab === 'dashboard' ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
                }`}>grid_view</span>
              <span>Cockpit</span>
            </button>
          )}

          {/* 2. Escales & Radar AIS */}
          {isAllowed('vessels') && (
            <button
              onClick={() => onTabChange('vessels')}
              className={`group px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98] ${activeTab === 'vessels'
                  ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                  : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
                }`}
            >
              <span className={`material-symbols-outlined text-[18px] transition-colors ${activeTab === 'vessels' ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
                }`}>radar</span>
              <span>Escales & Radar</span>
              {counts.escalesCount > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'vessels'
                    ? 'bg-[#005DAA] text-white shadow-xs'
                    : 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-700'
                  }`}>
                  {counts.escalesCount}
                </span>
              )}
            </button>
          )}



          {/* 4. Facturation & FNE Dropdown */}
          {isAllowed('facturation') && (
            <div
              className="relative"
              onMouseEnter={() => setActiveDropdown('facturation')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                className={`group px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] ${isFacturationActive
                    ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                    : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
                  }`}
              >
                <span className={`material-symbols-outlined text-[18px] transition-colors ${isFacturationActive ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
                  }`}>credit_card</span>
                <span>Facturation</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                {counts.facturesCount > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono ${isFacturationActive ? 'bg-[#005DAA] text-white' : 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-700'
                    }`}>
                    {counts.facturesCount}
                  </span>
                )}
              </button>

              {activeDropdown === 'facturation' && (
                <div className="absolute left-0 mt-1 w-64 bg-white border border-zinc-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in">
                  {isAllowed('facturation') && (
                    <button
                      onClick={() => { onTabChange('facturation'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">credit_card</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Facturation BL par BL</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Aconage, conteneurs, transit direct</div>
                      </div>
                    </button>
                  )}
                  {isAllowed('facturation_journal') && (
                    <button
                      onClick={() => { onTabChange('facturation_journal'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">receipt_long</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Journal des Factures</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Proformas, dÃ©finitives, FNE DGI</div>
                      </div>
                    </button>
                  )}
                  {isAllowed('facturation_avoirs') && (
                    <button
                      onClick={() => { onTabChange('facturation_avoirs'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">assignment_return</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Notes d'Avoir & CrÃ©dits</div>
                        <div className="text-[10px] text-zinc-500 font-normal">RÃ©gularisations et remboursements</div>
                      </div>
                    </button>
                  )}
                  {isAllowed('facturation_tarifs') && (
                    <button
                      onClick={() => { onTabChange('facturation_tarifs'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">payments</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Grille Tarifs DMDT</div>
                        <div className="text-[10px] text-zinc-500 font-normal">BarÃ¨mes surestaries & dÃ©tentions</div>
                      </div>
                    </button>
                  )}
                  {isAllowed('surestarie') && (
                    <button
                      onClick={() => { onTabChange('surestarie'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">timer</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Surestaries & DÃ©tentions</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Calcul dÃ©gressif & facturation</div>
                      </div>
                    </button>
                  )}
                  {isAllowed('facturation_balance') && (
                    <button
                      onClick={() => { onTabChange('facturation_balance'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">account_balance</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Balance Client</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Suivi crÃ©ances et encaissements</div>
                      </div>
                    </button>
                  )}
                  {isAllowed('facturation_config') && (
                    <button
                      onClick={() => { onTabChange('facturation_config'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors border-t border-zinc-100 group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-zinc-400">settings</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">ParamÃ©trage Factures</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Rubriques, codes comptables & TVA</div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5. Exportation Dropdown */}
          {isAllowed('export') && (
            <div
              className="relative"
              onMouseEnter={() => setActiveDropdown('export')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                className={`group px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] ${isExportActive
                    ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                    : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
                  }`}
              >
                <span className={`material-symbols-outlined text-[18px] transition-colors ${isExportActive ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
                  }`}>anchor</span>
                <span>Exportation</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                {counts.draftsCount > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono ${isExportActive ? 'bg-[#005DAA] text-white' : 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-700'
                    }`}>
                    {counts.draftsCount}
                  </span>
                )}
              </button>

              {activeDropdown === 'export' && (
                <div className="absolute left-0 mt-1 w-56 bg-white border border-zinc-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in">
                  {isAllowed('export_saisie') && (
                    <button
                      onClick={() => { onTabChange('export_saisie'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">edit_note</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Saisie Draft BL</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Instructions & expÃ©ditions</div>
                      </div>
                    </button>
                  )}
                  {isAllowed('export_list') && (
                    <button
                      onClick={() => { onTabChange('export_list'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">folder_open</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Espace Client / Drafts</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Signature & validation originale</div>
                      </div>
                    </button>
                  )}
                  {isAllowed('export_consolidation') && (
                    <button
                      onClick={() => { onTabChange('export_consolidation'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">inventory</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Consolidation Manifeste</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Groupage export pour l'escale</div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 6. Administration Dropdown */}
          {isAllowed('admin') && (
            <div
              className="relative"
              onMouseEnter={() => setActiveDropdown('admin')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                className={`group px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] ${isAdminActive
                    ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                    : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
                  }`}
              >
                <span className={`material-symbols-outlined text-[18px] transition-colors ${isAdminActive ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
                  }`}>settings_suggest</span>
                <span>Administration</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {activeDropdown === 'admin' && (
                <div className="absolute right-0 mt-1 w-60 bg-white border border-zinc-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in">
                  {isAllowed('admin_users') && (
                    <button
                      onClick={() => { onTabChange('admin_users'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">manage_accounts</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Comptes Utilisateurs</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Habilitations & profils</div>
                      </div>
                    </button>
                  )}
                  {isAllowed('admin_fne') && (
                    <button
                      onClick={() => { onTabChange('admin_fne'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">tune</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">ParamÃ¨tres FNE DGI</div>
                        <div className="text-[10px] text-zinc-500 font-normal">API fiscale & conformitÃ© CI</div>
                      </div>
                    </button>
                  )}
                  {isAllowed('admin_audit') && (
                    <button
                      onClick={() => { onTabChange('admin_audit'); setActiveDropdown(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#005DAA]">verified_user</span>
                      <div>
                        <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Journal d'Audit Trail</div>
                        <div className="text-[10px] text-zinc-500 font-normal">Historique & traÃ§abilitÃ©</div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Section: Currency Exchange, Profile, Role Switcher */}
        <div className="flex items-center gap-2.5 shrink-0">

          {/* Quick Currency Rate Widget */}
          {editingRate ? (
            <form onSubmit={handleRateSubmit} className="flex items-center gap-1 bg-zinc-50 border border-[#005DAA]/40 rounded-xl px-2 py-1">
              <span className="text-[10px] text-[#005DAA] font-mono font-bold">$1=</span>
              <input
                type="number"
                value={tempRate}
                onChange={(e) => setTempRate(e.target.value)}
                className="w-16 px-1 py-0.5 text-xs text-zinc-900 bg-white border border-zinc-300 rounded font-mono"
                autoFocus
                onBlur={handleRateSubmit}
              />
              <span className="text-[10px] text-zinc-500">F</span>
            </form>
          ) : (
            <button
              onClick={() => setEditingRate(true)}
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/20 rounded-xl text-[11px] font-mono font-bold text-zinc-800 hover:text-[#005DAA] transition-all cursor-pointer shadow-2xs"
              title="Taux USD / FCFA officiel - Cliquer pour modifier"
            >
              <DollarSign className="w-3.5 h-3.5 text-[#005DAA]" />
              <span>1 USD = {exchangeRateUsd} FCFA</span>
            </button>
          )}

          {/* User Account summary */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={onOpenProfile}
                className="flex items-center gap-2 bg-zinc-500/10 hover:bg-zinc-500/20 px-3 py-1.5 rounded-xl border border-zinc-500/20 hover:border-zinc-500/30 shadow-2xs transition-all cursor-pointer group active:scale-95 text-zinc-900"
                title="Mon Profil â€” ParamÃ¨tres & mot de passe"
              >
                <div className="w-7 h-7 rounded-full bg-[#005DAA] text-white font-black text-xs flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  {currentUser.nomComplet.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="text-left hidden sm:block max-w-[130px]">
                  <span className="text-xs font-extrabold text-zinc-900 block leading-none truncate group-hover:text-[#005DAA] transition-colors">{currentUser.nomComplet}</span>
                  <span className="text-[10px] text-[#005DAA] font-mono font-bold leading-none mt-1 block truncate">{getRoleLabel(currentUser.role)}</span>
                </div>
              </button>

              <button
                onClick={onLogout}
                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                title="Se dÃ©connecter"
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
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative flex-grow max-w-xs w-full bg-white text-zinc-900 flex flex-col justify-between p-4 shadow-2xl animate-slide-in overflow-y-auto z-55 border-r border-zinc-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
                <div className="py-1 shrink-0">
                  <svg className="h-8 w-auto" viewBox="0 0 350 90" xmlns="http://www.w3.org/2000/svg">
                    <text x="340" y="42" fontFamily="'Plus Jakarta Sans', Arial, sans-serif" fontWeight="900" fontSize="52" fontStyle="italic" fill="#00875A" textAnchor="end" letterSpacing="-2">BOCS</text>
                    <polygon points="0,48 350,48 315,88 290,88 316.25,58 0,58" fill="#002B49" />
                    <text x="282" y="81" fontFamily="'Plus Jakarta Sans', Arial, sans-serif" fontWeight="bold" fontSize="19" fill="#002B49" textAnchor="end">ABIDJAN</text>
                  </svg>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-zinc-500 hover:text-black rounded-lg hover:bg-zinc-500/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile links list */}
              <nav className="mt-6 space-y-1.5 text-zinc-800">

                {/* 0. Retour Plateforme IntÃ©grÃ©e */}
                {onReturnToWelcome && (
                  <button
                    onClick={() => { onReturnToWelcome(); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 hover:bg-[#E0EFFF] cursor-pointer shadow-2xs group mb-2"
                    title="Retour Ã  la plateforme intÃ©grÃ©e de gestion et facturation maritime"
                  >
                    <ArrowLeft className="w-4 h-4 text-[#005DAA] group-hover:-translate-x-1 transition-transform" />
                    <div className="text-left">
                      <div className="text-[10px] uppercase font-black text-[#00875A]">Portail Principal</div>
                      <span className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Plateforme IntÃ©grÃ©e Maritime</span>
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
                    <span className="material-symbols-outlined text-[18px]">grid_view</span>
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
                    <span className="material-symbols-outlined text-[18px]">radar</span>
                    <div className="flex-1 flex justify-between items-center">
                      <span>Escales & Flotte</span>
                      {counts.escalesCount > 0 && (
                        <span className="text-[10px] bg-[#005DAA] text-white px-2 py-0.5 rounded-full font-mono font-bold">
                          {counts.escalesCount}
                        </span>
                      )}
                    </div>
                  </button>
                )}



                {/* 4. Facturation Accordion */}
                {isAllowed('facturation') && (
                  <div className="space-y-1 pt-2 border-t border-zinc-200">
                    <div className="px-3 py-1 text-[10px] font-black uppercase text-[#005DAA] tracking-wider">Facturation & RÃ¨glements</div>
                    {isAllowed('facturation') && (
                      <button
                        onClick={() => { onTabChange('facturation'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'facturation' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">credit_card</span>
                        <span>Facturation BL par BL</span>
                      </button>
                    )}
                    {isAllowed('facturation_journal') && (
                      <button
                        onClick={() => { onTabChange('facturation_journal'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'facturation_journal' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">receipt_long</span>
                        <span>Journal des Factures</span>
                      </button>
                    )}
                    {isAllowed('facturation_avoirs') && (
                      <button
                        onClick={() => { onTabChange('facturation_avoirs'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'facturation_avoirs' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">assignment_return</span>
                        <span>Notes d'Avoir</span>
                      </button>
                    )}
                    {isAllowed('facturation_tarifs') && (
                      <button
                        onClick={() => { onTabChange('facturation_tarifs'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'facturation_tarifs' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">payments</span>
                        <span>Grille Tarifs DMDT</span>
                      </button>
                    )}
                    {isAllowed('surestarie') && (
                      <button
                        onClick={() => { onTabChange('surestarie'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'surestarie' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">timer</span>
                        <span>Surestaries & DÃ©tentions</span>
                      </button>
                    )}
                    {isAllowed('facturation_balance') && (
                      <button
                        onClick={() => { onTabChange('facturation_balance'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'facturation_balance' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">account_balance</span>
                        <span>Balance Client</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 5. Exportation Accordion */}
                {isAllowed('export') && (
                  <div className="space-y-1 pt-2 border-t border-zinc-200">
                    <div className="px-3 py-1 text-[10px] font-black uppercase text-[#005DAA] tracking-wider">Exportation</div>
                    {isAllowed('export_saisie') && (
                      <button
                        onClick={() => { onTabChange('export_saisie'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'export_saisie' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">edit_note</span>
                        <span>Saisie Draft BL</span>
                      </button>
                    )}
                    {isAllowed('export_list') && (
                      <button
                        onClick={() => { onTabChange('export_list'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'export_list' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">folder_open</span>
                        <span>Espace Client / Drafts</span>
                      </button>
                    )}
                    {isAllowed('export_consolidation') && (
                      <button
                        onClick={() => { onTabChange('export_consolidation'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'export_consolidation' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">inventory</span>
                        <span>Consolidation Manifeste</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 6. Administration Accordion */}
                {isAllowed('admin') && (
                  <div className="space-y-1 pt-2 border-t border-zinc-200">
                    <div className="px-3 py-1 text-[10px] font-black uppercase text-[#005DAA] tracking-wider">Administration</div>
                    {isAllowed('admin_users') && (
                      <button
                        onClick={() => { onTabChange('admin_users'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'admin_users' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">manage_accounts</span>
                        <span>Comptes Utilisateurs</span>
                      </button>
                    )}
                    {isAllowed('admin_fne') && (
                      <button
                        onClick={() => { onTabChange('admin_fne'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'admin_fne' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">tune</span>
                        <span>Params FNE DGI</span>
                      </button>
                    )}
                    {isAllowed('admin_audit') && (
                      <button
                        onClick={() => { onTabChange('admin_audit'); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'admin_audit' ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40' : 'hover:bg-zinc-500/10'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#005DAA]">verified_user</span>
                        <span>Journal d'Audit</span>
                      </button>
                    )}
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
                      <p className="text-[10px] text-[#005DAA] font-mono font-bold leading-tight mt-0.5">{getRoleLabel(currentUser.role)}</p>
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
                <span className="font-bold">Se DÃ©connecter</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </header>
  );
};
