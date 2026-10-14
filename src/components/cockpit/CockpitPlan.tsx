import React, { useMemo, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { BL, DraftExport, Escale, Invoice, UserRole } from '../../types';

/**
 * Plan du jour — l'accueil du cockpit lu comme un plan de chargement.
 * Colonnes = escales (baies), cellules = dossiers du métier connecté, teinte = état.
 * Toutes les valeurs viennent de la donnée : rien n'est affiché qui ne soit mesuré.
 */

type CellState = 'late' | 'todo' | 'wait' | 'ok';
type DeckKind = 'bl' | 'draft' | 'invoice';

interface BlStats {
  isAllEditees: boolean;
  isAllReglees: boolean;
}

export interface CockpitPermissions {
  vessels: boolean;
  import: boolean;
  export: boolean;
  facturation: boolean;
  balance: boolean;
  surestarie: boolean;
  manageEscales: boolean;
  importGuce: boolean;
}

interface CockpitPlanProps {
  role: UserRole;
  firstName?: string;
  escales: Escale[];
  bls: BL[];
  /** Drafts déjà filtrés pour l'utilisateur (un client ne voit que les siens). */
  drafts: DraftExport[];
  invoices: Invoice[];
  exchangeRateUsd: number;
  perms: CockpitPermissions;
  getBlStats: (bl: BL) => BlStats;
  onEnter: (tab: string, blId?: number) => void;
  onOpenRegistry: () => void;
  onCreateEscale: () => void;
}

interface Item {
  key: string;
  ref: string;
  sub: string;
  state: CellState;
  amount?: number;
  tab: string;
  blId?: number;
}

interface Bay {
  key: string;
  name: string;
  meta: string;
  place: 'quai' | 'rade' | 'aucune';
  items: Item[];
}

const STATE_ORDER: Record<CellState, number> = { late: 0, todo: 1, wait: 2, ok: 3 };
const MAX_BAYS = 8;
const MAX_CELLS = 7;

const STATE_LABELS: Record<DeckKind, Record<CellState, string>> = {
  bl: { late: 'Échéance dépassée', todo: 'À facturer', wait: 'Règlement attendu', ok: 'Facturé · réglé' },
  draft: { late: 'Rejeté', todo: 'À instruire', wait: 'Chez le client', ok: 'Validé' },
  invoice: { late: 'Échéance dépassée', todo: 'Proforma à certifier', wait: 'Certifiée · non réglée', ok: 'Réglée' },
};
// Côté client, les mêmes états se lisent depuis l'autre rive.
const CLIENT_DRAFT_LABELS: Record<CellState, string> = {
  late: 'Rejeté', todo: 'En instruction BOCS', wait: 'Action requise', ok: 'Validé',
};

const KIND_BY_ROLE: Record<UserRole, DeckKind> = {
  ADMIN: 'bl', AGENT_IMPORT: 'bl', AGENT_EXPORT: 'draft', CLIENT_EXPORT: 'draft', COMPTABILITE: 'invoice',
};

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Administration', AGENT_IMPORT: 'Agent import', AGENT_EXPORT: 'Agent export',
  COMPTABILITE: 'Comptabilité', CLIENT_EXPORT: 'Espace client',
};

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const two = (n: number) => String(n).padStart(2, '0');

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isActive = (inv: Invoice) => inv.statutFacture !== 'ANNULEE' && inv.statutFacture !== 'AVOIR';
const isOverdue = (inv: Invoice) =>
  (inv.soldeDuFcfa || 0) > 0 && !!inv.dateEcheance && new Date(inv.dateEcheance) < startOfToday();

function draftState(d: DraftExport): CellState {
  switch (d.statut) {
    case 'VALIDE': case 'BL_GENERE': case 'FACTURE': return 'ok';
    case 'REJETE': return 'late';
    case 'BROUILLON': case 'DEMANDE_MODIF': case 'CORRECTION_AUTORISEE': return 'wait';
    default: return 'todo'; // SOUMIS, EN_REVUE, VERROUILLE, DEMANDE_CORRECTION, ACCORD_AGENT
  }
}

function invoiceState(inv: Invoice): CellState {
  if (inv.statutPaiement === 'PAYE' || (inv.soldeDuFcfa || 0) === 0) return 'ok';
  if (isOverdue(inv)) return 'late';
  if (inv.statutFacture === 'BROUILLON') return 'todo';
  return 'wait';
}

