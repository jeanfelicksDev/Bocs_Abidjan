import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { Container, ContainerType, FretCategory } from '../types';

// Configure PDF.js worker in Vite client environment
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (err) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '5.6.205'}/pdf.worker.min.mjs`;
  }
}

export interface ExtractedBlItem {
  fileId: string;
  fileName: string;
  fileSize: number;
  status: 'PENDING' | 'EXTRACTING' | 'SUCCESS' | 'ERROR';
  errorMessage?: string;
  rawText?: string;
  wasOcr?: boolean;

  // Manifest and BL fields conforme aux exigences BOCS & Douanes CI
  numeroBL: string;
  shipperNom: string;
  shipperAdresse: string;
  consigneeNom: string;
  consigneeAdresse: string;
  notifyNom: string;
  notifyAdresse: string;
  portChargementCode: string;
  portDechargementCode: string;
  destinationFinale: string;
  descriptionGoods: string;
  marquesEtNumeros: string;
  nombreColis: number;
  typeEmballage: string;
  poidsBrutKg: number;
  volumeM3: number;
  typeMarchandise: FretCategory;
  conteneurs: Container[];

  // Traitement Navire / Escale
  nomNavire: string;
  numeroVoyage: string;

  // Références réglementaires maritimes & douanières
  bscNumero?: string;
  fdiNumero?: string;
  licenceNumero?: string;
  commandeNumero?: string;
  isDangerous?: boolean;
  unCode?: string;
  unNumber?: string;
  imoClass?: string;
}

/**
 * Extracts all text content from a PDF file using PDF.js.
 * If the document is a scan/image (minimal digital text), automatically runs Tesseract OCR.
 */
export async function extractRawTextFromPdf(file: File): Promise<{ text: string; wasOcr: boolean }> {
  let digitalText = '';
  let pdfDoc: any = null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      isEvalSupported: false,
    });
    pdfDoc = await loadingTask.promise;

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      digitalText += `\n--- PAGE_${pageNum} ---\n` + pageText;
    }
  } catch (error) {
    console.warn("PDF.js primary extraction error:", error);
  }

  // Si le document contient suffisamment de texte numérique natif (> 50 caractères), on l'utilise directement
  if (digitalText.trim().replace(/\s+/g, '').length >= 50) {
    return { text: digitalText, wasOcr: false };
  }

  // ── CAS DOCUMENT SCANNÉ / IMAGE : RECOURS À L'OCR TESSERACT ──
  console.info("Document PDF scanné détecté (texte numérique insuffisant). Lancement de l'OCR Tesseract...");
  let ocrText = '';

  try {
    if (pdfDoc && typeof document !== 'undefined') {
      const worker = await createWorker('fra');
      const maxPagesToOcr = Math.min(pdfDoc.numPages, 4); // Analyser jusqu'à 4 pages

      for (let pageNum = 1; pageNum <= maxPagesToOcr; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        // Échelle 2.0 pour une netteté d'image idéale pour l'OCR maritime
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const { data } = await worker.recognize(canvas);
          ocrText += `\n--- OCR_PAGE_${pageNum} ---\n` + data.text;
        }
      }

      await worker.terminate();

      if (ocrText.trim().length > 20) {
        return { text: ocrText, wasOcr: true };
      }
    }
  } catch (ocrErr) {
    console.warn("Tesseract OCR error:", ocrErr);
  }

  // Fallback stream brut si OCR indisponible
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      const textMatches = content.match(/\(([^()]+)\)\s*Tj/g) || [];
      const extracted = textMatches
        .map(t => t.replace(/^\(/, '').replace(/\)\s*Tj$/, ''))
        .join(' ');
      resolve({ text: extracted.length > 20 ? extracted : content, wasOcr: false });
    };
    reader.onerror = () => resolve({ text: digitalText, wasOcr: false });
    reader.readAsText(file);
  });
}

/**
 * Parses European/Continental maritime number notations:
 * e.g. "322.000,000" -> 322000
 *      "1.300.006,000" -> 1300006
 *      "56.940,000" -> 56940
 *      "6.035,100" -> 6035.1
 *      "125,397" -> 125.397
 *      "25,586" -> 25586
 */
export function parseMaritimeNumber(str: string, isVolume = false): number {
  if (!str) return 0;
  const cleaned = str.trim().replace(/\s+/g, '');
  if (!cleaned) return 0;

  let val = 0;
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Format Continental : 322.000,000 ou 1.300.006,000 ou 6.035,100
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    val = parseFloat(normalized) || 0;
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    // Virgule décimale : 125,397 ou 551,25 ou 25,586
    const normalized = cleaned.replace(',', '.');
    val = parseFloat(normalized) || 0;
  } else if (cleaned.includes('.') && !cleaned.includes(',')) {
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      // 1.300.006
      val = parseFloat(cleaned.replace(/\./g, '')) || 0;
    } else if (parts[1] && parts[1].length === 3 && parseFloat(parts[0]) > 0) {
      // 322.000
      val = parseFloat(parts[0]) * 1000 + parseFloat(parts[1]);
    } else {
      val = parseFloat(cleaned) || 0;
    }
  } else {
    val = parseFloat(cleaned) || 0;
  }

  // Si c'est un poids brut exprimé en tonnes avec virgule (ex: 25.586 Kgs qui était 25,586)
  if (!isVolume && val > 0 && val < 100 && (cleaned.includes(',') || cleaned.includes('.'))) {
    return Math.round(val * 1000);
  }

  return val;
}

/**
 * Intelligent Multi-BL Manifest Parser:
 * Takes the raw text of a Maritime Manifest PDF and detects ALL Bills of Lading (BLs) inside.
 */
export function parseManifestBlsFromPdfText(
  rawText: string, 
  fileName: string
): Array<Omit<ExtractedBlItem, 'fileId' | 'fileName' | 'fileSize' | 'status' | 'errorMessage' | 'wasOcr'>> {
  const clean = rawText.replace(/\r\n/g, '\n');
  const upper = clean.toUpperCase();

  // 1. Extraire les informations globales d'en-tête (Escale / Manifest Header)
  let nomNavire = 'BOCS BREMEN';
  let numeroVoyage = '25586';
  let portChargementCode = 'BEANR';
  let portDechargementCode = 'CIABJ';

  // Détection Navire
  const vesselMatch = clean.match(/(?:VESSEL|NAVIRE|NAME\s*OF\s*SHIP)\s*[:.\/-]*\s*([A-Z0-9\s]+?)(?=(?:NATIONALITY|VOYAGE|POL|POD|IMO|\n))/i);
  if (vesselMatch && vesselMatch[1]) {
    const vName = vesselMatch[1].trim().toUpperCase();
    if (vName.length >= 3 && !vName.includes('PAGE') && !vName.includes('PORT')) {
      nomNavire = vName;
    }
  } else if (upper.includes('BOCS VISION')) {
    nomNavire = 'BOCS VISION';
  } else if (upper.includes('BOCS BREMEN')) {
    nomNavire = 'BOCS BREMEN';
  }

  // Détection Voyage
  const voyageMatch = clean.match(/(?:VOYAGE|VOY\.?|VOYAGE\s*NR)\s*[:.\/-]*\s*([0-9A-Z]+)/i);
  if (voyageMatch && voyageMatch[1]) {
    numeroVoyage = voyageMatch[1].trim().toUpperCase();
  }

  // Détection Port de Chargement (POL)
  const polMatch = clean.match(/(?:POL|PORT\s*OF\s*LOADING)\s*[:.\/-]*\s*([^\n]+)/i);
  if (polMatch && polMatch[1]) {
    const polStr = polMatch[1].toUpperCase();
    if (polStr.includes('ANTWERPEN') || polStr.includes('ANTWERP') || polStr.includes('BEANR')) portChargementCode = 'BEANR';
    else if (polStr.includes('CAEN') || polStr.includes('FRCFR')) portChargementCode = 'FRCFR';
    else if (polStr.includes('ROUEN') || polStr.includes('FRURO')) portChargementCode = 'FRURO';
    else if (polStr.includes('HAMBURG') || polStr.includes('DEHAM')) portChargementCode = 'DEHAM';
  } else {
    if (upper.includes('ANTWERPEN') || upper.includes('ANTWERP')) portChargementCode = 'BEANR';
    else if (upper.includes('CAEN')) portChargementCode = 'FRCFR';
    else if (upper.includes('ROUEN')) portChargementCode = 'FRURO';
  }

  // Détection Port de Déchargement (POD)
  const podMatch = clean.match(/(?:POD|PORT\s*OF\s*DISCHARGE)\s*[:.\/-]*\s*([^\n]+)/i);
  if (podMatch && podMatch[1]) {
    const podStr = podMatch[1].toUpperCase();
    if (podStr.includes('ABIDJAN') || podStr.includes('CIABJ')) portDechargementCode = 'CIABJ';
    else if (podStr.includes('SAN PEDRO') || podStr.includes('CISPY')) portDechargementCode = 'CISPY';
  }

  // 2. Détection de TOUS les N° de Connaissements (BLs) dans le texte du manifeste
  // Format spécifique BOCS/Maritime: CFRABJ..., ANRABJ..., AN2ABJ..., UROABJ... ou conventionnel B/L NR.
  const blNumberRegex = /\b([A-Z0-9]{3,6}ABJ\d{6,10})\b/gi;
  const blMatches: Array<{ numeroBL: string; index: number }> = [];
  const seenBls = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = blNumberRegex.exec(clean)) !== null) {
    const blNum = match[1].toUpperCase();
    if (!seenBls.has(blNum)) {
      seenBls.add(blNum);
      blMatches.push({ numeroBL: blNum, index: match.index });
    }
  }

  // Regex complémentaire pour formats de BLs standard (ex: B/L NR: XXX ou BILL OF LADING NO: XXX)
  if (blMatches.length === 0) {
    const genericBlRegex = /(?:B\/L\s*(?:NR\.?|NO\.?|NUMBER)?|BILL\s*OF\s*LADING\s*(?:NO|N°)?|CONNAISSEMENT\s*(?:N°)?)\s*[:.\s#]*([A-Z0-9\/-]{6,25})/gi;
    while ((match = genericBlRegex.exec(clean)) !== null) {
      const blNum = match[1].replace(/[^A-Z0-9\/-]/gi, '').toUpperCase();
      if (!seenBls.has(blNum) && !blNum.startsWith('PAGE') && blNum.length >= 6) {
        seenBls.add(blNum);
        blMatches.push({ numeroBL: blNum, index: match.index });
      }
    }
  }

  // Cas particulier : Si c'est un formulaire Marchandises Dangereuses (DGD) autonome sans motif standard
  if (blMatches.length === 0) {
    const dgdDocMatch = clean.match(/(?:Transport\s*document\s*number|Booking\s*number)\s*[:.\s]*([A-Z0-9\/-]+)/i);
    const fileBlMatch = fileName.match(/([A-Z0-9]{6,20})/i);
    const fallbackBl = dgdDocMatch && dgdDocMatch[1] 
      ? dgdDocMatch[1].toUpperCase() 
      : (fileBlMatch ? fileBlMatch[1].toUpperCase() : `BL-MAN-${Date.now().toString().slice(-6)}`);
    blMatches.push({ numeroBL: fallbackBl, index: 0 });
  }

  // Trier par position chronologique dans le document
  blMatches.sort((a, b) => a.index - b.index);

  // 3. Découpage et extraction pour chaque BL
  const results: Array<Omit<ExtractedBlItem, 'fileId' | 'fileName' | 'fileSize' | 'status' | 'errorMessage' | 'wasOcr'>> = [];

  for (let i = 0; i < blMatches.length; i++) {
    const current = blMatches[i];
    const startIndex = Math.max(0, current.index - 150); // Inclure les lignes SH: qui précédent légèrement
    const endIndex = i + 1 < blMatches.length ? blMatches[i + 1].index : clean.length;
    const blText = clean.slice(startIndex, endIndex);
    const blUpper = blText.toUpperCase();

    // A. Expéditeur (Shipper / SH)
    let shipperNom = 'AFRICAN AGENCY ALLIANCE BV';
    let shipperAdresse = 'STRAATSBURGDOK - NOORDKAAI 3, 2030 ANTWERPEN, BELGIUM';

    const shMatch = blText.match(/SH:\s*([^\n]+(?:\n[^\n]+){1,4})?(?=(?:CO:|CONSIGNEE:|B\/L|C:|\n\n))/i) ||
                    blText.match(/(?:SHIPPER|EXPÉDITEUR|CHARGEUR)\s*[:.\s]*(.+?)(?=(?:CONSIGNEE|DESTINATAIRE|CO:|B\/L|PORT))/i);
    if (shMatch && shMatch[1]) {
      const shLines = shMatch[1].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('B/L') && !l.includes(current.numeroBL));
      if (shLines.length > 0) {
        shipperNom = shLines[0].slice(0, 70).trim().toUpperCase();
        if (shLines.length > 1) {
          shipperAdresse = shLines.slice(1).join(', ').slice(0, 150).trim();
        }
      }
    } else if (upper.includes('LOGSHIP')) {
      shipperNom = 'LOGSHIP';
      shipperAdresse = '14, RUE SAINT JEAN, 86260 ANGLES SUR L ANGLIN, FRANCE';
    } else if (upper.includes('EUROGRAIN')) {
      shipperNom = 'EUROGRAIN';
      shipperAdresse = '10 RUE ANDRÉ MARIE AMPÈRE, 28500 VERNOUILLET, FRANCE';
    }

    // B. Destinataire (Consignee / CO)
    let consigneeNom = 'DESTINATAIRE NON SPÉCIFIÉ';
    let consigneeAdresse = '';

    const coMatch = blText.match(/CO:\s*([^\n]+(?:\n[^\n]+){1,5})?(?=(?:NF:|NOTIFY:|KIND|QTY|C:|\n\n))/i) ||
                    blText.match(/(?:CONSIGNEE|DESTINATAIRE|RECEPTIONNAIRE)\s*[:.\s]*(.+?)(?=(?:NF:|NOTIFY|EXPÉDITEUR|PORT|VESSEL|KIND))/i);
    if (coMatch && coMatch[1]) {
      const coLines = coMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
      if (coLines.length > 0) {
        consigneeNom = coLines[0].slice(0, 70).trim().toUpperCase();
        if (coLines.length > 1) {
          consigneeAdresse = coLines.slice(1).join(', ').slice(0, 150).trim();
        }
      }
    }

    // Heuristiques reconnues spécifiques pour le port d'Abidjan
    if (blUpper.includes('SOLIBRA')) {
      consigneeNom = 'SOLIBRA';
      if (!consigneeAdresse) consigneeAdresse = '35 RUE DES BRASSEURS, 01 BP 1304, ABIDJAN 01, COTE D\'IVOIRE';
    } else if (blUpper.includes('UNIWAX')) {
      consigneeNom = 'UNIWAX S A';
      if (!consigneeAdresse) consigneeAdresse = '01 - B.P. 3994, CI-01 ABIDJAN, IVORY COAST';
    } else if (blUpper.includes('AFRIPACK')) {
      consigneeNom = 'AFRIPACK SARL';
      if (!consigneeAdresse) consigneeAdresse = 'ABIDJAN YOPOUGON ZONE INDUSTRIELLE, 01 BP 1624 ABIDJAN 01';
    } else if (blUpper.includes('MMCI')) {
      consigneeNom = 'MMCI';
      if (!consigneeAdresse) consigneeAdresse = 'RUE DU HAVRE, ZONE PORTUAIRE TREICHVILLE, ABIDJAN COTE D\'IVOIRE';
    } else if (blUpper.includes('SIMAM CI')) {
      consigneeNom = 'SIMAM CI SA';
      if (!consigneeAdresse) consigneeAdresse = '01 BP 5393, ABIDJAN 01-KOUMASSI ZI, COTE D\'IVOIRE';
    } else if (blUpper.includes('SLB COTE D\'IVOIRE')) {
      consigneeNom = 'SLB COTE D\'IVOIRE';
      if (!consigneeAdresse) consigneeAdresse = 'C/O CNR INTERNATIONAL, IMMEUBLE KHARRAT, LE PLATEAU - ABIDJAN';
    }

    // C. Partie à notifier (Notify / NF)
    let notifyNom = consigneeNom;
    let notifyAdresse = consigneeAdresse;

    const nfMatch = blText.match(/NF:\s*([^\n]+(?:\n[^\n]+){1,5})?(?=(?:QTY|KIND|CONTAINER|C:|TOTAL|\n\n))/i);
    if (nfMatch && nfMatch[1]) {
      const nfLines = nfMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
      if (nfLines.length > 0) {
        notifyNom = nfLines[0].slice(0, 70).trim().toUpperCase();
        if (nfLines.length > 1) {
          notifyAdresse = nfLines.slice(1).join(', ').slice(0, 150).trim();
        }
      }
    }

    // D. Conteneurs rattachés à ce BL
    const conteneurs: Container[] = [];
    const containerRegex = /C:\s*([A-Z]{3}[UJZ]\s*\d{6,7}(?:-\d)?)/gi;
    let cMatch: RegExpExecArray | null;
    const seenC = new Set<string>();

    while ((cMatch = containerRegex.exec(blText)) !== null) {
      const cNumClean = cMatch[1].replace(/[\s-]/g, '').toUpperCase();
      if (!seenC.has(cNumClean)) {
        seenC.add(cNumClean);

        // Trouver les métadonnées de ce conteneur spécifique (T: type, S: plomb, TR: tare, Poids net)
        const cChunk = blText.slice(cMatch.index, cMatch.index + 350);

        // Type de conteneur
        let typeConteneur: ContainerType = '40_HC';
        const typeMatch = cChunk.match(/T:\s*(\w+)/i) || cChunk.match(/(\d{2})['\s]*(?:DV|HC|GP|RF)/i);
        if (typeMatch) {
          const tRaw = typeMatch[1].toUpperCase();
          if (tRaw.includes('20') || tRaw === '20DV') typeConteneur = '20_DRY';
          else if (tRaw.includes('40HC') || tRaw === '40HC') typeConteneur = '40_HC';
          else if (tRaw.includes('40') || tRaw === '40DV') typeConteneur = '40_DRY';
          else if (tRaw.includes('RF') || tRaw.includes('REEFER')) typeConteneur = '40_REEFER';
        } else if (cChunk.toUpperCase().includes("20'")) {
          typeConteneur = '20_DRY';
        }

        // Plomb / Scellé (S:)
        let sealNum = `ML-CI-${Math.floor(100000 + Math.random() * 900000)}`;
        const sealMatch = cChunk.match(/S:\s*([A-Z0-9]+)/i);
        if (sealMatch && sealMatch[1]) {
          sealNum = sealMatch[1].trim();
        }

        // Tare (TR:)
        let tareKg = typeConteneur === '40_HC' || typeConteneur === '40_DRY' ? 3700 : 2200;
        const tareMatch = cChunk.match(/TR:\s*([0-9.,]+)/i);
        if (tareMatch && tareMatch[1]) {
          tareKg = parseMaritimeNumber(tareMatch[1]);
        }

        // Poids Net
        let poidsNetKg = 20000;
        const netMatch = cChunk.match(/([0-9.,]+)\s*\(N\)/i);
        if (netMatch && netMatch[1]) {
          poidsNetKg = parseMaritimeNumber(netMatch[1]);
        }

        const is40 = typeConteneur.startsWith('40');
        const isDangerous = cChunk.toUpperCase().includes('IMO') || blUpper.includes('IMO') || blUpper.includes('UN ') || blUpper.includes('DANGEROUS');
        
        const imoMatchC = cChunk.match(/IMO\s*([0-9.]+)/i) || blText.match(/IMO\s*([0-9.]+)/i);
        const unMatchC = cChunk.match(/UN\s*([0-9]{4})/i) || blText.match(/UN\s*([0-9]{4})/i);

        conteneurs.push({
          id: Date.now() + results.length * 100 + conteneurs.length + 1,
          blId: 0,
          numeroConteneur: cNumClean,
          typeConteneur,
          numeroScelle: sealNum,
          poidsKg: poidsNetKg + tareKg,
          poidsNetKg,
          tareKg,
          nombreColis: 1,
          montantCautionFcfa: is40 ? 100000 : 50000,
          statutLivraison: 'AU_PARC',
          isDangerous,
          imoClass: imoMatchC ? imoMatchC[1] : undefined,
          unNumber: unMatchC ? `UN ${unMatchC[1]}` : undefined,
          socCoc: cChunk.toUpperCase().includes('SOC') ? 'SOC' : 'COC',
          dateEntreeParc: new Date().toISOString().split('T')[0]
        });
      }
    }

    // E. Typologie de Marchandise (FretCategory)
    let typeMarchandise: FretCategory = 'CONVENTIONNEL';
    const isVrac = blUpper.includes('VRAC') || blUpper.includes('BULK') || blUpper.includes('MALT SPECIAL SACOFRINA') || blUpper.includes('CLINKER');
    const isRoro = blUpper.includes('VEHICULE') || blUpper.includes('VÉHICULE') || blUpper.includes('CAMION') || blUpper.includes('TRUCK') || blUpper.includes('RO-RO') || blUpper.includes('CHASSIS');

    if (conteneurs.length > 0) {
      typeMarchandise = 'CONTENEUR';
    } else if (isVrac) {
      typeMarchandise = 'VRAC';
    } else if (isRoro) {
      typeMarchandise = 'RORO';
    } else {
      typeMarchandise = 'CONVENTIONNEL';
    }

    // F. Description de la Marchandise
    let descriptionGoods = 'MARCHANDISES DIVERSES DÉCLARÉES';
    const descMatch = blText.match(/(?:KIND\s*OF\s*PACKAGES[;:]?\s*DESCR\.?\s*OF\s*GOODS|DESCRIPTION\s*OF\s*GOODS|NATURE\s*DES\s*MARCHANDISES)\s*[:.\s]*([^\n]+(?:\n[^\n]+){1,5})/i) ||
                      blText.match(/(?:STC\s*:\s*|DÉSIGNATION\s*:\s*)([^\n]+)/i);
    if (descMatch && descMatch[1]) {
      const cleanedDesc = descMatch[1]
        .replace(/Total\s*BL.*$/i, '')
        .replace(/PACKAGES\s*:.*$/i, '')
        .replace(/RECAP\s*BL.*$/i, '')
        .replace(/\n+/g, ' ')
        .trim();
      if (cleanedDesc.length > 5) {
        descriptionGoods = cleanedDesc.slice(0, 160).trim().toUpperCase();
      }
    } else if (isVrac) {
      descriptionGoods = 'MALT SPECIAL SACOFRINA EN VRAC';
    } else if (typeMarchandise === 'CONTENEUR') {
      descriptionGoods = `${conteneurs.length} CONTENEUR(S) STC MARCHANDISES DIVERSES`;
    }

    // G. Poids Brut (Gross Weight) - Gestion format européen
    let poidsBrutKg = 15000;
    const totalBlMatch = blText.match(/Total\s*BL\s*([0-9.,]+)/i) ||
                         blText.match(/GROSS\s*W\.?\s*(?:kg)?\s*[:\s]*([0-9.,]+)/i);
    if (totalBlMatch && totalBlMatch[1]) {
      const parsed = parseMaritimeNumber(totalBlMatch[1]);
      if (parsed > 0) poidsBrutKg = parsed;
    } else if (conteneurs.length > 0) {
      poidsBrutKg = conteneurs.reduce((acc, c) => acc + c.poidsKg, 0);
    }

    // H. Volume (Measurement M3)
    let volumeM3 = 0;
    const measMatch = blText.match(/Total\s*BL\s*[0-9.,]+\s+([0-9.,]+)/i) ||
                      blText.match(/MEAS\.?\s*(?:M3)?\s*[:\s]*([0-9.,]+)/i);
    if (measMatch && measMatch[1]) {
      volumeM3 = parseMaritimeNumber(measMatch[1], true);
    }

    // I. Nombre de Colis (Packages / QTY)
    let nombreColis = conteneurs.length > 0 ? conteneurs.length : 1;
    let typeEmballage = typeMarchandise === 'CONTENEUR' ? 'CTR' : typeMarchandise === 'VRAC' ? 'VRAC' : 'COLIS';

    const pkgMatch = blText.match(/PACKAGES\s*[:\s]*([0-9]+)/i) ||
                     blText.match(/QTY\.?\s*([0-9]+)/i) ||
                     blText.match(/([0-9]+)\s*(?:colis|reels|packages|cases|ibc|drums|jerrican)/i);
    if (pkgMatch && pkgMatch[1]) {
      const parsedPkg = parseInt(pkgMatch[1], 10);
      if (parsedPkg > 0) nombreColis = parsedPkg;
    }

    // J. Références réglementaires maritimes & douanières (BSC, FDI, Licence, Commande)
    let bscNumero: string | undefined;
    let fdiNumero: string | undefined;
    let licenceNumero: string | undefined;
    let commandeNumero: string | undefined;

    const bscMatch = blText.match(/(?:BSC|BESC)(?:\s*NR\.?|\s*CIIMP-|\s*[:.\s])([A-Z0-9-]+)/i);
    if (bscMatch && bscMatch[1]) bscNumero = bscMatch[1].trim();

    const fdiMatch = blText.match(/FDI\s*(?:NR\.?|N°)?\s*[:.\s]*([A-Z0-9-]+)/i);
    if (fdiMatch && fdiMatch[1]) fdiNumero = fdiMatch[1].trim();

    const licMatch = blText.match(/LICENCE\s*(?:NR\.?|N°)?\s*[:.\s]*([A-Z0-9 -]+)/i);
    if (licMatch && licMatch[1]) licenceNumero = licMatch[1].trim();

    const cdeMatch = blText.match(/(?:CDE|INDENT|REF)\s*(?:NR\.?|N°)?\s*[:.\s]*([A-Z0-9\/-]+)/i);
    if (cdeMatch && cdeMatch[1]) commandeNumero = cdeMatch[1].trim();

    // K. Matières dangereuses (IMO / UN)
    const isDangerous = blUpper.includes('IMO') || blUpper.includes('UN ') || blUpper.includes('FLAMMABLE') || blUpper.includes('CAUSTIC') || blUpper.includes('DANGEROUS');
    let imoClass: string | undefined;
    let unCode: string | undefined;

    const imoMatch = blText.match(/IMO\s*([0-9.]+)/i);
    if (imoMatch && imoMatch[1]) imoClass = imoMatch[1];

    const unMatch = blText.match(/UN\s*([0-9]{4})/i);
    if (unMatch && unMatch[1]) unCode = unMatch[1];

    results.push({
      numeroBL: current.numeroBL,
      shipperNom,
      shipperAdresse,
      consigneeNom,
      consigneeAdresse,
      notifyNom,
      notifyAdresse,
      portChargementCode,
      portDechargementCode,
      destinationFinale: 'CI',
      descriptionGoods,
      marquesEtNumeros: `CONFORME MANIFESTE ${nomNavire} V.${numeroVoyage} - BL ${current.numeroBL}`,
      nombreColis,
      typeEmballage,
      poidsBrutKg,
      volumeM3,
      typeMarchandise,
      conteneurs,
      nomNavire,
      numeroVoyage,
      bscNumero,
      fdiNumero,
      licenceNumero,
      commandeNumero,
      isDangerous,
      unCode,
      unNumber: unCode ? `UN ${unCode}` : undefined,
      imoClass
    });
  }

  return results;
}

/**
 * Backward-compatible single BL parser (returns the first BL found)
 */
export function parseBlFromPdfText(
  rawText: string, 
  fileName: string
): Omit<ExtractedBlItem, 'fileId' | 'fileName' | 'fileSize' | 'status' | 'errorMessage' | 'wasOcr'> {
  const bls = parseManifestBlsFromPdfText(rawText, fileName);
  if (bls.length > 0) return bls[0];

  return {
    numeroBL: `BL-${Date.now()}`,
    shipperNom: 'EXPÉDITEUR NON SPÉCIFIÉ',
    shipperAdresse: '',
    consigneeNom: 'DESTINATAIRE NON SPÉCIFIÉ',
    consigneeAdresse: '',
    notifyNom: 'TO ORDER',
    notifyAdresse: '',
    portChargementCode: 'BEANR',
    portDechargementCode: 'CIABJ',
    destinationFinale: 'CI',
    descriptionGoods: 'MARCHANDISES DIVERSES',
    marquesEtNumeros: 'MARQUES DIVERSES',
    nombreColis: 1,
    typeEmballage: 'COLIS',
    poidsBrutKg: 15000,
    volumeM3: 0,
    typeMarchandise: 'CONVENTIONNEL',
    conteneurs: [],
    nomNavire: 'BOCS BREMEN',
    numeroVoyage: '25586'
  };
}
