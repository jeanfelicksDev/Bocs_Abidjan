const fs = require('fs');
const path = require('path');

// 1. Update FacturationModule.tsx
const facturationPath = path.join(__dirname, '..', 'src', 'pages', 'FacturationModule.tsx');
let factContent = fs.readFileSync(facturationPath, 'utf8');

// Update tab categories calculation
const oldTabsBlock = `const allowedCategories: FretCategory[] = (isCaution || isTransfert)
                      ? ['CONTENEUR']
                      : ['CONTENEUR', 'VRAC', 'RORO', 'CONVENTIONNEL'];`;

const newTabsBlock = `const isEchange = activeInvoiceType.name.toLowerCase().includes('echange') || activeInvoiceType.id === '2';
                    const allowedCategories: FretCategory[] = (isCaution || isTransfert)
                      ? ['CONTENEUR']
                      : isEchange
                      ? ['CONTENEUR_COC', 'CONTENEUR_SOC', 'VRAC', 'RORO', 'CONVENTIONNEL']
                      : ['CONTENEUR', 'VRAC', 'RORO', 'CONVENTIONNEL'];`;

if (factContent.includes(oldTabsBlock)) {
  factContent = factContent.replace(oldTabsBlock, newTabsBlock);
}

// Update tab labels
const oldLabels = `const label = 
                              cat === 'CONTENEUR' ? 'Conteneur' :
                              cat === 'VRAC' ? 'Vrac' :
                              cat === 'RORO' ? 'Ro-Ro' : 'Conventionnel';`;

const newLabels = `const label = 
                              cat === 'CONTENEUR_COC' ? 'Conteneur COC' :
                              cat === 'CONTENEUR_SOC' ? 'Conteneur SOC' :
                              cat === 'CONTENEUR' ? 'Conteneur' :
                              cat === 'VRAC' ? 'Vrac' :
                              cat === 'RORO' ? 'Ro-Ro' : 'Conventionnel';`;

if (factContent.includes(oldLabels)) {
  factContent = factContent.replace(oldLabels, newLabels);
}

// Update click selection on invoice types
factContent = factContent.replace(
  `if (isCaution || isTransfert) {
                            setActiveCategory('CONTENEUR');
                          }`,
  `const isEchange = t.name.toLowerCase().includes('echange') || t.id === '2';
                          if (isCaution || isTransfert) {
                            setActiveCategory('CONTENEUR');
                          } else if (isEchange) {
                            if (activeCategory === 'CONTENEUR' || activeCategory === 'CONTENEUR_SOC') {
                              setActiveCategory('CONTENEUR_COC');
                            }
                          } else if (activeCategory === 'CONTENEUR_COC' || activeCategory === 'CONTENEUR_SOC') {
                            setActiveCategory('CONTENEUR');
                          }`
);

// Update localRubriques filter in FacturationModule.tsx
factContent = factContent.replace(
  `r.invoiceTypeId === selectedInvoiceTypeId && r.category === activeCategory`,
  `r.invoiceTypeId === selectedInvoiceTypeId && (r.category === activeCategory || (activeCategory === 'CONTENEUR_COC' && r.category === 'CONTENEUR'))`
);

// Update Add modal target text
factContent = factContent.replace(
  `activeCategory === 'CONTENEUR' ? 'Conteneur' :`,
  `activeCategory === 'CONTENEUR_COC' ? 'Conteneur COC' : activeCategory === 'CONTENEUR_SOC' ? 'Conteneur SOC' : activeCategory === 'CONTENEUR' ? 'Conteneur' :`
);

// Update activeCategory === 'CONTENEUR' checks in selects
factContent = factContent.split(`activeCategory === 'CONTENEUR'`).join(
  `(activeCategory === 'CONTENEUR' || activeCategory === 'CONTENEUR_COC' || activeCategory === 'CONTENEUR_SOC')`
);

fs.writeFileSync(facturationPath, factContent, 'utf8');
console.log('FacturationModule.tsx updated with SOC/COC categories successfully');

// 2. Update ImportModule.tsx
const importPath = path.join(__dirname, '..', 'src', 'pages', 'ImportModule.tsx');
let importContent = fs.readFileSync(importPath, 'utf8');

