import React, { useState, useMemo } from 'react';
import { BL, Escale, Invoice, InvoiceTypeConfig, Payment, UserRole } from '../types';
import { DEFAULT_TARIFS, DEFAULT_FRANCHISES } from '../utils/dmdtCalculator';
import { resolveUniqueInvoiceNumber } from '../utils/invoiceMatching';
import { toastSuccess, toastError } from '../components/common/Toast';
import {
  Search, Calculator, FileText, CheckCircle2, Clock, AlertTriangle,
  ArrowRight, Ship, Package, Calendar, DollarSign, Filter, RotateCcw
} from 'lucide-react';

/* ─── Types locaux ─── */
interface ContainerRow {
  blId: number;
  numeroBL: string;
  escaleId: number;
  nomNavire: string;
  typeOperation: 'IMPORT' | 'EXPORT';
  consigneeNom: string;
  containerId: number;
  numeroConteneur: string;
  typeConteneur: string;
  dateEntree: string;
  dateSortie: string;
  franchise: number;
  stayDays: number;
  billableDays: number;
  montant: number;
  breakdown: { label: string; days: number; rate: number; amount: number; dateString: string }[];
  existingInvoice?: Invoice;
}

interface SurestarieModuleProps {
  bls: BL[];
  escales: Escale[];
  invoices: Invoice[];
  invoiceTypeConfigs: InvoiceTypeConfig[];
  userRole: UserRole;
  onGenerateInvoice: (invoice: Invoice) => void;
  onAddPayment: (payment: Payment) => void;
  onLogAudit: (action: string, entite: string, details: string) => void;
}

/* ─── Helpers ─── */
const TODAY = new Date().toISOString().split('T')[0];

function getTarifs(): any[] {
  try {
    const saved = localStorage.getItem('bocs_tarifs');
    return saved ? JSON.parse(saved) : DEFAULT_TARIFS;
  } catch { return DEFAULT_TARIFS as any; }
}

function calcDegressif(
  typeConteneur: string,
  stayDays: number,
  franchise: number,
  typeOperation: 'IMPORT' | 'EXPORT',
  regime: 'SURESTARIE' | 'DETENTION',
  dateAccostage?: string
): { totalAmount: number; breakdown: { label: string; days: number; rate: number; amount: number; dateString: string }[] } {
  const tarifs = getTarifs();
  const matching = tarifs.filter((t: any) =>
    t.typeConteneur === typeConteneur &&
    (t.regime || 'SURESTARIE') === regime &&
    (t.typeOperation || 'IMPORT') === typeOperation
  );

  const breakdownMap = new Map<string, { rate: number; days: number; amount: number; label: string; firstDay: number; lastDay: number }>();
  let totalAmount = 0;

  for (let day = franchise + 1; day <= stayDays; day++) {
    const tier = matching.find((t: any) => day >= t.jourDebut && day <= t.jourFin);
    let rate = 0;
    let label = '';
    if (tier) {
      rate = tier.tarifJournalierFcfa;
      label = `Tranche J${tier.jourDebut}–J${tier.jourFin}`;
    } else if (matching.length > 0) {
      const sorted = [...matching].sort((a: any, b: any) => b.jourFin - a.jourFin);
      rate = sorted[0].tarifJournalierFcfa;
      label = `Tranche J${sorted[0].jourFin + 1}+`;
    } else {
      rate = typeConteneur.includes('20') ? 15000 : 25000;
      label = 'Tarif standard';
    }
    if (rate > 0) {
      totalAmount += rate;
      if (breakdownMap.has(label)) {
        const e = breakdownMap.get(label)!;
        e.days += 1; e.amount += rate; e.lastDay = day;
      } else {
        breakdownMap.set(label, { rate, days: 1, amount: rate, label, firstDay: day, lastDay: day });
      }
    }
  }

  const breakdown = Array.from(breakdownMap.values()).map(b => {
    let dateString = '';
    if (dateAccostage) {
      const base = new Date(dateAccostage);
      const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const s = new Date(base); s.setDate(base.getDate() + b.firstDay);
      const ev = new Date(base); ev.setDate(base.getDate() + b.lastDay);
      dateString = `${fmt(s)} → ${fmt(ev)}`;
    }
    return { ...b, dateString };
  });

  return { totalAmount, breakdown };
}

