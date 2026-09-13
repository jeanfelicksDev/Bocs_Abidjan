import React from 'react';
import { DraftStatus, PaymentStatus, InvoiceType } from '../../types';

interface StatusBadgeProps {
  status: string;
  type?: 'bl' | 'draft' | 'invoice' | 'payment';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'bl' }) => {
  let colorClass = 'bg-gray-100 text-gray-800 border-gray-300';
  let label = status;

  if (type === 'draft' || status in { BROUILLON: 1, SOUMIS: 1, VALIDE: 1, DEMANDE_MODIF: 1, BL_GENERE: 1 }) {
    switch (status as DraftStatus) {
      case 'BROUILLON':
        colorClass = 'bg-transparent text-slate-700 border-slate-300';
        label = 'Brouillon';
        break;
      case 'SOUMIS':
        colorClass = 'bg-transparent text-blue-800 border-blue-300';
        label = 'Soumis (En attente validation)';
        break;
      case 'VALIDE':
        colorClass = 'bg-transparent text-emerald-800 border-emerald-300';
        label = 'Validé par le client';
        break;
      case 'DEMANDE_MODIF':
        colorClass = 'bg-transparent text-amber-800 border-amber-300 font-bold';
        label = 'Demande de modification';
        break;
      case 'BL_GENERE':
        colorClass = 'bg-transparent text-indigo-800 border-indigo-300 font-bold';
        label = 'BL Original Généré & Signé';
        break;
      case 'REJETE':
        colorClass = 'bg-transparent text-rose-800 border-rose-300';
        label = 'Refusé';
        break;
    }
  } else if (type === 'payment' || status in { NON_PAYE: 1, PARTIEL: 1, PAYE: 1 }) {
    switch (status as PaymentStatus) {
      case 'NON_PAYE':
        colorClass = 'bg-transparent text-rose-800 border-rose-300 font-bold';
        label = 'Non Réglé';
        break;
      case 'PARTIEL':
        colorClass = 'bg-transparent text-rose-800 border-rose-300 font-bold';
        label = 'Non Réglé';
        break;
      case 'PAYE':
        colorClass = 'bg-transparent text-emerald-800 border-emerald-300 font-bold';
        label = 'Soldé';
        break;
    }
  } else if (type === 'invoice') {
    switch (status as InvoiceType) {
      case 'PROFORMA_IMPORT':
        colorClass = 'bg-transparent text-cyan-800 border-cyan-300';
        label = 'Proforma Import';
        break;
      case 'DEFINITIVE_IMPORT':
        colorClass = 'bg-transparent text-blue-900 border-blue-300 font-bold';
        label = 'Facture Définitive Import';
        break;
      case 'PROFORMA_EXPORT':
        colorClass = 'bg-transparent text-teal-800 border-teal-300';
        label = 'Proforma Export';
        break;
      case 'DEFINITIVE_EXPORT':
        colorClass = 'bg-transparent text-emerald-800 border-emerald-300 font-bold';
        label = 'Facture Définitive Export';
        break;
    }
  } else {
    // Import BL Status
    switch (status) {
      case 'EN_ATTENTE':
        colorClass = 'bg-transparent text-amber-800 border-amber-300';
        label = 'En Attente';
        break;
      case 'EN_COURS':
        colorClass = 'bg-transparent text-blue-800 border-blue-300';
        label = 'En Cours (Au Parc)';
        break;
      case 'FACTURE':
        colorClass = 'bg-transparent text-emerald-800 border-emerald-300 font-bold';
        label = 'Facturé & Réglé';
        break;
    }
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-75"></span>
      {label}
    </span>
  );
};
