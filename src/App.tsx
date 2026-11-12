import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useSharedList, useVessels, useEscales, useBls, useInvoices, revalidateLists } from './hooks/useData';
import { currentRoute, routeToUrl, routeTitle, isSamePage, HomeView } from './navigation/routes';
import { ConnectionBanner } from './components/common/ConnectionBanner';
import { ToastContainer, toastError, toastWarning } from './components/common/Toast';
import {
  INITIAL_USERS,
  INITIAL_ESCALES,
  INITIAL_BLS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_FNE_PARAMS,
  INITIAL_AUDIT_LOGS,
  INITIAL_INVOICE_TYPE_CONFIGS,
  INITIAL_RUBRIQUE_CONFIGS,
  INITIAL_TIMBRE_BRACKETS
} from './data/initialData';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { AuthModal } from './components/common/AuthModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ProfileModal } from './components/auth/ProfileModal';
import { isTabAllowed, usePermissionsSync, fetchPermissionsMatrix } from './utils/permissions';
import {
  InvoiceTypeConfig,
  RubriqueConfig,
  User,
  Escale,
  BL,
  DraftExport,
  Invoice,
  CreditNote,
  Payment,
  FneParam,
  AuditLog,
  Vessel,
  TimbreBracket,
  TaxeAdditionnelleConfig
} from './types';
import {
  loadTaxeAdditionnelleConfig,
  saveTaxeAdditionnelleConfig,
  applyTaxeAdditionnelleToInvoice,
  getTaxeAdditionnelleValeurLabel
} from './utils/taxeAdditionnelle';
import { applyTimbreFiscalToInvoice } from './utils/timbreFiscal';
import { useDialogFocus } from './hooks/useDialogFocus';
import { snapshotContenuDraft } from './utils/draftDiff';
import {
  formatInvoiceNumber,
  invoiceNumberForDuplicate,
  invoiceNumberWithStatut,
  isDefinitiveInvoiceNumber
} from './utils/invoiceNumber';
import { SESSION_EXPIRED_EVENT, logoutOnServer } from './utils/sessionGuard';

// Modules métier chargés à la première ouverture : le démarrage ne paie que
// l'accueil et le cockpit.
const VesselTrackingModule = lazy(() => import('./pages/VesselTrackingModule').then((m) => ({ default: m.VesselTrackingModule })));
const VesselsModule = lazy(() => import('./pages/VesselsModule').then((m) => ({ default: m.VesselsModule })));
const ImportModule = lazy(() => import('./pages/ImportModule').then((m) => ({ default: m.ImportModule })));
const ExportModule = lazy(() => import('./pages/ExportModule').then((m) => ({ default: m.ExportModule })));
const FacturationModule = lazy(() => import('./pages/FacturationModule').then((m) => ({ default: m.FacturationModule })));
const SurestarieModule = lazy(() => import('./pages/SurestarieModule').then((m) => ({ default: m.SurestarieModule })));
const AdminModule = lazy(() => import('./pages/AdminModule').then((m) => ({ default: m.AdminModule })));
const ParametrageModule = lazy(() => import('./pages/ParametrageModule').then((m) => ({ default: m.ParametrageModule })));

const ModuleLoading = () => (
  <p role="status" className="mt-16 text-center text-sm font-medium text-text-muted">Chargement du module…</p>
);

