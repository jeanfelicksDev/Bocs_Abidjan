import React, { useState, useEffect } from 'react';
import {
  Anchor,
  ArrowRight,
  Building2,
  Clock,
  Layers3,
  Ship,
  Receipt,
  Calculator,
  Compass,
  ShieldCheck,
  Database
} from 'lucide-react';
import { Escale, BL, DraftExport, Invoice, UserRole } from '../types';
import { NavTab } from '../components/layout/Sidebar';
import { hasPermission, isTabAllowed, usePermissionsSync } from '../utils/permissions';

interface DashboardProps {
  escales: Escale[];
  bls: BL[];
  drafts: DraftExport[];
  invoices: Invoice[];
  userRole: UserRole;
  /** Utilisateur connecté (permet d'appliquer les overrides individuels en plus de la matrice par rôle). */
  currentUser?: { id: number; role: UserRole; estActif?: boolean };
  exchangeRateUsd: number;
  onNavigateTab: (tab: NavTab) => void;
  onDeleteEscale?: (id: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  escales,
  bls,
  drafts,
  invoices,
  userRole,
  currentUser,
  exchangeRateUsd,
  onNavigateTab,
  onDeleteEscale
}) => {
  // Calculations
  const activeEscalesCount = escales.filter(e => e.statut === 'EN_COURS').length;
  const pendingImportBlsCount = bls.filter(b => b.statutImport !== 'FACTURE').length;
  const pendingDraftsCount = drafts.filter(d => d.statut === 'SOUMIS' || d.statut === 'BROUILLON').length;
  const totalSoldeDuFcfa = invoices.reduce((acc, inv) => acc + (inv.soldeDuFcfa || 0), 0);

  // GMT Live Clock
  const [currentTime, setCurrentTime] = useState<string>('');

  // RBAC : les droits effectifs proviennent désormais de la matrice des habilitations
  // (bocs_permissions_matrix + overrides par utilisateur) au lieu de listes codées en dur.
  usePermissionsSync();

  const isAllowed = (tab: NavTab) => isTabAllowed(currentUser || { id: -1, role: userRole }, tab);

  const handleNavClick = (tab: NavTab) => {
    if (isAllowed(tab)) {
      onNavigateTab(tab);
    }
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC'
      });
      setCurrentTime(`${timeStr} GMT`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in text-zinc-900 w-full max-w-[2465px] mx-auto font-sans antialiased">

      {/* ─── 1. TOP EXECUTIVE CLEAN HEADER (Matching Image 2) ─── */}
      <div className="w-full bg-white border border-zinc-200 rounded-2xl px-6 py-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#005DAA]/10 border border-[#005DAA]/30 flex items-center justify-center shadow-2xs shrink-0">
            <Anchor className="w-5 h-5 text-[#005DAA]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-black tracking-wider text-zinc-900 font-sans">BOCS CI</span>
              <span className="text-[11px] font-black uppercase px-3 py-0.5 rounded-full bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30 tracking-wider shadow-2xs">
                ABIDJAN TERMINAL
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-bold mt-0.5">Bremen Overseas Chartering Shipping • Agence Consignataire</p>
          </div>
        </div>

        {/* Right Info Badges */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-700 font-bold">
            <Building2 className="w-4 h-4 text-[#005DAA]" />
            <span>Port Autonome d'Abidjan (CIABJ) • Quai Vridi</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[#005DAA] bg-[#F0F7FF] px-3.5 py-2 rounded-xl border border-[#005DAA]/25 font-black">
            <Clock className="w-4 h-4 text-[#005DAA]" />
            <span>{currentTime || '08:32:01 GMT'}</span>
          </div>
        </div>
      </div>

      {/* ─── 2. HERO BANNER (Plateforme Intégrée de Gestion & Facturation Maritime) ─── */}
      <div className="bg-white border border-zinc-200 rounded-3xl py-7 px-8 sm:py-8 sm:px-10 shadow-xs relative overflow-hidden">
        <div className="space-y-3 w-full relative z-10">
          <h1 className="text-2xl sm:text-3xl md:text-[28px] lg:text-[34px] xl:text-[40px] font-black tracking-tight leading-tight text-[#002B49]">
            Plateforme Intégrée de <span className="text-[#00875A] font-serif italic font-normal">Gestion & Facturation Maritime</span>
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 font-medium leading-relaxed max-w-4xl">
            Supervision des escales à Abidjan, dédouanement automatisé XML GUCE & ALIS, émission certifiée des connaissements et facturation électronique unifiée (Multi-Fret & DGI/FNE).
          </p>
        </div>
      </div>

      {/* ─── 3. 4 KPI BENTO CARDS (Centered max-w container as Image 2) ─── */}
      <div className="max-w-5xl xl:max-w-6xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">

        {/* KPI 1 : Escales Aux Quais */}
        <div
          onClick={() => handleNavClick('vessels')}
          className={`bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between transition-all select-none ${isAllowed('vessels') ? 'hover:border-[#005DAA] cursor-pointer group shadow-xs hover:shadow-md' : 'opacity-60 cursor-not-allowed'
            }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 group-hover:text-[#005DAA] transition-colors">
                Escales aux Quais
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Port d'Abidjan &amp; Rade</p>
            </div>
            <div className="p-2.5 bg-[#F0F7FF] border border-[#005DAA]/25 rounded-xl text-[#005DAA] group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-xl">directions_boat</span>
            </div>
          </div>
          <div className="flex items-baseline space-x-2.5">
            <span className="text-4xl font-black text-[#005DAA] font-sans tracking-tight">{activeEscalesCount}</span>
            <span className="text-xs font-extrabold text-zinc-800 flex items-center gap-0.5">
              <span className="material-symbols-outlined text-sm text-[#00875A]">anchor</span>
              <span>En cours</span>
            </span>
          </div>
        </div>

        {/* KPI 2 : BLs Import à Traiter */}
        <div
          onClick={() => handleNavClick('import')}
          className={`bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between transition-all select-none ${isAllowed('import') ? 'hover:border-[#005DAA] cursor-pointer group shadow-xs hover:shadow-md' : 'opacity-60 cursor-not-allowed'
            }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 group-hover:text-[#005DAA] transition-colors">
                BLs Import à Traiter
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Connaissements ouverts</p>
            </div>
            <div className="p-2.5 bg-[#ECFDF5] border border-[#00875A]/25 rounded-xl text-[#00875A] group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-xl">description</span>
            </div>
          </div>
          <div className="flex items-baseline space-x-2.5">
            <span className="text-4xl font-black text-[#00875A] font-sans tracking-tight">{pendingImportBlsCount}</span>
            <span className="text-[10px] font-bold text-[#00875A] bg-[#ECFDF5] px-2 py-0.5 rounded-md border border-[#00875A]/30">
              À Facturer
            </span>
          </div>
        </div>

        {/* KPI 3 : Drafts Export Soumis */}
        <div
          onClick={() => handleNavClick('export')}
          className={`bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between transition-all select-none ${isAllowed('export') ? 'hover:border-[#005DAA] cursor-pointer group shadow-xs hover:shadow-md' : 'opacity-60 cursor-not-allowed'
            }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 group-hover:text-[#005DAA] transition-colors">
                Drafts Export Soumis
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Réservations chargeurs</p>
            </div>
            <div className="p-2.5 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-700 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-xl">file_present</span>
            </div>
          </div>
          <div className="flex items-baseline space-x-2.5">
            <span className="text-4xl font-black text-[#005DAA] font-sans tracking-tight">{pendingDraftsCount}</span>
            <span className="text-xs font-semibold text-zinc-600">Attente validation</span>
          </div>
        </div>

        {/* KPI 4 : Créances & Solde Dû */}
        <div
          onClick={() => handleNavClick('facturation_balance')}
          className={`bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between transition-all select-none ${isAllowed('facturation_balance') ? 'hover:border-[#005DAA] cursor-pointer group shadow-xs hover:shadow-md' : 'opacity-60 cursor-not-allowed'
            }`}
          title={isAllowed('facturation_balance') ? "Consulter la Balance Âgée & Suivi des Créances" : "Accès réservé à la comptabilité/admin"}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 group-hover:text-[#005DAA] transition-colors">
                Créances &amp; Solde Dû
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Règlements attendus</p>
            </div>
            <div className="p-2.5 bg-[#F0F7FF] border border-[#005DAA]/25 rounded-xl text-[#005DAA] group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-zinc-900 font-sans">{totalSoldeDuFcfa.toLocaleString('fr-FR')} FCFA</span>
            <span className="text-[11px] text-[#005DAA] font-bold mt-0.5">~{(totalSoldeDuFcfa / exchangeRateUsd).toFixed(0)} USD</span>
          </div>
        </div>

      </div>

      {/* ─── 4. 5 BUSINESS MODULE CARDS (Matching Image 2 bottom row) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5 pt-4">

        {/* Module 1: Manifestes & Escales */}
        <div
          onClick={() => handleNavClick('vessels')}
          className={`rounded-3xl p-6 flex flex-col justify-between transition-all select-none border bg-white ${isAllowed('vessels')
              ? 'cursor-pointer group hover:-translate-y-1 shadow-xs hover:shadow-md border-zinc-200 hover:border-[#005DAA]'
              : 'opacity-50 cursor-not-allowed border-zinc-200'
            }`}
        >
          <div>
            <div className="mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#005DAA]/10 border border-[#005DAA]/20 flex items-center justify-center text-[#005DAA] group-hover:bg-[#005DAA] group-hover:text-white transition-all shadow-xs">
                <Layers3 className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-black text-lg text-[#002B49] group-hover:text-[#005DAA] transition-colors mb-2 font-display">
              Manifestes & Escales
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed font-normal">
              Parsing automatisé des fichiers XML douaniers, détection des conteneurs SOC/COC, vrac et suivi du registre.
            </p>
          </div>
          <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-xs font-black text-[#005DAA]">
            <span>{isAllowed('vessels') ? 'Consulter le Registre' : 'Accès restreint'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Module 2: Drafts & BL Export */}
        <div
          onClick={() => handleNavClick('export')}
          className={`rounded-3xl p-6 flex flex-col justify-between transition-all select-none border bg-white ${isAllowed('export')
              ? 'cursor-pointer group hover:-translate-y-1 shadow-xs hover:shadow-md border-zinc-200 hover:border-[#005DAA]'
              : 'opacity-50 cursor-not-allowed border-zinc-200'
            }`}
        >
          <div>
            <div className="mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#005DAA]/10 border border-[#005DAA]/20 flex items-center justify-center text-[#005DAA] group-hover:bg-[#005DAA] group-hover:text-white transition-all shadow-xs">
                <Ship className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-black text-lg text-[#002B49] group-hover:text-[#005DAA] transition-colors mb-2 font-display">
              Drafts & BL Export
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed font-normal">
              Saisie des instructions de connaissement (Shipping Instructions), validation armateur et émission des BLs.
            </p>
          </div>
          <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-xs font-black text-[#005DAA]">
            <span>{isAllowed('export') ? 'Espace Export' : 'Accès restreint'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Module 3: Facturation Maritime */}
        <div
          onClick={() => handleNavClick('facturation')}
          className={`rounded-3xl p-6 flex flex-col justify-between transition-all select-none border bg-white ${isAllowed('facturation')
              ? 'cursor-pointer group hover:-translate-y-1 shadow-xs hover:shadow-md border-zinc-200 hover:border-[#00875A]'
              : 'opacity-50 cursor-not-allowed border-zinc-200'
            }`}
        >
          <div>
            <div className="mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#00875A]/10 border border-[#00875A]/20 flex items-center justify-center text-[#00875A] group-hover:bg-[#00875A] group-hover:text-white transition-all shadow-xs">
                <Receipt className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-black text-lg text-[#002B49] group-hover:text-[#00875A] transition-colors mb-2 font-display">
              Facturation Maritime
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed font-normal">
              Calcul multi-rubriques (Aconage, Roro, Sûretés, Débours) et facturation certifiée DGI/FNE sans doublon.
            </p>
          </div>
          <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-xs font-black text-[#00875A]">
            <span>{isAllowed('facturation') ? 'Facturation & Reçus' : 'Accès restreint'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Module 4: Calcul des DMDT (Active/Highlighted card as shown in Image 2) */}
        <div
          onClick={() => handleNavClick('surestarie')}
          className={`rounded-3xl p-6 flex flex-col justify-between transition-all select-none relative bg-white ${isAllowed('surestarie')
              ? 'cursor-pointer group hover:-translate-y-1 shadow-md border-2 border-[#005DAA]'
              : 'opacity-50 cursor-not-allowed border border-zinc-200'
            }`}
        >
          <div>
            <div className="mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#005DAA] text-white flex items-center justify-center transition-all shadow-xs">
                <Calculator className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-black text-lg text-[#005DAA] transition-colors mb-2 font-display">
              Calcul des DMDT
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed font-normal">
              Calcul dégressif des surestaries &amp; détentions conteneurs, franchises import/export et émission proforma.
            </p>
          </div>
          <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-xs font-black text-[#005DAA]">
            <span>{isAllowed('surestarie') ? 'Calculateur DMDT' : 'Accès restreint'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Module 5: Radar & Quai Vridi */}
        <div
          onClick={() => handleNavClick('vessels')}
          className={`rounded-3xl p-6 flex flex-col justify-between transition-all select-none border bg-white ${isAllowed('vessels')
              ? 'cursor-pointer group hover:-translate-y-1 shadow-xs hover:shadow-md border-zinc-200 hover:border-[#005DAA]'
              : 'opacity-50 cursor-not-allowed border-zinc-200'
            }`}
        >
          <div>
            <div className="mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#005DAA]/10 border border-[#005DAA]/20 flex items-center justify-center text-[#005DAA] group-hover:bg-[#005DAA] group-hover:text-white transition-all shadow-xs">
                <Compass className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-black text-lg text-[#002B49] group-hover:text-[#005DAA] transition-colors mb-2 font-display">
              Radar & Quai Vridi
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed font-normal">
              Positionnement des navires en rade, programmation des postes à quai et calendrier officiel des mouvements.
            </p>
          </div>
          <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-xs font-black text-[#005DAA]">
            <span>Radar Flotte</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

      </div>

      {/* ─── 5. FOOTER LEGAL & COMPLIANCE (Matching Image 2) ─── */}
      <footer className="mt-12 sm:mt-16 pt-6 border-t border-zinc-200 flex flex-wrap items-center justify-between text-[11px] font-semibold text-zinc-500 gap-4 select-none">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-zinc-700">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00875A]" />
            <span>Conformité Douanière GUCE &amp; DGI FNE (Côte d'Ivoire)</span>
          </div>
          <span className="text-zinc-300">•</span>
          <div className="flex items-center gap-1.5 text-zinc-700">
            <Database className="w-3.5 h-3.5 text-[#005DAA]" />
            <span>PostgreSQL Neon Cloud Chiffré</span>
          </div>
          {hasPermission(currentUser || { id: -1, role: userRole }, 'admin_rights_assign') && (
            <>
              <span className="text-zinc-300">•</span>
              <button
                type="button"
                onClick={() => onNavigateTab('admin_rights')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all font-bold text-[11px] cursor-pointer hover:shadow-xs active:scale-95"
                title="Accéder directement à l'attribution des droits utilisateurs (Admin)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Attribution des Profils</span>
              </button>
            </>
          )}
        </div>
        <div className="text-zinc-500">
          © 2026 BOCS CI Maritime Agency • Abidjan Port Operations. Tous droits réservés.
        </div>
      </footer>

    </div>
  );
};


