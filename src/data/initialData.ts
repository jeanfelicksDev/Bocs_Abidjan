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
  RubriqueConfig,
  Vessel,
  TimbreBracket
} from '../types';
import { DEFAULT_FRANCHISES, DEFAULT_TARIFS } from '../utils/dmdtCalculator';

export const INITIAL_VESSELS: Vessel[] = [
  { id: 1, nom: 'BOCS BREMEN', callsign: 'IMO 948201', pavillon: 'Liberia', armateur: 'BOCS Line', typeNavire: 'Porte-conteneurs', capaciteTeu: 1800 },
  { id: 2, nom: 'BOCS HAMBURG', callsign: 'IMO 948202', pavillon: 'Liberia', armateur: 'BOCS Line', typeNavire: 'Cargo Polyvalent', capaciteTeu: 1650 },
  { id: 3, nom: 'BOCS VISION', callsign: 'IMO 948203', pavillon: 'Liberia', armateur: 'BOCS Line', typeNavire: 'Porte-conteneurs', capaciteTeu: 2100 },
  { id: 4, nom: 'BOCS SPIRIT', callsign: 'IMO 948204', pavillon: 'Antigua & Barbuda', armateur: 'BOCS Line', typeNavire: 'Ro-Ro / Cargo', capaciteTeu: 1400 },
  { id: 5, nom: 'BOCS ABIDJAN', callsign: 'IMO 948205', pavillon: 'Liberia', armateur: 'BOCS Line', typeNavire: 'Porte-conteneurs', capaciteTeu: 2200 },
  { id: 6, nom: 'BOCS COTONOU', callsign: 'IMO 948206', pavillon: 'Liberia', armateur: 'BOCS Line', typeNavire: 'Cargo Polyvalent', capaciteTeu: 1500 }
];

export const INITIAL_TIMBRE_BRACKETS: TimbreBracket[] = [
  { id: '1', libelle: 'Tranche de base (0 à 500.000 FCFA HT)', montantHtMin: 0, montantHtMax: 500000, montantTimbreFcfa: 100, estActif: true },
  { id: '2', libelle: 'Tranche intermédiaire (500.001 à 2.000.000 FCFA HT)', montantHtMin: 500001, montantHtMax: 2000000, montantTimbreFcfa: 100, estActif: true },
  { id: '3', libelle: 'Tranche supérieure (> 2.000.000 FCFA HT)', montantHtMin: 2000001, montantHtMax: 999999999, montantTimbreFcfa: 500, estActif: true }
];

export const INITIAL_USERS: User[] = [
  { id: 1, nomComplet: 'Jean-Marc KOFFI', email: 'admin@bocs.ci', role: 'ADMIN', telephone: '+225 07 08 09 10 11', nomSociete: 'BOCS CI Agency', estActif: true },
  { id: 2, nomComplet: 'Marie-Claire ADOU', email: 'import@bocs.ci', role: 'AGENT_IMPORT', telephone: '+225 05 06 07 08 09', nomSociete: 'BOCS CI Agency', estActif: true },
  { id: 3, nomComplet: 'Kouassi PATRICE', email: 'export@bocs.ci', role: 'AGENT_EXPORT', telephone: '+225 01 02 03 04 05', nomSociete: 'BOCS CI Agency', estActif: true },
  { id: 4, nomComplet: 'Awa DIABATE', email: 'compta@bocs.ci', role: 'COMPTABILITE', telephone: '+225 07 11 22 33 44', nomSociete: 'BOCS CI Agency', estActif: true },
  { id: 5, nomComplet: 'Moussa TRAORE', email: 'client@agro-export.ci', role: 'CLIENT_EXPORT', telephone: '+225 07 45 67 89 01', nomSociete: 'Agro Export SA', estActif: true },
  { id: 6, nomComplet: 'ZIAGOUE Jean-Félix', email: 'client.sifca@bocs.ci', role: 'CLIENT_EXPORT', telephone: '+225 07 00 11 22 33', nomSociete: 'SIFCA Cacao SA', estActif: true },
  { id: 7, nomComplet: 'Fatoumata KONE', email: 'client.tropica@bocs.ci', role: 'CLIENT_EXPORT', telephone: '+225 05 44 55 66 77', nomSociete: 'Tropica Trading CI', estActif: true }
];

export const INITIAL_ESCALES: Escale[] = [];

export const INITIAL_BLS: BL[] = [];

export const INITIAL_DRAFTS_EXPORT: DraftExport[] = [
];

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
  { id: '4', name: 'Transfert', description: 'Déplacement de charge' },
  { id: '5', name: 'Surestarie', description: 'Frais de stationnement portuaire (Surestaries)' },
  { id: '6', name: 'Détention', description: 'Frais d\'immobilisation conteneur (Détention)' }
];

