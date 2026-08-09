import { Escale, BL, Container, ContainerType } from '../types';

export interface ParsedManifestResult {
  escale: Partial<Escale>;
  bls: Partial<BL>[];
  totalPackages: number;
  totalContainers: number;
  totalGrossWeight: number;
}

/**
 * Normalizes container types from GUCE/ASYCUDA codes (e.g., '40HR', '20GP', '40HC', '40DRY')
 * to standard application types ('20_DRY', '40_HC', '40_REEFER', etc.)
 */
export function mapContainerType(code: string): ContainerType {
  const upper = (code || '').toUpperCase().trim();
  if (upper.includes('40HR') || upper.includes('REEFER 40') || upper.includes('40RF')) return '40_REEFER';
  if (upper.includes('20RF') || upper.includes('REEFER 20')) return '20_REEFER';
  if (upper.includes('40HC') || upper.includes('HIGH CUBE') || upper.includes('40HQ') || upper.includes('40\' DRY HIGH')) return '40_HC';
  if (upper.includes('20GP') || upper.includes('20\' DRY') || upper.includes('20DV') || upper.includes('20_DRY')) return '20_DRY';
  if (upper.includes('40GP') || upper.includes('40\' DRY') || upper.includes('40DV')) return '40_DRY';
  if (upper.includes('FLAT') || upper.includes('FR')) return '20_FLAT_RACK';
  if (upper.includes('OPEN') || upper.includes('OT')) return '20_OPEN_TOP';
  return '40_HC'; // default fallback
}

/**
 * XML Parser for GUCE Abidjan Import XML files.
 */
