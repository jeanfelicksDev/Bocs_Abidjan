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
  Scale,
  MapPin,
  Calendar,
  Anchor,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import { BL, Container, ContainerType } from '../../types';

export interface BlEditModalProps {
  bl: BL | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedBl: BL) => void;
  onOpenBilling?: (bl: BL) => void;
  escaleInfo?: { nomNavire: string; numeroVoyage: string; callsign?: string };
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

export const BlEditModal: React.FC<BlEditModalProps> = ({
  bl,
  isOpen,
  onClose,
  onSave,
  onOpenBilling,
  escaleInfo
}) => {
  const [form, setForm] = useState<BL | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'parties' | 'goods' | 'containers'>('general');

  useEffect(() => {
    if (bl) {
      setForm(JSON.parse(JSON.stringify(bl)));
      setActiveTab('general');
    } else {
      setForm(null);
    }
  }, [bl, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !form) return null;

  const handleUpdateField = <K extends keyof BL>(field: K, value: BL[K]) => {
    setForm(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleAddContainer = () => {
    if (!form) return;
    const newCtr: Container = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      blId: form.id,
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
      conteneurs: [...(form.conteneurs || []), newCtr]
    });
  };

  const handleUpdateContainer = (index: number, field: keyof Container, value: any) => {
    if (!form || !form.conteneurs) return;
    const updatedCtrs = [...form.conteneurs];
    updatedCtrs[index] = { ...updatedCtrs[index], [field]: value };
    setForm({
      ...form,
      conteneurs: updatedCtrs
    });
  };

  const handleRemoveContainer = (index: number) => {
    if (!form || !form.conteneurs) return;
    const updatedCtrs = form.conteneurs.filter((_, i) => i !== index);
    setForm({
      ...form,
      conteneurs: updatedCtrs
    });
  };

  const handleSyncPoidsFromContainers = () => {
    if (!form || !form.conteneurs || form.conteneurs.length === 0) return;
    const sumPoids = form.conteneurs.reduce((acc, c) => acc + (Number(c.poidsKg) || 0), 0);
    const sumColis = form.conteneurs.reduce((acc, c) => acc + (Number(c.nombreColis) || 0), 0);
    setForm({
      ...form,
      poidsBrutKg: sumPoids > 0 ? sumPoids : form.poidsBrutKg,
      nombreColis: sumColis > 0 ? sumColis : form.nombreColis
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numeroBL?.trim()) {
      alert("Le numéro de connaissement (N° BL) est obligatoire.");
      return;
    }

    const payload = { ...form };
    if (payload.conteneurs && payload.conteneurs.length > 0) {
      const sumWeight = payload.conteneurs.reduce((acc, c) => acc + (Number(c.poidsKg) || 0), 0);
      if (sumWeight > 0 && (!payload.poidsBrutKg || payload.poidsBrutKg === 0)) {
        payload.poidsBrutKg = sumWeight;
      }
      const sumColis = payload.conteneurs.reduce((acc, c) => acc + (Number(c.nombreColis) || 0), 0);
      if (sumColis > 0 && (!payload.nombreColis || payload.nombreColis === 0)) {
        payload.nombreColis = sumColis;
      }
    }

    onSave(payload);
  };

  const tabButtonClass = (tab: typeof activeTab) => `
    flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer border
    ${activeTab === tab 
      ? 'bg-[#005DAA] text-white border-[#005DAA] shadow-sm shadow-[#005DAA]/20 scale-[1.02]' 
      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border-zinc-200 hover:text-zinc-950'}
  `;

  const inputClass = "w-full h-11 px-3.5 text-xs sm:text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA] focus:ring-1 focus:ring-[#005DAA] transition-all";
  const labelClass = "block text-xs font-black text-zinc-700 uppercase tracking-wider mb-1.5";

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 md:p-8 bg-zinc-950/60 backdrop-blur-sm animate-fade-in"
      style={{ zIndex: 99999 }}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden relative"
        style={{ zIndex: 100000 }}
      >
        
        {/* ── EN-TÊTE MODALE ── */}
        <div className="px-7 sm:px-9 py-5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F0F7FF] border border-[#005DAA]/25 flex items-center justify-center text-[#005DAA] shadow-xs shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-xl sm:text-2xl font-black text-zinc-950 font-mono tracking-tight">
                  Correction BL : <span className="text-[#005DAA]">{form.numeroBL || 'SANS NUMÉRO'}</span>
                </h3>
                {form.conteneurs && form.conteneurs.length > 0 ? (
                  <span className="px-3 py-1 rounded-xl text-xs font-black bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30">
                    {form.conteneurs.length} CONTENEUR(S)
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-xl text-xs font-black bg-blue-50 text-blue-800 border border-blue-200">
                    VRAC / CONVENTIONNEL
                  </span>
                )}
                {form.statutImport && (
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                    {form.statutImport}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-0.5">
                {escaleInfo ? (
                  <span>Navire : <strong className="text-zinc-800">{escaleInfo.nomNavire}</strong> (Voyage {escaleInfo.numeroVoyage}) • </span>
                ) : null}
                Client : <strong className="text-zinc-800">{form.consigneeNom || 'Non renseigné'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {onOpenBilling && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBilling(form);
                }}
                className="px-4 py-2 rounded-xl bg-[#005DAA] hover:bg-[#004580] text-white text-xs font-black flex items-center gap-2 transition-all shadow-md cursor-pointer active:scale-95"
                title="Ouvrir la Facturation Maritime & Règlements pour ce BL"
              >
                <CreditCard className="w-4 h-4 text-white" />
                <span className="text-white">Facturation &amp; Règlements &rarr;</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-2xl hover:bg-zinc-200 text-zinc-400 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Fermer (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── ONGLETS DE NAVIGATION ── */}
        <div className="flex items-center gap-2 px-7 sm:px-9 pt-4 pb-3 border-b border-zinc-200 bg-white overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={tabButtonClass('general')}
          >
            <Ship className="w-4 h-4" />
            <span>1. Général & Acheminement</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('parties')}
            className={tabButtonClass('parties')}
          >
            <Building2 className="w-4 h-4" />
            <span>2. Parties & Acteurs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('goods')}
            className={tabButtonClass('goods')}
          >
            <Package className="w-4 h-4" />
            <span>3. Marchandises & Poids</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('containers')}
            className={tabButtonClass('containers')}
          >
            <Box className="w-4 h-4" />
            <span>4. Conteneurs ({form.conteneurs?.length || 0})</span>
          </button>
        </div>

        {/* ── CORPS DU FORMULAIRE ── */}
        <form id="edit-bl-main-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-7 sm:p-9 space-y-6">

          {/* ══════════════════════════════════════════════════════════════════
              ONGLET 1 : GÉNÉRAL & ACHEMINEMENT
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 sm:p-6 space-y-5">
                <h4 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#005DAA]" />
                  <span>Identifiants Officiels du Connaissement</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className={labelClass}>Numéro de BL *</label>
                    <input
                      type="text"
                      required
                      value={form.numeroBL || ''}
                      onChange={e => handleUpdateField('numeroBL', e.target.value.toUpperCase())}
                      className={`${inputClass} font-mono font-black text-[#005DAA] text-base`}
                      placeholder="ex: AN2ABJ26614201"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Statut Opérationnel</label>
                    <select
                      value={form.statutImport || 'EN_ATTENTE'}
                      onChange={e => handleUpdateField('statutImport', e.target.value as any)}
                      className={inputClass}
                    >
                      <option value="EN_ATTENTE">EN ATTENTE (À valider)</option>
                      <option value="EN_COURS">EN COURS (En traitement)</option>
                      <option value="FACTURE">FACTURÉ (Dossier clos)</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Référence UCR / Armateur</label>
                    <input
                      type="text"
                      value={form.uniqueCarrierRef || ''}
                      onChange={e => handleUpdateField('uniqueCarrierRef', e.target.value.toUpperCase())}
                      className={`${inputClass} font-mono`}
                      placeholder="ex: UCR-BOCS-98472"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 sm:p-6 space-y-5">
                <h4 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#005DAA]" />
                  <span>Route Maritime & Acheminement</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className={labelClass}>Port de Chargement (POL)</label>
                    <input
                      type="text"
                      value={form.portChargementCode || ''}
                      onChange={e => handleUpdateField('portChargementCode', e.target.value.toUpperCase())}
                      className={`${inputClass} font-mono`}
                      placeholder="ex: ANVERS (BEANR)"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Port de Déchargement (POD)</label>
                    <input
                      type="text"
                      value={form.portDechargementCode || ''}
                      onChange={e => handleUpdateField('portDechargementCode', e.target.value.toUpperCase())}
                      className={`${inputClass} font-mono font-black text-zinc-950`}
                      placeholder="ex: ABIDJAN (CIABJ)"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Destination Finale</label>
                    <input
                      type="text"
                      value={form.destinationFinale || ''}
                      onChange={e => handleUpdateField('destinationFinale', e.target.value)}
                      className={inputClass}
                      placeholder="ex: ABIDJAN, CÔTE D'IVOIRE"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ONGLET 2 : PARTIES & ACTEURS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'parties' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Chargeur (Shipper) */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-200">
                  <Building2 className="w-4 h-4 text-[#005DAA]" />
                  <h4 className="text-sm font-black text-zinc-950">Chargeur / Expéditeur (Shipper)</h4>
                </div>

                <div>
                  <label className={labelClass}>Raison Sociale Shipper *</label>
                  <input
                    type="text"
                    required
                    value={form.shipperNom || ''}
                    onChange={e => handleUpdateField('shipperNom', e.target.value)}
                    className={inputClass}
                    placeholder="Nom complet de l'expéditeur"
                  />
                </div>

                <div>
                  <label className={labelClass}>Adresse Complète / Coordonnées</label>
                  <textarea
                    rows={3}
                    value={form.shipperAdresse || ''}
                    onChange={e => handleUpdateField('shipperAdresse', e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA] resize-none"
                    placeholder="Adresse, Ville, Pays, Contact..."
                  />
                </div>
              </div>

              {/* Destinataire (Consignee) */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-200">
                  <Building2 className="w-4 h-4 text-[#005DAA]" />
                  <h4 className="text-sm font-black text-zinc-950">Destinataire / Consignataire (Consignee)</h4>
                </div>

                <div>
                  <label className={labelClass}>Raison Sociale Consignee *</label>
                  <input
                    type="text"
                    required
                    value={form.consigneeNom || ''}
                    onChange={e => handleUpdateField('consigneeNom', e.target.value)}
                    className={`${inputClass} font-black text-zinc-950`}
                    placeholder="ex: SOLIBRA, UNIVAWAX S.A..."
                  />
                </div>

                <div>
                  <label className={labelClass}>Adresse Complète / Contact Abidjan</label>
                  <textarea
                    rows={3}
                    value={form.consigneeAdresse || ''}
                    onChange={e => handleUpdateField('consigneeAdresse', e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA] resize-none"
                    placeholder="Adresse de livraison, Téléphone, Email..."
                  />
                </div>
              </div>

              {/* Notify Party */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 sm:p-6 space-y-4 md:col-span-2">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-200">
                  <Building2 className="w-4 h-4 text-[#005DAA]" />
                  <h4 className="text-sm font-black text-zinc-950">Partie à Notifier (Notify Party)</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Nom Notify</label>
                    <input
                      type="text"
                      value={form.notifyNom || ''}
                      onChange={e => handleUpdateField('notifyNom', e.target.value)}
                      className={inputClass}
                      placeholder="Raison sociale du notifié"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Adresse Notify</label>
                    <input
                      type="text"
                      value={form.notifyAdresse || ''}
                      onChange={e => handleUpdateField('notifyAdresse', e.target.value)}
                      className={inputClass}
                      placeholder="Coordonnées / Ville"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ONGLET 3 : MARCHANDISES & POIDS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'goods' && (
            <div className="space-y-6">
              
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 sm:p-6 space-y-5">
                <h4 className="text-sm font-black text-zinc-950 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#005DAA]" />
                  <span>Description & Nature de la Marchandise</span>
                </h4>

                <div>
                  <label className={labelClass}>Désignation Commerciale des Marchandises *</label>
                  <textarea
                    rows={4}
                    required
                    value={form.descriptionGoods || ''}
                    onChange={e => handleUpdateField('descriptionGoods', e.target.value)}
                    className="w-full px-4 py-3 text-xs sm:text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-[#005DAA] resize-none"
                    placeholder="Description précise des marchandises déclarées..."
                  />
                </div>

                <div>
                  <label className={labelClass}>Marques & Numéros (Marks & Numbers)</label>
                  <input
                    type="text"
                    value={form.marquesEtNumeros || ''}
                    onChange={e => handleUpdateField('marquesEtNumeros', e.target.value)}
                    className={inputClass}
                    placeholder="ex: N/M, AS PER B/L, AD/01-50..."
                  />
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-zinc-950 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-[#005DAA]" />
                    <span>Quantités, Colisage & Poids Brut</span>
                  </h4>
                  {form.conteneurs && form.conteneurs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSyncPoidsFromContainers}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#005DAA] border border-blue-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      ⚡ Recalculer via Conteneurs
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div>
                    <label className={labelClass}>Type d'Emballage</label>
                    <input
                      type="text"
                      value={form.typeEmballage || ''}
                      onChange={e => handleUpdateField('typeEmballage', e.target.value)}
                      className={inputClass}
                      placeholder="ex: CARTONS, PALETTES, SAC..."
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Nombre de Colis</label>
                    <input
                      type="number"
                      min={0}
                      value={form.nombreColis || 0}
                      onChange={e => handleUpdateField('nombreColis', parseInt(e.target.value, 10) || 0)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Poids Brut (Kg) *</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={form.poidsBrutKg || 0}
                      onChange={e => handleUpdateField('poidsBrutKg', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} font-mono font-black text-[#005DAA]`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Volume (m³)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.volumeM3 || 0}
                      onChange={e => handleUpdateField('volumeM3', parseFloat(e.target.value) || 0)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ONGLET 4 : CONTENEURS & SCIÉS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'containers' && (
            <div className="space-y-5">
              
              <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-zinc-200">
                <div>
                  <h4 className="text-base font-black text-zinc-950 flex items-center gap-2">
                    <Box className="w-5 h-5 text-[#005DAA]" />
                    <span>Conteneurs Rattachés ({form.conteneurs?.length || 0})</span>
                  </h4>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    Gérez les numéros de conteneurs, types ISO, plombs/scellés et poids individuels.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddContainer}
                  className="px-4 py-2 bg-[#005DAA] hover:bg-[#004580] text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter un Conteneur</span>
                </button>
              </div>

              {!form.conteneurs || form.conteneurs.length === 0 ? (
                <div className="text-center py-12 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl">
                  <Box className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-zinc-600">Aucun conteneur rattaché (Marchandise en VRAC / Conventionnel).</p>
                  <button
                    type="button"
                    onClick={handleAddContainer}
                    className="mt-3 text-xs font-black text-[#005DAA] hover:underline cursor-pointer"
                  >
                    + Ajouter un conteneur à ce connaissement
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.conteneurs.map((ctr, idx) => (
                    <div 
                      key={ctr.id || idx} 
                      className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex flex-col md:flex-row md:items-center gap-4 transition-all hover:border-zinc-300 hover:shadow-xs"
                    >
                      <div className="flex items-center gap-2 shrink-0 font-mono text-xs font-black text-zinc-500 w-8">
                        #{idx + 1}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 flex-1">
                        <div>
                          <label className="block text-[10px] font-black text-zinc-500 uppercase mb-1">N° Conteneur</label>
                          <input
                            type="text"
                            required
                            placeholder="ex: MSCU1234567"
                            value={ctr.numeroConteneur || ''}
                            onChange={e => handleUpdateContainer(idx, 'numeroConteneur', e.target.value.toUpperCase())}
                            className="w-full h-9 px-3 text-xs font-mono font-black text-zinc-950 bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#005DAA]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-zinc-500 uppercase mb-1">Type ISO</label>
                          <select
                            value={ctr.typeConteneur || '40_HC'}
                            onChange={e => handleUpdateContainer(idx, 'typeConteneur', e.target.value as ContainerType)}
                            className="w-full h-9 px-2 text-xs font-bold text-zinc-900 bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#005DAA]"
                          >
                            {CONTAINER_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-zinc-500 uppercase mb-1">N° Scellé / Plomb</label>
                          <input
                            type="text"
                            placeholder="ex: ML-CI89472"
                            value={ctr.numeroScelle || ''}
                            onChange={e => handleUpdateContainer(idx, 'numeroScelle', e.target.value)}
                            className="w-full h-9 px-3 text-xs font-mono font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#005DAA]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-zinc-500 uppercase mb-1">Poids Brut (Kg)</label>
                          <input
                            type="number"
                            min={0}
                            value={ctr.poidsKg || 0}
                            onChange={e => handleUpdateContainer(idx, 'poidsKg', parseFloat(e.target.value) || 0)}
                            className="w-full h-9 px-3 text-xs font-mono font-bold text-zinc-900 bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#005DAA]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-zinc-500 uppercase mb-1">Caution (FCFA)</label>
                          <input
                            type="number"
                            min={0}
                            value={ctr.montantCautionFcfa || 0}
                            onChange={e => handleUpdateContainer(idx, 'montantCautionFcfa', parseFloat(e.target.value) || 0)}
                            className="w-full h-9 px-3 text-xs font-mono font-bold text-zinc-900 bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#005DAA]"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveContainer(idx)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0 self-end md:self-center"
                        title="Supprimer ce conteneur"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Résumé des totaux conteneurs */}
                  <div className="p-4 rounded-2xl bg-zinc-100 border border-zinc-200 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                    <span className="font-bold text-zinc-700">
                      Total Conteneurs : <strong className="text-zinc-950">{form.conteneurs.length}</strong>
                    </span>
                    <span className="font-bold text-zinc-700">
                      Poids Cumulé : <strong className="text-[#005DAA]">{form.conteneurs.reduce((acc, c) => acc + (Number(c.poidsKg) || 0), 0).toLocaleString('fr-FR')} Kg</strong>
                    </span>
                    <span className="font-bold text-zinc-700">
                      Caution Totale : <strong className="text-zinc-950">{form.conteneurs.reduce((acc, c) => acc + (Number(c.montantCautionFcfa) || 0), 0).toLocaleString('fr-FR')} FCFA</strong>
                    </span>
                  </div>
                </div>
              )}

            </div>
          )}

        </form>

        {/* ── PIED DE PAGE ACTIONS ── */}
        <div className="px-7 sm:px-9 py-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 hover:bg-zinc-100 font-bold text-xs sm:text-sm transition-all cursor-pointer"
          >
            Annuler
          </button>

          <button
            type="submit"
            form="edit-bl-main-form"
            className="px-6 py-2.5 bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Enregistrer les modifications</span>
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
