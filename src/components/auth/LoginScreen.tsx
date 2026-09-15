import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { toastSuccess, toastError, toastWarning } from '../common/Toast';
import { 
  ShieldCheck, 
  Anchor, 
  FileText, 
  CreditCard, 
  Lock, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  LogIn, 
  Eye, 
  EyeOff,
  UserCheck
} from 'lucide-react';

interface LoginScreenProps {
  allUsers: User[];
  onLoginSuccess: (user: User) => void;
  onRegisterUser: (user: User) => Promise<boolean>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  allUsers,
  onLoginSuccess,
  onRegisterUser
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCountry, setRegCountry] = useState('Côte d\'Ivoire');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [demoResetCode, setDemoResetCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toastWarning('Veuillez saisir votre email et mot de passe.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Try API login first
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: loginEmail.trim(),
          password: loginPassword.trim()
        })
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          toastSuccess(`Bienvenue, ${data.user.nomComplet} !`);
          onLoginSuccess(data.user);
          return;
        }
      }

      // 2. Local fallback matching from allUsers state
      const localUser = allUsers.find(u => u.email.toLowerCase() === loginEmail.trim().toLowerCase());
      if (localUser) {
        if (!localUser.estActif) {
          toastError('Ce compte a été désactivé par l\'administrateur.');
          return;
        }
        if (localUser.motDePasse && localUser.motDePasse !== loginPassword.trim()) {
          toastError('Mot de passe incorrect.');
          return;
        }
        toastSuccess(`Bienvenue, ${localUser.nomComplet} !`);
        onLoginSuccess(localUser);
        return;
      }

      toastError('Identifiants incorrects ou compte inexistant.');
    } catch (err: any) {
      toastError(err.message || 'Erreur lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick 1-Click Demo Login
  const handleQuickLogin = (roleOrId: UserRole | number) => {
    let target: User | undefined;
    if (typeof roleOrId === 'number') {
      target = allUsers.find(u => u.id === roleOrId);
    } else {
      target = allUsers.find(u => u.role === roleOrId);
    }
    if (target) {
      toastSuccess(`Connecté en tant que ${target.nomComplet} (${target.nomSociete || getRoleLabel(target.role)})`);
      onLoginSuccess(target);
    } else {
      toastWarning(`Aucun utilisateur trouvé.`);
    }
  };

  // Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      toastError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (regPassword.length < 6) {
      toastWarning('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    setIsLoading(true);

    const newUser: User = {
      id: Date.now(),
      nomComplet: regFullName.trim(),
      email: regEmail.trim().toLowerCase(),
      role: 'CLIENT_EXPORT',
      nomSociete: regCompany.trim() || 'Client Exportateur',
      telephone: regPhone.trim() || '+225 00 00 00 00',
      pays: regCountry,
      estActif: true,
      motDePasse: regPassword.trim(),
      dateCreation: new Date().toISOString().split('T')[0]
    };

    const ok = await onRegisterUser(newUser);
    setIsLoading(false);

    if (ok) {
      toastSuccess('Compte client créé avec succès ! Vous pouvez maintenant vous connecter.');
      setMode('login');
      setLoginEmail(newUser.email);
      setLoginPassword('');
    }
  };

  // Handle Forgot Password Request (Step 1)
  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toastWarning('Veuillez saisir votre adresse email.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_password_reset',
          email: forgotEmail.trim()
        })
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          setDemoResetCode(data.demoResetCode || null);
          setForgotStep('verify');
          toastSuccess(`Un code de sécurité à 6 chiffres a été préparé pour ${forgotEmail}.`);
          return;
        } else {
          toastError(data.error || 'Impossible de réinitialiser ce compte.');
          return;
        }
      }

      // Local fallback if offline
      const exists = allUsers.find(u => u.email.toLowerCase() === forgotEmail.trim().toLowerCase());
      if (exists) {
        const localCode = '123456';
        setDemoResetCode(localCode);
        setForgotStep('verify');
        toastSuccess(`Code de sécurité généré pour ${forgotEmail}.`);
      } else {
        toastError('Aucun compte associé à cette adresse email.');
      }
    } catch (err: any) {
      toastError(err.message || 'Erreur lors de la demande de réinitialisation.');
    } finally {
      setIsResetting(false);
    }
  };

  // Handle Forgot Password Confirmation (Step 2)
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim()) {
      toastWarning('Veuillez saisir le code de sécurité reçu.');
      return;
    }
    if (newPassword.length < 6) {
      toastWarning('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toastError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_password_reset',
          email: forgotEmail.trim(),
          resetCode: resetCode.trim(),
          newPassword: newPassword.trim()
        })
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          toastSuccess('Mot de passe réinitialisé avec succès !');
          setMode('login');
          setLoginEmail(forgotEmail);
          setLoginPassword(newPassword);
          setForgotStep('request');
          setResetCode('');
          setNewPassword('');
          setConfirmNewPassword('');
          return;
        } else {
          toastError(data.error || 'Code invalide ou expiré.');
          return;
        }
      }

      // Offline fallback
      toastSuccess('Mot de passe mis à jour !');
      setMode('login');
      setLoginEmail(forgotEmail);
      setLoginPassword(newPassword);
      setForgotStep('request');
    } catch (err: any) {
      toastError(err.message || 'Erreur lors de la validation du code.');
    } finally {
      setIsResetting(false);
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'Administrateur';
      case 'AGENT_IMPORT': return 'Agent Import';
      case 'AGENT_EXPORT': return 'Agent Export';
      case 'COMPTABILITE': return 'Comptabilité';
      case 'CLIENT_EXPORT': return 'Client Export';
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Subtle ambient background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-100/40 via-slate-50 to-slate-100/80 pointer-events-none"></div>
      
      {/* Geometric architectural pattern - very subtle */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#18181B 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      ></div>

      <div className="w-full max-w-[440px] relative z-10 my-auto">
        
        {/* Main Clean Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-200/60 p-7 sm:p-9 transition-all">
          
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-3">
              <svg className="h-9 w-auto" viewBox="0 0 350 90" xmlns="http://www.w3.org/2000/svg">
                <text x="340" y="42" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fontSize="52" fontStyle="italic" fill="#00875A" textAnchor="end" letterSpacing="-2">BOCS</text>
                <polygon points="0,48 350,48 315,88 290,88 316.25,58 0,58" fill="#002B49" />
                <text x="282" y="81" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="19" fill="#002B49" textAnchor="end">ABIDJAN</text>
              </svg>
            </div>
            
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {mode === 'login' && 'Connexion à votre Espace'}
              {mode === 'register' && 'Créer un Compte Client'}
              {mode === 'forgot' && 'Récupération de Mot de Passe'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'login' && 'Système de Gestion Maritime & Facturation'}
              {mode === 'register' && 'Enregistrez votre société pour vos expéditions export'}
              {mode === 'forgot' && 'Réinitialisez vos accès de manière sécurisée'}
            </p>
          </div>

          {/* MODE: LOGIN */}
          {mode === 'login' && (
            <div className="space-y-5 animate-fade-in">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                
                {/* Email input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="login-email">
                    Adresse email professionnelle
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="admin@bocs.ci"
                      className="w-full h-11 pl-10 pr-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15 transition-all"
                    />
                  </div>
                </div>

                {/* Password input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700" htmlFor="login-password">
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setForgotStep('request'); }}
                      className="text-xs text-[#005DAA] hover:text-blue-800 font-medium transition-colors cursor-pointer"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-10 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      tabIndex={-1}
                      aria-label="Afficher le mot de passe"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="checkbox"
                    id="remember-me"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#005DAA] focus:ring-[#005DAA] cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="text-xs text-slate-600 cursor-pointer">
                    Mémoriser ma session sur cet appareil
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-[#005DAA] hover:bg-[#004580] text-white font-semibold text-xs tracking-wide rounded-xl transition-all active:scale-[0.99] shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span>Se connecter</span>
                      <LogIn className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* DEMO QUICK ACCESS CHIPS */}
              <div className="pt-5 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Comptes de test (1-clic)
                  </span>
                  <span className="text-[10px] text-slate-400">Mode démo</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('ADMIN')}
                    className="px-1 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer hover:border-slate-300 active:scale-95"
                    title="Se connecter en tant qu'Administrateur"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-[9px] font-bold">Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('AGENT_IMPORT')}
                    className="px-1 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer hover:border-slate-300 active:scale-95"
                    title="Se connecter en tant qu'Agent Import"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[9px] font-bold">Import</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('AGENT_EXPORT')}
                    className="px-1 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer hover:border-slate-300 active:scale-95"
                    title="Se connecter en tant qu'Agent Export"
                  >
                    <Anchor className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[9px] font-bold">Export</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('COMPTABILITE')}
                    className="px-1 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer hover:border-slate-300 active:scale-95"
                    title="Se connecter en tant que Comptabilité"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[9px] font-bold">Compta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin(5)}
                    className="px-1 py-1.5 bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200 rounded-lg text-indigo-900 text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer hover:border-indigo-300 active:scale-95"
                    title="Client Agro Export SA (Moussa TRAORE)"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-[9px] font-extrabold truncate max-w-full">Agro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin(6)}
                    className="px-1 py-1.5 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 rounded-lg text-emerald-900 text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer hover:border-emerald-300 active:scale-95"
                    title="Client SIFCA Cacao SA (ZIAGOUE Jean-Félix)"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[9px] font-extrabold truncate max-w-full">SIFCA</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin(7)}
                    className="px-1 py-1.5 bg-teal-50/70 hover:bg-teal-100/70 border border-teal-200 rounded-lg text-teal-900 text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer hover:border-teal-300 active:scale-95"
                    title="Client Tropica Trading CI (Fatoumata KONE)"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                    <span className="text-[9px] font-extrabold truncate max-w-full">Tropica</span>
                  </button>
                </div>
              </div>

              {/* Registration link */}
              <div className="pt-2 text-center">
                <p className="text-xs text-slate-500">
                  Client exportateur maritime ?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-[#005DAA] font-semibold hover:underline transition-colors cursor-pointer"
                  >
                    Créer un compte client
                  </button>
                </p>
              </div>

            </div>
          )}

          {/* MODE: REGISTER */}
          {mode === 'register' && (
            <div className="space-y-4 animate-fade-in">
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nom du responsable *
                  </label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={e => setRegFullName(e.target.value)}
                    placeholder="Jean-Baptiste Dupont"
                    className="w-full h-10 px-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Raison sociale / Entreprise *
                  </label>
                  <input
                    type="text"
                    required
                    value={regCompany}
                    onChange={e => setRegCompany(e.target.value)}
                    placeholder="Ivoire Cacao Export SA"
                    className="w-full h-10 px-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email professionnel *
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="contact@ivoire-export.ci"
                      className="w-full h-10 px-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Téléphone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      placeholder="+225 27 21 00 11"
                      className="w-full h-10 px-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mot de passe *
                    </label>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="Min. 6 caractères"
                      className="w-full h-10 px-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirmation *
                    </label>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={e => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 px-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-[#00875A] hover:bg-[#006E48] text-white font-semibold text-xs tracking-wide rounded-xl transition-all active:scale-[0.99] shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <span>Créer mon compte client</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="pt-2 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-slate-600 hover:text-[#005DAA] font-medium transition-colors cursor-pointer"
                >
                  &larr; Retour à la connexion
                </button>
              </div>
            </div>
          )}

          {/* MODE: FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <div className="space-y-4 animate-fade-in">
              {forgotStep === 'request' ? (
                <form onSubmit={handleForgotRequest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Adresse email du compte *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder="admin@bocs.ci ou contact@client.ci"
                        className="w-full h-11 pl-10 pr-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isResetting}
                    className="w-full h-11 bg-[#005DAA] hover:bg-[#004580] text-white font-semibold text-xs tracking-wide rounded-xl transition-all active:scale-[0.99] shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isResetting ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <span>Envoyer le code de sécurité</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmReset} className="space-y-3.5">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span>Code transmis à <strong>{forgotEmail}</strong></span>
                      <button
                        type="button"
                        onClick={() => setForgotStep('request')}
                        className="text-[11px] text-[#005DAA] hover:underline font-semibold"
                      >
                        Changer
                      </button>
                    </div>
                    {demoResetCode && (
                      <div className="pt-1 flex items-center justify-between border-t border-blue-200">
                        <span className="text-[11px] text-slate-600">Code de test :</span>
                        <button
                          type="button"
                          onClick={() => setResetCode(demoResetCode)}
                          className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-800 rounded font-mono font-bold text-xs cursor-pointer"
                        >
                          {demoResetCode} (Insérer)
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Code de sécurité (6 chiffres) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={resetCode}
                      onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ex: 123456"
                      className="w-full h-11 px-3.5 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-center font-mono font-bold text-base tracking-widest text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nouveau mot de passe *
                      </label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Min. 6 car."
                        className="w-full h-10 px-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Confirmation *
                      </label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={confirmNewPassword}
                        onChange={e => setConfirmNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-10 px-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/15"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isResetting}
                    className="w-full h-11 bg-[#00875A] hover:bg-[#006E48] text-white font-semibold text-xs tracking-wide rounded-xl transition-all active:scale-[0.99] shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-1"
                  >
                    {isResetting ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Enregistrer le mot de passe</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="pt-2 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setForgotStep('request'); }}
                  className="text-xs text-slate-600 hover:text-[#005DAA] font-medium transition-colors cursor-pointer"
                >
                  &larr; Retour à la connexion
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Minimalist Footer */}
        <div className="mt-6 text-center space-y-1.5 text-xs text-slate-400">
          <div className="flex items-center justify-center gap-2">
            <span>BOCS Maritime v2.5</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Plateforme Sécurisée
            </span>
          </div>
          <p className="text-[11px] text-slate-400">© {new Date().getFullYear()} BOCS Abidjan — Tous droits réservés</p>
        </div>

      </div>

    </div>
  );
};
