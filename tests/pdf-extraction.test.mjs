// Extraction des manifestes / BL PDF sur les documents réels de samples/pdf.
// Lancer : node --test tests/pdf-extraction.test.mjs
// Les PDF contiennent des données clients : ils ne sont pas versionnés. Sans eux,
// les tests sur documents sont ignorés (les tests unitaires tournent toujours).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readNativePages, isScannedPage } from '../src/utils/pdf/pdfText.ts';
import { ocrPage } from '../src/utils/pdf/ocr.ts';
import { isValidContainerNumber, parseMaritimeNumber, containerType, parseSeals } from '../src/utils/pdf/layout.ts';
import { isCargoManifest, parseCargoManifest } from '../src/utils/pdf/cargoManifest.ts';
import { isBimcoBl, parseBimcoBl } from '../src/utils/pdf/bimcoBl.ts';
import { pageScanImage } from './helpers/pdfImages.mjs';

const SAMPLES = new URL('../samples/pdf/', import.meta.url);
const sample = (name) => new URL(name, SAMPLES);
const has = (name) => existsSync(sample(name));

async function openPdf(name) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(sample(name))), isEvalSupported: false }).promise;
  return { doc, pages: await readNativePages(doc) };
}

// ── Unitaires ───────────────────────────────────────────────────────────────

test('nombres maritimes : séparateurs continentaux, aucune conversion implicite', () => {
  assert.equal(parseMaritimeNumber('142.500,000'), 142500);
  assert.equal(parseMaritimeNumber('2.908,380'), 2908.38);
  assert.equal(parseMaritimeNumber('727,650'), 727.65);
  assert.equal(parseMaritimeNumber('2908.38'), 2908.38);
  assert.equal(parseMaritimeNumber('1.300.006'), 1300006);
  assert.equal(parseMaritimeNumber('25,586'), 25.586); // plus de « ×1000 » deviné
});

test('conteneurs : clé ISO 6346, type, plombs multiples', () => {
  assert.ok(isValidContainerNumber('WAFU2010816'));
  assert.ok(!isValidContainerNumber('WAFU2010817'));
  assert.equal(containerType('20DV'), '20_DRY');
  assert.equal(containerType("40' HC"), '40_HC');
  assert.equal(containerType('40RF'), '40_REEFER');
  assert.deepEqual(parseSeals('3606 / 3607'), ['3606', '3607']);
  assert.deepEqual(parseSeals('ML123456, CUS998877'), ['ML123456', 'CUS998877']);
});

// ── Manifeste BOCS conventionnel (Anvers → Abidjan, transit Burkina) ────────

