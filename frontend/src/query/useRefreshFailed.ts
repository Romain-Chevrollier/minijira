import { hashKey, useQueryClient } from '@tanstack/react-query'
import type { QueryCache, QueryKey } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'

import { ApiError } from '../api/tickets'

/** Pour chaque cache, le dernier échec de chaque requête depuis sa dernière vraie réponse. */
const failuresByCache = new WeakMap<QueryCache, WeakMap<object, Error>>()

function isNotFoundError(error: Error | undefined): boolean {
  return error instanceof ApiError && error.status === 404
}

function getFailures(cache: QueryCache): WeakMap<object, Error> {
  const known = failuresByCache.get(cache)
  if (known) return known

  const failures = new WeakMap<object, Error>()
  // Un seul abonnement par cache, qui vit autant que lui : l'échec est retenu
  // même si on change de vue entre-temps.
  cache.subscribe((event) => {
    if (event.type !== 'updated') return
    const { query, action } = event
    if (action.type === 'error') {
      // Un 404 reste acquis : une panne ensuite ne fait pas réapparaître le ticket
      if (!isNotFoundError(failures.get(query))) failures.set(query, action.error)
    } else if (action.type === 'success' && !action.manual) {
      // `manual` : écriture locale (setQueryData), pas une réponse à un rechargement
      failures.delete(query)
    }
  })
  failuresByCache.set(cache, failures)
  return failures
}

/**
 * Indique si le dernier chargement d'une requête a échoué.
 * `isError` de TanStack Query ne suffit pas : une écriture locale (carte déplacée,
 * ticket enregistré) l'efface alors que les données n'ont pas été rechargées.
 */
export function useRefreshFailed(queryKey: QueryKey) {
  const cache = useQueryClient().getQueryCache()
  const failures = getFailures(cache)
  const hash = hashKey(queryKey)

  const subscribe = useCallback((onChange: () => void) => cache.subscribe(onChange), [cache])
  const error = useSyncExternalStore(subscribe, () => {
    const query = cache.get(hash)
    return query && failures.get(query)
  })

  return { failed: error !== undefined, notFound: isNotFoundError(error) }
}
