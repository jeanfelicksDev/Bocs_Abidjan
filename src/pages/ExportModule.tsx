import React, { useState, useEffect, useMemo } from 'react';
import { toastSuccess, toastInfo, toastWarning, toastError } from '../components/common/Toast';
import { DraftExport, DraftStatus, Escale, User, UserRole, ContainerType, BL, Invoice } from '../types';
import { isDraftOwnedByUser, filterDraftsForUser } from '../utils/draftOwnership';
import { generateOriginalBlPdf, generateBocsExportBlLetterheadPdf, generateExportManifestPdf } from '../utils/pdfGenerator';
import { exportExportManifestCsv } from '../utils/exportCsv';
import { SignatureModal } from '../components/common/SignatureModal';
import { useEscapeClose, overlayClickClose } from '../hooks/useEscapeClose';
import { getDraftDiff, getDraftFieldColor, snapshotContenuDraft, isDraftEnPeriodeCorrection } from '../utils/draftDiff';
import { validateContainerNumber, formatIsoContainerNumber } from '../utils/containerValidator';
import { useEscales, useDrafts } from '../hooks/useData';
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
  AlertCircle,
  Search,
  X
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
  currentUser: User;
  onAddDraft: (draft: DraftExport) => void;
  onUpdateDraft?: (updatedDraft: DraftExport) => void;
  onUpdateDraftStatus: (draftId: number, status: any, motif?: string, blNumber?: string) => void;
  onDeleteDraft?: (draftId: number) => void;
  onGenerateInvoice?: (invoice: any) => void;
  onLogAudit: (action: string, entite: string, details: string) => void;
  userRole: UserRole;
}

