const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
}

const dbUrl = process.env.POSTGRES_URL 
  || process.env.DATABASE_URL 
  || process.env.BOCS_POSTGRES_URL
  || process.env.BOCS_DATABASE_URL
  || process.env.NEON_DATABASE_URL;

const BOCS_BREMEN_25586_ESCALE = {
  id: 25586,
  nomNavire: 'BOCS BREMEN',
  callsign: 'CQRT',
  numeroVoyage: '25586',
  portChargement: 'ANVERS / ROUEN',
  portDechargement: 'ABIDJAN (CIABJ)',
  dateArrivee: '2025-07-15',
  dateDepart: '2025-07-22',
  statut: 'EN_COURS',
  createdBy: 'BOCS Import Department'
};

const BOCS_BREMEN_25586_BLS_DATA = [
  {
    numeroBL: 'ANRABJ25586001',
    shipperNom: 'SACOFRINA SA',
    shipperAdresse: '29 ROUTE DE PRE BOIS CASE POSTALE 731, CH 1215 GENEVE SUISSE',
    consigneeNom: 'SOLIBRA',
    consigneeAdresse: '01 BP 1304 ABIDJAN 01 REP DE COTE D\'IVOIRE',
    notifyNom: 'SOLIBRA',
    notifyAdresse: '01 BP 1304 ABIDJAN 01 REP DE COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: 'MALT SPECIAL SACOFRINA EN VRAC - DA T12313/MPC - LICENCE 250099780 - BSC N° CIIMP 447764',
    marquesEtNumeros: 'CDE 25-05904 SOLIBRA',
    nombreColis: 1,
    typeEmballage: 'VRAC',
    poidsBrutKg: 1699996,
    volumeM3: 0,
    conteneurs: []
  },
  {
    numeroBL: 'ANRABJ25586101',
    shipperNom: 'SACOFRINA SA',
    shipperAdresse: '29 ROUTE DE PRE-BOIS CASE POSTALE 731, CH-1215 GENEVE SUISSE',
    consigneeNom: 'SOLIBRA',
    consigneeAdresse: '01 BP 1304 ABIDJAN 01 REP. DE COTE D\'IVOIRE',
    notifyNom: 'SOLIBRA',
    notifyAdresse: '01 BP 1304 ABIDJAN 01 REP. DE COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: 'PRODUITS DIVERS DONT DANGEREUX - IMO 3 UN 1262 LTD QTY / IMO 3 UN 1170 / IMO 3 UN 1230 / IMO 3 UN 1268',
    marquesEtNumeros: 'CINU3813067 / SEAL 2687574',
    nombreColis: 47,
    typeEmballage: 'CONTENEUR',
    poidsBrutKg: 4753.09,
    volumeM3: 0,
    conteneurs: [
      {
        numeroConteneur: 'CINU3813067',
        typeConteneur: '20_DRY',
        numeroScelle: '2687574',
        poidsKg: 4753.09,
        tareKg: 2350,
        nombreColis: 47,
        montantCautionFcfa: 500000,
        statutLivraison: 'AU_PARC',
        isDangerous: true,
        socCoc: 'COC',
        dateEntreeParc: '2025-07-16T08:00:00Z'
      }
    ]
  },
  {
    numeroBL: 'ANRABJ25586102',
    shipperNom: 'HALLIBURTON BV',
    shipperAdresse: 'COLUMBUSSTRAAT 19, 7825 VP EMMEN, THE NETHERLANDS',
    consigneeNom: 'HALLIBURTON WW LTD. (ENI CÔTE D\'IVOIRE)',
    consigneeAdresse: 'IMMEUBLE BAINI, 4TH FLOOR RUE LUIS L ABIDJAN CÔTE D\'IVOIRE',
    notifyNom: 'AFRICA GLOBAL LOGISTICS C.I',
    notifyAdresse: 'OILFIELD, BASE OFFSHORE VRIDI CANAL 01 BP 1727 ABIDJAN - COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: 'PRODUITS CHIMIQUES (200X CHEM, TUNED SPACER E+, 50 LB BAG) - DIM: 130X100X103 CM - FPO 4518123445',
    marquesEtNumeros: 'SN 5433138 / FPO 4518123445',
    nombreColis: 5,
    typeEmballage: 'CONVENTIONNEL',
    poidsBrutKg: 4667,
    volumeM3: 6.695,
    conteneurs: []
  },
  {
    numeroBL: 'ANRABJ25586104',
    shipperNom: 'INDUSTEEL BELGIUM',
    shipperAdresse: 'SITE CHARLERO RUE CHATELET 266, 6030-MARCHIENNE AU PONT, BELGIUM',
    consigneeNom: 'TOLETOILE',
    consigneeAdresse: 'RUE NICOT, ZONE 00225 ABIDJAN, IVORY COAST',
    notifyNom: 'TOLETOILE',
    notifyAdresse: 'RUE NICOT, ZONE 00225 ABIDJAN, IVORY COAST',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '16 STEEL PLATES (PLAQUES D\'ACIER)',
    marquesEtNumeros: '16 STEEL PLATES',
    nombreColis: 16,
    typeEmballage: 'CONVENTIONNEL',
    poidsBrutKg: 18240,
    volumeM3: 2.76,
    conteneurs: []
  },
  {
    numeroBL: 'ANRABJ25586105',
    shipperNom: 'INDUSTEEL BELGIUM',
    shipperAdresse: 'SITE CHARLERO RUE CHATELET 266, 6030-MARCHIENNE AU PONT, BELGIUM',
    consigneeNom: 'SOTACI',
    consigneeAdresse: 'ZONE INDUSTRIELLE DE 01 BP 2747 ABIDJAN 01, IVORY COAST',
    notifyNom: 'SOTACI',
    notifyAdresse: 'ZONE INDUSTRIELLE DE 01 BP 2747 ABIDJAN 01, IVORY COAST',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: 'STEEL PLATES (PLAQUES D\'ACIER INDUSTRIELLES)',
    marquesEtNumeros: 'STEEL PLATES SOTACI',
    nombreColis: 2,
    typeEmballage: 'CONVENTIONNEL',
    poidsBrutKg: 7536,
    volumeM3: 0.33,
    conteneurs: []
  },
  {
    numeroBL: 'BOBR25586324705',
    shipperNom: 'IMS ANTWERP',
    shipperAdresse: '39 DUBOISSTRAAT, ANTWERPEN, BELGIUM',
    consigneeNom: 'DOUMBIA AMARA',
    consigneeAdresse: 'ABIDJAN, COTE D\'IVOIRE',
    notifyNom: 'DOUMBIA AMARA',
    notifyAdresse: 'ABIDJAN, COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '1 VEHICULE - USED TRUCK RENAULT BENNE',
    marquesEtNumeros: 'VF633DVB000108756',
    nombreColis: 1,
    typeEmballage: 'RORO',
    poidsBrutKg: 7500,
    volumeM3: 63.937,
    conteneurs: []
  },
  {
    numeroBL: 'BOBR25586326835',
    shipperNom: 'IMS ANTWERP',
    shipperAdresse: 'DUBOISSTRAAT 39, 2060 ANTWERPEN, BELGIUM',
    consigneeNom: 'DELKA SOLUTION SARL',
    consigneeAdresse: '13 BP 2994 ABIDJAN 13, COTE D\'IVOIRE',
    notifyNom: 'DELKA SOLUTION SARL',
    notifyAdresse: '13 BP 2994 ABIDJAN 13, COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '1 VEHICULE - USED TRUCK MERCEDES BENZ 1820',
    marquesEtNumeros: 'WDB6520251K199518',
    nombreColis: 1,
    typeEmballage: 'RORO',
    poidsBrutKg: 8440,
    volumeM3: 63.875,
    conteneurs: []
  },
  {
    numeroBL: 'BOBR25586327099',
    shipperNom: 'IMS ANTWERP',
    shipperAdresse: '39 DUBOISSTRAAT, ANTWERPEN, BELGIUM',
    consigneeNom: 'MOHAMED AHMED MICHAEL JUNIOR',
    consigneeAdresse: '17 BP 74 ABIDJAN 17, COTE D\'IVOIRE',
    notifyNom: 'MOHAMED AHMED MICHAEL JUNIOR',
    notifyAdresse: '17 BP 74 ABIDJAN 17, COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '1 VEHICULE - USED TRUCK RENAULT KERAX',
    marquesEtNumeros: 'VF633AVB000102412',
    nombreColis: 1,
    typeEmballage: 'RORO',
    poidsBrutKg: 12340,
    volumeM3: 61.875,
    conteneurs: []
  },
  {
    numeroBL: 'BOBR25586327533',
    shipperNom: 'IMS ANTWERP',
    shipperAdresse: '39 DUBOISSTRAAT, ANTWERPEN, BELGIUM',
    consigneeNom: 'KONE BRAHIMA',
    consigneeAdresse: '11 BP 125 ABIDJAN 11, COTE D\'IVOIRE',
    notifyNom: 'KONE BRAHIMA',
    notifyAdresse: '11 BP 125 ABIDJAN 11, COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '1 VEHICULE - USED TRUCK DAF TRUCK',
    marquesEtNumeros: 'XLRTE85XC0E782441',
    nombreColis: 1,
    typeEmballage: 'RORO',
    poidsBrutKg: 7500,
    volumeM3: 47.25,
    conteneurs: []
  },
  {
    numeroBL: 'BOBR25586327611',
    shipperNom: 'IMS ANTWERP',
    shipperAdresse: '39 DUBOISSTRAAT, ANTWERPEN, BELGIUM',
    consigneeNom: 'OUSMANE KEITA',
    consigneeAdresse: '01ABIDJAN 01 YOPOUGON CHU, ABIDJAN, COTE D\'IVOIRE',
    notifyNom: 'OUSMANE KEITA',
    notifyAdresse: '01ABIDJAN 01 YOPOUGON CHU, ABIDJAN, COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '1 VEHICULE - USED TRUCK DAF TRUCK',
    marquesEtNumeros: 'XLRAG75RC0E466794',
    nombreColis: 1,
    typeEmballage: 'RORO',
    poidsBrutKg: 17320,
    volumeM3: 72.0,
    conteneurs: []
  },
  {
    numeroBL: 'BOBR25586328221',
    shipperNom: 'IMS ANTWERP',
    shipperAdresse: '39 DUBOISSTRAAT, ANTWERPEN, BELGIUM',
    consigneeNom: 'P. ENTREPRISE TRANSPORT LOGISTIQUE',
    consigneeAdresse: 'ABIDJAN, COTE D\'IVOIRE',
    notifyNom: 'P. ENTREPRISE TRANSPORT LOGISTIQUE',
    notifyAdresse: 'ABIDJAN, COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '3 RORO / COLIS : 1 TRAILER FRUEHAUF (7760 kg, 130 m3) + 1 TRUCK DAF CF400 (5062 kg, 50.75 m3) + 1 LOT USED SCAFFOLDING (2500 kg)',
    marquesEtNumeros: 'VFKTE34VCY2XB1436 / XLRTEM4100G059323',
    nombreColis: 3,
    typeEmballage: 'RORO',
    poidsBrutKg: 15322,
    volumeM3: 180.75,
    conteneurs: []
  },
  {
    numeroBL: 'BOBR25586329205',
    shipperNom: 'IMS ANTWERP',
    shipperAdresse: '39 DUBOISSTRAAT, ANTWERPEN, BELGIUM',
    consigneeNom: 'KONE CHEICK IBRAHIM',
    consigneeAdresse: 'ABIDJAN, COTE D\'IVOIRE',
    notifyNom: 'KONE CHEICK IBRAHIM',
    notifyAdresse: 'ABIDJAN, COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '2 VEHICULES - USED TRUCK DAF TRUCK (7820 kg, 54 m3) + USED TRUCK DAF TRUCK (8317 kg, 54 m3)',
    marquesEtNumeros: 'XLRTE47MS0E900054 / XLRTE47MS0E877138',
    nombreColis: 2,
    typeEmballage: 'RORO',
    poidsBrutKg: 16137,
    volumeM3: 108.0,
    conteneurs: []
  },
  {
    numeroBL: 'BOBR25586329791',
    shipperNom: 'IMS ANTWERP',
    shipperAdresse: '39 DUBOISSTRAAT, ANTWERPEN, BELGIUM',
    consigneeNom: 'OUSMANE KEITA',
    consigneeAdresse: '01ABIDJAN 01 YOPOUGON CHU, ABIDJAN, COTE D\'IVOIRE',
    notifyNom: 'OUSMANE KEITA',
    notifyAdresse: '01ABIDJAN 01 YOPOUGON CHU, ABIDJAN, COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '1 VEHICULE - USED TRUCK DAF TRUCK',
    marquesEtNumeros: 'XLRAE75PC0E602637',
    nombreColis: 1,
    typeEmballage: 'RORO',
    poidsBrutKg: 9700,
    volumeM3: 57.75,
    conteneurs: []
  },
  {
    numeroBL: 'BOBR25586332417',
    shipperNom: 'IMS ANTWERP',
    shipperAdresse: '39 DUBOISSTRAAT, ANTWERPEN, BELGIUM',
    consigneeNom: 'OUSMANE KEITA',
    consigneeAdresse: '01 ABIDJAN 01 YOPOUGON CHU, ABIDJAN, COTE D\'IVOIRE',
    notifyNom: 'OUSMANE KEITA',
    notifyAdresse: '01 ABIDJAN 01 YOPOUGON CHU, ABIDJAN, COTE D\'IVOIRE',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '1 VEHICULE - USED TRUCK DAF TRUCK',
    marquesEtNumeros: 'XLRAE75PC0E507193',
    nombreColis: 1,
    typeEmballage: 'RORO',
    poidsBrutKg: 11200,
    volumeM3: 57.75,
    conteneurs: []
  },
  {
    numeroBL: 'UROABJ25013',
    shipperNom: 'EPC FRANCE',
    shipperAdresse: 'NO 4 RUE ST MARTIN, 13310 SAINT MARTIN DE CRAU, FRANCE',
    consigneeNom: 'EPC COTE D\'IVOIRE',
    consigneeAdresse: 'IMMEUBLE SAMBA DIOP LOT 55 BIS, ILOT 8 QUARTIER MILLIONNAIRE, BP 1783 YAMOUSSOUKRO',
    notifyNom: 'EPC COTE D\'IVOIRE',
    notifyAdresse: 'IMMEUBLE SAMBA DIOP LOT 55 BIS, ILOT 8 QUARTIER MILLIONNAIRE, BP 1783 YAMOUSSOUKRO',
    portChargementCode: 'FRURO',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '02 TC 20DC COC DISANT CONTENIR EXPLOSIF DE MINE - BESC CIMP-445407 - DANGEREUX CL: 1.1D / UN: 0241',
    marquesEtNumeros: 'TCIU2085799 / XINU1643168',
    nombreColis: 1280,
    typeEmballage: 'CONTENEUR',
    poidsBrutKg: 33280,
    volumeM3: 0,
    conteneurs: [
      {
        numeroConteneur: 'TCIU2085799',
        typeConteneur: '20_DRY',
        numeroScelle: '3228127',
        poidsKg: 16640,
        tareKg: 2350,
        nombreColis: 640,
        montantCautionFcfa: 500000,
        statutLivraison: 'AU_PARC',
        isDangerous: true,
        socCoc: 'COC',
        dateEntreeParc: '2025-07-16T08:00:00Z'
      },
      {
        numeroConteneur: 'XINU1643168',
        typeConteneur: '20_DRY',
        numeroScelle: '3228130',
        poidsKg: 16640,
        tareKg: 2350,
        nombreColis: 640,
        montantCautionFcfa: 500000,
        statutLivraison: 'AU_PARC',
        isDangerous: true,
        socCoc: 'COC',
        dateEntreeParc: '2025-07-16T08:00:00Z'
      }
    ]
  },
  {
    numeroBL: 'UROABJ25022',
    shipperNom: 'DAVEY BICKFORD',
    shipperAdresse: 'LE MOULIN GASPARD, 89550 HERY, FRANCE',
    consigneeNom: 'EPC COTE D\'IVOIRE',
    consigneeAdresse: 'ABIDJAN COCODY CITE DES CADRES, VILLA 78, ABIDJAN COTE D\'IVOIRE',
    notifyNom: 'EPC COTE D\'IVOIRE',
    notifyAdresse: 'ABIDJAN COCODY CITE DES CADRES, VILLA 78, ABIDJAN COTE D\'IVOIRE',
    portChargementCode: 'FRURO',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '01 X40\'HC COC DISANT CONTENIR: EXPLOSIF DE MINE - BESC CIMP-445355 - DANGEREUX CL: 1.4S / UN: 0500',
    marquesEtNumeros: 'WAFU4511777 / SEAL 1005214',
    nombreColis: 1449,
    typeEmballage: 'CONTENEUR',
    poidsBrutKg: 8818.2,
    volumeM3: 0,
    conteneurs: [
      {
        numeroConteneur: 'WAFU4511777',
        typeConteneur: '40_HC',
        numeroScelle: '1005214',
        poidsKg: 8818.2,
        tareKg: 3900,
        nombreColis: 1449,
        montantCautionFcfa: 1000000,
        statutLivraison: 'AU_PARC',
        isDangerous: true,
        socCoc: 'COC',
        dateEntreeParc: '2025-07-16T08:00:00Z'
      }
    ]
  },
  {
    numeroBL: 'UROABJ25023',
    shipperNom: 'LEEHO SAS',
    shipperAdresse: '88 B CHEMIEN DE CROISSET, 76380 CANTELEU, FRANCE',
    consigneeNom: 'AFRICA -DIST CI',
    consigneeAdresse: 'COCODY LES DEUX PLATEAUX 7E TRANCHE BP:1676 ABIDJAN 28 (N°IMPORTATEUR C61102475)',
    notifyNom: 'AFRICA -DIST CI',
    notifyAdresse: 'COCODY LES DEUX PLATEAUX 7E TRANCHE BP:1676 ABIDJAN 28 COTE D\'IVOIRE',
    portChargementCode: 'FRURO',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '01X20\'DRY SOC DERNIER VOYAGE STC PIECES DETACHEES BTP ET DIVERS',
    marquesEtNumeros: 'CINU1625918 / SEAL 497991',
    nombreColis: 35,
    typeEmballage: 'CONTENEUR',
    poidsBrutKg: 14896,
    volumeM3: 0,
    conteneurs: [
      {
        numeroConteneur: 'CINU1625918',
        typeConteneur: '20_DRY',
        numeroScelle: '497991',
        poidsKg: 14896,
        tareKg: 2350,
        nombreColis: 35,
        montantCautionFcfa: 0,
        statutLivraison: 'AU_PARC',
        isDangerous: false,
        socCoc: 'SOC',
        dateEntreeParc: '2025-07-16T08:00:00Z'
      }
    ]
  },
  {
    numeroBL: 'UROABJ25024',
    shipperNom: 'TITANOBEL',
    shipperAdresse: 'RUE DE L\'INDUSTRIE BP 15, 21270 PONTAILLER SUR SAONE, FRANCE',
    consigneeNom: 'CADERAC SA',
    consigneeAdresse: 'PK 44-AUTOROUTE DU NORD, 10 BP 1667 ABIDJAN 10, COTE D\'IVOIRE',
    notifyNom: 'CADERAC SA',
    notifyAdresse: 'PK 44-AUTOROUTE DU NORD, 10 BP 1667 ABIDJAN 10, COTE D\'IVOIRE',
    portChargementCode: 'FRURO',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: '01 X 20\'DV COC DISANT CONTENIR: EXPLOSIF DE MINE - BESC CIMP-445892 - DANGEREUX CL: 1.1D / UN: 0241, CL: 1.4S / UN: 0500',
    marquesEtNumeros: 'CPWU2061201 / SEALS 448328 & 003019',
    nombreColis: 759,
    typeEmballage: 'CONTENEUR',
    poidsBrutKg: 17483,
    volumeM3: 0,
    conteneurs: [
      {
        numeroConteneur: 'CPWU2061201',
        typeConteneur: '20_DRY',
        numeroScelle: '448328 / 003019',
        poidsKg: 17483,
        tareKg: 2350,
        nombreColis: 759,
        montantCautionFcfa: 500000,
        statutLivraison: 'AU_PARC',
        isDangerous: true,
        socCoc: 'COC',
        dateEntreeParc: '2025-07-16T08:00:00Z'
      }
    ]
  }
];

