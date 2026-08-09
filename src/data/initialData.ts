import { 
  User, 
  Escale, 
  BL, 
  DraftExport, 
  Invoice, 
  Payment, 
  FneParam, 
  TarifSurestarie, 
  FranchiseSurestarie, 
  AuditLog,
  InvoiceTypeConfig,
  RubriqueConfig
} from '../types';
import { DEFAULT_FRANCHISES, DEFAULT_TARIFS } from '../utils/dmdtCalculator';

export const INITIAL_USERS: User[] = [
  { id: 1, nomComplet: 'Jean-Marc KOFFI', email: 'admin@bocs.ci', role: 'ADMIN', telephone: '+225 07 08 09 10 11', nomSociete: 'BOCS CI Agency', estActif: true },
  { id: 2, nomComplet: 'Marie-Claire ADOU', email: 'import@bocs.ci', role: 'AGENT_IMPORT', telephone: '+225 05 06 07 08 09', nomSociete: 'BOCS CI Agency', estActif: true },
  { id: 3, nomComplet: 'Kouassi PATRICE', email: 'export@bocs.ci', role: 'AGENT_EXPORT', telephone: '+225 01 02 03 04 05', nomSociete: 'BOCS CI Agency', estActif: true },
  { id: 4, nomComplet: 'Awa DIABATE', email: 'compta@bocs.ci', role: 'COMPTABILITE', telephone: '+225 07 11 22 33 44', nomSociete: 'BOCS CI Agency', estActif: true },
  { id: 5, nomComplet: 'FRIESLANDCAMPINA IVORY COAST', email: 'logistics@friesland.ci', role: 'CLIENT_EXPORT', telephone: '+225 21 22 23 24', nomSociete: 'FRIESLANDCAMPINA SA', pays: 'Côte d\'Ivoire', estActif: true },
  { id: 6, nomComplet: 'INALCA COTE D\'IVOIRE', email: 'transit@inalca.ci', role: 'CLIENT_EXPORT', telephone: '+225 27 21 00 11', nomSociete: 'INALCA CI', pays: 'Côte d\'Ivoire', estActif: true },
  { id: 7, nomComplet: 'SOCIETE ROYAL IMPORT EXPORT', email: 'contact@sorimpex.ci', role: 'CLIENT_EXPORT', telephone: '+225 21 35 44 55', nomSociete: 'SORIMPEX SARL', pays: 'Côte d\'Ivoire', estActif: true }
];

export const INITIAL_ESCALES: Escale[] = [];

export const INITIAL_BLS: BL[] = [];

export const INITIAL_DRAFTS_EXPORT: DraftExport[] = [];

export const INITIAL_INVOICES: Invoice[] = [];

export const INITIAL_PAYMENTS: Payment[] = [];

