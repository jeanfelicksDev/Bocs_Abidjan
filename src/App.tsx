import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ToastContainer, toastError } from './components/common/Toast';
import { 
  INITIAL_USERS, 
  INITIAL_ESCALES, 
  INITIAL_BLS, 
  INITIAL_DRAFTS_EXPORT, 
  INITIAL_INVOICES, 
  INITIAL_PAYMENTS, 
  INITIAL_FNE_PARAMS, 
  INITIAL_AUDIT_LOGS,
  INITIAL_INVOICE_TYPE_CONFIGS,
  INITIAL_RUBRIQUE_CONFIGS
} from './data/initialData';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { VesselTrackingModule } from './pages/VesselTrackingModule';
import { ImportModule } from './pages/ImportModule';
import { ExportModule } from './pages/ExportModule';
import { FacturationModule } from './pages/FacturationModule';
import { SurestarieModule } from './pages/SurestarieModule';
import { AdminModule } from './pages/AdminModule';
import { AuthModal } from './components/common/AuthModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ProfileModal } from './components/auth/ProfileModal';
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
  AuditLog 
} from './types';

export function App() {
  // Global Application & Auth State
  const [allUsers, setAllUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const saved = localStorage.getItem('bocs_session_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_USERS[0];
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [showWelcome, setShowWelcome] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [selectedBlIdForBilling, setSelectedBlIdForBilling] = useState<number | null>(null);

  // Persistence en Base LocalStorage avec déduplication automatique
  const [escales, setEscales] = useState<Escale[]>(() => {
    const saved = localStorage.getItem('bocs_escales');
    if (saved) {
      try { 
        const parsed: Escale[] = JSON.parse(saved);
        if (parsed.length > 0) {
          return parsed.reduce((acc: Escale[], current: Escale) => {
            const exists = acc.find(e => 
              e.id === current.id || 
              (e.nomNavire?.trim().toLowerCase() === current.nomNavire?.trim().toLowerCase() && 
               e.numeroVoyage?.trim() === current.numeroVoyage?.trim())
            );
            if (!exists) acc.push(current);
            return acc;
          }, []);
        }
      } catch (e) { console.error('Erreur chargement escales local', e); }
    }
    return [];
  });

  const [bls, setBls] = useState<BL[]>(() => {
    const saved = localStorage.getItem('bocs_bls');
    if (saved) {
      try { 
        const parsed: BL[] = JSON.parse(saved);
        if (parsed.length > 0) {
          return parsed.reduce((acc: BL[], current: BL) => {
            const exists = acc.find(b => b.id === current.id || (b.numeroBL === current.numeroBL && b.escaleId === current.escaleId));
            if (!exists) acc.push(current);
            return acc;
          }, []);
        }
      } catch (e) { console.error('Erreur chargement bls local', e); }
    }
    return [];
  });

  const [drafts, setDrafts] = useState<DraftExport[]>(() => {
    const saved = localStorage.getItem('bocs_drafts');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Erreur chargement drafts local', e); }
    }
    return INITIAL_DRAFTS_EXPORT;
  });

  const normalizeInvoice = (inv: Invoice): Invoice => {
    const soldeDuFcfa = Number(inv.soldeDuFcfa || 0);
    const montantTtcFcfa = Number(inv.montantTtcFcfa || 0);
    const isPaid = soldeDuFcfa === 0 || inv.statutPaiement === 'PAYE';
    const isDefinitive = Boolean(inv.numeroFacture && inv.numeroFacture.startsWith('FA-'));
    const isPartial = inv.statutPaiement === 'PARTIEL';
    let statutFacture = inv.statutFacture || 'BROUILLON';
    if (statutFacture !== 'ANNULEE' && statutFacture !== 'AVOIR' && (isPaid || isDefinitive || isPartial)) {
      statutFacture = 'VALIDEE';
    }
    return {
      ...inv,
      id: Number(inv.id),
      blId: inv.blId ? Number(inv.blId) : undefined,
      clientId: inv.clientId ? Number(inv.clientId) : undefined,
      tauxChangeUsd: Number(inv.tauxChangeUsd || 600),
      montantHtFcfa: Number(inv.montantHtFcfa || 0),
      tvaFcfa: Number(inv.tvaFcfa || 0),
      montantTtcFcfa,
      soldeDuFcfa,
      invoiceTypeId: inv.invoiceTypeId ? String(inv.invoiceTypeId) : undefined,
      statutFacture,
      lignes: (inv.lignes || []).map(line => ({
        ...line,
        id: line.id ? Number(line.id) : undefined,
        quantite: Number(line.quantite || 0),
        prixUnitaireFcfa: Number(line.prixUnitaireFcfa || 0),
        montantHtFcfa: Number(line.montantHtFcfa || 0),
        tauxTva: Number(line.tauxTva || 18)
      }))
    };
  };

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('bocs_invoices');
    if (saved) {
      try { 
        const parsed: Invoice[] = JSON.parse(saved);
        return parsed.map(normalizeInvoice);
      } catch (e) { console.error('Erreur chargement invoices local', e); }
    }
    return INITIAL_INVOICES.map(normalizeInvoice);
  });

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => {
    const saved = localStorage.getItem('bocs_credit_notes');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Erreur chargement credit_notes local', e); }
    }
    return [];
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    const saved = localStorage.getItem('bocs_payments');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Erreur chargement payments local', e); }
    }
    return INITIAL_PAYMENTS;
  });

  const [fneParams, setFneParams] = useState<FneParam[]>(INITIAL_FNE_PARAMS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('bocs_audit_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Erreur chargement audit_logs local', e); }
    }
    return INITIAL_AUDIT_LOGS;
  });

  const [exchangeRateUsd, setExchangeRateUsd] = useState<number>(600.00);
  const [invoiceTypeConfigs, setInvoiceTypeConfigs] = useState<InvoiceTypeConfig[]>(() => {
    const saved = localStorage.getItem('bocs_invoice_types');
    if (saved) {
      try {
        const parsed: InvoiceTypeConfig[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const missing = INITIAL_INVOICE_TYPE_CONFIGS.filter(
            init => !parsed.some(p => p.id === init.id || p.name.toLowerCase().trim() === init.name.toLowerCase().trim())
          );
          if (missing.length > 0) {
            const merged = [...parsed, ...missing];
            localStorage.setItem('bocs_invoice_types', JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
      } catch (e) { console.error('Erreur chargement invoice_types local', e); }
    }
    return INITIAL_INVOICE_TYPE_CONFIGS;
  });

  const [rubriqueConfigs, setRubriqueConfigs] = useState<RubriqueConfig[]>(() => {
    const saved = localStorage.getItem('bocs_rubriques');
    if (saved) {
      try {
        const parsed: RubriqueConfig[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const missing = INITIAL_RUBRIQUE_CONFIGS.filter(
            init => !parsed.some(p => p.id === init.id)
          );
          if (missing.length > 0) {
            const merged = [...parsed, ...missing];
            localStorage.setItem('bocs_rubriques', JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
      } catch (e) { console.error('Erreur chargement rubriques local', e); }
    }
    return INITIAL_RUBRIQUE_CONFIGS;
  });

  // Sauvegarde automatique en temps réel dans localStorage
  useEffect(() => {
    localStorage.setItem('bocs_invoice_types', JSON.stringify(invoiceTypeConfigs));
  }, [invoiceTypeConfigs]);

  useEffect(() => {
    localStorage.setItem('bocs_rubriques', JSON.stringify(rubriqueConfigs));
  }, [rubriqueConfigs]);

  useEffect(() => {
    localStorage.setItem('bocs_escales', JSON.stringify(escales));
  }, [escales]);

  useEffect(() => {
    localStorage.setItem('bocs_bls', JSON.stringify(bls));
  }, [bls]);

  useEffect(() => {
    localStorage.setItem('bocs_drafts', JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    localStorage.setItem('bocs_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('bocs_credit_notes', JSON.stringify(creditNotes));
  }, [creditNotes]);

  useEffect(() => {
    localStorage.setItem('bocs_payments', JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem('bocs_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Initialisation et chargement des données depuis Neon Postgres
  useEffect(() => {
    const initAndLoad = async () => {
      try {
        // 1. Initialise les tables si nécessaire
        await fetch('/api/init-db');

        // 2. Charge les factures, avoirs, utilisateurs et données
        const [invoicesRes, creditNotesRes, paymentsRes, auditRes, configsRes, escalesRes, blsRes, usersRes] = await Promise.all([
          fetch('/api/invoices').catch(() => null),
          fetch('/api/credit-notes').catch(() => null),
          fetch('/api/payments').catch(() => null),
          fetch('/api/audit').catch(() => null),
          fetch('/api/configs').catch(() => null),
          fetch('/api/escales').catch(() => null),
          fetch('/api/bls').catch(() => null),
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
              } catch (e) {}
            }
          }
        }

        if (invoicesRes && invoicesRes.ok) {
          const invData = await invoicesRes.json();
          if (invData.success && invData.invoices) {
            setInvoices(invData.invoices.map(normalizeInvoice));
          }
        }

        if (creditNotesRes && creditNotesRes.ok) {
          const cnData = await creditNotesRes.json();
          if (cnData.success && cnData.creditNotes) {
            setCreditNotes(cnData.creditNotes);
          }
        }

        if (paymentsRes && paymentsRes.ok) {
          const payData = await paymentsRes.json();
          if (payData.success && payData.payments) {
            setPayments(payData.payments);
          }
        }

        if (escalesRes && escalesRes.ok) {
          const escaleData = await escalesRes.json();
          if (escaleData.success && escaleData.escales && escaleData.escales.length > 0) {
            const uniqueEscales = escaleData.escales.reduce((acc: Escale[], current: Escale) => {
              const exists = acc.find(e => 
                e.id === current.id || 
                (e.nomNavire?.trim().toLowerCase() === current.nomNavire?.trim().toLowerCase() && 
                 e.numeroVoyage?.trim() === current.numeroVoyage?.trim())
              );
              if (!exists) acc.push(current);
              return acc;
            }, []);
            setEscales(uniqueEscales);
          } else if (escaleData.success && Array.isArray(escaleData.escales)) {
            setEscales([]);
          }
        }

        if (blsRes && blsRes.ok) {
          const blData = await blsRes.json();
          if (blData.success && blData.bls && blData.bls.length > 0) {
            const uniqueBls = blData.bls.reduce((acc: BL[], current: BL) => {
              const exists = acc.find(b => b.id === current.id || (b.numeroBL === current.numeroBL && b.escaleId === current.escaleId));
              if (!exists) acc.push(current);
              return acc;
            }, []);
            setBls(uniqueBls);
          } else if (blData.success && Array.isArray(blData.bls)) {
            setBls([]);
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
  }, []);

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
      ip: '160.155.20.14'
    };
    setAuditLogs(prev => [newLog, ...prev]);
    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde du log d'audit sur Neon", e);
    }
  };

  // --- USER & AUTHENTICATION HANDLERS ---

  // Switch Active User / Role (For Demo/Testing)
  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('bocs_session_user', JSON.stringify(user));
    logAuditAction('CHANGEMENT_ROLE_DEMO', 'Utilisateur', `Passage sous le compte ${user.nomComplet} (${user.role})`);
  };

  // Login handler
  const handleLoginSuccess = (user: User) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updatedUser = { ...user, dernierAcces: now };
    setAllUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    setIsAuthenticated(true);
    setShowWelcome(true); // Redirige vers la Plateforme Intégrée après connexion
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
  };

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
    try {
      await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Erreur suppression utilisateur sur Neon:', e);
    }
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

  // Add Escale
  const handleAddEscale = async (escale: Escale) => {
    setEscales(prev => [
      escale, 
      ...prev.filter(e => e.id !== escale.id && (e.numeroVoyage !== escale.numeroVoyage || e.nomNavire.trim().toLowerCase() !== escale.nomNavire.trim().toLowerCase()))
    ]);
    try {
      await fetch('/api/escales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(escale)
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde de l'escale", e);
    }
  };

  // Update Escale
  const handleUpdateEscale = async (updatedEscale: Escale) => {
    setEscales(prev => prev.map(e => e.id === updatedEscale.id ? updatedEscale : e));
    try {
      await fetch('/api/escales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEscale)
      });
    } catch (e) {
      console.error("Erreur lors de la mise à jour de l'escale sur Neon", e);
    }
    logAuditAction('MODIFICATION_ESCALE', 'Escale', `Mise à jour des informations de l'escale ${updatedEscale.nomNavire} (Voyage ${updatedEscale.numeroVoyage})`);
  };

  // Import XML Manifest
  const handleImportManifest = async (escale: Escale, newBls: BL[]) => {
    setEscales(prev => [
      escale, 
      ...prev.filter(e => e.id !== escale.id && (e.numeroVoyage !== escale.numeroVoyage || e.nomNavire.trim().toLowerCase() !== escale.nomNavire.trim().toLowerCase()))
    ]);
    setBls(prev => {
      const newBlNums = new Set(newBls.map(b => b.numeroBL));
      const filtered = prev.filter(b => !newBlNums.has(b.numeroBL));
      return [...newBls, ...filtered];
    });
    try {
      await fetch('/api/escales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(escale)
      });
      await fetch('/api/bls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bls: newBls })
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde du manifeste importé", e);
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
      (inv.numeroBL !== undefined && targetBlNumbers.includes(inv.numeroBL))
    );
    const targetInvoiceIds = targetInvoices.map(inv => inv.id);

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

    try {
      await fetch(`/api/escales?id=${escaleId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error("Erreur lors de la suppression de l'escale en base", e);
    }
  };

  // Add Export Draft
  const handleAddDraft = (draft: DraftExport) => {
    setDrafts(prev => [draft, ...prev]);
  };

  // Update Draft Status
  const handleUpdateDraftStatus = (draftId: number, status: any, motif?: string, blNumber?: string) => {
    setDrafts(prev => prev.map(d => {
      if (d.id === draftId) {
        return {
          ...d,
          statut: status,
          motifDemandeModification: motif || d.motifDemandeModification,
          numeroBlGenere: blNumber || d.numeroBlGenere,
          dateValidation: status === 'VALIDE' ? new Date().toISOString() : d.dateValidation
        };
      }
      return d;
    }));
  };

  // Update Full Draft
  const handleUpdateDraft = (updatedDraft: DraftExport) => {
    setDrafts(prev => prev.map(d => d.id === updatedDraft.id ? updatedDraft : d));
  };

  // Generate Invoice
  const handleGenerateInvoice = async (invoice: Invoice) => {
    setInvoices(prev => [invoice, ...prev]);
    setBls(prev => prev.map(b => b.numeroBL === invoice.numeroBL ? { ...b, statutImport: 'FACTURE' } : b));
    try {
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice)
      });

      const targetBl = bls.find(b => b.numeroBL === invoice.numeroBL);
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
    setInvoices(prev => prev.map(inv => inv.id === invoice.id ? invoice : inv));
    try {
      await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice)
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
      await fetch('/api/clear-db');
    } catch (e) {
      console.error('Erreur purge DB', e);
    }
  };

  // Dérive un préfixe court (3 lettres) depuis le nom du type de facture
  const getInvoiceTypePrefix = (typeName: string): string => {
    const n = (typeName || '').toLowerCase();
    if (n.includes('telex') || n.includes('télex')) return 'TEL';
    if (n.includes('surestarie') || n.includes('suréstarie')) return 'SUR';
    if (n.includes('detention') || n.includes('détention')) return 'DET';
    if (n.includes('echange') || n.includes('échange')) return 'ECH';
    if (n.includes('caution')) return 'CAU';
    if (n.includes('transfert')) return 'TRF';
    if (n.includes('fret')) return 'FRT';
    // Fallback : 3 premières lettres capitalisées
    const clean = n.replace(/^facture\s+/i, '').trim();
    return clean.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'FAC';
  };

  const getNextInvoiceNumber = (
    type: 'PROFORMA' | 'FACTURE',
    voyageNumber: string,
    existingInvoices: Invoice[],
    invoiceTypeName?: string
  ): string => {
    const cleanVoyage = (voyageNumber || 'SANS_VOYAGE').trim().replace(/[^a-zA-Z0-9-]/g, '');
    const typePrefix = invoiceTypeName ? getInvoiceTypePrefix(invoiceTypeName) : '';
    const faPrefix = type === 'FACTURE' ? 'FA-' : '';
    // Format : [FA-]TEL25586-BOCS001
    const searchPrefix = `${faPrefix}${typePrefix}${cleanVoyage}-BOCS`;
    
    const matchedNumbers = existingInvoices
      .map(inv => inv.numeroFacture || '')
      .filter(num => num.startsWith(searchPrefix));
      
    let maxCounter = 0;
    matchedNumbers.forEach(num => {
      const suffix = num.replace(searchPrefix, '');
      const counterVal = parseInt(suffix, 10);
      if (!isNaN(counterVal) && counterVal > maxCounter) {
        maxCounter = counterVal;
      }
    });
    
    const nextCounter = maxCounter + 1;
    const nextCounterStr = String(nextCounter).padStart(3, '0');
    return `${searchPrefix}${nextCounterStr}`;
  };

  // Add Payment
  const handleAddPayment = async (payment: Payment) => {
    let updatedInvoice: Invoice | null = null;
    let newFinalNumber = '';

    const targetInvoice = invoices.find(inv => inv.id === payment.factureId);
    if (targetInvoice) {
      const newSolde = Math.max(0, targetInvoice.soldeDuFcfa - payment.montantFcfa);
      const newStatus = newSolde === 0 ? 'PAYE' : 'PARTIEL';
      
      let typeFacture = targetInvoice.typeFacture;
      let numeroFacture = targetInvoice.numeroFacture;

      // Dès qu'un règlement est perçu, la facture devient définitive avec son numéro fiscal officiel
      if (!numeroFacture.startsWith('FA-')) {
        if (typeFacture === 'PROFORMA_IMPORT') typeFacture = 'DEFINITIVE_IMPORT';
        if (typeFacture === 'PROFORMA_EXPORT') typeFacture = 'DEFINITIVE_EXPORT';

        let voyageNumber = 'VOYAGE';
        const targetBl = bls.find(b => b.id === targetInvoice.blId || b.numeroBL === targetInvoice.numeroBL);
        const targetEscale = targetBl ? escales.find(e => e.id === targetBl.escaleId) : null;
        if (targetEscale) {
          voyageNumber = targetEscale.numeroVoyage;
        } else if (targetInvoice.escaleInfo) {
          const parts = targetInvoice.escaleInfo.split(/V\./i);
          if (parts.length > 1) {
            voyageNumber = parts[1].trim();
          }
        }
        // Récupérer le nom du type de facture pour le préfixe
        const invTypeName = invoiceTypeConfigs.find(t => t.id === targetInvoice.invoiceTypeId)?.name || '';
        newFinalNumber = getNextInvoiceNumber('FACTURE', voyageNumber, invoices, invTypeName);
        numeroFacture = newFinalNumber;
      }

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      updatedInvoice = {
        ...targetInvoice,
        soldeDuFcfa: newSolde,
        statutPaiement: newStatus,
        statutFacture: targetInvoice.statutFacture === 'ANNULEE' ? 'ANNULEE' : 'VALIDEE',
        typeFacture,
        numeroFacture,
        validatedBy: targetInvoice.validatedBy || currentUser.nomComplet,
        validatedAt: targetInvoice.validatedAt || now
      };
    }

    if (updatedInvoice) {
      setInvoices(prev => prev.map(inv => inv.id === payment.factureId ? updatedInvoice! : inv));
    }

    const finalPayment = {
      ...payment,
      numeroFacture: newFinalNumber || payment.numeroFacture
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

    if (!numeroFacture.startsWith('FA-') || target.statutFacture !== 'VALIDEE') {
      let voyageNumber = 'VOYAGE';
      const targetBl = bls.find(b => b.id === target.blId || b.numeroBL === target.numeroBL);
      const targetEscale = targetBl ? escales.find(e => e.id === targetBl.escaleId) : null;
      if (targetEscale) {
        voyageNumber = targetEscale.numeroVoyage;
      } else if (target.escaleInfo) {
        const parts = target.escaleInfo.split(/V\./i);
        if (parts.length > 1) {
          voyageNumber = parts[1].trim();
        }
      }
      const invTypeName = invoiceTypeConfigs.find(t => t.id === target.invoiceTypeId)?.name || '';
      numeroFacture = getNextInvoiceNumber('FACTURE', voyageNumber, invoices, invTypeName);
      
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

    let voyageNumber = 'VOYAGE';
    const targetBl = bls.find(b => b.id === originalInvoice.blId || b.numeroBL === originalInvoice.numeroBL);
    const targetEscale = targetBl ? escales.find(e => e.id === targetBl.escaleId) : null;
    if (targetEscale) {
      voyageNumber = targetEscale.numeroVoyage;
    } else if (originalInvoice.escaleInfo) {
      const parts = originalInvoice.escaleInfo.split(/V\./i);
      if (parts.length > 1) {
        voyageNumber = parts[1].trim();
      }
    }
    const origTypeName = invoiceTypeConfigs.find(t => t.id === originalInvoice.invoiceTypeId)?.name || '';
    const newInvoiceNumber = getNextInvoiceNumber('PROFORMA', voyageNumber, invoices, origTypeName);

    const newInvoice: Invoice = {
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
    };

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

  // Suppression autorisée uniquement sur un Brouillon / Proforma (avec suppression en cascade des pièces rattachées)
  const handleDeleteInvoice = async (invoiceId: number) => {
    const target = invoices.find(i => i.id === invoiceId);
    if (!target) return;

    const isProforma = !(target.numeroFacture || '').startsWith('FA-') && 
                       target.statutFacture !== 'VALIDEE' && 
                       target.statutFacture !== 'ANNULEE' && 
                       target.statutFacture !== 'AVOIR' && 
                       target.statutPaiement !== 'PAYE';

    if (!isProforma) {
      toastError(`Conformité fiscale : La facture ${target.numeroFacture} est inaltérable. Veuillez émettre un Avoir pour l'annuler.`);
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

    try {
      await fetch(`/api/invoices?id=${invoiceId}`, { method: 'DELETE' });
    } catch (e) {
      console.error("Erreur lors de la suppression de la proforma sur Neon", e);
    }
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
    try {
      await fetch(`/api/configs?typeId=${typeId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error("Erreur lors de la suppression du type de facture sur Neon", e);
    }
  };

  // Update FNE Param
  const handleUpdateFneParam = (cle: string, valeur: string) => {
    setFneParams(prev => prev.map(p => p.cle === cle ? { ...p, valeur, updatedAt: new Date().toISOString().split('T')[0] } : p));
  };

  // ─── Porte 1 : Authentification requise ───────────────────────────────
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

  // ─── Porte 2 : Écran d'accueil / Plateforme intégrée (après connexion) ─
  if (showWelcome || activeTab === 'dashboard') {
    return (
      <WelcomeScreen 
        escales={escales}
        bls={bls}
        drafts={drafts}
        invoices={invoices}
        invoiceTypeConfigs={invoiceTypeConfigs}
        rubriqueConfigs={rubriqueConfigs}
        exchangeRateUsd={exchangeRateUsd}
        userRole={currentUser.role}
        onEnter={(targetTab, targetBlId) => {
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
        onAddPayment={handleAddPayment}
        onLogAudit={logAuditAction}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-on-surface antialiased">
      
      {/* Unified Premium Header Navigation */}
      <Header
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        onSwitchUser={handleSwitchUser}
        allUsers={allUsers}
        exchangeRateUsd={exchangeRateUsd}
        onUpdateExchangeRate={setExchangeRateUsd}
        onLogout={handleLogout}
        onOpenLogin={() => handleOpenAuthModal('login')}
        onOpenProfile={() => setShowProfileModal(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onReturnToWelcome={() => setShowWelcome(true)}
        counts={{
          escalesCount: escales.length,
          blsCount: bls.length,
          draftsCount: drafts.length,
          facturesCount: invoices.length
        }}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-[1664px] mx-auto w-full">
        
        {/* Content Main Panel */}
        <main className="flex-grow p-4 md:p-6 overflow-y-auto w-full">

          {activeTab === 'vessels' && (
            <VesselTrackingModule
              escales={escales}
              bls={bls}
              invoices={invoices}
              payments={payments}
              userRole={currentUser.role}
              onAddEscale={handleAddEscale}
              onImportManifest={handleImportManifest}
              onDeleteEscale={handleDeleteEscaleIntegration}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'import' && (
            <ImportModule
              escales={escales}
              bls={bls}
              onAddEscale={handleAddEscale}
              onImportManifest={handleImportManifest}
              onDeleteEscaleIntegration={handleDeleteEscaleIntegration}
              onGenerateInvoice={handleGenerateInvoice}
              onUpdateInvoice={handleUpdateInvoice}
              onLogAudit={logAuditAction}
              userRole={currentUser.role}
              rubriqueConfigs={rubriqueConfigs}
              invoiceTypeConfigs={invoiceTypeConfigs}
              invoices={invoices}
              onUpdateBl={handleUpdateBl}
              onNavigateToBilling={(bl) => {
                setSelectedBlIdForBilling(bl.id);
                setActiveTab('facturation');
              }}
            />
          )}

          {(activeTab === 'export' || activeTab === 'export_saisie' || activeTab === 'export_list' || activeTab === 'export_consolidation') && (
            <ExportModule
              initialSubTab={
                activeTab === 'export_saisie' ? 'SAISIE_DRAFT' :
                activeTab === 'export_list' ? 'ESPACE_CLIENT' :
                activeTab === 'export_consolidation' ? 'CONSOLIDATION' : 'SAISIE_DRAFT'
              }
              drafts={drafts}
              escales={escales}
              currentUser={currentUser}
              onAddDraft={handleAddDraft}
              onUpdateDraft={handleUpdateDraft}
              onUpdateDraftStatus={handleUpdateDraftStatus}
              onGenerateInvoice={handleGenerateInvoice}
              onLogAudit={logAuditAction}
              userRole={currentUser.role}
            />
          )}

          {(activeTab === 'facturation' || activeTab === 'facturation_journal' || activeTab === 'facturation_tarifs' || activeTab === 'facturation_balance' || activeTab === 'facturation_config' || activeTab === 'facturation_avoirs') && (
            <FacturationModule
              initialSubTab={
                activeTab === 'facturation_journal' ? 'PROFORMA' :
                activeTab === 'facturation_tarifs' ? 'TARIFS' :
                activeTab === 'facturation_balance' ? 'BALANCE_AGEE' :
                activeTab === 'facturation_config' ? 'CONFIG' :
                activeTab === 'facturation_avoirs' ? 'AVOIRS' : 'FACTURATION_BL'
              }
              invoices={invoices}
              creditNotes={creditNotes}
              payments={payments}
              bls={bls}
              escales={escales}
              selectedBlId={selectedBlIdForBilling}
              onSelectBl={setSelectedBlIdForBilling}
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
              invoiceTypeConfigs={invoiceTypeConfigs}
              onUpdateInvoiceTypeConfigs={handleUpdateInvoiceTypeConfigs}
              rubriqueConfigs={rubriqueConfigs}
              onUpdateRubriqueConfigs={handleUpdateRubriqueConfigs}
              onUpdateAllConfigs={handleUpdateAllConfigs}
              onDeleteInvoiceTypeConfig={handleDeleteInvoiceTypeConfig}
              onGenerateInvoice={handleGenerateInvoice}
              onUpdateBl={handleUpdateBl}
            />
          )}

          {activeTab === 'surestarie' && (
            <SurestarieModule
              bls={bls}
              escales={escales}
              invoices={invoices}
              invoiceTypeConfigs={invoiceTypeConfigs}
              userRole={currentUser.role}
              onGenerateInvoice={handleGenerateInvoice}
              onAddPayment={handleAddPayment}
              onLogAudit={logAuditAction}
            />
          )}

          {(activeTab === 'admin' || activeTab === 'admin_users' || activeTab === 'admin_rights' || activeTab === 'admin_fne' || activeTab === 'admin_audit') && (
            <AdminModule
              initialTab={
                activeTab === 'admin_rights' ? 'RIGHTS' :
                activeTab === 'admin_fne' ? 'FNE' :
                activeTab === 'admin_audit' ? 'AUDIT' : 'USERS'
              }
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
              onUpdateExchangeRate={setExchangeRateUsd}
              onLogAudit={logAuditAction}
              userRole={currentUser.role}
              onClearAllData={handleClearAllData}
            />
          )}

        </main>

      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
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

      {/* Floating Action Button : Retour immédiat à la plateforme intégrée de gestion et facturation maritime (seulement dans les sous-modules) */}
      {!showWelcome && (
        <button
          type="button"
          onClick={() => {
            setShowWelcome(true);
            setActiveTab('dashboard');
          }}
          className="fixed bottom-5 left-5 z-40 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/95 hover:bg-white text-[#002B49] hover:text-[#005DAA] shadow-xl border border-zinc-200 hover:border-[#005DAA]/50 backdrop-blur-md transition-all cursor-pointer active:scale-95 group font-bold text-xs"
          title="Retour à la plateforme intégrée de gestion et facturation maritime"
          aria-label="Retour à la plateforme intégrée de gestion et facturation maritime"
        >
          <span className="w-7 h-7 rounded-xl bg-[#F0F7FF] text-[#005DAA] flex items-center justify-center group-hover:bg-[#005DAA] group-hover:text-white transition-colors shadow-2xs shrink-0">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </span>
          <div className="text-left hidden md:block">
            <div className="text-[9px] uppercase font-black text-[#00875A] tracking-wider leading-none">Accueil</div>
            <div className="text-xs font-black text-[#002B49] group-hover:text-[#005DAA] leading-tight mt-0.5 whitespace-nowrap">Plateforme Intégrée</div>
          </div>
        </button>
      )}

      {/* Global Toast Notifications */}
      <ToastContainer />

    </div>
  );
}
