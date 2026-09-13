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
import { BL, Escale, Invoice, RubriqueConfig, InvoiceTypeConfig, UserRole, Payment } from '../../types';
import { BlBillingModule } from '../../pages/BlBillingModule';

export interface BlBillingModalProps {
  bl: BL | null;
  isOpen: boolean;
  onClose: () => void;
  escales: Escale[];
  bls: BL[];
  invoices: Invoice[];
  rubriqueConfigs: RubriqueConfig[];
  invoiceTypeConfigs: InvoiceTypeConfig[];
  userRole?: UserRole;
  onGenerateInvoice?: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onValidateInvoice?: (invoiceId: number) => void;
  onDeleteInvoice?: (invoiceId: number) => void;
  onAddPayment?: (payment: Payment) => void;
  onLogAudit?: (action: string, entite: string, details: string) => void;
  onUpdateBl?: (updatedBl: BL) => void;
}

export const BlBillingModal: React.FC<BlBillingModalProps> = ({
  bl,
  isOpen,
  onClose,
  escales,
  bls,
  invoices,
  rubriqueConfigs = [],
  invoiceTypeConfigs = [],
  userRole = 'COMPTABILITE',
  onGenerateInvoice = () => {},
  onUpdateInvoice,
  onValidateInvoice,
  onDeleteInvoice,
  onAddPayment = () => {},
  onLogAudit = () => {},
  onUpdateBl
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !bl) return null;

  const escaleInfo = escales.find(e => e.id === bl.escaleId);
  const blInvoices = invoices.filter(inv => inv.blId === bl.id || inv.numeroBL === bl.numeroBL);
  const totalFacture = blInvoices.reduce((sum, inv) => sum + (inv.montantTtcFcfa || 0), 0);
  const totalSolde = blInvoices.reduce((sum, inv) => sum + (inv.soldeDuFcfa || 0), 0);

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
      style={{ zIndex: 99999 }}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-[1450px] max-h-[95vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden relative"
        style={{ zIndex: 100000 }}
      >
        
        {/* ── EN-TÊTE MODALE ── */}
        <div className="px-6 sm:px-8 py-4.5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#F0F7FF] border border-[#005DAA]/25 flex items-center justify-center text-[#005DAA] shadow-xs shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-zinc-950 font-mono tracking-tight flex items-center gap-2">
                  <span>Facturation Maritime &amp; Règlements :</span>
                  <span className="text-[#005DAA]">{bl.numeroBL}</span>
                </h3>
                {bl.conteneurs && bl.conteneurs.length > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30">
                    {bl.conteneurs.length} CTR
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-blue-50 text-blue-800 border border-blue-200">
                    VRAC / RORO
                  </span>
                )}
                {bl.statutImport && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                    {bl.statutImport}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 font-medium mt-0.5 flex flex-wrap items-center gap-2">
                {escaleInfo && (
                  <span className="flex items-center gap-1">
                    <Ship className="w-3.5 h-3.5 text-[#005DAA]" />
                    <span>Navire : <strong className="text-zinc-800">{escaleInfo.nomNavire}</strong> (Voyage {escaleInfo.numeroVoyage})</span>
                  </span>
                )}
                <span className="text-zinc-300">•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Client : <strong className="text-zinc-800">{bl.consigneeNom || 'Non renseigné'}</strong></span>
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer border border-zinc-200 shadow-2xs"
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
            escales={escales}
            invoices={invoices}
            rubriqueConfigs={rubriqueConfigs}
            invoiceTypeConfigs={invoiceTypeConfigs}
            userRole={userRole}
            selectedBlId={bl.id}
            onGenerateInvoice={onGenerateInvoice}
            onUpdateInvoice={onUpdateInvoice}
            onValidateInvoice={onValidateInvoice}
            onDeleteInvoice={onDeleteInvoice}
            onAddPayment={onAddPayment}
            onLogAudit={onLogAudit}
            onUpdateBl={onUpdateBl}
          />
        </div>

        {/* ── PIED DE PAGE ── */}
        <div className="px-6 sm:px-8 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-xs font-medium text-zinc-600">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#005DAA]" />
              <span>Factures émises : <strong className="text-zinc-900">{blInvoices.length}</strong></span>
            </span>
            <span className="text-zinc-300">|</span>
            <span>Total : <strong className="text-zinc-900 font-mono">{totalFacture.toLocaleString('fr-FR')} FCFA</strong></span>
            {totalSolde > 0 && (
              <>
                <span className="text-zinc-300">|</span>
                <span className="text-rose-600 font-bold">Solde dû : <strong className="font-mono">{totalSolde.toLocaleString('fr-FR')} FCFA</strong></span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95"
          >
            Fermer la fenêtre
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
