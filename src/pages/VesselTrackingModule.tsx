import React, { useState } from 'react';
import { Escale, UserRole, Vessel } from '../types';
import { PortAccostageMap } from '../components/fleet/PortAccostageMap';
import { NavTab } from '../components/layout/Sidebar';
import { generateImportManifestPdf } from '../utils/pdfGenerator';
import { MultiPdfImportModal, EscaleCommitGroup } from '../components/import/MultiPdfImportModal';
import { useEscapeClose, overlayClickClose } from '../hooks/useEscapeClose';
import { useEscales, useBls, useInvoices, usePayments, useVessels } from '../hooks/useData';

interface VesselTrackingModuleProps {
  onAddVessel?: (vessel: Vessel) => void;
  onDeleteVessel?: (vesselId: number) => void;
  onUpdateVessel?: (vessel: Vessel) => void;
  userRole: UserRole;
  onAddEscale?: (escale: Escale) => void;
  onImportManifest?: (escale: Escale, bls: any[]) => void;
  onDeleteEscale?: (escaleId: number) => void;
  onNavigateTab?: (tab: NavTab) => void;
}

export const VesselTrackingModule: React.FC<VesselTrackingModuleProps> = ({
  onAddVessel,
  onDeleteVessel,
  onUpdateVessel,
  userRole,
  onAddEscale,
  onImportManifest,
  onDeleteEscale,
  onNavigateTab
}) => {
  const { escales } = useEscales();
  const { bls } = useBls();
  const { invoices } = useInvoices();
  const { payments } = usePayments();
  const { vessels } = useVessels();

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedEscale, setSelectedEscale] = useState<Escale | null>(null);
  const [escaleToDelete, setEscaleToDelete] = useState<Escale | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMultiPdfModal, setShowMultiPdfModal] = useState(false);
  const [targetUploadEscaleId, setTargetUploadEscaleId] = useState<number | null>(null);
  const [showVesselsModal, setShowVesselsModal] = useState(false);
  const [showAddVesselModal, setShowAddVesselModal] = useState(false);
  // Édition d'un navire existant (modale réutilisée en mode édition)
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  // Confirmation de suppression d'un navire (avec garde si escales liées)
  const [vesselToDelete, setVesselToDelete] = useState<Vessel | null>(null);

  // Fermeture clavier (Échap) et par clic sur l'arrière-plan — une seule modale à la fois (sommet de pile).
  useEscapeClose(Boolean(selectedEscale), () => setSelectedEscale(null));
  useEscapeClose(showAddModal, () => setShowAddModal(false));
  useEscapeClose(showAddVesselModal, () => setShowAddVesselModal(false));
  useEscapeClose(showVesselsModal, () => setShowVesselsModal(false));
  useEscapeClose(Boolean(editingVessel), () => setEditingVessel(null));
  useEscapeClose(Boolean(vesselToDelete), () => setVesselToDelete(null));
  useEscapeClose(Boolean(escaleToDelete), () => setEscaleToDelete(null));

  // New Escale form state
  const [selectedVesselId, setSelectedVesselId] = useState<string>('');
  const [nomNavire, setNomNavire] = useState('');
  const [callsign, setCallsign] = useState('');
  const [numeroVoyage, setNumeroVoyage] = useState('');
  const [portChargement, setPortChargement] = useState('Abidjan (CIABJ)');
  const [portDechargement, setPortDechargement] = useState('Antwerpen (BEANT)');
  const [dateArrivee, setDateArrivee] = useState(new Date().toISOString().split('T')[0]);

  // New Vessel Form State (Nom, Armateur/Coque, Indicatif, Pavillon)
  const [newVesselNom, setNewVesselNom] = useState('');
  const [newVesselCoque, setNewVesselCoque] = useState('BOCS Line');
  const [newVesselCallsign, setNewVesselCallsign] = useState('');
  const [newVesselPavillon, setNewVesselPavillon] = useState('Liberia');

  const handleVesselSelectChange = (vesselIdStr: string) => {
    setSelectedVesselId(vesselIdStr);
    if (vesselIdStr === 'NEW') {
      openCreateVessel();
      return;
    }
    const found = vessels.find(v => String(v.id) === vesselIdStr);
    if (found) {
      setNomNavire(found.nom);
      setCallsign(found.callsign || '');
    }
  };

  const handleCreateVesselSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVesselNom.trim()) return;
    if (!newVesselCallsign.trim() || !newVesselPavillon.trim() || !newVesselCoque.trim()) return;

    // ── Mode édition : met à jour le navire existant (même id) ──
    if (editingVessel) {
      const updated: Vessel = {
        ...editingVessel,
        nom: newVesselNom.trim().toUpperCase(),
        callsign: newVesselCallsign.trim(),
        pavillon: newVesselPavillon.trim(),
        coque: newVesselCoque.trim(),
        armateur: newVesselCoque.trim()
      };
      if (onUpdateVessel) onUpdateVessel(updated);
      // Si le navire édité est celui sélectionné pour l'escale, resynchroniser l'indicatif
      if (String(selectedVesselId) === String(updated.id)) {
        setNomNavire(updated.nom);
        setCallsign(updated.callsign);
      }
      setEditingVessel(null);
      setNewVesselNom('');
      setNewVesselCallsign('');
      setNewVesselCoque('BOCS Line');
      setNewVesselPavillon('Liberia');
      setShowAddVesselModal(false);
      return;
    }

    const newVessel: Vessel = {
      id: Date.now(),
      nom: newVesselNom.trim().toUpperCase(),
      callsign: newVesselCallsign.trim(),
      pavillon: newVesselPavillon.trim(),
      coque: newVesselCoque.trim(),
      armateur: newVesselCoque.trim(),
      typeNavire: 'Porte-conteneurs',
      dateCreation: new Date().toISOString().split('T')[0]
    };

    if (onAddVessel) onAddVessel(newVessel);
    
    // Auto select the newly created vessel
    setSelectedVesselId(String(newVessel.id));
    setNomNavire(newVessel.nom);
    setCallsign(newVessel.callsign);
    
    // Reset and close modal
    setNewVesselNom('');
    setNewVesselCallsign('');
    setNewVesselCoque('BOCS Line');
    setNewVesselPavillon('Liberia');
    setShowAddVesselModal(false);
  };

  const openEditVessel = (v: Vessel) => {
    setEditingVessel(v);
    setNewVesselNom(v.nom);
    setNewVesselCoque(v.coque || v.armateur || 'BOCS Line');
    setNewVesselCallsign(v.callsign || '');
    setNewVesselPavillon(v.pavillon || 'Liberia');
    setShowAddVesselModal(true);
  };

  const openCreateVessel = () => {
    setEditingVessel(null);
    setNewVesselNom('');
    setNewVesselCoque('BOCS Line');
    setNewVesselCallsign('');
    setNewVesselPavillon('Liberia');
    setShowAddVesselModal(true);
  };

  const filteredEscales = escales.filter(e => {
    const matchesSearch = e.nomNavire.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.numeroVoyage.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.callsign.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterStatus === 'ALL') return matchesSearch;
    if (filterStatus === 'EN_COURS') return matchesSearch && e.statut === 'EN_COURS';
    if (filterStatus === 'CLOTUREE') return matchesSearch && e.statut === 'CLOTUREE';
    return matchesSearch;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomNavire || !numeroVoyage) return;

    const newEscale: Escale = {
      id: Date.now(),
      nomNavire,
      callsign: callsign || `CS-${Math.floor(1000 + Math.random() * 9000)}`,
      numeroVoyage,
      portChargement,
      portDechargement,
      dateArrivee,
      statut: 'EN_COURS'
    };

    if (onAddEscale) onAddEscale(newEscale);
    setShowAddModal(false);
    setNomNavire('');
    setCallsign('');
    setNumeroVoyage('');
  };

  // Dynamic metrics computed from real state
  const aQuaiCount = escales.filter(e => e.statut === 'EN_COURS').length;
  const enRadeCount = escales.filter(e => e.statut === 'CLOTUREE').length;
  const enTransitCount = escales.length;
  const totalVolumeTonnes = (escales.length * 16150).toLocaleString('fr-FR');

  return (
    <div className="space-y-6 animate-fade-in text-text-primary dark:text-night-ink">
      
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md p-6 shadow-1 relative overflow-hidden">
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="material-symbols-outlined text-[#00875A] text-2xl font-black">radar</span>
            <h1 className="text-2xl font-black text-primaryDark tracking-tight">
              Suivi Flotte &amp; <span className="font-serif italic font-semibold text-[#005DAA] dark:text-night-ink">Radar Portuaire AIS</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30">
              PAA Abidjan
            </span>
          </div>
          <p className="text-sm text-text-secondary dark:text-night-ink font-medium max-w-2xl leading-relaxed">
            Supervision géolocalisée temps réel, berteillage aux quais du Port d'Abidjan (TC1, TC2, Fruitière) et liaisons maritimes.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowVesselsModal(true)}
            className="px-3.5 py-2.5 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 text-text-primary dark:text-night-ink font-extrabold text-sm rounded-md transition-all flex items-center gap-2 cursor-pointer border border-border-default dark:border-night-line"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg text-[#005DAA] dark:text-night-link">directions_boat</span>
            <span>Registre Flotte ({vessels.length})</span>
          </button>

          <button
            onClick={openCreateVessel}
            className="px-3.5 py-2.5 bg-surface-sunken dark:bg-night-ink/10 hover:bg-[#005DAA] text-[#005DAA] dark:text-night-link font-extrabold text-sm rounded-md transition-all flex items-center gap-1.5 cursor-pointer border border-[#005DAA] dark:border-night-line/30"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">add</span>
            <span>Nouveau Navire</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 premium-btn-primary text-white dark:text-night-ink font-extrabold text-sm rounded-md shadow-md transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">add_location_alt</span>
            <span>Programmer une Escale</span>
          </button>
        </div>
      </div>

      {/* Realtime Fleet Metrics (4 Bento KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md p-5 flex flex-col justify-between hover:border-[#00875A] transition-all shadow-1 hover:shadow-2">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-night-ink">À Quai (En Opération)</h3>
              <p className="text-3xl font-black text-[#00875A] tracking-tight font-display mt-1">
                {aQuaiCount} <span className="text-base font-bold text-text-secondary dark:text-night-ink font-sans">{aQuaiCount > 1 ? 'Navires' : 'Navire'}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-md bg-[#ECFDF5] text-[#00875A] flex items-center justify-center border border-[#00875A]/30 shrink-0">
              <span aria-hidden="true" className="material-symbols-outlined text-xl">anchor</span>
            </div>
          </div>
          <p className="text-xs text-[#00875A] font-bold flex items-center gap-1.5 mt-2 pt-2 border-t border-border-default">
            <span className="w-2 h-2 rounded-full bg-[#00875A]" />
            <span>Postes 11 à 14 Vridi PAA</span>
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md p-5 flex flex-col justify-between hover:border-[#005DAA] transition-all shadow-1 hover:shadow-2">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-night-ink">Flotte BOCS Rattachée</h3>
              <p className="text-3xl font-black text-[#002B49] tracking-tight font-display mt-1">
                {enTransitCount} <span className="text-base font-bold text-text-secondary dark:text-night-ink font-sans">{enTransitCount > 1 ? 'Navires' : 'Navire'}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-md bg-[#F0F7FF] dark:bg-night-raised text-[#005DAA] dark:text-night-ink flex items-center justify-center border border-[#005DAA] dark:border-night-line/30 shrink-0">
              <span aria-hidden="true" className="material-symbols-outlined text-xl">sailing</span>
            </div>
          </div>
          <p className="text-xs text-text-muted dark:text-night-ink-2 font-medium flex items-center gap-1 mt-2 pt-2 border-t border-border-default">
            <span>Liaisons Europe / Afrique de l'Ouest</span>
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md p-5 flex flex-col justify-between hover:border-[#005DAA] transition-all shadow-1 hover:shadow-2">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-night-ink">Clôturées / En Rade</h3>
              <p className="text-3xl font-black text-slate-700 dark:text-night-ink tracking-tight font-display mt-1">
                {enRadeCount} <span className="text-base font-bold text-text-secondary dark:text-night-ink font-sans">{enRadeCount > 1 ? 'Navires' : 'Navire'}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-md bg-[#f4f4f5] dark:bg-night-sunken text-slate-600 dark:text-night-ink flex items-center justify-center border border-slate-200 dark:border-night-line shrink-0">
              <span aria-hidden="true" className="material-symbols-outlined text-xl">schedule</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-night-ink font-medium flex items-center gap-1 mt-2 pt-2 border-t border-border-default">
            <span>Opérations terminées / Rade ext.</span>
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md p-5 flex flex-col justify-between hover:border-[#005DAA] transition-all shadow-1 hover:shadow-2">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-night-ink">Volume Fret Estimé</h3>
              <p className="text-3xl font-black text-[#005DAA] dark:text-night-link tracking-tight font-display mt-1">
                {totalVolumeTonnes} <span className="text-base font-bold text-text-secondary dark:text-night-ink font-sans">T</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-md bg-sky-50 text-[#005DAA] dark:text-night-link flex items-center justify-center border border-[#005DAA] dark:border-night-line/30 shrink-0">
              <span aria-hidden="true" className="material-symbols-outlined text-xl">inventory_2</span>
            </div>
          </div>
          <p className="text-xs text-text-muted dark:text-night-ink-2 font-medium flex items-center gap-1 mt-2 pt-2 border-t border-border-default">
            <span>Conteneurs &amp; Conventionnel</span>
          </p>
        </div>

      </div>

      {/* Carte d'Accostage Portuaire Vectorielle GIS */}
      <PortAccostageMap escales={filteredEscales} onSelectEscale={setSelectedEscale} />

      {/* Escales Table */}
      <div className="bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md shadow-1 overflow-hidden">
        <div className="p-4 bg-surface-base dark:bg-night-sunken/70 border-b border-border-default dark:border-night-line flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link">view_list</span>
            <h3 className="font-extrabold text-text-primary dark:text-night-ink text-base tracking-tight">
              Registre des Escales &amp; Connaissements Associés
            </h3>
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-zinc-200 text-text-secondary dark:text-night-ink font-mono">
              {filteredEscales.length}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Status Filter Tabs */}
            <div className="flex items-center bg-zinc-200/70 p-0.5 rounded-md text-sm font-bold">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterStatus === 'ALL' ? 'bg-surface-canvas dark:bg-night-surface text-text-primary dark:text-night-ink shadow-1 font-extrabold' : 'text-text-secondary dark:text-night-ink hover:text-text-primary '
                }`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('EN_COURS')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterStatus === 'EN_COURS' ? 'bg-surface-canvas dark:bg-night-surface text-emerald-700 shadow-1 font-extrabold' : 'text-text-secondary dark:text-night-ink hover:text-text-primary '
                }`}
              >
                À Quai
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('CLOTUREE')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterStatus === 'CLOTUREE' ? 'bg-surface-canvas dark:bg-night-surface text-text-primary dark:text-night-ink shadow-1 font-extrabold' : 'text-text-secondary dark:text-night-ink hover:text-text-primary '
                }`}
              >
                Clôturées
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted dark:text-night-ink-3 text-base">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher navire, voyage..."
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border border-border-default dark:border-night-line bg-surface-canvas dark:bg-night-surface focus:outline-hidden focus:border-[#005DAA] "
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px] bocs-scrollbar relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-base dark:bg-night-sunken border-b border-border-default dark:border-night-line text-text-secondary dark:text-night-ink text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Navire &amp; Callsign</th>
                <th className="p-3.5">N° Voyage</th>
                <th className="p-3.5">Port Chargement</th>
                <th className="p-3.5">Port Déchargement</th>
                <th className="p-3.5">Arrivée ETA</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5 text-right">Actions Opérationnelles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {filteredEscales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-text-muted dark:text-night-ink-3 font-medium">
                    Aucune escale correspondant aux critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredEscales.map(escale => (
                  <tr key={escale.id} className="hover:bg-surface-base dark:bg-night-sunken/80 transition-colors">
                    <td className="p-3.5">
                      <div className="font-extrabold text-text-primary dark:text-night-ink flex items-center gap-2">
                        <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link text-lg">directions_boat</span>
                        <span>{escale.nomNavire}</span>
                      </div>
                      <div className="text-xs text-text-muted dark:text-night-ink-2 font-mono">{escale.callsign}</div>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-[#005DAA] dark:text-night-link">{escale.numeroVoyage}</td>
                    <td className="p-3.5 text-text-secondary dark:text-night-ink font-medium">{escale.portChargement}</td>
                    <td className="p-3.5 text-text-secondary dark:text-night-ink font-medium">{escale.portDechargement}</td>
                    <td className="p-3.5 font-mono text-text-secondary dark:text-night-ink">{escale.dateArrivee}</td>
                    <td className="p-3.5">
                      {escale.statut === 'EN_COURS' ? (
                        <span className="px-2.5 py-1 rounded-full text-2xs font-black bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30 inline-flex items-center gap-1.5 shadow-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00875A]"></span>
                          À QUAI
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-2xs font-bold bg-surface-sunken dark:bg-night-sunken text-text-secondary dark:text-night-ink border border-border-default dark:border-night-line">
                          CLÔTURÉE
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        
                        {(() => {
                          const escBls = bls.filter(b => b.escaleId === escale.id);
                          return escBls.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setTargetUploadEscaleId(escale.id);
                                setShowMultiPdfModal(true);
                              }}
                              className="px-3 py-1.5 bg-[#005DAA] dark:bg-night-accent hover:bg-[#004580] dark:hover:bg-night-accent-strong text-white dark:text-white text-sm font-bold rounded-lg transition-all cursor-pointer active:scale-95 shadow-1 flex items-center gap-1"
                              title="Charger les fichiers PDF servant de manifeste pour cette escale"
                            >
                              <span aria-hidden="true" className="material-symbols-outlined text-base">upload_file</span>
                              <span>Charger Manifeste</span>
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => generateImportManifestPdf(escale, escBls)}
                                className="px-3 py-1.5 bg-surface-canvas dark:bg-night-surface hover:bg-[#F0F7FF] dark:hover:bg-night-raised text-[#005DAA] dark:text-night-link hover:text-[#004580] border border-[#005DAA] dark:border-night-line/30 text-sm font-bold rounded-lg transition-all cursor-pointer active:scale-95 shadow-1 flex items-center gap-1"
                                title="Générer et imprimer le Manifeste officiel BOCS (PDF)"
                              >
                                <span aria-hidden="true" className="material-symbols-outlined text-base text-[#005DAA] dark:text-night-link">description</span>
                                <span>Manifeste PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetUploadEscaleId(escale.id);
                                  setShowMultiPdfModal(true);
                                }}
                                className="px-2 py-1.5 bg-[#F0F7FF] hover:bg-[#E1EFFF] text-[#005DAA] dark:text-night-link border border-[#005DAA] dark:border-night-line/30 text-sm font-bold rounded-lg transition-all cursor-pointer active:scale-95 flex items-center gap-0.5"
                                title="Charger ou ajouter d'autres manifestes PDF à cette escale"
                              >
                                <span aria-hidden="true" className="material-symbols-outlined text-base">upload_file</span>
                                <span>+ PDF</span>
                              </button>
                            </>
                          );
                        })()}

                        {onNavigateTab && (
                          <button
                            onClick={() => onNavigateTab('import')}
                            className="px-3 py-1.5 premium-btn-secondary text-sm font-bold rounded-lg transition-all cursor-pointer active:scale-95 shadow-1 flex items-center gap-1"
                            title="Voir les BLs de ce navire"
                          >
                            <span aria-hidden="true" className="material-symbols-outlined text-base text-[#005DAA] dark:text-night-link">inventory_2</span>
                            <span>Voir BLs</span>
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedEscale(escale)}
                          className="px-3 py-1.5 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 text-text-primary dark:text-night-ink border border-border-default dark:border-night-line text-sm font-bold rounded-lg transition-all cursor-pointer active:scale-95"
                          title="Détails de l'escale"
                        >
                          Détails
                        </button>

                        {onDeleteEscale && (userRole === 'ADMIN' || userRole === 'AGENT_IMPORT') && (
                          <button
                            onClick={() => setEscaleToDelete(escale)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition-all text-sm inline-flex items-center gap-1 border border-rose-200 cursor-pointer shadow-1 active:scale-95"
                            title="Supprimer cette escale"
                          >
                            <span aria-hidden="true" className="material-symbols-outlined text-base">delete</span>
                            <span>Supprimer</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Escale Detail Modal */}
      {selectedEscale && (
        <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => setSelectedEscale(null))} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
          <div className="bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md shadow-2xl dark:shadow-black/70 max-w-lg w-full p-6 space-y-4 relative text-text-primary dark:text-night-ink">
            <button aria-label="Fermer"
              onClick={() => setSelectedEscale(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 flex items-center justify-center text-text-secondary dark:text-night-ink transition-colors cursor-pointer"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-xl">close</span>
            </button>

            <div className="flex items-center gap-3 border-b border-border-default pb-3">
              <div className="w-11 h-11 rounded-md bg-[#F0F7FF] dark:bg-night-raised text-[#005DAA] dark:text-night-ink border border-[#005DAA] dark:border-night-line/30 flex items-center justify-center">
                <span aria-hidden="true" className="material-symbols-outlined text-2xl">directions_boat</span>
              </div>
              <div>
                <h3 className="font-black text-xl text-text-primary dark:text-night-ink">{selectedEscale.nomNavire}</h3>
                <p className="text-sm text-text-muted dark:text-night-ink-2 font-mono">Callsign / IMO: {selectedEscale.callsign}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md space-y-1">
                <span className="text-text-muted dark:text-night-ink-2 uppercase text-2xs font-bold">N° Voyage</span>
                <p className="font-mono font-black text-[#005DAA] dark:text-night-link text-base">{selectedEscale.numeroVoyage}</p>
              </div>
              <div className="p-3 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md space-y-1">
                <span className="text-text-muted dark:text-night-ink-2 uppercase text-2xs font-bold">Statut Actuel</span>
                <p className="font-bold text-[#00875A] text-base flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00875A]" />
                  {selectedEscale.statut === 'EN_COURS' ? 'À Quai (En Opération)' : 'Clôturée'}
                </p>
              </div>
              <div className="p-3 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md space-y-1">
                <span className="text-text-muted dark:text-night-ink-2 uppercase text-2xs font-bold">Port Chargement</span>
                <p className="font-semibold text-text-primary dark:text-night-ink">{selectedEscale.portChargement}</p>
              </div>
              <div className="p-3 bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md space-y-1">
                <span className="text-text-muted dark:text-night-ink-2 uppercase text-2xs font-bold">Port Déchargement</span>
                <p className="font-semibold text-text-primary dark:text-night-ink">{selectedEscale.portDechargement}</p>
              </div>
            </div>

            <div className="p-3.5 bg-[#F0F7FF] border border-border-default dark:border-night-line/20 rounded-md text-sm space-y-1">
              <span className="font-bold text-[#005DAA] dark:text-night-link block">Berteillage &amp; Opérations Manutention :</span>
              <p className="text-text-secondary dark:text-night-ink">Poste à quai 14 - Terminal à Conteneurs Vridi (TC1/TC2). Déchargement et chargement en cours.</p>
            </div>

            <div className="pt-2 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const escId = selectedEscale.id;
                    setSelectedEscale(null);
                    setTargetUploadEscaleId(escId);
                    setShowMultiPdfModal(true);
                  }}
                  className="px-4 py-2 bg-[#005DAA] dark:bg-night-accent hover:bg-[#004580] dark:hover:bg-night-accent-strong text-white dark:text-white font-black text-sm rounded-md transition-all cursor-pointer flex items-center gap-1.5 shadow-1 active:scale-95"
                  title="Charger les fichiers PDF servant de manifeste pour cette escale"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-base">upload_file</span>
                  <span>Charger Manifeste (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const escBls = bls.filter(b => b.escaleId === selectedEscale.id);
                    generateImportManifestPdf(selectedEscale, escBls);
                  }}
                  className="px-4 py-2 bg-surface-canvas dark:bg-night-surface hover:bg-[#F0F7FF] dark:hover:bg-night-raised text-[#005DAA] dark:text-night-link border border-[#005DAA] dark:border-night-line/30 hover:border-[#005DAA] font-black text-sm rounded-md transition-all cursor-pointer flex items-center gap-1.5 shadow-1 active:scale-95"
                  title="Imprimer le Manifeste officiel de cette escale"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-base text-[#005DAA] dark:text-night-link">description</span>
                  <span>Générer Manifeste PDF</span>
                </button>
              </div>

              {onNavigateTab && (
                <button
                  onClick={() => {
                    setSelectedEscale(null);
                    onNavigateTab('import');
                  }}
                  className="px-4 py-2 premium-btn-secondary font-bold text-sm rounded-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-base text-[#005DAA] dark:text-night-link">inventory_2</span>
                  <span>Voir les BLs &rarr;</span>
                </button>
              )}

              <button
                onClick={() => setSelectedEscale(null)}
                className="px-5 py-2 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 text-text-primary dark:text-night-ink font-bold text-sm rounded-md transition-all ml-auto cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal Add Escale Form */}
      {showAddModal && (
        <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => setShowAddModal(false))} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
          <div className="bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md shadow-2xl dark:shadow-black/70 max-w-md w-full p-6 space-y-4 text-text-primary dark:text-night-ink">
            <div className="flex items-center justify-between border-b border-border-default pb-3">
              <h3 className="font-black text-xl text-text-primary dark:text-night-ink flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link">add_location_alt</span>
                <span>Programmer une Nouvelle Escale</span>
              </h3>
              <button aria-label="Fermer" onClick={() => setShowAddModal(false)} className="text-text-muted dark:text-night-ink-3 hover:text-text-secondary cursor-pointer">
                <span aria-hidden="true" className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-sm">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-text-secondary dark:text-night-ink uppercase">Sélectionner le Navire</label>
                  <button
                    type="button"
                    onClick={openCreateVessel}
                    className="text-xs font-bold text-[#005DAA] dark:text-night-link hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-base">add_circle</span>
                    <span>Nouveau Navire</span>
                  </button>
                </div>
                <select
                  value={selectedVesselId}
                  onChange={e => handleVesselSelectChange(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line focus:outline-hidden focus:border-[#005DAA] bg-surface-base dark:bg-night-sunken font-bold text-text-primary dark:text-night-ink cursor-pointer"
                >
                  <option value="">-- Choisir un navire de la flotte --</option>
                  {vessels.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.nom} ({v.callsign || 'Sans IMO'}) — {v.typeNavire || 'Cargo'}
                    </option>
                  ))}
                  <option value="NEW">+ Créer un nouveau navire dans le système...</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Nom du Navire (Confirmation / Personnalisé)</label>
                <input
                  type="text"
                  required
                  value={nomNavire}
                  onChange={e => setNomNavire(e.target.value)}
                  placeholder="ex: BOCS BREMEN"
                  className="w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line focus:outline-hidden focus:border-[#005DAA] font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Callsign / IMO</label>
                  <input
                    type="text"
                    value={callsign}
                    onChange={e => setCallsign(e.target.value)}
                    placeholder="IMO 948201"
                    className="w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line focus:outline-hidden focus:border-[#005DAA] "
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">N° Voyage</label>
                  <input
                    type="text"
                    required
                    value={numeroVoyage}
                    onChange={e => setNumeroVoyage(e.target.value)}
                    placeholder="VOY-2026-08"
                    className="w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line focus:outline-hidden focus:border-[#005DAA] "
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Port Chargement</label>
                  <input
                    type="text"
                    value={portChargement}
                    onChange={e => setPortChargement(e.target.value)}
                    className="w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line focus:outline-hidden focus:border-[#005DAA] "
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Port Déchargement</label>
                  <input
                    type="text"
                    value={portDechargement}
                    onChange={e => setPortDechargement(e.target.value)}
                    className="w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line focus:outline-hidden focus:border-[#005DAA] "
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Date d'Arrivée Prévue (ETA)</label>
                <input
                  type="date"
                  value={dateArrivee}
                  onChange={e => setDateArrivee(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line focus:outline-hidden focus:border-[#005DAA] "
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 rounded-md font-bold text-text-secondary dark:text-night-ink cursor-pointer transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 premium-btn-primary text-white dark:text-night-ink font-bold rounded-md shadow-md transition-all cursor-pointer"
                >
                  Enregistrer l'Escale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Création / Édition de Navire */}
      {showAddVesselModal && (
        <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => { setShowAddVesselModal(false); setEditingVessel(null); })} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-canvas dark:bg-night-surface rounded-md shadow-2xl dark:shadow-black/70 max-w-md w-full p-6 space-y-4 text-text-primary dark:text-night-ink border border-border-default dark:border-night-line animate-fade-in">
            <div className="flex items-center justify-between border-b border-border-default pb-3">
              <h3 className="font-black text-xl text-[#002B49] flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link">directions_boat</span>
                <span>{editingVessel ? 'Modifier le Navire' : 'Créer un Nouveau Navire'}</span>
              </h3>
              <button aria-label="Fermer" onClick={() => { setShowAddVesselModal(false); setEditingVessel(null); }} className="text-text-muted dark:text-night-ink-3 hover:text-text-secondary cursor-pointer">
                <span aria-hidden="true" className="material-symbols-outlined">close</span>
              </button>
            </div>
            {editingVessel && (
              <p className="text-xs text-text-muted dark:text-night-ink-2 font-medium bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md px-3 py-2">
                Mise à jour de « {editingVessel.nom} » — seul le registre est modifié (les escales existantes gardent leurs valeurs).
              </p>
            )}

            <form onSubmit={handleCreateVesselSubmit} className="space-y-3 text-sm">
              <div>
                <label className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Nom du Navire *</label>
                <input
                  type="text"
                  required
                  value={newVesselNom}
                  onChange={e => setNewVesselNom(e.target.value)}
                  placeholder="ex: BOCS DAKAR"
                  className="w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line focus:outline-hidden focus:border-[#005DAA] font-bold uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Armateur / Coque *</label>
                <input
                  type="text"
                  required
                  value={newVesselCoque}
                  onChange={e => setNewVesselCoque(e.target.value)}
                  placeholder="ex: BOCS Line"
                  className="w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line focus:outline-hidden focus:border-[#005DAA] "
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Indicatif Radio *</label>
                  <input
                    type="text"
                    required
                    value={newVesselCallsign}
                    onChange={e => setNewVesselCallsign(e.target.value)}
                    placeholder="ex: CQRT, DJNY2..."
                    className="w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line focus:outline-hidden focus:border-[#005DAA] "
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Pavillon *</label>
                  <input
                    type="text"
                    required
                    value={newVesselPavillon}
                    onChange={e => setNewVesselPavillon(e.target.value)}
                    placeholder="Liberia, Panama..."
                    className="w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line focus:outline-hidden focus:border-[#005DAA] "
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => { setShowAddVesselModal(false); setEditingVessel(null); }}
                  className="px-4 py-2 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 rounded-md font-bold text-text-secondary dark:text-night-ink cursor-pointer transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 premium-btn-primary text-white dark:text-night-ink font-bold rounded-md shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-lg">check</span>
                  <span>{editingVessel ? 'Enregistrer' : 'Créer le Navire'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registre de la Flotte */}
      {showVesselsModal && (
        <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => setShowVesselsModal(false))} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-canvas dark:bg-night-surface rounded-md shadow-2xl dark:shadow-black/70 max-w-3xl w-full p-6 space-y-4 text-text-primary dark:text-night-ink border border-border-default dark:border-night-line animate-fade-in max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border-default pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-md bg-surface-sunken dark:bg-night-ink/10 text-[#005DAA] dark:text-night-link flex items-center justify-center font-bold">
                  <span aria-hidden="true" className="material-symbols-outlined">directions_boat</span>
                </div>
                <div>
                  <h3 className="font-black text-xl text-[#002B49]">Registre des Navires Enregistrés</h3>
                  <p className="text-sm text-text-muted dark:text-night-ink-2 font-medium">{vessels.length} navire(s) disponibles pour programmation d'escale</p>
                </div>
              </div>
              <button aria-label="Fermer" onClick={() => setShowVesselsModal(false)} className="text-text-muted dark:text-night-ink-3 hover:text-text-secondary cursor-pointer">
                <span aria-hidden="true" className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex justify-between items-center shrink-0">
              <span className="text-sm font-bold text-text-secondary dark:text-night-ink uppercase">Liste officielle de la flotte</span>
              <button
                onClick={openCreateVessel}
                className="px-3 py-1.5 bg-[#005DAA] dark:bg-night-accent hover:bg-[#004884] text-white dark:text-white font-bold text-sm rounded-md shadow-sm dark:shadow-black/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-base">add</span>
                <span>Ajouter un Navire</span>
              </button>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-grow border border-border-default dark:border-night-line rounded-md">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-base dark:bg-night-sunken border-b border-border-default dark:border-night-line text-text-secondary dark:text-night-ink font-bold uppercase text-xs sticky top-0">
                  <tr>
                    <th className="p-3">Navire</th>
                    <th className="p-3">Indicatif Radio</th>
                    <th className="p-3">Armateur / Coque</th>
                    <th className="p-3">Pavillon</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {vessels.map(v => {
                    const linkedEscales = escales.filter(e => e.nomNavire?.trim().toLowerCase() === v.nom?.trim().toLowerCase());
                    return (
                    <tr key={v.id} className="hover:bg-surface-base dark:bg-night-sunken transition-colors">
                      <td className="p-3 font-extrabold text-[#002B49]">
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link text-lg">sailing</span>
                          <span>{v.nom}</span>
                        </div>
                        {linkedEscales.length > 0 && (
                          <span className="ml-8 text-2xs font-bold text-text-muted dark:text-night-ink-2">{linkedEscales.length} escale(s) liée(s)</span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-text-secondary dark:text-night-ink">{v.callsign || '-'}</td>
                      <td className="p-3 text-text-secondary dark:text-night-ink">{v.coque || v.armateur || '—'}</td>
                      <td className="p-3 text-text-secondary dark:text-night-ink">{v.pavillon || 'N/A'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditVessel(v)}
                            className="p-1.5 hover:bg-sky-50 text-[#005DAA] dark:text-night-link rounded-lg transition-colors cursor-pointer"
                            title="Modifier ce navire"
                          >
                            <span aria-hidden="true" className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => setVesselToDelete(v)}
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Supprimer du registre"
                          >
                            <span aria-hidden="true" className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-border-default flex justify-end shrink-0">
              <button
                onClick={() => setShowVesselsModal(false)}
                className="px-4 py-2 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 text-text-secondary dark:text-night-ink font-bold text-sm rounded-md transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Suppression Escale */}
      {escaleToDelete && (() => {
        const relatedBls = bls.filter(b => b.escaleId === escaleToDelete.id);
        const relatedBlIds = relatedBls.map(b => b.id);
        const relatedBlNumbers = relatedBls.map(b => b.numeroBL);

        const relatedContainersCount = relatedBls.reduce((acc, b) => acc + (b.conteneurs?.length || 0), 0);
        const relatedInvoices = invoices.filter(inv => 
          (inv.blId && relatedBlIds.includes(inv.blId)) || (inv.numeroBL && relatedBlNumbers.includes(inv.numeroBL))
        );
        const relatedInvoiceIds = relatedInvoices.map(inv => inv.id);
        const relatedPaymentsCount = payments.filter(p => relatedInvoiceIds.includes(p.factureId)).length;

        return (
          <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => setEscaleToDelete(null))} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-surface-canvas dark:bg-night-surface rounded-md max-w-lg w-full p-6 shadow-2xl dark:shadow-black/70 space-y-4 border border-rose-200 animate-fade-in text-text-primary dark:text-night-ink">
              <div className="flex items-center gap-3 text-rose-600 border-b border-border-default pb-3">
                <div className="w-11 h-11 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-1">
                  <span aria-hidden="true" className="material-symbols-outlined text-2xl">warning</span>
                </div>
                <div>
                  <h3 className="font-black text-lg text-text-primary dark:text-night-ink">Confirmation de Suppression d'Escale</h3>
                  <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">Avertissement critique &amp; Action irréversible</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <p className="text-text-secondary dark:text-night-ink leading-relaxed">
                  Vous êtes sur le point de supprimer l'escale du navire <span className="font-extrabold text-text-primary dark:text-night-ink underline">{escaleToDelete.nomNavire}</span> (Voyage <span className="font-mono font-bold text-[#005DAA] dark:text-night-link">{escaleToDelete.numeroVoyage}</span>).
                </p>

                {/* Détail des impacts */}
                <div className="bg-rose-50/70 border border-rose-200 rounded-md p-3.5 space-y-2">
                  <div className="text-xs font-extrabold uppercase text-rose-800 tracking-wider flex items-center gap-1.5">
                    <span aria-hidden="true" className="material-symbols-outlined text-base text-rose-600">inventory_2</span>
                    <span>Bilan des éléments qui seront purgés :</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                    <div className="bg-surface-canvas dark:bg-night-surface p-2.5 rounded-lg border border-rose-100 flex items-center justify-between shadow-1">
                      <span className="text-text-secondary dark:text-night-ink text-xs font-sans">BLs :</span>
                      <span className="font-bold text-rose-600 text-base">{relatedBls.length}</span>
                    </div>
                    <div className="bg-surface-canvas dark:bg-night-surface p-2.5 rounded-lg border border-rose-100 flex items-center justify-between shadow-1">
                      <span className="text-text-secondary dark:text-night-ink text-xs font-sans">Conteneurs :</span>
                      <span className="font-bold text-rose-600 text-base">{relatedContainersCount}</span>
                    </div>
                    <div className="bg-surface-canvas dark:bg-night-surface p-2.5 rounded-lg border border-rose-100 flex items-center justify-between shadow-1">
                      <span className="text-text-secondary dark:text-night-ink text-xs font-sans">Factures :</span>
                      <span className="font-bold text-rose-600 text-base">{relatedInvoices.length}</span>
                    </div>
                    <div className="bg-surface-canvas dark:bg-night-surface p-2.5 rounded-lg border border-rose-100 flex items-center justify-between shadow-1">
                      <span className="text-text-secondary dark:text-night-ink text-xs font-sans">Règlements :</span>
                      <span className="font-bold text-rose-600 text-base">{relatedPaymentsCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setEscaleToDelete(null)}
                  className="px-4 py-2 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 text-text-secondary dark:text-night-ink font-bold text-sm rounded-md transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteEscale) {
                      onDeleteEscale(escaleToDelete.id);
                    }
                    setEscaleToDelete(null);
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white dark:text-night-ink font-bold text-sm rounded-md shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-lg">delete_forever</span>
                  <span>Confirmer la Suppression Définitive</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Confirmation Suppression Navire */}
      {vesselToDelete && (() => {
        const linkedEscales = escales.filter(e => e.nomNavire?.trim().toLowerCase() === vesselToDelete.nom?.trim().toLowerCase());
        return (
          <div role="dialog" aria-modal="true" onClick={overlayClickClose(() => setVesselToDelete(null))} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-surface-canvas dark:bg-night-surface rounded-md max-w-lg w-full p-6 shadow-2xl dark:shadow-black/70 space-y-4 border border-rose-200 animate-fade-in text-text-primary dark:text-night-ink">
              <div className="flex items-center gap-3 text-rose-600 border-b border-border-default pb-3">
                <div className="w-11 h-11 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-1">
                  <span aria-hidden="true" className="material-symbols-outlined text-2xl">warning</span>
                </div>
                <div>
                  <h3 className="font-black text-lg text-text-primary dark:text-night-ink">Supprimer le navire ?</h3>
                  <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">Registre de la flotte</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <p className="text-text-secondary dark:text-night-ink leading-relaxed">
                  Vous êtes sur le point de retirer <span className="font-extrabold text-text-primary dark:text-night-ink underline">{vesselToDelete.nom}</span>
                  {' '}({vesselToDelete.callsign || 'Sans indicatif'}) du registre des navires.
                </p>
                {linkedEscales.length > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3.5 space-y-1.5">
                    <div className="text-xs font-extrabold uppercase text-amber-800 tracking-wider flex items-center gap-1.5">
                      <span aria-hidden="true" className="material-symbols-outlined text-base">anchor</span>
                      <span>{linkedEscales.length} escale(s) liée(s) — historique préservé</span>
                    </div>
                    <ul className="text-xs text-text-secondary dark:text-night-ink font-mono space-y-0.5 max-h-28 overflow-y-auto">
                      {linkedEscales.slice(0, 8).map(e => (
                        <li key={e.id}>• {e.nomNavire} — Voy. {e.numeroVoyage}</li>
                      ))}
                      {linkedEscales.length > 8 && <li>• … +{linkedEscales.length - 8} autre(s)</li>}
                    </ul>
                    <p className="text-xs text-text-secondary dark:text-night-ink font-medium">
                      Les escales existantes gardent leurs valeurs (nom + indicatif). Seules les futures escales ne proposeront plus ce navire.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary dark:text-night-ink font-medium bg-surface-base dark:bg-night-sunken border border-border-default dark:border-night-line rounded-md px-3 py-2">
                    Aucune escale liée — suppression sans impact sur l'historique.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setVesselToDelete(null)}
                  className="px-4 py-2 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 text-text-secondary dark:text-night-ink font-bold text-sm rounded-md transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteVessel) onDeleteVessel(vesselToDelete.id);
                    if (String(selectedVesselId) === String(vesselToDelete.id)) {
                      setSelectedVesselId('');
                    }
                    setVesselToDelete(null);
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white dark:text-night-ink font-bold text-sm rounded-md shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-lg">delete_forever</span>
                  <span>Confirmer la suppression</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modale d'Importation Multi-PDFs & Connaissements */}
      <MultiPdfImportModal
        isOpen={showMultiPdfModal}
        onClose={() => {
          setShowMultiPdfModal(false);
          setTargetUploadEscaleId(null);
        }}
        escales={escales}
        activeEscaleId={targetUploadEscaleId || undefined}
        onCommitGroups={(groups) => {
          if (onImportManifest) {
            groups.forEach(group => {
              onImportManifest(group.escale, group.bls);
            });
          }
          setShowMultiPdfModal(false);
          setTargetUploadEscaleId(null);
        }}
        onRequestCreateEscale={() => setShowAddModal(true)}
      />

    </div>
  );
};
