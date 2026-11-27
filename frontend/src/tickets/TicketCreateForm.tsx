import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { FormEvent } from 'react'

import { fetchProjects } from '../api/projects'
import type { Project } from '../api/projects'
import { ApiError, createTicket } from '../api/tickets'
import { TicketFormFields } from './TicketFormFields'
import type { TicketField } from './TicketFormFields'
import {
  EMPTY_TICKET_FORM,
  hasErrors,
  toTicketCreate,
  validateTicketForm,
} from './ticketForm'
import type { TicketFormErrors, TicketFormValues } from './ticketForm'
import './TicketCreateForm.css'

interface TicketCreateFormProps {
  onCreated: () => void
  onCancel: () => void
}

export function TicketCreateForm({ onCreated, onCancel }: TicketCreateFormProps) {
  const [values, setValues] = useState<TicketFormValues>(EMPTY_TICKET_FORM)
  const [errors, setErrors] = useState<TicketFormErrors>({})
  // Projet choisi par l'utilisateur ; null tant qu'il garde celui proposé
  const [chosenProjectId, setChosenProjectId] = useState<number | null>(null)
  const [isProjectMissing, setIsProjectMissing] = useState(false)
  const queryClient = useQueryClient()

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const projects = projectsQuery.data
  // L'API renvoie les projets du plus ancien au plus récent : le premier est proposé
  const projectId = chosenProjectId ?? projects?.[0]?.id ?? null
  const project = projects?.find((p) => p.id === projectId)
  // Projet choisi, puis supprimé entre-temps : il n'est plus dans la liste rechargée
  const isProjectGone = chosenProjectId !== null && projects !== undefined && !project

  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: async () => {
      // Les listes ne sont plus à jour : TanStack Query les recharge
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
      onCreated()
    },
    onError: async (error) => {
      // Refus de l'API : le projet a peut-être été supprimé. On recharge la liste des
      // projets avant d'afficher le message, pour savoir s'il existe encore.
      if (error instanceof ApiError && error.status === 422) {
        await queryClient.invalidateQueries({ queryKey: ['projects'] })
      }
    },
  })

  function updateField(field: TicketField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }))
    // L'erreur du champ disparaît dès qu'on le corrige
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  function chooseProject(value: string) {
    setChosenProjectId(Number(value))
    setIsProjectMissing(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateTicketForm(values)
    setErrors(validationErrors)
    setIsProjectMissing(!project)
    if (hasErrors(validationErrors) || !project) {
      return
    }
    // Le projet envoyé devient le choix : s'il disparaît, on saura le signaler
    setChosenProjectId(project.id)
    mutation.mutate({ ...toTicketCreate(values), project_id: project.id })
  }

  let apiErrorMessage = 'Le serveur ne répond pas. Réessaie dans un instant.'
  if (mutation.error instanceof ApiError && mutation.error.status === 422) {
    apiErrorMessage = isProjectGone
      ? 'Le projet choisi a été supprimé entre-temps. Choisis un autre projet puis réessaie.'
      : 'Le serveur a refusé ces valeurs. Vérifie les champs et réessaie.'
  }

  return (
    <form
      className="ticket-form"
      aria-label="Nouveau ticket"
      onSubmit={handleSubmit}
      noValidate
    >
      <h2>Nouveau ticket</h2>

      <ProjectField
        projects={projects}
        selected={project}
        isLoading={projectsQuery.isPending}
        loadingFailed={projectsQuery.isLoadingError}
        isRetrying={projectsQuery.isFetching}
        onRetry={() => void projectsQuery.refetch()}
        error={
          isProjectGone
            ? "Ce projet n'existe plus. Choisis-en un autre."
            : isProjectMissing && projects !== undefined
              ? 'Choisis un projet.'
              : undefined
        }
        onChange={chooseProject}
      />

      <TicketFormFields values={values} errors={errors} onChange={updateField} />

      {mutation.isError && (
        <p role="alert" className="form-error">
          Le ticket n'a pas pu être créé. {apiErrorMessage}
        </p>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="button-primary"
          // Pas d'envoi tant que les projets n'ont pas pu être chargés
          disabled={mutation.isPending || projects === undefined}
        >
          {mutation.isPending ? 'Création…' : 'Créer'}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

interface ProjectFieldProps {
  projects: Project[] | undefined
  selected: Project | undefined
  isLoading: boolean
  loadingFailed: boolean
  isRetrying: boolean
  onRetry: () => void
  error: string | undefined
  onChange: (value: string) => void
}

/** Liste déroulante des projets, avec son chargement et ses erreurs. */
function ProjectField({
  projects,
  selected,
  isLoading,
  loadingFailed,
  isRetrying,
  onRetry,
  error,
  onChange,
}: ProjectFieldProps) {
  const id = useId()

  let placeholder: string | null = null
  if (isLoading) placeholder = 'Chargement des projets…'
  else if (loadingFailed) placeholder = 'Projets indisponibles'
  else if (!selected) placeholder = 'Choisis un projet'

  return (
    <div className="field project-field">
      <label htmlFor={`${id}-project`}>
        Projet <span aria-hidden="true">*</span>
      </label>
      <select
        id={`${id}-project`}
        value={selected ? String(selected.id) : ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={projects === undefined}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-project-error` : undefined}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {projects?.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name} ({project.key})
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-project-error`} className="field-error">
          {error}
        </p>
      )}
      {loadingFailed && (
        <div role="alert" className="project-field-alert">
          <p className="field-error">Impossible de charger les projets.</p>
          <button
            type="button"
            className="button-secondary"
            onClick={onRetry}
            disabled={isRetrying}
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  )
}
