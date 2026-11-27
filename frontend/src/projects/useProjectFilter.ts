import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

import { fetchProjects } from '../api/projects'

/** Paramètre de l'adresse qui porte le filtre : /?projet=MAISON, /liste?projet=MAISON. */
export const PROJECT_PARAM = 'projet'

/**
 * Projet filtré sur le Board et la Liste, lu dans l'adresse : il survit au
 * rafraîchissement et suit le bouton Précédent. null : tous les projets.
 *
 * Le filtre porte sur la clé du ticket : il ne dépend pas du chargement des projets.
 * Ce hook ne les charge pas lui-même ; il lit le nom du projet s'ils sont déjà
 * chargés (le menu du filtre s'en charge).
 */
export function useProjectFilter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const projectKey = searchParams.get(PROJECT_PARAM)
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    enabled: false,
  })
  const projectName = projects?.find((project) => project.key === projectKey)?.name

  /**
   * Change le filtre. Une nouvelle étape est ajoutée à l'historique (Précédent revient
   * au filtre d'avant), sauf avec `replace` (correction d'une adresse invalide).
   */
  // Même fonction d'un affichage à l'autre : utilisable sans risque dans un useEffect
  const setProjectKey = useCallback(
    (key: string | null, { replace = false } = {}) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (key === null) next.delete(PROJECT_PARAM)
          else next.set(PROJECT_PARAM, key)
          return next
        },
        { replace },
      )
    },
    [setSearchParams],
  )

  return { projectKey, projectName, setProjectKey }
}

/** Tickets du projet filtré, ou tous les tickets sans filtre. */
export function filterByProject<T extends { project: { key: string } }>(
  tickets: readonly T[],
  projectKey: string | null,
): readonly T[] {
  return projectKey === null ? tickets : tickets.filter((t) => t.project.key === projectKey)
}