// Replace activeConfigs and lines calculation in ImportModule.tsx
const oldGenLogic = `    // Get active rubriques for this category & this specific invoice type
    const activeConfigs = rubriqueConfigs.filter(r => 
      r.invoiceTypeId === typeConfig.id && 
      r.category === blCategory && 
      r.isActive
    );

    let lines = activeConfigs.map(r => {
      let quantity = 1;
      
      // Determine quantity based on baseCalcul or ISPS rule
      const isIsps = r.name.toUpperCase().includes('ISPS') || r.code === 'ISPS' || r.baseCalcul === 'TEU';
      if (isIsps) {
        // Facturé au TEU: 20' = 1 TEU, 40' = 2 TEU
        quantity = bl.conteneurs && bl.conteneurs.length > 0 
          ? bl.conteneurs.reduce((sum, c) => sum + (c.typeConteneur.includes('40') ? 2 : 1), 0)
          : 1;
      } else if (r.baseCalcul === 'CONTENEUR') {
        if (bl.conteneurs && bl.conteneurs.length > 0) {
          const nameUpper = r.name.toUpperCase();
          const codeUpper = r.code.toUpperCase();
          if (nameUpper.includes('SOC') || codeUpper.includes('SOC')) {
            quantity = bl.conteneurs.filter(c => c.socCoc === 'SOC').length;
          } else if (nameUpper.includes('COC') || codeUpper.includes('COC')) {
            quantity = bl.conteneurs.filter(c => c.socCoc === 'COC' || !c.socCoc).length;
          } else {
            quantity = bl.conteneurs.length;
          }
        } else {
          quantity = 1;
        }
      } else if (r.baseCalcul === 'POIDS_TONNE') {
        quantity = bl.poidsBrutKg ? Math.round((bl.poidsBrutKg / 1000) * 100) / 100 : 1;
      }`;

const newGenLogic = `    // Get active rubriques for this category & this specific invoice type
    const isEchangeType = typeConfig.id === '2' || typeConfig.name.toLowerCase().includes('echange');
    const activeConfigs = rubriqueConfigs.filter(r => 
      r.invoiceTypeId === typeConfig.id && 
      r.isActive && (
        r.category === blCategory ||
        (isEchangeType && blCategory === 'CONTENEUR' && (r.category === 'CONTENEUR_COC' || r.category === 'CONTENEUR_SOC' || r.category === 'CONTENEUR'))
      )
    );

    const socContainers = (bl.conteneurs || []).filter(c => c.socCoc === 'SOC');
    const cocContainers = (bl.conteneurs || []).filter(c => c.socCoc === 'COC' || !c.socCoc);

    let lines = activeConfigs.map(r => {
      let quantity = 1;
      const isSocRub = r.category === 'CONTENEUR_SOC' || r.name.toUpperCase().includes('SOC') || r.code.toUpperCase().includes('SOC');
      const isCocRub = r.category === 'CONTENEUR_COC' || r.name.toUpperCase().includes('COC') || r.code.toUpperCase().includes('COC');
      
      // If SOC specific and 0 SOC containers, or COC specific and 0 COC containers
      if (isSocRub && socContainers.length === 0) {
        quantity = 0;
      } else if (isCocRub && cocContainers.length === 0) {
        quantity = 0;
      } else {
        const isIsps = r.name.toUpperCase().includes('ISPS') || r.code === 'ISPS' || r.baseCalcul === 'TEU';
        if (isIsps) {
          const targetCtns = isSocRub ? socContainers : (isCocRub ? cocContainers : (bl.conteneurs || []));
          quantity = targetCtns.length > 0 
            ? targetCtns.reduce((sum, c) => sum + (c.typeConteneur.includes('40') ? 2 : 1), 0)
            : 1;
        } else if (r.baseCalcul === 'CONTENEUR') {
          if (isSocRub) {
            quantity = socContainers.length;
          } else if (isCocRub) {
            quantity = cocContainers.length;
          } else {
            quantity = (bl.conteneurs && bl.conteneurs.length > 0) ? bl.conteneurs.length : 1;
          }
        } else if (r.baseCalcul === 'POIDS_TONNE') {
          quantity = bl.poidsBrutKg ? Math.round((bl.poidsBrutKg / 1000) * 100) / 100 : 1;
        }
      }`;

if (importContent.includes(oldGenLogic)) {
  importContent = importContent.replace(oldGenLogic, newGenLogic);
}

// Filter lines with quantity > 0
if (!importContent.includes(`lines = lines.filter(l => l.quantite > 0);`)) {
  importContent = importContent.replace(
    `const montantHt = lines.reduce((sum, l) => sum + l.montantHtFcfa, 0);`,
    `lines = lines.filter(l => l.quantite > 0);\n    const montantHt = lines.reduce((sum, l) => sum + l.montantHtFcfa, 0);`
  );
}

fs.writeFileSync(importPath, importContent, 'utf8');
console.log('ImportModule.tsx updated with SOC/COC evaluation successfully');