export const INITIAL_FNE_PARAMS: FneParam[] = [
  { id: 1, cle: 'api_url', valeur: 'https://api.fne.dgi.gouv.ci/v1', description: 'URL de base de l\'API FNE de la DGI Côte d\'Ivoire', updatedAt: '2026-04-01' },
  { id: 2, cle: 'api_key', valeur: 'bocs_live_key_98a7b6c5d4e3f210', description: 'Clé d\'API sécurisée attribuée à l\'agence BOCS', updatedAt: '2026-04-01' },
  { id: 3, cle: 'endpoint_soumission', valeur: '/factures/normaliser', description: 'Point de terminaison pour la soumission des factures', updatedAt: '2026-04-01' },
  { id: 4, cle: 'environment', valeur: 'SANDBOX_TEST', description: 'Environnement FNE actuel (SANDBOX_TEST / PRODUCTION)', updatedAt: '2026-04-01' },
  { id: 5, cle: 'auto_submit', valeur: 'TRUE', description: 'Transmission automatique des factures définitives à la DGI', updatedAt: '2026-04-01' }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_TARIFS_SURESTARIE: TarifSurestarie[] = DEFAULT_TARIFS;

export const INITIAL_INVOICE_TYPE_CONFIGS: InvoiceTypeConfig[] = [
  { id: '1', name: 'Caution', description: 'Facturation de garantie' },
  { id: '2', name: 'Echange', description: 'Frais d\'échange BL' },
  { id: '3', name: 'Telex', description: 'Frais de communication' },
  { id: '4', name: 'Transfert', description: 'Déplacement de charge' }
];

export const INITIAL_RUBRIQUE_CONFIGS: RubriqueConfig[] = [
  // Caution - Conteneur
  { id: '101', invoiceTypeId: '1', category: 'CONTENEUR', name: 'Frais de dossier', description: 'Frais administratifs standards', code: 'FR-DOS', isActive: true, montantUnitaire: 15000, baseCalcul: 'BL' },
  { id: '102', invoiceTypeId: '1', category: 'CONTENEUR', name: 'Garantie Conteneur', description: 'Dépôt de garantie équipement', code: 'GAR-CTR', isActive: true, montantUnitaire: 50000, baseCalcul: 'CONTENEUR' },
  { id: '103', invoiceTypeId: '1', category: 'CONTENEUR', name: 'Manutention', description: 'Frais de grutage/manipulation', code: 'MAN-01', isActive: false, montantUnitaire: 25000, baseCalcul: 'CONTENEUR' },
  { id: '104', invoiceTypeId: '1', category: 'CONTENEUR', name: 'Stockage', description: 'Frais de parc prolongé', code: 'STK-PRC', isActive: false, montantUnitaire: 12000, baseCalcul: 'CONTENEUR' },
  
  // Caution - Vrac
  { id: '105', invoiceTypeId: '1', category: 'VRAC', name: 'Frais de dossier', description: 'Frais administratifs standards', code: 'FR-DOS', isActive: true, montantUnitaire: 15000, baseCalcul: 'BL' },
  { id: '106', invoiceTypeId: '1', category: 'VRAC', name: 'Passe Portuaire', description: 'Accès zone portuaire vrac', code: 'PSC-VRC', isActive: false, montantUnitaire: 5000, baseCalcul: 'POIDS_TONNE' },

  // Caution - Ro-Ro
  { id: '107', invoiceTypeId: '1', category: 'RORO', name: 'Frais de dossier', description: 'Frais administratifs standards', code: 'FR-DOS', isActive: true, montantUnitaire: 15000, baseCalcul: 'BL' },
  { id: '108', invoiceTypeId: '1', category: 'RORO', name: 'Taxe Ro-Ro', description: 'Redevance débarquement véhicule', code: 'TX-RORO', isActive: true, montantUnitaire: 30000, baseCalcul: 'BL' },

  // Caution - Conventionnel
  { id: '109', invoiceTypeId: '1', category: 'CONVENTIONNEL', name: 'Frais de dossier', description: 'Frais administratifs standards', code: 'FR-DOS', isActive: true, montantUnitaire: 15000, baseCalcul: 'BL' },
  { id: '110', invoiceTypeId: '1', category: 'CONVENTIONNEL', name: 'Surcharge Colis Lourd', description: 'Manutention colis exceptionnels', code: 'SCH-LVR', isActive: false, montantUnitaire: 75000, baseCalcul: 'POIDS_TONNE' },

  // Echange - Conteneur
  { id: '201', invoiceTypeId: '2', category: 'CONTENEUR', name: 'Frais d\'échange BL', description: 'Échange physique des documents BL', code: 'ECH-BL', isActive: true, montantUnitaire: 20000, baseCalcul: 'BL' },
  { id: '202', invoiceTypeId: '2', category: 'CONTENEUR', name: 'Frais de dossier', description: 'Frais administratifs standards', code: 'FR-DOS', isActive: true, montantUnitaire: 15000, baseCalcul: 'BL' },

  // Echange - Vrac
  { id: '203', invoiceTypeId: '2', category: 'VRAC', name: 'Frais d\'échange BL', description: 'Échange physique des documents BL', code: 'ECH-BL', isActive: true, montantUnitaire: 20000, baseCalcul: 'BL' },

  // Telex - Conteneur
  { id: '301', invoiceTypeId: '3', category: 'CONTENEUR', name: 'Frais de message Telex', description: 'Frais de libération par télex', code: 'TLX-FEE', isActive: true, montantUnitaire: 25000, baseCalcul: 'BL' },

  // Transfert - Conteneur
  { id: '401', invoiceTypeId: '4', category: 'CONTENEUR', name: 'Frais de transfert parc', description: 'Déplacement de charge vers terminal', code: 'TRF-PRC', isActive: true, montantUnitaire: 35000, baseCalcul: 'CONTENEUR' }
];

