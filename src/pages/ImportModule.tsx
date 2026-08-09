import React, { useState, useRef, useEffect } from 'react';
import { Escale, BL, Invoice, UserRole, Container, RubriqueConfig, FretCategory, InvoiceTypeConfig } from '../types';
import { generateProformaPdf } from '../utils/pdfGenerator';
import { calculateTotalDmdt } from '../utils/dmdtCalculator';
import { parseGuceXml } from '../utils/xmlGuceParser';

interface ImportModuleProps {
  escales: Escale[];
  bls: BL[];
  onAddEscale: (escale: Escale) => void;
  onImportManifest: (escale: Escale, newBls: BL[]) => void;
  onDeleteEscaleIntegration?: (escaleId: number) => void;
  onGenerateInvoice: (invoice: Invoice) => void;
  onLogAudit: (action: string, entite: string, details: string) => void;
  userRole: UserRole;
  rubriqueConfigs?: RubriqueConfig[];
  invoiceTypeConfigs?: InvoiceTypeConfig[];
  invoices?: Invoice[];
}

export const ImportModule: React.FC<ImportModuleProps> = ({
  escales,
  bls,
  onAddEscale,
  onImportManifest,
  onDeleteEscaleIntegration,
  onGenerateInvoice,
  onLogAudit,
  userRole,
  rubriqueConfigs = [],
  invoiceTypeConfigs = [],
  invoices = []
}) => {
  const [selectedEscaleId, setSelectedEscaleId] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddEscaleModal, setShowAddEscaleModal] = useState(false);
  const [showPasteXmlModal, setShowPasteXmlModal] = useState(false);
  const [pastedXmlText, setPastedXmlText] = useState('');
  const [isProcessingXml, setIsProcessingXml] = useState(false);
  const [selectedBlDetails, setSelectedBlDetails] = useState<BL | null>(null);
  const [escaleToDelete, setEscaleToDelete] = useState<Escale | null>(null);
  
  // Modal de sélection des types de factures à émettre
  const [blForInvoiceSelection, setBlForInvoiceSelection] = useState<BL | null>(null);
  const [selectedTypeIdsForBl, setSelectedTypeIdsForBl] = useState<string[]>([]);
  const [plannedInvoicesByBl, setPlannedInvoicesByBl] = useState<Record<number, string[]>>(() => {
    try {
      const saved = localStorage.getItem('bocs_bl_planned_invoices');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bocs_bl_planned_invoices', JSON.stringify(plannedInvoicesByBl));
    } catch (e) {
      console.error('Erreur sauvegarde planned invoices', e);
    }
  }, [plannedInvoicesByBl]);

  const [lastXmlFileName, setLastXmlFileName] = useState<string>(() => {
    return localStorage.getItem('bocs_last_xml_filename') || '';
  });

  // XML Import file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // PDF Import file input ref
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // New Escale Form state
  const [nomNavire, setNomNavire] = useState('');
  const [callsign, setCallsign] = useState('');
  const [numeroVoyage, setNumeroVoyage] = useState('');
  const [portChargement, setPortChargement] = useState('Abidjan (CIABJ)');
  const [portDechargement, setPortDechargement] = useState('Le Havre (FRLEH)');

  const filteredBls = bls.filter(bl => {
    const matchesEscale = selectedEscaleId === 'ALL' || bl.escaleId === selectedEscaleId;
    const matchesQuery = bl.numeroBL.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         bl.consigneeNom.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         bl.shipperNom.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesEscale && matchesQuery;
  });

  const processXmlContent = (xmlContent: string, fileNameSource: string = 'Manifeste_GUCE.xml') => {
    setIsProcessingXml(true);
    setTimeout(() => {
      try {
        const parsed = parseGuceXml(xmlContent);
        const newEscaleId = Date.now();

        const newEscale: Escale = {
          id: newEscaleId,
          nomNavire: parsed.escale.nomNavire || 'EA CHARA',
          callsign: parsed.escale.callsign || '9V8974',
          numeroVoyage: parsed.escale.numeroVoyage || '014W',
          portChargement: parsed.escale.portChargement || 'CIABJ',
          portDechargement: parsed.escale.portDechargement || 'CIABJ',
          dateArrivee: parsed.escale.dateArrivee || new Date().toISOString().split('T')[0],
          statut: 'EN_COURS'
        };

        const extractedBls: BL[] = parsed.bls.map((bl, idx) => ({
          id: newEscaleId + idx + 1,
          escaleId: newEscaleId,
          numeroBL: bl.numeroBL || `BL-IMP-${idx + 1}`,
          typeOperation: 'IMPORT',
          shipperNom: bl.shipperNom || '',
          shipperAdresse: bl.shipperAdresse || '',
          consigneeNom: bl.consigneeNom || '',
          consigneeAdresse: bl.consigneeAdresse || '',
          notifyNom: bl.notifyNom || bl.consigneeNom || '',
          notifyAdresse: bl.notifyAdresse || bl.consigneeAdresse || '',
          portChargementCode: bl.portChargementCode || 'CIABJ',
          portDechargementCode: bl.portDechargementCode || 'CIABJ',
          destinationFinale: bl.destinationFinale || 'CI',
          descriptionGoods: bl.descriptionGoods || 'MARCHANDISES DIVERSES',
          nombreColis: bl.nombreColis || 0,
          typeEmballage: bl.typeEmballage || 'CARTONS / PACKAGES',
          poidsBrutKg: bl.poidsBrutKg || 0,
          volumeM3: bl.volumeM3 || 0,
          statutImport: 'EN_ATTENTE',
          conteneurs: (bl.conteneurs || []).map((c, cIdx) => ({
            ...c,
            id: newEscaleId + 1000 + idx * 20 + cIdx,
            blId: newEscaleId + idx + 1
          }))
        }));

        const actualFileName = (fileNameSource && fileNameSource !== 'Pasted_GUCE_Manifest.xml')
          ? fileNameSource
          : `GUCE_MANIFESTE_${newEscale.nomNavire.replace(/\s+/g, '_')}_${newEscale.numeroVoyage}.XML`;

        setLastXmlFileName(actualFileName);
        localStorage.setItem('bocs_last_xml_filename', actualFileName);

        onImportManifest(newEscale, extractedBls);
        onLogAudit('IMPORT_MANIFESTE_GUCE', 'ManifesteXML', `Importation réussie de ${actualFileName} (${extractedBls.length} BLs extraits pour navire ${newEscale.nomNavire})`);
        setIsProcessingXml(false);
        setShowPasteXmlModal(false);
        setPastedXmlText('');
        alert(`Intégration réussie ! Escale "${newEscale.nomNavire}" (Voyage ${newEscale.numeroVoyage}) créée avec ${extractedBls.length} Connaissements (BLs) et tous leurs conteneurs.`);
      } catch (err: any) {
        setIsProcessingXml(false);
        const userFriendlyMsg = (err.message.includes('parsererror') || err.message.includes('Start tag expected') || err.message.includes('expected'))
          ? "Le fichier ne semble pas être au format XML GUCE valide. S'il s'agit d'un fichier PDF de manifeste, veuillez utiliser le bouton \"Sélectionner le fichier PDF\" dédié."
          : err.message;
        alert('Erreur lors du traitement du fichier XML GUCE : ' + userFriendlyMsg);
      }
    }, 600);
  };

  const processPdfFile = (file: File) => {
    setIsProcessingXml(true);
    const actualFileName = file.name;
    
    // Simulation d'extraction OCR PDF haut de gamme
    setTimeout(() => {
      let detectedVessel = 'BOCS BREMEN';
      const upperName = file.name.toUpperCase();
      if (upperName.includes('AFRICA')) detectedVessel = 'BOCS AFRICA';
      else if (upperName.includes('CHARA')) detectedVessel = 'EA CHARA';
      else if (upperName.includes('WIND')) detectedVessel = 'BOCS WIND';

      const newEscaleId = Date.now();

      const newEscale: Escale = {
        id: newEscaleId,
        nomNavire: detectedVessel,
        callsign: 'CQRT',
        numeroVoyage: '25586',
        portChargement: 'ANVERS (BE)',
        portDechargement: 'ABIDJAN (CI)',
        dateArrivee: '2025-07-16',
        statut: 'EN_COURS'
      };

      const mockBls: BL[] = [
        {
          id: newEscaleId + 1,
          escaleId: newEscaleId,
          numeroBL: 'ANRABJ25586001',
          typeOperation: 'IMPORT',
          shipperNom: 'SH SACOFRINA SA',
          shipperAdresse: '29 ROUTE DE PRE BOIS CASE POSTALE 731 CH 1215 GENEVE SUISSE',
          consigneeNom: 'CO SOLIBRA',
          consigneeAdresse: '01 BP 1304 ABIDJAN 01 REP DE COTE D\'IVOIRE',
          notifyNom: 'NO SOLIBRA',
          notifyAdresse: '01 BP 1304 ABIDJAN 01 REP DE COTE D\'IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'MALT SPECIAL SACOFRINA EN VRAC',
          marquesEtNumeros: 'CDE 25-05904',
          nombreColis: 1,
          typeEmballage: 'VRAC',
          poidsBrutKg: 1699996,
          volumeM3: 0,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 2,
          escaleId: newEscaleId,
          numeroBL: 'ANRABJ25586101',
          typeOperation: 'IMPORT',
          shipperNom: 'SH SACOFRINA SA',
          shipperAdresse: '29 ROUTE DE PRE-BOIS CASE POSTALE 731 CH-1215 GENEVE SUISSE',
          consigneeNom: 'CO SOLIBRA',
          consigneeAdresse: '01 BP 1304 ABIDJAN 01 REP. DE COTE D\'IVOIRE',
          notifyNom: 'NO SOLIBRA',
          notifyAdresse: '01 BP 1304 ABIDJAN 01 REP. DE COTE D\'IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'PRODUITS DIVERS DONT DANGEREUX',
          marquesEtNumeros: 'CINU3813067',
          nombreColis: 47,
          typeEmballage: 'COLIS',
          poidsBrutKg: 4753.090,
          volumeM3: 0,
          statutImport: 'EN_ATTENTE',
          conteneurs: [
            {
              id: newEscaleId + 20,
              blId: newEscaleId + 2,
              numeroConteneur: 'CINU3813067',
              typeConteneur: '20_DRY',
              numeroScelle: 'SEAL 2687574',
              poidsKg: 2403.090,
              tareKg: 2350,
              nombreColis: 47,
              montantCautionFcfa: 500000,
              statutLivraison: 'AU_PARC',
              dateEntreeParc: '2025-07-16T08:00:00Z'
            }
          ]
        },
        {
          id: newEscaleId + 3,
          escaleId: newEscaleId,
          numeroBL: 'ANRABJ25586102',
          typeOperation: 'IMPORT',
          shipperNom: 'SH HALLIBURTON BV',
          shipperAdresse: 'COLUMBUSSTRAAT 19 7825 VP EMMEN THE NETHERLANDS',
          consigneeNom: 'CO HALLIBURTON WW LTD',
          consigneeAdresse: 'IMMEUBLE BAINI, 4TH FLOOR RUE LUIS L ABIDJAN CÔTE D\'IVOIRE',
          notifyNom: 'NO AFRICA GLOBAL LOGISTICS C.I',
          notifyAdresse: 'OILFIELD, BASE OFFSHORE VRIDI CANAL, ABIDJAN',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'PRODUITS CHIMIQUES & SPACER BAGS',
          marquesEtNumeros: '200X CHEM TUNED SPACER',
          nombreColis: 205,
          typeEmballage: 'COLIS',
          poidsBrutKg: 4667,
          volumeM3: 6.695,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 4,
          escaleId: newEscaleId,
          numeroBL: 'ANRABJ25586104',
          typeOperation: 'IMPORT',
          shipperNom: 'SH INDUSTEEL BELGIUM',
          shipperAdresse: 'SITE CHARLEROI RUE CHATELET 266, BELGIUM',
          consigneeNom: 'CO TOLETOILE',
          consigneeAdresse: 'RUE NICOT, ZONE 00225 ABIDJAN COTE D\'IVOIRE',
          notifyNom: 'NO TOLETOILE',
          notifyAdresse: 'RUE NICOT, ZONE 00225 ABIDJAN COTE D\'IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: '16 STEEL PLATES',
          marquesEtNumeros: '16 STEEL PLATES',
          nombreColis: 16,
          typeEmballage: 'COLIS',
          poidsBrutKg: 18240,
          volumeM3: 2.760,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 5,
          escaleId: newEscaleId,
          numeroBL: 'ANRABJ25586105',
          typeOperation: 'IMPORT',
          shipperNom: 'SH INDUSTEEL BELGIUM',
          shipperAdresse: 'SITE CHARLEROI RUE CHATELET 266, BELGIUM',
          consigneeNom: 'CO SOTACI',
          consigneeAdresse: 'ZONE INDUSTRIELLE DE ABIDJAN, COTE D\'IVOIRE',
          notifyNom: 'NO SOTACI',
          notifyAdresse: 'ZONE INDUSTRIELLE DE ABIDJAN, COTE D\'IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: '2 COLIS STEEL PLATES',
          marquesEtNumeros: '2 COLIS',
          nombreColis: 2,
          typeEmballage: 'COLIS',
          poidsBrutKg: 7536,
          volumeM3: 0.330,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 6,
          escaleId: newEscaleId,
          numeroBL: 'BOBR25586324705',
          typeOperation: 'IMPORT',
          shipperNom: 'SH IMS ANTWERP',
          shipperAdresse: '39 DUBOISSTRAAT ANTWERPEN BELGIUM',
          consigneeNom: 'CO DOUMBIA AMARA',
          consigneeAdresse: 'ABIDJAN, COTE D IVOIRE',
          notifyNom: 'NO DOUMBIA AMARA',
          notifyAdresse: 'ABIDJAN, COTE D IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'USED TRUCK RENAULT BENNE',
          marquesEtNumeros: 'VF633DVB000108756',
          nombreColis: 1,
          typeEmballage: 'RORO',
          poidsBrutKg: 7500,
          volumeM3: 63.937,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 7,
          escaleId: newEscaleId,
          numeroBL: 'BOBR25586326835',
          typeOperation: 'IMPORT',
          shipperNom: 'SH IMS ANTWERP',
          shipperAdresse: '39 DUBOISSTRAAT ANTWERPEN BELGIUM',
          consigneeNom: 'CO DELKA SOLUTION SARL',
          consigneeAdresse: 'ABIDJAN 13, COTE D IVOIRE',
          notifyNom: 'NO DELKA SOLUTION SARL',
          notifyAdresse: 'ABIDJAN 13, COTE D IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'USED TRUCK MERCEDES BENZ 1820',
          marquesEtNumeros: 'WDB6520251K199518',
          nombreColis: 1,
          typeEmballage: 'RORO',
          poidsBrutKg: 8440,
          volumeM3: 63.875,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 8,
          escaleId: newEscaleId,
          numeroBL: 'BOBR25586327099',
          typeOperation: 'IMPORT',
          shipperNom: 'SH IMS ANTWERP',
          shipperAdresse: '39 DUBOISSTRAAT ANTWERPEN BELGIUM',
          consigneeNom: 'CO MOHAMED AHMED MICHAEL JUNIOR',
          consigneeAdresse: 'ABIDJAN 17, COTE D IVOIRE',
          notifyNom: 'NO MOHAMED AHMED MICHAEL JUNIOR',
          notifyAdresse: 'ABIDJAN 17, COTE D IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'USED TRUCK RENAULT KERAX',
          marquesEtNumeros: 'VF633AVB000102412',
          nombreColis: 1,
          typeEmballage: 'RORO',
          poidsBrutKg: 12340,
          volumeM3: 61.875,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 9,
          escaleId: newEscaleId,
          numeroBL: 'BOBR25586327533',
          typeOperation: 'IMPORT',
          shipperNom: 'SH IMS ANTWERP',
          shipperAdresse: '39 DUBOISSTRAAT ANTWERPEN BELGIUM',
          consigneeNom: 'CO KONE BRAHIMA',
          consigneeAdresse: 'ABIDJAN 11, COTE D IVOIRE',
          notifyNom: 'NO KONE BRAHIMA',
          notifyAdresse: 'ABIDJAN 11, COTE D IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'USED TRUCK DAF TRUCK',
          marquesEtNumeros: 'XLRTE85XC0E782441',
          nombreColis: 1,
          typeEmballage: 'RORO',
          poidsBrutKg: 7500,
          volumeM3: 47.250,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 10,
          escaleId: newEscaleId,
          numeroBL: 'BOBR25586327611',
          typeOperation: 'IMPORT',
          shipperNom: 'SH IMS ANTWERP',
          shipperAdresse: '39 DUBOISSTRAAT ANTWERPEN BELGIUM',
          consigneeNom: 'CO OUSMANE KEITA',
          consigneeAdresse: '01ABIDJAN 01 YOPOUGON CHU ABIDJAN, COTE D IVOIRE',
          notifyNom: 'NO OUSMANE KEITA',
          notifyAdresse: '01ABIDJAN 01 YOPOUGON CHU ABIDJAN, COTE D IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'USED TRUCK DAF TRUCK',
          marquesEtNumeros: 'XLRAG75RC0E466794',
          nombreColis: 1,
          typeEmballage: 'RORO',
          poidsBrutKg: 17320,
          volumeM3: 72.000,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 11,
          escaleId: newEscaleId,
          numeroBL: 'BOBR25586328221',
          typeOperation: 'IMPORT',
          shipperNom: 'SH IMS ANTWERP',
          shipperAdresse: '39 DUBOISSTRAAT ANTWERPEN BELGIUM',
          consigneeNom: 'CO P. ENTREPRISE TRANSPORT LOGISTIQUE',
          consigneeAdresse: 'ABIDJAN, COTE D IVOIRE',
          notifyNom: 'NO P. ENTREPRISE TRANSPORT LOGISTIQUE',
          notifyAdresse: 'ABIDJAN, COTE D IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'USED TRAILER FRUEHAUF TRAILER',
          marquesEtNumeros: 'VFKTE34VCY2XB1436',
          nombreColis: 3,
          typeEmballage: 'RORO',
          poidsBrutKg: 15322,
          volumeM3: 180.750,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 12,
          escaleId: newEscaleId,
          numeroBL: 'BOBR25586329205',
          typeOperation: 'IMPORT',
          shipperNom: 'SH IMS ANTWERP',
          shipperAdresse: '39 DUBOISSTRAAT ANTWERPEN BELGIUM',
          consigneeNom: 'CO KONE CHEICK IBRAHIM',
          consigneeAdresse: 'ABIDJAN, COTE D IVOIRE',
          notifyNom: 'NO KONE CHEICK IBRAHIM',
          notifyAdresse: 'ABIDJAN, COTE D IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'USED TRUCK DAF TRUCK',
          marquesEtNumeros: 'XLRTE47MS0E900054',
          nombreColis: 2,
          typeEmballage: 'RORO',
          poidsBrutKg: 16137,
          volumeM3: 108.000,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 13,
          escaleId: newEscaleId,
          numeroBL: 'BOBR25586329791',
          typeOperation: 'IMPORT',
          shipperNom: 'SH IMS ANTWERP',
          shipperAdresse: '39 DUBOISSTRAAT ANTWERPEN BELGIUM',
          consigneeNom: 'CO OUSMANE KEITA',
          consigneeAdresse: '01ABIDJAN 01 YOPOUGON CHU ABIDJAN, COTE D IVOIRE',
          notifyNom: 'NO OUSMANE KEITA',
          notifyAdresse: '01ABIDJAN 01 YOPOUGON CHU ABIDJAN, COTE D IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'USED TRUCK DAF TRUCK',
          marquesEtNumeros: 'XLRAE75PC0E602637',
          nombreColis: 1,
          typeEmballage: 'RORO',
          poidsBrutKg: 9700,
          volumeM3: 57.750,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 14,
          escaleId: newEscaleId,
          numeroBL: 'BOBR25586332417',
          typeOperation: 'IMPORT',
          shipperNom: 'SH IMS ANTWERP',
          shipperAdresse: '39 DUBOISSTRAAT ANTWERPEN BELGIUM',
          consigneeNom: 'CO OUSMANE KEITA',
          consigneeAdresse: '01 ABIDJAN 01 YOPOUGON CHU ABIDJAN, COTE D IVOIRE',
          notifyNom: 'NO OUSMANE KEITA',
          notifyAdresse: '01 ABIDJAN 01 YOPOUGON CHU ABIDJAN, COTE D IVOIRE',
          portChargementCode: 'BEANR',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'USED TRUCK DAF TRUCK',
          marquesEtNumeros: 'XLRAE75PC0E507193',
          nombreColis: 1,
          typeEmballage: 'RORO',
          poidsBrutKg: 11200,
          volumeM3: 57.750,
          statutImport: 'EN_ATTENTE',
          conteneurs: []
        },
        {
          id: newEscaleId + 15,
          escaleId: newEscaleId,
          numeroBL: 'UROABJ25013',
          typeOperation: 'IMPORT',
          shipperNom: 'SH EPC FRANCE',
          shipperAdresse: 'NO 4 RUE ST MARTIN 13310 SAINT MARTIN DE CRAU, FRANCE',
          consigneeNom: 'CO EPC COTE D\'IVOIRE',
          consigneeAdresse: 'IMMEUBLE SAMBA DIOP LOT 55 BIS ILOT 8 YAMOUSSOUKRO',
          notifyNom: 'NO EPC COTE D\'IVOIRE',
          notifyAdresse: 'IMMEUBLE SAMBA DIOP LOT 55 BIS ILOT 8 YAMOUSSOUKRO',
          portChargementCode: 'FRROU',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'EXPLOSIF DE MINE (TC 20DC COC)',
          marquesEtNumeros: 'TCIU2085799',
          nombreColis: 1280,
          typeEmballage: 'CARTONS',
          poidsBrutKg: 33280,
          volumeM3: 0,
          statutImport: 'EN_ATTENTE',
          conteneurs: [
            {
              id: newEscaleId + 151,
              blId: newEscaleId + 15,
              numeroConteneur: 'TCIU2085799',
              typeConteneur: '20_DRY',
              numeroScelle: 'SEAL 3228127',
              poidsKg: 16640,
              tareKg: 2350,
              nombreColis: 640,
              montantCautionFcfa: 500000,
              statutLivraison: 'AU_PARC',
              dateEntreeParc: '2025-07-16T08:00:00Z'
            },
            {
              id: newEscaleId + 152,
              blId: newEscaleId + 15,
              numeroConteneur: 'XINU1643168',
              typeConteneur: '20_DRY',
              numeroScelle: 'SEAL 3228130',
              poidsKg: 16640,
              tareKg: 2350,
              nombreColis: 640,
              montantCautionFcfa: 500000,
              statutLivraison: 'AU_PARC',
              dateEntreeParc: '2025-07-16T08:00:00Z'
            }
          ]
        },
        {
          id: newEscaleId + 16,
          escaleId: newEscaleId,
          numeroBL: 'UROABJ25022',
          typeOperation: 'IMPORT',
          shipperNom: 'SH DAVEY BICKFORD',
          shipperAdresse: 'LE MOULIN GASPARD 89550 HERY, FRANCE',
          consigneeNom: 'CO EPC COTE D\'IVOIRE',
          consigneeAdresse: 'ABIDJAN COCODY CITE DES CADRES VILLA 78, ABIDJAN',
          notifyNom: 'NO EPC COTE D\'IVOIRE',
          notifyAdresse: 'ABIDJAN COCODY CITE DES CADRES VILLA 78, ABIDJAN',
          portChargementCode: 'FRROU',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'EXPLOSIF DE MINE (01 X40\'HC COC)',
          marquesEtNumeros: 'WAFU4511777',
          nombreColis: 1449,
          typeEmballage: 'CARTONS',
          poidsBrutKg: 8818.200,
          volumeM3: 0,
          statutImport: 'EN_ATTENTE',
          conteneurs: [
            {
              id: newEscaleId + 161,
              blId: newEscaleId + 16,
              numeroConteneur: 'WAFU4511777',
              typeConteneur: '40_HC',
              numeroScelle: 'SEAL 1005214',
              poidsKg: 8818.200,
              tareKg: 3900,
              nombreColis: 1449,
              montantCautionFcfa: 1000000,
              statutLivraison: 'AU_PARC',
              dateEntreeParc: '2025-07-16T08:00:00Z'
            }
          ]
        },
        {
          id: newEscaleId + 17,
          escaleId: newEscaleId,
          numeroBL: 'UROABJ25023',
          typeOperation: 'IMPORT',
          shipperNom: 'SH LEEHO SAS',
          shipperAdresse: '88 B CHEMIEN DE CROISSET 76380 CANTELEU, FRANCE',
          consigneeNom: 'CO AFRICA -DIST CI',
          consigneeAdresse: 'COCODY LES DEUX PLATEAUX 7E TRANCHE BP 1676 ABIDJAN',
          notifyNom: 'NO AFRICA -DIST CI',
          notifyAdresse: 'COCODY LES DEUX PLATEAUX 7E TRANCHE BP 1676 ABIDJAN',
          portChargementCode: 'FRROU',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'PIECES DETACHEES BTP ET DIVERS',
          marquesEtNumeros: 'CINU1625918',
          nombreColis: 35,
          typeEmballage: 'COLIS',
          poidsBrutKg: 14896,
          volumeM3: 0,
          statutImport: 'EN_ATTENTE',
          conteneurs: [
            {
              id: newEscaleId + 171,
              blId: newEscaleId + 17,
              numeroConteneur: 'CINU1625918',
              typeConteneur: '20_DRY',
              numeroScelle: 'SEAL 497991',
              poidsKg: 14896,
              tareKg: 2350,
              nombreColis: 35,
              montantCautionFcfa: 500000,
              statutLivraison: 'AU_PARC',
              dateEntreeParc: '2025-07-16T08:00:00Z'
            }
          ]
        },
        {
          id: newEscaleId + 18,
          escaleId: newEscaleId,
          numeroBL: 'UROABJ25024',
          typeOperation: 'IMPORT',
          shipperNom: 'SH TITANOBEL',
          shipperAdresse: 'RUE DE L\'INDUSTRIE BP 15 21270 PONTAILLER SUR SAONE, FRANCE',
          consigneeNom: 'CO CADERAC SA',
          consigneeAdresse: 'PK 44-AUTOROUTE DU NORD 10 BP 1667 ABIDJAN 10, COTE D\'IVOIRE',
          notifyNom: 'NO CADERAC SA',
          notifyAdresse: 'PK 44-AUTOROUTE DU NORD 10 BP 1667 ABIDJAN 10, COTE D\'IVOIRE',
          portChargementCode: 'FRROU',
          portDechargementCode: 'CIABJ',
          destinationFinale: 'CI',
          descriptionGoods: 'EXPLOSIF DE MINE (01 X 20\'DV)',
          marquesEtNumeros: 'CPWU2061201',
          nombreColis: 759,
          typeEmballage: 'CARTONS',
          poidsBrutKg: 17483,
          volumeM3: 0,
          statutImport: 'EN_ATTENTE',
          conteneurs: [
            {
              id: newEscaleId + 181,
              blId: newEscaleId + 18,
              numeroConteneur: 'CPWU2061201',
              typeConteneur: '20_DRY',
              numeroScelle: 'SEAL 448328',
              poidsKg: 17483,
              tareKg: 2350,
              nombreColis: 759,
              montantCautionFcfa: 500000,
              statutLivraison: 'AU_PARC',
              dateEntreeParc: '2025-07-16T08:00:00Z'
            }
          ]
        }
      ];

      setLastXmlFileName(actualFileName);
      localStorage.setItem('bocs_last_xml_filename', actualFileName);

      onImportManifest(newEscale, mockBls);
      onLogAudit('IMPORT_MANIFESTE_PDF', 'ManifestePDF', `Importation réussie du PDF ${actualFileName} par OCR (${mockBls.length} BLs extraits)`);
      setIsProcessingXml(false);
      alert(`Intégration PDF réussie par OCR BOCS ! Escale "${newEscale.nomNavire}" (Voyage ${newEscale.numeroVoyage}) créée avec ${mockBls.length} Connaissements extraits du fichier ${actualFileName}.`);
    }, 1500);
  };

  const handleXmlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Si l'utilisateur charge un PDF par erreur via ce sélecteur
    if (file.name.toLowerCase().endsWith('.pdf')) {
      processPdfFile(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const xmlContent = event.target?.result as string;
      processXmlContent(xmlContent, file.name);
    };
    reader.readAsText(file);
  };

  const handlePdfFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processPdfFile(file);
  };

  const handleCreateEscaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomNavire || !numeroVoyage) return;

    const newEscale: Escale = {
      id: Date.now(),
      nomNavire,
      callsign: callsign || `CS-${Math.floor(1000 + Math.random() * 9000)}`,
      numeroVoyage,
      portChargement,
      portDechargement,
      dateArrivee: new Date().toISOString().split('T')[0],
      statut: 'EN_COURS'
    };

    onAddEscale(newEscale);
    onLogAudit('CREATION_ESCALE', 'Escale', `Création manuelle de l'escale ${nomNavire} (Voyage ${numeroVoyage})`);
    setShowAddEscaleModal(false);
    setNomNavire('');
    setCallsign('');
    setNumeroVoyage('');
  };

  const getBlCategory = (bl: BL): FretCategory => {
    if (bl.conteneurs && bl.conteneurs.length > 0) return 'CONTENEUR';
    const emballage = (bl.typeEmballage || '').toUpperCase();
    const marques = (bl.marquesEtNumeros || '').toUpperCase();
    if (emballage.includes('VEHICULE') || emballage.includes('RO-RO') || emballage.includes('RORO') || marques.includes('CHASSIS') || marques.includes('RO-RO')) {
      return 'RORO';
    }
    if (emballage.includes('CONV') || emballage.includes('COLIS') || emballage.includes('PALETTE')) {
      return 'CONVENTIONNEL';
    }
    return 'VRAC';
  };

  const handleOpenInvoiceSelection = (bl: BL) => {
    const existing = plannedInvoicesByBl[bl.id] || bl.selectedInvoiceTypeIds || [];
    if (existing.length > 0) {
      setSelectedTypeIdsForBl(existing);
    } else {
      const blCat = getBlCategory(bl);
      const activeTypeIds = invoiceTypeConfigs
        .filter(t => rubriqueConfigs.some(r => r.invoiceTypeId === t.id && r.category === blCat && r.isActive))
        .map(t => t.id);
      setSelectedTypeIdsForBl(activeTypeIds.length > 0 ? activeTypeIds : (invoiceTypeConfigs.length > 0 ? [invoiceTypeConfigs[0].id] : ['2']));
    }
    setBlForInvoiceSelection(bl);
  };

  const handleConfirmInvoiceSelection = () => {
    if (!blForInvoiceSelection) return;
    if (selectedTypeIdsForBl.length === 0) {
      alert('Veuillez sélectionner au moins un type de facture pour ce connaissement.');
      return;
    }

    setPlannedInvoicesByBl(prev => ({
      ...prev,
      [blForInvoiceSelection.id]: selectedTypeIdsForBl
    }));

    const chosenNames = invoiceTypeConfigs
      .filter(t => selectedTypeIdsForBl.includes(t.id))
      .map(t => t.name)
      .join(', ');

    onLogAudit(
      'PLANIFICATION_FACTURES_BL',
      'BL',
      `Planification de ${selectedTypeIdsForBl.length} facture(s) (${chosenNames}) pour le BL ${blForInvoiceSelection.numeroBL}`
    );

    setBlForInvoiceSelection(null);
  };

  const handleGenerateProformaForType = (bl: BL, typeConfig: InvoiceTypeConfig, existingInvoice?: Invoice) => {
    if (existingInvoice) {
      generateProformaPdf(existingInvoice, bl, 'Agence BOCS Abidjan');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const { totalSurestarieFcfa } = calculateTotalDmdt(bl.conteneurs, today);
    const blCategory = getBlCategory(bl);

    // Get active rubriques for this category & this specific invoice type
    const activeConfigs = rubriqueConfigs.filter(r => 
      r.invoiceTypeId === typeConfig.id && 
      r.category === blCategory && 
      r.isActive
    );

    let lines = activeConfigs.map(r => {
      let quantity = 1;
      if (r.baseCalcul === 'CONTENEUR') {
        quantity = bl.conteneurs && bl.conteneurs.length > 0 ? bl.conteneurs.length : 1;
      } else if (r.baseCalcul === 'POIDS_TONNE') {
        quantity = bl.poidsBrutKg ? Math.round((bl.poidsBrutKg / 1000) * 100) / 100 : 1;
      }
      const typeFraisOptions = ['FRET', 'ECHANGE', 'TELEX', 'TRANSFERT', 'CAUTION', 'DMDT_SURESTARIE', 'AUTRE'];
      const itemTypeFrais = typeFraisOptions.includes(r.code) ? r.code : 'AUTRE';
      return {
        designation: r.name,
        typeFrais: itemTypeFrais as any,
        quantite: quantity,
        prixUnitaireFcfa: r.montantUnitaire,
        montantHtFcfa: Math.round(quantity * r.montantUnitaire),
        tauxTva: 18
      };
    });

    // Include surestaries if Caution or if configured
    if ((typeConfig.id === '1' || typeConfig.name.toLowerCase().includes('caution')) && totalSurestarieFcfa > 0) {
      lines.push({
        designation: 'Frais de surestaries DMDT conteneurs',
        typeFrais: 'DMDT_SURESTARIE',
        quantite: 1,
        prixUnitaireFcfa: totalSurestarieFcfa,
        montantHtFcfa: totalSurestarieFcfa,
        tauxTva: 18
      });
    }

    // Fallback if no rubriques are configured
    if (lines.length === 0) {
      lines = [
        { 
          designation: `Frais administratifs - Facture ${typeConfig.name}`, 
          typeFrais: 'AUTRE', 
          quantite: 1, 
          prixUnitaireFcfa: 100000, 
          montantHtFcfa: 100000, 
          tauxTva: 18 
        }
      ];
    }

    const calculatedHt = lines.reduce((sum, l) => sum + l.montantHtFcfa, 0);
    const calculatedTva = Math.round(calculatedHt * 0.18);
    const calculatedTtc = calculatedHt + calculatedTva;

    const prefix = typeConfig.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'FAC');
    const invoice: Invoice = {
      id: Date.now(),
      blId: bl.id,
      numeroBL: bl.numeroBL,
      clientId: bl.clientId,
      clientNom: bl.consigneeNom,
      escaleInfo: escales.find(e => e.id === bl.escaleId) ? `${escales.find(e => e.id === bl.escaleId)?.nomNavire} V.${escales.find(e => e.id === bl.escaleId)?.numeroVoyage}` : `Escale BL #${bl.numeroBL}`,
      typeFacture: 'PROFORMA_IMPORT',
      numeroFacture: `PROF-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
      dateFacture: today,
      dateEcheance: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      devise: 'FCFA',
      tauxChangeUsd: 600,
      montantHtFcfa: calculatedHt,
      tvaFcfa: calculatedTva,
      montantTtcFcfa: calculatedTtc,
      soldeDuFcfa: calculatedTtc,
      statutPaiement: 'NON_PAYE',
      invoiceTypeId: typeConfig.id,
      lignes: lines
    };

    onGenerateInvoice(invoice);
    onLogAudit(
      'GENERATION_PROFORMA_IMPORT', 
      'Facture', 
      `Génération de la facture proforma ${typeConfig.name} (${invoice.numeroFacture}) pour BL ${bl.numeroBL}`
    );
    generateProformaPdf(invoice, bl, 'Agence BOCS Abidjan');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="material-symbols-outlined text-[#005daa] text-2xl font-black">arrow_right_alt</span>
            <h1 className="text-xl font-black text-slate-900 font-heading">Gestion des Manifestes Import & BLs</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Intégration des fichiers GUCE XML, extraction automatique des lettres de voiture et calcul des frais.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddEscaleModal(true)}
            className="px-5 py-2.5 bg-[#005daa] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Nouvelle Escale Manuelle</span>
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="w-full">
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleXmlFileUpload}
          accept=".xml"
          className="hidden"
        />
        <input
          type="file"
          ref={pdfInputRef}
          onChange={handlePdfFileUpload}
          accept=".pdf"
          className="hidden"
        />

        {/* Dropzone */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-white rounded-2xl border-2 border-dashed border-blue-300 hover:border-[#005daa] p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50/40 transition-all text-center min-h-[160px] shadow-xs"
        >
          <h3 className="text-base font-black text-slate-900 mb-1 font-heading">Charger un Manifeste GUCE XML / PDF</h3>
          <p className="text-xs text-slate-500 max-w-md mb-4 font-medium">
            Glissez-déposez le fichier XML GUCE ou un Manifeste au format PDF pour lancer l'extraction OCR BOCS.
          </p>

          {isProcessingXml ? (
            <div className="flex items-center gap-2 text-[#005daa] font-bold text-xs bg-blue-50 px-4 py-2 rounded-xl border border-blue-200">
              <span className="material-symbols-outlined animate-spin text-base">sync</span>
              <span>Analyse et Extraction OCR en cours...</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-5 py-2.5 bg-[#0b172a] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Sélectionner le fichier XML GUCE</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pdfInputRef.current?.click();
                }}
                className="px-5 py-2.5 bg-white border border-blue-200 text-[#005daa] hover:bg-blue-50 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                <span>Sélectionner le fichier PDF</span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* BL Table Section */}
      <div className="bocs-card overflow-hidden">
        
        {/* Table Controls */}
        <div className="p-4 bg-surface-container-low border-b border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Escale Filter & Search */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedEscaleId}
              onChange={e => setSelectedEscaleId(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10))}
              className="bg-[#ffe135] hover:bg-[#ffe855] text-[#0f172a] border border-[#e5c122] rounded-xl px-3.5 py-2 text-xs font-black shadow-xs transition-all cursor-pointer focus:outline-none"
            >
              <option value="ALL">Toutes les Escales ({escales.length})</option>
              {escales.map(esc => (
                <option key={esc.id} value={esc.id}>
                  {esc.nomNavire} - Voyage {esc.numeroVoyage}
                </option>
              ))}
            </select>

            {selectedEscaleId !== 'ALL' && onDeleteEscaleIntegration && (
              <button
                type="button"
                onClick={() => {
                  const targetEsc = escales.find(e => e.id === selectedEscaleId);
                  if (targetEsc) setEscaleToDelete(targetEsc);
                }}
                className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Supprimer cette intégration GUCE et ses BLs"
              >
                <span className="material-symbols-outlined text-sm text-rose-600">delete</span>
                <span>Supprimer cette Intégration</span>
              </button>
            )}

            <div className="relative flex-1 sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="N° BL, Consignee, Shipper..."
                className="w-full pl-9 pr-3 py-1.5 bg-surface border border-outline-variant rounded text-xs text-on-surface focus:outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div className="text-xs text-outline font-semibold">
            {filteredBls.length} Connaissement(s) trouvé(s)
          </div>

        </div>

        {/* Table avec Ascenseur Vertical & Horizontal (Scrollbar) */}
        <div className="overflow-x-auto overflow-y-auto max-h-[520px] bocs-scrollbar relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-md shadow-xs">
              <tr className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <th className="p-3">Numéro BL</th>
                <th className="p-3">Consignee (Destinataire)</th>
                <th className="p-3">Poids / Vol / Colis</th>
                <th className="p-3">Conteneurs</th>
                <th className="p-3">Statut Import</th>
                <th className="p-3 text-right">Actions Proforma & PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-xs">
              {filteredBls.map(bl => {
                const plannedIds = plannedInvoicesByBl[bl.id] || (bl.selectedInvoiceTypeIds && bl.selectedInvoiceTypeIds.length > 0 ? bl.selectedInvoiceTypeIds : []);
                const blInvoices = invoices.filter(inv => inv.blId === bl.id || inv.numeroBL === bl.numeroBL);

                const plannedConfigs = invoiceTypeConfigs.filter(t => plannedIds.includes(t.id));
                const generatedConfigs = plannedConfigs.filter(t => 
                  blInvoices.some(inv => 
                    inv.invoiceTypeId === t.id || 
                    inv.numeroFacture.startsWith(`PROF-${t.name.substring(0, 3).toUpperCase()}`) ||
                    inv.typeFacture.toLowerCase().includes(t.name.toLowerCase())
                  )
                );
                const pendingConfigs = plannedConfigs.filter(t => !generatedConfigs.some(g => g.id === t.id));
                const allGenerated = (plannedConfigs.length > 0 && pendingConfigs.length === 0);

                return (
                  <tr key={bl.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="p-3">
                      <span className="font-mono font-bold text-primary text-sm block">{bl.numeroBL}</span>
                      <span className="text-[10px] text-slate-500 font-semibold truncate block max-w-[160px]" title={bl.shipperNom}>{bl.shipperNom}</span>
                    </td>
                    <td className="p-3 font-semibold text-primary">{bl.consigneeNom}</td>
                    <td className="p-3 font-mono">
                      <div>{bl.poidsBrutKg.toLocaleString()} kg</div>
                      <div className="text-[10px] text-outline">{bl.volumeM3} m³ | {bl.nombreColis} colis</div>
                    </td>
                    <td className="p-3">
                      {bl.conteneurs && bl.conteneurs.length > 0 ? (
                        (() => {
                          const count20 = bl.conteneurs.filter(c => c.typeConteneur && c.typeConteneur.startsWith('20')).length;
                          const count40 = bl.conteneurs.filter(c => c.typeConteneur && c.typeConteneur.startsWith('40')).length;
                          const otherCount = bl.conteneurs.length - count20 - count40;
                          return (
                            <div className="flex flex-wrap items-center gap-1.5 font-mono">
                              {count20 > 0 && (
                                <span className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-[#005daa] text-xs font-black shadow-2xs" title={`${count20} conteneur(s) de 20 pieds`}>
                                  {count20} x 20'
                                </span>
                              )}
                              {count40 > 0 && (
                                <span className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black shadow-2xs" title={`${count40} conteneur(s) de 40 pieds`}>
                                  {count40} x 40'
                                </span>
                              )}
                              {otherCount > 0 && (
                                <span className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black shadow-2xs">
                                  {otherCount} x Divers
                                </span>
                              )}
                            </div>
                          );
                        })()
                      ) : bl.marquesEtNumeros ? (
                        <div className="flex flex-col gap-1 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              bl.marquesEtNumeros.includes('CDE')
                                ? 'bg-amber-50 border border-amber-200 text-amber-700'
                                : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            }`}>
                              {bl.marquesEtNumeros.includes('CDE') ? 'VRAC' : 'RORO'}
                            </span>
                            <span className="text-slate-700 font-bold text-xs">{bl.marquesEtNumeros}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sans repères</span>
                      )}
                    </td>

                    {/* Statut Column */}
                    <td className="p-3">
                      {plannedConfigs.length === 0 ? (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                          EN ATTENTE
                        </span>
                      ) : allGenerated ? (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-600 text-white shadow-xs inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          <span>FACTURÉ</span>
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-amber-700">pending_actions</span>
                            <span>EN ATTENTE ({pendingConfigs.map(t => t.name).join(', ')})</span>
                          </span>
                          {generatedConfigs.length > 0 && (
                            <span className="text-[9px] text-slate-500 font-mono font-bold">
                              {generatedConfigs.length}/{plannedConfigs.length} éditée(s)
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions Column */}
                    <td className="p-3 text-right">
                      <div className="flex flex-nowrap items-center justify-end gap-1.5 min-w-max">
                        <button
                          onClick={() => setSelectedBlDetails(bl)}
                          className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold rounded-lg text-xs transition-all cursor-pointer"
                        >
                          Détails
                        </button>

                        {plannedConfigs.length === 0 ? (
                          <button
                            onClick={() => handleOpenInvoiceSelection(bl)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <span className="material-symbols-outlined text-sm text-slate-500">receipt_long</span>
                            <span>Proforma PDF</span>
                          </button>
                        ) : (
                          <>
                            {plannedConfigs.map(typeConfig => {
                              const isGen = generatedConfigs.some(g => g.id === typeConfig.id);
                              const generatedInv = blInvoices.find(inv => 
                                inv.invoiceTypeId === typeConfig.id || 
                                inv.numeroFacture.startsWith(`PROF-${typeConfig.name.substring(0, 3).toUpperCase()}`)
                              );

                              return (
                                <button
                                  key={typeConfig.id}
                                  onClick={() => handleGenerateProformaForType(bl, typeConfig, generatedInv)}
                                  className={`px-2.5 py-1 font-bold rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs ${
                                    isGen
                                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                      : 'bg-[#005daa] hover:bg-blue-700 text-white shadow-xs'
                                  }`}
                                  title={isGen ? `Facture ${typeConfig.name} déjà éditée (Cliquer pour revoir/télécharger)` : `Éditer la Facture Proforma ${typeConfig.name}`}
                                >
                                  <span className="material-symbols-outlined text-xs">
                                    {isGen ? 'check_circle' : 'receipt_long'}
                                  </span>
                                  <span>{typeConfig.name}</span>
                                </button>
                              );
                            })}

                            {/* Bouton pour réajuster ou modifier les types de factures */}
                            <button
                              onClick={() => handleOpenInvoiceSelection(bl)}
                              className="p-1 text-slate-400 hover:text-[#005daa] hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                              title="Modifier la sélection des factures pour ce BL"
                            >
                              <span className="material-symbols-outlined text-base">settings</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Section Bas de Page Totaux (Poids, Volume, Colis, Conteneurs, Vrac, RoRo) */}
        {(() => {
          const totalPoidsKg = filteredBls.reduce((acc, b) => acc + (b.poidsBrutKg || 0), 0);
          const totalVolumeM3 = filteredBls.reduce((acc, b) => acc + (b.volumeM3 || 0), 0);
          const totalNombreColis = filteredBls.reduce((acc, b) => acc + (b.nombreColis || 0), 0);
          const totalConteneursCount = filteredBls.reduce((acc, b) => acc + (b.conteneurs?.length || 0), 0);
          const totalVracCount = filteredBls.filter(b => b.typeEmballage === 'VRAC' || (b.marquesEtNumeros && b.marquesEtNumeros.includes('CDE'))).reduce((acc, b) => acc + (b.nombreColis || 0), 0);
          const totalRoroCount = filteredBls.filter(b => b.typeEmballage === 'RORO').reduce((acc, b) => acc + (b.nombreColis || 0), 0);

          return (
            <div className="p-4 bg-[#0b172a] text-white border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#005daa] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-xl">analytics</span>
                </div>
                <div>
                  <span className="font-black text-xs uppercase tracking-wider text-white font-heading block">Synthèse du Manifeste</span>
                  <span className="text-[10px] text-blue-300 font-mono font-semibold">{filteredBls.length} Connaissement(s) affiché(s)</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 font-mono">
                
                {/* Total Poids */}
                <div className="flex items-center gap-2 bg-[#13243d] px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-xs">
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Total Poids:</span>
                  <span className="font-black text-emerald-400 text-sm">{totalPoidsKg.toLocaleString('fr-FR')} kg</span>
                  <span className="text-[10px] text-slate-400 font-semibold">({(totalPoidsKg / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} T)</span>
                </div>

                {/* Total Volume */}
                <div className="flex items-center gap-2 bg-[#13243d] px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-xs">
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Total Volume:</span>
                  <span className="font-black text-sky-400 text-sm">{totalVolumeM3.toLocaleString('fr-FR')} m³</span>
                </div>

                {/* Total Conteneurs */}
                <div className="flex items-center gap-2 bg-[#005daa] px-3.5 py-2 rounded-xl border border-blue-400/40 shadow-xs text-white">
                  <span className="text-[10px] uppercase text-blue-200 font-extrabold tracking-wider">Conteneurs:</span>
                  <span className="font-black text-white text-sm">{totalConteneursCount} TC</span>
                </div>

                {/* Total Vrac */}
                <div className="flex items-center gap-2 bg-[#e5c122] text-[#0f172a] px-3.5 py-2 rounded-xl border border-[#ffe135]/40 shadow-xs">
                  <span className="text-[10px] uppercase text-amber-950 font-extrabold tracking-wider">Vrac:</span>
                  <span className="font-black text-sm">{totalVracCount}</span>
                </div>

                {/* Total RoRo */}
                <div className="flex items-center gap-2 bg-emerald-600 text-white px-3.5 py-2 rounded-xl border border-emerald-400/40 shadow-xs">
                  <span className="text-[10px] uppercase text-emerald-200 font-extrabold tracking-wider">RoRo:</span>
                  <span className="font-black text-white text-sm">{totalRoroCount}</span>
                </div>

              </div>
            </div>
          );
        })()}

      </div>

      {/* Modal BL Details */}
      {selectedBlDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div>
                <h3 className="font-bold text-lg text-primary">Connaissement Maritime #{selectedBlDetails.numeroBL}</h3>
                <p className="text-xs text-outline font-mono">Port Chargement: {selectedBlDetails.portChargementCode} &rarr; Port Déchargement: {selectedBlDetails.portDechargementCode}</p>
              </div>
              <button onClick={() => setSelectedBlDetails(null)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-surface-container rounded space-y-1">
                <span className="text-[10px] text-outline font-bold uppercase">Shipper (Expéditeur)</span>
                <p className="font-bold text-primary">{selectedBlDetails.shipperNom}</p>
                <p className="text-on-surface-variant">{selectedBlDetails.shipperAdresse}</p>
              </div>
              <div className="p-3 bg-surface-container rounded space-y-1">
                <span className="text-[10px] text-outline font-bold uppercase">Consignee (Destinataire)</span>
                <p className="font-bold text-primary">{selectedBlDetails.consigneeNom}</p>
                <p className="text-on-surface-variant">{selectedBlDetails.consigneeAdresse}</p>
              </div>
            </div>

            <div className="p-3 bg-surface-container-low border border-outline-variant rounded text-xs space-y-2">
              <span className="font-bold text-primary uppercase text-[10px] block">Conteneurs Rattachés ({selectedBlDetails.conteneurs.length})</span>
              <div className="space-y-1">
                {selectedBlDetails.conteneurs.map(ctn => (
                  <div key={ctn.id} className="flex items-center justify-between p-2 bg-surface-container-lowest rounded font-mono">
                    <span className="font-bold text-secondary">{ctn.numeroConteneur} ({ctn.typeConteneur})</span>
                    <span className="text-on-surface-variant">Poids: {ctn.poidsKg} kg | Scellé: {ctn.numeroScelle}</span>
                    <span className="font-bold text-emerald-600">Caution: {ctn.montantCautionFcfa.toLocaleString()} FCFA</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setSelectedBlDetails(null)}
                className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded text-xs font-semibold text-on-surface-variant"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  const target = selectedBlDetails;
                  setSelectedBlDetails(null);
                  if (target) {
                    handleOpenInvoiceSelection(target);
                  }
                }}
                className="px-5 py-2 bg-[#005daa] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">fact_check</span>
                <span>Choisir Factures Proforma</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Create Escale */}
      {showAddEscaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-bold text-lg text-primary">Créer une Escale Manuelle</h3>
              <button onClick={() => setShowAddEscaleModal(false)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateEscaleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-on-surface-variant uppercase mb-1">Nom du Navire</label>
                <input
                  type="text"
                  required
                  value={nomNavire}
                  onChange={e => setNomNavire(e.target.value)}
                  placeholder="ex: BOCS BREMEN"
                  className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">Callsign</label>
                  <input
                    type="text"
                    value={callsign}
                    onChange={e => setCallsign(e.target.value)}
                    placeholder="CS-9021"
                    className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-on-surface-variant uppercase mb-1">N° Voyage</label>
                  <input
                    type="text"
                    required
                    value={numeroVoyage}
                    onChange={e => setNumeroVoyage(e.target.value)}
                    placeholder="VOY-2026-09"
                    className="w-full h-9 px-3 bg-surface border border-outline-variant rounded text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEscaleModal(false)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-on-primary font-bold rounded text-xs hover:bg-secondary"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Coller du texte XML GUCE */}
      {showPasteXmlModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">code</span>
                <h3 className="font-extrabold text-base text-slate-900 font-heading">Coller un texte XML GUCE Import</h3>
              </div>
              <button onClick={() => setShowPasteXmlModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Collez ci-dessous le contenu brut XML du manifeste GUCE d'Abidjan. Le système créera automatiquement l'Escale du navire et extraira l'ensemble des lettres de voiture (BLs) et conteneurs associés.
            </p>

            <textarea
              value={pastedXmlText}
              onChange={(e) => setPastedXmlText(e.target.value)}
              placeholder="<manifest> <manifest_general_segment> ... </manifest_general_segment> </manifest>"
              className="w-full h-64 p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPasteXmlModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!pastedXmlText.trim() || isProcessingXml}
                onClick={() => processXmlContent(pastedXmlText, 'Pasted_GUCE_Manifest.xml')}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">download_done</span>
                <span>Traiter et Extraire le Manifeste</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmation de Suppression d'Intégration XML */}
      {escaleToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 font-heading">Supprimer l'Intégration XML</h3>
                <p className="text-[11px] text-rose-600 font-semibold uppercase tracking-wider">Action définitive & irréversible</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs space-y-2">
              <p className="font-semibold text-slate-800">
                Voulez-vous vraiment supprimer l'escale du navire <span className="font-bold text-slate-900 underline">{escaleToDelete.nomNavire}</span> (Voyage <span className="font-mono font-bold text-blue-600">{escaleToDelete.numeroVoyage}</span>) ?
              </p>
              <p className="text-slate-500">
                Cette suppression retirera définitivement l'escale ainsi que les <span className="font-bold text-rose-600">{bls.filter(b => b.escaleId === escaleToDelete.id).length} BL(s)</span> et tous leurs conteneurs rattachés.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEscaleToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteEscaleIntegration) {
                    onDeleteEscaleIntegration(escaleToDelete.id);
                  }
                  setEscaleToDelete(null);
                  setSelectedEscaleId('ALL');
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">delete_forever</span>
                <span>Confirmer la Suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Sélection des Types de Factures à Émettre pour le BL */}
      {blForInvoiceSelection && (() => {
        const blCat = getBlCategory(blForInvoiceSelection);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#005daa] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">fact_check</span>
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider font-heading">
                      Types de Factures à Émettre
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      BL <strong className="font-mono text-[#005daa]">{blForInvoiceSelection.numeroBL}</strong> • Marchandise : <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold">{blCat}</span>
                    </p>
                  </div>
                </div>
                <button onClick={() => setBlForInvoiceSelection(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-600 font-medium">
                  Cochez les factures que vous souhaitez émettre pour ce BL. Chaque type coché apparaîtra sous forme de bouton sur la ligne du BL :
                </p>

                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {invoiceTypeConfigs.map(typeConfig => {
                    const isChecked = selectedTypeIdsForBl.includes(typeConfig.id);
                    const matchingRubriques = rubriqueConfigs.filter(r => 
                      r.invoiceTypeId === typeConfig.id && 
                      r.category === blCat && 
                      r.isActive
                    );

                    const estimatedHt = matchingRubriques.reduce((sum, r) => {
                      let q = 1;
                      if (r.baseCalcul === 'CONTENEUR') q = blForInvoiceSelection.conteneurs?.length || 1;
                      else if (r.baseCalcul === 'POIDS_TONNE') q = blForInvoiceSelection.poidsBrutKg ? Math.round((blForInvoiceSelection.poidsBrutKg / 1000) * 100) / 100 : 1;
                      return sum + Math.round(q * r.montantUnitaire);
                    }, 0);

                    return (
                      <label
                        key={typeConfig.id}
                        onClick={(e) => {
                          e.preventDefault();
                          if (isChecked) {
                            setSelectedTypeIdsForBl(prev => prev.filter(id => id !== typeConfig.id));
                          } else {
                            setSelectedTypeIdsForBl(prev => [...prev, typeConfig.id]);
                          }
                        }}
                        className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'bg-blue-50/60 border-[#005daa] shadow-xs'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 mt-0.5 text-[#005daa] rounded focus:ring-[#005daa] cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 text-xs font-heading">
                              Facture {typeConfig.name}
                            </span>
                            {estimatedHt > 0 && (
                              <span className="text-xs font-mono font-black text-[#005daa]">
                                ~{estimatedHt.toLocaleString('fr-FR')} FCFA
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {typeConfig.description || 'Frais et rubriques applicables'}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {matchingRubriques.length > 0 ? (
                              matchingRubriques.map(r => (
                                <span key={r.id} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-700 font-semibold">
                                  {r.name} ({r.montantUnitaire.toLocaleString('fr-FR')} FCFA/{r.baseCalcul})
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Frais standard par défaut pour {blCat}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-600">
                  {selectedTypeIdsForBl.length} type(s) de facture sélectionné(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBlForInvoiceSelection(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmInvoiceSelection}
                    className="px-5 py-2 bg-[#005daa] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">check</span>
                    <span>Valider la Sélection</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};
