import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { fetchTickets } from '../api/tickets'
import type { Ticket, TicketStatus } from '../api/tickets'
import { STATUS_LABELS } from '../tickets/labels'
import { BOARD_STATUSES, groupByStatus } from './boardColumns'
import {
  ANNOUNCEMENTS,
  getMove,
  SCREEN_READER_INSTRUCTIONS,
  useBoardSensors,
} from './dragAndDrop'
import type { CardData } from './dragAndDrop'
import { TicketCard, TicketCardPreview } from './TicketCard'
import { useMoveTicket } from './useMoveTicket'
import './Board.css'

/** Board Kanban : une colonne par statut ; glisser une carte change son statut. */
export function Board() {
  // Même donnée que la liste : une modification faite ailleurs met aussi le board à jour
  const {
    data: tickets,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery({ queryKey: ['tickets'], queryFn: fetchTickets })
  const sensors = useBoardSensors()
  const moveTicket = useMoveTicket()
  const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  function handleDragStart({ active }: DragStartEvent) {
    setDraggedTicket((active.data.current as CardData | undefined)?.ticket ?? null)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggedTicket(null)
    // Lâcher dans sa propre colonne ou hors du board : rien à faire
    const move = getMove(active, over)
    if (!move) return
    setMoveError(null)
    moveTicket.mutate(move, {
      onError: () =>
        setMoveError(
          `Impossible de déplacer « ${move.ticket.title} ». La carte a été remise à sa place.`,
        ),
    })
  }

  if (isPending) {
    return <p role="status">Chargement des tickets…</p>
  }

  // Écran d'erreur seulement si les tickets n'ont jamais pu être chargés : si un
  // rechargement échoue ensuite (backend arrêté…), le board garde ses cartes
  if (isError && tickets === undefined) {
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
    <>
      {moveError && (
        <div role="alert" className="board-error board-move-error">
          <p>{moveError}</p>
          <button
            type="button"
            className="icon-button"
            aria-label="Fermer le message"
            onClick={() => setMoveError(null)}
          >
            ✕
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        accessibility={{
          announcements: ANNOUNCEMENTS,
          screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggedTicket(null)}
      >
        <div className="board">
          {BOARD_STATUSES.map((status) => (
            <BoardColumn key={status} status={status} tickets={columns[status]} />
          ))}
        </div>

        {/* Copie de la carte qui suit le pointeur ; pas d'animation au lâcher */}
        <DragOverlay dropAnimation={null}>
          {draggedTicket && <TicketCardPreview ticket={draggedTicket} />}
        </DragOverlay>
      </DndContext>
    </>
  )
}

interface BoardColumnProps {
  status: TicketStatus
  tickets: Ticket[]
}

function BoardColumn({ status, tickets }: BoardColumnProps) {
  const titleId = useId()
  // Chaque colonne est une zone où l'on peut lâcher une carte
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    // Zone nommée par son titre (« À faire »…) pour les lecteurs d'écran
    <section
      ref={setNodeRef}
      className={isOver ? 'board-column board-column-over' : 'board-column'}
      aria-labelledby={titleId}
      data-status={status}
    >
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
