// ═══════════════════════════════════════════════════════════════════════════
// MOTEUR RBAC BOCS — Source unique de vérité pour l'application effective
// des droits (matrice des habilitations + overrides par utilisateur).
//
// Anomalie corrigée : la matrice interactive d'attribution des droits
// (Admin > Attribution des Droits) était sauvegardée dans localStorage
// mais jamais consultée : la navigation utilisait des listes de rôles
// codées en dur dupliquées (Sidebar, Header, Dashboard).
// Désormais, tous les composants passent par ce module.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import type { UserRole } from '../types';
import type { NavTab } from '../components/layout/Sidebar';

// ─── Structure d'une habilitation ───
export interface PermissionItem {
    id: string;
    category: 'MARITIME' | 'EXPORT' | 'FINANCE' | 'DMDT' | 'ADMIN';
    categoryLabel: string;
    label: string;
    description: string;
    roles: Record<UserRole, boolean>;
}

// ─── Matrice d'usine BOCS (17 habilitations) ───
export const INITIAL_PERMISSIONS: PermissionItem[] = [
    {
        id: 'view_escales',
        category: 'MARITIME',
        categoryLabel: '🚢 Opérations Maritime & Escales',
        label: 'Consultation du Registre des Escales',
        description: 'Accès au registre des navires et mouvements portuaires (CIABJ)',
        roles: { ADMIN: true, AGENT_IMPORT: true, AGENT_EXPORT: true, COMPTABILITE: true, CLIENT_EXPORT: false }
    },
    {
        id: 'manage_escales',
        category: 'MARITIME',
        categoryLabel: '🚢 Opérations Maritime & Escales',
        label: 'Création, Modification & Clôture des Escales',
        description: 'Ouverture d\'escale, saisie numéro voyage, ETA/ETD et quai Vridi',
        roles: { ADMIN: true, AGENT_IMPORT: true, AGENT_EXPORT: true, COMPTABILITE: false, CLIENT_EXPORT: false }
    },
    {
        id: 'import_guce_xml',
        category: 'MARITIME',
        categoryLabel: '🚢 Opérations Maritime & Escales',
        label: 'Parsing & Traitement XML GUCE / PDF',
        description: 'Extraction des connaissements et conteneurs depuis fichiers douaniers',
        roles: { ADMIN: true, AGENT_IMPORT: true, AGENT_EXPORT: false, COMPTABILITE: true, CLIENT_EXPORT: false }
    },
    {
        id: 'fleet_radar',
        category: 'MARITIME',
        categoryLabel: '🚢 Opérations Maritime & Escales',
        label: 'Fleet Radar & Supervision Rade',
        description: 'Positionnement géographique et suivi radar des navires',
        roles: { ADMIN: true, AGENT_IMPORT: true, AGENT_EXPORT: true, COMPTABILITE: false, CLIENT_EXPORT: false }
    },
    {
        id: 'saisie_draft_bl',
        category: 'EXPORT',
        categoryLabel: '⚓ Opérations Export & Connaissements',
        label: 'Saisie des Drafts BL (Shipping Instructions)',
        description: 'Création et soumission des réservations et instructions BL Export',
        roles: { ADMIN: true, AGENT_IMPORT: false, AGENT_EXPORT: true, COMPTABILITE: false, CLIENT_EXPORT: true }
    },
    {
        id: 'validate_draft_bl',
        category: 'EXPORT',
        categoryLabel: '⚓ Opérations Export & Connaissements',
        label: 'Validation & Émission des Connaissements Définitifs',
        description: 'Verrouillage ETA 24h et émission du BL officiel armateur',
        roles: { ADMIN: true, AGENT_IMPORT: false, AGENT_EXPORT: true, COMPTABILITE: false, CLIENT_EXPORT: false }
    },
    {
        id: 'consolidation_export',
        category: 'EXPORT',
        categoryLabel: '⚓ Opérations Export & Connaissements',
        label: 'Consolidation du Manifeste Export',
        description: 'Groupage des conteneurs export et transmission douane',
        roles: { ADMIN: true, AGENT_IMPORT: false, AGENT_EXPORT: true, COMPTABILITE: false, CLIENT_EXPORT: false }
    },
    {
        id: 'create_invoices',
        category: 'FINANCE',
        categoryLabel: '💳 Finance & Facturation Maritime',
        label: 'Émission Factures BL (Proforma & Définitive)',
        description: 'Calcul multi-rubriques (Aconage, Roro, Sûretés, Débours)',
        roles: { ADMIN: true, AGENT_IMPORT: true, AGENT_EXPORT: true, COMPTABILITE: true, CLIENT_EXPORT: false }
    },
    {
        id: 'fne_certification',
        category: 'FINANCE',
        categoryLabel: '💳 Finance & Facturation Maritime',
        label: 'Certification Électronique DGI / FNE',
        description: 'Signature électronique certifiée FNE et QR code d\'authentification',
        roles: { ADMIN: true, AGENT_IMPORT: false, AGENT_EXPORT: false, COMPTABILITE: true, CLIENT_EXPORT: false }
    },
    {
        id: 'credit_notes',
        category: 'FINANCE',
        categoryLabel: '💳 Finance & Facturation Maritime',
        label: 'Émission des Notes d\'Avoir & Crédits',
        description: 'Régularisations financières, avoirs et annulations de factures',
        roles: { ADMIN: true, AGENT_IMPORT: false, AGENT_EXPORT: false, COMPTABILITE: true, CLIENT_EXPORT: false }
    },
    {
        id: 'balance_client',
        category: 'FINANCE',
        categoryLabel: '💳 Finance & Facturation Maritime',
        label: 'Consultation Balance Âgée & Suivi Créances',
        description: 'Règlements clients, encaissements et états des impayés',
        roles: { ADMIN: true, AGENT_IMPORT: false, AGENT_EXPORT: false, COMPTABILITE: true, CLIENT_EXPORT: false }
    },
    {
        id: 'invoice_configs',
        category: 'FINANCE',
        categoryLabel: '💳 Finance & Facturation Maritime',
        label: 'Configuration des Types & Rubriques de Factures',
        description: 'Barèmes tarifaires, montants unitaires et débours',
        roles: { ADMIN: true, AGENT_IMPORT: false, AGENT_EXPORT: false, COMPTABILITE: true, CLIENT_EXPORT: false }
    },
    {
        id: 'dmdt_calculator',
        category: 'DMDT',
        categoryLabel: '⏱️ Surestaries & DMDT',
        label: 'Calculateur DMDT & Franchises Conteneurs',
        description: 'Calcul dégressif surestaries / détentions import & export',
        roles: { ADMIN: true, AGENT_IMPORT: true, AGENT_EXPORT: false, COMPTABILITE: true, CLIENT_EXPORT: false }
    },
    {
        id: 'dmdt_tarifs_manage',
        category: 'DMDT',
        categoryLabel: '⏱️ Surestaries & DMDT',
        label: 'Gestion des Grilles Tarifaires DMDT',
        description: 'Ajustement des tarifs journaliers par tranche et jours de franchise',
        roles: { ADMIN: true, AGENT_IMPORT: false, AGENT_EXPORT: false, COMPTABILITE: true, CLIENT_EXPORT: false }
    },
    {
        id: 'admin_users_manage',
        category: 'ADMIN',
        categoryLabel: '🔒 Administration & Sécurité',
        label: 'Gestion des Comptes & Réinitialisation Accès',
        description: 'Création de compte, activation/suspension, mot de passe',
        roles: { ADMIN: true, AGENT_IMPORT: false, AGENT_EXPORT: false, COMPTABILITE: false, CLIENT_EXPORT: false }
    },
    {
        id: 'admin_rights_assign',
        category: 'ADMIN',
        categoryLabel: '🔒 Administration & Sécurité',
        label: 'Attribution des Droits & Matrice Habilitations',
        description: 'Attribution des droits d\'accès par profil et par utilisateur',
        roles: { ADMIN: true, AGENT_IMPORT: false, AGENT_EXPORT: false, COMPTABILITE: false, CLIENT_EXPORT: false }
    },
    {
        id: 'admin_audit_logs',
        category: 'ADMIN',
        categoryLabel: '🔒 Administration & Sécurité',
        label: 'Journal d\'Audit & Traçabilité Système',
        description: 'Consultation et export des logs de sécurité et d\'activité',
        roles: { ADMIN: true, AGENT_IMPORT: false, AGENT_EXPORT: false, COMPTABILITE: false, CLIENT_EXPORT: false }
    }
];

