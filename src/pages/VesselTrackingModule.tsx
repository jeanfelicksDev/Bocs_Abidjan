import React, { useState } from 'react';
import { Escale, UserRole } from '../types';
import { PortAccostageMap } from '../components/fleet/PortAccostageMap';
import { NavTab } from '../components/layout/Sidebar';
import { generateImportManifestPdf } from '../utils/pdfGenerator';
import { MultiPdfImportModal, EscaleCommitGroup } from '../components/import/MultiPdfImportModal';

interface VesselTrackingModuleProps {
  escales: Escale[];
  bls?: any[];
  invoices?: any[];
  payments?: any[];
  userRole: UserRole;
  onAddEscale?: (escale: Escale) => void;
  onImportManifest?: (escale: Escale, bls: any[]) => void;
  onDeleteEscale?: (escaleId: number) => void;
  onNavigateTab?: (tab: NavTab) => void;
}

export const VesselTrackingModule: React.FC<VesselTrackingModuleProps> = ({
  escales,
  bls = [],
  invoices = [],
  payments = [],
  userRole,
  onAddEscale,
  onImportManifest,
  onDeleteEscale,
  onNavigateTab
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedEscale, setSelectedEscale] = useState<Escale | null>(null);
  const [escaleToDelete, setEscaleToDelete] = useState<Escale | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMultiPdfModal, setShowMultiPdfModal] = useState(false);
  const [targetUploadEscaleId, setTargetUploadEscaleId] = useState<number | null>(null);

  // New Escale form state
  const [nomNavire, setNomNavire] = useState('');
  const [callsign, setCallsign] = useState('');
  const [numeroVoyage, setNumeroVoyage] = useState('');
  const [portChargement, setPortChargement] = useState('Abidjan (CIABJ)');
  const [portDechargement, setPortDechargement] = useState('Antwerpen (BEANT)');
  const [dateArrivee, setDateArrivee] = useState(new Date().toISOString().split('T')[0]);

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
    <div className="space-y-6 animate-fade-in text-zinc-900">
      
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#00875A] text-2xl font-black">radar</span>
            <h1 className="text-2xl font-black text-[#002B49] tracking-tight">
              Suivi Flotte &amp; <span className="font-serif italic font-semibold text-[#005DAA]">Radar Portuaire AIS</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30">
              PAA Abidjan
            </span>
          </div>
          <p className="text-xs text-zinc-600 font-medium max-w-2xl leading-relaxed">
            Supervision géolocalisée temps réel, berteillage aux quais du Port d'Abidjan (TC1, TC2, Fruitière) et liaisons maritimes.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 premium-btn-primary text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add_location_alt</span>
            <span>Programmer une Escale</span>
          </button>
        </div>
      </div>

      {/* Realtime Fleet Metrics (4 Bento KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between hover:border-[#00875A] transition-all shadow-xs hover:shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">À Quai (En Opération)</h3>
              <p className="text-3xl font-black text-[#00875A] tracking-tight font-display mt-1">
                {aQuaiCount} <span className="text-sm font-bold text-zinc-600 font-sans">{aQuaiCount > 1 ? 'Navires' : 'Navire'}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#00875A] flex items-center justify-center border border-[#00875A]/30 shrink-0">
              <span className="material-symbols-outlined text-xl">anchor</span>
            </div>
          </div>
          <p className="text-[11px] text-[#00875A] font-bold flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-100">
            <span className="w-2 h-2 rounded-full bg-[#00875A] animate-pulse" />
            <span>Postes 11 à 14 Vridi PAA</span>
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between hover:border-[#005DAA] transition-all shadow-xs hover:shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">Flotte BOCS Rattachée</h3>
              <p className="text-3xl font-black text-[#002B49] tracking-tight font-display mt-1">
                {enTransitCount} <span className="text-sm font-bold text-zinc-600 font-sans">{enTransitCount > 1 ? 'Navires' : 'Navire'}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#F0F7FF] text-[#005DAA] flex items-center justify-center border border-[#005DAA]/30 shrink-0">
              <span className="material-symbols-outlined text-xl">sailing</span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 font-medium flex items-center gap-1 mt-2 pt-2 border-t border-zinc-100">
            <span>Liaisons Europe / Afrique de l'Ouest</span>
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between hover:border-[#005DAA] transition-all shadow-xs hover:shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">Clôturées / En Rade</h3>
              <p className="text-3xl font-black text-slate-700 tracking-tight font-display mt-1">
                {enRadeCount} <span className="text-sm font-bold text-zinc-600 font-sans">{enRadeCount > 1 ? 'Navires' : 'Navire'}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200 shrink-0">
              <span className="material-symbols-outlined text-xl">schedule</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 font-medium flex items-center gap-1 mt-2 pt-2 border-t border-zinc-100">
            <span>Opérations terminées / Rade ext.</span>
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between hover:border-[#005DAA] transition-all shadow-xs hover:shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">Volume Fret Estimé</h3>
              <p className="text-3xl font-black text-[#005DAA] tracking-tight font-display mt-1">
                {totalVolumeTonnes} <span className="text-sm font-bold text-zinc-600 font-sans">T</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#005DAA] flex items-center justify-center border border-[#005DAA]/30 shrink-0">
              <span className="material-symbols-outlined text-xl">inventory_2</span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 font-medium flex items-center gap-1 mt-2 pt-2 border-t border-zinc-100">
            <span>Conteneurs &amp; Conventionnel</span>
          </p>
        </div>

      </div>

      {/* Carte d'Accostage Portuaire Vectorielle GIS */}
      <PortAccostageMap escales={filteredEscales} onSelectEscale={setSelectedEscale} />

      {/* Escales Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 bg-zinc-50/70 border-b border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#005DAA]">view_list</span>
            <h3 className="font-extrabold text-zinc-900 text-sm tracking-tight">
              Registre des Escales &amp; Connaissements Associés
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 text-zinc-700 font-mono">
              {filteredEscales.length}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Status Filter Tabs */}
            <div className="flex items-center bg-zinc-200/70 p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterStatus === 'ALL' ? 'bg-white text-zinc-900 shadow-2xs font-extrabold' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('EN_COURS')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterStatus === 'EN_COURS' ? 'bg-white text-emerald-700 shadow-2xs font-extrabold' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                À Quai
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('CLOTUREE')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterStatus === 'CLOTUREE' ? 'bg-white text-zinc-900 shadow-2xs font-extrabold' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Clôturées
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher navire, voyage..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-white focus:outline-hidden focus:border-[#005DAA]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px] bocs-scrollbar relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 text-zinc-600 text-[11px] font-bold uppercase tracking-wider">
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
            <tbody className="divide-y divide-zinc-100 text-xs">
              {filteredEscales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-400 font-medium">
                    Aucune escale correspondant aux critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredEscales.map(escale => (
                  <tr key={escale.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="p-3.5">
                      <div className="font-extrabold text-zinc-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#005DAA] text-base">directions_boat</span>
                        <span>{escale.nomNavire}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">{escale.callsign}</div>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-[#005DAA]">{escale.numeroVoyage}</td>
                    <td className="p-3.5 text-zinc-700 font-medium">{escale.portChargement}</td>
                    <td className="p-3.5 text-zinc-700 font-medium">{escale.portDechargement}</td>
                    <td className="p-3.5 font-mono text-zinc-600">{escale.dateArrivee}</td>
                    <td className="p-3.5">
                      {escale.statut === 'EN_COURS' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#ECFDF5] text-[#00875A] border border-[#00875A]/30 inline-flex items-center gap-1.5 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00875A] animate-pulse"></span>
                          À QUAI
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
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
                              className="px-3 py-1.5 bg-[#005DAA] hover:bg-[#004580] text-white text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                              title="Charger les fichiers PDF servant de manifeste pour cette escale"
                            >
                              <span className="material-symbols-outlined text-sm">upload_file</span>
                              <span>Charger Manifeste</span>
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => generateImportManifestPdf(escale, escBls)}
                                className="px-3 py-1.5 bg-white hover:bg-[#F0F7FF] text-[#005DAA] hover:text-[#004580] border border-[#005DAA]/30 text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                                title="Générer et imprimer le Manifeste officiel BOCS (PDF)"
                              >
                                <span className="material-symbols-outlined text-sm text-[#005DAA]">description</span>
                                <span>Manifeste PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetUploadEscaleId(escale.id);
                                  setShowMultiPdfModal(true);
                                }}
                                className="px-2 py-1.5 bg-[#F0F7FF] hover:bg-[#E1EFFF] text-[#005DAA] border border-[#005DAA]/30 text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95 flex items-center gap-0.5"
                                title="Charger ou ajouter d'autres manifestes PDF à cette escale"
                              >
                                <span className="material-symbols-outlined text-sm">upload_file</span>
                                <span>+ PDF</span>
                              </button>
                            </>
                          );
                        })()}

                        {onNavigateTab && (
                          <button
                            onClick={() => onNavigateTab('import')}
                            className="px-3 py-1.5 premium-btn-secondary text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                            title="Voir les BLs de ce navire"
                          >
                            <span className="material-symbols-outlined text-sm text-[#005DAA]">inventory_2</span>
                            <span>Voir BLs</span>
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedEscale(escale)}
                          className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95"
                          title="Détails de l'escale"
                        >
                          Détails
                        </button>

                        {onDeleteEscale && (userRole === 'ADMIN' || userRole === 'AGENT_IMPORT') && (
                          <button
                            onClick={() => setEscaleToDelete(escale)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition-all text-xs inline-flex items-center gap-1 border border-rose-200 cursor-pointer shadow-2xs active:scale-95"
                            title="Supprimer cette escale"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 relative text-zinc-900">
            <button
              onClick={() => setSelectedEscale(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
              <div className="w-11 h-11 rounded-xl bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">directions_boat</span>
              </div>
              <div>
                <h3 className="font-black text-lg text-zinc-900">{selectedEscale.nomNavire}</h3>
                <p className="text-xs text-zinc-500 font-mono">Callsign / IMO: {selectedEscale.callsign}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                <span className="text-zinc-500 uppercase text-[10px] font-bold">N° Voyage</span>
                <p className="font-mono font-black text-[#005DAA] text-sm">{selectedEscale.numeroVoyage}</p>
              </div>
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                <span className="text-zinc-500 uppercase text-[10px] font-bold">Statut Actuel</span>
                <p className="font-bold text-[#00875A] text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00875A]" />
                  {selectedEscale.statut === 'EN_COURS' ? 'À Quai (En Opération)' : 'Clôturée'}
                </p>
              </div>
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                <span className="text-zinc-500 uppercase text-[10px] font-bold">Port Chargement</span>
                <p className="font-semibold text-zinc-800">{selectedEscale.portChargement}</p>
              </div>
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                <span className="text-zinc-500 uppercase text-[10px] font-bold">Port Déchargement</span>
                <p className="font-semibold text-zinc-800">{selectedEscale.portDechargement}</p>
              </div>
            </div>

            <div className="p-3.5 bg-[#F0F7FF] border border-[#005DAA]/20 rounded-xl text-xs space-y-1">
              <span className="font-bold text-[#005DAA] block">Berteillage &amp; Opérations Manutention :</span>
              <p className="text-zinc-700">Poste à quai 14 - Terminal à Conteneurs Vridi (TC1/TC2). Déchargement et chargement en cours.</p>
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
                  className="px-4 py-2 bg-[#005DAA] hover:bg-[#004580] text-white font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                  title="Charger les fichiers PDF servant de manifeste pour cette escale"
                >
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                  <span>Charger Manifeste (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const escBls = bls.filter(b => b.escaleId === selectedEscale.id);
                    generateImportManifestPdf(selectedEscale, escBls);
                  }}
                  className="px-4 py-2 bg-white hover:bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/30 hover:border-[#005DAA] font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                  title="Imprimer le Manifeste officiel de cette escale"
                >
                  <span className="material-symbols-outlined text-sm text-[#005DAA]">description</span>
                  <span>Générer Manifeste PDF</span>
                </button>
              </div>

              {onNavigateTab && (
                <button
                  onClick={() => {
                    setSelectedEscale(null);
                    onNavigateTab('import');
                  }}
                  className="px-4 py-2 premium-btn-secondary font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm text-[#005DAA]">inventory_2</span>
                  <span>Voir les BLs &rarr;</span>
                </button>
              )}

              <button
                onClick={() => setSelectedEscale(null)}
                className="px-5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs rounded-xl transition-all ml-auto cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal Add Escale Form */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-black text-lg text-zinc-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005DAA]">add_location_alt</span>
                <span>Programmer une Nouvelle Escale</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 uppercase mb-1">Nom du Navire</label>
                <input
                  type="text"
                  required
                  value={nomNavire}
                  onChange={e => setNomNavire(e.target.value)}
                  placeholder="ex: BOCS BREMEN"
                  className="w-full h-10 px-3 text-xs rounded-xl border border-zinc-200 focus:outline-hidden focus:border-[#005DAA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Callsign / IMO</label>
                  <input
                    type="text"
                    value={callsign}
                    onChange={e => setCallsign(e.target.value)}
                    placeholder="IMO 948201"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-zinc-200 focus:outline-hidden focus:border-[#005DAA]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">N° Voyage</label>
                  <input
                    type="text"
                    required
                    value={numeroVoyage}
                    onChange={e => setNumeroVoyage(e.target.value)}
                    placeholder="VOY-2026-08"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-zinc-200 focus:outline-hidden focus:border-[#005DAA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Port Chargement</label>
                  <input
                    type="text"
                    value={portChargement}
                    onChange={e => setPortChargement(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-zinc-200 focus:outline-hidden focus:border-[#005DAA]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Port Déchargement</label>
                  <input
                    type="text"
                    value={portDechargement}
                    onChange={e => setPortDechargement(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-zinc-200 focus:outline-hidden focus:border-[#005DAA]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 uppercase mb-1">Date d'Arrivée Prévue (ETA)</label>
                <input
                  type="date"
                  value={dateArrivee}
                  onChange={e => setDateArrivee(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-zinc-200 focus:outline-hidden focus:border-[#005DAA]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl font-bold text-zinc-700 cursor-pointer transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 premium-btn-primary text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Enregistrer l'Escale
                </button>
              </div>
            </form>
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
          relatedBlIds.includes(inv.blId) || relatedBlNumbers.includes(inv.numeroBL)
        );
        const relatedInvoiceIds = relatedInvoices.map(inv => inv.id);
        const relatedPaymentsCount = payments.filter(p => relatedInvoiceIds.includes(p.factureId)).length;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-rose-200 animate-fade-in text-zinc-900">
              <div className="flex items-center gap-3 text-rose-600 border-b border-zinc-100 pb-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs">
                  <span className="material-symbols-outlined text-2xl">warning</span>
                </div>
                <div>
                  <h3 className="font-black text-base text-zinc-900">Confirmation de Suppression d'Escale</h3>
                  <p className="text-[11px] text-rose-600 font-bold uppercase tracking-wider">Avertissement critique &amp; Action irréversible</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-zinc-700 leading-relaxed">
                  Vous êtes sur le point de supprimer l'escale du navire <span className="font-extrabold text-zinc-900 underline">{escaleToDelete.nomNavire}</span> (Voyage <span className="font-mono font-bold text-[#005DAA]">{escaleToDelete.numeroVoyage}</span>).
                </p>

                {/* Détail des impacts */}
                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 space-y-2">
                  <div className="text-[11px] font-extrabold uppercase text-rose-800 tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-rose-600">inventory_2</span>
                    <span>Bilan des éléments qui seront purgés :</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-white p-2.5 rounded-lg border border-rose-100 flex items-center justify-between shadow-2xs">
                      <span className="text-zinc-600 text-[11px] font-sans">BLs :</span>
                      <span className="font-bold text-rose-600 text-sm">{relatedBls.length}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-rose-100 flex items-center justify-between shadow-2xs">
                      <span className="text-zinc-600 text-[11px] font-sans">Conteneurs :</span>
                      <span className="font-bold text-rose-600 text-sm">{relatedContainersCount}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-rose-100 flex items-center justify-between shadow-2xs">
                      <span className="text-zinc-600 text-[11px] font-sans">Factures :</span>
                      <span className="font-bold text-rose-600 text-sm">{relatedInvoices.length}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-rose-100 flex items-center justify-between shadow-2xs">
                      <span className="text-zinc-600 text-[11px] font-sans">Règlements :</span>
                      <span className="font-bold text-rose-600 text-sm">{relatedPaymentsCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setEscaleToDelete(null)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
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
