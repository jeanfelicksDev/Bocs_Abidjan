const fs = require('fs');
const path = require('path');

// 1. Update FacturationModule.tsx
const facturationPath = path.join(__dirname, '..', 'src', 'pages', 'FacturationModule.tsx');
let factContent = fs.readFileSync(facturationPath, 'utf8');

// Card display
factContent = factContent.replace(
  `rub.baseCalcul === 'CONTENEUR' ? 'Par conteneur' :`,
  `rub.baseCalcul === 'TEU' ? 'Facturé par TEU' : rub.baseCalcul === 'CONTENEUR' ? 'Par conteneur' :`
);

// Edit & Add Selects
factContent = factContent.split('<option value="BL">Facturé au BL (Montant fixe)</option>').join(
  '<option value="BL">Facturé au BL (Montant fixe)</option>\n                  <option value="TEU">Facturé par TEU</option>'
);

fs.writeFileSync(facturationPath, factContent, 'utf8');
console.log('FacturationModule.tsx updated successfully');

// 2. Update ImportModule.tsx
const importPath = path.join(__dirname, '..', 'src', 'pages', 'ImportModule.tsx');
let importContent = fs.readFileSync(importPath, 'utf8');

// Ensure r.baseCalcul === 'TEU' handles TEU quantity calculation
if (!importContent.includes(`r.baseCalcul === 'TEU'`)) {
  importContent = importContent.replace(
    `const isIsps = r.name.toUpperCase().includes('ISPS') || r.code === 'ISPS';\n      if (isIsps) {`,
    `const isIsps = r.name.toUpperCase().includes('ISPS') || r.code === 'ISPS' || r.baseCalcul === 'TEU';\n      if (isIsps) {`
  );
  
  importContent = importContent.replace(
    `if (r.baseCalcul === 'CONTENEUR') q = blForInvoiceSelection.conteneurs?.length || 1;`,
    `if (r.baseCalcul === 'TEU') q = blForInvoiceSelection.conteneurs?.reduce((sum, c) => sum + (c.typeConteneur.includes('40') ? 2 : 1), 0) || 1;\n                      else if (r.baseCalcul === 'CONTENEUR') q = blForInvoiceSelection.conteneurs?.length || 1;`
  );
}

fs.writeFileSync(importPath, importContent, 'utf8');
console.log('ImportModule.tsx updated successfully');
