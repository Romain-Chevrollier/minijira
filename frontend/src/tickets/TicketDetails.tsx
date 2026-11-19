import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError, deleteTicket } from '../api/tickets'
import type { Ticket } from '../api/tickets'
import { formatDate, PRIORITY_LABELS, STATUS_LABELS } from './labels'

interface TicketDetailsProps {
  ticket: Ticket
  onEdit: () => void
  /** Appelé une fois le ticket supprimé, pour fermer la popup. */
  onDeleted: () => void
}

/** Lecture d'un ticket : tous ses champs, et les boutons pour le modifier ou le supprimer. */
export function TicketDetails({ ticket, onEdit, onDeleted }: TicketDetailsProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const queryClient = useQueryClient()

  const deletion = useMutation({
    mutationFn: async () => {
      try {
        await deleteTicket(ticket.id)
      } catch (error) {
        // Déjà supprimé entre-temps (404) : le but est atteint, pas d'erreur à afficher
        if (error instanceof ApiError && error.status === 404) return
        throw error
      }
    },
    onSuccess: async () => {
      onDeleted()
      // Retire le ticket de la liste tout de suite, puis la recharge depuis l'API
      queryClient.setQueryData<Ticket[]>(['tickets'], (tickets) =>
        tickets?.filter((t) => t.id !== ticket.id),
      )
      await queryClient.invalidateQueries({ queryKey: ['tickets'], exact: true })
    },
  })

  return (
    <div className="ticket-details">
      <div className="ticket-badges">
        <span className={`badge badge-status-${ticket.status}`}>
          {STATUS_LABELS[ticket.status]}
        </span>
        <span className={`badge badge-priority-${ticket.priority}`}>
          {PRIORITY_LABELS[ticket.priority]}
        </span>
      </div>

      <dl className="ticket-facts">
        <dt>Assigné</dt>
        <dd className={ticket.assignee ? undefined : 'empty'}>
          {ticket.assignee ?? 'Non assigné'}
        </dd>
        <dt>Créé le</dt>
        <dd>
          <time dateTime={ticket.created_at}>{formatDate(ticket.created_at)}</time>
        </dd>
      </dl>

      <section aria-label="Description">
        <h3>Description</h3>
        <p className={ticket.description ? 'ticket-description' : 'empty'}>
          {ticket.description ?? 'Aucune description.'}
        </p>
      </section>

      {isConfirmingDelete ? (
        <div
          className="delete-confirm"
          role="group"
          aria-label="Confirmer la suppression"
        >
          <p>Supprimer définitivement ce ticket ?</p>
          <div className="form-actions">
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
                setIsConfirmingDelete(false)
                deletion.reset()
              }}
              disabled={deletion.isPending}
              autoFocus
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="form-actions details-actions">
          <button type="button" className="button-primary" onClick={onEdit}>
            Modifier
          </button>
          <button
            type="button"
            className="button-secondary button-secondary-danger"
            onClick={() => setIsConfirmingDelete(true)}
          >
            Supprimer
          </button>
        </div>
      )}

      {deletion.isError && (
        <p role="alert" className="form-error">
          Le ticket n'a pas pu être supprimé. Le serveur ne répond pas. Réessaie dans
          un instant.
        </p>
      )}
    </div>
  )
}
