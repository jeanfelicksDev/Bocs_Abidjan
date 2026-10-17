import { prisma } from './_db.js';
import type { SessionUser } from './_auth.js';
import { isDraftOwnedByUser } from '../src/utils/draftOwnership.js';

/**
 * Ce qui appartient à un client export, côté serveur.
 *  • Drafts : même règle que l'interface (src/utils/draftOwnership.ts) — identifiant
 *    du compte, sinon e-mail, société ou nom du chargeur, sans repli flou.
 *  • Factures : celles dont le BL est le BL généré, ou le numéro, d'un de ses drafts.
 *  • Règlements et avoirs : ceux de ses factures.
 */

const ref = (value?: string | null) => String(value ?? '').trim().toUpperCase();

/** Forme minimale d'un draft (ligne de la base) pour la règle d'appartenance. */
export const draftOwnershipView = (d: any) => ({
  clientId: d.client_id ?? undefined,
  clientEmail: d.client_email ?? undefined,
  clientSociete: d.client_societe ?? undefined,
  clientNom: d.client_nom ?? undefined,
  shipperInfo: d.shipper_info ?? undefined
});

export const ownsDraft = (draft: any, user: SessionUser): boolean =>
  isDraftOwnedByUser(draft, user as any);

export interface ClientScope {
  draftIds: Set<number>;
  /** Références de BL connues du client (BL généré et numéro de draft). */
  blRefs: Set<string>;
}

export const clientScope = async (user: SessionUser): Promise<ClientScope> => {
  const rows = await prisma.draft_exports.findMany({
    select: {
      id: true,
      client_id: true,
      client_email: true,
      client_societe: true,
      client_nom: true,
      shipper_info: true,
      numero_draft: true,
      numero_bl_genere: true
    }
  });
  const scope: ClientScope = { draftIds: new Set(), blRefs: new Set() };
  for (const row of rows) {
    if (!ownsDraft(draftOwnershipView(row), user)) continue;
    scope.draftIds.add(Number(row.id));
    for (const r of [row.numero_draft, row.numero_bl_genere]) if (ref(r)) scope.blRefs.add(ref(r));
  }
  return scope;
};

export const invoiceBelongsTo = (numeroBL: string | null | undefined, scope: ClientScope) =>
  scope.blRefs.has(ref(numeroBL));

/** Identifiants des factures du client. */
export const clientInvoiceIds = async (user: SessionUser): Promise<Set<number>> => {
  const scope = await clientScope(user);
  if (scope.blRefs.size === 0) return new Set();
  const rows = await prisma.invoices.findMany({ select: { id: true, numero_bl: true } });
  return new Set(rows.filter(r => invoiceBelongsTo(r.numero_bl, scope)).map(r => Number(r.id)));
};

/** Ne garde, dans un tableau de la réponse, que les éléments retenus. */
export const keepInList = <T>(body: any, field: string, keep: (item: T) => boolean) => ({
  ...body,
  [field]: Array.isArray(body?.[field]) ? body[field].filter(keep) : body?.[field]
});
