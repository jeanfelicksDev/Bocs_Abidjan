import React, { useState, useEffect, useMemo } from 'react';
import { BL, Escale, Invoice, UserRole, InvoiceTypeConfig, RubriqueConfig, Container, FretCategory, Payment, TaxeAdditionnelleConfig, TimbreBracket, DraftExport } from '../types';
import { isValidatedExportDraft, mapDraftToExportBl } from '../utils/exportBlMapper';
import { DEFAULT_TAXE_ADDITIONNELLE_CONFIG, computeTaxeAdditionnelle, getTaxeAdditionnelleValeurLabel } from '../utils/taxeAdditionnelle';
import { computeTimbreFiscal, getNetAPayerFcfa, getModeReglementLabel, MODES_REGLEMENT } from '../utils/timbreFiscal';
import { useEscapeClose, overlayClickClose } from '../hooks/useEscapeClose';
import { toastSuccess, toastError, toastWarning } from '../components/common/Toast';
import { generateProformaPdf, generateDoBadPdf, generateOriginalBlPdf, generateBocsExportBlLetterheadPdf } from '../utils/pdfGenerator';
import { 
  Search, 
  CreditCard, 
  FileText, 
  Ship, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Printer, 
  ArrowLeft, 
  ArrowRight, 
  ChevronRight, 
  ShieldCheck, 
  Calculator, 
  DollarSign, 
  FileCheck, 
  Box, 
  Anchor, 
  User, 
  Layers,
  Sparkles,
  RotateCcw,
  Trash2,
  Lock
} from 'lucide-react';

interface BlBillingModuleProps {
  bls: BL[];
  /** Drafts export : les connaissements validés y matérialisent les BL export réels. */
  drafts?: DraftExport[];
  escales: Escale[];
  invoices: Invoice[];
  rubriqueConfigs: RubriqueConfig[];
  invoiceTypeConfigs: InvoiceTypeConfig[];
  userRole: UserRole;
  selectedBlId?: number | null;
  onSelectBl?: (blId: number) => void;
  onNavigateToImport?: () => void;
  onGenerateInvoice: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onValidateInvoice?: (invoiceId: number) => void;
  onDeleteInvoice?: (invoiceId: number) => void;
  onAddPayment: (payment: Payment) => void;
  onLogAudit: (action: string, entite: string, details: string) => void;
  onUpdateBl?: (updatedBl: BL) => void;
  /** Taxe additionnelle exceptionnelle (assiette TTC) — affichée dans l'aperçu avant émission. */
  taxeAdditionnelleConfig?: TaxeAdditionnelleConfig;
  /** Tranches de timbre fiscal d'État (assiette HT) — appliquées à l'émission et à l'aperçu. */
  timbreBrackets?: TimbreBracket[];
}

