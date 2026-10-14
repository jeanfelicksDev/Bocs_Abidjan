import React, { useState } from 'react';
import { Vessel } from '../types';
import { useVessels, useEscales } from '../hooks/useData';
import { VesselFormModal } from '../components/vessels/VesselFormModal';
import { useEscapeClose, overlayClickClose } from '../hooks/useEscapeClose';

interface VesselsModuleProps {
  onAddVessel: (vessel: Vessel) => void;
  onUpdateVessel: (vessel: Vessel) => void;
  onDeleteVessel: (vesselId: number) => void;
}

const sameName = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

/**
 * Registre des navires : liste, création, modification et suppression.
 * Les navires enregistrés ici sont ceux proposés à la création d'une escale.
 */
export const VesselsModule: React.FC<VesselsModuleProps> = ({ onAddVessel, onUpdateVessel, onDeleteVessel }) => {
  const { vessels, isLoading, isError } = useVessels();
  const { escales } = useEscales();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vessel | null>(null);
  const [toDelete, setToDelete] = useState<Vessel | null>(null);

  useEscapeClose(!!toDelete, () => setToDelete(null));

  const query = search.trim().toLowerCase();
  const rows = [...vessels]
    .filter(v => !query || [v.nom, v.callsign, v.imoNumber, v.armateur, v.pavillon].some(f => f?.toLowerCase().includes(query)))
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const escaleCount = (v: Vessel) => escales.filter(e => sameName(e.nomNavire, v.nom)).length;

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (v: Vessel) => { setEditing(v); setFormOpen(true); };

  const handleSubmit = (vessel: Vessel) => {
    if (editing) onUpdateVessel(vessel);
    else onAddVessel(vessel);
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#002B49] dark:text-night-ink font-display">Navires</h1>
          <p className="text-sm text-text-muted dark:text-night-ink-2 font-medium mt-1">
            Registre de la flotte. Un navire enregistré ici se sélectionne directement à la création d'une escale.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="self-start md:self-auto px-4 py-2.5 premium-btn-primary text-white font-bold text-sm rounded-md shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-lg">add</span>
          <span>Créer un navire</span>
        </button>
      </div>

      <div className="bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md shadow-1">
        <div className="p-4 border-b border-border-default dark:border-night-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <label htmlFor="vessels-search" className="sr-only">Rechercher un navire</label>
          <input
            id="vessels-search"
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, call sign, IMO, armateur…"
            className="w-full sm:max-w-sm h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line bg-surface-canvas dark:bg-night-sunken focus:outline-hidden focus:border-[#005DAA]"
          />
          <span className="text-sm font-bold text-text-muted dark:text-night-ink-2">
            {vessels.length} navire{vessels.length > 1 ? 's' : ''} enregistré{vessels.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-base dark:bg-night-sunken border-b border-border-default dark:border-night-line text-text-secondary dark:text-night-ink font-bold uppercase text-xs">
              <tr>
                <th scope="col" className="p-3">Navire</th>
                <th scope="col" className="p-3">Call sign</th>
                <th scope="col" className="p-3">N° IMO</th>
                <th scope="col" className="p-3">Armateur</th>
                <th scope="col" className="p-3">Pavillon</th>
                <th scope="col" className="p-3 text-right">Escales</th>
                <th scope="col" className="p-3 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default dark:divide-night-line font-medium">
              {rows.map(v => (
                <tr key={v.id} className="hover:bg-surface-base dark:hover:bg-night-sunken transition-colors">
                  <td className="p-3 font-extrabold text-[#002B49] dark:text-night-ink">{v.nom}</td>
                  <td className="p-3 font-mono font-bold text-text-secondary dark:text-night-ink">{v.callsign || '—'}</td>
                  <td className="p-3 font-mono text-text-secondary dark:text-night-ink">{v.imoNumber || '—'}</td>
                  <td className="p-3 text-text-secondary dark:text-night-ink">{v.armateur || v.coque || '—'}</td>
                  <td className="p-3 text-text-secondary dark:text-night-ink">{v.pavillon || '—'}</td>
                  <td className="p-3 text-right font-mono text-text-secondary dark:text-night-ink">{escaleCount(v)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => openEdit(v)} aria-label={`Modifier ${v.nom}`} title="Modifier" className="p-1.5 hover:bg-sky-50 dark:hover:bg-night-sunken text-[#005DAA] dark:text-night-link rounded-lg cursor-pointer">
                        <span aria-hidden="true" className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button type="button" onClick={() => setToDelete(v)} aria-label={`Supprimer ${v.nom}`} title="Supprimer" className="p-1.5 hover:bg-rose-50 dark:hover:bg-night-sunken text-rose-600 rounded-lg cursor-pointer">
                        <span aria-hidden="true" className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-text-muted dark:text-night-ink-2">
                    {isLoading
                      ? 'Chargement du registre…'
                      : isError
                        ? 'Le registre des navires n\'a pas pu être chargé.'
                        : query
                          ? `Aucun navire ne correspond à « ${search.trim()} ».`
                          : 'Aucun navire enregistré. Créez le premier pour pouvoir le sélectionner à la création d\'une escale.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VesselFormModal
        open={formOpen}
        editing={editing}
        vessels={vessels}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
      />

      {toDelete && (
        <div role="dialog" aria-modal="true" aria-labelledby="vessel-delete-title" onClick={overlayClickClose(() => setToDelete(null))} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-canvas dark:bg-night-surface rounded-md max-w-md w-full p-6 shadow-2xl dark:shadow-black/70 space-y-4 border border-border-default dark:border-night-line text-text-primary dark:text-night-ink animate-fade-in">
            <h2 id="vessel-delete-title" className="font-black text-lg">Supprimer {toDelete.nom} ?</h2>
            <p className="text-sm text-text-secondary dark:text-night-ink">
              Le navire ne sera plus proposé à la création d'escale.
              {escaleCount(toDelete) > 0 && ` Ses ${escaleCount(toDelete)} escale(s) existante(s) sont conservées.`}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border-default dark:border-night-line">
              <button type="button" onClick={() => setToDelete(null)} className="px-4 py-2 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 rounded-md font-bold text-sm text-text-secondary dark:text-night-ink cursor-pointer">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => { onDeleteVessel(toDelete.id); setToDelete(null); }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-bold text-sm cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
