import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('the Escale API and Prisma model retain every persisted escale field', async () => {
  const [schema, endpoint] = await Promise.all([
    read('prisma/schema.prisma'),
    read('api/escales.ts')
  ]);

  assert.match(schema, /date_accostage\s+String\?/);
  assert.match(schema, /quai\s+String\?/);
  assert.match(endpoint, /date_accostage: escale\.dateAccostage/);
  assert.match(endpoint, /quai: escale\.quai/);
  assert.match(endpoint, /dateAccostage: e\.date_accostage/);
  assert.match(endpoint, /quai: e\.quai/);
});

test('failed escale or manifest writes cannot delete data outside a transaction', async () => {
  const [escales, bls] = await Promise.all([
    read('api/escales.ts'),
    read('api/bls.ts')
  ]);

  const postHandler = escales.slice(escales.indexOf("req.method === 'POST'"), escales.indexOf("req.method === 'DELETE'"));
  assert.match(escales, /prisma\.\$transaction/);
  assert.doesNotMatch(postHandler, /\.deleteMany/);
  assert.match(bls, /prisma\.\$transaction/);
  assert.doesNotMatch(bls, /bls:\s*\{/);
});

test('application bootstrap does not delete operational escales or BLs', async () => {
  const initDb = await read('api/init-db.ts');
  assert.doesNotMatch(initDb, /DELETE FROM escales/i);
  assert.doesNotMatch(initDb, /DELETE FROM bls/i);
});
