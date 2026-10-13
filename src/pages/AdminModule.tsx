import React, { useState } from 'react';
import { toastSuccess } from '../components/common/Toast';
import { FneParam, AuditLog, UserRole, User } from '../types';
import { INITIAL_PERMISSIONS, hasPermission, notifyPermissionsChanged, loadPermissionsMatrix, loadUserOverrides } from '../utils/permissions';
import type { PermissionItem } from '../utils/permissions';
import { useEscapeClose, overlayClickClose } from '../hooks/useEscapeClose';

// ⚠️ Source canonique des habilitations déplacée dans src/utils/permissions.ts
// (moteur RBAC partagé par App, Sidebar, Header et Dashboard).
export { INITIAL_PERMISSIONS };
export type { PermissionItem };


export type AdminSubTab = 'USERS' | 'RIGHTS' | 'FNE' | 'AUDIT';

interface AdminModuleProps {
  initialTab?: AdminSubTab;
  /**
   * Remonte à la navigation globale (Sidebar / Header) le sous-onglet réellement
   * affiché, afin de resynchroniser le sous-menu Administration.
   */
  onTabChange?: (tab: AdminSubTab) => void;
  allUsers: User[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: number) => void;
  onToggleUserStatus: (userId: number) => void;
  onResetUserPassword: (userId: number, tempPass: string) => void;
  fneParams: FneParam[];
  onUpdateFneParam: (cle: string, valeur: string) => void;
  auditLogs: AuditLog[];
  exchangeRateUsd: number;
  onUpdateExchangeRate: (rate: number) => void;
  onLogAudit: (action: string, entite: string, details: string) => void;
  userRole: UserRole;
  /** Utilisateur connecté (permet d'appliquer les overrides individuels en plus de la matrice par rôle). */
  currentUser?: User;
  onClearAllData?: () => void;
}

