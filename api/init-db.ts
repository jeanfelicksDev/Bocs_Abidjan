import { sql } from './_db.js';

export default async function handler(req: any, res: any) {
  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        nom_complet VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL,
        telephone VARCHAR(50),
        nom_societe VARCHAR(255),
        pays VARCHAR(100),
        est_actif BOOLEAN NOT NULL DEFAULT TRUE,
        mot_de_passe VARCHAR(255),
        date_creation VARCHAR(50),
        dernier_acces VARCHAR(50)
      );
    `;

    // Create invoice_type_configs table
    await sql`
      CREATE TABLE IF NOT EXISTS invoice_type_configs (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT
      );
    `;


    // Create rubrique_configs table
    await sql`
      CREATE TABLE IF NOT EXISTS rubrique_configs (
        id VARCHAR(50) PRIMARY KEY,
        invoice_type_id VARCHAR(50) NOT NULL,
        category VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        code VARCHAR(50) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        montant_unitaire BIGINT NOT NULL,
        base_calcul VARCHAR(50) NOT NULL
      );
    `;

    // Create invoices table
    await sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id BIGINT PRIMARY KEY,
        bl_id INT NOT NULL,
        numero_bl VARCHAR(100) NOT NULL,
        client_nom VARCHAR(255) NOT NULL,
        escale_info VARCHAR(255) NOT NULL,
        type_facture VARCHAR(100) NOT NULL,
        numero_facture VARCHAR(100) NOT NULL,
        date_facture VARCHAR(50) NOT NULL,
        date_echeance VARCHAR(50) NOT NULL,
        devise VARCHAR(10) NOT NULL,
        taux_change_usd INT NOT NULL,
        montant_ht BIGINT NOT NULL,
        tva BIGINT NOT NULL,
        montant_ttc BIGINT NOT NULL,
        solde_du BIGINT NOT NULL,
        statut_paiement VARCHAR(50) NOT NULL,
        invoice_type_id VARCHAR(50),
        statut_facture VARCHAR(50) DEFAULT 'BROUILLON',
        motif_annulation TEXT,
        facture_origine_id BIGINT,
        avoir_id BIGINT,
        created_by VARCHAR(255),
        validated_by VARCHAR(255),
        validated_at VARCHAR(50),
        cancelled_at VARCHAR(50)
      );
    `;

    // Ensure columns exist and use consistent BIGINT types across the entire database
    try {
      await sql`ALTER TABLE invoices ALTER COLUMN bl_id TYPE BIGINT;`;
      await sql`ALTER TABLE bls ALTER COLUMN escale_id TYPE BIGINT;`;
      await sql`ALTER TABLE containers ALTER COLUMN bl_id TYPE BIGINT;`;
      await sql`ALTER TABLE invoice_items ALTER COLUMN invoice_id TYPE BIGINT;`;
      await sql`ALTER TABLE credit_notes ALTER COLUMN facture_id TYPE BIGINT;`;
      await sql`ALTER TABLE credit_note_items ALTER COLUMN credit_note_id TYPE BIGINT;`;
      await sql`ALTER TABLE payments ALTER COLUMN facture_id TYPE BIGINT;`;
      await sql`ALTER TABLE containers ADD COLUMN IF NOT EXISTS is_dangerous BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE containers ADD COLUMN IF NOT EXISTS soc_coc VARCHAR(50);`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type_id VARCHAR(50);`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS statut_facture VARCHAR(50) DEFAULT 'BROUILLON';`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS motif_annulation TEXT;`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS facture_origine_id BIGINT;`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS avoir_id BIGINT;`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS validated_by VARCHAR(255);`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS validated_at VARCHAR(50);`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at VARCHAR(50);`;
      // Taxe additionnelle exceptionnelle (assiette : montant TTC) — historique figé à l'émission
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS montant_ttc_avant_taxe BIGINT;`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS taxe_additionnelle BIGINT DEFAULT 0;`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS taxe_additionnelle_libelle VARCHAR(255);`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS taxe_additionnelle_mode VARCHAR(30);`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS taxe_additionnelle_valeur NUMERIC;`;
      // Timbre fiscal d'État (assiette : montant HT, par tranches) + mode de règlement
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS timbre_fiscal BIGINT DEFAULT 0;`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_comptant BOOLEAN;`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS mode_reglement VARCHAR(30);`;
      await sql`ALTER TABLE rubrique_configs ALTER COLUMN montant_unitaire TYPE BIGINT;`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(100);`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry VARCHAR(50);`;

      // Clean non-container rubriques for Caution and Transfert
      await sql`DELETE FROM rubrique_configs WHERE (invoice_type_id = '1' OR invoice_type_id = '4') AND category != 'CONTENEUR';`;

      // Clean obsolete/unwanted rubriques like Frais d'échange BL (SOC)
      await sql`DELETE FROM rubrique_configs WHERE id = '205' OR (category = 'CONTENEUR_SOC' AND (name ILIKE '%échange%' OR code = 'ECH-SOC'));`;
    } catch (e) {
      console.log('Columns migration completed or not needed', e);
    }

    // Create invoice_items table
    await sql`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id BIGINT NOT NULL,
        designation VARCHAR(255) NOT NULL,
        type_frais VARCHAR(50) NOT NULL,
        quantite DOUBLE PRECISION NOT NULL,
        prix_unitaire INT NOT NULL,
        montant_ht BIGINT NOT NULL,
        taux_tva INT NOT NULL
      );
    `;

    // Create credit_notes table
    await sql`
      CREATE TABLE IF NOT EXISTS credit_notes (
        id BIGINT PRIMARY KEY,
        numero_avoir VARCHAR(100) NOT NULL,
        facture_id BIGINT NOT NULL,
        numero_facture_origine VARCHAR(100) NOT NULL,
        client_nom VARCHAR(255) NOT NULL,
        motif TEXT NOT NULL,
        date_emission VARCHAR(50) NOT NULL,
        montant_ht BIGINT NOT NULL,
        tva BIGINT NOT NULL,
        montant_ttc BIGINT NOT NULL,
        statut VARCHAR(50) NOT NULL DEFAULT 'VALIDE',
        created_by VARCHAR(255)
      );
    `;

    // Create credit_note_items table
    await sql`
      CREATE TABLE IF NOT EXISTS credit_note_items (
        id SERIAL PRIMARY KEY,
        credit_note_id BIGINT NOT NULL,
        designation VARCHAR(255) NOT NULL,
        type_frais VARCHAR(50) NOT NULL,
        quantite DOUBLE PRECISION NOT NULL,
        prix_unitaire INT NOT NULL,
        montant_ht BIGINT NOT NULL,
        taux_tva INT NOT NULL
      );
    `;

    // Create payments table
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id BIGINT PRIMARY KEY,
        facture_id BIGINT NOT NULL,
        facture_numero VARCHAR(100) NOT NULL,
        client_nom VARCHAR(255) NOT NULL,
        date_paiement VARCHAR(50) NOT NULL,
        montant_paye INT NOT NULL,
        mode_paiement VARCHAR(50) NOT NULL,
        reference VARCHAR(100),
        caisse_nom VARCHAR(100) NOT NULL,
        statut VARCHAR(50) NOT NULL
      );
    `;

    // Create audit_logs table
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT PRIMARY KEY,
        utilisateur_nom VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        entite VARCHAR(100) NOT NULL,
        details TEXT NOT NULL,
        date_action VARCHAR(50) NOT NULL,
        ip VARCHAR(50) NOT NULL
      );
    `;

    // Create escales table
    await sql`
      CREATE TABLE IF NOT EXISTS escales (
        id BIGINT PRIMARY KEY,
        nom_navire VARCHAR(255) NOT NULL,
        callsign VARCHAR(100) NOT NULL,
        numero_voyage VARCHAR(100) NOT NULL,
        port_chargement VARCHAR(255) NOT NULL,
        port_dechargement VARCHAR(255) NOT NULL,
        date_arrivee VARCHAR(50) NOT NULL,
        date_depart VARCHAR(50),
        statut VARCHAR(50) NOT NULL,
        created_by VARCHAR(255)
      );
    `;

    // Create bls table
    await sql`
      CREATE TABLE IF NOT EXISTS bls (
        id BIGINT PRIMARY KEY,
        escale_id BIGINT NOT NULL,
        numero_bl VARCHAR(100) NOT NULL,
        type_operation VARCHAR(50) NOT NULL,
        shipper_nom VARCHAR(255) NOT NULL,
        shipper_adresse TEXT,
        consignee_nom VARCHAR(255) NOT NULL,
        consignee_adresse TEXT,
        notify_nom VARCHAR(255),
        notify_adresse TEXT,
        port_chargement_code VARCHAR(50) NOT NULL,
        port_dechargement_code VARCHAR(50) NOT NULL,
        destination_finale VARCHAR(100),
        description_goods TEXT,
        nombre_colis INT NOT NULL,
        type_emballage VARCHAR(100) NOT NULL,
        poids_brut_kg DOUBLE PRECISION NOT NULL,
        volume_m3 DOUBLE PRECISION NOT NULL,
        statut_import VARCHAR(50) NOT NULL,
        selected_invoice_type_ids TEXT,
        client_id INT,
        code_nature VARCHAR(100),
        unique_carrier_ref VARCHAR(100),
        marques_et_numeros TEXT,
        cachet_agent_appose BOOLEAN DEFAULT FALSE,
        date_signature VARCHAR(50),
        hash_signature VARCHAR(255)
      );
    `;

    // Create containers table
    await sql`
      CREATE TABLE IF NOT EXISTS containers (
        id BIGINT PRIMARY KEY,
        bl_id BIGINT NOT NULL,
        numero_conteneur VARCHAR(100) NOT NULL,
        type_conteneur VARCHAR(50) NOT NULL,
        numero_scelle VARCHAR(100) NOT NULL,
        poids_kg DOUBLE PRECISION NOT NULL,
        tare_kg DOUBLE PRECISION NOT NULL,
        nombre_colis INT NOT NULL,
        date_entree_parc VARCHAR(50),
        date_sortie_parc VARCHAR(50),
        montant_caution_fcfa INT NOT NULL,
        statut_livraison VARCHAR(50)
      );
    `;


    // Populate initial users data if table is empty
    const userCountRes = await sql`SELECT COUNT(*)::int as count FROM users;`;
    const userCount = userCountRes && userCountRes[0] ? Number(userCountRes[0].count) : 0;
    if (userCount === 0) {
      await sql`
        INSERT INTO users (id, nom_complet, email, role, telephone, nom_societe, pays, est_actif, mot_de_passe, date_creation, dernier_acces) VALUES
        (1, 'Jean-Marc KOFFI', 'admin@bocs.ci', 'ADMIN', '+225 07 08 09 10 11', 'BOCS CI Agency', 'Côte d''Ivoire', true, 'admin123', '2026-01-01', '2026-04-01'),
        (2, 'Marie-Claire ADOU', 'import@bocs.ci', 'AGENT_IMPORT', '+225 05 06 07 08 09', 'BOCS CI Agency', 'Côte d''Ivoire', true, 'import123', '2026-01-01', '2026-04-01'),
        (3, 'Kouassi PATRICE', 'export@bocs.ci', 'AGENT_EXPORT', '+225 01 02 03 04 05', 'BOCS CI Agency', 'Côte d''Ivoire', true, 'export123', '2026-01-01', '2026-04-01'),
        (4, 'Awa DIABATE', 'compta@bocs.ci', 'COMPTABILITE', '+225 07 11 22 33 44', 'BOCS CI Agency', 'Côte d''Ivoire', true, 'compta123', '2026-01-01', '2026-04-01');
      `;
    }

    // Populate initial configuration data if tables are empty
    const typeCountRes = await sql`SELECT COUNT(*)::int as count FROM invoice_type_configs;`;

    const typeCount = typeCountRes && typeCountRes[0] ? Number(typeCountRes[0].count) : 0;
    if (typeCount === 0) {
      await sql`
        INSERT INTO invoice_type_configs (id, name, description) VALUES
        ('1', 'Caution', 'Facturation de garantie'),
        ('2', 'Echange', 'Frais d''échange BL'),
        ('3', 'Telex', 'Frais de communication'),
        ('4', 'Transfert', 'Déplacement de charge');
      `;
    }

    const rubriqueCountRes = await sql`SELECT COUNT(*)::int as count FROM rubrique_configs;`;
    const rubriqueCount = rubriqueCountRes && rubriqueCountRes[0] ? Number(rubriqueCountRes[0].count) : 0;
    if (rubriqueCount === 0) {
      // Caution - Conteneur (La caution ne concerne que le type CONTENEUR)
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('101', '1', 'CONTENEUR', 'Frais de dossier', 'Frais administratifs standards', 'FR-DOS', true, 15000, 'BL');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('102', '1', 'CONTENEUR', 'Garantie Conteneur', 'Dépôt de garantie équipement', 'GAR-CTR', true, 50000, 'CONTENEUR');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('103', '1', 'CONTENEUR', 'Manutention', 'Frais de grutage/manipulation', 'MAN-01', false, 25000, 'CONTENEUR');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('104', '1', 'CONTENEUR', 'Stockage', 'Frais de parc prolongé', 'STK-PRC', false, 12000, 'CONTENEUR');`;

      // Echange - Conteneur COC
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('201', '2', 'CONTENEUR_COC', 'Frais de dossier (Echange B/L)', 'Frais administratifs standards', 'FR-DOS', true, 50000, 'BL');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('202', '2', 'CONTENEUR_COC', 'Frais d''échange BL (COC)', 'Échange physique conteneur armement', 'ECH-COC', true, 20000, 'BL');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('203', '2', 'CONTENEUR_COC', 'ISPS on TC- Terminal security', 'Taxe de sécurité terminal ISPS', 'ISPS', true, 14431, 'TEU');`;

      // Echange - Conteneur SOC (Pas de frais d'échange pour SOC)
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('204', '2', 'CONTENEUR_SOC', 'Frais de dossier (Echange B/L)', 'Frais administratifs standards', 'FR-DOS', true, 50000, 'BL');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('206', '2', 'CONTENEUR_SOC', 'ISPS on TC- Terminal security', 'Taxe de sécurité terminal ISPS', 'ISPS', true, 14431, 'TEU');`;

      // Echange - Vrac
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('207', '2', 'VRAC', 'Frais d''échange BL', 'Échange physique des documents BL', 'ECH-BL', true, 20000, 'BL');`;

      // Echange - RORO
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('208', '2', 'RORO', 'Frais d''échange BL (RORO)', 'Échange physique des documents BL RORO', 'ECH-RORO', true, 20000, 'BL');`;

      // Echange - CONVENTIONNEL
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('209', '2', 'CONVENTIONNEL', 'Frais d''échange BL (Conventionnel)', 'Échange physique des documents BL Conventionnel', 'ECH-CONV', true, 20000, 'BL');`;

      // Telex - Conteneur
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('301', '3', 'CONTENEUR', 'Frais de message Telex', 'Frais de libération par télex', 'TLX-FEE', true, 25000, 'BL');`;

      // Transfert - Conteneur
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('401', '4', 'CONTENEUR', 'Frais de transfert parc', 'Déplacement de charge vers terminal', 'TRF-PRC', true, 35000, 'CONTENEUR');`;
    }

      // 3. Déduplication automatique des escales identiques
      await sql`
        DELETE FROM escales a USING escales b 
        WHERE a.id < b.id 
          AND a.nom_navire = b.nom_navire 
          AND a.numero_voyage = b.numero_voyage;
      `;

      // 4. Déduplication automatique des BLs identiques
      await sql`
        DELETE FROM bls a USING bls b 
        WHERE a.id < b.id 
          AND a.numero_bl = b.numero_bl 
          AND a.escale_id = b.escale_id;
      `;
      return res.status(200).json({ success: true, message: "Database tables initialized and deduplicated." });
    } catch (e: any) {
      console.log('Database initialization error:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
}

