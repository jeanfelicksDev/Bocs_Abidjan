import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { User } from '../../types';
import { NavTab } from './Sidebar';
import { isTabAllowed, usePermissionsSync } from '../../utils/permissions';
import { useEscapeClose } from '../../hooks/useEscapeClose';

interface MainNavProps {
  currentUser: User;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  counts: {
    escalesCount: number;
    blsCount: number;
    draftsCount: number;
    facturesCount: number;
  };
  /** Classes du conteneur (affichage selon la largeur, alignement). */
  className?: string;
}

/**
 * Boutons de navigation principaux (Cockpit, Escales & Radar, Navires, Facturation,
 * Exportation, Administration, Paramétrage), partagés par l'en-tête des modules
 * (Header) et celui du cockpit (WelcomeScreen). Chaque bouton n'apparaît que si
 * la matrice des habilitations l'autorise.
 */
export const MainNav: React.FC<MainNavProps> = ({ currentUser, activeTab, onTabChange, counts, className = '' }) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  useEscapeClose(activeDropdown !== null, () => setActiveDropdown(null));
  usePermissionsSync();

  const isAllowed = (tab: NavTab) => isTabAllowed(currentUser, tab);
  const isExportActive = ['export', 'export_saisie', 'export_list', 'export_consolidation'].includes(activeTab);
  const isFacturationActive = ['facturation', 'facturation_journal', 'facturation_avoirs', 'facturation_tarifs', 'facturation_balance', 'facturation_config', 'surestarie'].includes(activeTab);
  const isAdminActive = ['admin', 'admin_users', 'admin_rights', 'admin_fne', 'admin_audit'].includes(activeTab);

  return (
    <nav aria-label="Navigation principale" className={`items-center gap-1.5 2xl:gap-2.5 ${className}`}>
        {/* 1. Cockpit / Tableau de Bord */}
        {isAllowed('dashboard') && (
          <button
            onClick={() => onTabChange('dashboard')}
            className={`group whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98] ${activeTab === 'dashboard'
                ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
              }`}
          >
            <span aria-hidden="true" className={`material-symbols-outlined text-lg transition-colors ${activeTab === 'dashboard' ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
              }`}>grid_view</span>
            <span>Cockpit</span>
          </button>
        )}

        {/* 2. Escales & Radar AIS */}
        {isAllowed('vessels') && (
          <button
            onClick={() => onTabChange('vessels')}
            className={`group whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98] ${activeTab === 'vessels'
                ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
              }`}
          >
            <span aria-hidden="true" className={`material-symbols-outlined text-lg transition-colors ${activeTab === 'vessels' ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
              }`}>radar</span>
            <span>Escales & Radar</span>
            {counts.escalesCount > 0 && (
              <span className={`text-2xs font-black px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'vessels'
                  ? 'bg-[#005DAA] text-white shadow-xs'
                  : 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-700'
                }`}>
                {counts.escalesCount}
              </span>
            )}
          </button>
        )}

        {/* 3. Registre des navires */}
        {isAllowed('navires') && (
          <button
            onClick={() => onTabChange('navires')}
            className={`group whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98] ${activeTab === 'navires'
                ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
              }`}
          >
            <span aria-hidden="true" className={`material-symbols-outlined text-lg transition-colors ${activeTab === 'navires' ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
              }`}>sailing</span>
            <span>Navires</span>
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
              className={`group whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] ${isFacturationActive
                  ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                  : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
                }`}
            >
              <span aria-hidden="true" className={`material-symbols-outlined text-lg transition-colors ${isFacturationActive ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
                }`}>credit_card</span>
              <span>Facturation</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              {counts.facturesCount > 0 && (
                <span className={`text-2xs font-black px-1.5 py-0.2 rounded-full font-mono ${isFacturationActive ? 'bg-[#005DAA] text-white' : 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-700'
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
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">credit_card</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Facturation BL par BL</div>
                      <div className="text-2xs text-zinc-500 font-normal">Aconage, conteneurs, transit direct</div>
                    </div>
                  </button>
                )}
                {isAllowed('facturation_journal') && (
                  <button
                    onClick={() => { onTabChange('facturation_journal'); setActiveDropdown(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">receipt_long</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Journal des Factures</div>
                      <div className="text-2xs text-zinc-500 font-normal">Proformas, définitives, FNE DGI</div>
                    </div>
                  </button>
                )}
                {isAllowed('facturation_avoirs') && (
                  <button
                    onClick={() => { onTabChange('facturation_avoirs'); setActiveDropdown(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">assignment_return</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Notes d'Avoir & Crédits</div>
                      <div className="text-2xs text-zinc-500 font-normal">Régularisations et remboursements</div>
                    </div>
                  </button>
                )}
                {isAllowed('facturation_tarifs') && (
                  <button
                    onClick={() => { onTabChange('facturation_tarifs'); setActiveDropdown(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">payments</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Grille Tarifs DMDT</div>
                      <div className="text-2xs text-zinc-500 font-normal">Barèmes surestaries & détentions</div>
                    </div>
                  </button>
                )}
                {isAllowed('surestarie') && (
                  <button
                    onClick={() => { onTabChange('surestarie'); setActiveDropdown(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">timer</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Surestaries & Détentions</div>
                      <div className="text-2xs text-zinc-500 font-normal">Calcul dégressif & facturation</div>
                    </div>
                  </button>
                )}
                {isAllowed('facturation_balance') && (
                  <button
                    onClick={() => { onTabChange('facturation_balance'); setActiveDropdown(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">account_balance</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Balance Client</div>
                      <div className="text-2xs text-zinc-500 font-normal">Suivi créances et encaissements</div>
                    </div>
                  </button>
                )}
                {isAllowed('facturation_config') && (
                  <button
                    onClick={() => { onTabChange('facturation_config'); setActiveDropdown(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors border-t border-zinc-100 group"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-zinc-400">settings</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Paramétrage Factures</div>
                      <div className="text-2xs text-zinc-500 font-normal">Rubriques, codes comptables & TVA</div>
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
              className={`group whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] ${isExportActive
                  ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                  : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
                }`}
            >
              <span aria-hidden="true" className={`material-symbols-outlined text-lg transition-colors ${isExportActive ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
                }`}>anchor</span>
              <span>Exportation</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              {counts.draftsCount > 0 && (
                <span className={`text-2xs font-black px-1.5 py-0.2 rounded-full font-mono ${isExportActive ? 'bg-[#005DAA] text-white' : 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-700'
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
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">edit_note</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Saisie Draft BL</div>
                      <div className="text-2xs text-zinc-500 font-normal">Instructions & expéditions</div>
                    </div>
                  </button>
                )}
                {isAllowed('export_list') && (
                  <button
                    onClick={() => { onTabChange('export_list'); setActiveDropdown(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">folder_open</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Espace Client / Drafts</div>
                      <div className="text-2xs text-zinc-500 font-normal">Signature & validation originale</div>
                    </div>
                  </button>
                )}
                {isAllowed('export_consolidation') && (
                  <button
                    onClick={() => { onTabChange('export_consolidation'); setActiveDropdown(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">inventory</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Consolidation Manifeste</div>
                      <div className="text-2xs text-zinc-500 font-normal">Groupage export pour l'escale</div>
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
              className={`group whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] ${isAdminActive
                  ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                  : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
                }`}
            >
              <span aria-hidden="true" className={`material-symbols-outlined text-lg transition-colors ${isAdminActive ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
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
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">manage_accounts</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Comptes Utilisateurs</div>
                      <div className="text-2xs text-zinc-500 font-normal">Habilitations & profils</div>
                    </div>
                  </button>
                )}
                {isAllowed('admin_fne') && (
                  <button
                    onClick={() => { onTabChange('admin_fne'); setActiveDropdown(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">tune</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Paramètres FNE DGI</div>
                      <div className="text-2xs text-zinc-500 font-normal">API fiscale & conformité CI</div>
                    </div>
                  </button>
                )}
                {isAllowed('admin_audit') && (
                  <button
                    onClick={() => { onTabChange('admin_audit'); setActiveDropdown(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-zinc-800 hover:bg-[#F0F7FF] hover:text-[#005DAA] cursor-pointer transition-colors group"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA]">verified_user</span>
                    <div>
                      <div className="font-extrabold text-zinc-900 group-hover:text-[#005DAA]">Journal d'Audit Trail</div>
                      <div className="text-2xs text-zinc-500 font-normal">Historique & traçabilité</div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 7. Paramétrage : tous les réglages de l'application */}
        {isAllowed('parametrage') && (
          <button
            onClick={() => onTabChange('parametrage')}
            className={`group whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98] ${activeTab === 'parametrage'
                ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
              }`}
          >
            <span aria-hidden="true" className={`material-symbols-outlined text-lg transition-colors ${activeTab === 'parametrage' ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
              }`}>settings</span>
            <span>Paramétrage</span>
          </button>
        )}
    </nav>
  );
};
