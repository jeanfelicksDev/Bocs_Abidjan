/**
 * Serveur autonome BOCS — installation dans le réseau de l'entreprise.
 *
 * Remplace Vercel : sert l'application compilée (`dist/`) et les routes `/api/*`
 * en réutilisant tels quels les gestionnaires de `api/*.ts` (signature Vercel
 * `handler(req, res)` avec `req.query`, `req.body`, `res.status().json()`).
 * Reproduit les réécritures de `vercel.json` : toute URL qui n'est ni une route
 * API ni un fichier de `dist/` renvoie `index.html` (application monopage).
 *
 * Variables : PORT (3000), HOST (0.0.0.0), DB_DRIVER=pg, DATABASE_URL.
 * Lancement : `npm run build:local` puis `npm start`.
 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import audit from '../api/audit.ts';
import bls from '../api/bls.ts';
import configs from '../api/configs.ts';
import creditNotes from '../api/credit-notes.ts';
import drafts from '../api/drafts.ts';
import escales from '../api/escales.ts';
import invoices from '../api/invoices.ts';
import payments from '../api/payments.ts';
import permissions from '../api/permissions.ts';
import users from '../api/users.ts';
import vessels from '../api/vessels.ts';

type Handler = (req: any, res: any) => unknown;

const ROUTES: Record<string, Handler> = {
  audit,
  bls,
  configs,
  'credit-notes': creditNotes,
  drafts,
  escales,
  invoices,
  payments,
  permissions,
  users,
  vessels
};

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
/** Taille maximale d'un corps de requête (manifestes volumineux). */
const MAX_BODY_BYTES = 25 * 1024 * 1024;

// `dist/` est le voisin de `dist-server/` une fois compilé.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.traineddata': 'application/octet-stream',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

/** En-têtes de sécurité communs : rien n'est chargé depuis l'extérieur du serveur. */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' data: blob:",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ')
};

const readBody = (req: http.IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Corps de requête trop volumineux.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

/** `req.query` à la manière de Vercel : une valeur, ou un tableau si le paramètre est répété. */
const toQuery = (params: URLSearchParams): Record<string, string | string[]> => {
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }
  return query;
};

/** Ajoute à la réponse Node les aides de Vercel utilisées par `api/*.ts`. */
const withHelpers = (res: http.ServerResponse) => {
  const r = res as http.ServerResponse & {
    status: (code: number) => typeof r;
    json: (body: unknown) => void;
    send: (body: unknown) => void;
  };
  r.status = (code: number) => {
    r.statusCode = code;
    return r;
  };
  r.json = (body: unknown) => {
    if (!r.hasHeader('Content-Type')) r.setHeader('Content-Type', 'application/json; charset=utf-8');
    r.end(JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));
  };
  r.send = (body: unknown) => {
    if (body === undefined || body === null) return void r.end();
    if (typeof body === 'object' && !Buffer.isBuffer(body)) return r.json(body);
    r.end(body as string | Buffer);
  };
  return r;
};

const handleApi = async (name: string, url: URL, req: http.IncomingMessage, res: http.ServerResponse) => {
  const handler = ROUTES[name];
  const r = withHelpers(res);
  if (!handler) {
    r.status(404).json({ success: false, error: `Route /api/${name} inconnue.` });
    return;
  }
  const raw = req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : await readBody(req);
  let body: unknown = undefined;
  if (raw.length > 0) {
    const text = raw.toString('utf8');
    const type = String(req.headers['content-type'] || '');
    if (type.includes('application/json')) {
      try {
        body = JSON.parse(text);
      } catch {
        r.status(400).json({ success: false, error: 'Corps JSON invalide.' });
        return;
      }
    } else if (type.includes('application/x-www-form-urlencoded')) {
      body = toQuery(new URLSearchParams(text));
    } else {
      body = text;
    }
  }
  Object.assign(req, { query: toQuery(url.searchParams), body });
  await handler(req, r);
};

const serveStatic = async (pathname: string, req: http.IncomingMessage, res: http.ServerResponse) => {
  let relative: string;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    res.statusCode = 400;
    res.end();
    return;
  }
  // Interdit toute sortie de `dist/` (../, chemins absolus).
  const target = path.normalize(path.join(DIST, relative));
  let file = target.startsWith(DIST + path.sep) || target === DIST ? target : '';
  let info = file ? await stat(file).catch(() => null) : null;
  if (info?.isDirectory()) {
    file = path.join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  const isAsset = !!info?.isFile();
  if (!isAsset) {
    // Application monopage : les routes inconnues reviennent à index.html…
    // …sauf une ressource manquante (extension connue), qui reste en 404.
    if (path.extname(relative) && path.extname(relative) !== '.html') {
      res.statusCode = 404;
      res.end();
      return;
    }
    file = path.join(DIST, 'index.html');
    info = await stat(file).catch(() => null);
    if (!info) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end("Application non compilée : lancez « npm run build:local ».");
      return;
    }
  }
  const ext = path.extname(file).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Content-Length', info!.size);
  // Fichiers à empreinte (dist/assets) : cache long ; le reste est revalidé.
  res.setHeader(
    'Cache-Control',
    isAsset && pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
  );
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
};

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    const api = /^\/api\/([a-z-]+)\/?$/.exec(url.pathname);
    if (api) {
      await handleApi(api[1], url, req, res);
    } else if (url.pathname.startsWith('/api/')) {
      withHelpers(res).status(404).json({ success: false, error: 'Route API inconnue.' });
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      await serveStatic(url.pathname, req, res);
    } else {
      res.statusCode = 405;
      res.end();
    }
  } catch (error: any) {
    console.error(`[${req.method} ${url.pathname}]`, error);
    if (!res.headersSent) {
      withHelpers(res).status(error?.status || 500).json({ success: false, error: error?.message || 'Erreur serveur.' });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  const driver = process.env.DB_DRIVER === 'pg' ? 'PostgreSQL local' : 'Neon';
  console.log(`BOCS en écoute sur http://${HOST}:${PORT} (base : ${driver})`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
