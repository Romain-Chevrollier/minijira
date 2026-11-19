import type { Ticket } from '../api/tickets'
import { formatDate, PRIORITY_LABELS, STATUS_LABELS } from './labels'

interface TicketDetailsProps {
  ticket: Ticket
  onEdit: () => void
}

/** Lecture d'un ticket : tous ses champs, et le bouton pour le modifier. */
export function TicketDetails({ ticket, onEdit }: TicketDetailsProps) {
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

      <div className="form-actions">
        <button type="button" className="button-primary" onClick={onEdit}>
          Modifier
        </button>
      </div>
    </div>
  )
}
