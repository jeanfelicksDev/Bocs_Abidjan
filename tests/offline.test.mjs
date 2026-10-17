// Fonctionnement hors ligne : aucune ressource ni donnée ne doit partir vers Internet.
// Lancer : node --test tests/offline.test.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

/** Domaines autorisés dans le code : espaces de noms XML et API fiscale (FNE DGI). */
const ALLOWED = ['www.w3.org', 'api.fne.dgi.gouv.ci'];

const sources = dir =>
  readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx|html|css)$/.test(name) ? [full] : [];
  });

test("aucune URL externe dans l'application et l'API", () => {
  const files = [...sources(path.join(ROOT, 'src')), ...sources(path.join(ROOT, 'api')), path.join(ROOT, 'index.html')];
  const offenders = [];
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
      if (!ALLOWED.includes(m[1].toLowerCase())) offenders.push(`${path.relative(ROOT, file)} → ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('QR code calculé localement, accents compris', async () => {
  const { qrCodeDataUrl } = await import('../src/utils/qrCode.ts');
  const url = qrCodeDataUrl('BOCS|FAECHMANA26607123456|SOCIÉTÉ IVOIRIENNE|118000 FCFA|2026-10-17');
  assert.ok(url.startsWith('data:image/svg+xml'));
  const svg = decodeURIComponent(url.split(',')[1]);
  assert.match(svg, /<path d="M[0-9]/);
  assert.match(svg, /fill="#00182f"/);
});
