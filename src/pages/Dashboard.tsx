import React, { useState, useEffect } from 'react';
import {
  Anchor,
  ArrowRight,
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
    <div className="space-y-6 animate-fade-in text-text-primary w-full max-w-[2465px] mx-auto font-sans antialiased">

      {/* ─── 1. TOP EXECUTIVE CLEAN HEADER (Matching Image 2) ─── */}
      <div className="w-full bg-white border border-border-default rounded-lg px-6 py-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shadow-1 shrink-0">
            <Anchor className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-black tracking-wider text-text-primary font-sans">BOCS CI</span>
            </div>
            <p className="text-xs text-text-muted font-bold mt-0.5">Bremen Overseas Chartering Shipping • Agence Consignataire</p>
          </div>
        </div>

        {/* Right Info Badges */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 font-mono text-primary bg-primaryLight px-3.5 py-2 rounded-xl border border-primary/25 font-black">
            <Clock className="w-4 h-4 text-primary" />
            <span>{currentTime || '08:32:01 GMT'}</span>
          </div>
        </div>
      </div>

      {/* ─── 2. HERO BANNER (Plateforme Intégrée de Gestion & Facturation Maritime) ─── */}
      <div className="bg-white border border-border-default rounded-xl py-7 px-8 sm:py-8 sm:px-10 shadow-xs relative overflow-hidden">
        <div className="space-y-3 w-full relative z-10">
          <h1 className="text-2xl sm:text-3xl md:text-2xl lg:text-[34px] xl:text-[40px] font-black tracking-tight leading-tight text-primaryDark">
            Plateforme Intégrée de <span className="text-success font-serif italic font-normal">Gestion & Facturation Maritime</span>
          </h1>
          <p className="text-sm sm:text-base text-text-secondary font-medium leading-relaxed max-w-4xl">
            Gestion des escales, suivi des Bls, consolidation des Manifeste et facturation des prestations.
          </p>
        </div>
      </div>

      {/* ─── 3. 4 KPI BENTO CARDS (Centered max-w container as Image 2) ─── */}
      <div className="max-w-5xl xl:max-w-6xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">

        {/* KPI 1 : Escales Aux Quais */}
        <div
          onClick={() => handleNavClick('vessels')}
          className={`bg-white border border-border-default rounded-lg p-5 flex flex-col justify-between transition-all select-none ${isAllowed('vessels') ? 'hover:border-primary cursor-pointer group shadow-xs hover:shadow-md' : 'opacity-60 cursor-not-allowed'
            }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary group-hover:text-primary transition-colors">
                Escales aux Quais
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Port d'Abidjan &amp; Rade</p>
            </div>
            <div className="p-2.5 bg-primaryLight border border-primary/25 rounded-xl text-primary group-hover:scale-110 transition-transform">
              <span aria-hidden="true" className="material-symbols-outlined text-xl">directions_boat</span>
            </div>
          </div>
          <div className="flex items-baseline space-x-2.5">
            <span className="text-4xl font-black text-primary font-sans tracking-tight">{activeEscalesCount}</span>
            <span className="text-xs font-extrabold text-text-primary flex items-center gap-0.5">
              <span aria-hidden="true" className="material-symbols-outlined text-sm text-success">anchor</span>
              <span>En cours</span>
            </span>
          </div>
        </div>

        {/* KPI 2 : BLs Import à Traiter */}
        <div
          onClick={() => handleNavClick('import')}
          className={`bg-white border border-border-default rounded-lg p-5 flex flex-col justify-between transition-all select-none ${isAllowed('import') ? 'hover:border-primary cursor-pointer group shadow-xs hover:shadow-md' : 'opacity-60 cursor-not-allowed'
            }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary group-hover:text-primary transition-colors">
                BLs Import à Traiter
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Connaissements ouverts</p>
            </div>
            <div className="p-2.5 bg-[#ECFDF5] border border-success/25 rounded-xl text-success group-hover:scale-110 transition-transform">
              <span aria-hidden="true" className="material-symbols-outlined text-xl">description</span>
            </div>
          </div>
          <div className="flex items-baseline space-x-2.5">
            <span className="text-4xl font-black text-success font-sans tracking-tight">{pendingImportBlsCount}</span>
            <span className="text-xs font-bold text-success bg-[#ECFDF5] px-2 py-0.5 rounded-md border border-success/30">
              À Facturer
            </span>
          </div>
        </div>

        {/* KPI 3 : Drafts Export Soumis */}
        <div
          onClick={() => handleNavClick('export')}
          className={`bg-white border border-border-default rounded-lg p-5 flex flex-col justify-between transition-all select-none ${isAllowed('export') ? 'hover:border-primary cursor-pointer group shadow-xs hover:shadow-md' : 'opacity-60 cursor-not-allowed'
            }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary group-hover:text-primary transition-colors">
                Drafts Export Soumis
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Réservations chargeurs</p>
            </div>
            <div className="p-2.5 bg-surface-sunken border border-border-default rounded-xl text-text-secondary group-hover:scale-110 transition-transform">
              <span aria-hidden="true" className="material-symbols-outlined text-xl">file_present</span>
            </div>
          </div>
          <div className="flex items-baseline space-x-2.5">
            <span className="text-4xl font-black text-primary font-sans tracking-tight">{pendingDraftsCount}</span>
            <span className="text-xs font-semibold text-text-secondary">Attente validation</span>
          </div>
        </div>

        {/* KPI 4 : Créances & Solde Dû */}
        <div
          onClick={() => handleNavClick('facturation_balance')}
          className={`bg-white border border-border-default rounded-lg p-5 flex flex-col justify-between transition-all select-none ${isAllowed('facturation_balance') ? 'hover:border-primary cursor-pointer group shadow-xs hover:shadow-md' : 'opacity-60 cursor-not-allowed'
            }`}
          title={isAllowed('facturation_balance') ? "Consulter la Balance Âgée & Suivi des Créances" : "Accès réservé à la comptabilité/admin"}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary group-hover:text-primary transition-colors">
                Créances &amp; Solde Dû
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Règlements attendus</p>
            </div>
            <div className="p-2.5 bg-primaryLight border border-primary/25 rounded-xl text-primary group-hover:scale-110 transition-transform">
              <span aria-hidden="true" className="material-symbols-outlined text-xl">payments</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-text-primary font-sans">{totalSoldeDuFcfa.toLocaleString('fr-FR')} FCFA</span>
            <span className="text-xs text-primary font-bold mt-0.5">~{(totalSoldeDuFcfa / exchangeRateUsd).toFixed(0)} USD</span>
          </div>
        </div>

      </div>

      {/* ─── 4. 5 BUSINESS MODULE CARDS (Matching Image 2 bottom row) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5 pt-4">

        {/* Module 1: Manifestes & Escales */}
        <div
          onClick={() => handleNavClick('vessels')}
          className={`rounded-xl p-6 flex flex-col justify-between transition-all select-none border bg-white ${isAllowed('vessels')
              ? 'cursor-pointer group hover:-translate-y-1 shadow-xs hover:shadow-md border-border-default hover:border-primary'
              : 'opacity-50 cursor-not-allowed border-border-default'
            }`}
        >
          <div>
            <div className="mb-5">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-xs">
                <Layers3 className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-black text-lg text-primaryDark group-hover:text-primary transition-colors mb-2 font-display">
              Manifestes & Escales
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed font-normal">
              Parsing automatisé des fichiers XML douaniers, détection des conteneurs SOC/COC, vrac et suivi du registre.
            </p>
          </div>
          <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-xs font-black text-primary">
            <span>{isAllowed('vessels') ? 'Consulter le Registre' : 'Accès restreint'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Module 2: Drafts & BL Export */}
        <div
          onClick={() => handleNavClick('export')}
          className={`rounded-xl p-6 flex flex-col justify-between transition-all select-none border bg-white ${isAllowed('export')
              ? 'cursor-pointer group hover:-translate-y-1 shadow-xs hover:shadow-md border-border-default hover:border-primary'
              : 'opacity-50 cursor-not-allowed border-border-default'
            }`}
        >
          <div>
            <div className="mb-5">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-xs">
                <Ship className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-black text-lg text-primaryDark group-hover:text-primary transition-colors mb-2 font-display">
              Drafts & BL Export
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed font-normal">
              Saisie des instructions de connaissement (Shipping Instructions), validation armateur et émission des BLs.
            </p>
          </div>
          <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-xs font-black text-primary">
            <span>{isAllowed('export') ? 'Espace Export' : 'Accès restreint'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Module 3: Facturation Maritime */}
        <div
          onClick={() => handleNavClick('facturation')}
          className={`rounded-xl p-6 flex flex-col justify-between transition-all select-none border bg-white ${isAllowed('facturation')
              ? 'cursor-pointer group hover:-translate-y-1 shadow-xs hover:shadow-md border-border-default hover:border-success'
              : 'opacity-50 cursor-not-allowed border-border-default'
            }`}
        >
          <div>
            <div className="mb-5">
              <div className="w-12 h-12 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center text-success group-hover:bg-success group-hover:text-white transition-all shadow-xs">
                <Receipt className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-black text-lg text-primaryDark group-hover:text-success transition-colors mb-2 font-display">
              Facturation Maritime
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed font-normal">
              Calcul multi-rubriques (Aconage, Roro, Sûretés, Débours) et facturation certifiée DGI/FNE sans doublon.
            </p>
          </div>
          <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-xs font-black text-success">
            <span>{isAllowed('facturation') ? 'Facturation & Reçus' : 'Accès restreint'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Module 4: Calcul des DMDT */}
        <div
          onClick={() => handleNavClick('surestarie')}
          className={`rounded-xl p-6 flex flex-col justify-between transition-all select-none border bg-white ${isAllowed('surestarie')
              ? 'cursor-pointer group hover:-translate-y-1 shadow-xs hover:shadow-md border-border-default hover:border-primary'
              : 'opacity-50 cursor-not-allowed border-border-default'
            }`}
        >
          <div>
            <div className="mb-5">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-xs">
                <Calculator className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-black text-lg text-primaryDark group-hover:text-primary transition-colors mb-2 font-display">
              Calcul des DMDT
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed font-normal">
              Calcul dégressif des surestaries &amp; détentions conteneurs, franchises import/export et émission proforma.
            </p>
          </div>
          <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-xs font-black text-primary">
            <span>{isAllowed('surestarie') ? 'Calculateur DMDT' : 'Accès restreint'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Module 5: Radar & Quai Vridi */}
        <div
          onClick={() => handleNavClick('vessels')}
          className={`rounded-xl p-6 flex flex-col justify-between transition-all select-none border bg-white ${isAllowed('vessels')
              ? 'cursor-pointer group hover:-translate-y-1 shadow-xs hover:shadow-md border-border-default hover:border-primary'
              : 'opacity-50 cursor-not-allowed border-border-default'
            }`}
        >
          <div>
            <div className="mb-5">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-xs">
                <Compass className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-black text-lg text-primaryDark group-hover:text-primary transition-colors mb-2 font-display">
              Radar & Quai Vridi
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed font-normal">
              Positionnement des navires en rade, programmation des postes à quai et calendrier officiel des mouvements.
            </p>
          </div>
          <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-xs font-black text-primary">
            <span>Radar Flotte</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

      </div>
</div>
  );
};


