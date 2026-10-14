import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Vessel } from '../../types';
import { useEscapeClose, overlayClickClose } from '../../hooks/useEscapeClose';

interface VesselFormModalProps {
  open: boolean;
  /** Navire à modifier ; absent = création (éventuellement pré-remplie via `initial`). */
  editing?: Vessel | null;
  /** Valeurs proposées à la création (ex. nom extrait d'un manifeste). */
  initial?: Partial<Vessel>;
  /** Registre courant, pour refuser un doublon de nom ou d'IMO. */
  vessels: Vessel[];
  onClose: () => void;
  onSubmit: (vessel: Vessel) => void;
}

const sameText = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

const emptyForm = { nom: '', callsign: '', imoNumber: '', pavillon: '', armateur: '' };

const inputClass =
  'w-full h-10 px-3 text-sm rounded-md border border-border-default dark:border-night-line bg-surface-canvas dark:bg-night-sunken focus:outline-hidden focus:border-[#005DAA]';

/**
 * Formulaire de création / modification d'un navire du registre.
 * Rendu dans un portail : il peut s'ouvrir depuis un autre formulaire (création d'escale)
 * sans imbriquer les balises <form>.
 */
export const VesselFormModal: React.FC<VesselFormModalProps> = ({ open, editing, initial, vessels, onClose, onSubmit }) => {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  useEscapeClose(open, onClose);

  useEffect(() => {
    if (!open) return;
    const src = editing || initial || {};
    setForm({
      nom: src.nom || '',
      callsign: src.callsign || '',
      imoNumber: src.imoNumber || '',
      pavillon: src.pavillon || '',
      armateur: src.armateur || src.coque || ''
    });
    setError('');
    // Réinitialisé à l'ouverture seulement : un nouveau rendu du parent ne doit pas effacer la saisie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Le portail ne coupe pas la remontée des événements React vers un formulaire parent.
    e.stopPropagation();
    const nom = form.nom.trim().toUpperCase();
    const imo = form.imoNumber.trim();
    if (!nom || !form.callsign.trim()) {
      setError('Le nom et l\'indicatif radio (call sign) sont obligatoires.');
      return;
    }
    if (imo && !/^\d{7}$/.test(imo)) {
      setError('Le numéro IMO comporte 7 chiffres (ex. 9321483).');
      return;
    }
    const others = vessels.filter(v => v.id !== editing?.id);
    if (others.some(v => sameText(v.nom, nom))) {
      setError(`Le navire ${nom} existe déjà dans le registre.`);
      return;
    }
    if (imo && others.some(v => sameText(v.imoNumber, imo))) {
      setError(`Le numéro IMO ${imo} est déjà attribué à un autre navire.`);
      return;
    }
    const armateur = form.armateur.trim();
    onSubmit({
      ...(editing || {}),
      id: editing?.id ?? Date.now(),
      nom,
      callsign: form.callsign.trim().toUpperCase(),
      imoNumber: imo || undefined,
      pavillon: form.pavillon.trim() || undefined,
      armateur: armateur || undefined,
      coque: armateur || undefined
    });
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="vessel-form-title" onClick={overlayClickClose(onClose)} className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-surface-canvas dark:bg-night-surface rounded-md shadow-2xl dark:shadow-black/70 max-w-md w-full p-6 space-y-4 text-text-primary dark:text-night-ink border border-border-default dark:border-night-line animate-fade-in">
        <div className="flex items-center justify-between border-b border-border-default dark:border-night-line pb-3">
          <h3 id="vessel-form-title" className="font-black text-xl text-[#002B49] dark:text-night-ink flex items-center gap-2">
            <span aria-hidden="true" className="material-symbols-outlined text-[#005DAA] dark:text-night-link">directions_boat</span>
            <span>{editing ? 'Modifier le navire' : 'Créer un navire'}</span>
          </h3>
          <button type="button" aria-label="Fermer" onClick={onClose} className="text-text-muted dark:text-night-ink-3 hover:text-text-secondary cursor-pointer">
            <span aria-hidden="true" className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-3 text-sm">
          <div>
            <label htmlFor="vessel-nom" className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Nom du navire *</label>
            <input id="vessel-nom" type="text" required autoFocus value={form.nom} onChange={set('nom')} placeholder="ex. BOCS DAKAR" className={`${inputClass} font-bold uppercase`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="vessel-callsign" className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Call sign *</label>
              <input id="vessel-callsign" type="text" required value={form.callsign} onChange={set('callsign')} placeholder="ex. 9V8974" className={`${inputClass} font-mono uppercase`} />
            </div>
            <div>
              <label htmlFor="vessel-imo" className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">N° IMO</label>
              <input id="vessel-imo" type="text" inputMode="numeric" maxLength={7} value={form.imoNumber} onChange={set('imoNumber')} placeholder="7 chiffres" className={`${inputClass} font-mono`} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="vessel-armateur" className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Armateur</label>
              <input id="vessel-armateur" type="text" value={form.armateur} onChange={set('armateur')} placeholder="ex. BOCS Line" className={inputClass} />
            </div>
            <div>
              <label htmlFor="vessel-pavillon" className="block font-bold text-text-secondary dark:text-night-ink uppercase mb-1">Pavillon</label>
              <input id="vessel-pavillon" type="text" value={form.pavillon} onChange={set('pavillon')} placeholder="ex. Liberia" className={inputClass} />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>
          )}

          <div className="pt-3 flex justify-end gap-2 border-t border-border-default dark:border-night-line">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-surface-sunken dark:bg-night-sunken hover:bg-zinc-200 rounded-md font-bold text-text-secondary dark:text-night-ink cursor-pointer transition-colors">
              Annuler
            </button>
            <button type="submit" className="px-5 py-2 premium-btn-primary text-white font-bold rounded-md shadow-md transition-all cursor-pointer flex items-center gap-1.5">
              <span aria-hidden="true" className="material-symbols-outlined text-lg">check</span>
              <span>{editing ? 'Enregistrer' : 'Créer le navire'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
