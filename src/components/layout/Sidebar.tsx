import React, { useState } from 'react';
import { User, UserRole } from '../../types';

export type NavTab = 
  | 'dashboard' 
  | 'vessels' 
  | 'import' 
  | 'export' 
  | 'export_saisie'
  | 'export_list'
  | 'export_consolidation'
  | 'facturation' 
  | 'facturation_tarifs'
  | 'facturation_balance'
  | 'facturation_config'
  | 'admin'
  | 'admin_users' 
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
    blsCount: number;
    draftsCount: number;
    facturesCount: number;
  };
}

interface NavSection {
  title: string;
  items: {
    id: NavTab;
    label: string;
    icon: string;
    badge?: number | string | null;
    glassBadge?: string;
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
  counts
}) => {
  // Collapsible accordion state for sub-menus
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    export: true,
    facturation: true,
    admin: true
  });

  const toggleSubMenu = (menuId: string) => {
    setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const isAllowed = (tab: NavTab) => {
    if (userRole === 'ADMIN') return true;
    if (userRole === 'AGENT_IMPORT') {
      return ['dashboard', 'vessels', 'import', 'facturation', 'facturation_tarifs'].includes(tab);
    }
    if (userRole === 'AGENT_EXPORT') {
      return ['dashboard', 'vessels', 'export', 'export_saisie', 'export_list', 'export_consolidation', 'facturation'].includes(tab);
    }
    if (userRole === 'COMPTABILITE') {
      return ['dashboard', 'facturation', 'facturation_tarifs', 'facturation_balance', 'facturation_config', 'import', 'export'].includes(tab);
    }
    if (userRole === 'CLIENT_EXPORT') {
      return ['dashboard', 'export', 'export_saisie', 'export_list'].includes(tab);
    }
    return true;
  };

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
          label: 'Fleet Radar & Escales',
          icon: 'radar',
          badge: 3
        },
        {
          id: 'import',
          label: 'Importation & Manifestes',
          icon: 'input',
          glassBadge: 'GUCE XML',
          badge: counts.blsCount > 0 ? counts.blsCount : null
        },
        {
          id: 'export',
          label: 'Exportation & Draft BL',
          icon: 'anchor',
          badge: counts.draftsCount > 0 ? counts.draftsCount : null,
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
          label: 'Billing & Factures FNE',
          icon: 'credit_card',
          badge: counts.facturesCount > 0 ? counts.facturesCount : null,
          subItems: [
            { id: 'facturation_tarifs', label: 'Tarifs Surestaries', icon: 'payments' },
            { id: 'facturation_balance', label: 'Balance Âgée Client', icon: 'account_balance' },
            { id: 'facturation_config', label: 'Configuration Factures', icon: 'settings' }
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
          subItems: [
            { id: 'admin_users', label: 'Comptes Utilisateurs', icon: 'manage_accounts' },
            { id: 'admin_fne', label: 'Params FNE & Devise', icon: 'tune' },
            { id: 'admin_audit', label: 'Journal d\'Audit', icon: 'verified_user' }
          ]
        }
      ]
    }
  ];

  return (
    <aside className="w-[270px] bg-[#0b172a] text-slate-300 flex flex-col justify-between shrink-0 h-screen sticky top-0 z-50 select-none border-r border-slate-800/80 overflow-y-auto">
      
      {/* Brand Header */}
      <div>
        <div className="p-5 pb-5 border-b border-slate-800/80 bg-[#070e1b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#005daa] flex items-center justify-center shadow-lg border border-blue-400/30">
              <span className="material-symbols-outlined text-white text-2xl">directions_boat</span>
            </div>
            <div>
              <h1 className="font-black text-base tracking-tight text-white leading-none font-heading">
                BOCS MARITIME
              </h1>
              <p className="text-[10px] text-blue-400 font-mono font-extrabold tracking-wider uppercase mt-1">
                FLEET & LOGISTICS V2.4
              </p>
            </div>
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
                  const isExpanded = expandedMenus[item.id] ?? false;

                  return (
                    <div key={item.id} className="space-y-0.5">
                      
                      {/* Main Navigation Item */}
                      <button
                        onClick={() => {
                          onTabChange(item.id);
                          if (item.subItems) toggleSubMenu(item.id);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 active:scale-[0.99] cursor-pointer ${
                          isMainActive
                            ? item.subItems
                              ? 'bg-[#ffe135] text-[#0f172a] shadow-md font-black border border-[#e5c122]'
                              : 'bg-[#005daa] text-white shadow-md font-extrabold'
                            : 'text-slate-400 hover:text-white hover:bg-[#13233c]/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`material-symbols-outlined text-lg ${
                            isMainActive
                              ? item.subItems ? 'text-[#0f172a]' : 'text-white'
                              : 'text-slate-400'
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
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              isMainActive
                                ? item.subItems ? 'bg-[#0f172a]/10 text-[#0f172a]' : 'bg-white/20 text-white'
                                : 'bg-[#152a48] text-blue-300'
                            }`}>
                              {item.badge}
                            </span>
                          )}

                          {item.subItems && (
                            <span className={`material-symbols-outlined text-sm ${
                              isMainActive && item.subItems ? 'text-[#0f172a]' : 'text-slate-400'
                            }`}>
                              {isExpanded ? 'expand_more' : 'chevron_right'}
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Sub-items accordion */}
                      {item.subItems && isExpanded && (
                        <div className="ml-5 pl-2 border-l border-slate-800 space-y-0.5 my-1">
                          {item.subItems.map((sub) => {
                            if (!isAllowed(sub.id)) return null;

                            const isSubActive = activeTab === sub.id;

                            return (
                              <button
                                key={sub.id}
                                onClick={() => onTabChange(sub.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                  isSubActive
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
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:text-white hover:bg-rose-950/60 transition-all border border-rose-900/30 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              <span className="font-bold">Se Déconnecter</span>
            </button>
          ) : (
            <button 
              onClick={onOpenLogin}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-blue-400 hover:text-white hover:bg-blue-950/60 transition-all border border-blue-900/30 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-base">login</span>
              <span className="font-bold">Se Connecter</span>
            </button>
          )}
        </div>
      </div>

    </aside>
  );
};