export const AdminModule: React.FC<AdminModuleProps> = ({
  initialTab = 'USERS',
  onTabChange,
  allUsers,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onToggleUserStatus,
  onResetUserPassword,
  fneParams,
  onUpdateFneParam,
  auditLogs,
  exchangeRateUsd,
  onUpdateExchangeRate,
  onLogAudit,
  userRole,
  currentUser,
  onClearAllData
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<AdminSubTab>(initialTab);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  // RBAC : habilitations effectives du rôle courant dans la console d'administration
  // (overrides individuels prioritaires sur la matrice par rôle)
  const permissionSubject = currentUser || { id: -1, role: userRole };
  const canManageUsers = hasPermission(permissionSubject, 'admin_users_manage');
  const canManageRights = hasPermission(permissionSubject, 'admin_rights_assign');
  const canManageFne = hasPermission(permissionSubject, 'fne_certification');
  const canViewAudit = hasPermission(permissionSubject, 'admin_audit_logs');

  // Liste ordonnée des sous-onglets autorisés pour l'utilisateur courant.
  const allowedAdminTabs = React.useMemo<AdminSubTab[]>(() => {
    const tabs: AdminSubTab[] = [];
    if (canManageUsers) tabs.push('USERS');
    if (canManageRights) tabs.push('RIGHTS');
    if (canManageFne) tabs.push('FNE');
    if (canViewAudit) tabs.push('AUDIT');
    return tabs;
  }, [canManageUsers, canManageRights, canManageFne, canViewAudit]);

  // 1) Synchronisation avec la navigation (Sidebar / Header / Dashboard).
  // ⚠️ Anomalie corrigée : `activeAdminTab` figurait dans les dépendances de cet
  // effet qui re-force ensuite l'onglet demandé par la navigation. Résultat :
  // chaque clic sur un bouton d'onglet était immédiatement annulé (retour forcé
  // sur `initialTab`) et les boutons paraissaient inertes. L'effet ne doit
  // réagir qu'à un vrai changement d'onglet demandé depuis la navigation.
  React.useEffect(() => {
    if (initialTab && allowedAdminTabs.includes(initialTab)) {
      setActiveAdminTab(initialTab);
    }
  }, [initialTab, allowedAdminTabs]);

  // 2) Garde RBAC : si l'onglet actuellement affiché n'est plus habilité
  // (matrice des droits modifiée), basculer sur le premier onglet autorisé
  // plutôt que d'afficher une page vide ; le garde App (accessDenied) protège
  // l'accès au module.
  React.useEffect(() => {
    if (!allowedAdminTabs.includes(activeAdminTab)) {
      setActiveAdminTab(allowedAdminTabs[0] || 'USERS');
    }
  }, [allowedAdminTabs, activeAdminTab]);

  // Changement d'onglet demandé par l'utilisateur depuis la console :
  // applique l'onglet localement puis resynchronise la navigation globale
  // (sous-menu Administration de la Sidebar / Header).
  const handleAdminTabChange = (tab: AdminSubTab) => {
    setActiveAdminTab(tab);
    onTabChange?.(tab);
  };

  // Search & Filter state for Users
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // User Modals State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [showPermissionsMatrix, setShowPermissionsMatrix] = useState(false);

  // ─── Fermeture clavier (Échap, sommet de pile) de toutes les modales du module ───
  useEscapeClose(showAddUserModal, () => setShowAddUserModal(false));
  useEscapeClose(Boolean(editingUser), () => setEditingUser(null));
  useEscapeClose(Boolean(resetPasswordUser), () => setResetPasswordUser(null));
  useEscapeClose(Boolean(deletingUser), () => setDeletingUser(null));
  useEscapeClose(showPermissionsMatrix, () => setShowPermissionsMatrix(false));

  // Form State for Add / Edit
  const [formNom, setFormNom] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('AGENT_EXPORT');
  const [formSociete, setFormSociete] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPays, setFormPays] = useState('Côte d\'Ivoire');
  const [formEstActif, setFormEstActif] = useState(true);

  // Password reset temporary state
  const [generatedTempPass, setGeneratedTempPass] = useState('');
  const [copiedPass, setCopiedPass] = useState(false);

  // Audit Search State
  const [auditQuery, setAuditQuery] = useState('');

  // Permissions Matrix State & Persistence
  const [permissionsMatrix, setPermissionsMatrix] = useState<PermissionItem[]>(() => {
    return loadPermissionsMatrix();
  });

  const [rightsViewMode, setRightsViewMode] = useState<'PROFILES' | 'USER_SPECIFIC'>('PROFILES');
  const [selectedUserIdForRights, setSelectedUserIdForRights] = useState<number | null>(allUsers[0]?.id || null);
  const [userOverrides, setUserOverrides] = useState<Record<number, Record<string, boolean>>>(() => {
    return loadUserOverrides();
  });
  const [rightsCategoryFilter, setRightsCategoryFilter] = useState<string>('ALL');

  // Toggle permission for role
  const handleTogglePermission = (permissionId: string, role: UserRole) => {
    if (role === 'ADMIN') return; // Security lock: ADMIN always retains full permissions
    setPermissionsMatrix(prev => prev.map(item => {
      if (item.id === permissionId) {
        return {
          ...item,
          roles: {
            ...item.roles,
            [role]: !item.roles[role]
          }
        };
      }
      return item;
    }));
  };

  // Toggle permission override for individual user
  const handleToggleUserOverride = (userId: number, permissionId: string, defaultValue: boolean) => {
    setUserOverrides(prev => {
      const userMap = prev[userId] || {};
      const currentVal = userMap[permissionId] !== undefined ? userMap[permissionId] : defaultValue;
      return {
        ...prev,
        [userId]: {
          ...userMap,
          [permissionId]: !currentVal
        }
      };
    });
  };

  // Save Permissions Matrix
  const handleSavePermissions = async () => {
    try {
      await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissionsMatrix)
      });
      // Assuming overrides are still local or handled differently if we didn't migrate them yet
      // For now, let's keep overrides in local storage since we only migrated the matrix to DB
      localStorage.setItem('bocs_user_permission_overrides', JSON.stringify(userOverrides));
      
      notifyPermissionsChanged();
      onLogAudit('MODIFICATION_DROITS', 'Habilitations', 'Mise à jour et sauvegarde de la matrice d\'attribution des droits utilisateurs par profil via API.');
      toastSuccess('Matrice des droits et habilitations enregistrée avec succès !');
    } catch (e) {
      console.error(e);
    }
  };

  // Reset Permissions Matrix to default
  const handleResetPermissions = async () => {
    setPermissionsMatrix(INITIAL_PERMISSIONS);
    setUserOverrides({});
    try {
      await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(INITIAL_PERMISSIONS)
      });
    } catch (e) {}
    localStorage.removeItem('bocs_user_permission_overrides');
    // RBAC : notifie toute l'application pour réappliquer les droits d'usine
    notifyPermissionsChanged();
    onLogAudit('REINITIALISATION_DROITS', 'Habilitations', 'Réinitialisation des droits d\'accès aux valeurs par défaut BOCS.');
    toastSuccess('Droits d\'accès réinitialisés aux paramètres d\'usine !');
  };

  // Filtering users
  const filteredUsers = allUsers.filter(u => {
    const matchesSearch =
      u.nomComplet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.nomSociete && u.nomSociete.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.estActif) ||
      (statusFilter === 'INACTIVE' && !u.estActif);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Handlers for Add User
  const handleOpenAddModal = () => {
    setFormNom('');
    setFormEmail('');
    setFormRole('AGENT_EXPORT');
    setFormSociete('BOCS CI Agency');
    setFormPhone('');
    setFormPays('Côte d\'Ivoire');
    setFormEstActif(true);
    setShowAddUserModal(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNom || !formEmail) return;

    const newUser: User = {
      id: Date.now(),
      nomComplet: formNom,
      email: formEmail,
      role: formRole,
      nomSociete: formSociete || 'BOCS Maritime',
      telephone: formPhone,
      pays: formPays,
      estActif: formEstActif,
      dateCreation: new Date().toISOString().split('T')[0]
    };

    onAddUser(newUser);
    onLogAudit('CREATION_UTILISATEUR', 'User', `Création de l'utilisateur ${newUser.nomComplet} (${newUser.email}) - Rôle: ${newUser.role}`);
    setShowAddUserModal(false);
  };

  const handleConfirmPurge = () => {
    if (onClearAllData) {
      onClearAllData();
      onLogAudit('PURGE_DONNEES', 'System', 'Réinitialisation complète de la base de données et suppression des données de test.');
      toastSuccess('Toutes les données de test ont été purgées avec succès !');
    }
    setShowClearConfirmModal(false);
  };

  // Handlers for Edit User
  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setFormNom(user.nomComplet);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormSociete(user.nomSociete || '');
    setFormPhone(user.telephone || '');
    setFormPays(user.pays || 'Côte d\'Ivoire');
    setFormEstActif(user.estActif);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const updated: User = {
      ...editingUser,
      nomComplet: formNom,
      email: formEmail,
      role: formRole,
      nomSociete: formSociete,
      telephone: formPhone,
      pays: formPays,
      estActif: formEstActif
    };

    onUpdateUser(updated);
    setEditingUser(null);
  };

  // Handlers for Reset Password
  const handleOpenResetPass = (user: User) => {
    setResetPasswordUser(user);
    const temp = 'BOCS-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '!';
    setGeneratedTempPass(temp);
    setCopiedPass(false);
  };

  const handleConfirmResetPass = () => {
    if (resetPasswordUser) {
      onResetUserPassword(resetPasswordUser.id, generatedTempPass);
      setResetPasswordUser(null);
    }
  };

  const handleCopyPass = () => {
    navigator.clipboard.writeText(generatedTempPass);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  // Handlers for Delete User
  const handleConfirmDelete = () => {
    if (deletingUser) {
      onDeleteUser(deletingUser.id);
      setDeletingUser(null);
    }
  };

  // Helper labels
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-950/60 text-purple-300 border border-purple-700/50';
      case 'AGENT_IMPORT': return 'bg-blue-950/60 text-blue-300 border border-blue-700/50';
      case 'AGENT_EXPORT': return 'bg-indigo-950/60 text-indigo-300 border border-indigo-700/50';
      case 'COMPTABILITE': return 'bg-emerald-50 dark:bg-night-positive-soft text-emerald-700 border border-emerald-200 dark:border-night-positive-line';
      case 'CLIENT_EXPORT': return 'bg-[#f4f4f5] dark:bg-night-sunken text-slate-500 dark:text-night-ink-2 border border-slate-200 dark:border-night-line';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'Administrateur Système';
      case 'AGENT_IMPORT': return 'Agent Importation';
      case 'AGENT_EXPORT': return 'Agent Exportation';
      case 'COMPTABILITE': return 'Comptabilité / Facturation';
      case 'CLIENT_EXPORT': return 'Client Exportateur';
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'MARITIME': return 'bg-blue-100 dark:bg-night-accent-soft text-blue-950 border border-blue-300 font-black shadow-1';
      case 'EXPORT': return 'bg-amber-100 text-amber-950 border border-amber-300 font-black shadow-1';
      case 'FINANCE': return 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-black shadow-1';
      case 'DMDT': return 'bg-cyan-100 text-cyan-950 border border-cyan-300 font-black shadow-1';
      case 'ADMIN': return 'bg-purple-100 text-purple-950 border border-purple-300 font-black shadow-1';
      default: return 'bg-[#f4f4f5] dark:bg-night-sunken text-slate-900 dark:text-night-ink border border-slate-300 dark:border-night-line-strong font-black';
    }
  };

  const filteredLogs = auditLogs.filter(l =>
    l.utilisateurNom.toLowerCase().includes(auditQuery.toLowerCase()) ||
    l.action.toLowerCase().includes(auditQuery.toLowerCase()) ||
    l.details.toLowerCase().includes(auditQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-night-ink">

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-6 rounded-md shadow-2xl dark:shadow-black/70">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span aria-hidden="true" className="material-symbols-outlined text-rose-400 text-2xl font-black">admin_panel_settings</span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-night-ink font-heading tracking-tight">Console d'Administration &amp; Sécurité</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-night-ink-2 font-medium max-w-xl leading-relaxed">
            Gestion complète des comptes utilisateurs, matrice d'habilitations et contrôle des paramètres système BOCS Maritime.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center gap-2 bg-[#f4f4f5] dark:bg-night-sunken p-1.5 rounded-md border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30">
          {canManageUsers && (
            <button
              onClick={() => handleAdminTabChange('USERS')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${activeAdminTab === 'USERS' ? 'bg-surface-canvas dark:bg-night-surface text-[#005DAA] dark:text-night-ink border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30' : 'text-slate-600 dark:text-night-ink hover:text-slate-900 hover:bg-[#f4f4f5] dark:bg-night-sunken hover:shadow-sm dark:shadow-black/30'
                }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-lg text-slate-500 dark:text-night-ink-2">manage_accounts</span>
              <span className="font-bold">Utilisateurs & Rôles</span>
            </button>
          )}
          {canManageRights && (
            <button
              onClick={() => handleAdminTabChange('RIGHTS')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${activeAdminTab === 'RIGHTS' ? 'bg-surface-canvas dark:bg-night-surface text-[#005DAA] dark:text-night-link border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30' : 'text-slate-600 dark:text-night-ink hover:text-slate-900 hover:bg-[#f4f4f5] dark:bg-night-sunken hover:shadow-sm dark:shadow-black/30'
                }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-lg text-slate-500 dark:text-night-ink-2">shield_lock</span>
              <span className="font-bold">Attribution des Droits</span>
            </button>
          )}
          {canManageFne && (
            <button
              onClick={() => handleAdminTabChange('FNE')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${activeAdminTab === 'FNE' ? 'bg-surface-canvas dark:bg-night-surface text-[#005DAA] dark:text-night-link border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30' : 'text-slate-600 dark:text-night-ink hover:text-slate-900 hover:bg-[#f4f4f5] dark:bg-night-sunken hover:shadow-sm dark:shadow-black/30'
                }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-lg text-slate-500 dark:text-night-ink-2">tune</span>
              <span className="font-bold">Params Factures & Devise</span>
            </button>
          )}
          {canViewAudit && (
            <button
              onClick={() => handleAdminTabChange('AUDIT')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${activeAdminTab === 'AUDIT' ? 'bg-surface-canvas dark:bg-night-surface text-[#005DAA] dark:text-night-link border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30' : 'text-slate-600 dark:text-night-ink hover:text-slate-900 hover:bg-[#f4f4f5] dark:bg-night-sunken hover:shadow-sm dark:shadow-black/30'
                }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-lg text-slate-500 dark:text-night-ink-2">verified_user</span>
              <span className="font-bold">Journal d'Audit ({auditLogs.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: USERS MANAGEMENT */}
      {activeAdminTab === 'USERS' && canManageUsers && (
        <div className="space-y-6">

          {/* Bento Cards Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-4 rounded-md">
              <div className="flex items-center justify-between text-slate-500 dark:text-night-ink-2 mb-1">
                <span className="text-xs font-black uppercase font-mono">Total Comptes</span>
                <span aria-hidden="true" className="material-symbols-outlined text-xl text-emerald-600 dark:text-night-positive">group</span>
              </div>
              <span className="text-2xl font-black text-slate-900 dark:text-night-ink font-mono">{allUsers.length}</span>
              <p className="text-2xs text-slate-500 dark:text-night-ink-2 mt-0.5">Utilisateurs inscrits</p>
            </div>

            <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-4 rounded-md">
              <div className="flex items-center justify-between text-slate-500 dark:text-night-ink-2 mb-1">
                <span className="text-xs font-black uppercase font-mono">Comptes Actifs</span>
                <span aria-hidden="true" className="material-symbols-outlined text-xl text-blue-600 dark:text-night-link">check_circle</span>
              </div>
              <span className="text-2xl font-black text-blue-600 dark:text-night-link font-mono">
                {allUsers.filter(u => u.estActif).length}
              </span>
              <p className="text-2xs text-slate-500 dark:text-night-ink-2 mt-0.5">Accès autorisés</p>
            </div>

            <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-4 rounded-md">
              <div className="flex items-center justify-between text-slate-500 dark:text-night-ink-2 mb-1">
                <span className="text-xs font-black uppercase font-mono">Personnel Interne</span>
                <span aria-hidden="true" className="material-symbols-outlined text-xl text-amber-600">badge</span>
              </div>
              <span className="text-2xl font-black text-amber-600 font-mono">
                {allUsers.filter(u => u.role !== 'CLIENT_EXPORT').length}
              </span>
              <p className="text-2xs text-slate-500 dark:text-night-ink-2 mt-0.5">Agents BOCS Agency</p>
            </div>

            <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-4 rounded-md">
              <div className="flex items-center justify-between text-slate-500 dark:text-night-ink-2 mb-1">
                <span className="text-xs font-black uppercase font-mono">Clients Externe</span>
                <span aria-hidden="true" className="material-symbols-outlined text-xl text-[#005DAA] dark:text-night-link">domain</span>
              </div>
              <span className="text-2xl font-black text-[#005DAA] dark:text-night-link font-mono">
                {allUsers.filter(u => u.role === 'CLIENT_EXPORT').length}
              </span>
              <p className="text-2xs text-slate-500 dark:text-night-ink-2 mt-0.5">Portail Exportateur</p>
            </div>

            <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-4 rounded-md">
              <div className="flex items-center justify-between text-slate-500 dark:text-night-ink-2 mb-1">
                <span className="text-xs font-black uppercase font-mono">Admins Système</span>
                <span aria-hidden="true" className="material-symbols-outlined text-xl text-purple-600">shield_person</span>
              </div>
              <span className="text-2xl font-black text-purple-600 font-mono">
                {allUsers.filter(u => u.role === 'ADMIN').length}
              </span>
              <p className="text-2xs text-slate-500 dark:text-night-ink-2 mt-0.5">Droits Super-Utilisateur</p>
            </div>
          </div>

          {/* Action Toolbar & Search Filters */}
          <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-4 rounded-md flex flex-col md:flex-row items-center justify-between gap-4">

            {/* Search input */}
            <div className="relative w-full md:w-80">
              <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-night-link text-base">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, email, société..."
                className="w-full pl-9 pr-3 py-2 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line rounded-md text-sm text-slate-900 dark:text-night-ink placeholder-slate-400 focus:outline-none focus:border-[#005DAA] transition-all"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">

              {/* Role filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-500 dark:text-night-ink-2 uppercase">Rôle:</span>
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line text-slate-900 dark:text-night-ink rounded-md text-sm font-bold cursor-pointer outline-none focus:border-[#005DAA] transition-all"
                >
                  <option value="ALL">Tous les Rôles</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="AGENT_IMPORT">AGENT_IMPORT</option>
                  <option value="AGENT_EXPORT">AGENT_EXPORT</option>
                  <option value="COMPTABILITE">COMPTABILITE</option>
                  <option value="CLIENT_EXPORT">CLIENT_EXPORT</option>
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-500 dark:text-night-ink-2 uppercase">Statut:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line text-slate-900 dark:text-night-ink rounded-md text-sm font-bold cursor-pointer outline-none focus:border-[#005DAA] transition-all"
                >
                  <option value="ALL">Tous les Statuts</option>
                  <option value="ACTIVE">Actifs uniquement</option>
                  <option value="INACTIVE">Inactifs uniquement</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 ml-auto">
                {canManageRights && (
                  <button
                    onClick={() => setShowPermissionsMatrix(true)}
                    className="px-3.5 py-2 bg-surface-canvas dark:bg-night-surface hover:bg-[#f4f4f5] text-slate-600 dark:text-night-ink border border-slate-200 dark:border-night-line font-bold text-sm rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Consulter la matrice des droits par rôle"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-lg text-blue-600 dark:text-night-link">grid_on</span>
                    <span className="hidden sm:inline">Matrice des Droits</span>
                  </button>
                )}

                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-md transition-all shadow-md  flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-lg">person_add</span>
                  <span>Ajouter un Utilisateur</span>
                </button>
              </div>

            </div>

          </div>

          {/* Users Table */}
          <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 rounded-md overflow-hidden shadow-2xl dark:shadow-black/70">
            <div className="p-4 bg-[#051120]/80 border-b border-cyan-500/10 flex items-center justify-between">
              <h3 className="font-bold text-white dark:text-night-ink text-sm uppercase tracking-wider flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-blue-600 dark:text-night-link text-lg">people</span>
                <span>Répertoire des Utilisateurs BOCS Maritime ({filteredUsers.length})</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#030914] text-xs font-bold uppercase text-slate-500 dark:text-night-ink-2 border-b border-cyan-500/10">
                    <th className="p-3.5">Utilisateur</th>
                    <th className="p-3.5">Email & Contact</th>
                    <th className="p-3.5">Société / Entité</th>
                    <th className="p-3.5">Rôle Assigné</th>
                    <th className="p-3.5">Statut</th>
                    <th className="p-3.5 text-right">Actions de Gestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-night-ink-2">
                        <span aria-hidden="true" className="material-symbols-outlined text-3xl block mb-1 text-slate-500 dark:text-night-ink-2">person_off</span>
                        <span>Aucun utilisateur ne correspond à vos critères de recherche.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-[#f4f4f5] dark:bg-night-sunken transition-colors">

                        {/* Name & Avatar */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#f4f4f5] dark:bg-night-sunken text-blue-600 dark:text-night-link font-black text-sm flex items-center justify-center border border-slate-200 dark:border-night-line shadow-1">
                              {u.nomComplet.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-night-ink block">{u.nomComplet}</span>
                              <span className="text-2xs text-slate-500 dark:text-night-ink-2 font-mono">ID: #{u.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Email & Phone */}
                        <td className="p-3.5">
                          <span className="font-mono text-blue-600 dark:text-night-link block font-bold">{u.email}</span>
                          <span className="text-xs text-slate-500 dark:text-night-ink-2">{u.telephone || 'Non renseigné'}</span>
                        </td>

                        {/* Company */}
                        <td className="p-3.5 font-semibold">
                          <span className="text-slate-900 dark:text-night-ink font-bold block">{u.nomSociete || 'BOCS Maritime'}</span>
                          <span className="text-2xs text-slate-500 dark:text-night-ink-2">{u.pays || 'Côte d\'Ivoire'}</span>
                        </td>

                        {/* Role Badge */}
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-2xs font-bold border ${getRoleBadgeColor(u.role)} inline-flex items-center gap-1`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            <span>{u.role}</span>
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-3.5">
                          {u.estActif ? (
                            <span className="px-2.5 py-0.5 rounded text-2xs font-black bg-emerald-50 dark:bg-night-positive-soft text-emerald-700 border border-emerald-200 dark:border-night-positive-line">
                              ACTIF
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded text-2xs font-black bg-[#f4f4f5] dark:bg-night-sunken text-slate-500 dark:text-night-ink-2 border border-slate-200 dark:border-night-line">
                              INACTIF
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="p-1.5 text-slate-500 dark:text-night-ink-2 hover:text-blue-600 hover:bg-[#f4f4f5] dark:bg-night-sunken rounded-lg transition-all cursor-pointer"
                              title="Modifier les détails"
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-xl">edit</span>
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => handleOpenResetPass(u)}
                              className="p-1.5 text-slate-500 dark:text-night-ink-2 hover:text-amber-600 hover:bg-[#f4f4f5] dark:bg-night-sunken rounded-lg transition-all cursor-pointer"
                              title="Réinitialiser le mot de passe"
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-xl">key</span>
                            </button>

                            {/* Toggle status */}
                            <button
                              onClick={() => onToggleUserStatus(u.id)}
                              className={`px-2.5 py-1 font-bold text-xs rounded-lg transition-all cursor-pointer ${u.estActif
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-900/60'
                                : 'bg-emerald-50 dark:bg-night-positive-soft text-emerald-700 border border-emerald-200 dark:border-night-positive-line hover:bg-emerald-900/60'
                                }`}
                              title={u.estActif ? 'Désactiver le compte' : 'Activer le compte'}
                            >
                              {u.estActif ? 'Désactiver' : 'Activer'}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 text-rose-700 dark:text-night-ink-2 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Supprimer définitivement"
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-xl">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB: ATTRIBUTION DES DROITS (RBAC & MATRICE PAR PROFIL ET PAR UTILISATEUR) */}
      {activeAdminTab === 'RIGHTS' && canManageRights && (
        <div className="space-y-6">

          {/* Executive Overview Bento Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-4 rounded-md">
              <div className="flex items-center justify-between text-slate-500 dark:text-night-ink-2 mb-1">
                <span className="text-xs font-black uppercase font-mono">Profils Types</span>
                <span aria-hidden="true" className="material-symbols-outlined text-xl text-purple-600">admin_panel_settings</span>
              </div>
              <span className="text-2xl font-black text-slate-900 dark:text-night-ink font-mono">5 Profils</span>
              <p className="text-2xs text-slate-500 dark:text-night-ink-2 mt-0.5">Admin, Import, Export, Compta, Client</p>
            </div>

            <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-4 rounded-md">
              <div className="flex items-center justify-between text-slate-500 dark:text-night-ink-2 mb-1">
                <span className="text-xs font-black uppercase font-mono">Permissions Granulaires</span>
                <span aria-hidden="true" className="material-symbols-outlined text-xl text-blue-600 dark:text-night-link">shield_lock</span>
              </div>
              <span className="text-2xl font-black text-slate-900 dark:text-night-ink font-mono">{permissionsMatrix.length} Règles</span>
              <p className="text-2xs text-slate-500 dark:text-night-ink-2 mt-0.5">Habilitations système configurées</p>
            </div>

            <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-4 rounded-md">
              <div className="flex items-center justify-between text-slate-500 dark:text-night-ink-2 mb-1">
                <span className="text-xs font-black uppercase font-mono">Contrôle d'Accès</span>
                <span aria-hidden="true" className="material-symbols-outlined text-xl text-emerald-600 dark:text-night-positive">verified</span>
              </div>
              <span className="text-2xl font-black text-emerald-600 dark:text-night-positive font-mono">RBAC Actif</span>
              <p className="text-2xs text-slate-500 dark:text-night-ink-2 mt-0.5">Sécurité &amp; Traçabilité unifiée</p>
            </div>

            <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-4 rounded-md">
              <div className="flex items-center justify-between text-slate-500 dark:text-night-ink-2 mb-1">
                <span className="text-xs font-black uppercase font-mono">Mode Attribution</span>
                <span aria-hidden="true" className="material-symbols-outlined text-xl text-amber-600">tune</span>
              </div>
              <span className="text-base font-black text-white dark:text-night-ink font-sans mt-1 block">
                {rightsViewMode === 'PROFILES' ? 'Par Profil / Rôle' : 'Par Utilisateur Spécifique'}
              </span>
              <p className="text-2xs text-slate-500 dark:text-night-ink-2 mt-0.5">Personnalisation à 2 niveaux</p>
            </div>

          </div>

          {/* Controls & Mode Switcher Header */}
          <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 p-4 rounded-md flex flex-col md:flex-row items-center justify-between gap-4">

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-surface-canvas dark:bg-night-surface p-1.5 rounded-md border border-slate-200 dark:border-night-line">
              <button
                type="button"
                onClick={() => setRightsViewMode('PROFILES')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${rightsViewMode === 'PROFILES' ? 'bg-[#005DAA] dark:bg-night-accent text-white dark:text-white shadow-md ' : 'text-slate-500 dark:text-night-ink-2 hover:text-slate-900 '
                  }`}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-lg">badge</span>
                <span>Attribution par Profil (Matrice RBAC)</span>
              </button>

              <button
                type="button"
                onClick={() => setRightsViewMode('USER_SPECIFIC')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${rightsViewMode === 'USER_SPECIFIC' ? 'bg-[#005DAA] dark:bg-night-accent text-white dark:text-white shadow-md ' : 'text-slate-500 dark:text-night-ink-2 hover:text-slate-900 '
                  }`}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-lg">person_search</span>
                <span>Attribution par Utilisateur</span>
              </button>
            </div>

            {/* Actions & Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto ml-auto">
              {rightsViewMode === 'PROFILES' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-500 dark:text-night-ink-2 uppercase">Catégorie:</span>
                  <select
                    value={rightsCategoryFilter}
                    onChange={e => setRightsCategoryFilter(e.target.value)}
                    className="h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line text-slate-900 dark:text-night-ink rounded-md text-sm font-bold cursor-pointer outline-none focus:border-[#005DAA] "
                  >
                    <option value="ALL">Toutes les Catégories</option>
                    <option value="MARITIME">🚢 Maritime &amp; Escales</option>
                    <option value="EXPORT">⚓ Export &amp; Draft BL</option>
                    <option value="FINANCE">💳 Finance &amp; Facturation</option>
                    <option value="DMDT">⏱️ Surestaries &amp; DMDT</option>
                    <option value="ADMIN">🔒 Administration</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-md transition-all shadow-md  flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-lg">save</span>
                <span>Enregistrer les Habilitations</span>
              </button>

              <button
                type="button"
                onClick={handleResetPermissions}
                className="px-3.5 py-2 bg-surface-canvas dark:bg-night-surface hover:bg-[#f4f4f5] text-slate-500 dark:text-night-ink-2 border border-slate-200 dark:border-night-line font-bold text-sm rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
                title="Réinitialiser la matrice aux permissions d'origine BOCS"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-lg text-amber-600">restart_alt</span>
                <span className="hidden sm:inline">Réinitialiser</span>
              </button>
            </div>

          </div>

          {/* VIEW MODE 1: MATRICE PAR PROFIL (RBAC) */}
          {rightsViewMode === 'PROFILES' && (
            <div className="bg-surface-canvas dark:bg-night-surface rounded-md overflow-hidden shadow-2xl dark:shadow-black/70 border border-slate-300 dark:border-night-line-strong">
              <div className="p-4 bg-[#f4f4f5] dark:bg-night-sunken border-b border-slate-200 dark:border-night-line flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-black text-slate-900 dark:text-night-ink text-sm uppercase tracking-wider flex items-center gap-2">
                  <span aria-hidden="true" className="material-symbols-outlined text-blue-600 dark:text-night-link text-lg">grid_on</span>
                  <span>Matrice Interactive d'Attribution des Droits selon le Profil ({permissionsMatrix.filter(p => rightsCategoryFilter === 'ALL' || p.category === rightsCategoryFilter).length} habilitations)</span>
                </h3>
                <span className="text-xs text-slate-600 dark:text-night-ink font-semibold italic">
                  💡 Cliquez sur les cases pour accorder ou retirer un droit pour un profil
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#f4f4f5] dark:bg-night-sunken text-slate-900 dark:text-night-ink text-xs font-black uppercase tracking-wider border-b border-slate-300 dark:border-night-line-strong">
                      <th className="p-4 w-2/5 font-black text-slate-900 dark:text-night-ink bg-[#f4f4f5] dark:bg-night-sunken">Permission / Module Applicatif</th>
                      <th className="p-4 text-center w-28 bg-purple-100 text-purple-900 border-l border-purple-300 font-black">
                        ADMIN
                      </th>
                      <th className="p-4 text-center w-28 bg-blue-100 dark:bg-night-accent-soft text-blue-900 border-l border-blue-300 font-black">
                        IMPORT
                      </th>
                      <th className="p-4 text-center w-28 bg-amber-100 text-amber-900 border-l border-amber-300 font-black">
                        EXPORT
                      </th>
                      <th className="p-4 text-center w-28 bg-emerald-100 text-emerald-900 border-l border-emerald-300 font-black">
                        COMPTA
                      </th>
                      <th className="p-4 text-center w-28 bg-indigo-100 text-indigo-900 border-l border-indigo-300 font-black">
                        CLIENT
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface-canvas dark:bg-night-surface divide-y divide-slate-200 dark:divide-night-line text-sm">
                    {permissionsMatrix
                      .filter(perm => rightsCategoryFilter === 'ALL' || perm.category === rightsCategoryFilter)
                      .map((perm) => (
                        <tr key={perm.id} className="hover:bg-[#f4f4f5] dark:bg-night-sunken transition-colors">

                          {/* Permission info */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-2xs font-mono px-2 py-0.5 rounded ${getCategoryBadgeClass(perm.category)} shrink-0`}>
                                {perm.category}
                              </span>
                              <span className="font-black text-slate-900 dark:text-night-ink text-base tracking-tight">{perm.label}</span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-night-ink font-medium mt-1 leading-normal pl-0 sm:pl-[74px]">
                              {perm.description}
                            </p>
                          </td>

                          {/* ADMIN Column (Locked) */}
                          <td className="p-4 text-center border-l border-slate-200 dark:border-night-line bg-purple-50/40">
                            <div className="inline-flex items-center gap-1.5 text-purple-950 bg-purple-100 border border-purple-300 px-3 py-1.5 rounded-full text-sm font-black shadow-1">
                              <span aria-hidden="true" className="material-symbols-outlined text-base text-purple-700">shield</span>
                              <span>Vérifié</span>
                            </div>
                          </td>

                          {/* AGENT_IMPORT Toggle */}
                          <td className="p-4 text-center border-l border-slate-200 dark:border-night-line bg-blue-50 dark:bg-night-accent-soft/30">
                            <button
                              type="button"
                              onClick={() => handleTogglePermission(perm.id, 'AGENT_IMPORT')}
                              className={`w-full py-2 px-3 rounded-md text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-1 active:scale-95 ${perm.roles.AGENT_IMPORT
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white dark:text-night-ink border border-emerald-700 font-black'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300 font-black'
                                }`}
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-lg">
                                {perm.roles.AGENT_IMPORT ? 'check_circle' : 'cancel'}
                              </span>
                              <span>{perm.roles.AGENT_IMPORT ? 'Autorisé' : 'Interdit'}</span>
                            </button>
                          </td>

                          {/* AGENT_EXPORT Toggle */}
                          <td className="p-4 text-center border-l border-slate-200 dark:border-night-line bg-amber-50/30">
                            <button
                              type="button"
                              onClick={() => handleTogglePermission(perm.id, 'AGENT_EXPORT')}
                              className={`w-full py-2 px-3 rounded-md text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-1 active:scale-95 ${perm.roles.AGENT_EXPORT
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white dark:text-night-ink border border-emerald-700 font-black'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300 font-black'
                                }`}
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-lg">
                                {perm.roles.AGENT_EXPORT ? 'check_circle' : 'cancel'}
                              </span>
                              <span>{perm.roles.AGENT_EXPORT ? 'Autorisé' : 'Interdit'}</span>
                            </button>
                          </td>

                          {/* COMPTABILITE Toggle */}
                          <td className="p-4 text-center border-l border-slate-200 dark:border-night-line bg-emerald-50 dark:bg-night-positive-soft/30">
                            <button
                              type="button"
                              onClick={() => handleTogglePermission(perm.id, 'COMPTABILITE')}
                              className={`w-full py-2 px-3 rounded-md text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-1 active:scale-95 ${perm.roles.COMPTABILITE
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white dark:text-night-ink border border-emerald-700 font-black'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300 font-black'
                                }`}
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-lg">
                                {perm.roles.COMPTABILITE ? 'check_circle' : 'cancel'}
                              </span>
                              <span>{perm.roles.COMPTABILITE ? 'Autorisé' : 'Interdit'}</span>
                            </button>
                          </td>

                          {/* CLIENT_EXPORT Toggle */}
                          <td className="p-4 text-center border-l border-slate-200 dark:border-night-line bg-indigo-50/30">
                            <button
                              type="button"
                              onClick={() => handleTogglePermission(perm.id, 'CLIENT_EXPORT')}
                              className={`w-full py-2 px-3 rounded-md text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-1 active:scale-95 ${perm.roles.CLIENT_EXPORT
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white dark:text-night-ink border border-emerald-700 font-black'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300 font-black'
                                }`}
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-lg">
                                {perm.roles.CLIENT_EXPORT ? 'check_circle' : 'cancel'}
                              </span>
                              <span>{perm.roles.CLIENT_EXPORT ? 'Autorisé' : 'Interdit'}</span>
                            </button>
                          </td>

                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: ATTRIBUTION PAR UTILISATEUR SPÉCIFIQUE */}
          {rightsViewMode === 'USER_SPECIFIC' && (
            <div className="bg-surface-canvas dark:bg-night-surface rounded-md p-6 space-y-6 shadow-xl dark:shadow-black/60 border border-slate-300 dark:border-night-line-strong">

              {/* User Selection Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-night-line">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-night-ink flex items-center gap-2">
                    <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link">person_search</span>
                    <span>Personnalisation des Droits d'un Utilisateur</span>
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-night-ink font-medium mt-0.5">
                    Sélectionnez un compte d'utilisateur pour personnaliser ses habilitations individuelles par rapport à son profil d'origine.
                  </p>
                </div>

                {/* Select User Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-night-ink">Utilisateur:</span>
                  <select
                    value={selectedUserIdForRights || ''}
                    onChange={e => setSelectedUserIdForRights(Number(e.target.value))}
                    className="h-10 px-4 bg-[#f4f4f5] dark:bg-night-sunken border border-slate-300 dark:border-night-line-strong text-slate-900 dark:text-night-ink rounded-md text-sm font-bold cursor-pointer outline-none focus:border-[#005DAA] "
                  >
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.nomComplet} ({u.role} - {u.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected User Info Banner */}
              {(() => {
                const targetUser = allUsers.find(u => u.id === selectedUserIdForRights) || allUsers[0];
                if (!targetUser) return null;
                const userRoleOverridden = userOverrides[targetUser.id] || {};

                return (
                  <div className="space-y-6">
                    <div className="bg-[#f4f4f5] dark:bg-night-sunken p-4 rounded-md border border-slate-200 dark:border-night-line flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#005DAA] dark:bg-night-accent text-white dark:text-white flex items-center justify-center font-black text-base shadow-1">
                          {targetUser.nomComplet.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 dark:text-night-ink text-base">{targetUser.nomComplet}</span>
                            <span className={`px-2 py-0.5 rounded text-2xs font-bold ${getRoleBadgeColor(targetUser.role)}`}>
                              {targetUser.role}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-night-ink font-mono font-semibold mt-0.5">{targetUser.email} • {targetUser.nomSociete || 'BOCS Maritime'}</p>
                        </div>
                      </div>

                      <div className="text-sm font-bold text-slate-700 dark:text-night-ink flex items-center gap-3">
                        <span>Statut: {targetUser.estActif ? '🟢 Compte Actif' : '🔴 Compte Suspendu'}</span>
                      </div>
                    </div>

                    {/* Permissions list for this user */}
                    <div className="border border-slate-300 dark:border-night-line-strong rounded-md overflow-x-auto shadow-1 bg-surface-canvas dark:bg-night-surface">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-[#f4f4f5] dark:bg-night-sunken text-slate-900 dark:text-night-ink text-xs font-black uppercase border-b border-slate-300 dark:border-night-line-strong">
                            <th className="p-3.5">Fonctionnalité Applicative</th>
                            <th className="p-3.5 text-center">Droit par Défaut (Rôle {targetUser.role})</th>
                            <th className="p-3.5 text-center">Droit Attribué à l'Utilisateur</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-night-line bg-surface-canvas dark:bg-night-surface">
                          {permissionsMatrix.map(perm => {
                            const defaultRoleVal = perm.roles[targetUser.role];
                            const overrideVal = userRoleOverridden[perm.id];
                            const effectiveVal = overrideVal !== undefined ? overrideVal : defaultRoleVal;
                            const isOverridden = overrideVal !== undefined && overrideVal !== defaultRoleVal;

                            return (
                              <tr key={perm.id} className="hover:bg-[#f4f4f5] dark:bg-night-sunken transition-colors">
                                <td className="p-3.5">
                                  <div className="font-black text-slate-900 dark:text-night-ink text-base">{perm.label}</div>
                                  <div className="text-sm text-slate-600 dark:text-night-ink font-medium mt-0.5">{perm.description}</div>
                                </td>

                                <td className="p-3.5 text-center font-bold">
                                  <span className={defaultRoleVal ? 'text-emerald-700 font-black' : 'text-slate-500 dark:text-night-ink-2 font-bold'}>
                                    {defaultRoleVal ? '✓ Autorisé par rôle' : '✕ Interdit par rôle'}
                                  </span>
                                </td>

                                <td className="p-3.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserOverride(targetUser.id, perm.id, defaultRoleVal)}
                                    className={`px-4 py-2 rounded-md text-sm font-black transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-1 active:scale-95 ${effectiveVal
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white dark:text-night-ink border border-emerald-700'
                                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300'
                                      }`}
                                  >
                                    <span aria-hidden="true" className="material-symbols-outlined text-base">
                                      {effectiveVal ? 'check_circle' : 'do_not_disturb_on'}
                                    </span>
                                    <span>{effectiveVal ? 'Accès Autorisé' : 'Accès Restreint'}</span>
                                    {isOverridden && (
                                      <span className="ml-1 text-2xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-black">
                                        Exception
                                      </span>
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

        </div>
      )}

      {/* TAB 2: FNE PARAMS & DEVISE */}
      {activeAdminTab === 'FNE' && canManageFne && (
        <div className="space-y-6">

          {/* Currency Exchange Rate Box */}
          <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 rounded-md p-6 shadow-xl dark:shadow-black/60">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white dark:text-night-ink flex items-center gap-2">
                  <span aria-hidden="true" className="material-symbols-outlined text-blue-600 dark:text-night-link">currency_exchange</span>
                  <span>Taux de Conversion Officiel BOCS (USD / FCFA)</span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-night-ink-2 mt-1">
                  Ce taux fixe permet la conversion instantanée des montants de fret et surestaries exprimés en Dollars USD lors de la facturation.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-surface-canvas dark:bg-night-surface p-3 rounded-md border border-slate-200 dark:border-night-line">
                <span className="text-base font-bold text-slate-500 dark:text-night-ink-2">1 USD =</span>
                <input
                  type="number"
                  step="0.01"
                  value={exchangeRateUsd}
                  onChange={e => onUpdateExchangeRate(parseFloat(e.target.value) || 600)}
                  className="w-28 px-3 py-1.5 bg-[#050e1a] border border-slate-200 dark:border-night-line rounded-lg font-mono font-black text-blue-600 dark:text-night-link text-base focus:outline-none focus:border-[#005DAA] text-right"
                />
                <span className="text-base font-black text-blue-600 dark:text-night-link">FCFA</span>
              </div>
            </div>
          </div>

          {/* FNE DGI Params Table */}
          <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 rounded-md p-6 space-y-6 shadow-xl dark:shadow-black/60">
            <div className="border-b border-cyan-500/10 pb-4">
              <h2 className="text-xl font-bold text-primaryDark flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-blue-600 dark:text-night-link">receipt_long</span>
                <span>Paramètres de la Facturation & Devise</span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-night-ink-2">
                Configuration générale du système de facturation et devises de référence.
              </p>
            </div>

            <div className="space-y-4">
              {fneParams.map(param => (
                <div key={param.id} className="p-4 bg-surface-canvas dark:bg-night-surface border border-cyan-500/15 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm hover:border-cyan-400/40 transition-all">
                  <div>
                    <span className="font-bold text-blue-600 dark:text-night-link uppercase text-sm block font-mono">{param.cle}</span>
                    <p className="text-slate-500 dark:text-night-ink-2 mt-0.5">{param.description}</p>
                    <span className="text-2xs text-slate-500 dark:text-night-ink-2">Dernière révision: {param.updatedAt}</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      defaultValue={param.valeur}
                      onBlur={e => {
                        onUpdateFneParam(param.cle, e.target.value);
                        onLogAudit('PARAMETRE_FNE_MODIFIE', 'FneParam', `Mise à jour de la clé ${param.cle}`);
                      }}
                      className="px-3 py-2 bg-[#071322] border border-slate-200 dark:border-night-line rounded-lg text-sm font-mono font-bold text-white dark:text-night-ink w-full sm:w-80 focus:border-[#005DAA] focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: AUDIT TRAIL LOGS */}
      {activeAdminTab === 'AUDIT' && canViewAudit && (
        <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 rounded-md overflow-hidden shadow-2xl dark:shadow-black/70">
          <div className="p-4 bg-[#051120]/80 border-b border-cyan-500/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <h3 className="font-bold text-white dark:text-night-ink text-sm uppercase tracking-wider flex items-center gap-2">
              <span aria-hidden="true" className="material-symbols-outlined text-blue-600 dark:text-night-link text-lg">verified_user</span>
              <span>Journal d'Audit Système & Sécurité ({filteredLogs.length} événements enregistrés)</span>
            </h3>

            <div className="relative w-full sm:w-72">
              <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-night-link text-base">search</span>
              <input
                type="text"
                value={auditQuery}
                onChange={e => setAuditQuery(e.target.value)}
                placeholder="Rechercher action, utilisateur, IP..."
                className="w-full pl-9 pr-3 py-1.5 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line rounded-lg text-sm text-slate-900 dark:text-night-ink placeholder-slate-400 focus:outline-none focus:border-[#005DAA] "
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[#030914] text-xs font-bold uppercase text-slate-500 dark:text-night-ink-2 border-b border-cyan-500/10">
                  <th className="p-3.5">Horodatage</th>
                  <th className="p-3.5">Opérateur</th>
                  <th className="p-3.5">Rôle</th>
                  <th className="p-3.5">Action Système</th>
                  <th className="p-3.5">Entité Cible</th>
                  <th className="p-3.5">Détails Opératoires</th>
                  <th className="p-3.5 text-right">Adresse IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500 dark:text-night-ink-2 font-sans">
                      Aucune entrée de journal ne correspond à votre recherche.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-[#f4f4f5] dark:bg-night-sunken transition-colors">
                      <td className="p-3.5 text-slate-500 dark:text-night-ink-2 text-xs">{log.dateAction}</td>
                      <td className="p-3.5 font-bold text-white dark:text-night-ink font-sans">{log.utilisateurNom}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-2xs font-bold border ${getRoleBadgeColor(log.role)}`}>
                          {log.role}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-blue-600 dark:text-night-link">{log.action}</td>
                      <td className="p-3.5 text-slate-500 dark:text-night-ink-2">{log.entite}</td>
                      <td className="p-3.5 text-slate-500 dark:text-night-ink-2 text-sm font-sans truncate max-w-xs" title={log.details}>
                        {log.details}
                      </td>
                      <td className="p-3.5 text-right text-slate-500 dark:text-night-ink-2 text-xs">{log.ip || '127.0.0.1'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD USER */}
      {showAddUserModal && (
        <div role="dialog" aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in"
          onClick={overlayClickClose(() => setShowAddUserModal(false))}
        >
          <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 border border-slate-200 rounded-md shadow-[0_25px_50px_rgba(0,0,0,0.8)] max-w-lg w-full p-6 space-y-4 text-white dark:text-night-ink">

            <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
              <h3 className="font-bold text-xl text-white dark:text-night-ink flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-blue-600 dark:text-night-link">person_add</span>
                <span>Créer un Compte Utilisateur</span>
              </h3>
              <button aria-label="Fermer" onClick={() => setShowAddUserModal(false)} className="text-slate-500 dark:text-night-ink-2 hover:text-slate-900 cursor-pointer">
                <span aria-hidden="true" className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-sm">

              <div>
                <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Nom et Prénom *</label>
                <input
                  type="text"
                  required
                  value={formNom}
                  onChange={e => setFormNom(e.target.value)}
                  placeholder="ex: Jean-Baptiste KOFFI"
                  className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line rounded-md text-slate-900 dark:text-night-ink placeholder-slate-400 focus:outline-none focus:border-[#005DAA] text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Adresse E-mail Professionnelle *</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="j.koffi@bocs-maritime.com"
                  className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line rounded-md text-slate-900 dark:text-night-ink placeholder-slate-400 focus:outline-none focus:border-[#005DAA] text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Rôle et Habilitations *</label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value as UserRole)}
                    className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line text-slate-900 dark:text-night-ink rounded-md font-bold text-sm cursor-pointer outline-none focus:border-[#005DAA] transition-all"
                  >
                    <option value="ADMIN">ADMIN - Administrateur Système</option>
                    <option value="AGENT_IMPORT">AGENT_IMPORT - Service Import</option>
                    <option value="AGENT_EXPORT">AGENT_EXPORT - Service Export</option>
                    <option value="COMPTABILITE">COMPTABILITE - Facturation & Encaissements</option>
                    <option value="CLIENT_EXPORT">CLIENT_EXPORT - Portail Client</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line rounded-md text-slate-900 dark:text-night-ink placeholder-slate-400 focus:outline-none focus:border-[#005DAA] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Société / Entité</label>
                  <input
                    type="text"
                    value={formSociete}
                    onChange={e => setFormSociete(e.target.value)}
                    placeholder="BOCS CI Agency"
                    className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line rounded-md text-slate-900 dark:text-night-ink placeholder-slate-400 focus:outline-none focus:border-[#005DAA] text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Pays d'Implantation</label>
                  <input
                    type="text"
                    value={formPays}
                    onChange={e => setFormPays(e.target.value)}
                    placeholder="Côte d'Ivoire"
                    className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line rounded-md text-slate-900 dark:text-night-ink placeholder-slate-400 focus:outline-none focus:border-[#005DAA] text-sm"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEstActif}
                    onChange={e => setFormEstActif(e.target.checked)}
                    className="rounded border-slate-200 dark:border-night-line bg-surface-canvas dark:bg-night-surface text-blue-600 dark:text-night-link focus:ring-cyan-400"
                  />
                  <span className="font-semibold text-slate-500 dark:text-night-ink-2">Activer l'accès au compte immédiatement</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-cyan-500/15">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-surface-canvas dark:bg-night-surface hover:bg-[#f4f4f5] rounded-md font-bold text-slate-500 dark:text-night-ink-2 border border-slate-200 dark:border-night-line cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-md transition-all shadow-md  cursor-pointer active:scale-95"
                >
                  Créer l'Utilisateur
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {editingUser && (
        <div role="dialog" aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in"
          onClick={overlayClickClose(() => setEditingUser(null))}
        >
          <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 border border-slate-200 rounded-md shadow-[0_25px_50px_rgba(0,0,0,0.8)] max-w-lg w-full p-6 space-y-4 text-white dark:text-night-ink">

            <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
              <h3 className="font-bold text-xl text-white dark:text-night-ink flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-blue-600 dark:text-night-link">edit_note</span>
                <span>Modifier le Compte #{editingUser.id}</span>
              </h3>
              <button aria-label="Fermer" onClick={() => setEditingUser(null)} className="text-slate-500 dark:text-night-ink-2 hover:text-slate-900 cursor-pointer">
                <span aria-hidden="true" className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-sm">

              <div>
                <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Nom et Prénom</label>
                <input
                  type="text"
                  required
                  value={formNom}
                  onChange={e => setFormNom(e.target.value)}
                  className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line rounded-md text-slate-900 dark:text-night-ink placeholder-slate-400 focus:outline-none focus:border-[#005DAA] text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Adresse E-mail</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line rounded-md text-slate-900 dark:text-night-ink placeholder-slate-400 focus:outline-none focus:border-[#005DAA] text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Rôle Assigné</label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value as UserRole)}
                    className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line text-slate-900 dark:text-night-ink rounded-md font-bold text-sm cursor-pointer outline-none focus:border-[#005DAA] transition-all"
                  >
                    <option value="ADMIN">ADMIN - Administrateur</option>
                    <option value="AGENT_IMPORT">AGENT_IMPORT - Import</option>
                    <option value="AGENT_EXPORT">AGENT_EXPORT - Export</option>
                    <option value="COMPTABILITE">COMPTABILITE - Facturation</option>
                    <option value="CLIENT_EXPORT">CLIENT_EXPORT - Client</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line rounded-md text-slate-900 dark:text-night-ink placeholder-slate-400 focus:outline-none focus:border-[#005DAA] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Société</label>
                  <input
                    type="text"
                    value={formSociete}
                    onChange={e => setFormSociete(e.target.value)}
                    className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line rounded-md text-slate-900 dark:text-night-ink placeholder-slate-400 focus:outline-none focus:border-[#005DAA] text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-500 dark:text-night-ink-2 uppercase mb-1">Statut du Compte</label>
                  <select
                    value={formEstActif ? 'ACTIF' : 'INACTIF'}
                    onChange={e => setFormEstActif(e.target.value === 'ACTIF')}
                    className="w-full h-9 px-3 bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line text-slate-900 dark:text-night-ink rounded-md font-bold text-sm cursor-pointer outline-none focus:border-[#005DAA] transition-all"
                  >
                    <option value="ACTIF">ACTIF (Accès Autorisé)</option>
                    <option value="INACTIF">INACTIF (Accès Bloqué)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-cyan-500/15">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-surface-canvas dark:bg-night-surface hover:bg-[#f4f4f5] rounded-md font-bold text-slate-500 dark:text-night-ink-2 border border-slate-200 dark:border-night-line cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-md transition-all shadow-md  cursor-pointer active:scale-95"
                >
                  Enregistrer les modifications
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetPasswordUser && (
        <div role="dialog" aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in"
          onClick={overlayClickClose(() => setResetPasswordUser(null))}
        >
          <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 border border-amber-500/30 rounded-md shadow-[0_25px_50px_rgba(0,0,0,0.8)] max-w-md w-full p-6 space-y-4 text-white dark:text-night-ink">

            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <h3 className="font-bold text-xl text-white dark:text-night-ink flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-amber-600">key</span>
                <span>Réinitialiser le Mot de Passe</span>
              </h3>
              <button aria-label="Fermer" onClick={() => setResetPasswordUser(null)} className="text-slate-500 dark:text-night-ink-2 hover:text-slate-900 cursor-pointer">
                <span aria-hidden="true" className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-sm text-slate-500 dark:text-night-ink-2">
              Un mot de passe temporaire à usage unique a été généré pour l'utilisateur <strong className="text-white dark:text-night-ink">{resetPasswordUser.nomComplet}</strong> ({resetPasswordUser.email}).
            </p>

            <div className="p-3 bg-amber-50 border border-amber-500/30 rounded-md flex items-center justify-between">
              <code className="font-mono text-lg font-black text-amber-700">{generatedTempPass}</code>
              <button
                type="button"
                onClick={handleCopyPass}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-base">{copiedPass ? 'check' : 'content_copy'}</span>
                <span>{copiedPass ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-night-ink-2">
              Transmettez ce mot de passe temporaire à l'utilisateur. Il sera invité à le remplacer lors de sa prochaine connexion.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={handleConfirmResetPass}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-md transition-all cursor-pointer active:scale-95"
              >
                Confirmer & Enregistrer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE */}
      {deletingUser && (
        <div role="dialog" aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in"
          onClick={overlayClickClose(() => setDeletingUser(null))}
        >
          <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 border border-rose-500/30 rounded-md shadow-[0_25px_50px_rgba(0,0,0,0.8)] max-w-md w-full p-6 space-y-4 text-white dark:text-night-ink">

            <div className="flex items-center gap-3 text-rose-400 border-b border-rose-500/20 pb-3">
              <span aria-hidden="true" className="material-symbols-outlined text-3xl">warning</span>
              <div>
                <h3 className="font-bold text-xl text-white dark:text-night-ink">Confirmer la Suppression</h3>
                <p className="text-sm text-slate-500 dark:text-night-ink-2">Action irréversible sur le compte</p>
              </div>
            </div>

            <p className="text-sm text-slate-500 dark:text-night-ink-2 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le compte utilisateur <strong className="text-white dark:text-night-ink">{deletingUser.nomComplet}</strong> ({deletingUser.email}) ?
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 bg-surface-canvas dark:bg-night-surface hover:bg-[#f4f4f5] rounded-md font-bold text-sm text-slate-500 dark:text-night-ink-2 border border-slate-200 dark:border-night-line cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white dark:text-night-ink font-bold text-sm rounded-md transition-all cursor-pointer active:scale-95"
              >
                Supprimer le compte
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: PERMISSIONS & ROLES MATRIX */}
      {showPermissionsMatrix && (
        <div role="dialog" aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in"
          onClick={overlayClickClose(() => setShowPermissionsMatrix(false))}
        >
          <div className="bg-surface-canvas dark:bg-night-surface border border-slate-200 dark:border-night-line shadow-sm dark:shadow-black/30 border border-slate-200 rounded-md shadow-[0_25px_50px_rgba(0,0,0,0.8)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col p-6 space-y-4 text-white dark:text-night-ink">

            <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
              <div>
                <h3 className="font-bold text-xl text-white dark:text-night-ink flex items-center gap-2">
                  <span aria-hidden="true" className="material-symbols-outlined text-blue-600 dark:text-night-link">grid_on</span>
                  <span>Matrice des Droits & Habilitations par Rôle</span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-night-ink-2">Contrôle d'accès basé sur les rôles (RBAC) au sein de la plateforme BOCS Maritime.</p>
              </div>
              <button aria-label="Fermer" onClick={() => setShowPermissionsMatrix(false)} className="text-slate-500 dark:text-night-ink-2 hover:text-slate-900 cursor-pointer">
                <span aria-hidden="true" className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-auto flex-1 border border-slate-800 rounded-md">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#051424] text-xs font-bold uppercase text-slate-500 dark:text-night-ink-2 border-b border-slate-800">
                    <th className="p-3.5 border-b border-slate-800">Fonctionnalité / Module</th>
                    <th className="p-3.5 text-center border-b border-slate-800">ADMIN</th>
                    <th className="p-3.5 text-center border-b border-slate-800">AGENT_IMPORT</th>
                    <th className="p-3.5 text-center border-b border-slate-800">AGENT_EXPORT</th>
                    <th className="p-3.5 text-center border-b border-slate-800">COMPTABILITE</th>
                    <th className="p-3.5 text-center border-b border-slate-800">CLIENT_EXPORT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-sm">

                  <tr>
                    <td className="p-3.5 font-bold text-white dark:text-night-ink">Tableau de Bord Global</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Accès Total</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Accès Total</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Accès Total</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Accès Total</td>
                    <td className="p-3.5 text-center text-amber-600 font-bold">⚠️ Restreint Client</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white dark:text-night-ink">Fleet Radar (Suivi Escales)</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Lecture / Écriture</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Lecture / Écriture</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Lecture / Écriture</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Lecture Seule</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Masqué</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white dark:text-night-ink">Import (Manifeste XML & DMDT)</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Contrôle Total</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Import & Calculs</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Masqué</td>
                    <td className="p-3.5 text-center text-amber-600 font-bold">⚠️ Facturation uniquement</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Masqué</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white dark:text-night-ink">Export (Draft BL & Validation)</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Validation & BL</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Masqué</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Validation & BL</td>
                    <td className="p-3.5 text-center text-amber-600 font-bold">⚠️ Facturation uniquement</td>
                    <td className="p-3.5 text-center text-indigo-400 font-bold">✓ Saisie Drafts Propres</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white dark:text-night-ink">Facturation & Encaissements</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Émission & Paiements</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Proforma Import</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Proforma Export</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Émission Factures & Saisie Paiements</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Lecture Factures Propres</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white dark:text-night-ink">Gestion des Utilisateurs & Rôles</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Admin Exclusif</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Interdit</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white dark:text-night-ink">Journal d'Audit & Paramètres</td>
                    <td className="p-3.5 text-center text-emerald-600 dark:text-night-positive font-bold">✓ Admin Exclusif</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500 dark:text-night-ink-2">✕ Interdit</td>
                  </tr>

                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPermissionsMatrix(false)}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-sm rounded-md transition-all cursor-pointer active:scale-95"
              >
                Fermer la Matrice
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
