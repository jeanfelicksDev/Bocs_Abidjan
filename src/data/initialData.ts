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
  { id: 5, nomComplet: 'Moussa TRAORE', email: 'client@agro-export.ci', role: 'CLIENT_EXPORT', telephone: '+225 07 45 67 89 01', nomSociete: 'Agro Export SA', estActif: true },
  { id: 6, nomComplet: 'ZIAGOUE Jean-Félix', email: 'client.sifca@bocs.ci', role: 'CLIENT_EXPORT', telephone: '+225 07 00 11 22 33', nomSociete: 'SIFCA Cacao SA', estActif: true },
  { id: 7, nomComplet: 'Fatoumata KONE', email: 'client.tropica@bocs.ci', role: 'CLIENT_EXPORT', telephone: '+225 05 44 55 66 77', nomSociete: 'Tropica Trading CI', estActif: true }
];

export const INITIAL_ESCALES: Escale[] = [];

export const INITIAL_BLS: BL[] = [];

export const INITIAL_DRAFTS_EXPORT: DraftExport[] = [
  {
    id: 101,
    clientId: 5,
    clientNom: 'Moussa TRAORE',
    clientSociete: 'Agro Export SA',
    clientEmail: 'client@agro-export.ci',
    escaleId: 25586,
    numeroDraft: 'BOCS-EXP-DRF-9021',
    bookingRef: 'BKG-ABJ-2026-088',
    navireNom: 'BOCS BREMEN',
    numeroVoyage: '25586',
    portChargementCode: 'CIABJ',
    portDechargementCode: 'BEANR',
    portDechargementNom: 'Anvers (Antwerp)',
    shipperInfo: {
      nom: 'Agro Export SA',
      adresse: 'Zone Industrielle Vridi, 01 BP 128 Abidjan',
      pays: 'Côte d\'Ivoire',
      email: 'logistique@agro-export.ci',
      phone: '+225 27 21 35 44 00'
    },
    consigneeInfo: {
      nom: 'Chocolaterie Belge De Gand NV',
      adresse: 'Havenlaan 42, 9000 Gent',
      pays: 'Belgique',
      email: 'import@chocogand.be',
      phone: '+32 9 234 56 78'
    },
    notifyInfo: {
      nom: 'Antwerp Maritime Logistics SA',
      adresse: 'Kaai 174, 2030 Antwerpen',
      pays: 'Belgique',
      email: 'ops@amlogistics.be',
      phone: '+32 3 555 12 34'
    },
    marchandisesInfo: {
      description: 'FEVES DE CACAO DE COTE D\'IVOIRE EN SACS JUTE - GRADE I - RECOLTE 2025/2026 - CONTRAT N° CI-BE-994',
      poidsBrutKg: 50400,
      volumeM3: 68.5,
      nombreColis: 800,
      typeEmballage: 'SACS JUTE',
      hsCode: '1801.00.00'
    },
    conteneursInfo: [
      {
        numeroConteneur: 'BOCU-452109-1',
        typeConteneur: '20_DRY',
        numeroScelle: 'SC-CI-9981',
        poidsKg: 25200,
        poidsNetKg: 23000,
        volumeM3: 34.2,
        tareKg: 2200,
        nombreColis: 400
      },
      {
        numeroConteneur: 'BOCU-452110-5',
        typeConteneur: '20_DRY',
        numeroScelle: 'SC-CI-9982',
        poidsKg: 25200,
        poidsNetKg: 23000,
        volumeM3: 34.3,
        tareKg: 2200,
        nombreColis: 400
      }
    ],
    statut: 'VALIDE',
    numeroBlGenere: 'BOCS-EXP-25586-001',
    dateCreation: '2026-04-10',
    dateValidation: '2026-04-12 14:30:00'
  },
  {
    id: 102,
    clientId: 5,
    clientNom: 'Moussa TRAORE',
    clientSociete: 'Agro Export SA',
    clientEmail: 'client@agro-export.ci',
    escaleId: 25586,
    numeroDraft: 'BOCS-EXP-DRF-9022',
    bookingRef: 'BKG-ABJ-2026-092',
    navireNom: 'BOCS BREMEN',
    numeroVoyage: '25586',
    portChargementCode: 'CIABJ',
    portDechargementCode: 'FRROU',
    portDechargementNom: 'Rouen Grand-Couronne',
    shipperInfo: {
      nom: 'Agro Export SA',
      adresse: 'Zone Industrielle Vridi, 01 BP 128 Abidjan',
      pays: 'Côte d\'Ivoire',
      email: 'logistique@agro-export.ci',
      phone: '+225 27 21 35 44 00'
    },
    consigneeInfo: {
      nom: 'SOCIETE NORMANDE DE NEGOCE AGRO',
      adresse: 'Quai de Rouen Sud, 76100 Rouen',
      pays: 'France',
      email: 'contact@normande-negoce.fr',
      phone: '+33 2 35 70 80 90'
    },
    notifyInfo: {
      nom: 'TRANSIT & CONSIGNATION DE LA SEINE',
      adresse: 'Boulevard Maritime, 76600 Le Havre',
      pays: 'France',
      email: 'doc@tcs-seine.fr',
      phone: '+33 2 35 19 00 00'
    },
    marchandisesInfo: {
      description: 'NOIX DE CAJOU BRUTES DE COTE D\'IVOIRE (RAW CASHEW NUTS) - EN SACS - KOR 48 LBS',
      poidsBrutKg: 26000,
      volumeM3: 38.0,
      nombreColis: 325,
      typeEmballage: 'SACS JUTE',
      hsCode: '0801.31.00'
    },
    conteneursInfo: [
      {
        numeroConteneur: 'BOCU-887412-3',
        typeConteneur: '40_DRY',
        numeroScelle: 'SC-CI-4410',
        poidsKg: 26000,
        poidsNetKg: 22200,
        volumeM3: 38.0,
        tareKg: 3800,
        nombreColis: 325
      }
    ],
    statut: 'VERROUILLE',
    dateCreation: '2026-04-05'
  },
  {
    id: 103,
    clientId: 5,
    clientNom: 'Moussa TRAORE',
    clientSociete: 'Agro Export SA',
    clientEmail: 'client@agro-export.ci',
    escaleId: 25586,
    numeroDraft: 'BOCS-EXP-DRF-9023',
    bookingRef: 'BKG-ABJ-2026-095',
    navireNom: 'BOCS BREMEN',
    numeroVoyage: '25586',
    portChargementCode: 'CIABJ',
    portDechargementCode: 'DEBRE',
    portDechargementNom: 'Bremen Overseas Terminal',
    shipperInfo: {
      nom: 'Agro Export SA',
      adresse: 'Zone Industrielle Vridi, 01 BP 128 Abidjan',
      pays: 'Côte d\'Ivoire',
      email: 'logistique@agro-export.ci',
      phone: '+225 27 21 35 44 00'
    },
    consigneeInfo: {
      nom: 'BREMEN COFFEE & COCOA TRADING GMBH',
      adresse: 'Überseetor 15, 28217 Bremen',
      pays: 'Allemagne',
      email: 'trading@bremencoffee.de',
      phone: '+49 421 3890 0'
    },
    notifyInfo: {
      nom: 'BREMEN COFFEE & COCOA TRADING GMBH',
      adresse: 'Überseetor 15, 28217 Bremen',
      pays: 'Allemagne',
      email: 'trading@bremencoffee.de',
      phone: '+49 421 3890 0'
    },
    marchandisesInfo: {
      description: 'CAFE ROBUSTA VERT DE COTE D\'IVOIRE GRADE 2 - SACS DE 60 KG NETS',
      poidsBrutKg: 21600,
      volumeM3: 32.4,
      nombreColis: 360,
      typeEmballage: 'SACS JUTE',
      hsCode: '0901.11.00'
    },
    conteneursInfo: [
      {
        numeroConteneur: 'BOCU-332190-8',
        typeConteneur: '20_DRY',
        numeroScelle: 'SC-CI-1209',
        poidsKg: 21600,
        poidsNetKg: 19400,
        volumeM3: 32.4,
        tareKg: 2200,
        nombreColis: 360
      }
    ],
    statut: 'DEMANDE_CORRECTION',
    demandeCorrection: {
      motif: 'Changement de consignataire suite à cession de cargaison en mer (Bremen Coffee GmbH remplace Hamburg Commodities). Rectification du poids net suite à pesée officielle VGM terminal.',
      dateDemande: '2026-04-11 11:25:00',
      fraisAcceptes: true,
      montantFrais: 50000,
      statut: 'EN_ATTENTE'
    },
    dateCreation: '2026-04-06'
  },
  {
    id: 104,
    clientId: 6,
    clientNom: 'ZIAGOUE Jean-Félix',
    clientSociete: 'SIFCA Cacao SA',
    clientEmail: 'client.sifca@bocs.ci',
    escaleId: 25586,
    numeroDraft: 'BOCS-EXP-DRF-7837',
    bookingRef: 'BKG-ABJ-23409-793',
    navireNom: 'EA CENTAURUS',
    numeroVoyage: '23409',
    portChargementCode: 'CIABJ',
    portDechargementCode: 'CIVID',
    portDechargementNom: 'Côte d\'Ivoire',
    shipperInfo: {
      nom: 'SIFCA Cacao SA',
      adresse: 'Zone Industrielle Vridi, Abidjan',
      pays: 'Côte d\'Ivoire',
      email: 'contact@sifca.ci',
      phone: '+225 27 21 00 11 22'
    },
    consigneeInfo: {
      nom: 'ZIAGOUE Jean-Félix',
      adresse: 'Zone Portuaire, Abidjan',
      pays: 'Côte d\'Ivoire',
      email: 'jf.ziagoue@sifca.ci',
      phone: '+225 07 00 11 22 33'
    },
    notifyInfo: {
      nom: 'ZIAGOUE Jean-Félix',
      adresse: 'Zone Portuaire, Abidjan',
      pays: 'Côte d\'Ivoire',
      email: 'jf.ziagoue@sifca.ci',
      phone: '+225 07 00 11 22 33'
    },
    marchandisesInfo: {
      description: 'FEVES DE CACAO EN CARTONS - RECOLTE 2026',
      poidsBrutKg: 50400,
      volumeM3: 68.5,
      nombreColis: 800,
      typeEmballage: 'CARTONS',
      hsCode: '1801.00.00'
    },
    conteneursInfo: [
      {
        numeroConteneur: 'BOCU-994120-1',
        typeConteneur: '20_DRY',
        numeroScelle: 'SC-CI-7711',
        poidsKg: 25200,
        poidsNetKg: 23000,
        volumeM3: 34.2,
        tareKg: 2200,
        nombreColis: 400
      },
      {
        numeroConteneur: 'BOCU-994121-6',
        typeConteneur: '20_DRY',
        numeroScelle: 'SC-CI-7712',
        poidsKg: 25200,
        poidsNetKg: 23000,
        volumeM3: 34.3,
        tareKg: 2200,
        nombreColis: 400
      }
    ],
    statut: 'CORRECTION_AUTORISEE',
    estDeverrouille: true,
    dateCreation: '2026-04-12'
  },
  {
    id: 105,
    clientId: 7,
    clientNom: 'Fatoumata KONE',
    clientSociete: 'Tropica Trading CI',
    clientEmail: 'client.tropica@bocs.ci',
    escaleId: 25586,
    numeroDraft: 'BOCS-EXP-DRF-5412',
    bookingRef: 'BKG-ABJ-23409-541',
    navireNom: 'EA CENTAURUS',
    numeroVoyage: '23409',
    portChargementCode: 'CIABJ',
    portDechargementCode: 'DEBRE',
    portDechargementNom: 'Bremen',
    shipperInfo: {
      nom: 'Tropica Trading CI',
      adresse: 'Boulevard de Marseille, Abidjan',
      pays: 'Côte d\'Ivoire',
      email: 'ops@tropicatrading.ci',
      phone: '+225 27 21 44 55 66'
    },
    consigneeInfo: {
      nom: 'Tropica Europe GmbH',
      adresse: 'Hafenstrasse 12, Bremen',
      pays: 'Allemagne',
      email: 'import@tropica.de',
      phone: '+49 421 88990'
    },
    notifyInfo: {
      nom: 'Tropica Europe GmbH',
      adresse: 'Hafenstrasse 12, Bremen',
      pays: 'Allemagne',
      email: 'import@tropica.de',
      phone: '+49 421 88990'
    },
    marchandisesInfo: {
      description: 'BEURRE DE CACAO BIOLOGIQUE EN CARTONS',
      poidsBrutKg: 24000,
      volumeM3: 35.0,
      nombreColis: 600,
      typeEmballage: 'CARTONS',
      hsCode: '1804.00.00'
    },
    conteneursInfo: [
      {
        numeroConteneur: 'BOCU-112044-8',
        typeConteneur: '20_DRY',
        numeroScelle: 'SC-CI-3344',
        poidsKg: 24000,
        poidsNetKg: 21800,
        volumeM3: 35.0,
        tareKg: 2200,
        nombreColis: 600
      }
    ],
    statut: 'BROUILLON',
    dateCreation: '2026-04-14'
  }
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

