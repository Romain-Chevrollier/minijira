import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { FormEvent } from 'react'

import { ApiError, createTicket } from '../api/tickets'
import type { TicketPriority } from '../api/tickets'
import { PRIORITY_LABELS } from './labels'
import {
  ASSIGNEE_MAX_LENGTH,
  EMPTY_TICKET_FORM,
  TITLE_MAX_LENGTH,
  toTicketCreate,
  validateTicketForm,
} from './ticketForm'
import type { TicketFormErrors, TicketFormValues } from './ticketForm'
import './TicketCreateForm.css'

interface TicketCreateFormProps {
  onCreated: () => void
  onCancel: () => void
}

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high']

export function TicketCreateForm({ onCreated, onCancel }: TicketCreateFormProps) {
  const id = useId()
  const [values, setValues] = useState<TicketFormValues>(EMPTY_TICKET_FORM)
  const [errors, setErrors] = useState<TicketFormErrors>({})
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: async () => {
      // La liste n'est plus à jour : TanStack Query la recharge
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
      onCreated()
    },
  })

  function updateField<K extends keyof TicketFormValues>(
    field: K,
    value: TicketFormValues[K],
  ) {
    setValues((previous) => ({ ...previous, [field]: value }))
    // L'erreur du champ disparaît dès qu'on le corrige
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateTicketForm(values)
    setErrors(validationErrors)
    if (Object.values(validationErrors).some(Boolean)) {
      return
    }
    mutation.mutate(toTicketCreate(values))
  }

  const apiErrorMessage =
    mutation.error instanceof ApiError && mutation.error.status === 422
      ? 'Le serveur a refusé ces valeurs. Vérifie les champs et réessaie.'
      : 'Le serveur ne répond pas. Réessaie dans un instant.'

  return (
    <form
      className="ticket-form"
      aria-label="Nouveau ticket"
      onSubmit={handleSubmit}
      noValidate
    >
      <h2>Nouveau ticket</h2>

      <div className="field">
        <label htmlFor={`${id}-title`}>
          Titre <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${id}-title`}
          value={values.title}
          onChange={(event) => updateField('title', event.target.value)}
          maxLength={TITLE_MAX_LENGTH}
          required
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? `${id}-title-error` : undefined}
          autoFocus
        />
        {errors.title && (
          <p id={`${id}-title-error`} className="field-error">
            {errors.title}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${id}-description`}>Description</label>
        <textarea
          id={`${id}-description`}
          value={values.description}
          onChange={(event) => updateField('description', event.target.value)}
          rows={3}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`${id}-priority`}>Priorité</label>
          <select
            id={`${id}-priority`}
            value={values.priority}
            onChange={(event) =>
              updateField('priority', event.target.value as TicketPriority)
            }
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id}-assignee`}>Assigné</label>
          <input
            id={`${id}-assignee`}
            value={values.assignee}
            onChange={(event) => updateField('assignee', event.target.value)}
            maxLength={ASSIGNEE_MAX_LENGTH}
            aria-invalid={errors.assignee ? true : undefined}
            aria-describedby={errors.assignee ? `${id}-assignee-error` : undefined}
          />
          {errors.assignee && (
            <p id={`${id}-assignee-error`} className="field-error">
              {errors.assignee}
            </p>
          )}
        </div>
      </div>

      {mutation.isError && (
        <p role="alert" className="form-error">
          Le ticket n'a pas pu être créé. {apiErrorMessage}
        </p>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="button-primary"
          disabled={mutation.isPending}
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
