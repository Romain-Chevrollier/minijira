import { useDraggable } from '@dnd-kit/core'
import { Link } from 'react-router'

import type { Ticket } from '../api/tickets'
import { PRIORITY_LABELS } from '../tickets/labels'
import type { CardData } from './dragAndDrop'

/**
 * Carte d'un ticket sur le board : un clic (ou Entrée) ouvre sa popup,
 * un glissement (ou Espace puis les flèches) la déplace dans une autre colonne.
 */
export function TicketCard({ ticket }: { ticket: Ticket }) {
  const data: CardData = { ticket }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
    data,
    attributes: { roleDescription: 'carte déplaçable' },
  })
  // La carte reste un lien (et non un bouton, le rôle proposé par dnd-kit)
  const { role: _role, ...dragAttributes } = attributes

  return (
    // Adresse relative au board : /tickets/12.
    // fromView : la popup saura revenir en arrière en se fermant
    <Link
      ref={setNodeRef}
      {...dragAttributes}
      {...listeners}
      className={isDragging ? 'ticket-card ticket-card-dragging' : 'ticket-card'}
      to={`tickets/${ticket.id}`}
      state={{ fromView: true }}
    >
      <TicketCardContent ticket={ticket} />
    </Link>
  )
}

/** Copie de la carte qui suit le pointeur pendant un glissement. */
export function TicketCardPreview({ ticket }: { ticket: Ticket }) {
  return (
    <div className="ticket-card ticket-card-preview" aria-hidden="true">
      <TicketCardContent ticket={ticket} />
    </div>
  )
}

function TicketCardContent({ ticket }: { ticket: Ticket }) {
  return (
    <>
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
    </>
  )
}
