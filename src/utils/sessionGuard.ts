/**
 * Session côté navigateur : l'API répond 401 quand le cookie de session est absent
 * ou expiré (12 h). Plutôt que de laisser l'interface affichée sur des listes vides,
 * on prévient l'application, qui ramène à l'écran de connexion.
 */
export const SESSION_EXPIRED_EVENT = 'bocs:session-expired';

let installed = false;

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/** Surveille les réponses de l'API ; un refus de connexion (mauvais mot de passe) n'est pas une expiration. */
export function installSessionGuard(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    if (response.status === 401 && /\/api\//.test(urlOf(input))) {
      const isLoginAttempt = typeof init?.body === 'string' && init.body.includes('"action":"login"');
      if (!isLoginAttempt) window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    return response;
  };
}

/** Efface le cookie de session côté serveur. */
export const logoutOnServer = () =>
  fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'logout' })
  }).catch(() => null);
