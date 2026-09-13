const fs = require('fs');
const path = require('path');

const facturationPath = path.join(__dirname, '..', 'src', 'pages', 'FacturationModule.tsx');
let content = fs.readFileSync(facturationPath, 'utf8');

// Add suggestTariffCode function if not present
const suggestFn = `
export function suggestTariffCode(name: string): string {
  if (!name || !name.trim()) return '';
  const clean = name.trim().toUpperCase();

  // 1. Direct maritime/billing mapping
  if (clean.includes('ISPS')) return 'ISPS';
  if (clean.includes('DOSSIER')) return 'FR-DOS';
  if (clean.includes('ECHANGE') || clean.includes('ÉCHANGE')) return 'ECH-BL';
  if (clean.includes('GARANTIE') || clean.includes('CAUTION')) return 'GAR-CTR';
  if (clean.includes('MANUTENTION') || clean.includes('GRUTAGE')) return 'MAN-01';
  if (clean.includes('STOCKAGE') || clean.includes('MAGASINAGE')) return 'STK-PRC';
  if (clean.includes('TELEX') || clean.includes('RELEASE')) return 'TLX-FEE';
  if (clean.includes('TRANSFERT')) return 'TRF-PRC';
  if (clean.includes('SURESTARIE') || clean.includes('DEMURRAGE')) return 'DMDT';
  if (clean.includes('DETENTION')) return 'DET-CTR';
  if (clean.includes('PASSE') || clean.includes('PORTUAIRE')) return 'PSC-VRC';
  if (clean.includes('RORO') || clean.includes('RO-RO')) return 'TX-RORO';
  if (clean.includes('LOURD') || clean.includes('SURCHARGE')) return 'SCH-LVR';
  if (clean.includes('ASSURANCE')) return 'ASSUR';
  if (clean.includes('SCELLE') || clean.includes('PLOMB') || clean.includes('SEAL')) return 'SCL-OK';
  if (clean.includes('NETTOYAGE') || clean.includes('LAVAGE')) return 'NET-CTR';
  if (clean.includes('BRANCHEMENT') || clean.includes('REEFER') || clean.includes('FRIGO')) return 'REF-BRN';
  if (clean.includes('PESAGE') || clean.includes('VGM')) return 'VGM-FEE';
  if (clean.includes('CORRECTION') || clean.includes('AMENDMENT')) return 'AMD-BL';
  if (clean.includes('BAD') || clean.includes('BON A DELIVRER') || clean.includes('BON À DÉLIVRER')) return 'BAD-FEE';
  if (clean.includes('DEBARQUEMENT') || clean.includes('DÉBARQUEMENT')) return 'DEB-01';
  if (clean.includes('EMBARQUEMENT')) return 'EMB-01';

  // 2. Intelligent abbreviation generation from significant words
  const stopWords = new Set(['DE', 'DU', 'DES', 'LE', 'LA', 'LES', 'AU', 'AUX', 'ET', 'EN', 'POUR', 'PAR', 'UN', 'UNE', 'SUR', 'D', 'L']);
  const words = clean
    .replace(/[^A-Z0-9\\s]/g, ' ')
    .split(/\\s+/)
    .filter(w => w.length > 0 && !stopWords.has(w));

  if (words.length === 0) return 'TAR-01';
  if (words.length === 1) return words[0].slice(0, 6);
  if (words.length === 2) return \`\${words[0].slice(0, 3)}-\${words[1].slice(0, 3)}\`;
  return \`\${words[0].slice(0, 2)}-\${words[1].slice(0, 2)}\${words[2].slice(0, 2)}\`;
}
`;

if (!content.includes('function suggestTariffCode')) {
  // Insert before component definition
  content = content.replace(
    'export const FacturationModule:',
    `${suggestFn}\nexport const FacturationModule:`
  );
}

// Update Add modal name input to auto-suggest
content = content.replace(
  `onChange={e => setNewRubriqueName(e.target.value)}`,
  `onChange={e => {
                      const val = e.target.value;
                      setNewRubriqueName(val);
                      const autoCode = suggestTariffCode(val);
                      if (autoCode) setNewRubriqueCode(autoCode);
                    }}`
);

// Update Edit modal code field with Auto button
const oldEditCode = `<input
                    type="text"
                    required
                    value={editRubriqueCode}
                    onChange={e => setEditRubriqueCode(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-blue-600 focus:outline-none text-xs uppercase"
                  />`;

const newEditCode = `<div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      value={editRubriqueCode}
                      onChange={e => setEditRubriqueCode(e.target.value.toUpperCase())}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-blue-600 focus:outline-none text-xs uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const autoCode = suggestTariffCode(editRubriqueName);
                        if (autoCode) setEditRubriqueCode(autoCode);
                      }}
                      title="Générer automatiquement le code selon le libellé"
                      className="h-10 px-2.5 bg-blue-50 hover:bg-blue-100 text-[#005daa] border border-blue-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">auto_awesome</span>
                      <span className="text-[10px]">Auto</span>
                    </button>
                  </div>`;

if (content.includes(oldEditCode)) {
  content = content.replace(oldEditCode, newEditCode);
}

// Update Add modal code field with Auto button
const oldAddCode = `<input
                    type="text"
                    required
                    value={newRubriqueCode}
                    onChange={e => setNewRubriqueCode(e.target.value)}
                    placeholder="ex: FR-DOS"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-blue-600 focus:outline-none text-xs uppercase"
                  />`;

const newAddCode = `<div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      value={newRubriqueCode}
                      onChange={e => setNewRubriqueCode(e.target.value.toUpperCase())}
                      placeholder="ex: FR-DOS"
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-blue-600 focus:outline-none text-xs uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const autoCode = suggestTariffCode(newRubriqueName);
                        if (autoCode) setNewRubriqueCode(autoCode);
                      }}
                      title="Générer automatiquement le code selon le libellé"
                      className="h-10 px-2.5 bg-blue-50 hover:bg-blue-100 text-[#005daa] border border-blue-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">auto_awesome</span>
                      <span className="text-[10px]">Auto</span>
                    </button>
                  </div>`;

if (content.includes(oldAddCode)) {
  content = content.replace(oldAddCode, newAddCode);
}

fs.writeFileSync(facturationPath, content, 'utf8');
console.log('FacturationModule.tsx updated with auto tariff code generator successfully');
