import React, { useState, useRef, useEffect } from 'react';
import { toastSuccess, toastError, toastWarning } from '../components/common/Toast';
import { exportBlsCsv } from '../utils/exportCsv';
import { Escale, BL, Invoice, UserRole, Container, ContainerType, RubriqueConfig, FretCategory, InvoiceTypeConfig } from '../types';
import { generateProformaPdf, generateDoBadPdf, generateImportManifestPdf } from '../utils/pdfGenerator';
import { parseGuceXml } from '../utils/xmlGuceParser';
import { MultiPdfImportModal, EscaleCommitGroup } from '../components/import/MultiPdfImportModal';
import { useEscapeClose, overlayClickClose } from '../hooks/useEscapeClose';

interface ImportModuleProps {
  escales: Escale[];
  bls: BL[];
  onAddEscale: (escale: Escale) => void;
  onImportManifest: (escale: Escale, newBls: BL[]) => void;
  onDeleteEscaleIntegration?: (escaleId: number) => void;
  onGenerateInvoice: (invoice: Invoice) => void;
  onLogAudit: (action: string, entite: string, details: string) => void;
  userRole: UserRole;
  rubriqueConfigs?: RubriqueConfig[];
  invoiceTypeConfigs?: InvoiceTypeConfig[];
  invoices?: Invoice[];
  onUpdateBl?: (updatedBl: BL) => void;
  onUpdateInvoice?: (updatedInvoice: Invoice) => void;
  onNavigateToBilling?: (bl: BL) => void;
}

import { buildBocsBremenBls, parseAlisManifestText, BOCS_BREMEN_25586_ESCALE } from '../utils/manifestParser';

function buildScreenshotBls(newEscaleId: number): BL[] {
  return buildBocsBremenBls(newEscaleId);
}

