import { NavTab } from '../components/layout/Sidebar';

/**
 * Plan de navigation unique : mêmes pages, mêmes libellés, même ordre dans le menu
 * mobile que dans la barre de navigation des grands écrans.
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
      { tab: 'facturation_tarifs', label: 'Grille tarifs DMDT', icon: 'payments' },
      { tab: 'surestarie', label: 'Surestaries & détentions', icon: 'timer' },
      { tab: 'facturation_balance', label: 'Balance client', icon: 'account_balance' },
      { tab: 'facturation_config', label: 'Paramétrage factures', icon: 'settings' },
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
    label: 'Administration',
    items: [
      { tab: 'admin_users', label: 'Comptes utilisateurs', icon: 'manage_accounts' },
      { tab: 'admin_fne', label: 'Paramètres FNE DGI', icon: 'tune' },
      { tab: 'admin_audit', label: "Journal d'audit", icon: 'verified_user' },
    ],
  },
  {
    items: [{ tab: 'parametrage', label: 'Paramétrage', icon: 'settings' }],
  },
];
