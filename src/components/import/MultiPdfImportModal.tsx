import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Escale, BL, Container, FretCategory } from '../../types';
import { 
  extractRawTextFromPdf, 
  parseManifestBlsFromPdfText,
  ExtractedBlItem 
} from '../../utils/pdfExtractor';
import { ExtractedBlEditModal } from './ExtractedBlEditModal';
import { useEscapeClose, overlayClickClose } from '../../hooks/useEscapeClose';
import { 
  Upload, 
  FileText, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Ship, 
  Package, 
  X, 
  Eye, 
  ArrowRight,
  Sparkles,
  Scan,
  Edit3,
  Check,
  ShieldAlert,
  Calendar,
  Anchor
} from 'lucide-react';

export interface EscaleCommitGroup {
  escale: Escale;
  bls: BL[];
  isNewEscale: boolean;
}

interface MultiPdfImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  escales: Escale[];
  activeEscaleId?: number | 'ALL';
  onCommitGroups?: (groups: EscaleCommitGroup[]) => void;
  onCommitBls?: (escale: Escale, bls: BL[], isNewEscale: boolean) => void;
  initialFiles?: File[];
  onRequestCreateEscale?: () => void;
}

export const MultiPdfImportModal: React.FC<MultiPdfImportModalProps> = ({
  isOpen,
  onClose,
  escales,
  activeEscaleId,
  onCommitGroups,
  onCommitBls,
  initialFiles,
  onRequestCreateEscale
}) => {
  const [items, setItems] = useState<ExtractedBlItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Audit UX : Échap (sommet de pile) + clic sur l'arrière-plan ferment la modale.
  // La modale d'édition imbriquée (ExtractedBlEditModal) est au sommet de la pile :
  // Échap ne ferme qu'elle en premier.
  useEscapeClose(isOpen, onClose);

  // Escale choisie par l'utilisateur (par défaut l'escale activement ouverte)
  const [selectedTargetEscaleId, setSelectedTargetEscaleId] = useState<number>(() => {
    if (typeof activeEscaleId === 'number' && activeEscaleId > 0) {
      return activeEscaleId;
    }
    return escales.length > 0 ? escales[0].id : 0;
  });

  // Synchronisation avec activeEscaleId dès l'ouverture et réinitialisation à la fermeture
  useEffect(() => {
    if (isOpen) {
      if (typeof activeEscaleId === 'number' && activeEscaleId > 0) {
        setSelectedTargetEscaleId(activeEscaleId);
      } else if (escales.length > 0 && (!selectedTargetEscaleId || !escales.some(e => e.id === selectedTargetEscaleId))) {
        setSelectedTargetEscaleId(escales[0].id);
      }
    } else {
      setItems([]);
      setEditingDetailItem(null);
    }
  }, [isOpen, activeEscaleId, escales]);

  // Escale active ciblée
  const currentTargetEscale = useMemo(() => {
    return escales.find(e => e.id === selectedTargetEscaleId) || escales[0];
  }, [escales, selectedTargetEscaleId]);

  // Modale d'édition détaillée pour un BL spécifique
  const [editingDetailItem, setEditingDetailItem] = useState<ExtractedBlItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Traitement d'une liste de fichiers et extraction multi-BLs
  const processFiles = async (files: File[]) => {
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) return;

    // Placeholders temporaires pendant l'extraction
    const placeholders: ExtractedBlItem[] = pdfFiles.map(f => ({
      fileId: `placeholder-${f.name}-${Date.now()}-${Math.random()}`,
      fileName: f.name,
      fileSize: f.size,
      status: 'EXTRACTING',
      wasOcr: false,
      numeroBL: 'ANALYSE EN COURS...',
      shipperNom: '',
      shipperAdresse: '',
      consigneeNom: 'Extraction du manifeste...',
      consigneeAdresse: '',
      notifyNom: '',
      notifyAdresse: '',
      portChargementCode: currentTargetEscale ? currentTargetEscale.portChargement : 'BEANR',
      portDechargementCode: currentTargetEscale ? currentTargetEscale.portDechargement : 'CIABJ',
      destinationFinale: 'CI',
      descriptionGoods: '',
      marquesEtNumeros: '',
      nombreColis: 1,
      typeEmballage: 'COLIS',
      poidsBrutKg: 0,
      volumeM3: 0,
      typeMarchandise: 'CONVENTIONNEL',
      conteneurs: [],
      nomNavire: currentTargetEscale ? currentTargetEscale.nomNavire : '',
      numeroVoyage: currentTargetEscale ? currentTargetEscale.numeroVoyage : ''
    }));

    setItems(prev => [...prev, ...placeholders]);

    // Extraction asynchrone pour chaque PDF
    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      const targetPlaceholder = placeholders[i];

      try {
        const { text: rawText, wasOcr } = await extractRawTextFromPdf(file);
        const extractedBls = parseManifestBlsFromPdfText(rawText, file.name);

        if (extractedBls.length > 0) {
          const populatedItems: ExtractedBlItem[] = extractedBls.map((bl, bIdx) => ({
            ...bl,
            fileId: `${file.name}-${bl.numeroBL || bIdx}-${Date.now()}-${Math.random()}`,
            fileName: file.name,
            fileSize: file.size,
            status: 'SUCCESS',
            rawText,
            wasOcr,
            nomNavire: currentTargetEscale ? currentTargetEscale.nomNavire : bl.nomNavire,
            numeroVoyage: currentTargetEscale ? currentTargetEscale.numeroVoyage : bl.numeroVoyage
          }));

          setItems(prev => {
            const withoutPlaceholder = prev.filter(item => item.fileId !== targetPlaceholder.fileId);
            return [...withoutPlaceholder, ...populatedItems];
          });
        } else {
          setItems(prev => prev.map(item => {
            if (item.fileId === targetPlaceholder.fileId) {
              return {
                ...item,
                status: 'ERROR',
                errorMessage: 'Aucun connaissement détecté dans ce document'
              };
            }
            return item;
          }));
        }
      } catch (err: any) {
        setItems(prev => prev.map(item => {
          if (item.fileId === targetPlaceholder.fileId) {
            return {
              ...item,
              status: 'ERROR',
              errorMessage: err?.message || 'Erreur lors de la lecture du document'
            };
          }
          return item;
        }));
      }
    }
  };

  // Traitement des initialFiles à l'ouverture
  useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      processFiles(initialFiles);
    }
  }, [isOpen, initialFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleUpdateItemField = (fileId: string, field: keyof ExtractedBlItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.fileId === fileId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleRemoveItem = (fileId: string) => {
    setItems(prev => prev.filter(i => i.fileId !== fileId));
  };

  const handleClearAll = () => {
    setItems([]);
  };

  // Validation et intégration : tous les BLs sont rattachés à l'escale choisie par l'utilisateur
  const handleCommit = () => {
    const validItems = items.filter(i => i.status === 'SUCCESS');
    if (validItems.length === 0 || !currentTargetEscale) return;

    const newBls: BL[] = validItems.map((item, idx) => {
      const blId = Date.now() + idx + 1;
      const conteneursWithBlId: Container[] = item.conteneurs.map((c, cIdx) => ({
        ...c,
        id: Date.now() + 10000 + (idx * 50) + cIdx,
        blId
      }));

      return {
        id: blId,
        escaleId: currentTargetEscale.id,
        numeroBL: item.numeroBL || `BL-${Date.now()}-${idx + 1}`,
        typeOperation: 'IMPORT',
        shipperNom: item.shipperNom || 'EXPÉDITEUR NON SPÉCIFIÉ',
        shipperAdresse: item.shipperAdresse || '',
        consigneeNom: item.consigneeNom || 'DESTINATAIRE NON SPÉCIFIÉ',
        consigneeAdresse: item.consigneeAdresse || '',
        notifyNom: item.notifyNom || item.consigneeNom || 'TO ORDER',
        notifyAdresse: item.notifyAdresse || '',
        portChargementCode: item.portChargementCode || currentTargetEscale.portChargement || 'BEANR',
        portDechargementCode: item.portDechargementCode || currentTargetEscale.portDechargement || 'CIABJ',
        destinationFinale: item.destinationFinale || 'CI',
        descriptionGoods: item.descriptionGoods || 'MARCHANDISES DIVERSES',
        marquesEtNumeros: item.marquesEtNumeros || `MARQUES & N° BL ${item.numeroBL}`,
        nombreColis: item.nombreColis || 1,
        typeEmballage: item.typeEmballage || 'COLIS',
        poidsBrutKg: item.poidsBrutKg || 0,
        volumeM3: item.volumeM3 || 0,
        statutImport: 'EN_ATTENTE',
        conteneurs: conteneursWithBlId
      };
    });

    if (onCommitGroups) {
      onCommitGroups([{
        escale: currentTargetEscale,
        bls: newBls,
        isNewEscale: false
      }]);
    } else if (onCommitBls) {
      onCommitBls(currentTargetEscale, newBls, false);
    }

    onClose();
  };

  const validCount = items.filter(i => i.status === 'SUCCESS').length;
  const extractingCount = items.filter(i => i.status === 'EXTRACTING').length;

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in font-sans" onClick={overlayClickClose(onClose)}>
      <div className="bg-surface-canvas dark:bg-night-surface rounded-lg w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl dark:shadow-black/70 border border-border-default dark:border-night-line overflow-hidden">
        
        {/* ── HEADER MODALE ── */}
        <div className="px-6 py-4 border-b border-border-default dark:border-night-line flex items-center justify-between bg-surface-base dark:bg-night-sunken/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-[#005DAA] dark:bg-night-ink/10 text-[#005DAA] dark:text-night-ink flex items-center justify-center border border-[#005DAA] dark:border-night-line/20 shadow-1">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-950 font-display tracking-tight flex items-center gap-2">
                <span>Centre de Chargement &amp; Extraction des Manifestes</span>
                <span className="text-sm font-mono font-black px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30 flex items-center gap-1">
                  <Scan className="w-3 h-3" />
                  Multi-BLs &amp; OCR
                </span>
              </h2>
              <p className="text-sm text-text-muted dark:text-night-ink-2 font-medium">
                Sélectionnez les manifestes à charger. Tous les connaissements extraits seront rattachés à l'escale sélectionnée.
              </p>
            </div>
          </div>

          <button
            aria-label="Fermer"
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-md hover:bg-zinc-200 text-text-muted dark:text-night-ink-3 hover:text-text-primary transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── CORPS DE LA MODALE ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 1. Sélecteur Majeur d'Escale (L'utilisateur choisit son escale de rattachement) */}
          <div className="bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md p-4.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-md bg-[#005DAA] dark:bg-night-ink/10 text-[#005DAA] dark:text-night-link flex items-center justify-center border border-[#005DAA] dark:border-night-line/20 shrink-0">
                  <Ship className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-2xs font-black uppercase tracking-wider text-[#005DAA] dark:text-night-link font-mono block">
                    Escale Maritime de Rattachement (Sélection Utilisateur)
                  </span>
                  <span className="text-sm text-text-secondary dark:text-night-ink font-medium">
                    Tous les connaissements de ces manifestes seront rattachés à cette escale :
                  </span>
                </div>
              </div>

              {/* Menu déroulant de sélection d'escale */}
              <div className="w-full sm:w-auto min-w-[340px]">
                {escales.length > 0 ? (
                  <select
                    value={selectedTargetEscaleId}
                    onChange={(e) => setSelectedTargetEscaleId(Number(e.target.value))}
                    className="w-full bg-surface-canvas dark:bg-night-surface border border-zinc-300 dark:border-night-line-strong rounded-md px-3.5 py-2 font-bold text-sm text-text-primary dark:text-night-ink focus:outline-none focus:border-[#005DAA] shadow-1 cursor-pointer"
                  >
                    {escales.map((esc) => (
                      <option key={esc.id} value={esc.id}>
                        🚢 {esc.nomNavire} — Voyage {esc.numeroVoyage} ({esc.portChargement} → {esc.portDechargement})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-md">
                      Aucune escale disponible. L'escale doit être créée avant l'import.
                    </span>
                    {onRequestCreateEscale && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onRequestCreateEscale();
                        }}
                        className="px-3 py-1.5 bg-[#005DAA] dark:bg-night-accent hover:bg-[#004580] dark:hover:bg-night-accent-strong text-white dark:text-white text-sm font-bold rounded-md transition-all cursor-pointer inline-flex items-center gap-1 shadow-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Créer une escale</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Fiche récapitulative de l'escale sélectionnée */}
            {currentTargetEscale && (
              <div className="pt-2 border-t border-border-default dark:border-night-line flex flex-wrap items-center gap-4 text-sm font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted dark:text-night-ink-2 font-bold text-xs">Navire :</span>
                  <span className="font-black text-text-primary dark:text-night-ink bg-surface-canvas dark:bg-night-surface px-2 py-0.5 rounded border border-border-default dark:border-night-line">
                    {currentTargetEscale.nomNavire}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted dark:text-night-ink-2 font-bold text-xs">Voyage :</span>
                  <span className="font-black text-[#005DAA] dark:text-night-link bg-[#F0F7FF] px-2 py-0.5 rounded border border-[#005DAA] dark:border-night-line/30">
                    {currentTargetEscale.numeroVoyage}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted dark:text-night-ink-2 font-bold text-xs">Ligne :</span>
                  <span className="text-text-secondary dark:text-night-ink font-medium">
                    {currentTargetEscale.portChargement} → {currentTargetEscale.portDechargement}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted dark:text-night-ink-2 font-bold text-xs">Date prévue :</span>
                  <span className="text-text-secondary dark:text-night-ink font-medium">
                    {currentTargetEscale.dateArrivee || 'Non fixée'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Zone de Dépôt Drag & Drop + Sélecteur Fichiers */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 sm:p-7 text-center transition-all cursor-pointer ${
              isDragOver 
                ? 'border-[#005DAA] dark:border-night-line bg-[#F0F7FF]/60 scale-[0.99]' 
                : 'border-zinc-300 dark:border-night-line-strong hover:border-[#005DAA] bg-surface-base dark:bg-night-sunken/50 hover:bg-surface-base '
            }`}
            onClick={() => {
              if (escales.length === 0) {
                if (onRequestCreateEscale) {
                  onClose();
                  onRequestCreateEscale();
                }
                return;
              }
              fileInputRef.current?.click();
            }}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              multiple 
              accept=".pdf" 
              className="hidden" 
              onChange={handleFileSelect} 
            />

            <div className="max-w-md mx-auto space-y-2.5">
              <div className="w-12 h-12 mx-auto rounded-md bg-[#005DAA] dark:bg-night-ink/10 text-[#005DAA] dark:text-night-link border border-[#005DAA] dark:border-night-line/20 flex items-center justify-center shadow-1">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-black text-zinc-950">
                  {escales.length > 0 
                    ? `Sélectionnez les manifestes PDF à rattacher à ${currentTargetEscale?.nomNavire || 'l\'escale'}`
                    : "Veuillez d'abord créer une escale avant de sélectionner des manifestes"}
                </p>
                <p className="text-sm text-text-muted dark:text-night-ink-2 font-medium">
                  {escales.length > 0
                    ? `Tous les connaissements extraits seront directement rattachés à l'escale (Voyage ${currentTargetEscale?.numeroVoyage || ''}).`
                    : "L'escale maritime doit être préalablement créée par l'utilisateur."}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1 text-xs font-mono text-text-muted dark:text-night-ink-2">
                <span className="px-2 py-0.5 rounded-md bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line">1 PDF = N BLs</span>
                <span className="px-2 py-0.5 rounded-md bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line">Conteneurs ISO</span>
                <span className="px-2 py-0.5 rounded-md bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line">Vrac &amp; Silos</span>
                <span className="px-2 py-0.5 rounded-md bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line">BSC / FDI</span>
              </div>
            </div>
          </div>

          {/* 3. File d'attente des BLs extraits */}
          {items.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-mono text-sm">
                  <span className="font-black text-zinc-950 uppercase tracking-wider">
                    Connaissements détectés ({validCount})
                  </span>
                  <span className="h-3.5 w-px bg-zinc-300" />
                  <span className="font-bold text-emerald-700">{validCount} prêt(s) pour l'escale</span>
                  {extractingCount > 0 && (
                    <>
                      <span className="h-3.5 w-px bg-zinc-300" />
                      <span className="font-bold text-sky-600 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#005DAA] dark:text-night-link" />
                        <span>Extraction en cours ({extractingCount} document(s)...)</span>
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-surface-canvas dark:bg-night-surface hover:bg-surface-base border border-zinc-300 dark:border-night-line-strong text-text-primary dark:text-night-ink rounded-md text-sm font-black flex items-center gap-1.5 transition-all shadow-1 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#005DAA] dark:text-night-link" />
                    <span>Ajouter d'autres manifestes PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-3 py-1.5 text-text-muted dark:text-night-ink-2 hover:text-rose-600 rounded-md text-sm font-bold transition-colors cursor-pointer"
                  >
                    Vider la liste
                  </button>
                </div>
              </div>

              {/* Table de vérification & ajustement des BLs avant validation */}
              <div className="border border-border-default dark:border-night-line rounded-md overflow-hidden bg-surface-canvas dark:bg-night-surface shadow-1">
                <div className="overflow-x-auto max-h-[440px] bocs-scrollbar">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-surface-sunken/80 border-b border-border-default dark:border-night-line sticky top-0 z-10 text-xs font-mono uppercase tracking-wider text-text-secondary dark:text-night-ink">
                        <th className="p-3 pl-4">Manifeste Source</th>
                        <th className="p-3">N° Connaissement (BL)</th>
                        <th className="p-3">Fret / Marchandise</th>
                        <th className="p-3">Destinataire (Consignee)</th>
                        <th className="p-3">Poids Brut (kg)</th>
                        <th className="p-3">Colis / Ctr</th>
                        <th className="p-3">Réf. Douane</th>
                        <th className="p-3 text-right pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-night-line">
                      {items.map((item) => {
                        const isExtracting = item.status === 'EXTRACTING';
                        const isError = item.status === 'ERROR';

                        return (
                          <tr 
                            key={item.fileId} 
                            onClick={() => !isExtracting && setEditingDetailItem(item)}
                            className="hover:bg-sky-50/50 cursor-pointer transition-colors group"
                            title="Cliquer pour ouvrir et corriger tous les champs de ce connaissement"
                          >
                            {/* Manifeste source & statut */}
                            <td className="p-3 pl-4">
                              <div className="flex items-center gap-2 max-w-[190px]">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  isExtracting 
                                    ? 'bg-sky-50 text-sky-600 border border-sky-200' 
                                    : isError 
                                      ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                                      : 'bg-emerald-50 dark:bg-night-positive-soft text-emerald-700 border border-emerald-200 dark:border-night-positive-line'
                                }`}>
                                  {isExtracting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : isError ? (
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                </div>
                                <div className="truncate">
                                  <p className="font-mono font-bold text-text-primary dark:text-night-ink truncate group-hover:text-[#005DAA] transition-colors" title={item.fileName}>
                                    {item.fileName}
                                  </p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {item.status === 'SUCCESS' && (
                                      item.wasOcr ? (
                                        <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 text-2xs font-mono font-bold flex items-center gap-0.5">
                                          <Scan className="w-2.5 h-2.5" />
                                          OCR Scanné
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-night-positive-soft text-emerald-700 border border-emerald-200 dark:border-night-positive-line text-2xs font-mono font-bold">
                                          PDF Texte
                                        </span>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* N° BL (Éditable en ligne) */}
                            <td className="p-3" onClick={e => e.stopPropagation()}>
                              {isExtracting ? (
                                <div className="h-6 w-28 bg-surface-sunken dark:bg-night-sunken animate-pulse rounded-md" />
                              ) : (
                                <input
                                  type="text"
                                  value={item.numeroBL}
                                  onChange={e => handleUpdateItemField(item.fileId, 'numeroBL', e.target.value.toUpperCase())}
                                  className="font-mono font-black text-sm text-[#005DAA] dark:text-night-link bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line hover:border-zinc-300 focus:border-[#005DAA] px-2.5 py-1 rounded-lg w-36 uppercase focus:bg-surface-canvas focus:outline-none transition-colors"
                                  placeholder="N° BL"
                                />
                              )}
                            </td>

                            {/* Catégorie Fret & Description */}
                            <td className="p-3" onClick={e => e.stopPropagation()}>
                              {isExtracting ? (
                                <div className="h-6 w-28 bg-surface-sunken dark:bg-night-sunken animate-pulse rounded-md" />
                              ) : (
                                <div className="space-y-1 max-w-[210px]">
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={item.typeMarchandise}
                                      onChange={e => handleUpdateItemField(item.fileId, 'typeMarchandise', e.target.value as FretCategory)}
                                      className={`text-2xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border cursor-pointer focus:outline-none ${
                                        item.typeMarchandise === 'CONTENEUR' 
                                          ? 'bg-blue-50 dark:bg-night-accent-soft text-blue-900 border-blue-300' 
                                          : item.typeMarchandise === 'RORO' 
                                            ? 'bg-emerald-50 dark:bg-night-positive-soft text-emerald-900 border-emerald-300' 
                                            : item.typeMarchandise === 'VRAC' 
                                              ? 'bg-amber-50 text-amber-900 border-amber-300' 
                                              : 'bg-indigo-50 text-indigo-900 border-indigo-300'
                                      }`}
                                    >
                                      <option value="CONTENEUR">CONTENEUR ({item.conteneurs.length})</option>
                                      <option value="RORO">RORO</option>
                                      <option value="VRAC">VRAC</option>
                                      <option value="CONVENTIONNEL">CONVENTIONNEL</option>
                                    </select>
                                    {item.isDangerous && (
                                      <span className="p-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300" title={`Matière Dangereuse IMO ${item.imoClass || ''} UN ${item.unCode || ''}`}>
                                        <ShieldAlert className="w-3 h-3" />
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-2xs text-text-secondary dark:text-night-ink truncate font-medium" title={item.descriptionGoods}>
                                    {item.descriptionGoods}
                                  </p>
                                </div>
                              )}
                            </td>

                            {/* Destinataire Consignee (Éditable en ligne) */}
                            <td className="p-3" onClick={e => e.stopPropagation()}>
                              {isExtracting ? (
                                <div className="h-6 w-36 bg-surface-sunken dark:bg-night-sunken animate-pulse rounded-md" />
                              ) : (
                                <input
                                  type="text"
                                  value={item.consigneeNom}
                                  onChange={e => handleUpdateItemField(item.fileId, 'consigneeNom', e.target.value)}
                                  className="font-black text-sm text-zinc-950 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line hover:border-zinc-300 focus:border-[#005DAA] px-2 py-1 rounded-lg w-36 focus:bg-surface-canvas focus:outline-none transition-colors truncate"
                                  placeholder="Nom du Destinataire"
                                  title={item.consigneeNom}
                                />
                              )}
                            </td>

                            {/* Poids Brut (Éditable en ligne) */}
                            <td className="p-3" onClick={e => e.stopPropagation()}>
                              {isExtracting ? (
                                <div className="h-6 w-20 bg-surface-sunken dark:bg-night-sunken animate-pulse rounded-md" />
                              ) : (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={item.poidsBrutKg || ''}
                                    onChange={e => handleUpdateItemField(item.fileId, 'poidsBrutKg', parseFloat(e.target.value) || 0)}
                                    className="font-mono font-black text-sm text-zinc-950 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line hover:border-zinc-300 focus:border-[#005DAA] px-2 py-1 rounded-lg w-24 text-right focus:bg-surface-canvas focus:outline-none transition-colors"
                                  />
                                  <span className="text-2xs font-mono text-text-muted dark:text-night-ink-2 font-bold">kg</span>
                                </div>
                              )}
                            </td>

                            {/* Colis / Volume */}
                            <td className="p-3">
                              {isExtracting ? (
                                <div className="h-6 w-16 bg-surface-sunken dark:bg-night-sunken animate-pulse rounded-md" />
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="font-mono font-black text-text-primary dark:text-night-ink text-sm block">
                                    {item.nombreColis} <span className="text-text-muted dark:text-night-ink-2 font-normal text-2xs">{item.typeEmballage}</span>
                                  </span>
                                  {item.volumeM3 > 0 && (
                                    <span className="text-2xs font-mono text-text-muted dark:text-night-ink-2 block">
                                      {item.volumeM3} m³
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Références Réglementaires */}
                            <td className="p-3">
                              {isExtracting ? (
                                <div className="h-6 w-20 bg-surface-sunken dark:bg-night-sunken animate-pulse rounded-md" />
                              ) : (
                                <div className="space-y-0.5 font-mono text-2xs">
                                  {item.bscNumero ? (
                                    <span className="px-1.5 py-0.5 rounded bg-surface-sunken dark:bg-night-sunken text-text-secondary dark:text-night-ink border border-border-default dark:border-night-line block truncate" title={`BSC: ${item.bscNumero}`}>
                                      BSC: {item.bscNumero}
                                    </span>
                                  ) : null}
                                  {item.fdiNumero ? (
                                    <span className="px-1.5 py-0.5 rounded bg-surface-sunken dark:bg-night-sunken text-text-secondary dark:text-night-ink border border-border-default dark:border-night-line block truncate" title={`FDI: ${item.fdiNumero}`}>
                                      FDI: {item.fdiNumero}
                                    </span>
                                  ) : null}
                                  {!item.bscNumero && !item.fdiNumero && (
                                    <span className="text-text-muted dark:text-night-ink-3 italic text-2xs">-</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Actions : Aperçu & Suppression */}
                            <td className="p-3 text-right pr-4" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingDetailItem(item)}
                                  className="p-1.5 text-text-muted dark:text-night-ink-2 hover:text-[#005DAA] hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                  title="Consulter et ajuster tous les champs du BL"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.fileId)}
                                  className="p-1.5 text-text-muted dark:text-night-ink-3 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Retirer ce connaissement"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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

        </div>

        {/* ── PIED DE LA MODALE AVEC BOUTON D'ACTION ── */}
        <div className="px-6 py-4 border-t border-border-default dark:border-night-line flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-base dark:bg-night-sunken/90">
          <div className="text-sm text-text-secondary dark:text-night-ink font-medium">
            {validCount > 0 ? (
              <span className="flex items-center gap-1.5 font-bold text-text-primary dark:text-night-ink">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-night-positive" />
                <span>
                  {validCount} connaissement(s) prêt(s) à être rattaché(s) à l'escale <strong>{currentTargetEscale?.nomNavire}</strong> (Voyage <strong>{currentTargetEscale?.numeroVoyage}</strong>).
                </span>
              </span>
            ) : (
              <span>Chargez un ou plusieurs manifestes PDF pour lancer l'analyse maritime.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-md border border-zinc-300 dark:border-night-line-strong bg-surface-canvas dark:bg-night-surface hover:bg-surface-sunken text-text-secondary dark:text-night-ink font-bold text-sm transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={validCount === 0 || extractingCount > 0 || !currentTargetEscale}
              className={`px-6 py-2.5 rounded-md text-sm font-black transition-all flex items-center gap-2 cursor-pointer shadow-md  active:scale-95 ${
                validCount > 0 && extractingCount === 0 && currentTargetEscale
                  ? 'bg-[#005DAA] dark:bg-night-accent hover:bg-[#004580] dark:hover:bg-night-accent-strong text-white dark:text-white'
                  : 'bg-zinc-200 text-text-muted dark:text-night-ink-3 cursor-not-allowed border border-zinc-300 dark:border-night-line-strong'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Rattacher les {validCount} connaissement(s) à l'escale {currentTargetEscale?.nomNavire || ''}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Modale d'édition et correction complète d'un BL */}
      <ExtractedBlEditModal
        item={editingDetailItem}
        isOpen={Boolean(editingDetailItem)}
        onClose={() => setEditingDetailItem(null)}
        onSave={(updated) => {
          setItems(prev => prev.map(item => item.fileId === updated.fileId ? updated : item));
          setEditingDetailItem(null);
        }}
      />

    </div>
  );
};
