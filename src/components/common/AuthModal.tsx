import React, { useState } from 'react';
import { User } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot';
  onLoginSuccess?: (user: User) => void;
  onAddUser?: (user: User) => void;
  allUsers: User[];
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onLoginSuccess,
  onAddUser,
  allUsers
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'success_register' | 'success_forgot'>(initialMode);
  
  // Login Form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register Form state
  const [regFullName, setRegFullName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCountry, setRegCountry] = useState('CI');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const foundUser = allUsers.find(u => u.email.toLowerCase() === loginEmail.toLowerCase());
    if (foundUser) {
      if (!foundUser.estActif) {
        setLoginError('Ce compte a été désactivé par l\'administrateur. Veuillez contacter le support BOCS.');
        return;
      }
      if (onLoginSuccess) onLoginSuccess(foundUser);
      onClose();
    } else {
      if (allUsers.length > 0 && onLoginSuccess) {
        // Fallback demo user
        onLoginSuccess(allUsers[0]);
        onClose();
      } else {
        setLoginError('Identifiants incorrects ou compte introuvable.');
      }
    }
  };

  const handleQuickLogin = (role: string) => {
    const matched = allUsers.find(u => u.role === role);
    if (matched && onLoginSuccess) {
      onLoginSuccess(matched);
      onClose();
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      alert('Les mots de passe ne correspondent pas.');
      return;
    }

    const newUser: User = {
      id: Date.now(),
      nomComplet: regFullName,
      email: regEmail,
      role: 'CLIENT_EXPORT',
      nomSociete: regCompany,
      telephone: regPhone,
      pays: regCountry === 'CI' ? 'Côte d\'Ivoire' : regCountry,
      estActif: true,
      motDePasse: regPassword,
      dateCreation: new Date().toISOString().split('T')[0]
    };

    if (onAddUser) {
      onAddUser(newUser);
    }
    setMode('success_register');
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMode('success_forgot');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row relative">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-all"
          aria-label="Fermer"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Left Side: Branding Banner */}
        <div className="hidden md:flex md:w-5/12 bg-primary p-8 flex-col justify-between relative overflow-hidden text-on-primary">
          <div className="absolute inset-0 bg-[radial-gradient(#075fac_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
          
          <div className="relative z-10 flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-secondary-container">sailing</span>
            <span className="font-bold text-xl tracking-tight">BOCS Maritime</span>
          </div>

          <div className="relative z-10 space-y-3 my-auto py-8">
            <h3 className="font-bold text-2xl text-on-primary leading-tight">
              Système Certifié de Gestion Logistique & FNE
            </h3>
            <p className="text-xs text-secondary-fixed-dim leading-relaxed">
              Plateforme unifiée d'échanges documentaires, de suivi d'escales navires, de facturation normalisée et d'administration des comptes.
            </p>
          </div>

          <div className="relative z-10 text-[11px] text-outline font-mono flex items-center justify-between border-t border-white/10 pt-3">
            <span>BOCS Fleet System v2.4</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Secured
            </span>
          </div>
        </div>

        {/* Right Side: Dynamic Form Container */}
        <div className="w-full md:w-7/12 p-6 sm:p-10 overflow-y-auto bg-surface">
          
          {/* LOGIN MODE */}
          {mode === 'login' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-1">Portail d'Authentification</h2>
                <p className="text-xs text-on-surface-variant">Saisissez vos identifiants pour accéder à vos modules autorisés.</p>
              </div>

              {loginError && (
                <div className="p-3 bg-error-container text-on-error-container text-xs font-semibold rounded-lg border border-error/30 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface uppercase mb-1" htmlFor="email">
                    Adresse E-mail
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">mail</span>
                    <input
                      id="email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="admin@bocs.ci"
                      className="w-full h-11 pl-10 pr-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface uppercase mb-1" htmlFor="password">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">lock</span>
                    <input
                      id="password"
                      type="password"
                      required
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-on-surface-variant cursor-pointer">
                    <input type="checkbox" className="rounded border-outline-variant text-primary focus:ring-secondary" />
                    <span>Se souvenir de moi</span>
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setMode('forgot')} 
                    className="text-secondary font-semibold hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full h-11 bg-primary text-on-primary font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-secondary transition-all active:scale-[0.98] shadow flex items-center justify-center gap-2"
                >
                  <span>Connexion Sécurisée</span>
                  <span className="material-symbols-outlined text-base">login</span>
                </button>
              </form>

              {/* DEMO ACCOUNTS QUICK ACCESS */}
              <div className="pt-4 border-t border-outline-variant space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-outline uppercase tracking-wider">Accès Rapide Démo par Rôle:</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('ADMIN')}
                    className="p-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded text-purple-900 font-bold text-left flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">shield_person</span>
                    <span>Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('AGENT_IMPORT')}
                    className="p-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-blue-900 font-bold text-left flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">input</span>
                    <span>Import</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('AGENT_EXPORT')}
                    className="p-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded text-amber-900 font-bold text-left flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">anchor</span>
                    <span>Export</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('COMPTABILITE')}
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-900 font-bold text-left flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">credit_card</span>
                    <span>Compta FNE</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('CLIENT_EXPORT')}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-900 font-bold text-left flex items-center gap-1.5 transition-all col-span-2 sm:col-span-2"
                  >
                    <span className="material-symbols-outlined text-sm">domain</span>
                    <span>Client Exporteur</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 text-center">
                <p className="text-xs text-on-surface-variant">
                  Nouveau client maritime ?{' '}
                  <button 
                    onClick={() => setMode('register')} 
                    className="text-secondary font-bold hover:underline"
                  >
                    Créer un compte client
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* REGISTER MODE */}
          {mode === 'register' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-1">Création de Compte Client</h2>
                <p className="text-xs text-on-surface-variant">Inscrivez votre entreprise pour soumettre vos Draft BLs Export.</p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Nom du Responsable *</label>
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={e => setRegFullName(e.target.value)}
                      placeholder="Jean-Baptiste Dupont"
                      className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Raison Sociale / Entreprise *</label>
                    <input
                      type="text"
                      required
                      value={regCompany}
                      onChange={e => setRegCompany(e.target.value)}
                      placeholder="Société Ivoirienne d'Export SA"
                      className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-secondary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Adresse E-mail Professionnelle *</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="contact@entreprise-export.ci"
                    className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-secondary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Téléphone *</label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      placeholder="+225 27 21 00 11"
                      className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Pays d'Implantation</label>
                    <select
                      value={regCountry}
                      onChange={e => setRegCountry(e.target.value)}
                      className="w-full h-10 px-3 bg-[#ffe135] hover:bg-[#ffe855] border border-[#e5c122] text-[#0f172a] rounded-xl text-xs font-black cursor-pointer outline-none transition-all"
                    >
                      <option value="CI">Côte d'Ivoire</option>
                      <option value="SN">Sénégal</option>
                      <option value="ML">Mali</option>
                      <option value="BF">Burkina Faso</option>
                      <option value="FR">France</option>
                      <option value="OT">Autre</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Mot de passe *</label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Confirmation *</label>
                    <input
                      type="password"
                      required
                      value={regConfirmPassword}
                      onChange={e => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-secondary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-11 mt-2 bg-primary text-on-primary font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-secondary transition-all active:scale-[0.98] shadow flex items-center justify-center gap-2"
                >
                  <span>Valider l'Inscription</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              </form>

              <div className="pt-2 text-center">
                <p className="text-xs text-on-surface-variant">
                  Déjà un compte ?{' '}
                  <button 
                    onClick={() => setMode('login')} 
                    className="text-secondary font-bold hover:underline"
                  >
                    Se connecter
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* FORGOT PASSWORD MODE */}
          {mode === 'forgot' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-1">Mot de Passe Oublié</h2>
                <p className="text-xs text-on-surface-variant">Saisissez votre e-mail pour recevoir les instructions de réinitialisation.</p>
              </div>

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface uppercase mb-1">Adresse E-mail Enregistrée</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">mail</span>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="nom@entreprise.com"
                      className="w-full h-11 pl-10 pr-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-secondary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-11 bg-primary text-on-primary font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-secondary transition-all shadow flex items-center justify-center gap-2"
                >
                  <span>Envoyer la demande</span>
                  <span className="material-symbols-outlined text-base">send</span>
                </button>
              </form>

              <div className="pt-4 border-t border-outline-variant text-center">
                <button 
                  onClick={() => setMode('login')} 
                  className="text-xs text-secondary font-bold hover:underline inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Retour à la connexion</span>
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS REGISTER */}
          {mode === 'success_register' && (
            <div className="text-center space-y-5 py-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>
              <h3 className="text-2xl font-bold text-primary">Compte Client Enregistré !</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                Votre entreprise <strong className="text-primary">{regCompany}</strong> a été enregistrée avec succès. Vous pouvez directement vous connecter pour saisir vos Draft BLs Export.
              </p>
              <button
                onClick={() => setMode('login')}
                className="px-6 py-2.5 bg-primary text-on-primary font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-secondary transition-all shadow"
              >
                Aller à la connexion
              </button>
            </div>
          )}

          {/* SUCCESS FORGOT */}
          {mode === 'success_forgot' && (
            <div className="text-center space-y-5 py-6">
              <div className="w-16 h-16 bg-blue-100 text-secondary rounded-full flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-4xl">mark_email_read</span>
              </div>
              <h3 className="text-2xl font-bold text-primary">Instructions Envoyées !</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                Un lien de réinitialisation sécurisé a été transmis à l'adresse <strong className="text-primary">{forgotEmail}</strong>. Veuillez consulter votre boîte de réception.
              </p>
              <button
                onClick={() => setMode('login')}
                className="px-6 py-2.5 bg-primary text-on-primary font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-secondary transition-all shadow"
              >
                Retour à la connexion
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
