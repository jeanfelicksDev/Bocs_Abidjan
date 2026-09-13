import { sql } from './_db.js';

export default async function handler(req: any, res: any) {
  const method = req.method;

  if (method === 'GET') {
    try {
      const rows = await sql`
        SELECT 
          id,
          nom_complet as "nomComplet",
          email,
          role,
          telephone,
          nom_societe as "nomSociete",
          pays,
          est_actif as "estActif",
          mot_de_passe as "motDePasse",
          date_creation as "dateCreation",
          dernier_acces as "dernierAcces"
        FROM users
        ORDER BY id ASC;
      `;

      const users = rows.map((u: any) => ({
        ...u,
        id: Number(u.id),
        estActif: Boolean(u.estActif)
      }));

      return res.status(200).json({ success: true, users });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (method === 'POST') {
    try {
      const data = req.body;
      if (!data) {
        return res.status(400).json({ success: false, error: 'Missing request body' });
      }

      // Login check action
      if (data.action === 'login') {
        const { email, password } = data;
        if (!email || !password) {
          return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
        }

        const found = await sql`
          SELECT 
            id,
            nom_complet as "nomComplet",
            email,
            role,
            telephone,
            nom_societe as "nomSociete",
            pays,
            est_actif as "estActif",
            mot_de_passe as "motDePasse",
            date_creation as "dateCreation",
            dernier_acces as "dernierAcces"
          FROM users
          WHERE LOWER(email) = LOWER(${email.trim()})
          LIMIT 1;
        `;

        if (found.length === 0) {
          return res.status(401).json({ success: false, error: 'Identifiants incorrects ou compte inexistant.' });
        }

        const user = found[0];
        if (!user.estActif) {
          return res.status(403).json({ success: false, error: 'Ce compte a été désactivé par l\'administrateur.' });
        }

        // Check password (plain comparison or fallback default)
        if (user.motDePasse && user.motDePasse !== password.trim()) {
          return res.status(401).json({ success: false, error: 'Mot de passe incorrect.' });
        }

        // Update dernier_acces
        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
        await sql`
          UPDATE users 
          SET dernier_acces = ${nowStr}
          WHERE id = ${user.id};
        `;

        const userSafe = {
          ...user,
          id: Number(user.id),
          estActif: Boolean(user.estActif),
          dernierAcces: nowStr
        };

        return res.status(200).json({ success: true, user: userSafe });
      }

      // Request password reset (generate 6-digit OTP code)
      if (data.action === 'request_password_reset') {
        const { email } = data;
        if (!email) {
          return res.status(400).json({ success: false, error: 'Email requis.' });
        }

        const found = await sql`
          SELECT id, nom_complet as "nomComplet", email, est_actif as "estActif"
          FROM users
          WHERE LOWER(email) = LOWER(${email.trim()})
          LIMIT 1;
        `;

        if (found.length === 0) {
          return res.status(404).json({ success: false, error: 'Aucun compte associé à cette adresse email.' });
        }

        const user = found[0];
        if (!user.estActif) {
          return res.status(403).json({ success: false, error: 'Ce compte a été désactivé par l\'administrateur.' });
        }

        // Generate 6-digit numeric security code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiryTimestamp = (Date.now() + 15 * 60 * 1000).toString(); // 15 mins

        await sql`
          UPDATE users
          SET reset_token = ${resetCode}, reset_token_expiry = ${expiryTimestamp}
          WHERE id = ${user.id};
        `;

        return res.status(200).json({
          success: true,
          message: `Un code de sécurité à 6 chiffres a été préparé pour ${user.email}.`,
          email: user.email,
          demoResetCode: resetCode
        });
      }

      // Confirm password reset
      if (data.action === 'confirm_password_reset') {
        const { email, resetCode, newPassword } = data;
        if (!email || !resetCode || !newPassword) {
          return res.status(400).json({ success: false, error: 'Tous les champs sont obligatoires.' });
        }

        if (newPassword.length < 6) {
          return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter au moins 6 caractères.' });
        }

        const found = await sql`
          SELECT id, nom_complet as "nomComplet", email, reset_token as "resetToken", reset_token_expiry as "resetTokenExpiry"
          FROM users
          WHERE LOWER(email) = LOWER(${email.trim()})
          LIMIT 1;
        `;

        if (found.length === 0) {
          return res.status(404).json({ success: false, error: 'Compte introuvable.' });
        }

        const user = found[0];
        if (!user.resetToken || user.resetToken.trim() !== resetCode.trim()) {
          return res.status(400).json({ success: false, error: 'Code de sécurité incorrect.' });
        }

        if (user.resetTokenExpiry && Date.now() > Number(user.resetTokenExpiry)) {
          return res.status(400).json({ success: false, error: 'Ce code de sécurité a expiré. Veuillez refaire une demande.' });
        }

        // Update password and clear reset token
        await sql`
          UPDATE users
          SET 
            mot_de_passe = ${newPassword.trim()},
            reset_token = NULL,
            reset_token_expiry = NULL
          WHERE id = ${user.id};
        `;

        return res.status(200).json({
          success: true,
          message: 'Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter.'
        });
      }

      // Create new user (or self-registration)
      const id = data.id ? Number(data.id) : Date.now();
      const nomComplet = data.nomComplet?.trim() || 'Utilisateur';
      const email = data.email?.trim().toLowerCase();
      const role = data.role || 'CLIENT_EXPORT';
      const telephone = data.telephone?.trim() || null;
      const nomSociete = data.nomSociete?.trim() || null;
      const pays = data.pays || 'Côte d\'Ivoire';
      const estActif = data.estActif !== undefined ? Boolean(data.estActif) : true;
      const motDePasse = data.motDePasse || data.password || 'bocs2026';
      const dateCreation = data.dateCreation || new Date().toISOString().split('T')[0];
      const dernierAcces = data.dernierAcces || null;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email obligatoire.' });
      }

      // Check if email already exists
      const existing = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email});`;
      if (existing.length > 0) {
        return res.status(409).json({ success: false, error: 'Un compte avec cette adresse email existe déjà.' });
      }

      await sql`
        INSERT INTO users (
          id, nom_complet, email, role, telephone, nom_societe, pays, est_actif, mot_de_passe, date_creation, dernier_acces
        ) VALUES (
          ${id}, ${nomComplet}, ${email}, ${role}, ${telephone}, ${nomSociete}, ${pays}, ${estActif}, ${motDePasse}, ${dateCreation}, ${dernierAcces}
        );
      `;

      return res.status(201).json({
        success: true,
        user: {
          id,
          nomComplet,
          email,
          role,
          telephone,
          nomSociete,
          pays,
          estActif,
          dateCreation,
          dernierAcces
        }
      });
    } catch (error: any) {
      console.error('Error creating user:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (method === 'PUT') {
    try {
      const data = req.body;
      const id = Number(data.id || req.query.id);
      if (!id || isNaN(id)) {
        return res.status(400).json({ success: false, error: 'ID utilisateur manquant ou invalide.' });
      }

      // Update fields
      if (data.action === 'change_password') {
        const { currentPassword, newPassword } = data;
        if (!newPassword || newPassword.length < 6) {
          return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' });
        }

        const userRow = await sql`SELECT mot_de_passe FROM users WHERE id = ${id};`;
        if (userRow.length === 0) {
          return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
        }

        if (currentPassword && userRow[0].mot_de_passe && userRow[0].mot_de_passe !== currentPassword.trim()) {
          return res.status(401).json({ success: false, error: 'L\'ancien mot de passe est incorrect.' });
        }

        await sql`UPDATE users SET mot_de_passe = ${newPassword.trim()} WHERE id = ${id};`;
        return res.status(200).json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
      }

      // Standard user update
      const nomComplet = data.nomComplet?.trim();
      const email = data.email?.trim().toLowerCase();
      const role = data.role;
      const telephone = data.telephone?.trim();
      const nomSociete = data.nomSociete?.trim();
      const pays = data.pays;
      const estActif = data.estActif !== undefined ? Boolean(data.estActif) : undefined;
      const motDePasse = data.motDePasse?.trim();
      const dernierAcces = data.dernierAcces;

      await sql`
        UPDATE users
        SET 
          nom_complet = COALESCE(${nomComplet}, nom_complet),
          email = COALESCE(${email}, email),
          role = COALESCE(${role}, role),
          telephone = COALESCE(${telephone}, telephone),
          nom_societe = COALESCE(${nomSociete}, nom_societe),
          pays = COALESCE(${pays}, pays),
          est_actif = COALESCE(${estActif}, est_actif),
          mot_de_passe = COALESCE(${motDePasse}, mot_de_passe),
          dernier_acces = COALESCE(${dernierAcces}, dernier_acces)
        WHERE id = ${id};
      `;

      return res.status(200).json({ success: true, message: 'Utilisateur mis à jour avec succès.' });
    } catch (error: any) {
      console.error('Error updating user:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (method === 'DELETE') {
    try {
      const id = Number(req.query.id || req.body?.id);
      if (!id || isNaN(id)) {
        return res.status(400).json({ success: false, error: 'ID utilisateur manquant ou invalide.' });
      }

      await sql`DELETE FROM users WHERE id = ${id};`;
      return res.status(200).json({ success: true, message: 'Utilisateur supprimé avec succès.' });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed.' });
}
