import React, { useState, useRef, useEffect } from 'react';
import { useEscapeClose, overlayClickClose } from '../hooks/useEscapeClose';
import { BocsLogo } from './BocsLogo';
import {
  ArrowRight,
  Layers,
  Ship,
  ArrowLeft,
  Calendar,
  MapPin,
  Box,
  Upload,
  ChevronDown,
  ChevronUp,
  FileText,
  Database,
  Search,
  ExternalLink,
  Edit3,
  Check,
  X,
  Receipt,
  Clock,
  Compass,
  Calculator,
  Activity,
  ShieldCheck,
  CreditCard,
  PlusCircle,
  FileCheck,
  Radio,
  BarChart3,
  Globe2,
  CheckCircle2,
  Navigation,
  Sparkles,
  Layers3,
  TrendingUp,
  PackageCheck,
  FileSpreadsheet,
  Trash2,
  Loader2,
  Plus,
  Printer,
  LogOut,
  UserRound
} from 'lucide-react';
import { Escale, BL, Container, ContainerType, DraftExport, Invoice, InvoiceTypeConfig, UserRole, User, TimbreBracket } from '../types';
import { filterDraftsForUser } from '../utils/draftOwnership';
import { parseGuceXml } from '../utils/xmlGuceParser';
import { buildBocsBremenBls } from '../utils/manifestParser';
import { toastSuccess, toastError } from './common/Toast';
import { MultiPdfImportModal, EscaleCommitGroup } from './import/MultiPdfImportModal';
import { ExtractedBlEditModal } from './import/ExtractedBlEditModal';
import { BlEditModal } from './import/BlEditModal';
import { BlBillingModal } from './billing/BlBillingModal';
import { generateImportManifestPdf } from '../utils/pdfGenerator';
import {
  extractRawTextFromPdf,
  parseManifestBlsFromPdfText,
  ExtractedBlItem
} from '../utils/pdfExtractor';
import { RubriqueConfig, Payment } from '../types';
import { isTabAllowed, hasPermission, usePermissionsSync } from '../utils/permissions';


interface WelcomeScreenProps {
  escales: Escale[];
  bls: BL[];
  drafts?: DraftExport[];
  invoices?: Invoice[];
  invoiceTypeConfigs?: InvoiceTypeConfig[];
  rubriqueConfigs?: RubriqueConfig[];
  exchangeRateUsd?: number;
  userRole?: UserRole;
  currentUser?: User;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  onEnter: (targetTab?: any, targetBlId?: number) => void;
  onImportManifest: (escale: Escale, newBls: BL[]) => void;
  onUpdateEscale?: (updatedEscale: Escale) => void;
  onAddEscale?: (newEscale: Escale) => void;
  onUpdateBl?: (updatedBl: BL) => void;
  onGenerateInvoice?: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onValidateInvoice?: (invoiceId: number) => void;
  onDeleteInvoice?: (invoiceId: number) => void;
  onAddPayment?: (payment: Payment) => void;
  onLogAudit?: (action: string, entite: string, details: string) => void;
  /** Tranches de timbre fiscal d'État (assiette HT) — pour la facturation depuis l'accueil. */
  timbreBrackets?: TimbreBracket[];
}

