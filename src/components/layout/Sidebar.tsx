import React, { useState } from 'react';
import { BocsLogo } from "../BocsLogo";
import { User, UserRole } from '../../types';
import { isTabAllowed, usePermissionsSync } from '../../utils/permissions';
import { useEscapeClose } from '../../hooks/useEscapeClose';

export type NavTab =
  | 'dashboard'
  | 'vessels'
  | 'navires'
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

  // Audit UX : fermeture clavier du drawer mobile via Échap.
  useEscapeClose(isOpen, onClose);

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
          id: 'vessels',
          label: 'Navires & Escales',
          icon: 'directions_boat',
          colorClass: 'text-emerald-500 hover:text-emerald-400'
        },
        {
          id: 'navires',
          label: 'Registre des Navires',
          icon: 'sailing',
          colorClass: 'text-emerald-500 hover:text-emerald-400'
        },
        {
          id: 'import',
          label: 'Registre Import',
          icon: 'file_download',
          badge: counts.blsCount > 0 ? counts.blsCount : null,
          colorClass: 'text-indigo-400 hover:text-indigo-300'
        },
        {
          id: 'export',
          label: 'Exportation',
          icon: 'file_upload',
          badge: counts.draftsCount > 0 ? counts.draftsCount : null,
          colorClass: 'text-amber-500 hover:text-amber-400',
          subItems: [
            { id: 'export_saisie', label: 'Saisie Draft BL', icon: 'edit_note' },
            { id: 'export_list', label: 'Drafts Clients', icon: 'folder_open' },
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
          label: 'Facturation & Caisse',
          icon: 'point_of_sale',
          badge: counts.facturesCount > 0 ? counts.facturesCount : null,
          colorClass: 'text-blue-400 hover:text-blue-300',
          subItems: [
            { id: 'facturation', label: 'Nouvelle Facture', icon: 'add_card' },
            { id: 'facturation_journal', label: 'Journal des Factures', icon: 'receipt_long' },
            { id: 'facturation_avoirs', label: 'Avoirs & Crédits', icon: 'assignment_return' },
            { id: 'facturation_balance', label: 'Balance Client', icon: 'account_balance' }
          ]
        },
        {
          id: 'surestarie',
          label: 'Surestaries & Tarifs',
          icon: 'timer',
          colorClass: 'text-purple-400 hover:text-purple-300',
          subItems: [
            { id: 'surestarie', label: 'Calcul Surestaries', icon: 'calculate' },
            { id: 'facturation_tarifs', label: 'Grille Tarifaire', icon: 'payments' },
            { id: 'facturation_config', label: 'Configuration Rubriques', icon: 'settings' }
          ]
        }
      ]
    },
    {
      title: 'ADMINISTRATION',
      items: [
        {
          id: 'admin',
          label: 'Console Admin',
          icon: 'shield_person',
          colorClass: 'text-rose-500 hover:text-rose-400',
          subItems: [
            { id: 'admin_users', label: 'Utilisateurs', icon: 'group' },
            { id: 'admin_rights', label: 'Habilitations', icon: 'security' },
            { id: 'admin_fne', label: 'Paramètres Généraux', icon: 'tune' },
            { id: 'admin_audit', label: 'Journal d\'Audit', icon: 'history' }
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
              <BocsLogo className="w-full h-auto max-h-11" />
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
                  <div className="px-3 py-1 text-xs font-black uppercase text-slate-400 tracking-wider font-mono">
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
                            <span aria-hidden="true" className={`material-symbols-outlined text-lg ${isMainActive
                                ? 'text-white'
                                : item.colorClass ? '' : 'text-slate-400'
                              }`}>
                              {item.icon}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span>{item.label}</span>
                              {item.glassBadge && (
                                <span className="text-2xs font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                                  {item.glassBadge}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {item.badge !== null && item.badge !== undefined && (
                              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isMainActive
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
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isSubActive
                                      ? 'bg-[#005daa]/40 text-blue-200 font-extrabold border border-blue-400/40'
                                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                                    }`}
                                >
                                  <span aria-hidden="true" className={`material-symbols-outlined text-base ${isSubActive ? 'text-blue-300' : 'text-slate-500'}`}>
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
                  <p className="text-xs text-blue-400 font-mono font-bold leading-tight">{currentUser.role}</p>
                </div>
              </div>

              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" title="Compte Actif / En Ligne"></span>
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
                <span aria-hidden="true" className="material-symbols-outlined text-base">logout</span>
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
                <span aria-hidden="true" className="material-symbols-outlined text-base">login</span>
                <span className="font-bold">Se Connecter</span>
              </button>
            )}
          </div>
        </div>

      </aside>
    </>
  );
};
