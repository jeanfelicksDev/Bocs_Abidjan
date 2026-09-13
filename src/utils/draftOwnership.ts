// ═══════════════════════════════════════════════════════════════════════════
// ISOLATION DES DRAFTS EXPORT PAR COMPTE CLIENT — Règle partagée unique.
//
// Principe : chaque CLIENT_EXPORT possède son propre compte et ne voit que
// SES seuls drafts. Le rattachement se fait par identifiants stables
// (clientId, clientEmail, société, nom du chargeur) — SANS repli générique :
// un draft non rattaché au compte n'est jamais affiché.
// ═══════════════════════════════════════════════════════════════════════════

import type { DraftExport, User, UserRole } from '../types';

// Normalisation : insensible casse / espaces / ponctuation (SARL Agro-Sud ≈ sarlagrosud)
export const normalizeOwnershipToken = (v?: string): string =>
    (v || '').trim().toLowerCase().replace(/[\s_.-]+/g, '');

/**
 * Un draft appartient-il à cet utilisateur ?
 * Règle stricte : aucune correspondance floue, aucun repli par défaut.
 */
export function isDraftOwnedByUser(draft: DraftExport, user: User | null | undefined): boolean {
    if (!user) return false;

    const userId = Number(user.id);
    if (Number(draft.clientId) === userId) return true;

    const userEmail = (user.email || '').trim().toLowerCase();
    if (userEmail && (draft.clientEmail || '').trim().toLowerCase() === userEmail) return true;

    const userSociete = normalizeOwnershipToken(user.nomSociete);
    if (userSociete) {
        const candidates = [
            normalizeOwnershipToken(draft.clientSociete),
            normalizeOwnershipToken(draft.clientNom),
            normalizeOwnershipToken(draft.shipperInfo?.nom)
        ].filter(Boolean);
        if (candidates.some(c => c === userSociete)) return true;
    }

    const userName = normalizeOwnershipToken(user.nomComplet);
    if (userName) {
        const candidates = [
            normalizeOwnershipToken(draft.clientNom),
            normalizeOwnershipToken(draft.clientEmail),
            normalizeOwnershipToken(draft.shipperInfo?.nom),
            normalizeOwnershipToken(draft.shipperInfo?.email)
        ].filter(Boolean);
        if (candidates.some(c => c === userName)) return true;
    }

    return false;
}

/**
 * Filtre la liste des drafts pour un utilisateur.
 * - Client export : uniquement SES propres drafts.
 * - Agents internes (Admin, Agents, Compta) : visibilité complète.
 */
export function filterDraftsForUser(drafts: DraftExport[], user: User | null | undefined, role: UserRole): DraftExport[] {
    if (role !== 'CLIENT_EXPORT') return drafts;
    return drafts.filter(d => isDraftOwnedByUser(d, user));
}
