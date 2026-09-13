<!--
Rapport d'impact de synchronisation :
- Changement de version : 1.0.0 -> 1.0.1 (Traduction intégrale en français et ajustements de clarté)
- Ratification : Adoption initiale pour BOCS Maritime Manager
- Principes définis :
  1. Full-Stack TypeScript & Typage Strict
  2. Architecture Serverless & Neon PostgreSQL
  3. Intégrité Métier Maritime & Précision Financière
  4. Modularité & Composants UI Réutilisables
  5. Validation Locale & Passerelles de Déploiement
- Sections : Stack Technologique & Contraintes d'Architecture, Règles de Qualité & Workflow, Gouvernance
-->

# Constitution du Projet — BOCS Maritime Manager

## Principes Fondamentaux

### I. Full-Stack TypeScript & Typage Strict (OBLIGATOIRE)
Tout le code de l'application, les fonctions d'API dans `/api`, les composants de l'interface dans `/src`, ainsi que les scripts d'administration DOIVENT être rédigés en TypeScript strict. Toute modification de schéma au niveau de la base de données doit se refléter immédiatement dans les interfaces TypeScript et les modèles de données partagés sans contournement de type (l'utilisation de `any` est strictement interdite, sauf lors de manipulations de flux binaires non typés).

### II. Architecture Serverless & Neon PostgreSQL (OBLIGATOIRE)
La persistance des données repose sur Neon PostgreSQL Serverless (`@neondatabase/serverless`). Les requêtes SQL doivent être paramétrées, protégées contre les injections, résilientes aux cycles de vie sans état du serverless et adaptées au pooling de connexions. Toutes les migrations et ajustements de schéma doivent être versionnés et idempotents (`init-db.ts`).

### III. Intégrité Métier Maritime & Précision Financière (OBLIGATOIRE)
La logique métier liée aux opérations maritimes (Escales, Connaissements/BLs, DMDT, Importations XML GUCE, Facturation, Avoirs/Notes de crédit) est critique. Les calculs financiers (devises XOF / EUR, TVA, centimes, remises, pénalités) DOIVENT être arrondis et formatés via les modules utilitaires dédiés (`dmdtCalculator.ts`, `invoices.ts`), sans jamais produire d'écart de calcul ou de solde incohérent.

### IV. Modularité & Composants UI Réutilisables (OBLIGATOIRE)
L'interface utilisateur doit respecter les standards modernes de découpage en composants React 18, propulsés par Vite et stylisés avec Tailwind CSS. Les fichiers monolithiques volumineux doivent être découpés en sous-composants clairs, réutilisables et ciblés. L'état applicatif doit être compartimenté pour éviter les recalculs et rendus superflus.

### V. Validation Locale & Passerelles de Déploiement (NON-NÉGOCIABLE)
Toute intervention sur le code, correctif ou ajout de fonctionnalité doit être vérifiée localement avant toute mise en ligne. Le workflow suivant est impératif :
1. **Test et prévisualisation en local** : `npm run dev` (vérification de la compilation, des types et du comportement UI)
2. **Déploiement en production** : `vercel --prod` (après validation et confirmation de bon fonctionnement)

## Stack Technologique & Contraintes d'Architecture

- **Frontend** : React 18, TypeScript, Vite, Tailwind CSS, Icônes Lucide React.
- **Backend & API** : Fonctions Serverless Vercel (`api/*.ts`), environnement Node.js.
- **Base de données** : Neon PostgreSQL Serverless (`@neondatabase/serverless`).
- **Formats et Intégrations** : Analyseur XML GUCE (`xmlGuceParser.ts`), Générateur PDF côté client (`pdfGenerator.ts`).
- **Sécurité & Données** : Variables d'environnement sécurisées (`.env.local`), assainissement des entrées utilisateurs, traçabilité et logs d'audit sur les actions sensibles (`audit.ts`).

## Règles de Qualité & Workflow

1. **Contrôle avant déploiement** : La compilation TypeScript (`tsc`) et le build Vite doivent s'exécuter sans aucune erreur.
2. **Déterminisme des calculs** : Les montants de facturation et de DMDT doivent être prévisibles, vérifiables et reproductibles.
3. **Protocole de fin d'intervention** : Chaque session de travail doit se conclure par la proposition et l'exécution des commandes standards (`npm run dev` et `vercel --prod`).

## Gouvernance

- La présente Constitution prévaut sur toute habitude ou préférence de code informelle.
- Toute évolution majeure touchant à l'architecture, au schéma de données ou aux moteurs de calcul financier doit être documentée sous forme de spécification avant implémentation.
- Toute modification de cette Constitution requiert une documentation claire et l'incrément de sa version sémantique.

**Version** : 1.0.1 | **Ratifiée le** : 2026-08-16 | **Dernière modification** : 2026-08-16
