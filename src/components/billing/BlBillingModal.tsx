import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Receipt, 
  Ship, 
  Building2, 
  Box, 
  CheckCircle2, 
  Clock, 
  CreditCard 
} from 'lucide-react';
import { BL, Escale, Invoice, RubriqueConfig, InvoiceTypeConfig, User, UserRole, Payment, TimbreBracket, DraftExport } from '../../types';
import { useEscapeClose, overlayClickClose } from '../../hooks/useEscapeClose';
import { BlBillingModule } from '../../pages/BlBillingModule';

export interface BlBillingModalProps {
  bl: BL | null;
  isOpen: boolean;
  onClose: () => void;
  escales: Escale[];
  bls: BL[];
  /** Drafts export : les connaissements validés y matérialisent les BL export réels. */
  drafts?: DraftExport[];
  invoices: Invoice[];
  rubriqueConfigs: RubriqueConfig[];
  invoiceTypeConfigs: InvoiceTypeConfig[];
  userRole?: UserRole;
  /** Utilisateur connecté (overrides individuels prioritaires sur la matrice par rôle). */
  currentUser?: User | { id: number; role: UserRole; estActif?: boolean };
  onGenerateInvoice?: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onValidateInvoice?: (invoiceId: number) => void;
  onDeleteInvoice?: (invoiceId: number) => void;
  onAddPayment?: (payment: Payment) => void;
  onLogAudit?: (action: string, entite: string, details: string) => void;
  onUpdateBl?: (updatedBl: BL) => void;
  /** Tranches de timbre fiscal d'État (assiette HT) — transmises au module de facturation. */
  timbreBrackets?: TimbreBracket[];
}

export const BlBillingModal: React.FC<BlBillingModalProps> = ({
  bl,
  isOpen,
  onClose,
  escales,
  bls,
  drafts = [],
  invoices,
  rubriqueConfigs = [],
  invoiceTypeConfigs = [],
  userRole = 'COMPTABILITE',
  currentUser,
  onGenerateInvoice = () => {},
  onUpdateInvoice,
  onValidateInvoice,
  onDeleteInvoice,
  onAddPayment = () => {},
  onLogAudit = () => {},
  onUpdateBl,
  timbreBrackets
}) => {
  // Audit UX : Échap (sommet de pile) + clic sur l'arrière-plan ferment la modale.
  useEscapeClose(isOpen, onClose);

  if (!isOpen || !bl) return null;

  const escaleInfo = escales.find(e => e.id === bl.escaleId);
  const blInvoices = invoices.filter(inv => inv.blId === bl.id || inv.numeroBL === bl.numeroBL);
  const totalFacture = blInvoices.reduce((sum, inv) => sum + (inv.montantTtcFcfa || 0), 0);
  const totalSolde = blInvoices.reduce((sum, inv) => sum + (inv.soldeDuFcfa || 0), 0);

  const modalContent = (
    <div role="dialog" aria-modal="true" 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
      style={{ zIndex: 99999 }}
      onClick={overlayClickClose(onClose)}
    >
      <div 
        className="bg-surface-canvas dark:bg-night-surface rounded-lg w-full max-w-[1450px] max-h-[95vh] flex flex-col shadow-2xl dark:shadow-black/70 border border-border-default dark:border-night-line overflow-hidden relative"
        style={{ zIndex: 100000 }}
      >
        
        {/* ── EN-TÊTE MODALE ── */}
        <div className="px-6 sm:px-8 py-4.5 border-b border-border-default dark:border-night-line bg-surface-base dark:bg-night-sunken flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-md bg-[#F0F7FF] border border-[#005DAA] dark:border-night-line/25 flex items-center justify-center text-[#005DAA] dark:text-night-ink shadow-1 shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl sm:text-xl font-black text-zinc-950 font-mono tracking-tight flex items-center gap-2">
                  <span>Facturation Maritime &amp; Règlements :</span>
                  <span className="text-[#005DAA] dark:text-night-link">{bl.numeroBL}</span>
                </h3>
                {bl.conteneurs && bl.conteneurs.length > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-lg text-sm font-black bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30">
                    {bl.conteneurs.length} CTR
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-lg text-sm font-black bg-blue-50 dark:bg-night-accent-soft text-blue-800 border border-blue-200 dark:border-night-accent-line">
                    VRAC / RORO
                  </span>
                )}
                {bl.statutImport && (
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-surface-sunken dark:bg-night-sunken text-text-secondary dark:text-night-ink border border-border-default dark:border-night-line">
                    {bl.statutImport}
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted dark:text-night-ink-2 font-medium mt-0.5 flex flex-wrap items-center gap-2">
                {escaleInfo && (
                  <span className="flex items-center gap-1">
                    <Ship className="w-3.5 h-3.5 text-[#005DAA] dark:text-night-link" />
                    <span>Navire : <strong className="text-text-primary dark:text-night-ink">{escaleInfo.nomNavire}</strong> (Voyage {escaleInfo.numeroVoyage})</span>
                  </span>
                )}
                <span className="text-text-muted">•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-text-muted dark:text-night-ink-3" />
                  <span>Client : <strong className="text-text-primary dark:text-night-ink">{bl.consigneeNom || 'Non renseigné'}</strong></span>
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-md bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 text-text-muted dark:text-night-ink-2 hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer border border-border-default dark:border-night-line shadow-1"
              title="Fermer la modale de facturation (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── CORPS DU MODULE DE FACTURATION ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/5 welcome-scrollbar">
          <BlBillingModule
            bls={bls}
            drafts={drafts}
            escales={escales}
            invoices={invoices}
            rubriqueConfigs={rubriqueConfigs}
            invoiceTypeConfigs={invoiceTypeConfigs}
            userRole={userRole}
            currentUser={currentUser}
            selectedBlId={bl.id}
            onGenerateInvoice={onGenerateInvoice}
            onUpdateInvoice={onUpdateInvoice}
            onValidateInvoice={onValidateInvoice}
            onDeleteInvoice={onDeleteInvoice}
            onAddPayment={onAddPayment}
            onLogAudit={onLogAudit}
            onUpdateBl={onUpdateBl}
            timbreBrackets={timbreBrackets}
          />
        </div>

        {/* ── PIED DE PAGE ── */}
        <div className="px-6 sm:px-8 py-3.5 border-t border-border-default dark:border-night-line bg-surface-base dark:bg-night-sunken flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-sm font-medium text-text-secondary dark:text-night-ink">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#005DAA] dark:text-night-link" />
              <span>Factures émises : <strong className="text-text-primary dark:text-night-ink">{blInvoices.length}</strong></span>
            </span>
            <span className="text-text-muted">|</span>
            <span>Total : <strong className="text-text-primary dark:text-night-ink font-mono">{totalFacture.toLocaleString('fr-FR')} FCFA</strong></span>
            {totalSolde > 0 && (
              <>
                <span className="text-text-muted">|</span>
                <span className="text-rose-600 font-bold">Solde dû : <strong className="font-mono">{totalSolde.toLocaleString('fr-FR')} FCFA</strong></span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:text-night-ink font-black text-sm transition-all cursor-pointer shadow-sm dark:shadow-black/30 active:scale-95"
          >
            Fermer la fenêtre
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
