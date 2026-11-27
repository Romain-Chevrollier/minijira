import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router'

import { fetchTickets } from '../api/tickets'
import type { Ticket } from '../api/tickets'
import { filterByProject, useProjectFilter } from '../projects/useProjectFilter'
import { StaleDataNotice } from '../query/StaleDataNotice'
import { useRefreshFailed } from '../query/useRefreshFailed'
import { formatDate, PRIORITY_LABELS, STATUS_LABELS } from './labels'
import { EmptyProjectMessage } from '../projects/EmptyProjectMessage'
import './TicketList.css'

export function TicketList() {
  const {
    data: tickets,
    isPending,
    isLoadingError,
    isFetching,
    refetch,
  } = useQuery({ queryKey: ['tickets'], queryFn: fetchTickets })
  const { failed } = useRefreshFailed(['tickets'])
  const { projectKey, projectName } = useProjectFilter()

  if (isPending) {
    return <p role="status">Chargement des tickets…</p>
  }

  // Écran d'erreur seulement si les tickets n'ont jamais pu être chargés
  if (isLoadingError) {
    return (
      <div role="alert" className="ticket-list-error">
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

  const visibleTickets = filterByProject(tickets, projectKey)
  let content
  if (visibleTickets.length > 0) {
    content = <TicketTable tickets={visibleTickets} />
  } else if (projectKey) {
    content = <EmptyProjectMessage name={projectName ?? projectKey} />
  } else {
    content = <p>Aucun ticket pour l'instant.</p>
  }

  return (
    <>
      <StaleDataNotice isStale={failed} isRetrying={isFetching} onRetry={() => void refetch()} />
      {content}
    </>
  )
}

function TicketTable({ tickets }: { tickets: readonly Ticket[] }) {
  // ?projet=… : le filtre reste actif dans la popup et après sa fermeture
  const { search } = useLocation()
  // L'API renvoie déjà les tickets du plus récent au plus ancien : on garde son ordre
  return (
    <table className="ticket-list" aria-label="Tickets">
      <thead>
        <tr>
          <th scope="col">Clé</th>
          <th scope="col">Titre</th>
          <th scope="col">Statut</th>
          <th scope="col">Priorité</th>
          <th scope="col">Créé le</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((ticket) => (
          <tr key={ticket.id}>
            <td className="ticket-key">{ticket.key}</td>
            <td className="ticket-list-title">
              {/* Adresse relative à la vue, filtre compris : /liste/tickets/12?projet=MAISON.
                  fromView : la popup saura revenir en arrière en se fermant */}
              <Link to={{ pathname: `tickets/${ticket.id}`, search }} state={{ fromView: true }}>
                {ticket.title}
              </Link>
            </td>
            <td>
              <span className={`badge badge-status-${ticket.status}`}>
                {STATUS_LABELS[ticket.status]}
              </span>
            </td>
            <td>
              <span className={`badge badge-priority-${ticket.priority}`}>
                {PRIORITY_LABELS[ticket.priority]}
              </span>
            </td>
            <td>
              <time dateTime={ticket.created_at}>
                {formatDate(ticket.created_at)}
              </time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
