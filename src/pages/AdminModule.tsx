import React, { useState } from 'react';
import { toastSuccess } from '../components/common/Toast';
import { FneParam, AuditLog, UserRole, User } from '../types';
import { INITIAL_PERMISSIONS, hasPermission, notifyPermissionsChanged } from '../utils/permissions';
import type { PermissionItem } from '../utils/permissions';
import { useEscapeClose, overlayClickClose } from '../hooks/useEscapeClose';

// ⚠️ Source canonique des habilitations déplacée dans src/utils/permissions.ts
// (moteur RBAC partagé par App, Sidebar, Header et Dashboard).
export { INITIAL_PERMISSIONS };
export type { PermissionItem };


interface AdminModuleProps {
  initialTab?: 'USERS' | 'RIGHTS' | 'FNE' | 'AUDIT';
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
  const [activeAdminTab, setActiveAdminTab] = useState<'USERS' | 'RIGHTS' | 'FNE' | 'AUDIT'>(initialTab);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  // RBAC : habilitations effectives du rôle courant dans la console d'administration
  // (overrides individuels prioritaires sur la matrice par rôle)
  const permissionSubject = currentUser || { id: -1, role: userRole };
  const canManageUsers = hasPermission(permissionSubject, 'admin_users_manage');
  const canManageRights = hasPermission(permissionSubject, 'admin_rights_assign');
  const canManageFne = hasPermission(permissionSubject, 'fne_certification');
  const canViewAudit = hasPermission(permissionSubject, 'admin_audit_logs');

