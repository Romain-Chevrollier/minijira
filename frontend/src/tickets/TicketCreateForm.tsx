import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'

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
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: async () => {
      // La liste n'est plus à jour : TanStack Query la recharge
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
      onCreated()
    },
  })

  function updateField(field: TicketField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }))
    // L'erreur du champ disparaît dès qu'on le corrige
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateTicketForm(values)
    setErrors(validationErrors)
    if (hasErrors(validationErrors)) {
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
