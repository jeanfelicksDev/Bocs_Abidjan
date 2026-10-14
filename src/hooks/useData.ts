/**
 * Données métier partagées (escales, BL, factures, règlements, drafts, avoirs).
 *
 * Une seule source de vérité : le cache SWR de chaque route API. `App.tsx` y écrit
 * (via `useSharedList`) et tous les modules y lisent (via `useEscales`, `useBls`…) :
 * une création, modification ou suppression faite n'importe où apparaît aussitôt
 * dans tous les écrans, sans rafraîchir la page.
 *
 * Chaque liste est chargée et nettoyée par le même `fetchList` (dédoublonnage,
 * normalisation des factures), quel que soit l'écran qui déclenche le chargement.
 */
import { useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { Escale, BL, DraftExport, Invoice, CreditNote, Payment, Vessel } from '../types';
import { normalizeInvoice } from '../utils/normalizeInvoice';

const sameName = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

const LISTS = {
  '/api/escales': {
    field: 'escales',
    clean: (list: Escale[]) =>
      list.filter((cur, i) =>
        list.findIndex((e) => e.id === cur.id || (sameName(e.nomNavire, cur.nomNavire) && e.numeroVoyage?.trim() === cur.numeroVoyage?.trim())) === i
      ),
  },
  '/api/bls': {
    field: 'bls',
    clean: (list: BL[]) =>
      list.filter((cur, i) => list.findIndex((b) => b.id === cur.id || (b.numeroBL === cur.numeroBL && b.escaleId === cur.escaleId)) === i),
  },
  '/api/invoices': { field: 'invoices', clean: (list: Invoice[]) => list.map(normalizeInvoice) },
  '/api/payments': { field: 'payments', clean: (list: Payment[]) => list },
  '/api/drafts': { field: 'drafts', clean: (list: DraftExport[]) => list },
  '/api/credit-notes': { field: 'creditNotes', clean: (list: CreditNote[]) => list },
} as const;

export type SharedListKey = keyof typeof LISTS;
type ListOf<K extends SharedListKey> = Parameters<(typeof LISTS)[K]['clean']>[0];

/** Charge une liste ; une réponse en erreur lève une exception pour que SWR conserve les données déjà affichées. */
async function fetchList(key: string): Promise<unknown[]> {
  const res = await fetch(key);
  const json = await res.json();
  const conf = LISTS[key as SharedListKey];
  const list = json?.[conf.field];
  if (!res.ok || json?.success === false || !Array.isArray(list)) {
    throw new Error(json?.error || `Chargement impossible (${key}, ${res.status})`);
  }
  return (conf.clean as (l: unknown[]) => unknown[])(list);
}

const EMPTY: never[] = [];

function useList<K extends SharedListKey>(key: K) {
  const { data, error, mutate } = useSWR<unknown[]>(key, fetchList);
  return { list: (data as ListOf<K> | undefined) || (EMPTY as ListOf<K>), isLoading: !error && !data, isError: error, mutate };
}

type Updater<T> = T[] | ((prev: T[]) => T[]);

/**
 * Équivalent de `useState` adossé au cache partagé : `set` modifie immédiatement
 * la liste vue par tous les écrans (sans recharger depuis le serveur).
 */
export function useSharedList<K extends SharedListKey>(key: K) {
  type T = ListOf<K>[number];
  const { list, mutate } = useList(key);
  const set = useCallback(
    (next: Updater<T>) => {
      void mutate(
        (current) => {
          const prev = ((current as T[] | undefined) || []) as T[];
          return typeof next === 'function' ? (next as (p: T[]) => T[])(prev) : next;
        },
        { revalidate: false }
      );
    },
    [mutate]
  );
  return [list as T[], set] as const;
}

/** Recharge depuis le serveur les listes touchées par une écriture (ex. suppression en cascade). */
export function revalidateLists(...keys: SharedListKey[]) {
  return Promise.all(keys.map((k) => globalMutate(k)));
}

export function useEscales() {
  const { list, ...rest } = useList('/api/escales');
  return { escales: list, ...rest };
}

export function useBls() {
  const { list, ...rest } = useList('/api/bls');
  return { bls: list, ...rest };
}

export function useDrafts() {
  const { list, ...rest } = useList('/api/drafts');
  return { drafts: list, ...rest };
}

export function useInvoices() {
  const { list, ...rest } = useList('/api/invoices');
  return { invoices: list, ...rest };
}

export function useCreditNotes() {
  const { list, ...rest } = useList('/api/credit-notes');
  return { creditNotes: list, ...rest };
}

export function usePayments() {
  const { list, ...rest } = useList('/api/payments');
  return { payments: list, ...rest };
}

export function useVessels() {
  const { data, error, mutate } = useSWR<{ vessels: Vessel[] }>('/api/vessels', (url: string) => fetch(url).then((res) => res.json()));
  return { vessels: data?.vessels || [], isLoading: !error && !data, isError: error, mutate };
}