  React.useEffect(() => {
    if (initialTab) {
      const isAllowedTab =
        (initialTab === 'USERS' && canManageUsers) ||
        (initialTab === 'RIGHTS' && canManageRights) ||
        (initialTab === 'FNE' && canManageFne) ||
        (initialTab === 'AUDIT' && canViewAudit);
      // RBAC : si l'utilisateur n'a aucune habilitation dans la console, rester sur l'onglet par défaut
      // plutôt que d'afficher une page blanche ; le garde App (accessDenied) protège l'accès au module.
      if (isAllowedTab) {
        setActiveAdminTab(initialTab);
      } else if (!canManageUsers && !canManageRights && !canManageFne && !canViewAudit) {
        setActiveAdminTab('USERS');
      } else if (activeAdminTab === 'USERS' && !canManageUsers) {
        setActiveAdminTab(canManageRights ? 'RIGHTS' : canManageFne ? 'FNE' : canViewAudit ? 'AUDIT' : 'USERS');
      }
    }
  }, [initialTab, canManageUsers, canManageRights, canManageFne, canViewAudit, activeAdminTab]);

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
    try {
      const saved = localStorage.getItem('bocs_permissions_matrix');
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return INITIAL_PERMISSIONS;
  });

  const [rightsViewMode, setRightsViewMode] = useState<'PROFILES' | 'USER_SPECIFIC'>('PROFILES');
  const [selectedUserIdForRights, setSelectedUserIdForRights] = useState<number | null>(allUsers[0]?.id || null);
  const [userOverrides, setUserOverrides] = useState<Record<number, Record<string, boolean>>>(() => {
    try {
      const saved = localStorage.getItem('bocs_user_permission_overrides');
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return {};
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
  const handleSavePermissions = () => {
    localStorage.setItem('bocs_permissions_matrix', JSON.stringify(permissionsMatrix));
    localStorage.setItem('bocs_user_permission_overrides', JSON.stringify(userOverrides));
    // RBAC : notifie toute l'application pour appliquer immédiatement les nouveaux droits
    notifyPermissionsChanged();
    onLogAudit('MODIFICATION_DROITS', 'Habilitations', 'Mise à jour et sauvegarde de la matrice d\'attribution des droits utilisateurs par profil.');
    toastSuccess('Matrice des droits et habilitations enregistrée avec succès !');
  };

  // Reset Permissions Matrix to default
  const handleResetPermissions = () => {
    setPermissionsMatrix(INITIAL_PERMISSIONS);
    setUserOverrides({});
    localStorage.removeItem('bocs_permissions_matrix');
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
      case 'COMPTABILITE': return 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50';
      case 'CLIENT_EXPORT': return 'bg-slate-800 text-slate-300 border border-slate-700';
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
      case 'MARITIME': return 'bg-blue-100 text-blue-950 border border-blue-300 font-black shadow-2xs';
      case 'EXPORT': return 'bg-amber-100 text-amber-950 border border-amber-300 font-black shadow-2xs';
      case 'FINANCE': return 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-black shadow-2xs';
      case 'DMDT': return 'bg-cyan-100 text-cyan-950 border border-cyan-300 font-black shadow-2xs';
      case 'ADMIN': return 'bg-purple-100 text-purple-950 border border-purple-300 font-black shadow-2xs';
      default: return 'bg-slate-100 text-slate-900 border border-slate-300 font-black';
    }
  };

  const filteredLogs = auditLogs.filter(l =>
    l.utilisateurNom.toLowerCase().includes(auditQuery.toLowerCase()) ||
    l.action.toLowerCase().includes(auditQuery.toLowerCase()) ||
    l.details.toLowerCase().includes(auditQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 ocean-glass-banner p-6 rounded-2xl shadow-2xl">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="material-symbols-outlined text-rose-400 text-2xl font-black">admin_panel_settings</span>
            <h1 className="text-2xl font-black text-white font-heading tracking-tight">Console d'Administration &amp; Sécurité</h1>
          </div>
          <p className="text-xs text-slate-400 font-medium max-w-xl leading-relaxed">
            Gestion complète des comptes utilisateurs, matrice d'habilitations et contrôle des paramètres système BOCS Maritime.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0F172A] p-1.5 rounded-xl border border-slate-700/80 shadow-sm">
          {canManageUsers && (
            <button
              onClick={() => setActiveAdminTab('USERS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeAdminTab === 'USERS' ? 'premium-btn-primary text-white font-black shadow-md' : 'text-slate-200 hover:text-white hover:bg-slate-800/80'
                }`}
            >
              <span className="material-symbols-outlined text-base text-slate-300">manage_accounts</span>
              <span className="font-bold text-white">Utilisateurs & Rôles</span>
            </button>
          )}
          {canManageRights && (
            <button
              onClick={() => setActiveAdminTab('RIGHTS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeAdminTab === 'RIGHTS' ? 'premium-btn-primary text-white font-black shadow-md' : 'text-slate-200 hover:text-white hover:bg-slate-800/80'
                }`}
            >
              <span className="material-symbols-outlined text-base text-slate-300">shield_lock</span>
              <span className="font-bold text-white">Attribution des Droits</span>
            </button>
          )}
          {canManageFne && (
            <button
              onClick={() => setActiveAdminTab('FNE')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeAdminTab === 'FNE' ? 'premium-btn-primary text-white font-black shadow-md' : 'text-slate-200 hover:text-white hover:bg-slate-800/80'
                }`}
            >
              <span className="material-symbols-outlined text-base text-slate-300">tune</span>
              <span className="font-bold text-white">Params Factures & Devise</span>
            </button>
          )}
          {canViewAudit && (
            <button
              onClick={() => setActiveAdminTab('AUDIT')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeAdminTab === 'AUDIT' ? 'premium-btn-primary text-white font-black shadow-md' : 'text-slate-200 hover:text-white hover:bg-slate-800/80'
                }`}
            >
              <span className="material-symbols-outlined text-base text-slate-300">verified_user</span>
              <span className="font-bold text-white">Journal d'Audit ({auditLogs.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: USERS MANAGEMENT */}
      {activeAdminTab === 'USERS' && canManageUsers && (
        <div className="space-y-6">

          {/* Bento Cards Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="ocean-glass-card p-4 rounded-2xl border-l-4 border-l-emerald-400">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-black uppercase font-mono">Total Comptes</span>
                <span className="material-symbols-outlined text-lg text-emerald-400">group</span>
              </div>
              <span className="text-2xl font-black text-white font-mono">{allUsers.length}</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Utilisateurs inscrits</p>
            </div>

            <div className="ocean-glass-card p-4 rounded-2xl border-l-4 border-l-cyan-400">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-black uppercase font-mono">Comptes Actifs</span>
                <span className="material-symbols-outlined text-lg text-cyan-400">check_circle</span>
              </div>
              <span className="text-2xl font-black text-cyan-400 font-mono">
                {allUsers.filter(u => u.estActif).length}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">Accès autorisés</p>
            </div>

            <div className="ocean-glass-card p-4 rounded-2xl border-l-4 border-l-amber-400">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-black uppercase font-mono">Personnel Interne</span>
                <span className="material-symbols-outlined text-lg text-amber-400">badge</span>
              </div>
              <span className="text-2xl font-black text-amber-400 font-mono">
                {allUsers.filter(u => u.role !== 'CLIENT_EXPORT').length}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">Agents BOCS Agency</p>
            </div>

            <div className="ocean-glass-card p-4 rounded-2xl border-l-4 border-l-blue-400">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-black uppercase font-mono">Clients Externe</span>
                <span className="material-symbols-outlined text-lg text-blue-400">domain</span>
              </div>
              <span className="text-2xl font-black text-blue-400 font-mono">
                {allUsers.filter(u => u.role === 'CLIENT_EXPORT').length}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">Portail Exportateur</p>
            </div>

            <div className="ocean-glass-card p-4 rounded-2xl border-l-4 border-l-purple-400">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-black uppercase font-mono">Admins Système</span>
                <span className="material-symbols-outlined text-lg text-purple-400">shield_person</span>
              </div>
              <span className="text-2xl font-black text-purple-400 font-mono">
                {allUsers.filter(u => u.role === 'ADMIN').length}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">Droits Super-Utilisateur</p>
            </div>
          </div>

          {/* Action Toolbar & Search Filters */}
          <div className="ocean-glass-card p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">

            {/* Search input */}
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 text-sm">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, email, société..."
                className="w-full pl-9 pr-3 py-2 bg-[#040e1b] border border-cyan-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">

              {/* Role filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase">Rôle:</span>
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="h-9 px-3 bg-[#040e1b] border border-cyan-500/20 text-white rounded-xl text-xs font-bold cursor-pointer outline-none focus:border-cyan-400 transition-all"
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
                <span className="text-xs font-bold text-slate-400 uppercase">Statut:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-9 px-3 bg-[#040e1b] border border-cyan-500/20 text-white rounded-xl text-xs font-bold cursor-pointer outline-none focus:border-cyan-400 transition-all"
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
                    className="px-3.5 py-2 bg-[#040e1b] hover:bg-slate-800 text-slate-200 border border-cyan-500/20 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Consulter la matrice des droits par rôle"
                  >
                    <span className="material-symbols-outlined text-base text-cyan-400">grid_on</span>
                    <span className="hidden sm:inline">Matrice des Droits</span>
                  </button>
                )}

                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">person_add</span>
                  <span>Ajouter un Utilisateur</span>
                </button>
              </div>

            </div>

          </div>

          {/* Users Table */}
          <div className="ocean-glass-card rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-[#051120]/80 border-b border-cyan-500/10 flex items-center justify-between">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400 text-base">people</span>
                <span>Répertoire des Utilisateurs BOCS Maritime ({filteredUsers.length})</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#030914] text-[11px] font-bold uppercase text-slate-400 border-b border-cyan-500/10">
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
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        <span className="material-symbols-outlined text-3xl block mb-1 text-slate-500">person_off</span>
                        <span>Aucun utilisateur ne correspond à vos critères de recherche.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-cyan-950/20 transition-colors">

                        {/* Name & Avatar */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-cyan-950/60 text-cyan-400 font-black text-xs flex items-center justify-center border border-cyan-500/30 shadow-xs">
                              {u.nomComplet.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-white block">{u.nomComplet}</span>
                              <span className="text-[10px] text-slate-400 font-mono">ID: #{u.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Email & Phone */}
                        <td className="p-3.5">
                          <span className="font-mono text-cyan-400 block font-bold">{u.email}</span>
                          <span className="text-[11px] text-slate-400">{u.telephone || 'Non renseigné'}</span>
                        </td>

                        {/* Company */}
                        <td className="p-3.5 font-semibold">
                          <span className="text-slate-200 block">{u.nomSociete || 'BOCS Maritime'}</span>
                          <span className="text-[10px] text-slate-400">{u.pays || 'Côte d\'Ivoire'}</span>
                        </td>

                        {/* Role Badge */}
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getRoleBadgeColor(u.role)} inline-flex items-center gap-1`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            <span>{u.role}</span>
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-3.5">
                          {u.estActif ? (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-emerald-950/60 text-emerald-300 border border-emerald-700/50">
                              ACTIF
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-slate-800 text-slate-400 border border-slate-700">
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
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                              title="Modifier les détails"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => handleOpenResetPass(u)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                              title="Réinitialiser le mot de passe"
                            >
                              <span className="material-symbols-outlined text-lg">key</span>
                            </button>

                            {/* Toggle status */}
                            <button
                              onClick={() => onToggleUserStatus(u.id)}
                              className={`px-2.5 py-1 font-bold text-[11px] rounded-lg transition-all cursor-pointer ${u.estActif
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-700/50 hover:bg-amber-900/60'
                                : 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/60'
                                }`}
                              title={u.estActif ? 'Désactiver le compte' : 'Activer le compte'}
                            >
                              {u.estActif ? 'Désactiver' : 'Activer'}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                              title="Supprimer définitivement"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
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

            <div className="ocean-glass-card p-4 rounded-2xl border-l-4 border-l-purple-500">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-black uppercase font-mono">Profils Types</span>
                <span className="material-symbols-outlined text-lg text-purple-400">admin_panel_settings</span>
              </div>
              <span className="text-2xl font-black text-white font-mono">5 Profils</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Admin, Import, Export, Compta, Client</p>
            </div>

            <div className="ocean-glass-card p-4 rounded-2xl border-l-4 border-l-cyan-400">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-black uppercase font-mono">Permissions Granulaires</span>
                <span className="material-symbols-outlined text-lg text-cyan-400">shield_lock</span>
              </div>
              <span className="text-2xl font-black text-white font-mono">{permissionsMatrix.length} Règles</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Habilitations système configurées</p>
            </div>

            <div className="ocean-glass-card p-4 rounded-2xl border-l-4 border-l-emerald-400">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-black uppercase font-mono">Contrôle d'Accès</span>
                <span className="material-symbols-outlined text-lg text-emerald-400">verified</span>
              </div>
              <span className="text-2xl font-black text-emerald-400 font-mono">RBAC Actif</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Sécurité &amp; Traçabilité unifiée</p>
            </div>

            <div className="ocean-glass-card p-4 rounded-2xl border-l-4 border-l-amber-400">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-black uppercase font-mono">Mode Attribution</span>
                <span className="material-symbols-outlined text-lg text-amber-400">tune</span>
              </div>
              <span className="text-sm font-black text-white font-sans mt-1 block">
                {rightsViewMode === 'PROFILES' ? 'Par Profil / Rôle' : 'Par Utilisateur Spécifique'}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">Personnalisation à 2 niveaux</p>
            </div>

          </div>

          {/* Controls & Mode Switcher Header */}
          <div className="ocean-glass-card p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-[#040e1b] p-1.5 rounded-xl border border-cyan-500/20">
              <button
                type="button"
                onClick={() => setRightsViewMode('PROFILES')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${rightsViewMode === 'PROFILES' ? 'bg-[#005DAA] text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined text-base">badge</span>
                <span>Attribution par Profil (Matrice RBAC)</span>
              </button>

              <button
                type="button"
                onClick={() => setRightsViewMode('USER_SPECIFIC')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${rightsViewMode === 'USER_SPECIFIC' ? 'bg-[#005DAA] text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined text-base">person_search</span>
                <span>Attribution par Utilisateur</span>
              </button>
            </div>

            {/* Actions & Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto ml-auto">
              {rightsViewMode === 'PROFILES' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Catégorie:</span>
                  <select
                    value={rightsCategoryFilter}
                    onChange={e => setRightsCategoryFilter(e.target.value)}
                    className="h-9 px-3 bg-[#040e1b] border border-cyan-500/20 text-white rounded-xl text-xs font-bold cursor-pointer outline-none focus:border-cyan-400"
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
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">save</span>
                <span>Enregistrer les Habilitations</span>
              </button>

              <button
                type="button"
                onClick={handleResetPermissions}
                className="px-3.5 py-2 bg-[#040e1b] hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="Réinitialiser la matrice aux permissions d'origine BOCS"
              >
                <span className="material-symbols-outlined text-base text-amber-400">restart_alt</span>
                <span className="hidden sm:inline">Réinitialiser</span>
              </button>
            </div>

          </div>

          {/* VIEW MODE 1: MATRICE PAR PROFIL (RBAC) */}
          {rightsViewMode === 'PROFILES' && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-300">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400 text-base">grid_on</span>
                  <span>Matrice Interactive d'Attribution des Droits selon le Profil ({permissionsMatrix.filter(p => rightsCategoryFilter === 'ALL' || p.category === rightsCategoryFilter).length} habilitations)</span>
                </h3>
                <span className="text-[11px] text-slate-600 font-semibold italic">
                  💡 Cliquez sur les cases pour accorder ou retirer un droit pour un profil
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 text-[11px] font-black uppercase tracking-wider border-b border-slate-300">
                      <th className="p-4 w-2/5 font-black text-slate-900 bg-slate-100">Permission / Module Applicatif</th>
                      <th className="p-4 text-center w-28 bg-purple-100 text-purple-900 border-l border-purple-300 font-black">
                        ADMIN
                      </th>
                      <th className="p-4 text-center w-28 bg-blue-100 text-blue-900 border-l border-blue-300 font-black">
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
                  <tbody className="bg-white divide-y divide-slate-200 text-xs">
                    {permissionsMatrix
                      .filter(perm => rightsCategoryFilter === 'ALL' || perm.category === rightsCategoryFilter)
                      .map((perm) => (
                        <tr key={perm.id} className="hover:bg-slate-50 transition-colors">

                          {/* Permission info */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${getCategoryBadgeClass(perm.category)} shrink-0`}>
                                {perm.category}
                              </span>
                              <span className="font-black text-slate-900 text-sm tracking-tight">{perm.label}</span>
                            </div>
                            <p className="text-xs text-slate-700 font-medium mt-1 leading-normal pl-0 sm:pl-[74px]">
                              {perm.description}
                            </p>
                          </td>

                          {/* ADMIN Column (Locked) */}
                          <td className="p-4 text-center border-l border-slate-200 bg-purple-50/40">
                            <div className="inline-flex items-center gap-1.5 text-purple-950 bg-purple-100 border border-purple-300 px-3 py-1.5 rounded-full text-xs font-black shadow-2xs">
                              <span className="material-symbols-outlined text-sm text-purple-700">shield</span>
                              <span>Vérifié</span>
                            </div>
                          </td>

                          {/* AGENT_IMPORT Toggle */}
                          <td className="p-4 text-center border-l border-slate-200 bg-blue-50/30">
                            <button
                              type="button"
                              onClick={() => handleTogglePermission(perm.id, 'AGENT_IMPORT')}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 ${perm.roles.AGENT_IMPORT
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 font-black'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300 font-black'
                                }`}
                            >
                              <span className="material-symbols-outlined text-base">
                                {perm.roles.AGENT_IMPORT ? 'check_circle' : 'cancel'}
                              </span>
                              <span>{perm.roles.AGENT_IMPORT ? 'Autorisé' : 'Interdit'}</span>
                            </button>
                          </td>

                          {/* AGENT_EXPORT Toggle */}
                          <td className="p-4 text-center border-l border-slate-200 bg-amber-50/30">
                            <button
                              type="button"
                              onClick={() => handleTogglePermission(perm.id, 'AGENT_EXPORT')}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 ${perm.roles.AGENT_EXPORT
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 font-black'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300 font-black'
                                }`}
                            >
                              <span className="material-symbols-outlined text-base">
                                {perm.roles.AGENT_EXPORT ? 'check_circle' : 'cancel'}
                              </span>
                              <span>{perm.roles.AGENT_EXPORT ? 'Autorisé' : 'Interdit'}</span>
                            </button>
                          </td>

                          {/* COMPTABILITE Toggle */}
                          <td className="p-4 text-center border-l border-slate-200 bg-emerald-50/30">
                            <button
                              type="button"
                              onClick={() => handleTogglePermission(perm.id, 'COMPTABILITE')}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 ${perm.roles.COMPTABILITE
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 font-black'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300 font-black'
                                }`}
                            >
                              <span className="material-symbols-outlined text-base">
                                {perm.roles.COMPTABILITE ? 'check_circle' : 'cancel'}
                              </span>
                              <span>{perm.roles.COMPTABILITE ? 'Autorisé' : 'Interdit'}</span>
                            </button>
                          </td>

                          {/* CLIENT_EXPORT Toggle */}
                          <td className="p-4 text-center border-l border-slate-200 bg-indigo-50/30">
                            <button
                              type="button"
                              onClick={() => handleTogglePermission(perm.id, 'CLIENT_EXPORT')}
                              className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 ${perm.roles.CLIENT_EXPORT
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 font-black'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300 font-black'
                                }`}
                            >
                              <span className="material-symbols-outlined text-base">
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
            <div className="bg-white rounded-2xl p-6 space-y-6 shadow-xl border border-slate-300">

              {/* User Selection Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#005DAA]">person_search</span>
                    <span>Personnalisation des Droits d'un Utilisateur</span>
                  </h3>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    Sélectionnez un compte d'utilisateur pour personnaliser ses habilitations individuelles par rapport à son profil d'origine.
                  </p>
                </div>

                {/* Select User Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Utilisateur:</span>
                  <select
                    value={selectedUserIdForRights || ''}
                    onChange={e => setSelectedUserIdForRights(Number(e.target.value))}
                    className="h-10 px-4 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl text-xs font-bold cursor-pointer outline-none focus:border-[#005DAA]"
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
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#005DAA] text-white flex items-center justify-center font-black text-sm shadow-2xs">
                          {targetUser.nomComplet.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-sm">{targetUser.nomComplet}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRoleBadgeColor(targetUser.role)}`}>
                              {targetUser.role}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-mono font-semibold mt-0.5">{targetUser.email} • {targetUser.nomSociete || 'BOCS Maritime'}</p>
                        </div>
                      </div>

                      <div className="text-xs font-bold text-slate-700 flex items-center gap-3">
                        <span>Statut: {targetUser.estActif ? '🟢 Compte Actif' : '🔴 Compte Suspendu'}</span>
                      </div>
                    </div>

                    {/* Permissions list for this user */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-900 text-[11px] font-black uppercase border-b border-slate-300">
                            <th className="p-3.5">Fonctionnalité Applicative</th>
                            <th className="p-3.5 text-center">Droit par Défaut (Rôle {targetUser.role})</th>
                            <th className="p-3.5 text-center">Droit Attribué à l'Utilisateur</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {permissionsMatrix.map(perm => {
                            const defaultRoleVal = perm.roles[targetUser.role];
                            const overrideVal = userRoleOverridden[perm.id];
                            const effectiveVal = overrideVal !== undefined ? overrideVal : defaultRoleVal;
                            const isOverridden = overrideVal !== undefined && overrideVal !== defaultRoleVal;

                            return (
                              <tr key={perm.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3.5">
                                  <div className="font-black text-slate-900 text-sm">{perm.label}</div>
                                  <div className="text-xs text-slate-600 font-medium mt-0.5">{perm.description}</div>
                                </td>

                                <td className="p-3.5 text-center font-bold">
                                  <span className={defaultRoleVal ? 'text-emerald-700 font-black' : 'text-slate-500 font-bold'}>
                                    {defaultRoleVal ? '✓ Autorisé par rôle' : '✕ Interdit par rôle'}
                                  </span>
                                </td>

                                <td className="p-3.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserOverride(targetUser.id, perm.id, defaultRoleVal)}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 ${effectiveVal
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700'
                                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300'
                                      }`}
                                  >
                                    <span className="material-symbols-outlined text-sm">
                                      {effectiveVal ? 'check_circle' : 'do_not_disturb_on'}
                                    </span>
                                    <span>{effectiveVal ? 'Accès Autorisé' : 'Accès Restreint'}</span>
                                    {isOverridden && (
                                      <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-black">
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
          <div className="ocean-glass-card rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400">currency_exchange</span>
                  <span>Taux de Conversion Officiel BOCS (USD / FCFA)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ce taux fixe permet la conversion instantanée des montants de fret et surestaries exprimés en Dollars USD lors de la facturation.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-[#040e1b] p-3 rounded-xl border border-cyan-500/20">
                <span className="text-sm font-bold text-slate-300">1 USD =</span>
                <input
                  type="number"
                  step="0.01"
                  value={exchangeRateUsd}
                  onChange={e => onUpdateExchangeRate(parseFloat(e.target.value) || 600)}
                  className="w-28 px-3 py-1.5 bg-[#050e1a] border border-cyan-500/30 rounded-lg font-mono font-black text-cyan-400 text-sm focus:outline-none focus:border-cyan-400 text-right"
                />
                <span className="text-sm font-black text-cyan-400">FCFA</span>
              </div>
            </div>
          </div>

          {/* FNE DGI Params Table */}
          <div className="ocean-glass-card rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="border-b border-cyan-500/10 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400">receipt_long</span>
                <span>Paramètres de la Facturation & Devise</span>
              </h2>
              <p className="text-xs text-slate-400">
                Configuration générale du système de facturation et devises de référence.
              </p>
            </div>

            <div className="space-y-4">
              {fneParams.map(param => (
                <div key={param.id} className="p-4 bg-[#040e1b] border border-cyan-500/15 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs hover:border-cyan-400/40 transition-all">
                  <div>
                    <span className="font-bold text-cyan-400 uppercase text-xs block font-mono">{param.cle}</span>
                    <p className="text-slate-300 mt-0.5">{param.description}</p>
                    <span className="text-[10px] text-slate-500">Dernière révision: {param.updatedAt}</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      defaultValue={param.valeur}
                      onBlur={e => {
                        onUpdateFneParam(param.cle, e.target.value);
                        onLogAudit('PARAMETRE_FNE_MODIFIE', 'FneParam', `Mise à jour de la clé ${param.cle}`);
                      }}
                      className="px-3 py-2 bg-[#071322] border border-cyan-500/20 rounded-lg text-xs font-mono font-bold text-white w-full sm:w-80 focus:border-cyan-400 focus:outline-none"
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
        <div className="ocean-glass-card rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 bg-[#051120]/80 border-b border-cyan-500/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-400 text-base">verified_user</span>
              <span>Journal d'Audit Système & Sécurité ({filteredLogs.length} événements enregistrés)</span>
            </h3>

            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 text-sm">search</span>
              <input
                type="text"
                value={auditQuery}
                onChange={e => setAuditQuery(e.target.value)}
                placeholder="Rechercher action, utilisateur, IP..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#040e1b] border border-cyan-500/20 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#030914] text-[11px] font-bold uppercase text-slate-400 border-b border-cyan-500/10">
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
                    <td colSpan={7} className="p-6 text-center text-slate-400 font-sans">
                      Aucune entrée de journal ne correspond à votre recherche.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-cyan-950/20 transition-colors">
                      <td className="p-3.5 text-slate-400 text-[11px]">{log.dateAction}</td>
                      <td className="p-3.5 font-bold text-white font-sans">{log.utilisateurNom}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadgeColor(log.role)}`}>
                          {log.role}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-cyan-400">{log.action}</td>
                      <td className="p-3.5 text-slate-300">{log.entite}</td>
                      <td className="p-3.5 text-slate-400 text-xs font-sans truncate max-w-xs" title={log.details}>
                        {log.details}
                      </td>
                      <td className="p-3.5 text-right text-slate-400 text-[11px]">{log.ip || '127.0.0.1'}</td>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={overlayClickClose(() => setShowAddUserModal(false))}
        >
          <div className="ocean-glass-card border border-cyan-500/30 rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.8)] max-w-lg w-full p-6 space-y-4 text-white">

            <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400">person_add</span>
                <span>Créer un Compte Utilisateur</span>
              </h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">Nom et Prénom *</label>
                <input
                  type="text"
                  required
                  value={formNom}
                  onChange={e => setFormNom(e.target.value)}
                  placeholder="ex: Jean-Baptiste KOFFI"
                  className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">Adresse E-mail Professionnelle *</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="j.koffi@bocs-maritime.com"
                  className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">Rôle et Habilitations *</label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value as UserRole)}
                    className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 text-white rounded-xl font-bold text-xs cursor-pointer outline-none focus:border-cyan-400 transition-all"
                  >
                    <option value="ADMIN">ADMIN - Administrateur Système</option>
                    <option value="AGENT_IMPORT">AGENT_IMPORT - Service Import</option>
                    <option value="AGENT_EXPORT">AGENT_EXPORT - Service Export</option>
                    <option value="COMPTABILITE">COMPTABILITE - Facturation & Encaissements</option>
                    <option value="CLIENT_EXPORT">CLIENT_EXPORT - Portail Client</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">Société / Entité</label>
                  <input
                    type="text"
                    value={formSociete}
                    onChange={e => setFormSociete(e.target.value)}
                    placeholder="BOCS CI Agency"
                    className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">Pays d'Implantation</label>
                  <input
                    type="text"
                    value={formPays}
                    onChange={e => setFormPays(e.target.value)}
                    placeholder="Côte d'Ivoire"
                    className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEstActif}
                    onChange={e => setFormEstActif(e.target.checked)}
                    className="rounded border-cyan-500/30 bg-[#040e1b] text-cyan-400 focus:ring-cyan-400"
                  />
                  <span className="font-semibold text-slate-300">Activer l'accès au compte immédiatement</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-cyan-500/15">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-[#040e1b] hover:bg-slate-800 rounded-xl font-bold text-slate-300 border border-cyan-500/20 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={overlayClickClose(() => setEditingUser(null))}
        >
          <div className="ocean-glass-card border border-cyan-500/30 rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.8)] max-w-lg w-full p-6 space-y-4 text-white">

            <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400">edit_note</span>
                <span>Modifier le Compte #{editingUser.id}</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">Nom et Prénom</label>
                <input
                  type="text"
                  required
                  value={formNom}
                  onChange={e => setFormNom(e.target.value)}
                  className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">Adresse E-mail</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">Rôle Assigné</label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value as UserRole)}
                    className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 text-white rounded-xl font-bold text-xs cursor-pointer outline-none focus:border-cyan-400 transition-all"
                  >
                    <option value="ADMIN">ADMIN - Administrateur</option>
                    <option value="AGENT_IMPORT">AGENT_IMPORT - Import</option>
                    <option value="AGENT_EXPORT">AGENT_EXPORT - Export</option>
                    <option value="COMPTABILITE">COMPTABILITE - Facturation</option>
                    <option value="CLIENT_EXPORT">CLIENT_EXPORT - Client</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">Société</label>
                  <input
                    type="text"
                    value={formSociete}
                    onChange={e => setFormSociete(e.target.value)}
                    className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">Statut du Compte</label>
                  <select
                    value={formEstActif ? 'ACTIF' : 'INACTIF'}
                    onChange={e => setFormEstActif(e.target.value === 'ACTIF')}
                    className="w-full h-9 px-3 bg-[#040e1b] border border-cyan-500/20 text-white rounded-xl font-bold text-xs cursor-pointer outline-none focus:border-cyan-400 transition-all"
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
                  className="px-4 py-2 bg-[#040e1b] hover:bg-slate-800 rounded-xl font-bold text-slate-300 border border-cyan-500/20 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={overlayClickClose(() => setResetPasswordUser(null))}
        >
          <div className="ocean-glass-card border border-amber-500/30 rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.8)] max-w-md w-full p-6 space-y-4 text-white">

            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">key</span>
                <span>Réinitialiser le Mot de Passe</span>
              </h3>
              <button onClick={() => setResetPasswordUser(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Un mot de passe temporaire à usage unique a été généré pour l'utilisateur <strong className="text-white">{resetPasswordUser.nomComplet}</strong> ({resetPasswordUser.email}).
            </p>

            <div className="p-3 bg-amber-950/60 border border-amber-500/30 rounded-xl flex items-center justify-between">
              <code className="font-mono text-base font-black text-amber-300">{generatedTempPass}</code>
              <button
                type="button"
                onClick={handleCopyPass}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">{copiedPass ? 'check' : 'content_copy'}</span>
                <span>{copiedPass ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Transmettez ce mot de passe temporaire à l'utilisateur. Il sera invité à le remplacer lors de sa prochaine connexion.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={handleConfirmResetPass}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer active:scale-95"
              >
                Confirmer & Enregistrer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE */}
      {deletingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={overlayClickClose(() => setDeletingUser(null))}
        >
          <div className="ocean-glass-card border border-rose-500/30 rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.8)] max-w-md w-full p-6 space-y-4 text-white">

            <div className="flex items-center gap-3 text-rose-400 border-b border-rose-500/20 pb-3">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <div>
                <h3 className="font-bold text-lg text-white">Confirmer la Suppression</h3>
                <p className="text-xs text-slate-400">Action irréversible sur le compte</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le compte utilisateur <strong className="text-white">{deletingUser.nomComplet}</strong> ({deletingUser.email}) ?
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 bg-[#040e1b] hover:bg-slate-800 rounded-xl font-bold text-xs text-slate-300 border border-slate-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95"
              >
                Supprimer le compte
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: PERMISSIONS & ROLES MATRIX */}
      {showPermissionsMatrix && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={overlayClickClose(() => setShowPermissionsMatrix(false))}
        >
          <div className="ocean-glass-card border border-cyan-500/30 rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.8)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col p-6 space-y-4 text-white">

            <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400">grid_on</span>
                  <span>Matrice des Droits & Habilitations par Rôle</span>
                </h3>
                <p className="text-xs text-slate-400">Contrôle d'accès basé sur les rôles (RBAC) au sein de la plateforme BOCS Maritime.</p>
              </div>
              <button onClick={() => setShowPermissionsMatrix(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-auto flex-1 border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#051424] text-[11px] font-bold uppercase text-slate-400 border-b border-slate-800">
                    <th className="p-3.5 border-b border-slate-800">Fonctionnalité / Module</th>
                    <th className="p-3.5 text-center border-b border-slate-800">ADMIN</th>
                    <th className="p-3.5 text-center border-b border-slate-800">AGENT_IMPORT</th>
                    <th className="p-3.5 text-center border-b border-slate-800">AGENT_EXPORT</th>
                    <th className="p-3.5 text-center border-b border-slate-800">COMPTABILITE</th>
                    <th className="p-3.5 text-center border-b border-slate-800">CLIENT_EXPORT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">

                  <tr>
                    <td className="p-3.5 font-bold text-white">Tableau de Bord Global</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Accès Total</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Accès Total</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Accès Total</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Accès Total</td>
                    <td className="p-3.5 text-center text-amber-400 font-bold">⚠️ Restreint Client</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white">Fleet Radar (Suivi Escales)</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Lecture / Écriture</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Lecture / Écriture</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Lecture / Écriture</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Lecture Seule</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Masqué</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white">Import (Manifeste XML & DMDT)</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Contrôle Total</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Import & Calculs</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Masqué</td>
                    <td className="p-3.5 text-center text-amber-400 font-bold">⚠️ Facturation uniquement</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Masqué</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white">Export (Draft BL & Validation)</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Validation & BL</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Masqué</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Validation & BL</td>
                    <td className="p-3.5 text-center text-amber-400 font-bold">⚠️ Facturation uniquement</td>
                    <td className="p-3.5 text-center text-indigo-400 font-bold">✓ Saisie Drafts Propres</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white">Facturation & Encaissements</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Émission & Paiements</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Proforma Import</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Proforma Export</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Émission Factures & Saisie Paiements</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Lecture Factures Propres</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white">Gestion des Utilisateurs & Rôles</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Admin Exclusif</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Interdit</td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-bold text-white">Journal d'Audit & Paramètres</td>
                    <td className="p-3.5 text-center text-emerald-400 font-bold">✓ Admin Exclusif</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Interdit</td>
                    <td className="p-3.5 text-center text-slate-500">✕ Interdit</td>
                  </tr>

                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPermissionsMatrix(false)}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer active:scale-95"
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
