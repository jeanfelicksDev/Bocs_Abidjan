/**
 * Validation des numéros de conteneurs selon la norme universelle ISO 6346.
 *
 * Structure d'un numéro de conteneur ISO 6346 :
 * - Code propriétaire : 3 lettres majuscules (A-Z)
 * - Identifiant de catégorie : 1 lettre (U = conteneur de fret, J = équipement détachable, Z = remorque/châssis)
 * - Numéro de série : 6 chiffres (0-9)
 * - Clé d'autocontrôle (Check digit) : 1 chiffre (0-9)
 *
 * Algorithme :
 * Chaque lettre a une valeur numérique spécifique (les multiples de 11 sont omis : 11, 22, 33).
 * Les 10 premiers caractères sont multipliés par 2^i (pour i de 0 à 9).
 * La somme modulo 11 donne le chiffre d'autocontrôle (si le reste est 10, le chiffre est 0).
 */

const LETTER_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
  K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
  U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38
};

/**
 * Calcule la clé de contrôle ISO 6346 pour les 10 premiers caractères d'un conteneur.
 * Retourne un chiffre entre 0 et 9, ou -1 en cas d'erreur de format.
 */
export function calculateIso6346CheckDigit(first10Chars: string): number {
  const clean = (first10Chars || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 10) return -1;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = clean[i];
    let val: number;
    if (char >= '0' && char <= '9') {
      val = parseInt(char, 10);
    } else if (LETTER_VALUES[char] !== undefined) {
      val = LETTER_VALUES[char];
    } else {
      return -1;
    }
    const weight = Math.pow(2, i);
    sum += val * weight;
  }

  const remainder = sum % 11;
  return remainder % 10;
}

export interface ContainerValidationResult {
  isValid: boolean;
  cleanNumber: string;
  formattedNumber: string;
  expectedCheckDigit?: number;
  actualCheckDigit?: number;
  error?: string;
}

/**
 * Valide un numéro de conteneur selon la norme ISO 6346.
 */
export function validateContainerNumber(rawNumber: string): ContainerValidationResult {
  if (!rawNumber || typeof rawNumber !== 'string') {
    return {
      isValid: false,
      cleanNumber: '',
      formattedNumber: '',
      error: 'Veuillez saisir un numéro de conteneur.'
    };
  }

  const clean = rawNumber.toUpperCase().replace(/[\s\-_]/g, '').trim();

  if (clean.length === 0) {
    return {
      isValid: false,
      cleanNumber: '',
      formattedNumber: '',
      error: 'Le numéro de conteneur ne peut pas être vide.'
    };
  }

  if (clean.length !== 11) {
    return {
      isValid: false,
      cleanNumber: clean,
      formattedNumber: clean,
      error: `Format invalide : un numéro de conteneur ISO 6346 doit comporter exactement 11 caractères (4 lettres suivies de 7 chiffres, ex: CAIU4512408). Caractères détectés : ${clean.length}.`
    };
  }

  const ownerAndCategory = clean.substring(0, 4);
  const serialNumber = clean.substring(4, 10);
  const checkDigitStr = clean.substring(10, 11);

  if (!/^[A-Z]{4}$/.test(ownerAndCategory)) {
    return {
      isValid: false,
      cleanNumber: clean,
      formattedNumber: clean,
      error: `Format invalide : les 4 premiers caractères doivent être des lettres (code propriétaire + catégorie, ex: CAIU, BOCU, MSKU).`
    };
  }

  if (!/^\d{6}$/.test(serialNumber)) {
    return {
      isValid: false,
      cleanNumber: clean,
      formattedNumber: clean,
      error: `Format invalide : les caractères 5 à 10 doivent être 6 chiffres de série (ex: 451240).`
    };
  }

  if (!/^\d$/.test(checkDigitStr)) {
    return {
      isValid: false,
      cleanNumber: clean,
      formattedNumber: clean,
      error: `Format invalide : le 11ème caractère doit être un chiffre de contrôle (0-9).`
    };
  }

  const actualCheckDigit = parseInt(checkDigitStr, 10);
  const expectedCheckDigit = calculateIso6346CheckDigit(clean.substring(0, 10));

  if (actualCheckDigit !== expectedCheckDigit) {
    return {
      isValid: false,
      cleanNumber: clean,
      formattedNumber: `${ownerAndCategory}-${serialNumber}-${actualCheckDigit}`,
      actualCheckDigit,
      expectedCheckDigit,
      error: `Numéro de conteneur invalide (Norme ISO 6346) : la clé de contrôle pour ${ownerAndCategory}${serialNumber} est ${expectedCheckDigit} (clé saisie : ${actualCheckDigit}).`
    };
  }

  return {
    isValid: true,
    cleanNumber: clean,
    formattedNumber: `${ownerAndCategory}-${serialNumber}-${actualCheckDigit}`,
    actualCheckDigit,
    expectedCheckDigit
  };
}

/**
 * Formate un numéro de conteneur propre au format standard ISO (ex: BOCU-452109-4).
 */
export function formatIsoContainerNumber(rawNumber: string): string {
  const clean = (rawNumber || '').toUpperCase().replace(/[\s\-_]/g, '').trim();
  if (clean.length === 11 && /^[A-Z]{4}\d{7}$/.test(clean)) {
    return `${clean.substring(0, 4)}-${clean.substring(4, 10)}-${clean.substring(10, 11)}`;
  }
  return rawNumber.toUpperCase().trim();
}
