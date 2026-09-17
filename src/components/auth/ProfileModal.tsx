import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { useEscapeClose, overlayClickClose } from '../../hooks/useEscapeClose';
import { toastSuccess, toastError, toastWarning } from '../common/Toast';
import { 
  User as UserIcon, 
  Lock, 
  ShieldCheck, 
  Building, 
  Phone, 
  Mail, 
  Globe, 
  Check, 
  X, 
  Save, 
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateProfile: (updatedUser: User) => Promise<boolean>;
  onChangePassword: (userId: number, currentPass: string, newPass: string) => Promise<boolean>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateProfile,
  onChangePassword
}) => {
  if (!isOpen) return null;
  // Audit UX P1 : fermeture au clavier (Échap) + clic sur l'arrière-plan.
  // (Modale montée conditionnellement : convention hooks du fichier conservée.)
  useEscapeClose(true, onClose);

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'security'>('profile');
  
  // Profile form state
  const [nomComplet, setNomComplet] = useState(currentUser.nomComplet);
  const [telephone, setTelephone] = useState(currentUser.telephone || '');
  const [nomSociete, setNomSociete] = useState(currentUser.nomSociete || '');
  const [pays, setPays] = useState(currentUser.pays || 'Côte d\'Ivoire');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isSavingPass, setIsSavingPass] = useState(false);

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'Administrateur Système';
      case 'AGENT_IMPORT': return 'Agent Manifeste & Import';
      case 'AGENT_EXPORT': return 'Agent Saisie & Export';
      case 'COMPTABILITE': return 'Responsable Facturation & Caisse';
      case 'CLIENT_EXPORT': return 'Client Exportateur Agréé';
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'AGENT_IMPORT': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'AGENT_EXPORT': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'COMPTABILITE': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CLIENT_EXPORT': return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomComplet.trim()) {
      toastWarning('Le nom complet est obligatoire.');
      return;
    }

    setIsSavingProfile(true);
    const updated: User = {
      ...currentUser,
      nomComplet: nomComplet.trim(),
      telephone: telephone.trim(),
      nomSociete: nomSociete.trim(),
      pays
    };

    const success = await onUpdateProfile(updated);
    setIsSavingProfile(false);
    if (success) {
      toastSuccess('Profil mis à jour avec succès !');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      toastWarning('Veuillez saisir un nouveau mot de passe.');
      return;
    }
    if (newPassword.length < 6) {
      toastWarning('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setIsSavingPass(true);
    const success = await onChangePassword(currentUser.id, currentPassword, newPassword);
    setIsSavingPass(false);

    if (success) {
      toastSuccess('Mot de passe modifié avec succès !');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveTab('profile');
    }
  };

  // Initials for avatar
  const initials = currentUser.nomComplet
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      onClick={overlayClickClose(onClose)}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header with User Banner */}
        <div className="bg-gradient-to-r from-[#00182f] via-[#0b2447] to-[#005daa] p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-[#209641] text-white flex items-center justify-center font-black text-xl shadow-lg border-2 border-white/20">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-heading">{currentUser.nomComplet}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${getRoleColor(currentUser.role)}`}>
                  {getRoleLabel(currentUser.role)}
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5 flex items-center gap-2">
                <span>{currentUser.email}</span>
                <span>•</span>
                <span>{currentUser.nomSociete || 'BOCS Maritime'}</span>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-6 pt-3 border-t border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Mon Profil</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'password'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Changer Mot de Passe</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Sécurité &amp; Rôle</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto bocs-scrollbar flex-1 bg-slate-50/50">
          
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nom Complet *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={nomComplet}
                      onChange={e => setNomComplet(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#005daa]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Adresse Email (Identifiant)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      disabled
                      value={currentUser.email}
                      className="w-full h-10 pl-9 pr-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed"
                      title="L'adresse email est gérée par l'administrateur"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Téléphone Professionnel
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={telephone}
                      onChange={e => setTelephone(e.target.value)}
                      placeholder="+225 07 00 00 00 00"
                      className="w-full h-10 pl-9 pr-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#005daa]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Entreprise / Agence
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={nomSociete}
                      onChange={e => setNomSociete(e.target.value)}
                      placeholder="BOCS CI Agency"
                      className="w-full h-10 pl-9 pr-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#005daa]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Pays de Résidence
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pays}
                    onChange={e => setPays(e.target.value)}
                    placeholder="Côte d'Ivoire"
                    className="w-full h-10 pl-9 pr-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#005daa]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 bg-[#005daa] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Enregistrement...' : 'Enregistrer les Modifications'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CHANGE PASSWORD */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
                <Lock className="w-4 h-4 text-[#005daa] shrink-0 mt-0.5" />
                <span>Pour des raisons de sécurité, choisissez un mot de passe d'au moins 6 caractères comprenant lettres et chiffres.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mot de Passe Actuel
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Saisissez votre mot de passe actuel"
                    className="w-full h-10 pl-9 pr-10 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#005daa]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nouveau Mot de Passe *
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Au moins 6 caractères"
                      className="w-full h-10 pl-9 pr-10 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#005daa]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Confirmer Nouveau Mot de Passe *
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 pl-9 pr-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#005daa]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingPass}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingPass ? 'Modification...' : 'Confirmer le Changement'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: SECURITY & ROLE INFO */}
          {activeTab === 'security' && (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900">Rôle Opérationnel</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase border ${getRoleColor(currentUser.role)}`}>
                    {currentUser.role}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900">Statut du Compte</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Actif &amp; Valide</span>
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900">Date de Création du Compte</span>
                  <span className="font-mono">{currentUser.dateCreation || '01/01/2026'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Dernière Connexion Enregistrée</span>
                  <span className="font-mono text-slate-600">{currentUser.dernierAcces || 'Session courante active'}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl space-y-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>Permissions Applicatives Attribuées</span>
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Votre profil bénéficie des droits d'accès définis par la politique de sécurité BOCS Maritime. Les actions critiques telles que les suppressions ou les validations de factures sont tracées dans le registre d'audit central.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