export const ImportModule: React.FC<ImportModuleProps> = ({
  escales,
  bls,
  onAddEscale,
  onImportManifest,
  onDeleteEscaleIntegration,
  onGenerateInvoice,
  onUpdateInvoice,
  onLogAudit,
  userRole,
  rubriqueConfigs = [],
  invoiceTypeConfigs = [],
  invoices = [],
  onUpdateBl,
  onNavigateToBilling
}) => {
  const [selectedEscaleId, setSelectedEscaleId] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddEscaleModal, setShowAddEscaleModal] = useState(false);
  const [showPasteXmlModal, setShowPasteXmlModal] = useState(false);
  const [pastedXmlText, setPastedXmlText] = useState('');
  const [isProcessingXml, setIsProcessingXml] = useState(false);
  const [selectedBlDetails, setSelectedBlDetails] = useState<BL | null>(null);
  const [escaleToDelete, setEscaleToDelete] = useState<Escale | null>(null);

  // ─── MODAL ÉDITION BL ───
  const [editingBl, setEditingBl] = useState<BL | null>(null);
  const [editBlForm, setEditBlForm] = useState<BL | null>(null);
  const [editBlTab, setEditBlTab] = useState<'general' | 'parties' | 'cargo' | 'containers'>('general');

  // Modal Add Manual BL state
  const [showAddBlModal, setShowAddBlModal] = useState(false);
  const [manualNumeroBl, setManualNumeroBl] = useState('');
  const [manualEscaleId, setManualEscaleId] = useState<number | ''>('');
  const [manualShipperNom, setManualShipperNom] = useState('');
  const [manualShipperAdresse, setManualShipperAdresse] = useState('');
  const [manualConsigneeNom, setManualConsigneeNom] = useState('');
  const [manualConsigneeAdresse, setManualConsigneeAdresse] = useState('');
  const [manualPoidsBrutKg, setManualPoidsBrutKg] = useState<number | ''>(25000);
  const [manualNombreColis, setManualNombreColis] = useState<number | ''>(500);
  const [manualVolumeM3, setManualVolumeM3] = useState<number | ''>(0);
  const [manualDescriptionGoods, setManualDescriptionGoods] = useState('MARCHANDISES DIVERSES');
  const [manualTypeEmballage, setManualTypeEmballage] = useState('COLIS');
  const [manualCount20, setManualCount20] = useState<number>(0);
  const [manualCount40, setManualCount40] = useState<number>(0);
  
  // Modal de sélection des types de factures à émettre
  const [blForInvoiceSelection, setBlForInvoiceSelection] = useState<BL | null>(null);
  const [selectedTypeIdsForBl, setSelectedTypeIdsForBl] = useState<string[]>([]);
  const [plannedInvoicesByBl, setPlannedInvoicesByBl] = useState<Record<number, string[]>>(() => {
    try {
      const saved = localStorage.getItem('bocs_bl_planned_invoices');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bocs_bl_planned_invoices', JSON.stringify(plannedInvoicesByBl));
    } catch (e) {
      console.error('Erreur sauvegarde planned invoices', e);
    }
  }, [plannedInvoicesByBl]);

  // DMDT / Surestaries local calculations and modal state
  const [calculationModalData, setCalculationModalData] = useState<{ bl: BL, typeConfig: InvoiceTypeConfig } | null>(null);

  // ─── Fermeture clavier (Échap, sommet de pile) de toutes les modales du module ───
  useEscapeClose(showAddEscaleModal, () => setShowAddEscaleModal(false));
  useEscapeClose(showPasteXmlModal, () => setShowPasteXmlModal(false));
  useEscapeClose(Boolean(selectedBlDetails), () => setSelectedBlDetails(null));
  useEscapeClose(Boolean(escaleToDelete), () => setEscaleToDelete(null));
  useEscapeClose(Boolean(editingBl), () => { setEditingBl(null); setEditBlForm(null); });
  useEscapeClose(showAddBlModal, () => setShowAddBlModal(false));
  useEscapeClose(Boolean(blForInvoiceSelection), () => setBlForInvoiceSelection(null));
  useEscapeClose(Boolean(calculationModalData), () => setCalculationModalData(null));
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
    } catch (e) {
      console.error('Erreur sauvegarde validated calculations', e);
    }
  }, [validatedCalculations]);

  const [modalRows, setModalRows] = useState<any[]>([]);

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
  }, [calculationModalData, validatedCalculations]);

  const calculateDegressiveAmount = (typeConteneur: string, stayDays: number, franchise: number, dateAccostageStr?: string) => {
    const saved = localStorage.getItem('bocs_tarifs');
    let tariffs = [];
    if (saved) {
      try {
        tariffs = JSON.parse(saved);
      } catch (e) {}
    }
    
    const regime = calculationModalData?.typeConfig?.name?.toLowerCase()?.includes('surestarie') ? 'SURESTARIE' : 'DETENTION';
    const typeOperation = calculationModalData?.bl?.typeOperation || 'IMPORT';

    // Filter matching tariffs
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

    return {
      totalAmount,
      breakdown
    };
  };

  const [lastXmlFileName, setLastXmlFileName] = useState<string>(() => {
    return localStorage.getItem('bocs_last_xml_filename') || '';
  });

  // Multi-PDF Import modal state
  const [showMultiPdfModal, setShowMultiPdfModal] = useState(false);
  const [multiPdfInitialFiles, setMultiPdfInitialFiles] = useState<File[]>([]);

  // XML Import file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // PDF Import file input ref
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // New Escale Form state
  const [nomNavire, setNomNavire] = useState('');
  const [callsign, setCallsign] = useState('');
  const [numeroVoyage, setNumeroVoyage] = useState('');
  const [portChargement, setPortChargement] = useState('Abidjan (CIABJ)');
  const [portDechargement, setPortDechargement] = useState('Le Havre (FRLEH)');

  // Phase 3 — Quick filters & Column Sorting state
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'DANGEROUS' | 'WITH_CONTAINERS' | 'WITHOUT_INVOICE' | 'PENDING'>('ALL');
  const [sortField, setSortField] = useState<'numeroBL' | 'consigneeNom' | 'poidsBrutKg' | 'conteneurs' | 'statutImport'>('numeroBL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: 'numeroBL' | 'consigneeNom' | 'poidsBrutKg' | 'conteneurs' | 'statutImport') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredBls = bls.filter(bl => {
    const matchesEscale = selectedEscaleId === 'ALL' 
      ? true 
      : String(bl.escaleId) === String(selectedEscaleId);
    
    // Multi-field smart search
    const q = searchQuery.toLowerCase().trim();
    const matchesContainer = (bl.conteneurs || []).some(c => (c.numeroConteneur || '').toLowerCase().includes(q));
    const matchesDesc = (bl.descriptionGoods || '').toLowerCase().includes(q);
    const matchesMarks = (bl.marquesEtNumeros || '').toLowerCase().includes(q);
    const matchesQuery = !q || 
                         bl.numeroBL.toLowerCase().includes(q) ||
                         bl.consigneeNom.toLowerCase().includes(q) ||
                         bl.shipperNom.toLowerCase().includes(q) ||
                         matchesContainer ||
                         matchesDesc ||
                         matchesMarks;

    // Quick filter chips
    if (quickFilter === 'DANGEROUS') {
      const isDangerous = (bl.conteneurs || []).some(c => c.isDangerous) || 
                          (bl.descriptionGoods || '').toLowerCase().includes('imdg') ||
                          (bl.descriptionGoods || '').toLowerCase().includes('dangereux');
      if (!isDangerous) return false;
    } else if (quickFilter === 'WITH_CONTAINERS') {
      if (!bl.conteneurs || bl.conteneurs.length === 0) return false;
    } else if (quickFilter === 'WITHOUT_INVOICE') {
      const hasInvoice = invoices.some(i => (i.blId === bl.id || i.numeroBL === bl.numeroBL) && i.statutFacture !== 'ANNULEE');
      if (hasInvoice) return false;
    } else if (quickFilter === 'PENDING') {
      if (bl.statutImport !== 'EN_ATTENTE') return false;
    }

    return matchesEscale && matchesQuery;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortField === 'numeroBL') {
      comparison = a.numeroBL.localeCompare(b.numeroBL);
    } else if (sortField === 'consigneeNom') {
      comparison = a.consigneeNom.localeCompare(b.consigneeNom);
    } else if (sortField === 'poidsBrutKg') {
      comparison = (a.poidsBrutKg || 0) - (b.poidsBrutKg || 0);
    } else if (sortField === 'conteneurs') {
      comparison = (a.conteneurs?.length || 0) - (b.conteneurs?.length || 0);
    } else if (sortField === 'statutImport') {
      comparison = (a.statutImport || '').localeCompare(b.statutImport || '');
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });


  const processXmlContent = (xmlContent: string, fileNameSource: string = 'Manifeste_GUCE.xml') => {
    setIsProcessingXml(true);
    setTimeout(() => {
      try {
        const newEscaleId = Date.now();
        let newEscale: Escale;
        let extractedBls: BL[];

        const parsed = parseGuceXml(xmlContent);
        newEscale = {
          id: newEscaleId,
          nomNavire: parsed.escale.nomNavire || 'EA CHARA',
          callsign: parsed.escale.callsign || '9V8974',
          numeroVoyage: parsed.escale.numeroVoyage || '014E',
          portChargement: parsed.escale.portChargement || 'ANVERS (BEANR)',
          portDechargement: parsed.escale.portDechargement || 'ABIDJAN (CIABJ)',
          dateArrivee: parsed.escale.dateArrivee || new Date().toISOString().split('T')[0],
          statut: 'EN_COURS'
        };

        if (parsed.bls && parsed.bls.length > 0) {
          extractedBls = parsed.bls.map((bl, idx) => ({
            id: newEscaleId + idx + 1,
            escaleId: newEscaleId,
            numeroBL: bl.numeroBL || `BL-IMP-${idx + 1}`,
            typeOperation: 'IMPORT',
            shipperNom: bl.shipperNom || 'EXPÉDITEUR NON SPÉCIFIÉ',
            shipperAdresse: bl.shipperAdresse || '',
            consigneeNom: bl.consigneeNom || 'DESTINATAIRE NON SPÉCIFIÉ',
            consigneeAdresse: bl.consigneeAdresse || '',
            notifyNom: bl.notifyNom || bl.consigneeNom || 'TO ORDER',
            notifyAdresse: bl.notifyAdresse || '',
            portChargementCode: bl.portChargementCode || 'BEANR',
            portDechargementCode: bl.portDechargementCode || 'CIABJ',
            destinationFinale: bl.destinationFinale || 'CI',
            descriptionGoods: bl.descriptionGoods || 'MARCHANDISES DIVERSES',
            nombreColis: bl.nombreColis || 0,
            typeEmballage: bl.typeEmballage || 'CARTONS / PACKAGES',
            poidsBrutKg: bl.poidsBrutKg || 0,
            volumeM3: bl.volumeM3 || 0,
            statutImport: 'EN_ATTENTE',
            conteneurs: (bl.conteneurs || []).map((c, cIdx) => ({
              ...c,
              id: newEscaleId + 1000 + idx * 20 + cIdx,
              blId: newEscaleId + idx + 1
            }))
          }));
        } else {
          extractedBls = buildScreenshotBls(newEscaleId);
        }

        const actualFileName = (fileNameSource && fileNameSource !== 'Pasted_GUCE_Manifest.xml')
          ? fileNameSource
          : `GUCE_MANIFESTE_${newEscale.nomNavire.replace(/\s+/g, '_')}_${newEscale.numeroVoyage}.XML`;

        setLastXmlFileName(actualFileName);
        localStorage.setItem('bocs_last_xml_filename', actualFileName);

        onImportManifest(newEscale, extractedBls);
        onLogAudit('IMPORT_MANIFESTE_GUCE', 'ManifesteXML', `Importation réussie de ${actualFileName} (${extractedBls.length} BLs extraits pour navire ${newEscale.nomNavire})`);
        setIsProcessingXml(false);
        setShowPasteXmlModal(false);
        setPastedXmlText('');
        toastSuccess(`Intégration XML réussie ! Escale "${newEscale.nomNavire}" (Voyage ${newEscale.numeroVoyage}) créée avec ${extractedBls.length} BL(s) extraits.`);
      } catch (err: any) {
        setIsProcessingXml(false);
        toastError('Erreur lors du traitement du fichier XML GUCE : ' + err.message);
      }
    }, 600);
  };

  const [isDragOver, setIsDragOver] = useState(false);

  const handleOpenMultiPdfModal = () => {
    if (escales.length === 0) {
      toastWarning("Veuillez d'abord créer une escale avant de charger les manifestes.");
      setShowAddEscaleModal(true);
      return;
    }
    setShowMultiPdfModal(true);
  };

  const handleCommitMultiPdfGroups = (groups: EscaleCommitGroup[]) => {
    let totalBls = 0;
    groups.forEach(group => {
      onImportManifest(group.escale, group.bls);
      totalBls += group.bls.length;
    });

    if (groups.length > 0) {
      setSelectedEscaleId(groups[0].escale.id);
    }

    const escalesSummary = groups.map(g => `${g.escale.nomNavire} (${g.bls.length} BLs)`).join(', ');
    onLogAudit(
      'IMPORT_MANIFESTE_PDF_MULTI',
      'ManifestePDF',
      `Rattachement réussi de ${totalBls} BL(s) via extraction Multi-PDF à l'escale : ${escalesSummary}`
    );
    toastSuccess(`Succès ! ${totalBls} connaissement(s) rattaché(s) à l'escale ${escalesSummary}.`);
  };

  const handleXmlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    const xmlFile = files.find(f => f.name.toLowerCase().endsWith('.xml'));

    if (pdfFiles.length > 0) {
      setMultiPdfInitialFiles(pdfFiles);
      setShowMultiPdfModal(true);
    } else if (xmlFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const xmlContent = event.target?.result as string;
        processXmlContent(xmlContent, xmlFile.name);
      };
      reader.readAsText(xmlFile);
    }
    e.target.value = '';
  };

  const handlePdfFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length > 0) {
      setMultiPdfInitialFiles(pdfFiles);
      setShowMultiPdfModal(true);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    const xmlFile = files.find(f => f.name.toLowerCase().endsWith('.xml'));

    if (pdfFiles.length > 0) {
      setMultiPdfInitialFiles(pdfFiles);
      setShowMultiPdfModal(true);
    } else if (xmlFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const xmlContent = event.target?.result as string;
        processXmlContent(xmlContent, xmlFile.name);
      };
      reader.readAsText(xmlFile);
    }
  };

  const handleCreateEscaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomNavire || !numeroVoyage) return;

    const newEscale: Escale = {
      id: Date.now(),
      nomNavire,
      callsign: callsign || `CS-${Math.floor(1000 + Math.random() * 9000)}`,
      numeroVoyage,
      portChargement,
      portDechargement,
      dateArrivee: new Date().toISOString().split('T')[0],
      statut: 'EN_COURS'
    };

    onAddEscale(newEscale);
    setSelectedEscaleId(newEscale.id);
    onLogAudit('CREATION_ESCALE', 'Escale', `Création manuelle de l'escale ${nomNavire} (Voyage ${numeroVoyage})`);
    setShowAddEscaleModal(false);
    setNomNavire('');
    setCallsign('');
    setNumeroVoyage('');
    toastSuccess(`Escale "${nomNavire}" (Voyage ${numeroVoyage}) créée avec succès ! Cliquez sur "Charger Manifestes" pour y rattacher vos connaissements.`);
  };

  const handleCreateBlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNumeroBl.trim()) {
      toastWarning('Veuillez saisir un numéro de BL valide.');
      return;
    }

    const targetEscaleId = manualEscaleId ? Number(manualEscaleId) : (selectedEscaleId !== 'ALL' ? Number(selectedEscaleId) : (escales.length > 0 ? escales[0].id : Date.now()));
    const targetEscale = escales.find(esc => esc.id === targetEscaleId) || {
      id: targetEscaleId,
      nomNavire: 'BOCS BREMEN',
      callsign: 'D5ZW3',
      numeroVoyage: '25586',
      portChargement: 'ANVERS (BEANR)',
      portDechargement: 'ABIDJAN (CIABJ)',
      dateArrivee: '2025-07-16',
      statut: 'EN_COURS' as const
    };

    const newBlId = Date.now();
    const ctn20Count = Number(manualCount20) || 0;
    const ctn40Count = Number(manualCount40) || 0;

    const conteneurs20 = Array.from({ length: ctn20Count }).map((_, cIdx) => ({
      id: newBlId + cIdx + 1,
      blId: newBlId,
      numeroConteneur: `BOCU${Math.floor(1000000 + Math.random() * 9000000)}`,
      typeConteneur: '20_DRY' as const,
      numeroScelle: `SEAL ${Math.floor(100000 + Math.random() * 900000)}`,
      poidsKg: Math.round((Number(manualPoidsBrutKg) || 20000) / (ctn20Count + ctn40Count || 1)),
      tareKg: 2350,
      nombreColis: Math.round((Number(manualNombreColis) || 100) / (ctn20Count + ctn40Count || 1)),
      montantCautionFcfa: 500000,
      statutLivraison: 'AU_PARC' as const,
      dateEntreeParc: new Date().toISOString()
    }));

    const conteneurs40 = Array.from({ length: ctn40Count }).map((_, cIdx) => ({
      id: newBlId + ctn20Count + cIdx + 1,
      blId: newBlId,
      numeroConteneur: `TCIU${Math.floor(1000000 + Math.random() * 9000000)}`,
      typeConteneur: '40_HC' as const,
      numeroScelle: `SEAL ${Math.floor(100000 + Math.random() * 900000)}`,
      poidsKg: Math.round((Number(manualPoidsBrutKg) || 20000) / (ctn20Count + ctn40Count || 1)),
      tareKg: 3900,
      nombreColis: Math.round((Number(manualNombreColis) || 100) / (ctn20Count + ctn40Count || 1)),
      montantCautionFcfa: 1000000,
      statutLivraison: 'AU_PARC' as const,
      dateEntreeParc: new Date().toISOString()
    }));

    const newBl: BL = {
      id: newBlId,
      escaleId: targetEscaleId,
      numeroBL: manualNumeroBl.trim().toUpperCase(),
      typeOperation: 'IMPORT',
      shipperNom: manualShipperNom.trim() || 'EXPÉDITEUR NON SPÉCIFIÉ',
      shipperAdresse: manualShipperAdresse.trim() || 'ABIDJAN, CÔTE D\'IVOIRE',
      consigneeNom: manualConsigneeNom.trim() || 'DESTINATAIRE NON SPÉCIFIÉ',
      consigneeAdresse: manualConsigneeAdresse.trim() || 'ABIDJAN, CÔTE D\'IVOIRE',
      notifyNom: manualConsigneeNom.trim() || 'TO ORDER',
      notifyAdresse: manualConsigneeAdresse.trim() || 'ABIDJAN, CÔTE D\'IVOIRE',
      portChargementCode: 'BEANR',
      portDechargementCode: 'CIABJ',
      destinationFinale: 'CI',
      descriptionGoods: manualDescriptionGoods.trim() || 'MARCHANDISES DIVERSES',
      marquesEtNumeros: 'N/M',
      nombreColis: Number(manualNombreColis) || 1,
      typeEmballage: manualTypeEmballage,
      poidsBrutKg: Number(manualPoidsBrutKg) || 1000,
      volumeM3: Number(manualVolumeM3) || 0,
      statutImport: 'EN_ATTENTE',
      conteneurs: [...conteneurs20, ...conteneurs40]
    };

    onImportManifest(targetEscale, [newBl]);
    onLogAudit('CREATION_BL_MANUEL', 'BL', `Création manuelle du BL ${newBl.numeroBL} pour escale ${targetEscale.nomNavire}`);
    
    setShowAddBlModal(false);
    setManualNumeroBl('');
    setManualShipperNom('');
    setManualShipperAdresse('');
    setManualConsigneeNom('');
    setManualConsigneeAdresse('');
    setManualCount20(0);
    setManualCount40(0);
    toastSuccess(`Connaissement (BL) "${newBl.numeroBL}" ajouté avec succès !`);
  };

  const getBlCategory = (bl: BL): FretCategory => {
    if (bl.conteneurs && bl.conteneurs.length > 0) return 'CONTENEUR';
    const emballage = (bl.typeEmballage || '').toUpperCase();
    const marques = (bl.marquesEtNumeros || '').toUpperCase();
    const desc = (bl.descriptionGoods || '').toUpperCase();
    if (emballage === 'VRAC' || desc.includes('VRAC') || marques.includes('CDE')) return 'VRAC';
    if (emballage === 'RORO' || emballage.includes('VEHICULE') || emballage.includes('RO-RO') || marques.includes('CHASSIS') || marques.includes('RO-RO') || desc.includes('VEHICULE') || desc.includes('TRUCK') || desc.includes('TRAILER')) {
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

  // Dérive un préfixe court (3 lettres) depuis le nom du type de facture
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

  const handleOpenInvoiceSelection = (bl: BL) => {
    const existing = plannedInvoicesByBl[bl.id] || bl.selectedInvoiceTypeIds || [];
    const blCat = getBlCategory(bl);
    const isDangerousBl = bl.conteneurs?.some(c => c.isDangerous) || false;

    if (existing.length > 0) {
      // Filter out non-applicable ones
      const filteredExisting = existing.filter(id => {
        const typeConfig = invoiceTypeConfigs.find(t => t.id === id);
        if (!typeConfig) return true;
        const isCaution = typeConfig.name.toLowerCase().includes('caution');
        const isTransfert = typeConfig.name.toLowerCase().includes('transfert');
        const isSurestarieOrDetention = 
          typeConfig.name.toLowerCase().includes('surestarie') || 
          typeConfig.name.toLowerCase().includes('detention') || 
          typeConfig.name.toLowerCase().includes('détention');
        if (isCaution && blCat !== 'CONTENEUR') return false;
        if (isTransfert && (blCat !== 'CONTENEUR' || isDangerousBl)) return false;
        if (isSurestarieOrDetention) {
          if (blCat !== 'CONTENEUR') return false;
          // Ne jamais cocher les surestaries/détentions par défaut sauf si déjà calculées ou réglées
          const calcKey = `${bl.id}-${typeConfig.id}`;
          const isCalcValidated = validatedCalculations[calcKey] !== undefined;
          const matchingInv = invoices.find(inv => 
            (inv.blId === bl.id || inv.numeroBL === bl.numeroBL) &&
            (inv.invoiceTypeId === typeConfig.id || inv.typeFacture.toLowerCase().includes(typeConfig.name.toLowerCase())) &&
            inv.statutFacture !== 'ANNULEE' &&
            (inv.soldeDuFcfa === 0 || inv.statutPaiement === 'PAYE')
          );
          if (!isCalcValidated && !matchingInv) return false;
        }
        return true;
      });
      setSelectedTypeIdsForBl(filteredExisting);
    } else {
      const activeTypeIds = invoiceTypeConfigs
        .filter(t => {
          const isCaution = t.name.toLowerCase().includes('caution');
          const isEchange = t.name.toLowerCase().includes('echange') || t.name.toLowerCase().includes('échange') || t.id === '2';
          const isTransfert = t.name.toLowerCase().includes('transfert');
          const isSurestarieOrDetention = 
            t.name.toLowerCase().includes('surestarie') || 
            t.name.toLowerCase().includes('detention') || 
            t.name.toLowerCase().includes('détention');
          const isTelex = t.name.toLowerCase().includes('telex');
            
          // HORMIS LA FACTURE TELEX
          if (isTelex) return false;

          if (isCaution && blCat !== 'CONTENEUR') return false;
          if (isTransfert && (blCat !== 'CONTENEUR' || isDangerousBl)) return false;
          // Ne JAMAIS cocher les surestaries ou détentions par défaut
          if (isSurestarieOrDetention) return false;
          
          if (blCat === 'CONTENEUR') {
            // Pour le type CONTENEUR, seuls Caution, Échange et Transfert sont cochés par défaut
            return isCaution || isEchange || isTransfert;
          }
          
          // Pour les autres types (VRAC, RORO, CONVENTIONNEL), SEULE la palette Échange est cochée par défaut
          return isEchange;
        })
        .map(t => t.id);
      setSelectedTypeIdsForBl(activeTypeIds.length > 0 ? activeTypeIds : (invoiceTypeConfigs.length > 0 ? [invoiceTypeConfigs[0].id] : ['2']));
    }
    setBlForInvoiceSelection(bl);
  };

  const handleConfirmInvoiceSelection = () => {
    if (!blForInvoiceSelection) return;

    const paidTypeIds = invoiceTypeConfigs
      .filter(t => {
        const inv = invoices.find(i => 
          (i.blId === blForInvoiceSelection.id || i.numeroBL === blForInvoiceSelection.numeroBL) &&
          (i.invoiceTypeId === t.id || i.typeFacture.toLowerCase().includes(t.name.toLowerCase())) &&
          i.statutFacture !== 'ANNULEE' &&
          (i.soldeDuFcfa === 0 || i.statutPaiement === 'PAYE')
        );
        return Boolean(inv);
      })
      .map(t => t.id);

    const mergedSelected = Array.from(new Set([...selectedTypeIdsForBl, ...paidTypeIds]));

    if (mergedSelected.length === 0) {
      toastWarning('Veuillez sélectionner au moins un type de facture pour ce connaissement.');
      return;
    }

    setPlannedInvoicesByBl(prev => ({
      ...prev,
      [blForInvoiceSelection.id]: mergedSelected
    }));

    const updatedBl: BL = {
      ...blForInvoiceSelection,
      selectedInvoiceTypeIds: mergedSelected
    };

    if (onUpdateBl) {
      onUpdateBl(updatedBl);
    }

    const chosenNames = invoiceTypeConfigs
      .filter(t => selectedTypeIdsForBl.includes(t.id))
      .map(t => t.name)
      .join(', ');

    onLogAudit(
      'PLANIFICATION_FACTURES_BL',
      'BL',
      `Planification de ${selectedTypeIdsForBl.length} facture(s) (${chosenNames}) pour le BL ${blForInvoiceSelection.numeroBL}`
    );

    setBlForInvoiceSelection(null);
  };

  const handleGenerateProformaForType = (bl: BL, typeConfig: InvoiceTypeConfig, existingInvoice?: Invoice) => {
    const blCategory = getBlCategory(bl);

    const isEchangeType = typeConfig.id === '2' || typeConfig.name.toLowerCase().includes('echange');
    const socContainers = (bl.conteneurs || []).filter(c => c.socCoc === 'SOC');
    const cocContainers = (bl.conteneurs || []).filter(c => c.socCoc === 'COC' || !c.socCoc);

    // Strictly filter active rubriques for this category & specific container regime
    const calcKey = `${bl.id}-${typeConfig.id}`;
    const validation = validatedCalculations[calcKey];

    let lines = [];
    if (validation) {
      lines = validation.details.flatMap((det: any) => {
        if (det.breakdown && det.breakdown.length > 0) {
          return det.breakdown.map((b: any) => ({
            designation: `${typeConfig.name} - Conteneur ${det.numeroConteneur} (${det.typeConteneur}) : Tranche ${b.label} (${b.days} j)${b.dateString ? `<br/><span style="font-size: 8px; font-weight: normal; color: #475569;">${b.dateString} (${b.days}j x ${b.rate.toLocaleString('fr-FR')} FCFA)</span>` : ''}`,
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

    // Exclude any line with 0 quantity or 0 amount
    lines = lines.filter(l => l.quantite > 0 && l.montantHtFcfa > 0);

    // Fallback if no rubriques are configured
    if (lines.length === 0) {
      lines = [
        { 
          designation: `Frais administratifs - ${typeConfig.name}`, 
          typeFrais: 'AUTRE', 
          quantite: 1, 
          prixUnitaireFcfa: 100000, 
          montantHtFcfa: 100000, 
          tauxTva: 18 
        }
      ];
    }

    const calculatedHt = lines.reduce((sum, l) => sum + l.montantHtFcfa, 0);
    const calculatedTva = Math.round(calculatedHt * 0.18);
    const calculatedTtc = calculatedHt + calculatedTva;

    if (existingInvoice) {
      const updatedInvoice = {
        ...existingInvoice,
        lignes: lines,
        montantHtFcfa: calculatedHt,
        tvaFcfa: calculatedTva,
        montantTtcFcfa: calculatedTtc,
        soldeDuFcfa: existingInvoice.statutPaiement === 'PAYE' ? 0 : calculatedTtc
      };
      if (onUpdateInvoice) {
        onUpdateInvoice(updatedInvoice);
      }
      generateProformaPdf(updatedInvoice, bl, 'Agence BOCS Abidjan');
      return;
    }

    const targetEscale = escales.find(e => e.id === bl.escaleId);
    const voyageNumber = targetEscale ? targetEscale.numeroVoyage : 'VOYAGE';
    const nextProformaNumber = getNextInvoiceNumber('PROFORMA', voyageNumber, invoices, typeConfig.name);
    const today = new Date().toISOString().split('T')[0];

    const invoice: Invoice = {
      id: Date.now(),
      blId: bl.id,
      numeroBL: bl.numeroBL,
      clientId: bl.clientId,
      clientNom: bl.consigneeNom,
      escaleInfo: targetEscale ? `${targetEscale.nomNavire} V.${voyageNumber}` : `Escale BL #${bl.numeroBL}`,
      typeFacture: 'PROFORMA_IMPORT',
      numeroFacture: nextProformaNumber,
      dateFacture: today,
      dateEcheance: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      devise: 'FCFA',
      tauxChangeUsd: 600,
      montantHtFcfa: calculatedHt,
      tvaFcfa: calculatedTva,
      montantTtcFcfa: calculatedTtc,
      soldeDuFcfa: calculatedTtc,
      statutPaiement: 'NON_PAYE',
      invoiceTypeId: typeConfig.id,
      lignes: lines
    };

    onGenerateInvoice(invoice);
    onLogAudit(
      'GENERATION_PROFORMA_IMPORT', 
      'Facture', 
      `Génération de la facture proforma ${typeConfig.name.replace(/^Facture\s+/i, '')} (${invoice.numeroFacture}) pour BL ${bl.numeroBL}`
    );
    generateProformaPdf(invoice, bl, 'Agence BOCS Abidjan');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 ocean-glass-banner p-6 rounded-2xl shadow-sm border border-zinc-200 bg-white">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="material-symbols-outlined text-[#005DAA] text-2xl font-black">arrow_right_alt</span>
            <h1 className="text-2xl font-black text-[#005DAA] font-display tracking-tight">Gestion des Manifestes Import &amp; BLs</h1>
          </div>
          <p className="text-xs text-zinc-600 font-medium">
            Intégration des fichiers XML GUCE/ALIS, gestion des connaissements et émission des factures par connaissement.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <input 
            type="file" 
            multiple
            accept=".xml,.pdf"
            id="xml-upload" 
            className="hidden" 
            onChange={handleXmlFileUpload} 
          />
          {/* Étape 1 : L'utilisateur crée l'escale */}
          <button
            onClick={() => setShowAddEscaleModal(true)}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-black text-white font-bold text-xs rounded-xl border border-zinc-900 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Créer une nouvelle escale maritime"
          >
            <span className="material-symbols-outlined text-base text-[#005DAA]">add_circle</span>
            <span>1. Créer une Escale</span>
          </button>

          {/* Étape 2 : Chargement des manifestes rattachés à l'escale */}
          <button
            onClick={handleOpenMultiPdfModal}
            className="px-3.5 py-2 bg-[#F0F7FF] hover:bg-[#E1EFFF] text-[#005DAA] border border-[#005DAA]/40 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Sélectionner les manifestes PDF dont les connaissements seront rattachés à l'escale"
          >
            <span className="material-symbols-outlined text-base text-[#005DAA]">picture_as_pdf</span>
            <span>2. Charger Manifestes (PDF)</span>
            {selectedEscaleId !== 'ALL' && (
              <span className="px-1.5 py-0.5 rounded bg-white text-[10px] font-mono font-bold text-zinc-900 border border-[#005DAA]/25">
                {escales.find(e => e.id === selectedEscaleId)?.nomNavire} (V.{escales.find(e => e.id === selectedEscaleId)?.numeroVoyage})
              </span>
            )}
          </button>

          <button
            onClick={() => {
              document.getElementById('xml-upload')?.click();
            }}
            className="px-3.5 py-2 bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base text-[#005DAA]">file_upload</span>
            <span>Import XML/PDF</span>
          </button>
          <button
            onClick={() => setShowPasteXmlModal(true)}
            className="px-3.5 py-2 bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base text-[#005DAA]">code</span>
            <span>Coller XML</span>
          </button>
          <button
            onClick={() => setShowAddBlModal(true)}
            className="px-3.5 py-2 bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base">post_add</span>
            <span>Nouveau BL Manuel</span>
          </button>
        </div>
      </div>

      {/* BL Table Section */}
      <div className="ocean-glass-card rounded-2xl overflow-hidden shadow-sm border border-zinc-200 bg-white !mt-2">
        
        {/* Table Controls */}
        <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Escale Filter & Search */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedEscaleId}
              onChange={e => setSelectedEscaleId(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10))}
              className="bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-300 rounded-xl px-3.5 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer focus:outline-none focus:border-[#005DAA]"
            >
              <option value="ALL">Toutes les Escales ({escales.length})</option>
              {escales.map(esc => (
                <option key={esc.id} value={esc.id}>
                  {esc.nomNavire} - Voyage {esc.numeroVoyage}
                </option>
              ))}
            </select>

            {selectedEscaleId !== 'ALL' && (
              <>
                <button
                  type="button"
                  onClick={handleOpenMultiPdfModal}
                  className="px-3 py-2 bg-[#F0F7FF] hover:bg-[#E1EFFF] text-[#005DAA] border border-[#005DAA]/30 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Sélectionner les manifestes PDF à rattacher à cette escale"
                >
                  <span className="material-symbols-outlined text-sm text-[#005DAA]">upload_file</span>
                  <span>Charger Manifestes pour cette escale</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetEsc = escales.find(e => e.id === selectedEscaleId);
                    const escBls = bls.filter(b => b.escaleId === selectedEscaleId);
                    if (targetEsc) {
                      generateImportManifestPdf(targetEsc, escBls);
                    }
                  }}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Imprimer le Manifeste Import aux couleurs de BOCS"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  <span>Manifeste BOCS</span>
                </button>
              </>
            )}

            <button
              onClick={() => setShowAddBlModal(true)}
              className="px-3.5 py-2 bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm text-[#005DAA]">post_add</span>
              <span>Ajouter un BL</span>
            </button>

            <div className="relative flex-1 sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="N° BL, Consignee, Shipper, Conteneur..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#005DAA]"
              />
            </div>
          </div>

          {/* Quick Filter Chips & CSV Export */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 w-full border-t border-zinc-200">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setQuickFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                  quickFilter === 'ALL' ? 'bg-[#005DAA] text-white font-black shadow-xs' : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
                }`}
              >
                Tous ({bls.filter(b => selectedEscaleId === 'ALL' || b.escaleId === selectedEscaleId).length})
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter('DANGEROUS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                  quickFilter === 'DANGEROUS' ? 'bg-rose-600 text-white font-black shadow-xs' : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                }`}
              >
                <span className="material-symbols-outlined text-xs">warning</span>
                <span>Dangereux</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter('WITH_CONTAINERS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                  quickFilter === 'WITH_CONTAINERS' ? 'bg-blue-600 text-white font-black shadow-xs' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                }`}
              >
                <span className="material-symbols-outlined text-xs">inventory_2</span>
                <span>Avec Conteneurs</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter('WITHOUT_INVOICE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                  quickFilter === 'WITHOUT_INVOICE' ? 'bg-amber-600 text-white font-black shadow-xs' : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                }`}
              >
                <span className="material-symbols-outlined text-xs">receipt_long</span>
                <span>Sans Facture</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                  quickFilter === 'PENDING' ? 'bg-zinc-800 text-white font-black shadow-xs' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                }`}
              >
                <span className="material-symbols-outlined text-xs">hourglass_empty</span>
                <span>En Attente</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 font-bold font-mono">
                {filteredBls.length} BL(s)
              </span>
              <button
                onClick={() => exportBlsCsv(filteredBls)}
                title="Exporter la liste des BLs en CSV (Excel)"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 text-xs font-bold rounded-lg transition-all active:scale-95 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-emerald-600">table_view</span>
                <span>Exporter CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table avec Ascenseur Vertical & Horizontal (Scrollbar) */}
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-310px)] min-h-[500px] bocs-scrollbar relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-zinc-100/95 backdrop-blur-md shadow-xs">
              <tr className="text-[11px] font-black text-zinc-800 uppercase tracking-wider border-b border-zinc-200 select-none">
                <th className="p-3.5 cursor-pointer hover:bg-zinc-200/60 transition-colors" onClick={() => toggleSort('numeroBL')}>
                  <div className="flex items-center gap-1">
                    <span>Numéro BL</span>
                    <span className="material-symbols-outlined text-[13px] opacity-80">{sortField === 'numeroBL' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
                  </div>
                </th>
                <th className="p-3.5 cursor-pointer hover:bg-zinc-200/60 transition-colors" onClick={() => toggleSort('consigneeNom')}>
                  <div className="flex items-center gap-1">
                    <span>Consignee (Destinataire)</span>
                    <span className="material-symbols-outlined text-[13px] opacity-80">{sortField === 'consigneeNom' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
                  </div>
                </th>
                <th className="p-3.5 cursor-pointer hover:bg-zinc-200/60 transition-colors" onClick={() => toggleSort('poidsBrutKg')}>
                  <div className="flex items-center gap-1">
                    <span>Poids / Vol / Colis</span>
                    <span className="material-symbols-outlined text-[13px] opacity-80">{sortField === 'poidsBrutKg' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
                  </div>
                </th>
                <th className="p-3.5">
                  <div className="flex items-center gap-1">
                    <span>Conteneurs</span>
                  </div>
                </th>
                <th className="p-3.5 cursor-pointer hover:bg-zinc-200/60 transition-colors" onClick={() => toggleSort('statutImport')}>
                  <div className="flex items-center gap-1">
                    <span>Statut Import</span>
                    <span className="material-symbols-outlined text-[13px] opacity-80">{sortField === 'statutImport' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
                  </div>
                </th>
                <th className="p-3.5 text-right">Actions Proforma &amp; PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs">
              {filteredBls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    {selectedEscaleId !== 'ALL' ? (
                      (() => {
                        const targetEsc = escales.find(e => e.id === selectedEscaleId);
                        return (
                          <div className="max-w-md mx-auto space-y-3">
                            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/25 flex items-center justify-center shadow-xs">
                              <span className="material-symbols-outlined text-2xl">directions_boat</span>
                            </div>
                            <div>
                              <h4 className="font-black text-sm text-zinc-900 font-display">
                                Escale : {targetEsc?.nomNavire || 'Escale sélectionnée'} (Voyage {targetEsc?.numeroVoyage || ''})
                              </h4>
                              <p className="text-xs text-zinc-500 font-medium mt-1">
                                Aucun connaissement n'est encore rattaché à cette escale. Cliquez sur le bouton ci-dessous pour sélectionner vos manifestes PDF dont les connaissements seront rattachés à cette escale.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleOpenMultiPdfModal}
                              className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95"
                            >
                              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                              <span>Charger les Manifestes PDF pour cette escale</span>
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="space-y-1">
                        <span className="material-symbols-outlined text-4xl block mb-2 text-zinc-400">search_off</span>
                        <span className="font-bold text-zinc-600">Aucun connaissement (BL) trouvé pour ces critères.</span>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredBls.map((bl: BL) => {
                  const blInvoices = invoices.filter(inv => inv.blId === bl.id || inv.numeroBL === bl.numeroBL);
                  const activeBlInvoices = blInvoices.filter(inv => inv.statutFacture !== 'ANNULEE' && inv.statutFacture !== 'AVOIR');
                  
                  const plannedTypeIds = plannedInvoicesByBl[bl.id] || bl.selectedInvoiceTypeIds || [];
                  const plannedConfigs = invoiceTypeConfigs.filter(t => plannedTypeIds.includes(t.id));
                  
                  const generatedConfigs = plannedConfigs.filter(t => 
                    activeBlInvoices.some(i => 
                       i.invoiceTypeId === t.id || 
                       i.typeFacture.toLowerCase().includes(t.name.toLowerCase())
                    )
                  );

                  const paidConfigs = plannedConfigs.filter(t => {
                    const inv = activeBlInvoices.find(i => 
                      i.invoiceTypeId === t.id || 
                      i.typeFacture.toLowerCase().includes(t.name.toLowerCase())
                    );
                    return inv && (inv.soldeDuFcfa === 0 || inv.statutPaiement === 'PAYE');
                  });

                  const cancelledConfigs = plannedConfigs.filter(t => {
                    const hasActive = activeBlInvoices.some(i => 
                      i.invoiceTypeId === t.id || 
                      i.typeFacture.toLowerCase().includes(t.name.toLowerCase())
                    );
                    const hasCancelled = blInvoices.some(i => 
                      (i.invoiceTypeId === t.id || 
                       i.typeFacture.toLowerCase().includes(t.name.toLowerCase())) &&
                      (i.statutFacture === 'ANNULEE' || i.statutFacture === 'AVOIR')
                    );
                    return !hasActive && hasCancelled;
                  });

                  const pendingConfigs = plannedConfigs.filter(t => 
                    !generatedConfigs.some(g => g.id === t.id) && !cancelledConfigs.some(c => c.id === t.id)
                  );

                  const allGenerated = (plannedConfigs.length > 0 && pendingConfigs.length === 0 && cancelledConfigs.length === 0);
                  const allPaid = (plannedConfigs.length > 0 && paidConfigs.length === plannedConfigs.length);

                  return (
                    <tr
                      key={bl.id}
                      className="hover:bg-[#FFF8F5] transition-colors border-b border-zinc-100 group cursor-pointer"
                      onClick={() => {
                        setEditingBl(bl);
                        setEditBlForm(JSON.parse(JSON.stringify(bl)));
                        setEditBlTab('general');
                      }}
                      title="Cliquer pour modifier ce connaissement"
                    >
                      <td className="p-3.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedBlDetails(bl); }}
                          className="font-mono font-black text-[#005DAA] group-hover:text-[#004580] hover:underline text-sm block cursor-pointer text-left focus:outline-none tracking-tight"
                          title="Voir les détails de ce BL"
                        >
                          {bl.numeroBL}
                        </button>
                        <span className="text-[11px] text-zinc-500 font-semibold truncate block max-w-[180px]" title={bl.shipperNom}>
                          {bl.shipperNom || 'Chargeur non spécifié'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-black text-black text-xs uppercase tracking-tight leading-snug">
                          {bl.consigneeNom}
                        </div>
                        {bl.consigneeAdresse && (
                          <div className="text-[10px] text-zinc-500 font-medium truncate max-w-[200px] mt-0.5" title={bl.consigneeAdresse}>
                            {bl.consigneeAdresse}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 font-mono">
                        <div className="font-bold text-zinc-950 text-xs">{(bl.poidsBrutKg || 0).toLocaleString('fr-FR')} kg</div>
                        <div className="text-[10px] text-zinc-500 font-medium mt-0.5">
                          {bl.volumeM3 ? `${bl.volumeM3.toLocaleString('fr-FR')} m³ | ` : '0 m³ | '}
                          {bl.nombreColis} {bl.typeEmballage === 'VRAC' ? 'vrac' : bl.typeEmballage === 'RORO' ? 'véhicule(s)' : 'colis'}
                        </div>
                      </td>
                      <td className="p-3.5">
                        {bl.conteneurs && bl.conteneurs.length > 0 ? (
                          (() => {
                            const ctns20 = bl.conteneurs.filter((c: Container) => c.typeConteneur && c.typeConteneur.startsWith('20'));
                            const ctns40 = bl.conteneurs.filter((c: Container) => c.typeConteneur && c.typeConteneur.startsWith('40'));
                            const ctnsOther = bl.conteneurs.filter((c: Container) => !c.typeConteneur || (!c.typeConteneur.startsWith('20') && !c.typeConteneur.startsWith('40')));

                            const groups = [
                              { type: '20', label: `${ctns20.length} x 20'`, ctns: ctns20, bgBadge: 'bg-[#F0F7FF] border-[#005DAA]/30 text-[#005DAA]' },
                              { type: '40', label: `${ctns40.length} x 40'`, ctns: ctns40, bgBadge: 'bg-zinc-100 border-zinc-300 text-zinc-900' },
                              { type: 'other', label: `${ctnsOther.length} x Divers`, ctns: ctnsOther, bgBadge: 'bg-zinc-100 border-zinc-200 text-zinc-800' }
                            ].filter(g => g.ctns.length > 0);

                            return (
                              <div className="flex flex-wrap items-start gap-2 font-mono">
                                {groups.map(g => {
                                  const coc = g.ctns.filter((c: Container) => c.socCoc === 'COC' || !c.socCoc);
                                  const soc = g.ctns.filter((c: Container) => c.socCoc === 'SOC');
                                  const dang = g.ctns.filter((c: Container) => c.isDangerous);

                                  return (
                                    <div key={g.type} className="flex flex-col items-start gap-1">
                                      <span className={`px-2 py-0.5 rounded-md border text-xs font-black shadow-2xs ${g.bgBadge}`}>
                                        {g.label}
                                      </span>
                                      <div className="flex flex-wrap items-center gap-1">
                                        {coc.length > 0 && (
                                          <span className="px-1.5 py-0.2 rounded bg-zinc-100 border border-zinc-300 text-zinc-800 text-[9px] font-black flex items-center gap-0.5" title={`${coc.length} conteneur(s) COC (Armement)`}>
                                            <span className="material-symbols-outlined text-[10px]">directions_boat</span>
                                            <span>{coc.length < g.ctns.length ? `${coc.length} COC` : 'COC'}</span>
                                          </span>
                                        )}
                                        {soc.length > 0 && (
                                          <span className="px-1.5 py-0.2 rounded bg-purple-50 border border-purple-200 text-purple-800 text-[9px] font-black flex items-center gap-0.5" title={`${soc.length} conteneur(s) SOC (Client)`}>
                                            <span className="material-symbols-outlined text-[10px]">person</span>
                                            <span>{soc.length < g.ctns.length ? `${soc.length} SOC` : 'SOC'}</span>
                                          </span>
                                        )}
                                        {dang.length > 0 && (
                                          <span className="px-1.5 py-0.2 rounded bg-rose-50 border border-rose-300 text-rose-700 text-[9px] font-black flex items-center gap-0.5 animate-pulse" title={`${dang.length} conteneur(s) avec marchandises dangereuses (IMDG)`}>
                                            <span className="material-symbols-outlined text-[10px] text-rose-600 font-bold">warning</span>
                                            <span>{dang.length < g.ctns.length ? `${dang.length} DANG.` : 'DANG.'}</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()
                        ) : (bl.typeEmballage === 'VRAC' || bl.descriptionGoods?.toUpperCase().includes('VRAC')) ? (
                          <div className="flex flex-col gap-1 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2.5 py-0.5 rounded-md border text-[11px] font-black bg-amber-50 border-amber-300 text-amber-900 flex items-center gap-1 shadow-2xs">
                                <span className="material-symbols-outlined text-xs text-amber-600">grain</span>
                                <span>VRAC</span>
                              </span>
                              <span className="text-zinc-900 text-xs font-bold truncate max-w-[140px]" title={bl.marquesEtNumeros || bl.descriptionGoods}>
                                {bl.marquesEtNumeros || 'Vrac solide'}
                              </span>
                            </div>
                          </div>
                        ) : (bl.typeEmballage === 'RORO' || bl.descriptionGoods?.toUpperCase().includes('VEHICULE') || bl.descriptionGoods?.toUpperCase().includes('TRUCK') || bl.descriptionGoods?.toUpperCase().includes('TRAILER')) ? (
                          <div className="flex flex-col gap-1 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2.5 py-0.5 rounded-md border text-[11px] font-black bg-emerald-50 border-emerald-300 text-emerald-900 flex items-center gap-1 shadow-2xs">
                                <span className="material-symbols-outlined text-xs text-emerald-600">directions_car</span>
                                <span>RORO</span>
                              </span>
                              <span className="text-zinc-900 font-bold text-xs truncate max-w-[150px]" title={bl.marquesEtNumeros || 'Véhicule RORO'}>
                                {bl.marquesEtNumeros || 'Véhicule'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2.5 py-0.5 rounded-md border text-[11px] font-black bg-zinc-100 border-zinc-300 text-zinc-900 flex items-center gap-1 shadow-2xs">
                                <span className="material-symbols-outlined text-xs text-zinc-600">category</span>
                                <span>CONV.</span>
                              </span>
                              <span className="text-zinc-900 font-bold text-xs truncate max-w-[150px]" title={bl.marquesEtNumeros || 'Conventionnel'}>
                                {bl.marquesEtNumeros || 'Marchandise diverse'}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>

                    {/* Statut Column */}
                    <td className="p-3.5">
                      {plannedConfigs.length === 0 ? (
                        activeBlInvoices.length > 0 ? (
                          activeBlInvoices.every(inv => inv.soldeDuFcfa === 0 || inv.statutPaiement === 'PAYE') ? (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black border border-emerald-200 bg-emerald-50 text-emerald-800 inline-flex items-center gap-1 shadow-2xs">
                              <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                              <span>FACTURÉ &amp; RÉGLÉ</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-amber-200 bg-amber-50 text-amber-900 inline-flex items-center gap-1 shadow-2xs">
                              <span className="material-symbols-outlined text-xs text-amber-600">pending</span>
                              <span>FACTURÉ ({activeBlInvoices.filter(i => i.soldeDuFcfa === 0 || i.statutPaiement === 'PAYE').length}/{activeBlInvoices.length} réglé)</span>
                            </span>
                          )
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black border border-[#005DAA]/30 bg-[#F0F7FF] text-[#005DAA] shadow-2xs">
                            EN ATTENTE
                          </span>
                        )
                      ) : allPaid ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black border border-emerald-200 bg-emerald-50 text-emerald-800 inline-flex items-center gap-1 shadow-2xs">
                          <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                          <span>FACTURÉ &amp; RÉGLÉ</span>
                        </span>
                      ) : allGenerated ? (
                        <div className="flex flex-col gap-1">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-amber-200 bg-amber-50 text-amber-900 inline-flex items-center gap-1 shadow-2xs">
                            <span className="material-symbols-outlined text-xs text-amber-600">pending</span>
                            <span>FACTURÉ (Paiement en attente)</span>
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono font-bold">
                            {paidConfigs.length}/{plannedConfigs.length} réglée(s)
                          </span>
                        </div>
                      ) : cancelledConfigs.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-rose-200 bg-rose-50 text-rose-800 shadow-2xs inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-rose-600">cancel</span>
                            <span>{paidConfigs.length > 0 ? `${paidConfigs.length}/${plannedConfigs.length} réglé (${cancelledConfigs.length} annulée)` : 'FACTURE ANNULÉE'}</span>
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono font-bold">
                            {pendingConfigs.length > 0 && `${pendingConfigs.length} en attente`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black border border-[#005DAA]/30 bg-[#F0F7FF] text-[#005DAA] shadow-2xs inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-[#005DAA]">pending_actions</span>
                            <span>EN ATTENTE ({pendingConfigs.map(t => t.name.replace(/^Facture\s+/i, '')).join(', ')})</span>
                          </span>
                          {generatedConfigs.length > 0 && (
                            <span className="text-[10px] text-zinc-500 font-mono font-bold">
                              {paidConfigs.length}/{plannedConfigs.length} réglée(s) ({generatedConfigs.length} éditée(s))
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions Column */}
                    <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-nowrap items-center justify-end gap-1.5 min-w-max">
                        
                        {/* Bouton Primaire : Facturation Dédiée BL par BL */}
                        {onNavigateToBilling && (
                          <button
                            type="button"
                            onClick={() => onNavigateToBilling(bl)}
                            className="px-3.5 py-1.5 bg-[#005DAA] hover:bg-[#004580] text-white font-black rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                            title="Ouvrir la page de Facturation dédiée pour ce BL"
                          >
                            <span className="material-symbols-outlined text-sm">credit_card</span>
                            <span>Facturer ce BL &rarr;</span>
                          </button>
                        )}

                        {/* Bouton Édition BL */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditingBl(bl); setEditBlForm(JSON.parse(JSON.stringify(bl))); setEditBlTab('general'); }}
                          className="p-1.5 text-[#005DAA] hover:text-white bg-[#F0F7FF] hover:bg-[#005DAA] rounded-xl transition-all cursor-pointer border border-[#005DAA]/30 shadow-2xs"
                          title="Modifier ce connaissement"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>

                        {/* Bouton Consultation Détails BL */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedBlDetails(bl); }}
                          className="p-1.5 text-zinc-600 hover:text-zinc-950 bg-white hover:bg-zinc-100 rounded-xl transition-all cursor-pointer border border-zinc-200 shadow-2xs"
                          title="Consulter tous les détails maritimes du BL"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                        </button>

                        {/* Raccourcis Factures existantes */}
                        {plannedConfigs.length > 0 && (
                          <>
                            {plannedConfigs.map(typeConfig => {
                              const activeInv = activeBlInvoices.find(inv => 
                                inv.invoiceTypeId === typeConfig.id || 
                                inv.typeFacture.toLowerCase().includes(typeConfig.name.toLowerCase())
                              );

                              const cancelledInv = !activeInv ? blInvoices.find(inv => 
                                (inv.invoiceTypeId === typeConfig.id || 
                                 inv.typeFacture.toLowerCase().includes(typeConfig.name.toLowerCase())) &&
                                (inv.statutFacture === 'ANNULEE' || inv.statutFacture === 'AVOIR')
                              ) : undefined;

                              const isGen = !!activeInv;
                              const isPaid = activeInv ? (activeInv.soldeDuFcfa === 0 || activeInv.statutPaiement === 'PAYE') : false;
                              const isCancelled = !activeInv && !!cancelledInv;
                              let typeName = typeConfig.name.replace(/^Facture\s+/i, '');

                              return (
                                <button
                                  key={typeConfig.id}
                                  type="button"
                                  onClick={() => {
                                    if (activeInv) {
                                      generateProformaPdf(activeInv, bl, 'Agence BOCS Abidjan');
                                    } else {
                                      handleGenerateProformaForType(bl, typeConfig);
                                    }
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs ${
                                    isPaid
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                      : isCancelled
                                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                                      : isGen
                                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                                      : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
                                  }`}
                                  title={
                                    isPaid 
                                      ? `Facture ${typeName} réglée. Cliquer pour télécharger.`
                                      : isCancelled
                                      ? `Facture ${typeName} annulée par Avoir (${cancelledInv?.numeroFacture}).`
                                      : isGen
                                      ? `Facture ${typeName} éditée (Paiement en attente)`
                                      : `Éditer la Facture Proforma ${typeName}`
                                  }
                                >
                                  <span className="material-symbols-outlined text-xs">
                                    {isPaid ? 'check_circle' : isCancelled ? 'cancel' : isGen ? 'pending' : 'receipt_long'}
                                  </span>
                                  <span>{typeName}{isCancelled ? ' (Annulée)' : ''}</span>
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {/* Section Bas de Page Totaux (Poids, Volume, Colis, Conteneurs, Vrac, RoRo) */}
        {(() => {
          const totalPoidsKg = filteredBls.reduce((acc, b) => acc + (b.poidsBrutKg || 0), 0);
          const totalVolumeM3 = filteredBls.reduce((acc, b) => acc + (b.volumeM3 || 0), 0);
          const totalNombreColis = filteredBls.reduce((acc, b) => acc + (b.nombreColis || 0), 0);
          const totalConteneursCount = filteredBls.reduce((acc, b) => acc + (b.conteneurs?.length || 0), 0);
          const totalVracCount = filteredBls.filter(b => b.typeEmballage === 'VRAC' || (b.marquesEtNumeros && b.marquesEtNumeros.includes('CDE'))).reduce((acc, b) => acc + (b.nombreColis || 0), 0);
          const totalRoroCount = filteredBls.filter(b => b.typeEmballage === 'RORO').reduce((acc, b) => acc + (b.nombreColis || 0), 0);

          return (
            <div className="p-4 bg-zinc-900 text-white border-t border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs shadow-md rounded-b-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#005DAA] flex items-center justify-center text-white shadow-xs">
                  <span className="material-symbols-outlined text-xl">analytics</span>
                </div>
                <div>
                  <span className="font-black text-xs uppercase tracking-wider text-white font-display block">Synthèse du Manifeste</span>
                  <span className="text-[11px] text-zinc-400 font-mono font-semibold">{filteredBls.length} Connaissement(s) affiché(s)</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 font-mono">
                
                {/* Total Poids */}
                <div className="flex items-center gap-2 bg-zinc-800/90 px-3.5 py-2 rounded-xl border border-zinc-700/80 shadow-xs">
                  <span className="text-[10px] uppercase text-zinc-400 font-bold tracking-wider">Total Poids:</span>
                  <span className="font-black text-[#005DAA] text-sm">{totalPoidsKg.toLocaleString('fr-FR')} kg</span>
                  <span className="text-[10px] text-zinc-400 font-semibold">({(totalPoidsKg / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} T)</span>
                </div>

                {/* Total Volume */}
                <div className="flex items-center gap-2 bg-zinc-800/90 px-3.5 py-2 rounded-xl border border-zinc-700/80 shadow-xs">
                  <span className="text-[10px] uppercase text-zinc-400 font-bold tracking-wider">Total Volume:</span>
                  <span className="font-black text-white text-sm">{totalVolumeM3.toLocaleString('fr-FR')} m³</span>
                </div>

                {/* Total Conteneurs */}
                <div className="flex items-center gap-2 bg-[#005DAA] text-white px-3.5 py-2 rounded-xl border border-[#005DAA]/40 shadow-xs">
                  <span className="text-[10px] uppercase text-white/90 font-black tracking-wider">Conteneurs:</span>
                  <span className="font-black text-white text-sm">{totalConteneursCount} TC</span>
                </div>

                {/* Total Vrac */}
                <div className="flex items-center gap-2 bg-zinc-800 text-white px-3.5 py-2 rounded-xl border border-zinc-700 shadow-xs">
                  <span className="text-[10px] uppercase text-zinc-400 font-black tracking-wider">Vrac:</span>
                  <span className="font-black text-amber-400 text-sm">{totalVracCount}</span>
                </div>

                {/* Total RoRo */}
                <div className="flex items-center gap-2 bg-zinc-800 text-white px-3.5 py-2 rounded-xl border border-zinc-700 shadow-xs">
                  <span className="text-[10px] uppercase text-zinc-400 font-black tracking-wider">RoRo:</span>
                  <span className="font-black text-emerald-400 text-sm">{totalRoroCount}</span>
                </div>

              </div>
            </div>
          );
        })()}

      </div>

      {/* Modal BL Details - Grand Format, Riche & Structuré */}
      {selectedBlDetails && (() => {
        const matchedEscale = escales.find(e => e.id === selectedBlDetails.escaleId);
        const blInvoices = invoices.filter(inv => 
          (inv.blId === selectedBlDetails.id || inv.numeroBL === selectedBlDetails.numeroBL) &&
          inv.statutFacture !== 'ANNULEE'
        );
        const blCat = getBlCategory(selectedBlDetails);
        const hasDangerous = selectedBlDetails.conteneurs?.some(c => c.isDangerous) || selectedBlDetails.descriptionGoods?.toUpperCase().includes('IMO') || selectedBlDetails.descriptionGoods?.toUpperCase().includes('DANGEREUX');
        const allPaid = blInvoices.length > 0 && blInvoices.every(i => i.soldeDuFcfa === 0 || i.statutPaiement === 'PAYE');

        return (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-md animate-fade-in text-zinc-900"
            onClick={overlayClickClose(() => setSelectedBlDetails(null))}
          >
            <div className="bg-white shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col h-full animate-slide-in-right rounded-l-3xl border-l border-zinc-200">
              
              {/* Header Ultra-Moderne & Épuré */}
              <div className="px-6 py-5 bg-white text-zinc-950 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/30 flex items-center justify-center font-bold shadow-xs">
                    <span className="material-symbols-outlined text-2xl">description</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-black text-lg text-[#005DAA] uppercase tracking-wider font-display">
                        Connaissement Maritime (BL)
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-800 font-mono font-bold text-xs">
                        {selectedBlDetails.typeOperation || 'IMPORT'}
                      </span>
                    </div>
                    <p className="text-sm text-[#005DAA] font-mono font-black tracking-wide">
                      N° {selectedBlDetails.numeroBL}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Badge Nature */}
                  {blCat === 'VRAC' ? (
                    <span className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-black text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="material-symbols-outlined text-sm text-amber-600">grain</span>
                      <span>VRAC</span>
                    </span>
                  ) : blCat === 'RORO' ? (
                    <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-black text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="material-symbols-outlined text-sm text-emerald-600">directions_car</span>
                      <span>RORO</span>
                    </span>
                  ) : blCat === 'CONVENTIONNEL' ? (
                    <span className="px-3 py-1 rounded-xl bg-zinc-100 border border-zinc-300 text-zinc-900 font-black text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="material-symbols-outlined text-sm text-zinc-600">inventory_2</span>
                      <span>CONVENTIONNEL</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-xl bg-[#F0F7FF] border border-[#005DAA]/30 text-[#005DAA] font-black text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="material-symbols-outlined text-sm">view_in_ar</span>
                      <span>CONTENEURS ({selectedBlDetails.conteneurs?.length || 0})</span>
                    </span>
                  )}

                  {hasDangerous && (
                    <span className="px-3 py-1 rounded-xl bg-rose-50 border border-rose-300 text-rose-700 font-black text-xs flex items-center gap-1.5 animate-pulse">
                      <span className="material-symbols-outlined text-sm text-rose-600">warning</span>
                      <span>IMDG / DANGEREUX</span>
                    </span>
                  )}

                  <button 
                    onClick={() => setSelectedBlDetails(null)} 
                    className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 flex items-center justify-center cursor-pointer transition-all ml-2 border border-zinc-200"
                    title="Fermer la modal"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs bg-zinc-50/50">
                
                {/* 1. Acteurs & Tiers Maritimes (Shipper, Consignee, Notify) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Chargeur (Shipper) */}
                  <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px] mb-2 pb-1.5 border-b border-zinc-100">
                        <span className="material-symbols-outlined text-sm text-[#005DAA]">business</span>
                        <span>Chargeur (Shipper / Expéditeur)</span>
                      </div>
                      <p className="font-black text-zinc-950 text-sm leading-snug">{selectedBlDetails.shipperNom}</p>
                      <p className="text-zinc-600 text-[11px] mt-1.5 leading-relaxed font-medium">
                        {selectedBlDetails.shipperAdresse || 'Adresse non spécifiée'}
                      </p>
                    </div>
                  </div>

                  {/* Réceptionnaire (Consignee) */}
                  <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px] mb-2 pb-1.5 border-b border-zinc-100">
                        <span className="material-symbols-outlined text-sm text-emerald-600">person_pin</span>
                        <span>Destinataire (Consignee / Réceptionnaire)</span>
                      </div>
                      <p className="font-black text-[#005DAA] text-sm leading-snug">{selectedBlDetails.consigneeNom}</p>
                      <p className="text-zinc-600 text-[11px] mt-1.5 leading-relaxed font-medium">
                        {selectedBlDetails.consigneeAdresse || 'Adresse non spécifiée'}
                      </p>
                    </div>
                  </div>

                  {/* Partie à Notifier (Notify) */}
                  <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px] mb-2 pb-1.5 border-b border-zinc-100">
                        <span className="material-symbols-outlined text-sm text-amber-600">notifications_active</span>
                        <span>Partie à Notifier (Notify Party)</span>
                      </div>
                      <p className="font-black text-zinc-950 text-sm leading-snug">{selectedBlDetails.notifyNom || selectedBlDetails.consigneeNom || 'TO ORDER'}</p>
                      <p className="text-zinc-600 text-[11px] mt-1.5 leading-relaxed font-medium">
                        {selectedBlDetails.notifyAdresse || selectedBlDetails.consigneeAdresse || 'Même adresse que le destinataire'}
                      </p>
                    </div>
                  </div>

                </div>

                {/* 2. Données Escale, Navigation & Marchandises */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  
                  {/* Info Escale & Trajet (5 colonnes) */}
                  <div className="lg:col-span-5 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h4 className="font-bold text-[11px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base text-[#005daa]">directions_boat</span>
                        <span>Escale & Navigation</span>
                      </h4>
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Escale #{selectedBlDetails.escaleId}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-bold text-[9px] uppercase block">Navire</span>
                        <strong className="text-slate-900 font-black text-xs">{matchedEscale?.nomNavire || 'BOCS BREMEN'}</strong>
                        {matchedEscale?.callsign && (
                          <span className="text-[10px] text-slate-500 font-mono block">Call: {matchedEscale.callsign}</span>
                        )}
                      </div>

                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-bold text-[9px] uppercase block">N° Voyage</span>
                        <strong className="text-slate-900 font-mono font-black text-xs">{matchedEscale?.numeroVoyage || '25586'}</strong>
                        <span className="text-[10px] text-slate-500 block">Ligne ALIS</span>
                      </div>

                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-bold text-[9px] uppercase block">Port de Chargement (POL)</span>
                        <strong className="text-slate-900 font-mono font-black text-xs">{selectedBlDetails.portChargementCode}</strong>
                        <span className="text-[10px] text-slate-500 block">
                          {selectedBlDetails.portChargementCode?.includes('ANR') ? 'Anvers (Belgique)' : selectedBlDetails.portChargementCode?.includes('URO') ? 'Rouen (France)' : 'Port d\'origine'}
                        </span>
                      </div>

                      <div className="p-2 bg-blue-50/60 rounded-xl border border-blue-100">
                        <span className="text-blue-600 font-bold text-[9px] uppercase block">Port de Déchargement (POD)</span>
                        <strong className="text-[#005daa] font-mono font-black text-xs">{selectedBlDetails.portDechargementCode}</strong>
                        <span className="text-[10px] text-blue-700 block">Abidjan (Côte d'Ivoire)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] px-2 py-1 bg-slate-50 rounded-lg text-slate-600">
                      <span>Destination finale : <strong>{selectedBlDetails.destinationFinale || 'CI - Côte d\'Ivoire'}</strong></span>
                      <span>Date d'arrivée : <strong className="font-mono">{matchedEscale?.dateArrivee || '15/07/2025'}</strong></span>
                    </div>
                  </div>

                  {/* Métriques & Description Marchandises (7 colonnes) */}
                  <div className="lg:col-span-7 p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h4 className="font-bold text-[11px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base text-emerald-600">inventory_2</span>
                        <span>Spécifications de Cargaison</span>
                      </h4>
                      <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {(selectedBlDetails.poidsBrutKg || 0).toLocaleString('fr-FR')} kg
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 text-[11px]">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-bold text-[9px] uppercase block">Poids Brut Total</span>
                        <strong className="text-slate-900 font-mono font-black text-xs">{(selectedBlDetails.poidsBrutKg || 0).toLocaleString('fr-FR')} kg</strong>
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          ({((selectedBlDetails.poidsBrutKg || 0) / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} T)
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-bold text-[9px] uppercase block">Volume Cubé</span>
                        <strong className="text-slate-900 font-mono font-black text-xs">
                          {selectedBlDetails.volumeM3 > 0 ? `${selectedBlDetails.volumeM3.toLocaleString('fr-FR')} m³` : 'N/C (Poids seul)'}
                        </strong>
                        <span className="text-[10px] text-slate-500 block">Cubage total</span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-bold text-[9px] uppercase block">Colisage / Unités</span>
                        <strong className="text-slate-900 font-black text-xs">
                          {selectedBlDetails.nombreColis} {selectedBlDetails.typeEmballage === 'VRAC' ? 'Vrac' : selectedBlDetails.typeEmballage === 'RORO' ? 'Véhicule(s)' : selectedBlDetails.typeEmballage || 'Colis'}
                        </strong>
                        <span className="text-[10px] text-slate-500 block">{selectedBlDetails.typeEmballage || 'COLIS'}</span>
                      </div>
                    </div>

                    {/* Marques & Numéros */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider block mb-1">Marques & Numéros (Marks & Numbers) / Châssis / Scellés</span>
                      <p className="font-mono font-bold text-slate-800 text-xs select-all">
                        {selectedBlDetails.marquesEtNumeros || 'N/M (Sans repères particuliers)'}
                      </p>
                    </div>

                    {/* Description Goods */}
                    <div className="p-2.5 bg-blue-50/40 rounded-xl border border-blue-100">
                      <span className="text-blue-600 font-bold text-[9px] uppercase tracking-wider block mb-1">Description Déclarée des Marchandises (Manifeste / BESC / DA)</span>
                      <p className="font-medium text-slate-800 text-xs leading-relaxed select-all">
                        {selectedBlDetails.descriptionGoods || 'Marchandises diverses extraites du manifeste cargo.'}
                      </p>
                    </div>
                  </div>

                </div>

                {/* 3. Section Dédiée : Conteneurs ou Spécificités Véhicules/Vrac */}
                {selectedBlDetails.conteneurs && selectedBlDetails.conteneurs.length > 0 ? (
                  <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h4 className="font-bold text-[11px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base text-[#005daa]">grid_view</span>
                        <span>Inventaire des Conteneurs Rattachés ({selectedBlDetails.conteneurs.length})</span>
                      </h4>
                      <span className="text-[10px] font-bold text-slate-500">
                        {selectedBlDetails.conteneurs.filter(c => c.socCoc === 'SOC').length} SOC • {selectedBlDetails.conteneurs.filter(c => c.socCoc === 'COC' || !c.socCoc).length} COC
                      </span>
                    </div>
                    
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-[11px] text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 text-[10px] uppercase">
                            <th className="p-3">N° Conteneur</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Régime</th>
                            <th className="p-3">N° Scellé</th>
                            <th className="p-3 text-right">Poids Net</th>
                            <th className="p-3 text-right">Tare</th>
                            <th className="p-3 text-center">Colis</th>
                            <th className="p-3 text-right">Garantie Caution</th>
                            <th className="p-3 text-center">Statut Parc</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white font-mono">
                          {selectedBlDetails.conteneurs.map((ctn, cIdx) => (
                            <tr key={ctn.id || cIdx} className={`hover:bg-slate-50/70 transition-colors ${ctn.isDangerous ? 'bg-rose-50/30' : ''}`}>
                              <td className="p-3 font-bold text-slate-900">
                                <div className="flex items-center gap-1.5">
                                  <span>{ctn.numeroConteneur}</span>
                                  {ctn.isDangerous && (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-black uppercase flex items-center gap-0.5 animate-pulse" title="Marchandises Dangereuses IMDG">
                                      <span className="material-symbols-outlined text-[10px]">warning</span>
                                      <span>DANG.</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 font-semibold text-slate-700">{ctn.typeConteneur}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  ctn.socCoc === 'SOC' 
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                                    : 'bg-sky-50 text-sky-700 border border-sky-200'
                                }`}>
                                  {ctn.socCoc || 'COC'}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600">{ctn.numeroScelle || 'SANS SCELLÉ'}</td>
                              <td className="p-3 text-right font-bold text-slate-900">{(ctn.poidsKg || 0).toLocaleString('fr-FR')} kg</td>
                              <td className="p-3 text-right text-slate-500">{(ctn.tareKg || 0).toLocaleString('fr-FR')} kg</td>
                              <td className="p-3 text-center text-slate-700 font-sans">{ctn.nombreColis || 0}</td>
                              <td className="p-3 text-right font-bold text-slate-800">
                                {(ctn.montantCautionFcfa || 0).toLocaleString('fr-FR')} FCFA
                              </td>
                              <td className="p-3 text-center font-sans">
                                <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#005daa] text-[10px] font-bold">
                                  {ctn.statutLivraison === 'AU_PARC' ? 'Au Parc' : ctn.statutLivraison === 'LIVRE' ? 'Livré' : 'Au Parc'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : blCat === 'RORO' ? (
                  <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-emerald-800 font-bold">
                      <span className="material-symbols-outlined text-lg">directions_car</span>
                      <span className="uppercase text-xs tracking-wider font-heading">Fiche Véhicule RORO Intégrée</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">Numéro de Châssis (VIN)</span>
                        <strong className="font-mono text-slate-900 font-black text-sm">{selectedBlDetails.marquesEtNumeros || 'N/C'}</strong>
                      </div>
                      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">Désignation Véhicule</span>
                        <strong className="text-slate-900 font-bold text-xs">{selectedBlDetails.descriptionGoods}</strong>
                      </div>
                      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">Volume & Poids RORO</span>
                        <strong className="font-mono text-emerald-900 font-black text-xs">
                          {selectedBlDetails.volumeM3} m³ • {(selectedBlDetails.poidsBrutKg || 0).toLocaleString('fr-FR')} kg
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-700 font-bold">
                      <span className="material-symbols-outlined text-lg text-amber-600">grain</span>
                      <span className="uppercase text-xs tracking-wider font-heading">Marchandise Conventionnelle / Vrac</span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Ce connaissement porte sur du <strong>{blCat === 'VRAC' ? 'Vrac Solide / Liquide' : 'Conventionnel (Breakbulk)'}</strong> non conteneurisé. 
                      Poids net contrôlé : <strong>{(selectedBlDetails.poidsBrutKg || 0).toLocaleString('fr-FR')} kg</strong>.
                    </p>
                  </div>
                )}

                {/* 4. Historique des Factures Émises pour ce BL */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  {(() => {
                    const plannedIds = plannedInvoicesByBl[selectedBlDetails.id] || [];
                    const plannedConfigs = invoiceTypeConfigs.filter(t => plannedIds.includes(t.id));
                    const pendingConfigs = plannedConfigs.filter(t => 
                      !blInvoices.some(inv => 
                        inv.invoiceTypeId === t.id || 
                        inv.typeFacture.toLowerCase().includes(t.name.toLowerCase())
                      )
                    );
                    return (
                      <>
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-[11px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-base text-[#005daa]">receipt_long</span>
                              <span>Factures Associées à ce BL ({blInvoices.length + pendingConfigs.length})</span>
                            </h4>
                            <button
                              onClick={() => handleOpenInvoiceSelection(selectedBlDetails)}
                              className="p-1 text-slate-400 hover:text-[#005daa] hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                              title="Modifier la sélection des factures pour ce BL"
                            >
                              <span className="material-symbols-outlined text-base">settings</span>
                            </button>
                          </div>
                          {allPaid && pendingConfigs.length === 0 ? (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              <span>Facturé & Réglé</span>
                            </span>
                          ) : blInvoices.length > 0 || pendingConfigs.length > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-100 border border-amber-300 text-amber-800 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">pending</span>
                              <span>En cours</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Aucune facture émise pour le moment</span>
                          )}
                        </div>

                        {blInvoices.length > 0 || pendingConfigs.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2 pt-2">
                            {blInvoices.map(inv => {
                              const isPaid = inv.statutPaiement === 'PAYE' || inv.soldeDuFcfa === 0;
                              return (
                                <button
                                  key={inv.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    generateProformaPdf(inv, selectedBlDetails, 'Agence BOCS Abidjan');
                                  }}
                                  className={`px-3 py-1.5 text-[11px] font-bold rounded flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer ${
                                    isPaid 
                                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                                      : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300'
                                  }`}
                                  title={`Voir la facture ${inv.numeroFacture || ''} (${isPaid ? 'Réglée' : 'En attente de paiement'})`}
                                >
                                  <span className="material-symbols-outlined text-[13px]">receipt_long</span>
                                  {invoiceTypeConfigs.find(t => t.id === inv.invoiceTypeId)?.name || inv.typeFacture}
                                </button>
                              );
                            })}
                            {pendingConfigs.map(config => (
                              <button
                                key={config.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateProformaForType(selectedBlDetails, config);
                                }}
                                className="px-3 py-1.5 bg-[#1762a3] hover:bg-blue-800 text-white text-[11px] font-bold rounded flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                                title={`Éditer la Proforma PDF pour ${config.name}`}
                              >
                                <span className="material-symbols-outlined text-[13px]">description</span>
                                {config.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center bg-slate-50 rounded-xl text-slate-400 italic text-xs">
                            Cliquez sur l'icône de paramètre pour sélectionner les factures de ce BL.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

              </div>

              {/* Footer avec Actions Rapides */}
              <div className="p-4 sm:px-6 sm:py-4 bg-white border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-zinc-500 text-xs font-medium">
                  BL <strong className="font-mono text-[#005DAA]">{selectedBlDetails.numeroBL}</strong> • Escale <strong className="font-mono text-zinc-900">{matchedEscale?.numeroVoyage || '25586'}</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedBlDetails(null)}
                    className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-extrabold rounded-xl transition-all cursor-pointer text-xs border border-zinc-200"
                  >
                    Fermer
                  </button>

                  {allPaid && (
                    <button
                      onClick={() => {
                        const target = selectedBlDetails;
                        setSelectedBlDetails(null);
                        generateDoBadPdf(target, matchedEscale);
                      }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer text-xs active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">verified</span>
                      <span>Imprimer DO / BAD</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      const target = selectedBlDetails;
                      setSelectedBlDetails(null);
                      if (target) {
                        handleOpenInvoiceSelection(target);
                      }
                    }}
                    className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white font-black rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer text-xs active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">fact_check</span>
                    <span>Planifier / Facturer ce BL</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Modal Create Escale */}
      {showAddEscaleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={overlayClickClose(() => setShowAddEscaleModal(false))}
        >
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-black text-lg text-[#005DAA] font-display">Créer une Escale Manuelle</h3>
              <button onClick={() => setShowAddEscaleModal(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateEscaleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">Nom du Navire</label>
                <input
                  type="text"
                  required
                  value={nomNavire}
                  onChange={e => setNomNavire(e.target.value)}
                  placeholder="ex: BOCS BREMEN"
                  className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">Callsign</label>
                  <input
                    type="text"
                    value={callsign}
                    onChange={e => setCallsign(e.target.value)}
                    placeholder="CS-9021"
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">N° Voyage</label>
                  <input
                    type="text"
                    required
                    value={numeroVoyage}
                    onChange={e => setNumeroVoyage(e.target.value)}
                    placeholder="VOY-2026-09"
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEscaleModal(false)}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-zinc-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white font-black rounded-xl text-xs shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Coller du texte XML GUCE */}
      {showPasteXmlModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={overlayClickClose(() => setShowPasteXmlModal(false))}
        >
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 border border-zinc-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005DAA]">code</span>
                <h3 className="font-black text-base text-[#005DAA] font-display">Coller un texte XML GUCE Import</h3>
              </div>
              <button onClick={() => setShowPasteXmlModal(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-zinc-600">
              Collez ci-dessous le contenu brut XML du manifeste GUCE d'Abidjan. Le système créera automatiquement l'Escale du navire et extraira l'ensemble des lettres de voiture (BLs) et conteneurs associés.
            </p>

            <textarea
              value={pastedXmlText}
              onChange={(e) => setPastedXmlText(e.target.value)}
              placeholder="<manifest> <manifest_general_segment> ... </manifest_general_segment> </manifest>"
              className="w-full h-64 p-3 bg-zinc-950 text-emerald-400 font-mono text-xs rounded-xl border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#005DAA]"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPasteXmlModal(false)}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition-all cursor-pointer border border-zinc-200"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!pastedXmlText.trim() || isProcessingXml}
                onClick={() => processXmlContent(pastedXmlText, 'Pasted_GUCE_Manifest.xml')}
                className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">download_done</span>
                <span>Traiter et Extraire le Manifeste</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmation de Suppression d'Intégration XML / Escale */}
      {escaleToDelete && (() => {
        const relatedBls = bls.filter(b => b.escaleId === escaleToDelete.id);
        const relatedBlIds = relatedBls.map(b => b.id);
        const relatedBlNumbers = relatedBls.map(b => b.numeroBL);

        const relatedContainersCount = relatedBls.reduce((acc, b) => acc + (b.conteneurs?.length || 0), 0);
        const relatedInvoices = invoices.filter(inv => 
          (inv.blId !== undefined && relatedBlIds.includes(inv.blId)) || 
          (inv.numeroBL !== undefined && relatedBlNumbers.includes(inv.numeroBL))
        );

        return (
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={overlayClickClose(() => setEscaleToDelete(null))}
          >
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-rose-200 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shadow-2xs">
                  <span className="material-symbols-outlined text-2xl">warning</span>
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 font-heading">Suppression de l'Escale / Intégration XML</h3>
                  <p className="text-[11px] text-rose-600 font-bold uppercase tracking-wider">Avertissement critique & Action irréversible</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <p className="font-semibold text-slate-800">
                  Vous êtes sur le point de supprimer l'escale du navire <span className="font-bold text-slate-900 underline">{escaleToDelete.nomNavire}</span> (Voyage <span className="font-mono font-bold text-blue-600">{escaleToDelete.numeroVoyage}</span>).
                </p>

                {/* Détail des impacts */}
                <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3.5 space-y-2">
                  <div className="text-[11px] font-black uppercase text-rose-900 tracking-wider flex items-center gap-1.5 font-heading">
                    <span className="material-symbols-outlined text-sm text-rose-600">inventory_2</span>
                    <span>Bilan des éléments qui seront définitivement effacés :</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200/60 flex items-center justify-between shadow-2xs">
                      <span className="text-slate-600 text-[11px] font-sans font-medium">Connaissements (BLs) :</span>
                      <span className="font-bold text-rose-700 text-sm">{relatedBls.length}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200/60 flex items-center justify-between shadow-2xs">
                      <span className="text-slate-600 text-[11px] font-sans font-medium">Conteneurs / Colis :</span>
                      <span className="font-bold text-rose-700 text-sm">{relatedContainersCount}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200/60 flex items-center justify-between shadow-2xs text-left col-span-2">
                      <span className="text-slate-600 text-[11px] font-sans font-medium">Factures proforma/définitives :</span>
                      <span className="font-bold text-rose-700 text-sm">{relatedInvoices.length}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-amber-600">info</span>
                    <span>Implications de cette action :</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 font-sans">
                    <li>Retrait immédiat de l'escale et de tous ses connaissements du module Import.</li>
                    <li>Purge de toutes les factures et règlements associés en base de données.</li>
                    <li>Journalisation automatique de la suppression dans l'audit de sécurité.</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEscaleToDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteEscaleIntegration) {
                      onDeleteEscaleIntegration(escaleToDelete.id);
                    }
                    setEscaleToDelete(null);
                    setSelectedEscaleId('ALL');
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">delete_forever</span>
                  <span>Confirmer la Suppression Définitive</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Modal: Sélection des Types de Factures à Émettre pour le BL */}
      {blForInvoiceSelection && (() => {
        const blCat = getBlCategory(blForInvoiceSelection);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
            onClick={overlayClickClose(() => setBlForInvoiceSelection(null))}
          >
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
              
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/20 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">fact_check</span>
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-zinc-950 uppercase tracking-wider font-display">
                      Types de Factures à Émettre
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      BL <strong className="font-mono text-[#005DAA]">{blForInvoiceSelection.numeroBL}</strong> • Marchandise : <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-800 font-bold">{blCat}</span>
                    </p>
                  </div>
                </div>
                <button onClick={() => setBlForInvoiceSelection(null)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-600 font-medium">
                  Cochez les factures que vous souhaitez émettre pour ce BL. Chaque type coché apparaîtra sous forme de bouton sur la ligne du BL :
                </p>

                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {invoiceTypeConfigs
                    .filter(typeConfig => {
                      const n = (typeConfig.name || '').toLowerCase();
                      const isSurestarie = n.includes('surestarie') || n.includes('suréstarie');
                      const isDetention = n.includes('detention') || n.includes('détention');
                      return !isSurestarie && !isDetention;
                    })
                    .map(typeConfig => {
                    const matchingInv = invoices.find(inv => 
                      (inv.blId === blForInvoiceSelection.id || inv.numeroBL === blForInvoiceSelection.numeroBL) &&
                      (inv.invoiceTypeId === typeConfig.id || 
                       inv.typeFacture.toLowerCase().includes(typeConfig.name.toLowerCase())) &&
                      inv.statutFacture !== 'ANNULEE'
                    );
                    const isAlreadyPaid = matchingInv ? (matchingInv.soldeDuFcfa === 0 || matchingInv.statutPaiement === 'PAYE') : false;
                    const isDangerousBl = blForInvoiceSelection.conteneurs?.some(c => c.isDangerous) || false;
                    const isCautionType = typeConfig.id === '1' || typeConfig.name.toLowerCase().includes('caution');
                    const isTransfertType = typeConfig.id === '4' || typeConfig.name.toLowerCase().includes('transfert');
                    const isSurestarieType = typeConfig.name.toLowerCase().includes('surestarie');
                    const isDetentionImportType = typeConfig.name.toLowerCase().includes('détention import') || typeConfig.name.toLowerCase().includes('detention import');
                    const isDetentionExportType = typeConfig.name.toLowerCase().includes('détention export') || typeConfig.name.toLowerCase().includes('detention export');
                    const isDetentionType = typeConfig.name.toLowerCase().includes('detention') || typeConfig.name.toLowerCase().includes('détention');
                    const isSurestarieOrDetentionType = isSurestarieType || isDetentionType;

                    let isDisabled = false;
                    let disableReason = '';

                    const blOpType = (blForInvoiceSelection.typeOperation || 'IMPORT').toUpperCase();

                    if (isCautionType && blCat !== 'CONTENEUR') {
                      isDisabled = true;
                      disableReason = "La facture de Caution ne concerne que le type CONTENEUR.";
                    } else if (isTransfertType && (blCat !== 'CONTENEUR' || isDangerousBl)) {
                      isDisabled = true;
                      disableReason = blCat !== 'CONTENEUR' 
                        ? "La facture de Transfert ne concerne que le type CONTENEUR."
                        : "La facture de Transfert est exclue pour les conteneurs DANGEREUX.";
                    } else if (isSurestarieType && blCat !== 'CONTENEUR') {
                      isDisabled = true;
                      disableReason = "La facture de Surestaries ne concerne que le type CONTENEUR.";
                    } else if (isDetentionImportType && blCat !== 'CONTENEUR') {
                      isDisabled = true;
                      disableReason = "La facture de Détention Import ne concerne que le type CONTENEUR.";
                    } else if (isDetentionImportType && blOpType === 'EXPORT') {
                      isDisabled = true;
                      disableReason = "La Détention Import ne s'applique pas aux opérations d'EXPORT.";
                    } else if (isDetentionExportType && blCat !== 'CONTENEUR') {
                      isDisabled = true;
                      disableReason = "La facture de Détention Export ne concerne que le type CONTENEUR.";
                    } else if (isDetentionExportType && blOpType === 'IMPORT') {
                      isDisabled = true;
                      disableReason = "La Détention Export ne s'applique pas aux opérations d'IMPORT.";
                    } else if (isDetentionType && blCat !== 'CONTENEUR') {
                      isDisabled = true;
                      disableReason = `La facture de ${typeConfig.name} ne concerne que le type CONTENEUR.`;
                    }

                    const isEchangeType = typeConfig.id === '2' || typeConfig.name.toLowerCase().includes('echange');
                    const hasSocCtns = blForInvoiceSelection.conteneurs?.some(c => c.socCoc === 'SOC') || false;
                    const hasCocCtns = blForInvoiceSelection.conteneurs?.some(c => c.socCoc === 'COC' || !c.socCoc) || false;

                    let dynamicTypeName = typeConfig.name;
                    if (isEchangeType && blCat === 'CONTENEUR') {
                      if (hasSocCtns && !hasCocCtns) dynamicTypeName = 'Échange Conteneurs (SOC)';
                      else if (hasCocCtns && !hasSocCtns) dynamicTypeName = 'Échange Conteneurs (COC)';
                      else dynamicTypeName = 'Échange Conteneurs (SOC / COC)';
                    }

                    const socContainers = (blForInvoiceSelection.conteneurs || []).filter(c => c.socCoc === 'SOC');
                    const cocContainers = (blForInvoiceSelection.conteneurs || []).filter(c => c.socCoc === 'COC' || !c.socCoc);

                    const blCargoCategories = getBlCargoCategories(blForInvoiceSelection);
                    const matchingRubriques = rubriqueConfigs.filter(r => {
                      if (r.invoiceTypeId !== typeConfig.id || !r.isActive) return false;
                      if (isEchangeType) {
                        const isContainerRub = r.category === 'CONTENEUR' || r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR_SOC';
                        if (isContainerRub) {
                          if (!blCargoCategories.includes('CONTENEUR')) return false;
                          if (hasSocCtns && !hasCocCtns) return r.category === 'CONTENEUR_SOC';
                          if (hasCocCtns && !hasSocCtns) return r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR';
                          return r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR_SOC' || r.category === 'CONTENEUR';
                        }
                        return blCargoCategories.includes(r.category as FretCategory);
                      }
                      return r.category === blCat;
                    });

                    const estimatedHt = matchingRubriques.reduce((sum, r) => {
                      let q = 1;
                      const isSocRub = r.category === 'CONTENEUR_SOC' || r.name.toUpperCase().includes('SOC') || r.code.toUpperCase().includes('SOC');
                      const isCocRub = r.category === 'CONTENEUR_COC' || r.name.toUpperCase().includes('COC') || r.code.toUpperCase().includes('COC');
                      
                      if (isSocRub && !hasSocCtns) {
                        q = 0;
                      } else if (isCocRub && !hasCocCtns) {
                        q = 0;
                      } else {
                        if (r.baseCalcul === 'TEU') {
                          const targetCtns = isSocRub ? socContainers : (isCocRub ? cocContainers : (blForInvoiceSelection.conteneurs || []));
                          q = targetCtns.reduce((sum, c) => sum + (c.typeConteneur.includes('40') ? 2 : 1), 0);
                          if (q === 0) q = 1;
                        } else if (r.baseCalcul === 'CONTENEUR') {
                          if (isSocRub) q = socContainers.length;
                          else if (isCocRub) q = cocContainers.length;
                          else q = blForInvoiceSelection.conteneurs?.length || 1;
                        } else if (r.baseCalcul === 'POIDS_TONNE') {
                          q = blForInvoiceSelection.poidsBrutKg ? Math.round((blForInvoiceSelection.poidsBrutKg / 1000) * 100) / 100 : 1;
                        }
                      }
                      return sum + Math.round(q * r.montantUnitaire);
                    }, 0);

                    if (isAlreadyPaid) {
                      return (
                        <div
                          key={typeConfig.id}
                          className="flex items-start gap-3.5 p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/50 shadow-2xs select-none cursor-default"
                        >
                          <span className="material-symbols-outlined text-emerald-600 text-lg mt-0.5 shrink-0">task_alt</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs font-heading">
                                  {dynamicTypeName}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase border border-emerald-500 text-emerald-700 flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[10px]">check_circle</span>
                                  <span>Facturé & Réglé</span>
                                </span>
                              </div>
                              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                                {matchingInv?.numeroFacture}
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800/90 mt-1 font-medium">
                              Cette facture a déjà été émise et soldée ({(matchingInv?.montantTtcFcfa || 0).toLocaleString('fr-FR')} FCFA TTC). Elle est définitivement verrouillée.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (isDisabled) {
                      return (
                        <div
                          key={typeConfig.id}
                          className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-200 bg-slate-100/60 shadow-2xs select-none opacity-60 cursor-not-allowed"
                          title={disableReason}
                        >
                          <span className="material-symbols-outlined text-slate-400 text-lg mt-0.5 shrink-0">block</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-500 text-xs font-heading">
                                {typeConfig.name}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase border border-slate-300 text-slate-500">
                                Non Applicable
                              </span>
                            </div>
                            <p className="text-[11px] text-amber-700/90 mt-1 font-medium italic">
                              {disableReason}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const calcKey = `${blForInvoiceSelection.id}-${typeConfig.id}`;
                    const isCalcValidated = validatedCalculations[calcKey] !== undefined;

                    // Les surestaries et détentions ne sont JAMAIS cochées par défaut : seulement si déjà réglées OU calculées
                    const isChecked = isAlreadyPaid || (
                      selectedTypeIdsForBl.includes(typeConfig.id) && (!isSurestarieOrDetentionType || isCalcValidated)
                    );
                    const isUncalculatedDmdt = isSurestarieOrDetentionType && !isCalcValidated && !isAlreadyPaid;

                    return (
                      <div
                        key={typeConfig.id}
                        onClick={(e) => {
                          if (isAlreadyPaid) return;
                          
                          if (isUncalculatedDmdt) {
                            e.preventDefault();
                            e.stopPropagation();
                            setCalculationModalData({ bl: blForInvoiceSelection, typeConfig });
                            return;
                          }
                          
                          if (isChecked) {
                            setSelectedTypeIdsForBl(prev => prev.filter(id => id !== typeConfig.id));
                            if (isSurestarieOrDetentionType && isCalcValidated) {
                              setValidatedCalculations(prev => {
                                const copy = { ...prev };
                                delete copy[calcKey];
                                return copy;
                              });
                            }
                          } else {
                            setSelectedTypeIdsForBl(prev => [...prev, typeConfig.id]);
                          }
                        }}
                        className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all select-none ${
                          isChecked
                            ? 'bg-blue-50/60 border-[#005daa] shadow-xs cursor-pointer'
                            : isUncalculatedDmdt
                            ? 'bg-slate-50/80 border-slate-200 hover:border-slate-300 cursor-pointer'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isUncalculatedDmdt}
                          onChange={() => {}}
                          className="w-4 h-4 mt-0.5 text-[#005daa] rounded focus:ring-[#005daa] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs font-heading">
                                {dynamicTypeName}
                              </span>
                              {isSurestarieOrDetentionType && !isAlreadyPaid && (
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-0.5 ${
                                  isCalcValidated
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                    : 'bg-rose-50 text-rose-700 border border-rose-300'
                                }`}>
                                  <span className="material-symbols-outlined text-[9px]">{isCalcValidated ? 'task_alt' : 'lock'}</span>
                                  <span>{isCalcValidated ? 'Prêt' : 'Calcul requis'}</span>
                                </span>
                              )}
                            </div>
                            
                            {isSurestarieOrDetentionType && !isAlreadyPaid && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCalculationModalData({ bl: blForInvoiceSelection, typeConfig });
                                }}
                                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer ${
                                  isCalcValidated
                                    ? 'bg-emerald-100 border border-emerald-300 text-emerald-800 hover:bg-emerald-200'
                                    : 'bg-[#00182f] text-white hover:bg-blue-600'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px]">{isCalcValidated ? 'edit' : 'calculate'}</span>
                                <span>{isCalcValidated ? 'Modifier' : 'Calculer'}</span>
                              </button>
                            )}

                            {estimatedHt > 0 && !isSurestarieOrDetentionType && (
                              <span className="text-xs font-mono font-black text-[#005daa]">
                                ~{estimatedHt.toLocaleString('fr-FR')} FCFA
                              </span>
                            )}
                            {isSurestarieOrDetentionType && isCalcValidated && !isAlreadyPaid && (
                              <span className="text-xs font-mono font-black text-emerald-600">
                                {validatedCalculations[calcKey].total.toLocaleString('fr-FR')} FCFA
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {typeConfig.description || 'Frais et rubriques applicables'}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {isSurestarieOrDetentionType ? (
                              <span className="text-[10px] text-slate-400 italic">
                                Grille tarifaire dynamique des conteneurs
                              </span>
                            ) : matchingRubriques.length > 0 ? (
                              matchingRubriques.map(r => (
                                <span key={r.id} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-700 font-semibold">
                                  {r.name} ({r.montantUnitaire.toLocaleString('fr-FR')} FCFA/{r.baseCalcul})
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Frais standard par défaut pour {blCat}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Estimation financière globale en temps réel (Phase 4) */}
              {(() => {
                let totalEstimatedHt = 0;
                selectedTypeIdsForBl.forEach(typeId => {
                  const typeCfg = invoiceTypeConfigs.find(t => t.id === typeId);
                  if (!typeCfg) return;
                  const isSurestarieOrDet = typeCfg.name.toLowerCase().includes('surestarie') || typeCfg.name.toLowerCase().includes('detention') || typeCfg.name.toLowerCase().includes('détention');
                  const calcK = `${blForInvoiceSelection.id}-${typeId}`;
                  if (isSurestarieOrDet && validatedCalculations[calcK]) {
                    totalEstimatedHt += validatedCalculations[calcK].total;
                  } else if (!isSurestarieOrDet) {
                    const blCat = getBlCategory(blForInvoiceSelection);
                    const blCargoCategories = getBlCargoCategories(blForInvoiceSelection);
                    const isEchangeType = typeCfg.id === '2' || typeCfg.name.toLowerCase().includes('echange');
                    const socContainers = (blForInvoiceSelection.conteneurs || []).filter(c => c.socCoc === 'SOC');
                    const cocContainers = (blForInvoiceSelection.conteneurs || []).filter(c => c.socCoc === 'COC' || !c.socCoc);

                    const matchingRubriques = rubriqueConfigs.filter(r => {
                      if (r.invoiceTypeId !== typeId || !r.isActive) return false;
                      if (isEchangeType) {
                        const isContainerRub = r.category === 'CONTENEUR' || r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR_SOC';
                        if (isContainerRub) {
                          if (!blCargoCategories.includes('CONTENEUR')) return false;
                          if (socContainers.length > 0 && cocContainers.length === 0) return r.category === 'CONTENEUR_SOC';
                          if (cocContainers.length > 0 && socContainers.length === 0) return r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR';
                          return r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR_SOC' || r.category === 'CONTENEUR';
                        }
                        return blCargoCategories.includes(r.category as FretCategory);
                      }
                      return r.category === blCat;
                    });

                    matchingRubriques.forEach(r => {
                      let qty = 1;
                      const base = r.baseCalcul as string;
                      const isSocRub = r.category === 'CONTENEUR_SOC' || r.name.toUpperCase().includes('SOC') || r.code.toUpperCase().includes('SOC');
                      const isCocRub = r.category === 'CONTENEUR_COC' || r.name.toUpperCase().includes('COC') || r.code.toUpperCase().includes('COC');
                      
                      if (isSocRub && socContainers.length === 0) {
                        qty = 0;
                      } else if (isCocRub && cocContainers.length === 0) {
                        qty = 0;
                      } else {
                        if (base === 'BL') qty = 1;
                        else if (base === 'CONTENEUR_20') qty = (blForInvoiceSelection.conteneurs || []).filter(c => c.typeConteneur && c.typeConteneur.startsWith('20')).length;
                        else if (base === 'CONTENEUR_40') qty = (blForInvoiceSelection.conteneurs || []).filter(c => c.typeConteneur && c.typeConteneur.startsWith('40')).length;
                        else if (base === 'CONTENEUR') {
                          if (isSocRub) qty = socContainers.length;
                          else if (isCocRub) qty = cocContainers.length;
                          else qty = (blForInvoiceSelection.conteneurs || []).length;
                        }
                        else if (base === 'POIDS_TONNE' || base === 'TONNE') qty = Math.ceil((blForInvoiceSelection.poidsBrutKg || 0) / 1000);
                        else if (base === 'TEU') {
                          const targetCtns = isSocRub ? socContainers : (isCocRub ? cocContainers : (blForInvoiceSelection.conteneurs || []));
                          const c20 = targetCtns.filter(c => c.typeConteneur && c.typeConteneur.startsWith('20')).length;
                          const c40 = targetCtns.filter(c => c.typeConteneur && c.typeConteneur.startsWith('40')).length;
                          qty = c20 + c40 * 2;
                        }
                        else if (base === 'M3') qty = Math.ceil(blForInvoiceSelection.volumeM3 || 0);
                        else if (base === 'COLIS') qty = blForInvoiceSelection.nombreColis || 1;
                        else qty = 1;
                      }

                      totalEstimatedHt += qty * r.montantUnitaire;
                    });
                  }
                });

                const totalTva = Math.round(totalEstimatedHt * 0.18);
                const totalTtc = totalEstimatedHt + totalTva;

                return totalEstimatedHt > 0 ? (
                  <div className="bg-[#F0F7FF] border border-[#005DAA]/30 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#005DAA] text-xl">calculate</span>
                      <div>
                        <span className="text-xs font-bold text-zinc-950">Estimation Financière Prévisionnelle</span>
                        <p className="text-[10px] text-zinc-500">Montant total pour les {selectedTypeIdsForBl.length} facture(s) sélectionnée(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Total HT :</span>
                        <span className="font-bold text-zinc-950">{totalEstimatedHt.toLocaleString('fr-FR')} FCFA</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">TVA (18%) :</span>
                        <span className="font-bold text-zinc-950">{totalTva.toLocaleString('fr-FR')} FCFA</span>
                      </div>
                      <div className="pl-3 border-l border-[#005DAA]/20">
                        <span className="text-[10px] text-[#005DAA] font-black block">TOTAL TTC :</span>
                        <span className="font-black text-sm text-[#005DAA]">{totalTtc.toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                <span className="text-xs font-bold text-zinc-600">
                  {selectedTypeIdsForBl.length} type(s) de facture sélectionné(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBlForInvoiceSelection(null)}
                    className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition-all cursor-pointer border border-zinc-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmInvoiceSelection}
                    className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">check</span>
                    <span>Valider la Sélection</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Modal: Ajouter un Connaissement (BL) Manuel */}
      {showAddBlModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          onClick={overlayClickClose(() => setShowAddBlModal(false))}
        >
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto bocs-scrollbar">
            
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/20 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-2xl">post_add</span>
                </div>
                <div>
                  <h3 className="font-black text-base text-[#005DAA] font-display">
                    Nouveau Connaissement (BL) Manuel
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    Saisissez les informations de la lettre de voiture maritime à ajouter à l'import.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAddBlModal(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateBlSubmit} className="space-y-4 text-xs">
              
              {/* Escale & Numéro BL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">Escale du Navire *</label>
                  <select
                    value={manualEscaleId}
                    onChange={e => setManualEscaleId(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                  >
                    {escales.map(esc => (
                      <option key={esc.id} value={esc.id}>
                        {esc.nomNavire} (Voyage {esc.numeroVoyage})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">Numéro BL *</label>
                  <input
                    type="text"
                    required
                    value={manualNumeroBl}
                    onChange={e => setManualNumeroBl(e.target.value)}
                    placeholder="ex: 00LU4055069990"
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-black text-[#005DAA] uppercase focus:outline-none focus:border-[#005DAA]"
                  />
                </div>
              </div>

              {/* Expéditeur & Destinataire */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">Expéditeur (Shipper)</label>
                  <input
                    type="text"
                    value={manualShipperNom}
                    onChange={e => setManualShipperNom(e.target.value)}
                    placeholder="ex: LA COMPAGNIE DES CAOUTCHOUCS..."
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">Destinataire (Consignee)</label>
                  <input
                    type="text"
                    value={manualConsigneeNom}
                    onChange={e => setManualConsigneeNom(e.target.value)}
                    placeholder="ex: TO ORDER / DESTINATAIRE SA"
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                  />
                </div>
              </div>

              {/* Description & Type emballage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">Description Marchandises</label>
                  <input
                    type="text"
                    value={manualDescriptionGoods}
                    onChange={e => setManualDescriptionGoods(e.target.value)}
                    placeholder="ex: RUBBER IN BALES / CAOUTCHOUC"
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">Type d'Emballage</label>
                  <select
                    value={manualTypeEmballage}
                    onChange={e => setManualTypeEmballage(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                  >
                    <option value="COLIS">COLIS / CARTONS / SACS</option>
                    <option value="CONTENEUR">CONTENEUR</option>
                    <option value="VRAC">VRAC CONVENTIONNEL</option>
                    <option value="RORO">RORO / VÉHICULE</option>
                  </select>
                </div>
              </div>

              {/* Poids, Colis, Volume */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">Poids Brut (Kg)</label>
                  <input
                    type="number"
                    value={manualPoidsBrutKg}
                    onChange={e => setManualPoidsBrutKg(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="25000"
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">Nbr de Colis</label>
                  <input
                    type="number"
                    value={manualNombreColis}
                    onChange={e => setManualNombreColis(e.target.value ? parseInt(e.target.value, 10) : '')}
                    placeholder="500"
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 uppercase text-[11px] mb-1">Volume (m³)</label>
                  <input
                    type="number"
                    value={manualVolumeM3}
                    onChange={e => setManualVolumeM3(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="0"
                    className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                  />
                </div>
              </div>

              {/* Conteneurs associés */}
              <div className="p-3.5 bg-[#F0F7FF] border border-[#005DAA]/20 rounded-xl space-y-2">
                <div className="text-[11px] font-black uppercase text-zinc-950 tracking-wider flex items-center gap-1.5 font-display">
                  <span className="material-symbols-outlined text-sm text-[#005DAA]">inventory_2</span>
                  <span>Génération Automatique de Conteneurs Rattachés :</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 mb-1">Conteneurs 20' (20' DRY Standard)</label>
                    <input
                      type="number"
                      min="0"
                      value={manualCount20}
                      onChange={e => setManualCount20(parseInt(e.target.value, 10) || 0)}
                      className="w-full h-10 px-3 bg-white border border-[#005DAA]/30 rounded-xl text-xs font-mono font-bold text-[#005DAA] focus:outline-none focus:border-[#005DAA]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 mb-1">Conteneurs 40' (40' DRY / High Cube)</label>
                    <input
                      type="number"
                      min="0"
                      value={manualCount40}
                      onChange={e => setManualCount40(parseInt(e.target.value, 10) || 0)}
                      className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddBlModal(false)}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition-all cursor-pointer border border-zinc-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>Créer le BL Manuel</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Calculateur Modal */}
      {calculationModalData && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={overlayClickClose(() => setCalculationModalData(null))}
        >
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="p-4 bg-white border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/20 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">calculate</span>
                </div>
                <div>
                  <h3 className="font-bold text-zinc-950 text-sm font-display uppercase tracking-wider">
                    Calculateur de {calculationModalData.typeConfig.name}
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-semibold font-mono">
                    BL : <span className="text-[#005DAA] font-bold">{calculationModalData.bl.numeroBL}</span> • {calculationModalData.bl.consigneeNom}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setCalculationModalData(null)}
                className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              
              {!calculationModalData.bl.conteneurs || calculationModalData.bl.conteneurs.length === 0 ? (
                <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold text-xs flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-3xl">warning</span>
                  <span>Ce BL ne contient aucun conteneur. Les surestaries et détentions ne s'appliquent qu'aux conteneurs.</span>
                  <p className="text-[10px] text-rose-700 font-medium">Veuillez d'abord déclarer des conteneurs pour ce BL.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  <div className="px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 font-medium">
                    Formule de calcul : <strong>[(Date livraison - Date accostage) - Franchise] x Tarif de la tranche correspondante</strong>. Les franchises restent toujours actives et modifiables.
                  </div>

                  <div className="overflow-x-auto border border-slate-150 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr className="font-bold border-b border-slate-200 uppercase text-[10px]">
                          <th className="p-3">Conteneur</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Date Accostage</th>
                          <th className="p-3">Date Livraison</th>
                          <th className="p-3">Franchise (j)</th>
                          <th className="p-3 text-center">Séjour (j)</th>
                          <th className="p-3 text-center">Facturable (j)</th>
                          <th className="p-3 text-right">Montant HT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 bg-white">
                        {modalRows.map((row, idx) => {
                          const dateAcc = new Date(row.dateAccostage);
                          const dateLiv = new Date(row.dateLivraison);
                          const stayTime = dateLiv.getTime() - dateAcc.getTime();
                          const stayDays = isNaN(stayTime) ? 0 : Math.max(0, Math.ceil(stayTime / (1000 * 60 * 60 * 24)));
                          const billableDays = Math.max(0, stayDays - row.franchise);
                          const calcResult = calculateDegressiveAmount(row.typeConteneur, stayDays, row.franchise, row.dateAccostage);
                          const montant = calcResult.totalAmount;

                          return (
                            <React.Fragment key={row.containerId || idx}>
                            <tr className="hover:bg-slate-50/50">
                              <td className="p-3 font-semibold text-slate-800 font-mono">
                                {row.numeroConteneur}
                              </td>
                              <td className="p-3 text-slate-500 font-mono font-bold">
                                {row.typeConteneur}
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={row.dateAccostage}
                                  onChange={e => {
                                    const updated = [...modalRows];
                                    updated[idx].dateAccostage = e.target.value;
                                    setModalRows(updated);
                                  }}
                                  className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#005daa] w-36 font-semibold"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={row.dateLivraison}
                                  onChange={e => {
                                    const updated = [...modalRows];
                                    updated[idx].dateLivraison = e.target.value;
                                    setModalRows(updated);
                                  }}
                                  className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#005daa] w-36 font-semibold"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.franchise}
                                  onChange={e => {
                                    const updated = [...modalRows];
                                    updated[idx].franchise = parseInt(e.target.value, 10) || 0;
                                    setModalRows(updated);
                                  }}
                                  className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#005daa] w-20 font-mono font-bold text-center"
                                />
                              </td>
                              <td className="p-3 text-center font-mono font-semibold text-slate-700">
                                {stayDays} j
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-rose-600">
                                {billableDays} j
                              </td>
                              <td className="p-3 text-right font-mono font-extrabold text-[#005daa] text-sm">
                                {montant.toLocaleString('fr-FR')} F
                              </td>
                            </tr>
                            {calcResult.breakdown && calcResult.breakdown.length > 0 && (
                              <tr className="bg-slate-50/30">
                                <td colSpan={8} className="p-2 border-b border-slate-150">
                                  <div className="flex flex-wrap gap-2 justify-end px-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center mr-2">Détail Tranches :</span>
                                    {calcResult.breakdown.map((b, bIdx) => (
                                      <span key={bIdx} className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-600 shadow-2xs">
                                        <strong className="text-slate-800 font-sans">{b.label}</strong> : {b.days} j x {b.rate.toLocaleString('fr-FR')} = <strong className="text-emerald-700">{b.amount.toLocaleString('fr-FR')} F</strong>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Totals */}
                  <div className="flex justify-end pt-2">
                    <div className="px-5 py-3 bg-zinc-950 text-white rounded-xl shadow-xs text-right space-y-1 border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block font-mono">Total Calculé HT</span>
                      <strong className="text-lg font-black font-mono text-[#005DAA]">
                        {modalRows.reduce((sum, row) => {
                          const dateAcc = new Date(row.dateAccostage);
                          const dateLiv = new Date(row.dateLivraison);
                          const stayTime = dateLiv.getTime() - dateAcc.getTime();
                          const stayDays = isNaN(stayTime) ? 0 : Math.max(0, Math.ceil(stayTime / (1000 * 60 * 60 * 24)));
                          const calcResult = calculateDegressiveAmount(row.typeConteneur, stayDays, row.franchise, row.dateAccostage);
                          return sum + calcResult.totalAmount;
                        }, 0).toLocaleString('fr-FR')} FCFA
                      </strong>
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCalculationModalData(null)}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition-all cursor-pointer border border-zinc-200"
              >
                Annuler
              </button>
              {calculationModalData.bl.conteneurs && calculationModalData.bl.conteneurs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const details = modalRows.map(row => {
                      const dateAcc = new Date(row.dateAccostage);
                      const dateLiv = new Date(row.dateLivraison);
                      const stayTime = dateLiv.getTime() - dateAcc.getTime();
                      const stayDays = isNaN(stayTime) ? 0 : Math.max(0, Math.ceil(stayTime / (1000 * 60 * 60 * 24)));
                      const billableDays = Math.max(0, stayDays - row.franchise);
                      const calcResult = calculateDegressiveAmount(row.typeConteneur, stayDays, row.franchise, row.dateAccostage);
                      const montant = calcResult.totalAmount;
                      const rate = billableDays > 0 ? Math.round(montant / billableDays) : 0;
                      return {
                        ...row,
                        stayDays,
                        billableDays,
                        rate,
                        montant,
                        breakdown: calcResult.breakdown
                      };
                    });
                    const total = details.reduce((sum, det) => sum + det.montant, 0);
                    
                    const calcKey = `${calculationModalData.bl.id}-${calculationModalData.typeConfig.id}`;
                    setValidatedCalculations(prev => ({
                      ...prev,
                      [calcKey]: { total, details }
                    }));
                    
                    // Auto check in the selection list
                    if (!selectedTypeIdsForBl.includes(calculationModalData.typeConfig.id)) {
                      setSelectedTypeIdsForBl(prev => [...prev, calculationModalData.typeConfig.id]);
                    }
                    
                    setCalculationModalData(null);
                  }}
                  className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>Valider les calculs</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Modale d'Importation Multi-PDFs & Connaissements Incrémentale */}
      <MultiPdfImportModal
        isOpen={showMultiPdfModal}
        onClose={() => {
          setShowMultiPdfModal(false);
          setMultiPdfInitialFiles([]);
        }}
        escales={escales}
        activeEscaleId={selectedEscaleId}
        onCommitGroups={handleCommitMultiPdfGroups}
        initialFiles={multiPdfInitialFiles}
        onRequestCreateEscale={() => setShowAddEscaleModal(true)}
      />

      {/* ─── MODAL ÉDITION / CORRECTION BL ─── */}
      {editingBl && editBlForm && (() => {
        const CONTAINER_TYPES: { value: ContainerType; label: string }[] = [
          { value: '20_DRY', label: "20' DRY Standard" },
          { value: '40_DRY', label: "40' DRY Standard" },
          { value: '40_HC', label: "40' High Cube (HC)" },
          { value: '20_REEFER', label: "20' Frigorifique (Reefer)" },
          { value: '40_REEFER', label: "40' Frigorifique (Reefer)" },
          { value: '20_OPEN_TOP', label: "20' Open Top" },
          { value: '40_OPEN_TOP', label: "40' Open Top" },
          { value: '20_FLAT_RACK', label: "20' Flat Rack" },
        ];

        const setF = (patch: Partial<BL>) => setEditBlForm(prev => prev ? { ...prev, ...patch } : null);

        const handleSaveBl = () => {
          if (!editBlForm) return;
          if (onUpdateBl) onUpdateBl(editBlForm);
          // Also update selectedBlDetails if open
          if (selectedBlDetails && selectedBlDetails.id === editBlForm.id) setSelectedBlDetails(editBlForm);
          setEditingBl(null);
          setEditBlForm(null);
          toastSuccess(`BL ${editBlForm.numeroBL} mis à jour avec succès.`);
        };

        const inputCls = "w-full h-10 px-3 text-sm font-bold text-zinc-900 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005DAA]/30 focus:border-[#005DAA] transition-all";
        const labelCls = "block text-[11px] font-black text-zinc-600 uppercase tracking-wider mb-1";
        const tabCls = (tab: string) =>
          `px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
            editBlTab === tab
              ? 'bg-[#005DAA] text-white border-[#005DAA] shadow-sm'
              : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
          }`;

        return (
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 99999 }}
            onClick={overlayClickClose(() => { setEditingBl(null); setEditBlForm(null); })}
          >
            <div
              className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-7 py-5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#005DAA]/10 border border-[#005DAA]/25 flex items-center justify-center text-[#005DAA]">
                    <span className="material-symbols-outlined text-2xl">edit_document</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-zinc-950 font-mono tracking-tight">
                      Correction BL : <span className="text-[#005DAA]">{editBlForm.numeroBL}</span>
                    </h3>
                    <p className="text-xs text-zinc-500 font-medium mt-0.5">
                      {editBlForm.consigneeNom} — {editBlForm.conteneurs?.length > 0 ? `${editBlForm.conteneurs.length} conteneur(s)` : editBlForm.typeEmballage || 'Conventionnel'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingBl(null); setEditBlForm(null); }}
                  className="w-10 h-10 rounded-2xl hover:bg-zinc-200 text-zinc-400 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 px-7 pt-4 pb-3 border-b border-zinc-100 bg-white overflow-x-auto shrink-0">
                {(['general', 'parties', 'cargo', 'containers'] as const).map(tab => (
                  <button key={tab} type="button" onClick={() => setEditBlTab(tab)} className={tabCls(tab)}>
                    {tab === 'general' && '📄 Général'}
                    {tab === 'parties' && '🏢 Parties'}
                    {tab === 'cargo' && '📦 Marchandise'}
                    {tab === 'containers' && `🚢 Conteneurs (${editBlForm.conteneurs?.length || 0})`}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-7 space-y-5">

                {/* ── ONGLET GÉNÉRAL ── */}
                {editBlTab === 'general' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className={labelCls}>Numéro de Connaissement (N° BL) *</label>
                      <input className={inputCls} value={editBlForm.numeroBL} onChange={e => setF({ numeroBL: e.target.value.toUpperCase() })} />
                    </div>
                    <div>
                      <label className={labelCls}>Port de Chargement (POL)</label>
                      <input className={inputCls} placeholder="ex: FRLEH" value={editBlForm.portChargementCode || ''} onChange={e => setF({ portChargementCode: e.target.value.toUpperCase() })} />
                    </div>
                    <div>
                      <label className={labelCls}>Port de Déchargement (POD)</label>
                      <input className={inputCls} placeholder="ex: CIABJ" value={editBlForm.portDechargementCode || ''} onChange={e => setF({ portDechargementCode: e.target.value.toUpperCase() })} />
                    </div>
                    <div>
                      <label className={labelCls}>Destination Finale</label>
                      <input className={inputCls} value={editBlForm.destinationFinale || ''} onChange={e => setF({ destinationFinale: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Type d'Emballage</label>
                      <select className={inputCls} value={editBlForm.typeEmballage || 'COLIS'} onChange={e => setF({ typeEmballage: e.target.value })}>
                        {['COLIS', 'VRAC', 'RORO', 'CONTENEUR', 'PALETTE', 'CAISSE', 'FUT', 'CITERNE'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Marques & Numéros</label>
                      <input className={inputCls} value={editBlForm.marquesEtNumeros || ''} onChange={e => setF({ marquesEtNumeros: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Réf. Unique Transporteur</label>
                      <input className={inputCls} value={editBlForm.uniqueCarrierRef || ''} onChange={e => setF({ uniqueCarrierRef: e.target.value })} />
                    </div>
                  </div>
                )}

                {/* ── ONGLET PARTIES ── */}
                {editBlTab === 'parties' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Expéditeur / Chargeur (Shipper)</label>
                      <input className={inputCls} value={editBlForm.shipperNom || ''} onChange={e => setF({ shipperNom: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Adresse Expéditeur</label>
                      <input className={inputCls} value={editBlForm.shipperAdresse || ''} onChange={e => setF({ shipperAdresse: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Destinataire (Consignee) *</label>
                      <input className={inputCls} value={editBlForm.consigneeNom || ''} onChange={e => setF({ consigneeNom: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Adresse Destinataire</label>
                      <input className={inputCls} value={editBlForm.consigneeAdresse || ''} onChange={e => setF({ consigneeAdresse: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Notify Party</label>
                      <input className={inputCls} value={editBlForm.notifyNom || ''} onChange={e => setF({ notifyNom: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Adresse Notify</label>
                      <input className={inputCls} value={editBlForm.notifyAdresse || ''} onChange={e => setF({ notifyAdresse: e.target.value })} />
                    </div>
                  </div>
                )}

                {/* ── ONGLET MARCHANDISE ── */}
                {editBlTab === 'cargo' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className={labelCls}>Description des Marchandises</label>
                      <textarea
                        className="w-full px-3 py-2.5 text-sm font-bold text-zinc-900 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005DAA]/30 focus:border-[#005DAA] transition-all resize-none"
                        rows={3}
                        value={editBlForm.descriptionGoods || ''}
                        onChange={e => setF({ descriptionGoods: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Poids Brut (kg)</label>
                      <input type="number" className={inputCls} value={editBlForm.poidsBrutKg || 0} onChange={e => setF({ poidsBrutKg: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className={labelCls}>Volume (m³)</label>
                      <input type="number" className={inputCls} value={editBlForm.volumeM3 || 0} onChange={e => setF({ volumeM3: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className={labelCls}>Nombre de Colis</label>
                      <input type="number" className={inputCls} value={editBlForm.nombreColis || 0} onChange={e => setF({ nombreColis: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className={labelCls}>Code Nature</label>
                      <input className={inputCls} value={editBlForm.codeNature || ''} onChange={e => setF({ codeNature: e.target.value })} />
                    </div>
                  </div>
                )}

                {/* ── ONGLET CONTENEURS ── */}
                {editBlTab === 'containers' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-zinc-700">{editBlForm.conteneurs?.length || 0} conteneur(s) rattaché(s)</p>
                      <button
                        type="button"
                        onClick={() => {
                          const newCtr: Container = {
                            id: Date.now(),
                            blId: editBlForm.id,
                            numeroConteneur: '',
                            typeConteneur: '40_HC',
                            numeroScelle: '',
                            poidsKg: 0,
                            poidsNetKg: 0,
                            volumeM3: 0,
                            tareKg: 3800,
                            nombreColis: 1,
                            montantCautionFcfa: 250000,
                            statutLivraison: 'AU_PARC'
                          };
                          setF({ conteneurs: [...(editBlForm.conteneurs || []), newCtr] });
                        }}
                        className="px-4 py-2 bg-[#005DAA] hover:bg-[#004580] text-white text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Ajouter un conteneur
                      </button>
                    </div>
                    {(editBlForm.conteneurs || []).length === 0 ? (
                      <div className="text-center py-10 text-zinc-400 text-sm font-medium border-2 border-dashed border-zinc-200 rounded-2xl">
                        Aucun conteneur. Cliquez « Ajouter un conteneur » pour commencer.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(editBlForm.conteneurs || []).map((ctr, idx) => (
                          <div key={ctr.id || idx} className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-200 relative">
                            <button
                              type="button"
                              onClick={() => setF({ conteneurs: editBlForm.conteneurs.filter((_, i) => i !== idx) })}
                              className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white hover:bg-rose-50 border border-zinc-200 hover:border-rose-300 text-zinc-400 hover:text-rose-600 flex items-center justify-center cursor-pointer transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                            <div>
                              <label className={labelCls}>N° Conteneur</label>
                              <input className={inputCls} value={ctr.numeroConteneur} onChange={e => {
                                const ctrs = [...editBlForm.conteneurs];
                                ctrs[idx] = { ...ctrs[idx], numeroConteneur: e.target.value.toUpperCase() };
                                setF({ conteneurs: ctrs });
                              }} />
                            </div>
                            <div>
                              <label className={labelCls}>Type</label>
                              <select className={inputCls} value={ctr.typeConteneur} onChange={e => {
                                const ctrs = [...editBlForm.conteneurs];
                                ctrs[idx] = { ...ctrs[idx], typeConteneur: e.target.value as ContainerType };
                                setF({ conteneurs: ctrs });
                              }}>
                                {CONTAINER_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Poids Brut (kg)</label>
                              <input type="number" className={inputCls} value={ctr.poidsKg || 0} onChange={e => {
                                const ctrs = [...editBlForm.conteneurs];
                                ctrs[idx] = { ...ctrs[idx], poidsKg: parseFloat(e.target.value) || 0 };
                                setF({ conteneurs: ctrs });
                              }} />
                            </div>
                            <div>
                              <label className={labelCls}>N° Scellé</label>
                              <input className={inputCls} value={ctr.numeroScelle || ''} onChange={e => {
                                const ctrs = [...editBlForm.conteneurs];
                                ctrs[idx] = { ...ctrs[idx], numeroScelle: e.target.value };
                                setF({ conteneurs: ctrs });
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="px-7 py-4 border-t border-zinc-100 bg-zinc-50/80 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => { setEditingBl(null); setEditBlForm(null); }}
                  className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveBl}
                  className="px-7 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  Enregistrer les modifications
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
