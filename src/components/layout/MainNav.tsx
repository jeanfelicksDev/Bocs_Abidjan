import React, { useEffect, useRef, useState } from 'react';
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
  useEscapeClose(activeDropdown !== null, () => setActiveDropdown(null), { menu: true });
  usePermissionsSync();

  // ── Menus déroulants : survol (souris), clic (souris, toucher) et clavier ──
  // Ouvert au survol, il se referme quand la souris s'en va ; ouvert au clic ou au
  // clavier, il reste ouvert jusqu'au choix, à Échap ou à un clic ailleurs.
  const navRef = useRef<HTMLElement>(null);
  const openedBy = useRef<'hover' | 'click' | null>(null);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});

  const openMenu = (id: string, how: 'hover' | 'click') => {
    openedBy.current = how;
    setActiveDropdown(id);
  };
  const closeMenu = (focusTrigger?: string) => {
    openedBy.current = null;
    setActiveDropdown(null);
    if (focusTrigger) triggers.current[focusTrigger]?.focus();
  };
  const focusItem = (id: string, which: 'first' | 'last') => {
    requestAnimationFrame(() => {
      const items = document.querySelectorAll<HTMLElement>(`#nav-menu-${id} [role="menuitem"]`);
      items[which === 'first' ? 0 : items.length - 1]?.focus();
    });
  };

  useEffect(() => {
    if (!activeDropdown) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [activeDropdown]);

  const hoverProps = (id: string) => ({
    onMouseEnter: () => { if (activeDropdown !== id) openMenu(id, 'hover'); },
    onMouseLeave: () => { if (openedBy.current === 'hover') closeMenu(); },
  });

  const triggerProps = (id: string) => ({
    ref: (el: HTMLButtonElement | null) => { triggers.current[id] = el; },
    type: 'button' as const,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': activeDropdown === id,
    'aria-controls': `nav-menu-${id}`,
    onClick: () => {
      if (activeDropdown === id && openedBy.current === 'click') closeMenu();
      else openMenu(id, 'click');
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openMenu(id, 'click');
        focusItem(id, 'first');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu(id, 'click');
        focusItem(id, 'last');
      }
    },
  });

  const menuProps = (id: string) => ({
    id: `nav-menu-${id}`,
    role: 'menu' as const,
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
      const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
      const index = items.indexOf(document.activeElement as HTMLElement);
      const move = (to: number) => { e.preventDefault(); items[(to + items.length) % items.length]?.focus(); };
      if (e.key === 'ArrowDown') move(index + 1);
      else if (e.key === 'ArrowUp') move(index - 1);
      else if (e.key === 'Home') move(0);
      else if (e.key === 'End') move(items.length - 1);
      else if (e.key === 'Escape') { e.preventDefault(); closeMenu(id); }
      else if (e.key === 'Tab') closeMenu();
    },
  });

  const isAllowed = (tab: NavTab) => isTabAllowed(currentUser, tab);
  const isExportActive = ['export', 'export_saisie', 'export_list', 'export_consolidation'].includes(activeTab);
  const isFacturationActive = ['facturation', 'facturation_journal', 'facturation_avoirs', 'facturation_balance', 'surestarie'].includes(activeTab);
  // Tout ce qui se règle passe par Paramétrage : il reste allumé sur ces pages.
  const isSettingsActive = ['parametrage', 'admin', 'admin_users', 'admin_rights', 'admin_fne', 'admin_audit', 'facturation_config', 'facturation_tarifs'].includes(activeTab);

  return (
    <nav ref={navRef} aria-label="Navigation principale" className={`items-center gap-1.5 2xl:gap-2.5 ${className}`}>
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
            <span>Plan du jour</span>
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
            {...hoverProps('facturation')}
          >
            <button
              {...triggerProps('facturation')}
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
              <div {...menuProps('facturation')} className="absolute left-0 mt-1 w-64 bg-white border border-zinc-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in">
                {isAllowed('facturation') && (
                  <button
                    role="menuitem"
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
                    role="menuitem"
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
                    role="menuitem"
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
                {isAllowed('surestarie') && (
                  <button
                    role="menuitem"
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
                    role="menuitem"
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
              </div>
            )}
          </div>
        )}

        {/* 5. Exportation Dropdown */}
        {isAllowed('export') && (
          <div
            className="relative"
            {...hoverProps('export')}
          >
            <button
              {...triggerProps('export')}
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
              <div {...menuProps('export')} className="absolute left-0 mt-1 w-56 bg-white border border-zinc-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in">
                {isAllowed('export_saisie') && (
                  <button
                    role="menuitem"
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
                    role="menuitem"
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
                    role="menuitem"
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

        {/* 7. Paramétrage : tous les réglages de l'application */}
        {isAllowed('parametrage') && (
          <button
            onClick={() => onTabChange('parametrage')}
            className={`group whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98] ${isSettingsActive
                ? 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/40 shadow-xs font-black'
                : 'text-zinc-700 hover:text-black bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/10 hover:border-zinc-500/30'
              }`}
          >
            <span aria-hidden="true" className={`material-symbols-outlined text-lg transition-colors ${isSettingsActive ? 'text-[#005DAA]' : 'text-zinc-400 group-hover:text-black'
              }`}>settings</span>
            <span>Paramétrage</span>
          </button>
        )}
    </nav>
  );
};
