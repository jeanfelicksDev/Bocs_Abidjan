import React, { useState } from 'react';
import { Escale, BL, DraftExport, Invoice, UserRole } from '../types';
import { NavTab } from '../components/layout/Sidebar';

interface DashboardProps {
  escales: Escale[];
  bls: BL[];
  drafts: DraftExport[];
  invoices: Invoice[];
  userRole: UserRole;
  exchangeRateUsd: number;
  onNavigateTab: (tab: NavTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  escales,
  bls,
  drafts,
  invoices,
  userRole,
  exchangeRateUsd,
  onNavigateTab
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  // Calculations
  const activeEscalesCount = escales.filter(e => e.statut === 'EN_COURS').length;
  const pendingImportBlsCount = bls.filter(b => b.statutImport !== 'FACTURE').length;
  const pendingDraftsCount = drafts.filter(d => d.statut === 'SOUMIS' || d.statut === 'BROUILLON').length;
  
  const totalRevenueFcfa = invoices.reduce((acc, inv) => acc + inv.montantTtcFcfa, 0);
  const totalSoldeDuFcfa = invoices.reduce((acc, inv) => acc + inv.soldeDuFcfa, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner / Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="material-symbols-outlined text-[#005daa] text-2xl font-black">insights</span>
            <h1 className="text-xl font-black text-slate-900 font-heading">Vue d'ensemble Opérationnelle</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Tableau de bord de pilotage des opérations maritimes BOCS, manifestes et facturation.
          </p>
        </div>

        {/* Quick Actions Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigateTab('vessels')}
            className="px-4 py-2.5 bg-[#0b172a] text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">radar</span>
            <span>Suivi Flotte</span>
          </button>
          <button
            onClick={() => onNavigateTab('import')}
            className="px-4 py-2.5 bg-[#005daa] text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            <span>Import XML GUCE</span>
          </button>
          <button
            onClick={() => onNavigateTab('export')}
            className="px-4 py-2.5 bg-amber-500 text-white font-bold text-xs rounded-xl hover:bg-amber-600 transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            <span>Créer Draft BL</span>
          </button>
          <button
            onClick={() => onNavigateTab('facturation')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 active:scale-95 border border-slate-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">calculate</span>
            <span>Calculer Surestaries</span>
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 font-mono">Escales Actives</h3>
            <div className="p-2.5 bg-blue-50 rounded-xl text-[#005daa]">
              <span className="material-symbols-outlined text-xl">directions_boat</span>
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900 font-mono">{activeEscalesCount}</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
              <span className="material-symbols-outlined text-sm">arrow_upward</span>
              <span>En cours</span>
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 font-mono">BL Import à Traiter</h3>
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
              <span className="material-symbols-outlined text-xl">description</span>
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900 font-mono">{pendingImportBlsCount}</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">Action Requise</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 font-mono">Drafts Export Soumis</h3>
            <div className="p-2.5 bg-sky-50 rounded-xl text-sky-600">
              <span className="material-symbols-outlined text-xl">file_present</span>
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-900 font-mono">{pendingDraftsCount}</span>
            <span className="text-xs font-semibold text-secondary">Attente validation</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 font-mono">Créances & Solde Dû</h3>
            <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-rose-600 font-mono">{totalSoldeDuFcfa.toLocaleString('fr-FR')} FCFA</span>
            <span className="text-[10px] text-slate-400 font-mono">~{(totalSoldeDuFcfa / exchangeRateUsd).toFixed(0)} USD</span>
          </div>
        </div>

      </div>

      {/* Main Content Split (Active Escales & Recent Export Drafts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Active Escales */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">anchor</span>
              <h2 className="font-bold text-primary text-sm uppercase tracking-wider">Escales & Navires aux Quais</h2>
            </div>
            <button
              onClick={() => onNavigateTab('vessels')}
              className="text-xs font-bold text-secondary hover:underline flex items-center gap-1"
            >
              <span>Voir tout</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high/40 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                  <th className="p-3">Navire</th>
                  <th className="p-3">Voyage</th>
                  <th className="p-3">Chargement / Destination</th>
                  <th className="p-3">Date Arrivée</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50 text-xs">
                {escales.map(escale => (
                  <tr key={escale.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="p-3 font-bold text-primary flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-sm">directions_boat</span>
                      <span>{escale.nomNavire}</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-secondary">{escale.numeroVoyage}</td>
                    <td className="p-3 text-on-surface-variant">{escale.portChargement} &rarr; {escale.portDechargement}</td>
                    <td className="p-3 font-mono text-on-surface">{escale.dateArrivee}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onNavigateTab('import')}
                        className="px-2.5 py-1 bg-primary text-on-primary text-[11px] font-bold rounded hover:bg-secondary transition-all"
                      >
                        Gérer BLs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Recent Export Drafts */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-cargo-accent">send</span>
              <h2 className="font-bold text-primary text-sm uppercase tracking-wider">Drafts Export Récents</h2>
            </div>
            <button
              onClick={() => onNavigateTab('export')}
              className="text-xs font-bold text-secondary hover:underline flex items-center gap-1"
            >
              <span>Portail Client</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          <div className="p-3 divide-y divide-outline-variant/40 overflow-y-auto max-h-[380px]">
            {drafts.map(draft => (
              <div key={draft.id} className="py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-primary">{draft.numeroDraft}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    draft.statut === 'VALIDE' ? 'bg-status-validated text-white' :
                    draft.statut === 'SOUMIS' ? 'bg-amber-100 text-amber-800' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    {draft.statut}
                  </span>
                </div>
                <p className="text-xs font-semibold text-on-surface">{draft.clientSociete}</p>
                <p className="text-[11px] text-outline truncate">{draft.marchandisesInfo.description}</p>
                <div className="text-[10px] text-outline font-mono flex items-center justify-between pt-1">
                  <span>{draft.marchandisesInfo.poidsBrutKg.toLocaleString()} kg</span>
                  <span>{draft.conteneursInfo.length} Conteneur(s)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
