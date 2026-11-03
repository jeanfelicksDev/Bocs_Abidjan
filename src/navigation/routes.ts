import { NavTab } from '../components/layout/Sidebar';

/**
 * Adresses de l'application : chaque page (et chaque sous-onglet) a une URL lisible.
 * Le bouton Précédent du navigateur, l'actualisation (F5), les favoris et les liens
 * envoyés à un collègue mènent ainsi à la même page.
 *
 * Les trois hébergements (vite, Vercel, serveur interne) renvoient index.html pour
 * toute adresse sans extension : aucune configuration serveur n'est nécessaire.
 */

export interface AppRoute {
  /** Page « Plan du jour » (accueil). */
  home: boolean;
  tab: NavTab;
  /** BL ouvert dans la facturation (`?bl=`). */
  blId?: number;
}

const TAB_PATHS: Record<NavTab, string> = {
  dashboard: '/',
  vessels: '/escales',
  navires: '/navires',
  import: '/import',
  export: '/export',
  export_saisie: '/export/saisie',
  export_list: '/export/drafts',
  export_consolidation: '/export/consolidation',
  facturation: '/facturation',
  facturation_journal: '/facturation/journal',
  facturation_avoirs: '/facturation/avoirs',
  facturation_tarifs: '/facturation/tarifs-dmdt',
  facturation_balance: '/facturation/balance',
  facturation_config: '/facturation/parametres',
  surestarie: '/surestaries',
  admin: '/administration',
  admin_users: '/administration/comptes',
  admin_rights: '/administration/habilitations',
  admin_fne: '/administration/fne',
  admin_audit: '/administration/audit',
  parametrage: '/parametrage',
};

const PATH_TABS = new Map<string, NavTab>(
  (Object.entries(TAB_PATHS) as [NavTab, string][]).map(([tab, path]) => [path, tab])
);

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'Plan du jour',
  vessels: 'Escales & radar',
  navires: 'Navires',
  import: 'Import & BL',
  export: 'Export',
  export_saisie: 'Saisie du draft',
  export_list: 'Drafts export',
  export_consolidation: 'Consolidation du manifeste',
  facturation: 'Facturation BL',
  facturation_journal: 'Journal des factures',
  facturation_avoirs: 'Avoirs',
  facturation_tarifs: 'Grille DMDT',
  facturation_balance: 'Balance client',
  facturation_config: 'Paramètres de facturation',
  surestarie: 'Surestaries',
  admin: 'Administration',
  admin_users: 'Comptes utilisateurs',
  admin_rights: 'Habilitations',
  admin_fne: 'FNE DGI',
  admin_audit: "Journal d'audit",
  parametrage: 'Paramétrage',
};

/** Pages qui affichent la même chose : passer de l'une à l'autre n'est pas une navigation. */
const SAME_PAGE: NavTab[][] = [
  ['export', 'export_list'],
  ['admin', 'admin_users'],
];

export const isSamePage = (a: NavTab, b: NavTab): boolean =>
  a === b || SAME_PAGE.some((group) => group.includes(a) && group.includes(b));

const HOME: AppRoute = { home: true, tab: 'dashboard' };

/** Lit une adresse ; une adresse inconnue mène au Plan du jour. */
export function parseRoute(pathname: string, search: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const tab = PATH_TABS.get(clean);
  if (!tab || tab === 'dashboard') return HOME;
  const bl = Number(new URLSearchParams(search).get('bl'));
  return { home: false, tab, blId: Number.isInteger(bl) && bl > 0 ? bl : undefined };
}

export function routeToUrl(route: AppRoute): string {
  if (route.home || route.tab === 'dashboard') return '/';
  const path = TAB_PATHS[route.tab] ?? '/';
  const withBl = route.blId && route.tab.startsWith('facturation') ? `?bl=${route.blId}` : '';
  return path + withBl;
}

export function routeTitle(route: AppRoute): string {
  const page = route.home ? TAB_TITLES.dashboard : TAB_TITLES[route.tab] ?? TAB_TITLES.dashboard;
  return `${page} · BOCS`;
}

export const currentRoute = (): AppRoute =>
  typeof window === 'undefined' ? HOME : parseRoute(window.location.pathname, window.location.search);
