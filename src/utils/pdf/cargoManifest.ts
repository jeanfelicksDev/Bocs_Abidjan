/**
 * Lecture du « CARGO MANIFEST » BOCS (édité par la ligne pour chaque port de chargement).
 *
 * Mise en page : un en-tête d'escale (VESSEL, VOYAGE, POL, POD, FIN. DEST.) puis un
 * tableau dont les colonnes sont repérées sur leurs propres en-têtes :
 *   SHIPPER(SH); CONSIGNEE(CO); NOTIFY(NF) | B/L NR. | CONTAINER NRS (C) / TYPE (T) /
 *   SEAL NRS (S) / TARE CTR (TR) / MARKS | QTY. | DESCR. OF GOODS | GROSS W. kg | MEAS. M3
 * Chaque BL commence par « SH: » et se termine par « Total BL » / « RECAP BL » / « PACKAGES ».
 * Un BL peut se poursuivre sur la page suivante : les lignes du corps sont lues en continu.
 */
import {
  containerType,
  countryCode,
  firstNumber,
  groupRows,
  normalizeContainerNumber,
  parseSeals,
  portCode,
  rowSlice,
  rowText,
  type PdfPage,
  type Row,
} from './layout.ts';
import { finalizeBl, goodsLines, newContainer, splitParty } from './common.ts';
import { emptyParsedBl, type ParsedBl } from './types.ts';

export function isCargoManifest(pages: PdfPage[]): boolean {
  const text = pages.flatMap((p) => p.items.map((i) => i.str)).join(' ').toUpperCase();
  return text.includes('CARGO MANIFEST') && /SHIPPER\s*\(SH\)/.test(text);
}

interface Columns {
  partiesEnd: number;
  blEnd: number;
  ctrEnd: number;
  qtyEnd: number;
  descEnd: number;
  grossEnd: number;
  measEnd: number;
  headerBottom: number;
}

const HEADER_LABELS = /^(B\/L NR|CONTAINER (NRS|TYPE)|SEAL NRS|TARE CTR|MARKS AND NRS|QTY\.?$|KIND OF PACKAGES|DESCR\. OF GOODS|GROSS W|MEAS\.?$|SHIPPER\(SH\)|NOTIFY\(NF\)|kg$|M3$)/i;

function findColumns(rows: Row[]): Columns | undefined {
  const items = rows.flatMap((r) => r.items);
  const x = (re: RegExp) => items.find((i) => re.test(i.str.trim()))?.x;
  const bl = x(/^B\/L NR/i);
  const ctr = x(/^CONTAINER NRS/i);
  const qty = x(/^QTY\.?$/i);
  const desc = x(/^KIND OF PACKAGES/i);
  const gross = x(/^GROSS W/i);
  const meas = x(/^MEAS\.?$/i);
  if ([bl, ctr, qty, desc, gross, meas].some((v) => v === undefined)) return undefined;
  const freight = x(/^Type$/) ?? meas! + 40;
  const headerBottom = Math.max(...items.filter((i) => HEADER_LABELS.test(i.str.trim())).map((i) => i.y));
  return {
    partiesEnd: bl! - 4,
    blEnd: ctr! - 6,
    ctrEnd: qty! - 4,
    qtyEnd: desc! - 3,
    descEnd: gross! - 4,
    grossEnd: meas! - 6,
    measEnd: freight - 4,
    headerBottom: headerBottom + 2,
  };
}

/** Valeur d'un champ d'en-tête « LABEL: valeur » (la valeur s'arrête au libellé suivant). */
function headerValue(rows: Row[], label: RegExp): string {
  for (const row of rows) {
    const idx = row.items.findIndex((i) => label.test(i.str.trim()));
    if (idx < 0) continue;
    const parts = [row.items[idx].str.trim().replace(label, '').trim()];
    for (const it of row.items.slice(idx + 1)) {
      if (/^[A-Z .]+:\s*$/i.test(it.str.trim()) || /^[A-Z .]+:\s/i.test(it.str.trim())) break;
      parts.push(it.str.trim());
    }
    const v = parts.filter(Boolean).join(' ').trim();
    if (v && v !== '.') return v;
  }
  return '';
}

