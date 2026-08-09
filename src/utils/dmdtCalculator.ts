import { Container, ContainerType, TarifSurestarie, FranchiseSurestarie } from '../types';

export interface DmdtCalculationResult {
  containerId: number;
  numeroConteneur: string;
  typeConteneur: ContainerType;
  joursSejour: number;
  joursFranchise: number;
  joursSurestarie: number;
  montantSurestarieFcfa: number;
  cautionInitialeFcfa: number;
  cautionRestitueeFcfa: number;
  detailsCalcul: string[];
}

/**
 * Default franchises per container type if not configured in DB/admin
 */
export const DEFAULT_FRANCHISES: Record<ContainerType, number> = {
  '20_DRY': 7,
  '40_DRY': 7,
  '40_HC': 7,
  '20_REEFER': 5,
  '40_REEFER': 5,
  '20_OPEN_TOP': 7,
  '40_OPEN_TOP': 7,
  '20_FLAT_RACK': 7
};

/**
 * Default degressive tariffs per container type (FCFA / day)
 */
export const DEFAULT_TARIFS: TarifSurestarie[] = [
  // 20' DRY
  { id: 1, typeConteneur: '20_DRY', jourDebut: 8, jourFin: 15, tarifJournalierFcfa: 15000 },
  { id: 2, typeConteneur: '20_DRY', jourDebut: 16, jourFin: 30, tarifJournalierFcfa: 25000 },
  { id: 3, typeConteneur: '20_DRY', jourDebut: 31, jourFin: 999, tarifJournalierFcfa: 40000 },
  
  // 40' DRY & 40' HC
  { id: 4, typeConteneur: '40_HC', jourDebut: 8, jourFin: 15, tarifJournalierFcfa: 25000 },
  { id: 5, typeConteneur: '40_HC', jourDebut: 16, jourFin: 30, tarifJournalierFcfa: 45000 },
  { id: 6, typeConteneur: '40_HC', jourDebut: 31, jourFin: 999, tarifJournalierFcfa: 70000 },

  { id: 7, typeConteneur: '40_DRY', jourDebut: 8, jourFin: 15, tarifJournalierFcfa: 25000 },
  { id: 8, typeConteneur: '40_DRY', jourDebut: 16, jourFin: 30, tarifJournalierFcfa: 45000 },
  { id: 9, typeConteneur: '40_DRY', jourDebut: 31, jourFin: 999, tarifJournalierFcfa: 70000 },

  // 40' REEFER (Cold chain - higher rates)
  { id: 10, typeConteneur: '40_REEFER', jourDebut: 6, jourFin: 10, tarifJournalierFcfa: 45000 },
  { id: 11, typeConteneur: '40_REEFER', jourDebut: 11, jourFin: 20, tarifJournalierFcfa: 80000 },
  { id: 12, typeConteneur: '40_REEFER', jourDebut: 21, jourFin: 999, tarifJournalierFcfa: 120000 },

  // 20' REEFER
  { id: 13, typeConteneur: '20_REEFER', jourDebut: 6, jourFin: 10, tarifJournalierFcfa: 30000 },
  { id: 14, typeConteneur: '20_REEFER', jourDebut: 11, jourFin: 20, tarifJournalierFcfa: 55000 },
  { id: 15, typeConteneur: '20_REEFER', jourDebut: 21, jourFin: 999, tarifJournalierFcfa: 85000 },

  // Flat Rack & Open Top
  { id: 16, typeConteneur: '20_FLAT_RACK', jourDebut: 8, jourFin: 15, tarifJournalierFcfa: 20000 },
  { id: 17, typeConteneur: '20_FLAT_RACK', jourDebut: 16, jourFin: 999, tarifJournalierFcfa: 35000 },
  { id: 18, typeConteneur: '20_OPEN_TOP', jourDebut: 8, jourFin: 15, tarifJournalierFcfa: 20000 },
  { id: 19, typeConteneur: '20_OPEN_TOP', jourDebut: 16, jourFin: 999, tarifJournalierFcfa: 35000 },
  { id: 20, typeConteneur: '40_OPEN_TOP', jourDebut: 8, jourFin: 15, tarifJournalierFcfa: 30000 },
  { id: 21, typeConteneur: '40_OPEN_TOP', jourDebut: 16, jourFin: 999, tarifJournalierFcfa: 55000 }
];

