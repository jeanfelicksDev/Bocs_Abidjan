const fs = require('fs');
const path = require('path');

// 1. Update ImportModule.tsx
const importPath = path.join(__dirname, '..', 'src', 'pages', 'ImportModule.tsx');
let importContent = fs.readFileSync(importPath, 'utf8');

// Update BL table action buttons
importContent = importContent.replace(
  `const isCancelled = !activeInv && !!cancelledInv;\n                              const typeName = typeConfig.name.replace(/^Facture\\s+/i, '');`,
  `const isCancelled = !activeInv && !!cancelledInv;
                              const isEchangeType = typeConfig.id === '2' || typeConfig.name.toLowerCase().includes('echange');
                              let typeName = typeConfig.name.replace(/^Facture\\s+/i, '');
                              if (isEchangeType && bl.conteneurs && bl.conteneurs.length > 0) {
                                const hasSoc = bl.conteneurs.some(c => c.socCoc === 'SOC');
                                const hasCoc = bl.conteneurs.some(c => c.socCoc === 'COC' || !c.socCoc);
                                if (hasSoc && !hasCoc) typeName = 'Échange (SOC)';
                                else if (hasCoc && !hasSoc) typeName = 'Échange (COC)';
                                else typeName = 'Échange (Mixte)';
                              }`
);

// Update Invoice Selection Modal in ImportModule.tsx
const oldModalMatching = `const isChecked = selectedTypeIdsForBl.includes(typeConfig.id) || isAlreadyPaid;
                    const matchingRubriques = rubriqueConfigs.filter(r => 
                      r.invoiceTypeId === typeConfig.id && 
                      r.category === blCat && 
                      r.isActive
                    );`;

const newModalMatching = `const isChecked = selectedTypeIdsForBl.includes(typeConfig.id) || isAlreadyPaid;
                    const isEchangeType = typeConfig.id === '2' || typeConfig.name.toLowerCase().includes('echange');
                    const hasSocCtns = blForInvoiceSelection.conteneurs?.some(c => c.socCoc === 'SOC') || false;
                    const hasCocCtns = blForInvoiceSelection.conteneurs?.some(c => c.socCoc === 'COC' || !c.socCoc) || false;

                    let dynamicTypeName = typeConfig.name;
                    if (isEchangeType && blCat === 'CONTENEUR') {
                      if (hasSocCtns && !hasCocCtns) dynamicTypeName = 'Échange Conteneurs (SOC)';
                      else if (hasCocCtns && !hasSocCtns) dynamicTypeName = 'Échange Conteneurs (COC)';
                      else dynamicTypeName = 'Échange Conteneurs (SOC / COC)';
                    }

                    const matchingRubriques = isEchangeType && blCat === 'CONTENEUR'
                      ? rubriqueConfigs.filter(r => 
                          r.invoiceTypeId === typeConfig.id && 
                          r.isActive && (
                            (hasSocCtns && r.category === 'CONTENEUR_SOC') ||
                            (hasCocCtns && (r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR'))
                          )
                        )
                      : rubriqueConfigs.filter(r => 
                          r.invoiceTypeId === typeConfig.id && 
                          r.category === blCat && 
                          r.isActive
                        );`;

if (importContent.includes(oldModalMatching)) {
  importContent = importContent.replace(oldModalMatching, newModalMatching);
}

// Replace typeConfig.name in modal headers
importContent = importContent.replace(
  `<span className="font-bold text-slate-900 text-xs font-heading">\n                                  {typeConfig.name}\n                                </span>`,
  `<span className="font-bold text-slate-900 text-xs font-heading">\n                                  {dynamicTypeName}\n                                </span>`
);

importContent = importContent.replace(
  `<span className="font-bold text-slate-900 text-xs font-heading flex items-center gap-1.5">\n                                  {typeConfig.name}`,
  `<span className="font-bold text-slate-900 text-xs font-heading flex items-center gap-1.5">\n                                  {dynamicTypeName}`
);

fs.writeFileSync(importPath, importContent, 'utf8');
console.log('ImportModule.tsx updated successfully');

// 2. Update FacturationModule.tsx
const facturationPath = path.join(__dirname, '..', 'src', 'pages', 'FacturationModule.tsx');
let factContent = fs.readFileSync(facturationPath, 'utf8');

factContent = factContent.replace(
  `const typeName = typeConfig.name.replace(/^Facture\\s+/i, '');`,
  `const isEchangeType = typeConfig.id === '2' || typeConfig.name.toLowerCase().includes('echange');
                              let typeName = typeConfig.name.replace(/^Facture\\s+/i, '');
                              if (isEchangeType && g.matchedBl?.conteneurs && g.matchedBl.conteneurs.length > 0) {
                                const hasSoc = g.matchedBl.conteneurs.some(c => c.socCoc === 'SOC');
                                const hasCoc = g.matchedBl.conteneurs.some(c => c.socCoc === 'COC' || !c.socCoc);
                                if (hasSoc && !hasCoc) typeName = 'Échange (SOC)';
                                else if (hasCoc && !hasSoc) typeName = 'Échange (COC)';
                                else typeName = 'Échange (Mixte)';
                              }`
);

fs.writeFileSync(facturationPath, factContent, 'utf8');
console.log('FacturationModule.tsx updated successfully');

// 3. Update pdfGenerator.ts
const pdfPath = path.join(__dirname, '..', 'src', 'utils', 'pdfGenerator.ts');
let pdfContent = fs.readFileSync(pdfPath, 'utf8');

const oldPdfTypeFact = `<div class="type-fact">\${
              invoice.typeFacture === 'PROFORMA_IMPORT' 
                ? (INITIAL_INVOICE_TYPE_CONFIGS.find(c => c.id === invoice.invoiceTypeId)?.name ? \`Import Charges locales (\${INITIAL_INVOICE_TYPE_CONFIGS.find(c => c.id === invoice.invoiceTypeId)?.name})\` : 'Import Charges locales')
                : invoice.typeFacture.replace(/_/g, ' ')
            }</div>`;

const newPdfTypeFact = `<div class="type-fact">\${(() => {
              const baseTypeName = INITIAL_INVOICE_TYPE_CONFIGS.find(c => c.id === invoice.invoiceTypeId)?.name || 
                                   (invoice.typeFacture === 'PROFORMA_IMPORT' ? 'Import Charges locales' : invoice.typeFacture.replace(/_/g, ' '));
              const isEchange = baseTypeName.toLowerCase().includes('echange') || invoice.invoiceTypeId === '2';
              if (isEchange && bl?.conteneurs && bl.conteneurs.length > 0) {
                const hasSoc = bl.conteneurs.some(c => c.socCoc === 'SOC');
                const hasCoc = bl.conteneurs.some(c => c.socCoc === 'COC' || !c.socCoc);
                if (hasSoc && !hasCoc) return \`Échange Conteneurs (SOC)\`;
                if (hasCoc && !hasSoc) return \`Échange Conteneurs (COC)\`;
                return \`Échange Conteneurs (SOC / COC)\`;
              }
              return invoice.typeFacture === 'PROFORMA_IMPORT' ? \`Import Charges locales (\${baseTypeName})\` : baseTypeName;
            })()}</div>`;

if (pdfContent.includes(oldPdfTypeFact)) {
  pdfContent = pdfContent.replace(oldPdfTypeFact, newPdfTypeFact);
}

fs.writeFileSync(pdfPath, pdfContent, 'utf8');
console.log('pdfGenerator.ts updated successfully');