export function parseCargoManifest(pages: PdfPage[], isOcr = false): ParsedBl[] {
  const pageRows = pages.map((p) => groupRows(p.items));
  const firstRows = pageRows[0] || [];

  const nomNavire = headerValue(firstRows, /^VESSEL:/i).toUpperCase();
  const numeroVoyage = headerValue(firstRows, /^VOYAGE:/i).toUpperCase();
  const polLabel = headerValue(firstRows, /^POL:/i);
  const podLabel = headerValue(firstRows, /^POD:/i);
  const finDest = pageRows.map((r) => headerValue(r, /^FIN\. DEST\.:/i)).find(Boolean) || '';
  const sailing = headerValue(firstRows, /^SAILING DATE:/i);

  // Corps du tableau, toutes pages confondues, jusqu'au « SUBTOTAL » de fin de port.
  const body: Row[] = [];
  let cols: Columns | undefined;
  for (const rows of pageRows) {
    const pageCols = findColumns(rows);
    if (!pageCols) continue;
    cols = cols || pageCols;
    for (const row of rows) {
      if (row.y <= pageCols.headerBottom) continue;
      if (/^SUBTOTAL/i.test(rowText(row.items))) break;
      body.push(row);
    }
  }
  if (!cols) return [];
  const c = cols;

  // Découpage en blocs BL sur les « SH: » de la colonne parties.
  const blocks: Row[][] = [];
  for (const row of body) {
    if (/^SH:/i.test(rowSlice(row, 0, c.partiesEnd))) blocks.push([row]);
    else if (blocks.length) blocks[blocks.length - 1].push(row);
  }

  return blocks.map((rows) => {
    const bl = emptyParsedBl('MANIFESTE_BOCS');
    bl.nomNavire = nomNavire;
    bl.numeroVoyage = numeroVoyage;
    bl.portChargementCode = portCode(polLabel);
    bl.portDechargementCode = portCode(podLabel);
    bl.destinationFinale = countryCode(finDest);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(sailing)) bl.dateEmbarquement = sailing;

    const parties: Record<'SH' | 'CO' | 'NF', string[]> = { SH: [], CO: [], NF: [] };
    let section: 'SH' | 'CO' | 'NF' | 'END' = 'SH';
    const descLines: string[] = [];
    const marks: string[] = [];
    const nets: number[] = [];
    const tares: number[] = [];
    const plainWeights: number[] = [];
    const plainMeas: number[] = [];
    let totalGross: number | undefined;
    let totalMeas: number | undefined;
    let qty: number | undefined;
    let packagesTotal: number | undefined;
    let afterTotal = false;
    let current: ReturnType<typeof newContainer> | undefined;

    for (const row of rows) {
      const full = rowText(row.items);
      const partyText = rowSlice(row, 0, c.partiesEnd);

      if (/^Total BL/i.test(partyText)) {
        afterTotal = true;
        section = 'END';
        totalGross = firstNumber(rowSlice(row, c.descEnd, c.grossEnd));
        totalMeas = firstNumber(rowSlice(row, c.grossEnd, c.measEnd));
        continue;
      }
      if (afterTotal) {
        const pk = full.match(/PACKAGES\s*:\s*(\d+)/i);
        if (pk) packagesTotal = Number(pk[1]);
        continue;
      }

      // Parties
      const marker = partyText.match(/^(SH|CO|NF):\s*(.*)$/i);
      if (marker) {
        section = marker[1].toUpperCase() as 'SH' | 'CO' | 'NF';
        if (marker[2]) parties[section].push(marker[2]);
      } else if (partyText && section !== 'END') {
        parties[section].push(partyText);
      }

      // N° BL
      if (!bl.numeroBL) {
        const m = rowSlice(row, c.partiesEnd, c.blEnd).match(/\b[A-Z0-9]{8,}\b/);
        if (m) bl.numeroBL = m[0];
      }

      // Conteneurs / plombs / marques
      const ctrText = rowSlice(row, c.blEnd, c.ctrEnd);
      if (ctrText) {
        const m = ctrText.match(/^(C|T|S|TR):\s*(.*)$/i);
        const tag = m?.[1].toUpperCase();
        if (tag === 'C') {
          current = newContainer(normalizeContainerNumber(m![2]) || m![2].replace(/[\s-]/g, '').toUpperCase());
          bl.conteneurs.push(current);
        } else if (tag === 'T' && current) {
          current.typeConteneur = containerType(m![2]) || current.typeConteneur;
        } else if (tag === 'S' && current) {
          const seals = [...(current.numeroScelle ? current.numeroScelle.split(' / ') : []), ...parseSeals(m![2])];
          current.numeroScelle = seals.join(' / ');
        } else if (tag === 'TR' && current) {
          current.tareKg = firstNumber(m![2]) || 0;
        } else {
          marks.push(ctrText);
        }
      }

      const q = rowSlice(row, c.ctrEnd, c.qtyEnd);
      if (qty === undefined && /^\d+$/.test(q)) qty = Number(q);

      const d = rowSlice(row, c.qtyEnd, c.descEnd);
      if (d) descLines.push(d);

      const g = rowSlice(row, c.descEnd, c.grossEnd);
      const gv = firstNumber(g);
      if (gv !== undefined && /\d[\d.,]*\s*\(N\)/i.test(g)) nets.push(gv);
      else if (gv !== undefined && /\d[\d.,]*\s*\(T\)/i.test(g)) tares.push(gv);
      else if (gv !== undefined && /^\d[\d.,]*$/.test(g)) plainWeights.push(gv);

      const mv = firstNumber(rowSlice(row, c.grossEnd, c.measEnd));
      if (mv !== undefined) plainMeas.push(mv);
    }

    const sh = splitParty(parties.SH);
    const co = splitParty(parties.CO);
    const nf = splitParty(parties.NF);
    Object.assign(bl, {
      shipperNom: sh.nom,
      shipperAdresse: sh.adresse,
      consigneeNom: co.nom,
      consigneeAdresse: co.adresse,
      notifyNom: nf.nom,
      notifyAdresse: nf.adresse,
    });

    const goods = goodsLines(descLines);
    bl.descriptionGoods = goods.join('\n');
    bl.marquesEtNumeros = marks.join(' ');
    const descAll = descLines.join('\n');

    // Conteneurs : poids (N) = marchandise, (T) = tare, dans l'ordre des conteneurs.
    bl.conteneurs.forEach((ctr, i) => {
      if (nets[i] !== undefined) ctr.poidsKg = nets[i];
      else if (!nets.length && plainWeights.length === bl.conteneurs.length) ctr.poidsKg = plainWeights[i];
      if (!ctr.tareKg && tares[i] !== undefined) ctr.tareKg = tares[i];
      if (/\bSOC\b/i.test(descAll)) ctr.socCoc = 'SOC';
      else if (/\bCOC\b/i.test(descAll)) ctr.socCoc = 'COC';
      if (!ctr.typeConteneur || ctr.typeConteneur === '20_DRY') {
        const t = descAll.match(/\b(20|40|45)\s*'?\s*(DV|DC|GP|HC|HQ|RF|RH|OT|FR)\b/i);
        if (t) ctr.typeConteneur = containerType(t[0]) || ctr.typeConteneur;
      }
    });
    if (bl.conteneurs.length === 1) {
      const pal = descAll.match(/total\s*:\s*(\d+)\s*(palettes?|pal|colis|cartons?|packages?|pcs|pieces?)/i);
      if (pal) bl.conteneurs[0].nombreColis = Number(pal[1]);
    }

    if (bl.conteneurs.length) {
      const sum = bl.conteneurs.reduce((a, x) => a + x.poidsKg, 0);
      const declared = firstNumber(descAll.match(/POIDS\s+BRUT\s+TOTAL\s*:\s*([\d.,]+)/i)?.[1] || '');
      bl.poidsBrutKg = sum || declared || 0;
      bl.poidsTotalAvecTareKg = totalGross;
      bl.nombreColis = qty || bl.conteneurs.length;
    } else {
      bl.poidsBrutKg = totalGross ?? plainWeights[0] ?? 0;
      if (totalGross && plainWeights[0] && Math.abs(totalGross - plainWeights[0]) > 1) {
        bl.aVerifier.push({ field: 'poidsBrutKg', message: `Poids de la ligne (${plainWeights[0]} kg) ≠ Total BL (${totalGross} kg)` });
      }
      bl.nombreColis = packagesTotal || qty || 0;
      bl.typeEmballage = (goods[0] || '').split(/\s+/)[0]?.toUpperCase() || '';
    }
    bl.volumeM3 = totalMeas ?? plainMeas[0] ?? 0;

    return finalizeBl(bl, descAll, isOcr);
  });
}