function stayDaysFrom(entree: string, sortie: string): number {
  const d1 = new Date(entree), d2 = new Date(sortie);
  return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1);
}

/* ════════════════════════════════════════════════════════════════════════ */
export const SurestarieModule: React.FC<SurestarieModuleProps> = ({
  bls,
  escales,
  invoices,
  invoiceTypeConfigs,
  userRole,
  onGenerateInvoice,
  onAddPayment,
  onLogAudit,
}) => {
  const [searchQ, setSearchQ] = useState('');
  const [regimeFilter, setRegimeFilter] = useState<'SURESTARIE' | 'DETENTION'>('SURESTARIE');
  const [opFilter, setOpFilter] = useState<'ALL' | 'IMPORT' | 'EXPORT'>('ALL');
  const [onlyBillable, setOnlyBillable] = useState(false);

  const [selectedRow, setSelectedRow] = useState<ContainerRow | null>(null);
  const [editEntry, setEditEntry] = useState('');
  const [editExit, setEditExit] = useState('');
  const [editFranchise, setEditFranchise] = useState(7);

  const [validatedCalcs, setValidatedCalcs] = useState<Record<string, { total: number; details: any[] }>>(() => {
    try { return JSON.parse(localStorage.getItem('bocs_validated_calculations') || '{}'); } catch { return {}; }
  });

  const saveCalcs = (c: typeof validatedCalcs) => {
    setValidatedCalcs(c);
    try { localStorage.setItem('bocs_validated_calculations', JSON.stringify(c)); } catch {}
  };

  const getSureTypeConfig = () => {
    const found = invoiceTypeConfigs.find(t =>
      regimeFilter === 'DETENTION'
        ? t.name.toLowerCase().includes('detention') || t.name.toLowerCase().includes('détention')
        : t.name.toLowerCase().includes('surestarie')
    );
    if (found) return found;
    return regimeFilter === 'DETENTION'
      ? { id: '6', name: 'Détention', description: 'Frais d\'immobilisation conteneur (Détention)' }
      : { id: '5', name: 'Surestarie', description: 'Frais de stationnement portuaire (Surestaries)' };
  };

  /* ── Build rows ── */
  const allRows = useMemo((): ContainerRow[] => {
    const rows: ContainerRow[] = [];
    const sureTypeConfig = getSureTypeConfig();

    bls.forEach(bl => {
      if (!bl.conteneurs?.length) return;
      const escale = escales.find(e => e.id === bl.escaleId);
      const nomNavire = escale?.nomNavire || '—';
      const typeOp = (bl.typeOperation || 'IMPORT') as 'IMPORT' | 'EXPORT';

      const calcKey = `${bl.id}-${sureTypeConfig.id}`;
      const savedCalc = validatedCalcs[calcKey];

      bl.conteneurs.forEach(c => {
        // Calcul validé manuel pour ce conteneur s'il existe
        const validDetail = savedCalc?.details?.find(
          (d: any) => d.containerId === c.id || d.numeroConteneur === c.numeroConteneur
        );

        // Dates par défaut
        let defaultEntree = c.dateEntreeParc || escale?.dateArrivee || TODAY;
        let defaultSortie = c.dateSortieParc || TODAY;
        if (regimeFilter === 'DETENTION') {
          defaultEntree = c.dateSortieParc || c.dateEntreeParc || escale?.dateArrivee || TODAY;
          defaultSortie = (c as any).dateRetourVide || TODAY;
        }

        const entree = validDetail?.dateAccostage || defaultEntree;
        const sortie = validDetail?.dateLivraison || defaultSortie;
        const franchise = validDetail?.franchise !== undefined ? validDetail.franchise : ((DEFAULT_FRANCHISES as any)[c.typeConteneur] || 7);
        const stayDays = validDetail?.stayDays !== undefined ? validDetail.stayDays : stayDaysFrom(entree, sortie);
        const billableDays = validDetail?.billableDays !== undefined ? validDetail.billableDays : Math.max(0, stayDays - franchise);

        let montant = 0;
        let breakdown: any[] = [];
        if (validDetail && validDetail.montant !== undefined) {
          montant = validDetail.montant;
          breakdown = validDetail.breakdown || [];
        } else {
          const res = calcDegressif(c.typeConteneur, stayDays, franchise, typeOp, regimeFilter, entree);
          montant = res.totalAmount;
          breakdown = res.breakdown;
        }

        const isDet = regimeFilter === 'DETENTION';
        // Rapprochement de la proforma existante : match PRÉCIS d'abord (même type de
        // facture — id de config ou libellé exact), puis fallback régime (factures legacy).
        // Sans cette hiérarchie, une proforma « Détention Import » fait apparaître le badge
        // « Proforma OK » sur les lignes « Détention Export » du même BL (deux types de
        // facture distincts partageant le régime DETENTION).
        const existingInvoice =
          invoices.find(inv =>
            (inv.blId === bl.id || inv.numeroBL === bl.numeroBL) &&
            inv.statutFacture !== 'ANNULEE' &&
            (inv.invoiceTypeId === sureTypeConfig.id || inv.typeFacture === sureTypeConfig.name)
          ) ||
          invoices.find(inv =>
            (inv.blId === bl.id || inv.numeroBL === bl.numeroBL) &&
            inv.statutFacture !== 'ANNULEE' &&
            (isDet
              ? inv.typeFacture?.toLowerCase().includes('detention') || inv.typeFacture?.toLowerCase().includes('détention') || inv.numeroFacture?.includes('DET')
              : inv.typeFacture?.toLowerCase().includes('surestarie') || inv.numeroFacture?.includes('SUR'))
          );

        rows.push({
          blId: bl.id,
          numeroBL: bl.numeroBL,
          escaleId: bl.escaleId,
          nomNavire,
          typeOperation: typeOp,
          consigneeNom: bl.consigneeNom,
          containerId: c.id,
          numeroConteneur: c.numeroConteneur,
          typeConteneur: c.typeConteneur,
          dateEntree: entree,
          dateSortie: sortie,
          franchise,
          stayDays,
          billableDays,
          montant,
          breakdown,
          existingInvoice,
        });
      });
    });
    return rows;
  }, [bls, escales, invoices, regimeFilter, validatedCalcs, invoiceTypeConfigs]);

  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    return allRows.filter(r => {
      if (opFilter !== 'ALL' && r.typeOperation !== opFilter) return false;
      if (onlyBillable && r.billableDays === 0) return false;
      if (!q) return true;
      return r.numeroBL.toLowerCase().includes(q) ||
        r.numeroConteneur.toLowerCase().includes(q) ||
        r.consigneeNom.toLowerCase().includes(q) ||
        r.nomNavire.toLowerCase().includes(q);
    });
  }, [allRows, searchQ, opFilter, onlyBillable]);

  const totalMontant = filtered.reduce((s, r) => s + r.montant, 0);
  const billableCount = filtered.filter(r => r.billableDays > 0).length;
  const franchiseCount = filtered.filter(r => r.billableDays === 0).length;

  const openCalc = (row: ContainerRow) => {
    setSelectedRow(row);
    setEditEntry(row.dateEntree);
    setEditExit(row.dateSortie);
    setEditFranchise(row.franchise);
  };

  const liveStay = selectedRow ? stayDaysFrom(editEntry, editExit) : 0;
  const liveBillable = Math.max(0, liveStay - editFranchise);
  const liveCalc = selectedRow
    ? calcDegressif(selectedRow.typeConteneur, liveStay, editFranchise, selectedRow.typeOperation, regimeFilter, editEntry)
    : { totalAmount: 0, breakdown: [] };

  const validateCalc = () => {
    if (!selectedRow) return;
    const sureTypeConfig = getSureTypeConfig();
    const calcKey = `${selectedRow.blId}-${sureTypeConfig.id}`;
    const existing = validatedCalcs[calcKey] || { total: 0, details: [] };
    const otherDetails = existing.details.filter(
      (d: any) => d.containerId !== selectedRow.containerId && d.numeroConteneur !== selectedRow.numeroConteneur
    );
    const newDetail = {
      containerId: selectedRow.containerId,
      numeroConteneur: selectedRow.numeroConteneur,
      typeConteneur: selectedRow.typeConteneur,
      dateAccostage: editEntry,
      dateLivraison: editExit,
      stayDays: liveStay,
      franchise: editFranchise,
      billableDays: liveBillable,
      montant: liveCalc.totalAmount,
      breakdown: liveCalc.breakdown,
    };
    const allDetails = [...otherDetails, newDetail];
    const grandTotal = allDetails.reduce((s: number, d: any) => s + d.montant, 0);
    const updated = { ...validatedCalcs, [calcKey]: { total: grandTotal, details: allDetails } };
    saveCalcs(updated);
    toastSuccess(`Calcul validé : ${liveCalc.totalAmount.toLocaleString('fr-FR')} FCFA pour ${selectedRow.numeroConteneur}`);
    setSelectedRow(null);
    return { calcKey, calc: { total: grandTotal, details: allDetails } };
  };

  const handleEmettreProforma = (row: ContainerRow, directCalc?: any) => {
    const sureTypeConfig = getSureTypeConfig();
    const calcKey = `${row.blId}-${sureTypeConfig.id}`;
    const calc = directCalc || validatedCalcs[calcKey];
    if (!calc || !calc.details || calc.details.length === 0) {
      toastError('Validez d\'abord le calcul pour ce conteneur.');
      return;
    }
    const bl = bls.find(b => b.id === row.blId);
    if (!bl) return;
    const escale = escales.find(e => e.id === bl.escaleId);
    const voyageNum = escale?.numeroVoyage || 'SANS_VOYAGE';
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const isDet = regimeFilter === 'DETENTION';
    const prefix = isDet ? 'PROF-DET' : 'PROF-SUR';
    // Code discriminant du type de facture : « Détention Import » et « Détention Export »
    // partagent le même régime (DETENTION) — sans ce segment, deux proformas distinctes
    // reçoivent le même numéro (PROF-DET-<BL>-<AAAAMM>), ce qui viole l'unicité fiscale
    // exigée par la certification DGI / FNE.
    const typeName = (sureTypeConfig.name || '').toLowerCase();
    const typeCode = typeName.includes('import') ? 'IMP' : typeName.includes('export') ? 'EXP' : '';
    const cleanBL = row.numeroBL.replace(/[^a-zA-Z0-9-]/g, '-');
    const periode = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const baseNumero = [prefix, typeCode, cleanBL, periode].filter(Boolean).join('-');

    // Garde-fou anti-collision : un numéro de facture n'est jamais réutilisé (même après
    // annulation). Une ré-émission du même couple (type, BL) sur la même période — après
    // annulation, ou pour un autre conteneur facturé séparément — reçoit un suffixe -02, -03…
    // `resolveUniqueInvoiceNumber` consulte en outre le registre de session, ce qui couvre
    // les émissions successives d'un même cycle de rendu (état React encore périmé).
    const numeroProforma = resolveUniqueInvoiceNumber(baseNumero, invoices);

    const lines = calc.details.flatMap((det: any, idx: number) =>
      det.breakdown?.length > 0
        ? det.breakdown.map((b: any, bIdx: number) => ({
            id: idx * 100 + bIdx + 1,
            designation: `${sureTypeConfig.name} — ${det.numeroConteneur} (${det.typeConteneur}) : ${b.label} (${b.days}j)${b.dateString ? ` [${b.dateString}]` : ''}`,
            typeFrais: (isDet ? 'DMDT_DETENTION' : 'DMDT_SURESTARIE') as any,
            quantite: b.days,
            prixUnitaireFcfa: b.rate,
            montantHtFcfa: b.amount,
            tauxTva: 18,
          }))
        : [{
            id: idx + 1,
            designation: `${sureTypeConfig.name} — ${det.numeroConteneur} (${det.typeConteneur}) : ${det.billableDays}j facturables`,
            typeFrais: (isDet ? 'DMDT_DETENTION' : 'DMDT_SURESTARIE') as any,
            quantite: det.billableDays || 1,
            prixUnitaireFcfa: Math.round(det.montant / (det.billableDays || 1)),
            montantHtFcfa: det.montant,
            tauxTva: 18,
          }]
    );
    const totalHt = lines.reduce((s: number, l: any) => s + l.montantHtFcfa, 0);
    const tva = Math.round(totalHt * 0.18);
    const ttc = totalHt + tva;

    const newInvoice: Invoice = {
      id: Date.now(),
      blId: bl.id,
      numeroBL: bl.numeroBL,
      invoiceTypeId: sureTypeConfig.id,
      typeFacture: sureTypeConfig.name as any,
      numeroFacture: numeroProforma,
      dateFacture: dateStr,
      dateEcheance: new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0],
      clientNom: bl.consigneeNom || 'CLIENT IMPORTATEUR',
      escaleInfo: `${escale?.nomNavire || '—'} V.${voyageNum}`,
      montantHtFcfa: totalHt,
      tvaFcfa: tva,
      montantTtcFcfa: ttc,
      soldeDuFcfa: ttc,
      statutPaiement: 'NON_PAYE',
      statutFacture: 'BROUILLON',
      lignes: lines as any,
      devise: 'FCFA',
      tauxChangeUsd: 600,
      fneReference: `FNE-BOCS-${numeroProforma}-${ttc}`
    };

    onGenerateInvoice(newInvoice);
    onLogAudit('GENERATION_PROFORMA', 'FACTURE', `Proforma ${sureTypeConfig.name} (${numeroProforma}) émise pour BL ${bl.numeroBL}`);
    toastSuccess(`Proforma ${sureTypeConfig.name} émise pour ${bl.numeroBL} — ${ttc.toLocaleString('fr-FR')} FCFA TTC`);
  };

  /* ══════════════ RENDER ══════════════ */
  return (
    <div className="flex flex-col h-full bg-zinc-50">

      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#ECFDF5] border border-[#00875A]/30 flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-2xl text-[#00875A]">timer</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-[#005DAA] font-display tracking-tight">Surestaries &amp; Détentions</h1>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">Calcul dégressif DMDT · Émission des factures · Suivi par conteneur</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-50 border border-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <div>
              <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Montant Total</div>
              <div className="text-sm font-black text-rose-700 font-mono">{totalMontant.toLocaleString('fr-FR')} FCFA</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-50 border border-blue-200">
            <Package className="w-4 h-4 text-[#005DAA]" />
            <div>
              <div className="text-[10px] font-bold text-[#005DAA] uppercase tracking-wider">En Surestarie</div>
              <div className="text-sm font-black text-[#005DAA] font-mono">{billableCount} cont.</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-[#00875A]" />
            <div>
              <div className="text-[10px] font-bold text-[#00875A] uppercase tracking-wider">En Franchise</div>
              <div className="text-sm font-black text-[#00875A] font-mono">{franchiseCount} cont.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-zinc-100 px-6 py-3 flex flex-wrap items-center gap-3 shrink-0">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="BL, conteneur, consignataire…"
            className="w-full h-9 pl-9 pr-3 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#005DAA] focus:bg-white transition-all" />
        </div>
        <div className="flex rounded-xl border border-zinc-200 overflow-hidden">
          {(['SURESTARIE', 'DETENTION'] as const).map(r => (
            <button key={r} type="button" onClick={() => setRegimeFilter(r)}
              className={`px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${regimeFilter === r ? 'bg-[#005DAA] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}>
              {r === 'SURESTARIE' ? '⏳ Surestaries' : '🔒 Détentions'}
            </button>
          ))}
        </div>
        <div className="flex rounded-xl border border-zinc-200 overflow-hidden">
          {(['ALL', 'IMPORT', 'EXPORT'] as const).map(op => (
            <button key={op} type="button" onClick={() => setOpFilter(op)}
              className={`px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${opFilter === op ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}>
              {op === 'ALL' ? 'Tous' : op}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-[#005DAA]" checked={onlyBillable} onChange={e => setOnlyBillable(e.target.checked)} />
          <span className="text-xs font-bold text-zinc-700">Uniquement facturables</span>
        </label>
        {searchQ && (
          <button type="button" onClick={() => setSearchQ('')} className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 cursor-pointer">
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 overflow-auto p-6 bocs-scrollbar">
        {selectedRow ? (
          /* ── CALCULATEUR ── */
          <div className="max-w-3xl mx-auto space-y-5">
            <button type="button" onClick={() => setSelectedRow(null)}
              className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer">
              <ArrowRight className="w-4 h-4 rotate-180" /> Retour au tableau
            </button>

            <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs p-6">
              <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F0F7FF] border border-[#005DAA]/30 flex items-center justify-center">
                    <Calculator className="w-6 h-6 text-[#005DAA]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#005DAA]">Calculateur {regimeFilter === 'DETENTION' ? 'Détention' : 'Surestarie'}</h2>
                    <p className="text-xs text-zinc-500 font-mono font-bold mt-0.5">
                      {selectedRow.numeroConteneur} · {selectedRow.typeConteneur} · BL {selectedRow.numeroBL}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${selectedRow.typeOperation === 'IMPORT' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                  {selectedRow.typeOperation}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1.5">
                    {regimeFilter === 'DETENTION' ? 'Date Enlèvement (Sortie Parc)' : 'Date Entrée Parc'}
                  </label>
                  <input type="date" value={editEntry} onChange={e => setEditEntry(e.target.value)}
                    className="w-full h-10 px-3 border border-zinc-300 rounded-xl text-sm bg-zinc-50 focus:outline-none focus:border-[#005DAA] focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1.5">
                    {regimeFilter === 'DETENTION' ? 'Date Restitution Vide' : 'Date Sortie / Livraison'}
                  </label>
                  <input type="date" value={editExit} onChange={e => setEditExit(e.target.value)}
                    className="w-full h-10 px-3 border border-zinc-300 rounded-xl text-sm bg-zinc-50 focus:outline-none focus:border-[#005DAA] focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1.5">Franchise (jours gratuits)</label>
                  <input type="number" min={0} max={60} value={editFranchise} onChange={e => setEditFranchise(Number(e.target.value))}
                    className="w-full h-10 px-3 border border-zinc-300 rounded-xl text-sm font-mono font-bold bg-zinc-50 focus:outline-none focus:border-[#005DAA] focus:bg-white transition-all" />
                </div>
              </div>

              <div className="mt-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-wrap gap-6 text-sm">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-0.5">Séjour total</div>
                  <div className="text-2xl font-black text-zinc-950 font-mono">{liveStay}<span className="text-sm text-zinc-500 font-bold ml-1">j</span></div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-0.5">Franchise</div>
                  <div className="text-2xl font-black text-[#00875A] font-mono">{editFranchise}<span className="text-sm font-bold ml-1">j</span></div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-0.5">Jours facturables</div>
                  <div className={`text-2xl font-black font-mono ${liveBillable > 0 ? 'text-rose-600' : 'text-[#00875A]'}`}>{liveBillable}<span className="text-sm font-bold ml-1">j</span></div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-0.5">Total {regimeFilter}</div>
                  <div className={`text-3xl font-black font-mono ${liveCalc.totalAmount > 0 ? 'text-rose-600' : 'text-[#00875A]'}`}>
                    {liveCalc.totalAmount.toLocaleString('fr-FR')}<span className="text-base ml-1">FCFA</span>
                  </div>
                </div>
              </div>

              {liveCalc.breakdown.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Détail par tranche dégressive</div>
                  {liveCalc.breakdown.map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-blue-50/60 border border-blue-200/60 text-sm">
                      <div>
                        <span className="font-black text-[#002B49]">{b.label}</span>
                        {b.dateString && <span className="text-[10px] text-zinc-400 ml-2 font-mono">{b.dateString}</span>}
                        <span className="text-xs text-zinc-500 ml-2">· {b.days}j × {b.rate.toLocaleString('fr-FR')} FCFA/j</span>
                      </div>
                      <span className="font-black text-[#005DAA] font-mono">{b.amount.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  ))}
                </div>
              )}

              {liveBillable === 0 && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-[#00875A] font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00875A]" />
                  Séjour de {liveStay}j ≤ franchise de {editFranchise}j. Aucun frais dû.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setSelectedRow(null)}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-all">
                Annuler
              </button>
              <button type="button" onClick={validateCalc}
                className="px-6 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white rounded-xl text-sm font-black flex items-center gap-2 cursor-pointer shadow-sm transition-all active:scale-95">
                <Calculator className="w-4 h-4" /> Valider le calcul
              </button>
              {liveBillable > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const row = selectedRow;
                    const res = validateCalc();
                    if (res && row) {
                      handleEmettreProforma(row, res.calc);
                    }
                  }}
                  className="px-6 py-2.5 bg-[#00875A] hover:bg-[#006E48] text-white rounded-xl text-sm font-black flex items-center gap-2 cursor-pointer shadow-sm transition-all active:scale-95"
                >
                  <FileText className="w-4 h-4" /> Valider &amp; Émettre Proforma
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ── TABLEAU ── */
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-200 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl text-[#005DAA]">timer_off</span>
                </div>
                <h3 className="text-base font-black text-zinc-700">Aucun conteneur trouvé</h3>
                <p className="text-xs text-zinc-400 mt-1">Modifiez vos filtres ou importez des BL avec conteneurs.</p>
              </div>
            ) : (
              <>
                <div className="text-xs text-zinc-500 font-bold px-1">
                  {filtered.length} conteneur(s) · {regimeFilter === 'DETENTION' ? 'DÉTENTION' : 'SURESTARIE'} · {opFilter === 'ALL' ? 'Import &amp; Export' : opFilter}
                </div>
                {/* Table avec Ascenseur Vertical & Horizontal (Scrollbar) */}
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-310px)] min-h-[460px] bocs-scrollbar relative">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 z-10 bg-zinc-100/95 backdrop-blur-md shadow-2xs">
                        <tr className="border-b border-zinc-200 bg-zinc-50/90 select-none">
                          {['Conteneur', 'BL / Navire', regimeFilter === 'DETENTION' ? 'Enlèvement' : 'Entrée Parc', regimeFilter === 'DETENTION' ? 'Retour Vide' : 'Sortie', 'Séjour', 'Factur.', 'Montant estimé', 'Actions'].map(h => (
                            <th key={h} className="text-left px-4 py-3.5 font-black text-zinc-700 uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {filtered.map((row, idx) => {
                          const sureTypeConfig = getSureTypeConfig();
                          const calcKey = `${row.blId}-${sureTypeConfig.id}`;
                          const hasValidatedCalc = !!validatedCalcs[calcKey];
                          return (
                            <tr key={`${row.blId}-${row.containerId}-${idx}`}
                              className={`hover:bg-zinc-50/80 transition-colors ${row.billableDays > 0 ? 'bg-rose-50/25' : ''}`}>
                              <td className="px-4 py-3">
                                <div className="font-mono font-black text-zinc-950">{row.numeroConteneur}</div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[9px] ${row.typeOperation === 'IMPORT' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {row.typeOperation}
                                  </span>
                                  <span className="text-[10px] text-zinc-400">{row.typeConteneur}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-mono font-black text-zinc-900">{row.numeroBL}</div>
                                <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-0.5">
                                  <Ship className="w-3 h-3" />{row.nomNavire}
                                </div>
                                <div className="text-[10px] text-zinc-500 truncate max-w-[140px]">{row.consigneeNom}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 text-zinc-700 font-mono font-bold text-[11px]">
                                  <Calendar className="w-3 h-3 text-zinc-400" />
                                  {row.dateEntree ? new Date(row.dateEntree).toLocaleDateString('fr-FR') : '—'}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 text-zinc-700 font-mono font-bold text-[11px]">
                                  <Calendar className="w-3 h-3 text-zinc-400" />
                                  {row.dateSortie ? new Date(row.dateSortie).toLocaleDateString('fr-FR') : '—'}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-black text-zinc-950 font-mono">{row.stayDays}</span>
                                <span className="text-zinc-400 text-[10px] ml-0.5">j</span>
                                <div className="text-[10px] text-zinc-400">franchise {row.franchise}j</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`font-black font-mono text-sm ${row.billableDays > 0 ? 'text-rose-600' : 'text-[#00875A]'}`}>{row.billableDays}</span>
                                <span className="text-[10px] ml-0.5 text-zinc-400">j</span>
                              </td>
                              <td className="px-4 py-3">
                                {row.montant > 0 ? (
                                  <div>
                                    <div className="font-black text-rose-600 font-mono">{row.montant.toLocaleString('fr-FR')}</div>
                                    <div className="text-[10px] text-zinc-400">FCFA</div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-[#00875A] font-bold">Aucun frais</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <button type="button" onClick={() => openCalc(row)}
                                    className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#005DAA] cursor-pointer transition-all shadow-2xs"
                                    title={`Calculateur ${regimeFilter === 'DETENTION' ? 'Détention' : 'Surestarie'}`}>
                                    <Calculator className="w-3.5 h-3.5" />
                                  </button>
                                  {(hasValidatedCalc || row.billableDays > 0) && (
                                    <button type="button" onClick={() => handleEmettreProforma(row)}
                                      disabled={!hasValidatedCalc}
                                      title={hasValidatedCalc ? `Émettre Proforma ${regimeFilter === 'DETENTION' ? 'Détention' : 'Surestarie'}` : 'Validez le calcul d\'abord dans le calculateur'}
                                      className={`p-2 rounded-xl border transition-all ${hasValidatedCalc ? 'bg-[#005DAA]/10 hover:bg-[#005DAA]/20 border-[#005DAA]/30 text-[#005DAA] cursor-pointer shadow-2xs' : 'bg-zinc-50 border-zinc-200 text-zinc-300 cursor-not-allowed'}`}>
                                      <FileText className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {row.existingInvoice ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs" title={`Facture émise : ${row.existingInvoice.numeroFacture}`}>
                                      Proforma OK
                                    </span>
                                  ) : hasValidatedCalc ? (
                                    <span className="w-2 h-2 rounded-full bg-[#00875A] flex-shrink-0" title="Calcul validé (prêt pour proforma)" />
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10 bg-zinc-100/95 backdrop-blur-md border-t-2 border-zinc-200 shadow-xs">
                        <tr className="bg-zinc-100/95">
                          <td colSpan={6} className="px-4 py-3 text-xs font-black text-zinc-700 uppercase tracking-wider">
                            Total — {filtered.length} conteneur(s)
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-black text-rose-600 font-mono text-sm">{totalMontant.toLocaleString('fr-FR')}</div>
                            <div className="text-[10px] text-zinc-500 font-bold">FCFA</div>
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
