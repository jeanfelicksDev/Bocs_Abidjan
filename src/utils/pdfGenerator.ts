import { BL, DraftExport, Invoice, Escale } from '../types';
import { INITIAL_INVOICE_TYPE_CONFIGS } from '../data/initialData';

/**
 * Triggers native browser print dialog formatted as an official PDF document
 */
export function triggerPrintDocument(elementId: string) {
  const printElement = document.getElementById(elementId);
  if (!printElement) {
    console.error(`Élément #${elementId} introuvable pour l'impression.`);
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres surgissantes pour afficher le document PDF.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Document Maritime BOCS</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 20px;
            color: #0F172A;
            background: white;
          }
          .bocs-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #002B49;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .bocs-title {
            color: #002B49;
            font-size: 24px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .bocs-badge {
            background: #002B49;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          th, td {
            border: 1px solid #CBD5E1;
            padding: 8px 12px;
            text-align: left;
            font-size: 12px;
          }
          th {
            background-color: #F1F5F9;
            color: #002B49;
            font-weight: 700;
          }
          .stamp-box {
            border: 2px dashed #C8102E;
            padding: 12px;
            border-radius: 8px;
            background: #FFF5F5;
            display: inline-block;
            text-align: center;
          }
          .stamp-text {
            color: #C8102E;
            font-weight: 800;
            font-size: 13px;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${printElement.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Computes a pseudo SHA-256 cryptographic hash for digital signature audit
 */
export function generateDigitalHash(blNumber: string, date: string): string {
  let hash = 0;
  const str = `${blNumber}-${date}-BOCS-MARITIME-SECRET-KEY-2026`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'SHA256:' + Math.abs(hash).toString(16).padStart(16, '0').toUpperCase() + '9F8E7D';
}

/**
 * Generates and triggers print/download of Proforma Invoice PDF
 */
export function generateProformaPdf(invoice: Invoice, bl?: BL, agencyInfo: string = 'BOCS Maritime Agency', payment?: any) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres surgissantes pour afficher la facture.');
    return;
  }

  const isPaid = invoice.statutPaiement === 'PAYE' || !!payment;
  
  // numberToLetters helper
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];
  function numberToLetters(n: number): string {
      if (n === 0) return "zéro";
      if (n < 20) return units[n];
      if (n < 100) {
          const t = Math.floor(n / 10);
          const u = n % 10;
          let res = "";
          if (t === 7 || t === 9) {
              res = tens[t - 1] + (u === 1 ? " et onze" : "-" + units[10 + u]);
          } else {
              res = tens[t] + (u === 1 ? " et un" : (u === 0 ? "" : "-" + units[u]));
          }
          return res.replace("quatre-vingt et un", "quatre-vingt-un");
      }
      if (n < 1000) {
          const h = Math.floor(n / 100);
          const rest = n % 100;
          let res = h === 1 ? "cent" : units[h] + " cent";
          if (rest === 0 && h > 1) res += "s";
          return res + (rest > 0 ? " " + numberToLetters(rest) : "");
      }
      if (n < 1000000) {
          const k = Math.floor(n / 1000);
          const rest = n % 1000;
          let res = k === 1 ? "mille" : numberToLetters(k) + " mille";
          return res + (rest > 0 ? " " + numberToLetters(rest) : "");
      }
      if (n < 1000000000) {
          const m = Math.floor(n / 1000000);
          const rest = n % 1000000;
          let res = m === 1 ? "un million" : numberToLetters(m) + " millions";
          return res + (rest > 0 ? " " + numberToLetters(rest) : "");
      }
      return n.toString();
  }

  const montantEnLettres = numberToLetters(invoice.montantTtcFcfa);
  const montantEnLettresCapitalized = montantEnLettres.charAt(0).toUpperCase() + montantEnLettres.slice(1) + " Francs CFA";

  const blNavire = invoice.escaleInfo?.split('V.')[0]?.trim() || "BOCS VISION";
  const blVoy = invoice.escaleInfo?.split('V.')[1]?.trim() || "26607";
  const blPolPod = bl ? `${bl.portChargementCode || 'ANVERS'} / ${bl.portDechargementCode || 'ABIDJAN'}` : "ANVERS / ABIDJAN";
  const blPoids = bl ? bl.poidsBrutKg.toLocaleString('fr-FR') : "127 999,00";
  const blVol = bl && bl.volumeM3 ? bl.volumeM3 : "NC";
  const blColis = bl ? bl.nombreColis : "48";
  
  const conteneursDesc = bl?.conteneurs?.length 
    ? bl.conteneurs.map(c => `${c.typeConteneur} N° ${c.numeroConteneur} - Pb N° ${c.numeroScelle}`).join(' &nbsp;&nbsp; ')
    : '05x40\' HC COC, STC 48 REELS - KLB KRAFTLINER BROWN, WTKL ROYAL WHITE';

  const titleText = isPaid ? 'FACTURE DÉFINITIVE' : 'PROFORMA INVOICE';
  
  const lignesHtml = (invoice.lignes || []).map(l => {
    const tva = Math.round(l.montantHtFcfa * 0.18);
    const ttc = l.montantHtFcfa + tva;
    return `
      <tr>
        <td style="text-align: left; border-right: 1px solid #c3c6cf;">${l.designation}</td>
        <td style="text-align: right; border-right: 1px solid #c3c6cf;">${l.quantite}</td>
        <td style="text-align: right; border-right: 1px solid #c3c6cf;">${l.prixUnitaireFcfa.toLocaleString('fr-FR')} CFA</td>
        <td style="text-align: right; border-right: 1px solid #c3c6cf;">${l.montantHtFcfa.toLocaleString('fr-FR')} CFA</td>
        <td style="text-align: right; border-right: 1px solid #c3c6cf;">${tva.toLocaleString('fr-FR')} CFA</td>
        <td style="text-align: right;">${ttc.toLocaleString('fr-FR')} CFA</td>
      </tr>
    `;
  }).join('');
  
  // Compute equivalent in EUR (e.g. 1 EUR = 655.957 CFA)
  const totalEur = (invoice.montantTtcFcfa / 655.957).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>${titleText} - ${invoice.numeroFacture}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          body { font-family: 'Inter', 'Arial', sans-serif; margin: 0; padding: 0; color: #1e293b; background: white; font-size: 10px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; flex-direction: column; min-height: 275mm; }
          .logo-container { width: 350px; margin-bottom: 25px; }
          
          .header-main { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; }
          .title { font-size: 16px; font-weight: 900; color: #0f172a; }
          .title-red { color: #ef4444; font-size: 16px; font-weight: 900; }
          .type-fact { font-size: 13px; font-weight: 700; color: #475569; text-align: right; }
          .dates { font-size: 9px; text-align: right; margin-top: 6px; line-height: 1.4; color: #334155; }
          
          .grid-2 { display: grid; grid-template-columns: 48% 48%; gap: 4%; margin-bottom: 15px; }
          .section-title { font-size: 10px; font-weight: 800; color: #1e3a8a; border-bottom: 1.5px solid #1e3a8a; padding-bottom: 3px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
          
          .info-table { width: 100%; border-collapse: collapse; font-size: 9px; }
          .info-table td { padding: 1.5px 0; vertical-align: top; color: #334155; font-weight: 500; }
          .info-table td:first-child { width: 110px; color: #64748b; font-weight: 600; }
          
          .marchandises { margin-bottom: 12px; font-size: 9px; color: #334155; font-weight: 600; }
          
          .main-table { width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e1; border-bottom: none; flex-grow: 1; }
          .main-table th { background-color: #f8fafc; color: #475569; text-transform: uppercase; font-weight: 800; padding: 6px; border-right: 1px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; font-size: 9px; }
          .main-table th:last-child { border-right: none; }
          .main-table td { padding: 6px; border-right: 1px solid #cbd5e1; color: #1e293b; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
          .main-table td:last-child { border-right: none; }
          .main-table tbody tr.lignes-data:last-child td { border-bottom: none; }
          
          .footer-section { display: flex; justify-content: space-between; margin-top: 15px; page-break-inside: avoid; }
          .notes { font-size: 8px; font-style: italic; max-width: 60%; line-height: 1.4; color: #64748b; }
          .amount-words { font-size: 9.5px; font-weight: 700; margin-top: 8px; font-style: italic; color: #0f172a; }
          .timbre { font-size: 8px; margin-top: 6px; color: #475569; }
          .timbre-total { background-color: #f1f5f9; padding: 3px 8px; font-weight: 900; display: inline-block; margin-top: 4px; font-size: 10px; color: #0f172a; border-radius: 2px; }
          
          .totals-right { width: 220px; font-size: 9px; font-weight: 700; color: #1e293b; }
          .totals-right-row { display: flex; justify-content: space-between; padding: 2.5px 0; }
          .totals-right-row.grand { border-top: 1px solid #cbd5e1; border-bottom: 2px solid #0f172a; padding: 4px 0; font-size: 10px; margin-top: 4px; color: #0f172a; }
          
          .footer-banner { margin-top: auto; border-top: 2px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; color: #64748b; text-align: center; page-break-inside: avoid; line-height: 1.3; }
          .footer-banner div { flex: 1; padding: 0 10px; border-right: 1px solid #e2e8f0; }
          .footer-banner div:last-child { border-right: none; }
          .footer-logo { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; }
          .footer-logo-bocs { color: #209641; font-family: 'Arial Black', sans-serif; font-style: italic; font-weight: 900; font-size: 16px; line-height: 1; letter-spacing: -0.5px; }
          .footer-logo-abidjan { background-color: #232766; color: white; font-family: Arial, sans-serif; font-weight: bold; font-size: 8px; padding: 2px 6px; margin-top: 1px; }
        </style>
      </head>
      <body>
        <div class="logo-container">
          <svg width="100%" viewBox="0 0 350 90" xmlns="http://www.w3.org/2000/svg">
            <text x="340" y="42" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="52" font-style="italic" fill="#209641" text-anchor="end" letter-spacing="-2">BOCS</text>
            <polygon points="0,48 350,48 315,88 290,88 316.25,58 0,58" fill="#232766" />
            <text x="282" y="81" font-family="Arial, sans-serif" font-weight="bold" font-size="19" fill="#232766" text-anchor="end">ABIDJAN</text>
          </svg>
        </div>
        
        <div class="header-main">
          <div>
            <span class="title">${titleText} N° &nbsp;&nbsp;&nbsp;</span>
            <span class="title">${invoice.numeroFacture.split('/')[0]}</span><span class="title-red">/${invoice.numeroFacture.split('/')[1] || '022'}</span>
          </div>
          <div>
            <div class="type-fact">${
              invoice.typeFacture === 'PROFORMA_IMPORT' 
                ? (INITIAL_INVOICE_TYPE_CONFIGS.find(c => c.id === invoice.invoiceTypeId)?.name ? `Import Charges locales (${INITIAL_INVOICE_TYPE_CONFIGS.find(c => c.id === invoice.invoiceTypeId)?.name})` : 'Import Charges locales')
                : invoice.typeFacture.replace(/_/g, ' ')
            }</div>
            <div class="dates">
              Date de facturation : ${invoice.dateFacture}<br />
              Date d'échéance : ${invoice.dateEcheance || invoice.dateFacture}
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div>
            <div class="section-title">Détail d'expédition</div>
            <table class="info-table">
              <tr><td>Navire :</td><td>${blNavire}</td></tr>
              <tr><td>Voy :</td><td>${blVoy}</td></tr>
              <tr><td>Pol/Pod :</td><td>${blPolPod}</td></tr>
              <tr><td>B/L N° :</td><td>${bl?.numeroBL || invoice.numeroBL || 'ANRABJ26607108'}</td></tr>
              <tr><td>ETA :</td><td>${invoice.dateFacture.split('-').reverse().join('-')}</td></tr>
              <tr><td>ETB :</td><td>${invoice.dateFacture.split('-').reverse().join('-')}</td></tr>
              <tr><td>ETD :</td><td>${invoice.dateFacture.split('-').reverse().join('-')}</td></tr>
              <tr><td>Poids (Kgs):</td><td>${blPoids}</td></tr>
              <tr><td>Volume (M3):</td><td>${blVol}</td></tr>
              <tr><td>Nbre Colis :</td><td>${blColis}</td></tr>
            </table>
          </div>
          <div>
            <div class="section-title">Client / Compte</div>
            <table class="info-table">
              <tr><td>Dénomination :</td><td>${invoice.clientNom}</td></tr>
              <tr><td>Compte contribuable N° :</td><td>${bl?.clientId || '9817464X'}</td></tr>
              <tr><td>Adresse :</td><td>${bl?.consigneeAdresse || 'TREICHVILLE ZONE 3C RUE DE L\'INDUSTRIE'}</td></tr>
              <tr><td>Contact :</td><td>01BP3750 ABIDJAN 01 / 27-21-24-20-58</td></tr>
              <tr><td>Dossier N° :</td><td></td></tr>
              <tr><td>Transitaire :</td><td>${invoice.clientNom}</td></tr>
            </table>
            
            <div class="section-title" style="margin-top: 15px; font-size: 8.5px; white-space: nowrap; letter-spacing: -0.2px;">Conditions de paiements et mentions particulières</div>
            <div style="font-size: 10px; line-height: 1.5;">
              Paiement dû à réception<br />
              Règlement à effectuer à l'ordre de BOCS ABIDJAN
            </div>
          </div>
        </div>

        <div class="section-title" style="border:none; margin-bottom: 2px;">Détails marchandises / conteneurs / roulants</div>
        <div class="marchandises">
          ${bl?.descriptionGoods || 'MARCHANDISES GÉNÉRALES'}<br />
          ${conteneursDesc}
        </div>

        <table class="main-table">
          <thead>
            <tr>
              <th style="text-align:left;">DESCRIPTION</th>
              <th>QTÉ</th>
              <th>PU</th>
              <th>TOTAL HT</th>
              <th>TVA</th>
              <th>TOTAL TTC</th>
            </tr>
          </thead>
          <tbody>
            ${lignesHtml}
            <tr class="filler-row">
              <td style="border-bottom: none; height: 100%;"></td>
              <td style="border-bottom: none;"></td>
              <td style="border-bottom: none;"></td>
              <td style="border-bottom: none;"></td>
              <td style="border-bottom: none;"></td>
              <td style="border-bottom: none; border-right: none;"></td>
            </tr>
            <tr class="totals-row">
              <td style="border-bottom: none; border-top: none;"></td>
              <td style="border-bottom: none; border-top: none;"></td>
              <td style="border-bottom: none; border-top: none;"></td>
              <td style="text-align: right; font-weight: 700; color: #0f172a; padding: 6px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">${invoice.montantHtFcfa.toLocaleString('fr-FR')} CFA</td>
              <td style="text-align: right; font-weight: 700; color: #0f172a; padding: 6px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">${invoice.tvaFcfa.toLocaleString('fr-FR')} CFA</td>
              <td style="text-align: right; font-weight: 700; color: #0f172a; padding: 6px; border-right: none; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">${invoice.montantTtcFcfa.toLocaleString('fr-FR')} CFA</td>
            </tr>
          </tbody>
        </table>

        <div class="footer-section">
          <div style="width: 65%;">
            <div class="notes">
              NB : La présente facture pro-forma est une estimation établie sur la base des informations existantes au moment de son établissement.<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Elle ne peut, en aucun cas, se substituer à la facture définitive qui sera établie au moment du paiement.
            </div>
            
            <div class="amount-words">
              Arrêtée la présente facture à la somme de :<br />
              ${montantEnLettresCapitalized}
            </div>
            
            <div class="timbre">
              Pour un règlement en espèces, prévoir le montant du timbre d'état de 1000 Fancs CFA . Le montant à régler est alors de : 
              <span class="timbre-total">${(invoice.montantTtcFcfa + 1000).toLocaleString('fr-FR')} CFA</span>
            </div>
          </div>
          
          <div class="totals-right">
            <div class="totals-right-row">
              <span>Total HT :</span>
              <span>${invoice.montantHtFcfa.toLocaleString('fr-FR')} CFA</span>
            </div>
            <div class="totals-right-row">
              <span>TVA (0-18%) :</span>
              <span>${invoice.tvaFcfa.toLocaleString('fr-FR')} CFA</span>
            </div>
            <div class="totals-right-row">
              <span>AIRSI (0-5%) :</span>
              <span>0 CFA</span>
            </div>
            <div class="totals-right-row">
              <span>Total TTC :</span>
              <span>${invoice.montantTtcFcfa.toLocaleString('fr-FR')} CFA</span>
            </div>
            <div class="totals-right-row grand" style="margin-top: 10px;">
              <span>Net à payer :</span>
              <span>${invoice.montantTtcFcfa.toLocaleString('fr-FR')} CFA</span>
            </div>
            <div class="totals-right-row grand" style="background-color: #e5e7eb; padding: 4px 10px; margin-top: 5px;">
              <span></span>
              <span>${totalEur} EUR</span>
            </div>
          </div>
        </div>

        <div class="footer-banner">
          <div class="footer-logo">
            <div class="footer-logo-bocs">BOCS</div>
            <div class="footer-logo-abidjan">ABIDJAN</div>
          </div>
          <div>
            BOCS ABIDJAN SARL<br />
            Treichville zone 3 | Rue des Brasseurs<br />
            Imm. Rive Gauche | 2e étage<br />
            05 BP 3282 Abidjan 05 | Côte d'Ivoire
          </div>
          <div>
            +225 27 24 36 40 41<br />
            abidjan@bocs.de<br />
            www.bocs.de
          </div>
          <div>
            BOCS ABIDJAN SARL au capital de 5.000.000 FRS CFA<br />
            RCCM: CI-ABJ-03-2023-B13-02079 - C.C: 2300820M<br />
            Compte Bancaire: BICICI CI006 01766 010207300028 37<br />
            IBAN: CI93 CI00 6017 6601 0207 3000 2837 - BIC: BICICIABXXX
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Generates Original BL PDF document with digital signature overlay
 */
export function generateOriginalBlPdf(bl: BL, signatureDataUrl?: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres surgissantes pour afficher le BL Original.');
    return;
  }

  const hash = generateDigitalHash(bl.numeroBL, new Date().toISOString().split('T')[0]);

  const conteneursRows = (bl.conteneurs || []).map(c => `
    <tr>
      <td style="font-family: 'JetBrains Mono'; font-weight: bold; color: #075fac;">${c.numeroConteneur}</td>
      <td>${c.typeConteneur}</td>
      <td style="font-family: 'JetBrains Mono';">${c.numeroScelle}</td>
      <td style="text-align:right; font-weight:bold;">${c.poidsKg.toLocaleString('fr-FR')} KG</td>
      <td style="text-align:right">${c.nombreColis} COLIS</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Bill of Lading Original - ${bl.numeroBL}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono&display=swap');
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 24px; color: #1a1c1c; background: white; font-size: 11px; }
          .header { display: flex; justify-content: space-between; border-bottom: 3px double #00182f; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: 900; color: #00182f; letter-spacing: -0.5px; }
          .sub { font-size: 11px; font-weight: 700; color: #D79375; text-transform: uppercase; }
          .bl-num { font-size: 16px; font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #075fac; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .box { border: 1px solid #c3c6cf; padding: 8px; border-radius: 4px; background: #f9f9f9; }
          .box-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #73777f; margin-bottom: 4px; border-bottom: 1px solid #e2e2e2; padding-bottom: 2px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border: 1px solid #c3c6cf; padding: 6px 8px; text-align: left; }
          th { background-color: #00182f; color: white; font-size: 9px; text-transform: uppercase; }
          .footer-sign { margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #c3c6cf; padding-top: 16px; }
          .stamp { border: 2px solid #00182f; padding: 8px 14px; border-radius: 50%; text-align: center; color: #00182f; font-weight: 800; font-size: 9px; text-transform: uppercase; width: 80px; height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .sig-img { max-height: 70px; max-width: 180px; display: block; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">BILL OF LADING ORIGINAL</div>
            <div class="sub">BOCS MARITIME MANAGEMENT PLATFORM</div>
          </div>
          <div style="text-align: right">
            <div class="bl-num">${bl.numeroBL}</div>
            <div>TYPE: ${bl.typeOperation}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="box">
            <div class="box-title">SHIPPER (EXPÉDITEUR)</div>
            <strong>${bl.shipperNom}</strong><br />
            ${bl.shipperAdresse}
          </div>
          <div class="box">
            <div class="box-title">CONSIGNEE (DESTINATAIRE)</div>
            <strong>${bl.consigneeNom}</strong><br />
            ${bl.consigneeAdresse}
          </div>
        </div>

        <div class="grid-2">
          <div class="box">
            <div class="box-title">NOTIFY PARTY</div>
            <strong>${bl.notifyNom || bl.consigneeNom}</strong><br />
            ${bl.notifyAdresse || bl.consigneeAdresse}
          </div>
          <div class="box">
            <div class="box-title">PORT LOADING / DISCHARGE</div>
            POL: <strong>${bl.portChargementCode}</strong> &rarr; POD: <strong>${bl.portDechargementCode}</strong><br />
            Destination Finale: ${bl.destinationFinale}
          </div>
        </div>

        <div class="box" style="margin-bottom: 12px;">
          <div class="box-title">DESCRIPTION OF GOODS (MARCHANDISES)</div>
          <strong>${bl.descriptionGoods}</strong><br />
          Poids Brut: <strong>${bl.poidsBrutKg.toLocaleString('fr-FR')} KG</strong> | Volume: <strong>${bl.volumeM3} M³</strong> | Total Colis: <strong>${bl.nombreColis} ${bl.typeEmballage}</strong>
        </div>

        <table>
          <thead>
            <tr>
              <th>N° Conteneur</th>
              <th>Type Conteneur</th>
              <th>N° Scellé (Plomb)</th>
              <th style="text-align:right">Poids Brut</th>
              <th style="text-align:right">Colis</th>
            </tr>
          </thead>
          <tbody>
            ${conteneursRows}
          </tbody>
        </table>

        <div class="footer-sign">
          <div class="stamp">
            <span>BOCS</span>
            <span>MARITIME</span>
            <span>SEAL</span>
          </div>

          <div style="text-align: right">
            <div style="font-size: 10px; font-weight: bold; color: #00182f;">SIGNED FOR THE CARRIER (BOCS MARITIME)</div>
            ${signatureDataUrl && signatureDataUrl !== 'STAMP_ONLY_VALIDATED' ? `<img src="${signatureDataUrl}" class="sig-img" alt="Signature Numérique" />` : '<div style="padding: 10px; font-weight: bold; color: #075fac;">CACHET ET SIGNATURE NUMÉRIQUE VALIDÉS</div>'}
            <div style="font-family: 'JetBrains Mono'; font-size: 9px; color: #73777f; margin-top: 4px;">${hash}</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
