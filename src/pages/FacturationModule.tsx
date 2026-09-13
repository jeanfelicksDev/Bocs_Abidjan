import React, { useState, useEffect } from 'react';
import { toastSuccess, toastError, toastWarning, toastInfo } from '../components/common/Toast';
import { exportInvoicesCsv, exportPaymentsCsv } from '../utils/exportCsv';
import { BL, Escale, Invoice, CreditNote, Payment, UserRole, TarifSurestarie, ContainerType, InvoiceTypeConfig, RubriqueConfig, FretCategory, CalculationBase, PriceHistoryEntry } from '../types';
import { INITIAL_TARIFS_SURESTARIE } from '../data/initialData';
import { generateProformaPdf, generateDoBadPdf, generateCreditNotePdf } from '../utils/pdfGenerator';
import { BlBillingModule } from './BlBillingModule';

interface FacturationModuleProps {
  initialSubTab?: 'FACTURATION_BL' | 'PROFORMA' | 'AVOIRS' | 'TARIFS' | 'BALANCE_AGEE' | 'CONFIG';
  invoices: Invoice[];
  creditNotes?: CreditNote[];
  payments: Payment[];
  bls?: BL[];
  escales?: Escale[];
  selectedBlId?: number | null;
  onSelectBl?: (blId: number) => void;
  onNavigateToImport?: () => void;
  onAddPayment: (payment: Payment) => void;
  onValidateInvoice?: (invoiceId: number) => void;
  onGenerateCreditNote?: (creditNote: CreditNote) => void;
  onDuplicateInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: number) => void;
  exchangeRateUsd: number;
  onLogAudit: (action: string, entite: string, details: string) => void;
  userRole: UserRole;
  invoiceTypeConfigs?: InvoiceTypeConfig[];
  onUpdateInvoiceTypeConfigs?: (configs: InvoiceTypeConfig[]) => void;
  rubriqueConfigs?: RubriqueConfig[];
  onUpdateRubriqueConfigs?: (configs: RubriqueConfig[]) => void;
  onUpdateAllConfigs?: (types: InvoiceTypeConfig[], rubriques: RubriqueConfig[]) => void;
  onDeleteInvoiceTypeConfig?: (typeId: string) => void;
  onGenerateInvoice?: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onUpdateBl?: (updatedBl: BL) => void;
}


export function suggestTariffCode(name: string): string {
  if (!name || !name.trim()) return '';
  const clean = name.trim().toUpperCase();

  // 1. Direct maritime/billing mapping
  if (clean.includes('ISPS')) return 'ISPS';
  if (clean.includes('DOSSIER')) return 'FR-DOS';
  if (clean.includes('ECHANGE') || clean.includes('ÉCHANGE')) return 'ECH-BL';
  if (clean.includes('GARANTIE') || clean.includes('CAUTION')) return 'GAR-CTR';
  if (clean.includes('MANUTENTION') || clean.includes('GRUTAGE')) return 'MAN-01';
  if (clean.includes('STOCKAGE') || clean.includes('MAGASINAGE')) return 'STK-PRC';
  if (clean.includes('TELEX') || clean.includes('RELEASE')) return 'TLX-FEE';
  if (clean.includes('TRANSFERT')) return 'TRF-PRC';
  if (clean.includes('SURESTARIE') || clean.includes('DEMURRAGE')) return 'DMDT';
  if (clean.includes('DETENTION')) return 'DET-CTR';
  if (clean.includes('PASSE') || clean.includes('PORTUAIRE')) return 'PSC-VRC';
  if (clean.includes('RORO') || clean.includes('RO-RO')) return 'TX-RORO';
  if (clean.includes('LOURD') || clean.includes('SURCHARGE')) return 'SCH-LVR';
  if (clean.includes('ASSURANCE')) return 'ASSUR';
  if (clean.includes('SCELLE') || clean.includes('PLOMB') || clean.includes('SEAL')) return 'SCL-OK';
  if (clean.includes('NETTOYAGE') || clean.includes('LAVAGE')) return 'NET-CTR';
  if (clean.includes('BRANCHEMENT') || clean.includes('REEFER') || clean.includes('FRIGO')) return 'REF-BRN';
  if (clean.includes('PESAGE') || clean.includes('VGM')) return 'VGM-FEE';
  if (clean.includes('CORRECTION') || clean.includes('AMENDMENT')) return 'AMD-BL';
  if (clean.includes('BAD') || clean.includes('BON A DELIVRER') || clean.includes('BON À DÉLIVRER')) return 'BAD-FEE';
  if (clean.includes('DEBARQUEMENT') || clean.includes('DÉBARQUEMENT')) return 'DEB-01';
  if (clean.includes('EMBARQUEMENT')) return 'EMB-01';

  // 2. Intelligent abbreviation generation from significant words
  const stopWords = new Set(['DE', 'DU', 'DES', 'LE', 'LA', 'LES', 'AU', 'AUX', 'ET', 'EN', 'POUR', 'PAR', 'UN', 'UNE', 'SUR', 'D', 'L']);
  const words = clean
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0 && !stopWords.has(w));

  if (words.length === 0) return 'TAR-01';
  if (words.length === 1) return words[0].slice(0, 6);
  if (words.length === 2) return `${words[0].slice(0, 3)}-${words[1].slice(0, 3)}`;
  return `${words[0].slice(0, 2)}-${words[1].slice(0, 2)}${words[2].slice(0, 2)}`;
}

function getInvoiceTypePrefix(typeName: string): string {
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
}

function getPlannedTypeIdsForBl(bl: BL | undefined, invoiceTypeConfigs: InvoiceTypeConfig[]): string[] {
  if (!bl) return [];
  const excludedIds: string[] = (() => {
    try {
      const raw = localStorage.getItem('bocs_billing_excluded_invoices');
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed[bl.id]) ? parsed[bl.id] : [];
      }
    } catch {}
    return [];
  })();

  let planned: string[] = [];

  // 1. Planification enregistrée dans localStorage (depuis le module Factures & Prestations)
  try {
    const raw = localStorage.getItem('bocs_billing_planned_invoices');
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved[bl.id]) && saved[bl.id].length > 0) {
        planned = saved[bl.id];
      }
    }
  } catch {}

  // 2. Propriété directe du BL
  if (planned.length === 0 && Array.isArray(bl.selectedInvoiceTypeIds) && bl.selectedInvoiceTypeIds.length > 0) {
    planned = bl.selectedInvoiceTypeIds;
  }

  // 3. Règles par défaut :
  // - Conteneurs : Caution, Échange, Transfert
  // - Vrac, RORO, Conventionnel : Échange
  if (planned.length === 0) {
    const isContainer = (bl.conteneurs && bl.conteneurs.length > 0) || (bl.typeEmballage || '').toUpperCase().includes('CONTENEUR');
    planned = invoiceTypeConfigs.filter(t => {
      const name = t.name.toLowerCase();
      const isCaution = name.includes('caution');
      const isEchange = name.includes('echange') || name.includes('échange') || t.id === '2';
      const isTransfert = name.includes('transfert');
      if (isContainer) return isCaution || isEchange || isTransfert;
      return isEchange;
    }).map(t => t.id);
  }

  return planned.filter(id => !excludedIds.includes(id));
}