export const INITIAL_RUBRIQUE_CONFIGS: RubriqueConfig[] = [
  // Caution - Conteneur (La caution ne concerne que le type CONTENEUR)
  { id: '101', invoiceTypeId: '1', category: 'CONTENEUR', name: 'Frais de dossier', description: 'Frais administratifs standards', code: 'FR-DOS', isActive: true, montantUnitaire: 15000, baseCalcul: 'BL' },
  { id: '102', invoiceTypeId: '1', category: 'CONTENEUR', name: 'Garantie Conteneur', description: 'Dépôt de garantie équipement', code: 'GAR-CTR', isActive: true, montantUnitaire: 50000, baseCalcul: 'CONTENEUR' },
  { id: '103', invoiceTypeId: '1', category: 'CONTENEUR', name: 'Manutention', description: 'Frais de grutage/manipulation', code: 'MAN-01', isActive: false, montantUnitaire: 25000, baseCalcul: 'CONTENEUR' },
  { id: '104', invoiceTypeId: '1', category: 'CONTENEUR', name: 'Stockage', description: 'Frais de parc prolongé', code: 'STK-PRC', isActive: false, montantUnitaire: 12000, baseCalcul: 'CONTENEUR' },

  // Echange - Conteneur COC
  { id: '201', invoiceTypeId: '2', category: 'CONTENEUR_COC', name: 'Frais de dossier (Echange B/L)', description: 'Frais administratifs standards', code: 'FR-DOS', isActive: true, montantUnitaire: 50000, baseCalcul: 'BL' },
  { id: '202', invoiceTypeId: '2', category: 'CONTENEUR_COC', name: 'Frais d\'échange BL (COC)', description: 'Échange physique conteneur armement', code: 'ECH-COC', isActive: true, montantUnitaire: 20000, baseCalcul: 'BL' },
  { id: '203', invoiceTypeId: '2', category: 'CONTENEUR_COC', name: 'ISPS on TC- Terminal security', description: 'Taxe de sécurité terminal ISPS', code: 'ISPS', isActive: true, montantUnitaire: 14431, baseCalcul: 'TEU' },

  // Echange - Conteneur SOC (Pas de frais d'échange pour conteneurs SOC)
  { id: '204', invoiceTypeId: '2', category: 'CONTENEUR_SOC', name: 'Frais de dossier (Echange B/L)', description: 'Frais administratifs standards', code: 'FR-DOS', isActive: true, montantUnitaire: 50000, baseCalcul: 'BL' },
  { id: '206', invoiceTypeId: '2', category: 'CONTENEUR_SOC', name: 'ISPS on TC- Terminal security', description: 'Taxe de sécurité terminal ISPS', code: 'ISPS', isActive: true, montantUnitaire: 14431, baseCalcul: 'TEU' },

  // Echange - Vrac
  { id: '207', invoiceTypeId: '2', category: 'VRAC', name: 'Frais d\'échange BL', description: 'Échange physique des documents BL', code: 'ECH-BL', isActive: true, montantUnitaire: 20000, baseCalcul: 'BL' },
  // Echange - RORO
  { id: '208', invoiceTypeId: '2', category: 'RORO', name: 'Frais d\'échange BL (RORO)', description: 'Échange physique des documents BL RORO', code: 'ECH-RORO', isActive: true, montantUnitaire: 20000, baseCalcul: 'BL' },
  // Echange - Conventionnel
  { id: '209', invoiceTypeId: '2', category: 'CONVENTIONNEL', name: 'Frais d\'échange BL (Conventionnel)', description: 'Échange physique des documents BL Conventionnel', code: 'ECH-CONV', isActive: true, montantUnitaire: 20000, baseCalcul: 'BL' },

  // Telex - Tous types de marchandises (Conteneur, Vrac, RORO, Conventionnel)
  { id: '301', invoiceTypeId: '3', category: 'CONTENEUR', name: 'Frais de message Telex', description: 'Frais de libération par télex', code: 'TLX-FEE', isActive: true, montantUnitaire: 25000, baseCalcul: 'BL' },
  { id: '302', invoiceTypeId: '3', category: 'VRAC', name: 'Frais de message Telex', description: 'Frais de libération par télex', code: 'TLX-FEE', isActive: true, montantUnitaire: 25000, baseCalcul: 'BL' },
  { id: '303', invoiceTypeId: '3', category: 'RORO', name: 'Frais de message Telex', description: 'Frais de libération par télex', code: 'TLX-FEE', isActive: true, montantUnitaire: 25000, baseCalcul: 'BL' },
  { id: '304', invoiceTypeId: '3', category: 'CONVENTIONNEL', name: 'Frais de message Telex', description: 'Frais de libération par télex', code: 'TLX-FEE', isActive: true, montantUnitaire: 25000, baseCalcul: 'BL' },

  // Transfert - Conteneur
  { id: '401', invoiceTypeId: '4', category: 'CONTENEUR', name: 'Frais de transfert parc', description: 'Déplacement de charge vers terminal', code: 'TRF-PRC', isActive: true, montantUnitaire: 35000, baseCalcul: 'CONTENEUR' },

  // Surestarie - Conteneur (barème dégressif DMDT)
  { id: '501', invoiceTypeId: '5', category: 'CONTENEUR', name: 'Surestaries portuaires', description: 'Dépassement franchise séjour au parc portuaire', code: 'DMDT_SURESTARIE', isActive: true, montantUnitaire: 0, baseCalcul: 'CONTENEUR' },

  // Détention - Conteneur (barème dégressif DMDT)
  { id: '601', invoiceTypeId: '6', category: 'CONTENEUR', name: 'Frais de détention', description: 'Dépassement franchise équipement hors terminal', code: 'DMDT_DETENTION', isActive: true, montantUnitaire: 0, baseCalcul: 'CONTENEUR' }
];

