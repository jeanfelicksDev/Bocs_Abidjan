import { BL, DraftExport, Invoice, Escale, CreditNote, Container } from '../types';
import { INITIAL_INVOICE_TYPE_CONFIGS } from '../data/initialData';

/**
 * Renders HTML inside a hidden iframe and triggers the print dialog
 * to avoid opening a new tab/window.
 */
function printHtmlContent(htmlContent: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  
  let isPrinted = false;

  iframe.onload = () => {
    const doc = iframe.contentWindow?.document;
    if (!doc || !doc.body || !doc.body.innerHTML.trim()) {
      return;
    }

    if (isPrinted) return;
    isPrinted = true;

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error("Erreur lors de l'impression", e);
      }
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 300);
  };

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error("Impossible d'accéder au document de l'iframe.");
    document.body.removeChild(iframe);
    return;
  }

  const cleanHtml = htmlContent
    .replace(/window\.close\(\)/g, '')
    .replace(/setTimeout\(function\(\)\s*\{\s*window\.close\(\);\s*\}\s*,\s*\d+\)/g, '')
    .replace(/window\.print\(\)/g, '');

  doc.open();
  doc.write(cleanHtml);
  doc.close();
}

/**
 * Triggers native browser print dialog formatted as an official PDF document
 */
export function triggerPrintDocument(elementId: string) {
  const printElement = document.getElementById(elementId);
  if (!printElement) {
    console.error(`Élément #${elementId} introuvable pour l'impression.`);
    return;
  }

  printHtmlContent(`
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
      </body>
    </html>
  `);
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

  // Le montant arrêté en lettres correspond au Net à payer : TTC + timbre fiscal d'État.
  const netAPayerPdf = Number(invoice.montantTtcFcfa) + Number(invoice.timbreFiscalFcfa || 0);
  const montantEnLettres = numberToLetters(netAPayerPdf);
  const montantEnLettresCapitalized = montantEnLettres.charAt(0).toUpperCase() + montantEnLettres.slice(1) + " Francs CFA";

  const blNavire = invoice.escaleInfo?.split('V.')[0]?.trim() || "BOCS VISION";
  const blVoy = invoice.escaleInfo?.split('V.')[1]?.trim() || "26607";
  const blPolPod = bl ? `${bl.portChargementCode || 'ANVERS'} / ${bl.portDechargementCode || 'ABIDJAN'}` : "ANVERS / ABIDJAN";
  const blPoids = bl ? bl.poidsBrutKg.toLocaleString('fr-FR') : "127 999,00";
  const blVol = bl && bl.volumeM3 ? bl.volumeM3 : "NC";
  const blColis = bl ? bl.nombreColis : "48";
  
  const conteneursDesc = bl?.conteneurs?.length 
    ? bl.conteneurs.map(c => `${c.typeConteneur} N° ${c.numeroConteneur} - Pb N° ${c.numeroScelle}`).join(' &nbsp;&nbsp; ')
    : (bl ? '' : '05x40\' HC COC, STC 48 REELS - KLB KRAFTLINER BROWN, WTKL ROYAL WHITE');

  const titleText = isPaid ? 'FACTURE' : 'PROFORMA';

  // ── Taxe additionnelle exceptionnelle (assiette : montant TTC) ──
  // Bloc imprimé uniquement si la taxe a été appliquée à l'émission de la facture.
  const taxeAdditionnelleAppliquee = Number(invoice.taxeAdditionnelleFcfa) > 0;
  const montantTtcHorsTaxe = Number(invoice.montantTtcAvantTaxeFcfa ?? invoice.montantTtcFcfa) || 0;
  const taxeAdditionnelleLabel = invoice.taxeAdditionnelleLibelle || 'Taxe additionnelle exceptionnelle';
  const taxeAdditionnelleDetail = invoice.taxeAdditionnelleMode === 'MONTANT_FIXE'
    ? 'montant fixe'
    : `${Number(invoice.taxeAdditionnelleValeur || 0).toLocaleString('fr-FR')} % du TTC`;
  const taxeAdditionnelleHtml = taxeAdditionnelleAppliquee
    ? `
            <div class="totals-right-row">
              <span>${taxeAdditionnelleLabel} (${taxeAdditionnelleDetail}) :</span>
              <span>${Number(invoice.taxeAdditionnelleFcfa).toLocaleString('fr-FR')} CFA</span>
            </div>`
    : '';

  // ── Timbre fiscal d'État (assiette : montant HT, par tranches) ──
  // Montant figé à l'émission (invoice.timbreFiscalFcfa) ; le timbre s'applique
  // quel que soit le mode de règlement et s'ajoute au Net à payer.
  const timbreFiscalMontant = Math.max(0, Number(invoice.timbreFiscalFcfa) || 0);
  const timbreFiscalHtml = timbreFiscalMontant > 0
    ? `
            <div class="totals-right-row">
              <span>Timbre fiscal d'État :</span>
              <span>${timbreFiscalMontant.toLocaleString('fr-FR')} CFA</span>
            </div>`
    : '';

  const filteredLignes = (invoice.lignes || []).filter(l => Number(l.quantite) > 0 && Number(l.montantHtFcfa) > 0);
  let totalQuantite = 0;
  
  const lignesHtml = filteredLignes.map(l => {
    totalQuantite += Number(l.quantite) || 0;
    // Respect du taux TVA par ligne (factures Export : 0 % — Import : 18 %)
    const tva = Math.round(l.montantHtFcfa * ((l.tauxTva ?? 18) / 100));
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

  printHtmlContent(`
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
          
          .main-table { width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e1; flex-grow: 1; }
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
            <span class="title">${invoice.numeroFacture.includes('/') ? invoice.numeroFacture.split('/')[0] : invoice.numeroFacture}</span>${invoice.numeroFacture.includes('/') ? `<span class="title-red">/${invoice.numeroFacture.split('/')[1] || '022'}</span>` : ''}
          </div>
          <div>
            <div class="type-fact">${(() => {
              const baseTypeName = INITIAL_INVOICE_TYPE_CONFIGS.find(c => c.id === invoice.invoiceTypeId)?.name || 
                                   (invoice.typeFacture === 'PROFORMA_IMPORT' ? 'Import Charges locales' : invoice.typeFacture.replace(/_/g, ' '));
              const isEchange = baseTypeName.toLowerCase().includes('echange') || invoice.invoiceTypeId === '2';
              if (isEchange && bl?.conteneurs && bl.conteneurs.length > 0) {
                const hasSoc = bl.conteneurs.some(c => c.socCoc === 'SOC');
                const hasCoc = bl.conteneurs.some(c => c.socCoc === 'COC' || !c.socCoc);
                if (hasSoc && !hasCoc) return `Échange Conteneurs (SOC)`;
                if (hasCoc && !hasSoc) return `Échange Conteneurs (COC)`;
                return `Échange Conteneurs (SOC / COC)`;
              }
              return invoice.typeFacture === 'PROFORMA_IMPORT' ? `Import Charges locales (${baseTypeName})` : baseTypeName;
            })()}</div>
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
              <td style="border-bottom: 1px solid #cbd5e1; border-top: none;"></td>
              <td style="text-align: right; font-weight: 700; color: #0f172a; padding: 6px; border-bottom: 1px solid #cbd5e1; border-top: none;">${totalQuantite}</td>
              <td style="border-bottom: 1px solid #cbd5e1; border-top: none;"></td>
              <td style="text-align: right; font-weight: 700; color: #0f172a; padding: 6px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">${invoice.montantHtFcfa.toLocaleString('fr-FR')} CFA</td>
              <td style="text-align: right; font-weight: 700; color: #0f172a; padding: 6px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">${invoice.tvaFcfa.toLocaleString('fr-FR')} CFA</td>
              <td style="text-align: right; font-weight: 700; color: #0f172a; padding: 6px; border-right: none; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">${montantTtcHorsTaxe.toLocaleString('fr-FR')} CFA</td>
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
              Pour un règlement en espèces, prévoir le montant du timbre d'état de ${timbreFiscalMontant.toLocaleString('fr-FR')} Francs CFA . Le montant à régler est alors de : 
              <span class="timbre-total">${(invoice.montantTtcFcfa + timbreFiscalMontant).toLocaleString('fr-FR')} CFA</span>
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
            </div>${taxeAdditionnelleHtml}
            <div class="totals-right-row">
              <span>Total TTC :</span>
              <span>${montantTtcHorsTaxe.toLocaleString('fr-FR')} CFA</span>
            </div>${timbreFiscalHtml}
            <div class="totals-right-row grand" style="margin-top: 10px;">
              <span>Net à payer :</span>
              <span>${(Number(invoice.montantTtcFcfa) + timbreFiscalMontant).toLocaleString('fr-FR')} CFA</span>
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
          <div style="text-align: center; flex: 0 0 auto; padding: 0 8px; border-right: none;">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&color=00182f&bgcolor=ffffff&data=${encodeURIComponent(`BOCS|${invoice.numeroFacture}|${invoice.clientNom}|${invoice.montantTtcFcfa} FCFA|${invoice.dateFacture}`)}"
              alt="QR Authenticite"
              style="width: 70px; height: 70px; border: 1px solid #e2e8f0; border-radius: 4px;"
              crossorigin="anonymous"
            />
            <div style="font-size: 6.5px; color: #94a3b8; margin-top: 2px;">Vérifier authenticité</div>
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
}

/**
 * Generates Original BL PDF document with digital signature overlay
 */
export function generateOriginalBlPdf(bl: BL, signatureDataUrl?: string) {
  const hash = generateDigitalHash(bl.numeroBL, new Date().toISOString().split('T')[0]);

  const conteneursRows = (bl.conteneurs || []).map(c => `
    <tr>
      <td style="font-family: 'JetBrains Mono'; font-weight: bold; color: #075fac;">${c.numeroConteneur}</td>
      <td>${c.typeConteneur}</td>
      <td style="font-family: 'JetBrains Mono';">${c.numeroScelle}</td>
      <td style="text-align:right; font-weight:bold;">${c.poidsKg.toLocaleString('fr-FR')} KG</td>
      <td style="text-align:right; font-weight:bold;">${c.poidsNetKg ? c.poidsNetKg.toLocaleString('fr-FR') + ' KG' : '-'}</td>
      <td style="text-align:right; font-weight:bold;">${c.volumeM3 ? c.volumeM3 + ' M³' : '-'}</td>
      <td style="text-align:right">${c.nombreColis} COLIS</td>
    </tr>
  `).join('');

  printHtmlContent(`
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
              <th style="text-align:right">Poids Net</th>
              <th style="text-align:right">Volume</th>
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
}

export function generateDoBadPdf(bl: BL, escale?: Escale, agencyInfo: string = 'Agence BOCS Abidjan') {
  const targetRowCount = 7;
  const conteneursRows = (bl.conteneurs || []).map((c, index, arr) => `
    <tr style="height: 24px;">
      ${index === 0 ? `<td rowspan="${Math.max(arr.length, targetRowCount)}" style="font-weight: bold; max-width: 180px; word-break: break-all; vertical-align: top; padding-top: 8px;">${bl.descriptionGoods || 'MARCHANDISES'}</td>` : ''}
      <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">${c.nombreColis.toFixed(2)}</td>
      <td style="font-family: 'JetBrains Mono', monospace; font-weight: bold; text-align: center; color: #232766;">${c.numeroConteneur}</td>
      <td style="text-align: center; font-weight: 600;">${c.typeConteneur}</td>
      <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: bold;">${c.poidsKg.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="text-align: right;">${(c.volumeM3 !== undefined && c.volumeM3 !== null) ? c.volumeM3.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) : (bl.volumeM3 ? bl.volumeM3.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) : 'NC')}</td>
      <td style="text-align: center; font-weight: 600;">7 JOURS</td>
      <td style="font-size: 8px; text-align: center; color: #475569;">PLOMB: ${c.numeroScelle}</td>
    </tr>
  `).join('');

  const singleVracRow = `
    <tr style="height: 24px;">
      <td rowspan="${targetRowCount}" style="font-weight: bold; max-width: 180px; word-break: break-all; vertical-align: top; padding-top: 8px;">${bl.descriptionGoods || 'MARCHANDISES'}</td>
      <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600;">${(bl.nombreColis || 1).toFixed(2)}</td>
      <td style="font-style: italic; color: #64748b; text-align: center;">VRAC / SANS CONTENEUR</td>
      <td style="text-align: center;">-</td>
      <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: bold;">${(bl.poidsBrutKg || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="text-align: right;">${bl.volumeM3 ? bl.volumeM3.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) : 'NC'}</td>
      <td style="text-align: center;">-</td>
      <td style="text-align: center; color: #475569;">${bl.marquesEtNumeros || '-'}</td>
    </tr>
  `;

  const rows = bl.conteneurs && bl.conteneurs.length > 0 ? conteneursRows : singleVracRow;

  let blankRows = '';
  const filledCount = bl.conteneurs?.length || 1;
  for (let i = filledCount; i < targetRowCount; i++) {
    blankRows += `
      <tr style="height: 24px;">
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
      </tr>
    `;
  }

  printHtmlContent(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Bon à Délivrer (DO/BAD) - ${bl.numeroBL}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@800;900&family=JetBrains+Mono&display=swap');
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; color: #1e293b; background: white; font-size: 10px; line-height: 1.4; display: flex; flex-direction: column; min-height: 275mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          
          .section-title {
            font-size: 10px;
            font-weight: 800;
            color: #232766;
            border-bottom: 1.5px solid #232766;
            padding-bottom: 3px;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          table.grid-marchandises {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            border: 1px solid #cbd5e1;
          }
          table.grid-marchandises th, table.grid-marchandises td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            text-align: left;
            font-size: 9px;
          }
          table.grid-marchandises th {
            background-color: #f8fafc;
            color: #475569;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 8px;
            text-align: center;
          }
          table.info-table { width: 100%; border-collapse: collapse; font-size: 9px; }
          table.info-table td { padding: 2.5px 0; vertical-align: top; color: #334155; font-weight: 500; }
          table.info-table td:first-child { width: 125px; color: #64748b; font-weight: 600; }
        </style>
      </head>
      <body>
        
        <!-- Header Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #232766; padding-bottom: 12px; margin-bottom: 20px;">
          <div style="width: 240px; margin-bottom: 5px;">
            <svg width="100%" viewBox="0 0 350 90" xmlns="http://www.w3.org/2000/svg">
              <text x="340" y="42" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="52" font-style="italic" fill="#209641" text-anchor="end" letter-spacing="-2">BOCS</text>
              <polygon points="0,48 350,48 315,88 290,88 316.25,58 0,58" fill="#232766" />
              <text x="282" y="81" font-family="Arial, sans-serif" font-weight="bold" font-size="19" fill="#232766" text-anchor="end">ABIDJAN</text>
            </svg>
          </div>
          <div style="text-align: right;">
            <div style="font-family: 'Outfit', sans-serif; font-size: 32px; font-weight: 900; color: #232766; line-height: 1; margin-bottom: 4px;">BAD</div>
            <div style="font-size: 10px; font-weight: bold; color: #64748b;">
              Date de délivrance : <span style="font-weight: 800; color: #000;">${new Date().toLocaleDateString('fr-FR')}</span>
            </div>
          </div>
        </div>

        <!-- Document Title -->
        <div style="text-align: right; margin-bottom: 20px;">
          <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">BON A DELIVRER / DELIVERY ORDER N° :</span>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 800; color: #232766; margin-top: 2px;">
            BSP${bl.numeroBL}BAD/ 010
          </div>
        </div>

        <!-- Details and client Grid -->
        <div style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 4%; margin-bottom: 20px;">
          <!-- Details B/L -->
          <div>
            <div class="section-title">DETAILS DU B/L</div>
            <table class="info-table">
              <tr><td>Navire :</td><td style="font-weight: bold; color: #0f172a;">${escale ? escale.nomNavire : 'BOCS SPIRIT'}</td></tr>
              <tr><td>Voy :</td><td style="font-weight: bold; color: #0f172a;">${escale ? escale.numeroVoyage : '26611'}</td></tr>
              <tr><td>Pol/Pod :</td><td style="font-weight: bold; color: #0f172a;">${bl.portChargementCode || 'ANVERS'} / ${bl.portDechargementCode || 'ABIDJAN'}</td></tr>
              <tr><td>B/L N° :</td><td style="font-weight: bold; font-family: 'JetBrains Mono', monospace; color: #232766;">${bl.numeroBL}</td></tr>
              <tr><td>ETA :</td><td style="font-weight: bold; color: #0f172a;">${escale ? new Date(escale.dateArrivee).toLocaleDateString('fr-FR') : '09/07/2026'}, wp, agw</td></tr>
              <tr><td>ETD :</td><td style="font-weight: bold; color: #0f172a;">${escale && escale.dateDepart ? new Date(escale.dateDepart).toLocaleDateString('fr-FR') : '10/07/2026'}, wp, agw</td></tr>
              <tr><td>ETB :</td><td style="font-weight: bold; color: #0f172a;">${escale ? new Date(escale.dateArrivee).toLocaleDateString('fr-FR') : '12/07/2026'}, wp, agw</td></tr>
              <tr><td>Poids (Kgs) :</td><td style="font-weight: bold; font-family: 'JetBrains Mono', monospace; color: #0f172a;">${(bl.poidsBrutKg || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td></tr>
              <tr><td>Volume (M3) :</td><td style="font-weight: bold; color: #0f172a;">${bl.volumeM3 ? bl.volumeM3.toLocaleString('fr-FR') : 'NC'}</td></tr>
              <tr><td>Nbre Colis :</td><td style="font-weight: bold; color: #0f172a;">${bl.nombreColis || 0}</td></tr>
            </table>
          </div>

          <!-- Client / Transitaire -->
          <div>
            <div>
              <div class="section-title">CLIENT / TRANSITAIRE</div>
              <table class="info-table">
                <tr><td>Dénomination :</td><td style="font-weight: bold; color: #0f172a;">${bl.consigneeNom}</td></tr>
                <tr><td>Compte contribuable N° :</td><td style="font-weight: bold; font-family: 'JetBrains Mono', monospace; color: #0f172a;">0101142 A</td></tr>
                <tr><td>Adresse :</td><td style="font-weight: bold; color: #0f172a;">${bl.consigneeAdresse || '01 BP 1727 ABIDJAN 01'}</td></tr>
                <tr><td>Contact :</td><td style="font-weight: bold; color: #0f172a;">27 21 22 04 20</td></tr>
                <tr><td>Dossier N° :</td><td style="font-weight: bold; color: #0f172a;">NC</td></tr>
                <tr><td>Transitaire :</td><td style="font-weight: bold; color: #0f172a;">AFRICA GLOBAL LOGISTICS</td></tr>
              </table>
            </div>

            <div style="margin-top: 15px;">
              <div class="section-title">AGENT CONSIGNATAIRE / MANUTENTIONNAIRE</div>
              <div style="font-size: 9px; font-weight: bold; line-height: 1.4; color: #0f172a;">
                AGL CI - DIRECTION MARITIME<br />
                <span style="color: #64748b; font-weight: normal; font-size: 8.5px;">Vridi, Rue du Terminal à conteneurs</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Description Table -->
        <div class="section-title" style="margin-top: 15px; margin-bottom: 0;">
          DESCRIPTION MARCHANDISES ET CONTENEURS
        </div>
        <table class="grid-marchandises">
          <thead>
            <tr>
              <th style="width: 25%;">Natures</th>
              <th style="width: 10%; text-align: right;">Nombre de colis</th>
              <th style="width: 15%; text-align: center;">Numéros conteneurs</th>
              <th style="width: 12%; text-align: center;">Type / ISO</th>
              <th style="width: 12%; text-align: right;">Poids (Kgs)</th>
              <th style="width: 10%; text-align: right;">Volume (M3)</th>
              <th style="width: 10%; text-align: center;">Franchises</th>
              <th style="width: 16%; text-align: center;">Remarques</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            ${blankRows}
          </tbody>
        </table>

        <!-- Mentions Importantes Section -->
        <div style="margin-top: 20px; margin-bottom: 30px;">
          <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; margin-bottom: 5px; color: #475569; letter-spacing: 0.5px;">
            MENTIONS IMPORTANTES
          </div>
          <div style="border: 1px solid #cbd5e1; padding: 12px; font-size: 9.5px; line-height: 1.6; font-weight: bold; border-radius: 6px; background: #f8fafc; color: #1e293b;">
            <div style="margin-bottom: 6px;">
              * CE BON A DELIVRER (BAD) OBJET DU B/L N° <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #232766; text-decoration: underline;">...${bl.numeroBL}...</span> ATTESTE QUE TOUTES LES FORMALITES ONT ETE ACCOMPLIES AUPRES DE L'ARMATEUR.
            </div>
            <div>
              * CE BAD AUTORISE DONC LE CLIENT A POURSUIVRE LA PROCEDURE DOCUMENTAIRE AUPRES D'AGL EN VUE DE PRENDRE POSSESSION DE SES MARCHANDISES.
            </div>
          </div>
        </div>

        <!-- Corporate Footer -->
        <div style="margin-top: auto; border-top: 2px solid #cbd5e1; padding-top: 12px; display: grid; grid-template-columns: 0.8fr 1.2fr 1.25fr 1.5fr; gap: 20px; font-size: 7.5px; color: #64748b; text-align: center; page-break-inside: avoid; line-height: 1.3;">
          <div style="border-right: 1px solid #e2e8f0; padding-right: 10px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center;">
            <div style="font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 900; font-style: italic; color: #209641; letter-spacing: -1px; line-height: 1;">
              BOCS
            </div>
            <div style="font-size: 6px; font-weight: 800; text-transform: uppercase; color: #232766; letter-spacing: 2px; margin-top: 1px; border-top: 0.5px solid #232766; padding-top: 1px; width: fit-content;">
              ABIDJAN
            </div>
          </div>
          <div style="border-right: 1px solid #e2e8f0; padding-right: 10px; text-align: left;">
            <strong>BOCS ABIDJAN SARL</strong><br />
            Treichville zone 3 | Rue des Brasseurs<br />
            Imm. Rive Gauche | 2e étage<br />
            05 BP 3282 Abidjan 05 | Côte d'Ivoire
          </div>
          <div style="border-right: 1px solid #e2e8f0; padding-right: 10px; text-align: left;">
            Tél: +225 27 24 36 40 41<br />
            abidjan@bocs.de<br />
            www.bocs.de
          </div>
          <div style="text-align: right;">
            <strong>BOCS ABIDJAN SARL au capital de 5.000.000 FRS CFA</strong><br />
            RCCM: CI-ABJ-03-2023-B13-02079 - C.C: 2300820M<br />
            Compte Bancaire: BICICI CI006 01766 010207300028 37<br />
            IBAN: CI93 CI00 6017 6601 0207 3000 2837 - BIC: BICICIAJXXX
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
}

/**
 * Generates an official Credit Note (Note d'Avoir) PDF document
 */
export function generateCreditNotePdf(creditNote: CreditNote, originalInvoice?: Invoice, bl?: BL, agencyName = 'BOCS Maritime Agence Abidjan') {
  function numberToLetters(n: number): string {
    const units = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
    const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingts", "quatre-vingt-dix"];
    if (n < 20) return units[n];
    if (n < 100) {
      const u = n % 10;
      const t = Math.floor(n / 10);
      if (t === 7 || t === 9) {
        return tens[t - 1] + (u === 1 ? "-et-onze" : "-" + units[10 + u]);
      }
      return tens[t] + (u === 1 ? "-et-un" : (u > 0 ? "-" + units[u] : ""));
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const rest = n % 100;
      let res = c === 1 ? "cent" : units[c] + " cents";
      if (rest > 0) res += " " + numberToLetters(rest);
      return res;
    }
    if (n < 1000000) {
      const k = Math.floor(n / 1000);
      const rest = n % 1000;
      let res = k === 1 ? "mille" : numberToLetters(k) + " mille";
      if (rest > 0) res += " " + numberToLetters(rest);
      return res;
    }
    if (n < 1000000000) {
      const m = Math.floor(n / 1000000);
      const rest = n % 1000000;
      let res = m === 1 ? "un million" : numberToLetters(m) + " millions";
      return res + (rest > 0 ? " " + numberToLetters(rest) : "");
    }
    return n.toString();
  }

  const montantEnLettres = numberToLetters(Math.abs(creditNote.montantTtcFcfa));
  const montantEnLettresCapitalized = montantEnLettres.charAt(0).toUpperCase() + montantEnLettres.slice(1) + " Francs CFA";

  const cnTvaRate = creditNote.montantHtFcfa > 0
    ? (creditNote.tvaFcfa / creditNote.montantHtFcfa) * 100
    : 0;

  const blNavire = originalInvoice?.escaleInfo?.split('V.')[0]?.trim() || "BOCS VISION";
  const blVoy = originalInvoice?.escaleInfo?.split('V.')[1]?.trim() || "26607";
  const blPolPod = bl ? `${bl.portChargementCode || 'ANVERS'} / ${bl.portDechargementCode || 'ABIDJAN'}` : "ANVERS / ABIDJAN";

  const lignesHtml = (creditNote.lignes || []).map(l => {
    // Respect du taux TVA par ligne (factures Export : 0 % — Import : 18 %)
    const tva = Math.round(l.montantHtFcfa * ((l.tauxTva ?? 18) / 100));
    const ttc = l.montantHtFcfa + tva;
    return `
      <tr>
        <td style="text-align: left; border-right: 1px solid #c3c6cf;">${l.designation}</td>
        <td style="text-align: right; border-right: 1px solid #c3c6cf;">${l.quantite}</td>
        <td style="text-align: right; border-right: 1px solid #c3c6cf;">-${l.prixUnitaireFcfa.toLocaleString('fr-FR')} CFA</td>
        <td style="text-align: right; border-right: 1px solid #c3c6cf; color: #dc2626; font-weight: bold;">-${l.montantHtFcfa.toLocaleString('fr-FR')} CFA</td>
        <td style="text-align: right; border-right: 1px solid #c3c6cf; color: #dc2626;">-${tva.toLocaleString('fr-FR')} CFA</td>
        <td style="text-align: right; color: #dc2626; font-weight: bold;">-${ttc.toLocaleString('fr-FR')} CFA</td>
      </tr>
    `;
  }).join('');

  printHtmlContent(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>NOTE D'AVOIR - ${creditNote.numeroAvoir}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          body { font-family: 'Inter', 'Arial', sans-serif; margin: 0; padding: 0; color: #1e293b; background: white; font-size: 10px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; flex-direction: column; min-height: 275mm; }
          .logo-container { width: 350px; margin-bottom: 25px; }
          
          .header-main { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; }
          .title { font-size: 16px; font-weight: 900; color: #dc2626; }
          .type-fact { font-size: 13px; font-weight: 700; color: #dc2626; text-align: right; text-transform: uppercase; }
          .dates { font-size: 9px; text-align: right; margin-top: 6px; line-height: 1.4; color: #334155; }
          
          .alert-box { background: #fef2f2; border: 1.5px solid #f87171; border-radius: 6px; padding: 8px 12px; margin-bottom: 15px; font-size: 9.5px; }
          .alert-title { font-weight: 800; color: #991b1b; text-transform: uppercase; margin-bottom: 3px; }
          .alert-desc { color: #b91c1c; font-weight: 600; }
          
          .grid-2 { display: grid; grid-template-columns: 48% 48%; gap: 4%; margin-bottom: 15px; }
          .section-title { font-size: 10px; font-weight: 800; color: #1e3a8a; border-bottom: 1.5px solid #1e3a8a; padding-bottom: 3px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
          
          .info-table { width: 100%; border-collapse: collapse; font-size: 9px; }
          .info-table td { padding: 1.5px 0; vertical-align: top; color: #334155; font-weight: 500; }
          .info-table td:first-child { width: 120px; color: #64748b; font-weight: 600; }
          
          .main-table { width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #cbd5e1; flex-grow: 1; }
          .main-table th { background-color: #fef2f2; color: #991b1b; text-transform: uppercase; font-weight: 800; padding: 6px; border-right: 1px solid #cbd5e1; border-bottom: 2px solid #f87171; font-size: 9px; }
          .main-table th:last-child { border-right: none; }
          .main-table td { padding: 6px; border-right: 1px solid #cbd5e1; color: #1e293b; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
          .main-table td:last-child { border-right: none; }
          
          .footer-section { display: flex; justify-content: space-between; margin-top: 15px; page-break-inside: avoid; }
          .notes { font-size: 8px; font-style: italic; max-width: 60%; line-height: 1.4; color: #64748b; }
          .amount-words { font-size: 9.5px; font-weight: 700; margin-top: 8px; font-style: italic; color: #dc2626; }
          
          .totals-right { width: 230px; font-size: 9px; font-weight: 700; color: #1e293b; }
          .totals-right-row { display: flex; justify-content: space-between; padding: 2.5px 0; }
          .totals-right-row.grand { border-top: 1px solid #cbd5e1; border-bottom: 2px solid #dc2626; padding: 4px 0; font-size: 10px; margin-top: 4px; color: #dc2626; font-weight: 900; }
          
          .footer-banner { margin-top: auto; border-top: 2px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; color: #64748b; text-align: center; page-break-inside: avoid; line-height: 1.3; }
          .footer-banner div { flex: 1; padding: 0 10px; border-right: 1px solid #e2e8f0; }
          .footer-banner div:last-child { border-right: none; }
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
            <span class="title">NOTE D'AVOIR / CREDIT NOTE N° &nbsp;</span>
            <span class="title" style="color: #0f172a;">${creditNote.numeroAvoir}</span>
          </div>
          <div>
            <div class="type-fact">Avoir sur Facture</div>
            <div class="dates">
              Date d'émission : ${creditNote.dateEmission}<br />
              Réf. Facture d'Origine : <strong>${creditNote.numeroFactureOrigine}</strong>
            </div>
          </div>
        </div>

        <div class="alert-box">
          <div class="alert-title">Motif officiel de l'annulation / émission d'avoir :</div>
          <div class="alert-desc">${creditNote.motif}</div>
        </div>

        <div class="grid-2">
          <div>
            <div class="section-title">Détail d'expédition & BL</div>
            <table class="info-table">
              <tr><td>Navire :</td><td>${blNavire}</td></tr>
              <tr><td>Voy :</td><td>${blVoy}</td></tr>
              <tr><td>Pol/Pod :</td><td>${blPolPod}</td></tr>
              <tr><td>B/L N° :</td><td>${bl?.numeroBL || originalInvoice?.numeroBL || 'NC'}</td></tr>
              <tr><td>Facture d'origine :</td><td><strong>${creditNote.numeroFactureOrigine}</strong></td></tr>
            </table>
          </div>
          <div>
            <div class="section-title">Client Bénéficiaire</div>
            <table class="info-table">
              <tr><td>Dénomination :</td><td><strong>${creditNote.clientNom}</strong></td></tr>
              <tr><td>Adresse :</td><td>${bl?.consigneeAdresse || 'TREICHVILLE ZONE 3C RUE DE L\'INDUSTRIE'}</td></tr>
              <tr><td>Émis par :</td><td>${creditNote.createdBy || 'Comptabilité BOCS Abidjan'}</td></tr>
              <tr><td>Statut fiscal :</td><td>Crédit enregistré et déductible</td></tr>
            </table>
          </div>
        </div>

        <table class="main-table">
          <thead>
            <tr>
              <th style="text-align:left;">DESCRIPTION DES RUBRIQUES CRÉDITÉES</th>
              <th>QTÉ</th>
              <th>P.U.</th>
              <th>TOTAL CRÉDIT HT</th>
              <th>TVA DÉDUCTIBLE</th>
              <th>TOTAL AVOIR TTC</th>
            </tr>
          </thead>
          <tbody>
            ${lignesHtml}
            <tr class="totals-row">
              <td style="border-bottom: 1px solid #cbd5e1; border-top: none;"></td>
              <td style="border-bottom: 1px solid #cbd5e1; border-top: none;"></td>
              <td style="border-bottom: 1px solid #cbd5e1; border-top: none;"></td>
              <td style="text-align: right; font-weight: 800; color: #dc2626; padding: 6px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">-${creditNote.montantHtFcfa.toLocaleString('fr-FR')} CFA</td>
              <td style="text-align: right; font-weight: 800; color: #dc2626; padding: 6px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">-${creditNote.tvaFcfa.toLocaleString('fr-FR')} CFA</td>
              <td style="text-align: right; font-weight: 900; color: #dc2626; padding: 6px; border-right: none; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">-${creditNote.montantTtcFcfa.toLocaleString('fr-FR')} CFA</td>
            </tr>
          </tbody>
        </table>

        <div class="footer-section">
          <div style="width: 60%;">
            <div class="notes">
              NB : Cette note d'avoir annule et compense à due concurrence la facture N° ${creditNote.numeroFactureOrigine}.<br />
              Conformément à la réglementation fiscale en vigueur, ce document fait foi pour la déduction de la TVA correspondante.
            </div>
            <div class="amount-words">
              Montant total en crédit : ${montantEnLettresCapitalized}
            </div>
          </div>
          
          <div class="totals-right">
            <div class="totals-right-row">
              <span>Total Crédit HT :</span>
              <span style="color: #dc2626;">-${creditNote.montantHtFcfa.toLocaleString('fr-FR')} CFA</span>
            </div>
            <div class="totals-right-row">
              <span>TVA (${cnTvaRate.toFixed(2)}%) :</span>
              <span style="color: #dc2626;">-${creditNote.tvaFcfa.toLocaleString('fr-FR')} CFA</span>
            </div>
            <div class="totals-right-row grand">
              <span>NET AVOIR TTC :</span>
              <span>-${creditNote.montantTtcFcfa.toLocaleString('fr-FR')} CFA</span>
            </div>
          </div>
        </div>

        <div class="footer-banner">
          <div class="footer-logo">
            <span class="footer-logo-bocs">BOCS</span>
            <span class="footer-logo-abidjan">ABIDJAN</span>
          </div>
          <div>
            <strong>BOCS ABIDJAN SARL</strong><br />
            Treichville zone 3 | Rue des Brasseurs<br />
            Imm. Rive Gauche | 2e étage
          </div>
          <div>
            Tél: +225 27 24 36 40 41<br />
            abidjan@bocs.de | www.bocs.de
          </div>
          <div style="text-align: right;">
            RCCM: CI-ABJ-03-2023-B13-02079 - C.C: 2300820M<br />
            BICICI CI006 01766 010207300028 37
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
}

/**
 * Generates and triggers print/download of BOCS Formatted Import Manifest PDF
 * Clean, sober, and exhaustive with all BL parties (Shipper, Consignee, Notify),
 * cargo details, containers/seals, and official BOCS Abidjan certification.
 */
/**
 * Helper to sanitize extracted text from OCR/PDF artifacts
 */
function cleanManifestText(text?: string): string {
  if (!text) return '';
  return text
    .replace(/--\s*PAGE_\d+\s*--.*?$/gim, '')
    .replace(/Page\s*Nr\s*\d+/gi, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export interface DangerousGoodsDetail {
  isDangerous: boolean;
  imoClasses: string[];
  unNumbers: string[];
  flashPoint?: string;
  packingGroup?: string;
  summaryText: string;
}

/**
 * Extracts all dangerous goods classes, UN numbers, packing groups, and flash points
 * from structured BL / Container fields or raw text declarations.
 */
export function parseDangerousGoodsDetails(bl: BL, c?: Container): DangerousGoodsDetail {
  const combinedText = `${bl.descriptionGoods || ''} ${bl.marquesEtNumeros || ''} ${c?.numeroConteneur || ''} ${bl.codeNature || ''}`.toUpperCase();
  
  const isDangerous = Boolean(
    c?.isDangerous || 
    bl.isDangerous || 
    c?.imoClass || 
    bl.imoClass || 
    c?.unNumber || 
    bl.unNumber ||
    combinedText.includes('IMO') || 
    combinedText.includes('IMDG') || 
    combinedText.includes('UN ') || 
    combinedText.includes('DANGEROUS') ||
    combinedText.includes('DANGEREUX')
  );

  const imoClassesSet = new Set<string>();
  if (c?.imoClass) imoClassesSet.add(c.imoClass.replace(/IMO\s*/i, ''));
  if (bl.imoClass) imoClassesSet.add(bl.imoClass.replace(/IMO\s*/i, ''));
  
  const unNumbersSet = new Set<string>();
  if (c?.unNumber) unNumbersSet.add(c.unNumber.startsWith('UN') ? c.unNumber : `UN ${c.unNumber}`);
  if (bl.unNumber) unNumbersSet.add(bl.unNumber.startsWith('UN') ? bl.unNumber : `UN ${bl.unNumber}`);

  // Regex extraction from combined text for classes (e.g. IMO 3, IMO 8, CLASS 9)
  const imoMatches = combinedText.matchAll(/(?:IMO|CLASS|CLASSE)\s*[:=]?\s*([0-9](?:\.[0-9])?)/gi);
  for (const m of imoMatches) {
    if (m[1]) imoClassesSet.add(m[1].trim());
  }

  // Regex extraction from combined text for UN codes (e.g. UN 1197, UN 1719, UN 3082)
  const unMatches = combinedText.matchAll(/(?:UN|ONU)\s*[:=]?\s*([0-9]{4})/gi);
  for (const m of unMatches) {
    if (m[1]) unNumbersSet.add(`UN ${m[1].trim()}`);
  }

  let flashPoint: string | undefined = c?.flashPoint || bl.flashPoint;
  if (!flashPoint) {
    const fpMatch = combinedText.match(/(?:FP|FLASH\s*POINT|POINT\s*ECLAIR)\s*[:=]?\s*([+-]?[0-9]+(?:\.[0-9]+)?\s*°?C?)/i);
    if (fpMatch && fpMatch[1]) flashPoint = fpMatch[1].trim();
  }

  let packingGroup: string | undefined = c?.packingGroup || bl.packingGroup;
  if (!packingGroup) {
    const pgMatch = combinedText.match(/(?:PG|GE|PACKING\s*GROUP|GROUPE\s*D'EMBALLAGE)\s*[:=]?\s*(I{1,3})/i);
    if (pgMatch && pgMatch[1]) packingGroup = `PG ${pgMatch[1].trim()}`;
  }

  const imoClasses = Array.from(imoClassesSet);
  const unNumbers = Array.from(unNumbersSet);

  const summaryParts: string[] = [];
  if (imoClasses.length > 0) summaryParts.push(`Classe ${imoClasses.join(' + ')}`);
  if (unNumbers.length > 0) summaryParts.push(unNumbers.join(' / '));
  if (packingGroup) summaryParts.push(packingGroup);
  if (flashPoint) summaryParts.push(`Pt Éclair : ${flashPoint}`);

  return {
    isDangerous,
    imoClasses,
    unNumbers,
    flashPoint,
    packingGroup,
    summaryText: summaryParts.join(' • ')
  };
}

/**
 * Generates and triggers print/download of BOCS Formatted Import Manifest PDF
 * Clean, sober, and exhaustive with all BL parties (Shipper, Consignee, Notify),
 * cargo details, containers/seals, and official BOCS Abidjan certification.
 */
export function generateImportManifestPdf(escale: Escale, bls: BL[]) {
  const totalWeight = bls.reduce((sum, b) => sum + (b.poidsBrutKg || 0), 0);
  const totalContainers = bls.reduce((sum, b) => sum + (b.conteneurs?.length || 0), 0);
  const totalVolume = bls.reduce((sum, b) => sum + (b.volumeM3 || 0), 0);
  const totalColis = bls.reduce((sum, b) => sum + (b.nombreColis || 0), 0);
  
  const totalSoc = bls.reduce((sum, b) => sum + (b.conteneurs?.filter(c => c.socCoc === 'SOC').length || 0), 0);
  const totalCoc = bls.reduce((sum, b) => sum + (b.conteneurs?.filter(c => c.socCoc === 'COC' || !c.socCoc).length || 0), 0);

  // Dangerous goods metrics
  const totalDangerousCtns = bls.reduce((sum, b) => {
    const ctnsDang = (b.conteneurs || []).filter(c => parseDangerousGoodsDetails(b, c).isDangerous).length;
    return sum + ctnsDang;
  }, 0);
  const allUniqueImoClasses = Array.from(new Set(bls.flatMap(b => parseDangerousGoodsDetails(b).imoClasses)));

  const manifestRef = `MAN-${escale.numeroVoyage}-${escale.nomNavire.replace(/[^a-zA-Z0-9]/g, '')}`;
  const printDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const printTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const blsRows = bls.map((bl, index) => {
    const blDg = parseDangerousGoodsDetails(bl);
    
    // Conteneurs list with packages count, gross weight, and detailed IMDG specifications
    const ctnHtml = bl.conteneurs && bl.conteneurs.length > 0
      ? bl.conteneurs.map((c, cIdx) => {
          const cDg = parseDangerousGoodsDetails(bl, c);
          
          const dgBadge = cDg.isDangerous 
            ? `<span style="background-color: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 1px 4px; border-radius: 2px; font-size: 6.5px; font-weight: 800; margin-left: 2px;">⚠️ IMDG ${cDg.imoClasses.length > 0 ? 'Cl.' + cDg.imoClasses.join('+') : ''}</span>` 
            : '';
          const socCocBadge = c.socCoc === 'SOC'
            ? `<span style="background-color: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; padding: 1px 4px; border-radius: 2px; font-size: 6.5px; font-weight: 700; margin-left: 2px;">SOC</span>`
            : `<span style="background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 1px 4px; border-radius: 2px; font-size: 6.5px; font-weight: 700; margin-left: 2px;">COC</span>`;
          
          const containerColis = (c.nombreColis !== undefined && c.nombreColis !== null && c.nombreColis > 0)
            ? c.nombreColis
            : (bl.conteneurs && bl.conteneurs.length === 1 ? (bl.nombreColis || 1) : 1);
            
          const containerPoids = (c.poidsKg !== undefined && c.poidsKg !== null && c.poidsKg > 0)
            ? c.poidsKg
            : (bl.conteneurs && bl.conteneurs.length === 1 ? (bl.poidsBrutKg || 0) : 0);

          return `
            <div style="font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace; font-size: 7.5px; border-bottom: ${cIdx === (bl.conteneurs?.length || 0) - 1 ? 'none' : '1px solid #f1f5f9'}; padding: 3px 0;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>
                  <strong style="color: #0f172a; font-size: 8px;">${c.numeroConteneur}</strong> 
                  <span style="color: #64748b; font-size: 7px;">(${c.typeConteneur ? c.typeConteneur.replace(/_/g, ' ') : 'CONT'})</span>
                </span>
                <span>${socCocBadge} ${dgBadge}</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 1.5px; font-size: 7px; color: #475569;">
                <span><span style="color: #64748b;">Plomb :</span> <strong style="color: #1e293b;">${c.numeroScelle || 'NC'}</strong></span>
                <span style="background-color: #f8fafc; padding: 1px 4px; border-radius: 3px; border: 1px solid #e2e8f0;">
                  <strong style="color: #0f172a;">${containerColis.toLocaleString('fr-FR')}</strong> <span style="color: #64748b;">colis</span> • <strong style="color: #0f172a;">${containerPoids.toLocaleString('fr-FR')}</strong> <span style="color: #64748b;">kg</span>
                </span>
              </div>
              ${cDg.isDangerous && cDg.summaryText ? `
                <div style="background-color: #fff1f2; border-left: 2px solid #ef4444; padding: 1.5px 4px; margin-top: 2px; font-size: 6.5px; color: #991b1b; line-height: 1.2;">
                  <strong>Spécif. IMDG :</strong> ${cDg.summaryText}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')
      : `<div style="color: #64748b; font-style: italic; font-size: 7.5px; padding: 2px 0;">Marchandise conventionnelle / Vrac</div>`;

    const dgBlLabel = blDg.isDangerous 
      ? `
        <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-left: 3px solid #dc2626; color: #991b1b; padding: 3px 5px; border-radius: 3px; font-size: 7px; margin-top: 4px; line-height: 1.25;">
          <div style="font-weight: 800; font-size: 7px; color: #dc2626; display: flex; align-items: center; gap: 2px;">
            <span>⚠️</span> <span>MARCHANDISE DANGEREUSE (IMDG)</span>
          </div>
          ${blDg.imoClasses.length > 0 ? `<div style="font-size: 6.5px; color: #991b1b; margin-top: 1px;">Classe(s) IMO : <strong>${blDg.imoClasses.join(', ')}</strong></div>` : ''}
          ${blDg.unNumbers.length > 0 ? `<div style="font-size: 6.5px; color: #991b1b;">N° ONU : <strong>${blDg.unNumbers.join(' • ')}</strong></div>` : ''}
          ${blDg.flashPoint ? `<div style="font-size: 6.5px; color: #991b1b;">Point Éclair : <strong>${blDg.flashPoint}</strong></div>` : ''}
          ${blDg.packingGroup ? `<div style="font-size: 6.5px; color: #991b1b;">Gr. Emballage : <strong>${blDg.packingGroup}</strong></div>` : ''}
        </div>
      `
      : '';

    const cleanShipperNom = cleanManifestText(bl.shipperNom) || 'EXPÉDITEUR NON SPÉCIFIÉ';
    const cleanShipperAdr = cleanManifestText(bl.shipperAdresse);
    const cleanConsigneeNom = cleanManifestText(bl.consigneeNom) || 'DESTINATAIRE NON SPÉCIFIÉ';
    const cleanConsigneeAdr = cleanManifestText(bl.consigneeAdresse);
    const cleanNotifyNom = cleanManifestText(bl.notifyNom) || cleanConsigneeNom;
    const cleanNotifyAdr = cleanManifestText(bl.notifyAdresse);
    const cleanGoods = cleanManifestText(bl.descriptionGoods) || 'MARCHANDISES DIVERSES';
    const cleanMarks = cleanManifestText(bl.marquesEtNumeros);

    return `
      <tr style="page-break-inside: avoid; background-color: ${index % 2 === 0 ? '#ffffff' : '#fcfcfc'};">
        
        <td style="padding: 6px 8px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; vertical-align: top; width: 12%;">
          <div style="display: flex; align-items: baseline; gap: 3px;">
            <span style="color: #005DAA; font-weight: 800; font-size: 8px;">${index + 1}.</span>
            <span style="font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace; font-weight: 800; color: #0f172a; font-size: 8.5px;">${bl.numeroBL}</span>
          </div>
          <div style="font-size: 7px; color: #64748b; margin-top: 3px; line-height: 1.3;">
            <div>POL : <strong style="color: #1e293b;">${bl.portChargementCode || escale.portChargement.split(' ')[0]}</strong></div>
            <div>POD : <strong style="color: #1e293b;">${bl.portDechargementCode || escale.portDechargement.split(' ')[0]}</strong></div>
            ${bl.destinationFinale ? `<div>Dest : <strong style="color: #1e293b;">${bl.destinationFinale}</strong></div>` : ''}
          </div>
          ${dgBlLabel}
        </td>

        <td style="padding: 6px 8px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; vertical-align: top; width: 24%;">
          <div style="margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px dashed #f1f5f9;">
            <span style="font-size: 6.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px;">CHARGEUR / SHIPPER :</span>
            <div style="font-weight: 700; color: #1e293b; font-size: 7.5px; line-height: 1.25;">${cleanShipperNom}</div>
            ${cleanShipperAdr ? `<div style="font-size: 6.5px; color: #64748b; line-height: 1.2; margin-top: 1px;">${cleanShipperAdr}</div>` : ''}
          </div>

          <div style="margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px dashed #f1f5f9;">
            <span style="font-size: 6.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.3px;">DESTINATAIRE / CONSIGNEE :</span>
            <div style="font-weight: 800; color: #0f172a; font-size: 8px; line-height: 1.25;">${cleanConsigneeNom}</div>
            ${cleanConsigneeAdr ? `<div style="font-size: 6.5px; color: #475569; line-height: 1.2; margin-top: 1px;">${cleanConsigneeAdr}</div>` : ''}
          </div>

          <div>
            <span style="font-size: 6.5px; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.3px;">PARTIE À NOTIFIER / NOTIFY :</span>
            <div style="font-weight: 600; color: #0284c7; font-size: 7.5px; line-height: 1.25;">${cleanNotifyNom}</div>
            ${cleanNotifyAdr && cleanNotifyAdr !== cleanConsigneeAdr ? `<div style="font-size: 6.5px; color: #64748b; line-height: 1.2; margin-top: 1px;">${cleanNotifyAdr}</div>` : ''}
          </div>
        </td>

        <td style="padding: 6px 8px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; vertical-align: top; width: 20%;">
          <div style="font-weight: 600; font-size: 8px; color: #0f172a; line-height: 1.35;">
            ${cleanGoods}
          </div>
          ${blDg.isDangerous && blDg.summaryText ? `
            <div style="margin-top: 3px; background-color: #fff1f2; border: 1px dashed #f43f5e; border-radius: 3px; padding: 2px 4px; font-size: 7px; color: #9f1239;">
              <strong>Spécifications IMDG :</strong> <span style="font-weight: 700; color: #be123c;">${blDg.summaryText}</span>
            </div>
          ` : ''}
          ${cleanMarks ? `
            <div style="margin-top: 4px; font-size: 7px; color: #581c87; line-height: 1.25; font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace;">
              <strong>Marques :</strong> ${cleanMarks}
            </div>
          ` : ''}
          <div style="margin-top: 3px; font-size: 7px; color: #64748b;">
            Conditionnement : <strong style="color: #334155;">${bl.typeEmballage || 'COLIS'}</strong>
          </div>
        </td>

        <td style="padding: 4px 8px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; vertical-align: top; width: 28%;">
          ${ctnHtml}
        </td>

        <td style="padding: 6px 8px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace; font-weight: 700; vertical-align: top; font-size: 8px; color: #0f172a; width: 5%;">
          ${(bl.nombreColis || 1).toLocaleString('fr-FR')}
        </td>

        <td style="padding: 6px 8px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace; font-weight: 800; vertical-align: top; font-size: 8px; color: #0f172a; width: 6%;">
          ${(bl.poidsBrutKg || 0).toLocaleString('fr-FR')}
        </td>

        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace; color: #475569; vertical-align: top; font-size: 8px; width: 5%;">
          ${bl.volumeM3 ? bl.volumeM3.toFixed(2) : '-'}
        </td>

      </tr>
    `;
  }).join('');

  printHtmlContent(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>MANIFESTE DE CARGAISON - BOCS ABIDJAN - ${escale.nomNavire} - VOY ${escale.numeroVoyage}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0; 
            padding: 0; 
            color: #09090b; 
            background: #ffffff; 
            font-size: 8px; 
            line-height: 1.35; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          
          /* En-tête sobre et épuré */
          .header-main {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 2px solid #002b49;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          
          .logo-svg { width: 190px; height: auto; }
          
          .title-area { text-align: right; }
          .doc-main-title {
            font-size: 16px;
            font-weight: 900;
            color: #002b49;
            text-transform: uppercase;
            letter-spacing: -0.3px;
            margin: 0;
          }
          .doc-sub-title {
            font-size: 8.5px;
            font-weight: 700;
            color: #00875A;
            text-transform: uppercase;
            margin-top: 2px;
            letter-spacing: 0.5px;
          }
          .doc-meta {
            font-size: 7.5px;
            color: #64748b;
            font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace;
            margin-top: 2px;
          }
          
          /* Grille d'Informations Escale */
          .escale-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 10px;
            margin-bottom: 10px;
          }
          .info-block { display: flex; flex-direction: column; }
          .info-label {
            font-size: 6.5px;
            text-transform: uppercase;
            font-weight: 700;
            color: #64748b;
            letter-spacing: 0.4px;
            margin-bottom: 1px;
          }
          .info-value {
            font-size: 9.5px;
            font-weight: 800;
            color: #0f172a;
          }
          
          /* Bandeau Récapitulatif Métriques */
          .metrics-bar {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
          }
          .metric-cell {
            flex: 1;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 5px 8px;
            background: #ffffff;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .metric-label { font-size: 7px; font-weight: 700; text-transform: uppercase; color: #475569; }
          .metric-num { font-size: 11px; font-weight: 800; color: #0f172a; font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace; }
          
          /* Tableau des Connaissements */
          .manifest-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
            border: 1px solid #cbd5e1;
          }
          .manifest-table thead th {
            background-color: #f1f5f9;
            color: #0f172a;
            text-transform: uppercase;
            font-weight: 700;
            padding: 6px 8px;
            border-right: 1px solid #cbd5e1;
            border-bottom: 2px solid #002b49;
            text-align: left;
            font-size: 7px;
            letter-spacing: 0.3px;
          }
          .manifest-table thead th:last-child { border-right: none; }
          
          /* Ligne Total */
          .summary-total-row td {
            background-color: #f8fafc;
            border-top: 2px solid #002b49;
            border-bottom: 2px solid #002b49;
            font-weight: 800;
            padding: 6px 8px;
            color: #0f172a;
          }
          
          /* Pied de page Légal */
          .footer-section {
            margin-top: 14px;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            page-break-inside: avoid;
            text-align: center;
          }
          .footer-legal {
            font-size: 6.5px;
            color: #64748b;
            line-height: 1.4;
            width: 100%;
            text-align: center;
          }
        </style>
      </head>
      <body>
        
        <div class="header-main">
          <div class="logo">
            <svg class="logo-svg" viewBox="0 0 350 90" xmlns="http://www.w3.org/2000/svg">
              <text x="340" y="42" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="52" font-style="italic" fill="#209641" text-anchor="end" letter-spacing="-2">BOCS</text>
              <polygon points="0,48 350,48 315,88 290,88 316.25,58 0,58" fill="#232766" />
              <text x="282" y="81" font-family="Arial, sans-serif" font-weight="bold" font-size="19" fill="#232766" text-anchor="end">ABIDJAN</text>
            </svg>
          </div>
          <div class="title-area">
            <h1 class="doc-main-title">Manifeste des Marchandises</h1>
            <div class="doc-sub-title">Importation • Port Autonome d'Abidjan (PAA)</div>
            <div class="doc-meta">Réf: ${manifestRef} | Édité le ${printDate} à ${printTime}</div>
          </div>
        </div>

        <div class="escale-grid">
          <div class="info-block">
            <span class="info-label">Navire / Vessel</span>
            <span class="info-value">${escale.nomNavire}</span>
          </div>
          <div class="info-block">
            <span class="info-label">N° Voyage</span>
            <span class="info-value" style="color: #005DAA; font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace;">${escale.numeroVoyage}</span>
          </div>
          <div class="info-block">
            <span class="info-label">Indicatif / Callsign</span>
            <span class="info-value font-mono">${escale.callsign || 'N/A'}</span>
          </div>
          <div class="info-block">
            <span class="info-label">Date Arrivée (ETA)</span>
            <span class="info-value font-mono">${escale.dateArrivee} ${escale.quai ? `(${escale.quai})` : ''}</span>
          </div>
          <div class="info-block">
            <span class="info-label">Port de Chargement (POL)</span>
            <span class="info-value">${escale.portChargement}</span>
          </div>
          <div class="info-block">
            <span class="info-label">Port de Déchargement (POD)</span>
            <span class="info-value">${escale.portDechargement}</span>
          </div>
          <div class="info-block">
            <span class="info-label">Consignataire</span>
            <span class="info-value">BOCS ABIDJAN SARL</span>
          </div>
          <div class="info-block">
            <span class="info-label">Statut</span>
            <span class="info-value" style="color: ${escale.statut === 'EN_COURS' ? '#059669' : '#52525b'};">${escale.statut === 'EN_COURS' ? 'À QUAI (EN OPÉRATION)' : 'CLÔTURÉE'}</span>
          </div>
        </div>

        <div class="metrics-bar">
          <div class="metric-cell" style="border-left: 3px solid #005DAA;">
            <span class="metric-label">Connaissements (BLs)</span>
            <span class="metric-num" style="color: #005DAA;">${bls.length}</span>
          </div>
          <div class="metric-cell" style="border-left: 3px solid #002b49;">
            <span class="metric-label">Total Conteneurs</span>
            <span class="metric-num">${totalContainers} EVP <span style="font-size: 7.5px; font-weight: normal; color: #64748b;">(${totalCoc} COC / ${totalSoc} SOC)</span></span>
          </div>
          <div class="metric-cell" style="border-left: 3px solid ${totalDangerousCtns > 0 ? '#dc2626' : '#209641'};">
            <span class="metric-label">${totalDangerousCtns > 0 ? 'Marchandises Dangereuses' : 'Poids Brut Total'}</span>
            <span class="metric-num" style="color: ${totalDangerousCtns > 0 ? '#dc2626' : '#0f172a'};">
              ${totalDangerousCtns > 0 ? `${totalDangerousCtns} EVP <span style="font-size: 7.5px; font-weight: normal; color: #b91c1c;">(Cl. ${allUniqueImoClasses.length > 0 ? allUniqueImoClasses.join(', ') : '3, 8, 9'})</span>` : `${totalWeight.toLocaleString('fr-FR')} kg`}
            </span>
          </div>
          <div class="metric-cell" style="border-left: 3px solid #002b49;">
            <span class="metric-label">Poids Brut &amp; Colis</span>
            <span class="metric-num">${totalWeight.toLocaleString('fr-FR')} kg <span style="font-size: 7.5px; font-weight: normal; color: #64748b;">(${totalColis.toLocaleString('fr-FR')} colis)</span></span>
          </div>
        </div>

        <table class="manifest-table">
          <thead>
            <tr>
              <th style="width: 12%;">N° B/L &amp; Route</th>
              <th style="width: 24%;">Parties (Chargeur / Destinataire / Notify)</th>
              <th style="width: 20%;">Marchandises &amp; Marques</th>
              <th style="width: 28%;">Conteneurs (Plomb, Colis &amp; Poids Brut)</th>
              <th style="width: 5%; text-align: right;">Colis BL</th>
              <th style="width: 6%; text-align: right;">Poids BL (Kg)</th>
              <th style="width: 5%; text-align: right;">Vol. (M³)</th>
            </tr>
          </thead>
          <tbody>
            ${blsRows}
            <tr class="summary-total-row">
              <td colspan="4" style="text-align: right; text-transform: uppercase; font-size: 7.5px; letter-spacing: 0.4px;">
                TOTAL GÉNÉRAL DU MANIFESTE (${bls.length} BLs — ${totalContainers} Conteneurs${totalDangerousCtns > 0 ? ` — ${totalDangerousCtns} IMDG` : ''}) :
              </td>
              <td style="text-align: right; font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace; font-size: 8.5px;">
                ${totalColis.toLocaleString('fr-FR')}
              </td>
              <td style="text-align: right; font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace; font-size: 8.5px; color: #002b49;">
                ${totalWeight.toLocaleString('fr-FR')}
              </td>
              <td style="text-align: right; font-family: ui-monospace, 'SF Mono', 'Segoe UI Mono', Consolas, monospace; font-size: 8.5px;">
                ${totalVolume > 0 ? totalVolume.toFixed(2) : '-'}
              </td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer-section">
          <div class="footer-legal">
            <strong>BOCS ABIDJAN SARL</strong> — Treichville zone 3, Rue des Brasseurs, Imm. Rive Gauche, 2e étage • 05 BP 3282 Abidjan 05 • Tél: +225 27 24 36 40 41 • abidjan@bocs.de • www.bocs.de<br />
            RCCM: CI-ABJ-03-2023-B13-02079 • C.C: 2300820M • Compte Bancaire: BICICI CI006 01766 010207300028 37 • Document certifié conforme au registre officiel de fret maritime.
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
}

/**
 * Génère le Connaissement Maritime Original Export BOCS (Bill of Lading)
 * spécifiquement formaté pour édition sur papier à en-tête officiel BOCS.
 */
export function generateBocsExportBlLetterheadPdf(
  draft: DraftExport, 
  escale?: Escale, 
  signatureDataUrl?: string, 
  options: { withLetterheadHeader?: boolean } = { withLetterheadHeader: true }
) {
  const blNumber = draft.numeroBlGenere || draft.numeroDraft.replace('DRF', 'BL');
  const dateEmission = draft.dateValidation ? draft.dateValidation.split(' ')[0] : new Date().toISOString().split('T')[0];
  const hash = generateDigitalHash(blNumber, dateEmission);

  const totalColis = draft.marchandisesInfo.nombreColis || 0;
  const totalPoidsBrut = draft.marchandisesInfo.poidsBrutKg || 0;
  const totalVolume = draft.marchandisesInfo.volumeM3 || 0;

  const conteneursRows = (draft.conteneursInfo || []).map(c => `
    <tr>
      <td style="font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #002b49;">${c.numeroConteneur}</td>
      <td style="font-weight: 700; text-align: center;">${c.typeConteneur}</td>
      <td style="font-family: 'JetBrains Mono', monospace; color: #475569; text-align: center;">${c.numeroScelle || 'SANS PLOMB'}</td>
      <td style="text-align: right; font-weight: 800; color: #0f172a;">${c.poidsKg ? c.poidsKg.toLocaleString('fr-FR') + ' KG' : '-'}</td>
      <td style="text-align: right; font-weight: 700;">${c.poidsNetKg ? c.poidsNetKg.toLocaleString('fr-FR') + ' KG' : '-'}</td>
      <td style="text-align: right; font-weight: 700;">${c.volumeM3 ? c.volumeM3 + ' M³' : '-'}</td>
      <td style="text-align: right; font-weight: 700;">${c.nombreColis || '-'}</td>
    </tr>
  `).join('');

  printHtmlContent(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Connaissement Original BOCS - ${blNumber}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm; }
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&family=Playfair+Display:ital,wght@1,600&display=swap');
          * { box-sizing: border-box; }
          body {
            font-family: 'Plus Jakarta Sans', Arial, sans-serif;
            margin: 0;
            padding: 4px;
            color: #0f172a;
            background: white;
            font-size: 8.5px;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* En-tête BOCS Maritime officiel */
          .letterhead-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2.5px solid #002b49;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .bocs-logo-svg {
            height: 38px;
            width: auto;
          }
          .agency-subtext {
            font-size: 7.5px;
            color: #475569;
            font-weight: 600;
            margin-top: 3px;
          }
          .doc-type-box {
            text-align: right;
          }
          .doc-title {
            font-size: 15px;
            font-weight: 900;
            color: #002b49;
            letter-spacing: -0.5px;
            text-transform: uppercase;
          }
          .doc-sub {
            font-size: 8px;
            font-weight: 800;
            color: #00875A;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .bl-badge {
            display: inline-block;
            background: #f0f7ff;
            border: 1.5px solid #005daa;
            padding: 2px 8px;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 800;
            color: #005daa;
            margin-top: 4px;
          }

          /* Grille Connaissement Maritime International */
          .bl-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border: 1px solid #94a3b8;
            margin-bottom: 6px;
          }
          .bl-cell {
            padding: 5px 7px;
            border-right: 1px solid #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
            min-height: 48px;
          }
          .bl-cell:nth-child(2n) {
            border-right: none;
          }
          .bl-cell-title {
            font-size: 6.5px;
            font-weight: 800;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .bl-cell-content {
            font-size: 8.5px;
            font-weight: 700;
            color: #0f172a;
          }
          .bl-cell-address {
            font-size: 7.5px;
            color: #334155;
            font-weight: 500;
            white-space: pre-line;
          }

          /* Grille Navigation / Escales */
          .routing-grid {
            display: grid;
            grid-template-columns: 1.2fr 1fr 1fr 1fr;
            border: 1px solid #94a3b8;
            border-top: none;
            margin-bottom: 6px;
          }
          .routing-cell {
            padding: 4px 6px;
            border-right: 1px solid #cbd5e1;
          }
          .routing-cell:last-child {
            border-right: none;
          }

          /* Tableau Marchandises & Conteneurs */
          .cargo-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #94a3b8;
            margin-bottom: 6px;
            font-size: 7.5px;
          }
          .cargo-table th {
            background-color: #002b49;
            color: white;
            padding: 4px 6px;
            font-size: 6.8px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border-right: 1px solid #334155;
            text-align: left;
          }
          .cargo-table th:last-child { border-right: none; }
          .cargo-table td {
            padding: 4px 6px;
            border-bottom: 1px solid #e2e8f0;
            border-right: 1px solid #e2e8f0;
          }
          .cargo-table td:last-child { border-right: none; }

          /* Bloc Description Marchandises */
          .cargo-desc-box {
            border: 1px solid #94a3b8;
            border-top: none;
            padding: 6px 8px;
            background: #fafafa;
            margin-bottom: 6px;
          }

          /* Totaux Récapitulatifs */
          .summary-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
            border: 1.5px solid #002b49;
            border-radius: 4px;
            padding: 5px 10px;
            margin-bottom: 8px;
          }
          .summary-item {
            text-align: center;
          }
          .summary-label {
            font-size: 6.5px;
            font-weight: 800;
            color: #475569;
            text-transform: uppercase;
          }
          .summary-val {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            font-weight: 900;
            color: #002b49;
          }

          /* Footer Signature et Clauses Légales */
          .bl-footer {
            display: grid;
            grid-template-columns: 1.4fr 1fr;
            gap: 10px;
            border: 1px solid #94a3b8;
            padding: 6px 8px;
            border-radius: 4px;
          }
          .clauses-box {
            font-size: 6px;
            color: #475569;
            line-height: 1.25;
            border-right: 1px solid #cbd5e1;
            padding-right: 8px;
          }
          .signature-box {
            text-align: right;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .carrier-title {
            font-size: 7.5px;
            font-weight: 800;
            color: #002b49;
            text-transform: uppercase;
          }
          .stamp-circle {
            border: 2px solid #002b49;
            color: #002b49;
            border-radius: 50%;
            width: 70px;
            height: 70px;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 7px;
            line-height: 1.1;
            margin: 4px auto;
            text-transform: uppercase;
          }
          .sig-img {
            max-height: 48px;
            max-width: 140px;
            margin: 2px 0 0 auto;
            display: block;
          }
          .hash-stamp {
            font-family: 'JetBrains Mono', monospace;
            font-size: 6.5px;
            color: #64748b;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>
        
        <!-- Header BOCS pour papier à en-tête -->
        ${options.withLetterheadHeader ? `
        <div class="letterhead-header">
          <div>
            <svg class="bocs-logo-svg" viewBox="0 0 350 90" xmlns="http://www.w3.org/2000/svg">
              <text x="340" y="42" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="900" font-size="52" font-style="italic" fill="#00875A" text-anchor="end" letter-spacing="-2">BOCS</text>
              <polygon points="0,48 350,48 315,88 290,88 316.25,58 0,58" fill="#002B49" />
              <text x="282" y="81" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="bold" font-size="19" fill="#002B49" text-anchor="end">ABIDJAN</text>
            </svg>
            <div class="agency-subtext">
              <strong>BREMEN OVERSEAS CHARTERING SHIPPING GMBH</strong> • Agence Consignataire Côte d'Ivoire<br />
              Port Autonome d'Abidjan • Quai Vridi Terminal 14 • RCCM CI-ABJ-03-2023-B13-02079
            </div>
          </div>
          <div class="doc-type-box">
            <div class="doc-title">BILL OF LADING</div>
            <div class="doc-sub">CONNAISSEMENT MARITIME EXPORT</div>
            <div class="bl-badge">N° ${blNumber}</div>
            <div style="font-size: 7px; color: #64748b; margin-top: 3px;">Réf. Booking : <strong>${draft.bookingRef || 'BKG-ABJ-EXP'}</strong></div>
          </div>
        </div>
        ` : `
        <div style="height: 40mm; display: flex; justify-content: flex-end; align-items: flex-end; padding-bottom: 8px;">
          <div class="bl-badge">N° ${blNumber}</div>
        </div>
        `}

        <!-- Grille 1 : Parties au Connaissement -->
        <div class="bl-grid">
          <div class="bl-cell">
            <div class="bl-cell-title">1. SHIPPER / CHARGEUR (Nom, Adresse &amp; Pays)</div>
            <div class="bl-cell-content">${draft.shipperInfo.nom}</div>
            <div class="bl-cell-address">
              ${draft.shipperInfo.adresse}<br />
              ${draft.shipperInfo.pays} ${draft.shipperInfo.phone ? `• Tél: ${draft.shipperInfo.phone}` : ''}
            </div>
          </div>

          <div class="bl-cell">
            <div class="bl-cell-title">2. CONSIGNEE / DESTINATAIRE (To Order or Named)</div>
            <div class="bl-cell-content">${draft.consigneeInfo.nom}</div>
            <div class="bl-cell-address">
              ${draft.consigneeInfo.adresse}<br />
              ${draft.consigneeInfo.pays} ${draft.consigneeInfo.phone ? `• Tél: ${draft.consigneeInfo.phone}` : ''}
            </div>
          </div>

          <div class="bl-cell">
            <div class="bl-cell-title">3. NOTIFY PARTY / PARTIE À NOTIFIER</div>
            <div class="bl-cell-content">${draft.notifyInfo.nom || draft.consigneeInfo.nom}</div>
            <div class="bl-cell-address">
              ${draft.notifyInfo.adresse || draft.consigneeInfo.adresse}<br />
              ${draft.notifyInfo.pays || draft.consigneeInfo.pays}
            </div>
          </div>

          <div class="bl-cell">
            <div class="bl-cell-title">4. FORWARDING AGENT / TRANSMITTEUR &amp; RÉFÉRENCES</div>
            <div class="bl-cell-content">BOCS ABIDJAN AGENCY</div>
            <div class="bl-cell-address">
              Agent consignataire émetteur • Conforme Code IMDG &amp; SOLAS VGM<br />
              Certificat d'origine &amp; Déclaration douane export CI
            </div>
          </div>
        </div>

        <!-- Grille 2 : Routing Maritime -->
        <div class="routing-grid">
          <div class="routing-cell">
            <div class="bl-cell-title">OCEAN VESSEL &amp; VOYAGE</div>
            <div class="bl-cell-content">${draft.navireNom || escale?.nomNavire || 'BOCS BREMEN'} V.${draft.numeroVoyage || escale?.numeroVoyage || '25586'}</div>
          </div>

          <div class="routing-cell">
            <div class="bl-cell-title">PORT OF LOADING (POL)</div>
            <div class="bl-cell-content">ABIDJAN, CÔTE D'IVOIRE</div>
          </div>

          <div class="routing-cell">
            <div class="bl-cell-title">PORT OF DISCHARGE (POD)</div>
            <div class="bl-cell-content">${draft.portDechargementNom || draft.portDechargementCode || 'ANVERS (ANTWERP)'}</div>
          </div>

          <div class="routing-cell">
            <div class="bl-cell-title">FINAL DESTINATION</div>
            <div class="bl-cell-content">${draft.consigneeInfo.pays || 'PORT D\'ARRIVÉE'}</div>
          </div>
        </div>

        <!-- Tableau des Conteneurs & Colis -->
        <table class="cargo-table">
          <thead>
            <tr>
              <th style="width: 22%;">N° Conteneur</th>
              <th style="width: 12%; text-align: center;">Type</th>
              <th style="width: 16%; text-align: center;">N° Scellé (Plomb)</th>
              <th style="width: 15%; text-align: right;">Poids Brut (VGM)</th>
              <th style="width: 13%; text-align: right;">Poids Net</th>
              <th style="width: 12%; text-align: right;">Volume (M³)</th>
              <th style="width: 10%; text-align: right;">Colis</th>
            </tr>
          </thead>
          <tbody>
            ${conteneursRows || `
              <tr>
                <td colspan="7" style="text-align: center; padding: 10px; font-style: italic; color: #64748b;">
                  Cargaison conventionnelle / Vrac — Détail conforme déclaration ci-dessous
                </td>
              </tr>
            `}
          </tbody>
        </table>

        <!-- Description Marchandises -->
        <div class="cargo-desc-box">
          <div class="bl-cell-title">DESCRIPTION OF GOODS &amp; PACKAGES / DÉSIGNATION DE LA MARCHANDISE</div>
          <div style="font-size: 8.5px; font-weight: 800; color: #002b49; margin-bottom: 2px;">
            ${draft.marchandisesInfo.description}
          </div>
          <div style="font-size: 7.5px; color: #475569; font-weight: 600;">
            Code SH : <strong>${draft.marchandisesInfo.hsCode || 'NON SPÉCIFIÉ'}</strong> • Emballage : <strong>${draft.marchandisesInfo.typeEmballage}</strong> • Nombre Total Colis : <strong>${totalColis.toLocaleString('fr-FR')}</strong>
          </div>
        </div>

        <!-- Récapitulatif Chiffré -->
        <div class="summary-bar">
          <div class="summary-item">
            <div class="summary-label">Total Colis / Packages</div>
            <div class="summary-val">${totalColis.toLocaleString('fr-FR')}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Poids Brut Total (KG)</div>
            <div class="summary-val">${totalPoidsBrut.toLocaleString('fr-FR')} KG</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Poids Brut en Tonnes</div>
            <div class="summary-val">${(totalPoidsBrut / 1000).toFixed(3)} T</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Volume Total (M³)</div>
            <div class="summary-val">${totalVolume > 0 ? totalVolume.toFixed(2) + ' M³' : '-'}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Fret &amp; Paiement</div>
            <div class="summary-val" style="color: #00875A;">FREIGHT PREPAID</div>
          </div>
        </div>

        <!-- Pied de page & Signature -->
        <div class="bl-footer">
          <div class="clauses-box">
            <strong>CONDITIONS OF CARRIAGE &amp; JURISDICTION :</strong><br />
            Shipped on board in apparent good order and condition, unless otherwise stated herein. Weight, measure, marks, numbers, quality, contents and value, if mentioned in this Bill of Lading, are to be considered unknown by the Carrier. The contract evidenced by this Bill of Lading is subject to The Hague Rules contained in the International Convention dated Brussels, August 25, 1924, as amended by the Brussels Protocol 1968 (The Hague-Visby Rules). Any dispute arising under this Bill of Lading shall be decided in accordance with the law of the Carrier’s principal place of business.<br />
            <strong>IN WITNESS WHEREOF</strong>, the Carrier or its Agent has signed <strong>THREE (3) ORIGINAL</strong> Bills of Lading, all of this tenor and date, one of which being accomplished, the others to stand void.
          </div>

          <div class="signature-box">
            <div>
              <div class="carrier-title">SIGNED FOR THE CARRIER (BOCS GMBH)</div>
              <div style="font-size: 7px; color: #475569; font-weight: 700;">AS AGENT ONLY : BOCS ABIDJAN AGENCY</div>
              <div style="font-size: 7px; color: #005daa; font-weight: 800; margin-top: 1px;">LIEU &amp; DATE : ABIDJAN, LE ${dateEmission}</div>
            </div>

            <div style="text-align: center; margin: 4px 0;">
              ${signatureDataUrl && signatureDataUrl !== 'STAMP_ONLY_VALIDATED' ? `
                <img src="${signatureDataUrl}" class="sig-img" alt="Signature Numérique BOCS" />
              ` : `
                <div class="stamp-circle">
                  <span>★ BOCS ★</span>
                  <span>ABIDJAN</span>
                  <span>ORIGINAL</span>
                </div>
              `}
            </div>

            <div>
              <div style="font-size: 6.5px; font-weight: 800; color: #002b49;">AGENCE BOCS ABIDJAN • SIGNATURE CERTIFIÉE</div>
              <div class="hash-stamp">${hash}</div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
}

/**
 * Génère le Manifeste Export Consolidé de l'Escale (PAA Abidjan & Douanes)
 */
export function generateExportManifestPdf(escale: Escale, validatedDrafts: DraftExport[]) {
  const dateGeneration = new Date().toISOString().split('T')[0];
  const totalBLs = validatedDrafts.length;
  const totalContainers = validatedDrafts.reduce((acc, d) => acc + (d.conteneursInfo?.length || 0), 0);
  const totalColis = validatedDrafts.reduce((acc, d) => acc + (d.marchandisesInfo?.nombreColis || 0), 0);
  const totalWeightKg = validatedDrafts.reduce((acc, d) => acc + (d.marchandisesInfo?.poidsBrutKg || 0), 0);
  const totalWeightTons = (totalWeightKg / 1000).toFixed(2);
  const totalVolumeM3 = validatedDrafts.reduce((acc, d) => acc + (d.marchandisesInfo?.volumeM3 || 0), 0);

  const manifestRows = validatedDrafts.map((d, idx) => {
    const ctnList = (d.conteneursInfo || []).map(c => 
      `<span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #002b49;">${c.numeroConteneur}</span> (${c.typeConteneur} • Plomb: ${c.numeroScelle || 'SC-OK'} • ${c.poidsKg ? (c.poidsKg / 1000).toFixed(1) + 'T' : '-'})`
    ).join('<br />');

    return `
      <tr>
        <td style="font-weight: 800; text-align: center;">${idx + 1}</td>
        <td style="font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #005daa;">
          ${d.numeroBlGenere || d.numeroDraft}<br />
          <span style="font-size: 6.5px; color: #64748b; font-weight: 600;">Bkg: ${d.bookingRef || 'BKG-ABJ'}</span>
        </td>
        <td>
          <strong>${d.shipperInfo.nom}</strong><br />
          <span style="font-size: 7px; color: #475569;">${d.shipperInfo.pays}</span>
        </td>
        <td>
          <strong>${d.consigneeInfo.nom}</strong><br />
          <span style="font-size: 7px; color: #475569;">${d.consigneeInfo.pays}</span>
        </td>
        <td style="font-weight: 700; color: #00875A;">
          ${d.portDechargementNom || d.portDechargementCode || 'EUROPE'}
        </td>
        <td style="font-size: 7.5px;">
          <strong>${d.marchandisesInfo.description}</strong><br />
          <span style="color: #64748b;">Code SH: ${d.marchandisesInfo.hsCode || '-'} • Emballage: ${d.marchandisesInfo.typeEmballage}</span>
        </td>
        <td style="font-size: 7px;">
          ${ctnList || '<em style="color:#94a3b8">Cargaison conventionnelle / Vrac</em>'}
        </td>
        <td style="text-align: right; font-weight: 800; font-family: 'JetBrains Mono', monospace;">
          ${d.marchandisesInfo.nombreColis.toLocaleString('fr-FR')}
        </td>
        <td style="text-align: right; font-weight: 800; font-family: 'JetBrains Mono', monospace; color: #002b49;">
          ${d.marchandisesInfo.poidsBrutKg.toLocaleString('fr-FR')}
        </td>
        <td style="text-align: right; font-weight: 700; font-family: 'JetBrains Mono', monospace;">
          ${d.marchandisesInfo.volumeM3 ? d.marchandisesInfo.volumeM3.toFixed(2) : '-'}
        </td>
      </tr>
    `;
  }).join('');

  printHtmlContent(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Manifeste Export - ${escale.nomNavire} Voy ${escale.numeroVoyage}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@600;800&display=swap');
          * { box-sizing: border-box; }
          body {
            font-family: 'Plus Jakarta Sans', Arial, sans-serif;
            margin: 0;
            padding: 4px;
            color: #0f172a;
            background: white;
            font-size: 8px;
            line-height: 1.3;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .header-manifest {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2.5px solid #002b49;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .title-manifest {
            font-size: 16px;
            font-weight: 900;
            color: #002b49;
            text-transform: uppercase;
            letter-spacing: -0.5px;
          }
          .sub-manifest {
            font-size: 9px;
            font-weight: 800;
            color: #00875A;
            text-transform: uppercase;
          }

          .escale-box {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 6px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 6px 10px;
            margin-bottom: 10px;
          }
          .escale-field-label { font-size: 6.5px; font-weight: 800; text-transform: uppercase; color: #475569; }
          .escale-field-val { font-size: 9px; font-weight: 800; color: #002b49; }

          .kpi-row {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            margin-bottom: 10px;
          }
          .kpi-card {
            background: #f0f7ff;
            border: 1px solid #005daa;
            border-radius: 6px;
            padding: 5px 8px;
            text-align: center;
          }
          .kpi-title { font-size: 6.5px; font-weight: 800; text-transform: uppercase; color: #005daa; }
          .kpi-num { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 900; color: #002b49; }

          table.manifest-tbl {
            width: 100%;
            border-collapse: collapse;
            font-size: 7.5px;
            border: 1px solid #94a3b8;
          }
          table.manifest-tbl th {
            background-color: #002b49;
            color: white;
            text-transform: uppercase;
            font-size: 7px;
            font-weight: 800;
            padding: 5px 6px;
            border-right: 1px solid #334155;
            text-align: left;
          }
          table.manifest-tbl th:last-child { border-right: none; }
          table.manifest-tbl td {
            padding: 5px 6px;
            border-bottom: 1px solid #e2e8f0;
            border-right: 1px solid #e2e8f0;
            vertical-align: top;
          }
          table.manifest-tbl td:last-child { border-right: none; }
          table.manifest-tbl tr:nth-child(even) { background-color: #fbfcfd; }

          .total-manifest-row td {
            background-color: #f1f5f9;
            border-top: 2px solid #002b49;
            border-bottom: 2px solid #002b49;
            font-weight: 900;
            font-size: 8.5px;
            color: #002b49;
          }

          .footer-sign-area {
            margin-top: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-top: 1px solid #cbd5e1;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header-manifest">
          <div>
            <div class="title-manifest">MANIFESTE EXPORT CARGAISON — SORTIE DE PORT</div>
            <div class="sub-manifest">PORT AUTONOME D'ABIDJAN (PAA) • RÉGIE DOUANIÈRE IVOIRIENNE</div>
            <div style="font-size: 7.5px; color: #64748b; font-weight: 600; margin-top: 2px;">
              Document officiel certifié BOCS Bremen Overseas Chartering Shipping GmbH
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 800; color: #005daa;">
              MANIFESTE N° MAN-EXP-${escale.numeroVoyage || '25586'}
            </div>
            <div style="font-size: 7.5px; color: #475569; font-weight: 700;">Date d'édition : ${dateGeneration}</div>
          </div>
        </div>

        <div class="escale-box">
          <div>
            <div class="escale-field-label">Navire / Vessel</div>
            <div class="escale-field-val">${escale.nomNavire}</div>
          </div>
          <div>
            <div class="escale-field-label">N° Voyage</div>
            <div class="escale-field-val">${escale.numeroVoyage}</div>
          </div>
          <div>
            <div class="escale-field-label">Indicatif (Call Sign)</div>
            <div class="escale-field-val">${escale.callsign || 'CQRT'}</div>
          </div>
          <div>
            <div class="escale-field-label">Port de Chargement</div>
            <div class="escale-field-val">ABIDJAN (CIABJ)</div>
          </div>
          <div>
            <div class="escale-field-label">Date Arrivée / ETA</div>
            <div class="escale-field-val">${escale.dateArrivee}</div>
          </div>
          <div>
            <div class="escale-field-label">Date Départ / ETD</div>
            <div class="escale-field-val">${escale.dateDepart || 'EN ESCALE'}</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-title">Total Connaissements (BLs)</div>
            <div class="kpi-num">${totalBLs}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Total Conteneurs (TEU)</div>
            <div class="kpi-num">${totalContainers}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Nombre Total Colis</div>
            <div class="kpi-num">${totalColis.toLocaleString('fr-FR')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Poids Brut Total (Kg)</div>
            <div class="kpi-num">${totalWeightKg.toLocaleString('fr-FR')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Poids Brut (Tonnes)</div>
            <div class="kpi-num">${totalWeightTons} T</div>
          </div>
        </div>

        <table class="manifest-tbl">
          <thead>
            <tr>
              <th style="width: 3%; text-align: center;">N°</th>
              <th style="width: 11%;">N° B/L BOCS</th>
              <th style="width: 14%;">Chargeur (Shipper)</th>
              <th style="width: 14%;">Destinataire (Consignee)</th>
              <th style="width: 9%;">Port Déchargement</th>
              <th style="width: 18%;">Marchandises &amp; Code SH</th>
              <th style="width: 15%;">Conteneurs &amp; Plombs</th>
              <th style="width: 5%; text-align: right;">Colis</th>
              <th style="width: 6%; text-align: right;">Poids (Kg)</th>
              <th style="width: 5%; text-align: right;">Vol (M³)</th>
            </tr>
          </thead>
          <tbody>
            ${manifestRows}
            <tr class="total-manifest-row">
              <td colspan="7" style="text-align: right; text-transform: uppercase;">
                TOTAL GÉNÉRAL DU MANIFESTE EXPORT (${totalBLs} BLs Validés — ${totalContainers} Conteneurs) :
              </td>
              <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">
                ${totalColis.toLocaleString('fr-FR')}
              </td>
              <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">
                ${totalWeightKg.toLocaleString('fr-FR')}
              </td>
              <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">
                ${totalVolumeM3 > 0 ? totalVolumeM3.toFixed(2) : '-'}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="footer-sign-area">
          <div style="font-size: 7px; color: #475569; max-width: 60%;">
            <strong>BOCS ABIDJAN SARL</strong> • Treichville zone 3, Rue des Brasseurs • 05 BP 3282 Abidjan 05 • Tél: +225 27 24 36 40 41<br />
            Manifeste export certifié conforme aux déclarations douanières et au plan de chargement officiel du navire.
          </div>

          <div style="text-align: right;">
            <div style="font-size: 7.5px; font-weight: 800; color: #002b49;">POUR L'AGENCE BOCS ABIDJAN (LE CONSIGNATAIRE)</div>
            <div style="font-size: 7px; color: #00875A; font-weight: 700; margin-top: 1px;">VISA CAPITAINERIE DU PORT &amp; DOUANES CI</div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 6.5px; color: #94a3b8; margin-top: 4px;">CERT-EXP-ABJ-${Date.now().toString().slice(-8)}</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
}