async function main() {
  if (!dbUrl) {
    console.error("Aucune URL de base de données trouvée dans .env.local ou environnement.");
    return;
  }
  const sql = neon(dbUrl);
  const escaleId = BOCS_BREMEN_25586_ESCALE.id;

  console.log(`Nettoyage des données existantes pour l'escale ${escaleId}...`);
  const oldBls = await sql`SELECT id FROM bls WHERE escale_id = ${escaleId};`;
  for (const b of oldBls) {
    await sql`DELETE FROM containers WHERE bl_id = ${b.id};`;
  }
  await sql`DELETE FROM bls WHERE escale_id = ${escaleId};`;
  await sql`DELETE FROM escales WHERE id = ${escaleId};`;

  console.log(`Insertion de l'escale ${BOCS_BREMEN_25586_ESCALE.nomNavire} (Voyage ${BOCS_BREMEN_25586_ESCALE.numeroVoyage})...`);
  await sql`
    INSERT INTO escales (
      id, nom_navire, callsign, numero_voyage, port_chargement, port_dechargement, date_arrivee, date_depart, statut, created_by
    ) VALUES (
      ${escaleId},
      ${BOCS_BREMEN_25586_ESCALE.nomNavire},
      ${BOCS_BREMEN_25586_ESCALE.callsign},
      ${BOCS_BREMEN_25586_ESCALE.numeroVoyage},
      ${BOCS_BREMEN_25586_ESCALE.portChargement},
      ${BOCS_BREMEN_25586_ESCALE.portDechargement},
      ${BOCS_BREMEN_25586_ESCALE.dateArrivee},
      ${BOCS_BREMEN_25586_ESCALE.dateDepart || null},
      ${BOCS_BREMEN_25586_ESCALE.statut},
      ${BOCS_BREMEN_25586_ESCALE.createdBy || 'BOCS Import'}
    );
  `;

  console.log(`Insertion des 18 BLs et conteneurs...`);
  for (let idx = 0; idx < BOCS_BREMEN_25586_BLS_DATA.length; idx++) {
    const item = BOCS_BREMEN_25586_BLS_DATA[idx];
    const blId = escaleId * 1000 + idx + 1;

    await sql`
      INSERT INTO bls (
        id, escale_id, numero_bl, type_operation, shipper_nom, shipper_adresse,
        consignee_nom, consignee_adresse, notify_nom, notify_adresse,
        port_chargement_code, port_dechargement_code, destination_finale,
        description_goods, nombre_colis, type_emballage, poids_brut_kg,
        volume_m3, statut_import, marques_et_numeros
      ) VALUES (
        ${blId},
        ${escaleId},
        ${item.numeroBL},
        'IMPORT',
        ${item.shipperNom},
        ${item.shipperAdresse},
        ${item.consigneeNom},
        ${item.consigneeAdresse},
        ${item.notifyNom},
        ${item.notifyAdresse},
        ${item.portChargementCode},
        ${item.portDechargementCode},
        ${item.destinationFinale},
        ${item.descriptionGoods},
        ${item.nombreColis},
        ${item.typeEmballage},
        ${item.poidsBrutKg},
        ${item.volumeM3},
        'EN_ATTENTE',
        ${item.marquesEtNumeros}
      );
    `;

    if (item.conteneurs && item.conteneurs.length > 0) {
      for (let cIdx = 0; cIdx < item.conteneurs.length; cIdx++) {
        const c = item.conteneurs[cIdx];
        const containerId = escaleId * 10000 + idx * 100 + cIdx + 1;

        await sql`
          INSERT INTO containers (
            id, bl_id, numero_conteneur, type_conteneur, numero_scelle,
            poids_kg, tare_kg, nombre_colis, date_entree_parc,
            montant_caution_fcfa, statut_livraison, is_dangerous, soc_coc
          ) VALUES (
            ${containerId},
            ${blId},
            ${c.numeroConteneur},
            ${c.typeConteneur},
            ${c.numeroScelle},
            ${c.poidsKg},
            ${c.tareKg},
            ${c.nombreColis},
            ${c.dateEntreeParc || '2025-07-16T08:00:00Z'},
            ${c.montantCautionFcfa},
            ${c.statutLivraison || 'AU_PARC'},
            ${c.isDangerous || false},
            ${c.socCoc || 'COC'}
          );
        `;
      }
    }
  }

  console.log(`✅ Synchronisation réussie : Escale BOCS BREMEN et ${BOCS_BREMEN_25586_BLS_DATA.length} BLs insérés.`);
}

main().catch(err => {
  console.error("Erreur de synchronisation:", err);
  process.exit(1);
});
