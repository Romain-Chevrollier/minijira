import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

import { ApiError } from '../api/http'
import { deleteProject, renameProject } from '../api/projects'
import type { Project } from '../api/projects'
import { PROJECT_NAME_MAX_LENGTH, validateProjectName } from './projectForm'

interface ProjectRowProps {
  project: Project
  /** Le dernier projet ne peut pas être supprimé : il faut toujours un projet. */
  isOnlyProject: boolean
  /** Appelé une fois le projet supprimé : la page place le focus ailleurs. */
  onDeleted: () => void
}

type Mode = 'view' | 'renaming' | 'confirmingDelete'

/** Pourquoi le projet ne peut pas être supprimé, ou null s'il peut l'être. */
function deleteBlockedReason(project: Project, isOnlyProject: boolean): string | null {
  const count = project.ticket_count
  if (count > 0) return `Contient ${count} ${count > 1 ? 'tickets' : 'ticket'} : suppression impossible.`
  if (isOnlyProject) return "C'est le dernier projet : suppression impossible."
  return null
}

/** Une ligne du tableau des projets : lecture, renommage ou confirmation de suppression. */
export function ProjectRow({ project, isOnlyProject, onDeleted }: ProjectRowProps) {
  const id = useId()
  const [mode, setMode] = useState<Mode>('view')
  // Bouton qui reprend le focus en revenant à la lecture, pour ne pas le perdre au clavier
  const returnFocusTo = useRef<'rename' | 'delete' | null>(null)
  const queryClient = useQueryClient()
  const blockedReason = deleteBlockedReason(project, isOnlyProject)

  function backToView(focus: 'rename' | 'delete') {
    returnFocusTo.current = focus
    setMode('view')
  }

  /** Ref d'un bouton : il prend le focus s'il est celui attendu au retour à la lecture. */
  function focusOnReturn(button: 'rename' | 'delete') {
    return (element: HTMLButtonElement | null) => {
      if (element && returnFocusTo.current === button) {
        returnFocusTo.current = null
        element.focus()
      }
    }
  }

  const deletion = useMutation({
    mutationFn: async () => {
      try {
        await deleteProject(project.id)
      } catch (error) {
        // Déjà supprimé entre-temps (404) : le but est atteint
        if (error instanceof ApiError && error.status === 404) return
        throw error
      }
    },
    onSuccess: async () => {
      onDeleted()
      // Retire la ligne tout de suite, puis recharge les projets depuis l'API
      queryClient.setQueryData<Project[]>(['projects'], (projects) =>
        projects?.filter((p) => p.id !== project.id),
      )
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        // Des tickets ont été ajoutés entre-temps : les nombres sont rechargés
        backToView('delete')
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
      }
    },
  })

  let deletionError: string | null = null
  if (deletion.error instanceof ApiError && deletion.error.status === 409) {
    deletionError = deletion.error.detail ?? 'Ce projet ne peut pas être supprimé.'
  } else if (deletion.isError) {
    deletionError =
      "Le projet n'a pas pu être supprimé. Le serveur ne répond pas. Réessaie dans un instant."
  }

  return (
    <tr>
      <td className="project-name-cell">
        {mode === 'renaming' ? (
          <RenameForm project={project} onDone={() => backToView('rename')} />
        ) : (
          <>
            <span className="project-name">{project.name}</span>
            {blockedReason && (
              <span id={`${id}-blocked`} className="project-blocked-reason">
                {blockedReason}
              </span>
            )}
          </>
        )}
      </td>
      <td className="ticket-key">{project.key}</td>
      <td className="project-count">{project.ticket_count}</td>
      <td className="project-actions-cell">
        {mode === 'view' && (
          <div className="project-actions">
            <button
              ref={focusOnReturn('rename')}
              type="button"
              className="button-secondary"
              aria-label={`Renommer ${project.name}`}
              onClick={() => setMode('renaming')}
            >
              Renommer
            </button>
            <button
              ref={focusOnReturn('delete')}
              type="button"
              className="button-secondary button-secondary-danger"
              aria-label={`Supprimer ${project.name}`}
              // aria-disabled et non disabled : le bouton reste atteignable au clavier,
              // et le lecteur d'écran lit la raison avec lui
              aria-disabled={blockedReason ? true : undefined}
              aria-describedby={blockedReason ? `${id}-blocked` : undefined}
              onClick={() => {
                if (blockedReason) return
                deletion.reset()
                setMode('confirmingDelete')
              }}
            >
              Supprimer
            </button>
          </div>
        )}
        {mode === 'confirmingDelete' && (
          <div
            className="project-delete-confirm"
            role="group"
            aria-label={`Confirmer la suppression de ${project.name}`}
          >
            <p>Supprimer le projet « {project.name} » ?</p>
            <div className="project-actions">
              <button
                type="button"
                className="button-danger"
                onClick={() => deletion.mutate()}
                disabled={deletion.isPending}
              >
                {deletion.isPending ? 'Suppression…' : 'Oui, supprimer'}
              </button>
              {/* Le focus va sur « Annuler » : Entrée par réflexe ne supprime rien */}
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  deletion.reset()
                  backToView('delete')
                }}
                disabled={deletion.isPending}
                autoFocus
              >
                Annuler
              </button>
            </div>
          </div>
        )}
        {deletionError && (
          <p role="alert" className="form-error">
            {deletionError}
          </p>
        )}
      </td>
    </tr>
  )
}

interface RenameFormProps {
  project: Project
  onDone: () => void
}

/** Champ de renommage, à la place du nom. Entrée enregistre, Échap annule. */
function RenameForm({ project, onDone }: RenameFormProps) {
  const id = useId()
  const [name, setName] = useState(project.name)
  const [error, setError] = useState<string | undefined>()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (newName: string) => renameProject(project.id, newName),
    onSuccess: async () => {
      // Le nom apparaît aussi dans les tickets (popup) et dans « Nouveau ticket »
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      ])
      onDone()
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validateProjectName(name)
    setError(validationError)
    if (validationError) return
    // Nom inchangé : rien à envoyer
    if (name.trim() === project.name) {
      onDone()
      return
    }
    mutation.mutate(name.trim())
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape' && !mutation.isPending) {
      event.preventDefault()
      onDone()
    }
  }

  const apiErrorMessage =
    mutation.error instanceof ApiError && mutation.error.status === 404
      ? "Ce projet n'existe plus."
      : mutation.error instanceof ApiError && mutation.error.status === 422
        ? 'Le serveur a refusé ce nom. Vérifie-le et réessaie.'
        : 'Le serveur ne répond pas. Réessaie dans un instant.'

  return (
    <form
      className="project-rename-form"
      aria-label={`Renommer ${project.name}`}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      noValidate
    >
      <label htmlFor={`${id}-name`} className="visually-hidden">
        Nouveau nom
      </label>
      <input
        id={`${id}-name`}
        value={name}
        onChange={(event) => {
          setName(event.target.value)
          setError(undefined)
        }}
        maxLength={PROJECT_NAME_MAX_LENGTH}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        autoFocus
      />
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="form-error">
          Le projet n'a pas pu être renommé. {apiErrorMessage}
        </p>
      )}
      <div className="project-actions">
        <button type="submit" className="button-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={onDone}
          disabled={mutation.isPending}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
