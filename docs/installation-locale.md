# Installer BOCS sur un serveur de l'entreprise

Ce guide installe BOCS dans le réseau interne, **sans qu'aucune donnée ne sorte de
l'entreprise**. La seule communication externe conservée est la certification des
factures auprès de la DGI (FNE), qui est une obligation légale.

Le déploiement Vercel / Neon reste possible et inchangé : le mode local est choisi
par la variable `DB_DRIVER=pg`.

Les **clients export continuent de transmettre leurs drafts par Internet** grâce à un
portail client facultatif (§ 6) : seules leurs propres données y sont accessibles, et
le personnel BOCS ne peut s'y connecter.

---

## 1. Ce qui a été rendu local dans l'application

| Avant | Maintenant |
|---|---|
| Base de données Neon (cloud) | PostgreSQL 16 sur le serveur (`DB_DRIVER=pg`) |
| Hébergement Vercel | Serveur Node.js autonome (`server/index.ts`) |
| QR code des factures via `api.qrserver.com` (numéro, client, montant envoyés) | Calculé dans le navigateur (`src/utils/qrCode.ts`) |
| Polices et icônes Google Fonts | Embarquées (`src/styles/fonts.ts`, `public/vendor/fonts`) |
| Moteur et langue OCR téléchargés depuis un CDN | Servis par l'application (`public/vendor/tesseract`) |

Le serveur ajoute une politique de sécurité (`Content-Security-Policy`) qui interdit
au navigateur de charger quoi que ce soit hors du serveur BOCS.

### Sessions et droits (api/_auth.ts)

- La connexion dépose un **cookie de session signé** (HttpOnly, SameSite=Lax, Secure en
  HTTPS, 12 h). Toutes les routes de l'API l'exigent ; sans lui, elles répondent 401.
- Le compte est relu en base à chaque requête (cache 30 s) : un compte désactivé perd
  l'accès presque immédiatement.
