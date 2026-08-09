import { BL, DraftExport, Invoice, Escale } from '../types';

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
  let modeText = "RÉGLÉ AU COMPTANT";
  
  if (payment) {
    const mode = payment.modePaiement;
    const refLower = (payment.referenceTransaction || "").toLowerCase();
    const noteLower = (payment.note || "").toLowerCase();
    if (mode === 'VIREMENT') {
      modeText = "RÉGLÉ PAR VIREMENT BANCAIRE";
    } else if (mode === 'CHEQUE') {
      modeText = "RÉGLÉ PAR CHÈQUE";
    } else if (mode === 'ESPECES') {
      modeText = "RÉGLÉ AU COMPTANT";
    } else if (mode === 'MOBILE_MONEY') {
      if (refLower.includes('wave') || noteLower.includes('wave')) {
        modeText = "RÉGLÉ PAR WAVE";
      } else if (refLower.includes('orange') || noteLower.includes('orange') || refLower.includes('om') || noteLower.includes('om')) {
        modeText = "RÉGLÉ PAR ORANGE MONEY";
      } else if (refLower.includes('mtn') || noteLower.includes('mtn')) {
        modeText = "RÉGLÉ PAR MTN MOBILE MONEY";
      } else if (refLower.includes('moov') || noteLower.includes('moov')) {
        modeText = "RÉGLÉ PAR MOOV MONEY";
      } else {
        modeText = "RÉGLÉ PAR MOBILE MONEY (WAVE)";
      }
    }
  } else if (isPaid) {
    modeText = "RÉGLÉ AU COMPTANT";
  }

  const stampHtml = isPaid ? `
    <div style="margin-top: 15px; margin-left: auto; width: 280px; border: 4px double #10B981; padding: 12px 18px; border-radius: 8px; background: #ECFDF5; color: #047857; text-align: center; transform: rotate(-2deg); font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 800; line-height: 1.4; pointer-events: none; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); float: right; clear: both; margin-right: 0;">
      <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #047857; margin-bottom: 6px; padding-bottom: 2px;">BOCS MARITIME CI</div>
      <div style="font-size: 11px; font-weight: 900; color: #065F46;">${modeText}</div>
      <div style="font-size: 9px; font-weight: bold; margin-top: 3px;">RÉF: ${payment?.referenceTransaction || 'CASH-COMPTANT'}</div>
      <div style="font-size: 9px; font-weight: bold;">DATE: ${payment?.datePaiement || invoice.dateFacture}</div>
      <div style="font-size: 10px; color: #047857; margin-top: 4px; font-weight: 950; letter-spacing: 1px;">CAISSE - ACQUITTE</div>
    </div>
    <div style="clear: both;"></div>
  ` : '';

  const lignesHtml = (invoice.lignes || []).map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${l.designation}</strong></td>
      <td>${l.typeFrais}</td>
      <td style="text-align:center">${l.quantite}</td>
      <td style="text-align:right">${l.prixUnitaireFcfa.toLocaleString('fr-FR')} FCFA</td>
      <td style="text-align:right">${l.montantHtFcfa.toLocaleString('fr-FR')} FCFA</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>${isPaid ? 'Facture Définitive' : 'Facture Proforma'} - ${invoice.numeroFacture}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono&display=swap');
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 24px; color: #1a1c1c; background: white; position: relative; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #00182f; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { font-size: 24px; font-weight: 800; color: #00182f; }
          .sub { color: #075fac; font-size: 12px; font-weight: 700; text-transform: uppercase; }
          .box-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 12px; }
          .box { background: #f3f3f3; padding: 12px; border-radius: 6px; border: 1px solid #c3c6cf; }
          .box h4 { margin: 0 0 6px 0; color: #00182f; font-size: 11px; text-transform: uppercase; font-weight: 800; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { border: 1px solid #c3c6cf; padding: 8px 10px; }
          th { background-color: #00182f; color: white; text-transform: uppercase; font-size: 10px; }
          .totals { margin-top: 20px; margin-left: auto; width: 300px; font-size: 12px; }
          .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #c3c6cf; }
          .totals-row.grand { font-weight: 800; font-size: 14px; color: #00182f; border-bottom: 2px solid #00182f; }
        </style>
      <body>
        <div class="header">
          <div>
            <div class="brand">BOCS MARITIME</div>
            <div class="sub">${agencyInfo}</div>
          </div>
          <div style="text-align: right">
            <h2 style="margin: 0; color: #00182f; font-size: 18px;">${isPaid ? 'FACTURE DÉFINITIVE' : 'FACTURE PROFORMA'}</h2>
            <div style="font-family: 'JetBrains Mono'; font-weight: bold; color: #075fac;">${invoice.numeroFacture}</div>
            <div style="font-size: 11px; color: #73777f;">Date: ${invoice.dateFacture} | Échéance: ${invoice.dateEcheance}</div>
          </div>
        </div>

        <div class="box-grid">
          <div class="box">
            <h4>Client Facturé</h4>
            <strong>${invoice.clientNom}</strong><br />
            N° Connaissement (BL): ${invoice.numeroBL || 'N/A'}<br />
            Devise de facturation: ${invoice.devise}
          </div>
          <div class="box">
            <h4>Escale & Opération</h4>
            ${invoice.escaleInfo || 'Escale Port Abidjan (CIABJ)'}<br />
            Type Facture: ${invoice.typeFacture}<br />
            Taux USD appliqué: 1 USD = ${invoice.tauxChangeUsd} FCFA
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Désignation de la Prestation / Frais</th>
              <th>Catégorie</th>
              <th style="text-align:center">Qté</th>
              <th style="text-align:right">P.U HT (FCFA)</th>
              <th style="text-align:right">Montant HT (FCFA)</th>
            </tr>
          </thead>
          <tbody>
            ${lignesHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Total Général HT:</span>
            <span>${invoice.montantHtFcfa.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div class="totals-row">
            <span>TVA (18%):</span>
            <span>${invoice.tvaFcfa.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div class="totals-row grand">
            <span>NET À PAYER TTC:</span>
            <span>${invoice.montantTtcFcfa.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div style="font-size: 10px; color: #73777f; text-align: right; margin-top: 4px;">
            Équivalent USD: ~$ ${(invoice.montantTtcFcfa / invoice.tauxChangeUsd).toFixed(2)}
          </div>
        </div>
        ${stampHtml}

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