const MATRIX_STORAGE_KEY = 'bocs_permissions_matrix';
const OVERRIDES_STORAGE_KEY = 'bocs_user_permission_overrides';
const PERMISSIONS_CHANGED_EVENT = 'bocs:permissions-changed';

// Sujet évalué : utilisateur (id + rôle, statut éventuel)
export interface PermissionSubject {
    id: number;
    role: UserRole;
    estActif?: boolean;
}

// ─── Chargement de la matrice persistée (avec fusion des habilitations manquantes) ───
export function loadPermissionsMatrix(): PermissionItem[] {
    try {
        const saved = localStorage.getItem(MATRIX_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Fusion : conserve les personnalisations, réinjecte les habilitations d'usine absentes
                const missing = INITIAL_PERMISSIONS.filter(
                    init => !parsed.some((p: PermissionItem) => p && p.id === init.id)
                );
                return missing.length > 0 ? [...parsed, ...missing] : parsed;
            }
        }
    } catch (e) { /* matrice corrompue → retour aux valeurs d'usine */ }
    return INITIAL_PERMISSIONS;
}

// ─── Chargement des overrides individuels (userId → { permissionId → autorisé }) ───
export function loadUserOverrides(): Record<number, Record<string, boolean>> {
    try {
        const saved = localStorage.getItem(OVERRIDES_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (e) { /* overrides corrompus → ignorés */ }
    return {};
}

// ─── Droit effectif par rôle (matrice uniquement — ADMIN conserve tous les droits) ───
export function roleHasPermission(role: UserRole, permissionId: string): boolean {
    if (role === 'ADMIN') return true; // Verrou sécurité : colonne ADMIN toujours "Vérifié"
    const perm = loadPermissionsMatrix().find(p => p.id === permissionId);
    return perm ? Boolean(perm.roles[role]) : false;
}

// ─── Droit effectif pour un utilisateur (override individuel > matrice par rôle) ───
export function hasPermission(user: PermissionSubject | null | undefined, permissionId: string): boolean {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (user.estActif === false) return false; // Compte suspendu → aucun droit applicatif
    const override = loadUserOverrides()[user.id]?.[permissionId];
    if (typeof override === 'boolean') return override;
    return roleHasPermission(user.role, permissionId);
}

// ─── Au moins une habilitation requise parmi la liste ───
export function hasAnyPermission(user: PermissionSubject | null | undefined, permissionIds: string[]): boolean {
    if (!permissionIds || permissionIds.length === 0) return true;
    return permissionIds.some(id => hasPermission(user, id));
}

// ─── Correspondance Onglet applicatif → Habilitations requises (au moins une) ───
export const TAB_PERMISSIONS: Record<NavTab, string[]> = {
    dashboard: [],
    vessels: ['view_escales', 'fleet_radar'],
    import: ['import_guce_xml'],
    export: ['saisie_draft_bl', 'validate_draft_bl', 'consolidation_export'],
    export_saisie: ['saisie_draft_bl'],
    export_list: ['saisie_draft_bl', 'validate_draft_bl'],
    export_consolidation: ['consolidation_export'],
    facturation: ['create_invoices'],
    facturation_journal: ['create_invoices'],
    facturation_avoirs: ['credit_notes'],
    facturation_tarifs: ['dmdt_tarifs_manage'],
    facturation_balance: ['balance_client'],
    facturation_config: ['invoice_configs'],
    surestarie: ['dmdt_calculator'],
    admin: ['admin_users_manage', 'admin_rights_assign', 'fne_certification', 'admin_audit_logs'],
    admin_users: ['admin_users_manage'],
    admin_rights: ['admin_rights_assign'],
    admin_fne: ['fne_certification'],
    admin_audit: ['admin_audit_logs']
};

// ─── Contrôle d'accès effectif à un onglet / module ───
export function isTabAllowed(user: PermissionSubject | null | undefined, tab: NavTab): boolean {
    if (!user) return false;
    if (tab === 'dashboard') return true; // Le cockpit reste accessible à tous
    if (user.estActif === false) return false;
    const required = TAB_PERMISSIONS[tab];
    if (!required || required.length === 0) return true;
    return hasAnyPermission(user, required);
}

// ─── Notification de changement (après sauvegarde / réinitialisation de la matrice) ───
export function notifyPermissionsChanged(): void {
    try {
        window.dispatchEvent(new CustomEvent(PERMISSIONS_CHANGED_EVENT));
    } catch (e) { /* environnement sans DOM */ }
}

// ─── Hook : force le re-rendu des composants quand les droits changent ───
export function usePermissionsSync(): number {
    const [version, setVersion] = useState(0);
    useEffect(() => {
        const handler = () => setVersion(v => v + 1);
        window.addEventListener(PERMISSIONS_CHANGED_EVENT, handler);
        window.addEventListener('storage', handler);
        return () => {
            window.removeEventListener(PERMISSIONS_CHANGED_EVENT, handler);
            window.removeEventListener('storage', handler);
        };
    }, []);
    return version;
}