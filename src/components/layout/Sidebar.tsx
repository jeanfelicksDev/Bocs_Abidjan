import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { isTabAllowed, usePermissionsSync } from '../../utils/permissions';

export type NavTab =
  | 'dashboard'
  | 'vessels'
  | 'import'
  | 'export'
  | 'export_saisie'
  | 'export_list'
  | 'export_consolidation'
  | 'facturation'
  | 'facturation_journal'
  | 'facturation_avoirs'
  | 'facturation_tarifs'
  | 'facturation_balance'
  | 'facturation_config'
  | 'surestarie'
  | 'admin'
  | 'admin_users'
  | 'admin_rights'
  | 'admin_fne'
  | 'admin_audit';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  userRole: UserRole;
  currentUser?: User;
  isAuthenticated?: boolean;
  onLogout?: () => void;
  onOpenLogin?: () => void;
  exchangeRateUsd?: number;
  counts: {
    escalesCount: number;
    blsCount: number;
    draftsCount: number;
    facturesCount: number;
  };
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavSection {
  title: string;
  items: {
    id: NavTab;
    label: string;
    icon: string;
    badge?: number | string | null;
    glassBadge?: string;
    colorClass?: string;
    subItems?: {
      id: NavTab;
      label: string;
      icon: string;
    }[];
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  userRole,
  currentUser,
  isAuthenticated = true,
  onLogout,
  onOpenLogin,
  exchangeRateUsd = 600,
  counts,
  isOpen = false,
  onClose
}) => {
  // RBAC : les droits effectifs proviennent désormais de la matrice des habilitations
  // (bocs_permissions_matrix + overrides par utilisateur) au lieu de listes codées en dur.
  usePermissionsSync();

  const isAllowed = (tab: NavTab) => isTabAllowed(currentUser || { id: -1, role: userRole }, tab);

  const sections: NavSection[] = [
    {
      title: 'VUE D\'ENSEMBLE',
      items: [
        {
          id: 'dashboard',
          label: 'Tableau de Bord',
          icon: 'grid_view'
        }
      ]
    },
    {
      title: 'OPÉRATIONS MARITIMES',
      items: [

        {
          id: 'export',
          label: 'Exportation & Draft BL',
          icon: 'anchor',
          badge: counts.draftsCount > 0 ? counts.draftsCount : null,
          colorClass: 'text-amber-500 hover:text-amber-400',
          subItems: [
            { id: 'export_saisie', label: 'Saisie Draft BL', icon: 'edit_note' },
            { id: 'export_list', label: 'Espace Client / Drafts', icon: 'folder_open' },
            { id: 'export_consolidation', label: 'Consolidation Manifeste', icon: 'inventory' }
          ]
        }
      ]
    },
    {
      title: 'FINANCE & FACTURATION',
      items: [
        {
          id: 'facturation',
          label: 'Facturation BL par BL',
          icon: 'credit_card',
          badge: counts.facturesCount > 0 ? counts.facturesCount : null,
          colorClass: 'text-blue-400 hover:text-blue-300',
          subItems: [
            { id: 'facturation', label: 'Facturation BL par BL', icon: 'credit_card' },
            { id: 'facturation_journal', label: 'Journal des Factures', icon: 'receipt_long' },
            { id: 'facturation_avoirs', label: 'Notes d\'Avoir & Crédits', icon: 'assignment_return' },
            { id: 'facturation_tarifs', label: 'Tarifs Surestaries', icon: 'payments' },
            { id: 'facturation_balance', label: 'Balance Client', icon: 'account_balance' },
            { id: 'facturation_config', label: 'Configuration Factures', icon: 'settings' },
            { id: 'surestarie', label: 'Surestaries & Détentions', icon: 'timer' }
          ]
        }
      ]
    },
    {
      title: 'ADMINISTRATION & SÉCURITÉ',
      items: [
        {
          id: 'admin',
          label: 'Console Administrateur',
          icon: 'settings_suggest',
          colorClass: 'text-rose-500 hover:text-rose-400',
          subItems: [
            { id: 'admin_users', label: 'Comptes Utilisateurs', icon: 'manage_accounts' },
            { id: 'admin_rights', label: 'Attribution des Droits', icon: 'shield_lock' },
            { id: 'admin_fne', label: 'Params Factures & Devise', icon: 'tune' },
            { id: 'admin_audit', label: 'Journal d\'Audit', icon: 'verified_user' }
          ]
        }
      ]
    }
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside className={`fixed md:sticky top-0 left-0 z-50 w-[270px] bg-[#0b172a] text-slate-300 flex flex-col justify-between shrink-0 h-screen select-none border-r border-slate-800/80 overflow-y-auto transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>

        {/* Brand Header */}
        <div>
          <div className="p-4 bg-[#a4acb6]">
            <div className="flex items-center justify-center py-1">
              <svg className="w-full h-auto max-h-11" viewBox="0 0 350 90" xmlns="http://www.w3.org/2000/svg">
                <text x="340" y="42" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fontSize="52" fontStyle="italic" fill="#00875A" textAnchor="end" letterSpacing="-2">BOCS</text>
                <polygon points="0,48 350,48 315,88 290,88 316.25,58 0,58" fill="#002B49" />
                <text x="282" y="81" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="19" fill="#002B49" textAnchor="end">ABIDJAN</text>
              </svg>
            </div>
          </div>

          {/* Navigation Sections */}
          <nav className="p-3 space-y-5">
            {sections.map((sec, secIdx) => {
              const allowedItems = sec.items.filter(item => isAllowed(item.id));
              if (allowedItems.length === 0) return null;

              return (
                <div key={secIdx} className="space-y-1">

                  {/* Section Title Header */}
                  <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                    {sec.title}
                  </div>

                  {/* Items in section */}
                  {allowedItems.map((item) => {
                    const isMainActive = activeTab === item.id || (item.subItems && item.subItems.some(sub => activeTab === sub.id));

                    return (
                      <div key={item.id} className="space-y-0.5">

                        {/* Main Navigation Item */}
                        <button
                          onClick={() => {
                            onTabChange(item.id);
                            if (onClose) onClose();
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 active:scale-[0.99] cursor-pointer ${isMainActive
                              ? 'bg-[#005daa] text-white shadow-md font-extrabold'
                              : `${item.colorClass || 'text-slate-400 hover:text-white'} hover:bg-[#13233c]/60`
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined text-lg ${isMainActive
                                ? 'text-white'
                                : item.colorClass ? '' : 'text-slate-400'
                              }`}>
                              {item.icon}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span>{item.label}</span>
                              {item.glassBadge && (
                                <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                                  {item.glassBadge}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {item.badge !== null && item.badge !== undefined && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isMainActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-[#152a48] text-blue-300'
                                }`}>
                                {item.badge}
                              </span>
                            )}

                          </div>
                        </button>

                        {/* Sub-items accordion */}
                        {item.subItems && (
                          <div className="ml-5 pl-2 border-l border-slate-800 space-y-0.5 my-1">
                            {item.subItems.map((sub) => {
                              if (!isAllowed(sub.id)) return null;

                              const isSubActive = activeTab === sub.id;

                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => {
                                    onTabChange(sub.id);
                                    if (onClose) onClose();
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${isSubActive
                                      ? 'bg-[#005daa]/40 text-blue-200 font-extrabold border border-blue-400/40'
                                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                                    }`}
                                >
                                  <span className={`material-symbols-outlined text-base ${isSubActive ? 'text-blue-300' : 'text-slate-500'}`}>
                                    {sub.icon}
                                  </span>
                                  <span>{sub.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                      </div>
                    );
                  })}

                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Footer & Account Summary */}
        <div className="p-3 border-t border-slate-800/80 bg-[#070e1b] space-y-2">

          {/* Logged in User Card */}
          {currentUser && isAuthenticated && (
            <div className="p-2.5 bg-[#101e34] border border-slate-700/60 rounded-xl flex items-center justify-between gap-2.5 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center shrink-0 border border-slate-600">
                  {currentUser.nomComplet.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-white truncate leading-tight">{currentUser.nomComplet}</p>
                  <p className="text-[10px] text-blue-400 font-mono font-bold leading-tight">{currentUser.role}</p>
                </div>
              </div>

              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Compte Actif / En Ligne"></span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-1 text-slate-400 text-xs font-medium">
            {isAuthenticated ? (
              <button
                onClick={() => {
                  if (onLogout) onLogout();
                  if (onClose) onClose();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:text-white hover:bg-rose-950/60 transition-all border border-rose-900/30 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                <span className="font-bold">Se Déconnecter</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (onOpenLogin) onOpenLogin();
                  if (onClose) onClose();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-blue-400 hover:text-white hover:bg-blue-950/60 transition-all border border-blue-900/30 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">login</span>
                <span className="font-bold">Se Connecter</span>
              </button>
            )}
          </div>
        </div>

      </aside>
    </>
  );
};