- Chaque route applique les droits par rôle (matrice d'habilitations par défaut).
- Un **client export** ne reçoit que ses drafts, les factures de ses drafts, ainsi que
  leurs règlements et avoirs. Il ne peut déposer un draft qu'à son nom.
- 8 échecs de connexion en 15 minutes bloquent le compte depuis cette adresse IP.
- Les comptes clients sont créés par l'administrateur BOCS (pas d'inscription libre).
- Les connexions « 1-clic » de démonstration n'existent plus qu'en développement (`npm run dev`).
- Secret de signature : variable `SESSION_SECRET` (aussi à définir dans les variables
  d'environnement Vercel ; à défaut, il est dérivé de la chaîne de connexion à la base).

---

## 2. Le serveur

- Linux (Ubuntu Server 24.04 LTS conseillé), 4 cœurs, 8 Go de mémoire, 200 Go de SSD,
  disques en miroir (RAID 1), onduleur.
- Adresse IP fixe interne et un nom DNS interne, par exemple `bocs.entreprise.local`.
- Docker Engine et le plugin Docker Compose installés.

### Pare-feu

- **Entrant** : ports 80 et 443 depuis le réseau interne uniquement ; SSH (22) depuis
  le poste d'administration uniquement. PostgreSQL n'est **pas** exposé (il n'est
  joignable que par le conteneur de l'application).
- **Sortant** : tout bloqué, sauf l'API FNE de la DGI et les mises à jour de sécurité
  du système (idéalement via le proxy de l'entreprise).
- Sites distants ou télétravail : uniquement via le VPN de l'entreprise. Le serveur
  n'est jamais publié sur Internet.

---

## 3. Installation

La compilation de l'image est la **seule** étape qui a besoin d'Internet (paquets npm,
moteur Prisma, langue OCR). Elle peut se faire sur un poste connecté, l'image étant
ensuite transférée sur le serveur isolé (`docker save` / `docker load`).

```bash
# 1. Récupérer le code (depuis le serveur Git interne)
git clone <dépôt interne> /opt/bocs && cd /opt/bocs

# 2. Configurer
cp .env.example .env
#    POSTGRES_PASSWORD : openssl rand -base64 32
#    SESSION_SECRET    : openssl rand -base64 48
#    BOCS_DOMAIN       : nom DNS interne du serveur
#    BOCS_TLS          : internal, ou le certificat de l'entreprise (voir §4)
chmod 600 .env

# 3. Compiler et démarrer
docker compose up -d --build

# 4. Créer les tables (base neuve uniquement — sauter cette étape en cas de reprise, §5)
docker compose run --rm app npx prisma db push

# 5. Créer le premier administrateur (le mot de passe est demandé au clavier)
docker compose run --rm app node scripts/create-admin.mjs admin@entreprise.ci "Prénom NOM"
```

Ouvrir ensuite `https://bocs.entreprise.local` depuis un poste du réseau.

### Réseau totalement isolé (langue OCR)

Si le poste de compilation n'a pas Internet non plus, déposer le fichier
`eng.traineddata` (tesseract.js, modèle `4.0.0_best_int`) à la racine du projet
avant la compilation : il est repris tel quel.

---

## 4. Certificat HTTPS

Même en interne, HTTPS évite que les mots de passe et les factures circulent en clair.

- **Certificat de l'entreprise (recommandé)** : demander à l'autorité de certification
  interne (Active Directory Certificate Services…) un certificat pour `BOCS_DOMAIN`,
  déposer `bocs.crt` et `bocs.key` dans `deploy/certs/`, puis dans `.env` :
  `BOCS_TLS=/certs/bocs.crt /certs/bocs.key`. Les postes de l'entreprise lui font
  déjà confiance.
- **Autorité locale de Caddy** (`BOCS_TLS=internal`) : rien à demander, mais il faut
  installer la racine de Caddy sur chaque poste (par stratégie de groupe) :
  ```bash
  docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./bocs-racine.crt
  ```

---

## 5. Reprise des données depuis Neon (une seule fois)

Base locale démarrée et **vide** (sans `prisma db push`) :

```bash
NEON_URL='postgresql://…neon.tech/…?sslmode=require' ./scripts/migrate-neon-to-local.sh
```

Le script exporte la base Neon (lecture seule), l'importe localement et affiche le
nombre d'escales, de BL, de factures et de comptes. Vérifier l'application, puis
supprimer la base Neon et le fichier d'export conservé dans `backups/`.

---

## 6. Portail client sur Internet (drafts export)

Les clients déposent et suivent leurs drafts depuis Internet ; le reste des données ne
quitte pas l'entreprise.

1. **DNS public** : un nom, par exemple `clients.bocs.ci`, pointant vers l'adresse IP
   publique de l'entreprise.
2. **Pare-feu** : redirection des ports 443 (et 80 si Let's Encrypt) d'Internet vers le
   serveur BOCS, **en conservant l'adresse IP d'origine** (sans SNAT) : le site interne
   refuse toute adresse qui n'est pas du réseau privé.
3. **Activation** :
   ```bash
   cp deploy/portail/portail-client.caddy.exemple deploy/portail/portail-client.caddy
   # dans .env : BOCS_PUBLIC_DOMAIN=clients.bocs.ci et BOCS_PUBLIC_TLS=informatique@bocs.ci
   docker compose up -d
   ```
4. **Comptes clients** : l'administrateur crée un compte CLIENT_EXPORT par client
   (Administration › Comptes utilisateurs) et lui communique son mot de passe.

Protections en place sur le portail :

| Mesure | Effet |
|---|---|
| Comptes client uniquement | Le personnel BOCS est refusé, même avec le bon mot de passe |
| Routes filtrées par Caddy | Seules 10 routes API sont joignables ; BL d'import, etc. : 404 |
| Filtrage serveur | Chaque client ne voit que ses drafts, factures, règlements et avoirs |
| Site interne protégé | Le nom interne présenté à l'adresse publique répond 403 |
| HTTPS public | Certificat Let's Encrypt ou certificat acheté |

Pour un niveau supérieur, placer le portail sur une machine distincte en DMZ (même
fichier Caddy, `reverse_proxy` vers le serveur BOCS interne) afin que le serveur de
données ne reçoive aucune connexion directe d'Internet.

## 7. Sauvegardes

Sans le cloud, c'est l'entreprise qui garantit la survie des données.

```bash
chmod +x scripts/backup-db.sh
crontab -e   # puis : 0 2 * * * cd /opt/bocs && ./scripts/backup-db.sh >> backups/backup.log 2>&1
```

- **Règle 3-2-1** : 3 copies, sur 2 supports, dont 1 hors du bâtiment (copie du
  dossier `backups/` vers un NAS et un disque externe en rotation). Chiffrer les
  copies qui quittent le serveur.
- **Tester une restauration chaque mois** sur une autre machine (commande en fin de
  `scripts/backup-db.sh`). Une sauvegarde jamais restaurée n'est pas une sauvegarde.

---

## 8. Vérifier que rien ne sort

1. Bloquer tout trafic sortant du serveur (sauf FNE).
2. Utiliser l'application : connexion, import d'un manifeste PDF scanné (OCR),
   émission et impression d'une facture (QR code), affichage en thème Eglin.
3. Dans le navigateur (F12 › Réseau), aucune requête ne doit viser un autre domaine
   que `BOCS_DOMAIN`.

---

## 9. Exploitation

- **Mise à jour** : `git pull && docker compose up -d --build`, en dehors des heures de
  travail, après une sauvegarde. Tester d'abord sur une copie du serveur.
- **Surveillance** : espace disque, journal des sauvegardes, date d'expiration du
  certificat, `docker compose ps` (les trois services doivent être `healthy`/`running`).
- **Comptes** : nominatifs ; désactiver immédiatement le compte d'un employé qui part.
- **Journaux** : `docker compose logs app`.

## Sans Docker

```bash
npm ci
cp .env.example .env    # renseigner DB_DRIVER=pg et DATABASE_URL
npm run build:local
npx prisma db push      # base neuve
node --env-file=.env scripts/create-admin.mjs admin@entreprise.ci "Prénom NOM"
npm start               # http://serveur:3000, à placer derrière un proxy HTTPS
```