export const ExportModule: React.FC<ExportModuleProps> = ({
  initialSubTab,
  currentUser,
  onAddDraft,
  onUpdateDraft,
  onUpdateDraftStatus,
  onDeleteDraft,
  onGenerateInvoice = () => { },
  onLogAudit,
  userRole
}) => {
  const { drafts } = useDrafts();
  const { escales } = useEscales();

  // Navigation par sous-onglets : « Espace Client & Historique » est l'onglet
  // actif par défaut à l'ouverture de la page (tous profils). Un client export
  // y retrouve ses drafts ; un agent y voit la liste complète.
  const [activeSubTab, setActiveSubTab] = useState<'CONSOLIDATION' | 'SAISIE_DRAFT' | 'ESPACE_CLIENT'>(() => {
    if (initialSubTab) return initialSubTab;
    return 'ESPACE_CLIENT';
  });

  // ── Isolation client export : chaque client ne voit que SES propres drafts ──
  // Règle d'appartenance partagée (src/utils/draftOwnership.ts) : rattachement
  // par identifiants stables (id, email, société, nom) — sans repli générique.
  const isClientExport = userRole === 'CLIENT_EXPORT';
  const userDrafts = useMemo(
    () => filterDraftsForUser(drafts, currentUser, userRole),
    [drafts, currentUser, userRole]
  );

  // État de recherche & filtre par statut pour les drafts
  const [draftSearchTerm, setDraftSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Montants de frais d'amendement personnalisables (Frais Agence & Frais Douane)
  const [fraisAgenceAmount, setFraisAgenceAmount] = useState<number>(50000);
  const [fraisDouaneAmount, setFraisDouaneAmount] = useState<number>(25000);

  // Filtrage combiné (Recherche + Statut)
  const displayedDrafts = useMemo(() => {
    return userDrafts.filter(draft => {
      // 1. Filtre par statut
      if (statusFilter) {
        if (statusFilter === 'DEVERROUILLE' || statusFilter === 'CORRECTION_AUTORISEE') {
          if (!draft.estDeverrouille && draft.statut !== 'CORRECTION_AUTORISEE') return false;
        } else if (draft.statut !== statusFilter) {
          return false;
        }
      }

      // 2. Filtre par terme de recherche
      if (!draftSearchTerm.trim()) return true;
      const q = draftSearchTerm.toLowerCase().trim();
      const numDraft = (draft.numeroDraft || '').toLowerCase();
      const numBl = (draft.numeroBlGenere || '').toLowerCase();
      const bkg = (draft.bookingRef || '').toLowerCase();
      const shipper = (draft.shipperInfo?.nom || '').toLowerCase();
      const consignee = (draft.consigneeInfo?.nom || '').toLowerCase();
      const navire = (draft.navireNom || '').toLowerCase();
      const voyage = (draft.numeroVoyage || '').toLowerCase();
      const desc = (draft.marchandisesInfo?.description || '').toLowerCase();

      return numDraft.includes(q) || numBl.includes(q) || bkg.includes(q) ||
        shipper.includes(q) || consignee.includes(q) || navire.includes(q) ||
        voyage.includes(q) || desc.includes(q);
    });
  }, [userDrafts, statusFilter, draftSearchTerm]);

  // Garde : un client export ne doit jamais voir le manifeste consolidé
  // (ni l'atteindre par navigation directe) — réservé aux agents/admins.
  const canViewConsolidation = userRole !== 'CLIENT_EXPORT';
  // Sécurité : un client export ne peut agir que sur SES propres drafts
  // (la liste affichée étant déjà strictement filtrée, toute action
  // hors liste est refusée).
  const isOwnDraft = (draft: DraftExport) =>
    !isClientExport || isDraftOwnedByUser(draft, currentUser);

  // Liste des escales disponibles : uniquement les escales réellement créées/importées.
  // (Aucun repli de démonstration : sans escale enregistrée, la liste est vide.)
  const activeEscales: Escale[] = escales || [];

  // Escale sélectionnée pour le draft en cours et pour la consolidation.
  // Sélection automatique de la première escale disponible (aucune escale fictive).
  const [selectedEscaleId, setSelectedEscaleId] = useState<number | null>(null);
  useEffect(() => {
    if (activeEscales.length > 0 && (selectedEscaleId === null || !activeEscales.some(e => e.id === selectedEscaleId))) {
      setSelectedEscaleId(activeEscales[0].id);
    }
  }, [activeEscales, selectedEscaleId]);
  const selectedEscale: Escale | undefined = activeEscales.find(e => e.id === Number(selectedEscaleId));

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

  // Modale d'acceptation des frais par le Client (déclenche le compte à rebours de 2h)
  const [clientFeeModalOpen, setClientFeeModalOpen] = useState(false);
  const [targetDraftForFeeAcceptance, setTargetDraftForFeeAcceptance] = useState<DraftExport | null>(null);

  // Timer dynamique temps réel pour actualiser le compte à rebours de 2h toutes les 10 secondes
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Modale de suppression d'un draft (Admin uniquement)
  const [deleteDraftModalOpen, setDeleteDraftModalOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<DraftExport | null>(null);

  // Audit UX : fermeture clavier (Échap, sommet de pile) des modales du module.
  useEscapeClose(correctionModalOpen, () => setCorrectionModalOpen(false));
  useEscapeClose(agentApprovalModalOpen, () => setAgentApprovalModalOpen(false));
  useEscapeClose(refuseModalOpen, () => setRefuseModalOpen(false));
  useEscapeClose(clientFeeModalOpen, () => setClientFeeModalOpen(false));
  useEscapeClose(deleteDraftModalOpen, () => setDeleteDraftModalOpen(false));
  useEscapeClose(validationErrors.length > 0, () => setValidationErrors([]));

  // Form State Step 1 (Routing & General Info)
  const [bookingRef, setBookingRef] = useState('');
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
      numeroConteneur: 'BOCU-452109-4',
      typeConteneur: '20_DRY',
      numeroScelle: 'SC-CI-9981',
      poidsKg: 25200,
      poidsNetKg: 23000,
      volumeM3: 34.2,
      tareKg: 2200,
      nombreColis: 400
    },
    {
      numeroConteneur: 'BOCU-452110-8',
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

  // Helper pour calculer le statut, le verrouillage ETA et le délai de 2h de correction
  const parseEtaTimestamp = (dateStr?: string): number => {
    if (!dateStr) return 0;
    if (dateStr.length === 10) {
      // Fin de la journée ETA (23:59:59)
      return new Date(`${dateStr}T23:59:59`).getTime();
    }
    return new Date(dateStr).getTime();
  };

  const getDraftDeadlineInfo = (draft: DraftExport, escale?: Escale) => {
    const targetEscale = escale || activeEscales.find(e => e.id === draft.escaleId || e.numeroVoyage === draft.numeroVoyage) || activeEscales[0];
    const etaDateStr = targetEscale?.dateArrivee;
    const etaTimestamp = parseEtaTimestamp(etaDateStr);
    const isPastEta = etaTimestamp > 0 ? nowTick > etaTimestamp : false;
    const hoursRemainingEta = etaTimestamp > 0 ? Math.round((etaTimestamp - nowTick) / (1000 * 3600)) : 999;
    const daysRemainingEta = etaTimestamp > 0 ? Math.ceil((etaTimestamp - nowTick) / (1000 * 3600 * 24)) : 99;

    const isAlreadyValidated = draft.statut === 'VALIDE' || draft.statut === 'BL_GENERE';

    // Compte à rebours du délai strict de 2 heures après acceptation des frais
    let isCorrectionWindowActive = false;
    let isCorrectionWindowExpired = false;
    let correctionTimeFormatted = '';
    let correctionRemainingMs = 0;

    if (draft.dateLimiteCorrection) {
      const limitTime = new Date(draft.dateLimiteCorrection).getTime();
      correctionRemainingMs = limitTime - nowTick;
      if (correctionRemainingMs > 0 && (draft.statut === 'CORRECTION_AUTORISEE' || draft.estDeverrouille)) {
        isCorrectionWindowActive = true;
        const totalMins = Math.floor(correctionRemainingMs / (60 * 1000));
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        correctionTimeFormatted = hrs > 0 ? `${hrs}h ${mins.toString().padStart(2, '0')}m` : `${mins} min`;
      } else if (correctionRemainingMs <= 0) {
        isCorrectionWindowExpired = true;
      }
    }

    // Verrouillage côté client après soumission du draft corrigé
    const isVerrouilleApresCorrection = Boolean(draft.verrouilleApresCorrection);

    // Verrouillé côté client si :
    // - Déjà validé en BL
    // - Soumis définitivement après correction (verrouilleApresCorrection)
    // - Pas dans la fenêtre active des 2h ET (date ETA dépassée OU statut 'VERROUILLE' OU 'DEMANDE_CORRECTION' OU 'ACCORD_AGENT')
    const isLockedForClient = isAlreadyValidated
      || isVerrouilleApresCorrection
      || (!isCorrectionWindowActive && (isPastEta || draft.statut === 'VERROUILLE' || draft.statut === 'DEMANDE_CORRECTION' || draft.statut === 'ACCORD_AGENT'));

    // « OK To Print » dans le compte de l'Agent Export :
    // Dès la transmission initiale par le client OU resoumission après correction OU après l'ETA
    // N'est faux que si le draft est en cours de demande ou de correction active par le client
    const isOkToPrint = !isAlreadyValidated
      && draft.statut !== 'DEMANDE_CORRECTION'
      && draft.statut !== 'ACCORD_AGENT'
      && !isCorrectionWindowActive
      && (draft.okToPrint === true || draft.statut === 'SOUMIS' || draft.statut === 'VERROUILLE' || isVerrouilleApresCorrection);

    let badgeText = '';
    let badgeColor = '';

    if (isAlreadyValidated) {
      badgeText = 'Validé (Connaissement BOCS émis)';
      badgeColor = 'bg-emerald-50 dark:bg-night-positive-soft text-emerald-700 dark:text-night-positive border-emerald-300 dark:border-night-positive-line font-black';
    } else if (isVerrouilleApresCorrection) {
      if (isClientExport) {
        badgeText = 'Verrouillé définitif (Draft corrigé transmis)';
        badgeColor = 'bg-surface-sunken dark:bg-night-sunken text-text-secondary dark:text-night-ink border-zinc-300 dark:border-night-line-strong font-bold';
      } else {
        badgeText = 'OK To Print (Draft corrigé reçu)';
        badgeColor = 'bg-sky-50 dark:bg-night-sunken text-sky-700 dark:text-night-link border-sky-400 dark:border-night-link/30 font-black';
      }
    } else if (isCorrectionWindowActive) {
      if (isClientExport) {
        badgeText = `Correction active (${correctionTimeFormatted} restantes)`;
        badgeColor = 'bg-teal-50 dark:bg-night-sunken text-teal-800 dark:text-[#5EEAD4] border-teal-400 dark:border-[#2DD4BF]/30 font-extrabold animate-pulse';
      } else {
        badgeText = `Attente Ok To Print (Reste ${correctionTimeFormatted})`;
        badgeColor = 'bg-amber-50 dark:bg-night-caution-soft text-amber-800 dark:text-night-caution border-amber-300 dark:border-night-caution-line font-bold';
      }
    } else if (isCorrectionWindowExpired && draft.statut === 'CORRECTION_AUTORISEE') {
      badgeText = 'Délai de correction (2h) expiré';
      badgeColor = 'bg-rose-50 dark:bg-night-critical-soft text-rose-700 dark:text-night-critical border-rose-300 dark:border-night-critical-line font-bold';
    } else if (draft.statut === 'ACCORD_AGENT') {
      if (isClientExport) {
        badgeText = 'Correction accordée — Acceptez les frais (50 000 F)';
        badgeColor = 'bg-emerald-50 dark:bg-night-positive-soft text-emerald-800 dark:text-night-positive border-emerald-300 dark:border-night-positive-line font-extrabold';
      } else {
        badgeText = 'Accord donné — En attente acceptation frais client';
        badgeColor = 'bg-surface-sunken dark:bg-night-sunken text-text-secondary dark:text-night-ink border-zinc-300 dark:border-night-line-strong font-medium';
      }
    } else if (draft.statut === 'DEMANDE_CORRECTION') {
      if (isClientExport) {
        badgeText = 'Demande de correction en attente de l\'agent';
        badgeColor = 'bg-amber-50 dark:bg-night-caution-soft text-amber-800 dark:text-night-caution border-amber-300 dark:border-night-caution-line font-bold';
      } else {
        badgeText = 'Correction demandée par le client';
        badgeColor = 'bg-amber-50 dark:bg-night-caution-soft text-amber-800 dark:text-night-caution border-amber-300 dark:border-night-caution-line font-bold';
      }
    } else if (isPastEta || draft.statut === 'VERROUILLE') {
      if (isClientExport) {
        badgeText = `Verrouillé (Date ETA ${etaDateStr || ''} dépassée)`;
        badgeColor = 'bg-rose-50 dark:bg-night-critical-soft text-rose-700 dark:text-night-critical border-rose-300 dark:border-night-critical-line font-bold';
      } else {
        badgeText = 'OK To Print (ETA dépassée — Verrouillé client)';
        badgeColor = 'bg-sky-50 dark:bg-night-sunken text-sky-700 dark:text-night-link border-sky-400 dark:border-night-link/30 font-black';
      }
    } else {
      // Avant l'ETA : modifiable par le client, Ok To Print pour l'agent
      if (isClientExport) {
        if (daysRemainingEta <= 1) {
          badgeText = `Modifiable jusqu'à l'ETA (${hoursRemainingEta}h restantes)`;
          badgeColor = 'bg-amber-50 dark:bg-night-caution-soft text-amber-800 dark:text-night-caution border-amber-300 dark:border-night-caution-line font-bold';
        } else {
          badgeText = `Modifiable jusqu'à l'ETA (${daysRemainingEta}j restants)`;
          badgeColor = 'bg-blue-50 dark:bg-night-accent-soft text-blue-700 dark:text-night-link border-blue-300 font-bold';
        }
      } else {
        badgeText = 'OK To Print (Transmis par le client)';
        badgeColor = 'bg-sky-50 dark:bg-night-sunken text-sky-700 dark:text-night-link border-sky-400 dark:border-night-link/30 font-bold';
      }
    }

    return {
      targetEscale,
      etaDateStr,
      etaTimestamp,
      isPastEta,
      hoursRemainingEta,
      daysRemainingEta,
      isAlreadyValidated,
      isCorrectionWindowActive,
      isCorrectionWindowExpired,
      correctionTimeFormatted,
      correctionRemainingMs,
      isVerrouilleApresCorrection,
      isLocked: isLockedForClient,
      isOkToPrint,
      badgeText,
      badgeColor
    };
  };

  const handleAddContainer = () => {
    if (!newCtnNum.trim()) {
      toastWarning('Veuillez renseigner un numéro de conteneur.');
      return;
    }

    // Validation universelle selon la norme ISO 6346 (4 lettres + 6 chiffres de série + 1 clé d'autocontrôle)
    const validation = validateContainerNumber(newCtnNum);
    if (!validation.isValid) {
      toastError(validation.error || 'Numéro de conteneur invalide selon la norme ISO 6346.');
      return;
    }

    // Vérifier également si ce numéro de conteneur n'a pas déjà été ajouté
    const alreadyExists = containersList.some(
      c => c.numeroConteneur.replace(/[\s\-_]/g, '').toUpperCase() === validation.cleanNumber
    );
    if (alreadyExists) {
      toastWarning(`Le conteneur ${validation.formattedNumber} est déjà présent dans la liste.`);
      return;
    }

    setContainersList(prev => [
      ...prev,
      {
        numeroConteneur: validation.formattedNumber,
        typeConteneur: newCtnType,
        numeroScelle: newCtnScelle || `SC-CI-${Math.floor(1000 + Math.random() * 9000)}`,
        poidsKg: newCtnPoids,
        poidsNetKg: newCtnPoidsNet,
        volumeM3: newCtnVolume,
        tareKg: newCtnType.startsWith('40') ? 3800 : 2200,
        nombreColis: Math.round(newCtnPoids / 60)
      }
    ]);
    toastSuccess(`Conteneur ${validation.formattedNumber} ajouté avec succès (Norme ISO 6346 validée).`);
    setNewCtnNum('');
    setNewCtnScelle('');
  };

  const handleRemoveContainer = (index: number) => {
    setContainersList(prev => prev.filter((_, i) => i !== index));
  };

  // Chargement d'un draft pour correction ou consultation
  const handleEditDraft = (draft: DraftExport) => {
    if (isClientExport && !isOwnDraft(draft)) {
      toastError('Accès refusé : ce draft appartient à un autre compte client.');
      return;
    }
    const deadlineInfo = getDraftDeadlineInfo(draft);
    if (isClientExport) {
      if (deadlineInfo.isVerrouilleApresCorrection) {
        toastWarning('Ce draft a déjà été corrigé et soumis définitivement. Il est verrouillé côté client et prêt pour l\'émission du BL.');
        return;
      }
      if (draft.statut === 'ACCORD_AGENT') {
        setTargetDraftForFeeAcceptance(draft);
        setClientFeeModalOpen(true);
        return;
      }
      if (deadlineInfo.isLocked && !deadlineInfo.isCorrectionWindowActive) {
        toastError(`Ce draft est verrouillé (Date ETA dépassée). Veuillez soumettre une demande de correction à l'agent.`);
        handleOpenCorrectionModal(draft);
        return;
      }
    }

    setEditingDraftId(draft.id);
    setSelectedEscaleId(draft.escaleId || activeEscales[0]?.id || null);
    setBookingRef(draft.bookingRef || '');
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
    setBookingRef(`BKG-ABJ-${selectedEscale?.numeroVoyage || 'NEW'}-${Math.floor(100 + Math.random() * 900)}`);
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
    if (!targetEscale) {
      toastError("Aucune escale enregistrée. Créez ou importez d'abord une escale (module Import & Escale).");
      return;
    }

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
      bookingRef: bookingRef.trim() || `BKG-ABJ-${targetEscale.numeroVoyage}-${Math.floor(100 + Math.random() * 900)}`,
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
    if (!targetEscale) {
      toastError("Aucune escale enregistrée. Créez ou importez d'abord une escale (module Import & Escale).");
      return;
    }
    const etaTimestamp = parseEtaTimestamp(targetEscale?.dateArrivee);
    const isPastEta = etaTimestamp > 0 ? Date.now() > etaTimestamp : false;

    const existingDraft = editingDraftId ? drafts.find(d => d.id === editingDraftId) : null;
    const wasInCorrection = existingDraft?.statut === 'CORRECTION_AUTORISEE' || Boolean(existingDraft?.dateLimiteCorrection) || Boolean(existingDraft?.estDeverrouille);

    // Règle métier :
    // - Dès transmission par le client, le draft est supposé "OK To Print" dans le compte de l'Agent Export
    // - Le client peut modifier jusqu'à l'ETA ; après l'ETA, il est verrouillé
    // - Si le client soumet son draft après autorisation de correction (délai 2h) :
    //   -> statut = 'SOUMIS'
    //   -> okToPrint = true ("systematiquement Ok To Print coté Agent")
    //   -> verrouilleApresCorrection = true ("et verrouillé coté client")
    //   -> estDeverrouille = false
    //   -> dateLimiteCorrection = undefined
    const finalStatut: DraftStatus = wasInCorrection ? 'SOUMIS' : (isPastEta ? 'VERROUILLE' : 'SOUMIS');

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
      numeroDraft: existingDraft?.numeroDraft || (editingDraftId ? (drafts.find(d => d.id === editingDraftId)?.numeroDraft || `BOCS-EXP-DRF-${Math.floor(1000 + Math.random() * 9000)}`) : `BOCS-EXP-DRF-${Math.floor(1000 + Math.random() * 9000)}`),
      bookingRef: bookingRef.trim() || existingDraft?.bookingRef || `BKG-ABJ-${targetEscale.numeroVoyage}-${Math.floor(100 + Math.random() * 900)}`,
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
      statut: finalStatut,
      okToPrint: true, // "Ce draft une fois transmis est supposé Ok To Print dans le compte de l'agent Export" & "Le draft alors soumis est systematiquement Ok To Print coté Agent"
      estDeverrouille: false,
      verrouilleApresCorrection: wasInCorrection ? true : Boolean(existingDraft?.verrouilleApresCorrection),
      dateLimiteCorrection: undefined,
      contenuOriginal: existingDraft?.contenuOriginal,
      demandeCorrection: existingDraft?.demandeCorrection,
      fraisAmendementFactures: existingDraft?.fraisAmendementFactures,
      dateCreation: existingDraft?.dateCreation || new Date().toISOString().split('T')[0]
    };

    if (editingDraftId && onUpdateDraft) {
      onUpdateDraft(draftData);
      if (wasInCorrection) {
        toastSuccess(`Draft corrigé ${draftData.numeroDraft} retransmis à l'agent. Statut « Ok To Print » confirmé côté agent et draft verrouillé pour votre compte.`);
      } else {
        toastSuccess(`Draft ${draftData.numeroDraft} mis à jour avec succès.`);
      }
    } else {
      onAddDraft(draftData);
      if (isPastEta) {
        toastWarning(`Attention : La date ETA étant dépassée, ce draft est désormais verrouillé côté client.`);
      } else {
        toastSuccess(`Draft définitif ${draftData.numeroDraft} transmis avec succès. Statut « Ok To Print » confirmé pour l'agent maritime (modifiable jusqu'à l'ETA).`);
      }
    }

    onLogAudit('SOUMISSION_DRAFT_EXPORT', 'DraftExport', `Soumission du draft ${draftData.numeroDraft} (${draftData.statut} - Ok To Print: true, Verrouillé client: ${draftData.verrouilleApresCorrection || isPastEta})`);
    resetForm();
    setActiveSubTab('ESPACE_CLIENT');
  };

  // Ouverture de la modale de demande de correction
  const handleOpenCorrectionModal = (draft: DraftExport) => {
    if (isClientExport && !isOwnDraft(draft)) {
      toastError('Accès refusé : ce draft appartient à un autre compte client.');
      return;
    }
    setTargetDraftForCorrection(draft);
    setMotifCorrection('');
    setFraisAcceptes(false);
    setCorrectionModalOpen(true);
  };

  // Confirmation de la demande de correction avec acceptation des frais
  const handleSubmitCorrectionRequest = () => {
    if (!targetDraftForCorrection) return;
    if (isClientExport && !isOwnDraft(targetDraftForCorrection)) {
      toastError('Accès refusé : ce draft appartient à un autre compte client.');
      return;
    }
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

  // Approbation de la correction par l'Agent Export
  const handleApproveCorrection = (immediate: boolean = false) => {
    if (!targetDraftForApproval) return;

    // Calcul des montants selon le type de frais choisi et les valeurs saisies par l'agent
    // Règle BOCS : les factures Export ne sont PAS assujetties à la TVA (0 %) — TTC = HT.
    const isFraisDouane = correctionFeeType === 'AGENCE_DOUANE';
    const montantAgence = Number(fraisAgenceAmount || 50000);
    const montantDouane = Number(fraisDouaneAmount || 50000);
    const montantHt = isFraisDouane ? (montantAgence + montantDouane) : montantAgence;
    const typeLabel = isFraisDouane ? `Frais Agence (${montantAgence.toLocaleString('fr-FR')} F) + Douane (${montantDouane.toLocaleString('fr-FR')} F) = ${montantHt.toLocaleString('fr-FR')} FCFA` : `Frais Agence (${montantAgence.toLocaleString('fr-FR')} FCFA)`;

    if (immediate) {
      // Déverrouillage immédiat avec chrono de 2h
      const now = Date.now();
      const dateLimite = new Date(now + 2 * 3600 * 1000).toISOString();
      const updatedDraft: DraftExport = {
        ...targetDraftForApproval,
        statut: 'CORRECTION_AUTORISEE',
        estDeverrouille: true,
        fraisAmendementFactures: true,
        dateLimiteCorrection: dateLimite,
        contenuOriginal: targetDraftForApproval.contenuOriginal || snapshotContenuDraft(targetDraftForApproval),
        demandeCorrection: {
          ...targetDraftForApproval.demandeCorrection!,
          statut: 'ACCEPTEE',
          montantFrais: montantHt,
          validePar: currentUser.nomComplet,
          dateValidation: new Date().toISOString().replace('T', ' ').substring(0, 19)
        }
      };

      if (onUpdateDraft) onUpdateDraft(updatedDraft);
      else onUpdateDraftStatus(targetDraftForApproval.id, 'CORRECTION_AUTORISEE');

      // Génération de facture rattachée
      const invoiceNumber = `FA-AMD-${targetDraftForApproval.numeroVoyage || 'EXP'}-BOCS${String(Math.floor(100 + Math.random() * 900))}`;
      const lignesFacture = [
        {
          id: 1,
          typeFrais: 'AUTRE' as const,
          designation: `Frais d'agence — amendement/révision BL Export après ETA (${targetDraftForApproval.numeroBlGenere || targetDraftForApproval.numeroDraft})`,
          quantite: 1,
          prixUnitaireFcfa: montantAgence,
          montantHtFcfa: montantAgence,
          tauxTva: 0
        }
      ];
      if (isFraisDouane) {
        lignesFacture.push({
          id: 2,
          typeFrais: 'AUTRE' as const,
          designation: `Frais de douane — rectification déclaration export (${targetDraftForApproval.numeroBlGenere || targetDraftForApproval.numeroDraft})`,
          quantite: 1,
          prixUnitaireFcfa: montantDouane,
          montantHtFcfa: montantDouane,
          tauxTva: 0
        });
      }
      onGenerateInvoice({
        id: Date.now(),
        numeroFacture: invoiceNumber,
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
        tvaFcfa: 0,
        montantTtcFcfa: montantHt,
        soldeDuFcfa: montantHt,
        escaleInfo: `${targetDraftForApproval.navireNom || 'NAVIRE'} V.${targetDraftForApproval.numeroVoyage || 'VOY'}`,
        invoiceTypeId: isFraisDouane ? 'RECTIF_AGENCE_DOUANE' : 'RECTIF_AGENCE',
        createdBy: currentUser.nomComplet,
        validatedBy: currentUser.nomComplet,
        validatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        lignes: lignesFacture
      });

      onLogAudit('APPROBATION_AMENDEMENT_DRAFT_2H', 'DraftExport', `Approbation amendement ${targetDraftForApproval.numeroDraft} avec chrono de 2h immédiat — Facture ${invoiceNumber} — ${typeLabel}`);
      toastSuccess(`Correction autorisée ! Compte à rebours de 2h activé. Facture ${invoiceNumber} (${typeLabel}) émise.`);
    } else {
      // Accord donné par l'agent : le client valide les frais pour lancer ses 2h
      const updatedDraft: DraftExport = {
        ...targetDraftForApproval,
        statut: 'ACCORD_AGENT',
        demandeCorrection: {
          ...targetDraftForApproval.demandeCorrection!,
          statut: 'ACCEPTEE',
          montantFrais: montantHt,
          validePar: currentUser.nomComplet,
          dateValidation: new Date().toISOString().replace('T', ' ').substring(0, 19)
        }
      };

      if (onUpdateDraft) onUpdateDraft(updatedDraft);
      else onUpdateDraftStatus(targetDraftForApproval.id, 'ACCORD_AGENT');

      onLogAudit('ACCORD_AGENT_AMENDEMENT_DRAFT', 'DraftExport', `Accord donné pour amendement ${targetDraftForApproval.numeroDraft} (${typeLabel}). En attente acceptation frais par le client pour débuter les 2h.`);
      toastSuccess(`Accord accordé au client ! Dès que le client valide les frais de ${montantHt.toLocaleString('fr-FR')} FCFA, son chrono de 2h débutera.`);
    }

    setAgentApprovalModalOpen(false);
    setCorrectionFeeType('AGENCE');
  };

  // Acceptation des frais par le Client Export -> Déclenchement du compte à rebours strict de 2 heures
  const handleClientAcceptFeesAndStartCorrection = (draft: DraftExport) => {
    const montantHt = draft.demandeCorrection?.montantFrais || 50000;
    const now = Date.now();
    const dateLimite = new Date(now + 2 * 3600 * 1000).toISOString(); // 2 heures exactes

    // Génération automatique de la facture de frais d'amendement
    const invoiceNumber = `FA-AMD-${draft.numeroVoyage || 'EXP'}-BOCS${String(Math.floor(100 + Math.random() * 900))}`;
    const invoice: Invoice = {
      id: Date.now(),
      numeroFacture: invoiceNumber,
      numeroBL: draft.numeroBlGenere || draft.numeroDraft,
      clientNom: draft.clientNom || draft.shipperInfo.nom,
      clientId: draft.clientId,
      dateFacture: new Date().toISOString().split('T')[0],
      dateEcheance: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      typeFacture: 'DEFINITIVE_EXPORT',
      statutFacture: 'VALIDEE',
      statutPaiement: 'NON_PAYE',
      devise: 'FCFA',
      tauxChangeUsd: 600,
      montantHtFcfa: montantHt,
      tvaFcfa: 0,
      montantTtcFcfa: montantHt,
      soldeDuFcfa: montantHt,
      escaleInfo: `${draft.navireNom || 'NAVIRE'} V.${draft.numeroVoyage || 'VOY'}`,
      invoiceTypeId: 'RECTIF_AGENCE',
      createdBy: `${currentUser.nomComplet} (Acceptation Client)`,
      validatedBy: 'Agent Export BOCS',
      validatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      lignes: [
        {
          id: 1,
          typeFrais: 'AUTRE',
          designation: `Frais d'agence — amendement/révision BL Export après ETA (${draft.numeroBlGenere || draft.numeroDraft})`,
          quantite: 1,
          prixUnitaireFcfa: montantHt,
          montantHtFcfa: montantHt,
          tauxTva: 0
        }
      ]
    };

    onGenerateInvoice(invoice);

    const updatedDraft: DraftExport = {
      ...draft,
      statut: 'CORRECTION_AUTORISEE',
      estDeverrouille: true,
      fraisAmendementFactures: true,
      dateLimiteCorrection: dateLimite,
      contenuOriginal: draft.contenuOriginal || snapshotContenuDraft(draft),
      demandeCorrection: {
        ...(draft.demandeCorrection || {
          motif: 'Correction après ETA',
          dateDemande: new Date().toISOString(),
          statut: 'ACCEPTEE',
          montantFrais: montantHt
        }),
        statut: 'ACCEPTEE',
        fraisAcceptes: true,
        montantFrais: montantHt
      }
    };

    if (onUpdateDraft) onUpdateDraft(updatedDraft);
    else onUpdateDraftStatus(draft.id, 'CORRECTION_AUTORISEE');

    onLogAudit('ACCEPTATION_FRAIS_DRAFT_2H', 'DraftExport', `Le client ${currentUser.nomComplet} a accepté les frais (${montantHt} FCFA). Compte à rebours de 2h activé jusqu'à ${new Date(dateLimite).toLocaleTimeString('fr-FR')}.`);
    toastSuccess(`Frais de ${montantHt.toLocaleString('fr-FR')} FCFA acceptés. Vous disposez de 2 heures pour modifier et soumettre votre draft.`);
    setClientFeeModalOpen(false);

    // Ouvre immédiatement le draft en édition
    handleEditDraft(updatedDraft);
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
    const blNum = `BOCS-EXP-${draft.numeroVoyage || '000'}-${String(draft.id).slice(-3)}`;
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

  // Suppression d'un draft (Admin uniquement)
  const handleConfirmDeleteDraft = () => {
    if (!draftToDelete) return;
    if (userRole !== 'ADMIN') {
      toastError('Seul un administrateur est autorisé à supprimer un draft.');
      return;
    }
    if (onDeleteDraft) {
      onDeleteDraft(draftToDelete.id);
    }
    onLogAudit(
      'SUPPRESSION_DRAFT',
      'DraftExport',
      `Suppression définitive du draft ${draftToDelete.numeroDraft} (${draftToDelete.clientNom || draftToDelete.shipperInfo?.nom || ''}) par l'administrateur ${currentUser.nomComplet}`
    );
    toastSuccess(`Le draft ${draftToDelete.numeroDraft} a été supprimé avec succès.`);
    setDeleteDraftModalOpen(false);
    setDraftToDelete(null);
  };

  useEffect(() => {
    if (initialSubTab) {
      // Sécurité : un client export arrivant sur CONSOLIDATION (lien direct)
      // est ramené vers son espace — il n'a pas accès au manifeste.
      if (initialSubTab === 'CONSOLIDATION' && userRole === 'CLIENT_EXPORT') {
        setActiveSubTab('ESPACE_CLIENT');
      } else {
        setActiveSubTab(initialSubTab);
      }
    }
  }, [initialSubTab, userRole]);

  useEffect(() => {
    if (isClientExport && activeSubTab === 'CONSOLIDATION') {
      setActiveSubTab('ESPACE_CLIENT');
    }
  }, [isClientExport, activeSubTab]);

  // Liste des drafts validés pour l'escale sélectionnée dans l'onglet Manifeste
  // (onglet réservé agents/admins — jamais rendu pour un client export).
  const validatedDraftsForManifest = selectedEscale ? drafts.filter(d => {
    const isThisEscale = d.escaleId === selectedEscale.id || d.numeroVoyage === selectedEscale.numeroVoyage || d.navireNom === selectedEscale.nomNavire;
    return isThisEscale && (d.statut === 'VALIDE' || d.statut === 'BL_GENERE');
  }) : [];

  const totalColisManifest = validatedDraftsForManifest.reduce((acc, d) => acc + (d.marchandisesInfo.nombreColis || 0), 0);
  const totalWeightKgManifest = validatedDraftsForManifest.reduce((acc, d) => acc + (d.marchandisesInfo.poidsBrutKg || 0), 0);
  const totalContainersManifest = validatedDraftsForManifest.reduce((acc, d) => acc + (d.conteneursInfo?.length || 0), 0);
  const totalVolumeM3Manifest = validatedDraftsForManifest.reduce((acc, d) => acc + (d.marchandisesInfo.volumeM3 || 0), 0);

  // Demandes de correction en attente
  const pendingCorrections = drafts.filter(d => d.statut === 'DEMANDE_CORRECTION');

  return (
    <div className="space-y-6 animate-fade-in text-text-primary dark:text-night-ink page-zoom-130">

      {/* ─── 1. TOP MODULE NAVIGATION BAR ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-canvas dark:bg-night-surface p-3 rounded-md border border-border-default dark:border-night-line shadow-1">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">

          <button
            onClick={() => setActiveSubTab('ESPACE_CLIENT')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${activeSubTab === 'ESPACE_CLIENT'
              ? 'bg-[#005DAA] dark:bg-night-accent text-white dark:text-white shadow-1 font-black'
              : 'bg-surface-base dark:bg-night-sunken hover:bg-surface-sunken text-text-secondary dark:text-night-ink border border-border-default dark:border-night-line'
              }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">folder_shared</span>
            <span>Espace Client &amp; Historique</span>
            {displayedDrafts.length > 0 && (
              <span className={`text-2xs font-mono px-1.5 py-0.5 rounded-full ${activeSubTab === 'ESPACE_CLIENT' ? 'bg-surface-canvas dark:bg-night-surface/20 text-white dark:text-night-ink' : 'bg-zinc-200 text-text-primary dark:text-night-ink'
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
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${activeSubTab === 'SAISIE_DRAFT'
              ? 'bg-[#005DAA] dark:bg-night-accent text-white dark:text-white shadow-1 font-black'
              : 'bg-surface-base dark:bg-night-sunken hover:bg-surface-sunken text-text-secondary dark:text-night-ink border border-border-default dark:border-night-line'
              }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">edit_note</span>
            <span>Saisie du Draft de BL</span>
          </button>

          {/* Onglet Manifeste Export (Consolidation) — agents & admins uniquement.
              Le client export ne voit que ses propres drafts et n'a pas accès au manifeste. */}
          {canViewConsolidation && (
            <button
              onClick={() => setActiveSubTab('CONSOLIDATION')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${activeSubTab === 'CONSOLIDATION'
                ? 'bg-[#005DAA] dark:bg-night-accent text-white dark:text-white shadow-1 font-black'
                : 'bg-surface-base dark:bg-night-sunken hover:bg-surface-sunken text-text-secondary dark:text-night-ink border border-border-default dark:border-night-line'
                }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-lg">inventory</span>
              <span>Manifeste Export (Consolidation)</span>
              {validatedDraftsForManifest.length > 0 && (
                <span className={`text-2xs font-mono px-1.5 py-0.5 rounded-full ${activeSubTab === 'CONSOLIDATION' ? 'bg-surface-canvas dark:bg-night-surface/20 text-white dark:text-night-ink' : 'bg-emerald-100 text-emerald-800 font-black'
                  }`}>
                  {validatedDraftsForManifest.length} BLs
                </span>
              )}
            </button>
          )}

        </div>

        {/* Escale active info */}
        {selectedEscale && (
          <div className="text-sm text-text-secondary dark:text-night-ink font-medium px-3 flex items-center gap-2">
            <Ship className="w-4 h-4 text-[#005DAA] dark:text-night-ink" />
            <span>Escale : </span>
            <strong className="text-text-primary dark:text-night-ink font-bold">{selectedEscale.nomNavire}</strong>
            <span className="text-2xs bg-surface-sunken dark:bg-night-sunken px-2 py-0.5 rounded-full border border-border-default dark:border-night-line font-mono">
              Voy. {selectedEscale.numeroVoyage} • ETA: {selectedEscale.dateArrivee}
            </span>
          </div>
        )}
      </div>

      {/* Alerte pour les agents s'il y a des demandes de correction */}
      {(userRole === 'AGENT_EXPORT' || userRole === 'ADMIN') && pendingCorrections.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-md flex items-center justify-between gap-4 animate-fade-in shadow-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-amber-200 flex items-center justify-center text-amber-800">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-amber-900">
                {pendingCorrections.length} demande(s) de correction de draft après verrouillage en attente d'approbation
              </div>
              <div className="text-xs text-amber-800 font-medium">
                Les clients ont accepté la facturation forfaitaire des frais d'amendement de 50 000 FCFA HT.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveSubTab('ESPACE_CLIENT')}
            className="px-3.5 py-1.5 bg-amber-600 dark:bg-night-caution hover:bg-amber-700 dark:hover:bg-night-caution text-white dark:text-night-ink font-bold text-sm rounded-md shadow-1 transition-all cursor-pointer"
          >
            Examiner dans la liste
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ONGLET 1 : ESPACE CLIENT & HISTORIQUE DES DRAFTS
      ══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'ESPACE_CLIENT' && (
        <div className="bg-surface-canvas dark:bg-night-surface rounded-md border border-border-default dark:border-night-line shadow-1 overflow-hidden space-y-4 p-6">

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default dark:border-night-line pb-4">
            <div>
              <h2 className="text-xl font-black text-[#002B49] dark:text-night-ink flex items-center gap-2">
                <span>Espace Export &amp; Suivi des Connaissements</span>
                <span className="text-sm font-extrabold px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#00875A] dark:text-night-positive border border-[#00875A]/30">
                  {userRole === 'CLIENT_EXPORT' ? 'Accès Client Sécurisé' : 'Supervision Agent BOCS'}
                </span>
              </h2>
              <p className="text-sm text-text-muted dark:text-night-ink-2 font-medium mt-0.5">
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
              className="bg-[#005DAA] dark:bg-night-accent hover:bg-[#004A88] text-white dark:text-white font-black px-4 py-2 rounded-md text-sm flex items-center gap-2 transition-all shadow-1 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Draft BL</span>
            </button>
          </div>

          {/* ─── PANNEAU DÉDIÉ AUX DEMANDES DE CORRECTION (AGENT / ADMIN UNIQUEMENT) ─── */}
          {(userRole === 'AGENT_EXPORT' || userRole === 'ADMIN') && pendingCorrections.length > 0 && (
            <div className="border border-amber-300 rounded-md overflow-hidden">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-night-caution-soft dark:to-night-surface px-5 py-3 border-b border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span className="text-sm font-black text-amber-900 uppercase tracking-wider">
                    {pendingCorrections.length} Demande(s) de Correction à Traiter
                  </span>
                </div>
                <span className="text-2xs font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                  Action requise
                </span>
              </div>
              <div className="divide-y divide-amber-100">
                {pendingCorrections.map(draft => (
                  <div key={`corr-${draft.id}`} className="px-5 py-3 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-[#005DAA] dark:text-night-link font-mono">{draft.numeroDraft}</span>
                        {draft.numeroBlGenere && (
                          <span className="text-2xs font-black text-emerald-700 bg-emerald-50 dark:bg-night-positive-soft px-1.5 rounded border border-emerald-300">
                            BL: {draft.numeroBlGenere}
                          </span>
                        )}
                        <span className="text-2xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          Demande en attente
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary dark:text-night-ink font-bold">
                        {draft.clientNom} ({draft.clientSociete || draft.shipperInfo.nom})
                      </div>
                      <div className="text-2xs text-text-muted dark:text-night-ink-2 font-medium italic">
                        Motif : "{draft.demandeCorrection?.motif || 'Non précisé'}"
                      </div>
                      <div className="text-2xs text-text-muted dark:text-night-ink-3 font-mono">
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
                      className="shrink-0 px-4 py-2 bg-amber-600 dark:bg-night-caution hover:bg-amber-700 dark:hover:bg-night-caution text-white dark:text-night-ink font-black text-sm rounded-md inline-flex items-center gap-1.5 shadow-1 transition-all cursor-pointer active:scale-95"
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
          <div className="p-3.5 bg-[#F0F7FF] dark:bg-night-sunken rounded-md border border-[#005DAA] dark:border-night-line flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-[#005DAA] dark:text-night-link shrink-0" />
              {userRole === 'CLIENT_EXPORT' ? (
                <span className="text-text-secondary dark:text-night-ink font-medium">
                  <strong>Règle d'or Export :</strong> Transmission impérative du draft définitif <strong>au moins 24h avant l'ETA</strong> du navire. Tout draft non validé après ce délai est automatiquement verrouillé et nécessite une demande formelle de correction.
                </span>
              ) : (
                <span className="text-text-secondary dark:text-night-ink font-medium">
                  <strong>Vue Agent :</strong> Tous les drafts clients sont listés ci-dessous (brouillons, soumis, verrouillés, validés). Les demandes de correction sont facturées : <strong>Frais d'agence {fraisAgenceAmount.toLocaleString('fr-FR')} FCFA HT</strong> ou <strong>Frais d'agence + Frais douane {(fraisAgenceAmount + fraisDouaneAmount).toLocaleString('fr-FR')} FCFA HT</strong>.
                </span>
              )}
            </div>
            <span className="text-xs font-black text-[#005DAA] dark:text-night-link shrink-0 font-mono">Délai : 24h avant ETA</span>
          </div>

          {/* Barre de Recherche & Boutons de Filtres par Statuts Cliquables */}
          <div className="space-y-3 mb-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="text-sm font-black text-text-secondary dark:text-night-ink uppercase tracking-wider shrink-0">
                {userRole === 'CLIENT_EXPORT' ? 'Mes Drafts & Connaissements' : `Tous les Drafts Clients (${displayedDrafts.length})`}
              </h3>

              {/* Champ de Recherche */}
              <div className="relative flex-1 min-w-[240px] max-w-md w-full">
                <Search className="w-4 h-4 text-text-muted dark:text-night-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={draftSearchTerm}
                  onChange={e => setDraftSearchTerm(e.target.value)}
                  placeholder="Rechercher par N° Draft, BL, Navire, Expéditeur, Destinataire..."
                  className="w-full pl-9 pr-8 py-2 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md text-sm font-medium text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] shadow-1"
                />
                {draftSearchTerm && (
                  <button aria-label="Effacer la recherche"
                    type="button"
                    onClick={() => setDraftSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-text-muted dark:text-night-ink-3 hover:text-text-secondary cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Boutons de Filtre par Statut Cliquables */}
            <div className="flex flex-wrap items-center gap-1.5 text-2xs">
              <button
                type="button"
                onClick={() => setStatusFilter(null)}
                className={`px-3 py-1 rounded-full border font-bold transition-all cursor-pointer ${statusFilter === null
                  ? 'bg-[#005DAA] dark:bg-night-accent text-white dark:text-white border-[#005DAA] dark:border-night-line shadow-1 font-black'
                  : 'bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 border-zinc-300 dark:border-night-line-strong text-text-secondary dark:text-night-ink'
                  }`}
              >
                Tous ({userDrafts.length})
              </button>

              {['BROUILLON', 'SOUMIS', 'VERROUILLE', 'DEMANDE_CORRECTION', 'CORRECTION_AUTORISEE', 'VALIDE', 'BL_GENERE'].map(s => {
                const count = userDrafts.filter(d => d.statut === s || (s === 'CORRECTION_AUTORISEE' && d.estDeverrouille)).length;
                if (count === 0) return null;

                const label = s === 'BROUILLON' ? 'Brouillons'
                  : s === 'SOUMIS' ? 'Soumis'
                    : s === 'VERROUILLE' ? 'Verrouillés'
                      : s === 'DEMANDE_CORRECTION' ? 'Corrections en attente'
                        : s === 'CORRECTION_AUTORISEE' ? 'Déverrouillés'
                          : s === 'VALIDE' ? 'Validés'
                            : 'BL Générés';

                const isSelected = statusFilter === s;

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(isSelected ? null : s)}
                    className={`px-2.5 py-1 rounded-full border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${isSelected
                      ? 'bg-[#005DAA] dark:bg-night-accent text-white dark:text-white border-[#005DAA] dark:border-night-line shadow-1 font-black'
                      : s === 'BROUILLON'
                        ? 'bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 dark:hover:bg-night-raised border-zinc-300 dark:border-night-line-strong text-text-primary dark:text-night-ink-2'
                        : s === 'CORRECTION_AUTORISEE'
                          ? 'bg-teal-50 dark:bg-night-sunken hover:bg-teal-100 dark:hover:bg-night-raised border-teal-300 dark:border-[#2DD4BF]/30 text-teal-800 dark:text-[#5EEAD4] font-extrabold'
                          : s === 'VERROUILLE'
                            ? 'bg-rose-50 dark:bg-night-critical-soft hover:bg-rose-100 dark:hover:bg-night-critical-line border-rose-300 dark:border-night-critical/30 text-rose-800 dark:text-night-critical'
                            : s === 'DEMANDE_CORRECTION'
                              ? 'bg-amber-50 dark:bg-night-caution-soft hover:bg-amber-100 dark:hover:bg-night-caution-line border-amber-300 dark:border-night-caution-line/30 text-amber-800 dark:text-night-caution font-bold'
                              : 'bg-emerald-50 dark:bg-night-positive-soft hover:bg-emerald-100 dark:hover:bg-night-positive-line border-emerald-300 dark:border-night-positive/30 text-emerald-800 dark:text-night-positive'
                      }`}
                  >
                    <span>{label}:</span>
                    <span className="font-mono font-black">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Astuce ergonomique double-clic */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F0F7FF] dark:bg-night-sunken text-[#005DAA] dark:text-night-ink border border-[#005DAA] dark:border-night-line/25 text-xs font-bold shadow-1">
              <span>💡</span>
              <span>Double-cliquez sur une ligne pour ouvrir le draft en modification</span>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[420px] bocs-scrollbar relative border border-border-default dark:border-night-line rounded-md">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 bg-surface-base dark:bg-night-sunken z-10 shadow-1">
                <tr className="bg-surface-base dark:bg-night-sunken text-2xs font-black uppercase text-text-muted dark:text-night-ink-2 border-b border-border-default dark:border-night-line tracking-wider">
                  <th className="p-3.5">N° Draft / BL</th>
                  <th className="p-3.5">Navire &amp; Escale</th>
                  <th className="p-3.5">Expéditeur &amp; Destinataire</th>
                  <th className="p-3.5">Cargaison (Poids &amp; Colis)</th>
                  <th className="p-3.5">Délai ETA &amp; Statut</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-night-line">
                {displayedDrafts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-text-muted dark:text-night-ink-3">
                      <span aria-hidden="true" className="material-symbols-outlined text-4xl block mb-2 text-text-muted">folder_open</span>
                      <span>Aucun draft soumis pour le moment. Cliquez sur « Nouveau Draft BL » pour débuter.</span>
                    </td>
                  </tr>
                ) : (
                  displayedDrafts.map(draft => {
                    const escale = activeEscales.find(e => e.id === draft.escaleId || e.numeroVoyage === draft.numeroVoyage);
                    const deadlineInfo = getDraftDeadlineInfo(draft, escale);
                    // Diff coloré (écran uniquement) : ajouts en rouge, restants en vert,
                    // uniquement pendant la période de correction autorisée.
                    const diff = isDraftEnPeriodeCorrection(draft) ? getDraftDiff(draft) : null;
                    const cls = (section: string, field: string, normal: string) => {
                      const c = getDraftFieldColor(diff, section, field);
                      return c === 'AJOUTE' ? 'text-rose-600 font-black' : c === 'CONSERVE' ? 'text-emerald-600 dark:text-night-positive font-bold' : normal;
                    };
                    const ctrColor = !diff ? '' : diff.conteneursAjoutes > 0 ? 'text-rose-600 font-black' : diff.conteneursSupprimes > 0 ? 'text-emerald-600 dark:text-night-positive font-bold' : '';

                    return (
                      <tr
                        key={draft.id}
                        onDoubleClick={() => handleEditDraft(draft)}
                        className="hover:bg-[#F0F7FF] dark:hover:bg-night-raised transition-colors cursor-pointer select-none group"
                        title="💡 Double-cliquez pour ouvrir ce draft en mode modification"
                      >

                        {/* Numéro Draft / BL */}
                        <td className="p-3.5 font-mono">
                          <div className="font-extrabold text-[#005DAA] dark:text-night-link">
                            {draft.numeroBlGenere || draft.numeroDraft}
                          </div>
                          <div className={cls('nav', 'bookingRef', 'text-2xs text-text-muted dark:text-night-ink-2')}>
                            Réf: {draft.bookingRef || 'BKG-ABJ'}
                          </div>
                          {draft.numeroBlGenere && (
                            <span className="inline-flex items-center gap-1 text-2xs font-black text-emerald-700 bg-emerald-50 dark:bg-night-positive-soft px-1.5 py-0.2 rounded border border-emerald-300 mt-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              BL Original
                            </span>
                          )}
                        </td>

                        {/* Escale & Navire */}
                        <td className="p-3.5">
                          <div className="font-extrabold text-text-primary dark:text-night-ink flex items-center gap-1">
                            <Ship className="w-3.5 h-3.5 text-[#005DAA] dark:text-night-link" />
                            <span className={cls('nav', 'navireNom', '')}>{draft.navireNom || escale?.nomNavire || '—'}</span>
                          </div>
                          <div className={cls('nav', 'numeroVoyage', 'text-2xs text-text-muted dark:text-night-ink-2 font-mono')}>
                            Voy. {draft.numeroVoyage || escale?.numeroVoyage || '—'}
                          </div>
                          <div className={cls('nav', 'portDechargementNom', 'text-2xs text-text-muted dark:text-night-ink-2')}>
                            POD : <strong className={cls('nav', 'portDechargementCode', '')}>{draft.portDechargementNom || draft.portDechargementCode || 'ANVERS'}</strong>
                          </div>
                        </td>

                        {/* Expéditeur & Destinataire */}
                        <td className="p-3.5">
                          <div className={cls('shipper', 'nom', 'font-bold text-text-primary dark:text-night-ink')}>{draft.shipperInfo.nom}</div>
                          <div className={cls('consignee', 'nom', 'text-2xs text-text-muted dark:text-night-ink-2 truncate max-w-[180px]')}>
                            &rarr; {draft.consigneeInfo.nom} (<span className={cls('consignee', 'pays', '')}>{draft.consigneeInfo.pays}</span>)
                          </div>
                        </td>

                        {/* Cargaison */}
                        <td className="p-3.5 font-mono">
                          <div className={cls('march', 'poidsBrutKg', 'font-extrabold text-text-primary dark:text-night-ink')}>
                            {draft.marchandisesInfo.poidsBrutKg.toLocaleString('fr-FR')} KG
                          </div>
                          <div className={cls('march', 'nombreColis', 'text-2xs text-text-muted dark:text-night-ink-2')}>
                            {draft.marchandisesInfo.nombreColis} <span className={cls('march', 'typeEmballage', '')}>{draft.marchandisesInfo.typeEmballage}</span>
                          </div>
                          <div className={`${ctrColor || 'text-2xs text-[#00875A] dark:text-night-positive font-bold'}`}>
                            {draft.conteneursInfo?.length || 0} conteneur(s){ctrColor ? '' : ''}
                          </div>
                        </td>

                        {/* Statut & Délai ETA */}
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs border ${deadlineInfo.badgeColor}`}>
                              {deadlineInfo.isLocked ? <Lock className="w-3 h-3 text-rose-600" /> : <Clock className="w-3 h-3" />}
                              <span>{deadlineInfo.badgeText}</span>
                            </span>
                            <div className="text-2xs text-text-muted dark:text-night-ink-3 font-mono">
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
                                className="px-3 py-1.5 bg-[#002B49] dark:bg-night-accent hover:bg-[#001D33] dark:hover:bg-night-accent-strong text-white dark:text-white font-extrabold text-sm rounded-md inline-flex items-center gap-1.5 shadow-1 transition-all cursor-pointer active:scale-95"
                                title="Éditer le BL BOCS officiel formaté pour papier à en-tête"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>BL Papier Entête</span>
                              </button>
                            )}

                            {/* 2. Si le draft est verrouillé ou en demande de correction */}
                            {deadlineInfo.isLocked && draft.statut !== 'VALIDE' && draft.statut !== 'BL_GENERE' && (
                              userRole === 'CLIENT_EXPORT' ? (
                                draft.statut !== 'DEMANDE_CORRECTION' ? (
                                  <button
                                    onClick={() => handleOpenCorrectionModal(draft)}
                                    className="px-3 py-1.5 bg-rose-50 dark:bg-night-critical-soft hover:bg-rose-100 dark:hover:bg-night-critical-line text-rose-700 dark:text-night-critical border border-rose-300 dark:border-night-critical-line font-extrabold text-sm rounded-md inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-1"
                                    title="Délai 24h ETA expiré. Cliquez pour soumettre une demande formelle d'amendement (50 000 FCFA HT)"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Demander Correction</span>
                                  </button>
                                ) : (
                                  <span className="px-3 py-1.5 bg-amber-50 dark:bg-night-caution-soft border border-amber-300 dark:border-night-caution-line text-amber-800 dark:text-night-caution font-bold text-sm rounded-md inline-flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>En cours d'examen</span>
                                  </span>
                                )
                              ) : (
                                /* Compte Agent Export & Admin : "Correction demandée" */
                                <button
                                  onClick={() => {
                                    setTargetDraftForApproval(draft);
                                    setCorrectionFeeType('AGENCE');
                                    setRefusalReason('');
                                    setAgentApprovalModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-amber-50 dark:bg-night-caution-soft hover:bg-amber-100 dark:hover:bg-night-caution-line text-amber-800 dark:text-night-caution border border-amber-300 dark:border-night-caution-line font-extrabold text-sm rounded-md inline-flex items-center gap-1.5 shadow-1 transition-all cursor-pointer active:scale-95"
                                  title="Traiter ou déverrouiller la demande de correction de ce draft"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Correction demandée</span>
                                </button>
                              )
                            )}

                            {/* 3. Si demande de correction explicite hors verrouillage et Agent/Admin : Examiner */}
                            {draft.statut === 'DEMANDE_CORRECTION' && !deadlineInfo.isLocked && (userRole === 'AGENT_EXPORT' || userRole === 'ADMIN') && (
                              <button
                                onClick={() => {
                                  setTargetDraftForApproval(draft);
                                  setCorrectionFeeType('AGENCE');
                                  setRefusalReason('');
                                  setAgentApprovalModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-amber-50 dark:bg-night-caution-soft hover:bg-amber-100 dark:hover:bg-night-caution-line text-amber-800 dark:text-night-caution border border-amber-300 dark:border-night-caution-line font-extrabold text-sm rounded-md inline-flex items-center gap-1.5 shadow-1 transition-all cursor-pointer active:scale-95"
                                title="Traiter ou déverrouiller la demande de correction de ce draft"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                                <span>Correction demandée</span>
                              </button>
                            )}

                            {/* 4. Si déverrouillé pour correction ou modifiable dans les délais : Modifier / Attente Ok To Print */}
                            {(!deadlineInfo.isLocked || draft.statut === 'CORRECTION_AUTORISEE') && draft.statut !== 'VALIDE' && draft.statut !== 'BL_GENERE' && (
                              userRole === 'CLIENT_EXPORT' ? (
                                <button
                                  onClick={() => handleEditDraft(draft)}
                                  className="px-3 py-1.5 bg-surface-sunken dark:bg-night-sunken hover:bg-[#F0F7FF] dark:hover:bg-night-raised text-text-primary dark:text-night-ink hover:text-[#005DAA] border border-border-default dark:border-night-line font-bold text-sm rounded-md inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-1"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>{draft.statut === 'CORRECTION_AUTORISEE' ? 'Corriger le Draft' : 'Modifier'}</span>
                                </button>
                              ) : (
                                draft.statut === 'CORRECTION_AUTORISEE' ? (
                                  <button
                                    onClick={() => handleEditDraft(draft)}
                                    className="px-3 py-1.5 bg-teal-50 dark:bg-night-sunken hover:bg-teal-100 dark:hover:bg-night-raised text-teal-800 dark:text-[#5EEAD4] border border-teal-300 dark:border-[#2DD4BF]/30 font-extrabold text-sm rounded-md inline-flex items-center gap-1.5 shadow-1 transition-all cursor-pointer active:scale-95"
                                    title="Le draft a été déverrouillé. En attente de la soumission / Ok To Print du client exportateur (cliquez pour consulter/éditer)"
                                  >
                                    <Clock className="w-3.5 h-3.5 text-teal-700" />
                                    <span>Attente Ok To Print</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleEditDraft(draft)}
                                    className="px-3 py-1.5 bg-surface-sunken dark:bg-night-sunken hover:bg-[#F0F7FF] dark:hover:bg-night-raised text-text-primary dark:text-night-ink hover:text-[#005DAA] border border-border-default dark:border-night-line font-bold text-sm rounded-md inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-1"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Modifier</span>
                                  </button>
                                )
                              )
                            )}

                            {/* 5. Si Agent/Admin et draft soumis ou brouillon : Valider en BL officiel */}
                            {(userRole === 'AGENT_EXPORT' || userRole === 'ADMIN') && (draft.statut === 'SOUMIS' || draft.statut === 'BROUILLON') && (
                              <button
                                onClick={() => handleValidateDraftByAgent(draft)}
                                className="px-3 py-1.5 bg-emerald-600 dark:bg-night-positive hover:bg-emerald-700 dark:hover:bg-night-positive text-white dark:text-night-ink font-black text-sm rounded-md inline-flex items-center gap-1.5 shadow-1 transition-all cursor-pointer active:scale-95"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Valider en BL</span>
                              </button>
                            )}

                            {/* 6. Badge de statut lisible pour les drafts sans action disponible */}
                            {draft.statut === 'DEMANDE_CORRECTION' && userRole === 'CLIENT_EXPORT' && (
                              <span className="px-3 py-1.5 bg-amber-50 dark:bg-night-caution-soft border border-amber-300 dark:border-night-caution-line text-amber-800 dark:text-night-caution font-bold text-sm rounded-md inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                <span>En cours d'examen</span>
                              </span>
                            )}

                            {/* 7. Badge correction refusée (CLIENT voit le motif) */}
                            {draft.statut === 'VERROUILLE' && draft.demandeCorrection?.statut === 'REFUSEE' && userRole === 'CLIENT_EXPORT' && (
                              <span className="px-3 py-1.5 bg-rose-50 dark:bg-night-critical-soft border border-rose-300 dark:border-night-critical-line text-rose-700 dark:text-night-critical font-bold text-sm rounded-md inline-flex items-center gap-1.5" title={`Motif: ${draft.demandeCorrection.motifRefus}`}>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Correction Refusée</span>
                              </span>
                            )}

                            {/* 8. ACCORD_AGENT : le client doit régler les frais pour débloquer la fenêtre de 2h */}
                            {draft.statut === 'ACCORD_AGENT' && userRole === 'CLIENT_EXPORT' && (
                              <button
                                onClick={() => {
                                  setTargetDraftForFeeAcceptance(draft);
                                  setClientFeeModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-emerald-600 dark:bg-night-positive hover:bg-emerald-700 dark:hover:bg-night-positive text-white dark:text-night-ink font-black text-sm rounded-md inline-flex items-center gap-1.5 shadow-1 transition-all cursor-pointer active:scale-95 animate-pulse"
                                title="L'agent a accordé la correction. Cliquez pour accepter les frais et débuter votre fenêtre de 2h."
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Régler frais &amp; Corriger</span>
                              </button>
                            )}

                            {/* 9. ACCORD_AGENT : badge pour l'agent (en attente du règlement client) */}
                            {draft.statut === 'ACCORD_AGENT' && (userRole === 'AGENT_EXPORT' || userRole === 'ADMIN') && (
                              <span className="px-3 py-1.5 bg-surface-sunken dark:bg-night-sunken border border-zinc-300 dark:border-night-line-strong text-text-secondary dark:text-night-ink font-bold text-sm rounded-md inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Attente modif. du client</span>
                              </span>
                            )}

                            {/* 10. Suppression définitive du draft (ADMIN uniquement) */}
                            {userRole === 'ADMIN' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDraftToDelete(draft);
                                  setDeleteDraftModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 bg-rose-50 dark:bg-night-critical-soft hover:bg-rose-100 dark:hover:bg-night-critical-line text-rose-700 dark:text-night-critical hover:text-rose-800 dark:hover:text-night-critical border border-rose-200 dark:border-night-critical-line hover:border-rose-300 dark:hover:border-night-critical/50 font-bold text-sm rounded-md inline-flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-1"
                                title="Supprimer définitivement ce draft (Action réservée à l'Administrateur)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Supprimer</span>
                              </button>
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-canvas dark:bg-night-surface p-6 rounded-md border border-border-default dark:border-night-line shadow-1">
            <div>
              <h1 className="text-2xl font-black text-[#002B49] dark:text-night-ink mb-1 tracking-tight flex items-center gap-2">
                <span>{editingDraftId ? 'Édition & Correction du Draft BL' : 'Saisie du Draft de BL Export'}</span>
                {editingDraftId && (
                  <span className="text-sm bg-teal-100 text-teal-800 font-extrabold px-2.5 py-0.5 rounded-full border border-teal-300">
                    Mode Correction Ouvert
                  </span>
                )}
              </h1>
              <p className="text-sm text-text-muted dark:text-night-ink-2 font-medium">
                Renseignez avec exactitude les parties, conteneurs et cargaison. Le draft sera verrouillé à 24h avant l'ETA.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraftBrouillon}
                className="px-4 py-2.5 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 dark:hover:bg-night-raised border border-zinc-300 dark:border-night-line-strong text-text-primary dark:text-night-ink font-bold text-sm rounded-md transition-all shadow-1 cursor-pointer"
              >
                Sauvegarder Brouillon
              </button>
              <button
                type="button"
                onClick={handleFinalSubmitDraft}
                className="px-5 py-2.5 bg-[#005DAA] dark:bg-night-accent hover:bg-[#004A88] text-white dark:text-white font-black text-sm rounded-md transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>{editingDraftId ? 'Transmettre le Draft Corrigé' : 'Transmettre le Draft'}</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bandeau de Sélection d'Escale, N° Booking & Calcul Délais ETA */}
          <div className="p-4 bg-surface-base dark:bg-night-sunken rounded-md border border-border-default dark:border-night-line grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="block text-xs font-bold text-text-secondary dark:text-night-ink uppercase tracking-wider mb-1">
                Escale Maritime BOCS <span className="text-rose-600">*</span>
              </label>
              <select
                value={selectedEscaleId ?? ''}
                onChange={e => setSelectedEscaleId(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] cursor-pointer"
              >
                {activeEscales.map(esc => (
                  <option key={esc.id} value={esc.id}>
                    {esc.nomNavire} — Voy. {esc.numeroVoyage}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary dark:text-night-ink uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>N° Booking <span className="text-rose-600">*</span></span>
                <span className="text-2xs text-[#005DAA] dark:text-night-link font-mono lowercase">réf. réservation</span>
              </label>
              <input
                type="text"
                value={bookingRef}
                onChange={e => setBookingRef(e.target.value)}
                placeholder="Ex: BKG-ABJ-101-001"
                className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong font-mono font-bold text-sm text-[#002B49] dark:text-night-ink focus:outline-none focus:border-[#005DAA] uppercase placeholder:font-normal placeholder:normal-case"
              />
            </div>

            <div className="p-3 bg-surface-canvas dark:bg-night-surface rounded-md border border-border-default dark:border-night-line flex flex-col justify-center">
              <div className="text-2xs text-text-muted dark:text-night-ink-2 font-bold uppercase">Date d'Arrivée Navire (ETA)</div>
              <div className="text-base font-black text-[#002B49] dark:text-night-ink font-mono mt-0.5">
                {selectedEscale?.dateArrivee || '—'}
              </div>
              <div className="text-2xs text-text-muted dark:text-night-ink-2">Port : Quai Vridi, Abidjan</div>
            </div>

            <div className="p-3 bg-[#F0F7FF] rounded-md border border-[#005DAA] dark:border-night-line/30 flex flex-col justify-center">
              <div className="text-2xs text-[#005DAA] dark:text-night-link font-black uppercase flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Délai Limite (24h avant ETA)</span>
              </div>
              <div className="text-sm font-black text-[#002B49] dark:text-night-ink font-mono mt-0.5">
                {selectedEscale?.dateArrivee ? new Date(new Date(selectedEscale.dateArrivee).getTime() - 24 * 3600 * 1000).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </div>
              <div className="text-2xs text-emerald-700 font-bold">
                Passé ce délai : verrouillage
              </div>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="bg-surface-canvas dark:bg-night-surface p-6 rounded-md border border-border-default dark:border-night-line shadow-1 space-y-6">

            <div className="relative flex justify-between w-full max-w-3xl mx-auto py-2">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-200 rounded-full -z-0"></div>
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#005DAA] dark:bg-night-accent rounded-full transition-all duration-300 -z-0"
                style={{ width: `${((step - 1) / 3) * 100}%` }}
              ></div>

              {/* Step 1 */}
              <button
                onClick={() => setStep(1)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shadow-1 border-2 transition-all ${step >= 1 ? 'bg-[#005DAA] dark:bg-night-accent text-white dark:text-white border-white ring-4 ring-[#005DAA]/20' : 'bg-surface-sunken dark:bg-night-sunken text-text-muted dark:text-night-ink-3 border-zinc-300 dark:border-night-line-strong'
                  }`}>
                  1
                </div>
                <span className={`text-sm font-bold ${step === 1 ? 'text-[#005DAA] dark:text-night-link' : 'text-text-muted dark:text-night-ink-2'}`}>
                  Infos Générales
                </span>
              </button>

              {/* Step 2 */}
              <button
                onClick={() => setStep(2)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shadow-1 border-2 transition-all ${step >= 2 ? 'bg-[#005DAA] dark:bg-night-accent text-white dark:text-white border-white ring-4 ring-[#005DAA]/20' : 'bg-surface-sunken dark:bg-night-sunken text-text-muted dark:text-night-ink-3 border-zinc-300 dark:border-night-line-strong'
                  }`}>
                  2
                </div>
                <span className={`text-sm font-bold ${step === 2 ? 'text-[#005DAA] dark:text-night-link' : 'text-text-muted dark:text-night-ink-2'}`}>
                  Détails Cargaison
                </span>
              </button>

              {/* Step 3 */}
              <button
                onClick={() => setStep(3)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shadow-1 border-2 transition-all ${step >= 3 ? 'bg-[#005DAA] dark:bg-night-accent text-white dark:text-white border-white ring-4 ring-[#005DAA]/20' : 'bg-surface-sunken dark:bg-night-sunken text-text-muted dark:text-night-ink-3 border-zinc-300 dark:border-night-line-strong'
                  }`}>
                  3
                </div>
                <span className={`text-sm font-bold ${step === 3 ? 'text-[#005DAA] dark:text-night-link' : 'text-text-muted dark:text-night-ink-2'}`}>
                  Conteneurs &amp; Plombs
                </span>
              </button>

              {/* Step 4 */}
              <button
                onClick={() => setStep(4)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shadow-1 border-2 transition-all ${step >= 4 ? 'bg-[#005DAA] dark:bg-night-accent text-white dark:text-white border-white ring-4 ring-[#005DAA]/20' : 'bg-surface-sunken dark:bg-night-sunken text-text-muted dark:text-night-ink-3 border-zinc-300 dark:border-night-line-strong'
                  }`}>
                  4
                </div>
                <span className={`text-sm font-bold ${step === 4 ? 'text-[#005DAA] dark:text-night-link' : 'text-text-muted dark:text-night-ink-2'}`}>
                  Résumé &amp; Soumission
                </span>
              </button>
            </div>

            {/* CONTENU DU FORMULAIRE */}
            <div className="pt-4 border-t border-border-default dark:border-night-line">

              {/* ÉTAPE 1: ROUTING & PARTIES */}
              {step === 1 && (
                <div className="space-y-6 text-sm animate-fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border-default dark:border-night-line pb-3">
                    <h3 className="font-black text-base text-[#002B49] dark:text-night-ink flex items-center gap-2">
                      <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link">info</span>
                      <span>Informations Générales &amp; Parties au Connaissement</span>
                    </h3>
                    <div className="flex items-center gap-2 bg-surface-base dark:bg-night-sunken px-3 py-1.5 rounded-md border border-border-default dark:border-night-line">
                      <label className="text-sm font-bold text-text-secondary dark:text-night-ink whitespace-nowrap">N° Booking :</label>
                      <input
                        type="text"
                        value={bookingRef}
                        onChange={e => setBookingRef(e.target.value)}
                        placeholder="Ex: BKG-ABJ-101-001"
                        className="h-8 px-2.5 rounded-lg bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong font-mono font-bold text-sm text-[#005DAA] dark:text-night-link focus:outline-none focus:border-[#005DAA] uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Chargeur */}
                    <div className="p-5 bg-surface-base dark:bg-night-sunken rounded-md border border-border-default dark:border-night-line space-y-3">
                      <span className="font-black text-text-primary dark:text-night-ink uppercase text-sm tracking-wider flex items-center gap-1.5">
                        <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link text-lg">person</span>
                        <span>Chargeur (Shipper)</span>
                      </span>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Nom / Raison Sociale <span className="text-rose-600 font-bold">*</span></label>
                        <input
                          type="text"
                          required
                          value={shipperNom}
                          onChange={e => setShipperNom(e.target.value)}
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Adresse Complète <span className="text-rose-600 font-bold">*</span></label>
                        <textarea
                          required
                          value={shipperAdresse}
                          onChange={e => setShipperAdresse(e.target.value)}
                          className="w-full min-h-[72px] p-2.5 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] resize-y"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Pays Expéditeur <span className="text-rose-600 font-bold">*</span></label>
                        <select
                          required
                          value={shipperPays}
                          onChange={e => setShipperPays(e.target.value)}
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink cursor-pointer focus:outline-none focus:border-[#005DAA] "
                        >
                          {PAYS_ONU.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Téléphone de contact</label>
                        <input
                          type="text"
                          value={shipperPhone}
                          onChange={e => setShipperPhone(e.target.value)}
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                          placeholder="+225 27 21 35 44 00"
                        />
                      </div>
                    </div>

                    {/* Consignataire / Destinataire */}
                    <div className="p-5 bg-surface-base dark:bg-night-sunken rounded-md border border-border-default dark:border-night-line space-y-3">
                      <span className="font-black text-text-primary dark:text-night-ink uppercase text-sm tracking-wider flex items-center gap-1.5">
                        <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link text-lg">domain</span>
                        <span>Destinataire (Consignee)</span>
                      </span>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Nom / Ordre de... <span className="text-rose-600 font-bold">*</span></label>
                        <input
                          type="text"
                          required
                          value={consigneeNom}
                          onChange={e => setConsigneeNom(e.target.value)}
                          placeholder="Chocolaterie Belge De Gand NV"
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Adresse Complète <span className="text-rose-600 font-bold">*</span></label>
                        <textarea
                          required
                          value={consigneeAdresse}
                          onChange={e => setConsigneeAdresse(e.target.value)}
                          placeholder="Havenlaan 42, 9000 Gent"
                          className="w-full min-h-[72px] p-2.5 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] resize-y"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Pays Destination <span className="text-rose-600 font-bold">*</span></label>
                        <select
                          required
                          value={consigneePays}
                          onChange={e => setConsigneePays(e.target.value)}
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink cursor-pointer focus:outline-none focus:border-[#005DAA] "
                        >
                          {PAYS_ONU.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Email Destinataire</label>
                        <input
                          type="email"
                          value={consigneeEmail}
                          onChange={e => setConsigneeEmail(e.target.value)}
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                          placeholder="import@chocogand.be"
                        />
                      </div>
                    </div>

                    {/* Notify Party */}
                    <div className="p-5 bg-surface-base dark:bg-night-sunken rounded-md border border-border-default dark:border-night-line space-y-3">
                      <span className="font-black text-text-primary dark:text-night-ink uppercase text-sm tracking-wider flex items-center gap-1.5">
                        <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link text-lg">notifications</span>
                        <span>Partie à Notifier (Notify)</span>
                      </span>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Nom Notify (ou SAME AS CONSIGNEE)</label>
                        <input
                          type="text"
                          value={notifyNom}
                          onChange={e => setNotifyNom(e.target.value)}
                          placeholder="Antwerp Maritime Logistics SA"
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Adresse Complète</label>
                        <textarea
                          value={notifyAdresse}
                          onChange={e => setNotifyAdresse(e.target.value)}
                          placeholder="Kaai 174, 2030 Antwerpen"
                          className="w-full min-h-[72px] p-2.5 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] resize-y"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Pays</label>
                        <select
                          value={notifyPays}
                          onChange={e => setNotifyPays(e.target.value)}
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink cursor-pointer focus:outline-none focus:border-[#005DAA] "
                        >
                          {PAYS_ONU.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Email Notify</label>
                        <input
                          type="email"
                          value={notifyEmail}
                          onChange={e => setNotifyEmail(e.target.value)}
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                          placeholder="ops@amlogistics.be"
                        />
                      </div>
                    </div>

                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-6 py-2.5 bg-[#005DAA] dark:bg-night-accent hover:bg-[#004A88] text-white dark:text-white font-black text-sm rounded-md shadow-1 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span>Suivant : Détails Cargaison</span>
                      <span aria-hidden="true" className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2: DÉTAILS CARGAISON */}
              {step === 2 && (
                <div className="space-y-6 text-sm animate-fade-in">
                  <h3 className="font-black text-base text-[#002B49] dark:text-night-ink border-b border-border-default dark:border-night-line pb-2 flex items-center gap-2">
                    <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link">inventory_2</span>
                    <span>Détails &amp; Nature de la Cargaison</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">
                          Description des Marchandises (B/L Goods Description) <span className="text-rose-600 font-bold">*</span>
                        </label>
                        <textarea
                          value={marchandiseDesc}
                          onChange={e => setMarchandiseDesc(e.target.value)}
                          rows={4}
                          placeholder="Ex: FÈVES DE CACAO DE CÔTE D'IVOIRE EN SACS JUTE - GRADE I - CONTRAT N° CI-BE-994"
                          className="w-full p-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] resize-y"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Code SH / Douanier (Harmonized System)</label>
                        <input
                          type="text"
                          value={hsCode}
                          onChange={e => setHsCode(e.target.value)}
                          placeholder="1801.00.00"
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-mono font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Poids Brut Total (KG)</label>
                        <input
                          type="number"
                          value={poidsBrutKg}
                          onChange={e => setPoidsBrutKg(parseFloat(e.target.value) || 0)}
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-mono font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Volume Total (M³)</label>
                        <input
                          type="number"
                          value={volumeM3}
                          onChange={e => setVolumeM3(parseFloat(e.target.value) || 0)}
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-mono font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Nombre Total Colis</label>
                        <input
                          type="number"
                          value={nombreColis}
                          onChange={e => setNombreColis(parseInt(e.target.value) || 0)}
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-mono font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">Type d'Emballage</label>
                        <select
                          value={typeEmballage}
                          onChange={e => setTypeEmballage(e.target.value)}
                          className="w-full h-10 px-3 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
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
                      className="px-4 py-2 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 text-text-secondary dark:text-night-ink font-bold rounded-md text-sm cursor-pointer border border-zinc-300 dark:border-night-line-strong"
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-6 py-2.5 bg-[#005DAA] dark:bg-night-accent hover:bg-[#004A88] text-white dark:text-white font-black text-sm rounded-md shadow-1 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span>Suivant : Conteneurs &amp; Plombs</span>
                      <span aria-hidden="true" className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 3: CONTENEURS & PLOMBS */}
              {step === 3 && (
                <div className="space-y-6 text-sm animate-fade-in">
                  <h3 className="font-black text-base text-[#002B49] dark:text-night-ink border-b border-border-default dark:border-night-line pb-2 flex items-center gap-2">
                    <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link">view_in_ar</span>
                    <span>Inventaire des Conteneurs &amp; Numéros de Plombs (Scellés)</span>
                  </h3>

                  {/* Formulaire ajout conteneur */}
                  <div className="p-4 bg-surface-base dark:bg-night-sunken rounded-md border border-border-default dark:border-night-line grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-2xs font-bold uppercase text-text-secondary dark:text-night-ink">
                          N° Conteneur <span className="text-rose-600">*</span>
                        </label>
                        {newCtnNum.trim().length >= 4 && (
                          <span className={`text-2xs font-bold ${validateContainerNumber(newCtnNum).isValid ? 'text-emerald-600 dark:text-night-positive' : 'text-rose-500'}`}>
                            {validateContainerNumber(newCtnNum).isValid ? '✓ ISO 6346' : 'Clé invalide'}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={newCtnNum}
                        onChange={e => setNewCtnNum(e.target.value.toUpperCase())}
                        onBlur={() => {
                          if (newCtnNum.trim()) {
                            const res = validateContainerNumber(newCtnNum);
                            if (!res.isValid) {
                              toastError(res.error || 'Numéro de conteneur non conforme à la norme ISO 6346.');
                            }
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddContainer();
                          }
                        }}
                        placeholder="Ex: CAIU4512408"
                        className={`w-full h-9 px-2.5 rounded-md bg-surface-canvas dark:bg-night-surface border font-mono text-sm font-bold text-text-primary dark:text-night-ink focus:outline-none transition-all ${
                          newCtnNum.trim().length >= 4
                            ? (validateContainerNumber(newCtnNum).isValid
                                ? 'border-emerald-400 focus:border-emerald-600'
                                : 'border-rose-300 focus:border-rose-500 bg-rose-50/30')
                            : 'border-zinc-300 dark:border-night-line-strong focus:border-[#005DAA] '
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold uppercase text-text-secondary dark:text-night-ink mb-1">Type</label>
                      <select
                        value={newCtnType}
                        onChange={e => setNewCtnType(e.target.value as ContainerType)}
                        className="w-full h-9 px-2 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-sm font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                      >
                        <option value="20_DRY">20' Dry</option>
                        <option value="40_DRY">40' Dry</option>
                        <option value="40_HC">40' High Cube</option>
                        <option value="20_REEFER">20' Reefer</option>
                        <option value="40_REEFER">40' Reefer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs font-bold uppercase text-text-secondary dark:text-night-ink mb-1">Plomb / Scellé</label>
                      <input
                        type="text"
                        value={newCtnScelle}
                        onChange={e => setNewCtnScelle(e.target.value)}
                        placeholder="SC-CI-1001"
                        className="w-full h-9 px-2.5 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong font-mono text-sm text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold uppercase text-text-secondary dark:text-night-ink mb-1">Poids Brut (kg)</label>
                      <input
                        type="number"
                        value={newCtnPoids}
                        onChange={e => setNewCtnPoids(parseFloat(e.target.value) || 0)}
                        className="w-full h-9 px-2.5 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong font-mono text-sm text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold uppercase text-text-secondary dark:text-night-ink mb-1">Poids Net (kg)</label>
                      <input
                        type="number"
                        value={newCtnPoidsNet}
                        onChange={e => setNewCtnPoidsNet(parseFloat(e.target.value) || 0)}
                        className="w-full h-9 px-2.5 rounded-md bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong font-mono text-sm text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleAddContainer}
                        className="w-full h-9 bg-[#005DAA] dark:bg-night-accent hover:bg-[#004A88] text-white dark:text-white font-bold text-sm rounded-md transition-all flex items-center justify-center gap-1 shadow-1 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  </div>

                  {/* Tableau des conteneurs ajoutés */}
                  <div className="border border-border-default dark:border-night-line rounded-md overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-surface-base dark:bg-night-sunken text-2xs font-black uppercase text-text-muted dark:text-night-ink-2 border-b border-border-default dark:border-night-line">
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
                      <tbody className="divide-y divide-zinc-200 dark:divide-night-line font-medium">
                        {containersList.map((ctn, i) => (
                          <tr key={i} className="hover:bg-surface-base dark:bg-night-sunken">
                            <td className="p-3 font-mono font-bold text-[#005DAA] dark:text-night-link">{ctn.numeroConteneur}</td>
                            <td className="p-3 font-semibold">{ctn.typeConteneur}</td>
                            <td className="p-3 font-mono text-text-secondary dark:text-night-ink">{ctn.numeroScelle}</td>
                            <td className="p-3 font-mono font-bold text-right text-text-primary dark:text-night-ink">{ctn.poidsKg.toLocaleString('fr-FR')} kg</td>
                            <td className="p-3 font-mono text-right text-text-secondary dark:text-night-ink">{ctn.poidsNetKg ? `${ctn.poidsNetKg.toLocaleString('fr-FR')} kg` : '-'}</td>
                            <td className="p-3 font-mono text-right text-text-secondary dark:text-night-ink">{ctn.volumeM3 ? `${ctn.volumeM3} m³` : '-'}</td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveContainer(i)}
                                className="text-rose-600 hover:text-rose-800 text-sm font-bold cursor-pointer"
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
                      className="px-4 py-2 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 text-text-secondary dark:text-night-ink font-bold rounded-md text-sm cursor-pointer border border-zinc-300 dark:border-night-line-strong"
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="px-6 py-2.5 bg-[#005DAA] dark:bg-night-accent hover:bg-[#004A88] text-white dark:text-white font-black text-sm rounded-md shadow-1 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span>Suivant : Résumé &amp; Soumission</span>
                      <span aria-hidden="true" className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ÉTAPE 4: RÉSUMÉ & SOUMISSION */}
              {step === 4 && (
                <div className="space-y-6 text-sm animate-fade-in">
                  <h3 className="font-black text-base text-[#002B49] dark:text-night-ink border-b border-border-default dark:border-night-line pb-2 flex items-center gap-2">
                    <span aria-hidden="true" className="material-symbols-outlined text-emerald-600 dark:text-night-positive">verified</span>
                    <span>Résumé Final &amp; Transmission du Connaissement</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md space-y-2">
                      <span className="font-bold text-text-primary dark:text-night-ink uppercase text-2xs block border-b border-border-default dark:border-night-line pb-1">
                        Routing Maritime &amp; Escale
                      </span>
                      <p><strong>N° Booking :</strong> <span className="font-mono font-bold text-[#005DAA] dark:text-night-link">{bookingRef || 'BKG-ABJ-AUTO'}</span></p>
                      <p><strong>Navire &amp; Voyage :</strong> {selectedEscale ? `${selectedEscale.nomNavire} - Voy. ${selectedEscale.numeroVoyage}` : '—'}</p>
                      <p><strong>Port de Chargement :</strong> ABIDJAN (Quai Vridi)</p>
                      <p><strong>Port de Déchargement :</strong> {consigneePays}</p>
                      <p><strong>Chargeur :</strong> {shipperNom} ({shipperPays})</p>
                      <p><strong>Destinataire :</strong> {consigneeNom} ({consigneePays})</p>
                    </div>

                    <div className="p-4 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md space-y-2">
                      <span className="font-bold text-text-primary dark:text-night-ink uppercase text-2xs block border-b border-border-default dark:border-night-line pb-1">
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
                  <div className="p-4 bg-emerald-50 dark:bg-night-positive-soft border border-emerald-300 rounded-md flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-black text-emerald-900 text-base">Prêt pour la transmission à l'agence BOCS</h4>
                      <p className="text-emerald-800 text-sm mt-0.5">
                        Délai de transmission respecté (24h avant ETA). Ce draft sera transmis directement à l'Agent Export pour validation.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleFinalSubmitDraft}
                      className="px-6 py-3 bg-emerald-600 dark:bg-night-positive hover:bg-emerald-700 dark:hover:bg-night-positive text-white dark:text-night-ink font-black text-base rounded-md transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 whitespace-nowrap"
                    >
                      <Send className="w-4 h-4" />
                      <span>Transmettre le Draft</span>
                    </button>
                  </div>

                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-4 py-2 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 text-text-secondary dark:text-night-ink font-bold rounded-md text-sm cursor-pointer border border-zinc-300 dark:border-night-line-strong"
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
          Réservé aux agents & admins — le client export n'y a jamais accès.
      ══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'CONSOLIDATION' && canViewConsolidation && (
        <div className="space-y-6">

          {/* Header Consolidation */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface-canvas dark:bg-night-surface p-6 rounded-md border border-border-default dark:border-night-line shadow-1">
            <div>
              <h1 className="text-2xl font-black text-[#002B49] dark:text-night-ink tracking-tight mb-1">
                Manifeste Export — Consolidation de l'Escale
              </h1>
              <p className="text-sm text-text-muted dark:text-night-ink-2 font-medium">
                Consolidation automatique de tous les connaissements (BLs) validés par l'agent pour l'escale sélectionnée.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">

              {/* Choix de l'escale */}
              <select
                value={selectedEscaleId ?? ''}
                onChange={e => setSelectedEscaleId(Number(e.target.value))}
                className="px-3.5 py-2 bg-surface-base dark:bg-night-sunken border border-zinc-300 dark:border-night-line-strong rounded-md text-sm font-extrabold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] cursor-pointer"
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
                  if (!selectedEscale) {
                    toastWarning('Aucune escale sélectionnée.');
                    return;
                  }
                  if (validatedDraftsForManifest.length === 0) {
                    toastWarning('Aucun BL validé pour cette escale. Veuillez valider au moins un draft pour générer le manifeste.');
                    return;
                  }
                  generateExportManifestPdf(selectedEscale, validatedDraftsForManifest);
                  onLogAudit('GENERATION_MANIFESTE_EXPORT', 'ManifesteExport', `Génération du manifeste export PDF pour l'escale ${selectedEscale.nomNavire} Voy ${selectedEscale.numeroVoyage}`);
                }}
                className="bg-[#002B49] dark:bg-night-accent hover:bg-[#001D33] dark:hover:bg-night-accent-strong text-white dark:text-white font-black px-4 py-2 rounded-md text-sm flex items-center gap-1.5 transition-all shadow-1 cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Générer Manifeste (PDF)</span>
              </button>

              {/* Bouton Exporter CSV */}
              <button
                onClick={() => {
                  if (!selectedEscale) {
                    toastWarning('Aucune escale sélectionnée.');
                    return;
                  }
                  if (validatedDraftsForManifest.length === 0) {
                    toastWarning('Aucun BL validé pour cette escale.');
                    return;
                  }
                  exportExportManifestCsv(validatedDraftsForManifest, selectedEscale.nomNavire);
                }}
                className="bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 dark:hover:bg-night-raised border border-zinc-300 dark:border-night-line-strong text-text-primary dark:text-night-ink font-bold px-3 py-2 rounded-md text-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>

            </div>
          </div>

          {/* KPI Bento Grid — Données réelles consolidées */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <div className="bg-surface-canvas dark:bg-night-surface p-5 rounded-md border border-border-default dark:border-night-line shadow-1 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-text-muted dark:text-night-ink-2 uppercase">BLs Validés</span>
                <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-night-accent-soft text-[#005DAA] dark:text-night-link flex items-center justify-center font-black">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-[#002B49] dark:text-night-ink font-mono">
                {validatedDraftsForManifest.length}
              </div>
              <div className="text-2xs text-text-muted dark:text-night-ink-3 mt-1">Connaissements consolidés</div>
            </div>

            <div className="bg-surface-canvas dark:bg-night-surface p-5 rounded-md border border-border-default dark:border-night-line shadow-1 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-text-muted dark:text-night-ink-2 uppercase">Conteneurs (TEU)</span>
                <div className="w-8 h-8 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center font-black">
                  <span aria-hidden="true" className="material-symbols-outlined text-lg">view_in_ar</span>
                </div>
              </div>
              <div className="text-3xl font-black text-teal-700 font-mono">
                {totalContainersManifest}
              </div>
              <div className="text-2xs text-text-muted dark:text-night-ink-3 mt-1">Unités conteneurisées</div>
            </div>

            <div className="bg-surface-canvas dark:bg-night-surface p-5 rounded-md border border-border-default dark:border-night-line shadow-1 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-text-muted dark:text-night-ink-2 uppercase">Poids Brut Total</span>
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-night-positive-soft text-emerald-700 flex items-center justify-center font-black">
                  <span aria-hidden="true" className="material-symbols-outlined text-lg">scale</span>
                </div>
              </div>
              <div className="text-3xl font-black text-emerald-700 font-mono">
                {(totalWeightKgManifest / 1000).toFixed(1)} <span className="text-base font-sans font-bold">Tonnes</span>
              </div>
              <div className="text-2xs text-text-muted dark:text-night-ink-3 mt-1">{totalWeightKgManifest.toLocaleString('fr-FR')} KG bruts</div>
            </div>

            <div className="bg-surface-canvas dark:bg-night-surface p-5 rounded-md border border-border-default dark:border-night-line shadow-1 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-text-muted dark:text-night-ink-2 uppercase">Volume Total</span>
                <div className="w-8 h-8 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center font-black">
                  <span aria-hidden="true" className="material-symbols-outlined text-lg">grid_view</span>
                </div>
              </div>
              <div className="text-3xl font-black text-purple-700 font-mono">
                {totalVolumeM3Manifest > 0 ? totalVolumeM3Manifest.toFixed(1) : '-'} <span className="text-base font-sans font-bold">M³</span>
              </div>
              <div className="text-2xs text-text-muted dark:text-night-ink-3 mt-1">{totalColisManifest.toLocaleString('fr-FR')} colis au manifeste</div>
            </div>

          </div>

          {/* Tableau de Consolidation */}
          <div className="bg-surface-canvas dark:bg-night-surface rounded-md border border-border-default dark:border-night-line shadow-1 overflow-hidden">

            <div className="p-4 bg-surface-base dark:bg-night-sunken border-b border-border-default dark:border-night-line flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-[#002B49] dark:text-night-ink uppercase tracking-wider">
                  Registre des Connaissements au Manifeste Export — {selectedEscale ? `${selectedEscale.nomNavire} Voy ${selectedEscale.numeroVoyage}` : 'Aucune escale'}
                </h3>
                <p className="text-2xs text-text-muted dark:text-night-ink-2 font-medium">Seuls les drafts validés par l'agent constituent le manifeste officiel.</p>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[380px] bocs-scrollbar relative">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 bg-surface-sunken dark:bg-night-sunken z-10 shadow-1">
                  <tr className="bg-surface-sunken dark:bg-night-sunken text-2xs font-black uppercase text-text-secondary dark:text-night-ink border-b border-border-default dark:border-night-line">
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
                <tbody className="divide-y divide-zinc-200 dark:divide-night-line font-medium">
                  {validatedDraftsForManifest.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-text-muted dark:text-night-ink-3">
                        <span aria-hidden="true" className="material-symbols-outlined text-4xl block mb-2 text-text-muted">inventory_2</span>
                        <span>Aucun BL validé pour cette escale. Les drafts doivent être validés par l'agent pour être consolidés dans le manifeste.</span>
                      </td>
                    </tr>
                  ) : (
                    validatedDraftsForManifest.map((draft, idx) => (
                      <tr
                        key={draft.id}
                        onDoubleClick={() => handleEditDraft(draft)}
                        className="hover:bg-[#F0F7FF] dark:hover:bg-night-raised transition-colors cursor-pointer select-none group"
                        title="💡 Double-cliquez pour ouvrir ce draft en mode modification"
                      >
                        <td className="p-3 font-mono font-extrabold text-[#005DAA] dark:text-night-link">
                          {draft.numeroBlGenere || draft.numeroDraft}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-text-primary dark:text-night-ink">{draft.shipperInfo.nom}</div>
                          <div className="text-2xs text-text-muted dark:text-night-ink-2">{draft.shipperInfo.pays}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-text-primary dark:text-night-ink">{draft.consigneeInfo.nom}</div>
                          <div className="text-2xs text-text-muted dark:text-night-ink-2">{draft.consigneeInfo.pays}</div>
                        </td>
                        <td className="p-3 font-bold text-emerald-800">
                          {draft.portDechargementNom || draft.portDechargementCode || 'EUROPE'}
                        </td>
                        <td className="p-3 max-w-[220px]">
                          <div className="truncate font-medium text-text-primary dark:text-night-ink">{draft.marchandisesInfo.description}</div>
                          <div className="text-2xs text-text-muted dark:text-night-ink-2 font-mono">SH: {draft.marchandisesInfo.hsCode || '-'}</div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-[#002B49] dark:text-night-ink">
                          {draft.conteneursInfo?.length || 0}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-text-primary dark:text-night-ink">
                          {draft.marchandisesInfo.poidsBrutKg.toLocaleString('fr-FR')}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handlePrintBlLetterhead(draft)}
                            className="p-1.5 text-[#005DAA] dark:text-night-link hover:bg-[#F0F7FF] dark:hover:bg-night-raised rounded-lg border border-transparent hover:border-[#005DAA] dark:border-night-line/30 transition-all cursor-pointer"
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
        <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => setCorrectionModalOpen(false))} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-canvas dark:bg-night-surface rounded-md max-w-lg w-full shadow-2xl dark:shadow-black/70 border border-border-default dark:border-night-line overflow-hidden animate-scale-in">

            <div className="bg-gradient-to-r from-rose-50 to-amber-50 dark:from-night-critical-soft dark:to-night-surface p-5 border-b border-rose-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-text-primary dark:text-night-ink">
                  Demande de Déverrouillage &amp; Correction de Draft
                </h3>
                <p className="text-xs text-text-secondary dark:text-night-ink font-medium">
                  Draft {targetDraftForCorrection.numeroDraft} • Délai 24h avant ETA dépassé
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-sm">

              {/* Notice Réglementaire & Frais */}
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-md text-amber-900 space-y-1.5">
                <div className="font-extrabold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Conditions de modification après ETA (Agence BOCS)</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-800">
                  Conformément aux procédures maritimes et douanières, le connaissement est verrouillé pour sécuriser le manifeste. Toute réouverture nécessite l'approbation de l'agent consignataire et donne lieu à une facturation forfaitaire d'amendement :
                </p>
                <div className="flex items-center justify-between p-2 bg-surface-canvas dark:bg-night-surface rounded-lg border border-amber-200 font-mono font-bold text-amber-950">
                  <span>Frais Forfaitaires d'Amendement BL :</span>
                  <span className="text-base font-black text-rose-700">50 000 FCFA HT</span>
                </div>
              </div>

              {/* Champ Motif de la correction */}
              <div>
                <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">
                  Motif détaillé de la correction demandée <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={motifCorrection}
                  onChange={e => setMotifCorrection(e.target.value)}
                  rows={3}
                  placeholder="Ex: Rectification du nom du destinataire suite à avenant commercial, correction du numéro de scellé conteneur..."
                  className="w-full p-3 rounded-md bg-surface-base dark:bg-night-sunken border border-zinc-300 dark:border-night-line-strong text-sm font-medium text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] resize-y"
                  required
                />
              </div>

              {/* Case à cocher obligatoire d'acceptation de facturation */}
              <label className="flex items-start gap-2.5 p-3 rounded-md border border-border-default dark:border-night-line bg-surface-base dark:bg-night-sunken hover:bg-surface-sunken cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={fraisAcceptes}
                  onChange={e => setFraisAcceptes(e.target.checked)}
                  className="w-4 h-4 text-[#005DAA] dark:text-night-link rounded mt-0.5 cursor-pointer"
                />
                <span className="text-xs text-text-primary dark:text-night-ink font-bold leading-tight select-none">
                  J'accepte expressément la facturation des frais d'amendement de <strong>50 000 FCFA HT</strong> qui seront portés sur une facture de régularisation BOCS.
                </span>
              </label>

            </div>

            <div className="p-4 bg-surface-base dark:bg-night-sunken border-t border-border-default dark:border-night-line flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCorrectionModalOpen(false)}
                className="px-4 py-2 bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-text-secondary dark:text-night-ink font-bold text-sm rounded-md hover:bg-surface-sunken transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmitCorrectionRequest}
                disabled={!fraisAcceptes || !motifCorrection.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white dark:text-night-ink font-black text-sm rounded-md shadow-1 transition-all cursor-pointer flex items-center gap-1.5"
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
        <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => setAgentApprovalModalOpen(false))} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-canvas dark:bg-night-surface rounded-md max-w-xl w-full shadow-2xl dark:shadow-black/70 border border-border-default dark:border-night-line overflow-hidden animate-scale-in">

            <div className="bg-[#002B49] text-white dark:text-night-ink p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-surface-canvas dark:bg-night-surface/10 text-white dark:text-night-ink flex items-center justify-center shrink-0 font-black">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-white dark:text-night-ink">
                  Traitement Demande d'Amendement BL Export
                </h3>
                <p className="text-xs text-text-muted font-medium">
                  Draft {targetDraftForApproval.numeroDraft}{targetDraftForApproval.numeroBlGenere ? ` → BL ${targetDraftForApproval.numeroBlGenere}` : ''} • Client : {targetDraftForApproval.clientNom}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-sm">

              {/* Résumé du motif client */}
              <div className="p-3 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md space-y-1">
                <div className="text-2xs uppercase font-bold text-text-muted dark:text-night-ink-2">Motif transmis par le client :</div>
                <div className="text-text-primary dark:text-night-ink font-bold italic bg-surface-canvas dark:bg-night-surface p-2.5 rounded-lg border border-border-default dark:border-night-line">
                  "{targetDraftForApproval.demandeCorrection?.motif}"
                </div>
                <div className="text-2xs text-text-muted dark:text-night-ink-2 font-mono mt-1">
                  Demandé le : {targetDraftForApproval.demandeCorrection?.dateDemande} • Frais acceptés par le client
                </div>
              </div>

              {/* Choix du type de facturation */}
              <div className="space-y-2">
                <div className="text-2xs uppercase font-black text-text-secondary dark:text-night-ink tracking-wider">Type de facturation de rectification :</div>

                <label className={`flex items-start gap-3 p-3 rounded-md border-2 cursor-pointer transition-all ${correctionFeeType === 'AGENCE' ? 'border-[#005DAA] dark:border-night-line bg-[#F0F7FF]' : 'border-border-default dark:border-night-line bg-surface-canvas dark:bg-night-surface hover:bg-surface-base '
                  }`}>
                  <input
                    type="radio"
                    name="correctionFeeType"
                    checked={correctionFeeType === 'AGENCE'}
                    onChange={() => setCorrectionFeeType('AGENCE')}
                    className="mt-0.5 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="font-black text-text-primary dark:text-night-ink">Frais d'agence uniquement</div>
                    <div className="text-xs text-text-secondary dark:text-night-ink font-medium">Frais de gestion agence BOCS pour révision/amendement du BL</div>
                    <div className="font-mono font-black text-[#005DAA] dark:text-night-link mt-1">50 000 FCFA HT = 50 000 FCFA TTC — Export non assujetti à la TVA (0 %)</div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-md border-2 cursor-pointer transition-all ${correctionFeeType === 'AGENCE_DOUANE' ? 'border-amber-500 bg-amber-50' : 'border-border-default dark:border-night-line bg-surface-canvas dark:bg-night-surface hover:bg-surface-base '
                  }`}>
                  <input
                    type="radio"
                    name="correctionFeeType"
                    checked={correctionFeeType === 'AGENCE_DOUANE'}
                    onChange={() => setCorrectionFeeType('AGENCE_DOUANE')}
                    className="mt-0.5 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="font-black text-text-primary dark:text-night-ink">Frais d'agence + Frais de douane</div>
                    <div className="text-xs text-text-secondary dark:text-night-ink font-medium">Révision BL en agence (50 000) + Rectification déclaration douane (25 000)</div>
                    <div className="font-mono font-black text-amber-700 mt-1">75 000 FCFA HT = 75 000 FCFA TTC — Export non assujetti à la TVA (0 %)</div>
                  </div>
                </label>
              </div>

              {/* Personnalisation / Ajustement des montants de frais */}
              <div className="p-3 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md space-y-2">
                <div className="text-2xs uppercase font-black text-text-secondary dark:text-night-ink tracking-wider">Ajuster / Modifier les montants de frais HT (FCFA) :</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-bold text-text-secondary dark:text-night-ink mb-1">Frais d'Agence HT</label>
                    <input
                      type="number"
                      value={fraisAgenceAmount}
                      onChange={e => setFraisAgenceAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong rounded-lg text-sm font-mono font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                    />
                  </div>
                  {correctionFeeType === 'AGENCE_DOUANE' && (
                    <div>
                      <label className="block text-2xs font-bold text-text-secondary dark:text-night-ink mb-1">Frais Douane HT</label>
                      <input
                        type="number"
                        value={fraisDouaneAmount}
                        onChange={e => setFraisDouaneAmount(Math.max(0, Number(e.target.value)))}
                        className="w-full px-3 py-1.5 bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong rounded-lg text-sm font-mono font-bold text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] "
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Récapitulatif */}
              <div className="p-3 bg-emerald-50 dark:bg-night-positive-soft border border-emerald-300 rounded-md flex items-center justify-between">
                <div>
                  <div className="font-black text-emerald-900 text-sm">Facture de rectification à émettre :</div>
                  <div className="text-xs text-emerald-800">Rattachée au BL {targetDraftForApproval.numeroBlGenere || targetDraftForApproval.numeroDraft}</div>
                </div>
                <span className="text-base font-black font-mono text-emerald-800 bg-surface-canvas dark:bg-night-surface px-3 py-1.5 rounded-lg border border-emerald-300">
                  {(correctionFeeType === 'AGENCE_DOUANE' ? (fraisAgenceAmount + fraisDouaneAmount) : fraisAgenceAmount).toLocaleString('fr-FR')} FCFA HT
                </span>
              </div>

              <p className="text-xs text-text-secondary dark:text-night-ink leading-relaxed">
                En acceptant :
                <br />• Le draft est immédiatement <strong>déverrouillé</strong> pour le client.
                <br />• Une <strong>facture de rectification</strong> ({correctionFeeType === 'AGENCE_DOUANE' ? 'Frais agence + Frais douane' : 'Frais d\'agence'}) est émise automatiquement et rattachée au BL.
              </p>

            </div>

            <div className="p-4 bg-surface-base dark:bg-night-sunken border-t border-border-default dark:border-night-line flex justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAgentApprovalModalOpen(false)}
                  className="px-4 py-2 bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-text-secondary dark:text-night-ink font-bold text-sm rounded-md hover:bg-surface-sunken transition-all cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRefuseModalOpen(true);
                    setRefusalReason('');
                  }}
                  className="px-4 py-2 bg-rose-50 dark:bg-night-critical-soft hover:bg-rose-100 dark:hover:bg-night-critical-line text-rose-700 dark:text-night-critical border border-rose-300 dark:border-night-critical-line font-bold text-sm rounded-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Refuser la Demande</span>
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleApproveCorrection(false)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white dark:text-night-ink font-black text-sm rounded-md shadow-1 transition-all cursor-pointer flex items-center gap-1.5"
                  title="Envoie l'accord au client — il devra accepter les frais pour activer ses 2h"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Autoriser (client règle les frais)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveCorrection(true)}
                  className="px-4 py-2 bg-emerald-600 dark:bg-night-positive hover:bg-emerald-700 dark:hover:bg-night-positive text-white dark:text-night-ink font-black text-sm rounded-md shadow-1 transition-all cursor-pointer flex items-center gap-1.5"
                  title="Active immédiatement la fenêtre de 2h et émet la facture"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Activer 2h maintenant</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALE 3 : REFUS DE LA DEMANDE DE CORRECTION (AGENT / ADMIN)
      ══════════════════════════════════════════════════════════════════ */}
      {refuseModalOpen && targetDraftForApproval && (
        <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => setRefuseModalOpen(false))} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-canvas dark:bg-night-surface rounded-md max-w-md w-full shadow-2xl dark:shadow-black/70 border border-rose-300 overflow-hidden animate-scale-in">
            <div className="bg-rose-600 text-white dark:text-night-ink p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-surface-canvas dark:bg-night-surface/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base">Refus de la Demande de Correction</h3>
                <p className="text-xs text-rose-200">{targetDraftForApproval.numeroDraft} • {targetDraftForApproval.clientNom}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-secondary dark:text-night-ink font-medium leading-relaxed">
                En refusant cette demande, le draft restera <strong>verrouillé</strong>. Le client sera informé du motif de refus et pourra soumettre une nouvelle demande si nécessaire.
              </p>
              <div>
                <label className="block text-sm font-bold text-text-primary dark:text-night-ink mb-1">
                  Motif de refus <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={refusalReason}
                  onChange={e => setRefusalReason(e.target.value)}
                  rows={3}
                  placeholder="Ex: Demande incomplète, document justificatif manquant, informations insuffisantes..."
                  className="w-full p-3 rounded-md bg-surface-base dark:bg-night-sunken border border-zinc-300 dark:border-night-line-strong text-sm font-medium text-text-primary dark:text-night-ink focus:outline-none focus:border-rose-500 resize-y"
                />
              </div>
            </div>
            <div className="p-4 bg-surface-base dark:bg-night-sunken border-t border-border-default dark:border-night-line flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefuseModalOpen(false)}
                className="px-4 py-2 bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-text-secondary dark:text-night-ink font-bold text-sm rounded-md hover:bg-surface-sunken transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRefuseCorrection}
                disabled={!refusalReason.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white dark:text-night-ink font-black text-sm rounded-md shadow-1 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Confirmer le Refus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALE 4 : ACCEPTATION DES FRAIS PAR LE CLIENT (ACCORD_AGENT → 2h)
      ══════════════════════════════════════════════════════════════════ */}
      {clientFeeModalOpen && targetDraftForFeeAcceptance && (
        <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => setClientFeeModalOpen(false))} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-canvas dark:bg-night-surface rounded-md max-w-lg w-full shadow-2xl dark:shadow-black/70 border border-emerald-300 overflow-hidden animate-scale-in">

            <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white dark:text-night-ink p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-surface-canvas dark:bg-night-surface/15 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base">Acceptation des Frais de Correction</h3>
                <p className="text-xs text-emerald-100 font-medium">
                  Draft {targetDraftForFeeAcceptance.numeroDraft} • Client : {targetDraftForFeeAcceptance.clientNom}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-sm">

              {/* Accord de l'agent */}
              <div className="p-3.5 bg-emerald-50 dark:bg-night-positive-soft border border-emerald-300 rounded-md flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-night-positive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-black text-emerald-900">L'Agent BOCS a accordé votre demande de correction</div>
                  <div className="text-xs text-emerald-800 leading-relaxed">
                    Pour activer votre fenêtre de modification de <strong>2 heures</strong>, vous devez accepter la facturation des frais d'amendement ci-dessous.
                  </div>
                </div>
              </div>

              {/* Détail des frais */}
              <div className="p-4 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md space-y-2">
                <div className="text-2xs uppercase font-black text-text-secondary dark:text-night-ink tracking-wider">Détail de la facturation</div>
                <div className="flex items-center justify-between p-3 bg-surface-canvas dark:bg-night-surface rounded-lg border border-border-default dark:border-night-line">
                  <div>
                    <div className="font-bold text-text-primary dark:text-night-ink">Frais d'amendement BL Export</div>
                    <div className="text-xs text-text-muted dark:text-night-ink-2">
                      Révision/correction du BL {targetDraftForFeeAcceptance.numeroBlGenere || targetDraftForFeeAcceptance.numeroDraft} après ETA
                    </div>
                  </div>
                  <span className="font-mono font-black text-rose-700 text-base">
                    {(targetDraftForFeeAcceptance.demandeCorrection?.montantFrais || 50000).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                <div className="text-2xs text-text-muted dark:text-night-ink-2 font-medium">
                  ⚠ Une facture de régularisation sera automatiquement émise et mise à disposition dans votre espace facturation.
                </div>
              </div>

              {/* Compte à rebours info */}
              <div className="p-3.5 bg-teal-50 border border-teal-300 rounded-md flex items-start gap-3">
                <Clock className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-black text-teal-900">⏱ Fenêtre de correction : 2 heures chrono</div>
                  <div className="text-xs text-teal-800 leading-relaxed">
                    Dès validation des frais, un compte à rebours de <strong>2h exactement</strong> s'activera. Passé ce délai, votre draft sera à nouveau verrouillé.
                    <br />Votre draft corrigé, une fois soumis, sera <strong>automatiquement « Ok To Print »</strong> pour l'agent et <strong>définitivement verrouillé</strong> côté client.
                  </div>
                </div>
              </div>

            </div>

            <div className="p-4 bg-surface-base dark:bg-night-sunken border-t border-border-default dark:border-night-line flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setClientFeeModalOpen(false)}
                className="px-4 py-2 bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-text-secondary dark:text-night-ink font-bold text-sm rounded-md hover:bg-surface-sunken transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleClientAcceptFeesAndStartCorrection(targetDraftForFeeAcceptance)}
                className="px-5 py-2 bg-emerald-600 dark:bg-night-positive hover:bg-emerald-700 dark:hover:bg-night-positive text-white dark:text-night-ink font-black text-sm rounded-md shadow-1 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Accepter les frais &amp; Activer ma fenêtre de 2h</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALE 5 : CONFIRMATION DE SUPPRESSION D'UN DRAFT (ADMIN UNIQUEMENT)
      ══════════════════════════════════════════════════════════════════ */}
      {deleteDraftModalOpen && draftToDelete && (
        <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => setDeleteDraftModalOpen(false))} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-canvas dark:bg-night-surface rounded-md max-w-md w-full shadow-2xl dark:shadow-black/70 border border-rose-300 overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 text-white dark:text-night-ink p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-surface-canvas dark:bg-night-surface/15 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-white dark:text-night-ink" />
              </div>
              <div>
                <h3 className="font-black text-base text-white dark:text-night-ink">Suppression Définitive du Draft</h3>
                <p className="text-xs text-rose-200 font-medium">
                  Action réservée exclusivement à l'Administrateur
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="p-3 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted dark:text-night-ink-2 font-medium">N° Draft :</span>
                  <span className="font-bold font-mono text-text-primary dark:text-night-ink">{draftToDelete.numeroDraft}</span>
                </div>
                {draftToDelete.numeroBlGenere && (
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted dark:text-night-ink-2 font-medium">N° BL :</span>
                    <span className="font-bold font-mono text-emerald-700">{draftToDelete.numeroBlGenere}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-text-muted dark:text-night-ink-2 font-medium">Client / Chargeur :</span>
                  <span className="font-bold text-text-primary dark:text-night-ink">{draftToDelete.clientNom || draftToDelete.shipperInfo?.nom}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted dark:text-night-ink-2 font-medium">Navire / Voyage :</span>
                  <span className="font-medium text-text-secondary dark:text-night-ink">{draftToDelete.navireNom || '—'} (Voy. {draftToDelete.numeroVoyage || '—'})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted dark:text-night-ink-2 font-medium">Statut actuel :</span>
                  <span className="font-bold uppercase text-text-primary dark:text-night-ink">{draftToDelete.statut}</span>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-800 leading-relaxed">
                  <strong>Attention :</strong> Cette action est <strong>irréversible</strong>. Le draft sera définitivement retiré du système et de la consolidation du manifeste export.
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface-base dark:bg-night-sunken border-t border-border-default dark:border-night-line flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteDraftModalOpen(false);
                  setDraftToDelete(null);
                }}
                className="px-4 py-2 bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong text-text-secondary dark:text-night-ink font-bold text-sm rounded-md hover:bg-surface-sunken transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDraft}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white dark:text-night-ink font-black text-sm rounded-md shadow-1 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer la suppression</span>
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
        <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => setValidationErrors([]))} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-canvas dark:bg-night-surface rounded-md max-w-md w-full shadow-2xl dark:shadow-black/70 border border-rose-300 overflow-hidden animate-scale-in">
            <div className="bg-rose-50 p-5 border-b border-rose-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-rose-200 text-rose-800 flex items-center justify-center font-bold">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary dark:text-night-ink text-base">Champs obligatoires manquants</h3>
                <p className="text-xs text-rose-700 font-medium">Veuillez compléter les informations requises</p>
              </div>
            </div>

            <div className="p-5 max-h-[300px] overflow-y-auto space-y-2">
              <ul className="space-y-1.5 pl-5 list-disc text-text-primary dark:text-night-ink text-sm font-bold">
                {validationErrors.map((err, idx) => (
                  <li key={idx} className="text-rose-700">
                    {err}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-surface-base dark:bg-night-sunken border-t border-border-default dark:border-night-line flex justify-end">
              <button
                type="button"
                onClick={() => setValidationErrors([])}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white dark:text-night-ink font-bold text-sm rounded-md shadow-1 transition-all cursor-pointer"
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
