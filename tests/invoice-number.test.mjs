// Nomenclature des numéros de facture (utils/invoiceNumber).
// Lancer : node --test tests/invoice-number.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const N = await import('../src/utils/invoiceNumber.ts');
const { invoiceMatchesType } = await import('../src/utils/invoiceMatching.ts');

const vessels = [{ id: 1, nom: 'MSC ANA', callsign: '9V1', codeNavire: 'MANA' }];
const escales = [{ id: 10, nomNavire: 'MSC ANA', callsign: '9V1', numeroVoyage: '26607', vesselId: 1 }];
const bls = [{ id: 100, escaleId: 10, numeroBL: 'MEDUAB123456' }];
const types = [
  { id: '1', name: 'Caution' }, { id: '2', name: 'Echange' }, { id: '3', name: 'Telex' },
  { id: '6', name: 'Détention Import' }, { id: '7', name: 'Détention Export' }
];
const ctx = { bls, escales, vessels, invoiceTypeConfigs: types };
const parts = (over = {}) => ({
  statut: 'PF', typeName: 'Echange', vesselCode: N.resolveVesselCode(escales[0], vessels),
  voyage: '26607', numeroBL: 'MEDUAB123456', ...over
});

test('référence compacte : statut(2) type(3) navire(4) voyage BL(6)', () => {
  assert.equal(N.buildInvoiceNumberBase(parts()), 'PFECHMANA26607123456');
  assert.equal(N.buildInvoiceNumberBase(parts({ statut: 'FA', typeName: 'Telex' })), 'FATELMANA26607123456');
});

test('codes type : DTI / DTE départagent les détentions', () => {
  assert.equal(N.getInvoiceTypeCode('Détention Import'), 'DTI');
  assert.equal(N.getInvoiceTypeCode('Détention Export'), 'DTE');
  assert.equal(N.getInvoiceTypeCode('Caution'), 'CAU');
  assert.equal(N.getInvoiceTypeCode('Surestarie'), 'SUR');
});

test('décodage et affichage groupé', () => {
  const d = N.decodeInvoiceNumber('FAECHMANA0FL3RAB7788-2');
  assert.deepEqual(d, { statut: 'FA', type: 'ECH', navire: 'MANA', voyage: '0FL3R', bl: 'AB7788', rang: 2 });
  assert.equal(N.formatInvoiceNumber('FAECHMANA26607123456'), 'FA ECH MANA 26607 123456');
  assert.equal(N.formatInvoiceNumber('FA-CAU26607-BOCS001'), 'FA-CAU26607-BOCS001');
  assert.equal(N.decodeInvoiceNumber('FA-CAU26607-BOCS001'), null);
});

test('définitive / proforma, anciens et nouveaux formats', () => {
  assert.ok(N.isDefinitiveInvoiceNumber('FAECHMANA26607123456'));
  assert.ok(N.isDefinitiveInvoiceNumber('FA-CAU26607-BOCS001'));
  assert.ok(!N.isDefinitiveInvoiceNumber('PFECHMANA26607123456'));
  assert.ok(!N.isDefinitiveInvoiceNumber('CAU26607-BOCS001'));
  assert.ok(N.isProformaInvoice({ numeroFacture: 'PFECHMANA26607123456', statutFacture: 'BROUILLON' }));
});

test('suffixe -2 seulement en cas de doublon, PF et FA partagent la référence', () => {
  const existing = [{ id: 1, numeroFacture: 'FAECHMANA26607123456' }];
  assert.equal(N.nextInvoiceNumber(parts({ numeroBL: 'X-999111' }), []), 'PFECHMANA26607999111');
  assert.equal(N.nextInvoiceNumber(parts(), existing), 'PFECHMANA26607123456-2');
  assert.equal(N.nextInvoiceNumber(parts(), existing), 'PFECHMANA26607123456-3');
});

test('validation : PF devient FA, le reste est conservé', () => {
  const inv = { id: 5, numeroFacture: 'PFCAUMANA26607222333', numeroBL: 'MEDU222333', blId: 100 };
  assert.equal(N.invoiceNumberWithStatut(inv, 'FA', [inv], ctx), 'FACAUMANA26607222333');
  const rang = { id: 6, numeroFacture: 'PFCAUMANA26607444555-2', numeroBL: 'MEDU444555' };
  assert.equal(N.invoiceNumberWithStatut(rang, 'FA', [rang], ctx), 'FACAUMANA26607444555-2');
});

test('ancienne proforma validée : reconstruite au nouveau format', () => {
  const old = { id: 7, numeroFacture: 'TEL26607-BOCS001', numeroBL: 'MEDUAB777888', blId: 100, invoiceTypeId: '3' };
  assert.equal(N.invoiceNumberWithStatut(old, 'FA', [old], ctx), 'FATELMANA26607777888');
});

test('avoir : AV + référence de la facture, -2 pour un second avoir', () => {
  const fa = { id: 8, numeroFacture: 'FASURMANA26607555666', numeroBL: 'MEDU555666' };
  assert.equal(N.invoiceNumberWithStatut(fa, 'AV', [], ctx), 'AVSURMANA26607555666');
  assert.equal(N.invoiceNumberWithStatut(fa, 'AV', [{ id: 99, numeroFacture: 'AVSURMANA26607555666' }], ctx), 'AVSURMANA26607555666-2');
});

test('code navire : registre, sinon dérivé du nom ; propositions uniques', () => {
  assert.equal(N.resolveVesselCode({ nomNavire: 'CMA CGM KRIBI' }, []), 'CKRI');
  assert.equal(N.suggestVesselCode('BREMEN'), 'BREM');
  assert.equal(N.uniqueVesselCode('MSC ANABELLA', vessels), 'MAN2');
});

test('valeurs de repli : voyage absent, BL court', () => {
  assert.equal(N.buildInvoiceNumberBase(parts({ voyage: '', numeroBL: 'B12' })), 'PFECHMANASV000B12');
  assert.ok(N.decodeInvoiceNumber('PFECHMANASV000B12'));
});

test('rapprochement par type : DET reconnaît DTI / DTE du nouveau format', () => {
  const inv = { id: 9, numeroFacture: 'PFDTIMANA26607123456' };
  assert.ok(invoiceMatchesType(inv, { id: '6', name: 'Détention Import' }, [{ id: '6', name: 'Détention Import' }]));
  assert.ok(!invoiceMatchesType(inv, { id: '7', name: 'Détention Export' }, types));
});