type ViewState = 'welcome' | 'escales' | 'create-escale';

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  escales,
  bls,
  drafts = [],
  invoices = [],
  invoiceTypeConfigs = [],
  rubriqueConfigs = [],
  exchangeRateUsd = 600,
  userRole = 'ADMIN',
  currentUser,
  onOpenProfile,
  onLogout,
  onEnter,
  onImportManifest,
  onUpdateEscale,
  onAddEscale,
  onUpdateBl,
  onGenerateInvoice = () => { },
  onUpdateInvoice,
  onValidateInvoice,
  onDeleteInvoice,
  onAddPayment = () => { },
  onLogAudit = () => { },
  timbreBrackets
}) => {
  // RBAC : droits effectifs issus de la matrice des habilitations (source unique de vérité)
  usePermissionsSync();
  const permissionSubject = currentUser || { id: -1, role: userRole };
  const canViewVessels = isTabAllowed(permissionSubject, 'vessels');
  const canViewImport = isTabAllowed(permissionSubject, 'import');
  const canViewExport = isTabAllowed(permissionSubject, 'export');
  const canViewFacturation = isTabAllowed(permissionSubject, 'facturation');
  const canViewBalance = isTabAllowed(permissionSubject, 'facturation_balance');
  const canViewSurestarie = isTabAllowed(permissionSubject, 'surestarie');
  const canManageEscales = hasPermission(permissionSubject, 'manage_escales');
  const canImportGuce = hasPermission(permissionSubject, 'import_guce_xml');

  // ── Centrage adaptatif du cockpit (VIEW 1) ─────────────────────────────────
  // Le nombre de cartes réellement affichées dépend du profil connecté (habilitations
  // effectives de la matrice RBAC). Les grilles à nombre de colonnes fixe laissaient une
  // colonne vide quand une carte était masquée : les cartes se retrouvaient tassées à
  // gauche. On utilise donc des rangées flex centrées dont les cartes gardent une largeur
  // standard par breakpoint (tolérance de 1 à 2px pour absorber les arrondis de pourcentage
  // sans provoquer de rupture de ligne).
  const COCKPIT_KPI_CARD = 'w-full sm:w-[calc(50%_-_9px)] lg:w-[calc(25%_-_13px)]';
  const COCKPIT_PILLAR_CARD = 'w-full sm:w-[calc(50%_-_11px)] md:w-[calc(33.333%_-_15px)] xl:w-[calc(20%_-_17px)]';

  // Identité de la personne connectée (nom + rôle lisible), affichée dans l'en-tête
  const connectedUser: User | null = currentUser || null;
  const userInitials = (connectedUser?.nomComplet || '')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '••';
  const getConnectedRoleLabel = (role?: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'Administrateur';
      case 'AGENT_IMPORT': return 'Agent Import';
      case 'AGENT_EXPORT': return 'Agent Export';
      case 'COMPTABILITE': return 'Comptabilité';
      case 'CLIENT_EXPORT': return 'Client Export';
      default: return userRole;
    }
  };

  const [viewState, setViewState] = useState<ViewState>('welcome');
  const [selectedEscaleId, setSelectedEscaleId] = useState<number | null>(null);
  const [selectedBlForBillingModal, setSelectedBlForBillingModal] = useState<BL | null>(null);

  // Helper de suivi facturation par BL
  const getBlInvoiceStats = (bl: BL) => {
    const blInvoices = invoices.filter(inv => inv.blId === bl.id || inv.numeroBL === bl.numeroBL);
    const activeBlInvoices = blInvoices.filter(inv => inv.statutFacture !== 'ANNULEE' && inv.statutFacture !== 'AVOIR');

    // 1. Détermination du nombre de types prévus pour ce BL
    let plannedIds: string[] = [];
    if (bl.selectedInvoiceTypeIds && bl.selectedInvoiceTypeIds.length > 0) {
      plannedIds = bl.selectedInvoiceTypeIds;
    } else {
      try {
        const savedPlanned = localStorage.getItem('bocs_bl_planned_invoices');
        if (savedPlanned) {
          const parsed = JSON.parse(savedPlanned);
          if (parsed[bl.id] && Array.isArray(parsed[bl.id]) && parsed[bl.id].length > 0) {
            plannedIds = parsed[bl.id];
          }
        }
      } catch (e) { }
    }

    let totalAEditer = 0;
    if (plannedIds.length > 0) {
      totalAEditer = plannedIds.length;
    } else if (invoiceTypeConfigs && invoiceTypeConfigs.length > 0) {
      const isContainer = Boolean(bl.conteneurs && bl.conteneurs.length > 0);
      const applicable = invoiceTypeConfigs.filter(tc => {
        const nameLow = tc.name.toLowerCase();
        const isCaution = nameLow.includes('caution');
        const isEchange = nameLow.includes('echange') || nameLow.includes('échange') || tc.id === '2';
        const isTransfert = nameLow.includes('transfert');
        if (isContainer) {
          return isCaution || isEchange || isTransfert;
        }
        return isEchange;
      });
      totalAEditer = Math.max(applicable.length, 1);
    } else {
      totalAEditer = Boolean(bl.conteneurs && bl.conteneurs.length > 0) ? 3 : 1;
    }

    totalAEditer = Math.max(totalAEditer, activeBlInvoices.length);
    const nbEditees = activeBlInvoices.length;
    const isAllEditees = nbEditees > 0 && nbEditees >= totalAEditer;

    const paidInvoices = activeBlInvoices.filter(inv => inv.soldeDuFcfa === 0 || inv.statutPaiement === 'PAYE');
    const nbReglees = paidInvoices.length;
    const isAllReglees = isAllEditees && nbReglees === nbEditees && nbEditees > 0;
    const isPartiallyReglees = nbReglees > 0 && nbReglees < nbEditees;

    return {
      totalAEditer,
      nbEditees,
      isAllEditees,
      nbReglees,
      isAllReglees,
      isPartiallyReglees
    };
  };

  // Calculations for KPIs
  const activeEscalesCount = escales.filter(e => e.statut === 'EN_COURS').length;
  const pendingImportBlsCount = bls.filter(b => b.statutImport !== 'FACTURE').length;
  // KPI Drafts Export : pour un client export, uniquement SES propres drafts
  // (règle d'isolation partagée) — les agents voient la totalité.
  const pendingDraftsCount = filterDraftsForUser(drafts, currentUser, userRole)
    .filter(d => d.statut === 'SOUMIS' || d.statut === 'BROUILLON').length;
  const totalSoldeDuFcfa = invoices.reduce((acc, inv) => acc + (inv.soldeDuFcfa || 0), 0);

  // Multi-PDF modal state
  const [showMultiPdfModal, setShowMultiPdfModal] = useState(false);
  const [multiPdfInitialFiles, setMultiPdfInitialFiles] = useState<File[]>([]);
  const [targetUploadEscaleId, setTargetUploadEscaleId] = useState<number | null>(null);
  const escalePdfInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenUploadForEscale = (escaleId: number, files?: File[]) => {
    setTargetUploadEscaleId(escaleId);
    setSelectedEscaleId(escaleId);
    if (files && files.length > 0) {
      setMultiPdfInitialFiles(files);
    } else {
      setMultiPdfInitialFiles([]);
    }
    setShowMultiPdfModal(true);
  };

  const handleDirectEscalePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (files.length > 0 && targetUploadEscaleId) {
      setMultiPdfInitialFiles(files);
      setShowMultiPdfModal(true);
    }
    e.target.value = '';
  };

  // Real-time Abidjan Clock
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('fr-FR', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' GMT');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Search in Escales explorer
  const [searchTerm, setSearchTerm] = useState('');

  // Modal d'édition des informations du navire / escale
  const [editingEscale, setEditingEscale] = useState<Escale | null>(null);
  const [escaleFormData, setEscaleFormData] = useState<Partial<Escale>>({});

  // Audit UX : fermeture clavier (Échap) de la modale d'édition navire & escale.
  useEscapeClose(Boolean(editingEscale), () => setEditingEscale(null));

  // Modal d'édition et correction d'un BL existant dans le Registre
  const [editingBl, setEditingBl] = useState<BL | null>(null);

  const handleSaveBlRecord = (updatedBl: BL) => {
    if (onUpdateBl) {
      onUpdateBl(updatedBl);
    }
    toastSuccess(`Connaissement N° ${updatedBl.numeroBL} mis à jour avec succès.`);
    setEditingBl(null);
  };

  // État de création d'une nouvelle escale avec chargement de manifestes PDF
  const [newEscaleForm, setNewEscaleForm] = useState({
    nomNavire: '',
    numeroVoyage: '',
    callsign: '',
    portChargement: 'ANVERS (BEANR)',
    portDechargement: 'ABIDJAN (CIABJ)',
    dateArrivee: new Date().toISOString().split('T')[0],
    dateAccostage: '',
    dateDepart: '',
    quai: 'Quai 7 - Vridi',
    statut: 'EN_COURS' as 'EN_COURS' | 'CLOTUREE' | 'ANNULEE'
  });
  const [newEscaleFiles, setNewEscaleFiles] = useState<File[]>([]);
  const [newEscaleBls, setNewEscaleBls] = useState<ExtractedBlItem[]>([]);
  const [editingNewEscaleBl, setEditingNewEscaleBl] = useState<ExtractedBlItem | null>(null);
  const [isExtractingNewEscalePdfs, setIsExtractingNewEscalePdfs] = useState(false);
  const [isNewEscaleDragOver, setIsNewEscaleDragOver] = useState(false);
  const newEscaleFileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenCreateEscale = () => {
    setNewEscaleForm({
      nomNavire: '',
      numeroVoyage: '',
      callsign: '',
      portChargement: 'ANVERS (BEANR)',
      portDechargement: 'ABIDJAN (CIABJ)',
      dateArrivee: new Date().toISOString().split('T')[0],
      dateAccostage: '',
      dateDepart: '',
      quai: 'Quai 7 - Vridi',
      statut: 'EN_COURS'
    });
    setNewEscaleFiles([]);
    setNewEscaleBls([]);
    setEditingNewEscaleBl(null);
    setIsExtractingNewEscalePdfs(false);
    setViewState('create-escale');
  };

  const handleProcessNewEscalePdfs = async (files: File[]) => {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      toastError("Veuillez sélectionner des fichiers au format PDF.");
      return;
    }

    setIsExtractingNewEscalePdfs(true);
    setNewEscaleFiles(prev => [...prev, ...pdfs]);

    let totalExtracted = 0;
    for (const file of pdfs) {
      try {
        const { text: rawText, wasOcr } = await extractRawTextFromPdf(file);
        const parsed = parseManifestBlsFromPdfText(rawText, file.name);

        if (parsed.length > 0) {
          const formatted: ExtractedBlItem[] = parsed.map((bl, bIdx) => ({
            ...bl,
            fileId: `${file.name}-${bl.numeroBL || bIdx}-${Date.now()}-${Math.random()}`,
            fileName: file.name,
            fileSize: file.size,
            status: 'SUCCESS',
            rawText,
            wasOcr,
            nomNavire: newEscaleForm.nomNavire || bl.nomNavire,
            numeroVoyage: newEscaleForm.numeroVoyage || bl.numeroVoyage
          }));

          // Pré-remplir le nom du navire et le voyage si encore vides
          setNewEscaleForm(prev => ({
            ...prev,
            nomNavire: prev.nomNavire || parsed[0].nomNavire || '',
            numeroVoyage: prev.numeroVoyage || parsed[0].numeroVoyage || ''
          }));

          setNewEscaleBls(prev => [...prev, ...formatted]);
          totalExtracted += formatted.length;
        } else {
          toastError(`Aucun connaissement lisible détecté dans ${file.name}.`);
        }
      } catch (err: any) {
        toastError(`Erreur lors de l'extraction de ${file.name} : ${err?.message || 'Document illisible'}`);
      }
    }

    setIsExtractingNewEscalePdfs(false);
    if (totalExtracted > 0) {
      toastSuccess(`${totalExtracted} connaissement(s) extrait(s) et rattaché(s) à la nouvelle escale !`);
    }
  };

  const handleRemoveNewEscaleBl = (fileId: string) => {
    setNewEscaleBls(prev => prev.filter(b => b.fileId !== fileId));
  };

  const handleSaveEditedBl = (updatedBl: ExtractedBlItem) => {
    setNewEscaleBls(prev => prev.map(b => b.fileId === updatedBl.fileId ? updatedBl : b));
    setEditingNewEscaleBl(null);
    toastSuccess(`Connaissement ${updatedBl.numeroBL} mis à jour avec succès !`);
  };

  const handleSubmitNewEscaleWithBls = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEscaleForm.nomNavire.trim() || !newEscaleForm.numeroVoyage.trim()) {
      toastError("Le nom du navire et le numéro de voyage sont obligatoires.");
      return;
    }

    const newEscaleId = Date.now();
    const createdEscale: Escale = {
      id: newEscaleId,
      nomNavire: newEscaleForm.nomNavire.trim(),
      numeroVoyage: newEscaleForm.numeroVoyage.trim(),
      callsign: (newEscaleForm.callsign || '').trim(),
      portChargement: newEscaleBls[0]?.portChargementCode || newEscaleForm.portChargement || 'ANVERS (BEANR)',
      portDechargement: newEscaleForm.portDechargement || 'ABIDJAN (CIABJ)',
      dateArrivee: newEscaleForm.dateArrivee || new Date().toISOString().split('T')[0],
      dateAccostage: newEscaleForm.dateAccostage?.trim() || undefined,
      dateDepart: newEscaleForm.dateDepart?.trim() || undefined,
      quai: newEscaleForm.quai?.trim() || undefined,
      statut: newEscaleForm.statut
    };

    const formattedBls: BL[] = newEscaleBls.map((item, idx) => {
      const blId = newEscaleId + idx + 1;
      return {
        id: blId,
        escaleId: newEscaleId,
        numeroBL: item.numeroBL || `BL-${newEscaleId}-${idx + 1}`,
        typeOperation: 'IMPORT',
        shipperNom: item.shipperNom || 'EXPÉDITEUR NON SPÉCIFIÉ',
        shipperAdresse: item.shipperAdresse || '',
        consigneeNom: item.consigneeNom || 'DESTINATAIRE NON SPÉCIFIÉ',
        consigneeAdresse: item.consigneeAdresse || '',
        notifyNom: item.notifyNom || item.consigneeNom || 'TO ORDER',
        notifyAdresse: item.notifyAdresse || '',
        portChargementCode: item.portChargementCode || createdEscale.portChargement,
        portDechargementCode: item.portDechargementCode || createdEscale.portDechargement,
        destinationFinale: item.destinationFinale || 'CI',
        descriptionGoods: item.descriptionGoods || 'MARCHANDISES DIVERSES',
        marquesEtNumeros: item.marquesEtNumeros || `MARQUES ${item.numeroBL}`,
        nombreColis: item.nombreColis || 1,
        typeEmballage: item.typeEmballage || 'COLIS',
        poidsBrutKg: item.poidsBrutKg || 0,
        volumeM3: item.volumeM3 || 0,
        statutImport: 'EN_ATTENTE',
        conteneurs: (item.conteneurs || []).map((c, cIdx) => ({
          ...c,
          id: newEscaleId + 10000 + (idx * 50) + cIdx,
          blId
        }))
      };
    });

    if (formattedBls.length > 0) {
      onImportManifest(createdEscale, formattedBls);
      toastSuccess(`Escale "${createdEscale.nomNavire}" créée avec succès ! ${formattedBls.length} connaissement(s) rattaché(s).`);
    } else {
      if (onAddEscale) {
        onAddEscale(createdEscale);
      } else {
        onImportManifest(createdEscale, []);
      }
      toastSuccess(`Escale "${createdEscale.nomNavire}" créée avec succès.`);
    }

    setViewState('escales');
    setSelectedEscaleId(createdEscale.id);
  };

  const handleOpenEditModal = (esc: Escale) => {
    setEditingEscale(esc);
    setEscaleFormData({
      ...esc,
      dateAccostage: esc.dateAccostage || '',
      dateDepart: esc.dateDepart || '',
      quai: esc.quai || ''
    });
  };

  const handleSaveEscale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEscale || !escaleFormData.nomNavire || !escaleFormData.numeroVoyage) {
      toastError('Le nom du navire et le numéro de voyage sont obligatoires.');
      return;
    }

    const updated: Escale = {
      ...editingEscale,
      nomNavire: escaleFormData.nomNavire.trim(),
      numeroVoyage: escaleFormData.numeroVoyage.trim(),
      callsign: (escaleFormData.callsign || '').trim(),
      portChargement: escaleFormData.portChargement || editingEscale.portChargement,
      portDechargement: escaleFormData.portDechargement || editingEscale.portDechargement,
      dateArrivee: escaleFormData.dateArrivee || editingEscale.dateArrivee,
      dateAccostage: escaleFormData.dateAccostage?.trim() || undefined,
      dateDepart: escaleFormData.dateDepart?.trim() || undefined,
      quai: escaleFormData.quai?.trim() || undefined,
      statut: escaleFormData.statut || editingEscale.statut
    };

    if (onUpdateEscale) {
      onUpdateEscale(updated);
    }
    toastSuccess(`Informations du navire ${updated.nomNavire} mises à jour.`);
    setEditingEscale(null);
  };

  // Filtered escales in explorer view
  const filteredEscales = escales.filter(e =>
    e.nomNavire.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.numeroVoyage.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.callsign && e.callsign.toLowerCase().includes(searchTerm.toLowerCase())) ||
    e.portChargement.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.portDechargement.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEscaleClick = (escaleId: number) => {
    setSelectedEscaleId(prev => prev === escaleId ? null : escaleId);
  };

  const handleCommitMultiPdfGroups = (groups: EscaleCommitGroup[]) => {
    let totalBls = 0;
    groups.forEach(group => {
      onImportManifest(group.escale, group.bls);
      totalBls += group.bls.length;
    });

    if (groups.length > 0) {
      setViewState('escales');
      setSelectedEscaleId(groups[0].escale.id);
    }
    const escalesSummary = groups.map(g => `${g.escale.nomNavire} (${g.bls.length} BLs)`).join(', ');
    toastSuccess(`Succès ! ${totalBls} connaissement(s) intégré(s) sur ${groups.length} escale(s) : ${escalesSummary}.`);
  };

  // Handle XML/PDF Manifest Upload
  const handleXmlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    const xmlFile = files.find(f => f.name.toLowerCase().endsWith('.xml'));

    if (pdfFiles.length > 0) {
      setMultiPdfInitialFiles(pdfFiles);
      setShowMultiPdfModal(true);
      e.target.value = '';
      return;
    }

    if (xmlFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const xmlContent = (event.target?.result as string) || '';
          const newEscaleId = Date.now();
          const parsed = parseGuceXml(xmlContent);

          const newEscale: Escale = {
            id: newEscaleId,
            nomNavire: parsed.escale.nomNavire || 'EA CHARA',
            callsign: parsed.escale.callsign || '9V8974',
            numeroVoyage: parsed.escale.numeroVoyage || '014E',
            portChargement: parsed.escale.portChargement || 'ANVERS (BEANR)',
            portDechargement: parsed.escale.portDechargement || 'ABIDJAN (CIABJ)',
            dateArrivee: parsed.escale.dateArrivee || new Date().toISOString().split('T')[0],
            statut: 'EN_COURS'
          };

          let extractedBls: BL[] = [];
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
            extractedBls = buildBocsBremenBls(newEscaleId);
          }

          onImportManifest(newEscale, extractedBls);
          toastSuccess(`Manifeste XML GUCE intégré avec succès ! Escale "${newEscale.nomNavire}" (${extractedBls.length} BLs).`);

          setViewState('escales');
          setSelectedEscaleId(newEscale.id);
        } catch (err: any) {
          toastError("Erreur lors de la lecture du fichier XML : " + err.message);
        }
      };
      reader.readAsText(xmlFile);
    }
  };

  return (
    <div className="welcome-hub min-h-screen w-full flex flex-col justify-between text-zinc-900 bg-white relative overflow-x-hidden font-sans antialiased select-none">

      {/* Hidden file input for manifest upload */}
      <input
        type="file"
        multiple
        accept=".xml,.pdf"
        id="executive-manifest-upload-input"
        className="hidden"
        onChange={handleXmlFileUpload}
      />

      {/* Hidden file input for specific escale direct PDF manifest upload */}
      <input
        type="file"
        multiple
        accept=".pdf"
        ref={escalePdfInputRef}
        className="hidden"
        onChange={handleDirectEscalePdfSelect}
      />

      {/* ─── 1. TOP EXECUTIVE CLEAN HEADER ─── */}
      <header className="w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md z-30 relative shrink-0 shadow-xs">
        <div className="max-w-[2465px] mx-auto px-6 sm:px-8 py-3.5 flex items-center justify-between">

          {/* Brand Identity */}
          <div className="flex items-center gap-4">
            <BocsLogo className="h-11 w-auto shrink-0" />
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-black tracking-wider text-zinc-900 font-sans">BOCS CI</span>
              </div>
              <p className="text-xs text-zinc-500 font-bold mt-0.5">Bremen Overseas Chartering Shipping • Agence Consignataire</p>
            </div>
          </div>

          {/* Right Authority & Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden lg:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2 font-mono text-[#005DAA] bg-[#F0F7FF] px-3.5 py-1.5 rounded-xl border border-[#005DAA]/25 font-black">
                <Clock className="w-4 h-4 text-[#005DAA]" />
                <span>{currentTime || '00:00:00 GMT'}</span>
              </div>
            </div>

            {/* Personne connectée : nom + rôle, sélecteur de compte, profil, déconnexion */}
            {connectedUser ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="flex items-center gap-2 bg-zinc-50 hover:bg-zinc-100 pl-1.5 pr-3 py-1.5 rounded-xl border border-zinc-200 hover:border-zinc-300 shadow-2xs transition-all cursor-pointer group active:scale-95 text-zinc-900"
                  title="Mon Profil — Paramètres & mot de passe"
                >
                  <div className="w-7 h-7 rounded-full bg-[#005DAA] text-white font-black text-xs flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
                    {userInitials}
                  </div>
                  <div className="text-left hidden sm:block max-w-[150px]">
                    <span className="text-xs font-extrabold text-zinc-900 block leading-none truncate group-hover:text-[#005DAA] transition-colors">{connectedUser.nomComplet}</span>
                    <span className="text-[10px] text-[#005DAA] font-mono font-bold leading-none mt-1 block truncate">{getConnectedRoleLabel(connectedUser.role)}</span>
                  </div>
                </button>

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                    title={`Se déconnecter (${connectedUser.nomComplet})`}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-200 text-zinc-700" title="Aucun utilisateur connecté">
                <div className="w-7 h-7 rounded-full bg-zinc-300 text-zinc-600 flex items-center justify-center shrink-0">
                  <UserRound className="w-4 h-4" />
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-extrabold block leading-none">Non connecté</span>
                  <span className="text-[10px] font-mono font-bold leading-none mt-1 block">{getConnectedRoleLabel(undefined)}</span>
                </div>
              </div>
            )}

            {viewState === 'create-escale' ? (
              <button
                onClick={() => setViewState('escales')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-black text-zinc-800 transition-all cursor-pointer shadow-2xs active:scale-95 group"
                title="Retour à la liste des escales"
              >
                <ArrowLeft className="w-4 h-4 text-[#005DAA] group-hover:-translate-x-1 transition-transform" />
                <span>Retour aux Escales</span>
              </button>
            ) : viewState === 'escales' ? (
              <button
                onClick={() => {
                  setViewState('welcome');
                  setSelectedEscaleId(null);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-black text-zinc-800 transition-all cursor-pointer shadow-2xs active:scale-95 group"
                title="Retour à la plateforme intégrée de gestion et facturation maritime"
              >
                <ArrowLeft className="w-4 h-4 text-[#005DAA] group-hover:-translate-x-1 transition-transform" />
                <span>Retour Plateforme Intégrée</span>
              </button>
            ) : null}
          </div>

        </div>
      </header>

      {/* ─── 2. MAIN EXECUTIVE WORKSPACE ─── */}
      <main className="w-full max-w-[2465px] mx-auto px-6 sm:px-8 pt-6 sm:pt-8 pb-12 flex-1 flex flex-col justify-start z-20 relative">

        {/* ══════════════════════════════════════════════════════════════════
            VIEW 1: GRAND CLEAN EDITORIAL COCKPIT PORTAL
        ══════════════════════════════════════════════════════════════════ */}
        {viewState === 'welcome' && (
          <div className="w-full animate-fade-in">

            {/* ── SECTION A: GRAND HERO BANNER ── */}
            <div className="bg-white border border-zinc-200 rounded-3xl py-7 px-8 sm:py-8 sm:px-10 shadow-xs relative overflow-hidden">

              <div className="space-y-4 w-full relative z-10">

                <h1 className="text-2xl sm:text-3xl md:text-[28px] lg:text-[36px] xl:text-[42px] font-black tracking-tight leading-tight md:whitespace-nowrap text-[#002B49]">
                  Plateforme Intégrée de <span className="text-[#00875A] font-serif italic font-normal">Gestion & Facturation Maritime</span>
                </h1>
                <p className="text-base text-zinc-600 font-medium leading-relaxed max-w-3xl">
                  Gestion des escales, suivi des Bls, consolidation des Manifeste et facturation des prestations.
                </p>
              </div>

            </div>

            {/* ── SECTION B: 4 KPI BENTO CARDS ── */}
            <div className="max-w-5xl xl:max-w-6xl mx-auto w-full flex flex-wrap justify-center gap-4 mt-6">

              {/* KPI 1 : Escales Actives (RBAC : habilitation Escales/Radar requise) */}
              {canViewVessels && (
                <div className={`${COCKPIT_KPI_CARD} bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs select-none`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                        Escales aux Quais
                      </h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Port d'Abidjan &amp; Rade</p>
                    </div>
                    <div className="p-2.5 bg-[#005DAA]/10 border border-[#005DAA]/25 rounded-xl text-[#005DAA]">
                      <span className="material-symbols-outlined text-xl">directions_boat</span>
                    </div>
                  </div>
                  <div className="flex items-baseline space-x-2.5">
                    <span className="text-4xl font-black text-[#005DAA] font-sans tracking-tight">{activeEscalesCount}</span>
                    <span className="text-xs font-extrabold text-zinc-800 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-sm text-[#00875A]">anchor</span>
                      <span>En cours</span>
                    </span>
                  </div>
                </div>
              )}

              {/* KPI 2 : BLs Import à Traiter (RBAC : habilitation Import GUCE requise) */}
              {canViewImport && (
                <div className={`${COCKPIT_KPI_CARD} bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs select-none`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                        BLs Import à Traiter
                      </h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Connaissements ouverts</p>
                    </div>
                    <div className="p-2.5 bg-[#00875A]/10 border border-[#00875A]/25 rounded-xl text-[#00875A]">
                      <span className="material-symbols-outlined text-xl">description</span>
                    </div>
                  </div>
                  <div className="flex items-baseline space-x-2.5">
                    <span className="text-4xl font-black text-[#00875A] font-sans tracking-tight">{pendingImportBlsCount}</span>
                    <span className="text-[10px] font-bold text-[#00875A] bg-[#ECFDF5] px-2 py-0.5 rounded-md border border-[#00875A]/30">
                      À Facturer
                    </span>
                  </div>
                </div>
              )}

              {/* KPI 3 : Drafts Export Soumis (RBAC : habilitation Export requise) */}
              {canViewExport && (
                <div className={`${COCKPIT_KPI_CARD} bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs select-none`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                        Drafts Export Soumis
                      </h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Réservations chargeurs</p>
                    </div>
                    <div className="p-2.5 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-700">
                      <span className="material-symbols-outlined text-xl">file_present</span>
                    </div>
                  </div>
                  <div className="flex items-baseline space-x-2.5">
                    <span className="text-4xl font-black text-[#005DAA] font-sans tracking-tight">{pendingDraftsCount}</span>
                    <span className="text-xs font-semibold text-zinc-600">Attente validation</span>
                  </div>
                </div>
              )}

              {/* KPI 4 : Créances & Solde Dû (RBAC : habilitation Balance Client requise) */}
              {canViewBalance && (
                <div
                  onClick={() => onEnter('facturation_balance')}
                  className={`${COCKPIT_KPI_CARD} bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between hover:border-[#005DAA] transition-all cursor-pointer group shadow-xs hover:shadow-md select-none`}
                  title="Consulter la Balance Âgée & Suivi des Créances"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 group-hover:text-[#005DAA] transition-colors">
                        Créances &amp; Solde Dû
                      </h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Règlements attendus</p>
                    </div>
                    <div className="p-2.5 bg-[#005DAA]/10 border border-[#005DAA]/25 rounded-xl text-[#005DAA] group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-xl">payments</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-zinc-900 font-sans">{totalSoldeDuFcfa.toLocaleString('fr-FR')} FCFA</span>
                    <span className="text-[11px] text-[#005DAA] font-bold mt-0.5">~{(totalSoldeDuFcfa / exchangeRateUsd).toFixed(0)} USD</span>
                  </div>
                </div>
              )}

            </div>

            {/* ── SECTION D: 5 BUSINESS PILLARS (CLEAN MINIMAL CARDS) ── */}
            <div className="flex flex-wrap justify-center gap-5 mt-8 sm:mt-12 lg:mt-[4cm]">

              {/* Module 1: Manifestes & Escales (RBAC : habilitation Escales requise) */}
              {canViewVessels && (
                <div
                  onClick={() => setViewState('escales')}
                  className={`${COCKPIT_PILLAR_CARD} ocean-glass-card rounded-3xl p-6 xl:p-7 flex flex-col justify-between transition-all cursor-pointer group hover:-translate-y-1 shadow-sm hover:shadow-md border border-zinc-200 hover:border-[#005DAA] bg-white`}
                >
                  <div>
                    <div className="mb-5">
                      <div className="w-14 h-14 rounded-2xl bg-[#005DAA]/10 border border-[#005DAA]/20 flex items-center justify-center text-[#005DAA] group-hover:bg-[#005DAA] group-hover:text-white transition-all shadow-xs">
                        <Layers3 className="w-7 h-7" />
                      </div>
                    </div>
                    <h3 className="font-black text-xl text-[#005DAA] transition-colors mb-2 font-display">
                      Manifestes & Escales
                    </h3>
                    <p className="text-sm text-zinc-600 leading-relaxed font-normal">
                      Parsing automatisé des fichiers XML douaniers, détection des conteneurs SOC/COC, vrac et suivi du registre.
                    </p>
                  </div>
                  <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-sm font-black text-[#005DAA]">
                    <span>Consulter le Registre</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>
              )}

              {/* Module 2: Drafts & BL Export (RBAC : habilitation Export requise) */}
              {canViewExport && (
                <div
                  onClick={() => onEnter('export')}
                  className={`${COCKPIT_PILLAR_CARD} ocean-glass-card rounded-3xl p-6 xl:p-7 flex flex-col justify-between transition-all cursor-pointer group hover:-translate-y-1 shadow-sm hover:shadow-md border border-zinc-200 hover:border-[#005DAA] bg-white`}
                >
                  <div>
                    <div className="mb-5">
                      <div className="w-14 h-14 rounded-2xl bg-[#005DAA]/10 border border-[#005DAA]/20 flex items-center justify-center text-[#005DAA] group-hover:bg-[#005DAA] group-hover:text-white transition-all shadow-xs">
                        <Ship className="w-7 h-7" />
                      </div>
                    </div>
                    <h3 className="font-black text-xl text-[#005DAA] transition-colors mb-2 font-display">
                      Drafts & BL Export
                    </h3>
                    <p className="text-sm text-zinc-600 leading-relaxed font-normal">
                      Saisie des instructions de connaissement (Shipping Instructions), validation armateur et émission des BLs.
                    </p>
                  </div>
                  <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-sm font-black text-[#005DAA]">
                    <span>Espace Export</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>
              )}

              {/* Module 3: Facturation Maritime (RBAC : habilitation Facturation requise) */}
              {canViewFacturation && (
                <div
                  onClick={() => onEnter('facturation')}
                  className={`${COCKPIT_PILLAR_CARD} ocean-glass-card rounded-3xl p-6 xl:p-7 flex flex-col justify-between transition-all cursor-pointer group hover:-translate-y-1 shadow-sm hover:shadow-md border border-zinc-200 hover:border-[#005DAA] bg-white`}
                >
                  <div>
                    <div className="mb-5">
                      <div className="w-14 h-14 rounded-2xl bg-[#00875A]/10 border border-[#00875A]/20 flex items-center justify-center text-[#00875A] group-hover:bg-[#00875A] group-hover:text-white transition-all shadow-xs">
                        <Receipt className="w-7 h-7" />
                      </div>
                    </div>
                    <h3 className="font-black text-xl text-[#005DAA] transition-colors mb-2 font-display">
                      Facturation Maritime
                    </h3>
                    <p className="text-sm text-zinc-600 leading-relaxed font-normal">
                      Calcul multi-rubriques (Aconage, Roro, Sûretés, Débours) et facturation certifiée DGI / FNE sans doublon.
                    </p>
                  </div>
                  <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-sm font-black text-[#00875A]">
                    <span>Facturation & Reçus</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>
              )}

              {/* Module 4: Calcul des DMDT (RBAC : habilitation DMDT requise) */}
              {canViewSurestarie && (
                <div
                  onClick={() => onEnter('surestarie')}
                  className={`${COCKPIT_PILLAR_CARD} ocean-glass-card rounded-3xl p-6 xl:p-7 flex flex-col justify-between transition-all cursor-pointer group hover:-translate-y-1 shadow-sm hover:shadow-md border border-zinc-200 hover:border-[#D94817] bg-white`}
                >
                  <div>
                    <div className="mb-5">
                      <div className="w-14 h-14 rounded-2xl bg-[#D94817]/10 border border-[#D94817]/20 flex items-center justify-center text-[#D94817] group-hover:bg-[#D94817] group-hover:text-white transition-all shadow-xs">
                        <Calculator className="w-7 h-7" />
                      </div>
                    </div>
                    <h3 className="font-black text-xl text-[#005DAA] transition-colors mb-2 font-display">
                      Calcul des DMDT
                    </h3>
                    <p className="text-sm text-zinc-600 leading-relaxed font-normal">
                      Calcul dégressif des surestaries &amp; détentions conteneurs, franchises import/export et émission proforma.
                    </p>
                  </div>
                  <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-sm font-black text-[#D94817]">
                    <span>Calculateur DMDT</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>
              )}

              {/* Module 5: Radar AIS & Quai (RBAC : habilitation Escales/Radar requise) */}
              {canViewVessels && (
                <div
                  onClick={() => onEnter('vessels')}
                  className={`${COCKPIT_PILLAR_CARD} ocean-glass-card rounded-3xl p-6 xl:p-7 flex flex-col justify-between transition-all cursor-pointer group hover:-translate-y-1 shadow-sm hover:shadow-md border border-zinc-200 hover:border-[#005DAA] bg-white`}
                >
                  <div>
                    <div className="mb-5">
                      <div className="w-14 h-14 rounded-2xl bg-[#005DAA]/10 border border-[#005DAA]/20 flex items-center justify-center text-[#005DAA] group-hover:bg-[#005DAA] group-hover:text-white transition-all shadow-xs">
                        <Compass className="w-7 h-7" />
                      </div>
                    </div>
                    <h3 className="font-black text-xl text-[#005DAA] transition-colors mb-2 font-display">
                      Radar & Quai Vridi
                    </h3>
                    <p className="text-sm text-zinc-600 leading-relaxed font-normal">
                      Positionnement des navires en rade, programmation des postes à quai et calendrier officiel des mouvements.
                    </p>
                  </div>
                  <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-sm font-black text-[#005DAA]">
                    <span>Radar Flotte</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>
              )}

            </div>

            {/* ── SECTION E: FOOTER LEGAL & COMPLIANCE (Matching Image 2) ── */}
            <footer className="mt-16 sm:mt-20 pt-6 border-t border-zinc-200 flex flex-wrap items-center justify-between text-[11px] font-semibold text-zinc-500 gap-4 select-none">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-zinc-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00875A]" />
                  <span>Conformité Douanière GUCE &amp; DGI FNE (Côte d'Ivoire)</span>
                </div>
                <span className="text-zinc-300">•</span>
                <div className="flex items-center gap-1.5 text-zinc-700">
                  <Database className="w-3.5 h-3.5 text-[#005DAA]" />
                  <span>PostgreSQL Neon Cloud Chiffré</span>
                </div>
                {hasPermission(permissionSubject, 'admin_rights_assign') && (
                  <>
                    <span className="text-zinc-300">•</span>
                    <button
                      type="button"
                      onClick={() => onEnter('admin_rights')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all font-bold text-[11px] cursor-pointer hover:shadow-xs active:scale-95"
                      title="Accéder directement à l'attribution des droits utilisateurs (Admin)"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                      <span>Attribution des Profils</span>
                    </button>
                  </>
                )}
              </div>
              <div className="text-zinc-500">
                © 2026 BOCS CI Maritime Agency • Abidjan Port Operations. Tous droits réservés.
              </div>
            </footer>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            VIEW 2: REGISTRE DES ESCALES & MANIFESTES (DARK LUXURY TABLE)
        ══════════════════════════════════════════════════════════════════ */}
        {viewState === 'escales' && (
          <div className="w-full max-w-[2054px] space-y-8 animate-fade-in mx-auto">

            {/* Header bar */}
            <div className="ocean-glass-banner rounded-3xl p-8 sm:p-10 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 border border-zinc-200 bg-white">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-black text-[#00875A] uppercase tracking-widest mb-1.5">
                  <Ship className="w-4 h-4" />
                  <span>Registre Officiel des Navires & Manifestes</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-[#005DAA] font-display">
                  Escales Portuaires & <span className="font-serif italic font-normal text-[#00875A]">Manifestes Douaniers</span>
                </h2>
                <p className="text-sm text-zinc-600 font-medium mt-1">
                  Consultez les navires en cours, dépliez les BLs ou importez un nouveau manifeste XML GUCE ou PDF ALIS.
                </p>
              </div>

              {/* Action Buttons & Upload */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
                  <input
                    id="welcome-search-input"
                    type="text"
                    placeholder="Filtrer par navire, voyage..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-72 sm:w-80 h-12 pl-10 pr-3 text-xs sm:text-sm font-semibold rounded-xl bg-white border border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                {canManageEscales && (
                  <button
                    type="button"
                    onClick={handleOpenCreateEscale}
                    className="h-12 px-6 bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <PlusCircle className="w-4 h-4 text-white" />
                    <span className="text-white">Créer une Nouvelle Escale</span>
                  </button>
                )}

                {canImportGuce && (
                  <button
                    type="button"
                    onClick={() => {
                      const defaultEscale = selectedEscaleId || (escales.length > 0 ? escales[0].id : null);
                      if (defaultEscale) {
                        handleOpenUploadForEscale(defaultEscale);
                      } else {
                        handleOpenCreateEscale();
                      }
                    }}
                    className="h-12 px-5 bg-white hover:bg-zinc-50 text-[#005DAA] border border-[#005DAA]/40 font-black text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                    title="Charger des manifestes PDF sur une escale existante"
                  >
                    <Upload className="w-4 h-4 text-[#005DAA]" />
                    <span>Charger Manifeste PDF</span>
                  </button>
                )}
              </div>
            </div>

            {/* Escales Table */}
            <div className="ocean-glass-card rounded-3xl overflow-hidden shadow-sm border border-zinc-200 bg-white">
              <div className="overflow-x-auto">
                <table className="welcome-table w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-700 font-mono font-black uppercase tracking-wider text-xs">
                      <th className="px-8 py-5">Navire</th>
                      <th className="px-8 py-5">Voyage</th>
                      <th className="px-8 py-5">Indicatif</th>
                      <th className="px-8 py-5">Route Maritime</th>
                      <th className="px-8 py-5">Arrivée (ETA)</th>
                      <th className="px-8 py-5 text-center">Statut</th>
                      <th className="px-8 py-5 text-center">BLs Associés</th>
                      <th className="px-8 py-5 text-right">Manifeste PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-zinc-800 font-medium">
                    {filteredEscales.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-8 py-16 text-center text-zinc-500 font-bold text-base">
                          Aucune escale ne correspond à votre recherche.
                        </td>
                      </tr>
                    ) : (
                      filteredEscales.map(esc => {
                        const isExpanded = selectedEscaleId === esc.id;
                        const escBls = bls.filter(b => b.escaleId === esc.id);

                        return (
                          <React.Fragment key={esc.id}>
                            <tr
                              onClick={() => handleEscaleClick(esc.id)}
                              className={`cursor-pointer group transition-colors hover:bg-zinc-50 border-b border-zinc-100 ${isExpanded ? 'bg-[#F0F7FF]/60 border-l-4 border-[#005DAA]' : ''
                                }`}
                            >
                              <td className="px-8 py-5 font-black text-zinc-950">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditModal(esc);
                                  }}
                                  title="Cliquer pour modifier les informations du navire"
                                  className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 hover:border-[#005DAA] text-left transition-all group/navire cursor-pointer active:scale-95 shadow-xs"
                                >
                                  <div className="w-9 h-9 rounded-lg bg-[#005DAA]/10 border border-[#005DAA]/20 flex items-center justify-center text-[#005DAA] group-hover/navire:bg-[#005DAA] group-hover/navire:text-white transition-colors">
                                    <Ship className="w-4 h-4" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-black text-zinc-950 group-hover/navire:text-[#005DAA] transition-colors flex items-center gap-1.5">
                                      {esc.nomNavire}
                                      <Edit3 className="w-3.5 h-3.5 text-[#005DAA]" />
                                    </span>
                                    {esc.dateAccostage && (
                                      <span className="text-[11px] text-[#00875A] font-mono font-black">
                                        Accosté : {esc.dateAccostage}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </td>
                              <td className="px-8 py-5 font-mono font-black text-[#005DAA]">{esc.numeroVoyage}</td>
                              <td className="px-8 py-5 font-mono text-zinc-600 font-bold">{esc.callsign || 'N/A'}</td>
                              <td className="px-8 py-5 text-zinc-700 font-bold">
                                <span className="text-zinc-600">{esc.portChargement.split(' ')[0]}</span>
                                <span className="mx-2 text-[#005DAA] font-black">→</span>
                                <span className="font-black text-zinc-950">{esc.portDechargement.split(' ')[0]}</span>
                              </td>
                              <td className="px-8 py-5 text-zinc-900 font-mono font-black">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4 text-[#005DAA]" />
                                  <span>{esc.dateArrivee}</span>
                                </div>
                              </td>
                              <td className="px-8 py-5 text-center">
                                {esc.statut === 'EN_COURS' ? (
                                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>En Cours</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-200">
                                    <span>Clôturée</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-8 py-5 text-center">
                                <div className="flex justify-center items-center gap-1.5 text-sm font-black text-zinc-900">
                                  <span>{escBls.length} BLs</span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-[#005DAA]" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900" />
                                  )}
                                </div>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {escBls.length === 0 ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenUploadForEscale(esc.id);
                                        }}
                                        title={`Charger les fichiers PDF servant de manifeste pour l'escale ${esc.nomNavire} (Voyage ${esc.numeroVoyage})`}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
                                      >
                                        <Upload className="w-4 h-4 text-white" />
                                        <span>Charger Manifeste (PDF)</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          generateImportManifestPdf(esc, escBls);
                                        }}
                                        title="Générer un exemplaire officiel ou brouillon du manifeste"
                                        className="p-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200 transition-all cursor-pointer active:scale-95"
                                      >
                                        <FileText className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          generateImportManifestPdf(esc, escBls);
                                        }}
                                        title={`Générer et imprimer le Manifeste BOCS Abidjan officiel pour le navire ${esc.nomNavire}`}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#F0F7FF] text-[#005DAA] hover:text-[#004580] border border-[#005DAA]/30 hover:border-[#005DAA] font-black text-xs shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
                                      >
                                        <FileText className="w-4 h-4 text-[#005DAA]" />
                                        <span>Manifeste PDF</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenUploadForEscale(esc.id);
                                        }}
                                        title="Charger ou ajouter d'autres manifestes PDF à cette escale"
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F0F7FF] hover:bg-[#E1EFFF] text-[#005DAA] border border-[#005DAA]/30 font-black text-xs transition-all cursor-pointer active:scale-95 shrink-0"
                                      >
                                        <Upload className="w-3.5 h-3.5 text-[#005DAA]" />
                                        <span>+ Charger PDF</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Accordion list of BLs */}
                            {isExpanded && (
                              <tr className="bg-zinc-50/80 border-b border-zinc-200">
                                <td colSpan={8} className="px-8 py-8">
                                  <div className="space-y-5 animate-fade-in">

                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-200 pb-3.5">
                                      <div className="flex flex-wrap items-center gap-3 text-base font-black text-zinc-950">
                                        <div className="flex items-center gap-2">
                                          <MapPin className="w-5 h-5 text-[#005DAA]" />
                                          <span>Route : {esc.portChargement} → {esc.portDechargement}</span>
                                        </div>
                                        <span className="text-xs font-bold text-zinc-600 bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                                          <span>💡</span>
                                          <span>Cliquez sur une ligne pour modifier le BL ou sur "Factures &amp; Règlements" pour accéder à sa facturation</span>
                                        </span>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2.5">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenUploadForEscale(esc.id);
                                          }}
                                          className="px-4 py-2.5 bg-[#F0F7FF] hover:bg-[#E1EFFF] text-[#005DAA] border border-[#005DAA]/40 text-xs sm:text-sm font-black rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                                          title="Charger ou ajouter des manifestes PDF pour cette escale"
                                        >
                                          <Upload className="w-4 h-4 text-[#005DAA]" />
                                          <span>Charger Manifestes (PDF)</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            generateImportManifestPdf(esc, escBls);
                                          }}
                                          className="px-4 py-2.5 bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-300 hover:border-[#005DAA] text-xs sm:text-sm font-black rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                                          title="Imprimer ou télécharger le Manifeste officiel de cette escale"
                                        >
                                          <Printer className="w-4 h-4 text-[#005DAA]" />
                                          <span>Générer Manifeste PDF</span>
                                        </button>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onEnter('facturation');
                                          }}
                                          className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white text-xs sm:text-sm font-black rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                                        >
                                          <CreditCard className="w-4 h-4" />
                                          <span>Facturer cette Escale</span>
                                        </button>
                                      </div>
                                    </div>

                                    {escBls.length === 0 ? (
                                      <div className="bg-white border-2 border-dashed border-[#005DAA]/30 rounded-2xl p-8 text-center space-y-4 shadow-xs hover:border-[#005DAA] transition-colors">
                                        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F0F7FF] border border-[#005DAA]/25 flex items-center justify-center text-[#005DAA] shadow-xs">
                                          <Upload className="w-7 h-7 text-[#005DAA]" />
                                        </div>
                                        <div className="max-w-md mx-auto space-y-1.5">
                                          <h4 className="text-base font-black text-zinc-900">
                                            Aucun connaissement (BL) rattaché à {esc.nomNavire}
                                          </h4>
                                          <p className="text-xs text-zinc-500 font-medium">
                                            Cette escale a été créée sans connaissements. Chargez les fichiers PDF servant de manifeste (ALIS / BOCS) pour extraire et lier automatiquement l'ensemble des BLs et conteneurs.
                                          </p>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenUploadForEscale(esc.id);
                                            }}
                                            className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white text-xs sm:text-sm font-black rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
                                          >
                                            <Upload className="w-4 h-4" />
                                            <span>Charger les Fichiers PDF du Manifeste</span>
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
                                        <div className="overflow-x-auto max-h-[570px] overflow-y-auto welcome-scrollbar">
                                          <table className="w-full text-left border-collapse text-xs sm:text-sm">
                                            <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 z-10">
                                              <tr className="h-[52px] text-zinc-700 font-mono font-black uppercase tracking-wider text-xs">
                                                <th className="px-5 py-3">N° BL</th>
                                                <th className="px-5 py-3">Type Fret</th>
                                                <th className="px-5 py-3">Expéditeur (Shipper)</th>
                                                <th className="px-5 py-3">Destinataire (Consignee)</th>
                                                <th className="px-5 py-3">Description Marchandise</th>
                                                <th className="px-5 py-3 text-right">Colis</th>
                                                <th className="px-5 py-3 text-right">Poids Brut</th>
                                                <th className="px-5 py-3 text-center" title="Statut d'édition et règlement des factures. Cliquez pour ouvrir la facturation de ce BL.">Factures &amp; Règlements</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 text-zinc-800 font-medium">
                                              {escBls.map((bl) => {
                                                const stats = getBlInvoiceStats(bl);
                                                return (
                                                  <tr
                                                    key={bl.id}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEditingBl(bl);
                                                    }}
                                                    className="h-[57px] hover:bg-sky-50/50 transition-colors group cursor-pointer"
                                                    title="Cliquer pour corriger ce connaissement"
                                                  >
                                                    <td className="px-5 py-3 font-mono font-black text-zinc-950 group-hover:text-[#005DAA] transition-colors whitespace-nowrap">
                                                      <div className="flex items-center gap-1.5">
                                                        <span>{bl.numeroBL}</span>
                                                        <Edit3 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#005DAA] transition-opacity shrink-0" />
                                                      </div>
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap">
                                                      {bl.conteneurs && bl.conteneurs.length > 0 ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-black uppercase bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/20">
                                                          <Box className="w-3.5 h-3.5" />
                                                          <span>{bl.conteneurs.length} CTR</span>
                                                        </span>
                                                      ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                          <span>VRAC / RORO</span>
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="px-5 py-3 text-zinc-600 max-w-[286px] truncate font-medium" title={bl.shipperNom}>
                                                      {bl.shipperNom}
                                                    </td>
                                                    <td className="px-5 py-3 text-zinc-950 font-black max-w-[312px] truncate group-hover:text-[#005DAA] transition-colors" title={bl.consigneeNom}>
                                                      {bl.consigneeNom}
                                                    </td>
                                                    <td className="px-5 py-3 text-zinc-600 max-w-[364px] truncate text-xs font-medium" title={bl.descriptionGoods}>
                                                      {bl.descriptionGoods || 'Marchandises diverses'}
                                                    </td>
                                                    <td className="px-5 py-3 font-mono text-zinc-600 text-right whitespace-nowrap font-bold">
                                                      {bl.nombreColis} {bl.typeEmballage?.split(' ')[0] || 'Colis'}
                                                    </td>
                                                    <td className="px-5 py-3 font-mono font-black text-[#005DAA] text-right whitespace-nowrap">
                                                      {bl.poidsBrutKg?.toLocaleString('fr-FR')} Kg
                                                    </td>
                                                    <td
                                                      className="px-5 py-3 text-center whitespace-nowrap cursor-pointer hover:bg-[#F0F7FF] transition-all group/facture relative"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedBlForBillingModal(bl);
                                                      }}
                                                      title={`Ouvrir la Facturation Maritime & Règlements pour le BL ${bl.numeroBL}`}
                                                    >
                                                      <div className="inline-flex flex-col items-center gap-1 group-hover/facture:scale-105 transition-transform">
                                                        {/* 1. Statut Édition */}
                                                        {stats.isAllEditees ? (
                                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs group-hover/facture:bg-emerald-100 transition-colors">
                                                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                                            <span>{stats.nbEditees}/{stats.totalAEditer} Éditées (100%)</span>
                                                          </span>
                                                        ) : stats.nbEditees > 0 ? (
                                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs group-hover/facture:bg-amber-100 transition-colors">
                                                            <span className="material-symbols-outlined text-[13px]">pending</span>
                                                            <span>{stats.nbEditees}/{stats.totalAEditer} Éditées</span>
                                                          </span>
                                                        ) : (
                                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 group-hover/facture:bg-[#F0F7FF] group-hover/facture:text-[#005DAA] group-hover/facture:border-[#005DAA]/40 transition-colors shadow-2xs">
                                                            <span className="material-symbols-outlined text-[13px]">hourglass_empty</span>
                                                            <span>0/{stats.totalAEditer} À éditer</span>
                                                          </span>
                                                        )}

                                                        {/* 2. Statut Règlement */}
                                                        {stats.isAllReglees ? (
                                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 group-hover/facture:bg-emerald-200 transition-colors">
                                                            <span className="material-symbols-outlined text-[12px]">verified</span>
                                                            <span>Toutes réglées ({stats.nbReglees}/{stats.nbEditees})</span>
                                                          </span>
                                                        ) : stats.isPartiallyReglees ? (
                                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 group-hover/facture:bg-blue-100 transition-colors">
                                                            <span className="material-symbols-outlined text-[12px]">swap_horiz</span>
                                                            <span>Partiellement réglé ({stats.nbReglees}/{stats.nbEditees})</span>
                                                          </span>
                                                        ) : stats.nbEditees > 0 ? (
                                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 group-hover/facture:bg-rose-100 transition-colors">
                                                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                            <span>0/{stats.nbEditees} Réglé (Non payé)</span>
                                                          </span>
                                                        ) : (
                                                          <span className="text-[10px] text-zinc-400 group-hover/facture:text-[#005DAA] font-medium italic transition-colors">
                                                            En attente édition
                                                          </span>
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
                                    )}

                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            VIEW 3: CRÉATION D'UNE NOUVELLE ESCALE & IMPORTATION DES PDFS
        ══════════════════════════════════════════════════════════════════ */}
        {viewState === 'create-escale' && (
          <div className="w-full max-w-[2054px] space-y-8 animate-fade-in mx-auto">

            {/* Header bar */}
            <div className="ocean-glass-banner rounded-3xl p-7 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 border border-zinc-200 bg-white">
              <div>
                <button
                  type="button"
                  onClick={() => setViewState('escales')}
                  className="inline-flex items-center gap-2 text-xs font-black text-zinc-600 hover:text-[#005DAA] transition-colors cursor-pointer mb-2"
                >
                  <ArrowLeft className="w-4 h-4 text-[#005DAA]" />
                  <span>← Retour au Registre des Escales</span>
                </button>
                <div className="inline-flex items-center gap-2 text-xs font-black text-[#00875A] uppercase tracking-widest mb-1.5 ml-3">
                  <Ship className="w-4 h-4" />
                  <span>Nouvelle Entrée Navire</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 font-display">
                  Création d'Escale Portuaire & <span className="font-serif italic font-normal text-[#00875A]">Importation Manifestes PDF</span>
                </h2>
                <p className="text-sm text-zinc-600 font-medium mt-1">
                  Créez l'escale maritime pour votre navire à quai ou en rade, puis chargez les manifestes PDF dont les connaissements seront automatiquement rattachés.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewState('escales')}
                  className="px-5 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 hover:bg-zinc-100 font-bold text-xs transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSubmitNewEscaleWithBls as any}
                  className="px-6 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>{newEscaleBls.length > 0 ? `Valider l'Escale (+ ${newEscaleBls.length} BLs)` : "Valider l'Escale"}</span>
                </button>
              </div>
            </div>

            {/* Main Form Content in 2 Cards */}
            <form onSubmit={handleSubmitNewEscaleWithBls} className="space-y-6">

              {/* Card 1: Paramètres Officiels du Navire & de l'Escale */}
              <div className="ocean-glass-card rounded-3xl p-7 border border-zinc-200 bg-white shadow-sm space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-zinc-100">
                  <div className="w-10 h-10 rounded-xl bg-[#005DAA]/10 border border-[#005DAA]/25 text-[#005DAA] flex items-center justify-center font-bold">
                    <Ship className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-zinc-950">1. Paramètres Officiels du Navire & de l'Escale</h3>
                    <p className="text-xs text-zinc-500 font-medium">Renseignez le navire, le voyage et les détails d'accostage à Abidjan.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-black text-zinc-700 mb-1">Nom du Navire *</label>
                    <input
                      type="text"
                      required
                      placeholder="ex: BOCS BREMEN, WIKING..."
                      value={newEscaleForm.nomNavire}
                      onChange={(e) => setNewEscaleForm({ ...newEscaleForm, nomNavire: e.target.value })}
                      className="w-full h-11 px-3.5 text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-zinc-700 mb-1">Numéro de Voyage *</label>
                    <input
                      type="text"
                      required
                      placeholder="ex: 25586, 2132N..."
                      value={newEscaleForm.numeroVoyage}
                      onChange={(e) => setNewEscaleForm({ ...newEscaleForm, numeroVoyage: e.target.value })}
                      className="w-full h-11 px-3.5 text-sm font-mono font-black text-[#005DAA] bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-zinc-700 mb-1">Indicatif Radio (Callsign)</label>
                    <input
                      type="text"
                      placeholder="ex: CQRT, DJNY2..."
                      value={newEscaleForm.callsign}
                      onChange={(e) => setNewEscaleForm({ ...newEscaleForm, callsign: e.target.value })}
                      className="w-full h-11 px-3.5 text-sm font-mono font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-zinc-700 mb-1">Statut Initial</label>
                    <select
                      value={newEscaleForm.statut}
                      onChange={(e) => setNewEscaleForm({ ...newEscaleForm, statut: e.target.value as any })}
                      className="w-full h-11 px-3.5 text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA] cursor-pointer"
                    >
                      <option value="EN_COURS">🟢 EN COURS</option>
                      <option value="CLOTUREE">⚪ CLÔTURÉE</option>
                      <option value="ANNULEE">🔴 ANNULÉE</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="block text-xs font-black text-zinc-700 mb-1">Port de Déchargement</label>
                    <input
                      type="text"
                      value={newEscaleForm.portDechargement}
                      onChange={(e) => setNewEscaleForm({ ...newEscaleForm, portDechargement: e.target.value })}
                      className="w-full h-11 px-3.5 text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-zinc-700 mb-1">Date d'Arrivée (ETA) *</label>
                    <input
                      type="date"
                      required
                      value={newEscaleForm.dateArrivee}
                      onChange={(e) => setNewEscaleForm({ ...newEscaleForm, dateArrivee: e.target.value })}
                      className="w-full h-11 px-3.5 text-sm font-mono font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-zinc-700 mb-1">Date de Départ (ETD)</label>
                    <input
                      type="date"
                      value={newEscaleForm.dateDepart}
                      onChange={(e) => setNewEscaleForm({ ...newEscaleForm, dateDepart: e.target.value })}
                      className="w-full h-11 px-3.5 text-sm font-mono font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                    />
                  </div>
                </div>

                {/* Bouton Valider l'Escale Seule */}
                <div className="flex justify-end pt-3 border-t border-zinc-100 mt-2">
                  <button
                    type="submit"
                    className="px-7 py-3 bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-2.5 transition-all cursor-pointer active:scale-95"
                  >
                    <Check className="w-4 h-4 text-white" />
                    <span className="text-white">
                      {newEscaleBls.length > 0
                        ? `Valider l'Escale & Intégrer ${newEscaleBls.length} Connaissement(s) →`
                        : "Valider l'Escale Seule →"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Card 2: Importation des Manifestes PDF (Bouton d'importation des PDF) */}
              <div className="ocean-glass-card rounded-3xl p-7 border border-zinc-200 bg-white shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#005DAA]/10 border border-[#005DAA]/25 text-[#005DAA] flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-zinc-950">2. Importation des Manifestes PDF</h3>
                      <p className="text-xs text-zinc-500 font-medium">
                        Chargez un ou plusieurs manifestes PDF. Les connaissements seront automatiquement extraits et rattachés à cette escale.
                      </p>
                    </div>
                  </div>

                  <div>
                    <input
                      ref={newEscaleFileInputRef}
                      type="file"
                      multiple
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleProcessNewEscalePdfs(Array.from(e.target.files));
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsNewEscaleDragOver(true);
                  }}
                  onDragLeave={() => setIsNewEscaleDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsNewEscaleDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleProcessNewEscalePdfs(Array.from(e.dataTransfer.files));
                    }
                  }}
                  onClick={() => newEscaleFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${isNewEscaleDragOver
                      ? 'border-[#005DAA] bg-[#F0F7FF]/60 scale-[1.01]'
                      : 'border-zinc-300 hover:border-[#005DAA] bg-zinc-50/60 hover:bg-[#F0F7FF]/20'
                    }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#005DAA]/10 text-[#005DAA] mx-auto flex items-center justify-center mb-3 shadow-xs">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-zinc-900">
                    Glissez-déposez vos manifestes PDF ici, ou <span className="text-[#005DAA] underline">cliquez pour sélectionner</span>
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Sélectionnez un ou plusieurs fichiers à la fois ou successivement (BOCS, ALIS, CMA CGM, Grimaldi, Maersk...)
                  </p>
                </div>

                {/* Uploaded Files Pills */}
                {newEscaleFiles.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-zinc-700 tracking-wider">
                        Manifestes PDF chargés ({newEscaleFiles.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setNewEscaleFiles([]);
                          setNewEscaleBls([]);
                        }}
                        className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        Effacer tous les manifestes
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {newEscaleFiles.map((f, fIdx) => (
                        <span
                          key={fIdx}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-800 text-xs font-bold border border-zinc-200"
                        >
                          <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-mono">{f.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">({(f.size / 1024).toFixed(0)} Ko)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted BLs Table */}
                {newEscaleBls.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-black uppercase text-emerald-700 tracking-wider">
                          Connaissements Extraits ({newEscaleBls.length} BLs rattachés)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-zinc-500 font-bold bg-amber-50 text-amber-900 border border-amber-200/80 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
                          <span>💡</span>
                          <span>Cliquez sur une ligne pour ouvrir et faire des corrections</span>
                        </span>
                        <span className="text-xs font-bold text-zinc-500 font-mono whitespace-nowrap">
                          Total : {newEscaleBls.reduce((acc, b) => acc + (b.poidsBrutKg || 0), 0).toLocaleString('fr-FR')} Kg
                        </span>
                      </div>
                    </div>

                    <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                      <div className="overflow-x-auto max-h-[375px] overflow-y-auto welcome-scrollbar">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-mono font-black uppercase tracking-wider z-10">
                            <tr className="h-11">
                              <th className="px-5 py-3">N° BL</th>
                              <th className="px-5 py-3">Type</th>
                              <th className="px-5 py-3">Chargeur (Shipper)</th>
                              <th className="px-5 py-3">Destinataire (Consignee)</th>
                              <th className="px-5 py-3">Marchandise</th>
                              <th className="px-5 py-3 text-right">Poids Brut</th>
                              <th className="px-5 py-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 text-zinc-800 font-medium">
                            {newEscaleBls.map((bl) => (
                              <tr
                                key={bl.fileId}
                                onClick={() => setEditingNewEscaleBl(bl)}
                                className="h-12 hover:bg-sky-50/50 transition-colors cursor-pointer group"
                                title="Cliquer pour ouvrir et corriger ce connaissement"
                              >
                                <td className="px-5 py-2.5 font-mono font-black text-zinc-950 group-hover:text-[#005DAA] transition-colors whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span>{bl.numeroBL}</span>
                                    <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#005DAA] transition-opacity shrink-0" />
                                  </div>
                                </td>
                                <td className="px-5 py-2.5 whitespace-nowrap">
                                  {bl.conteneurs && bl.conteneurs.length > 0 ? (
                                    <span className="px-2.5 py-1 rounded text-[11px] font-black bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/20">
                                      {bl.conteneurs.length} CTR
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-zinc-100 text-zinc-700">
                                      {bl.typeMarchandise || 'VRAC'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-2.5 max-w-[234px] truncate" title={bl.shipperNom}>
                                  {bl.shipperNom || '—'}
                                </td>
                                <td className="px-5 py-2.5 max-w-[234px] truncate font-bold group-hover:text-zinc-950" title={bl.consigneeNom}>
                                  {bl.consigneeNom || '—'}
                                </td>
                                <td className="px-5 py-2.5 max-w-[260px] truncate text-zinc-600" title={bl.descriptionGoods}>
                                  {bl.descriptionGoods || '—'}
                                </td>
                                <td className="px-5 py-2.5 text-right font-mono font-bold whitespace-nowrap">
                                  {bl.poidsBrutKg ? `${bl.poidsBrutKg.toLocaleString('fr-FR')} Kg` : '—'}
                                </td>
                                <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditingNewEscaleBl(bl)}
                                      title="Ouvrir et corriger ce connaissement"
                                      className="p-1.5 rounded-lg bg-zinc-100 hover:bg-sky-100/80 text-zinc-600 hover:text-[#005DAA] transition-all cursor-pointer shadow-2xs"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveNewEscaleBl(bl.fileId)}
                                      title="Supprimer ce connaissement"
                                      className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Navigation Row */}
              <div className="flex items-center justify-start pt-2">
                <button
                  type="button"
                  onClick={() => setViewState('escales')}
                  className="px-6 py-3 rounded-2xl border border-zinc-300 text-zinc-700 hover:bg-zinc-100 font-bold text-xs sm:text-sm transition-all cursor-pointer"
                >
                  Annuler et Retourner au Registre
                </button>
              </div>

            </form>
          </div>
        )}

      </main>

      {/* ─── 3. MODAL ÉDITION NAVIRE & ESCALE (CLEAN LIGHT MODAL) ─── */}
      {editingEscale && (
        <div
          onClick={overlayClickClose(() => setEditingEscale(null))}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-fade-in"
        >
          <div className="welcome-dark-modal w-full max-w-xl bg-white border border-zinc-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-900">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#005DAA]/10 border border-[#005DAA]/20 flex items-center justify-center text-[#005DAA] shadow-xs">
                  <Ship className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-zinc-950 font-display">
                    Mise à Jour Navire & Escale
                  </h3>
                  <p className="text-xs text-zinc-500 font-bold">
                    {editingEscale.nomNavire} — Voyage {editingEscale.numeroVoyage}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingEscale(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEscale} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              {/* Section Manifeste & Connaissements PDF */}
              <div className="p-4 rounded-2xl bg-[#F0F7FF] border border-[#005DAA]/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#005DAA]" />
                    <span className="text-xs font-black uppercase tracking-wider text-[#005DAA]">
                      Manifeste &amp; Connaissements Associés
                    </span>
                  </div>
                  {bls.filter(b => b.escaleId === editingEscale.id).length === 0 ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      0 BL rattaché
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      {bls.filter(b => b.escaleId === editingEscale.id).length} BL(s) rattaché(s)
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-600 font-medium">
                  {bls.filter(b => b.escaleId === editingEscale.id).length === 0
                    ? "Aucun connaissement n'a encore été chargé pour cette escale. Vous pouvez charger les fichiers PDF servant de manifeste dès maintenant."
                    : "Vous pouvez charger des manifestes PDF complémentaires pour ajouter d'autres connaissements à cette escale."}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const escId = editingEscale.id;
                      setEditingEscale(null);
                      handleOpenUploadForEscale(escId);
                    }}
                    className="px-4 py-2 bg-[#005DAA] hover:bg-[#004580] text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Charger des Fichiers PDF servant de Manifeste</span>
                  </button>
                  {bls.filter(b => b.escaleId === editingEscale.id).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const escBls = bls.filter(b => b.escaleId === editingEscale.id);
                        generateImportManifestPdf(editingEscale, escBls);
                      }}
                      className="px-3 py-2 bg-white hover:bg-zinc-100 text-[#005DAA] border border-[#005DAA]/30 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Imprimer Manifeste BOCS</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div>
                  <label className="block text-xs font-black text-zinc-700 mb-1">
                    Nom du Navire *
                  </label>
                  <input
                    type="text"
                    required
                    value={escaleFormData.nomNavire || ''}
                    onChange={(e) => setEscaleFormData({ ...escaleFormData, nomNavire: e.target.value })}
                    className="w-full h-11 px-3.5 text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-700 mb-1">
                    Numéro de Voyage *
                  </label>
                  <input
                    type="text"
                    required
                    value={escaleFormData.numeroVoyage || ''}
                    onChange={(e) => setEscaleFormData({ ...escaleFormData, numeroVoyage: e.target.value })}
                    className="w-full h-11 px-3.5 text-sm font-mono font-black text-[#005DAA] bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-700 mb-1">
                    Indicatif Radio (Callsign)
                  </label>
                  <input
                    type="text"
                    value={escaleFormData.callsign || ''}
                    onChange={(e) => setEscaleFormData({ ...escaleFormData, callsign: e.target.value })}
                    placeholder="ex: 9V8974, CQRT..."
                    className="w-full h-11 px-3.5 text-sm font-mono font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-700 mb-1">
                    Statut de l'Escale
                  </label>
                  <select
                    value={escaleFormData.statut || 'EN_COURS'}
                    onChange={(e) => setEscaleFormData({ ...escaleFormData, statut: e.target.value as any })}
                    className="w-full h-11 px-3.5 text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                  >
                    <option value="EN_COURS">EN COURS (Active)</option>
                    <option value="CLOTUREE">CLÔTURÉE</option>
                    <option value="ANNULEE">ANNULÉE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-700 mb-1">
                    Date d'Arrivée (ETA) *
                  </label>
                  <input
                    type="date"
                    required
                    value={escaleFormData.dateArrivee || ''}
                    onChange={(e) => setEscaleFormData({ ...escaleFormData, dateArrivee: e.target.value })}
                    className="w-full h-11 px-3.5 text-sm font-mono font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-700 mb-1">
                    Date d'Accostage
                  </label>
                  <input
                    type="date"
                    value={escaleFormData.dateAccostage || ''}
                    onChange={(e) => setEscaleFormData({ ...escaleFormData, dateAccostage: e.target.value })}
                    className="w-full h-11 px-3.5 text-sm font-mono font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-700 mb-1">
                    Date de Départ (ETD)
                  </label>
                  <input
                    type="date"
                    value={escaleFormData.dateDepart || ''}
                    onChange={(e) => setEscaleFormData({ ...escaleFormData, dateDepart: e.target.value })}
                    className="w-full h-11 px-3.5 text-sm font-mono font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-700 mb-1">
                    Poste à Quai (Berth)
                  </label>
                  <input
                    type="text"
                    value={escaleFormData.quai || ''}
                    onChange={(e) => setEscaleFormData({ ...escaleFormData, quai: e.target.value })}
                    placeholder="ex: Quai 14, PAA..."
                    className="w-full h-11 px-3.5 text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-700 mb-1">
                    Port de Déchargement (POD)
                  </label>
                  <input
                    type="text"
                    value={escaleFormData.portDechargement || ''}
                    onChange={(e) => setEscaleFormData({ ...escaleFormData, portDechargement: e.target.value })}
                    className="w-full h-11 px-3.5 text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA]"
                  />
                </div>

              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setEditingEscale(null)}
                  className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#005DAA] hover:bg-[#004580] text-xs font-black text-white shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer les modifications</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 4. EXECUTIVE CLEAN LIGHT FOOTER ─── */}
      <footer className="w-full border-t border-zinc-200 bg-white text-xs text-zinc-500 py-4 z-20 relative shrink-0 shadow-xs">
        <div className="max-w-[2054px] mx-auto px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <span className="flex items-center gap-2 text-zinc-900 font-bold">
              <ShieldCheck className="w-4 h-4 text-[#00875A]" />
              <span>Conformité Douanière GUCE & DGI FNE (Côte d'Ivoire)</span>
            </span>
            <span className="hidden sm:flex items-center gap-1.5 text-zinc-600 font-medium">
              <Database className="w-3.5 h-3.5 text-[#005DAA]" />
              <span>PostgreSQL Neon Cloud Chiffré</span>
            </span>
            {hasPermission(permissionSubject, 'admin_rights_assign') && (
              <button
                type="button"
                onClick={() => onEnter('admin_rights')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all font-bold text-[11px] cursor-pointer hover:shadow-xs active:scale-95"
                title="Accéder directement à l'attribution des droits utilisateurs (Admin)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Attribution des Profils</span>
              </button>
            )}
          </div>
          <div className="text-center sm:text-right font-medium text-zinc-500">
            © {new Date().getFullYear()} BOCS CI Maritime Agency — Abidjan Port Operations. Tous droits réservés.
          </div>
        </div>
      </footer>

      {/* Modale d'Importation Multi-PDFs & Connaissements Incrémentale */}
      <MultiPdfImportModal
        isOpen={showMultiPdfModal}
        onClose={() => {
          setShowMultiPdfModal(false);
          setMultiPdfInitialFiles([]);
          setTargetUploadEscaleId(null);
        }}
        escales={escales}
        activeEscaleId={targetUploadEscaleId ?? selectedEscaleId ?? undefined}
        onCommitGroups={handleCommitMultiPdfGroups}
        initialFiles={multiPdfInitialFiles}
        onRequestCreateEscale={() => onEnter('import')}
      />

      {/* Modale d'édition et correction du connaissement sélectionné */}
      <ExtractedBlEditModal
        item={editingNewEscaleBl}
        isOpen={Boolean(editingNewEscaleBl)}
        onClose={() => setEditingNewEscaleBl(null)}
        onSave={handleSaveEditedBl}
      />

      {/* Modale d'édition et correction d'un BL existant du Registre */}
      <BlEditModal
        bl={editingBl}
        isOpen={Boolean(editingBl)}
        onClose={() => setEditingBl(null)}
        onSave={handleSaveBlRecord}
        onOpenBilling={(bl) => setSelectedBlForBillingModal(bl)}
        escaleInfo={(() => {
          if (!editingBl) return undefined;
          const targetEsc = escales.find(e => e.id === editingBl.escaleId);
          return targetEsc ? { nomNavire: targetEsc.nomNavire, numeroVoyage: targetEsc.numeroVoyage, callsign: targetEsc.callsign } : undefined;
        })()}
      />

      {/* Modale de Facturation Maritime & Règlements dédiée au BL */}
      <BlBillingModal
        bl={selectedBlForBillingModal}
        isOpen={Boolean(selectedBlForBillingModal)}
        onClose={() => setSelectedBlForBillingModal(null)}
        escales={escales}
        bls={bls}
        invoices={invoices}
        rubriqueConfigs={rubriqueConfigs}
        invoiceTypeConfigs={invoiceTypeConfigs}
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
  );
};