export const FacturationModule: React.FC<FacturationModuleProps> = ({
  initialSubTab = 'FACTURATION_BL',
  invoices,
  creditNotes = [],
  payments,
  bls = [],
  escales = [],
  selectedBlId = null,
  onSelectBl,
  onNavigateToImport,
  onAddPayment,
  onValidateInvoice,
  onGenerateCreditNote,
  onDuplicateInvoice,
  onDeleteInvoice,
  exchangeRateUsd,
  onLogAudit,
  userRole,
  invoiceTypeConfigs = [],
  onUpdateInvoiceTypeConfigs,
  rubriqueConfigs = [],
  onUpdateRubriqueConfigs,
  onUpdateAllConfigs,
  onDeleteInvoiceTypeConfig,
  onGenerateInvoice,
  onUpdateInvoice,
  onUpdateBl
}) => {
  const [activeTab, setActiveTab] = useState<'FACTURATION_BL' | 'PROFORMA' | 'AVOIRS' | 'TARIFS' | 'BALANCE_AGEE' | 'CONFIG'>(initialSubTab);

  React.useEffect(() => {
    if (initialSubTab) setActiveTab(initialSubTab);
  }, [initialSubTab]);

  React.useEffect(() => {
    if (selectedBlId) {
      setActiveTab('FACTURATION_BL');
    }
  }, [selectedBlId]);

  // Invoice Configuration Page State
  const [selectedInvoiceTypeId, setSelectedInvoiceTypeId] = useState<string>(
    invoiceTypeConfigs.length > 0 ? invoiceTypeConfigs[0].id : '1'
  );
  const [activeCategory, setActiveCategory] = useState<FretCategory>('CONTENEUR');
  const [searchTypeQuery, setSearchTypeQuery] = useState('');

  const activeInvoiceType = invoiceTypeConfigs.find(t => t.id === selectedInvoiceTypeId) || invoiceTypeConfigs[0];
  const activeInvoiceTypeIdResolved = activeInvoiceType?.id || '';
  
  // Local copy of rubriques for editing and saving on click
  const [localRubriques, setLocalRubriques] = useState<RubriqueConfig[]>([]);

  useEffect(() => {
    if (rubriqueConfigs) {
      setLocalRubriques(rubriqueConfigs);
    }
  }, [rubriqueConfigs]);

  useEffect(() => {
    if (!activeInvoiceType) return;
    const nameLower = activeInvoiceType.name.toLowerCase();
    const isCaution = nameLower.includes('caution') || activeInvoiceType.id === '1';
    const isTransfert = nameLower.includes('transfert') || activeInvoiceType.id === '4';
    const isSurestarieOrDetention = nameLower.includes('surestarie') || nameLower.includes('detention') || nameLower.includes('détention');
    
    if (isCaution || isTransfert || isSurestarieOrDetention) {
      if (activeCategory !== 'CONTENEUR') {
        setActiveCategory('CONTENEUR');
      }
    }
  }, [selectedInvoiceTypeId, activeInvoiceType]);

  // Modals state for config page
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [showEditTypeModal, setShowEditTypeModal] = useState(false);
  const [showDeleteTypeModal, setShowDeleteTypeModal] = useState(false);
  const [showAddRubriqueModal, setShowAddRubriqueModal] = useState(false);
  const [showEditRubriqueModal, setShowEditRubriqueModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  
  const [editingInvoiceType, setEditingInvoiceType] = useState<InvoiceTypeConfig | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<InvoiceTypeConfig | null>(null);
  const [editingRubrique, setEditingRubrique] = useState<RubriqueConfig | null>(null);
  const [rubriqueToDelete, setRubriqueToDelete] = useState<RubriqueConfig | null>(null);

  // Form states for Type
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [editTypeName, setEditTypeName] = useState('');
  const [editTypeDescription, setEditTypeDescription] = useState('');

  // Form states for Rubrique
  const [newRubriqueName, setNewRubriqueName] = useState('');
  const [newRubriqueDescription, setNewRubriqueDescription] = useState('');
  const [newRubriqueCode, setNewRubriqueCode] = useState('');
  const [newRubriqueAmount, setNewRubriqueAmount] = useState<number>(0);
  const [newRubriqueIsActive, setNewRubriqueIsActive] = useState(true);
  const [newRubriqueBaseCalcul, setNewRubriqueBaseCalcul] = useState<CalculationBase>('BL');

  // Form states for Editing Rubrique
  const [editRubriqueName, setEditRubriqueName] = useState('');
  const [editRubriqueDescription, setEditRubriqueDescription] = useState('');
  const [editRubriqueCode, setEditRubriqueCode] = useState('');
  const [editRubriqueAmount, setEditRubriqueAmount] = useState<number>(0);
  const [editRubriqueBaseCalcul, setEditRubriqueBaseCalcul] = useState<CalculationBase>('BL');

  // Form states for Price Update & History Modal
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedRubriqueForPrice, setSelectedRubriqueForPrice] = useState<RubriqueConfig | null>(null);
  const [newPriceEffectiveDate, setNewPriceEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newPriceAmount, setNewPriceAmount] = useState<number>(0);
  const [newPriceNote, setNewPriceNote] = useState<string>('');

  const handleOpenPriceModal = (rubrique: RubriqueConfig) => {
    setSelectedRubriqueForPrice(rubrique);
    setNewPriceEffectiveDate(new Date().toISOString().split('T')[0]);
    setNewPriceAmount(rubrique.montantUnitaire);
    setNewPriceNote('');
    setShowPriceModal(true);
  };

  const handleSavePriceUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRubriqueForPrice) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const effDate = newPriceEffectiveDate || todayStr;

    const entry: PriceHistoryEntry = {
      id: Date.now().toString(),
      effectiveDate: effDate,
      amount: newPriceAmount,
      changedAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      changedBy: 'Admin / Facturation',
      note: newPriceNote.trim() || undefined
    };

    const existingHistory = selectedRubriqueForPrice.priceHistory && selectedRubriqueForPrice.priceHistory.length > 0
      ? selectedRubriqueForPrice.priceHistory
      : [
          {
            id: (Date.now() - 86400000).toString(),
            effectiveDate: 'Tarif initial',
            amount: selectedRubriqueForPrice.montantUnitaire,
            changedAt: 'Configuration initiale',
            changedBy: 'Système'
          }
        ];

    const updatedHistory = [entry, ...existingHistory];

    const updated = localRubriques.map(r => 
      r.id === selectedRubriqueForPrice.id 
        ? { 
            ...r, 
            montantUnitaire: newPriceAmount, 
            priceHistory: updatedHistory 
          } 
        : r
    );

    setLocalRubriques(updated);
    if (onUpdateRubriqueConfigs) {
      onUpdateRubriqueConfigs(updated);
    }

    onLogAudit(
      'MISE_A_JOUR_PRIX_RUBRIQUE',
      'RubriqueConfig',
      `Mise à jour du prix de "${selectedRubriqueForPrice.name}" (${selectedRubriqueForPrice.code}) : ${newPriceAmount.toLocaleString('fr-FR')} FCFA (À partir du ${effDate})`
    );

    setSelectedRubriqueForPrice({
      ...selectedRubriqueForPrice,
      montantUnitaire: newPriceAmount,
      priceHistory: updatedHistory
    });

    setNewPriceNote('');
    toastSuccess(`Nouveau prix unitaire appliqué : ${newPriceAmount.toLocaleString('fr-FR')} FCFA`);
  };

  // Handlers for Local Rubriques
  const handleToggleLocalRubrique = (rubriqueId: string) => {
    const target = localRubriques.find(r => r.id === rubriqueId);
    const updated = localRubriques.map(r => 
      r.id === rubriqueId ? { ...r, isActive: !r.isActive } : r
    );
    setLocalRubriques(updated);
    if (onUpdateRubriqueConfigs) {
      onUpdateRubriqueConfigs(updated);
    }
    if (target) {
      onLogAudit(
        'TOGGLE_RUBRIQUE',
        'RubriqueConfig',
        `Rubrique "${target.name}" (${target.code}) ${!target.isActive ? 'activée' : 'désactivée'}`
      );
    }
  };

  const handleChangeLocalRubriqueAmount = (rubriqueId: string, amount: number) => {
    const updated = localRubriques.map(r => 
      r.id === rubriqueId ? { ...r, montantUnitaire: amount } : r
    );
    setLocalRubriques(updated);
    if (onUpdateRubriqueConfigs) {
      onUpdateRubriqueConfigs(updated);
    }
  };

  // Save full configuration
  const handleSaveConfig = () => {
    if (onUpdateRubriqueConfigs) {
      onUpdateRubriqueConfigs(localRubriques);
    }
    const currentType = invoiceTypeConfigs.find(t => t.id === selectedInvoiceTypeId);
    onLogAudit(
      'MAJ_CONFIGURATION_FACTURES',
      'FactureConfig',
      `Mise à jour de la configuration des rubriques (Type: ${currentType?.name || selectedInvoiceTypeId})`
    );
    toastSuccess('Configuration enregistrée avec succès !');
  };

  // Add new Invoice Type (Atomic & Safe)
  const handleAddInvoiceType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    const newId = Date.now().toString();
    const newType: InvoiceTypeConfig = {
      id: newId,
      name: newTypeName.trim(),
      description: newTypeDescription.trim()
    };

    // Create default rubrique for the new type
    const defaultRubrique: RubriqueConfig = {
      id: (Date.now() + 1).toString(),
      invoiceTypeId: newId,
      category: 'CONTENEUR',
      name: 'Frais de dossier',
      description: 'Frais administratifs standards',
      code: 'FR-DOS',
      isActive: true,
      montantUnitaire: 15000,
      baseCalcul: 'BL'
    };

    const updatedTypes = [...invoiceTypeConfigs, newType];
    const updatedRubriques = [...rubriqueConfigs, defaultRubrique];

    setLocalRubriques(updatedRubriques);

    if (onUpdateAllConfigs) {
      onUpdateAllConfigs(updatedTypes, updatedRubriques);
    } else {
      if (onUpdateInvoiceTypeConfigs) onUpdateInvoiceTypeConfigs(updatedTypes);
      if (onUpdateRubriqueConfigs) onUpdateRubriqueConfigs(updatedRubriques);
    }

    onLogAudit(
      'CREATION_TYPE_FACTURE',
      'FactureConfig',
      `Création du nouveau type de facture : ${newTypeName}`
    );

    setSelectedInvoiceTypeId(newId);
    setShowAddTypeModal(false);
    setNewTypeName('');
    setNewTypeDescription('');
    toastSuccess(`Le type de facture "${newTypeName}" a été créé avec succès.`);
  };

  // Edit Invoice Type
  const handleEditInvoiceType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoiceType || !editTypeName.trim()) return;

    const updatedTypes = invoiceTypeConfigs.map(t => 
      t.id === editingInvoiceType.id 
        ? { ...t, name: editTypeName.trim(), description: editTypeDescription.trim() } 
        : t
    );

    if (onUpdateInvoiceTypeConfigs) {
      onUpdateInvoiceTypeConfigs(updatedTypes);
    }

    onLogAudit(
      'MAJ_TYPE_FACTURE',
      'FactureConfig',
      `Mise à jour du type de facture : ${editTypeName}`
    );

    setShowEditTypeModal(false);
    setEditingInvoiceType(null);
    toastSuccess('Le type de facture a été mis à jour.');
  };

  // Delete Invoice Type
  const handleDeleteInvoiceTypeClick = (type: InvoiceTypeConfig) => {
    setTypeToDelete(type);
    setShowDeleteTypeModal(true);
  };

  const confirmDeleteInvoiceType = () => {
    if (!typeToDelete) return;

    if (onDeleteInvoiceTypeConfig) {
      onDeleteInvoiceTypeConfig(typeToDelete.id);
    } else {
      const updatedTypes = invoiceTypeConfigs.filter(t => t.id !== typeToDelete.id);
      const updatedRubriques = localRubriques.filter(r => r.invoiceTypeId !== typeToDelete.id);
      setLocalRubriques(updatedRubriques);
      if (onUpdateInvoiceTypeConfigs) onUpdateInvoiceTypeConfigs(updatedTypes);
      if (onUpdateRubriqueConfigs) onUpdateRubriqueConfigs(updatedRubriques);
    }

    onLogAudit(
      'SUPPRESSION_TYPE_FACTURE',
      'FactureConfig',
      `Suppression du type de facture : ${typeToDelete.name} (#${typeToDelete.id})`
    );

    const remainingTypes = invoiceTypeConfigs.filter(t => t.id !== typeToDelete.id);
    if (selectedInvoiceTypeId === typeToDelete.id && remainingTypes.length > 0) {
      setSelectedInvoiceTypeId(remainingTypes[0].id);
    }

    setShowDeleteTypeModal(false);
    setTypeToDelete(null);
  };

  // Add Rubrique to active category and type
  const handleAddRubrique = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRubriqueName.trim() || !newRubriqueCode.trim()) return;

    const newRubrique: RubriqueConfig = {
      id: Date.now().toString(),
      invoiceTypeId: selectedInvoiceTypeId,
      category: activeCategory,
      name: newRubriqueName.trim(),
      description: newRubriqueDescription.trim(),
      code: newRubriqueCode.trim().toUpperCase(),
      isActive: newRubriqueIsActive,
      montantUnitaire: newRubriqueAmount,
      baseCalcul: newRubriqueBaseCalcul
    };

    const updated = [...localRubriques, newRubrique];
    setLocalRubriques(updated);
    if (onUpdateRubriqueConfigs) {
      onUpdateRubriqueConfigs(updated);
    }

    onLogAudit(
      'AJOUT_RUBRIQUE',
      'RubriqueConfig',
      `Ajout de la rubrique "${newRubrique.name}" (${newRubrique.code}) - ${newRubrique.montantUnitaire} FCFA (${newRubrique.baseCalcul})`
    );

    setShowAddRubriqueModal(false);
    setNewRubriqueName('');
    setNewRubriqueDescription('');
    setNewRubriqueCode('');
    setNewRubriqueAmount(0);
    setNewRubriqueIsActive(true);
    setNewRubriqueBaseCalcul('BL');
    toastSuccess(`Rubrique "${newRubrique.name}" ajoutée.`);
  };

  // Edit Rubrique handler
  const handleEditRubrique = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRubrique || !editRubriqueName.trim() || !editRubriqueCode.trim()) return;

    const updated = localRubriques.map(r => 
      r.id === editingRubrique.id 
        ? { 
            ...r, 
            name: editRubriqueName.trim(), 
            description: editRubriqueDescription.trim(), 
            code: editRubriqueCode.trim().toUpperCase(),
            montantUnitaire: editRubriqueAmount,
            baseCalcul: editRubriqueBaseCalcul
          } 
        : r
    );
    setLocalRubriques(updated);
    if (onUpdateRubriqueConfigs) {
      onUpdateRubriqueConfigs(updated);
    }

    onLogAudit(
      'MODIFICATION_RUBRIQUE',
      'RubriqueConfig',
      `Modification de la rubrique "${editRubriqueName}" (${editRubriqueCode}) - ${editRubriqueAmount} FCFA (${editRubriqueBaseCalcul})`
    );

    setShowEditRubriqueModal(false);
    setEditingRubrique(null);
    toastSuccess(`Rubrique "${editRubriqueName}" mise à jour.`);
  };

  // Delete Rubrique handler
  const handleDeleteRubriqueClick = (rubrique: RubriqueConfig) => {
    setRubriqueToDelete(rubrique);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteRubrique = () => {
    if (!rubriqueToDelete) return;
    const toDeleteId = rubriqueToDelete.id;
    const toDeleteName = rubriqueToDelete.name;
    const toDeleteCode = rubriqueToDelete.code;
    const updated = localRubriques.filter(r => r.id !== toDeleteId);
    setLocalRubriques(updated);
    if (onUpdateRubriqueConfigs) {
      onUpdateRubriqueConfigs(updated);
    }

    onLogAudit(
      'SUPPRESSION_RUBRIQUE',
      'RubriqueConfig',
      `Suppression de la rubrique "${toDeleteName}" (${toDeleteCode})`
    );
    setShowDeleteConfirmModal(false);
    setRubriqueToDelete(null);
    toastSuccess(`Rubrique "${toDeleteName}" supprimée.`);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  // Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentFacture, setPaymentFacture] = useState<Invoice | null>(null);
  const [paymentMontant, setPaymentMontant] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'MOBILE_MONEY'>('VIREMENT');
  const [paymentRef, setPaymentRef] = useState('');

  // Credit Note Modal state
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [targetInvoiceForCreditNote, setTargetInvoiceForCreditNote] = useState<Invoice | null>(null);
  const [creditNoteMotif, setCreditNoteMotif] = useState('Erreur de tarification / Saisie');
  const [creditNoteCustomMotif, setCreditNoteCustomMotif] = useState('');
  const [creditNoteType, setCreditNoteType] = useState<'TOTAL' | 'PARTIEL'>('TOTAL');
  const [creditNotePartielMontant, setCreditNotePartielMontant] = useState<number>(0);

  // Validate Modal State
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [invoiceToValidate, setInvoiceToValidate] = useState<Invoice | null>(null);

  // Duplicate Modal State
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [invoiceToDuplicate, setInvoiceToDuplicate] = useState<Invoice | null>(null);

  // Delete Draft Modal State
  const [showDeleteInvoiceModal, setShowDeleteInvoiceModal] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  // Filter State
  const [statusFilter, setStatusFilter] = useState<'TOUS' | 'BROUILLON' | 'VALIDEE' | 'ANNULEE'>('TOUS');
  const [creditNotesSearch, setCreditNotesSearch] = useState('');

  const handleOpenCreditNoteModal = (invoice: Invoice) => {
    setTargetInvoiceForCreditNote(invoice);
    setCreditNoteMotif('Erreur de tarification / Saisie');
    setCreditNoteCustomMotif('');
    setCreditNoteType('TOTAL');
    setCreditNotePartielMontant(invoice.montantTtcFcfa);
    setShowCreditNoteModal(true);
  };

  const handleSubmitCreditNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInvoiceForCreditNote) return;

    const finalMotif = creditNoteMotif === 'AUTRE' ? creditNoteCustomMotif.trim() : creditNoteMotif;
    if (!finalMotif) {
      toastError("Le motif d'annulation / émission d'avoir est légalement obligatoire.");
      return;
    }

    const currentYearSuffix = new Date().getFullYear().toString().slice(-2);
    const yearPrefix = `AV-BOCS${currentYearSuffix}`;
    const existingAvoirs = (creditNotes || [])
      .map(cn => cn.numeroAvoir)
      .filter(num => num && num.startsWith(yearPrefix));

    let maxCounter = -1;
    existingAvoirs.forEach(num => {
      const counterStr = num.replace(yearPrefix, '');
      const counterVal = parseInt(counterStr, 10);
      if (!isNaN(counterVal) && counterVal > maxCounter) {
        maxCounter = counterVal;
      }
    });

    const nextCounter = maxCounter >= 0 ? maxCounter + 1 : 1;
    const numeroAvoir = `${yearPrefix}${String(nextCounter).padStart(4, '0')}`;
    const dateToday = new Date().toISOString().split('T')[0];

    const isTotal = creditNoteType === 'TOTAL';
    const ttc = isTotal ? targetInvoiceForCreditNote.montantTtcFcfa : creditNotePartielMontant;
    const ht = Math.round(ttc / 1.18);
    const tva = ttc - ht;

    const newCreditNote: CreditNote = {
      id: Date.now(),
      numeroAvoir,
      factureId: targetInvoiceForCreditNote.id,
      numeroFactureOrigine: targetInvoiceForCreditNote.numeroFacture,
      clientNom: targetInvoiceForCreditNote.clientNom,
      motif: finalMotif,
      dateEmission: dateToday,
      montantHtFcfa: ht,
      tvaFcfa: tva,
      montantTtcFcfa: ttc,
      statut: 'VALIDE',
      createdBy: 'Comptabilité BOCS Abidjan',
      lignes: isTotal && targetInvoiceForCreditNote.lignes && targetInvoiceForCreditNote.lignes.length > 0
        ? targetInvoiceForCreditNote.lignes.map((l, i) => ({
            id: i + 1,
            creditNoteId: Date.now(),
            designation: `Annulation: ${l.designation}`,
            typeFrais: l.typeFrais,
            quantite: l.quantite,
            prixUnitaireFcfa: l.prixUnitaireFcfa,
            montantHtFcfa: l.montantHtFcfa,
            tauxTva: l.tauxTva
          }))
        : [
            {
              id: 1,
              creditNoteId: Date.now(),
              designation: `Avoir partiel sur facture ${targetInvoiceForCreditNote.numeroFacture}`,
              typeFrais: 'AUTRE',
              quantite: 1,
              prixUnitaireFcfa: ht,
              montantHtFcfa: ht,
              tauxTva: 18
            }
          ]
    };

    if (onGenerateCreditNote) {
      onGenerateCreditNote(newCreditNote);
    }

    const matchedBl = bls.find(b => b.numeroBL === targetInvoiceForCreditNote.numeroBL);
    generateCreditNotePdf(newCreditNote, targetInvoiceForCreditNote, matchedBl);

    setShowCreditNoteModal(false);
    setTargetInvoiceForCreditNote(null);
    toastSuccess(`Note d'Avoir ${numeroAvoir} émise. La facture ${targetInvoiceForCreditNote.numeroFacture} est annulée.`);
  };

  const handleConfirmValidateInvoice = () => {
    if (!invoiceToValidate) return;
    if (onValidateInvoice) {
      onValidateInvoice(invoiceToValidate.id);
    }
    setShowValidateModal(false);
    setInvoiceToValidate(null);
    toastSuccess(`Facture validée ! Numéro fiscal officiel attribué.`);
  };

  const handleConfirmDuplicateInvoice = () => {
    if (!invoiceToDuplicate) return;
    if (onDuplicateInvoice) {
      onDuplicateInvoice(invoiceToDuplicate);
    }
    setShowDuplicateModal(false);
    setInvoiceToDuplicate(null);
    toastSuccess(`Brouillon créé par duplication de la facture ${invoiceToDuplicate.numeroFacture}.`);
  };

  const handleConfirmDeleteDraft = () => {
    if (!invoiceToDelete) return;
    const isProforma = !(invoiceToDelete.numeroFacture || '').startsWith('FA-') &&
                       invoiceToDelete.statutFacture !== 'VALIDEE' &&
                       invoiceToDelete.statutFacture !== 'ANNULEE' &&
                       invoiceToDelete.statutFacture !== 'AVOIR' &&
                       invoiceToDelete.statutPaiement !== 'PAYE';

    if (!isProforma) {
      toastError("Conformité fiscale : Seules les factures proforma non réglées peuvent être supprimées. Émettez un Avoir pour les autres.");
      setShowDeleteInvoiceModal(false);
      setInvoiceToDelete(null);
      return;
    }
    if (onDeleteInvoice) {
      onDeleteInvoice(invoiceToDelete.id);
    }
    setShowDeleteInvoiceModal(false);
    setInvoiceToDelete(null);
    toastSuccess(`Facture proforma supprimée avec succès.`);
  };

  // Tariff Configuration State with LocalStorage persistence
  const [tarifs, setTarifs] = useState<TarifSurestarie[]>(() => {
    const saved = localStorage.getItem('bocs_tarifs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing bocs_tarifs from localStorage', e);
      }
    }
    return INITIAL_TARIFS_SURESTARIE;
  });

  useEffect(() => {
    localStorage.setItem('bocs_tarifs', JSON.stringify(tarifs));
  }, [tarifs]);

  const [deletingTarifId, setDeletingTarifId] = useState<number | null>(null);
  const [editingTarif, setEditingTarif] = useState<TarifSurestarie | null>(null);
  const [tariffFilterOpType, setTariffFilterOpType] = useState<'IMPORT' | 'EXPORT'>('IMPORT');
  const [tariffFilterRegime, setTariffFilterRegime] = useState<'SURESTARIE' | 'DETENTION'>('SURESTARIE');
  const [showAddTarifModal, setShowAddTarifModal] = useState(false);
  const [tarifToDelete, setTarifToDelete] = useState<TarifSurestarie | null>(null);

  // Form states for new tariff
  const [newTarifTypeCtn, setNewTarifTypeCtn] = useState<ContainerType>('20_DRY');
  const [newTarifOpType, setNewTarifOpType] = useState<'IMPORT' | 'EXPORT'>('IMPORT');
  const [newTarifRegime, setNewTarifRegime] = useState<'SURESTARIE' | 'DETENTION'>('SURESTARIE');
  const [newTarifJourDebut, setNewTarifJourDebut] = useState<number>(8);
  const [newTarifJourFin, setNewTarifJourFin] = useState<number>(15);
  const [newTarifRate, setNewTarifRate] = useState<number>(15000);
  const [newTarifFranchise, setNewTarifFranchise] = useState<number>(7);

  // Enforce no surestaries at export rule for filter and new form
  useEffect(() => {
    if (tariffFilterOpType === 'EXPORT' && tariffFilterRegime === 'SURESTARIE') {
      setTariffFilterRegime('DETENTION');
    }
  }, [tariffFilterOpType]);

  useEffect(() => {
    if (newTarifOpType === 'EXPORT' && newTarifRegime === 'SURESTARIE') {
      setNewTarifRegime('DETENTION');
    }
  }, [newTarifOpType]);



  // Aged balance metrics
  const totalSoldeDu = (invoices || []).reduce((acc, i) => acc + (i.soldeDuFcfa || 0), 0);
  const totalPaye = (invoices || []).reduce((acc, i) => acc + ((i.montantTtcFcfa || 0) - (i.soldeDuFcfa || 0)), 0);

  // Balance âgée réelle : classement par ancienneté selon la date d'échéance
  const agedBalance = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let t0_30 = 0, t31_60 = 0, t61_90 = 0, t90plus = 0;
    (invoices || []).forEach(inv => {
      const solde = inv.soldeDuFcfa || 0;
      if (solde <= 0) return; // Facture entièrement payée, ignorer
      if (!inv.dateEcheance) {
        t0_30 += solde;
        return;
      }
      const echeance = new Date(inv.dateEcheance);
      echeance.setHours(0, 0, 0, 0);
      const diffMs = today.getTime() - echeance.getTime();
      const joursRetard = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (joursRetard <= 0) {
        t0_30 += solde;       // Pas encore échu ou échu aujourd'hui → 0-30j
      } else if (joursRetard <= 30) {
        t0_30 += solde;
      } else if (joursRetard <= 60) {
        t31_60 += solde;
      } else if (joursRetard <= 90) {
        t61_90 += solde;
      } else {
        t90plus += solde;
      }
    });
    return { t0_30, t31_60, t61_90, t90plus };
  }, [invoices]);

  // Group invoices by numeroBL (or invoice id/number if no BL)
  const groupedInvoices = React.useMemo(() => {
    const groups: { [key: string]: Invoice[] } = {};
    invoices.forEach(inv => {
      const blKey = inv.numeroBL || `SANS_BL_${inv.id}`;
      if (!groups[blKey]) {
        groups[blKey] = [];
      }
      groups[blKey].push(inv);
    });

    return Object.keys(groups).map(blKey => {
      const groupInvoices = groups[blKey];
      const rep = groupInvoices[0];
      
      const totalHt = groupInvoices.reduce((sum, inv) => sum + Number(inv.montantHtFcfa || 0), 0);
      const totalTtc = groupInvoices.reduce((sum, inv) => sum + Number(inv.montantTtcFcfa || 0), 0);
      const totalSolde = groupInvoices.reduce((sum, inv) => sum + Number(inv.soldeDuFcfa || 0), 0);
      
      const matchedBl = bls.find(b => b.numeroBL === blKey);
      const plannedIds = getPlannedTypeIdsForBl(matchedBl, invoiceTypeConfigs);

      let status: 'PAYE' | 'PARTIEL' | 'NON_PAYE' = 'NON_PAYE';
      let statusLabel = '';

      if (plannedIds.length > 0) {
        let paidCount = 0;
        let generatedCount = 0;

        plannedIds.forEach(id => {
          const typeConfig = invoiceTypeConfigs.find(t => t.id === id);
          if (typeConfig) {
            const prefix = getInvoiceTypePrefix(typeConfig.name);
            const inv = groupInvoices.find(invoice => 
              invoice.invoiceTypeId === typeConfig.id ||
              (invoice.numeroFacture && prefix && invoice.numeroFacture.toUpperCase().includes(prefix.toUpperCase())) ||
              (invoice.typeFacture && invoice.typeFacture.toLowerCase().includes(typeConfig.name.toLowerCase()))
            );
            if (inv) {
              generatedCount++;
              if (inv.soldeDuFcfa === 0 || inv.statutPaiement === 'PAYE') {
                paidCount++;
              }
            }
          }
        });

        const totalPlanned = plannedIds.length;
        statusLabel = `${paidCount}/${totalPlanned}`;

        if (paidCount === totalPlanned && generatedCount === totalPlanned && totalSolde === 0) {
          status = 'PAYE';
        } else if (paidCount > 0 || (totalSolde < totalTtc && totalTtc > 0)) {
          status = 'PARTIEL';
        } else {
          status = 'NON_PAYE';
        }
      } else {
        if (totalSolde === 0 && totalTtc > 0) {
          status = 'PAYE';
        } else if (totalSolde < totalTtc) {
          status = 'PARTIEL';
        }
      }

      return {
        numeroBL: blKey.startsWith('SANS_BL_') ? '' : blKey,
        representative: rep,
        invoices: groupInvoices,
        totalHt,
        totalTtc,
        totalSolde,
        statutPaiement: status,
        statutLabel: statusLabel,
        matchedBl
      };
    });
  }, [invoices, bls, invoiceTypeConfigs]);

  const filteredGroupedInvoices = React.useMemo(() => {
    let list = groupedInvoices;
    if (statusFilter !== 'TOUS') {
      list = list.filter(g => 
        g.invoices.some(inv => (inv.statutFacture || 'BROUILLON') === statusFilter)
      );
    }
    const q = searchQuery.toLowerCase();
    if (!q) return list;
    return list.filter(g => 
      (g.numeroBL && g.numeroBL.toLowerCase().includes(q)) ||
      (g.representative.clientNom && g.representative.clientNom.toLowerCase().includes(q)) ||
      g.invoices.some(inv => inv.numeroFacture.toLowerCase().includes(q))
    );
  }, [groupedInvoices, searchQuery, statusFilter]);

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
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
      saisiPar: 'Service Comptabilité BOCS'
    };

    onAddPayment(newPayment);
    onLogAudit('ENREGISTREMENT_REGLEMENT', 'Paiement', `Règlement de ${paymentMontant.toLocaleString()} FCFA sur facture ${paymentFacture.numeroFacture}`);
    setShowPaymentModal(false);
    setPaymentFacture(null);
    setPaymentMontant(0);
    setPaymentRef('');
    toastSuccess('Règlement enregistré ! Solde mis à jour.');
  };

  const handleUpdateTarif = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarif) return;

    setTarifs(prev => prev.map(t => t.id === editingTarif.id ? editingTarif : t));
    onLogAudit('MAJ_TARIF_SURESTARIE', 'Tarif', `Mise à jour tarif ${editingTarif.typeConteneur} (${editingTarif.typeOperation}/${editingTarif.regime}): ${editingTarif.tarifJournalierFcfa} FCFA/j`);
    setEditingTarif(null);
  };

  const handleAddTarifSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTarifOpType === 'EXPORT' && newTarifRegime === 'SURESTARIE') {
      toastWarning("Il n'y a pas de surestaries à l'export. Régime forcé à Détention.");
      return;
    }

    const newTarif: TarifSurestarie = {
      id: Date.now(),
      typeConteneur: newTarifTypeCtn,
      jourDebut: newTarifJourDebut,
      jourFin: newTarifJourFin,
      tarifJournalierFcfa: newTarifRate,
      regime: newTarifRegime,
      typeOperation: newTarifOpType,
      joursFranchise: newTarifFranchise
    };

    setTarifs(prev => [...prev, newTarif]);
    onLogAudit(
      'AJOUT_TARIF_TRANCHE',
      'Tarif',
      `Ajout tranche tarifaire ${newTarif.typeConteneur} (${newTarif.typeOperation}/${newTarif.regime}): Jours ${newTarif.jourDebut}-${newTarif.jourFin} @ ${newTarif.tarifJournalierFcfa} FCFA/j`
    );

    setShowAddTarifModal(false);
    setNewTarifJourDebut(8);
    setNewTarifJourFin(15);
    setNewTarifRate(15000);
  };

  const handleDeleteTarifClick = (t: TarifSurestarie) => {
    setTarifs(prev => prev.filter(item => {
      if (t.id && item.id) {
        return item.id !== t.id;
      }
      return !(
        item.typeConteneur === t.typeConteneur &&
        item.typeOperation === t.typeOperation &&
        item.regime === t.regime &&
        item.jourDebut === t.jourDebut &&
        item.jourFin === t.jourFin
      );
    }));

    onLogAudit(
      'SUPPRESSION_TARIF_TRANCHE',
      'Tarif',
      `Suppression tranche tarifaire ${t.typeConteneur} (${t.typeOperation}/${t.regime}): Jours ${t.jourDebut}-${t.jourFin}`
    );

    setDeletingTarifId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Header & Sélecteur d'onglets Ultra-Épuré */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 ocean-glass-banner p-6 rounded-2xl shadow-2xl mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-teal-400 text-lg">payments</span>
            <p className="font-extrabold text-[11px] text-teal-400 uppercase tracking-widest font-mono">
              Finance, Facturation &amp; Surestaries DGI
            </p>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white font-heading tracking-tight">
            Facturation Maritime &amp; Règlements
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1 max-w-xl leading-relaxed">
            Émission des factures par connaissement (BL), calcul DMDT automatique, validation FNE DGI et suivi des créances.
          </p>
        </div>

        {/* Tab Switchers */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {[
            { key: 'FACTURATION_BL', label: 'Facturation BL', icon: 'receipt' },
            { key: 'PROFORMA', label: 'Journal Factures', icon: 'book' },
            { key: 'AVOIRS', label: `Avoirs (${(creditNotes || []).length})`, icon: 'account_balance_wallet' },
            { key: 'BALANCE_AGEE', label: 'Balance Client', icon: 'account_balance' },
            { key: 'TARIFS', label: 'Grille DMDT', icon: 'calculate' },
            { key: 'CONFIG', label: 'Types de Factures', icon: 'tune' }
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 font-extrabold text-xs transition-all active:scale-95 cursor-pointer shadow-md ${
                  isActive
                    ? 'premium-btn-primary text-white shadow-[0_0_15px_rgba(217,72,23,0.3)]'
                    : 'bg-[#0F172A] hover:bg-[#1E293B] text-white hover:text-white border border-slate-700/80 hover:border-[#005DAA]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-slate-300">
                  {tab.icon}
                </span>
                <span className="text-white font-black tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 0: FACTURATION BL PAR BL */}
      {activeTab === 'FACTURATION_BL' && (
        <BlBillingModule
          bls={bls}
          escales={escales}
          invoices={invoices}
          rubriqueConfigs={rubriqueConfigs}
          invoiceTypeConfigs={invoiceTypeConfigs}
          userRole={userRole}
          selectedBlId={selectedBlId}
          onSelectBl={onSelectBl}
          onNavigateToImport={onNavigateToImport}
          onGenerateInvoice={onGenerateInvoice || (() => {})}
          onUpdateInvoice={onUpdateInvoice}
          onValidateInvoice={onValidateInvoice}
          onDeleteInvoice={onDeleteInvoice}
          onAddPayment={onAddPayment}
          onLogAudit={onLogAudit}
          onUpdateBl={onUpdateBl}
        />
      )}

      {/* TAB 1: PROFORMA & SURESTARIES ENGINE */}
      {activeTab === 'PROFORMA' && (
        <div className="space-y-6">
          


          {/* Invoices List Table - Expanded Space */}
          <div className="ocean-glass-card overflow-hidden rounded-2xl shadow-2xl">
            <div className="py-3 px-4 bg-[#061528]/90 border-b border-cyan-500/20 flex flex-col lg:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-400 text-lg">receipt_long</span>
                <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">
                  Registre des Factures &amp; Connaissements
                </h3>
              </div>
              <button
                onClick={() => exportInvoicesCsv(invoices)}
                title="Exporter en CSV (Excel)"
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-all active:scale-95 shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Exporter CSV</span>
              </button>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1 bg-[#040e1b] border border-cyan-500/20 p-1 rounded-lg text-[11px] overflow-x-auto max-w-full">
                <button
                  type="button"
                  onClick={() => setStatusFilter('TOUS')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    statusFilter === 'TOUS' ? 'bg-cyan-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tous ({invoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('BROUILLON')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    statusFilter === 'BROUILLON' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Brouillons ({invoices.filter(i => (i.statutFacture || 'BROUILLON') === 'BROUILLON').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('VALIDEE')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    statusFilter === 'VALIDEE' ? 'bg-emerald-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Validées ({invoices.filter(i => i.statutFacture === 'VALIDEE').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ANNULEE')}
                  className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    statusFilter === 'ANNULEE' ? 'bg-rose-600 text-white shadow-xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Annulées ({invoices.filter(i => i.statutFacture === 'ANNULEE').length})
                </button>
              </div>

              <div className="relative w-full sm:w-60">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher facture, client..."
                  className="w-full pl-8 pr-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[400px] bocs-scrollbar relative">
              <table className="w-full text-left border-collapse text-xs min-w-[1200px]">
                <thead className="sticky top-0 z-10 bg-slate-700 text-white shadow-xs">
                  <tr className="text-[10px] font-extrabold uppercase border-b border-slate-600">
                    <th className="py-2.5 px-3 min-w-[130px]">Numéro BL</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Consignee</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Montant TTC</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Solde Dû</th>
                    <th className="py-2.5 px-3 min-w-[100px]">Paiement</th>
                    <th className="py-2.5 px-3 text-right min-w-[600px]">Factures & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGroupedInvoices.map(g => {
                    const blNumber = g.numeroBL || g.representative.numeroFacture;
                    const matchedBl = bls.find(b => b.numeroBL === g.numeroBL) || g.matchedBl;
                    
                    const plannedIds = getPlannedTypeIdsForBl(matchedBl, invoiceTypeConfigs);

                    // 1. Rassembler toutes les configurations possibles
                    const allConfigs = [...invoiceTypeConfigs];

                    // 2. S'assurer que chaque facture existante dans ce groupe de factures possède une configuration
                    g.invoices.forEach(inv => {
                      const match = allConfigs.find(t => 
                        t.id === inv.invoiceTypeId ||
                        (inv.typeFacture && t.name.toLowerCase() === inv.typeFacture.toLowerCase()) ||
                        (inv.numeroFacture && inv.numeroFacture.toUpperCase().includes(getInvoiceTypePrefix(t.name).toUpperCase()))
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

                    // 3. Filtrer les types à afficher :
                    // - Tout type ayant déjà une facture émise (RÈGLE ABSOLUE : toujours affiché)
                    // - Ou tout type faisant partie des prestations planifiées pour ce BL
                    const configsToDisplay = allConfigs.filter(typeConfig => {
                      const prefix = getInvoiceTypePrefix(typeConfig.name);
                      const existingInvoice = g.invoices.find(inv => 
                        inv.invoiceTypeId === typeConfig.id ||
                        (inv.numeroFacture && prefix && inv.numeroFacture.toUpperCase().includes(prefix.toUpperCase())) ||
                        (inv.typeFacture && inv.typeFacture.toLowerCase().includes(typeConfig.name.toLowerCase()))
                      );

                      if (existingInvoice) return true;
                      return plannedIds.includes(typeConfig.id);
                    });

                    // On vérifie si toutes les factures planifiées sont générées et payées (vertes)
                    const allInvoicesPaidAndGreen = configsToDisplay.length > 0 && configsToDisplay.every(typeConfig => {
                      const prefix = getInvoiceTypePrefix(typeConfig.name);
                      const inv = g.invoices.find(invoice => 
                        invoice.invoiceTypeId === typeConfig.id ||
                        (invoice.numeroFacture && prefix && invoice.numeroFacture.toUpperCase().includes(prefix.toUpperCase())) ||
                        (invoice.typeFacture && invoice.typeFacture.toLowerCase().includes(typeConfig.name.toLowerCase()))
                      );
                      return inv && (inv.soldeDuFcfa === 0 || inv.statutPaiement === 'PAYE') && inv.statutFacture !== 'ANNULEE' && inv.statutFacture !== 'AVOIR';
                    });

                    const isImport = matchedBl ? matchedBl.typeOperation === 'IMPORT' : g.representative.typeFacture.includes('IMPORT');

                    return (
                      <tr key={blNumber} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-xs text-[#005daa]">{blNumber}</td>
                        <td className="py-2.5 px-3 font-semibold text-xs text-slate-800">{g.representative.clientNom}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-xs text-slate-900">{g.totalTtc.toLocaleString('fr-FR')} FCFA</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-xs text-rose-600">
                          <div>{g.totalSolde.toLocaleString('fr-FR')} FCFA</div>
                          {(() => {
                            if (plannedIds.length === 0) return null;
                            const unissuedCount = plannedIds.filter(id => {
                              const typeConfig = invoiceTypeConfigs.find(t => t.id === id);
                              if (!typeConfig) return false;
                              const prefix = getInvoiceTypePrefix(typeConfig.name);
                              const found = g.invoices.some(inv => 
                                inv.invoiceTypeId === id ||
                                (inv.numeroFacture && prefix && inv.numeroFacture.toUpperCase().includes(prefix.toUpperCase())) ||
                                (inv.typeFacture && inv.typeFacture.toLowerCase().includes(typeConfig.name.toLowerCase()))
                              );
                              return !found;
                            }).length;
                            if (unissuedCount > 0) {
                              return (
                                <span className="block text-[9px] text-amber-600 font-semibold italic font-sans">
                                  ({unissuedCount} émission(s) en attente)
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            g.statutPaiement === 'PAYE' ? 'bg-emerald-600 text-white font-black' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {g.statutPaiement === 'PAYE' ? 'SOLDÉ' : 'NON RÉGLÉ'} {g.statutLabel ? `(${g.statutLabel})` : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {configsToDisplay.map(typeConfig => {
                              const prefix = getInvoiceTypePrefix(typeConfig.name);
                              const inv = g.invoices.find(invoice => 
                                invoice.invoiceTypeId === typeConfig.id ||
                                (invoice.numeroFacture && prefix && invoice.numeroFacture.toUpperCase().includes(prefix.toUpperCase())) ||
                                (invoice.typeFacture && invoice.typeFacture.toLowerCase().includes(typeConfig.name.toLowerCase()))
                              );

                              let typeName = typeConfig.name.replace(/^Facture\s+/i, '');

                              if (inv) {
                                const isPaid = inv.soldeDuFcfa === 0 || inv.statutPaiement === 'PAYE';
                                const isDefinitive = Boolean(inv.numeroFacture && inv.numeroFacture.startsWith('FA-'));
                                const rawStatus = inv.statutFacture || 'BROUILLON';
                                const isCancelled = rawStatus === 'ANNULEE' || rawStatus === 'AVOIR';
                                const isValidated = !isCancelled && (rawStatus === 'VALIDEE' || isPaid || isDefinitive || inv.statutPaiement === 'PARTIEL');
                                const isDraft = !isCancelled && !isValidated;
                                const isProforma = isDraft && !isPaid && !isDefinitive && !(inv.numeroFacture || '').startsWith('FA-');

                                return (
                                  <div key={typeConfig.id} className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-lg shadow-2xs transition-all min-w-[200px] ${
                                    isCancelled ? 'border-rose-200 bg-rose-50/50' :
                                    isValidated ? (isPaid ? 'border-emerald-200 bg-emerald-50/40' : 'border-blue-200 bg-blue-50/40') :
                                    'border-amber-200 bg-amber-50/40'
                                  }`}>
                                    {/* Statut Badge / Label */}
                                    <div className="flex flex-col text-left mr-1 flex-1 min-w-0">
                                      <span className="text-[10px] font-bold text-slate-800 flex items-center gap-1 leading-tight">
                                        {typeName}
                                        {isCancelled && (
                                          <span className="px-1 py-0.2 rounded text-[8px] font-extrabold uppercase bg-rose-600 text-white">
                                            Annulée
                                          </span>
                                        )}
                                        {isValidated && !isCancelled && !isPaid && (
                                          <span className="px-1 py-0.2 rounded text-[8px] font-extrabold uppercase bg-emerald-600 text-white">
                                            Validée
                                          </span>
                                        )}
                                        {!isValidated && !isCancelled && !isPaid && (
                                          <span className="px-1 py-0.2 rounded text-[8px] font-extrabold uppercase bg-amber-500 text-white">
                                            Attente Règlt
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-[9px] font-mono text-slate-600 truncate max-w-[150px] whitespace-nowrap" title={`${inv.numeroFacture} - ${Number(inv.montantTtcFcfa || 0).toLocaleString('fr-FR')} FCFA`}>
                                        {inv.numeroFacture} ({Number(inv.montantTtcFcfa || 0).toLocaleString('fr-FR')} F)
                                      </span>
                                    </div>

                                    {/* Primary Payment / Status Action */}
                                    {isCancelled ? (
                                      <button
                                        onClick={() => {
                                          const cn = (creditNotes || []).find(c => c.factureId === inv.id || c.numeroFactureOrigine === inv.numeroFacture);
                                          if (cn) {
                                            generateCreditNotePdf(cn, inv, matchedBl);
                                          } else {
                                            alert(`Facture annulée. Motif: ${inv.motifAnnulation || 'Annulée par Avoir'}`);
                                          }
                                        }}
                                        className="px-1.5 py-0.5 bg-rose-100 border border-rose-300 text-rose-800 font-bold rounded text-[9px] hover:bg-rose-200 transition-all inline-flex items-center gap-0.5 cursor-pointer shrink-0"
                                        title={`Facture Annulée - Voir l'Avoir (${inv.motifAnnulation || 'Motif non renseigné'})`}
                                      >
                                        <span className="material-symbols-outlined text-[10px] text-rose-600">assignment_return</span>
                                        <span>Voir Avoir</span>
                                      </button>
                                    ) : isPaid ? (
                                      <button
                                        onClick={() => {
                                          const payment = payments.find(p => p.factureId === inv.id);
                                          generateProformaPdf(inv, undefined, 'BOCS Maritime Agence Abidjan', payment);
                                        }}
                                        className="px-1.5 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold rounded text-[9px] hover:bg-emerald-200 transition-all inline-flex items-center gap-0.5 cursor-pointer shrink-0"
                                        title="Télécharger la Facture Réglée"
                                      >
                                        <span className="material-symbols-outlined text-[11px] text-emerald-700">check_circle</span>
                                        <span>Réglé</span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setPaymentFacture(inv);
                                          setPaymentMontant(inv.soldeDuFcfa);
                                          setShowPaymentModal(true);
                                        }}
                                        className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-all cursor-pointer shrink-0"
                                        title="Enregistrer un Règlement (Régler)"
                                      >
                                        <span className="material-symbols-outlined text-sm">price_check</span>
                                      </button>
                                    )}

                                    {/* Print PDF Button */}
                                    {!isCancelled && !isPaid && (
                                      <button
                                        onClick={() => {
                                          const payment = isPaid ? payments.find(p => p.factureId === inv.id) : undefined;
                                          generateProformaPdf(inv, undefined, 'BOCS Maritime Agence Abidjan', payment);
                                        }}
                                        className="p-1 text-slate-700 hover:text-blue-700 hover:bg-white rounded transition-all cursor-pointer shrink-0"
                                        title={isValidated ? "Imprimer Facture Définitive" : "Imprimer Facture Proforma"}
                                      >
                                        <span className="material-symbols-outlined text-xs">print</span>
                                      </button>
                                    )}

                                    {/* Action: Credit Note (if Validated and not cancelled) */}
                                    {isValidated && !isCancelled && (
                                      <button
                                        onClick={() => handleOpenCreditNoteModal(inv)}
                                        className="p-1 text-rose-600 hover:text-white hover:bg-rose-600 rounded transition-all cursor-pointer shrink-0"
                                        title="Annuler la facture / Émettre une Note d'Avoir fiscale"
                                      >
                                        <span className="material-symbols-outlined text-xs">cancel</span>
                                      </button>
                                    )}

                                    {/* Action: Delete (Only if Proforma) */}
                                    {isProforma && (
                                      <button
                                        onClick={() => {
                                          setInvoiceToDelete(inv);
                                          setShowDeleteInvoiceModal(true);
                                        }}
                                        className="p-1 text-rose-500 hover:text-white hover:bg-rose-600 rounded transition-all cursor-pointer shrink-0"
                                        title="Supprimer cette proforma"
                                      >
                                        <span className="material-symbols-outlined text-xs">delete</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              } else {
                                return (
                                  <div key={typeConfig.id} className="flex items-center gap-1.5 border border-slate-200 bg-slate-100 px-2.5 py-1 rounded-lg min-w-[155px]">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (matchedBl && onSelectBl) {
                                          onSelectBl(matchedBl.id);
                                          setActiveTab('FACTURATION_BL');
                                        }
                                      }}
                                      className={`px-2 py-0.5 bg-slate-200 text-slate-700 font-bold rounded text-[9px] flex items-center gap-1 transition-all ${
                                        matchedBl && onSelectBl ? 'hover:bg-blue-100 hover:text-blue-800 cursor-pointer' : 'cursor-default'
                                      }`}
                                      title={matchedBl && onSelectBl ? `Cliquer pour émettre la prestation ${typeName} pour ce BL` : "Facture non encore émise"}
                                    >
                                      <span className="material-symbols-outlined text-[10px] text-slate-500 font-bold">hourglass_empty</span>
                                      <span>{typeName} non émise</span>
                                    </button>
                                  </div>
                                );
                              }
                            })}

                            {/* Bon à Délivrer (DO/BAD) button shown for Import operations */}
                            {isImport && (
                              allInvoicesPaidAndGreen ? (
                                <button
                                  onClick={() => {
                                    const blToPrint: BL = matchedBl || {
                                      id: g.representative.id,
                                      escaleId: 0,
                                      numeroBL: blNumber,
                                      typeOperation: 'IMPORT',
                                      shipperNom: 'IMPORTATEURS DIVERS BOCS',
                                      shipperAdresse: '',
                                      consigneeNom: g.representative.clientNom,
                                      consigneeAdresse: '',
                                      notifyNom: g.representative.clientNom,
                                      notifyAdresse: '',
                                      portChargementCode: 'POL',
                                      portDechargementCode: 'ABIDJAN',
                                      destinationFinale: '',
                                      descriptionGoods: 'Cargo sous connaissement BOCS',
                                      nombreColis: 0,
                                      typeEmballage: 'COLIS',
                                      poidsBrutKg: 0,
                                      volumeM3: 0,
                                      conteneurs: []
                                    };
                                    const matchedEscale = escales.find(e => e.id === blToPrint.escaleId);
                                    generateDoBadPdf(blToPrint, matchedEscale);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold rounded-lg text-[10px] transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm border border-emerald-500"
                                  title="Générer et imprimer le Bon à Délivrer (DO / BAD)"
                                >
                                  <span className="material-symbols-outlined text-xs">verified</span>
                                  <span>DO/BAD</span>
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 font-extrabold rounded-lg text-[10px] flex items-center gap-1 cursor-not-allowed"
                                  title="Le Bon à Délivrer n'est activé que lorsque toutes les factures planifiées sont émises et réglées (boutons au vert)"
                                >
                                  <span className="material-symbols-outlined text-xs text-slate-500 font-bold">lock</span>
                                  <span>DO/BAD</span>
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: AVOIRS & NOTES DE CRÉDIT */}
      {activeTab === 'AVOIRS' && (
        <div className="space-y-6">
          {/* Summary Metric Cards for Credit Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bocs-card p-5 border-l-4 border-rose-500 bg-white shadow-sm rounded-xl">
              <span className="text-xs font-bold uppercase text-slate-500 block">Total Avoirs Émis</span>
              <span className="text-2xl font-extrabold text-rose-600 font-mono">
                {(creditNotes || []).reduce((sum, cn) => sum + cn.montantTtcFcfa, 0).toLocaleString('fr-FR')} FCFA
              </span>
              <p className="text-[11px] text-slate-400 mt-1">{(creditNotes || []).length} note(s) d'avoir enregistrée(s)</p>
            </div>

            <div className="bocs-card p-5 border-l-4 border-blue-500 bg-white shadow-sm rounded-xl">
              <span className="text-xs font-bold uppercase text-slate-500 block">TVA Régularisée (18%)</span>
              <span className="text-2xl font-extrabold text-blue-600 font-mono">
                {(creditNotes || []).reduce((sum, cn) => sum + cn.tvaFcfa, 0).toLocaleString('fr-FR')} FCFA
              </span>
              <p className="text-[11px] text-slate-400 mt-1">Crédit de TVA fiscale régularisé</p>
            </div>

            <div className="bocs-card p-5 border-l-4 border-emerald-500 bg-white shadow-sm rounded-xl">
              <span className="text-xs font-bold uppercase text-slate-500 block">Inaltérabilité & Conformité</span>
              <span className="text-2xl font-extrabold text-emerald-600 font-sans">
                100% Conforme
              </span>
              <p className="text-[11px] text-slate-400 mt-1">Numérotation continue et auditée AV-BOCS</p>
            </div>
          </div>

          {/* Credit Notes Table */}
          <div className="bocs-card overflow-hidden bg-white border border-slate-200/80 rounded-2xl shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600">assignment_return</span>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                  Registre Officiel des Notes d'Avoir & Annulations ({(creditNotes || []).length})
                </h3>
              </div>

              <div className="relative w-full sm:w-72">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  value={creditNotesSearch}
                  onChange={e => setCreditNotesSearch(e.target.value)}
                  placeholder="Rechercher avoir, facture, client..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[500px] bocs-scrollbar relative">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-700 text-white shadow-xs">
                  <tr className="text-[11px] font-extrabold uppercase border-b border-slate-600">
                    <th className="p-3">N° Avoir</th>
                    <th className="p-3">Date Émission</th>
                    <th className="p-3">Facture d'Origine</th>
                    <th className="p-3">Client / Consignataire</th>
                    <th className="p-3">Motif de l'Avoir</th>
                    <th className="p-3 text-right">Montant Crédit TTC</th>
                    <th className="p-3 text-center">Émetteur</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {((creditNotes || []).filter(cn => {
                    const q = creditNotesSearch.toLowerCase();
                    if (!q) return true;
                    return (
                      cn.numeroAvoir.toLowerCase().includes(q) ||
                      cn.numeroFactureOrigine.toLowerCase().includes(q) ||
                      cn.clientNom.toLowerCase().includes(q) ||
                      cn.motif.toLowerCase().includes(q)
                    );
                  })).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        <span className="material-symbols-outlined text-4xl block mb-2 text-slate-300">receipt_long</span>
                        Aucune note d'avoir émise pour le moment.
                      </td>
                    </tr>
                  ) : (
                    (creditNotes || []).filter(cn => {
                      const q = creditNotesSearch.toLowerCase();
                      if (!q) return true;
                      return (
                        cn.numeroAvoir.toLowerCase().includes(q) ||
                        cn.numeroFactureOrigine.toLowerCase().includes(q) ||
                        cn.clientNom.toLowerCase().includes(q) ||
                        cn.motif.toLowerCase().includes(q)
                      );
                    }).map(cn => {
                      const originalInv = invoices.find(i => i.id === cn.factureId || i.numeroFacture === cn.numeroFactureOrigine);
                      const matchedBl = originalInv ? bls.find(b => b.numeroBL === originalInv.numeroBL) : undefined;
                      return (
                        <tr key={cn.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-rose-600">
                            <span className="bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-xs">
                              {cn.numeroAvoir}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-600">{cn.dateEmission}</td>
                          <td className="p-3 font-mono font-bold text-slate-700">{cn.numeroFactureOrigine}</td>
                          <td className="p-3 font-semibold text-slate-900">{cn.clientNom}</td>
                          <td className="p-3 text-slate-700 max-w-xs truncate" title={cn.motif}>
                            <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-medium">
                              {cn.motif}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-rose-600 text-right">
                            -{cn.montantTtcFcfa.toLocaleString('fr-FR')} FCFA
                          </td>
                          <td className="p-3 text-center text-slate-500 text-[11px]">{cn.createdBy || 'Comptabilité'}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => generateCreditNotePdf(cn, originalInv, matchedBl)}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-all inline-flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Télécharger / Imprimer la Note d'Avoir PDF"
                            >
                              <span className="material-symbols-outlined text-xs">picture_as_pdf</span>
                              <span>Imprimer Avoir</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BALANCE AGEE & REGLEMENTS */}
      {activeTab === 'BALANCE_AGEE' && (
        <div className="space-y-6">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bocs-card p-5 border-l-4 border-error">
              <span className="text-xs font-bold uppercase text-outline block">Total Encours & Solde Dû</span>
              <span className="text-2xl font-extrabold text-error font-mono">{totalSoldeDu.toLocaleString('fr-FR')} FCFA</span>
              <p className="text-[11px] text-outline mt-1">Créances clients à recouvrer</p>
            </div>

            <div className="bocs-card p-5 border-l-4 border-emerald-500">
              <span className="text-xs font-bold uppercase text-outline block">Total Règlements Encaissés</span>
              <span className="text-2xl font-extrabold text-emerald-600 font-mono">{totalPaye.toLocaleString('fr-FR')} FCFA</span>
              <p className="text-[11px] text-outline mt-1">Paiements validés</p>
            </div>

            <div className="bocs-card p-5 border-l-4 border-secondary">
              <span className="text-xs font-bold uppercase text-outline block">Ratio de Recouvrement</span>
              <span className="text-2xl font-extrabold text-secondary font-mono">
                {((totalPaye / (totalPaye + totalSoldeDu || 1)) * 100).toFixed(1)}%
              </span>
              <p className="text-[11px] text-outline mt-1">Objectif mensuel: 95%</p>
            </div>
          </div>

          {/* Aged Balance Categories breakdown */}
          <div className="bocs-card p-6 space-y-4">
            <h3 className="font-bold text-primary text-sm uppercase tracking-wider border-b border-outline-variant pb-2">
              Ventilation de la Balance par Tranche
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-center space-y-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">0 - 30 Jours</span>
                <p className="font-mono font-bold text-lg text-emerald-800">{agedBalance.t0_30.toLocaleString('fr-FR')} FCFA</p>
                <p className="text-[10px] text-emerald-600">Échéance normale</p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded text-center space-y-1">
                <span className="text-[10px] font-bold text-amber-700 uppercase">31 - 60 Jours</span>
                <p className="font-mono font-bold text-lg text-amber-800">{agedBalance.t31_60.toLocaleString('fr-FR')} FCFA</p>
                <p className="text-[10px] text-amber-600">Relance 1 transmise</p>
              </div>

              <div className="p-4 bg-orange-50 border border-orange-200 rounded text-center space-y-1">
                <span className="text-[10px] font-bold text-orange-700 uppercase">61 - 90 Jours</span>
                <p className="font-mono font-bold text-lg text-orange-800">{agedBalance.t61_90.toLocaleString('fr-FR')} FCFA</p>
                <p className="text-[10px] text-orange-600">Mise en demeure</p>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-200 rounded text-center space-y-1">
                <span className="text-[10px] font-bold text-rose-700 uppercase">&gt; 90 Jours (Contentieux)</span>
                <p className="font-mono font-bold text-lg text-rose-800">{agedBalance.t90plus.toLocaleString('fr-FR')} FCFA</p>
                <p className="text-[10px] text-rose-600">Bloqué au parc</p>
              </div>
            </div>
          </div>

          {/* Payments History Table */}
          <div className="bocs-card overflow-hidden">
            <div className="p-4 bg-surface-container-low border-b border-outline-variant">
              <h3 className="font-bold text-primary text-sm uppercase tracking-wider">
                Historique des Règlements Enregistrés ({payments.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container-high text-[11px] font-bold uppercase text-on-surface-variant">
                    <th className="p-3">Facture Réf</th>
                    <th className="p-3">Date Paiement</th>
                    <th className="p-3">Mode</th>
                    <th className="p-3">Réf Transaction</th>
                    <th className="p-3">Montant Réglé</th>
                    <th className="p-3">Opérateur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-surface-container-low font-mono">
                      <td className="p-3 font-bold text-primary">{p.numeroFacture}</td>
                      <td className="p-3 text-on-surface-variant">{p.datePaiement}</td>
                      <td className="p-3 font-bold text-secondary">{p.modePaiement}</td>
                      <td className="p-3 text-outline">{p.referenceTransaction}</td>
                      <td className="p-3 font-bold text-emerald-600">{(p.montantFcfa || 0).toLocaleString()} FCFA</td>
                      <td className="p-3 text-on-surface-variant font-sans text-[11px]">{p.saisiPar}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: TARIFS SURESTARIES */}
      {activeTab === 'TARIFS' && (
        <div className="bocs-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-outline-variant pb-4 gap-4">
            <div>
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">tune</span>
                <span>Configuration des Grilles Tarifaires</span>
              </h2>
              <p className="text-xs text-on-surface-variant">Paramétrage des tranches tarifaires de surestaries et de détentions.</p>
            </div>
            <button
              onClick={() => {
                if (tariffFilterOpType === 'EXPORT') {
                  setNewTarifOpType('EXPORT');
                  setNewTarifRegime('DETENTION');
                } else {
                  setNewTarifOpType(tariffFilterOpType);
                  setNewTarifRegime(tariffFilterRegime);
                }
                setShowAddTarifModal(true);
              }}
              className="px-4 py-2 bg-[#005daa] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-sm">add_box</span>
              <span>Ajouter une Tranche</span>
            </button>
          </div>

          {/* Filters controls */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Flux d'opération</span>
              <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setTariffFilterOpType('IMPORT')}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    tariffFilterOpType === 'IMPORT' 
                      ? 'bg-[#005daa] text-white' 
                      : 'text-slate-650 hover:bg-slate-50'
                  }`}
                >
                  IMPORT
                </button>
                <button
                  type="button"
                  onClick={() => setTariffFilterOpType('EXPORT')}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    tariffFilterOpType === 'EXPORT' 
                      ? 'bg-[#005daa] text-white' 
                      : 'text-slate-650 hover:bg-slate-50'
                  }`}
                >
                  EXPORT
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Régime tarifaire</span>
              <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-2xs">
                <button
                  type="button"
                  disabled={tariffFilterOpType === 'EXPORT'}
                  onClick={() => setTariffFilterRegime('SURESTARIE')}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    tariffFilterRegime === 'SURESTARIE' 
                      ? 'bg-secondary text-white' 
                      : (tariffFilterOpType === 'EXPORT' 
                          ? 'text-slate-300 cursor-not-allowed opacity-50' 
                          : 'text-slate-650 hover:bg-slate-50')
                  }`}
                  title={tariffFilterOpType === 'EXPORT' ? "Pas de surestaries à l'export" : "Surestaries (DMDT)"}
                >
                  SURESTARISE {tariffFilterOpType === 'EXPORT' && '🔒'}
                </button>
                <button
                  type="button"
                  onClick={() => setTariffFilterRegime('DETENTION')}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    tariffFilterRegime === 'DETENTION' 
                      ? 'bg-secondary text-white' 
                      : 'text-slate-650 hover:bg-slate-50'
                  }`}
                >
                  DÉTENTION
                </button>
              </div>
            </div>

            {tariffFilterOpType === 'EXPORT' && (
              <div className="ml-auto flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-lg font-medium self-end">
                <span className="material-symbols-outlined text-sm">info</span>
                <span>Note : Seul le régime de Détention est disponible pour l'Export.</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[480px] bocs-scrollbar relative border border-slate-100 rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-600/95 backdrop-blur-md shadow-xs">
                <tr className="text-[11px] font-extrabold text-white uppercase border-b border-slate-500/30">
                  <th className="p-3">Type Conteneur</th>
                  <th className="p-3">Régime</th>
                  <th className="p-3">Opération</th>
                  <th className="p-3">Franchise</th>
                  <th className="p-3">Palier Jours Début</th>
                  <th className="p-3">Palier Jours Fin</th>
                  <th className="p-3">Tarif Journalier (FCFA)</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant bg-white">
                {tarifs
                  .filter(t => 
                    (t.typeOperation || 'IMPORT') === tariffFilterOpType &&
                    (t.regime || 'SURESTARIE') === tariffFilterRegime
                  )
                  .map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-800">{t.typeConteneur}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.regime === 'DETENTION' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {t.regime || 'SURESTARIE'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.typeOperation === 'EXPORT' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {t.typeOperation || 'IMPORT'}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-600 text-center">{t.joursFranchise !== undefined ? `${t.joursFranchise} j` : '-'}</td>
                      <td className="p-3 font-mono text-slate-600">Jour {t.jourDebut}</td>
                      <td className="p-3 font-mono text-slate-600">{t.jourFin === 999 ? 'Au-delà' : `Jour ${t.jourFin}`}</td>
                      <td className="p-3 font-mono font-bold text-secondary">{(t.tarifJournalierFcfa || 0).toLocaleString()} FCFA</td>
                      <td className="p-3 text-right flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingTarif(t)}
                          className="px-2.5 py-1 bg-blue-50 border border-blue-200 hover:bg-[#005daa] hover:text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">edit</span>
                          <span>Éditer</span>
                        </button>
                        {deletingTarifId === t.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteTarifClick(t)}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                            >
                              Confirmer ?
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingTarifId(null)}
                              className="px-2 py-1 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingTarifId(t.id || null)}
                            className="px-2.5 py-1 bg-rose-50 border border-rose-200 hover:bg-rose-600 hover:text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                            <span>Supprimer</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                {tarifs.filter(t => 
                  (t.typeOperation || 'IMPORT') === tariffFilterOpType &&
                  (t.regime || 'SURESTARIE') === tariffFilterRegime
                ).length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                      Aucune tranche tarifaire définie pour ce régime et cette opération.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Payment Form */}
      {showPaymentModal && paymentFacture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">price_check</span>
                <span>Enregistrer un Règlement</span>
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-surface-container rounded space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-outline font-bold uppercase">Facture Cible</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded uppercase font-bold">
                    {invoiceTypeConfigs.find(c => c.id === paymentFacture.invoiceTypeId)?.name || paymentFacture.typeFacture.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="font-bold font-mono text-primary text-sm">{paymentFacture.numeroFacture}</p>
                <p className="text-on-surface font-semibold">{paymentFacture.clientNom}</p>
              </div>

              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Montant du Règlement (FCFA)</label>
                <input
                  type="text"
                  required
                  value={paymentMontant === 0 ? '' : paymentMontant.toLocaleString('fr-FR')}
                  onChange={e => {
                    const rawValue = e.target.value.replace(/[^0-9]/g, '');
                    const numValue = parseInt(rawValue, 10) || 0;
                    const maxLimit = Number(paymentFacture.soldeDuFcfa || 0);
                    setPaymentMontant(Math.min(numValue, maxLimit));
                  }}
                  className="w-full h-10 px-3 bg-surface border border-outline-variant rounded font-mono font-bold text-emerald-600 text-sm"
                />
                <span className="text-[10px] text-outline mt-1 block">Solde dût actuel: {Number(paymentFacture.soldeDuFcfa || 0).toLocaleString('fr-FR')} FCFA</span>
              </div>

              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Mode de Paiement</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value as any)}
                  className="w-full h-10 px-3 bg-[#ffe135] hover:bg-[#ffe855] text-[#0f172a] border border-[#e5c122] rounded-xl font-black cursor-pointer outline-none transition-all"
                >
                  <option value="VIREMENT">Virement Bancaire</option>
                  <option value="CHEQUE">Chèque Certifié</option>
                  <option value="ESPECES">Espèces (Caisse Port)</option>
                  <option value="MOBILE_MONEY">Mobile Money Business</option>
                </select>
              </div>

              {['VIREMENT', 'CHEQUE'].includes(paymentMode) && (
                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Référence Transaction / Chèque</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    placeholder="ex: VIR-BNI-99201"
                    className="w-full h-10 px-3 bg-surface border border-outline-variant rounded font-mono"
                  />
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded hover:bg-emerald-700 transition-all shadow"
                >
                  Valider le Règlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Tarif */}
      {editingTarif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-slate-800">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#005daa]">edit</span>
                <span>Éditer la Tranche Tarifaire</span>
              </h3>
              <button onClick={() => setEditingTarif(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-505 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateTarif} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Conteneur</label>
                  <input
                    type="text"
                    disabled
                    value={editingTarif.typeConteneur}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded font-bold text-slate-600 text-center"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Opération</label>
                  <input
                    type="text"
                    disabled
                    value={editingTarif.typeOperation || 'IMPORT'}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded font-bold text-slate-600 text-center"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Régime</label>
                  <input
                    type="text"
                    disabled
                    value={editingTarif.regime || 'SURESTARIE'}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded font-bold text-slate-600 text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Jour Début</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editingTarif.jourDebut}
                    onChange={e => setEditingTarif({ ...editingTarif, jourDebut: parseInt(e.target.value, 10) || 1 })}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Jour Fin (999 = Max)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editingTarif.jourFin}
                    onChange={e => setEditingTarif({ ...editingTarif, jourFin: parseInt(e.target.value, 10) || 999 })}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Jours Franchise</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingTarif.joursFranchise || 0}
                    onChange={e => setEditingTarif({ ...editingTarif, joursFranchise: parseInt(e.target.value, 10) || 0 })}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded font-mono font-bold text-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Tarif Journalier (FCFA)</label>
                  <input
                    type="number"
                    required
                    value={editingTarif.tarifJournalierFcfa}
                    onChange={e => setEditingTarif({ ...editingTarif, tarifJournalierFcfa: parseFloat(e.target.value) || 0 })}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded font-mono font-bold text-secondary text-sm"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTarif(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-700 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#005daa] text-white font-bold rounded-xl hover:bg-blue-700 shadow transition-all active:scale-95 cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Tarif */}
      {showAddTarifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-slate-800">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#005daa]">add_box</span>
                <span>Ajouter une Tranche Tarifaire</span>
              </h3>
              <button onClick={() => setShowAddTarifModal(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddTarifSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Type de Conteneur</label>
                <select
                  value={newTarifTypeCtn}
                  onChange={e => setNewTarifTypeCtn(e.target.value as ContainerType)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded font-bold text-slate-800 outline-none"
                >
                  <option value="20_DRY">20' Dry</option>
                  <option value="40_DRY">40' Dry</option>
                  <option value="40_HC">40' High Cube (HC)</option>
                  <option value="20_REEFER">20' Reefer</option>
                  <option value="40_REEFER">40' Reefer</option>
                  <option value="20_OPEN_TOP">20' Open Top</option>
                  <option value="40_OPEN_TOP">40' Open Top</option>
                  <option value="20_FLAT_RACK">20' Flat Rack</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Opération</label>
                  <select
                    value={newTarifOpType}
                    onChange={e => setNewTarifOpType(e.target.value as any)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded font-bold text-slate-800 outline-none"
                  >
                    <option value="IMPORT">IMPORT</option>
                    <option value="EXPORT">EXPORT</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Régime</label>
                  <select
                    value={newTarifRegime}
                    disabled={newTarifOpType === 'EXPORT'}
                    onChange={e => setNewTarifRegime(e.target.value as any)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded font-bold text-slate-800 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="SURESTARIE">SURESTARIE (DMDT)</option>
                    <option value="DETENTION">DÉTENTION</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Jour Début</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newTarifJourDebut}
                    onChange={e => setNewTarifJourDebut(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Jour Fin (999 = Max)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newTarifJourFin}
                    onChange={e => setNewTarifJourFin(parseInt(e.target.value, 10) || 999)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Jours Franchise</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newTarifFranchise}
                    onChange={e => setNewTarifFranchise(parseInt(e.target.value, 10) || 0)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded font-mono font-bold text-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Tarif Journalier (FCFA)</label>
                  <input
                    type="number"
                    required
                    value={newTarifRate}
                    onChange={e => setNewTarifRate(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded font-mono font-bold text-secondary text-sm"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTarifModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-700 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow transition-all active:scale-95 cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: CONFIGURATION DES FACTURES */}
      {activeTab === 'CONFIG' && (
        <div className="space-y-6">
          
          {/* Title & Subtitle Banner with '+ Nouveau Type' button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#00182f] font-heading flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa] text-xl">settings_suggest</span>
                <span>Configuration des Factures & Tarifs</span>
              </h2>
              <p className="text-xs text-slate-500">
                Gérez et modifiez librement les types de factures, leurs rubriques tarifaires et les montants unitaires par catégorie.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddTypeModal(true)}
              className="px-4 py-2.5 bg-[#0b172a] hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow cursor-pointer active:scale-95 shrink-0"
            >
              <span className="material-symbols-outlined text-sm font-bold">add</span>
              <span>Nouveau Type de Facture</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-slate-900">
            
            {/* Left Panel: Types de Factures (4 columns) */}
            <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#005DAA] text-sm">list</span>
                  <span>Types de Factures</span>
                </h3>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowAddTypeModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#005DAA] hover:bg-[#004580] text-white rounded-lg text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Créer un nouveau type de facture"
                  >
                    <span className="material-symbols-outlined text-sm font-black">add</span>
                    <span>Nouveau Type</span>
                  </button>
                </div>
              </div>

              {/* Search input for types */}
              <div className="p-3 border-b border-slate-100 bg-slate-50/20">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input
                    type="text"
                    value={searchTypeQuery}
                    onChange={(e) => setSearchTypeQuery(e.target.value)}
                    placeholder="Filtrer les types..."
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-all bg-slate-50/50 text-slate-800"
                  />
                </div>
              </div>

              {/* List of types */}
              <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto bocs-scrollbar">
                {invoiceTypeConfigs
                  .filter(t => t.name.toLowerCase().includes(searchTypeQuery.toLowerCase()))
                  .map(t => {
                    const isSelected = t.id === selectedInvoiceTypeId;
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedInvoiceTypeId(t.id);
                          const isCaution = t.name.toLowerCase().includes('caution') || t.id === '1';
                          const isTransfert = t.name.toLowerCase().includes('transfert') || t.id === '4';
                          const isEchange = t.name.toLowerCase().includes('echange') || t.id === '2';
                          if (isCaution || isTransfert) {
                            setActiveCategory('CONTENEUR');
                          } else if (isEchange) {
                            if (activeCategory === 'CONTENEUR' || activeCategory === 'CONTENEUR_SOC') {
                              setActiveCategory('CONTENEUR_COC');
                            }
                          } else if (activeCategory === 'CONTENEUR_COC' || activeCategory === 'CONTENEUR_SOC') {
                            setActiveCategory('CONTENEUR');
                          }
                        }}
                        className={`p-4 flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#072B53] text-white font-semibold'
                            : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <p className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {t.name}
                          </p>
                          <p className={`text-[10px] ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>
                            {t.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingInvoiceType(t);
                                setEditTypeName(t.name);
                                setEditTypeDescription(t.description);
                                setShowEditTypeModal(true);
                              }}
                              className="p-1 hover:bg-white/10 rounded text-blue-200 hover:text-white transition-all cursor-pointer"
                              title="Modifier ce type"
                            >
                              <span className="material-symbols-outlined text-sm font-bold">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteInvoiceTypeClick(t);
                              }}
                              className="p-1 hover:bg-rose-500/20 rounded text-rose-300 hover:text-rose-100 transition-all cursor-pointer"
                              title="Supprimer ce type"
                            >
                              <span className="material-symbols-outlined text-sm font-bold">delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                {invoiceTypeConfigs.filter(t => t.name.toLowerCase().includes(searchTypeQuery.toLowerCase())).length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Aucun type trouvé.
                  </div>
                )}
              </div>

              {/* Bottom Quick Action Button */}
              <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowAddTypeModal(true)}
                  className="w-full py-2.5 px-3 border border-dashed border-[#005DAA]/40 hover:border-[#005DAA] bg-[#F0F7FF]/60 hover:bg-[#F0F7FF] text-[#005DAA] font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  <span>+ Ajouter un nouveau type de facture</span>
                </button>
              </div>
            </div>

            {/* Right Panel: Configuration details (8 columns) */}
            <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              {activeInvoiceType ? (
                <div>
                  
                  {/* Panel Header */}
                  <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/40">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#00182f] font-heading">
                          Configuration: {activeInvoiceType.name}
                        </h3>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                          Modifiable
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {activeInvoiceType.name.toLowerCase().includes('caution') || activeInvoiceType.id === '1'
                          ? "La caution ne s'applique exclusivement qu'aux conteneurs."
                          : (activeInvoiceType.name.toLowerCase().includes('surestarie') || activeInvoiceType.name.toLowerCase().includes('detention') || activeInvoiceType.name.toLowerCase().includes('détention'))
                          ? "Les surestaries et détentions ne concernent exclusivement que les conteneurs."
                          : "Définissez et personnalisez les rubriques applicables selon le type de marchandise."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setNewRubriqueName('');
                          setNewRubriqueDescription('');
                          setNewRubriqueCode('');
                          setNewRubriqueAmount(0);
                          setNewRubriqueIsActive(true);
                          setShowAddRubriqueModal(true);
                        }}
                        className="px-3 py-2 bg-[#F0F7FF] hover:bg-[#E1EFFF] text-[#005DAA] border border-[#005DAA]/30 font-bold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-base">add_circle</span>
                        <span>Ajouter rubrique</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveConfig}
                        className="px-4 py-2 bg-[#005DAA] hover:bg-[#004580] text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-base">save</span>
                        <span>Enregistrer</span>
                      </button>
                    </div>
                  </div>

                  {/* Fret Category Tabs */}
                  {(() => {
                    const isCaution = activeInvoiceType.name.toLowerCase().includes('caution') || activeInvoiceType.id === '1';
                    const isTransfert = activeInvoiceType.name.toLowerCase().includes('transfert') || activeInvoiceType.id === '4';
                    const isEchange = activeInvoiceType.name.toLowerCase().includes('echange') || activeInvoiceType.id === '2';
                    const isSurestarieOrDetention = 
                      activeInvoiceType.name.toLowerCase().includes('surestarie') ||
                      activeInvoiceType.name.toLowerCase().includes('detention') ||
                      activeInvoiceType.name.toLowerCase().includes('détention');

                    const allowedCategories: FretCategory[] = (isCaution || isTransfert || isSurestarieOrDetention)
                      ? ['CONTENEUR']
                      : isEchange
                      ? ['CONTENEUR_COC', 'CONTENEUR_SOC', 'VRAC', 'RORO', 'CONVENTIONNEL']
                      : ['CONTENEUR', 'VRAC', 'RORO', 'CONVENTIONNEL'];

                    return (
                      <div className="border-b border-slate-100 bg-white">
                        <div className="flex border-b border-slate-200/60 px-4 gap-4 overflow-x-auto bocs-scrollbar">
                          {allowedCategories.map(cat => {
                            const label = 
                              cat === 'CONTENEUR_COC' ? 'Conteneur COC' :
                              cat === 'CONTENEUR_SOC' ? 'Conteneur SOC' :
                              cat === 'CONTENEUR' ? 'Conteneur' :
                              cat === 'VRAC' ? 'Vrac' :
                              cat === 'RORO' ? 'Ro-Ro' : 'Conventionnel';
                            const isCatSelected = cat === activeCategory;
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-3 text-xs font-bold transition-all border-b-2 -mb-[1px] cursor-pointer whitespace-nowrap ${
                                  isCatSelected
                                    ? 'border-[#005daa] text-[#005daa]'
                                    : 'border-transparent text-slate-500 hover:text-slate-900'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Grid of Rubrique Cards */}
                  <div className="p-6 bg-slate-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {localRubriques
                        .filter(r => r.invoiceTypeId === selectedInvoiceTypeId && (r.category === activeCategory || (activeCategory === 'CONTENEUR_COC' && r.category === 'CONTENEUR')))
                        .map(rub => (
                          <div 
                            key={rub.id} 
                            className={`p-4 rounded-xl border transition-all bg-white relative group ${
                              rub.isActive 
                                ? 'border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-sm' 
                                : 'border-slate-100 opacity-60 bg-slate-50/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 pr-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 
                                    className="text-xs font-bold text-[#0f172a] hover:text-[#005daa] transition-colors cursor-pointer"
                                    onClick={() => {
                                      setEditingRubrique(rub);
                                      setEditRubriqueName(rub.name);
                                      setEditRubriqueDescription(rub.description);
                                      setEditRubriqueCode(rub.code);
                                      setEditRubriqueAmount(rub.montantUnitaire);
                                      setEditRubriqueBaseCalcul(rub.baseCalcul || 'BL');
                                      setShowEditRubriqueModal(true);
                                    }}
                                    title="Cliquez pour modifier les détails de cette rubrique"
                                  >
                                    {rub.name}
                                  </h4>
                                  {!rub.isActive && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded">
                                      Inactif
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-2">
                                  {rub.description || 'Aucune description'}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                    Code: {rub.code}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-medium bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded">
                                    Base: {
                                      rub.baseCalcul === 'TEU' ? 'Facturé par TEU' : rub.baseCalcul === 'CONTENEUR' ? 'Par conteneur' :
                                      rub.baseCalcul === 'POIDS_TONNE' ? 'Par Tonne brut' : 'Facturé au BL'
                                    }
                                  </span>
                                </div>
                              </div>
                              
                              {/* Action controls */}
                              <div className="flex items-center gap-1 shrink-0 bg-slate-50 p-1 rounded-lg border border-slate-200/60">
                                {/* Price Update & History button */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenPriceModal(rub)}
                                  className="p-1 text-slate-500 hover:text-[#005DAA] hover:bg-white rounded transition-all cursor-pointer shadow-2xs"
                                  title="Mettre à jour le prix unitaire et voir l'historique"
                                >
                                  <span className="material-symbols-outlined text-sm font-bold">history</span>
                                </button>

                                {/* Edit button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRubrique(rub);
                                    setEditRubriqueName(rub.name);
                                    setEditRubriqueDescription(rub.description);
                                    setEditRubriqueCode(rub.code);
                                    setEditRubriqueAmount(rub.montantUnitaire);
                                    setEditRubriqueBaseCalcul(rub.baseCalcul || 'BL');
                                    setShowEditRubriqueModal(true);
                                  }}
                                  className="p-1 text-slate-500 hover:text-[#005daa] hover:bg-white rounded transition-all cursor-pointer shadow-2xs"
                                  title="Modifier la rubrique (nom, code, base de calcul...)"
                                >
                                  <span className="material-symbols-outlined text-sm font-bold">edit</span>
                                </button>

                                {/* Delete button */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRubriqueClick(rub)}
                                  className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded transition-all cursor-pointer shadow-2xs"
                                  title="Supprimer la rubrique"
                                >
                                  <span className="material-symbols-outlined text-sm font-bold">delete</span>
                                </button>

                                {/* Toggle switch */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleLocalRubrique(rub.id)}
                                  title={rub.isActive ? "Désactiver cette rubrique" : "Activer cette rubrique"}
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-0.5 ${
                                    rub.isActive ? 'bg-[#005daa]' : 'bg-slate-300'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      rub.isActive ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Montant Unitaire editable field */}
                            <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm text-[#005DAA]">payments</span>
                                  MONTANT UNITAIRE:
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenPriceModal(rub)}
                                  className="p-1.5 bg-[#F0F7FF] hover:bg-[#E1EFFF] text-[#005DAA] border border-[#005DAA]/30 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                                  title="Mettre à jour le prix avec date d'effet & voir l'historique"
                                >
                                  <span className="material-symbols-outlined text-xs font-bold">update</span>
                                  <span className="text-[10px]">Mettre à jour</span>
                                </button>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={rub.montantUnitaire ? rub.montantUnitaire.toLocaleString('fr-FR') : (rub.montantUnitaire === 0 ? '0' : '')}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/g, '');
                                    handleChangeLocalRubriqueAmount(rub.id, raw === '' ? 0 : parseInt(raw, 10));
                                  }}
                                  className="w-36 h-10 px-3.5 border-2 border-slate-300 hover:border-slate-400 focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/20 rounded-full text-center font-mono font-black text-slate-900 bg-white focus:outline-none text-base transition-all shadow-2xs"
                                  placeholder="0"
                                />
                                <span className="text-xs font-bold text-slate-400 font-mono">FCFA</span>
                              </div>
                            </div>
                          </div>
                        ))}

                      {/* Ajouter une rubrique dotted card */}
                      <button
                        type="button"
                        onClick={() => {
                          setNewRubriqueName('');
                          setNewRubriqueDescription('');
                          setNewRubriqueCode('');
                          setNewRubriqueAmount(0);
                          setNewRubriqueIsActive(true);
                          setShowAddRubriqueModal(true);
                        }}
                        className="p-4 rounded-xl border border-dashed border-[#005DAA]/40 hover:border-[#005DAA] bg-[#F0F7FF]/40 hover:bg-[#F0F7FF]/80 flex flex-col items-center justify-center gap-1 transition-all min-h-[142px] group cursor-pointer text-[#005DAA] shadow-2xs active:scale-98"
                      >
                        <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">add_circle</span>
                        <span className="text-xs font-bold">Ajouter une rubrique</span>
                        <span className="text-[10px] text-slate-400 font-semibold">+ Nom, Code & Montant Unitaire</span>
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Sélectionnez un type de facture pour afficher sa configuration.
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* Modals for Invoice Config */}
      {/* Modal Add Invoice Type */}
      {showAddTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-[#00182f] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa] text-xl">add_circle</span>
                <span>Nouveau Type de Facture</span>
              </h3>
              <button 
                onClick={() => setShowAddTypeModal(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddInvoiceType} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Nom du Type</label>
                <input
                  type="text"
                  required
                  value={newTypeName}
                  onChange={e => setNewTypeName(e.target.value)}
                  placeholder="ex: Surestaries, Caution, Dossier..."
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Description / Libellé court</label>
                <input
                  type="text"
                  value={newTypeDescription}
                  onChange={e => setNewTypeDescription(e.target.value)}
                  placeholder="ex: Facturation des surestaries import..."
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTypeModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#005daa] text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow cursor-pointer"
                >
                  Créer le Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Invoice Type */}
      {showEditTypeModal && editingInvoiceType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-[#00182f] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa] text-xl">edit</span>
                <span>Modifier le Type de Facture</span>
              </h3>
              <button 
                onClick={() => { setShowEditTypeModal(false); setEditingInvoiceType(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditInvoiceType} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Nom du Type</label>
                <input
                  type="text"
                  required
                  value={editTypeName}
                  onChange={e => setEditTypeName(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Description / Libellé court</label>
                <input
                  type="text"
                  value={editTypeDescription}
                  onChange={e => setEditTypeDescription(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowEditTypeModal(false); setEditingInvoiceType(null); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#005daa] text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Delete Invoice Type Confirmation */}
      {showDeleteTypeModal && typeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-rose-600 flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-xl">warning</span>
                <span>Supprimer le Type de Facture</span>
              </h3>
              <button 
                onClick={() => { setShowDeleteTypeModal(false); setTypeToDelete(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Êtes-vous sûr de vouloir supprimer définitivement le type de facture <strong className="text-slate-900 font-bold">"{typeToDelete.name}"</strong> ?
              </p>
              <p className="text-rose-600/80 font-bold bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                Attention : Toutes les rubriques associées à ce type de facture pour toutes les catégories seront également supprimées. Cette action est irréversible.
              </p>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => { setShowDeleteTypeModal(false); setTypeToDelete(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteInvoiceType}
                className="px-5 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-all shadow cursor-pointer"
              >
                Supprimer Définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Rubrique */}
      {showEditRubriqueModal && editingRubrique && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-[#00182f] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa] text-xl">edit</span>
                <span>Modifier la Rubrique</span>
              </h3>
              <button 
                onClick={() => { setShowEditRubriqueModal(false); setEditingRubrique(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditRubrique} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Nom de la rubrique</label>
                <input
                  type="text"
                  required
                  value={editRubriqueName}
                  onChange={e => setEditRubriqueName(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Description / Explication</label>
                <input
                  type="text"
                  value={editRubriqueDescription}
                  onChange={e => setEditRubriqueDescription(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Base de calcul</label>
                <select
                  value={editRubriqueBaseCalcul}
                  onChange={e => setEditRubriqueBaseCalcul(e.target.value as CalculationBase)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
                >
                  <option value="BL">Facturé au BL (Montant fixe)</option>
                  <option value="TEU">Facturé par TEU</option>
                  {(activeCategory === 'CONTENEUR' || activeCategory === 'CONTENEUR_COC' || activeCategory === 'CONTENEUR_SOC') && <option value="CONTENEUR">Par conteneur du BL</option>}
                  <option value="POIDS_TONNE">Par Tonne de poids brut du BL</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Code Tarifaire</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      value={editRubriqueCode}
                      onChange={e => setEditRubriqueCode(e.target.value.toUpperCase())}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-blue-600 focus:outline-none text-xs uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const autoCode = suggestTariffCode(editRubriqueName);
                        if (autoCode) setEditRubriqueCode(autoCode);
                      }}
                      title="Générer automatiquement le code selon le libellé"
                      className="h-10 px-2.5 bg-blue-50 hover:bg-blue-100 text-[#005daa] border border-blue-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">auto_awesome</span>
                      <span className="text-[10px]">Auto</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Montant Unitaire (FCFA)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={editRubriqueAmount ? editRubriqueAmount.toLocaleString('fr-FR') : (editRubriqueAmount === 0 ? '0' : '')}
                    onChange={e => {
                      const raw = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/g, '');
                      setEditRubriqueAmount(raw === '' ? 0 : parseInt(raw, 10));
                    }}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold text-right focus:bg-white focus:border-blue-600 focus:outline-none text-sm"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowEditRubriqueModal(false); setEditingRubrique(null); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#005daa] text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Delete Rubrique Confirmation */}
      {showDeleteConfirmModal && rubriqueToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-rose-600 flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-xl">warning</span>
                <span>Supprimer la Rubrique</span>
              </h3>
              <button 
                onClick={() => { setShowDeleteConfirmModal(false); setRubriqueToDelete(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Êtes-vous sûr de vouloir supprimer définitivement la rubrique <strong className="text-slate-900 font-bold">"{rubriqueToDelete.name}"</strong> (Code: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded font-bold">{rubriqueToDelete.code}</code>) ?
              </p>
              <p className="text-rose-600/80 font-bold bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                Cette action supprimera la rubrique pour la catégorie en cours et est irréversible.
              </p>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirmModal(false); setRubriqueToDelete(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteRubrique}
                className="px-5 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-all shadow cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Add Rubrique */}
      {showAddRubriqueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-[#00182f] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa] text-xl">add_circle</span>
                <span>Ajouter une Rubrique</span>
              </h3>
              <button 
                onClick={() => setShowAddRubriqueModal(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddRubrique} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-0.5">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Cible de la configuration</p>
                <p className="font-bold text-[#00182f] text-xs">
                  Type : {activeInvoiceType?.name} | Catégorie : {
                    activeCategory === 'CONTENEUR_COC' ? 'Conteneur COC' :
                    activeCategory === 'CONTENEUR_SOC' ? 'Conteneur SOC' :
                    activeCategory === 'CONTENEUR' ? 'Conteneur' :
                    activeCategory === 'VRAC' ? 'Vrac' :
                    activeCategory === 'RORO' ? 'Ro-Ro' : 'Conventionnel'
                  }
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Nom de la rubrique</label>
                <input
                  type="text"
                  required
                  value={newRubriqueName}
                  onChange={e => {
                      const val = e.target.value;
                      setNewRubriqueName(val);
                      const autoCode = suggestTariffCode(val);
                      if (autoCode) setNewRubriqueCode(autoCode);
                    }}
                  placeholder="ex: Frais d'ouverture de dossier..."
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Description / Explication</label>
                <input
                  type="text"
                  value={newRubriqueDescription}
                  onChange={e => setNewRubriqueDescription(e.target.value)}
                  placeholder="ex: Frais administratifs de traitement..."
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Base de calcul</label>
                <select
                  value={newRubriqueBaseCalcul}
                  onChange={e => setNewRubriqueBaseCalcul(e.target.value as CalculationBase)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
                >
                  <option value="BL">Facturé au BL (Montant fixe)</option>
                  <option value="TEU">Facturé par TEU</option>
                  {(activeCategory === 'CONTENEUR' || activeCategory === 'CONTENEUR_COC' || activeCategory === 'CONTENEUR_SOC') && <option value="CONTENEUR">Par conteneur du BL</option>}
                  <option value="POIDS_TONNE">Par Tonne de poids brut du BL</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Code Tarifaire</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      value={newRubriqueCode}
                      onChange={e => setNewRubriqueCode(e.target.value.toUpperCase())}
                      placeholder="ex: FR-DOS"
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-blue-600 focus:outline-none text-xs uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const autoCode = suggestTariffCode(newRubriqueName);
                        if (autoCode) setNewRubriqueCode(autoCode);
                      }}
                      title="Générer automatiquement le code selon le libellé"
                      className="h-10 px-2.5 bg-blue-50 hover:bg-blue-100 text-[#005daa] border border-blue-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">auto_awesome</span>
                      <span className="text-[10px]">Auto</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Montant Unitaire (FCFA)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={newRubriqueAmount ? newRubriqueAmount.toLocaleString('fr-FR') : (newRubriqueAmount === 0 ? '0' : '')}
                    onChange={e => {
                      const raw = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/g, '');
                      setNewRubriqueAmount(raw === '' ? 0 : parseInt(raw, 10));
                    }}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold text-right focus:bg-white focus:border-blue-600 focus:outline-none text-sm"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="font-bold text-slate-700 uppercase">Actif par défaut</span>
                <button
                  type="button"
                  onClick={() => setNewRubriqueIsActive(prev => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    newRubriqueIsActive ? 'bg-[#005daa]' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      newRubriqueIsActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRubriqueModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#005daa] text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow cursor-pointer"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Mise à jour du Prix Unitaire & Historique */}
      {showPriceModal && selectedRubriqueForPrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-lg text-[#00182f] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#005DAA] text-xl">price_change</span>
                  <span>Mise à jour du Prix Unitaire</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  <strong className="text-slate-800 font-bold">{selectedRubriqueForPrice.name}</strong> (Code: <span className="font-mono font-bold text-slate-600">{selectedRubriqueForPrice.code}</span>)
                </p>
              </div>
              <button 
                onClick={() => { setShowPriceModal(false); setSelectedRubriqueForPrice(null); }} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Form: 2 champs de mise à jour ("A partir de", "Prix Unitaire") */}
            <div className="shrink-0">
              <form onSubmit={handleSavePriceUpdate} className="space-y-3">
                <div className="bg-[#F0F7FF]/40 border border-[#005DAA]/20 p-4 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-[#005DAA] uppercase tracking-wide flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">edit_calendar</span>
                    Nouveau Tarif Applicable
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        À partir de <span className="text-[#005DAA]">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={newPriceEffectiveDate}
                        onChange={e => setNewPriceEffectiveDate(e.target.value)}
                        className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Prix Unitaire (FCFA) <span className="text-[#005DAA]">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={newPriceAmount ? newPriceAmount.toLocaleString('fr-FR') : (newPriceAmount === 0 ? '0' : '')}
                        onChange={e => {
                          const raw = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/g, '');
                          setNewPriceAmount(raw === '' ? 0 : parseInt(raw, 10));
                        }}
                        placeholder="0"
                        className="w-full h-10 px-3 border border-slate-300 rounded-lg font-mono font-black text-right text-sm text-slate-900 bg-white focus:border-[#005DAA] focus:ring-2 focus:ring-[#005DAA]/20 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                    <input
                      type="text"
                      value={newPriceNote}
                      onChange={e => setNewPriceNote(e.target.value)}
                      placeholder="Motif / Note (ex: Révision annuelle 2026...)"
                      className="w-full sm:flex-1 h-9 px-3 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="w-full sm:w-auto h-9 px-4 bg-[#005DAA] hover:bg-[#004580] text-white font-bold rounded-lg text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
                      <span>Mettre à jour le prix</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Tableau de l'historique des anciens prix */}
            <div className="flex-1 overflow-y-auto bocs-scrollbar space-y-2 min-h-[160px]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-slate-500">history</span>
                  <span>Historique des Prix ({((selectedRubriqueForPrice.priceHistory && selectedRubriqueForPrice.priceHistory.length > 0) ? selectedRubriqueForPrice.priceHistory.length : 1)})</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">Classé du plus récent au plus ancien</span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">À partir de</th>
                      <th className="py-2.5 px-3 text-right">Prix Unitaire</th>
                      <th className="py-2.5 px-3 text-center">Statut</th>
                      <th className="py-2.5 px-3">Enregistré le / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const history = selectedRubriqueForPrice.priceHistory && selectedRubriqueForPrice.priceHistory.length > 0
                        ? selectedRubriqueForPrice.priceHistory
                        : [
                            {
                              id: 'initial',
                              effectiveDate: 'Tarif initial',
                              amount: selectedRubriqueForPrice.montantUnitaire,
                              changedAt: 'Configuration initiale',
                              changedBy: 'Système',
                              note: 'Tarif de base'
                            }
                          ];

                      return history.map((entry, idx) => {
                        const isCurrent = idx === 0;
                        return (
                          <tr key={entry.id || idx} className={`hover:bg-slate-50/70 transition-colors ${isCurrent ? 'bg-emerald-50/30' : ''}`}>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                              {entry.effectiveDate}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                              {entry.amount.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-slate-500">FCFA</span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {isCurrent ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Actuel
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                  Ancien
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-500">
                              <div>{entry.changedAt}</div>
                              {entry.note && (
                                <div className="text-[10px] text-slate-400 italic">{entry.note}</div>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => { setShowPriceModal(false); setSelectedRubriqueForPrice(null); }}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal Émission Note d'Avoir */}
      {showCreditNoteModal && targetInvoiceForCreditNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600">assignment_return</span>
                <span>Émission d'une Note d'Avoir (Annulation Fiscale)</span>
              </h3>
              <button onClick={() => setShowCreditNoteModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitCreditNote} className="space-y-4 text-xs">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
                <span className="text-[10px] text-rose-800 font-extrabold uppercase tracking-wider">Facture d'Origine Cible</span>
                <div className="flex justify-between items-center">
                  <p className="font-bold font-mono text-slate-900 text-sm">{targetInvoiceForCreditNote.numeroFacture}</p>
                  <span className="font-mono font-extrabold text-rose-700 text-sm">
                    {targetInvoiceForCreditNote.montantTtcFcfa.toLocaleString('fr-FR')} FCFA TTC
                  </span>
                </div>
                <p className="text-slate-700 font-semibold">{targetInvoiceForCreditNote.clientNom}</p>
                {targetInvoiceForCreditNote.numeroBL && (
                  <p className="text-[11px] text-slate-500 font-mono">B/L: {targetInvoiceForCreditNote.numeroBL}</p>
                )}
              </div>

              {/* Type d'Avoir */}
              <div>
                <label className="block font-extrabold text-slate-700 uppercase mb-1.5">Type de régularisation</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditNoteType('TOTAL')}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                      creditNoteType === 'TOTAL'
                        ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="block text-xs font-black">Avoir Total (100%)</span>
                    <span className="text-[10px] font-normal text-slate-500">Annule intégralement la facture</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditNoteType('PARTIEL')}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                      creditNoteType === 'PARTIEL'
                        ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="block text-xs font-black">Avoir Partiel</span>
                    <span className="text-[10px] font-normal text-slate-500">Remise ou correction de montant</span>
                  </button>
                </div>
              </div>

              {creditNoteType === 'PARTIEL' && (
                <div className="animate-fade-in">
                  <label className="block font-extrabold text-slate-700 uppercase mb-1">Montant du Crédit TTC (FCFA)</label>
                  <input
                    type="text"
                    required
                    value={creditNotePartielMontant === 0 ? '' : creditNotePartielMontant.toLocaleString('fr-FR')}
                    onChange={e => {
                      const rawValue = e.target.value.replace(/[^0-9]/g, '');
                      const numValue = parseInt(rawValue, 10) || 0;
                      const maxLimit = Number(targetInvoiceForCreditNote.montantTtcFcfa || 0);
                      setCreditNotePartielMontant(Math.min(numValue, maxLimit));
                    }}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono font-bold text-rose-600 text-sm focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Plafond: {Number(targetInvoiceForCreditNote.montantTtcFcfa || 0).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              )}

              {/* Motif d'annulation */}
              <div>
                <label className="block font-extrabold text-slate-700 uppercase mb-1.5">
                  Motif Légal d'Émission <span className="text-rose-600 font-bold">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Erreur de tarification / Saisie',
                    'Contestation client / Remise accordée',
                    'Annulation escale / opération',
                    'Double facturation'
                  ].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setCreditNoteMotif(m);
                        setCreditNoteCustomMotif('');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        creditNoteMotif === m
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCreditNoteMotif('AUTRE')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      creditNoteMotif === 'AUTRE'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Autre motif...
                  </button>
                </div>

                {creditNoteMotif === 'AUTRE' && (
                  <textarea
                    required
                    rows={2}
                    value={creditNoteCustomMotif}
                    onChange={e => setCreditNoteCustomMotif(e.target.value)}
                    placeholder="Précisez le motif légal détaillé de l'annulation..."
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-rose-500 animate-fade-in"
                  />
                )}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <span className="material-symbols-outlined text-sm text-amber-600 shrink-0 mt-0.5">verified_user</span>
                <p>
                  <strong>Principe d'inaltérabilité fiscale :</strong> Cette action génère une Note d'Avoir officielle numérotée avec imputation comptable. La facture d'origine passera au statut <em>ANNULÉE</em> avec solde nul.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreditNoteModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-all shadow cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                  <span>Confirmer & Émettre l'Avoir</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Validation Définitive de Facture */}
      {showValidateModal && invoiceToValidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">verified</span>
                <span>Validation Officielle de Facture</span>
              </h3>
              <button onClick={() => setShowValidateModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Facture Brouillon</span>
                <p className="font-bold font-mono text-slate-900 text-sm">{invoiceToValidate.numeroFacture}</p>
                <p className="text-slate-800 font-semibold">{invoiceToValidate.clientNom}</p>
                <p className="font-mono font-bold text-emerald-700 text-sm pt-1">
                  Montant: {invoiceToValidate.montantTtcFcfa.toLocaleString('fr-FR')} FCFA TTC
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                <span className="material-symbols-outlined text-sm text-blue-600 shrink-0 mt-0.5">info</span>
                <p>
                  En validant cette facture, elle recevra son <strong>numéro fiscal officiel</strong> (ex: FA-BOCS26-XXXX) et sera <strong>verrouillée contre toute modification ou suppression directe</strong>.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowValidateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmValidateInvoice}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  <span>Valider Définitivement</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Duplication / Reprise de Facture */}
      {showDuplicateModal && invoiceToDuplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">content_copy</span>
                <span>Dupliquer / Reprendre la Facture</span>
              </h3>
              <button onClick={() => setShowDuplicateModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Facture Source</span>
                <p className="font-bold font-mono text-slate-900 text-sm">{invoiceToDuplicate.numeroFacture}</p>
                <p className="text-slate-800 font-semibold">{invoiceToDuplicate.clientNom}</p>
                <p className="font-mono font-bold text-slate-700">
                  Total: {invoiceToDuplicate.montantTtcFcfa.toLocaleString('fr-FR')} FCFA
                </p>
              </div>

              <p className="text-slate-600">
                Un nouveau brouillon de facture proforma sera créé en clonant toutes les rubriques et données de cette facture. Vous pourrez ensuite le modifier et l'ajuster librement.
              </p>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDuplicateInvoice}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">add_box</span>
                  <span>Créer le Nouveau Brouillon</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Suppression Brouillon */}
      {showDeleteInvoiceModal && invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-rose-600 flex items-center gap-2">
                <span className="material-symbols-outlined">delete_forever</span>
                <span>Supprimer la Facture Brouillon</span>
              </h3>
              <button onClick={() => setShowDeleteInvoiceModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <span className="text-[10px] text-rose-700 font-bold uppercase">Brouillon à supprimer</span>
                <p className="font-bold font-mono text-slate-900 text-sm">{invoiceToDelete.numeroFacture}</p>
                <p className="text-slate-800 font-semibold">{invoiceToDelete.clientNom}</p>
                <p className="text-slate-600 font-medium text-xs bg-rose-100/50 inline-block px-1.5 py-0.5 rounded border border-rose-200/50">{invoiceTypeConfigs.find(t => t.id === invoiceToDelete.invoiceTypeId)?.name || invoiceToDelete.typeFacture}</p>
                <p className="font-mono font-bold text-rose-700 mt-1">
                  Montant: {invoiceToDelete.montantTtcFcfa.toLocaleString('fr-FR')} FCFA
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <span className="material-symbols-outlined text-sm text-amber-600 shrink-0 mt-0.5">warning</span>
                <p>
                  <strong>Suppression en cascade :</strong> Toutes les pièces rattachées à cette proforma (lignes de rubriques, paiements associés, notes d'avoir liées) seront également supprimées et le statut du BL sera réinitialisé.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteInvoiceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteDraft}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-all shadow cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Supprimer Définitivement</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
