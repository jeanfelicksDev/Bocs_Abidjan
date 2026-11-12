import React from 'react';
import { LogOut, X } from 'lucide-react';
import { User } from '../../types';
import { NavTab } from './Sidebar';
import { BocsLogo } from '../BocsLogo';
import { ThemeSwitcher } from '../common/ThemeSwitcher';
import { NAV_SECTIONS } from '../../navigation/navItems';
import { isSamePage } from '../../navigation/routes';
import { isTabAllowed, usePermissionsSync } from '../../utils/permissions';
import { useEscapeClose } from '../../hooks/useEscapeClose';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  currentUser: User;
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  onLogout?: () => void;
}

/** Un groupe n'apparaît que si le profil a accès au module qui le porte. */
const SECTION_ACCESS: Record<string, NavTab> = {
  Facturation: 'facturation',
  Exportation: 'export',
  Administration: 'admin',
};

/**
 * Menu des petits écrans (sous 1 280 px), identique sur le Plan du jour et dans
 * les modules : toutes les pages autorisées, sous-pages comprises, sans menu caché.
 */
export const MobileNav: React.FC<MobileNavProps> = ({ open, onClose, currentUser, activeTab, onNavigate, onLogout }) => {
  usePermissionsSync();
  useEscapeClose(open, onClose, { menu: true });
  if (!open) return null;

  const allowed = (tab: NavTab) => isTabAllowed(currentUser, tab);
  const go = (tab: NavTab) => { onNavigate(tab); onClose(); };
  const initials = currentUser.nomComplet.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex xl:hidden">
      <div className="fixed inset-0 bg-slate-950/60" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xs h-full bg-surface-base text-text-primary flex flex-col shadow-[var(--elevation-4)] animate-slide-in-right">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border-default">
          <BocsLogo className="h-8 w-auto" />
          <ThemeSwitcher />
          <button type="button" onClick={onClose} aria-label="Fermer le menu" className="p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-sunken cursor-pointer">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {NAV_SECTIONS.map((section, i) => {
            const gate = section.label ? SECTION_ACCESS[section.label] : undefined;
            if (gate && !allowed(gate)) return null;
            const items = section.items.filter(item => allowed(item.tab));
            if (items.length === 0) return null;
            return (
              <div key={section.label ?? `top-${i}`}>
                {section.label && (
                  <p className="px-3 pb-1 text-2xs font-bold uppercase tracking-wider text-text-muted">{section.label}</p>
                )}
                <ul className="space-y-0.5">
                  {items.map(item => {
                    const current = isSamePage(item.tab, activeTab);
                    return (
                      <li key={item.tab}>
                        <button
                          type="button"
                          onClick={() => go(item.tab)}
                          aria-current={current ? 'page' : undefined}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold text-left cursor-pointer transition-colors ${
                            current ? 'bg-[color:var(--state-todo-bg)] text-[color:var(--state-todo-ink)] font-bold' : 'hover:bg-surface-sunken'
                          }`}
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-lg">{item.icon}</span>
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-border-default flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[#005DAA] text-white text-xs font-bold flex items-center justify-center shrink-0" aria-hidden="true">{initials}</span>
          <span className="flex-1 min-w-0 text-sm font-semibold truncate">{currentUser.nomComplet}</span>
          {onLogout && (
            <button type="button" onClick={() => { onClose(); onLogout(); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-[color:var(--state-late-ink)] border border-[color:var(--state-late-line)] hover:bg-[color:var(--state-late-bg)] cursor-pointer">
              <LogOut className="w-4 h-4" aria-hidden="true" /> Déconnexion
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
