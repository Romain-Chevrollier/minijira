import { useQuery } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'

import { fetchProjects } from '../api/projects'
import type { Project } from '../api/projects'
import { StaleDataNotice } from '../query/StaleDataNotice'
import { useRefreshFailed } from '../query/useRefreshFailed'
import { ProjectCreateForm } from './ProjectCreateForm'
import { ProjectRow } from './ProjectRow'
import './ProjectsPage.css'

/** Écran « Projets », à l'adresse /projets : lister, créer, renommer et supprimer. */
export function ProjectsPage() {
  const titleId = useId()
  // Même donnée que le choix du projet dans « Nouveau ticket » : tout reste à jour
  const {
    data: projects,
    isPending,
    isLoadingError,
    isFetching,
    refetch,
  } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const { failed } = useRefreshFailed(['projects'])
  const [isCreating, setIsCreating] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  // « Nouveau projet » reprend le focus quand le formulaire se ferme
  const focusNewProject = useRef(false)

  function closeForm() {
    focusNewProject.current = true
    setIsCreating(false)
  }

  let content
  if (isPending) {
    content = <p role="status">Chargement des projets…</p>
  } else if (isLoadingError) {
    content = (
      <div role="alert" className="ticket-list-error">
        <p>Impossible de charger les projets.</p>
        <button
          type="button"
          className="button-secondary"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          Réessayer
        </button>
      </div>
    )
  } else {
    content = (
      <>
        <StaleDataNotice isStale={failed} isRetrying={isFetching} onRetry={() => void refetch()} />
        <ProjectTable
          projects={projects}
          // Le focus passe sur le titre : la ligne supprimée et ses boutons disparaissent
          onDeleted={() => heading.current?.focus()}
        />
      </>
    )
  }

  return (
    <section aria-labelledby={titleId}>
      <div className="page-header projects-header">
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          Projets
        </h2>
        {!isCreating && (
          <button
            ref={(element) => {
              if (element && focusNewProject.current) {
                focusNewProject.current = false
                element.focus()
              }
            }}
            type="button"
            className="button-secondary"
            onClick={() => setIsCreating(true)}
          >
            Nouveau projet
          </button>
        )}
      </div>

      {isCreating && (
        <ProjectCreateForm
          existingKeys={projects?.map((project) => project.key) ?? []}
          onCreated={closeForm}
          onCancel={closeForm}
        />
      )}

      {content}
    </section>
  )
}

interface ProjectTableProps {
  projects: Project[]
  onDeleted: () => void
}

function ProjectTable({ projects, onDeleted }: ProjectTableProps) {
  // L'API renvoie les projets du plus ancien au plus récent : on garde son ordre
  return (
    <table className="project-table" aria-label="Projets">
      <thead>
        <tr>
          <th scope="col">Nom</th>
          <th scope="col">Clé</th>
          <th scope="col">Tickets</th>
          <th scope="col">
            <span className="visually-hidden">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            isOnlyProject={projects.length === 1}
            onDeleted={onDeleted}
          />
        ))}
      </tbody>
    </table>
  )
}
