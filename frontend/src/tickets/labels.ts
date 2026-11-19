import type { TicketPriority, TicketStatus } from '../api/tickets'

export const STATUS_LABELS: Record<TicketStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** "2026-11-18T12:00:00Z" -> "18/11/2026", dans le fuseau horaire du navigateur. */
export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(isoDate))
}
