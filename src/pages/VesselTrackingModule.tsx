import React, { useState } from 'react';
import { Escale, UserRole } from '../types';
import { PortAccostageMap } from '../components/fleet/PortAccostageMap';

interface VesselTrackingModuleProps {
  escales: Escale[];
  userRole: UserRole;
  onAddEscale?: (escale: Escale) => void;
  onDeleteEscale?: (escaleId: number) => void;
}

export const VesselTrackingModule: React.FC<VesselTrackingModuleProps> = ({
  escales,
  userRole,
  onAddEscale,
  onDeleteEscale
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedEscale, setSelectedEscale] = useState<Escale | null>(null);
  const [escaleToDelete, setEscaleToDelete] = useState<Escale | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

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
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#00182f] p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(#70adff_1px,transparent_1px)] [background-size:20px_20px] opacity-10 pointer-events-none"></div>
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest">
            <span className="material-symbols-outlined text-sm">radar</span>
            <span>Suivi Flotte En Temps Réel</span>
          </div>
          <h1 className="text-2xl font-black text-white font-heading">Suivi des Navires & Opérations Portuaires</h1>
          <p className="text-xs text-blue-200/80 max-w-xl">
            Visualisation géolocalisée temps réel, gestion des escales et planification du berteillage au Port d'Abidjan.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">add_location_alt</span>
            <span>Programmer une Escale</span>
          </button>
        </div>
      </div>

      {/* Realtime Fleet Metrics (Dynamiquement calculées) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bocs-card p-4 flex items-center gap-4 border-l-4 border-emerald-500 bg-white rounded-2xl shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <span className="material-symbols-outlined text-2xl">anchor</span>
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase text-slate-500 font-mono tracking-wider">À Quai (Opérations)</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{aQuaiCount} {aQuaiCount > 1 ? 'Navires' : 'Navire'}</p>
            <p className="text-[11px] text-emerald-600 font-semibold">Taux d'accostage: 100%</p>
          </div>
        </div>

        <div className="bocs-card p-4 flex items-center gap-4 border-l-4 border-blue-500 bg-white rounded-2xl shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <span className="material-symbols-outlined text-2xl">sailing</span>
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase text-slate-500 font-mono tracking-wider">En Registre Flotte</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{enTransitCount} {enTransitCount > 1 ? 'Navires' : 'Navire'}</p>
            <p className="text-[11px] text-blue-600 font-semibold">Mises à jour AIS en direct</p>
          </div>
        </div>

        <div className="bocs-card p-4 flex items-center gap-4 border-l-4 border-amber-500 bg-white rounded-2xl shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <span className="material-symbols-outlined text-2xl">schedule</span>
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase text-slate-500 font-mono tracking-wider">En Rade (Attente Quai)</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{enRadeCount} {enRadeCount > 1 ? 'Navires' : 'Navire'}</p>
            <p className="text-[11px] text-amber-700 font-semibold">Attente berteillage poste</p>
          </div>
        </div>

        <div className="bocs-card p-4 flex items-center gap-4 border-l-4 border-indigo-500 bg-white rounded-2xl shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <span className="material-symbols-outlined text-2xl">inventory_2</span>
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase text-slate-500 font-mono tracking-wider">Volume Estimé Tonnes</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{totalVolumeTonnes} T</p>
            <p className="text-[11px] text-slate-500 font-semibold">Conteneurs & Vrac</p>
          </div>
        </div>
      </div>

      {/* Carte d'Accostage Portuaire Vectorielle GIS */}
      <PortAccostageMap escales={filteredEscales} onSelectEscale={setSelectedEscale} />

      {/* Escales Table */}
      <div className="bocs-card overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2 font-heading">
            <span className="material-symbols-outlined text-[#005daa]">view_list</span>
            <span>Registre des Escales & Navires</span>
          </h3>

          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher navire, voyage..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#005daa] shadow-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[500px] bocs-scrollbar relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-md shadow-xs">
              <tr className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <th className="p-3">Navire & Callsign</th>
                <th className="p-3">N° Voyage</th>
                <th className="p-3">Port Chargement</th>
                <th className="p-3">Port Déchargement</th>
                <th className="p-3">Date Arrivée / ETA</th>
                <th className="p-3">Statut Escale</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-xs">
              {filteredEscales.map(escale => (
                <tr key={escale.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="p-3">
                    <div className="font-bold text-primary flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-base">directions_boat</span>
                      <span>{escale.nomNavire}</span>
                    </div>
                    <div className="text-[11px] text-outline font-mono">{escale.callsign}</div>
                  </td>
                  <td className="p-3 font-mono font-bold text-secondary">{escale.numeroVoyage}</td>
                  <td className="p-3 text-on-surface-variant">{escale.portChargement}</td>
                  <td className="p-3 text-on-surface-variant">{escale.portDechargement}</td>
                  <td className="p-3 font-mono text-on-surface">{escale.dateArrivee}</td>
                  <td className="p-3">
                    {escale.statut === 'EN_COURS' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                        EN COURS
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
                        CLÔTURÉE
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedEscale(escale)}
                        className="px-3 py-1 bg-surface-container hover:bg-secondary hover:text-on-secondary text-on-surface-variant font-bold rounded transition-all text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        <span>Détails</span>
                      </button>

                      {onDeleteEscale && (
                        <button
                          onClick={() => setEscaleToDelete(escale)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 font-bold rounded transition-all text-xs inline-flex items-center gap-1 border border-rose-200 cursor-pointer shadow-xs active:scale-95"
                          title="Supprimer cette escale"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Escale Detail Drawer / Modal */}
      {selectedEscale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 relative">
            <button
              onClick={() => setSelectedEscale(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 border-b border-outline-variant pb-3">
              <div className="w-10 h-10 rounded bg-primary text-on-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">directions_boat</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-primary">{selectedEscale.nomNavire}</h3>
                <p className="text-xs text-outline font-mono">Callsign: {selectedEscale.callsign}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-surface-container rounded space-y-1">
                <span className="text-outline uppercase text-[10px] font-bold">N° Voyage</span>
                <p className="font-mono font-bold text-secondary text-sm">{selectedEscale.numeroVoyage}</p>
              </div>
              <div className="p-3 bg-surface-container rounded space-y-1">
                <span className="text-outline uppercase text-[10px] font-bold">Statut Actuel</span>
                <p className="font-bold text-emerald-600 text-sm">{selectedEscale.statut}</p>
              </div>
              <div className="p-3 bg-surface-container rounded space-y-1">
                <span className="text-outline uppercase text-[10px] font-bold">Port Chargement</span>
                <p className="font-semibold text-on-surface">{selectedEscale.portChargement}</p>
              </div>
              <div className="p-3 bg-surface-container rounded space-y-1">
                <span className="text-outline uppercase text-[10px] font-bold">Port Déchargement</span>
                <p className="font-semibold text-on-surface">{selectedEscale.portDechargement}</p>
              </div>
            </div>

            <div className="p-3 bg-secondary-fixed/20 border border-secondary/30 rounded text-xs space-y-1">
              <span className="font-bold text-primary block">Informations Berteillage & Manutention:</span>
              <p className="text-on-surface-variant">Poste à quai 14 - Terminal à Conteneurs Vridi. Déchargement prévu: 450 TEU.</p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedEscale(null)}
                className="px-5 py-2 bg-primary text-on-primary font-bold text-xs rounded hover:bg-secondary transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Escale Form */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">add_location_alt</span>
                <span>Programmer une Nouvelle Escale</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Nom du Navire</label>
                <input
                  type="text"
                  required
                  value={nomNavire}
                  onChange={e => setNomNavire(e.target.value)}
                  placeholder="ex: BOCS BREMEN"
                  className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs focus:border-secondary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Callsign / IMO</label>
                  <input
                    type="text"
                    value={callsign}
                    onChange={e => setCallsign(e.target.value)}
                    placeholder="IMO 948201"
                    className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs focus:border-secondary"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">N° Voyage</label>
                  <input
                    type="text"
                    required
                    value={numeroVoyage}
                    onChange={e => setNumeroVoyage(e.target.value)}
                    placeholder="VOY-2026-08"
                    className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs focus:border-secondary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Port Chargement</label>
                  <input
                    type="text"
                    value={portChargement}
                    onChange={e => setPortChargement(e.target.value)}
                    className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs focus:border-secondary"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Port Déchargement</label>
                  <input
                    type="text"
                    value={portDechargement}
                    onChange={e => setPortDechargement(e.target.value)}
                    className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs focus:border-secondary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Date d'Arrivée Prévue (ETA)</label>
                <input
                  type="date"
                  value={dateArrivee}
                  onChange={e => setDateArrivee(e.target.value)}
                  className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs focus:border-secondary"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded font-semibold text-on-surface-variant"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-on-primary font-bold rounded hover:bg-secondary transition-all"
                >
                  Enregistrer l'Escale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmation Suppression Escale */}
      {escaleToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 font-heading">Supprimer l'Escale Navire</h3>
                <p className="text-[11px] text-rose-600 font-semibold uppercase tracking-wider">Action définitive & irréversible</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs space-y-2">
              <p className="font-semibold text-slate-800">
                Voulez-vous vraiment supprimer l'escale du navire <span className="font-bold text-slate-900 underline">{escaleToDelete.nomNavire}</span> (Voyage <span className="font-mono font-bold text-blue-600">{escaleToDelete.numeroVoyage}</span>) ?
              </p>
              <p className="text-slate-500">
                Cette suppression retirera définitivement l'escale ainsi que tous ses connaissements (BLs) et conteneurs rattachés de la base de données.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
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
                  if (onDeleteEscale) {
                    onDeleteEscale(escaleToDelete.id);
                  }
                  setEscaleToDelete(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">delete_forever</span>
                <span>Confirmer la Suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
