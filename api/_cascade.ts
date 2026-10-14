import { prisma } from './_db.js';

/**
 * Supprime les factures rattachées à des BL (par identifiant ou par numéro),
 * avec tout ce qui en dépend : règlements, avoirs et leurs lignes, lignes de facture.
 * Utilisé à la suppression d'une escale (BL import) et d'un draft export (BL export) :
 * sans cela, les factures restent orphelines et continuent d'alimenter la balance.
 */
export async function deleteInvoicesOfBls(blIds: bigint[], blNumbers: string[]) {
  const numbers = blNumbers.filter(Boolean);
  if (blIds.length === 0 && numbers.length === 0) return 0;

  const invoices = await prisma.invoices.findMany({
    where: { OR: [{ bl_id: { in: blIds } }, { numero_bl: { in: numbers } }] },
    select: { id: true },
  });
  const invoiceIds = invoices.map((i) => i.id);
  if (invoiceIds.length === 0) return 0;

  const creditNotes = await prisma.credit_notes.findMany({
    where: { facture_id: { in: invoiceIds } },
    select: { id: true },
  });
  const creditNoteIds = creditNotes.map((c) => c.id);

  // Ordre des dépendances, en une transaction : tout ou rien.
  await prisma.$transaction([
    prisma.payments.deleteMany({ where: { facture_id: { in: invoiceIds } } }),
    prisma.credit_note_items.deleteMany({ where: { credit_note_id: { in: creditNoteIds } } }),
    prisma.credit_notes.deleteMany({ where: { id: { in: creditNoteIds } } }),
    prisma.invoice_items.deleteMany({ where: { invoice_id: { in: invoiceIds } } }),
    prisma.invoices.deleteMany({ where: { id: { in: invoiceIds } } }),
  ]);
  return invoiceIds.length;
}
