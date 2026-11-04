import { NavTab } from '../components/layout/Sidebar';

/**
 * Plan de navigation unique : mêmes pages, mêmes libellés, même ordre dans le menu
 * mobile que dans la barre de navigation des grands écrans. Tout ce qui se règle
 * (tarifs DMDT, paramètres de facture, comptes, FNE, audit) passe par Paramétrage.
 */
export interface NavItem {
  tab: NavTab;
  label: string;
  /** Nom d'icône Material Symbols. */
  icon: string;
}

export interface NavSection {
  /** Titre de groupe (absent pour les pages de premier niveau). */
  label?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { tab: 'dashboard', label: 'Plan du jour', icon: 'grid_view' },
      { tab: 'vessels', label: 'Escales & Radar', icon: 'radar' },
      { tab: 'navires', label: 'Navires', icon: 'sailing' },
    ],
  },
  {
    label: 'Facturation',
    items: [
      { tab: 'facturation', label: 'Facturation BL par BL', icon: 'credit_card' },
      { tab: 'facturation_journal', label: 'Journal des factures', icon: 'receipt_long' },
      { tab: 'facturation_avoirs', label: "Notes d'avoir & crédits", icon: 'assignment_return' },
      { tab: 'surestarie', label: 'Surestaries & détentions', icon: 'timer' },
      { tab: 'facturation_balance', label: 'Balance client', icon: 'account_balance' },
    ],
  },
  {
    label: 'Exportation',
    items: [
      { tab: 'export_saisie', label: 'Saisie draft BL', icon: 'edit_note' },
      { tab: 'export_list', label: 'Espace client / drafts', icon: 'folder_open' },
      { tab: 'export_consolidation', label: 'Consolidation manifeste', icon: 'inventory' },
    ],
  },
  {
    items: [{ tab: 'parametrage', label: 'Paramétrage', icon: 'settings' }],
  },
];
