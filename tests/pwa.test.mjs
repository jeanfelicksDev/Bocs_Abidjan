// Application installable (PC et téléphone) : ce que les navigateurs exigent pour
// proposer l'installation, et ce que l'application en dit à l'utilisateur.
// Lancer : node --test tests/pwa.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const manifest = () => JSON.parse(read('public/manifest.webmanifest'));

/** Largeur et hauteur réelles d'un PNG, lues dans son en-tête IHDR. */
const pngSize = (file) => {
  const bytes = readFileSync(file);
  assert.equal(bytes.toString('latin1', 1, 4), 'PNG', `${file} n'est pas un PNG`);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
};

test("le manifeste porte les champs exigés pour l'installation", () => {
  const m = manifest();
  assert.ok(m.name, 'name');
  assert.ok(m.short_name && m.short_name.length <= 12, 'short_name court (libellé sous l’icône)');
  assert.equal(m.start_url, '/');
  assert.equal(m.scope, '/');
  assert.equal(m.display, 'standalone');
  assert.equal(m.lang, 'fr');
  assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
});

test('les icônes 192 et 512 existent, plus une icône « maskable », aux dimensions annoncées', () => {
  const { icons } = manifest();
  const has = (size, purpose) => icons.some((i) => i.sizes === size && (i.purpose || 'any').split(' ').includes(purpose));
  assert.ok(has('192x192', 'any'), 'icône 192 px');
  assert.ok(has('512x512', 'any'), 'icône 512 px');
  assert.ok(has('512x512', 'maskable'), 'icône maskable 512 px');
  for (const icon of icons) {
    assert.equal(icon.type, 'image/png');
    assert.ok(icon.src.startsWith('/'), `${icon.src} : chemin absolu (le manifeste est servi à la racine)`);
    const file = path.join(ROOT, 'public', icon.src);
    assert.ok(existsSync(file), `${icon.src} manquant`);
    assert.equal(pngSize(file), icon.sizes, icon.src);
  }
});

test("index.html relie le manifeste, l'icône iOS et la couleur de barre", () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/);
  const apple = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/);
  assert.ok(apple, 'apple-touch-icon');
  assert.equal(pngSize(path.join(ROOT, 'public', apple[1])), '180x180');
  assert.match(html, /<meta name="theme-color" content="#[0-9a-f]{6}"/i);
  for (const href of html.matchAll(/<link rel="icon"[^>]* href="([^"]+)"/g)) {
    assert.ok(existsSync(path.join(ROOT, 'public', href[1])), `${href[1]} manquant`);
  }
});

test('le serveur interne sert le manifeste avec son type MIME', () => {
  assert.match(read('server/index.ts'), /'\.webmanifest':\s*'application\/manifest\+json/);
});

test('la barre de titre suit le thème, et le script anti-flash dit la même chose', async () => {
  const { themeColorFor } = await import('../src/utils/theme.ts');
  assert.equal(themeColorFor('night'), '#111714');
  assert.equal(themeColorFor('eglin'), themeColorFor('bocs'));
  // Le script en ligne choisit entre deux couleurs : celle du sombre, celle des thèmes clairs.
  const inline = read('index.html').match(/theme === "night" \? "(#[0-9a-f]{6})" : "(#[0-9a-f]{6})"/i);
  assert.ok(inline, 'index.html : choix de la couleur de barre introuvable dans le script anti-flash');
  assert.equal(inline[1], themeColorFor('night'));
  assert.equal(inline[2], themeColorFor('bocs'));
});

test("un second clic pendant l'invite attend la même réponse au lieu de la rappeler", async () => {
  // Faux navigateur : assez pour que le module s'abonne et reçoive son événement.
  const handlers = {};
  globalThis.window = {
    addEventListener: (name, handler) => { handlers[name] = handler; },
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  };
  const { watchInstallability, promptInstall } = await import('../src/utils/installApp.ts');
  watchInstallability();

  let promptCalls = 0;
  let answer;
  handlers.beforeinstallprompt({
    prompt: async () => { promptCalls += 1; },
    userChoice: new Promise((resolve) => { answer = resolve; }),
  });

  const first = promptInstall();
  const second = promptInstall();
  answer({ outcome: 'accepted' });

  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(promptCalls, 1, "l'invite du navigateur ne s'ouvre qu'une fois");
  assert.equal(await promptInstall(), false, "l'événement est consommé : plus rien à proposer");
  delete globalThis.window;
});

test("l'état d'installation annoncé à l'utilisateur", async () => {
  const { resolveInstallState } = await import('../src/utils/installApp.ts');
  const none = { isInstalled: false, hasPrompt: false, isIos: false };
  assert.equal(resolveInstallState({ ...none, isInstalled: true, hasPrompt: true }), 'installed');
  assert.equal(resolveInstallState({ ...none, hasPrompt: true }), 'available');
  assert.equal(resolveInstallState({ ...none, isIos: true }), 'ios');
  assert.equal(resolveInstallState(none), 'unavailable');
});
