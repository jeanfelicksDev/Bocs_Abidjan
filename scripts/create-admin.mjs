// Crée (ou réactive) un compte administrateur dans la base PostgreSQL locale.
// Indispensable après une installation neuve : sans compte, personne ne peut se connecter.
//
// Lancer : node --env-file=.env scripts/create-admin.mjs <email> "<Nom complet>"
//   (dans Docker : docker compose run --rm app node scripts/create-admin.mjs …)
// Le mot de passe est demandé au clavier (jamais en argument : il resterait dans
// l'historique du terminal). Même hachage que l'API (PBKDF2-SHA512, 10 000 itérations).
import crypto from 'node:crypto';
import readline from 'node:readline';
import pg from 'pg';

const [email, nomComplet] = process.argv.slice(2);
if (!email || !nomComplet) {
  console.error('Usage : node scripts/create-admin.mjs <email> "<Nom complet>"');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL absent (fichier .env).');
  process.exit(1);
}

// Saisie redirigée (script d'installation) : les lignes de l'entrée standard, dans l'ordre.
let pipedLines = null;
const readPiped = async () => {
  if (pipedLines) return pipedLines;
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  pipedLines = data.split(/\r?\n/);
  return pipedLines;
};

const askHidden = async question => {
  if (!process.stdin.isTTY) return (await readPiped()).shift() ?? '';
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => rl.output.write(s.includes(question) ? s : '');
    rl.question(question, answer => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
};

const password = await askHidden('Mot de passe (12 caractères minimum) : ');
if (password.trim().length < 12) {
  console.error('Mot de passe trop court.');
  process.exit(1);
}
if ((await askHidden('Confirmer le mot de passe : ')) !== password) {
  console.error('Les deux saisies diffèrent.');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(password.trim(), salt, 10000, 64, 'sha512').toString('hex');
const motDePasse = `pbkdf2$10000$${salt}$${hash}`;

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query(
    `INSERT INTO users (id, nom_complet, email, role, est_actif, mot_de_passe, date_creation)
     VALUES ($1, $2, lower($3), 'ADMIN', true, $4, $5)
     ON CONFLICT (email) DO UPDATE
       SET role = 'ADMIN', est_actif = true, mot_de_passe = EXCLUDED.mot_de_passe, deleted_at = NULL
     RETURNING id, email`,
    [Date.now(), nomComplet, email.trim(), motDePasse, new Date().toISOString().slice(0, 10)]
  );
  console.log(`Administrateur prêt : ${rows[0].email}`);
} finally {
  await client.end();
}
