import React, { useState, useEffect } from 'react';
import { Invoice, Payment, UserRole, TarifSurestarie, ContainerType, InvoiceTypeConfig, RubriqueConfig, FretCategory } from '../types';
import { INITIAL_TARIFS_SURESTARIE } from '../data/initialData';
import { generateProformaPdf } from '../utils/pdfGenerator';

interface FacturationModuleProps {
  initialSubTab?: 'PROFORMA' | 'TARIFS' | 'BALANCE_AGEE' | 'CONFIG';
  invoices: Invoice[];
  payments: Payment[];
  onAddPayment: (payment: Payment) => void;
  exchangeRateUsd: number;
  onLogAudit: (action: string, entite: string, details: string) => void;
  userRole: UserRole;
  invoiceTypeConfigs?: InvoiceTypeConfig[];
  onUpdateInvoiceTypeConfigs?: (configs: InvoiceTypeConfig[]) => void;
  rubriqueConfigs?: RubriqueConfig[];
  onUpdateRubriqueConfigs?: (configs: RubriqueConfig[]) => void;
}

export const FacturationModule: React.FC<FacturationModuleProps> = ({
  initialSubTab = 'PROFORMA',
  invoices,
  payments,
  onAddPayment,
  exchangeRateUsd,
  onLogAudit,
  userRole,
  invoiceTypeConfigs = [],
  onUpdateInvoiceTypeConfigs,
  rubriqueConfigs = [],
  onUpdateRubriqueConfigs
}) => {
  const [activeTab, setActiveTab] = useState<'PROFORMA' | 'TARIFS' | 'BALANCE_AGEE' | 'CONFIG'>(initialSubTab);

  React.useEffect(() => {
    if (initialSubTab) setActiveTab(initialSubTab);
  }, [initialSubTab]);

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

  // Modals state for config page
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [showEditTypeModal, setShowEditTypeModal] = useState(false);
  const [showAddRubriqueModal, setShowAddRubriqueModal] = useState(false);
  const [showEditRubriqueModal, setShowEditRubriqueModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  
  const [editingInvoiceType, setEditingInvoiceType] = useState<InvoiceTypeConfig | null>(null);
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

  // Handlers for Local Rubriques
  const handleToggleLocalRubrique = (rubriqueId: string) => {
    const updated = localRubriques.map(r => 
      r.id === rubriqueId ? { ...r, isActive: !r.isActive } : r
    );
    setLocalRubriques(updated);
    if (onUpdateRubriqueConfigs) {
      onUpdateRubriqueConfigs(updated);
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
    alert('Configuration enregistrée avec succès !');
  };

  // Add new Invoice Type
  const handleAddInvoiceType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    const newId = Date.now().toString();
    const newType: InvoiceTypeConfig = {
      id: newId,
      name: newTypeName.trim(),
      description: newTypeDescription.trim()
    };

    if (onUpdateInvoiceTypeConfigs) {
      onUpdateInvoiceTypeConfigs([...invoiceTypeConfigs, newType]);
    }
    
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
    if (onUpdateRubriqueConfigs) {
      onUpdateRubriqueConfigs([...rubriqueConfigs, defaultRubrique]);
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
    alert(`Le type de facture "${newTypeName}" a été créé avec succès.`);
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
    alert('Le type de facture a été mis à jour.');
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

    setShowAddRubriqueModal(false);
    setNewRubriqueName('');
    setNewRubriqueDescription('');
    setNewRubriqueCode('');
    setNewRubriqueAmount(0);
    setNewRubriqueIsActive(true);
    setNewRubriqueBaseCalcul('BL');
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

    setShowEditRubriqueModal(false);
    setEditingRubrique(null);
  };

  // Delete Rubrique handler
  const handleDeleteRubriqueClick = (rubrique: RubriqueConfig) => {
    setRubriqueToDelete(rubrique);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteRubrique = () => {
    if (!rubriqueToDelete) return;
    const updated = localRubriques.filter(r => r.id !== rubriqueToDelete.id);
    setLocalRubriques(updated);
    if (onUpdateRubriqueConfigs) {
      onUpdateRubriqueConfigs(updated);
    }
    setShowDeleteConfirmModal(false);
    setRubriqueToDelete(null);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  // Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentFacture, setPaymentFacture] = useState<Invoice | null>(null);
  const [paymentMontant, setPaymentMontant] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'MOBILE_MONEY'>('VIREMENT');
  const [paymentRef, setPaymentRef] = useState('');

  // Tariff Configuration State
  const [tarifs, setTarifs] = useState<TarifSurestarie[]>(INITIAL_TARIFS_SURESTARIE);
  const [editingTarif, setEditingTarif] = useState<TarifSurestarie | null>(null);

  // Proforma Engine State
  const [calcNumBL, setCalcNumBL] = useState('BL-IMP-2026-9901');
  const [calcClient, setCalcClient] = useState('TRANS-AFRIQUE LOGISTIQUE SA');
  const [calcFreeDays, setCalcFreeDays] = useState<number>(7);
  const [calcStayDays, setCalcStayDays] = useState<number>(14);
  const [calcRatePerDay, setCalcRatePerDay] = useState<number>(15000);
  const [calcContainerType, setCalcContainerType] = useState<ContainerType>('20_DRY');

  // DMDT Calculation
  const extraDays = Math.max(0, calcStayDays - calcFreeDays);
  const totalDmdtFcfa = extraDays * calcRatePerDay;
  const fraisPassageFcfa = 180000;
  const htTotalFcfa = totalDmdtFcfa + fraisPassageFcfa;
  const tvaFcfa = Math.round(htTotalFcfa * 0.18);
  const ttcFcfa = htTotalFcfa + tvaFcfa;

  // Aged balance metrics
  const totalSoldeDu = invoices.reduce((acc, i) => acc + i.soldeDuFcfa, 0);
  const totalPaye = invoices.reduce((acc, i) => acc + (i.montantTtcFcfa - i.soldeDuFcfa), 0);

  const filteredInvoices = invoices.filter(i => {
    const q = searchQuery.toLowerCase();
    return i.numeroFacture.toLowerCase().includes(q) ||
           i.clientNom.toLowerCase().includes(q) ||
           (i.numeroBL && i.numeroBL.toLowerCase().includes(q));
  });

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
    alert('Règlement enregistré avec succès et solde mis à jour !');
  };

  const handleUpdateTarif = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarif) return;

    setTarifs(prev => prev.map(t => t.id === editingTarif.id ? editingTarif : t));
    onLogAudit('MAJ_TARIF_SURESTARIE', 'Tarif', `Mise à jour tarif surestarie ${editingTarif.typeConteneur}: ${editingTarif.tarifJournalierFcfa} FCFA/j`);
    setEditingTarif(null);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Header Banner Ultra-Épuré */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
            <span className="material-symbols-outlined text-sm">payments</span>
            <span>Module Financier & Facturation BOCS</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-heading tracking-tight">
            Facturation & Gestion des Surestaries
          </h1>
          <p className="text-xs text-slate-500 max-w-xl">
            Calculateur automatique des frais DMDT, grilles tarifaires et suivi temps réel de la Balance Âgée Client.
          </p>
        </div>

        {/* Tab Switchers Épurés */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('PROFORMA')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'PROFORMA' ? 'bg-[#005daa] text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-base">calculate</span>
            <span>Factures Proforma & DMDT</span>
          </button>
          <button
            onClick={() => setActiveTab('BALANCE_AGEE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'BALANCE_AGEE' ? 'bg-[#005daa] text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-base">account_balance_wallet</span>
            <span>Balance Âgée & Règlements</span>
          </button>
          <button
            onClick={() => setActiveTab('TARIFS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'TARIFS' ? 'bg-[#005daa] text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-base">tune</span>
            <span>Tarifs Surestaries</span>
          </button>
          {(userRole === 'ADMIN' || userRole === 'COMPTABILITE') && (
            <button
              onClick={() => setActiveTab('CONFIG')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                activeTab === 'CONFIG' ? 'bg-[#005daa] text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-base">settings</span>
              <span>Configuration Factures</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: PROFORMA & SURESTARIES ENGINE */}
      {activeTab === 'PROFORMA' && (
        <div className="space-y-6">
          
          {/* Proforma Engine Calculator Box Ultra-Sleek */}
          <div className="bocs-card p-6 space-y-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
            <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">calculate</span>
                  <span>Calculateur de Surestaries (DMDT) & Émission Proforma</span>
                </h2>
                <p className="text-xs text-slate-500">Saisissez les paramètres du conteneur pour générer le décompte automatique des frais de garde.</p>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80 px-3 py-1.5 rounded-xl shadow-xs">
                Taux change: 1 USD = {exchangeRateUsd} FCFA
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">N° BL Connaissement</label>
                <input
                  type="text"
                  value={calcNumBL}
                  onChange={e => setCalcNumBL(e.target.value)}
                  className="w-full h-10 px-3.5 bg-slate-50/60 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Nom du Client</label>
                <input
                  type="text"
                  value={calcClient}
                  onChange={e => setCalcClient(e.target.value)}
                  className="w-full h-10 px-3.5 bg-slate-50/60 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Type Conteneur</label>
                <select
                  value={calcContainerType}
                  onChange={e => setCalcContainerType(e.target.value as ContainerType)}
                  className="w-full h-10 px-3.5 bg-[#ffe135] hover:bg-[#ffe855] text-[#0f172a] border border-[#e5c122] rounded-xl font-black transition-all outline-none cursor-pointer"
                >
                  <option value="20_DRY">20' Dry (Francheur 7j)</option>
                  <option value="40_DRY">40' Dry (Francheur 7j)</option>
                  <option value="40_HC">40' High Cube (Francheur 7j)</option>
                  <option value="20_REEFER">20' Reefer (Francheur 3j)</option>
                  <option value="40_REEFER">40' Reefer (Francheur 3j)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Tarif Journalier (FCFA)</label>
                <input
                  type="number"
                  value={calcRatePerDay}
                  onChange={e => setCalcRatePerDay(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3.5 bg-slate-50/60 border border-slate-200 rounded-xl font-mono font-bold text-blue-600 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Jours de Francheur Gratuite</label>
                <input
                  type="number"
                  value={calcFreeDays}
                  onChange={e => setCalcFreeDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-10 px-3.5 bg-slate-50/60 border border-slate-200 rounded-xl font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Jours Total Séjour au Parc</label>
                <input
                  type="number"
                  value={calcStayDays}
                  onChange={e => setCalcStayDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-10 px-3.5 bg-slate-50/60 border border-slate-200 rounded-xl font-mono text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>

              <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200/80 flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 font-mono">Jours en Surestarie</span>
                <span className="text-xl font-black font-mono text-rose-700">{extraDays} jour(s)</span>
              </div>

              <div className="p-3.5 bg-[#00182f] text-white rounded-xl shadow-md flex flex-col justify-between border border-slate-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300 font-mono">Montant TTC Proforma</span>
                <span className="text-xl font-black font-mono text-white tracking-tight">{ttcFcfa.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
          </div>

          {/* Invoices List Table */}
          <div className="bocs-card overflow-hidden">
            <div className="p-4 bg-surface-container-low border-b border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3">
              <h3 className="font-bold text-primary text-sm uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">receipt_long</span>
                <span>Registre des Factures Proforma & Déclarations FNE</span>
              </h3>

              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher facture, client..."
                  className="w-full pl-9 pr-3 py-1.5 bg-surface border border-outline-variant rounded text-xs text-on-surface focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[500px] bocs-scrollbar relative">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-md shadow-xs">
                  <tr className="text-[11px] font-extrabold text-slate-700 uppercase border-b border-slate-200">
                    <th className="p-3">Numéro BL</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Montant HT</th>
                    <th className="p-3">Montant TTC</th>
                    <th className="p-3">Solde Dû</th>
                    <th className="p-3">Paiement</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-3 font-mono font-bold text-primary">{inv.numeroBL || inv.numeroFacture}</td>
                      <td className="p-3 font-semibold text-on-surface">{inv.clientNom}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container text-on-surface-variant">
                          {inv.typeFacture}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{inv.montantHtFcfa.toLocaleString()} FCFA</td>
                      <td className="p-3 font-mono font-bold text-primary">{inv.montantTtcFcfa.toLocaleString()} FCFA</td>
                      <td className="p-3 font-mono font-bold text-error">{inv.soldeDuFcfa.toLocaleString()} FCFA</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.statutPaiement === 'PAYE' ? 'bg-status-validated text-white' :
                          inv.statutPaiement === 'PARTIEL' ? 'bg-amber-100 text-amber-800' : 'bg-error-container text-on-error-container'
                        }`}>
                          {inv.statutPaiement}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {inv.soldeDuFcfa > 0 && (
                          <button
                            onClick={() => {
                              setPaymentFacture(inv);
                              setPaymentMontant(inv.soldeDuFcfa);
                              setShowPaymentModal(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded text-xs hover:bg-emerald-700 transition-all inline-flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">price_check</span>
                            <span>Régler</span>
                          </button>
                        )}
                        {inv.statutPaiement === 'PAYE' ? (
                          <button
                            onClick={() => {
                              const payment = payments.find(p => p.factureId === inv.id);
                              generateProformaPdf(inv, undefined, 'BOCS Maritime Agence Abidjan', payment);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold rounded text-xs hover:bg-emerald-100 transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm text-emerald-700">check_circle</span>
                            <span>Facture réglée</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => generateProformaPdf(inv, undefined, 'BOCS Maritime Agence Abidjan')}
                            className="px-2.5 py-1 bg-primary text-on-primary font-bold rounded text-xs hover:bg-secondary transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">print</span>
                            <span>PDF Proforma</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
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
              Ventilation de la Balance Âgée par Tranche
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-center space-y-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">0 - 30 Jours</span>
                <p className="font-mono font-bold text-lg text-emerald-800">{(totalSoldeDu * 0.55).toLocaleString('fr-FR')} FCFA</p>
                <p className="text-[10px] text-emerald-600">Échéance normale</p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded text-center space-y-1">
                <span className="text-[10px] font-bold text-amber-700 uppercase">31 - 60 Jours</span>
                <p className="font-mono font-bold text-lg text-amber-800">{(totalSoldeDu * 0.30).toLocaleString('fr-FR')} FCFA</p>
                <p className="text-[10px] text-amber-600">Relance 1 transmise</p>
              </div>

              <div className="p-4 bg-orange-50 border border-orange-200 rounded text-center space-y-1">
                <span className="text-[10px] font-bold text-orange-700 uppercase">61 - 90 Jours</span>
                <p className="font-mono font-bold text-lg text-orange-800">{(totalSoldeDu * 0.10).toLocaleString('fr-FR')} FCFA</p>
                <p className="text-[10px] text-orange-600">Mise en demeure</p>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-200 rounded text-center space-y-1">
                <span className="text-[10px] font-bold text-rose-700 uppercase">&gt; 90 Jours (Contentieux)</span>
                <p className="font-mono font-bold text-lg text-rose-800">{(totalSoldeDu * 0.05).toLocaleString('fr-FR')} FCFA</p>
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
                    <td className="p-3 font-bold text-emerald-600">{p.montantFcfa.toLocaleString()} FCFA</td>
                    <td className="p-3 text-on-surface-variant font-sans text-[11px]">{p.saisiPar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB 3: TARIFS SURESTARIES */}
      {activeTab === 'TARIFS' && (
        <div className="bocs-card p-6 space-y-6">
          <div className="border-b border-outline-variant pb-4">
            <h2 className="text-lg font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">tune</span>
              <span>Configuration des Grilles Tarifaires de Surestaries</span>
            </h2>
            <p className="text-xs text-on-surface-variant">Paramétrage des paliers de tarification journalière par type de conteneur (20' Dry, 40' HC, Reefer).</p>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[480px] bocs-scrollbar relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-md shadow-xs">
                <tr className="text-[11px] font-extrabold text-slate-700 uppercase border-b border-slate-200">
                  <th className="p-3">Type Conteneur</th>
                  <th className="p-3">Palier Jours Début</th>
                  <th className="p-3">Palier Jours Fin</th>
                  <th className="p-3">Tarif Journalier (FCFA)</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {tarifs.map(t => (
                  <tr key={t.id} className="hover:bg-surface-container-low">
                    <td className="p-3 font-bold text-primary">{t.typeConteneur}</td>
                    <td className="p-3 font-mono">Jour {t.jourDebut}</td>
                    <td className="p-3 font-mono">{t.jourFin === 999 ? 'Au-delà' : `Jour ${t.jourFin}`}</td>
                    <td className="p-3 font-mono font-bold text-secondary">{t.tarifJournalierFcfa.toLocaleString()} FCFA</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setEditingTarif(t)}
                        className="px-3 py-1 bg-surface-container hover:bg-secondary hover:text-white font-bold rounded text-xs transition-all"
                      >
                        Éditer Tarif
                      </button>
                    </td>
                  </tr>
                ))}
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
                <span className="text-[10px] text-outline font-bold uppercase">Facture Cible</span>
                <p className="font-bold font-mono text-primary text-sm">{paymentFacture.numeroFacture}</p>
                <p className="text-on-surface font-semibold">{paymentFacture.clientNom}</p>
              </div>

              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Montant du Règlement (FCFA)</label>
                <input
                  type="number"
                  required
                  max={paymentFacture.soldeDuFcfa}
                  value={paymentMontant}
                  onChange={e => setPaymentMontant(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 bg-surface border border-outline-variant rounded font-mono font-bold text-emerald-600 text-sm"
                />
                <span className="text-[10px] text-outline mt-1 block">Solde dût actuel: {paymentFacture.soldeDuFcfa.toLocaleString()} FCFA</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-bold text-lg text-primary">Éditer le Tarif Surestarie</h3>
              <button onClick={() => setEditingTarif(null)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateTarif} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Type Conteneur</label>
                <input
                  type="text"
                  disabled
                  value={editingTarif.typeConteneur}
                  className="w-full h-9 px-3 bg-surface-container border border-outline-variant rounded font-bold text-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Nouveau Tarif Journalier (FCFA)</label>
                <input
                  type="number"
                  required
                  value={editingTarif.tarifJournalierFcfa}
                  onChange={e => setEditingTarif({ ...editingTarif, tarifJournalierFcfa: parseFloat(e.target.value) || 0 })}
                  className="w-full h-10 px-3 bg-surface border border-outline-variant rounded font-mono font-bold text-secondary text-sm"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTarif(null)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-on-primary font-bold rounded hover:bg-secondary"
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
                <span>Configuration des Factures</span>
              </h2>
              <p className="text-xs text-slate-500">
                Gérez les types de factures et leurs rubriques associées par catégorie de fret.
              </p>
            </div>
            {(userRole === 'ADMIN' || userRole === 'COMPTABILITE') && (
              <button
                onClick={() => setShowAddTypeModal(true)}
                className="px-4 py-2.5 bg-[#0b172a] hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow cursor-pointer active:scale-95 shrink-0"
              >
                <span className="material-symbols-outlined text-sm font-bold">add</span>
                <span>Nouveau Type</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-slate-900">
            
            {/* Left Panel: Types de Factures (4 columns) */}
            <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500 text-sm">list</span>
                  <span>Types de Factures</span>
                </h3>
                <div className="relative">
                  <button 
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                    title="Filtrer"
                  >
                    <span className="material-symbols-outlined text-base">filter_list</span>
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
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto bocs-scrollbar">
                {invoiceTypeConfigs
                  .filter(t => t.name.toLowerCase().includes(searchTypeQuery.toLowerCase()))
                  .map(t => {
                    const isSelected = t.id === selectedInvoiceTypeId;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedInvoiceTypeId(t.id)}
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
                        {isSelected && (userRole === 'ADMIN' || userRole === 'COMPTABILITE') && (
                          <button
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
            </div>

            {/* Right Panel: Configuration details (8 columns) */}
            <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              {activeInvoiceType ? (
                <div>
                  
                  {/* Panel Header */}
                  <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-[#00182f] font-heading">
                        Configuration: {activeInvoiceType.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Définissez les rubriques applicables selon le type de marchandise.
                      </p>
                    </div>
                    {(userRole === 'ADMIN' || userRole === 'COMPTABILITE') && (
                      <button
                        onClick={handleSaveConfig}
                        className="px-5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-[#0f172a] font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                      >
                        Enregistrer
                      </button>
                    )}
                  </div>

                  {/* Fret Category Tabs */}
                  <div className="border-b border-slate-100 bg-white">
                    <div className="flex border-b border-slate-200/60 px-4 gap-4">
                      {(['CONTENEUR', 'VRAC', 'RORO', 'CONVENTIONNEL'] as FretCategory[]).map(cat => {
                        const label = 
                          cat === 'CONTENEUR' ? 'Conteneur' :
                          cat === 'VRAC' ? 'Vrac' :
                          cat === 'RORO' ? 'Ro-Ro' : 'Conventionnel';
                        const isCatSelected = cat === activeCategory;
                        return (
                          <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-3 text-xs font-bold transition-all border-b-2 -mb-[1px] cursor-pointer ${
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

                  {/* Grid of Rubrique Cards */}
                  <div className="p-6 bg-slate-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {localRubriques
                        .filter(r => r.invoiceTypeId === selectedInvoiceTypeId && r.category === activeCategory)
                        .map(rub => (
                          <div 
                            key={rub.id} 
                            className={`p-4 rounded-xl border transition-all bg-white ${
                              rub.isActive 
                                ? 'border-slate-200/80 shadow-xs' 
                                : 'border-slate-100/60 opacity-60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-[#0f172a]">
                                  {rub.name}
                                </h4>
                                <p className="text-[10px] text-slate-500">
                                  {rub.description}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400 font-bold">
                                  Code: {rub.code} | Base: {
                                    rub.baseCalcul === 'CONTENEUR' ? 'Par conteneur' :
                                    rub.baseCalcul === 'POIDS_TONNE' ? 'Par Tonne brut' : 'Facturé au BL'
                                  }
                                </p>
                              </div>
                              
                              {/* Action controls */}
                              {(userRole === 'ADMIN' || userRole === 'COMPTABILITE') && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Edit button */}
                                  <button
                                    onClick={() => {
                                      setEditingRubrique(rub);
                                      setEditRubriqueName(rub.name);
                                      setEditRubriqueDescription(rub.description);
                                      setEditRubriqueCode(rub.code);
                                      setEditRubriqueAmount(rub.montantUnitaire);
                                      setEditRubriqueBaseCalcul(rub.baseCalcul || 'BL');
                                      setShowEditRubriqueModal(true);
                                    }}
                                    className="p-1 text-slate-400 hover:text-[#005daa] hover:bg-slate-100 rounded transition-all cursor-pointer"
                                    title="Modifier la rubrique"
                                  >
                                    <span className="material-symbols-outlined text-sm font-bold">edit</span>
                                  </button>

                                  {/* Delete button */}
                                  <button
                                    onClick={() => handleDeleteRubriqueClick(rub)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                    title="Supprimer la rubrique"
                                  >
                                    <span className="material-symbols-outlined text-sm font-bold">delete</span>
                                  </button>

                                  {/* Toggle switch */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLocalRubrique(rub.id)}
                                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      rub.isActive ? 'bg-[#005daa]' : 'bg-slate-200'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        rub.isActive ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Montant Unitaire editable field */}
                            <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Montant Unitaire:</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  disabled={!(userRole === 'ADMIN' || userRole === 'COMPTABILITE')}
                                  value={rub.montantUnitaire}
                                  onChange={(e) => handleChangeLocalRubriqueAmount(rub.id, parseFloat(e.target.value) || 0)}
                                  className="w-20 h-7 px-2 border border-slate-200 rounded text-right font-mono font-bold text-slate-700 bg-slate-50/50 focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
                                  placeholder="0"
                                />
                                <span className="text-[10px] font-bold text-slate-400 font-mono">FCFA</span>
                              </div>
                            </div>
                          </div>
                        ))}

                      {/* Ajouter une rubrique dotted card */}
                      {(userRole === 'ADMIN' || userRole === 'COMPTABILITE') && (
                        <button
                          onClick={() => {
                            setNewRubriqueName('');
                            setNewRubriqueDescription('');
                            setNewRubriqueCode('');
                            setNewRubriqueAmount(0);
                            setNewRubriqueIsActive(true);
                            setShowAddRubriqueModal(true);
                          }}
                          className="p-4 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 hover:bg-slate-50/50 flex flex-col items-center justify-center gap-1 transition-all h-[134px] group cursor-pointer text-slate-500 hover:text-blue-600 bg-white/50"
                        >
                          <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">add_circle</span>
                          <span className="text-xs font-bold">Ajouter une rubrique</span>
                          <span className="text-[10px] text-slate-400 font-semibold">+ Montant Unitaire</span>
                        </button>
                      )}
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
                  {activeCategory === 'CONTENEUR' && <option value="CONTENEUR">Par conteneur du BL</option>}
                  <option value="POIDS_TONNE">Par Tonne de poids brut du BL</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Code Tarifaire</label>
                  <input
                    type="text"
                    required
                    value={editRubriqueCode}
                    onChange={e => setEditRubriqueCode(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-blue-600 focus:outline-none text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Montant Unitaire (FCFA)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editRubriqueAmount}
                    onChange={e => setEditRubriqueAmount(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 font-mono text-right focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
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
                  onChange={e => setNewRubriqueName(e.target.value)}
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
                  {activeCategory === 'CONTENEUR' && <option value="CONTENEUR">Par conteneur du BL</option>}
                  <option value="POIDS_TONNE">Par Tonne de poids brut du BL</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Code Tarifaire</label>
                  <input
                    type="text"
                    required
                    value={newRubriqueCode}
                    onChange={e => setNewRubriqueCode(e.target.value)}
                    placeholder="ex: FR-DOS"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-blue-600 focus:outline-none text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Montant Unitaire (FCFA)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newRubriqueAmount}
                    onChange={e => setNewRubriqueAmount(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 font-mono text-right focus:bg-white focus:border-blue-600 focus:outline-none text-xs"
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

    </div>
  );
};
