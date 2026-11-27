import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { ApiError } from '../api/http'
import { createProject } from '../api/projects'
import {
  cleanKeyInput,
  keyTakenMessage,
  PROJECT_KEY_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  suggestKey,
  validateProjectKey,
  validateProjectName,
} from './projectForm'

interface ProjectCreateFormProps {
  /** Clés des projets connus : une clé prise est signalée sans attendre l'API. */
  existingKeys: readonly string[]
  onCreated: () => void
  onCancel: () => void
}

interface Errors {
  name?: string
  key?: string
}

export function ProjectCreateForm({ existingKeys, onCreated, onCancel }: ProjectCreateFormProps) {
  const id = useId()
  const [name, setName] = useState('')
  // Clé tapée à la main ; null tant que l'utilisateur garde celle proposée
  const [typedKey, setTypedKey] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const keyInput = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const key = typedKey ?? suggestKey(name)

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      // Tous les choix de projet de l'application sont rechargés
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      onCreated()
    },
    onError: (error) => {
      // Clé prise entre-temps : le message va sous le champ concerné
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ key: error.detail ?? keyTakenMessage(key) })
        // Le focus revient sur la clé : son message d'erreur est lu avec elle
        keyInput.current?.focus()
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
      }
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = {
      name: validateProjectName(name),
      key: validateProjectKey(key, existingKeys),
    }
    setErrors(validationErrors)
    if (validationErrors.name || validationErrors.key) return
    mutation.mutate({ name: name.trim(), key })
  }

  // Le 409 est affiché sous la clé : ce message ne concerne que les autres échecs
  const showApiError =
    mutation.isError && !(mutation.error instanceof ApiError && mutation.error.status === 409)
  const apiErrorMessage =
    mutation.error instanceof ApiError && mutation.error.status === 422
      ? 'Le serveur a refusé ces valeurs. Vérifie les champs et réessaie.'
      : 'Le serveur ne répond pas. Réessaie dans un instant.'

  return (
    <form className="ticket-form" aria-label="Nouveau projet" onSubmit={handleSubmit} noValidate>
      <h3>Nouveau projet</h3>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`${id}-name`}>
            Nom <span aria-hidden="true">*</span>
          </label>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setErrors((previous) => ({
                ...previous,
                name: undefined,
                // La clé proposée change avec le nom : son erreur n'a plus lieu d'être
                key: typedKey === null ? undefined : previous.key,
              }))
            }}
            maxLength={PROJECT_NAME_MAX_LENGTH}
            required
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
            autoFocus
          />
          {errors.name && (
            <p id={`${id}-name-error`} className="field-error">
              {errors.name}
            </p>
          )}
        </div>

        <div className="field project-key-field">
          <label htmlFor={`${id}-key`}>
            Clé <span aria-hidden="true">*</span>
          </label>
          <input
            ref={keyInput}
            id={`${id}-key`}
            value={key}
            onChange={(event) => {
              setTypedKey(cleanKeyInput(event.target.value))
              setErrors((previous) => ({ ...previous, key: undefined }))
            }}
            maxLength={PROJECT_KEY_MAX_LENGTH}
            required
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={errors.key ? true : undefined}
            aria-describedby={`${id}-key-help${errors.key ? ` ${id}-key-error` : ''}`}
          />
          <p id={`${id}-key-help`} className="field-help">
            La clé ne pourra plus être modifiée. Elle préfixe les tickets :{' '}
            {key || 'CLE'}-1, {key || 'CLE'}-2…
          </p>
          {errors.key && (
            <p id={`${id}-key-error`} className="field-error">
              {errors.key}
            </p>
          )}
        </div>
      </div>

      {showApiError && (
        <p role="alert" className="form-error">
          Le projet n'a pas pu être créé. {apiErrorMessage}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Création…' : 'Créer le projet'}
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