export function App() {
  // Global Application & Auth State
  const [allUsers, setAllUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const saved = localStorage.getItem('bocs_session_user');
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return INITIAL_USERS[0];
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  // Au rechargement (F5), la session enregistrée est revérifiée auprès du serveur
  // avant d'afficher quoi que ce soit : pas de passage par l'écran de connexion.
  const [sessionChecking, setSessionChecking] = useState<boolean>(() => {
    try { return !!localStorage.getItem('bocs_session_user'); } catch { return false; }
  });
  // Page demandée par l'adresse à l'ouverture (lien, favori, F5) : rejointe après connexion.
  const requestedRouteRef = useRef(currentRoute());
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [profileTab, setProfileTab] = useState<'profile' | 'password' | 'security'>('profile');
  // Onglet du paramétrage des factures demandé depuis la page Paramétrage.
  const [invoiceConfigTab, setInvoiceConfigTab] = useState<'TYPES' | 'TAXE' | 'TIMBRE' | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<NavTab>(() => currentRoute().tab);
  // La demande ne vaut que pour l'ouverture : en quittant l'écran, il reprend son onglet par défaut.
  useEffect(() => {
    if (activeTab !== 'facturation_config') setInvoiceConfigTab(undefined);
  }, [activeTab]);
  const [showWelcome, setShowWelcome] = useState<boolean>(() => currentRoute().home);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [selectedBlIdForBilling, setSelectedBlIdForBilling] = useState<number | null>(() => currentRoute().blId ?? null);
  // Vue de l'espace Plan du jour : le plan, le registre des escales ou la création d'escale.
  const [homeView, setHomeView] = useState<HomeView>(() => currentRoute().homeView ?? 'welcome');

  // Une seule porte pour créer une escale, et une seule pour la recherche : de partout.
  const goHome = (view: HomeView) => {
    setActiveTab('dashboard');
    setShowWelcome(true);
    setHomeView(view);
  };
  const openCreateEscale = () => goHome('create-escale');
  const openSearch = () => {
    goHome('escales');
    window.setTimeout(() => document.getElementById('welcome-search-input')?.focus(), 80);
  };

  // ── Adresse du navigateur ⇄ page affichée ────────────────────────────────
  // Chaque navigation écrit son adresse (Précédent / Suivant, F5, favoris, liens) ;
  // Précédent / Suivant relisent l'adresse et réaffichent la page correspondante.
  useEffect(() => {
    if (!isAuthenticated) return; // l'adresse demandée est conservée jusqu'à la connexion
    const route = { home: showWelcome || activeTab === 'dashboard', tab: activeTab, blId: selectedBlIdForBilling ?? undefined, homeView };
    const url = routeToUrl(route);
    document.title = routeTitle(route);
    const here = window.location.pathname + window.location.search;
    if (url === here) return;
    // Même page écrite autrement (ex. /export → /export/drafts) : on corrige sans ajouter d'étape.
    if (routeToUrl(currentRoute()) === url) window.history.replaceState(null, '', url);
    else {
      window.history.pushState(null, '', url);
      window.scrollTo(0, 0);
    }
  }, [isAuthenticated, showWelcome, activeTab, selectedBlIdForBilling, homeView]);

  // Quitter l'espace Plan du jour remet sa vue par défaut (le plan).
  useEffect(() => {
    if (!showWelcome && activeTab !== 'dashboard') setHomeView('welcome');
  }, [showWelcome, activeTab]);

  useEffect(() => {
    const onHistory = () => {
      const route = currentRoute();
      setShowWelcome(route.home);
      setActiveTab(route.home ? 'dashboard' : route.tab);
      setSelectedBlIdForBilling(route.blId ?? null);
      setHomeView(route.homeView ?? 'welcome');
    };
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);

  // Un sous-onglet choisi dans un module devient la page courante (adresse, menu actif).
  const handleSubPageChange = (tab: NavTab) => setActiveTab(prev => (isSamePage(prev, tab) ? prev : tab));

  // Serveur injoignable : on le dit, plutôt que d'afficher des listes vides.
  const { isError: escalesLoadError } = useEscales();
  const { isError: blsLoadError } = useBls();
  const { isError: invoicesLoadError } = useInvoices();
  const serverUnreachable = isAuthenticated && [escalesLoadError, blsLoadError, invoicesLoadError]
    .some(err => err && err.status !== 401 && err.status !== 403);
  const retryLoading = () => {
    void revalidateLists('/api/vessels', '/api/escales', '/api/bls', '/api/invoices', '/api/payments', '/api/drafts', '/api/credit-notes');
  };

  // RBAC : force le re-rendu lorsque la matrice des droits est sauvegardée/réinitialisée
  usePermissionsSync();
  useDialogFocus(); // focus des modales (role="dialog")

  useEffect(() => {
    fetchPermissionsMatrix();
  }, []);

  // Persistence en Base LocalStorage avec déduplication automatique
  // Listes métier : cache partagé avec tous les modules (hooks/useData) — une
  // modification faite ici est visible partout sans rafraîchir la page.
  const [vessels, setVessels] = useSharedList('/api/vessels');
  const { isLoading: vesselsLoading, isError: vesselsLoadError } = useVessels();

  const [escales, setEscales] = useSharedList('/api/escales');

  const [bls, setBls] = useSharedList('/api/bls');

  // Drafts export : persistés en base Neon (100% cloud) — plus de stockage local seul.
  const [drafts, setDrafts] = useSharedList('/api/drafts');



  const [invoices, setInvoices] = useSharedList('/api/invoices');

  const [creditNotes, setCreditNotes] = useSharedList('/api/credit-notes');

  const [payments, setPayments] = useSharedList('/api/payments');

  const [fneParams, setFneParams] = useState<FneParam[]>(INITIAL_FNE_PARAMS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [exchangeRateUsd, setExchangeRateUsd] = useState<number>(600.00);
  const [invoiceTypeConfigs, setInvoiceTypeConfigs] = useState<InvoiceTypeConfig[]>(() => {
    const saved = localStorage.getItem('bocs_invoice_types');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { console.error('Erreur chargement invoice_types local', e); }
    }
    return INITIAL_INVOICE_TYPE_CONFIGS;
  });

  const [rubriqueConfigs, setRubriqueConfigs] = useState<RubriqueConfig[]>(() => {
    const saved = localStorage.getItem('bocs_rubriques');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { console.error('Erreur chargement rubriques local', e); }
    }
    return INITIAL_RUBRIQUE_CONFIGS;
  });

  const [timbreBrackets, setTimbreBrackets] = useState<TimbreBracket[]>(() => {
    const saved = localStorage.getItem('bocs_timbre_brackets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { console.error('Erreur chargement timbre_brackets local', e); }
    }
    return INITIAL_TIMBRE_BRACKETS;
  });

  // ── Taxe additionnelle exceptionnelle (assiette : montant TTC) ──
  // Valeur modifiable à tout moment par la comptabilité (onglet Configuration Factures).
  const [taxeAdditionnelleConfig, setTaxeAdditionnelleConfig] = useState<TaxeAdditionnelleConfig>(
    () => loadTaxeAdditionnelleConfig()
  );

  // Sauvegarde automatique en temps réel dans localStorage
  useEffect(() => {
    localStorage.setItem('bocs_timbre_brackets', JSON.stringify(timbreBrackets));
  }, [timbreBrackets]);

  useEffect(() => {
    saveTaxeAdditionnelleConfig(taxeAdditionnelleConfig);
  }, [taxeAdditionnelleConfig]);

  useEffect(() => {
    localStorage.setItem('bocs_invoice_types', JSON.stringify(invoiceTypeConfigs));
  }, [invoiceTypeConfigs]);

  useEffect(() => {
    localStorage.setItem('bocs_rubriques', JSON.stringify(rubriqueConfigs));
  }, [rubriqueConfigs]);

  const handleUpdateTimbreBrackets = (brackets: TimbreBracket[]) => {
    setTimbreBrackets(brackets);
    logAuditAction('MISE_A_JOUR_TIMBRE', 'CONFIG', 'Modification des tranches de timbre fiscal');
  };

  // Mise à jour de la taxe additionnelle (valeur, mode, périmètre, activation)
  const handleUpdateTaxeAdditionnelle = (config: TaxeAdditionnelleConfig) => {
    const previous = taxeAdditionnelleConfig;
    setTaxeAdditionnelleConfig(config);
    logAuditAction(
      'MISE_A_JOUR_TAXE_ADDITIONNELLE',
      'CONFIG',
      `Taxe additionnelle « ${config.libelle} » : ${config.estActif ? 'ACTIVE' : 'INACTIVE'} — ${getTaxeAdditionnelleValeurLabel(config.mode, config.valeur)} ` +
      `(périmètre : Import ${config.appliquerImport ? 'oui' : 'non'} / Export ${config.appliquerExport ? 'oui' : 'non'}) — ` +
      `ancienne valeur : ${getTaxeAdditionnelleValeurLabel(previous.mode, previous.valeur)}`
    );
  };

  // Chargement des données une fois connecté : l'API exige une session (cookie) et
  // répond 401 avant la connexion. Les listes partagées sont rechargées à chaque connexion.
  useEffect(() => {
    if (!isAuthenticated) return;
    void revalidateLists('/api/vessels', '/api/escales', '/api/bls', '/api/invoices', '/api/payments', '/api/drafts', '/api/credit-notes');
    const initAndLoad = async () => {
      try {
        // 1. Initialise les tables si nécessaire
        // await fetch('/api/init-db');

        // 2. Charge les factures, avoirs, utilisateurs et données
        // Escales, BL, factures, règlements, drafts et avoirs sont chargés par le cache partagé (hooks/useData).
        const [auditRes, configsRes, usersRes] = await Promise.all([
          fetch('/api/audit').catch(() => null),
          fetch('/api/configs').catch(() => null),
          fetch('/api/users').catch(() => null)
        ]);

        if (usersRes && usersRes.ok) {
          const uData = await usersRes.json();
          if (uData.success && uData.users && uData.users.length > 0) {
            setAllUsers(uData.users);
            const savedSession = localStorage.getItem('bocs_session_user');
            if (savedSession) {
              try {
                const parsed = JSON.parse(savedSession);
                const matched = uData.users.find((u: User) => u.id === parsed.id || u.email.toLowerCase() === parsed.email.toLowerCase());
                if (matched) {
                  setCurrentUser(matched);
                  localStorage.setItem('bocs_session_user', JSON.stringify(matched));
                }
              } catch (e) { }
            }
          }
        }

        if (auditRes && auditRes.ok) {
          const auditData = await auditRes.json();
          if (auditData.success && auditData.auditLogs) {
            setAuditLogs(auditData.auditLogs);
          }
        }

        if (configsRes && configsRes.ok) {
          const configsData = await configsRes.json();
          if (configsData.success) {
            if (configsData.types && configsData.types.length > 0) {
              setInvoiceTypeConfigs(configsData.types);
            }
            if (configsData.rubriques && configsData.rubriques.length > 0) {
              setRubriqueConfigs(configsData.rubriques);
            }
          }
        }
      } catch (e) {
        console.error("Erreur lors de la synchronisation avec Neon", e);
      }
    };
    initAndLoad();
  }, [isAuthenticated]);

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Helper for Audit Logging
  const logAuditAction = async (action: string, entite: string, details: string) => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const newLog: AuditLog = {
      id: Date.now(),
      utilisateurNom: currentUser.nomComplet,
      role: currentUser.role,
      action,
      entite,
      details,
      dateAction: formattedDate,
      ip: ''
    };
    setAuditLogs(prev => [newLog, ...prev]);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
      const data = await res.json();
      if (data?.ip) {
        setAuditLogs(prev => prev.map(l => l.id === newLog.id ? { ...l, ip: data.ip } : l));
      }
    } catch (e) {
      console.error("Erreur lors de la sauvegarde du log d'audit sur Neon", e);
    }
  };

  // --- USER & AUTHENTICATION HANDLERS ---

  // Après connexion (ou reprise de session) : la page demandée par l'adresse si le
  // profil y a droit, sinon le Plan du jour.
  const openRequestedPage = (user: User) => {
    const requested = requestedRouteRef.current;
    requestedRouteRef.current = { home: true, tab: 'dashboard' };
    if (!requested.home && isTabAllowed(user, requested.tab)) {
      setActiveTab(requested.tab);
      setSelectedBlIdForBilling(requested.blId ?? null);
      setShowWelcome(false);
      return;
    }
    setActiveTab('dashboard');
    setShowWelcome(true);
    setHomeView(requested.home ? requested.homeView ?? 'welcome' : 'welcome');
  };

  // Reprise de la session au rechargement : le cookie serveur fait foi.
  useEffect(() => {
    if (!sessionChecking) return;
    let cancelled = false;
    const resume = (user: User) => {
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('bocs_session_user', JSON.stringify(user));
      openRequestedPage(user);
    };
    const resumeLocalInDev = () => {
      // Développement avec vite seul (pas d'API) : la session enregistrée suffit.
      if (!import.meta.env.DEV) return;
      try {
        const saved = localStorage.getItem('bocs_session_user');
        if (saved) resume(JSON.parse(saved));
      } catch { /* session illisible : écran de connexion */ }
    };
    (async () => {
      try {
        const res = await fetch('/api/users?session');
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.success && data.user) resume(data.user);
        else if (res.status === 401) localStorage.removeItem('bocs_session_user');
        else resumeLocalInDev();
      } catch {
        if (!cancelled) resumeLocalInDev();
      } finally {
        if (!cancelled) setSessionChecking(false);
      }
    })();
    return () => { cancelled = true; };
    // Une seule vérification, au chargement de l'application.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Login handler
  const handleLoginSuccess = (user: User) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updatedUser = { ...user, dernierAcces: now };
    setAllUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    setIsAuthenticated(true);
    openRequestedPage(user);
    setAuthModalOpen(false);
    localStorage.setItem('bocs_session_user', JSON.stringify(updatedUser));
    logAuditAction('CONNEXION_REUSSIE', 'Session', `Connexion de ${user.nomComplet} (${user.role})`);
  };

  // Logout handler
  const handleLogout = () => {
    logAuditAction('DECONNEXION', 'Session', `Déconnexion de l'utilisateur ${currentUser.nomComplet}`);
    setIsAuthenticated(false);
    setShowWelcome(false); // Retour à l'écran de connexion
    localStorage.removeItem('bocs_session_user');
    // La personne suivante démarre sur le Plan du jour, pas sur la dernière page ouverte.
    window.history.replaceState(null, '', '/');
    document.title = 'BOCS';
    void logoutOnServer();
  };

  // Session expirée côté serveur (cookie absent ou périmé) : retour à l'écran de connexion.
  useEffect(() => {
    const onExpired = () => {
      if (!localStorage.getItem('bocs_session_user')) return;
      localStorage.removeItem('bocs_session_user');
      // Après reconnexion, on revient sur la page où l'on travaillait.
      requestedRouteRef.current = currentRoute();
      setIsAuthenticated(false);
      setShowWelcome(false);
      toastWarning('Votre session a expiré : reconnectez-vous.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // Open Auth Modal
  const handleOpenAuthModal = (mode: 'login' | 'register' | 'forgot' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  // Register User (Client)
  const handleRegisterUser = async (newUser: User): Promise<boolean> => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (data.success && data.user) {
        setAllUsers(prev => [data.user, ...prev]);
        logAuditAction('INSCRIPTION_CLIENT', 'User', `Nouveau compte client ${newUser.nomComplet} (${newUser.email})`);
        return true;
      } else {
        toastError(data.error || 'Erreur lors de l\'inscription.');
        return false;
      }
    } catch (err: any) {
      setAllUsers(prev => [newUser, ...prev]);
      return true;
    }
  };

  // Update Profile
  const handleUpdateProfile = async (updatedUser: User): Promise<boolean> => {
    try {
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      });
    } catch (e) {
      console.error('Erreur mise à jour utilisateur sur Neon:', e);
    }
    setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    localStorage.setItem('bocs_session_user', JSON.stringify(updatedUser));
    logAuditAction('MISE_A_JOUR_PROFIL', 'User', `Mise à jour du profil de ${updatedUser.nomComplet}`);
    return true;
  };

  // Change Password
  const handleChangePassword = async (userId: number, currentPass: string, newPass: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          action: 'change_password',
          currentPassword: currentPass,
          newPassword: newPass
        })
      });
      const data = await res.json();
      if (!data.success) {
        toastError(data.error || 'Erreur lors du changement de mot de passe.');
        return false;
      }
    } catch (e) {
      console.error('Erreur changement mot de passe sur Neon:', e);
    }
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, motDePasse: newPass } : u));
    if (currentUser.id === userId) {
      const updated = { ...currentUser, motDePasse: newPass };
      setCurrentUser(updated);
      localStorage.setItem('bocs_session_user', JSON.stringify(updated));
    }
    logAuditAction('CHANGEMENT_MOT_DE_PASSE', 'User', `Mot de passe modifié pour utilisateur #${userId}`);
    return true;
  };

  // Add User (Admin)
  const handleAddUser = async (newUser: User) => {
    setAllUsers(prev => [newUser, ...prev]);
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
    } catch (e) {
      console.error('Erreur création utilisateur sur Neon:', e);
    }
    logAuditAction('CREATION_UTILISATEUR', 'User', `Création du compte ${newUser.nomComplet} (${newUser.role})`);
  };

  // Update User (Admin)
  const handleUpdateUser = async (updatedUser: User) => {
    setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    if (currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      localStorage.setItem('bocs_session_user', JSON.stringify(updatedUser));
    }
    try {
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      });
    } catch (e) {
      console.error('Erreur mise à jour utilisateur sur Neon:', e);
    }
    logAuditAction('MODIFICATION_UTILISATEUR', 'User', `Mise à jour des informations pour ${updatedUser.nomComplet}`);
  };

  // Delete User
  const handleDeleteUser = async (userId: number) => {
    const target = allUsers.find(u => u.id === userId);
    setAllUsers(prev => prev.filter(u => u.id !== userId));
    await deleteOnServer(`/api/users?id=${userId}`, "l'utilisateur", []);
    logAuditAction('SUPPRESSION_UTILISATEUR', 'User', `Suppression du compte #${userId} (${target?.nomComplet || 'Inconnu'})`);
  };

  // Toggle User Active Status
  const handleToggleUserStatus = async (userId: number) => {
    const target = allUsers.find(u => u.id === userId);
    if (!target) return;
    const nextStatus = !target.estActif;
    const updated = { ...target, estActif: nextStatus };
    setAllUsers(prev => prev.map(u => u.id === userId ? updated : u));
    try {
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.error('Erreur statut utilisateur sur Neon:', e);
    }
    logAuditAction('STATUS_UTILISATEUR_MUTATION', 'User', `Compte ${target.nomComplet} (${target.role}) basculé vers ${nextStatus ? 'ACTIF' : 'INACTIF'}`);
  };

  // Reset User Password
  const handleResetUserPassword = async (userId: number, tempPass: string) => {
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, motDePasse: tempPass } : u));
    const target = allUsers.find(u => u.id === userId);
    try {
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, motDePasse: tempPass })
      });
    } catch (e) {
      console.error('Erreur réinitialisation mot de passe sur Neon:', e);
    }
    logAuditAction('REINITIALISATION_MOT_DE_PASSE', 'User', `Mot de passe temporaire généré pour ${target?.nomComplet}`);
  };

  // --- BUSINESS DOMAIN HANDLERS ---

  const postJson = async (url: string, body: unknown) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || `Erreur serveur (${response.status})`);
    }
    return result;
  };

  /**
   * Suppression côté serveur après retrait immédiat à l'écran. Puis rechargement des
   * listes touchées (suppressions en cascade) : en cas d'échec, la ligne réapparaît
   * avec un message, au lieu de rester masquée alors qu'elle existe encore en base.
   */
  const deleteOnServer = async (url: string, label: string, affected: Parameters<typeof revalidateLists>) => {
    try {
      const response = await fetch(url, { method: 'DELETE' });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || `Erreur serveur (${response.status})`);
      }
    } catch (e) {
      console.error(`Erreur lors de la suppression de ${label} en base`, e);
      toastError(`Impossible de supprimer ${label} : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
    } finally {
      await revalidateLists(...affected);
    }
  };

  // ── Navires : registre partagé en base (/api/vessels) ──
  const sameVesselName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  /** Enregistre un navire (création ou modification) puis recharge la liste ; en cas d'échec, l'écran revient à l'état de la base. */
  const saveVessel = async (vessel: Vessel, action: string) => {
    try {
      await postJson('/api/vessels', vessel);
    } catch (e) {
      console.error(`Erreur lors de ${action} du navire`, e);
      toastError(`Le navire ${vessel.nom} n'a pas été enregistré : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
    } finally {
      await revalidateLists('/api/vessels');
    }
  };

  const handleAddVessel = (vessel: Vessel) => {
    if (vessels.some(v => sameVesselName(v.nom, vessel.nom))) return;
    setVessels(prev => [vessel, ...prev]);
    logAuditAction('CRÉATION_NAVIRE', 'VESSEL', vessel.nom);
    void saveVessel(vessel, 'la création');
  };

  const handleDeleteVessel = (vesselId: number) => {
    const target = vessels.find(v => v.id === vesselId);
    setVessels(prev => prev.filter(v => v.id !== vesselId));
    logAuditAction('SUPPRESSION_NAVIRE', 'VESSEL', target ? `${target.nom} (ID: ${vesselId})` : `ID: ${vesselId}`);
    void deleteOnServer(`/api/vessels?id=${vesselId}`, `le navire ${target?.nom ?? vesselId}`, ['/api/vessels']);
  };

  const handleUpdateVessel = (updated: Vessel) => {
    setVessels(prev => prev.map(v => (v.id === updated.id ? updated : v)));
    logAuditAction('MODIFICATION_NAVIRE', 'VESSEL', `${updated.nom} (ID: ${updated.id})`);
    void saveVessel(updated, 'la modification');
  };

  // Reprise unique des navires saisis avant le passage en base (localStorage `bocs_vessels`) :
  // ceux absents de la base (comparaison par nom) y sont envoyés, puis la clé locale est retirée.
  const vesselsMigrated = useRef(false);
  useEffect(() => {
    if (vesselsLoading || vesselsLoadError || vesselsMigrated.current) return;
    vesselsMigrated.current = true;
    const saved = localStorage.getItem('bocs_vessels');
    if (!saved) return;
    let local: Vessel[] = [];
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) local = parsed.filter((v): v is Vessel => typeof v?.nom === 'string' && v.nom.trim() !== '');
    } catch (e) { console.error('Navires locaux illisibles', e); }
    const missing = local.filter((v, i) =>
      !vessels.some(s => sameVesselName(s.nom, v.nom)) && local.findIndex(o => sameVesselName(o.nom, v.nom)) === i
    );
    if (missing.length === 0) {
      localStorage.removeItem('bocs_vessels');
      return;
    }
    // Sans id : les id locaux (1, 2…) pourraient désigner un autre navire en base.
    void Promise.allSettled(missing.map(({ id: _localId, ...v }) => postJson('/api/vessels', v))).then(async results => {
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) localStorage.removeItem('bocs_vessels');
      else toastError(`${failed} navire(s) local(aux) n'ont pas pu être enregistrés en base ; nouvel essai au prochain chargement.`);
      await revalidateLists('/api/vessels');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vesselsLoading, vesselsLoadError]);

  // Add Escale
  const handleAddEscale = async (escale: Escale) => {
    try {
      const result = await postJson('/api/escales', escale);
      const savedEscale = (result.escale || escale) as Escale;
      setEscales(prev => [
        savedEscale,
        ...prev.filter(e => e.id !== savedEscale.id && (e.numeroVoyage !== savedEscale.numeroVoyage || e.nomNavire.trim().toLowerCase() !== savedEscale.nomNavire.trim().toLowerCase()))
      ]);
    } catch (e) {
      console.error("Erreur lors de la sauvegarde de l'escale", e);
      toastError(`L'escale n'a pas été enregistrée : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
    }
  };

  // Update Escale
  const handleUpdateEscale = async (updatedEscale: Escale) => {
    try {
      const result = await postJson('/api/escales', updatedEscale);
      const savedEscale = (result.escale || updatedEscale) as Escale;
      setEscales(prev => prev.map(e => e.id === updatedEscale.id ? savedEscale : e));
      logAuditAction('MODIFICATION_ESCALE', 'Escale', `Mise à jour des informations de l'escale ${updatedEscale.nomNavire} (Voyage ${updatedEscale.numeroVoyage})`);
    } catch (e) {
      console.error("Erreur lors de la mise à jour de l'escale sur Neon", e);
      toastError(`La modification n'a pas été enregistrée : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
    }
  };

  // Import XML Manifest
  const handleImportManifest = async (escale: Escale, newBls: BL[]) => {
    try {
      const result = await postJson('/api/escales', escale);
      const savedEscale = (result.escale || escale) as Escale;
      const savedBls = newBls.map(bl => ({ ...bl, escaleId: savedEscale.id }));
      await postJson('/api/bls', { bls: savedBls });
      setEscales(prev => [
        savedEscale,
        ...prev.filter(e => e.id !== savedEscale.id && (e.numeroVoyage !== savedEscale.numeroVoyage || e.nomNavire.trim().toLowerCase() !== savedEscale.nomNavire.trim().toLowerCase()))
      ]);
      setBls(prev => {
        const newBlNums = new Set(savedBls.map(b => b.numeroBL));
        return [...savedBls, ...prev.filter(b => !newBlNums.has(b.numeroBL))];
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde du manifeste importé", e);
      toastError(`Le manifeste n'a pas été enregistré : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
    }
  };

  // Delete Escale and all associated XML BLs, Invoices, Proformas and Payments
  const handleDeleteEscaleIntegration = async (escaleId: number) => {
    const targetEscale = escales.find(e => e.id === escaleId);
    const targetBls = bls.filter(b => b.escaleId === escaleId);
    const targetBlIds = targetBls.map(b => b.id);
    const targetBlNumbers = targetBls.map(b => b.numeroBL);

    // Identify all invoices/proformas linked to any of the deleted BLs
    const targetInvoices = invoices.filter(inv =>
      (inv.blId !== undefined && targetBlIds.includes(inv.blId)) ||
      (inv.numeroBL !== undefined && targetBlNumbers.includes(inv.numeroBL)) ||
      (inv.escaleInfo && targetEscale && (inv.escaleInfo.includes(targetEscale.numeroVoyage) || inv.escaleInfo.includes(targetEscale.nomNavire)))
    );
    const targetInvoiceIds = targetInvoices.map(inv => inv.id);

    if (currentUser.role !== 'ADMIN' && targetInvoices.length > 0) {
      toastError("Seul l'administrateur est autorisé à supprimer une escale comportant des proformas ou factures éditées.");
      return;
    }

    // Filter state
    setEscales(prev => prev.filter(e => e.id !== escaleId));
    setBls(prev => prev.filter(b => b.escaleId !== escaleId));
    setInvoices(prev => prev.filter(inv =>
      !(inv.blId !== undefined && targetBlIds.includes(inv.blId)) &&
      !(inv.numeroBL !== undefined && targetBlNumbers.includes(inv.numeroBL))
    ));
    setPayments(prev => prev.filter(p => !targetInvoiceIds.includes(p.factureId)));

    logAuditAction(
      'SUPPRESSION_ESCALE',
      'Escale',
      `Suppression de l'escale ${targetEscale?.nomNavire || escaleId}, ses ${targetBls.length} BLs et ses ${targetInvoices.length} facture(s)/proforma(s) rattachée(s)`
    );

    await deleteOnServer(`/api/escales?id=${escaleId}`, "l'escale", ['/api/escales', '/api/bls', '/api/invoices', '/api/payments', '/api/credit-notes']);
  };

  // Persistance cloud d'un draft export (upsert Neon via /api/drafts)
  const persistDraft = async (draft: DraftExport) => {
    try {
      await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde du draft sur Neon", e);
    }
  };

  // Add Export Draft
  const handleAddDraft = (draft: DraftExport) => {
    setDrafts(prev => [draft, ...prev.filter(d => d.id !== draft.id)]);
    void persistDraft(draft);
  };

  // Update Draft Status
  const handleUpdateDraftStatus = (draftId: number, status: any, motif?: string, blNumber?: string) => {
    const target = drafts.find(d => d.id === draftId);
    if (!target) return;
    // Déverrouillage pour correction : on capture l'instantané du contenu AVANT
    // toute modification client (base du diff coloré ajoutés/conservés).
    const needsSnapshot = status === 'CORRECTION_AUTORISEE' && !target.contenuOriginal;
    const updatedDraft: DraftExport = {
      ...target,
      statut: status,
      motifDemandeModification: motif || target.motifDemandeModification,
      numeroBlGenere: blNumber || target.numeroBlGenere,
      dateValidation: status === 'VALIDE' ? new Date().toISOString() : target.dateValidation,
      ...(needsSnapshot ? { contenuOriginal: snapshotContenuDraft(target) } : {})
    };
    setDrafts(prev => prev.map(d => d.id === draftId ? updatedDraft : d));
    void persistDraft(updatedDraft);
  };

  // Update Full Draft
  const handleUpdateDraft = (updatedDraft: DraftExport) => {
    setDrafts(prev => prev.map(d => d.id === updatedDraft.id ? updatedDraft : d));
    void persistDraft(updatedDraft);
  };

  // Delete Export Draft (Admin only)
  const handleDeleteDraft = async (draftId: number) => {
    const target = drafts.find(d => d.id === draftId);
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    await deleteOnServer(`/api/drafts?id=${draftId}`, 'le draft', ['/api/drafts']);
    logAuditAction('SUPPRESSION_DRAFT', 'DraftExport', `Suppression du draft ${target?.numeroDraft || draftId} (${target?.clientNom || ''})`);
  };

  // Generate Invoice
  const handleGenerateInvoice = async (invoice: Invoice) => {
    // Taxe additionnelle exceptionnelle (assiette : TTC) puis timbre fiscal d'État
    // (assiette : HT, par tranches) — appliqués ici, au point de passage unique de
    // toutes les émissions (BL Import/Export, DMDT, amendements Export).
    const withTaxe = applyTaxeAdditionnelleToInvoice(invoice, taxeAdditionnelleConfig);
    const finalInvoice = applyTimbreFiscalToInvoice(withTaxe, timbreBrackets);
    setInvoices(prev => [finalInvoice, ...prev]);
    setBls(prev => prev.map(b => b.numeroBL === finalInvoice.numeroBL ? { ...b, statutImport: 'FACTURE' } : b));
    try {
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalInvoice)
      });

      const targetBl = bls.find(b => b.numeroBL === finalInvoice.numeroBL);
      if (targetBl) {
        const updatedBl = { ...targetBl, statutImport: 'FACTURE' as const };
        await fetch('/api/bls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedBl)
        });
      }
    } catch (e) {
      console.error("Erreur lors de la sauvegarde de la facture sur Neon", e);
    }
  };

  // Update Invoice
  const handleUpdateInvoice = async (invoice: Invoice) => {
    // La taxe additionnelle est recalculée sur le TTC de base (idempotent),
    // puis le timbre fiscal est recalculé sur le HT selon les tranches courantes.
    const withTaxe = applyTaxeAdditionnelleToInvoice(invoice, taxeAdditionnelleConfig);
    const finalInvoice = applyTimbreFiscalToInvoice(withTaxe, timbreBrackets);
    setInvoices(prev => prev.map(inv => inv.id === finalInvoice.id ? finalInvoice : inv));
    try {
      await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalInvoice)
      });
    } catch (e) {
      console.error("Erreur lors de la mise à jour de la facture sur Neon", e);
    }
  };

  const handleUpdateBl = async (updatedBl: BL) => {
    setBls(prev => prev.map(b => b.id === updatedBl.id ? updatedBl : b));
    try {
      await fetch('/api/bls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBl)
      });
    } catch (e) {
      console.error("Erreur lors de la mise à jour du BL en base", e);
    }
  };

  const handleClearAllData = async () => {
    localStorage.removeItem('bocs_escales');
    localStorage.removeItem('bocs_bls');
    localStorage.removeItem('bocs_drafts');
    localStorage.removeItem('bocs_invoices');
    localStorage.removeItem('bocs_payments');
    localStorage.removeItem('bocs_audit_logs');
    localStorage.removeItem('bocs_bl_planned_invoices');

    setEscales([]);
    setBls([]);
    setDrafts([]);
    setInvoices([]);
    setPayments([]);
    setAuditLogs([]);

    try {
      await fetch('/api/clear-db?mode=purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'bocs-admin-secure-2026'
        },
        body: JSON.stringify({ mode: 'purge' })
      });
    } catch (e) {
      console.error('Erreur purge DB', e);
    }
  };

  // Add Payment — le règlement n'attribue JAMAIS le numéro FA- ni la VALIDEE :
  // seule handleValidateInvoice prononce la validation explicite (Comptabilité/Admin).
  const handleAddPayment = async (payment: Payment) => {
    let updatedInvoice: Invoice | null = null;

    const targetInvoice = invoices.find(inv => inv.id === payment.factureId);
    if (targetInvoice) {
      const newSolde = Math.max(0, targetInvoice.soldeDuFcfa - payment.montantFcfa);
      const newStatus = newSolde === 0 ? 'PAYE' : 'PARTIEL';

      updatedInvoice = {
        ...targetInvoice,
        soldeDuFcfa: newSolde,
        statutPaiement: newStatus,
      };
    }

    if (updatedInvoice) {
      setInvoices(prev => prev.map(inv => inv.id === payment.factureId ? updatedInvoice! : inv));
    }

    const finalPayment = {
      ...payment,
      numeroFacture: payment.numeroFacture
    };
    setPayments(prev => [finalPayment, ...prev]);

    try {
      // 1. Save payment
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayment)
      });

      // 2. Save updated invoice
      if (updatedInvoice) {
        await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedInvoice)
        });
      }
    } catch (e) {
      console.error("Erreur lors de l'enregistrement du règlement sur Neon", e);
    }
  };

  // Validation officielle d'une facture (passage de BROUILLON à VALIDEE avec numéro officiel)
  const handleValidateInvoice = async (invoiceId: number) => {
    const target = invoices.find(inv => inv.id === invoiceId);
    if (!target) return;

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    let numeroFacture = target.numeroFacture;
    let typeFacture = target.typeFacture;

    if (!isDefinitiveInvoiceNumber(numeroFacture) || target.statutFacture !== 'VALIDEE') {
      // PF… devient FA… : seul le statut change, le reste de la référence est conservé.
      // Une ancienne référence est reconstruite au nouveau format.
      numeroFacture = invoiceNumberWithStatut(target, 'FA', invoices, {
        bls, escales, vessels, invoiceTypeConfigs
      });

      if (typeFacture === 'PROFORMA_IMPORT') typeFacture = 'DEFINITIVE_IMPORT';
      if (typeFacture === 'PROFORMA_EXPORT') typeFacture = 'DEFINITIVE_EXPORT';
    }

    const updatedInvoice: Invoice = {
      ...target,
      numeroFacture,
      typeFacture,
      statutFacture: 'VALIDEE',
      validatedBy: currentUser.nomComplet,
      validatedAt: now
    };

    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? updatedInvoice : inv));

    logAuditAction(
      'VALIDATION_OFFICIELLE_FACTURE',
      'Invoice',
      `Facture #${target.id} validée et émise sous le numéro officiel ${numeroFacture} par ${currentUser.nomComplet}`
    );

    try {
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedInvoice)
      });
    } catch (e) {
      console.error("Erreur lors de la validation de la facture sur Neon", e);
    }
  };

  // Émission d'un Avoir (Annulation conforme d'une facture validée)
  const handleGenerateCreditNote = async (creditNote: CreditNote) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    setCreditNotes(prev => [creditNote, ...prev]);

    // Update target invoice in state
    setInvoices(prev => prev.map(inv => {
      if (inv.id === creditNote.factureId) {
        return {
          ...inv,
          statutFacture: 'ANNULEE',
          motifAnnulation: creditNote.motif,
          avoirId: creditNote.id,
          cancelledAt: now,
          soldeDuFcfa: 0
        };
      }
      return inv;
    }));

    logAuditAction(
      'EMISSION_AVOIR_ANNULATION',
      'CreditNote',
      `Émission de l'Avoir ${creditNote.numeroAvoir} annulant la facture ${creditNote.numeroFactureOrigine} (${creditNote.montantTtcFcfa.toLocaleString()} FCFA). Motif: ${creditNote.motif}`
    );

    try {
      await fetch('/api/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creditNote)
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde de l'avoir sur Neon", e);
    }
  };

  // Duplication / Reprise d'une facture (crée un nouveau Brouillon modifiable)
  const handleDuplicateInvoice = async (originalInvoice: Invoice) => {
    const newId = Date.now();
    const dateToday = new Date().toISOString().split('T')[0];

    // Nouvelle proforma de la même facture : même référence, rang suivant (…-2).
    const newInvoiceNumber = invoiceNumberForDuplicate(originalInvoice, invoices, {
      bls, escales, vessels, invoiceTypeConfigs
    });

    const newInvoice: Invoice = applyTaxeAdditionnelleToInvoice({
      ...originalInvoice,
      id: newId,
      numeroFacture: newInvoiceNumber,
      statutFacture: 'BROUILLON',
      statutPaiement: 'NON_PAYE',
      soldeDuFcfa: originalInvoice.montantTtcFcfa,
      dateFacture: dateToday,
      dateEcheance: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      factureOrigineId: originalInvoice.id,
      avoirId: undefined,
      motifAnnulation: undefined,
      cancelledAt: undefined,
      validatedAt: undefined,
      validatedBy: undefined,
      createdBy: currentUser.nomComplet,
      typeFacture: originalInvoice.typeFacture.startsWith('DEFINITIVE_')
        ? (originalInvoice.typeFacture.replace('DEFINITIVE_', 'PROFORMA_') as any)
        : originalInvoice.typeFacture,
      lignes: (originalInvoice.lignes || []).map((line, idx) => ({
        ...line,
        id: idx + 1
      }))
    }, taxeAdditionnelleConfig);

    setInvoices(prev => [newInvoice, ...prev]);

    logAuditAction(
      'REPRISE_DUPLICATION_FACTURE',
      'Invoice',
      `Reprise/Duplication de la facture ${originalInvoice.numeroFacture} vers le nouveau brouillon ${newInvoiceNumber}`
    );

    try {
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInvoice)
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde du brouillon dupliqué sur Neon", e);
    }
  };

  // Suppression autorisée uniquement sur un Brouillon / Proforma non réglé (avec suppression en cascade des pièces rattachées)
  const handleDeleteInvoice = async (invoiceId: number) => {
    const target = invoices.find(i => i.id === invoiceId);
    if (!target) return;

    const hasPayment = target.soldeDuFcfa === 0 ||
      target.statutPaiement === 'PAYE' ||
      target.statutPaiement === 'PARTIEL';
    const isProforma = !isDefinitiveInvoiceNumber(target.numeroFacture) &&
      target.statutFacture !== 'VALIDEE' &&
      target.statutFacture !== 'ANNULEE' &&
      target.statutFacture !== 'AVOIR' &&
      !hasPayment;

    if (!isProforma) {
      toastError(`Conformité fiscale : La facture ${formatInvoiceNumber(target.numeroFacture)} est inaltérable. Veuillez émettre un Avoir pour l'annuler.`);
      return;
    }

    // 1. Supprimer la facture
    setInvoices(prev => prev.filter(i => i.id !== invoiceId));

    // 2. Supprimer en cascade tous les paiements rattachés
    setPayments(prev => prev.filter(p => p.factureId !== invoiceId && p.numeroFacture !== target.numeroFacture));

    // 3. Supprimer en cascade toutes les notes d'avoir rattachées
    setCreditNotes(prev => prev.filter(cn => cn.factureId !== invoiceId && cn.numeroFactureOrigine !== target.numeroFacture));

    // 4. Si aucun autre facture n'existe pour le BL lié, réinitialiser le statut du BL à EN_ATTENTE
    if (target.blId || target.numeroBL) {
      setBls(prev => prev.map(b => {
        const isTargetBl = (target.blId && b.id === target.blId) || (target.numeroBL && b.numeroBL === target.numeroBL);
        if (!isTargetBl) return b;
        const otherInvoices = invoices.filter(inv => inv.id !== invoiceId && ((inv.blId && inv.blId === b.id) || (inv.numeroBL && inv.numeroBL === b.numeroBL)));
        if (otherInvoices.length === 0) {
          return {
            ...b,
            statutImport: 'EN_ATTENTE',
            cachetAgentAppose: false,
            dateSignature: undefined,
            hashSignature: undefined
          };
        }
        return b;
      }));
    }

    logAuditAction(
      'SUPPRESSION_PROFORMA',
      'Invoice',
      `Suppression de la proforma ${target.numeroFacture} (#${target.id}) et de toutes les pièces rattachées (lignes, paiements, avoirs)`
    );

    await deleteOnServer(`/api/invoices?id=${invoiceId}`, 'la proforma', ['/api/invoices', '/api/payments', '/api/credit-notes', '/api/bls']);
  };

  // Configuration update handlers for Neon Postgres
  const handleUpdateInvoiceTypeConfigs = async (newConfigs: InvoiceTypeConfig[]) => {
    setInvoiceTypeConfigs(newConfigs);
    try {
      await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: newConfigs })
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde des types de factures sur Neon", e);
    }
  };

  const handleUpdateRubriqueConfigs = async (newRubriques: RubriqueConfig[]) => {
    setRubriqueConfigs(newRubriques);
    try {
      await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rubriques: newRubriques })
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde des rubriques sur Neon", e);
    }
  };

  const handleUpdateAllConfigs = async (newTypes: InvoiceTypeConfig[], newRubriques: RubriqueConfig[]) => {
    setInvoiceTypeConfigs(newTypes);
    setRubriqueConfigs(newRubriques);
    try {
      await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: newTypes, rubriques: newRubriques })
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde complète des configurations sur Neon", e);
    }
  };

  const handleDeleteInvoiceTypeConfig = async (typeId: string) => {
    const updatedTypes = invoiceTypeConfigs.filter(t => t.id !== typeId);
    const updatedRubriques = rubriqueConfigs.filter(r => r.invoiceTypeId !== typeId);
    setInvoiceTypeConfigs(updatedTypes);
    setRubriqueConfigs(updatedRubriques);
    await deleteOnServer(`/api/configs?typeId=${typeId}`, 'le type de facture', []);
  };

  // Update FNE Param
  const handleUpdateFneParam = (cle: string, valeur: string) => {
    setFneParams(prev => prev.map(p => p.cle === cle ? { ...p, valeur, updatedAt: new Date().toISOString().split('T')[0] } : p));
  };

  // ─── Porte 1 : Authentification requise ───────────────────────────────
  if (sessionChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--deck-ground)]">
        <p role="status" className="text-sm font-medium text-text-muted">Reprise de votre session…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen
          allUsers={allUsers}
          onLoginSuccess={handleLoginSuccess}
          onRegisterUser={handleRegisterUser}
        />
        <ToastContainer />
      </>
    );
  }

  // ─── Un seul en-tête, sur le Plan du jour comme dans les modules ─
  const navigateFromHeader = (tab: NavTab) => {
    if (tab === 'dashboard') { goHome('welcome'); return; }
    if (!isTabAllowed(currentUser, tab)) {
      toastError('Accès refusé : votre profil ne dispose pas de l\'habilitation requise pour ce module.');
      return;
    }
    setShowWelcome(false);
    setActiveTab(tab);
  };
  const appHeader = (
    <Header
      currentUser={currentUser}
      isAuthenticated={isAuthenticated}
      exchangeRateUsd={exchangeRateUsd}
      onLogout={handleLogout}
      onSearch={openSearch}
      hasOpenReceivables={invoices.some(inv => (inv.soldeDuFcfa || 0) > 0)}
      onOpenLogin={() => handleOpenAuthModal('login')}
      onOpenProfile={() => { setProfileTab('profile'); setShowProfileModal(true); }}
      activeTab={showWelcome ? 'dashboard' : activeTab}
      onTabChange={navigateFromHeader}
      counts={{
        escalesCount: escales.length,
        blsCount: bls.length,
        draftsCount: drafts.length,
        facturesCount: invoices.length
      }}
    />
  );

  // ─── Porte 2 : Plan du jour (après connexion) ─
  if (showWelcome || activeTab === 'dashboard') {
    return (
      <>
        {serverUnreachable && <ConnectionBanner onRetry={retryLoading} />}
        {appHeader}
        <WelcomeScreen
        view={homeView}
        onViewChange={setHomeView}
        escales={escales}
        bls={bls}
        invoices={invoices}
        drafts={drafts}
        invoiceTypeConfigs={invoiceTypeConfigs}
        rubriqueConfigs={rubriqueConfigs}
        exchangeRateUsd={exchangeRateUsd}
        userRole={currentUser.role}
        currentUser={currentUser}
        onOpenProfile={() => { setProfileTab('profile'); setShowProfileModal(true); }}
        onLogout={handleLogout}
        onEnter={(targetTab, targetBlId) => {
          // RBAC : refus immédiat si l'habilitation requise est absente de la matrice des droits
          if (targetTab && !isTabAllowed(currentUser, targetTab)) {
            toastError('Accès refusé : votre profil ne dispose pas de l\'habilitation requise pour ce module.');
            return;
          }
          setShowWelcome(false);
          if (targetBlId) {
            setSelectedBlIdForBilling(targetBlId);
          }
          if (targetTab) {
            setActiveTab(targetTab);
          }
        }}
        onImportManifest={handleImportManifest}
        onUpdateEscale={handleUpdateEscale}
        onAddEscale={handleAddEscale}
        onUpdateBl={handleUpdateBl}
        onGenerateInvoice={handleGenerateInvoice}
        onUpdateInvoice={handleUpdateInvoice}
        onValidateInvoice={handleValidateInvoice}
        onDeleteInvoice={handleDeleteInvoice}
        onDeleteEscale={handleDeleteEscaleIntegration}
        onAddPayment={handleAddPayment}
        onLogAudit={logAuditAction}
        timbreBrackets={timbreBrackets}
        vessels={vessels}
        onAddVessel={handleAddVessel}
        onUpdateVessel={handleUpdateVessel}
      />
        {/* Notifications globales (toasts succès/erreur également sur la plateforme) */}
        <ToastContainer />
      </>
    );
  }

  // RBAC : contrôle d'accès effectif au module demandé (matrice des habilitations)
  const accessDenied = !isTabAllowed(currentUser, activeTab);

  return (
    <div className="min-h-screen bg-[#eaeff4] dark:bg-night-canvas flex flex-col font-sans text-slate-900 dark:text-night-ink antialiased">

      {serverUnreachable && <ConnectionBanner onRetry={retryLoading} />}

      {appHeader}

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-[1996px] mx-auto w-full">

        {/* Content Main Panel */}
        <main className="flex-grow p-4 md:p-6 overflow-y-auto w-full">
          <Suspense fallback={<ModuleLoading />}>

          {/* RBAC : écran de refus lorsque l'habilitation requise est absente de la matrice */}
          {accessDenied && (
            <div className="max-w-lg mx-auto mt-12 bg-white dark:bg-night-surface border border-rose-200 rounded-2xl p-8 text-center shadow-sm dark:shadow-black/30 animate-fade-in">
              <span aria-hidden="true" className="material-symbols-outlined text-5xl text-rose-500 block mb-3">lock</span>
              <h2 className="text-xl font-black text-zinc-900 dark:text-night-ink mb-1">Accès refusé</h2>
              <p className="text-sm text-zinc-600 dark:text-night-ink font-medium leading-relaxed">
                Votre profil <span className="font-black text-[#005DAA] dark:text-night-ink font-mono">{currentUser.role}</span> ne dispose pas de
                l'habilitation requise pour ce module. Contactez l'administrateur ou ajustez la matrice des droits.
              </p>
            </div>
          )}

          {!accessDenied && activeTab === 'vessels' && (
            <VesselTrackingModule





              onAddVessel={handleAddVessel}
              onDeleteVessel={handleDeleteVessel}
              onUpdateVessel={handleUpdateVessel}
              userRole={currentUser.role}
              onAddEscale={handleAddEscale}
              onImportManifest={handleImportManifest}
              onDeleteEscale={handleDeleteEscaleIntegration}
              onNavigateTab={setActiveTab}
              onRequestCreateEscale={openCreateEscale}
            />
          )}

          {!accessDenied && activeTab === 'navires' && (
            <VesselsModule
              onAddVessel={handleAddVessel}
              onUpdateVessel={handleUpdateVessel}
              onDeleteVessel={handleDeleteVessel}
            />
          )}

          {!accessDenied && activeTab === 'import' && (
            <ImportModule
              onAddVessel={handleAddVessel}
              onUpdateVessel={handleUpdateVessel}
              onAddEscale={handleAddEscale}
              onImportManifest={handleImportManifest}
              onDeleteEscaleIntegration={handleDeleteEscaleIntegration}
              onRequestCreateEscale={openCreateEscale}
              onGenerateInvoice={handleGenerateInvoice}
              onUpdateInvoice={handleUpdateInvoice}
              onLogAudit={logAuditAction}
              userRole={currentUser.role}
              rubriqueConfigs={rubriqueConfigs}
              invoiceTypeConfigs={invoiceTypeConfigs}

              onUpdateBl={handleUpdateBl}
              onNavigateToBilling={(bl) => {
                setSelectedBlIdForBilling(bl.id);
                setActiveTab('facturation');
              }}
            />
          )}

          {!accessDenied && (activeTab === 'export' || activeTab === 'export_saisie' || activeTab === 'export_list' || activeTab === 'export_consolidation') && (
            <ExportModule
              initialSubTab={
                activeTab === 'export_saisie' ? 'SAISIE_DRAFT' :
                  activeTab === 'export_list' ? 'ESPACE_CLIENT' :
                    activeTab === 'export_consolidation' ? 'CONSOLIDATION' : 'ESPACE_CLIENT'
              }


              currentUser={currentUser}
              onSubTabChange={sub => handleSubPageChange(({
                SAISIE_DRAFT: 'export_saisie', ESPACE_CLIENT: 'export_list', CONSOLIDATION: 'export_consolidation',
              } as const)[sub])}
              onAddDraft={handleAddDraft}
              onUpdateDraft={handleUpdateDraft}
              onUpdateDraftStatus={handleUpdateDraftStatus}
              onDeleteDraft={handleDeleteDraft}
              onGenerateInvoice={handleGenerateInvoice}
              onLogAudit={logAuditAction}
              userRole={currentUser.role}
            />
          )}

          {!accessDenied && (activeTab === 'facturation' || activeTab === 'facturation_journal' || activeTab === 'facturation_tarifs' || activeTab === 'facturation_balance' || activeTab === 'facturation_config' || activeTab === 'facturation_avoirs') && (
            <FacturationModule
              initialConfigSubTab={invoiceConfigTab}
              initialSubTab={
                activeTab === 'facturation_journal' ? 'PROFORMA' :
                  activeTab === 'facturation_tarifs' ? 'TARIFS' :
                    activeTab === 'facturation_balance' ? 'BALANCE_AGEE' :
                      activeTab === 'facturation_config' ? 'CONFIG' :
                        activeTab === 'facturation_avoirs' ? 'AVOIRS' : 'FACTURATION_BL'
              }






              selectedBlId={selectedBlIdForBilling}
              onSelectBl={setSelectedBlIdForBilling}
              onSubTabChange={sub => handleSubPageChange(({
                FACTURATION_BL: 'facturation', PROFORMA: 'facturation_journal', AVOIRS: 'facturation_avoirs',
                TARIFS: 'facturation_tarifs', BALANCE_AGEE: 'facturation_balance', CONFIG: 'facturation_config',
              } as const)[sub])}
              onNavigateToImport={() => setActiveTab('import')}
              onAddPayment={handleAddPayment}
              onValidateInvoice={handleValidateInvoice}
              onUpdateInvoice={handleUpdateInvoice}
              onGenerateCreditNote={handleGenerateCreditNote}
              onDuplicateInvoice={handleDuplicateInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              exchangeRateUsd={exchangeRateUsd}
              onLogAudit={logAuditAction}
              userRole={currentUser.role}
              currentUser={currentUser}
              invoiceTypeConfigs={invoiceTypeConfigs}
              onUpdateInvoiceTypeConfigs={handleUpdateInvoiceTypeConfigs}
              rubriqueConfigs={rubriqueConfigs}
              onUpdateRubriqueConfigs={handleUpdateRubriqueConfigs}
              onUpdateAllConfigs={handleUpdateAllConfigs}
              onDeleteInvoiceTypeConfig={handleDeleteInvoiceTypeConfig}
              onGenerateInvoice={handleGenerateInvoice}
              onUpdateBl={handleUpdateBl}
              timbreBrackets={timbreBrackets}
              onUpdateTimbreBrackets={handleUpdateTimbreBrackets}
              taxeAdditionnelleConfig={taxeAdditionnelleConfig}
              onUpdateTaxeAdditionnelle={handleUpdateTaxeAdditionnelle}
            />
          )}

          {!accessDenied && activeTab === 'surestarie' && (
            <SurestarieModule



              invoiceTypeConfigs={invoiceTypeConfigs}
              userRole={currentUser.role}
              onGenerateInvoice={handleGenerateInvoice}
              onAddPayment={handleAddPayment}
              onLogAudit={logAuditAction}
            />
          )}

          {!accessDenied && activeTab === 'parametrage' && (
            <ParametrageModule
              currentUser={currentUser}
              exchangeRateUsd={exchangeRateUsd}
              onUpdateExchangeRate={setExchangeRateUsd}
              onNavigate={(tab, configTab) => {
                setInvoiceConfigTab(configTab);
                setActiveTab(tab);
              }}
              onOpenProfile={tab => {
                setProfileTab(tab);
                setShowProfileModal(true);
              }}
            />
          )}

          {!accessDenied && (activeTab === 'admin' || activeTab === 'admin_users' || activeTab === 'admin_rights' || activeTab === 'admin_fne' || activeTab === 'admin_audit') && (
            <AdminModule
              initialTab={
                activeTab === 'admin_rights' ? 'RIGHTS' :
                  activeTab === 'admin_fne' ? 'FNE' :
                    activeTab === 'admin_audit' ? 'AUDIT' : 'USERS'
              }
              // Resynchronise la navigation globale (Sidebar / Header / URL de
              // sous-menu) avec l'onglet réellement sélectionné dans la console.
              onTabChange={tab => setActiveTab(
                tab === 'RIGHTS' ? 'admin_rights' :
                  tab === 'FNE' ? 'admin_fne' :
                    tab === 'AUDIT' ? 'admin_audit' : 'admin_users'
              )}
              allUsers={allUsers}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onToggleUserStatus={handleToggleUserStatus}
              onResetUserPassword={handleResetUserPassword}
              fneParams={fneParams}
              onUpdateFneParam={handleUpdateFneParam}
              auditLogs={auditLogs}
              exchangeRateUsd={exchangeRateUsd}
              onLogAudit={logAuditAction}
              userRole={currentUser.role}
              currentUser={currentUser}
              onClearAllData={handleClearAllData}
            />
          )}

          </Suspense>
        </main>

      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        initialTab={profileTab}
        onClose={() => setShowProfileModal(false)}
        currentUser={currentUser}
        onUpdateProfile={handleUpdateProfile}
        onChangePassword={handleChangePassword}
      />

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          if (isAuthenticated) setAuthModalOpen(false);
        }}
        initialMode={authModalMode}
        allUsers={allUsers}
        onLoginSuccess={handleLoginSuccess}
        onAddUser={handleAddUser}
      />

      {/* Global Toast Notifications */}
      <ToastContainer />

    </div>
  );
}
