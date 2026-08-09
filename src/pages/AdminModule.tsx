import React, { useState } from 'react';
import { FneParam, AuditLog, UserRole, User } from '../types';

interface AdminModuleProps {
  initialTab?: 'USERS' | 'FNE' | 'AUDIT';
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
  userRole
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'USERS' | 'FNE' | 'AUDIT'>(initialTab);

  React.useEffect(() => {
    if (initialTab) setActiveAdminTab(initialTab);
  }, [initialTab]);
  
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
    setShowAddUserModal(false);
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
      case 'ADMIN': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'AGENT_IMPORT': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'AGENT_EXPORT': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'COMPTABILITE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CLIENT_EXPORT': return 'bg-slate-100 text-slate-800 border-slate-200';
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

  const filteredLogs = auditLogs.filter(l => 
    l.utilisateurNom.toLowerCase().includes(auditQuery.toLowerCase()) ||
    l.action.toLowerCase().includes(auditQuery.toLowerCase()) ||
    l.details.toLowerCase().includes(auditQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="material-symbols-outlined text-[#005daa] text-2xl font-black">admin_panel_settings</span>
            <h1 className="text-xl font-black text-slate-900 font-heading">Console d'Administration & Sécurité</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Gestion complète des comptes utilisateurs, matrice d'habilitations et contrôle des paramètres système BOCS Maritime.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveAdminTab('USERS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeAdminTab === 'USERS' ? 'bg-[#005daa] text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span className="material-symbols-outlined text-base">manage_accounts</span>
            <span>Utilisateurs & Rôles</span>
          </button>
          <button
            onClick={() => setActiveAdminTab('FNE')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeAdminTab === 'FNE' ? 'bg-[#005daa] text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span className="material-symbols-outlined text-base">tune</span>
            <span>Params FNE & Devise</span>
          </button>
          <button
            onClick={() => setActiveAdminTab('AUDIT')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeAdminTab === 'AUDIT' ? 'bg-[#005daa] text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span className="material-symbols-outlined text-base">verified_user</span>
            <span>Journal d'Audit ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: USERS MANAGEMENT */}
      {activeAdminTab === 'USERS' && (
        <div className="space-y-6">
          
          {/* Bento Cards Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bocs-card p-4 border-l-4 border-primary">
              <div className="flex items-center justify-between text-outline mb-1">
                <span className="text-[11px] font-bold uppercase">Total Comptes</span>
                <span className="material-symbols-outlined text-lg">group</span>
              </div>
              <span className="text-2xl font-extrabold text-primary">{allUsers.length}</span>
              <p className="text-[10px] text-outline mt-0.5">Utilisateurs inscrits</p>
            </div>

            <div className="bocs-card p-4 border-l-4 border-emerald-500">
              <div className="flex items-center justify-between text-outline mb-1">
                <span className="text-[11px] font-bold uppercase">Comptes Actifs</span>
                <span className="material-symbols-outlined text-lg text-emerald-600">check_circle</span>
              </div>
              <span className="text-2xl font-extrabold text-emerald-600">
                {allUsers.filter(u => u.estActif).length}
              </span>
              <p className="text-[10px] text-outline mt-0.5">Accès autorisés</p>
            </div>

            <div className="bocs-card p-4 border-l-4 border-amber-500">
              <div className="flex items-center justify-between text-outline mb-1">
                <span className="text-[11px] font-bold uppercase">Personnel Interne</span>
                <span className="material-symbols-outlined text-lg text-amber-600">badge</span>
              </div>
              <span className="text-2xl font-extrabold text-amber-600">
                {allUsers.filter(u => u.role !== 'CLIENT_EXPORT').length}
              </span>
              <p className="text-[10px] text-outline mt-0.5">Agents BOCS Agency</p>
            </div>

            <div className="bocs-card p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between text-outline mb-1">
                <span className="text-[11px] font-bold uppercase">Clients Externe</span>
                <span className="material-symbols-outlined text-lg text-blue-600">domain</span>
              </div>
              <span className="text-2xl font-extrabold text-blue-600">
                {allUsers.filter(u => u.role === 'CLIENT_EXPORT').length}
              </span>
              <p className="text-[10px] text-outline mt-0.5">Portail Exportateur</p>
            </div>

            <div className="bocs-card p-4 border-l-4 border-purple-500">
              <div className="flex items-center justify-between text-outline mb-1">
                <span className="text-[11px] font-bold uppercase">Admins Système</span>
                <span className="material-symbols-outlined text-lg text-purple-600">shield_person</span>
              </div>
              <span className="text-2xl font-extrabold text-purple-600">
                {allUsers.filter(u => u.role === 'ADMIN').length}
              </span>
              <p className="text-[10px] text-outline mt-0.5">Droits Super-Utilisateur</p>
            </div>
          </div>

          {/* Action Toolbar & Search Filters */}
          <div className="bocs-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Search input */}
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, email, société..."
                className="w-full pl-9 pr-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-secondary"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              
              {/* Role filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-on-surface-variant uppercase">Rôle:</span>
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="h-8 px-2.5 bg-[#ffe135] hover:bg-[#ffe855] border border-[#e5c122] text-[#0f172a] rounded-xl text-xs font-black cursor-pointer outline-none transition-all"
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
                <span className="text-xs font-bold text-on-surface-variant uppercase">Statut:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-8 px-2.5 bg-[#ffe135] hover:bg-[#ffe855] border border-[#e5c122] text-[#0f172a] rounded-xl text-xs font-black cursor-pointer outline-none transition-all"
                >
                  <option value="ALL">Tous les Statuts</option>
                  <option value="ACTIVE">Actifs uniquement</option>
                  <option value="INACTIVE">Inactifs uniquement</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setShowPermissionsMatrix(true)}
                  className="px-3 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant font-bold text-xs rounded-lg transition-all flex items-center gap-1.5"
                  title="Consulter la matrice des droits par rôle"
                >
                  <span className="material-symbols-outlined text-base">grid_on</span>
                  <span className="hidden sm:inline">Matrice des Droits</span>
                </button>

                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 bg-primary text-on-primary font-bold text-xs rounded-lg hover:bg-secondary transition-all shadow flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">person_add</span>
                  <span>Ajouter un Utilisateur</span>
                </button>
              </div>

            </div>

          </div>

          {/* Users Table */}
          <div className="bocs-card overflow-hidden">
            <div className="p-4 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
              <h3 className="font-bold text-primary text-xs uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-base">people</span>
                <span>Répertoire des Utilisateurs BOCS Maritime ({filteredUsers.length})</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container-high/40 text-[11px] font-bold uppercase text-on-surface-variant border-b border-outline-variant">
                    <th className="p-3">Utilisateur</th>
                    <th className="p-3">Email & Contact</th>
                    <th className="p-3">Société / Entité</th>
                    <th className="p-3">Rôle Assigné</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3 text-right">Actions de Gestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-outline">
                        <span className="material-symbols-outlined text-3xl block mb-1">person_off</span>
                        <span>Aucun utilisateur ne correspond à vos critères de recherche.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                        
                        {/* Name & Avatar */}
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#00182f] text-white font-black text-xs flex items-center justify-center border border-slate-700 shadow-sm">
                              {u.nomComplet.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-primary block">{u.nomComplet}</span>
                              <span className="text-[10px] text-outline font-mono">ID: #{u.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Email & Phone */}
                        <td className="p-3">
                          <span className="font-mono text-on-surface block font-semibold">{u.email}</span>
                          <span className="text-[11px] text-outline">{u.telephone || 'Non renseigné'}</span>
                        </td>

                        {/* Company */}
                        <td className="p-3 font-semibold">
                          <span className="text-on-surface block">{u.nomSociete || 'BOCS Maritime'}</span>
                          <span className="text-[10px] text-outline">{u.pays || 'Côte d\'Ivoire'}</span>
                        </td>

                        {/* Role Badge */}
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getRoleBadgeColor(u.role)} inline-flex items-center gap-1`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            <span>{u.role}</span>
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-3">
                          {u.estActif ? (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ACTIF
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-gray-100 text-gray-600 border border-gray-200">
                              INACTIF
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded transition-all"
                              title="Modifier les détails"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => handleOpenResetPass(u)}
                              className="p-1.5 text-on-surface-variant hover:text-amber-600 hover:bg-amber-50 rounded transition-all"
                              title="Réinitialiser le mot de passe"
                            >
                              <span className="material-symbols-outlined text-lg">key</span>
                            </button>

                            {/* Toggle status */}
                            <button
                              onClick={() => onToggleUserStatus(u.id)}
                              className={`px-2.5 py-1 font-bold text-[11px] rounded transition-all ${
                                u.estActif 
                                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' 
                                  : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                              }`}
                              title={u.estActif ? 'Désactiver le compte' : 'Activer le compte'}
                            >
                              {u.estActif ? 'Désactiver' : 'Activer'}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded transition-all"
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

      {/* TAB 2: FNE PARAMS & DEVISE */}
      {activeAdminTab === 'FNE' && (
        <div className="space-y-6">
          
          {/* Currency Exchange Rate Box */}
          <div className="bocs-card p-6 bg-gradient-to-br from-primary/5 via-surface to-surface border border-primary/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500">currency_exchange</span>
                  <span>Taux de Conversion Officiel BOCS (USD / FCFA)</span>
                </h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  Ce taux fixe permet la conversion instantanée des montants de fret et surestaries exprimés en Dollars USD lors de la facturation.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-surface-container p-3 rounded-xl border border-outline-variant">
                <span className="text-sm font-bold text-on-surface">1 USD =</span>
                <input
                  type="number"
                  step="0.01"
                  value={exchangeRateUsd}
                  onChange={e => onUpdateExchangeRate(parseFloat(e.target.value) || 600)}
                  className="w-28 px-3 py-1.5 bg-surface border border-primary/40 rounded font-bold text-primary text-sm focus:outline-none text-right"
                />
                <span className="text-sm font-extrabold text-primary">FCFA</span>
              </div>
            </div>
          </div>

          {/* FNE DGI Params Table */}
          <div className="bocs-card p-6 space-y-6">
            <div className="border-b border-outline-variant pb-4">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">receipt_long</span>
                <span>Paramètres de la Facturation Normalisée Électronique (FNE)</span>
              </h2>
              <p className="text-xs text-on-surface-variant">
                Interfaçage certifié avec les serveurs de la Direction Générale des Impôts (DGI) pour la délivrance des stickers FNE et QR Codes.
              </p>
            </div>

            <div className="space-y-4">
              {fneParams.map(param => (
                <div key={param.id} className="p-4 bg-surface-container-low border border-outline-variant rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs hover:border-primary/30 transition-all">
                  <div>
                    <span className="font-bold text-primary uppercase text-xs block font-mono">{param.cle}</span>
                    <p className="text-on-surface-variant mt-0.5">{param.description}</p>
                    <span className="text-[10px] text-outline">Dernière révision: {param.updatedAt}</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      defaultValue={param.valeur}
                      onBlur={e => {
                        onUpdateFneParam(param.cle, e.target.value);
                        onLogAudit('PARAMETRE_FNE_MODIFIE', 'FneParam', `Mise à jour de la clé ${param.cle}`);
                      }}
                      className="px-3 py-2 bg-surface border border-outline-variant rounded text-xs font-mono font-bold text-secondary w-full sm:w-80 focus:border-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: AUDIT TRAIL LOGS */}
      {activeAdminTab === 'AUDIT' && (
        <div className="bocs-card overflow-hidden">
          <div className="p-4 bg-surface-container-low border-b border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3">
            <h3 className="font-bold text-primary text-xs uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-base">verified_user</span>
              <span>Journal d'Audit Système & Sécurité ({filteredLogs.length} événements enregistrés)</span>
            </h3>

            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
              <input
                type="text"
                value={auditQuery}
                onChange={e => setAuditQuery(e.target.value)}
                placeholder="Rechercher action, utilisateur, IP..."
                className="w-full pl-9 pr-3 py-1.5 bg-surface border border-outline-variant rounded text-xs text-on-surface focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container-high text-[11px] font-bold uppercase text-on-surface-variant">
                  <th className="p-3">Horodatage</th>
                  <th className="p-3">Opérateur</th>
                  <th className="p-3">Rôle</th>
                  <th className="p-3">Action Système</th>
                  <th className="p-3">Entité Cible</th>
                  <th className="p-3">Détails Opératoires</th>
                  <th className="p-3 text-right">Adresse IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-mono">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-outline font-sans">
                      Aucune entrée de journal ne correspond à votre recherche.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-3 text-outline text-[11px]">{log.dateAction}</td>
                      <td className="p-3 font-bold text-primary font-sans">{log.utilisateurNom}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${getRoleBadgeColor(log.role)}`}>
                          {log.role}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-secondary">{log.action}</td>
                      <td className="p-3 text-on-surface font-sans">{log.entite}</td>
                      <td className="p-3 text-on-surface-variant font-sans text-[11px]">{log.details}</td>
                      <td className="p-3 text-outline text-[11px] text-right">{log.ip}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">person_add</span>
                <span>Créer un Compte Utilisateur</span>
              </h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              
              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Nom et Prénom *</label>
                <input
                  type="text"
                  required
                  value={formNom}
                  onChange={e => setFormNom(e.target.value)}
                  placeholder="ex: Jean-Baptiste KOFFI"
                  className="w-full h-9 px-3 bg-surface border border-outline-variant rounded focus:border-primary text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Adresse E-mail Professionnelle *</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="j.koffi@bocs-maritime.com"
                  className="w-full h-9 px-3 bg-surface border border-outline-variant rounded focus:border-primary text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Rôle et Habilitations *</label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value as UserRole)}
                    className="w-full h-9 px-3 bg-[#ffe135] hover:bg-[#ffe855] border border-[#e5c122] text-[#0f172a] rounded-xl font-black text-xs cursor-pointer outline-none transition-all"
                  >
                    <option value="ADMIN">ADMIN - Administrateur Système</option>
                    <option value="AGENT_IMPORT">AGENT_IMPORT - Service Import</option>
                    <option value="AGENT_EXPORT">AGENT_EXPORT - Service Export</option>
                    <option value="COMPTABILITE">COMPTABILITE - Facturation FNE</option>
                    <option value="CLIENT_EXPORT">CLIENT_EXPORT - Portail Client</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Société / Entité</label>
                  <input
                    type="text"
                    value={formSociete}
                    onChange={e => setFormSociete(e.target.value)}
                    placeholder="BOCS CI Agency"
                    className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Pays d'Implantation</label>
                  <input
                    type="text"
                    value={formPays}
                    onChange={e => setFormPays(e.target.value)}
                    placeholder="Côte d'Ivoire"
                    className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEstActif}
                    onChange={e => setFormEstActif(e.target.checked)}
                    className="rounded border-outline-variant text-primary focus:ring-secondary"
                  />
                  <span className="font-semibold text-on-surface">Activer l'accès au compte immédiatement</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded font-semibold text-on-surface-variant"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-on-primary font-bold rounded hover:bg-secondary transition-all shadow"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">edit_note</span>
                <span>Modifier le Compte #{editingUser.id}</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              
              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Nom et Prénom</label>
                <input
                  type="text"
                  required
                  value={formNom}
                  onChange={e => setFormNom(e.target.value)}
                  className="w-full h-9 px-3 bg-surface border border-outline-variant rounded focus:border-primary text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Adresse E-mail</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  className="w-full h-9 px-3 bg-surface border border-outline-variant rounded focus:border-primary text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Rôle Assigné</label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value as UserRole)}
                    className="w-full h-9 px-3 bg-[#ffe135] hover:bg-[#ffe855] border border-[#e5c122] text-[#0f172a] rounded-xl font-black text-xs cursor-pointer outline-none transition-all"
                  >
                    <option value="ADMIN">ADMIN - Administrateur</option>
                    <option value="AGENT_IMPORT">AGENT_IMPORT - Import</option>
                    <option value="AGENT_EXPORT">AGENT_EXPORT - Export</option>
                    <option value="COMPTABILITE">COMPTABILITE - Facturation</option>
                    <option value="CLIENT_EXPORT">CLIENT_EXPORT - Client</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Société</label>
                  <input
                    type="text"
                    value={formSociete}
                    onChange={e => setFormSociete(e.target.value)}
                    className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Statut du Compte</label>
                  <select
                    value={formEstActif ? 'ACTIF' : 'INACTIF'}
                    onChange={e => setFormEstActif(e.target.value === 'ACTIF')}
                    className="w-full h-9 px-3 bg-[#ffe135] hover:bg-[#ffe855] border border-[#e5c122] text-[#0f172a] rounded-xl font-black text-xs cursor-pointer outline-none transition-all"
                  >
                    <option value="ACTIF">ACTIF (Accès Autorisé)</option>
                    <option value="INACTIF">INACTIF (Accès Bloqué)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded font-semibold text-on-surface-variant"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-on-primary font-bold rounded hover:bg-secondary transition-all shadow"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">key</span>
                <span>Réinitialiser le Mot de Passe</span>
              </h3>
              <button onClick={() => setResetPasswordUser(null)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant">
              Un mot de passe temporaire à usage unique a été généré pour l'utilisateur <strong className="text-primary">{resetPasswordUser.nomComplet}</strong> ({resetPasswordUser.email}).
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <code className="font-mono text-base font-extrabold text-amber-900">{generatedTempPass}</code>
              <button
                type="button"
                onClick={handleCopyPass}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">{copiedPass ? 'check' : 'content_copy'}</span>
                <span>{copiedPass ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>

            <p className="text-[11px] text-outline">
              Transmettez ce mot de passe temporaire à l'utilisateur. Il sera invité à le remplacer lors de sa prochaine connexion.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={handleConfirmResetPass}
                className="px-5 py-2 bg-primary text-on-primary font-bold text-xs rounded hover:bg-secondary transition-all"
              >
                Confirmer & Enregistrer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            
            <div className="flex items-center gap-3 text-error border-b border-outline-variant pb-3">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <div>
                <h3 className="font-bold text-lg text-primary">Confirmer la Suppression</h3>
                <p className="text-xs text-on-surface-variant">Action irréversible sur le compte</p>
              </div>
            </div>

            <p className="text-xs text-on-surface leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le compte utilisateur <strong className="text-primary">{deletingUser.nomComplet}</strong> ({deletingUser.email}) ?
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded font-semibold text-xs text-on-surface-variant"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-error text-on-error font-bold text-xs rounded hover:bg-error/90 transition-all"
              >
                Supprimer le compte
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: PERMISSIONS & ROLES MATRIX */}
      {showPermissionsMatrix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div>
                <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">grid_on</span>
                  <span>Matrice des Droits & Habilitations par Rôle</span>
                </h3>
                <p className="text-xs text-on-surface-variant">Contrôle d'accès basé sur les rôles (RBAC) au sein de la plateforme BOCS Maritime.</p>
              </div>
              <button onClick={() => setShowPermissionsMatrix(false)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-outline-variant rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container-high text-[11px] font-bold uppercase text-on-surface-variant">
                    <th className="p-3 border-b border-outline-variant">Fonctionnalité / Module</th>
                    <th className="p-3 text-center border-b border-outline-variant">ADMIN</th>
                    <th className="p-3 text-center border-b border-outline-variant">AGENT_IMPORT</th>
                    <th className="p-3 text-center border-b border-outline-variant">AGENT_EXPORT</th>
                    <th className="p-3 text-center border-b border-outline-variant">COMPTABILITE</th>
                    <th className="p-3 text-center border-b border-outline-variant">CLIENT_EXPORT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-xs">
                  
                  <tr>
                    <td className="p-3 font-bold text-primary">Tableau de Bord Global</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Accès Total</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Accès Total</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Accès Total</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Accès Total</td>
                    <td className="p-3 text-center text-amber-600 font-bold">⚠️ Restreint Client</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-bold text-primary">Fleet Radar (Suivi Escales)</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Lecture / Écriture</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Lecture / Écriture</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Lecture / Écriture</td>
                    <td className="p-3 text-center text-outline">✕ Lecture Seule</td>
                    <td className="p-3 text-center text-outline">✕ Masqué</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-bold text-primary">Import (Manifeste XML & DMDT)</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Contrôle Total</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Import & Calculs</td>
                    <td className="p-3 text-center text-outline">✕ Masqué</td>
                    <td className="p-3 text-center text-amber-600 font-bold">⚠️ Facturation uniquement</td>
                    <td className="p-3 text-center text-outline">✕ Masqué</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-bold text-primary">Export (Draft BL & Validation)</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Validation & BL</td>
                    <td className="p-3 text-center text-outline">✕ Masqué</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Validation & BL</td>
                    <td className="p-3 text-center text-amber-600 font-bold">⚠️ Facturation uniquement</td>
                    <td className="p-3 text-center text-blue-600 font-bold">✓ Saisie Drafts Propres</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-bold text-primary">Facturation FNE & Encaissements</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Émission & Paiements</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Proforma Import</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Proforma Export</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Émission FNE & Saisie Paiements</td>
                    <td className="p-3 text-center text-outline">✕ Lecture Factures Propres</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-bold text-primary">Gestion des Utilisateurs & Rôles</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Admin Exclusif</td>
                    <td className="p-3 text-center text-outline">✕ Interdit</td>
                    <td className="p-3 text-center text-outline">✕ Interdit</td>
                    <td className="p-3 text-center text-outline">✕ Interdit</td>
                    <td className="p-3 text-center text-outline">✕ Interdit</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-bold text-primary">Journal d'Audit & Params FNE</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Admin Exclusif</td>
                    <td className="p-3 text-center text-outline">✕ Interdit</td>
                    <td className="p-3 text-center text-outline">✕ Interdit</td>
                    <td className="p-3 text-center text-outline">✕ Interdit</td>
                    <td className="p-3 text-center text-outline">✕ Interdit</td>
                  </tr>

                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPermissionsMatrix(false)}
                className="px-5 py-2 bg-primary text-on-primary font-bold text-xs rounded hover:bg-secondary transition-all"
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
