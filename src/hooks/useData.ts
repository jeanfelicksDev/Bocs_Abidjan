import useSWR from 'swr';
import { Escale, BL, DraftExport, Invoice, CreditNote, Payment, Vessel } from '../types';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useEscales() {
  const { data, error, mutate } = useSWR<{ escales: Escale[] }>('/api/escales', fetcher);
  return { escales: data?.escales || [], isLoading: !error && !data, isError: error, mutate };
}

export function useBls() {
  const { data, error, mutate } = useSWR<{ bls: BL[] }>('/api/bls', fetcher);
  return { bls: data?.bls || [], isLoading: !error && !data, isError: error, mutate };
}

export function useDrafts() {
  const { data, error, mutate } = useSWR<{ drafts: DraftExport[] }>('/api/drafts', fetcher);
  return { drafts: data?.drafts || [], isLoading: !error && !data, isError: error, mutate };
}

export function useInvoices() {
  const { data, error, mutate } = useSWR<{ invoices: Invoice[] }>('/api/invoices', fetcher);
  return { invoices: data?.invoices || [], isLoading: !error && !data, isError: error, mutate };
}

export function useCreditNotes() {
  const { data, error, mutate } = useSWR<{ creditNotes: CreditNote[] }>('/api/credit-notes', fetcher);
  return { creditNotes: data?.creditNotes || [], isLoading: !error && !data, isError: error, mutate };
}

export function usePayments() {
  const { data, error, mutate } = useSWR<{ payments: Payment[] }>('/api/payments', fetcher);
  return { payments: data?.payments || [], isLoading: !error && !data, isError: error, mutate };
}

export function useVessels() {
  const { data, error, mutate } = useSWR<{ vessels: Vessel[] }>('/api/vessels', fetcher);
  return { vessels: data?.vessels || [], isLoading: !error && !data, isError: error, mutate };
}
