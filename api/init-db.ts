import { sql } from './db';

export default async function handler(req: any, res: any) {
  try {
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
        montant_unitaire INT NOT NULL,
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
        statut_paiement VARCHAR(50) NOT NULL
      );
    `;

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

    // Populate initial configuration data if tables are empty
    const typeCountRes = await sql`SELECT COUNT(*)::int as count FROM invoice_type_configs;`;
    if (typeCountRes[0].count === 0) {
      await sql`
        INSERT INTO invoice_type_configs (id, name, description) VALUES
        ('1', 'Facture Caution', 'Frais et dépôts de garanties de conteneurs'),
        ('2', 'Facture Echange', 'Frais d''échange documentaire et de dossier'),
        ('3', 'Facture Telex Release', 'Frais de mainlevée ou libération par Télex'),
        ('4', 'Facture Transfert sous Douane / Parc', 'Déplacement et positionnement de marchandise');
      `;
    }

    const rubriqueCountRes = await sql`SELECT COUNT(*)::int as count FROM rubrique_configs;`;
    if (rubriqueCountRes[0].count === 0) {
      // Caution - Conteneur
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('101', '1', 'CONTENEUR', 'Frais de dossier', 'Frais administratifs standards', 'FR-DOS', true, 15000, 'BL');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('102', '1', 'CONTENEUR', 'Garantie Conteneur', 'Dépôt de garantie équipement', 'GAR-CTR', true, 50000, 'CONTENEUR');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('103', '1', 'CONTENEUR', 'Manutention', 'Frais de grutage/manipulation', 'MAN-01', false, 25000, 'CONTENEUR');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('104', '1', 'CONTENEUR', 'Stockage', 'Frais de parc prolongé', 'STK-PRC', false, 12000, 'CONTENEUR');`;
      
      // Caution - Vrac
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('105', '1', 'VRAC', 'Frais de dossier', 'Frais administratifs standards', 'FR-DOS', true, 15000, 'BL');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('106', '1', 'VRAC', 'Passe Portuaire', 'Accès zone portuaire vrac', 'PSC-VRC', false, 5000, 'POIDS_TONNE');`;

      // Caution - Ro-Ro
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('107', '1', 'RORO', 'Frais de dossier', 'Frais administratifs standards', 'FR-DOS', true, 15000, 'BL');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('108', '1', 'RORO', 'Taxe Ro-Ro', 'Redevance débarquement véhicule', 'TX-RORO', true, 30000, 'BL');`;

      // Caution - Conventionnel
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('109', '1', 'CONVENTIONNEL', 'Frais de dossier', 'Frais administratifs standards', 'FR-DOS', true, 15000, 'BL');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('110', '1', 'CONVENTIONNEL', 'Surcharge Colis Lourd', 'Manutention colis exceptionnels', 'SCH-LVR', false, 75000, 'POIDS_TONNE');`;

      // Echange - Conteneur
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('201', '2', 'CONTENEUR', 'Frais d''échange BL', 'Échange physique des documents BL', 'ECH-BL', true, 20000, 'BL');`;
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('202', '2', 'CONTENEUR', 'Frais de dossier', 'Frais administratifs standards', 'FR-DOS', true, 15000, 'BL');`;

      // Echange - Vrac
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('203', '2', 'VRAC', 'Frais d''échange BL', 'Échange physique des documents BL', 'ECH-BL', true, 20000, 'BL');`;

      // Telex - Conteneur
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('301', '3', 'CONTENEUR', 'Frais de message Telex', 'Frais de libération par télex', 'TLX-FEE', true, 25000, 'BL');`;

      // Transfert - Conteneur
      await sql`INSERT INTO rubrique_configs (id, invoice_type_id, category, name, description, code, is_active, montant_unitaire, base_calcul) VALUES ('401', '4', 'CONTENEUR', 'Frais de transfert parc', 'Déplacement de charge vers terminal', 'TRF-PRC', true, 35000, 'CONTENEUR');`;
    }

    return res.status(200).json({ success: true, message: "Database tables initialized and populated." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