const CM = 'CM - ANTWERP - ABIDJAN TRANSIT BURKINA FASO - MV BOCS VISION 26607.pdf';
test('manifeste BOCS conventionnel : 2 BL complets', { skip: !has(CM) }, async () => {
  const { pages } = await openPdf(CM);
  assert.ok(isCargoManifest(pages));
  const bls = parseCargoManifest(pages);
  assert.equal(bls.length, 2);

  const [wagons, tôles] = bls;
  assert.equal(wagons.numeroBL, 'ANRABJ26607105');
  assert.equal(wagons.shipperNom, 'AFRICAN AGENCY ALLIANCE BV');
  assert.equal(wagons.shipperAdresse, 'STRAATSBURGDOK - NOORDKAAI 3, 2030 ANTWERPEN, BELGIUM');
  assert.equal(wagons.consigneeNom, 'SITARAIL');
  assert.equal(wagons.consigneeAdresse, 'PLACE TIEFO AMORO, BP 311 BOBO-DIOULASSO, BURKINA FASO');
  assert.equal(wagons.notifyNom, 'SITARAIL');
  assert.equal(wagons.poidsBrutKg, 142500);
  assert.equal(wagons.volumeM3, 727.65);
  assert.equal(wagons.nombreColis, 5);
  assert.equal(wagons.typeMarchandise, 'RORO');
  assert.match(wagons.descriptionGoods, /^SETS DE 2 WAGONS PLAT/);
  assert.equal(wagons.bscNumero, 'BF2601efa3');
  assert.equal(wagons.destinationFinale, 'BF');
  assert.equal(wagons.portChargementCode, 'BEANR');
  assert.equal(wagons.portDechargementCode, 'CIABJ');
  assert.equal(wagons.nomNavire, 'BOCS VISION');
  assert.equal(wagons.numeroVoyage, '26607');
  assert.deepEqual(wagons.aVerifier, []);

  assert.equal(tôles.numeroBL, 'ANRABJ26607106');
  assert.equal(tôles.consigneeNom, 'TREFIMA SARL');
  assert.equal(tôles.consigneeAdresse, '12 SECTION IP LOT 02 PARCELLE, 01BP 1357 BOBO DIOULASSO 01, BURKINA FASO');
  assert.equal(tôles.poidsBrutKg, 80785);
  assert.equal(tôles.nombreColis, 41);
  assert.equal(tôles.typeMarchandise, 'CONVENTIONNEL');
  assert.equal(tôles.marquesEtNumeros, 'TREFIMA ABIDJAN');
  assert.equal(tôles.bscNumero, 'BF2601f048');
  assert.match(tôles.descriptionGoods, /TÔLES D'ACIER LAMINÉES À CHAUD/);
  assert.doesNotMatch(tôles.descriptionGoods, /FREIGHT PREPAID|ECTN/);
});

// ── Manifeste BOCS conteneur (Rouen → Abidjan) ──────────────────────────────

const MANIFEST_ABJ = 'Manifest_ABJ_BOCSVISION_26607.pdf';
test('manifeste BOCS conteneur : plomb, poids brut, tare par conteneur', { skip: !has(MANIFEST_ABJ) }, async () => {
  const { pages } = await openPdf(MANIFEST_ABJ);
  const [bl, ...rest] = parseCargoManifest(pages);
  assert.equal(rest.length, 0);
  assert.equal(bl.numeroBL, 'UROABJ26607201');
  assert.equal(bl.shipperNom, "OTS P/C MOVIS COTE D'IVOIRE");
  assert.equal(bl.consigneeNom, 'IVORY AUTO PARTS ( I.A.P.)');
  assert.equal(bl.notifyNom, "MOVIS COTE D'IVOIRE");
  assert.equal(bl.portChargementCode, 'FRURO');
  assert.equal(bl.typeMarchandise, 'CONTENEUR');
  assert.equal(bl.poidsBrutKg, 2908.38);
  assert.equal(bl.poidsTotalAvecTareKg, 5008.38);
  assert.equal(bl.bscNumero, 'CIIMP-556858');
  assert.equal(bl.conteneurs.length, 1);
  const [c] = bl.conteneurs;
  assert.equal(c.numeroConteneur, 'WAFU2010816');
  assert.equal(c.typeConteneur, '20_DRY');
  assert.equal(c.numeroScelle, '3606');
  assert.equal(c.poidsKg, 2908.38);
  assert.equal(c.tareKg, 2100);
  assert.equal(c.nombreColis, 22);
  assert.equal(c.socCoc, 'COC');
  assert.deepEqual(bl.aVerifier, []);
});

// ── BL BIMCO numérique (libellés dans le fond de page) ──────────────────────

const BL_ABJ = 'BL_ABJ_BOCSVISION_26607.pdf';
test('BL BIMCO numérique : lecture par zones', { skip: !has(BL_ABJ) }, async () => {
  const { pages } = await openPdf(BL_ABJ);
  assert.ok(!isCargoManifest(pages));
  assert.ok(isBimcoBl(pages));
  const [bl] = parseBimcoBl(pages);
  assert.equal(bl.numeroBL, 'UROABJ26607201');
  assert.equal(bl.referenceNumero, '26200237');
  assert.equal(bl.shipperNom, "OTS P/C MOVIS COTE D'IVOIRE");
  assert.equal(bl.shipperAdresse, '31 RUE BOBBY SANDS, 44813 SAINT HERBLAIN');
  assert.equal(bl.consigneeNom, 'IVORY AUTO PARTS ( I.A.P.)');
  assert.equal(bl.notifyNom, "MOVIS COTE D'IVOIRE");
  assert.equal(bl.nomNavire, 'BOCS VISION');
  assert.equal(bl.numeroVoyage, '26607');
  assert.equal(bl.portChargementCode, 'FRURO');
  assert.equal(bl.portDechargementCode, 'CIABJ');
  assert.equal(bl.poidsBrutKg, 2908.38);
  assert.equal(bl.dateEmbarquement, '26/05/2026');
  assert.equal(bl.conteneurs[0].numeroConteneur, 'WAFU2010816');
  assert.equal(bl.conteneurs[0].numeroScelle, '3606');
  assert.equal(bl.conteneurs[0].tareKg, 2100);
  assert.deepEqual(bl.aVerifier, []);
});

// ── BL BIMCO scanné : OCR (≈ 20 s) ──────────────────────────────────────────

const SCAN = 'BL ANR-ABJ TRANSIT BURKINA FASO - BOCS VISION 26607.pdf';
test('BL BIMCO scanné : OCR des 2 BL, noms tamponnés sur les libellés', { skip: !has(SCAN), timeout: 180_000 }, async () => {
  const { createWorker } = await import('tesseract.js');
  const { doc, pages } = await openPdf(SCAN);
  assert.ok(pages.every(isScannedPage));
  const worker = await createWorker('eng');
  try {
    for (let i = 0; i < pages.length; i++) {
      const page = await doc.getPage(i + 1);
      const img = await pageScanImage(page);
      pages[i] = await ocrPage(worker, img.png, i + 1, pages[i].width, pages[i].height, img.width / pages[i].width);
    }
  } finally {
    await worker.terminate();
  }
  const bls = parseBimcoBl(pages, true);
  assert.equal(bls.length, 2);

  const [a, b] = bls;
  assert.equal(a.numeroBL, 'ANRABJ26607105');
  assert.equal(a.shipperNom, 'UNICAF');
  assert.equal(a.shipperAdresse, '33 QUAI DE DION BOUTON, 92800 PUTEAUX, FRANCE');
  assert.equal(a.consigneeNom, 'SITARAIL');
  assert.equal(a.notifyNom, 'SITARAIL');
  assert.equal(a.nomNavire, 'BOCS VISION');
  assert.equal(a.portChargementCode, 'BEANR');
  assert.equal(a.poidsBrutKg, 142500);
  assert.equal(a.volumeM3, 373.511);
  assert.equal(a.nombreColis, 5);
  assert.equal(a.destinationFinale, 'BF');
  // Lecture OCR : le document est toujours à relire, et le nom peu sûr est signalé.
  assert.ok(a.aVerifier.some((f) => f.field === 'ocr'));
  assert.ok(a.aVerifier.some((f) => f.field === 'shipperNom'));

  assert.equal(b.numeroBL, 'ANRABJ26607106');
  assert.equal(b.shipperNom, 'NLMK PLATE SALES S.A');
  assert.equal(b.consigneeNom, 'TREFIMA SARL');
  assert.equal(b.notifyNom, 'TREFIMA SARL');
  assert.equal(b.poidsBrutKg, 80785);
  assert.equal(b.nombreColis, 41);
  assert.equal(b.marquesEtNumeros, 'TREFIMA ABIDJAN');
  assert.equal(b.bscNumero, 'BF2601f048');
});
