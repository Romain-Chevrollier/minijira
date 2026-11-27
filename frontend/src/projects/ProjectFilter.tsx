import { useQuery } from '@tanstack/react-query'
import { useEffect, useId } from 'react'

import { fetchProjects } from '../api/projects'
import { useProjectFilter } from './useProjectFilter'

/** Menu « Filtrer par projet » du Board et de la Liste : tous les projets ou un seul. */
export function ProjectFilter() {
  const id = useId()
  const { projectKey, setProjectKey } = useProjectFilter()
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  // Clé absente des projets chargés (faute de frappe, projet supprimé…)
  const isUnknown =
    projectKey !== null &&
    projects !== undefined &&
    !projects.some((project) => project.key === projectKey)

  useEffect(() => {
    // Retour à « Tous les projets », sans étape de plus dans l'historique
    if (isUnknown) setProjectKey(null, { replace: true })
  }, [isUnknown, setProjectKey])

  return (
    <div className="project-filter">
      <label htmlFor={id}>Filtrer par projet</label>
      <select
        id={id}
        value={isUnknown ? '' : (projectKey ?? '')}
        onChange={(event) => setProjectKey(event.target.value || null)}
      >
        <option value="">Tous les projets</option>
        {projects?.map((project) => (
          <option key={project.id} value={project.key}>
            {project.name}
          </option>
        ))}
        {/* Projets pas encore chargés : le projet de l'adresse reste affiché */}
        {projectKey && !projects && <option value={projectKey}>{projectKey}</option>}
      </select>
    </div>
  )
}
