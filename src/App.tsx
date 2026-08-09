import React, { useState, useEffect } from 'react';
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
import { AdminModule } from './pages/AdminModule';
import { AuthModal } from './components/common/AuthModal';
import { 
  InvoiceTypeConfig, 
  RubriqueConfig, 
  User, 
  Escale, 
  BL, 
  DraftExport, 
  Invoice, 
  Payment, 
  FneParam, 
  AuditLog 
} from './types';

export function App() {
  // Global Application & Auth State
  const [allUsers, setAllUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]); // Default Admin
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Persistence en Base LocalStorage
  const [escales, setEscales] = useState<Escale[]>(() => {
    const saved = localStorage.getItem('bocs_escales');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Erreur chargement escales local', e); }
    }
    return INITIAL_ESCALES;
  });

  const [bls, setBls] = useState<BL[]>(() => {
    const saved = localStorage.getItem('bocs_bls');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Erreur chargement bls local', e); }
    }
    return INITIAL_BLS;
  });

  const [drafts, setDrafts] = useState<DraftExport[]>(() => {
    const saved = localStorage.getItem('bocs_drafts');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Erreur chargement drafts local', e); }
    }
    return INITIAL_DRAFTS_EXPORT;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('bocs_invoices');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Erreur chargement invoices local', e); }
    }
    return INITIAL_INVOICES;
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
  const [invoiceTypeConfigs, setInvoiceTypeConfigs] = useState<InvoiceTypeConfig[]>(INITIAL_INVOICE_TYPE_CONFIGS);
  const [rubriqueConfigs, setRubriqueConfigs] = useState<RubriqueConfig[]>(INITIAL_RUBRIQUE_CONFIGS);

  // Sauvegarde automatique en temps réel dans localStorage
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
        
        // 2. Charge les configurations
        const configsRes = await fetch('/api/configs');
        const configsData = await configsRes.json();
        if (configsData.success) {
          if (configsData.types && configsData.types.length > 0) {
            setInvoiceTypeConfigs(configsData.types);
          }
          if (configsData.rubriques && configsData.rubriques.length > 0) {
            setRubriqueConfigs(configsData.rubriques);
          }
        }

        // Load escales from DB
        const escalesRes = await fetch('/api/escales');
        const escalesData = await escalesRes.json();
        if (escalesData.success && escalesData.escales && escalesData.escales.length > 0) {
          setEscales(escalesData.escales);
        } else {
          // Migration from localStorage if database is empty
          const saved = localStorage.getItem('bocs_escales');
          if (saved) {
            try {
              const localEscales = JSON.parse(saved);
              if (localEscales.length > 0) {
                setEscales(localEscales);
                // Save to DB
                for (const esc of localEscales) {
                  await fetch('/api/escales', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(esc)
                  });
                }
              }
            } catch (e) {
              console.error('Erreur migration escales', e);
            }
          }
        }

        // Load bls from DB
        const blsRes = await fetch('/api/bls');
        const blsData = await blsRes.json();
        if (blsData.success && blsData.bls && blsData.bls.length > 0) {
          setBls(blsData.bls);
        } else {
          // Migration from localStorage if database is empty
          const saved = localStorage.getItem('bocs_bls');
          if (saved) {
            try {
              const localBls = JSON.parse(saved);
              if (localBls.length > 0) {
                setBls(localBls);
                // Save to DB
                await fetch('/api/bls', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ bls: localBls })
                });
              }
            } catch (e) {
              console.error('Erreur migration bls', e);
            }
          }
        }

        // 3. Charge les factures
        const invoicesRes = await fetch('/api/invoices');
        const invoicesData = await invoicesRes.json();
        if (invoicesData.success && invoicesData.invoices && invoicesData.invoices.length > 0) {
          setInvoices(invoicesData.invoices);
        }

        // 4. Charge les règlements
        const paymentsRes = await fetch('/api/payments');
        const paymentsData = await paymentsRes.json();
        if (paymentsData.success && paymentsData.payments && paymentsData.payments.length > 0) {
          setPayments(paymentsData.payments);
        }

        // 5. Charge les logs d'audit
        const auditRes = await fetch('/api/audit');
        const auditData = await auditRes.json();
        if (auditData.success && auditData.auditLogs && auditData.auditLogs.length > 0) {
          setAuditLogs(auditData.auditLogs);
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
    logAuditAction('CHANGEMENT_ROLE_DEMO', 'Utilisateur', `Passage sous le compte ${user.nomComplet} (${user.role})`);
  };

  // Login handler
  const handleLoginSuccess = (user: User) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updatedUser = { ...user, dernierAcces: now };
    setAllUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    setIsAuthenticated(true);
    setAuthModalOpen(false);
    logAuditAction('CONNEXION_REUSSIE', 'Session', `Connexion de ${user.nomComplet} (${user.role})`);
  };

  // Logout handler
  const handleLogout = () => {
    logAuditAction('DECONNEXION', 'Session', `Déconnexion de l'utilisateur ${currentUser.nomComplet}`);
    setIsAuthenticated(false);
    setAuthModalOpen(true);
    setAuthModalMode('login');
  };

  // Open Auth Modal
  const handleOpenAuthModal = (mode: 'login' | 'register' | 'forgot' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  // Add User (Admin or Self Register)
  const handleAddUser = (newUser: User) => {
    setAllUsers(prev => [newUser, ...prev]);
    logAuditAction('CREATION_UTILISATEUR', 'User', `Création du compte ${newUser.nomComplet} (${newUser.role})`);
  };

  // Update User
  const handleUpdateUser = (updatedUser: User) => {
    setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    if (currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
    logAuditAction('MODIFICATION_UTILISATEUR', 'User', `Mise à jour des informations pour ${updatedUser.nomComplet}`);
  };

  // Delete User
  const handleDeleteUser = (userId: number) => {
    const target = allUsers.find(u => u.id === userId);
    setAllUsers(prev => prev.filter(u => u.id !== userId));
    logAuditAction('SUPPRESSION_UTILISATEUR', 'User', `Suppression du compte #${userId} (${target?.nomComplet || 'Inconnu'})`);
  };

  // Toggle User Active Status
  const handleToggleUserStatus = (userId: number) => {
    setAllUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const nextStatus = !u.estActif;
        logAuditAction('STATUS_UTILISATEUR_MUTATION', 'User', `Compte ${u.nomComplet} (${u.role}) basculé vers ${nextStatus ? 'ACTIF' : 'INACTIF'}`);
        return { ...u, estActif: nextStatus };
      }
      return u;
    }));
  };

  // Reset User Password
  const handleResetUserPassword = (userId: number, tempPass: string) => {
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, motDePasse: tempPass } : u));
    const target = allUsers.find(u => u.id === userId);
    logAuditAction('REINITIALISATION_MOT_DE_PASSE', 'User', `Mot de passe temporaire généré pour ${target?.nomComplet}`);
  };

  // --- BUSINESS DOMAIN HANDLERS ---

  // Add Escale
  const handleAddEscale = async (escale: Escale) => {
    setEscales(prev => [escale, ...prev]);
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

  // Import XML Manifest
  const handleImportManifest = async (escale: Escale, newBls: BL[]) => {
    setEscales(prev => [escale, ...prev]);
    setBls(prev => [...newBls, ...prev]);
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

  // Delete Escale and all associated XML BLs
  const handleDeleteEscaleIntegration = async (escaleId: number) => {
    const targetEscale = escales.find(e => e.id === escaleId);
    const deletedBlsCount = bls.filter(b => b.escaleId === escaleId).length;

    setEscales(prev => prev.filter(e => e.id !== escaleId));
    setBls(prev => prev.filter(b => b.escaleId !== escaleId));
    setInvoices(prev => prev.filter(inv => !bls.filter(b => b.escaleId === escaleId).some(b => b.id === inv.blId)));

    logAuditAction('SUPPRESSION_INTEGRATION_XML', 'Escale', `Suppression de l'escale ${targetEscale?.nomNavire || escaleId} et de ses ${deletedBlsCount} BLs rattachés`);

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

  // Add Payment
  const handleAddPayment = async (payment: Payment) => {
    setPayments(prev => [payment, ...prev]);
    let updatedInvoice: Invoice | null = null;
    setInvoices(prev => prev.map(inv => {
      if (inv.id === payment.factureId) {
        const newSolde = Math.max(0, inv.soldeDuFcfa - payment.montantFcfa);
        const newStatus = newSolde === 0 ? 'PAYE' : 'PARTIEL';
        updatedInvoice = {
          ...inv,
          soldeDuFcfa: newSolde,
          statutPaiement: newStatus
        };
        return updatedInvoice;
      }
      return inv;
    }));

    try {
      // 1. Save payment
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment)
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

  // Configuration update handlers for Neon Postgres
  const handleUpdateInvoiceTypeConfigs = async (newConfigs: InvoiceTypeConfig[]) => {
    setInvoiceTypeConfigs(newConfigs);
    try {
      await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: newConfigs, rubriques: rubriqueConfigs })
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
        body: JSON.stringify({ types: invoiceTypeConfigs, rubriques: newRubriques })
      });
    } catch (e) {
      console.error("Erreur lors de la sauvegarde des rubriques sur Neon", e);
    }
  };

  // Update FNE Param
  const handleUpdateFneParam = (cle: string, valeur: string) => {
    setFneParams(prev => prev.map(p => p.cle === cle ? { ...p, valeur, updatedAt: new Date().toISOString().split('T')[0] } : p));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-on-surface antialiased">
      
      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Module Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          userRole={currentUser.role}
          currentUser={currentUser}
          isAuthenticated={isAuthenticated}
          onLogout={handleLogout}
          onOpenLogin={() => handleOpenAuthModal('login')}
          exchangeRateUsd={exchangeRateUsd}
          counts={{
            blsCount: bls.length,
            draftsCount: drafts.length,
            facturesCount: invoices.length
          }}
        />

        {/* Content Main Panel */}
        <main className="flex-1 p-6 overflow-y-auto w-full">
          
          {activeTab === 'dashboard' && (
            <Dashboard
              escales={escales}
              bls={bls}
              drafts={drafts}
              invoices={invoices}
              userRole={currentUser.role}
              exchangeRateUsd={exchangeRateUsd}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'vessels' && (
            <VesselTrackingModule
              escales={escales}
              userRole={currentUser.role}
              onAddEscale={handleAddEscale}
              onDeleteEscale={handleDeleteEscaleIntegration}
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
              onLogAudit={logAuditAction}
              userRole={currentUser.role}
              rubriqueConfigs={rubriqueConfigs}
              invoiceTypeConfigs={invoiceTypeConfigs}
              invoices={invoices}
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
              onUpdateDraftStatus={handleUpdateDraftStatus}
              onGenerateInvoice={handleGenerateInvoice}
              onLogAudit={logAuditAction}
              userRole={currentUser.role}
            />
          )}

          {(activeTab === 'facturation' || activeTab === 'facturation_tarifs' || activeTab === 'facturation_balance' || activeTab === 'facturation_config') && (
            <FacturationModule
              initialSubTab={
                activeTab === 'facturation_tarifs' ? 'TARIFS' :
                activeTab === 'facturation_balance' ? 'BALANCE_AGEE' :
                activeTab === 'facturation_config' ? 'CONFIG' : 'PROFORMA'
              }
              invoices={invoices}
              payments={payments}
              onAddPayment={handleAddPayment}
              exchangeRateUsd={exchangeRateUsd}
              onLogAudit={logAuditAction}
              userRole={currentUser.role}
              invoiceTypeConfigs={invoiceTypeConfigs}
              onUpdateInvoiceTypeConfigs={handleUpdateInvoiceTypeConfigs}
              rubriqueConfigs={rubriqueConfigs}
              onUpdateRubriqueConfigs={handleUpdateRubriqueConfigs}
            />
          )}

          {(activeTab === 'admin' || activeTab === 'admin_users' || activeTab === 'admin_fne' || activeTab === 'admin_audit') && (
            <AdminModule
              initialTab={
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
            />
          )}

        </main>

      </div>

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

    </div>
  );
}
