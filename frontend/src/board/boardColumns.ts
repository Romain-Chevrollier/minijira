import type { Ticket, TicketPriority, TicketStatus } from '../api/tickets'

/** Les colonnes du board, de gauche à droite. */
export const BOARD_STATUSES: readonly TicketStatus[] = ['todo', 'in_progress', 'done']

/** Plus le nombre est petit, plus la carte est haut dans sa colonne. */
const PRIORITY_RANK: Record<TicketPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

/** Priorité (Haute d'abord), puis du plus récent au plus ancien, puis numéro décroissant. */
function compareTickets(a: Ticket, b: Ticket): number {
  return (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    Date.parse(b.created_at) - Date.parse(a.created_at) ||
    b.id - a.id
  )
}

/** Range les tickets par statut, chaque colonne étant triée pour l'affichage. */
export function groupByStatus(tickets: readonly Ticket[]): Record<TicketStatus, Ticket[]> {
  const columns: Record<TicketStatus, Ticket[]> = { todo: [], in_progress: [], done: [] }
  for (const ticket of tickets) {
    columns[ticket.status].push(ticket)
  }
  for (const status of BOARD_STATUSES) {
    columns[status].sort(compareTickets)
  }
  return columns
}