export function parseGuceXml(xmlText: string): ParsedManifestResult {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Check for parsing errors
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('Format XML invalide ou corrompu : ' + parseError[0].textContent);
  }

  // 1. General Segment Extraction
  const generalSeg = xmlDoc.getElementsByTagName('manifest_general_segment')[0];
  let vesselName = 'GLEN CANYON';
  let voyageNo = '22600409';
  let callsign = 'D5ZW3';
  let arrivalDate = new Date().toISOString().split('T')[0];
  let portLoading = 'MELBOURNE';
  let portUnloading = 'ABIDJAN';

  if (generalSeg) {
    vesselName = generalSeg.getElementsByTagName('transport_identity')[0]?.textContent || vesselName;
    voyageNo = generalSeg.getElementsByTagName('manifest_voyage_number')[0]?.textContent || voyageNo;
    callsign = generalSeg.getElementsByTagName('callsign')[0]?.textContent || callsign;
    
    const eta = generalSeg.getElementsByTagName('estimated_date_of_arrival')[0]?.textContent || 
                generalSeg.getElementsByTagName('manifest_departure_date')[0]?.textContent;
    if (eta) {
      // Format DD/MM/YYYY to YYYY-MM-DD
      const parts = eta.split('/');
      if (parts.length === 3) {
        arrivalDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    portLoading = generalSeg.getElementsByTagName('place_of_departure')[0]?.textContent || portLoading;
    portUnloading = generalSeg.getElementsByTagName('place_of_destination')[0]?.textContent || portUnloading;
  }

  const escale: Partial<Escale> = {
    nomNavire: vesselName,
    callsign: callsign,
    numeroVoyage: voyageNo,
    portChargement: portLoading,
    portDechargement: portUnloading,
    dateArrivee: arrivalDate,
    statut: 'EN_COURS'
  };

  // 2. Waybills (Connaissements) Extraction
  const waybillNodes = xmlDoc.getElementsByTagName('waybill');
  const bls: Partial<BL>[] = [];
  let totalPackages = 0;
  let totalContainers = 0;
  let totalGrossWeight = 0;

  for (let i = 0; i < waybillNodes.length; i++) {
    const wb = waybillNodes[i];
    
    const numeroBL = wb.getElementsByTagName('waybill_reference_number')[0]?.textContent || `BL-IMP-${1000 + i}`;
    const shipperNom = wb.getElementsByTagName('exporter_name')[0]?.textContent || 'SHIPPER UNKNOWN';
    const shipperAdresse = wb.getElementsByTagName('exporter_address')[0]?.textContent || '';
    const consigneeNom = wb.getElementsByTagName('consignee_name')[0]?.textContent || 'CONSIGNEE UNKNOWN';
    const consigneeAdresse = wb.getElementsByTagName('consignee_address')[0]?.textContent || '';
    const notifyNom = wb.getElementsByTagName('notify_name')[0]?.textContent || consigneeNom;
    const notifyAdresse = wb.getElementsByTagName('notify_address')[0]?.textContent || consigneeAdresse;
    const descriptionGoods = wb.getElementsByTagName('description_of_goods')[0]?.textContent || 'MARCHANDISES DIVERSES';
    const marquesEtNumeros = wb.getElementsByTagName('shipping_marks')[0]?.textContent || 
                             wb.getElementsByTagName('marks_and_numbers')[0]?.textContent || '';
    
    const pkgStr = wb.getElementsByTagName('manifested_packages')[0]?.textContent || '0';
    const pkg = parseInt(pkgStr, 10) || 0;
    totalPackages += pkg;

    const wtStr = wb.getElementsByTagName('manifested_gross_weight')[0]?.textContent || '0';
    const grossWt = parseFloat(wtStr) || 0;
    totalGrossWeight += grossWt;

    const volStr = wb.getElementsByTagName('volume')[0]?.textContent || '0';
    const vol = parseFloat(volStr) || 0;

    const portLoadCode = wb.getElementsByTagName('place_of_loading_code')[0]?.textContent || 'CIABJ';
    const portUnloadCode = wb.getElementsByTagName('place_of_unloading_code')[0]?.textContent || 'CIABJ';
    const destCountry = wb.getElementsByTagName('country_of_final_destination')[0]?.textContent || 'CI';

    // Container Nodes
    const containerNodes = wb.getElementsByTagName('container');
    const conteneurs: Container[] = [];

    for (let j = 0; j < containerNodes.length; j++) {
      const c = containerNodes[j];
      const numeroConteneur = c.getElementsByTagName('container_number')[0]?.textContent || `CTNR-${i}-${j}`;
      const rawType = c.getElementsByTagName('container_type')[0]?.textContent || '40HC';
      const typeConteneur = mapContainerType(rawType);
      const numeroScelle = c.getElementsByTagName('seals_number')[0]?.textContent || 'SEAL-OK';
      
      const cPkg = parseInt(c.getElementsByTagName('number_of_packages')[0]?.textContent || '0', 10) || 0;
      const emptyWt = parseFloat(c.getElementsByTagName('empty_weight')[0]?.textContent || '3900');
      const goodsWt = parseFloat(c.getElementsByTagName('goods_weight')[0]?.textContent || '25000');

      // Default Caution depending on container size
      const montantCautionFcfa = typeConteneur.includes('20') ? 500000 : 1000000;

      conteneurs.push({
        id: Math.floor(Math.random() * 100000),
        blId: 0, // will be set on persistence
        numeroConteneur,
        typeConteneur,
        numeroScelle,
        poidsKg: goodsWt,
        tareKg: emptyWt,
        nombreColis: cPkg,
        montantCautionFcfa,
        statutLivraison: 'AU_PARC',
        dateEntreeParc: arrivalDate + 'T08:00:00Z'
      });

      totalContainers++;
    }

    bls.push({
      numeroBL,
      typeOperation: 'IMPORT',
      shipperNom,
      shipperAdresse,
      consigneeNom,
      consigneeAdresse,
      notifyNom,
      notifyAdresse,
      portChargementCode: portLoadCode,
      portDechargementCode: portUnloadCode,
      destinationFinale: destCountry,
      descriptionGoods,
      marquesEtNumeros,
      nombreColis: pkg,
      typeEmballage: 'CARTONS / PACKAGES',
      poidsBrutKg: grossWt,
      volumeM3: vol,
      statutImport: 'EN_ATTENTE',
      conteneurs
    });
  }

  return {
    escale,
    bls,
    totalPackages,
    totalContainers,
    totalGrossWeight
  };
}
