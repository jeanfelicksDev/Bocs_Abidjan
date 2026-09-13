import React, { useState, useEffect } from 'react';
import { toastSuccess, toastInfo, toastWarning, toastError } from '../components/common/Toast';
import { DraftExport, Escale, User, UserRole, ContainerType, BL, Invoice } from '../types';
import { generateOriginalBlPdf, generateBocsExportBlLetterheadPdf, generateExportManifestPdf } from '../utils/pdfGenerator';
import { exportExportManifestCsv } from '../utils/exportCsv';
import { SignatureModal } from '../components/common/SignatureModal';
import { BOCS_BREMEN_25586_ESCALE } from '../utils/manifestParser';
import { 
  Lock, 
  Unlock, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  FileText, 
  Printer, 
  ArrowLeft, 
  Send, 
  Plus, 
  Download, 
  Edit3, 
  Trash2, 
  Eye, 
  Ship, 
  ShieldCheck, 
  DollarSign, 
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const PAYS_ONU = [
  "Afghanistan", "Afrique du Sud", "Albanie", "Algérie", "Allemagne", "Andorre", "Angola", 
  "Antigua-et-Barbuda", "Arabie saoudite", "Argentine", "Arménie", "Australie", "Autriche", 
  "Azerbaïdjan", "Bahamas", "Bahreïn", "Bangladesh", "Barbade", "Belgique", "Belize", 
  "Bénin", "Bhoutan", "Biélorussie", "Birmanie", "Bolivie", "Bosnie-Herzégovine", "Botswana", 
  "Brésil", "Brunéi", "Bulgarie", "Burkina Faso", "Burundi", "Cambodge", "Cameroun", 
  "Canada", "Cap-Vert", "Centrafrique", "Chili", "Chine", "Chypre", "Colombie", "Comores", 
  "Congo-Brazzaville", "Congo-Kinshasa", "Corée du Nord", "Corée du Sud", "Costa Rica", 
  "Côte d'Ivoire", "Croatie", "Cuba", "Danemark", "Djibouti", "Dominique", "Égypte", 
  "Émirats arabes unis", "Équateur", "Érythrée", "Espagne", "Estonie", "Eswatini", 
  "États-Unis", "Éthiopie", "Fidji", "Finlande", "France", "Gabon", "Gambie", "Géorgie", 
  "Ghana", "Grèce", "Grenade", "Guatemala", "Guinée", "Guinée équatoriale", "Guinée-Bissau", 
  "Guyana", "Haïti", "Honduras", "Hongrie", "Inde", "Indonésie", "Irak", "Iran", "Irlande", 
  "Islande", "Israël", "Italie", "Jamaïque", "Japon", "Jordanie", "Kazakhstan", "Kenya", 
  "Kirghizistan", "Kiribati", "Koweït", "Laos", "Lesotho", "Lettonie", "Liban", "Libéria", 
  "Libye", "Liechtenstein", "Lituanie", "Luxembourg", "Macédoine du Nord", "Madagascar", 
  "Malaisie", "Malawi", "Maldives", "Mali", "Malte", "Maroc", "Maurice", "Mauritanie", 
  "Mexique", "Micronésie", "Moldavie", "Monaco", "Mongolie", "Monténégro", "Mozambique", 
  "Namibie", "Nauru", "Népal", "Nicaragua", "Niger", "Nigéria", "Norvège", "Nouvelle-Zélande", 
  "Oman", "Ouganda", "Ouzbékistan", "Pakistan", "Palaos", "Palestine", "Panama", 
  "Papouasie-Nouvelle-Guinée", "Paraguay", "Pays-Bas", "Pérou", "Philippines", "Pologne", 
  "Portugal", "Qatar", "République centrafricaine", "République démocratique du Congo", 
  "République dominicaine", "République tchèque", "Roumanie", "Royaume-Uni", "Russie", 
  "Rwanda", "Saint-Christophe-et-Niévès", "Sainte-Lucie", "Saint-Marin", "Saint-Vincent-et-les-Grenadines", 
  "Salomon", "Samoa", "Sao Tomé-et-Principe", "Sénégal", "Serbie", "Seychelles", "Sierra Leone", 
  "Singapour", "Slovaquie", "Slovénie", "Somalie", "Soudan", "Soudan du Sud", "Sri Lanka", 
  "Suède", "Suisse", "Suriname", "Syrie", "Tadjikistan", "Taïwan", "Tanzanie", "Tchad", 
  "Thaïlande", "Timor oriental", "Togo", "Tonga", "Trinité-et-Tobago", "Tunisie", "Turkménistan", 
  "Turquie", "Tuvalu", "Ukraine", "Uruguay", "Vatican", "Venezuela", "Viêt Nam", "Yémen", 
  "Zambie", "Zimbabwe"
];

interface ExportModuleProps {
  initialSubTab?: 'CONSOLIDATION' | 'SAISIE_DRAFT' | 'ESPACE_CLIENT';
  drafts: DraftExport[];
  escales?: Escale[];
  currentUser: User;
  onAddDraft: (draft: DraftExport) => void;
  onUpdateDraft?: (updatedDraft: DraftExport) => void;
  onUpdateDraftStatus: (draftId: number, status: any, motif?: string, blNumber?: string) => void;
  onGenerateInvoice?: (invoice: any) => void;
  onLogAudit: (action: string, entite: string, details: string) => void;
  userRole: UserRole;
}

export const ExportModule: React.FC<ExportModuleProps> = ({
  initialSubTab,
  drafts,
  escales = [],
  currentUser,
  onAddDraft,
  onUpdateDraft,
  onUpdateDraftStatus,
  onGenerateInvoice = () => {},
  onLogAudit,
  userRole
}) => {
  // Navigation par sous-onglets : par défaut Espace Client pour un client export
  const [activeSubTab, setActiveSubTab] = useState<'CONSOLIDATION' | 'SAISIE_DRAFT' | 'ESPACE_CLIENT'>(() => {
    if (initialSubTab) return initialSubTab;
    return userRole === 'CLIENT_EXPORT' ? 'ESPACE_CLIENT' : 'ESPACE_CLIENT';
  });

  useEffect(() => {
    if (initialSubTab) setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  // Liste des escales disponibles (avec repli sur BOCS BREMEN si aucune escale enregistrée)
  const activeEscales: Escale[] = escales && escales.length > 0 ? escales : [
    BOCS_BREMEN_25586_ESCALE,
    {
      id: 1801,
      nomNavire: 'BOCS AFRICA',
      callsign: 'CQRX',
      numeroVoyage: '018V',
      portChargement: 'ABIDJAN (CIABJ)',
      portDechargement: 'ROTTERDAM (NLRTM)',
      dateArrivee: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0], // dans 3 jours (modifiable)
      statut: 'EN_COURS'
    },
    {
      id: 1902,
      nomNavire: 'GLEN CANYON',
      callsign: 'D5ZW3',
      numeroVoyage: '042V',
      portChargement: 'ABIDJAN (CIABJ)',
      portDechargement: 'BREMEN (DEBRE)',
      dateArrivee: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0], // hier (ETA passée, verrouillé)
      statut: 'EN_COURS'
    }
  ];

  // Escale sélectionnée pour le draft en cours et pour la consolidation
  const [selectedEscaleId, setSelectedEscaleId] = useState<number>(activeEscales[0]?.id || 25586);
  const selectedEscale = activeEscales.find(e => e.id === Number(selectedEscaleId)) || activeEscales[0];

  // État d'édition d'un draft existant
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);

  // Étapes du wizard de saisie
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Signature Modal state
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [targetForSignature, setTargetForSignature] = useState<DraftExport | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Modale de demande de correction (Client)
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [targetDraftForCorrection, setTargetDraftForCorrection] = useState<DraftExport | null>(null);
  const [motifCorrection, setMotifCorrection] = useState('');
  const [fraisAcceptes, setFraisAcceptes] = useState(false);

  // Modale de validation de demande de correction (Agent / Admin)
  const [agentApprovalModalOpen, setAgentApprovalModalOpen] = useState(false);
  const [targetDraftForApproval, setTargetDraftForApproval] = useState<DraftExport | null>(null);
  // Type de frais de correction : 'AGENCE' = 50 000 FCFA HT | 'AGENCE_DOUANE' = 75 000 FCFA HT
  const [correctionFeeType, setCorrectionFeeType] = useState<'AGENCE' | 'AGENCE_DOUANE'>('AGENCE');
  // Refus de la demande de correction
  const [refuseModalOpen, setRefuseModalOpen] = useState(false);
  const [refusalReason, setRefusalReason] = useState('');

  // Form State Step 1 (Routing & General Info)
  const [shipperNom, setShipperNom] = useState(currentUser.nomSociete || 'Agro Export SA');
  const [shipperAdresse, setShipperAdresse] = useState('Zone Industrielle Vridi, BP 128 Abidjan');
  const [shipperPays, setShipperPays] = useState('Côte d\'Ivoire');
  const [shipperEmail, setShipperEmail] = useState('');
  const [shipperPhone, setShipperPhone] = useState('');

  const [consigneeNom, setConsigneeNom] = useState('');
  const [consigneeAdresse, setConsigneeAdresse] = useState('');
  const [consigneePays, setConsigneePays] = useState('Belgique');
  const [consigneeEmail, setConsigneeEmail] = useState('');
  const [consigneePhone, setConsigneePhone] = useState('');

  const [notifyNom, setNotifyNom] = useState('');
  const [notifyAdresse, setNotifyAdresse] = useState('');
  const [notifyPays, setNotifyPays] = useState('Belgique');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyPhone, setNotifyPhone] = useState('');

  // Form State Step 2 (Cargo)
  const [marchandiseDesc, setMarchandiseDesc] = useState('');
  const [hsCode, setHsCode] = useState('1801.00.00');
  const [poidsBrutKg, setPoidsBrutKg] = useState<number>(50400);
  const [volumeM3, setVolumeM3] = useState<number>(68.5);
  const [nombreColis, setNombreColis] = useState<number>(800);
  const [typeEmballage, setTypeEmballage] = useState('SACS JUTE');

  // Form State Step 3 (Containers)
  const [containersList, setContainersList] = useState<Array<{
    numeroConteneur: string;
    typeConteneur: ContainerType;
    numeroScelle: string;
    poidsKg: number;
    poidsNetKg: number;
    volumeM3: number;
    tareKg: number;
    nombreColis: number;
  }>>([
    {
      numeroConteneur: 'BOCU-452109-1',
      typeConteneur: '20_DRY',
      numeroScelle: 'SC-CI-9981',
      poidsKg: 25200,
      poidsNetKg: 23000,
      volumeM3: 34.2,
      tareKg: 2200,
      nombreColis: 400
    },
    {
      numeroConteneur: 'BOCU-452110-5',
      typeConteneur: '20_DRY',
      numeroScelle: 'SC-CI-9982',
      poidsKg: 25200,
      poidsNetKg: 23000,
      volumeM3: 34.3,
      tareKg: 2200,
      nombreColis: 400
    }
  ]);

  const [newCtnNum, setNewCtnNum] = useState('');
  const [newCtnType, setNewCtnType] = useState<ContainerType>('20_DRY');
  const [newCtnScelle, setNewCtnScelle] = useState('');
  const [newCtnPoids, setNewCtnPoids] = useState<number>(25200);
  const [newCtnPoidsNet, setNewCtnPoidsNet] = useState<number>(23000);
  const [newCtnVolume, setNewCtnVolume] = useState<number>(34.2);

  // Helper pour calculer le statut et le verrouillage 24h avant ETA
  const getDraftDeadlineInfo = (draft: DraftExport, escale?: Escale) => {
    const targetEscale = escale || activeEscales.find(e => e.id === draft.escaleId || e.numeroVoyage === draft.numeroVoyage) || activeEscales[0];
    
    if (!targetEscale?.dateArrivee) {
      return {
        targetEscale,
        deadlineDate: null,
        isLocked: false,
        isPastDeadline: false,
        hoursRemaining: 999,
        badgeText: 'Délai non défini',
        badgeColor: 'bg-zinc-100 text-zinc-700 border-zinc-200'
      };
    }

    const eta = new Date(targetEscale.dateArrivee).getTime();
    // 24 heures avant l'ETA
    const deadline = eta - 24 * 3600 * 1000;
    const now = Date.now();
    const isPastDeadline = now >= deadline;
    const hoursRemaining = Math.round((deadline - now) / (1000 * 3600));

    // Si le draft est validé
    const isAlreadyValidated = draft.statut === 'VALIDE' || draft.statut === 'BL_GENERE';
    
    // Si l'agent a expressément déverrouillé le draft
    const isUnlockedByAgent = draft.estDeverrouille || draft.statut === 'CORRECTION_AUTORISEE';

    // Verrouillé si deadline dépassée ou statut verrouillé, hors déverrouillage agent et validation
    const isLocked = !isAlreadyValidated && !isUnlockedByAgent && draft.statut !== 'BROUILLON' && (isPastDeadline || draft.statut === 'VERROUILLE');

    let badgeText = '';
    let badgeColor = '';

    if (isAlreadyValidated) {
      badgeText = 'Validé (Connaissement BOCS émis)';
      badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-black';
    } else if (draft.statut === 'DEMANDE_CORRECTION') {
      badgeText = 'Demande de correction en attente (Frais 50 000 F)';
      badgeColor = 'bg-amber-50 text-amber-700 border-amber-300 font-bold';
    } else if (isUnlockedByAgent) {
      badgeText = 'Déverrouillé pour correction';
      badgeColor = 'bg-teal-50 text-teal-700 border-teal-300 font-bold animate-pulse';
    } else if (isLocked) {
      badgeText = 'Verrouillé (Délai 24h avant ETA dépassé)';
      badgeColor = 'bg-rose-50 text-rose-700 border-rose-300 font-bold';
    } else if (hoursRemaining > 0 && hoursRemaining <= 24) {
      badgeText = `${hoursRemaining}h restantes avant verrouillage`;
      badgeColor = 'bg-amber-50 text-amber-800 border-amber-400 font-bold';
    } else if (hoursRemaining > 24) {
      badgeText = `Délai respecté (${Math.round(hoursRemaining / 24)}j restants)`;
      badgeColor = 'bg-blue-50 text-blue-700 border-blue-300 font-bold';
    } else {
      badgeText = 'Verrouillé (ETA dépassée)';
      badgeColor = 'bg-rose-50 text-rose-700 border-rose-300 font-bold';
    }

    return {
      targetEscale,
      deadlineDate: new Date(deadline),
      isLocked,
      isPastDeadline,
      hoursRemaining,
      badgeText,
      badgeColor
    };
  };

  const handleAddContainer = () => {
    if (!newCtnNum) return;
    setContainersList(prev => [
      ...prev,
      {
        numeroConteneur: newCtnNum.toUpperCase(),
        typeConteneur: newCtnType,
        numeroScelle: newCtnScelle || `SC-CI-${Math.floor(1000 + Math.random() * 9000)}`,
        poidsKg: newCtnPoids,
        poidsNetKg: newCtnPoidsNet,
        volumeM3: newCtnVolume,
        tareKg: newCtnType.startsWith('40') ? 3800 : 2200,
        nombreColis: Math.round(newCtnPoids / 60)
      }
    ]);
    setNewCtnNum('');
    setNewCtnScelle('');
  };

  const handleRemoveContainer = (index: number) => {
    setContainersList(prev => prev.filter((_, i) => i !== index));
  };

  // Chargement d'un draft pour correction ou consultation
  const handleEditDraft = (draft: DraftExport) => {
    const deadlineInfo = getDraftDeadlineInfo(draft);
    if (deadlineInfo.isLocked) {
      toastError(`Ce draft est verrouillé. Veuillez soumettre une demande de correction.`);
      handleOpenCorrectionModal(draft);
      return;
    }

    setEditingDraftId(draft.id);
    setSelectedEscaleId(draft.escaleId || activeEscales[0].id);
    setShipperNom(draft.shipperInfo.nom);
    setShipperAdresse(draft.shipperInfo.adresse);
    setShipperPays(draft.shipperInfo.pays);
    setShipperEmail(draft.shipperInfo.email || '');
    setShipperPhone(draft.shipperInfo.phone || '');

    setConsigneeNom(draft.consigneeInfo.nom);
    setConsigneeAdresse(draft.consigneeInfo.adresse);
    setConsigneePays(draft.consigneeInfo.pays);
    setConsigneeEmail(draft.consigneeInfo.email || '');
    setConsigneePhone(draft.consigneeInfo.phone || '');

    setNotifyNom(draft.notifyInfo.nom || '');
    setNotifyAdresse(draft.notifyInfo.adresse || '');
    setNotifyPays(draft.notifyInfo.pays || 'Belgique');
    setNotifyEmail(draft.notifyInfo.email || '');
    setNotifyPhone(draft.notifyInfo.phone || '');

    setMarchandiseDesc(draft.marchandisesInfo.description);
    setHsCode(draft.marchandisesInfo.hsCode || '1801.00.00');
    setPoidsBrutKg(draft.marchandisesInfo.poidsBrutKg);
    setVolumeM3(draft.marchandisesInfo.volumeM3);
    setNombreColis(draft.marchandisesInfo.nombreColis);
    setTypeEmballage(draft.marchandisesInfo.typeEmballage);

    setContainersList(draft.conteneursInfo || []);

    setActiveSubTab('SAISIE_DRAFT');
    setStep(1);
    toastInfo(`Édition du draft ${draft.numeroDraft} ouverte.`);
  };

  const resetForm = () => {
    setEditingDraftId(null);
    setShipperNom(currentUser.nomSociete || 'Agro Export SA');
    setConsigneeNom('');
    setConsigneeAdresse('');
    setMarchandiseDesc('');
    setStep(1);
  };

  const getMissingFieldsStep1 = () => {
    const missing = [];
    if (!shipperNom) missing.push("Nom du Chargeur");
    if (!shipperAdresse) missing.push("Adresse complète du Chargeur");
    if (!shipperPays) missing.push("Pays du Chargeur");
    if (!consigneeNom) missing.push("Nom du Consignataire");
    if (!consigneeAdresse) missing.push("Adresse complète du Consignataire");
    return missing;
  };

  // Sauvegarde Brouillon
  const handleSaveDraftBrouillon = () => {
    const targetEscale = activeEscales.find(e => e.id === Number(selectedEscaleId)) || activeEscales[0];

    const draftData: DraftExport = {
      id: editingDraftId || Date.now(),
      clientId: currentUser.id,
      clientNom: currentUser.nomComplet,
      clientSociete: currentUser.nomSociete || 'Agro Export SA',
      escaleId: targetEscale.id,
      navireNom: targetEscale.nomNavire,
      numeroVoyage: targetEscale.numeroVoyage,
      portChargementCode: 'CIABJ',
      portDechargementNom: consigneePays,
      numeroDraft: editingDraftId ? (drafts.find(d => d.id === editingDraftId)?.numeroDraft || `BOCS-EXP-DRF-${Math.floor(1000 + Math.random() * 9000)}`) : `BOCS-EXP-DRF-${Math.floor(1000 + Math.random() * 9000)}`,
      bookingRef: `BKG-ABJ-${targetEscale.numeroVoyage}-${Math.floor(100 + Math.random() * 900)}`,
      shipperInfo: { nom: shipperNom, adresse: shipperAdresse, pays: shipperPays, email: shipperEmail, phone: shipperPhone },
      consigneeInfo: { nom: consigneeNom, adresse: consigneeAdresse, pays: consigneePays, email: consigneeEmail, phone: consigneePhone },
      notifyInfo: { nom: notifyNom || consigneeNom, adresse: notifyAdresse || consigneeAdresse, pays: notifyPays, email: notifyEmail, phone: notifyPhone },
      marchandisesInfo: {
        description: marchandiseDesc || 'MARCHANDISES AGRICOLES DIVERSES',
        poidsBrutKg: poidsBrutKg || 25000,
        volumeM3: volumeM3 || 33.2,
        nombreColis: nombreColis || 400,
        typeEmballage: typeEmballage || 'SACS JUTE',
        hsCode: hsCode || '1801.00.00'
      },
      conteneursInfo: containersList,
      statut: 'BROUILLON',
      dateCreation: new Date().toISOString().split('T')[0]
    };

    if (editingDraftId && onUpdateDraft) {
      onUpdateDraft(draftData);
    } else {
      onAddDraft(draftData);
    }

    onLogAudit('SAUVEGARDE_BROUILLON_DRAFT', 'DraftExport', `Brouillon sauvegardé: ${draftData.numeroDraft}`);
    toastSuccess(`Brouillon ${draftData.numeroDraft} enregistré.`);
    resetForm();
    setActiveSubTab('ESPACE_CLIENT');
  };

  // Soumission définitive du draft par le client
  const handleFinalSubmitDraft = () => {
    const missing = getMissingFieldsStep1();
    if (missing.length > 0) {
      setValidationErrors(missing);
      return;
    }

    if (!marchandiseDesc) {
      toastInfo('Veuillez renseigner la description des marchandises.');
      setStep(2);
      return;
    }

    const targetEscale = activeEscales.find(e => e.id === Number(selectedEscaleId)) || activeEscales[0];
    const eta = new Date(targetEscale.dateArrivee).getTime();
    const deadline = eta - 24 * 3600 * 1000;
    const isPastDeadline = Date.now() >= deadline;

    // Détermination du statut : si délai dépassé et pas déverrouillé, passe en VERROUILLE
    const initialStatus = isPastDeadline ? 'VERROUILLE' : 'SOUMIS';

    const draftData: DraftExport = {
      id: editingDraftId || Date.now(),
      clientId: currentUser.id,
      clientNom: currentUser.nomComplet,
      clientSociete: currentUser.nomSociete || 'Agro Export SA',
      escaleId: targetEscale.id,
      navireNom: targetEscale.nomNavire,
      numeroVoyage: targetEscale.numeroVoyage,
      portChargementCode: 'CIABJ',
      portDechargementNom: consigneePays,
      numeroDraft: editingDraftId ? (drafts.find(d => d.id === editingDraftId)?.numeroDraft || `BOCS-EXP-DRF-${Math.floor(1000 + Math.random() * 9000)}`) : `BOCS-EXP-DRF-${Math.floor(1000 + Math.random() * 9000)}`,
      bookingRef: `BKG-ABJ-${targetEscale.numeroVoyage}-${Math.floor(100 + Math.random() * 900)}`,
      shipperInfo: { nom: shipperNom, adresse: shipperAdresse, pays: shipperPays, email: shipperEmail, phone: shipperPhone },
      consigneeInfo: { nom: consigneeNom, adresse: consigneeAdresse, pays: consigneePays, email: consigneeEmail, phone: consigneePhone },
      notifyInfo: { nom: notifyNom || consigneeNom, adresse: notifyAdresse || consigneeAdresse, pays: notifyPays, email: notifyEmail, phone: notifyPhone },
      marchandisesInfo: {
        description: marchandiseDesc,
        poidsBrutKg: poidsBrutKg || 25000,
        volumeM3: volumeM3 || 33.2,
        nombreColis: nombreColis || 400,
        typeEmballage,
        hsCode
      },
      conteneursInfo: containersList,
      statut: initialStatus,
      estDeverrouille: false, // Dès soumission, le déverrouillage temporaire prend fin
      dateCreation: new Date().toISOString().split('T')[0]
    };

    if (editingDraftId && onUpdateDraft) {
      onUpdateDraft(draftData);
      toastSuccess(`Draft corrigé ${draftData.numeroDraft} retransmis à l'agent maritime.`);
    } else {
      onAddDraft(draftData);
      if (isPastDeadline) {
        toastWarning(`Attention : Le délai de 24h avant ETA étant dépassé, ce draft a été verrouillé. Une demande de correction sera requise pour le modifier.`);
      } else {
        toastSuccess(`Draft définitif ${draftData.numeroDraft} transmis avec succès (dans le délai imparti de 24h avant ETA).`);
      }
    }

    onLogAudit('SOUMISSION_DRAFT_EXPORT', 'DraftExport', `Soumission du draft ${draftData.numeroDraft} (${draftData.statut})`);
    resetForm();
    setActiveSubTab('ESPACE_CLIENT');
  };

  // Ouverture de la modale de demande de correction
  const handleOpenCorrectionModal = (draft: DraftExport) => {
    setTargetDraftForCorrection(draft);
    setMotifCorrection('');
    setFraisAcceptes(false);
    setCorrectionModalOpen(true);
  };

  // Confirmation de la demande de correction avec acceptation des frais
  const handleSubmitCorrectionRequest = () => {
    if (!targetDraftForCorrection) return;
    if (!motifCorrection.trim()) {
      toastError('Veuillez préciser le motif de la correction demandée.');
      return;
    }
    if (!fraisAcceptes) {
      toastError('Vous devez expressément accepter la facturation des frais d\'amendement (50 000 FCFA) pour soumettre.');
      return;
    }

    const updatedDraft: DraftExport = {
      ...targetDraftForCorrection,
      statut: 'DEMANDE_CORRECTION',
      demandeCorrection: {
        motif: motifCorrection,
        dateDemande: new Date().toISOString().replace('T', ' ').substring(0, 19),
        fraisAcceptes: true,
        montantFrais: 50000,
        statut: 'EN_ATTENTE'
      }
    };

    if (onUpdateDraft) onUpdateDraft(updatedDraft);
    else onUpdateDraftStatus(targetDraftForCorrection.id, 'DEMANDE_CORRECTION', motifCorrection);

    onLogAudit('DEMANDE_CORRECTION_DRAFT', 'DraftExport', `Demande d'amendement soumise pour ${targetDraftForCorrection.numeroDraft} par ${currentUser.nomComplet} (Frais 50 000 FCFA acceptés)`);
    toastSuccess(`Votre demande de correction pour le draft ${targetDraftForCorrection.numeroDraft} a été transmise à l'agent maritime BOCS.`);
    setCorrectionModalOpen(false);
  };

  // Approbation de la correction par l'Agent Export & déverrouillage
  const handleApproveCorrection = () => {
    if (!targetDraftForApproval) return;

    // Calcul des montants selon le type de frais choisi
    const isFraisDouane = correctionFeeType === 'AGENCE_DOUANE';
    const montantHt = isFraisDouane ? 75000 : 50000;  // 50 000 agence + 25 000 douane
    const tva = Math.round(montantHt * 0.18);
    const montantTtc = montantHt + tva;

    const updatedDraft: DraftExport = {
      ...targetDraftForApproval,
      statut: 'CORRECTION_AUTORISEE',
      estDeverrouille: true,
      fraisAmendementFactures: true,
      demandeCorrection: {
        ...targetDraftForApproval.demandeCorrection!,
        statut: 'ACCEPTEE',
        validePar: currentUser.nomComplet,
        dateValidation: new Date().toISOString().replace('T', ' ').substring(0, 19)
      }
    };

    if (onUpdateDraft) onUpdateDraft(updatedDraft);
    else onUpdateDraftStatus(targetDraftForApproval.id, 'CORRECTION_AUTORISEE');

    // Génération automatique de la facture de frais d'amendement rattachée au BL
    const invoiceNumber = `FA-AMD-${targetDraftForApproval.numeroVoyage || 'EXP'}-BOCS${String(Math.floor(100 + Math.random() * 900))}`;
    const lignesFacture: Array<{ id: number; typeFrais: 'AUTRE'; designation: string; quantite: number; prixUnitaireFcfa: number; montantHtFcfa: number; tauxTva: number }> = [
      {
        id: 1,
        typeFrais: 'AUTRE',
        designation: `Frais d'agence — amendement/révision BL Export après ETA (${targetDraftForApproval.numeroBlGenere || targetDraftForApproval.numeroDraft})`,
        quantite: 1,
        prixUnitaireFcfa: 50000,
        montantHtFcfa: 50000,
        tauxTva: 18
      }
    ];
    if (isFraisDouane) {
      lignesFacture.push({
        id: 2,
        typeFrais: 'AUTRE',
        designation: `Frais de douane — rectification déclaration export (${targetDraftForApproval.numeroBlGenere || targetDraftForApproval.numeroDraft})`,
        quantite: 1,
        prixUnitaireFcfa: 25000,
        montantHtFcfa: 25000,
        tauxTva: 18
      });
    }

    const invoice: Invoice = {
      id: Date.now(),
      numeroFacture: invoiceNumber,
      // Rattachement au BL généré
      numeroBL: targetDraftForApproval.numeroBlGenere || targetDraftForApproval.numeroDraft,
      clientNom: targetDraftForApproval.clientNom || targetDraftForApproval.shipperInfo.nom,
      clientId: targetDraftForApproval.clientId,
      dateFacture: new Date().toISOString().split('T')[0],
      dateEcheance: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      typeFacture: 'DEFINITIVE_EXPORT',
      statutFacture: 'VALIDEE',
      statutPaiement: 'NON_PAYE',
      devise: 'FCFA',
      tauxChangeUsd: 600,
      montantHtFcfa: montantHt,
      tvaFcfa: tva,
      montantTtcFcfa: montantTtc,
      soldeDuFcfa: montantTtc,
      escaleInfo: `${targetDraftForApproval.navireNom || 'NAVIRE'} V.${targetDraftForApproval.numeroVoyage || 'VOY'}`,
      invoiceTypeId: isFraisDouane ? 'RECTIF_AGENCE_DOUANE' : 'RECTIF_AGENCE',
      createdBy: currentUser.nomComplet,
      validatedBy: currentUser.nomComplet,
      validatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      lignes: lignesFacture
    };

    onGenerateInvoice(invoice);

    const typeLabel = isFraisDouane ? 'Frais Agence + Frais Douane (75 000 FCFA HT)' : 'Frais Agence (50 000 FCFA HT)';
    onLogAudit('APPROBATION_AMENDEMENT_DRAFT', 'DraftExport', `Approbation amendement ${targetDraftForApproval.numeroDraft} — Facture ${invoiceNumber} émise — ${typeLabel}`);
    toastSuccess(`Demande acceptée ! Draft déverrouillé. Facture ${invoiceNumber} (${typeLabel}) rattachée au BL ${targetDraftForApproval.numeroBlGenere || targetDraftForApproval.numeroDraft}.`);
    setAgentApprovalModalOpen(false);
    setCorrectionFeeType('AGENCE');
  };

  // Refus de la demande de correction par l'Agent Export
  const handleRefuseCorrection = () => {
    if (!targetDraftForApproval) return;
    if (!refusalReason.trim()) {
      toastError('Veuillez préciser le motif de refus.');
      return;
    }
    const updatedDraft: DraftExport = {
      ...targetDraftForApproval,
      statut: 'VERROUILLE',
      estDeverrouille: false,
      demandeCorrection: {
        ...targetDraftForApproval.demandeCorrection!,
        statut: 'REFUSEE',
        motifRefus: refusalReason,
        validePar: currentUser.nomComplet,
        dateValidation: new Date().toISOString().replace('T', ' ').substring(0, 19)
      }
    };
    if (onUpdateDraft) onUpdateDraft(updatedDraft);
    else onUpdateDraftStatus(targetDraftForApproval.id, 'VERROUILLE', refusalReason);
    onLogAudit('REFUS_AMENDEMENT_DRAFT', 'DraftExport', `Refus de la demande d'amendement ${targetDraftForApproval.numeroDraft} — Motif: ${refusalReason}`);
    toastWarning(`Demande de correction refusée pour ${targetDraftForApproval.numeroDraft}. Le draft reste verrouillé.`);
    setRefuseModalOpen(false);
    setAgentApprovalModalOpen(false);
    setRefusalReason('');
  };

  // Validation définitive du draft par l'Agent Export
  const handleValidateDraftByAgent = (draft: DraftExport) => {
    const blNum = `BOCS-EXP-${draft.numeroVoyage || '25586'}-${String(draft.id).slice(-3)}`;
    const updated: DraftExport = {
      ...draft,
      statut: 'VALIDE',
      numeroBlGenere: blNum,
      dateValidation: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    if (onUpdateDraft) onUpdateDraft(updated);
    else onUpdateDraftStatus(draft.id, 'VALIDE', undefined, blNum);

    onLogAudit('VALIDATION_BL_EXPORT', 'DraftExport', `Draft ${draft.numeroDraft} validé sous le numéro ${blNum}`);
    toastSuccess(`Connaissement BOCS émis : ${blNum}. Il est désormais disponible sur papier à en-tête et intégré au manifeste export.`);
  };

  // Impression Connaissement BOCS sur papier à en-tête
  const handlePrintBlLetterhead = (draft: DraftExport) => {
    const escale = activeEscales.find(e => e.id === draft.escaleId || e.numeroVoyage === draft.numeroVoyage);
    generateBocsExportBlLetterheadPdf(draft, escale, undefined, { withLetterheadHeader: true });
    onLogAudit('IMPRESSION_BL_PAPIER_ENTETE', 'BLOriginal', `Édition papier à en-tête du BL ${draft.numeroBlGenere || draft.numeroDraft}`);
  };

  // Filtrage des drafts selon le rôle connecté
  const displayedDrafts = drafts.filter(d => {
    if (userRole === 'CLIENT_EXPORT') {
      return d.clientId === currentUser.id || d.clientEmail === currentUser.email || d.shipperInfo.nom.toLowerCase().includes(currentUser.nomSociete?.toLowerCase() || 'agro');
    }
    return true;
  });

  // Liste des drafts validés pour l'escale sélectionnée dans l'onglet Manifeste
  const validatedDraftsForManifest = drafts.filter(d => {
    const isThisEscale = d.escaleId === selectedEscale.id || d.numeroVoyage === selectedEscale.numeroVoyage || d.navireNom === selectedEscale.nomNavire;
    return isThisEscale && (d.statut === 'VALIDE' || d.statut === 'BL_GENERE');
  });

  const totalColisManifest = validatedDraftsForManifest.reduce((acc, d) => acc + (d.marchandisesInfo.nombreColis || 0), 0);
  const totalWeightKgManifest = validatedDraftsForManifest.reduce((acc, d) => acc + (d.marchandisesInfo.poidsBrutKg || 0), 0);
  const totalContainersManifest = validatedDraftsForManifest.reduce((acc, d) => acc + (d.conteneursInfo?.length || 0), 0);
  const totalVolumeM3Manifest = validatedDraftsForManifest.reduce((acc, d) => acc + (d.marchandisesInfo.volumeM3 || 0), 0);

  // Demandes de correction en attente
  const pendingCorrections = drafts.filter(d => d.statut === 'DEMANDE_CORRECTION');

  return (
    <div className="space-y-6 animate-fade-in text-zinc-900">
      
      {/* ─── 1. TOP MODULE NAVIGATION BAR ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-zinc-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          
          <button
            onClick={() => setActiveSubTab('ESPACE_CLIENT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'ESPACE_CLIENT' 
                ? 'bg-[#005DAA] text-white shadow-xs font-black' 
                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">folder_shared</span>
            <span>Espace Client &amp; Historique</span>
            {displayedDrafts.length > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                activeSubTab === 'ESPACE_CLIENT' ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-800'
              }`}>
                {displayedDrafts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              resetForm();
              setActiveSubTab('SAISIE_DRAFT');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'SAISIE_DRAFT' 
                ? 'bg-[#005DAA] text-white shadow-xs font-black' 
                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">edit_note</span>
            <span>Saisie du Draft de BL</span>
          </button>

          <button
            onClick={() => setActiveSubTab('CONSOLIDATION')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'CONSOLIDATION' 
                ? 'bg-[#005DAA] text-white shadow-xs font-black' 
                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">inventory</span>
            <span>Manifeste Export (Consolidation)</span>
            {validatedDraftsForManifest.length > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                activeSubTab === 'CONSOLIDATION' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 font-black'
              }`}>
                {validatedDraftsForManifest.length} BLs
              </span>
            )}
          </button>

        </div>

        {/* Escale active info */}
        <div className="text-xs text-zinc-600 font-medium px-3 flex items-center gap-2">
          <Ship className="w-4 h-4 text-[#005DAA]" />
          <span>Escale : </span>
          <strong className="text-zinc-900 font-bold">{selectedEscale.nomNavire}</strong>
          <span className="text-[10px] bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200 font-mono">
            Voy. {selectedEscale.numeroVoyage} • ETA: {selectedEscale.dateArrivee}
          </span>
        </div>
      </div>

      {/* Alerte pour les agents s'il y a des demandes de correction */}
      {(userRole === 'AGENT_EXPORT' || userRole === 'ADMIN') && pendingCorrections.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex items-center justify-between gap-4 animate-fade-in shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-200 flex items-center justify-center text-amber-800">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-amber-900">
                {pendingCorrections.length} demande(s) de correction de draft après verrouillage en attente d'approbation
              </div>
              <div className="text-[11px] text-amber-800 font-medium">
                Les clients ont accepté la facturation forfaitaire des frais d'amendement de 50 000 FCFA HT.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveSubTab('ESPACE_CLIENT')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Examiner dans la liste
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ONGLET 1 : ESPACE CLIENT & HISTORIQUE DES DRAFTS
      ══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'ESPACE_CLIENT' && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden space-y-4 p-6">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-[#002B49] flex items-center gap-2">
                <span>Espace Export &amp; Suivi des Connaissements</span>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30">
                  {userRole === 'CLIENT_EXPORT' ? 'Accès Client Sécurisé' : 'Supervision Agent BOCS'}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                {userRole === 'CLIENT_EXPORT'
                  ? 'Consultez l\'état de vos drafts, respectez le délai de 24h avant ETA et téléchargez vos Connaissements BOCS sur papier à en-tête.'
                  : 'Gérez tous les drafts clients (brouillons, soumis, validés) et traitez les demandes de correction en attente.'}
              </p>
            </div>

            <button
              onClick={() => {
                resetForm();
                setActiveSubTab('SAISIE_DRAFT');
              }}
              className="bg-[#005DAA] hover:bg-[#004A88] text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Draft BL</span>
            </button>
          </div>

          {/* ─── PANNEAU DÉDIÉ AUX DEMANDES DE CORRECTION (AGENT / ADMIN UNIQUEMENT) ─── */}
          {(userRole === 'AGENT_EXPORT' || userRole === 'ADMIN') && pendingCorrections.length > 0 && (
            <div className="border border-amber-300 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3 border-b border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-black text-amber-900 uppercase tracking-wider">
                    {pendingCorrections.length} Demande(s) de Correction à Traiter
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                  Action requise
                </span>
              </div>
              <div className="divide-y divide-amber-100">
                {pendingCorrections.map(draft => (
                  <div key={`corr-${draft.id}`} className="px-5 py-3 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-[#005DAA] font-mono">{draft.numeroDraft}</span>
                        {draft.numeroBlGenere && (
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 rounded border border-emerald-300">
                            BL: {draft.numeroBlGenere}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          Demande en attente
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-700 font-bold">
                        {draft.clientNom} ({draft.clientSociete || draft.shipperInfo.nom})
                      </div>
                      <div className="text-[10px] text-zinc-500 font-medium italic">
                        Motif : "{draft.demandeCorrection?.motif || 'Non précisé'}"
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        Soumis le : {draft.demandeCorrection?.dateDemande || '-'} • Frais 50 000 FCFA acceptés
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setTargetDraftForApproval(draft);
                        setCorrectionFeeType('AGENCE');
                        setRefusalReason('');
                        setAgentApprovalModalOpen(true);
                      }}
                      className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Traiter la Demande</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rappel du délai contractuel */}
          <div className="p-3.5 bg-[#F0F7FF] rounded-xl border border-[#005DAA]/25 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-[#005DAA] shrink-0" />
              {userRole === 'CLIENT_EXPORT' ? (
                <span className="text-zinc-700 font-medium">
                  <strong>Règle d'or Export :</strong> Transmission impérative du draft définitif <strong>au moins 24h avant l'ETA</strong> du navire. Tout draft non validé après ce délai est automatiquement verrouillé et nécessite une demande formelle de correction.
                </span>
              ) : (
                <span className="text-zinc-700 font-medium">
                  <strong>Vue Agent :</strong> Tous les drafts clients sont listés ci-dessous (brouillons, soumis, verrouillés, validés). Les demandes de correction sont facturées : <strong>Frais d'agence 50 000 FCFA HT</strong> ou <strong>Frais d'agence + Frais douane 75 000 FCFA HT</strong>.
                </span>
              )}
            </div>
            <span className="text-[11px] font-black text-[#005DAA] shrink-0 font-mono">Délai : 24h avant ETA</span>
          </div>

          {/* Tableau des Drafts — titre selon le rôle */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black text-zinc-600 uppercase tracking-wider">
              {userRole === 'CLIENT_EXPORT' ? 'Mes Drafts & Connaissements' : `Tous les Drafts Clients (${displayedDrafts.length})`}
            </h3>
            {(userRole === 'AGENT_EXPORT' || userRole === 'ADMIN') && (
              <div className="flex gap-2 text-[10px]">
                {['BROUILLON','SOUMIS','VERROUILLE','DEMANDE_CORRECTION','CORRECTION_AUTORISEE','VALIDE','BL_GENERE'].map(s => {
                  const count = displayedDrafts.filter(d => d.statut === s).length;
                  return count > 0 ? (
                    <span key={s} className="px-2 py-0.5 rounded-full border font-bold bg-zinc-100 border-zinc-300 text-zinc-700">
                      {s === 'BROUILLON' ? 'Brouillons' : s === 'SOUMIS' ? 'Soumis' : s === 'VERROUILLE' ? 'Verrouillés' : s === 'DEMANDE_CORRECTION' ? 'Corrections' : s === 'CORRECTION_AUTORISEE' ? 'Déverrouillés' : s === 'VALIDE' ? 'Validés' : 'BL Générés'}: {count}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
          <div className="overflow-x-auto border border-zinc-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 text-[10px] font-black uppercase text-zinc-500 border-b border-zinc-200 tracking-wider">
                  <th className="p-3.5">N° Draft / BL</th>
                  <th className="p-3.5">Navire &amp; Escale</th>
                  <th className="p-3.5">Expéditeur &amp; Destinataire</th>
                  <th className="p-3.5">Cargaison (Poids &amp; Colis)</th>
                  <th className="p-3.5">Délai ETA &amp; Statut</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {displayedDrafts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-400">
                      <span className="material-symbols-outlined text-4xl block mb-2 text-zinc-300">folder_open</span>
                      <span>Aucun draft soumis pour le moment. Cliquez sur « Nouveau Draft BL » pour débuter.</span>
                    </td>
                  </tr>
                ) : (
                  displayedDrafts.map(draft => {
                    const escale = activeEscales.find(e => e.id === draft.escaleId || e.numeroVoyage === draft.numeroVoyage);
                    const deadlineInfo = getDraftDeadlineInfo(draft, escale);

                    return (
                      <tr key={draft.id} className="hover:bg-zinc-50 transition-colors">
                        
                        {/* Numéro Draft / BL */}
                        <td className="p-3.5 font-mono">
                          <div className="font-extrabold text-[#005DAA]">
                            {draft.numeroBlGenere || draft.numeroDraft}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            Réf: {draft.bookingRef || 'BKG-ABJ'}
                          </div>
                          {draft.numeroBlGenere && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-300 mt-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              BL Original
                            </span>
                          )}
                        </td>

                        {/* Escale & Navire */}
                        <td className="p-3.5">
                          <div className="font-extrabold text-zinc-900 flex items-center gap-1">
                            <Ship className="w-3.5 h-3.5 text-[#005DAA]" />
                            <span>{draft.navireNom || escale?.nomNavire || 'BOCS BREMEN'}</span>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            Voy. {draft.numeroVoyage || escale?.numeroVoyage || '25586'}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            POD : <strong>{draft.portDechargementNom || draft.portDechargementCode || 'ANVERS'}</strong>
                          </div>
                        </td>

                        {/* Expéditeur & Destinataire */}
                        <td className="p-3.5">
                          <div className="font-bold text-zinc-900">{draft.shipperInfo.nom}</div>
                          <div className="text-[10px] text-zinc-500 truncate max-w-[180px]">
                            &rarr; {draft.consigneeInfo.nom} ({draft.consigneeInfo.pays})
                          </div>
                        </td>

                        {/* Cargaison */}
                        <td className="p-3.5 font-mono">
                          <div className="font-extrabold text-zinc-900">
                            {draft.marchandisesInfo.poidsBrutKg.toLocaleString('fr-FR')} KG
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {draft.marchandisesInfo.nombreColis} {draft.marchandisesInfo.typeEmballage}
                          </div>
                          <div className="text-[10px] text-[#00875A] font-bold">
                            {draft.conteneursInfo?.length || 0} conteneur(s)
                          </div>
                        </td>

                        {/* Statut & Délai ETA */}
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${deadlineInfo.badgeColor}`}>
                              {deadlineInfo.isLocked ? <Lock className="w-3 h-3 text-rose-600" /> : <Clock className="w-3 h-3" />}
                              <span>{deadlineInfo.badgeText}</span>
                            </span>
                            <div className="text-[9px] text-zinc-400 font-mono">
                              ETA : {escale?.dateArrivee || 'Non définie'}
                            </div>
                          </div>
                        </td>

                        {/* Actions contextuelles */}
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            
                            {/* 1. Si validé : Édition BL BOCS sur papier à en-tête */}
                            {(draft.statut === 'VALIDE' || draft.statut === 'BL_GENERE') && (
                              <button
                                onClick={() => handlePrintBlLetterhead(draft)}
                                className="px-3 py-1.5 bg-[#002B49] hover:bg-[#001D33] text-white font-extrabold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                                title="Éditer le BL BOCS officiel formaté pour papier à en-tête"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>BL Papier Entête</span>
                              </button>
                            )}

                            {/* 2. Si le draft est verrouillé (délai dépassé) : Demande de correction (Client) */}
                            {deadlineInfo.isLocked && draft.statut !== 'DEMANDE_CORRECTION' && (
                              <button
                                onClick={() => handleOpenCorrectionModal(draft)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-extrabold text-xs rounded-xl inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                title="Délai 24h ETA expiré. Cliquez pour soumettre une demande formelle d'amendement (50 000 FCFA HT)"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Demander Correction</span>
                              </button>
                            )}

                            {/* 3. Si demande de correction en attente et Agent/Admin : Examiner */}
                            {draft.statut === 'DEMANDE_CORRECTION' && (userRole === 'AGENT_EXPORT' || userRole === 'ADMIN') && (
                              <button
                                onClick={() => {
                                  setTargetDraftForApproval(draft);
                                  setCorrectionFeeType('AGENCE');
                                  setRefusalReason('');
                                  setAgentApprovalModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Traiter Amendement</span>
                              </button>
                            )}

                            {/* 4. Si déverrouillé pour correction ou modifiable dans les délais : Modifier */}
                            {(!deadlineInfo.isLocked || draft.statut === 'CORRECTION_AUTORISEE') && draft.statut !== 'VALIDE' && draft.statut !== 'BL_GENERE' && (
                              <button
                                onClick={() => handleEditDraft(draft)}
                                className="px-3 py-1.5 bg-zinc-100 hover:bg-[#F0F7FF] text-zinc-800 hover:text-[#005DAA] border border-zinc-200 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{draft.statut === 'CORRECTION_AUTORISEE' ? 'Corriger le Draft' : 'Modifier'}</span>
                              </button>
                            )}

                            {/* 5. Si Agent/Admin et draft soumis ou brouillon : Valider en BL officiel */}
                            {(userRole === 'AGENT_EXPORT' || userRole === 'ADMIN') && (draft.statut === 'SOUMIS' || draft.statut === 'BROUILLON') && (
                              <button
                                onClick={() => handleValidateDraftByAgent(draft)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Valider en BL</span>
                              </button>
                            )}

                            {/* 6. Badge de statut lisible pour les drafts sans action disponible */}
                            {draft.statut === 'DEMANDE_CORRECTION' && userRole === 'CLIENT_EXPORT' && (
                              <span className="px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-800 font-bold text-xs rounded-xl inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                <span>En cours d'examen</span>
                              </span>
                            )}

                            {/* 7. Badge correction refusée (CLIENT voit le motif) */}
                            {draft.statut === 'VERROUILLE' && draft.demandeCorrection?.statut === 'REFUSEE' && userRole === 'CLIENT_EXPORT' && (
                              <span className="px-3 py-1.5 bg-rose-50 border border-rose-300 text-rose-700 font-bold text-xs rounded-xl inline-flex items-center gap-1.5" title={`Motif: ${draft.demandeCorrection.motifRefus}`}>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Correction Refusée</span>
                              </span>
                            )}

                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ONGLET 2 : SAISIE / ÉDITION DU DRAFT DE BL (WIZARD EN 4 ÉTAPES)
      ══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'SAISIE_DRAFT' && (
        <div className="space-y-6">
          
          {/* Header Banner Saisie */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
            <div>
              <h1 className="text-2xl font-black text-[#002B49] mb-1 tracking-tight flex items-center gap-2">
                <span>{editingDraftId ? 'Édition & Correction du Draft BL' : 'Saisie du Draft de BL Export'}</span>
                {editingDraftId && (
                  <span className="text-xs bg-teal-100 text-teal-800 font-extrabold px-2.5 py-0.5 rounded-full border border-teal-300">
                    Mode Correction Ouvert
                  </span>
                )}
              </h1>
              <p className="text-xs text-zinc-500 font-medium">
                Renseignez avec exactitude les parties, conteneurs et cargaison. Le draft sera verrouillé à 24h avant l'ETA.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraftBrouillon}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-800 font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                Sauvegarder Brouillon
              </button>
              <button
                type="button"
                onClick={handleFinalSubmitDraft}
                className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004A88] text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>{editingDraftId ? 'Transmettre le Draft Corrigé' : 'Transmettre le Draft'}</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bandeau de Sélection d'Escale & Calcul Délais ETA */}
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Escale Maritime BOCS Rattachée <span className="text-rose-600">*</span>
              </label>
              <select
                value={selectedEscaleId}
                onChange={e => setSelectedEscaleId(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA] cursor-pointer"
              >
                {activeEscales.map(esc => (
                  <option key={esc.id} value={esc.id}>
                    {esc.nomNavire} — Voy. {esc.numeroVoyage} (ETA: {esc.dateArrivee})
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-white rounded-xl border border-zinc-200 flex flex-col justify-center">
              <div className="text-[10px] text-zinc-500 font-bold uppercase">Date d'Arrivée Navire (ETA)</div>
              <div className="text-sm font-black text-[#002B49] font-mono mt-0.5">
                {selectedEscale.dateArrivee}
              </div>
              <div className="text-[10px] text-zinc-500">Port de chargement : Quai Vridi, Abidjan</div>
            </div>

            <div className="p-3 bg-[#F0F7FF] rounded-xl border border-[#005DAA]/30 flex flex-col justify-center">
              <div className="text-[10px] text-[#005DAA] font-black uppercase flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Délai Limite de Transmission (24h avant ETA)</span>
              </div>
              <div className="text-sm font-black text-[#002B49] font-mono mt-0.5">
                {new Date(new Date(selectedEscale.dateArrivee).getTime() - 24 * 3600 * 1000).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <div className="text-[10px] text-emerald-700 font-bold">
                Passé ce délai, le draft sera verrouillé et soumis à facturation d'amendement.
              </div>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-6">
            
            <div className="relative flex justify-between w-full max-w-3xl mx-auto py-2">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-200 rounded-full -z-0"></div>
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#005DAA] rounded-full transition-all duration-300 -z-0"
                style={{ width: `${((step - 1) / 3) * 100}%` }}
              ></div>

              {/* Step 1 */}
              <button 
                onClick={() => setStep(1)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shadow-xs border-2 transition-all ${
                  step >= 1 ? 'bg-[#005DAA] text-white border-white ring-4 ring-[#005DAA]/20' : 'bg-zinc-100 text-zinc-400 border-zinc-300'
                }`}>
                  1
                </div>
                <span className={`text-xs font-bold ${step === 1 ? 'text-[#005DAA]' : 'text-zinc-500'}`}>
                  Infos Générales
                </span>
              </button>

              {/* Step 2 */}
              <button 
                onClick={() => setStep(2)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shadow-xs border-2 transition-all ${
                  step >= 2 ? 'bg-[#005DAA] text-white border-white ring-4 ring-[#005DAA]/20' : 'bg-zinc-100 text-zinc-400 border-zinc-300'
                }`}>
                  2
                </div>
                <span className={`text-xs font-bold ${step === 2 ? 'text-[#005DAA]' : 'text-zinc-500'}`}>
                  Détails Cargaison
                </span>
              </button>

              {/* Step 3 */}
              <button 
                onClick={() => setStep(3)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shadow-xs border-2 transition-all ${
                  step >= 3 ? 'bg-[#005DAA] text-white border-white ring-4 ring-[#005DAA]/20' : 'bg-zinc-100 text-zinc-400 border-zinc-300'
                }`}>
                  3
                </div>
                <span className={`text-xs font-bold ${step === 3 ? 'text-[#005DAA]' : 'text-zinc-500'}`}>
                  Conteneurs &amp; Plombs
                </span>
              </button>

              {/* Step 4 */}
              <button 
                onClick={() => setStep(4)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shadow-xs border-2 transition-all ${
                  step >= 4 ? 'bg-[#005DAA] text-white border-white ring-4 ring-[#005DAA]/20' : 'bg-zinc-100 text-zinc-400 border-zinc-300'
                }`}>
                  4
                </div>
                <span className={`text-xs font-bold ${step === 4 ? 'text-[#005DAA]' : 'text-zinc-500'}`}>
                  Résumé &amp; Soumission
                </span>
              </button>
            </div>

            {/* CONTENU DU FORMULAIRE */}
            <div className="pt-4 border-t border-zinc-200">
              
              {/* ÉTAPE 1: ROUTING & PARTIES */}
              {step === 1 && (
                <div className="space-y-6 text-xs animate-fade-in">
                  <h3 className="font-black text-sm text-[#002B49] border-b border-zinc-200 pb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#005DAA]">info</span>
                    <span>Informations Générales &amp; Parties au Connaissement</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Chargeur */}
                    <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
                      <span className="font-black text-zinc-900 uppercase text-xs tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#005DAA] text-base">person</span>
                        <span>Chargeur (Shipper)</span>
                      </span>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Nom / Raison Sociale <span className="text-rose-600 font-bold">*</span></label>
                        <input
                          type="text"
                          required
                          value={shipperNom}
                          onChange={e => setShipperNom(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Adresse Complète <span className="text-rose-600 font-bold">*</span></label>
                        <textarea
                          required
                          value={shipperAdresse}
                          onChange={e => setShipperAdresse(e.target.value)}
                          className="w-full min-h-[72px] p-2.5 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA] resize-y"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Pays Expéditeur <span className="text-rose-600 font-bold">*</span></label>
                        <select
                          required
                          value={shipperPays}
                          onChange={e => setShipperPays(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 cursor-pointer focus:outline-none focus:border-[#005DAA]"
                        >
                          {PAYS_ONU.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Téléphone de contact</label>
                        <input
                          type="text"
                          value={shipperPhone}
                          onChange={e => setShipperPhone(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                          placeholder="+225 27 21 35 44 00"
                        />
                      </div>
                    </div>

                    {/* Consignataire / Destinataire */}
                    <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
                      <span className="font-black text-zinc-900 uppercase text-xs tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#005DAA] text-base">domain</span>
                        <span>Destinataire (Consignee)</span>
                      </span>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Nom / Ordre de... <span className="text-rose-600 font-bold">*</span></label>
                        <input
                          type="text"
                          required
                          value={consigneeNom}
                          onChange={e => setConsigneeNom(e.target.value)}
                          placeholder="Chocolaterie Belge De Gand NV"
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Adresse Complète <span className="text-rose-600 font-bold">*</span></label>
                        <textarea
                          required
                          value={consigneeAdresse}
                          onChange={e => setConsigneeAdresse(e.target.value)}
                          placeholder="Havenlaan 42, 9000 Gent"
                          className="w-full min-h-[72px] p-2.5 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA] resize-y"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Pays Destination <span className="text-rose-600 font-bold">*</span></label>
                        <select
                          required
                          value={consigneePays}
                          onChange={e => setConsigneePays(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 cursor-pointer focus:outline-none focus:border-[#005DAA]"
                        >
                          {PAYS_ONU.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Email Destinataire</label>
                        <input
                          type="email"
                          value={consigneeEmail}
                          onChange={e => setConsigneeEmail(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                          placeholder="import@chocogand.be"
                        />
                      </div>
                    </div>

                    {/* Notify Party */}
                    <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
                      <span className="font-black text-zinc-900 uppercase text-xs tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#005DAA] text-base">notifications</span>
                        <span>Partie à Notifier (Notify)</span>
                      </span>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Nom Notify (ou SAME AS CONSIGNEE)</label>
                        <input
                          type="text"
                          value={notifyNom}
                          onChange={e => setNotifyNom(e.target.value)}
                          placeholder="Antwerp Maritime Logistics SA"
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Adresse Complète</label>
                        <textarea
                          value={notifyAdresse}
                          onChange={e => setNotifyAdresse(e.target.value)}
                          placeholder="Kaai 174, 2030 Antwerpen"
                          className="w-full min-h-[72px] p-2.5 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA] resize-y"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Pays</label>
                        <select
                          value={notifyPays}
                          onChange={e => setNotifyPays(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 cursor-pointer focus:outline-none focus:border-[#005DAA]"
                        >
                          {PAYS_ONU.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Email Notify</label>
                        <input
                          type="email"
                          value={notifyEmail}
                          onChange={e => setNotifyEmail(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                          placeholder="ops@amlogistics.be"
                        />
                      </div>
                    </div>

                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-6 py-2.5 bg-[#005DAA] hover:bg-[#004A88] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span>Suivant : Détails Cargaison</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2: DÉTAILS CARGAISON */}
              {step === 2 && (
                <div className="space-y-6 text-xs animate-fade-in">
                  <h3 className="font-black text-sm text-[#002B49] border-b border-zinc-200 pb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#005DAA]">inventory_2</span>
                    <span>Détails &amp; Nature de la Cargaison</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">
                          Description des Marchandises (B/L Goods Description) <span className="text-rose-600 font-bold">*</span>
                        </label>
                        <textarea
                          value={marchandiseDesc}
                          onChange={e => setMarchandiseDesc(e.target.value)}
                          rows={4}
                          placeholder="Ex: FÈVES DE CACAO DE CÔTE D'IVOIRE EN SACS JUTE - GRADE I - CONTRAT N° CI-BE-994"
                          className="w-full p-3 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA] resize-y"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Code SH / Douanier (Harmonized System)</label>
                        <input
                          type="text"
                          value={hsCode}
                          onChange={e => setHsCode(e.target.value)}
                          placeholder="1801.00.00"
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Poids Brut Total (KG)</label>
                        <input
                          type="number"
                          value={poidsBrutKg}
                          onChange={e => setPoidsBrutKg(parseFloat(e.target.value) || 0)}
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Volume Total (M³)</label>
                        <input
                          type="number"
                          value={volumeM3}
                          onChange={e => setVolumeM3(parseFloat(e.target.value) || 0)}
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Nombre Total Colis</label>
                        <input
                          type="number"
                          value={nombreColis}
                          onChange={e => setNombreColis(parseInt(e.target.value) || 0)}
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-800 mb-1">Type d'Emballage</label>
                        <select
                          value={typeEmballage}
                          onChange={e => setTypeEmballage(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                        >
                          <option value="SACS JUTE">SACS JUTE</option>
                          <option value="CARTONS">CARTONS</option>
                          <option value="FUTS">FÛTS</option>
                          <option value="PALETTES">PALETTES</option>
                          <option value="BIG BAGS">BIG BAGS</option>
                          <option value="VRAC">VRAC</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs cursor-pointer border border-zinc-300"
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-6 py-2.5 bg-[#005DAA] hover:bg-[#004A88] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span>Suivant : Conteneurs &amp; Plombs</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 3: CONTENEURS & PLOMBS */}
              {step === 3 && (
                <div className="space-y-6 text-xs animate-fade-in">
                  <h3 className="font-black text-sm text-[#002B49] border-b border-zinc-200 pb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#005DAA]">view_in_ar</span>
                    <span>Inventaire des Conteneurs &amp; Numéros de Plombs (Scellés)</span>
                  </h3>

                  {/* Formulaire ajout conteneur */}
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">N° Conteneur</label>
                      <input
                        type="text"
                        value={newCtnNum}
                        onChange={e => setNewCtnNum(e.target.value.toUpperCase())}
                        placeholder="BOCU-123456-7"
                        className="w-full h-9 px-2.5 rounded-xl bg-white border border-zinc-300 font-mono text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">Type</label>
                      <select
                        value={newCtnType}
                        onChange={e => setNewCtnType(e.target.value as ContainerType)}
                        className="w-full h-9 px-2 rounded-xl bg-white border border-zinc-300 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                      >
                        <option value="20_DRY">20' Dry</option>
                        <option value="40_DRY">40' Dry</option>
                        <option value="40_HC">40' High Cube</option>
                        <option value="20_REEFER">20' Reefer</option>
                        <option value="40_REEFER">40' Reefer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">Plomb / Scellé</label>
                      <input
                        type="text"
                        value={newCtnScelle}
                        onChange={e => setNewCtnScelle(e.target.value)}
                        placeholder="SC-CI-1001"
                        className="w-full h-9 px-2.5 rounded-xl bg-white border border-zinc-300 font-mono text-xs text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">Poids Brut (kg)</label>
                      <input
                        type="number"
                        value={newCtnPoids}
                        onChange={e => setNewCtnPoids(parseFloat(e.target.value) || 0)}
                        className="w-full h-9 px-2.5 rounded-xl bg-white border border-zinc-300 font-mono text-xs text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">Poids Net (kg)</label>
                      <input
                        type="number"
                        value={newCtnPoidsNet}
                        onChange={e => setNewCtnPoidsNet(parseFloat(e.target.value) || 0)}
                        className="w-full h-9 px-2.5 rounded-xl bg-white border border-zinc-300 font-mono text-xs text-zinc-900 focus:outline-none focus:border-[#005DAA]"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleAddContainer}
                        className="w-full h-9 bg-[#005DAA] hover:bg-[#004A88] text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  </div>

                  {/* Tableau des conteneurs ajoutés */}
                  <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50 text-[10px] font-black uppercase text-zinc-500 border-b border-zinc-200">
                        <tr>
                          <th className="p-3">N° Conteneur</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">N° Plomb / Scellé</th>
                          <th className="p-3 text-right">Poids Brut (VGM)</th>
                          <th className="p-3 text-right">Poids Net</th>
                          <th className="p-3 text-right">Volume</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 font-medium">
                        {containersList.map((ctn, i) => (
                          <tr key={i} className="hover:bg-zinc-50">
                            <td className="p-3 font-mono font-bold text-[#005DAA]">{ctn.numeroConteneur}</td>
                            <td className="p-3 font-semibold">{ctn.typeConteneur}</td>
                            <td className="p-3 font-mono text-zinc-600">{ctn.numeroScelle}</td>
                            <td className="p-3 font-mono font-bold text-right text-zinc-900">{ctn.poidsKg.toLocaleString('fr-FR')} kg</td>
                            <td className="p-3 font-mono text-right text-zinc-600">{ctn.poidsNetKg ? `${ctn.poidsNetKg.toLocaleString('fr-FR')} kg` : '-'}</td>
                            <td className="p-3 font-mono text-right text-zinc-600">{ctn.volumeM3 ? `${ctn.volumeM3} m³` : '-'}</td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveContainer(i)}
                                className="text-rose-600 hover:text-rose-800 text-xs font-bold cursor-pointer"
                              >
                                Supprimer
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs cursor-pointer border border-zinc-300"
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="px-6 py-2.5 bg-[#005DAA] hover:bg-[#004A88] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span>Suivant : Résumé &amp; Soumission</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 4: RÉSUMÉ & SOUMISSION */}
              {step === 4 && (
                <div className="space-y-6 text-xs animate-fade-in">
                  <h3 className="font-black text-sm text-[#002B49] border-b border-zinc-200 pb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600">verified</span>
                    <span>Résumé Final &amp; Transmission du Connaissement</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                      <span className="font-bold text-zinc-900 uppercase text-[10px] block border-b border-zinc-200 pb-1">
                        Routing Maritime &amp; Escale
                      </span>
                      <p><strong>Navire &amp; Voyage :</strong> {selectedEscale.nomNavire} - Voy. {selectedEscale.numeroVoyage}</p>
                      <p><strong>Port de Chargement :</strong> ABIDJAN (Quai Vridi)</p>
                      <p><strong>Port de Déchargement :</strong> {consigneePays}</p>
                      <p><strong>Chargeur :</strong> {shipperNom} ({shipperPays})</p>
                      <p><strong>Destinataire :</strong> {consigneeNom} ({consigneePays})</p>
                    </div>

                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                      <span className="font-bold text-zinc-900 uppercase text-[10px] block border-b border-zinc-200 pb-1">
                        Cargaison &amp; Conteneurs
                      </span>
                      <p><strong>Marchandise :</strong> {marchandiseDesc}</p>
                      <p><strong>Code SH :</strong> {hsCode} | <strong>Colis :</strong> {nombreColis} {typeEmballage}</p>
                      <p><strong>Poids Brut Total :</strong> {(poidsBrutKg / 1000).toFixed(3)} Tonnes ({poidsBrutKg.toLocaleString('fr-FR')} KG)</p>
                      <p><strong>Volume Total :</strong> {volumeM3} M³</p>
                      <p><strong>Nombre de conteneurs :</strong> {containersList.length} unité(s)</p>
                    </div>
                  </div>

                  {/* Avertissement deadline 24h */}
                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-black text-emerald-900 text-sm">Prêt pour la transmission à l'agence BOCS</h4>
                      <p className="text-emerald-800 text-xs mt-0.5">
                        Délai de transmission respecté (24h avant ETA). Ce draft sera transmis directement à l'Agent Export pour validation.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleFinalSubmitDraft}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 whitespace-nowrap"
                    >
                      <Send className="w-4 h-4" />
                      <span>Transmettre le Draft</span>
                    </button>
                  </div>

                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs cursor-pointer border border-zinc-300"
                    >
                      Retour aux conteneurs
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ONGLET 3 : MANIFESTE EXPORT (CONSOLIDATION DE L'ESCALE)
      ══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'CONSOLIDATION' && (
        <div className="space-y-6">
          
          {/* Header Consolidation */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
            <div>
              <h1 className="text-2xl font-black text-[#002B49] tracking-tight mb-1">
                Manifeste Export — Consolidation de l'Escale
              </h1>
              <p className="text-xs text-zinc-500 font-medium">
                Consolidation automatique de tous les connaissements (BLs) validés par l'agent pour l'escale sélectionnée.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              
              {/* Choix de l'escale */}
              <select
                value={selectedEscaleId}
                onChange={e => setSelectedEscaleId(Number(e.target.value))}
                className="px-3.5 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-extrabold text-zinc-900 focus:outline-none focus:border-[#005DAA] cursor-pointer"
              >
                {activeEscales.map(esc => (
                  <option key={esc.id} value={esc.id}>
                    {esc.nomNavire} - Voy {esc.numeroVoyage} (ETA: {esc.dateArrivee})
                  </option>
                ))}
              </select>

              {/* Bouton Générer PDF Manifeste */}
              <button
                onClick={() => {
                  if (validatedDraftsForManifest.length === 0) {
                    toastWarning('Aucun BL validé pour cette escale. Veuillez valider au moins un draft pour générer le manifeste.');
                    return;
                  }
                  generateExportManifestPdf(selectedEscale, validatedDraftsForManifest);
                  onLogAudit('GENERATION_MANIFESTE_EXPORT', 'ManifesteExport', `Génération du manifeste export PDF pour l'escale ${selectedEscale.nomNavire} Voy ${selectedEscale.numeroVoyage}`);
                }}
                className="bg-[#002B49] hover:bg-[#001D33] text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Générer Manifeste (PDF)</span>
              </button>

              {/* Bouton Exporter CSV */}
              <button
                onClick={() => {
                  if (validatedDraftsForManifest.length === 0) {
                    toastWarning('Aucun BL validé pour cette escale.');
                    return;
                  }
                  exportExportManifestCsv(validatedDraftsForManifest, selectedEscale.nomNavire);
                }}
                className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-800 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>

            </div>
          </div>

          {/* KPI Bento Grid — Données réelles consolidées */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">BLs Validés</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#005DAA] flex items-center justify-center font-black">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-[#002B49] font-mono">
                {validatedDraftsForManifest.length}
              </div>
              <div className="text-[10px] text-zinc-400 mt-1">Connaissements consolidés</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">Conteneurs (TEU)</span>
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-base">view_in_ar</span>
                </div>
              </div>
              <div className="text-3xl font-black text-teal-700 font-mono">
                {totalContainersManifest}
              </div>
              <div className="text-[10px] text-zinc-400 mt-1">Unités conteneurisées</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">Poids Brut Total</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-base">scale</span>
                </div>
              </div>
              <div className="text-3xl font-black text-emerald-700 font-mono">
                {(totalWeightKgManifest / 1000).toFixed(1)} <span className="text-sm font-sans font-bold">Tonnes</span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-1">{totalWeightKgManifest.toLocaleString('fr-FR')} KG bruts</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">Volume Total</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-base">grid_view</span>
                </div>
              </div>
              <div className="text-3xl font-black text-purple-700 font-mono">
                {totalVolumeM3Manifest > 0 ? totalVolumeM3Manifest.toFixed(1) : '-'} <span className="text-sm font-sans font-bold">M³</span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-1">{totalColisManifest.toLocaleString('fr-FR')} colis au manifeste</div>
            </div>

          </div>

          {/* Tableau de Consolidation */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black text-[#002B49] uppercase tracking-wider">
                  Registre des Connaissements au Manifeste Export — {selectedEscale.nomNavire} Voy {selectedEscale.numeroVoyage}
                </h3>
                <p className="text-[10px] text-zinc-500 font-medium">Seuls les drafts validés par l'agent constituent le manifeste officiel.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-100 text-[10px] font-black uppercase text-zinc-600 border-b border-zinc-200">
                    <th className="p-3">N° B/L BOCS</th>
                    <th className="p-3">Chargeur (Shipper)</th>
                    <th className="p-3">Destinataire (Consignee)</th>
                    <th className="p-3">Destination</th>
                    <th className="p-3">Désignation Marchandises</th>
                    <th className="p-3 text-center">Conteneurs</th>
                    <th className="p-3 text-right">Poids Brut (KG)</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-medium">
                  {validatedDraftsForManifest.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-zinc-400">
                        <span className="material-symbols-outlined text-4xl block mb-2 text-zinc-300">inventory_2</span>
                        <span>Aucun BL validé pour cette escale. Les drafts doivent être validés par l'agent pour être consolidés dans le manifeste.</span>
                      </td>
                    </tr>
                  ) : (
                    validatedDraftsForManifest.map((draft, idx) => (
                      <tr key={draft.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="p-3 font-mono font-extrabold text-[#005DAA]">
                          {draft.numeroBlGenere || draft.numeroDraft}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-zinc-900">{draft.shipperInfo.nom}</div>
                          <div className="text-[10px] text-zinc-500">{draft.shipperInfo.pays}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-zinc-900">{draft.consigneeInfo.nom}</div>
                          <div className="text-[10px] text-zinc-500">{draft.consigneeInfo.pays}</div>
                        </td>
                        <td className="p-3 font-bold text-emerald-800">
                          {draft.portDechargementNom || draft.portDechargementCode || 'EUROPE'}
                        </td>
                        <td className="p-3 max-w-[220px]">
                          <div className="truncate font-medium text-zinc-900">{draft.marchandisesInfo.description}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">SH: {draft.marchandisesInfo.hsCode || '-'}</div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-[#002B49]">
                          {draft.conteneursInfo?.length || 0}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-zinc-900">
                          {draft.marchandisesInfo.poidsBrutKg.toLocaleString('fr-FR')}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handlePrintBlLetterhead(draft)}
                            className="p-1.5 text-[#005DAA] hover:bg-[#F0F7FF] rounded-lg border border-transparent hover:border-[#005DAA]/30 transition-all cursor-pointer"
                            title="Imprimer ce BL sur papier à en-tête"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALE 1 : DEMANDE DE CORRECTION APRÈS VERROUILLAGE (CLIENT)
      ══════════════════════════════════════════════════════════════════ */}
      {correctionModalOpen && targetDraftForCorrection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200 overflow-hidden animate-scale-in">
            
            <div className="bg-gradient-to-r from-rose-50 to-amber-50 p-5 border-b border-rose-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-zinc-900">
                  Demande de Déverrouillage &amp; Correction de Draft
                </h3>
                <p className="text-[11px] text-zinc-600 font-medium">
                  Draft {targetDraftForCorrection.numeroDraft} • Délai 24h avant ETA dépassé
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              
              {/* Notice Réglementaire & Frais */}
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-1.5">
                <div className="font-extrabold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Conditions de modification après ETA (Agence BOCS)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Conformément aux procédures maritimes et douanières, le connaissement est verrouillé pour sécuriser le manifeste. Toute réouverture nécessite l'approbation de l'agent consignataire et donne lieu à une facturation forfaitaire d'amendement :
                </p>
                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200 font-mono font-bold text-amber-950">
                  <span>Frais Forfaitaires d'Amendement BL :</span>
                  <span className="text-sm font-black text-rose-700">50 000 FCFA HT</span>
                </div>
              </div>

              {/* Champ Motif de la correction */}
              <div>
                <label className="block text-xs font-bold text-zinc-800 mb-1">
                  Motif détaillé de la correction demandée <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={motifCorrection}
                  onChange={e => setMotifCorrection(e.target.value)}
                  rows={3}
                  placeholder="Ex: Rectification du nom du destinataire suite à avenant commercial, correction du numéro de scellé conteneur..."
                  className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-300 text-xs font-medium text-zinc-900 focus:outline-none focus:border-[#005DAA] resize-y"
                  required
                />
              </div>

              {/* Case à cocher obligatoire d'acceptation de facturation */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={fraisAcceptes}
                  onChange={e => setFraisAcceptes(e.target.checked)}
                  className="w-4 h-4 text-[#005DAA] rounded mt-0.5 cursor-pointer"
                />
                <span className="text-[11px] text-zinc-800 font-bold leading-tight select-none">
                  J'accepte expressément la facturation des frais d'amendement de <strong>50 000 FCFA HT</strong> qui seront portés sur une facture de régularisation BOCS.
                </span>
              </label>

            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCorrectionModalOpen(false)}
                className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 font-bold text-xs rounded-xl hover:bg-zinc-100 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmitCorrectionRequest}
                disabled={!fraisAcceptes || !motifCorrection.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirmer &amp; Transmettre la Demande</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALE 2 : TRAITEMENT DE LA DEMANDE DE CORRECTION (AGENT / ADMIN)
      ══════════════════════════════════════════════════════════════════ */}
      {agentApprovalModalOpen && targetDraftForApproval && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-zinc-200 overflow-hidden animate-scale-in">
            
            <div className="bg-[#002B49] text-white p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0 font-black">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white">
                  Traitement Demande d'Amendement BL Export
                </h3>
                <p className="text-[11px] text-zinc-300 font-medium">
                  Draft {targetDraftForApproval.numeroDraft}{targetDraftForApproval.numeroBlGenere ? ` → BL ${targetDraftForApproval.numeroBlGenere}` : ''} • Client : {targetDraftForApproval.clientNom}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              
              {/* Résumé du motif client */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                <div className="text-[10px] uppercase font-bold text-zinc-500">Motif transmis par le client :</div>
                <div className="text-zinc-900 font-bold italic bg-white p-2.5 rounded-lg border border-zinc-200">
                  "{targetDraftForApproval.demandeCorrection?.motif}"
                </div>
                <div className="text-[10px] text-zinc-500 font-mono mt-1">
                  Demandé le : {targetDraftForApproval.demandeCorrection?.dateDemande} • Frais acceptés par le client
                </div>
              </div>

              {/* Choix du type de facturation */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase font-black text-zinc-600 tracking-wider">Type de facturation de rectification :</div>
                
                <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  correctionFeeType === 'AGENCE' ? 'border-[#005DAA] bg-[#F0F7FF]' : 'border-zinc-200 bg-white hover:bg-zinc-50'
                }`}>
                  <input
                    type="radio"
                    name="correctionFeeType"
                    checked={correctionFeeType === 'AGENCE'}
                    onChange={() => setCorrectionFeeType('AGENCE')}
                    className="mt-0.5 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="font-black text-zinc-900">Frais d'agence uniquement</div>
                    <div className="text-[11px] text-zinc-600 font-medium">Frais de gestion agence BOCS pour révision/amendement du BL</div>
                    <div className="font-mono font-black text-[#005DAA] mt-1">50 000 FCFA HT + TVA 18% = 59 000 FCFA TTC</div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  correctionFeeType === 'AGENCE_DOUANE' ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 bg-white hover:bg-zinc-50'
                }`}>
                  <input
                    type="radio"
                    name="correctionFeeType"
                    checked={correctionFeeType === 'AGENCE_DOUANE'}
                    onChange={() => setCorrectionFeeType('AGENCE_DOUANE')}
                    className="mt-0.5 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="font-black text-zinc-900">Frais d'agence + Frais de douane</div>
                    <div className="text-[11px] text-zinc-600 font-medium">Révision BL en agence (50 000) + Rectification déclaration douane (25 000)</div>
                    <div className="font-mono font-black text-amber-700 mt-1">75 000 FCFA HT + TVA 18% = 88 500 FCFA TTC</div>
                  </div>
                </label>
              </div>

              {/* Récapitulatif */}
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-black text-emerald-900 text-xs">Facture de rectification à émettre :</div>
                  <div className="text-[11px] text-emerald-800">Rattachée au BL {targetDraftForApproval.numeroBlGenere || targetDraftForApproval.numeroDraft}</div>
                </div>
                <span className="text-sm font-black font-mono text-emerald-800 bg-white px-3 py-1.5 rounded-lg border border-emerald-300">
                  {correctionFeeType === 'AGENCE_DOUANE' ? '75 000 FCFA HT' : '50 000 FCFA HT'}
                </span>
              </div>

              <p className="text-[11px] text-zinc-600 leading-relaxed">
                En acceptant :
                <br />• Le draft est immédiatement <strong>déverrouillé</strong> pour le client.
                <br />• Une <strong>facture de rectification</strong> ({correctionFeeType === 'AGENCE_DOUANE' ? 'Frais agence + Frais douane' : 'Frais d\'agence'}) est émise automatiquement et rattachée au BL.
              </p>

            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAgentApprovalModalOpen(false)}
                  className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 font-bold text-xs rounded-xl hover:bg-zinc-100 transition-all cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRefuseModalOpen(true);
                    setRefusalReason('');
                  }}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Refuser la Demande</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleApproveCorrection}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Accepter &amp; Déverrouiller</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALE 3 : REFUS DE LA DEMANDE DE CORRECTION (AGENT / ADMIN)
      ══════════════════════════════════════════════════════════════════ */}
      {refuseModalOpen && targetDraftForApproval && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-300 overflow-hidden animate-scale-in">
            <div className="bg-rose-600 text-white p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm">Refus de la Demande de Correction</h3>
                <p className="text-[11px] text-rose-200">{targetDraftForApproval.numeroDraft} • {targetDraftForApproval.clientNom}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-700 font-medium leading-relaxed">
                En refusant cette demande, le draft restera <strong>verrouillé</strong>. Le client sera informé du motif de refus et pourra soumettre une nouvelle demande si nécessaire.
              </p>
              <div>
                <label className="block text-xs font-bold text-zinc-800 mb-1">
                  Motif de refus <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={refusalReason}
                  onChange={e => setRefusalReason(e.target.value)}
                  rows={3}
                  placeholder="Ex: Demande incomplète, document justificatif manquant, informations insuffisantes..."
                  className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-300 text-xs font-medium text-zinc-900 focus:outline-none focus:border-rose-500 resize-y"
                />
              </div>
            </div>
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefuseModalOpen(false)}
                className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 font-bold text-xs rounded-xl hover:bg-zinc-100 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRefuseCorrection}
                disabled={!refusalReason.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Confirmer le Refus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal Component */}
      {targetForSignature && (
        <SignatureModal
          isOpen={signModalOpen}
          onClose={() => setSignModalOpen(false)}
          targetBlOrDraft={targetForSignature}
          onSignComplete={(draftId, signatureUrl) => {
            handleValidateDraftByAgent(targetForSignature);
            setSignModalOpen(false);
          }}
        />
      )}

      {/* Validation Errors Modal */}
      {validationErrors.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-300 overflow-hidden animate-scale-in">
            <div className="bg-rose-50 p-5 border-b border-rose-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-200 text-rose-800 flex items-center justify-center font-bold">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Champs obligatoires manquants</h3>
                <p className="text-[11px] text-rose-700 font-medium">Veuillez compléter les informations requises</p>
              </div>
            </div>
            
            <div className="p-5 max-h-[300px] overflow-y-auto space-y-2">
              <ul className="space-y-1.5 pl-5 list-disc text-zinc-800 text-xs font-bold">
                {validationErrors.map((err, idx) => (
                  <li key={idx} className="text-rose-700">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setValidationErrors([])}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
