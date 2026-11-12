-- Code court du navire dans les numéros de facture (ex. MANA).
-- Idempotent : peut être rejoué sans effet si la colonne existe déjà.
-- À appliquer sur la base Neon AVANT de déployer la version qui lit `code_navire`.
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS code_navire VARCHAR(4);