function bayFromEscale(e: Escale): Omit<Bay, 'items'> {
  return {
    key: `e${e.id}`,
    name: e.nomNavire,
    meta: `V. ${e.numeroVoyage}`,
    place: e.statut !== 'EN_COURS' ? 'aucune' : e.quai ? 'quai' : 'rade',
  };
}

export const CockpitPlan: React.FC<CockpitPlanProps> = ({
  role, firstName, escales, bls, drafts, invoices, exchangeRateUsd, perms, getBlStats,
  onEnter, onOpenRegistry, onCreateEscale,
}) => {
  const kind = KIND_BY_ROLE[role] ?? 'bl';
  const labels = role === 'CLIENT_EXPORT' ? CLIENT_DRAFT_LABELS : STATE_LABELS[kind];
  const activeInvoices = useMemo(() => invoices.filter(isActive), [invoices]);

  // ── Les dossiers du métier, chacun avec son état ─────────────────────────────
  const { bays, hiddenBays, counts, total } = useMemo(() => {
    const escaleById = new Map(escales.map(e => [e.id, e]));
    const byBay = new Map<string, Bay>();
    const bayFor = (escaleId: number | undefined, fallback: string): Bay => {
      const esc = escaleId != null ? escaleById.get(escaleId) : undefined;
      const base = esc ? bayFromEscale(esc) : { key: `x${fallback}`, name: fallback, meta: 'Hors escale', place: 'aucune' as const };
      if (!byBay.has(base.key)) byBay.set(base.key, { ...base, items: [] });
      return byBay.get(base.key)!;
    };

    if (kind === 'bl') {
      for (const bl of bls) {
        const blInvoices = activeInvoices.filter(inv => inv.blId === bl.id || inv.numeroBL === bl.numeroBL);
        const stats = getBlStats(bl);
        const state: CellState = blInvoices.some(isOverdue) ? 'late'
          : stats.isAllReglees ? 'ok' : stats.isAllEditees ? 'wait' : 'todo';
        const solde = blInvoices.reduce((acc, inv) => acc + (inv.soldeDuFcfa || 0), 0);
        bayFor(bl.escaleId, 'Sans escale').items.push({
          key: `bl${bl.id}`, ref: bl.numeroBL, sub: bl.consigneeNom || '—', state,
          amount: solde || undefined, tab: 'import', blId: bl.id,
        });
      }
    } else if (kind === 'draft') {
      for (const d of drafts) {
        bayFor(d.escaleId, d.navireNom || 'Sans escale').items.push({
          key: `d${d.id}`, ref: d.numeroDraft, sub: d.clientSociete || d.clientNom || '—',
          state: draftState(d), tab: 'export',
        });
      }
    } else {
      const blById = new Map(bls.map(b => [b.id, b]));
      for (const inv of activeInvoices) {
        const bl = inv.blId != null ? blById.get(inv.blId) : bls.find(b => b.numeroBL === inv.numeroBL);
        bayFor(bl?.escaleId, inv.escaleInfo || 'Hors escale').items.push({
          key: `f${inv.id}`, ref: inv.numeroFacture, sub: inv.clientNom || '—', state: invoiceState(inv),
          amount: inv.soldeDuFcfa || undefined, tab: 'facturation_journal', blId: inv.blId,
        });
      }
    }

    // Les escales en cours restent sur le plan même sans dossier : la baie existe.
    for (const e of escales) if (e.statut === 'EN_COURS') bayFor(e.id, '');

    const all = [...byBay.values()];
    for (const b of all) b.items.sort((a, z) => STATE_ORDER[a.state] - STATE_ORDER[z.state]);
    const urgency = (b: Bay) => b.items.filter(i => i.state === 'late' || i.state === 'todo').length;
    const placeRank = { quai: 0, rade: 1, aucune: 2 };
    all.sort((a, z) => urgency(z) - urgency(a) || placeRank[a.place] - placeRank[z.place] || z.items.length - a.items.length);

    const counts: Record<CellState, number> = { late: 0, todo: 0, wait: 0, ok: 0 };
    for (const b of all) for (const i of b.items) counts[i.state]++;
    const shown = all.slice(0, MAX_BAYS);
    return { bays: shown, hiddenBays: all.length - shown.length, counts, total: counts.late + counts.todo + counts.wait + counts.ok };
  }, [kind, escales, bls, drafts, activeInvoices, getBlStats]);

  const decisions = counts.late + counts.todo;
  const firstUrgent = bays.flatMap(b => b.items).find(i => i.state === 'late' || i.state === 'todo');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedKeyEffective = selectedKey ?? firstUrgent?.key ?? null;

  const located = useMemo(() => {
    for (let b = 0; b < bays.length; b++) {
      const r = bays[b].items.findIndex(i => i.key === selectedKeyEffective);
      if (r >= 0) return { bay: bays[b], bayNo: b + 1, row: r + 1, item: bays[b].items[r] };
    }
    return null;
  }, [bays, selectedKeyEffective]);

  // ── Bande de liquidation : quatre comptes du métier ─────────────────────────
  const enCours = escales.filter(e => e.statut === 'EN_COURS');
  const aQuai = enCours.filter(e => e.quai).length;
  const enRade = enCours.length - aQuai;
  const soldeDu = activeInvoices.reduce((acc, inv) => acc + (inv.soldeDuFcfa || 0), 0);
  const totalTtc = activeInvoices.reduce((acc, inv) => acc + (inv.montantTtcFcfa || 0), 0);
  const blAFacturer = bls.filter(bl => !getBlStats(bl).isAllEditees).length;
  const draftsAInstruire = drafts.filter(d => draftState(d) === 'todo').length;
  const proformas = activeInvoices.filter(inv => inv.statutFacture === 'BROUILLON').length;
  const nonReglees = activeInvoices.filter(inv => (inv.soldeDuFcfa || 0) > 0).length;
  const enRetard = activeInvoices.filter(isOverdue).length;

  type Ledger = { label: string; value: string; unit?: string; note: string; tab?: string; allowed: boolean };
  const ledger: Ledger[] = (() => {
    const escCell: Ledger = { label: 'Escales en cours', value: two(enCours.length), note: `${aQuai} à quai · ${enRade} en rade`, tab: 'vessels', allowed: perms.vessels };
    const soldeCell: Ledger = {
      label: 'Solde dû', value: soldeDu > 0 ? compact.format(soldeDu) : '0', unit: 'FCFA',
      note: soldeDu > 0 ? `≈ ${fcfa.format(soldeDu / (exchangeRateUsd || 600))} USD · ${enRetard} en retard` : 'Aucune créance ouverte',
      tab: 'facturation_balance', allowed: perms.balance,
    };
    switch (role) {
      case 'AGENT_IMPORT': return [
        escCell,
        { label: 'En rade', value: two(enRade), note: 'Navires en attente de poste', tab: 'vessels', allowed: perms.vessels },
        { label: 'BL à facturer', value: two(blAFacturer), note: `sur ${bls.length} BL import`, tab: 'import', allowed: perms.import },
        { label: 'Échéances dépassées', value: two(enRetard), note: 'Factures BL en retard', tab: 'import', allowed: perms.import },
      ];
      case 'AGENT_EXPORT': return [
        { label: 'Drafts à instruire', value: two(draftsAInstruire), note: 'Soumis, en revue, corrections', tab: 'export', allowed: perms.export },
        { label: 'Chez le client', value: two(drafts.filter(d => draftState(d) === 'wait').length), note: 'Brouillons et modifications', tab: 'export', allowed: perms.export },
        { label: 'Validés', value: two(counts.ok), note: 'BL original à émettre ou émis', tab: 'export', allowed: perms.export },
        escCell,
      ];
      case 'COMPTABILITE': return [
        { label: 'Proformas à certifier', value: two(proformas), note: 'Numérotation DGI / FNE', tab: 'facturation_journal', allowed: perms.facturation },
        { label: 'Factures non réglées', value: two(nonReglees), note: `dont ${enRetard} échéance(s) dépassée(s)`, tab: 'facturation_balance', allowed: perms.balance },
        soldeCell,
        {
          label: 'Recouvrement', value: totalTtc > 0 ? (((totalTtc - soldeDu) / totalTtc) * 100).toFixed(1).replace('.', ',') : '—',
          unit: totalTtc > 0 ? '%' : undefined, note: totalTtc > 0 ? `sur ${compact.format(totalTtc)} FCFA facturés` : 'Rien de facturé',
          tab: 'facturation_balance', allowed: perms.balance,
        },
      ];
      case 'CLIENT_EXPORT': return [
        { label: 'En instruction', value: two(counts.todo), note: 'Chez BOCS', tab: 'export', allowed: perms.export },
        { label: 'Action requise', value: two(counts.wait), note: 'Brouillons, modifications demandées', tab: 'export', allowed: perms.export },
        { label: 'Validés', value: two(counts.ok), note: 'Drafts acceptés', tab: 'export', allowed: perms.export },
        { label: 'Rejetés', value: two(counts.late), note: 'À reprendre', tab: 'export', allowed: perms.export },
      ];
      default: return [
        escCell,
        { label: 'BL à facturer', value: two(blAFacturer), note: `sur ${bls.length} BL import`, tab: 'import', allowed: perms.import },
        { label: 'Drafts à instruire', value: two(draftsAInstruire), note: 'Export, côté BOCS', tab: 'export', allowed: perms.export },
        soldeCell,
      ];
    }
  })();

  // ── Action principale : une seule, celle du métier ──────────────────────────
  // L'import des manifestes se fait depuis l'escale : l'accueil propose d'abord de la créer.
  const primary: { label: string; icon: React.ReactNode; run: () => void } | null = (() => {
    switch (role) {
      case 'ADMIN': case 'AGENT_IMPORT':
        return perms.manageEscales
          ? { label: 'Nouvelle escale', icon: <Plus className="w-4 h-4" aria-hidden />, run: onCreateEscale }
          : perms.import ? { label: 'Ouvrir les BL import', icon: <ArrowRight className="w-4 h-4" aria-hidden />, run: () => onEnter('import') } : null;
      case 'AGENT_EXPORT':
        return perms.export ? { label: 'Instruire les drafts', icon: <ArrowRight className="w-4 h-4" aria-hidden />, run: () => onEnter('export') } : null;
      case 'COMPTABILITE':
        return perms.facturation
          ? { label: proformas > 0 ? 'Certifier les proformas' : 'Ouvrir le journal des factures', icon: <ArrowRight className="w-4 h-4" aria-hidden />, run: () => onEnter('facturation_journal') }
          : null;
      case 'CLIENT_EXPORT':
        return perms.export ? { label: 'Soumettre un draft', icon: <Plus className="w-4 h-4" aria-hidden />, run: () => onEnter('export') } : null;
      default: return null;
    }
  })();

  // ── Registre des modules autorisés, avec leur effectif réel ─────────────────
  const register = [
    perms.vessels || perms.import ? { label: 'Import & escales', desc: 'Manifestes GUCE / PDF, BL import', count: blAFacturer, unit: 'à facturer', run: onOpenRegistry } : null,
    perms.export ? { label: 'Drafts & BL export', desc: 'Instruction, validation, BL original', count: draftsAInstruire, unit: 'à instruire', run: () => onEnter('export') } : null,
    perms.facturation ? { label: 'Facturation DGI / FNE', desc: 'Proformas, factures certifiées, avoirs', count: proformas, unit: 'proformas', run: () => onEnter('facturation') } : null,
    perms.balance ? { label: 'Balance & recouvrement', desc: 'Créances, balance âgée, règlements', count: nonReglees, unit: 'non réglées', run: () => onEnter('facturation_balance') } : null,
    perms.surestarie ? { label: 'Surestaries DMDT', desc: 'Calcul dégressif, franchises, proformas', count: null, unit: '', run: () => onEnter('surestarie') } : null,
    perms.vessels ? { label: 'Radar & quais', desc: 'Positions en rade, postes à quai', count: enRade, unit: 'en rade', run: () => onEnter('vessels') } : null,
  ].filter(Boolean) as { label: string; desc: string; count: number | null; unit: string; run: () => void }[];

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const emptyBays = bays.length === 0;
  const emptyHint: Record<DeckKind, string> = {
    bl: 'Créez une escale puis importez son manifeste GUCE ou PDF : chaque BL prendra sa place dans sa baie.',
    draft: role === 'CLIENT_EXPORT'
      ? 'Soumettez un draft : vous suivrez ici son instruction jusqu’au BL original.'
      : 'Aucun draft client à instruire pour le moment.',
    invoice: 'Aucune facture émise : les proformas apparaîtront ici dès leur création.',
  };
  // ── Chaîne documentaire : la même donnée, de l'escale au règlement ─────────
  const certifiees = activeInvoices.filter(inv => inv.statutFacture === 'VALIDEE').length;
  const reglees = activeInvoices.filter(inv => inv.statutPaiement === 'PAYE' || (inv.soldeDuFcfa || 0) === 0).length;
  const encaisse = totalTtc - soldeDu;
  const chain = [
    perms.vessels || perms.import ? { label: 'Escales', value: escales.length, note: `${enCours.length} en cours`, run: onOpenRegistry } : null,
    perms.import || perms.vessels ? { label: 'BL import', value: bls.length, note: `${blAFacturer} à facturer`, run: () => onEnter('import') } : null,
    perms.export ? { label: 'Drafts export', value: drafts.length, note: `${draftsAInstruire} à instruire`, run: () => onEnter('export') } : null,
    perms.facturation ? { label: 'Proformas', value: proformas, note: 'À certifier', run: () => onEnter('facturation_journal') } : null,
    perms.facturation ? { label: 'Factures certifiées', value: certifiees, note: 'Numérotation DGI / FNE', run: () => onEnter('facturation_journal') } : null,
    perms.balance || perms.facturation ? { label: 'Réglées', value: reglees, note: encaisse > 0 ? `${compact.format(encaisse)} FCFA encaissés` : 'Aucun encaissement', run: () => onEnter(perms.balance ? 'facturation_balance' : 'facturation') } : null,
  ].filter(Boolean) as { label: string; value: number; note: string; run: () => void }[];

  let cellIndex = 0;

  return (
    <div className="w-full max-w-[1680px] mx-auto animate-fade-in space-y-6">
      {/* ── Passerelle : le jour, le chiffre qui compte, l'unique action ── */}
      <div>
        <section className="bocs-bridge" aria-labelledby="bocs-plan-title">
          <img src="/port-bg.jpg" alt="" className="bocs-bridge__photo" aria-hidden="true" />
          <div className="relative px-6 sm:px-10 pt-8 sm:pt-10 pb-20 sm:pb-24 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="min-w-0 max-w-2xl">
              <h1 id="bocs-plan-title" className="text-3xl sm:text-4xl font-bold tracking-tight text-[color:var(--text-on-inverse)]">
                Plan du jour{firstName ? <span className="font-medium opacity-70">, {firstName}</span> : null}
              </h1>
              <p className="mt-2 text-sm opacity-80">
                <span className="first-letter:uppercase inline-block">{today}</span>
                <span aria-hidden> · </span>
                {ROLE_LABEL[role]}
              </p>
              <div className="mt-7 flex items-end gap-5">
                <span className="bocs-bridge__count bocs-num" aria-hidden>{two(decisions)}</span>
                <p className="pb-1.5 max-w-xs">
                  <span className="block text-lg font-bold leading-snug">
                    {decisions > 0
                      ? `dossier${decisions > 1 ? 's' : ''} attend${decisions > 1 ? 'ent' : ''} une décision`
                      : 'dossier en attente de décision'}
                  </span>
                  <span className="block text-sm opacity-75 mt-0.5">
                    {total === 0
                      ? 'La cale est vide : rien à traiter pour le moment.'
                      : `${labels.late} : ${counts.late} · ${labels.todo} : ${counts.todo} · ${labels.ok} : ${counts.ok}`}
                  </span>
                </p>
                <span className="sr-only">
                  {decisions} dossier{decisions > 1 ? 's' : ''} en attente de décision.
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:shrink-0">
              {primary && (
                <button type="button" onClick={primary.run} className="bocs-btn bocs-btn-primary bocs-btn-lg w-full sm:w-auto justify-center">
                  {primary.icon} {primary.label}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Bande de liquidation, amarrée au pied de la passerelle ── */}
        <div className="bocs-strip bocs-strip--moored" role="list" aria-label="Comptes du jour">
        {ledger.map((c, i) => (
          <button
            key={c.label}
            type="button"
            role="listitem"
            className="bocs-strip-cell"
            disabled={!c.allowed}
            onClick={() => c.tab && onEnter(c.tab)}
            aria-label={`${c.label} : ${c.value}${c.unit ? ' ' + c.unit : ''}. ${c.note}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="bocs-strip-cell__label">{c.label}</span>
              <span className="bocs-coord whitespace-nowrap hidden sm:inline" aria-hidden>L-{two(i + 1)}</span>
            </span>
            <span className="bocs-strip-cell__value bocs-num">
              {c.value}{c.unit && <span className="bocs-strip-cell__unit">{c.unit}</span>}
            </span>
            <span className="bocs-strip-cell__note">{c.note}</span>
          </button>
        ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        {/* ── Le pont ── */}
        <section className="bocs-deck" aria-labelledby="bocs-deck-title">
          <div className="bocs-deck-head">
            <h2 id="bocs-deck-title" className="bocs-deck-head__title">
              {kind === 'bl' ? 'Plan de cale — BL import' : kind === 'draft' ? 'Plan de cale — drafts export' : 'Plan de cale — factures'}
            </h2>
            <div className="bocs-legend" aria-label="Clé du plan">
              {(['late', 'todo', 'wait', 'ok'] as CellState[]).map(s => (
                <span key={s} className="bocs-legend__key text-inherit opacity-90">
                  <span className={`bocs-legend__swatch bocs-legend__swatch--${s}`} aria-hidden />
                  {labels[s]} <span className="bocs-num">{counts[s]}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="bocs-deck-scroll">
            {emptyBays ? (
              <div className="relative">
                <div className="bocs-deck-grid" aria-hidden>
                  {[1, 2, 3, 4].map(b => (
                    <div key={b} className="bocs-hold">
                      <div className="bocs-hold-head">
                        <div className="bocs-hold-head__name text-[color:var(--ink-muted)]">Baie {two(b)}</div>
                        <div className="bocs-hold-head__meta"><span>libre</span><span className="bocs-coord">B{two(b)}</span></div>
                      </div>
                      {[1, 2, 3, 4].map(r => (
                        <div key={r} className="bocs-cell bocs-cell--empty"><span className="bocs-coord">{two(b)}·{two(r)}</span></div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <div className="max-w-md text-center bg-[color:var(--cell-bg)] border border-[color:var(--cell-rule)] rounded-md px-6 py-5 shadow-[var(--elevation-2)]">
                    <p className="text-base font-bold text-[color:var(--ink)]">La cale est vide</p>
                    <p className="mt-1 text-sm text-[color:var(--ink-muted)]">{emptyHint[kind]}</p>
                    {primary && (
                      <button type="button" onClick={primary.run} className="bocs-btn bocs-btn-primary mt-4">
                        {primary.icon} {primary.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bocs-deck-grid">
                {bays.map((bay, b) => (
                  <div key={bay.key} className="bocs-hold" role="group" aria-label={`Baie ${two(b + 1)} : ${bay.name}`}>
                    <div className="bocs-hold-head">
                      <div className="bocs-hold-head__name" title={bay.name}>{bay.name}</div>
                      <div className="bocs-hold-head__meta">
                        <span>
                          {bay.meta}
                          {bay.place !== 'aucune' && (
                            <> · <span className={bay.place === 'quai' ? 'text-[color:var(--state-ok-ink)] font-semibold' : 'text-[color:var(--state-wait-ink)] font-semibold'}>
                              {bay.place === 'quai' ? 'à quai' : 'en rade'}
                            </span></>
                          )}
                        </span>
                        <span className="bocs-coord">B{two(b + 1)}</span>
                      </div>
                    </div>
                    {bay.items.length === 0 && (
                      <div className="bocs-cell bocs-cell--empty"><span className="bocs-coord">{two(b + 1)}·01</span></div>
                    )}
                    {bay.items.slice(0, MAX_CELLS).map((item, r) => {
                      const coord = `${two(b + 1)}·${two(r + 1)}`;
                      const selected = item.key === selectedKeyEffective;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`bocs-cell bocs-cell--${item.state} bocs-cell--enter`}
                          style={{ ['--i' as string]: cellIndex++ } as React.CSSProperties}
                          aria-pressed={selected}
                          aria-label={`${coord}, ${item.ref}, ${item.sub}, ${labels[item.state]}`}
                          onClick={() => setSelectedKey(item.key)}
                          onDoubleClick={() => onEnter(item.tab, item.blId)}
                        >
                          <span className="bocs-coord" aria-hidden>{coord}</span>
                          <span className="bocs-cell__title font-mono">{item.ref}</span>
                          <span className="bocs-cell__state">{labels[item.state]}</span>
                        </button>
                      );
                    })}
                    {bay.items.length > MAX_CELLS && (
                      <button type="button" className="bocs-cell-more" onClick={() => onEnter(bay.items[0].tab)}>
                        + {bay.items.length - MAX_CELLS} autre{bay.items.length - MAX_CELLS > 1 ? 's' : ''} dans le module
                      </button>
                    )}
                    <div className="bocs-hold-fill" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fiche d'inspection : ce que dit la cellule sélectionnée */}
          {!emptyBays && (
            <div className="bocs-inspector" aria-live="polite">
              {located ? (
                <>
                  <span className={`bocs-inspector__swatch bocs-legend__swatch--${located.item.state} hidden sm:block`} aria-hidden />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="bocs-coord">{two(located.bayNo)}·{two(located.row)}</span>
                      <span className="font-mono text-sm font-semibold text-[color:var(--ink)]">{located.item.ref}</span>
                      <span className="text-xs font-semibold" style={{ color: `var(--state-${located.item.state}-ink)` }}>{labels[located.item.state]}</span>
                    </div>
                    <p className="text-xs text-[color:var(--ink-muted)] truncate mt-0.5">
                      {located.item.sub} · {located.bay.name}{located.bay.meta !== 'Hors escale' ? ` (${located.bay.meta})` : ''}
                      {located.item.amount ? <> · solde <span className="bocs-num font-semibold text-[color:var(--ink)]">{fcfa.format(located.item.amount)} FCFA</span></> : null}
                    </p>
                  </div>
                  <button type="button" className="bocs-btn bocs-btn-secondary bocs-btn-sm" onClick={() => onEnter(located.item.tab, located.item.blId)}>
                    Ouvrir <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </>
              ) : (
                <p className="col-span-full text-xs text-[color:var(--ink-muted)]">
                  Sélectionnez une cellule pour la lire ; double-cliquez pour l’ouvrir dans son module.
                </p>
              )}
            </div>
          )}
          {hiddenBays > 0 && (
            <p className="px-4 py-2 text-xs text-[color:var(--ink-muted)] border-t border-[color:var(--cell-rule)] bg-[color:var(--cell-bg)]">
              {hiddenBays} autre{hiddenBays > 1 ? 's' : ''} baie{hiddenBays > 1 ? 's' : ''} hors du plan, moins urgente{hiddenBays > 1 ? 's' : ''}.{' '}
              <button type="button" className="font-semibold text-[color:var(--text-link)] hover:underline" onClick={onOpenRegistry}>Voir le registre</button>
            </p>
          )}
        </section>

        {/* ── Registre des modules ── */}
        {register.length > 0 && (
          <nav className="bocs-register" aria-label="Modules">
            {register.map((m, i) => (
              <button key={m.label} type="button" className="bocs-register-row" onClick={m.run}>
                <span className="bocs-register-row__no">{two(i + 1)}</span>
                <span className="min-w-0">
                  <span className="bocs-register-row__label">{m.label}</span>
                  <span className="bocs-register-row__desc">{m.desc}</span>
                </span>
                <span className="text-right">
                  <span className="bocs-register-row__count bocs-num block">{m.count === null ? '—' : m.count}</span>
                  {m.count !== null && <span className="text-2xs text-[color:var(--ink-muted)] whitespace-nowrap">{m.unit}</span>}
                </span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* ── Chaîne documentaire ── */}
      {chain.length > 1 && (
        <section className="bocs-chain" aria-labelledby="bocs-chain-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
            <h2 id="bocs-chain-title" className="text-base font-bold text-[color:var(--ink)]">Chaîne documentaire</h2>
            <p className="text-xs text-[color:var(--ink-muted)]">Une donnée saisie une fois, du manifeste à la facture certifiée.</p>
          </div>
          <ol className="bocs-chain__track" style={{ ['--stations' as string]: chain.length } as React.CSSProperties}>
            {chain.map(st => (
              <li key={st.label} className="contents">
                <button type="button" onClick={st.run} className={`bocs-chain__station ${st.value > 0 ? 'bocs-chain__station--done' : ''}`}>
                  <span className="bocs-chain__node" aria-hidden />
                  <span className="bocs-chain__value bocs-num">{st.value}</span>
                  <span className="bocs-chain__label">{st.label}</span>
                  <span className="bocs-chain__note">{st.note}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
};
