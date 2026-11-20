import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'

import { fetchTickets } from '../api/tickets'
import type { Ticket, TicketStatus } from '../api/tickets'
import { STATUS_LABELS } from '../tickets/labels'
import { BOARD_STATUSES, groupByStatus } from './boardColumns'
import { TicketCard } from './TicketCard'
import './Board.css'

/** Board Kanban : une colonne par statut. */
export function Board() {
  // Même donnée que la liste : une modification faite ailleurs met aussi le board à jour
  const {
    data: tickets,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery({ queryKey: ['tickets'], queryFn: fetchTickets })

  if (isPending) {
    return <p role="status">Chargement des tickets…</p>
  }

  if (isError) {
    return (
      <div role="alert" className="board-error">
        <p>Impossible de charger les tickets.</p>
        <button
          type="button"
          className="button-secondary"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          Réessayer
        </button>
      </div>
    )
  }

  const columns = groupByStatus(tickets)

  return (
    <div className="board">
      {BOARD_STATUSES.map((status) => (
        <BoardColumn key={status} status={status} tickets={columns[status]} />
      ))}
    </div>
  )
}

interface BoardColumnProps {
  status: TicketStatus
  tickets: Ticket[]
}

function BoardColumn({ status, tickets }: BoardColumnProps) {
  const titleId = useId()

  return (
    // Zone nommée par son titre (« À faire »…) pour les lecteurs d'écran
    <section className="board-column" aria-labelledby={titleId}>
      <header className="board-column-header">
        <h2 id={titleId}>{STATUS_LABELS[status]}</h2>
        <span className="board-column-count">
          {tickets.length}
          {/* Lu par les lecteurs d'écran, invisible à l'écran : « 2 tickets » */}
          <span className="visually-hidden">
            {tickets.length > 1 ? ' tickets' : ' ticket'}
          </span>
        </span>
      </header>

      {tickets.length === 0 ? (
        <p className="board-column-empty">Aucun ticket</p>
      ) : (
        <ul className="board-column-cards">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <TicketCard ticket={ticket} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