/**
 * Calculates Surestaries (Dmdt) for a container based on stay dates and tariffs
 */
export function calculateContainerDmdt(
  container: Container,
  tarifsList: TarifSurestarie[] = DEFAULT_TARIFS,
  franchisesList: FranchiseSurestarie[] = []
): DmdtCalculationResult {
  const dateEntree = container.dateEntreeParc ? new Date(container.dateEntreeParc) : new Date();
  const dateSortie = container.dateSortieParc ? new Date(container.dateSortieParc) : new Date();

  // Calculate days of stay (inclusive of end day or calendar difference)
  const diffTime = Math.abs(dateSortie.getTime() - dateEntree.getTime());
  const joursSejour = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Find franchise for container type
  const userFranchise = franchisesList.find(f => f.typeConteneur === container.typeConteneur);
  const joursFranchise = userFranchise ? userFranchise.joursFranchise : (DEFAULT_FRANCHISES[container.typeConteneur] || 7);

  const joursSurestarie = Math.max(0, joursSejour - joursFranchise);
  
  let montantSurestarieFcfa = 0;
  const detailsCalcul: string[] = [];

  if (joursSurestarie > 0) {
    // Filter matching tariffs for this container type
    const matchingTarifs = tarifsList
      .filter(t => t.typeConteneur === container.typeConteneur)
      .sort((a, b) => a.jourDebut - b.jourDebut);

    if (matchingTarifs.length === 0) {
      // Fallback tariff if none defined
      const fallbackRate = container.typeConteneur.includes('20') ? 20000 : 35000;
      montantSurestarieFcfa = joursSurestarie * fallbackRate;
      detailsCalcul.push(`${joursSurestarie} jours x ${fallbackRate.toLocaleString('fr-FR')} FCFA = ${montantSurestarieFcfa.toLocaleString('fr-FR')} FCFA`);
    } else {
      // Calculate day-by-day across degressive tiers
      for (let day = joursFranchise + 1; day <= joursSejour; day++) {
        const tier = matchingTarifs.find(t => day >= t.jourDebut && day <= t.jourFin) || matchingTarifs[matchingTarifs.length - 1];
        const rate = tier ? tier.tarifJournalierFcfa : 25000;
        montantSurestarieFcfa += rate;
      }
      detailsCalcul.push(`Séjour: ${joursSejour} jours (${joursFranchise} jours franchise + ${joursSurestarie} jours facturables)`);
      detailsCalcul.push(`Total Surestaries: ${montantSurestarieFcfa.toLocaleString('fr-FR')} FCFA`);
    }
  } else {
    detailsCalcul.push(`Séjour de ${joursSejour} jours au parc ≤ Franchise de ${joursFranchise} jours. Aucune surestarie due.`);
  }

  const cautionInitiale = container.montantCautionFcfa || (container.typeConteneur.includes('20') ? 500000 : 1000000);
  const cautionRestitueeFcfa = Math.max(0, cautionInitiale - montantSurestarieFcfa);

  return {
    containerId: container.id,
    numeroConteneur: container.numeroConteneur,
    typeConteneur: container.typeConteneur,
    joursSejour,
    joursFranchise,
    joursSurestarie,
    montantSurestarieFcfa,
    cautionInitialeFcfa: cautionInitiale,
    cautionRestitueeFcfa,
    detailsCalcul
  };
}

/**
 * Calculates total DMDT for an array of containers
 */
export function calculateTotalDmdt(
  containers: Container[],
  dateReference?: string,
  tarifsList: TarifSurestarie[] = DEFAULT_TARIFS
): { totalSurestarieFcfa: number; conteneursCalculated: DmdtCalculationResult[] } {
  let totalSurestarieFcfa = 0;
  const conteneursCalculated = (containers || []).map(ctn => {
    const ctnWithDate = dateReference ? { ...ctn, dateSortieParc: dateReference } : ctn;
    const res = calculateContainerDmdt(ctnWithDate, tarifsList);
    totalSurestarieFcfa += res.montantSurestarieFcfa;
    return res;
  });

  return { totalSurestarieFcfa, conteneursCalculated };
}

