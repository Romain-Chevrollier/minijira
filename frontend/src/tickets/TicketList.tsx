import { useQuery } from '@tanstack/react-query'

import { fetchTickets } from '../api/tickets'
import { formatDate, PRIORITY_LABELS, STATUS_LABELS } from './labels'
import './TicketList.css'

export function TicketList() {
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
      <div role="alert" className="ticket-list-error">
        <p>Impossible de charger les tickets.</p>
        <button type="button" onClick={() => refetch()} disabled={isFetching}>
          Réessayer
        </button>
      </div>
    )
  }

  if (tickets.length === 0) {
    return <p>Aucun ticket pour l'instant.</p>
  }

  // L'API renvoie déjà les tickets du plus récent au plus ancien : on garde son ordre
  return (
    <table className="ticket-list" aria-label="Tickets">
      <thead>
        <tr>
          <th scope="col">Titre</th>
          <th scope="col">Statut</th>
          <th scope="col">Priorité</th>
          <th scope="col">Créé le</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((ticket) => (
          <tr key={ticket.id}>
            <td>{ticket.title}</td>
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
