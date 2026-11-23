import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { ApiError, updateTicket } from '../api/tickets'
import type { Ticket, TicketUpdate } from '../api/tickets'
import { TicketFormFields } from './TicketFormFields'
import type { TicketField } from './TicketFormFields'
import {
  hasErrors,
  ticketToEditValues,
  toTicketUpdate,
  validateTicketForm,
} from './ticketForm'
import type { TicketEditValues, TicketFormErrors } from './ticketForm'

interface TicketEditFormProps {
  ticket: Ticket
  onDone: () => void
}

export function TicketEditForm({ ticket, onDone }: TicketEditFormProps) {
  // Photo du ticket au clic sur « Modifier » : un rechargement pendant la saisie ne la
  // change pas, on n'envoie donc que ce que l'utilisateur a modifié lui-même.
  const [initialTicket] = useState(ticket)
  const [values, setValues] = useState<TicketEditValues>(() =>
    ticketToEditValues(ticket),
  )
  const [errors, setErrors] = useState<TicketFormErrors>({})
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (changes: TicketUpdate) => updateTicket(ticket.id, changes),
    onSuccess: async (updated) => {
      // Le détail est mis à jour tout de suite, puis la liste est rechargée
      queryClient.setQueryData(['tickets', ticket.id], updated)
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
      onDone()
    },
  })

  function updateField(field: TicketField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validateTicketForm(values)
    setErrors(validationErrors)
    if (hasErrors(validationErrors)) {
      return
    }
    const changes = toTicketUpdate(initialTicket, values)
    // Rien n'a changé : inutile d'appeler l'API (elle refuserait une requête vide)
    if (Object.keys(changes).length === 0) {
      onDone()
      return
    }
    mutation.mutate(changes)
  }

  const apiErrorMessage =
    mutation.error instanceof ApiError && mutation.error.status === 422
      ? 'Le serveur a refusé ces valeurs. Vérifie les champs et réessaie.'
      : mutation.error instanceof ApiError && mutation.error.status === 404
        ? "Ce ticket n'existe plus."
        : 'Le serveur ne répond pas. Réessaie dans un instant.'

  return (
    <form
      className="ticket-edit-form"
      aria-label="Modifier le ticket"
      onSubmit={handleSubmit}
      noValidate
    >
      <TicketFormFields values={values} errors={errors} onChange={updateField} />

      {mutation.isError && (
        <p role="alert" className="form-error">
          Le ticket n'a pas pu être modifié. {apiErrorMessage}
        </p>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="button-primary"
          disabled={mutation.isPending}
        >
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
