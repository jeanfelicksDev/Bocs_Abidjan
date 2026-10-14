import React, { useState } from 'react';
import { Vessel } from '../../types';
import { VesselFormModal } from './VesselFormModal';

/** Navire du registre portant ce nom (casse et espaces ignorés). */
export function findVesselByName(vessels: Vessel[], nom?: string): Vessel | undefined {
  const key = (nom || '').trim().toLowerCase();
  return key ? vessels.find(v => v.nom.trim().toLowerCase() === key) : undefined;
}

interface VesselPickerProps {
  id: string;
  vessels: Vessel[];
  /** Nom du navire actuellement retenu par le formulaire (escale). */
  value: string;
  /** Appelé avec le navire choisi (ou `null` si la sélection est vidée). */
  onChange: (vessel: Vessel | null) => void;
  /** Création d'un navire depuis le formulaire ; sans elle, le lien « Créer un navire » est masqué. */
  onCreateVessel?: (vessel: Vessel) => void;
  required?: boolean;
  className?: string;
}

const readOnlyClass =
  'w-full h-11 px-3.5 flex items-center text-sm font-mono font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-xl select-all';

/**
 * Sélection d'un navire enregistré pour une escale : liste du registre, puis call sign
 * et IMO affichés automatiquement (lecture seule). Un nom inconnu du registre (ex. extrait
 * d'un manifeste) est signalé avec un raccourci pour créer le navire pré-rempli.
 */
export const VesselPicker: React.FC<VesselPickerProps> = ({ id, vessels, value, onChange, onCreateVessel, required, className = '' }) => {
  const [creating, setCreating] = useState(false);
  const selected = findVesselByName(vessels, value);
  const unknownName = value.trim() && !selected ? value.trim() : '';
  const sorted = [...vessels].sort((a, b) => a.nom.localeCompare(b.nom));

  const handleCreated = (vessel: Vessel) => {
    onCreateVessel?.(vessel);
    onChange(vessel);
    setCreating(false);
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${className}`}>
      <div>
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <label htmlFor={id} className="block text-xs font-black text-text-secondary">Navire{required ? ' *' : ''}</label>
          {onCreateVessel && (
            <button type="button" onClick={() => setCreating(true)} className="text-xs font-black text-primary hover:underline cursor-pointer">
              + Créer un navire
            </button>
          )}
        </div>
        <select
          id={id}
          required={required}
          value={selected ? String(selected.id) : ''}
          onChange={e => onChange(vessels.find(v => String(v.id) === e.target.value) || null)}
          className="w-full h-11 px-3.5 text-sm font-bold text-zinc-900 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:border-primary cursor-pointer"
        >
          <option value="">{vessels.length ? 'Sélectionner un navire…' : 'Aucun navire enregistré'}</option>
          {sorted.map(v => (
            <option key={v.id} value={String(v.id)}>{v.nom}</option>
          ))}
        </select>
        {unknownName && (
          <p role="status" className="mt-1.5 text-xs font-bold text-amber-700">
            « {unknownName} » n'est pas dans le registre.{' '}
            {onCreateVessel && (
              <button type="button" onClick={() => setCreating(true)} className="underline cursor-pointer">Le créer</button>
            )}
          </p>
        )}
      </div>

      <div>
        <span className="block text-xs font-black text-text-secondary mb-1">Call sign</span>
        <output aria-label="Call sign du navire" className={readOnlyClass}>{selected?.callsign || '—'}</output>
      </div>

      <div>
        <span className="block text-xs font-black text-text-secondary mb-1">N° IMO</span>
        <output aria-label="Numéro IMO du navire" className={readOnlyClass}>{selected?.imoNumber || '—'}</output>
      </div>

      <VesselFormModal
        open={creating}
        initial={unknownName ? { nom: unknownName } : undefined}
        vessels={vessels}
        onClose={() => setCreating(false)}
        onSubmit={handleCreated}
      />
    </div>
  );
};
