import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '../api/tickets'

/**
 * Crée le gestionnaire des données de l'API, avec les mêmes réglages dans l'application
 * et dans les tests.
 *
 * - `networkMode: 'always'` : l'API tourne sur cet ordinateur, elle répond même Wi-Fi
 *   coupé. Par défaut, TanStack Query mettrait lectures et enregistrements en attente
 *   dès que le navigateur se déclare hors ligne. Si le backend est vraiment arrêté,
 *   la requête échoue et l'erreur habituelle s'affiche.
 * - `retries` : nouvelles tentatives avant d'afficher une erreur de lecture (aucune si
 *   le ticket n'existe pas). Une seule suffit pour une appli locale ; 0 dans les tests.
 */
export function createQueryClient({ retries = 1 }: { retries?: number } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status === 404) && failureCount < retries,
      },
      mutations: {
        networkMode: 'always',
      },
    },
  })
}
