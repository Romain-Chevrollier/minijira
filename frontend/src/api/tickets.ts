// Types alignés sur le schéma TicketRead du backend (backend/app/schemas.py)
export type TicketStatus = 'todo' | 'in_progress' | 'done'
export type TicketPriority = 'low' | 'medium' | 'high'

export interface Ticket {
  id: number
  title: string
  description: string | null
  priority: TicketPriority
  assignee: string | null
  status: TicketStatus
  created_at: string
}

/** Liste des tickets, du plus récent au plus ancien (tri fait par l'API). */
export async function fetchTickets(): Promise<Ticket[]> {
  const response = await fetch('/api/tickets')
  if (!response.ok) {
    throw new Error(`Erreur ${response.status} au chargement des tickets`)
  }
  return (await response.json()) as Ticket[]
}
