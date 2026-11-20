import { Link } from 'react-router'

import type { Ticket } from '../api/tickets'
import { PRIORITY_LABELS } from '../tickets/labels'

/** Carte d'un ticket sur le board : un clic (ou Entrée) ouvre sa popup. */
export function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    // Adresse relative au board : /tickets/12.
    // fromView : la popup saura revenir en arrière en se fermant
    <Link className="ticket-card" to={`tickets/${ticket.id}`} state={{ fromView: true }}>
      <span className="ticket-card-title">{ticket.title}</span>
      <span className="ticket-card-meta">
        {/* La couleur accompagne le libellé, elle ne le remplace pas */}
        <span className={`ticket-card-priority priority-${ticket.priority}`}>
          {PRIORITY_LABELS[ticket.priority]}
        </span>
        {ticket.assignee && (
          <span className="ticket-card-assignee">{ticket.assignee}</span>
        )}
      </span>
    </Link>
  )
}
