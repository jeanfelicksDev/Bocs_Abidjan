import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Check, 
  Box, 
  Plus, 
  Trash2, 
  Edit3, 
  FileText, 
  Ship, 
  Building2, 
  Package, 
  ShieldAlert, 
  Scale
} from 'lucide-react';
import { ExtractedBlItem } from '../../utils/pdfExtractor';
import { Container, ContainerType, FretCategory } from '../../types';
import { useEscapeClose, overlayClickClose } from '../../hooks/useEscapeClose';

interface ExtractedBlEditModalProps {
  item: ExtractedBlItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedItem: ExtractedBlItem) => void;
}

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

export const ExtractedBlEditModal: React.FC<ExtractedBlEditModalProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<ExtractedBlItem | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'parties' | 'goods' | 'customs' | 'containers'>('general');

  useEffect(() => {
    if (item) {
      // Clone en profondeur l'item pour une modification sûre
      setForm(JSON.parse(JSON.stringify(item)));
      setActiveTab('general');
    } else {
      setForm(null);
    }
  }, [item, isOpen]);

  // Audit UX : Échap (sommet de pile) + clic sur l'arrière-plan ferment la modale.
  useEscapeClose(isOpen, onClose);

  if (!isOpen || !form) return null;

  const handleUpdateField = <K extends keyof ExtractedBlItem>(field: K, value: ExtractedBlItem[K]) => {
    setForm(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleAddContainer = () => {
    if (!form) return;
    const newCtr: Container = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      blId: 0,
      numeroConteneur: '',
      typeConteneur: '40_HC',
      numeroScelle: '',
      poidsKg: 0,
      tareKg: 3800,
      nombreColis: 1,
      montantCautionFcfa: 250000,
      statutLivraison: 'AU_PARC'
    };
    setForm({
      ...form,
      conteneurs: [...form.conteneurs, newCtr],
      typeMarchandise: 'CONTENEUR'
    });
  };

  const handleUpdateContainer = (index: number, field: keyof Container, value: any) => {
    if (!form) return;
    const updatedCtrs = [...form.conteneurs];
    updatedCtrs[index] = { ...updatedCtrs[index], [field]: value };
    setForm({
      ...form,
      conteneurs: updatedCtrs
    });
  };

  const handleRemoveContainer = (index: number) => {
    if (!form) return;
    const updatedCtrs = form.conteneurs.filter((_, i) => i !== index);
    setForm({
      ...form,
      conteneurs: updatedCtrs
    });
  };

  const handleSyncPoidsFromContainers = () => {
    if (!form || form.conteneurs.length === 0) return;
    const sum = form.conteneurs.reduce((acc, c) => acc + (Number(c.poidsKg) || 0), 0);
    if (sum > 0) {
      setForm({ ...form, poidsBrutKg: sum });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numeroBL.trim()) {
      alert("Le numéro de connaissement (N° BL) est obligatoire.");
      return;
    }
    onSave(form);
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/65 backdrop-blur-sm animate-fade-in"
      style={{ zIndex: 99999 }}
      onClick={overlayClickClose(onClose)}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-7xl max-h-[96vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden relative"
        style={{ zIndex: 100000 }}
      >
        
        {/* ── EN-TÊTE MODALE AGRANDI ── */}
        <div className="px-7 sm:px-10 py-5 sm:py-6 border-b border-zinc-200 bg-zinc-50/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#005DAA]/10 border border-[#005DAA]/25 flex items-center justify-center text-[#005DAA] shadow-xs shrink-0">
              <Edit3 className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-zinc-950 font-mono tracking-tight">
                  Correction du BL : <span className="text-[#005DAA]">{form.numeroBL || 'SANS NUMÉRO'}</span>
                </h3>
                {form.conteneurs.length > 0 ? (
                  <span className="px-3 py-1 rounded-xl text-xs sm:text-sm font-black bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/30">
                    {form.conteneurs.length} CONTENEURS
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-xl text-xs sm:text-sm font-bold bg-zinc-200 text-zinc-800">
                    {form.typeMarchandise || 'CONVENTIONNEL'}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 font-mono mt-1 truncate max-w-xl" title={form.fileName}>
                Document source : <strong className="text-zinc-700">{form.fileName || 'Saisie directe'}</strong> {form.wasOcr ? '• Détecté par OCR' : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl hover:bg-zinc-200/80 text-zinc-400 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Fermer (Échap)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ── ONGLETS DE NAVIGATION THÉMATIQUES AGRANDIS ── */}
        <div className="flex items-center gap-2 px-7 sm:px-10 pt-4 pb-3 border-b border-zinc-200 bg-white overflow-x-auto shrink-0 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'general'
                ? 'bg-[#002B49] text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Ship className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>1. BL &amp; Transport</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('parties')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'parties'
                ? 'bg-[#002B49] text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Building2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>2. Chargeur &amp; Destinataire</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('goods')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'goods'
                ? 'bg-[#002B49] text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Package className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>3. Marchandise &amp; Poids</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('containers')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'containers'
                ? 'bg-[#002B49] text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Box className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>4. Conteneurs ({form.conteneurs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customs')}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'customs'
                ? 'bg-[#002B49] text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>5. Douanes &amp; Réf.</span>
          </button>
        </div>

        {/* ── CONTENU DU FORMULAIRE (SCROLLABLE) AGRANDI ── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-7 sm:p-10 space-y-7 sm:space-y-8 bg-zinc-50/40">

          {/* TAB 1: BL & TRANSPORT */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-3">
                  <label className="text-xs sm:text-sm font-mono font-black text-zinc-700 uppercase tracking-wide block">
                    Numéro de Connaissement (BL) *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.numeroBL}
                    onChange={e => handleUpdateField('numeroBL', e.target.value.toUpperCase())}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3.5 font-mono font-black text-base sm:text-lg text-[#005DAA] focus:bg-white focus:border-[#005DAA] focus:outline-none transition-all uppercase shadow-2xs"
                    placeholder="ex: ANRABJ26614101"
                  />
                  <p className="text-xs text-zinc-500 font-medium">Identifiant unique officiel du connaissement figurant sur le manifeste douanier.</p>
                </div>

                <div className="p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-3">
                  <label className="text-xs sm:text-sm font-mono font-black text-zinc-700 uppercase tracking-wide block">
                    Catégorie de Fret Maritime
                  </label>
                  <select
                    value={form.typeMarchandise}
                    onChange={e => handleUpdateField('typeMarchandise', e.target.value as FretCategory)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3.5 font-bold text-base sm:text-lg text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none transition-all cursor-pointer shadow-2xs"
                  >
                    <option value="CONTENEUR">CONTENEUR (FCL / LCL)</option>
                    <option value="CONVENTIONNEL">CONVENTIONNEL (Breakbulk / Divers)</option>
                    <option value="VRAC">VRAC (Solide ou Liquide)</option>
                    <option value="RORO">RORO (Véhicules &amp; Roulants)</option>
                  </select>
                  <p className="text-xs text-zinc-500 font-medium">Définit le barème de facturation et les rubriques applicables à ce dossier.</p>
                </div>
              </div>

              <div className="p-6 sm:p-7 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                  <Ship className="w-4 h-4 text-[#005DAA]" />
                  <span className="text-xs sm:text-sm font-mono font-black text-zinc-800 uppercase tracking-wide">
                    Acheminement &amp; Ports du Dossier
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-600 uppercase block">Port de Chargement</label>
                    <input
                      type="text"
                      value={form.portChargementCode || ''}
                      onChange={e => handleUpdateField('portChargementCode', e.target.value.toUpperCase())}
                      placeholder="ex: BEANR / ANVERS"
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 text-sm sm:text-base font-bold text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none uppercase shadow-2xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-600 uppercase block">Port de Déchargement</label>
                    <input
                      type="text"
                      value={form.portDechargementCode || ''}
                      onChange={e => handleUpdateField('portDechargementCode', e.target.value.toUpperCase())}
                      placeholder="ex: CIABJ / ABIDJAN"
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 text-sm sm:text-base font-bold text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none uppercase shadow-2xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-600 uppercase block">Destination Finale</label>
                    <input
                      type="text"
                      value={form.destinationFinale || ''}
                      onChange={e => handleUpdateField('destinationFinale', e.target.value.toUpperCase())}
                      placeholder="ex: CI / CÔTE D'IVOIRE"
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 text-sm sm:text-base font-bold text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none uppercase shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TIERS (SHIPPER, CONSIGNEE, NOTIFY) */}
          {activeTab === 'parties' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chargeur (Shipper) */}
                <div className="p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <label className="text-xs sm:text-sm font-mono font-black text-zinc-800 uppercase">
                      Chargeur / Expéditeur (Shipper)
                    </label>
                    <span className="text-xs text-zinc-400 font-mono">Partie expéditrice</span>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={form.shipperNom || ''}
                      onChange={e => handleUpdateField('shipperNom', e.target.value)}
                      placeholder="Raison sociale ou Nom complet de l'expéditeur"
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-bold text-sm sm:text-base text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                    />
                    <textarea
                      value={form.shipperAdresse || ''}
                      onChange={e => handleUpdateField('shipperAdresse', e.target.value)}
                      placeholder="Adresse complète du chargeur (rue, ville, pays)"
                      rows={3}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-zinc-700 focus:bg-white focus:border-[#005DAA] focus:outline-none resize-none shadow-2xs"
                    />
                  </div>
                </div>

                {/* Destinataire (Consignee) */}
                <div className="p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <label className="text-xs sm:text-sm font-mono font-black text-zinc-800 uppercase">
                      Destinataire Réceptionnaire (Consignee) *
                    </label>
                    <span className="text-xs text-[#00875A] font-bold font-mono">Client facturable</span>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={form.consigneeNom || ''}
                      onChange={e => handleUpdateField('consigneeNom', e.target.value)}
                      placeholder="Raison sociale du destinataire réceptionnaire à Abidjan"
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-black text-sm sm:text-base text-zinc-950 focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                    />
                    <textarea
                      value={form.consigneeAdresse || ''}
                      onChange={e => handleUpdateField('consigneeAdresse', e.target.value)}
                      placeholder="Adresse complète, Boîte Postale, téléphone du destinataire"
                      rows={3}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-zinc-700 focus:bg-white focus:border-[#005DAA] focus:outline-none resize-none shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Partie à Notifier (Notify) */}
              <div className="p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <label className="text-xs sm:text-sm font-mono font-black text-zinc-800 uppercase">
                    Partie à Notifier (Notify Party)
                  </label>
                  <span className="text-xs text-zinc-400 font-mono">Transitaire ou déclarant</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={form.notifyNom || ''}
                    onChange={e => handleUpdateField('notifyNom', e.target.value)}
                    placeholder="Nom de la partie à notifier (ex: SAME AS CONSIGNEE ou nom du transitaire)"
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-bold text-sm sm:text-base text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                  />
                  <input
                    type="text"
                    value={form.notifyAdresse || ''}
                    onChange={e => handleUpdateField('notifyAdresse', e.target.value)}
                    placeholder="Adresse / Contact du déclarant notifié"
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 text-xs sm:text-sm text-zinc-700 focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MARCHANDISE & POIDS */}
          {activeTab === 'goods' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-3">
                  <label className="text-xs sm:text-sm font-mono font-black text-zinc-800 uppercase block">
                    Description / Désignation de la Marchandise
                  </label>
                  <textarea
                    value={form.descriptionGoods || ''}
                    onChange={e => handleUpdateField('descriptionGoods', e.target.value)}
                    placeholder="ex: 18 PACKAGES SODIUM SILICATE 200-49..."
                    rows={4}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-medium text-sm sm:text-base text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                  />
                </div>

                <div className="p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-3">
                  <label className="text-xs sm:text-sm font-mono font-black text-zinc-800 uppercase block">
                    Marques &amp; Numéros (Colisage &amp; Références)
                  </label>
                  <textarea
                    value={form.marquesEtNumeros || ''}
                    onChange={e => handleUpdateField('marquesEtNumeros', e.target.value)}
                    placeholder="ex: AS PER BL / MARQUES DIVERSES"
                    rows={4}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-mono font-bold text-sm sm:text-base text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="p-5 sm:p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-black text-zinc-600 uppercase block">
                      Poids Brut (kg) *
                    </label>
                    <Scale className="w-4 h-4 text-[#005DAA]" />
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={form.poidsBrutKg || ''}
                    onChange={e => handleUpdateField('poidsBrutKg', parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-mono font-black text-lg sm:text-xl text-[#005DAA] focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                  />
                  {form.conteneurs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSyncPoidsFromContainers}
                      className="text-xs font-bold text-[#005DAA] hover:underline cursor-pointer flex items-center gap-1 mt-1"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>Somme des CTR ({form.conteneurs.reduce((acc, c) => acc + (Number(c.poidsKg) || 0), 0).toLocaleString('fr-FR')} kg)</span>
                    </button>
                  )}
                </div>

                <div className="p-5 sm:p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-2">
                  <label className="text-xs font-mono font-black text-zinc-600 uppercase block">
                    Volume Total (m³)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.volumeM3 || ''}
                    onChange={e => handleUpdateField('volumeM3', parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-mono font-bold text-base sm:text-lg text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                  />
                  <p className="text-[11px] text-zinc-400">Volume cubique déclaré</p>
                </div>

                <div className="p-5 sm:p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-2">
                  <label className="text-xs font-mono font-black text-zinc-600 uppercase block">
                    Nombre Total Colis
                  </label>
                  <input
                    type="number"
                    value={form.nombreColis || ''}
                    onChange={e => handleUpdateField('nombreColis', parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-mono font-bold text-base sm:text-lg text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                  />
                  <p className="text-[11px] text-zinc-400">Quantité d'unités de fret</p>
                </div>

                <div className="p-5 sm:p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-2">
                  <label className="text-xs font-mono font-black text-zinc-600 uppercase block">
                    Type d'Emballage
                  </label>
                  <input
                    type="text"
                    value={form.typeEmballage || ''}
                    onChange={e => handleUpdateField('typeEmballage', e.target.value.toUpperCase())}
                    placeholder="COLIS, CARTONS, PALETTES..."
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-mono font-bold text-sm sm:text-base text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none uppercase shadow-2xs"
                  />
                  <p className="text-[11px] text-zinc-400">Conditionnement déclaré</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CONTENEURS ASSOCIÉS */}
          {activeTab === 'containers' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm">
                <div>
                  <h4 className="text-base sm:text-lg font-black uppercase font-mono text-zinc-900 flex items-center gap-2">
                    <Box className="w-5 h-5 text-[#005DAA]" />
                    <span>Conteneurs Rattachés au BL ({form.conteneurs.length})</span>
                  </h4>
                  <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                    Ajustez les numéros de conteneurs, types ISO, plombs de scellés et poids unitaires.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddContainer}
                  className="px-5 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 transition-all self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter un Conteneur</span>
                </button>
              </div>

              {form.conteneurs.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-zinc-300 space-y-3">
                  <Box className="w-12 h-12 mx-auto text-zinc-300" />
                  <p className="text-sm sm:text-base font-bold text-zinc-700">Aucun conteneur rattaché à ce connaissement.</p>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                    Ce connaissement est actuellement classé comme fret conventionnel, vrac ou roulant (sans conteneur).
                  </p>
                  <button
                    type="button"
                    onClick={handleAddContainer}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-black text-[#005DAA] bg-[#F0F7FF] rounded-xl hover:bg-[#E1EFFF] transition-colors pt-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un premier conteneur ISO</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.conteneurs.map((ctr, idx) => (
                    <div 
                      key={ctr.id || idx} 
                      className="p-4 sm:p-5 bg-white rounded-3xl border border-zinc-200 shadow-sm grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center hover:border-zinc-300 transition-colors"
                    >
                      <div className="sm:col-span-1 text-center font-mono font-black text-sm text-zinc-400">
                        #{idx + 1}
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[10px] sm:text-xs font-mono font-bold text-zinc-500 uppercase block mb-1">
                          N° Conteneur
                        </label>
                        <input
                          type="text"
                          value={ctr.numeroConteneur || ''}
                          onChange={e => handleUpdateContainer(idx, 'numeroConteneur', e.target.value.toUpperCase())}
                          placeholder="MSKU1234567"
                          className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2.5 font-mono font-black text-xs sm:text-sm text-zinc-950 uppercase focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[10px] sm:text-xs font-mono font-bold text-zinc-500 uppercase block mb-1">
                          Type ISO
                        </label>
                        <select
                          value={ctr.typeConteneur || '40_HC'}
                          onChange={e => handleUpdateContainer(idx, 'typeConteneur', e.target.value as ContainerType)}
                          className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2.5 font-bold text-xs sm:text-sm text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none cursor-pointer shadow-2xs"
                        >
                          {CONTAINER_TYPES.map(ct => (
                            <option key={ct.value} value={ct.value}>{ct.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] sm:text-xs font-mono font-bold text-zinc-500 uppercase block mb-1">
                          Poids (kg)
                        </label>
                        <input
                          type="number"
                          value={ctr.poidsKg || ''}
                          onChange={e => handleUpdateContainer(idx, 'poidsKg', parseFloat(e.target.value) || 0)}
                          placeholder="Poids kg"
                          className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2.5 font-mono font-bold text-xs sm:text-sm text-right text-zinc-950 focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] sm:text-xs font-mono font-bold text-zinc-500 uppercase block mb-1">
                          N° Plomb / Scellé
                        </label>
                        <input
                          type="text"
                          value={ctr.numeroScelle || ''}
                          onChange={e => handleUpdateContainer(idx, 'numeroScelle', e.target.value.toUpperCase())}
                          placeholder="ML-CI009"
                          className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2.5 font-mono text-xs sm:text-sm text-zinc-700 uppercase focus:bg-white focus:border-[#005DAA] focus:outline-none shadow-2xs"
                        />
                      </div>

                      <div className="sm:col-span-1 text-center pt-2 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveContainer(idx)}
                          title="Supprimer ce conteneur"
                          className="w-9 h-9 mx-auto flex items-center justify-center text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DOUANES & SÉCURITÉ */}
          {activeTab === 'customs' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-6 sm:p-7 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                  <FileText className="w-4 h-4 text-[#005DAA]" />
                  <span className="text-xs sm:text-sm font-mono font-black text-zinc-800 uppercase tracking-wide">
                    Identifiants Réglementaires &amp; Douane Ivoirienne (GUCE / DGI)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-black text-zinc-600 uppercase block">
                      N° BESC / BSC
                    </label>
                    <input
                      type="text"
                      value={form.bscNumero || ''}
                      onChange={e => handleUpdateField('bscNumero', e.target.value.toUpperCase())}
                      placeholder="ex: BSC-2026-9812"
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-mono text-sm sm:text-base font-bold text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none uppercase shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-black text-zinc-600 uppercase block">
                      N° FDI (Fiche Déclaration Import)
                    </label>
                    <input
                      type="text"
                      value={form.fdiNumero || ''}
                      onChange={e => handleUpdateField('fdiNumero', e.target.value.toUpperCase())}
                      placeholder="ex: FDI-26012356"
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-mono text-sm sm:text-base font-bold text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none uppercase shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-black text-zinc-600 uppercase block">
                      N° Licence / Déclaration DA
                    </label>
                    <input
                      type="text"
                      value={form.licenceNumero || ''}
                      onChange={e => handleUpdateField('licenceNumero', e.target.value.toUpperCase())}
                      placeholder="ex: DA-2026-0044"
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-2xl px-4 py-3 font-mono text-sm sm:text-base font-bold text-zinc-900 focus:bg-white focus:border-[#005DAA] focus:outline-none uppercase shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Matières Dangereuses (Hazmat) */}
              <div className="p-6 sm:p-7 bg-white rounded-3xl border border-zinc-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${form.isDangerous ? 'bg-rose-100 text-rose-700' : 'bg-zinc-100 text-zinc-400'}`}>
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-black uppercase font-mono text-zinc-900">Matières Dangereuses (IMO / Hazmat)</h4>
                      <p className="text-xs sm:text-sm text-zinc-500">Cochez si le connaissement contient des produits sous réglementation internationale IMO / Code ONU</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.isDangerous)}
                      onChange={e => handleUpdateField('isDangerous', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-rose-600"></div>
                  </label>
                </div>

                {form.isDangerous && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-rose-700 uppercase block">
                        Classe IMO (Hazmat)
                      </label>
                      <input
                        type="text"
                        value={form.imoClass || ''}
                        onChange={e => handleUpdateField('imoClass', e.target.value)}
                        placeholder="ex: IMO 3 (Liquides inflammables)"
                        className="w-full bg-rose-50/50 border border-rose-300 rounded-2xl px-4 py-3 font-mono text-sm sm:text-base font-bold text-rose-900 focus:bg-white focus:border-rose-500 focus:outline-none shadow-2xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-rose-700 uppercase block">
                        Code UN (ONU)
                      </label>
                      <input
                        type="text"
                        value={form.unCode || ''}
                        onChange={e => handleUpdateField('unCode', e.target.value)}
                        placeholder="ex: UN 1197"
                        className="w-full bg-rose-50/50 border border-rose-300 rounded-2xl px-4 py-3 font-mono text-sm sm:text-base font-bold text-rose-900 focus:bg-white focus:border-rose-500 focus:outline-none shadow-2xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PIED DE FORMULAIRE / BOUTONS D'ACTION AGRANDIS ── */}
          <div className="pt-5 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 bg-white -mx-7 sm:-mx-10 -mb-7 sm:-mb-10 px-7 sm:px-10 py-5 rounded-b-3xl">
            <div className="text-xs sm:text-sm text-zinc-600 font-mono flex items-center gap-3">
              <span>Poids actuel : <strong className="text-zinc-950 font-black">{(form.poidsBrutKg || 0).toLocaleString('fr-FR')} kg</strong></span>
              <span>•</span>
              <span>Conteneurs : <strong className="text-zinc-950 font-black">{form.conteneurs.length}</strong></span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-8 py-3.5 bg-[#005DAA] hover:bg-[#004580] text-white rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
              >
                <Check className="w-5 h-5" />
                <span>Enregistrer les corrections</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