export const BlBillingModule: React.FC<BlBillingModuleProps> = ({
  bls,
  drafts = [],
  escales,
  invoices,
  rubriqueConfigs = [],
  invoiceTypeConfigs = [],
  userRole,
  selectedBlId: externalSelectedBlId,
  onSelectBl,
  onNavigateToImport,
  onGenerateInvoice,
  onUpdateInvoice,
  onValidateInvoice,
  onDeleteInvoice,
  onAddPayment,
  onLogAudit,
  onUpdateBl,
  taxeAdditionnelleConfig = DEFAULT_TAXE_ADDITIONNELLE_CONFIG,
  timbreBrackets = []
}) => {
  // Search state (supports BL number or Shipper name)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEscaleFilter, setSelectedEscaleFilter] = useState<number | 'ALL'>('ALL');
  // Filtre par type d'opération : Tous / Import / Export
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IMPORT' | 'EXPORT'>('ALL');
  const [activeBlId, setActiveBlId] = useState<number | null>(() => {
    if (externalSelectedBlId) return externalSelectedBlId;
    return bls.length > 0 ? bls[0].id : null;
  });

  // Sync external selected BL
  useEffect(() => {
    if (externalSelectedBlId) {
      setActiveBlId(externalSelectedBlId);
    }
  }, [externalSelectedBlId]);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentFacture, setPaymentFacture] = useState<Invoice | null>(null);
  const [paymentMontant, setPaymentMontant] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'MOBILE_MONEY'>('VIREMENT');
  const [paymentRef, setPaymentRef] = useState('');

  // Mode de règlement sélectionné pour l'émission de la proforma
  // (COMPTANT / ESPECES => isComptant ; le timbre s'applique quel que soit le mode).
  const [printReglement, setPrintReglement] = useState<(typeof MODES_REGLEMENT)[number]>('A_TERME');

  // Print preview modal state
  const [printPreviewData, setPrintPreviewData] = useState<{
    bl: BL;
    typeConfig: InvoiceTypeConfig;
    existingInvoice?: Invoice;
  } | null>(null);

  // Printed proformas persisted state
  const [printedProformas, setPrintedProformas] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('bocs_printed_proformas');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bocs_printed_proformas', JSON.stringify(printedProformas));
    } catch (e) {}
  }, [printedProformas]);

  // DMDT Calculation Modal state
  const [calculationModalData, setCalculationModalData] = useState<{ bl: BL, typeConfig: InvoiceTypeConfig } | null>(null);
  const [modalRows, setModalRows] = useState<any[]>([]);

  // Validated calculations persisted in localStorage
  const [validatedCalculations, setValidatedCalculations] = useState<Record<string, { total: number, details: any[] }>>(() => {
    try {
      const saved = localStorage.getItem('bocs_validated_calculations');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bocs_validated_calculations', JSON.stringify(validatedCalculations));
    } catch (e) {}
  }, [validatedCalculations]);

  // ─── Planification des types de factures par BL ───
  const [plannedInvoicesByBl, setPlannedInvoicesByBl] = useState<Record<number, string[]>>(() => {
    try {
      const saved = localStorage.getItem('bocs_billing_planned_invoices');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem('bocs_billing_planned_invoices', JSON.stringify(plannedInvoicesByBl)); } catch {}
  }, [plannedInvoicesByBl]);

  // Types de factures exclus / retirés manuellement par l'utilisateur pour un BL
  const [excludedTypeIdsByBl, setExcludedTypeIdsByBl] = useState<Record<number, string[]>>(() => {
    try {
      const saved = localStorage.getItem('bocs_billing_excluded_invoices');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem('bocs_billing_excluded_invoices', JSON.stringify(excludedTypeIdsByBl)); } catch {}
  }, [excludedTypeIdsByBl]);

  // Modal sélection factures
  const [showInvoiceSelectionModal, setShowInvoiceSelectionModal] = useState(false);
  const [tempSelectedTypeIds, setTempSelectedTypeIds] = useState<string[]>([]);

  // Audit UX : fermeture clavier (Échap, sommet de pile) pour toutes les modales du module.
  useEscapeClose(showInvoiceSelectionModal, () => setShowInvoiceSelectionModal(false));
  useEscapeClose(showPaymentModal, () => setShowPaymentModal(false));
  useEscapeClose(Boolean(calculationModalData), () => setCalculationModalData(null));
  useEscapeClose(Boolean(printPreviewData), () => setPrintPreviewData(null));

  // ─── BLs d'export réels : connaissements émis depuis les drafts export validés ───
  // (les manifestes importés créent des BL import ; les connaissements export
  // existent sous forme de drafts validés portant un numéro BL généré).
  const exportBls = useMemo(
    () => drafts.filter(isValidatedExportDraft).map(mapDraftToExportBl),
    [drafts]
  );
  // Périmètre complet = BLs import (manifestes) + BLs export (connaissements validés).
  const allBls = useMemo(() => [...bls, ...exportBls], [bls, exportBls]);

  // Filter BLs matching search query (by BL number, Shipper name, or Consignee) + type d'opération
  const matchingBls = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allBls.filter(bl => {
      if (selectedEscaleFilter !== 'ALL' && bl.escaleId !== selectedEscaleFilter) {
        return false;
      }
      if (typeFilter !== 'ALL' && bl.typeOperation !== typeFilter) {
        return false;
      }
      if (!q) return true;
      const numMatch = (bl.numeroBL || '').toLowerCase().includes(q);
      const shipperMatch = (bl.shipperNom || '').toLowerCase().includes(q);
      const consigneeMatch = (bl.consigneeNom || '').toLowerCase().includes(q);
      const containerMatch = (bl.conteneurs || []).some(c => (c.numeroConteneur || '').toLowerCase().includes(q));
      return numMatch || shipperMatch || consigneeMatch || containerMatch;
    });
  }, [allBls, searchQuery, selectedEscaleFilter, typeFilter]);

  // Compteurs par type d'opération (dans le périmètre de l'escale sélectionnée) —
  // reflet de la réalité : import (manifestes) + export (connaissements validés).
  const typeCounts = useMemo(() => {
    const scope = selectedEscaleFilter === 'ALL' ? allBls : allBls.filter(b => b.escaleId === selectedEscaleFilter);
    return {
      ALL: scope.length,
      IMPORT: scope.filter(b => b.typeOperation === 'IMPORT').length,
      EXPORT: scope.filter(b => b.typeOperation === 'EXPORT').length
    };
  }, [allBls, selectedEscaleFilter]);

  // Currently active BL object — toujours dans le périmètre des filtres actifs
  const activeBl = useMemo(() => {
    const found = activeBlId ? allBls.find(b => b.id === activeBlId) : null;
    if (found && matchingBls.some(b => b.id === found.id)) return found;
    return matchingBls.length > 0 ? matchingBls[0] : null;
  }, [allBls, activeBlId, matchingBls]);

  // Active Escale for active BL
  const activeEscale = useMemo(() => {
    if (!activeBl) return null;
    return escales.find(e => e.id === activeBl.escaleId) || null;
  }, [escales, activeBl]);

  // Invoices linked to active BL
  const blInvoices = useMemo(() => {
    if (!activeBl) return [];
    return invoices.filter(inv => 
      (inv.blId === activeBl.id || inv.numeroBL === activeBl.numeroBL) &&
      inv.statutFacture !== 'ANNULEE'
    );
  }, [invoices, activeBl]);

  // Determine Fret Category
  const getBlCategory = (bl: BL): FretCategory => {
    if (bl.conteneurs && bl.conteneurs.length > 0) return 'CONTENEUR';
    const emballage = (bl.typeEmballage || '').toUpperCase();
    const marques = (bl.marquesEtNumeros || '').toUpperCase();
    const desc = (bl.descriptionGoods || '').toUpperCase();
    if (emballage === 'VRAC' || desc.includes('VRAC') || marques.includes('CDE')) return 'VRAC';
    if (emballage === 'RORO' || emballage.includes('VEHICULE') || emballage.includes('RO-RO') || marques.includes('CHASSIS') || desc.includes('TRUCK') || desc.includes('TRAILER')) {
      return 'RORO';
    }
    if (emballage.includes('CONV') || emballage.includes('COLIS') || emballage.includes('PALETTE') || emballage === 'CONVENTIONNEL' || desc.includes('STEEL') || desc.includes('CHEM')) {
      return 'CONVENTIONNEL';
    }
    return 'VRAC';
  };

  const getBlCargoCategories = (bl: BL): FretCategory[] => {
    const categories: FretCategory[] = [];
    if (bl.conteneurs && bl.conteneurs.length > 0) {
      categories.push('CONTENEUR');
    }
    const emballage = (bl.typeEmballage || '').toUpperCase();
    const marques = (bl.marquesEtNumeros || '').toUpperCase();
    const desc = (bl.descriptionGoods || '').toUpperCase();

    if (emballage === 'VRAC' || desc.includes('VRAC') || marques.includes('CDE')) {
      categories.push('VRAC');
    }
    if (
      emballage === 'RORO' ||
      emballage.includes('VEHICULE') ||
      emballage.includes('RO-RO') ||
      marques.includes('CHASSIS') ||
      marques.includes('RO-RO') ||
      desc.includes('VEHICULE') ||
      desc.includes('TRUCK') ||
      desc.includes('TRAILER')
    ) {
      categories.push('RORO');
    }
    if (
      emballage.includes('CONV') ||
      emballage.includes('COLIS') ||
      emballage.includes('PALETTE') ||
      emballage === 'CONVENTIONNEL' ||
      desc.includes('STEEL') ||
      desc.includes('CHEM')
    ) {
      categories.push('CONVENTIONNEL');
    }

    if (categories.length === 0) {
      return [getBlCategory(bl)];
    }
    return Array.from(new Set(categories));
  };

  // Switch to next/previous BL
  const handleNextBl = () => {
    if (!activeBl) return;
    const currentIndex = matchingBls.findIndex(b => b.id === activeBl.id);
    if (currentIndex < matchingBls.length - 1) {
      const nextBl = matchingBls[currentIndex + 1];
      setActiveBlId(nextBl.id);
      if (onSelectBl) onSelectBl(nextBl.id);
    }
  };

  const handlePrevBl = () => {
    if (!activeBl) return;
    const currentIndex = matchingBls.findIndex(b => b.id === activeBl.id);
    if (currentIndex > 0) {
      const prevBl = matchingBls[currentIndex - 1];
      setActiveBlId(prevBl.id);
      if (onSelectBl) onSelectBl(prevBl.id);
    }
  };

  // Helper prefix
  const getInvoiceTypePrefix = (typeName: string): string => {
    const n = (typeName || '').toLowerCase();
    if (n.includes('telex') || n.includes('télex')) return 'TEL';
    if (n.includes('surestarie') || n.includes('suréstarie')) return 'SUR';
    if (n.includes('detention') || n.includes('détention')) return 'DET';
    if (n.includes('echange') || n.includes('échange')) return 'ECH';
    if (n.includes('caution')) return 'CAU';
    if (n.includes('transfert')) return 'TRF';
    if (n.includes('fret')) return 'FRT';
    const clean = n.replace(/^facture\s+/i, '').trim();
    return clean.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'FAC';
  };

  const getNextInvoiceNumber = (
    type: 'PROFORMA' | 'FACTURE',
    voyageNumber: string,
    existingInvoices: Invoice[],
    invoiceTypeName?: string
  ): string => {
    const cleanVoyage = (voyageNumber || 'SANS_VOYAGE').trim().replace(/[^a-zA-Z0-9-]/g, '');
    const typePrefix = invoiceTypeName ? getInvoiceTypePrefix(invoiceTypeName) : '';
    const faPrefix = type === 'FACTURE' ? 'FA-' : '';
    const searchPrefix = `${faPrefix}${typePrefix}${cleanVoyage}-BOCS`;
    
    const matchedNumbers = existingInvoices
      .map(inv => inv.numeroFacture || '')
      .filter(num => num.startsWith(searchPrefix));
      
    let maxCounter = 0;
    matchedNumbers.forEach(num => {
      const suffix = num.replace(searchPrefix, '');
      const counterVal = parseInt(suffix, 10);
      if (!isNaN(counterVal) && counterVal > maxCounter) {
        maxCounter = counterVal;
      }
    });
    
    const nextCounter = maxCounter + 1;
    const nextCounterStr = String(nextCounter).padStart(3, '0');
    return `${searchPrefix}${nextCounterStr}`;
  };

  // Détection d'un connaissement export (typeOperation EXPORT).
  // Les BL export sont matérialisés depuis les drafts export validés — leur identifiant
  // est négatif (univers distinct des BL import issus des manifestes).
  const isExportBl = (bl: BL | null | undefined): boolean => {
    if (!bl) return false;
    if (bl.typeOperation === 'EXPORT') return true;
    return bl.id < 0;
  };

  // Détection du type de facture Telex (Telex Release).
  // En configuration standard, l'identifiant '3' correspond au type « Telex ».
  const isTelexTypeConfig = (typeConfig: InvoiceTypeConfig): boolean => {
    const name = (typeConfig.name || '').toLowerCase();
    return name.includes('telex') || name.includes('télex') || typeConfig.id === '3';
  };

  // Helper pour obtenir les types de factures par défaut selon le type d'opération
  // et la marchandise :
  // - BL export : uniquement Echange (frais d'échange BL)
  // - BL import Conteneurs : Caution, Echange et Transfert
  // - BL import Vracs, Roro et Conventionnel : Echange
  const getDefaultTypeIdsForBl = (bl: BL): string[] => {
    const blCategory = getBlCategory(bl);
    const exportOperation = isExportBl(bl);
    return invoiceTypeConfigs.filter(typeConfig => {
      const name = typeConfig.name.toLowerCase();
      const isCaution = name.includes('caution');
      const isEchange = name.includes('echange') || name.includes('échange') || typeConfig.id === '2';
      const isTransfert = name.includes('transfert');

      if (exportOperation) {
        return isEchange;
      }
      if (blCategory === 'CONTENEUR') {
        return isCaution || isEchange || isTransfert;
      }
      // VRAC, RORO, CONVENTIONNEL
      return isEchange;
    }).map(t => t.id);
  };

  // Prestations / Types de factures applicables & actifs pour le BL sélectionné
  const activeTypeConfigs = useMemo(() => {
    if (!activeBl) return [];
    const blCategory = getBlCategory(activeBl);
    const plannedIds = plannedInvoicesByBl[activeBl.id];
    const excludedIds = excludedTypeIdsByBl[activeBl.id] || [];

    // 1. Rassembler toutes les configurations officielles
    const allConfigs = [...invoiceTypeConfigs];

    // 2. Garantir que toute facture existant pour ce BL (ex: Proforma Détention ou Surestarie émise)
    // dispose impérativement d'un typeConfig pour être obligatoirement affichée dans la liste
    blInvoices.forEach(inv => {
      const match = allConfigs.find(t => 
        t.id === inv.invoiceTypeId ||
        (inv.typeFacture && t.name.toLowerCase() === inv.typeFacture.toLowerCase()) ||
        (inv.numeroFacture && inv.numeroFacture.includes(getInvoiceTypePrefix(t.name)))
      );
      if (!match) {
        const isDet = inv.typeFacture?.toLowerCase().includes('detention') || inv.typeFacture?.toLowerCase().includes('détention') || inv.numeroFacture?.includes('DET');
        const isSur = inv.typeFacture?.toLowerCase().includes('surestarie') || inv.numeroFacture?.includes('SUR');
        allConfigs.push({
          id: inv.invoiceTypeId || `dyn-${inv.id}`,
          name: inv.typeFacture || (isDet ? 'Détention' : isSur ? 'Surestarie' : 'Facture Spécifique'),
          description: `Facture émise : ${inv.numeroFacture}`
        });
      }
    });

    return allConfigs.filter(typeConfig => {
      const prefix = getInvoiceTypePrefix(typeConfig.name);
      const existingInvoice = blInvoices.find(inv => 
        inv.invoiceTypeId === typeConfig.id ||
        (inv.numeroFacture && inv.numeroFacture.includes(prefix)) ||
        (inv.typeFacture && inv.typeFacture.toLowerCase().includes(typeConfig.name.toLowerCase()))
      );

      // RÈGLE ABSOLUE : Si une facture existe déjà (proforma ou validée ou payée), TOUJOURS L'AFFICHER !
      if (existingInvoice) return true;

      // Si explicitement retiré / exclu par l'utilisateur pour ce BL -> ne pas afficher
      if (excludedIds.includes(typeConfig.id)) return false;

      // Si une sélection manuelle explicite a été enregistrée pour ce BL, elle filtre les prestations
      if (Array.isArray(plannedIds) && plannedIds.length > 0) {
        return plannedIds.includes(typeConfig.id);
      }

      // Par défaut : éligibilité selon le type d'opération et la catégorie de marchandise
      // - BL export : uniquement Echange
      // - BL import conteneurs : Caution, échange et transfert
      // - BL import vracs, roro et conventionnel : Echange
      const name = typeConfig.name.toLowerCase();
      const isCaution = name.includes('caution');
      const isEchange = name.includes('echange') || name.includes('échange') || typeConfig.id === '2';
      const isTransfert = name.includes('transfert');

      if (isExportBl(activeBl)) {
        return isEchange;
      }

      if (blCategory === 'CONTENEUR') {
        return isCaution || isEchange || isTransfert;
      }
      // VRAC, RORO, CONVENTIONNEL
      return isEchange;
    });
  }, [activeBl, invoiceTypeConfigs, blInvoices, plannedInvoicesByBl, excludedTypeIdsByBl]);

  // Libération par télex : dès que la facture Telex est ajoutée au BL export,
  // le connaissement original devient « Non Négociable ».
  // Détection : prestation Telex active pour le BL OU facture Telex déjà émise.
  const hasTelexPrestation = useMemo(() => {
    if (!activeBl) return false;

    if (activeTypeConfigs.some(isTelexTypeConfig)) return true;

    return blInvoices.some(inv => {
      if (inv.invoiceTypeId) {
        const tc = invoiceTypeConfigs.find(t => t.id === inv.invoiceTypeId);
        if (tc && isTelexTypeConfig(tc)) return true;
      }
      const typeFacture = (inv.typeFacture || '').toLowerCase();
      if (typeFacture.includes('telex') || typeFacture.includes('télex')) return true;
      // Numérotation : [FA-]TEL<voyage>-BOCS###
      return /TEL\d/.test((inv.numeroFacture || '').toUpperCase());
    });
  }, [activeBl, activeTypeConfigs, blInvoices, invoiceTypeConfigs]);

  // Retirer une prestation ou supprimer une proforma
  const handleRemovePrestation = (typeConfig: InvoiceTypeConfig, existingInvoice?: Invoice) => {
    if (!activeBl) return;

    if (existingInvoice) {
      const isProforma = !(existingInvoice.numeroFacture || '').startsWith('FA-') && existingInvoice.statutFacture !== 'VALIDEE';
      const isPaid = existingInvoice.soldeDuFcfa === 0 || existingInvoice.statutPaiement === 'PAYE';
      if (!isProforma || isPaid) {
        toastError('Impossible de retirer directement une facture validée ou payée (utiliser une note d\'avoir).');
        return;
      }

      // Suppression de la facture proforma
      if (onDeleteInvoice) {
        onDeleteInvoice(existingInvoice.id);
      }
      onLogAudit(
        'SUPPRESSION_PROFORMA_BL',
        'Facture',
        `Suppression de la proforma ${existingInvoice.numeroFacture} (${typeConfig.name}) pour le BL ${activeBl.numeroBL}`
      );
    } else {
      onLogAudit(
        'RETRAIT_PRESTATION_BL',
        'BL',
        `Retrait de la prestation "${typeConfig.name}" du BL ${activeBl.numeroBL}`
      );
    }

    // 1. Ajouter uniquement ce typeConfig.id à la liste des exclus pour ce BL
    setExcludedTypeIdsByBl(prev => ({
      ...prev,
      [activeBl.id]: Array.from(new Set([...(prev[activeBl.id] || []), typeConfig.id]))
    }));

    // 2. Si une sélection personnalisée existait pour ce BL, retirer uniquement ce type
    setPlannedInvoicesByBl(prev => {
      const current = prev[activeBl.id];
      if (Array.isArray(current) && current.length > 0) {
        return {
          ...prev,
          [activeBl.id]: current.filter(id => id !== typeConfig.id)
        };
      }
      return prev;
    });

    // Nettoyage des caches associés
    const calcKey = `${activeBl.id}-${typeConfig.id}`;
    setPrintedProformas(prev => {
      const copy = { ...prev };
      delete copy[calcKey];
      return copy;
    });

    toastSuccess(existingInvoice ? `Proforma ${existingInvoice.numeroFacture} supprimée et retirée du BL.` : `Prestation "${typeConfig.name}" retirée de ce BL.`);
  };

  // Initialize DMDT Modal Rows
  useEffect(() => {
    if (!calculationModalData) {
      setModalRows([]);
      return;
    }
    
    const bl = calculationModalData.bl;
    const typeConfig = calculationModalData.typeConfig;
    const savedCalc = validatedCalculations[`${bl.id}-${typeConfig.id}`];
    const escale = escales.find(e => e.id === bl.escaleId);
    
    const saved = localStorage.getItem('bocs_tarifs');
    let tarifs = [];
    if (saved) {
      try { tarifs = JSON.parse(saved); } catch (e) {}
    }
    const regime = typeConfig?.name?.toLowerCase()?.includes('surestarie') ? 'SURESTARIE' : 'DETENTION';
    const typeOperation = bl?.typeOperation || 'IMPORT';

    const rows = (bl.conteneurs || []).map(c => {
      const existing = savedCalc?.details?.find((det: any) => det.containerId === c.id || det.numeroConteneur === c.numeroConteneur);
      const defaultAccostage = existing?.dateAccostage || c.dateEntreeParc || escale?.dateArrivee || new Date().toISOString().split('T')[0];
      const defaultLivraison = existing?.dateLivraison || c.dateSortieParc || new Date().toISOString().split('T')[0];
      
      let calculatedFranchise = c.typeConteneur.toLowerCase().includes('reefer') ? 3 : 7;
      const matchedTarif = tarifs.find((t: any) => 
        t.typeConteneur === c.typeConteneur &&
        (t.regime || 'SURESTARIE') === regime &&
        (t.typeOperation || 'IMPORT') === typeOperation &&
        t.joursFranchise !== undefined
      );
      if (matchedTarif) {
        calculatedFranchise = matchedTarif.joursFranchise;
      }
      
      const defaultFranchise = existing !== undefined ? existing.franchise : calculatedFranchise;
      
      return {
        containerId: c.id,
        numeroConteneur: c.numeroConteneur,
        typeConteneur: c.typeConteneur,
        dateAccostage: defaultAccostage,
        dateLivraison: defaultLivraison,
        franchise: defaultFranchise
      };
    });
    setModalRows(rows);
  }, [calculationModalData, validatedCalculations, escales]);

  // Degressive DMDT Calculation formula
  const calculateDegressiveAmount = (typeConteneur: string, stayDays: number, franchise: number, dateAccostageStr?: string) => {
    const saved = localStorage.getItem('bocs_tarifs');
    let tariffs = [];
    if (saved) {
      try { tariffs = JSON.parse(saved); } catch (e) {}
    }
    
    const regime = calculationModalData?.typeConfig?.name?.toLowerCase()?.includes('surestarie') ? 'SURESTARIE' : 'DETENTION';
    const typeOperation = calculationModalData?.bl?.typeOperation || 'IMPORT';

    const matchedTariffs = (tariffs || []).filter((t: any) => 
      t.typeConteneur === typeConteneur &&
      (t.regime || 'SURESTARIE') === regime &&
      (t.typeOperation || 'IMPORT') === typeOperation
    );
    
    let totalAmount = 0;
    const breakdownMap = new Map<string, { rate: number, days: number, amount: number, label: string, firstDay: number, lastDay: number }>();
    
    for (let day = franchise + 1; day <= stayDays; day++) {
      let rate = 0;
      let label = '';
      
      const tier = matchedTariffs.find((t: any) => day >= t.jourDebut && day <= t.jourFin);
      if (tier) {
        rate = tier.tarifJournalierFcfa;
        label = `Jour ${tier.jourDebut} à ${tier.jourFin}`;
      } else if (matchedTariffs.length > 0) {
        const sorted = [...matchedTariffs].sort((a: any, b: any) => b.jourFin - a.jourFin);
        if (day > sorted[0].jourFin) {
           rate = sorted[0].tarifJournalierFcfa;
           label = `Jour ${sorted[0].jourFin + 1} et +`;
        }
      } else {
        rate = typeConteneur.includes('20') ? 15000 : 25000;
        label = 'Tarif Standard';
      }

      if (rate > 0) {
         totalAmount += rate;
         const key = label;
         if (breakdownMap.has(key)) {
            const entry = breakdownMap.get(key)!;
            entry.days += 1;
            entry.amount += rate;
            entry.lastDay = day;
         } else {
            breakdownMap.set(key, { rate, days: 1, amount: rate, label, firstDay: day, lastDay: day });
         }
      }
    }
    
    const breakdown = Array.from(breakdownMap.values()).map(b => {
      let dateString = '';
      if (dateAccostageStr) {
        const baseDate = new Date(dateAccostageStr);
        const startD = new Date(baseDate);
        startD.setDate(baseDate.getDate() + b.firstDay);
        const endD = new Date(baseDate);
        endD.setDate(baseDate.getDate() + b.lastDay);
        const formatDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        dateString = `du ${formatDate(startD)} au ${formatDate(endD)}`;
      }
      return { ...b, dateString };
    });

    return { totalAmount, breakdown };
  };

  // Pre-calculate proforma invoice data for preview modal
  const calculateProformaData = (bl: BL, typeConfig: InvoiceTypeConfig, existingInvoice?: Invoice): Invoice => {
    const blCategory = getBlCategory(bl);
    const isEchangeType = typeConfig.id === '2' || typeConfig.name.toLowerCase().includes('echange');
    const socContainers = (bl.conteneurs || []).filter(c => c.socCoc === 'SOC');
    const cocContainers = (bl.conteneurs || []).filter(c => c.socCoc === 'COC' || !c.socCoc);

    const calcKey = `${bl.id}-${typeConfig.id}`;
    const validation = validatedCalculations[calcKey];

    let lines = [];
    if (existingInvoice && existingInvoice.lignes && existingInvoice.lignes.length > 0) {
      lines = existingInvoice.lignes;
    } else if (validation) {
      const isDet = typeConfig.name.toLowerCase().includes('detention') || typeConfig.name.toLowerCase().includes('détention');
      const typeFrais = (isDet ? 'DMDT_DETENTION' : 'DMDT_SURESTARIE') as any;
      lines = validation.details.flatMap((det: any) => {
        if (det.breakdown && det.breakdown.length > 0) {
          return det.breakdown.map((b: any) => ({
            designation: `${typeConfig.name} - Conteneur ${det.numeroConteneur} (${det.typeConteneur}) : Tranche ${b.label} (${b.days} j)${b.dateString ? ` [${b.dateString}]` : ''}`,
            typeFrais,
            quantite: b.days,
            prixUnitaireFcfa: b.rate,
            montantHtFcfa: b.amount,
            tauxTva: 18
          }));
        }
        return [{
          designation: `${typeConfig.name} - Conteneur ${det.numeroConteneur} (${det.typeConteneur}) : ${det.billableDays} j (Séjour: ${det.stayDays}j, Franchise: ${det.franchise}j)`,
          typeFrais,
          quantite: det.billableDays || 1,
          prixUnitaireFcfa: det.rate || Math.round(det.montant / (det.billableDays || 1)),
          montantHtFcfa: det.montant,
          tauxTva: 18
        }];
      });
    } else {
      const blCargoCategories = getBlCargoCategories(bl);
      const activeConfigs = rubriqueConfigs.filter(r => {
        if (r.invoiceTypeId !== typeConfig.id || !r.isActive) return false;

        if (isEchangeType) {
          const isContainerRubrique = r.category === 'CONTENEUR' || r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR_SOC';
          if (isContainerRubrique) {
            if (!blCargoCategories.includes('CONTENEUR')) return false;
            if (socContainers.length > 0 && cocContainers.length === 0) {
              return r.category === 'CONTENEUR_SOC';
            } else if (cocContainers.length > 0 && socContainers.length === 0) {
              return r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR';
            } else {
              return r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR_SOC' || r.category === 'CONTENEUR';
            }
          }
          return blCargoCategories.includes(r.category as FretCategory);
        }

        return r.category === blCategory;
      });

      lines = activeConfigs.map(r => {
        let quantity = 1;
        const isSocRub = r.category === 'CONTENEUR_SOC' || r.name.toUpperCase().includes('SOC') || r.code.toUpperCase().includes('SOC');
        const isCocRub = r.category === 'CONTENEUR_COC' || r.name.toUpperCase().includes('COC') || r.code.toUpperCase().includes('COC');
        
        if (isSocRub && socContainers.length === 0) {
          quantity = 0;
        } else if (isCocRub && cocContainers.length === 0) {
          quantity = 0;
        } else {
          const isIsps = r.name.toUpperCase().includes('ISPS') || r.code === 'ISPS' || r.baseCalcul === 'TEU';
          if (isIsps) {
            const targetCtns = isSocRub ? socContainers : (isCocRub ? cocContainers : (bl.conteneurs || []));
            quantity = targetCtns.length > 0 
              ? targetCtns.reduce((sum, c) => sum + (c.typeConteneur.includes('40') ? 2 : 1), 0)
              : 1;
          } else if (r.baseCalcul === 'CONTENEUR') {
            if (isSocRub) {
              quantity = socContainers.length;
            } else if (isCocRub) {
              quantity = cocContainers.length;
            } else {
              quantity = (bl.conteneurs && bl.conteneurs.length > 0) ? bl.conteneurs.length : 1;
            }
          } else if (r.baseCalcul === 'POIDS_TONNE') {
            quantity = bl.poidsBrutKg ? Math.round((bl.poidsBrutKg / 1000) * 100) / 100 : 1;
          }
        }

        const typeFraisOptions = ['FRET', 'ECHANGE', 'TELEX', 'TRANSFERT', 'CAUTION', 'DMDT_SURESTARIE', 'AUTRE'];
        const itemTypeFrais = typeFraisOptions.includes(r.code) ? r.code : 'AUTRE';
        return {
          designation: r.name,
          typeFrais: itemTypeFrais as any,
          quantite: quantity,
          prixUnitaireFcfa: r.montantUnitaire,
          montantHtFcfa: Math.round(quantity * r.montantUnitaire),
          tauxTva: 18
        };
      });
    }

    lines = lines.filter(l => l.quantite > 0 && l.montantHtFcfa > 0);

    if (lines.length === 0) {
      lines = [
        { 
          designation: `Frais administratifs - ${typeConfig.name}`, 
          typeFrais: 'AUTRE' as any, 
          quantite: 1, 
          prixUnitaireFcfa: 100000, 
          montantHtFcfa: 100000, 
          tauxTva: 18 
        }
      ];
    }

    const totalHt = lines.reduce((acc, l) => acc + l.montantHtFcfa, 0);
    const totalTva = Math.round(totalHt * 0.18);
    const totalTtc = totalHt + totalTva;

    const escale = escales.find(e => e.id === bl.escaleId);
    const voyageNum = escale?.numeroVoyage || '25586';

    const proformaNumber = existingInvoice?.numeroFacture || getNextInvoiceNumber('PROFORMA', voyageNum, invoices, typeConfig.name);
    const now = new Date().toISOString().split('T')[0];

    return {
      id: existingInvoice ? existingInvoice.id : Date.now(),
      numeroFacture: proformaNumber,
      dateFacture: existingInvoice?.dateFacture || now,
      dateEcheance: existingInvoice?.dateEcheance || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      typeFacture: existingInvoice?.typeFacture || (typeConfig.name as any) || 'PROFORMA_IMPORT',
      invoiceTypeId: typeConfig.id,
      statutFacture: existingInvoice?.statutFacture || 'BROUILLON',
      statutPaiement: existingInvoice?.statutPaiement || 'NON_PAYE',
      clientNom: bl.consigneeNom || 'CLIENT IMPORTATEUR',
      numeroBL: bl.numeroBL,
      blId: bl.id,
      escaleInfo: `${escale?.nomNavire || 'BOCS BREMEN'} V.${voyageNum}`,
      montantHtFcfa: totalHt,
      tvaFcfa: totalTva,
      montantTtcFcfa: totalTtc,
      soldeDuFcfa: totalTtc,
      tauxChangeUsd: 600,
      devise: 'FCFA',
      fneReference: `FNE-BOCS-PROFORMA-${bl.numeroBL}-${typeConfig.id}-${totalTtc}`,
      lignes: lines.map((l, idx) => ({ ...l, id: idx + 1 }))
    };
  };

  // Generate or Update Proforma for an Invoice Type
  const handleGenerateProformaForType = (bl: BL, typeConfig: InvoiceTypeConfig, existingInvoice?: Invoice) => {
    const blCategory = getBlCategory(bl);
    const isEchangeType = typeConfig.id === '2' || typeConfig.name.toLowerCase().includes('echange');
    const socContainers = (bl.conteneurs || []).filter(c => c.socCoc === 'SOC');
    const cocContainers = (bl.conteneurs || []).filter(c => c.socCoc === 'COC' || !c.socCoc);

    const calcKey = `${bl.id}-${typeConfig.id}`;
    const validation = validatedCalculations[calcKey];

    let lines = [];
    if (validation) {
      lines = validation.details.flatMap((det: any) => {
        if (det.breakdown && det.breakdown.length > 0) {
          return det.breakdown.map((b: any) => ({
            designation: `${typeConfig.name} - Conteneur ${det.numeroConteneur} (${det.typeConteneur}) : Tranche ${b.label} (${b.days} j)${b.dateString ? ` [${b.dateString}]` : ''}`,
            typeFrais: 'DMDT_SURESTARIE' as any,
            quantite: b.days,
            prixUnitaireFcfa: b.rate,
            montantHtFcfa: b.amount,
            tauxTva: 18
          }));
        }
        return [{
          designation: `${typeConfig.name} - Conteneur ${det.numeroConteneur} (${det.typeConteneur}) : ${det.billableDays} j (Séjour: ${det.stayDays}j, Franchise: ${det.franchise}j)`,
          typeFrais: 'DMDT_SURESTARIE' as any,
          quantite: det.billableDays,
          prixUnitaireFcfa: det.rate,
          montantHtFcfa: det.montant,
          tauxTva: 18
        }];
      });
    } else {
      const blCargoCategories = getBlCargoCategories(bl);
      const activeConfigs = rubriqueConfigs.filter(r => {
        if (r.invoiceTypeId !== typeConfig.id || !r.isActive) return false;

        if (isEchangeType) {
          const isContainerRubrique = r.category === 'CONTENEUR' || r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR_SOC';
          if (isContainerRubrique) {
            if (!blCargoCategories.includes('CONTENEUR')) return false;
            if (socContainers.length > 0 && cocContainers.length === 0) {
              return r.category === 'CONTENEUR_SOC';
            } else if (cocContainers.length > 0 && socContainers.length === 0) {
              return r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR';
            } else {
              return r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR_SOC' || r.category === 'CONTENEUR';
            }
          }
          return blCargoCategories.includes(r.category as FretCategory);
        }

        return r.category === blCategory;
      });

      lines = activeConfigs.map(r => {
        let quantity = 1;
        const isSocRub = r.category === 'CONTENEUR_SOC' || r.name.toUpperCase().includes('SOC') || r.code.toUpperCase().includes('SOC');
        const isCocRub = r.category === 'CONTENEUR_COC' || r.name.toUpperCase().includes('COC') || r.code.toUpperCase().includes('COC');
        
        if (isSocRub && socContainers.length === 0) {
          quantity = 0;
        } else if (isCocRub && cocContainers.length === 0) {
          quantity = 0;
        } else {
          const isIsps = r.name.toUpperCase().includes('ISPS') || r.code === 'ISPS' || r.baseCalcul === 'TEU';
          if (isIsps) {
            const targetCtns = isSocRub ? socContainers : (isCocRub ? cocContainers : (bl.conteneurs || []));
            quantity = targetCtns.length > 0 
              ? targetCtns.reduce((sum, c) => sum + (c.typeConteneur.includes('40') ? 2 : 1), 0)
              : 1;
          } else if (r.baseCalcul === 'CONTENEUR') {
            if (isSocRub) {
              quantity = socContainers.length;
            } else if (isCocRub) {
              quantity = cocContainers.length;
            } else {
              quantity = (bl.conteneurs && bl.conteneurs.length > 0) ? bl.conteneurs.length : 1;
            }
          } else if (r.baseCalcul === 'POIDS_TONNE') {
            quantity = bl.poidsBrutKg ? Math.round((bl.poidsBrutKg / 1000) * 100) / 100 : 1;
          }
        }

        const typeFraisOptions = ['FRET', 'ECHANGE', 'TELEX', 'TRANSFERT', 'CAUTION', 'DMDT_SURESTARIE', 'AUTRE'];
        const itemTypeFrais = typeFraisOptions.includes(r.code) ? r.code : 'AUTRE';
        return {
          designation: r.name,
          typeFrais: itemTypeFrais as any,
          quantite: quantity,
          prixUnitaireFcfa: r.montantUnitaire,
          montantHtFcfa: Math.round(quantity * r.montantUnitaire),
          tauxTva: 18
        };
      });
    }

    lines = lines.filter(l => l.quantite > 0 && l.montantHtFcfa > 0);

    if (lines.length === 0) {
      lines = [
        { 
          designation: `Frais administratifs - ${typeConfig.name}`, 
          typeFrais: 'AUTRE' as any, 
          quantite: 1, 
          prixUnitaireFcfa: 100000, 
          montantHtFcfa: 100000, 
          tauxTva: 18 
        }
      ];
    }

    const totalHt = lines.reduce((acc, l) => acc + l.montantHtFcfa, 0);
    const totalTva = Math.round(totalHt * 0.18);
    const totalTtc = totalHt + totalTva;

    const escale = escales.find(e => e.id === bl.escaleId);
    const voyageNum = escale?.numeroVoyage || '25586';

    const proformaNumber = existingInvoice?.numeroFacture || getNextInvoiceNumber('PROFORMA', voyageNum, invoices, typeConfig.name);
    const now = new Date().toISOString().split('T')[0];

    const invoicePayload: Invoice = {
      id: existingInvoice ? existingInvoice.id : Date.now(),
      numeroFacture: proformaNumber,
      dateFacture: existingInvoice?.dateFacture || now,
      dateEcheance: existingInvoice?.dateEcheance || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      typeFacture: 'PROFORMA_IMPORT',
      invoiceTypeId: typeConfig.id,
      statutFacture: 'BROUILLON',
      statutPaiement: 'NON_PAYE',
      clientNom: bl.consigneeNom || 'CLIENT IMPORTATEUR',
      numeroBL: bl.numeroBL,
      blId: bl.id,
      escaleInfo: `${escale?.nomNavire || 'BOCS BREMEN'} V.${voyageNum}`,
      montantHtFcfa: totalHt,
      tvaFcfa: totalTva,
      montantTtcFcfa: totalTtc,
      soldeDuFcfa: totalTtc,
      tauxChangeUsd: 600,
      devise: 'FCFA',
      fneReference: `FNE-BOCS-PROFORMA-${bl.numeroBL}-${typeConfig.id}-${totalTtc}`,
      lignes: lines.map((l, idx) => ({ ...l, id: idx + 1 }))
    };

    if (existingInvoice && onUpdateInvoice) {
      onUpdateInvoice(invoicePayload);
      toastSuccess(`Proforma ${proformaNumber} (${typeConfig.name}) mise à jour.`);
    } else {
      onGenerateInvoice(invoicePayload);
      toastSuccess(`Proforma ${proformaNumber} (${typeConfig.name}) générée avec succès !`);
    }

    onLogAudit(
      'GENERATION_PROFORMA_BL',
      'Facture',
      `Émission de la proforma ${proformaNumber} (${typeConfig.name}, ${totalTtc.toLocaleString('fr-FR')} FCFA) pour le BL ${bl.numeroBL}`
    );

    // Auto-generate PDF for preview
    generateProformaPdf(invoicePayload, bl);
  };

  // Submit Payment
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentFacture || paymentMontant <= 0) return;

    const newPayment: Payment = {
      id: Date.now(),
      factureId: paymentFacture.id,
      numeroFacture: paymentFacture.numeroFacture,
      datePaiement: new Date().toISOString().split('T')[0],
      modePaiement: paymentMode,
      montantFcfa: paymentMontant,
      referenceTransaction: paymentRef || `VIR-${Math.floor(100000 + Math.random() * 900000)}`,
      saisiPar: 'Comptabilité BOCS Abidjan'
    };

    onAddPayment(newPayment);
    onLogAudit('ENREGISTREMENT_REGLEMENT', 'Paiement', `Règlement de ${paymentMontant.toLocaleString()} FCFA sur facture ${paymentFacture.numeroFacture}`);
    setShowPaymentModal(false);
    setPaymentFacture(null);
    setPaymentMontant(0);
    setPaymentRef('');
    toastSuccess('Règlement enregistré avec succès !');
  };

  // Check if BAD can be released
  const isBadDeliverable = useMemo(() => {
    if (!activeBl) return false;
    // Check if at least one invoice is paid or all generated invoices are paid
    if (blInvoices.length === 0) return false;
    const allPaid = blInvoices.every(inv => inv.soldeDuFcfa === 0 || inv.statutPaiement === 'PAYE');
    return allPaid;
  }, [activeBl, blInvoices]);

  console.log("BlBillingModule userRole:", userRole);

  const handlePrintBad = () => {
    if (!activeBl) return;
    const escale = activeEscale || {
      id: activeBl.escaleId,
      nomNavire: 'BOCS BREMEN',
      callsign: 'D5ZW3',
      numeroVoyage: '25586',
      portChargement: 'ANVERS (BEANR)',
      portDechargement: 'ABIDJAN (CIABJ)',
      dateArrivee: '2025-07-16',
      statut: 'EN_COURS' as const
    };
    generateDoBadPdf(activeBl, escale);
    toastSuccess(`Bon à Délivrer (BAD) généré pour le BL ${activeBl.numeroBL}`);
  };

  // Impression du connaissement original export (papier à en-tête BOCS)
  const handlePrintBl = () => {
    if (!activeBl) return;
    const escale = activeEscale || {
      id: activeBl.escaleId,
      nomNavire: 'BOCS BREMEN',
      callsign: 'D5ZW3',
      numeroVoyage: '25586',
      portChargement: 'ANVERS (BEANR)',
      portDechargement: 'ABIDJAN (CIABJ)',
      dateArrivee: '2025-07-16',
      statut: 'EN_COURS' as const
    };
    // Retrouver le draft export source pour restituer l'édition papier à en-tête.
    const sourceDraft = drafts.find(d =>
      (d.numeroBlGenere && d.numeroBlGenere === activeBl.numeroBL) ||
      (d.numeroDraft && d.numeroDraft === activeBl.numeroBL) ||
      Math.abs(d.id) === Math.abs(activeBl.id)
    );

    if (sourceDraft) {
      generateBocsExportBlLetterheadPdf(sourceDraft, escale, undefined, { withLetterheadHeader: true, nonNegotiable: hasTelexPrestation });
    } else {
      generateOriginalBlPdf(activeBl, undefined, { nonNegotiable: hasTelexPrestation });
    }
    onLogAudit(
      'IMPRESSION_BL_EXPORT',
      'BLOriginal',
      `Impression du connaissement ${activeBl.numeroBL}${hasTelexPrestation ? ' (Non Négociable — Telex Release)' : ''}`
    );
    toastSuccess(`Connaissement ${activeBl.numeroBL} imprimé${hasTelexPrestation ? ' (Non Négociable)' : ''}.`);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* ─── 1. BARRE DE COMMANDE & RECHERCHE UNIVERSELLE MINIMALISTE ─── */}
      <div className="bg-white rounded-2xl p-3.5 flex flex-col md:flex-row md:flex-wrap gap-4 items-center border border-zinc-200 shadow-xs">
        
        {/* Champ de recherche universel */}
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[20px]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par N° BL, Shipper, Client ou Référence..."
            className="w-full pl-11 pr-8 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-[#005DAA] focus:bg-white focus:outline-none transition-colors font-sans text-sm text-zinc-950 font-bold placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="h-8 w-px bg-zinc-200 hidden md:block"></div>

        {/* Filtre Type d'Opération : Tous / Import / Export */}
        <div className="flex items-center gap-1 p-1 bg-zinc-50 border border-zinc-200 rounded-xl shrink-0" role="group" aria-label="Filtrer par type d'opération">
          {([
            { val: 'ALL', label: 'Tous', icon: 'apps' },
            { val: 'IMPORT', label: 'Import', icon: 'south_west' },
            { val: 'EXPORT', label: 'Export', icon: 'north_east' }
          ] as const).map(tf => (
            <button
              key={tf.val}
              type="button"
              onClick={() => setTypeFilter(tf.val)}
              className={`px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                typeFilter === tf.val
                  ? 'bg-[#005DAA] text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title={`Afficher les BL ${tf.label === 'Tous' ? '(Import & Export)' : tf.label}`}
            >
              <span className="material-symbols-outlined text-[14px]">{tf.icon}</span>
              <span className="hidden sm:inline">{tf.label}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono font-black ${typeFilter === tf.val ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                {typeCounts[tf.val]}
              </span>
            </button>
          ))}
        </div>

        {/* Filtre Escale & Navigation Rapide */}
        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto px-1 shrink-0">
          <div className="relative font-bold">
            <select
              value={selectedEscaleFilter}
              onChange={e => setSelectedEscaleFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl py-2 px-3.5 pr-9 font-sans text-xs text-zinc-800 focus:outline-none focus:border-[#005DAA] cursor-pointer appearance-none font-bold transition-colors"
            >
              <option value="ALL">Toutes les escales ({escales.length})</option>
              {escales.map(esc => (
                <option key={esc.id} value={esc.id}>
                  {esc.nomNavire} (Voyage {esc.numeroVoyage})
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-[18px]">
              expand_more
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-700 font-black text-xs">
            <button
              type="button"
              onClick={handlePrevBl}
              disabled={!activeBl || matchingBls.findIndex(b => b.id === activeBl.id) <= 0}
              className="hover:bg-zinc-100 p-1.5 rounded-xl border border-zinc-200 transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed text-zinc-700 hover:text-[#005DAA]"
              title="BL Précédent"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="font-mono font-black text-xs whitespace-nowrap px-1 text-zinc-800">
              {activeBl ? `${matchingBls.findIndex(b => b.id === activeBl.id) + 1}` : '0'} 
              <span className="text-zinc-400 mx-1">/</span> 
              {matchingBls.length}
            </span>
            <button
              type="button"
              onClick={handleNextBl}
              disabled={!activeBl || matchingBls.findIndex(b => b.id === activeBl.id) >= matchingBls.length - 1}
              className="hover:bg-zinc-100 p-1.5 rounded-xl border border-zinc-200 transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed text-zinc-700 hover:text-[#005DAA]"
              title="BL Suivant"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          {onNavigateToImport && (
            <button
              type="button"
              onClick={onNavigateToImport}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 rounded-xl flex items-center gap-1.5 font-black text-xs transition-all shadow-2xs shrink-0 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span className="hidden sm:inline">Retour Import</span>
            </button>
          )}
        </div>
      </div>

      {/* Rail Horizontal Élégant des Connaissements (Chips) */}
      <div className="flex overflow-x-auto gap-2.5 pb-2.5 pt-0.5 hide-scrollbar items-center select-none w-full">
        <span className="font-black text-[11px] text-zinc-700 uppercase tracking-widest pl-2 shrink-0 font-mono flex items-center gap-1.5 select-none">
          <span className="material-symbols-outlined text-xs text-[#005DAA]">history</span>
          <span>BLs Récents :</span>
        </span>
        {matchingBls.map(bl => {
          const isCurrent = activeBl?.id === bl.id;
          const blInvs = invoices.filter(i => (i.blId === bl.id || i.numeroBL === bl.numeroBL) && i.statutFacture !== 'ANNULEE');
          const hasInv = blInvs.length > 0;
          const isFullyPaid = hasInv && blInvs.every(i => i.soldeDuFcfa === 0 || i.statutPaiement === 'PAYE');

          let statusDot = 'bg-zinc-400';
          if (hasInv) {
            statusDot = isFullyPaid 
              ? 'bg-emerald-500 ring-2 ring-emerald-200' 
              : 'bg-amber-500 ring-2 ring-amber-200';
          }

          if (isCurrent) {
            return (
              <button
                key={bl.id}
                type="button"
                onClick={() => {
                  setActiveBlId(bl.id);
                  if (onSelectBl) onSelectBl(bl.id);
                }}
                className="shrink-0 min-w-max bg-cyan-50 border-2 border-cyan-600 shadow-sm px-4 py-2 rounded-xl whitespace-nowrap font-black text-xs text-cyan-950 flex items-center gap-2.5 relative overflow-hidden cursor-pointer select-none active:scale-95 transition-all"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-cyan-600" />
                <span className="font-mono font-black tracking-tight whitespace-nowrap pl-1">{bl.numeroBL}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wider ${bl.typeOperation === 'IMPORT' ? 'bg-blue-100 text-blue-800' : 'bg-violet-100 text-violet-800'}`}>
                  {bl.typeOperation === 'IMPORT' ? 'IMP' : 'EXP'}
                </span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
              </button>
            );
          }

          return (
            <button
              key={bl.id}
              type="button"
              onClick={() => {
                setActiveBlId(bl.id);
                if (onSelectBl) onSelectBl(bl.id);
              }}
              className="shrink-0 min-w-max bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 px-4 py-2 rounded-xl whitespace-nowrap font-bold text-xs text-zinc-700 flex items-center gap-2.5 transition-all shadow-2xs cursor-pointer select-none active:scale-95"
            >
              <span className="font-mono whitespace-nowrap">{bl.numeroBL}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wider ${bl.typeOperation === 'IMPORT' ? 'bg-blue-100 text-blue-800' : 'bg-violet-100 text-violet-800'}`}>
                {bl.typeOperation === 'IMPORT' ? 'IMP' : 'EXP'}
              </span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
            </button>
          );
        })}
      </div>

      {/* ─── 2. ESPACE DE TRAVAIL PRINCIPAL DU BL ACTIF ─── */}
      {activeBl ? (
        <div className="flex flex-col lg:flex-row gap-6 items-start mt-4">
          
          {/* ─── COLONNE GAUCHE : DOSSIER MARITIME DU BL (1/3) ─── */}
          <div className="w-full lg:w-1/3 flex flex-col gap-6">
            
            {/* Carte d'Identité Maritime */}
            <div className="ocean-glass-card rounded-2xl p-6 relative overflow-hidden group shadow-2xl">
              <div className="absolute top-0 right-0 p-6 flex flex-col items-end gap-1.5">
                {(() => {
                  const cat = getBlCategory(activeBl);
                  let colorClass = "bg-zinc-100 text-zinc-800 border-zinc-300";
                  if (cat === 'CONTENEUR') colorClass = "bg-blue-50 text-blue-900 border-blue-300 font-black shadow-xs";
                  if (cat === 'VRAC') colorClass = "bg-amber-50 text-amber-900 border-amber-300 font-black shadow-xs";
                  if (cat === 'RORO') colorClass = "bg-emerald-50 text-emerald-900 border-emerald-300 font-black shadow-xs";
                  return (
                    <span className={`px-3 py-1 rounded-lg font-black text-[10px] tracking-widest uppercase border ${colorClass}`}>
                      {cat}
                    </span>
                  );
                })()}
                <span className={`px-2.5 py-0.5 rounded-lg font-black text-[9px] tracking-widest uppercase border ${activeBl.typeOperation === 'IMPORT' ? 'bg-blue-50 text-blue-900 border-blue-300' : 'bg-violet-50 text-violet-900 border-violet-300'}`}>
                  {activeBl.typeOperation}
                </span>
              </div>
              <div className="font-black text-[11px] text-zinc-600 uppercase tracking-widest mb-1.5 font-display">Connaissement Maritime</div>
              <div className="text-xl md:text-2xl text-[#005DAA] font-black mb-2 font-mono tracking-tight">{activeBl.numeroBL}</div>
              <div className="font-bold text-xs text-zinc-500 mb-6 flex items-center gap-1.5 font-mono">
                <span className="material-symbols-outlined text-[14px] text-zinc-400">tag</span>
                <span>ID {activeBl.id}</span>
              </div>

              {/* Ligne Navire & Voyage Épurée */}
              <div className="flex flex-col gap-3 py-4 border-y border-zinc-200 mb-6 bg-zinc-50/50 -mx-6 px-6">
                <div className="flex items-center gap-3 font-bold text-sm text-zinc-950">
                  <div className="w-8 h-8 rounded-xl bg-[#F0F7FF] flex items-center justify-center text-[#005DAA] border border-[#005DAA]/20 shadow-2xs">
                    <span className="material-symbols-outlined text-[18px]">directions_boat</span>
                  </div>
                  <span className="font-black text-zinc-950">{activeEscale?.nomNavire || 'BOCS BREMEN'}</span>
                  <span className="text-zinc-300">|</span>
                  <span className="text-zinc-700 font-black font-mono">V.{activeEscale?.numeroVoyage || '25586'}</span>
                </div>
                <div className="flex items-center gap-3 ml-11 text-xs text-zinc-700 font-bold font-mono">
                  <span>{activeEscale?.portChargement?.split('/')[0]?.trim() || 'ANVERS'}</span> 
                  <span className="material-symbols-outlined text-[16px] text-zinc-400">arrow_forward</span> 
                  <span>{activeEscale?.portDechargement?.split('(')[0]?.trim() || 'ABIDJAN'}</span>
                </div>
              </div>

              {/* Intervenants : Shipper & Consignee */}
              <div className="flex flex-col gap-6 text-xs">
                {/* Shipper */}
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 shadow-2xs">
                  <div className="font-black text-[11px] text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[#005DAA]">flight_takeoff</span>
                    <span>Expéditeur (Shipper)</span>
                  </div>
                  <p className="font-black text-zinc-950 text-sm leading-snug">{activeBl.shipperNom || 'SACOFRINA SA'}</p>
                  {activeBl.shipperAdresse && (
                    <p className="text-xs text-zinc-600 mt-1 leading-relaxed font-medium">
                      {activeBl.shipperAdresse}
                    </p>
                  )}
                </div>

                {/* Consignee */}
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 shadow-2xs">
                  <div className="font-black text-[11px] text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">flight_land</span>
                    <span>Destinataire (Consignee)</span>
                  </div>
                  <p className="font-black text-zinc-950 text-sm leading-snug">{activeBl.consigneeNom || 'SOLIBRA'}</p>
                  {activeBl.consigneeAdresse && (
                    <p className="text-xs text-zinc-600 mt-1 leading-relaxed font-medium">
                      {activeBl.consigneeAdresse}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Métriques & Cargaison (3 Piliers) */}
            <div className="glass-panel rounded-2xl p-6 border border-zinc-200 bg-white shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200 text-center hover:bg-white transition-colors shadow-2xs">
                  <div className="font-black text-[11px] text-zinc-700 uppercase tracking-wider mb-1.5">Poids Brut</div>
                  <div className="text-base font-black text-zinc-950 font-mono">
                    {(activeBl.poidsBrutKg || 0).toLocaleString('fr-FR')}{' '}
                    <span className="text-zinc-600 font-bold text-xs ml-0.5">kg</span>
                  </div>
                </div>
                <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200 text-center hover:bg-white transition-colors shadow-2xs">
                  <div className="font-black text-[11px] text-zinc-700 uppercase tracking-wider mb-1.5">Colis</div>
                  <div className="text-base font-black text-zinc-950 font-mono">
                    {activeBl.nombreColis || 0}{' '}
                    <span className="text-zinc-600 font-bold text-xs ml-0.5">{activeBl.typeEmballage || 'CTR'}</span>
                  </div>
                </div>
                <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200 text-center hover:bg-white transition-colors shadow-2xs">
                  <div className="font-black text-[11px] text-zinc-700 uppercase tracking-wider mb-1.5">Volume</div>
                  <div className="text-base font-black text-zinc-950 font-mono">
                    {activeBl.volumeM3 || 0}{' '}
                    <span className="text-zinc-600 font-bold text-xs ml-0.5">m³</span>
                  </div>
                </div>
              </div>

              {/* Description de la marchandise */}
              {activeBl.descriptionGoods && (
                <div className="mb-6">
                  <div className="font-black text-[11px] text-zinc-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[#005DAA]">inventory_2</span>
                    <span>Marchandise Déclarée</span>
                  </div>
                  <p className="text-xs text-zinc-950 font-bold leading-relaxed bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
                    {activeBl.descriptionGoods}
                  </p>
                </div>
              )}

              {/* Conteneurs associés */}
              {activeBl.conteneurs && activeBl.conteneurs.length > 0 && (
                <div>
                  <div className="font-black text-[11px] text-zinc-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[#005DAA]">view_in_ar</span>
                    <span>Conteneurs Rattachés ({activeBl.conteneurs.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeBl.conteneurs.map((c, idx) => (
                      <span 
                        key={c.id || idx}
                        className="inline-flex items-center gap-2 bg-zinc-50 border border-zinc-300 px-3.5 py-2 rounded-xl text-xs text-zinc-950 shadow-2xs font-mono font-black"
                      >
                        <span>{c.numeroConteneur}</span>
                        <span className="text-zinc-300">|</span>
                        <span className="text-zinc-600 font-bold">{c.typeConteneur}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ─── COLONNE DROITE : FACTURES & PRESTATIONS DU BL (2/3) ─── */}
          <div className="w-full lg:w-2/3 flex flex-col gap-6">
            
            {/* Barre de Synthèse Financière du BL Actif */}
            <div className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white border border-zinc-200 shadow-xs">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#005DAA] mb-1 font-display tracking-tight">Factures &amp; Prestations</h2>
                    <p className="text-xs text-zinc-500">Émission et suivi des règlements pour ce connaissement.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const isDmdt = (name: string) => {
                        const n = (name || '').toLowerCase();
                        return n.includes('surestarie') || n.includes('suréstarie') || n.includes('detention') || n.includes('détention');
                      };
                      const currentIds = activeTypeConfigs
                        .filter(tc => !isDmdt(tc.name))
                        .map(tc => tc.id);
                      const defaultIds = getDefaultTypeIdsForBl(activeBl).filter(id => {
                        const tc = invoiceTypeConfigs.find(t => t.id === id);
                        return tc ? !isDmdt(tc.name) : true;
                      });
                      setTempSelectedTypeIds(currentIds.length > 0 ? currentIds : defaultIds);
                      setShowInvoiceSelectionModal(true);
                    }}
                    className="ml-2 px-3 py-1.5 bg-[#F0F7FF] hover:bg-[#E1EFFF] text-[#005DAA] border border-[#005DAA]/30 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs shrink-0"
                    title="Personnaliser les types de factures applicables à ce connaissement"
                  >
                    <span className="material-symbols-outlined text-sm text-[#005DAA]">tune</span>
                    <span>Sélectionner factures</span>
                  </button>
                </div>
              </div>

              {/* Total Financier du BL */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 text-right bg-zinc-50 p-5 rounded-2xl border border-zinc-200 shadow-2xs">
                <div>
                  <span className="font-black text-[11px] text-zinc-600 uppercase tracking-wider mb-1 block font-mono">Total BL</span>
                  <span className="text-2xl md:text-3xl text-zinc-950 font-black tracking-tight font-mono">
                    {blInvoices.reduce((sum, inv) => sum + (inv.montantTtcFcfa || 0), 0).toLocaleString('fr-FR')}{' '}
                    <span className="text-xs font-bold text-zinc-500 ml-0.5">FCFA</span>
                  </span>
                </div>
                <div className="w-px bg-zinc-200 my-1 hidden sm:block"></div>
                <div>
                  <span className="font-black text-[11px] text-rose-600 uppercase tracking-wider mb-1 flex items-center justify-end gap-1 font-mono">
                    <span className="material-symbols-outlined text-[15px]">warning</span> Solde Dû
                  </span>
                  <span className="text-2xl md:text-3xl text-rose-600 font-black tracking-tight font-mono">
                    {blInvoices.reduce((sum, inv) => sum + (inv.soldeDuFcfa || 0), 0).toLocaleString('fr-FR')}{' '}
                    <span className="text-xs font-bold text-rose-400 ml-0.5">FCFA</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Indicateur de catégorie de fret et règle de facturation par défaut */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
              <span className="font-bold flex items-center gap-1.5 text-zinc-700">
                <span className="material-symbols-outlined text-sm text-[#005DAA]">category</span>
                <span>Type de fret : <strong className="text-zinc-950 font-black">{getBlCategory(activeBl)}</strong></span>
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/20">
                {isExportBl(activeBl) 
                  ? 'Facturation par défaut : Échange' 
                  : getBlCategory(activeBl) === 'CONTENEUR' 
                    ? 'Facturation par défaut : Caution, Échange et Transfert' 
                    : 'Facturation par défaut : Échange'}
              </span>
            </div>

            {/* Liste des Cartes de Prestations Applicables avec Ascenseur (Scrollbar) */}
            <div className="max-h-[580px] overflow-y-auto pr-1.5 space-y-3 bocs-scrollbar">
              {activeTypeConfigs.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-dashed border-zinc-300 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-sm text-zinc-800">Aucune facture sélectionnée</h4>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto font-medium">
                    Toutes les prestations ont été retirées pour ce connaissement. Cliquez sur le bouton "Sélectionner des factures" ci-dessous pour en associer de nouvelles.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const defaultIds = getDefaultTypeIdsForBl(activeBl);
                      setTempSelectedTypeIds(defaultIds);
                      setShowInvoiceSelectionModal(true);
                    }}
                    className="px-4 py-2 bg-[#005DAA] hover:bg-[#004580] text-white rounded-xl text-xs font-black inline-flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>Sélectionner des factures</span>
                  </button>
                </div>
              ) : (
                activeTypeConfigs.map(typeConfig => {
                  const isCaution = typeConfig.name.toLowerCase().includes('caution');
                  const isTransfert = typeConfig.name.toLowerCase().includes('transfert');
                  const isSurestarieOrDetention = 
                    typeConfig.name.toLowerCase().includes('surestarie') || 
                    typeConfig.name.toLowerCase().includes('detention') || 
                    typeConfig.name.toLowerCase().includes('détention');

                  const prefix = getInvoiceTypePrefix(typeConfig.name);
                  const existingInvoice = blInvoices.find(inv => 
                    inv.invoiceTypeId === typeConfig.id ||
                    (inv.numeroFacture && inv.numeroFacture.includes(prefix)) ||
                    (inv.typeFacture && inv.typeFacture.toLowerCase().includes(typeConfig.name.toLowerCase()))
                  );

                  const isProforma = existingInvoice && !(existingInvoice.numeroFacture || '').startsWith('FA-') && existingInvoice.statutFacture !== 'VALIDEE';
                  const isValidated = existingInvoice && (existingInvoice.statutFacture === 'VALIDEE' || (existingInvoice.numeroFacture || '').startsWith('FA-'));
                  const isPaid = existingInvoice && (existingInvoice.soldeDuFcfa === 0 || existingInvoice.statutPaiement === 'PAYE');

                  const calcKey = `${activeBl.id}-${typeConfig.id}`;
                  const hasValidatedCalc = validatedCalculations[calcKey] !== undefined;

                  // Color accent and icon per category
                  let categoryIcon = 'receipt';
                  let accentColor = 'bg-[#005DAA]';
                  let iconBadgeClass = 'bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/20';
                  if (isCaution) {
                    categoryIcon = 'shield';
                    accentColor = 'bg-emerald-600';
                    iconBadgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                  } else if (isSurestarieOrDetention) {
                    categoryIcon = 'schedule';
                    accentColor = 'bg-amber-500';
                    iconBadgeClass = 'bg-amber-50 text-amber-700 border border-amber-200';
                  } else if (typeConfig.name.toLowerCase().includes('echange')) {
                    categoryIcon = 'sync_alt';
                    accentColor = 'bg-sky-600';
                    iconBadgeClass = 'bg-sky-50 text-sky-700 border border-sky-200';
                  } else if (isTransfert) {
                    categoryIcon = 'local_shipping';
                    accentColor = 'bg-indigo-600';
                    iconBadgeClass = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
                  }

                  return (
                    <div 
                      key={typeConfig.id}
                      className="bg-white rounded-2xl p-4 sm:p-4.5 border border-zinc-200 shadow-xs relative overflow-hidden group hover:shadow-md transition-all duration-200 space-y-3"
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentColor}`} />
                      
                      {/* Header Row of Item: Name + Action Buttons + Status Badge + Retirer Button */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2.5 border-b border-zinc-100">
                        <div className="flex items-center gap-3 flex-wrap min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-2xs shrink-0 ${iconBadgeClass}`}>
                            <span className="material-symbols-outlined text-[20px]">{categoryIcon}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div>
                              <div className="font-black text-base text-zinc-950 leading-tight">{typeConfig.name}</div>
                              {typeConfig.description && (
                                <div className="font-medium text-[11px] text-zinc-500 mt-0.5">{typeConfig.description}</div>
                              )}
                            </div>

                            {/* Boutons d'Action à la suite directe du nom de la facture */}
                            <div className="flex items-center gap-2 flex-wrap pl-1 sm:pl-2">
                              {/* DMDT Calculator Trigger */}
                              {isSurestarieOrDetention && (
                                <button
                                  type="button"
                                  onClick={() => setCalculationModalData({ bl: activeBl, typeConfig })}
                                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-black text-amber-900 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                >
                                  <Calculator className="w-3.5 h-3.5" />
                                  <span>{hasValidatedCalc ? 'Modifier Calcul DMDT' : 'Calculateur DMDT'}</span>
                                </button>
                              )}

                              {/* Émettre Proforma (uniquement si non encore émise) */}
                              {!existingInvoice && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (userRole === 'AGENT_IMPORT' || userRole === 'AGENT_EXPORT') {
                                      setPrintPreviewData({ bl: activeBl, typeConfig, existingInvoice });
                                    } else {
                                      handleGenerateProformaForType(activeBl, typeConfig, existingInvoice);
                                    }
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs bg-[#005DAA] hover:bg-[#004580] text-white"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Émettre Proforma</span>
                                </button>
                              )}

                              {/* Imprimer PDF (si facture existante) */}
                              {existingInvoice && (
                                <button
                                  type="button"
                                  onClick={() => generateProformaPdf(existingInvoice, activeBl)}
                                  className="px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-black text-zinc-800 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                  title="Imprimer le PDF"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>PDF</span>
                                </button>
                              )}

                              {/* Valider Facture FA- (Admin/Comptables) */}
                              {existingInvoice && isProforma && onValidateInvoice && (userRole !== 'AGENT_IMPORT' && userRole !== 'AGENT_EXPORT') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onValidateInvoice(existingInvoice.id);
                                    toastSuccess(`Facture validée sous le numéro officiel.`);
                                  }}
                                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Valider</span>
                                </button>
                              )}

                              {/* Enregistrer Règlement (Admin/Comptables) */}
                              {existingInvoice && existingInvoice.soldeDuFcfa > 0 && (userRole !== 'AGENT_IMPORT' && userRole !== 'AGENT_EXPORT') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaymentFacture(existingInvoice);
                                    setPaymentMontant(existingInvoice.soldeDuFcfa);
                                    setShowPaymentModal(true);
                                  }}
                                  className="px-4 py-1.5 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>Règlement</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge & Bouton Retirer / Supprimer Proforma */}
                        <div className="shrink-0 flex items-center gap-2 self-start lg:self-center">
                          {!existingInvoice ? (
                            <span className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-2 select-none shadow-2xs">
                              <span className="w-2 h-2 rounded-full bg-zinc-400" />
                              <span>À émettre</span>
                            </span>
                          ) : isPaid ? (
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 select-none shadow-2xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Soldée / Payée</span>
                            </span>
                          ) : isValidated ? (
                            <span className="bg-blue-50 text-blue-800 border border-blue-300 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 select-none shadow-2xs">
                              <ShieldCheck className="w-4 h-4 text-blue-600" />
                              <span>Facture Validée</span>
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-900 border border-amber-300 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 select-none shadow-2xs">
                              <Clock className="w-4 h-4 text-amber-600" />
                              <span>Attente Règlt</span>
                            </span>
                          )}

                          {/* Bouton Retirer / Supprimer (uniquement l'icône de la corbeille) */}
                          {(!existingInvoice || isProforma) ? (
                            <button
                              type="button"
                              onClick={() => handleRemovePrestation(typeConfig, existingInvoice)}
                              className={`p-2 rounded-xl border transition-all cursor-pointer shadow-2xs flex items-center justify-center shrink-0 group/del ${
                                existingInvoice 
                                  ? 'text-rose-600 bg-rose-50/70 hover:bg-rose-100 border-rose-200 hover:border-rose-300' 
                                  : 'text-zinc-400 hover:text-rose-600 bg-zinc-50 hover:bg-rose-50 border-zinc-200 hover:border-rose-300'
                              }`}
                              title={existingInvoice ? `Supprimer la proforma ${existingInvoice.numeroFacture} et retirer du BL` : `Retirer ${typeConfig.name} de ce BL`}
                            >
                              <Trash2 className="w-4 h-4 group-hover/del:scale-110 transition-transform" />
                            </button>
                          ) : (
                            <span
                              className="px-3 py-1.5 rounded-xl text-zinc-400 bg-zinc-50 border border-zinc-200 flex items-center gap-1.5 shadow-2xs select-none cursor-not-allowed text-[11px] font-bold"
                              title="Facture validée ou réglée : suppression directe verrouillée (utiliser un avoir)"
                            >
                              <Lock className="w-3.5 h-3.5 text-zinc-400" />
                              <span className="hidden sm:inline">Verrouillée</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details Row of Item */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-1 text-xs items-center">
                        <div>
                          <div className="font-black text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5 font-mono">N° FACTURE</div>
                          <div className={`font-mono font-black text-xs inline-block px-2.5 py-1 rounded-lg border ${
                            existingInvoice 
                              ? 'text-zinc-950 bg-zinc-100 border-zinc-300' 
                              : 'text-zinc-500 bg-zinc-50 border-zinc-200'
                          }`}>
                            {existingInvoice ? existingInvoice.numeroFacture : 'NON ÉMISE'}
                          </div>
                        </div>
                        <div>
                          <div className="font-black text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5 font-mono">MONTANT TTC</div>
                          <div className="text-base sm:text-lg text-zinc-950 font-black font-mono tracking-tight leading-none">
                            {existingInvoice ? existingInvoice.montantTtcFcfa.toLocaleString('fr-FR') : '0'}{' '}
                            <span className="font-bold text-xs text-zinc-500 ml-0.5">FCFA</span>
                          </div>
                        </div>
                        <div>
                          <div className={`font-black text-[10px] uppercase tracking-wider mb-0.5 font-mono ${existingInvoice && existingInvoice.soldeDuFcfa > 0 ? 'text-rose-600' : 'text-zinc-500'}`}>
                            SOLDE DÛ
                          </div>
                          <div className={`text-base sm:text-lg font-black font-mono tracking-tight leading-none ${existingInvoice && existingInvoice.soldeDuFcfa > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {existingInvoice ? existingInvoice.soldeDuFcfa.toLocaleString('fr-FR') : '0'}{' '}
                            <span className="font-bold text-xs ml-0.5 opacity-80">FCFA</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* BL export : impression du connaissement original — BL import : Bon à Délivrer (BAD) */}
            {isExportBl(activeBl) ? (
              <div className="bg-white rounded-2xl p-6 mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-zinc-200 shadow-xs">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-2xs ${
                    hasTelexPrestation
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-[#F0F7FF] text-[#005DAA] border-[#005DAA]/20'
                  }`}>
                    <span className="material-symbols-outlined text-[24px]">{hasTelexPrestation ? 'verified' : 'description'}</span>
                  </div>
                  <div>
                    <div className="font-black text-base text-[#005DAA]">
                      {hasTelexPrestation ? 'Non Négociable (BL)' : 'Connaissement Original (BL)'}
                    </div>
                    <div className="text-xs text-zinc-600 font-medium mt-0.5">
                      {hasTelexPrestation
                        ? 'Telex émis — le connaissement original n\'est plus négociable'
                        : 'Édition du connaissement export sur papier à en-tête BOCS'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePrintBl}
                  className="px-6 py-3 rounded-xl flex items-center gap-2 font-black text-xs transition-all active:scale-95 border bg-[#005DAA] hover:bg-[#004580] text-white border-transparent cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[20px]">print</span>
                  <span>Imprimer BL</span>
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-zinc-200 shadow-xs">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-2xs ${
                    isBadDeliverable 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                  }`}>
                    <span className="material-symbols-outlined text-[24px]">{isBadDeliverable ? 'lock_open' : 'lock'}</span>
                  </div>
                  <div>
                    <div className="font-black text-base text-[#005DAA]">Bon à Délivrer (BAD)</div>
                    <div className="text-xs text-zinc-600 font-medium mt-0.5">
                      {isBadDeliverable ? 'Toutes les factures sont soldées' : 'Verrouillé jusqu\'au règlement intégral'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePrintBad}
                  disabled={!isBadDeliverable}
                  className={`px-6 py-3 rounded-xl flex items-center gap-2 font-black text-xs transition-all active:scale-95 border ${
                    isBadDeliverable 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent cursor-pointer shadow-sm' 
                      : 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed select-none'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">print</span>
                  <span>Imprimer BAD</span>
                </button>
              </div>
            )}

          </div>

        </div>
      ) : (
        /* État Vide */
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Aucun connaissement trouvé
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Veuillez ajuster votre recherche par N° BL ou expéditeur.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="px-3.5 py-2 bg-[#005daa] text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>
        </div>
      )}

      {/* ─── MODAL : SÉLECTION DES TYPES DE FACTURES ─── */}
      {showInvoiceSelectionModal && activeBl && (
        <div
          onClick={overlayClickClose(() => setShowInvoiceSelectionModal(false))}
          className="fixed inset-0 z-[100005] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
        >
          <div
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-zinc-200 overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#005DAA]/10 border border-[#005DAA]/25 flex items-center justify-center text-[#005DAA]">
                  <span className="material-symbols-outlined text-xl">playlist_add_check</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-[#005DAA]">Types de Factures à Émettre</h3>
                  <p className="text-[11px] text-zinc-500 font-mono font-bold mt-0.5">{activeBl.numeroBL}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceSelectionModal(false)}
                className="w-9 h-9 rounded-xl hover:bg-zinc-200 text-zinc-400 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-2 max-h-[55vh] overflow-y-auto">
              <p className="text-xs text-zinc-500 font-medium pb-2">Cochez les factures à émettre pour ce BL. Les types non cochés ne seront pas proposés.</p>
              {invoiceTypeConfigs
                .filter(tc => {
                  const n = (tc.name || '').toLowerCase();
                  const isSurestarie = n.includes('surestarie') || n.includes('suréstarie');
                  const isDetention = n.includes('detention') || n.includes('détention');
                  return !isSurestarie && !isDetention;
                })
                .map(tc => {
                const isChecked = tempSelectedTypeIds.includes(tc.id);
                return (
                  <label
                    key={tc.id}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-[#F0F7FF] border-[#005DAA]/40 shadow-xs'
                        : 'bg-white border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-[#005DAA] rounded cursor-pointer"
                      checked={isChecked}
                      onChange={() => {
                        setTempSelectedTypeIds(prev =>
                          prev.includes(tc.id) ? prev.filter(id => id !== tc.id) : [...prev, tc.id]
                        );
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-black truncate ${ isChecked ? 'text-[#005DAA]' : 'text-zinc-900' }`}>{tc.name}</p>
                      {tc.description && <p className="text-[10px] text-zinc-400 font-medium mt-0.5 truncate">{tc.description}</p>}
                    </div>
                    {isChecked && <span className="material-symbols-outlined text-base text-[#005DAA] shrink-0">check_circle</span>}
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-zinc-100 bg-zinc-50/80 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowInvoiceSelectionModal(false)}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const isDmdt = (name: string) => {
                      const n = (name || '').toLowerCase();
                      return n.includes('surestarie') || n.includes('suréstarie') || n.includes('detention') || n.includes('détention');
                    };
                    const defaultIds = getDefaultTypeIdsForBl(activeBl).filter(id => {
                      const tc = invoiceTypeConfigs.find(t => t.id === id);
                      return tc ? !isDmdt(tc.name) : true;
                    });
                    setTempSelectedTypeIds(defaultIds);
                    toastSuccess('Prestations réinitialisées aux valeurs par défaut.');
                  }}
                  className="px-3.5 py-2.5 rounded-xl border border-[#005DAA]/30 bg-[#F0F7FF] text-xs font-bold text-[#005DAA] hover:bg-[#E1EFFF] transition-all cursor-pointer"
                  title="Appliquer les factures par défaut (Export: Échange | Import Conteneurs: Caution, Échange, Transfert | Import Vrac/Roro/Conv: Échange)"
                >
                  Rétablir par défaut
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTempSelectedTypeIds([]);
                    setPlannedInvoicesByBl(prev => ({ ...prev, [activeBl.id]: [] }));
                    setShowInvoiceSelectionModal(false);
                    toastSuccess('Sélection effacée.');
                  }}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-all cursor-pointer"
                >
                  Tout décocher
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlannedInvoicesByBl(prev => ({ ...prev, [activeBl.id]: tempSelectedTypeIds }));
                    setExcludedTypeIdsByBl(prev => {
                      const currentExcluded = prev[activeBl.id] || [];
                      return {
                        ...prev,
                        [activeBl.id]: currentExcluded.filter(id => !tempSelectedTypeIds.includes(id))
                      };
                    });
                    setShowInvoiceSelectionModal(false);
                    toastSuccess(`${tempSelectedTypeIds.length} type(s) de facture associé(s) au BL ${activeBl.numeroBL}.`);
                  }}
                  className="px-6 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  Confirmer ({tempSelectedTypeIds.length} sélectionnée{tempSelectedTypeIds.length > 1 ? 's' : ''})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && paymentFacture && (
        <div onClick={overlayClickClose(() => setShowPaymentModal(false))} className="fixed inset-0 z-[100005] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <DollarSign className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Enregistrer un Règlement</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Facture :</span>
                  <span className="font-bold text-slate-900 font-mono">{paymentFacture.numeroFacture}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Client :</span>
                  <span className="font-bold text-slate-900">{paymentFacture.clientNom}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="text-slate-500">Solde Restant :</span>
                  <span className="font-black text-rose-600 font-mono">{paymentFacture.soldeDuFcfa.toLocaleString()} FCFA</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Montant encaissé (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={paymentFacture.soldeDuFcfa}
                  value={paymentMontant}
                  onChange={e => setPaymentMontant(Number(e.target.value))}
                  className="w-full h-11 px-3.5 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mode de Règlement *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as any)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="VIREMENT">Virement bancaire</option>
                    <option value="CHEQUE">Chèque certifié</option>
                    <option value="ESPECES">Espèces / Caisse</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Référence / N° Chèque
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    placeholder="Ex: VIR-84920"
                    className="w-full h-10 px-3 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98 mt-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Valider le Règlement</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL: DMDT SURESTARIE DEGRESSIVE CALCULATION */}
      {calculationModalData && (
        <div onClick={overlayClickClose(() => setCalculationModalData(null))} className="fixed inset-0 z-[100005] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Calculator className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Calcul Dégressif — {calculationModalData.typeConfig.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Connaissement : <span className="font-mono font-bold text-slate-900">{calculationModalData.bl.numeroBL}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalculationModalData(null)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Container calculation rows */}
            <div className="space-y-4">
              {modalRows.map((row, idx) => {
                const startD = new Date(row.dateAccostage);
                const endD = new Date(row.dateLivraison);
                const stayDays = Math.max(0, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                const billableDays = Math.max(0, stayDays - Number(row.franchise));
                const { totalAmount, breakdown } = calculateDegressiveAmount(row.typeConteneur, stayDays, Number(row.franchise), row.dateAccostage);

                return (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-sm">{row.numeroConteneur}</span>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">
                          {row.typeConteneur}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase block">Total Conteneur</span>
                        <span className="text-sm font-black text-purple-700 font-mono">
                          {totalAmount.toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Date Entrée Parc / Accostage
                        </label>
                        <input
                          type="date"
                          value={row.dateAccostage}
                          onChange={e => {
                            const val = e.target.value;
                            setModalRows(prev => prev.map((r, i) => i === idx ? { ...r, dateAccostage: val } : r));
                          }}
                          className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Date Sortie / Livraison
                        </label>
                        <input
                          type="date"
                          value={row.dateLivraison}
                          onChange={e => {
                            const val = e.target.value;
                            setModalRows(prev => prev.map((r, i) => i === idx ? { ...r, dateLivraison: val } : r));
                          }}
                          className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Franchise (Jours gratuits)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={row.franchise}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setModalRows(prev => prev.map((r, i) => i === idx ? { ...r, franchise: val } : r));
                          }}
                          className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    {/* Breakdown summary */}
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>Séjour total : {stayDays} jour(s) • Franchise : {row.franchise} j</span>
                        <span className="text-purple-700 font-bold">Jours facturables : {billableDays} j</span>
                      </div>
                      {breakdown.length > 0 && (
                        <div className="pt-1 border-t border-slate-100 space-y-0.5">
                          {breakdown.map((b, bIdx) => (
                            <div key={bIdx} className="flex justify-between text-[10px] text-slate-500 font-mono">
                              <span>• {b.label} ({b.days} j x {b.rate.toLocaleString()} FCFA)</span>
                              <span className="font-bold text-slate-700">{b.amount.toLocaleString()} FCFA</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Validation footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs">
                <span className="text-slate-400 uppercase font-bold block text-[10px]">Total Général DMDT</span>
                <span className="text-lg font-black text-purple-700 font-mono">
                  {modalRows.reduce((sum, r) => {
                    const s = Math.max(0, Math.ceil((new Date(r.dateLivraison).getTime() - new Date(r.dateAccostage).getTime()) / (1000 * 60 * 60 * 24)) + 1);
                    return sum + calculateDegressiveAmount(r.typeConteneur, s, Number(r.franchise), r.dateAccostage).totalAmount;
                  }, 0).toLocaleString('fr-FR')} FCFA
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalculationModalData(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const calcKey = `${calculationModalData.bl.id}-${calculationModalData.typeConfig.id}`;
                    const details = modalRows.map(r => {
                      const s = Math.max(0, Math.ceil((new Date(r.dateLivraison).getTime() - new Date(r.dateAccostage).getTime()) / (1000 * 60 * 60 * 24)) + 1);
                      const { totalAmount, breakdown } = calculateDegressiveAmount(r.typeConteneur, s, Number(r.franchise), r.dateAccostage);
                      return {
                        containerId: r.containerId,
                        numeroConteneur: r.numeroConteneur,
                        typeConteneur: r.typeConteneur,
                        dateAccostage: r.dateAccostage,
                        dateLivraison: r.dateLivraison,
                        stayDays: s,
                        franchise: r.franchise,
                        billableDays: Math.max(0, s - r.franchise),
                        montant: totalAmount,
                        breakdown
                      };
                    });
                    const grandTotal = details.reduce((sum, d) => sum + d.montant, 0);
                    
                    setValidatedCalculations(prev => ({
                      ...prev,
                      [calcKey]: { total: grandTotal, details }
                    }));

                    toastSuccess('Calculs dégressifs validés et enregistrés pour ce BL !');
                    setCalculationModalData(null);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
                >
                  Valider les Calculs
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CUSTOM PRINT PREVIEW DIALOG MODAL (CHROME DESIGN SIMULATION) */}
      {printPreviewData && (
        <div onClick={overlayClickClose(() => setPrintPreviewData(null))} className="fixed inset-0 z-[100005] flex items-center justify-center p-0 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none">
          <div className="w-full h-full flex flex-row overflow-hidden bg-slate-900">
            
            {/* Left Column: Live PDF Document Preview */}
            <div className="flex-1 overflow-y-auto p-8 flex items-start justify-center bg-slate-800/80 bocs-scrollbar">
              <div className="bg-white text-black p-10 shadow-2xl rounded-sm w-[210mm] min-h-[297mm] flex flex-col justify-between text-xs font-sans border border-slate-300 relative my-4">
                
                {/* Document Header */}
                <div>
                  <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                    <div className="flex flex-col">
                      <div className="text-[#209641] font-black text-4xl italic tracking-tight font-sans">BOCS</div>
                      <div className="bg-[#051424] text-white font-extrabold px-3 py-1 text-[10px] tracking-wider uppercase mt-1 self-start rounded-xs">ABIDJAN</div>
                    </div>
                    <div className="text-right text-[9px] text-slate-500 font-mono">
                      <div>{new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="font-bold text-slate-700">PROFORMA - {printPreviewData.typeConfig.name.toUpperCase()}</div>
                    </div>
                  </div>

                  {/* Document Title & Number */}
                  {(() => {
                    const invoice = calculateProformaData(printPreviewData.bl, printPreviewData.typeConfig, printPreviewData.existingInvoice);
                    return (
                      <div className="my-6 flex justify-between items-center">
                        <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
                          PROFORMA N° : <span className="font-mono text-[#005daa] font-black">{invoice.numeroFacture}</span>
                        </h2>
                        <div className="text-right">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Date de Facturation</span>
                          <span className="font-mono font-bold text-slate-800">{invoice.dateFacture}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Expedition Details & Client Block */}
                  {(() => {
                    const escale = escales.find(e => e.id === printPreviewData.bl.escaleId);
                    const blNavire = escale?.nomNavire || 'BOCS BREMEN';
                    const blVoy = escale?.numeroVoyage || '25586';
                    const blPolPod = `${printPreviewData.bl.portChargementCode || 'BEANR'} / ${printPreviewData.bl.portDechargementCode || 'CIABJ'}`;
                    const blPoids = printPreviewData.bl.poidsBrutKg ? printPreviewData.bl.poidsBrutKg.toLocaleString('fr-FR') : 'NC';
                    const blVol = printPreviewData.bl.volumeM3 ? `${printPreviewData.bl.volumeM3} m³` : 'NC';
                    const blColis = printPreviewData.bl.nombreColis || 0;

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 text-[10px] leading-relaxed">
                        {/* Detail d'expedition */}
                        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                          <span className="font-bold text-[#209641] uppercase text-[9px] block mb-2 border-b border-slate-200 pb-1">Détail d'Expédition</span>
                          <div className="space-y-1 font-medium text-slate-700">
                            <p><strong className="text-slate-500 font-bold">Navire :</strong> {blNavire}</p>
                            <p><strong className="text-slate-500 font-bold">Voyage :</strong> {blVoy}</p>
                            <p><strong className="text-slate-500 font-bold">Pol/Pod :</strong> {blPolPod}</p>
                            <p><strong className="text-slate-500 font-bold">B/L N° :</strong> <span className="font-mono text-slate-900 font-bold">{printPreviewData.bl.numeroBL}</span></p>
                            <p><strong className="text-slate-500 font-bold">Poids (Kgs) :</strong> {blPoids}</p>
                            <p><strong className="text-slate-500 font-bold">Volume (M3) :</strong> {blVol}</p>
                            <p><strong className="text-slate-500 font-bold">Nbre Colis :</strong> {blColis}</p>
                          </div>
                        </div>

                        {/* Client / Compte */}
                        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                          <span className="font-bold text-[#209641] uppercase text-[9px] block mb-2 border-b border-slate-200 pb-1">Client / Compte</span>
                          <div className="space-y-1 font-medium text-slate-700">
                            <p><strong className="text-slate-500 font-bold">Dénomination :</strong> {printPreviewData.bl.consigneeNom || 'SOLIBRA'}</p>
                            <p><strong className="text-slate-500 font-bold">Compte Contribuable :</strong> 9817454X</p>
                            <p><strong className="text-slate-500 font-bold">Adresse :</strong> {printPreviewData.bl.consigneeAdresse || '01 BP 1304 ABIDJAN 01 REP DE COTE D\'IVOIRE'}</p>
                            <p><strong className="text-slate-500 font-bold">Contact :</strong> {'transit@solibra.ci'} / 27-21-24-20-58</p>
                            <p><strong className="text-slate-500 font-bold">Transitaire :</strong> {printPreviewData.bl.consigneeNom || 'SOLIBRA'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Cargo & Container Description */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 my-6 text-[10px] leading-normal">
                    <span className="font-bold text-[#209641] uppercase text-[9px] block mb-1.5 border-b border-slate-200 pb-0.5">Détails Marchandises / Conteneurs</span>
                    <p className="font-bold text-slate-800 text-[10px] uppercase">
                      {printPreviewData.bl.descriptionGoods || 'MARCHANDISES DIVERSES EN VRAC'}
                    </p>
                    {printPreviewData.bl.conteneurs && printPreviewData.bl.conteneurs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 font-mono">
                        {printPreviewData.bl.conteneurs.map((c, idx) => (
                          <span key={idx} className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[9px] font-semibold text-slate-700">
                            {c.typeConteneur} N° {c.numeroConteneur} (Plomb: {c.numeroScelle})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lines Table */}
                  <table className="w-full text-left text-[10px] border-collapse border border-slate-200 rounded-lg overflow-hidden my-6">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[9px]">
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5 text-right w-16">Qté</th>
                        <th className="p-2.5 text-right w-24">PU (CFA)</th>
                        <th className="p-2.5 text-right w-28">Total HT</th>
                        <th className="p-2.5 text-right w-24">TVA (18%)</th>
                        <th className="p-2.5 text-right w-28">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                      {calculateProformaData(printPreviewData.bl, printPreviewData.typeConfig, printPreviewData.existingInvoice).lignes?.map((l: any, idx: number) => {
                        const tva = Math.round(l.montantHtFcfa * 0.18);
                        const ttc = l.montantHtFcfa + tva;
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900">{l.designation}</td>
                            <td className="p-2.5 text-right font-mono">{l.quantite}</td>
                            <td className="p-2.5 text-right font-mono">{l.prixUnitaireFcfa?.toLocaleString()} CFA</td>
                            <td className="p-2.5 text-right font-mono">{l.montantHtFcfa?.toLocaleString()} CFA</td>
                            <td className="p-2.5 text-right font-mono">{tva.toLocaleString()} CFA</td>
                            <td className="p-2.5 text-right font-mono font-bold text-[#005daa]">{ttc.toLocaleString()} CFA</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer and Totals */}
                <div className="border-t border-slate-200 pt-6">
                  <div className="flex justify-between items-start">
                    <div className="max-w-md text-[9px] text-slate-400 leading-relaxed italic font-medium">
                      NB : La présente pro-forma est une estimation établie sur la base des informations existantes au moment de son établissement. Elle ne peut, en aucun cas, se substituer à la facture définitive qui sera établie au moment du paiement.
                    </div>
                    <div className="w-72 space-y-1 text-[11px] text-right font-medium">
                      {(() => {
                        const invoice = calculateProformaData(printPreviewData.bl, printPreviewData.typeConfig, printPreviewData.existingInvoice);
                        // Taxe additionnelle (assiette TTC) puis timbre fiscal d'État (assiette HT) — aperçu avant émission
                        const taxe = computeTaxeAdditionnelle(taxeAdditionnelleConfig, invoice.montantTtcFcfa, invoice.typeFacture);
                        const ttcHorsTaxe = taxe.baseTtcFcfa;
                        const timbreFiscal = computeTimbreFiscal(timbreBrackets, invoice.montantHtFcfa);
                        const netAPayer = ttcHorsTaxe + taxe.montantFcfa + timbreFiscal;
                        return (
                          <>
                            <div className="flex justify-between text-slate-500">
                              <span>Total HT :</span>
                              <span className="font-mono text-slate-800">{invoice.montantHtFcfa?.toLocaleString()} CFA</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>TVA (18%) :</span>
                              <span className="font-mono text-slate-800">{invoice.tvaFcfa?.toLocaleString()} CFA</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>AIRSI (0.5%) :</span>
                              <span className="font-mono text-slate-800">0 CFA</span>
                            </div>
                            {taxe.appliquee && (
                              <div className="flex justify-between text-amber-700">
                                <span>{taxe.libelle} ({getTaxeAdditionnelleValeurLabel(taxe.mode, taxe.valeur)}) :</span>
                                <span className="font-mono font-bold">{taxe.montantFcfa.toLocaleString()} CFA</span>
                              </div>
                            )}
                            {timbreFiscal > 0 && (
                              <div className="flex justify-between text-emerald-700">
                                <span>Timbre fiscal d'État :</span>
                                <span className="font-mono font-bold">{timbreFiscal.toLocaleString()} CFA</span>
                              </div>
                            )}
                            <div className="flex justify-between font-black text-slate-900 border-t border-slate-200 pt-1 text-xs uppercase tracking-tight">
                              <span>Total TTC :</span>
                              <span className="font-mono">{ttcHorsTaxe.toLocaleString()} CFA</span>
                            </div>
                            <div className="flex justify-between font-black text-slate-950 text-sm border-t border-double border-slate-400 pt-1">
                              <span>Net à payer :</span>
                              <span className="font-mono text-[#005daa]">{netAPayer.toLocaleString()} CFA</span>
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold font-mono">
                              Equivalent : {(netAPayer / 655.957).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} EUR
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-medium">
                    <div className="flex items-center gap-4">
                      <div className="font-bold text-slate-700">BOCS ABIDJAN S.A.R.L.</div>
                      <div>Compte Bancaire : BICICI CI006 01760</div>
                    </div>
                    <div className="font-mono">Page 1/1</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Print Control Settings Sidebar */}
            <div className="w-80 bg-[#1e1e1e] text-neutral-300 p-6 flex flex-col justify-between border-l border-neutral-800 shrink-0">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Imprimer</h3>
                  <p className="text-xs text-neutral-500 font-bold">1 feuille de papier</p>
                </div>

                <div className="space-y-4">
                  {/* Mode de règlement (le timbre fiscal d'État s'applique quel que soit le mode) */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500">Mode de règlement</label>
                    <select
                      value={printReglement}
                      onChange={e => setPrintReglement(e.target.value as (typeof MODES_REGLEMENT)[number])}
                      className="w-full bg-[#2a2a2a] border border-neutral-700 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {MODES_REGLEMENT.map(m => (
                        <option key={m} value={m}>{getModeReglementLabel(m)}</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-neutral-500 font-bold">Le timbre fiscal d'État est inclus au Net à payer quel que soit le mode.</p>
                  </div>

                  {/* Destination */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500">Destination</label>
                    <select className="w-full bg-[#2a2a2a] border border-neutral-700 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-sky-500 cursor-pointer">
                      <option>Microsoft Print to PDF</option>
                      <option>Imprimante Réseau BOCS</option>
                      <option>Sauvegarder au format PDF</option>
                    </select>
                  </div>

                  {/* Pages */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500">Pages</label>
                    <select className="w-full bg-[#2a2a2a] border border-neutral-700 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-sky-500 cursor-pointer">
                      <option>Toutes</option>
                      <option>Page active (1)</option>
                    </select>
                  </div>

                  {/* Couleur */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500">Couleur</label>
                    <select className="w-full bg-[#2a2a2a] border border-neutral-700 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-sky-500 cursor-pointer">
                      <option>Couleur</option>
                      <option>Noir et blanc</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-neutral-800 pt-4">
                  <button className="text-[10px] font-bold text-neutral-500 hover:text-neutral-300 flex items-center gap-1 cursor-pointer">
                    <span>Plus de paramètres</span>
                    <span className="material-symbols-outlined text-sm">expand_more</span>
                  </button>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setPrintPreviewData(null)}
                  className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#333] text-white border border-neutral-700 rounded-sm font-bold text-xs cursor-pointer active:scale-95 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const calculatedPayload = calculateProformaData(printPreviewData.bl, printPreviewData.typeConfig, printPreviewData.existingInvoice);
                    calculatedPayload.modeReglement = printReglement;
                    calculatedPayload.isComptant = printReglement === 'COMPTANT' || printReglement === 'ESPECES';
                    
                    if (printPreviewData.existingInvoice && onUpdateInvoice) {
                      onUpdateInvoice(calculatedPayload);
                      toastSuccess(`Proforma ${calculatedPayload.numeroFacture} (${printPreviewData.typeConfig.name}) mise à jour.`);
                    } else {
                      onGenerateInvoice(calculatedPayload);
                      toastSuccess(`Proforma ${calculatedPayload.numeroFacture} (${printPreviewData.typeConfig.name}) générée avec succès !`);
                    }

                    onLogAudit(
                      'GENERATION_PROFORMA_BL',
                      'Facture',
                      `Émission de la proforma ${calculatedPayload.numeroFacture} (${printPreviewData.typeConfig.name}, ${calculatedPayload.montantTtcFcfa.toLocaleString('fr-FR')} FCFA) pour le BL ${printPreviewData.bl.numeroBL}`
                    );

                    generateProformaPdf(calculatedPayload, printPreviewData.bl);

                    const key = `${printPreviewData.bl.id}-${printPreviewData.typeConfig.id}`;
                    setPrintedProformas(prev => ({ ...prev, [key]: true }));

                    setPrintPreviewData(null);
                  }}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-sm font-bold text-xs cursor-pointer active:scale-95 transition-all shadow-md"
                >
                  Imprimer
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
