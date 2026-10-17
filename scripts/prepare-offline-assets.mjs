// Prépare dans public/vendor/ les ressources que BOCS chargeait depuis Internet,
// pour que l'application fonctionne sans aucune sortie réseau :
//   • polices des documents imprimés (factures, avoirs, manifestes…) ;
//   • moteur OCR tesseract.js (worker + cœur WebAssembly) et langue anglaise.
// Lancé automatiquement par `npm run build` et `npm run dev`. Idempotent.
//
// Langue OCR : prise, dans l'ordre, dans OCR_LANG_FILE, dans ./eng.traineddata,
// sinon téléchargée une seule fois (poste de compilation connecté). Sur un
// réseau totalement isolé, déposer le fichier et renseigner OCR_LANG_FILE.
import { copyFile, mkdir, readdir, stat, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NM = path.join(ROOT, 'node_modules');
const VENDOR = path.join(ROOT, 'public', 'vendor');

const ensureDir = dir => mkdir(dir, { recursive: true });
const copyIfChanged = async (from, to) => {
  const [a, b] = await Promise.all([stat(from), stat(to).catch(() => null)]);
  if (b && b.size === a.size) return false;
  await copyFile(from, to);
  return true;
};

// ── Polices des documents imprimés ──────────────────────────────────────────
// [paquet @fontsource, famille, graisses, styles]
const PRINT_FONTS = [
  ['inter', 'Inter', [400, 500, 600, 700, 800, 900], ['normal']],
  ['outfit', 'Outfit', [800, 900], ['normal']],
  ['plus-jakarta-sans', 'Plus Jakarta Sans', [400, 500, 600, 700, 800], ['normal']],
  ['playfair-display', 'Playfair Display', [600], ['italic']],
  ['jetbrains-mono', 'JetBrains Mono', [400, 500, 600, 700, 800], ['normal']]
];
const SUBSETS = {
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext':
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
};

async function preparePrintFonts() {
  const out = path.join(VENDOR, 'fonts');
  await ensureDir(out);
  const faces = [];
  for (const [pkg, family, weights, styles] of PRINT_FONTS) {
    for (const weight of weights) {
      for (const style of styles) {
        for (const [subset, range] of Object.entries(SUBSETS)) {
          const file = `${pkg}-${subset}-${weight}-${style}.woff2`;
          const from = path.join(NM, '@fontsource', pkg, 'files', file);
          if (!existsSync(from)) continue;
          await copyIfChanged(from, path.join(out, file));
          faces.push(
            `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;` +
              `src:url(./${file}) format('woff2');unicode-range:${range}}`
          );
        }
      }
    }
  }
  await writeFile(path.join(out, 'print.css'), `/* Généré par scripts/prepare-offline-assets.mjs */\n${faces.join('\n')}\n`);
  return faces.length;
}

// ── OCR tesseract.js ────────────────────────────────────────────────────────
async function prepareOcr() {
  const out = path.join(VENDOR, 'tesseract');
  const coreOut = path.join(out, 'core');
  const langOut = path.join(out, 'lang');
  await Promise.all([ensureDir(coreOut), ensureDir(langOut)]);

  await copyIfChanged(path.join(NM, 'tesseract.js', 'dist', 'worker.min.js'), path.join(out, 'worker.min.js'));
  // Le worker choisit la variante du cœur (SIMD, relaxed SIMD ou standard) selon le
  // navigateur ; BOCS reconnaît en mode LSTM seul : trois fichiers *-lstm.wasm.js suffisent.
  const coreDir = path.join(NM, 'tesseract.js-core');
  for (const f of await readdir(coreDir)) {
    if (/^tesseract-core(-simd|-relaxedsimd)?-lstm\.wasm\.js$/.test(f)) {
      await copyIfChanged(path.join(coreDir, f), path.join(coreOut, f));
    }
  }

  const target = path.join(langOut, 'eng.traineddata');
  if (existsSync(target)) return 'déjà présente';
  const local = [process.env.OCR_LANG_FILE, path.join(ROOT, 'eng.traineddata')].find(f => f && existsSync(f));
  if (local) {
    const data = await readFile(local);
    await writeFile(target, local.endsWith('.gz') ? gunzipSync(data) : data);
    return `copiée depuis ${path.relative(ROOT, local) || local}`;
  }
  // Même fichier que celui chargé par défaut par tesseract.js (LSTM, best_int).
  const url = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement de la langue OCR impossible (${res.status}). Renseignez OCR_LANG_FILE.`);
  await writeFile(target, gunzipSync(Buffer.from(await res.arrayBuffer())));
  return 'téléchargée';
}

const faces = await preparePrintFonts();
const ocr = await prepareOcr();
console.log(`[ressources hors ligne] ${faces} polices d'impression ; OCR prêt (langue ${ocr}).`);
